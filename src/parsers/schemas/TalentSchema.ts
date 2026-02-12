/**
 * TalentSchema.ts
 *
 * Schema parser for Talent.db2 (LEGACY WoW talent system, pre-Dragonflight)
 * NOTE: This represents the pre-10.0 talent system. Modern WoW 12.0 uses the
 * Trait system (TraitTree.db2, TraitNode.db2, etc.) for class/spec talents
 * and Hero Talents.
 *
 * Based on TrinityCore DB2Structure.h:4276 and DB2LoadInfo.h:5976
 * Total Fields: 28
 * Layout Hash: 0x147B0045 (WoW 12.0)
 * File Data ID: 1369062
 *
 * Week 5: Phase 3.1 - Extended DB2 File Schemas
 */

import { DB2Record } from '../db2/DB2Record';

/**
 * Talent Learn Result Enumeration
 * Result codes for talent learning/validation
 */
export enum TalentLearnResult {
  OK = 0, // Success
  UNKNOWN = 1, // Unknown error
  NOT_ENOUGH_TALENTS_IN_PRIMARY_TREE = 2, // Insufficient talent points
  NO_PRIMARY_TREE_SELECTED = 3, // No specialization selected
  CANT_DO_THAT_RIGHT_NOW = 4, // Cannot perform action now
  AFFECTING_COMBAT = 5, // In combat
  CANT_REMOVE_TALENT = 6, // Cannot unlearn talent
  CANT_DO_THAT_CHALLENGE_MODE_ACTIVE = 7, // Challenge mode active
  REST_AREA = 8, // Must be in rest area
}

/**
 * Talent System Constants
 */
export const MAX_TALENT_TIERS = 7; // Maximum rows (0-6)
export const MAX_TALENT_COLUMNS = 4; // Maximum columns (0-3)
export const MAX_TALENT_RANKS = 9; // Maximum multi-ranks
export const MAX_PREREQ_TALENTS = 3; // Maximum prerequisites

/**
 * Talent.db2 Entry Interface
 * Complete legacy talent definition with 28 fields
 */
export interface TalentEntry {
  // Field 0: Primary key
  id: number; // uint32 - Unique talent identifier

  // Field 1: Localized tooltip text
  description: string; // LocalizedString - Talent description shown in UI

  // Field 2: Row position (0-6)
  tierID: number; // uint8 - Vertical position in talent tree

  // Field 3: Talent flags (purpose unknown)
  flags: number; // int32 - Special talent behaviors

  // Field 4: Column position (0-3)
  columnIndex: number; // uint8 - Horizontal position in talent tree

  // Field 5: Talent tab/tree ID (DEPRECATED, use SpecID)
  tabID: number; // uint16 - Previously represented different talent trees

  // Field 6: Character class (-1=all, 0-11=specific class)
  classID: number; // int8 - Class this talent belongs to (see ChrClasses.db2)

  // Field 7: Specialization (0=all specs, >0=specific spec)
  specID: number; // uint16 - ChrSpecialization.db2 reference

  // Field 8: Primary spell granted
  spellID: number; // uint32 - Main spell granted by this talent (Spell.db2 reference)

  // Field 9: Spell this talent replaces
  overridesSpellID: number; // uint32 - Replaces existing spell when learned

  // Field 10: Required spell before learning
  requiredSpellID: number; // uint32 - Must have this spell to learn talent

  // Fields 11-12: Category masks (purpose unknown)
  categoryMask: [number, number]; // int32[2] - Bit masks for talent categories

  // Fields 13-21: Multi-rank spell IDs (9 ranks max)
  spellRank: [
    number, // Rank 1
    number, // Rank 2
    number, // Rank 3
    number, // Rank 4
    number, // Rank 5
    number, // Rank 6
    number, // Rank 7
    number, // Rank 8
    number, // Rank 9
  ]; // uint32[9] - Spell IDs for each rank (0 = rank not available)

  // Fields 22-24: Prerequisite talent IDs
  prereqTalent: [
    number, // Prerequisite 1
    number, // Prerequisite 2
    number, // Prerequisite 3
  ]; // uint32[3] - Up to 3 required talents (0 = no prerequisite)

  // Fields 25-27: Prerequisite talent ranks
  prereqRank: [
    number, // Prerequisite 1 minimum rank
    number, // Prerequisite 2 minimum rank
    number, // Prerequisite 3 minimum rank
  ]; // uint8[3] - Minimum rank for each prerequisite (0 = any rank)
}

/**
 * Talent Position Helper
 * Describes talent location in talent tree grid
 */
export interface TalentPosition {
  classID: number; // 0-11 or -1 for all classes
  tierID: number; // 0-6 (row position)
  columnIndex: number; // 0-3 (column position)
}

/**
 * Talent.db2 Schema Parser
 */
export class TalentSchema {
  /**
   * Convert uint8 to int8 (signed byte)
   * @param value Unsigned 8-bit value
   * @returns Signed 8-bit value
   */
  private static convertToInt8(value: number): number {
    // Convert unsigned byte to signed byte (-128 to 127)
    return value > 127 ? value - 256 : value;
  }

  /**
   * Parse Talent.db2 record
   * @param record DB2 record to parse
   * @returns Parsed TalentEntry
   */
  public static parse(record: DB2Record): TalentEntry {
    // NOTE: Actual field order may vary - this is based on TrinityCore's structure
    // Field indices derived from DB2Structure.h and DB2LoadInfo.h

    return {
      // Field 0: ID
      id: record.getUInt32(0),

      // Field 1: Description (localized string - using first locale for MVP)
      description: record.getString(1),

      // Field 2: TierID
      tierID: record.getUInt8(2),

      // Field 3: Flags
      flags: record.getInt32(3),

      // Field 4: ColumnIndex
      columnIndex: record.getUInt8(4),

      // Field 5: TabID
      tabID: record.getUInt16(5),

      // Field 6: ClassID
      classID: this.convertToInt8(record.getUInt8(6)),

      // Field 7: SpecID
      specID: record.getUInt16(7),

      // Field 8: SpellID
      spellID: record.getUInt32(8),

      // Field 9: OverridesSpellID
      overridesSpellID: record.getUInt32(9),

      // Field 10: RequiredSpellID
      requiredSpellID: record.getUInt32(10),

      // Fields 11-12: CategoryMask
      categoryMask: [record.getInt32(11), record.getInt32(12)],

      // Fields 13-21: SpellRank (9 ranks)
      spellRank: [
        record.getUInt32(13), // Rank 1
        record.getUInt32(14), // Rank 2
        record.getUInt32(15), // Rank 3
        record.getUInt32(16), // Rank 4
        record.getUInt32(17), // Rank 5
        record.getUInt32(18), // Rank 6
        record.getUInt32(19), // Rank 7
        record.getUInt32(20), // Rank 8
        record.getUInt32(21), // Rank 9
      ],

      // Fields 22-24: PrereqTalent
      prereqTalent: [
        record.getUInt32(22), // Prerequisite 1
        record.getUInt32(23), // Prerequisite 2
        record.getUInt32(24), // Prerequisite 3
      ],

      // Fields 25-27: PrereqRank
      prereqRank: [
        record.getUInt8(25), // Prerequisite 1 rank
        record.getUInt8(26), // Prerequisite 2 rank
        record.getUInt8(27), // Prerequisite 3 rank
      ],
    };
  }

  /**
   * Get talent position
   * @param entry TalentEntry
   * @returns TalentPosition
   */
  public static getPosition(entry: TalentEntry): TalentPosition {
    return {
      classID: entry.classID,
      tierID: entry.tierID,
      columnIndex: entry.columnIndex,
    };
  }

  /**
   * Check if talent has prerequisites
   * @param entry TalentEntry
   * @returns True if has prerequisites
   */
  public static hasPrerequisites(entry: TalentEntry): boolean {
    return entry.prereqTalent.some((id) => id !== 0);
  }

  /**
   * Get prerequisite count
   * @param entry TalentEntry
   * @returns Number of prerequisites (0-3)
   */
  public static getPrerequisiteCount(entry: TalentEntry): number {
    return entry.prereqTalent.filter((id) => id !== 0).length;
  }

  /**
   * Check if talent has multiple ranks
   * @param entry TalentEntry
   * @returns True if multi-rank talent
   */
  public static hasMultipleRanks(entry: TalentEntry): boolean {
    return entry.spellRank.filter((rank) => rank !== 0).length > 1;
  }

  /**
   * Get rank count
   * @param entry TalentEntry
   * @returns Number of ranks (1-9)
   */
  public static getRankCount(entry: TalentEntry): number {
    return entry.spellRank.filter((rank) => rank !== 0).length;
  }

  /**
   * Get maximum rank spell ID
   * @param entry TalentEntry
   * @returns Highest rank spell ID (0 if no spells)
   */
  public static getMaxRankSpellID(entry: TalentEntry): number {
    const ranks = entry.spellRank.filter((rank) => rank !== 0);
    return ranks.length > 0 ? ranks[ranks.length - 1] : 0;
  }

  /**
   * Check if talent grants a spell
   * @param entry TalentEntry
   * @returns True if has spell
   */
  public static grantsSpell(entry: TalentEntry): boolean {
    return entry.spellID !== 0;
  }

  /**
   * Check if talent overrides a spell
   * @param entry TalentEntry
   * @returns True if overrides spell
   */
  public static overridesSpell(entry: TalentEntry): boolean {
    return entry.overridesSpellID !== 0;
  }

  /**
   * Check if talent has spell requirement
   * @param entry TalentEntry
   * @returns True if requires spell
   */
  public static requiresSpell(entry: TalentEntry): boolean {
    return entry.requiredSpellID !== 0;
  }

  /**
   * Validate tier ID (0-6)
   * @param tierID Tier ID to validate
   * @returns True if valid
   */
  public static isValidTier(tierID: number): boolean {
    return tierID >= 0 && tierID < MAX_TALENT_TIERS;
  }

  /**
   * Validate column index (0-3)
   * @param columnIndex Column index to validate
   * @returns True if valid
   */
  public static isValidColumn(columnIndex: number): boolean {
    return columnIndex >= 0 && columnIndex < MAX_TALENT_COLUMNS;
  }

  /**
   * Validate rank (1-9)
   * @param rank Rank to validate
   * @returns True if valid
   */
  public static isValidRank(rank: number): boolean {
    return rank >= 1 && rank <= MAX_TALENT_RANKS;
  }

  /**
   * Check if talent is for all classes
   * @param entry TalentEntry
   * @returns True if all-class talent
   */
  public static isAllClassTalent(entry: TalentEntry): boolean {
    return entry.classID === -1;
  }

  /**
   * Check if talent is for all specs
   * @param entry TalentEntry
   * @returns True if all-spec talent
   */
  public static isAllSpecTalent(entry: TalentEntry): boolean {
    return entry.specID === 0;
  }

  /**
   * Get prerequisite talents with ranks
   * @param entry TalentEntry
   * @returns Array of {talentID, minRank} objects
   */
  public static getPrerequisites(
    entry: TalentEntry
  ): Array<{ talentID: number; minRank: number }> {
    const prerequisites: Array<{ talentID: number; minRank: number }> = [];

    for (let i = 0; i < MAX_PREREQ_TALENTS; i++) {
      if (entry.prereqTalent[i] !== 0) {
        prerequisites.push({
          talentID: entry.prereqTalent[i],
          minRank: entry.prereqRank[i] || 1, // Default to rank 1 if 0
        });
      }
    }

    return prerequisites;
  }

  /**
   * Get all spell IDs for talent (including ranks)
   * @param entry TalentEntry
   * @returns Array of spell IDs
   */
  public static getAllSpellIDs(entry: TalentEntry): number[] {
    const spells: number[] = [];

    // Add primary spell
    if (entry.spellID !== 0) {
      spells.push(entry.spellID);
    }

    // Add rank spells
    for (const rank of entry.spellRank) {
      if (rank !== 0 && !spells.includes(rank)) {
        spells.push(rank);
      }
    }

    return spells;
  }
}

/**
 * DB2 File Metadata
 */
export const TalentDB2Metadata = {
  fileName: 'Talent.db2',
  fileDataId: 1369062,
  layoutHash: 0x147b0045,
  fieldCount: 28,
  hasIndexField: false,
  hasParentIndexField: false,
  hotfixSelector: 'HOTFIX_SEL_TALENT',
  note: 'LEGACY talent system (pre-Dragonflight). Modern WoW 12.0 uses Trait system for class/spec talents and Hero Talents.',
};
