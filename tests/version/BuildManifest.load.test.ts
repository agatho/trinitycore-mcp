import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import {
  loadBuildManifest, synthesizeFromEnv, getActiveBuild, getBuild,
  listBuilds, resetManifestForTesting,
} from "../../src/version/BuildManifest";

const ENV = {
  DB2_PATH: "M:\\data\\dbc\\enUS", DBC_PATH: "M:\\data\\dbc\\enUS",
  GT_PATH: "M:\\data\\gt", VMAP_PATH: "M:\\data\\vmaps", MMAP_PATH: "M:\\data\\mmaps",
} as NodeJS.ProcessEnv;

describe("synthesizeFromEnv", () => {
  it("builds a single active 'unknown' build from environment paths", () => {
    const m = synthesizeFromEnv(ENV);
    expect(m.activeBuild).toBe("unknown");
    const entry = m.builds["unknown"];
    expect(entry.synthesized).toBe(true);
    expect(entry.status).toBe("active");
    expect(entry.dataPaths.db2).toBe("M:\\data\\dbc\\enUS");
    expect(entry.dataPaths.gt).toBe("M:\\data\\gt");
  });

  it("falls back to repo-relative defaults when env vars are absent", () => {
    const m = synthesizeFromEnv({} as NodeJS.ProcessEnv);
    expect(m.builds["unknown"].dataPaths.db2).toBe("./data/db2");
    expect(m.builds["unknown"].dataPaths.dbc).toBe("./data/dbc");
  });

  it("passes its own validation", () => {
    expect(() => synthesizeFromEnv(ENV)).not.toThrow();
  });
});

describe("loadBuildManifest", () => {
  let dir: string;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "bm-"));
    resetManifestForTesting();
  });
  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
    resetManifestForTesting();
  });

  it("synthesizes from env when the manifest file is absent", async () => {
    const m = await loadBuildManifest(path.join(dir, "nope.json"));
    expect(m.builds[m.activeBuild].synthesized).toBe(true);
  });

  it("loads a manifest file when present", async () => {
    const p = path.join(dir, "builds.json");
    fs.writeFileSync(p, JSON.stringify({
      manifestVersion: 1,
      activeBuild: "12.1.0.69497",
      builds: {
        "12.1.0.69497": {
          build: 69497, product: "wow", expansion: "Midnight",
          status: "active", db2Format: "WDC5",
          dataPaths: { db2: "d", dbc: "c", gt: "g", vmap: "v", mmap: "m", listfile: "l" },
          cacheDir: "data/cache/69497",
        },
      },
    }));
    const m = await loadBuildManifest(p);
    expect(m.activeBuild).toBe("12.1.0.69497");
    expect(m.builds["12.1.0.69497"].synthesized).toBeUndefined();
  });

  it("exposes accessors after load", async () => {
    await loadBuildManifest(path.join(dir, "nope.json"));
    expect(getActiveBuild().id).toBe("unknown");
    expect(getBuild("unknown")).not.toBeNull();
    expect(getBuild("12.9.9.99999")).toBeNull();
    expect(listBuilds()).toHaveLength(1);
  });

  it("falls back to a synthesized 'unknown' build when accessors are used before load", () => {
    resetManifestForTesting();
    const entry = getActiveBuild();
    expect(entry.id).toBe("unknown");
    expect(entry.synthesized).toBe(true);
  });
});
