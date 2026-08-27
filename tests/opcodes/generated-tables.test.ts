import * as fs from "fs";
import * as path from "path";

const DIR = path.join(process.cwd(), "data", "opcodes");

describe("generated opcode tables", () => {
  it("contains the 12.1 table", () => {
    expect(fs.existsSync(path.join(DIR, "12.1.0.69214.json"))).toBe(true);
  });

  it("contains the 12.0.7 table for diffing", () => {
    expect(fs.existsSync(path.join(DIR, "12.0.7.67808.json"))).toBe(true);
  });

  it("has 2384 entries in the 12.1 table", () => {
    const t = JSON.parse(fs.readFileSync(path.join(DIR, "12.1.0.69214.json"), "utf8"));
    expect(t.opcodes).toHaveLength(2384);
  });

  it("records source and derivation metadata", () => {
    const t = JSON.parse(fs.readFileSync(path.join(DIR, "12.1.0.69214.json"), "utf8"));
    expect(t.build).toBe(69214);
    expect(t.source.derivedFrom).toBe("V12_0_7_67808");
    expect(t.source.method).toBe("family-shift");
  });

  it("lists the deliberately unmapped families", () => {
    const t = JSON.parse(fs.readFileSync(path.join(DIR, "12.1.0.69214.json"), "utf8"));
    expect(t.unmappedFamilies).toEqual(expect.arrayContaining(["0x2E", "0x35"]));
  });

  it("splits directions and finds no MSG entries", () => {
    const t = JSON.parse(fs.readFileSync(path.join(DIR, "12.1.0.69214.json"), "utf8"));
    const cmsg = t.opcodes.filter((o: { direction: string }) => o.direction === "CMSG").length;
    const smsg = t.opcodes.filter((o: { direction: string }) => o.direction === "SMSG").length;
    expect(cmsg + smsg).toBe(2384);
    expect(cmsg).toBeGreaterThan(0);
    expect(smsg).toBeGreaterThan(0);
  });

  it("ships a provenance file alongside", () => {
    expect(fs.existsSync(path.join(DIR, "12.1.0.69214-provenance.json"))).toBe(true);
  });
});
