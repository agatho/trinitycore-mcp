/**
 * Listing and cross-build diffing over generated opcode tables.
 *
 * @module tools/opcodetools
 */

import { getOpcodeTable, loadOpcodeTable, OpcodeEntry, OpcodeTable } from "../opcodes/OpcodeTable";
import { OpcodeDirection } from "../opcodes/OpcodesCsParser";

export interface ListOpcodesResult {
  build: number;
  total: number;
  offset: number;
  limit: number;
  opcodes: OpcodeEntry[];
}

export interface MovedOpcode {
  name: string;
  from: string;
  to: string;
}

export interface OpcodeDiffResult {
  added: OpcodeEntry[];
  removed: OpcodeEntry[];
  moved: MovedOpcode[];
  summary: { added: number; removed: number; moved: number; unchanged: number };
  /**
   * Present only when `to` was mechanically generated from `from` (its
   * `source.derivedFrom` names `from`'s source directory). Explains why
   * `added`/`unchanged` in that case are artifacts of the derivation, not
   * observations about the real game builds. Absent for a pair of
   * independently-sourced tables.
   */
  note?: string;
}

const DEFAULT_LIMIT = 100;

/**
 * List opcodes in the active build's table, filtered by name substring,
 * direction and/or protocol family, with bounded pagination.
 *
 * @param args.pattern - Substring to match against opcode names (case-insensitive)
 * @param args.direction - Restrict to CMSG, SMSG or MSG
 * @param args.family - Restrict to a protocol family, e.g. "0x43"
 * @param args.offset - Pagination offset (default 0)
 * @param args.limit - Maximum results returned (default 100)
 * @returns The active build id, total match count, and the requested page of matches
 */
export async function listOpcodes(
  args: { pattern?: string; direction?: OpcodeDirection; family?: string; offset?: number; limit?: number } = {}
): Promise<ListOpcodesResult> {
  const table = getOpcodeTable();
  const offset = args.offset ?? 0;
  const limit = args.limit ?? DEFAULT_LIMIT;

  let matches: OpcodeEntry[] = args.family
    ? table.listFamily(args.family)
    : table.search(args.pattern ?? "", { direction: args.direction });

  if (args.family && args.direction) {
    matches = matches.filter((o) => o.direction === args.direction);
  }
  if (args.family && args.pattern) {
    const needle = args.pattern.toUpperCase();
    matches = matches.filter((o) => o.name.toUpperCase().includes(needle));
  }

  matches.sort((a, b) => a.name.localeCompare(b.name));

  return {
    build: table.build,
    total: matches.length,
    offset,
    limit,
    opcodes: matches.slice(offset, offset + limit),
  };
}

/** Pure diff over two opcode sets, keyed by name. */
export function computeDiff(from: OpcodeEntry[], to: OpcodeEntry[]): OpcodeDiffResult {
  const fromByName = new Map(from.map((o) => [o.name, o]));
  const toByName = new Map(to.map((o) => [o.name, o]));

  const added = to.filter((o) => !fromByName.has(o.name));
  const removed = from.filter((o) => !toByName.has(o.name));

  const moved: MovedOpcode[] = [];
  let unchanged = 0;

  for (const [name, before] of fromByName) {
    const after = toByName.get(name);
    if (!after) {
      continue;
    }
    if (before.value !== after.value) {
      moved.push({ name, from: before.hex, to: after.hex });
    } else {
      unchanged++;
    }
  }

  return {
    added,
    removed,
    moved,
    summary: { added: added.length, removed: removed.length, moved: moved.length, unchanged },
  };
}

/**
 * Detect whether `to`'s table was mechanically generated from `from` (as
 * opposed to two independently-sourced tables being compared), and if so,
 * build the note explaining what that means for the diff's `added` and
 * `unchanged` counts.
 *
 * The condition is read entirely from table metadata: `import-opcodes.js`
 * writes `source.derivedFrom` on a derived table as the source directory
 * name of the table it was derived from (e.g. `"V12_0_7_67808"`), which is
 * exactly the first path segment of that source table's own `source.file`
 * (e.g. `"V12_0_7_67808/Opcodes.cs"`). Matching on that — rather than on
 * hardcoded build ids — means a future derivation (12.2 from 12.1, etc.)
 * gets the same treatment automatically.
 *
 * Deliberately kept out of `computeDiff`: the note depends on table
 * provenance metadata that a pure entry-array diff has no business knowing
 * about. This function only reads `OpcodeTable.sourceInfo` and the summary
 * counts `computeDiff` already produced; it performs no diffing itself.
 */
function deriveDerivationNote(
  from: OpcodeTable,
  to: OpcodeTable,
  fromBuildId: string,
  toBuildId: string,
  diff: OpcodeDiffResult
): string | undefined {
  const derivedFrom = to.sourceInfo.derivedFrom;
  if (derivedFrom === null) {
    return undefined;
  }
  const fromSourceDir = from.sourceInfo.file.split("/")[0];
  if (derivedFrom !== fromSourceDir) {
    return undefined;
  }

  return (
    `The ${toBuildId} table was generated from ${fromBuildId} by applying a "${to.sourceInfo.method}" ` +
    `derivation (source.derivedFrom = "${derivedFrom}"), not independently extracted from a client for ` +
    `${toBuildId}. A table produced this way cannot contain names absent from its source, so this diff's ` +
    `added: ${diff.summary.added} is structurally guaranteed by how ${toBuildId} was built and is NOT ` +
    `evidence that the newer game build introduced no opcodes. Likewise unchanged: ${diff.summary.unchanged} ` +
    `only reports how many families this particular derivation happened to leave at a zero offset, not a ` +
    `discovery about which opcodes stayed stable between the two game builds. This diff shows the ` +
    `derivation's renumbering, not content differences independently observed between the two builds.`
  );
}

/**
 * Compare two builds' opcode tables by loading them from disk and diffing
 * the full entry sets by name. When `to` was mechanically derived from
 * `from` (see {@link deriveDerivationNote}), the result carries a `note`
 * explaining why `added`/`unchanged` reflect the derivation rather than the
 * real game builds.
 *
 * @param args.fromBuild - Baseline table id, e.g. "12.0.7.67808"
 * @param args.toBuild - Comparison table id, e.g. "12.1.0.69214"
 * @param args.dir - Table directory override, for tests; defaults to `data/opcodes`
 */
export async function diffOpcodes(
  args: { fromBuild: string; toBuild: string; dir?: string }
): Promise<OpcodeDiffResult> {
  const from = loadOpcodeTable(args.fromBuild, args.dir);
  const fromEntries = from.search("");
  const to = loadOpcodeTable(args.toBuild, args.dir);
  const toEntries = to.search("");
  const diff = computeDiff(fromEntries, toEntries);

  const note = deriveDerivationNote(from, to, args.fromBuild, args.toBuild, diff);
  return note ? { ...diff, note } : diff;
}
