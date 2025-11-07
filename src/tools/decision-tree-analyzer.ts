/**
 * Decision Tree Analyzer for Bot Combat Log
 *
 * Reconstructs bot decision logic from combat logs,
 * identifies patterns, and detects suboptimal decisions.
 *
 * @module tools/decision-tree-analyzer
 */

import type { CombatLogEntry, SuboptimalDecision } from "./botcombatloganalyzer";

// ============================================================================
// TYPES
// ============================================================================

export interface GameState {
  timestamp: number;
  health: number;
  healthPercent: number;
  mana: number;
  manaPercent: number;
  target?: string;
  targetHealth?: number;
  targetHealthPercent?: number;
  inCombat: boolean;
  activeBuffs: Set<string>;
  activeDebuffs: Set<string>;
  cooldowns: Map<number, number>; // spellId -> availableAt timestamp
  position?: { x: number; y: number; z: number };
  nearbyAllies: number;
  nearbyEnemies: number;
}

export interface Decision {
  timestamp: number;
  state: GameState;
  action: string; // Ability name or action
  spellId?: number;
  target?: string;
  outcome: "success" | "fail" | "resisted" | "immune";
  damage?: number;
  healing?: number;
  wasOptimal: boolean;
  optimalAction?: string; // What should have been done
  reason?: string; // Why it was suboptimal
}

export interface DecisionPattern {
  name: string;
  description: string;
  conditions: StateCondition[];
  action: string;
  frequency: number; // How often this pattern was observed
  successRate: number; // 0-100%
  averageOutcome: number; // Average damage/healing
}

export interface StateCondition {
  parameter: keyof GameState | string;
  operator: "==" | "!=" | ">" | "<" | ">=" | "<=" | "in" | "not_in";
  value: any;
}

export interface DecisionTreeNode {
  id: string;
  type: "condition" | "action";
  condition?: StateCondition;
  action?: string;
  children: DecisionTreeNode[];
  statistics: {
    totalDecisions: number;
    successfulDecisions: number;
    averageOutcome: number;
  };
}

export interface DecisionTreeAnalysis {
  tree: DecisionTreeNode;
  patterns: DecisionPattern[];
  suboptimalDecisions: SuboptimalDecision[];
  recommendations: string[];
  qualityScore: number; // 0-100
  decisions: Decision[]; // All decisions made during combat
}

// ============================================================================
// DECISION TRACKER
// ============================================================================

export class DecisionTracker {
  private decisions: Decision[] = [];
  private currentState: GameState;
  private stateHistory: GameState[] = [];

  constructor() {
    this.currentState = this.createInitialState();
  }

  /**
   * Create initial game state
   */
  private createInitialState(): GameState {
    return {
      timestamp: 0,
      health: 100,
      healthPercent: 100,
      mana: 100,
      manaPercent: 100,
      inCombat: false,
      activeBuffs: new Set(),
      activeDebuffs: new Set(),
      cooldowns: new Map(),
      nearbyAllies: 0,
      nearbyEnemies: 0,
    };
  }

  /**
   * Process combat log entry and track decisions
   */
  processEntry(entry: CombatLogEntry): void {
    // Update state based on entry
    this.updateState(entry);

    // Record decision if action was taken
    if (entry.type === "SPELL_CAST") {
      this.recordDecision(entry);
    }

    // Save state to history
    this.stateHistory.push({ ...this.currentState });
  }

  /**
   * Update current game state
   */
  private updateState(entry: CombatLogEntry): void {
    this.currentState.timestamp = entry.timestamp;

    // Update health (estimate from damage taken)
    if (entry.type === "SPELL_DAMAGE" || entry.type === "SWING_DAMAGE") {
      if (entry.target === entry.source) {
        // We took damage
        const damage = entry.amount || 0;
        this.currentState.health -= damage;
        this.currentState.healthPercent = Math.max(0, (this.currentState.health / 10000) * 100);
      }
    }

    // Update healing
    if (entry.type === "SPELL_HEAL") {
      if (entry.target === entry.source) {
        const healing = entry.amount || 0;
        this.currentState.health += healing;
        this.currentState.healthPercent = Math.min(100, (this.currentState.health / 10000) * 100);
      }
    }

    // Update buffs/debuffs
    if (entry.type === "AURA_APPLIED") {
      if (entry.spellName) {
        if (entry.target === entry.source) {
          this.currentState.activeBuffs.add(entry.spellName);
        } else {
          this.currentState.activeDebuffs.add(entry.spellName);
        }
      }
    }

    // Track combat state
    if (entry.type === "SPELL_CAST" || entry.type === "SPELL_DAMAGE" || entry.type === "SWING_DAMAGE") {
      this.currentState.inCombat = true;
    }

    // Track target
    if (entry.target && entry.target !== entry.source) {
      this.currentState.target = entry.target;
    }
  }

  /**
   * Record a decision (ability cast)
   */
  private recordDecision(entry: CombatLogEntry): void {
    if (!entry.spellName) return;

    // Evaluate if decision was optimal
    const evaluation = this.evaluateDecision(entry, this.currentState);

    const decision: Decision = {
      timestamp: entry.timestamp,
      state: { ...this.currentState },
      action: entry.spellName,
      spellId: entry.spellId,
      target: entry.target,
      outcome: "success", // Simplified for now
      wasOptimal: evaluation.wasOptimal,
      optimalAction: evaluation.optimalAction,
      reason: evaluation.reason,
    };

    this.decisions.push(decision);
  }

  /**
   * Evaluate if a decision was optimal
   */
  private evaluateDecision(
    entry: CombatLogEntry,
    state: GameState
  ): { wasOptimal: boolean; optimalAction?: string; reason?: string } {
    // Simple heuristics for evaluation
    // In production, this would use ML or more sophisticated rules

    // Example: Don't heal if at full health
    if (entry.spellName?.includes("Heal") && state.healthPercent > 95) {
      return {
        wasOptimal: false,
        optimalAction: "DPS ability",
        reason: "Healed at full health - wasted GCD and mana",
      };
    }

    // Example: Should use defensive cooldown at low health
    if (state.healthPercent < 20 && !entry.spellName?.includes("Shield") && !entry.spellName?.includes("Barrier")) {
      return {
        wasOptimal: false,
        optimalAction: "Defensive cooldown",
        reason: "Low health without using defensive ability",
      };
    }

    // Example: Don't cast long spells while moving (if we had movement data)
    // if (state.position && entry.spellName?.includes("Cast") && isMoving(state)) {
    //   return {
    //     wasOptimal: false,
    //     optimalAction: "Instant cast ability",
    //     reason: "Casting while moving wastes time",
    //   };
    // }

    return { wasOptimal: true };
  }

  /**
   * Build decision tree from recorded decisions
   */
  buildDecisionTree(): DecisionTreeNode {
    const root: DecisionTreeNode = {
      id: "root",
      type: "condition",
      condition: {
        parameter: "inCombat",
        operator: "==",
        value: true,
      },
      children: [],
      statistics: {
        totalDecisions: this.decisions.length,
        successfulDecisions: this.decisions.filter(d => d.wasOptimal).length,
        averageOutcome: 0,
      },
    };

    // Group decisions by health threshold
    const healthBranches = [
      { threshold: 30, label: "critical" },
      { threshold: 60, label: "low" },
      { threshold: 90, label: "medium" },
      { threshold: 100, label: "high" },
    ];

    for (const { threshold, label } of healthBranches) {
      const decisionsInRange = this.decisions.filter(
        d => d.state.healthPercent <= threshold && d.state.healthPercent > (threshold - 30 < 0 ? 0 : threshold - 30)
      );

      if (decisionsInRange.length === 0) continue;

      // Count ability usage in this range
      const abilityCount = new Map<string, number>();
      for (const decision of decisionsInRange) {
        abilityCount.set(decision.action, (abilityCount.get(decision.action) || 0) + 1);
      }

      // Find most common action
      let mostCommonAction = "";
      let maxCount = 0;
      for (const [action, count] of abilityCount) {
        if (count > maxCount) {
          mostCommonAction = action;
          maxCount = count;
        }
      }

      const node: DecisionTreeNode = {
        id: `health_${label}`,
        type: "action",
        action: mostCommonAction,
        children: [],
        statistics: {
          totalDecisions: decisionsInRange.length,
          successfulDecisions: decisionsInRange.filter(d => d.wasOptimal).length,
          averageOutcome: 0,
        },
      };

      root.children.push(node);
    }

    return root;
  }

  /**
   * Extract decision patterns
   */
  extractPatterns(): DecisionPattern[] {
    const patterns: DecisionPattern[] = [];

    // Group decisions by similar states
    const stateGroups = this.groupDecisionsByState();

    for (const [stateKey, decisions] of stateGroups) {
      if (decisions.length < 3) continue; // Need at least 3 occurrences

      // Find most common action in this state
      const actionCounts = new Map<string, number>();
      for (const decision of decisions) {
        actionCounts.set(decision.action, (actionCounts.get(decision.action) || 0) + 1);
      }

      const mostCommonAction = Array.from(actionCounts.entries()).sort((a, b) => b[1] - a[1])[0];

      if (!mostCommonAction) continue;

      const [action, frequency] = mostCommonAction;
      const successRate = (decisions.filter(d => d.wasOptimal).length / decisions.length) * 100;

      // Calculate average outcome (damage or healing) from decisions with this action
      const actionDecisions = decisions.filter(d => d.action === action);
      const totalOutcome = actionDecisions.reduce((sum, d) => sum + (d.damage || d.healing || 0), 0);
      const averageOutcome = actionDecisions.length > 0 ? totalOutcome / actionDecisions.length : 0;

      patterns.push({
        name: `Pattern: ${action} when ${stateKey}`,
        description: `Bot tends to use ${action} in this situation`,
        conditions: this.extractConditionsFromState(decisions[0].state),
        action,
        frequency,
        successRate,
        averageOutcome,
      });
    }

    return patterns;
  }

  /**
   * Group decisions by similar game state
   */
  private groupDecisionsByState(): Map<string, Decision[]> {
    const groups = new Map<string, Decision[]>();

    for (const decision of this.decisions) {
      // Create state key based on important parameters
      const key = this.createStateKey(decision.state);

      if (!groups.has(key)) {
        groups.set(key, []);
      }

      groups.get(key)!.push(decision);
    }

    return groups;
  }

  /**
   * Create state key for grouping
   */
  private createStateKey(state: GameState): string {
    const healthBucket = Math.floor(state.healthPercent / 20) * 20; // 0, 20, 40, 60, 80
    const manaBucket = Math.floor(state.manaPercent / 20) * 20;
    const inCombat = state.inCombat ? "combat" : "ooc";
    const buffCount = state.activeBuffs.size;

    return `${healthBucket}hp_${manaBucket}mana_${inCombat}_${buffCount}buffs`;
  }

  /**
   * Extract conditions from game state
   */
  private extractConditionsFromState(state: GameState): StateCondition[] {
    const conditions: StateCondition[] = [];

    // Health condition
    if (state.healthPercent < 30) {
      conditions.push({ parameter: "healthPercent", operator: "<", value: 30 });
    } else if (state.healthPercent < 60) {
      conditions.push({ parameter: "healthPercent", operator: "<", value: 60 });
    }

    // Combat condition
    conditions.push({ parameter: "inCombat", operator: "==", value: state.inCombat });

    // Buff conditions
    if (state.activeBuffs.size > 0) {
      for (const buff of state.activeBuffs) {
        conditions.push({ parameter: "activeBuffs", operator: "in", value: buff });
      }
    }

    return conditions;
  }

  /**
   * Get all decisions
   */
  getDecisions(): Decision[] {
    return this.decisions;
  }

  /**
   * Get state history
   */
  getStateHistory(): GameState[] {
    return this.stateHistory;
  }
}

// ============================================================================
// ANALYSIS FUNCTIONS
// ============================================================================

/**
 * Analyze bot decision-making from combat log
 */
export function analyzeDecisionMaking(
  entries: CombatLogEntry[],
  botName: string
): DecisionTreeAnalysis {
  const tracker = new DecisionTracker();

  // Filter entries for this bot
  const botEntries = entries.filter(e => e.source === botName);

  // Process all entries
  for (const entry of botEntries) {
    tracker.processEntry(entry);
  }

  // Build decision tree
  const tree = tracker.buildDecisionTree();

  // Extract patterns
  const patterns = tracker.extractPatterns();

  // Identify suboptimal decisions
  const decisions = tracker.getDecisions();
  const suboptimalDecisions: SuboptimalDecision[] = decisions
    .filter(d => !d.wasOptimal)
    .map(d => ({
      timestamp: d.timestamp,
      type: "wrong-ability",
      description: d.reason || "Suboptimal ability choice",
      actualAction: d.action,
      optimalAction: d.optimalAction || "Unknown",
      impact: 500, // Estimated damage/healing loss
    }));

  // Generate recommendations
  const recommendations = generateRecommendations(patterns, suboptimalDecisions);

  // Calculate quality score
  const qualityScore = calculateDecisionQualityScore(decisions, patterns);

  return {
    tree,
    patterns,
    suboptimalDecisions,
    recommendations,
    qualityScore,
    decisions,
  };
}

/**
 * Generate recommendations from analysis
 */
function generateRecommendations(
  patterns: DecisionPattern[],
  suboptimalDecisions: SuboptimalDecision[]
): string[] {
  const recommendations: string[] = [];

  // Recommendations from patterns
  const lowSuccessPatterns = patterns.filter(p => p.successRate < 70);
  for (const pattern of lowSuccessPatterns) {
    recommendations.push(
      `Review "${pattern.name}" - only ${pattern.successRate.toFixed(1)}% success rate`
    );
  }

  // Recommendations from suboptimal decisions
  const decisionTypes = new Map<string, number>();
  for (const decision of suboptimalDecisions) {
    decisionTypes.set(decision.type, (decisionTypes.get(decision.type) || 0) + 1);
  }

  for (const [type, count] of decisionTypes) {
    if (count >= 5) {
      recommendations.push(
        `${count} "${type}" mistakes detected - review decision logic`
      );
    }
  }

  // General recommendations
  if (suboptimalDecisions.length > 20) {
    recommendations.push("High number of suboptimal decisions - consider reviewing bot AI configuration");
  }

  return recommendations;
}

/**
 * Calculate overall decision quality score
 */
function calculateDecisionQualityScore(
  decisions: Decision[],
  patterns: DecisionPattern[]
): number {
  if (decisions.length === 0) return 0;

  // Base score from optimal decisions
  const optimalRatio = decisions.filter(d => d.wasOptimal).length / decisions.length;
  let score = optimalRatio * 70; // Up to 70 points

  // Bonus points for good patterns
  const avgPatternSuccess = patterns.reduce((sum, p) => sum + p.successRate, 0) / patterns.length;
  score += (avgPatternSuccess / 100) * 30; // Up to 30 points

  return Math.min(100, Math.max(0, score));
}

/**
 * Visualize decision tree as ASCII art
 */
export function visualizeDecisionTree(node: DecisionTreeNode, indent: number = 0): string {
  const prefix = "  ".repeat(indent);
  let result = "";

  if (node.type === "condition" && node.condition) {
    result += `${prefix}IF ${node.condition.parameter} ${node.condition.operator} ${node.condition.value}\n`;
  } else if (node.type === "action" && node.action) {
    result += `${prefix}→ ${node.action} (${node.statistics.successfulDecisions}/${node.statistics.totalDecisions} optimal)\n`;
  }

  for (const child of node.children) {
    result += visualizeDecisionTree(child, indent + 1);
  }

  return result;
}
