/**
 * DB2 Schema Diff Tool
 *
 * Compares two DB2 files and produces a detailed diff report covering:
 * - Header metadata (signature, version, hashes, counts)
 * - Field structure (count, sizes, offsets, storage types)
 * - Section headers (record distribution, string tables)
 * - Record data sampling (ID range, count changes)
 * - Compatibility assessment with migration impact analysis
 *
 * Supports three comparison modes:
 * 1. Two file paths - compare any two DB2 files on disk
 * 2. File + version label - compare a file against a labeled snapshot
 * 3. Directory diff - compare all matching DB2 files between two directories
 *
 * @module tools/db2schemadiff
 */

import * as fs from "fs";
import * as path from "path";
import {
  DB2Header,
  DB2SectionHeader,
  DB2FieldEntry,
  parseDB2Header,
  parseDB2SectionHeader,
  isValidDB2Signature,
} from "../parsers/db2/DB2Header";
import { logger } from "../utils/logger";

// =============================================================================
// Types
// =============================================================================

/**
 * Severity of a schema change
 */
export type ChangeSeverity = "info" | "warning" | "breaking";

/**
 * A single change detected between two DB2 files
 */
export interface SchemaChange {
  field: string;
  oldValue: string | number | bigint;
  newValue: string | number | bigint;
  severity: ChangeSeverity;
  description: string;
}

/**
 * Field-level diff entry
 */
export interface FieldDiff {
  index: number;
  oldUnusedBits: number | null;
  newUnusedBits: number | null;
  oldOffset: number | null;
  newOffset: number | null;
  oldSizeBits: number | null;
  newSizeBits: number | null;
  change: "added" | "removed" | "modified" | "unchanged";
  description: string;
}

/**
 * Section-level diff entry
 */
export interface SectionDiff {
  index: number;
  changes: SchemaChange[];
}

/**
 * Compatibility assessment
 */
export interface CompatibilityAssessment {
  compatible: boolean;
  sameTable: boolean;
  sameLayout: boolean;
  breakingChanges: number;
  warnings: number;
  infoChanges: number;
  migrationNotes: string[];
}

/**
 * Complete diff result between two DB2 files
 */
export interface DB2DiffResult {
  success: boolean;
  fileA: string;
  fileB: string;
  headerDiff: SchemaChange[];
  fieldDiff: FieldDiff[];
  sectionDiff: SectionDiff[];
  compatibility: CompatibilityAssessment;
  summary: string;
  error?: string;
}

/**
 * Result for directory-level diff
 */
export interface DB2DirectoryDiffResult {
  success: boolean;
  dirA: string;
  dirB: string;
  filesCompared: number;
  filesOnlyInA: string[];
  filesOnlyInB: string[];
  filesChanged: string[];
  filesUnchanged: string[];
  diffs: Record<string, DB2DiffResult>;
  summary: string;
  error?: string;
}

// =============================================================================
// Constants
// =============================================================================

/** Size of the DB2 header in bytes (WDC3/WDC4/WDC5/WDC6) */
const DB2_HEADER_SIZE = 204;

/** Size of each section header in bytes */
const SECTION_HEADER_SIZE = 40;

/** Size of each field entry in bytes (TrinityCore format) */
const FIELD_ENTRY_SIZE = 4;

// =============================================================================
// Internal Helpers
// =============================================================================

/**
 * Read a DB2 file's header, section headers, and field entries from disk.
 * This is a lightweight operation that only reads metadata, not record data.
 */
function readDB2Metadata(filePath: string): {
  header: DB2Header;
  sections: DB2SectionHeader[];
  fieldEntries: DB2FieldEntry[];
  fileSize: number;
} {
  if (!fs.existsSync(filePath)) {
    throw new Error(`DB2 file not found: ${filePath}`);
  }

  const stat = fs.statSync(filePath);
  if (stat.size < DB2_HEADER_SIZE) {
    throw new Error(
      `File too small to be a valid DB2: ${stat.size} bytes (need ${DB2_HEADER_SIZE}+)`
    );
  }

  const fd = fs.openSync(filePath, "r");
  try {
    // Read header
    const headerBuf = Buffer.alloc(DB2_HEADER_SIZE);
    fs.readSync(fd, headerBuf, 0, DB2_HEADER_SIZE, 0);
    const header = parseDB2Header(headerBuf);

    if (!isValidDB2Signature(header.signature)) {
      throw new Error(
        `Unsupported DB2 signature '${header.signature}' in ${filePath}`
      );
    }

    // Read section headers
    const sections: DB2SectionHeader[] = [];
    let offset = DB2_HEADER_SIZE;
    for (let i = 0; i < header.sectionCount; i++) {
      const sectionBuf = Buffer.alloc(SECTION_HEADER_SIZE);
      fs.readSync(fd, sectionBuf, 0, SECTION_HEADER_SIZE, offset);
      sections.push(parseDB2SectionHeader(sectionBuf, 0));
      offset += SECTION_HEADER_SIZE;
    }

    // Read field entries (columnMetaSize bytes right after section headers)
    const fieldEntries: DB2FieldEntry[] = [];
    if (header.columnMetaSize > 0) {
      const fieldBuf = Buffer.alloc(header.columnMetaSize);
      fs.readSync(fd, fieldBuf, 0, header.columnMetaSize, offset);

      let fieldOffset = 0;
      for (
        let i = 0;
        i < header.fieldCount && fieldOffset + FIELD_ENTRY_SIZE <= header.columnMetaSize;
        i++
      ) {
        fieldEntries.push({
          unusedBits: fieldBuf.readInt16LE(fieldOffset),
          offset: fieldBuf.readUInt16LE(fieldOffset + 2),
        });
        fieldOffset += FIELD_ENTRY_SIZE;
      }
    }

    return { header, sections, fieldEntries, fileSize: stat.size };
  } finally {
    fs.closeSync(fd);
  }
}

/**
 * Convert field unusedBits to human-readable size description
 */
function fieldSizeDescription(unusedBits: number): string {
  const byteSize = 4 - Math.floor(unusedBits / 8);
  switch (byteSize) {
    case 1:
      return "uint8 (1 byte)";
    case 2:
      return "uint16 (2 bytes)";
    case 3:
      return "uint24 (3 bytes)";
    case 4:
      return "uint32 (4 bytes)";
    default:
      return `${byteSize} bytes (unusedBits=${unusedBits})`;
  }
}

/**
 * Convert a number to hex string for display
 */
function toHex(n: number): string {
  return "0x" + (n >>> 0).toString(16).toUpperCase().padStart(8, "0");
}

/**
 * Format a bigint or number for display
 */
function formatValue(v: string | number | bigint): string {
  if (typeof v === "bigint") return v.toString();
  if (typeof v === "number") return v.toString();
  return v;
}

// =============================================================================
// Diff Engine
// =============================================================================

/**
 * Compare two DB2 file headers and produce a list of changes
 */
function diffHeaders(a: DB2Header, b: DB2Header): SchemaChange[] {
  const changes: SchemaChange[] = [];

  function check(
    field: string,
    oldVal: string | number,
    newVal: string | number,
    severity: ChangeSeverity,
    description: string
  ): void {
    if (oldVal !== newVal) {
      changes.push({ field, oldValue: oldVal, newValue: newVal, severity, description });
    }
  }

  check("signature", a.signature, b.signature, "breaking",
    "DB2 format signature changed - parser compatibility may break");

  check("version", a.version, b.version, "info",
    "DB2 format version changed");

  check("tableHash", toHex(a.tableHash), toHex(b.tableHash), "breaking",
    "Table hash changed - this is a different table or a major restructure");

  check("layoutHash", toHex(a.layoutHash), toHex(b.layoutHash), "warning",
    "Layout hash changed - schema structure has been modified");

  check("recordCount", a.recordCount, b.recordCount, "info",
    `Record count changed by ${Math.abs(b.recordCount - a.recordCount)}`);

  check("fieldCount", a.fieldCount, b.fieldCount, "breaking",
    "Field count changed - column structure is different");

  check("totalFieldCount", a.totalFieldCount, b.totalFieldCount, "warning",
    "Total field count (including array elements) changed");

  check("recordSize", a.recordSize, b.recordSize, "breaking",
    "Record size changed - binary layout is different");

  check("stringTableSize", a.stringTableSize, b.stringTableSize, "info",
    "String table size changed (expected with content updates)");

  check("minId", a.minId, b.minId, "info",
    "Minimum record ID changed");

  check("maxId", a.maxId, b.maxId, "info",
    "Maximum record ID changed");

  check("locale", a.locale, b.locale, "warning",
    "Locale setting changed");

  check("flags", a.flags, b.flags, "warning",
    "File flags changed (may affect sparse/dense format)");

  check("indexField", a.indexField, b.indexField, "breaking",
    "Index field changed - ID column position is different");

  check("packedDataOffset", a.packedDataOffset, b.packedDataOffset, "info",
    "Packed data offset changed");

  check("parentLookupCount", a.parentLookupCount, b.parentLookupCount, "info",
    "Parent lookup count changed");

  check("sectionCount", a.sectionCount, b.sectionCount, "warning",
    "Section count changed - data distribution is different");

  check("columnMetaSize", a.columnMetaSize, b.columnMetaSize, "warning",
    "Column metadata size changed");

  check("commonDataSize", a.commonDataSize, b.commonDataSize, "info",
    "Common data size changed");

  check("palletDataSize", a.palletDataSize, b.palletDataSize, "info",
    "Pallet data size changed");

  return changes;
}

/**
 * Compare field entry structures between two files
 */
function diffFields(
  fieldsA: DB2FieldEntry[],
  fieldsB: DB2FieldEntry[]
): FieldDiff[] {
  const diffs: FieldDiff[] = [];
  const maxFields = Math.max(fieldsA.length, fieldsB.length);

  for (let i = 0; i < maxFields; i++) {
    const a = i < fieldsA.length ? fieldsA[i] : null;
    const b = i < fieldsB.length ? fieldsB[i] : null;

    if (a && !b) {
      diffs.push({
        index: i,
        oldUnusedBits: a.unusedBits,
        newUnusedBits: null,
        oldOffset: a.offset,
        newOffset: null,
        oldSizeBits: (4 - Math.floor(a.unusedBits / 8)) * 8,
        newSizeBits: null,
        change: "removed",
        description: `Field ${i} removed (was ${fieldSizeDescription(a.unusedBits)} at offset ${a.offset})`,
      });
    } else if (!a && b) {
      diffs.push({
        index: i,
        oldUnusedBits: null,
        newUnusedBits: b.unusedBits,
        oldOffset: null,
        newOffset: b.offset,
        oldSizeBits: null,
        newSizeBits: (4 - Math.floor(b.unusedBits / 8)) * 8,
        change: "added",
        description: `Field ${i} added (${fieldSizeDescription(b.unusedBits)} at offset ${b.offset})`,
      });
    } else if (a && b) {
      const sizeChanged = a.unusedBits !== b.unusedBits;
      const offsetChanged = a.offset !== b.offset;

      if (sizeChanged || offsetChanged) {
        const parts: string[] = [];
        if (sizeChanged) {
          parts.push(
            `size: ${fieldSizeDescription(a.unusedBits)} → ${fieldSizeDescription(b.unusedBits)}`
          );
        }
        if (offsetChanged) {
          parts.push(`offset: ${a.offset} → ${b.offset}`);
        }

        diffs.push({
          index: i,
          oldUnusedBits: a.unusedBits,
          newUnusedBits: b.unusedBits,
          oldOffset: a.offset,
          newOffset: b.offset,
          oldSizeBits: (4 - Math.floor(a.unusedBits / 8)) * 8,
          newSizeBits: (4 - Math.floor(b.unusedBits / 8)) * 8,
          change: "modified",
          description: `Field ${i} modified: ${parts.join(", ")}`,
        });
      }
      // Skip unchanged fields to keep output concise
    }
  }

  return diffs;
}

/**
 * Compare section headers between two files
 */
function diffSections(
  sectionsA: DB2SectionHeader[],
  sectionsB: DB2SectionHeader[]
): SectionDiff[] {
  const diffs: SectionDiff[] = [];
  const maxSections = Math.max(sectionsA.length, sectionsB.length);

  for (let i = 0; i < maxSections; i++) {
    const a = i < sectionsA.length ? sectionsA[i] : null;
    const b = i < sectionsB.length ? sectionsB[i] : null;
    const changes: SchemaChange[] = [];

    if (!a && b) {
      changes.push({
        field: `section[${i}]`,
        oldValue: "(absent)",
        newValue: `${b.recordCount} records`,
        severity: "warning",
        description: `New section ${i} added with ${b.recordCount} records`,
      });
    } else if (a && !b) {
      changes.push({
        field: `section[${i}]`,
        oldValue: `${a.recordCount} records`,
        newValue: "(absent)",
        severity: "warning",
        description: `Section ${i} removed (had ${a.recordCount} records)`,
      });
    } else if (a && b) {
      if (a.recordCount !== b.recordCount) {
        changes.push({
          field: `section[${i}].recordCount`,
          oldValue: a.recordCount,
          newValue: b.recordCount,
          severity: "info",
          description: `Section ${i} record count: ${a.recordCount} → ${b.recordCount}`,
        });
      }
      if (a.stringTableSize !== b.stringTableSize) {
        changes.push({
          field: `section[${i}].stringTableSize`,
          oldValue: a.stringTableSize,
          newValue: b.stringTableSize,
          severity: "info",
          description: `Section ${i} string table: ${a.stringTableSize} → ${b.stringTableSize} bytes`,
        });
      }
      if (a.idTableSize !== b.idTableSize) {
        changes.push({
          field: `section[${i}].idTableSize`,
          oldValue: a.idTableSize,
          newValue: b.idTableSize,
          severity: "info",
          description: `Section ${i} ID table: ${a.idTableSize} → ${b.idTableSize} bytes`,
        });
      }
      if (a.copyTableCount !== b.copyTableCount) {
        changes.push({
          field: `section[${i}].copyTableCount`,
          oldValue: a.copyTableCount,
          newValue: b.copyTableCount,
          severity: "info",
          description: `Section ${i} copy table: ${a.copyTableCount} → ${b.copyTableCount} entries`,
        });
      }
      if (a.catalogDataCount !== b.catalogDataCount) {
        changes.push({
          field: `section[${i}].catalogDataCount`,
          oldValue: a.catalogDataCount,
          newValue: b.catalogDataCount,
          severity: "info",
          description: `Section ${i} catalog data: ${a.catalogDataCount} → ${b.catalogDataCount} entries`,
        });
      }
      if (a.tactId !== b.tactId) {
        changes.push({
          field: `section[${i}].tactId`,
          oldValue: a.tactId,
          newValue: b.tactId,
          severity: "warning",
          description: `Section ${i} TACT encryption key changed`,
        });
      }
    }

    if (changes.length > 0) {
      diffs.push({ index: i, changes });
    }
  }

  return diffs;
}

/**
 * Build a compatibility assessment from the collected diffs
 */
function assessCompatibility(
  headerA: DB2Header,
  headerB: DB2Header,
  headerDiff: SchemaChange[],
  fieldDiff: FieldDiff[],
  sectionDiff: SectionDiff[]
): CompatibilityAssessment {
  const sameTable = headerA.tableHash === headerB.tableHash;
  const sameLayout = headerA.layoutHash === headerB.layoutHash;

  let breakingChanges = 0;
  let warnings = 0;
  let infoChanges = 0;

  for (const change of headerDiff) {
    if (change.severity === "breaking") breakingChanges++;
    else if (change.severity === "warning") warnings++;
    else infoChanges++;
  }

  for (const diff of sectionDiff) {
    for (const change of diff.changes) {
      if (change.severity === "breaking") breakingChanges++;
      else if (change.severity === "warning") warnings++;
      else infoChanges++;
    }
  }

  // Field changes
  const addedFields = fieldDiff.filter((f) => f.change === "added").length;
  const removedFields = fieldDiff.filter((f) => f.change === "removed").length;
  const modifiedFields = fieldDiff.filter((f) => f.change === "modified").length;
  if (addedFields > 0 || removedFields > 0) breakingChanges += addedFields + removedFields;
  if (modifiedFields > 0) breakingChanges += modifiedFields;

  const migrationNotes: string[] = [];

  if (!sameTable) {
    migrationNotes.push(
      "TABLE HASH MISMATCH: These files represent different tables. Schema comparison may not be meaningful."
    );
  }

  if (!sameLayout && sameTable) {
    migrationNotes.push(
      "LAYOUT HASH CHANGED: The schema structure has been modified. Parsers and schema definitions need updating."
    );
  }

  if (headerA.fieldCount !== headerB.fieldCount) {
    const delta = headerB.fieldCount - headerA.fieldCount;
    migrationNotes.push(
      `FIELD COUNT CHANGED: ${Math.abs(delta)} field(s) ${delta > 0 ? "added" : "removed"}. Schema parsers must be updated.`
    );
  }

  if (headerA.recordSize !== headerB.recordSize) {
    migrationNotes.push(
      `RECORD SIZE CHANGED: ${headerA.recordSize} → ${headerB.recordSize} bytes. Binary record parsing code must be updated.`
    );
  }

  if (addedFields > 0) {
    migrationNotes.push(
      `${addedFields} new field(s) added. Add corresponding columns to schema definitions.`
    );
  }

  if (removedFields > 0) {
    migrationNotes.push(
      `${removedFields} field(s) removed. Remove corresponding columns from schema definitions.`
    );
  }

  if (modifiedFields > 0) {
    migrationNotes.push(
      `${modifiedFields} field(s) changed size or offset. Update field type definitions.`
    );
  }

  if (headerA.recordCount !== headerB.recordCount) {
    const delta = headerB.recordCount - headerA.recordCount;
    migrationNotes.push(
      `Record count changed by ${delta > 0 ? "+" : ""}${delta} (${headerA.recordCount} → ${headerB.recordCount}). Cache regeneration required.`
    );
  }

  if (sameTable && sameLayout && breakingChanges === 0) {
    migrationNotes.push(
      "Files are schema-compatible. Only data content differs (record count, string table, etc.). No parser changes needed."
    );
  }

  const compatible = sameTable && sameLayout && breakingChanges === 0;

  return {
    compatible,
    sameTable,
    sameLayout,
    breakingChanges,
    warnings,
    infoChanges,
    migrationNotes,
  };
}

/**
 * Build a human-readable summary of the diff
 */
function buildSummary(
  fileA: string,
  fileB: string,
  headerA: DB2Header,
  headerB: DB2Header,
  headerDiff: SchemaChange[],
  fieldDiff: FieldDiff[],
  sectionDiff: SectionDiff[],
  compatibility: CompatibilityAssessment
): string {
  const lines: string[] = [];

  lines.push("=== DB2 Schema Diff Report ===");
  lines.push("");
  lines.push(`File A: ${fileA}`);
  lines.push(`File B: ${fileB}`);
  lines.push("");

  // Quick overview
  lines.push("--- Overview ---");
  lines.push(`Format:       ${headerA.signature} → ${headerB.signature}`);
  lines.push(`Table Hash:   ${toHex(headerA.tableHash)} → ${toHex(headerB.tableHash)} ${compatibility.sameTable ? "(same table)" : "(DIFFERENT TABLE!)"}`);
  lines.push(`Layout Hash:  ${toHex(headerA.layoutHash)} → ${toHex(headerB.layoutHash)} ${compatibility.sameLayout ? "(same layout)" : "(LAYOUT CHANGED)"}`);
  lines.push(`Records:      ${headerA.recordCount} → ${headerB.recordCount}`);
  lines.push(`Fields:       ${headerA.fieldCount} → ${headerB.fieldCount}`);
  lines.push(`Record Size:  ${headerA.recordSize} → ${headerB.recordSize} bytes`);
  lines.push(`Sections:     ${headerA.sectionCount} → ${headerB.sectionCount}`);
  lines.push("");

  // Compatibility verdict
  lines.push("--- Compatibility ---");
  if (compatibility.compatible) {
    lines.push("STATUS: COMPATIBLE - No schema changes detected");
  } else {
    lines.push(`STATUS: INCOMPATIBLE - ${compatibility.breakingChanges} breaking change(s)`);
  }
  lines.push(`Breaking: ${compatibility.breakingChanges} | Warnings: ${compatibility.warnings} | Info: ${compatibility.infoChanges}`);
  lines.push("");

  // Header changes
  if (headerDiff.length > 0) {
    lines.push("--- Header Changes ---");
    for (const change of headerDiff) {
      const icon = change.severity === "breaking" ? "[BREAKING]" : change.severity === "warning" ? "[WARNING]" : "[INFO]";
      lines.push(`  ${icon} ${change.field}: ${formatValue(change.oldValue)} → ${formatValue(change.newValue)}`);
      lines.push(`         ${change.description}`);
    }
    lines.push("");
  }

  // Field changes
  if (fieldDiff.length > 0) {
    lines.push("--- Field Changes ---");
    for (const diff of fieldDiff) {
      const icon = diff.change === "added" ? "[+]" : diff.change === "removed" ? "[-]" : "[~]";
      lines.push(`  ${icon} ${diff.description}`);
    }
    lines.push("");
  }

  // Section changes
  if (sectionDiff.length > 0) {
    lines.push("--- Section Changes ---");
    for (const section of sectionDiff) {
      for (const change of section.changes) {
        lines.push(`  ${change.description}`);
      }
    }
    lines.push("");
  }

  // Migration notes
  if (compatibility.migrationNotes.length > 0) {
    lines.push("--- Migration Notes ---");
    for (const note of compatibility.migrationNotes) {
      lines.push(`  * ${note}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Compare two DB2 files and produce a complete diff report.
 *
 * @param filePathA - Path to the first (old/baseline) DB2 file
 * @param filePathB - Path to the second (new/updated) DB2 file
 * @returns Complete diff result with header, field, section diffs and compatibility assessment
 *
 * @example
 * ```typescript
 * const diff = diffDB2Files(
 *   'M:/Wplayerbot/data/db2/Spell.db2',
 *   'M:/WorldofWarcraft/dbc/enUS/Spell.db2'
 * );
 * console.log(diff.summary);
 * console.log('Compatible:', diff.compatibility.compatible);
 * ```
 */
export function diffDB2Files(filePathA: string, filePathB: string): DB2DiffResult {
  const startTime = Date.now();

  try {
    logger.debug("DB2 schema diff starting", { fileA: filePathA, fileB: filePathB });

    // Read metadata from both files
    const metaA = readDB2Metadata(filePathA);
    const metaB = readDB2Metadata(filePathB);

    // Perform diffs
    const headerDiff = diffHeaders(metaA.header, metaB.header);
    const fieldDiff = diffFields(metaA.fieldEntries, metaB.fieldEntries);
    const sectionDiff = diffSections(metaA.sections, metaB.sections);

    // Assess compatibility
    const compatibility = assessCompatibility(
      metaA.header,
      metaB.header,
      headerDiff,
      fieldDiff,
      sectionDiff
    );

    // Build summary
    const summary = buildSummary(
      filePathA,
      filePathB,
      metaA.header,
      metaB.header,
      headerDiff,
      fieldDiff,
      sectionDiff,
      compatibility
    );

    const duration = Date.now() - startTime;
    logger.info("DB2 schema diff completed", {
      fileA: filePathA,
      fileB: filePathB,
      duration,
      breakingChanges: compatibility.breakingChanges,
    });

    return {
      success: true,
      fileA: filePathA,
      fileB: filePathB,
      headerDiff,
      fieldDiff,
      sectionDiff,
      compatibility,
      summary,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error("DB2 schema diff failed", { fileA: filePathA, fileB: filePathB, error: message });
    return {
      success: false,
      fileA: filePathA,
      fileB: filePathB,
      headerDiff: [],
      fieldDiff: [],
      sectionDiff: [],
      compatibility: {
        compatible: false,
        sameTable: false,
        sameLayout: false,
        breakingChanges: 0,
        warnings: 0,
        infoChanges: 0,
        migrationNotes: [],
      },
      summary: "",
      error: message,
    };
  }
}

/**
 * Compare all DB2 files in two directories and produce a batch diff report.
 *
 * Scans both directories for .db2 files (case-insensitive), matches them by
 * filename, and runs diffDB2Files on each pair. Also reports files present
 * in only one directory.
 *
 * @param dirA - Path to the first (old/baseline) directory
 * @param dirB - Path to the second (new/updated) directory
 * @param fileFilter - Optional glob-style filter (e.g., "Spell*" to only compare Spell files)
 * @returns Directory diff result with per-file diffs
 *
 * @example
 * ```typescript
 * const dirDiff = diffDB2Directories(
 *   'M:/Wplayerbot/data/db2',
 *   'M:/WorldofWarcraft/dbc/enUS'
 * );
 * console.log(`Files compared: ${dirDiff.filesCompared}`);
 * console.log(`Changed: ${dirDiff.filesChanged.length}`);
 * ```
 */
export function diffDB2Directories(
  dirA: string,
  dirB: string,
  fileFilter?: string
): DB2DirectoryDiffResult {
  const startTime = Date.now();

  try {
    logger.debug("DB2 directory diff starting", { dirA, dirB, fileFilter });

    if (!fs.existsSync(dirA)) {
      throw new Error(`Directory A not found: ${dirA}`);
    }
    if (!fs.existsSync(dirB)) {
      throw new Error(`Directory B not found: ${dirB}`);
    }

    // List DB2 files in both directories
    const listDB2Files = (dir: string): Map<string, string> => {
      const files = new Map<string, string>();
      for (const entry of fs.readdirSync(dir)) {
        if (entry.toLowerCase().endsWith(".db2")) {
          files.set(entry.toLowerCase(), path.join(dir, entry));
        }
      }
      return files;
    };

    const filesA = listDB2Files(dirA);
    const filesB = listDB2Files(dirB);

    // Apply filter if provided
    const matchesFilter = (filename: string): boolean => {
      if (!fileFilter) return true;
      const pattern = fileFilter.toLowerCase().replace(/\*/g, ".*").replace(/\?/g, ".");
      return new RegExp(`^${pattern}$`, "i").test(filename);
    };

    // Categorize files
    const allNames = new Set([...filesA.keys(), ...filesB.keys()]);
    const filesOnlyInA: string[] = [];
    const filesOnlyInB: string[] = [];
    const filesChanged: string[] = [];
    const filesUnchanged: string[] = [];
    const diffs: Record<string, DB2DiffResult> = {};
    let filesCompared = 0;

    for (const name of Array.from(allNames).sort()) {
      if (!matchesFilter(name)) continue;

      const inA = filesA.has(name);
      const inB = filesB.has(name);

      if (inA && !inB) {
        filesOnlyInA.push(name);
      } else if (!inA && inB) {
        filesOnlyInB.push(name);
      } else if (inA && inB) {
        filesCompared++;
        const diff = diffDB2Files(filesA.get(name)!, filesB.get(name)!);
        diffs[name] = diff;

        if (diff.success && diff.compatibility.compatible && diff.headerDiff.length === 0) {
          filesUnchanged.push(name);
        } else {
          filesChanged.push(name);
        }
      }
    }

    // Build summary
    const duration = Date.now() - startTime;
    const summaryLines: string[] = [
      "=== DB2 Directory Diff Report ===",
      "",
      `Directory A: ${dirA}`,
      `Directory B: ${dirB}`,
      fileFilter ? `Filter: ${fileFilter}` : "",
      "",
      `Files compared:       ${filesCompared}`,
      `Files changed:        ${filesChanged.length}`,
      `Files unchanged:      ${filesUnchanged.length}`,
      `Files only in A:      ${filesOnlyInA.length}`,
      `Files only in B:      ${filesOnlyInB.length}`,
      `Duration:             ${duration}ms`,
      "",
    ];

    if (filesChanged.length > 0) {
      summaryLines.push("--- Changed Files ---");
      for (const name of filesChanged) {
        const diff = diffs[name];
        if (diff.success) {
          summaryLines.push(
            `  ${name}: ${diff.compatibility.breakingChanges} breaking, ${diff.compatibility.warnings} warnings`
          );
        } else {
          summaryLines.push(`  ${name}: ERROR - ${diff.error}`);
        }
      }
      summaryLines.push("");
    }

    if (filesOnlyInA.length > 0) {
      summaryLines.push("--- Files Only in A (removed) ---");
      for (const name of filesOnlyInA) {
        summaryLines.push(`  ${name}`);
      }
      summaryLines.push("");
    }

    if (filesOnlyInB.length > 0) {
      summaryLines.push("--- Files Only in B (added) ---");
      for (const name of filesOnlyInB) {
        summaryLines.push(`  ${name}`);
      }
      summaryLines.push("");
    }

    logger.info("DB2 directory diff completed", {
      dirA,
      dirB,
      filesCompared,
      changed: filesChanged.length,
      duration,
    });

    return {
      success: true,
      dirA,
      dirB,
      filesCompared,
      filesOnlyInA,
      filesOnlyInB,
      filesChanged,
      filesUnchanged,
      diffs,
      summary: summaryLines.filter(Boolean).join("\n"),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error("DB2 directory diff failed", { dirA, dirB, error: message });
    return {
      success: false,
      dirA,
      dirB,
      filesCompared: 0,
      filesOnlyInA: [],
      filesOnlyInB: [],
      filesChanged: [],
      filesUnchanged: [],
      diffs: {},
      summary: "",
      error: message,
    };
  }
}

/**
 * Get metadata summary for a single DB2 file (header + field info).
 * Useful for inspection without comparison.
 *
 * @param filePath - Path to the DB2 file
 * @returns Metadata summary object
 */
export function inspectDB2File(filePath: string): {
  success: boolean;
  file: string;
  header?: DB2Header;
  fieldEntries?: Array<{ index: number; unusedBits: number; offset: number; size: string }>;
  sectionSummary?: Array<{ index: number; recordCount: number; stringTableSize: number }>;
  fileSize?: number;
  summary?: string;
  error?: string;
} {
  try {
    const meta = readDB2Metadata(filePath);

    const fieldInfo = meta.fieldEntries.map((f, i) => ({
      index: i,
      unusedBits: f.unusedBits,
      offset: f.offset,
      size: fieldSizeDescription(f.unusedBits),
    }));

    const sectionSummary = meta.sections.map((s, i) => ({
      index: i,
      recordCount: s.recordCount,
      stringTableSize: s.stringTableSize,
    }));

    const lines: string[] = [
      `=== DB2 File Inspection: ${path.basename(filePath)} ===`,
      "",
      `Path:          ${filePath}`,
      `File Size:     ${meta.fileSize} bytes (${(meta.fileSize / 1024).toFixed(1)} KB)`,
      `Signature:     ${meta.header.signature}`,
      `Version:       ${meta.header.version}`,
      `Table Hash:    ${toHex(meta.header.tableHash)}`,
      `Layout Hash:   ${toHex(meta.header.layoutHash)}`,
      `Records:       ${meta.header.recordCount}`,
      `Fields:        ${meta.header.fieldCount} (total: ${meta.header.totalFieldCount})`,
      `Record Size:   ${meta.header.recordSize} bytes`,
      `String Table:  ${meta.header.stringTableSize} bytes`,
      `ID Range:      ${meta.header.minId} - ${meta.header.maxId}`,
      `Sections:      ${meta.header.sectionCount}`,
      `Flags:         0x${meta.header.flags.toString(16).toUpperCase()}`,
      `Index Field:   ${meta.header.indexField}`,
      "",
    ];

    if (fieldInfo.length > 0) {
      lines.push("--- Fields ---");
      for (const f of fieldInfo) {
        lines.push(`  [${f.index}] ${f.size} at offset ${f.offset}`);
      }
      lines.push("");
    }

    if (sectionSummary.length > 0) {
      lines.push("--- Sections ---");
      for (const s of sectionSummary) {
        lines.push(`  [${s.index}] ${s.recordCount} records, ${s.stringTableSize} byte string table`);
      }
      lines.push("");
    }

    return {
      success: true,
      file: filePath,
      header: meta.header,
      fieldEntries: fieldInfo,
      sectionSummary,
      fileSize: meta.fileSize,
      summary: lines.join("\n"),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      file: filePath,
      error: message,
    };
  }
}
