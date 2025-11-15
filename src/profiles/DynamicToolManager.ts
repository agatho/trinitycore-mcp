/**
 * Dynamic Tool Manager
 *
 * MCP protocol extensions for runtime tool loading/unloading.
 * Provides admin API for profile and tool management.
 *
 * @module profiles/DynamicToolManager
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { getDynamicToolRegistry, ToolUsageStats } from './DynamicToolRegistry.js';
import { getProfileLoader } from './ProfileLoader.js';
import { getAutoProfileDetector } from './AutoProfileDetector.js';
import { ToolProfile, TOOL_CATEGORIES, getAllToolNames } from './ToolProfile.js';
import { logger } from '../utils/logger.js';

/**
 * Tool recommendation
 */
export interface ToolRecommendation {
  toolName: string;
  reason: string;
  confidence: number;
  estimatedTokens: number;
}

/**
 * Profile switch result
 */
export interface ProfileSwitchResult {
  success: boolean;
  previousProfile: ToolProfile;
  newProfile: ToolProfile;
  toolsLoaded: number;
  toolsUnloaded: number;
  message: string;
}

/**
 * Dynamic load result
 */
export interface DynamicLoadResult {
  success: boolean;
  toolName: string;
  wasLoaded: boolean;
  message: string;
  loadTime?: number;
}

/**
 * Dynamic tool manager
 *
 * Provides MCP protocol extensions for dynamic tool management.
 */
export class DynamicToolManager {
  private registry = getDynamicToolRegistry();
  private profileLoader = getProfileLoader();
  private autoDetector = getAutoProfileDetector();
  private mcpServer: any; // MCP Server instance

  /**
   * Initialize dynamic tool manager
   */
  initialize(mcpServer: any, allTools: Tool[]): void {
    this.mcpServer = mcpServer;
    this.registry.initializeAvailableTools(allTools);

    // Load initial tools based on profile
    const initialTools = this.profileLoader.getToolsToLoad();
    initialTools.forEach(toolName => {
      this.registry.loadTool(toolName, 'startup');
    });

    logger.info('DynamicToolManager', `Initialized with ${initialTools.length} tools loaded`);
  }

  /**
   * Load a tool on-demand
   */
  async loadToolOnDemand(toolName: string): Promise<DynamicLoadResult> {
    const startTime = Date.now();

    try {
      // Check if tool exists
      const allTools = getAllToolNames();
      if (!allTools.includes(toolName)) {
        return {
          success: false,
          toolName,
          wasLoaded: false,
          message: `Tool ${toolName} does not exist`
        };
      }

      // Check if already loaded
      if (this.registry.isToolLoaded(toolName)) {
        return {
          success: true,
          toolName,
          wasLoaded: true,
          message: `Tool ${toolName} was already loaded`
        };
      }

      // Load the tool
      const loaded = await this.registry.loadTool(toolName, 'on-demand');

      if (loaded) {
        // Notify MCP server to refresh tools list
        await this.refreshMCPToolsList();

        const loadTime = Date.now() - startTime;
        return {
          success: true,
          toolName,
          wasLoaded: false,
          message: `Tool ${toolName} loaded successfully`,
          loadTime
        };
      } else {
        return {
          success: false,
          toolName,
          wasLoaded: false,
          message: `Failed to load tool ${toolName}`
        };
      }

    } catch (error) {
      logger.error('DynamicToolManager', `Error loading tool ${toolName}`, error);
      return {
        success: false,
        toolName,
        wasLoaded: false,
        message: `Error loading tool: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Unload a tool manually
   */
  async unloadTool(toolName: string): Promise<DynamicLoadResult> {
    try {
      // Check if loaded
      if (!this.registry.isToolLoaded(toolName)) {
        return {
          success: false,
          toolName,
          wasLoaded: false,
          message: `Tool ${toolName} is not loaded`
        };
      }

      // Unload the tool
      const unloaded = await this.registry.unloadTool(toolName, 'manual');

      if (unloaded) {
        // Notify MCP server to refresh tools list
        await this.refreshMCPToolsList();

        return {
          success: true,
          toolName,
          wasLoaded: true,
          message: `Tool ${toolName} unloaded successfully`
        };
      } else {
        return {
          success: false,
          toolName,
          wasLoaded: true,
          message: `Failed to unload tool ${toolName} (may be at minimum tools limit)`
        };
      }

    } catch (error) {
      logger.error('DynamicToolManager', `Error unloading tool ${toolName}`, error);
      return {
        success: false,
        toolName,
        wasLoaded: true,
        message: `Error unloading tool: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Switch to a different profile
   */
  async switchProfile(newProfile: ToolProfile): Promise<ProfileSwitchResult> {
    try {
      const previousProfile = this.profileLoader.getProfile();

      if (previousProfile === newProfile) {
        return {
          success: true,
          previousProfile,
          newProfile,
          toolsLoaded: 0,
          toolsUnloaded: 0,
          message: `Already using profile ${newProfile}`
        };
      }

      // Get tools for new profile
      const currentTools = this.registry.getLoadedTools().map(t => t.name);
      const newTools = this.getToolsForProfile(newProfile);

      // Calculate tools to load/unload
      const toolsToLoad = newTools.filter(t => !currentTools.includes(t));
      const toolsToUnload = currentTools.filter(t => !newTools.includes(t));

      // Unload tools not in new profile
      for (const toolName of toolsToUnload) {
        await this.registry.unloadTool(toolName, 'optimization');
      }

      // Load tools for new profile
      for (const toolName of toolsToLoad) {
        await this.registry.loadTool(toolName, 'manual');
      }

      // Notify MCP server to refresh tools list
      await this.refreshMCPToolsList();

      logger.info('DynamicToolManager', `Switched profile: ${previousProfile} → ${newProfile} (loaded: ${toolsToLoad.length}, unloaded: ${toolsToUnload.length})`);

      return {
        success: true,
        previousProfile,
        newProfile,
        toolsLoaded: toolsToLoad.length,
        toolsUnloaded: toolsToUnload.length,
        message: `Successfully switched to ${newProfile} profile`
      };

    } catch (error) {
      logger.error('DynamicToolManager', `Error switching profile to ${newProfile}`, error);
      return {
        success: false,
        previousProfile: this.profileLoader.getProfile(),
        newProfile,
        toolsLoaded: 0,
        toolsUnloaded: 0,
        message: `Error switching profile: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Get tool recommendations based on usage patterns
   */
  getToolRecommendations(maxRecommendations: number = 5): ToolRecommendation[] {
    const recommendations: ToolRecommendation[] = [];
    const allStats = this.registry.getAllStats();

    // Find frequently used but not currently loaded tools
    const notLoaded = allStats.filter(s => !s.isCurrentlyLoaded && s.useCount > 0);
    notLoaded.sort((a, b) => b.useCount - a.useCount);

    for (const stats of notLoaded.slice(0, maxRecommendations)) {
      const confidence = Math.min(stats.useCount / 10, 1.0); // Cap at 1.0

      recommendations.push({
        toolName: stats.toolName,
        reason: `Used ${stats.useCount} times in this session`,
        confidence,
        estimatedTokens: 680 // Average tokens per tool
      });
    }

    return recommendations;
  }

  /**
   * Get profile recommendation based on usage
   */
  getProfileRecommendation(): { profile: ToolProfile; reason: string; confidence: number } {
    return this.autoDetector.analyzeUsageAndRecommend();
  }

  /**
   * Record tool usage
   */
  recordToolUsage(toolName: string): void {
    this.registry.recordToolUsage(toolName);
    this.autoDetector.recordToolUsage(toolName);
  }

  /**
   * Get current registry statistics
   */
  getRegistryStats(): any {
    return this.registry.getRegistryStats();
  }

  /**
   * Get tool usage statistics
   */
  getToolUsageStats(): ToolUsageStats[] {
    return this.registry.getAllStats();
  }

  /**
   * Get tools for a specific profile
   */
  private getToolsForProfile(profile: ToolProfile): string[] {
    // This mirrors the logic in ProfileLoader
    if (profile === ToolProfile.FULL) {
      return getAllToolNames();
    }

    if (profile === ToolProfile.DYNAMIC) {
      return TOOL_CATEGORIES['ultra-minimal'].tools;
    }

    // For other profiles, use the categorization
    const category = TOOL_CATEGORIES[profile];
    if (category) {
      return category.tools;
    }

    // Fallback
    return TOOL_CATEGORIES['core-data'].tools;
  }

  /**
   * Refresh MCP server's tools list
   */
  private async refreshMCPToolsList(): Promise<void> {
    // This would trigger the MCP server to re-send its tools list
    // The actual implementation depends on how the MCP server handles this
    logger.debug('DynamicToolManager', 'MCP tools list refresh requested');

    // Note: The MCP SDK doesn't have a built-in way to refresh tools
    // Clients will see updated tools on next ListTools request
  }

  /**
   * Export usage data
   */
  exportUsageData(): string {
    const registryData = this.registry.exportUsageData();
    const autoDetectorData = this.autoDetector.exportUsageData();

    return JSON.stringify({
      registry: JSON.parse(registryData),
      autoDetector: JSON.parse(autoDetectorData),
      currentProfile: this.profileLoader.getProfile(),
      timestamp: new Date().toISOString()
    }, null, 2);
  }

  /**
   * Shutdown manager
   */
  shutdown(): void {
    this.registry.shutdown();
    logger.info('DynamicToolManager', 'Shutdown complete');
  }
}

/**
 * Singleton instance
 */
let dynamicToolManager: DynamicToolManager | null = null;

/**
 * Get or create dynamic tool manager instance
 */
export function getDynamicToolManager(): DynamicToolManager {
  if (!dynamicToolManager) {
    dynamicToolManager = new DynamicToolManager();
  }
  return dynamicToolManager;
}

/**
 * Reset dynamic tool manager (for testing)
 */
export function resetDynamicToolManager(): void {
  dynamicToolManager = null;
}
