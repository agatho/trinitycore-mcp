/**
 * Network opcode lookup, backed by the build's generated opcode table.
 *
 * Wire identity (name, value, direction, family, index, confidence, build)
 * comes from the generated `OpcodeTable`. Hand-written documentation
 * (description, structure, example) comes from `OPCODE_ANNOTATIONS` and is
 * merged onto whichever table entry matches by name.
 *
 * Some hand-written annotations document an opcode name that has no wire
 * value in the current build's table (e.g. chat opcodes renamed in modern
 * WoW, or `MSG_MOVE_*` opcodes absent from this build's `MiscOpcodes`
 * block). Those annotations are still returned — with a `note` explaining
 * the gap and no wire fields — rather than being reported as "not found".
 * Discarding still-meaningful documentation because a build's derivation
 * doesn't cover it would be a regression, not a cleanup.
 *
 * @module tools/opcode
 */

import { getOpcodeTable, OpcodeEntry } from "../opcodes/OpcodeTable";
import { OPCODE_ANNOTATIONS } from "../opcodes/annotations";

export interface OpcodeInfo {
  opcode: string;
  direction: "CMSG" | "SMSG" | "MSG";
  description: string;
  value?: number;
  hex?: string;
  family?: string;
  index?: string;
  confidence?: "high" | "medium" | null;
  build?: number;
  structure?: string;
  example?: string;
  suggestions?: string[];
  note?: string;
  error?: string;
}

/** Parse "0x430029" or "4390953" into a number; null when not numeric. */
function asValue(input: string): number | null {
  const trimmed = input.trim();
  if (/^0[xX][0-9A-Fa-f]+$/.test(trimmed)) {
    return parseInt(trimmed, 16);
  }
  if (/^\d+$/.test(trimmed)) {
    return Number(trimmed);
  }
  return null;
}

/** Derive a direction from an opcode's name prefix, for entries with no table row. */
function directionFromName(name: string): "CMSG" | "SMSG" | "MSG" {
  if (name.startsWith("CMSG")) return "CMSG";
  if (name.startsWith("SMSG")) return "SMSG";
  return "MSG";
}

/** Format the high 16 bits of a wire value as the protocol family channel. */
function familyOfValue(value: number): string {
  return `0x${(value >>> 16).toString(16).toUpperCase().padStart(2, "0")}`;
}

/** The low 16 bits of a wire value, as the within-family message index. */
function indexOfValue(value: number): number {
  return value & 0xffff;
}

/**
 * Look up an opcode by name, hex value (e.g. "0x430029") or decimal value
 * (e.g. "4390953").
 *
 * Name lookups fall back to annotation-only documentation when the name has
 * no wire value in the current build's table but does have hand-written
 * documentation. Value lookups that miss are diagnosed against the table's
 * unmapped-family and undetermined-index-range metadata before falling back
 * to a generic "no opcode at this value" response, so a known gap in the
 * 12.1 derivation is never reported as a plain absence.
 *
 * @param opcode Opcode name (e.g. "CMSG_CAST_SPELL") or value (e.g. "0x430029")
 */
export async function getOpcodeInfo(opcode: string): Promise<OpcodeInfo> {
  const table = getOpcodeTable();
  const value = asValue(opcode);

  if (value !== null) {
    const entry = table.lookupByValue(value);
    if (entry) {
      return merge(entry);
    }

    const family = familyOfValue(value);
    const index = indexOfValue(value);

    if (table.isUnmappedFamily(family)) {
      return {
        opcode: opcode.toUpperCase(),
        direction: "MSG",
        description: "Opcode family not resolved for this build",
        family,
        error:
          `Opcode family ${family} is present on the wire but its 12.1 shift is not uniquely determined, ` +
          `so no name can be assigned. This is a known gap in the derivation, not a missing opcode.`,
      };
    }

    if (table.isUndeterminedIndex(family, index)) {
      return {
        opcode: opcode.toUpperCase(),
        direction: "MSG",
        description: "Opcode index range not resolved for this build",
        family,
        error:
          `Opcode family ${family} index ${indexHex(index)} falls in a sub-range whose offset could not be ` +
          `decided in the 12.1 derivation. This is a known-unknown, not a missing opcode.`,
      };
    }

    return {
      opcode: opcode.toUpperCase(),
      direction: "MSG",
      description: "No opcode at this value",
      family,
      error: `No opcode with value ${opcode} in the table for build ${table.build}.`,
    };
  }

  const entry = table.lookupByName(opcode);
  if (entry) {
    return merge(entry);
  }

  const annotationOnlyName = Object.keys(OPCODE_ANNOTATIONS).find(
    (name) => name.toUpperCase() === opcode.toUpperCase()
  );
  if (annotationOnlyName) {
    const annotation = OPCODE_ANNOTATIONS[annotationOnlyName];
    return {
      opcode: annotationOnlyName,
      direction: directionFromName(annotationOnlyName),
      description: annotation.description,
      structure: annotation.structure,
      example: annotation.example,
      note:
        `Opcode "${annotationOnlyName}" is documented but has no wire value in the table for build ${table.build}. ` +
        `It may have been renamed, merged into another opcode, or removed in this build.`,
    };
  }

  const suggestions = table.suggestNames(opcode);
  return {
    opcode: opcode.toUpperCase(),
    direction: directionFromName(opcode.toUpperCase()),
    description: "Opcode not found",
    suggestions,
    error:
      `Opcode "${opcode}" is not in the table for build ${table.build}` +
      (suggestions.length ? `. Did you mean: ${suggestions.join(", ")}?` : "."),
  };
}

function indexHex(index: number): string {
  return `0x${index.toString(16).toUpperCase().padStart(3, "0")}`;
}

function merge(entry: OpcodeEntry): OpcodeInfo {
  const annotation = OPCODE_ANNOTATIONS[entry.name];
  return {
    opcode: entry.name,
    direction: entry.direction,
    description:
      annotation?.description ??
      `${entry.direction} opcode ${entry.hex} (family ${entry.family}, index ${entry.index})`,
    value: entry.value,
    hex: entry.hex,
    family: entry.family,
    index: entry.index,
    confidence: entry.confidence,
    build: entry.build,
    structure: annotation?.structure,
    example: annotation?.example,
  };
}
