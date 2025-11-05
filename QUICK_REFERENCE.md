# TrinityCore MCP - Quick Reference Guide

## Key Statistics at a Glance

- **79 MCP Tools** across 49 files
- **~60,000 lines** of backend code
- **30+ Web UI pages** with 88+ React components
- **1,020 code review rules** across 7 categories
- **3 SAI editor versions** (consolidation needed)
- **26 TODO comments** in code
- **14+ incomplete features**

## Where to Find Things

### Backend Tools
```
src/tools/*.ts          - 49 MCP tool implementations
src/index.ts            - Main server (3,627 lines, 79 tools registered)
src/database/           - MySQL connection + caching
src/parsers/            - DB2/DBC parsing infrastructure
src/code-review/        - AI-powered code analysis system
```

### Web UI
```
web-ui/app/             - 30+ Next.js pages
web-ui/lib/             - 14 library utilities + client integrations
web-ui/components/      - 88+ React components
web-ui/app/api/         - Next.js API routes calling MCP tools
```

### Testing & Docs
```
tests/                  - 18 test suites (Jest)
doc/                    - Generated documentation
*.md files              - 70+ documentation files
```

## Tool Categories (Quick Lookup)

| Category | Tools | Example |
|----------|-------|---------|
| Game Data | 15 | get-spell-info, get-item-info, get-quest-info |
| Optimization | 12 | calculate-spell-damage, optimize-gear-set |
| Group/PvP | 8 | coordinate-cooldowns, get-arena-strategy |
| Quest/Routing | 5 | optimize-quest-route, trace-quest-chain |
| Economy | 6 | get-item-pricing, find-profitable-recipes |
| Collection | 4 | get-collection-status, get-farming-route |
| Development | 12 | review-file, analyze-bot-performance |
| Knowledge | 6 | search-playerbotWiki, generate-bot-component |
| Advanced | 8 | query-builder, zone-difficulty, monitoring |
| Incomplete | 4 | bot-ai-analyzer, behavior-tree (needs work) |

## Critical Issues to Address

### 🔴 High Priority
1. **SAI Editor Consolidation** - 3 versions exist, need to pick canonical
2. **Code Review AST** - 14 TODOs from Serena MCP integration
3. **Bot Analyzers** - Missing cooldown/proc detection, decision analysis
4. **Map Tools** - Using mock data instead of real DB

### 🟡 Medium Priority
5. Behavior Tree execution engine incomplete
6. Workflow Manager missing event/spell/text data
7. Web UI routes returning mock instead of calling MCP
8. SOAP latency calculation not implemented

### 🟢 Lower Priority
9. VMap/MMap visualization not implemented
10. 3D terrain rendering (in roadmap)
11. Real-time monitoring dashboard

## Code Patterns You'll See

### All Tools Follow:
```typescript
export interface ToolResult { /* ... */ }
export async function toolName(params: any): Promise<ToolResult> { /* ... */ }
```

### Database Access:
```typescript
import { queryWorld } from "../database/connection.js";
const rows = await queryWorld("SELECT ...", [params], true);  // useCache = true
```

### Tool Registration (in index.ts):
```typescript
{
  name: "tool-name",
  description: "Tool description",
  inputSchema: { type: "object", properties: { /* ... */ }, required: [ /* ... */ ] }
}
```

## Performance Notes

| Operation | Speed |
|-----------|-------|
| DB2 Cache Hit | <1ms |
| Query Cache Hit | <5ms |
| DB Query Miss | 50-500ms |
| SOAP Command | 500-2000ms |

## Configuration

**Main env file**: `.env` at project root

**Key variables**:
```env
# Database
TRINITY_DB_HOST=localhost
TRINITY_DB_PORT=3306
TRINITY_DB_USER=trinity
TRINITY_DB_PASSWORD=***

# SOAP (TrinityCore Server)
TRINITY_SOAP_HOST=127.0.0.1
TRINITY_SOAP_PORT=7878
TRINITY_SOAP_USERNAME=admin
TRINITY_SOAP_PASSWORD=admin
TRINITY_SOAP_MOCK=false  # Set true for development

# Paths
TRINITY_ROOT=C:\TrinityCore  # For DBC/DB2 access
DBC_PATH=C:\Server\data\dbc
DB2_PATH=C:\Server\data\db2
```

## Most Important Files

1. **src/index.ts** - Everything starts here (79 tools)
2. **src/database/connection.ts** - Database caching logic
3. **src/code-review/index.ts** - Code review orchestration
4. **web-ui/lib/soap-client.ts** - TrinityCore SOAP integration
5. **web-ui/lib/sai-editor-complete.ts** - Most complete SAI editor (pick this one)

## Quick Commands

```bash
# Build
npm run build

# Run MCP server
npm start

# Run web UI
cd web-ui && npm run dev

# Run tests
npm test

# Code review
npm run review-file -- src/myfile.cpp
```

## Integration Points

**Database ← → Tools**: All tools can query world/auth/characters databases
**SOAP ← → Web UI**: Direct TrinityCore server commands (mock available)
**Web UI ← → MCP**: Next.js routes call MCP tools via `/api/mcp/call`
**Code Review ← → AI**: Multi-LLM support (OpenAI, Ollama, LM Studio)

## Next Steps for Enhancement

### Immediate (1-2 weeks)
1. Consolidate SAI editors → pick `sai-editor-complete.ts`
2. Fix Code Review AST extraction (14 TODOs)
3. Complete bot analyzer cooldown tracking

### Short Term (1 month)
4. Connect map tools to actual database spawns
5. Complete behavior tree execution engine
6. Fix web UI API routes to call MCP

### Medium Term (2-3 months)
7. Add 3D map rendering (WebGL)
8. Implement VMap/MMap integration
9. Real-time monitoring dashboard

---

**Last Updated**: November 5, 2025
**Report File**: See `CODEBASE_EXPLORATION_REPORT.md` for full details
