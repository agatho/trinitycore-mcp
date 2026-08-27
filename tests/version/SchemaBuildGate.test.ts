import {
  checkSchemaLayout, SchemaLayoutMismatchError, resetGateWarningsForTesting,
  BuildAwareSchema,
} from "../../src/version/SchemaBuildGate";
import { logger } from "../../src/utils/logger";

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

  it("warns exactly once per schema for unknown builds, and keeps returning unverified", () => {
    const spy = jest.spyOn(logger, "warn").mockImplementation(() => undefined as unknown as ReturnType<typeof logger.warn>);
    try {
      checkSchemaLayout(schema, 0x1, 70000);
      checkSchemaLayout(schema, 0x1, 70000);
      const third = checkSchemaLayout(schema, 0x1, 70000);

      expect(spy).toHaveBeenCalledTimes(1);
      expect(third.status).toBe("unverified");
    } finally {
      spy.mockRestore();
    }
  });
});
