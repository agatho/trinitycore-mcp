/**
 * Combat Log Analyzer Dashboard
 *
 * Comprehensive bot combat log analysis with ML-based insights,
 * performance comparison, and actionable recommendations.
 */

"use client";

import React, { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import {
  DPSChart,
  PerformanceGauge,
  AbilityBreakdownChart,
  TimelineChart,
  type DPSDataPoint,
  type AbilityData,
  type TimelineEvent,
} from "@/components/combat-log";

// ============================================================================
// TYPES
// ============================================================================

interface AnalysisResult {
  summary: {
    duration: number;
    totalDamage: number;
    totalHealing: number;
    dps: number;
    hps: number;
  };
  performance: {
    score: number;
    grade: "S" | "A" | "B" | "C" | "D" | "F";
    percentile: number;
  };
  abilities: AbilityData[];
  timeline: TimelineEvent[];
  dpsOverTime: DPSDataPoint[];
  recommendations: Recommendation[];
  insights: string[];
}

interface Recommendation {
  id: string;
  priority: "critical" | "high" | "medium" | "low";
  category: string;
  title: string;
  description: string;
  impact: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function CombatLogAnalyzerPage() {
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedBot, setSelectedBot] = useState<string>("");
  const [className, setClassName] = useState<string>("");
  const [spec, setSpec] = useState<string>("");

  // File upload
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;

    const file = acceptedFiles[0];
    setIsAnalyzing(true);
    setError(null);

    try {
      // Read file content
      const content = await file.text();

      // Call MCP tool to analyze combat log
      // In production, this would call the actual MCP server
      // For now, simulate analysis with mock data
      await simulateAnalysis(content);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to analyze combat log");
    } finally {
      setIsAnalyzing(false);
    }
  }, [selectedBot, className, spec]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "text/plain": [".txt", ".log"],
    },
    maxFiles: 1,
  });

  // Simulate analysis (replace with actual MCP call)
  const simulateAnalysis = async (content: string): Promise<void> => {
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Mock analysis result
    const mockResult: AnalysisResult = {
      summary: {
        duration: 180,
        totalDamage: 108000,
        totalHealing: 0,
        dps: 600,
        hps: 0,
      },
      performance: {
        score: 85,
        grade: "A",
        percentile: 75,
      },
      abilities: [
        { name: "Mortal Strike", value: 32400, percentage: 30, casts: 30 },
        { name: "Bloodthirst", value: 27000, percentage: 25, casts: 45 },
        { name: "Whirlwind", value: 21600, percentage: 20, casts: 36 },
        { name: "Execute", value: 16200, percentage: 15, casts: 20 },
        { name: "Cleave", value: 10800, percentage: 10, casts: 18 },
      ],
      timeline: [
        { timestamp: 0, type: "phase", name: "Pull", importance: "high" },
        { timestamp: 2, type: "cooldown", name: "Recklessness", duration: 15 },
        { timestamp: 10, type: "buff", name: "Enrage", duration: 12 },
        { timestamp: 30, type: "phase", name: "Sustained" },
        { timestamp: 45, type: "interrupt", name: "Pummel", importance: "high" },
        { timestamp: 60, type: "cooldown", name: "Bloodthirst", duration: 0 },
        { timestamp: 90, type: "phase", name: "Burst" },
        { timestamp: 92, type: "cooldown", name: "Death Wish", duration: 30 },
        { timestamp: 120, type: "debuff", name: "Sunder Armor", duration: 30 },
        { timestamp: 150, type: "phase", name: "Execute" },
      ],
      dpsOverTime: Array.from({ length: 36 }, (_, i) => {
        const timestamp = i * 5;
        const phase = timestamp < 30 ? "opener" : timestamp < 90 ? "sustained" : timestamp < 150 ? "burst" : "execute";
        const baseDPS = 600;
        const variation = Math.sin(i * 0.5) * 100 + (Math.random() - 0.5) * 50;
        return {
          timestamp,
          dps: Math.max(0, baseDPS + variation),
          phase: i % 6 === 0 ? phase : undefined,
        };
      }),
      recommendations: [
        {
          id: "rec-1",
          priority: "high",
          category: "cooldowns",
          title: "Use Recklessness More Frequently",
          description: "Recklessness efficiency is 65% with 2 missed casts. Using this cooldown more consistently could improve performance.",
          impact: "Estimated +120 DPS from using Recklessness on cooldown",
        },
        {
          id: "rec-2",
          priority: "medium",
          category: "rotation",
          title: "Optimize Bloodthirst Usage",
          description: "Bloodthirst efficiency is 72%. Issues: 5 missed casts",
          impact: "Estimated +50 DPS from better Bloodthirst usage",
        },
        {
          id: "rec-3",
          priority: "medium",
          category: "mechanics",
          title: "Improve Interrupt Accuracy",
          description: "Interrupt accuracy is 68%. Many opportunities are being missed.",
          impact: "Better interrupts reduce incoming damage and improve CC chains",
        },
      ],
      insights: [
        "Bot exhibits aggressive-burst behavior with 85% confidence",
        "Aggression: 75%, Caution: 45%, Efficiency: 85%",
        "✓ Excellent damage output",
        "✓ High-quality decision making",
        "✓ Consistent ability rotation",
        "Most common sequence: Mortal Strike → Bloodthirst → Whirlwind (15 times)",
      ],
    };

    setAnalysisResult(mockResult);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Combat Log Analyzer
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            ML-powered bot performance analysis with actionable recommendations
          </p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Upload Section */}
        {!analysisResult && (
          <div className="mb-8">
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
                isDragActive
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                  : "border-gray-300 dark:border-gray-600 hover:border-gray-400"
              }`}
            >
              <input {...getInputProps()} />
              <div className="space-y-4">
                <div className="text-6xl">📊</div>
                <div>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">
                    {isDragActive ? "Drop combat log here" : "Upload Combat Log"}
                  </p>
                  <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                    Drag & drop or click to select a .txt or .log file
                  </p>
                </div>
              </div>
            </div>

            {/* Configuration */}
            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Bot Name
                </label>
                <input
                  type="text"
                  value={selectedBot}
                  onChange={(e) => setSelectedBot(e.target.value)}
                  placeholder="Enter bot name"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Class
                </label>
                <select
                  value={className}
                  onChange={(e) => setClassName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                >
                  <option value="">Select class</option>
                  <option value="warrior">Warrior</option>
                  <option value="mage">Mage</option>
                  <option value="rogue">Rogue</option>
                  <option value="priest">Priest</option>
                  <option value="hunter">Hunter</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Spec
                </label>
                <input
                  type="text"
                  value={spec}
                  onChange={(e) => setSpec(e.target.value)}
                  placeholder="e.g., Arms, Fury"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
              </div>
            </div>
          </div>
        )}

        {/* Loading */}
        {isAnalyzing && (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-400">
              Analyzing combat log with ML models...
            </p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-8">
            <p className="text-red-800 dark:text-red-300">{error}</p>
          </div>
        )}

        {/* Analysis Results */}
        {analysisResult && (
          <div className="space-y-8">
            {/* Reset Button */}
            <button
              onClick={() => setAnalysisResult(null)}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              ← Analyze Another Log
            </button>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                  Duration
                </div>
                <div className="text-3xl font-bold text-gray-900 dark:text-white">
                  {analysisResult.summary.duration}s
                </div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">DPS</div>
                <div className="text-3xl font-bold text-blue-600">
                  {analysisResult.summary.dps.toFixed(0)}
                </div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                  Total Damage
                </div>
                <div className="text-3xl font-bold text-gray-900 dark:text-white">
                  {(analysisResult.summary.totalDamage / 1000).toFixed(0)}K
                </div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                  Percentile
                </div>
                <div className="text-3xl font-bold text-green-600">
                  {analysisResult.performance.percentile}%
                </div>
              </div>
            </div>

            {/* Performance and DPS Chart */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Performance Gauge */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                  Performance Rating
                </h2>
                <div className="flex justify-center">
                  <PerformanceGauge
                    score={analysisResult.performance.score}
                    label="Overall"
                    grade={analysisResult.performance.grade}
                    size={220}
                  />
                </div>
              </div>

              {/* DPS Chart */}
              <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                  DPS Over Time
                </h2>
                <DPSChart
                  data={analysisResult.dpsOverTime}
                  width={600}
                  height={300}
                  showPhases
                  interactive
                />
              </div>
            </div>

            {/* Ability Breakdown */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                Ability Breakdown
              </h2>
              <AbilityBreakdownChart
                data={analysisResult.abilities}
                width={800}
                height={400}
                maxItems={10}
              />
            </div>

            {/* Timeline */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                Combat Timeline
              </h2>
              <TimelineChart
                events={analysisResult.timeline}
                duration={analysisResult.summary.duration}
                width={800}
                height={300}
              />
            </div>

            {/* Recommendations */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                Recommendations
              </h2>
              <div className="space-y-4">
                {analysisResult.recommendations.map((rec) => (
                  <div
                    key={rec.id}
                    className={`border-l-4 p-4 rounded ${
                      rec.priority === "critical"
                        ? "border-red-500 bg-red-50 dark:bg-red-900/20"
                        : rec.priority === "high"
                        ? "border-orange-500 bg-orange-50 dark:bg-orange-900/20"
                        : "border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-xs font-bold px-2 py-1 rounded ${
                              rec.priority === "critical"
                                ? "bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-200"
                                : rec.priority === "high"
                                ? "bg-orange-200 dark:bg-orange-800 text-orange-800 dark:text-orange-200"
                                : "bg-yellow-200 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200"
                            }`}
                          >
                            {rec.priority.toUpperCase()}
                          </span>
                          <span className="text-xs text-gray-600 dark:text-gray-400">
                            {rec.category}
                          </span>
                        </div>
                        <h3 className="font-semibold text-gray-900 dark:text-white mt-2">
                          {rec.title}
                        </h3>
                        <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                          {rec.description}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 italic">
                          {rec.impact}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Insights */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                Key Insights
              </h2>
              <ul className="space-y-2">
                {analysisResult.insights.map((insight, idx) => (
                  <li
                    key={idx}
                    className="text-gray-700 dark:text-gray-300 flex items-start gap-2"
                  >
                    <span className="text-blue-500 mt-1">▪</span>
                    <span>{insight}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
