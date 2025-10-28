/**
 * Economy/Auction House MCP
 *
 * Provides auction house pricing analysis, market value calculations,
 * arbitrage opportunities, profession profitability, and gold-making strategies.
 *
 * @module economy
 */

import { queryWorld } from "../database/connection";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface ItemPricing {
  itemId: number;
  name: string;
  quality: "poor" | "common" | "uncommon" | "rare" | "epic" | "legendary" | "artifact";
  vendorBuyPrice: number; // Copper
  vendorSellPrice: number; // Copper
  marketValue: number; // Estimated AH price in copper
  stackSize: number;
  isTradeable: boolean;
  isCraftable: boolean;
}

export interface AuctionAnalysis {
  itemId: number;
  name: string;
  currentAuctions: number;
  minPrice: number;
  maxPrice: number;
  avgPrice: number;
  medianPrice: number;
  recommendedBuyPrice: number;
  recommendedSellPrice: number;
  profitMargin: number;
  marketTrend: "rising" | "falling" | "stable";
  demandLevel: "very_high" | "high" | "moderate" | "low" | "very_low";
}

export interface ArbitrageOpportunity {
  itemId: number;
  itemName: string;
  buyPrice: number;
  sellPrice: number;
  profit: number;
  profitPercent: number;
  risk: "low" | "medium" | "high";
  reason: string;
  timeToFlip: number; // Estimated hours
}

export interface ProfessionProfitability {
  professionId: number;
  professionName: string;
  recipes: RecipeProfitability[];
  overallScore: number;
  bestRecipe: RecipeProfitability;
  recommendedLevel: number;
}

export interface RecipeProfitability {
  recipeId: number;
  recipeName: string;
  outputItemId: number;
  outputItemName: string;
  craftingCost: number;
  sellPrice: number;
  profit: number;
  profitMargin: number;
  craftTime: number; // seconds
  profitPerHour: number;
  difficulty: "trivial" | "easy" | "medium" | "hard" | "impossible";
  requiredLevel: number;
  requiredSkill: number;
  materials: Array<{
    itemId: number;
    name: string;
    quantity: number;
    cost: number;
  }>;
}

export interface GoldMakingStrategy {
  strategyId: string;
  name: string;
  type: "farming" | "crafting" | "flipping" | "vendor" | "quest" | "daily";
  description: string;
  estimatedGoldPerHour: number;
  requiredLevel: number;
  requiredProfessions: string[];
  difficulty: "easy" | "medium" | "hard";
  initialInvestment: number;
  steps: string[];
  locations?: string[];
}

export interface MarketSupplyDemand {
  itemId: number;
  itemName: string;
  supply: number; // Number of items on AH
  demand: number; // Estimated demand score
  supplyDemandRatio: number;
  priceElasticity: number;
  recommendation: "buy" | "sell" | "hold" | "craft";
  reasoning: string;
}

export interface MaterialFarmingGuide {
  materialId: number;
  materialName: string;
  farmingLocations: Array<{
    zone: string;
    zoneId: number;
    method: "mining" | "herbalism" | "skinning" | "mob_drop" | "quest" | "vendor";
    dropRate: number;
    respawnTime: number;
    competition: "low" | "medium" | "high";
    farmRate: number; // Items per hour
  }>;
  currentPrice: number;
  valuePerHour: number;
  alternativeSources: string[];
}

// ============================================================================
// CORE PRICING FUNCTIONS
// ============================================================================

/**
 * Get item pricing information from database
 */
export async function getItemPricing(itemId: number): Promise<ItemPricing> {
  const query = `
    SELECT
      entry, name, Quality, BuyPrice, SellPrice, stackable,
      Flags, bonding, RequiredLevel
    FROM item_template
    WHERE entry = ?
  `;

  const results = await queryWorld(query, [itemId]);

  if (!results || results.length === 0) {
    throw new Error(`Item ${itemId} not found`);
  }

  const item = results[0];

  // Quality mapping
  const qualityMap: { [key: number]: any } = {
    0: "poor",
    1: "common",
    2: "uncommon",
    3: "rare",
    4: "epic",
    5: "legendary",
    6: "artifact"
  };

  const quality = qualityMap[item.Quality] || "common";

  // Check if item is tradeable (not soulbound)
  const isTradeable = item.bonding !== 1; // 1 = Binds on Pickup

  // Check if item is craftable
  const craftQuery = `
    SELECT COUNT(*) as count
    FROM npc_trainer
    WHERE spell IN (
      SELECT id FROM spell_template WHERE effect_1 = ${itemId} OR effect_2 = ${itemId}
    )
  `;

  let isCraftable = false;
  try {
    const craftResults = await queryWorld(craftQuery, []);
    isCraftable = craftResults && craftResults[0]?.count > 0;
  } catch (e) {
    // Ignore craft check errors
  }

  // Estimate market value (simplified - real implementation would query actual AH data)
  const marketValue = estimateMarketValue(item.BuyPrice, item.SellPrice, quality);

  return {
    itemId: item.entry,
    name: item.name,
    quality,
    vendorBuyPrice: item.BuyPrice || 0,
    vendorSellPrice: item.SellPrice || 0,
    marketValue,
    stackSize: item.stackable || 1,
    isTradeable,
    isCraftable
  };
}

/**
 * Analyze auction house listings for an item
 */
export function analyzeAuctionHouse(
  itemId: number,
  itemName: string,
  auctionListings: Array<{ price: number; quantity: number; timeLeft: number }>
): AuctionAnalysis {
  if (auctionListings.length === 0) {
    return {
      itemId,
      name: itemName,
      currentAuctions: 0,
      minPrice: 0,
      maxPrice: 0,
      avgPrice: 0,
      medianPrice: 0,
      recommendedBuyPrice: 0,
      recommendedSellPrice: 0,
      profitMargin: 0,
      marketTrend: "stable",
      demandLevel: "very_low"
    };
  }

  const prices = auctionListings.map(a => a.price).sort((a, b) => a - b);
  const minPrice = prices[0];
  const maxPrice = prices[prices.length - 1];
  const avgPrice = prices.reduce((sum, p) => sum + p, 0) / prices.length;
  const medianPrice = prices[Math.floor(prices.length / 2)];

  // Calculate recommended prices
  const recommendedBuyPrice = Math.floor(medianPrice * 0.9); // Buy 10% below median
  const recommendedSellPrice = Math.floor(medianPrice * 1.05); // Sell 5% above median
  const profitMargin = ((recommendedSellPrice - recommendedBuyPrice) / recommendedBuyPrice) * 100;

  // Determine market trend (simplified)
  const recentPrices = auctionListings.filter(a => a.timeLeft > 1800); // Last 30min
  let marketTrend: "rising" | "falling" | "stable" = "stable";

  if (recentPrices.length > 3) {
    const recentAvg = recentPrices.reduce((sum, a) => sum + a.price, 0) / recentPrices.length;
    if (recentAvg > avgPrice * 1.1) marketTrend = "rising";
    else if (recentAvg < avgPrice * 0.9) marketTrend = "falling";
  }

  // Determine demand level
  const supply = auctionListings.reduce((sum, a) => sum + a.quantity, 0);
  let demandLevel: AuctionAnalysis["demandLevel"] = "moderate";

  if (supply < 10) demandLevel = "very_high";
  else if (supply < 50) demandLevel = "high";
  else if (supply < 200) demandLevel = "moderate";
  else if (supply < 500) demandLevel = "low";
  else demandLevel = "very_low";

  return {
    itemId,
    name: itemName,
    currentAuctions: auctionListings.length,
    minPrice,
    maxPrice,
    avgPrice: Math.floor(avgPrice),
    medianPrice,
    recommendedBuyPrice,
    recommendedSellPrice,
    profitMargin,
    marketTrend,
    demandLevel
  };
}

/**
 * Find arbitrage opportunities
 */
export function findArbitrageOpportunities(
  auctionData: Array<{ itemId: number; itemName: string; buyPrice: number; sellPrice: number; volume: number }>
): ArbitrageOpportunity[] {
  const opportunities: ArbitrageOpportunity[] = [];

  for (const item of auctionData) {
    const profit = item.sellPrice - item.buyPrice;
    const profitPercent = (profit / item.buyPrice) * 100;

    // Only consider opportunities with >10% profit margin
    if (profitPercent > 10) {
      let risk: "low" | "medium" | "high" = "medium";
      let reason = "Standard flip opportunity";

      // Assess risk based on volume and profit margin
      if (item.volume > 100 && profitPercent > 30) {
        risk = "low";
        reason = "High volume, high margin - safe bet";
      } else if (item.volume < 10 || profitPercent > 100) {
        risk = "high";
        reason = item.volume < 10 ? "Low volume - may be hard to sell" : "Suspiciously high margin - check data";
      }

      // Estimate time to flip based on volume
      const timeToFlip = item.volume > 50 ? 1 : item.volume > 10 ? 4 : 12;

      opportunities.push({
        itemId: item.itemId,
        itemName: item.itemName,
        buyPrice: item.buyPrice,
        sellPrice: item.sellPrice,
        profit,
        profitPercent,
        risk,
        reason,
        timeToFlip
      });
    }
  }

  // Sort by profit potential (considering risk)
  return opportunities.sort((a, b) => {
    const scoreA = a.profitPercent * (a.risk === "low" ? 1.5 : a.risk === "medium" ? 1.0 : 0.5);
    const scoreB = b.profitPercent * (b.risk === "low" ? 1.5 : b.risk === "medium" ? 1.0 : 0.5);
    return scoreB - scoreA;
  });
}

/**
 * Calculate profession profitability
 */
export async function calculateProfessionProfitability(
  professionId: number,
  currentSkillLevel: number
): Promise<ProfessionProfitability> {
  const professionNames: { [key: number]: string } = {
    164: "Blacksmithing",
    165: "Leatherworking",
    171: "Alchemy",
    197: "Tailoring",
    202: "Engineering",
    333: "Enchanting",
    755: "Jewelcrafting",
    773: "Inscription"
  };

  const professionName = professionNames[professionId] || `Profession ${professionId}`;

  // Query recipes for this profession
  const query = `
    SELECT s.id, s.name, s.effect_1 as outputItem
    FROM spell_template s
    WHERE s.skillLine = ?
      AND s.skillLevel <= ?
      AND s.effect_1 > 0
    LIMIT 100
  `;

  const results = await queryWorld(query, [professionId, currentSkillLevel]);
  const recipes: RecipeProfitability[] = [];

  for (const recipe of results) {
    try {
      const profitability = await calculateRecipeProfitability(recipe.id, recipe.name, recipe.outputItem);
      recipes.push(profitability);
    } catch (e) {
      // Skip recipes that can't be calculated
      continue;
    }
  }

  // Find best recipe
  const bestRecipe = recipes.reduce((best, r) =>
    r.profitPerHour > best.profitPerHour ? r : best
    , recipes[0] || {
    recipeId: 0,
    recipeName: "None",
    outputItemId: 0,
    outputItemName: "None",
    craftingCost: 0,
    sellPrice: 0,
    profit: 0,
    profitMargin: 0,
    craftTime: 0,
    profitPerHour: 0,
    difficulty: "impossible" as const,
    requiredLevel: 0,
    requiredSkill: 0,
    materials: []
  });

  // Calculate overall score
  const avgProfitPerHour = recipes.reduce((sum, r) => sum + r.profitPerHour, 0) / recipes.length || 0;
  const overallScore = Math.min(100, Math.floor(avgProfitPerHour / 100));

  return {
    professionId,
    professionName,
    recipes: recipes.sort((a, b) => b.profitPerHour - a.profitPerHour).slice(0, 20), // Top 20
    overallScore,
    bestRecipe,
    recommendedLevel: currentSkillLevel
  };
}

/**
 * Calculate profitability of a single recipe
 */
async function calculateRecipeProfitability(
  recipeId: number,
  recipeName: string,
  outputItemId: number
): Promise<RecipeProfitability> {
  // Get output item info
  const outputItem = await getItemPricing(outputItemId);

  // Get materials (simplified - real implementation would parse spell reagents)
  const materials: RecipeProfitability["materials"] = [];

  // For demo, assume some materials
  const materialIds = [2589, 2592, 2605]; // Example: cloth materials
  let craftingCost = 0;

  for (const matId of materialIds) {
    try {
      const mat = await getItemPricing(matId);
      const quantity = Math.floor(Math.random() * 10) + 1;
      const cost = mat.marketValue * quantity;

      materials.push({
        itemId: matId,
        name: mat.name,
        quantity,
        cost
      });

      craftingCost += cost;
    } catch (e) {
      // Skip materials that can't be loaded
    }
  }

  const sellPrice = outputItem.marketValue;
  const profit = sellPrice - craftingCost;
  const profitMargin = craftingCost > 0 ? (profit / craftingCost) * 100 : 0;

  // Estimate craft time (2-5 seconds per craft)
  const craftTime = 3;
  const profitPerHour = (profit / craftTime) * 3600;

  // Determine difficulty
  let difficulty: RecipeProfitability["difficulty"] = "medium";
  if (materials.length <= 2) difficulty = "easy";
  else if (materials.length >= 5) difficulty = "hard";
  if (profit < 0) difficulty = "impossible";

  return {
    recipeId,
    recipeName,
    outputItemId,
    outputItemName: outputItem.name,
    craftingCost,
    sellPrice,
    profit,
    profitMargin,
    craftTime,
    profitPerHour,
    difficulty,
    requiredLevel: 1,
    requiredSkill: 1,
    materials
  };
}

/**
 * Get gold-making strategies
 */
export function getGoldMakingStrategies(playerLevel: number, professions: string[]): GoldMakingStrategy[] {
  const strategies: GoldMakingStrategy[] = [
    {
      strategyId: "herb_farming",
      name: "Herb Farming Route",
      type: "farming",
      description: "Farm high-value herbs in current level zones",
      estimatedGoldPerHour: 5000,
      requiredLevel: 60,
      requiredProfessions: ["Herbalism"],
      difficulty: "easy",
      initialInvestment: 0,
      steps: [
        "Learn Herbalism if not already known",
        "Identify high-value herbs for your level",
        "Follow optimal farming route",
        "Sell herbs on Auction House"
      ],
      locations: ["Bastion", "Ardenweald", "Revendreth"]
    },
    {
      strategyId: "ore_mining",
      name: "Ore Mining Circuit",
      type: "farming",
      description: "Mine valuable ores and sell raw or smelted",
      estimatedGoldPerHour: 4500,
      requiredLevel: 60,
      requiredProfessions: ["Mining"],
      difficulty: "easy",
      initialInvestment: 0,
      steps: [
        "Learn Mining if not already known",
        "Find ore-rich zones",
        "Mine all nodes along circuit",
        "Smelt if profitable, sell on AH"
      ],
      locations: ["Maldraxxus", "Bastion"]
    },
    {
      strategyId: "ah_flipping",
      name: "Auction House Flipping",
      type: "flipping",
      description: "Buy underpriced items and resell at market value",
      estimatedGoldPerHour: 10000,
      requiredLevel: 1,
      requiredProfessions: [],
      difficulty: "medium",
      initialInvestment: 50000,
      steps: [
        "Research current market prices",
        "Identify underpriced items",
        "Buy low, list at competitive price",
        "Monitor sales and adjust prices"
      ]
    },
    {
      strategyId: "daily_quests",
      name: "Daily Quest Circuit",
      type: "daily",
      description: "Complete all available dailies for guaranteed gold",
      estimatedGoldPerHour: 3000,
      requiredLevel: 70,
      requiredProfessions: [],
      difficulty: "easy",
      initialInvestment: 0,
      steps: [
        "Unlock all daily quest hubs",
        "Complete all dailies efficiently",
        "Sell quest rewards if not needed",
        "Repeat daily for steady income"
      ],
      locations: ["Valdrakken", "Zaralek Cavern"]
    },
    {
      strategyId: "old_raid_farming",
      name: "Legacy Raid Farming",
      type: "farming",
      description: "Solo old raids for transmog and vendor gold",
      estimatedGoldPerHour: 8000,
      requiredLevel: 80,
      requiredProfessions: [],
      difficulty: "easy",
      initialInvestment: 0,
      steps: [
        "Queue for legacy raids (Cataclysm or older)",
        "Clear all bosses",
        "Loot everything",
        "Vendor all items or sell transmog on AH"
      ],
      locations: ["Firelands", "Dragon Soul", "ICC"]
    }
  ];

  // Filter by player level and professions
  return strategies
    .filter(s => playerLevel >= s.requiredLevel)
    .filter(s => s.requiredProfessions.length === 0 || s.requiredProfessions.some(p => professions.includes(p)))
    .sort((a, b) => b.estimatedGoldPerHour - a.estimatedGoldPerHour);
}

/**
 * Analyze market supply and demand
 */
export function analyzeMarketSupplyDemand(
  itemId: number,
  itemName: string,
  currentSupply: number,
  historicalDemand: number,
  currentPrice: number,
  historicalPrice: number
): MarketSupplyDemand {
  // Calculate supply/demand ratio
  const supplyDemandRatio = historicalDemand > 0 ? currentSupply / historicalDemand : 0;

  // Calculate price elasticity (% change in demand / % change in price)
  const priceChange = historicalPrice > 0 ? (currentPrice - historicalPrice) / historicalPrice : 0;
  const demandChange = 0.1; // Simplified - would calculate from historical data
  const priceElasticity = priceChange !== 0 ? demandChange / priceChange : 1;

  // Make recommendation
  let recommendation: "buy" | "sell" | "hold" | "craft" = "hold";
  let reasoning = "Market appears balanced";

  if (supplyDemandRatio < 0.5) {
    // Low supply, high demand
    recommendation = "craft";
    reasoning = "Low supply with high demand - craft and sell for profit";
  } else if (supplyDemandRatio > 2.0) {
    // High supply, low demand
    recommendation = "buy";
    reasoning = "Oversupplied market - good time to buy at low prices";
  } else if (priceChange > 0.2) {
    // Prices rising significantly
    recommendation = "sell";
    reasoning = "Prices rising - sell now before market correction";
  } else if (priceChange < -0.2) {
    // Prices falling significantly
    recommendation = "buy";
    reasoning = "Prices falling - buy low for future profits";
  }

  return {
    itemId,
    itemName,
    supply: currentSupply,
    demand: historicalDemand,
    supplyDemandRatio,
    priceElasticity,
    recommendation,
    reasoning
  };
}

/**
 * Get material farming guide
 */
export async function getMaterialFarmingGuide(materialId: number): Promise<MaterialFarmingGuide> {
  const material = await getItemPricing(materialId);

  // Query for creature drops
  const dropQuery = `
    SELECT ct.entry, ct.name, ct.minlevel, ct.maxlevel, cl.ChanceOrQuestChance as dropRate
    FROM creature_loot_template cl
    JOIN creature_template ct ON ct.lootid = cl.Entry
    WHERE cl.Item = ?
    ORDER BY cl.ChanceOrQuestChance DESC
    LIMIT 10
  `;

  const dropResults = await queryWorld(dropQuery, [materialId]);

  const farmingLocations: MaterialFarmingGuide["farmingLocations"] = [];

  for (const drop of dropResults) {
    // Get creature spawn locations
    const spawnQuery = `
      SELECT DISTINCT c.map, c.zone
      FROM creature c
      WHERE c.id = ?
      LIMIT 5
    `;

    const spawns = await queryWorld(spawnQuery, [drop.entry]);

    for (const spawn of spawns) {
      const dropRate = Math.abs(drop.dropRate); // Remove negative for quest items
      const farmRate = (dropRate / 100) * 20; // Assume 20 kills per hour

      farmingLocations.push({
        zone: `Zone ${spawn.zone}`,
        zoneId: spawn.zone,
        method: "mob_drop",
        dropRate,
        respawnTime: 300, // 5 minutes default
        competition: "medium",
        farmRate
      });
    }
  }

  const valuePerHour = farmingLocations.length > 0
    ? farmingLocations[0].farmRate * material.marketValue
    : 0;

  return {
    materialId,
    materialName: material.name,
    farmingLocations: farmingLocations.slice(0, 5), // Top 5 locations
    currentPrice: material.marketValue,
    valuePerHour,
    alternativeSources: ["Auction House", "Vendor", "Quest Rewards"]
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function estimateMarketValue(vendorBuyPrice: number, vendorSellPrice: number, quality: string): number {
  // Estimate market value based on vendor prices and quality
  // Real implementation would query actual AH data

  const qualityMultiplier: { [key: string]: number } = {
    "poor": 0.5,
    "common": 1.0,
    "uncommon": 2.5,
    "rare": 10.0,
    "epic": 50.0,
    "legendary": 200.0,
    "artifact": 500.0
  };

  const multiplier = qualityMultiplier[quality] || 1.0;
  const baseValue = vendorSellPrice > 0 ? vendorSellPrice : vendorBuyPrice;

  return Math.floor(baseValue * multiplier * 1.5);
}

/**
 * Format copper to gold/silver/copper string
 */
export function formatGold(copper: number): string {
  const gold = Math.floor(copper / 10000);
  const silver = Math.floor((copper % 10000) / 100);
  const copperRem = copper % 100;

  const parts: string[] = [];
  if (gold > 0) parts.push(`${gold}g`);
  if (silver > 0) parts.push(`${silver}s`);
  if (copperRem > 0 || parts.length === 0) parts.push(`${copperRem}c`);

  return parts.join(" ");
}

/**
 * Parse gold string to copper
 */
export function parseGold(goldString: string): number {
  const goldMatch = goldString.match(/(\d+)g/);
  const silverMatch = goldString.match(/(\d+)s/);
  const copperMatch = goldString.match(/(\d+)c/);

  const gold = goldMatch ? parseInt(goldMatch[1]) : 0;
  const silver = silverMatch ? parseInt(silverMatch[1]) : 0;
  const copper = copperMatch ? parseInt(copperMatch[1]) : 0;

  return (gold * 10000) + (silver * 100) + copper;
}
