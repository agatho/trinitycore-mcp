/**
 * Imports the 12.1 family-shift derivation's provenance.
 *
 * The derivation deliberately leaves some things undecided: two families whose
 * shift is not uniquely determined, and index ranges whose offset could not be
 * decided (null). Those are load-bearing statements about what is NOT known and
 * are preserved verbatim — never defaulted.
 *
 * @module opcodes/OpcodeProvenance
 */

export type ProvenanceCode = "wire" | "jam" | "interp" | "ambiguous";
export type Confidence = "high" | "medium";

export interface FamilyShift {
  shift: number;
  provenance: ProvenanceCode;
  clientFamily: string;
}

export interface IndexOffsetRange {
  catalogIndexFrom: string;
  /** null means the offset could not be decided for this range. */
  offset: number | null;
}

export interface OpcodeProvenance {
  familyShift: Record<string, FamilyShift>;
  indexOffsets: Record<string, IndexOffsetRange[]>;
  ambiguousFamilies: string[];
  meta: Record<string, unknown>;
}

const VALID_CODES: ProvenanceCode[] = ["wire", "jam", "interp", "ambiguous"];

const CONFIDENCE_BY_CODE: Record<ProvenanceCode, Confidence | null> = {
  wire: "high",
  jam: "high",
  interp: "medium",
  ambiguous: null,
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function parseProvenance(raw: unknown): OpcodeProvenance {
  if (!isRecord(raw) || !isRecord(raw.family_shift)) {
    throw new Error("Provenance file must contain a family_shift object");
  }

  const familyShift: Record<string, FamilyShift> = {};
  const ambiguousFamilies: string[] = [];

  for (const [family, entry] of Object.entries(raw.family_shift)) {
    if (!isRecord(entry)) {
      throw new Error(`family_shift.${family} must be an object`);
    }
    const code = entry.provenance;
    if (typeof code !== "string" || !VALID_CODES.includes(code as ProvenanceCode)) {
      throw new Error(
        `family_shift.${family} has invalid provenance "${String(code)}"; expected one of ${VALID_CODES.join(", ")}`
      );
    }
    if (typeof entry.shift !== "number") {
      throw new Error(`family_shift.${family} requires a numeric shift`);
    }

    familyShift[family] = {
      shift: entry.shift,
      provenance: code as ProvenanceCode,
      clientFamily: typeof entry.client_family === "string" ? entry.client_family : "",
    };

    if (code === "ambiguous") {
      ambiguousFamilies.push(family);
    }
  }

  const indexOffsets: Record<string, IndexOffsetRange[]> = {};
  if (isRecord(raw.index_offsets)) {
    for (const [family, ranges] of Object.entries(raw.index_offsets)) {
      if (!Array.isArray(ranges)) {
        throw new Error(`index_offsets.${family} must be an array`);
      }
      indexOffsets[family] = ranges.map((r) => {
        if (!isRecord(r)) {
          throw new Error(`index_offsets.${family} contains a non-object range`);
        }
        return {
          catalogIndexFrom: String(r.catalog_index_from),
          offset: r.offset === null ? null : Number(r.offset),
        };
      });
    }
  }

  return {
    familyShift,
    indexOffsets,
    ambiguousFamilies,
    meta: isRecord(raw._meta) ? raw._meta : {},
  };
}

/**
 * Confidence for a family, or null when the family is ambiguous or unrecorded.
 */
export function confidenceFor(prov: OpcodeProvenance, family: string): Confidence | null {
  const entry = prov.familyShift[family];
  if (!entry) {
    return null;
  }
  return CONFIDENCE_BY_CODE[entry.provenance];
}
