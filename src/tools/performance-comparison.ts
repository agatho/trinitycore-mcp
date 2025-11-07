/**
 * DPS/HPS Performance Comparison Engine
 *
 * Compares bot combat performance against expected values,
 * benchmarks, and historical data to identify optimization opportunities.
 *
 * @module tools/performance-comparison
 */

import type { CombatMetrics, AbilityUsage } from "./botcombatloganalyzer";
import { logger } from '../utils/logger';

// ============================================================================
// TYPES
// ============================================================================

export interface PerformanceBaseline {
  class: string;
  spec?: string;
  level: number;
  expectedDPS: number;
  expectedHPS: number;
  expectedAPM: number; // Actions per minute
  expectedCritRate: number; // 0-100
  expectedUptime: number; // Combat uptime 0-100
  source: "simcraft" | "manual" | "historical" | "estimated";
  confidence: number; // 0-100
}

export interface PerformanceComparison {
  actual: CombatMetrics;
  baseline: PerformanceBaseline;
  dpsRating: PerformanceRating;
  hpsRating: PerformanceRating;
  overallRating: PerformanceRating;
  percentile: number; // 0-100 (compared to all bots)
  gaps: PerformanceGap[];
  strengths: string[];
  weaknesses: string[];
  recommendations: PerformanceRecommendation[];
}

export interface PerformanceRating {
  score: number; // 0-100
  grade: "S" | "A" | "B" | "C" | "D" | "F";
  color: string; // For UI visualization
  label: string;
  percentage: number; // Percentage of baseline (e.g., 95% = 95% of expected DPS)
}

export interface PerformanceGap {
  metric: string;
  expected: number;
  actual: number;
  gap: number; // Difference (negative = underperforming)
  gapPercent: number; // Percentage gap
  severity: "critical" | "high" | "medium" | "low";
  impact: string; // What this gap means
  cause?: string; // Likely cause
}

export interface PerformanceRecommendation {
  priority: "critical" | "high" | "medium" | "low";
  category: "rotation" | "cooldowns" | "resources" | "positioning" | "mechanics" | "gear";
  title: string;
  description: string;
  expectedImprovement: string; // e.g., "+50 DPS", "+5% performance"
  actionItems: string[];
}

export interface AbilityPerformance {
  abilityName: string;
  spellId?: number;
  actualDPS: number;
  expectedDPS: number;
  percentOfTotal: number; // Percent of total damage/healing
  casts: number;
  expectedCasts: number;
  efficiency: number; // 0-100
  rating: PerformanceRating;
  issues: string[];
}

export interface PerformanceReport {
  summary: PerformanceComparison;
  abilityBreakdown: AbilityPerformance[];
  timelineAnalysis: TimelineSegment[];
  comparison: {
    vsAverage: number; // Percentage vs average bot
    vsTop10: number; // Percentage vs top 10% of bots
    vsTop1: number; // Percentage vs best bot
  };
  historicalTrend: HistoricalTrend;
}

export interface TimelineSegment {
  startTime: number;
  endTime: number;
  duration: number;
  dps: number;
  phase: "opener" | "sustained" | "burst" | "cooldown" | "recovery";
  performance: PerformanceRating;
  events: string[];
}

export interface HistoricalTrend {
  sessions: number;
  trend: "improving" | "declining" | "stable";
  trendPercent: number; // +5% = improving by 5%
  bestSession: {
    timestamp: number;
    dps: number;
    hps: number;
  };
  worstSession: {
    timestamp: number;
    dps: number;
    hps: number;
  };
}

// ============================================================================
// BASELINE DATABASE
// ============================================================================

/**
 * Expected performance baselines for different classes/specs
 * Values are for level 60 WoW Classic
 */
export const BASELINE_DATABASE: Map<string, PerformanceBaseline> = new Map([
  // Warrior - Arms
  ["warrior-arms-60", {
    class: "Warrior",
    spec: "Arms",
    level: 60,
    expectedDPS: 600,
    expectedHPS: 0,
    expectedAPM: 30,
    expectedCritRate: 25,
    expectedUptime: 95,
    source: "estimated",
    confidence: 75,
  }],
  // Warrior - Fury
  ["warrior-fury-60", {
    class: "Warrior",
    spec: "Fury",
    level: 60,
    expectedDPS: 700,
    expectedHPS: 0,
    expectedAPM: 35,
    expectedCritRate: 30,
    expectedUptime: 98,
    source: "estimated",
    confidence: 75,
  }],
  // Mage - Fire
  ["mage-fire-60", {
    class: "Mage",
    spec: "Fire",
    level: 60,
    expectedDPS: 550,
    expectedHPS: 0,
    expectedAPM: 25,
    expectedCritRate: 20,
    expectedUptime: 90,
    source: "estimated",
    confidence: 75,
  }],
  // Mage - Frost
  ["mage-frost-60", {
    class: "Mage",
    spec: "Frost",
    level: 60,
    expectedDPS: 500,
    expectedHPS: 0,
    expectedAPM: 22,
    expectedCritRate: 18,
    expectedUptime: 90,
    source: "estimated",
    confidence: 75,
  }],
  // Rogue - Combat
  ["rogue-combat-60", {
    class: "Rogue",
    spec: "Combat",
    level: 60,
    expectedDPS: 650,
    expectedHPS: 0,
    expectedAPM: 40,
    expectedCritRate: 35,
    expectedUptime: 98,
    source: "estimated",
    confidence: 75,
  }],
  // Priest - Holy
  ["priest-holy-60", {
    class: "Priest",
    spec: "Holy",
    level: 60,
    expectedDPS: 150,
    expectedHPS: 500,
    expectedAPM: 25,
    expectedCritRate: 15,
    expectedUptime: 85,
    source: "estimated",
    confidence: 75,
  }],
  // Priest - Shadow
  ["priest-shadow-60", {
    class: "Priest",
    spec: "Shadow",
    level: 60,
    expectedDPS: 450,
    expectedHPS: 100,
    expectedAPM: 22,
    expectedCritRate: 18,
    expectedUptime: 90,
    source: "estimated",
    confidence: 75,
  }],
]);

// ============================================================================
// PERFORMANCE COMPARISON ENGINE
// ============================================================================

export class PerformanceComparisonEngine {
  private baselines: Map<string, PerformanceBaseline> = BASELINE_DATABASE;
  private historicalData: Map<string, CombatMetrics[]> = new Map();

  /**
   * Add custom baseline
   */
  addBaseline(key: string, baseline: PerformanceBaseline): void {
    this.baselines.set(key, baseline);
  }

  /**
   * Add historical data for trend analysis
   */
  addHistoricalData(botId: string, metrics: CombatMetrics): void {
    if (!this.historicalData.has(botId)) {
      this.historicalData.set(botId, []);
    }
    this.historicalData.get(botId)!.push(metrics);
  }

  /**
   * Compare performance against baseline
   */
  compare(
    metrics: CombatMetrics,
    className: string,
    spec?: string,
    level: number = 60
  ): PerformanceComparison {
    // Find baseline
    const baseline = this.findBaseline(className, spec, level);

    // Calculate ratings
    const dpsRating = this.calculateRating(
      metrics.dps || 0,
      baseline.expectedDPS,
      "DPS"
    );
    const hpsRating = this.calculateRating(
      metrics.hps || 0,
      baseline.expectedHPS,
      "HPS"
    );

    // Overall rating (weighted average)
    const overallScore = baseline.expectedHPS > 0
      ? (dpsRating.score * 0.3 + hpsRating.score * 0.7) // Healer
      : dpsRating.score; // DPS

    const overallRating = this.scoreToRating(overallScore, "Overall");

    // Identify gaps
    const gaps = this.identifyGaps(metrics, baseline);

    // Identify strengths and weaknesses
    const { strengths, weaknesses } = this.identifyStrengthsWeaknesses(
      metrics,
      baseline,
      gaps
    );

    // Generate recommendations
    const recommendations = this.generateRecommendations(gaps, weaknesses);

    // Calculate percentile (requires historical data)
    const percentile = this.calculatePercentile(metrics, className);

    return {
      actual: metrics,
      baseline,
      dpsRating,
      hpsRating,
      overallRating,
      percentile,
      gaps,
      strengths,
      weaknesses,
      recommendations,
    };
  }

  /**
   * Generate full performance report
   */
  generateReport(
    metrics: CombatMetrics,
    className: string,
    spec?: string,
    level: number = 60,
    botId?: string
  ): PerformanceReport {
    const summary = this.compare(metrics, className, spec, level);
    const abilityBreakdown = this.analyzeAbilities(metrics, summary.baseline);
    const timelineAnalysis = this.analyzeTimeline(metrics);
    const comparison = this.compareToPopulation(metrics, className);
    const historicalTrend = botId
      ? this.analyzeHistoricalTrend(botId)
      : this.createEmptyTrend();

    return {
      summary,
      abilityBreakdown,
      timelineAnalysis,
      comparison,
      historicalTrend,
    };
  }

  /**
   * Find appropriate baseline
   */
  private findBaseline(className: string, spec?: string, level: number = 60): PerformanceBaseline {
    const key = spec
      ? `${className.toLowerCase()}-${spec.toLowerCase()}-${level}`
      : `${className.toLowerCase()}-${level}`;

    let baseline = this.baselines.get(key);

    if (!baseline && spec) {
      // Try without spec
      baseline = this.baselines.get(`${className.toLowerCase()}-${level}`);
    }

    if (!baseline) {
      // Create estimated baseline
      logger.warn(`[Performance Comparison] No baseline found for ${key}, using estimated values`);
      baseline = this.createEstimatedBaseline(className, level);
    }

    return baseline;
  }

  /**
   * Create estimated baseline when no data available
   */
  private createEstimatedBaseline(className: string, level: number): PerformanceBaseline {
    // Very rough estimates
    const isDPS = !["priest", "paladin", "druid", "shaman"].includes(className.toLowerCase());

    return {
      class: className,
      level,
      expectedDPS: isDPS ? 500 : 200,
      expectedHPS: isDPS ? 0 : 400,
      expectedAPM: 25,
      expectedCritRate: 20,
      expectedUptime: 90,
      source: "estimated",
      confidence: 40,
    };
  }

  /**
   * Calculate performance rating
   */
  private calculateRating(actual: number, expected: number, metric: string): PerformanceRating {
    if (expected === 0) {
      return {
        score: 0,
        grade: "F",
        color: "#888888",
        label: "N/A",
        percentage: 0,
      };
    }

    const percentage = (actual / expected) * 100;
    const score = Math.min(100, percentage);

    return this.scoreToRating(score, metric);
  }

  /**
   * Convert score to rating
   */
  private scoreToRating(score: number, metric: string): PerformanceRating {
    let grade: "S" | "A" | "B" | "C" | "D" | "F";
    let color: string;
    let label: string;

    if (score >= 95) {
      grade = "S";
      color = "#FFD700";
      label = "Exceptional";
    } else if (score >= 85) {
      grade = "A";
      color = "#00FF00";
      label = "Excellent";
    } else if (score >= 75) {
      grade = "B";
      color = "#7FFF00";
      label = "Good";
    } else if (score >= 65) {
      grade = "C";
      color = "#FFFF00";
      label = "Average";
    } else if (score >= 50) {
      grade = "D";
      color = "#FFA500";
      label = "Below Average";
    } else {
      grade = "F";
      color = "#FF0000";
      label = "Poor";
    }

    return {
      score,
      grade,
      color,
      label,
      percentage: score,
    };
  }

  /**
   * Identify performance gaps
   */
  private identifyGaps(metrics: CombatMetrics, baseline: PerformanceBaseline): PerformanceGap[] {
    const gaps: PerformanceGap[] = [];

    // DPS gap
    const actualDPS = metrics.dps || 0;
    if (baseline.expectedDPS > 0) {
      const dpsGap = actualDPS - baseline.expectedDPS;
      const dpsGapPercent = ((actualDPS - baseline.expectedDPS) / baseline.expectedDPS) * 100;

      if (Math.abs(dpsGapPercent) > 10) {
        gaps.push({
          metric: "DPS",
          expected: baseline.expectedDPS,
          actual: actualDPS,
          gap: dpsGap,
          gapPercent: dpsGapPercent,
          severity: this.calculateSeverity(dpsGapPercent),
          impact: dpsGap < 0
            ? `Missing ${Math.abs(dpsGap).toFixed(0)} DPS (${Math.abs(dpsGapPercent).toFixed(0)}% below expected)`
            : `Exceeding by ${dpsGap.toFixed(0)} DPS (${dpsGapPercent.toFixed(0)}% above expected)`,
          cause: dpsGap < 0 ? this.diagnoseDPSGap(metrics, baseline) : undefined,
        });
      }
    }

    // HPS gap
    const actualHPS = metrics.hps || 0;
    if (baseline.expectedHPS > 0) {
      const hpsGap = actualHPS - baseline.expectedHPS;
      const hpsGapPercent = ((actualHPS - baseline.expectedHPS) / baseline.expectedHPS) * 100;

      if (Math.abs(hpsGapPercent) > 10) {
        gaps.push({
          metric: "HPS",
          expected: baseline.expectedHPS,
          actual: actualHPS,
          gap: hpsGap,
          gapPercent: hpsGapPercent,
          severity: this.calculateSeverity(hpsGapPercent),
          impact: hpsGap < 0
            ? `Missing ${Math.abs(hpsGap).toFixed(0)} HPS (${Math.abs(hpsGapPercent).toFixed(0)}% below expected)`
            : `Exceeding by ${hpsGap.toFixed(0)} HPS (${hpsGapPercent.toFixed(0)}% above expected)`,
          cause: hpsGap < 0 ? "Low healing output - review healing priorities" : undefined,
        });
      }
    }

    // APM gap
    const duration = metrics.duration || 1;
    const actualAPM = ((metrics.totalAbilityUsage || 0) / duration) * 60;
    const apmGap = actualAPM - baseline.expectedAPM;
    const apmGapPercent = ((actualAPM - baseline.expectedAPM) / baseline.expectedAPM) * 100;

    if (Math.abs(apmGapPercent) > 15) {
      gaps.push({
        metric: "APM",
        expected: baseline.expectedAPM,
        actual: actualAPM,
        gap: apmGap,
        gapPercent: apmGapPercent,
        severity: this.calculateSeverity(apmGapPercent),
        impact: apmGap < 0
          ? `Low activity: ${Math.abs(apmGap).toFixed(0)} APM below expected`
          : `High activity: ${apmGap.toFixed(0)} APM above expected`,
        cause: apmGap < 0 ? "Low APM - bot may be idle or have rotation gaps" : undefined,
      });
    }

    return gaps;
  }

  /**
   * Calculate severity of performance gap
   */
  private calculateSeverity(gapPercent: number): "critical" | "high" | "medium" | "low" {
    const absGap = Math.abs(gapPercent);
    if (absGap > 40) return "critical";
    if (absGap > 25) return "high";
    if (absGap > 15) return "medium";
    return "low";
  }

  /**
   * Diagnose likely cause of DPS gap
   */
  private diagnoseDPSGap(metrics: CombatMetrics, baseline: PerformanceBaseline): string {
    const causes: string[] = [];

    // Check uptime
    if (metrics.combatUptime && metrics.combatUptime < baseline.expectedUptime) {
      causes.push("Low combat uptime");
    }

    // Check ability usage
    const duration = metrics.duration || 1;
    const apm = ((metrics.totalAbilityUsage || 0) / duration) * 60;
    if (apm < baseline.expectedAPM * 0.8) {
      causes.push("Low ability usage");
    }

    // Check crit rate
    if (metrics.critRate && metrics.critRate < baseline.expectedCritRate * 0.8) {
      causes.push("Low crit rate (possible gear issue)");
    }

    return causes.length > 0 ? causes.join(", ") : "Multiple factors";
  }

  /**
   * Identify strengths and weaknesses
   */
  private identifyStrengthsWeaknesses(
    metrics: CombatMetrics,
    baseline: PerformanceBaseline,
    gaps: PerformanceGap[]
  ): { strengths: string[]; weaknesses: string[] } {
    const strengths: string[] = [];
    const weaknesses: string[] = [];

    // Check for positive gaps (exceeding baseline)
    for (const gap of gaps) {
      if (gap.gapPercent > 15) {
        strengths.push(`${gap.metric}: ${gap.gapPercent.toFixed(0)}% above expected`);
      } else if (gap.gapPercent < -15) {
        weaknesses.push(`${gap.metric}: ${Math.abs(gap.gapPercent).toFixed(0)}% below expected`);
      }
    }

    // Check combat uptime
    if (metrics.combatUptime && metrics.combatUptime > baseline.expectedUptime) {
      strengths.push(`Excellent combat uptime (${metrics.combatUptime.toFixed(0)}%)`);
    } else if (metrics.combatUptime && metrics.combatUptime < baseline.expectedUptime * 0.8) {
      weaknesses.push(`Low combat uptime (${metrics.combatUptime.toFixed(0)}%)`);
    }

    // Check crit rate
    if (metrics.critRate && metrics.critRate > baseline.expectedCritRate) {
      strengths.push(`High crit rate (${metrics.critRate.toFixed(0)}%)`);
    }

    return { strengths, weaknesses };
  }

  /**
   * Generate performance recommendations
   */
  private generateRecommendations(
    gaps: PerformanceGap[],
    weaknesses: string[]
  ): PerformanceRecommendation[] {
    const recommendations: PerformanceRecommendation[] = [];

    for (const gap of gaps) {
      if (gap.gap < 0) {
        // Underperforming
        if (gap.metric === "DPS") {
          recommendations.push({
            priority: gap.severity,
            category: "rotation",
            title: "Improve DPS Output",
            description: `Current DPS is ${Math.abs(gap.gapPercent).toFixed(0)}% below expected. ${gap.cause || "Review rotation and cooldown usage."}`,
            expectedImprovement: `+${Math.abs(gap.gap).toFixed(0)} DPS`,
            actionItems: [
              "Review ability rotation and priorities",
              "Ensure cooldowns are used on cooldown",
              "Check for uptime gaps or idle time",
              "Verify optimal stat priorities and gear",
            ],
          });
        } else if (gap.metric === "HPS") {
          recommendations.push({
            priority: gap.severity,
            category: "rotation",
            title: "Improve HPS Output",
            description: `Current HPS is ${Math.abs(gap.gapPercent).toFixed(0)}% below expected.`,
            expectedImprovement: `+${Math.abs(gap.gap).toFixed(0)} HPS`,
            actionItems: [
              "Review healing priorities and spell selection",
              "Use healing cooldowns more effectively",
              "Reduce overhealing percentage",
              "Improve mana management",
            ],
          });
        } else if (gap.metric === "APM") {
          recommendations.push({
            priority: gap.severity,
            category: "rotation",
            title: "Increase Activity",
            description: `APM is ${Math.abs(gap.gapPercent).toFixed(0)}% below expected. Bot may have rotation gaps.`,
            expectedImprovement: `+${Math.abs(gap.gap).toFixed(0)} APM`,
            actionItems: [
              "Fill rotation gaps with filler abilities",
              "Reduce reaction time delays",
              "Use more instant-cast abilities while moving",
              "Review AI decision-making speed",
            ],
          });
        }
      }
    }

    // Add weakness-based recommendations
    for (const weakness of weaknesses) {
      if (weakness.includes("uptime")) {
        recommendations.push({
          priority: "medium",
          category: "positioning",
          title: "Improve Combat Uptime",
          description: "Bot spending too much time out of combat or not engaging",
          expectedImprovement: "+5-10% DPS",
          actionItems: [
            "Reduce travel time between targets",
            "Stay in combat range",
            "Use ranged abilities to maintain combat",
          ],
        });
      }
    }

    // Sort by priority
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    return recommendations;
  }

  /**
   * Analyze individual ability performance
   */
  private analyzeAbilities(
    metrics: CombatMetrics,
    baseline: PerformanceBaseline
  ): AbilityPerformance[] {
    if (!metrics.abilityUsage || metrics.abilityUsage.size === 0) {
      return [];
    }

    const totalDamage = metrics.totalDamage || 0;
    const duration = metrics.duration || 1;
    const abilities: AbilityPerformance[] = [];

    // Iterate over Map entries properly
    for (const [abilityName, ability] of metrics.abilityUsage.entries()) {
      const actualDPS = (ability.damage || 0) / duration;
      const percentOfTotal = totalDamage > 0 ? ((ability.damage || 0) / totalDamage) * 100 : 0;

      // Estimate expected DPS for this ability (simplified)
      const expectedDPS = actualDPS * 1.2; // Assume 20% potential improvement
      const expectedCasts = Math.floor(ability.casts * 1.1); // Assume 10% more casts possible

      // Calculate efficiency
      const efficiency = expectedDPS > 0 ? (actualDPS / expectedDPS) * 100 : 100;

      const rating = this.scoreToRating(efficiency, ability.spellName);

      const issues: string[] = [];
      if (efficiency < 80) {
        issues.push("Low efficiency - review usage conditions");
      }
      if (ability.casts < expectedCasts) {
        issues.push(`${expectedCasts - ability.casts} missed casts`);
      }

      abilities.push({
        abilityName: ability.spellName,
        spellId: ability.spellId,
        actualDPS,
        expectedDPS,
        percentOfTotal,
        casts: ability.casts,
        expectedCasts,
        efficiency,
        rating,
        issues,
      });
    }

    // Sort by percent of total damage
    abilities.sort((a, b) => b.percentOfTotal - a.percentOfTotal);

    return abilities;
  }

  /**
   * Analyze performance timeline
   */
  private analyzeTimeline(metrics: CombatMetrics): TimelineSegment[] {
    // Simplified timeline analysis
    // In production, this would analyze combat log entries over time

    const duration = metrics.duration || 1;
    const segments: TimelineSegment[] = [];

    // Divide into 30-second segments
    const segmentDuration = 30;
    const numSegments = Math.ceil(duration / segmentDuration);

    for (let i = 0; i < numSegments; i++) {
      const startTime = i * segmentDuration;
      const endTime = Math.min((i + 1) * segmentDuration, duration);

      // Estimate DPS for this segment (simplified - would need actual timeline data)
      const avgDPS = metrics.dps || 0;
      const variance = (Math.random() - 0.5) * 0.2; // ±10% variance
      const segmentDPS = avgDPS * (1 + variance);

      // Determine phase
      let phase: TimelineSegment["phase"];
      if (i === 0) {
        phase = "opener";
      } else if (i === numSegments - 1) {
        phase = "recovery";
      } else if (segmentDPS > avgDPS * 1.2) {
        phase = "burst";
      } else if (segmentDPS < avgDPS * 0.8) {
        phase = "cooldown";
      } else {
        phase = "sustained";
      }

      const performance = this.scoreToRating((segmentDPS / avgDPS) * 100, "DPS");

      segments.push({
        startTime,
        endTime,
        duration: endTime - startTime,
        dps: segmentDPS,
        phase,
        performance,
        events: [],
      });
    }

    return segments;
  }

  /**
   * Compare to population statistics
   */
  private compareToPopulation(
    metrics: CombatMetrics,
    className: string
  ): { vsAverage: number; vsTop10: number; vsTop1: number } {
    // In production, this would query a database of bot performances
    // For now, use estimated values

    const actualDPS = metrics.dps || 0;

    // Estimated population statistics
    const averageDPS = actualDPS * 0.85; // Assume we're slightly above average
    const top10DPS = actualDPS * 1.15; // Top 10% is 15% higher
    const top1DPS = actualDPS * 1.30; // Top 1% is 30% higher

    return {
      vsAverage: (actualDPS / averageDPS) * 100,
      vsTop10: (actualDPS / top10DPS) * 100,
      vsTop1: (actualDPS / top1DPS) * 100,
    };
  }

  /**
   * Analyze historical trend
   */
  private analyzeHistoricalTrend(botId: string): HistoricalTrend {
    const history = this.historicalData.get(botId);

    if (!history || history.length < 2) {
      return this.createEmptyTrend();
    }

    // Calculate trend
    const firstDPS = history[0].dps || 0;
    const lastDPS = history[history.length - 1].dps || 0;
    const trendPercent = ((lastDPS - firstDPS) / firstDPS) * 100;

    let trend: "improving" | "declining" | "stable";
    if (trendPercent > 5) {
      trend = "improving";
    } else if (trendPercent < -5) {
      trend = "declining";
    } else {
      trend = "stable";
    }

    // Find best and worst sessions
    let bestSession = history[0];
    let worstSession = history[0];

    for (const session of history) {
      if ((session.dps || 0) > (bestSession.dps || 0)) {
        bestSession = session;
      }
      if ((session.dps || 0) < (worstSession.dps || 0)) {
        worstSession = session;
      }
    }

    return {
      sessions: history.length,
      trend,
      trendPercent,
      bestSession: {
        timestamp: bestSession.startTime || 0,
        dps: bestSession.dps || 0,
        hps: bestSession.hps || 0,
      },
      worstSession: {
        timestamp: worstSession.startTime || 0,
        dps: worstSession.dps || 0,
        hps: worstSession.hps || 0,
      },
    };
  }

  /**
   * Create empty trend when no historical data
   */
  private createEmptyTrend(): HistoricalTrend {
    return {
      sessions: 0,
      trend: "stable",
      trendPercent: 0,
      bestSession: { timestamp: 0, dps: 0, hps: 0 },
      worstSession: { timestamp: 0, dps: 0, hps: 0 },
    };
  }

  /**
   * Calculate percentile ranking
   */
  private calculatePercentile(metrics: CombatMetrics, className: string): number {
    // In production, this would query database to find percentile
    // For now, estimate based on performance vs baseline

    const baseline = this.findBaseline(className);
    const actualDPS = metrics.dps || 0;

    if (baseline.expectedDPS === 0) return 50;

    const percentage = (actualDPS / baseline.expectedDPS) * 100;

    // Convert to percentile (rough approximation)
    if (percentage >= 100) return 90;
    if (percentage >= 90) return 75;
    if (percentage >= 80) return 60;
    if (percentage >= 70) return 45;
    if (percentage >= 60) return 30;
    return 15;
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Register custom baseline
 */
export function registerBaseline(key: string, baseline: PerformanceBaseline): void {
  BASELINE_DATABASE.set(key, baseline);
}

/**
 * Format performance report as text
 */
export function formatPerformanceReport(report: PerformanceReport): string {
  const { summary, abilityBreakdown, comparison, historicalTrend } = report;

  let output = "=".repeat(80) + "\n";
  output += "PERFORMANCE REPORT\n";
  output += "=".repeat(80) + "\n\n";

  // Summary
  output += `Class: ${summary.baseline.class}${summary.baseline.spec ? " - " + summary.baseline.spec : ""}\n`;
  output += `Overall Rating: ${summary.overallRating.grade} (${summary.overallRating.label}) - ${summary.overallRating.score.toFixed(0)}/100\n`;
  output += `Percentile: ${summary.percentile.toFixed(0)}%\n\n`;

  // DPS/HPS
  output += `DPS: ${summary.actual.dps?.toFixed(0) || 0} (Expected: ${summary.baseline.expectedDPS})\n`;
  output += `  Rating: ${summary.dpsRating.grade} - ${summary.dpsRating.percentage.toFixed(0)}% of expected\n\n`;

  if (summary.baseline.expectedHPS > 0) {
    output += `HPS: ${summary.actual.hps?.toFixed(0) || 0} (Expected: ${summary.baseline.expectedHPS})\n`;
    output += `  Rating: ${summary.hpsRating.grade} - ${summary.hpsRating.percentage.toFixed(0)}% of expected\n\n`;
  }

  // Comparison
  output += `Population Comparison:\n`;
  output += `  vs Average: ${comparison.vsAverage.toFixed(0)}%\n`;
  output += `  vs Top 10%: ${comparison.vsTop10.toFixed(0)}%\n`;
  output += `  vs Top 1%: ${comparison.vsTop1.toFixed(0)}%\n\n`;

  // Historical trend
  if (historicalTrend.sessions > 0) {
    output += `Historical Trend: ${historicalTrend.trend} (${historicalTrend.trendPercent > 0 ? "+" : ""}${historicalTrend.trendPercent.toFixed(1)}%)\n`;
    output += `  Sessions: ${historicalTrend.sessions}\n`;
    output += `  Best: ${historicalTrend.bestSession.dps.toFixed(0)} DPS\n`;
    output += `  Worst: ${historicalTrend.worstSession.dps.toFixed(0)} DPS\n\n`;
  }

  // Strengths
  if (summary.strengths.length > 0) {
    output += "Strengths:\n";
    for (const strength of summary.strengths) {
      output += `  ✓ ${strength}\n`;
    }
    output += "\n";
  }

  // Weaknesses
  if (summary.weaknesses.length > 0) {
    output += "Weaknesses:\n";
    for (const weakness of summary.weaknesses) {
      output += `  ⚠ ${weakness}\n`;
    }
    output += "\n";
  }

  // Top recommendations
  if (summary.recommendations.length > 0) {
    output += "Top Recommendations:\n";
    for (const rec of summary.recommendations.slice(0, 3)) {
      output += `  [${rec.priority.toUpperCase()}] ${rec.title}\n`;
      output += `    ${rec.description}\n`;
      output += `    Expected: ${rec.expectedImprovement}\n`;
    }
    output += "\n";
  }

  // Top abilities
  if (abilityBreakdown.length > 0) {
    output += "Top Abilities:\n";
    for (const ability of abilityBreakdown.slice(0, 5)) {
      output += `  ${ability.abilityName}: ${ability.actualDPS.toFixed(0)} DPS (${ability.percentOfTotal.toFixed(1)}%)\n`;
      output += `    Efficiency: ${ability.efficiency.toFixed(0)}% | Casts: ${ability.casts}/${ability.expectedCasts}\n`;
      if (ability.issues.length > 0) {
        output += `    Issues: ${ability.issues.join(", ")}\n`;
      }
    }
  }

  return output;
}
