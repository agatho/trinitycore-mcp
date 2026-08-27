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
