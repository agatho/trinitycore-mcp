/**
 * DB2 Schema Diff Tool Tests
 *
 * Tests the DB2 schema comparison engine including:
 * - Header diff detection (table hash, layout hash, field count, record size)
 * - Field-level diff (added, removed, modified fields)
 * - Section-level diff (record counts, string tables)
 * - Compatibility assessment and migration notes
 * - Directory diff batch operations
 * - Single file inspection
 * - Error handling for missing/invalid files
 *
 * Uses synthetic DB2 binary buffers to test parsing without real game files.
 *
 * @module tests/tools/db2schemadiff
 */

import {
  diffDB2Files,
  diffDB2Directories,
  inspectDB2File,
  DB2DiffResult,
  DB2DirectoryDiffResult,
} from "../../src/tools/db2schemadiff";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

// =============================================================================
// Test Helpers - Synthetic DB2 Buffer Builder
// =============================================================================

/**
 * Build a minimal synthetic DB2 binary file for testing.
 * Creates a valid WDC5 header + section headers + field entries.
 */
function buildSyntheticDB2(options: {
  signature?: string;
  version?: number;
  recordCount?: number;
  fieldCount?: number;
  recordSize?: number;
  stringTableSize?: number;
  tableHash?: number;
  layoutHash?: number;
  minId?: number;
  maxId?: number;
  locale?: number;
  flags?: number;
  indexField?: number;
  totalFieldCount?: number;
  packedDataOffset?: number;
  parentLookupCount?: number;
  sectionCount?: number;
  fieldEntries?: Array<{ unusedBits: number; offset: number }>;
  sectionRecordCounts?: number[];
  sectionStringTableSizes?: number[];
}): Buffer {
  const {
    signature = "WDC5",
    version = 5,
    recordCount = 100,
    fieldCount = 4,
    recordSize = 16,
    stringTableSize = 1024,
    tableHash = 0x12345678,
    layoutHash = 0xABCDEF01,
    minId = 1,
    maxId = 100,
    locale = 0,
    flags = 0,
    indexField = 0,
    totalFieldCount = 4,
    packedDataOffset = 0,
    parentLookupCount = 0,
    sectionCount = 1,
    fieldEntries = [
      { unusedBits: 0, offset: 0 },   // uint32 at offset 0
      { unusedBits: 0, offset: 4 },   // uint32 at offset 4
      { unusedBits: 16, offset: 8 },  // uint16 at offset 8
      { unusedBits: 16, offset: 10 }, // uint16 at offset 10
    ],
    sectionRecordCounts,
    sectionStringTableSizes,
  } = options;

  // Calculate columnMetaSize (4 bytes per field)
  const columnMetaSize = fieldCount * 4;

  // Calculate buffer size: header (204) + sections (40 * sectionCount) + field entries
  const headerSize = 204;
  const sectionHeaderSize = 40 * sectionCount;
  const totalSize = headerSize + sectionHeaderSize + columnMetaSize;

  const buf = Buffer.alloc(totalSize);

  // Write header
  buf.write(signature, 0, 4, "ascii");
  buf.writeUInt32LE(version, 4);
  // schema string at offset 8 (128 bytes) - leave zeroed
  buf.writeUInt32LE(recordCount, 136);
  buf.writeUInt32LE(fieldCount, 140);
  buf.writeUInt32LE(recordSize, 144);
  buf.writeUInt32LE(stringTableSize, 148);
  buf.writeUInt32LE(tableHash >>> 0, 152);
  buf.writeUInt32LE(layoutHash >>> 0, 156);
  buf.writeUInt32LE(minId, 160);
  buf.writeUInt32LE(maxId, 164);
  buf.writeUInt32LE(locale, 168);
  buf.writeUInt16LE(flags, 172);
  buf.writeInt16LE(indexField, 174);
  buf.writeUInt32LE(totalFieldCount, 176);
  buf.writeUInt32LE(packedDataOffset, 180);
  buf.writeUInt32LE(parentLookupCount, 184);
  buf.writeUInt32LE(columnMetaSize, 188);
  buf.writeUInt32LE(0, 192); // commonDataSize
  buf.writeUInt32LE(0, 196); // palletDataSize
  buf.writeUInt32LE(sectionCount, 200);

  // Write section headers
  let offset = headerSize;
  for (let i = 0; i < sectionCount; i++) {
    // tactId (uint64)
    buf.writeBigUInt64LE(BigInt(0), offset);
    offset += 8;
    // fileOffset (uint32)
    buf.writeUInt32LE(0, offset);
    offset += 4;
    // recordCount (uint32)
    const sectionRecords = sectionRecordCounts?.[i] ?? recordCount;
    buf.writeUInt32LE(sectionRecords, offset);
    offset += 4;
    // stringTableSize (uint32)
    const sectionStrTable = sectionStringTableSizes?.[i] ?? stringTableSize;
    buf.writeUInt32LE(sectionStrTable, offset);
    offset += 4;
    // catalogDataOffset (uint32)
    buf.writeUInt32LE(0, offset);
    offset += 4;
    // idTableSize (uint32)
    buf.writeUInt32LE(0, offset);
    offset += 4;
    // parentLookupDataSize (uint32)
    buf.writeUInt32LE(0, offset);
    offset += 4;
    // catalogDataCount (uint32)
    buf.writeUInt32LE(0, offset);
    offset += 4;
    // copyTableCount (uint32)
    buf.writeUInt32LE(0, offset);
    offset += 4;
  }

  // Write field entries
  for (let i = 0; i < fieldCount; i++) {
    const entry = i < fieldEntries.length
      ? fieldEntries[i]
      : { unusedBits: 0, offset: i * 4 };
    buf.writeInt16LE(entry.unusedBits, offset);
    buf.writeUInt16LE(entry.offset, offset + 2);
    offset += 4;
  }

  return buf;
}

/**
 * Create a temporary directory with synthetic DB2 files
 */
function createTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "db2-diff-test-"));
}

/**
 * Write a synthetic DB2 buffer to a file
 */
function writeSyntheticDB2(dir: string, filename: string, options: Parameters<typeof buildSyntheticDB2>[0] = {}): string {
  const filePath = path.join(dir, filename);
  fs.writeFileSync(filePath, buildSyntheticDB2(options));
  return filePath;
}

/**
 * Clean up a temporary directory
 */
function cleanupTempDir(dir: string): void {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
}

// =============================================================================
// Tests
// =============================================================================

describe("DB2 Schema Diff Tool", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDir();
  });

  afterEach(() => {
    cleanupTempDir(tempDir);
  });

  // ---------------------------------------------------------------------------
  // Single File Diff
  // ---------------------------------------------------------------------------
  describe("diffDB2Files", () => {
    it("should report identical files as compatible", () => {
      const fileA = writeSyntheticDB2(tempDir, "SpellA.db2");
      const fileB = writeSyntheticDB2(tempDir, "SpellB.db2");

      const result = diffDB2Files(fileA, fileB);

      expect(result.success).toBe(true);
      expect(result.compatibility.compatible).toBe(true);
      expect(result.compatibility.sameTable).toBe(true);
      expect(result.compatibility.sameLayout).toBe(true);
      expect(result.compatibility.breakingChanges).toBe(0);
      expect(result.headerDiff.length).toBe(0);
      expect(result.fieldDiff.length).toBe(0);
    });

    it("should detect table hash change as breaking", () => {
      const fileA = writeSyntheticDB2(tempDir, "A.db2", { tableHash: 0x11111111 });
      const fileB = writeSyntheticDB2(tempDir, "B.db2", { tableHash: 0x22222222 });

      const result = diffDB2Files(fileA, fileB);

      expect(result.success).toBe(true);
      expect(result.compatibility.sameTable).toBe(false);
      expect(result.compatibility.compatible).toBe(false);

      const tableHashChange = result.headerDiff.find(c => c.field === "tableHash");
      expect(tableHashChange).toBeDefined();
      expect(tableHashChange!.severity).toBe("breaking");
    });

    it("should detect layout hash change as warning", () => {
      const fileA = writeSyntheticDB2(tempDir, "A.db2", { layoutHash: 0xAAAAAAAA });
      const fileB = writeSyntheticDB2(tempDir, "B.db2", { layoutHash: 0xBBBBBBBB });

      const result = diffDB2Files(fileA, fileB);

      expect(result.success).toBe(true);
      expect(result.compatibility.sameLayout).toBe(false);

      const layoutChange = result.headerDiff.find(c => c.field === "layoutHash");
      expect(layoutChange).toBeDefined();
      expect(layoutChange!.severity).toBe("warning");
    });

    it("should detect field count change as breaking", () => {
      const fileA = writeSyntheticDB2(tempDir, "A.db2", {
        fieldCount: 4,
        totalFieldCount: 4,
        fieldEntries: [
          { unusedBits: 0, offset: 0 },
          { unusedBits: 0, offset: 4 },
          { unusedBits: 16, offset: 8 },
          { unusedBits: 16, offset: 10 },
        ],
      });
      const fileB = writeSyntheticDB2(tempDir, "B.db2", {
        fieldCount: 5,
        totalFieldCount: 5,
        fieldEntries: [
          { unusedBits: 0, offset: 0 },
          { unusedBits: 0, offset: 4 },
          { unusedBits: 16, offset: 8 },
          { unusedBits: 16, offset: 10 },
          { unusedBits: 0, offset: 12 },
        ],
      });

      const result = diffDB2Files(fileA, fileB);

      expect(result.success).toBe(true);
      expect(result.compatibility.breakingChanges).toBeGreaterThan(0);

      const fieldCountChange = result.headerDiff.find(c => c.field === "fieldCount");
      expect(fieldCountChange).toBeDefined();
      expect(fieldCountChange!.severity).toBe("breaking");
    });

    it("should detect record size change as breaking", () => {
      const fileA = writeSyntheticDB2(tempDir, "A.db2", { recordSize: 16 });
      const fileB = writeSyntheticDB2(tempDir, "B.db2", { recordSize: 20 });

      const result = diffDB2Files(fileA, fileB);

      expect(result.success).toBe(true);
      const sizeChange = result.headerDiff.find(c => c.field === "recordSize");
      expect(sizeChange).toBeDefined();
      expect(sizeChange!.severity).toBe("breaking");
    });

    it("should detect record count change as info", () => {
      const fileA = writeSyntheticDB2(tempDir, "A.db2", { recordCount: 100 });
      const fileB = writeSyntheticDB2(tempDir, "B.db2", { recordCount: 150 });

      const result = diffDB2Files(fileA, fileB);

      expect(result.success).toBe(true);
      const countChange = result.headerDiff.find(c => c.field === "recordCount");
      expect(countChange).toBeDefined();
      expect(countChange!.severity).toBe("info");
    });

    it("should detect added fields in field diff", () => {
      const fileA = writeSyntheticDB2(tempDir, "A.db2", {
        fieldCount: 2,
        totalFieldCount: 2,
        fieldEntries: [
          { unusedBits: 0, offset: 0 },
          { unusedBits: 0, offset: 4 },
        ],
      });
      const fileB = writeSyntheticDB2(tempDir, "B.db2", {
        fieldCount: 3,
        totalFieldCount: 3,
        fieldEntries: [
          { unusedBits: 0, offset: 0 },
          { unusedBits: 0, offset: 4 },
          { unusedBits: 16, offset: 8 },
        ],
      });

      const result = diffDB2Files(fileA, fileB);

      expect(result.success).toBe(true);
      const addedField = result.fieldDiff.find(f => f.change === "added");
      expect(addedField).toBeDefined();
      expect(addedField!.index).toBe(2);
    });

    it("should detect removed fields in field diff", () => {
      const fileA = writeSyntheticDB2(tempDir, "A.db2", {
        fieldCount: 3,
        totalFieldCount: 3,
        fieldEntries: [
          { unusedBits: 0, offset: 0 },
          { unusedBits: 0, offset: 4 },
          { unusedBits: 16, offset: 8 },
        ],
      });
      const fileB = writeSyntheticDB2(tempDir, "B.db2", {
        fieldCount: 2,
        totalFieldCount: 2,
        fieldEntries: [
          { unusedBits: 0, offset: 0 },
          { unusedBits: 0, offset: 4 },
        ],
      });

      const result = diffDB2Files(fileA, fileB);

      expect(result.success).toBe(true);
      const removedField = result.fieldDiff.find(f => f.change === "removed");
      expect(removedField).toBeDefined();
      expect(removedField!.index).toBe(2);
    });

    it("should detect field size changes", () => {
      const fileA = writeSyntheticDB2(tempDir, "A.db2", {
        fieldCount: 2,
        totalFieldCount: 2,
        fieldEntries: [
          { unusedBits: 0, offset: 0 },   // uint32
          { unusedBits: 16, offset: 4 },   // uint16
        ],
      });
      const fileB = writeSyntheticDB2(tempDir, "B.db2", {
        fieldCount: 2,
        totalFieldCount: 2,
        fieldEntries: [
          { unusedBits: 0, offset: 0 },   // uint32 (unchanged)
          { unusedBits: 0, offset: 4 },    // uint32 (was uint16)
        ],
      });

      const result = diffDB2Files(fileA, fileB);

      expect(result.success).toBe(true);
      const modifiedField = result.fieldDiff.find(f => f.change === "modified");
      expect(modifiedField).toBeDefined();
      expect(modifiedField!.index).toBe(1);
      expect(modifiedField!.description).toContain("size");
    });

    it("should detect field offset changes", () => {
      const fileA = writeSyntheticDB2(tempDir, "A.db2", {
        fieldCount: 2,
        totalFieldCount: 2,
        fieldEntries: [
          { unusedBits: 0, offset: 0 },
          { unusedBits: 0, offset: 4 },
        ],
      });
      const fileB = writeSyntheticDB2(tempDir, "B.db2", {
        fieldCount: 2,
        totalFieldCount: 2,
        fieldEntries: [
          { unusedBits: 0, offset: 0 },
          { unusedBits: 0, offset: 8 },  // offset changed
        ],
      });

      const result = diffDB2Files(fileA, fileB);

      expect(result.success).toBe(true);
      const modifiedField = result.fieldDiff.find(f => f.change === "modified");
      expect(modifiedField).toBeDefined();
      expect(modifiedField!.description).toContain("offset");
    });

    it("should detect section record count changes", () => {
      const fileA = writeSyntheticDB2(tempDir, "A.db2", {
        sectionCount: 1,
        sectionRecordCounts: [100],
      });
      const fileB = writeSyntheticDB2(tempDir, "B.db2", {
        sectionCount: 1,
        sectionRecordCounts: [150],
      });

      const result = diffDB2Files(fileA, fileB);

      expect(result.success).toBe(true);
      expect(result.sectionDiff.length).toBeGreaterThan(0);
      const sectionChange = result.sectionDiff[0].changes.find(
        c => c.field.includes("recordCount")
      );
      expect(sectionChange).toBeDefined();
    });

    it("should detect section count changes", () => {
      const fileA = writeSyntheticDB2(tempDir, "A.db2", {
        sectionCount: 1,
        sectionRecordCounts: [100],
      });
      const fileB = writeSyntheticDB2(tempDir, "B.db2", {
        sectionCount: 2,
        sectionRecordCounts: [100, 50],
      });

      const result = diffDB2Files(fileA, fileB);

      expect(result.success).toBe(true);
      const sectionCountChange = result.headerDiff.find(c => c.field === "sectionCount");
      expect(sectionCountChange).toBeDefined();
    });

    it("should generate migration notes for schema changes", () => {
      const fileA = writeSyntheticDB2(tempDir, "A.db2", {
        layoutHash: 0xAAAAAAAA,
        fieldCount: 4,
        totalFieldCount: 4,
        recordSize: 16,
        recordCount: 100,
      });
      const fileB = writeSyntheticDB2(tempDir, "B.db2", {
        layoutHash: 0xBBBBBBBB,
        fieldCount: 5,
        totalFieldCount: 5,
        recordSize: 20,
        recordCount: 120,
        fieldEntries: [
          { unusedBits: 0, offset: 0 },
          { unusedBits: 0, offset: 4 },
          { unusedBits: 16, offset: 8 },
          { unusedBits: 16, offset: 10 },
          { unusedBits: 0, offset: 12 },
        ],
      });

      const result = diffDB2Files(fileA, fileB);

      expect(result.success).toBe(true);
      expect(result.compatibility.migrationNotes.length).toBeGreaterThan(0);
      const notes = result.compatibility.migrationNotes.join(" ");
      expect(notes).toContain("LAYOUT HASH CHANGED");
      expect(notes).toContain("FIELD COUNT CHANGED");
      expect(notes).toContain("RECORD SIZE CHANGED");
    });

    it("should produce a human-readable summary", () => {
      const fileA = writeSyntheticDB2(tempDir, "A.db2", { recordCount: 100 });
      const fileB = writeSyntheticDB2(tempDir, "B.db2", { recordCount: 200 });

      const result = diffDB2Files(fileA, fileB);

      expect(result.success).toBe(true);
      expect(result.summary).toContain("DB2 Schema Diff Report");
      expect(result.summary).toContain("Records:");
      expect(result.summary).toContain("100");
      expect(result.summary).toContain("200");
    });

    it("should detect signature change as breaking", () => {
      const fileA = writeSyntheticDB2(tempDir, "A.db2", { signature: "WDC5" });
      const fileB = writeSyntheticDB2(tempDir, "B.db2", { signature: "WDC6" });

      const result = diffDB2Files(fileA, fileB);

      expect(result.success).toBe(true);
      const sigChange = result.headerDiff.find(c => c.field === "signature");
      expect(sigChange).toBeDefined();
      expect(sigChange!.severity).toBe("breaking");
    });
  });

  // ---------------------------------------------------------------------------
  // Error Handling
  // ---------------------------------------------------------------------------
  describe("Error Handling", () => {
    it("should handle missing file A gracefully", () => {
      const fileB = writeSyntheticDB2(tempDir, "B.db2");
      const result = diffDB2Files("/nonexistent/A.db2", fileB);

      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });

    it("should handle missing file B gracefully", () => {
      const fileA = writeSyntheticDB2(tempDir, "A.db2");
      const result = diffDB2Files(fileA, "/nonexistent/B.db2");

      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });

    it("should handle invalid DB2 file (too small)", () => {
      const invalidPath = path.join(tempDir, "invalid.db2");
      fs.writeFileSync(invalidPath, Buffer.alloc(10));

      const fileB = writeSyntheticDB2(tempDir, "B.db2");
      const result = diffDB2Files(invalidPath, fileB);

      expect(result.success).toBe(false);
      expect(result.error).toContain("too small");
    });

    it("should handle invalid DB2 signature", () => {
      const invalidPath = path.join(tempDir, "bad-sig.db2");
      const buf = buildSyntheticDB2({});
      buf.write("XXXX", 0, 4, "ascii");
      fs.writeFileSync(invalidPath, buf);

      const fileB = writeSyntheticDB2(tempDir, "B.db2");
      const result = diffDB2Files(invalidPath, fileB);

      expect(result.success).toBe(false);
      expect(result.error).toContain("signature");
    });
  });

  // ---------------------------------------------------------------------------
  // Directory Diff
  // ---------------------------------------------------------------------------
  describe("diffDB2Directories", () => {
    it("should compare matching files in two directories", () => {
      const dirA = path.join(tempDir, "dirA");
      const dirB = path.join(tempDir, "dirB");
      fs.mkdirSync(dirA);
      fs.mkdirSync(dirB);

      writeSyntheticDB2(dirA, "Spell.db2", { recordCount: 100 });
      writeSyntheticDB2(dirB, "Spell.db2", { recordCount: 150 });

      writeSyntheticDB2(dirA, "Item.db2", { recordCount: 200 });
      writeSyntheticDB2(dirB, "Item.db2", { recordCount: 200 });

      const result = diffDB2Directories(dirA, dirB);

      expect(result.success).toBe(true);
      expect(result.filesCompared).toBe(2);
      expect(result.filesChanged).toContain("spell.db2");
      expect(result.filesUnchanged).toContain("item.db2");
    });

    it("should report files only in directory A", () => {
      const dirA = path.join(tempDir, "dirA");
      const dirB = path.join(tempDir, "dirB");
      fs.mkdirSync(dirA);
      fs.mkdirSync(dirB);

      writeSyntheticDB2(dirA, "Spell.db2");
      writeSyntheticDB2(dirA, "OldTable.db2");
      writeSyntheticDB2(dirB, "Spell.db2");

      const result = diffDB2Directories(dirA, dirB);

      expect(result.success).toBe(true);
      expect(result.filesOnlyInA).toContain("oldtable.db2");
    });

    it("should report files only in directory B", () => {
      const dirA = path.join(tempDir, "dirA");
      const dirB = path.join(tempDir, "dirB");
      fs.mkdirSync(dirA);
      fs.mkdirSync(dirB);

      writeSyntheticDB2(dirA, "Spell.db2");
      writeSyntheticDB2(dirB, "Spell.db2");
      writeSyntheticDB2(dirB, "NewTable.db2");

      const result = diffDB2Directories(dirA, dirB);

      expect(result.success).toBe(true);
      expect(result.filesOnlyInB).toContain("newtable.db2");
    });

    it("should apply file filter", () => {
      const dirA = path.join(tempDir, "dirA");
      const dirB = path.join(tempDir, "dirB");
      fs.mkdirSync(dirA);
      fs.mkdirSync(dirB);

      writeSyntheticDB2(dirA, "Spell.db2", { recordCount: 100 });
      writeSyntheticDB2(dirB, "Spell.db2", { recordCount: 150 });
      writeSyntheticDB2(dirA, "Item.db2", { recordCount: 200 });
      writeSyntheticDB2(dirB, "Item.db2", { recordCount: 250 });

      const result = diffDB2Directories(dirA, dirB, "spell*");

      expect(result.success).toBe(true);
      expect(result.filesCompared).toBe(1);
      expect(result.filesChanged).toContain("spell.db2");
    });

    it("should handle missing directory A", () => {
      const dirB = path.join(tempDir, "dirB");
      fs.mkdirSync(dirB);

      const result = diffDB2Directories("/nonexistent/dirA", dirB);

      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });

    it("should handle missing directory B", () => {
      const dirA = path.join(tempDir, "dirA");
      fs.mkdirSync(dirA);

      const result = diffDB2Directories(dirA, "/nonexistent/dirB");

      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });

    it("should generate directory diff summary", () => {
      const dirA = path.join(tempDir, "dirA");
      const dirB = path.join(tempDir, "dirB");
      fs.mkdirSync(dirA);
      fs.mkdirSync(dirB);

      writeSyntheticDB2(dirA, "Spell.db2", { recordCount: 100 });
      writeSyntheticDB2(dirB, "Spell.db2", { recordCount: 150 });

      const result = diffDB2Directories(dirA, dirB);

      expect(result.success).toBe(true);
      expect(result.summary).toContain("DB2 Directory Diff Report");
      expect(result.summary).toContain("Files compared:");
    });
  });

  // ---------------------------------------------------------------------------
  // Single File Inspection
  // ---------------------------------------------------------------------------
  describe("inspectDB2File", () => {
    it("should return metadata for a valid DB2 file", () => {
      const filePath = writeSyntheticDB2(tempDir, "Test.db2", {
        recordCount: 42,
        fieldCount: 3,
        recordSize: 12,
        tableHash: 0xDEADBEEF,
        layoutHash: 0xCAFEBABE,
        fieldEntries: [
          { unusedBits: 0, offset: 0 },
          { unusedBits: 0, offset: 4 },
          { unusedBits: 16, offset: 8 },
        ],
      });

      const result = inspectDB2File(filePath);

      expect(result.success).toBe(true);
      expect(result.header).toBeDefined();
      expect(result.header!.recordCount).toBe(42);
      expect(result.header!.fieldCount).toBe(3);
      expect(result.header!.recordSize).toBe(12);
      expect(result.header!.tableHash).toBe(0xDEADBEEF);
      expect(result.header!.layoutHash).toBe(0xCAFEBABE);
    });

    it("should return field entry details", () => {
      const filePath = writeSyntheticDB2(tempDir, "Fields.db2", {
        fieldCount: 3,
        totalFieldCount: 3,
        fieldEntries: [
          { unusedBits: 0, offset: 0 },    // uint32
          { unusedBits: 16, offset: 4 },   // uint16
          { unusedBits: 24, offset: 6 },   // uint8
        ],
      });

      const result = inspectDB2File(filePath);

      expect(result.success).toBe(true);
      expect(result.fieldEntries).toBeDefined();
      expect(result.fieldEntries!.length).toBe(3);

      expect(result.fieldEntries![0].size).toContain("uint32");
      expect(result.fieldEntries![1].size).toContain("uint16");
      expect(result.fieldEntries![2].size).toContain("uint8");
    });

    it("should return section summary", () => {
      const filePath = writeSyntheticDB2(tempDir, "Sections.db2", {
        sectionCount: 2,
        sectionRecordCounts: [100, 50],
        sectionStringTableSizes: [2048, 1024],
      });

      const result = inspectDB2File(filePath);

      expect(result.success).toBe(true);
      expect(result.sectionSummary).toBeDefined();
      expect(result.sectionSummary!.length).toBe(2);
      expect(result.sectionSummary![0].recordCount).toBe(100);
      expect(result.sectionSummary![1].recordCount).toBe(50);
    });

    it("should produce a human-readable summary", () => {
      const filePath = writeSyntheticDB2(tempDir, "Summary.db2", {
        recordCount: 1000,
        fieldCount: 8,
        tableHash: 0x12345678,
      });

      const result = inspectDB2File(filePath);

      expect(result.success).toBe(true);
      expect(result.summary).toContain("DB2 File Inspection");
      expect(result.summary).toContain("Records:");
      expect(result.summary).toContain("1000");
      expect(result.summary).toContain("Fields:");
      expect(result.summary).toContain("8");
    });

    it("should handle missing file gracefully", () => {
      const result = inspectDB2File("/nonexistent/file.db2");

      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });

    it("should report file size", () => {
      const filePath = writeSyntheticDB2(tempDir, "Size.db2");

      const result = inspectDB2File(filePath);

      expect(result.success).toBe(true);
      expect(result.fileSize).toBeGreaterThan(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Compatibility Assessment
  // ---------------------------------------------------------------------------
  describe("Compatibility Assessment", () => {
    it("should mark compatible when same table hash and layout hash", () => {
      const fileA = writeSyntheticDB2(tempDir, "A.db2", {
        tableHash: 0x11111111,
        layoutHash: 0xAAAAAAAA,
        recordCount: 100,
      });
      const fileB = writeSyntheticDB2(tempDir, "B.db2", {
        tableHash: 0x11111111,
        layoutHash: 0xAAAAAAAA,
        recordCount: 200, // different count but same schema
      });

      const result = diffDB2Files(fileA, fileB);

      expect(result.success).toBe(true);
      expect(result.compatibility.compatible).toBe(true);
      expect(result.compatibility.sameTable).toBe(true);
      expect(result.compatibility.sameLayout).toBe(true);
    });

    it("should mark incompatible when layout hash changes", () => {
      const fileA = writeSyntheticDB2(tempDir, "A.db2", {
        tableHash: 0x11111111,
        layoutHash: 0xAAAAAAAA,
      });
      const fileB = writeSyntheticDB2(tempDir, "B.db2", {
        tableHash: 0x11111111,
        layoutHash: 0xBBBBBBBB,
      });

      const result = diffDB2Files(fileA, fileB);

      expect(result.success).toBe(true);
      // Layout hash change is a warning, but it's not "compatible" because the schema changed
      expect(result.compatibility.sameLayout).toBe(false);
    });

    it("should count severity levels correctly", () => {
      const fileA = writeSyntheticDB2(tempDir, "A.db2", {
        tableHash: 0x11111111,
        layoutHash: 0xAAAAAAAA,
        fieldCount: 4,
        totalFieldCount: 4,
        recordSize: 16,
        recordCount: 100,
        stringTableSize: 1024,
      });
      const fileB = writeSyntheticDB2(tempDir, "B.db2", {
        tableHash: 0x22222222,  // breaking
        layoutHash: 0xBBBBBBBB, // warning
        fieldCount: 5,           // breaking
        totalFieldCount: 5,      // warning
        recordSize: 20,          // breaking
        recordCount: 150,        // info
        stringTableSize: 2048,   // info
        fieldEntries: [
          { unusedBits: 0, offset: 0 },
          { unusedBits: 0, offset: 4 },
          { unusedBits: 16, offset: 8 },
          { unusedBits: 16, offset: 10 },
          { unusedBits: 0, offset: 12 },
        ],
      });

      const result = diffDB2Files(fileA, fileB);

      expect(result.success).toBe(true);
      expect(result.compatibility.breakingChanges).toBeGreaterThanOrEqual(3);
      expect(result.compatibility.warnings).toBeGreaterThanOrEqual(1);
      expect(result.compatibility.infoChanges).toBeGreaterThanOrEqual(1);
    });
  });
});
