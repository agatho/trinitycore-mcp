/**
 * Build manifest: the single declared source of truth for which WoW client
 * builds this server knows about, and where each build's data lives.
 *
 * @module version/BuildManifest
 */

import * as fs from "fs";
import * as path from "path";
import { logger } from "../utils/logger";

export interface BuildDataPaths {
  db2: string;
  dbc: string;
  gt: string;
  vmap: string;
  mmap: string;
  listfile: string;
}

export type BuildStatus = "active" | "archived" | "candidate";
export type DB2Format = "WDC3" | "WDC4" | "WDC5" | "WDC6";

export interface BuildEntry {
  /** Full version string, e.g. "12.1.0.69497". Injected from the map key. */
  id: string;
  build: number;
  product: string;
  expansion: string;
  status: BuildStatus;
  db2Format: DB2Format;
  dataPaths: BuildDataPaths;
  cacheDir: string;
  /** Opcode table id; may name a different build (see opcode subsystem spec). */
  opcodeTable?: string;
  /** True when synthesized from environment variables rather than read from disk. */
  synthesized?: boolean;
}

export interface BuildManifest {
  manifestVersion: number;
  activeBuild: string;
  builds: Record<string, BuildEntry>;
}

export class ManifestValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ManifestValidationError";
  }
}

const SUPPORTED_MANIFEST_VERSION = 1;
const REQUIRED_PATH_KEYS: Array<keyof BuildDataPaths> = ["db2", "dbc", "gt", "vmap", "mmap", "listfile"];
const VALID_STATUSES: BuildStatus[] = ["active", "archived", "candidate"];
const VALID_FORMATS: DB2Format[] = ["WDC3", "WDC4", "WDC5", "WDC6"];

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Validate and normalize a raw parsed manifest object.
 * @throws {ManifestValidationError} on any structural or semantic violation
 */
export function parseBuildManifest(raw: unknown): BuildManifest {
  if (!isRecord(raw)) {
    throw new ManifestValidationError("Build manifest must be a JSON object");
  }

  if (raw.manifestVersion !== SUPPORTED_MANIFEST_VERSION) {
    throw new ManifestValidationError(
      `Unsupported manifestVersion ${String(raw.manifestVersion)}; expected ${SUPPORTED_MANIFEST_VERSION}`
    );
  }

  if (typeof raw.activeBuild !== "string" || raw.activeBuild.length === 0) {
    throw new ManifestValidationError("Build manifest requires a non-empty activeBuild string");
  }

  if (!isRecord(raw.builds) || Object.keys(raw.builds).length === 0) {
    throw new ManifestValidationError("Build manifest requires a non-empty builds object");
  }

  const builds: Record<string, BuildEntry> = {};
  const seenBuildNumbers = new Map<number, string>();

  for (const [id, rawEntry] of Object.entries(raw.builds)) {
    if (!isRecord(rawEntry)) {
      throw new ManifestValidationError(`Build "${id}" must be an object`);
    }

    if (typeof rawEntry.build !== "number" || !Number.isInteger(rawEntry.build)) {
      throw new ManifestValidationError(`Build "${id}" requires an integer build number`);
    }

    const duplicate = seenBuildNumbers.get(rawEntry.build);
    if (duplicate !== undefined) {
      throw new ManifestValidationError(
        `Duplicate build number ${rawEntry.build} used by both "${duplicate}" and "${id}"`
      );
    }
    seenBuildNumbers.set(rawEntry.build, id);

    if (!VALID_STATUSES.includes(rawEntry.status as BuildStatus)) {
      throw new ManifestValidationError(
        `Build "${id}" has invalid status "${String(rawEntry.status)}"; expected one of ${VALID_STATUSES.join(", ")}`
      );
    }

    if (!VALID_FORMATS.includes(rawEntry.db2Format as DB2Format)) {
      throw new ManifestValidationError(
        `Build "${id}" has invalid db2Format "${String(rawEntry.db2Format)}"`
      );
    }

    if (!isRecord(rawEntry.dataPaths)) {
      throw new ManifestValidationError(`Build "${id}" requires a dataPaths object`);
    }
    for (const key of REQUIRED_PATH_KEYS) {
      if (typeof rawEntry.dataPaths[key] !== "string") {
        throw new ManifestValidationError(`Build "${id}" is missing dataPaths.${key}`);
      }
    }

    if (typeof rawEntry.cacheDir !== "string") {
      throw new ManifestValidationError(`Build "${id}" requires a cacheDir string`);
    }

    builds[id] = {
      id,
      build: rawEntry.build,
      product: typeof rawEntry.product === "string" ? rawEntry.product : "wow",
      expansion: typeof rawEntry.expansion === "string" ? rawEntry.expansion : "unknown",
      status: rawEntry.status as BuildStatus,
      db2Format: rawEntry.db2Format as DB2Format,
      dataPaths: rawEntry.dataPaths as unknown as BuildDataPaths,
      cacheDir: rawEntry.cacheDir,
      opcodeTable: typeof rawEntry.opcodeTable === "string" ? rawEntry.opcodeTable : undefined,
    };
  }

  const activeIds = Object.values(builds).filter((b) => b.status === "active").map((b) => b.id);
  if (activeIds.length !== 1) {
    throw new ManifestValidationError(
      `Build manifest must contain exactly one build with status "active"; found ${activeIds.length}` +
        (activeIds.length > 1 ? ` (${activeIds.join(", ")})` : "")
    );
  }

  if (!builds[raw.activeBuild]) {
    throw new ManifestValidationError(
      `activeBuild "${raw.activeBuild}" does not name any build in the manifest`
    );
  }

  if (builds[raw.activeBuild].status !== "active") {
    throw new ManifestValidationError(
      `activeBuild "${raw.activeBuild}" has status "${builds[raw.activeBuild].status}", expected "active"`
    );
  }

  return { manifestVersion: SUPPORTED_MANIFEST_VERSION, activeBuild: raw.activeBuild, builds };
}

/** Module-level manifest, populated by loadBuildManifest(). */
let manifest: BuildManifest | null = null;

/**
 * Default manifest location.
 *
 * Resolved relative to THIS MODULE first, then to the process working
 * directory. An MCP server is normally spawned over stdio by a client that
 * sets its own working directory, so a purely cwd-relative path silently
 * misses the manifest that ships with the installation and falls through to
 * {@link synthesizeFromEnv} — after which every build-scoped lookup (opcode
 * tables, per-build cache directories) resolves against a placeholder build
 * named "unknown". The cwd-relative path is kept as a fallback so a layout
 * that keeps `config/` somewhere other than next to the code still works.
 */
export const DEFAULT_MANIFEST_PATH = resolveDefaultManifestPath();

function resolveDefaultManifestPath(): string {
  const moduleRelative = path.resolve(__dirname, "..", "..", "config", "builds.json");
  if (fs.existsSync(moduleRelative)) {
    return moduleRelative;
  }
  return path.join("config", "builds.json");
}

/**
 * Build a single-build manifest from environment variables.
 *
 * This is the compatibility path: 179 registered tools read DB2_PATH and
 * friends directly, so an absent config/builds.json must not change behavior.
 */
export function synthesizeFromEnv(env: NodeJS.ProcessEnv): BuildManifest {
  const entry: BuildEntry = {
    id: "unknown",
    build: 0,
    product: "wow",
    expansion: "unknown",
    status: "active",
    db2Format: "WDC5",
    dataPaths: {
      db2: env.DB2_PATH || "./data/db2",
      dbc: env.DBC_PATH || "./data/dbc",
      gt: env.GT_PATH || "./data/gt",
      vmap: env.VMAP_PATH || "./data/vmaps",
      mmap: env.MMAP_PATH || "./data/mmaps",
      listfile: env.LISTFILE_PATH || "./data/listfile/listfile.csv",
    },
    cacheDir: "./data/cache",
    synthesized: true,
  };
  return { manifestVersion: SUPPORTED_MANIFEST_VERSION, activeBuild: "unknown", builds: { unknown: entry } };
}

/**
 * Load the build manifest from disk, or synthesize one from the environment
 * when the file is absent. Declared data paths that do not exist produce a
 * warning, never a failure — an archived build whose data was deleted is legitimate.
 */
export async function loadBuildManifest(manifestPath?: string): Promise<BuildManifest> {
  const target = manifestPath || DEFAULT_MANIFEST_PATH;

  if (!fs.existsSync(target)) {
    logger.warn(`Build manifest not found at ${target}; synthesizing from environment variables`);
    manifest = synthesizeFromEnv(process.env);
    return manifest;
  }

  let raw: unknown;
  try {
    raw = JSON.parse(await fs.promises.readFile(target, "utf8"));
  } catch (error) {
    throw new ManifestValidationError(`Failed to read build manifest at ${target}: ${String(error)}`);
  }

  manifest = parseBuildManifest(raw);

  for (const entry of Object.values(manifest.builds)) {
    for (const key of REQUIRED_PATH_KEYS) {
      const p = entry.dataPaths[key];
      if (!fs.existsSync(p)) {
        logger.warn(`Build "${entry.id}" declares ${key} path that does not exist: ${p}`);
      }
    }
  }

  logger.info(`Loaded build manifest: ${Object.keys(manifest.builds).length} build(s), active=${manifest.activeBuild}`);
  return manifest;
}

/**
 * True once the "no manifest loaded" fallback warning has fired for this
 * process. Ensures the warning is emitted at most once, even though
 * ensureManifest() may be called on every tool invocation.
 */
let warnedNoManifest = false;

/**
 * Return the loaded manifest, or synthesize one from `process.env` when
 * nothing has been loaded yet. This is the backward-compatibility path:
 * 179 registered tools call accessors like getActiveBuild() without ever
 * calling loadBuildManifest() during startup (see e.g.
 * tests/tools/gametable.test.ts, tests/tools/combatmechanics.test.ts,
 * tests/integration/DatabaseOperations.test.ts,
 * tests/integration/MCPToolRegistration.test.ts), so accessors must never
 * throw merely because the manifest was never loaded.
 */
function ensureManifest(): BuildManifest {
  if (!manifest) {
    if (!warnedNoManifest) {
      logger.warn(
        "Build manifest accessed before loadBuildManifest() was called; synthesizing from environment variables (DB2_PATH, DBC_PATH, GT_PATH, VMAP_PATH, MMAP_PATH, LISTFILE_PATH)."
      );
      warnedNoManifest = true;
    }
    manifest = synthesizeFromEnv(process.env);
  }
  return manifest;
}

export function getActiveBuild(): BuildEntry {
  const m = ensureManifest();
  return m.builds[m.activeBuild];
}

export function getBuild(id: string): BuildEntry | null {
  return ensureManifest().builds[id] || null;
}

export function listBuilds(): BuildEntry[] {
  return Object.values(ensureManifest().builds);
}

/**
 * Resolve a data directory for a build.
 * @param kind Which data path to resolve
 * @param buildId Build to resolve against; defaults to the active build
 * @throws Error when buildId names a build not in the manifest
 */
export function resolveDataPath(kind: keyof BuildDataPaths, buildId?: string): string {
  const entry = buildId ? getBuild(buildId) : getActiveBuild();
  if (!entry) {
    throw new Error(`Cannot resolve ${kind} path: no build "${buildId}" in the manifest`);
  }
  return entry.dataPaths[kind];
}

/** Test-only: clear module state between cases. */
export function resetManifestForTesting(): void {
  manifest = null;
  warnedNoManifest = false;
}
