import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import {
  writeExtractionManifest, readExtractionManifest, verifyExtraction, ExtractionManifest,
} from "../../src/version/ExtractionManifest";

describe("extraction manifest", () => {
  let dir: string;
  const m: ExtractionManifest = {
    build: "12.1.0.69497", buildNumber: 69497,
    extractedAt: "2026-08-27T00:00:00.000Z",
    files: [
      { path: "db2/SpellName.db2", bytes: 6960179, sha256: "a".repeat(64) },
      { path: "db2/Map.db2", bytes: 126141, sha256: "b".repeat(64) },
    ],
    counts: { db2: 2, gt: 0 },
  };

  beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), "em-")); });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it("round-trips through disk", () => {
    writeExtractionManifest(dir, m);
    expect(readExtractionManifest(dir)).toEqual(m);
  });

  it("returns null when absent", () => {
    expect(readExtractionManifest(dir)).toBeNull();
  });

  it("verifies a manifest matching the expected build", () => {
    writeExtractionManifest(dir, m);
    const r = verifyExtraction(dir, "12.1.0.69497");
    expect(r.ok).toBe(true);
  });

  it("fails verification on a build mismatch and names both builds", () => {
    writeExtractionManifest(dir, m);
    const r = verifyExtraction(dir, "12.0.5.66838");
    expect(r.ok).toBe(false);
    expect(r.reason).toContain("12.1.0.69497");
    expect(r.reason).toContain("12.0.5.66838");
  });

  it("fails verification when no manifest exists", () => {
    const r = verifyExtraction(dir, "12.1.0.69497");
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/no extraction manifest/i);
  });
});
