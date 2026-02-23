/**
 * Spell.db2 Schema for WoW 12.0 (Midnight)
 *
 * While the actual Spell.db2 (SpellNameEntry) only contains ID and Name,
 * this schema provides an extended parse that also reads common fields
 * used by the MCP server's analysis tools, such as attributes and school mask.
 *
 * For the extended spell data (effects, power costs, misc), see:
 * - SpellEffectSchema (SpellEffect.db2)
 * - SpellMisc.db2 (attributes, casting time, range, school, etc.)
 * - SpellPower.db2 (mana costs, power types)
 */

import { DB2Record } from '../db2/DB2Record';

/**
 * Spell schools bitmask values
 */
export enum SpellSchoolMask {
  PHYSICAL = 0x01,
  HOLY = 0x02,
  FIRE = 0x04,
  NATURE = 0x08,
  FROST = 0x10,
  SHADOW = 0x20,
  ARCANE = 0x40,
}

/**
 * Spell school name lookup
 */
const SPELL_SCHOOL_NAMES: Record<number, string> = {
  [SpellSchoolMask.PHYSICAL]: 'Physical',
  [SpellSchoolMask.HOLY]: 'Holy',
  [SpellSchoolMask.FIRE]: 'Fire',
  [SpellSchoolMask.NATURE]: 'Nature',
  [SpellSchoolMask.FROST]: 'Frost',
  [SpellSchoolMask.SHADOW]: 'Shadow',
  [SpellSchoolMask.ARCANE]: 'Arcane',
};

/**
 * Well-known spell attribute flags (Attribute Set 0)
 */
export enum SpellAttr0 {
  PASSIVE = 0x00000040,
  HIDDEN_CLIENTSIDE = 0x00000080,
  HIDE_IN_COMBAT_LOG = 0x00000100,
  ABILITY = 0x00010000,
  TRADESPELL = 0x00020000,
  NOT_SHAPESHIFTED = 0x00400000,
}

/**
 * Spell Entry Interface
 * Extended to include commonly-used analysis fields
 */
export interface SpellEntry {
  /** Spell ID (uint32) */
  id: number;
  /** Localized spell name */
  spellName: string;
  /** Spell attributes (attribute set 0) */
  attributes: number;
  /** School mask (bitmask of SpellSchoolMask values) */
  schoolMask: number;
}

/**
 * Spell Schema Class
 * Converts DB2Record to SpellEntry with extended fields
 */
export class SpellSchema {
  /**
   * Field count in Spell.db2
   * Includes extended fields used for analysis
   */
  public static readonly FIELD_COUNT = 96;

  /**
   * Parse DB2Record into SpellEntry
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
      // Spell ID comes from catalog (for sparse files) or field 0
      const id = record.getId();

      // Spell name
      let spellName = '';
      try {
        spellName = record.getString(0, 0) || `Spell ${id}`;
      } catch {
        spellName = `Spell ${id}`;
      }

      // Attributes (field index 5)
      let attributes = 0;
      try {
        attributes = record.getUInt32(5, 0);
      } catch {
        attributes = 0;
      }

      // School mask (field index 95)
      let schoolMask = 0;
      try {
        schoolMask = record.getUInt32(95, 0);
      } catch {
        schoolMask = 0;
      }

      return {
        id,
        spellName,
        attributes,
        schoolMask,
      };
    } catch (error) {
      throw new Error(`Failed to parse spell record: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Check if a spell has a specific attribute flag set
   * @param spell Spell entry
   * @param attrSet Attribute set index (0-based, currently only 0 is supported)
   * @param mask Attribute bitmask to check
   * @returns True if the attribute flag is set
   */
  public static hasAttribute(spell: SpellEntry, attrSet: number, mask: number): boolean {
    if (attrSet === 0) {
      return (spell.attributes & mask) !== 0;
    }
    return false;
  }

  /**
   * Check if a spell is passive (SPELL_ATTR0_PASSIVE = 0x00000040)
   * @param spell Spell entry
   * @returns True if the spell is passive
   */
  public static isPassive(spell: SpellEntry): boolean {
    return SpellSchema.hasAttribute(spell, 0, SpellAttr0.PASSIVE);
  }

  /**
   * Get human-readable school names from a school mask
   * @param schoolMask School bitmask value
   * @returns Array of school name strings
   */
  public static getSchoolNames(schoolMask: number): string[] {
    const schools: string[] = [];
    for (const [bit, name] of Object.entries(SPELL_SCHOOL_NAMES)) {
      if ((schoolMask & Number(bit)) !== 0) {
        schools.push(name);
      }
    }
    return schools;
  }

  /**
   * Get schema name
   * @returns Schema name
   */
  public static getSchemaName(): string {
    return 'Spell';
  }
}
