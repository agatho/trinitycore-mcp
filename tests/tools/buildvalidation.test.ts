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
    expect(spellRow?.detail).toMatch(/valid from build 64438/);
    expect(report.summary.mismatch).toBe(0);
  });
});

describe("validateBuildSchemas - case-insensitive DB2 filename resolution", () => {
  let tempDir: string;
  let originalDb2Path: string | undefined;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "buildvalidation-case-"));
    // Write the file under a NON-canonical (lowercase) name, as a CASC
    // listfile-driven extraction would (see src/casc/CASCListFile.ts, which
    // lowercases every path). SCHEMA_FILES still declares "SpellName.db2".
    fs.writeFileSync(path.join(tempDir, "spellname.db2"), Buffer.alloc(200));

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

  it("resolves a lowercase on-disk filename against the canonical declared name", async () => {
    // Windows/NTFS and default macOS volumes are case-insensitive, so a bare
    // fs.existsSync(exact-case path) check would spuriously succeed there
    // even against the OLD exact-case implementation, masking the bug this
    // test exists to catch. Monkey-patch fs.existsSync to actually behave
    // like a case-sensitive filesystem (only an exact-case directory entry
    // "exists"), driven by a real fs.readdirSync of the directory, so this
    // test is deterministic regardless of host OS and genuinely fails
    // against code that resolves SCHEMA_FILES via fs.existsSync(canonical
    // name) instead of a case-folded directory index.
    //
    // `import * as fs from "fs"` compiles (esModuleInterop) to a getter-only
    // accessor that live-reads the real Node `fs` module singleton, so
    // neither jest.spyOn (Object.defineProperty on a non-configurable
    // accessor) nor a direct assignment through that binding works. Mutate
    // the actual CJS module object instead - obtained via a raw require -
    // which both this test's and buildvalidation.ts's own `fs` bindings read
    // through live, since they resolve to the same cached module instance.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const rawFs = require("fs") as typeof fs;
    const originalExistsSync = rawFs.existsSync;
    rawFs.existsSync = ((target: fs.PathLike) => {
      const p = String(target);
      const dir = path.dirname(p);
      const base = path.basename(p);
      let entries: string[];
      try {
        entries = fs.readdirSync(dir);
      } catch {
        return false;
      }
      return entries.includes(base);
    }) as typeof fs.existsSync;

    try {
      const report = await validateBuildSchemas({});
      const spellRow = report.rows.find((r) => r.schema === "SpellSchema");

      expect(spellRow).toBeDefined();
      // Must not be "missing" - the file exists on disk, just under a
      // different case than SCHEMA_FILES declares.
      expect(spellRow?.status).not.toBe("missing");
      // The declared canonical spelling is preserved in the row even though
      // resolution was case-insensitive.
      expect(spellRow?.file).toBe("SpellName.db2");
    } finally {
      rawFs.existsSync = originalExistsSync;
    }
  });

  it("still reports missing when the directory does not exist at all", async () => {
    fs.rmSync(tempDir, { recursive: true, force: true });
    const report = await validateBuildSchemas({});
    const spellRow = report.rows.find((r) => r.schema === "SpellSchema");

    expect(spellRow?.status).toBe("missing");
    expect(spellRow?.detail).toMatch(/Not found/);
  });

  it("still reports missing when no file matches, case-insensitively or otherwise", async () => {
    fs.rmSync(path.join(tempDir, "spellname.db2"));
    const report = await validateBuildSchemas({});
    const spellRow = report.rows.find((r) => r.schema === "SpellSchema");

    expect(spellRow?.status).toBe("missing");
  });
});
