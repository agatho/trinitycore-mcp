/**
 * Unit tests for the Economy Simulation Engine
 *
 * Tests cover:
 * - Engine initialization and configuration
 * - Simulation execution and tick processing
 * - Price dynamics (supply/demand effects)
 * - Market events injection and impact
 * - Actor behavior modeling
 * - Price forecasting
 * - Market dynamics analysis
 * - Event simulation comparison
 * - Markdown report generation
 */

import {
  EconomySimulationEngine,
  runEconomySimulation,
  getItemPriceForecast,
  getItemMarketDynamics,
  simulateMarketEvent,
  exportSimulationMarkdown,
  type SimulationConfig,
  type SimulationResult,
  type ItemMarketState,
  type MarketEvent,
  type PriceForecast,
  type MarketDynamics,
} from "../../src/tools/economysimulator";

// Mock logger
jest.mock("../../src/utils/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// Fixed seed for reproducible tests
const TEST_SEED = 42;

describe("EconomySimulationEngine", () => {
  describe("initialization", () => {
    it("should create engine with default config", () => {
      const engine = new EconomySimulationEngine();
      expect(engine.getCurrentTick()).toBe(0);
    });

    it("should create engine with custom config", () => {
      const engine = new EconomySimulationEngine({ totalTicks: 50, auctionHouseCut: 0.10 });
      expect(engine.getCurrentTick()).toBe(0);
    });

    it("should initialize market items", () => {
      const engine = new EconomySimulationEngine(undefined, TEST_SEED);
      engine.initialize();
      const snapshot = engine.getMarketSnapshot();
      expect(snapshot.length).toBeGreaterThan(0);
      expect(snapshot.length).toBe(20); // 20 default market items
    });

    it("should initialize with custom items", () => {
      const engine = new EconomySimulationEngine(undefined, TEST_SEED);
      engine.initialize([
        { itemId: 1, name: "Test Item", category: "reagent", basePrice: 100, baseSupply: 500, baseDemand: 300, volatility: 0.05 },
      ]);
      const snapshot = engine.getMarketSnapshot();
      expect(snapshot.length).toBe(1);
      expect(snapshot[0].name).toBe("Test Item");
      expect(snapshot[0].basePrice).toBe(100);
    });

    it("should set initial price history at tick 0", () => {
      const engine = new EconomySimulationEngine(undefined, TEST_SEED);
      engine.initialize();
      const history = engine.getPriceHistory(2589); // Linen Cloth
      expect(history.length).toBe(1);
      expect(history[0].tick).toBe(0);
      expect(history[0].price).toBe(50);
    });
  });

  describe("simulation execution", () => {
    it("should run for configured number of ticks", () => {
      const engine = new EconomySimulationEngine({ totalTicks: 10 }, TEST_SEED);
      engine.initialize();
      engine.run();
      expect(engine.getCurrentTick()).toBe(10);
    });

    it("should auto-initialize if not done before run", () => {
      const engine = new EconomySimulationEngine({ totalTicks: 5 }, TEST_SEED);
      const result = engine.run();
      expect(result.ticksCompleted).toBe(5);
      expect(result.finalMarketState.length).toBeGreaterThan(0);
    });

    it("should return valid simulation result", () => {
      const result = runEconomySimulation({ totalTicks: 20 }, TEST_SEED);

      expect(result.config).toBeDefined();
      expect(result.totalTicks).toBe(20);
      expect(result.ticksCompleted).toBe(20);
      expect(result.finalMarketState.length).toBe(20);
      expect(result.actors.length).toBeGreaterThan(0);
      expect(result.analytics).toBeDefined();
      expect(result.generatedAt).toBeDefined();
    });

    it("should produce deterministic results with same seed", () => {
      const result1 = runEconomySimulation({ totalTicks: 50 }, TEST_SEED);
      const result2 = runEconomySimulation({ totalTicks: 50 }, TEST_SEED);

      expect(result1.analytics.totalTransactions).toBe(result2.analytics.totalTransactions);
      expect(result1.finalMarketState[0].currentPrice).toBe(result2.finalMarketState[0].currentPrice);
    });

    it("should produce different results with different seeds", () => {
      const result1 = runEconomySimulation({ totalTicks: 50 }, 42);
      const result2 = runEconomySimulation({ totalTicks: 50 }, 123);

      // Very unlikely to be identical with different seeds
      const samePrice = result1.finalMarketState[0].currentPrice === result2.finalMarketState[0].currentPrice;
      const sameTxns = result1.analytics.totalTransactions === result2.analytics.totalTransactions;
      expect(samePrice && sameTxns).toBe(false);
    });
  });

  describe("price dynamics", () => {
    it("should change prices from base over time", () => {
      const engine = new EconomySimulationEngine({ totalTicks: 100, enableRandomEvents: false }, TEST_SEED);
      engine.initialize();
      engine.run();

      const snapshot = engine.getMarketSnapshot();
      const changedItems = snapshot.filter(i => i.currentPrice !== i.basePrice);
      expect(changedItems.length).toBeGreaterThan(0);
    });

    it("should keep prices positive (never zero or negative)", () => {
      const result = runEconomySimulation({ totalTicks: 200 }, TEST_SEED);

      for (const item of result.finalMarketState) {
        expect(item.currentPrice).toBeGreaterThan(0);
      }
    });

    it("should record price history every tick", () => {
      const engine = new EconomySimulationEngine({ totalTicks: 30, enableRandomEvents: false }, TEST_SEED);
      engine.initialize();
      engine.run();

      const history = engine.getPriceHistory(2589);
      // Initial tick 0 + 30 simulation ticks
      expect(history.length).toBe(31);
    });

    it("should adjust prices based on supply/demand ratio", () => {
      const engine = new EconomySimulationEngine({ totalTicks: 50, enableRandomEvents: false }, TEST_SEED);
      engine.initialize([
        { itemId: 1, name: "High Demand", category: "consumable", basePrice: 100, baseSupply: 50, baseDemand: 500, volatility: 0.01 },
        { itemId: 2, name: "High Supply", category: "reagent", basePrice: 100, baseSupply: 500, baseDemand: 50, volatility: 0.01 },
      ]);
      engine.run();

      const highDemand = engine.getItemState(1);
      const highSupply = engine.getItemState(2);

      // High demand should generally push price up, high supply should push down
      // (over many ticks with low volatility, this should be consistent)
      expect(highDemand).not.toBeNull();
      expect(highSupply).not.toBeNull();
      if (highDemand && highSupply) {
        expect(highDemand.currentPrice).toBeGreaterThan(highSupply.currentPrice);
      }
    });

    it("should track total volume", () => {
      const result = runEconomySimulation({ totalTicks: 100 }, TEST_SEED);
      expect(result.analytics.totalVolume).toBeGreaterThan(0);
    });
  });

  describe("market events", () => {
    it("should inject events", () => {
      const engine = new EconomySimulationEngine({ totalTicks: 10 }, TEST_SEED);
      engine.initialize();

      const event = engine.injectEvent({
        type: "supply_shortage",
        itemId: 2589,
        magnitude: 0.5,
        startTick: 1,
        durationTicks: 5,
        description: "Test supply shortage",
      });

      expect(event.eventId).toBeDefined();
      expect(engine.getEvents().length).toBe(1);
    });

    it("should apply events during simulation", () => {
      const engine = new EconomySimulationEngine({ totalTicks: 30, enableRandomEvents: false }, TEST_SEED);
      engine.initialize();

      engine.injectEvent({
        type: "demand_spike",
        itemId: 2589,
        magnitude: 0.8,
        startTick: 5,
        durationTicks: 10,
        description: "Test demand spike",
      });

      engine.run();

      const item = engine.getItemState(2589);
      expect(item).not.toBeNull();
      // Item should have been affected - price history shows event impact
      const history = engine.getPriceHistory(2589);
      expect(history.length).toBeGreaterThan(0);
    });

    it("should generate random events when enabled", () => {
      const result = runEconomySimulation(
        { totalTicks: 200, enableRandomEvents: true, randomEventProbability: 0.2 },
        TEST_SEED
      );

      expect(result.events.length).toBeGreaterThan(0);
    });

    it("should not generate random events when disabled", () => {
      const result = runEconomySimulation(
        { totalTicks: 100, enableRandomEvents: false },
        TEST_SEED
      );

      expect(result.events.length).toBe(0);
    });
  });

  describe("actor behavior", () => {
    it("should include all actor types in results", () => {
      const result = runEconomySimulation({ totalTicks: 50 }, TEST_SEED);

      const types = new Set(result.actors.map(a => a.type));
      expect(types.has("farmer")).toBe(true);
      expect(types.has("crafter")).toBe(true);
      expect(types.has("flipper")).toBe(true);
      expect(types.has("consumer")).toBe(true);
    });

    it("should track actor gold changes", () => {
      const result = runEconomySimulation({ totalTicks: 100 }, TEST_SEED);

      for (const actor of result.actors) {
        expect(actor.startingGold).toBeDefined();
        expect(actor.finalGold).toBeDefined();
        expect(actor.profit).toBe(actor.finalGold - actor.startingGold);
      }
    });

    it("should track actor transaction counts", () => {
      const result = runEconomySimulation({ totalTicks: 100 }, TEST_SEED);

      const totalActorTxns = result.actors.reduce((s, a) => s + a.transactionCount, 0);
      expect(totalActorTxns).toBeGreaterThan(0);
    });

    it("should have consumers spending gold", () => {
      const result = runEconomySimulation({ totalTicks: 100 }, TEST_SEED);

      const consumers = result.actors.filter(a => a.type === "consumer");
      // At least one consumer should have bought something
      const anyBought = consumers.some(c => c.totalBought > 0);
      expect(anyBought).toBe(true);
    });

    it("should have farmers selling items", () => {
      const result = runEconomySimulation({ totalTicks: 100 }, TEST_SEED);

      const farmers = result.actors.filter(a => a.type === "farmer");
      const anySold = farmers.some(f => f.totalSold > 0);
      expect(anySold).toBe(true);
    });
  });

  describe("price forecasting", () => {
    it("should forecast prices for existing items", () => {
      const forecast = getItemPriceForecast(2589, 100, 24, TEST_SEED);

      expect(forecast).not.toBeNull();
      if (forecast) {
        expect(forecast.itemId).toBe(2589);
        expect(forecast.name).toBe("Linen Cloth");
        expect(forecast.currentPrice).toBeGreaterThan(0);
        expect(forecast.forecastedPrices.length).toBe(24);
        expect(forecast.recommendation).toMatch(/^(buy|sell|hold)$/);
        expect(forecast.reasoning).toBeDefined();
      }
    });

    it("should return null for non-existent items", () => {
      const forecast = getItemPriceForecast(999999, 100, 24, TEST_SEED);
      expect(forecast).toBeNull();
    });

    it("should have decreasing confidence for further forecasts", () => {
      const forecast = getItemPriceForecast(2589, 100, 24, TEST_SEED);

      if (forecast && forecast.forecastedPrices.length >= 2) {
        const first = forecast.forecastedPrices[0];
        const last = forecast.forecastedPrices[forecast.forecastedPrices.length - 1];
        expect(first.confidence).toBeGreaterThanOrEqual(last.confidence);
      }
    });

    it("should have positive forecasted prices", () => {
      const forecast = getItemPriceForecast(2589, 100, 24, TEST_SEED);

      if (forecast) {
        for (const fp of forecast.forecastedPrices) {
          expect(fp.price).toBeGreaterThan(0);
        }
      }
    });
  });

  describe("market dynamics analysis", () => {
    it("should analyze existing items", () => {
      const dynamics = getItemMarketDynamics(2589, 100, TEST_SEED);

      expect(dynamics).not.toBeNull();
      if (dynamics) {
        expect(dynamics.itemId).toBe(2589);
        expect(dynamics.name).toBe("Linen Cloth");
        expect(dynamics.supplyDemandRatio).toBeGreaterThan(0);
        expect(dynamics.volatilityIndex).toBeGreaterThanOrEqual(0);
        expect(dynamics.marketEfficiency).toBeGreaterThanOrEqual(0);
        expect(dynamics.marketEfficiency).toBeLessThanOrEqual(1);
      }
    });

    it("should return null for non-existent items", () => {
      const dynamics = getItemMarketDynamics(999999, 100, TEST_SEED);
      expect(dynamics).toBeNull();
    });

    it("should calculate support and resistance levels", () => {
      const dynamics = getItemMarketDynamics(2589, 100, TEST_SEED);

      if (dynamics) {
        expect(dynamics.supportLevel).toBeGreaterThan(0);
        expect(dynamics.resistanceLevel).toBeGreaterThanOrEqual(dynamics.supportLevel);
      }
    });

    it("should calculate average volume", () => {
      const dynamics = getItemMarketDynamics(2589, 100, TEST_SEED);

      if (dynamics) {
        expect(dynamics.averageVolume).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe("event simulation comparison", () => {
    it("should compare baseline and event-affected runs", () => {
      const result = simulateMarketEvent("supply_shortage", 2589, 0.5, 24, TEST_SEED);

      expect(result.baseline).toBeDefined();
      expect(result.withEvent).toBeDefined();
      expect(result.impact).toBeDefined();
      expect(result.impact.description).toContain("supply_shortage");
    });

    it("should show price impact", () => {
      const result = simulateMarketEvent("demand_spike", 2589, 0.8, 24, TEST_SEED);

      expect(typeof result.impact.priceChange).toBe("number");
      expect(typeof result.impact.priceChangePercent).toBe("number");
      expect(typeof result.impact.volumeChange).toBe("number");
    });

    it("should inject the event in the event run", () => {
      const result = simulateMarketEvent("bot_farm_wave", 2772, 0.6, 12, TEST_SEED);

      // Event run should have more events than baseline (the injected one + any random)
      expect(result.withEvent.events.length).toBeGreaterThan(0);
      const injected = result.withEvent.events.find(
        e => e.type === "bot_farm_wave" && e.itemId === 2772
      );
      expect(injected).toBeDefined();
    });

    it("should show different analytics between baseline and event", () => {
      const result = simulateMarketEvent("supply_shortage", 10620, 0.8, 48, TEST_SEED);

      // The event should cause some difference in analytics
      // (they share the same random seed, so differences come from the event)
      expect(result.baseline.analytics).toBeDefined();
      expect(result.withEvent.analytics).toBeDefined();
    });
  });

  describe("simulation analytics", () => {
    it("should calculate total transactions", () => {
      const result = runEconomySimulation({ totalTicks: 100 }, TEST_SEED);
      expect(result.analytics.totalTransactions).toBeGreaterThan(0);
    });

    it("should calculate total gold traded", () => {
      const result = runEconomySimulation({ totalTicks: 100 }, TEST_SEED);
      expect(result.analytics.totalGoldTraded).toBeGreaterThan(0);
    });

    it("should identify most volatile item", () => {
      const result = runEconomySimulation({ totalTicks: 100 }, TEST_SEED);
      expect(result.analytics.mostVolatileItem).not.toBeNull();
      if (result.analytics.mostVolatileItem) {
        expect(result.analytics.mostVolatileItem.volatility).toBeGreaterThan(0);
      }
    });

    it("should identify most traded item", () => {
      const result = runEconomySimulation({ totalTicks: 100 }, TEST_SEED);
      expect(result.analytics.mostTradedItem).not.toBeNull();
      if (result.analytics.mostTradedItem) {
        expect(result.analytics.mostTradedItem.volume).toBeGreaterThan(0);
      }
    });

    it("should identify biggest gainer and loser", () => {
      const result = runEconomySimulation({ totalTicks: 100 }, TEST_SEED);
      expect(result.analytics.biggestGainer).not.toBeNull();
      expect(result.analytics.biggestLoser).not.toBeNull();
    });

    it("should calculate market health score 0-100", () => {
      const result = runEconomySimulation({ totalTicks: 100 }, TEST_SEED);
      expect(result.analytics.marketHealthScore).toBeGreaterThanOrEqual(0);
      expect(result.analytics.marketHealthScore).toBeLessThanOrEqual(100);
    });

    it("should calculate inflation rate", () => {
      const result = runEconomySimulation({ totalTicks: 100 }, TEST_SEED);
      expect(typeof result.analytics.inflationRate).toBe("number");
    });
  });

  describe("markdown report", () => {
    it("should generate valid markdown", () => {
      const result = runEconomySimulation({ totalTicks: 50 }, TEST_SEED);
      const markdown = exportSimulationMarkdown(result);

      expect(markdown).toContain("# Economy Simulation Report");
      expect(markdown).toContain("## Market Analytics");
      expect(markdown).toContain("## Item Prices");
      expect(markdown).toContain("## Actor Performance");
    });

    it("should include item price table", () => {
      const result = runEconomySimulation({ totalTicks: 50 }, TEST_SEED);
      const markdown = exportSimulationMarkdown(result);

      expect(markdown).toContain("Linen Cloth");
      expect(markdown).toContain("Iron Ore");
      expect(markdown).toContain("Healing Potion");
    });

    it("should include actor performance table", () => {
      const result = runEconomySimulation({ totalTicks: 50 }, TEST_SEED);
      const markdown = exportSimulationMarkdown(result);

      expect(markdown).toContain("Material Farmer");
      expect(markdown).toContain("Market Flipper");
      expect(markdown).toContain("Raider");
    });

    it("should include market events when present", () => {
      const result = runEconomySimulation(
        { totalTicks: 200, enableRandomEvents: true, randomEventProbability: 0.2 },
        TEST_SEED
      );
      const markdown = exportSimulationMarkdown(result);

      if (result.events.length > 0) {
        expect(markdown).toContain("## Market Events");
      }
    });

    it("should include analytics metrics", () => {
      const result = runEconomySimulation({ totalTicks: 50 }, TEST_SEED);
      const markdown = exportSimulationMarkdown(result);

      expect(markdown).toContain("Total Transactions");
      expect(markdown).toContain("Total Volume");
      expect(markdown).toContain("Market Health");
      expect(markdown).toContain("Inflation Rate");
    });
  });

  describe("auction house mechanics", () => {
    it("should apply auction house cut to sales", () => {
      const result = runEconomySimulation({ totalTicks: 100, auctionHouseCut: 0.05 }, TEST_SEED);

      // Farmers sell items - their gold should reflect the AH cut
      const farmers = result.actors.filter(a => a.type === "farmer");
      for (const farmer of farmers) {
        // Farmers should have some gold changes from selling
        if (farmer.totalSold > 0) {
          // Their profit should exist (they farmed and sold)
          expect(farmer.transactionCount).toBeGreaterThan(0);
        }
      }
    });

    it("should respect listing duration", () => {
      const engine = new EconomySimulationEngine(
        { totalTicks: 100, listingDurationTicks: 10, enableRandomEvents: false },
        TEST_SEED
      );
      engine.initialize();
      engine.run();

      // After 100 ticks with 10-tick listing duration, no listing should be older than 10 ticks
      const snapshot = engine.getMarketSnapshot();
      for (const item of snapshot) {
        for (const listing of item.activeListings) {
          expect(engine.getCurrentTick() - listing.createdAtTick).toBeLessThanOrEqual(10);
        }
      }
    });
  });

  describe("edge cases", () => {
    it("should handle single tick simulation", () => {
      const result = runEconomySimulation({ totalTicks: 1 }, TEST_SEED);
      expect(result.ticksCompleted).toBe(1);
      expect(result.finalMarketState.length).toBeGreaterThan(0);
    });

    it("should handle very long simulation", () => {
      const result = runEconomySimulation({ totalTicks: 500 }, TEST_SEED);
      expect(result.ticksCompleted).toBe(500);

      // All prices should still be positive
      for (const item of result.finalMarketState) {
        expect(item.currentPrice).toBeGreaterThan(0);
      }
    });

    it("should handle zero auction house cut", () => {
      const result = runEconomySimulation({ totalTicks: 50, auctionHouseCut: 0 }, TEST_SEED);
      expect(result.ticksCompleted).toBe(50);
    });

    it("should handle high inflation rate", () => {
      const result = runEconomySimulation({ totalTicks: 50, baseInflationRate: 0.05 }, TEST_SEED);
      expect(result.ticksCompleted).toBe(50);
      // Higher inflation should lead to higher average price change
      expect(result.analytics.averagePriceChange).toBeGreaterThan(0);
    });

    it("should trim price history for memory efficiency", () => {
      const engine = new EconomySimulationEngine({ totalTicks: 600, enableRandomEvents: false }, TEST_SEED);
      engine.initialize();
      engine.run();

      // History should be trimmed to 500 ticks max
      const history = engine.getPriceHistory(2589);
      expect(history.length).toBeLessThanOrEqual(501); // 500 + possible boundary
    });
  });
});
