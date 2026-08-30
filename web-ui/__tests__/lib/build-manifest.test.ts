/**
 * Tests for the web UI's build manifest reader.
 *
 * The web UI used to infer data paths from environment variables, so after a
 * build cutover its settings page showed the previous build's directories while
 * the MCP tools read the new build's. These tests pin the behaviour that fixed
 * that: the manifest decides, the environment is only a fallback, and a missing
 * or malformed manifest degrades rather than throwing.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import {
  readBuildManifest,
  checkDataPaths,
  resolveBuildDataPath,
} from "@/lib/build-manifest";

let root: string;
let manifestFile: string;
let db2Dir: string;
const originalManifestEnv = process.env.MCP_MANIFEST_PATH;

function writeManifest(contents: unknown): void {
  fs.writeFileSync(manifestFile, JSON.stringify(contents), "utf8");
}

function validManifest(): unknown {
  return {
    manifestVersion: 1,
    activeBuild: "12.1.0.69497",
    builds: {
      "12.1.0.69497": {
        build: 69497,
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
        cacheDir: "data/cache/69497",
        opcodeTable: "12.1.0.69214",
      },
      "11.2.7.65299": {
        build: 65299,
        product: "wow",
        expansion: "The War Within",
        status: "archived",
        db2Format: "WDC5",
        dataPaths: {
          db2: path.join(root, "old"),
          dbc: path.join(root, "old"),
          gt: path.join(root, "old-gt"),
          vmap: path.join(root, "old-vmaps"),
          mmap: path.join(root, "old-mmaps"),
          listfile: path.join(root, "old-listfile.csv"),
        },
        cacheDir: "data/cache/65299",
      },
    },
  };
}

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "webui-manifest-"));
  manifestFile = path.join(root, "builds.json");
  db2Dir = path.join(root, "dbc");
  fs.mkdirSync(db2Dir, { recursive: true });
  fs.mkdirSync(path.join(root, "gt"), { recursive: true });
  process.env.MCP_MANIFEST_PATH = manifestFile;
});

afterEach(() => {
  if (originalManifestEnv === undefined) {
    delete process.env.MCP_MANIFEST_PATH;
  } else {
    process.env.MCP_MANIFEST_PATH = originalManifestEnv;
  }
  fs.rmSync(root, { recursive: true, force: true });
});

describe("readBuildManifest", () => {
  it("returns the build named by activeBuild", () => {
    writeManifest(validManifest());
    const info = readBuildManifest();

    expect(info).not.toBeNull();
    expect(info!.activeBuild.id).toBe("12.1.0.69497");
    expect(info!.activeBuild.build).toBe(69497);
    expect(info!.activeBuild.expansion).toBe("Midnight");
  });

  it("returns every declared build, not only the active one", () => {
    writeManifest(validManifest());
    const info = readBuildManifest();

    expect(info!.builds.map((b) => b.id).sort()).toEqual(["11.2.7.65299", "12.1.0.69497"]);
  });

  it("returns null when no manifest exists", () => {
    expect(readBuildManifest()).toBeNull();
  });

  it("returns null rather than throwing on a malformed manifest", () => {
    fs.writeFileSync(manifestFile, "{ not json", "utf8");
    expect(readBuildManifest()).toBeNull();
  });

  it("falls back to the build marked active when activeBuild names nothing", () => {
    const manifest = validManifest() as { activeBuild: string };
    manifest.activeBuild = "12.9.9.99999";
    writeManifest(manifest);

    expect(readBuildManifest()!.activeBuild.id).toBe("12.1.0.69497");
  });
});

describe("checkDataPaths", () => {
  it("reports which declared directories are present", () => {
    writeManifest(validManifest());
    const info = readBuildManifest()!;
    const statuses = checkDataPaths(info.activeBuild);

    const byKind = Object.fromEntries(statuses.map((s) => [s.kind, s.exists]));
    expect(byKind.db2).toBe(true); // created in beforeEach
    expect(byKind.gt).toBe(true);
    expect(byKind.vmap).toBe(false); // never created
  });

  it("covers every path the build declares", () => {
    writeManifest(validManifest());
    const statuses = checkDataPaths(readBuildManifest()!.activeBuild);
    expect(statuses.map((s) => s.kind).sort()).toEqual([
      "db2",
      "dbc",
      "gt",
      "listfile",
      "mmap",
      "vmap",
    ]);
  });
});

describe("resolveBuildDataPath", () => {
  it("prefers the active build over the environment fallback", () => {
    writeManifest(validManifest());
    expect(resolveBuildDataPath("db2", "M:/stale/db2")).toBe(db2Dir);
  });

  it("uses the fallback when no manifest is available", () => {
    expect(resolveBuildDataPath("db2", "M:/fallback/db2")).toBe("M:/fallback/db2");
  });

  it("returns undefined when neither source has a path", () => {
    expect(resolveBuildDataPath("db2")).toBeUndefined();
  });
});
