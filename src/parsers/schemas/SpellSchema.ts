/**
 * Spell.db2 Schema for WoW 12.0 (Midnight)
 * Based on TrinityCore's SpellNameEntry structure (NOT SpellInfo!)
 * Source: src/server/game/DataStores/DB2Structure.h lines 4012-4016
 *
 * IMPORTANT: Spell.db2 only contains spell IDs and names!
 * Full spell data is in separate DB2 files:
 * - SpellMisc.db2 (attributes, casting time, range, school, etc.)
 * - SpellPower.db2 (mana costs, power types)
 * - SpellEffect.db2 (spell effects)
 * - etc.
 *
 * struct SpellNameEntry
 * {
 *     uint32 ID;              // SpellID
 *     LocalizedString Name;   // Spell name
 * };
 */

import { DB2Record } from '../db2/DB2Record';

/**
 * Minimal Spell Entry Interface
 * Matches actual Spell.db2 file structure (SpellNameEntry)
 */
export interface SpellEntry {
  id: number; // Spell ID (uint32) - Field 0
  spellName: string; // Localized spell name (LocalizedString) - Field 1
}

/**
 * Spell Schema Class
 * Converts DB2Record to SpellEntry
 */
export class SpellSchema {
  /**
   * Field count in Spell.db2
   * Based on header.fieldCount from file
   */
  public static readonly FIELD_COUNT = 3; // ID (1 field) + Name (string offset, 1 field) + padding

  /**
   * Parse DB2Record into SpellEntry (alias for fromRecord)
   * @param record DB2 record
   * @returns Spell entry object
   */
  public static parse(record: DB2Record): SpellEntry {
    return SpellSchema.fromRecord(record);
  }

  /**
   * Convert DB2Record to SpellEntry
   * @param record DB2 record
   * @returns Spell entry object
   */
  public static fromRecord(record: DB2Record): SpellEntry {
    try {
      // Spell ID comes from catalog (not from record data)
      const id = record.getId();

      // For sparse files (Spell.db2), the string is at field 0 (the only field in the record)
      // Record structure: just the spell name string (4 bytes typically)
      let spellName = '';
      try {
        spellName = record.getString(0, 0) || `Spell ${id}`;
      } catch (error) {
        // String field might not exist for minimal records
        spellName = `Spell ${id}`;
      }

      return {
        id,
        spellName,
      };
    } catch (error) {
      throw new Error(`Failed to parse spell record: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get schema name
   * @returns Schema name
   */
  public static getSchemaName(): string {
    return 'Spell';
  }
}
