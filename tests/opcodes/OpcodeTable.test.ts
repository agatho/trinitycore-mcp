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
      unmappedIndexRanges: [
        { family: "0x3A", fromIndex: "0x100", toIndex: null },
        { family: "0x42", fromIndex: "0x039", toIndex: "0x040" },
        { family: "0x42", fromIndex: "0x11B", toIndex: "0x11E" },
      ],
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

  it("exposes the raw unmapped index ranges", () => {
    const t = loadOpcodeTable("12.1.0.69214", dir);
    expect(t.unmappedIndexRanges).toHaveLength(3);
    expect(t.unmappedIndexRanges[0]).toEqual({ family: "0x3A", fromIndex: "0x100", toIndex: null });
  });

  it("reports an index inside a bounded unmapped range as undetermined", () => {
    const t = loadOpcodeTable("12.1.0.69214", dir);
    // 0x42 range is [0x039, 0x040); 0x03A is inside it.
    expect(t.isUndeterminedIndex("0x42", 0x03a)).toBe(true);
  });

  it("treats the exclusive toIndex boundary as NOT undetermined", () => {
    const t = loadOpcodeTable("12.1.0.69214", dir);
    // 0x040 is the exclusive upper bound of the [0x039, 0x040) range — outside it.
    expect(t.isUndeterminedIndex("0x42", 0x040)).toBe(false);
  });

  it("reports an index inside an open-ended (toIndex: null) range as undetermined", () => {
    const t = loadOpcodeTable("12.1.0.69214", dir);
    // 0x3A range is [0x100, end); 0x200 is far past 0x100 but still open-ended.
    expect(t.isUndeterminedIndex("0x3A", 0x200)).toBe(true);
  });

  it("returns false for a family with no unmapped index ranges", () => {
    const t = loadOpcodeTable("12.1.0.69214", dir);
    expect(t.isUndeterminedIndex("0x43", 0x029)).toBe(false);
  });
});
