import * as fs from "fs";
import * as path from "path";
import { parseBuildManifest } from "../../src/version/BuildManifest";

// The 12.1 cutover. The manifest previously shipped with the pre-migration
// extraction (11.2.7.65299) active while the 12.1 schemas were still being
// verified; that build is now archived and 12.1.0.69497 is active. It is kept
// in the manifest rather than removed so its data and caches stay reachable by
// build id.
describe("config/builds.json", () => {
  const p = path.join(process.cwd(), "config", "builds.json");

  it("exists", () => {
    expect(fs.existsSync(p)).toBe(true);
  });

  it("is a valid manifest", () => {
    expect(() => parseBuildManifest(JSON.parse(fs.readFileSync(p, "utf8")))).not.toThrow();
  });

  it("declares 12.1.0.69497 as the active build", () => {
    const m = parseBuildManifest(JSON.parse(fs.readFileSync(p, "utf8")));
    expect(m.activeBuild).toBe("12.1.0.69497");
    expect(m.builds["12.1.0.69497"].build).toBe(69497);
    expect(m.builds["12.1.0.69497"].status).toBe("active");
    expect(m.builds["12.1.0.69497"].expansion).toBe("Midnight");
  });

  it("retains the previous build, archived", () => {
    const m = parseBuildManifest(JSON.parse(fs.readFileSync(p, "utf8")));
    expect(m.builds["11.2.7.65299"].build).toBe(65299);
    expect(m.builds["11.2.7.65299"].status).toBe("archived");
  });

  it("retains at least one build present in the manifest", () => {
    const m = parseBuildManifest(JSON.parse(fs.readFileSync(p, "utf8")));
    expect(Object.values(m.builds).length).toBeGreaterThanOrEqual(1);
  });
});
