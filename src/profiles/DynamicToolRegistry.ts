/**
 * Dynamic Tool Registry
 *
 * Manages runtime loading and unloading of MCP tools.
 * Enables on-demand tool activation to minimize token costs.
 *
 * @module profiles/DynamicToolRegistry
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { logger } from '../utils/logger.js';

/**
 * Tool load event
 */
export interface ToolLoadEvent {
  toolName: string;
  timestamp: number;
  reason: 'startup' | 'on-demand' | 'manual' | 'recommendation';
}

/**
 * Tool unload event
 */
export interface ToolUnloadEvent {
  toolName: string;
  timestamp: number;
  reason: 'inactivity' | 'manual' | 'optimization';
  lastUsed: number;
}

/**
 * Tool usage statistics
 */
export interface ToolUsageStats {
  toolName: string;
  loadCount: number;
  unloadCount: number;
  useCount: number;
  lastUsed: number;
  totalLoadTime: number; // ms
  averageLoadTime: number; // ms
  isCurrentlyLoaded: boolean;
}

/**
 * Dynamic tool registry configuration
 */
export interface DynamicRegistryConfig {
  /** Enable automatic unloading of unused tools */
  autoUnload: boolean;

  /** Inactivity threshold before auto-unload (ms) */
  inactivityThreshold: number;

  /** Minimum tools to keep loaded */
  minToolsLoaded: number;

  /** Maximum tools to keep loaded */
  maxToolsLoaded: number;

  /** Check interval for auto-unload (ms) */
  checkInterval: number;
}

/**
 * Dynamic tool registry
 *
 * Manages runtime loading and unloading of MCP tools to optimize token usage.
 */
export class DynamicToolRegistry {
  private loadedTools: Map<string, Tool> = new Map();
  private availableTools: Map<string, Tool> = new Map();
  private usageStats: Map<string, ToolUsageStats> = new Map();
  private loadEvents: ToolLoadEvent[] = [];
  private unloadEvents: ToolUnloadEvent[] = [];
  private config: DynamicRegistryConfig;
  private autoUnloadInterval: NodeJS.Timeout | null = null;

  constructor(config?: Partial<DynamicRegistryConfig>) {
    this.config = {
      autoUnload: config?.autoUnload ?? true,
      inactivityThreshold: config?.inactivityThreshold ?? 300000, // 5 minutes
      minToolsLoaded: config?.minToolsLoaded ?? 1, // Ultra-minimal: just 1 essential tool
      maxToolsLoaded: config?.maxToolsLoaded ?? 50,
      checkInterval: config?.checkInterval ?? 60000 // 1 minute
    };

    if (this.config.autoUnload) {
      this.startAutoUnloadChecks();
    }
  }

  /**
   * Initialize registry with all available tools
   */
  initializeAvailableTools(tools: Tool[]): void {
    tools.forEach(tool => {
      this.availableTools.set(tool.name, tool);
      this.usageStats.set(tool.name, {
        toolName: tool.name,
        loadCount: 0,
        unloadCount: 0,
        useCount: 0,
        lastUsed: 0,
        totalLoadTime: 0,
        averageLoadTime: 0,
        isCurrentlyLoaded: false
      });
    });

    logger.info('DynamicToolRegistry', `Initialized with ${tools.length} available tools`);
  }

  /**
   * Load a tool into active registry
   */
  async loadTool(
    toolName: string,
    reason: ToolLoadEvent['reason'] = 'on-demand'
  ): Promise<boolean> {
    const startTime = Date.now();

    try {
      // Check if already loaded
      if (this.loadedTools.has(toolName)) {
        logger.debug('DynamicToolRegistry', `Tool ${toolName} already loaded`);
        return true;
      }

      // Check if tool exists
      const tool = this.availableTools.get(toolName);
      if (!tool) {
        logger.warn('DynamicToolRegistry', `Tool ${toolName} not found in available tools`);
        return false;
      }

      // Check if we've hit max tools limit
      if (this.loadedTools.size >= this.config.maxToolsLoaded) {
        logger.warn('DynamicToolRegistry', `Max tools limit reached (${this.config.maxToolsLoaded}), cannot load ${toolName}`);

        // Try to unload least recently used tool
        const lruTool = this.findLeastRecentlyUsedTool();
        if (lruTool && lruTool !== toolName) {
          await this.unloadTool(lruTool, 'optimization');
        } else {
          return false;
        }
      }

      // Load the tool
      this.loadedTools.set(toolName, tool);

      // Update statistics
      const stats = this.usageStats.get(toolName)!;
      const loadTime = Date.now() - startTime;
      stats.loadCount++;
      stats.totalLoadTime += loadTime;
      stats.averageLoadTime = stats.totalLoadTime / stats.loadCount;
      stats.isCurrentlyLoaded = true;

      // Record load event
      this.loadEvents.push({
        toolName,
        timestamp: Date.now(),
        reason
      });

      logger.info('DynamicToolRegistry', `Loaded tool: ${toolName} (${loadTime}ms, reason: ${reason})`);
      return true;

    } catch (error) {
      logger.error('DynamicToolRegistry', `Failed to load tool ${toolName}`, error);
      return false;
    }
  }

  /**
   * Unload a tool from active registry
   */
  async unloadTool(
    toolName: string,
    reason: ToolUnloadEvent['reason'] = 'manual'
  ): Promise<boolean> {
    try {
      // Check if loaded
      if (!this.loadedTools.has(toolName)) {
        logger.debug('DynamicToolRegistry', `Tool ${toolName} not loaded`);
        return false;
      }

      // Check if we're at minimum tools
      if (this.loadedTools.size <= this.config.minToolsLoaded) {
        logger.warn('DynamicToolRegistry', `Cannot unload ${toolName}: at minimum tools limit (${this.config.minToolsLoaded})`);
        return false;
      }

      // Unload the tool
      this.loadedTools.delete(toolName);

      // Update statistics
      const stats = this.usageStats.get(toolName)!;
      stats.unloadCount++;
      stats.isCurrentlyLoaded = false;

      // Record unload event
      this.unloadEvents.push({
        toolName,
        timestamp: Date.now(),
        reason,
        lastUsed: stats.lastUsed
      });

      logger.info('DynamicToolRegistry', `Unloaded tool: ${toolName} (reason: ${reason})`);
      return true;

    } catch (error) {
      logger.error('DynamicToolRegistry', `Failed to unload tool ${toolName}`, error);
      return false;
    }
  }

  /**
   * Record tool usage
   */
  recordToolUsage(toolName: string): void {
    const stats = this.usageStats.get(toolName);
    if (stats) {
      stats.useCount++;
      stats.lastUsed = Date.now();
    }
  }

  /**
   * Get currently loaded tools
   */
  getLoadedTools(): Tool[] {
    return Array.from(this.loadedTools.values());
  }

  /**
   * Get available tools (not currently loaded)
   */
  getAvailableTools(): Tool[] {
    const available: Tool[] = [];
    this.availableTools.forEach((tool, name) => {
      if (!this.loadedTools.has(name)) {
        available.push(tool);
      }
    });
    return available;
  }

  /**
   * Check if a tool is loaded
   */
  isToolLoaded(toolName: string): boolean {
    return this.loadedTools.has(toolName);
  }

  /**
   * Get tool usage statistics
   */
  getToolStats(toolName: string): ToolUsageStats | null {
    return this.usageStats.get(toolName) || null;
  }

  /**
   * Get all usage statistics
   */
  getAllStats(): ToolUsageStats[] {
    return Array.from(this.usageStats.values());
  }

  /**
   * Get load/unload event history
   */
  getEventHistory(): {
    loadEvents: ToolLoadEvent[];
    unloadEvents: ToolUnloadEvent[];
  } {
    return {
      loadEvents: [...this.loadEvents],
      unloadEvents: [...this.unloadEvents]
    };
  }

  /**
   * Find least recently used tool
   */
  private findLeastRecentlyUsedTool(): string | null {
    let lruTool: string | null = null;
    let oldestTime = Infinity;

    this.usageStats.forEach((stats, toolName) => {
      if (stats.isCurrentlyLoaded && stats.lastUsed < oldestTime) {
        oldestTime = stats.lastUsed;
        lruTool = toolName;
      }
    });

    return lruTool;
  }

  /**
   * Start automatic unload checks
   */
  private startAutoUnloadChecks(): void {
    this.autoUnloadInterval = setInterval(() => {
      this.checkAndUnloadInactiveTools();
    }, this.config.checkInterval);

    logger.info('DynamicToolRegistry', `Started auto-unload checks (interval: ${this.config.checkInterval}ms, threshold: ${this.config.inactivityThreshold}ms)`);
  }

  /**
   * Stop automatic unload checks
   */
  stopAutoUnloadChecks(): void {
    if (this.autoUnloadInterval) {
      clearInterval(this.autoUnloadInterval);
      this.autoUnloadInterval = null;
      logger.info('DynamicToolRegistry', 'Stopped auto-unload checks');
    }
  }

  /**
   * Check and unload inactive tools
   */
  private async checkAndUnloadInactiveTools(): Promise<void> {
    const now = Date.now();
    const toolsToUnload: string[] = [];

    // Find inactive tools
    this.usageStats.forEach((stats, toolName) => {
      if (stats.isCurrentlyLoaded) {
        const inactiveTime = now - stats.lastUsed;
        if (inactiveTime > this.config.inactivityThreshold) {
          toolsToUnload.push(toolName);
        }
      }
    });

    if (toolsToUnload.length === 0) {
      return;
    }

    logger.info('DynamicToolRegistry', `Found ${toolsToUnload.length} inactive tools to unload`);

    // Unload inactive tools (but respect minimum)
    for (const toolName of toolsToUnload) {
      if (this.loadedTools.size <= this.config.minToolsLoaded) {
        logger.debug('DynamicToolRegistry', 'Reached minimum tools limit, stopping auto-unload');
        break;
      }

      await this.unloadTool(toolName, 'inactivity');
    }
  }

  /**
   * Get registry statistics
   */
  getRegistryStats(): {
    totalTools: number;
    loadedTools: number;
    availableTools: number;
    loadEvents: number;
    unloadEvents: number;
    config: DynamicRegistryConfig;
  } {
    return {
      totalTools: this.availableTools.size,
      loadedTools: this.loadedTools.size,
      availableTools: this.availableTools.size - this.loadedTools.size,
      loadEvents: this.loadEvents.length,
      unloadEvents: this.unloadEvents.length,
      config: this.config
    };
  }

  /**
   * Export usage data for analysis
   */
  exportUsageData(): string {
    const stats = this.getRegistryStats();
    const allStats = this.getAllStats()
      .sort((a, b) => b.useCount - a.useCount)
      .slice(0, 20); // Top 20 tools

    return JSON.stringify({
      registryStats: stats,
      topTools: allStats,
      recentLoadEvents: this.loadEvents.slice(-10),
      recentUnloadEvents: this.unloadEvents.slice(-10),
      timestamp: new Date().toISOString()
    }, null, 2);
  }

  /**
   * Reset statistics (for testing)
   */
  resetStats(): void {
    this.usageStats.forEach(stats => {
      stats.loadCount = 0;
      stats.unloadCount = 0;
      stats.useCount = 0;
      stats.lastUsed = 0;
      stats.totalLoadTime = 0;
      stats.averageLoadTime = 0;
    });
    this.loadEvents = [];
    this.unloadEvents = [];
    logger.info('DynamicToolRegistry', 'Reset all statistics');
  }

  /**
   * Cleanup and shutdown
   */
  shutdown(): void {
    this.stopAutoUnloadChecks();
    logger.info('DynamicToolRegistry', 'Shutdown complete');
  }
}

/**
 * Singleton instance
 */
let dynamicRegistry: DynamicToolRegistry | null = null;

/**
 * Get or create dynamic tool registry instance
 */
export function getDynamicToolRegistry(config?: Partial<DynamicRegistryConfig>): DynamicToolRegistry {
  if (!dynamicRegistry) {
    dynamicRegistry = new DynamicToolRegistry(config);
  }
  return dynamicRegistry;
}

/**
 * Reset dynamic tool registry (for testing)
 */
export function resetDynamicToolRegistry(): void {
  if (dynamicRegistry) {
    dynamicRegistry.shutdown();
  }
  dynamicRegistry = null;
}
