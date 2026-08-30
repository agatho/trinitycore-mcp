/**
 * Server-side reader for the MCP server's build manifest.
 *
 * `config/builds.json` decides which client build every MCP tool reads. The web
 * UI used to infer data paths from environment variables instead, so after a
 * build cutover its settings page showed one build's directories while the
 * tools read another's.
 *
 * This reads the same file the server does, so both agree by construction. It
 * is deliberately small: the web UI needs to know which build is active and
 * where its data lives, not to validate or write the manifest.
 *
 * Server-only - it touches the filesystem, so import it from route handlers and
 * server components, never from a client component.
 *
 * @module lib/build-manifest
 */

import * as fs from "fs";
import * as path from "path";

/** Data directories a build declares. Mirrors the server's BuildDataPaths. */
export interface BuildDataPaths {
  db2: string;
  dbc: string;
  gt: string;
  vmap: string;
  mmap: string;
  listfile: string;
}

export interface BuildEntry {
  id: string;
  build: number;
  product: string;
  expansion: string;
  status: "active" | "archived" | "candidate";
  db2Format: string;
  dataPaths: BuildDataPaths;
  cacheDir: string;
  opcodeTable?: string;
}

export interface BuildManifestInfo {
  /** Build every MCP tool reads unless given an explicit build id. */
  activeBuild: BuildEntry;
  /** Every declared build, active and otherwise. */
  builds: BuildEntry[];
  /** Absolute path of the manifest that was read. */
  manifestPath: string;
}

/**
 * Where the manifest lives, relative to the web UI's working directory.
 *
 * Next.js runs with the cwd at `web-ui/`, so the manifest sits one level up.
 * MCP_MANIFEST_PATH overrides it for deployments that split the two apart.
 */
function manifestPath(): string {
  return process.env.MCP_MANIFEST_PATH || path.join(process.cwd(), "..", "config", "builds.json");
}

/**
 * Read the build manifest.
 *
 * @returns The active build and every declared build, or null when the manifest
 *   is absent or unreadable - the web UI must still render without it
 *
 * @example
 * ```typescript
 * const info = readBuildManifest();
 * const db2Dir = info?.activeBuild.dataPaths.db2;
 * ```
 */
export function readBuildManifest(): BuildManifestInfo | null {
  const file = manifestPath();

  try {
    if (!fs.existsSync(file)) {
      return null;
    }

    const raw = JSON.parse(fs.readFileSync(file, "utf8"));
    const builds: BuildEntry[] = Object.entries(raw.builds || {}).map(
      ([id, entry]) => ({ id, ...(entry as Omit<BuildEntry, "id">) })
    );

    const activeBuild =
      builds.find((b) => b.id === raw.activeBuild) || builds.find((b) => b.status === "active");

    if (!activeBuild) {
      return null;
    }

    return { activeBuild, builds, manifestPath: file };
  } catch {
    // A malformed manifest must not take the settings page down with it.
    return null;
  }
}

/** One data directory, with whether it is present on this machine. */
export interface DataPathStatus {
  kind: keyof BuildDataPaths;
  path: string;
  exists: boolean;
}

/**
 * Check which of the active build's data directories are actually present.
 *
 * A missing directory is the usual reason a page renders empty, so the settings
 * view shows it rather than leaving the reader to guess.
 *
 * @param build Build whose paths to check
 * @returns One entry per declared path
 */
export function checkDataPaths(build: BuildEntry): DataPathStatus[] {
  const kinds = Object.keys(build.dataPaths) as (keyof BuildDataPaths)[];
  return kinds.map((kind) => {
    const target = build.dataPaths[kind];
    let exists = false;
    try {
      exists = Boolean(target) && fs.existsSync(target);
    } catch {
      exists = false;
    }
    return { kind, path: target, exists };
  });
}

/**
 * Resolve one data path for the active build, falling back to a legacy
 * environment variable only when no manifest is available.
 *
 * The manifest outranks the environment on purpose: path variables are set once
 * and forgotten, so after a cutover they name the previous build.
 *
 * @param kind Which data directory is wanted
 * @param envFallback Value to use when no manifest resolves
 * @returns The directory, or undefined when neither source has one
 */
export function resolveBuildDataPath(
  kind: keyof BuildDataPaths,
  envFallback?: string
): string | undefined {
  const info = readBuildManifest();
  const fromManifest = info?.activeBuild.dataPaths[kind];
  return fromManifest || envFallback || undefined;
}
