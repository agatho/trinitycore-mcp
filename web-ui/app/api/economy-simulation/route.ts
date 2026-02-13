/**
 * Economy Simulation API Route
 *
 * Provides HTTP endpoints for the Economy Simulation Engine.
 * Bridges between the Web UI and MCP economy simulation tools.
 *
 * GET /api/economy-simulation?action=<action>&params...
 * POST /api/economy-simulation (for simulation runs)
 */

import { NextRequest, NextResponse } from "next/server";

// ============================================================================
// MOCK DATA - Used when MCP server is not connected
// ============================================================================

const MOCK_MARKET_ITEMS = [
  { itemId: 2589, name: "Linen Cloth", category: "trade_good", basePrice: 50, currentPrice: 58, supply: 780, demand: 620, trend: "rising", volatility: 0.06, totalVolume: 2340 },
  { itemId: 2592, name: "Wool Cloth", category: "trade_good", basePrice: 150, currentPrice: 142, supply: 520, demand: 430, trend: "falling", volatility: 0.07, totalVolume: 1560 },
  { itemId: 4306, name: "Silk Cloth", category: "trade_good", basePrice: 400, currentPrice: 445, supply: 330, demand: 410, trend: "rising", volatility: 0.09, totalVolume: 980 },
  { itemId: 4338, name: "Mageweave Cloth", category: "trade_good", basePrice: 800, currentPrice: 760, supply: 210, demand: 280, trend: "stable", volatility: 0.11, totalVolume: 620 },
  { itemId: 14047, name: "Runecloth", category: "trade_good", basePrice: 1200, currentPrice: 1380, supply: 130, demand: 260, trend: "spiking", volatility: 0.14, totalVolume: 340 },
  { itemId: 2772, name: "Iron Ore", category: "reagent", basePrice: 300, currentPrice: 325, supply: 380, demand: 520, trend: "rising", volatility: 0.08, totalVolume: 1890 },
  { itemId: 10620, name: "Thorium Ore", category: "reagent", basePrice: 1500, currentPrice: 1620, supply: 90, demand: 210, trend: "rising", volatility: 0.16, totalVolume: 220 },
  { itemId: 929, name: "Healing Potion", category: "consumable", basePrice: 200, currentPrice: 230, supply: 280, demand: 520, trend: "rising", volatility: 0.11, totalVolume: 3400 },
  { itemId: 1710, name: "Greater Healing Potion", category: "consumable", basePrice: 800, currentPrice: 850, supply: 140, demand: 360, trend: "stable", volatility: 0.13, totalVolume: 890 },
  { itemId: 1529, name: "Jade", category: "gem", basePrice: 1000, currentPrice: 920, supply: 55, demand: 75, trend: "falling", volatility: 0.16, totalVolume: 120 },
];

const MOCK_ACTORS = [
  { actorId: "farmer_1", name: "Material Farmer", type: "farmer", startingGold: 10000000, finalGold: 10450000, profit: 450000, totalBought: 0, totalSold: 1240, transactionCount: 156 },
  { actorId: "crafter_1", name: "Alchemist", type: "crafter", startingGold: 10000000, finalGold: 10280000, profit: 280000, totalBought: 340, totalSold: 520, transactionCount: 210 },
  { actorId: "flipper_1", name: "Market Flipper", type: "flipper", startingGold: 10000000, finalGold: 10620000, profit: 620000, totalBought: 890, totalSold: 870, transactionCount: 430 },
  { actorId: "consumer_1", name: "Raider", type: "consumer", startingGold: 10000000, finalGold: 9780000, profit: -220000, totalBought: 320, totalSold: 0, transactionCount: 98 },
  { actorId: "consumer_2", name: "Casual Player", type: "consumer", startingGold: 10000000, finalGold: 9850000, profit: -150000, totalBought: 180, totalSold: 0, transactionCount: 65 },
];

const MOCK_ANALYTICS = {
  totalTransactions: 1890,
  totalVolume: 14200,
  totalGoldTraded: 8500000,
  averagePriceChange: 5.2,
  mostVolatileItem: { itemId: 10620, name: "Thorium Ore", volatility: 0.16 },
  mostTradedItem: { itemId: 929, name: "Healing Potion", volume: 3400 },
  biggestGainer: { itemId: 14047, name: "Runecloth", changePercent: 15.0 },
  biggestLoser: { itemId: 1529, name: "Jade", changePercent: -8.0 },
  marketHealthScore: 72,
  inflationRate: 0.17,
  eventCount: 5,
};

const MOCK_EVENTS = [
  { eventId: "evt_1", type: "demand_spike", itemId: 14047, magnitude: 0.6, startTick: 24, durationTicks: 18, description: "Demand spike for Runecloth - new recipe discovered" },
  { eventId: "evt_2", type: "bot_farm_wave", itemId: 2589, magnitude: 0.4, startTick: 52, durationTicks: 30, description: "Bot farming wave detected - Linen Cloth flooding market" },
  { eventId: "evt_3", type: "supply_shortage", itemId: 10620, magnitude: 0.5, startTick: 80, durationTicks: 24, description: "Supply shortage for Thorium Ore - farmers diverted to new content" },
  { eventId: "evt_4", type: "seasonal_event", itemId: 929, magnitude: 0.3, startTick: 120, durationTicks: 36, description: "Seasonal event increasing demand for Healing Potion" },
  { eventId: "evt_5", type: "guild_dump", itemId: 1529, magnitude: 0.5, startTick: 140, durationTicks: 12, description: "Guild bank dump - large quantities of Jade listed" },
];

// ============================================================================
// GET Handler
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get("action");

    switch (action) {
      case "market-snapshot":
        return NextResponse.json({
          items: MOCK_MARKET_ITEMS,
          analytics: MOCK_ANALYTICS,
          actors: MOCK_ACTORS,
          events: MOCK_EVENTS,
          tick: 168,
        });

      case "price-history": {
        const itemId = parseInt(searchParams.get("itemId") ?? "0");
        const item = MOCK_MARKET_ITEMS.find(i => i.itemId === itemId);
        if (!item) {
          return NextResponse.json({ error: "Item not found" }, { status: 404 });
        }
        // Generate mock price history
        const history = Array.from({ length: 168 }, (_, i) => ({
          tick: i + 1,
          price: Math.round(item.basePrice * (1 + Math.sin(i / 20) * 0.15 + (i / 168) * 0.1)),
          supply: Math.round(item.supply * (1 + Math.cos(i / 15) * 0.1)),
          demand: Math.round(item.demand * (1 + Math.sin(i / 12) * 0.12)),
          volume: Math.floor(Math.random() * 20 + 5),
        }));
        return NextResponse.json({ itemId, name: item.name, history });
      }

      case "forecast": {
        const itemId = parseInt(searchParams.get("itemId") ?? "0");
        const item = MOCK_MARKET_ITEMS.find(i => i.itemId === itemId);
        if (!item) {
          return NextResponse.json({ error: "Item not found" }, { status: 404 });
        }
        const forecastedPrices = Array.from({ length: 24 }, (_, i) => ({
          tick: 169 + i,
          price: Math.round(item.currentPrice * (1 + (i * 0.005) + (Math.random() - 0.5) * 0.03)),
          confidence: Math.round((1 - (i / 24) * 0.5) * 100) / 100,
        }));
        return NextResponse.json({
          itemId,
          name: item.name,
          currentPrice: item.currentPrice,
          forecastedPrices,
          trend: item.trend,
          volatility: item.volatility,
          recommendation: item.trend === "rising" ? "buy" : item.trend === "falling" ? "sell" : "hold",
          reasoning: `Based on ${item.trend} trend with volatility ${item.volatility}`,
        });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}. Valid actions: market-snapshot, price-history, forecast` },
          { status: 400 }
        );
    }
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST Handler
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case "run-simulation":
        return NextResponse.json({
          config: {
            totalTicks: body.totalTicks ?? 168,
            tickIntervalLabel: "1 hour",
            auctionHouseCut: 0.05,
          },
          totalTicks: body.totalTicks ?? 168,
          ticksCompleted: body.totalTicks ?? 168,
          finalMarketState: MOCK_MARKET_ITEMS,
          actors: MOCK_ACTORS,
          analytics: MOCK_ANALYTICS,
          events: MOCK_EVENTS,
          generatedAt: new Date().toISOString(),
        });

      case "simulate-event":
        return NextResponse.json({
          impact: {
            priceChange: Math.round((Math.random() - 0.3) * 200),
            priceChangePercent: Math.round((Math.random() - 0.3) * 30 * 10) / 10,
            volumeChange: Math.floor((Math.random() - 0.3) * 50),
            description: `${body.eventType} caused a price change for item ${body.targetItemId}`,
          },
          baselineAnalytics: MOCK_ANALYTICS,
          eventAnalytics: { ...MOCK_ANALYTICS, averagePriceChange: MOCK_ANALYTICS.averagePriceChange + 3.2 },
        });

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
