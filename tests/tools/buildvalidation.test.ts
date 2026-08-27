// tests/tools/buildvalidation.test.ts
import { summarizeValidation, SchemaValidationRow, validateBuildSchemas } from "../../src/tools/buildvalidation";
import { resetManifestForTesting } from "../../src/version/BuildManifest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

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

describe("validateBuildSchemas - build-range refusal vs. hash mismatch", () => {
  let tempDir: string;
  let originalDb2Path: string | undefined;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "buildvalidation-"));
    // A schema's DB2 file must exist for the code to reach checkSchemaLayout at
    // all (otherwise the row is "missing" before any range/hash check runs).
    // The bytes' content is irrelevant here: with no manifest loaded, the
    // synthesized build is 0, which is below every schema's declared
    // VALID_BUILDS.from (65390) - checkSchemaLayout throws its plain
    // build-range Error before it ever reads LAYOUT_HASHES or compares hashes.
    fs.writeFileSync(path.join(tempDir, "SpellName.db2"), Buffer.alloc(200));

    originalDb2Path = process.env.DB2_PATH;
    process.env.DB2_PATH = tempDir;
    resetManifestForTesting();
  });

  afterEach(() => {
    resetManifestForTesting();
    if (originalDb2Path === undefined) {
      delete process.env.DB2_PATH;
    } else {
      process.env.DB2_PATH = originalDb2Path;
    }
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("reports unverified, not mismatch, when the build is outside a schema's declared range", async () => {
    const report = await validateBuildSchemas({});
    const spellRow = report.rows.find((r) => r.schema === "SpellSchema");

    expect(spellRow).toBeDefined();
    expect(spellRow?.status).toBe("unverified");
    expect(spellRow?.detail).toMatch(/valid from build 65390/);
    expect(report.summary.mismatch).toBe(0);
  });
});
