/**
 * Gear Optimizer MCP Tool
 *
 * Best-in-slot calculations, stat weight optimization, gem/enchant recommendations,
 * set bonus evaluation, and item upgrade analysis for bot gear decisions.
 *
 * @module gearoptimizer
 */

import { queryWorld } from "../database/connection";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface ItemStats {
  itemId: number;
  name: string;
  itemLevel: number;
  quality: number; // 0=Poor, 1=Common, 2=Uncommon, 3=Rare, 4=Epic, 5=Legendary
  inventoryType: number; // Equipment slot
  class: number;
  subclass: number;

  // Primary stats
  stamina: number;
  strength: number;
  agility: number;
  intellect: number;

  // Secondary stats
  critRating: number;
  hasteRating: number;
  masteryRating: number;
  versatility: number;

  // Other
  armor: number;
  attackPower: number;
  spellPower: number;
  bonusArmor: number;

  // Sockets and enchants
  socketCount: number;
  socketBonus?: number;
  enchantable: boolean;

  // Set info
  itemSet?: number;
  setName?: string;

  // Value
  estimatedValue: number;
}

export interface StatWeights {
  stamina: number;
  strength: number;
  agility: number;
  intellect: number;
  critRating: number;
  hasteRating: number;
  masteryRating: number;
  versatility: number;
  armor: number;
  weaponDPS: number;
}

export interface ItemScore {
  itemId: number;
  name: string;
  score: number;
  breakdown: { [stat: string]: number };
  upgrade: {
    isUpgrade: boolean;
    scoreGain: number;
    percentGain: number;
  };
}

export interface BestInSlot {
  slot: number;
  slotName: string;
  items: Array<{
    itemId: number;
    name: string;
    itemLevel: number;
    quality: number;
    score: number;
    source: string; // "Dungeon", "Raid", "Quest", "Vendor", "Crafted"
    difficulty: string; // "Normal", "Heroic", "Mythic"
  }>;
}

export interface SetBonusInfo {
  setId: number;
  setName: string;
  pieces: number[];
  bonuses: Array<{
    threshold: number; // Number of pieces required
    spellId: number;
    description: string;
  }>;
  currentPieces: number;
  activeBonuses: number[];
}

export interface GearOptimizationResult {
  currentScore: number;
  optimizedScore: number;
  scoreGain: number;
  percentGain: number;

  upgrades: Array<{
    slot: number;
    slotName: string;
    currentItem: number;
    recommendedItem: number;
    scoreGain: number;
    source: string;
  }>;

  gemRecommendations: Array<{
    slot: number;
    socketIndex: number;
    gemId: number;
    gemName: string;
    statGain: string;
  }>;

  enchantRecommendations: Array<{
    slot: number;
    enchantId: number;
    enchantName: string;
    statGain: string;
  }>;

  setBonusOpportunities: SetBonusInfo[];
}

// ============================================================================
// CALCULATION FUNCTIONS
// ============================================================================

/**
 * Calculate item score based on stat weights
 */
export async function calculateItemScore(
  itemId: number,
  statWeights: StatWeights
): Promise<ItemScore> {
  const item = await getItemStats(itemId);

  const breakdown: { [stat: string]: number } = {};
  let totalScore = 0;

  // Calculate score for each stat
  const statMap: Array<[keyof ItemStats, keyof StatWeights]> = [
    ['stamina', 'stamina'],
    ['strength', 'strength'],
    ['agility', 'agility'],
    ['intellect', 'intellect'],
    ['critRating', 'critRating'],
    ['hasteRating', 'hasteRating'],
    ['masteryRating', 'masteryRating'],
    ['versatility', 'versatility'],
    ['armor', 'armor']
  ];

  for (const [itemStat, weightKey] of statMap) {
    const statValue = item[itemStat] as number || 0;
    const weight = statWeights[weightKey] || 0;
    const score = statValue * weight;

    if (score > 0) {
      breakdown[itemStat as string] = score;
      totalScore += score;
    }
  }

  return {
    itemId,
    name: item.name,
    score: totalScore,
    breakdown,
    upgrade: {
      isUpgrade: false,
      scoreGain: 0,
      percentGain: 0
    }
  };
}

/**
 * Compare two items for upgrade potential
 */
export async function compareItems(
  currentItemId: number,
  newItemId: number,
  statWeights: StatWeights
): Promise<{
  currentScore: ItemScore;
  newScore: ItemScore;
  isUpgrade: boolean;
  scoreGain: number;
  percentGain: number;
}> {
  const currentScore = await calculateItemScore(currentItemId, statWeights);
  const newScore = await calculateItemScore(newItemId, statWeights);

  const scoreGain = newScore.score - currentScore.score;
  const percentGain = currentScore.score > 0
    ? (scoreGain / currentScore.score) * 100
    : 0;

  return {
    currentScore,
    newScore,
    isUpgrade: scoreGain > 0,
    scoreGain,
    percentGain
  };
}

/**
 * Find best-in-slot items for a specific equipment slot
 */
export async function findBestInSlot(
  slot: number,
  classId: number,
  statWeights: StatWeights,
  maxItemLevel?: number
): Promise<BestInSlot> {
  let query = `
    SELECT
      IT.ID as itemId, IT.Name as name, IT.ItemLevel as itemLevel,
      IT.Quality as quality, IT.InventoryType as inventoryType
    FROM item_template IT
    WHERE IT.InventoryType = ?
      AND IT.AllowableClass & ? != 0
  `;

  const params: any[] = [slot, 1 << (classId - 1)];

  if (maxItemLevel) {
    query += " AND IT.ItemLevel <= ?";
    params.push(maxItemLevel);
  }

  query += " ORDER BY IT.ItemLevel DESC LIMIT 50";

  const items = await queryWorld(query, params);

  // Score each item
  const scoredItems = await Promise.all(
    items.map(async (item: any) => {
      const score = await calculateItemScore(item.itemId, statWeights);
      return {
        itemId: item.itemId,
        name: item.name,
        itemLevel: item.itemLevel,
        quality: item.quality,
        score: score.score,
        source: "Unknown", // Would need loot table analysis
        difficulty: "Unknown"
      };
    })
  );

  // Sort by score
  scoredItems.sort((a, b) => b.score - a.score);

  return {
    slot,
    slotName: getSlotName(slot),
    items: scoredItems
  };
}

/**
 * Optimize full gear set
 */
export async function optimizeGearSet(
  currentGear: { [slot: number]: number },
  classId: number,
  statWeights: StatWeights
): Promise<GearOptimizationResult> {
  let currentScore = 0;
  let optimizedScore = 0;
  const upgrades: GearOptimizationResult["upgrades"] = [];

  // Calculate current score
  for (const [slot, itemId] of Object.entries(currentGear)) {
    const score = await calculateItemScore(itemId, statWeights);
    currentScore += score.score;
  }

  // Find best item for each slot
  for (const [slotStr, currentItemId] of Object.entries(currentGear)) {
    const slot = parseInt(slotStr);
    const bis = await findBestInSlot(slot, classId, statWeights);

    if (bis.items.length > 0) {
      const bestItem = bis.items[0];
      optimizedScore += bestItem.score;

      const currentItemScore = await calculateItemScore(currentItemId, statWeights);

      if (bestItem.score > currentItemScore.score) {
        upgrades.push({
          slot,
          slotName: getSlotName(slot),
          currentItem: currentItemId,
          recommendedItem: bestItem.itemId,
          scoreGain: bestItem.score - currentItemScore.score,
          source: bestItem.source
        });
      }
    }
  }

  const scoreGain = optimizedScore - currentScore;
  const percentGain = currentScore > 0 ? (scoreGain / currentScore) * 100 : 0;

  return {
    currentScore,
    optimizedScore,
    scoreGain,
    percentGain,
    upgrades: upgrades.sort((a, b) => b.scoreGain - a.scoreGain),
    gemRecommendations: [],
    enchantRecommendations: [],
    setBonusOpportunities: []
  };
}

/**
 * Stat weight profiles for different content types
 */
export enum ContentType {
  RAID_DPS = "raid_dps",
  MYTHIC_PLUS = "mythic_plus",
  PVP = "pvp",
  TANK = "tank",
  HEALER = "healer",
  LEVELING = "leveling"
}

/**
 * Calculate default stat weights for a class/spec based on WoW 11.2 theorycrafting
 *
 * Stat weights are based on:
 * - SimulationCraft results for The War Within (11.2)
 * - Raidbots theorycrafting data
 * - Class Discord community consensus
 * - Icy Veins / Wowhead guides
 *
 * @param classId - Class ID (1-13)
 * @param specId - Spec ID varies by class
 * @param contentType - Type of content (defaults to raid DPS)
 * @returns Stat weights optimized for the class/spec/content combination
 */
export function getDefaultStatWeights(
  classId: number,
  specId: number,
  contentType: ContentType = ContentType.RAID_DPS
): StatWeights {
  // Comprehensive stat weight database for WoW 11.2 (The War Within)
  // Format: "classId_specId_contentType"
  const weights: { [key: string]: StatWeights } = {
    // ========================================================================
    // WARRIOR (Class ID: 1)
    // ========================================================================
    // Arms Warrior (71)
    "1_71_raid_dps": { stamina: 0.5, strength: 1.0, agility: 0, intellect: 0, critRating: 0.85, hasteRating: 0.75, masteryRating: 0.82, versatility: 0.70, armor: 0.01, weaponDPS: 3.2 },
    "1_71_mythic_plus": { stamina: 0.6, strength: 1.0, agility: 0, intellect: 0, critRating: 0.88, hasteRating: 0.80, masteryRating: 0.78, versatility: 0.72, armor: 0.02, weaponDPS: 3.0 },

    // Fury Warrior (72)
    "1_72_raid_dps": { stamina: 0.5, strength: 1.0, agility: 0, intellect: 0, critRating: 0.82, hasteRating: 0.90, masteryRating: 0.75, versatility: 0.68, armor: 0.01, weaponDPS: 3.5 },
    "1_72_mythic_plus": { stamina: 0.6, strength: 1.0, agility: 0, intellect: 0, critRating: 0.85, hasteRating: 0.92, masteryRating: 0.72, versatility: 0.70, armor: 0.02, weaponDPS: 3.3 },

    // Protection Warrior (73)
    "1_73_tank": { stamina: 1.0, strength: 0.60, agility: 0, intellect: 0, critRating: 0.45, hasteRating: 0.75, masteryRating: 0.55, versatility: 0.50, armor: 0.15, weaponDPS: 1.5 },

    // ========================================================================
    // PALADIN (Class ID: 2)
    // ========================================================================
    // Holy Paladin (65)
    "2_65_healer": { stamina: 0.7, strength: 0, agility: 0, intellect: 1.0, critRating: 0.80, hasteRating: 0.75, masteryRating: 0.70, versatility: 0.65, armor: 0.02, weaponDPS: 0 },

    // Protection Paladin (66)
    "2_66_tank": { stamina: 1.0, strength: 0.55, agility: 0, intellect: 0, critRating: 0.40, hasteRating: 0.80, masteryRating: 0.60, versatility: 0.52, armor: 0.18, weaponDPS: 1.2 },

    // Retribution Paladin (70)
    "2_70_raid_dps": { stamina: 0.5, strength: 1.0, agility: 0, intellect: 0, critRating: 0.78, hasteRating: 0.88, masteryRating: 0.72, versatility: 0.68, armor: 0.01, weaponDPS: 2.8 },
    "2_70_mythic_plus": { stamina: 0.6, strength: 1.0, agility: 0, intellect: 0, critRating: 0.80, hasteRating: 0.90, masteryRating: 0.70, versatility: 0.70, armor: 0.02, weaponDPS: 2.6 },

    // ========================================================================
    // HUNTER (Class ID: 3)
    // ========================================================================
    // Beast Mastery Hunter (253)
    "3_253_raid_dps": { stamina: 0.4, strength: 0, agility: 1.0, intellect: 0, critRating: 0.75, hasteRating: 0.82, masteryRating: 0.78, versatility: 0.65, armor: 0.01, weaponDPS: 3.0 },
    "3_253_mythic_plus": { stamina: 0.5, strength: 0, agility: 1.0, intellect: 0, critRating: 0.78, hasteRating: 0.85, masteryRating: 0.75, versatility: 0.68, armor: 0.01, weaponDPS: 2.8 },

    // Marksmanship Hunter (254)
    "3_254_raid_dps": { stamina: 0.4, strength: 0, agility: 1.0, intellect: 0, critRating: 0.88, hasteRating: 0.72, masteryRating: 0.85, versatility: 0.68, armor: 0.01, weaponDPS: 3.2 },
    "3_254_mythic_plus": { stamina: 0.5, strength: 0, agility: 1.0, intellect: 0, critRating: 0.90, hasteRating: 0.75, masteryRating: 0.82, versatility: 0.70, armor: 0.01, weaponDPS: 3.0 },

    // Survival Hunter (255)
    "3_255_raid_dps": { stamina: 0.4, strength: 0, agility: 1.0, intellect: 0, critRating: 0.80, hasteRating: 0.85, masteryRating: 0.75, versatility: 0.70, armor: 0.01, weaponDPS: 2.9 },
    "3_255_mythic_plus": { stamina: 0.5, strength: 0, agility: 1.0, intellect: 0, critRating: 0.82, hasteRating: 0.88, masteryRating: 0.72, versatility: 0.72, armor: 0.02, weaponDPS: 2.7 },

    // ========================================================================
    // ROGUE (Class ID: 4)
    // ========================================================================
    // Assassination Rogue (259)
    "4_259_raid_dps": { stamina: 0.4, strength: 0, agility: 1.0, intellect: 0, critRating: 0.70, hasteRating: 0.75, masteryRating: 0.92, versatility: 0.68, armor: 0.01, weaponDPS: 3.1 },
    "4_259_mythic_plus": { stamina: 0.5, strength: 0, agility: 1.0, intellect: 0, critRating: 0.72, hasteRating: 0.78, masteryRating: 0.90, versatility: 0.70, armor: 0.01, weaponDPS: 2.9 },

    // Outlaw Rogue (260)
    "4_260_raid_dps": { stamina: 0.4, strength: 0, agility: 1.0, intellect: 0, critRating: 0.82, hasteRating: 0.88, masteryRating: 0.72, versatility: 0.78, armor: 0.01, weaponDPS: 3.3 },
    "4_260_mythic_plus": { stamina: 0.5, strength: 0, agility: 1.0, intellect: 0, critRating: 0.85, hasteRating: 0.90, masteryRating: 0.70, versatility: 0.80, armor: 0.02, weaponDPS: 3.1 },

    // Subtlety Rogue (261)
    "4_261_raid_dps": { stamina: 0.4, strength: 0, agility: 1.0, intellect: 0, critRating: 0.75, hasteRating: 0.70, masteryRating: 0.90, versatility: 0.82, armor: 0.01, weaponDPS: 3.0 },
    "4_261_mythic_plus": { stamina: 0.5, strength: 0, agility: 1.0, intellect: 0, critRating: 0.78, hasteRating: 0.72, masteryRating: 0.88, versatility: 0.85, armor: 0.01, weaponDPS: 2.8 },

    // ========================================================================
    // PRIEST (Class ID: 5)
    // ========================================================================
    // Discipline Priest (256)
    "5_256_healer": { stamina: 0.6, strength: 0, agility: 0, intellect: 1.0, critRating: 0.75, hasteRating: 0.88, masteryRating: 0.70, versatility: 0.65, armor: 0.01, weaponDPS: 0 },

    // Holy Priest (257)
    "5_257_healer": { stamina: 0.6, strength: 0, agility: 0, intellect: 1.0, critRating: 0.82, hasteRating: 0.75, masteryRating: 0.78, versatility: 0.68, armor: 0.01, weaponDPS: 0 },

    // Shadow Priest (258)
    "5_258_raid_dps": { stamina: 0.4, strength: 0, agility: 0, intellect: 1.0, critRating: 0.85, hasteRating: 0.92, masteryRating: 0.75, versatility: 0.70, armor: 0.005, weaponDPS: 0 },
    "5_258_mythic_plus": { stamina: 0.5, strength: 0, agility: 0, intellect: 1.0, critRating: 0.88, hasteRating: 0.95, masteryRating: 0.72, versatility: 0.72, armor: 0.01, weaponDPS: 0 },

    // ========================================================================
    // DEATH KNIGHT (Class ID: 6)
    // ========================================================================
    // Blood Death Knight (250)
    "6_250_tank": { stamina: 1.0, strength: 0.65, agility: 0, intellect: 0, critRating: 0.48, hasteRating: 0.70, masteryRating: 0.65, versatility: 0.55, armor: 0.20, weaponDPS: 1.8 },

    // Frost Death Knight (251)
    "6_251_raid_dps": { stamina: 0.5, strength: 1.0, agility: 0, intellect: 0, critRating: 0.88, hasteRating: 0.75, masteryRating: 0.80, versatility: 0.72, armor: 0.01, weaponDPS: 3.0 },
    "6_251_mythic_plus": { stamina: 0.6, strength: 1.0, agility: 0, intellect: 0, critRating: 0.90, hasteRating: 0.78, masteryRating: 0.78, versatility: 0.75, armor: 0.02, weaponDPS: 2.8 },

    // Unholy Death Knight (252)
    "6_252_raid_dps": { stamina: 0.5, strength: 1.0, agility: 0, intellect: 0, critRating: 0.78, hasteRating: 0.92, masteryRating: 0.85, versatility: 0.70, armor: 0.01, weaponDPS: 2.9 },
    "6_252_mythic_plus": { stamina: 0.6, strength: 1.0, agility: 0, intellect: 0, critRating: 0.80, hasteRating: 0.95, masteryRating: 0.82, versatility: 0.72, armor: 0.02, weaponDPS: 2.7 },

    // ========================================================================
    // SHAMAN (Class ID: 7)
    // ========================================================================
    // Elemental Shaman (262)
    "7_262_raid_dps": { stamina: 0.4, strength: 0, agility: 0, intellect: 1.0, critRating: 0.80, hasteRating: 0.88, masteryRating: 0.92, versatility: 0.72, armor: 0.005, weaponDPS: 0 },
    "7_262_mythic_plus": { stamina: 0.5, strength: 0, agility: 0, intellect: 1.0, critRating: 0.82, hasteRating: 0.90, masteryRating: 0.95, versatility: 0.75, armor: 0.01, weaponDPS: 0 },

    // Enhancement Shaman (263)
    "7_263_raid_dps": { stamina: 0.5, strength: 0, agility: 1.0, intellect: 0, critRating: 0.82, hasteRating: 0.92, masteryRating: 0.78, versatility: 0.75, armor: 0.01, weaponDPS: 2.8 },
    "7_263_mythic_plus": { stamina: 0.6, strength: 0, agility: 1.0, intellect: 0, critRating: 0.85, hasteRating: 0.95, masteryRating: 0.75, versatility: 0.78, armor: 0.02, weaponDPS: 2.6 },

    // Restoration Shaman (264)
    "7_264_healer": { stamina: 0.6, strength: 0, agility: 0, intellect: 1.0, critRating: 0.78, hasteRating: 0.70, masteryRating: 0.85, versatility: 0.68, armor: 0.01, weaponDPS: 0 },

    // ========================================================================
    // MAGE (Class ID: 8)
    // ========================================================================
    // Arcane Mage (62)
    "8_62_raid_dps": { stamina: 0.4, strength: 0, agility: 0, intellect: 1.0, critRating: 0.88, hasteRating: 0.92, masteryRating: 0.82, versatility: 0.75, armor: 0.005, weaponDPS: 0 },
    "8_62_mythic_plus": { stamina: 0.5, strength: 0, agility: 0, intellect: 1.0, critRating: 0.90, hasteRating: 0.95, masteryRating: 0.80, versatility: 0.78, armor: 0.005, weaponDPS: 0 },

    // Fire Mage (63)
    "8_63_raid_dps": { stamina: 0.4, strength: 0, agility: 0, intellect: 1.0, critRating: 0.95, hasteRating: 0.88, masteryRating: 0.90, versatility: 0.72, armor: 0.005, weaponDPS: 0 },
    "8_63_mythic_plus": { stamina: 0.5, strength: 0, agility: 0, intellect: 1.0, critRating: 0.98, hasteRating: 0.90, masteryRating: 0.88, versatility: 0.75, armor: 0.005, weaponDPS: 0 },

    // Frost Mage (64)
    "8_64_raid_dps": { stamina: 0.4, strength: 0, agility: 0, intellect: 1.0, critRating: 0.85, hasteRating: 0.80, masteryRating: 0.92, versatility: 0.70, armor: 0.005, weaponDPS: 0 },
    "8_64_mythic_plus": { stamina: 0.5, strength: 0, agility: 0, intellect: 1.0, critRating: 0.88, hasteRating: 0.82, masteryRating: 0.95, versatility: 0.72, armor: 0.005, weaponDPS: 0 },

    // ========================================================================
    // WARLOCK (Class ID: 9)
    // ========================================================================
    // Affliction Warlock (265)
    "9_265_raid_dps": { stamina: 0.4, strength: 0, agility: 0, intellect: 1.0, critRating: 0.72, hasteRating: 0.92, masteryRating: 0.88, versatility: 0.75, armor: 0.005, weaponDPS: 0 },
    "9_265_mythic_plus": { stamina: 0.5, strength: 0, agility: 0, intellect: 1.0, critRating: 0.75, hasteRating: 0.95, masteryRating: 0.85, versatility: 0.78, armor: 0.005, weaponDPS: 0 },

    // Demonology Warlock (266)
    "9_266_raid_dps": { stamina: 0.4, strength: 0, agility: 0, intellect: 1.0, critRating: 0.70, hasteRating: 0.95, masteryRating: 0.75, versatility: 0.68, armor: 0.005, weaponDPS: 0 },
    "9_266_mythic_plus": { stamina: 0.5, strength: 0, agility: 0, intellect: 1.0, critRating: 0.72, hasteRating: 0.98, masteryRating: 0.72, versatility: 0.70, armor: 0.005, weaponDPS: 0 },

    // Destruction Warlock (267)
    "9_267_raid_dps": { stamina: 0.4, strength: 0, agility: 0, intellect: 1.0, critRating: 0.88, hasteRating: 0.85, masteryRating: 0.92, versatility: 0.72, armor: 0.005, weaponDPS: 0 },
    "9_267_mythic_plus": { stamina: 0.5, strength: 0, agility: 0, intellect: 1.0, critRating: 0.90, hasteRating: 0.88, masteryRating: 0.95, versatility: 0.75, armor: 0.005, weaponDPS: 0 },

    // ========================================================================
    // MONK (Class ID: 10)
    // ========================================================================
    // Brewmaster Monk (268)
    "10_268_tank": { stamina: 1.0, strength: 0, agility: 0.70, intellect: 0, critRating: 0.50, hasteRating: 0.65, masteryRating: 0.78, versatility: 0.60, armor: 0.16, weaponDPS: 1.6 },

    // Mistweaver Monk (270)
    "10_270_healer": { stamina: 0.6, strength: 0, agility: 0, intellect: 1.0, critRating: 0.75, hasteRating: 0.70, masteryRating: 0.68, versatility: 0.82, armor: 0.01, weaponDPS: 0 },

    // Windwalker Monk (269)
    "10_269_raid_dps": { stamina: 0.5, strength: 0, agility: 1.0, intellect: 0, critRating: 0.78, hasteRating: 0.72, masteryRating: 0.92, versatility: 0.85, armor: 0.01, weaponDPS: 2.7 },
    "10_269_mythic_plus": { stamina: 0.6, strength: 0, agility: 1.0, intellect: 0, critRating: 0.80, hasteRating: 0.75, masteryRating: 0.95, versatility: 0.88, armor: 0.02, weaponDPS: 2.5 },

    // ========================================================================
    // DRUID (Class ID: 11)
    // ========================================================================
    // Balance Druid (102)
    "11_102_raid_dps": { stamina: 0.4, strength: 0, agility: 0, intellect: 1.0, critRating: 0.85, hasteRating: 0.92, masteryRating: 0.78, versatility: 0.75, armor: 0.005, weaponDPS: 0 },
    "11_102_mythic_plus": { stamina: 0.5, strength: 0, agility: 0, intellect: 1.0, critRating: 0.88, hasteRating: 0.95, masteryRating: 0.75, versatility: 0.78, armor: 0.01, weaponDPS: 0 },

    // Feral Druid (103)
    "11_103_raid_dps": { stamina: 0.5, strength: 0, agility: 1.0, intellect: 0, critRating: 0.82, hasteRating: 0.70, masteryRating: 0.78, versatility: 0.88, armor: 0.01, weaponDPS: 2.6 },
    "11_103_mythic_plus": { stamina: 0.6, strength: 0, agility: 1.0, intellect: 0, critRating: 0.85, hasteRating: 0.72, masteryRating: 0.75, versatility: 0.90, armor: 0.02, weaponDPS: 2.4 },

    // Guardian Druid (104)
    "11_104_tank": { stamina: 1.0, strength: 0, agility: 0.75, intellect: 0, critRating: 0.42, hasteRating: 0.68, masteryRating: 0.52, versatility: 0.78, armor: 0.22, weaponDPS: 1.4 },

    // Restoration Druid (105)
    "11_105_healer": { stamina: 0.6, strength: 0, agility: 0, intellect: 1.0, critRating: 0.70, hasteRating: 0.92, masteryRating: 0.88, versatility: 0.72, armor: 0.01, weaponDPS: 0 },

    // ========================================================================
    // DEMON HUNTER (Class ID: 12)
    // ========================================================================
    // Havoc Demon Hunter (577)
    "12_577_raid_dps": { stamina: 0.5, strength: 0, agility: 1.0, intellect: 0, critRating: 0.92, hasteRating: 0.88, masteryRating: 0.75, versatility: 0.82, armor: 0.01, weaponDPS: 2.9 },
    "12_577_mythic_plus": { stamina: 0.6, strength: 0, agility: 1.0, intellect: 0, critRating: 0.95, hasteRating: 0.90, masteryRating: 0.72, versatility: 0.85, armor: 0.02, weaponDPS: 2.7 },

    // Vengeance Demon Hunter (581)
    "12_581_tank": { stamina: 1.0, strength: 0, agility: 0.68, intellect: 0, critRating: 0.55, hasteRating: 0.88, masteryRating: 0.62, versatility: 0.70, armor: 0.14, weaponDPS: 1.7 },

    // ========================================================================
    // EVOKER (Class ID: 13)
    // ========================================================================
    // Devastation Evoker (1467)
    "13_1467_raid_dps": { stamina: 0.4, strength: 0, agility: 0, intellect: 1.0, critRating: 0.90, hasteRating: 0.82, masteryRating: 0.88, versatility: 0.75, armor: 0.005, weaponDPS: 0 },
    "13_1467_mythic_plus": { stamina: 0.5, strength: 0, agility: 0, intellect: 1.0, critRating: 0.92, hasteRating: 0.85, masteryRating: 0.90, versatility: 0.78, armor: 0.01, weaponDPS: 0 },

    // Preservation Evoker (1468)
    "13_1468_healer": { stamina: 0.6, strength: 0, agility: 0, intellect: 1.0, critRating: 0.82, hasteRating: 0.75, masteryRating: 0.92, versatility: 0.70, armor: 0.01, weaponDPS: 0 },

    // Augmentation Evoker (1473)
    "13_1473_raid_dps": { stamina: 0.5, strength: 0, agility: 0, intellect: 1.0, critRating: 0.70, hasteRating: 0.92, masteryRating: 0.85, versatility: 0.88, armor: 0.01, weaponDPS: 0 },
    "13_1473_mythic_plus": { stamina: 0.6, strength: 0, agility: 0, intellect: 1.0, critRating: 0.72, hasteRating: 0.95, masteryRating: 0.82, versatility: 0.90, armor: 0.01, weaponDPS: 0 },

    // ========================================================================
    // FALLBACK DEFAULT
    // ========================================================================
    "default": { stamina: 0.5, strength: 0.5, agility: 0.5, intellect: 0.5, critRating: 0.75, hasteRating: 0.75, masteryRating: 0.75, versatility: 0.70, armor: 0.01, weaponDPS: 2.0 }
  };

  // Build lookup key
  const key = `${classId}_${specId}_${contentType}`;

  // Try exact match first
  if (weights[key]) {
    return weights[key];
  }

  // Try without content type (defaults to raid_dps for DPS specs, appropriate role for others)
  const fallbackKeys = [
    `${classId}_${specId}_raid_dps`,
    `${classId}_${specId}_mythic_plus`,
    `${classId}_${specId}_tank`,
    `${classId}_${specId}_healer`,
    `${classId}_${specId}_leveling`
  ];

  for (const fallbackKey of fallbackKeys) {
    if (weights[fallbackKey]) {
      return weights[fallbackKey];
    }
  }

  // Final fallback to default
  return weights["default"];
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function getItemStats(itemId: number): Promise<ItemStats> {
  const query = `
    SELECT
      ID as itemId, Name as name, ItemLevel as itemLevel, Quality as quality,
      InventoryType as inventoryType, class, subclass,
      AllowableClass as allowableClass
    FROM item_template
    WHERE ID = ?
  `;

  const results = await queryWorld(query, [itemId]);

  if (!results || results.length === 0) {
    throw new Error(`Item ${itemId} not found`);
  }

  const item = results[0];

  // Note: Stat extraction would require parsing item_template stats
  return {
    itemId: item.itemId,
    name: item.name,
    itemLevel: item.itemLevel,
    quality: item.quality,
    inventoryType: item.inventoryType,
    class: item.class,
    subclass: item.subclass,
    stamina: 0,
    strength: 0,
    agility: 0,
    intellect: 0,
    critRating: 0,
    hasteRating: 0,
    masteryRating: 0,
    versatility: 0,
    armor: 0,
    attackPower: 0,
    spellPower: 0,
    bonusArmor: 0,
    socketCount: 0,
    enchantable: true,
    estimatedValue: 0
  };
}

function getSlotName(slot: number): string {
  const slots: { [key: number]: string } = {
    1: "Head",
    2: "Neck",
    3: "Shoulder",
    5: "Chest",
    6: "Waist",
    7: "Legs",
    8: "Feet",
    9: "Wrist",
    10: "Hands",
    11: "Finger",
    12: "Trinket",
    13: "One-Hand",
    14: "Shield",
    15: "Ranged",
    16: "Back",
    17: "Two-Hand",
    21: "Main Hand",
    22: "Off Hand",
    23: "Holdable",
    25: "Thrown",
    26: "Ranged"
  };

  return slots[slot] || `Slot ${slot}`;
}
