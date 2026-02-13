/**
 * Tool Registry - Aggregation Module
 *
 * Imports all category-specific tool registries and exports:
 * - ALL_TOOL_ENTRIES: Combined array of all ToolRegistryEntry objects
 * - TOOL_HANDLER_MAP: Map from tool name → handler function for O(1) dispatch
 * - ALL_TOOL_DEFINITIONS: Array of MCP Tool definitions for ListToolsRequestSchema
 *
 * This replaces the monolithic 5,500-line index.ts ALL_TOOLS array + switch statement
 * with a modular, maintainable registry pattern.
 *
 * @module tools/registry
 */

import { ToolRegistryEntry, ToolHandler, ToolResponse } from "./types";
import { gameDataTools } from "./game-data";
import { gametableTools } from "./gametables";
import { creatureTools } from "./creatures";
import { combatStrategyTools } from "./combat-strategy";
import { economyQuestingTools } from "./economy-questing";
import { knowledgeCodegenTools } from "./knowledge-codegen";
import { codeAnalysisTools } from "./code-analysis";
import { botAnalysisTools } from "./bot-analysis";
import { performanceTestingTools } from "./performance-testing";
import { monitoringProductionTools } from "./monitoring-production";
import { mapTools } from "./map-tools";
import { databaseOpsTools } from "./database-ops";
import { learningSystemsTools } from "./learning-systems";
import { replayTools } from "./replay-tools";
import { economySimulationTools } from "./economy-simulation-tools";
import { cppTestTools } from "./cpp-test-tools";
import { createConfigManagementTools, ConfigManagementDeps } from "./config-management";

// Re-export types for convenience
export type { ToolRegistryEntry, ToolHandler, ToolResponse, ConfigManagementDeps };
export { jsonResponse, textResponse } from "./types";

/**
 * Static tool entries (no runtime dependencies required).
 * These are available immediately at module load time.
 */
const STATIC_TOOL_ENTRIES: ToolRegistryEntry[] = [
  ...gameDataTools,
  ...gametableTools,
  ...creatureTools,
  ...combatStrategyTools,
  ...economyQuestingTools,
  ...knowledgeCodegenTools,
  ...codeAnalysisTools,
  ...botAnalysisTools,
  ...performanceTestingTools,
  ...monitoringProductionTools,
  ...mapTools,
  ...databaseOpsTools,
  ...learningSystemsTools,
  ...replayTools,
  ...economySimulationTools,
  ...cppTestTools,
];

/**
 * Build the complete tool registry including config/dynamic tools that need runtime deps.
 *
 * @param deps - Runtime dependencies for config management and dynamic tool management
 * @returns Object containing all tool entries, a handler dispatch map, and MCP definitions
 */
export function buildToolRegistry(deps: ConfigManagementDeps) {
  const configTools = createConfigManagementTools(deps);

  const allEntries: ToolRegistryEntry[] = [
    ...STATIC_TOOL_ENTRIES,
    ...configTools,
  ];

  // Build O(1) handler dispatch map (replaces giant switch statement)
  const handlerMap = new Map<string, ToolHandler>();
  for (const entry of allEntries) {
    if (handlerMap.has(entry.definition.name)) {
      console.warn(`[ToolRegistry] Duplicate tool name detected: ${entry.definition.name} - last definition wins`);
    }
    handlerMap.set(entry.definition.name, entry.handler);
  }

  // Build MCP Tool definitions array (for ListToolsRequestSchema)
  const definitions = allEntries.map((entry) => ({
    name: entry.definition.name,
    description: entry.definition.description,
    inputSchema: entry.definition.inputSchema,
  }));

  return {
    /** All registry entries (definition + handler pairs) */
    allEntries,
    /** O(1) tool name → handler dispatch map */
    handlerMap,
    /** MCP Tool definitions for ListToolsRequestSchema */
    definitions,
    /** Total tool count */
    toolCount: allEntries.length,
  };
}

/**
 * Get static tool count (useful for logging before runtime deps are available)
 */
export function getStaticToolCount(): number {
  return STATIC_TOOL_ENTRIES.length;
}

/**
 * Get static tool names (useful for profile filtering before full registry build)
 */
export function getStaticToolNames(): string[] {
  return STATIC_TOOL_ENTRIES.map((entry) => entry.definition.name);
}
