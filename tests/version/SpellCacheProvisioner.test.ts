/**
 * Tests for spell cache provisioning.
 *
 * These cover detection and the decisions made from it. Generation itself
 * spawns the compiled generator and reads a multi-megabyte DB2, so it is left
 * to the integration path; what matters here is that a missing or stale cache
 * is recognised, that an unreachable client install is reported rather than
 * attempted, and that a run already in progress is not duplicated.
 */

import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import {
  inspectSpellCache,
  ensureSpellCache,
  isSpellCacheSourceAvailable,
} from "../../src/version/SpellCacheProvisioner";
import { loadBuildManifest, resetManifestForTesting } from "../../src/version/BuildManifest";

const BUILD = 69497;

let root: string;
let cacheDir: string;
let db2Dir: string;
let manifestPath: string;
let previousCwd: string;

/** Write a cache file with a metadata sidecar naming the build that made it. */
function writeCache(fileName: string, build: number): void {
  const filePath = path.join(cacheDir, fileName);
  fs.writeFileSync(filePath, JSON.stringify({ 133: "Fireball" }), "utf8");
  fs.writeFileSync(
    `${filePath}.meta.json`,
    JSON.stringify({
      build,
      generatedAt: new Date().toISOString(),
      sourceFile: "SpellName.db2",
      sourceLayoutHash: "0x782ee721",
      recordCount: 1,
    }),
    "utf8"
  );
}

function writeBothCaches(build: number): void {
  writeCache("spell_names_cache.json", build);
  writeCache("spell_data_cache.json", build);
}

beforeEach(async () => {
  previousCwd = process.cwd();
  root = fs.mkdtempSync(path.join(os.tmpdir(), "spell-cache-"));
  cacheDir = path.join(root, "data", "cache", String(BUILD));
  db2Dir = path.join(root, "dbc");
  fs.mkdirSync(cacheDir, { recursive: true });
  fs.mkdirSync(db2Dir, { recursive: true });

  fs.mkdirSync(path.join(root, "config"), { recursive: true });
  manifestPath = path.join(root, "config", "builds.json");
  fs.writeFileSync(
    manifestPath,
    JSON.stringify({
      manifestVersion: 1,
      activeBuild: `12.1.0.${BUILD}`,
      builds: {
        [`12.1.0.${BUILD}`]: {
          build: BUILD,
          product: "wow",
          expansion: "Midnight",
          status: "active",
          db2Format: "WDC5",
          dataPaths: {
            db2: db2Dir,
            dbc: db2Dir,
            gt: path.join(root, "gt"),
            vmap: path.join(root, "vmaps"),
            mmap: path.join(root, "mmaps"),
            listfile: path.join(root, "listfile.csv"),
          },
          cacheDir,
          opcodeTable: "12.1.0.69214",
        },
      },
    }),
    "utf8"
  );

  // The manifest and the cache directory are both resolved relative to the cwd.
  process.chdir(root);
  resetManifestForTesting();
  await loadBuildManifest(manifestPath);
});

afterEach(() => {
  process.chdir(previousCwd);
  resetManifestForTesting();
  fs.rmSync(root, { recursive: true, force: true });
});

describe("inspectSpellCache", () => {
  it("reports missing when no cache has been generated", () => {
    const status = inspectSpellCache();
    expect(status.state).toBe("missing");
    expect(status.build).toBe(BUILD);
    expect(status.detail).toContain("no cached spell data");
  });

  it("reports missing when only one of the two caches exists", () => {
    writeCache("spell_names_cache.json", BUILD);
    expect(inspectSpellCache().state).toBe("missing");
  });

  it("reports ready when both caches match the active build", () => {
    writeBothCaches(BUILD);
    const status = inspectSpellCache();
    expect(status.state).toBe("ready");
    expect(status.detail).toContain("present and current");
  });

  it("reports stale when a cache was generated for another build", () => {
    writeBothCaches(65299);
    const status = inspectSpellCache();
    expect(status.state).toBe("stale");
    expect(status.detail).toContain("65299");
  });

  it("reports stale when a cache has no metadata to vouch for it", () => {
    writeBothCaches(BUILD);
    fs.unlinkSync(path.join(cacheDir, "spell_names_cache.json.meta.json"));
    const status = inspectSpellCache();
    expect(status.state).toBe("stale");
    expect(status.detail).toContain("no build metadata");
  });

  it("reports generating while a lock is held", () => {
    fs.writeFileSync(path.join(cacheDir, ".spell-cache-generating"), "1234", "utf8");
    expect(inspectSpellCache().state).toBe("generating");
  });

  it("ignores a lock old enough to be abandoned", () => {
    const lock = path.join(cacheDir, ".spell-cache-generating");
    fs.writeFileSync(lock, "1234", "utf8");
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    fs.utimesSync(lock, twoHoursAgo, twoHoursAgo);

    expect(inspectSpellCache().state).toBe("missing");
    expect(fs.existsSync(lock)).toBe(false);
  });
});

describe("isSpellCacheSourceAvailable", () => {
  it("is false when SpellName.db2 is not where the build says", () => {
    expect(isSpellCacheSourceAvailable()).toBe(false);
  });

  it("is true once SpellName.db2 is present", () => {
    fs.writeFileSync(path.join(db2Dir, "SpellName.db2"), "not a real db2", "utf8");
    expect(isSpellCacheSourceAvailable()).toBe(true);
  });
});

describe("ensureSpellCache", () => {
  it("does nothing when the caches are already current", async () => {
    writeBothCaches(BUILD);
    const result = await ensureSpellCache();
    expect(result.ready).toBe(true);
    expect(result.started).toBe(false);
    expect(result.initialState).toBe("ready");
  });

  it("does not start a second run while one is in progress", async () => {
    fs.writeFileSync(path.join(cacheDir, ".spell-cache-generating"), "1234", "utf8");
    const result = await ensureSpellCache();
    expect(result.started).toBe(false);
    expect(result.initialState).toBe("generating");
  });

  it("explains rather than attempts when the client data is unreachable", async () => {
    const result = await ensureSpellCache();
    expect(result.started).toBe(false);
    expect(result.ready).toBe(false);
    expect(result.detail).toContain("SpellName.db2 was not found");
    expect(result.detail).toContain("npm run generate:spell-cache");
  });

  it("leaves no lock behind when it declines to generate", async () => {
    await ensureSpellCache();
    expect(fs.existsSync(path.join(cacheDir, ".spell-cache-generating"))).toBe(false);
  });

  it("regenerates a stale cache rather than serving it", async () => {
    writeBothCaches(65299);
    fs.writeFileSync(path.join(db2Dir, "SpellName.db2"), "not a real db2", "utf8");

    const result = await ensureSpellCache();
    // The generator is absent from this temporary tree, so the attempt stops at
    // that check - but the decision under test is that a stale cache is not
    // accepted as ready.
    expect(result.ready).toBe(false);
    expect(result.initialState).toBe("stale");
  });
});
