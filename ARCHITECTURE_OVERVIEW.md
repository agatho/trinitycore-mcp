# TrinityCore MCP - Architecture Overview

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                      Claude / External Clients                       │
│                   (Consuming MCP Tools via stdio)                    │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│              MCP Server (src/index.ts - 3,627 lines)                │
│  Registers 79 Tools across 49 files + Tool Handler Dispatch        │
│                                                                      │
│  Tool Categories:                                                   │
│  ├─ Game Data Tools (15)       ├─ Economy Tools (6)                │
│  ├─ Optimization Tools (12)    ├─ Collection Tools (4)            │
│  ├─ Group/PvP Tools (8)        ├─ Development Tools (12)          │
│  ├─ Quest/Routing (5)          ├─ Knowledge Tools (6)             │
│  └─ Advanced Tools (8)         └─ Incomplete Tools (4)            │
└──────┬──────────┬──────────┬──────────────────────────────────────┘
       │          │          │
       ▼          ▼          ▼
    ┌─────┐  ┌─────────┐  ┌──────────────────┐
    │Tools│  │Parser & │  │Code Review &     │
    │Impl │  │DB2/DBC  │  │Analysis System   │
    │     │  │         │  │                  │
    │ src/│  │src/     │  │src/code-review/  │
    │tools│  │parsers/ │  │ (5,030 lines)   │
    │ 24K │  │ 6,832L  │  └──────────────────┘
    │lines│  │ lines   │   • TrinityRuleEngine
    └─────┘  └─────────┘   • CodeAnalysisEngine
       │          │         • AIReviewEngine
       │          │         • ReportGenerator
       │          └──────────────────────────────┐
       │                                         │
       ▼                                         ▼
┌─────────────────────────────┐  ┌──────────────────────────────────┐
│   Database Layer            │  │  Infrastructure Systems          │
│ (src/database/)             │  │  (src/monitoring, security, etc.)│
│                             │  │                                  │
│ • MySQL Connection Pooling  │  │  • Health Checks & Logging       │
│   - world database          │  │  • Metrics & Request Tracing     │
│   - auth database           │  │  • Rate Limiting & Load Balance  │
│   - characters database     │  │  • Backup & Recovery             │
│                             │  │  • Performance Analysis          │
│ • LRU Query Caching         │  │  • Testing & Coverage            │
│   (1000 queries, 10min TTL) │  │                                  │
│                             │  │  • Knowledge Base                │
│ • Retry Logic & Timeouts    │  │  • Code Generation               │
│ • Per-DB Statistics         │  │                                  │
└─────────────────────────────┘  └──────────────────────────────────┘
       │                                  │
       ▼                                  ▼
┌─────────────────────────────┐  ┌──────────────────────────────────┐
│  External Data Sources      │  │  External Services              │
│                             │  │                                  │
│ • TrinityCore MySQL DBs     │  │  • SOAP API (TrinityCore)        │
│   └─ Creatures, Items,      │  │  • LLM Services (OpenAI, Ollama) │
│      Quests, Spawns         │  │  • GameTable Files               │
│                             │  │  • DBC/DB2 Files                 │
│ • Client Data Files         │  │    (Spell.db2, Item.db2, etc.)   │
│                             │  │                                  │
└─────────────────────────────┘  └──────────────────────────────────┘


                     NEXT.JS WEB UI LAYER
    (Separate from MCP - can run standalone)
    ┌──────────────────────────────────────────────────┐
    │  web-ui/app/  (30+ Pages, Next.js 16)           │
    │                                                   │
    │  ├─ Game Data Pages (spells, items, creatures)  │
    │  ├─ Development Tools (code review, diff)       │
    │  ├─ Visual Editors (SAI, map, query builder)    │
    │  ├─ Monitoring (dashboard, profiler)            │
    │  └─ API Routes (/api/mcp/call for tool invocation)
    │                                                   │
    │  ├─ Components: 88+ React components            │
    │  └─ Libraries: 8,392 lines (SOAP, SAI, etc.)   │
    └──────────────┬───────────────────────────────────┘
                   │ HTTP/WebSocket
                   ▼
    ┌──────────────────────────────────────────────────┐
    │   MCP Server (stdio-based connection)            │
    │   (Tools accessible from web UI via API routes)  │
    └──────────────────────────────────────────────────┘
```

## Data Flow Examples

### Example 1: Spell Query Flow
```
Claude/Client Request: "Get spell info for spell 1234"
    ↓
MCP Server (index.ts)
    ↓
dispatch to get-spell-info tool
    ↓
src/tools/spell.ts
    ├─→ Check DB2 Cache (CacheWarmer)
    │   └─→ <1ms cache hit ✓ Return Spell.db2 data
    ├─→ Check LRU Query Cache
    ├─→ Query World Database (connection.ts)
    │   └─→ 50-500ms DB query ✓
    └─→ Merge DB + DB2 data
    ↓
Return SpellInfo with dataSource: "merged"
```

### Example 2: Code Review Flow
```
Claude Request: "Review my PlayerBot code"
    ↓
MCP Tool: review-files
    ↓
Code Review Orchestrator (src/code-review/index.ts)
    ├─→ Read file content
    ├─→ CodeAnalysisEngine
    │   └─→ Optionally call Serena MCP for AST
    ├─→ TrinityRuleEngine (1,020 rules)
    │   └─→ Detect violations
    ├─→ AIReviewEngine (if enabled)
    │   └─→ Send to LLM (OpenAI/Ollama/LM Studio)
    │   └─→ Get enhanced recommendations
    └─→ ReviewReportGenerator
        └─→ HTML/Markdown/JSON report
    ↓
Return CodeReviewResult with violations + fixes
```

### Example 3: Web UI API Route Flow
```
Browser: Click "Get Spell Info" on /spells page
    ↓
React component calls: /api/mcp/call
    ├─→ POST /api/mcp/call with tool="get-spell-info"
    ├─→ Next.js API route (web-ui/app/api/mcp/call/route.ts)
    ├─→ Invokes local MCP server via stdio
    ├─→ Returns result as JSON
    └─→ React component displays data
    ↓
User sees spell details with caching stats
```

## Database Schema Relationships

```
World Database (TrinityCore)
├─ creature
│  └─ entry → creature_template
│     └─ type_flags, classification, level, etc.
├─ creature_addon
│  └─ Entry → movement data, emotes
├─ gameobject
│  └─ id → gameobject_template
├─ spell_bonus_data
├─ spell_script_names
└─ quest_template
   └─ QuestID → rewards, objectives

Characters Database
├─ characters
│  └─ guid → account → account name
├─ character_inventory
├─ character_queststatus
└─ pet_spell

Auth Database
├─ account
│  └─ username → account_access (admin level)
├─ account_banned
└─ realmcharacters
```

## Tool Registration Pattern

Every tool in src/tools/ follows this pattern:

```typescript
// 1. Type Definitions
export interface ToolResult {
  data?: any;
  error?: string;
  metadata?: { version?: string; cached?: boolean };
}

// 2. Main Export Function
export async function toolName(params: ToolParams): Promise<ToolResult> {
  // Implementation
}

// 3. Registration in index.ts
{
  name: "tool-name",
  description: "Human-readable description",
  inputSchema: {
    type: "object",
    properties: { /* Parameter schema */ },
    required: [ /* Required params */ ]
  }
}

// 4. Handler in CallTool dispatch
case "tool-name": {
  const result = await toolName(args);
  return { content: [{ type: "text", text: JSON.stringify(result) }] };
}
```

## Caching Strategy

```
Request for Data
    ↓
    ├─→ Is it in Memory (DB2 CacheWarmer)?
    │   └─→ Yes: Return <1ms ✓
    │
    ├─→ Is it in LRU Query Cache?
    │   └─→ Yes: Return <5ms ✓
    │
    └─→ Query Database
        ├─→ Retry logic (3 attempts)
        ├─→ Timeout protection (5s)
        ├─→ Exponential backoff (1s delays)
        └─→ Store in LRU Cache
            └─→ Return with stats
```

## Module Dependencies

```
index.ts (Main Server)
    ├─→ tools/ (All tools)
    │   ├─→ database/connection (All query tools)
    │   ├─→ parsers/db2 (Spell, item tools)
    │   ├─→ code-review (Code review tools)
    │   ├─→ knowledge/ (Search, generation)
    │   └─→ monitoring/ (Health, metrics)
    │
    ├─→ database/connection
    │   └─→ mysql2/promise
    │   └─→ lru-cache
    │
    ├─→ parsers/db2
    │   ├─→ DB2Header, DB2Record
    │   ├─→ SchemaFactory
    │   └─→ CacheWarmer
    │
    ├─→ code-review/index
    │   ├─→ TrinityRuleEngine
    │   ├─→ CodeAnalysisEngine
    │   ├─→ AIReviewEngine
    │   └─→ ReviewReportGenerator
    │
    └─→ @modelcontextprotocol/sdk
        ├─→ Server
        └─→ StdioServerTransport
```

## Web UI Module Dependencies

```
web-ui/app/
    ├─→ app/api/mcp/call/route.ts
    │   └─→ Calls MCP server via stdio
    │
    ├─→ lib/mcp-client.ts
    │   └─→ Utilities for tool invocation
    │
    ├─→ lib/soap-client.ts
    │   └─→ TrinityCore SOAP integration
    │
    ├─→ lib/sai-editor-complete.ts
    │   └─→ Smart AI script editor (canonical version)
    │
    ├─→ lib/workflow-manager.ts
    │   └─→ Workflow orchestration (incomplete)
    │
    └─→ components/
        ├─→ UI Base Components (Button, Card, etc.)
        ├─→ Custom Components (GlobalSearch, Export)
        └─→ Page-Specific Components (SpellCard, CreatureFilters)
```

## Configuration Hierarchy

```
Environment Variables (.env)
    ↓
Default Values in Code
    ├─ Database: localhost:3306
    ├─ SOAP: 127.0.0.1:7878
    ├─ MCP Port: 3000
    └─ DBC/DB2 paths: system defaults
    ↓
Runtime Configuration Objects
    ├─ DB_CONFIG (host, port, credentials)
    ├─ SOAPConfig (SOAP connection details)
    └─ Tool-specific configs (timeout, cache size, etc.)
```

## Testing Architecture

```
tests/
├─ code-review/
│  ├─ TrinityRuleEngine.test.ts
│  ├─ accuracy-validation.test.ts
│  └─ integration/mcp-tools.test.ts
│
├─ parsers/
│  ├─ db2/
│  │  ├─ DB2FileLoader.test.ts
│  │  ├─ DB2Header.test.ts
│  │  ├─ DB2CachedFileLoader.test.ts
│  │  └─ DB2FileLoaderSparse.test.ts
│  │
│  ├─ schemas/
│  │  ├─ SchemaFactory.test.ts
│  │  ├─ SpellSchema.test.ts
│  │  └─ ItemSchema.test.ts
│  │
│  └─ cache/
│     ├─ CacheWarmer.test.ts
│     └─ RecordCache.test.ts
│
└─ integration/
   └─ DB2Integration.test.ts

Jest Configuration (jest.config.js)
    ├─ Test files: **/*.test.ts
    ├─ Coverage reports: JSON, HTML
    └─ TypeScript support: ts-jest
```

## Deployment Architecture

```
┌─────────────────────────┐
│    Docker Container     │
├─────────────────────────┤
│ Node.js 18+             │
├─────────────────────────┤
│ npm install             │
│ npm run build           │
│ npm start (MCP Server)  │
├─────────────────────────┤
│ Logs → stdout           │
│ Metrics → Prometheus    │
│ Health → /health        │
└─────────────────────────┘
         ↑↓
    ┌─────────────┐
    │  TrinityCore│
    │   MySQL     │
    │  Databases  │
    └─────────────┘
```

## Performance Bottlenecks & Solutions

```
Operation                  Current        Solution
────────────────────────────────────────────────────
Database Query (miss)      50-500ms       ✓ LRU Cache (5ms hits)
DB2 File Load (first)      100-500ms      ✓ CacheWarmer (<1ms)
SOAP API Call              500-2000ms     ✓ Connection pooling
Code Review (AI)           5000+ ms       ✓ Batch processing, streaming
Large Dataset Return       >1000ms        → Pagination, streaming
Concurrent Tool Calls      Serial         → Parallel execution
```

## Security Boundaries

```
┌─────────────────────────────────────────────────┐
│         Untrusted Input (MCP Requests)          │
└──────────────────┬────────────────────────────────┘
                   ↓
        ┌──────────────────────┐
        │  Input Validation    │
        │  Parameter Schemas   │
        │  Type Checking       │
        └──────────────────────┘
                   ↓
┌─────────────────────────────────────────────────┐
│        Internal Tool Processing                  │
│  • Parameterized queries (SQL injection)         │
│  • Rate limiting per client                      │
│  • Request tracing/audit logging                 │
│  • Timeout protection (5s max)                   │
└──────────────────────────────────────────────────┘
                   ↓
    ┌────────────────────────────────┐
    │  Database Access Layer         │
    │  • Read-only or controlled     │
    │  • No direct write access      │
    │  • Connection pooling          │
    └────────────────────────────────┘
                   ↓
        ┌──────────────────────┐
        │   Response Sanitize  │
        │   Error Masking      │
        │   Output Validation  │
        └──────────────────────┘
```

---

This architecture enables a scalable, maintainable system with clear separation of concerns and multiple integration points for future enhancements.
