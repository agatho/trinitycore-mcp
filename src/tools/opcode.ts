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
 * A value lookup that misses is deliberately NOT diagnosed against
 * `OpcodeTable.isUnmappedCatalogFamily` / `isUndeterminedCatalogIndex`. Those
 * methods report gaps in the 12.0.7 CATALOG-space derivation, but a value
 * passed here is decoded into a CLIENT wire family/index — a different
 * namespace with no known mapping back to catalog space for exactly the
 * families/ranges those methods flag as undetermined. Comparing a client
 * family against a catalog-space "unmapped" list would silently assume the
 * catalog-to-client mapping those methods exist to say is unknown. A generic
 * miss carries a standing note about the table's known catalog-space gaps
 * instead, without attributing this specific miss to any of them.
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

/** Format the high 16 bits of a wire value as the protocol family channel, for display only. */
function familyOfValue(value: number): string {
  return `0x${(value >>> 16).toString(16).toUpperCase().padStart(2, "0")}`;
}

/**
 * Standing note attached to every generic value-lookup miss, explaining that
 * this table has known catalog-space gaps without attributing this specific
 * miss to any of them — see the module doc for why a client-decoded family
 * cannot be checked against those catalog-space gaps directly.
 */
const CATALOG_GAP_NOTE =
  "This table omits 193 catalog opcodes for known reasons: catalog families 0x2E and 0x35 " +
  "have undetermined 12.1 shifts, and 3 catalog index ranges have undecided offsets. A missing " +
  "value cannot be attributed to a specific gap, because the client-side family of an " +
  "undetermined catalog family is by definition unknown.";

/**
 * Look up an opcode by name, hex value (e.g. "0x430029") or decimal value
 * (e.g. "4390953").
 *
 * Name lookups fall back to annotation-only documentation when the name has
 * no wire value in the current build's table but does have hand-written
 * documentation. Value lookups that miss return a generic "no opcode at this
 * value" response with a standing note about the table's known catalog-space
 * gaps — see the module doc for why those gaps cannot be attributed to a
 * specific client-wire miss.
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

    return {
      opcode: opcode.toUpperCase(),
      direction: "MSG",
      description: "No opcode at this value",
      family,
      error: `No opcode with value ${opcode} in the table for build ${table.build}.`,
      note: CATALOG_GAP_NOTE,
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
