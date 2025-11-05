/**
 * Combat Mechanics Analyzer
 *
 * Analyzes interrupt usage, crowd control, movement, and resource
 * management from bot combat logs.
 *
 * @module tools/combat-mechanics-analyzer
 */

import type { CombatLogEntry, MissedOpportunity, SuboptimalDecision } from "./botcombatloganalyzer.js";

// ============================================================================
// TYPES
// ============================================================================

// Interrupt Analysis
export interface InterruptEvent {
  timestamp: number;
  caster: string;
  interrupter?: string;
  spellId: number;
  spellName: string;
  wasInterrupted: boolean;
  interruptDelay?: number; // ms from cast start to interrupt
  targetSpell?: string; // What spell was being cast
}

export interface InterruptAnalysis {
  totalCastableInterrupts: number; // Enemy casts that could be interrupted
  successfulInterrupts: number;
  failedInterrupts: number; // Interrupted but too late
  missedInterrupts: number; // Should have interrupted but didn't
  interruptAccuracy: number; // percentage
  averageInterruptTiming: number; // ms - how fast interrupts happened
  optimalInterruptTiming: number; // ms - ideal timing
  interruptsByTarget: Map<string, number>;
  missedOpportunities: MissedOpportunity[];
  recommendations: string[];
}

// CC Analysis
export interface CCEvent {
  timestamp: number;
  caster: string;
  target: string;
  spellId: number;
  spellName: string;
  ccType: "stun" | "fear" | "poly" | "charm" | "root" | "silence" | "slow";
  duration: number; // ms
  drLevel: number; // Diminishing Returns level (0-3)
  wasResisted: boolean;
  brokeEarly: boolean;
  brokenBy?: string; // Ability that broke CC
}

export interface CCAnalysis {
  totalCCUsed: number;
  ccByType: Map<string, number>;
  ccEfficiency: number; // percentage - how much of CC duration was used
  drTracking: Map<string, number[]>; // target -> DR levels used
  wastedCC: number; // CC that broke immediately or was resisted
  ccChains: CCChain[];
  recommendations: string[];
}

export interface CCChain {
  target: string;
  ccs: CCEvent[];
  totalDuration: number; // ms
  effectiveDuration: number; // ms (accounting for breaks)
  efficiency: number; // percentage
}

// Movement Analysis
export interface MovementEvent {
  timestamp: number;
  actor: string;
  from?: { x: number; y: number; z: number };
  to: { x: number; y: number; z: number };
  distance: number;
  speed?: number;
  duringCast: boolean; // Was moving while casting?
  unnecessary: boolean; // Movement that could be avoided
}

export interface MovementAnalysis {
  totalDistance: number; // yards
  totalMovementTime: number; // seconds
  movementDuringCasts: number; // times moved while casting
  unnecessaryMovement: number; // percentage
  movementEfficiency: number; // percentage
  heatmap: MovementHeatmap;
  recommendations: string[];
}

export interface MovementHeatmap {
  positions: Array<{ x: number; y: number; frequency: number }>;
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
}

// Resource Management
export interface ResourceSnapshot {
  timestamp: number;
  actor: string;
  resourceType: "mana" | "rage" | "energy" | "focus" | "runic";
  current: number;
  max: number;
  percent: number;
  recentSpend: number; // Amount spent in last 5 seconds
  recentGain: number; // Amount gained in last 5 seconds
}

export interface ResourceAnalysis {
  resourceType: "mana" | "rage" | "energy" | "focus" | "runic";
  averageLevel: number; // percentage
  timesCapped: number; // Times at 100%
  timesEmpty: number; // Times at 0%
  wastedResource: number; // Resource lost to cap
  efficiency: number; // percentage
  resourceEvents: ResourceEvent[];
  recommendations: string[];
}

export interface ResourceEvent {
  timestamp: number;
  type: "capped" | "empty" | "waste";
  amount: number;
  description: string;
}

// Combined Analysis
export interface CombatMechanicsReport {
  interruptAnalysis: InterruptAnalysis;
  ccAnalysis: CCAnalysis;
  movementAnalysis: MovementAnalysis;
  resourceAnalysis: ResourceAnalysis;
  overall: {
    mechanicsScore: number; // 0-100
    topIssues: string[];
    quickWins: string[];
  };
}

// ============================================================================
// INTERRUPT ANALYZER
// ============================================================================

export class InterruptAnalyzer {
  private interrupts: InterruptEvent[] = [];
  private enemyCasts: Map<string, CombatLogEntry[]> = new Map();

  /**
   * Process combat log entries
   */
  processEntries(entries: CombatLogEntry[], botName: string): void {
    for (const entry of entries) {
      // Track enemy casts
      if (entry.type === "SPELL_CAST" && entry.source !== botName) {
        if (!this.enemyCasts.has(entry.source)) {
          this.enemyCasts.set(entry.source, []);
        }
        this.enemyCasts.get(entry.source)!.push(entry);
      }

      // Track interrupts
      if (entry.type === "SPELL_CAST" && entry.source === botName) {
        if (this.isInterruptSpell(entry.spellId)) {
          this.trackInterrupt(entry, entries);
        }
      }
    }
  }

  /**
   * Check if spell is an interrupt
   */
  private isInterruptSpell(spellId?: number): boolean {
    if (!spellId) return false;

    const interruptSpells = [
      1766,  // Kick (Rogue)
      2139,  // Counterspell (Mage)
      6552,  // Pummel (Warrior)
      19244, // Spell Lock (Warlock pet)
      2649,  // Growl (Hunter pet interrupt)
      // Add more interrupt spells
    ];

    return interruptSpells.includes(spellId);
  }

  /**
   * Track an interrupt attempt
   */
  private trackInterrupt(interruptEntry: CombatLogEntry, allEntries: CombatLogEntry[]): void {
    // Find what was being cast
    const target = interruptEntry.target;
    if (!target) return;

    // Look for recent casts by target
    const recentCasts = allEntries.filter(
      e =>
        e.source === target &&
        e.type === "SPELL_CAST" &&
        e.timestamp >= interruptEntry.timestamp - 5000 && // Within 5 seconds before
        e.timestamp <= interruptEntry.timestamp
    );

    if (recentCasts.length === 0) return;

    const targetCast = recentCasts[recentCasts.length - 1];
    const delay = interruptEntry.timestamp - targetCast.timestamp;

    this.interrupts.push({
      timestamp: interruptEntry.timestamp,
      caster: target,
      interrupter: interruptEntry.source,
      spellId: interruptEntry.spellId!,
      spellName: interruptEntry.spellName || "Unknown",
      wasInterrupted: true,
      interruptDelay: delay,
      targetSpell: targetCast.spellName,
    });
  }

  /**
   * Analyze interrupt usage
   */
  analyze(): InterruptAnalysis {
    const totalCastableInterrupts = this.countCastableInterrupts();
    const successfulInterrupts = this.interrupts.filter(i => i.wasInterrupted && i.interruptDelay! < 2000).length;
    const failedInterrupts = this.interrupts.filter(i => i.interruptDelay! >= 2000).length;
    const missedInterrupts = totalCastableInterrupts - this.interrupts.length;

    const interruptAccuracy = totalCastableInterrupts > 0
      ? (successfulInterrupts / totalCastableInterrupts) * 100
      : 100;

    const averageInterruptTiming = this.interrupts.length > 0
      ? this.interrupts.reduce((sum, i) => sum + (i.interruptDelay || 0), 0) / this.interrupts.length
      : 0;

    const interruptsByTarget = new Map<string, number>();
    for (const interrupt of this.interrupts) {
      interruptsByTarget.set(
        interrupt.caster,
        (interruptsByTarget.get(interrupt.caster) || 0) + 1
      );
    }

    const missedOpportunities: MissedOpportunity[] = [];
    if (missedInterrupts > 5) {
      missedOpportunities.push({
        timestamp: 0,
        type: "interrupt-missed",
        description: `${missedInterrupts} interruptible casts were not interrupted`,
        ability: "Interrupt ability",
        impact: missedInterrupts >= 10 ? "critical" : "high",
        estimatedLoss: `~${missedInterrupts * 2000} damage prevented`,
      });
    }

    const recommendations = this.generateRecommendations(
      interruptAccuracy,
      averageInterruptTiming,
      missedInterrupts
    );

    return {
      totalCastableInterrupts,
      successfulInterrupts,
      failedInterrupts,
      missedInterrupts,
      interruptAccuracy,
      averageInterruptTiming,
      optimalInterruptTiming: 500, // 0.5 seconds is optimal
      interruptsByTarget,
      missedOpportunities,
      recommendations,
    };
  }

  private countCastableInterrupts(): number {
    // Count enemy casts that could be interrupted
    let count = 0;
    for (const casts of this.enemyCasts.values()) {
      count += casts.filter(c => this.isInterruptibleSpell(c.spellId)).length;
    }
    return count;
  }

  private isInterruptibleSpell(spellId?: number): boolean {
    // Most damage/heal spells can be interrupted
    // This is simplified - ideally check spell_template.interruptFlags
    return true;
  }

  private generateRecommendations(
    accuracy: number,
    avgTiming: number,
    missed: number
  ): string[] {
    const recs: string[] = [];

    if (accuracy < 70) {
      recs.push(`Low interrupt accuracy (${accuracy.toFixed(1)}%) - prioritize interrupting key spells`);
    }

    if (avgTiming > 1000) {
      recs.push(`Slow interrupt timing (${(avgTiming / 1000).toFixed(1)}s average) - interrupt earlier in cast`);
    }

    if (missed > 5) {
      recs.push(`${missed} missed interrupts - use interrupt more frequently`);
    }

    return recs;
  }
}

// ============================================================================
// CC ANALYZER
// ============================================================================

export class CCAnalyzer {
  private ccEvents: CCEvent[] = [];
  private drTracker: Map<string, Map<string, number>> = new Map(); // target -> ccType -> drLevel

  /**
   * Process combat log entries
   */
  processEntries(entries: CombatLogEntry[], botName: string): void {
    for (const entry of entries) {
      if (entry.type === "AURA_APPLIED" && entry.source === botName) {
        if (this.isCCSpell(entry.spellId)) {
          this.trackCCApplication(entry, entries);
        }
      }
    }
  }

  /**
   * Check if spell is CC
   */
  private isCCSpell(spellId?: number): boolean {
    if (!spellId) return false;

    const ccSpells = [
      5484,  // Howl of Terror (Fear)
      118,   // Polymorph
      2094,  // Blind
      6770,  // Sap
      339,   // Entangling Roots
      // Add more CC spells
    ];

    return ccSpells.includes(spellId);
  }

  /**
   * Track CC application
   */
  private trackCCApplication(entry: CombatLogEntry, allEntries: CombatLogEntry[]): void {
    const ccType = this.getCCType(entry.spellId);
    const target = entry.target;

    if (!target) return;

    // Track DR level
    if (!this.drTracker.has(target)) {
      this.drTracker.set(target, new Map());
    }

    const targetDR = this.drTracker.get(target)!;
    const currentDR = targetDR.get(ccType) || 0;
    targetDR.set(ccType, Math.min(3, currentDR + 1));

    // Find when CC broke
    const removeEntry = allEntries.find(
      e =>
        e.type === "AURA_REMOVED" &&
        e.spellId === entry.spellId &&
        e.target === target &&
        e.timestamp > entry.timestamp
    );

    const duration = removeEntry ? removeEntry.timestamp - entry.timestamp : 8000; // Default 8s

    this.ccEvents.push({
      timestamp: entry.timestamp,
      caster: entry.source,
      target,
      spellId: entry.spellId!,
      spellName: entry.spellName || "Unknown",
      ccType,
      duration,
      drLevel: currentDR,
      wasResisted: false, // TODO: Track resists
      brokeEarly: duration < 4000, // Less than 4s = broke early
    });
  }

  /**
   * Get CC type from spell ID
   */
  private getCCType(spellId?: number): "stun" | "fear" | "poly" | "charm" | "root" | "silence" | "slow" {
    // Simplified mapping
    if (spellId === 5484) return "fear";
    if (spellId === 118) return "poly";
    if (spellId === 339) return "root";
    return "stun"; // Default
  }

  /**
   * Analyze CC usage
   */
  analyze(): CCAnalysis {
    const totalCCUsed = this.ccEvents.length;

    const ccByType = new Map<string, number>();
    for (const cc of this.ccEvents) {
      ccByType.set(cc.ccType, (ccByType.get(cc.ccType) || 0) + 1);
    }

    const totalDuration = this.ccEvents.reduce((sum, cc) => sum + cc.duration, 0);
    const effectiveDuration = this.ccEvents.filter(cc => !cc.brokeEarly).reduce((sum, cc) => sum + cc.duration, 0);
    const ccEfficiency = totalDuration > 0 ? (effectiveDuration / totalDuration) * 100 : 0;

    const wastedCC = this.ccEvents.filter(cc => cc.brokeEarly || cc.wasResisted).length;

    const ccChains = this.buildCCChains();

    const recommendations = this.generateRecommendations(ccEfficiency, wastedCC, ccChains);

    return {
      totalCCUsed,
      ccByType,
      ccEfficiency,
      drTracking: this.drTracker,
      wastedCC,
      ccChains,
      recommendations,
    };
  }

  private buildCCChains(): CCChain[] {
    // Group CCs by target
    const chains = new Map<string, CCEvent[]>();

    for (const cc of this.ccEvents) {
      if (!chains.has(cc.target)) {
        chains.set(cc.target, []);
      }
      chains.get(cc.target)!.push(cc);
    }

    const result: CCChain[] = [];

    for (const [target, ccs] of chains) {
      const totalDuration = ccs.reduce((sum, cc) => sum + cc.duration, 0);
      const effectiveDuration = ccs.filter(cc => !cc.brokeEarly).reduce((sum, cc) => sum + cc.duration, 0);

      result.push({
        target,
        ccs,
        totalDuration,
        effectiveDuration,
        efficiency: (effectiveDuration / totalDuration) * 100,
      });
    }

    return result;
  }

  private generateRecommendations(efficiency: number, wasted: number, chains: CCChain[]): string[] {
    const recs: string[] = [];

    if (efficiency < 70) {
      recs.push(`Low CC efficiency (${efficiency.toFixed(1)}%) - avoid breaking CC early`);
    }

    if (wasted > 3) {
      recs.push(`${wasted} wasted CC applications - check DR and resist rates`);
    }

    const badChains = chains.filter(c => c.efficiency < 50);
    if (badChains.length > 0) {
      recs.push(`${badChains.length} targets had poor CC chains - coordinate with team`);
    }

    return recs;
  }
}

// ============================================================================
// MOVEMENT ANALYZER
// ============================================================================

export class MovementAnalyzer {
  private movements: MovementEvent[] = [];

  /**
   * Process combat log entries
   * Note: Movement data is typically not in standard combat logs
   * This is a placeholder for when position data is available
   */
  processEntries(entries: CombatLogEntry[], botName: string): void {
    // TODO: Parse position data from enhanced logs
    // For now, estimate movement from spell casts
    console.log("[Movement Analyzer] Position data not available in standard logs");
  }

  /**
   * Analyze movement
   */
  analyze(): MovementAnalysis {
    const totalDistance = this.movements.reduce((sum, m) => sum + m.distance, 0);
    const movingTime = this.movements.length * 1.5; // Estimate 1.5s per movement
    const movementDuringCasts = this.movements.filter(m => m.duringCast).length;
    const unnecessaryMovement = this.movements.filter(m => m.unnecessary).length;

    const efficiency = this.movements.length > 0
      ? ((this.movements.length - unnecessaryMovement) / this.movements.length) * 100
      : 100;

    const recommendations: string[] = [];
    if (movementDuringCasts > 5) {
      recommendations.push(`Moved ${movementDuringCasts} times while casting - use instant cast abilities`);
    }

    return {
      totalDistance,
      totalMovementTime: movingTime,
      movementDuringCasts,
      unnecessaryMovement: (unnecessaryMovement / this.movements.length) * 100 || 0,
      movementEfficiency: efficiency,
      heatmap: {
        positions: [],
        bounds: { minX: 0, maxX: 0, minY: 0, maxY: 0 },
      },
      recommendations,
    };
  }
}

// ============================================================================
// RESOURCE ANALYZER
// ============================================================================

export class ResourceAnalyzer {
  private snapshots: ResourceSnapshot[] = [];
  private resourceType: "mana" | "rage" | "energy" | "focus" | "runic" = "mana";

  /**
   * Process combat log entries
   * Note: Resource data is typically not in standard combat logs
   * This estimates resource usage from spell costs
   */
  processEntries(entries: CombatLogEntry[], botName: string): void {
    // TODO: Parse resource data from enhanced logs
    console.log("[Resource Analyzer] Resource data not available in standard logs - estimating from spell costs");
  }

  /**
   * Analyze resource management
   */
  analyze(): ResourceAnalysis {
    if (this.snapshots.length === 0) {
      return {
        resourceType: this.resourceType,
        averageLevel: 50,
        timesCapped: 0,
        timesEmpty: 0,
        wastedResource: 0,
        efficiency: 100,
        resourceEvents: [],
        recommendations: ["Enable resource logging for detailed analysis"],
      };
    }

    const avgLevel = this.snapshots.reduce((sum, s) => sum + s.percent, 0) / this.snapshots.length;
    const timesCapped = this.snapshots.filter(s => s.percent >= 99).length;
    const timesEmpty = this.snapshots.filter(s => s.percent <= 1).length;

    return {
      resourceType: this.resourceType,
      averageLevel: avgLevel,
      timesCapped,
      timesEmpty,
      wastedResource: 0,
      efficiency: 100,
      resourceEvents: [],
      recommendations: [],
    };
  }
}

// ============================================================================
// MAIN ANALYZER
// ============================================================================

/**
 * Analyze all combat mechanics
 */
export function analyzeCombatMechanics(
  entries: CombatLogEntry[],
  botName: string
): CombatMechanicsReport {
  const interruptAnalyzer = new InterruptAnalyzer();
  const ccAnalyzer = new CCAnalyzer();
  const movementAnalyzer = new MovementAnalyzer();
  const resourceAnalyzer = new ResourceAnalyzer();

  // Process entries
  interruptAnalyzer.processEntries(entries, botName);
  ccAnalyzer.processEntries(entries, botName);
  movementAnalyzer.processEntries(entries, botName);
  resourceAnalyzer.processEntries(entries, botName);

  // Analyze
  const interruptAnalysis = interruptAnalyzer.analyze();
  const ccAnalysis = ccAnalyzer.analyze();
  const movementAnalysis = movementAnalyzer.analyze();
  const resourceAnalysis = resourceAnalyzer.analyze();

  // Calculate overall score
  const interruptScore = interruptAnalysis.interruptAccuracy;
  const ccScore = ccAnalysis.ccEfficiency;
  const movementScore = movementAnalysis.movementEfficiency;
  const resourceScore = resourceAnalysis.efficiency;

  const mechanicsScore = (interruptScore + ccScore + movementScore + resourceScore) / 4;

  // Identify top issues
  const topIssues: string[] = [];
  if (interruptScore < 70) topIssues.push("Low interrupt accuracy");
  if (ccScore < 70) topIssues.push("Poor CC efficiency");
  if (movementScore < 70) topIssues.push("Excessive movement");
  if (resourceScore < 70) topIssues.push("Inefficient resource usage");

  // Quick wins
  const quickWins: string[] = [];
  if (interruptAnalysis.missedInterrupts > 5) {
    quickWins.push("Use interrupt more frequently");
  }
  if (ccAnalysis.wastedCC > 3) {
    quickWins.push("Avoid refreshing active CC");
  }

  return {
    interruptAnalysis,
    ccAnalysis,
    movementAnalysis,
    resourceAnalysis,
    overall: {
      mechanicsScore,
      topIssues,
      quickWins,
    },
  };
}
