# MCP Tool Profile Comparison

## Current State vs Proposed Solution

### Problem: Massive Token Consumption
```
┌─────────────────────────────────────────────────────────────┐
│ CURRENT: Single "All Tools" Configuration                  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Web UI Startup:           111 tools → ~75,500 tokens      │
│  Claude Code Startup:      111 tools → ~75,500 tokens      │
│                                                             │
│  ⚠️  Claude Code Warning: >25,000 token threshold (3x!)    │
│  ⚠️  Reduced context for actual code analysis              │
│  ⚠️  Slower startup times (5050 lines in index.ts)         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Solution: Profile-Based Lazy Loading
```
┌─────────────────────────────────────────────────────────────┐
│ PROPOSED: Profile-Based Tool Loading                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Web UI (MCP_PROFILE=full):                                │
│    └─ 111 tools → ~75,500 tokens (no change)               │
│                                                             │
│  Claude Code (MCP_PROFILE=core-data):                      │
│    └─ 10 tools → ~6,800 tokens (91% reduction ↓)           │
│                                                             │
│  Claude Code (MCP_PROFILE=playerbot-dev):                  │
│    └─ 30 tools → ~20,400 tokens (73% reduction ↓)          │
│                                                             │
│  ✅ Token usage reduced by 60-90% for focused tasks        │
│  ✅ More context available for code analysis               │
│  ✅ Faster startup times                                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Profile Breakdown

### 1. FULL Profile (Web UI)
**Purpose:** Complete tool access for data browsing and administration
**Tool Count:** 111 tools
**Token Usage:** ~75,500 tokens
**Use Case:** Web UI server, comprehensive data exploration

**Loaded Categories:**
- ✅ Core game data (spells, items, creatures, quests)
- ✅ Code review and analysis
- ✅ Performance profiling and testing
- ✅ Database operations
- ✅ World editing (maps, vmaps, mmaps)
- ✅ Combat analysis and strategy
- ✅ Development tools (code gen, completion)
- ✅ Production monitoring
- ✅ AI behavior debugging
- ✅ Quest routing and optimization
- ✅ Economy and auction house tools

---

### 2. core-data Profile (Claude Code - Minimal)
**Purpose:** Essential game data access for focused development
**Tool Count:** 10 tools
**Token Usage:** ~6,800 tokens (91% reduction)
**Use Case:** Simple data queries, basic bot development

**Loaded Tools:**
```
✅ get-spell-info          - Spell data from database + DB2
✅ get-item-info           - Item data from database + DB2
✅ get-quest-info          - Quest information
✅ get-creature-full-info  - NPC/creature data
✅ query-dbc               - Generic DBC/DB2 queries
✅ get-trinity-api         - C++ API documentation
✅ search-creatures        - Find creatures by filters
✅ get-opcode-info         - Network packet opcodes
✅ query-gametable         - Combat ratings, XP tables
✅ get-combat-rating       - Stat conversion values
```

**Example Workflow:**
```
User: "What spell do ghosts use when players die?"
Claude Code: Uses get-spell-info(8326) → Ghost spell details
```

---

### 3. code-review Profile (Claude Code - Analysis)
**Purpose:** AI-powered code quality analysis
**Tool Count:** 8 tools
**Token Usage:** ~5,440 tokens (93% reduction)
**Use Case:** Code reviews, refactoring, quality audits

**Loaded Tools:**
```
✅ review-code-file        - Single file review (1,020+ rules)
✅ review-code-files       - Multi-file review
✅ review-code-pattern     - Pattern-based review (glob)
✅ review-code-project     - Full project analysis
✅ analyze-thread-safety   - Race conditions, deadlocks
✅ analyze-memory-leaks    - Memory leak detection
✅ check-code-style        - Style conventions
✅ format-code             - Auto-format with .clang-format
```

**Example Workflow:**
```
User: "Review the bot AI code for thread safety issues"
Claude Code: Uses analyze-thread-safety() → Race condition report
```

---

### 4. development Profile (Claude Code - Code Gen)
**Purpose:** Code generation and AI-assisted development
**Tool Count:** 12 tools
**Token Usage:** ~8,160 tokens (89% reduction)
**Use Case:** Implementing new bot features, generating boilerplate

**Loaded Tools:**
```
✅ generate-bot-component    - AI strategy, state manager, events
✅ generate-packet-handler   - Network packet handlers
✅ generate-cmake-integration - CMake build files
✅ get-code-completion-context - AI code completion
✅ migrate-trinity-api       - API migration (3.3.5a → 11.2)
✅ analyze-bot-ai            - Parse decision trees
✅ debug-bot-behavior        - Live bot debugging
✅ simulate-game-mechanics   - Combat/spell simulation
✅ get-trinity-workflow      - Complete workflow patterns
✅ search-playerbot-wiki     - Pattern library search
✅ get-playerbot-pattern     - Implementation examples
✅ get-implementation-guide  - Step-by-step tutorials
```

**Example Workflow:**
```
User: "Generate a warrior tank strategy component"
Claude Code: Uses generate-bot-component(ai_strategy, "WarriorTankStrategy")
  → Full C++ header/implementation with TrinityCore APIs
```

---

### 5. performance Profile (Claude Code - Optimization)
**Purpose:** Performance profiling, testing, and optimization
**Tool Count:** 9 tools
**Token Usage:** ~6,120 tokens (92% reduction)
**Use Case:** Bot scaling analysis, performance tuning

**Loaded Tools:**
```
✅ analyze-bot-performance      - CPU, memory, network metrics
✅ simulate-scaling             - 100-5000 bot simulation
✅ get-optimization-suggestions - AI-powered optimization tips
✅ run-tests                    - Test execution with coverage
✅ generate-test-report         - HTML/JSON/JUnit reports
✅ analyze-coverage             - Code coverage analysis
✅ run-performance-test         - Function benchmarking
✅ run-load-test                - Concurrent load testing
✅ generate-tests-ai            - AI-generated test cases
```

**Example Workflow:**
```
User: "Can we run 5000 bots on this server?"
Claude Code:
  1. Uses analyze-bot-performance(realtime) → Get baseline metrics
  2. Uses simulate-scaling(100, 5000) → Scaling simulation
  3. Uses get-optimization-suggestions() → Bottleneck fixes
```

---

### 6. playerbot-dev Profile (Claude Code - Composite)
**Purpose:** Complete bot development workflow
**Tool Count:** 30 tools (core-data + code-review + performance)
**Token Usage:** ~20,400 tokens (73% reduction)
**Use Case:** Full-stack bot feature development

**Loaded Categories:**
- ✅ Core game data (10 tools)
- ✅ Code review & analysis (8 tools)
- ✅ Performance & testing (9 tools)
- ✅ Development tools (partial - 3 most used)

**Example Workflow:**
```
User: "Implement and optimize bot resurrection system"
Claude Code:
  1. Research: get-spell-info(8326), get-creature-full-info(6491)
  2. Implement: generate-bot-component() → DeathRecoveryManager
  3. Review: review-code-file() → Thread safety check
  4. Test: generate-tests-ai() → Unit tests
  5. Optimize: analyze-bot-performance() → Performance validation
```

---

### 7. quest-dev Profile (Claude Code - Quest Systems)
**Purpose:** Quest system and world content development
**Tool Count:** 25 tools (core-data + world-editing + database)
**Token Usage:** ~17,000 tokens (77% reduction)
**Use Case:** Quest routing, world spawns, zone optimization

**Loaded Categories:**
- ✅ Core game data (10 tools)
- ✅ World editing (8 tools)
- ✅ Database operations (7 tools)

---

## Profile Selection Matrix

### Choose Your Profile Based on Task:

| Task | Recommended Profile | Tools | Tokens |
|------|---------------------|-------|--------|
| **Quick spell/item lookup** | `core-data` | 10 | ~6,800 |
| **Code review/refactoring** | `code-review` | 8 | ~5,440 |
| **Bot feature implementation** | `playerbot-dev` | 30 | ~20,400 |
| **Quest system development** | `quest-dev` | 25 | ~17,000 |
| **Performance optimization** | `performance` | 9 | ~6,120 |
| **Map/height extraction** | `world-editing` | 8 | ~5,440 |
| **Combat log analysis** | `combat-analysis` | 10 | ~6,800 |
| **Web UI administration** | `full` | 111 | ~75,500 |

---

## Configuration Examples

### For Web UI (package.json)
```json
{
  "scripts": {
    "start:mcp:webui": "cross-env MCP_MODE=webui MCP_PROFILE=full node dist/index.js",
    "start:all": "concurrently \"npm run start:mcp:webui\" \"npm run start:web\""
  }
}
```

### For Claude Code - Minimal (.mcp.json)
```json
{
  "mcpServers": {
    "trinitycore": {
      "command": "node",
      "args": ["C:\\TrinityBots\\trinitycore-mcp\\dist\\index.js"],
      "env": {
        "MCP_MODE": "claude-code",
        "MCP_PROFILE": "core-data"
      }
    }
  }
}
```

### For Claude Code - Bot Development (.mcp.json)
```json
{
  "mcpServers": {
    "trinitycore": {
      "command": "node",
      "args": ["C:\\TrinityBots\\trinitycore-mcp\\dist\\index.js"],
      "env": {
        "MCP_MODE": "claude-code",
        "MCP_PROFILE": "playerbot-dev"
      }
    }
  }
}
```

### For Claude Code - Custom Profile (.mcp.json)
```json
{
  "mcpServers": {
    "trinitycore": {
      "command": "node",
      "args": ["C:\\TrinityBots\\trinitycore-mcp\\dist\\index.js"],
      "env": {
        "MCP_MODE": "claude-code",
        "MCP_PROFILE": "core-data",
        "MCP_CUSTOM_TOOLS": "analyze-bot-ai,debug-bot-behavior",
        "MCP_EXCLUDE_TOOLS": "get-all-vendors,get-all-trainers"
      }
    }
  }
}
```

---

## Token Usage Visualization

```
Token Usage by Profile:

FULL (Web UI)          ████████████████████████████████████████  75,500 tokens
playerbot-dev          ███████████                               20,400 tokens
quest-dev              █████████                                 17,000 tokens
development            ████                                       8,160 tokens
combat-analysis        ███                                        6,800 tokens
core-data              ███                                        6,800 tokens
performance            ███                                        6,120 tokens
world-editing          ██                                         5,440 tokens
code-review            ██                                         5,440 tokens

                       0      10,000   20,000   30,000   40,000   50,000   60,000   70,000   80,000
                              ────────────────────────────────────────────────────────────────────
                                            Token Consumption
```

---

## Migration Strategy

### Phase 1: Deploy Infrastructure (No Behavior Change)
```
Week 1:
  ✅ Create ProfileLoader system
  ✅ Add environment variable support
  ✅ Update documentation
  ⚠️  All tools still load (backward compatible)
```

### Phase 2: Enable Conditional Loading
```
Week 2:
  ✅ Refactor tool registration to use profiles
  ✅ Deploy with default FULL profile
  ✅ Test Web UI thoroughly
  ✅ Provide .mcp.json templates for Claude Code users
```

### Phase 3: User Adoption
```
Week 3+:
  📢 Announce profile system
  📚 Publish migration guide
  📊 Collect usage analytics
  🔧 Optimize profiles based on real usage
```

---

## Expected Impact

### Token Reduction by Use Case:

| Use Case | Before | After | Reduction |
|----------|--------|-------|-----------|
| **Simple lookup** | 75,500 | 6,800 | **91%** ↓ |
| **Code review** | 75,500 | 5,440 | **93%** ↓ |
| **Bot development** | 75,500 | 20,400 | **73%** ↓ |
| **Quest development** | 75,500 | 17,000 | **77%** ↓ |
| **Web UI** | 75,500 | 75,500 | **0%** (unchanged) |

### Startup Performance:

| Profile | Current | After | Improvement |
|---------|---------|-------|-------------|
| **FULL** | ~2-3s | ~2-3s | 0% (unchanged) |
| **core-data** | ~2-3s | ~0.5-1s | **50-66%** faster |
| **playerbot-dev** | ~2-3s | ~1-1.5s | **33-50%** faster |

---

**Generated by Claude Code**

Co-Authored-By: Claude <noreply@anthropic.com>
