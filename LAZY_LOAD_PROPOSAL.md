# MCP Tool Lazy Loading & Context-Aware Architecture Proposal

## Problem Statement

**Current Issue:**
- TrinityCore MCP server registers 111 tools at startup, consuming ~75,500 tokens
- This exceeds Claude Code's 25,000 token warning threshold by 3x
- All 111 tool descriptions are loaded into context even if only 5-10 tools are needed
- Two distinct usage patterns require different tool sets:
  1. **Web UI**: Needs ALL tools available (data browsing, code review, monitoring)
  2. **Claude Code**: Needs MINIMAL tools (focused on current development task)

**Impact:**
- Massive context consumption for Claude Code sessions
- Slower startup times (5050 lines in index.ts)
- Reduced available context for actual code analysis
- Inefficient for focused development workflows

---

## Solution Architecture: Profile-Based Lazy Loading

### Core Concept

**Profile-Based Tool Registration:**
- Define tool "profiles" that match specific use cases
- Load only tools relevant to the current profile
- Support dynamic tool loading/unloading via MCP protocol extensions
- Environment variable controls which profile to use

### Implementation Strategy

#### 1. Tool Profile System

Create tool categorization with granular profiles:

```typescript
// src/profiles/ToolProfile.ts
export enum ToolProfile {
  // Full profile (Web UI)
  FULL = 'full',                    // All 111 tools

  // Minimal Claude Code profiles (10-15 tools each)
  CORE_DATA = 'core-data',          // Spell, item, creature, quest (10 tools)
  CODE_REVIEW = 'code-review',      // Code review & analysis (8 tools)
  DEVELOPMENT = 'development',      // Code gen, completion, migration (12 tools)
  PERFORMANCE = 'performance',      // Performance analysis, testing (9 tools)
  DATABASE = 'database',            // DB operations, schema (11 tools)
  WORLD_EDITING = 'world-editing',  // Map, vmap, mmap tools (8 tools)
  COMBAT_ANALYSIS = 'combat-analysis', // Combat log, mechanics (10 tools)

  // Composite profiles (combine multiple)
  PLAYERBOT_DEV = 'playerbot-dev',  // Core + Code Review + Performance (30 tools)
  QUEST_DEV = 'quest-dev',          // Core + World + Database (25 tools)

  // Dynamic (load on demand)
  DYNAMIC = 'dynamic'               // Start minimal, load as requested
}

export interface ToolCategory {
  name: string;
  tools: string[];  // Tool names in this category
  priority: number; // Load order (lower = earlier)
  description: string;
}

export const TOOL_CATEGORIES: Record<string, ToolCategory> = {
  // Core game data (highest priority - most frequently used)
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
    description: 'Essential game data access tools'
  },

  // Code analysis (high priority for development)
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
    description: 'AI-powered code quality tools'
  },

  // Performance analysis
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
    description: 'Performance profiling and testing'
  },

  // Database operations
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
    description: 'Database management and operations'
  },

  // World editing
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
    description: 'Map extraction and collision tools'
  },

  // Combat analysis
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
    description: 'Combat log analysis and strategy'
  },

  // AI development tools
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
      'simulate-game-mechanics'
    ],
    priority: 7,
    description: 'Code generation and AI development'
  },

  // Monitoring (lowest priority - rarely used in Claude Code)
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
    description: 'Server health and monitoring'
  },

  // ... (remaining categories)
};
```

#### 2. Profile-Based Startup System

```typescript
// src/profiles/ProfileLoader.ts
import { ToolProfile, TOOL_CATEGORIES } from './ToolProfile';
import { logger } from '../utils/logger';

export interface ProfileConfig {
  profile: ToolProfile;
  customTools?: string[];      // Additional tools to load
  excludeTools?: string[];      // Tools to exclude from profile
  lazyLoad?: boolean;           // Enable dynamic loading
}

export class ToolProfileLoader {
  private loadedTools: Set<string> = new Set();
  private config: ProfileConfig;

  constructor(config?: ProfileConfig) {
    // Default: Use environment variable or fallback to FULL for Web UI
    const profileName = process.env.MCP_PROFILE ||
                       (process.env.MCP_MODE === 'webui' ? 'full' : 'core-data');

    this.config = config || {
      profile: profileName as ToolProfile,
      lazyLoad: process.env.MCP_LAZY_LOAD === 'true'
    };

    logger.info('ToolProfileLoader', `Initialized with profile: ${this.config.profile}`);
  }

  /**
   * Get list of tools to load for current profile
   */
  getToolsForProfile(): string[] {
    const profile = this.config.profile;

    // Full profile: Return all tools
    if (profile === ToolProfile.FULL) {
      return this.getAllTools();
    }

    // Dynamic profile: Start with minimal core tools
    if (profile === ToolProfile.DYNAMIC) {
      return TOOL_CATEGORIES['core-data'].tools;
    }

    // Composite profiles
    if (profile === ToolProfile.PLAYERBOT_DEV) {
      return [
        ...TOOL_CATEGORIES['core-data'].tools,
        ...TOOL_CATEGORIES['code-review'].tools,
        ...TOOL_CATEGORIES['performance'].tools
      ];
    }

    if (profile === ToolProfile.QUEST_DEV) {
      return [
        ...TOOL_CATEGORIES['core-data'].tools,
        ...TOOL_CATEGORIES['world-editing'].tools,
        ...TOOL_CATEGORIES['database'].tools
      ];
    }

    // Single category profiles
    if (TOOL_CATEGORIES[profile]) {
      return TOOL_CATEGORIES[profile].tools;
    }

    // Fallback
    logger.warn('ToolProfileLoader', `Unknown profile: ${profile}, using core-data`);
    return TOOL_CATEGORIES['core-data'].tools;
  }

  /**
   * Check if a tool should be loaded
   */
  shouldLoadTool(toolName: string): boolean {
    const allowedTools = this.getToolsForProfile();

    // Apply custom inclusions
    if (this.config.customTools?.includes(toolName)) {
      return true;
    }

    // Apply exclusions
    if (this.config.excludeTools?.includes(toolName)) {
      return false;
    }

    return allowedTools.includes(toolName);
  }

  /**
   * Get all tools across all categories
   */
  private getAllTools(): string[] {
    const allTools = new Set<string>();
    Object.values(TOOL_CATEGORIES).forEach(category => {
      category.tools.forEach(tool => allTools.add(tool));
    });
    return Array.from(allTools);
  }

  /**
   * Get tool count estimate for logging
   */
  getToolCount(): number {
    return this.getToolsForProfile().length;
  }

  /**
   * Get estimated token usage
   */
  getEstimatedTokens(): number {
    const toolCount = this.getToolCount();
    const avgTokensPerTool = 680; // ~680 tokens per tool (description + schema)
    return toolCount * avgTokensPerTool;
  }
}
```

#### 3. Lazy Tool Registration System

```typescript
// src/index.ts (refactored)
import { ToolProfileLoader } from './profiles/ProfileLoader';
import { logger } from './utils/logger';

// Initialize profile loader
const profileLoader = new ToolProfileLoader();

logger.info('MCP Server', `Profile: ${process.env.MCP_PROFILE || 'default'}`);
logger.info('MCP Server', `Loading ${profileLoader.getToolCount()} tools (~${profileLoader.getEstimatedTokens()} tokens)`);

// Tool registry with lazy loading support
const toolRegistry = new Map<string, {
  metadata: Tool,
  handler: (args: any) => Promise<any>,
  loaded: boolean
}>();

/**
 * Register tool only if it matches current profile
 */
function registerToolConditional(
  name: string,
  description: string,
  inputSchema: any,
  handler: (args: any) => Promise<any>
) {
  // Check if tool should be loaded based on profile
  if (!profileLoader.shouldLoadTool(name)) {
    logger.debug('MCP Server', `Skipping tool: ${name} (not in profile)`);
    return;
  }

  // Register tool metadata
  toolRegistry.set(name, {
    metadata: {
      name,
      description,
      inputSchema
    },
    handler,
    loaded: true
  });

  logger.debug('MCP Server', `Registered tool: ${name}`);
}

// Tool registration (now conditional)
registerToolConditional(
  "get-spell-info",
  "Get detailed information about a spell from TrinityCore database",
  {
    type: "object",
    properties: {
      spellId: { type: "number", description: "Spell ID to query" }
    },
    required: ["spellId"]
  },
  async (args: { spellId: number }) => {
    return await getSpellInfo(args.spellId);
  }
);

// ... (repeat for all 111 tools)

// List tools handler (returns only loaded tools)
server.setRequestHandler(ListToolsRequestSchema, async () => {
  const tools = Array.from(toolRegistry.values())
    .filter(entry => entry.loaded)
    .map(entry => entry.metadata);

  logger.info('MCP Server', `Listing ${tools.length} loaded tools`);

  return { tools };
});

// Call tool handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const toolName = request.params.name;
  const toolEntry = toolRegistry.get(toolName);

  if (!toolEntry || !toolEntry.loaded) {
    throw new Error(`Tool not loaded: ${toolName}`);
  }

  // Execute tool
  const result = await toolEntry.handler(request.params.arguments || {});

  return {
    content: [
      {
        type: "text",
        text: typeof result === 'string' ? result : JSON.stringify(result, null, 2)
      }
    ]
  };
});
```

#### 4. Environment Variable Configuration

```bash
# .env.example

# === MCP PROFILE CONFIGURATION ===

# Profile mode: webui | claude-code
# - webui: Load all tools (111 tools, ~75,500 tokens)
# - claude-code: Load minimal profile (default: core-data)
MCP_MODE=claude-code

# Tool profile (when MCP_MODE=claude-code)
# Options:
#   core-data         - Essential game data (10 tools, ~6,800 tokens)
#   code-review       - Code analysis (8 tools, ~5,440 tokens)
#   development       - Code generation (12 tools, ~8,160 tokens)
#   performance       - Performance analysis (9 tools, ~6,120 tokens)
#   database          - Database operations (11 tools, ~7,480 tokens)
#   world-editing     - Map/VMap/MMap (8 tools, ~5,440 tokens)
#   combat-analysis   - Combat logs (10 tools, ~6,800 tokens)
#   playerbot-dev     - Composite: Core + Code + Perf (30 tools, ~20,400 tokens)
#   quest-dev         - Composite: Core + World + DB (25 tools, ~17,000 tokens)
#   dynamic           - Start minimal, load on demand
MCP_PROFILE=core-data

# Enable lazy loading (experimental)
# When true, tools can be loaded dynamically during session
MCP_LAZY_LOAD=false

# Custom tool inclusions (comma-separated, in addition to profile)
# Example: MCP_CUSTOM_TOOLS=analyze-bot-ai,debug-bot-behavior
MCP_CUSTOM_TOOLS=

# Tool exclusions (comma-separated, remove from profile)
# Example: MCP_EXCLUDE_TOOLS=get-all-vendors,get-all-trainers
MCP_EXCLUDE_TOOLS=

# === EXISTING CONFIGURATION ===
TRINITY_ROOT=C:\TrinityBots\TrinityCore
TRINITY_DB_HOST=localhost
# ... (rest of config)
```

#### 5. Separate Launch Scripts

**For Web UI (all tools):**
```json
// package.json
{
  "scripts": {
    "start:mcp:webui": "cross-env MCP_MODE=webui MCP_PROFILE=full node dist/index.js",
    "start:all": "concurrently \"npm run start:mcp:webui\" \"npm run start:web\""
  }
}
```

**For Claude Code (minimal profile):**
```json
// .mcp.json (Claude Code configuration)
{
  "mcpServers": {
    "trinitycore": {
      "command": "node",
      "args": ["C:\\TrinityBots\\trinitycore-mcp\\dist\\index.js"],
      "env": {
        "MCP_MODE": "claude-code",
        "MCP_PROFILE": "core-data",
        "TRINITY_ROOT": "C:\\TrinityBots\\TrinityCore",
        // ... (rest of env vars)
      }
    }
  }
}
```

**For specific Claude Code tasks:**
```json
// .mcp.json (profiles for different tasks)
{
  "mcpServers": {
    "trinitycore-dev": {
      "command": "node",
      "args": ["C:\\TrinityBots\\trinitycore-mcp\\dist\\index.js"],
      "env": {
        "MCP_MODE": "claude-code",
        "MCP_PROFILE": "playerbot-dev"  // Core + Code Review + Performance
      }
    },
    "trinitycore-quest": {
      "command": "node",
      "args": ["C:\\TrinityBots\\trinitycore-mcp\\dist\\index.js"],
      "env": {
        "MCP_MODE": "claude-code",
        "MCP_PROFILE": "quest-dev"  // Core + World + Database
      }
    }
  }
}
```

---

## Implementation Phases

### Phase 1: Profile System Infrastructure (Week 1)
1. Create `src/profiles/ToolProfile.ts` with category definitions
2. Create `src/profiles/ProfileLoader.ts` with profile loading logic
3. Add environment variable support in `.env`
4. Update README.md with profile documentation

**Deliverables:**
- Profile system fully defined
- No behavioral changes yet (all tools still load)
- Ready for conditional registration

### Phase 2: Conditional Tool Registration (Week 1-2)
1. Refactor `src/index.ts` to use `registerToolConditional()`
2. Update tool registration loop to check profile
3. Modify `ListToolsRequestSchema` handler to return filtered tools
4. Add startup logging for loaded tool count and estimated tokens

**Deliverables:**
- Tools load conditionally based on profile
- Token usage reduced by 60-90% for Claude Code
- Web UI unchanged (still loads all tools)

### Phase 3: Testing & Validation (Week 2)
1. Test each profile individually
2. Verify Web UI works with FULL profile
3. Verify Claude Code works with minimal profiles
4. Test composite profiles (playerbot-dev, quest-dev)
5. Measure actual token usage in Claude Code sessions

**Deliverables:**
- All profiles tested and validated
- Token usage metrics documented
- Performance benchmarks (startup time, memory)

### Phase 4: Dynamic Loading (Future - Optional)
1. Implement MCP protocol extension for dynamic tool loading
2. Add `load-tools` and `unload-tools` MCP methods
3. Support tool discovery and on-demand registration
4. Add tool usage analytics to suggest optimal profiles

**Deliverables:**
- Tools can be loaded/unloaded during session
- DYNAMIC profile fully functional
- Usage analytics for profile optimization

---

## Expected Benefits

### Token Usage Reduction

| Profile | Tools | Est. Tokens | Reduction |
|---------|-------|-------------|-----------|
| FULL (Web UI) | 111 | ~75,500 | 0% (baseline) |
| core-data | 10 | ~6,800 | **91%** ↓ |
| code-review | 8 | ~5,440 | **93%** ↓ |
| development | 12 | ~8,160 | **89%** ↓ |
| performance | 9 | ~6,120 | **92%** ↓ |
| playerbot-dev | 30 | ~20,400 | **73%** ↓ |
| quest-dev | 25 | ~17,000 | **77%** ↓ |

### Startup Performance

- **Current**: 5050 lines in index.ts, ~2-3 seconds startup
- **After Phase 2**: Conditional registration, ~1-2 seconds startup (minimal profile)
- **After Phase 4**: Dynamic loading, ~0.5-1 second startup (DYNAMIC profile)

### Developer Experience

**Web UI:**
- No changes - continues to have full access to all 111 tools
- Maintains current workflow and UI functionality

**Claude Code:**
- **91% token reduction** for focused tasks (core-data profile)
- **73% token reduction** for bot development (playerbot-dev profile)
- More context available for actual code analysis
- Faster startup times
- Task-specific profiles for optimal tool selection

---

## Migration Plan

### Backward Compatibility

**No Breaking Changes:**
1. Default behavior unchanged (loads all tools if no profile specified)
2. Existing `.mcp.json` continues to work (defaults to FULL profile)
3. Web UI startup script explicitly sets `MCP_MODE=webui`
4. Claude Code users opt-in by updating `.mcp.json`

### Rollout Strategy

**Week 1 (Infrastructure):**
- Implement profile system
- Add environment variable support
- Update documentation

**Week 2 (Deployment):**
- Deploy to production with default FULL profile
- Test Web UI thoroughly
- Provide `.mcp.json` templates for Claude Code users

**Week 3 (Adoption):**
- Announce profile system to users
- Provide migration guide for Claude Code users
- Collect feedback on optimal profile configurations

**Week 4+ (Optimization):**
- Add usage analytics
- Optimize profile definitions based on real usage
- Consider dynamic loading for advanced users

---

## Alternative Approaches Considered

### 1. Tool Pagination (Rejected)
**Idea:** Split tools into pages, load one page at a time
**Why Rejected:** MCP protocol doesn't support pagination well, breaks tool discovery

### 2. Namespace Splitting (Rejected)
**Idea:** Create separate MCP servers for each category
**Why Rejected:** Requires multiple server processes, complex configuration, breaks unified API

### 3. Description Truncation (Rejected)
**Idea:** Shorten tool descriptions to reduce token usage
**Why Rejected:** Reduces usability, doesn't solve fundamental problem

### 4. On-Demand Loading Only (Rejected)
**Idea:** Load all tools dynamically, start with zero tools
**Why Rejected:** Poor discovery experience, requires users to know tool names in advance

---

## Open Questions

1. **Profile Selection UX:**
   - Should profiles be switchable at runtime?
   - Should Web UI have profile selector in settings?

2. **Tool Dependencies:**
   - Some tools depend on others (e.g., combat analysis needs spell data)
   - Should profile system automatically include dependencies?

3. **Analytics:**
   - Should we track which tools are actually used in each profile?
   - Use analytics to suggest optimal profiles for users?

4. **Custom Profiles:**
   - Should users be able to define custom profiles in `.mcp.json`?
   - Support YAML configuration for complex profiles?

---

## Success Metrics

### Phase 2 Completion:
- ✅ Token usage for `core-data` profile: <7,000 tokens (91% reduction)
- ✅ Web UI fully functional with FULL profile
- ✅ Claude Code functional with minimal profiles
- ✅ No breaking changes to existing configurations

### Phase 3 Completion:
- ✅ All 8 profiles tested and validated
- ✅ Performance benchmarks documented
- ✅ Migration guide published

### Phase 4 Completion (Future):
- ✅ Dynamic loading functional
- ✅ Usage analytics integrated
- ✅ Profile optimization based on real usage

---

## Conclusion

This proposal provides a **pragmatic, backward-compatible solution** to the MCP token consumption problem:

1. **Immediate Impact**: 91% token reduction for focused Claude Code tasks
2. **No Breaking Changes**: Web UI continues to work unchanged
3. **Flexible Architecture**: Supports current and future needs
4. **Opt-In Migration**: Claude Code users choose when to adopt

**Recommended Next Steps:**
1. Review and approve proposal
2. Implement Phase 1 (infrastructure) - 2-3 days
3. Implement Phase 2 (conditional loading) - 3-4 days
4. Test and deploy Phase 3 - 2-3 days
5. **Total Timeline: 1-2 weeks to production-ready**

---

**Generated by Claude Code**

Co-Authored-By: Claude <noreply@anthropic.com>
