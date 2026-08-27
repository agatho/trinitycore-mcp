import { validateOpcodeForHandler, generatePacketHandler } from "../../src/tools/codegen";
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

  // Judgement call: CMSG_MESSAGECHAT, SMSG_MESSAGECHAT, MSG_MOVE_START_FORWARD
  // and MSG_MOVE_STOP are documented in OPCODE_ANNOTATIONS but have no wire
  // value in the 12.1.0.69214 table (confirmed absent). validateOpcodeForHandler
  // must still reject them -- there is no concrete wire value to build a
  // handler around -- but the rejection message must say the opcode is
  // documented rather than implying a typo, and must not offer misleading
  // "did you mean" suggestions for a name that is not actually a near miss.
  describe("documented opcodes with no wire value in this build", () => {
    it.each([
      "CMSG_MESSAGECHAT",
      "SMSG_MESSAGECHAT",
      "MSG_MOVE_START_FORWARD",
      "MSG_MOVE_STOP",
    ])("rejects %s without fabricating a wire value, and says it is documented", (name) => {
      const v = validateOpcodeForHandler(name);
      expect(v.valid).toBe(false);
      expect(v.entry).toBeUndefined();
      expect(v.message).toMatch(/documented/i);
      expect(v.message).toMatch(/no wire value/i);
      expect(v.suggestions).toBeUndefined();
    });

    it("throws the same message from generatePacketHandler instead of emitting a handler", async () => {
      await expect(
        generatePacketHandler({
          handlerName: "ChatMessageHandler",
          opcode: "CMSG_MESSAGECHAT",
          direction: "client",
          fields: [],
        })
      ).rejects.toThrow(/documented/i);
    });
  });

  it("throws generatePacketHandler for an unknown opcode instead of emitting a handler", async () => {
    await expect(
      generatePacketHandler({
        handlerName: "BogusHandler",
        opcode: "CMSG_TOTALLY_MADE_UP",
        direction: "client",
        fields: [],
      })
    ).rejects.toThrow(/not in the table/);
  });
});
