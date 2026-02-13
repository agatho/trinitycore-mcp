/**
 * Economy Simulation Engine
 *
 * Models supply/demand dynamics and auction house behavior for TrinityCore bots.
 * Provides time-step simulation with price history, market events, crafting
 * profitability, and gold-making optimization.
 *
 * Builds on the static pricing from economy.ts by adding dynamic simulation:
 * - Supply/demand feedback loops that affect prices over time
 * - Auction house listing/buying/expiring cycles
 * - Market events (price spikes, supply shortages, crashes)
 * - Bot economic behavior modeling (farming, crafting, selling)
 * - Price history with trend analysis and forecasting
 *
 * @module tools/economysimulator
 */

import { logger } from "../utils/logger";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/** Market item categories that drive different economic behaviors */
export type ItemCategory =
  | "weapon"
  | "armor"
  | "consumable"
  | "reagent"
  | "trade_good"
  | "gem"
  | "enchant"
  | "recipe"
  | "quest_item"
  | "misc";

/** Price trend direction */
export type PriceTrend = "rising" | "falling" | "stable" | "volatile" | "crashed" | "spiking";

/** Market event types that can be injected into the simulation */
export type MarketEventType =
  | "supply_shortage"
  | "supply_flood"
  | "demand_spike"
  | "demand_crash"
  | "patch_change"
  | "seasonal_event"
  | "bot_farm_wave"
  | "guild_dump";

/** A snapshot of an item's price at a point in time */
export interface PriceSnapshot {
  tick: number;
  price: number;
  supply: number;
  demand: number;
  volume: number;
}

/** Current market state for a single item */
export interface ItemMarketState {
  itemId: number;
  name: string;
  category: ItemCategory;
  basePrice: number;
  currentPrice: number;
  supply: number;
  demand: number;
  volatility: number;
  trend: PriceTrend;
  priceHistory: PriceSnapshot[];
  activeListings: AuctionListing[];
  totalVolume: number;
  lastTradePrice: number;
}

/** An auction house listing */
export interface AuctionListing {
  listingId: string;
  itemId: number;
  quantity: number;
  bidPrice: number;
  buyoutPrice: number;
  sellerId: string;
  expiresAtTick: number;
  createdAtTick: number;
}

/** A completed transaction */
export interface Transaction {
  transactionId: string;
  itemId: number;
  quantity: number;
  price: number;
  buyerId: string;
  sellerId: string;
  tick: number;
  type: "auction" | "vendor" | "trade";
}

/** A market event that affects prices */
export interface MarketEvent {
  eventId: string;
  type: MarketEventType;
  itemId?: number;
  category?: ItemCategory;
  magnitude: number;
  startTick: number;
  durationTicks: number;
  description: string;
}

/** Economic actor (bot or simulated player) */
export interface EconomicActor {
  actorId: string;
  name: string;
  type: "farmer" | "crafter" | "flipper" | "consumer" | "vendor";
  gold: number;
  inventory: Map<number, number>;
  professions: string[];
  level: number;
  behavior: ActorBehavior;
}

/** Behavior configuration for an economic actor */
export interface ActorBehavior {
  buyThreshold: number;
  sellThreshold: number;
  riskTolerance: number;
  farmingRate: number;
  craftingEfficiency: number;
  priceMemoryTicks: number;
}

/** Configuration for a simulation run */
export interface SimulationConfig {
  totalTicks: number;
  tickIntervalLabel: string;
  initialGold: number;
  auctionHouseCut: number;
  listingDurationTicks: number;
  baseInflationRate: number;
  demandElasticity: number;
  supplyElasticity: number;
  volatilityDecay: number;
  enableRandomEvents: boolean;
  randomEventProbability: number;
}

/** Result of a simulation run */
export interface SimulationResult {
  config: SimulationConfig;
  totalTicks: number;
  ticksCompleted: number;
  finalMarketState: ItemMarketState[];
  transactions: Transaction[];
  events: MarketEvent[];
  actors: ActorSummary[];
  analytics: SimulationAnalytics;
  generatedAt: string;
}

/** Summary of an actor's performance */
export interface ActorSummary {
  actorId: string;
  name: string;
  type: string;
  startingGold: number;
  finalGold: number;
  profit: number;
  totalBought: number;
  totalSold: number;
  transactionCount: number;
}

/** Analytics from a simulation run */
export interface SimulationAnalytics {
  totalTransactions: number;
  totalVolume: number;
  totalGoldTraded: number;
  averagePriceChange: number;
  mostVolatileItem: { itemId: number; name: string; volatility: number } | null;
  mostTradedItem: { itemId: number; name: string; volume: number } | null;
  biggestGainer: { itemId: number; name: string; changePercent: number } | null;
  biggestLoser: { itemId: number; name: string; changePercent: number } | null;
  marketHealthScore: number;
  inflationRate: number;
  eventCount: number;
}

/** Price forecast for an item */
export interface PriceForecast {
  itemId: number;
  name: string;
  currentPrice: number;
  forecastedPrices: Array<{ tick: number; price: number; confidence: number }>;
  trend: PriceTrend;
  volatility: number;
  recommendation: "buy" | "sell" | "hold";
  reasoning: string;
}

/** Market dynamics analysis */
export interface MarketDynamics {
  itemId: number;
  name: string;
  supplyDemandRatio: number;
  priceElasticity: number;
  volatilityIndex: number;
  trendStrength: number;
  supportLevel: number;
  resistanceLevel: number;
  averageVolume: number;
  marketEfficiency: number;
}

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

const DEFAULT_CONFIG: SimulationConfig = {
  totalTicks: 168,
  tickIntervalLabel: "1 hour",
  initialGold: 1000_00_00,
  auctionHouseCut: 0.05,
  listingDurationTicks: 48,
  baseInflationRate: 0.001,
  demandElasticity: 0.3,
  supplyElasticity: 0.2,
  volatilityDecay: 0.95,
  enableRandomEvents: true,
  randomEventProbability: 0.03,
};

// ============================================================================
// SAMPLE MARKET ITEMS
// ============================================================================

interface MarketItemDef {
  itemId: number;
  name: string;
  category: ItemCategory;
  basePrice: number;
  baseSupply: number;
  baseDemand: number;
  volatility: number;
}

const MARKET_ITEMS: MarketItemDef[] = [
  { itemId: 2589, name: "Linen Cloth", category: "trade_good", basePrice: 50, baseSupply: 800, baseDemand: 600, volatility: 0.05 },
  { itemId: 2592, name: "Wool Cloth", category: "trade_good", basePrice: 150, baseSupply: 500, baseDemand: 450, volatility: 0.06 },
  { itemId: 4306, name: "Silk Cloth", category: "trade_good", basePrice: 400, baseSupply: 350, baseDemand: 400, volatility: 0.08 },
  { itemId: 4338, name: "Mageweave Cloth", category: "trade_good", basePrice: 800, baseSupply: 200, baseDemand: 300, volatility: 0.10 },
  { itemId: 14047, name: "Runecloth", category: "trade_good", basePrice: 1200, baseSupply: 150, baseDemand: 250, volatility: 0.12 },
  { itemId: 2770, name: "Copper Ore", category: "reagent", basePrice: 30, baseSupply: 900, baseDemand: 500, volatility: 0.04 },
  { itemId: 2771, name: "Tin Ore", category: "reagent", basePrice: 100, baseSupply: 600, baseDemand: 400, volatility: 0.05 },
  { itemId: 2772, name: "Iron Ore", category: "reagent", basePrice: 300, baseSupply: 400, baseDemand: 500, volatility: 0.07 },
  { itemId: 10620, name: "Thorium Ore", category: "reagent", basePrice: 1500, baseSupply: 100, baseDemand: 200, volatility: 0.15 },
  { itemId: 765, name: "Silverleaf", category: "reagent", basePrice: 20, baseSupply: 1000, baseDemand: 300, volatility: 0.03 },
  { itemId: 785, name: "Mageroyal", category: "reagent", basePrice: 80, baseSupply: 600, baseDemand: 500, volatility: 0.06 },
  { itemId: 2449, name: "Earthroot", category: "reagent", basePrice: 40, baseSupply: 700, baseDemand: 350, volatility: 0.04 },
  { itemId: 118, name: "Minor Healing Potion", category: "consumable", basePrice: 25, baseSupply: 500, baseDemand: 700, volatility: 0.08 },
  { itemId: 929, name: "Healing Potion", category: "consumable", basePrice: 200, baseSupply: 300, baseDemand: 500, volatility: 0.10 },
  { itemId: 1710, name: "Greater Healing Potion", category: "consumable", basePrice: 800, baseSupply: 150, baseDemand: 350, volatility: 0.12 },
  { itemId: 6048, name: "Shadow Protection Potion", category: "consumable", basePrice: 500, baseSupply: 80, baseDemand: 120, volatility: 0.15 },
  { itemId: 2454, name: "Elixir of Lion's Strength", category: "consumable", basePrice: 300, baseSupply: 100, baseDemand: 200, volatility: 0.10 },
  { itemId: 774, name: "Malachite", category: "gem", basePrice: 150, baseSupply: 200, baseDemand: 150, volatility: 0.08 },
  { itemId: 1210, name: "Shadowgem", category: "gem", basePrice: 500, baseSupply: 80, baseDemand: 120, volatility: 0.12 },
  { itemId: 1529, name: "Jade", category: "gem", basePrice: 1000, baseSupply: 50, baseDemand: 80, volatility: 0.15 },
];

// ============================================================================
// SIMULATION ENGINE
// ============================================================================

/** Pseudorandom number generator with seed for reproducibility */
class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  next(): number {
    this.seed = (this.seed * 1664525 + 1013904223) & 0xffffffff;
    return (this.seed >>> 0) / 0xffffffff;
  }

  nextInRange(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  nextGaussian(): number {
    const u1 = this.next();
    const u2 = this.next();
    return Math.sqrt(-2 * Math.log(Math.max(u1, 1e-10))) * Math.cos(2 * Math.PI * u2);
  }
}

/**
 * Economy Simulation Engine
 *
 * Runs time-step simulations modeling supply/demand dynamics, auction house
 * behavior, and market events. Each tick represents a configurable time period
 * (default: 1 hour), and the simulation tracks prices, volumes, and actor
 * behavior over the full run.
 */
export class EconomySimulationEngine {
  private config: SimulationConfig;
  private items: Map<number, ItemMarketState>;
  private actors: Map<string, EconomicActor>;
  private transactions: Transaction[];
  private events: MarketEvent[];
  private currentTick: number;
  private rng: SeededRandom;
  private transactionCounter: number;
  private eventCounter: number;

  constructor(config?: Partial<SimulationConfig>, seed?: number) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.items = new Map();
    this.actors = new Map();
    this.transactions = [];
    this.events = [];
    this.currentTick = 0;
    this.rng = new SeededRandom(seed ?? Date.now());
    this.transactionCounter = 0;
    this.eventCounter = 0;
  }

  /**
   * Initialize the simulation with default market items and actors.
   */
  initialize(customItems?: MarketItemDef[]): void {
    const itemDefs = customItems ?? MARKET_ITEMS;

    for (const def of itemDefs) {
      this.items.set(def.itemId, {
        itemId: def.itemId,
        name: def.name,
        category: def.category,
        basePrice: def.basePrice,
        currentPrice: def.basePrice,
        supply: def.baseSupply,
        demand: def.baseDemand,
        volatility: def.volatility,
        trend: "stable",
        priceHistory: [{
          tick: 0,
          price: def.basePrice,
          supply: def.baseSupply,
          demand: def.baseDemand,
          volume: 0,
        }],
        activeListings: [],
        totalVolume: 0,
        lastTradePrice: def.basePrice,
      });
    }

    this.createDefaultActors();
    logger.info(`Economy simulation initialized: ${this.items.size} items, ${this.actors.size} actors`);
  }

  /**
   * Run the full simulation for the configured number of ticks.
   */
  run(): SimulationResult {
    if (this.items.size === 0) {
      this.initialize();
    }

    const startTime = Date.now();
    logger.info(`Starting economy simulation: ${this.config.totalTicks} ticks`);

    for (let i = 0; i < this.config.totalTicks; i++) {
      this.tick();
    }

    const result = this.buildResult();
    logger.info(`Simulation complete: ${this.currentTick} ticks, ${this.transactions.length} transactions in ${Date.now() - startTime}ms`);
    return result;
  }

  /**
   * Advance the simulation by one tick.
   */
  tick(): void {
    this.currentTick++;

    // 1. Generate random market events
    if (this.config.enableRandomEvents && this.rng.next() < this.config.randomEventProbability) {
      this.generateRandomEvent();
    }

    // 2. Apply active events
    this.applyActiveEvents();

    // 3. Update supply and demand
    this.updateSupplyDemand();

    // 4. Process actor behaviors (farming, crafting, listing, buying)
    this.processActorBehaviors();

    // 5. Process auction expirations
    this.processAuctionExpirations();

    // 6. Calculate new prices
    this.updatePrices();

    // 7. Record price snapshots
    this.recordSnapshots();
  }

  /**
   * Inject a market event into the simulation.
   */
  injectEvent(event: Omit<MarketEvent, "eventId">): MarketEvent {
    const fullEvent: MarketEvent = {
      ...event,
      eventId: `evt_${++this.eventCounter}`,
    };
    this.events.push(fullEvent);
    logger.debug(`Market event injected: ${fullEvent.type} - ${fullEvent.description}`);
    return fullEvent;
  }

  /**
   * Get the current market state for an item.
   */
  getItemState(itemId: number): ItemMarketState | null {
    return this.items.get(itemId) ?? null;
  }

  /**
   * Get price history for an item.
   */
  getPriceHistory(itemId: number): PriceSnapshot[] {
    return this.items.get(itemId)?.priceHistory ?? [];
  }

  /**
   * Forecast future prices for an item based on historical trends.
   */
  forecastPrice(itemId: number, futureTicks: number = 24): PriceForecast | null {
    const item = this.items.get(itemId);
    if (!item || item.priceHistory.length < 3) return null;

    const history = item.priceHistory;
    const recentPrices = history.slice(-Math.min(48, history.length));

    // Simple linear regression for trend
    const n = recentPrices.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += recentPrices[i].price;
      sumXY += i * recentPrices[i].price;
      sumXX += i * i;
    }

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Generate forecasted prices
    const forecastedPrices: Array<{ tick: number; price: number; confidence: number }> = [];
    for (let i = 1; i <= futureTicks; i++) {
      const forecastedPrice = Math.max(1, intercept + slope * (n + i));
      const confidence = Math.max(0.1, 1 - (i / futureTicks) * item.volatility * 5);
      forecastedPrices.push({
        tick: this.currentTick + i,
        price: Math.round(forecastedPrice),
        confidence: Math.round(confidence * 100) / 100,
      });
    }

    // Determine recommendation
    const priceChangePercent = ((forecastedPrices[forecastedPrices.length - 1].price - item.currentPrice) / item.currentPrice) * 100;
    let recommendation: "buy" | "sell" | "hold";
    let reasoning: string;

    if (priceChangePercent > 10) {
      recommendation = "buy";
      reasoning = `Price expected to rise ${priceChangePercent.toFixed(1)}% over ${futureTicks} ticks. Supply/demand ratio favors appreciation.`;
    } else if (priceChangePercent < -10) {
      recommendation = "sell";
      reasoning = `Price expected to fall ${Math.abs(priceChangePercent).toFixed(1)}% over ${futureTicks} ticks. Consider selling current holdings.`;
    } else {
      recommendation = "hold";
      reasoning = `Price relatively stable (${priceChangePercent.toFixed(1)}% change expected). No strong signal for buy/sell.`;
    }

    return {
      itemId: item.itemId,
      name: item.name,
      currentPrice: item.currentPrice,
      forecastedPrices,
      trend: item.trend,
      volatility: item.volatility,
      recommendation,
      reasoning,
    };
  }

  /**
   * Analyze market dynamics for an item.
   */
  analyzeMarketDynamics(itemId: number): MarketDynamics | null {
    const item = this.items.get(itemId);
    if (!item) return null;

    const history = item.priceHistory;
    const recentHistory = history.slice(-Math.min(48, history.length));

    // Supply/demand ratio
    const supplyDemandRatio = item.demand > 0 ? item.supply / item.demand : Infinity;

    // Price elasticity (how much price changes when supply changes)
    let priceElasticity = 0;
    if (recentHistory.length >= 2) {
      const first = recentHistory[0];
      const last = recentHistory[recentHistory.length - 1];
      const supplyChange = (last.supply - first.supply) / Math.max(first.supply, 1);
      const priceChange = (last.price - first.price) / Math.max(first.price, 1);
      priceElasticity = supplyChange !== 0 ? priceChange / supplyChange : 0;
    }

    // Volatility index (standard deviation of price changes)
    const priceChanges: number[] = [];
    for (let i = 1; i < recentHistory.length; i++) {
      priceChanges.push((recentHistory[i].price - recentHistory[i - 1].price) / Math.max(recentHistory[i - 1].price, 1));
    }
    const avgChange = priceChanges.length > 0 ? priceChanges.reduce((a, b) => a + b, 0) / priceChanges.length : 0;
    const variance = priceChanges.length > 0
      ? priceChanges.reduce((sum, c) => sum + (c - avgChange) ** 2, 0) / priceChanges.length
      : 0;
    const volatilityIndex = Math.sqrt(variance);

    // Trend strength (absolute slope of linear regression normalized)
    let trendStrength = 0;
    if (recentHistory.length >= 3) {
      const n = recentHistory.length;
      let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
      for (let i = 0; i < n; i++) {
        sumX += i;
        sumY += recentHistory[i].price;
        sumXY += i * recentHistory[i].price;
        sumXX += i * i;
      }
      const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
      trendStrength = Math.abs(slope / Math.max(item.basePrice, 1));
    }

    // Support and resistance levels
    const prices = recentHistory.map(h => h.price);
    const sortedPrices = [...prices].sort((a, b) => a - b);
    const supportLevel = sortedPrices[Math.floor(sortedPrices.length * 0.1)] ?? item.currentPrice;
    const resistanceLevel = sortedPrices[Math.floor(sortedPrices.length * 0.9)] ?? item.currentPrice;

    // Average volume
    const volumes = recentHistory.map(h => h.volume);
    const averageVolume = volumes.length > 0 ? volumes.reduce((a, b) => a + b, 0) / volumes.length : 0;

    // Market efficiency (how close prices stay to theoretical equilibrium)
    const theoreticalPrice = item.basePrice * (item.demand / Math.max(item.supply, 1));
    const marketEfficiency = 1 - Math.abs(item.currentPrice - theoreticalPrice) / Math.max(theoreticalPrice, 1);

    return {
      itemId: item.itemId,
      name: item.name,
      supplyDemandRatio: Math.round(supplyDemandRatio * 100) / 100,
      priceElasticity: Math.round(priceElasticity * 1000) / 1000,
      volatilityIndex: Math.round(volatilityIndex * 10000) / 10000,
      trendStrength: Math.round(trendStrength * 10000) / 10000,
      supportLevel: Math.round(supportLevel),
      resistanceLevel: Math.round(resistanceLevel),
      averageVolume: Math.round(averageVolume),
      marketEfficiency: Math.round(Math.max(0, Math.min(1, marketEfficiency)) * 100) / 100,
    };
  }

  /**
   * Get a snapshot of the full market state.
   */
  getMarketSnapshot(): ItemMarketState[] {
    return Array.from(this.items.values());
  }

  /**
   * Get all transactions.
   */
  getTransactions(): Transaction[] {
    return [...this.transactions];
  }

  /**
   * Get all market events.
   */
  getEvents(): MarketEvent[] {
    return [...this.events];
  }

  /** Get current tick */
  getCurrentTick(): number {
    return this.currentTick;
  }

  // ============================================================================
  // PRIVATE - SIMULATION INTERNALS
  // ============================================================================

  private createDefaultActors(): void {
    const actorDefs: Array<{ id: string; name: string; type: EconomicActor["type"]; behavior: Partial<ActorBehavior> }> = [
      { id: "farmer_1", name: "Material Farmer", type: "farmer", behavior: { farmingRate: 1.2, sellThreshold: 0.85, riskTolerance: 0.3 } },
      { id: "farmer_2", name: "Herb Gatherer", type: "farmer", behavior: { farmingRate: 1.0, sellThreshold: 0.90, riskTolerance: 0.2 } },
      { id: "crafter_1", name: "Alchemist", type: "crafter", behavior: { craftingEfficiency: 1.1, buyThreshold: 1.1, sellThreshold: 0.8, riskTolerance: 0.4 } },
      { id: "crafter_2", name: "Blacksmith", type: "crafter", behavior: { craftingEfficiency: 0.9, buyThreshold: 1.15, sellThreshold: 0.85, riskTolerance: 0.3 } },
      { id: "flipper_1", name: "Market Flipper", type: "flipper", behavior: { buyThreshold: 0.85, sellThreshold: 1.20, riskTolerance: 0.7, priceMemoryTicks: 24 } },
      { id: "consumer_1", name: "Raider", type: "consumer", behavior: { buyThreshold: 1.3, riskTolerance: 0.1, priceMemoryTicks: 6 } },
      { id: "consumer_2", name: "Casual Player", type: "consumer", behavior: { buyThreshold: 1.1, riskTolerance: 0.2, priceMemoryTicks: 12 } },
      { id: "consumer_3", name: "Leveling Bot", type: "consumer", behavior: { buyThreshold: 1.0, riskTolerance: 0.5, priceMemoryTicks: 3 } },
    ];

    const defaultBehavior: ActorBehavior = {
      buyThreshold: 1.0,
      sellThreshold: 1.0,
      riskTolerance: 0.5,
      farmingRate: 1.0,
      craftingEfficiency: 1.0,
      priceMemoryTicks: 12,
    };

    for (const def of actorDefs) {
      this.actors.set(def.id, {
        actorId: def.id,
        name: def.name,
        type: def.type,
        gold: this.config.initialGold,
        inventory: new Map(),
        professions: [],
        level: 80,
        behavior: { ...defaultBehavior, ...def.behavior },
      });
    }
  }

  private generateRandomEvent(): void {
    const eventTypes: MarketEventType[] = [
      "supply_shortage", "supply_flood", "demand_spike", "demand_crash",
      "patch_change", "seasonal_event", "bot_farm_wave", "guild_dump",
    ];
    const type = eventTypes[Math.floor(this.rng.next() * eventTypes.length)];
    const itemEntries = Array.from(this.items.values());
    const targetItem = itemEntries[Math.floor(this.rng.next() * itemEntries.length)];

    const descriptions: Record<MarketEventType, string> = {
      supply_shortage: `Supply shortage for ${targetItem.name} - farmers diverted to new content`,
      supply_flood: `Supply flood of ${targetItem.name} - bots detected farming this material`,
      demand_spike: `Demand spike for ${targetItem.name} - new recipe discovered`,
      demand_crash: `Demand crash for ${targetItem.name} - alternative found`,
      patch_change: `Patch change affecting ${targetItem.name} - stats modified`,
      seasonal_event: `Seasonal event increasing demand for ${targetItem.name}`,
      bot_farm_wave: `Bot farming wave detected - ${targetItem.name} flooding market`,
      guild_dump: `Guild bank dump - large quantities of ${targetItem.name} listed`,
    };

    this.injectEvent({
      type,
      itemId: targetItem.itemId,
      magnitude: this.rng.nextInRange(0.2, 0.8),
      startTick: this.currentTick,
      durationTicks: Math.floor(this.rng.nextInRange(6, 48)),
      description: descriptions[type],
    });
  }

  private applyActiveEvents(): void {
    for (const event of this.events) {
      if (this.currentTick < event.startTick || this.currentTick >= event.startTick + event.durationTicks) {
        continue;
      }

      const progress = (this.currentTick - event.startTick) / event.durationTicks;
      const effectStrength = event.magnitude * Math.sin(progress * Math.PI); // Bell curve effect

      if (event.itemId) {
        const item = this.items.get(event.itemId);
        if (!item) continue;

        switch (event.type) {
          case "supply_shortage":
            item.supply = Math.max(1, item.supply * (1 - effectStrength * 0.3));
            break;
          case "supply_flood":
          case "bot_farm_wave":
          case "guild_dump":
            item.supply *= (1 + effectStrength * 0.5);
            break;
          case "demand_spike":
          case "seasonal_event":
            item.demand *= (1 + effectStrength * 0.4);
            break;
          case "demand_crash":
            item.demand = Math.max(1, item.demand * (1 - effectStrength * 0.3));
            break;
          case "patch_change":
            item.volatility = Math.min(1, item.volatility + effectStrength * 0.2);
            break;
        }
      }
    }
  }

  private updateSupplyDemand(): void {
    for (const item of this.items.values()) {
      // Natural supply/demand drift toward base values
      const supplyDrift = (item.supply - (this.items.get(item.itemId)?.supply ?? item.supply)) * 0.02;
      const demandDrift = (item.demand - (this.items.get(item.itemId)?.demand ?? item.demand)) * 0.02;

      // Add randomness
      const supplyNoise = this.rng.nextGaussian() * item.supply * 0.02;
      const demandNoise = this.rng.nextGaussian() * item.demand * 0.03;

      item.supply = Math.max(1, item.supply - supplyDrift + supplyNoise);
      item.demand = Math.max(1, item.demand - demandDrift + demandNoise);

      // Decay volatility over time
      item.volatility *= this.config.volatilityDecay;
      item.volatility = Math.max(0.01, item.volatility);
    }
  }

  private processActorBehaviors(): void {
    for (const actor of this.actors.values()) {
      switch (actor.type) {
        case "farmer":
          this.processFarmerBehavior(actor);
          break;
        case "crafter":
          this.processCrafterBehavior(actor);
          break;
        case "flipper":
          this.processFlipperBehavior(actor);
          break;
        case "consumer":
          this.processConsumerBehavior(actor);
          break;
      }
    }
  }

  private processFarmerBehavior(actor: EconomicActor): void {
    // Farmers produce materials and sell them
    const farmableItems = Array.from(this.items.values())
      .filter(i => i.category === "reagent" || i.category === "trade_good");

    if (farmableItems.length === 0) return;

    // Pick a random farmable item
    const item = farmableItems[Math.floor(this.rng.next() * farmableItems.length)];
    const quantity = Math.floor(this.rng.nextInRange(1, 5) * actor.behavior.farmingRate);

    // Add to inventory
    const current = actor.inventory.get(item.itemId) ?? 0;
    actor.inventory.set(item.itemId, current + quantity);
    item.supply += quantity;

    // Sell if price is good enough
    if (item.currentPrice >= item.basePrice * actor.behavior.sellThreshold) {
      const sellQty = actor.inventory.get(item.itemId) ?? 0;
      if (sellQty > 0) {
        this.createAuctionListing(actor, item, sellQty);
      }
    }
  }

  private processCrafterBehavior(actor: EconomicActor): void {
    // Crafters buy materials and sell crafted items
    const consumables = Array.from(this.items.values()).filter(i => i.category === "consumable");
    const reagents = Array.from(this.items.values()).filter(i => i.category === "reagent");

    if (consumables.length === 0 || reagents.length === 0) return;

    // Buy cheap reagents
    for (const reagent of reagents) {
      if (reagent.currentPrice <= reagent.basePrice * actor.behavior.buyThreshold && actor.gold > reagent.currentPrice * 5) {
        const buyQty = Math.floor(this.rng.nextInRange(1, 3));
        this.executeTrade(actor, reagent, buyQty, "buy");
      }
    }

    // Craft and sell consumables
    const craftTarget = consumables[Math.floor(this.rng.next() * consumables.length)];
    const craftQty = Math.floor(this.rng.nextInRange(1, 3) * actor.behavior.craftingEfficiency);
    if (craftQty > 0) {
      const current = actor.inventory.get(craftTarget.itemId) ?? 0;
      actor.inventory.set(craftTarget.itemId, current + craftQty);
      if (craftTarget.currentPrice >= craftTarget.basePrice * actor.behavior.sellThreshold) {
        this.createAuctionListing(actor, craftTarget, craftQty);
      }
    }
  }

  private processFlipperBehavior(actor: EconomicActor): void {
    // Flippers buy underpriced items and sell overpriced ones
    for (const item of this.items.values()) {
      const history = item.priceHistory.slice(-actor.behavior.priceMemoryTicks);
      if (history.length < 2) continue;

      const avgPrice = history.reduce((s, h) => s + h.price, 0) / history.length;

      // Buy if price is below average by threshold
      if (item.currentPrice < avgPrice * actor.behavior.buyThreshold && actor.gold > item.currentPrice * 3) {
        const buyQty = Math.floor(this.rng.nextInRange(1, 5));
        this.executeTrade(actor, item, buyQty, "buy");
      }

      // Sell if price is above average by threshold
      const held = actor.inventory.get(item.itemId) ?? 0;
      if (held > 0 && item.currentPrice > avgPrice * actor.behavior.sellThreshold) {
        this.createAuctionListing(actor, item, held);
      }
    }
  }

  private processConsumerBehavior(actor: EconomicActor): void {
    // Consumers buy items they need
    const consumables = Array.from(this.items.values()).filter(i => i.category === "consumable");

    for (const item of consumables) {
      if (this.rng.next() < 0.3 && item.currentPrice <= item.basePrice * actor.behavior.buyThreshold && actor.gold > item.currentPrice) {
        const buyQty = Math.floor(this.rng.nextInRange(1, 3));
        this.executeTrade(actor, item, buyQty, "buy");
      }
    }
  }

  private createAuctionListing(actor: EconomicActor, item: ItemMarketState, quantity: number): void {
    const held = actor.inventory.get(item.itemId) ?? 0;
    const listQty = Math.min(quantity, held);
    if (listQty <= 0) return;

    const priceVariation = 1 + this.rng.nextGaussian() * 0.05;
    const buyoutPrice = Math.max(1, Math.round(item.currentPrice * priceVariation));
    const bidPrice = Math.round(buyoutPrice * 0.8);

    const listing: AuctionListing = {
      listingId: `list_${++this.transactionCounter}`,
      itemId: item.itemId,
      quantity: listQty,
      bidPrice,
      buyoutPrice,
      sellerId: actor.actorId,
      expiresAtTick: this.currentTick + this.config.listingDurationTicks,
      createdAtTick: this.currentTick,
    };

    item.activeListings.push(listing);
    actor.inventory.set(item.itemId, held - listQty);

    // Simulate immediate purchase by checking demand
    if (this.rng.next() < Math.min(0.8, item.demand / (item.supply + item.demand))) {
      this.executeAuctionSale(listing, item, actor);
    }
  }

  private executeAuctionSale(listing: AuctionListing, item: ItemMarketState, seller: EconomicActor): void {
    const revenue = Math.round(listing.buyoutPrice * listing.quantity * (1 - this.config.auctionHouseCut));
    seller.gold += revenue;

    item.demand = Math.max(1, item.demand - listing.quantity * 0.1);
    item.totalVolume += listing.quantity;
    item.lastTradePrice = listing.buyoutPrice;

    // Remove from active listings
    const idx = item.activeListings.indexOf(listing);
    if (idx >= 0) item.activeListings.splice(idx, 1);

    this.transactions.push({
      transactionId: `txn_${++this.transactionCounter}`,
      itemId: item.itemId,
      quantity: listing.quantity,
      price: listing.buyoutPrice,
      buyerId: "market",
      sellerId: seller.actorId,
      tick: this.currentTick,
      type: "auction",
    });
  }

  private executeTrade(actor: EconomicActor, item: ItemMarketState, quantity: number, direction: "buy" | "sell"): void {
    if (direction === "buy") {
      const totalCost = item.currentPrice * quantity;
      if (actor.gold < totalCost) return;

      actor.gold -= totalCost;
      const current = actor.inventory.get(item.itemId) ?? 0;
      actor.inventory.set(item.itemId, current + quantity);
      item.supply = Math.max(0, item.supply - quantity);
      item.totalVolume += quantity;
      item.lastTradePrice = item.currentPrice;

      this.transactions.push({
        transactionId: `txn_${++this.transactionCounter}`,
        itemId: item.itemId,
        quantity,
        price: item.currentPrice,
        buyerId: actor.actorId,
        sellerId: "market",
        tick: this.currentTick,
        type: "trade",
      });
    }
  }

  private processAuctionExpirations(): void {
    for (const item of this.items.values()) {
      const expired = item.activeListings.filter(l => l.expiresAtTick <= this.currentTick);
      for (const listing of expired) {
        // Return items to seller
        const seller = this.actors.get(listing.sellerId);
        if (seller) {
          const current = seller.inventory.get(listing.itemId) ?? 0;
          seller.inventory.set(listing.itemId, current + listing.quantity);
        }
      }
      item.activeListings = item.activeListings.filter(l => l.expiresAtTick > this.currentTick);
    }
  }

  private updatePrices(): void {
    for (const item of this.items.values()) {
      const supplyDemandRatio = item.demand / Math.max(item.supply, 1);

      // Price equilibrium: price adjusts toward supply/demand balance
      const equilibriumPrice = item.basePrice * supplyDemandRatio;
      const priceAdjustment = (equilibriumPrice - item.currentPrice) * this.config.demandElasticity;

      // Add volatility noise
      const noise = this.rng.nextGaussian() * item.currentPrice * item.volatility;

      // Apply inflation
      const inflation = item.currentPrice * this.config.baseInflationRate;

      // New price
      const newPrice = Math.max(1, Math.round(item.currentPrice + priceAdjustment + noise + inflation));
      const priceChange = (newPrice - item.currentPrice) / Math.max(item.currentPrice, 1);

      // Update trend based on recent price movement
      if (Math.abs(priceChange) < 0.01) {
        item.trend = "stable";
      } else if (priceChange > 0.10) {
        item.trend = "spiking";
      } else if (priceChange > 0.02) {
        item.trend = "rising";
      } else if (priceChange < -0.10) {
        item.trend = "crashed";
      } else if (priceChange < -0.02) {
        item.trend = "falling";
      } else {
        item.trend = Math.abs(priceChange) > 0.05 ? "volatile" : item.trend;
      }

      // Update volatility based on price change
      item.volatility = Math.max(0.01, Math.min(1, item.volatility + Math.abs(priceChange) * 0.1));

      item.currentPrice = newPrice;
    }
  }

  private recordSnapshots(): void {
    for (const item of this.items.values()) {
      const tickVolume = this.transactions
        .filter(t => t.itemId === item.itemId && t.tick === this.currentTick)
        .reduce((sum, t) => sum + t.quantity, 0);

      item.priceHistory.push({
        tick: this.currentTick,
        price: item.currentPrice,
        supply: Math.round(item.supply),
        demand: Math.round(item.demand),
        volume: tickVolume,
      });

      // Trim history to last 500 ticks to conserve memory
      if (item.priceHistory.length > 500) {
        item.priceHistory = item.priceHistory.slice(-500);
      }
    }
  }

  private buildResult(): SimulationResult {
    const finalState = Array.from(this.items.values());
    const actorSummaries: ActorSummary[] = Array.from(this.actors.values()).map(actor => {
      const actorTxns = this.transactions.filter(t => t.buyerId === actor.actorId || t.sellerId === actor.actorId);
      const bought = actorTxns.filter(t => t.buyerId === actor.actorId).reduce((s, t) => s + t.quantity, 0);
      const sold = actorTxns.filter(t => t.sellerId === actor.actorId).reduce((s, t) => s + t.quantity, 0);

      return {
        actorId: actor.actorId,
        name: actor.name,
        type: actor.type,
        startingGold: this.config.initialGold,
        finalGold: actor.gold,
        profit: actor.gold - this.config.initialGold,
        totalBought: bought,
        totalSold: sold,
        transactionCount: actorTxns.length,
      };
    });

    const analytics = this.buildAnalytics(finalState);

    return {
      config: this.config,
      totalTicks: this.config.totalTicks,
      ticksCompleted: this.currentTick,
      finalMarketState: finalState.map(item => ({
        ...item,
        priceHistory: item.priceHistory.slice(-50),
        activeListings: [],
      })),
      transactions: this.transactions.slice(-200),
      events: this.events,
      actors: actorSummaries,
      analytics,
      generatedAt: new Date().toISOString(),
    };
  }

  private buildAnalytics(finalState: ItemMarketState[]): SimulationAnalytics {
    const totalTransactions = this.transactions.length;
    const totalVolume = this.transactions.reduce((s, t) => s + t.quantity, 0);
    const totalGoldTraded = this.transactions.reduce((s, t) => s + t.price * t.quantity, 0);

    // Price changes from base
    let totalPriceChange = 0;
    let mostVolatile: SimulationAnalytics["mostVolatileItem"] = null;
    let mostTraded: SimulationAnalytics["mostTradedItem"] = null;
    let biggestGainer: SimulationAnalytics["biggestGainer"] = null;
    let biggestLoser: SimulationAnalytics["biggestLoser"] = null;

    for (const item of finalState) {
      const changePercent = ((item.currentPrice - item.basePrice) / item.basePrice) * 100;
      totalPriceChange += changePercent;

      if (!mostVolatile || item.volatility > mostVolatile.volatility) {
        mostVolatile = { itemId: item.itemId, name: item.name, volatility: Math.round(item.volatility * 1000) / 1000 };
      }
      if (!mostTraded || item.totalVolume > mostTraded.volume) {
        mostTraded = { itemId: item.itemId, name: item.name, volume: item.totalVolume };
      }
      if (!biggestGainer || changePercent > biggestGainer.changePercent) {
        biggestGainer = { itemId: item.itemId, name: item.name, changePercent: Math.round(changePercent * 10) / 10 };
      }
      if (!biggestLoser || changePercent < biggestLoser.changePercent) {
        biggestLoser = { itemId: item.itemId, name: item.name, changePercent: Math.round(changePercent * 10) / 10 };
      }
    }

    const averagePriceChange = finalState.length > 0 ? totalPriceChange / finalState.length : 0;

    // Market health: based on volatility, supply/demand balance, and transaction volume
    const avgVolatility = finalState.reduce((s, i) => s + i.volatility, 0) / Math.max(finalState.length, 1);
    const avgSDRatio = finalState.reduce((s, i) => s + Math.abs(1 - i.supply / Math.max(i.demand, 1)), 0) / Math.max(finalState.length, 1);
    const marketHealthScore = Math.round(Math.max(0, Math.min(100, 100 - avgVolatility * 200 - avgSDRatio * 30)));

    return {
      totalTransactions,
      totalVolume,
      totalGoldTraded,
      averagePriceChange: Math.round(averagePriceChange * 10) / 10,
      mostVolatileItem: mostVolatile,
      mostTradedItem: mostTraded,
      biggestGainer,
      biggestLoser,
      marketHealthScore,
      inflationRate: Math.round(this.config.baseInflationRate * this.currentTick * 10000) / 100,
      eventCount: this.events.length,
    };
  }
}

// ============================================================================
// PUBLIC API FUNCTIONS
// ============================================================================

/**
 * Run a full economy simulation with the given configuration.
 */
export function runEconomySimulation(
  config?: Partial<SimulationConfig>,
  seed?: number
): SimulationResult {
  const engine = new EconomySimulationEngine(config, seed);
  engine.initialize();
  return engine.run();
}

/**
 * Run a simulation and return the price forecast for a specific item.
 */
export function getItemPriceForecast(
  itemId: number,
  simulationTicks: number = 168,
  forecastTicks: number = 24,
  seed?: number
): PriceForecast | null {
  const engine = new EconomySimulationEngine({ totalTicks: simulationTicks }, seed);
  engine.initialize();
  engine.run();
  return engine.forecastPrice(itemId, forecastTicks);
}

/**
 * Run a simulation and analyze market dynamics for a specific item.
 */
export function getItemMarketDynamics(
  itemId: number,
  simulationTicks: number = 168,
  seed?: number
): MarketDynamics | null {
  const engine = new EconomySimulationEngine({ totalTicks: simulationTicks }, seed);
  engine.initialize();
  engine.run();
  return engine.analyzeMarketDynamics(itemId);
}

/**
 * Run a simulation with a market event injected and compare to baseline.
 */
export function simulateMarketEvent(
  eventType: MarketEventType,
  targetItemId: number,
  magnitude: number = 0.5,
  durationTicks: number = 24,
  seed?: number
): {
  baseline: SimulationResult;
  withEvent: SimulationResult;
  impact: {
    priceChange: number;
    priceChangePercent: number;
    volumeChange: number;
    description: string;
  };
} {
  // Run baseline
  const baseSeed = seed ?? Date.now();
  const baseEngine = new EconomySimulationEngine({ totalTicks: 168 }, baseSeed);
  baseEngine.initialize();
  const baseline = baseEngine.run();

  // Run with event
  const eventEngine = new EconomySimulationEngine({ totalTicks: 168 }, baseSeed);
  eventEngine.initialize();

  const itemState = eventEngine.getItemState(targetItemId);
  const itemName = itemState?.name ?? `Item ${targetItemId}`;

  eventEngine.injectEvent({
    type: eventType,
    itemId: targetItemId,
    magnitude,
    startTick: 24,
    durationTicks,
    description: `Simulated ${eventType} for ${itemName}`,
  });

  const withEvent = eventEngine.run();

  // Calculate impact
  const baseItem = baseline.finalMarketState.find(i => i.itemId === targetItemId);
  const eventItem = withEvent.finalMarketState.find(i => i.itemId === targetItemId);

  const priceChange = (eventItem?.currentPrice ?? 0) - (baseItem?.currentPrice ?? 0);
  const priceChangePercent = baseItem?.currentPrice
    ? (priceChange / baseItem.currentPrice) * 100
    : 0;
  const volumeChange = (eventItem?.totalVolume ?? 0) - (baseItem?.totalVolume ?? 0);

  return {
    baseline,
    withEvent,
    impact: {
      priceChange,
      priceChangePercent: Math.round(priceChangePercent * 10) / 10,
      volumeChange,
      description: `${eventType} caused a ${priceChangePercent > 0 ? "+" : ""}${Math.round(priceChangePercent * 10) / 10}% price change for ${itemName} with ${volumeChange > 0 ? "+" : ""}${volumeChange} volume change`,
    },
  };
}

/**
 * Export simulation results as a markdown report.
 */
export function exportSimulationMarkdown(result: SimulationResult): string {
  const lines: string[] = [
    "# Economy Simulation Report",
    "",
    `**Generated:** ${result.generatedAt}`,
    `**Duration:** ${result.ticksCompleted} ticks (${result.config.tickIntervalLabel} per tick)`,
    `**Items:** ${result.finalMarketState.length}`,
    `**Actors:** ${result.actors.length}`,
    "",
    "## Market Analytics",
    "",
    `| Metric | Value |`,
    `|--------|-------|`,
    `| Total Transactions | ${result.analytics.totalTransactions.toLocaleString()} |`,
    `| Total Volume | ${result.analytics.totalVolume.toLocaleString()} units |`,
    `| Total Gold Traded | ${formatCopper(result.analytics.totalGoldTraded)} |`,
    `| Avg Price Change | ${result.analytics.averagePriceChange > 0 ? "+" : ""}${result.analytics.averagePriceChange}% |`,
    `| Market Health | ${result.analytics.marketHealthScore}/100 |`,
    `| Inflation Rate | ${result.analytics.inflationRate}% |`,
    `| Market Events | ${result.analytics.eventCount} |`,
    "",
  ];

  if (result.analytics.mostTradedItem) {
    lines.push(`**Most Traded:** ${result.analytics.mostTradedItem.name} (${result.analytics.mostTradedItem.volume} units)`);
  }
  if (result.analytics.mostVolatileItem) {
    lines.push(`**Most Volatile:** ${result.analytics.mostVolatileItem.name} (volatility: ${result.analytics.mostVolatileItem.volatility})`);
  }
  if (result.analytics.biggestGainer) {
    lines.push(`**Biggest Gainer:** ${result.analytics.biggestGainer.name} (+${result.analytics.biggestGainer.changePercent}%)`);
  }
  if (result.analytics.biggestLoser) {
    lines.push(`**Biggest Loser:** ${result.analytics.biggestLoser.name} (${result.analytics.biggestLoser.changePercent}%)`);
  }

  lines.push("", "## Item Prices", "", "| Item | Base Price | Final Price | Change | Trend | Supply | Demand |", "|------|-----------|------------|--------|-------|--------|--------|");

  for (const item of result.finalMarketState) {
    const change = ((item.currentPrice - item.basePrice) / item.basePrice) * 100;
    const changeStr = `${change > 0 ? "+" : ""}${Math.round(change * 10) / 10}%`;
    lines.push(`| ${item.name} | ${formatCopper(item.basePrice)} | ${formatCopper(item.currentPrice)} | ${changeStr} | ${item.trend} | ${Math.round(item.supply)} | ${Math.round(item.demand)} |`);
  }

  lines.push("", "## Actor Performance", "", "| Actor | Type | Starting Gold | Final Gold | Profit | Transactions |", "|-------|------|--------------|-----------|--------|-------------|");

  for (const actor of result.actors) {
    lines.push(`| ${actor.name} | ${actor.type} | ${formatCopper(actor.startingGold)} | ${formatCopper(actor.finalGold)} | ${formatCopper(actor.profit)} | ${actor.transactionCount} |`);
  }

  if (result.events.length > 0) {
    lines.push("", "## Market Events", "");
    for (const event of result.events) {
      lines.push(`- **Tick ${event.startTick}** (${event.durationTicks} ticks): ${event.description}`);
    }
  }

  return lines.join("\n");
}

/** Format copper value as gold/silver/copper string */
function formatCopper(copper: number): string {
  if (copper < 0) return `-${formatCopper(Math.abs(copper))}`;
  const gold = Math.floor(copper / 10000);
  const silver = Math.floor((copper % 10000) / 100);
  const cop = copper % 100;
  const parts: string[] = [];
  if (gold > 0) parts.push(`${gold}g`);
  if (silver > 0) parts.push(`${silver}s`);
  if (cop > 0 || parts.length === 0) parts.push(`${cop}c`);
  return parts.join(" ");
}
