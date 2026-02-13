/**
 * Bot Session Replay System
 *
 * Records, replays, and analyzes bot sessions for debugging, training, and optimization.
 * Builds on the existing SessionRecorder/SessionPlayer infrastructure from the SOAP module
 * and extends it with bot-specific event types, session analysis, and timeline visualization.
 *
 * Features:
 * - Record bot events (movement, combat, decisions, AI state changes)
 * - Replay sessions with speed control, time range filtering, and event filtering
 * - Analyze sessions for patterns, inefficiencies, and optimization opportunities
 * - Compare multiple sessions to identify regression or improvement
 * - Export session reports in markdown format
 *
 * @module tools/replay
 */

import {
  SessionRecorder,
  SessionPlayer,
  RecordingSession,
  PlaybackConfig,
  PlaybackState,
  mergeSessions,
  extractSlice,
} from "../soap/session-recorder";
import type { SOAPEvent } from "../soap/websocket-server";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Bot-specific event types that can be recorded in a session
 */
export type BotEventType =
  | "movement"         // Position change
  | "combat_start"     // Entered combat
  | "combat_end"       // Left combat
  | "spell_cast"       // Cast a spell
  | "spell_failed"     // Spell cast failed
  | "damage_dealt"     // Dealt damage
  | "damage_taken"     // Took damage
  | "healing_done"     // Healed self or others
  | "healing_received" // Received healing
  | "death"            // Bot died
  | "resurrect"        // Bot resurrected
  | "loot"             // Picked up loot
  | "quest_accept"     // Accepted a quest
  | "quest_complete"   // Completed a quest
  | "target_change"    // Changed target
  | "ai_decision"      // AI decision point
  | "state_change"     // Bot state change (idle, combat, flee, etc.)
  | "buff_applied"     // Buff/debuff applied
  | "buff_removed"     // Buff/debuff removed
  | "item_used"        // Used an item
  | "error";           // Error condition

/**
 * A bot event record with full context
 */
export interface BotEvent {
  /** Event type */
  type: BotEventType;

  /** Timestamp (ms since epoch) */
  timestamp: number;

  /** Bot identifier */
  botId: string;

  /** Bot name */
  botName: string;

  /** Position at time of event */
  position?: { x: number; y: number; z: number; mapId?: number };

  /** Additional event data */
  data: Record<string, unknown>;

  /** Event severity for highlighting */
  severity?: "info" | "warning" | "error" | "critical";
}

/**
 * Bot session with typed events and analysis metadata
 */
export interface BotSession {
  /** Unique session ID */
  id: string;

  /** Session name */
  name: string;

  /** Start timestamp */
  startTime: number;

  /** End timestamp */
  endTime: number;

  /** Duration in milliseconds */
  duration: number;

  /** Bot events (typed) */
  events: BotEvent[];

  /** Bots involved in this session */
  bots: Array<{
    botId: string;
    botName: string;
    className: string;
    level: number;
  }>;

  /** Session tags for filtering */
  tags: string[];

  /** Metadata */
  metadata: {
    eventCount: number;
    eventTypes: BotEventType[];
    mapIds: number[];
    description?: string;
  };
}

/**
 * Session analysis result
 */
export interface SessionAnalysis {
  /** Session being analyzed */
  sessionId: string;

  /** Session name */
  sessionName: string;

  /** Duration in seconds */
  durationSeconds: number;

  /** Event statistics */
  eventStats: {
    total: number;
    byType: Record<string, number>;
    eventsPerMinute: number;
  };

  /** Combat statistics */
  combat: {
    encounters: number;
    totalCombatTime: number;
    avgEncounterDuration: number;
    deaths: number;
    deathsPerHour: number;
    totalDamageDealt: number;
    totalDamageTaken: number;
    totalHealingDone: number;
    dps: number;
    hps: number;
    dtps: number;
    spellsCast: number;
    uniqueSpellsCast: number;
    topSpells: Array<{ spellId: number; spellName: string; count: number; totalDamage: number }>;
  };

  /** Movement statistics */
  movement: {
    totalDistance: number;
    avgSpeed: number;
    timeStationary: number;
    timeMoving: number;
    idlePercentage: number;
  };

  /** AI decision statistics */
  aiDecisions: {
    totalDecisions: number;
    decisionsPerMinute: number;
    stateChanges: number;
    uniqueStates: string[];
    targetChanges: number;
    errorCount: number;
  };

  /** Quest progress */
  quests: {
    accepted: number;
    completed: number;
    completionRate: number;
  };

  /** Identified patterns */
  patterns: SessionPattern[];

  /** Optimization suggestions */
  suggestions: SessionSuggestion[];

  /** Overall efficiency score (0-100) */
  efficiencyScore: number;
}

/**
 * A detected pattern in the session
 */
export interface SessionPattern {
  /** Pattern type */
  type: "repeated_action" | "inefficiency" | "death_pattern" | "combat_pattern" | "movement_pattern" | "idle_time";

  /** Human-readable description */
  description: string;

  /** Severity */
  severity: "info" | "warning" | "error";

  /** When the pattern was detected (time offsets in ms) */
  occurrences: number[];

  /** Count of occurrences */
  count: number;
}

/**
 * Optimization suggestion based on analysis
 */
export interface SessionSuggestion {
  /** Suggestion category */
  category: "combat" | "movement" | "ai" | "survival" | "quest" | "general";

  /** Priority */
  priority: "high" | "medium" | "low";

  /** Human-readable suggestion */
  suggestion: string;

  /** Expected improvement description */
  expectedImprovement: string;
}

/**
 * Session comparison result
 */
export interface SessionComparison {
  /** Session A details */
  sessionA: { id: string; name: string };

  /** Session B details */
  sessionB: { id: string; name: string };

  /** Metric deltas */
  deltas: {
    dps: { a: number; b: number; change: number; percentChange: number };
    hps: { a: number; b: number; change: number; percentChange: number };
    deathsPerHour: { a: number; b: number; change: number; percentChange: number };
    efficiencyScore: { a: number; b: number; change: number; percentChange: number };
    totalDistance: { a: number; b: number; change: number; percentChange: number };
    idlePercentage: { a: number; b: number; change: number; percentChange: number };
    decisionsPerMinute: { a: number; b: number; change: number; percentChange: number };
    questCompletionRate: { a: number; b: number; change: number; percentChange: number };
  };

  /** Summary of improvements and regressions */
  improvements: string[];
  regressions: string[];

  /** Overall verdict */
  verdict: "improved" | "regressed" | "mixed" | "unchanged";
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Default recording directory */
const DEFAULT_RECORDING_DIR = "./data/recordings";

/** Maximum events per session for analysis */
const MAX_ANALYSIS_EVENTS = 500000;

// ============================================================================
// SESSION MANAGEMENT
// ============================================================================

/** Singleton recorder instance */
let recorderInstance: SessionRecorder | null = null;

/** Singleton player instance */
let playerInstance: SessionPlayer | null = null;

/**
 * Get or create the SessionRecorder singleton
 */
function getRecorder(): SessionRecorder {
  if (!recorderInstance) {
    recorderInstance = new SessionRecorder({
      outputDir: DEFAULT_RECORDING_DIR,
      autoSaveInterval: 60000,
      maxEvents: MAX_ANALYSIS_EVENTS,
    });
  }
  return recorderInstance;
}

/**
 * Get or create the SessionPlayer singleton
 */
function getPlayer(): SessionPlayer {
  if (!playerInstance) {
    playerInstance = new SessionPlayer();
  }
  return playerInstance;
}

// ============================================================================
// RECORDING FUNCTIONS
// ============================================================================

/**
 * Start recording a bot session
 */
export async function startRecording(params: {
  name: string;
  description?: string;
  tags?: string[];
}): Promise<{ sessionId: string; name: string; startTime: number }> {
  const recorder = getRecorder();

  if (recorder.isRecordingActive()) {
    throw new Error("A recording session is already active. Stop it first.");
  }

  await recorder.startRecording(params.name, params.description);
  const session = recorder.getCurrentSession();

  if (!session) {
    throw new Error("Failed to start recording");
  }

  return {
    sessionId: session.id,
    name: session.name,
    startTime: session.startTime,
  };
}

/**
 * Stop the current recording session
 */
export async function stopRecording(): Promise<{
  sessionId: string;
  name: string;
  duration: number;
  eventCount: number;
}> {
  const recorder = getRecorder();

  if (!recorder.isRecordingActive()) {
    throw new Error("No recording session is active.");
  }

  const session = await recorder.stopRecording();

  return {
    sessionId: session.id,
    name: session.name,
    duration: session.duration,
    eventCount: session.metadata.eventCount,
  };
}

/**
 * Record a bot event to the current session
 */
export function recordBotEvent(event: BotEvent): void {
  const recorder = getRecorder();

  if (!recorder.isRecordingActive()) {
    return; // Silently ignore if not recording
  }

  // Convert BotEvent to SOAPEvent for the recorder
  const soapEvent: SOAPEvent = {
    type: event.type,
    timestamp: event.timestamp || Date.now(),
    data: {
      botId: event.botId,
      botName: event.botName,
      position: event.position,
      severity: event.severity || "info",
      ...event.data,
    },
  };

  recorder.recordEvent(soapEvent);
}

/**
 * Get current recording status
 */
export function getRecordingStatus(): {
  isRecording: boolean;
  sessionId: string | null;
  name: string | null;
  duration: number;
  eventCount: number;
} {
  const recorder = getRecorder();
  const session = recorder.getCurrentSession();

  return {
    isRecording: recorder.isRecordingActive(),
    sessionId: session?.id ?? null,
    name: session?.name ?? null,
    duration: session?.duration ?? 0,
    eventCount: session?.metadata.eventCount ?? 0,
  };
}

// ============================================================================
// SESSION LISTING AND LOADING
// ============================================================================

/**
 * List all recorded sessions
 */
export async function listSessions(): Promise<
  Array<{
    id: string;
    name: string;
    startTime: number;
    eventCount: number;
    durationMs: number;
  }>
> {
  const recorder = getRecorder();
  const sessions = await recorder.listSessions();

  // Enrich with duration from loaded data when possible
  return sessions.map((s) => ({
    ...s,
    durationMs: 0, // Duration requires full load; kept lightweight here
  }));
}

/**
 * Load a session by ID
 */
export async function loadSession(sessionId: string): Promise<RecordingSession> {
  const recorder = getRecorder();
  return await recorder.loadSession(sessionId);
}

/**
 * Delete a session by ID
 */
export async function deleteSession(sessionId: string): Promise<void> {
  const recorder = getRecorder();
  await recorder.deleteSession(sessionId);
}

// ============================================================================
// PLAYBACK FUNCTIONS
// ============================================================================

/**
 * Start playback of a recorded session
 */
export async function startPlayback(params: {
  sessionId: string;
  speed?: number;
  startTime?: number;
  endTime?: number;
  loop?: boolean;
  eventTypes?: string[];
}): Promise<{
  sessionId: string;
  name: string;
  duration: number;
  eventCount: number;
  speed: number;
}> {
  const recorder = getRecorder();
  const session = await recorder.loadSession(params.sessionId);

  const player = getPlayer();

  // Create fresh player with config
  playerInstance = new SessionPlayer({
    speed: params.speed ?? 1.0,
    startTime: params.startTime,
    endTime: params.endTime,
    loop: params.loop ?? false,
    eventTypes: params.eventTypes ?? [],
  });

  playerInstance.loadSession(session);
  playerInstance.play();

  return {
    sessionId: session.id,
    name: session.name,
    duration: session.duration,
    eventCount: session.metadata.eventCount,
    speed: params.speed ?? 1.0,
  };
}

/**
 * Get current playback status
 */
export function getPlaybackStatus(): {
  state: PlaybackState;
  position: number;
  duration: number;
} {
  const player = getPlayer();
  return {
    state: player.getState(),
    position: player.getPosition(),
    duration: player.getDuration(),
  };
}

/**
 * Control playback (pause, resume, stop, seek, speed)
 */
export function controlPlayback(action: {
  command: "pause" | "resume" | "stop" | "seek" | "speed";
  value?: number;
}): { state: PlaybackState; message: string } {
  const player = getPlayer();

  switch (action.command) {
    case "pause":
      player.pause();
      return { state: player.getState(), message: "Playback paused" };
    case "resume":
      player.resume();
      return { state: player.getState(), message: "Playback resumed" };
    case "stop":
      player.stop();
      return { state: player.getState(), message: "Playback stopped" };
    case "seek":
      if (typeof action.value !== "number") {
        throw new Error("Seek requires a numeric value (ms)");
      }
      player.seek(action.value);
      return { state: player.getState(), message: `Seeked to ${action.value}ms` };
    case "speed":
      if (typeof action.value !== "number" || action.value <= 0) {
        throw new Error("Speed requires a positive numeric value");
      }
      player.setSpeed(action.value);
      return { state: player.getState(), message: `Speed set to ${action.value}x` };
    default:
      throw new Error(`Unknown playback command: ${action.command}`);
  }
}

// ============================================================================
// SESSION ANALYSIS
// ============================================================================

/**
 * Analyze a recorded session for patterns, statistics, and optimization opportunities
 */
export function analyzeSession(session: RecordingSession): SessionAnalysis {
  const events = session.events;
  const durationMs = session.duration || 1;
  const durationSec = durationMs / 1000;
  const durationMin = durationSec / 60;
  const durationHr = durationSec / 3600;

  // Event statistics
  const byType: Record<string, number> = {};
  for (const event of events) {
    byType[event.type] = (byType[event.type] || 0) + 1;
  }

  // Combat statistics
  const combatStats = analyzeCombat(events, durationHr);

  // Movement statistics
  const movementStats = analyzeMovement(events, durationSec);

  // AI decision statistics
  const aiStats = analyzeAIDecisions(events, durationMin);

  // Quest statistics
  const questStats = analyzeQuests(events);

  // Pattern detection
  const patterns = detectPatterns(events, durationMs);

  // Generate suggestions
  const suggestions = generateSuggestions(combatStats, movementStats, aiStats, questStats, patterns);

  // Calculate efficiency score
  const efficiencyScore = calculateEfficiencyScore(combatStats, movementStats, aiStats, questStats);

  return {
    sessionId: session.id,
    sessionName: session.name,
    durationSeconds: durationSec,
    eventStats: {
      total: events.length,
      byType,
      eventsPerMinute: durationMin > 0 ? events.length / durationMin : 0,
    },
    combat: combatStats,
    movement: movementStats,
    aiDecisions: aiStats,
    quests: questStats,
    patterns,
    suggestions,
    efficiencyScore,
  };
}

/**
 * Analyze combat events
 */
function analyzeCombat(
  events: SOAPEvent[],
  durationHr: number
): SessionAnalysis["combat"] {
  let encounters = 0;
  let totalCombatTime = 0;
  let deaths = 0;
  let totalDamageDealt = 0;
  let totalDamageTaken = 0;
  let totalHealingDone = 0;
  let spellsCast = 0;
  let combatStartTime = 0;
  let inCombat = false;

  const spellUsage = new Map<number, { name: string; count: number; damage: number }>();

  for (const event of events) {
    switch (event.type) {
      case "combat_start":
        if (!inCombat) {
          encounters++;
          inCombat = true;
          combatStartTime = event.timestamp;
        }
        break;
      case "combat_end":
        if (inCombat) {
          inCombat = false;
          totalCombatTime += event.timestamp - combatStartTime;
        }
        break;
      case "death":
        deaths++;
        break;
      case "spell_cast":
        spellsCast++;
        break;
      case "damage_dealt": {
        const dmg = (event.data?.amount as number) || 0;
        totalDamageDealt += dmg;
        const spellId = (event.data?.spellId as number) || 0;
        const spellName = (event.data?.spellName as string) || "Auto Attack";
        if (spellId) {
          const existing = spellUsage.get(spellId) || { name: spellName, count: 0, damage: 0 };
          existing.count++;
          existing.damage += dmg;
          spellUsage.set(spellId, existing);
        }
        break;
      }
      case "damage_taken":
        totalDamageTaken += (event.data?.amount as number) || 0;
        break;
      case "healing_done":
        totalHealingDone += (event.data?.amount as number) || 0;
        break;
    }
  }

  const combatTimeSec = totalCombatTime / 1000;
  const topSpells = Array.from(spellUsage.entries())
    .map(([spellId, data]) => ({ spellId, spellName: data.name, count: data.count, totalDamage: data.damage }))
    .sort((a, b) => b.totalDamage - a.totalDamage)
    .slice(0, 10);

  return {
    encounters,
    totalCombatTime,
    avgEncounterDuration: encounters > 0 ? totalCombatTime / encounters : 0,
    deaths,
    deathsPerHour: durationHr > 0 ? deaths / durationHr : 0,
    totalDamageDealt,
    totalDamageTaken,
    totalHealingDone,
    dps: combatTimeSec > 0 ? totalDamageDealt / combatTimeSec : 0,
    hps: combatTimeSec > 0 ? totalHealingDone / combatTimeSec : 0,
    dtps: combatTimeSec > 0 ? totalDamageTaken / combatTimeSec : 0,
    spellsCast,
    uniqueSpellsCast: spellUsage.size,
    topSpells,
  };
}

/**
 * Analyze movement events
 */
function analyzeMovement(
  events: SOAPEvent[],
  durationSec: number
): SessionAnalysis["movement"] {
  let totalDistance = 0;
  let lastPos: { x: number; y: number; z: number } | null = null;
  let timeStationary = 0;
  let timeMoving = 0;
  let lastMoveTime = 0;
  const stationaryThreshold = 5000; // 5 seconds without movement = stationary

  for (const event of events) {
    const pos = event.data?.position as { x: number; y: number; z: number } | undefined;
    if (!pos) continue;

    if (event.type === "movement" || pos) {
      if (lastPos) {
        const dx = pos.x - lastPos.x;
        const dy = pos.y - lastPos.y;
        const dz = pos.z - lastPos.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        totalDistance += dist;

        const timeDelta = event.timestamp - lastMoveTime;
        if (dist > 0.1) {
          timeMoving += timeDelta;
        } else if (timeDelta > stationaryThreshold) {
          timeStationary += timeDelta;
        }
      }
      lastPos = pos;
      lastMoveTime = event.timestamp;
    }
  }

  const totalTimeSec = durationSec || 1;
  const avgSpeed = totalTimeSec > 0 ? totalDistance / totalTimeSec : 0;
  const totalTrackTime = timeStationary + timeMoving;
  const idlePercentage = totalTrackTime > 0 ? (timeStationary / totalTrackTime) * 100 : 0;

  return {
    totalDistance,
    avgSpeed,
    timeStationary,
    timeMoving,
    idlePercentage,
  };
}

/**
 * Analyze AI decision events
 */
function analyzeAIDecisions(
  events: SOAPEvent[],
  durationMin: number
): SessionAnalysis["aiDecisions"] {
  let totalDecisions = 0;
  let stateChanges = 0;
  let targetChanges = 0;
  let errorCount = 0;
  const uniqueStates = new Set<string>();

  for (const event of events) {
    switch (event.type) {
      case "ai_decision":
        totalDecisions++;
        break;
      case "state_change": {
        stateChanges++;
        const newState = event.data?.newState as string;
        if (newState) uniqueStates.add(newState);
        break;
      }
      case "target_change":
        targetChanges++;
        break;
      case "error":
        errorCount++;
        break;
    }
  }

  return {
    totalDecisions,
    decisionsPerMinute: durationMin > 0 ? totalDecisions / durationMin : 0,
    stateChanges,
    uniqueStates: Array.from(uniqueStates),
    targetChanges,
    errorCount,
  };
}

/**
 * Analyze quest events
 */
function analyzeQuests(events: SOAPEvent[]): SessionAnalysis["quests"] {
  let accepted = 0;
  let completed = 0;

  for (const event of events) {
    if (event.type === "quest_accept") accepted++;
    if (event.type === "quest_complete") completed++;
  }

  return {
    accepted,
    completed,
    completionRate: accepted > 0 ? (completed / accepted) * 100 : 0,
  };
}

/**
 * Detect patterns in session events
 */
function detectPatterns(events: SOAPEvent[], durationMs: number): SessionPattern[] {
  const patterns: SessionPattern[] = [];

  // Detect repeated death patterns (dying in similar positions)
  const deaths = events.filter((e) => e.type === "death");
  if (deaths.length >= 3) {
    patterns.push({
      type: "death_pattern",
      description: `Frequent deaths detected (${deaths.length} deaths). Check survival cooldown usage and positioning.`,
      severity: "warning",
      occurrences: deaths.map((d) => d.timestamp),
      count: deaths.length,
    });
  }

  // Detect idle periods (gaps > 30s between events)
  const idleThreshold = 30000;
  const idleOccurrences: number[] = [];
  for (let i = 1; i < events.length; i++) {
    const gap = events[i].timestamp - events[i - 1].timestamp;
    if (gap > idleThreshold) {
      idleOccurrences.push(events[i - 1].timestamp);
    }
  }
  if (idleOccurrences.length > 0) {
    patterns.push({
      type: "idle_time",
      description: `${idleOccurrences.length} idle periods (>30s) detected. Bot may be stuck or waiting unnecessarily.`,
      severity: idleOccurrences.length > 5 ? "warning" : "info",
      occurrences: idleOccurrences,
      count: idleOccurrences.length,
    });
  }

  // Detect spell cast failures
  const failures = events.filter((e) => e.type === "spell_failed");
  if (failures.length > 10) {
    patterns.push({
      type: "inefficiency",
      description: `${failures.length} spell cast failures detected. Check resource management and target validation.`,
      severity: "warning",
      occurrences: failures.map((f) => f.timestamp),
      count: failures.length,
    });
  }

  // Detect error bursts (multiple errors in short time)
  const errors = events.filter((e) => e.type === "error");
  if (errors.length > 0) {
    const errorBurstThreshold = 5000; // 5 seconds
    let burstCount = 0;
    const burstOccurrences: number[] = [];

    for (let i = 1; i < errors.length; i++) {
      if (errors[i].timestamp - errors[i - 1].timestamp < errorBurstThreshold) {
        burstCount++;
        if (burstOccurrences.length === 0 || burstOccurrences[burstOccurrences.length - 1] !== errors[i - 1].timestamp) {
          burstOccurrences.push(errors[i - 1].timestamp);
        }
      }
    }

    if (burstCount > 0) {
      patterns.push({
        type: "inefficiency",
        description: `${burstCount} error bursts detected. Bot encountering repeated failures in rapid succession.`,
        severity: "error",
        occurrences: burstOccurrences,
        count: burstCount,
      });
    }
  }

  // Detect rapid target switching (>5 target changes in 10 seconds)
  const targetChanges = events.filter((e) => e.type === "target_change");
  if (targetChanges.length > 5) {
    const rapidSwitchThreshold = 10000;
    const rapidSwitchOccurrences: number[] = [];

    for (let i = 0; i < targetChanges.length - 5; i++) {
      if (targetChanges[i + 5].timestamp - targetChanges[i].timestamp < rapidSwitchThreshold) {
        rapidSwitchOccurrences.push(targetChanges[i].timestamp);
      }
    }

    if (rapidSwitchOccurrences.length > 0) {
      patterns.push({
        type: "combat_pattern",
        description: `${rapidSwitchOccurrences.length} rapid target switching episodes detected. Bot may be indecisive about target priority.`,
        severity: "warning",
        occurrences: rapidSwitchOccurrences,
        count: rapidSwitchOccurrences.length,
      });
    }
  }

  return patterns;
}

/**
 * Generate optimization suggestions based on analysis results
 */
function generateSuggestions(
  combat: SessionAnalysis["combat"],
  movement: SessionAnalysis["movement"],
  ai: SessionAnalysis["aiDecisions"],
  quests: SessionAnalysis["quests"],
  patterns: SessionPattern[]
): SessionSuggestion[] {
  const suggestions: SessionSuggestion[] = [];

  // Combat suggestions
  if (combat.deathsPerHour > 3) {
    suggestions.push({
      category: "survival",
      priority: "high",
      suggestion: "High death rate detected. Review defensive cooldown usage and healing triggers.",
      expectedImprovement: "Reduce deaths by 50% through better survival CD management",
    });
  }

  if (combat.dps > 0 && combat.spellsCast > 0 && combat.uniqueSpellsCast < 3) {
    suggestions.push({
      category: "combat",
      priority: "medium",
      suggestion: "Low spell variety in rotation. Bot may not be using full toolkit.",
      expectedImprovement: "15-30% DPS increase from proper rotation",
    });
  }

  if (combat.encounters > 0 && combat.totalCombatTime === 0) {
    suggestions.push({
      category: "combat",
      priority: "high",
      suggestion: "Combat encounters detected but no combat duration tracked. Verify combat start/end events are being recorded.",
      expectedImprovement: "Accurate combat metrics for analysis",
    });
  }

  // Movement suggestions
  if (movement.idlePercentage > 30) {
    suggestions.push({
      category: "movement",
      priority: "medium",
      suggestion: `Bot idle ${movement.idlePercentage.toFixed(1)}% of the time. Investigate stuck detection and pathfinding.`,
      expectedImprovement: "20-40% improvement in quest completion speed",
    });
  }

  // AI suggestions
  if (ai.errorCount > 10) {
    suggestions.push({
      category: "ai",
      priority: "high",
      suggestion: `${ai.errorCount} AI errors detected. Review error handling and fallback behaviors.`,
      expectedImprovement: "Smoother bot operation with fewer interruptions",
    });
  }

  if (ai.decisionsPerMinute > 120) {
    suggestions.push({
      category: "ai",
      priority: "low",
      suggestion: "Excessive AI decision rate. Consider throttling decisions to reduce CPU load.",
      expectedImprovement: "10-20% CPU reduction per bot",
    });
  }

  // Quest suggestions
  if (quests.accepted > 0 && quests.completionRate < 50) {
    suggestions.push({
      category: "quest",
      priority: "medium",
      suggestion: `Low quest completion rate (${quests.completionRate.toFixed(1)}%). Bot may be abandoning or getting stuck on quests.`,
      expectedImprovement: "Higher quest throughput and XP/hour",
    });
  }

  // Pattern-based suggestions
  for (const pattern of patterns) {
    if (pattern.type === "death_pattern" && pattern.count >= 5) {
      suggestions.push({
        category: "survival",
        priority: "high",
        suggestion: "Recurring death pattern detected. Bot may be pulling too many mobs or not disengaging when low.",
        expectedImprovement: "Significant reduction in downtime and repair costs",
      });
    }

    if (pattern.type === "idle_time" && pattern.count > 5) {
      suggestions.push({
        category: "general",
        priority: "medium",
        suggestion: "Multiple extended idle periods. Check for stuck detection, pathfinding failures, or missing quest objectives.",
        expectedImprovement: "More active bot utilization",
      });
    }
  }

  return suggestions;
}

/**
 * Calculate overall efficiency score (0-100)
 */
function calculateEfficiencyScore(
  combat: SessionAnalysis["combat"],
  movement: SessionAnalysis["movement"],
  ai: SessionAnalysis["aiDecisions"],
  quests: SessionAnalysis["quests"]
): number {
  let score = 50; // Start at baseline

  // Combat efficiency (+/- 20 points)
  if (combat.encounters > 0) {
    // Low death rate is good
    if (combat.deathsPerHour < 1) score += 10;
    else if (combat.deathsPerHour < 3) score += 5;
    else if (combat.deathsPerHour > 6) score -= 10;

    // Good DPS relative to DTPS
    if (combat.dps > 0 && combat.dtps > 0) {
      const damageRatio = combat.dps / combat.dtps;
      if (damageRatio > 3) score += 10;
      else if (damageRatio > 1.5) score += 5;
      else if (damageRatio < 0.5) score -= 10;
    }
  }

  // Movement efficiency (+/- 15 points)
  if (movement.idlePercentage < 10) score += 15;
  else if (movement.idlePercentage < 20) score += 10;
  else if (movement.idlePercentage < 30) score += 5;
  else if (movement.idlePercentage > 50) score -= 10;

  // AI efficiency (+/- 10 points)
  if (ai.errorCount === 0) score += 10;
  else if (ai.errorCount < 5) score += 5;
  else if (ai.errorCount > 20) score -= 10;

  // Quest efficiency (+/- 5 points)
  if (quests.completionRate > 80) score += 5;
  else if (quests.completionRate < 30 && quests.accepted > 0) score -= 5;

  return Math.max(0, Math.min(100, score));
}

// ============================================================================
// SESSION COMPARISON
// ============================================================================

/**
 * Compare two sessions for performance differences
 */
export function compareSessions(
  analysisA: SessionAnalysis,
  analysisB: SessionAnalysis
): SessionComparison {
  function delta(a: number, b: number) {
    return {
      a,
      b,
      change: b - a,
      percentChange: a !== 0 ? ((b - a) / a) * 100 : b !== 0 ? 100 : 0,
    };
  }

  const deltas = {
    dps: delta(analysisA.combat.dps, analysisB.combat.dps),
    hps: delta(analysisA.combat.hps, analysisB.combat.hps),
    deathsPerHour: delta(analysisA.combat.deathsPerHour, analysisB.combat.deathsPerHour),
    efficiencyScore: delta(analysisA.efficiencyScore, analysisB.efficiencyScore),
    totalDistance: delta(analysisA.movement.totalDistance, analysisB.movement.totalDistance),
    idlePercentage: delta(analysisA.movement.idlePercentage, analysisB.movement.idlePercentage),
    decisionsPerMinute: delta(analysisA.aiDecisions.decisionsPerMinute, analysisB.aiDecisions.decisionsPerMinute),
    questCompletionRate: delta(analysisA.quests.completionRate, analysisB.quests.completionRate),
  };

  const improvements: string[] = [];
  const regressions: string[] = [];

  // DPS improvement is good
  if (deltas.dps.percentChange > 5) improvements.push(`DPS increased by ${deltas.dps.percentChange.toFixed(1)}%`);
  else if (deltas.dps.percentChange < -5) regressions.push(`DPS decreased by ${Math.abs(deltas.dps.percentChange).toFixed(1)}%`);

  // Deaths decrease is good
  if (deltas.deathsPerHour.change < -0.5) improvements.push(`Deaths/hr reduced by ${Math.abs(deltas.deathsPerHour.change).toFixed(1)}`);
  else if (deltas.deathsPerHour.change > 0.5) regressions.push(`Deaths/hr increased by ${deltas.deathsPerHour.change.toFixed(1)}`);

  // Efficiency score increase is good
  if (deltas.efficiencyScore.change > 5) improvements.push(`Efficiency score improved by ${deltas.efficiencyScore.change.toFixed(0)} points`);
  else if (deltas.efficiencyScore.change < -5) regressions.push(`Efficiency score dropped by ${Math.abs(deltas.efficiencyScore.change).toFixed(0)} points`);

  // Idle percentage decrease is good
  if (deltas.idlePercentage.change < -5) improvements.push(`Idle time reduced by ${Math.abs(deltas.idlePercentage.change).toFixed(1)}%`);
  else if (deltas.idlePercentage.change > 5) regressions.push(`Idle time increased by ${deltas.idlePercentage.change.toFixed(1)}%`);

  // Quest completion rate increase is good
  if (deltas.questCompletionRate.change > 10) improvements.push(`Quest completion rate improved by ${deltas.questCompletionRate.change.toFixed(1)}%`);
  else if (deltas.questCompletionRate.change < -10) regressions.push(`Quest completion rate dropped by ${Math.abs(deltas.questCompletionRate.change).toFixed(1)}%`);

  // Determine overall verdict
  let verdict: SessionComparison["verdict"];
  if (improvements.length > 0 && regressions.length === 0) {
    verdict = "improved";
  } else if (regressions.length > 0 && improvements.length === 0) {
    verdict = "regressed";
  } else if (improvements.length > 0 && regressions.length > 0) {
    verdict = "mixed";
  } else {
    verdict = "unchanged";
  }

  return {
    sessionA: { id: analysisA.sessionId, name: analysisA.sessionName },
    sessionB: { id: analysisB.sessionId, name: analysisB.sessionName },
    deltas,
    improvements,
    regressions,
    verdict,
  };
}

// ============================================================================
// EXPORT / FORMATTING
// ============================================================================

/**
 * Export a session analysis as a formatted markdown report
 */
export function exportAnalysisMarkdown(analysis: SessionAnalysis): string {
  const lines: string[] = [];

  lines.push(`# Session Analysis: ${analysis.sessionName}`);
  lines.push("");
  lines.push(`**Session ID:** ${analysis.sessionId}`);
  lines.push(`**Duration:** ${formatDuration(analysis.durationSeconds)}`);
  lines.push(`**Total Events:** ${analysis.eventStats.total}`);
  lines.push(`**Events/Minute:** ${analysis.eventStats.eventsPerMinute.toFixed(1)}`);
  lines.push(`**Efficiency Score:** ${analysis.efficiencyScore}/100`);
  lines.push("");

  // Combat Section
  lines.push("## Combat Performance");
  lines.push("");
  lines.push(`| Metric | Value |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Encounters | ${analysis.combat.encounters} |`);
  lines.push(`| DPS | ${analysis.combat.dps.toFixed(1)} |`);
  lines.push(`| HPS | ${analysis.combat.hps.toFixed(1)} |`);
  lines.push(`| DTPS | ${analysis.combat.dtps.toFixed(1)} |`);
  lines.push(`| Deaths | ${analysis.combat.deaths} (${analysis.combat.deathsPerHour.toFixed(1)}/hr) |`);
  lines.push(`| Spells Cast | ${analysis.combat.spellsCast} (${analysis.combat.uniqueSpellsCast} unique) |`);
  lines.push(`| Avg Encounter | ${(analysis.combat.avgEncounterDuration / 1000).toFixed(1)}s |`);
  lines.push("");

  if (analysis.combat.topSpells.length > 0) {
    lines.push("### Top Spells");
    lines.push("");
    lines.push(`| Spell | Casts | Total Damage |`);
    lines.push(`|-------|-------|-------------|`);
    for (const spell of analysis.combat.topSpells) {
      lines.push(`| ${spell.spellName} (${spell.spellId}) | ${spell.count} | ${spell.totalDamage.toLocaleString()} |`);
    }
    lines.push("");
  }

  // Movement Section
  lines.push("## Movement");
  lines.push("");
  lines.push(`| Metric | Value |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Total Distance | ${analysis.movement.totalDistance.toFixed(1)} yards |`);
  lines.push(`| Avg Speed | ${analysis.movement.avgSpeed.toFixed(1)} yards/sec |`);
  lines.push(`| Idle Percentage | ${analysis.movement.idlePercentage.toFixed(1)}% |`);
  lines.push("");

  // AI Decisions Section
  lines.push("## AI Decisions");
  lines.push("");
  lines.push(`| Metric | Value |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Total Decisions | ${analysis.aiDecisions.totalDecisions} |`);
  lines.push(`| Decisions/Minute | ${analysis.aiDecisions.decisionsPerMinute.toFixed(1)} |`);
  lines.push(`| State Changes | ${analysis.aiDecisions.stateChanges} |`);
  lines.push(`| Target Changes | ${analysis.aiDecisions.targetChanges} |`);
  lines.push(`| Errors | ${analysis.aiDecisions.errorCount} |`);
  if (analysis.aiDecisions.uniqueStates.length > 0) {
    lines.push(`| States Visited | ${analysis.aiDecisions.uniqueStates.join(", ")} |`);
  }
  lines.push("");

  // Quest Section
  if (analysis.quests.accepted > 0) {
    lines.push("## Quests");
    lines.push("");
    lines.push(`| Metric | Value |`);
    lines.push(`|--------|-------|`);
    lines.push(`| Accepted | ${analysis.quests.accepted} |`);
    lines.push(`| Completed | ${analysis.quests.completed} |`);
    lines.push(`| Completion Rate | ${analysis.quests.completionRate.toFixed(1)}% |`);
    lines.push("");
  }

  // Patterns Section
  if (analysis.patterns.length > 0) {
    lines.push("## Detected Patterns");
    lines.push("");
    for (const pattern of analysis.patterns) {
      const icon = pattern.severity === "error" ? "!!!" : pattern.severity === "warning" ? "!!" : "!";
      lines.push(`- **[${icon}]** ${pattern.description} (${pattern.count}x)`);
    }
    lines.push("");
  }

  // Suggestions Section
  if (analysis.suggestions.length > 0) {
    lines.push("## Optimization Suggestions");
    lines.push("");
    const sorted = [...analysis.suggestions].sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
    for (const suggestion of sorted) {
      lines.push(`### [${suggestion.priority.toUpperCase()}] ${suggestion.category}`);
      lines.push(`${suggestion.suggestion}`);
      lines.push(`*Expected: ${suggestion.expectedImprovement}*`);
      lines.push("");
    }
  }

  return lines.join("\n");
}

/**
 * Export a session comparison as markdown
 */
export function exportComparisonMarkdown(comparison: SessionComparison): string {
  const lines: string[] = [];

  lines.push(`# Session Comparison`);
  lines.push("");
  lines.push(`**Session A:** ${comparison.sessionA.name} (${comparison.sessionA.id})`);
  lines.push(`**Session B:** ${comparison.sessionB.name} (${comparison.sessionB.id})`);
  lines.push(`**Verdict:** ${comparison.verdict.toUpperCase()}`);
  lines.push("");

  lines.push("## Metrics");
  lines.push("");
  lines.push(`| Metric | Session A | Session B | Change |`);
  lines.push(`|--------|-----------|-----------|--------|`);

  const d = comparison.deltas;
  lines.push(`| DPS | ${d.dps.a.toFixed(1)} | ${d.dps.b.toFixed(1)} | ${formatChange(d.dps.percentChange)} |`);
  lines.push(`| HPS | ${d.hps.a.toFixed(1)} | ${d.hps.b.toFixed(1)} | ${formatChange(d.hps.percentChange)} |`);
  lines.push(`| Deaths/hr | ${d.deathsPerHour.a.toFixed(1)} | ${d.deathsPerHour.b.toFixed(1)} | ${formatChange(d.deathsPerHour.percentChange, true)} |`);
  lines.push(`| Efficiency | ${d.efficiencyScore.a.toFixed(0)} | ${d.efficiencyScore.b.toFixed(0)} | ${formatChange(d.efficiencyScore.percentChange)} |`);
  lines.push(`| Idle % | ${d.idlePercentage.a.toFixed(1)}% | ${d.idlePercentage.b.toFixed(1)}% | ${formatChange(d.idlePercentage.percentChange, true)} |`);
  lines.push(`| Quest Completion | ${d.questCompletionRate.a.toFixed(1)}% | ${d.questCompletionRate.b.toFixed(1)}% | ${formatChange(d.questCompletionRate.percentChange)} |`);
  lines.push("");

  if (comparison.improvements.length > 0) {
    lines.push("## Improvements");
    for (const imp of comparison.improvements) {
      lines.push(`- ${imp}`);
    }
    lines.push("");
  }

  if (comparison.regressions.length > 0) {
    lines.push("## Regressions");
    for (const reg of comparison.regressions) {
      lines.push(`- ${reg}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Format duration in seconds to human-readable string
 */
function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const min = Math.floor(seconds / 60);
  const sec = Math.floor(seconds % 60);
  if (min < 60) return `${min}m ${sec}s`;
  const hr = Math.floor(min / 60);
  const remainMin = min % 60;
  return `${hr}h ${remainMin}m`;
}

/**
 * Format a percentage change with sign and color indicator
 */
function formatChange(percentChange: number, invertGood = false): string {
  const sign = percentChange >= 0 ? "+" : "";
  const val = `${sign}${percentChange.toFixed(1)}%`;
  const isGood = invertGood ? percentChange <= 0 : percentChange >= 0;
  return isGood ? `${val} (better)` : `${val} (worse)`;
}

/**
 * Merge two recording sessions
 */
export { mergeSessions, extractSlice };
