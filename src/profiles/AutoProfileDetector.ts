/**
 * Automatic Profile Detection and Management
 *
 * Detects the client type and automatically selects the optimal profile.
 * Supports runtime profile switching for dynamic tool loading.
 *
 * @module profiles/AutoProfileDetector
 */

import { ToolProfile } from './ToolProfile.js';
import { logger } from '../utils/logger.js';

/**
 * Client type detection
 */
export enum ClientType {
  /** Web UI browser client */
  WEB_UI = 'web-ui',

  /** Claude Code IDE integration */
  CLAUDE_CODE = 'claude-code',

  /** MCP Inspector or testing tool */
  INSPECTOR = 'inspector',

  /** Unknown/generic MCP client */
  UNKNOWN = 'unknown'
}

/**
 * Profile recommendation based on context
 */
export interface ProfileRecommendation {
  /** Recommended profile */
  profile: ToolProfile;

  /** Confidence score (0-1) */
  confidence: number;

  /** Reason for recommendation */
  reason: string;

  /** Alternative profiles */
  alternatives?: ToolProfile[];
}

/**
 * Automatic profile detector
 */
export class AutoProfileDetector {
  private detectedClientType: ClientType | null = null;
  private toolUsageHistory: Map<string, number> = new Map();
  private sessionStartTime: number = Date.now();

  /**
   * Detect client type from environment and runtime context
   */
  detectClientType(): ClientType {
    if (this.detectedClientType) {
      return this.detectedClientType;
    }

    // Check explicit environment variable
    if (process.env.MCP_CLIENT_TYPE) {
      const clientType = process.env.MCP_CLIENT_TYPE as ClientType;
      logger.info('AutoProfileDetector', `Client type explicitly set: ${clientType}`);
      this.detectedClientType = clientType;
      return clientType;
    }

    // Detect based on MCP_MODE environment variable
    if (process.env.MCP_MODE === 'webui') {
      this.detectedClientType = ClientType.WEB_UI;
      return ClientType.WEB_UI;
    }

    if (process.env.MCP_MODE === 'claude-code') {
      this.detectedClientType = ClientType.CLAUDE_CODE;
      return ClientType.CLAUDE_CODE;
    }

    // Check for Claude Code specific environment variables
    if (process.env.CLAUDE_CODE_VERSION || process.env.VSCODE_PID) {
      this.detectedClientType = ClientType.CLAUDE_CODE;
      return ClientType.CLAUDE_CODE;
    }

    // Check for MCP Inspector
    if (process.env.MCP_INSPECTOR === 'true') {
      this.detectedClientType = ClientType.INSPECTOR;
      return ClientType.INSPECTOR;
    }

    // Default to unknown
    logger.warn('AutoProfileDetector', 'Could not detect client type, using UNKNOWN');
    this.detectedClientType = ClientType.UNKNOWN;
    return ClientType.UNKNOWN;
  }

  /**
   * Recommend profile based on client type
   */
  recommendProfile(): ProfileRecommendation {
    const clientType = this.detectClientType();

    switch (clientType) {
      case ClientType.WEB_UI:
        return {
          profile: ToolProfile.FULL,
          confidence: 1.0,
          reason: 'Web UI requires all tools for comprehensive data browsing',
          alternatives: []
        };

      case ClientType.CLAUDE_CODE:
        // Start with dynamic profile for Claude Code
        return {
          profile: ToolProfile.DYNAMIC,
          confidence: 0.9,
          reason: 'Claude Code benefits from minimal profile with on-demand loading',
          alternatives: [ToolProfile.CORE_DATA, ToolProfile.PLAYERBOT_DEV]
        };

      case ClientType.INSPECTOR:
        return {
          profile: ToolProfile.FULL,
          confidence: 0.8,
          reason: 'Inspector tool benefits from seeing all available tools',
          alternatives: []
        };

      case ClientType.UNKNOWN:
      default:
        // Conservative default: full profile for backward compatibility
        return {
          profile: ToolProfile.FULL,
          confidence: 0.5,
          reason: 'Unknown client type, using full profile for safety',
          alternatives: [ToolProfile.DYNAMIC]
        };
    }
  }

  /**
   * Analyze tool usage patterns and suggest optimal profile
   */
  analyzeUsageAndRecommend(): ProfileRecommendation {
    const toolsUsed = Array.from(this.toolUsageHistory.keys());
    const totalCalls = Array.from(this.toolUsageHistory.values()).reduce((a, b) => a + b, 0);

    if (totalCalls === 0) {
      // No usage yet, use client-based detection
      return this.recommendProfile();
    }

    // Analyze which categories are being used
    const categoryUsage = new Map<string, number>();

    // This is simplified - in real implementation, map tools to categories
    const coreDataTools = ['get-spell-info', 'get-item-info', 'get-quest-info', 'get-creature-full-info'];
    const codeReviewTools = ['review-code-file', 'analyze-thread-safety', 'check-code-style'];
    const performanceTools = ['analyze-bot-performance', 'simulate-scaling'];

    let coreDataUsage = 0;
    let codeReviewUsage = 0;
    let performanceUsage = 0;

    toolsUsed.forEach(tool => {
      const count = this.toolUsageHistory.get(tool) || 0;
      if (coreDataTools.includes(tool)) coreDataUsage += count;
      if (codeReviewTools.includes(tool)) codeReviewUsage += count;
      if (performanceTools.includes(tool)) performanceUsage += count;
    });

    // Determine dominant usage pattern
    if (coreDataUsage > totalCalls * 0.7) {
      return {
        profile: ToolProfile.CORE_DATA,
        confidence: 0.85,
        reason: `Primary usage is game data queries (${coreDataUsage}/${totalCalls} calls)`,
        alternatives: [ToolProfile.PLAYERBOT_DEV]
      };
    }

    if (codeReviewUsage > totalCalls * 0.6) {
      return {
        profile: ToolProfile.CODE_REVIEW,
        confidence: 0.8,
        reason: `Primary usage is code review (${codeReviewUsage}/${totalCalls} calls)`,
        alternatives: [ToolProfile.PLAYERBOT_DEV]
      };
    }

    if (performanceUsage > totalCalls * 0.5) {
      return {
        profile: ToolProfile.PERFORMANCE,
        confidence: 0.75,
        reason: `Primary usage is performance analysis (${performanceUsage}/${totalCalls} calls)`,
        alternatives: []
      };
    }

    // Mixed usage - recommend composite profile
    if (toolsUsed.length > 20) {
      return {
        profile: ToolProfile.FULL,
        confidence: 0.7,
        reason: `Diverse tool usage (${toolsUsed.length} different tools)`,
        alternatives: []
      };
    }

    // Moderate usage - playerbot-dev composite
    return {
      profile: ToolProfile.PLAYERBOT_DEV,
      confidence: 0.65,
      reason: `Moderate tool usage across multiple categories (${toolsUsed.length} tools)`,
      alternatives: [ToolProfile.FULL]
    };
  }

  /**
   * Record tool usage for analysis
   */
  recordToolUsage(toolName: string): void {
    const currentCount = this.toolUsageHistory.get(toolName) || 0;
    this.toolUsageHistory.set(toolName, currentCount + 1);
  }

  /**
   * Get usage statistics
   */
  getUsageStats(): {
    toolsUsed: number;
    totalCalls: number;
    sessionDuration: number;
    topTools: Array<{ tool: string; calls: number }>;
  } {
    const totalCalls = Array.from(this.toolUsageHistory.values()).reduce((a, b) => a + b, 0);
    const topTools = Array.from(this.toolUsageHistory.entries())
      .map(([tool, calls]) => ({ tool, calls }))
      .sort((a, b) => b.calls - a.calls)
      .slice(0, 10);

    return {
      toolsUsed: this.toolUsageHistory.size,
      totalCalls,
      sessionDuration: Date.now() - this.sessionStartTime,
      topTools
    };
  }

  /**
   * Reset usage tracking
   */
  reset(): void {
    this.toolUsageHistory.clear();
    this.sessionStartTime = Date.now();
  }

  /**
   * Export usage data for analysis
   */
  exportUsageData(): string {
    const stats = this.getUsageStats();
    const recommendation = this.analyzeUsageAndRecommend();

    return JSON.stringify({
      clientType: this.detectedClientType,
      stats,
      recommendation,
      timestamp: new Date().toISOString()
    }, null, 2);
  }
}

/**
 * Singleton instance
 */
let autoDetector: AutoProfileDetector | null = null;

/**
 * Get or create auto detector instance
 */
export function getAutoProfileDetector(): AutoProfileDetector {
  if (!autoDetector) {
    autoDetector = new AutoProfileDetector();
  }
  return autoDetector;
}

/**
 * Reset auto detector (for testing)
 */
export function resetAutoProfileDetector(): void {
  autoDetector = null;
}
