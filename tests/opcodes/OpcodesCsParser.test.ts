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

  it("ignores comments between entries and they contribute no opcode entry", () => {
    const r = parseOpcodesCs(fixture);
    // The fixture's ClientOpcodes block has exactly 2 real entries plus one
    // `// a comment between entries` line. If comment-skipping were removed,
    // this would now throw OpcodesParseError (per the "fail loudly" rule),
    // so asserting success here already discriminates a regression; the
    // exact-name assertion additionally rules out the comment silently
    // becoming a phantom entry.
    expect(r.opcodes).toHaveLength(3);
    expect(r.opcodes.map((o) => o.name)).toEqual([
      "CMSG_ACCEPT_GUILD_INVITE",
      "CMSG_ACCEPT_TRADE",
      "SMSG_ABORT_NEW_WORLD",
    ]);
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

  it("throws with a line number on an unrecognized non-comment line inside a block", () => {
    // A future Opcodes.cs format change could introduce a line inside a
    // block that is neither blank, a comment, a closing brace, nor an
    // entry. The parser must fail loudly rather than silently skip it —
    // a silent skip would produce a quietly incomplete opcode table.
    const bad = fixture.replace("            // a comment between entries", "            garbage line here");
    expect(() => parseOpcodesCs(bad)).toThrow(OpcodesParseError);
    expect(() => parseOpcodesCs(bad)).toThrow(/line \d+/);
  });
});
