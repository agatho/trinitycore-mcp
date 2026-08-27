import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { readCacheMetadata, writeCacheMetadata, CacheMetadata } from "../../src/utils/cache-metadata";
import { JsonCacheLoader } from "../../src/utils/json-cache-loader";

describe("cache metadata sidecar", () => {
  let dir: string;
  let cacheFile: string;

  const meta: CacheMetadata = {
    build: 69497, generatedAt: "2026-08-27T00:00:00.000Z",
    sourceFile: "SpellName.db2", sourceLayoutHash: "0x11223344", recordCount: 2,
  };

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "cm-"));
    cacheFile = path.join(dir, "spell_names_cache.json");
    fs.writeFileSync(cacheFile, JSON.stringify({ "133": "Fireball", "116": "Frostbolt" }));
  });

  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it("round-trips metadata through the sidecar file", () => {
    writeCacheMetadata(cacheFile, meta);
    expect(fs.existsSync(`${cacheFile}.meta.json`)).toBe(true);
    expect(readCacheMetadata(cacheFile)).toEqual(meta);
  });

  it("returns null when no sidecar exists", () => {
    expect(readCacheMetadata(cacheFile)).toBeNull();
  });

  it("loads a cache whose build matches the expected build", () => {
    writeCacheMetadata(cacheFile, meta);
    const loader = new JsonCacheLoader<string>(cacheFile, "spell name", { expectedBuild: 69497 });
    expect(loader.load()).toBe(true);
    expect(loader.get(133)).toBe("Fireball");
  });

  it("refuses a cache built for a different build", () => {
    writeCacheMetadata(cacheFile, { ...meta, build: 66838 });
    const loader = new JsonCacheLoader<string>(cacheFile, "spell name", {
      expectedBuild: 69497,
      regenerateCommand: "npm run generate:spell-cache",
    });
    expect(loader.load()).toBe(false);
    expect(loader.get(133)).toBeNull();
  });

  it("refuses a cache with no metadata when a build is expected", () => {
    const loader = new JsonCacheLoader<string>(cacheFile, "spell name", { expectedBuild: 69497 });
    expect(loader.load()).toBe(false);
  });

  it("loads without metadata when no build is expected", () => {
    const loader = new JsonCacheLoader<string>(cacheFile, "spell name");
    expect(loader.load()).toBe(true);
    expect(loader.get(116)).toBe("Frostbolt");
  });
});
