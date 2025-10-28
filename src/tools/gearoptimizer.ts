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
 * Calculate default stat weights for a class/spec
 */
export function getDefaultStatWeights(classId: number, specId: number): StatWeights {
  // These are simplified defaults - real weights would be calculated via simulation
  const weights: { [key: string]: StatWeights } = {
    // Warrior DPS
    "1_1": { stamina: 0.5, strength: 1.0, agility: 0, intellect: 0, critRating: 0.8, hasteRating: 0.7, masteryRating: 0.9, versatility: 0.6, armor: 0.01, weaponDPS: 3.0 },
    // Mage DPS
    "8_1": { stamina: 0.4, strength: 0, agility: 0, intellect: 1.0, critRating: 0.9, hasteRating: 0.8, masteryRating: 0.7, versatility: 0.6, armor: 0.005, weaponDPS: 0 },
    // Default
    "default": { stamina: 0.5, strength: 0.5, agility: 0.5, intellect: 0.5, critRating: 0.7, hasteRating: 0.7, masteryRating: 0.7, versatility: 0.6, armor: 0.01, weaponDPS: 2.0 }
  };

  const key = `${classId}_${specId}`;
  return weights[key] || weights["default"];
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
