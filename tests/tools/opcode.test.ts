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
      expect(r.error).toBeUndefined();
    }
  });

  it("merges annotation structure onto table data", async () => {
    const r = await getOpcodeInfo("CMSG_CAST_SPELL");
    expect(r.structure).toContain("spellId");
    expect(r.value).toBeDefined();
    expect(r.hex).toBeDefined();
    expect(r.note).toBeUndefined();
  });

  it("returns suggestions for a near-miss name", async () => {
    const r = await getOpcodeInfo("CMSG_ACCEPT_GUILD_INVIT");
    expect(r.error).toBeTruthy();
    expect(r.suggestions).toContain("CMSG_ACCEPT_GUILD_INVITE");
  });

  it("reports an undetermined family rather than an unknown opcode", async () => {
    // 0x2E0001 collides with a real, resolved entry (CMSG_GUILD_DEMOTE_MEMBER)
    // in this unmapped family, so it resolves normally instead of exercising
    // the unmapped-family path. 0x2E0025 has no table entry and does exercise it.
    const r = await getOpcodeInfo("0x2E0025");
    expect(r.error).toMatch(/not uniquely determined|undetermined/i);
    expect(r.error).not.toMatch(/unknown opcode/i);
  });

  it("reports an undetermined index range distinctly from a plain absence", async () => {
    // family 0x3A, unmapped index range [0x100, end) per the 12.1 table's
    // unmappedIndexRanges; 0x150 falls inside it and has no table entry.
    const r = await getOpcodeInfo("0x3A0150");
    expect(r.error).toBeTruthy();
    expect(r.error).toMatch(/undetermined|could not be decided/i);
    expect(r.error).not.toMatch(/^No opcode with value/);
  });

  it("returns a generic miss for a value in a fully-mapped family with no entry", async () => {
    // family 0x42 is not in unmappedFamilies, and 0x03A falls outside its
    // undetermined index ranges ([0x039,0x040) and [0x11B,0x11E)) — wait,
    // 0x03A IS inside [0x039,0x040); use an index clearly outside both ranges.
    const r = await getOpcodeInfo("0x420999");
    expect(r.error).toMatch(/No opcode with value/);
  });

  it("returns annotation-only fallback for a name absent from the 12.1 table", async () => {
    const r = await getOpcodeInfo("CMSG_MESSAGECHAT");
    expect(r.error).toBeUndefined();
    expect(r.description).toBeTruthy();
    expect(r.value).toBeUndefined();
    expect(r.hex).toBeUndefined();
    expect(r.family).toBeUndefined();
    expect(r.index).toBeUndefined();
    expect(r.confidence).toBeUndefined();
    expect(r.note).toBeTruthy();
    expect(r.direction).toBe("CMSG");
  });

  it("returns annotation-only fallback for MSG_MOVE opcodes absent from the table", async () => {
    const r = await getOpcodeInfo("MSG_MOVE_START_FORWARD");
    expect(r.error).toBeUndefined();
    expect(r.description).toBeTruthy();
    expect(r.note).toBeTruthy();
    expect(r.direction).toBe("MSG");
    expect(r.structure).toContain("MovementInfo");
  });
});
