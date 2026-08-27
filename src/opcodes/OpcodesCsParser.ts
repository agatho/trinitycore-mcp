/**
 * Parses WowPacketParser Opcodes.cs tables into structured opcode records.
 *
 * The source file declares up to three BiDictionary blocks — ClientOpcodes,
 * ServerOpcodes and MiscOpcodes. An entry's direction comes from its
 * containing block, which is authoritative; a name prefix is only convention.
 *
 * @module opcodes/OpcodesCsParser
 */

export type OpcodeDirection = "CMSG" | "SMSG" | "MSG";

export interface ParsedOpcode {
  name: string;
  value: number;
  hex: string;
  direction: OpcodeDirection;
  family: string;
  index: string;
}

export interface ParsedOpcodeFile {
  opcodes: ParsedOpcode[];
  counts: Record<OpcodeDirection, number>;
}

export class OpcodesParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OpcodesParseError";
  }
}

const BLOCK_DIRECTIONS: Array<{ marker: string; direction: OpcodeDirection }> = [
  { marker: "ClientOpcodes", direction: "CMSG" },
  { marker: "ServerOpcodes", direction: "SMSG" },
  { marker: "MiscOpcodes", direction: "MSG" },
];

const BLOCK_START = /private\s+static\s+readonly\s+BiDictionary<Opcode,\s*int>\s+(\w+)\s*=\s*new\(\)/;
const ENTRY = /^\s*\{\s*Opcode\.([A-Za-z0-9_]+)\s*,\s*(0[xX][0-9A-Fa-f]+|\d+)\s*\}\s*,?\s*$/;

/** Format the high 16 bits as the protocol family channel. */
function familyOf(value: number): string {
  return `0x${(value >>> 16).toString(16).toUpperCase().padStart(2, "0")}`;
}

/** Format the low 16 bits as the within-family message index. */
function indexOf(value: number): string {
  return `0x${(value & 0xffff).toString(16).toUpperCase().padStart(3, "0")}`;
}

/**
 * Parse an Opcodes.cs file.
 * @throws {OpcodesParseError} when no blocks are found, an entry is malformed,
 *         or a name appears twice. Never returns a partial table.
 */
export function parseOpcodesCs(content: string): ParsedOpcodeFile {
  const lines = content.split(/\r?\n/);
  const opcodes: ParsedOpcode[] = [];
  const seen = new Map<string, number>();

  let currentDirection: OpcodeDirection | null = null;
  let blocksFound = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const blockMatch = BLOCK_START.exec(line);
    if (blockMatch) {
      const found = BLOCK_DIRECTIONS.find((b) => b.marker === blockMatch[1]);
      currentDirection = found ? found.direction : null;
      if (found) {
        blocksFound++;
      }
      continue;
    }

    if (currentDirection === null) {
      continue;
    }

    if (/^\s*\};?\s*$/.test(line)) {
      currentDirection = null;
      continue;
    }

    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith("//")) {
      continue;
    }

    // The initializer's opening brace (`= new()` on one line, `{` on the
    // next) is not an entry — only lines shaped like `{ Opcode.X, val },`
    // are. Skip a bare `{` so it isn't fed to the entry regex.
    if (trimmed === "{") {
      continue;
    }

    // Every other non-blank, non-comment, non-closing-brace line inside a
    // block must be an entry. Do NOT silently skip anything else here —
    // an unrecognized line inside a block is exactly the "quietly
    // incomplete table" failure this parser exists to make impossible.
    const entry = ENTRY.exec(line);
    if (!entry) {
      throw new OpcodesParseError(
        `Malformed opcode entry at line ${i + 1}: ${line.trim()}`
      );
    }

    const name = entry[1];
    const value = Number(entry[2]);
    if (!Number.isFinite(value)) {
      throw new OpcodesParseError(`Unparseable opcode value at line ${i + 1}: ${line.trim()}`);
    }

    const previous = seen.get(name);
    if (previous !== undefined) {
      throw new OpcodesParseError(
        `Duplicate opcode name ${name} at line ${i + 1} (first seen at line ${previous})`
      );
    }
    seen.set(name, i + 1);

    opcodes.push({
      name,
      value,
      hex: `0x${value.toString(16).toUpperCase().padStart(6, "0")}`,
      direction: currentDirection,
      family: familyOf(value),
      index: indexOf(value),
    });
  }

  if (blocksFound === 0) {
    throw new OpcodesParseError("No BiDictionary<Opcode, int> blocks found; is this an Opcodes.cs file?");
  }

  const counts: Record<OpcodeDirection, number> = { CMSG: 0, SMSG: 0, MSG: 0 };
  for (const o of opcodes) {
    counts[o.direction]++;
  }

  return { opcodes, counts };
}
