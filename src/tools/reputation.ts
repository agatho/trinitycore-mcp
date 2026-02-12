/**
 * Reputation Tracker MCP
 *
 * Provides reputation tracking, grinding paths, reward tracking,
 * and optimization strategies for faction reputation gains.
 *
 * @module reputation
 */

import { queryWorld } from "../database/connection";
import { logger } from '../utils/logger';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface FactionInfo {
  factionId: number;
  name: string;
  description: string;
  category: "alliance" | "horde" | "neutral" | "guild" | "expansion";
  parentFactionId?: number;
  maxReputation: number;
}

export interface ReputationStanding {
  factionId: number;
  factionName: string;
  currentReputation: number;
  currentStanding: "hated" | "hostile" | "unfriendly" | "neutral" | "friendly" | "honored" | "revered" | "exalted";
  nextStanding?: string;
  reputationToNext: number;
  percentToNext: number;
  isAtMax: boolean;
}

export interface ReputationGrindPath {
  factionId: number;
  factionName: string;
  currentRep: number;
  targetRep: number;
  currentStanding: string;
  targetStanding: string;
  methods: GrindMethod[];
  estimatedTime: number; // hours
  totalRepNeeded: number;
  recommendedMethod: GrindMethod;
}

export interface GrindMethod {
  methodId: string;
  name: string;
  type: "quest" | "mob_kill" | "daily" | "dungeon" | "raid" | "turn_in" | "token";
  repPerAction: number;
  actionsPerHour: number;
  repPerHour: number;
  repeatability: "one_time" | "daily" | "unlimited";
  requiredLevel: number;
  difficulty: "trivial" | "easy" | "medium" | "hard";
  location?: string;
  notes: string;
}

export interface ReputationReward {
  factionId: number;
  requiredStanding: string;
  rewardType: "item" | "mount" | "pet" | "recipe" | "tabard" | "title" | "achievement";
  rewardId: number;
  rewardName: string;
  description: string;
  cost?: number; // Gold cost in copper
  isPurchasable: boolean;
}

export interface DailyReputationPlan {
  date: string;
  factions: Array<{
    factionId: number;
    factionName: string;
    dailies: Array<{
      questId: number;
      questName: string;
      reputation: number;
      location: string;
      estimatedTime: number;
    }>;
    totalRepGain: number;
    estimatedTime: number;
  }>;
  totalTime: number;
  totalRepGain: number;
}

export interface ReputationTokenInfo {
  itemId: number;
  itemName: string;
  repGain: number;
  factionId: number;
  factionName: string;
  isRepeatable: boolean;
  requiredStanding?: string;
  stackSize: number;
  costEfficiency: number; // Rep per copper spent
}

export interface ParagonReputationInfo {
  factionId: number;
  factionName: string;
  isParagonEnabled: boolean;
  currentParagonRep: number;
  repToNextCache: number;
  totalCachesEarned: number;
  cacheRewards: string[];
}

// ============================================================================
// PHASE 7 ENHANCEMENT #7: Reputation Multipliers
// ============================================================================

/**
 * Reputation multiplier sources
 */
export enum ReputationMultiplierType {
  RACIAL = "racial",           // Race-specific bonuses (e.g., Human Diplomacy)
  GUILD = "guild",             // Guild perk bonuses
  EVENT = "event",             // World event bonuses (Darkmoon Faire, etc.)
  CONSUMABLE = "consumable",   // Buff consumables
  HOLIDAY = "holiday"          // Holiday event bonuses
}

/**
 * Reputation multiplier configuration
 */
export interface ReputationMultiplier {
  type: ReputationMultiplierType;
  name: string;
  multiplier: number;  // 1.0 = 100%, 1.10 = +10%, 2.0 = +100%
  description: string;
  raceId?: number;     // For racial bonuses (optional)
  guildLevel?: number; // For guild perks (optional)
}

/**
 * Reputation calculation result with all modifiers
 */
export interface ReputationGainResult {
  baseReputation: number;
  multipliers: ReputationMultiplier[];
  totalMultiplier: number;
  finalReputation: number;
  breakdown: string[];
}

/**
 * Racial reputation bonuses for WoW 12.0
 * Based on race-specific passive abilities
 */
export const RACIAL_REPUTATION_BONUSES: ReputationMultiplier[] = [
  {
    type: ReputationMultiplierType.RACIAL,
    name: "Diplomacy",
    multiplier: 1.10,  // +10%
    description: "Human racial: +10% reputation gains",
    raceId: 1  // Human
  }
  // Note: As of WoW 12.0, Human Diplomacy is the only remaining racial reputation bonus
  // Previous bonuses for other races were removed in various expansions
];

/**
 * Guild perk reputation bonuses
 * Based on guild level and perks unlocked
 */
export const GUILD_REPUTATION_BONUSES: ReputationMultiplier[] = [
  {
    type: ReputationMultiplierType.GUILD,
    name: "Mr. Popularity (Rank 1)",
    multiplier: 1.05,  // +5%
    description: "Guild perk: +5% reputation gains",
    guildLevel: 3
  },
  {
    type: ReputationMultiplierType.GUILD,
    name: "Mr. Popularity (Rank 2)",
    multiplier: 1.10,  // +10%
    description: "Guild perk: +10% reputation gains",
    guildLevel: 6
  }
];

/**
 * World event reputation bonuses
 */
export const EVENT_REPUTATION_BONUSES: ReputationMultiplier[] = [
  {
    type: ReputationMultiplierType.EVENT,
    name: "Darkmoon Faire - WHEE!",
    multiplier: 1.10,  // +10%
    description: "Darkmoon Carousel buff: +10% reputation for 1 hour"
  },
  {
    type: ReputationMultiplierType.HOLIDAY,
    name: "WoW Anniversary",
    multiplier: 2.00,  // +100%
    description: "WoW Anniversary event: +100% reputation gains"
  },
  {
    type: ReputationMultiplierType.HOLIDAY,
    name: "Timewalking Bonus Event",
    multiplier: 1.50,  // +50%
    description: "Timewalking event: +50% reputation from dungeons"
  }
];

/**
 * Calculate total reputation gain with all applicable multipliers
 * Enhancement #7 (Phase 7): Comprehensive reputation calculation system
 *
 * @param baseReputation - Base reputation amount (from quest/token/kill)
 * @param playerRaceId - Player's race ID (1-13)
 * @param hasGuildPerk - Whether player has guild reputation perk
 * @param guildLevel - Guild level (if in guild)
 * @param activeEvents - Array of active event/buff names
 * @returns Detailed reputation gain breakdown
 */
export function calculateReputationGain(
  baseReputation: number,
  playerRaceId: number = 0,
  hasGuildPerk: boolean = false,
  guildLevel: number = 0,
  activeEvents: string[] = []
): ReputationGainResult {
  const appliedMultipliers: ReputationMultiplier[] = [];
  let totalMultiplier = 1.0;

  // Apply racial bonuses
  const racialBonus = RACIAL_REPUTATION_BONUSES.find(
    (bonus) => bonus.raceId === playerRaceId
  );
  if (racialBonus) {
    appliedMultipliers.push(racialBonus);
    totalMultiplier *= racialBonus.multiplier;
  }

  // Apply guild perks (highest applicable tier)
  if (hasGuildPerk && guildLevel > 0) {
    const applicableGuildPerks = GUILD_REPUTATION_BONUSES.filter(
      (perk) => (perk.guildLevel || 0) <= guildLevel
    ).sort((a, b) => (b.guildLevel || 0) - (a.guildLevel || 0));

    if (applicableGuildPerks.length > 0) {
      const guildPerk = applicableGuildPerks[0]; // Highest tier
      appliedMultipliers.push(guildPerk);
      totalMultiplier *= guildPerk.multiplier;
    }
  }

  // Apply event bonuses
  for (const eventName of activeEvents) {
    const eventBonus = EVENT_REPUTATION_BONUSES.find(
      (bonus) => bonus.name.toLowerCase().includes(eventName.toLowerCase())
    );
    if (eventBonus) {
      appliedMultipliers.push(eventBonus);
      totalMultiplier *= eventBonus.multiplier;
    }
  }

  // Calculate final reputation
  const finalReputation = Math.floor(baseReputation * totalMultiplier);

  // Create breakdown
  const breakdown: string[] = [
    `Base reputation: ${baseReputation}`
  ];

  for (const mult of appliedMultipliers) {
    const bonusPercent = Math.round((mult.multiplier - 1.0) * 100);
    breakdown.push(`${mult.name}: +${bonusPercent}% (${mult.description})`);
  }

  breakdown.push(`Total multiplier: ${totalMultiplier.toFixed(2)}x`);
  breakdown.push(`Final reputation: ${finalReputation}`);

  return {
    baseReputation,
    multipliers: appliedMultipliers,
    totalMultiplier,
    finalReputation,
    breakdown
  };
}

/**
 * Get available reputation multipliers for a player
 *
 * @param playerRaceId - Player's race ID
 * @param guildLevel - Player's guild level (0 if not in guild)
 * @returns Array of applicable multipliers
 */
export function getAvailableReputationMultipliers(
  playerRaceId: number = 0,
  guildLevel: number = 0
): { racial: ReputationMultiplier[]; guild: ReputationMultiplier[]; event: ReputationMultiplier[] } {
  // Racial bonuses
  const racial: ReputationMultiplier[] = [];
  if (playerRaceId > 0) {
    const racialBonus = RACIAL_REPUTATION_BONUSES.find(
      (bonus) => bonus.raceId === playerRaceId
    );
    if (racialBonus) {
      racial.push(racialBonus);
    }
  }

  // Guild perks (all unlocked at current level)
  const guild = GUILD_REPUTATION_BONUSES.filter(
    (perk) => (perk.guildLevel || 0) <= guildLevel
  );

  // All possible event bonuses
  const event = [...EVENT_REPUTATION_BONUSES];

  return { racial, guild, event };
}

// ============================================================================
// CORE FUNCTIONS
// ============================================================================

/**
 * Get faction information
 */
export async function getFactionInfo(factionId: number): Promise<FactionInfo> {
  // WoW faction data is primarily in DBC/DB2 files
  // For demonstration, using a static map of known factions
  const factionMap: { [key: number]: Partial<FactionInfo> } = {
    72: { name: "Stormwind", category: "alliance", maxReputation: 42000 },
    76: { name: "Orgrimmar", category: "horde", maxReputation: 42000 },
    469: { name: "Alliance", category: "alliance", maxReputation: 42000 },
    67: { name: "Horde", category: "horde", maxReputation: 42000 },
    1134: { name: "Gilneas", category: "alliance", maxReputation: 42000 },
    1353: { name: "Tushui Pandaren", category: "alliance", maxReputation: 42000 },
    1133: { name: "Huojin Pandaren", category: "horde", maxReputation: 42000 },
    2103: { name: "Maruuk Centaur", category: "neutral", maxReputation: 42000 },
    2507: { name: "Dream Wardens", category: "neutral", maxReputation: 42000 },
    2510: { name: "Council of Dornogal", category: "neutral", maxReputation: 42000 }
  };

  const faction = factionMap[factionId];

  if (!faction) {
    throw new Error(`Faction ${factionId} not found`);
  }

  return {
    factionId,
    name: faction.name || `Faction ${factionId}`,
    description: `Reputation faction: ${faction.name}`,
    category: faction.category || "neutral",
    maxReputation: faction.maxReputation || 42000
  };
}

/**
 * Calculate reputation standing from raw reputation value
 */
export function calculateReputationStanding(
  factionId: number,
  factionName: string,
  currentReputation: number
): ReputationStanding {
  // Reputation thresholds
  const standings = [
    { name: "hated", min: -42000, max: -6000 },
    { name: "hostile", min: -6000, max: -3000 },
    { name: "unfriendly", min: -3000, max: 0 },
    { name: "neutral", min: 0, max: 3000 },
    { name: "friendly", min: 3000, max: 9000 },
    { name: "honored", min: 9000, max: 21000 },
    { name: "revered", min: 21000, max: 42000 },
    { name: "exalted", min: 42000, max: 999999 }
  ];

  let currentStanding = standings.find(s => currentReputation >= s.min && currentReputation < s.max);

  if (!currentStanding) {
    currentStanding = standings[standings.length - 1]; // Default to exalted if beyond max
  }

  const currentIndex = standings.findIndex(s => s.name === currentStanding!.name);
  const nextStanding = currentIndex < standings.length - 1 ? standings[currentIndex + 1] : null;

  const reputationToNext = nextStanding ? nextStanding.min - currentReputation : 0;
  const standingRange = currentStanding.max - currentStanding.min;
  const progressInStanding = currentReputation - currentStanding.min;
  const percentToNext = standingRange > 0 ? (progressInStanding / standingRange) * 100 : 100;

  return {
    factionId,
    factionName,
    currentReputation,
    currentStanding: currentStanding.name as any,
    nextStanding: nextStanding?.name,
    reputationToNext,
    percentToNext: Math.min(100, percentToNext),
    isAtMax: currentReputation >= 42000
  };
}

/**
 * Get reputation grind path from current to target standing
 */
export function getReputationGrindPath(
  factionId: number,
  factionName: string,
  currentRep: number,
  targetStanding: string
): ReputationGrindPath {
  const standingValues: { [key: string]: number } = {
    "hated": -42000,
    "hostile": -6000,
    "unfriendly": -3000,
    "neutral": 0,
    "friendly": 3000,
    "honored": 9000,
    "revered": 21000,
    "exalted": 42000
  };

  const targetRep = standingValues[targetStanding] || 42000;
  const totalRepNeeded = targetRep - currentRep;

  const currentStandingInfo = calculateReputationStanding(factionId, factionName, currentRep);

  // Get available grind methods
  const methods = getGrindMethods(factionId, factionName);

  // Sort by rep per hour
  methods.sort((a, b) => b.repPerHour - a.repPerHour);

  // Find recommended method (best rep/hour that's repeatable)
  const recommendedMethod = methods.find(m => m.repeatability === "unlimited" || m.repeatability === "daily")
    || methods[0]
    || {
      methodId: "unknown",
      name: "Unknown method",
      type: "quest" as const,
      repPerAction: 0,
      actionsPerHour: 0,
      repPerHour: 0,
      repeatability: "one_time" as const,
      requiredLevel: 1,
      difficulty: "medium" as const,
      notes: "No methods available"
    };

  const estimatedTime = recommendedMethod.repPerHour > 0
    ? totalRepNeeded / recommendedMethod.repPerHour
    : 999;

  return {
    factionId,
    factionName,
    currentRep,
    targetRep,
    currentStanding: currentStandingInfo.currentStanding,
    targetStanding,
    methods,
    estimatedTime,
    totalRepNeeded,
    recommendedMethod
  };
}

/**
 * Get available grind methods for a faction
 */
function getGrindMethods(factionId: number, factionName: string): GrindMethod[] {
  // This would query database for quests, mobs, etc.
  // For now, providing example methods

  const methods: GrindMethod[] = [
    {
      methodId: `${factionId}_dailies`,
      name: `${factionName} Daily Quests`,
      type: "daily",
      repPerAction: 500,
      actionsPerHour: 6,
      repPerHour: 3000,
      repeatability: "daily",
      requiredLevel: 70,
      difficulty: "easy",
      notes: "Complete all available daily quests"
    },
    {
      methodId: `${factionId}_tabard`,
      name: `Wear ${factionName} Tabard in Dungeons`,
      type: "dungeon",
      repPerAction: 300,
      actionsPerHour: 4,
      repPerHour: 1200,
      repeatability: "unlimited",
      requiredLevel: 90,
      difficulty: "medium",
      notes: "Equip faction tabard and run level-appropriate dungeons"
    },
    {
      methodId: `${factionId}_tokens`,
      name: `Turn in Reputation Tokens`,
      type: "turn_in",
      repPerAction: 250,
      actionsPerHour: 20,
      repPerHour: 5000,
      repeatability: "unlimited",
      requiredLevel: 70,
      difficulty: "trivial",
      notes: "Purchase or farm reputation tokens and turn them in"
    },
    {
      methodId: `${factionId}_weekly`,
      name: `${factionName} Weekly Quest`,
      type: "quest",
      repPerAction: 1500,
      actionsPerHour: 1,
      repPerHour: 1500,
      repeatability: "daily",
      requiredLevel: 70,
      difficulty: "medium",
      notes: "Complete weekly quest for large reputation boost"
    }
  ];

  return methods;
}

/**
 * Get all reputation rewards for a faction
 */
export async function getReputationRewards(factionId: number): Promise<ReputationReward[]> {
  const faction = await getFactionInfo(factionId);
  const rewards: ReputationReward[] = [];

  // TrinityCore 12.0.0: faction_A/faction_H removed, now just 'faction' column
  const vendorQuery = `
    SELECT
      nv.item, it.name, it.Quality, it.BuyPrice,
      nv.ExtendedCost
    FROM npc_vendor nv
    JOIN item_template it ON nv.item = it.entry
    WHERE nv.entry IN (
      SELECT entry FROM creature_template
      WHERE faction = ?
    )
    LIMIT 50
  `;

  try {
    const vendorResults = await queryWorld(vendorQuery, [factionId]);

    for (const item of vendorResults) {
      // Determine reward type based on item class/subclass
      let rewardType: ReputationReward["rewardType"] = "item";

      if (item.name.toLowerCase().includes("mount")) rewardType = "mount";
      else if (item.name.toLowerCase().includes("pet")) rewardType = "pet";
      else if (item.name.toLowerCase().includes("recipe") || item.name.toLowerCase().includes("pattern")) rewardType = "recipe";
      else if (item.name.toLowerCase().includes("tabard")) rewardType = "tabard";

      rewards.push({
        factionId,
        requiredStanding: await determineRequiredStanding(item.ExtendedCost),
        rewardType,
        rewardId: item.item,
        rewardName: item.name,
        description: `${rewardType} from ${faction.name}`,
        cost: item.BuyPrice,
        isPurchasable: true
      });
    }
  } catch (e) {
    logger.warn(`Could not load rewards for faction ${factionId}: ${e}`);
  }

  // Add achievement rewards
  rewards.push({
    factionId,
    requiredStanding: "exalted",
    rewardType: "achievement",
    rewardId: 948, // Example achievement ID
    rewardName: `Exalted with ${faction.name}`,
    description: `Reach exalted reputation with ${faction.name}`,
    isPurchasable: false
  });

  return rewards;
}

/**
 * Generate daily reputation farming plan
 */
export function generateDailyReputationPlan(
  factions: Array<{ factionId: number; factionName: string; currentRep: number }>,
  availableTime: number // hours
): DailyReputationPlan {
  const date = new Date().toISOString().split('T')[0];
  const plan: DailyReputationPlan = {
    date,
    factions: [],
    totalTime: 0,
    totalRepGain: 0
  };

  for (const faction of factions) {
    // Get daily quests for this faction
    const dailies = getDailyQuests(faction.factionId, faction.factionName);

    const factionPlan = {
      factionId: faction.factionId,
      factionName: faction.factionName,
      dailies,
      totalRepGain: dailies.reduce((sum, d) => sum + d.reputation, 0),
      estimatedTime: dailies.reduce((sum, d) => sum + d.estimatedTime, 0) / 60 // Convert to hours
    };

    plan.factions.push(factionPlan);
    plan.totalTime += factionPlan.estimatedTime;
    plan.totalRepGain += factionPlan.totalRepGain;
  }

  // Filter if exceeds available time
  if (plan.totalTime > availableTime) {
    // Sort factions by rep gain efficiency
    plan.factions.sort((a, b) => (b.totalRepGain / b.estimatedTime) - (a.totalRepGain / a.estimatedTime));

    // Include factions until time limit
    let cumulativeTime = 0;
    const filteredFactions = [];

    for (const faction of plan.factions) {
      if (cumulativeTime + faction.estimatedTime <= availableTime) {
        filteredFactions.push(faction);
        cumulativeTime += faction.estimatedTime;
      }
    }

    plan.factions = filteredFactions;
    plan.totalTime = cumulativeTime;
    plan.totalRepGain = filteredFactions.reduce((sum, f) => sum + f.totalRepGain, 0);
  }

  return plan;
}

/**
 * Get daily quests for a faction
 */
function getDailyQuests(factionId: number, factionName: string): Array<{
  questId: number;
  questName: string;
  reputation: number;
  location: string;
  estimatedTime: number;
}> {
  // This would query database for actual daily quests
  // For now, returning example data

  return [
    {
      questId: 1000 + factionId,
      questName: `${factionName} Daily: Supply Run`,
      reputation: 500,
      location: "Faction Hub",
      estimatedTime: 300 // 5 minutes
    },
    {
      questId: 2000 + factionId,
      questName: `${factionName} Daily: Rare Hunt`,
      reputation: 500,
      location: "Zone Area",
      estimatedTime: 600 // 10 minutes
    },
    {
      questId: 3000 + factionId,
      questName: `${factionName} Daily: World Quest`,
      reputation: 250,
      location: "World",
      estimatedTime: 420 // 7 minutes
    }
  ];
}

/**
 * Get reputation token information
 */
export async function getReputationTokens(factionId: number): Promise<ReputationTokenInfo[]> {
  const faction = await getFactionInfo(factionId);
  const tokens: ReputationTokenInfo[] = [];

  // Query items that grant reputation
  const query = `
    SELECT it.entry, it.name, it.stackable, it.BuyPrice
    FROM item_template it
    WHERE it.name LIKE '%Insignia%'
       OR it.name LIKE '%Token%'
       OR it.name LIKE '%Badge%'
    LIMIT 20
  `;

  try {
    const results = await queryWorld(query, []);

    for (const item of results) {
      // Parse reputation gain from item spell effect
      const repGain = await parseReputationGainFromItem(item.entry, factionId);

      tokens.push({
        itemId: item.entry,
        itemName: item.name,
        repGain,
        factionId,
        factionName: faction.name,
        isRepeatable: true,
        stackSize: item.stackable || 1,
        costEfficiency: item.BuyPrice > 0 ? repGain / item.BuyPrice : 0
      });
    }
  } catch (e) {
    logger.warn(`Could not load reputation tokens: ${e}`);
  }

  return tokens.sort((a, b) => b.costEfficiency - a.costEfficiency);
}

/**
 * Get paragon reputation information
 */
export function getParagonReputation(
  factionId: number,
  factionName: string,
  currentReputation: number,
  totalParagonRep: number
): ParagonReputationInfo {
  // Paragon is available after reaching Exalted (42000)
  const isParagonEnabled = currentReputation >= 42000;

  // Each paragon cache requires 10000 reputation
  const repPerCache = 10000;
  const currentParagonRep = totalParagonRep % repPerCache;
  const repToNextCache = repPerCache - currentParagonRep;
  const totalCachesEarned = Math.floor(totalParagonRep / repPerCache);

  return {
    factionId,
    factionName,
    isParagonEnabled,
    currentParagonRep,
    repToNextCache,
    totalCachesEarned,
    cacheRewards: [
      "Gold",
      "Reputation tokens",
      "Pets (rare)",
      "Mounts (very rare)",
      "Toys"
    ]
  };
}

/**
 * Calculate reputation with human-readable breakdown
 */
export function getReputationBreakdown(currentRep: number): {
  standing: string;
  progress: string;
  breakdown: {
    hated: number;
    hostile: number;
    unfriendly: number;
    neutral: number;
    friendly: number;
    honored: number;
    revered: number;
    exalted: number;
  };
} {
  const standings = [
    { name: "hated", min: -42000, range: 36000 },
    { name: "hostile", min: -6000, range: 3000 },
    { name: "unfriendly", min: -3000, range: 3000 },
    { name: "neutral", min: 0, range: 3000 },
    { name: "friendly", min: 3000, range: 6000 },
    { name: "honored", min: 9000, range: 12000 },
    { name: "revered", min: 21000, range: 21000 },
    { name: "exalted", min: 42000, range: 999999 }
  ];

  const current = standings.find(s => currentRep >= s.min && currentRep < s.min + s.range) || standings[standings.length - 1];
  const progress = currentRep >= current.min ? currentRep - current.min : 0;
  const progressPercent = (progress / current.range) * 100;

  const breakdown: any = {
    hated: 0,
    hostile: 0,
    unfriendly: 0,
    neutral: 0,
    friendly: 0,
    honored: 0,
    revered: 0,
    exalted: 0
  };

  // Fill in completed standings
  for (const standing of standings) {
    if (currentRep >= standing.min + standing.range) {
      breakdown[standing.name] = standing.range;
    } else if (currentRep >= standing.min) {
      breakdown[standing.name] = currentRep - standing.min;
      break;
    }
  }

  return {
    standing: current.name,
    progress: `${progress} / ${current.range} (${progressPercent.toFixed(1)}%)`,
    breakdown
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Parse reputation gain from item's spell effect
 * Items that grant reputation typically have a spell that applies a reputation bonus
 */
async function parseReputationGainFromItem(itemId: number, expectedFactionId: number): Promise<number> {
  try {
    // First, get the item's spell trigger
    const itemQuery = `
      SELECT spellid_1, spellid_2, spellid_3, spellid_4, spellid_5
      FROM item_template
      WHERE entry = ?
    `;
    const itemResults = await queryWorld(itemQuery, [itemId]);

    if (!itemResults || itemResults.length === 0) {
      return 250; // Default fallback
    }

    const item = itemResults[0];
    const spellIds = [
      item.spellid_1,
      item.spellid_2,
      item.spellid_3,
      item.spellid_4,
      item.spellid_5
    ].filter(id => id && id > 0);

    // Query spell effects for reputation gains
    for (const spellId of spellIds) {
      try {
        // In TrinityCore, reputation spell effects are typically stored in spell_template
        // Enhancement #7 (Phase 7): Updated to use SPELL_EFFECT_REPUTATION_REWARD (193)
        const spellQuery = `
          SELECT Effect_1, Effect_2, Effect_3, EffectBasePoints_1, EffectBasePoints_2, EffectBasePoints_3,
                 EffectMiscValue_1, EffectMiscValue_2, EffectMiscValue_3
          FROM spell_template
          WHERE ID = ?
        `;
        const spellResults = await queryWorld(spellQuery, [spellId]);

        if (spellResults && spellResults.length > 0) {
          const spell = spellResults[0];

          // Check each effect for reputation gain (Effect type 193)
          for (let i = 1; i <= 3; i++) {
            const effect = spell[`Effect_${i}`];
            const basePoints = spell[`EffectBasePoints_${i}`];
            const miscValue = spell[`EffectMiscValue_${i}`];

            // Effect 193 = SPELL_EFFECT_REPUTATION_REWARD (WoW 12.0)
            // Effect 103 = SPELL_EFFECT_REPUTATION (legacy, also check for backward compatibility)
            if ((effect === 193 || effect === 103) && miscValue === expectedFactionId) {
              // BasePoints is the reputation amount (usually needs +1)
              return (basePoints || 0) + 1;
            }
          }
        }
      } catch (spellError) {
        continue; // Try next spell
      }
    }

    // If no spell found, use item description parsing as fallback
    const descQuery = `SELECT Description FROM item_template WHERE entry = ?`;
    const descResults = await queryWorld(descQuery, [itemId]);

    if (descResults && descResults.length > 0) {
      const description = descResults[0].Description || "";

      // Parse reputation amounts from description
      // Examples: "Grants 250 reputation", "Increases reputation by 500"
      const repMatch = description.match(/(\d+)\s*reputation/i);
      if (repMatch) {
        return parseInt(repMatch[1], 10);
      }
    }
  } catch (error) {
    logger.warn(`Could not parse reputation gain for item ${itemId}:`, error);
  }

  // Default reputation gains by item quality/level
  return 250; // Common fallback for reputation tokens
}

async function determineRequiredStanding(extendedCost: number): Promise<string> {
  // Parse ExtendedCost from npc_vendor_template or item_extended_cost
  try {
    const query = `
      SELECT RequiredReputationFaction, RequiredReputationRank
      FROM item_extended_cost
      WHERE ID = ?
    `;
    const results = await queryWorld(query, [extendedCost]);

    if (results && results.length > 0) {
      const rank = results[0].RequiredReputationRank;
      // WoW reputation ranks: 0=Hated, 1=Hostile, 2=Unfriendly, 3=Neutral, 4=Friendly, 5=Honored, 6=Revered, 7=Exalted
      const standings = ["hated", "hostile", "unfriendly", "neutral", "friendly", "honored", "revered", "exalted"];
      return standings[rank] || "neutral";
    }
  } catch (e) {
    // Fallback to estimation based on cost
  }

  // Fallback estimation
  if (extendedCost > 10000) return "exalted";
  if (extendedCost > 5000) return "revered";
  if (extendedCost > 1000) return "honored";
  return "friendly";
}

/**
 * Get all factions player should prioritize
 */
export function getRecommendedFactions(playerLevel: number, playerFaction: "alliance" | "horde"): Array<{
  factionId: number;
  name: string;
  reason: string;
  priority: "high" | "medium" | "low";
}> {
  const recommendations: Array<any> = [
    {
      factionId: 2510,
      name: "Council of Dornogal",
      reason: "Current expansion - essential for endgame gear and flying",
      priority: "high"
    },
    {
      factionId: 2507,
      name: "Dream Wardens",
      reason: "Current content - valuable rewards",
      priority: "high"
    },
    {
      factionId: 2103,
      name: "Maruuk Centaur",
      reason: "Previous expansion - mount rewards",
      priority: "medium"
    }
  ];

  return recommendations.filter(r => playerLevel >= 70);
}
