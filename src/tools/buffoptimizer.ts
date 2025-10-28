/**
 * Buff/Consumable Optimizer MCP
 *
 * Provides buff recommendations, consumable selection, group buff coverage,
 * and cost-effective buff/consumable choices for optimal bot performance.
 *
 * @module buffoptimizer
 */

import { queryWorld } from "../database/connection";
import { StatWeights } from "./gearoptimizer";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface BuffInfo {
  spellId: number;
  name: string;
  type: "class_buff" | "consumable" | "temporary" | "profession" | "world_buff";
  duration: number; // seconds, -1 for permanent
  stats: { [stat: string]: number };
  source: string; // Class name, item ID, or source description
  stackGroup?: number; // Buffs in same group don't stack
  cost?: number; // Gold cost if from consumable
}

export interface ConsumableInfo {
  itemId: number;
  name: string;
  type: "food" | "flask" | "elixir" | "potion" | "scroll" | "rune";
  duration: number;
  stats: { [stat: string]: number };
  cost: number;
  requiredLevel: number;
  isPersistent: boolean; // Survives death
  stacksWith: number[]; // Item IDs it stacks with
}

export interface BuffRecommendation {
  role: "tank" | "healer" | "melee_dps" | "ranged_dps";
  classId: number;
  recommendations: Array<{
    buff: BuffInfo | ConsumableInfo;
    priority: "critical" | "high" | "medium" | "low";
    reason: string;
    value: number; // Estimated stat value
  }>;
  totalCost: number;
  expectedPerformanceGain: number; // Percentage
}

export interface GroupBuffCoverage {
  missingBuffs: BuffInfo[];
  redundantBuffs: BuffInfo[];
  suggestions: Array<{
    playerId?: number;
    className: string;
    buffToApply: number;
    reason: string;
  }>;
}

export interface ConsumableOptimization {
  budget: number; // Gold available
  duration: number; // Expected content duration (minutes)
  recommendations: Array<{
    consumable: ConsumableInfo;
    quantity: number;
    totalCost: number;
    costPerHour: number;
    statValue: number;
  }>;
  totalCost: number;
  remainingBudget: number;
}

// ============================================================================
// BUFF DATABASE
// ============================================================================

const CLASS_BUFFS: BuffInfo[] = [
  {
    spellId: 1126,
    name: "Mark of the Wild",
    type: "class_buff",
    duration: 3600,
    stats: { versatility: 3, armor: 1 },
    source: "Druid",
    stackGroup: 1
  },
  {
    spellId: 21562,
    name: "Power Word: Fortitude",
    type: "class_buff",
    duration: 3600,
    stats: { stamina: 10 },
    source: "Priest",
    stackGroup: 2
  },
  {
    spellId: 1459,
    name: "Arcane Intellect",
    type: "class_buff",
    duration: 3600,
    stats: { intellect: 10 },
    source: "Mage",
    stackGroup: 3
  },
  // ... more buffs
];

const CONSUMABLES: ConsumableInfo[] = [
  {
    itemId: 172041, // Tenebrous Crown Roast Aspic (example)
    name: "Feast of Gluttonous Hedonism",
    type: "food",
    duration: 3600,
    stats: { primaryStat: 20 },
    cost: 500, // gold in copper
    requiredLevel: 60,
    isPersistent: false,
    stacksWith: [/* flask IDs */]
  },
  {
    itemId: 171276, // Spectral Flask of Power
    name: "Spectral Flask of Power",
    type: "flask",
    duration: 3600,
    stats: { primaryStat: 70 },
    cost: 1500,
    requiredLevel: 60,
    isPersistent: true,
    stacksWith: [/* food IDs */]
  },
  // ... more consumables
];

// ============================================================================
// RECOMMENDATION FUNCTIONS
// ============================================================================

/**
 * Get buff recommendations for a role/class
 */
export function getBuffRecommendations(params: {
  role: BuffRecommendation["role"];
  classId: number;
  statWeights: StatWeights;
  budget?: number;
  contentType?: "raid" | "dungeon" | "solo" | "pvp";
}): BuffRecommendation {
  const { role, classId, statWeights, budget, contentType = "raid" } = params;

  const recommendations: BuffRecommendation["recommendations"] = [];

  // Evaluate class buffs
  for (const buff of CLASS_BUFFS) {
    const value = calculateBuffValue(buff, statWeights);

    if (value > 0) {
      let priority: "critical" | "high" | "medium" | "low" = "medium";

      if (value > 100) priority = "critical";
      else if (value > 50) priority = "high";
      else if (value > 20) priority = "medium";
      else priority = "low";

      recommendations.push({
        buff,
        priority,
        reason: `Provides ${formatStats(buff.stats)} for ${buff.duration / 60} minutes`,
        value
      });
    }
  }

  // Evaluate consumables if budget provided
  if (budget !== undefined) {
    for (const consumable of CONSUMABLES) {
      if (consumable.cost > budget) continue;

      const value = calculateBuffValue(consumable as any, statWeights);

      if (value > 0) {
        recommendations.push({
          buff: consumable,
          priority: consumable.type === "flask" ? "high" : "medium",
          reason: `${consumable.type} providing ${formatStats(consumable.stats)}`,
          value
        });
      }
    }
  }

  // Sort by priority and value
  recommendations.sort((a, b) => {
    const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
    const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
    return priorityDiff !== 0 ? priorityDiff : b.value - a.value;
  });

  const totalCost = recommendations
    .filter(r => 'cost' in r.buff)
    .reduce((sum, r) => sum + ((r.buff as ConsumableInfo).cost || 0), 0);

  const expectedPerformanceGain = recommendations
    .slice(0, 5) // Top 5 buffs
    .reduce((sum, r) => sum + r.value / 100, 0);

  return {
    role,
    classId,
    recommendations: recommendations.slice(0, 10), // Top 10
    totalCost,
    expectedPerformanceGain
  };
}

/**
 * Analyze group buff coverage
 */
export function analyzeGroupBuffCoverage(groupComposition: Array<{
  playerId: number;
  classId: number;
  buffsActive: number[];
}>): GroupBuffCoverage {
  const allActiveBuffs = new Set<number>();
  groupComposition.forEach(player => {
    player.buffsActive.forEach(buffId => allActiveBuffs.add(buffId));
  });

  const missingBuffs: BuffInfo[] = [];
  const redundantBuffs: BuffInfo[] = [];

  // Check for missing important buffs
  for (const buff of CLASS_BUFFS) {
    if (!allActiveBuffs.has(buff.spellId)) {
      missingBuffs.push(buff);
    }
  }

  // Check for redundant buffs (same stack group)
  const stackGroups = new Map<number, number>();
  for (const player of groupComposition) {
    for (const buffId of player.buffsActive) {
      const buff = CLASS_BUFFS.find(b => b.spellId === buffId);
      if (buff?.stackGroup) {
        const count = stackGroups.get(buff.stackGroup) || 0;
        stackGroups.set(buff.stackGroup, count + 1);

        if (count > 0) {
          redundantBuffs.push(buff);
        }
      }
    }
  }

  // Generate suggestions
  const suggestions: GroupBuffCoverage["suggestions"] = [];

  for (const missingBuff of missingBuffs) {
    // Find who can provide this buff
    const provider = groupComposition.find(p => canProvideBuff(p.classId, missingBuff.spellId));

    if (provider) {
      suggestions.push({
        playerId: provider.playerId,
        className: getClassName(provider.classId),
        buffToApply: missingBuff.spellId,
        reason: `Apply ${missingBuff.name} to fill missing buff`
      });
    }
  }

  return {
    missingBuffs,
    redundantBuffs,
    suggestions
  };
}

/**
 * Optimize consumable spending for budget
 */
export function optimizeConsumables(params: {
  budget: number;
  duration: number;
  role: BuffRecommendation["role"];
  statWeights: StatWeights;
  contentType: "raid" | "dungeon" | "solo";
}): ConsumableOptimization {
  const { budget, duration, role, statWeights, contentType } = params;

  const recommendations: ConsumableOptimization["recommendations"] = [];
  let remainingBudget = budget;

  // Filter consumables by content type
  const relevantConsumables = CONSUMABLES.filter(c => {
    if (contentType === "solo" && c.type === "flask") return false; // Too expensive for solo
    if (contentType === "dungeon" && c.cost > budget * 0.3) return false; // Don't overspend on dungeons
    return true;
  });

  // Calculate value per gold for each consumable
  const consumableValues = relevantConsumables.map(c => ({
    consumable: c,
    value: calculateBuffValue(c as any, statWeights),
    valuePerGold: calculateBuffValue(c as any, statWeights) / c.cost
  }));

  // Sort by value per gold
  consumableValues.sort((a, b) => b.valuePerGold - a.valuePerGold);

  // Select consumables within budget
  for (const { consumable, value, valuePerGold } of consumableValues) {
    if (remainingBudget < consumable.cost) continue;

    const quantity = Math.ceil(duration / (consumable.duration / 60));
    const totalCost = consumable.cost * quantity;

    if (totalCost <= remainingBudget) {
      recommendations.push({
        consumable,
        quantity,
        totalCost,
        costPerHour: totalCost / (duration / 60),
        statValue: value
      });

      remainingBudget -= totalCost;
    }
  }

  return {
    budget,
    duration,
    recommendations,
    totalCost: budget - remainingBudget,
    remainingBudget
  };
}

/**
 * Recommend food based on stat weights
 */
export function recommendFood(
  statWeights: StatWeights,
  budget: number
): ConsumableInfo[] {
  const foodItems = CONSUMABLES.filter(c => c.type === "food" && c.cost <= budget);

  return foodItems
    .map(food => ({
      food,
      value: calculateBuffValue(food as any, statWeights)
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5)
    .map(({ food }) => food);
}

/**
 * Recommend flask/elixir for role
 */
export function recommendFlaskElixir(
  role: BuffRecommendation["role"],
  budget: number
): ConsumableInfo[] {
  const flaskElixirs = CONSUMABLES.filter(c =>
    (c.type === "flask" || c.type === "elixir") && c.cost <= budget
  );

  // Role-specific filtering
  const filtered = flaskElixirs.filter(c => {
    const stats = c.stats;

    if (role === "tank") return stats.stamina || stats.armor;
    if (role === "healer") return stats.intellect || stats.spirit;
    if (role === "melee_dps") return stats.strength || stats.agility;
    if (role === "ranged_dps") return stats.intellect || stats.agility;

    return true;
  });

  return filtered.slice(0, 3);
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function calculateBuffValue(buff: BuffInfo | ConsumableInfo, statWeights: StatWeights): number {
  let totalValue = 0;

  const stats = buff.stats;

  for (const [stat, amount] of Object.entries(stats)) {
    const weight = (statWeights as any)[stat] || 1;
    totalValue += amount * weight;
  }

  return totalValue;
}

function formatStats(stats: { [stat: string]: number }): string {
  return Object.entries(stats)
    .map(([stat, value]) => `${value} ${stat}`)
    .join(", ");
}

function canProvideBuff(classId: number, spellId: number): boolean {
  const buff = CLASS_BUFFS.find(b => b.spellId === spellId);
  if (!buff) return false;

  const className = getClassName(classId);
  return buff.source === className;
}

function getClassName(classId: number): string {
  const classes: { [key: number]: string } = {
    1: "Warrior", 2: "Paladin", 3: "Hunter", 4: "Rogue",
    5: "Priest", 6: "Death Knight", 7: "Shaman", 8: "Mage",
    9: "Warlock", 10: "Monk", 11: "Druid", 12: "Demon Hunter",
    13: "Evoker"
  };
  return classes[classId] || "Unknown";
}
