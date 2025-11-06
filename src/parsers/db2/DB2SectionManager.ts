/**
 * DB2 Section Manager
 *
 * Manages DB2 file sections, ID mappings, and offset tables for efficient
 * record lookup across multi-section DB2 files.
 *
 * @module parsers/db2/DB2SectionManager
 */

/**
 * Section ID mapping
 */
export interface SectionMapping {
  /** Section index */
  sectionIndex: number;

  /** Local index within section */
  localIndex: number;
}

/**
 * Offset map entry (for sparse files)
 */
export interface OffsetMapEntry {
  /** Record offset in file */
  offset: number;

  /** Record size in bytes */
  size: number;
}

/**
 * Section data
 */
interface SectionData {
  /** Section index */
  index: number;

  /** File offset where section starts */
  fileOffset: number;

  /** ID list for this section */
  idList: Map<number, number>; // spellId -> localIndex

  /** Offset map for sparse files */
  offsetMap: Map<number, OffsetMapEntry>;
}

/**
 * DB2 Section Manager
 *
 * Manages section-based record lookup for DB2 files.
 * Supports both inline (dense) and sparse file formats.
 */
export class DB2SectionManager {
  private sections: Map<number, SectionData> = new Map();
  private globalIdMap: Map<number, SectionMapping> = new Map();
  private diagnostics: {
    totalSections: number;
    totalRecords: number;
    sparseRecords: number;
    lookupTime: number;
  };

  constructor() {
    this.diagnostics = {
      totalSections: 0,
      totalRecords: 0,
      sparseRecords: 0,
      lookupTime: 0,
    };
  }

  /**
   * Add a section to the manager
   *
   * @param sectionIdx - Section index
   * @param fileOffset - Section file offset
   * @param sectionIdList - ID list for this section (Map<spellId, localIndex>)
   * @param sectionOffsetMap - Offset map for sparse files
   */
  addSection(
    sectionIdx: number,
    fileOffset: number,
    sectionIdList: Map<number, number>,
    sectionOffsetMap: Map<number, OffsetMapEntry>
  ): void {
    // Create section data
    const sectionData: SectionData = {
      index: sectionIdx,
      fileOffset,
      idList: sectionIdList,
      offsetMap: sectionOffsetMap,
    };

    // Store section
    this.sections.set(sectionIdx, sectionData);

    // Build global ID map for fast lookups
    for (const [spellId, localIndex] of sectionIdList) {
      this.globalIdMap.set(spellId, {
        sectionIndex: sectionIdx,
        localIndex,
      });
    }

    // Update diagnostics
    this.diagnostics.totalSections = this.sections.size;
    this.diagnostics.totalRecords += sectionIdList.size;
    this.diagnostics.sparseRecords += sectionOffsetMap.size;
  }

  /**
   * Find which section contains a spell ID
   *
   * @param id - Spell ID to find
   * @returns Section mapping or null if not found
   */
  findSpellId(id: number): SectionMapping | null {
    const startTime = Date.now();
    const mapping = this.globalIdMap.get(id) || null;
    this.diagnostics.lookupTime = Date.now() - startTime;
    return mapping;
  }

  /**
   * Get offset map entry for sparse files
   *
   * @param spellId - Spell ID
   * @returns Offset map entry or null
   */
  getOffsetMapEntry(spellId: number): OffsetMapEntry | null {
    // Find which section contains this ID
    const mapping = this.globalIdMap.get(spellId);
    if (!mapping) {
      return null;
    }

    // Get section data
    const section = this.sections.get(mapping.sectionIndex);
    if (!section) {
      return null;
    }

    // Return offset entry (null for dense/inline files)
    return section.offsetMap.get(spellId) || null;
  }

  /**
   * Get total number of sections
   *
   * @returns Section count
   */
  getSectionCount(): number {
    return this.sections.size;
  }

  /**
   * Get section data
   *
   * @param sectionIdx - Section index
   * @returns Section data or undefined
   */
  getSection(sectionIdx: number): SectionData | undefined {
    return this.sections.get(sectionIdx);
  }

  /**
   * Check if a spell ID exists
   *
   * @param id - Spell ID
   * @returns True if exists
   */
  has(id: number): boolean {
    return this.globalIdMap.has(id);
  }

  /**
   * Get all spell IDs
   *
   * @returns Array of all spell IDs
   */
  getAllIds(): number[] {
    return Array.from(this.globalIdMap.keys());
  }

  /**
   * Clear all sections
   */
  clear(): void {
    this.sections.clear();
    this.globalIdMap.clear();
    this.diagnostics = {
      totalSections: 0,
      totalRecords: 0,
      sparseRecords: 0,
      lookupTime: 0,
    };
  }

  /**
   * Get diagnostic information
   *
   * @returns Diagnostics object
   */
  getDiagnostics(): {
    totalSections: number;
    totalRecords: number;
    sparseRecords: number;
    averageSectionSize: number;
    lookupTime: number;
  } {
    return {
      ...this.diagnostics,
      averageSectionSize:
        this.diagnostics.totalSections > 0
          ? this.diagnostics.totalRecords / this.diagnostics.totalSections
          : 0,
    };
  }

  /**
   * Get statistics for debugging
   */
  getStats(): {
    sections: number;
    totalRecords: number;
    sparseRecords: number;
    denseRecords: number;
    memoryUsage: number;
  } {
    const denseRecords = this.diagnostics.totalRecords - this.diagnostics.sparseRecords;

    // Estimate memory usage
    // Each Map entry: ~50 bytes (rough estimate)
    // globalIdMap entries + all section idList entries
    const memoryUsage =
      this.globalIdMap.size * 50 +
      Array.from(this.sections.values()).reduce(
        (sum, section) => sum + section.idList.size * 50 + section.offsetMap.size * 70,
        0
      );

    return {
      sections: this.sections.size,
      totalRecords: this.diagnostics.totalRecords,
      sparseRecords: this.diagnostics.sparseRecords,
      denseRecords,
      memoryUsage,
    };
  }
}
