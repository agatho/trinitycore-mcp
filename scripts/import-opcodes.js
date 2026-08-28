#!/usr/bin/env node
/**
 * Import a WowPacketParser Opcodes.cs table into build-keyed JSON.
 *
 * Usage:
 *   node scripts/import-opcodes.js \
 *     --source "C:\\dumps\\wpp_tc\\WowPacketParser\\Enums\\Version\\V12_1_0_69214\\Opcodes.cs" \
 *     --provenance "C:\\dumps\\wow_family_shift_12_1.json" \
 *     --build 12.1.0.69214 \
 *     --derived-from V12_0_7_67808 \
 *     --out data/opcodes
 *
 * --provenance and --derived-from are optional (the 12.0.7 catalog is a source,
 * not a derivation, so it takes neither).
 */
const fs = require("fs");
const path = require("path");

const { parseOpcodesCs } = require("../dist/opcodes/OpcodesCsParser");
const { parseProvenance } = require("../dist/opcodes/OpcodeProvenance");

function arg(name, required) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1 || !process.argv[i + 1]) {
    if (required) {
      console.error(`Missing required argument --${name}`);
      process.exit(1);
    }
    return null;
  }
  return process.argv[i + 1];
}

const sourcePath = arg("source", true);
const provenancePath = arg("provenance", false);
const buildId = arg("build", true);
const derivedFrom = arg("derived-from", false);
const outDir = arg("out", false) || path.join("data", "opcodes");

const buildNumber = Number(buildId.split(".").pop());
if (!Number.isInteger(buildNumber)) {
  console.error(`Cannot derive a build number from --build "${buildId}"`);
  process.exit(1);
}

const parsed = parseOpcodesCs(fs.readFileSync(sourcePath, "utf8"));

// unmappedCatalogFamilies records CATALOG families (12.0.7 identifiers) whose
// SHIFT is not uniquely determined (the derivation's actual known-unknown).
// It is exactly the provenance's ambiguousFamilies list — nothing is added
// for families that simply contribute no opcodes to the parsed table, since
// "no opcodes" and "shift not determined" are different claims and padding
// this list with the former would misrepresent where the derivation's real
// gaps are. clientFamily is also unreliable for ambiguous families (their
// shift is null, so no client family can be computed), which rules out using
// it here. IMPORTANT: these are catalog-space identifiers, NOT client wire
// families — a client family whose shift is ambiguous has, by definition, no
// known catalog-to-client mapping, so these values must never be compared
// against a family decoded from a client wire value.
let unmappedCatalogFamilies = [];

// unmappedCatalogIndexRanges records, per CATALOG family, the sub-ranges of
// the catalog index space whose shift OFFSET could not be decided
// (provenance.indexOffsets entry with offset === null). This is
// index-granularity ambiguity, distinct from unmappedCatalogFamilies
// (family-granularity ambiguity) — an opcode landing inside one of these
// ranges has no reliable 12.1 mapping, but it is NOT a plain absence: the
// derivation deliberately could not decide, and that must stay visible to
// consumers rather than collapsing into "no opcode at this value".
// fromIndex is the null range's own catalogIndexFrom; toIndex is the next
// range's catalogIndexFrom in the same family (exclusive upper bound) if one
// exists, else null meaning "to the end of the family". These indices are
// CATALOG indices, not client wire indices.
let unmappedCatalogIndexRanges = [];

if (provenancePath) {
  const prov = parseProvenance(JSON.parse(fs.readFileSync(provenancePath, "utf8")));
  unmappedCatalogFamilies = prov.ambiguousFamilies;

  for (const [family, ranges] of Object.entries(prov.indexOffsets)) {
    for (let i = 0; i < ranges.length; i++) {
      if (ranges[i].offset === null) {
        const next = ranges[i + 1];
        unmappedCatalogIndexRanges.push({
          family,
          fromIndex: ranges[i].catalogIndexFrom,
          toIndex: next ? next.catalogIndexFrom : null,
        });
      }
    }
  }
  unmappedCatalogIndexRanges.sort((a, b) => {
    if (a.family !== b.family) {
      return a.family < b.family ? -1 : 1;
    }
    return parseInt(a.fromIndex, 16) - parseInt(b.fromIndex, 16);
  });

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, `${buildId}-provenance.json`),
    JSON.stringify(prov, null, 2),
    "utf8"
  );
}

const table = {
  build: buildNumber,
  version: buildId.split(".").slice(0, 3).join("."),
  source: {
    file: path.basename(path.dirname(sourcePath)) + "/" + path.basename(sourcePath),
    derivedFrom: derivedFrom || null,
    method: derivedFrom ? "family-shift" : "catalog",
    importedAt: new Date().toISOString(),
  },
  _note:
    "unmappedCatalogFamilies and unmappedCatalogIndexRanges are 12.0.7 CATALOG-space " +
    "identifiers (from the family-shift derivation's provenance), not client wire families. " +
    "A client wire family decoded from a value in this table's `opcodes` array must never be " +
    "compared against these lists — the catalog-to-client mapping for an ambiguous catalog " +
    "family is, by definition, unknown.",
  unmappedCatalogFamilies: unmappedCatalogFamilies.sort(),
  unmappedCatalogIndexRanges,
  counts: parsed.counts,
  opcodes: parsed.opcodes,
};

// A derived table's `opcodes` come from the vendored Opcodes.cs for the target
// build, NOT from applying the provenance formula to the catalog. Those two do
// not agree everywhere: the vendored file was produced by a later, refined
// derivation than the provenance documents. Recording that here so nobody
// later "corrects" the table to match the formula — the table is the observed
// artifact, the provenance is the earlier derivation's account of itself, and
// where they differ the table is what the client actually speaks.
if (derivedFrom) {
  table._derivationNote =
    "The `opcodes` in this table are the vendored WowPacketParser values for this build, not the " +
    "output of applying this build's provenance formula (client = ((catalog_family + family_shift) " +
    "<< 16) | (catalog_index + index_offset)) to the source catalog. The two do not agree " +
    "everywhere: the vendored table resolves many slots the provenance left undecided, and a " +
    "number of entries sit at values the formula does not predict. That divergence is expected — " +
    "the vendored file comes from a later, refined derivation. Do NOT rewrite entries to match " +
    "the provenance formula; the vendored values are the observed artifact and the provenance is " +
    "the earlier derivation's account of itself. Run tests/opcodes to see the measured coverage.";
}

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, `${buildId}.json`), JSON.stringify(table, null, 2), "utf8");

console.log(
  `Wrote ${outDir}/${buildId}.json — ${parsed.opcodes.length} opcodes ` +
    `(CMSG ${parsed.counts.CMSG}, SMSG ${parsed.counts.SMSG}, MSG ${parsed.counts.MSG}), ` +
    `${unmappedCatalogFamilies.length} unmapped catalog families, ${unmappedCatalogIndexRanges.length} unmapped catalog index ranges`
);
