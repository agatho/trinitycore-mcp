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

export default function DashboardPage() {
  const [spellData, setSpellData] = useState<DistributionData[]>([]);
  const [itemData, setItemData] = useState<DistributionData[]>([]);
  const [creatureData, setCreatureData] = useState<DistributionData[]>([]);
  const { callTool, loading } = useMCPTool();

  useEffect(() => {
    // Load sample data for visualization
    // In production, this would fetch actual statistics from the database
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    // Simulate loading spell school distribution
    setSpellData([
      { name: 'Physical', value: 8234, color: '#ef4444' },
      { name: 'Fire', value: 6821, color: '#f59e0b' },
      { name: 'Frost', value: 5432, color: '#3b82f6' },
      { name: 'Nature', value: 4123, color: '#10b981' },
      { name: 'Shadow', value: 7654, color: '#8b5cf6' },
      { name: 'Arcane', value: 5234, color: '#06b6d4' },
      { name: 'Holy', value: 3876, color: '#eab308' },
    ]);

    // Simulate loading item quality distribution
    setItemData([
      { name: 'Poor', value: 1234, color: '#9ca3af' },
      { name: 'Common', value: 5678, color: '#ffffff' },
      { name: 'Uncommon', value: 8901, color: '#10b981' },
      { name: 'Rare', value: 4567, color: '#3b82f6' },
      { name: 'Epic', value: 2345, color: '#a855f7' },
      { name: 'Legendary', value: 876, color: '#f97316' },
    ]);

    // Simulate loading creature level distribution
    const levelDistribution: DistributionData[] = [];
    for (let level = 1; level <= 10; level++) {
      const bracket = `${level * 10 - 9}-${level * 10}`;
      levelDistribution.push({
        name: bracket,
        value: Math.floor(Math.random() * 5000) + 1000,
      });
    }
    setCreatureData(levelDistribution);
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
              title="Creature Distribution by Level"
              description="Total creatures grouped by level brackets"
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
                  Across {spellData.length} schools
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
                  Across {itemData.length} quality tiers
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
                  Across all levels
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
