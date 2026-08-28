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

import { OpcodeEntry, OpcodeTable, resolveOpcodeTable } from "../opcodes/OpcodeTable";
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
 * Standing note attached to every generic value-lookup miss.
 *
 * The coverage figure is MEASURED from the artifacts — this table's name set
 * against the source catalog's — and never quoted from the derivation's
 * provenance. The two disagree substantially: the provenance describes 193
 * catalog slots the family-shift derivation declined to map, but the vendored
 * table was produced by a later, refined derivation and carries concrete wire
 * values for most of them. Stating the provenance's intentions as if they
 * described the shipped table told users a number the data refutes.
 *
 * The second half explains why the miss still cannot be pinned to a named gap
 * — see the module doc for the namespace argument.
 */
function catalogGapNote(table: OpcodeTable): string {
  const gap = table.catalogCoverageGap;
  const attribution =
    "A value that is not in this table still cannot be attributed to a specific derivation gap: " +
    "the family decoded from a wire value is a CLIENT-space identifier, and the catalog-space " +
    "families and index ranges the derivation left undecided have, by definition, no known " +
    "client-space image.";

  if (!gap) {
    return (
      `This table's name coverage could not be measured — no source catalog table is available ` +
      `beside it — so no count of omitted opcodes is quoted. ${attribution}`
    );
  }

  return (
    `This table carries ${gap.tableNames} of the ${gap.sourceNames} opcode names in the ` +
    `${gap.sourceTableId} catalog it was derived from; ${gap.missingNames} of those names have no ` +
    `entry here. That figure is measured against the two tables, not read off the derivation's ` +
    `provenance, which describes more undecided slots than the shipped table actually omits. ` +
    `${attribution}`
  );
}

/** Combine the table-selection caveat, when present, with a lookup note. */
function withSelectionNote(selectionNote: string | null, note: string): string {
  return selectionNote ? `${selectionNote} ${note}` : note;
}

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
  const { table, note: selectionNote } = resolveOpcodeTable();
  const value = asValue(opcode);

  if (value !== null) {
    const entry = table.lookupByValue(value);
    if (entry) {
      return merge(entry, selectionNote);
    }

    const family = familyOfValue(value);

    return {
      opcode: opcode.toUpperCase(),
      direction: "MSG",
      description: "No opcode at this value",
      family,
      error: `No opcode with value ${opcode} in the table for build ${table.build}.`,
      note: withSelectionNote(selectionNote, catalogGapNote(table)),
    };
  }

  const entry = table.lookupByName(opcode);
  if (entry) {
    return merge(entry, selectionNote);
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
      note: withSelectionNote(
        selectionNote,
        `Opcode "${annotationOnlyName}" is documented but has no wire value in the table for build ${table.build}. ` +
          `It may have been renamed, merged into another opcode, or removed in this build.`
      ),
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

function merge(entry: OpcodeEntry, selectionNote: string | null): OpcodeInfo {
  const annotation = OPCODE_ANNOTATIONS[entry.name];
  return {
    ...(selectionNote ? { note: selectionNote } : {}),
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
