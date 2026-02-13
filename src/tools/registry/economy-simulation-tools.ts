/**
 * Economy Simulation Tools Registry
 *
 * Registers MCP tools for the Economy Simulation Engine:
 * - economy-simulate: Run a full economy simulation
 * - economy-forecast-price: Forecast item prices
 * - economy-market-dynamics: Analyze supply/demand dynamics
 * - economy-simulate-event: Test market event impact
 * - economy-simulation-report: Generate markdown report
 *
 * @module tools/registry/economy-simulation-tools
 */

import { ToolRegistryEntry, jsonResponse } from "./types";
import {
  runEconomySimulation,
  getItemPriceForecast,
  getItemMarketDynamics,
  simulateMarketEvent,
  exportSimulationMarkdown,
  type MarketEventType,
  type SimulationConfig,
} from "../economysimulator";

export const economySimulationTools: ToolRegistryEntry[] = [
  {
    definition: {
      name: "economy-simulate",
      description:
        "Run a full economy simulation modeling supply/demand dynamics, auction house behavior, and market events. Returns price histories, actor performance, and market analytics.",
      inputSchema: {
        type: "object",
        properties: {
          totalTicks: {
            type: "number",
            description: "Number of simulation ticks to run (default: 168 = 1 week of hourly ticks)",
          },
          enableRandomEvents: {
            type: "boolean",
            description: "Whether to enable random market events during simulation (default: true)",
          },
          auctionHouseCut: {
            type: "number",
            description: "Auction house commission rate 0.0-1.0 (default: 0.05 = 5%)",
          },
          seed: {
            type: "number",
            description: "Random seed for reproducible simulations",
          },
        },
        required: [],
      },
    },
    handler: async (args) => {
      const config: Partial<SimulationConfig> = {};
      if (args.totalTicks !== undefined) config.totalTicks = args.totalTicks as number;
      if (args.enableRandomEvents !== undefined) config.enableRandomEvents = args.enableRandomEvents as boolean;
      if (args.auctionHouseCut !== undefined) config.auctionHouseCut = args.auctionHouseCut as number;

      const result = runEconomySimulation(config, args.seed as number | undefined);
      return jsonResponse(result);
    },
  },
  {
    definition: {
      name: "economy-forecast-price",
      description:
        "Forecast future prices for a specific item by running a simulation and applying trend analysis. Returns price predictions with confidence levels and buy/sell/hold recommendation.",
      inputSchema: {
        type: "object",
        properties: {
          itemId: {
            type: "number",
            description: "Item ID to forecast (e.g., 2589 for Linen Cloth, 2772 for Iron Ore)",
          },
          simulationTicks: {
            type: "number",
            description: "Ticks of historical simulation to run before forecasting (default: 168)",
          },
          forecastTicks: {
            type: "number",
            description: "Number of future ticks to forecast (default: 24)",
          },
          seed: {
            type: "number",
            description: "Random seed for reproducible results",
          },
        },
        required: ["itemId"],
      },
    },
    handler: async (args) => {
      const result = getItemPriceForecast(
        args.itemId as number,
        args.simulationTicks as number | undefined,
        args.forecastTicks as number | undefined,
        args.seed as number | undefined
      );
      if (!result) {
        return jsonResponse({ error: `Item ${args.itemId} not found in simulation market` });
      }
      return jsonResponse(result);
    },
  },
  {
    definition: {
      name: "economy-market-dynamics",
      description:
        "Analyze market dynamics for a specific item including supply/demand ratio, price elasticity, volatility index, support/resistance levels, and market efficiency.",
      inputSchema: {
        type: "object",
        properties: {
          itemId: {
            type: "number",
            description: "Item ID to analyze",
          },
          simulationTicks: {
            type: "number",
            description: "Ticks of simulation to run before analysis (default: 168)",
          },
          seed: {
            type: "number",
            description: "Random seed for reproducible results",
          },
        },
        required: ["itemId"],
      },
    },
    handler: async (args) => {
      const result = getItemMarketDynamics(
        args.itemId as number,
        args.simulationTicks as number | undefined,
        args.seed as number | undefined
      );
      if (!result) {
        return jsonResponse({ error: `Item ${args.itemId} not found in simulation market` });
      }
      return jsonResponse(result);
    },
  },
  {
    definition: {
      name: "economy-simulate-event",
      description:
        "Simulate the impact of a market event (supply shortage, demand spike, bot farming wave, etc.) by comparing baseline and event-affected simulation runs. Shows price and volume impact.",
      inputSchema: {
        type: "object",
        properties: {
          eventType: {
            type: "string",
            description:
              "Event type: supply_shortage, supply_flood, demand_spike, demand_crash, patch_change, seasonal_event, bot_farm_wave, guild_dump",
          },
          targetItemId: {
            type: "number",
            description: "Item ID to target with the event",
          },
          magnitude: {
            type: "number",
            description: "Event magnitude 0.0-1.0 (default: 0.5)",
          },
          durationTicks: {
            type: "number",
            description: "Duration of the event in ticks (default: 24)",
          },
          seed: {
            type: "number",
            description: "Random seed for reproducible comparison",
          },
        },
        required: ["eventType", "targetItemId"],
      },
    },
    handler: async (args) => {
      const result = simulateMarketEvent(
        args.eventType as MarketEventType,
        args.targetItemId as number,
        args.magnitude as number | undefined,
        args.durationTicks as number | undefined,
        args.seed as number | undefined
      );
      return jsonResponse({
        impact: result.impact,
        baselineAnalytics: result.baseline.analytics,
        eventAnalytics: result.withEvent.analytics,
        events: result.withEvent.events,
      });
    },
  },
  {
    definition: {
      name: "economy-simulation-report",
      description:
        "Run an economy simulation and generate a comprehensive markdown report with market analytics, price tables, actor performance, and event log.",
      inputSchema: {
        type: "object",
        properties: {
          totalTicks: {
            type: "number",
            description: "Number of simulation ticks (default: 168)",
          },
          seed: {
            type: "number",
            description: "Random seed for reproducible results",
          },
        },
        required: [],
      },
    },
    handler: async (args) => {
      const config: Partial<SimulationConfig> = {};
      if (args.totalTicks !== undefined) config.totalTicks = args.totalTicks as number;

      const result = runEconomySimulation(config, args.seed as number | undefined);
      const markdown = exportSimulationMarkdown(result);
      return { content: [{ type: "text", text: markdown }] };
    },
  },
];
