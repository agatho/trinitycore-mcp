# WoW 12.x Opcode Subsystem Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 8-entry hand-written opcode dictionary with a build-keyed table of 2,384 real 12.1 opcodes, carrying the provenance and the known-unknowns of the derivation it comes from.

**Architecture:** A build-time converter parses the validated `Opcodes.cs` tables from the WowPacketParser fork into per-build JSON, alongside imported family-shift provenance. A runtime `OpcodeTable` indexes them by name, value and family/index. Existing tools rewire onto it; the 8 hand-written descriptions survive as an annotation overlay.

**Tech Stack:** TypeScript 5.3 (strict, CommonJS, `moduleResolution: node`), Node 18+, Jest + ts-jest. Imports are extensionless — follow that convention.

**Spec:** `docs/superpowers/specs/2026-08-27-wow-12-1-opcode-subsystem-design.md`

## Global Constraints

- **Source of truth is `C:\dumps\wpp_tc\WowPacketParser\Enums\Version\`.** Do not re-derive the family shift in TypeScript; the derivation is validated against 1,058,913 sniffed packets and the client's own JAM type-name strings. This plan consumes its output.
- **Verified source structure** (`V12_1_0_69214/Opcodes.cs`): `ClientOpcodes` block at lines 25-1020, `ServerOpcodes` at 1022-2415, `MiscOpcodes` is `new()` and **empty**. Entries are `            { Opcode.NAME, 0xHEX },`. Total: **2,384** entries.
- **Families `0x2E` and `0x35` are deliberately excluded** from the source table — their shift is not uniquely determined. A query into them must return an *undetermined family* response, never "unknown opcode". Collapsing that distinction is a correctness bug, not a UX choice.
- **Index offsets with `null`** in `wow_family_shift_12_1.json` mean the offset could not be decided. Preserve them; do not coerce to 0.
- **`get-opcode-info` must not break.** It is registered at `src/tools/registry/game-data.ts:126-144` with an `opcode: string` input. Keep the name and the parameter.
- **The 8 existing annotations must survive.** `src/tools/opcode.ts` holds hand-written `description`, `structure` and `example` fields for `CMSG_CAST_SPELL`, `SMSG_SPELL_GO`, `CMSG_PLAYER_LOGIN`, `SMSG_LOGIN_VERIFY_WORLD`, `CMSG_MESSAGECHAT`, `SMSG_MESSAGECHAT`, `MSG_MOVE_STOP` and one further entry. Losing them for a bigger-but-barer table is a net regression.
- **TypeScript strict mode.** No `any` without a written justification comment.
- Test root is `tests/`, matching `**/*.test.ts`. Run `npx tsc --noEmit` before every commit.
- `npm test` has ~11 known pre-existing failures. Do not add to them.

---

### Task 1: Opcodes.cs converter

**Files:**
- Create: `src/opcodes/OpcodesCsParser.ts`
- Create: `tests/opcodes/fixtures/sample-opcodes.cs`
- Test: `tests/opcodes/OpcodesCsParser.test.ts`

**Interfaces:**
- Produces: `ParsedOpcode`, `ParsedOpcodeFile`, `parseOpcodesCs(content: string): ParsedOpcodeFile`, `OpcodesParseError`.

Direction comes from which `BiDictionary` block an entry sits in, not from its name prefix — the block is authoritative and a name prefix is a convention.

- [ ] **Step 1: Write the failing test**

Create the fixture first:

```csharp
// tests/opcodes/fixtures/sample-opcodes.cs
using WowPacketParser.Misc;

namespace WowPacketParser.Enums.Version.V12_1_0_69214
{
    // Generated from V12_0_7_67808 by applying the 12.1 protocol channel-id shift.
    public static class Opcodes_12_1_0
    {
        public static BiDictionary<Opcode, int> Opcodes(Direction direction)
        {
            switch (direction)
            {
                case Direction.ClientToServer:
                    return ClientOpcodes;
                default:
                    return MiscOpcodes;
            }
        }

        private static readonly BiDictionary<Opcode, int> ClientOpcodes = new()
        {
            { Opcode.CMSG_ACCEPT_GUILD_INVITE, 0x430029 },
            // a comment between entries
            { Opcode.CMSG_ACCEPT_TRADE, 0x3D0004 },
        };

        private static readonly BiDictionary<Opcode, int> ServerOpcodes = new()
        {
            { Opcode.SMSG_ABORT_NEW_WORLD, 0x450030 },
        };

        private static readonly BiDictionary<Opcode, int> MiscOpcodes = new();
    }
}
```

```ts
// tests/opcodes/OpcodesCsParser.test.ts
import * as fs from "fs";
import * as path from "path";
import { parseOpcodesCs, OpcodesParseError } from "../../src/opcodes/OpcodesCsParser";

const fixture = fs.readFileSync(path.join(__dirname, "fixtures", "sample-opcodes.cs"), "utf8");

describe("parseOpcodesCs", () => {
  it("parses every entry across both populated blocks", () => {
    const r = parseOpcodesCs(fixture);
    expect(r.opcodes).toHaveLength(3);
  });

  it("assigns direction from the containing block, not the name prefix", () => {
    const r = parseOpcodesCs(fixture);
    expect(r.opcodes.find((o) => o.name === "CMSG_ACCEPT_TRADE")!.direction).toBe("CMSG");
    expect(r.opcodes.find((o) => o.name === "SMSG_ABORT_NEW_WORLD")!.direction).toBe("SMSG");
  });

  it("decomposes value into family and index", () => {
    const o = parseOpcodesCs(fixture).opcodes.find((x) => x.name === "CMSG_ACCEPT_GUILD_INVITE")!;
    expect(o.value).toBe(0x430029);
    expect(o.hex).toBe("0x430029");
    expect(o.family).toBe("0x43");
    expect(o.index).toBe("0x029");
  });

  it("ignores comments between entries", () => {
    expect(parseOpcodesCs(fixture).opcodes.map((o) => o.name)).not.toContain("a");
  });

  it("tolerates an empty MiscOpcodes block", () => {
    expect(() => parseOpcodesCs(fixture)).not.toThrow();
  });

  it("throws when no opcode blocks are found", () => {
    expect(() => parseOpcodesCs("namespace X { }")).toThrow(OpcodesParseError);
  });

  it("throws with a line number on a malformed entry", () => {
    const bad = fixture.replace("{ Opcode.CMSG_ACCEPT_TRADE, 0x3D0004 },", "{ Opcode.CMSG_BROKEN, notahex },");
    expect(() => parseOpcodesCs(bad)).toThrow(/line \d+/);
  });

  it("rejects duplicate opcode names", () => {
    const dup = fixture.replace(
      "{ Opcode.CMSG_ACCEPT_TRADE, 0x3D0004 },",
      "{ Opcode.CMSG_ACCEPT_GUILD_INVITE, 0x3D0004 },"
    );
    expect(() => parseOpcodesCs(dup)).toThrow(/duplicate/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/opcodes/OpcodesCsParser.test.ts`
Expected: FAIL — `Cannot find module '../../src/opcodes/OpcodesCsParser'`

- [ ] **Step 3: Write minimal implementation**

```ts
// src/opcodes/OpcodesCsParser.ts
/**
 * Parses WowPacketParser Opcodes.cs tables into structured opcode records.
 *
 * The source file declares up to three BiDictionary blocks — ClientOpcodes,
 * ServerOpcodes and MiscOpcodes. An entry's direction comes from its
 * containing block, which is authoritative; a name prefix is only convention.
 *
 * @module opcodes/OpcodesCsParser
 */

export type OpcodeDirection = "CMSG" | "SMSG" | "MSG";

export interface ParsedOpcode {
  name: string;
  value: number;
  hex: string;
  direction: OpcodeDirection;
  family: string;
  index: string;
}

export interface ParsedOpcodeFile {
  opcodes: ParsedOpcode[];
  counts: Record<OpcodeDirection, number>;
}

export class OpcodesParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OpcodesParseError";
  }
}

const BLOCK_DIRECTIONS: Array<{ marker: string; direction: OpcodeDirection }> = [
  { marker: "ClientOpcodes", direction: "CMSG" },
  { marker: "ServerOpcodes", direction: "SMSG" },
  { marker: "MiscOpcodes", direction: "MSG" },
];

const BLOCK_START = /private\s+static\s+readonly\s+BiDictionary<Opcode,\s*int>\s+(\w+)\s*=\s*new\(\)/;
const ENTRY = /^\s*\{\s*Opcode\.([A-Za-z0-9_]+)\s*,\s*(0[xX][0-9A-Fa-f]+|\d+)\s*\}\s*,?\s*$/;

/** Format the high 16 bits as the protocol family channel. */
function familyOf(value: number): string {
  return `0x${(value >>> 16).toString(16).toUpperCase().padStart(2, "0")}`;
}

/** Format the low 16 bits as the within-family message index. */
function indexOf(value: number): string {
  return `0x${(value & 0xffff).toString(16).toUpperCase().padStart(3, "0")}`;
}

/**
 * Parse an Opcodes.cs file.
 * @throws {OpcodesParseError} when no blocks are found, an entry is malformed,
 *         or a name appears twice. Never returns a partial table.
 */
export function parseOpcodesCs(content: string): ParsedOpcodeFile {
  const lines = content.split(/\r?\n/);
  const opcodes: ParsedOpcode[] = [];
  const seen = new Map<string, number>();

  let currentDirection: OpcodeDirection | null = null;
  let blocksFound = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const blockMatch = BLOCK_START.exec(line);
    if (blockMatch) {
      const found = BLOCK_DIRECTIONS.find((b) => b.marker === blockMatch[1]);
      currentDirection = found ? found.direction : null;
      if (found) {
        blocksFound++;
      }
      continue;
    }

    if (currentDirection === null) {
      continue;
    }

    if (/^\s*\};?\s*$/.test(line)) {
      currentDirection = null;
      continue;
    }

    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith("//")) {
      continue;
    }

    if (!trimmed.startsWith("{")) {
      continue;
    }

    const entry = ENTRY.exec(line);
    if (!entry) {
      throw new OpcodesParseError(
        `Malformed opcode entry at line ${i + 1}: ${line.trim()}`
      );
    }

    const name = entry[1];
    const value = Number(entry[2]);
    if (!Number.isFinite(value)) {
      throw new OpcodesParseError(`Unparseable opcode value at line ${i + 1}: ${line.trim()}`);
    }

    const previous = seen.get(name);
    if (previous !== undefined) {
      throw new OpcodesParseError(
        `Duplicate opcode name ${name} at line ${i + 1} (first seen at line ${previous})`
      );
    }
    seen.set(name, i + 1);

    opcodes.push({
      name,
      value,
      hex: `0x${value.toString(16).toUpperCase().padStart(6, "0")}`,
      direction: currentDirection,
      family: familyOf(value),
      index: indexOf(value),
    });
  }

  if (blocksFound === 0) {
    throw new OpcodesParseError("No BiDictionary<Opcode, int> blocks found; is this an Opcodes.cs file?");
  }

  const counts: Record<OpcodeDirection, number> = { CMSG: 0, SMSG: 0, MSG: 0 };
  for (const o of opcodes) {
    counts[o.direction]++;
  }

  return { opcodes, counts };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest tests/opcodes/OpcodesCsParser.test.ts`
Expected: PASS, 8 tests

- [ ] **Step 5: Type-check and commit**

```bash
npx tsc --noEmit
git add src/opcodes/OpcodesCsParser.ts tests/opcodes/
git commit -m "feat: Add Opcodes.cs parser for WowPacketParser tables"
```

---

### Task 2: Provenance importer

**Files:**
- Create: `src/opcodes/OpcodeProvenance.ts`
- Test: `tests/opcodes/OpcodeProvenance.test.ts`

**Interfaces:**
- Produces: `FamilyShift`, `IndexOffsetRange`, `OpcodeProvenance`, `ProvenanceCode`, `parseProvenance(raw: unknown): OpcodeProvenance`, `confidenceFor(prov, family): Confidence | null`.

The real file `C:\dumps\wow_family_shift_12_1.json` has top-level keys `_meta`, `family_shift` (46 families, each `{ shift, provenance, client_family }`) and `index_offsets` (3 families, each an array of `{ catalog_index_from, offset }` where `offset` may be `null`).

- [ ] **Step 1: Write the failing test**

```ts
// tests/opcodes/OpcodeProvenance.test.ts
import { parseProvenance, confidenceFor } from "../../src/opcodes/OpcodeProvenance";

const raw = {
  _meta: { created: "2026-08-20", builds: "12.1.0.69214 .. 12.1.0.69382" },
  family_shift: {
    "0x29": { shift: 1, provenance: "wire", client_family: "0x2A" },
    "0x2C": { shift: 1, provenance: "interp", client_family: "0x2D" },
    "0x2E": { shift: 1, provenance: "ambiguous", client_family: "0x2F" },
    "0x42": { shift: 3, provenance: "jam", client_family: "0x45" },
  },
  index_offsets: {
    "0x3A": [
      { catalog_index_from: "0x000", offset: 0 },
      { catalog_index_from: "0x100", offset: null },
    ],
    "0x3B": [{ catalog_index_from: "0x000", offset: 2 }],
  },
};

describe("parseProvenance", () => {
  it("parses all families", () => {
    expect(Object.keys(parseProvenance(raw).familyShift)).toHaveLength(4);
  });

  it("preserves null index offsets rather than coercing to zero", () => {
    const p = parseProvenance(raw);
    expect(p.indexOffsets["0x3A"][1].offset).toBeNull();
  });

  it("collects ambiguous families separately", () => {
    expect(parseProvenance(raw).ambiguousFamilies).toContain("0x2E");
  });

  it("rejects an unknown provenance code", () => {
    const bad = JSON.parse(JSON.stringify(raw));
    bad.family_shift["0x29"].provenance = "vibes";
    expect(() => parseProvenance(bad)).toThrow(/provenance/i);
  });

  it("rejects a missing family_shift block", () => {
    expect(() => parseProvenance({ _meta: {} })).toThrow(/family_shift/i);
  });
});

describe("confidenceFor", () => {
  const p = parseProvenance(raw);

  it("maps wire and jam to high", () => {
    expect(confidenceFor(p, "0x29")).toBe("high");
    expect(confidenceFor(p, "0x42")).toBe("high");
  });

  it("maps interp to medium", () => {
    expect(confidenceFor(p, "0x2C")).toBe("medium");
  });

  it("returns null for an ambiguous family", () => {
    expect(confidenceFor(p, "0x2E")).toBeNull();
  });

  it("returns null for an unrecorded family", () => {
    expect(confidenceFor(p, "0x99")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/opcodes/OpcodeProvenance.test.ts`
Expected: FAIL — `Cannot find module '../../src/opcodes/OpcodeProvenance'`

- [ ] **Step 3: Write minimal implementation**

```ts
// src/opcodes/OpcodeProvenance.ts
/**
 * Imports the 12.1 family-shift derivation's provenance.
 *
 * The derivation deliberately leaves some things undecided: two families whose
 * shift is not uniquely determined, and index ranges whose offset could not be
 * decided (null). Those are load-bearing statements about what is NOT known and
 * are preserved verbatim — never defaulted.
 *
 * @module opcodes/OpcodeProvenance
 */

export type ProvenanceCode = "wire" | "jam" | "interp" | "ambiguous";
export type Confidence = "high" | "medium";

export interface FamilyShift {
  shift: number;
  provenance: ProvenanceCode;
  clientFamily: string;
}

export interface IndexOffsetRange {
  catalogIndexFrom: string;
  /** null means the offset could not be decided for this range. */
  offset: number | null;
}

export interface OpcodeProvenance {
  familyShift: Record<string, FamilyShift>;
  indexOffsets: Record<string, IndexOffsetRange[]>;
  ambiguousFamilies: string[];
  meta: Record<string, unknown>;
}

const VALID_CODES: ProvenanceCode[] = ["wire", "jam", "interp", "ambiguous"];

const CONFIDENCE_BY_CODE: Record<ProvenanceCode, Confidence | null> = {
  wire: "high",
  jam: "high",
  interp: "medium",
  ambiguous: null,
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function parseProvenance(raw: unknown): OpcodeProvenance {
  if (!isRecord(raw) || !isRecord(raw.family_shift)) {
    throw new Error("Provenance file must contain a family_shift object");
  }

  const familyShift: Record<string, FamilyShift> = {};
  const ambiguousFamilies: string[] = [];

  for (const [family, entry] of Object.entries(raw.family_shift)) {
    if (!isRecord(entry)) {
      throw new Error(`family_shift.${family} must be an object`);
    }
    const code = entry.provenance;
    if (typeof code !== "string" || !VALID_CODES.includes(code as ProvenanceCode)) {
      throw new Error(
        `family_shift.${family} has invalid provenance "${String(code)}"; expected one of ${VALID_CODES.join(", ")}`
      );
    }
    if (typeof entry.shift !== "number") {
      throw new Error(`family_shift.${family} requires a numeric shift`);
    }

    familyShift[family] = {
      shift: entry.shift,
      provenance: code as ProvenanceCode,
      clientFamily: typeof entry.client_family === "string" ? entry.client_family : "",
    };

    if (code === "ambiguous") {
      ambiguousFamilies.push(family);
    }
  }

  const indexOffsets: Record<string, IndexOffsetRange[]> = {};
  if (isRecord(raw.index_offsets)) {
    for (const [family, ranges] of Object.entries(raw.index_offsets)) {
      if (!Array.isArray(ranges)) {
        throw new Error(`index_offsets.${family} must be an array`);
      }
      indexOffsets[family] = ranges.map((r) => {
        if (!isRecord(r)) {
          throw new Error(`index_offsets.${family} contains a non-object range`);
        }
        return {
          catalogIndexFrom: String(r.catalog_index_from),
          offset: r.offset === null ? null : Number(r.offset),
        };
      });
    }
  }

  return {
    familyShift,
    indexOffsets,
    ambiguousFamilies,
    meta: isRecord(raw._meta) ? raw._meta : {},
  };
}

/**
 * Confidence for a family, or null when the family is ambiguous or unrecorded.
 */
export function confidenceFor(prov: OpcodeProvenance, family: string): Confidence | null {
  const entry = prov.familyShift[family];
  if (!entry) {
    return null;
  }
  return CONFIDENCE_BY_CODE[entry.provenance];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest tests/opcodes/OpcodeProvenance.test.ts`
Expected: PASS, 9 tests

- [ ] **Step 5: Type-check and commit**

```bash
npx tsc --noEmit
git add src/opcodes/OpcodeProvenance.ts tests/opcodes/OpcodeProvenance.test.ts
git commit -m "feat: Import opcode family-shift provenance"
```

---

### Task 3: Import script and generated build tables

**Files:**
- Create: `scripts/import-opcodes.js`
- Create: `data/opcodes/12.1.0.69214.json` (generated)
- Create: `data/opcodes/12.1.0.69214-provenance.json` (generated)
- Create: `data/opcodes/12.0.7.67808.json` (generated)
- Test: `tests/opcodes/generated-tables.test.ts`

**Interfaces:**
- Consumes: `parseOpcodesCs` (Task 1), `parseProvenance` (Task 2).
- Produces: the generated JSON files, in the shape `OpcodeTableFile` defined here and consumed by Task 4.

- [ ] **Step 1: Write the failing test**

```ts
// tests/opcodes/generated-tables.test.ts
import * as fs from "fs";
import * as path from "path";

const DIR = path.join(process.cwd(), "data", "opcodes");

describe("generated opcode tables", () => {
  it("contains the 12.1 table", () => {
    expect(fs.existsSync(path.join(DIR, "12.1.0.69214.json"))).toBe(true);
  });

  it("contains the 12.0.7 table for diffing", () => {
    expect(fs.existsSync(path.join(DIR, "12.0.7.67808.json"))).toBe(true);
  });

  it("has 2384 entries in the 12.1 table", () => {
    const t = JSON.parse(fs.readFileSync(path.join(DIR, "12.1.0.69214.json"), "utf8"));
    expect(t.opcodes).toHaveLength(2384);
  });

  it("records source and derivation metadata", () => {
    const t = JSON.parse(fs.readFileSync(path.join(DIR, "12.1.0.69214.json"), "utf8"));
    expect(t.build).toBe(69214);
    expect(t.source.derivedFrom).toBe("V12_0_7_67808");
    expect(t.source.method).toBe("family-shift");
  });

  it("lists the deliberately unmapped families", () => {
    const t = JSON.parse(fs.readFileSync(path.join(DIR, "12.1.0.69214.json"), "utf8"));
    expect(t.unmappedFamilies).toEqual(expect.arrayContaining(["0x2E", "0x35"]));
  });

  it("splits directions and finds no MSG entries", () => {
    const t = JSON.parse(fs.readFileSync(path.join(DIR, "12.1.0.69214.json"), "utf8"));
    const cmsg = t.opcodes.filter((o: { direction: string }) => o.direction === "CMSG").length;
    const smsg = t.opcodes.filter((o: { direction: string }) => o.direction === "SMSG").length;
    expect(cmsg + smsg).toBe(2384);
    expect(cmsg).toBeGreaterThan(0);
    expect(smsg).toBeGreaterThan(0);
  });

  it("ships a provenance file alongside", () => {
    expect(fs.existsSync(path.join(DIR, "12.1.0.69214-provenance.json"))).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/opcodes/generated-tables.test.ts`
Expected: FAIL — the table files do not exist

- [ ] **Step 3: Write minimal implementation**

```js
#!/usr/bin/env node
/**
 * Import a WowPacketParser Opcodes.cs table into build-keyed JSON.
 *
 * Usage:
 *   node scripts/import-opcodes.js \
 *     --source "C:\\dumps\\wpp_tc\\WowPacketParser\\Enums\\Version\\V12_1_0_69214\\Opcodes.cs" \
 *     --provenance "C:\\dumps\\wow_family_shift_12_1.json" \
 *     --build 12.1.0.69214 \
 *     --derived-from V12_0_7_67808 \
 *     --out data/opcodes
 *
 * --provenance and --derived-from are optional (the 12.0.7 catalog is a source,
 * not a derivation, so it takes neither).
 */
const fs = require("fs");
const path = require("path");

const { parseOpcodesCs } = require("../dist/opcodes/OpcodesCsParser");
const { parseProvenance } = require("../dist/opcodes/OpcodeProvenance");

function arg(name, required) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1 || !process.argv[i + 1]) {
    if (required) {
      console.error(`Missing required argument --${name}`);
      process.exit(1);
    }
    return null;
  }
  return process.argv[i + 1];
}

const sourcePath = arg("source", true);
const provenancePath = arg("provenance", false);
const buildId = arg("build", true);
const derivedFrom = arg("derived-from", false);
const outDir = arg("out", false) || path.join("data", "opcodes");

const buildNumber = Number(buildId.split(".").pop());
if (!Number.isInteger(buildNumber)) {
  console.error(`Cannot derive a build number from --build "${buildId}"`);
  process.exit(1);
}

const parsed = parseOpcodesCs(fs.readFileSync(sourcePath, "utf8"));

let unmappedFamilies = [];
if (provenancePath) {
  const prov = parseProvenance(JSON.parse(fs.readFileSync(provenancePath, "utf8")));
  unmappedFamilies = prov.ambiguousFamilies;

  // Families present in the provenance but absent from the generated table were
  // excluded by the generator; record them as unmapped too.
  const present = new Set(parsed.opcodes.map((o) => o.family));
  for (const family of Object.keys(prov.familyShift)) {
    const clientFamily = prov.familyShift[family].clientFamily;
    if (clientFamily && !present.has(clientFamily) && !unmappedFamilies.includes(clientFamily)) {
      unmappedFamilies.push(clientFamily);
    }
  }

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, `${buildId}-provenance.json`),
    JSON.stringify(prov, null, 2),
    "utf8"
  );
}

const table = {
  build: buildNumber,
  version: buildId.split(".").slice(0, 3).join("."),
  source: {
    file: path.basename(path.dirname(sourcePath)) + "/" + path.basename(sourcePath),
    derivedFrom: derivedFrom || null,
    method: derivedFrom ? "family-shift" : "catalog",
    importedAt: new Date().toISOString(),
  },
  unmappedFamilies: unmappedFamilies.sort(),
  counts: parsed.counts,
  opcodes: parsed.opcodes,
};

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, `${buildId}.json`), JSON.stringify(table, null, 2), "utf8");

console.log(
  `Wrote ${outDir}/${buildId}.json — ${parsed.opcodes.length} opcodes ` +
    `(CMSG ${parsed.counts.CMSG}, SMSG ${parsed.counts.SMSG}, MSG ${parsed.counts.MSG}), ` +
    `${unmappedFamilies.length} unmapped families`
);
```

Run the imports:

```bash
npm run build
node scripts/import-opcodes.js \
  --source "C:\dumps\wpp_tc\WowPacketParser\Enums\Version\V12_1_0_69214\Opcodes.cs" \
  --provenance "C:\dumps\wow_family_shift_12_1.json" \
  --build 12.1.0.69214 --derived-from V12_0_7_67808 --out data/opcodes

node scripts/import-opcodes.js \
  --source "C:\dumps\wpp_tc\WowPacketParser\Enums\Version\V12_0_7_67808\Opcodes.cs" \
  --build 12.0.7.67808 --out data/opcodes
```

Expected first run output: `2384 opcodes`. If `unmappedFamilies` does not include both `0x2E` and `0x35`, the generator's exclusion note and the provenance disagree — stop and reconcile before continuing, rather than hand-editing the JSON.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest tests/opcodes/generated-tables.test.ts`
Expected: PASS, 7 tests

- [ ] **Step 5: Commit**

```bash
npx tsc --noEmit
git add scripts/import-opcodes.js data/opcodes/ tests/opcodes/generated-tables.test.ts
git commit -m "feat: Import 12.0.7 and 12.1 opcode tables with provenance"
```

---

### Task 4: OpcodeTable runtime

**Files:**
- Create: `src/opcodes/OpcodeTable.ts`
- Test: `tests/opcodes/OpcodeTable.test.ts`

**Interfaces:**
- Consumes: generated JSON from Task 3; `getActiveBuild` from `src/version/BuildManifest` (build foundation plan, Task 2) for `BuildEntry.opcodeTable`.
- Produces: `OpcodeEntry`, `OpcodeLookupResult`, `loadOpcodeTable(tableId): OpcodeTable`, `getOpcodeTable(): OpcodeTable`, `resetOpcodeTableForTesting()`; class methods `lookupByName`, `lookupByValue`, `listFamily`, `search`, `isUnmappedFamily`, `suggestNames`.

**Table selection.** `BuildEntry.opcodeTable` names which table the active build uses, because the 12.1 table was generated for 69214 and applies to the installed 69497. When absent, fall back to an exact build-id match. Never select by proximity.

- [ ] **Step 1: Write the failing test**

```ts
// tests/opcodes/OpcodeTable.test.ts
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { loadOpcodeTable, resetOpcodeTableForTesting } from "../../src/opcodes/OpcodeTable";

describe("OpcodeTable", () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "ot-"));
    fs.writeFileSync(path.join(dir, "12.1.0.69214.json"), JSON.stringify({
      build: 69214, version: "12.1.0",
      source: { file: "V12_1_0_69214/Opcodes.cs", derivedFrom: "V12_0_7_67808", method: "family-shift", importedAt: "2026-08-27T00:00:00.000Z" },
      unmappedFamilies: ["0x2E", "0x35"],
      counts: { CMSG: 2, SMSG: 1, MSG: 0 },
      opcodes: [
        { name: "CMSG_ACCEPT_GUILD_INVITE", value: 4390953, hex: "0x430029", direction: "CMSG", family: "0x43", index: "0x029" },
        { name: "CMSG_ACCEPT_TRADE", value: 4001796, hex: "0x3D0004", direction: "CMSG", family: "0x3D", index: "0x004" },
        { name: "SMSG_ABORT_NEW_WORLD", value: 4522032, hex: "0x450030", direction: "SMSG", family: "0x45", index: "0x030" },
      ],
    }));
    fs.writeFileSync(path.join(dir, "12.1.0.69214-provenance.json"), JSON.stringify({
      familyShift: {
        "0x43": { shift: 1, provenance: "wire", clientFamily: "0x43" },
        "0x3D": { shift: 2, provenance: "interp", clientFamily: "0x3D" },
        "0x45": { shift: 3, provenance: "jam", clientFamily: "0x45" },
      },
      indexOffsets: {}, ambiguousFamilies: ["0x2E", "0x35"], meta: {},
    }));
    resetOpcodeTableForTesting();
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
    resetOpcodeTableForTesting();
  });

  it("looks up by exact name", () => {
    const t = loadOpcodeTable("12.1.0.69214", dir);
    expect(t.lookupByName("CMSG_ACCEPT_TRADE")!.hex).toBe("0x3D0004");
  });

  it("looks up by name case-insensitively", () => {
    const t = loadOpcodeTable("12.1.0.69214", dir);
    expect(t.lookupByName("cmsg_accept_trade")!.name).toBe("CMSG_ACCEPT_TRADE");
  });

  it("looks up by numeric value", () => {
    const t = loadOpcodeTable("12.1.0.69214", dir);
    expect(t.lookupByValue(0x430029)!.name).toBe("CMSG_ACCEPT_GUILD_INVITE");
  });

  it("attaches confidence from provenance", () => {
    const t = loadOpcodeTable("12.1.0.69214", dir);
    expect(t.lookupByName("CMSG_ACCEPT_GUILD_INVITE")!.confidence).toBe("high");
    expect(t.lookupByName("CMSG_ACCEPT_TRADE")!.confidence).toBe("medium");
  });

  it("lists a family", () => {
    const t = loadOpcodeTable("12.1.0.69214", dir);
    expect(t.listFamily("0x43")).toHaveLength(1);
  });

  it("reports unmapped families", () => {
    const t = loadOpcodeTable("12.1.0.69214", dir);
    expect(t.isUnmappedFamily("0x2E")).toBe(true);
    expect(t.isUnmappedFamily("0x43")).toBe(false);
  });

  it("returns null for an unknown name", () => {
    const t = loadOpcodeTable("12.1.0.69214", dir);
    expect(t.lookupByName("CMSG_NOPE")).toBeNull();
  });

  it("suggests near-miss names", () => {
    const t = loadOpcodeTable("12.1.0.69214", dir);
    expect(t.suggestNames("CMSG_ACCEPT_TRAD")).toContain("CMSG_ACCEPT_TRADE");
  });

  it("searches by substring and filters by direction", () => {
    const t = loadOpcodeTable("12.1.0.69214", dir);
    expect(t.search("ACCEPT")).toHaveLength(2);
    expect(t.search("ACCEPT", { direction: "SMSG" })).toHaveLength(0);
  });

  it("throws a named error when the table file is missing", () => {
    expect(() => loadOpcodeTable("12.9.9.99999", dir)).toThrow(/import-opcodes/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/opcodes/OpcodeTable.test.ts`
Expected: FAIL — `Cannot find module '../../src/opcodes/OpcodeTable'`

- [ ] **Step 3: Write minimal implementation**

```ts
// src/opcodes/OpcodeTable.ts
/**
 * Runtime opcode table: name, value and family/index indices over a build's
 * generated opcode JSON, with provenance-derived confidence.
 *
 * @module opcodes/OpcodeTable
 */

import * as fs from "fs";
import * as path from "path";
import { OpcodeDirection, ParsedOpcode } from "./OpcodesCsParser";
import { Confidence, OpcodeProvenance, confidenceFor } from "./OpcodeProvenance";
import { getActiveBuild } from "../version/BuildManifest";

export interface OpcodeEntry extends ParsedOpcode {
  confidence: Confidence | null;
  build: number;
}

interface OpcodeTableFile {
  build: number;
  version: string;
  source: { file: string; derivedFrom: string | null; method: string; importedAt: string };
  unmappedFamilies: string[];
  counts: Record<OpcodeDirection, number>;
  opcodes: ParsedOpcode[];
}

export const DEFAULT_OPCODE_DIR = path.join("data", "opcodes");

export class OpcodeTable {
  private readonly byName = new Map<string, OpcodeEntry>();
  private readonly byValue = new Map<number, OpcodeEntry>();
  private readonly byFamily = new Map<string, OpcodeEntry[]>();

  constructor(
    private readonly file: OpcodeTableFile,
    private readonly provenance: OpcodeProvenance | null
  ) {
    for (const o of file.opcodes) {
      const entry: OpcodeEntry = {
        ...o,
        confidence: provenance ? confidenceFor(provenance, o.family) : null,
        build: file.build,
      };
      this.byName.set(o.name.toUpperCase(), entry);
      this.byValue.set(o.value, entry);
      const list = this.byFamily.get(o.family);
      if (list) {
        list.push(entry);
      } else {
        this.byFamily.set(o.family, [entry]);
      }
    }
  }

  get build(): number {
    return this.file.build;
  }

  get sourceInfo(): OpcodeTableFile["source"] {
    return this.file.source;
  }

  get size(): number {
    return this.byName.size;
  }

  lookupByName(name: string): OpcodeEntry | null {
    return this.byName.get(name.toUpperCase()) ?? null;
  }

  lookupByValue(value: number): OpcodeEntry | null {
    return this.byValue.get(value) ?? null;
  }

  listFamily(family: string): OpcodeEntry[] {
    return this.byFamily.get(family.toUpperCase()) ?? this.byFamily.get(family) ?? [];
  }

  isUnmappedFamily(family: string): boolean {
    return this.file.unmappedFamilies.includes(family.toUpperCase()) ||
      this.file.unmappedFamilies.includes(family);
  }

  search(pattern: string, opts: { direction?: OpcodeDirection; limit?: number } = {}): OpcodeEntry[] {
    const needle = pattern.toUpperCase();
    const out: OpcodeEntry[] = [];
    for (const entry of this.byName.values()) {
      if (!entry.name.toUpperCase().includes(needle)) {
        continue;
      }
      if (opts.direction && entry.direction !== opts.direction) {
        continue;
      }
      out.push(entry);
      if (opts.limit && out.length >= opts.limit) {
        break;
      }
    }
    return out;
  }

  /** Up to 5 closest names by edit distance, for unknown-name errors. */
  suggestNames(name: string, max = 5): string[] {
    const needle = name.toUpperCase();
    return [...this.byName.keys()]
      .map((candidate) => ({ candidate, d: editDistance(needle, candidate) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, max)
      .filter((x) => x.d <= Math.max(3, Math.floor(needle.length / 3)))
      .map((x) => x.candidate);
  }
}

function editDistance(a: string, b: string): number {
  const prev = new Array<number>(b.length + 1);
  const cur = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) {
    prev[j] = j;
  }
  for (let i = 1; i <= a.length; i++) {
    cur[0] = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
    for (let j = 0; j <= b.length; j++) {
      prev[j] = cur[j];
    }
  }
  return prev[b.length];
}

let cached: OpcodeTable | null = null;

/**
 * Load a specific opcode table by id.
 * @throws Error naming the import command when the table file is absent
 */
export function loadOpcodeTable(tableId: string, dir: string = DEFAULT_OPCODE_DIR): OpcodeTable {
  const tablePath = path.join(dir, `${tableId}.json`);
  if (!fs.existsSync(tablePath)) {
    throw new Error(
      `No opcode table for "${tableId}" at ${tablePath}. ` +
        `Generate it with: node scripts/import-opcodes.js --source <Opcodes.cs> --build ${tableId} --out ${dir}`
    );
  }

  const file = JSON.parse(fs.readFileSync(tablePath, "utf8")) as OpcodeTableFile;

  const provPath = path.join(dir, `${tableId}-provenance.json`);
  const provenance = fs.existsSync(provPath)
    ? (JSON.parse(fs.readFileSync(provPath, "utf8")) as OpcodeProvenance)
    : null;

  cached = new OpcodeTable(file, provenance);
  return cached;
}

/**
 * The table for the active build. Uses BuildEntry.opcodeTable when set, since a
 * table generated for one build can apply to a later one; otherwise requires an
 * exact build-id match. Never selects a table by proximity.
 */
export function getOpcodeTable(): OpcodeTable {
  if (cached) {
    return cached;
  }
  const build = getActiveBuild();
  return loadOpcodeTable(build.opcodeTable || build.id);
}

/** Test-only: drop the cached table. */
export function resetOpcodeTableForTesting(): void {
  cached = null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest tests/opcodes/OpcodeTable.test.ts`
Expected: PASS, 10 tests

- [ ] **Step 5: Type-check and commit**

```bash
npx tsc --noEmit
git add src/opcodes/OpcodeTable.ts tests/opcodes/OpcodeTable.test.ts
git commit -m "feat: Add runtime opcode table with provenance-derived confidence"
```

---

### Task 5: Rewire get-opcode-info with annotation overlay

**Files:**
- Modify: `src/tools/opcode.ts`
- Create: `src/opcodes/annotations.ts`
- Test: `tests/tools/opcode.test.ts`

**Interfaces:**
- Consumes: `getOpcodeTable`, `OpcodeEntry` (Task 4).
- Produces: `OPCODE_ANNOTATIONS: Record<string, OpcodeAnnotation>`; `getOpcodeInfo(opcode: string): Promise<OpcodeInfo>` keeps its signature, with `OpcodeInfo` extended.

Move the 8 hand-written entries out of `opcode.ts` into `annotations.ts` **verbatim** — same descriptions, same `structure` strings, same examples. `opcode.ts` becomes the lookup that merges table data with annotations.

- [ ] **Step 1: Write the failing test**

```ts
// tests/tools/opcode.test.ts
import { getOpcodeInfo } from "../../src/tools/opcode";
import { loadOpcodeTable, resetOpcodeTableForTesting } from "../../src/opcodes/OpcodeTable";
import { OPCODE_ANNOTATIONS } from "../../src/opcodes/annotations";

describe("getOpcodeInfo", () => {
  beforeAll(() => {
    resetOpcodeTableForTesting();
    loadOpcodeTable("12.1.0.69214");
  });
  afterAll(() => resetOpcodeTableForTesting());

  it("resolves a real 12.1 opcode by name", async () => {
    const r = await getOpcodeInfo("CMSG_ACCEPT_GUILD_INVITE");
    expect(r.error).toBeUndefined();
    expect(r.hex).toBe("0x430029");
    expect(r.family).toBe("0x43");
    expect(r.direction).toBe("CMSG");
  });

  it("resolves by hex value", async () => {
    const r = await getOpcodeInfo("0x430029");
    expect(r.opcode).toBe("CMSG_ACCEPT_GUILD_INVITE");
  });

  it("resolves by decimal value", async () => {
    const r = await getOpcodeInfo("4390953");
    expect(r.opcode).toBe("CMSG_ACCEPT_GUILD_INVITE");
  });

  it("retains all legacy annotations", async () => {
    for (const name of Object.keys(OPCODE_ANNOTATIONS)) {
      const r = await getOpcodeInfo(name);
      expect(r.description).toBeTruthy();
      expect(r.description).not.toBe("Opcode documentation not found");
    }
  });

  it("merges annotation structure onto table data", async () => {
    const r = await getOpcodeInfo("CMSG_CAST_SPELL");
    expect(r.structure).toContain("spellId");
  });

  it("returns suggestions for a near-miss name", async () => {
    const r = await getOpcodeInfo("CMSG_ACCEPT_GUILD_INVIT");
    expect(r.error).toBeTruthy();
    expect(r.suggestions).toContain("CMSG_ACCEPT_GUILD_INVITE");
  });

  it("reports an undetermined family rather than an unknown opcode", async () => {
    const r = await getOpcodeInfo("0x2E0001");
    expect(r.error).toMatch(/not uniquely determined|undetermined/i);
    expect(r.error).not.toMatch(/unknown opcode/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/tools/opcode.test.ts`
Expected: FAIL — `Cannot find module '../../src/opcodes/annotations'`

- [ ] **Step 3: Write minimal implementation**

Create `src/opcodes/annotations.ts` holding the 8 entries currently in `src/tools/opcode.ts`, copied verbatim:

```ts
/**
 * Hand-written opcode documentation, merged onto generated table entries.
 *
 * The generated table supplies identity (name, value, direction, family);
 * these supply meaning. Keyed by opcode name so entries survive a table
 * regeneration for a new build.
 *
 * @module opcodes/annotations
 */

export interface OpcodeAnnotation {
  description: string;
  structure?: string;
  example?: string;
}

export const OPCODE_ANNOTATIONS: Record<string, OpcodeAnnotation> = {
  // Copy all 8 entries from the current src/tools/opcode.ts OPCODES constant,
  // dropping the `opcode` and `direction` fields (the table supplies those)
  // and keeping description, structure and example exactly as written.
};
```

Rewrite `src/tools/opcode.ts`:

```ts
/**
 * Network opcode lookup, backed by the build's generated opcode table.
 *
 * @module tools/opcode
 */

import { getOpcodeTable, OpcodeEntry } from "../opcodes/OpcodeTable";
import { OPCODE_ANNOTATIONS } from "../opcodes/annotations";

export interface OpcodeInfo {
  opcode: string;
  direction: "CMSG" | "SMSG" | "MSG";
  description: string;
  value?: number;
  hex?: string;
  family?: string;
  index?: string;
  confidence?: "high" | "medium" | null;
  build?: number;
  structure?: string;
  example?: string;
  suggestions?: string[];
  error?: string;
}

/** Parse "0x430029" or "4390953" into a number; null when not numeric. */
function asValue(input: string): number | null {
  const trimmed = input.trim();
  if (/^0[xX][0-9A-Fa-f]+$/.test(trimmed)) {
    return parseInt(trimmed, 16);
  }
  if (/^\d+$/.test(trimmed)) {
    return Number(trimmed);
  }
  return null;
}

function directionFromName(name: string): "CMSG" | "SMSG" | "MSG" {
  if (name.startsWith("CMSG")) return "CMSG";
  if (name.startsWith("SMSG")) return "SMSG";
  return "MSG";
}

/**
 * Look up an opcode by name, hex value or decimal value.
 * @param opcode Opcode name (e.g. "CMSG_CAST_SPELL") or value (e.g. "0x430029")
 */
export async function getOpcodeInfo(opcode: string): Promise<OpcodeInfo> {
  const table = getOpcodeTable();
  const value = asValue(opcode);

  if (value !== null) {
    const entry = table.lookupByValue(value);
    if (entry) {
      return merge(entry);
    }

    const family = `0x${(value >>> 16).toString(16).toUpperCase().padStart(2, "0")}`;
    if (table.isUnmappedFamily(family)) {
      return {
        opcode: opcode.toUpperCase(),
        direction: "MSG",
        description: "Opcode family not resolved for this build",
        family,
        error:
          `Opcode family ${family} is present on the wire but its 12.1 shift is not uniquely determined, ` +
          `so no name can be assigned. This is a known gap in the derivation, not a missing opcode.`,
      };
    }

    return {
      opcode: opcode.toUpperCase(),
      direction: "MSG",
      description: "No opcode at this value",
      family,
      error: `No opcode with value ${opcode} in the table for build ${table.build}.`,
    };
  }

  const entry = table.lookupByName(opcode);
  if (entry) {
    return merge(entry);
  }

  const suggestions = table.suggestNames(opcode);
  return {
    opcode: opcode.toUpperCase(),
    direction: directionFromName(opcode.toUpperCase()),
    description: "Opcode not found",
    suggestions,
    error:
      `Opcode "${opcode}" is not in the table for build ${table.build}` +
      (suggestions.length ? `. Did you mean: ${suggestions.join(", ")}?` : "."),
  };
}

function merge(entry: OpcodeEntry): OpcodeInfo {
  const annotation = OPCODE_ANNOTATIONS[entry.name];
  return {
    opcode: entry.name,
    direction: entry.direction,
    description: annotation?.description ?? `${entry.direction} opcode ${entry.hex} (family ${entry.family}, index ${entry.index})`,
    value: entry.value,
    hex: entry.hex,
    family: entry.family,
    index: entry.index,
    confidence: entry.confidence,
    build: entry.build,
    structure: annotation?.structure,
    example: annotation?.example,
  };
}
```

Update the registry description at `src/tools/registry/game-data.ts:129` to reflect the new capability; keep `name` and the `opcode` parameter unchanged:

```ts
      description:
        "Get information about a network packet opcode. Accepts an opcode name " +
        "(e.g. 'CMSG_CAST_SPELL') or a wire value (e.g. '0x430029'). Returns direction, " +
        "family, index, derivation confidence and source build.",
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest tests/tools/opcode.test.ts`
Expected: PASS, 7 tests

- [ ] **Step 5: Type-check and commit**

```bash
npx tsc --noEmit
git add src/tools/opcode.ts src/opcodes/annotations.ts src/tools/registry/game-data.ts tests/tools/opcode.test.ts
git commit -m "feat: Back get-opcode-info with the generated 12.1 opcode table"
```

---

### Task 6: list-opcodes and diff-opcodes tools

**Files:**
- Create: `src/tools/opcodetools.ts`
- Modify: `src/tools/registry/game-data.ts`
- Test: `tests/tools/opcodetools.test.ts`

**Interfaces:**
- Consumes: `loadOpcodeTable`, `getOpcodeTable`, `OpcodeEntry` (Task 4).
- Produces: `listOpcodes(args): Promise<ListOpcodesResult>`, `diffOpcodes(args): Promise<OpcodeDiffResult>`, `computeDiff(a, b): OpcodeDiffResult`.

`computeDiff` is a pure function over two entry arrays so it is testable without files on disk.

- [ ] **Step 1: Write the failing test**

```ts
// tests/tools/opcodetools.test.ts
import { computeDiff } from "../../src/tools/opcodetools";

const base = [
  { name: "CMSG_A", value: 0x430001, hex: "0x430001", direction: "CMSG" as const, family: "0x43", index: "0x001", confidence: "high" as const, build: 67808 },
  { name: "CMSG_B", value: 0x430002, hex: "0x430002", direction: "CMSG" as const, family: "0x43", index: "0x002", confidence: "high" as const, build: 67808 },
  { name: "SMSG_GONE", value: 0x440001, hex: "0x440001", direction: "SMSG" as const, family: "0x44", index: "0x001", confidence: "high" as const, build: 67808 },
];

const next = [
  { name: "CMSG_A", value: 0x440001, hex: "0x440001", direction: "CMSG" as const, family: "0x44", index: "0x001", confidence: "high" as const, build: 69214 },
  { name: "CMSG_B", value: 0x430002, hex: "0x430002", direction: "CMSG" as const, family: "0x43", index: "0x002", confidence: "high" as const, build: 69214 },
  { name: "SMSG_NEW", value: 0x450009, hex: "0x450009", direction: "SMSG" as const, family: "0x45", index: "0x009", confidence: "high" as const, build: 69214 },
];

describe("computeDiff", () => {
  it("detects added opcodes", () => {
    expect(computeDiff(base, next).added.map((o) => o.name)).toEqual(["SMSG_NEW"]);
  });

  it("detects removed opcodes", () => {
    expect(computeDiff(base, next).removed.map((o) => o.name)).toEqual(["SMSG_GONE"]);
  });

  it("detects moved opcodes with both values", () => {
    const moved = computeDiff(base, next).moved;
    expect(moved).toHaveLength(1);
    expect(moved[0].name).toBe("CMSG_A");
    expect(moved[0].from).toBe("0x430001");
    expect(moved[0].to).toBe("0x440001");
  });

  it("does not report unchanged opcodes", () => {
    const d = computeDiff(base, next);
    expect([...d.added, ...d.removed, ...d.moved].map((o) => o.name)).not.toContain("CMSG_B");
  });

  it("summarizes counts", () => {
    const d = computeDiff(base, next);
    expect(d.summary).toEqual({ added: 1, removed: 1, moved: 1, unchanged: 1 });
  });

  it("returns an empty diff for identical inputs", () => {
    const d = computeDiff(base, base);
    expect(d.summary).toEqual({ added: 0, removed: 0, moved: 0, unchanged: 3 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/tools/opcodetools.test.ts`
Expected: FAIL — `Cannot find module '../../src/tools/opcodetools'`

- [ ] **Step 3: Write minimal implementation**

```ts
// src/tools/opcodetools.ts
/**
 * Listing and cross-build diffing over generated opcode tables.
 *
 * @module tools/opcodetools
 */

import { getOpcodeTable, loadOpcodeTable, OpcodeEntry } from "../opcodes/OpcodeTable";
import { OpcodeDirection } from "../opcodes/OpcodesCsParser";

export interface ListOpcodesResult {
  build: number;
  total: number;
  offset: number;
  limit: number;
  opcodes: OpcodeEntry[];
}

export interface MovedOpcode {
  name: string;
  from: string;
  to: string;
}

export interface OpcodeDiffResult {
  added: OpcodeEntry[];
  removed: OpcodeEntry[];
  moved: MovedOpcode[];
  summary: { added: number; removed: number; moved: number; unchanged: number };
}

const DEFAULT_LIMIT = 100;

export async function listOpcodes(
  args: { pattern?: string; direction?: OpcodeDirection; family?: string; offset?: number; limit?: number } = {}
): Promise<ListOpcodesResult> {
  const table = getOpcodeTable();
  const offset = args.offset ?? 0;
  const limit = args.limit ?? DEFAULT_LIMIT;

  let matches: OpcodeEntry[] = args.family
    ? table.listFamily(args.family)
    : table.search(args.pattern ?? "", { direction: args.direction });

  if (args.family && args.direction) {
    matches = matches.filter((o) => o.direction === args.direction);
  }
  if (args.family && args.pattern) {
    const needle = args.pattern.toUpperCase();
    matches = matches.filter((o) => o.name.toUpperCase().includes(needle));
  }

  matches.sort((a, b) => a.name.localeCompare(b.name));

  return {
    build: table.build,
    total: matches.length,
    offset,
    limit,
    opcodes: matches.slice(offset, offset + limit),
  };
}

/** Pure diff over two opcode sets, keyed by name. */
export function computeDiff(from: OpcodeEntry[], to: OpcodeEntry[]): OpcodeDiffResult {
  const fromByName = new Map(from.map((o) => [o.name, o]));
  const toByName = new Map(to.map((o) => [o.name, o]));

  const added = to.filter((o) => !fromByName.has(o.name));
  const removed = from.filter((o) => !toByName.has(o.name));

  const moved: MovedOpcode[] = [];
  let unchanged = 0;

  for (const [name, before] of fromByName) {
    const after = toByName.get(name);
    if (!after) {
      continue;
    }
    if (before.value !== after.value) {
      moved.push({ name, from: before.hex, to: after.hex });
    } else {
      unchanged++;
    }
  }

  return {
    added,
    removed,
    moved,
    summary: { added: added.length, removed: removed.length, moved: moved.length, unchanged },
  };
}

export async function diffOpcodes(args: { fromBuild: string; toBuild: string }): Promise<OpcodeDiffResult> {
  const from = loadOpcodeTable(args.fromBuild);
  const fromEntries = from.search("");
  const to = loadOpcodeTable(args.toBuild);
  const toEntries = to.search("");
  return computeDiff(fromEntries, toEntries);
}
```

Register both tools in `src/tools/registry/game-data.ts`, following the existing `{ definition, handler }` entry shape:

```ts
import { listOpcodes, diffOpcodes } from "../opcodetools";

  {
    definition: {
      name: "list-opcodes",
      description: "List network opcodes for the active build, filtered by name pattern, direction or protocol family.",
      inputSchema: {
        type: "object",
        properties: {
          pattern: { type: "string", description: "Substring to match against opcode names" },
          direction: { type: "string", description: "CMSG, SMSG or MSG" },
          family: { type: "string", description: "Protocol family, e.g. '0x43'" },
          offset: { type: "number", description: "Pagination offset (default 0)" },
          limit: { type: "number", description: "Maximum results (default 100)" },
        },
        required: [],
      },
    },
    handler: async (args) => jsonResponse(await listOpcodes(args as Parameters<typeof listOpcodes>[0])),
  },
  {
    definition: {
      name: "diff-opcodes",
      description: "Compare two builds' opcode tables, reporting added, removed and moved opcodes.",
      inputSchema: {
        type: "object",
        properties: {
          fromBuild: { type: "string", description: "Baseline table id, e.g. '12.0.7.67808'" },
          toBuild: { type: "string", description: "Comparison table id, e.g. '12.1.0.69214'" },
        },
        required: ["fromBuild", "toBuild"],
      },
    },
    handler: async (args) =>
      jsonResponse(await diffOpcodes({ fromBuild: args.fromBuild as string, toBuild: args.toBuild as string })),
  },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest tests/tools/opcodetools.test.ts`
Expected: PASS, 6 tests

Then sanity-check the real diff:

```bash
npm run build
node -e "require('./dist/tools/opcodetools').diffOpcodes({fromBuild:'12.0.7.67808',toBuild:'12.1.0.69214'}).then(d=>console.log(d.summary))"
```
Expected: a large `moved` count — that is the 12.1 family shift, and seeing it confirms the tables are genuinely different.

- [ ] **Step 5: Type-check and commit**

```bash
npx tsc --noEmit
git add src/tools/opcodetools.ts src/tools/registry/game-data.ts tests/tools/opcodetools.test.ts
git commit -m "feat: Add list-opcodes and diff-opcodes tools"
```

---

### Task 7: Validate opcodes in generate-packet-handler

**Files:**
- Modify: `src/tools/codegen.ts` (the `generatePacketHandler` implementation)
- Modify: `src/tools/registry/knowledge-codegen.ts:165-190`
- Test: `tests/tools/packet-handler-validation.test.ts`

**Interfaces:**
- Consumes: `getOpcodeTable` (Task 4).
- Produces: `validateOpcodeForHandler(opcode: string): OpcodeValidation`.

Today the tool accepts any opcode string and emits a handler around it, so a misspelled or 12.0-era name silently produces wrong code.

- [ ] **Step 1: Write the failing test**

```ts
// tests/tools/packet-handler-validation.test.ts
import { validateOpcodeForHandler } from "../../src/tools/codegen";
import { loadOpcodeTable, resetOpcodeTableForTesting } from "../../src/opcodes/OpcodeTable";

describe("validateOpcodeForHandler", () => {
  beforeAll(() => {
    resetOpcodeTableForTesting();
    loadOpcodeTable("12.1.0.69214");
  });
  afterAll(() => resetOpcodeTableForTesting());

  it("accepts a known opcode and returns its wire value", () => {
    const v = validateOpcodeForHandler("CMSG_ACCEPT_GUILD_INVITE");
    expect(v.valid).toBe(true);
    expect(v.entry!.hex).toBe("0x430029");
    expect(v.entry!.direction).toBe("CMSG");
  });

  it("rejects an unknown opcode", () => {
    expect(validateOpcodeForHandler("CMSG_TOTALLY_MADE_UP").valid).toBe(false);
  });

  it("offers suggestions for a near miss", () => {
    const v = validateOpcodeForHandler("CMSG_ACCEPT_GUILD_INVIT");
    expect(v.valid).toBe(false);
    expect(v.suggestions).toContain("CMSG_ACCEPT_GUILD_INVITE");
  });

  it("names the build in the rejection message", () => {
    const v = validateOpcodeForHandler("CMSG_TOTALLY_MADE_UP");
    expect(v.message).toMatch(/69214/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/tools/packet-handler-validation.test.ts`
Expected: FAIL — `validateOpcodeForHandler is not a function`

- [ ] **Step 3: Write minimal implementation**

Add to `src/tools/codegen.ts`:

```ts
import { getOpcodeTable, OpcodeEntry } from "../opcodes/OpcodeTable";

export interface OpcodeValidation {
  valid: boolean;
  entry?: OpcodeEntry;
  suggestions?: string[];
  message: string;
}

/**
 * Confirm an opcode exists in the active build's table before generating a
 * handler for it. Generating a handler for a misspelled or stale opcode name
 * produces code that compiles and is wrong.
 */
export function validateOpcodeForHandler(opcode: string): OpcodeValidation {
  const table = getOpcodeTable();
  const entry = table.lookupByName(opcode);

  if (entry) {
    return { valid: true, entry, message: `${entry.name} = ${entry.hex} (${entry.direction}, build ${entry.build})` };
  }

  const suggestions = table.suggestNames(opcode);
  return {
    valid: false,
    suggestions,
    message:
      `Opcode "${opcode}" is not in the table for build ${table.build}; refusing to generate a handler for it.` +
      (suggestions.length ? ` Did you mean: ${suggestions.join(", ")}?` : ""),
  };
}
```

In the `generatePacketHandler` implementation, call it before emitting anything:

```ts
  const validation = validateOpcodeForHandler(args.opcode);
  if (!validation.valid) {
    throw new Error(validation.message);
  }
```

Use `validation.entry!.hex` and `validation.entry!.direction` in the generated handler rather than trusting the caller's `direction` argument, and note the source build in the generated file's header comment.

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest tests/tools/packet-handler-validation.test.ts
npx jest tests/tools
```
Expected: new test PASS (4 tests); no new failures elsewhere.

- [ ] **Step 5: Type-check and commit**

```bash
npx tsc --noEmit
git add src/tools/codegen.ts src/tools/registry/knowledge-codegen.ts tests/tools/packet-handler-validation.test.ts
git commit -m "feat: Validate opcodes before generating packet handlers"
```

---

## Self-Review

**Spec coverage.** §3.1 ingest-not-re-derive → Tasks 1-3 (no shift arithmetic anywhere in this plan). §3.2 converter and output shape → Tasks 1, 3; table selection via `BuildEntry.opcodeTable` → Task 4. §3.3 provenance and confidence, unmapped families → Tasks 2, 4, 5. §3.4 runtime model and its five methods → Task 4. §3.5 tool surface: `get-opcode-info` → Task 5, `list-opcodes`/`diff-opcodes` → Task 6, annotation overlay → Task 5. §3.6 second consumer → Task 7. §5 error handling: all five rows have tests across Tasks 4, 5, 7. §6 testing → each task's steps 1-4. §7 rollout → the task order is the rollout order. §9 acceptance criteria 1-6 → Tasks 3, 3, 5, 5, 7, and every task's step 5 respectively.

**Type consistency.** `OpcodeDirection` is defined once in `OpcodesCsParser.ts` and imported by `OpcodeTable.ts` and `opcodetools.ts`. `ParsedOpcode` is extended by `OpcodeEntry` (adding `confidence` and `build`), so the generated JSON's shape and the runtime shape cannot drift. `Confidence` is defined once in `OpcodeProvenance.ts`. `family` is a `string` like `"0x43"` everywhere, never a number — `listFamily`, `isUnmappedFamily` and the JSON all agree. `suggestNames` is the single source of near-miss suggestions, used by Tasks 5 and 7.

**Cross-plan dependency.** Task 4 imports `getActiveBuild` from the build foundation plan's Task 2, and reads `BuildEntry.opcodeTable`, added in that plan's Task 1. **Run the build foundation plan's Tasks 1-2 before this plan's Task 4.** Tasks 1-3 here have no cross-plan dependency and can run first or in parallel.

**Known gap, deliberately left.** The 10 opcodes (88 packets) that the source derivation could not name are absent from the table and produce the standard "no opcode at this value" response. Resolving them means extending the derivation in the RE workspace, which is out of scope here.
