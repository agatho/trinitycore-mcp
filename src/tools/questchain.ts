/**
 * Quest Chain MCP Tool
 *
 * Comprehensive quest system analysis: chains, prerequisites, flow analysis,
 * reward optimization, and quest hub identification for bot AI decisions.
 *
 * @module questchain
 */

import { queryWorld } from "../database/connection";
import { getQuestInfo, QuestInfo } from "./quest";
import {
  getStatPriority,
  getDefaultStatWeights as getDefaultStatPrioritiesFromDB,
  ContentType as StatPriorityContentType,
  StatType,
  type StatPriority
} from "../data/stat-priorities.js";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface QuestChain {
  chainId: string;
  quests: QuestChainNode[];
  startQuest: number;
  endQuest: number;
  totalQuests: number;
  minLevel: number;
  maxLevel: number;
  estimatedTime: number; // minutes
  storyline?: string;
}

export interface QuestChainNode {
  questId: number;
  name: string;
  level: number;
  previousQuest: number | null;
  nextQuest: number | null;
  breadcrumbQuest: number | null;
  exclusiveGroup: number;
  depth: number; // Position in chain (0 = start)
}

export interface QuestPrerequisites {
  questId: number;
  name: string;

  // Level requirements
  minLevel: number;
  maxLevel: number;
  questLevel: number;

  // Quest requirements
  previousQuestRequired: number | null;
  previousQuestName?: string;
  breadcrumbFrom: number | null;

  // Class/Race requirements
  requiredClasses: number; // Bitmask
  requiredRaces: number; // Bitmask
  allowableClasses: number;
  allowableRaces: number;

  // Reputation requirements
  requiredFaction: number;
  requiredFactionRep: number;

  // Skill requirements
  requiredSkill: number;
  requiredSkillValue: number;

  // Item requirements
  sourceItemId: number;

  // Exclusive group
  exclusiveGroup: number;
  exclusiveGroupQuests?: number[];

  // Validation
  canAccept: boolean;
  blockingReasons: string[];
}

export interface QuestReward {
  questId: number;
  name: string;

  // Experience and money
  rewardXP: number;
  rewardMoney: number;
  rewardXPDifficulty: number;
  rewardMoneyDifficulty: number;

  // Choice rewards (pick one)
  choiceRewards: Array<{
    itemId: number;
    quantity: number;
    itemLevel: number;
    estimatedValue: number;
  }>;

  // Guaranteed rewards
  rewards: Array<{
    itemId: number;
    quantity: number;
  }>;

  // Reputation
  reputationRewards: Array<{
    factionId: number;
    reputationChange: number;
  }>;

  // Currency
  currencyRewards: Array<{
    currencyId: number;
    amount: number;
  }>;

  // Bonus rewards
  bonusRewards?: any[];

  // Optimization
  bestChoiceForClass?: {
    classId: number;
    itemId: number;
    reason: string;
  };
}

export interface QuestHub {
  mapId: number;
  zoneId: number;
  zoneName: string;
  centerX: number;
  centerY: number;
  questCount: number;
  quests: Array<{
    questId: number;
    name: string;
    level: number;
    questGiverId: number;
    questGiverName: string;
  }>;
  levelRange: { min: number; max: number };
  efficiency: number; // Quests per square unit
}

export interface QuestObjective {
  questId: number;
  objectiveIndex: number;
  type: string; // "kill", "collect", "interact", "explore"
  description: string;
  requiredAmount: number;

  // For kill objectives
  creatureId?: number;
  creatureName?: string;
  spawnLocations?: Array<{ map: number; x: number; y: number; z: number }>;

  // For collection objectives
  itemId?: number;
  itemName?: string;
  dropChance?: number;

  // For interaction objectives
  gameObjectId?: number;
  gameObjectName?: string;

  // Difficulty estimation
  estimatedTime: number; // minutes
  difficultyRating: "trivial" | "easy" | "medium" | "hard" | "extreme";
}

export interface QuestFlowAnalysis {
  zoneId: number;
  zoneName: string;
  optimalPath: number[]; // Ordered quest IDs
  parallelGroups: number[][]; // Quests that can be done simultaneously
  bottlenecks: Array<{
    questId: number;
    reason: string;
  }>;
  estimatedCompletionTime: number; // minutes
  xpPerHour: number;
  goldPerHour: number;
}

// ============================================================================
// QUERY FUNCTIONS
// ============================================================================

/**
 * Get complete quest prerequisites and requirements
 */
export async function getQuestPrerequisites(questId: number): Promise<QuestPrerequisites> {
  const query = `
    SELECT
      ID as questId, QuestTitle as name, MinLevel as minLevel, MaxLevel as maxLevel,
      QuestLevel as questLevel, PrevQuestID as previousQuestRequired,
      BreadcrumbForQuestId as breadcrumbFrom, RequiredClasses as requiredClasses,
      RequiredRaces as requiredRaces, AllowableClasses as allowableClasses,
      AllowableRaces as allowableRaces, RequiredFactionId1 as requiredFaction,
      RequiredFactionValue1 as requiredFactionRep, RequiredSkillId as requiredSkill,
      RequiredSkillPoints as requiredSkillValue, SourceItemId as sourceItemId,
      ExclusiveGroup as exclusiveGroup
    FROM quest_template
    WHERE ID = ?
  `;

  const results = await queryWorld(query, [questId]);

  if (!results || results.length === 0) {
    throw new Error(`Quest ${questId} not found`);
  }

  const quest = results[0];

  // Get previous quest name if exists
  let previousQuestName: string | undefined;
  if (quest.previousQuestRequired && quest.previousQuestRequired !== 0) {
    const prevQuest = await queryWorld(
      "SELECT QuestTitle as name FROM quest_template WHERE ID = ?",
      [quest.previousQuestRequired]
    );
    previousQuestName = prevQuest[0]?.name;
  }

  // Get exclusive group quests
  let exclusiveGroupQuests: number[] = [];
  if (quest.exclusiveGroup !== 0) {
    const groupQuests = await queryWorld(
      "SELECT ID FROM quest_template WHERE ExclusiveGroup = ? AND ID != ?",
      [quest.exclusiveGroup, questId]
    );
    exclusiveGroupQuests = groupQuests.map((q: any) => q.ID);
  }

  // Validation
  const blockingReasons: string[] = [];
  let canAccept = true;

  // Note: This is a simplified validation - actual bot would check player state
  if (quest.previousQuestRequired && quest.previousQuestRequired !== 0) {
    blockingReasons.push(`Requires completion of quest ${quest.previousQuestRequired}`);
    canAccept = false;
  }

  return {
    ...quest,
    previousQuestName,
    exclusiveGroupQuests,
    canAccept,
    blockingReasons
  };
}

/**
 * Trace a quest chain from start to end
 */
export async function traceQuestChain(startQuestId: number): Promise<QuestChain> {
  const visited = new Set<number>();
  const nodes: QuestChainNode[] = [];

  let currentQuestId: number | null = startQuestId;
  let depth = 0;

  while (currentQuestId && !visited.has(currentQuestId)) {
    visited.add(currentQuestId);

    const query = `
      SELECT
        ID as questId, QuestTitle as name, QuestLevel as level,
        PrevQuestID as previousQuest, NextQuestID as nextQuest,
        BreadcrumbForQuestId as breadcrumbQuest, ExclusiveGroup as exclusiveGroup
      FROM quest_template
      WHERE ID = ?
    `;

    const results = await queryWorld(query, [currentQuestId]);

    if (!results || results.length === 0) break;

    const quest = results[0];
    nodes.push({
      ...quest,
      depth
    });

    currentQuestId = quest.nextQuest && quest.nextQuest !== 0 ? quest.nextQuest : null;
    depth++;
  }

  if (nodes.length === 0) {
    throw new Error(`Quest chain starting at ${startQuestId} not found`);
  }

  const levels = nodes.map(n => n.level);
  const minLevel = Math.min(...levels);
  const maxLevel = Math.max(...levels);
  const estimatedTime = nodes.length * 10; // Rough estimate: 10 min per quest

  return {
    chainId: `chain_${startQuestId}`,
    quests: nodes,
    startQuest: nodes[0].questId,
    endQuest: nodes[nodes.length - 1].questId,
    totalQuests: nodes.length,
    minLevel,
    maxLevel,
    estimatedTime
  };
}

/**
 * Find all quest chains in a zone
 */
export async function findQuestChainsInZone(zoneId: number): Promise<QuestChain[]> {
  // Find all quests in zone that are chain starters (no previous quest)
  const query = `
    SELECT DISTINCT qt.ID
    FROM quest_template qt
    INNER JOIN creature_queststarter cqs ON qt.ID = cqs.quest
    INNER JOIN creature c ON cqs.id = c.id
    WHERE c.zoneId = ?
      AND (qt.PrevQuestID = 0 OR qt.PrevQuestID IS NULL)
      AND qt.NextQuestID IS NOT NULL
      AND qt.NextQuestID != 0
    LIMIT 50
  `;

  const starters = await queryWorld(query, [zoneId]);

  const chains: QuestChain[] = [];

  for (const starter of starters) {
    try {
      const chain = await traceQuestChain(starter.ID);
      if (chain.totalQuests > 1) { // Only include actual chains (2+ quests)
        chains.push(chain);
      }
    } catch (error) {
      // Skip invalid chains
      continue;
    }
  }

  return chains.sort((a, b) => b.totalQuests - a.totalQuests);
}

/**
 * Get quest rewards with optimization suggestions
 */
export async function getQuestRewards(questId: number, classId?: number): Promise<QuestReward> {
  const query = `
    SELECT
      ID as questId, QuestTitle as name,
      RewardXPDifficulty as rewardXPDifficulty, RewardMoney as rewardMoney,
      RewardBonusMoney as rewardMoneyDifficulty
    FROM quest_template
    WHERE ID = ?
  `;

  const results = await queryWorld(query, [questId]);

  if (!results || results.length === 0) {
    throw new Error(`Quest ${questId} not found`);
  }

  const quest = results[0];

  // Get choice rewards
  const choiceQuery = `
    SELECT
      ItemID as itemId, ItemCount as quantity
    FROM quest_template_reward_choice_items
    WHERE QuestID = ?
  `;

  const choiceRewards = await queryWorld(choiceQuery, [questId]);

  // Get guaranteed rewards
  const rewardQuery = `
    SELECT
      ItemID as itemId, ItemCount as quantity
    FROM quest_template_reward
    WHERE QuestID = ?
  `;

  const rewards = await queryWorld(rewardQuery, [questId]);

  // Get reputation rewards
  const repQuery = `
    SELECT
      FactionID as factionId, RewardAmount as reputationChange
    FROM quest_template_reward_faction
    WHERE QuestID = ?
  `;

  const reputationRewards = await queryWorld(repQuery, [questId]);

  // Determine best choice reward for class if class is provided
  let bestChoiceForClass: QuestReward["bestChoiceForClass"];
  if (classId && choiceRewards && choiceRewards.length > 0) {
    bestChoiceForClass = await determineBestQuestReward(choiceRewards, classId);
  }

  // Enrich choice rewards with item details
  const enrichedChoiceRewards = await Promise.all(
    (choiceRewards || []).map(async (r: any) => {
      const itemStats = await getItemStatsForReward(r.itemId);
      return {
        itemId: r.itemId,
        quantity: r.quantity,
        itemLevel: itemStats.itemLevel || 0,
        estimatedValue: itemStats.sellPrice || 0,
      };
    })
  );

  return {
    questId: quest.questId,
    name: quest.name,
    rewardXP: 0, // Would need level calculation
    rewardMoney: quest.rewardMoney || 0,
    rewardXPDifficulty: quest.rewardXPDifficulty || 0,
    rewardMoneyDifficulty: quest.rewardMoneyDifficulty || 0,
    choiceRewards: enrichedChoiceRewards,
    rewards: rewards || [],
    reputationRewards: reputationRewards || [],
    currencyRewards: [],
    bestChoiceForClass,
  };
}

/**
 * Stat weights for each class/role
 * Higher value = more important stat for that class
 */
const CLASS_STAT_PRIORITIES: { [classId: number]: { [stat: string]: number } } = {
  // 1: Warrior
  1: {
    strength: 1.0,
    stamina: 0.8,
    criticalStrike: 0.7,
    haste: 0.6,
    mastery: 0.7,
    versatility: 0.5,
    armor: 0.9,
  },
  // 2: Paladin
  2: {
    strength: 1.0,
    stamina: 0.8,
    intellect: 0.3, // For Holy
    criticalStrike: 0.6,
    haste: 0.7,
    mastery: 0.6,
    versatility: 0.5,
    armor: 0.9,
  },
  // 3: Hunter
  3: {
    agility: 1.0,
    stamina: 0.6,
    criticalStrike: 0.8,
    haste: 0.7,
    mastery: 0.7,
    versatility: 0.5,
  },
  // 4: Rogue
  4: {
    agility: 1.0,
    stamina: 0.6,
    criticalStrike: 0.8,
    haste: 0.7,
    mastery: 0.7,
    versatility: 0.6,
  },
  // 5: Priest
  5: {
    intellect: 1.0,
    stamina: 0.7,
    criticalStrike: 0.6,
    haste: 0.8,
    mastery: 0.6,
    versatility: 0.5,
  },
  // 6: Death Knight
  6: {
    strength: 1.0,
    stamina: 0.8,
    criticalStrike: 0.7,
    haste: 0.7,
    mastery: 0.7,
    versatility: 0.5,
    armor: 0.9,
  },
  // 7: Shaman
  7: {
    intellect: 0.7, // For Ele/Resto
    agility: 0.7, // For Enh
    stamina: 0.7,
    criticalStrike: 0.7,
    haste: 0.7,
    mastery: 0.6,
    versatility: 0.5,
  },
  // 8: Mage
  8: {
    intellect: 1.0,
    stamina: 0.6,
    criticalStrike: 0.8,
    haste: 0.8,
    mastery: 0.7,
    versatility: 0.5,
  },
  // 9: Warlock
  9: {
    intellect: 1.0,
    stamina: 0.6,
    criticalStrike: 0.7,
    haste: 0.8,
    mastery: 0.7,
    versatility: 0.5,
  },
  // 10: Monk
  10: {
    agility: 0.7,
    intellect: 0.3, // For Mistweaver
    stamina: 0.7,
    criticalStrike: 0.7,
    haste: 0.7,
    mastery: 0.6,
    versatility: 0.6,
    armor: 0.5,
  },
  // 11: Druid
  11: {
    agility: 0.6, // For Feral/Guardian
    intellect: 0.6, // For Balance/Resto
    stamina: 0.7,
    criticalStrike: 0.7,
    haste: 0.7,
    mastery: 0.6,
    versatility: 0.5,
    armor: 0.6,
  },
  // 12: Demon Hunter
  12: {
    agility: 1.0,
    stamina: 0.7,
    criticalStrike: 0.8,
    haste: 0.7,
    mastery: 0.6,
    versatility: 0.6,
  },
  // 13: Evoker
  13: {
    intellect: 1.0,
    stamina: 0.7,
    criticalStrike: 0.7,
    haste: 0.7,
    mastery: 0.7,
    versatility: 0.6,
  },
};

/**
 * Get item stats for quest reward analysis
 */
async function getItemStatsForReward(itemId: number): Promise<any> {
  try {
    const query = `
      SELECT
        ItemID as itemId,
        Class as itemClass,
        SubClass as itemSubClass,
        InventoryType as inventoryType,
        ItemLevel as itemLevel,
        RequiredLevel as requiredLevel,
        SellPrice as sellPrice,
        Quality as quality,
        BonusStats as bonusStats
      FROM item_template
      WHERE ItemID = ?
      LIMIT 1
    `;

    const results = await queryWorld(query, [itemId]);

    if (!results || results.length === 0) {
      return { itemId, itemLevel: 0, sellPrice: 0, stats: {} };
    }

    const item = results[0];

    // Parse item stats (simplified - real implementation would parse all stat fields)
    const stats: { [key: string]: number } = {};

    // Get primary stats from item stat fields
    const statQuery = `
      SELECT
        stat_type1, stat_value1,
        stat_type2, stat_value2,
        stat_type3, stat_value3,
        stat_type4, stat_value4,
        stat_type5, stat_value5,
        stat_type6, stat_value6,
        stat_type7, stat_value7,
        stat_type8, stat_value8,
        stat_type9, stat_value9,
        stat_type10, stat_value10,
        armor
      FROM item_template
      WHERE ItemID = ?
    `;

    const statResults = await queryWorld(statQuery, [itemId]);

    if (statResults && statResults.length > 0) {
      const itemStats = statResults[0];

      // Map stat types to stat names
      const statTypeMap: { [key: number]: string } = {
        3: "agility",
        4: "strength",
        5: "intellect",
        7: "stamina",
        32: "criticalStrike",
        36: "haste",
        40: "versatility",
        49: "mastery",
      };

      // Extract all stats
      for (let i = 1; i <= 10; i++) {
        const statType = itemStats[`stat_type${i}`];
        const statValue = itemStats[`stat_value${i}`];

        if (statType && statValue && statTypeMap[statType]) {
          const statName = statTypeMap[statType];
          stats[statName] = (stats[statName] || 0) + statValue;
        }
      }

      // Add armor if present
      if (itemStats.armor) {
        stats.armor = itemStats.armor;
      }
    }

    return {
      ...item,
      stats,
    };
  } catch (error) {
    return { itemId, itemLevel: 0, sellPrice: 0, stats: {} };
  }
}

/**
 * Determine the best quest reward choice for a given class and specialization
 * Enhancement #1 (Phase 7): Now uses comprehensive stat priorities database
 *
 * @param choiceRewards - Array of quest reward items
 * @param classId - Player class ID (1-13)
 * @param specId - Player specialization ID (optional, uses default if not provided)
 * @returns Best reward recommendation with reasoning
 */
async function determineBestQuestReward(
  choiceRewards: any[],
  classId: number,
  specId?: number
): Promise<{ classId: number; itemId: number; reason: string }> {
  // Get stat priority from comprehensive database (leveling content assumed for quest rewards)
  let statPriority: StatPriority | undefined;

  if (specId) {
    // Try to get spec-specific priorities (leveling content)
    statPriority = getStatPriority(classId, specId, StatPriorityContentType.RAID_DPS);
  }

  // Fallback to default priorities for class
  if (!statPriority) {
    statPriority = getDefaultStatPrioritiesFromDB(classId, specId || 0);
  }

  // Fallback to legacy priorities if still no match
  const statPriorities = statPriority
    ? convertStatPriorityToWeights(statPriority)
    : (CLASS_STAT_PRIORITIES[classId] || CLASS_STAT_PRIORITIES[1]);

  let bestItemId = 0;
  let bestScore = 0;
  let bestReason = "";
  const itemScores: Array<{ itemId: number; score: number; reason: string }> = [];

  for (const reward of choiceRewards) {
    const itemDetails = await getItemStatsForReward(reward.itemId);
    const stats = itemDetails.stats || {};

    // Calculate item score based on stat priorities
    let itemScore = 0;
    const statContributions: string[] = [];

    for (const [statName, statValue] of Object.entries(stats)) {
      const statWeight = statPriorities[statName as string] || 0;
      const contribution = (statValue as number) * statWeight;
      itemScore += contribution;

      if (contribution > 0 && (statValue as number) > 0) {
        statContributions.push(`${statValue} ${statName}`);
      }
    }

    // Bonus for higher item level (each ilvl = 0.5 score)
    const ilvlBonus = (itemDetails.itemLevel || 0) * 0.5;
    itemScore += ilvlBonus;

    // Bonus for higher quality
    const qualityBonus = {
      0: 0, // Poor (gray)
      1: 1, // Common (white)
      2: 2, // Uncommon (green)
      3: 5, // Rare (blue)
      4: 10, // Epic (purple)
      5: 20, // Legendary (orange)
      6: 30, // Artifact (artifact)
      7: 40, // Heirloom (heirloom)
    };
    const qualityScore = qualityBonus[itemDetails.quality as keyof typeof qualityBonus] || 0;
    itemScore += qualityScore;

    // Bonus for socket slots (each socket = 5 score)
    const socketBonus = (itemDetails.socketCount || 0) * 5;
    itemScore += socketBonus;

    // Armor type filtering (penalize wrong armor type)
    const armorPenalty = calculateArmorTypePenalty(classId, itemDetails.itemClass, itemDetails.itemSubClass);
    itemScore *= (1 - armorPenalty);

    // Weapon type filtering (penalize wrong weapon type)
    const weaponPenalty = calculateWeaponTypePenalty(classId, itemDetails.itemClass, itemDetails.itemSubClass);
    itemScore *= (1 - weaponPenalty);

    // Build reason string
    const qualityNames = ["Poor", "Common", "Uncommon", "Rare", "Epic", "Legendary", "Artifact", "Heirloom"];
    const qualityName = qualityNames[itemDetails.quality] || "Unknown";

    const topStats = statContributions.slice(0, 3).join(", ");
    const socketInfo = itemDetails.socketCount > 0 ? ` +${itemDetails.socketCount} socket(s)` : "";
    const reason = `${qualityName} item (iLvl ${itemDetails.itemLevel || 0})${socketInfo} with best stats: ${topStats || "no stats"}`;

    itemScores.push({ itemId: reward.itemId, score: itemScore, reason });

    if (itemScore > bestScore) {
      bestScore = itemScore;
      bestItemId = reward.itemId;
      bestReason = reason;
    }
  }

  // If no item scored above 0, default to first reward
  if (bestScore === 0 && choiceRewards.length > 0) {
    bestItemId = choiceRewards[0].itemId;
    bestReason = "No stat-weighted items found, selecting first reward (likely currency or consumable)";
  }

  return {
    classId,
    itemId: bestItemId || 0,
    reason: bestReason || "No suitable rewards available",
  };
}

/**
 * Convert StatPriority from stat-priorities database to legacy weight format
 */
function convertStatPriorityToWeights(statPriority: StatPriority): { [stat: string]: number } {
  const weights: { [stat: string]: number } = {};

  // Map StatPriority weights to legacy stat names
  weights.strength = statPriority.priorityOrder.includes(StatType.STRENGTH) ? 1.0 : 0.0;
  weights.agility = statPriority.priorityOrder.includes(StatType.AGILITY) ? 1.0 : 0.0;
  weights.intellect = statPriority.priorityOrder.includes(StatType.INTELLECT) ? 1.0 : 0.0;
  weights.stamina = 0.6; // Always somewhat valuable

  weights.criticalStrike = statPriority.weights.criticalStrike || 0.0;
  weights.haste = statPriority.weights.haste || 0.0;
  weights.mastery = statPriority.weights.mastery || 0.0;
  weights.versatility = statPriority.weights.versatility || 0.0;
  weights.armor = statPriority.weights.armor || 0.0;

  return weights;
}

/**
 * Calculate armor type penalty for wrong armor class
 * Returns 0.0 (no penalty) to 1.0 (fully penalized)
 */
function calculateArmorTypePenalty(classId: number, itemClass: number, itemSubClass: number): number {
  // Item class 4 = Armor
  if (itemClass !== 4) {
    return 0.0; // Not armor, no penalty
  }

  // Armor subclass: 0=Misc, 1=Cloth, 2=Leather, 3=Mail, 4=Plate
  const classArmorTypes: { [classId: number]: number[] } = {
    1: [4], // Warrior - Plate
    2: [4], // Paladin - Plate
    3: [3], // Hunter - Mail
    4: [2], // Rogue - Leather
    5: [1], // Priest - Cloth
    6: [4], // Death Knight - Plate
    7: [3], // Shaman - Mail
    8: [1], // Mage - Cloth
    9: [1], // Warlock - Cloth
    10: [2], // Monk - Leather
    11: [2], // Druid - Leather
    12: [2], // Demon Hunter - Leather
    13: [3], // Evoker - Mail
  };

  const allowedArmorTypes = classArmorTypes[classId] || [1]; // Default to cloth

  // If armor type matches, no penalty
  if (allowedArmorTypes.includes(itemSubClass)) {
    return 0.0;
  }

  // Wrong armor type: 50% penalty
  return 0.5;
}

/**
 * Calculate weapon type penalty for wrong weapon class
 * Returns 0.0 (no penalty) to 1.0 (fully penalized)
 */
function calculateWeaponTypePenalty(classId: number, itemClass: number, itemSubClass: number): number {
  // Item class 2 = Weapon
  if (itemClass !== 2) {
    return 0.0; // Not a weapon, no penalty
  }

  // Weapon subclass proficiency by class
  // This is simplified - in reality, need to check class_spell for weapon skills
  const classWeaponTypes: { [classId: number]: number[] } = {
    1: [0, 1, 2, 4, 5, 6, 7, 8, 10, 13, 15, 19], // Warrior - All weapons
    2: [0, 1, 2, 4, 5, 6, 7, 8, 10], // Paladin - Most weapons
    3: [0, 1, 2, 3, 13, 15, 18], // Hunter - Ranged + melee
    4: [0, 1, 4, 7, 13, 15], // Rogue - One-handed + daggers
    5: [7, 10, 15, 19], // Priest - Staves, wands, maces
    6: [0, 1, 4, 5, 6, 7, 8], // Death Knight - Most melee
    7: [0, 1, 4, 5, 10, 13], // Shaman - Maces, axes, fist weapons
    8: [7, 10, 15, 19], // Mage - Staves, swords, wands
    9: [7, 10, 15, 19], // Warlock - Staves, swords, wands
    10: [0, 4, 7, 13], // Monk - Fist weapons, staves, polearms
    11: [0, 4, 7, 10, 13], // Druid - Fist weapons, staves, polearms, maces
    12: [0, 1, 4, 13], // Demon Hunter - Warglaives, one-handed
    13: [0, 1, 4, 7, 10], // Evoker - Staves, daggers, swords, maces
  };

  const allowedWeaponTypes = classWeaponTypes[classId] || [];

  // If weapon type matches, no penalty
  if (allowedWeaponTypes.includes(itemSubClass)) {
    return 0.0;
  }

  // Wrong weapon type: 90% penalty (very high - can't use wrong weapon type)
  return 0.9;
}

/**
 * Find quest hubs (clusters of quest givers)
 */
export async function findQuestHubs(zoneId: number, minQuestCount: number = 3): Promise<QuestHub[]> {
  const query = `
    SELECT
      c.zoneId, c.map as mapId, c.position_x as x, c.position_y as y,
      COUNT(DISTINCT cqs.quest) as questCount,
      MIN(qt.MinLevel) as minLevel, MAX(qt.MinLevel) as maxLevel
    FROM creature c
    INNER JOIN creature_queststarter cqs ON c.id = cqs.id
    INNER JOIN quest_template qt ON cqs.quest = qt.ID
    WHERE c.zoneId = ?
    GROUP BY c.guid
    HAVING questCount >= ?
    ORDER BY questCount DESC
    LIMIT 20
  `;

  const hubs = await queryWorld(query, [zoneId, minQuestCount]);

  return hubs.map((hub: any) => ({
    mapId: hub.mapId,
    zoneId: hub.zoneId,
    zoneName: `Zone ${hub.zoneId}`,
    centerX: hub.x,
    centerY: hub.y,
    questCount: hub.questCount,
    quests: [],
    levelRange: { min: hub.minLevel, max: hub.maxLevel },
    efficiency: hub.questCount / 100 // Simplified efficiency
  }));
}

/**
 * Analyze quest objectives and estimate difficulty
 */
export async function analyzeQuestObjectives(questId: number): Promise<QuestObjective[]> {
  const objectives: QuestObjective[] = [];

  const query = `
    SELECT
      ID as questId, RequiredNpcOrGo1 as target1, RequiredNpcOrGo2 as target2,
      RequiredNpcOrGo3 as target3, RequiredNpcOrGo4 as target4,
      RequiredNpcOrGoCount1 as count1, RequiredNpcOrGoCount2 as count2,
      RequiredNpcOrGoCount3 as count3, RequiredNpcOrGoCount4 as count4,
      RequiredItemId1 as item1, RequiredItemId2 as item2,
      RequiredItemId3 as item3, RequiredItemId4 as item4,
      RequiredItemCount1 as itemCount1, RequiredItemCount2 as itemCount2,
      RequiredItemCount3 as itemCount3, RequiredItemCount4 as itemCount4
    FROM quest_template
    WHERE ID = ?
  `;

  const results = await queryWorld(query, [questId]);

  if (!results || results.length === 0) {
    return objectives;
  }

  const quest = results[0];

  // Process creature/object objectives
  for (let i = 1; i <= 4; i++) {
    const target = quest[`target${i}`];
    const count = quest[`count${i}`];

    if (target && target !== 0 && count && count > 0) {
      const isCreature = target > 0;

      objectives.push({
        questId,
        objectiveIndex: i - 1,
        type: isCreature ? "kill" : "interact",
        description: `${isCreature ? 'Kill' : 'Interact with'} ${Math.abs(target)} (${count}x)`,
        requiredAmount: count,
        creatureId: isCreature ? target : undefined,
        gameObjectId: !isCreature ? Math.abs(target) : undefined,
        estimatedTime: count * 2, // Rough estimate
        difficultyRating: count > 20 ? "hard" : count > 10 ? "medium" : "easy"
      });
    }
  }

  // Process item objectives
  for (let i = 1; i <= 4; i++) {
    const itemId = quest[`item${i}`];
    const itemCount = quest[`itemCount${i}`];

    if (itemId && itemId !== 0 && itemCount && itemCount > 0) {
      objectives.push({
        questId,
        objectiveIndex: i + 3, // After creature objectives
        type: "collect",
        description: `Collect item ${itemId} (${itemCount}x)`,
        requiredAmount: itemCount,
        itemId,
        estimatedTime: itemCount * 3,
        difficultyRating: itemCount > 15 ? "hard" : itemCount > 5 ? "medium" : "easy"
      });
    }
  }

  return objectives;
}

/**
 * Optimize quest path through a zone
 */
export async function optimizeQuestPath(
  zoneId: number,
  playerLevel: number,
  maxQuests: number = 20
): Promise<QuestFlowAnalysis> {
  // Get available quests in level range
  const query = `
    SELECT DISTINCT qt.ID as questId, qt.QuestTitle as name,
           qt.MinLevel, qt.QuestLevel, qt.RewardXPDifficulty,
           qt.RewardMoney
    FROM quest_template qt
    INNER JOIN creature_queststarter cqs ON qt.ID = cqs.quest
    INNER JOIN creature c ON cqs.id = c.id
    WHERE c.zoneId = ?
      AND qt.MinLevel <= ?
      AND qt.QuestLevel <= ? + 5
    ORDER BY qt.QuestLevel, qt.ID
    LIMIT ?
  `;

  const quests = await queryWorld(query, [zoneId, playerLevel, playerLevel, maxQuests]);

  // Simple optimization: order by level and prerequisites
  const optimalPath = quests.map((q: any) => q.questId);

  // Group quests that can be done in parallel (same area, similar objectives)
  const parallelGroups: number[][] = [];
  const bottlenecks: Array<{ questId: number; reason: string }> = [];

  const estimatedTime = quests.length * 10; // 10 min per quest
  const totalXP = quests.reduce((sum: number, q: any) => sum + (q.RewardXPDifficulty || 0), 0);
  const totalGold = quests.reduce((sum: number, q: any) => sum + (q.RewardMoney || 0), 0);

  return {
    zoneId,
    zoneName: `Zone ${zoneId}`,
    optimalPath,
    parallelGroups,
    bottlenecks,
    estimatedCompletionTime: estimatedTime,
    xpPerHour: (totalXP / estimatedTime) * 60,
    goldPerHour: (totalGold / estimatedTime) * 60
  };
}
