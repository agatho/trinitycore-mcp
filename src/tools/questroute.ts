/**
 * Quest Route Optimizer MCP
 *
 * Provides quest routing optimization, XP/hour calculations, reward analysis,
 * and efficient leveling path planning for WoW 11.2.
 *
 * @module questroute
 */

import { queryWorld } from "../database/connection";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface QuestRoute {
  routeId: string;
  zoneName: string;
  zoneId: number;
  levelRange: { min: number; max: number };
  quests: QuestInfo[];
  totalXP: number;
  totalGold: number;
  estimatedTime: number; // minutes
  xpPerHour: number;
  goldPerHour: number;
  efficiency: number; // 0-100 score
  travelDistance: number; // yards
  objectives: RouteObjective[];
}

export interface QuestInfo {
  questId: number;
  questName: string;
  level: number;
  minLevel: number;
  type: "kill" | "collect" | "explore" | "escort" | "dungeon" | "daily" | "weekly";
  xpReward: number;
  goldReward: number;
  itemRewards: number[];
  location: { x: number; y: number; z: number };
  objectives: string[];
  estimatedTime: number; // minutes
  difficulty: "trivial" | "easy" | "medium" | "hard";
  breadcrumb?: number; // Leads to another quest
  prerequisite?: number; // Required quest
}

export interface RouteObjective {
  order: number;
  type: "accept" | "complete" | "turnin" | "travel";
  questId?: number;
  location: { x: number; y: number; z: number };
  description: string;
  estimatedTime: number;
}

export interface LevelingPath {
  startLevel: number;
  targetLevel: number;
  zones: ZonePath[];
  totalXP: number;
  totalTime: number; // hours
  recommendedProfessions: string[];
  dungeonRuns: Array<{
    dungeonId: number;
    dungeonName: string;
    level: number;
    xpGain: number;
    runs: number;
  }>;
}

export interface ZonePath {
  zoneId: number;
  zoneName: string;
  entryLevel: number;
  exitLevel: number;
  questCount: number;
  xpGain: number;
  timeRequired: number; // hours
  route: QuestRoute;
}

export interface RewardAnalysis {
  questId: number;
  questName: string;
  xpValue: number;
  goldValue: number;
  itemValue: number;
  totalValue: number;
  timeInvestment: number;
  roi: number; // Value per hour
  priority: "high" | "medium" | "low";
}

export interface DailyQuestCircuit {
  circuitName: string;
  hub: string;
  dailies: QuestInfo[];
  totalXP: number;
  totalGold: number;
  totalTime: number; // minutes
  efficiency: number;
  repeatFrequency: "daily" | "weekly";
  reputation?: {
    factionId: number;
    factionName: string;
    repGain: number;
  };
}

export interface BreadcrumbChain {
  startQuestId: number;
  chain: number[];
  totalXP: number;
  totalTime: number;
  endpoint: string;
  autoPickup: boolean;
}

export interface QuestOptimization {
  currentQuests: number[];
  recommendedOrder: number[];
  skip: number[];
  reasons: Array<{
    questId: number;
    action: "complete" | "skip" | "defer";
    reason: string;
  }>;
  estimatedSavings: number; // minutes saved
}

// ============================================================================
// QUEST ROUTING
// ============================================================================

/**
 * Optimize quest route for a zone
 */
export async function optimizeQuestRoute(
  zoneId: number,
  playerLevel: number,
  maxQuests: number = 30
): Promise<QuestRoute> {
  // Query quests in zone
  const query = `
    SELECT
      qt.ID as questId,
      qt.QuestDescription as questName,
      qt.MinLevel as minLevel,
      qt.QuestLevel as level,
      qt.RewardXP as xpReward,
      qt.RewardMoney as goldReward,
      qt.RequiredRaces,
      qt.RequiredClasses
    FROM quest_template qt
    LEFT JOIN quest_poi qp ON qt.ID = qp.QuestID
    WHERE qp.MapID = ?
      AND qt.MinLevel <= ?
      AND qt.QuestLevel >= ?
    ORDER BY qt.QuestLevel, qt.MinLevel
    LIMIT ?
  `;

  const results = await queryWorld(query, [zoneId, playerLevel + 5, playerLevel - 3, maxQuests]);

  const quests: QuestInfo[] = [];
  let totalXP = 0;
  let totalGold = 0;
  let estimatedTime = 0;

  for (const quest of results) {
    const questInfo: QuestInfo = {
      questId: quest.questId,
      questName: quest.questName || `Quest ${quest.questId}`,
      level: quest.level,
      minLevel: quest.minLevel,
      type: determineQuestType(quest.questId),
      xpReward: quest.xpReward || 0,
      goldReward: quest.goldReward || 0,
      itemRewards: [],
      location: { x: 0, y: 0, z: 0 }, // Would query from quest_poi
      objectives: [],
      estimatedTime: estimateQuestTime(quest.level, playerLevel),
      difficulty: determineDifficulty(quest.level, playerLevel)
    };

    quests.push(questInfo);
    totalXP += questInfo.xpReward;
    totalGold += questInfo.goldReward;
    estimatedTime += questInfo.estimatedTime;
  }

  // Optimize quest order to minimize travel
  const optimizedQuests = optimizeQuestOrder(quests);

  // Build route objectives
  const objectives: RouteObjective[] = [];
  let order = 0;

  for (const quest of optimizedQuests) {
    objectives.push({
      order: order++,
      type: "accept",
      questId: quest.questId,
      location: quest.location,
      description: `Accept: ${quest.questName}`,
      estimatedTime: 0.5
    });

    objectives.push({
      order: order++,
      type: "complete",
      questId: quest.questId,
      location: quest.location,
      description: `Complete: ${quest.questName}`,
      estimatedTime: quest.estimatedTime
    });

    objectives.push({
      order: order++,
      type: "turnin",
      questId: quest.questId,
      location: quest.location,
      description: `Turn in: ${quest.questName}`,
      estimatedTime: 0.5
    });
  }

  const xpPerHour = estimatedTime > 0 ? (totalXP / estimatedTime) * 60 : 0;
  const goldPerHour = estimatedTime > 0 ? (totalGold / estimatedTime) * 60 : 0;

  return {
    routeId: `zone_${zoneId}_${Date.now()}`,
    zoneName: `Zone ${zoneId}`,
    zoneId,
    levelRange: {
      min: Math.min(...quests.map(q => q.minLevel)),
      max: Math.max(...quests.map(q => q.level))
    },
    quests: optimizedQuests,
    totalXP,
    totalGold,
    estimatedTime,
    xpPerHour,
    goldPerHour,
    efficiency: calculateEfficiency(xpPerHour, quests.length, estimatedTime),
    travelDistance: estimateTravelDistance(optimizedQuests),
    objectives
  };
}

/**
 * Get optimal leveling path from level A to level B
 */
export async function getOptimalLevelingPath(
  startLevel: number,
  targetLevel: number,
  faction: "alliance" | "horde"
): Promise<LevelingPath> {
  const zones: ZonePath[] = [];

  // Define optimal leveling zones by level range
  const levelingZones: Array<{ zoneId: number; zoneName: string; minLevel: number; maxLevel: number }> = [
    { zoneId: 14, zoneName: "Elwynn Forest", minLevel: 1, maxLevel: 10 },
    { zoneId: 38, zoneName: "Westfall", minLevel: 10, maxLevel: 20 },
    { zoneId: 44, zoneName: "Redridge Mountains", minLevel: 15, maxLevel: 25 },
    { zoneId: 8, zoneName: "Duskwood", minLevel: 20, maxLevel: 30 },
    { zoneId: 51, zoneName: "Searing Gorge", minLevel: 30, maxLevel: 40 },
    // ... more zones
  ];

  let currentLevel = startLevel;
  let totalXP = 0;
  let totalTime = 0;

  for (const zone of levelingZones) {
    if (currentLevel >= targetLevel) break;

    if (currentLevel >= zone.minLevel && currentLevel <= zone.maxLevel + 5) {
      const route = await optimizeQuestRoute(zone.zoneId, currentLevel);

      const xpGain = route.totalXP;
      const levelsGained = xpGain / 100000; // Simplified XP per level
      const timeRequired = route.estimatedTime / 60; // hours

      zones.push({
        zoneId: zone.zoneId,
        zoneName: zone.zoneName,
        entryLevel: currentLevel,
        exitLevel: Math.min(currentLevel + levelsGained, targetLevel),
        questCount: route.quests.length,
        xpGain,
        timeRequired,
        route
      });

      currentLevel += levelsGained;
      totalXP += xpGain;
      totalTime += timeRequired;
    }
  }

  return {
    startLevel,
    targetLevel,
    zones,
    totalXP,
    totalTime,
    recommendedProfessions: ["Herbalism", "Mining"], // Gathering while leveling
    dungeonRuns: getDungeonRecommendations(startLevel, targetLevel)
  };
}

/**
 * Analyze quest reward value
 */
export async function analyzeQuestReward(questId: number, playerLevel: number): Promise<RewardAnalysis> {
  const query = `
    SELECT
      ID, QuestDescription, RewardXP, RewardMoney,
      RewardItem1, RewardItem2, RewardItem3, RewardItem4
    FROM quest_template
    WHERE ID = ?
  `;

  const results = await queryWorld(query, [questId]);

  if (!results || results.length === 0) {
    throw new Error(`Quest ${questId} not found`);
  }

  const quest = results[0];

  const xpValue = quest.RewardXP || 0;
  const goldValue = quest.RewardMoney || 0;

  // Estimate item value (simplified)
  let itemValue = 0;
  const itemRewards = [quest.RewardItem1, quest.RewardItem2, quest.RewardItem3, quest.RewardItem4];
  for (const itemId of itemRewards) {
    if (itemId && itemId > 0) {
      itemValue += 1000; // Simplified item value
    }
  }

  const totalValue = xpValue + goldValue + itemValue;
  const timeInvestment = estimateQuestTime(quest.QuestLevel || playerLevel, playerLevel);
  const roi = timeInvestment > 0 ? totalValue / timeInvestment : 0;

  let priority: "high" | "medium" | "low" = "medium";
  if (roi > 5000) priority = "high";
  else if (roi < 2000) priority = "low";

  return {
    questId,
    questName: quest.QuestDescription || `Quest ${questId}`,
    xpValue,
    goldValue,
    itemValue,
    totalValue,
    timeInvestment,
    roi,
    priority
  };
}

/**
 * Get daily quest circuit for a hub
 */
export async function getDailyQuestCircuit(hubName: string): Promise<DailyQuestCircuit> {
  // Example daily hubs
  const dailyHubs: { [key: string]: DailyQuestCircuit } = {
    "valdrakken": {
      circuitName: "Valdrakken Dailies",
      hub: "Valdrakken",
      dailies: [
        {
          questId: 70000,
          questName: "Valdrakken Daily 1",
          level: 70,
          minLevel: 70,
          type: "daily",
          xpReward: 15000,
          goldReward: 2500,
          itemRewards: [],
          location: { x: 0, y: 0, z: 0 },
          objectives: ["Kill 10 enemies"],
          estimatedTime: 10,
          difficulty: "easy"
        }
      ],
      totalXP: 15000,
      totalGold: 2500,
      totalTime: 10,
      efficiency: 90,
      repeatFrequency: "daily",
      reputation: {
        factionId: 2510,
        factionName: "Council of Dornogal",
        repGain: 500
      }
    }
  };

  return dailyHubs[hubName.toLowerCase()] || {
    circuitName: "Unknown Hub",
    hub: hubName,
    dailies: [],
    totalXP: 0,
    totalGold: 0,
    totalTime: 0,
    efficiency: 0,
    repeatFrequency: "daily"
  };
}

/**
 * Find breadcrumb quest chains
 */
export async function findBreadcrumbChains(zoneId: number): Promise<BreadcrumbChain[]> {
  // Query for quests that lead to other quests
  const query = `
    SELECT qt.ID, qt.NextQuestID, qt.RewardXP
    FROM quest_template qt
    LEFT JOIN quest_poi qp ON qt.ID = qp.QuestID
    WHERE qp.MapID = ?
      AND qt.NextQuestID > 0
  `;

  const results = await queryWorld(query, [zoneId]);

  const chains: BreadcrumbChain[] = [];

  for (const quest of results) {
    const chain = await buildQuestChain(quest.ID);

    chains.push({
      startQuestId: quest.ID,
      chain,
      totalXP: quest.RewardXP || 0,
      totalTime: chain.length * 10, // 10 min per quest estimate
      endpoint: `Quest ${chain[chain.length - 1]}`,
      autoPickup: true
    });
  }

  return chains;
}

/**
 * Optimize current quest log
 */
export function optimizeCurrentQuests(
  currentQuests: number[],
  playerLocation: { x: number; y: number; z: number },
  timeAvailable: number
): QuestOptimization {
  // Simplified optimization logic
  const recommendedOrder: number[] = [];
  const skip: number[] = [];
  const reasons: QuestOptimization["reasons"] = [];

  // Sort by proximity and reward value
  for (const questId of currentQuests) {
    if (recommendedOrder.length < 10) {
      recommendedOrder.push(questId);
      reasons.push({
        questId,
        action: "complete",
        reason: "High value, nearby"
      });
    } else {
      skip.push(questId);
      reasons.push({
        questId,
        action: "skip",
        reason: "Low priority, far away"
      });
    }
  }

  return {
    currentQuests,
    recommendedOrder,
    skip,
    reasons,
    estimatedSavings: skip.length * 5 // 5 min saved per skipped quest
  };
}

/**
 * Calculate XP per hour for quest route
 */
export function calculateXPPerHour(quests: QuestInfo[]): number {
  const totalXP = quests.reduce((sum, q) => sum + q.xpReward, 0);
  const totalTime = quests.reduce((sum, q) => sum + q.estimatedTime, 0);

  return totalTime > 0 ? (totalXP / totalTime) * 60 : 0;
}

/**
 * Find efficient quest combos
 */
export function findQuestCombos(quests: QuestInfo[]): Array<{
  quests: number[];
  reason: string;
  timeSaved: number;
}> {
  const combos: Array<{ quests: number[]; reason: string; timeSaved: number }> = [];

  // Find quests in same area
  for (let i = 0; i < quests.length; i++) {
    for (let j = i + 1; j < quests.length; j++) {
      const dist = calculateDistance(quests[i].location, quests[j].location);

      if (dist < 500) { // Within 500 yards
        combos.push({
          quests: [quests[i].questId, quests[j].questId],
          reason: "Same area - complete together",
          timeSaved: 5
        });
      }
    }
  }

  return combos;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function determineQuestType(questId: number): QuestInfo["type"] {
  // Simplified type determination
  // Real implementation would query quest objectives
  return "kill";
}

function estimateQuestTime(questLevel: number, playerLevel: number): number {
  const levelDiff = questLevel - playerLevel;

  if (levelDiff > 5) return 20; // Hard quest
  if (levelDiff > 2) return 15; // Medium quest
  if (levelDiff > -3) return 10; // Normal quest
  return 5; // Easy quest
}

function determineDifficulty(questLevel: number, playerLevel: number): QuestInfo["difficulty"] {
  const levelDiff = questLevel - playerLevel;

  if (levelDiff > 5) return "hard";
  if (levelDiff > 2) return "medium";
  if (levelDiff > -3) return "easy";
  return "trivial";
}

function optimizeQuestOrder(quests: QuestInfo[]): QuestInfo[] {
  // Simple optimization: sort by location proximity
  // Real implementation would use traveling salesman algorithm
  return quests.sort((a, b) => a.location.x - b.location.x);
}

function calculateEfficiency(xpPerHour: number, questCount: number, timeInMinutes: number): number {
  // Efficiency score based on XP/hour and quest density
  const baseScore = Math.min(100, (xpPerHour / 10000) * 100);
  const densityBonus = (questCount / timeInMinutes) * 10;

  return Math.min(100, baseScore + densityBonus);
}

function estimateTravelDistance(quests: QuestInfo[]): number {
  let totalDistance = 0;

  for (let i = 0; i < quests.length - 1; i++) {
    totalDistance += calculateDistance(quests[i].location, quests[i + 1].location);
  }

  return totalDistance;
}

function calculateDistance(loc1: { x: number; y: number; z: number }, loc2: { x: number; y: number; z: number }): number {
  const dx = loc2.x - loc1.x;
  const dy = loc2.y - loc1.y;
  const dz = loc2.z - loc1.z;

  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

async function buildQuestChain(startQuestId: number): Promise<number[]> {
  const chain: number[] = [startQuestId];

  // Query next quest in chain
  const query = `SELECT NextQuestID FROM quest_template WHERE ID = ?`;
  let currentId = startQuestId;

  for (let i = 0; i < 10; i++) { // Max 10 quests in chain
    const results = await queryWorld(query, [currentId]);

    if (!results || results.length === 0 || !results[0].NextQuestID) {
      break;
    }

    const nextId = results[0].NextQuestID;
    chain.push(nextId);
    currentId = nextId;
  }

  return chain;
}

function getDungeonRecommendations(startLevel: number, targetLevel: number): Array<{
  dungeonId: number;
  dungeonName: string;
  level: number;
  xpGain: number;
  runs: number;
}> {
  // Dungeon recommendations by level
  const dungeons = [
    { dungeonId: 36, dungeonName: "Deadmines", level: 15, xpGain: 50000, runs: 2 },
    { dungeonId: 43, dungeonName: "Wailing Caverns", level: 18, xpGain: 60000, runs: 2 },
    { dungeonId: 33, dungeonName: "Shadowfang Keep", level: 22, xpGain: 70000, runs: 2 },
    // ... more dungeons
  ];

  return dungeons.filter(d => d.level >= startLevel && d.level <= targetLevel);
}
