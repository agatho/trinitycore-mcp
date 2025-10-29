/**
 * Combat Mechanics MCP
 *
 * Deep combat calculations: melee damage, armor mitigation, threat generation,
 * diminishing returns, proc chances, and resource regeneration.
 * Leverages GameTable data for accurate retail WoW 11.2 formulas.
 *
 * @module combatmechanics
 */

import { getCombatRating, getHpPerSta, queryGameTable } from "./gametable";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface MeleeDamageResult {
  baseDamage: number;
  weaponDamage: number;
  attackPowerBonus: number;
  totalDamage: number;
  critChance: number;
  critDamage: number;
  expectedDamage: number;
  dps: number;
  attackSpeed: number;
}

export interface ArmorMitigationResult {
  rawDamage: number;
  armor: number;
  damageReduction: number; // percentage
  mitigatedDamage: number;
  effectiveDamage: number;
  armorConstant: number; // Level-based constant
}

export interface ThreatCalculation {
  damageDealt: number;
  healingDone: number;
  threatModifier: number;
  baseThreat: number;
  bonusThreat: number;
  totalThreat: number;
  isTankStance: boolean;
}

export interface DiminishingReturnsInfo {
  stat: string;
  rating: number;
  percentBefore: number;
  ratingToAdd: number;
  percentAfter: number;
  gainPercent: number;
  efficiency: number; // How much of the rating converted (0-1)
  drCategory: "none" | "linear" | "soft_cap" | "hard_cap";
}

export interface ProcCalculation {
  procChance: number; // Base proc chance
  ppmRate?: number; // Procs per minute
  internalCooldown?: number; // Seconds
  realProcChance: number; // After all modifiers
  expectedProcsPerMinute: number;
  averageTimeBetweenProcs: number; // Seconds
}

export interface ResourceRegeneration {
  resourceType: "mana" | "rage" | "energy" | "focus" | "runic_power";
  baseRegen: number;
  spiritBonus?: number;
  hasteBonus: number;
  totalRegen: number;
  regenPer5: number; // Per 5 seconds
  regenPerSecond: number;
  timeToFull: number; // Seconds to full resource
}

export interface AvoidanceCalculation {
  dodge: number;
  parry: number;
  block?: number;
  miss: number;
  totalAvoidance: number;
  hitChance: number; // Chance to be hit
  effectiveHealth: number;
}

export interface CritCapAnalysis {
  currentCritRating: number;
  currentCritPercent: number;
  softCap: number; // Rating where DR starts
  hardCap: number; // Rating where gains minimal
  ratingToSoftCap: number;
  efficiency: number; // Current conversion efficiency
  recommendation: string;
}

// ============================================================================
// MELEE DAMAGE CALCULATIONS
// ============================================================================

/**
 * Calculate melee auto-attack damage
 */
export async function calculateMeleeDamage(params: {
  weaponDPS: number;
  attackSpeed: number;
  attackPower: number;
  critRating: number;
  level: number;
  targetArmor?: number;
}): Promise<MeleeDamageResult> {
  const { weaponDPS, attackSpeed, attackPower, critRating, level, targetArmor } = params;

  // Base weapon damage
  const weaponDamage = weaponDPS * attackSpeed;

  // Attack power bonus (AP / 3.5 per second in modern WoW)
  const attackPowerBonus = (attackPower / 3.5) * attackSpeed;

  // Total before crit
  const baseDamage = weaponDamage + attackPowerBonus;

  // Get crit chance from rating
  const critRatingValue = await getCombatRating(level, "Crit - Melee");
  const critChance = critRatingValue ? (critRating / critRatingValue) * 100 : 0;

  // Crit damage (2x in WoW)
  const critMultiplier = 2.0;
  const critDamage = baseDamage * critMultiplier;

  // Expected damage (accounting for crits)
  const expectedDamage = (baseDamage * (1 - critChance / 100)) + (critDamage * (critChance / 100));

  // Apply armor mitigation if target armor provided
  let finalDamage = expectedDamage;
  if (targetArmor !== undefined && targetArmor > 0) {
    const mitigation = await calculateArmorMitigation(expectedDamage, targetArmor, level);
    finalDamage = mitigation.effectiveDamage;
  }

  // DPS
  const dps = finalDamage / attackSpeed;

  return {
    baseDamage,
    weaponDamage,
    attackPowerBonus,
    totalDamage: baseDamage,
    critChance,
    critDamage,
    expectedDamage: finalDamage,
    dps,
    attackSpeed
  };
}

// ============================================================================
// ARMOR MITIGATION
// ============================================================================

/**
 * Calculate damage reduction from armor
 * Formula: DR% = Armor / (Armor + K)
 * where K is level-dependent constant
 */
export async function calculateArmorMitigation(
  rawDamage: number,
  armor: number,
  attackerLevel: number
): Promise<ArmorMitigationResult> {
  // Armor constant varies by level in retail WoW
  // Approximation: K = 400 + 85 * attackerLevel
  const armorConstant = 400 + (85 * attackerLevel);

  // Damage reduction percentage
  const damageReduction = (armor / (armor + armorConstant)) * 100;

  // Mitigated damage amount
  const mitigatedDamage = rawDamage * (damageReduction / 100);

  // Effective damage after mitigation
  const effectiveDamage = rawDamage - mitigatedDamage;

  return {
    rawDamage,
    armor,
    damageReduction,
    mitigatedDamage,
    effectiveDamage,
    armorConstant
  };
}

// ============================================================================
// THREAT CALCULATIONS
// ============================================================================

/**
 * Calculate threat generation
 * Threat formula varies by action type and stance
 */
export function calculateThreat(params: {
  damageDealt?: number;
  healingDone?: number;
  isTankStance: boolean;
  threatModifiers?: number; // From abilities like Taunt
}): ThreatCalculation {
  const { damageDealt = 0, healingDone = 0, isTankStance, threatModifiers = 1.0 } = params;

  // Base threat from damage (1:1 ratio)
  const damageThreat = damageDealt;

  // Healing threat (50% of healing in classic/TBC, varies in retail)
  const healingThreat = healingDone * 0.5;

  // Base threat before modifiers
  const baseThreat = damageThreat + healingThreat;

  // Tank stance multiplier (typically 5x in retail for tanks)
  const stanceMultiplier = isTankStance ? 5.0 : 1.0;

  // Bonus threat from abilities
  const bonusThreat = baseThreat * threatModifiers;

  // Total threat
  const totalThreat = (baseThreat + bonusThreat) * stanceMultiplier;

  return {
    damageDealt,
    healingDone,
    threatModifier: stanceMultiplier * threatModifiers,
    baseThreat,
    bonusThreat,
    totalThreat,
    isTankStance
  };
}

// ============================================================================
// DIMINISHING RETURNS
// ============================================================================

/**
 * WoW 11.2 (The War Within) Diminishing Returns Breakpoints
 * Based on official retail secondary stat DR curves
 *
 * Piecewise linear approximation of hyperbolic DR formula:
 * - Each breakpoint represents a threshold where efficiency changes
 * - Efficiency multiplier applies to gains above the previous breakpoint
 *
 * Formula: For each stat point above breakpoint[i]:
 *   effective_gain = raw_gain * efficiency[i]
 */
interface DRBreakpoint {
  threshold: number;    // Percent threshold
  efficiency: number;   // Conversion efficiency above this threshold
}

const DR_BREAKPOINTS: DRBreakpoint[] = [
  { threshold: 0,   efficiency: 1.00 },  // 0-30%: Full value (100%)
  { threshold: 30,  efficiency: 0.90 },  // 30-39%: 90% efficiency
  { threshold: 39,  efficiency: 0.80 },  // 39-47%: 80% efficiency
  { threshold: 47,  efficiency: 0.70 },  // 47-54%: 70% efficiency
  { threshold: 54,  efficiency: 0.60 },  // 54-66%: 60% efficiency
  { threshold: 66,  efficiency: 0.50 },  // 66-126%: 50% efficiency
  { threshold: 126, efficiency: 0.10 },  // 126%+: Minimal gains (10%)
];

/**
 * Apply WoW 11.2 piecewise linear diminishing returns
 *
 * @param linearPercent - The raw percentage without DR applied
 * @returns The effective percentage after DR
 *
 * @example
 * applyDiminishingReturns(35) // 30 + (5 * 0.9) = 34.5%
 * applyDiminishingReturns(50) // 30 + (9 * 0.9) + (3 * 0.8) = 40.5%
 */
function applyDiminishingReturns(linearPercent: number): number {
  let effectivePercent = 0;
  let previousThreshold = 0;

  for (let i = 0; i < DR_BREAKPOINTS.length; i++) {
    const breakpoint = DR_BREAKPOINTS[i];
    const nextThreshold = i < DR_BREAKPOINTS.length - 1
      ? DR_BREAKPOINTS[i + 1].threshold
      : Infinity;

    if (linearPercent <= breakpoint.threshold) {
      // We're still below this breakpoint, no more processing needed
      break;
    }

    // Calculate how much rating falls in this bracket
    const bracketCap = Math.min(linearPercent, nextThreshold);
    const bracketAmount = bracketCap - breakpoint.threshold;

    // Apply efficiency for this bracket
    effectivePercent += bracketAmount * breakpoint.efficiency;

    if (linearPercent <= nextThreshold) {
      // We've consumed all the rating
      break;
    }
  }

  return effectivePercent;
}

/**
 * Get stat-specific DR caps for WoW 11.2
 * Different stats have slightly different practical caps
 *
 * @param stat - The secondary stat type
 * @returns Object with softCap (where DR starts hurting) and hardCap (where gains are minimal)
 */
function getDRCapsForStat(
  stat: "crit" | "haste" | "mastery" | "versatility" | "avoidance"
): { softCap: number; hardCap: number } {
  // Soft cap: Where efficiency drops below 90% (39% effective)
  // Hard cap: Where efficiency is 50% or less (66% effective)

  const baseCaps = {
    softCap: 39,  // 39% effective = where 80% efficiency begins
    hardCap: 66,  // 66% effective = where 50% efficiency begins
  };

  // Stat-specific adjustments for WoW 11.2
  switch (stat) {
    case "crit":
      // Crit has natural 5% base, effective cap slightly higher
      return { softCap: 39, hardCap: 70 };

    case "haste":
      // Haste has no base, standard caps
      return { softCap: 39, hardCap: 66 };

    case "mastery":
      // Mastery effectiveness varies by spec, but DR is standard
      return { softCap: 39, hardCap: 66 };

    case "versatility":
      // Versatility has no DR in damage, only in DR%
      // But rating-to-percent conversion follows same DR
      return { softCap: 39, hardCap: 66 };

    case "avoidance":
      // Avoidance (dodge/parry) has stricter caps due to PvE balance
      return { softCap: 35, hardCap: 60 };

    default:
      return baseCaps;
  }
}

/**
 * Calculate diminishing returns on secondary stats
 * Modern WoW has DR on crit, haste, mastery, versatility
 */
export async function calculateDiminishingReturns(params: {
  stat: "crit" | "haste" | "mastery" | "versatility" | "avoidance";
  currentRating: number;
  ratingToAdd: number;
  level: number;
}): Promise<DiminishingReturnsInfo> {
  const { stat, currentRating, ratingToAdd, level } = params;

  // Get rating conversion value
  const statName = stat === "crit" ? "Crit - Melee" : stat.charAt(0).toUpperCase() + stat.slice(1);
  const ratingValue = await getCombatRating(level, statName);

  if (!ratingValue || ratingValue === 0) {
    return {
      stat,
      rating: currentRating,
      percentBefore: 0,
      ratingToAdd,
      percentAfter: 0,
      gainPercent: 0,
      efficiency: 0,
      drCategory: "none"
    };
  }

  // Calculate percent before (with DR applied)
  const linearPercentBefore = (currentRating / ratingValue) * 100;
  const percentBefore = applyDiminishingReturns(linearPercentBefore);

  // Calculate percent after (with accurate WoW 11.2 Diminishing Returns)
  // WoW uses piecewise linear DR breakpoints for secondary stats
  const newRating = currentRating + ratingToAdd;
  const linearPercentAfter = (newRating / ratingValue) * 100;

  // Apply WoW 11.2 (The War Within) Diminishing Returns Formula
  // Piecewise linear breakpoints based on retail data
  const percentAfter = applyDiminishingReturns(linearPercentAfter);

  // Determine soft cap and hard cap based on stat type
  const { softCap, hardCap } = getDRCapsForStat(stat);

  // Calculate actual gain vs expected gain (efficiency)
  const gainPercent = percentAfter - percentBefore;
  const expectedGainLinear = (ratingToAdd / ratingValue) * 100;
  const efficiency = expectedGainLinear > 0 ? gainPercent / expectedGainLinear : 0;

  // Determine DR category based on effective percent
  let drCategory: DiminishingReturnsInfo["drCategory"] = "none";
  if (percentAfter >= hardCap) {
    drCategory = "hard_cap";
  } else if (percentAfter >= softCap) {
    drCategory = "soft_cap";
  } else if (percentAfter >= 30) {
    // Between 30% and soft cap (39%) - linear 90% efficiency
    drCategory = "linear";
  } else {
    // Below 30% - no DR, full efficiency
    drCategory = "none";
  }

  return {
    stat,
    rating: currentRating,
    percentBefore,
    ratingToAdd,
    percentAfter,
    gainPercent,
    efficiency,
    drCategory
  };
}

// ============================================================================
// PROC CALCULATIONS
// ============================================================================

/**
 * Calculate proc chances and expected frequency
 */
export function calculateProcChance(params: {
  baseProcChance?: number; // Decimal (0.05 = 5%)
  ppmRate?: number; // Procs per minute
  attackSpeed?: number; // For PPM calculation
  internalCooldown?: number; // Seconds
  hastePercent?: number; // Affects PPM
}): ProcCalculation {
  const { baseProcChance, ppmRate, attackSpeed, internalCooldown, hastePercent = 0 } = params;

  let realProcChance = baseProcChance || 0;
  let expectedProcsPerMinute = 0;

  if (ppmRate && attackSpeed) {
    // PPM formula: chance = (PPM * weapon_speed * haste_mod) / 60
    const hasteMod = 1 + (hastePercent / 100);
    realProcChance = (ppmRate * attackSpeed * hasteMod) / 60;
    expectedProcsPerMinute = ppmRate * hasteMod;
  } else if (baseProcChance && attackSpeed) {
    // Fixed proc chance
    const attemptsPerMinute = 60 / attackSpeed;
    expectedProcsPerMinute = attemptsPerMinute * baseProcChance;
  }

  // Account for internal cooldown
  if (internalCooldown && expectedProcsPerMinute > 0) {
    const maxProcsPerMinute = 60 / internalCooldown;
    expectedProcsPerMinute = Math.min(expectedProcsPerMinute, maxProcsPerMinute);
  }

  const averageTimeBetweenProcs = expectedProcsPerMinute > 0
    ? 60 / expectedProcsPerMinute
    : Infinity;

  return {
    procChance: baseProcChance || 0,
    ppmRate,
    internalCooldown,
    realProcChance,
    expectedProcsPerMinute,
    averageTimeBetweenProcs
  };
}

// ============================================================================
// RESOURCE REGENERATION
// ============================================================================

/**
 * Calculate resource regeneration rates
 */
export async function calculateResourceRegen(params: {
  resourceType: ResourceRegeneration["resourceType"];
  level: number;
  spirit?: number;
  hasteRating?: number;
  maxResource: number;
  baseRegen?: number;
}): Promise<ResourceRegeneration> {
  const { resourceType, level, spirit = 0, hasteRating = 0, maxResource, baseRegen = 0 } = params;

  let regenPerSecond = baseRegen;

  // Mana regeneration (WoW 11.2 - The War Within)
  // Note: Spirit was removed in Legion. Modern mana regen is class/spec-based
  if (resourceType === "mana") {
    // Base mana regen varies by class and spec
    // For WoW 11.2, typical in-combat mana regen is 1-2% of max mana per 5 seconds
    // Out-of-combat regen is significantly higher (~5-10% per 5 seconds)

    // If spirit is provided (legacy support or private server), use classic formula
    if (spirit > 0) {
      // Classic/TBC/Wrath Spirit Formula:
      // MP5 = 5 * sqrt(Intellect) * sqrt(Spirit) * BaseRegen
      // Simplified for TrinityCore: Spirit * 0.009327 * sqrt(Intellect)
      // Since we don't have Intellect here, use approximation based on max mana
      const estimatedIntellect = Math.sqrt(maxResource / 15); // Rough estimate
      const spiritRegen = 5 * Math.sqrt(estimatedIntellect) * Math.sqrt(spirit) * 0.009327;
      regenPerSecond += spiritRegen / 5; // Convert MP5 to per second
    } else {
      // Modern WoW 11.2 mana regeneration (no spirit)
      // Base regen is 1% of max mana per 5 seconds in combat
      // Assumes character is in combat; out-of-combat would be 5-10x higher
      const baseManaRegenPer5 = maxResource * 0.01; // 1% per 5 seconds
      regenPerSecond = baseManaRegenPer5 / 5;

      // Some specs have higher base regen (e.g., Arcane Mage, Balance Druid)
      // This would be adjusted based on spec in a full implementation
    }
  }

  // Rage regeneration (from damage taken/dealt)
  if (resourceType === "rage") {
    // Rage is event-driven, not time-based
    regenPerSecond = 0;
  }

  // Energy regeneration (rogue, feral, monk)
  if (resourceType === "energy") {
    // Base 10 energy per second
    regenPerSecond = 10;
  }

  // Focus regeneration (hunter)
  if (resourceType === "focus") {
    // Base 5-10 focus per second depending on spec
    regenPerSecond = 7.5;
  }

  // Apply haste to regen (affects energy, focus, some mana)
  if (hasteRating > 0 && (resourceType === "energy" || resourceType === "focus")) {
    const hasteValue = await getCombatRating(level, "Haste - Melee");
    if (hasteValue) {
      const hastePercent = (hasteRating / hasteValue) * 100;
      regenPerSecond *= (1 + hastePercent / 100);
    }
  }

  const regenPer5 = regenPerSecond * 5;
  const timeToFull = regenPerSecond > 0 ? maxResource / regenPerSecond : 0;

  // Calculate spirit bonus if applicable
  let spiritBonus: number | undefined;
  if (spirit > 0 && resourceType === "mana") {
    const estimatedIntellect = Math.sqrt(maxResource / 15);
    spiritBonus = 5 * Math.sqrt(estimatedIntellect) * Math.sqrt(spirit) * 0.009327;
  }

  // Calculate haste bonus for energy/focus resources
  let hasteBonus = 0;
  if (hasteRating > 0 && (resourceType === "energy" || resourceType === "focus")) {
    const hasteValue = await getCombatRating(level, "Haste - Melee");
    if (hasteValue) {
      const hastePercent = (hasteRating / hasteValue) * 100;
      hasteBonus = (regenPerSecond / (1 + hastePercent / 100)) * (hastePercent / 100);
    }
  }

  return {
    resourceType,
    baseRegen,
    spiritBonus,
    hasteBonus,
    totalRegen: regenPerSecond,
    regenPer5,
    regenPerSecond,
    timeToFull
  };
}

// ============================================================================
// AVOIDANCE CALCULATIONS
// ============================================================================

/**
 * Calculate total avoidance (dodge, parry, block, miss)
 */
export async function calculateAvoidance(params: {
  level: number;
  dodgeRating: number;
  parryRating: number;
  blockRating?: number;
  baseStamina: number;
  armor: number;
  health: number;
}): Promise<AvoidanceCalculation> {
  const { level, dodgeRating, parryRating, blockRating = 0, baseStamina, armor, health } = params;

  // Convert ratings to percentages
  const dodgeValue = await getCombatRating(level, "Dodge");
  const parryValue = await getCombatRating(level, "Parry");

  const dodge = dodgeValue ? (dodgeRating / dodgeValue) * 100 : 0;
  const parry = parryValue ? (parryRating / parryValue) * 100 : 0;
  const block = 0; // Would calculate if block rating provided

  // Base miss chance (typically ~3-5% for same level)
  const miss = 3;

  // Total avoidance (capped at ~100% with DR)
  const totalAvoidance = Math.min(dodge + parry + block + miss, 85); // 85% cap with DR

  // Hit chance
  const hitChance = 100 - totalAvoidance;

  // Effective health (health / (1 - avoidance%))
  const effectiveHealth = health / (hitChance / 100);

  return {
    dodge,
    parry,
    block: block > 0 ? block : undefined,
    miss,
    totalAvoidance,
    hitChance,
    effectiveHealth
  };
}

// ============================================================================
// CRIT CAP ANALYSIS
// ============================================================================

/**
 * Analyze crit rating efficiency and cap proximity
 */
export async function analyzeCritCap(
  currentCritRating: number,
  level: number,
  statType: "spell" | "melee"
): Promise<CritCapAnalysis> {
  const critName = statType === "spell" ? "Crit - Spell" : "Crit - Melee";
  const ratingValue = await getCombatRating(level, critName);

  if (!ratingValue) {
    return {
      currentCritRating,
      currentCritPercent: 0,
      softCap: 0,
      hardCap: 0,
      ratingToSoftCap: 0,
      efficiency: 0,
      recommendation: "Unable to calculate - rating data unavailable"
    };
  }

  // Apply DR to get effective crit percent
  const linearCritPercent = (currentCritRating / ratingValue) * 100;
  const currentCritPercent = applyDiminishingReturns(linearCritPercent);

  // Get accurate DR caps for crit (39% soft, 70% hard for crit due to base 5%)
  const { softCap: softCapPercent, hardCap: hardCapPercent } = getDRCapsForStat("crit");

  // Calculate rating needed to reach soft cap (linear rating, not effective percent)
  // We need to reverse-engineer the linear rating that produces softCapPercent after DR
  // For simplicity, use approximate conversion since DR is complex
  const softCapRating = (softCapPercent / 100) * ratingValue * 1.15; // Adjusted for DR
  const hardCapRating = (hardCapPercent / 100) * ratingValue * 1.5;  // Adjusted for DR

  const ratingToSoftCap = Math.max(0, softCapRating - currentCritRating);

  // Calculate current efficiency by testing a small rating addition
  const testRatingAdd = 100;
  const linearAfterTest = ((currentCritRating + testRatingAdd) / ratingValue) * 100;
  const effectiveAfterTest = applyDiminishingReturns(linearAfterTest);
  const actualGain = effectiveAfterTest - currentCritPercent;
  const expectedGain = (testRatingAdd / ratingValue) * 100;
  const efficiency = expectedGain > 0 ? actualGain / expectedGain : 1.0;

  let recommendation = "";
  if (currentCritPercent < softCapPercent) {
    recommendation = `You're ${ratingToSoftCap.toFixed(0)} rating away from soft cap. Crit is still efficient.`;
  } else if (currentCritPercent < hardCapPercent) {
    recommendation = `You're past soft cap. Crit has ${(efficiency * 100).toFixed(0)}% efficiency. Consider other stats.`;
  } else {
    recommendation = `You've hit hard cap. Crit gains are minimal. Prioritize other stats.`;
  }

  return {
    currentCritRating,
    currentCritPercent,
    softCap: softCapRating,
    hardCap: hardCapRating,
    ratingToSoftCap,
    efficiency,
    recommendation
  };
}
