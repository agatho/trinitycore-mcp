# TrinityCore MCP - Enterprise-Grade Implementation Plan (Phases 1-3)

**Created**: 2025-11-06
**Target**: Production-Ready, Enterprise-Grade Quality
**Timeline**: 9-12 weeks (compressed to maximum efficiency)
**Status**: 🚀 ACTIVE IMPLEMENTATION

---

## Mission Statement

Transform TrinityCore MCP from "audit-blocked" to "enterprise-grade production-ready" with:
- ✅ Zero stub implementations
- ✅ Zero placeholder/mock data
- ✅ Zero critical TODOs
- ✅ Comprehensive error handling
- ✅ Production logging
- ✅ Full test coverage
- ✅ Security hardened
- ✅ Performance optimized
- ✅ Complete documentation

---

## Phase 1: Critical Blockers (Week 1-3)

**Goal**: Make all features functional and accessible

### 1.1: Register All MCP Tools ⏱️ 2-3 days

**Priority**: 🔴 CRITICAL
**Blocking**: Yes - 26 features inaccessible

#### VMap Tools (8 tools)
```typescript
// src/index.ts additions:

{
  name: "list-vmap-files",
  description: "List available VMap files in a directory",
  inputSchema: {
    type: "object",
    properties: {
      vmapDir: { type: "string", description: "VMap directory path" }
    },
    required: ["vmapDir"]
  }
},
{
  name: "get-vmap-file-info",
  description: "Get information about a specific VMap file",
  inputSchema: {
    type: "object",
    properties: {
      vmapFile: { type: "string", description: "Path to VMap file" }
    },
    required: ["vmapFile"]
  }
},
{
  name: "vmap-test-line-of-sight",
  description: "Test line-of-sight between two points (Note: Basic implementation)",
  inputSchema: {
    type: "object",
    properties: {
      vmapDir: { type: "string" },
      mapId: { type: "number" },
      startX: { type: "number" },
      startY: { type: "number" },
      startZ: { type: "number" },
      endX: { type: "number" },
      endY: { type: "number" },
      endZ: { type: "number" }
    },
    required: ["vmapDir", "mapId", "startX", "startY", "startZ", "endX", "endY", "endZ"]
  }
},
{
  name: "vmap-find-spawns-in-radius",
  description: "Find creature/gameobject spawns within radius (Note: Basic implementation)",
  inputSchema: {
    type: "object",
    properties: {
      vmapDir: { type: "string" },
      mapId: { type: "number" },
      centerX: { type: "number" },
      centerY: { type: "number" },
      centerZ: { type: "number" },
      radius: { type: "number" }
    },
    required: ["vmapDir", "mapId", "centerX", "centerY", "centerZ", "radius"]
  }
}

// Similar pattern for MMap tools (4 tools)
// list-mmap-files, get-mmap-file-info, mmap-find-path, mmap-is-on-navmesh
```

#### Database Tools (15 tools)
```typescript
{
  name: "database-export",
  description: "Export database tables to file (SQL, JSON, CSV formats)",
  inputSchema: {
    type: "object",
    properties: {
      database: { type: "string", description: "Database name" },
      format: { type: "string", enum: ["sql", "json", "csv"] },
      outputPath: { type: "string" },
      tables: { type: "array", items: { type: "string" } },
      includeSchema: { type: "boolean", default: true },
      includeData: { type: "boolean", default: true },
      compress: { type: "boolean", default: false }
    },
    required: ["database", "format", "outputPath"]
  }
},
{
  name: "database-import",
  description: "Import database from file with conflict resolution",
  inputSchema: {
    type: "object",
    properties: {
      database: { type: "string" },
      inputPath: { type: "string" },
      format: { type: "string", enum: ["sql", "json", "csv"] },
      onConflict: { type: "string", enum: ["skip", "replace", "update", "error"], default: "error" },
      validate: { type: "boolean", default: true }
    },
    required: ["database", "inputPath", "format"]
  }
},
{
  name: "database-sync",
  description: "Synchronize database between multiple servers",
  inputSchema: {
    type: "object",
    properties: {
      sourceDatabase: { type: "string" },
      targetDatabases: { type: "array", items: { type: "string" } },
      tables: { type: "array", items: { type: "string" } },
      direction: { type: "string", enum: ["one-way", "bidirectional"], default: "one-way" },
      conflictStrategy: { type: "string", enum: ["source-wins", "target-wins", "newest-wins", "manual"] },
      dryRun: { type: "boolean", default: true }
    },
    required: ["sourceDatabase", "targetDatabases"]
  }
},
{
  name: "database-diff",
  description: "Compare schemas between two databases",
  inputSchema: {
    type: "object",
    properties: {
      sourceDatabase: { type: "string" },
      targetDatabase: { type: "string" }
    },
    required: ["sourceDatabase", "targetDatabase"]
  }
},
{
  name: "database-generate-migration",
  description: "Generate migration scripts from schema diff",
  inputSchema: {
    type: "object",
    properties: {
      sourceDatabase: { type: "string" },
      targetDatabase: { type: "string" },
      outputPath: { type: "string" }
    },
    required: ["sourceDatabase", "targetDatabase", "outputPath"]
  }
},
{
  name: "database-backup",
  description: "Create database backup with compression",
  inputSchema: {
    type: "object",
    properties: {
      database: { type: "string" },
      outputPath: { type: "string" },
      compress: { type: "boolean", default: true },
      includeSchema: { type: "boolean", default: true },
      includeData: { type: "boolean", default: true }
    },
    required: ["database", "outputPath"]
  }
},
{
  name: "database-restore",
  description: "Restore database from backup",
  inputSchema: {
    type: "object",
    properties: {
      database: { type: "string" },
      backupPath: { type: "string" },
      validate: { type: "boolean", default: true }
    },
    required: ["database", "backupPath"]
  }
},
{
  name: "database-health-check",
  description: "Run comprehensive database health checks",
  inputSchema: {
    type: "object",
    properties: {
      database: { type: "string" },
      checks: {
        type: "array",
        items: { type: "string", enum: ["connection", "tables", "indexes", "foreign-keys", "data-integrity", "performance", "disk-space", "replication"] }
      },
      autoFix: { type: "boolean", default: false }
    },
    required: ["database"]
  }
}

// ... 7 more database tool definitions
```

#### SOAP/WebSocket Tools (20 tools)
```typescript
{
  name: "websocket-server-start",
  description: "Start WebSocket server for real-time SOAP event streaming",
  inputSchema: {
    type: "object",
    properties: {
      port: { type: "number", default: 3001 },
      maxClients: { type: "number", default: 50 },
      rateLimit: { type: "number", default: 100 }
    }
  }
},
{
  name: "websocket-server-stop",
  description: "Stop WebSocket server",
  inputSchema: { type: "object", properties: {} }
},
{
  name: "websocket-list-clients",
  description: "List connected WebSocket clients",
  inputSchema: { type: "object", properties: {} }
},
{
  name: "soap-bridge-start",
  description: "Start SOAP bridge for event streaming",
  inputSchema: {
    type: "object",
    properties: {
      soapConnection: {
        type: "object",
        properties: {
          host: { type: "string" },
          port: { type: "number" },
          username: { type: "string" },
          password: { type: "string" }
        },
        required: ["host", "port", "username", "password"]
      },
      pollInterval: { type: "number", default: 5000 }
    },
    required: ["soapConnection"]
  }
},
{
  name: "soap-bridge-stop",
  description: "Stop SOAP bridge",
  inputSchema: { type: "object", properties: {} }
},
{
  name: "session-recorder-start",
  description: "Start recording SOAP event session",
  inputSchema: {
    type: "object",
    properties: {
      sessionName: { type: "string" }
    },
    required: ["sessionName"]
  }
},
{
  name: "session-recorder-stop",
  description: "Stop recording session",
  inputSchema: { type: "object", properties: {} }
},
{
  name: "session-player-play",
  description: "Play back recorded session",
  inputSchema: {
    type: "object",
    properties: {
      sessionId: { type: "string" },
      speed: { type: "number", default: 1.0 },
      loop: { type: "boolean", default: false }
    },
    required: ["sessionId"]
  }
}

// ... 12 more SOAP/WebSocket tool definitions
```

#### Testing Tools (10 tools)
```typescript
{
  name: "test-run-suite",
  description: "Run test suite with specified configuration",
  inputSchema: {
    type: "object",
    properties: {
      suiteName: { type: "string" },
      testType: { type: "string", enum: ["unit", "integration", "e2e", "performance"] },
      pattern: { type: "string" },
      parallel: { type: "boolean", default: true }
    }
  }
},
{
  name: "test-generate-from-code",
  description: "AI-powered test generation from source code",
  inputSchema: {
    type: "object",
    properties: {
      sourcePath: { type: "string" },
      outputPath: { type: "string" },
      testTypes: { type: "array", items: { type: "string" } }
    },
    required: ["sourcePath", "outputPath"]
  }
},
{
  name: "test-performance-benchmark",
  description: "Run performance benchmark on function",
  inputSchema: {
    type: "object",
    properties: {
      functionName: { type: "string" },
      iterations: { type: "number", default: 1000 },
      warmup: { type: "number", default: 100 }
    },
    required: ["functionName"]
  }
},
{
  name: "test-load-test",
  description: "Run load test with specified RPS",
  inputSchema: {
    type: "object",
    properties: {
      targetRps: { type: "number" },
      duration: { type: "number" },
      rampUp: { type: "number", default: 0 }
    },
    required: ["targetRps", "duration"]
  }
},
{
  name: "test-get-coverage",
  description: "Get test coverage statistics",
  inputSchema: {
    type: "object",
    properties: {
      path: { type: "string" }
    }
  }
}

// ... 5 more testing tool definitions
```

#### Configuration Tools (5 tools)
```typescript
{
  name: "config-get",
  description: "Get current configuration",
  inputSchema: { type: "object", properties: {} }
},
{
  name: "config-update",
  description: "Update configuration",
  inputSchema: {
    type: "object",
    properties: {
      config: { type: "object" }
    },
    required: ["config"]
  }
},
{
  name: "config-validate",
  description: "Validate configuration",
  inputSchema: {
    type: "object",
    properties: {
      config: { type: "object" }
    },
    required: ["config"]
  }
},
{
  name: "config-reset",
  description: "Reset configuration to defaults",
  inputSchema: { type: "object", properties: {} }
},
{
  name: "config-export",
  description: "Export configuration (sanitized)",
  inputSchema: {
    type: "object",
    properties: {
      outputPath: { type: "string" }
    },
    required: ["outputPath"]
  }
}
```

**Implementation Steps**:
1. ✅ Create tool definitions in `src/index.ts` (4 hours)
2. ✅ Wire up handlers to existing implementations (4 hours)
3. ✅ Test each tool with MCP client (4 hours)
4. ✅ Document limitations (VMap/MMap are basic implementations)

---

### 1.2: Connect Web UI to Real MCP Tools ⏱️ 3-4 days

**Priority**: 🔴 CRITICAL
**Files**: `web-ui/app/api/workflow/route.ts`, `profiler/route.ts`, `schema/route.ts`

#### Create MCP Client Utility

**File**: `web-ui/lib/mcp-client.ts` (NEW)
```typescript
/**
 * MCP Client for Web UI
 *
 * Provides connection to MCP server from Next.js API routes
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

let mcpClient: Client | null = null;

export async function getMCPClient(): Promise<Client> {
  if (mcpClient) return mcpClient;

  // Create stdio transport to MCP server
  const transport = new StdioClientTransport({
    command: 'node',
    args: ['../dist/index.js'],
    env: process.env
  });

  mcpClient = new Client({
    name: 'trinity-web-ui',
    version: '1.0.0'
  }, {
    capabilities: {}
  });

  await mcpClient.connect(transport);
  return mcpClient;
}

export async function callMCPTool(
  toolName: string,
  args: Record<string, any>
): Promise<any> {
  try {
    const client = await getMCPClient();
    const result = await client.callTool({
      name: toolName,
      arguments: args
    });

    if (result.isError) {
      throw new Error(result.content[0]?.text || 'MCP tool error');
    }

    return JSON.parse(result.content[0]?.text || '{}');
  } catch (error) {
    console.error(`MCP tool call failed: ${toolName}`, error);
    throw error;
  }
}
```

#### Fix Workflow API

**File**: `web-ui/app/api/workflow/route.ts`
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { callMCPTool } from '@/lib/mcp-client';

/**
 * GET /api/workflow
 * Get list of available workflows
 */
export async function GET(request: NextRequest) {
  try {
    // BEFORE: return mockWorkflows
    // AFTER: Call real MCP tool
    const workflows = await callMCPTool('list-workflows', {});

    return NextResponse.json({
      success: true,
      workflows: workflows.workflows || []
    });
  } catch (error) {
    console.error('Failed to list workflows:', error);
    return NextResponse.json(
      {
        success: false,
        error: (error as Error).message
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/workflow
 * Execute workflow
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { workflowId, parameters } = body;

    // BEFORE: return fake execution ID
    // AFTER: Call real MCP tool
    const result = await callMCPTool('execute-workflow', {
      workflowId,
      parameters
    });

    return NextResponse.json({
      success: true,
      executionId: result.executionId,
      status: result.status
    });
  } catch (error) {
    console.error('Failed to execute workflow:', error);
    return NextResponse.json(
      {
        success: false,
        error: (error as Error).message
      },
      { status: 500 }
    );
  }
}
```

#### Fix Profiler API

**File**: `web-ui/app/api/profiler/route.ts`
```typescript
import { callMCPTool } from '@/lib/mcp-client';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const endpoint = searchParams.get('endpoint');

    switch (endpoint) {
      case 'data':
        // BEFORE: return mockProfilingData
        // AFTER: Call real MCP tool
        const data = await callMCPTool('profiler-get-data', {});
        return NextResponse.json({ success: true, data });

      case 'metrics':
        // BEFORE: return mockMetrics
        // AFTER: Call real MCP tool
        const metrics = await callMCPTool('profiler-get-metrics', {});
        return NextResponse.json({ success: true, metrics });

      default:
        return NextResponse.json(
          { success: false, error: 'Unknown endpoint' },
          { status: 400 }
        );
    }
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, query } = body;

    if (action === 'explain') {
      // BEFORE: return mockQueryPlan
      // AFTER: Call real MCP tool
      const plan = await callMCPTool('profiler-explain-query', { query });
      return NextResponse.json({ success: true, plan });
    }

    return NextResponse.json(
      { success: false, error: 'Unknown action' },
      { status: 400 }
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
```

#### Fix Schema API

**File**: `web-ui/app/api/schema/route.ts`
```typescript
import { callMCPTool } from '@/lib/mcp-client';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const table = searchParams.get('table');

    switch (action) {
      case 'list-tables':
        // BEFORE: return []
        // AFTER: Call real MCP tool
        const tables = await callMCPTool('list-tables', {
          database: searchParams.get('database') || 'world'
        });
        return NextResponse.json({ success: true, tables });

      case 'get-schema':
        // BEFORE: return {}
        // AFTER: Call real MCP tool
        if (!table) {
          return NextResponse.json(
            { success: false, error: 'Table name required' },
            { status: 400 }
          );
        }
        const schema = await callMCPTool('get-table-schema', {
          database: searchParams.get('database') || 'world',
          table
        });
        return NextResponse.json({ success: true, schema });

      case 'get-relationships':
        // BEFORE: return []
        // AFTER: Call real MCP tool
        if (!table) {
          return NextResponse.json(
            { success: false, error: 'Table name required' },
            { status: 400 }
          );
        }
        const relationships = await callMCPTool('get-table-relationships', {
          database: searchParams.get('database') || 'world',
          table
        });
        return NextResponse.json({ success: true, relationships });

      default:
        return NextResponse.json(
          { success: false, error: 'Unknown action' },
          { status: 400 }
        );
    }
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, database } = body;

    // BEFORE: return mock result
    // AFTER: Call real MCP tool
    const result = await callMCPTool('execute-query', {
      database: database || 'world',
      query
    });

    return NextResponse.json({ success: true, result });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
```

**Implementation Steps**:
1. ✅ Create MCP client utility (4 hours)
2. ✅ Fix workflow API routes (4 hours)
3. ✅ Fix profiler API routes (4 hours)
4. ✅ Fix schema API routes (4 hours)
5. ✅ Test each endpoint with real MCP server (4 hours)
6. ✅ Add error handling and retries (4 hours)

---

### 1.3: Replace Hardcoded Cooldown Database ⏱️ 1 day

**Priority**: 🟡 HIGH
**File**: `src/tools/cooldown-tracker.ts`

**Current** (Lines 90-450):
```typescript
const COOLDOWN_DATABASE: Record<number, SpellCooldownInfo> = {
  19574: { baseCooldown: 120000, ... },
  // ... 100+ hardcoded entries
};
```

**Replace With**:
```typescript
import { DatabaseConfig, getDatabaseConnection } from '../database/db-client.js';
import LRU from 'lru-cache';

// Cache cooldown data for 5 minutes
const cooldownCache = new LRU<number, SpellCooldownInfo>({
  max: 1000,
  ttl: 1000 * 60 * 5 // 5 minutes
});

async function getSpellCooldown(spellId: number): Promise<SpellCooldownInfo | null> {
  // Check cache first
  const cached = cooldownCache.get(spellId);
  if (cached) return cached;

  try {
    // Query database
    const db = await getDatabaseConnection({ database: 'world' });
    const query = `
      SELECT
        RecoveryTime as baseCooldown,
        CategoryRecoveryTime as categoryCooldown,
        StartRecoveryCategory as category,
        StartRecoveryTime as startRecoveryTime
      FROM spell_dbc
      WHERE ID = ?
    `;

    const [rows] = await db.execute(query, [spellId]);

    if (!rows || (rows as any[]).length === 0) {
      // Not found in database, return null
      return null;
    }

    const row = (rows as any[])[0];
    const info: SpellCooldownInfo = {
      baseCooldown: row.baseCooldown || 0,
      categoryCooldown: row.categoryCooldown || 0,
      category: categorizeCooldown(row.baseCooldown),
      hasCooldown: row.baseCooldown > 0,
      isGCD: row.baseCooldown === 1500,
      modifiers: {
        hasteAffected: isHasteAffected(spellId),
        talentModifiers: getTalentModifiers(spellId)
      }
    };

    // Cache and return
    cooldownCache.set(spellId, info);
    return info;
  } catch (error) {
    console.error(`Failed to query cooldown for spell ${spellId}:`, error);
    // Fall back to default
    return {
      baseCooldown: 0,
      categoryCooldown: 0,
      category: AbilityCooldownCategory.NONE,
      hasCooldown: false,
      isGCD: false,
      modifiers: { hasteAffected: false, talentModifiers: [] }
    };
  }
}

function categorizeCooldown(cooldown: number): AbilityCooldownCategory {
  if (cooldown === 0) return AbilityCooldownCategory.NONE;
  if (cooldown === 1500) return AbilityCooldownCategory.GCD;
  if (cooldown <= 30000) return AbilityCooldownCategory.SHORT;
  if (cooldown <= 120000) return AbilityCooldownCategory.MEDIUM;
  if (cooldown <= 300000) return AbilityCooldownCategory.LONG;
  return AbilityCooldownCategory.MAJOR_OFFENSIVE;
}

// Update all functions to use dynamic loading
export async function trackCooldown(
  abilityId: number,
  timestamp: number
): Promise<CooldownInfo> {
  const spellInfo = await getSpellCooldown(abilityId);

  if (!spellInfo) {
    throw new Error(`Unknown ability: ${abilityId}`);
  }

  // ... rest of existing logic
}
```

**Implementation Steps**:
1. ✅ Add database query function (2 hours)
2. ✅ Add LRU cache with 5-minute TTL (1 hour)
3. ✅ Update all cooldown tracking functions (3 hours)
4. ✅ Test with various spell IDs (2 hours)
5. ✅ Add fallback for missing data (1 hour)

---

### 1.4: Fix Critical TODOs ⏱️ 3-5 days

**Priority**: 🔴 CRITICAL

#### TODO-001 to TODO-004: VMap/MMap Stubs

**Decision**: Document as "Basic Implementation" rather than full implementation

**File**: `src/tools/vmap-tools.ts`
```typescript
/**
 * Test line-of-sight between two points using VMap collision data
 *
 * NOTE: This is a BASIC IMPLEMENTATION that provides distance-based estimation.
 * Full VMap binary parsing and ray-triangle intersection is planned for v2.0.
 *
 * Current behavior:
 * - Returns clear: true if distance < 1000 units
 * - Returns clear: false if distance >= 1000 units
 * - Does NOT load actual VMap files
 * - Does NOT perform true collision detection
 *
 * For production use with actual game data, consider using TrinityCore's
 * built-in VMap system via SOAP commands.
 */
export async function testLineOfSight(options: RaycastOptions): Promise<RaycastResult> {
  const { startX, startY, startZ, endX, endY, endZ } = options;

  // Calculate distance
  const dx = endX - startX;
  const dy = endY - startY;
  const dz = endZ - startZ;
  const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

  // BASIC IMPLEMENTATION: Distance-based heuristic
  // Assumes LOS is clear if distance is reasonable
  const clear = distance < 1000; // 1000 game units = ~50 yards

  return {
    clear,
    hitPoint: clear ? null : {
      x: startX + (dx * 0.5),
      y: startY + (dy * 0.5),
      z: startZ + (dz * 0.5)
    },
    distance
  };
}

/**
 * Find spawns within radius
 *
 * NOTE: This is a BASIC IMPLEMENTATION that queries the database only.
 * Full VMap integration for collision-aware spawn validation is planned for v2.0.
 *
 * Current behavior:
 * - Queries creature table for spawns in map
 * - Filters by distance from center point
 * - Does NOT use VMap for collision filtering
 */
export async function findSpawnsInRadius(options: SpawnQueryOptions): Promise<SpawnQueryResult> {
  const { mapId, centerX, centerY, centerZ, radius } = options;

  try {
    const db = await getDatabaseConnection({ database: 'world' });
    const query = `
      SELECT
        guid, id, position_x, position_y, position_z
      FROM creature
      WHERE map = ?
        AND SQRT(
          POW(position_x - ?, 2) +
          POW(position_y - ?, 2) +
          POW(position_z - ?, 2)
        ) <= ?
      LIMIT 100
    `;

    const [rows] = await db.execute(query, [mapId, centerX, centerY, centerZ, radius]);

    const spawns = (rows as any[]).map(row => ({
      guid: row.guid,
      entry: row.id,
      position: {
        x: row.position_x,
        y: row.position_y,
        z: row.position_z
      }
    }));

    return {
      spawns,
      count: spawns.length
    };
  } catch (error) {
    console.error('Failed to query spawns:', error);
    return { spawns: [], count: 0 };
  }
}
```

**File**: `src/tools/mmap-tools.ts`
```typescript
/**
 * Find path between two points
 *
 * NOTE: This is a BASIC IMPLEMENTATION using straight-line pathfinding.
 * Full MMap binary parsing and A* pathfinding is planned for v2.0.
 *
 * Current behavior:
 * - Returns 2-point straight line path
 * - Does NOT load MMap navigation mesh
 * - Does NOT perform A* pathfinding
 * - Does NOT check terrain walkability
 *
 * For production pathfinding, consider using TrinityCore's PathGenerator
 * via a custom SOAP command.
 */
export async function findPath(options: PathfindingOptions): Promise<PathResult> {
  const { startX, startY, startZ, goalX, goalY, goalZ } = options;

  const dx = goalX - startX;
  const dy = goalY - startY;
  const dz = goalZ - startZ;
  const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

  // BASIC IMPLEMENTATION: Straight line with 5 interpolated points
  const path = [];
  const steps = Math.min(Math.ceil(distance / 10), 20); // Max 20 waypoints

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    path.push({
      x: startX + dx * t,
      y: startY + dy * t,
      z: startZ + dz * t
    });
  }

  return {
    found: true,
    path,
    distance,
    smoothed: false
  };
}

/**
 * Check if position is on navigation mesh
 *
 * NOTE: This is a BASIC IMPLEMENTATION that always returns true.
 * Full MMap integration is planned for v2.0.
 */
export async function isOnNavMesh(options: NavMeshQueryOptions): Promise<NavMeshQueryResult> {
  const { posX, posY, posZ } = options;

  // BASIC IMPLEMENTATION: Always returns true
  return {
    onNavMesh: true,
    nearestPoint: { x: posX, y: posY, z: posZ }
  };
}
```

**Add README for VMap/MMap**:
```markdown
# VMap/MMap Tools - Current Status

## Implementation Status: BASIC

The VMap and MMap tools currently provide **basic functionality** for development and testing purposes. They do NOT include full binary file parsing or advanced algorithms.

### What Works
- ✅ File listing and metadata extraction
- ✅ Distance-based heuristics for LOS
- ✅ Database queries for spawn locations
- ✅ Straight-line pathfinding

### What's Planned for v2.0
- ⏳ Full VMap binary parsing (.vmtree, .vmtile)
- ⏳ Ray-triangle intersection for accurate LOS
- ⏳ Full MMap binary parsing (.mmap, .mmtile)
- ⏳ A* pathfinding on Recast navigation mesh
- ⏳ Path smoothing and optimization

### Workarounds for Production

If you need accurate VMap/MMap functionality now:

1. **Use TrinityCore SOAP directly**
   ```typescript
   const result = await soapClient.command('.go xyz 100 200 10');
   ```

2. **Create custom SOAP commands**
   ```cpp
   // In TrinityCore C++
   static bool HandleTestLosCommand(ChatHandler* handler, char const* args) {
     // Use built-in VMapManager
   }
   ```

3. **Use external microservice**
   - Create C++ service using TrinityCore libraries
   - Expose REST API for pathfinding
   - Call from MCP tools
```

#### TODO-024 to TODO-034: Web UI API Integration

**Status**: Covered in Phase 1.2 above ✅

---

### 1.5: Comprehensive Error Handling ⏱️ 2-3 days

**Priority**: 🟡 HIGH

#### Add Error Handler Utility

**File**: `src/utils/error-handler.ts` (NEW)
```typescript
/**
 * Enterprise-grade error handling utilities
 */

export class MCPError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public details?: any
  ) {
    super(message);
    this.name = 'MCPError';
  }
}

export class DatabaseError extends MCPError {
  constructor(message: string, details?: any) {
    super(message, 'DATABASE_ERROR', 500, details);
    this.name = 'DatabaseError';
  }
}

export class ValidationError extends MCPError {
  constructor(message: string, details?: any) {
    super(message, 'VALIDATION_ERROR', 400, details);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends MCPError {
  constructor(resource: string) {
    super(`${resource} not found`, 'NOT_FOUND', 404);
    this.name = 'NotFoundError';
  }
}

export class AuthenticationError extends MCPError {
  constructor(message: string = 'Authentication failed') {
    super(message, 'AUTH_ERROR', 401);
    this.name = 'AuthenticationError';
  }
}

/**
 * Retry with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts?: number;
    initialDelay?: number;
    maxDelay?: number;
    backoffFactor?: number;
  } = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    backoffFactor = 2
  } = options;

  let lastError: Error;
  let delay = initialDelay;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt === maxAttempts) {
        throw lastError;
      }

      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, delay));

      // Exponential backoff
      delay = Math.min(delay * backoffFactor, maxDelay);
    }
  }

  throw lastError!;
}

/**
 * Wrap async function with error handling
 */
export function withErrorHandling<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  context: string
): T {
  return (async (...args: any[]) => {
    try {
      return await fn(...args);
    } catch (error) {
      if (error instanceof MCPError) {
        throw error;
      }

      // Wrap unknown errors
      throw new MCPError(
        `Error in ${context}: ${(error as Error).message}`,
        'INTERNAL_ERROR',
        500,
        { originalError: error }
      );
    }
  }) as T;
}
```

#### Apply to Database Operations

**File**: `src/database/db-client.ts`
```typescript
import { retry, DatabaseError } from '../utils/error-handler.js';

export async function executeQuery(
  db: Connection,
  query: string,
  params: any[] = []
): Promise<any> {
  return retry(
    async () => {
      try {
        const [rows] = await db.execute(query, params);
        return rows;
      } catch (error) {
        throw new DatabaseError(
          `Query execution failed: ${(error as Error).message}`,
          { query, params }
        );
      }
    },
    { maxAttempts: 3, initialDelay: 1000 }
  );
}

export async function withTransaction<T>(
  db: Connection,
  fn: (connection: Connection) => Promise<T>
): Promise<T> {
  try {
    await db.beginTransaction();
    const result = await fn(db);
    await db.commit();
    return result;
  } catch (error) {
    await db.rollback();
    throw new DatabaseError(
      `Transaction failed: ${(error as Error).message}`,
      { originalError: error }
    );
  }
}
```

**Implementation Steps**:
1. ✅ Create error handler utility (4 hours)
2. ✅ Apply to database operations (4 hours)
3. ✅ Apply to all MCP tools (8 hours)
4. ✅ Add error logging (4 hours)
5. ✅ Test error scenarios (4 hours)

---

## Phase 2: Production Quality (Week 4-6)

**Goal**: Enterprise-grade code quality

### 2.1: Implement Proper Logging ⏱️ 2 days

**Priority**: 🟡 HIGH

#### Add Winston Logging

**File**: `src/utils/logger.ts` (NEW)
```typescript
import winston from 'winston';
import path from 'path';

const LOG_DIR = process.env.LOG_DIR || './logs';
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

export const logger = winston.createLogger({
  level: LOG_LEVEL,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'trinitycore-mcp' },
  transports: [
    // Error log
    new winston.transports.File({
      filename: path.join(LOG_DIR, 'error.log'),
      level: 'error',
      maxsize: 10485760, // 10MB
      maxFiles: 5
    }),
    // Combined log
    new winston.transports.File({
      filename: path.join(LOG_DIR, 'combined.log'),
      maxsize: 10485760,
      maxFiles: 5
    })
  ]
});

// Console logging in development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

/**
 * Log database query
 */
export function logQuery(query: string, params: any[], duration: number) {
  logger.debug('Database query executed', {
    query,
    params,
    duration,
    type: 'database'
  });
}

/**
 * Log MCP tool execution
 */
export function logToolExecution(
  toolName: string,
  args: any,
  duration: number,
  success: boolean
) {
  logger.info('MCP tool executed', {
    toolName,
    args,
    duration,
    success,
    type: 'mcp-tool'
  });
}

/**
 * Log error with context
 */
export function logError(error: Error, context: string, metadata?: any) {
  logger.error('Error occurred', {
    message: error.message,
    stack: error.stack,
    context,
    ...metadata,
    type: 'error'
  });
}
```

#### Replace console.log

**Global find/replace**:
- `console.log` → `logger.info`
- `console.error` → `logger.error`
- `console.warn` → `logger.warn`
- `console.debug` → `logger.debug`

**Implementation Steps**:
1. ✅ Install winston: `npm install winston` (1 hour)
2. ✅ Create logger utility (4 hours)
3. ✅ Replace all console.log (8 hours - automated with regex)
4. ✅ Add structured logging to tools (4 hours)
5. ✅ Configure log rotation (2 hours)

---

### 2.2: Fix All Remaining TODOs ⏱️ 10-15 days

**Priority**: 🟡 HIGH

This is a comprehensive effort. See `docs/TECHNICAL_DEBT.md` for complete list.

**Summary**:
- Combat analysis TODOs: 8 days
- Code analysis TODOs: 6 days
- Workflow TODOs: 5.5 days
- Misc TODOs: 1 day

**Total**: ~20 days (can parallelize some work)

---

### 2.3: Integration & E2E Tests ⏱️ 5-7 days

**Priority**: 🟡 HIGH

#### WebSocket E2E Tests

**File**: `tests/integration/websocket-e2e.test.ts` (NEW)
```typescript
import WebSocket from 'ws';
import { SOAPWebSocketServer } from '../src/soap/websocket-server.js';

describe('WebSocket Server E2E', () => {
  let server: SOAPWebSocketServer;
  let ws: WebSocket;

  beforeAll(async () => {
    server = new SOAPWebSocketServer({ port: 3002 });
    await server.start();
  });

  afterAll(async () => {
    await server.stop();
  });

  afterEach(() => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.close();
    }
  });

  it('should accept connection with valid auth', async () => {
    ws = new WebSocket('ws://localhost:3002');

    await new Promise((resolve) => {
      ws.on('open', () => {
        ws.send(JSON.stringify({
          type: 'auth',
          token: 'test-token'
        }));
      });

      ws.on('message', (data) => {
        const message = JSON.parse(data.toString());
        expect(message.type).toBe('auth-success');
        resolve(null);
      });
    });
  });

  it('should reject connection without auth', async () => {
    ws = new WebSocket('ws://localhost:3002');

    await new Promise((resolve) => {
      ws.on('message', (data) => {
        const message = JSON.parse(data.toString());
        // Should be kicked after timeout
        expect(message.type).toBe('error');
        resolve(null);
      });
    });
  });

  it('should enforce rate limiting', async () => {
    ws = new WebSocket('ws://localhost:3002');

    // Auth first
    ws.send(JSON.stringify({ type: 'auth', token: 'test-token' }));
    await waitForAuth();

    // Subscribe to events
    ws.send(JSON.stringify({ type: 'subscribe', data: { events: ['*'] } }));

    // Send 200 events rapidly (over 100/sec limit)
    const events = [];
    for (let i = 0; i < 200; i++) {
      server.broadcastEvent({
        type: 'test',
        timestamp: Date.now(),
        data: { i }
      });
    }

    // Should only receive ~100 events due to rate limit
    await new Promise((resolve) => setTimeout(resolve, 1000));
    expect(events.length).toBeLessThan(120);
    expect(events.length).toBeGreaterThan(80);
  });

  // More tests...
});
```

#### Database Sync Integration Tests

**File**: `tests/integration/database-sync.test.ts` (NEW)
```typescript
import { DatabaseSyncEngine } from '../src/database/sync-engine.js';
import { createTestDatabase, seedTestData } from './test-utils.js';

describe('Database Sync Integration', () => {
  let sourceDB, targetDB;

  beforeAll(async () => {
    sourceDB = await createTestDatabase('sync_test_source');
    targetDB = await createTestDatabase('sync_test_target');
  });

  afterAll(async () => {
    await sourceDB.destroy();
    await targetDB.destroy();
  });

  it('should sync 1000 rows with SOURCE_WINS strategy', async () => {
    // Seed source with 1000 rows
    await seedTestData(sourceDB, 'creature_template', 1000);

    // Seed target with different data
    await seedTestData(targetDB, 'creature_template', 500);

    // Run sync
    const syncEngine = new DatabaseSyncEngine({
      source: sourceDB.config,
      targets: [targetDB.config],
      tables: ['creature_template'],
      direction: 'one-way',
      conflictStrategy: 'source-wins'
    });

    const result = await syncEngine.syncDatabase();

    expect(result.success).toBe(true);
    expect(result.rowsSynced).toBe(1000);

    // Verify target matches source
    const sourceRows = await sourceDB.query('SELECT * FROM creature_template ORDER BY entry');
    const targetRows = await targetDB.query('SELECT * FROM creature_template ORDER BY entry');
    expect(targetRows).toEqual(sourceRows);
  });

  it('should handle conflict resolution with NEWEST_WINS', async () => {
    // Create conflicting rows with different timestamps
    await sourceDB.query(`
      INSERT INTO creature_template (entry, name, updated_at)
      VALUES (1000, 'Source Creature', NOW())
    `);

    await targetDB.query(`
      INSERT INTO creature_template (entry, name, updated_at)
      VALUES (1000, 'Target Creature', NOW() - INTERVAL 1 DAY)
    `);

    const syncEngine = new DatabaseSyncEngine({
      source: sourceDB.config,
      targets: [targetDB.config],
      tables: ['creature_template'],
      direction: 'bidirectional',
      conflictStrategy: 'newest-wins'
    });

    await syncEngine.syncDatabase();

    // Verify newest wins (source is newer)
    const rows = await targetDB.query('SELECT name FROM creature_template WHERE entry = 1000');
    expect(rows[0].name).toBe('Source Creature');
  });

  // More tests...
});
```

**Implementation Steps**:
1. ✅ Install test dependencies (2 hours)
2. ✅ Create WebSocket E2E tests (2 days)
3. ✅ Create database sync tests (2 days)
4. ✅ Create API route integration tests (2 days)
5. ✅ Achieve 80%+ integration coverage (1 day)

---

### 2.4: Performance Optimizations ⏱️ 3-5 days

**Priority**: 🟢 MEDIUM

#### Batch Database Operations

**File**: `src/database/sync-engine.ts`
```typescript
private async insertRows(
  db: Connection,
  table: string,
  columns: string[],
  rows: any[][]
): Promise<void> {
  const BATCH_SIZE = 1000;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);

    // Build multi-value INSERT
    const placeholders = batch.map(() =>
      `(${columns.map(() => '?').join(',')})`
    ).join(',');

    const query = `
      INSERT INTO \`${table}\` (\`${columns.join('`,`')}\`)
      VALUES ${placeholders}
    `;

    const values = batch.flat();

    await executeQuery(db, query, values);

    this.emit('progress', {
      table,
      processed: Math.min(i + BATCH_SIZE, rows.length),
      total: rows.length
    });
  }
}
```

#### Cache AST Parsing

**File**: `src/code-review/CodeAnalysisEngine.ts`
```typescript
import crypto from 'crypto';

private astCache = new Map<string, {
  fileHash: string;
  mtime: number;
  analysis: CodeAnalysis;
}>();

async analyzeFile(filePath: string): Promise<CodeAnalysis> {
  const stats = await fs.stat(filePath);
  const cached = this.astCache.get(filePath);

  if (cached && cached.mtime === stats.mtimeMs) {
    return cached.analysis;
  }

  const content = await fs.readFile(filePath, 'utf-8');
  const fileHash = crypto.createHash('sha256').update(content).digest('hex');

  if (cached && cached.fileHash === fileHash) {
    // Content unchanged, just update mtime
    cached.mtime = stats.mtimeMs;
    return cached.analysis;
  }

  // Parse and cache
  const analysis = await this.parseCode(filePath, content);

  this.astCache.set(filePath, {
    fileHash,
    mtime: stats.mtimeMs,
    analysis
  });

  return analysis;
}
```

**Implementation Steps**:
1. ✅ Implement batch inserts (1 day)
2. ✅ Add AST caching (1 day)
3. ✅ Add query result caching (1 day)
4. ✅ Optimize hot paths (1 day)
5. ✅ Performance benchmarks (1 day)

---

### 2.5: Document VMap/MMap Limitations ⏱️ 1 day

**Priority**: 🟡 HIGH

**File**: `docs/VMAP_MMAP_LIMITATIONS.md` (NEW)

(Created in Phase 1.4 README)

---

## Phase 3: Production Ready (Week 7-9)

**Goal**: Enterprise-grade security, monitoring, and documentation

### 3.1: Security Audit & Hardening ⏱️ 5-7 days

**Priority**: 🟡 HIGH

#### SQL Injection Prevention

**Pattern**: Never concatenate SQL
```typescript
// ❌ WRONG
const query = `SELECT * FROM ${tableName} WHERE id = ${userId}`;

// ✅ CORRECT
const validTables = ['creature_template', 'item_template'];
if (!validTables.includes(tableName)) {
  throw new ValidationError('Invalid table name');
}
const query = `SELECT * FROM ?? WHERE id = ?`;
await db.execute(query, [tableName, userId]);
```

#### Input Validation with Zod

**File**: `src/utils/validation.ts` (NEW)
```typescript
import { z } from 'zod';

export const spellIdSchema = z.number().int().positive().max(999999);
export const itemIdSchema = z.number().int().positive().max(999999);
export const questIdSchema = z.number().int().positive().max(999999);

export const databaseNameSchema = z.enum(['world', 'characters', 'auth']);

export const coordinateSchema = z.object({
  x: z.number().min(-20000).max(20000),
  y: z.number().min(-20000).max(20000),
  z: z.number().min(-5000).max(5000)
});

export function validateInput<T>(schema: z.ZodSchema<T>, data: unknown): T {
  return schema.parse(data);
}
```

#### Rate Limiting

**File**: `src/utils/rate-limiter.ts` (NEW)
```typescript
import { RateLimiterMemory } from 'rate-limiter-flexible';

const rateLimiter = new RateLimiterMemory({
  points: 100, // 100 requests
  duration: 60, // per 60 seconds
});

export async function checkRateLimit(clientId: string): Promise<boolean> {
  try {
    await rateLimiter.consume(clientId);
    return true;
  } catch {
    return false;
  }
}
```

**Implementation Steps**:
1. ✅ Audit all SQL queries (2 days)
2. ✅ Add input validation with Zod (2 days)
3. ✅ Implement rate limiting (1 day)
4. ✅ Security penetration test (2 days)

---

### 3.2: Complete Documentation ⏱️ 3-4 days

**Priority**: 🟡 HIGH

#### API Reference

**File**: `docs/API_REFERENCE.md` (NEW)

(Comprehensive tool catalog - 110 tools documented)

#### Deployment Guide

**File**: `docs/DEPLOYMENT_GUIDE.md` (NEW)

(Step-by-step production deployment)

#### Troubleshooting Guide

**File**: `docs/TROUBLESHOOTING.md` (NEW)

(Common issues and solutions)

---

### 3.3: Monitoring & Alerting ⏱️ 3-4 days

**Priority**: 🟢 MEDIUM

#### Prometheus Metrics

**File**: `src/utils/metrics.ts` (NEW)
```typescript
import promClient from 'prom-client';

// Create metrics
export const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status']
});

export const databaseQueryDuration = new promClient.Histogram({
  name: 'database_query_duration_seconds',
  help: 'Duration of database queries in seconds',
  labelNames: ['query_type']
});

export const mcpToolExecutions = new promClient.Counter({
  name: 'mcp_tool_executions_total',
  help: 'Total number of MCP tool executions',
  labelNames: ['tool_name', 'success']
});

// Expose metrics endpoint
export function setupMetricsEndpoint(app: Express) {
  app.get('/metrics', async (req, res) => {
    res.set('Content-Type', promClient.register.contentType);
    res.end(await promClient.register.metrics());
  });
}
```

**Implementation Steps**:
1. ✅ Install prom-client (1 hour)
2. ✅ Add metrics collection (1 day)
3. ✅ Create Grafana dashboard (1 day)
4. ✅ Set up alerts (1 day)
5. ✅ Document monitoring setup (1 day)

---

## Completion Checklist

### Phase 1 (Weeks 1-3)
- [ ] All 26 MCP tools registered and tested
- [ ] Web UI APIs connected to real MCP tools (no mock data)
- [ ] Hardcoded cooldown database replaced with live queries
- [ ] Critical TODOs documented or fixed
- [ ] Comprehensive error handling added
- [ ] VMap/MMap limitations clearly documented

### Phase 2 (Weeks 4-6)
- [ ] Winston logging implemented throughout
- [ ] All console.log replaced
- [ ] Remaining TODOs completed
- [ ] Integration tests added (80%+ coverage)
- [ ] E2E tests for WebSocket and database sync
- [ ] Performance optimizations complete
- [ ] Batch operations implemented

### Phase 3 (Weeks 7-9)
- [ ] Security audit passed
- [ ] SQL injection vulnerabilities fixed
- [ ] Input validation with Zod
- [ ] Rate limiting implemented
- [ ] API reference complete (110 tools)
- [ ] Deployment guide complete
- [ ] Troubleshooting guide complete
- [ ] Prometheus metrics implemented
- [ ] Grafana dashboard created
- [ ] Alert rules configured

---

## Success Criteria

### Functional Requirements
- ✅ All features accessible via MCP
- ✅ Web UI displays real data
- ✅ Database operations work correctly
- ✅ Real-time streaming functional

### Quality Requirements
- ✅ Zero stub implementations (except documented VMap/MMap)
- ✅ Zero TODO comments in production code
- ✅ Zero hardcoded data
- ✅ 80%+ test coverage
- ✅ <10ms cache hit time
- ✅ <5s database sync for 1000 rows

### Security Requirements
- ✅ No SQL injection vulnerabilities
- ✅ Input validation on all endpoints
- ✅ Rate limiting on all APIs
- ✅ Secure password handling

### Documentation Requirements
- ✅ API reference complete
- ✅ Deployment guide tested
- ✅ Troubleshooting guide comprehensive
- ✅ Known limitations documented

---

## Timeline Summary

| Phase | Duration | Focus |
|-------|----------|-------|
| Phase 1 | 3 weeks | Critical blockers |
| Phase 2 | 3 weeks | Production quality |
| Phase 3 | 3 weeks | Enterprise grade |
| **TOTAL** | **9 weeks** | **Full production ready** |

---

## Next Steps

1. ✅ Review this plan
2. ✅ Approve for implementation
3. ✅ Begin Phase 1.1 (Register MCP tools)
4. ✅ Daily progress updates
5. ✅ Weekly milestone reviews

**Let's build enterprise-grade software! 🚀**

---

**Document Version**: 1.0
**Created**: 2025-11-06
**Status**: Active Implementation
