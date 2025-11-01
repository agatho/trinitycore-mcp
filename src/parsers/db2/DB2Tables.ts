/**
 * DB2 Support Tables for WoW 11.2 (The War Within)
 * ID tables, copy tables, and parent lookup tables
 * Based on TrinityCore implementation
 */

/**
 * ID Table Entry
 * Maps record IDs to record indices for sparse files
 */
export interface DB2IdTableEntry {
  recordId: number; // uint32 - Actual record ID
  recordIndex: number; // uint32 - Index in record array
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
 * ID Table Manager
 * Manages mapping between record IDs and indices
 */
export class DB2IdTable {
  private entries: Map<number, number>; // recordId -> recordIndex

  constructor() {
    this.entries = new Map();
  }

  /**
   * Add ID table entry
   * @param recordId Record ID
   * @param recordIndex Record index
   */
  public add(recordId: number, recordIndex: number): void {
    this.entries.set(recordId, recordIndex);
  }

  /**
   * Get record index by ID
   * @param recordId Record ID to look up
   * @returns Record index or null if not found
   */
  public getRecordIndex(recordId: number): number | null {
    return this.entries.get(recordId) ?? null;
  }

  /**
   * Check if ID exists
   * @param recordId Record ID
   * @returns True if ID exists in table
   */
  public has(recordId: number): boolean {
    return this.entries.has(recordId);
  }

  /**
   * Get all record IDs
   * @returns Array of all record IDs
   */
  public getAllIds(): number[] {
    return Array.from(this.entries.keys()).sort((a, b) => a - b);
  }

  /**
   * Get total entries
   * @returns Number of entries
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
   * Load ID table from buffer
   * @param buffer Buffer containing ID table data
   * @param count Number of entries to read
   */
  public loadFromBuffer(buffer: Buffer, count: number): void {
    let offset = 0;

    for (let i = 0; i < count; i++) {
      const recordId = buffer.readUInt32LE(offset);
      const recordIndex = buffer.readUInt32LE(offset + 4);

      this.add(recordId, recordIndex);
      offset += 8;
    }
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
