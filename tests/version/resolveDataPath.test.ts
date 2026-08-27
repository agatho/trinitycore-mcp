import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { loadBuildManifest, resolveDataPath, resetManifestForTesting } from "../../src/version/BuildManifest";

describe("resolveDataPath", () => {
  let dir: string;
  let manifestPath: string;

  beforeEach(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "rdp-"));
    manifestPath = path.join(dir, "builds.json");
    fs.writeFileSync(manifestPath, JSON.stringify({
      manifestVersion: 1,
      activeBuild: "12.1.0.69497",
      builds: {
        "12.1.0.69497": {
          build: 69497, product: "wow", expansion: "Midnight", status: "active", db2Format: "WDC5",
          dataPaths: { db2: "N/db2", dbc: "N/dbc", gt: "N/gt", vmap: "N/vmap", mmap: "N/mmap", listfile: "N/lf.csv" },
          cacheDir: "data/cache/69497",
        },
        "12.0.x.00000": {
          build: 1, product: "wow", expansion: "Midnight", status: "archived", db2Format: "WDC5",
          dataPaths: { db2: "O/db2", dbc: "O/dbc", gt: "O/gt", vmap: "O/vmap", mmap: "O/mmap", listfile: "O/lf.csv" },
          cacheDir: "data/cache/old",
        },
      },
    }));
    resetManifestForTesting();
    await loadBuildManifest(manifestPath);
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
    resetManifestForTesting();
  });

  it("resolves against the active build by default", () => {
    expect(resolveDataPath("db2")).toBe("N/db2");
    expect(resolveDataPath("gt")).toBe("N/gt");
  });

  it("resolves against an explicitly named build", () => {
    expect(resolveDataPath("db2", "12.0.x.00000")).toBe("O/db2");
  });

  it("throws a named error for an unknown build id", () => {
    expect(() => resolveDataPath("db2", "12.9.9.99999")).toThrow(/12\.9\.9\.99999/);
  });
});
