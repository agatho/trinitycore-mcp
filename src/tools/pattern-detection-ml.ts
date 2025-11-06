/**
 * Machine Learning Pattern Detection for Bot Combat Analysis
 *
 * Implements lightweight ML algorithms to detect patterns, classify
 * bot behavior, and identify anomalies in combat logs.
 *
 * @module tools/pattern-detection-ml
 */

import type { CombatLogEntry, CombatMetrics } from "./botcombatloganalyzer.js";
import type { Decision, GameState } from "./decision-tree-analyzer.js";

// ============================================================================
// TYPES
// ============================================================================

export interface FeatureVector {
  // Combat intensity features
  actionsPerSecond: number;
  damagePerSecond: number;
  healingPerSecond: number;
  movementFrequency: number;

  // Resource management features
  avgManaPercent: number;
  manaEfficiency: number;
  resourceWaste: number;

  // Defensive behavior features
  defensiveCooldownUsage: number;
  avgHealthWhenHealing: number;
  interruptSuccessRate: number;

  // Offensive behavior features
  burstDamageRatio: number;
  cooldownUsageRate: number;
  targetSwitchFrequency: number;

  // Positioning features
  avgDistanceToTarget: number;
  repositionFrequency: number;

  // Decision quality features
  optimalDecisionRate: number;
  reactionTime: number;
  abilityRotationScore: number;
}

export interface PatternCluster {
  id: string;
  centroid: FeatureVector;
  members: number[]; // Indices of combat sessions in this cluster
  label: string; // Human-readable label (e.g., "Aggressive Playstyle")
  characteristics: string[];
  size: number;
}

export interface BehaviorClassification {
  primary: BehaviorType;
  secondary?: BehaviorType;
  confidence: number; // 0-100
  features: {
    aggression: number; // 0-100
    caution: number; // 0-100
    efficiency: number; // 0-100
    reactivity: number; // 0-100
  };
  description: string;
}

export type BehaviorType =
  | "aggressive-burst"
  | "aggressive-sustained"
  | "defensive-reactive"
  | "defensive-proactive"
  | "balanced-optimal"
  | "balanced-safe"
  | "passive"
  | "chaotic"
  | "learning"
  | "expert";

export interface AbilitySequence {
  sequence: string[]; // Ability names in order
  frequency: number;
  avgInterval: number; // milliseconds
  context: {
    healthRange: [number, number]; // [min, max] health %
    targetCount: number;
    inCombat: boolean;
  };
  effectiveness: number; // 0-100
}

export interface Anomaly {
  timestamp: number;
  type: "behavior-shift" | "performance-spike" | "performance-drop" | "unusual-sequence" | "resource-mismanagement";
  severity: "low" | "medium" | "high" | "critical";
  description: string;
  expectedValue?: number;
  actualValue?: number;
  recommendation: string;
}

export interface PatternDetectionResult {
  features: FeatureVector;
  classification: BehaviorClassification;
  clusters: PatternCluster[];
  sequences: AbilitySequence[];
  anomalies: Anomaly[];
  insights: string[];
  skillLevel: number; // 0-100
}

// ============================================================================
// FEATURE EXTRACTION
// ============================================================================

export class FeatureExtractor {
  /**
   * Extract feature vector from combat metrics and decisions
   */
  static extract(
    metrics: CombatMetrics,
    decisions: Decision[],
    entries: CombatLogEntry[]
  ): FeatureVector {
    const duration = metrics.duration || 1;

    // Combat intensity
    const actionsPerSecond = entries.length / duration;
    const damagePerSecond = metrics.totalDamage / duration;
    const healingPerSecond = metrics.totalHealing / duration;
    const movementFrequency = this.calculateMovementFrequency(entries, duration);

    // Resource management
    const avgManaPercent = this.calculateAvgMana(decisions);
    const manaEfficiency = metrics.totalDamage / Math.max(1, metrics.totalHealing || 1);
    const resourceWaste = this.calculateResourceWaste(decisions);

    // Defensive behavior
    const defensiveCooldownUsage = this.calculateDefensiveCooldownUsage(entries, duration);
    const avgHealthWhenHealing = this.calculateAvgHealthWhenHealing(decisions);
    const interruptSuccessRate = this.calculateInterruptSuccessRate(entries);

    // Offensive behavior
    const burstDamageRatio = this.calculateBurstDamageRatio(entries);
    const cooldownUsageRate = this.calculateCooldownUsageRate(entries, duration);
    const targetSwitchFrequency = this.calculateTargetSwitchFrequency(entries, duration);

    // Positioning (placeholder - requires position data)
    const avgDistanceToTarget = 10; // Default melee range
    const repositionFrequency = 0.1;

    // Decision quality
    const optimalDecisionRate = decisions.length > 0
      ? (decisions.filter(d => d.wasOptimal).length / decisions.length) * 100
      : 0;
    const reactionTime = this.calculateAvgReactionTime(decisions);
    const abilityRotationScore = this.calculateRotationScore(entries);

    return {
      actionsPerSecond,
      damagePerSecond,
      healingPerSecond,
      movementFrequency,
      avgManaPercent,
      manaEfficiency,
      resourceWaste,
      defensiveCooldownUsage,
      avgHealthWhenHealing,
      interruptSuccessRate,
      burstDamageRatio,
      cooldownUsageRate,
      targetSwitchFrequency,
      avgDistanceToTarget,
      repositionFrequency,
      optimalDecisionRate,
      reactionTime,
      abilityRotationScore,
    };
  }

  private static calculateMovementFrequency(entries: CombatLogEntry[], duration: number): number {
    // Estimate movement from spell interruptions and position changes
    let movementEvents = 0;
    for (let i = 1; i < entries.length; i++) {
      if (entries[i].type === "SPELL_CAST" && entries[i - 1].type === "SPELL_INTERRUPT") {
        movementEvents++;
      }
    }
    return movementEvents / duration;
  }

  private static calculateAvgMana(decisions: Decision[]): number {
    if (decisions.length === 0) return 100;
    const total = decisions.reduce((sum, d) => sum + d.state.manaPercent, 0);
    return total / decisions.length;
  }

  private static calculateResourceWaste(decisions: Decision[]): number {
    // Calculate how often resources were capped or wasted
    let wasteCount = 0;
    for (const decision of decisions) {
      if (decision.state.manaPercent === 100 && decision.action.includes("Regenerate")) {
        wasteCount++;
      }
    }
    return decisions.length > 0 ? (wasteCount / decisions.length) * 100 : 0;
  }

  private static calculateDefensiveCooldownUsage(entries: CombatLogEntry[], duration: number): number {
    const defensiveSpells = ["Shield", "Barrier", "Ice Block", "Divine Shield", "Cloak", "Vanish", "Feint"];
    let count = 0;
    for (const entry of entries) {
      if (entry.type === "SPELL_CAST" && entry.spellName) {
        if (defensiveSpells.some(spell => entry.spellName!.includes(spell))) {
          count++;
        }
      }
    }
    return count / duration;
  }

  private static calculateAvgHealthWhenHealing(decisions: Decision[]): number {
    const healingDecisions = decisions.filter(d => d.action.includes("Heal"));
    if (healingDecisions.length === 0) return 100;
    const total = healingDecisions.reduce((sum, d) => sum + d.state.healthPercent, 0);
    return total / healingDecisions.length;
  }

  private static calculateInterruptSuccessRate(entries: CombatLogEntry[]): number {
    const interrupts = entries.filter(e => e.type === "SPELL_INTERRUPT");
    const successfulInterrupts = interrupts.filter(e => e.outcome === "success");
    return interrupts.length > 0 ? (successfulInterrupts.length / interrupts.length) * 100 : 0;
  }

  private static calculateBurstDamageRatio(entries: CombatLogEntry[]): number {
    // Calculate ratio of burst damage windows to sustained damage
    const damageEvents = entries.filter(e => e.type === "SPELL_DAMAGE" && e.amount);
    if (damageEvents.length === 0) return 0;

    const avgDamage = damageEvents.reduce((sum, e) => sum + (e.amount || 0), 0) / damageEvents.length;
    const burstEvents = damageEvents.filter(e => (e.amount || 0) > avgDamage * 1.5);

    return (burstEvents.length / damageEvents.length) * 100;
  }

  private static calculateCooldownUsageRate(entries: CombatLogEntry[], duration: number): number {
    const cooldownSpells = ["Recklessness", "Combustion", "Adrenaline Rush", "Bloodthirst", "Mortal Strike"];
    let count = 0;
    for (const entry of entries) {
      if (entry.type === "SPELL_CAST" && entry.spellName) {
        if (cooldownSpells.some(spell => entry.spellName!.includes(spell))) {
          count++;
        }
      }
    }
    return count / duration;
  }

  private static calculateTargetSwitchFrequency(entries: CombatLogEntry[], duration: number): number {
    let switches = 0;
    let lastTarget = "";
    for (const entry of entries) {
      if (entry.target && entry.target !== lastTarget && lastTarget !== "") {
        switches++;
      }
      if (entry.target) {
        lastTarget = entry.target;
      }
    }
    return switches / duration;
  }

  private static calculateAvgReactionTime(decisions: Decision[]): number {
    // Simplified: calculate time between low health and healing action
    let reactionTimes: number[] = [];
    for (let i = 1; i < decisions.length; i++) {
      if (decisions[i - 1].state.healthPercent < 50 && decisions[i].action.includes("Heal")) {
        const reactionTime = decisions[i].timestamp - decisions[i - 1].timestamp;
        reactionTimes.push(reactionTime);
      }
    }
    if (reactionTimes.length === 0) return 1000; // Default 1 second
    return reactionTimes.reduce((sum, t) => sum + t, 0) / reactionTimes.length;
  }

  private static calculateRotationScore(entries: CombatLogEntry[]): number {
    // Simple heuristic: consistent ability usage without gaps
    const casts = entries.filter(e => e.type === "SPELL_CAST");
    if (casts.length < 2) return 0;

    const intervals: number[] = [];
    for (let i = 1; i < casts.length; i++) {
      intervals.push(casts[i].timestamp - casts[i - 1].timestamp);
    }

    const avgInterval = intervals.reduce((sum, i) => sum + i, 0) / intervals.length;
    const variance = intervals.reduce((sum, i) => sum + Math.pow(i - avgInterval, 2), 0) / intervals.length;
    const stdDev = Math.sqrt(variance);

    // Lower variance = more consistent rotation = higher score
    const consistencyScore = Math.max(0, 100 - (stdDev / avgInterval) * 100);
    return Math.min(100, consistencyScore);
  }
}

// ============================================================================
// K-MEANS CLUSTERING
// ============================================================================

export class KMeansClustering {
  private k: number;
  private maxIterations: number;
  private centroids: FeatureVector[] = [];

  constructor(k: number = 5, maxIterations: number = 100) {
    this.k = k;
    this.maxIterations = maxIterations;
  }

  /**
   * Perform K-means clustering on feature vectors
   */
  cluster(features: FeatureVector[]): PatternCluster[] {
    if (features.length < this.k) {
      // Not enough data for clustering
      return [{
        id: "cluster-0",
        centroid: features[0] || this.createZeroVector(),
        members: features.map((_, i) => i),
        label: "Insufficient Data",
        characteristics: ["Not enough combat sessions for pattern analysis"],
        size: features.length,
      }];
    }

    // Initialize centroids randomly
    this.initializeCentroids(features);

    // Iterate until convergence or max iterations
    for (let iter = 0; iter < this.maxIterations; iter++) {
      // Assign each feature to nearest centroid
      const assignments = features.map(f => this.findNearestCentroid(f));

      // Update centroids
      const newCentroids = this.updateCentroids(features, assignments);

      // Check for convergence
      if (this.hasConverged(newCentroids)) {
        break;
      }

      this.centroids = newCentroids;
    }

    // Create cluster objects
    return this.createClusters(features);
  }

  private initializeCentroids(features: FeatureVector[]): void {
    // K-means++ initialization for better results
    this.centroids = [];

    // First centroid is random
    this.centroids.push(features[Math.floor(Math.random() * features.length)]);

    // Select remaining centroids
    for (let i = 1; i < this.k; i++) {
      const distances = features.map(f => {
        const minDist = Math.min(...this.centroids.map(c => this.distance(f, c)));
        return minDist * minDist;
      });

      // Weighted random selection
      const totalDist = distances.reduce((sum, d) => sum + d, 0);
      let random = Math.random() * totalDist;
      for (let j = 0; j < distances.length; j++) {
        random -= distances[j];
        if (random <= 0) {
          this.centroids.push(features[j]);
          break;
        }
      }
    }
  }

  private findNearestCentroid(feature: FeatureVector): number {
    let minDist = Infinity;
    let nearest = 0;
    for (let i = 0; i < this.centroids.length; i++) {
      const dist = this.distance(feature, this.centroids[i]);
      if (dist < minDist) {
        minDist = dist;
        nearest = i;
      }
    }
    return nearest;
  }

  private updateCentroids(features: FeatureVector[], assignments: number[]): FeatureVector[] {
    const newCentroids: FeatureVector[] = [];

    for (let i = 0; i < this.k; i++) {
      const members = features.filter((_, idx) => assignments[idx] === i);

      if (members.length === 0) {
        // Keep old centroid if cluster is empty
        newCentroids.push(this.centroids[i]);
        continue;
      }

      // Calculate mean of all features in cluster
      const centroid = this.createZeroVector();
      const keys = Object.keys(centroid) as (keyof FeatureVector)[];

      for (const key of keys) {
        const sum = members.reduce((s, m) => s + m[key], 0);
        centroid[key] = sum / members.length;
      }

      newCentroids.push(centroid);
    }

    return newCentroids;
  }

  private hasConverged(newCentroids: FeatureVector[]): boolean {
    if (this.centroids.length !== newCentroids.length) return false;

    for (let i = 0; i < this.centroids.length; i++) {
      if (this.distance(this.centroids[i], newCentroids[i]) > 0.01) {
        return false;
      }
    }

    return true;
  }

  private createClusters(features: FeatureVector[]): PatternCluster[] {
    const clusters: PatternCluster[] = [];
    const assignments = features.map(f => this.findNearestCentroid(f));

    for (let i = 0; i < this.k; i++) {
      const members = assignments
        .map((a, idx) => (a === i ? idx : -1))
        .filter(idx => idx !== -1);

      if (members.length === 0) continue;

      const centroid = this.centroids[i];
      const { label, characteristics } = this.labelCluster(centroid);

      clusters.push({
        id: `cluster-${i}`,
        centroid,
        members,
        label,
        characteristics,
        size: members.length,
      });
    }

    return clusters;
  }

  private labelCluster(centroid: FeatureVector): { label: string; characteristics: string[] } {
    const characteristics: string[] = [];

    // Analyze centroid features to create label
    if (centroid.damagePerSecond > 500) {
      characteristics.push("High DPS");
    }
    if (centroid.defensiveCooldownUsage > 0.1) {
      characteristics.push("Defensive playstyle");
    }
    if (centroid.optimalDecisionRate > 80) {
      characteristics.push("Optimal decision-making");
    }
    if (centroid.cooldownUsageRate > 0.2) {
      characteristics.push("Aggressive cooldown usage");
    }
    if (centroid.interruptSuccessRate > 80) {
      characteristics.push("Good interrupt timing");
    }
    if (centroid.reactionTime < 500) {
      characteristics.push("Fast reactions");
    }

    // Generate label
    let label = "Standard";
    if (characteristics.includes("High DPS") && characteristics.includes("Aggressive cooldown usage")) {
      label = "Aggressive Burst";
    } else if (characteristics.includes("Defensive playstyle")) {
      label = "Defensive/Cautious";
    } else if (characteristics.includes("Optimal decision-making")) {
      label = "Optimal/Expert";
    } else if (centroid.actionsPerSecond < 0.5) {
      label = "Passive/Learning";
    }

    return { label, characteristics };
  }

  private distance(a: FeatureVector, b: FeatureVector): number {
    // Euclidean distance with normalization
    const keys = Object.keys(a) as (keyof FeatureVector)[];
    let sum = 0;

    for (const key of keys) {
      // Normalize by expected range
      const range = this.getFeatureRange(key);
      const normalizedDiff = (a[key] - b[key]) / range;
      sum += normalizedDiff * normalizedDiff;
    }

    return Math.sqrt(sum);
  }

  private getFeatureRange(key: keyof FeatureVector): number {
    // Expected ranges for normalization
    const ranges: Record<keyof FeatureVector, number> = {
      actionsPerSecond: 5,
      damagePerSecond: 1000,
      healingPerSecond: 1000,
      movementFrequency: 1,
      avgManaPercent: 100,
      manaEfficiency: 10,
      resourceWaste: 100,
      defensiveCooldownUsage: 1,
      avgHealthWhenHealing: 100,
      interruptSuccessRate: 100,
      burstDamageRatio: 100,
      cooldownUsageRate: 1,
      targetSwitchFrequency: 1,
      avgDistanceToTarget: 40,
      repositionFrequency: 1,
      optimalDecisionRate: 100,
      reactionTime: 2000,
      abilityRotationScore: 100,
    };

    return ranges[key] || 1;
  }

  private createZeroVector(): FeatureVector {
    return {
      actionsPerSecond: 0,
      damagePerSecond: 0,
      healingPerSecond: 0,
      movementFrequency: 0,
      avgManaPercent: 0,
      manaEfficiency: 0,
      resourceWaste: 0,
      defensiveCooldownUsage: 0,
      avgHealthWhenHealing: 0,
      interruptSuccessRate: 0,
      burstDamageRatio: 0,
      cooldownUsageRate: 0,
      targetSwitchFrequency: 0,
      avgDistanceToTarget: 0,
      repositionFrequency: 0,
      optimalDecisionRate: 0,
      reactionTime: 0,
      abilityRotationScore: 0,
    };
  }
}

// ============================================================================
// BEHAVIOR CLASSIFIER
// ============================================================================

export class BehaviorClassifier {
  /**
   * Classify bot behavior based on feature vector
   */
  classify(features: FeatureVector): BehaviorClassification {
    // Calculate behavior dimensions
    const aggression = this.calculateAggression(features);
    const caution = this.calculateCaution(features);
    const efficiency = this.calculateEfficiency(features);
    const reactivity = this.calculateReactivity(features);

    // Determine primary and secondary behavior types
    const { primary, secondary, confidence } = this.determineBehaviorType(
      features,
      { aggression, caution, efficiency, reactivity }
    );

    // Generate description
    const description = this.generateDescription(primary, { aggression, caution, efficiency, reactivity });

    return {
      primary,
      secondary,
      confidence,
      features: { aggression, caution, efficiency, reactivity },
      description,
    };
  }

  private calculateAggression(features: FeatureVector): number {
    // High DPS, frequent cooldowns, burst damage, target switching
    let score = 0;
    score += Math.min(100, (features.damagePerSecond / 10) * 100);
    score += features.cooldownUsageRate * 100;
    score += features.burstDamageRatio;
    score += features.targetSwitchFrequency * 50;
    return Math.min(100, score / 4);
  }

  private calculateCaution(features: FeatureVector): number {
    // High defensive usage, healing at high health, low risk-taking
    let score = 0;
    score += features.defensiveCooldownUsage * 100;
    score += features.avgHealthWhenHealing; // Higher = more cautious
    score += 100 - features.resourceWaste; // Lower waste = more careful
    return Math.min(100, score / 3);
  }

  private calculateEfficiency(features: FeatureVector): number {
    // Optimal decisions, good rotation, resource management
    let score = 0;
    score += features.optimalDecisionRate;
    score += features.abilityRotationScore;
    score += 100 - features.resourceWaste;
    score += features.manaEfficiency * 10;
    return Math.min(100, score / 4);
  }

  private calculateReactivity(features: FeatureVector): number {
    // Fast reaction time, good interrupts, responsive to threats
    let score = 0;
    score += Math.max(0, 100 - (features.reactionTime / 20)); // Lower time = higher score
    score += features.interruptSuccessRate;
    return Math.min(100, score / 2);
  }

  private determineBehaviorType(
    features: FeatureVector,
    dimensions: { aggression: number; caution: number; efficiency: number; reactivity: number }
  ): { primary: BehaviorType; secondary?: BehaviorType; confidence: number } {
    const { aggression, caution, efficiency, reactivity } = dimensions;

    // Expert: High efficiency + high reactivity
    if (efficiency > 80 && reactivity > 70) {
      return { primary: "expert", confidence: Math.min(efficiency, reactivity) };
    }

    // Optimal balanced: High efficiency, balanced aggression/caution
    if (efficiency > 70 && Math.abs(aggression - caution) < 20) {
      return { primary: "balanced-optimal", confidence: efficiency };
    }

    // Aggressive burst: High aggression + high burst ratio
    if (aggression > 70 && features.burstDamageRatio > 30) {
      return { primary: "aggressive-burst", secondary: "aggressive-sustained", confidence: aggression };
    }

    // Aggressive sustained: High aggression + consistent DPS
    if (aggression > 70) {
      return { primary: "aggressive-sustained", confidence: aggression };
    }

    // Defensive reactive: High caution + high reactivity
    if (caution > 70 && reactivity > 60) {
      return { primary: "defensive-reactive", confidence: Math.min(caution, reactivity) };
    }

    // Defensive proactive: High caution + early defensive usage
    if (caution > 70) {
      return { primary: "defensive-proactive", confidence: caution };
    }

    // Passive: Low activity overall
    if (features.actionsPerSecond < 0.5) {
      return { primary: "passive", confidence: 100 - features.actionsPerSecond * 20 };
    }

    // Chaotic: High variance, low efficiency
    if (efficiency < 50 && features.abilityRotationScore < 40) {
      return { primary: "chaotic", confidence: 100 - efficiency };
    }

    // Learning: Moderate performance, improving patterns
    if (efficiency > 40 && efficiency < 70) {
      return { primary: "learning", confidence: 60 };
    }

    // Balanced safe: Moderate everything
    return { primary: "balanced-safe", confidence: 50 };
  }

  private generateDescription(
    primary: BehaviorType,
    dimensions: { aggression: number; caution: number; efficiency: number; reactivity: number }
  ): string {
    const descriptions: Record<BehaviorType, string> = {
      "expert": `Expert-level performance with ${dimensions.efficiency.toFixed(0)}% efficiency and ${dimensions.reactivity.toFixed(0)}% reactivity. Optimal decision-making and execution.`,
      "aggressive-burst": `Aggressive burst-oriented playstyle with ${dimensions.aggression.toFixed(0)}% aggression rating. Focuses on high damage windows with cooldown stacking.`,
      "aggressive-sustained": `Aggressive sustained damage playstyle with ${dimensions.aggression.toFixed(0)}% aggression. Maintains consistent pressure on targets.`,
      "defensive-reactive": `Defensive and reactive playstyle with ${dimensions.caution.toFixed(0)}% caution rating. Responds well to threats with defensive cooldowns.`,
      "defensive-proactive": `Defensive and proactive playstyle with ${dimensions.caution.toFixed(0)}% caution rating. Uses defensive abilities preemptively.`,
      "balanced-optimal": `Balanced playstyle with optimal decision-making (${dimensions.efficiency.toFixed(0)}% efficiency). Well-rounded performance.`,
      "balanced-safe": `Balanced but cautious playstyle. Moderate performance across all dimensions.`,
      "passive": `Passive playstyle with low activity. May need more aggressive engagement.`,
      "chaotic": `Chaotic and inconsistent playstyle with ${dimensions.efficiency.toFixed(0)}% efficiency. Needs rotation improvement.`,
      "learning": `Learning playstyle showing ${dimensions.efficiency.toFixed(0)}% efficiency. Room for improvement in optimization.`,
    };

    return descriptions[primary];
  }
}

// ============================================================================
// SEQUENCE ANALYZER
// ============================================================================

export class SequenceAnalyzer {
  private minSequenceLength: number = 3;
  private maxSequenceLength: number = 10;

  /**
   * Extract common ability sequences from combat log
   */
  extractSequences(entries: CombatLogEntry[], decisions: Decision[]): AbilitySequence[] {
    const sequences: Map<string, AbilitySequence> = new Map();

    // Extract cast sequences
    const casts = entries.filter(e => e.type === "SPELL_CAST" && e.spellName);

    for (let length = this.minSequenceLength; length <= this.maxSequenceLength; length++) {
      for (let i = 0; i <= casts.length - length; i++) {
        const sequence = casts.slice(i, i + length).map(c => c.spellName!);
        const key = sequence.join(" -> ");

        if (!sequences.has(key)) {
          // Calculate context from decisions
          const startTime = casts[i].timestamp;
          const endTime = casts[i + length - 1].timestamp;
          const relevantDecisions = decisions.filter(
            d => d.timestamp >= startTime && d.timestamp <= endTime
          );

          const avgHealth = relevantDecisions.length > 0
            ? relevantDecisions.reduce((sum, d) => sum + d.state.healthPercent, 0) / relevantDecisions.length
            : 100;

          const targetCount = new Set(casts.slice(i, i + length).map(c => c.target)).size;

          sequences.set(key, {
            sequence,
            frequency: 1,
            avgInterval: (endTime - startTime) / length,
            context: {
              healthRange: [Math.max(0, avgHealth - 10), Math.min(100, avgHealth + 10)],
              targetCount,
              inCombat: true,
            },
            effectiveness: this.calculateSequenceEffectiveness(casts.slice(i, i + length)),
          });
        } else {
          const existing = sequences.get(key)!;
          existing.frequency++;
        }
      }
    }

    // Filter to frequent sequences (at least 3 occurrences)
    return Array.from(sequences.values())
      .filter(s => s.frequency >= 3)
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 20); // Top 20 sequences
  }

  private calculateSequenceEffectiveness(casts: CombatLogEntry[]): number {
    // Simple heuristic: sequences with cooldowns and damage are more effective
    let score = 50; // Base score

    for (const cast of casts) {
      if (cast.spellName?.includes("Strike") || cast.spellName?.includes("Blast")) {
        score += 5;
      }
      if (cast.spellName?.includes("Recklessness") || cast.spellName?.includes("Combustion")) {
        score += 10;
      }
      if (cast.amount && cast.amount > 1000) {
        score += 10;
      }
    }

    return Math.min(100, score);
  }
}

// ============================================================================
// ANOMALY DETECTOR
// ============================================================================

export class AnomalyDetector {
  /**
   * Detect anomalies in combat behavior
   */
  detect(
    features: FeatureVector,
    baseline: FeatureVector,
    entries: CombatLogEntry[]
  ): Anomaly[] {
    const anomalies: Anomaly[] = [];

    // Check for performance drops
    if (features.damagePerSecond < baseline.damagePerSecond * 0.7) {
      anomalies.push({
        timestamp: entries[0]?.timestamp || 0,
        type: "performance-drop",
        severity: "high",
        description: `DPS dropped significantly: ${features.damagePerSecond.toFixed(0)} vs baseline ${baseline.damagePerSecond.toFixed(0)}`,
        expectedValue: baseline.damagePerSecond,
        actualValue: features.damagePerSecond,
        recommendation: "Check for target issues, resource starvation, or defensive posture",
      });
    }

    // Check for performance spikes (possible exploits or unusual conditions)
    if (features.damagePerSecond > baseline.damagePerSecond * 1.5) {
      anomalies.push({
        timestamp: entries[0]?.timestamp || 0,
        type: "performance-spike",
        severity: "medium",
        description: `Unusually high DPS: ${features.damagePerSecond.toFixed(0)} vs baseline ${baseline.damagePerSecond.toFixed(0)}`,
        expectedValue: baseline.damagePerSecond,
        actualValue: features.damagePerSecond,
        recommendation: "Verify cooldown stacking and optimal conditions - performance may be repeatable",
      });
    }

    // Check for behavior shifts
    if (Math.abs(features.optimalDecisionRate - baseline.optimalDecisionRate) > 30) {
      anomalies.push({
        timestamp: entries[0]?.timestamp || 0,
        type: "behavior-shift",
        severity: features.optimalDecisionRate < baseline.optimalDecisionRate ? "high" : "low",
        description: `Decision quality changed: ${features.optimalDecisionRate.toFixed(0)}% vs baseline ${baseline.optimalDecisionRate.toFixed(0)}%`,
        expectedValue: baseline.optimalDecisionRate,
        actualValue: features.optimalDecisionRate,
        recommendation: "Review AI configuration changes or combat scenario differences",
      });
    }

    // Check for resource mismanagement
    if (features.resourceWaste > baseline.resourceWaste * 2 && features.resourceWaste > 20) {
      anomalies.push({
        timestamp: entries[0]?.timestamp || 0,
        type: "resource-mismanagement",
        severity: "medium",
        description: `High resource waste: ${features.resourceWaste.toFixed(0)}% vs baseline ${baseline.resourceWaste.toFixed(0)}%`,
        expectedValue: baseline.resourceWaste,
        actualValue: features.resourceWaste,
        recommendation: "Review mana management and ability usage priorities",
      });
    }

    // Check for unusual sequences
    const unusualSequences = this.detectUnusualSequences(entries);
    if (unusualSequences.length > 0) {
      anomalies.push({
        timestamp: entries[0]?.timestamp || 0,
        type: "unusual-sequence",
        severity: "low",
        description: `Detected ${unusualSequences.length} unusual ability sequences`,
        recommendation: "Review ability rotation logic",
      });
    }

    return anomalies;
  }

  private detectUnusualSequences(entries: CombatLogEntry[]): string[] {
    // Simple heuristic: detect repeated casts of the same spell
    const unusual: string[] = [];
    const casts = entries.filter(e => e.type === "SPELL_CAST" && e.spellName);

    for (let i = 2; i < casts.length; i++) {
      if (
        casts[i].spellName === casts[i - 1].spellName &&
        casts[i].spellName === casts[i - 2].spellName
      ) {
        unusual.push(`Repeated ${casts[i].spellName} 3+ times`);
      }
    }

    return unusual;
  }
}

// ============================================================================
// MAIN ANALYSIS FUNCTION
// ============================================================================

/**
 * Perform comprehensive ML-based pattern detection
 */
export function analyzePatterns(
  metrics: CombatMetrics,
  decisions: Decision[],
  entries: CombatLogEntry[],
  historicalFeatures?: FeatureVector[]
): PatternDetectionResult {
  // Extract features
  const features = FeatureExtractor.extract(metrics, decisions, entries);

  // Classify behavior
  const classifier = new BehaviorClassifier();
  const classification = classifier.classify(features);

  // Cluster analysis (if historical data available)
  let clusters: PatternCluster[] = [];
  if (historicalFeatures && historicalFeatures.length > 5) {
    const kmeans = new KMeansClustering(5, 100);
    clusters = kmeans.cluster([...historicalFeatures, features]);
  }

  // Extract ability sequences
  const sequenceAnalyzer = new SequenceAnalyzer();
  const sequences = sequenceAnalyzer.extractSequences(entries, decisions);

  // Detect anomalies (compare to baseline if available)
  let anomalies: Anomaly[] = [];
  if (historicalFeatures && historicalFeatures.length > 0) {
    const baseline = historicalFeatures[0]; // Use first historical as baseline
    const anomalyDetector = new AnomalyDetector();
    anomalies = anomalyDetector.detect(features, baseline, entries);
  }

  // Generate insights
  const insights = generateInsights(features, classification, sequences, anomalies);

  // Calculate skill level
  const skillLevel = calculateSkillLevel(features, classification);

  return {
    features,
    classification,
    clusters,
    sequences,
    anomalies,
    insights,
    skillLevel,
  };
}

/**
 * Generate actionable insights from analysis
 */
function generateInsights(
  features: FeatureVector,
  classification: BehaviorClassification,
  sequences: AbilitySequence[],
  anomalies: Anomaly[]
): string[] {
  const insights: string[] = [];

  // Classification insights
  insights.push(`Bot exhibits ${classification.primary} behavior with ${classification.confidence.toFixed(0)}% confidence`);
  insights.push(`Aggression: ${classification.features.aggression.toFixed(0)}%, Caution: ${classification.features.caution.toFixed(0)}%, Efficiency: ${classification.features.efficiency.toFixed(0)}%`);

  // Performance insights
  if (features.damagePerSecond > 500) {
    insights.push("✓ Excellent damage output");
  } else if (features.damagePerSecond < 200) {
    insights.push("⚠ Low damage output - review offensive abilities");
  }

  // Decision quality insights
  if (features.optimalDecisionRate > 80) {
    insights.push("✓ High-quality decision making");
  } else if (features.optimalDecisionRate < 60) {
    insights.push("⚠ Decision quality needs improvement");
  }

  // Rotation insights
  if (features.abilityRotationScore > 80) {
    insights.push("✓ Consistent ability rotation");
  } else if (features.abilityRotationScore < 50) {
    insights.push("⚠ Inconsistent rotation - review ability priority");
  }

  // Sequence insights
  if (sequences.length > 0) {
    const topSequence = sequences[0];
    insights.push(`Most common sequence: ${topSequence.sequence.slice(0, 3).join(" → ")} (${topSequence.frequency} times)`);
  }

  // Anomaly insights
  if (anomalies.length > 0) {
    insights.push(`⚠ ${anomalies.length} anomalies detected - review for unusual behavior`);
  }

  return insights;
}

/**
 * Calculate overall skill level score
 */
function calculateSkillLevel(
  features: FeatureVector,
  classification: BehaviorClassification
): number {
  let score = 0;

  // Decision quality (30%)
  score += features.optimalDecisionRate * 0.3;

  // Efficiency (25%)
  score += classification.features.efficiency * 0.25;

  // Rotation (20%)
  score += features.abilityRotationScore * 0.2;

  // Reactivity (15%)
  score += classification.features.reactivity * 0.15;

  // Mechanics (10%)
  score += features.interruptSuccessRate * 0.1;

  return Math.min(100, Math.max(0, score));
}
