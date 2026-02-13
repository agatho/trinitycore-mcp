/**
 * Replay System Tools Registry
 *
 * MCP tool registrations for the bot session replay system.
 * Provides recording, playback, analysis, and comparison of bot sessions.
 *
 * @module tools/registry/replay-tools
 */

import { ToolRegistryEntry, jsonResponse, textResponse } from "./types";
import {
  startRecording,
  stopRecording,
  getRecordingStatus,
  recordBotEvent,
  listSessions,
  loadSession,
  deleteSession,
  startPlayback,
  getPlaybackStatus,
  controlPlayback,
  analyzeSession,
  compareSessions,
  exportAnalysisMarkdown,
  exportComparisonMarkdown,
} from "../replay";

export const replayTools: ToolRegistryEntry[] = [
  // ========================================================================
  // RECORDING
  // ========================================================================
  {
    definition: {
      name: "replay-start-recording",
      description:
        "Start recording a bot session. Captures all bot events (combat, movement, AI decisions, quests) for later replay and analysis. Only one recording can be active at a time.",
      inputSchema: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "Name for this recording session (e.g., 'Dungeon Run - RFC')",
          },
          description: {
            type: "string",
            description: "Optional description of what is being recorded",
          },
          tags: {
            type: "array",
            description: "Optional tags for filtering (e.g., ['dungeon', 'warrior', 'level-20'])",
            items: { type: "string" },
          },
        },
        required: ["name"],
      },
    },
    handler: async (args) => {
      const result = await startRecording({
        name: args.name as string,
        description: args.description as string | undefined,
        tags: args.tags as string[] | undefined,
      });
      return jsonResponse(result);
    },
  },
  {
    definition: {
      name: "replay-stop-recording",
      description:
        "Stop the current recording session. Finalizes and saves the session to disk for later replay and analysis.",
      inputSchema: {
        type: "object",
        properties: {},
      },
    },
    handler: async () => {
      const result = await stopRecording();
      return jsonResponse(result);
    },
  },
  {
    definition: {
      name: "replay-recording-status",
      description:
        "Get the status of the current recording session (is recording active, event count, duration).",
      inputSchema: {
        type: "object",
        properties: {},
      },
    },
    handler: async () => {
      const result = getRecordingStatus();
      return jsonResponse(result);
    },
  },

  // ========================================================================
  // SESSION MANAGEMENT
  // ========================================================================
  {
    definition: {
      name: "replay-list-sessions",
      description:
        "List all recorded bot sessions with their IDs, names, timestamps, and event counts.",
      inputSchema: {
        type: "object",
        properties: {},
      },
    },
    handler: async () => {
      const sessions = await listSessions();
      return jsonResponse({
        sessions,
        count: sessions.length,
      });
    },
  },
  {
    definition: {
      name: "replay-delete-session",
      description: "Delete a recorded session by its ID.",
      inputSchema: {
        type: "object",
        properties: {
          sessionId: {
            type: "string",
            description: "Session ID to delete",
          },
        },
        required: ["sessionId"],
      },
    },
    handler: async (args) => {
      await deleteSession(args.sessionId as string);
      return jsonResponse({ deleted: true, sessionId: args.sessionId });
    },
  },

  // ========================================================================
  // PLAYBACK
  // ========================================================================
  {
    definition: {
      name: "replay-start-playback",
      description:
        "Start playing back a recorded session. Supports speed control, time range filtering, looping, and event type filtering.",
      inputSchema: {
        type: "object",
        properties: {
          sessionId: {
            type: "string",
            description: "Session ID to play back",
          },
          speed: {
            type: "number",
            description: "Playback speed multiplier (default: 1.0, 2.0 = 2x speed, 0.5 = half speed)",
          },
          startTime: {
            type: "number",
            description: "Start from this timestamp (ms since session start)",
          },
          endTime: {
            type: "number",
            description: "End at this timestamp (ms since session start)",
          },
          loop: {
            type: "boolean",
            description: "Loop playback (default: false)",
          },
          eventTypes: {
            type: "array",
            description: "Filter to specific event types (e.g., ['combat_start', 'spell_cast'])",
            items: { type: "string" },
          },
        },
        required: ["sessionId"],
      },
    },
    handler: async (args) => {
      const result = await startPlayback({
        sessionId: args.sessionId as string,
        speed: args.speed as number | undefined,
        startTime: args.startTime as number | undefined,
        endTime: args.endTime as number | undefined,
        loop: args.loop as boolean | undefined,
        eventTypes: args.eventTypes as string[] | undefined,
      });
      return jsonResponse(result);
    },
  },
  {
    definition: {
      name: "replay-playback-control",
      description:
        "Control active playback: pause, resume, stop, seek to position, or change speed.",
      inputSchema: {
        type: "object",
        properties: {
          command: {
            type: "string",
            enum: ["pause", "resume", "stop", "seek", "speed"],
            description: "Playback command",
          },
          value: {
            type: "number",
            description: "Value for seek (ms position) or speed (multiplier)",
          },
        },
        required: ["command"],
      },
    },
    handler: async (args) => {
      const result = controlPlayback({
        command: args.command as "pause" | "resume" | "stop" | "seek" | "speed",
        value: args.value as number | undefined,
      });
      return jsonResponse(result);
    },
  },
  {
    definition: {
      name: "replay-playback-status",
      description:
        "Get current playback status (state, position, duration).",
      inputSchema: {
        type: "object",
        properties: {},
      },
    },
    handler: async () => {
      const result = getPlaybackStatus();
      return jsonResponse(result);
    },
  },

  // ========================================================================
  // ANALYSIS
  // ========================================================================
  {
    definition: {
      name: "replay-analyze-session",
      description:
        "Analyze a recorded session for combat performance, movement efficiency, AI decision patterns, quest progress, and optimization opportunities. Returns detailed statistics, detected patterns, and actionable suggestions with an overall efficiency score.",
      inputSchema: {
        type: "object",
        properties: {
          sessionId: {
            type: "string",
            description: "Session ID to analyze",
          },
          outputFormat: {
            type: "string",
            enum: ["json", "markdown"],
            description: "Output format (default: markdown)",
          },
        },
        required: ["sessionId"],
      },
    },
    handler: async (args) => {
      const session = await loadSession(args.sessionId as string);
      const analysis = analyzeSession(session);

      const format = (args.outputFormat as string) || "markdown";
      if (format === "json") {
        return jsonResponse(analysis);
      }
      return textResponse(exportAnalysisMarkdown(analysis));
    },
  },
  {
    definition: {
      name: "replay-compare-sessions",
      description:
        "Compare two recorded sessions to identify performance improvements or regressions. Useful for A/B testing bot changes by comparing before/after sessions.",
      inputSchema: {
        type: "object",
        properties: {
          sessionIdA: {
            type: "string",
            description: "First session ID (baseline)",
          },
          sessionIdB: {
            type: "string",
            description: "Second session ID (comparison)",
          },
          outputFormat: {
            type: "string",
            enum: ["json", "markdown"],
            description: "Output format (default: markdown)",
          },
        },
        required: ["sessionIdA", "sessionIdB"],
      },
    },
    handler: async (args) => {
      const sessionA = await loadSession(args.sessionIdA as string);
      const sessionB = await loadSession(args.sessionIdB as string);

      const analysisA = analyzeSession(sessionA);
      const analysisB = analyzeSession(sessionB);
      const comparison = compareSessions(analysisA, analysisB);

      const format = (args.outputFormat as string) || "markdown";
      if (format === "json") {
        return jsonResponse(comparison);
      }
      return textResponse(exportComparisonMarkdown(comparison));
    },
  },
];
