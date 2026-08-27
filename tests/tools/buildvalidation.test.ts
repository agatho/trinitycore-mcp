// tests/tools/buildvalidation.test.ts
import { summarizeValidation, SchemaValidationRow } from "../../src/tools/buildvalidation";

describe("summarizeValidation", () => {
  const rows: SchemaValidationRow[] = [
    { schema: "SpellSchema", file: "SpellName.db2", status: "verified" },
    { schema: "ItemSchema", file: "Item.db2", status: "mismatch", detail: "expected 0x1, got 0x2" },
    { schema: "TalentSchema", file: "Talent.db2", status: "unverified", detail: "no hash for build" },
    { schema: "ChrRacesSchema", file: "ChrRaces.db2", status: "missing", detail: "file not found" },
  ];

  it("counts each status", () => {
    const s = summarizeValidation(rows);
    expect(s.verified).toBe(1);
    expect(s.mismatch).toBe(1);
    expect(s.unverified).toBe(1);
    expect(s.missing).toBe(1);
  });

  it("is not ok when any schema mismatches", () => {
    expect(summarizeValidation(rows).ok).toBe(false);
  });

  it("is ok when everything verifies", () => {
    const clean = rows.filter((r) => r.status === "verified");
    expect(summarizeValidation(clean).ok).toBe(true);
  });

  it("is not ok when a file is missing", () => {
    const s = summarizeValidation([rows[0], rows[3]]);
    expect(s.ok).toBe(false);
  });

  it("treats unverified as non-blocking but reports it", () => {
    const s = summarizeValidation([rows[0], rows[2]]);
    expect(s.ok).toBe(true);
    expect(s.unverified).toBe(1);
  });
});
