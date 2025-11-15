/**
 * MCP Tool Profile Loader
 *
 * Manages profile-based tool loading to reduce token consumption.
 * Determines which tools should be loaded based on environment configuration.
 *
 * @module profiles/ProfileLoader
 */

import {
  ToolProfile,
  TOOL_CATEGORIES,
  COMPOSITE_PROFILES,
  getCategoriesTools,
  getCategoriesTokens,
  getAllToolNames,
  getTotalEstimatedTokens,
  isValidProfile,
  getProfileDescription
} from './ToolProfile.js';
import { getAutoProfileDetector, ClientType } from './AutoProfileDetector.js';
import { logger } from '../utils/logger.js';

/**
 * Profile configuration options
 */
export interface ProfileConfig {
  /** Profile to load */
  profile: ToolProfile;

  /** Additional tools to load (beyond profile) */
  customTools?: string[];

  /** Tools to exclude from profile */
  excludeTools?: string[];

  /** Enable lazy loading (future feature) */
  lazyLoad?: boolean;
}

/**
 * Profile statistics
 */
export interface ProfileStats {
  /** Profile name */
  profile: ToolProfile;

  /** Number of tools loaded */
  toolCount: number;

  /** Estimated token usage */
  estimatedTokens: number;

  /** Percentage of total tools */
  percentOfTotal: number;

  /** Token reduction compared to full profile */
  tokenReduction: number;
}

/**
 * Tool profile loader
 *
 * Determines which tools to load based on profile configuration.
 * Does NOT actually register tools - that's done by index.ts.
 */
export class ToolProfileLoader {
  private config: ProfileConfig;
  private loadedTools: Set<string> = new Set();
  private detectedClientType: ClientType | null = null;
  private autoDetectionUsed: boolean = false;

  constructor(config?: ProfileConfig) {
    // Determine profile from environment or defaults
    const profileName = this.getProfileFromEnvironment();
    const profile = isValidProfile(profileName)
      ? (profileName as ToolProfile)
      : ToolProfile.FULL;

    this.config = config || {
      profile,
      lazyLoad: process.env.MCP_LAZY_LOAD === 'true',
      customTools: this.parseCustomTools(),
      excludeTools: this.parseExcludeTools()
    };

    // Pre-calculate loaded tools
    this.loadedTools = new Set(this.calculateToolsForProfile());
  }

  /**
   * Get profile name from environment variables or auto-detection
   */
  private getProfileFromEnvironment(): string {
    // Priority 1: Explicit profile override
    if (process.env.MCP_PROFILE) {
      logger.info('ProfileLoader', `Using explicit profile: ${process.env.MCP_PROFILE}`);
      return process.env.MCP_PROFILE;
    }

    // Priority 2: Explicit mode setting
    if (process.env.MCP_MODE === 'webui') {
      logger.info('ProfileLoader', 'Using full profile for Web UI mode');
      return ToolProfile.FULL;
    }

    if (process.env.MCP_MODE === 'claude-code') {
      logger.info('ProfileLoader', 'Using core-data profile for Claude Code mode');
      return ToolProfile.CORE_DATA;
    }

    // Priority 3: Auto-detection
    const autoDetector = getAutoProfileDetector();
    const recommendation = autoDetector.recommendProfile();
    this.detectedClientType = autoDetector.detectClientType();
    this.autoDetectionUsed = true;

    // Use auto-detection if high confidence
    if (recommendation.confidence >= 0.8) {
      logger.info('ProfileLoader', `Auto-detected profile: ${recommendation.profile} (${recommendation.reason})`);
      logger.info('ProfileLoader', `Client type: ${this.detectedClientType}, Confidence: ${(recommendation.confidence * 100).toFixed(0)}%`);
      return recommendation.profile;
    }

    // Priority 4: Safe default for backward compatibility
    logger.warn('ProfileLoader', `Low confidence auto-detection (${(recommendation.confidence * 100).toFixed(0)}%), using FULL profile for safety`);
    return ToolProfile.FULL;
  }

  /**
   * Parse custom tools from environment
   */
  private parseCustomTools(): string[] {
    const customStr = process.env.MCP_CUSTOM_TOOLS;
    if (!customStr) return [];

    return customStr
      .split(',')
      .map(t => t.trim())
      .filter(t => t.length > 0);
  }

  /**
   * Parse exclude tools from environment
   */
  private parseExcludeTools(): string[] {
    const excludeStr = process.env.MCP_EXCLUDE_TOOLS;
    if (!excludeStr) return [];

    return excludeStr
      .split(',')
      .map(t => t.trim())
      .filter(t => t.length > 0);
  }

  /**
   * Calculate which tools to load for current profile
   */
  private calculateToolsForProfile(): string[] {
    const profile = this.config.profile;

    // Full profile: All tools
    if (profile === ToolProfile.FULL) {
      return this.applyCustomizations(getAllToolNames());
    }

    // Dynamic profile: Start with ultra-minimal (1 tool), load rest on-demand
    if (profile === ToolProfile.DYNAMIC) {
      return this.applyCustomizations(TOOL_CATEGORIES['ultra-minimal'].tools);
    }

    // Composite profiles (multiple categories)
    if (COMPOSITE_PROFILES[profile]) {
      const categories = COMPOSITE_PROFILES[profile];
      const tools = getCategoriesTools(categories);
      return this.applyCustomizations(tools);
    }

    // Single category profiles
    if (TOOL_CATEGORIES[profile]) {
      return this.applyCustomizations(TOOL_CATEGORIES[profile].tools);
    }

    // Unknown profile - fallback to core-data
    console.warn(`[ProfileLoader] Unknown profile: ${profile}, using core-data`);
    return this.applyCustomizations(TOOL_CATEGORIES['core-data'].tools);
  }

  /**
   * Apply custom inclusions and exclusions
   */
  private applyCustomizations(tools: string[]): string[] {
    const toolSet = new Set(tools);

    // Add custom tools
    if (this.config.customTools) {
      this.config.customTools.forEach(tool => toolSet.add(tool));
    }

    // Remove excluded tools
    if (this.config.excludeTools) {
      this.config.excludeTools.forEach(tool => toolSet.delete(tool));
    }

    return Array.from(toolSet);
  }

  /**
   * Check if a specific tool should be loaded
   *
   * @param toolName - Tool name to check
   * @returns True if tool should be loaded
   */
  shouldLoadTool(toolName: string): boolean {
    return this.loadedTools.has(toolName);
  }

  /**
   * Get list of all tools that should be loaded
   *
   * @returns Array of tool names
   */
  getToolsToLoad(): string[] {
    return Array.from(this.loadedTools);
  }

  /**
   * Get current profile
   */
  getProfile(): ToolProfile {
    return this.config.profile;
  }

  /**
   * Get detected client type (if auto-detection was used)
   */
  getDetectedClientType(): ClientType | null {
    return this.detectedClientType;
  }

  /**
   * Check if auto-detection was used for profile selection
   */
  wasAutoDetectionUsed(): boolean {
    return this.autoDetectionUsed;
  }

  /**
   * Get tool count for current profile
   */
  getToolCount(): number {
    return this.loadedTools.size;
  }

  /**
   * Get estimated token usage for current profile
   */
  getEstimatedTokens(): number {
    const profile = this.config.profile;

    // Full profile
    if (profile === ToolProfile.FULL) {
      return getTotalEstimatedTokens();
    }

    // Dynamic profile (starts ultra-minimal - 1 tool)
    if (profile === ToolProfile.DYNAMIC) {
      return TOOL_CATEGORIES['ultra-minimal'].estimatedTokens;
    }

    // Composite profiles
    if (COMPOSITE_PROFILES[profile]) {
      const categories = COMPOSITE_PROFILES[profile];
      return getCategoriesTokens(categories);
    }

    // Single category
    if (TOOL_CATEGORIES[profile]) {
      return TOOL_CATEGORIES[profile].estimatedTokens;
    }

    // Fallback (shouldn't happen)
    return this.loadedTools.size * 680; // Avg tokens per tool
  }

  /**
   * Get profile statistics
   */
  getStats(): ProfileStats {
    const toolCount = this.getToolCount();
    const estimatedTokens = this.getEstimatedTokens();
    const totalTokens = getTotalEstimatedTokens();
    const percentOfTotal = (toolCount / getAllToolNames().length) * 100;
    const tokenReduction = ((totalTokens - estimatedTokens) / totalTokens) * 100;

    return {
      profile: this.config.profile,
      toolCount,
      estimatedTokens,
      percentOfTotal: Math.round(percentOfTotal * 10) / 10,
      tokenReduction: Math.round(tokenReduction * 10) / 10
    };
  }

  /**
   * Log profile information
   */
  logProfileInfo(): void {
    const stats = this.getStats();
    const description = getProfileDescription(stats.profile);

    console.log(`┌─────────────────────────────────────────────────────────────┐`);
    console.log(`│ MCP Tool Profile Loader                                     │`);
    console.log(`├─────────────────────────────────────────────────────────────┤`);

    // Show auto-detection info if used
    if (this.autoDetectionUsed && this.detectedClientType) {
      const clientTypeLabel = `Auto-detected: ${this.detectedClientType}`.padEnd(43);
      console.log(`│ Client Type:      ${clientTypeLabel}│`);
    }

    console.log(`│ Profile:          ${stats.profile.padEnd(43)}│`);
    console.log(`│ Description:      ${description.padEnd(43)}│`);
    console.log(`│ Tools:            ${String(stats.toolCount).padEnd(43)}│`);
    console.log(`│ Est. Tokens:      ~${String(stats.estimatedTokens).padEnd(42)}│`);
    console.log(`│ % of Total:       ${stats.percentOfTotal.toFixed(1)}%${String('').padEnd(40)}│`);

    if (stats.profile !== ToolProfile.FULL) {
      console.log(`│ Token Reduction:  ${stats.tokenReduction.toFixed(1)}% ↓${String('').padEnd(38)}│`);
    }

    console.log(`└─────────────────────────────────────────────────────────────┘`);

    // Log customizations if any
    if (this.config.customTools && this.config.customTools.length > 0) {
      console.log(`[ProfileLoader] Custom tools: ${this.config.customTools.join(', ')}`);
    }

    if (this.config.excludeTools && this.config.excludeTools.length > 0) {
      console.log(`[ProfileLoader] Excluded tools: ${this.config.excludeTools.join(', ')}`);
    }
  }

  /**
   * Get profile information as formatted string
   */
  getProfileInfo(): string {
    const stats = this.getStats();
    const lines: string[] = [];

    lines.push(`Profile: ${stats.profile}`);
    lines.push(`Tools: ${stats.toolCount}`);
    lines.push(`Estimated Tokens: ~${stats.estimatedTokens}`);

    if (stats.profile !== ToolProfile.FULL) {
      lines.push(`Token Reduction: ${stats.tokenReduction.toFixed(1)}%`);
    }

    return lines.join('\n');
  }

  /**
   * Load additional tools dynamically (future feature)
   *
   * @param toolNames - Tools to load
   */
  async loadTools(toolNames: string[]): Promise<void> {
    if (!this.config.lazyLoad) {
      throw new Error('Lazy loading not enabled. Set MCP_LAZY_LOAD=true');
    }

    // Add tools to loaded set
    toolNames.forEach(tool => this.loadedTools.add(tool));

    console.log(`[ProfileLoader] Dynamically loaded ${toolNames.length} tools: ${toolNames.join(', ')}`);
  }

  /**
   * Unload tools dynamically (future feature)
   *
   * @param toolNames - Tools to unload
   */
  async unloadTools(toolNames: string[]): Promise<void> {
    if (!this.config.lazyLoad) {
      throw new Error('Lazy loading not enabled. Set MCP_LAZY_LOAD=true');
    }

    // Remove tools from loaded set
    toolNames.forEach(tool => this.loadedTools.delete(tool));

    console.log(`[ProfileLoader] Dynamically unloaded ${toolNames.length} tools: ${toolNames.join(', ')}`);
  }
}

/**
 * Singleton instance
 */
let profileLoader: ToolProfileLoader | null = null;

/**
 * Get or create profile loader instance
 *
 * @param config - Optional configuration (only used on first call)
 * @returns Profile loader instance
 */
export function getProfileLoader(config?: ProfileConfig): ToolProfileLoader {
  if (!profileLoader) {
    profileLoader = new ToolProfileLoader(config);
  }
  return profileLoader;
}

/**
 * Reset profile loader (for testing)
 */
export function resetProfileLoader(): void {
  profileLoader = null;
}
