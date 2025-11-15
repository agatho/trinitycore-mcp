/**
 * MCP Tool Profile System
 *
 * Defines tool categories and profiles for context-aware tool loading.
 * Reduces token consumption for Claude Code while maintaining full functionality for Web UI.
 *
 * @module profiles/ToolProfile
 */

/**
 * Available tool profiles for different use cases
 */
export enum ToolProfile {
  /** All 111 tools - For Web UI and comprehensive data access */
  FULL = 'full',

  /** Essential game data access (10 tools, ~6,800 tokens) */
  CORE_DATA = 'core-data',

  /** Code review and analysis (8 tools, ~5,440 tokens) */
  CODE_REVIEW = 'code-review',

  /** Code generation and development (12 tools, ~8,160 tokens) */
  DEVELOPMENT = 'development',

  /** Performance analysis and testing (9 tools, ~6,120 tokens) */
  PERFORMANCE = 'performance',

  /** Database operations (11 tools, ~7,480 tokens) */
  DATABASE = 'database',

  /** World editing: maps, vmaps, mmaps (8 tools, ~5,440 tokens) */
  WORLD_EDITING = 'world-editing',

  /** Combat log analysis (10 tools, ~6,800 tokens) */
  COMBAT_ANALYSIS = 'combat-analysis',

  /** Composite: Core + Code + Performance (30 tools, ~20,400 tokens) */
  PLAYERBOT_DEV = 'playerbot-dev',

  /** Composite: Core + World + Database (29 tools, ~19,720 tokens) */
  QUEST_DEV = 'quest-dev',

  /** Dynamic loading: Start minimal, load on demand */
  DYNAMIC = 'dynamic'
}

/**
 * Tool category definition
 */
export interface ToolCategory {
  /** Category name */
  name: string;

  /** Tool names in this category */
  tools: string[];

  /** Load priority (lower = earlier, 1-10 scale) */
  priority: number;

  /** Category description */
  description: string;

  /** Estimated token usage (avg 680 tokens per tool) */
  estimatedTokens: number;
}

/**
 * Tool category definitions with granular tool listings
 */
export const TOOL_CATEGORIES: Record<string, ToolCategory> = {
  /** Ultra-minimal - Single essential tool for dynamic loading */
  'ultra-minimal': {
    name: 'Ultra-Minimal',
    tools: [
      'get-trinity-api' // Single most versatile tool - can query anything
    ],
    priority: 0,
    description: 'Single essential tool - all others loaded on-demand',
    estimatedTokens: 680
  },

  /** Core game data access - Most frequently used */
  'core-data': {
    name: 'Core Game Data',
    tools: [
      'get-spell-info',
      'get-item-info',
      'get-quest-info',
      'get-creature-full-info',
      'query-dbc',
      'get-trinity-api',
      'search-creatures',
      'get-opcode-info',
      'query-gametable',
      'get-combat-rating'
    ],
    priority: 1,
    description: 'Essential game data access tools (spells, items, creatures, quests)',
    estimatedTokens: 6800
  },

  /** Code review and analysis tools */
  'code-review': {
    name: 'Code Review & Analysis',
    tools: [
      'review-code-file',
      'review-code-files',
      'review-code-pattern',
      'review-code-project',
      'analyze-thread-safety',
      'analyze-memory-leaks',
      'check-code-style',
      'format-code'
    ],
    priority: 2,
    description: 'AI-powered code quality and security analysis',
    estimatedTokens: 5440
  },

  /** Performance profiling and testing */
  'performance': {
    name: 'Performance & Testing',
    tools: [
      'analyze-bot-performance',
      'simulate-scaling',
      'get-optimization-suggestions',
      'run-tests',
      'generate-test-report',
      'analyze-coverage',
      'run-performance-test',
      'run-load-test',
      'generate-tests-ai'
    ],
    priority: 3,
    description: 'Performance profiling, testing automation, and optimization',
    estimatedTokens: 6120
  },

  /** Database operations and management */
  'database': {
    name: 'Database Operations',
    tools: [
      'export-database',
      'import-database-from-file',
      'backup-database',
      'restore-database',
      'database-health-check-quick',
      'database-health-check-full',
      'compare-databases',
      'explore-database-schema',
      'query-database',
      'analyze-query-performance',
      'get-table-statistics'
    ],
    priority: 4,
    description: 'Database management, backup/restore, and schema exploration',
    estimatedTokens: 7480
  },

  /** World editing and collision tools */
  'world-editing': {
    name: 'World & Map Tools',
    tools: [
      'get-map-minimap',
      'get-minimap-tile',
      'get-minimap-tiles-batch',
      'list-vmap-files',
      'vmap-test-line-of-sight',
      'list-mmap-files',
      'mmap-find-path',
      'mmap-is-on-navmesh'
    ],
    priority: 5,
    description: 'Map extraction, VMap collision, MMap pathfinding',
    estimatedTokens: 5440
  },

  /** Combat analysis and strategy */
  'combat-analysis': {
    name: 'Combat Analysis',
    tools: [
      'analyze-combat-log-comprehensive',
      'analyze-bot-combat-log',
      'calculate-melee-damage',
      'calculate-armor-mitigation',
      'calculate-spell-damage',
      'get-boss-mechanics',
      'get-mythic-plus-strategy',
      'analyze-group-composition',
      'coordinate-cooldowns',
      'get-buff-recommendations'
    ],
    priority: 6,
    description: 'Combat log analysis, mechanics simulation, strategy optimization',
    estimatedTokens: 6800
  },

  /** Development and code generation */
  'development': {
    name: 'Development Tools',
    tools: [
      'generate-bot-component',
      'generate-packet-handler',
      'generate-cmake-integration',
      'get-code-completion-context',
      'migrate-trinity-api',
      'analyze-bot-ai',
      'debug-bot-behavior',
      'simulate-game-mechanics',
      'get-trinity-workflow',
      'search-playerbot-wiki',
      'get-playerbot-pattern',
      'get-implementation-guide'
    ],
    priority: 7,
    description: 'Code generation, AI development, workflow patterns',
    estimatedTokens: 8160
  },

  /** Quest routing and optimization */
  'quest-systems': {
    name: 'Quest Systems',
    tools: [
      'get-quest-prerequisites',
      'trace-quest-chain',
      'find-quest-chains-in-zone',
      'get-quest-rewards',
      'find-quest-hubs',
      'analyze-quest-objectives',
      'optimize-quest-path',
      'calculate-zone-difficulty',
      'get-profession-recipes',
      'calculate-skillup-plan'
    ],
    priority: 8,
    description: 'Quest chain analysis, routing optimization, profession planning',
    estimatedTokens: 6800
  },

  /** Gear and talent optimization */
  'optimization': {
    name: 'Gear & Talent Optimization',
    tools: [
      'calculate-item-score',
      'compare-items',
      'find-best-in-slot',
      'optimize-gear-set',
      'get-class-specializations',
      'get-recommended-talent-build',
      'compare-talent-tier',
      'optimize-talent-build',
      'get-stat-weights',
      'calculate-rotation-dps'
    ],
    priority: 9,
    description: 'Gear scoring, BiS calculations, talent optimization',
    estimatedTokens: 6800
  },

  /** Production monitoring and operations */
  'monitoring': {
    name: 'Production Monitoring',
    tools: [
      'get-health-status',
      'get-metrics-snapshot',
      'query-logs',
      'get-monitoring-status',
      'get-security-status',
      'trigger-backup',
      'verify-backup',
      'list-backups'
    ],
    priority: 10,
    description: 'Server health monitoring, logging, security, backups',
    estimatedTokens: 5440
  },

  /** Economy and auction house */
  'economy': {
    name: 'Economy & Auction House',
    tools: [
      'get-item-pricing',
      'analyze-auction-house',
      'find-arbitrage-opportunities',
      'calculate-profession-profitability',
      'get-gold-making-strategies'
    ],
    priority: 11,
    description: 'Auction house analysis, gold-making strategies',
    estimatedTokens: 3400
  },

  /** Advanced AI tools */
  'ai-advanced': {
    name: 'Advanced AI Tools',
    tools: [
      'analyze-decision-tree',
      'generate-behavior-tree',
      'analyze-combat-mechanics',
      'track-cooldowns',
      'detect-patterns-ml',
      'recommend-actions',
      'analyze-coordination'
    ],
    priority: 12,
    description: 'Machine learning, decision trees, advanced AI analysis',
    estimatedTokens: 4760
  },

  /** World data and spawns */
  'world-data': {
    name: 'World Data & Spawns',
    tools: [
      'get-points-of-interest',
      'get-gameobjects-by-entry',
      'get-creature-spawns',
      'find-nearby-creatures',
      'find-nearby-gameobjects',
      'get-creatures-by-type',
      'get-creatures-by-faction',
      'get-creature-statistics'
    ],
    priority: 13,
    description: 'World spawn locations, POIs, creature distributions',
    estimatedTokens: 5440
  },

  /** Spell calculations and simulation */
  'spell-calculations': {
    name: 'Spell Calculations',
    tools: [
      'calculate-spell-damage',
      'calculate-spell-healing',
      'compare-spells',
      'calculate-stat-weights',
      'calculate-rotation-dps',
      'get-optimal-spell'
    ],
    priority: 14,
    description: 'Spell damage/healing calculations, rotation optimization',
    estimatedTokens: 4080
  }
};

/**
 * Composite profile definitions
 * Combine multiple categories for complete workflows
 */
export const COMPOSITE_PROFILES: Record<string, string[]> = {
  /** Complete bot development: Core + Code + Performance */
  [ToolProfile.PLAYERBOT_DEV]: [
    'core-data',
    'code-review',
    'performance'
  ],

  /** Quest system development: Core + World + Database + Quest Systems */
  [ToolProfile.QUEST_DEV]: [
    'core-data',
    'world-editing',
    'database',
    'quest-systems'
  ]
};

/**
 * Get all tool names from a category
 */
export function getCategoryTools(category: string): string[] {
  const cat = TOOL_CATEGORIES[category];
  return cat ? cat.tools : [];
}

/**
 * Get all tool names from multiple categories
 */
export function getCategoriesTools(categories: string[]): string[] {
  const allTools = new Set<string>();
  categories.forEach(category => {
    getCategoryTools(category).forEach(tool => allTools.add(tool));
  });
  return Array.from(allTools);
}

/**
 * Get estimated token usage for a category
 */
export function getCategoryTokens(category: string): number {
  const cat = TOOL_CATEGORIES[category];
  return cat ? cat.estimatedTokens : 0;
}

/**
 * Get estimated token usage for multiple categories
 */
export function getCategoriesTokens(categories: string[]): number {
  return categories.reduce((total, category) => {
    return total + getCategoryTokens(category);
  }, 0);
}

/**
 * Get all available tool names across all categories
 */
export function getAllToolNames(): string[] {
  const allTools = new Set<string>();
  Object.values(TOOL_CATEGORIES).forEach(category => {
    category.tools.forEach(tool => allTools.add(tool));
  });
  return Array.from(allTools);
}

/**
 * Get total tool count across all categories
 */
export function getTotalToolCount(): number {
  return getAllToolNames().length;
}

/**
 * Get total estimated tokens for all tools
 */
export function getTotalEstimatedTokens(): number {
  return Object.values(TOOL_CATEGORIES).reduce((total, category) => {
    return total + category.estimatedTokens;
  }, 0);
}

/**
 * Find which category a tool belongs to
 */
export function findToolCategory(toolName: string): string | null {
  for (const [categoryName, category] of Object.entries(TOOL_CATEGORIES)) {
    if (category.tools.includes(toolName)) {
      return categoryName;
    }
  }
  return null;
}

/**
 * Validate that a profile exists
 */
export function isValidProfile(profile: string): boolean {
  return Object.values(ToolProfile).includes(profile as ToolProfile);
}

/**
 * Get profile description
 */
export function getProfileDescription(profile: ToolProfile): string {
  const descriptions: Record<ToolProfile, string> = {
    [ToolProfile.FULL]: 'All 111 tools - Complete access for Web UI',
    [ToolProfile.CORE_DATA]: 'Essential game data (10 tools, ~6,800 tokens)',
    [ToolProfile.CODE_REVIEW]: 'Code analysis (8 tools, ~5,440 tokens)',
    [ToolProfile.DEVELOPMENT]: 'Code generation (12 tools, ~8,160 tokens)',
    [ToolProfile.PERFORMANCE]: 'Performance testing (9 tools, ~6,120 tokens)',
    [ToolProfile.DATABASE]: 'Database operations (11 tools, ~7,480 tokens)',
    [ToolProfile.WORLD_EDITING]: 'Map/VMap/MMap tools (8 tools, ~5,440 tokens)',
    [ToolProfile.COMBAT_ANALYSIS]: 'Combat log analysis (10 tools, ~6,800 tokens)',
    [ToolProfile.PLAYERBOT_DEV]: 'Bot development (30 tools, ~20,400 tokens)',
    [ToolProfile.QUEST_DEV]: 'Quest systems (29 tools, ~19,720 tokens)',
    [ToolProfile.DYNAMIC]: 'Dynamic loading (start minimal)'
  };

  return descriptions[profile] || 'Unknown profile';
}
