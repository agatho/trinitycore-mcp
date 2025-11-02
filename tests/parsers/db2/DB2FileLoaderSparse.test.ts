/**
 * Unit tests for DB2FileLoaderSparse
 * Tests catalog-based sparse record loading
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { DB2FileLoaderSparse } from '../../../src/parsers/db2/DB2FileLoaderSparse';
import { DB2MemorySource } from '../../../src/parsers/db2/DB2FileSource';
import {
  DB2Header,
  DB2SectionHeader,
  DB2ColumnMeta,
  DB2ColumnCompression,
} from '../../../src/parsers/db2/DB2Header';

describe('DB2FileLoaderSparse', () => {
  let mockHeader: DB2Header;
  let mockSections: DB2SectionHeader[];
  let mockColumnMeta: DB2ColumnMeta[];

  beforeEach(() => {
    // Create mock header
    mockHeader = {
      signature: 'WDC5',
      version: 1,
      schema: 'TestSchema',
      recordCount: 5,
      fieldCount: 3,
      recordSize: 12,
      stringTableSize: 100,
      tableHash: 12345,
      layoutHash: 67890,
      minId: 1,
      maxId: 5,
      locale: 0,
      flags: 0,
      indexField: -1,
      totalFieldCount: 3,
      packedDataOffset: 0,
      parentLookupCount: 0,
      columnMetaSize: 0,
      commonDataSize: 0,
      palletDataSize: 0,
      sectionCount: 1,
    };

    // Create mock section header with catalog data
    mockSections = [
      {
        tactId: 0n,
        fileOffset: 244, // After header (204) + section header (40)
        recordCount: 5,
        stringTableSize: 100,
        catalogDataOffset: 304, // After header + section header + 60 bytes
        idTableSize: 0,
        parentLookupDataSize: 0,
        catalogDataCount: 5, // 5 catalog entries
        copyTableCount: 0,
      },
    ];

    // Create mock column metadata (no compression)
    mockColumnMeta = [
      {
        bitOffset: 0,
        bitSize: 32,
        additionalDataSize: 0,
        compressionType: DB2ColumnCompression.None,
        compressionData: {},
      },
      {
        bitOffset: 32,
        bitSize: 32,
        additionalDataSize: 0,
        compressionType: DB2ColumnCompression.None,
        compressionData: {},
      },
      {
        bitOffset: 64,
        bitSize: 32,
        additionalDataSize: 0,
        compressionType: DB2ColumnCompression.None,
        compressionData: {},
      },
    ];
  });

  it('should create sparse loader instance', () => {
    const buffer = Buffer.alloc(1024);
    const source = new DB2MemorySource(buffer);

    const loader = new DB2FileLoaderSparse(
      source,
      mockHeader,
      mockSections,
      mockColumnMeta
    );

    expect(loader).toBeDefined();
    expect(loader.getHeader()).toBe(mockHeader);
  });

  it('should load catalog data from section', () => {
    // Create buffer with mock catalog data
    const buffer = Buffer.alloc(1024);

    // Write catalog entries at offset 304 (5 entries × 6 bytes each = 30 bytes)
    // Entry format: uint32 fileOffset + uint16 recordSize
    let catalogOffset = 304;

    // Entry 0: offset 400, size 12
    buffer.writeUInt32LE(400, catalogOffset);
    buffer.writeUInt16LE(12, catalogOffset + 4);
    catalogOffset += 6;

    // Entry 1: offset 412, size 12
    buffer.writeUInt32LE(412, catalogOffset);
    buffer.writeUInt16LE(12, catalogOffset + 4);
    catalogOffset += 6;

    // Entry 2: offset 424, size 12
    buffer.writeUInt32LE(424, catalogOffset);
    buffer.writeUInt16LE(12, catalogOffset + 4);
    catalogOffset += 6;

    // Entry 3: offset 436, size 12
    buffer.writeUInt32LE(436, catalogOffset);
    buffer.writeUInt16LE(12, catalogOffset + 4);
    catalogOffset += 6;

    // Entry 4: offset 448, size 12
    buffer.writeUInt32LE(448, catalogOffset);
    buffer.writeUInt16LE(12, catalogOffset + 4);

    // Write mock record data at the specified offsets
    // Record 0 at offset 400: [1, 10, 100]
    buffer.writeUInt32LE(1, 400);
    buffer.writeUInt32LE(10, 404);
    buffer.writeUInt32LE(100, 408);

    // Record 1 at offset 412: [2, 20, 200]
    buffer.writeUInt32LE(2, 412);
    buffer.writeUInt32LE(20, 416);
    buffer.writeUInt32LE(200, 420);

    const source = new DB2MemorySource(buffer);
    const loader = new DB2FileLoaderSparse(
      source,
      mockHeader,
      mockSections,
      mockColumnMeta
    );

    const result = loader.loadCatalogData(0);
    expect(result).toBe(true);
    expect(loader.getRecordCount()).toBe(5);
  });

  it('should retrieve sparse records by index', () => {
    // Create buffer with mock catalog and record data
    const buffer = Buffer.alloc(1024);

    // Write catalog entries at offset 304
    let catalogOffset = 304;
    buffer.writeUInt32LE(400, catalogOffset); // Record 0 offset
    buffer.writeUInt16LE(12, catalogOffset + 4); // Record 0 size
    catalogOffset += 6;
    buffer.writeUInt32LE(412, catalogOffset); // Record 1 offset
    buffer.writeUInt16LE(12, catalogOffset + 4);
    catalogOffset += 6;
    buffer.writeUInt32LE(424, catalogOffset); // Record 2 offset
    buffer.writeUInt16LE(12, catalogOffset + 4);

    // Write record data
    // Record 0: [1, 10, 100]
    buffer.writeUInt32LE(1, 400);
    buffer.writeUInt32LE(10, 404);
    buffer.writeUInt32LE(100, 408);

    // Record 1: [2, 20, 200]
    buffer.writeUInt32LE(2, 412);
    buffer.writeUInt32LE(20, 416);
    buffer.writeUInt32LE(200, 420);

    // Record 2: [3, 30, 300]
    buffer.writeUInt32LE(3, 424);
    buffer.writeUInt32LE(30, 428);
    buffer.writeUInt32LE(300, 432);

    // Adjust section for 3 records
    mockSections[0].recordCount = 3;
    mockSections[0].catalogDataCount = 3;

    const source = new DB2MemorySource(buffer);
    const loader = new DB2FileLoaderSparse(
      source,
      mockHeader,
      mockSections,
      mockColumnMeta
    );

    loader.loadCatalogData(0);

    // Get record 0
    const record0 = loader.getRecord(0);
    expect(record0).not.toBeNull();
    expect(record0!.getUInt32(0)).toBe(1);
    expect(record0!.getUInt32(1)).toBe(10);
    expect(record0!.getUInt32(2)).toBe(100);

    // Get record 1
    const record1 = loader.getRecord(1);
    expect(record1).not.toBeNull();
    expect(record1!.getUInt32(0)).toBe(2);
    expect(record1!.getUInt32(1)).toBe(20);
    expect(record1!.getUInt32(2)).toBe(200);

    // Get record 2
    const record2 = loader.getRecord(2);
    expect(record2).not.toBeNull();
    expect(record2!.getUInt32(0)).toBe(3);
    expect(record2!.getUInt32(1)).toBe(30);
    expect(record2!.getUInt32(2)).toBe(300);
  });

  it('should return null for non-existent record', () => {
    const buffer = Buffer.alloc(1024);
    const source = new DB2MemorySource(buffer);

    const loader = new DB2FileLoaderSparse(
      source,
      mockHeader,
      mockSections,
      mockColumnMeta
    );

    // Don't load catalog data
    const record = loader.getRecord(999);
    expect(record).toBeNull();
  });

  it('should check if record exists in catalog', () => {
    const buffer = Buffer.alloc(1024);

    // Write catalog entry
    buffer.writeUInt32LE(400, 304);
    buffer.writeUInt16LE(12, 308);

    mockSections[0].catalogDataCount = 1;
    mockSections[0].recordCount = 1;

    const source = new DB2MemorySource(buffer);
    const loader = new DB2FileLoaderSparse(
      source,
      mockHeader,
      mockSections,
      mockColumnMeta
    );

    loader.loadCatalogData(0);

    expect(loader.hasRecord(0)).toBe(true);
    expect(loader.hasRecord(1)).toBe(false);
    expect(loader.hasRecord(999)).toBe(false);
  });

  it('should return all record indices', () => {
    const buffer = Buffer.alloc(1024);

    // Write 3 catalog entries
    let catalogOffset = 304;
    for (let i = 0; i < 3; i++) {
      buffer.writeUInt32LE(400 + i * 12, catalogOffset);
      buffer.writeUInt16LE(12, catalogOffset + 4);
      catalogOffset += 6;
    }

    mockSections[0].catalogDataCount = 3;
    mockSections[0].recordCount = 3;

    const source = new DB2MemorySource(buffer);
    const loader = new DB2FileLoaderSparse(
      source,
      mockHeader,
      mockSections,
      mockColumnMeta
    );

    loader.loadCatalogData(0);

    const indices = loader.getRecordIndices();
    expect(indices).toEqual([0, 1, 2]);
  });

  it('should get catalog entry for debugging', () => {
    const buffer = Buffer.alloc(1024);

    // Write catalog entry
    buffer.writeUInt32LE(500, 304); // File offset
    buffer.writeUInt16LE(24, 308);  // Record size

    mockSections[0].catalogDataCount = 1;
    mockSections[0].recordCount = 1;

    const source = new DB2MemorySource(buffer);
    const loader = new DB2FileLoaderSparse(
      source,
      mockHeader,
      mockSections,
      mockColumnMeta
    );

    loader.loadCatalogData(0);

    const entry = loader.getCatalogEntry(0);
    expect(entry).not.toBeNull();
    expect(entry!.fileOffset).toBe(500);
    expect(entry!.recordSize).toBe(24);
  });

  it('should load all catalog data for multiple sections', () => {
    // Create header with 2 sections
    mockHeader.sectionCount = 2;

    // Create 2 sections
    const sections: DB2SectionHeader[] = [
      {
        tactId: 0n,
        fileOffset: 244,
        recordCount: 2,
        stringTableSize: 50,
        catalogDataOffset: 304,
        idTableSize: 0,
        parentLookupDataSize: 0,
        catalogDataCount: 2,
        copyTableCount: 0,
      },
      {
        tactId: 0n,
        fileOffset: 400,
        recordCount: 2,
        stringTableSize: 50,
        catalogDataOffset: 460,
        idTableSize: 0,
        parentLookupDataSize: 0,
        catalogDataCount: 2,
        copyTableCount: 0,
      },
    ];

    const buffer = Buffer.alloc(2048);

    // Write catalog for section 0
    buffer.writeUInt32LE(500, 304);
    buffer.writeUInt16LE(12, 308);
    buffer.writeUInt32LE(512, 310);
    buffer.writeUInt16LE(12, 314);

    // Write catalog for section 1
    buffer.writeUInt32LE(600, 460);
    buffer.writeUInt16LE(12, 464);
    buffer.writeUInt32LE(612, 466);
    buffer.writeUInt16LE(12, 470);

    const source = new DB2MemorySource(buffer);
    const loader = new DB2FileLoaderSparse(
      source,
      mockHeader,
      sections,
      mockColumnMeta
    );

    const result = loader.loadAllCatalogData();
    expect(result).toBe(true);
    // Note: Each section loads independently in sparse loader
    // getRecordCount() returns the count for the currently loaded section
    expect(loader.getRecordCount()).toBeGreaterThan(0);
  });

  it('should handle variable-sized records in catalog', () => {
    const buffer = Buffer.alloc(1024);

    // Write catalog with variable sizes
    let catalogOffset = 304;

    // Record 0: offset 400, size 8 (smaller)
    buffer.writeUInt32LE(400, catalogOffset);
    buffer.writeUInt16LE(8, catalogOffset + 4);
    catalogOffset += 6;

    // Record 1: offset 408, size 16 (larger)
    buffer.writeUInt32LE(408, catalogOffset);
    buffer.writeUInt16LE(16, catalogOffset + 4);
    catalogOffset += 6;

    // Record 2: offset 424, size 12 (normal)
    buffer.writeUInt32LE(424, catalogOffset);
    buffer.writeUInt16LE(12, catalogOffset + 4);

    // Write record data
    buffer.writeUInt32LE(1, 400);
    buffer.writeUInt32LE(10, 404);

    buffer.writeUInt32LE(2, 408);
    buffer.writeUInt32LE(20, 412);
    buffer.writeUInt32LE(200, 416);
    buffer.writeUInt32LE(2000, 420);

    buffer.writeUInt32LE(3, 424);
    buffer.writeUInt32LE(30, 428);
    buffer.writeUInt32LE(300, 432);

    mockSections[0].catalogDataCount = 3;
    mockSections[0].recordCount = 3;

    const source = new DB2MemorySource(buffer);
    const loader = new DB2FileLoaderSparse(
      source,
      mockHeader,
      mockSections,
      mockColumnMeta
    );

    loader.loadCatalogData(0);

    // All records should be retrievable despite size differences
    expect(loader.getRecord(0)).not.toBeNull();
    expect(loader.getRecord(1)).not.toBeNull();
    expect(loader.getRecord(2)).not.toBeNull();
  });

  it('should get min and max IDs from header', () => {
    const buffer = Buffer.alloc(1024);
    const source = new DB2MemorySource(buffer);

    mockHeader.minId = 100;
    mockHeader.maxId = 200;

    const loader = new DB2FileLoaderSparse(
      source,
      mockHeader,
      mockSections,
      mockColumnMeta
    );

    expect(loader.getMinId()).toBe(100);
    expect(loader.getMaxId()).toBe(200);
  });

  it('should get section header by index', () => {
    const buffer = Buffer.alloc(1024);
    const source = new DB2MemorySource(buffer);

    const loader = new DB2FileLoaderSparse(
      source,
      mockHeader,
      mockSections,
      mockColumnMeta
    );

    const section = loader.getSectionHeader(0);
    expect(section).toBe(mockSections[0]);
    expect(section.catalogDataCount).toBe(5);
  });

  it('should throw error for invalid section index', () => {
    const buffer = Buffer.alloc(1024);
    const source = new DB2MemorySource(buffer);

    const loader = new DB2FileLoaderSparse(
      source,
      mockHeader,
      mockSections,
      mockColumnMeta
    );

    expect(() => loader.getSectionHeader(999)).toThrow('Invalid section index');
  });
});
