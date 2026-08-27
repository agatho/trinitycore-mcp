import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { loadBuildManifest, resetManifestForTesting } from "../../src/version/BuildManifest";
import { cachePathFor } from "../../src/utils/cache-metadata";

describe("cachePathFor", () => {
  let dir: string;

  beforeEach(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "scb-"));
    const p = path.join(dir, "builds.json");
    fs.writeFileSync(p, JSON.stringify({
      manifestVersion: 1,
      activeBuild: "12.1.0.69497",
      builds: {
        "12.1.0.69497": {
          build: 69497, product: "wow", expansion: "Midnight", status: "active", db2Format: "WDC5",
          dataPaths: { db2: "d", dbc: "c", gt: "g", vmap: "v", mmap: "m", listfile: "l" },
          cacheDir: "data/cache/69497",
        },
      },
    }));
    resetManifestForTesting();
    await loadBuildManifest(p);
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
    resetManifestForTesting();
  });

  it("resolves a cache file inside the active build's cache directory", () => {
    expect(cachePathFor("spell_names_cache.json")).toBe(path.join("data/cache/69497", "spell_names_cache.json"));
  });

  it("resolves different files into the same build directory", () => {
    expect(path.dirname(cachePathFor("spell_data_cache.json")))
      .toBe(path.dirname(cachePathFor("spell_names_cache.json")));
  });
});
