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

  // NOTE (fix round 1): a client wire value's family/index cannot be checked
  // against OpcodeTable.isUnmappedCatalogFamily / isUndeterminedCatalogIndex
  // — those report gaps in the 12.0.7 CATALOG-space derivation, a different
  // namespace than the client wire family/index decoded from a value passed
  // to getOpcodeInfo. Comparing them would falsely attribute a plain client
  // miss to a catalog-space gap. Every value-lookup miss is therefore a
  // single generic response carrying a standing note about the table's known
  // (but not locatable-from-here) catalog-space gaps.

  it("reports a generic miss, not an undetermined-family claim, for a value in a client family that collides with an unmapped CATALOG family id", async () => {
    // 0x2E0001 collides with a real, resolved CLIENT entry
    // (CMSG_GUILD_DEMOTE_MEMBER) despite catalog family "0x2E" being
    // catalog-ambiguous — proof the two namespaces are unrelated. 0x2E0025 has
    // no table entry; it must be a plain generic miss, never "undetermined".
    const r = await getOpcodeInfo("0x2E0025");
    expect(r.error).toMatch(/No opcode with value/);
    expect(r.error).not.toMatch(/not uniquely determined|undetermined/i);
    expect(r.note).toMatch(/193 catalog opcodes/);
  });

  it("reports a generic miss for a value whose family/index coincide with an unmapped CATALOG index range", async () => {
    // Catalog family "0x3A" has an unmapped catalog index range [0x100, end).
    // 0x3A0150 is a client value with no table entry; the catalog-space range
    // must NOT be consulted to explain it.
    const r = await getOpcodeInfo("0x3A0150");
    expect(r.error).toMatch(/No opcode with value/);
    expect(r.error).not.toMatch(/undetermined|could not be decided/i);
    expect(r.note).toMatch(/193 catalog opcodes/);
  });

  it("returns a generic miss with the standing catalog-gap note for an ordinary missing value", async () => {
    const r = await getOpcodeInfo("0x420999");
    expect(r.error).toMatch(/No opcode with value/);
    expect(r.note).toMatch(/193 catalog opcodes/);
    expect(r.note).toMatch(/0x2E/);
    expect(r.note).toMatch(/0x35/);
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
