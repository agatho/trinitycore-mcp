/**
 * Listing and cross-build diffing over generated opcode tables.
 *
 * @module tools/opcodetools
 */

import { getOpcodeTable, loadOpcodeTable, OpcodeEntry } from "../opcodes/OpcodeTable";
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
 * Compare two builds' opcode tables by loading them from disk and diffing
 * the full entry sets by name.
 *
 * @param args.fromBuild - Baseline table id, e.g. "12.0.7.67808"
 * @param args.toBuild - Comparison table id, e.g. "12.1.0.69214"
 */
export async function diffOpcodes(args: { fromBuild: string; toBuild: string }): Promise<OpcodeDiffResult> {
  const from = loadOpcodeTable(args.fromBuild);
  const fromEntries = from.search("");
  const to = loadOpcodeTable(args.toBuild);
  const toEntries = to.search("");
  return computeDiff(fromEntries, toEntries);
}
