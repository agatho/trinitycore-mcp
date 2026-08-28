import * as fs from "fs";
import * as path from "path";
import { parseBuildManifest } from "../../src/version/BuildManifest";

// NOTE: This is Task 11a's version of this test. The brief (task-11-brief.md)
// specifies a version asserting a 12.1.0.69497 *active* build — that is
// Task 11b's cutover (extracting the 12.1 client, recording its layout
// hashes, and flipping activeBuild). Task 11a only stands up the manifest
// with the ARCHIVED 12.0.x build as active, so the assertions below check
// for build 65390 / id "12.0.x-20251222" instead. Task 11b should update
// this file again when it performs the actual cutover.
describe("config/builds.json", () => {
  const p = path.join(process.cwd(), "config", "builds.json");

  it("exists", () => {
    expect(fs.existsSync(p)).toBe(true);
  });

  it("is a valid manifest", () => {
    expect(() => parseBuildManifest(JSON.parse(fs.readFileSync(p, "utf8")))).not.toThrow();
  });

  it("declares the archived 12.0.x build as the active build", () => {
    const m = parseBuildManifest(JSON.parse(fs.readFileSync(p, "utf8")));
    expect(m.activeBuild).toBe("12.0.x-20251222");
    expect(m.builds["12.0.x-20251222"].build).toBe(65390);
  });

  it("retains at least one build present in the manifest", () => {
    const m = parseBuildManifest(JSON.parse(fs.readFileSync(p, "utf8")));
    expect(Object.values(m.builds).length).toBeGreaterThanOrEqual(1);
  });
});
