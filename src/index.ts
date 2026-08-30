#!/usr/bin/env node

/**
 * TrinityCore MCP Server
 *
 * Enterprise-grade Model Context Protocol server for TrinityCore game data access.
 * Provides 120+ tools across 13 categories via a modular tool registry.
 *
 * @module index
 */

// Load environment variables from .env file
import dotenv from "dotenv";
import { logger } from './utils/logger';
dotenv.config();

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { getProfileLoader } from "./profiles/ProfileLoader.js";
import { getDynamicToolManager } from "./profiles/DynamicToolManager.js";
import { getConfigManager } from "./config/config-manager";
import { createErrorResponse, ValidationError } from "./utils/error-handler";
import { buildToolRegistry, ConfigManagementDeps } from "./tools/registry/index";
import { loadBuildManifest, getActiveBuild } from "./version/BuildManifest";
import { ensureSpellCache } from "./version/SpellCacheProvisioner";
import { warmSpellCaches } from "./tools/spell";
import { warmItemCaches } from "./tools/item";
import { warmSpellDetailTables } from "./tools/spell-detail";
import {
  findDataPathDisagreements,
  describeDataPathDisagreements,
} from "./version/DataPathConsistency";

/**
 * Build the MCP server: load the build manifest first, then register tools.
 *
 * The manifest must be loaded before tool registration so that every tool's
 * lazily-constructed, build-aware resources (DB2/DBC paths, JSON caches -
 * see e.g. src/tools/spell.ts's nameCache()) resolve against the declared
 * active build on their first real invocation, rather than a synthesized
 * fallback built from raw environment variables.
 */
async function initializeServer(): Promise<Server> {
  await loadBuildManifest();
  const activeBuild = getActiveBuild();
  logger.info(
    `Build manifest loaded: active build "${activeBuild.id}" (${activeBuild.build})`
  );

  // A stale DB2_PATH or VMAP_PATH no longer decides what tools read, but it
  // still misleads anything else on this machine that trusts it.
  for (const line of describeDataPathDisagreements(findDataPathDisagreements())) {
    logger.warn(line);
  }

  // Spell caches are keyed by build, so a fresh install or a build cutover
  // starts without them and every spell lookup would answer "Not Found". Start
  // generating them here rather than leaving it as a manual step. The
  // generation itself is deliberately not awaited: it takes several minutes and
  // the server must finish starting so its other tools are usable meanwhile.
  const spellCache = await ensureSpellCache();
  if (spellCache.ready) {
    logger.info(spellCache.detail);

    // Load the caches now so the first spell or item lookup does not pay for
    // reading ~39 MB of JSON. Deferred past startup so it never delays the
    // server becoming available, and never awaited: a failure here costs a
    // slow first request, not a broken server.
    setTimeout(() => {
      try {
        const start = Date.now();
        const spellsWarmed = warmSpellCaches();
        const itemsWarmed = warmItemCaches();
        // SpellMisc alone is 40 MB; opening it here keeps it off the first
        // request that asks for a spell's school, timing or cost.
        const detailWarmed = warmSpellDetailTables();
        logger.info(
          `Caches warmed in ${Date.now() - start} ms ` +
            `(spells ${spellsWarmed ? "ready" : "unavailable"}, ` +
            `items ${itemsWarmed ? "ready" : "unavailable"}, ` +
            `spell detail ${detailWarmed ? "ready" : "unavailable"})`
        );
      } catch (error) {
        logger.warn(`Spell cache warm-up failed: ${error}`);
      }
    }, 0).unref();
  } else {
    logger.warn(spellCache.detail);
  }

  // MCP Server instance
  const server = new Server(
    {
      name: "trinitycore-mcp-server",
      version: "2.4.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Initialize profile loader for conditional tool loading
  const profileLoader = getProfileLoader();

  // Initialize dynamic tool manager for runtime loading/unloading
  const dynamicToolManager = getDynamicToolManager();

  // Log profile information at startup
  profileLoader.logProfileInfo();

  // Determine dynamic mode
  const isDynamicMode = process.env.MCP_LAZY_LOAD === 'true' || profileLoader.getProfile() === 'dynamic';

  // Build the complete tool registry with runtime dependencies
  const registry = buildToolRegistry({
    getConfigManager: getConfigManager as unknown as ConfigManagementDeps["getConfigManager"],
    isDynamicMode,
    dynamicToolManager: dynamicToolManager as unknown as ConfigManagementDeps["dynamicToolManager"],
  });

  // Convert registry definitions to MCP Tool[] format for profile filtering and dynamic tool manager
  const ALL_TOOLS: Tool[] = registry.definitions.map((def) => ({
    name: def.name,
    description: def.description,
    inputSchema: def.inputSchema,
  }));

  // Initialize dynamic tool manager if in dynamic mode
  if (isDynamicMode) {
    process.stderr.write(`[MCP Server] Dynamic tool loading ENABLED
`);
    dynamicToolManager.initialize(server, ALL_TOOLS);
  }

  // Filter tools based on active profile
  let TOOLS: Tool[];

  if (isDynamicMode) {
    TOOLS = dynamicToolManager.getRegistryStats().loadedTools > 0
      ? []
      : ALL_TOOLS.filter(tool => profileLoader.shouldLoadTool(tool.name));
  } else {
    TOOLS = profileLoader.getProfile() === 'full'
      ? ALL_TOOLS
      : ALL_TOOLS.filter(tool => profileLoader.shouldLoadTool(tool.name));
  }

  // Log filtered tool count
  if (isDynamicMode) {
    const stats = dynamicToolManager.getRegistryStats();
    process.stderr.write(`[MCP Server] Dynamic mode: ${stats.loadedTools} tools loaded, ${stats.availableTools} available for on-demand loading
`);
  } else {
    process.stderr.write(`[MCP Server] Static mode: Loaded ${TOOLS.length} / ${ALL_TOOLS.length} tools based on profile
`);
  }

  // List tools handler (returns only tools loaded for current profile or dynamic registry)
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    if (isDynamicMode) {
      const loadedTools: Tool[] = [];
      for (const tool of ALL_TOOLS) {
        if (dynamicToolManager.getRegistryStats().loadedTools > 0) {
          const toolStats = dynamicToolManager.getToolUsageStats() as Array<{ toolName: string; isCurrentlyLoaded: boolean }>;
          const isLoaded = toolStats.some(stat =>
            stat.toolName === tool.name && stat.isCurrentlyLoaded
          );
          if (isLoaded) {
            loadedTools.push(tool);
          }
        }
      }
      return {
        tools: loadedTools.length > 0 ? loadedTools : TOOLS
      };
    } else {
      return {
        tools: TOOLS,
      };
    }
  });

  // Call tool handler with enterprise error handling
  // Uses O(1) Map dispatch instead of giant switch statement
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    // Record tool usage for analytics and dynamic loading
    if (isDynamicMode) {
      dynamicToolManager.recordToolUsage(name);
    }

    if (!args) {
      throw new ValidationError("Missing arguments for tool execution", {
        tool: name,
      });
    }

    try {
      const handler = registry.handlerMap.get(name);
      if (!handler) {
        throw new Error(`Unknown tool: ${name}`);
      }

      return await handler(args as Record<string, unknown>);
    } catch (error) {
      // Use centralized error handling
      const errorResponse = createErrorResponse(error, {
        tool: name,
        arguments: args,
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(errorResponse, null, 2),
          },
        ],
        isError: true,
      };
    }
  });

  return server;
}

// Start server
async function main() {
  const server = await initializeServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.error("TrinityCore MCP Server running on stdio");

  // Week 7: Optional cache warming on startup (disabled by default)
  // Uncomment to enable automatic cache warming for improved performance
  // const warmOnStartup = process.env.CACHE_WARM_ON_STARTUP === "true";
  // if (warmOnStartup) {
  //   logger.error("Warming DB2 caches...");
  //   const warmResult = await CacheWarmer.warmAllCaches();
  //   if (warmResult.success) {
  //     logger.error(`Cache warming complete: ${warmResult.recordsPreloaded} records in ${warmResult.totalTime}ms`);
  //   }
  // }
}

main().catch((error) => {
  logger.error("Fatal error:", error);
  process.exit(1);
});
