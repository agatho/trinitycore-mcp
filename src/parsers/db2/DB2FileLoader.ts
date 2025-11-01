/**
 * DB2 File Loader for WoW 11.2 (The War Within)
 * Based on TrinityCore's DB2FileLoader implementation
 * Supports WDC5/WDC6 formats with compression
 */

import {
  DB2Header,
  DB2SectionHeader,
  DB2ColumnMeta,
  DB2ColumnCompression,
  parseDB2Header,
  parseDB2SectionHeader,
  isValidDB2Signature,
} from './DB2Header';
import { IDB2FileSource, DB2FileSystemSource } from './DB2FileSource';
import { DB2Record } from './DB2Record';
import { DB2FileLoaderSparse } from './DB2FileLoaderSparse';
import { DB2IdTable, DB2CopyTable, DB2ParentLookupTable } from './DB2Tables';

export class DB2FileLoader {
  private source: IDB2FileSource | null = null;
  private header: DB2Header | null = null;
  private sections: DB2SectionHeader[] = [];
  private columnMeta: DB2ColumnMeta[] = [];
  private data: Buffer | null = null;
  private stringTable: Buffer | null = null;

  // Sparse loader support
  private sparseLoader: DB2FileLoaderSparse | null = null;
  private idTable: DB2IdTable | null = null;
  private copyTable: DB2CopyTable | null = null;
  private parentLookupTable: DB2ParentLookupTable | null = null;

  constructor() {}

  /**
   * Load DB2 file headers only (lightweight operation)
   * @param source File source to read from
   * @throws Error if headers are invalid
   */
  public loadHeaders(source: IDB2FileSource): void {
    if (!source.isOpen()) {
      throw new Error('DB2 file source is not open');
    }

    this.source = source;

    // Read header (204 bytes for WDC5/WDC6)
    const headerBuffer = Buffer.alloc(204);
    if (!source.read(headerBuffer, 204)) {
      throw new Error('Failed to read DB2 header');
    }

    this.header = parseDB2Header(headerBuffer);

    if (!isValidDB2Signature(this.header.signature)) {
      throw new Error(`Unsupported DB2 signature: ${this.header.signature}`);
    }

    // Read section headers
    this.sections = [];
    for (let i = 0; i < this.header.sectionCount; i++) {
      const sectionBuffer = Buffer.alloc(40);
      if (!source.read(sectionBuffer, 40)) {
        throw new Error(`Failed to read section header ${i}`);
      }
      this.sections.push(parseDB2SectionHeader(sectionBuffer, 0));
    }
  }

  /**
   * Load full DB2 file data
   * @param source File source to read from
   * @throws Error if data cannot be loaded
   */
  public load(source: IDB2FileSource): void {
    // Load headers first
    this.loadHeaders(source);

    if (!this.header) {
      throw new Error('Headers not loaded');
    }

    // Read column metadata if present
    if (this.header.columnMetaSize > 0) {
      this.loadColumnMeta(source, this.header.columnMetaSize);
    }

    // Check if this is a sparse file
    if (this.isSparseFile()) {
      // Use sparse loader for catalog-based records
      this.sparseLoader = new DB2FileLoaderSparse(
        source,
        this.header,
        this.sections,
        this.columnMeta
      );
      this.sparseLoader.loadAllCatalogData();
    } else {
      // Use regular dense record loading
      if (this.sections.length > 0) {
        this.loadSectionData(source, 0);
      }
    }

    // Load ID table if present
    if (this.header.minId !== this.header.maxId) {
      this.loadIdTable(source);
    }

    // Load copy table if present
    this.loadCopyTable(source);

    // Load parent lookup table if present
    if (this.header.parentLookupCount > 0) {
      this.loadParentLookupTable(source);
    }
  }

  /**
   * Load from file path
   * @param filePath Path to DB2 file
   */
  public loadFromFile(filePath: string): void {
    const source = new DB2FileSystemSource(filePath);
    try {
      this.load(source);
    } finally {
      source.close();
    }
  }

  /**
   * Get DB2 header
   * @returns Parsed header
   */
  public getHeader(): DB2Header {
    if (!this.header) {
      throw new Error('DB2 file not loaded');
    }
    return this.header;
  }

  /**
   * Get section header
   * @param section Section index
   * @returns Section header
   */
  public getSectionHeader(section: number): DB2SectionHeader {
    if (section < 0 || section >= this.sections.length) {
      throw new Error(`Invalid section index: ${section}`);
    }
    return this.sections[section];
  }

  /**
   * Get total record count across all sections
   * @returns Total records
   */
  public getRecordCount(): number {
    return this.sections.reduce((sum, section) => sum + section.recordCount, 0);
  }

  /**
   * Get record by index
   * @param recordNumber Record index (0-based, across all sections)
   * @returns DB2Record accessor
   */
  public getRecord(recordNumber: number): DB2Record {
    // Delegate to sparse loader if present
    if (this.sparseLoader) {
      const record = this.sparseLoader.getRecord(recordNumber);
      if (!record) {
        throw new Error(`Record ${recordNumber} not found in sparse loader`);
      }
      return record;
    }

    // Regular dense record loading
    if (!this.data || !this.stringTable) {
      throw new Error('DB2 data not loaded');
    }

    const header = this.getHeader();

    // Find which section contains this record
    let currentRecordIndex = 0;
    for (let sectionIndex = 0; sectionIndex < this.sections.length; sectionIndex++) {
      const section = this.sections[sectionIndex];
      if (recordNumber < currentRecordIndex + section.recordCount) {
        // Record is in this section
        const recordInSection = recordNumber - currentRecordIndex;
        const recordOffset = recordInSection * header.recordSize;
        const recordData = this.data.subarray(recordOffset, recordOffset + header.recordSize);

        return new DB2Record(recordData, this.stringTable, this.columnMeta, recordNumber);
      }
      currentRecordIndex += section.recordCount;
    }

    throw new Error(`Record ${recordNumber} not found`);
  }

  /**
   * Get table hash
   * @returns Table hash identifier
   */
  public getTableHash(): number {
    return this.getHeader().tableHash;
  }

  /**
   * Get layout hash
   * @returns Layout hash identifier
   */
  public getLayoutHash(): number {
    return this.getHeader().layoutHash;
  }

  /**
   * Get minimum ID in file
   * @returns Minimum record ID
   */
  public getMinId(): number {
    return this.getHeader().minId;
  }

  /**
   * Get maximum ID in file
   * @returns Maximum record ID
   */
  public getMaxId(): number {
    return this.getHeader().maxId;
  }

  /**
   * Load column metadata
   * @param source File source
   * @param size Size of metadata block
   */
  private loadColumnMeta(source: IDB2FileSource, size: number): void {
    const metaBuffer = Buffer.alloc(size);
    if (!source.read(metaBuffer, size)) {
      throw new Error('Failed to read column metadata');
    }

    this.columnMeta = [];
    const fieldCount = this.header!.fieldCount;

    // Parse each column's metadata (simplified - actual format is complex)
    let offset = 0;
    for (let i = 0; i < fieldCount && offset < size; i++) {
      const meta: DB2ColumnMeta = {
        bitOffset: metaBuffer.readUInt16LE(offset),
        bitSize: metaBuffer.readUInt16LE(offset + 2),
        additionalDataSize: metaBuffer.readUInt32LE(offset + 4),
        compressionType: metaBuffer.readUInt32LE(offset + 8) as DB2ColumnCompression,
        compressionData: {},
      };

      // Read compression-specific data based on type
      if (meta.compressionType === DB2ColumnCompression.Immediate ||
          meta.compressionType === DB2ColumnCompression.SignedImmediate) {
        meta.compressionData.immediate = {
          bitOffset: metaBuffer.readUInt32LE(offset + 12),
          bitWidth: metaBuffer.readUInt32LE(offset + 16),
          signed: meta.compressionType === DB2ColumnCompression.SignedImmediate,
        };
      } else if (meta.compressionType === DB2ColumnCompression.CommonData) {
        meta.compressionData.commonData = {
          value: metaBuffer.readUInt32LE(offset + 12),
        };
      } else if (meta.compressionType === DB2ColumnCompression.Pallet ||
                 meta.compressionType === DB2ColumnCompression.PalletArray) {
        meta.compressionData.pallet = {
          bitOffset: metaBuffer.readUInt32LE(offset + 12),
          bitWidth: metaBuffer.readUInt32LE(offset + 16),
          arraySize: metaBuffer.readUInt32LE(offset + 20),
        };
      }

      this.columnMeta.push(meta);
      offset += 24; // Size of each column meta entry
    }
  }

  /**
   * Load section data
   * @param source File source
   * @param sectionIndex Section to load
   */
  private loadSectionData(source: IDB2FileSource, sectionIndex: number): void {
    const section = this.sections[sectionIndex];
    const header = this.header!;

    // Seek to section data
    if (!source.setPosition(section.fileOffset)) {
      throw new Error(`Failed to seek to section ${sectionIndex}`);
    }

    // Read record data
    const recordDataSize = section.recordCount * header.recordSize;
    this.data = Buffer.alloc(recordDataSize);
    if (!source.read(this.data, recordDataSize)) {
      throw new Error(`Failed to read section ${sectionIndex} data`);
    }

    // Read string table
    if (section.stringTableSize > 0) {
      this.stringTable = Buffer.alloc(section.stringTableSize);
      if (!source.read(this.stringTable, section.stringTableSize)) {
        throw new Error(`Failed to read section ${sectionIndex} string table`);
      }
    } else {
      this.stringTable = Buffer.alloc(0);
    }
  }

  /**
   * Check if file uses sparse (catalog-based) storage
   * @returns True if any section has catalog data
   */
  private isSparseFile(): boolean {
    for (const section of this.sections) {
      if (section.catalogDataCount > 0 && section.catalogDataOffset > 0) {
        return true;
      }
    }
    return false;
  }

  /**
   * Load ID table for record ID to index mapping
   * @param source File source
   */
  private loadIdTable(source: IDB2FileSource): void {
    for (const section of this.sections) {
      if (section.idTableSize === 0) {
        continue;
      }

      // Calculate ID table offset (after string table)
      const idTableOffset = section.fileOffset +
                           section.recordCount * this.header!.recordSize +
                           section.stringTableSize;

      if (!source.setPosition(idTableOffset)) {
        continue;
      }

      // Read ID table
      const idTableBuffer = Buffer.alloc(section.idTableSize);
      if (!source.read(idTableBuffer, section.idTableSize)) {
        continue;
      }

      // Parse ID table
      if (!this.idTable) {
        this.idTable = new DB2IdTable();
      }
      const entryCount = section.idTableSize / 8; // Each entry is 8 bytes (2x uint32)
      this.idTable.loadFromBuffer(idTableBuffer, entryCount);
    }
  }

  /**
   * Load copy table for record aliasing
   * @param source File source
   */
  private loadCopyTable(source: IDB2FileSource): void {
    for (const section of this.sections) {
      if (section.copyTableCount === 0) {
        continue;
      }

      // Calculate copy table offset (after ID table)
      const idTableSize = section.idTableSize || 0;
      const copyTableOffset = section.fileOffset +
                             section.recordCount * this.header!.recordSize +
                             section.stringTableSize +
                             idTableSize;

      if (!source.setPosition(copyTableOffset)) {
        continue;
      }

      // Read copy table
      const copyTableSize = section.copyTableCount * 8; // Each entry is 8 bytes (2x uint32)
      const copyTableBuffer = Buffer.alloc(copyTableSize);
      if (!source.read(copyTableBuffer, copyTableSize)) {
        continue;
      }

      // Parse copy table
      if (!this.copyTable) {
        this.copyTable = new DB2CopyTable();
      }
      this.copyTable.loadFromBuffer(copyTableBuffer, section.copyTableCount);
    }
  }

  /**
   * Load parent lookup table for foreign key relationships
   * @param source File source
   */
  private loadParentLookupTable(source: IDB2FileSource): void {
    for (const section of this.sections) {
      if (section.parentLookupDataSize === 0) {
        continue;
      }

      // Calculate parent lookup offset (implementation depends on file structure)
      // This is a simplified approach - actual offset calculation may vary
      const parentLookupOffset = section.fileOffset +
                                section.recordCount * this.header!.recordSize +
                                section.stringTableSize +
                                (section.idTableSize || 0) +
                                (section.copyTableCount * 8 || 0);

      if (!source.setPosition(parentLookupOffset)) {
        continue;
      }

      // Read parent lookup table
      const parentLookupBuffer = Buffer.alloc(section.parentLookupDataSize);
      if (!source.read(parentLookupBuffer, section.parentLookupDataSize)) {
        continue;
      }

      // Parse parent lookup table
      if (!this.parentLookupTable) {
        this.parentLookupTable = new DB2ParentLookupTable();
      }
      const entryCount = section.parentLookupDataSize / 8; // Each entry is 8 bytes (2x uint32)
      this.parentLookupTable.loadFromBuffer(parentLookupBuffer, entryCount);
    }
  }

  /**
   * Get ID table (if loaded)
   * @returns ID table or null
   */
  public getIdTable(): DB2IdTable | null {
    return this.idTable;
  }

  /**
   * Get copy table (if loaded)
   * @returns Copy table or null
   */
  public getCopyTable(): DB2CopyTable | null {
    return this.copyTable;
  }

  /**
   * Get parent lookup table (if loaded)
   * @returns Parent lookup table or null
   */
  public getParentLookupTable(): DB2ParentLookupTable | null {
    return this.parentLookupTable;
  }

  /**
   * Check if file is using sparse loader
   * @returns True if sparse loader is active
   */
  public isSparse(): boolean {
    return this.sparseLoader !== null;
  }
}
