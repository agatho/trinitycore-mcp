/**
 * Replay System API Route
 *
 * Provides HTTP endpoints for the bot session replay system.
 * Bridges between the Web UI and MCP replay tools.
 *
 * GET /api/replay?action=<action>&params...
 * POST /api/replay (for recording control and analysis)
 */

import { NextRequest, NextResponse } from "next/server";

// ============================================================================
// MOCK DATA - Used when MCP server is not connected
// ============================================================================

const MOCK_SESSIONS = [
  {
    id: "rec_1707000000_abc123",
    name: "RFC Dungeon Run - Level 15 Group",
    startTime: 1707000000000,
    eventCount: 2450,
    durationMs: 1800000, // 30 minutes
    tags: ["dungeon", "rfc", "group"],
  },
  {
    id: "rec_1707100000_def456",
    name: "Westfall Questing - Solo Warrior",
    startTime: 1707100000000,
    eventCount: 5200,
    durationMs: 3600000, // 1 hour
    tags: ["questing", "westfall", "solo"],
  },
  {
    id: "rec_1707200000_ghi789",
    name: "Warsong Gulch - PvP Group",
    startTime: 1707200000000,
    eventCount: 8100,
    durationMs: 1200000, // 20 minutes
    tags: ["pvp", "battleground", "wsg"],
  },
];

const MOCK_ANALYSIS = {
  sessionId: "rec_1707000000_abc123",
  sessionName: "RFC Dungeon Run - Level 15 Group",
  durationSeconds: 1800,
  eventStats: {
    total: 2450,
    byType: {
      combat_start: 32,
      combat_end: 31,
      spell_cast: 890,
      damage_dealt: 650,
      damage_taken: 420,
      healing_done: 280,
      movement: 145,
      ai_decision: 12,
      state_change: 8,
      death: 2,
    },
    eventsPerMinute: 81.7,
  },
  combat: {
    encounters: 32,
    totalCombatTime: 960000,
    avgEncounterDuration: 30000,
    deaths: 2,
    deathsPerHour: 4.0,
    totalDamageDealt: 125000,
    totalDamageTaken: 85000,
    totalHealingDone: 72000,
    dps: 130.2,
    hps: 75.0,
    dtps: 88.5,
    spellsCast: 890,
    uniqueSpellsCast: 12,
    topSpells: [
      { spellId: 78, spellName: "Heroic Strike", count: 210, totalDamage: 42000 },
      { spellId: 6343, spellName: "Thunder Clap", count: 95, totalDamage: 19000 },
      { spellId: 1464, spellName: "Slam", count: 160, totalDamage: 32000 },
      { spellId: 772, spellName: "Rend", count: 85, totalDamage: 17000 },
      { spellId: 100, spellName: "Charge", count: 32, totalDamage: 6400 },
    ],
  },
  movement: {
    totalDistance: 4520,
    avgSpeed: 2.51,
    timeStationary: 450000,
    timeMoving: 1350000,
    idlePercentage: 25.0,
  },
  aiDecisions: {
    totalDecisions: 12,
    decisionsPerMinute: 0.4,
    stateChanges: 8,
    uniqueStates: ["idle", "combat", "follow", "loot"],
    targetChanges: 45,
    errorCount: 3,
  },
  quests: {
    accepted: 4,
    completed: 3,
    completionRate: 75.0,
  },
  patterns: [
    {
      type: "death_pattern",
      description: "2 deaths detected during boss encounters",
      severity: "warning",
      count: 2,
    },
    {
      type: "idle_time",
      description: "3 idle periods (>30s) detected between pulls",
      severity: "info",
      count: 3,
    },
  ],
  suggestions: [
    {
      category: "survival",
      priority: "high",
      suggestion: "High death rate detected. Review defensive cooldown usage and healing triggers.",
      expectedImprovement: "Reduce deaths by 50% through better survival CD management",
    },
    {
      category: "movement",
      priority: "medium",
      suggestion: "Bot idle 25.0% of the time. Investigate stuck detection and pathfinding.",
      expectedImprovement: "20-40% improvement in quest completion speed",
    },
  ],
  efficiencyScore: 65,
};

const MOCK_RECORDING_STATUS = {
  isRecording: false,
  sessionId: null,
  name: null,
  duration: 0,
  eventCount: 0,
};

const MOCK_PLAYBACK_STATUS = {
  state: "stopped",
  position: 0,
  duration: 0,
};

// ============================================================================
// GET Handler - Read operations
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get("action");

    switch (action) {
      case "list-sessions":
        return NextResponse.json({
          sessions: MOCK_SESSIONS,
          count: MOCK_SESSIONS.length,
        });

      case "recording-status":
        return NextResponse.json(MOCK_RECORDING_STATUS);

      case "playback-status":
        return NextResponse.json(MOCK_PLAYBACK_STATUS);

      case "analyze": {
        const sessionId = searchParams.get("sessionId");
        if (!sessionId) {
          return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
        }
        return NextResponse.json(MOCK_ANALYSIS);
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}. Valid actions: list-sessions, recording-status, playback-status, analyze` },
          { status: 400 }
        );
    }
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST Handler - Write operations
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case "start-recording":
        return NextResponse.json({
          sessionId: `rec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          name: body.name || "Unnamed Session",
          startTime: Date.now(),
        });

      case "stop-recording":
        return NextResponse.json({
          sessionId: "rec_current",
          name: "Stopped Session",
          duration: 300000,
          eventCount: 1500,
        });

      case "start-playback":
        return NextResponse.json({
          sessionId: body.sessionId,
          name: "Playing Session",
          duration: 1800000,
          eventCount: 2450,
          speed: body.speed || 1.0,
        });

      case "playback-control":
        return NextResponse.json({
          state: body.command === "stop" ? "stopped" : body.command === "pause" ? "paused" : "playing",
          message: `Playback ${body.command}`,
        });

      case "delete-session":
        return NextResponse.json({
          deleted: true,
          sessionId: body.sessionId,
        });

      case "compare-sessions":
        return NextResponse.json({
          sessionA: { id: body.sessionIdA, name: "Session A" },
          sessionB: { id: body.sessionIdB, name: "Session B" },
          deltas: {
            dps: { a: 130.2, b: 155.8, change: 25.6, percentChange: 19.7 },
            hps: { a: 75.0, b: 82.3, change: 7.3, percentChange: 9.7 },
            deathsPerHour: { a: 4.0, b: 2.0, change: -2.0, percentChange: -50.0 },
            efficiencyScore: { a: 65, b: 78, change: 13, percentChange: 20.0 },
            idlePercentage: { a: 25.0, b: 18.5, change: -6.5, percentChange: -26.0 },
            questCompletionRate: { a: 75.0, b: 90.0, change: 15.0, percentChange: 20.0 },
          },
          improvements: [
            "DPS increased by 19.7%",
            "Deaths/hr reduced by 2.0",
            "Efficiency score improved by 13 points",
            "Idle time reduced by 6.5%",
          ],
          regressions: [],
          verdict: "improved",
        });

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
