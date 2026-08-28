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

import { normalizeHexId, parseHexId } from "./HexId";

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
 * Confidence for a CATALOG family, or null when the family is ambiguous or
 * unrecorded.
 *
 * `family` must be a catalog-space identifier — the key space of
 * `familyShift`. Passing a family decoded from a CLIENT wire value here is a
 * namespace error: the two spaces overlap numerically (catalog 0x2E and client
 * 0x2E both exist and denote different things), so such a call returns a
 * plausible-looking but wrong answer rather than failing. Use
 * {@link ClientToCatalogIndex} for client-space input.
 *
 * The lookup is normalized on both sides, so `"0x3d"`, `"0X3D"` and `"3D"` all
 * resolve to the same catalog family.
 */
export function confidenceFor(prov: OpcodeProvenance, family: string): Confidence | null {
  const wanted = normalizeHexId(family);
  for (const [catalogFamily, entry] of Object.entries(prov.familyShift)) {
    if (normalizeHexId(catalogFamily) === wanted) {
      return CONFIDENCE_BY_CODE[entry.provenance];
    }
  }
  return null;
}

/**
 * The client half of a decided index range: the image, in CLIENT index space,
 * of one catalog index range whose offset the derivation decided.
 */
interface DecidedIndexImage {
  /** Inclusive lower bound in client index space. */
  from: number;
  /** Exclusive upper bound in client index space; `Infinity` for the last range. */
  to: number;
}

/**
 * Reverse map from a CLIENT wire slot (family + index) back to the CATALOG
 * slot it was derived from, so that a derived table's entries can be attributed
 * to the provenance that produced them.
 *
 * This exists because a derived opcode table's `family`/`index` are CLIENT wire
 * identifiers while `OpcodeProvenance.familyShift` and
 * `OpcodeProvenance.indexOffsets` are keyed by CATALOG identifiers. The two
 * spaces overlap numerically — catalog 0x2D shifts to client 0x2E, and catalog
 * 0x2E also exists — so reading a client family directly out of `familyShift`
 * silently attributes an entry to an unrelated catalog family. Every derived
 * entry must be attributed through this index instead.
 *
 * Two kinds of client slot deliberately resolve to "no attribution":
 *
 * - A client family with no catalog preimage. The derivation never claimed to
 *   produce it (the vendored table is known to diverge from the provenance
 *   formula in places), so no provenance code applies to it.
 * - A client index outside the image of every DECIDED catalog index range in
 *   its family. Those client indices can only have come from a range whose
 *   offset the derivation explicitly left undecided, so the catalog slot — and
 *   with it the provenance — is unknown.
 *
 * Both report `null`, which is the honest answer: unknown, not "low".
 */
export class ClientToCatalogIndex {
  /** Normalized client family -> normalized catalog family. */
  private readonly catalogByClientFamily = new Map<string, string>();
  /** Normalized client families claimed by more than one catalog family. */
  private readonly ambiguousClientFamilies = new Set<string>();
  /** Normalized catalog family -> its FamilyShift record. */
  private readonly shiftByCatalogFamily = new Map<string, FamilyShift>();
  /** Normalized catalog family -> client-space images of its decided ranges. */
  private readonly decidedImages = new Map<string, DecidedIndexImage[]>();

  constructor(prov: OpcodeProvenance) {
    for (const [catalogFamily, entry] of Object.entries(prov.familyShift)) {
      const catalog = normalizeHexId(catalogFamily);
      this.shiftByCatalogFamily.set(catalog, entry);

      // An ambiguous family has a null shift and therefore no computable
      // client family; the source records it as an empty string. Skip it —
      // registering "" would map every unparseable family to it.
      if (!entry.clientFamily) {
        continue;
      }
      const client = normalizeHexId(entry.clientFamily);
      const existing = this.catalogByClientFamily.get(client);
      if (existing !== undefined && existing !== catalog) {
        // Two catalog families claiming one client family makes the preimage
        // genuinely ambiguous. Record it and attribute nothing, rather than
        // letting insertion order pick a winner.
        this.ambiguousClientFamilies.add(client);
        continue;
      }
      this.catalogByClientFamily.set(client, catalog);
    }

    for (const [catalogFamily, ranges] of Object.entries(prov.indexOffsets)) {
      const catalog = normalizeHexId(catalogFamily);
      const images: DecidedIndexImage[] = [];
      for (let i = 0; i < ranges.length; i++) {
        const offset = ranges[i].offset;
        if (offset === null) {
          // Undecided: this catalog range has no known client image, so no
          // client index can be attributed to it.
          continue;
        }
        const from = parseHexId(ranges[i].catalogIndexFrom);
        if (from === null) {
          continue;
        }
        const nextFrom = i + 1 < ranges.length ? parseHexId(ranges[i + 1].catalogIndexFrom) : null;
        images.push({
          from: from + offset,
          to: nextFrom === null ? Infinity : nextFrom + offset,
        });
      }
      this.decidedImages.set(catalog, images);
    }
  }

  /**
   * The catalog family a client wire family was derived from, or null when the
   * derivation records no preimage for it.
   */
  catalogFamilyFor(clientFamily: string): string | null {
    const client = normalizeHexId(clientFamily);
    if (this.ambiguousClientFamilies.has(client)) {
      return null;
    }
    return this.catalogByClientFamily.get(client) ?? null;
  }

  /**
   * True when `clientIndex` falls inside the client-space image of a catalog
   * index range whose offset the derivation decided.
   *
   * A catalog family with no recorded index ranges has no index-granularity
   * ambiguity at all, so every index in it is decided.
   *
   * @param catalogFamily - Catalog family, as returned by {@link catalogFamilyFor}
   * @param clientIndex - Numeric within-family index decoded from the client value
   */
  isClientIndexDecided(catalogFamily: string, clientIndex: number): boolean {
    const images = this.decidedImages.get(normalizeHexId(catalogFamily));
    if (images === undefined) {
      return true;
    }
    return images.some((image) => clientIndex >= image.from && clientIndex < image.to);
  }

  /**
   * Confidence for a CLIENT wire slot, resolved through the catalog preimage.
   *
   * @param clientFamily - Family decoded from the client wire value, e.g. "0x2E"
   * @param clientIndex - Within-family index decoded from the client wire value
   * @returns The provenance-derived confidence, or null when the catalog slot
   *          is unknown (no family preimage, an ambiguous family, or an index
   *          in an undecided range)
   */
  confidenceFor(clientFamily: string, clientIndex: number): Confidence | null {
    const catalog = this.catalogFamilyFor(clientFamily);
    if (catalog === null) {
      return null;
    }
    if (!this.isClientIndexDecided(catalog, clientIndex)) {
      return null;
    }
    const entry = this.shiftByCatalogFamily.get(catalog);
    if (!entry) {
      return null;
    }
    return CONFIDENCE_BY_CODE[entry.provenance];
  }
}
