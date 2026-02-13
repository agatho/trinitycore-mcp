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
  console.log(`[MCP Server] Dynamic tool loading ENABLED`);
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
  console.log(`[MCP Server] Dynamic mode: ${stats.loadedTools} tools loaded, ${stats.availableTools} available for on-demand loading`);
} else {
  console.log(`[MCP Server] Static mode: Loaded ${TOOLS.length} / ${ALL_TOOLS.length} tools based on profile`);
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

// Start server
async function main() {
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
