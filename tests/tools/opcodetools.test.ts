import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { computeDiff, diffOpcodes } from "../../src/tools/opcodetools";
import { resetOpcodeTableForTesting } from "../../src/opcodes/OpcodeTable";
import { ParsedOpcode } from "../../src/opcodes/OpcodesCsParser";

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

describe("diffOpcodes derivation note", () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "opcodetools-note-"));
    resetOpcodeTableForTesting();
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
    resetOpcodeTableForTesting();
  });

  function writeTable(
    id: string,
    opts: {
      file: string;
      derivedFrom: string | null;
      method: string;
      build: number;
      version: string;
      opcodes: ParsedOpcode[];
    }
  ): void {
    fs.writeFileSync(
      path.join(dir, `${id}.json`),
      JSON.stringify({
        build: opts.build,
        version: opts.version,
        source: {
          file: opts.file,
          derivedFrom: opts.derivedFrom,
          method: opts.method,
          importedAt: "2026-08-27T00:00:00.000Z",
        },
        unmappedCatalogFamilies: [],
        unmappedCatalogIndexRanges: [],
        counts: { CMSG: opts.opcodes.length, SMSG: 0, MSG: 0 },
        opcodes: opts.opcodes,
      })
    );
  }

  it("includes a note when the to-table's source.derivedFrom names the from-table's source directory", async () => {
    writeTable("9.0.0.10001", {
      file: "V9_0_0_10001/Opcodes.cs",
      derivedFrom: null,
      method: "catalog",
      build: 10001,
      version: "9.0.0",
      opcodes: [
        { name: "CMSG_X", value: 0x010001, hex: "0x010001", direction: "CMSG", family: "0x01", index: "0x001" },
      ],
    });
    writeTable("9.1.0.10002", {
      file: "V9_1_0_10002/Opcodes.cs",
      derivedFrom: "V9_0_0_10001",
      method: "family-shift",
      build: 10002,
      version: "9.1.0",
      opcodes: [
        { name: "CMSG_X", value: 0x020001, hex: "0x020001", direction: "CMSG", family: "0x02", index: "0x001" },
      ],
    });

    const diff = await diffOpcodes({ fromBuild: "9.0.0.10001", toBuild: "9.1.0.10002", dir });

    expect(diff.note).toBeDefined();
    expect(diff.note).toContain("9.0.0.10001");
    expect(diff.note).toContain("9.1.0.10002");
    expect(diff.note).toMatch(/family-shift/);
  });

  it("omits the note for two independently-sourced tables", async () => {
    writeTable("9.0.0.10001", {
      file: "V9_0_0_10001/Opcodes.cs",
      derivedFrom: null,
      method: "catalog",
      build: 10001,
      version: "9.0.0",
      opcodes: [
        { name: "CMSG_X", value: 0x010001, hex: "0x010001", direction: "CMSG", family: "0x01", index: "0x001" },
      ],
    });
    writeTable("9.2.0.10003", {
      file: "V9_2_0_10003/Opcodes.cs",
      derivedFrom: null,
      method: "catalog",
      build: 10003,
      version: "9.2.0",
      opcodes: [
        { name: "CMSG_X", value: 0x030001, hex: "0x030001", direction: "CMSG", family: "0x03", index: "0x001" },
      ],
    });

    const diff = await diffOpcodes({ fromBuild: "9.0.0.10001", toBuild: "9.2.0.10003", dir });

    expect(diff.note).toBeUndefined();
  });

  it("omits the note when to's derivedFrom does not match from's source directory", async () => {
    writeTable("9.0.0.10001", {
      file: "V9_0_0_10001/Opcodes.cs",
      derivedFrom: null,
      method: "catalog",
      build: 10001,
      version: "9.0.0",
      opcodes: [
        { name: "CMSG_X", value: 0x010001, hex: "0x010001", direction: "CMSG", family: "0x01", index: "0x001" },
      ],
    });
    writeTable("9.3.0.10004", {
      file: "V9_3_0_10004/Opcodes.cs",
      derivedFrom: "V9_9_0_99999",
      method: "family-shift",
      build: 10004,
      version: "9.3.0",
      opcodes: [
        { name: "CMSG_X", value: 0x040001, hex: "0x040001", direction: "CMSG", family: "0x04", index: "0x001" },
      ],
    });

    const diff = await diffOpcodes({ fromBuild: "9.0.0.10001", toBuild: "9.3.0.10004", dir });

    expect(diff.note).toBeUndefined();
  });
});
