/**
 * DB2 Support Tables for WoW 12.0 (Midnight)
 * ID tables, copy tables, and parent lookup tables
 * Based on TrinityCore implementation
 */

import { logger } from '../../utils/logger';


/**
 * ID List Entry (WoWDev Wiki Format)
 * Simple array of spell IDs (4 bytes each)
 * Position in array = index, value = spell ID
 */
export interface DB2IdListEntry {
  id: number; // uint32 - Record ID only
}

/**
 * Offset Map Entry (WoWDev Wiki Format)
 * Maps ID indices to file offsets for sparse files
 */
export interface DB2OffsetMapEntry {
  offset: number; // uint32 - Absolute file position
  size: number;   // uint16 - Record size in bytes
}

/**
 * Copy Table Entry
 * Allows one record to reference another's data
 */
export interface DB2CopyTableEntry {
  newRowId: number; // uint32 - New record ID
  sourceRowId: number; // uint32 - Source record ID to copy from
}

/**
 * Parent Lookup Entry
 * For foreign key relationships between records
 */
export interface DB2ParentLookupEntry {
  parentId: number; // uint32 - Parent record ID
  recordIndex: number; // uint32 - Child record index
}

/**
 * ID List Manager (Correct WoWDev Format)
 * Simple array where position = index, value = spell ID
 * Use offset_map to get file positions
 */
export class DB2IdList {
  private ids: number[] = []; // Array index = record index, value = spell ID
  private minId: number = 0;
  private maxId: number = 0;

  constructor() {}

  /**
   * Load ID list from buffer (4 bytes per entry)
   * @param buffer Buffer containing ID list data (uint32 array)
   * @param minId Minimum ID from header
   * @param maxId Maximum ID from header
   */
  public loadFromBuffer(buffer: Buffer, minId: number, maxId: number): void {
    this.minId = minId;
    this.maxId = maxId;
    this.ids = [];

    const count = Math.floor(buffer.length / 4);
    let offset = 0;

    for (let i = 0; i < count; i++) {
      if (offset + 4 > buffer.length) {
        logger.warn(`ID list buffer overflow at entry ${i}/${count}`);
        break;
      }

      const id = buffer.readUInt32LE(offset);
      this.ids.push(id);
      offset += 4;
    }

    logger.warn(`✅ ID list loaded ${this.ids.length} entries (minId: ${minId}, maxId: ${maxId})`);
    if (this.ids.length > 0) {
      logger.warn(`📊 First 10 IDs: ${this.ids.slice(0, Math.min(10, this.ids.length)).join(', ')}`);
    }
  }

  /**
   * Get index for a spell ID using minId offset
   * @param spellId Spell ID to look up
   * @returns Array index or null if out of range
   */
  public getIndexForId(spellId: number): number | null {
    const index = spellId - this.minId;

    if (index < 0 || index >= this.ids.length) {
      return null;
    }

    // Verify the ID at that position matches
    if (this.ids[index] !== spellId) {
      return null;
    }

    return index;
  }

  /**
   * Get spell ID at index
   * @param index Array index
   * @returns Spell ID or null if out of bounds
   */
  public getIdAtIndex(index: number): number | null {
    if (index < 0 || index >= this.ids.length) {
      return null;
    }
    return this.ids[index];
  }

  /**
   * Get all IDs
   * @returns Array of all spell IDs
   */
  public getAllIds(): number[] {
    return [...this.ids];
  }

  /**
   * Get total entries
   * @returns Number of entries
   */
  public getSize(): number {
    return this.ids.length;
  }

  /**
   * Convert to Map<spellId, localIndex> for section manager
   * @returns Map of spellId to local index
   */
  public toMap(): Map<number, number> {
    const map = new Map<number, number>();
    for (let i = 0; i < this.ids.length; i++) {
      map.set(this.ids[i], i);
    }
    return map;
  }

  /**
   * Clear all entries
   */
  public clear(): void {
    this.ids = [];
  }
}

/**
 * Offset Map Manager (for sparse files)
 * Maps array indices to file offsets
 */
export class DB2OffsetMap {
  private entries: DB2OffsetMapEntry[] = [];

  constructor() {}

  /**
   * Load offset map from buffer (6 bytes per entry)
   * @param buffer Buffer containing offset map data
   * @param count Number of entries
   */
  public loadFromBuffer(buffer: Buffer, count: number): void {
    this.entries = [];
    let offset = 0;

    for (let i = 0; i < count; i++) {
      if (offset + 6 > buffer.length) {
        logger.warn(`Offset map buffer overflow at entry ${i}/${count}`);
        break;
      }

      const fileOffset = buffer.readUInt32LE(offset);
      const recordSize = buffer.readUInt16LE(offset + 4);

      this.entries.push({
        offset: fileOffset,
        size: recordSize,
      });

      offset += 6;
    }

    logger.warn(`✅ Offset map loaded ${this.entries.length} entries`);
    if (this.entries.length > 0) {
      logger.warn(`📊 First entry: offset=${this.entries[0].offset}, size=${this.entries[0].size}`);
    }
  }

  /**
   * Get offset map entry at index
   * @param index Array index
   * @returns Offset map entry or null if out of bounds or offset is 0
   */
  public getEntry(index: number): DB2OffsetMapEntry | null {
    if (index < 0 || index >= this.entries.length) {
      return null;
    }

    const entry = this.entries[index];

    // Offset of 0 means no data for this ID
    if (entry.offset === 0) {
      return null;
    }

    return entry;
  }

  /**
   * Get total entries
   * @returns Number of entries
   */
  public getSize(): number {
    return this.entries.length;
  }

  /**
   * Convert to Map<spellId, OffsetMapEntry> for section manager
   * Note: Uses index as key since we need the spellId mapping from IdList
   * @param idList - ID list to map indices to spell IDs
   * @returns Map of spellId to offset entry
   */
  public toMap(idList: DB2IdList): Map<number, { offset: number; size: number }> {
    const map = new Map<number, { offset: number; size: number }>();
    for (let i = 0; i < this.entries.length; i++) {
      const entry = this.entries[i];
      if (entry.offset !== 0) {
        const spellId = idList.getIdAtIndex(i);
        if (spellId !== null) {
          map.set(spellId, { offset: entry.offset, size: entry.size });
        }
      }
    }
    return map;
  }

  /**
   * Clear all entries
   */
  public clear(): void {
    this.entries = [];
  }
}

/**
 * Copy Table Manager
 * Manages record copying/aliasing
 */
export class DB2CopyTable {
  private entries: Map<number, number>; // newRowId -> sourceRowId

  constructor() {
    this.entries = new Map();
  }

  /**
   * Add copy table entry
   * @param newRowId New record ID
   * @param sourceRowId Source record ID to copy from
   */
  public add(newRowId: number, sourceRowId: number): void {
    this.entries.set(newRowId, sourceRowId);
  }

  /**
   * Get source row ID for a copy
   * @param newRowId New record ID
   * @returns Source record ID or null if not a copy
   */
  public getSourceRowId(newRowId: number): number | null {
    return this.entries.get(newRowId) ?? null;
  }

  /**
   * Check if record is a copy
   * @param newRowId Record ID to check
   * @returns True if this ID is a copy of another record
   */
  public isCopy(newRowId: number): boolean {
    return this.entries.has(newRowId);
  }

  /**
   * Get all copy entries
   * @returns Array of copy table entries
   */
  public getAllCopies(): DB2CopyTableEntry[] {
    const copies: DB2CopyTableEntry[] = [];
    for (const [newRowId, sourceRowId] of this.entries) {
      copies.push({ newRowId, sourceRowId });
    }
    return copies;
  }

  /**
   * Get total copy entries
   * @returns Number of copy entries
   */
  public getSize(): number {
    return this.entries.size;
  }

  /**
   * Clear all entries
   */
  public clear(): void {
    this.entries.clear();
  }

  /**
   * Load copy table from buffer
   * @param buffer Buffer containing copy table data
   * @param count Number of entries to read
   */
  public loadFromBuffer(buffer: Buffer, count: number): void {
    let offset = 0;

    for (let i = 0; i < count; i++) {
      const newRowId = buffer.readUInt32LE(offset);
      const sourceRowId = buffer.readUInt32LE(offset + 4);

      this.add(newRowId, sourceRowId);
      offset += 8;
    }
  }
}

/**
 * Parent Lookup Table Manager
 * Manages parent-child relationships between records
 */
export class DB2ParentLookupTable {
  private entries: Map<number, number[]>; // parentId -> array of child record indices

  constructor() {
    this.entries = new Map();
  }

  /**
   * Add parent lookup entry
   * @param parentId Parent record ID
   * @param recordIndex Child record index
   */
  public add(parentId: number, recordIndex: number): void {
    if (!this.entries.has(parentId)) {
      this.entries.set(parentId, []);
    }
    this.entries.get(parentId)!.push(recordIndex);
  }

  /**
   * Get child record indices for a parent
   * @param parentId Parent record ID
   * @returns Array of child record indices
   */
  public getChildren(parentId: number): number[] {
    return this.entries.get(parentId) || [];
  }

  /**
   * Check if parent has children
   * @param parentId Parent record ID
   * @returns True if parent has children
   */
  public hasChildren(parentId: number): boolean {
    return this.entries.has(parentId) && this.entries.get(parentId)!.length > 0;
  }

  /**
   * Get all parent IDs
   * @returns Array of all parent IDs
   */
  public getAllParentIds(): number[] {
    return Array.from(this.entries.keys()).sort((a, b) => a - b);
  }

  /**
   * Get total parent count
   * @returns Number of unique parents
   */
  public getParentCount(): number {
    return this.entries.size;
  }

  /**
   * Get total child count
   * @returns Total number of child records
   */
  public getTotalChildCount(): number {
    let count = 0;
    for (const children of this.entries.values()) {
      count += children.length;
    }
    return count;
  }

  /**
   * Clear all entries
   */
  public clear(): void {
    this.entries.clear();
  }

  /**
   * Load parent lookup table from buffer
   * @param buffer Buffer containing parent lookup data
   * @param count Number of entries to read
   */
  public loadFromBuffer(buffer: Buffer, count: number): void {
    let offset = 0;

    for (let i = 0; i < count; i++) {
      const parentId = buffer.readUInt32LE(offset);
      const recordIndex = buffer.readUInt32LE(offset + 4);

      this.add(parentId, recordIndex);
      offset += 8;
    }
  }
}
