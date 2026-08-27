/**
 * Runtime opcode table: name, value and family/index indices over a build's
 * generated opcode JSON, with provenance-derived confidence.
 *
 * @module opcodes/OpcodeTable
 */

import * as fs from "fs";
import * as path from "path";
import { OpcodeDirection, ParsedOpcode } from "./OpcodesCsParser";
import { Confidence, OpcodeProvenance, confidenceFor } from "./OpcodeProvenance";
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

export const DEFAULT_OPCODE_DIR = path.join("data", "opcodes");

export class OpcodeTable {
  private readonly byName = new Map<string, OpcodeEntry>();
  private readonly byValue = new Map<number, OpcodeEntry>();
  private readonly byFamily = new Map<string, OpcodeEntry[]>();

  constructor(
    private readonly file: OpcodeTableFile,
    private readonly provenance: OpcodeProvenance | null
  ) {
    for (const o of file.opcodes) {
      const entry: OpcodeEntry = {
        ...o,
        confidence: provenance ? confidenceFor(provenance, o.family) : null,
        build: file.build,
      };
      this.byName.set(o.name.toUpperCase(), entry);
      this.byValue.set(o.value, entry);
      const list = this.byFamily.get(o.family);
      if (list) {
        list.push(entry);
      } else {
        this.byFamily.set(o.family, [entry]);
      }
    }
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

  listFamily(family: string): OpcodeEntry[] {
    return this.byFamily.get(family.toUpperCase()) ?? this.byFamily.get(family) ?? [];
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
    return this.file.unmappedCatalogFamilies.includes(family.toUpperCase()) ||
      this.file.unmappedCatalogFamilies.includes(family);
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
    for (const range of this.file.unmappedCatalogIndexRanges) {
      if (range.family !== family) {
        continue;
      }
      const from = parseInt(range.fromIndex, 16);
      if (index < from) {
        continue;
      }
      if (range.toIndex === null) {
        return true;
      }
      const to = parseInt(range.toIndex, 16);
      if (index < to) {
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

let cached: OpcodeTable | null = null;

/**
 * Load a specific opcode table by id.
 * @throws Error naming the import command when the table file is absent
 */
export function loadOpcodeTable(tableId: string, dir: string = DEFAULT_OPCODE_DIR): OpcodeTable {
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

  cached = new OpcodeTable(file, provenance);
  return cached;
}

/**
 * The table for the active build. Uses BuildEntry.opcodeTable when set, since a
 * table generated for one build can apply to a later one; otherwise requires an
 * exact build-id match. Never selects a table by proximity.
 */
export function getOpcodeTable(): OpcodeTable {
  if (cached) {
    return cached;
  }
  const build = getActiveBuild();
  return loadOpcodeTable(build.opcodeTable || build.id);
}

/** Test-only: drop the cached table. */
export function resetOpcodeTableForTesting(): void {
  cached = null;
}
