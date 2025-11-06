/**
 * Recommendation Engine for Bot Combat Analysis
 *
 * Aggregates insights from all analyzers and generates prioritized,
 * actionable recommendations for bot improvement.
 *
 * @module tools/recommendation-engine
 */

import type { SuboptimalDecision, MissedOpportunity } from "./botcombatloganalyzer.js";
import type { DecisionTreeAnalysis } from "./decision-tree-analyzer.js";
import type { CooldownAnalysis, ProcAnalysis } from "./cooldown-tracker.js";
import type { CombatMechanicsReport } from "./combat-mechanics-analyzer.js";
import type { PatternDetectionResult } from "./pattern-detection-ml.js";
import type { PerformanceReport } from "./performance-comparison.js";

// ============================================================================
// TYPES
// ============================================================================

export interface Recommendation {
  id: string;
  priority: "critical" | "high" | "medium" | "low";
  category: RecommendationCategory;
  title: string;
  description: string;
  impact: ImpactEstimate;
  difficulty: "easy" | "medium" | "hard";
  timeToImplement: string; // e.g., "5 minutes", "1 hour", "1 day"
  sources: string[]; // Which analyzers contributed to this recommendation
  actionSteps: ActionStep[];
  relatedRecommendations: string[]; // IDs of related recommendations
  tags: string[];
}

export type RecommendationCategory =
  | "rotation"
  | "cooldowns"
  | "resources"
  | "positioning"
  | "mechanics"
  | "decision-making"
  | "gear"
  | "talents"
  | "general";

export interface ImpactEstimate {
  dpsGain?: number; // Estimated DPS increase
  hpsGain?: number; // Estimated HPS increase
  percentageGain?: number; // Overall performance % increase
  qualityImprovement: "major" | "moderate" | "minor";
  description: string;
}

export interface ActionStep {
  step: number;
  description: string;
  technical: boolean; // Requires code/config changes
  details?: string; // Additional technical details
  example?: string; // Example configuration or code
}

export interface ImprovementRoadmap {
  quickWins: Recommendation[]; // High impact, low effort
  shortTerm: Recommendation[]; // Implement within 1 week
  mediumTerm: Recommendation[]; // Implement within 1 month
  longTerm: Recommendation[]; // Ongoing optimization
  estimatedTotalImprovement: {
    dpsGain: number;
    hpsGain: number;
    percentageGain: number;
  };
}

export interface RecommendationReport {
  summary: RecommendationSummary;
  recommendations: Recommendation[];
  roadmap: ImprovementRoadmap;
  focusAreas: FocusArea[];
  nextSteps: string[];
}

export interface RecommendationSummary {
  totalRecommendations: number;
  byPriority: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  byCategory: Record<RecommendationCategory, number>;
  estimatedImpact: string;
  topIssue: string;
}

export interface FocusArea {
  area: string;
  score: number; // 0-100 (current performance)
  targetScore: number; // 0-100 (achievable with recommendations)
  recommendations: string[]; // Recommendation IDs
  importance: "critical" | "high" | "medium" | "low";
}

// ============================================================================
// RECOMMENDATION ENGINE
// ============================================================================

export class RecommendationEngine {
  private recommendations: Map<string, Recommendation> = new Map();
  private nextId: number = 1;

  /**
   * Generate comprehensive recommendations from all analyses
   */
  generateRecommendations(
    decisionAnalysis: DecisionTreeAnalysis,
    cooldownAnalyses: Map<number, CooldownAnalysis>,
    procAnalyses: Map<number, ProcAnalysis>,
    mechanicsReport: CombatMechanicsReport,
    patternResult: PatternDetectionResult,
    performanceReport: PerformanceReport
  ): RecommendationReport {
    this.recommendations.clear();
    this.nextId = 1;

    // Generate recommendations from each analyzer
    this.processDecisionAnalysis(decisionAnalysis);
    this.processCooldownAnalysis(cooldownAnalyses);
    this.processProcAnalysis(procAnalyses);
    this.processMechanicsReport(mechanicsReport);
    this.processPatternResult(patternResult);
    this.processPerformanceReport(performanceReport);

    // Remove duplicates and consolidate
    this.consolidateRecommendations();

    // Build roadmap
    const roadmap = this.buildRoadmap();

    // Identify focus areas
    const focusAreas = this.identifyFocusAreas(
      mechanicsReport,
      patternResult,
      performanceReport
    );

    // Generate next steps
    const nextSteps = this.generateNextSteps(roadmap);

    // Create summary
    const summary = this.createSummary();

    return {
      summary,
      recommendations: Array.from(this.recommendations.values()),
      roadmap,
      focusAreas,
      nextSteps,
    };
  }

  /**
   * Process decision tree analysis
   */
  private processDecisionAnalysis(analysis: DecisionTreeAnalysis): void {
    // Process suboptimal decisions
    const decisionTypes = new Map<string, SuboptimalDecision[]>();

    for (const decision of analysis.suboptimalDecisions) {
      if (!decisionTypes.has(decision.type)) {
        decisionTypes.set(decision.type, []);
      }
      decisionTypes.get(decision.type)!.push(decision);
    }

    for (const [type, decisions] of decisionTypes) {
      if (decisions.length >= 3) {
        this.addRecommendation({
          priority: decisions.length >= 10 ? "critical" : decisions.length >= 5 ? "high" : "medium",
          category: "decision-making",
          title: `Fix ${type} Decision Errors`,
          description: `Detected ${decisions.length} instances of ${type} decisions. This pattern suggests systematic issues in decision logic.`,
          impact: {
            percentageGain: Math.min(decisions.length * 0.5, 10),
            qualityImprovement: decisions.length >= 10 ? "major" : "moderate",
            description: `Could improve decision quality by ${Math.min(decisions.length * 0.5, 10).toFixed(1)}%`,
          },
          difficulty: "medium",
          timeToImplement: "1-2 hours",
          sources: ["Decision Tree Analysis"],
          actionSteps: [
            {
              step: 1,
              description: "Review decision tree logic for this scenario",
              technical: true,
              details: `Check conditions for: ${decisions[0].actualAction} vs ${decisions[0].optimalAction}`,
            },
            {
              step: 2,
              description: "Update decision priorities or thresholds",
              technical: true,
              example: `Adjust health threshold for ${decisions[0].optimalAction} usage`,
            },
            {
              step: 3,
              description: "Test changes with combat log replay",
              technical: false,
            },
          ],
          relatedRecommendations: [],
          tags: ["decision-making", type],
        });
      }
    }

    // Low quality score
    if (analysis.qualityScore < 70) {
      this.addRecommendation({
        priority: analysis.qualityScore < 50 ? "critical" : "high",
        category: "decision-making",
        title: "Improve Overall Decision Quality",
        description: `Decision quality score is ${analysis.qualityScore.toFixed(0)}/100. Multiple systematic issues detected.`,
        impact: {
          percentageGain: (100 - analysis.qualityScore) * 0.3,
          qualityImprovement: "major",
          description: `Could improve performance by ${((100 - analysis.qualityScore) * 0.3).toFixed(0)}% with better decisions`,
        },
        difficulty: "hard",
        timeToImplement: "1-2 days",
        sources: ["Decision Tree Analysis"],
        actionSteps: [
          {
            step: 1,
            description: "Review all decision patterns in the tree",
            technical: false,
          },
          {
            step: 2,
            description: "Identify most common failure modes",
            technical: false,
          },
          {
            step: 3,
            description: "Refactor AI decision logic",
            technical: true,
            details: "May require machine learning model retraining or rule updates",
          },
        ],
        relatedRecommendations: [],
        tags: ["decision-making", "AI", "comprehensive"],
      });
    }
  }

  /**
   * Process cooldown analysis
   */
  private processCooldownAnalysis(analyses: Map<number, CooldownAnalysis>): void {
    for (const [spellId, analysis] of analyses) {
      // Low efficiency
      if (analysis.efficiency < 70 && analysis.missedCasts > 0) {
        this.addRecommendation({
          priority: analysis.missedCasts >= 3 ? "high" : "medium",
          category: "cooldowns",
          title: `Use ${analysis.ability} More Frequently`,
          description: `${analysis.ability} efficiency is ${analysis.efficiency.toFixed(0)}% with ${analysis.missedCasts} missed casts. Using this cooldown more consistently could improve performance.`,
          impact: {
            dpsGain: analysis.missedCasts * 100, // Estimate 100 DPS per missed cast
            qualityImprovement: analysis.missedCasts >= 3 ? "moderate" : "minor",
            description: `Estimated +${analysis.missedCasts * 100} DPS from using ${analysis.ability} on cooldown`,
          },
          difficulty: "easy",
          timeToImplement: "15 minutes",
          sources: ["Cooldown Tracker"],
          actionSteps: [
            {
              step: 1,
              description: `Add ${analysis.ability} to priority rotation`,
              technical: true,
              details: `Cooldown: ${analysis.cooldown}s - ensure it's checked every rotation cycle`,
            },
            {
              step: 2,
              description: "Verify cooldown tracking is working correctly",
              technical: true,
            },
            {
              step: 3,
              description: "Test that ability is used immediately when available",
              technical: false,
            },
          ],
          relatedRecommendations: [],
          tags: ["cooldowns", analysis.ability],
        });
      }

      // High average delay
      if (analysis.averageDelay > 3) {
        this.addRecommendation({
          priority: "medium",
          category: "cooldowns",
          title: `Reduce ${analysis.ability} Delay`,
          description: `${analysis.ability} has an average delay of ${analysis.averageDelay.toFixed(1)}s after becoming available. This suggests the bot is not checking for cooldown availability frequently enough.`,
          impact: {
            dpsGain: Math.floor(analysis.averageDelay * 10),
            qualityImprovement: "minor",
            description: `Estimated +${Math.floor(analysis.averageDelay * 10)} DPS from faster cooldown usage`,
          },
          difficulty: "medium",
          timeToImplement: "30 minutes",
          sources: ["Cooldown Tracker"],
          actionSteps: [
            {
              step: 1,
              description: "Increase cooldown check frequency in AI update loop",
              technical: true,
              details: "Check cooldowns every 0.5s instead of 1.0s",
            },
            {
              step: 2,
              description: "Add cooldown-ready event trigger",
              technical: true,
              example: "Trigger immediate check when cooldown becomes available",
            },
          ],
          relatedRecommendations: [],
          tags: ["cooldowns", "reaction-time", analysis.ability],
        });
      }
    }
  }

  /**
   * Process proc analysis
   */
  private processProcAnalysis(analyses: Map<number, ProcAnalysis>): void {
    for (const [spellId, analysis] of analyses) {
      // Wasted procs
      if (analysis.wastedProcs > 2) {
        this.addRecommendation({
          priority: "high",
          category: "resources",
          title: `Stop Wasting ${analysis.buff} Procs`,
          description: `${analysis.wastedProcs} procs of ${analysis.buff} were wasted by refreshing while already active. This represents significant lost uptime.`,
          impact: {
            percentageGain: (analysis.wastedProcs / analysis.totalProcs) * 5,
            qualityImprovement: "moderate",
            description: `Could gain ${((analysis.wastedProcs / analysis.totalProcs) * 5).toFixed(1)}% performance by using procs fully`,
          },
          difficulty: "easy",
          timeToImplement: "15 minutes",
          sources: ["Cooldown Tracker - Proc Analysis"],
          actionSteps: [
            {
              step: 1,
              description: `Check if ${analysis.buff} is active before using the ability that triggers it`,
              technical: true,
              details: "Add buff presence check to ability conditions",
            },
            {
              step: 2,
              description: "Let proc expire naturally before reapplying",
              technical: true,
            },
          ],
          relatedRecommendations: [],
          tags: ["procs", "resources", analysis.buff],
        });
      }

      // Low uptime
      if (analysis.uptime < 70 && analysis.totalProcs > 5) {
        this.addRecommendation({
          priority: "medium",
          category: "resources",
          title: `Improve ${analysis.buff} Uptime`,
          description: `${analysis.buff} uptime is only ${analysis.uptime.toFixed(0)}% despite ${analysis.totalProcs} procs. Using abilities immediately when this buff procs would improve performance.`,
          impact: {
            percentageGain: (100 - analysis.uptime) * 0.1,
            qualityImprovement: "moderate",
            description: `Estimated ${((100 - analysis.uptime) * 0.1).toFixed(1)}% gain from better proc usage`,
          },
          difficulty: "medium",
          timeToImplement: "30 minutes",
          sources: ["Cooldown Tracker - Proc Analysis"],
          actionSteps: [
            {
              step: 1,
              description: `Increase priority of abilities when ${analysis.buff} is active`,
              technical: true,
              details: "Boost ability priority by 100 when buff is detected",
            },
            {
              step: 2,
              description: "Add proc-reactive logic to ability rotation",
              technical: true,
              example: "Interrupt normal rotation to use high-damage ability during proc",
            },
          ],
          relatedRecommendations: [],
          tags: ["procs", "uptime", analysis.buff],
        });
      }
    }
  }

  /**
   * Process combat mechanics report
   */
  private processMechanicsReport(report: CombatMechanicsReport): void {
    // Interrupt issues
    if (report.interrupts.interruptAccuracy < 70) {
      this.addRecommendation({
        priority: "high",
        category: "mechanics",
        title: "Improve Interrupt Accuracy",
        description: `Interrupt accuracy is ${report.interrupts.interruptAccuracy.toFixed(0)}%. Many opportunities are being missed.`,
        impact: {
          percentageGain: 5,
          qualityImprovement: "moderate",
          description: "Better interrupts reduce incoming damage and improve CC chains",
        },
        difficulty: "medium",
        timeToImplement: "1 hour",
        sources: ["Combat Mechanics Analyzer"],
        actionSteps: [
          {
            step: 1,
            description: "Add cast detection for enemy spellcasting",
            technical: true,
            details: "Monitor SPELL_CAST_START events for enemies",
          },
          {
            step: 2,
            description: "Implement interrupt priority system",
            technical: true,
            details: "Prioritize interrupting high-threat spells (heals, CC, big damage)",
          },
          {
            step: 3,
            description: "Tune interrupt timing to cast midpoint",
            technical: true,
            example: "Interrupt at 50% cast progress for optimal timing",
          },
        ],
        relatedRecommendations: [],
        tags: ["mechanics", "interrupts"],
      });
    }

    // CC efficiency issues
    if (report.crowdControl.ccEfficiency < 60) {
      this.addRecommendation({
        priority: "medium",
        category: "mechanics",
        title: "Improve Crowd Control Usage",
        description: `CC efficiency is ${report.crowdControl.ccEfficiency.toFixed(0)}%. Many CC effects are being broken early or overlapped.`,
        impact: {
          percentageGain: 3,
          qualityImprovement: "minor",
          description: "Better CC management improves survival and control",
        },
        difficulty: "hard",
        timeToImplement: "2 hours",
        sources: ["Combat Mechanics Analyzer"],
        actionSteps: [
          {
            step: 1,
            description: "Implement Diminishing Returns tracking",
            technical: true,
            details: "Track DR level for each CC type on each target",
          },
          {
            step: 2,
            description: "Coordinate CC chains to avoid overlap",
            technical: true,
            details: "Wait for previous CC to expire before applying new one",
          },
          {
            step: 3,
            description: "Avoid damaging CCed targets",
            technical: true,
            example: "Mark CCed targets as off-limits for AoE damage",
          },
        ],
        relatedRecommendations: [],
        tags: ["mechanics", "crowd-control"],
      });
    }

    // Overall mechanics score
    if (report.overallScore < 70) {
      this.addRecommendation({
        priority: "high",
        category: "mechanics",
        title: "Review Combat Mechanics Implementation",
        description: `Overall mechanics score is ${report.overallScore.toFixed(0)}/100. Multiple mechanical issues detected affecting performance.`,
        impact: {
          percentageGain: (100 - report.overallScore) * 0.2,
          qualityImprovement: "major",
          description: `Could gain ${((100 - report.overallScore) * 0.2).toFixed(0)}% from better mechanics`,
        },
        difficulty: "hard",
        timeToImplement: "1-2 days",
        sources: ["Combat Mechanics Analyzer"],
        actionSteps: [
          {
            step: 1,
            description: "Review all top issues from mechanics analysis",
            technical: false,
          },
          {
            step: 2,
            description: "Prioritize fixes by impact",
            technical: false,
          },
          {
            step: 3,
            description: "Implement fixes systematically",
            technical: true,
          },
        ],
        relatedRecommendations: [],
        tags: ["mechanics", "comprehensive"],
      });
    }
  }

  /**
   * Process pattern detection results
   */
  private processPatternResult(result: PatternDetectionResult): void {
    // Low skill level
    if (result.skillLevel < 70) {
      this.addRecommendation({
        priority: result.skillLevel < 50 ? "critical" : "high",
        category: "general",
        title: "Improve Overall Bot Skill Level",
        description: `Bot skill level is ${result.skillLevel.toFixed(0)}/100 (${result.classification.primary} playstyle). Multiple areas need improvement.`,
        impact: {
          percentageGain: (100 - result.skillLevel) * 0.5,
          qualityImprovement: "major",
          description: `Estimated ${((100 - result.skillLevel) * 0.5).toFixed(0)}% overall performance gain possible`,
        },
        difficulty: "hard",
        timeToImplement: "Ongoing",
        sources: ["Pattern Detection ML"],
        actionSteps: [
          {
            step: 1,
            description: "Focus on decision quality improvements",
            technical: false,
            details: `Current efficiency: ${result.classification.features.efficiency.toFixed(0)}%`,
          },
          {
            step: 2,
            description: "Improve reaction time and mechanics",
            technical: true,
            details: `Current reactivity: ${result.classification.features.reactivity.toFixed(0)}%`,
          },
          {
            step: 3,
            description: "Optimize ability rotation consistency",
            technical: true,
            details: `Current rotation score: ${result.features.abilityRotationScore.toFixed(0)}/100`,
          },
        ],
        relatedRecommendations: [],
        tags: ["skill-level", "comprehensive"],
      });
    }

    // Anomalies
    for (const anomaly of result.anomalies) {
      if (anomaly.severity === "high" || anomaly.severity === "critical") {
        this.addRecommendation({
          priority: anomaly.severity,
          category: anomaly.type.includes("performance") ? "general" : "decision-making",
          title: `Investigate ${anomaly.type}`,
          description: anomaly.description,
          impact: {
            qualityImprovement: anomaly.severity === "critical" ? "major" : "moderate",
            description: anomaly.recommendation,
          },
          difficulty: "medium",
          timeToImplement: "1 hour",
          sources: ["Pattern Detection ML - Anomaly Detection"],
          actionSteps: [
            {
              step: 1,
              description: "Review combat logs from this session",
              technical: false,
            },
            {
              step: 2,
              description: anomaly.recommendation,
              technical: true,
            },
          ],
          relatedRecommendations: [],
          tags: ["anomaly", anomaly.type],
        });
      }
    }
  }

  /**
   * Process performance report
   */
  private processPerformanceReport(report: PerformanceReport): void {
    // Process all performance recommendations
    for (const rec of report.summary.recommendations) {
      this.addRecommendation({
        priority: rec.priority,
        category: rec.category,
        title: rec.title,
        description: rec.description,
        impact: {
          dpsGain: this.extractNumberFromString(rec.expectedImprovement),
          qualityImprovement: rec.priority === "critical" ? "major" : rec.priority === "high" ? "moderate" : "minor",
          description: rec.expectedImprovement,
        },
        difficulty: rec.actionItems.length > 3 ? "hard" : rec.actionItems.length > 1 ? "medium" : "easy",
        timeToImplement: rec.priority === "critical" ? "Immediate" : rec.priority === "high" ? "1 hour" : "30 minutes",
        sources: ["Performance Comparison"],
        actionSteps: rec.actionItems.map((item, idx) => ({
          step: idx + 1,
          description: item,
          technical: item.toLowerCase().includes("review") || item.toLowerCase().includes("check") ? false : true,
        })),
        relatedRecommendations: [],
        tags: [rec.category],
      });
    }

    // Add ability-specific recommendations
    for (const ability of report.abilityBreakdown.slice(0, 5)) {
      if (ability.efficiency < 70 && ability.issues.length > 0) {
        this.addRecommendation({
          priority: "medium",
          category: "rotation",
          title: `Optimize ${ability.abilityName} Usage`,
          description: `${ability.abilityName} efficiency is ${ability.efficiency.toFixed(0)}%. Issues: ${ability.issues.join(", ")}`,
          impact: {
            dpsGain: (ability.expectedDPS - ability.actualDPS) * 0.7,
            qualityImprovement: "minor",
            description: `Estimated +${((ability.expectedDPS - ability.actualDPS) * 0.7).toFixed(0)} DPS from better ${ability.abilityName} usage`,
          },
          difficulty: "easy",
          timeToImplement: "15 minutes",
          sources: ["Performance Comparison - Ability Analysis"],
          actionSteps: [
            {
              step: 1,
              description: `Review ${ability.abilityName} usage conditions`,
              technical: true,
            },
            {
              step: 2,
              description: "Ensure ability is used more frequently or at optimal times",
              technical: true,
            },
          ],
          relatedRecommendations: [],
          tags: ["rotation", "ability-optimization", ability.abilityName],
        });
      }
    }
  }

  /**
   * Add a recommendation (helper method)
   */
  private addRecommendation(partial: Omit<Recommendation, "id">): void {
    const id = `rec-${this.nextId++}`;
    this.recommendations.set(id, { id, ...partial });
  }

  /**
   * Consolidate similar recommendations
   */
  private consolidateRecommendations(): void {
    // Group by title similarity
    const groups: Recommendation[][] = [];

    for (const rec of this.recommendations.values()) {
      let foundGroup = false;

      for (const group of groups) {
        if (this.areSimilar(rec, group[0])) {
          group.push(rec);
          foundGroup = true;
          break;
        }
      }

      if (!foundGroup) {
        groups.push([rec]);
      }
    }

    // Merge similar recommendations
    this.recommendations.clear();
    this.nextId = 1;

    for (const group of groups) {
      if (group.length === 1) {
        // Keep as-is
        const id = `rec-${this.nextId++}`;
        this.recommendations.set(id, { ...group[0], id });
      } else {
        // Merge
        const merged = this.mergeRecommendations(group);
        const id = `rec-${this.nextId++}`;
        this.recommendations.set(id, { ...merged, id });
      }
    }
  }

  /**
   * Check if two recommendations are similar
   */
  private areSimilar(a: Recommendation, b: Recommendation): boolean {
    // Same category and similar titles
    if (a.category !== b.category) return false;

    const titleA = a.title.toLowerCase();
    const titleB = b.title.toLowerCase();

    // Simple similarity check
    const wordsA = titleA.split(" ");
    const wordsB = titleB.split(" ");
    const commonWords = wordsA.filter(word => wordsB.includes(word)).length;

    return commonWords >= Math.min(wordsA.length, wordsB.length) * 0.6;
  }

  /**
   * Merge similar recommendations
   */
  private mergeRecommendations(recs: Recommendation[]): Recommendation {
    // Use highest priority
    const priorities = { critical: 4, high: 3, medium: 2, low: 1 };
    const highestPriority = recs.reduce((max, rec) =>
      priorities[rec.priority] > priorities[max.priority] ? rec : max
    ).priority;

    // Combine sources
    const sources = Array.from(new Set(recs.flatMap(r => r.sources)));

    // Combine tags
    const tags = Array.from(new Set(recs.flatMap(r => r.tags)));

    // Use first recommendation as base
    const base = recs[0];

    // Sum impacts
    const totalDPSGain = recs.reduce((sum, r) => sum + (r.impact.dpsGain || 0), 0);
    const totalHPSGain = recs.reduce((sum, r) => sum + (r.impact.hpsGain || 0), 0);
    const totalPercentageGain = recs.reduce((sum, r) => sum + (r.impact.percentageGain || 0), 0);

    return {
      ...base,
      priority: highestPriority,
      description: `${base.description} (${recs.length} related issues detected)`,
      sources,
      tags,
      impact: {
        dpsGain: totalDPSGain > 0 ? totalDPSGain : undefined,
        hpsGain: totalHPSGain > 0 ? totalHPSGain : undefined,
        percentageGain: totalPercentageGain > 0 ? totalPercentageGain : undefined,
        qualityImprovement: base.impact.qualityImprovement,
        description: base.impact.description,
      },
    };
  }

  /**
   * Build improvement roadmap
   */
  private buildRoadmap(): ImprovementRoadmap {
    const allRecs = Array.from(this.recommendations.values());

    // Quick wins: High impact, easy difficulty
    const quickWins = allRecs.filter(
      r => (r.priority === "critical" || r.priority === "high") && r.difficulty === "easy"
    );

    // Short term: Critical/high priority, medium difficulty OR medium priority, easy
    const shortTerm = allRecs.filter(
      r =>
        ((r.priority === "critical" || r.priority === "high") && r.difficulty === "medium") ||
        (r.priority === "medium" && r.difficulty === "easy")
    );

    // Medium term: All other high/medium priority
    const mediumTerm = allRecs.filter(
      r =>
        ((r.priority === "high" || r.priority === "medium") && r.difficulty === "hard") ||
        (r.priority === "medium" && r.difficulty === "medium")
    );

    // Long term: Low priority or hard difficulty
    const longTerm = allRecs.filter(
      r => r.priority === "low" || (r.difficulty === "hard" && !mediumTerm.includes(r))
    );

    // Calculate total improvement
    const estimatedTotalImprovement = {
      dpsGain: allRecs.reduce((sum, r) => sum + (r.impact.dpsGain || 0), 0),
      hpsGain: allRecs.reduce((sum, r) => sum + (r.impact.hpsGain || 0), 0),
      percentageGain: allRecs.reduce((sum, r) => sum + (r.impact.percentageGain || 0), 0),
    };

    return {
      quickWins,
      shortTerm,
      mediumTerm,
      longTerm,
      estimatedTotalImprovement,
    };
  }

  /**
   * Identify focus areas
   */
  private identifyFocusAreas(
    mechanicsReport: CombatMechanicsReport,
    patternResult: PatternDetectionResult,
    performanceReport: PerformanceReport
  ): FocusArea[] {
    const areas: FocusArea[] = [];

    // Decision making
    const decisionRecs = Array.from(this.recommendations.values()).filter(
      r => r.category === "decision-making"
    );
    if (decisionRecs.length > 0) {
      areas.push({
        area: "Decision Making",
        score: patternResult.features.optimalDecisionRate,
        targetScore: Math.min(100, patternResult.features.optimalDecisionRate + 20),
        recommendations: decisionRecs.map(r => r.id),
        importance: patternResult.features.optimalDecisionRate < 60 ? "critical" : "high",
      });
    }

    // Rotation optimization
    const rotationRecs = Array.from(this.recommendations.values()).filter(
      r => r.category === "rotation"
    );
    if (rotationRecs.length > 0) {
      areas.push({
        area: "Rotation Optimization",
        score: patternResult.features.abilityRotationScore,
        targetScore: Math.min(100, patternResult.features.abilityRotationScore + 15),
        recommendations: rotationRecs.map(r => r.id),
        importance: patternResult.features.abilityRotationScore < 70 ? "high" : "medium",
      });
    }

    // Combat mechanics
    const mechanicsRecs = Array.from(this.recommendations.values()).filter(
      r => r.category === "mechanics"
    );
    if (mechanicsRecs.length > 0) {
      areas.push({
        area: "Combat Mechanics",
        score: mechanicsReport.overallScore,
        targetScore: Math.min(100, mechanicsReport.overallScore + 20),
        recommendations: mechanicsRecs.map(r => r.id),
        importance: mechanicsReport.overallScore < 70 ? "high" : "medium",
      });
    }

    // Cooldown management
    const cooldownRecs = Array.from(this.recommendations.values()).filter(
      r => r.category === "cooldowns"
    );
    if (cooldownRecs.length > 0) {
      areas.push({
        area: "Cooldown Management",
        score: 100 - (cooldownRecs.length * 10), // Rough estimate
        targetScore: 90,
        recommendations: cooldownRecs.map(r => r.id),
        importance: cooldownRecs.length > 3 ? "high" : "medium",
      });
    }

    return areas.sort((a, b) => {
      const importanceOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return importanceOrder[a.importance] - importanceOrder[b.importance];
    });
  }

  /**
   * Generate next steps
   */
  private generateNextSteps(roadmap: ImprovementRoadmap): string[] {
    const steps: string[] = [];

    if (roadmap.quickWins.length > 0) {
      steps.push(`🎯 Start with ${roadmap.quickWins.length} quick wins for immediate impact`);
      steps.push(`   → Focus on: ${roadmap.quickWins.slice(0, 3).map(r => r.title).join(", ")}`);
    }

    if (roadmap.shortTerm.length > 0) {
      steps.push(`📅 Plan ${roadmap.shortTerm.length} short-term improvements for this week`);
    }

    if (roadmap.estimatedTotalImprovement.dpsGain > 0) {
      steps.push(
        `💡 Total potential gain: +${roadmap.estimatedTotalImprovement.dpsGain.toFixed(0)} DPS ` +
        `(${roadmap.estimatedTotalImprovement.percentageGain.toFixed(1)}% improvement)`
      );
    }

    steps.push("📊 Re-run combat log analysis after implementing changes to measure progress");
    steps.push("🔄 Iterate on recommendations based on new combat data");

    return steps;
  }

  /**
   * Create summary
   */
  private createSummary(): RecommendationSummary {
    const allRecs = Array.from(this.recommendations.values());

    const byPriority = {
      critical: allRecs.filter(r => r.priority === "critical").length,
      high: allRecs.filter(r => r.priority === "high").length,
      medium: allRecs.filter(r => r.priority === "medium").length,
      low: allRecs.filter(r => r.priority === "low").length,
    };

    const byCategory: Record<RecommendationCategory, number> = {
      rotation: 0,
      cooldowns: 0,
      resources: 0,
      positioning: 0,
      mechanics: 0,
      "decision-making": 0,
      gear: 0,
      talents: 0,
      general: 0,
    };

    for (const rec of allRecs) {
      byCategory[rec.category]++;
    }

    const totalImpact = allRecs.reduce((sum, r) => sum + (r.impact.dpsGain || 0), 0);
    const estimatedImpact = totalImpact > 0 ? `+${totalImpact.toFixed(0)} DPS potential` : "Qualitative improvements";

    const topIssues = allRecs.filter(r => r.priority === "critical" || r.priority === "high");
    const topIssue = topIssues.length > 0 ? topIssues[0].title : "No critical issues";

    return {
      totalRecommendations: allRecs.length,
      byPriority,
      byCategory,
      estimatedImpact,
      topIssue,
    };
  }

  /**
   * Extract number from string (e.g., "+50 DPS" -> 50)
   */
  private extractNumberFromString(str: string): number | undefined {
    const match = str.match(/\+?(\d+)/);
    return match ? parseInt(match[1]) : undefined;
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Format recommendation report as text
 */
export function formatRecommendationReport(report: RecommendationReport): string {
  let output = "=".repeat(80) + "\n";
  output += "RECOMMENDATION REPORT\n";
  output += "=".repeat(80) + "\n\n";

  // Summary
  output += `Total Recommendations: ${report.summary.totalRecommendations}\n`;
  output += `  Critical: ${report.summary.byPriority.critical} | High: ${report.summary.byPriority.high} | Medium: ${report.summary.byPriority.medium} | Low: ${report.summary.byPriority.low}\n\n`;
  output += `Top Issue: ${report.summary.topIssue}\n`;
  output += `Estimated Impact: ${report.summary.estimatedImpact}\n\n`;

  // Next steps
  output += "Next Steps:\n";
  for (const step of report.nextSteps) {
    output += `${step}\n`;
  }
  output += "\n";

  // Quick wins
  if (report.roadmap.quickWins.length > 0) {
    output += "🎯 QUICK WINS (High Impact, Easy Implementation):\n";
    output += "─".repeat(80) + "\n";
    for (const rec of report.roadmap.quickWins) {
      output += `\n[${rec.priority.toUpperCase()}] ${rec.title}\n`;
      output += `${rec.description}\n`;
      output += `Impact: ${rec.impact.description}\n`;
      output += `Time: ${rec.timeToImplement}\n`;
      output += "Steps:\n";
      for (const step of rec.actionSteps) {
        output += `  ${step.step}. ${step.description}\n`;
      }
    }
    output += "\n";
  }

  // Focus areas
  if (report.focusAreas.length > 0) {
    output += "📊 FOCUS AREAS:\n";
    output += "─".repeat(80) + "\n";
    for (const area of report.focusAreas) {
      output += `\n${area.area}: ${area.score.toFixed(0)}/100 → ${area.targetScore}/100\n`;
      output += `Importance: ${area.importance.toUpperCase()}\n`;
      output += `Related recommendations: ${area.recommendations.length}\n`;
    }
    output += "\n";
  }

  return output;
}
