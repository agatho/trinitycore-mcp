/**
 * SpellEffectSchema.ts
 *
 * Schema parser for SpellEffect.db2 (WoW 12.0 Midnight)
 * Defines individual spell effects - each spell can have up to 3 effects
 *
 * Based on TrinityCore DB2Structure.h:3836 and DB2LoadInfo.h:5264
 * Total Fields: 36 (arrays expanded from 29 compressed fields)
 * Layout Hash: 0x239B1B53 (WoW 12.0)
 * File Data ID: 1140088
 *
 * Week 5: Phase 3.1 - Extended DB2 File Schemas
 */

import { DB2Record } from '../db2/DB2Record';

/**
 * Spell Effect Name Enumeration
 * 346 total effect types (many gaps for deprecated effects)
 * Source: SharedDefines.h:1298-1647
 */
export enum SpellEffectName {
  NONE = 0,
  INSTAKILL = 1,
  SCHOOL_DAMAGE = 2,
  DUMMY = 3,
  APPLY_AURA = 6,
  HEAL = 10,
  RESURRECT = 18,
  CREATE_ITEM = 24,
  SUMMON = 28,
  LEAP = 29,
  ENERGIZE = 30,
  DISPEL = 38,
  WEAPON_DAMAGE = 58,
  TRIGGER_SPELL = 64,
  INTERRUPT_CAST = 68,
  SCRIPT_EFFECT = 77,
  CHARGE = 96,
  KNOCK_BACK = 98,
  TELEPORT_UNITS = 252,
  CRAFT_ITEM = 288, // New in TWW
  RECRAFT_ITEM = 297, // New in TWW
  GATHERING = 302, // New in TWW
  CREATE_TRAIT_TREE_CONFIG = 303, // New in TWW
  ASSIST_ACTION = 345, // Latest (12.0)
  TOTAL_SPELL_EFFECTS = 346,
}

/**
 * Aura Type Enumeration (Subset - 500+ total)
 * Only used when Effect == SPELL_EFFECT_APPLY_AURA (6)
 * Source: SpellAuraDefines.h:85+
 */
export enum AuraType {
  NONE = 0,
  BIND_SIGHT = 1,
  MOD_POSSESS = 2,
  PERIODIC_DAMAGE = 3,
  DUMMY = 4,
  MOD_CHARM = 6,
  PERIODIC_HEAL = 8,
  MOD_STUN = 12,
  MOD_DAMAGE_DONE = 13,
  MOD_STEALTH = 16,
  MOD_RESISTANCE = 22,
  PERIODIC_TRIGGER_SPELL = 23,
  MOD_ROOT = 26,
  MOD_SILENCE = 27,
  MOD_STAT = 29,
  MOD_INCREASE_SPEED = 31,
  MOD_SHAPESHIFT = 36,
  SCHOOL_IMMUNITY = 39,
  PROC_TRIGGER_SPELL = 42,
}

/**
 * Spell Effect Attributes Flags
 * Source: DBCEnums.h:2289+
 */
export enum SpellEffectAttributes {
  NONE = 0x00000000,
  NO_IMMUNITY = 0x00000001, // Not cancelled by immunities
  POSITION_IS_FACING_RELATIVE = 0x00000002,
  JUMP_CHARGE_UNIT_MELEE_RANGE = 0x00000004,
  JUMP_CHARGE_UNIT_STRICT_PATH_CHECK = 0x00000008,
  EXCLUDE_OWN_PARTY = 0x00000010,
  ALWAYS_AOE_LINE_OF_SIGHT = 0x00000020,
  SUPPRESS_POINTS_STACKING = 0x00000040,
  CHAIN_FROM_INITIAL_TARGET = 0x00000080,
  UNCONTROLLED_NO_BACKWARDS = 0x00000100,
  AURA_POINTS_STACK = 0x00000200, // Refreshing adds remaining to new
  NO_COPY_DAMAGE_INTERRUPTS_OR_PROCS = 0x00000400,
  ADD_TARGET_COMBAT_REACH_TO_AOE = 0x00000800,
  IS_HARMFUL = 0x00001000,
  FORCE_SCALE_TO_OVERRIDE_CAMERA_MIN_HEIGHT = 0x00002000,
  PLAYERS_ONLY = 0x00004000,
  COMPUTE_POINTS_ONLY_AT_CAST_TIME = 0x00008000,
  ENFORCE_LINE_OF_SIGHT_TO_CHAIN_TARGETS = 0x00010000,
  AREA_EFFECTS_USE_TARGET_RADIUS = 0x00020000,
}

/**
 * Spell Implicit Target Types
 * 153 total target types
 * Source: SharedDefines.h:2899-3048
 */
export enum Targets {
  UNIT_CASTER = 1,
  UNIT_NEARBY_ENEMY = 2,
  UNIT_PET = 5,
  UNIT_TARGET_ENEMY = 6,
  UNIT_SRC_AREA_ENTRY = 7,
  UNIT_DEST_AREA_ENTRY = 8,
  DEST_HOME = 9,
  UNIT_SRC_AREA_ENEMY = 15,
  UNIT_DEST_AREA_ENEMY = 16,
  DEST_DB = 17, // From database
  DEST_CASTER = 18,
  UNIT_CASTER_AREA_PARTY = 20,
  UNIT_TARGET_ALLY = 21,
  SRC_CASTER = 22,
  GAMEOBJECT_TARGET = 23,
  UNIT_CONE_ENEMY_24 = 24,
  UNIT_TARGET_ANY = 25,
  UNIT_SRC_AREA_ALLY = 30,
  UNIT_DEST_AREA_ALLY = 31,
  DEST_CASTER_SUMMON = 32,
  UNIT_SRC_AREA_PARTY = 33,
  UNIT_DEST_AREA_PARTY = 34,
  UNIT_CONE_180_DEG_ENEMY = 54,
  UNIT_CASTER_AREA_RAID = 56,
  UNIT_CHANNEL_TARGET = 77,
  UNIT_VEHICLE = 94,
  UNIT_CONE_CASTER_TO_DEST_ENEMY = 104,
  UNIT_AREA_THREAT_LIST = 122, // Tanks
  DEST_SUMMONER = 131,
  UNIT_OWN_CRITTER = 150, // Battle pets
  TOTAL_SPELL_TARGETS = 153,
}

/**
 * Mechanics Enumeration
 * CC and control mechanics
 * Source: SharedDefines.h:2807-2847
 */
export enum Mechanics {
  NONE = 0,
  CHARM = 1,
  DISORIENTED = 2,
  DISARM = 3,
  DISTRACT = 4,
  FEAR = 5,
  GRIP = 6,
  ROOT = 7,
  SLOW_ATTACK = 8,
  SILENCE = 9,
  SLEEP = 10,
  SNARE = 11,
  STUN = 12,
  FREEZE = 13,
  KNOCKOUT = 14,
  BLEED = 15,
  BANDAGE = 16,
  POLYMORPH = 17,
  BANISH = 18,
  SHIELD = 19,
  SHACKLE = 20,
  MOUNT = 21,
  INFECTED = 22,
  TURN = 23,
  HORROR = 24,
  INVULNERABILITY = 25,
  INTERRUPT = 26,
  DAZE = 27,
  DISCOVERY = 28,
  IMMUNE_SHIELD = 29, // Divine Shield, Ice Block
  SAPPED = 30,
  ENRAGED = 31,
  WOUNDED = 32,
  TAUNTED = 36,
  MAX_MECHANIC = 37,
}

/**
 * SpellEffect.db2 Entry Interface
 * Complete spell effect definition with 36 fields (arrays expanded)
 */
export interface SpellEffectEntry {
  // Field 0: Primary key
  id: number; // uint32 - Unique effect identifier

  // Field 1: Aura type (only for APPLY_AURA effects)
  effectAura: number; // int16 - AuraType enum (see AuraType)

  // Field 2: Difficulty level
  difficultyID: number; // int32 - 0=normal, 1+=heroic/mythic variants

  // Field 3: Effect slot index
  effectIndex: number; // int32 - 0, 1, or 2 (spell has max 3 effects)

  // Field 4: Effect type
  effect: number; // uint32 - SpellEffectName enum (346 types)

  // Field 5: Periodic tick rate
  effectAmplitude: number; // float - Tick interval for periodic effects (seconds)

  // Field 6: Effect attribute flags
  effectAttributes: number; // int32 - SpellEffectAttributes flags

  // Field 7: Aura tick interval
  effectAuraPeriod: number; // int32 - Aura tick period (milliseconds)

  // Field 8: Spell power coefficient
  effectBonusCoefficient: number; // float - Spell power scaling

  // Field 9: Chain target damage reduction
  effectChainAmplitude: number; // float - Damage reduction per chain hop

  // Field 10: Maximum chain targets
  effectChainTargets: number; // int32 - Max targets for chain effects

  // Field 11: Created item ID
  effectItemType: number; // int32 - Item.db2 reference (for CREATE_ITEM)

  // Field 12: Mechanic type
  effectMechanic: number; // int32 - Mechanics enum (stun, root, etc.)

  // Field 13: Resource point scaling
  effectPointsPerResource: number; // float - Scaling per resource point

  // Field 14: Position facing angle
  effectPosFacing: number; // float - Required facing angle (radians)

  // Field 15: Level scaling
  effectRealPointsPerLevel: number; // float - Scaling per caster level

  // Field 16: Triggered spell
  effectTriggerSpell: number; // int32 - Spell.db2 reference (for TRIGGER_SPELL)

  // Field 17: Attack power coefficient
  bonusCoefficientFromAP: number; // float - Attack power scaling

  // Field 18: PvP multiplier
  pvpMultiplier: number; // float - PvP damage/heal multiplier

  // Field 19: Base coefficient
  coefficient: number; // float - Base scaling coefficient

  // Field 20: Random variance
  variance: number; // float - Random variance (±)

  // Field 21: Resource scaling
  resourceCoefficient: number; // float - Resource scaling coefficient

  // Field 22: Raid scaling
  groupSizeBasePointsCoefficient: number; // float - Raid size scaling

  // Field 23: Base damage/heal value
  effectBasePoints: number; // float - Base damage/heal before scaling

  // Field 24: Scaling class
  scalingClass: number; // int32 - Class for stat scaling (-1 = all)

  // Fields 25-26: Effect-specific parameters (array expanded)
  effectMiscValue: [
    number, // Effect parameter 1 (varies by effect type)
    number, // Effect parameter 2
  ]; // int32[2]

  // Fields 27-28: Radius references (array expanded)
  effectRadiusIndex: [
    number, // Primary radius (SpellRadius.db2 reference)
    number, // Secondary radius
  ]; // uint32[2]

  // Fields 29-32: Spell class mask (128-bit, array expanded)
  effectSpellClassMask: [
    number, // Mask bits 0-31
    number, // Mask bits 32-63
    number, // Mask bits 64-95
    number, // Mask bits 96-127
  ]; // int32[4] - Forms 128-bit flag128

  // Fields 33-34: Implicit targets (array expanded)
  implicitTarget: [
    number, // Primary target type (Targets enum)
    number, // Secondary target type
  ]; // int16[2]

  // Field 35: Parent spell reference
  spellID: number; // uint32 - Spell.db2 reference
}

/**
 * SpellEffect.db2 Schema Parser
 */
export class SpellEffectSchema {
  /**
   * Convert uint16 to int16 (signed short)
   * @param value Unsigned 16-bit value
   * @returns Signed 16-bit value
   */
  private static convertToInt16(value: number): number {
    // Convert unsigned short to signed short (-32768 to 32767)
    return value > 32767 ? value - 65536 : value;
  }

  /**
   * Parse SpellEffect.db2 record
   * @param record DB2 record to parse
   * @returns Parsed SpellEffectEntry
   */
  public static parse(record: DB2Record): SpellEffectEntry {
    // Field indices based on DB2LoadInfo.h:5264-5307
    // Arrays are expanded to individual fields in DB2 file

    return {
      // Field 0: ID
      id: record.getUInt32(0),

      // Field 1: EffectAura (int16)
      effectAura: this.convertToInt16(record.getUInt16(1)),

      // Field 2: DifficultyID
      difficultyID: record.getInt32(2),

      // Field 3: EffectIndex
      effectIndex: record.getInt32(3),

      // Field 4: Effect
      effect: record.getUInt32(4),

      // Field 5: EffectAmplitude
      effectAmplitude: record.getFloat(5),

      // Field 6: EffectAttributes
      effectAttributes: record.getInt32(6),

      // Field 7: EffectAuraPeriod
      effectAuraPeriod: record.getInt32(7),

      // Field 8: EffectBonusCoefficient
      effectBonusCoefficient: record.getFloat(8),

      // Field 9: EffectChainAmplitude
      effectChainAmplitude: record.getFloat(9),

      // Field 10: EffectChainTargets
      effectChainTargets: record.getInt32(10),

      // Field 11: EffectItemType
      effectItemType: record.getInt32(11),

      // Field 12: EffectMechanic
      effectMechanic: record.getInt32(12),

      // Field 13: EffectPointsPerResource
      effectPointsPerResource: record.getFloat(13),

      // Field 14: EffectPosFacing
      effectPosFacing: record.getFloat(14),

      // Field 15: EffectRealPointsPerLevel
      effectRealPointsPerLevel: record.getFloat(15),

      // Field 16: EffectTriggerSpell
      effectTriggerSpell: record.getInt32(16),

      // Field 17: BonusCoefficientFromAP
      bonusCoefficientFromAP: record.getFloat(17),

      // Field 18: PvpMultiplier
      pvpMultiplier: record.getFloat(18),

      // Field 19: Coefficient
      coefficient: record.getFloat(19),

      // Field 20: Variance
      variance: record.getFloat(20),

      // Field 21: ResourceCoefficient
      resourceCoefficient: record.getFloat(21),

      // Field 22: GroupSizeBasePointsCoefficient
      groupSizeBasePointsCoefficient: record.getFloat(22),

      // Field 23: EffectBasePoints
      effectBasePoints: record.getFloat(23),

      // Field 24: ScalingClass
      scalingClass: record.getInt32(24),

      // Fields 25-26: EffectMiscValue (array expanded)
      effectMiscValue: [
        record.getInt32(25), // MiscValue 1
        record.getInt32(26), // MiscValue 2
      ],

      // Fields 27-28: EffectRadiusIndex (array expanded)
      effectRadiusIndex: [
        record.getUInt32(27), // Radius 1
        record.getUInt32(28), // Radius 2
      ],

      // Fields 29-32: EffectSpellClassMask (128-bit expanded to 4x int32)
      effectSpellClassMask: [
        record.getInt32(29), // Mask bits 0-31
        record.getInt32(30), // Mask bits 32-63
        record.getInt32(31), // Mask bits 64-95
        record.getInt32(32), // Mask bits 96-127
      ],

      // Fields 33-34: ImplicitTarget (array expanded)
      implicitTarget: [
        this.convertToInt16(record.getUInt16(33)), // Target A
        this.convertToInt16(record.getUInt16(34)), // Target B
      ],

      // Field 35: SpellID (parent reference)
      spellID: record.getUInt32(35),
    };
  }

  /**
   * Get effect name
   * @param entry SpellEffectEntry
   * @returns SpellEffectName enum value
   */
  public static getEffectName(entry: SpellEffectEntry): SpellEffectName {
    return entry.effect as SpellEffectName;
  }

  /**
   * Get aura type (only for APPLY_AURA effects)
   * @param entry SpellEffectEntry
   * @returns AuraType enum value or null
   */
  public static getAuraType(entry: SpellEffectEntry): AuraType | null {
    if (entry.effect !== SpellEffectName.APPLY_AURA) {
      return null;
    }
    return entry.effectAura as AuraType;
  }

  /**
   * Get mechanic type
   * @param entry SpellEffectEntry
   * @returns Mechanics enum value
   */
  public static getMechanic(entry: SpellEffectEntry): Mechanics {
    return entry.effectMechanic as Mechanics;
  }

  /**
   * Get primary target type
   * @param entry SpellEffectEntry
   * @returns Targets enum value
   */
  public static getPrimaryTarget(entry: SpellEffectEntry): Targets {
    return entry.implicitTarget[0] as Targets;
  }

  /**
   * Get secondary target type
   * @param entry SpellEffectEntry
   * @returns Targets enum value or null
   */
  public static getSecondaryTarget(entry: SpellEffectEntry): Targets | null {
    return entry.implicitTarget[1] !== 0 ? (entry.implicitTarget[1] as Targets) : null;
  }

  /**
   * Check if effect is a damage effect
   * @param entry SpellEffectEntry
   * @returns True if damage effect
   */
  public static isDamageEffect(entry: SpellEffectEntry): boolean {
    const effect = entry.effect as SpellEffectName;
    return (
      effect === SpellEffectName.SCHOOL_DAMAGE ||
      effect === SpellEffectName.WEAPON_DAMAGE ||
      effect === SpellEffectName.INSTAKILL
    );
  }

  /**
   * Check if effect is a heal effect
   * @param entry SpellEffectEntry
   * @returns True if heal effect
   */
  public static isHealEffect(entry: SpellEffectEntry): boolean {
    const effect = entry.effect as SpellEffectName;
    return effect === SpellEffectName.HEAL || effect === SpellEffectName.RESURRECT;
  }

  /**
   * Check if effect is an aura effect
   * @param entry SpellEffectEntry
   * @returns True if aura effect
   */
  public static isAuraEffect(entry: SpellEffectEntry): boolean {
    return entry.effect === SpellEffectName.APPLY_AURA;
  }

  /**
   * Check if effect is periodic (ticking)
   * @param entry SpellEffectEntry
   * @returns True if periodic effect
   */
  public static isPeriodicEffect(entry: SpellEffectEntry): boolean {
    return entry.effectAuraPeriod > 0 || entry.effectAmplitude > 0;
  }

  /**
   * Check if effect has chain targets
   * @param entry SpellEffectEntry
   * @returns True if chain effect
   */
  public static hasChainTargets(entry: SpellEffectEntry): boolean {
    return entry.effectChainTargets > 1;
  }

  /**
   * Check if effect has area targeting
   * @param entry SpellEffectEntry
   * @returns True if area effect
   */
  public static hasAreaTargeting(entry: SpellEffectEntry): boolean {
    // Check for area target types
    const targetA = entry.implicitTarget[0] as Targets;
    const targetB = entry.implicitTarget[1] as Targets;

    const areaTargets = [
      Targets.UNIT_SRC_AREA_ENEMY,
      Targets.UNIT_DEST_AREA_ENEMY,
      Targets.UNIT_SRC_AREA_ALLY,
      Targets.UNIT_DEST_AREA_ALLY,
      Targets.UNIT_SRC_AREA_PARTY,
      Targets.UNIT_DEST_AREA_PARTY,
      Targets.UNIT_CASTER_AREA_PARTY,
      Targets.UNIT_CASTER_AREA_RAID,
      Targets.UNIT_CONE_ENEMY_24,
      Targets.UNIT_CONE_180_DEG_ENEMY,
      Targets.UNIT_CONE_CASTER_TO_DEST_ENEMY,
    ];

    return areaTargets.includes(targetA) || areaTargets.includes(targetB);
  }

  /**
   * Check if effect has radius
   * @param entry SpellEffectEntry
   * @returns True if effect uses radius
   */
  public static hasRadius(entry: SpellEffectEntry): boolean {
    return entry.effectRadiusIndex[0] !== 0 || entry.effectRadiusIndex[1] !== 0;
  }

  /**
   * Check if effect triggers another spell
   * @param entry SpellEffectEntry
   * @returns True if triggers spell
   */
  public static triggersSpell(entry: SpellEffectEntry): boolean {
    return entry.effectTriggerSpell !== 0;
  }

  /**
   * Check if effect creates an item
   * @param entry SpellEffectEntry
   * @returns True if creates item
   */
  public static createsItem(entry: SpellEffectEntry): boolean {
    const effect = entry.effect as SpellEffectName;
    return (
      effect === SpellEffectName.CREATE_ITEM ||
      effect === SpellEffectName.CRAFT_ITEM ||
      effect === SpellEffectName.RECRAFT_ITEM
    );
  }

  /**
   * Check if effect summons a creature
   * @param entry SpellEffectEntry
   * @returns True if summons
   */
  public static summonsCreature(entry: SpellEffectEntry): boolean {
    return entry.effect === SpellEffectName.SUMMON;
  }

  /**
   * Check if effect requires target selection
   * @param entry SpellEffectEntry
   * @returns True if requires target
   */
  public static requiresTarget(entry: SpellEffectEntry): boolean {
    const targetA = entry.implicitTarget[0] as Targets;
    return (
      targetA === Targets.UNIT_TARGET_ENEMY ||
      targetA === Targets.UNIT_TARGET_ALLY ||
      targetA === Targets.UNIT_TARGET_ANY
    );
  }

  /**
   * Check if effect has attribute flag
   * @param entry SpellEffectEntry
   * @param flag SpellEffectAttributes flag
   * @returns True if flag is set
   */
  public static hasAttribute(entry: SpellEffectEntry, flag: SpellEffectAttributes): boolean {
    return (entry.effectAttributes & flag) !== 0;
  }

  /**
   * Check if effect is harmful
   * @param entry SpellEffectEntry
   * @returns True if harmful effect
   */
  public static isHarmful(entry: SpellEffectEntry): boolean {
    return this.hasAttribute(entry, SpellEffectAttributes.IS_HARMFUL);
  }

  /**
   * Check if effect is for players only
   * @param entry SpellEffectEntry
   * @returns True if players only
   */
  public static isPlayersOnly(entry: SpellEffectEntry): boolean {
    return this.hasAttribute(entry, SpellEffectAttributes.PLAYERS_ONLY);
  }

  /**
   * Get effect power coefficient
   * @param entry SpellEffectEntry
   * @returns Total power coefficient (spell power + AP)
   */
  public static getPowerCoefficient(entry: SpellEffectEntry): number {
    return entry.effectBonusCoefficient + entry.bonusCoefficientFromAP;
  }

  /**
   * Calculate base effect value (without scaling)
   * @param entry SpellEffectEntry
   * @returns Base effect value
   */
  public static getBaseValue(entry: SpellEffectEntry): number {
    return entry.effectBasePoints;
  }

  /**
   * Get tick count for periodic effect
   * @param entry SpellEffectEntry
   * @param duration Total duration in milliseconds
   * @returns Number of ticks (0 if not periodic)
   */
  public static getTickCount(entry: SpellEffectEntry, duration: number): number {
    if (entry.effectAuraPeriod === 0) {
      return 0;
    }
    return Math.floor(duration / entry.effectAuraPeriod);
  }

  /**
   * Check if spell class mask matches
   * @param entry SpellEffectEntry
   * @param mask 128-bit mask to check
   * @returns True if any bits match
   */
  public static matchesSpellClassMask(entry: SpellEffectEntry, mask: [number, number, number, number]): boolean {
    for (let i = 0; i < 4; i++) {
      if ((entry.effectSpellClassMask[i] & mask[i]) !== 0) {
        return true;
      }
    }
    return false;
  }

  /**
   * Get scaling class name
   * @param entry SpellEffectEntry
   * @returns Class name or "All Classes"
   */
  public static getScalingClassName(entry: SpellEffectEntry): string {
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
    };

    return entry.scalingClass === -1 ? 'All Classes' : classNames[entry.scalingClass] || `Unknown (${entry.scalingClass})`;
  }

  /**
   * Get effect description
   * @param entry SpellEffectEntry
   * @returns Human-readable effect description
   */
  public static getEffectDescription(entry: SpellEffectEntry): string {
    const effectName = SpellEffectName[entry.effect] || `Unknown (${entry.effect})`;
    const targetA = Targets[entry.implicitTarget[0]] || `Unknown (${entry.implicitTarget[0]})`;

    let desc = `Effect ${entry.effectIndex}: ${effectName} → ${targetA}`;

    if (this.isAuraEffect(entry)) {
      const auraType = this.getAuraType(entry);
      const auraName = auraType !== null ? AuraType[auraType] : 'Unknown';
      desc += ` (Aura: ${auraName})`;
    }

    if (this.isPeriodicEffect(entry)) {
      desc += ` [Periodic: ${entry.effectAuraPeriod}ms]`;
    }

    if (this.hasChainTargets(entry)) {
      desc += ` [Chain: ${entry.effectChainTargets} targets]`;
    }

    return desc;
  }
}

/**
 * DB2 File Metadata
 */
export const SpellEffectDB2Metadata = {
  fileName: 'SpellEffect.db2',
  fileDataId: 1140088,
  layoutHash: 0x239b1b53,
  fieldCount: 36, // Arrays expanded
  compressedFieldCount: 29, // Actual DB2 fields
  hasIndexField: false,
  hasParentIndexField: true,
  parentIndexField: 35, // SpellID field
  hotfixSelector: 'HOTFIX_SEL_SPELL_EFFECT',
  note: 'Each spell can have up to 3 effects (EffectIndex 0-2). Contains ~200,000 entries for WoW 12.0.',
};
