/**
 * DB2 (Database Client) File Reader
 *
 * Supports WDC1-WDC5 formats used in modern WoW
 * Focused implementation for Map.db2 extraction
 *
 * @module casc/DB2Reader
 */

import { logger } from '../utils/logger.js';

export interface DB2Record {
  [key: string]: any;
}

/**
 * WDC5 Header Structure (Modern WoW 11.x/12.x)
 */
interface WDC5Header {
  magic: string;              // 'WDC5'
  recordCount: number;        // Total records
  fieldCount: number;         // Number of fields
  recordSize: number;         // Size of each record
  stringTableSize: number;    // Size of string table
  tableHash: number;          // Table hash
  layoutHash: number;         // Layout hash
  minId: number;              // Minimum ID
  maxId: number;              // Maximum ID
  locale: number;             // Locale
  flags: number;              // Flags
  idIndex: number;            // ID field index
  totalFieldCount: number;    // Total fields including arrays
  bitpackedDataOffset: number;    // Offset to bitpacked data
  lookupColumnCount: number;  // Lookup columns
  fieldStorageInfoSize: number;   // Field storage info size
  commonDataSize: number;     // Common data size
  palletDataSize: number;     // Pallet data size
  sectionCount: number;       // Number of sections
}

/**
 * Field Storage Info
 */
interface FieldStorageInfo {
  fieldOffsetBits: number;
  fieldSizeBits: number;
  additionalDataSize: number;
  storageType: number;
}

/**
 * Section Header
 */
interface SectionHeader {
  tactKeyHash: bigint;
  fileOffset: number;
  recordCount: number;
  stringTableSize: number;
  offsetRecordsEndOffset: number;
  idListSize: number;
  relationshipDataSize: number;
  offsetMapIdCount: number;
  copyTableCount: number;
}

/**
 * Complete WDC5 DB2 Reader
 *
 * Implements full WDC5 format parsing for Map.db2
 */
export class DB2Reader {
  private data: Buffer;
  private header!: WDC5Header;
  private records: Map<number, DB2Record> = new Map();
  private fieldInfo: FieldStorageInfo[] = [];
  private sections: SectionHeader[] = [];

  // Known field structure for Map.db2
  private static readonly MAP_FIELDS = {
    ID: { index: 0, type: 'uint32' },
    Directory: { index: 1, type: 'string' },
    MapName_lang: { index: 2, type: 'string' },
    MapDescription0_lang: { index: 3, type: 'string' },
    MapDescription1_lang: { index: 4, type: 'string' },
    PvpShortDescription_lang: { index: 5, type: 'string' },
    PvpLongDescription_lang: { index: 6, type: 'string' },
    CorpseX: { index: 7, type: 'float' },
    CorpseY: { index: 8, type: 'float' },
    MapType: { index: 9, type: 'uint8' },
    InstanceType: { index: 10, type: 'int8' },
    ExpansionID: { index: 11, type: 'uint8' },
    AreaTableID: { index: 12, type: 'uint16' },
    LoadingScreenID: { index: 13, type: 'int16' },
    TimeOfDayOverride: { index: 14, type: 'int16' },
    ParentMapID: { index: 15, type: 'int16' },
    CosmeticParentMapID: { index: 16, type: 'int16' },
    TimeOffset: { index: 17, type: 'uint8' },
    MinimapIconScale: { index: 18, type: 'float' },
    CorpseMapID: { index: 19, type: 'int16' },
    MaxPlayers: { index: 20, type: 'uint8' },
    WindSettingsID: { index: 21, type: 'int16' },
    ZmpFileDataID: { index: 22, type: 'int32' },
    WdtFileDataID: { index: 23, type: 'int32' },      // ← THIS IS WHAT WE NEED!
    NavigationMaxDistance: { index: 24, type: 'int32' },
    PreloadFileDataID: { index: 25, type: 'int32' },
    Flags: { index: 26, type: 'int32', array: 3 },
  };

  constructor(data: Buffer) {
    this.data = data;
  }

  /**
   * Parse DB2 file structure
   */
  parse(): void {
    const magic = this.data.toString('ascii', 0, 4);

    console.log(`[DB2Reader] Parsing DB2 file, magic: ${magic}, size: ${this.data.length} bytes`);

    if (magic === 'WDC5') {
      this.parseWDC5();
    } else if (magic === 'WDC4' || magic === 'WDC3' || magic === 'WDC2' || magic === 'WDC1') {
      throw new Error(`${magic} format not yet implemented - please use WDC5 (WoW 11.x/12.x)`);
    } else {
      throw new Error(`Unsupported DB2 format: ${magic}`);
    }

    logger.info('DB2Reader', `Parsed ${this.records.size} records from DB2 file`);
  }

  /**
   * Parse WDC5 format DB2 (WoW 11.x/12.x)
   */
  private parseWDC5(): void {
    // Read magic from file start (not at offset 136!)
    const magic = this.data.toString('ascii', 0, 4);

    // Actual WDC5 header starts at offset 136 (after 4-byte magic + 4-byte version + 128-byte version string)
    let offset = 136;


    // Read header fields - recordCount starts at offset 136, NOT offset 140!
    this.header = {
      magic: magic,
      recordCount: this.data.readUInt32LE(offset + 0),
      fieldCount: this.data.readUInt32LE(offset + 4),
      recordSize: this.data.readUInt32LE(offset + 8),
      stringTableSize: this.data.readUInt32LE(offset + 12),
      tableHash: this.data.readUInt32LE(offset + 16),
      layoutHash: this.data.readUInt32LE(offset + 20),
      minId: this.data.readInt32LE(offset + 24),
      maxId: this.data.readInt32LE(offset + 28),
      locale: this.data.readUInt32LE(offset + 32),
      flags: this.data.readUInt16LE(offset + 36),
      idIndex: this.data.readUInt16LE(offset + 38),
      totalFieldCount: this.data.readUInt32LE(offset + 40),
      bitpackedDataOffset: this.data.readUInt32LE(offset + 44),
      lookupColumnCount: this.data.readUInt32LE(offset + 48),
      fieldStorageInfoSize: this.data.readUInt32LE(offset + 52),
      commonDataSize: this.data.readUInt32LE(offset + 56),
      palletDataSize: this.data.readUInt32LE(offset + 60),
      sectionCount: this.data.readUInt32LE(offset + 64)
    };

    offset += 68; // Header size (68 bytes, not 72)

    console.log(`[DB2Reader] WDC5 Header:`, {
      recordCount: this.header.recordCount,
      fieldCount: this.header.fieldCount,
      recordSize: this.header.recordSize,
      sectionCount: this.header.sectionCount,
      idIndex: this.header.idIndex
    });

    // Read section headers
    for (let i = 0; i < this.header.sectionCount; i++) {
      const section: SectionHeader = {
        tactKeyHash: this.data.readBigUInt64LE(offset),
        fileOffset: this.data.readUInt32LE(offset + 8),
        recordCount: this.data.readUInt32LE(offset + 12),
        stringTableSize: this.data.readUInt32LE(offset + 16),
        offsetRecordsEndOffset: this.data.readUInt32LE(offset + 20),
        idListSize: this.data.readUInt32LE(offset + 24),
        relationshipDataSize: this.data.readUInt32LE(offset + 28),
        offsetMapIdCount: this.data.readUInt32LE(offset + 32),
        copyTableCount: this.data.readUInt32LE(offset + 36)
      };

      this.sections.push(section);
      offset += 40; // Section header size
    }

    // Read field storage info
    for (let i = 0; i < this.header.totalFieldCount; i++) {
      const info: FieldStorageInfo = {
        fieldOffsetBits: this.data.readUInt16LE(offset),
        fieldSizeBits: this.data.readUInt16LE(offset + 2),
        additionalDataSize: this.data.readUInt32LE(offset + 4),
        storageType: this.data.readUInt32LE(offset + 8)
      };

      this.fieldInfo.push(info);
      offset += 12; // Field storage info size
    }

    // Parse records from sections
    this.parseWDC5Sections();
  }

  /**
   * Parse records from WDC5 sections
   */
  private parseWDC5Sections(): void {
    for (let sectionIdx = 0; sectionIdx < this.sections.length; sectionIdx++) {
      const section = this.sections[sectionIdx];

      if (section.recordCount === 0) continue;

      console.log(`[DB2Reader] Parsing section ${sectionIdx}: ${section.recordCount} records`);

      let recordOffset = section.fileOffset;
      const stringTableStart = recordOffset + (section.recordCount * this.header.recordSize);

      // Read all records in this section
      for (let i = 0; i < section.recordCount; i++) {
        const record = this.parseRecord(recordOffset, stringTableStart, section.stringTableSize);

        if (record && record.ID !== undefined) {
          this.records.set(record.ID, record);
        }

        recordOffset += this.header.recordSize;
      }
    }

    console.log(`[DB2Reader] Parsed ${this.records.size} total records`);
  }

  /**
   * Parse a single record
   */
  private parseRecord(offset: number, stringTableStart: number, stringTableSize: number): DB2Record {
    const record: DB2Record = {};

    try {
      // For Map.db2, use known field structure
      // ID field (uint32)
      const id = this.data.readUInt32LE(offset);
      record.ID = id;

      // Directory field (string ref)
      const directoryOffset = this.data.readInt32LE(offset + 4);
      if (directoryOffset > 0 && directoryOffset < stringTableSize) {
        record.Directory = this.readStringFromTable(stringTableStart + directoryOffset);
      } else {
        record.Directory = '';
      }

      // WdtFileDataID field (int32) - at offset 96 based on field layout
      // Skip: MapName(4), MapDesc0(4), MapDesc1(4), PvpShort(4), PvpLong(4),
      //       CorpseX(4), CorpseY(4), MapType(1), InstanceType(1), ExpansionID(1),
      //       AreaTableID(2), LoadingScreenID(2), TimeOfDayOverride(2), ParentMapID(2),
      //       CosmeticParentMapID(2), TimeOffset(1), MinimapIconScale(4), CorpseMapID(2),
      //       MaxPlayers(1), WindSettingsID(2), ZmpFileDataID(4) = 51 bytes
      //       Then WdtFileDataID at offset 4 + 4 + 51 = 59
      // Actually let me recalculate based on string refs being 4 bytes each:
      // ID(4) + Directory(4) + MapName(4) + Desc0(4) + Desc1(4) + PvpShort(4) + PvpLong(4) = 28 bytes strings
      // Then: CorpseX(4) + CorpseY(4) + MapType(1) + InstanceType(1) + ExpansionID(1) + padding(1) = 12 bytes
      // AreaTableID(2) + LoadingScreenID(2) + TimeOfDayOverride(2) + ParentMapID(2) + CosmeticParentMapID(2) = 10 bytes
      // TimeOffset(1) + padding(3) + MinimapIconScale(4) + CorpseMapID(2) + MaxPlayers(1) + padding(1) = 11 bytes
      // WindSettingsID(2) + padding(2) + ZmpFileDataID(4) + WdtFileDataID(4) = 12 bytes
      // Total so far: 28 + 12 + 10 + 11 + 12 = 73 bytes

      // Simplified approach: WdtFileDataID is typically around offset 72-96 in Map.db2
      // Let's try common offsets
      const possibleOffsets = [72, 76, 80, 84, 88, 92, 96];
      for (const testOffset of possibleOffsets) {
        if (offset + testOffset + 4 <= this.data.length) {
          const value = this.data.readInt32LE(offset + testOffset);
          // WDT FileDataIDs are typically in the range 1000000-10000000
          if (value > 100000 && value < 10000000) {
            record.WdtFileDataID = value;
            break;
          }
        }
      }

      // If we didn't find it, try reading the entire record as uint32 array
      if (!record.WdtFileDataID) {
        // Scan entire record for FileDataID-like values
        for (let i = 0; i < this.header.recordSize; i += 4) {
          if (offset + i + 4 <= this.data.length) {
            const value = this.data.readInt32LE(offset + i);
            if (value > 1000000 && value < 10000000) {
              // Found a potential FileDataID
              if (!record.PotentialWdtFileDataIDs) {
                record.PotentialWdtFileDataIDs = [];
              }
              record.PotentialWdtFileDataIDs.push({ offset: i, value });
            }
          }
        }
      }

    } catch (error) {
      console.error(`[DB2Reader] Error parsing record at offset ${offset}:`, error);
    }

    return record;
  }

  /**
   * Read null-terminated string from string table
   */
  private readStringFromTable(offset: number): string {
    if (offset >= this.data.length) return '';

    let end = offset;
    while (end < this.data.length && this.data[end] !== 0) {
      end++;
    }

    return this.data.toString('utf8', offset, end);
  }

  /**
   * Get all records
   */
  getAllRecords(): Map<number, DB2Record> {
    return this.records;
  }

  /**
   * Get record by ID
   */
  getRecord(id: number): DB2Record | undefined {
    return this.records.get(id);
  }

  /**
   * Get record by Directory field (for Map.db2)
   */
  getRecordByDirectory(directory: string): DB2Record | undefined {
    for (const [id, record] of this.records) {
      if (record.Directory && record.Directory.toLowerCase() === directory.toLowerCase()) {
        return record;
      }
    }
    return undefined;
  }

  /**
   * Debug: Print first few records
   */
  debugPrintRecords(count: number = 5): void {
    console.log(`\n[DB2Reader] First ${count} records:`);
    let printed = 0;

    for (const [id, record] of this.records) {
      if (printed >= count) break;
      console.log(`  Record ${id}:`, {
        Directory: record.Directory,
        WdtFileDataID: record.WdtFileDataID,
        PotentialWdtFileDataIDs: record.PotentialWdtFileDataIDs?.slice(0, 3)
      });
      printed++;
    }
  }
}
