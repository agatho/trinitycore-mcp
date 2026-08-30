/**
 * Schemas for the DB2 tables carrying a spell's detail.
 *
 * A spell's own record holds little more than its name. Everything a caller
 * usually wants - school, cast time, cooldown, duration, range, power cost -
 * lives in satellite tables that reference the spell through a
 * `$noninline,relation$SpellID` column, or in lookup tables addressed by an
 * index stored on SpellMisc.
 *
 * Without these, get-spell-info returned a name and zeros for everything else,
 * which reads as "this spell is instant, free and has no range" rather than as
 * "this data was never loaded".
 *
 * Field indices are the inline field numbers for the 12.1 layouts recorded
 * below. Noninline columns - the record id and the SpellID relation - are not
 * fields and are excluded from the numbering.
 *
 * @module parsers/schemas/SpellDetailSchemas
 */

import { DB2Record } from '../db2/DB2Record';

/** Schools a spell can belong to, as a bitmask. */
export enum SpellSchoolMask {
  PHYSICAL = 1,
  HOLY = 2,
  FIRE = 4,
  NATURE = 8,
  FROST = 16,
  SHADOW = 32,
  ARCANE = 64,
}

/** Human-readable name for a school mask, for display. */
export function describeSchoolMask(mask: number): string {
  const names: string[] = [];
  if (mask & SpellSchoolMask.PHYSICAL) names.push('Physical');
  if (mask & SpellSchoolMask.HOLY) names.push('Holy');
  if (mask & SpellSchoolMask.FIRE) names.push('Fire');
  if (mask & SpellSchoolMask.NATURE) names.push('Nature');
  if (mask & SpellSchoolMask.FROST) names.push('Frost');
  if (mask & SpellSchoolMask.SHADOW) names.push('Shadow');
  if (mask & SpellSchoolMask.ARCANE) names.push('Arcane');
  return names.length > 0 ? names.join('/') : 'None';
}

/** Power a spell costs, matching TrinityCore's Powers enum. */
export enum SpellPowerType {
  MANA = 0,
  RAGE = 1,
  FOCUS = 2,
  ENERGY = 3,
  COMBO_POINTS = 4,
  RUNES = 5,
  RUNIC_POWER = 6,
  SOUL_SHARDS = 7,
  LUNAR_POWER = 8,
  HOLY_POWER = 9,
  ALTERNATE = 10,
  MAELSTROM = 11,
  CHI = 12,
  INSANITY = 13,
  BURNING_EMBERS = 14,
  DEMONIC_FURY = 15,
  ARCANE_CHARGES = 16,
  FURY = 17,
  PAIN = 18,
  ESSENCE = 19,
  HEALTH = -2,
}

/** Name of a power type, for display. */
export function describePowerType(type: number): string {
  const name = SpellPowerType[type];
  return typeof name === 'string' ? name : `UNKNOWN(${type})`;
}

// ---------------------------------------------------------------- SpellMisc -

export interface SpellMiscEntry {
  /** Difficulty this row applies to; 0 is the base row. */
  difficultyID: number;
  /** Attribute bits, 17 words. */
  attributes: number[];
  /** Row id in SpellCastTimes, or 0 for instant. */
  castingTimeIndex: number;
  /** Row id in SpellDuration, or 0 for no duration. */
  durationIndex: number;
  /** Row id in SpellRange. */
  rangeIndex: number;
  /** School bitmask; see {@link SpellSchoolMask}. */
  schoolMask: number;
  /** Projectile speed in yards per second; 0 for instant application. */
  speed: number;
  launchDelay: number;
  minDuration: number;
  spellIconFileDataID: number;
  activeIconFileDataID: number;
  contentTuningID: number;
}

/** SpellMisc.db2 - the spell's core numbers and its references to lookups. */
export class SpellMiscSchema {
  public static readonly SCHEMA_NAME = 'SpellMiscSchema';
  public static readonly VALID_BUILDS = { from: 68209, to: null as number | null };
  /** build -> layoutHash. 12.1 only. */
  public static readonly LAYOUT_HASHES = new Map<number, number>([[69497, 0x434b3607]]);

  /** Number of attribute words the 12.1 layout carries. */
  public static readonly ATTRIBUTE_WORDS = 17;

  public static parse(record: DB2Record): SpellMiscEntry {
    const attributes: number[] = [];
    for (let i = 0; i < SpellMiscSchema.ATTRIBUTE_WORDS; i++) {
      attributes.push(record.getInt32(0, i));
    }

    return {
      attributes,
      difficultyID: record.getInt16(1),
      castingTimeIndex: record.getUInt16(2),
      durationIndex: record.getUInt16(3),
      // field 4 is PvPDurationIndex
      rangeIndex: record.getUInt16(5),
      schoolMask: record.getUInt8(6),
      speed: record.getFloat(7),
      launchDelay: record.getFloat(8),
      minDuration: record.getFloat(9),
      spellIconFileDataID: record.getInt32(10),
      activeIconFileDataID: record.getInt32(11),
      contentTuningID: record.getInt32(12),
    };
  }
}

// ----------------------------------------------------------- SpellCastTimes -

export interface SpellCastTimesEntry {
  /** Base cast time in milliseconds. 0 means instant. */
  base: number;
  /** Floor the cast time cannot be hasted below, in milliseconds. */
  minimum: number;
}

/** SpellCastTimes.db2 - addressed by SpellMisc.castingTimeIndex. */
export class SpellCastTimesSchema {
  public static readonly SCHEMA_NAME = 'SpellCastTimesSchema';
  public static readonly VALID_BUILDS = { from: 68209, to: null as number | null };
  public static readonly LAYOUT_HASHES = new Map<number, number>([[69497, 0x75b6bd3a]]);

  public static parse(record: DB2Record): SpellCastTimesEntry {
    return { base: record.getInt32(0), minimum: record.getInt32(1) };
  }
}

// ------------------------------------------------------------ SpellDuration -

export interface SpellDurationEntry {
  /** Duration in milliseconds. -1 means it does not expire. */
  duration: number;
  /** Longest the duration can be extended to, in milliseconds. */
  maxDuration: number;
  durationPerResource: number;
}

/** SpellDuration.db2 - addressed by SpellMisc.durationIndex. */
export class SpellDurationSchema {
  public static readonly SCHEMA_NAME = 'SpellDurationSchema';
  public static readonly VALID_BUILDS = { from: 68209, to: null as number | null };
  public static readonly LAYOUT_HASHES = new Map<number, number>([[69497, 0xa931bd2b]]);

  public static parse(record: DB2Record): SpellDurationEntry {
    return {
      duration: record.getInt32(0),
      maxDuration: record.getInt32(1),
      durationPerResource: record.getInt32(2),
    };
  }
}

// --------------------------------------------------------------- SpellRange -

export interface SpellRangeEntry {
  /** e.g. "Long Range", "Self Only". */
  displayName: string;
  displayNameShort: string;
  flags: number;
  /** Minimum range in yards, against hostile and friendly targets. */
  rangeMin: number[];
  /** Maximum range in yards, against hostile and friendly targets. */
  rangeMax: number[];
}

/** SpellRange.db2 - addressed by SpellMisc.rangeIndex. */
export class SpellRangeSchema {
  public static readonly SCHEMA_NAME = 'SpellRangeSchema';
  public static readonly VALID_BUILDS = { from: 68209, to: null as number | null };
  public static readonly LAYOUT_HASHES = new Map<number, number>([[69497, 0xada13705]]);

  public static parse(record: DB2Record): SpellRangeEntry {
    return {
      displayName: record.getString(0),
      displayNameShort: record.getString(1),
      flags: record.getInt32(2),
      rangeMin: [record.getFloat(3, 0), record.getFloat(3, 1)],
      rangeMax: [record.getFloat(4, 0), record.getFloat(4, 1)],
    };
  }
}

// ---------------------------------------------------------- SpellCategories -

export interface SpellCategoriesEntry {
  difficultyID: number;
  category: number;
  defenseType: number;
  diminishType: number;
  /** Dispel type; 0 is none. */
  dispelType: number;
  /** Mechanic applied; 0 is none. */
  mechanic: number;
  preventionType: number;
  startRecoveryCategory: number;
  chargeCategory: number;
}

/** SpellCategories.db2 - related to the spell by SpellID. */
export class SpellCategoriesSchema {
  public static readonly SCHEMA_NAME = 'SpellCategoriesSchema';
  public static readonly VALID_BUILDS = { from: 68209, to: null as number | null };
  public static readonly LAYOUT_HASHES = new Map<number, number>([[69497, 0x679ef94c]]);

  public static parse(record: DB2Record): SpellCategoriesEntry {
    return {
      difficultyID: record.getInt16(0),
      category: record.getInt16(1),
      defenseType: record.getInt8(2),
      diminishType: record.getInt32(3),
      dispelType: record.getInt8(4),
      mechanic: record.getInt8(5),
      preventionType: record.getInt32(6),
      startRecoveryCategory: record.getInt16(7),
      chargeCategory: record.getInt16(8),
    };
  }
}

// ----------------------------------------------------------- SpellCooldowns -

export interface SpellCooldownsEntry {
  difficultyID: number;
  /** Shared-category cooldown in milliseconds. */
  categoryRecoveryTime: number;
  /** The spell's own cooldown in milliseconds. */
  recoveryTime: number;
  /** Global cooldown triggered, in milliseconds. */
  startRecoveryTime: number;
  auraSpellID: number;
}

/** SpellCooldowns.db2 - related to the spell by SpellID. */
export class SpellCooldownsSchema {
  public static readonly SCHEMA_NAME = 'SpellCooldownsSchema';
  public static readonly VALID_BUILDS = { from: 68209, to: null as number | null };
  public static readonly LAYOUT_HASHES = new Map<number, number>([[69497, 0xdc945b8c]]);

  public static parse(record: DB2Record): SpellCooldownsEntry {
    return {
      difficultyID: record.getInt16(0),
      categoryRecoveryTime: record.getInt32(1),
      recoveryTime: record.getInt32(2),
      startRecoveryTime: record.getInt32(3),
      auraSpellID: record.getInt32(4),
    };
  }
}

// -------------------------------------------------------------- SpellLevels -

export interface SpellLevelsEntry {
  difficultyID: number;
  maxLevel: number;
  maxPassiveAuraLevel: number;
  /** Level the spell scales from. */
  baseLevel: number;
  /** Level required to use it. */
  spellLevel: number;
}

/** SpellLevels.db2 - related to the spell by SpellID. */
export class SpellLevelsSchema {
  public static readonly SCHEMA_NAME = 'SpellLevelsSchema';
  public static readonly VALID_BUILDS = { from: 68209, to: null as number | null };
  public static readonly LAYOUT_HASHES = new Map<number, number>([[69497, 0x7eb86fdc]]);

  public static parse(record: DB2Record): SpellLevelsEntry {
    return {
      difficultyID: record.getInt16(0),
      maxLevel: record.getInt16(1),
      maxPassiveAuraLevel: record.getUInt8(2),
      baseLevel: record.getInt32(3),
      spellLevel: record.getInt32(4),
    };
  }
}

// --------------------------------------------------------------- SpellPower -

export interface SpellPowerEntry {
  orderIndex: number;
  /** Flat cost in power units. */
  manaCost: number;
  manaCostPerLevel: number;
  manaPerSecond: number;
  /** Cost as a fraction of maximum power. */
  powerCostPct: number;
  powerCostMaxPct: number;
  powerPctPerSecond: number;
  /** Which power is spent; see {@link SpellPowerType}. */
  powerType: number;
  requiredAuraSpellID: number;
  optionalCost: number;
}

/**
 * SpellPower.db2 - related to the spell by SpellID.
 *
 * Note this table's id column is inline (`$id$`, not `$noninline,id$`), so its
 * fields start one later than the other tables here.
 */
export class SpellPowerSchema {
  public static readonly SCHEMA_NAME = 'SpellPowerSchema';
  public static readonly VALID_BUILDS = { from: 68209, to: null as number | null };
  public static readonly LAYOUT_HASHES = new Map<number, number>([[69497, 0x61ad223f]]);

  public static parse(record: DB2Record): SpellPowerEntry {
    return {
      orderIndex: record.getUInt8(1),
      manaCost: record.getInt32(2),
      manaCostPerLevel: record.getInt32(3),
      manaPerSecond: record.getInt32(4),
      // 5 PowerDisplayID, 6 AltPowerBarID
      powerCostPct: record.getFloat(7),
      powerCostMaxPct: record.getFloat(8),
      // 9 OptionalCostPct
      powerPctPerSecond: record.getFloat(10),
      powerType: record.getInt8(11),
      requiredAuraSpellID: record.getInt32(12),
      optionalCost: record.getUInt32(13),
    };
  }
}
