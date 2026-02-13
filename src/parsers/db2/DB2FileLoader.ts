/**
 * DB2 File Loader for WoW 12.0 (Midnight)
 * Based on TrinityCore's DB2FileLoader implementation
 * Supports WDC5/WDC6 formats with compression
 */

import {
  DB2Header,
  DB2SectionHeader,
  DB2ColumnMeta,
  DB2ColumnCompression,
  DB2FieldEntry,
  parseDB2Header,
  parseDB2SectionHeader,
  isValidDB2Signature,
} from './DB2Header';
import { logger } from '../../utils/logger';
import { IDB2FileSource, DB2FileSystemSource } from './DB2FileSource';
import { DB2Record } from './DB2Record';
import { DB2FileLoaderSparse } from './DB2FileLoaderSparse';
import { DB2IdList, DB2OffsetMap, DB2CopyTable, DB2ParentLookupTable } from './DB2Tables';
import { DB2SectionManager } from './DB2SectionManager';

export class DB2FileLoader {
  private source: IDB2FileSource | null = null;
  private header: DB2Header | null = null;
  private sections: DB2SectionHeader[] = [];
  private columnMeta: DB2ColumnMeta[] = [];
  private fieldEntries: DB2FieldEntry[] = []; // TrinityCore-style simple field metadata
  private data: Buffer | null = null;
  private stringTable: Buffer | null = null;

  // Multi-section support (WoWDev format)
  private sectionManager: DB2SectionManager = new DB2SectionManager();
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

    // Load ID list and offset map for ALL sections (WoWDev format)
    // This handles both sparse and dense files with section manager
    if (this.header.minId !== this.header.maxId) {
      this.loadIdListAndOffsetMap(source);
    } else {
      logger.warn(`⚠️  File has no ID range (minId == maxId), skipping ID list loading`);
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
   * NOTE: Keeps file source open for record retrieval
   */
  public loadFromFile(filePath: string): void {
    const source = new DB2FileSystemSource(filePath);
    this.load(source);
    // DO NOT close source - we need it for getRecord() calls!
    // The source will be stored in this.source from load()
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
   * Get record by spell ID (WoWDev format with multi-section support)
   * Uses section manager to find spell across all sections
   * @param spellId Spell ID to retrieve
   * @returns DB2Record accessor
   */
  public getRecord(spellId: number): DB2Record {
    // Step 1: Use section manager to find which section contains this spell
    const mapping = this.sectionManager.findSpellId(spellId);
    if (!mapping) {
      throw new Error(`Spell ID ${spellId} not found in any section (searched ${this.sectionManager.getSectionCount()} sections)`);
    }

    // Step 2: Determine if this is sparse or inline (dense) format
    const offsetEntry = this.sectionManager.getOffsetMapEntry(spellId);

    let recordOffset: number;
    let recordSize: number;
    let isSparse: boolean;

    if (offsetEntry) {
      // SPARSE FILE: Use offset from catalog
      recordOffset = offsetEntry.offset;
      recordSize = offsetEntry.size;
      isSparse = true;
    } else {
      // INLINE/DENSE FILE: Calculate offset from record index
      // Based on TrinityCore's DB2FileLoaderRegularImpl::GetRawRecordData()
      // Returns: &_data[recordNumber * _header->RecordSize]
      const section = this.sections[mapping.sectionIndex];
      recordOffset = section.fileOffset + (mapping.localIndex * this.header!.recordSize);
      recordSize = this.header!.recordSize;
      isSparse = false;
    }

    // Step 3: Load section's COMBINED buffer (like TrinityCore)
    // Trinity allocates: _data[RecordSize * RecordCount + StringTableSize]
    // Then sets: _stringTable = &_data[RecordSize * RecordCount]
    //
    // In TrinityCore's buffer, ALL sections' records come first, then ALL sections' strings.
    // Our per-section buffer only has ONE section's records then ONE section's strings.
    // We compute a stringOffsetCorrection to translate raw offsets to our buffer layout.
    const section = this.sections[mapping.sectionIndex];
    const recordDataSize = section.recordCount * this.header!.recordSize;
    const combinedSize = recordDataSize + section.stringTableSize;

    if (!this.source || !this.source.isOpen()) {
      throw new Error('DB2 file source not available for reading record data');
    }

    // Seek to section start
    if (!this.source.setPosition(section.fileOffset)) {
      throw new Error(`Failed to seek to section ${mapping.sectionIndex} for spell ${spellId}`);
    }

    // Allocate combined buffer and read entire section
    const combinedBuffer = Buffer.alloc(combinedSize);

    // Read all records
    if (!this.source.read(combinedBuffer.subarray(0, recordDataSize), recordDataSize)) {
      throw new Error(`Failed to read section ${mapping.sectionIndex} records`);
    }

    // Read string table (immediately after records)
    if (section.stringTableSize > 0) {
      if (!this.source.read(combinedBuffer.subarray(recordDataSize, combinedSize), section.stringTableSize)) {
        throw new Error(`Failed to read section ${mapping.sectionIndex} string table`);
      }
    }

    // Compute string offset correction for this section.
    //
    // TrinityCore's combined buffer layout:
    //   [Sec0 Records][Sec1 Records]...[SecN Records][Sec0 Strings][Sec1 Strings]...[SecN Strings]
    //   String table base = header.recordCount * recordSize (total across ALL sections)
    //
    // Our per-section buffer layout:
    //   [Section Records][Section Strings]
    //   String table base = section.recordCount * recordSize
    //
    // Raw string offsets in records are calibrated for TrinityCore's layout.
    // Correction translates TrinityCore absolute positions to our per-section positions:
    //   correction = (section.recordCount - header.recordCount) * recordSize
    //              + sectionRecordStartOffset - sectionStringTableStartOffset
    //
    // Where sectionRecordStartOffset = sum of previous sections' record data sizes
    //       sectionStringTableStartOffset = sum of previous sections' string table sizes
    let sectionRecordStartOffset = 0;
    let sectionStringTableStartOffset = 0;
    for (let i = 0; i < mapping.sectionIndex; i++) {
      sectionRecordStartOffset += this.sections[i].recordCount * this.header!.recordSize;
      sectionStringTableStartOffset += this.sections[i].stringTableSize;
    }

    const stringOffsetCorrection =
      (section.recordCount - this.header!.recordCount) * this.header!.recordSize
      + sectionRecordStartOffset
      - sectionStringTableStartOffset;

    return new DB2Record(
      combinedBuffer,
      combinedBuffer,
      this.columnMeta,
      mapping.localIndex,
      this.fieldEntries,
      spellId,
      isSparse,
      this.header!.recordSize,
      section.recordCount,
      section.fileOffset,
      stringOffsetCorrection
    );
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
   * Load column metadata (TrinityCore format)
   * @param source File source
   * @param size Size of metadata block
   */
  private loadColumnMeta(source: IDB2FileSource, size: number): void {
    const metaBuffer = Buffer.alloc(size);
    if (!source.read(metaBuffer, size)) {
      throw new Error('Failed to read column metadata');
    }

    this.fieldEntries = [];
    this.columnMeta = []; // Keep for backward compatibility
    const fieldCount = this.header!.fieldCount;

    // TrinityCore format: 4 bytes per field (int16 unusedBits + uint16 offset)
    let bufferOffset = 0;
    for (let i = 0; i < fieldCount && bufferOffset + 4 <= size; i++) {
      const fieldEntry: DB2FieldEntry = {
        unusedBits: metaBuffer.readInt16LE(bufferOffset),
        offset: metaBuffer.readUInt16LE(bufferOffset + 2),
      };
      this.fieldEntries.push(fieldEntry);
      bufferOffset += 4;

      // Create legacy DB2ColumnMeta for backward compatibility
      const fieldSize = 4 - Math.floor(fieldEntry.unusedBits / 8);
      const meta: DB2ColumnMeta = {
        bitOffset: fieldEntry.offset * 8,
        bitSize: fieldSize * 8,
        additionalDataSize: 0,
        compressionType: DB2ColumnCompression.None,
        compressionData: {},
      };
      this.columnMeta.push(meta);
    }

    logger.warn(`✅ Loaded ${this.fieldEntries.length} field entries (TrinityCore format)`);
    if (this.fieldEntries.length > 0) {
      logger.warn(`📊 First field: unusedBits=${this.fieldEntries[0].unusedBits}, offset=${this.fieldEntries[0].offset}`);
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

    // CRITICAL FIX: Allocate COMBINED buffer like TrinityCore
    // Trinity: _data = std::make_unique<uint8[]>(RecordSize * RecordCount + StringTableSize + 8);
    //          _stringTable = &_data[RecordSize * RecordCount];
    //
    // This ensures formulas like "record + fieldOffset + stringOffset" work correctly
    // because the string table is at offset (RecordSize * RecordCount) in the combined buffer
    const recordDataSize = section.recordCount * header.recordSize;
    const combinedSize = recordDataSize + section.stringTableSize;
    const combinedBuffer = Buffer.alloc(combinedSize);

    // Read record data into first part of combined buffer
    if (!source.read(combinedBuffer.subarray(0, recordDataSize), recordDataSize)) {
      throw new Error(`Failed to read section ${sectionIndex} data`);
    }

    // Read string table into second part of combined buffer (immediately after records)
    if (section.stringTableSize > 0) {
      if (!source.read(combinedBuffer.subarray(recordDataSize, combinedSize), section.stringTableSize)) {
        throw new Error(`Failed to read section ${sectionIndex} string table`);
      }
    }

    // Set data and stringTable to point into the combined buffer (like Trinity)
    // NOTE: this.data contains ALL records, this.stringTable points to offset (recordDataSize) in same buffer
    this.data = combinedBuffer.subarray(0, recordDataSize);
    this.stringTable = combinedBuffer.subarray(recordDataSize);
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
   * Load ID list and offset map for ALL sections (WoWDev Wiki format)
   * ID list: 4 bytes per entry (just the spell ID)
   * Offset map: 6 bytes per entry (uint32 offset + uint16 size)
   * @param source File source
   */
  private loadIdListAndOffsetMap(source: IDB2FileSource): void {
    // Clear section manager
    this.sectionManager.clear();

    logger.warn(`\n📂 Loading multi-section DB2 file with ${this.sections.length} sections...`);

    // Load ALL sections (not just the first one!)
    for (let sectionIdx = 0; sectionIdx < this.sections.length; sectionIdx++) {
      const section = this.sections[sectionIdx];

      if (section.idTableSize === 0) {
        logger.warn(`⚠️  Section ${sectionIdx}: No ID table (idTableSize = 0)`);
        continue;
      }

      logger.warn(`\n📊 Processing Section ${sectionIdx}:`);
      logger.warn(`   Catalog entries: ${section.catalogDataCount}`);
      logger.warn(`   ID table size: ${section.idTableSize} bytes`);
      logger.warn(`   Record count: ${section.recordCount}`);

      // CRITICAL FIX: TrinityCore reads catalog data in specific order
      // Based on DB2FileLoaderSparseImpl::LoadCatalogData() lines 1017-1045
      // Structure at catalogDataOffset:
      //   1. Array of spell IDs (uint32 × catalogDataCount) - _catalogIds
      //   2. Copy table (if copyTableCount > 0)
      //   3. Array of catalog entries (DB2CatalogEntry × catalogDataCount) - offset + size pairs

      let sectionIdList: DB2IdList | null = null;
      let sectionOffsetMap: DB2OffsetMap | null = null;

      if (section.catalogDataCount > 0 && section.catalogDataOffset > 0) {
        // SPARSE FILE: Load catalog IDs and catalog entries from catalogDataOffset
        logger.warn(`   📂 Sparse section - loading ${section.catalogDataCount} catalog entries`);

        if (!source.setPosition(section.catalogDataOffset)) {
          logger.warn(`   ❌ Failed to seek to catalog offset ${section.catalogDataOffset}`);
          continue;
        }

        // Step 1: Read catalogIds array (spell IDs) - 4 bytes per entry
        const catalogIdsSize = section.catalogDataCount * 4;
        const catalogIdsBuffer = Buffer.alloc(catalogIdsSize);

        if (!source.read(catalogIdsBuffer, catalogIdsSize)) {
          logger.warn(`   ❌ Failed to read ${catalogIdsSize} bytes for catalog IDs`);
          continue;
        }

        // Parse catalog IDs into ID list
        sectionIdList = new DB2IdList();
        sectionIdList.loadFromBuffer(catalogIdsBuffer, this.header!.minId, this.header!.maxId);
        logger.warn(`   ✅ Loaded ${catalogIdsSize / 4} catalog spell IDs`);

        // Step 2: Skip copy table if present (not needed for now)
        if (section.copyTableCount > 0) {
          const copyTableSize = section.copyTableCount * 8; // 8 bytes per entry
          source.skip(copyTableSize);
          logger.warn(`   ⏭️  Skipped ${copyTableSize} bytes of copy table data`);
        }

        // Step 3: Read catalog entries array (offset + size pairs) - 6 bytes per entry
        const catalogEntriesSize = section.catalogDataCount * 6;
        const catalogEntriesBuffer = Buffer.alloc(catalogEntriesSize);

        if (!source.read(catalogEntriesBuffer, catalogEntriesSize)) {
          logger.warn(`   ❌ Failed to read ${catalogEntriesSize} bytes for catalog entries`);
          continue;
        }

        // Parse catalog entries into offset map
        sectionOffsetMap = new DB2OffsetMap();
        sectionOffsetMap.loadFromBuffer(catalogEntriesBuffer, section.catalogDataCount);
        logger.warn(`   ✅ Loaded ${section.catalogDataCount} catalog entries (offset+size pairs)`);

      } else if (section.idTableSize > 0) {
        // DENSE FILE: Load ID list from after records + string table
        const idListOffset = section.fileOffset +
                            section.recordCount * this.header!.recordSize +
                            section.stringTableSize;

        logger.warn(`   📁 Dense section - loading ${section.idTableSize} bytes of ID list`);

        if (!source.setPosition(idListOffset)) {
          logger.warn(`   ❌ Failed to seek to ID list offset ${idListOffset}`);
          continue;
        }

        const idListBuffer = Buffer.alloc(section.idTableSize);
        if (!source.read(idListBuffer, section.idTableSize)) {
          logger.warn(`   ❌ Failed to read ${section.idTableSize} bytes for ID list`);
          continue;
        }

        sectionIdList = new DB2IdList();
        sectionIdList.loadFromBuffer(idListBuffer, this.header!.minId, this.header!.maxId);
        logger.warn(`   ✅ Loaded ${section.idTableSize / 4} IDs from dense ID list`);

        // Dense files don't have offset map - records are contiguous
        sectionOffsetMap = null;
      }

      // Add section to manager (convert DB2IdList and DB2OffsetMap to Maps for section manager)
      if (sectionIdList) {
        this.sectionManager.addSection(
          sectionIdx,
          section.fileOffset,
          sectionIdList.toMap(),
          sectionOffsetMap ? sectionOffsetMap.toMap(sectionIdList) : null
        );
        logger.warn(`   ✅ Section ${sectionIdx} loaded successfully`);
      } else {
        logger.warn(`   ⚠️  Section ${sectionIdx} has no ID list - skipping`);
      }
    }

    // Print diagnostics
    logger.warn(this.sectionManager.getDiagnostics());
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
   * Get section manager (contains all sections, ID lists, and offset maps)
   * @returns Section manager instance
   */
  public getSectionManager(): DB2SectionManager {
    return this.sectionManager;
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
   * Check if file is using sparse format
   * @returns True if any section has catalog data
   */
  public isSparse(): boolean {
    return this.isSparseFile();
  }
}
