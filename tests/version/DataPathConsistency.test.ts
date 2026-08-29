/**
 * Tests for the manifest / environment data-path consistency check.
 *
 * The check exists because DB2_PATH and its siblings are set once and forgotten,
 * so after a build cutover they name the previous build's directories. What
 * matters is that a genuine disagreement is reported and that cosmetic
 * differences in how a path is written are not.
 */

import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import {
  findDataPathDisagreements,
  describeDataPathDisagreements,
} from "../../src/version/DataPathConsistency";
import { loadBuildManifest, resetManifestForTesting } from "../../src/version/BuildManifest";

const BUILD = 69497;
const DB2_DIR = "M:\\World of Warcraft\\dbc\\enUS";
const VMAP_DIR = "M:\\World of Warcraft\\vmaps";

let root: string;
let manifestPath: string;

beforeEach(async () => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "path-consistency-"));
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
            db2: DB2_DIR,
            dbc: DB2_DIR,
            gt: "M:\\World of Warcraft\\gt",
            vmap: VMAP_DIR,
            mmap: "M:\\World of Warcraft\\mmaps",
            listfile: "M:\\listfile.csv",
          },
          cacheDir: path.join(root, "cache"),
          opcodeTable: "12.1.0.69214",
        },
      },
    }),
    "utf8"
  );
  resetManifestForTesting();
  await loadBuildManifest(manifestPath);
});

afterEach(() => {
  resetManifestForTesting();
  fs.rmSync(root, { recursive: true, force: true });
});

describe("findDataPathDisagreements", () => {
  it("reports nothing when no path variables are set", () => {
    expect(findDataPathDisagreements({})).toEqual([]);
  });

  it("reports nothing when a variable matches the active build", () => {
    expect(findDataPathDisagreements({ DB2_PATH: DB2_DIR })).toEqual([]);
  });

  it("reports a variable left pointing at the previous build", () => {
    const found = findDataPathDisagreements({
      DB2_PATH: "M:\\Wplayerbot\\data\\dbc\\enUS",
    });
    expect(found).toHaveLength(1);
    expect(found[0].envVar).toBe("DB2_PATH");
    expect(found[0].kind).toBe("db2");
    expect(found[0].buildValue).toBe(DB2_DIR);
  });

  it("reports every disagreeing variable", () => {
    const found = findDataPathDisagreements({
      DB2_PATH: "M:\\old\\dbc",
      VMAP_PATH: "M:\\old\\vmaps",
      MMAP_PATH: "M:\\World of Warcraft\\mmaps", // agrees
    });
    expect(found.map((d) => d.envVar).sort()).toEqual(["DB2_PATH", "VMAP_PATH"]);
  });

  it("accepts a path written with forward slashes", () => {
    expect(findDataPathDisagreements({ VMAP_PATH: "M:/World of Warcraft/vmaps" })).toEqual([]);
  });

  it("accepts a trailing separator and differing case", () => {
    expect(
      findDataPathDisagreements({ VMAP_PATH: "m:\\world of warcraft\\vmaps\\" })
    ).toEqual([]);
  });

  it("ignores an empty variable rather than calling it a disagreement", () => {
    expect(findDataPathDisagreements({ DB2_PATH: "" })).toEqual([]);
  });
});

describe("describeDataPathDisagreements", () => {
  it("says nothing when everything agrees", () => {
    expect(describeDataPathDisagreements([])).toEqual([]);
  });

  it("names the variable, its value and the build's value", () => {
    const lines = describeDataPathDisagreements(
      findDataPathDisagreements({ DB2_PATH: "M:\\Wplayerbot\\data\\dbc\\enUS" })
    );
    const text = lines.join("\n");
    expect(text).toContain("DB2_PATH");
    expect(text).toContain("M:\\Wplayerbot\\data\\dbc\\enUS");
    expect(text).toContain(DB2_DIR);
    expect(text).toContain(String(BUILD));
  });
});
