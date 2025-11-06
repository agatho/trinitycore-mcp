/**
 * Advanced Combat Log Analyzer - Comprehensive Analysis Tool
 *
 * Integrates all advanced analysis systems:
 * - Cooldown tracking with proc detection
 * - Decision tree analysis
 * - Combat mechanics (interrupts, CC, movement, resources)
 * - ML-based pattern detection and behavior classification
 * - Performance comparison vs baselines
 * - Comprehensive recommendation engine
 *
 * @module tools/combatloganalyzer-advanced
 */

import { readFile } from "fs/promises";
import { parseCombatLog, type CombatLogEntry, type CombatMetrics } from "./botcombatloganalyzer.js";
import { CooldownTracker, addCooldownAnalysisToCombatMetrics } from "./cooldown-tracker.js";
import { analyzeDecisionMaking, type DecisionTreeAnalysis } from "./decision-tree-analyzer.js";
import { analyzeCombatMechanics, type CombatMechanicsReport } from "./combat-mechanics-analyzer.js";
import { analyzePatterns, type PatternDetectionResult } from "./pattern-detection-ml.js";
import { PerformanceComparisonEngine, formatPerformanceReport, type PerformanceReport } from "./performance-comparison.js";
import { RecommendationEngine, formatRecommendationReport, type RecommendationReport } from "./recommendation-engine.js";

// ============================================================================
// TYPES
// ============================================================================

export interface AdvancedAnalysisOptions {
  logFile?: string;
  logText?: string;
  botName: string;
  className?: string;
  spec?: string;
  level?: number;
  includeML?: boolean;
  includeRecommendations?: boolean;
  outputFormat?: "json" | "markdown" | "summary";
}

export interface ComprehensiveAnalysisReport {
  basic: {
    summary: CombatMetrics;
    duration: number;
    events: number;
  };
  cooldowns: {
    analyses: Map<number, any>;
    procs: Map<number, any>;
    opportunities: any[];
  };
  decisions: DecisionTreeAnalysis;
  mechanics: CombatMechanicsReport;
  patterns?: PatternDetectionResult;
  performance?: PerformanceReport;
  recommendations?: RecommendationReport;
  insights: string[];
}

// ============================================================================
// MAIN ANALYSIS FUNCTION
// ============================================================================

/**
 * Perform comprehensive combat log analysis with all advanced systems
 */
export async function analyzeComprehensive(options: AdvancedAnalysisOptions): Promise<ComprehensiveAnalysisReport> {
  // Load combat log
  let logText: string;
  if (options.logFile) {
    logText = await readFile(options.logFile, "utf-8");
  } else if (options.logText) {
    logText = options.logText;
  } else {
    throw new Error("Either logFile or logText must be provided");
  }

  // Parse combat log
  const entries = parseCombatLog(logText);
  if (entries.length === 0) {
    throw new Error("No combat log entries found");
  }

  // Calculate basic metrics
  const duration = (entries[entries.length - 1].timestamp - entries[0].timestamp) / 1000;
  const botName = options.botName;

  // Basic summary
  const summary: CombatMetrics = calculateBasicMetrics(entries, botName, duration);

  // 1. Cooldown Analysis
  console.error("[Analyzer] Running cooldown and proc analysis...");
  const { cooldownAnalyses, procAnalyses, missedOpportunities } = addCooldownAnalysisToCombatMetrics(
    entries,
    botName,
    duration
  );

  // 2. Decision Tree Analysis
  console.error("[Analyzer] Analyzing decision-making patterns...");
  const decisionAnalysis = analyzeDecisionMaking(entries, botName);

  // 3. Combat Mechanics Analysis
  console.error("[Analyzer] Analyzing combat mechanics...");
  const mechanicsReport = analyzeCombatMechanics(entries, botName);

  // 4. ML Pattern Detection (optional)
  let patternResult: PatternDetectionResult | undefined;
  if (options.includeML !== false) {
    console.error("[Analyzer] Running ML pattern detection and behavior classification...");
    try {
      patternResult = analyzePatterns(
        summary,
        decisionAnalysis.decisions,
        entries
      );
    } catch (error) {
      console.error(`[Analyzer] ML analysis failed: ${error}`);
    }
  }

  // 5. Performance Comparison (optional)
  let performanceReport: PerformanceReport | undefined;
  if (options.className) {
    console.error("[Analyzer] Comparing performance vs baselines...");
    try {
      const engine = new PerformanceComparisonEngine();
      performanceReport = engine.generateReport(
        summary,
        options.className,
        options.spec,
        options.level || 60
      );
    } catch (error) {
      console.error(`[Analyzer] Performance comparison failed: ${error}`);
    }
  }

  // 6. Comprehensive Recommendations
  let recommendationReport: RecommendationReport | undefined;
  if (options.includeRecommendations !== false && patternResult && performanceReport) {
    console.error("[Analyzer] Generating comprehensive recommendations...");
    try {
      const engine = new RecommendationEngine();
      recommendationReport = engine.generateRecommendations(
        decisionAnalysis,
        cooldownAnalyses,
        procAnalyses,
        mechanicsReport,
        patternResult,
        performanceReport
      );
    } catch (error) {
      console.error(`[Analyzer] Recommendation generation failed: ${error}`);
    }
  }

  // Generate insights
  const insights = generateInsights({
    summary,
    decisionAnalysis,
    mechanicsReport,
    patternResult,
    performanceReport,
  });

  return {
    basic: {
      summary,
      duration,
      events: entries.length,
    },
    cooldowns: {
      analyses: cooldownAnalyses,
      procs: procAnalyses,
      opportunities: missedOpportunities,
    },
    decisions: decisionAnalysis,
    mechanics: mechanicsReport,
    patterns: patternResult,
    performance: performanceReport,
    recommendations: recommendationReport,
    insights,
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculate basic combat metrics
 */
function calculateBasicMetrics(entries: CombatLogEntry[], botName: string, duration: number): CombatMetrics {
  let totalDamage = 0;
  let totalHealing = 0;
  const abilityUsage: Map<string, { casts: number; totalDamage: number; totalHealing: number }> = new Map();

  for (const entry of entries) {
    if (entry.source !== botName) continue;

    // Track damage
    if (entry.type === "SPELL_DAMAGE" && entry.amount) {
      totalDamage += entry.amount;
      const ability = entry.spellName || "Unknown";
      if (!abilityUsage.has(ability)) {
        abilityUsage.set(ability, { casts: 0, totalDamage: 0, totalHealing: 0 });
      }
      abilityUsage.get(ability)!.totalDamage += entry.amount;
    }

    // Track healing
    if (entry.type === "SPELL_HEAL" && entry.amount) {
      totalHealing += entry.amount;
      const ability = entry.spellName || "Unknown";
      if (!abilityUsage.has(ability)) {
        abilityUsage.set(ability, { casts: 0, totalDamage: 0, totalHealing: 0 });
      }
      abilityUsage.get(ability)!.totalHealing += entry.amount;
    }

    // Track casts
    if (entry.type === "SPELL_CAST") {
      const ability = entry.spellName || "Unknown";
      if (!abilityUsage.has(ability)) {
        abilityUsage.set(ability, { casts: 0, totalDamage: 0, totalHealing: 0 });
      }
      abilityUsage.get(ability)!.casts++;
    }
  }

  const dps = totalDamage / duration;
  const hps = totalHealing / duration;

  return {
    startTime: entries[0].timestamp,
    endTime: entries[entries.length - 1].timestamp,
    duration,
    totalDamage,
    totalHealing,
    dps,
    hps,
    totalAbilityUsage: abilityUsage.size,
    abilityUsage: Array.from(abilityUsage.entries()).map(([name, data]) => ({
      abilityName: name,
      casts: data.casts,
      totalDamage: data.totalDamage,
      totalHealing: data.totalHealing,
      spellId: undefined,
      critRate: undefined,
    })),
    suboptimalDecisions: [],
    missedOpportunities: [],
  };
}

/**
 * Generate high-level insights from all analyses
 */
function generateInsights(data: {
  summary: CombatMetrics;
  decisionAnalysis: DecisionTreeAnalysis;
  mechanicsReport: CombatMechanicsReport;
  patternResult?: PatternDetectionResult;
  performanceReport?: PerformanceReport;
}): string[] {
  const insights: string[] = [];

  // Performance summary
  insights.push(`Combat Duration: ${data.summary.duration.toFixed(1)}s`);
  insights.push(`DPS: ${data.summary.dps?.toFixed(0) || 0}`);
  if (data.summary.hps && data.summary.hps > 0) {
    insights.push(`HPS: ${data.summary.hps.toFixed(0)}`);
  }

  // Decision quality
  insights.push(`\nDecision Quality: ${data.decisionAnalysis.qualityScore.toFixed(0)}/100`);
  if (data.decisionAnalysis.suboptimalDecisions.length > 0) {
    insights.push(`⚠ ${data.decisionAnalysis.suboptimalDecisions.length} suboptimal decisions detected`);
  }

  // Mechanics score
  insights.push(`\nCombat Mechanics Score: ${data.mechanicsReport.overallScore.toFixed(0)}/100`);
  if (data.mechanicsReport.topIssues.length > 0) {
    insights.push(`Top Issue: ${data.mechanicsReport.topIssues[0]}`);
  }

  // ML insights
  if (data.patternResult) {
    insights.push(`\nBehavior Type: ${data.patternResult.classification.primary}`);
    insights.push(`Confidence: ${data.patternResult.classification.confidence.toFixed(0)}%`);
    insights.push(`Skill Level: ${data.patternResult.skillLevel.toFixed(0)}/100`);

    if (data.patternResult.anomalies.length > 0) {
      const criticalAnomalies = data.patternResult.anomalies.filter(a => a.severity === "critical" || a.severity === "high");
      if (criticalAnomalies.length > 0) {
        insights.push(`⚠ ${criticalAnomalies.length} anomalies detected`);
      }
    }
  }

  // Performance comparison
  if (data.performanceReport) {
    insights.push(`\nPerformance Grade: ${data.performanceReport.summary.overallRating.grade}`);
    insights.push(`Percentile: ${data.performanceReport.summary.percentile.toFixed(0)}%`);

    if (data.performanceReport.summary.weaknesses.length > 0) {
      insights.push(`\nWeaknesses:`);
      for (const weakness of data.performanceReport.summary.weaknesses.slice(0, 3)) {
        insights.push(`  • ${weakness}`);
      }
    }
  }

  return insights;
}

// ============================================================================
// FORMATTING FUNCTIONS
// ============================================================================

/**
 * Format comprehensive report as markdown
 */
export function formatComprehensiveReportMarkdown(report: ComprehensiveAnalysisReport): string {
  let output = "# 🤖 Comprehensive Bot Combat Log Analysis\n\n";
  output += "=" .repeat(80) + "\n\n";

  // Executive Summary
  output += "## 📊 Executive Summary\n\n";
  output += `**Combat Duration:** ${report.basic.duration.toFixed(1)}s\n`;
  output += `**Total Events:** ${report.basic.events.toLocaleString()}\n`;
  output += `**DPS:** ${report.basic.summary.dps?.toFixed(0) || 0}\n`;
  if (report.basic.summary.hps && report.basic.summary.hps > 0) {
    output += `**HPS:** ${report.basic.summary.hps.toFixed(0)}\n`;
  }
  output += "\n";

  // Key Insights
  output += "## 💡 Key Insights\n\n";
  for (const insight of report.insights) {
    output += `${insight}\n`;
  }
  output += "\n";

  // Decision Quality
  output += "## 🎯 Decision Analysis\n\n";
  output += `**Quality Score:** ${report.decisions.qualityScore.toFixed(0)}/100\n`;
  output += `**Total Decisions:** ${report.decisions.decisions.length}\n`;
  output += `**Optimal Decisions:** ${report.decisions.decisions.filter(d => d.wasOptimal).length}\n`;
  output += `**Suboptimal Decisions:** ${report.decisions.suboptimalDecisions.length}\n\n`;

  if (report.decisions.suboptimalDecisions.length > 0) {
    output += "**Top Suboptimal Decisions:**\n";
    for (const decision of report.decisions.suboptimalDecisions.slice(0, 5)) {
      output += `  • ${decision.type}: ${decision.actualAction} instead of ${decision.optimalAction}\n`;
    }
    output += "\n";
  }

  // Combat Mechanics
  output += "## ⚔️ Combat Mechanics\n\n";
  output += `**Overall Score:** ${report.mechanics.overallScore.toFixed(0)}/100\n\n`;

  output += `**Interrupts:** ${report.mechanics.interrupts.successfulInterrupts}/${report.mechanics.interrupts.totalCastableInterrupts} (${report.mechanics.interrupts.interruptAccuracy.toFixed(0)}%)\n`;
  output += `**Crowd Control Efficiency:** ${report.mechanics.crowdControl.efficiency.toFixed(0)}%\n\n`;

  if (report.mechanics.topIssues.length > 0) {
    output += "**Top Issues:**\n";
    for (const issue of report.mechanics.topIssues) {
      output += `  • ${issue}\n`;
    }
    output += "\n";
  }

  // ML Pattern Analysis
  if (report.patterns) {
    output += "## 🧠 ML Pattern Analysis\n\n";
    output += `**Behavior Type:** ${report.patterns.classification.primary}\n`;
    output += `**Confidence:** ${report.patterns.classification.confidence.toFixed(0)}%\n`;
    output += `**Skill Level:** ${report.patterns.skillLevel.toFixed(0)}/100\n\n`;

    output += "**Behavior Dimensions:**\n";
    output += `  • Aggression: ${report.patterns.classification.features.aggression.toFixed(0)}%\n`;
    output += `  • Caution: ${report.patterns.classification.features.caution.toFixed(0)}%\n`;
    output += `  • Efficiency: ${report.patterns.classification.features.efficiency.toFixed(0)}%\n`;
    output += `  • Reactivity: ${report.patterns.classification.features.reactivity.toFixed(0)}%\n\n`;

    if (report.patterns.anomalies.length > 0) {
      const criticalAnomalies = report.patterns.anomalies.filter(a => a.severity === "critical" || a.severity === "high");
      if (criticalAnomalies.length > 0) {
        output += "**⚠ Anomalies Detected:**\n";
        for (const anomaly of criticalAnomalies) {
          output += `  • [${anomaly.severity.toUpperCase()}] ${anomaly.description}\n`;
        }
        output += "\n";
      }
    }
  }

  // Performance Comparison
  if (report.performance) {
    output += "## 📈 Performance Comparison\n\n";
    output += formatPerformanceReport(report.performance);
    output += "\n";
  }

  // Recommendations
  if (report.recommendations) {
    output += "## 🎯 Recommendations\n\n";
    output += formatRecommendationReport(report.recommendations);
    output += "\n";
  }

  output += "---\n";
  output += "*Generated by TrinityCore MCP Advanced Combat Log Analyzer*\n";

  return output;
}

/**
 * Format comprehensive report as JSON
 */
export function formatComprehensiveReportJSON(report: ComprehensiveAnalysisReport): string {
  // Convert Maps to objects for JSON serialization
  const serializable = {
    ...report,
    cooldowns: {
      analyses: Object.fromEntries(report.cooldowns.analyses),
      procs: Object.fromEntries(report.cooldowns.procs),
      opportunities: report.cooldowns.opportunities,
    },
  };

  return JSON.stringify(serializable, null, 2);
}

/**
 * Format comprehensive report as summary
 */
export function formatComprehensiveReportSummary(report: ComprehensiveAnalysisReport): string {
  let output = "# 🤖 Combat Log Analysis Summary\n\n";

  // Basic stats
  output += `Duration: ${report.basic.duration.toFixed(1)}s | DPS: ${report.basic.summary.dps?.toFixed(0) || 0}`;
  if (report.basic.summary.hps && report.basic.summary.hps > 0) {
    output += ` | HPS: ${report.basic.summary.hps.toFixed(0)}`;
  }
  output += "\n\n";

  // Scores
  output += "**Scores:**\n";
  output += `  • Decision Quality: ${report.decisions.qualityScore.toFixed(0)}/100\n`;
  output += `  • Combat Mechanics: ${report.mechanics.overallScore.toFixed(0)}/100\n`;
  if (report.patterns) {
    output += `  • Skill Level: ${report.patterns.skillLevel.toFixed(0)}/100\n`;
  }
  if (report.performance) {
    output += `  • Performance Grade: ${report.performance.summary.overallRating.grade}\n`;
  }
  output += "\n";

  // Quick recommendations
  if (report.recommendations && report.recommendations.roadmap.quickWins.length > 0) {
    output += "**🎯 Quick Wins:**\n";
    for (const rec of report.recommendations.roadmap.quickWins.slice(0, 3)) {
      output += `  • [${rec.priority.toUpperCase()}] ${rec.title}\n`;
    }
  }

  return output;
}
