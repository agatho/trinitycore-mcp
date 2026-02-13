/**
 * Bot Analysis Tools Registry
 *
 * Bot debugging, game simulation, AI analysis, and combat log analysis.
 *
 * @module tools/registry/bot-analysis
 */

import { ToolRegistryEntry, jsonResponse, textResponse } from "./types";
import { getBotState, getBotTimeline, setBreakpoint, exportBugReport } from "../botdebugger";
import { simulateCombat, analyzeWhatIf } from "../gamesimulator";
import { analyzeBotAI, formatAIAnalysisReport } from "../botaianalyzer";
import { analyzeBotCombatLog, formatCombatAnalysisReport } from "../botcombatloganalyzer";
import {
  analyzeComprehensive,
  formatComprehensiveReportMarkdown,
  formatComprehensiveReportJSON,
  formatComprehensiveReportSummary
} from "../combatloganalyzer-advanced";

export const botAnalysisTools: ToolRegistryEntry[] = [
  {
    definition: {
      name: "debug-bot-behavior",
      description: "Debug bot AI behavior - inspect live state, replay decisions, set breakpoints. Reduces debugging time from 2 hours to 5 minutes.",
      inputSchema: {
        type: "object",
        properties: {
          botId: { type: "string", description: "Bot identifier/name" },
          action: { type: "string", enum: ["inspect", "timeline", "breakpoint", "export"], description: "Debugging action to perform" },
          duration: { type: "number", description: "Timeline duration in seconds (for timeline action)" },
          breakpointCondition: { type: "string", description: "Breakpoint condition (e.g., 'HP < 20%')" },
          timelineId: { type: "string", description: "Timeline ID for export action" },
        },
        required: ["botId", "action"],
      },
    },
    handler: async (args) => {
      const action = args.action as string;
      let result: unknown;

      if (action === "inspect") {
        result = await getBotState(args.botId as string);
      } else if (action === "timeline") {
        result = await getBotTimeline(args.botId as string, (args.duration as number) || 10);
      } else if (action === "breakpoint") {
        result = await setBreakpoint({
          id: `bp-${Date.now()}`,
          condition: args.breakpointCondition as string,
          action: "pause",
          enabled: true,
        });
      } else if (action === "export") {
        result = await exportBugReport(args.botId as string, args.timelineId as string);
      } else {
        throw new Error(`Unknown bot debug action: ${action}`);
      }

      return jsonResponse(result);
    },
  },
  {
    definition: {
      name: "simulate-game-mechanics",
      description: "Simulate combat, spell damage, and stat impacts without running full server. Test balance changes in 5 minutes vs 2 hours.",
      inputSchema: {
        type: "object",
        properties: {
          simulationType: { type: "string", enum: ["combat", "whatif"], description: "Type of simulation to run" },
          playerStats: { type: "object", description: "Player stats for simulation (level, attackPower, spellPower, crit, haste, mastery, etc.)" },
          targetStats: { type: "object", description: "Target stats (level, armor, hp, etc.)" },
          rotation: { type: "array", description: "Spell rotation array with spellId and timing" },
          duration: { type: "number", description: "Simulation duration in seconds (default: 300)" },
          scenario: { type: "string", description: "What-if scenario description (for whatif type)" },
        },
        required: ["simulationType", "playerStats"],
      },
    },
    handler: async (args) => {
      const simulationType = args.simulationType as string;
      let result: unknown;

      if (simulationType === "combat") {
        result = await simulateCombat({
          playerStats: args.playerStats as any,
          targetStats: args.targetStats as any || { level: 90, armor: 10000, hp: 1000000 },
          rotation: args.rotation as any || { abilities: [], cycleDuration: 6.0 },
          duration: (args.duration as number) || 300,
        });
      } else if (simulationType === "whatif") {
        result = await analyzeWhatIf(
          {
            playerStats: args.playerStats as any,
            targetStats: args.targetStats as any || { level: 90, armor: 10000, hp: 1000000 },
            rotation: args.rotation as any || { abilities: [], cycleDuration: 6.0 },
            duration: (args.duration as number) || 300,
          },
          [{ name: args.scenario as string || "Custom Scenario", statChanges: {} }]
        );
      } else {
        throw new Error(`Unknown simulation type: ${simulationType}`);
      }

      return jsonResponse(result);
    },
  },
  {
    definition: {
      name: "analyze-bot-ai",
      description: "Analyze PlayerBot C++ AI code - parse decision trees, detect issues, generate flowcharts. Essential for understanding complex bot logic.",
      inputSchema: {
        type: "object",
        properties: {
          filePath: { type: "string", description: "Path to bot AI C++ file (e.g., PlayerbotWarriorAI.cpp)" },
          outputFormat: { type: "string", enum: ["json", "markdown", "flowchart"], description: "Output format (default: markdown)" },
          detectIssues: { type: "boolean", description: "Detect issues like missing cooldown checks (default: true)" },
          generateOptimizations: { type: "boolean", description: "Generate optimization suggestions (default: true)" },
        },
        required: ["filePath"],
      },
    },
    handler: async (args) => {
      const report = await analyzeBotAI({
        filePath: args.filePath as string,
        outputFormat: args.outputFormat as "json" | "markdown" | "flowchart" | undefined,
        detectIssues: args.detectIssues as boolean | undefined,
        generateOptimizations: args.generateOptimizations as boolean | undefined,
      });
      const formatted = await formatAIAnalysisReport(
        report,
        (args.outputFormat as "json" | "markdown" | "flowchart") || "markdown"
      );
      return textResponse(formatted);
    },
  },
  {
    definition: {
      name: "analyze-bot-combat-log",
      description: "Analyze bot combat performance from TrinityCore logs - calculate DPS/HPS, detect rotation issues, compare vs theoretical max. Validates AI effectiveness.",
      inputSchema: {
        type: "object",
        properties: {
          logFile: { type: "string", description: "Path to combat log file" },
          logText: { type: "string", description: "Combat log text (alternative to logFile)" },
          botName: { type: "string", description: "Filter to specific bot name" },
          encounter: { type: "string", description: "Encounter name for report title" },
          startTime: { type: "number", description: "Start timestamp (ms)" },
          endTime: { type: "number", description: "End timestamp (ms)" },
          compareWithTheoretical: { type: "boolean", description: "Compare with theoretical max DPS (default: true)" },
          outputFormat: { type: "string", enum: ["json", "markdown"], description: "Output format (default: markdown)" },
        },
      },
    },
    handler: async (args) => {
      const report = await analyzeBotCombatLog({
        logFile: args.logFile as string | undefined,
        logText: args.logText as string | undefined,
        botName: args.botName as string | undefined,
        encounter: args.encounter as string | undefined,
        startTime: args.startTime as number | undefined,
        endTime: args.endTime as number | undefined,
        compareWithTheoretical: args.compareWithTheoretical as boolean | undefined,
      });
      const formatted = await formatCombatAnalysisReport(
        report,
        (args.outputFormat as "json" | "markdown") || "markdown"
      );
      return textResponse(formatted);
    },
  },
  {
    definition: {
      name: "analyze-combat-log-comprehensive",
      description: "ADVANCED: Comprehensive bot combat log analysis with ML-powered insights. Includes cooldown tracking, decision tree analysis, combat mechanics evaluation, ML pattern detection, performance comparison, and actionable recommendations.",
      inputSchema: {
        type: "object",
        properties: {
          logFile: { type: "string", description: "Path to combat log file" },
          logText: { type: "string", description: "Combat log text (alternative to logFile)" },
          botName: { type: "string", description: "Bot name to analyze (required)" },
          className: { type: "string", description: "Bot class (e.g., Warrior, Mage) - enables performance comparison" },
          spec: { type: "string", description: "Bot spec (e.g., Arms, Fire) - optional for performance comparison" },
          level: { type: "number", description: "Bot level (default: 60)" },
          includeML: { type: "boolean", description: "Include ML pattern detection and behavior classification (default: true)" },
          includeRecommendations: { type: "boolean", description: "Include comprehensive recommendations (default: true)" },
          outputFormat: { type: "string", enum: ["json", "markdown", "summary"], description: "Output format (default: markdown)" },
        },
        required: ["botName"],
      },
    },
    handler: async (args) => {
      const comprehensiveReport = await analyzeComprehensive({
        logFile: args.logFile as string | undefined,
        logText: args.logText as string | undefined,
        botName: args.botName as string,
        className: args.className as string | undefined,
        spec: args.spec as string | undefined,
        level: args.level as number | undefined,
        includeML: args.includeML as boolean | undefined,
        includeRecommendations: args.includeRecommendations as boolean | undefined,
        outputFormat: (args.outputFormat as "json" | "markdown" | "summary") || "markdown",
      });

      const format = (args.outputFormat as "json" | "markdown" | "summary") || "markdown";
      let formatted: string;
      if (format === "json") {
        formatted = formatComprehensiveReportJSON(comprehensiveReport);
      } else if (format === "summary") {
        formatted = formatComprehensiveReportSummary(comprehensiveReport);
      } else {
        formatted = formatComprehensiveReportMarkdown(comprehensiveReport);
      }

      return textResponse(formatted);
    },
  },
];
