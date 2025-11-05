/**
 * Cooldown Tracking System for Bot Combat Log Analyzer
 *
 * Tracks ability cooldowns, identifies missed opportunities,
 * and calculates cooldown efficiency.
 *
 * @module tools/cooldown-tracker
 */

import type { CombatLogEntry, AbilityUsage, MissedOpportunity } from "./botcombatloganalyzer.js";

// ============================================================================
// TYPES
// ============================================================================

export interface CooldownInfo {
  spellId: number;
  spellName: string;
  cooldownDuration: number; // milliseconds
  charges?: number; // For abilities with charges
  chargeRecoveryTime?: number; // milliseconds
}

export interface CooldownState {
  spellId: number;
  spellName: string;
  availableAt: number; // timestamp when cooldown ends
  charges: number; // current charges available
  lastUsed: number; // timestamp of last use
  totalCasts: number;
  wastedTime: number; // time spent with ability off cooldown but not used
}

export interface CooldownAnalysis {
  ability: string;
  spellId: number;
  cooldown: number; // seconds
  actualCasts: number;
  expectedCasts: number;
  missedCasts: number;
  efficiency: number; // 0-100%
  wastedTime: number; // seconds
  averageDelay: number; // seconds between CD ready and use
  missedOpportunities: MissedOpportunity[];
}

export interface ProcInfo {
  spellId: number;
  spellName: string;
  triggerSpell?: number; // What ability triggers it
  duration: number; // milliseconds
  procChance?: number; // 0-1
  internalCooldown?: number; // milliseconds
}

export interface ProcState {
  spellId: number;
  spellName: string;
  isActive: boolean;
  activatedAt?: number;
  expiresAt?: number;
  lastProcTime?: number;
  totalProcs: number;
  totalUptime: number; // milliseconds
  wastedProcs: number; // Proc occurred but wasn't used
}

export interface ProcAnalysis {
  buff: string;
  spellId: number;
  duration: number; // seconds
  totalProcs: number;
  usedProcs: number;
  wastedProcs: number;
  procRate: number; // procs per minute
  uptime: number; // percentage
  wastedUptime: number; // percentage
  averageUsageDelay: number; // seconds from proc to first ability use
  recommendations: string[];
}

// ============================================================================
// COOLDOWN DATABASE
// ============================================================================

/**
 * Known ability cooldowns (in milliseconds)
 * This should ideally come from spell_template database
 */
export const COOLDOWN_DATABASE: Map<number, CooldownInfo> = new Map([
  // Warrior
  [12294, { spellId: 12294, spellName: "Mortal Strike", cooldownDuration: 6000 }],
  [23881, { spellId: 23881, spellName: "Bloodthirst", cooldownDuration: 4000 }],
  [1719, { spellId: 1719, spellName: "Recklessness", cooldownDuration: 180000 }],
  [18499, { spellId: 18499, spellName: "Berserker Rage", cooldownDuration: 30000 }],

  // Mage
  [133, { spellId: 133, spellName: "Fireball", cooldownDuration: 0 }], // No cooldown
  [11129, { spellId: 11129, spellName: "Combustion", cooldownDuration: 120000 }],
  [12042, { spellId: 12042, spellName: "Arcane Power", cooldownDuration: 120000 }],
  [12472, { spellId: 12472, spellName: "Icy Veins", cooldownDuration: 180000 }],

  // Rogue
  [14177, { spellId: 14177, spellName: "Cold Blood", cooldownDuration: 180000 }],
  [13750, { spellId: 13750, spellName: "Adrenaline Rush", cooldownDuration: 300000 }],
  [14183, { spellId: 14183, spellName: "Premeditation", cooldownDuration: 180000 }],

  // Priest
  [10060, { spellId: 10060, spellName: "Power Infusion", cooldownDuration: 180000 }],
  [10958, { spellId: 10958, spellName: "Greater Heal", cooldownDuration: 0 }],
  [10901, { spellId: 10901, spellName: "Power Word: Shield", cooldownDuration: 4000 }],

  // Add more as needed
]);

/**
 * Known proc buffs
 */
export const PROC_DATABASE: Map<number, ProcInfo> = new Map([
  // Warrior
  [12964, { spellId: 12964, spellName: "Flurry", duration: 15000, procChance: 0.2 }],
  [12809, { spellId: 12809, spellName: "Enrage", duration: 12000 }],

  // Mage
  [12536, { spellId: 12536, spellName: "Clearcasting", duration: 15000, procChance: 0.1 }],
  [28682, { spellId: 28682, spellName: "Combustion", duration: 0 }], // Stacks

  // Rogue
  [14143, { spellId: 14143, spellName: "Cold Blood", duration: 20000 }],
  [13877, { spellId: 13877, spellName: "Blade Flurry", duration: 15000 }],

  // Add more as needed
]);

// ============================================================================
// COOLDOWN TRACKER
// ============================================================================

export class CooldownTracker {
  private cooldowns: Map<number, CooldownState> = new Map();
  private procs: Map<number, ProcState> = new Map();
  private combatStart: number = 0;
  private combatEnd: number = 0;

  /**
   * Initialize tracker with combat start time
   */
  initialize(startTime: number, endTime: number): void {
    this.combatStart = startTime;
    this.combatEnd = endTime;
    this.cooldowns.clear();
    this.procs.clear();
  }

  /**
   * Process combat log entry
   */
  processEntry(entry: CombatLogEntry): void {
    if (entry.type === "SPELL_CAST" && entry.spellId) {
      this.trackCooldown(entry);
    } else if (entry.type === "AURA_APPLIED" && entry.spellId) {
      this.trackProc(entry);
    } else if (entry.type === "AURA_REMOVED" && entry.spellId) {
      this.removeProcBuff(entry);
    }
  }

  /**
   * Track cooldown usage
   */
  private trackCooldown(entry: CombatLogEntry): void {
    if (!entry.spellId) return;

    const cdInfo = COOLDOWN_DATABASE.get(entry.spellId);
    if (!cdInfo || cdInfo.cooldownDuration === 0) return; // Skip abilities without cooldown

    let state = this.cooldowns.get(entry.spellId);

    if (!state) {
      // First cast - initialize state
      state = {
        spellId: entry.spellId,
        spellName: entry.spellName || cdInfo.spellName,
        availableAt: entry.timestamp + cdInfo.cooldownDuration,
        charges: cdInfo.charges || 1,
        lastUsed: entry.timestamp,
        totalCasts: 1,
        wastedTime: 0,
      };
      this.cooldowns.set(entry.spellId, state);
    } else {
      // Subsequent cast - track wasted time
      if (entry.timestamp > state.availableAt) {
        // Ability was ready but not used immediately
        const delay = entry.timestamp - state.availableAt;
        state.wastedTime += delay;
      }

      // Update state
      state.availableAt = entry.timestamp + cdInfo.cooldownDuration;
      state.lastUsed = entry.timestamp;
      state.totalCasts++;
    }
  }

  /**
   * Track proc buff activation
   */
  private trackProc(entry: CombatLogEntry): void {
    if (!entry.spellId) return;

    const procInfo = PROC_DATABASE.get(entry.spellId);
    if (!procInfo) return; // Not a tracked proc

    let state = this.procs.get(entry.spellId);

    if (!state) {
      state = {
        spellId: entry.spellId,
        spellName: entry.spellName || procInfo.spellName,
        isActive: true,
        activatedAt: entry.timestamp,
        expiresAt: entry.timestamp + procInfo.duration,
        lastProcTime: entry.timestamp,
        totalProcs: 1,
        totalUptime: 0,
        wastedProcs: 0,
      };
      this.procs.set(entry.spellId, state);
    } else {
      // New proc while one is active = wasted proc
      if (state.isActive && state.expiresAt && entry.timestamp < state.expiresAt) {
        state.wastedProcs++;
      }

      // Add uptime from previous proc
      if (state.activatedAt && state.expiresAt) {
        const uptime = Math.min(state.expiresAt, entry.timestamp) - state.activatedAt;
        state.totalUptime += uptime;
      }

      // Update state
      state.isActive = true;
      state.activatedAt = entry.timestamp;
      state.expiresAt = entry.timestamp + procInfo.duration;
      state.lastProcTime = entry.timestamp;
      state.totalProcs++;
    }
  }

  /**
   * Remove proc buff
   */
  private removeProcBuff(entry: CombatLogEntry): void {
    if (!entry.spellId) return;

    const state = this.procs.get(entry.spellId);
    if (!state || !state.isActive) return;

    // Add uptime
    if (state.activatedAt) {
      const uptime = entry.timestamp - state.activatedAt;
      state.totalUptime += uptime;
    }

    state.isActive = false;
  }

  /**
   * Analyze cooldown usage
   */
  analyzeCooldowns(fightDuration: number): Map<number, CooldownAnalysis> {
    const analyses: Map<number, CooldownAnalysis> = new Map();

    for (const [spellId, state] of this.cooldowns) {
      const cdInfo = COOLDOWN_DATABASE.get(spellId);
      if (!cdInfo) continue;

      const cooldownSeconds = cdInfo.cooldownDuration / 1000;
      const expectedCasts = Math.floor(fightDuration / cooldownSeconds) + 1; // +1 for initial cast
      const missedCasts = Math.max(0, expectedCasts - state.totalCasts);
      const efficiency = (state.totalCasts / expectedCasts) * 100;
      const averageDelay = state.wastedTime / state.totalCasts / 1000;

      // Generate missed opportunities
      const missedOpportunities: MissedOpportunity[] = [];
      if (missedCasts > 0) {
        missedOpportunities.push({
          timestamp: state.availableAt,
          type: "cooldown-unused",
          description: `${state.spellName} was off cooldown but not used (${missedCasts} missed casts)`,
          ability: state.spellName,
          impact: missedCasts >= 3 ? "critical" : missedCasts >= 2 ? "high" : "medium",
          estimatedLoss: `~${(missedCasts * 1000).toFixed(0)} potential damage/healing`,
        });
      }

      if (averageDelay > 2) {
        missedOpportunities.push({
          timestamp: state.lastUsed,
          type: "cooldown-unused",
          description: `${state.spellName} average delay: ${averageDelay.toFixed(1)}s after becoming available`,
          ability: state.spellName,
          impact: "medium",
          estimatedLoss: `~${(averageDelay * 100).toFixed(0)} DPS loss from delays`,
        });
      }

      analyses.set(spellId, {
        ability: state.spellName,
        spellId,
        cooldown: cooldownSeconds,
        actualCasts: state.totalCasts,
        expectedCasts,
        missedCasts,
        efficiency,
        wastedTime: state.wastedTime / 1000,
        averageDelay,
        missedOpportunities,
      });
    }

    return analyses;
  }

  /**
   * Analyze proc usage
   */
  analyzeProcs(fightDuration: number): Map<number, ProcAnalysis> {
    const analyses: Map<number, ProcAnalysis> = new Map();

    for (const [spellId, state] of this.procs) {
      const procInfo = PROC_DATABASE.get(spellId);
      if (!procInfo) continue;

      // Finalize uptime if proc is still active at end
      let totalUptime = state.totalUptime;
      if (state.isActive && state.activatedAt) {
        totalUptime += this.combatEnd - state.activatedAt;
      }

      const durationSeconds = procInfo.duration / 1000;
      const usedProcs = state.totalProcs - state.wastedProcs;
      const procRate = (state.totalProcs / fightDuration) * 60; // per minute
      const uptime = (totalUptime / (fightDuration * 1000)) * 100; // percentage
      const maxPossibleUptime = (state.totalProcs * procInfo.duration) / (fightDuration * 1000) * 100;
      const wastedUptime = Math.max(0, maxPossibleUptime - uptime);

      // Generate recommendations
      const recommendations: string[] = [];
      if (state.wastedProcs > 0) {
        recommendations.push(`Avoid refreshing ${state.spellName} when it's already active (${state.wastedProcs} wasted procs)`);
      }
      if (uptime < 80 && state.totalProcs > 5) {
        recommendations.push(`Low uptime (${uptime.toFixed(1)}%) - use abilities immediately when ${state.spellName} procs`);
      }

      analyses.set(spellId, {
        buff: state.spellName,
        spellId,
        duration: durationSeconds,
        totalProcs: state.totalProcs,
        usedProcs,
        wastedProcs: state.wastedProcs,
        procRate,
        uptime,
        wastedUptime,
        averageUsageDelay: 0, // TODO: Calculate by tracking ability usage during proc
        recommendations,
      });
    }

    return analyses;
  }

  /**
   * Get all tracked cooldowns
   */
  getCooldowns(): Map<number, CooldownState> {
    return this.cooldowns;
  }

  /**
   * Get all tracked procs
   */
  getProcs(): Map<number, ProcState> {
    return this.procs;
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Integrate cooldown analysis into combat metrics
 */
export function addCooldownAnalysisToCombatMetrics(
  entries: CombatLogEntry[],
  botName: string,
  duration: number
): {
  cooldownAnalyses: Map<number, CooldownAnalysis>;
  procAnalyses: Map<number, ProcAnalysis>;
  missedOpportunities: MissedOpportunity[];
} {
  const tracker = new CooldownTracker();

  // Find combat bounds
  const botEntries = entries.filter(e => e.source === botName);
  if (botEntries.length === 0) {
    return {
      cooldownAnalyses: new Map(),
      procAnalyses: new Map(),
      missedOpportunities: [],
    };
  }

  const startTime = botEntries[0].timestamp;
  const endTime = botEntries[botEntries.length - 1].timestamp;

  tracker.initialize(startTime, endTime);

  // Process all entries
  for (const entry of botEntries) {
    tracker.processEntry(entry);
  }

  // Analyze
  const cooldownAnalyses = tracker.analyzeCooldowns(duration);
  const procAnalyses = tracker.analyzeProcs(duration);

  // Collect all missed opportunities
  const missedOpportunities: MissedOpportunity[] = [];
  for (const analysis of cooldownAnalyses.values()) {
    missedOpportunities.push(...analysis.missedOpportunities);
  }

  return {
    cooldownAnalyses,
    procAnalyses,
    missedOpportunities,
  };
}

/**
 * Register custom cooldown
 */
export function registerCooldown(spellId: number, info: CooldownInfo): void {
  COOLDOWN_DATABASE.set(spellId, info);
}

/**
 * Register custom proc
 */
export function registerProc(spellId: number, info: ProcInfo): void {
  PROC_DATABASE.set(spellId, info);
}

/**
 * Load cooldowns from spell database
 * This should query the TrinityCore spell_template table
 */
export async function loadCooldownsFromDatabase(): Promise<void> {
  // TODO: Implement MCP integration to query spell_template
  // For now, we're using the hardcoded database above
  console.log('[Cooldown Tracker] Using hardcoded cooldown database. TODO: Load from spell_template');
}
