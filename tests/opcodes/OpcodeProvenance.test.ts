import { parseProvenance, confidenceFor } from "../../src/opcodes/OpcodeProvenance";

const raw = {
  _meta: { created: "2026-08-20", builds: "12.1.0.69214 .. 12.1.0.69382" },
  family_shift: {
    "0x29": { shift: 1, provenance: "wire", client_family: "0x2A" },
    "0x2C": { shift: 1, provenance: "interp", client_family: "0x2D" },
    "0x2E": { shift: 1, provenance: "ambiguous", client_family: "0x2F" },
    "0x42": { shift: 3, provenance: "jam", client_family: "0x45" },
  },
  index_offsets: {
    "0x3A": [
      { catalog_index_from: "0x000", offset: 0 },
      { catalog_index_from: "0x100", offset: null },
    ],
    "0x3B": [{ catalog_index_from: "0x000", offset: 2 }],
  },
};

describe("parseProvenance", () => {
  it("parses all families", () => {
    expect(Object.keys(parseProvenance(raw).familyShift)).toHaveLength(4);
  });

  it("preserves null index offsets rather than coercing to zero", () => {
    const p = parseProvenance(raw);
    expect(p.indexOffsets["0x3A"][1].offset).toBeNull();
  });

  it("collects ambiguous families separately", () => {
    expect(parseProvenance(raw).ambiguousFamilies).toContain("0x2E");
  });

  it("rejects an unknown provenance code", () => {
    const bad = JSON.parse(JSON.stringify(raw));
    bad.family_shift["0x29"].provenance = "vibes";
    expect(() => parseProvenance(bad)).toThrow(/provenance/i);
  });

  it("rejects a missing family_shift block", () => {
    expect(() => parseProvenance({ _meta: {} })).toThrow(/family_shift/i);
  });
});

describe("confidenceFor", () => {
  const p = parseProvenance(raw);

  it("maps wire and jam to high", () => {
    expect(confidenceFor(p, "0x29")).toBe("high");
    expect(confidenceFor(p, "0x42")).toBe("high");
  });

  it("maps interp to medium", () => {
    expect(confidenceFor(p, "0x2C")).toBe("medium");
  });

  it("returns null for an ambiguous family", () => {
    expect(confidenceFor(p, "0x2E")).toBeNull();
  });

  it("returns null for an unrecorded family", () => {
    expect(confidenceFor(p, "0x99")).toBeNull();
  });
});
