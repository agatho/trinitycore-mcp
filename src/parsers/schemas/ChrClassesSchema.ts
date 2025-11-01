/**
 * ChrClassesSchema.ts
 *
 * Schema parser for ChrClasses.db2 (WoW 11.2 - The War Within)
 * Defines all playable character classes with properties, visuals, and configuration.
 *
 * Based on TrinityCore DB2Structure.h:666-711
 * Total Fields: 43
 *
 * Week 5: Phase 3.1 - Extended DB2 File Schemas
 */

import { DB2Record } from '../db2/DB2Record';

/**
 * Classes Enumeration
 * WoW character class IDs
 */
export enum Classes {
  CLASS_NONE = 0,
  CLASS_WARRIOR = 1,
  CLASS_PALADIN = 2,
  CLASS_HUNTER = 3,
  CLASS_ROGUE = 4,
  CLASS_PRIEST = 5,
  CLASS_DEATH_KNIGHT = 6,
  CLASS_SHAMAN = 7,
  CLASS_MAGE = 8,
  CLASS_WARLOCK = 9,
  CLASS_MONK = 10,
  CLASS_DRUID = 11,
  CLASS_DEMON_HUNTER = 12,
  CLASS_EVOKER = 13,
  CLASS_ADVENTURER = 14,
  MAX_CLASSES = 15,
}

/**
 * Powers Enumeration
 * Character resource types (mana, rage, energy, etc.)
 */
export enum Powers {
  POWER_HEALTH = -2,
  POWER_MANA = 0,
  POWER_RAGE = 1,
  POWER_FOCUS = 2,
  POWER_ENERGY = 3,
  POWER_COMBO_POINTS = 4,
  POWER_RUNES = 5,
  POWER_RUNIC_POWER = 6,
  POWER_SOUL_SHARDS = 7,
  POWER_LUNAR_POWER = 8,
  POWER_HOLY_POWER = 9,
  POWER_ALTERNATE_POWER = 10,
  POWER_MAELSTROM = 11,
  POWER_CHI = 12,
  POWER_INSANITY = 13,
  POWER_BURNING_EMBERS = 14, // Obsolete
  POWER_DEMONIC_FURY = 15, // Obsolete
  POWER_ARCANE_CHARGES = 16,
  POWER_FURY = 17,
  POWER_PAIN = 18,
  POWER_ESSENCE = 19,
  POWER_RUNE_BLOOD = 20,
  POWER_RUNE_FROST = 21,
  POWER_RUNE_UNHOLY = 22,
  MAX_POWERS = 20,
}

/**
 * Spell Family Names Enumeration
 * Links spells to classes for family-based interactions
 */
export enum SpellFamilyNames {
  SPELLFAMILY_GENERIC = 0,
  SPELLFAMILY_UNK1 = 1,
  SPELLFAMILY_MAGE = 3,
  SPELLFAMILY_WARRIOR = 4,
  SPELLFAMILY_WARLOCK = 5,
  SPELLFAMILY_PRIEST = 6,
  SPELLFAMILY_DRUID = 7,
  SPELLFAMILY_ROGUE = 8,
  SPELLFAMILY_HUNTER = 9,
  SPELLFAMILY_PALADIN = 10,
  SPELLFAMILY_SHAMAN = 11,
  SPELLFAMILY_UNK2 = 12,
  SPELLFAMILY_POTION = 13,
  SPELLFAMILY_DEATHKNIGHT = 15,
  SPELLFAMILY_PET = 17,
  SPELLFAMILY_TOTEMS = 50,
  SPELLFAMILY_MONK = 53,
  SPELLFAMILY_WARLOCK_PET = 57,
  SPELLFAMILY_UNK66 = 66,
  SPELLFAMILY_UNK71 = 71,
  SPELLFAMILY_UNK78 = 78,
  SPELLFAMILY_UNK91 = 91,
  SPELLFAMILY_UNK100 = 100,
  SPELLFAMILY_DEMON_HUNTER = 107,
  SPELLFAMILY_EVOKER = 224,
}

/**
 * Roles Mask Flags
 * Available class roles (bitfield)
 */
export enum RolesMask {
  ROLE_TANK = 0x1, // Tank role (1)
  ROLE_HEALER = 0x2, // Healer role (2)
  ROLE_DPS = 0x4, // DPS role (4)
}

/**
 * ChrClasses.db2 Entry Interface
 * Complete character class definition with 43 fields
 */
export interface ChrClassesEntry {
  // Localized strings
  name: string; // Localized class name (e.g., "Warrior", "Mage")
  filename: string; // Internal filename (e.g., "WARRIOR", "MAGE")
  nameMale: string; // Male name variant
  nameFemale: string; // Female name variant
  petNameToken: string; // Pet name token (e.g., "PET_NAME_WARRIOR")
  description: string; // Class description text
  roleInfoString: string; // Role information (Tank, Healer, DPS)
  disabledString: string; // Message when class disabled
  hyphenatedNameMale: string; // Hyphenated name (male)
  hyphenatedNameFemale: string; // Hyphenated name (female)

  // Visual assets (File Data IDs reference CASC filesystem)
  createScreenFileDataID: number; // Character creation screen background
  selectScreenFileDataID: number; // Character select screen background
  iconFileDataID: number; // Class icon image
  lowResScreenFileDataID: number; // Low-resolution screen background

  // Class properties
  flags: number; // Class flags (bitfield)
  startingLevel: number; // Starting level for this class
  spellTextureBlobFileDataID: number; // Spell texture file data
  armorTypeMask: number; // Armor types this class can wear (bitfield)

  // Character creation visuals (WoW 11.0.2+)
  charStartKitUnknown901: number; // Unknown purpose (11.0.2+)
  maleCharacterCreationVisualFallback: number; // Male creation visual
  maleCharacterCreationIdleVisualFallback: number; // Male idle visual
  femaleCharacterCreationVisualFallback: number; // Female creation visual
  femaleCharacterCreationIdleVisualFallback: number; // Female idle visual
  characterCreationIdleGroundVisualFallback: number; // Idle ground visual
  characterCreationGroundVisualFallback: number; // Ground visual
  alteredFormCharacterCreationIdleVisualFallback: number; // Altered form idle
  characterCreationAnimLoopWaitTimeMsFallback: number; // Anim loop wait time (ms)

  // Class configuration
  cinematicSequenceID: number; // Intro cinematic ID
  defaultSpec: number; // Default specialization ID
  id: number; // Class ID (1-14, Classes enum)
  hasStrengthBonus: number; // Whether class gets strength bonus (0/1)
  primaryStatPriority: number; // Primary stat (-1=none, 0=Str, 2=Agi, 3=Int)
  displayPower: number; // Primary power type displayed (Powers enum)
  rangedAttackPowerPerAgility: number; // Ranged AP per point of Agility
  attackPowerPerAgility: number; // Melee AP per point of Agility
  attackPowerPerStrength: number; // Melee AP per point of Strength
  spellClassSet: number; // Spell family ID (SpellFamilyNames enum)

  // UI display
  classColorR: number; // Class color RGB red (0-255)
  classColorG: number; // Class color RGB green (0-255)
  classColorB: number; // Class color RGB blue (0-255)
  rolesMask: number; // Available roles bitfield (RolesMask flags)
  damageBonusStat: number; // Stat that provides damage bonus
  hasRelicSlot: number; // Whether class has relic slot (0/1)
}

/**
 * ChrClasses.db2 Schema Parser
 */
export class ChrClassesSchema {
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
   * Parse ChrClasses.db2 record
   * @param record DB2 record to parse
   * @returns Parsed ChrClassesEntry
   */
  public static parse(record: DB2Record): ChrClassesEntry {
    // NOTE: Actual field order may vary - this is based on TrinityCore's structure
    // Field indices derived from DB2Structure.h and DB2LoadInfo.h

    return {
      // Localized strings (fields 0-9)
      name: record.getString(0),
      filename: record.getString(1),
      nameMale: record.getString(2),
      nameFemale: record.getString(3),
      petNameToken: record.getString(4),
      description: record.getString(5),
      roleInfoString: record.getString(6),
      disabledString: record.getString(7),
      hyphenatedNameMale: record.getString(8),
      hyphenatedNameFemale: record.getString(9),

      // Visual assets (fields 10-13)
      createScreenFileDataID: record.getUInt32(10),
      selectScreenFileDataID: record.getUInt32(11),
      iconFileDataID: record.getUInt32(12),
      lowResScreenFileDataID: record.getUInt32(13),

      // Class properties (fields 14-17)
      flags: record.getInt32(14),
      startingLevel: record.getInt32(15),
      spellTextureBlobFileDataID: record.getUInt32(16),
      armorTypeMask: record.getUInt32(17),

      // Character creation visuals (fields 18-26)
      charStartKitUnknown901: record.getInt32(18),
      maleCharacterCreationVisualFallback: record.getInt32(19),
      maleCharacterCreationIdleVisualFallback: record.getInt32(20),
      femaleCharacterCreationVisualFallback: record.getInt32(21),
      femaleCharacterCreationIdleVisualFallback: record.getInt32(22),
      characterCreationIdleGroundVisualFallback: record.getInt32(23),
      characterCreationGroundVisualFallback: record.getInt32(24),
      alteredFormCharacterCreationIdleVisualFallback: record.getInt32(25),
      characterCreationAnimLoopWaitTimeMsFallback: record.getInt32(26),

      // Class configuration (fields 27-36)
      cinematicSequenceID: record.getUInt16(27),
      defaultSpec: record.getUInt16(28),
      id: record.getUInt8(29),
      hasStrengthBonus: record.getUInt8(30),
      primaryStatPriority: this.convertToInt8(record.getUInt8(31)),
      displayPower: this.convertToInt8(record.getUInt8(32)),
      rangedAttackPowerPerAgility: record.getUInt8(33),
      attackPowerPerAgility: record.getUInt8(34),
      attackPowerPerStrength: record.getUInt8(35),
      spellClassSet: record.getUInt8(36),

      // UI display (fields 37-42)
      classColorR: record.getUInt8(37),
      classColorG: record.getUInt8(38),
      classColorB: record.getUInt8(39),
      rolesMask: record.getUInt8(40),
      damageBonusStat: record.getUInt8(41),
      hasRelicSlot: record.getUInt8(42),
    };
  }

  /**
   * Get class name by ID
   * @param classID Class ID (Classes enum)
   * @returns Class name string
   */
  public static getClassName(classID: number): string {
    const classNames: Record<number, string> = {
      1: 'Warrior',
      2: 'Paladin',
      3: 'Hunter',
      4: 'Rogue',
      5: 'Priest',
      6: 'Death Knight',
      7: 'Shaman',
      8: 'Mage',
      9: 'Warlock',
      10: 'Monk',
      11: 'Druid',
      12: 'Demon Hunter',
      13: 'Evoker',
      14: 'Adventurer',
    };
    return classNames[classID] || 'Unknown';
  }

  /**
   * Get class color as hex string
   * @param entry ChrClassesEntry
   * @returns Hex color string (e.g., "#C79C6E" for Warrior)
   */
  public static getClassColor(entry: ChrClassesEntry): string {
    const r = entry.classColorR.toString(16).padStart(2, '0');
    const g = entry.classColorG.toString(16).padStart(2, '0');
    const b = entry.classColorB.toString(16).padStart(2, '0');
    return `#${r}${g}${b}`.toUpperCase();
  }

  /**
   * Get power type name
   * @param powerType Power type ID (Powers enum)
   * @returns Power type name string
   */
  public static getPowerTypeName(powerType: number): string {
    const powerNames: Record<number, string> = {
      [-2]: 'Health',
      0: 'Mana',
      1: 'Rage',
      2: 'Focus',
      3: 'Energy',
      4: 'Combo Points',
      5: 'Runes',
      6: 'Runic Power',
      7: 'Soul Shards',
      8: 'Lunar Power',
      9: 'Holy Power',
      10: 'Alternate',
      11: 'Maelstrom',
      12: 'Chi',
      13: 'Insanity',
      14: 'Burning Embers', // Obsolete
      15: 'Demonic Fury', // Obsolete
      16: 'Arcane Charges',
      17: 'Fury',
      18: 'Pain',
      19: 'Essence',
      20: 'Rune (Blood)',
      21: 'Rune (Frost)',
      22: 'Rune (Unholy)',
    };
    return powerNames[powerType] || 'Unknown';
  }

  /**
   * Get spell family name
   * @param spellFamily Spell family ID (SpellFamilyNames enum)
   * @returns Spell family name string
   */
  public static getSpellFamilyName(spellFamily: number): string {
    const familyNames: Record<number, string> = {
      0: 'Generic',
      3: 'Mage',
      4: 'Warrior',
      5: 'Warlock',
      6: 'Priest',
      7: 'Druid',
      8: 'Rogue',
      9: 'Hunter',
      10: 'Paladin',
      11: 'Shaman',
      13: 'Potion',
      15: 'Death Knight',
      17: 'Pet',
      50: 'Totems',
      53: 'Monk',
      57: 'Warlock Pet',
      107: 'Demon Hunter',
      224: 'Evoker',
    };
    return familyNames[spellFamily] || 'Unknown';
  }

  /**
   * Check if class has specific role
   * @param entry ChrClassesEntry
   * @param role Role flag (RolesMask enum)
   * @returns True if class has role
   */
  public static hasRole(entry: ChrClassesEntry, role: RolesMask): boolean {
    return !!(entry.rolesMask & role);
  }

  /**
   * Get all available roles for class
   * @param entry ChrClassesEntry
   * @returns Array of role names
   */
  public static getRoles(entry: ChrClassesEntry): string[] {
    const roles: string[] = [];
    if (this.hasRole(entry, RolesMask.ROLE_TANK)) {
      roles.push('Tank');
    }
    if (this.hasRole(entry, RolesMask.ROLE_HEALER)) {
      roles.push('Healer');
    }
    if (this.hasRole(entry, RolesMask.ROLE_DPS)) {
      roles.push('DPS');
    }
    return roles;
  }

  /**
   * Get primary stat name
   * @param entry ChrClassesEntry
   * @returns Primary stat name
   */
  public static getPrimaryStatName(entry: ChrClassesEntry): string {
    const statNames: Record<number, string> = {
      [-1]: 'None',
      0: 'Strength',
      2: 'Agility',
      3: 'Intellect',
    };
    return statNames[entry.primaryStatPriority] || 'Unknown';
  }

  /**
   * Check if class is valid (not CLASS_NONE)
   * @param classID Class ID
   * @returns True if valid class
   */
  public static isValidClass(classID: number): boolean {
    return classID > Classes.CLASS_NONE && classID < Classes.MAX_CLASSES;
  }
}

/**
 * ChrClassesXPowerTypes.db2 Entry Interface
 * Maps classes to their power types
 */
export interface ChrClassesXPowerTypesEntry {
  id: number; // Unique record ID
  powerType: number; // Powers enum value
  classID: number; // ChrClassesEntry.ID
}

/**
 * ChrClassesXPowerTypes.db2 Schema Parser
 */
export class ChrClassesXPowerTypesSchema {
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
   * Parse ChrClassesXPowerTypes.db2 record
   * @param record DB2 record to parse
   * @returns Parsed ChrClassesXPowerTypesEntry
   */
  public static parse(record: DB2Record): ChrClassesXPowerTypesEntry {
    return {
      id: record.getUInt32(0),
      powerType: this.convertToInt8(record.getUInt8(1)), // int8 (Powers enum)
      classID: record.getUInt32(2),
    };
  }

  /**
   * Group power types by class ID
   * @param entries Array of ChrClassesXPowerTypesEntry
   * @returns Map of classID to power type arrays
   */
  public static groupByClass(
    entries: ChrClassesXPowerTypesEntry[]
  ): Map<number, number[]> {
    const grouped = new Map<number, number[]>();

    for (const entry of entries) {
      if (!grouped.has(entry.classID)) {
        grouped.set(entry.classID, []);
      }
      grouped.get(entry.classID)!.push(entry.powerType);
    }

    return grouped;
  }
}
