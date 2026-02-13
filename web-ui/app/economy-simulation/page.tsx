"use client";

import { useState, useEffect, useCallback } from "react";

// ============================================================================
// TYPES
// ============================================================================

interface MarketItem {
  itemId: number;
  name: string;
  category: string;
  basePrice: number;
  currentPrice: number;
  supply: number;
  demand: number;
  trend: string;
  volatility: number;
  totalVolume: number;
}

interface ActorSummary {
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

interface MarketAnalytics {
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

interface MarketEvent {
  eventId: string;
  type: string;
  itemId?: number;
  magnitude: number;
  startTick: number;
  durationTicks: number;
  description: string;
}

interface PriceHistoryEntry {
  tick: number;
  price: number;
  supply: number;
  demand: number;
  volume: number;
}

interface PriceForecast {
  itemId: number;
  name: string;
  currentPrice: number;
  forecastedPrices: Array<{ tick: number; price: number; confidence: number }>;
  trend: string;
  volatility: number;
  recommendation: string;
  reasoning: string;
}

// ============================================================================
// HELPERS
// ============================================================================

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

function trendBadge(trend: string): string {
  const badges: Record<string, string> = {
    rising: "text-green-400",
    spiking: "text-green-300 font-bold",
    falling: "text-red-400",
    crashed: "text-red-300 font-bold",
    stable: "text-gray-400",
    volatile: "text-yellow-400",
  };
  return badges[trend] ?? "text-gray-400";
}

function trendArrow(trend: string): string {
  const arrows: Record<string, string> = {
    rising: "^",
    spiking: "^^",
    falling: "v",
    crashed: "vv",
    stable: "-",
    volatile: "~",
  };
  return arrows[trend] ?? "?";
}

function categoryColor(category: string): string {
  const colors: Record<string, string> = {
    trade_good: "bg-blue-900/40 text-blue-300",
    reagent: "bg-green-900/40 text-green-300",
    consumable: "bg-purple-900/40 text-purple-300",
    gem: "bg-yellow-900/40 text-yellow-300",
    weapon: "bg-red-900/40 text-red-300",
    armor: "bg-orange-900/40 text-orange-300",
  };
  return colors[category] ?? "bg-gray-900/40 text-gray-300";
}

// ============================================================================
// COMPONENTS
// ============================================================================

function StatCard({ label, value, subtext }: { label: string; value: string | number; subtext?: string }) {
  return (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
      <div className="text-gray-400 text-xs uppercase tracking-wide">{label}</div>
      <div className="text-2xl font-bold text-white mt-1">{value}</div>
      {subtext && <div className="text-gray-500 text-xs mt-1">{subtext}</div>}
    </div>
  );
}

function HealthBar({ score }: { score: number }) {
  const color = score >= 70 ? "bg-green-500" : score >= 40 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 bg-gray-700 rounded-full h-3">
        <div className={`${color} h-3 rounded-full transition-all duration-500`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-white font-bold text-sm w-10 text-right">{score}</span>
    </div>
  );
}

// ============================================================================
// MAIN PAGE
// ============================================================================

export default function EconomySimulationPage() {
  const [activeTab, setActiveTab] = useState<"market" | "actors" | "events" | "forecast">("market");
  const [items, setItems] = useState<MarketItem[]>([]);
  const [actors, setActors] = useState<ActorSummary[]>([]);
  const [analytics, setAnalytics] = useState<MarketAnalytics | null>(null);
  const [events, setEvents] = useState<MarketEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [simTicks, setSimTicks] = useState(168);
  const [selectedItem, setSelectedItem] = useState<number | null>(null);
  const [priceHistory, setPriceHistory] = useState<PriceHistoryEntry[]>([]);
  const [forecast, setForecast] = useState<PriceForecast | null>(null);
  const [sortField, setSortField] = useState<string>("name");
  const [sortAsc, setSortAsc] = useState(true);

  const loadMarketData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/economy-simulation?action=market-snapshot");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setItems(data.items ?? []);
      setActors(data.actors ?? []);
      setAnalytics(data.analytics ?? null);
      setEvents(data.events ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load market data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMarketData();
  }, [loadMarketData]);

  const runSimulation = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/economy-simulation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "run-simulation", totalTicks: simTicks }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setItems(data.finalMarketState ?? []);
      setActors(data.actors ?? []);
      setAnalytics(data.analytics ?? null);
      setEvents(data.events ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Simulation failed");
    } finally {
      setLoading(false);
    }
  };

  const loadPriceHistory = async (itemId: number) => {
    setSelectedItem(itemId);
    try {
      const res = await fetch(`/api/economy-simulation?action=price-history&itemId=${itemId}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setPriceHistory(data.history ?? []);
    } catch {
      setPriceHistory([]);
    }
  };

  const loadForecast = async (itemId: number) => {
    setSelectedItem(itemId);
    setActiveTab("forecast");
    try {
      const res = await fetch(`/api/economy-simulation?action=forecast&itemId=${itemId}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setForecast(data);
    } catch {
      setForecast(null);
    }
  };

  const sortedItems = [...items].sort((a, b) => {
    const field = sortField as keyof MarketItem;
    const aVal = a[field];
    const bVal = b[field];
    if (typeof aVal === "number" && typeof bVal === "number") {
      return sortAsc ? aVal - bVal : bVal - aVal;
    }
    return sortAsc ? String(aVal).localeCompare(String(bVal)) : String(bVal).localeCompare(String(aVal));
  });

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Economy Simulation Engine</h1>
            <p className="text-gray-400 mt-1">Supply/demand dynamics, auction house modeling, and market analysis</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-400">Ticks:</label>
              <input
                type="number"
                value={simTicks}
                onChange={(e) => setSimTicks(Math.max(1, parseInt(e.target.value) || 168))}
                className="w-20 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm"
              />
            </div>
            <button
              onClick={runSimulation}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 rounded-lg font-medium text-sm transition-colors"
            >
              {loading ? "Running..." : "Run Simulation"}
            </button>
            <button
              onClick={loadMarketData}
              disabled={loading}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors"
            >
              Refresh
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 mb-6 text-red-300">{error}</div>
        )}

        {/* Analytics Overview */}
        {analytics && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-8">
            <StatCard label="Transactions" value={analytics.totalTransactions.toLocaleString()} />
            <StatCard label="Volume" value={`${analytics.totalVolume.toLocaleString()} units`} />
            <StatCard label="Gold Traded" value={formatCopper(analytics.totalGoldTraded)} />
            <StatCard label="Avg Price Change" value={`${analytics.averagePriceChange > 0 ? "+" : ""}${analytics.averagePriceChange}%`} />
            <StatCard label="Inflation" value={`${analytics.inflationRate}%`} />
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <div className="text-gray-400 text-xs uppercase tracking-wide">Market Health</div>
              <div className="mt-2"><HealthBar score={analytics.marketHealthScore} /></div>
            </div>
          </div>
        )}

        {/* Highlight Cards */}
        {analytics && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {analytics.mostTradedItem && (
              <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700">
                <div className="text-xs text-gray-500">Most Traded</div>
                <div className="text-sm font-medium text-white">{analytics.mostTradedItem.name}</div>
                <div className="text-xs text-gray-400">{analytics.mostTradedItem.volume} units</div>
              </div>
            )}
            {analytics.mostVolatileItem && (
              <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700">
                <div className="text-xs text-gray-500">Most Volatile</div>
                <div className="text-sm font-medium text-yellow-300">{analytics.mostVolatileItem.name}</div>
                <div className="text-xs text-gray-400">Volatility: {analytics.mostVolatileItem.volatility}</div>
              </div>
            )}
            {analytics.biggestGainer && (
              <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700">
                <div className="text-xs text-gray-500">Biggest Gainer</div>
                <div className="text-sm font-medium text-green-300">{analytics.biggestGainer.name}</div>
                <div className="text-xs text-green-400">+{analytics.biggestGainer.changePercent}%</div>
              </div>
            )}
            {analytics.biggestLoser && (
              <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700">
                <div className="text-xs text-gray-500">Biggest Loser</div>
                <div className="text-sm font-medium text-red-300">{analytics.biggestLoser.name}</div>
                <div className="text-xs text-red-400">{analytics.biggestLoser.changePercent}%</div>
              </div>
            )}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-gray-800 rounded-lg p-1 w-fit">
          {(["market", "actors", "events", "forecast"] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === tab ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white hover:bg-gray-700"
              }`}
            >
              {tab === "market" ? "Market" : tab === "actors" ? "Actors" : tab === "events" ? "Events" : "Forecast"}
            </button>
          ))}
        </div>

        {/* Market Tab */}
        {activeTab === "market" && (
          <div className="space-y-6">
            <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-700 text-left">
                    {[
                      { key: "name", label: "Item" },
                      { key: "category", label: "Category" },
                      { key: "basePrice", label: "Base Price" },
                      { key: "currentPrice", label: "Current" },
                      { key: "change", label: "Change" },
                      { key: "trend", label: "Trend" },
                      { key: "supply", label: "Supply" },
                      { key: "demand", label: "Demand" },
                      { key: "totalVolume", label: "Volume" },
                      { key: "actions", label: "" },
                    ].map(col => (
                      <th
                        key={col.key}
                        onClick={col.key !== "actions" && col.key !== "change" ? () => handleSort(col.key) : undefined}
                        className={`px-4 py-3 text-xs uppercase tracking-wide text-gray-400 ${col.key !== "actions" ? "cursor-pointer hover:text-white" : ""}`}
                      >
                        {col.label} {sortField === col.key ? (sortAsc ? "^" : "v") : ""}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedItems.map(item => {
                    const change = ((item.currentPrice - item.basePrice) / item.basePrice) * 100;
                    return (
                      <tr
                        key={item.itemId}
                        className={`border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors ${selectedItem === item.itemId ? "bg-blue-900/20" : ""}`}
                      >
                        <td className="px-4 py-3 font-medium">{item.name}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded text-xs ${categoryColor(item.category)}`}>
                            {item.category.replace("_", " ")}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-300">{formatCopper(item.basePrice)}</td>
                        <td className="px-4 py-3 font-medium">{formatCopper(item.currentPrice)}</td>
                        <td className={`px-4 py-3 ${change >= 0 ? "text-green-400" : "text-red-400"}`}>
                          {change >= 0 ? "+" : ""}{Math.round(change * 10) / 10}%
                        </td>
                        <td className="px-4 py-3">
                          <span className={trendBadge(item.trend)}>
                            {trendArrow(item.trend)} {item.trend}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-300">{Math.round(item.supply)}</td>
                        <td className="px-4 py-3 text-gray-300">{Math.round(item.demand)}</td>
                        <td className="px-4 py-3 text-gray-300">{item.totalVolume}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <button
                              onClick={() => loadPriceHistory(item.itemId)}
                              className="text-xs text-blue-400 hover:text-blue-300"
                            >
                              History
                            </button>
                            <button
                              onClick={() => loadForecast(item.itemId)}
                              className="text-xs text-green-400 hover:text-green-300"
                            >
                              Forecast
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Price History Mini-Chart (text-based) */}
            {selectedItem && priceHistory.length > 0 && activeTab === "market" && (
              <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
                <h3 className="text-lg font-medium mb-3">
                  Price History: {items.find(i => i.itemId === selectedItem)?.name}
                </h3>
                <div className="grid grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-gray-400">Min Price:</span>{" "}
                    <span className="text-white">{formatCopper(Math.min(...priceHistory.map(h => h.price)))}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Max Price:</span>{" "}
                    <span className="text-white">{formatCopper(Math.max(...priceHistory.map(h => h.price)))}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Avg Price:</span>{" "}
                    <span className="text-white">
                      {formatCopper(Math.round(priceHistory.reduce((s, h) => s + h.price, 0) / priceHistory.length))}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400">Total Volume:</span>{" "}
                    <span className="text-white">{priceHistory.reduce((s, h) => s + h.volume, 0)}</span>
                  </div>
                </div>
                {/* ASCII sparkline */}
                <div className="mt-3 font-mono text-xs text-gray-500 overflow-hidden">
                  {(() => {
                    const prices = priceHistory.map(h => h.price);
                    const min = Math.min(...prices);
                    const max = Math.max(...prices);
                    const range = max - min || 1;
                    const chars = " _.-~*^";
                    const sparkline = prices.map(p => {
                      const idx = Math.floor(((p - min) / range) * (chars.length - 1));
                      return chars[idx];
                    }).join("");
                    return sparkline.length > 120 ? sparkline.slice(-120) : sparkline;
                  })()}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Actors Tab */}
        {activeTab === "actors" && (
          <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700 text-left">
                  <th className="px-4 py-3 text-xs uppercase tracking-wide text-gray-400">Actor</th>
                  <th className="px-4 py-3 text-xs uppercase tracking-wide text-gray-400">Type</th>
                  <th className="px-4 py-3 text-xs uppercase tracking-wide text-gray-400">Starting Gold</th>
                  <th className="px-4 py-3 text-xs uppercase tracking-wide text-gray-400">Final Gold</th>
                  <th className="px-4 py-3 text-xs uppercase tracking-wide text-gray-400">Profit</th>
                  <th className="px-4 py-3 text-xs uppercase tracking-wide text-gray-400">Bought</th>
                  <th className="px-4 py-3 text-xs uppercase tracking-wide text-gray-400">Sold</th>
                  <th className="px-4 py-3 text-xs uppercase tracking-wide text-gray-400">Transactions</th>
                </tr>
              </thead>
              <tbody>
                {actors.map(actor => (
                  <tr key={actor.actorId} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                    <td className="px-4 py-3 font-medium">{actor.name}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        actor.type === "farmer" ? "bg-green-900/40 text-green-300" :
                        actor.type === "crafter" ? "bg-purple-900/40 text-purple-300" :
                        actor.type === "flipper" ? "bg-yellow-900/40 text-yellow-300" :
                        "bg-blue-900/40 text-blue-300"
                      }`}>
                        {actor.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-300">{formatCopper(actor.startingGold)}</td>
                    <td className="px-4 py-3">{formatCopper(actor.finalGold)}</td>
                    <td className={`px-4 py-3 font-medium ${actor.profit >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {actor.profit >= 0 ? "+" : ""}{formatCopper(actor.profit)}
                    </td>
                    <td className="px-4 py-3 text-gray-300">{actor.totalBought}</td>
                    <td className="px-4 py-3 text-gray-300">{actor.totalSold}</td>
                    <td className="px-4 py-3 text-gray-300">{actor.transactionCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Events Tab */}
        {activeTab === "events" && (
          <div className="space-y-3">
            {events.length === 0 ? (
              <div className="text-gray-500 text-center py-8">No market events recorded</div>
            ) : (
              events.map(event => (
                <div key={event.eventId} className="bg-gray-800 rounded-lg border border-gray-700 p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        event.type.includes("shortage") || event.type.includes("crash") ? "bg-red-900/40 text-red-300" :
                        event.type.includes("spike") || event.type.includes("seasonal") ? "bg-green-900/40 text-green-300" :
                        event.type.includes("flood") || event.type.includes("dump") || event.type.includes("bot") ? "bg-yellow-900/40 text-yellow-300" :
                        "bg-blue-900/40 text-blue-300"
                      }`}>
                        {event.type.replace(/_/g, " ")}
                      </span>
                      <span className="text-white">{event.description}</span>
                    </div>
                    <div className="text-xs text-gray-500">
                      Tick {event.startTick} - {event.startTick + event.durationTicks} | Magnitude: {(event.magnitude * 100).toFixed(0)}%
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Forecast Tab */}
        {activeTab === "forecast" && (
          <div className="space-y-6">
            {!forecast ? (
              <div className="text-gray-500 text-center py-8">
                Select an item from the Market tab and click &quot;Forecast&quot; to see price predictions
              </div>
            ) : (
              <>
                <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold">{forecast.name} - Price Forecast</h3>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                      forecast.recommendation === "buy" ? "bg-green-900/40 text-green-300 border border-green-700" :
                      forecast.recommendation === "sell" ? "bg-red-900/40 text-red-300 border border-red-700" :
                      "bg-gray-700 text-gray-300 border border-gray-600"
                    }`}>
                      {forecast.recommendation.toUpperCase()}
                    </span>
                  </div>

                  <div className="grid grid-cols-4 gap-4 mb-4">
                    <StatCard label="Current Price" value={formatCopper(forecast.currentPrice)} />
                    <StatCard label="Trend" value={forecast.trend} />
                    <StatCard label="Volatility" value={`${(forecast.volatility * 100).toFixed(1)}%`} />
                    <StatCard
                      label="Forecast End"
                      value={formatCopper(forecast.forecastedPrices[forecast.forecastedPrices.length - 1]?.price ?? 0)}
                      subtext={`Confidence: ${((forecast.forecastedPrices[forecast.forecastedPrices.length - 1]?.confidence ?? 0) * 100).toFixed(0)}%`}
                    />
                  </div>

                  <div className="text-gray-300 text-sm mb-4">{forecast.reasoning}</div>

                  <div className="bg-gray-900/50 rounded-lg p-4">
                    <h4 className="text-sm text-gray-400 mb-2">Forecasted Prices</h4>
                    <div className="grid grid-cols-6 gap-2 text-xs">
                      {forecast.forecastedPrices.map(fp => (
                        <div key={fp.tick} className="bg-gray-800 rounded p-2 text-center">
                          <div className="text-gray-500">Tick {fp.tick}</div>
                          <div className="text-white font-medium">{formatCopper(fp.price)}</div>
                          <div className="text-gray-500">{(fp.confidence * 100).toFixed(0)}%</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Quick forecast buttons for all items */}
                <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
                  <h4 className="text-sm text-gray-400 mb-3">Quick Forecast</h4>
                  <div className="flex flex-wrap gap-2">
                    {items.map(item => (
                      <button
                        key={item.itemId}
                        onClick={() => loadForecast(item.itemId)}
                        className={`px-3 py-1 rounded text-xs transition-colors ${
                          selectedItem === item.itemId ? "bg-blue-600 text-white" : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                        }`}
                      >
                        {item.name}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
