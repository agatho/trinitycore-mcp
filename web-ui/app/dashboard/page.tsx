/**
 * Advanced Data Visualization Dashboard
 * Shows interactive charts and statistics for TrinityCore data
 */

"use client";

import { useState, useEffect } from "react";
import { ArrowLeft, BarChart3, TrendingUp, PieChart as PieChartIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useMCPTool } from "@/hooks/useMCP";
import { ChartWrapper } from "@/components/charts/ChartWrapper";
import { DistributionChart, DistributionData } from "@/components/charts/DistributionChart";
import { ExportButton } from "@/components/ExportButton";

/** Chart colours, applied by position for schools and by name for qualities. */
const SCHOOL_COLORS = ["#ef4444", "#eab308", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6", "#06b6d4", "#94a3b8", "#64748b"];
const QUALITY_COLORS: Record<string, string> = {
  Poor: "#9ca3af",
  Common: "#ffffff",
  Uncommon: "#10b981",
  Rare: "#3b82f6",
  Epic: "#a855f7",
  Legendary: "#f97316",
  Artifact: "#e6cc80",
  Heirloom: "#00ccff",
  "WoW Token": "#00ccff",
};

export default function DashboardPage() {
  const [spellData, setSpellData] = useState<DistributionData[]>([]);
  const [itemData, setItemData] = useState<DistributionData[]>([]);
  const [creatureData, setCreatureData] = useState<DistributionData[]>([]);
  const [distributionsLoading, setDistributionsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [source, setSource] = useState<{ build: number; computedAt: string; cached: boolean } | null>(null);
  const { callTool, loading } = useMCPTool();

  useEffect(() => {
    // Counted from the active build's client data by /api/distributions -
    // 417,632 SpellMisc rows for schools, 175,059 ItemSparse rows for qualities
    // - and cached per build, because that scan is too slow for a page load but
    // only changes when the build does. These charts previously showed
    // hardcoded figures and a Math.random() series, which under a heading of
    // "Analytics Dashboard" read as measurement.
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setDistributionsLoading(true);
    setLoadError(null);
    try {
      const response = await fetch("/api/distributions");
      const payload = await response.json();
      if (!payload.success) {
        throw new Error(payload.error || "The distributions endpoint reported a failure");
      }

      const data = payload.data as {
        spellSchools: Array<{ name: string; value: number }>;
        itemQualities: Array<{ name: string; value: number }>;
        creatureTypes: Array<{ name: string; value: number }>;
        build: number;
        computedAt: string;
      };

      setSpellData(data.spellSchools.map((b, i) => ({ ...b, color: SCHOOL_COLORS[i % SCHOOL_COLORS.length] })));
      setItemData(data.itemQualities.map((b) => ({ ...b, color: QUALITY_COLORS[b.name] || "#94a3b8" })));
      setCreatureData(data.creatureTypes);
      setSource({ build: data.build, computedAt: data.computedAt, cached: Boolean(payload.cached) });
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Could not load distributions");
      setSpellData([]);
      setItemData([]);
      setCreatureData([]);
    } finally {
      setDistributionsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <Link href="/">
              <Button variant="ghost" className="mb-4 text-slate-400 hover:text-white">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Home
              </Button>
            </Link>

            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-blue-500/20 rounded-lg">
                <BarChart3 className="w-8 h-8 text-blue-400" />
              </div>
              <div>
                <h1 className="text-5xl font-bold text-white">
                  Analytics Dashboard
                </h1>
                <p className="text-xl text-slate-300 mt-2">
                  Interactive visualizations of <span className="text-blue-400 font-semibold">TrinityCore data</span>
                </p>
              </div>
            </div>
          </div>

          {/* Dashboard Grid */}
          <div className="grid grid-cols-1 gap-6">
            {/* Spell School Distribution */}
            <ChartWrapper
              title="Spell Distribution by School"
              description="Total spells grouped by magic school"
              loading={loading}
              actions={
                <div className="flex gap-2">
                  <ExportButton
                    data={spellData}
                    filename="spell-distribution.xlsx"
                    title="Spell Distribution by School"
                  />
                  <Button variant="outline" size="sm">
                    <TrendingUp className="mr-2 h-4 w-4" />
                    Details
                  </Button>
                </div>
              }
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <DistributionChart data={spellData} type="bar" height={300} />
                <DistributionChart data={spellData} type="pie" height={300} />
              </div>
            </ChartWrapper>

            {/* Item Quality Distribution */}
            <ChartWrapper
              title="Item Distribution by Quality"
              description="Total items grouped by quality tier"
              loading={loading}
              actions={
                <ExportButton
                  data={itemData}
                  filename="item-distribution.xlsx"
                  title="Item Distribution by Quality"
                />
              }
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <DistributionChart data={itemData} type="bar" height={300} />
                <DistributionChart data={itemData} type="pie" height={300} />
              </div>
            </ChartWrapper>

            {/* Creature Level Distribution */}
            <ChartWrapper
              title="Creature Distribution by Type"
              description="Total creatures grouped by creature type"
              loading={loading}
              actions={
                <ExportButton
                  data={creatureData}
                  filename="creature-distribution.xlsx"
                  title="Creature Distribution by Level"
                />
              }
            >
              <DistributionChart data={creatureData} type="bar" height={300} />
            </ChartWrapper>

            {/* Statistics Summary */}
            {loadError ? (
              <div className="rounded border border-red-500/40 bg-red-500/10 p-3">
                <p className="text-sm font-medium text-red-200">Distributions unavailable</p>
                <p className="text-xs text-red-100/80 mt-1">{loadError}</p>
              </div>
            ) : source ? (
              <p className="text-xs text-muted-foreground">
                Counted from build {source.build}&apos;s client data
                {source.cached ? " (cached)" : " (freshly computed)"} on{" "}
                {new Date(source.computedAt).toLocaleString()}. Creatures are grouped by type rather
                than level: they scale to the player in this build, so there is no fixed level to
                bucket by.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                {distributionsLoading ? "Counting the client data…" : ""}
              </p>
            )}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="rounded-lg border bg-card p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium text-muted-foreground">Total Spells</h3>
                  <PieChartIcon className="h-5 w-5 text-purple-400" />
                </div>
                <div className="text-3xl font-bold text-white">
                  {spellData.reduce((sum, d) => sum + d.value, 0).toLocaleString()}
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  Across {spellData.length} schools &middot; from the client data
                </p>
              </div>

              <div className="rounded-lg border bg-card p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium text-muted-foreground">Total Items</h3>
                  <PieChartIcon className="h-5 w-5 text-blue-400" />
                </div>
                <div className="text-3xl font-bold text-white">
                  {itemData.reduce((sum, d) => sum + d.value, 0).toLocaleString()}
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  Across {itemData.length} quality tiers &middot; from the client data
                </p>
              </div>

              <div className="rounded-lg border bg-card p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium text-muted-foreground">Total Creatures</h3>
                  <PieChartIcon className="h-5 w-5 text-green-400" />
                </div>
                <div className="text-3xl font-bold text-white">
                  {creatureData.reduce((sum, d) => sum + d.value, 0).toLocaleString()}
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  Across {creatureData.length} types &middot; from the world database
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
