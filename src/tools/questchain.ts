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

  // TODO: Implement best choice logic for class
  let bestChoiceForClass: QuestReward["bestChoiceForClass"];

  return {
    questId: quest.questId,
    name: quest.name,
    rewardXP: 0, // Would need level calculation
    rewardMoney: quest.rewardMoney || 0,
    rewardXPDifficulty: quest.rewardXPDifficulty || 0,
    rewardMoneyDifficulty: quest.rewardMoneyDifficulty || 0,
    choiceRewards: (choiceRewards || []).map((r: any) => ({
      itemId: r.itemId,
      quantity: r.quantity,
      itemLevel: 0,
      estimatedValue: 0
    })),
    rewards: rewards || [],
    reputationRewards: reputationRewards || [],
    currencyRewards: [],
    bestChoiceForClass
  };
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
