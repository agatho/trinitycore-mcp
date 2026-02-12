/**
 * Spell Calculator MCP Tool
 *
 * Provides spell damage/healing calculations, coefficient analysis,
 * stat scaling, and power cost computations for TrinityCore WoW 12.0.
 * Helps bot AI make intelligent casting decisions.
 *
 * @module spellcalculator
 */

import { getSpellInfo, SpellInfo, SpellEffect } from "./spell";
import { getCombatRating, getBaseMana } from "./gametable";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Spell damage/healing calculation result
 */
export interface SpellCalculationResult {
  spellId: number;
  spellName: string;
  effectIndex: number;

  // Base values
  baseMin: number;
  baseMax: number;
  baseAverage: number;

  // With spell power
  withSpellPower: {
    min: number;
    max: number;
    average: number;
  };

  // Coefficients
  coefficient: number;
  variance: number;

  // Critical strike
  critChance: number; // percentage
  critDamage: number; // average damage on crit
  expectedDamage: number; // (normal * (1 - crit)) + (crit * critChance)

  // Power cost
  powerCost?: {
    power: string; // Mana, Rage, Energy, etc.
    amount: number;
    damagePerPower: number;
  };

  // Scaling
  castTime: number; // milliseconds
  damagePerSecond: number;
  damagePerCastTime: number;

  // Multi-target
  maxTargets?: number;
  totalAoeDamage?: number;
}

/**
 * Stat weights for damage calculations
 */
export interface StatWeights {
  intellect: number;
  spellPower: number;
  critRating: number;
  hasteRating: number;
  masteryRating: number;
  versatility: number;
}

/**
 * Player stats for calculations
 */
export interface PlayerStats {
  level: number;
  intellect: number;
  spellPower: number;
  critRating: number;
  hasteRating: number;
  masteryRating: number;
  versatility: number;
  className?: string;
}

/**
 * Spell comparison result
 */
export interface SpellComparison {
  spells: Array<{
    spellId: number;
    name: string;
    dps: number;
    damagePerMana: number;
    efficiency: number; // combined score
    castTime: number;
    manaCost: number;
  }>;
  recommendation: {
    bestDps: number;
    bestEfficiency: number;
    bestDpm: number; // damage per mana
  };
}

// ============================================================================
// CALCULATION FUNCTIONS
// ============================================================================

/**
 * Calculate spell damage/healing with given stats
 */
export async function calculateSpellDamage(
  spellId: number,
  effectIndex: number,
  playerStats: PlayerStats,
  targetCount: number = 1
): Promise<SpellCalculationResult> {
  // Get spell info
  const spellInfo = await getSpellInfo(spellId);

  if (!spellInfo.effects || effectIndex >= spellInfo.effects.length) {
    throw new Error(`Invalid effect index ${effectIndex} for spell ${spellId}`);
  }

  const effect = spellInfo.effects[effectIndex];

  // Base damage calculation
  const baseMin = effect.basePoints || 0;
  const baseMax = effect.basePoints; // Note: dieSides not in current schema
  const baseAverage = (baseMin + baseMax) / 2;

  // Variance (randomness) - not in current schema, using default
  const variance = 0;

  // Coefficient (spell power scaling) - not in current schema, using default
  // In TrinityCore, coefficient is stored per effect but not in our current schema
  const coefficient = 0.8; // Default coefficient for calculations

  // Calculate with spell power
  const spellPowerBonus = playerStats.spellPower * coefficient;
  const withSpellPowerMin = baseMin + spellPowerBonus;
  const withSpellPowerMax = baseMax + spellPowerBonus;
  const withSpellPowerAvg = baseAverage + spellPowerBonus;

  // Get crit chance from rating
  const critRating = playerStats.critRating || 0;
  const critFromRating = await getCombatRating(playerStats.level, "Crit - Spell");
  const critChance = (critFromRating && critFromRating > 0) ? (critRating / critFromRating) * 100 : 0;

  // Crit damage (typically 2x in modern WoW)
  const critMultiplier = 2.0;
  const critDamage = withSpellPowerAvg * critMultiplier;

  // Expected damage with crit
  const expectedDamage =
    (withSpellPowerAvg * (1 - critChance / 100)) +
    (critDamage * (critChance / 100));

  // Cast time
  const castTime = spellInfo.castTime || 0;

  // DPS calculations
  const damagePerSecond = castTime > 0 ? (expectedDamage / (castTime / 1000)) : 0;
  const damagePerCastTime = expectedDamage;

  // Power cost
  let powerCost: SpellCalculationResult["powerCost"];

  if (spellInfo.powerCost && spellInfo.powerCost > 0) {
    const powerType = spellInfo.powerType; // Already a string from getSpellInfo()
    const damagePerPower = spellInfo.powerCost > 0
      ? expectedDamage / spellInfo.powerCost
      : 0;

    powerCost = {
      power: powerType,
      amount: spellInfo.powerCost,
      damagePerPower
    };
  }

  // Multi-target calculations - not in current schema, using defaults
  const maxTargets = 1; // Default to single target
  const totalAoeDamage = targetCount > 1
    ? expectedDamage * Math.min(targetCount, maxTargets)
    : undefined;

  return {
    spellId,
    spellName: spellInfo.name,
    effectIndex,
    baseMin,
    baseMax,
    baseAverage,
    withSpellPower: {
      min: withSpellPowerMin,
      max: withSpellPowerMax,
      average: withSpellPowerAvg
    },
    coefficient,
    variance,
    critChance,
    critDamage,
    expectedDamage,
    powerCost,
    castTime,
    damagePerSecond,
    damagePerCastTime,
    maxTargets: maxTargets > 1 ? maxTargets : undefined,
    totalAoeDamage
  };
}

/**
 * Calculate healing with given stats (similar to damage but for healing effects)
 */
export async function calculateSpellHealing(
  spellId: number,
  effectIndex: number,
  playerStats: PlayerStats
): Promise<SpellCalculationResult> {
  // Healing calculations are similar to damage
  // Main differences:
  // - Can't crit as often (different crit chance)
  // - Healing coefficient may differ
  // - Versatility affects healing

  const result = await calculateSpellDamage(spellId, effectIndex, playerStats);

  // Adjust for healing-specific mechanics
  // In modern WoW, healing typically has similar coefficients but different base values

  return {
    ...result,
    // Could add healing-specific fields like overhealing, etc.
  };
}

/**
 * Compare multiple spells for optimal damage/efficiency
 */
export async function compareSpells(
  spellIds: number[],
  playerStats: PlayerStats
): Promise<SpellComparison> {
  const spellResults = await Promise.all(
    spellIds.map(async (spellId) => {
      try {
        // Calculate first damage effect (index 0)
        const calc = await calculateSpellDamage(spellId, 0, playerStats);

        const efficiency = calc.powerCost
          ? calc.powerCost.damagePerPower
          : calc.damagePerSecond;

        return {
          spellId,
          name: calc.spellName,
          dps: calc.damagePerSecond,
          damagePerMana: calc.powerCost?.damagePerPower || 0,
          efficiency,
          castTime: calc.castTime,
          manaCost: calc.powerCost?.amount || 0
        };
      } catch (error) {
        // Skip spells with errors
        return null;
      }
    })
  );

  const validSpells = spellResults.filter(s => s !== null) as NonNullable<typeof spellResults[0]>[];

  if (validSpells.length === 0) {
    throw new Error("No valid spells to compare");
  }

  // Find best in each category
  const bestDps = validSpells.reduce((max, spell) =>
    spell.dps > max.dps ? spell : max
  );

  const bestDpm = validSpells.reduce((max, spell) =>
    spell.damagePerMana > max.damagePerMana ? spell : max
  );

  const bestEfficiency = validSpells.reduce((max, spell) =>
    spell.efficiency > max.efficiency ? spell : max
  );

  return {
    spells: validSpells.sort((a, b) => b.dps - a.dps),
    recommendation: {
      bestDps: bestDps.spellId,
      bestEfficiency: bestEfficiency.spellId,
      bestDpm: bestDpm.spellId
    }
  };
}

/**
 * Calculate stat weights for a spell (how much value each stat provides)
 */
export async function calculateStatWeights(
  spellId: number,
  effectIndex: number,
  baseStats: PlayerStats,
  statIncrement: number = 100
): Promise<StatWeights> {
  // Calculate baseline damage
  const baseline = await calculateSpellDamage(spellId, effectIndex, baseStats);

  // Test each stat increment
  const withIntellect = await calculateSpellDamage(spellId, effectIndex, {
    ...baseStats,
    intellect: baseStats.intellect + statIncrement
  });

  const withSpellPower = await calculateSpellDamage(spellId, effectIndex, {
    ...baseStats,
    spellPower: baseStats.spellPower + statIncrement
  });

  const withCrit = await calculateSpellDamage(spellId, effectIndex, {
    ...baseStats,
    critRating: baseStats.critRating + statIncrement
  });

  const withHaste = await calculateSpellDamage(spellId, effectIndex, {
    ...baseStats,
    hasteRating: baseStats.hasteRating + statIncrement
  });

  const withMastery = await calculateSpellDamage(spellId, effectIndex, {
    ...baseStats,
    masteryRating: baseStats.masteryRating + statIncrement
  });

  const withVersatility = await calculateSpellDamage(spellId, effectIndex, {
    ...baseStats,
    versatility: baseStats.versatility + statIncrement
  });

  // Calculate gains per stat point
  return {
    intellect: (withIntellect.expectedDamage - baseline.expectedDamage) / statIncrement,
    spellPower: (withSpellPower.expectedDamage - baseline.expectedDamage) / statIncrement,
    critRating: (withCrit.expectedDamage - baseline.expectedDamage) / statIncrement,
    hasteRating: (withHaste.expectedDamage - baseline.expectedDamage) / statIncrement,
    masteryRating: (withMastery.expectedDamage - baseline.expectedDamage) / statIncrement,
    versatility: (withVersatility.expectedDamage - baseline.expectedDamage) / statIncrement
  };
}

/**
 * Calculate rotation DPS (multiple spells in sequence)
 */
export async function calculateRotationDps(
  rotation: Array<{ spellId: number; effectIndex?: number; count: number }>,
  playerStats: PlayerStats
): Promise<{
  totalDamage: number;
  totalTime: number;
  dps: number;
  manaUsed: number;
  manaEfficiency: number;
  spellBreakdown: Array<{
    spellId: number;
    name: string;
    count: number;
    totalDamage: number;
    percentOfTotal: number;
  }>;
}> {
  let totalDamage = 0;
  let totalTime = 0;
  let manaUsed = 0;
  const spellBreakdown: Array<any> = [];

  for (const { spellId, effectIndex = 0, count } of rotation) {
    const calc = await calculateSpellDamage(spellId, effectIndex, playerStats);

    const damage = calc.expectedDamage * count;
    const time = (calc.castTime / 1000) * count;
    const mana = (calc.powerCost?.amount || 0) * count;

    totalDamage += damage;
    totalTime += time;
    manaUsed += mana;

    spellBreakdown.push({
      spellId,
      name: calc.spellName,
      count,
      totalDamage: damage,
      percentOfTotal: 0 // Will calculate after
    });
  }

  // Calculate percentages
  for (const spell of spellBreakdown) {
    spell.percentOfTotal = (spell.totalDamage / totalDamage) * 100;
  }

  const dps = totalTime > 0 ? totalDamage / totalTime : 0;
  const manaEfficiency = manaUsed > 0 ? totalDamage / manaUsed : 0;

  return {
    totalDamage,
    totalTime,
    dps,
    manaUsed,
    manaEfficiency,
    spellBreakdown
  };
}

/**
 * Estimate spell scaling by level
 */
export async function estimateSpellScaling(
  spellId: number,
  effectIndex: number,
  minLevel: number,
  maxLevel: number,
  baseStats: Partial<PlayerStats>
): Promise<Array<{
  level: number;
  damage: number;
  dps: number;
  coefficient: number;
}>> {
  const results: Array<any> = [];

  for (let level = minLevel; level <= maxLevel; level += 5) {
    const stats: PlayerStats = {
      level,
      intellect: baseStats.intellect || level * 10,
      spellPower: baseStats.spellPower || level * 5,
      critRating: baseStats.critRating || 0,
      hasteRating: baseStats.hasteRating || 0,
      masteryRating: baseStats.masteryRating || 0,
      versatility: baseStats.versatility || 0
    };

    try {
      const calc = await calculateSpellDamage(spellId, effectIndex, stats);

      results.push({
        level,
        damage: calc.expectedDamage,
        dps: calc.damagePerSecond,
        coefficient: calc.coefficient
      });
    } catch (error) {
      // Skip levels with errors
      continue;
    }
  }

  return results;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Calculate optimal spell for situation
 */
export async function getOptimalSpell(
  availableSpells: number[],
  playerStats: PlayerStats,
  situation: {
    targetCount?: number;
    manaPercent?: number;
    timeToKill?: number; // seconds
    needsBurst?: boolean;
  }
): Promise<{
  spellId: number;
  reason: string;
  estimatedDamage: number;
}> {
  const comparisons = await Promise.all(
    availableSpells.map(async (spellId) => {
      try {
        const calc = await calculateSpellDamage(
          spellId,
          0,
          playerStats,
          situation.targetCount || 1
        );

        // Score based on situation
        let score = 0;
        let reason = "";

        if (situation.needsBurst) {
          // Prioritize high burst damage
          score = calc.damagePerCastTime;
          reason = "Highest burst damage";
        } else if (situation.manaPercent && situation.manaPercent < 30) {
          // Prioritize mana efficiency
          score = calc.powerCost?.damagePerPower || 0;
          reason = "Best mana efficiency (low mana)";
        } else if (situation.targetCount && situation.targetCount > 2) {
          // Prioritize AoE
          score = calc.totalAoeDamage || calc.expectedDamage;
          reason = "Best AoE damage";
        } else {
          // Default: sustained DPS
          score = calc.damagePerSecond;
          reason = "Highest sustained DPS";
        }

        return {
          spellId,
          score,
          reason,
          estimatedDamage: calc.expectedDamage
        };
      } catch (error) {
        return null;
      }
    })
  );

  const validComparisons = comparisons.filter(c => c !== null) as NonNullable<typeof comparisons[0]>[];

  if (validComparisons.length === 0) {
    throw new Error("No valid spells for situation");
  }

  const best = validComparisons.reduce((max, spell) =>
    spell.score > max.score ? spell : max
  );

  return {
    spellId: best.spellId,
    reason: best.reason,
    estimatedDamage: best.estimatedDamage
  };
}
