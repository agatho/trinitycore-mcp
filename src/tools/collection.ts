/**
 * Pet/Mount/Toy Collection Manager MCP
 *
 * Provides comprehensive collectible tracking, farming routes, rarity analysis,
 * and completion optimization for pets, mounts, toys, and heirlooms in WoW 12.0.
 *
 * @module collection
 */

import { queryWorld } from "../database/connection";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface CollectionStatus {
  type: "pet" | "mount" | "toy" | "heirloom";
  collected: number;
  total: number;
  percentage: number;
  recentAdditions: CollectibleInfo[];
  missingHighValue: CollectibleInfo[];
  nextTargets: CollectibleInfo[];
}

export interface CollectibleInfo {
  id: number;
  name: string;
  type: "pet" | "mount" | "toy" | "heirloom";
  rarity: "poor" | "common" | "uncommon" | "rare" | "epic" | "legendary";
  source: CollectibleSource;
  dropRate?: number;
  price?: number; // Vendor price in copper
  farmed: boolean;
  difficulty: "trivial" | "easy" | "medium" | "hard" | "very_hard" | "impossible";
  estimatedTime: number; // hours to obtain
  value: number; // Prestige/rarity value
}

export interface CollectibleSource {
  type: "drop" | "vendor" | "achievement" | "quest" | "profession" | "reputation" | "event" | "rare_spawn" | "treasure" | "trading_post";
  location?: string;
  npcId?: number;
  npcName?: string;
  requirementFaction?: number;
  requirementReputation?: string;
  requirementAchievement?: number;
  requirementLevel?: number;
  seasonal?: boolean;
  eventName?: string;
}

export interface FarmingRoute {
  collectibleId: number;
  collectibleName: string;
  type: "pet" | "mount" | "toy";
  locations: FarmingLocation[];
  estimatedTimePerRun: number;
  runsNeeded: number;
  totalTime: number; // hours
  efficiency: number; // 0-100 score
  competition: "none" | "low" | "medium" | "high";
  recommended: boolean;
}

export interface FarmingLocation {
  zoneId: number;
  zoneName: string;
  method: "mob_grind" | "rare_spawn" | "dungeon" | "raid" | "treasure" | "event";
  mobId?: number;
  mobName?: string;
  coords: { x: number; y: number };
  respawnTime: number; // minutes
  dropRate: number; // percentage
  competition: "none" | "low" | "medium" | "high";
  notes: string;
}

export interface RarityAnalysis {
  collectibleId: number;
  collectibleName: string;
  rarity: string;
  obtainability: number; // 0-100, higher = easier
  currentOwners: number; // Estimate of how many players have it
  prestigeValue: number; // 0-100
  exclusivity: "common" | "uncommon" | "rare" | "very_rare" | "unobtainable";
}

export interface CompletionPlan {
  goal: string;
  type: "pet" | "mount" | "toy" | "all";
  currentCount: number;
  targetCount: number;
  missing: CollectibleInfo[];
  prioritized: CollectibleInfo[];
  estimatedTime: number; // hours
  phases: CompletionPhase[];
}

export interface CompletionPhase {
  phaseNumber: number;
  name: string;
  collectibles: number[];
  method: string;
  estimatedTime: number;
  difficulty: string;
}

export interface TradingPostSchedule {
  month: string;
  availableItems: Array<{
    itemId: number;
    itemName: string;
    type: "pet" | "mount" | "toy" | "cosmetic";
    cost: number; // Tender currency
    priority: "high" | "medium" | "low";
  }>;
  tenderRequired: number;
  currentTender: number;
  canAfford: boolean;
}

export interface MountSpeedBonus {
  mounted: boolean;
  groundSpeed: number; // Percentage
  flyingSpeed: number; // Percentage
  swimSpeed: number; // Percentage
  ridingSkill: "apprentice" | "journeyman" | "expert" | "artisan" | "master";
}

export interface PetBattleInfo {
  petId: number;
  petName: string;
  level: number;
  quality: "poor" | "common" | "uncommon" | "rare";
  family: string;
  abilities: number[];
  strong_vs: string[];
  weak_vs: string[];
  pvpRating: number;
  pveRating: number;
}

// ============================================================================
// COLLECTION TRACKING
// ============================================================================

/**
 * Get collection status for a type
 */
export async function getCollectionStatus(
  type: CollectionStatus["type"],
  accountId?: number
): Promise<CollectionStatus> {
  // Query total available collectibles
  let totalQuery = "";

  if (type === "mount") {
    totalQuery = `
      SELECT COUNT(*) as total
      FROM item_template
      WHERE class = 15 AND subclass = 5
    `;
  } else if (type === "pet") {
    totalQuery = `
      SELECT COUNT(*) as total
      FROM battle_pet_species
    `;
  } else if (type === "toy") {
    totalQuery = `
      SELECT COUNT(*) as total
      FROM item_template
      WHERE Flags & 0x8000
    `;
  }

  const totalResults = await queryWorld(totalQuery, []);
  const total = totalResults[0]?.total || 0;

  // Simulate collected count (would query character data in real implementation)
  const collected = Math.floor(total * 0.3); // 30% collected as example

  const percentage = total > 0 ? (collected / total) * 100 : 0;

  return {
    type,
    collected,
    total,
    percentage,
    recentAdditions: [],
    missingHighValue: await getMissingHighValue(type),
    nextTargets: []
  };
}

/**
 * Find missing collectibles by rarity
 */
export async function findMissingCollectibles(
  type: "pet" | "mount" | "toy",
  minRarity: string = "uncommon"
): Promise<CollectibleInfo[]> {
  const missing: CollectibleInfo[] = [];

  if (type === "mount") {
    const query = `
      SELECT entry, name, Quality
      FROM item_template
      WHERE class = 15 AND subclass = 5
      ORDER BY Quality DESC
      LIMIT 50
    `;

    const results = await queryWorld(query, []);

    for (const item of results) {
      const rarity = mapQualityToRarity(item.Quality);

      missing.push({
        id: item.entry,
        name: item.name,
        type: "mount",
        rarity,
        source: {
          type: "drop",
          location: "Various"
        },
        farmed: false,
        difficulty: "medium",
        estimatedTime: 10,
        value: calculateValue(rarity)
      });
    }
  }

  return missing;
}

/**
 * Get farming route for a collectible
 */
export async function getFarmingRoute(collectibleId: number, type: "pet" | "mount" | "toy"): Promise<FarmingRoute> {
  // TrinityCore 12.0.0: lootid now in creature_template_difficulty
  const query = `
    SELECT it.entry, it.name, cl.ChanceOrQuestChance, ct.entry as creatureId, ct.name as creatureName
    FROM item_template it
    LEFT JOIN creature_loot_template cl ON it.entry = cl.Item
    LEFT JOIN creature_template_difficulty ctd ON cl.Entry = ctd.LootID AND ctd.DifficultyID = 0
    LEFT JOIN creature_template ct ON ctd.Entry = ct.entry
    WHERE it.entry = ?
    LIMIT 10
  `;

  const results = await queryWorld(query, [collectibleId]);

  const locations: FarmingLocation[] = [];

  for (const result of results) {
    if (result.creatureId) {
      // Get spawn locations
      const spawnQuery = `
        SELECT map, position_x, position_y
        FROM creature
        WHERE id = ?
        LIMIT 5
      `;

      const spawns = await queryWorld(spawnQuery, [result.creatureId]);

      for (const spawn of spawns) {
        locations.push({
          zoneId: spawn.map,
          zoneName: `Zone ${spawn.map}`,
          method: "mob_grind",
          mobId: result.creatureId,
          mobName: result.creatureName,
          coords: { x: spawn.position_x, y: spawn.position_y },
          respawnTime: 5,
          dropRate: Math.abs(result.ChanceOrQuestChance) || 0.1,
          competition: "medium",
          notes: `Farm ${result.creatureName} for ${result.name}`
        });
      }
    }
  }

  const estimatedTimePerRun = 30; // 30 minutes per farming session
  const avgDropRate = locations.length > 0
    ? locations.reduce((sum, l) => sum + l.dropRate, 0) / locations.length
    : 0.1;

  const runsNeeded = avgDropRate > 0 ? Math.ceil(100 / avgDropRate) : 100;
  const totalTime = (runsNeeded * estimatedTimePerRun) / 60; // hours

  return {
    collectibleId,
    collectibleName: results[0]?.name || `Item ${collectibleId}`,
    type,
    locations,
    estimatedTimePerRun,
    runsNeeded,
    totalTime,
    efficiency: calculateRouteEfficiency(locations, totalTime),
    competition: "medium",
    recommended: totalTime < 20 && locations.length > 0
  };
}

/**
 * Analyze collectible rarity
 */
export function analyzeCollectibleRarity(
  collectibleId: number,
  collectibleName: string,
  dropRate: number,
  source: string
): RarityAnalysis {
  // Calculate obtainability (0-100, higher = easier)
  let obtainability = 100;

  if (source === "raid") obtainability -= 30;
  if (source === "rare_spawn") obtainability -= 20;
  if (source === "event") obtainability -= 40;

  if (dropRate < 1) obtainability -= 50;
  else if (dropRate < 5) obtainability -= 30;
  else if (dropRate < 10) obtainability -= 15;

  obtainability = Math.max(0, obtainability);

  // Estimate current owners (simplified)
  const currentOwners = Math.floor((obtainability / 100) * 1000000);

  // Prestige value (inverse of obtainability)
  const prestigeValue = 100 - obtainability;

  // Exclusivity classification
  let exclusivity: RarityAnalysis["exclusivity"] = "common";
  if (obtainability < 10) exclusivity = "very_rare";
  else if (obtainability < 25) exclusivity = "rare";
  else if (obtainability < 50) exclusivity = "uncommon";

  return {
    collectibleId,
    collectibleName,
    rarity: dropRate < 1 ? "legendary" : dropRate < 5 ? "epic" : "rare",
    obtainability,
    currentOwners,
    prestigeValue,
    exclusivity
  };
}

/**
 * Create completion plan
 */
export async function createCompletionPlan(
  type: "pet" | "mount" | "toy" | "all",
  targetCount?: number
): Promise<CompletionPlan> {
  const status = await getCollectionStatus(type === "all" ? "mount" : type);
  const missing = await findMissingCollectibles(type === "all" ? "mount" : type);

  const target = targetCount || status.total;

  // Prioritize by ease of acquisition
  const prioritized = missing
    .sort((a, b) => a.estimatedTime - b.estimatedTime)
    .slice(0, target - status.collected);

  // Create phases
  const phases: CompletionPhase[] = [];

  // Phase 1: Easy vendor purchases
  const vendorItems = prioritized.filter(c => c.source.type === "vendor");
  if (vendorItems.length > 0) {
    phases.push({
      phaseNumber: 1,
      name: "Vendor Purchases",
      collectibles: vendorItems.map(c => c.id),
      method: "Buy from vendors",
      estimatedTime: vendorItems.length * 0.5,
      difficulty: "trivial"
    });
  }

  // Phase 2: Achievement rewards
  const achievementItems = prioritized.filter(c => c.source.type === "achievement");
  if (achievementItems.length > 0) {
    phases.push({
      phaseNumber: 2,
      name: "Achievement Unlocks",
      collectibles: achievementItems.map(c => c.id),
      method: "Complete achievements",
      estimatedTime: achievementItems.length * 5,
      difficulty: "medium"
    });
  }

  // Phase 3: Farming rare drops
  const farmableItems = prioritized.filter(c => c.source.type === "drop" || c.source.type === "rare_spawn");
  if (farmableItems.length > 0) {
    phases.push({
      phaseNumber: 3,
      name: "Farm Rare Drops",
      collectibles: farmableItems.map(c => c.id),
      method: "Grind for drops",
      estimatedTime: farmableItems.reduce((sum, c) => sum + c.estimatedTime, 0),
      difficulty: "hard"
    });
  }

  const estimatedTime = phases.reduce((sum, p) => sum + p.estimatedTime, 0);

  return {
    goal: `Collect ${target} ${type}s`,
    type,
    currentCount: status.collected,
    targetCount: target,
    missing,
    prioritized,
    estimatedTime,
    phases
  };
}

/**
 * Get Trading Post schedule
 */
export function getTradingPostSchedule(month: string, currentTender: number): TradingPostSchedule {
  // Example Trading Post items
  const schedules: { [key: string]: TradingPostSchedule } = {
    "january": {
      month: "January",
      availableItems: [
        {
          itemId: 190000,
          itemName: "Trading Post Mount",
          type: "mount",
          cost: 900,
          priority: "high"
        },
        {
          itemId: 190001,
          itemName: "Trading Post Pet",
          type: "pet",
          cost: 500,
          priority: "medium"
        }
      ],
      tenderRequired: 900,
      currentTender,
      canAfford: currentTender >= 900
    }
  };

  return schedules[month.toLowerCase()] || {
    month,
    availableItems: [],
    tenderRequired: 0,
    currentTender,
    canAfford: true
  };
}

/**
 * Get mount speed bonuses
 */
export function getMountSpeedBonus(ridingSkill: MountSpeedBonus["ridingSkill"]): MountSpeedBonus {
  const speedBonuses: { [key: string]: { ground: number; flying: number } } = {
    "apprentice": { ground: 60, flying: 0 },
    "journeyman": { ground: 100, flying: 0 },
    "expert": { ground: 100, flying: 150 },
    "artisan": { ground: 100, flying: 280 },
    "master": { ground: 100, flying: 310 }
  };

  const bonus = speedBonuses[ridingSkill] || { ground: 0, flying: 0 };

  return {
    mounted: true,
    groundSpeed: bonus.ground,
    flyingSpeed: bonus.flying,
    swimSpeed: 100,
    ridingSkill
  };
}

/**
 * Get pet battle information
 */
export async function getPetBattleInfo(petId: number): Promise<PetBattleInfo> {
  const query = `
    SELECT id, name, family
    FROM battle_pet_species
    WHERE id = ?
  `;

  const results = await queryWorld(query, [petId]);

  if (!results || results.length === 0) {
    throw new Error(`Pet ${petId} not found`);
  }

  const pet = results[0];

  // Family strengths/weaknesses (Rock-Paper-Scissors)
  const familyCounters: { [key: string]: { strong: string[]; weak: string[] } } = {
    "Beast": { strong: ["Critter"], weak: ["Mechanical"] },
    "Critter": { strong: ["Undead"], weak: ["Beast"] },
    "Undead": { strong: ["Humanoid"], weak: ["Critter"] },
    "Mechanical": { strong: ["Beast"], weak: ["Elemental"] },
    "Elemental": { strong: ["Mechanical"], weak: ["Aquatic"] },
    // ... more families
  };

  const counters = familyCounters[pet.family] || { strong: [], weak: [] };

  return {
    petId: pet.id,
    petName: pet.name,
    level: 25,
    quality: "rare",
    family: pet.family,
    abilities: [],
    strong_vs: counters.strong,
    weak_vs: counters.weak,
    pvpRating: 1500,
    pveRating: 85
  };
}

/**
 * Find pets for pet battle team
 */
export function findPetsForTeam(
  enemyFamily: string,
  strategy: "counter" | "balanced" | "speed"
): Array<{ petId: number; petName: string; reason: string }> {
  const recommendations: Array<{ petId: number; petName: string; reason: string }> = [];

  if (strategy === "counter") {
    // Recommend pets that counter enemy family
    const counterFamilies: { [key: string]: string[] } = {
      "Beast": ["Mechanical"],
      "Critter": ["Beast"],
      "Undead": ["Critter"]
    };

    const counters = counterFamilies[enemyFamily] || [];

    for (const family of counters) {
      recommendations.push({
        petId: 1000,
        petName: `${family} Pet`,
        reason: `Strong vs ${enemyFamily}`
      });
    }
  }

  return recommendations;
}

/**
 * Track seasonal/limited collectibles
 */
export function getSeasonalCollectibles(
  event: "darkmoon_faire" | "hallows_end" | "winter_veil" | "love_is_in_air"
): Array<{ collectibleId: number; collectibleName: string; type: string; availability: string }> {
  const seasonalItems: { [key: string]: Array<any> } = {
    "darkmoon_faire": [
      {
        collectibleId: 73766,
        collectibleName: "Darkmoon Dancing Bear",
        type: "mount",
        availability: "Monthly (first week)"
      }
    ],
    "hallows_end": [
      {
        collectibleId: 33154,
        collectibleName: "Sinister Squashling",
        type: "pet",
        availability: "October only"
      }
    ]
  };

  return seasonalItems[event] || [];
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function mapQualityToRarity(quality: number): CollectibleInfo["rarity"] {
  const rarityMap: { [key: number]: CollectibleInfo["rarity"] } = {
    0: "poor",
    1: "common",
    2: "uncommon",
    3: "rare",
    4: "epic",
    5: "legendary"
  };

  return rarityMap[quality] || "common";
}

function calculateValue(rarity: string): number {
  const values: { [key: string]: number } = {
    "poor": 10,
    "common": 25,
    "uncommon": 50,
    "rare": 75,
    "epic": 90,
    "legendary": 100
  };

  return values[rarity] || 50;
}

async function getMissingHighValue(type: string): Promise<CollectibleInfo[]> {
  // Return top missing high-value collectibles
  return [];
}

function calculateRouteEfficiency(locations: FarmingLocation[], totalTime: number): number {
  if (locations.length === 0) return 0;

  const avgDropRate = locations.reduce((sum, l) => sum + l.dropRate, 0) / locations.length;
  const baseScore = Math.min(100, avgDropRate * 10);
  const timeScore = Math.max(0, 100 - totalTime);

  return (baseScore + timeScore) / 2;
}
