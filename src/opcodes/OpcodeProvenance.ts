/**
 * Imports the 12.1 family-shift derivation's provenance.
 *
 * The derivation deliberately leaves some things undecided: two families whose
 * shift is not uniquely determined, and index ranges whose offset could not be
 * decided (null). Those are load-bearing statements about what is NOT known and
 * are preserved verbatim — never defaulted.
 *
 * The real source data (`wow_family_shift_12_1.json`) records an ambiguous family
 * with a DESCRIPTIVE provenance string (e.g. `"ambiguous: +1 or +2, never observed"`)
 * and a `null` shift. The descriptive suffix carries actual evidence (which shifts
 * remain possible) and is preserved verbatim in `provenanceDetail`; the normalized
 * `provenance` field collapses it to the bare code `"ambiguous"` for callers that
 * only need the category. A `null` shift is legal ONLY when the provenance is
 * ambiguous — a `null` shift paired with `wire`/`jam`/`interp` is a genuine
 * inconsistency in the source and must throw, never be silently accepted.
 *
 * @module opcodes/OpcodeProvenance
 */

export type ProvenanceCode = "wire" | "jam" | "interp" | "ambiguous";
export type Confidence = "high" | "medium";

export interface FamilyShift {
  /** null only when provenance is "ambiguous" — the shift is not uniquely determined. */
  shift: number | null;
  provenance: ProvenanceCode;
  /** The raw provenance string as recorded in the source, verbatim (e.g. "ambiguous: +1 or +2, never observed"). */
  provenanceDetail: string;
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

const EXACT_CODES: ProvenanceCode[] = ["wire", "jam", "interp"];
const AMBIGUOUS_PREFIX = "ambiguous";

const CONFIDENCE_BY_CODE: Record<ProvenanceCode, Confidence | null> = {
  wire: "high",
  jam: "high",
  interp: "medium",
  ambiguous: null,
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Normalizes a raw provenance string to its ProvenanceCode category.
 *
 * `wire`, `jam`, and `interp` must match exactly. Any string starting with
 * `"ambiguous"` (e.g. `"ambiguous: +1 or +2, never observed"`) normalizes to
 * `"ambiguous"` while the full string is preserved separately as `provenanceDetail`.
 * Anything else is unrecognized and must throw — a new code appearing in a future
 * derivation is exactly the moment a human needs to look, so this must never be
 * weakened to accept unknown values.
 */
function normalizeProvenanceCode(raw: string): ProvenanceCode | null {
  if ((EXACT_CODES as string[]).includes(raw)) {
    return raw as ProvenanceCode;
  }
  if (raw.startsWith(AMBIGUOUS_PREFIX)) {
    return "ambiguous";
  }
  return null;
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
    const rawCode = entry.provenance;
    if (typeof rawCode !== "string") {
      throw new Error(
        `family_shift.${family} has invalid provenance "${String(rawCode)}"; expected a string starting with one of wire, jam, interp, ambiguous`
      );
    }
    const code = normalizeProvenanceCode(rawCode);
    if (code === null) {
      throw new Error(
        `family_shift.${family} has invalid provenance "${rawCode}"; expected one of wire, jam, interp, or a string starting with "ambiguous"`
      );
    }

    const rawShift = entry.shift;
    let shift: number | null;
    if (rawShift === null) {
      if (code !== "ambiguous") {
        throw new Error(
          `family_shift.${family} has a null shift but provenance "${rawCode}" is not ambiguous; a null shift is only legal when provenance is ambiguous`
        );
      }
      shift = null;
    } else if (typeof rawShift === "number") {
      shift = rawShift;
    } else {
      throw new Error(`family_shift.${family} requires a numeric or null shift`);
    }

    familyShift[family] = {
      shift,
      provenance: code,
      provenanceDetail: rawCode,
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
