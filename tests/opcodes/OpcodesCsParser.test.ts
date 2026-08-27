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
