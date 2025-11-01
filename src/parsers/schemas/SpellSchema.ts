/**
 * Spell.db2 Schema for WoW 11.2 (The War Within)
 * Based on TrinityCore's SpellInfo class structure
 * Source: src/server/game/Spells/SpellInfo.h
 */

import { DB2Record } from '../db2/DB2Record';

/**
 * Spell Power Cost Entry
 * Represents mana/energy/rage/etc. cost for casting a spell
 */
export interface SpellPowerCost {
  power: number; // Powers enum (Mana, Rage, Energy, etc.)
  amount: number; // Cost amount
}

/**
 * Spell Scaling Information
 * Controls how spell damage/healing scales with character level
 */
export interface SpellScalingInfo {
  minScalingLevel: number; // Minimum level for scaling
  maxScalingLevel: number; // Maximum level for scaling
  scalesFromItemLevel: number; // Whether scaling uses item level
}

/**
 * Square Root Damage/Healing Diminishing Returns
 * Controls AoE damage reduction for large numbers of targets
 */
export interface SqrtDamageAndHealingDiminishing {
  maxTargets: number; // Number of targets before diminishing starts
  numNonDiminishedTargets: number; // Targets that take full damage
}

/**
 * Complete Spell Entry Interface
 * Mirrors TrinityCore's SpellInfo class
 * All fields match C++ structure exactly
 */
export interface SpellEntry {
  // Core identification
  id: number; // Spell ID (uint32)
  difficulty: number; // Difficulty level (::Difficulty)

  // Basic properties
  categoryId: number; // Spell category (uint32)
  dispel: number; // Dispel type (uint32)
  mechanic: number; // Spell mechanic (uint32)

  // Spell attributes (16 attribute flags)
  attributes: number; // SpellAttr0 (uint32)
  attributesEx: number; // SpellAttr1 (uint32)
  attributesEx2: number; // SpellAttr2 (uint32)
  attributesEx3: number; // SpellAttr3 (uint32)
  attributesEx4: number; // SpellAttr4 (uint32)
  attributesEx5: number; // SpellAttr5 (uint32)
  attributesEx6: number; // SpellAttr6 (uint32)
  attributesEx7: number; // SpellAttr7 (uint32)
  attributesEx8: number; // SpellAttr8 (uint32)
  attributesEx9: number; // SpellAttr9 (uint32)
  attributesEx10: number; // SpellAttr10 (uint32)
  attributesEx11: number; // SpellAttr11 (uint32)
  attributesEx12: number; // SpellAttr12 (uint32)
  attributesEx13: number; // SpellAttr13 (uint32)
  attributesEx14: number; // SpellAttr14 (uint32)
  attributesEx15: number; // SpellAttr15 (uint32)
  attributesCu: number; // Custom attributes (uint32)

  // Targeting and requirements
  stances: bigint; // Required shapeshift forms (uint64)
  stancesNot: bigint; // Excluded shapeshift forms (uint64)
  targets: number; // Target flags (uint32)
  targetCreatureType: number; // Target creature type mask (uint32)
  requiresSpellFocus: number; // Required spell focus object (uint32)
  facingCasterFlags: number; // Facing requirements (uint32)

  // Aura state requirements
  casterAuraState: number; // Required caster aura state (uint32)
  targetAuraState: number; // Required target aura state (uint32)
  excludeCasterAuraState: number; // Excluded caster aura state (uint32)
  excludeTargetAuraState: number; // Excluded target aura state (uint32)
  casterAuraSpell: number; // Required caster aura spell ID (uint32)
  targetAuraSpell: number; // Required target aura spell ID (uint32)
  excludeCasterAuraSpell: number; // Excluded caster aura spell ID (uint32)
  excludeTargetAuraSpell: number; // Excluded target aura spell ID (uint32)
  casterAuraType: number; // Required caster aura type (AuraType)
  targetAuraType: number; // Required target aura type (AuraType)
  excludeCasterAuraType: number; // Excluded caster aura type (AuraType)
  excludeTargetAuraType: number; // Excluded target aura type (AuraType)

  // Cooldowns and timing
  castTimeEntry: number; // Cast time entry ID (reference to SpellCastTimes.db2)
  recoveryTime: number; // Base cooldown in milliseconds (uint32)
  categoryRecoveryTime: number; // Category cooldown in milliseconds (uint32)
  startRecoveryCategory: number; // GCD category (uint32)
  startRecoveryTime: number; // GCD time in milliseconds (uint32)
  cooldownAuraSpellId: number; // Spell that triggers cooldown (uint32)

  // Interrupt flags
  interruptFlags: number; // SpellInterruptFlags (uint32)
  auraInterruptFlags: number; // SpellAuraInterruptFlags (uint32)
  auraInterruptFlags2: number; // SpellAuraInterruptFlags2 (uint32)
  channelInterruptFlags: number; // Channel interrupt flags (uint32)
  channelInterruptFlags2: number; // Channel interrupt flags 2 (uint32)

  // Proc system
  procFlags: bigint; // Proc condition flags (uint64)
  procChance: number; // Proc chance percentage (uint32)
  procCharges: number; // Number of charges (uint32)
  procCooldown: number; // Proc cooldown in milliseconds (uint32)
  procBasePPM: number; // Base procs per minute (float)

  // Level requirements
  maxLevel: number; // Maximum target level (uint32)
  baseLevel: number; // Base spell level (uint32)
  spellLevel: number; // Spell level requirement (uint32)

  // Duration and power
  durationEntry: number; // Duration entry ID (reference to SpellDuration.db2)
  rangeEntry: number; // Range entry ID (reference to SpellRange.db2)
  speed: number; // Projectile speed (float)
  launchDelay: number; // Launch delay in seconds (float)
  minDuration: number; // Minimum duration in seconds (float)
  stackAmount: number; // Maximum stack count (uint32)

  // Totems
  totem: number[]; // Totem item IDs (int32[2])
  totemCategory: number[]; // Totem categories (uint16[2])

  // Reagents
  reagent: number[]; // Reagent item IDs (int32[8])
  reagentCount: number[]; // Reagent counts (int16[8])

  // Equipment requirements
  equippedItemClass: number; // Required item class (-1 = none) (int32)
  equippedItemSubClassMask: number; // Required item subclass mask (int32)
  equippedItemInventoryTypeMask: number; // Required inventory type mask (int32)

  // Visual and UI
  iconFileDataId: number; // Spell icon file data ID (uint32)
  activeIconFileDataId: number; // Active icon file data ID (uint32)
  spellName: string; // Spell name (localized)

  // Area and targeting geometry
  coneAngle: number; // Cone angle in degrees (float)
  width: number; // Line/cone width (float)
  maxTargetLevel: number; // Maximum target level (uint32)
  maxAffectedTargets: number; // Maximum affected targets (uint32)

  // Spell family
  spellFamilyName: number; // Spell family (uint32)
  spellFamilyFlags: bigint[]; // Spell family flags (flag128 = 4x uint32)

  // Damage and prevention
  dmgClass: number; // Damage class (Melee, Ranged, Magic) (uint32)
  preventionType: number; // Prevention type (uint32)
  schoolMask: number; // School mask (Physical, Holy, Fire, etc.) (uint32)

  // Miscellaneous
  requiredAreasID: number; // Required area ID (-1 = none) (int32)
  chargeCategoryId: number; // Charge category ID (uint32)
  contentTuningId: number; // Content tuning ID (uint32)
  showFutureSpellPlayerConditionID: number; // Player condition ID (uint32)

  // Scaling
  scaling: SpellScalingInfo; // Spell scaling information

  // AoE diminishing
  sqrtDamageAndHealingDiminishing: SqrtDamageAndHealingDiminishing;

  // Power costs (multiple power types supported)
  powerCosts: SpellPowerCost[]; // Up to MAX_POWERS_PER_SPELL (5)

  // Explicit target mask
  explicitTargetMask: number; // Required explicit target mask (uint32)
  requiredExplicitTargetMask: number; // Required explicit target mask (uint32)

  // Labels and empowerment
  labels: number[]; // Spell labels (set of uint32)
  empowerStageThresholds: number[]; // Empower stage thresholds in milliseconds
}

/**
 * Spell Schema Parser
 * Parses Spell.db2 records into SpellEntry objects
 */
export class SpellSchema {
  /**
   * Parse a DB2Record into a SpellEntry
   * @param record DB2Record from Spell.db2
   * @returns Parsed SpellEntry object
   */
  public static parse(record: DB2Record): SpellEntry {
    // Field indices based on Spell.db2 structure
    // NOTE: Actual field order may vary - this is based on TrinityCore's structure
    // Real implementation would need precise DB2 layout hash mapping

    return {
      // Core identification (fields 0-1)
      id: record.getUInt32(0),
      difficulty: record.getUInt32(1),

      // Basic properties (fields 2-4)
      categoryId: record.getUInt32(2),
      dispel: record.getUInt32(3),
      mechanic: record.getUInt32(4),

      // Spell attributes (fields 5-21, 16 total)
      attributes: record.getUInt32(5),
      attributesEx: record.getUInt32(6),
      attributesEx2: record.getUInt32(7),
      attributesEx3: record.getUInt32(8),
      attributesEx4: record.getUInt32(9),
      attributesEx5: record.getUInt32(10),
      attributesEx6: record.getUInt32(11),
      attributesEx7: record.getUInt32(12),
      attributesEx8: record.getUInt32(13),
      attributesEx9: record.getUInt32(14),
      attributesEx10: record.getUInt32(15),
      attributesEx11: record.getUInt32(16),
      attributesEx12: record.getUInt32(17),
      attributesEx13: record.getUInt32(18),
      attributesEx14: record.getUInt32(19),
      attributesEx15: record.getUInt32(20),
      attributesCu: record.getUInt32(21),

      // Targeting (fields 22-27)
      stances: record.getUInt64(22),
      stancesNot: record.getUInt64(23),
      targets: record.getUInt32(24),
      targetCreatureType: record.getUInt32(25),
      requiresSpellFocus: record.getUInt32(26),
      facingCasterFlags: record.getUInt32(27),

      // Aura states (fields 28-39)
      casterAuraState: record.getUInt32(28),
      targetAuraState: record.getUInt32(29),
      excludeCasterAuraState: record.getUInt32(30),
      excludeTargetAuraState: record.getUInt32(31),
      casterAuraSpell: record.getUInt32(32),
      targetAuraSpell: record.getUInt32(33),
      excludeCasterAuraSpell: record.getUInt32(34),
      excludeTargetAuraSpell: record.getUInt32(35),
      casterAuraType: record.getUInt32(36),
      targetAuraType: record.getUInt32(37),
      excludeCasterAuraType: record.getUInt32(38),
      excludeTargetAuraType: record.getUInt32(39),

      // Cooldowns (fields 40-45)
      castTimeEntry: record.getUInt32(40),
      recoveryTime: record.getUInt32(41),
      categoryRecoveryTime: record.getUInt32(42),
      startRecoveryCategory: record.getUInt32(43),
      startRecoveryTime: record.getUInt32(44),
      cooldownAuraSpellId: record.getUInt32(45),

      // Interrupts (fields 46-50)
      interruptFlags: record.getUInt32(46),
      auraInterruptFlags: record.getUInt32(47),
      auraInterruptFlags2: record.getUInt32(48),
      channelInterruptFlags: record.getUInt32(49),
      channelInterruptFlags2: record.getUInt32(50),

      // Proc (fields 51-55)
      procFlags: record.getUInt64(51),
      procChance: record.getUInt32(52),
      procCharges: record.getUInt32(53),
      procCooldown: record.getUInt32(54),
      procBasePPM: record.getFloat(55),

      // Levels (fields 56-58)
      maxLevel: record.getUInt32(56),
      baseLevel: record.getUInt32(57),
      spellLevel: record.getUInt32(58),

      // Duration/Range/Speed (fields 59-64)
      durationEntry: record.getUInt32(59),
      rangeEntry: record.getUInt32(60),
      speed: record.getFloat(61),
      launchDelay: record.getFloat(62),
      minDuration: record.getFloat(63),
      stackAmount: record.getUInt32(64),

      // Totems (fields 65-68)
      totem: [
        record.getInt32(65),
        record.getInt32(66),
      ],
      totemCategory: [
        record.getUInt16(67, 0),
        record.getUInt16(67, 1),
      ],

      // Reagents (fields 68-83) - 8 reagents, each with ID and count
      reagent: [
        record.getInt32(68),
        record.getInt32(69),
        record.getInt32(70),
        record.getInt32(71),
        record.getInt32(72),
        record.getInt32(73),
        record.getInt32(74),
        record.getInt32(75),
      ],
      reagentCount: [
        record.getUInt16(76, 0),
        record.getUInt16(76, 1),
        record.getUInt16(76, 2),
        record.getUInt16(76, 3),
        record.getUInt16(77, 0),
        record.getUInt16(77, 1),
        record.getUInt16(77, 2),
        record.getUInt16(77, 3),
      ],

      // Equipment (fields 78-80)
      equippedItemClass: record.getInt32(78),
      equippedItemSubClassMask: record.getInt32(79),
      equippedItemInventoryTypeMask: record.getInt32(80),

      // Visual (fields 81-83)
      iconFileDataId: record.getUInt32(81),
      activeIconFileDataId: record.getUInt32(82),
      spellName: record.getString(83),

      // Geometry (fields 84-87)
      coneAngle: record.getFloat(84),
      width: record.getFloat(85),
      maxTargetLevel: record.getUInt32(86),
      maxAffectedTargets: record.getUInt32(87),

      // Family (fields 88-92)
      spellFamilyName: record.getUInt32(88),
      spellFamilyFlags: [
        BigInt(record.getUInt32(89)),
        BigInt(record.getUInt32(90)),
        BigInt(record.getUInt32(91)),
        BigInt(record.getUInt32(92)),
      ],

      // Damage (fields 93-95)
      dmgClass: record.getUInt32(93),
      preventionType: record.getUInt32(94),
      schoolMask: record.getUInt32(95),

      // Misc (fields 96-99)
      requiredAreasID: record.getInt32(96),
      chargeCategoryId: record.getUInt32(97),
      contentTuningId: record.getUInt32(98),
      showFutureSpellPlayerConditionID: record.getUInt32(99),

      // Scaling (fields 100-102)
      scaling: {
        minScalingLevel: record.getUInt32(100),
        maxScalingLevel: record.getUInt32(101),
        scalesFromItemLevel: record.getUInt32(102),
      },

      // AoE diminishing (fields 103-104)
      sqrtDamageAndHealingDiminishing: {
        maxTargets: record.getInt32(103),
        numNonDiminishedTargets: record.getInt32(104),
      },

      // Power costs - placeholder (would be loaded from SpellPower.db2)
      powerCosts: [],

      // Explicit targets (fields 105-106)
      explicitTargetMask: record.getUInt32(105),
      requiredExplicitTargetMask: record.getUInt32(106),

      // Labels and empowerment - placeholder (complex structures)
      labels: [],
      empowerStageThresholds: [],
    };
  }

  /**
   * Check if spell has specific attribute
   * @param spell SpellEntry object
   * @param attributeIndex Which attribute set (0-15)
   * @param flag Specific flag bitmask
   * @returns True if attribute is set
   */
  public static hasAttribute(spell: SpellEntry, attributeIndex: number, flag: number): boolean {
    const attrMap: Record<number, keyof SpellEntry> = {
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
      11: 'attributesEx12',
      12: 'attributesEx12',
      13: 'attributesEx13',
      14: 'attributesEx14',
      15: 'attributesEx15',
    };

    const attrKey = attrMap[attributeIndex];
    if (!attrKey) {
      return false;
    }

    const attrValue = spell[attrKey];
    if (typeof attrValue === 'number') {
      return !!(attrValue & flag);
    }

    return false;
  }

  /**
   * Get spell school name from school mask
   * @param schoolMask School mask bitmask
   * @returns Array of school names
   */
  public static getSchoolNames(schoolMask: number): string[] {
    const schools: string[] = [];
    const schoolMap: Record<number, string> = {
      0x01: 'Physical',
      0x02: 'Holy',
      0x04: 'Fire',
      0x08: 'Nature',
      0x10: 'Frost',
      0x20: 'Shadow',
      0x40: 'Arcane',
    };

    for (const [mask, name] of Object.entries(schoolMap)) {
      if (schoolMask & parseInt(mask)) {
        schools.push(name);
      }
    }

    return schools.length > 0 ? schools : ['Physical'];
  }

  /**
   * Check if spell is passive
   * @param spell SpellEntry object
   * @returns True if spell is passive
   */
  public static isPassive(spell: SpellEntry): boolean {
    // SPELL_ATTR0_PASSIVE = 0x00000040
    return !!(spell.attributes & 0x00000040);
  }

  /**
   * Check if spell can crit
   * @param spell SpellEntry object
   * @returns True if spell can crit
   */
  public static canCrit(spell: SpellEntry): boolean {
    // SPELL_ATTR0_CU_CAN_CRIT (custom attribute)
    return !!(spell.attributesCu & 0x00000080);
  }

  /**
   * Get spell cast time in milliseconds
   * @param spell SpellEntry object
   * @returns Cast time (would need to lookup SpellCastTimes.db2)
   */
  public static getCastTime(spell: SpellEntry): number {
    // Would need to query SpellCastTimes.db2 with spell.castTimeEntry
    // For now, return 0 (instant)
    return 0;
  }
}
