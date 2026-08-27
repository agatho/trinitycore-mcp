/**
 * Build manifest: the single declared source of truth for which WoW client
 * builds this server knows about, and where each build's data lives.
 *
 * @module version/BuildManifest
 */

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
