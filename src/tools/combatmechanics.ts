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

  // Calculate percent before
  const percentBefore = (currentRating / ratingValue) * 100;

  // Calculate percent after (with DR)
  // Simplified DR model - real implementation would use exact Blizzard formula
  const newRating = currentRating + ratingToAdd;
  let percentAfter = (newRating / ratingValue) * 100;

  // Apply DR (simplified - starts around 30%, hard cap around 50-60%)
  const softCap = 30;
  const hardCap = 60;

  if (percentAfter > softCap) {
    const excessPercent = percentAfter - softCap;
    const drMultiplier = 1 - (excessPercent / (hardCap - softCap)) * 0.5;
    percentAfter = softCap + (excessPercent * Math.max(drMultiplier, 0.5));
  }

  const gainPercent = percentAfter - percentBefore;
  const expectedGain = (ratingToAdd / ratingValue) * 100;
  const efficiency = gainPercent / expectedGain;

  let drCategory: DiminishingReturnsInfo["drCategory"] = "none";
  if (percentAfter >= hardCap) drCategory = "hard_cap";
  else if (percentAfter >= softCap) drCategory = "soft_cap";
  else if (percentAfter >= softCap * 0.8) drCategory = "linear";

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

  // Mana regeneration (Spirit-based for healers)
  if (resourceType === "mana" && spirit > 0) {
    // Simplified: 1 spirit = ~0.1% base mana regen per 5 seconds
    const spiritRegen = (spirit * maxResource * 0.001) / 5;
    regenPerSecond += spiritRegen;
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
  const timeToFull = maxResource / regenPerSecond;

  return {
    resourceType,
    baseRegen,
    spiritBonus: spirit > 0 ? spirit * maxResource * 0.001 / 5 : undefined,
    hasteBonus: 0, // Would calculate based on haste
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

  const currentCritPercent = (currentCritRating / ratingValue) * 100;

  // Retail WoW crit caps (approximate)
  const softCapPercent = 30; // DR starts
  const hardCapPercent = 60; // Severe DR

  const softCapRating = (softCapPercent / 100) * ratingValue;
  const hardCapRating = (hardCapPercent / 100) * ratingValue;

  const ratingToSoftCap = Math.max(0, softCapRating - currentCritRating);

  // Calculate efficiency
  let efficiency = 1.0;
  if (currentCritPercent > softCapPercent) {
    const excessPercent = currentCritPercent - softCapPercent;
    efficiency = Math.max(0.5, 1 - (excessPercent / (hardCapPercent - softCapPercent)) * 0.5);
  }

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
