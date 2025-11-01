/**
 * DB2 Sparse File Loader for WoW 11.2 (The War Within)
 * Handles catalog-based sparse records where records are stored non-contiguously
 * Based on TrinityCore's DB2FileLoaderSparseImpl
 */

import {
  DB2Header,
  DB2SectionHeader,
  DB2ColumnMeta,
  DB2ColumnCompression,
} from './DB2Header';
import { IDB2FileSource } from './DB2FileSource';
import { DB2Record } from './DB2Record';

/**
 * Catalog entry for sparse record storage
 * Maps record index to file offset and size
 */
interface DB2CatalogEntry {
  fileOffset: number; // uint32 - Absolute offset in file
  recordSize: number; // uint16 - Size of this specific record
}

/**
 * DB2 Sparse File Loader
 * For files where records are stored in a catalog (non-contiguous)
 * More memory-efficient for files with variable-sized records
 */
export class DB2FileLoaderSparse {
  private source: IDB2FileSource;
  private header: DB2Header;
  private sections: DB2SectionHeader[];
  private columnMeta: DB2ColumnMeta[];
  private catalogEntries: Map<number, DB2CatalogEntry>; // recordIndex -> catalog entry
  private stringTable: Buffer | null = null;
  private fieldOffsets: number[]; // Offset of each field within record

  constructor(
    source: IDB2FileSource,
    header: DB2Header,
    sections: DB2SectionHeader[],
    columnMeta: DB2ColumnMeta[]
  ) {
    this.source = source;
    this.header = header;
    this.sections = sections;
    this.columnMeta = columnMeta;
    this.catalogEntries = new Map();
    this.fieldOffsets = [];

    this.calculateFieldOffsets();
  }

  /**
   * Load catalog data for a specific section
   * @param sectionIndex Section to load catalog for
   */
  public loadCatalogData(sectionIndex: number): boolean {
    if (sectionIndex < 0 || sectionIndex >= this.sections.length) {
      return false;
    }

    const section = this.sections[sectionIndex];

    // Check if section has catalog data
    if (section.catalogDataOffset === 0 || section.catalogDataCount === 0) {
      return false;
    }

    // Seek to catalog data
    if (!this.source.setPosition(section.catalogDataOffset)) {
      return false;
    }

    // Read catalog entries (6 bytes each: uint32 offset + uint16 size)
    const catalogSize = section.catalogDataCount * 6;
    const catalogBuffer = Buffer.alloc(catalogSize);

    if (!this.source.read(catalogBuffer, catalogSize)) {
      return false;
    }

    // Parse catalog entries
    let bufferOffset = 0;
    let recordIndex = 0;

    for (let i = 0; i < section.catalogDataCount; i++) {
      const entry: DB2CatalogEntry = {
        fileOffset: catalogBuffer.readUInt32LE(bufferOffset),
        recordSize: catalogBuffer.readUInt16LE(bufferOffset + 4),
      };

      this.catalogEntries.set(recordIndex, entry);
      recordIndex++;
      bufferOffset += 6;
    }

    // Load string table for this section
    if (section.stringTableSize > 0) {
      const stringTableOffset = section.fileOffset + section.catalogDataOffset + catalogSize;
      if (!this.source.setPosition(stringTableOffset)) {
        return false;
      }

      this.stringTable = Buffer.alloc(section.stringTableSize);
      if (!this.source.read(this.stringTable, section.stringTableSize)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Load all catalog data for all sections
   */
  public loadAllCatalogData(): boolean {
    for (let i = 0; i < this.sections.length; i++) {
      if (!this.loadCatalogData(i)) {
        // Some sections may not have catalog data, that's OK
        continue;
      }
    }
    return true;
  }

  /**
   * Get record by index
   * @param recordIndex Global record index (0-based)
   * @returns DB2Record accessor
   */
  public getRecord(recordIndex: number): DB2Record | null {
    const catalogEntry = this.catalogEntries.get(recordIndex);
    if (!catalogEntry) {
      return null;
    }

    // Seek to record data
    if (!this.source.setPosition(catalogEntry.fileOffset)) {
      return null;
    }

    // Read record data
    const recordBuffer = Buffer.alloc(catalogEntry.recordSize);
    if (!this.source.read(recordBuffer, catalogEntry.recordSize)) {
      return null;
    }

    // Create record accessor
    return new DB2Record(
      recordBuffer,
      this.stringTable || Buffer.alloc(0),
      this.columnMeta,
      recordIndex
    );
  }

  /**
   * Get total number of records
   * @returns Record count
   */
  public getRecordCount(): number {
    return this.catalogEntries.size;
  }

  /**
   * Get minimum record ID
   * @returns Min ID from header
   */
  public getMinId(): number {
    return this.header.minId;
  }

  /**
   * Get maximum record ID
   * @returns Max ID from header
   */
  public getMaxId(): number {
    return this.header.maxId;
  }

  /**
   * Get header
   * @returns DB2 header
   */
  public getHeader(): DB2Header {
    return this.header;
  }

  /**
   * Get section header
   * @param sectionIndex Section index
   * @returns Section header
   */
  public getSectionHeader(sectionIndex: number): DB2SectionHeader {
    if (sectionIndex < 0 || sectionIndex >= this.sections.length) {
      throw new Error(`Invalid section index: ${sectionIndex}`);
    }
    return this.sections[sectionIndex];
  }

  /**
   * Calculate field offsets within record
   * Based on column metadata bit offsets
   */
  private calculateFieldOffsets(): void {
    this.fieldOffsets = [];

    for (let i = 0; i < this.columnMeta.length; i++) {
      const meta = this.columnMeta[i];
      this.fieldOffsets.push(meta.bitOffset / 8);
    }
  }

  /**
   * Get field offset for a specific field
   * @param fieldIndex Field index
   * @returns Byte offset in record
   */
  public getFieldOffset(fieldIndex: number): number {
    if (fieldIndex < 0 || fieldIndex >= this.fieldOffsets.length) {
      return fieldIndex * 4; // Default: assume 4-byte fields
    }
    return this.fieldOffsets[fieldIndex];
  }

  /**
   * Check if record exists in catalog
   * @param recordIndex Record index to check
   * @returns True if record exists
   */
  public hasRecord(recordIndex: number): boolean {
    return this.catalogEntries.has(recordIndex);
  }

  /**
   * Get catalog entry for debugging
   * @param recordIndex Record index
   * @returns Catalog entry or null
   */
  public getCatalogEntry(recordIndex: number): DB2CatalogEntry | null {
    return this.catalogEntries.get(recordIndex) || null;
  }

  /**
   * Get all record indices in catalog
   * @returns Array of record indices
   */
  public getRecordIndices(): number[] {
    return Array.from(this.catalogEntries.keys()).sort((a, b) => a - b);
  }
}
