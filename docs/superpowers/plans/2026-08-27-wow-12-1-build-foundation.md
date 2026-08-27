# WoW 12.1 Build Foundation & Data Plane Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the MCP server a single declared source of truth for WoW client builds, so 12.1 data can be served with verified schemas and a stale schema fails loudly instead of returning wrong numbers.

**Architecture:** A JSON build manifest (`config/builds.json`) declares N client builds, each owning its own data paths and cache directory. A loader resolves the active build; data paths, DB2 schema validation and caches all route through it. A layout-hash gate compares each DB2 file's `layoutHash` against what the schema was written for, turning silent field-index corruption into a named error.

**Tech Stack:** TypeScript 5.3 (strict, CommonJS, `moduleResolution: node`), Node 18+, Jest + ts-jest. Imports are extensionless (196 of 198 call sites) — follow that convention.

**Spec:** `docs/superpowers/specs/2026-08-27-wow-12-1-build-foundation-design.md`

## Global Constraints

- **Installed client build:** `12.1.0.69497` (verified from `M:\World of Warcraft\.build.info`, active row).
- **Current extracted data:** `M:\Wplayerbot\data\dbc\enUS`, 1129 `.db2` files, all WDC5, extracted 2025-12-22 from a 12.0.x client. Its exact build id is **determined in Task 3, never assumed**.
- **No silent fallback to another build's data**, under any failure class. This is the point of the whole plan.
- **Backward compatibility is mandatory:** 179 registered tools read `process.env.DB2_PATH` and friends directly. Nothing may break when `config/builds.json` is absent.
- **TypeScript strict mode.** No `any` without a written justification comment.
- Test root is `tests/`, matching `**/*.test.ts` (see `jest.config.js`). Mirror the `src/` path under `tests/`.
- Run `npx tsc --noEmit` before every commit. It currently passes clean; keep it that way.
- `npm test` has ~11 known pre-existing failures. Do not count them as regressions; do not add to them.

---

### Task 1: Build manifest types and JSON loader

**Files:**
- Create: `src/version/BuildManifest.ts`
- Test: `tests/version/BuildManifest.test.ts`

**Interfaces:**
- Consumes: `src/utils/logger` (existing `logger` export).
- Produces: `BuildDataPaths`, `BuildEntry`, `BuildManifest`, `ManifestValidationError`, `parseBuildManifest(raw: unknown): BuildManifest`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/version/BuildManifest.test.ts
import { parseBuildManifest, ManifestValidationError } from "../../src/version/BuildManifest";

const validRaw = {
  manifestVersion: 1,
  activeBuild: "12.1.0.69497",
  builds: {
    "12.1.0.69497": {
      build: 69497, product: "wow", expansion: "Midnight",
      status: "active", db2Format: "WDC5",
      dataPaths: { db2: "d", dbc: "c", gt: "g", vmap: "v", mmap: "m", listfile: "l" },
      cacheDir: "data/cache/69497",
    },
  },
};

describe("parseBuildManifest", () => {
  it("parses a valid manifest and injects the id onto each entry", () => {
    const m = parseBuildManifest(validRaw);
    expect(m.activeBuild).toBe("12.1.0.69497");
    expect(m.builds["12.1.0.69497"].id).toBe("12.1.0.69497");
    expect(m.builds["12.1.0.69497"].build).toBe(69497);
  });

  it("rejects a manifest with no active build", () => {
    const raw = JSON.parse(JSON.stringify(validRaw));
    raw.builds["12.1.0.69497"].status = "archived";
    expect(() => parseBuildManifest(raw)).toThrow(ManifestValidationError);
  });

  it("rejects a manifest with two active builds", () => {
    const raw = JSON.parse(JSON.stringify(validRaw));
    raw.builds["12.0.5.66838"] = { ...raw.builds["12.1.0.69497"], build: 66838 };
    expect(() => parseBuildManifest(raw)).toThrow(/exactly one/i);
  });

  it("rejects duplicate build numbers", () => {
    const raw = JSON.parse(JSON.stringify(validRaw));
    raw.builds["12.0.5.66838"] = { ...raw.builds["12.1.0.69497"], status: "archived" };
    expect(() => parseBuildManifest(raw)).toThrow(/duplicate build number/i);
  });

  it("rejects activeBuild that names a missing build", () => {
    const raw = JSON.parse(JSON.stringify(validRaw));
    raw.activeBuild = "12.9.9.99999";
    expect(() => parseBuildManifest(raw)).toThrow(/activeBuild/i);
  });

  it("rejects an entry missing a data path key", () => {
    const raw = JSON.parse(JSON.stringify(validRaw));
    delete raw.builds["12.1.0.69497"].dataPaths.vmap;
    expect(() => parseBuildManifest(raw)).toThrow(/vmap/i);
  });

  it("rejects an unsupported manifestVersion", () => {
    expect(() => parseBuildManifest({ ...validRaw, manifestVersion: 2 })).toThrow(/manifestVersion/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/version/BuildManifest.test.ts`
Expected: FAIL — `Cannot find module '../../src/version/BuildManifest'`

- [ ] **Step 3: Write minimal implementation**

```ts
// src/version/BuildManifest.ts
/**
 * Build manifest: the single declared source of truth for which WoW client
 * builds this server knows about, and where each build's data lives.
 *
 * @module version/BuildManifest
 */

export interface BuildDataPaths {
  db2: string;
  dbc: string;
  gt: string;
  vmap: string;
  mmap: string;
  listfile: string;
}

export type BuildStatus = "active" | "archived" | "candidate";
export type DB2Format = "WDC3" | "WDC4" | "WDC5" | "WDC6";

export interface BuildEntry {
  /** Full version string, e.g. "12.1.0.69497". Injected from the map key. */
  id: string;
  build: number;
  product: string;
  expansion: string;
  status: BuildStatus;
  db2Format: DB2Format;
  dataPaths: BuildDataPaths;
  cacheDir: string;
  /** Opcode table id; may name a different build (see opcode subsystem spec). */
  opcodeTable?: string;
  /** True when synthesized from environment variables rather than read from disk. */
  synthesized?: boolean;
}

export interface BuildManifest {
  manifestVersion: number;
  activeBuild: string;
  builds: Record<string, BuildEntry>;
}

export class ManifestValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ManifestValidationError";
  }
}

const SUPPORTED_MANIFEST_VERSION = 1;
const REQUIRED_PATH_KEYS: Array<keyof BuildDataPaths> = ["db2", "dbc", "gt", "vmap", "mmap", "listfile"];
const VALID_STATUSES: BuildStatus[] = ["active", "archived", "candidate"];
const VALID_FORMATS: DB2Format[] = ["WDC3", "WDC4", "WDC5", "WDC6"];

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Validate and normalize a raw parsed manifest object.
 * @throws {ManifestValidationError} on any structural or semantic violation
 */
export function parseBuildManifest(raw: unknown): BuildManifest {
  if (!isRecord(raw)) {
    throw new ManifestValidationError("Build manifest must be a JSON object");
  }

  if (raw.manifestVersion !== SUPPORTED_MANIFEST_VERSION) {
    throw new ManifestValidationError(
      `Unsupported manifestVersion ${String(raw.manifestVersion)}; expected ${SUPPORTED_MANIFEST_VERSION}`
    );
  }

  if (typeof raw.activeBuild !== "string" || raw.activeBuild.length === 0) {
    throw new ManifestValidationError("Build manifest requires a non-empty activeBuild string");
  }

  if (!isRecord(raw.builds) || Object.keys(raw.builds).length === 0) {
    throw new ManifestValidationError("Build manifest requires a non-empty builds object");
  }

  const builds: Record<string, BuildEntry> = {};
  const seenBuildNumbers = new Map<number, string>();

  for (const [id, rawEntry] of Object.entries(raw.builds)) {
    if (!isRecord(rawEntry)) {
      throw new ManifestValidationError(`Build "${id}" must be an object`);
    }

    if (typeof rawEntry.build !== "number" || !Number.isInteger(rawEntry.build)) {
      throw new ManifestValidationError(`Build "${id}" requires an integer build number`);
    }

    const duplicate = seenBuildNumbers.get(rawEntry.build);
    if (duplicate !== undefined) {
      throw new ManifestValidationError(
        `Duplicate build number ${rawEntry.build} used by both "${duplicate}" and "${id}"`
      );
    }
    seenBuildNumbers.set(rawEntry.build, id);

    if (!VALID_STATUSES.includes(rawEntry.status as BuildStatus)) {
      throw new ManifestValidationError(
        `Build "${id}" has invalid status "${String(rawEntry.status)}"; expected one of ${VALID_STATUSES.join(", ")}`
      );
    }

    if (!VALID_FORMATS.includes(rawEntry.db2Format as DB2Format)) {
      throw new ManifestValidationError(
        `Build "${id}" has invalid db2Format "${String(rawEntry.db2Format)}"`
      );
    }

    if (!isRecord(rawEntry.dataPaths)) {
      throw new ManifestValidationError(`Build "${id}" requires a dataPaths object`);
    }
    for (const key of REQUIRED_PATH_KEYS) {
      if (typeof rawEntry.dataPaths[key] !== "string") {
        throw new ManifestValidationError(`Build "${id}" is missing dataPaths.${key}`);
      }
    }

    if (typeof rawEntry.cacheDir !== "string") {
      throw new ManifestValidationError(`Build "${id}" requires a cacheDir string`);
    }

    builds[id] = {
      id,
      build: rawEntry.build,
      product: typeof rawEntry.product === "string" ? rawEntry.product : "wow",
      expansion: typeof rawEntry.expansion === "string" ? rawEntry.expansion : "unknown",
      status: rawEntry.status as BuildStatus,
      db2Format: rawEntry.db2Format as DB2Format,
      dataPaths: rawEntry.dataPaths as unknown as BuildDataPaths,
      cacheDir: rawEntry.cacheDir,
      opcodeTable: typeof rawEntry.opcodeTable === "string" ? rawEntry.opcodeTable : undefined,
    };
  }

  const activeIds = Object.values(builds).filter((b) => b.status === "active").map((b) => b.id);
  if (activeIds.length !== 1) {
    throw new ManifestValidationError(
      `Build manifest must contain exactly one build with status "active"; found ${activeIds.length}` +
        (activeIds.length > 1 ? ` (${activeIds.join(", ")})` : "")
    );
  }

  if (!builds[raw.activeBuild]) {
    throw new ManifestValidationError(
      `activeBuild "${raw.activeBuild}" does not name any build in the manifest`
    );
  }

  if (builds[raw.activeBuild].status !== "active") {
    throw new ManifestValidationError(
      `activeBuild "${raw.activeBuild}" has status "${builds[raw.activeBuild].status}", expected "active"`
    );
  }

  return { manifestVersion: SUPPORTED_MANIFEST_VERSION, activeBuild: raw.activeBuild, builds };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest tests/version/BuildManifest.test.ts`
Expected: PASS, 7 tests

- [ ] **Step 5: Type-check and commit**

```bash
npx tsc --noEmit
git add src/version/BuildManifest.ts tests/version/BuildManifest.test.ts
git commit -m "feat: Add build manifest types and validating parser"
```

---

### Task 2: Manifest loading with synthesized environment fallback

**Files:**
- Modify: `src/version/BuildManifest.ts`
- Test: `tests/version/BuildManifest.load.test.ts`

**Interfaces:**
- Consumes: `parseBuildManifest` from Task 1.
- Produces: `synthesizeFromEnv(env: NodeJS.ProcessEnv): BuildManifest`, `loadBuildManifest(manifestPath?: string): Promise<BuildManifest>`, `getActiveBuild(): BuildEntry`, `getBuild(id: string): BuildEntry | null`, `listBuilds(): BuildEntry[]`, `resetManifestForTesting(): void`.

The synthesized manifest is what keeps all 179 existing tools working on day one. Its build id is the literal string `unknown` and `synthesized` is `true`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/version/BuildManifest.load.test.ts
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import {
  loadBuildManifest, synthesizeFromEnv, getActiveBuild, getBuild,
  listBuilds, resetManifestForTesting,
} from "../../src/version/BuildManifest";

const ENV = {
  DB2_PATH: "M:\\data\\dbc\\enUS", DBC_PATH: "M:\\data\\dbc\\enUS",
  GT_PATH: "M:\\data\\gt", VMAP_PATH: "M:\\data\\vmaps", MMAP_PATH: "M:\\data\\mmaps",
} as NodeJS.ProcessEnv;

describe("synthesizeFromEnv", () => {
  it("builds a single active 'unknown' build from environment paths", () => {
    const m = synthesizeFromEnv(ENV);
    expect(m.activeBuild).toBe("unknown");
    const entry = m.builds["unknown"];
    expect(entry.synthesized).toBe(true);
    expect(entry.status).toBe("active");
    expect(entry.dataPaths.db2).toBe("M:\\data\\dbc\\enUS");
    expect(entry.dataPaths.gt).toBe("M:\\data\\gt");
  });

  it("falls back to repo-relative defaults when env vars are absent", () => {
    const m = synthesizeFromEnv({} as NodeJS.ProcessEnv);
    expect(m.builds["unknown"].dataPaths.db2).toBe("./data/db2");
    expect(m.builds["unknown"].dataPaths.dbc).toBe("./data/dbc");
  });

  it("passes its own validation", () => {
    expect(() => synthesizeFromEnv(ENV)).not.toThrow();
  });
});

describe("loadBuildManifest", () => {
  let dir: string;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "bm-"));
    resetManifestForTesting();
  });
  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
    resetManifestForTesting();
  });

  it("synthesizes from env when the manifest file is absent", async () => {
    const m = await loadBuildManifest(path.join(dir, "nope.json"));
    expect(m.builds[m.activeBuild].synthesized).toBe(true);
  });

  it("loads a manifest file when present", async () => {
    const p = path.join(dir, "builds.json");
    fs.writeFileSync(p, JSON.stringify({
      manifestVersion: 1,
      activeBuild: "12.1.0.69497",
      builds: {
        "12.1.0.69497": {
          build: 69497, product: "wow", expansion: "Midnight",
          status: "active", db2Format: "WDC5",
          dataPaths: { db2: "d", dbc: "c", gt: "g", vmap: "v", mmap: "m", listfile: "l" },
          cacheDir: "data/cache/69497",
        },
      },
    }));
    const m = await loadBuildManifest(p);
    expect(m.activeBuild).toBe("12.1.0.69497");
    expect(m.builds["12.1.0.69497"].synthesized).toBeUndefined();
  });

  it("exposes accessors after load", async () => {
    await loadBuildManifest(path.join(dir, "nope.json"));
    expect(getActiveBuild().id).toBe("unknown");
    expect(getBuild("unknown")).not.toBeNull();
    expect(getBuild("12.9.9.99999")).toBeNull();
    expect(listBuilds()).toHaveLength(1);
  });

  it("throws a clear error when accessors are used before load", () => {
    resetManifestForTesting();
    expect(() => getActiveBuild()).toThrow(/loadBuildManifest/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/version/BuildManifest.load.test.ts`
Expected: FAIL — `synthesizeFromEnv is not a function`

- [ ] **Step 3: Write minimal implementation**

Append to `src/version/BuildManifest.ts`:

```ts
import * as fs from "fs";
import * as path from "path";
import { logger } from "../utils/logger";

/** Module-level manifest, populated by loadBuildManifest(). */
let manifest: BuildManifest | null = null;

/** Default manifest location, relative to the process working directory. */
export const DEFAULT_MANIFEST_PATH = path.join("config", "builds.json");

/**
 * Build a single-build manifest from environment variables.
 *
 * This is the compatibility path: 179 registered tools read DB2_PATH and
 * friends directly, so an absent config/builds.json must not change behavior.
 */
export function synthesizeFromEnv(env: NodeJS.ProcessEnv): BuildManifest {
  const entry: BuildEntry = {
    id: "unknown",
    build: 0,
    product: "wow",
    expansion: "unknown",
    status: "active",
    db2Format: "WDC5",
    dataPaths: {
      db2: env.DB2_PATH || "./data/db2",
      dbc: env.DBC_PATH || "./data/dbc",
      gt: env.GT_PATH || "./data/gt",
      vmap: env.VMAP_PATH || "./data/vmaps",
      mmap: env.MMAP_PATH || "./data/mmaps",
      listfile: env.LISTFILE_PATH || "./data/listfile/listfile.csv",
    },
    cacheDir: "./data/cache",
    synthesized: true,
  };
  return { manifestVersion: SUPPORTED_MANIFEST_VERSION, activeBuild: "unknown", builds: { unknown: entry } };
}

/**
 * Load the build manifest from disk, or synthesize one from the environment
 * when the file is absent. Declared data paths that do not exist produce a
 * warning, never a failure — an archived build whose data was deleted is legitimate.
 */
export async function loadBuildManifest(manifestPath?: string): Promise<BuildManifest> {
  const target = manifestPath || DEFAULT_MANIFEST_PATH;

  if (!fs.existsSync(target)) {
    logger.warn(`Build manifest not found at ${target}; synthesizing from environment variables`);
    manifest = synthesizeFromEnv(process.env);
    return manifest;
  }

  let raw: unknown;
  try {
    raw = JSON.parse(await fs.promises.readFile(target, "utf8"));
  } catch (error) {
    throw new ManifestValidationError(`Failed to read build manifest at ${target}: ${String(error)}`);
  }

  manifest = parseBuildManifest(raw);

  for (const entry of Object.values(manifest.builds)) {
    for (const key of REQUIRED_PATH_KEYS) {
      const p = entry.dataPaths[key];
      if (!fs.existsSync(p)) {
        logger.warn(`Build "${entry.id}" declares ${key} path that does not exist: ${p}`);
      }
    }
  }

  logger.info(`Loaded build manifest: ${Object.keys(manifest.builds).length} build(s), active=${manifest.activeBuild}`);
  return manifest;
}

function requireManifest(): BuildManifest {
  if (!manifest) {
    throw new Error("Build manifest not loaded. Call loadBuildManifest() during startup before using build accessors.");
  }
  return manifest;
}

export function getActiveBuild(): BuildEntry {
  const m = requireManifest();
  return m.builds[m.activeBuild];
}

export function getBuild(id: string): BuildEntry | null {
  return requireManifest().builds[id] || null;
}

export function listBuilds(): BuildEntry[] {
  return Object.values(requireManifest().builds);
}

/** Test-only: clear module state between cases. */
export function resetManifestForTesting(): void {
  manifest = null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest tests/version/BuildManifest.load.test.ts`
Expected: PASS, 8 tests

- [ ] **Step 5: Type-check and commit**

```bash
npx tsc --noEmit
git add src/version/BuildManifest.ts tests/version/BuildManifest.load.test.ts
git commit -m "feat: Load build manifest with synthesized environment fallback"
```

---

### Task 3: Client build detection and drift warning

**Files:**
- Create: `src/version/ClientBuildInfo.ts`
- Test: `tests/version/ClientBuildInfo.test.ts`

**Interfaces:**
- Produces: `parseBuildInfo(content: string): ClientBuildRow[]`, `resolveClientBuild(wowPath: string): Promise<string>`, `checkBuildDrift(manifestActiveId: string, clientVersion: string): DriftResult`.

`.build.info` is pipe-delimited with a typed header row (`Name!TYPE:LEN|...`). The installed file has columns including `Active`, `Version`, `Product`, `Branch`. The active row is the one whose `Active` column is `1`.

**This task also produces the archived build's identity.** After implementing, run the detection against the client that produced the 2025-12-22 extraction if it is still available; otherwise read `layoutHash` and record the build empirically in Task 6. Do not guess `12.0.5.66838`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/version/ClientBuildInfo.test.ts
import { parseBuildInfo, checkBuildDrift } from "../../src/version/ClientBuildInfo";

const HEADER =
  "Branch!STRING:0|Active!DEC:1|Build Key!HEX:16|Version!STRING:0|Product!STRING:0";

describe("parseBuildInfo", () => {
  it("parses rows into named columns", () => {
    const rows = parseBuildInfo(`${HEADER}\neu|1|abc123|12.1.0.69497|wow`);
    expect(rows).toHaveLength(1);
    expect(rows[0].Version).toBe("12.1.0.69497");
    expect(rows[0].Product).toBe("wow");
    expect(rows[0].Active).toBe("1");
  });

  it("strips the !TYPE:LEN suffix from header names", () => {
    const rows = parseBuildInfo(`${HEADER}\neu|1|abc|12.1.0.69497|wow`);
    expect(Object.keys(rows[0])).toContain("Build Key");
  });

  it("returns an empty array for a header-only file", () => {
    expect(parseBuildInfo(HEADER)).toEqual([]);
  });

  it("ignores blank trailing lines", () => {
    const rows = parseBuildInfo(`${HEADER}\neu|1|abc|12.1.0.69497|wow\n\n`);
    expect(rows).toHaveLength(1);
  });

  it("throws on a file with no header", () => {
    expect(() => parseBuildInfo("")).toThrow(/header/i);
  });
});

describe("checkBuildDrift", () => {
  it("reports no drift when ids match", () => {
    expect(checkBuildDrift("12.1.0.69497", "12.1.0.69497").drifted).toBe(false);
  });

  it("reports drift and names both builds", () => {
    const r = checkBuildDrift("12.1.0.69497", "12.1.0.69600");
    expect(r.drifted).toBe(true);
    expect(r.message).toContain("12.1.0.69497");
    expect(r.message).toContain("12.1.0.69600");
  });

  it("never reports drift for a synthesized 'unknown' manifest", () => {
    expect(checkBuildDrift("unknown", "12.1.0.69497").drifted).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/version/ClientBuildInfo.test.ts`
Expected: FAIL — `Cannot find module '../../src/version/ClientBuildInfo'`

- [ ] **Step 3: Write minimal implementation**

```ts
// src/version/ClientBuildInfo.ts
/**
 * Reads the WoW client's .build.info to determine the installed build,
 * and compares it against the manifest's active build.
 *
 * @module version/ClientBuildInfo
 */

import * as fs from "fs";
import * as path from "path";

export type ClientBuildRow = Record<string, string>;

export interface DriftResult {
  drifted: boolean;
  message: string;
}

/**
 * Parse a .build.info file. The first line is a pipe-delimited header where
 * each column is "Name!TYPE:LEN"; subsequent lines are pipe-delimited values.
 */
export function parseBuildInfo(content: string): ClientBuildRow[] {
  const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) {
    throw new Error(".build.info is empty: expected a header row");
  }

  const headers = lines[0].split("|").map((h) => h.split("!")[0]);
  return lines.slice(1).map((line) => {
    const values = line.split("|");
    const row: ClientBuildRow = {};
    headers.forEach((h, i) => {
      row[h] = values[i] ?? "";
    });
    return row;
  });
}

/**
 * Resolve the installed client's version string, e.g. "12.1.0.69497".
 * @param wowPath Root of the WoW installation (the directory holding .build.info)
 * @throws Error when the file is missing or contains no active row
 */
export async function resolveClientBuild(wowPath: string): Promise<string> {
  const target = path.join(wowPath, ".build.info");
  if (!fs.existsSync(target)) {
    throw new Error(`Cannot determine client build: no .build.info at ${target}`);
  }

  const rows = parseBuildInfo(await fs.promises.readFile(target, "utf8"));
  const active = rows.find((r) => r.Active === "1");
  if (!active) {
    throw new Error(`No active row in ${target}; cannot determine installed build`);
  }
  if (!active.Version) {
    throw new Error(`Active row in ${target} has no Version column`);
  }
  return active.Version;
}

/**
 * Compare the manifest's active build against the installed client.
 * A synthesized manifest (id "unknown") never reports drift — it makes no claim.
 */
export function checkBuildDrift(manifestActiveId: string, clientVersion: string): DriftResult {
  if (manifestActiveId === "unknown") {
    return { drifted: false, message: "Manifest is synthesized; no build claim to compare" };
  }
  if (manifestActiveId === clientVersion) {
    return { drifted: false, message: `Manifest active build matches installed client (${clientVersion})` };
  }
  return {
    drifted: true,
    message:
      `Build drift: manifest active build is ${manifestActiveId} but the installed client is ${clientVersion}. ` +
      `Extract ${clientVersion} and add it to config/builds.json, or switch activeBuild.`,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest tests/version/ClientBuildInfo.test.ts`
Expected: PASS, 8 tests

- [ ] **Step 5: Verify against the real client, then commit**

```bash
node -e "require('./dist/version/ClientBuildInfo').resolveClientBuild(process.env.WOW_PATH).then(console.log)"
```
Expected output: `12.1.0.69497`. If it differs, record the actual value — the manifest in Task 11 must use it.

```bash
npx tsc --noEmit
git add src/version/ClientBuildInfo.ts tests/version/ClientBuildInfo.test.ts
git commit -m "feat: Detect installed client build and manifest drift"
```

---

### Task 4: Build-aware data path resolution

**Files:**
- Modify: `src/version/BuildManifest.ts` (add `resolveDataPath`)
- Modify: `src/tools/dbc.ts:11-12`
- Modify: `src/tools/gametable.ts:9`
- Test: `tests/version/resolveDataPath.test.ts`

**Interfaces:**
- Consumes: `getActiveBuild`, `getBuild` from Task 2.
- Produces: `resolveDataPath(kind: keyof BuildDataPaths, buildId?: string): string`.

`dbc.ts` currently holds `const DBC_PATH = process.env.DBC_PATH || "./data/dbc"` at module scope. Module-scope constants capture the value at import time, before `loadBuildManifest()` runs — so these must become function calls, not constants.

- [ ] **Step 1: Write the failing test**

```ts
// tests/version/resolveDataPath.test.ts
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { loadBuildManifest, resolveDataPath, resetManifestForTesting } from "../../src/version/BuildManifest";

describe("resolveDataPath", () => {
  let dir: string;
  let manifestPath: string;

  beforeEach(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "rdp-"));
    manifestPath = path.join(dir, "builds.json");
    fs.writeFileSync(manifestPath, JSON.stringify({
      manifestVersion: 1,
      activeBuild: "12.1.0.69497",
      builds: {
        "12.1.0.69497": {
          build: 69497, product: "wow", expansion: "Midnight", status: "active", db2Format: "WDC5",
          dataPaths: { db2: "N/db2", dbc: "N/dbc", gt: "N/gt", vmap: "N/vmap", mmap: "N/mmap", listfile: "N/lf.csv" },
          cacheDir: "data/cache/69497",
        },
        "12.0.x.00000": {
          build: 1, product: "wow", expansion: "Midnight", status: "archived", db2Format: "WDC5",
          dataPaths: { db2: "O/db2", dbc: "O/dbc", gt: "O/gt", vmap: "O/vmap", mmap: "O/mmap", listfile: "O/lf.csv" },
          cacheDir: "data/cache/old",
        },
      },
    }));
    resetManifestForTesting();
    await loadBuildManifest(manifestPath);
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
    resetManifestForTesting();
  });

  it("resolves against the active build by default", () => {
    expect(resolveDataPath("db2")).toBe("N/db2");
    expect(resolveDataPath("gt")).toBe("N/gt");
  });

  it("resolves against an explicitly named build", () => {
    expect(resolveDataPath("db2", "12.0.x.00000")).toBe("O/db2");
  });

  it("throws a named error for an unknown build id", () => {
    expect(() => resolveDataPath("db2", "12.9.9.99999")).toThrow(/12\.9\.9\.99999/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/version/resolveDataPath.test.ts`
Expected: FAIL — `resolveDataPath is not a function`

- [ ] **Step 3: Write minimal implementation**

Append to `src/version/BuildManifest.ts`:

```ts
/**
 * Resolve a data directory for a build.
 * @param kind Which data path to resolve
 * @param buildId Build to resolve against; defaults to the active build
 * @throws Error when buildId names a build not in the manifest
 */
export function resolveDataPath(kind: keyof BuildDataPaths, buildId?: string): string {
  const entry = buildId ? getBuild(buildId) : getActiveBuild();
  if (!entry) {
    throw new Error(`Cannot resolve ${kind} path: no build "${buildId}" in the manifest`);
  }
  return entry.dataPaths[kind];
}
```

Then replace the module-scope constants. In `src/tools/dbc.ts`, delete lines 11-12 and add:

```ts
import { resolveDataPath } from "../version/BuildManifest";

/**
 * Resolve the directory holding a DBC or DB2 file for the active build.
 * Must be a function, not a module constant: the manifest loads after import.
 */
function basePathFor(fileName: string): string {
  return fileName.toLowerCase().endsWith(".dbc") ? resolveDataPath("dbc") : resolveDataPath("db2");
}
```

Replace both existing uses (lines ~39-40 and ~134-135):

```ts
const filePath = path.join(basePathFor(dbcFile), dbcFile);
```

In `src/tools/gametable.ts`, delete line 9 and add:

```ts
import { resolveDataPath } from "../version/BuildManifest";

function gtPath(): string {
  return resolveDataPath("gt");
}
```

Replace every `GT_PATH` reference with `gtPath()`.

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest tests/version/resolveDataPath.test.ts
npx jest tests/tools
```
Expected: new test PASS (3 tests); existing tool tests show no new failures.

- [ ] **Step 5: Type-check and commit**

```bash
npx tsc --noEmit
git add src/version/BuildManifest.ts src/tools/dbc.ts src/tools/gametable.ts tests/version/resolveDataPath.test.ts
git commit -m "feat: Route DBC and gametable paths through the build manifest"
```

---

### Task 5: DB2 layout-hash gate

**Files:**
- Create: `src/version/SchemaBuildGate.ts`
- Test: `tests/version/SchemaBuildGate.test.ts`

**Interfaces:**
- Produces: `BuildAwareSchema`, `GateVerdict`, `SchemaLayoutMismatchError`, `checkSchemaLayout(schema, actualLayoutHash, build): GateVerdict`, `resetGateWarningsForTesting()`.

This is the load-bearing component: it turns a stale hard-coded field index from a wrong answer into a named error. Behavior follows §3.3 of the spec exactly.

- [ ] **Step 1: Write the failing test**

```ts
// tests/version/SchemaBuildGate.test.ts
import {
  checkSchemaLayout, SchemaLayoutMismatchError, resetGateWarningsForTesting,
  BuildAwareSchema,
} from "../../src/version/SchemaBuildGate";

const schema: BuildAwareSchema = {
  name: "SpellSchema",
  VALID_BUILDS: { from: 65390, to: null },
  LAYOUT_HASHES: new Map<number, number>([[66838, 0xaabbccdd], [69497, 0x11223344]]),
};

describe("checkSchemaLayout", () => {
  beforeEach(() => resetGateWarningsForTesting());

  it("verifies a matching layout hash", () => {
    expect(checkSchemaLayout(schema, 0x11223344, 69497)).toEqual({ status: "verified" });
  });

  it("throws on a known build with a different hash", () => {
    expect(() => checkSchemaLayout(schema, 0xdeadbeef, 69497)).toThrow(SchemaLayoutMismatchError);
  });

  it("names schema, both hashes and the build in the mismatch message", () => {
    try {
      checkSchemaLayout(schema, 0xdeadbeef, 69497);
      fail("expected a throw");
    } catch (e) {
      const msg = (e as Error).message;
      expect(msg).toContain("SpellSchema");
      expect(msg).toContain("0x11223344");
      expect(msg).toContain("0xdeadbeef");
      expect(msg).toContain("69497");
    }
  });

  it("returns unverified for a build with no recorded hash", () => {
    const v = checkSchemaLayout(schema, 0x99999999, 70000);
    expect(v.status).toBe("unverified");
  });

  it("throws when the build is below the schema's validity floor", () => {
    expect(() => checkSchemaLayout(schema, 0x1, 60000)).toThrow(/valid from build 65390/i);
  });

  it("respects a closed upper validity bound", () => {
    const closed: BuildAwareSchema = { ...schema, VALID_BUILDS: { from: 65390, to: 66838 } };
    expect(() => checkSchemaLayout(closed, 0x1, 69497)).toThrow(/through build 66838/i);
  });

  it("warns only once per schema for unknown builds", () => {
    const spy = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    checkSchemaLayout(schema, 0x1, 70000);
    checkSchemaLayout(schema, 0x1, 70000);
    spy.mockRestore();
    // Second call must not re-warn; assertion is on the module's own guard.
    expect(checkSchemaLayout(schema, 0x1, 70000).status).toBe("unverified");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/version/SchemaBuildGate.test.ts`
Expected: FAIL — `Cannot find module '../../src/version/SchemaBuildGate'`

- [ ] **Step 3: Write minimal implementation**

```ts
// src/version/SchemaBuildGate.ts
/**
 * Validates that a hand-written DB2 schema matches the file it is about to parse.
 *
 * Schemas in src/parsers/schemas read fields by hard-coded index. When a DB2
 * layout changes between client builds they do not fail — they return wrong
 * values. This gate compares the file's layoutHash against what the schema was
 * written for, so a stale schema produces a named error instead.
 *
 * @module version/SchemaBuildGate
 */

import { logger } from "../utils/logger";

export interface BuildAwareSchema {
  name: string;
  VALID_BUILDS: { from: number; to: number | null };
  LAYOUT_HASHES: Map<number, number>;
}

export type GateVerdict =
  | { status: "verified" }
  | { status: "unverified"; reason: string };

export class SchemaLayoutMismatchError extends Error {
  constructor(
    public readonly schemaName: string,
    public readonly build: number,
    public readonly expected: number,
    public readonly actual: number
  ) {
    super(
      `Schema ${schemaName} does not match the DB2 file for build ${build}: ` +
        `expected layoutHash ${hex(expected)}, file has ${hex(actual)}. ` +
        `The schema's hard-coded field indices are stale for this build; parsing would return wrong values. ` +
        `Update ${schemaName} for build ${build} and record its layout hash.`
    );
    this.name = "SchemaLayoutMismatchError";
  }
}

function hex(n: number): string {
  return `0x${(n >>> 0).toString(16).padStart(8, "0")}`;
}

/** Schemas already warned about, so an unknown build warns once per process. */
const warned = new Set<string>();

/**
 * Check a schema against the layout hash of the file being opened.
 *
 * @throws {SchemaLayoutMismatchError} when the build is known and the hash differs
 * @throws {Error} when the build falls outside the schema's declared validity range
 */
export function checkSchemaLayout(
  schema: BuildAwareSchema,
  actualLayoutHash: number,
  build: number
): GateVerdict {
  const { from, to } = schema.VALID_BUILDS;

  if (build < from) {
    throw new Error(
      `Schema ${schema.name} is valid from build ${from}; refusing to parse build ${build}`
    );
  }
  if (to !== null && build > to) {
    throw new Error(
      `Schema ${schema.name} is valid through build ${to}; refusing to parse build ${build}`
    );
  }

  const expected = schema.LAYOUT_HASHES.get(build);

  if (expected === undefined) {
    if (!warned.has(schema.name)) {
      warned.add(schema.name);
      logger.warn(
        `Schema ${schema.name} has no recorded layout hash for build ${build}; ` +
          `results are unverified. Record the hash with the validate-build-schemas tool.`
      );
    }
    return { status: "unverified", reason: `No recorded layout hash for build ${build}` };
  }

  if ((expected >>> 0) !== (actualLayoutHash >>> 0)) {
    throw new SchemaLayoutMismatchError(schema.name, build, expected, actualLayoutHash);
  }

  return { status: "verified" };
}

/** Test-only: clear the once-per-schema warning guard. */
export function resetGateWarningsForTesting(): void {
  warned.clear();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest tests/version/SchemaBuildGate.test.ts`
Expected: PASS, 7 tests

- [ ] **Step 5: Type-check and commit**

```bash
npx tsc --noEmit
git add src/version/SchemaBuildGate.ts tests/version/SchemaBuildGate.test.ts
git commit -m "feat: Add DB2 schema layout-hash gate"
```

---

### Task 6: Declare build validity on all nine schemas

**Files:**
- Modify: `src/parsers/schemas/SpellSchema.ts`, `SpellEffectSchema.ts`, `ItemSchema.ts`, `ChrClassesSchema.ts`, `ChrRacesSchema.ts`, `TalentSchema.ts`
- Modify: `src/parsers/schemas/SchemaFactory.ts`
- Create: `scripts/record-layout-hashes.js`
- Test: `tests/parsers/schemas/build-declarations.test.ts`

**Interfaces:**
- Consumes: `BuildAwareSchema` from Task 5.
- Produces: every registered schema class exposes `VALID_BUILDS` and `LAYOUT_HASHES`; `SchemaFactory.getBuildAwareSchemas(): BuildAwareSchema[]`.

`ItemSchema.ts` contains both the Item and ItemSparse parsers, and `ChrClassesSchema.ts` contains ChrClasses and ChrClassesXPowerTypes; `ChrRacesSchema.ts` contains ChrRaces and CharBaseInfo. Declare the pair members separately — they are separate DB2 files with separate layouts.

`LAYOUT_HASHES` starts **empty**. Real values are recorded by the script in Step 3 against actual files; never hand-typed.

- [ ] **Step 1: Write the failing test**

```ts
// tests/parsers/schemas/build-declarations.test.ts
import { SchemaFactory } from "../../../src/parsers/schemas/SchemaFactory";

describe("schema build declarations", () => {
  const schemas = SchemaFactory.getBuildAwareSchemas();

  it("exposes every registered schema", () => {
    expect(schemas.length).toBeGreaterThanOrEqual(9);
  });

  it("gives every schema a name and a validity floor", () => {
    for (const s of schemas) {
      expect(typeof s.name).toBe("string");
      expect(s.name.length).toBeGreaterThan(0);
      expect(Number.isInteger(s.VALID_BUILDS.from)).toBe(true);
      expect(s.VALID_BUILDS.from).toBeGreaterThan(0);
    }
  });

  it("gives every schema a LAYOUT_HASHES map", () => {
    for (const s of schemas) {
      expect(s.LAYOUT_HASHES).toBeInstanceOf(Map);
    }
  });

  it("uses unique schema names", () => {
    const names = schemas.map((s) => s.name);
    expect(new Set(names).size).toBe(names.length);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/parsers/schemas/build-declarations.test.ts`
Expected: FAIL — `SchemaFactory.getBuildAwareSchemas is not a function`

- [ ] **Step 3: Write minimal implementation**

Add to each schema class (shown for `SpellSchema`; repeat verbatim in each, changing only `name`):

```ts
  /** Build range this schema's field indices are known to be correct for. */
  public static readonly VALID_BUILDS: { from: number; to: number | null } = { from: 65390, to: null };

  /** build number -> layoutHash observed in that build's DB2 file. Populated by scripts/record-layout-hashes.js. */
  public static readonly LAYOUT_HASHES: Map<number, number> = new Map<number, number>();

  /** Name used in gate errors and the validate-build-schemas report. */
  public static readonly SCHEMA_NAME = "SpellSchema";
```

Add to `SchemaFactory`:

```ts
import { BuildAwareSchema } from "../../version/SchemaBuildGate";

  /**
   * Every registered schema, in the shape the layout gate consumes.
   */
  public static getBuildAwareSchemas(): BuildAwareSchema[] {
    return SchemaFactory.getRegisteredSchemaClasses().map((c) => ({
      name: c.SCHEMA_NAME,
      VALID_BUILDS: c.VALID_BUILDS,
      LAYOUT_HASHES: c.LAYOUT_HASHES,
    }));
  }
```

`getRegisteredSchemaClasses()` returns the nine schema classes; add it alongside the existing registration code so the list has one home.

Create `scripts/record-layout-hashes.js` — opens each schema's DB2 file for a given build, reads the header's `layoutHash` at offset 156, and prints the `LAYOUT_HASHES` entries to paste in:

```js
#!/usr/bin/env node
/**
 * Record DB2 layoutHash values for a build, so schemas can declare what they
 * were written against. Reads offset 156 of each DB2 header (see DB2Header.ts).
 *
 * Usage: node scripts/record-layout-hashes.js --build 69497 --dir "M:\\path\\to\\dbc\\enUS"
 */
const fs = require("fs");
const path = require("path");

const FILES = [
  ["SpellSchema", "SpellName.db2"],
  ["SpellEffectSchema", "SpellEffect.db2"],
  ["ItemSchema", "Item.db2"],
  ["ItemSparseSchema", "ItemSparse.db2"],
  ["ChrClassesSchema", "ChrClasses.db2"],
  ["ChrClassesXPowerTypesSchema", "ChrClassesXPowerTypes.db2"],
  ["ChrRacesSchema", "ChrRaces.db2"],
  ["CharBaseInfoSchema", "CharBaseInfo.db2"],
  ["TalentSchema", "Talent.db2"],
];

const args = process.argv.slice(2);
const build = Number(args[args.indexOf("--build") + 1]);
const dir = args[args.indexOf("--dir") + 1];

if (!build || !dir) {
  console.error("Usage: node scripts/record-layout-hashes.js --build <n> --dir <db2 dir>");
  process.exit(1);
}

for (const [schema, file] of FILES) {
  const p = path.join(dir, file);
  if (!fs.existsSync(p)) {
    console.log(`// ${schema}: ${file} NOT FOUND at ${p}`);
    continue;
  }
  const fd = fs.openSync(p, "r");
  const buf = Buffer.alloc(160);
  fs.readSync(fd, buf, 0, 160, 0);
  fs.closeSync(fd);
  const signature = buf.toString("ascii", 0, 4);
  const layoutHash = buf.readUInt32LE(156);
  console.log(`// ${schema} (${file}, ${signature})`);
  console.log(`[${build}, 0x${layoutHash.toString(16).padStart(8, "0")}],`);
}
```

- [ ] **Step 4: Run the recorder and the test**

```bash
node scripts/record-layout-hashes.js --build 0 --dir "M:\Wplayerbot\data\dbc\enUS"
```
Paste each printed pair into the matching schema's `LAYOUT_HASHES`, using the archived build number determined in Task 3 rather than `0`. Then:

```bash
npx jest tests/parsers/schemas/build-declarations.test.ts
```
Expected: PASS, 4 tests

- [ ] **Step 5: Type-check and commit**

```bash
npx tsc --noEmit
git add src/parsers/schemas/ scripts/record-layout-hashes.js tests/parsers/schemas/build-declarations.test.ts
git commit -m "feat: Declare build validity and layout hashes on DB2 schemas"
```

---

### Task 7: validate-build-schemas MCP tool

**Files:**
- Create: `src/tools/buildvalidation.ts`
- Modify: `src/tools/registry/game-data.ts`
- Test: `tests/tools/buildvalidation.test.ts`

**Interfaces:**
- Consumes: `SchemaFactory.getBuildAwareSchemas()` (Task 6), `checkSchemaLayout` (Task 5), `resolveDataPath`/`getActiveBuild` (Tasks 2, 4), `resolveClientBuild`/`checkBuildDrift` (Task 3).
- Produces: `validateBuildSchemas(args: { buildId?: string }): Promise<BuildValidationReport>`, registered as MCP tool `validate-build-schemas`.

This is the tool you run after extraction and before flipping `activeBuild`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/tools/buildvalidation.test.ts
import { summarizeValidation, SchemaValidationRow } from "../../src/tools/buildvalidation";

describe("summarizeValidation", () => {
  const rows: SchemaValidationRow[] = [
    { schema: "SpellSchema", file: "SpellName.db2", status: "verified" },
    { schema: "ItemSchema", file: "Item.db2", status: "mismatch", detail: "expected 0x1, got 0x2" },
    { schema: "TalentSchema", file: "Talent.db2", status: "unverified", detail: "no hash for build" },
    { schema: "ChrRacesSchema", file: "ChrRaces.db2", status: "missing", detail: "file not found" },
  ];

  it("counts each status", () => {
    const s = summarizeValidation(rows);
    expect(s.verified).toBe(1);
    expect(s.mismatch).toBe(1);
    expect(s.unverified).toBe(1);
    expect(s.missing).toBe(1);
  });

  it("is not ok when any schema mismatches", () => {
    expect(summarizeValidation(rows).ok).toBe(false);
  });

  it("is ok when everything verifies", () => {
    const clean = rows.filter((r) => r.status === "verified");
    expect(summarizeValidation(clean).ok).toBe(true);
  });

  it("is not ok when a file is missing", () => {
    const s = summarizeValidation([rows[0], rows[3]]);
    expect(s.ok).toBe(false);
  });

  it("treats unverified as non-blocking but reports it", () => {
    const s = summarizeValidation([rows[0], rows[2]]);
    expect(s.ok).toBe(true);
    expect(s.unverified).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/tools/buildvalidation.test.ts`
Expected: FAIL — `Cannot find module '../../src/tools/buildvalidation'`

- [ ] **Step 3: Write minimal implementation**

```ts
// src/tools/buildvalidation.ts
/**
 * Validates that every registered DB2 schema matches the extracted data for a
 * build. Run this after extraction and before switching activeBuild.
 *
 * @module tools/buildvalidation
 */

import * as fs from "fs";
import * as path from "path";
import { SchemaFactory } from "../parsers/schemas/SchemaFactory";
import { checkSchemaLayout, SchemaLayoutMismatchError } from "../version/SchemaBuildGate";
import { getActiveBuild, getBuild, resolveDataPath } from "../version/BuildManifest";
import { resolveClientBuild, checkBuildDrift } from "../version/ClientBuildInfo";
import { logger } from "../utils/logger";

export type ValidationStatus = "verified" | "unverified" | "mismatch" | "missing";

export interface SchemaValidationRow {
  schema: string;
  file: string;
  status: ValidationStatus;
  detail?: string;
}

export interface ValidationSummary {
  ok: boolean;
  verified: number;
  unverified: number;
  mismatch: number;
  missing: number;
}

export interface BuildValidationReport {
  build: string;
  buildNumber: number;
  drift?: string;
  rows: SchemaValidationRow[];
  summary: ValidationSummary;
}

/** Schema name -> the DB2 file it parses. */
const SCHEMA_FILES: Record<string, string> = {
  SpellSchema: "SpellName.db2",
  SpellEffectSchema: "SpellEffect.db2",
  ItemSchema: "Item.db2",
  ItemSparseSchema: "ItemSparse.db2",
  ChrClassesSchema: "ChrClasses.db2",
  ChrClassesXPowerTypesSchema: "ChrClassesXPowerTypes.db2",
  ChrRacesSchema: "ChrRaces.db2",
  CharBaseInfoSchema: "CharBaseInfo.db2",
  TalentSchema: "Talent.db2",
};

/** Offset of layoutHash within a WDC3-WDC6 header (see parsers/db2/DB2Header.ts). */
const LAYOUT_HASH_OFFSET = 156;
const HEADER_PREFIX_BYTES = 160;

function readLayoutHash(filePath: string): number {
  const fd = fs.openSync(filePath, "r");
  try {
    const buf = Buffer.alloc(HEADER_PREFIX_BYTES);
    fs.readSync(fd, buf, 0, HEADER_PREFIX_BYTES, 0);
    return buf.readUInt32LE(LAYOUT_HASH_OFFSET);
  } finally {
    fs.closeSync(fd);
  }
}

/** Aggregate per-schema rows. `unverified` is reported but does not block. */
export function summarizeValidation(rows: SchemaValidationRow[]): ValidationSummary {
  const count = (s: ValidationStatus) => rows.filter((r) => r.status === s).length;
  const mismatch = count("mismatch");
  const missing = count("missing");
  return {
    ok: mismatch === 0 && missing === 0,
    verified: count("verified"),
    unverified: count("unverified"),
    mismatch,
    missing,
  };
}

export async function validateBuildSchemas(
  args: { buildId?: string } = {}
): Promise<BuildValidationReport> {
  const entry = args.buildId ? getBuild(args.buildId) : getActiveBuild();
  if (!entry) {
    throw new Error(`No build "${args.buildId}" in the manifest`);
  }

  const db2Dir = resolveDataPath("db2", entry.id);
  const rows: SchemaValidationRow[] = [];

  for (const schema of SchemaFactory.getBuildAwareSchemas()) {
    const file = SCHEMA_FILES[schema.name];
    if (!file) {
      rows.push({ schema: schema.name, file: "(unmapped)", status: "missing", detail: "No DB2 file mapped for this schema" });
      continue;
    }

    const filePath = path.join(db2Dir, file);
    if (!fs.existsSync(filePath)) {
      rows.push({ schema: schema.name, file, status: "missing", detail: `Not found: ${filePath}` });
      continue;
    }

    try {
      const verdict = checkSchemaLayout(schema, readLayoutHash(filePath), entry.build);
      rows.push(
        verdict.status === "verified"
          ? { schema: schema.name, file, status: "verified" }
          : { schema: schema.name, file, status: "unverified", detail: verdict.reason }
      );
    } catch (error) {
      rows.push({
        schema: schema.name,
        file,
        status: "mismatch",
        detail: error instanceof SchemaLayoutMismatchError ? error.message : String(error),
      });
    }
  }

  let drift: string | undefined;
  const wowPath = process.env.WOW_PATH;
  if (wowPath) {
    try {
      const result = checkBuildDrift(entry.id, await resolveClientBuild(wowPath));
      if (result.drifted) {
        drift = result.message;
      }
    } catch (error) {
      logger.warn(`Could not check build drift: ${String(error)}`);
    }
  }

  return { build: entry.id, buildNumber: entry.build, drift, rows, summary: summarizeValidation(rows) };
}
```

Register in `src/tools/registry/game-data.ts`, following the existing entry shape at line 128:

```ts
import { validateBuildSchemas } from "../buildvalidation";

    {
      name: "validate-build-schemas",
      description:
        "Validate that every registered DB2 schema matches the extracted client data for a build. " +
        "Reports verified, unverified, mismatched and missing schemas, plus any drift between the " +
        "manifest's active build and the installed client.",
      inputSchema: {
        type: "object",
        properties: {
          buildId: { type: "string", description: "Build id to validate; defaults to the active build" },
        },
        required: [],
      },
      handler: async (args: Record<string, unknown>) => {
        const result = await validateBuildSchemas({ buildId: args.buildId as string | undefined });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      },
    },
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest tests/tools/buildvalidation.test.ts
```
Expected: PASS, 5 tests

- [ ] **Step 5: Type-check and commit**

```bash
npx tsc --noEmit
git add src/tools/buildvalidation.ts src/tools/registry/game-data.ts tests/tools/buildvalidation.test.ts
git commit -m "feat: Add validate-build-schemas tool"
```

---

### Task 8: Build-keyed caches with sidecar metadata

**Files:**
- Create: `src/utils/cache-metadata.ts`
- Modify: `src/utils/json-cache-loader.ts`
- Test: `tests/utils/cache-metadata.test.ts`

**Interfaces:**
- Consumes: `getActiveBuild` (Task 2).
- Produces: `CacheMetadata`, `readCacheMetadata(cacheFilePath): CacheMetadata | null`, `writeCacheMetadata(cacheFilePath, meta): void`, `CacheBuildMismatchError`; `JsonCacheLoader` gains an options parameter `{ expectedBuild?: number; regenerateCommand?: string }`.

Metadata lives in a **sidecar** `<cacheFile>.meta.json`, not inside the 29 MB cache itself — the existing `{ "133": "Fireball" }` shape stays untouched, so nothing has to re-serialize a large file to gain a header.

The `JsonCacheLoader` constructor gains an **optional third parameter**, so the two existing call sites (`spell.ts:97-98`, `dungeonstrategygenerator.ts:242`) keep compiling unchanged.

- [ ] **Step 1: Write the failing test**

```ts
// tests/utils/cache-metadata.test.ts
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { readCacheMetadata, writeCacheMetadata, CacheMetadata } from "../../src/utils/cache-metadata";
import { JsonCacheLoader } from "../../src/utils/json-cache-loader";

describe("cache metadata sidecar", () => {
  let dir: string;
  let cacheFile: string;

  const meta: CacheMetadata = {
    build: 69497, generatedAt: "2026-08-27T00:00:00.000Z",
    sourceFile: "SpellName.db2", sourceLayoutHash: "0x11223344", recordCount: 2,
  };

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "cm-"));
    cacheFile = path.join(dir, "spell_names_cache.json");
    fs.writeFileSync(cacheFile, JSON.stringify({ "133": "Fireball", "116": "Frostbolt" }));
  });

  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it("round-trips metadata through the sidecar file", () => {
    writeCacheMetadata(cacheFile, meta);
    expect(fs.existsSync(`${cacheFile}.meta.json`)).toBe(true);
    expect(readCacheMetadata(cacheFile)).toEqual(meta);
  });

  it("returns null when no sidecar exists", () => {
    expect(readCacheMetadata(cacheFile)).toBeNull();
  });

  it("loads a cache whose build matches the expected build", () => {
    writeCacheMetadata(cacheFile, meta);
    const loader = new JsonCacheLoader<string>(cacheFile, "spell name", { expectedBuild: 69497 });
    expect(loader.load()).toBe(true);
    expect(loader.get(133)).toBe("Fireball");
  });

  it("refuses a cache built for a different build", () => {
    writeCacheMetadata(cacheFile, { ...meta, build: 66838 });
    const loader = new JsonCacheLoader<string>(cacheFile, "spell name", {
      expectedBuild: 69497,
      regenerateCommand: "npm run generate:spell-cache",
    });
    expect(loader.load()).toBe(false);
    expect(loader.get(133)).toBeNull();
  });

  it("refuses a cache with no metadata when a build is expected", () => {
    const loader = new JsonCacheLoader<string>(cacheFile, "spell name", { expectedBuild: 69497 });
    expect(loader.load()).toBe(false);
  });

  it("loads without metadata when no build is expected", () => {
    const loader = new JsonCacheLoader<string>(cacheFile, "spell name");
    expect(loader.load()).toBe(true);
    expect(loader.get(116)).toBe("Frostbolt");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/utils/cache-metadata.test.ts`
Expected: FAIL — `Cannot find module '../../src/utils/cache-metadata'`

- [ ] **Step 3: Write minimal implementation**

```ts
// src/utils/cache-metadata.ts
/**
 * Sidecar metadata for generated JSON caches.
 *
 * Caches are build-specific. Serving 12.0 spell names to a 12.1 query is a
 * silent wrong answer, so every cache records which build produced it and the
 * loader refuses a mismatch.
 *
 * @module utils/cache-metadata
 */

import * as fs from "fs";

export interface CacheMetadata {
  build: number;
  generatedAt: string;
  sourceFile: string;
  sourceLayoutHash: string;
  recordCount: number;
}

export class CacheBuildMismatchError extends Error {
  constructor(cachePath: string, cacheBuild: number, expectedBuild: number, regenerateCommand?: string) {
    super(
      `Cache ${cachePath} was generated for build ${cacheBuild} but the active build is ${expectedBuild}. ` +
        `Refusing to serve stale data.` +
        (regenerateCommand ? ` Regenerate it with: ${regenerateCommand}` : "")
    );
    this.name = "CacheBuildMismatchError";
  }
}

function sidecarPath(cacheFilePath: string): string {
  return `${cacheFilePath}.meta.json`;
}

export function readCacheMetadata(cacheFilePath: string): CacheMetadata | null {
  const p = sidecarPath(cacheFilePath);
  if (!fs.existsSync(p)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(p, "utf8")) as CacheMetadata;
  } catch {
    return null;
  }
}

export function writeCacheMetadata(cacheFilePath: string, meta: CacheMetadata): void {
  fs.writeFileSync(sidecarPath(cacheFilePath), JSON.stringify(meta, null, 2), "utf8");
}
```

Modify `src/utils/json-cache-loader.ts`. Add the import, an options interface, an optional constructor parameter, and the build check at the top of `load()`:

```ts
import { readCacheMetadata } from "./cache-metadata";

export interface JsonCacheLoaderOptions {
  /** When set, refuse any cache whose sidecar build differs from this. */
  expectedBuild?: number;
  /** Shown in the refusal message so the caller knows how to fix it. */
  regenerateCommand?: string;
}
```

Change the constructor signature to:

```ts
  constructor(
    private readonly filePath: string,
    private readonly label: string,
    private readonly options: JsonCacheLoaderOptions = {}
  ) {}
```

Insert immediately after `this.loaded = true;` inside the existing `try` block in `load()`, before the `fs.existsSync` check result is used:

```ts
      if (!fs.existsSync(this.filePath)) {
        logger.warn(`${this.label} cache not found at ${this.filePath}.`);
        return false;
      }

      if (this.options.expectedBuild !== undefined) {
        const meta = readCacheMetadata(this.filePath);
        if (!meta) {
          logger.error(
            `${this.label} cache at ${this.filePath} has no build metadata; refusing to load it for build ` +
              `${this.options.expectedBuild}.` +
              (this.options.regenerateCommand ? ` Regenerate with: ${this.options.regenerateCommand}` : "")
          );
          return false;
        }
        if (meta.build !== this.options.expectedBuild) {
          logger.error(
            `${this.label} cache at ${this.filePath} was generated for build ${meta.build} but the active build ` +
              `is ${this.options.expectedBuild}; refusing to serve stale data.` +
              (this.options.regenerateCommand ? ` Regenerate with: ${this.options.regenerateCommand}` : "")
          );
          return false;
        }
      }
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest tests/utils/cache-metadata.test.ts
npx jest tests/utils
```
Expected: new test PASS (6 tests); existing utils tests unchanged.

- [ ] **Step 5: Type-check and commit**

```bash
npx tsc --noEmit
git add src/utils/cache-metadata.ts src/utils/json-cache-loader.ts tests/utils/cache-metadata.test.ts
git commit -m "feat: Refuse JSON caches generated for a different build"
```

---

### Task 9: Build-aware spell cache generation and consumption

**Files:**
- Modify: `src/scripts/generate-spell-cache.ts:28-33`
- Modify: `src/tools/spell.ts:97-98`
- Modify: `src/tools/dungeonstrategygenerator.ts:242`
- Test: `tests/tools/spell-cache-build.test.ts`

**Interfaces:**
- Consumes: `getActiveBuild` (Task 2), `writeCacheMetadata`/`CacheMetadata` (Task 8), `JsonCacheLoaderOptions` (Task 8).
- Produces: `cachePathFor(fileName: string): string` exported from `src/utils/cache-metadata.ts`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/tools/spell-cache-build.test.ts
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { loadBuildManifest, resetManifestForTesting } from "../../src/version/BuildManifest";
import { cachePathFor } from "../../src/utils/cache-metadata";

describe("cachePathFor", () => {
  let dir: string;

  beforeEach(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "scb-"));
    const p = path.join(dir, "builds.json");
    fs.writeFileSync(p, JSON.stringify({
      manifestVersion: 1,
      activeBuild: "12.1.0.69497",
      builds: {
        "12.1.0.69497": {
          build: 69497, product: "wow", expansion: "Midnight", status: "active", db2Format: "WDC5",
          dataPaths: { db2: "d", dbc: "c", gt: "g", vmap: "v", mmap: "m", listfile: "l" },
          cacheDir: "data/cache/69497",
        },
      },
    }));
    resetManifestForTesting();
    await loadBuildManifest(p);
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
    resetManifestForTesting();
  });

  it("resolves a cache file inside the active build's cache directory", () => {
    expect(cachePathFor("spell_names_cache.json")).toBe(path.join("data/cache/69497", "spell_names_cache.json"));
  });

  it("resolves different files into the same build directory", () => {
    expect(path.dirname(cachePathFor("spell_data_cache.json")))
      .toBe(path.dirname(cachePathFor("spell_names_cache.json")));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/tools/spell-cache-build.test.ts`
Expected: FAIL — `cachePathFor is not a function`

- [ ] **Step 3: Write minimal implementation**

Add to `src/utils/cache-metadata.ts`:

```ts
import * as path from "path";
import { getActiveBuild } from "../version/BuildManifest";

/**
 * Resolve a cache file inside the active build's cache directory.
 * @param fileName Bare cache file name, e.g. "spell_names_cache.json"
 */
export function cachePathFor(fileName: string): string {
  return path.join(getActiveBuild().cacheDir, fileName);
}
```

In `src/scripts/generate-spell-cache.ts`, replace the `CACHE_DIR` / path constants (lines 28-33) with manifest-resolved paths, and stamp metadata after writing. Replace the `DB2_PATH` constant with `resolveDataPath("db2")`, and after each write call:

```ts
import { loadBuildManifest, getActiveBuild, resolveDataPath } from "../version/BuildManifest";
import { cachePathFor, writeCacheMetadata } from "../utils/cache-metadata";

// At the top of main(), before any path use:
await loadBuildManifest();
const activeBuild = getActiveBuild();
const DB2_PATH = resolveDataPath("db2");
const SPELL_NAMES_CACHE_PATH = cachePathFor("spell_names_cache.json");
const SPELL_DATA_CACHE_PATH = cachePathFor("spell_data_cache.json");
fs.mkdirSync(path.dirname(SPELL_NAMES_CACHE_PATH), { recursive: true });

// After writing each cache file:
writeCacheMetadata(SPELL_NAMES_CACHE_PATH, {
  build: activeBuild.build,
  generatedAt: new Date().toISOString(),
  sourceFile: SPELL_NAME_DB2,
  sourceLayoutHash: `0x${layoutHash.toString(16).padStart(8, "0")}`,
  recordCount: nameCount,
});
```

`layoutHash` comes from the loader already open in the script (`loader.getLayoutHash()`); `nameCount` is the entry count it already logs.

In `src/tools/spell.ts`, replace lines 97-98:

```ts
import { cachePathFor } from "../utils/cache-metadata";
import { getActiveBuild } from "../version/BuildManifest";

const spellNameCacheLoader = new JsonCacheLoader<string>(
  cachePathFor("spell_names_cache.json"), "spell name",
  { expectedBuild: getActiveBuild().build, regenerateCommand: "npm run generate:spell-cache" }
);
const spellDataCacheLoader = new JsonCacheLoader<SpellDataCacheEntry>(
  cachePathFor("spell_data_cache.json"), "spell data",
  { expectedBuild: getActiveBuild().build, regenerateCommand: "npm run generate:spell-cache" }
);
```

These are module-scope constants evaluated at import time, and `getActiveBuild()` throws before `loadBuildManifest()` runs. Wrap both in a lazy accessor instead:

```ts
let spellNameCacheLoader: JsonCacheLoader<string> | null = null;
function nameCache(): JsonCacheLoader<string> {
  if (!spellNameCacheLoader) {
    spellNameCacheLoader = new JsonCacheLoader<string>(
      cachePathFor("spell_names_cache.json"), "spell name",
      { expectedBuild: getActiveBuild().build, regenerateCommand: "npm run generate:spell-cache" }
    );
  }
  return spellNameCacheLoader;
}
```

Replace each `spellNameCacheLoader.` use with `nameCache().`, and mirror the pattern for the data cache and for `src/tools/dungeonstrategygenerator.ts:242`.

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest tests/tools/spell-cache-build.test.ts
npx jest tests/tools
```
Expected: new test PASS (2 tests); no new failures elsewhere.

- [ ] **Step 5: Type-check and commit**

```bash
npx tsc --noEmit
git add src/utils/cache-metadata.ts src/scripts/generate-spell-cache.ts src/tools/spell.ts src/tools/dungeonstrategygenerator.ts tests/tools/spell-cache-build.test.ts
git commit -m "feat: Key spell caches to the active build with stamped metadata"
```

---

### Task 10: Build extraction pipeline

**Files:**
- Create: `scripts/extract-build.js`
- Create: `docs/BUILD_EXTRACTION.md`
- Test: `tests/version/extraction-manifest.test.ts`
- Create: `src/version/ExtractionManifest.ts`

**Interfaces:**
- Consumes: `getBuild`, `resolveDataPath` (Tasks 2, 4); existing `CASCReader` from `src/casc/CASCReader`.
- Produces: `ExtractionManifest`, `writeExtractionManifest(dir, manifest)`, `readExtractionManifest(dir)`, `verifyExtraction(dir, expectedBuild): VerifyResult`.

The JS entry point orchestrates; the TS module owns the manifest format so it is testable. VMap/MMap are **verified, not produced** — TrinityCore's extractors make those.

- [ ] **Step 1: Write the failing test**

```ts
// tests/version/extraction-manifest.test.ts
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import {
  writeExtractionManifest, readExtractionManifest, verifyExtraction, ExtractionManifest,
} from "../../src/version/ExtractionManifest";

describe("extraction manifest", () => {
  let dir: string;
  const m: ExtractionManifest = {
    build: "12.1.0.69497", buildNumber: 69497,
    extractedAt: "2026-08-27T00:00:00.000Z",
    files: [
      { path: "db2/SpellName.db2", bytes: 6960179, sha256: "a".repeat(64) },
      { path: "db2/Map.db2", bytes: 126141, sha256: "b".repeat(64) },
    ],
    counts: { db2: 2, gt: 0 },
  };

  beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), "em-")); });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it("round-trips through disk", () => {
    writeExtractionManifest(dir, m);
    expect(readExtractionManifest(dir)).toEqual(m);
  });

  it("returns null when absent", () => {
    expect(readExtractionManifest(dir)).toBeNull();
  });

  it("verifies a manifest matching the expected build", () => {
    writeExtractionManifest(dir, m);
    const r = verifyExtraction(dir, "12.1.0.69497");
    expect(r.ok).toBe(true);
  });

  it("fails verification on a build mismatch and names both builds", () => {
    writeExtractionManifest(dir, m);
    const r = verifyExtraction(dir, "12.0.5.66838");
    expect(r.ok).toBe(false);
    expect(r.reason).toContain("12.1.0.69497");
    expect(r.reason).toContain("12.0.5.66838");
  });

  it("fails verification when no manifest exists", () => {
    const r = verifyExtraction(dir, "12.1.0.69497");
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/no extraction manifest/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/version/extraction-manifest.test.ts`
Expected: FAIL — `Cannot find module '../../src/version/ExtractionManifest'`

- [ ] **Step 3: Write minimal implementation**

```ts
// src/version/ExtractionManifest.ts
/**
 * Records what an extraction produced, so a partial or mismatched data tree is
 * detectable before it is trusted.
 *
 * @module version/ExtractionManifest
 */

import * as fs from "fs";
import * as path from "path";

export interface ExtractedFile {
  path: string;
  bytes: number;
  sha256: string;
}

export interface ExtractionManifest {
  build: string;
  buildNumber: number;
  extractedAt: string;
  files: ExtractedFile[];
  counts: Record<string, number>;
}

export interface VerifyResult {
  ok: boolean;
  reason: string;
}

export const EXTRACTION_MANIFEST_FILE = "extraction-manifest.json";

export function writeExtractionManifest(dir: string, manifest: ExtractionManifest): void {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, EXTRACTION_MANIFEST_FILE), JSON.stringify(manifest, null, 2), "utf8");
}

export function readExtractionManifest(dir: string): ExtractionManifest | null {
  const p = path.join(dir, EXTRACTION_MANIFEST_FILE);
  if (!fs.existsSync(p)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(p, "utf8")) as ExtractionManifest;
  } catch {
    return null;
  }
}

export function verifyExtraction(dir: string, expectedBuild: string): VerifyResult {
  const manifest = readExtractionManifest(dir);
  if (!manifest) {
    return { ok: false, reason: `No extraction manifest in ${dir}; the data tree is unverified` };
  }
  if (manifest.build !== expectedBuild) {
    return {
      ok: false,
      reason: `Extraction in ${dir} is for build ${manifest.build}, expected ${expectedBuild}`,
    };
  }
  return { ok: true, reason: `Extraction verified for build ${expectedBuild} (${manifest.files.length} files)` };
}
```

Create `scripts/extract-build.js`, which: parses `--build`, `--only`, `--dry-run`, `--force`; loads the manifest; asserts the client's `.build.info` build matches `--build` unless `--force`; fetches/reuses the listfile; exports DB2/DBC and gametables into the build's directories via `CASCReader`; hashes every produced file; and calls `writeExtractionManifest`. For `--only vmap` and `--only mmap` it verifies presence and hashes without producing anything.

Create `docs/BUILD_EXTRACTION.md` documenting: the `extract-build.js` invocation for each data kind, the exact TrinityCore extractor commands for vmaps/mmaps with their expected output paths, and the order (extract → `record-layout-hashes.js` → `validate-build-schemas` → `generate:spell-cache` → flip `activeBuild`).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest tests/version/extraction-manifest.test.ts`
Expected: PASS, 5 tests

- [ ] **Step 5: Type-check and commit**

```bash
npx tsc --noEmit
git add src/version/ExtractionManifest.ts scripts/extract-build.js docs/BUILD_EXTRACTION.md tests/version/extraction-manifest.test.ts
git commit -m "feat: Add build extraction pipeline with verifiable manifest"
```

---

### Task 11: Populate the manifest, extract 12.1, and cut over

**Files:**
- Create: `config/builds.json`
- Modify: `src/index.ts` (call `loadBuildManifest()` during startup)
- Test: `tests/version/startup.test.ts`

**Interfaces:**
- Consumes: everything from Tasks 1-10.

This task performs the rollout from spec §8. It is the only task that touches real data.

- [ ] **Step 1: Write the failing test**

```ts
// tests/version/startup.test.ts
import * as fs from "fs";
import * as path from "path";
import { parseBuildManifest } from "../../src/version/BuildManifest";

describe("config/builds.json", () => {
  const p = path.join(process.cwd(), "config", "builds.json");

  it("exists", () => {
    expect(fs.existsSync(p)).toBe(true);
  });

  it("is a valid manifest", () => {
    expect(() => parseBuildManifest(JSON.parse(fs.readFileSync(p, "utf8")))).not.toThrow();
  });

  it("declares 12.1.0.69497 as the active build", () => {
    const m = parseBuildManifest(JSON.parse(fs.readFileSync(p, "utf8")));
    expect(m.activeBuild).toBe("12.1.0.69497");
    expect(m.builds["12.1.0.69497"].build).toBe(69497);
  });

  it("retains at least one archived build", () => {
    const m = parseBuildManifest(JSON.parse(fs.readFileSync(p, "utf8")));
    expect(Object.values(m.builds).some((b) => b.status === "archived")).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/version/startup.test.ts`
Expected: FAIL — `config/builds.json` does not exist

- [ ] **Step 3: Perform the rollout**

Follow spec §8 in order. Do not skip ahead; step 4 is where real 12.1 breakage appears.

1. Write `config/builds.json` with the **archived** build first, using the build id determined in Task 3 and the current paths from `.env`, with `status: "archived"`. Set `activeBuild` to that archived build for now and give it `status: "active"` — the cutover happens at sub-step 6.
2. Add `await loadBuildManifest();` to `src/index.ts` startup, before tool registration. Verify the server starts and existing tools work.
3. Extract 12.1: `node scripts/extract-build.js --build 12.1.0.69497`, then run TrinityCore's vmap/mmap extractors per `docs/BUILD_EXTRACTION.md`.
4. `node scripts/record-layout-hashes.js --build 69497 --dir <new db2 dir>`; paste results into each schema's `LAYOUT_HASHES`; run `validate-build-schemas`. **Repair every schema that reports `mismatch`** by comparing its field indices against the real 12.1 file. Re-run until the summary is `ok`.
5. `npm run build && npm run generate:spell-cache` to regenerate caches into `data/cache/69497/`.
6. Flip: add the 12.1 entry with `status: "active"`, set the old entry to `status: "archived"`, set `activeBuild` to `12.1.0.69497`.
7. Restart and re-run `validate-build-schemas` to confirm no drift and all schemas verified.

- [ ] **Step 4: Run the full suite**

```bash
npx tsc --noEmit
npx jest
```
Expected: `tests/version/startup.test.ts` PASS (4 tests). Total failures must be no more than the ~11 known pre-existing ones — compare against `git stash`-ed baseline if unsure.

- [ ] **Step 5: Commit**

```bash
git add config/builds.json src/index.ts src/parsers/schemas/ tests/version/startup.test.ts
git commit -m "feat: Cut over to WoW 12.1.0.69497 as the active build"
```

---

### Task 12: Content sweep

**Files:**
- Modify: `src/data/spell-attributes.ts`, `spell-ranges.ts`, `stat-priorities.ts`, `xp-per-level.ts`
- Modify: the ~25 files listed in spec §9, plus `package.json` and `README.md`
- Test: `tests/data/source-build.test.ts`

**Interfaces:**
- Consumes: `getActiveBuild` (Task 2).
- Produces: `SOURCE_BUILD` exported from each `src/data` module.

- [ ] **Step 1: Write the failing test**

```ts
// tests/data/source-build.test.ts
import * as fs from "fs";
import * as path from "path";

const DATA_FILES = [
  "spell-attributes.ts", "spell-ranges.ts", "stat-priorities.ts", "xp-per-level.ts",
];

describe("src/data version labelling", () => {
  it("exports SOURCE_BUILD from every data module", () => {
    for (const f of DATA_FILES) {
      const src = fs.readFileSync(path.join("src", "data", f), "utf8");
      expect(src).toMatch(/export const SOURCE_BUILD/);
    }
  });

  it("contains no hard-coded 12.0.0 patch literals", () => {
    for (const f of DATA_FILES) {
      const src = fs.readFileSync(path.join("src", "data", f), "utf8");
      expect(src).not.toMatch(/["']12\.0\.0["']/);
    }
  });

  it("no longer describes the package as WoW 12.0", () => {
    const pkg = fs.readFileSync("package.json", "utf8");
    expect(pkg).not.toMatch(/12\.0 \(Midnight\)/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/data/source-build.test.ts`
Expected: FAIL — no `SOURCE_BUILD` export

- [ ] **Step 3: Write minimal implementation**

Add to each of the four `src/data` modules:

```ts
import { getActiveBuild } from "../version/BuildManifest";

/**
 * Client build these values were sourced for.
 * Resolved from the build manifest rather than duplicated as a literal.
 */
export const SOURCE_BUILD = (): string => getActiveBuild().id;
```

Replace every `patch: "12.0.0"` field and `source: 'Icy Veins 12.0.0'` string with values carrying the 12.1 patch. Then run the spec §9 grep and update each hit:

```bash
grep -rniE "12\.0 \(Midnight\)|WoW 12\.0|Icy Veins 12\.0" --include='*.ts' --include='*.tsx' \
  --include='*.json' --include='*.md' src web-ui/app web-ui/components web-ui/lib README.md package.json
```

Update `package.json` `description` to say WoW 12.1 (Midnight).

**Content task — `src/data/stat-priorities.ts`.** Its 25+ specialization entries cite `source: 'Icy Veins 12.0.0'`. Re-source each from the current Icy Veins 12.1 guides and update the `priorities` arrays accordingly. Do **not** simply relabel the patch field: a 12.0 priority list labelled 12.1 is a wrong answer wearing a correct label, which is the exact failure this whole plan exists to prevent. Where a 12.1 guide is unavailable for a spec, leave `patch: "12.0.0"` on that entry and add `staleForBuild: true` so the gap is visible rather than hidden.

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest tests/data
npx tsc --noEmit
```
Expected: new test PASS (3 tests); existing `tests/data` tests still pass.

- [ ] **Step 5: Commit**

```bash
git add src/data/ package.json README.md web-ui/ src/tools/ src/parsers/
git commit -m "docs: Retarget project version metadata to WoW 12.1"
```

---

## Self-Review

**Spec coverage.** §3.1 manifest → Task 1, 11. §3.2 loader, fallback, drift → Tasks 2, 3. §3.3 layout gate → Tasks 5, 6. §3.4 path resolution → Task 4. §3.5 extraction → Task 10. §3.6 cache keying → Tasks 8, 9. §5 error handling → Tasks 5, 7, 8 (all three failure classes have tests). §6 content sweep → Task 12. §7 testing → every task's steps 1-4. §8 rollout → Task 11. §11 acceptance criteria 1-6 → Tasks 11, 2, 7, 8, all, 12 respectively.

**Type consistency.** `BuildEntry.build` is `number` throughout; `BuildEntry.id` is the version string. `resolveDataPath(kind, buildId?)` keyed on `keyof BuildDataPaths` in Tasks 4, 7, 9. `checkSchemaLayout(schema, actualLayoutHash, build)` argument order identical in Tasks 5 and 7. `CacheMetadata.build` is `number`, matching `BuildEntry.build`, and is what `JsonCacheLoaderOptions.expectedBuild` compares against in Tasks 8 and 9. `cachePathFor` is defined in Task 9 and used only there and later.

**Known gap, deliberately left.** Task 4 migrates only `dbc.ts` and `gametable.ts` off direct `process.env` reads. The remaining tools continue to read env vars, which stays correct because the synthesized manifest mirrors them. Migrating all 179 is out of scope for the 12.1 cutover and would balloon the change surface without changing behavior.
