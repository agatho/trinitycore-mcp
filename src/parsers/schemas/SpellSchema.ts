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
 * Power cost information for a spell
 */
export interface SpellPowerCost {
  /** Power type (0=MANA, 1=RAGE, 2=FOCUS, 3=ENERGY, etc.) */
  power: number;
  /** Power cost amount */
  amount: number;
}

/**
 * Scaling information for a spell
 */
export interface SpellScalingInfo {
  /** Minimum level the spell scales from */
  minScalingLevel: number;
  /** Maximum level the spell scales to */
  maxScalingLevel: number;
  /** Whether the spell scales from item level */
  scalesFromItemLevel: number;
}

/**
 * Float value wrapper (for fields that store floats)
 */
export interface FloatField {
  /** The floating point value */
  value: number;
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
  /** Difficulty ID */
  difficulty: number;
  /** Category ID */
  categoryId: number;
  /** Dispel type */
  dispel: number;
  /** Mechanic */
  mechanic: number;
  /** Spell attributes (attribute set 0) */
  attributes: number;
  /** Spell attributes Ex (attribute set 1) */
  attributesEx: number;
  /** Spell attributes Ex2 (attribute set 2) */
  attributesEx2: number;
  /** Spell attributes Ex3 (attribute set 3) */
  attributesEx3: number;
  /** Spell attributes Ex4 (attribute set 4) */
  attributesEx4: number;
  /** Spell attributes Ex5 (attribute set 5) */
  attributesEx5: number;
  /** Spell attributes Ex6 (attribute set 6) */
  attributesEx6: number;
  /** Spell attributes Ex7 (attribute set 7) */
  attributesEx7: number;
  /** School mask (bitmask of SpellSchoolMask values) */
  schoolMask: number;
  /** Spell attributes Ex8 (attribute set 8) */
  attributesEx8: number;
  /** Spell attributes Ex9 (attribute set 9) */
  attributesEx9: number;
  /** Spell attributes Ex10 (attribute set 10) */
  attributesEx10: number;
  /** Spell attributes Ex11 (attribute set 11) */
  attributesEx11: number;
  /** Spell attributes Ex12 (attribute set 12) */
  attributesEx12: number;
  /** Spell attributes Ex13 (attribute set 13) */
  attributesEx13: number;
  /** Spell attributes Ex14 (attribute set 14) */
  attributesEx14: number;
  /** Spell attributes Ex15 (attribute set 15) */
  attributesEx15: number;
  /** Custom attributes */
  attributesCu: number;
  /** Stances bitmask */
  stances: bigint;
  /** Stances not allowed bitmask */
  stancesNot: bigint;
  /** Targets */
  targets: number;
  /** Target creature type */
  targetCreatureType: number;
  /** Cast time index */
  castTimeIndex: number;
  /** Power type (MANA=0, RAGE=1, etc.) */
  powerType: number;
  /** Power cost structured data */
  powerCost: SpellPowerCost;
  /** Mana cost per level */
  manaCostPerLevel: number;
  /** Mana per second */
  manaPerSecond: number;
  /** Mana per second per level */
  manaPerSecondPerLevel: number;
  /** Scaling information */
  scalingInfo: SpellScalingInfo;
  /** Reagent item IDs (8 slots) */
  reagent: number[];
  /** Reagent counts (8 slots) */
  reagentCount: number[];
  /** Totem item IDs (2 slots) */
  totem: number[];
  /** Totem category IDs (2 slots) */
  totemCategory: number[];
  /** Spell family name */
  spellFamilyName: number;
  /** Spell family flags (4 bigint values) */
  spellFamilyFlags: bigint[];
  /** AoE damage and healing diminishing factor */
  sqrtDamageAndHealingDiminishing: FloatField;
}

/**
 * Attribute set field index mapping
 * Maps attribute set index (0-15) to the field index in the record
 */
const ATTRIBUTE_FIELD_INDICES: Record<number, keyof SpellEntry> = {
  0: 'attributes',
  1: 'attributesEx',
  2: 'attributesEx2',
  3: 'attributesEx3',
  4: 'attributesEx4',
  5: 'attributesEx5',
  6: 'attributesEx6',
  7: 'attributesEx7',
  8: 'attributesEx8',
  9: 'attributesEx9',
  10: 'attributesEx10',
  11: 'attributesEx11',
  12: 'attributesEx12',
  13: 'attributesEx13',
  14: 'attributesEx14',
  15: 'attributesEx15',
};

/**
 * Spell Schema Class
 * Converts DB2Record to SpellEntry with extended fields
 */
export class SpellSchema {
  /**
   * Field count in Spell.db2
   * Includes extended fields used for analysis
   */
  public static readonly FIELD_COUNT = 104;

  /**
   * Parse DB2Record into SpellEntry
   * @param record DB2 record
   * @returns Spell entry object
   */
  public static parse(record: DB2Record): SpellEntry {
    return SpellSchema.fromRecord(record);
  }

  /**
   * Helper to safely read a uint32 field
   */
  private static safeUInt32(record: DB2Record, field: number, arrayIndex: number = 0): number {
    try {
      return record.getUInt32(field, arrayIndex);
    } catch {
      return 0;
    }
  }

  /**
   * Helper to safely read a uint64 (bigint) field
   */
  private static safeUInt64(record: DB2Record, field: number): bigint {
    try {
      return record.getUInt64(field);
    } catch {
      return BigInt(0);
    }
  }

  /**
   * Helper to safely read a float field
   */
  private static safeFloat(record: DB2Record, field: number, arrayIndex: number = 0): number {
    try {
      return record.getFloat(field, arrayIndex);
    } catch {
      return 0.0;
    }
  }

  /**
   * Helper to safely read a string field
   */
  private static safeString(record: DB2Record, field: number): string {
    try {
      return record.getString(field, 0) || '';
    } catch {
      return '';
    }
  }

  /**
   * Helper to safely read an array of uint32 values
   */
  private static safeUInt32Array(record: DB2Record, field: number, count: number): number[] {
    const result: number[] = [];
    for (let i = 0; i < count; i++) {
      result.push(SpellSchema.safeUInt32(record, field, i));
    }
    return result;
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

      // Spell name (field 0 if string, otherwise generated)
      let spellName = '';
      try {
        spellName = record.getString(0, 0) || `Spell ${id}`;
      } catch {
        spellName = `Spell ${id}`;
      }

      // Basic fields
      const difficulty = SpellSchema.safeUInt32(record, 1);
      const categoryId = SpellSchema.safeUInt32(record, 2);
      const dispel = SpellSchema.safeUInt32(record, 3);
      const mechanic = SpellSchema.safeUInt32(record, 4);

      // Attributes (fields 5-22)
      const attributes = SpellSchema.safeUInt32(record, 5);
      const attributesEx = SpellSchema.safeUInt32(record, 6);
      const attributesEx2 = SpellSchema.safeUInt32(record, 7);
      const attributesEx3 = SpellSchema.safeUInt32(record, 8);
      const attributesEx4 = SpellSchema.safeUInt32(record, 9);
      const attributesEx5 = SpellSchema.safeUInt32(record, 10);
      const attributesEx6 = SpellSchema.safeUInt32(record, 11);
      const attributesEx7 = SpellSchema.safeUInt32(record, 12);
      const schoolMask = SpellSchema.safeUInt32(record, 13);
      const attributesEx8 = SpellSchema.safeUInt32(record, 14);
      const attributesEx9 = SpellSchema.safeUInt32(record, 15);
      const attributesEx10 = SpellSchema.safeUInt32(record, 16);
      const attributesEx11 = SpellSchema.safeUInt32(record, 17);
      const attributesEx12 = SpellSchema.safeUInt32(record, 18);
      const attributesEx13 = SpellSchema.safeUInt32(record, 19);
      const attributesEx14 = SpellSchema.safeUInt32(record, 20);
      const attributesEx15 = SpellSchema.safeUInt32(record, 21);
      const attributesCu = SpellSchema.safeUInt32(record, 22);

      // Stances (fields 23-24, bigint)
      const stances = SpellSchema.safeUInt64(record, 23);
      const stancesNot = SpellSchema.safeUInt64(record, 24);

      // Targeting (fields 25-26)
      const targets = SpellSchema.safeUInt32(record, 25);
      const targetCreatureType = SpellSchema.safeUInt32(record, 26);

      // Casting (field 27)
      const castTimeIndex = SpellSchema.safeUInt32(record, 27);

      // Power costs (fields 28-32)
      const powerType = SpellSchema.safeUInt32(record, 28);
      const manaCost = SpellSchema.safeUInt32(record, 29);
      const manaCostPerLevel = SpellSchema.safeUInt32(record, 30);
      const manaPerSecond = SpellSchema.safeUInt32(record, 31);
      const manaPerSecondPerLevel = SpellSchema.safeUInt32(record, 32);

      // Scaling info (fields 69-71)
      const minScalingLevel = SpellSchema.safeUInt32(record, 69);
      const maxScalingLevel = SpellSchema.safeUInt32(record, 70);
      const scalesFromItemLevel = SpellSchema.safeUInt32(record, 71);

      // Reagents (fields 72-73, arrays of 8)
      const reagent = SpellSchema.safeUInt32Array(record, 72, 8);
      const reagentCount = SpellSchema.safeUInt32Array(record, 74, 8);

      // Totems (fields 80-83, arrays of 2)
      const totem = SpellSchema.safeUInt32Array(record, 80, 2);
      const totemCategory = SpellSchema.safeUInt32Array(record, 82, 2);

      // Spell family (field 88)
      const spellFamilyName = SpellSchema.safeUInt32(record, 88);

      // Spell family flags (fields 89-92, bigint array)
      const spellFamilyFlags: bigint[] = [
        SpellSchema.safeUInt64(record, 89),
        SpellSchema.safeUInt64(record, 90),
        SpellSchema.safeUInt64(record, 91),
        SpellSchema.safeUInt64(record, 92),
      ];

      // AoE diminishing (field 103)
      const sqrtDamageAndHealingDiminishing: FloatField = {
        value: SpellSchema.safeFloat(record, 103),
      };

      return {
        id,
        spellName,
        difficulty,
        categoryId,
        dispel,
        mechanic,
        attributes,
        attributesEx,
        attributesEx2,
        attributesEx3,
        attributesEx4,
        attributesEx5,
        attributesEx6,
        attributesEx7,
        schoolMask,
        attributesEx8,
        attributesEx9,
        attributesEx10,
        attributesEx11,
        attributesEx12,
        attributesEx13,
        attributesEx14,
        attributesEx15,
        attributesCu,
        stances,
        stancesNot,
        targets,
        targetCreatureType,
        castTimeIndex,
        powerType,
        powerCost: {
          power: powerType,
          amount: manaCost,
        },
        manaCostPerLevel,
        manaPerSecond,
        manaPerSecondPerLevel,
        scalingInfo: {
          minScalingLevel,
          maxScalingLevel,
          scalesFromItemLevel,
        },
        reagent,
        reagentCount,
        totem,
        totemCategory,
        spellFamilyName,
        spellFamilyFlags,
        sqrtDamageAndHealingDiminishing,
      };
    } catch (error) {
      throw new Error(`Failed to parse spell record: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Check if a spell has a specific attribute flag set
   * @param spell Spell entry
   * @param attrSet Attribute set index (0-15)
   * @param mask Attribute bitmask to check
   * @returns True if the attribute flag is set
   */
  public static hasAttribute(spell: SpellEntry, attrSet: number, mask: number): boolean {
    const fieldName = ATTRIBUTE_FIELD_INDICES[attrSet];
    if (fieldName === undefined) {
      return false;
    }
    const attrValue = spell[fieldName];
    if (typeof attrValue !== 'number') {
      return false;
    }
    return (attrValue & mask) !== 0;
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
   * Check if a spell can critically strike
   * A spell can crit unless SPELL_ATTR2_CANT_CRIT (0x00000002) is set
   * @param spell Spell entry
   * @returns True if the spell can crit
   */
  public static canCrit(spell: SpellEntry): boolean {
    return !SpellSchema.hasAttribute(spell, 2, 0x00000002);
  }

  /**
   * Get cast time index for a spell
   * The actual cast time requires looking up SpellCastTimes.db2 with this index
   * @param spell Spell entry
   * @returns Cast time index
   */
  public static getCastTime(spell: SpellEntry): number {
    return spell.castTimeIndex;
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
