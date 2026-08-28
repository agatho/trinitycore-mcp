/**
 * Runtime opcode table: name, value and family/index indices over a build's
 * generated opcode JSON, with provenance-derived confidence.
 *
 * @module opcodes/OpcodeTable
 */

import * as fs from "fs";
import * as path from "path";
import { OpcodeDirection, ParsedOpcode } from "./OpcodesCsParser";
import {
  ClientToCatalogIndex,
  Confidence,
  OpcodeProvenance,
  confidenceFor,
} from "./OpcodeProvenance";
import { normalizeHexId, parseHexId } from "./HexId";
import { getActiveBuild } from "../version/BuildManifest";

export interface OpcodeEntry extends ParsedOpcode {
  confidence: Confidence | null;
  build: number;
}

/**
 * A sub-range of a CATALOG family's index space whose offset could not be
 * decided in the derivation that produced this table. `family` and
 * `fromIndex`/`toIndex` are 12.0.7 CATALOG-space identifiers, NOT client
 * wire families/indices — they must never be compared against a family or
 * index decoded from a client wire value. `fromIndex` is inclusive,
 * `toIndex` is EXCLUSIVE; a `null` `toIndex` means "to the end of the
 * family". This is a known-unknown, distinct from a plain absence: a
 * catalog-space lookup that lands in one of these ranges must be reported
 * as "undetermined", never collapsed into a generic "no opcode at this
 * value".
 */
export interface UnmappedCatalogIndexRange {
  family: string;
  fromIndex: string;
  toIndex: string | null;
}

interface OpcodeTableFile {
  build: number;
  version: string;
  source: { file: string; derivedFrom: string | null; method: string; importedAt: string };
  unmappedCatalogFamilies: string[];
  unmappedCatalogIndexRanges: UnmappedCatalogIndexRange[];
  counts: Record<OpcodeDirection, number>;
  opcodes: ParsedOpcode[];
}

/**
 * How far this table's name coverage falls short of the source catalog it was
 * derived from — measured on the ARTIFACTS, by comparing the two tables' name
 * sets, not read off the derivation's provenance.
 *
 * The distinction matters: the provenance describes which catalog slots the
 * derivation declined to map, but the vendored table was produced by a later,
 * refined derivation and does in fact carry concrete wire values for most of
 * them. Any user-facing statement about "opcodes this table omits" must come
 * from here, never from counting the provenance's undecided slots.
 */
export interface CatalogCoverageGap {
  /** Table id of the source catalog, e.g. "12.0.7.67808". */
  sourceTableId: string;
  /** Number of opcode names in the source catalog. */
  sourceNames: number;
  /** Number of opcode names in this table. */
  tableNames: number;
  /** Names present in the source catalog and absent from this table. */
  missingNames: number;
}

/**
 * Directory holding generated opcode tables.
 *
 * Resolved relative to this module first, so the tables are found regardless
 * of the working directory the server was spawned with (an MCP server started
 * over stdio from an unrelated directory would otherwise find nothing). Falls
 * back to the historical cwd-relative path when the module-relative directory
 * does not exist, which keeps a repository layout that moves the data
 * directory working.
 */
export const DEFAULT_OPCODE_DIR = resolveDefaultOpcodeDir();

function resolveDefaultOpcodeDir(): string {
  const moduleRelative = path.resolve(__dirname, "..", "..", "data", "opcodes");
  if (fs.existsSync(moduleRelative)) {
    return moduleRelative;
  }
  return path.join("data", "opcodes");
}

export class OpcodeTable {
  private readonly byName = new Map<string, OpcodeEntry>();
  private readonly byValue = new Map<number, OpcodeEntry>();
  /** Keyed by normalized family id — see {@link normalizeHexId}. */
  private readonly byFamily = new Map<string, OpcodeEntry[]>();

  /**
   * @param file - The parsed table file
   * @param provenance - The derivation's provenance, when one ships alongside
   * @param catalogGap - Measured name-coverage gap against the source catalog,
   *        or null when this table is itself a catalog (nothing to compare to)
   *        or the source catalog table is not available next to it
   */
  constructor(
    private readonly file: OpcodeTableFile,
    private readonly provenance: OpcodeProvenance | null,
    private readonly catalogGap: CatalogCoverageGap | null = null
  ) {
    // A DERIVED table's family/index are CLIENT wire identifiers, while the
    // provenance is keyed by CATALOG identifiers. The two spaces overlap
    // numerically, so confidence must be resolved through the client->catalog
    // reverse index; reading the provenance with a client family directly
    // attributes entries to unrelated catalog families. A non-derived catalog
    // table's identifiers ARE catalog identifiers, so it looks up directly.
    const derived = file.source.derivedFrom !== null;
    const reverse = provenance && derived ? new ClientToCatalogIndex(provenance) : null;

    for (const o of file.opcodes) {
      const entry: OpcodeEntry = {
        ...o,
        confidence: resolveConfidence(provenance, reverse, o),
        build: file.build,
      };
      this.byName.set(o.name.toUpperCase(), entry);
      this.byValue.set(o.value, entry);
      const familyKey = normalizeHexId(o.family);
      const list = this.byFamily.get(familyKey);
      if (list) {
        list.push(entry);
      } else {
        this.byFamily.set(familyKey, [entry]);
      }
    }
  }

  /**
   * Measured name-coverage gap against the source catalog this table was
   * derived from, or null when there is nothing to measure against.
   */
  get catalogCoverageGap(): CatalogCoverageGap | null {
    return this.catalogGap;
  }

  get build(): number {
    return this.file.build;
  }

  get sourceInfo(): OpcodeTableFile["source"] {
    return this.file.source;
  }

  get size(): number {
    return this.byName.size;
  }

  /**
   * Raw unmapped CATALOG index ranges from the source table, for callers
   * that need to report specifics. These are 12.0.7 catalog-space
   * identifiers, NOT client wire families/indices.
   */
  get unmappedCatalogIndexRanges(): UnmappedCatalogIndexRange[] {
    return this.file.unmappedCatalogIndexRanges;
  }

  lookupByName(name: string): OpcodeEntry | null {
    return this.byName.get(name.toUpperCase()) ?? null;
  }

  lookupByValue(value: number): OpcodeEntry | null {
    return this.byValue.get(value) ?? null;
  }

  /**
   * All entries in a protocol family.
   *
   * `family` is normalized before lookup, so `"0x3d"`, `"0X3D"`, `"3D"` and
   * `"0x03D"` all find the same family. (A previous `toUpperCase()`-then-raw
   * lookup turned `"0x3d"` into `"0X3D"`, which matched neither index key and
   * returned an empty list for a family that exists.)
   */
  listFamily(family: string): OpcodeEntry[] {
    return this.byFamily.get(normalizeHexId(family)) ?? [];
  }

  /**
   * True when `family` is a 12.0.7 CATALOG family whose 12.1 shift is not
   * uniquely determined. `family` must be a CATALOG identifier — a family
   * decoded from a client wire value is a different namespace and must
   * never be passed here; the catalog-to-client mapping for an ambiguous
   * catalog family is, by definition, unknown, so no such comparison could
   * ever be meaningful.
   */
  isUnmappedCatalogFamily(family: string): boolean {
    const wanted = normalizeHexId(family);
    return this.file.unmappedCatalogFamilies.some((f) => normalizeHexId(f) === wanted);
  }

  /**
   * True when `family`/`index` falls inside one of the unmapped CATALOG
   * index ranges carried by the source table — an index sub-range whose
   * offset the 12.1 derivation could not decide. `family` and `index` must
   * be CATALOG-space identifiers, NOT decoded from a client wire value.
   * `fromIndex` is inclusive, `toIndex` is EXCLUSIVE, and a `null` `toIndex`
   * means "to the end of the family".
   */
  isUndeterminedCatalogIndex(family: string, index: number): boolean {
    const wanted = normalizeHexId(family);
    for (const range of this.file.unmappedCatalogIndexRanges) {
      if (normalizeHexId(range.family) !== wanted) {
        continue;
      }
      const from = parseHexId(range.fromIndex);
      if (from === null || index < from) {
        continue;
      }
      if (range.toIndex === null) {
        return true;
      }
      const to = parseHexId(range.toIndex);
      if (to !== null && index < to) {
        return true;
      }
    }
    return false;
  }

  search(pattern: string, opts: { direction?: OpcodeDirection; limit?: number } = {}): OpcodeEntry[] {
    const needle = pattern.toUpperCase();
    const out: OpcodeEntry[] = [];
    for (const entry of this.byName.values()) {
      if (!entry.name.toUpperCase().includes(needle)) {
        continue;
      }
      if (opts.direction && entry.direction !== opts.direction) {
        continue;
      }
      out.push(entry);
      if (opts.limit && out.length >= opts.limit) {
        break;
      }
    }
    return out;
  }

  /** Up to 5 closest names by edit distance, for unknown-name errors. */
  suggestNames(name: string, max = 5): string[] {
    const needle = name.toUpperCase();
    return [...this.byName.keys()]
      .map((candidate) => ({ candidate, d: editDistance(needle, candidate) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, max)
      .filter((x) => x.d <= Math.max(3, Math.floor(needle.length / 3)))
      .map((x) => x.candidate);
  }
}

function editDistance(a: string, b: string): number {
  const prev = new Array<number>(b.length + 1);
  const cur = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) {
    prev[j] = j;
  }
  for (let i = 1; i <= a.length; i++) {
    cur[0] = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
    for (let j = 0; j <= b.length; j++) {
      prev[j] = cur[j];
    }
  }
  return prev[b.length];
}

/**
 * Confidence for one parsed opcode.
 *
 * A derived table resolves through the client->catalog reverse index; a
 * catalog table looks the family up directly. A table with no provenance
 * alongside has no confidence to report at all.
 */
function resolveConfidence(
  provenance: OpcodeProvenance | null,
  reverse: ClientToCatalogIndex | null,
  opcode: ParsedOpcode
): Confidence | null {
  if (!provenance) {
    return null;
  }
  if (reverse) {
    const index = parseHexId(opcode.index);
    return reverse.confidenceFor(opcode.family, index ?? Number.NaN);
  }
  return confidenceFor(provenance, opcode.family);
}

/**
 * Measure how many opcode names the source catalog carries that `file` lacks,
 * by locating the source catalog table next to it on disk.
 *
 * The source catalog is identified the same way {@link OpcodeTable.sourceInfo}
 * is used elsewhere: a derived table's `source.derivedFrom` holds the source
 * directory name of the table it came from (e.g. `"V12_0_7_67808"`), which is
 * the first path segment of that table's own `source.file`. Matching on that
 * rather than on hardcoded build ids means a future derivation is measured the
 * same way automatically.
 *
 * Returns null — never a guess — when the table is not derived, or when the
 * source catalog is not present in `dir`. A caller with no measurement must say
 * nothing about the gap rather than quote a number it cannot support.
 */
function measureCatalogGap(
  file: OpcodeTableFile,
  tableId: string,
  dir: string
): CatalogCoverageGap | null {
  const derivedFrom = file.source.derivedFrom;
  if (derivedFrom === null) {
    return null;
  }

  let candidates: string[];
  try {
    candidates = fs.readdirSync(dir);
  } catch {
    return null;
  }

  const tableNames = new Set(file.opcodes.map((o) => o.name.toUpperCase()));

  for (const entry of candidates) {
    if (!entry.endsWith(".json") || entry.endsWith("-provenance.json")) {
      continue;
    }
    const candidateId = entry.slice(0, -".json".length);
    if (candidateId === tableId) {
      continue;
    }

    let candidateFile: OpcodeTableFile;
    try {
      candidateFile = JSON.parse(fs.readFileSync(path.join(dir, entry), "utf8")) as OpcodeTableFile;
    } catch {
      continue;
    }
    if (!candidateFile.source || !Array.isArray(candidateFile.opcodes)) {
      continue;
    }
    if (candidateFile.source.file.split("/")[0] !== derivedFrom) {
      continue;
    }

    const missing = candidateFile.opcodes.filter((o) => !tableNames.has(o.name.toUpperCase()));
    return {
      sourceTableId: candidateId,
      sourceNames: candidateFile.opcodes.length,
      tableNames: file.opcodes.length,
      missingNames: missing.length,
    };
  }

  return null;
}

/**
 * Loaded tables, keyed by directory and table id.
 *
 * This is deliberately a map and not a single "last loaded" slot. A single
 * slot made any load repoint the whole process: `diffOpcodes` loads two tables
 * to compare them, and every later `getOpcodeTable()` in the process — opcode
 * lookups, listings, generated C++ packet handlers — then answered from
 * whichever table the diff happened to load second.
 */
const tables = new Map<string, OpcodeTable>();

function cacheKey(tableId: string, dir: string): string {
  return `${path.resolve(dir)}::${tableId}`;
}

/**
 * Load a specific opcode table by id, caching it under that id.
 *
 * Loading a table never changes which table {@link getOpcodeTable} returns —
 * that is resolved from the build manifest on every call.
 *
 * @param tableId - Table id, e.g. "12.1.0.69214"
 * @param dir - Directory holding generated tables; defaults to `data/opcodes`
 * @throws Error naming the import command when the table file is absent
 */
export function loadOpcodeTable(tableId: string, dir: string = DEFAULT_OPCODE_DIR): OpcodeTable {
  const key = cacheKey(tableId, dir);
  const hit = tables.get(key);
  if (hit) {
    return hit;
  }

  const tablePath = path.join(dir, `${tableId}.json`);
  if (!fs.existsSync(tablePath)) {
    throw new Error(
      `No opcode table for "${tableId}" at ${tablePath}. ` +
        `Generate it with: node scripts/import-opcodes.js --source <Opcodes.cs> --build ${tableId} --out ${dir}`
    );
  }

  const file = JSON.parse(fs.readFileSync(tablePath, "utf8")) as OpcodeTableFile;

  const provPath = path.join(dir, `${tableId}-provenance.json`);
  const provenance = fs.existsSync(provPath)
    ? (JSON.parse(fs.readFileSync(provPath, "utf8")) as OpcodeProvenance)
    : null;

  const table = new OpcodeTable(file, provenance, measureCatalogGap(file, tableId, dir));
  tables.set(key, table);
  return table;
}

/** How {@link resolveOpcodeTable} arrived at the table it returned. */
export interface OpcodeTableResolution {
  table: OpcodeTable;
  /**
   * Non-null when the table was NOT named by a build manifest but chosen by
   * fallback, and therefore may not match the client actually in use. Callers
   * that surface opcode data to a user must pass this on.
   */
  note: string | null;
}

/**
 * Table ids present in `dir`, newest build first.
 *
 * "Newest" is the trailing numeric segment of the table id, which is the
 * client build number the table was generated for.
 */
function availableTableIds(dir: string): string[] {
  let entries: string[];
  try {
    entries = fs.readdirSync(dir);
  } catch {
    return [];
  }
  return entries
    .filter((e) => e.endsWith(".json") && !e.endsWith("-provenance.json"))
    .map((e) => e.slice(0, -".json".length))
    .map((id) => ({ id, build: Number(id.split(".").pop()) }))
    .filter((x) => Number.isInteger(x.build))
    .sort((a, b) => b.build - a.build)
    .map((x) => x.id);
}

/**
 * Resolve the opcode table for the active build.
 *
 * Uses `BuildEntry.opcodeTable` when set, since a table generated for one
 * build can apply to a later one; otherwise requires an exact build-id match.
 * Never selects a table by proximity to a real build id.
 *
 * The one exception is a SYNTHESIZED build — the placeholder the manifest
 * layer produces when no `config/builds.json` was found. That build is named
 * `"unknown"`, which can never match a table, and throwing there would take
 * every opcode tool offline for a server merely started from an unexpected
 * working directory. In that case the newest available table is used and the
 * resolution carries a note saying so, because a tool that answers with a
 * stated caveat is more useful than one that throws.
 *
 * @throws Error naming the import command when no table can be resolved at all
 */
export function resolveOpcodeTable(): OpcodeTableResolution {
  const build = getActiveBuild();
  const wanted = build.opcodeTable || build.id;

  if (build.synthesized && !fs.existsSync(path.join(DEFAULT_OPCODE_DIR, `${wanted}.json`))) {
    const fallbackId = availableTableIds(DEFAULT_OPCODE_DIR)[0];
    if (fallbackId === undefined) {
      throw new Error(
        `No build manifest was found, so the active build is the synthesized placeholder ` +
          `"${build.id}", and no opcode table is available in ${DEFAULT_OPCODE_DIR} to fall back to. ` +
          `Provide config/builds.json, or generate a table with: node scripts/import-opcodes.js ` +
          `--source <Opcodes.cs> --build <id> --out ${DEFAULT_OPCODE_DIR}`
      );
    }
    return {
      table: loadOpcodeTable(fallbackId),
      note:
        `No build manifest was found (expected config/builds.json), so the active build is a ` +
        `synthesized placeholder with no opcode table named. Opcode table "${fallbackId}" was ` +
        `chosen by fallback as the newest available in ${DEFAULT_OPCODE_DIR}; it may not match ` +
        `the client this server is actually serving. Add config/builds.json to make the choice explicit.`,
    };
  }

  return { table: loadOpcodeTable(wanted), note: null };
}

/**
 * The table for the active build.
 *
 * Always resolved through the build manifest — loading some other table
 * elsewhere in the process (a cross-build diff, for instance) does not change
 * what this returns.
 */
export function getOpcodeTable(): OpcodeTable {
  return resolveOpcodeTable().table;
}

/** Test-only: drop every cached table. */
export function resetOpcodeTableForTesting(): void {
  tables.clear();
}
