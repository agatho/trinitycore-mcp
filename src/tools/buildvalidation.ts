/**
 * Validates that every registered DB2 schema matches the extracted data for a
 * build. Run this after extraction and before switching activeBuild.
 *
 * @module tools/buildvalidation
 */

import * as fs from "fs";
import * as path from "path";
import { SchemaFactory } from "../parsers/schemas/SchemaFactory";
import { checkSchemaLayout, SchemaLayoutMismatchError } from "../version/SchemaBuildGate";
import { getActiveBuild, getBuild, resolveDataPath } from "../version/BuildManifest";
import { resolveClientBuild, checkBuildDrift } from "../version/ClientBuildInfo";
import { logger } from "../utils/logger";

export type ValidationStatus = "verified" | "unverified" | "mismatch" | "missing";

export interface SchemaValidationRow {
  schema: string;
  file: string;
  status: ValidationStatus;
  detail?: string;
}

export interface ValidationSummary {
  ok: boolean;
  verified: number;
  unverified: number;
  mismatch: number;
  missing: number;
}

export interface BuildValidationReport {
  build: string;
  buildNumber: number;
  drift?: string;
  rows: SchemaValidationRow[];
  summary: ValidationSummary;
}

/** Schema name -> the DB2 file it parses. */
const SCHEMA_FILES: Record<string, string> = {
  SpellSchema: "SpellName.db2",
  SpellEffectSchema: "SpellEffect.db2",
  ItemSchema: "Item.db2",
  ItemSparseSchema: "ItemSparse.db2",
  ChrClassesSchema: "ChrClasses.db2",
  ChrClassesXPowerTypesSchema: "ChrClassesXPowerTypes.db2",
  ChrRacesSchema: "ChrRaces.db2",
  CharBaseInfoSchema: "CharBaseInfo.db2",
  TalentSchema: "Talent.db2",
};

/** Offset of layoutHash within a WDC3-WDC6 header (see parsers/db2/DB2Header.ts). */
const LAYOUT_HASH_OFFSET = 156;
const HEADER_PREFIX_BYTES = 160;

function readLayoutHash(filePath: string): number {
  const fd = fs.openSync(filePath, "r");
  try {
    const buf = Buffer.alloc(HEADER_PREFIX_BYTES);
    fs.readSync(fd, buf, 0, HEADER_PREFIX_BYTES, 0);
    return buf.readUInt32LE(LAYOUT_HASH_OFFSET);
  } finally {
    fs.closeSync(fd);
  }
}

/** Aggregate per-schema rows. `unverified` is reported but does not block. */
export function summarizeValidation(rows: SchemaValidationRow[]): ValidationSummary {
  const count = (s: ValidationStatus) => rows.filter((r) => r.status === s).length;
  const mismatch = count("mismatch");
  const missing = count("missing");
  return {
    ok: mismatch === 0 && missing === 0,
    verified: count("verified"),
    unverified: count("unverified"),
    mismatch,
    missing,
  };
}

/**
 * List a directory's entries once and index them by lowercased filename, so
 * a declared canonical name (e.g. "SpellName.db2") can be resolved against
 * whatever case the file actually landed on disk in. CASC listfiles are
 * lowercase (see src/casc/CASCListFile.ts), so an extraction can produce
 * "spellname.db2" while SCHEMA_FILES still declares "SpellName.db2" - on a
 * case-insensitive filesystem (Windows, default macOS) that mismatch is
 * invisible, but on Linux / case-sensitive macOS it would make every schema
 * report "missing". A missing directory is not an error here - it yields an
 * empty index, and every schema below resolves to "missing" as before.
 */
function indexDirByLowercaseName(dir: string): Map<string, string> {
  const index = new Map<string, string>();
  let entries: string[];
  try {
    entries = fs.readdirSync(dir);
  } catch {
    return index;
  }
  for (const entry of entries) {
    index.set(entry.toLowerCase(), entry);
  }
  return index;
}

export async function validateBuildSchemas(
  args: { buildId?: string } = {}
): Promise<BuildValidationReport> {
  const entry = args.buildId ? getBuild(args.buildId) : getActiveBuild();
  if (!entry) {
    throw new Error(`No build "${args.buildId}" in the manifest`);
  }

  const db2Dir = resolveDataPath("db2", entry.id);
  const db2DirIndex = indexDirByLowercaseName(db2Dir);
  const rows: SchemaValidationRow[] = [];

  for (const schema of SchemaFactory.getBuildAwareSchemas()) {
    const file = SCHEMA_FILES[schema.name];
    if (!file) {
      rows.push({ schema: schema.name, file: "(unmapped)", status: "missing", detail: "No DB2 file mapped for this schema" });
      continue;
    }

    const onDiskName = db2DirIndex.get(file.toLowerCase());
    if (!onDiskName) {
      rows.push({ schema: schema.name, file, status: "missing", detail: `Not found: ${path.join(db2Dir, file)}` });
      continue;
    }
    const filePath = path.join(db2Dir, onDiskName);

    try {
      const verdict = checkSchemaLayout(schema, readLayoutHash(filePath), entry.build);
      rows.push(
        verdict.status === "verified"
          ? { schema: schema.name, file, status: "verified" }
          : { schema: schema.name, file, status: "unverified", detail: verdict.reason }
      );
    } catch (error) {
      // SchemaLayoutMismatchError means the build IS in range and a hash WAS
      // recorded, but the file's hash differs: positive evidence the schema
      // is stale, so it's a genuine mismatch. Any other Error here comes from
      // checkSchemaLayout's build-range guard (build < from / build > to): the
      // build simply isn't one this schema has declared authority over, which
      // is "we could not check" rather than "we checked and it is wrong" -
      // that's what unverified is for (spec section 3.3).
      rows.push(
        error instanceof SchemaLayoutMismatchError
          ? { schema: schema.name, file, status: "mismatch", detail: error.message }
          : { schema: schema.name, file, status: "unverified", detail: String(error) }
      );
    }
  }

  let drift: string | undefined;
  const wowPath = process.env.WOW_PATH;
  if (wowPath) {
    try {
      const result = checkBuildDrift(entry.id, await resolveClientBuild(wowPath));
      if (result.drifted) {
        drift = result.message;
      }
    } catch (error) {
      logger.warn(`Could not check build drift: ${String(error)}`);
    }
  }

  return { build: entry.id, buildNumber: entry.build, drift, rows, summary: summarizeValidation(rows) };
}
