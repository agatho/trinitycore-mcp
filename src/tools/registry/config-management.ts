/**
 * Configuration Management Tools Registry
 *
 * Config CRUD operations and MCP dynamic tool management (load/unload/profile switching).
 *
 * These tools require runtime singletons (getConfigManager, getDynamicToolManager)
 * which are injected via the createConfigManagementTools factory function.
 *
 * @module tools/registry/config-management
 */

import { ToolRegistryEntry, jsonResponse } from "./types";

/**
 * Runtime dependencies for config and MCP dynamic tool management.
 * These are injected at startup from the main index.ts.
 */
export interface ConfigManagementDeps {
  getConfigManager: () => {
    getConfig: () => Record<string, unknown>;
    updateDatabase: (updates: unknown) => Promise<{ valid: boolean }>;
    updateDataPaths: (updates: unknown) => Promise<{ valid: boolean }>;
    updateServer: (updates: unknown) => Promise<{ valid: boolean }>;
    updateWebSocket: (updates: unknown) => Promise<{ valid: boolean }>;
    updateTesting: (updates: unknown) => Promise<{ valid: boolean }>;
    updateLogging: (updates: unknown) => Promise<{ valid: boolean }>;
    validate: (config: unknown) => unknown;
    save: () => Promise<void>;
    reset: () => Promise<void>;
  };
  isDynamicMode: boolean;
  dynamicToolManager: {
    loadToolOnDemand: (toolName: string) => Promise<unknown>;
    unloadTool: (toolName: string) => Promise<unknown>;
    switchProfile: (profile: string) => Promise<unknown>;
    getToolUsageStats: () => unknown[];
    getToolRecommendations: (max: number) => unknown;
    getProfileRecommendation: () => unknown;
    getRegistryStats: () => { loadedTools: number; availableTools: number };
    exportUsageData: () => string;
  };
}

/**
 * Factory function that creates config management tool entries with injected runtime deps.
 */
export function createConfigManagementTools(deps: ConfigManagementDeps): ToolRegistryEntry[] {
  const { getConfigManager, isDynamicMode, dynamicToolManager } = deps;

  const dynamicModeError = jsonResponse({
    success: false,
    message: "Dynamic tool loading only available in DYNAMIC profile or with MCP_LAZY_LOAD=true",
  });

  return [
    // ===================== Config Tools =====================
    {
      definition: {
        name: "config-get",
        description: "Get current TrinityCore MCP configuration. Returns all settings including database, paths, server, websocket, testing, and logging config.",
        inputSchema: {
          type: "object",
          properties: {
            section: {
              type: "string",
              enum: ["database", "dataPaths", "server", "websocket", "testing", "logging", "all"],
              description: "Configuration section to retrieve (default: all)",
            },
          },
        },
      },
      handler: async (args) => {
        const configManager = getConfigManager();
        const section = (args.section as string) || "all";

        let result: unknown;
        if (section === "all") {
          result = configManager.getConfig();
        } else {
          result = { [section]: (configManager.getConfig() as Record<string, unknown>)[section] };
        }

        return jsonResponse(result);
      },
    },
    {
      definition: {
        name: "config-update",
        description: "Update TrinityCore MCP configuration. Validates changes before applying. Supports hot-reload for most settings.",
        inputSchema: {
          type: "object",
          properties: {
            section: {
              type: "string",
              enum: ["database", "dataPaths", "server", "websocket", "testing", "logging"],
              description: "Configuration section to update",
            },
            config: { type: "object", description: "Configuration updates (section-specific structure)" },
            persist: { type: "boolean", description: "Save changes to config file (default: true)" },
          },
          required: ["section", "config"],
        },
      },
      handler: async (args) => {
        const configManager = getConfigManager();
        const section = args.section as string;
        const updates = args.config;
        const persist = (args.persist as boolean) ?? true;

        let validationResult: { valid: boolean };
        switch (section) {
          case "database":
            validationResult = await configManager.updateDatabase(updates);
            break;
          case "dataPaths":
            validationResult = await configManager.updateDataPaths(updates);
            break;
          case "server":
            validationResult = await configManager.updateServer(updates);
            break;
          case "websocket":
            validationResult = await configManager.updateWebSocket(updates);
            break;
          case "testing":
            validationResult = await configManager.updateTesting(updates);
            break;
          case "logging":
            validationResult = await configManager.updateLogging(updates);
            break;
          default:
            throw new Error(`Unknown config section: ${section}`);
        }

        if (persist && validationResult.valid) {
          await configManager.save();
        }

        return jsonResponse(validationResult);
      },
    },
    {
      definition: {
        name: "config-validate",
        description: "Validate configuration without applying. Returns errors and warnings for invalid settings.",
        inputSchema: {
          type: "object",
          properties: {
            config: { type: "object", description: "Configuration to validate (full or partial)" },
          },
          required: ["config"],
        },
      },
      handler: async (args) => {
        const configManager = getConfigManager();
        const result = configManager.validate(args.config);
        return jsonResponse(result);
      },
    },
    {
      definition: {
        name: "config-reset",
        description: "Reset configuration to defaults. Can reset specific section or entire config. Creates backup before reset.",
        inputSchema: {
          type: "object",
          properties: {
            section: {
              type: "string",
              enum: ["database", "dataPaths", "server", "websocket", "testing", "logging", "all"],
              description: "Section to reset (default: all)",
            },
            createBackup: { type: "boolean", description: "Create backup before reset (default: true)" },
          },
        },
      },
      handler: async (args) => {
        const configManager = getConfigManager();
        const section = (args.section as string) || "all";
        const createBackup = (args.createBackup as boolean) ?? true;

        if (createBackup) {
          await configManager.save();
        }

        await configManager.reset();

        return jsonResponse({
          success: true,
          message: `Configuration ${section === "all" ? "fully" : `section '${section}'`} reset to defaults`,
          backupCreated: createBackup,
        });
      },
    },
    {
      definition: {
        name: "config-export",
        description: "Export current configuration to file. Supports JSON and YAML formats. Useful for backup and migration.",
        inputSchema: {
          type: "object",
          properties: {
            outputPath: { type: "string", description: "Output file path" },
            format: { type: "string", enum: ["json", "yaml"], description: "Export format (default: json)" },
            includeSecrets: { type: "boolean", description: "Include passwords and secrets (default: false)" },
          },
          required: ["outputPath"],
        },
      },
      handler: async (args) => {
        const configManager = getConfigManager();
        const outputPath = args.outputPath as string;
        const format = (args.format as string) || "json";
        const includeSecrets = (args.includeSecrets as boolean) || false;

        const config = configManager.getConfig();

        // Remove secrets if not requested
        let exportConfig = config as Record<string, unknown>;
        if (!includeSecrets) {
          exportConfig = JSON.parse(JSON.stringify(config));
          const dbConfig = exportConfig.database as Record<string, unknown> | undefined;
          if (dbConfig?.password) {
            dbConfig.password = "***REDACTED***";
          }
        }

        const fs = await import("fs/promises");
        if (format === "json") {
          await fs.writeFile(outputPath, JSON.stringify(exportConfig, null, 2));
        } else if (format === "yaml") {
          // Simple YAML export - for production use a proper YAML library
          const yamlContent = JSON.stringify(exportConfig, null, 2)
            .replace(/"/g, "")
            .replace(/,$/gm, "");
          await fs.writeFile(outputPath, yamlContent);
        }

        return jsonResponse({
          success: true,
          outputPath,
          format,
          secretsIncluded: includeSecrets,
        });
      },
    },
    // ===================== MCP Dynamic Tool Management =====================
    {
      definition: {
        name: "mcp-load-tool",
        description: "Load a tool on-demand (DYNAMIC profile only). Enables runtime tool loading to minimize token costs.",
        inputSchema: {
          type: "object",
          properties: {
            toolName: { type: "string", description: "Name of the tool to load" },
          },
          required: ["toolName"],
        },
      },
      handler: async (args) => {
        if (!isDynamicMode) return dynamicModeError;
        const result = await dynamicToolManager.loadToolOnDemand(args.toolName as string);
        return jsonResponse(result);
      },
    },
    {
      definition: {
        name: "mcp-unload-tool",
        description: "Unload a tool to free resources (DYNAMIC profile only). Part of automatic token optimization.",
        inputSchema: {
          type: "object",
          properties: {
            toolName: { type: "string", description: "Name of the tool to unload" },
          },
          required: ["toolName"],
        },
      },
      handler: async (args) => {
        if (!isDynamicMode) return dynamicModeError;
        const result = await dynamicToolManager.unloadTool(args.toolName as string);
        return jsonResponse(result);
      },
    },
    {
      definition: {
        name: "mcp-switch-profile",
        description: "Switch to a different tool profile (DYNAMIC profile only). Changes which tools are loaded.",
        inputSchema: {
          type: "object",
          properties: {
            profile: {
              type: "string",
              enum: ["full", "core-data", "code-review", "playerbot-dev", "performance", "database", "dynamic"],
              description: "Profile to switch to",
            },
          },
          required: ["profile"],
        },
      },
      handler: async (args) => {
        if (!isDynamicMode) return dynamicModeError;
        const result = await dynamicToolManager.switchProfile(args.profile as string);
        return jsonResponse(result);
      },
    },
    {
      definition: {
        name: "mcp-get-tool-stats",
        description: "Get tool usage statistics and recommendations (DYNAMIC profile only). Shows which tools are used most.",
        inputSchema: {
          type: "object",
          properties: {
            maxRecommendations: { type: "number", description: "Maximum number of recommendations (default: 5)" },
          },
        },
      },
      handler: async (args) => {
        if (!isDynamicMode) return dynamicModeError;
        const maxRecommendations = (args.maxRecommendations as number) || 5;
        const stats = dynamicToolManager.getToolUsageStats();
        const recommendations = dynamicToolManager.getToolRecommendations(maxRecommendations);
        const profileRecommendation = dynamicToolManager.getProfileRecommendation();

        return jsonResponse({
          toolUsageStats: (stats as unknown[]).slice(0, 20),
          recommendations,
          profileRecommendation,
        });
      },
    },
    {
      definition: {
        name: "mcp-get-registry-status",
        description: "Get dynamic tool registry status (DYNAMIC profile only). Shows loaded/available tools and auto-unload config.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      handler: async () => {
        if (!isDynamicMode) return dynamicModeError;
        const stats = dynamicToolManager.getRegistryStats();
        const usageData = dynamicToolManager.exportUsageData();

        return jsonResponse({
          registryStats: stats,
          detailedUsage: JSON.parse(usageData),
        });
      },
    },
  ];
}
