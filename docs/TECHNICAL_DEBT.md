# TrinityCore MCP - Technical Debt Registry

**Last Updated**: 2025-11-06
**Version**: 2.9.0
**Status**: 🔴 Critical Technical Debt Present

---

## Purpose

This document catalogs all **simplifications**, **stubs**, **placeholders**, and **TODOs** found in the codebase. Each item includes:
- Location (file + line)
- Type (stub, simplification, placeholder, todo)
- Current implementation
- Required proper implementation
- Estimated effort
- Priority level

---

## Summary Statistics

| Category | Count | Critical | High | Medium | Low |
|----------|-------|----------|------|--------|-----|
| **Stub Implementations** | 8 | 4 | 3 | 1 | 0 |
| **TODO Comments** | 42 | 12 | 20 | 8 | 2 |
| **Simplifications** | 15 | 2 | 8 | 5 | 0 |
| **Missing Features** | 26 | 26 | 0 | 0 | 0 |
| **Type Safety Issues** | 70+ | 0 | 5 | 65 | 0 |
| **Performance Issues** | 8 | 0 | 3 | 5 | 0 |
| **TOTAL** | **169+** | **44** | **39** | **84** | **2** |

---

## 1. Stub Implementations

### STUB-001: VMap Line-of-Sight (CRITICAL)

**File**: `src/tools/vmap-tools.ts`
**Lines**: 213-225
**Priority**: 🔴 CRITICAL
**Estimated Effort**: 3-5 days

**Current Implementation**:
```typescript
export async function testLineOfSight(options: RaycastOptions): Promise<RaycastResult> {
  // TODO: Load VMap data and perform actual raycast
  console.log(`[VMap] Line-of-sight test: ...`);

  return {
    clear: true,  // ALWAYS RETURNS TRUE
    hitPoint: null,
    distance: Math.sqrt(dx*dx + dy*dy + dz*dz)
  };
}
```

**Problem**:
- Always returns `clear: true` regardless of terrain
- Doesn't load VMap binary files (`.vmtree`, `.vmtile`)
- No actual collision detection

**Required Implementation**:
1. Load VMap binary files from `VMAP_PATH`
2. Parse `.vmtree` file for spatial tree structure
3. Load relevant `.vmtile` files for map tiles
4. Implement ray-triangle intersection algorithm
5. Return actual collision point if hit

**Dependencies**:
- Binary file parser for VMap format
- Spatial data structure (BVH/octree)
- Ray-triangle intersection math

**Test Requirements**:
- Unit tests with known collision scenarios
- Integration test with real game map files
- Performance test (<10ms per raycast)

---

### STUB-002: VMap Spatial Query (CRITICAL)

**File**: `src/tools/vmap-tools.ts`
**Lines**: 247-257
**Priority**: 🔴 CRITICAL
**Estimated Effort**: 2-3 days

**Current Implementation**:
```typescript
export async function findSpawnsInRadius(options: SpawnQueryOptions): Promise<SpawnQueryResult> {
  // TODO: Load VMap data and perform spatial query
  return {
    spawns: [],  // ALWAYS RETURNS EMPTY
    count: 0
  };
}
```

**Problem**:
- Always returns empty results
- Doesn't query database or VMap data
- No radius search implementation

**Required Implementation**:
1. Query `creature` table for spawns in map
2. Load VMap data for collision filtering
3. Implement spatial query (sphere vs AABB test)
4. Filter spawns by LOS if requested
5. Return valid spawn points

**Dependencies**:
- Database connection to `world.creature`
- VMap data loading (from STUB-001)
- Spatial query algorithms

---

### STUB-003: MMap Pathfinding (CRITICAL)

**File**: `src/tools/mmap-tools.ts`
**Lines**: 214-235
**Priority**: 🔴 CRITICAL
**Estimated Effort**: 5-7 days

**Current Implementation**:
```typescript
export async function findPath(options: PathfindingOptions): Promise<PathResult> {
  // TODO: Load MMap data and perform actual A* pathfinding

  // PLACEHOLDER: Return straight line
  return {
    found: true,
    path: [
      { x: startX, y: startY, z: startZ },
      { x: goalX, y: goalY, z: goalZ }
    ],
    distance,
    smoothed: false
  };
}
```

**Problem**:
- Returns straight-line path ignoring terrain
- Doesn't load MMap navigation mesh
- No A* pathfinding implementation

**Required Implementation**:
1. Load MMap files (`.mmap` header, `.mmtile` tiles)
2. Parse Recast navigation mesh format
3. Implement A* pathfinding on navmesh
4. Path smoothing with string pulling
5. Return actual walkable path

**Dependencies**:
- MMap binary file parser
- Recast/Detour navigation mesh library
- A* pathfinding algorithm
- Path smoothing algorithm

**Test Requirements**:
- Unit tests with known paths
- Integration test with real game map
- Performance test (<50ms for 100-unit path)

**Recommended Libraries**:
- `recast-detour` npm package (if compatible with TrinityCore format)
- Or port from TrinityCore C++: `src/server/game/Movement/PathGenerator.cpp`

---

### STUB-004: MMap NavMesh Query (CRITICAL)

**File**: `src/tools/mmap-tools.ts`
**Lines**: 250-260
**Priority**: 🔴 CRITICAL
**Estimated Effort**: 2-3 days

**Current Implementation**:
```typescript
export async function isOnNavMesh(options: NavMeshQueryOptions): Promise<NavMeshQueryResult> {
  // TODO: Load MMap data and perform navmesh query
  return {
    onNavMesh: true,  // ALWAYS RETURNS TRUE
    nearestPoint: { x: posX, y: posY, z: posZ }
  };
}
```

**Problem**:
- Always returns true
- Doesn't check actual navmesh
- Returns input position as nearest point

**Required Implementation**:
1. Load MMap data for tile containing position
2. Query navmesh for point containment
3. Find nearest navmesh position if not on mesh
4. Return actual result with distance to mesh

**Dependencies**:
- MMap data loading (from STUB-003)
- Point-in-polygon test on navmesh
- Nearest point on mesh algorithm

---

### STUB-005: Workflow API (HIGH)

**File**: `web-ui/app/api/workflow/route.ts`
**Lines**: 92, 118, 174
**Priority**: 🟡 HIGH
**Estimated Effort**: 1-2 days

**Current Implementation**:
```typescript
// Line 92: GET endpoint
// TODO: Call MCP tool to get actual status
const mockWorkflows = [ /* mock data */ ];

// Line 118: POST endpoint
// TODO: Call MCP tool to execute workflow
return NextResponse.json({ executionId: "exec-" + Date.now() });

// Line 174: POST command endpoint
// TODO: Call MCP tool to execute command
return NextResponse.json({ output: "Mock command output" });
```

**Problem**:
- Returns fake workflow data
- Doesn't execute actual workflows
- No MCP tool integration

**Required Implementation**:
1. Import MCP client from `@modelcontextprotocol/sdk`
2. Connect to MCP server
3. Call actual workflow tools
4. Return real execution results

**Dependencies**:
- MCP client library
- Workflow tools must be registered in MCP

---

### STUB-006: Profiler API (HIGH)

**File**: `web-ui/app/api/profiler/route.ts`
**Lines**: 60, 115, 148
**Priority**: 🟡 HIGH
**Estimated Effort**: 1-2 days

**Current Implementation**:
```typescript
// Line 60: GET /api/profiler/data
// TODO: Call MCP tool to get actual data
return NextResponse.json({ data: mockProfilingData });

// Line 115: POST /api/profiler/explain
// TODO: Call MCP tool to get actual EXPLAIN data
return NextResponse.json({ plan: mockQueryPlan });

// Line 148: GET /api/profiler/metrics
// TODO: Call MCP tool to get actual metrics
return NextResponse.json({ metrics: mockMetrics });
```

**Problem**:
- Returns fake performance data
- No real database profiling
- Mock EXPLAIN plans

**Required Implementation**:
1. Connect to MCP monitoring tools
2. Call actual database profiler
3. Execute real EXPLAIN queries
4. Return actual metrics

---

### STUB-007: Schema API (HIGH)

**File**: `web-ui/app/api/schema/route.ts`
**Lines**: 117, 160, 272, 298, 355
**Priority**: 🟡 HIGH
**Estimated Effort**: 1-2 days

**Current Implementation**:
```typescript
// Multiple endpoints with:
// TODO: Call MCP tool to get actual data
return NextResponse.json({ data: [] });  // Empty or mock data
```

**Problem**:
- Returns empty schema data
- No database connection
- Can't explore real schema

**Required Implementation**:
1. Connect to MCP schema tools
2. Call `list-tables`, `get-table-schema`, etc.
3. Return actual database schema
4. Handle errors gracefully

---

### STUB-008: Behavior Tree Execution (MEDIUM)

**File**: `src/tools/behaviortree.ts`
**Lines**: 197
**Priority**: 🟢 MEDIUM
**Estimated Effort**: 3-5 days

**Current Implementation**:
```typescript
private async execute(node: BehaviorTreeNode, context: ExecutionContext): Promise<NodeStatus> {
  // TODO: Implement node execution
  return "success";
}
```

**Problem**:
- Always returns success
- Doesn't execute node logic
- Behavior trees don't work

**Required Implementation**:
1. Implement node type execution:
   - Sequence: Run children in order until failure
   - Selector: Run children until success
   - Action: Execute action and return result
   - Condition: Evaluate condition
2. Handle context state
3. Support async execution
4. Add timeout handling

---

## 2. TODO Comments (Production Code)

### Category: VMap/MMap (CRITICAL)

| ID | File | Line | Description | Effort | Priority |
|----|------|------|-------------|--------|----------|
| TODO-001 | vmap-tools.ts | 213 | Load VMap data and perform actual raycast | 3-5d | 🔴 CRITICAL |
| TODO-002 | vmap-tools.ts | 247 | Load VMap data and perform spatial query | 2-3d | 🔴 CRITICAL |
| TODO-003 | mmap-tools.ts | 214 | Load MMap data and perform A* pathfinding | 5-7d | 🔴 CRITICAL |
| TODO-004 | mmap-tools.ts | 250 | Load MMap data and perform navmesh query | 2-3d | 🔴 CRITICAL |

**Total Effort**: 12-18 days
**Blocking**: Yes - Core functionality

---

### Category: Data Loading (HIGH)

| ID | File | Line | Description | Effort | Priority |
|----|------|------|-------------|--------|----------|
| TODO-005 | cooldown-tracker.ts | 465 | Implement MCP integration to query spell_template | 0.5d | 🟡 HIGH |
| TODO-006 | cooldown-tracker.ts | 467 | Load from spell_template instead of hardcoded | 0.5d | 🟡 HIGH |
| TODO-007 | cooldown-tracker.ts | 368 | Calculate average usage delay | 1d | 🟡 HIGH |

**Total Effort**: 2 days
**Blocking**: No, but affects data accuracy

---

### Category: Combat Analysis (HIGH)

| ID | File | Line | Description | Effort | Priority |
|----|------|------|-------------|--------|----------|
| TODO-008 | botcombatloganalyzer.ts | 506 | Implement suboptimal decisions tracking | 2d | 🟡 HIGH |
| TODO-009 | botcombatloganalyzer.ts | 508 | Parse damage taken from logs | 1d | 🟡 HIGH |
| TODO-010 | botcombatloganalyzer.ts | 608 | Implement cooldown/proc detection | 2d | 🟡 HIGH |
| TODO-011 | combat-mechanics-analyzer.ts | 398 | Track resists in combat events | 1d | 🟡 HIGH |
| TODO-012 | combat-mechanics-analyzer.ts | 508 | Parse position data from enhanced logs | 1d | 🟡 HIGH |
| TODO-013 | combat-mechanics-analyzer.ts | 560 | Parse resource data from enhanced logs | 1d | 🟡 HIGH |

**Total Effort**: 8 days
**Blocking**: No, analysis is incomplete but functional

---

### Category: Code Analysis (MEDIUM)

| ID | File | Line | Description | Effort | Priority |
|----|------|------|-------------|--------|----------|
| TODO-014 | CodeAnalysisEngine.ts | 475 | Extract base classes from signature | 0.5d | 🟢 MEDIUM |
| TODO-015 | CodeAnalysisEngine.ts | 483 | Detect abstract from modifiers | 0.5d | 🟢 MEDIUM |
| TODO-016 | CodeAnalysisEngine.ts | 485 | Detect template parameters | 1d | 🟢 MEDIUM |
| TODO-017 | CodeAnalysisEngine.ts | 590 | Extract access modifier from source | 0.5d | 🟢 MEDIUM |
| TODO-018 | CodeAnalysisEngine.ts | 667 | Extract initializer from signature | 0.5d | 🟢 MEDIUM |
| TODO-019 | CodeAnalysisEngine.ts | 720 | Extract default values from parameters | 0.5d | 🟢 MEDIUM |
| TODO-020 | CodeAnalysisEngine.ts | 761 | Extract line number from source | 0.5d | 🟢 MEDIUM |
| TODO-021 | CodeAnalysisEngine.ts | 777 | Implement proper LOC counting | 1d | 🟢 MEDIUM |
| TODO-022 | CodeAnalysisEngine.ts | 818 | Validate cache entry is still fresh | 0.5d | 🟢 MEDIUM |
| TODO-023 | CodeAnalysisEngine.ts | 830 | Compute file hash for caching | 0.5d | 🟢 MEDIUM |

**Total Effort**: 6 days
**Blocking**: No, but reduces code review quality

---

### Category: Web UI API Integration (CRITICAL)

| ID | File | Line | Description | Effort | Priority |
|----|------|------|-------------|--------|----------|
| TODO-024 | workflow/route.ts | 92 | Call MCP tool to get actual status | 0.5d | 🔴 CRITICAL |
| TODO-025 | workflow/route.ts | 118 | Call MCP tool to execute workflow | 0.5d | 🔴 CRITICAL |
| TODO-026 | workflow/route.ts | 174 | Call MCP tool to execute command | 0.5d | 🔴 CRITICAL |
| TODO-027 | profiler/route.ts | 60 | Call MCP tool to get profiler data | 0.5d | 🔴 CRITICAL |
| TODO-028 | profiler/route.ts | 115 | Call MCP tool to get EXPLAIN data | 0.5d | 🔴 CRITICAL |
| TODO-029 | profiler/route.ts | 148 | Call MCP tool to get metrics | 0.5d | 🔴 CRITICAL |
| TODO-030 | schema/route.ts | 117 | Call MCP tool for table list | 0.5d | 🔴 CRITICAL |
| TODO-031 | schema/route.ts | 160 | Call MCP tool for table schema | 0.5d | 🔴 CRITICAL |
| TODO-032 | schema/route.ts | 272 | Call MCP tool for relationships | 0.5d | 🔴 CRITICAL |
| TODO-033 | schema/route.ts | 298 | Call MCP tool for stats | 0.5d | 🔴 CRITICAL |
| TODO-034 | schema/route.ts | 355 | Call MCP tool to execute query | 0.5d | 🔴 CRITICAL |

**Total Effort**: 5.5 days
**Blocking**: Yes - Web UI is non-functional

---

### Category: Workflow/SAI (MEDIUM)

| ID | File | Line | Description | Effort | Priority |
|----|------|------|-------------|--------|----------|
| TODO-035 | workflow-manager.ts | 319 | Add spell IDs to constants | 0.5d | 🟢 MEDIUM |
| TODO-036 | workflow-manager.ts | 324 | Add event IDs to constants | 0.5d | 🟢 MEDIUM |
| TODO-037 | workflow-manager.ts | 329 | Add text IDs to constants | 0.5d | 🟢 MEDIUM |
| TODO-038 | workflow-manager.ts | 339 | Implement reset logic | 1d | 🟢 MEDIUM |
| TODO-039 | workflow-manager.ts | 344 | Implement combat start logic | 1d | 🟢 MEDIUM |
| TODO-040 | workflow-manager.ts | 349 | Implement death logic | 1d | 🟢 MEDIUM |
| TODO-041 | workflow-manager.ts | 366 | Handle events properly | 1d | 🟢 MEDIUM |

**Total Effort**: 5.5 days
**Blocking**: No, SAI editor partially works

---

### Category: Code Generation (LOW)

| ID | File | Line | Description | Effort | Priority |
|----|------|------|-------------|--------|----------|
| TODO-042 | codegen.ts | 54 | Create C++ template for event handlers | 1d | ⚪ LOW |

**Total Effort**: 1 day
**Blocking**: No, other templates exist

---

## 3. Simplifications

### SIMP-001: Regex-Based C++ Parser (HIGH)

**File**: `src/code-review/CodeAnalysisEngine.ts`
**Lines**: ~450-800
**Priority**: 🟡 HIGH
**Estimated Effort**: 10-15 days

**Current Implementation**:
- Uses regex patterns to extract functions, classes, variables
- Example: `/(?:(?:inline|static|virtual|explicit|friend)\s+)*(?:\w+(?::{2}\w+)*(?:<[^>]+>)?)\s+(\w+)\s*\([^)]*\)/g`

**Problems**:
- Can't handle complex C++ syntax (templates, macros, nested classes)
- Misses context (scope, namespace)
- No semantic understanding
- Fragile - breaks on edge cases

**Proper Implementation**:
1. Use **Clang LibTooling** or **Tree-sitter** for proper C++ parsing
2. Generate full AST (Abstract Syntax Tree)
3. Extract semantic information (types, scopes, references)
4. Cache parsed AST with file hash

**Alternative**:
- Call external service using Clang C++ API
- Or use `tree-sitter-cpp` npm package

**Benefits of Proper Implementation**:
- Accurate analysis of all C++ code
- Support for templates, macros, complex expressions
- Faster (parse once, query multiple times)
- Extensible for more advanced analysis

---

### SIMP-002: Hardcoded Cooldown Database (HIGH)

**File**: `src/tools/cooldown-tracker.ts`
**Lines**: 90-450
**Priority**: 🟡 HIGH
**Estimated Effort**: 1-2 days

**Current Implementation**:
```typescript
const COOLDOWN_DATABASE: Record<number, SpellCooldownInfo> = {
  19574: { baseCooldown: 120000, ... },  // Bestial Wrath
  // ... 100+ more hardcoded entries
};
```

**Problems**:
- Data is static, doesn't reflect database changes
- Limited to ~100 spells
- No support for custom servers
- Requires code update for new spells

**Proper Implementation**:
```typescript
async function getSpellCooldown(spellId: number): Promise<SpellCooldownInfo> {
  // Check cache first (5 minute TTL)
  const cached = cache.get(spellId);
  if (cached) return cached;

  // Query database
  const result = await query(`
    SELECT
      RecoveryTime as baseCooldown,
      CategoryRecoveryTime as categoryCooldown,
      StartRecoveryCategory as category
    FROM spell_template
    WHERE ID = ?
  `, [spellId]);

  // Cache and return
  const info = parseSpellInfo(result);
  cache.set(spellId, info, 300000); // 5 min
  return info;
}
```

**Benefits**:
- Always up-to-date with database
- Supports all spells automatically
- Works with custom servers
- Reduces code maintenance

---

### SIMP-003: Individual Row Inserts (HIGH)

**File**: `src/database/sync-engine.ts`
**Lines**: 480-520
**Priority**: 🟡 HIGH
**Estimated Effort**: 1-2 days

**Current Implementation**:
```typescript
for (const row of toInsert) {
  await this.insertRow(target, table, columns, row);  // N queries
}
```

**Problems**:
- N+1 query problem
- Very slow for large datasets
- Network overhead per row
- Transaction overhead per insert

**Proper Implementation**:
```typescript
async insertRows(db: Connection, table: string, columns: string[], rows: any[][]): Promise<void> {
  const BATCH_SIZE = 1000;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);

    // Build multi-value INSERT
    const placeholders = batch.map(() =>
      `(${columns.map(() => '?').join(',')})`
    ).join(',');

    const query = `INSERT INTO \`${table}\` (\`${columns.join('`,`')}\`) VALUES ${placeholders}`;
    const values = batch.flat();

    await executeQuery(db, query, values);
  }
}
```

**Performance Improvement**:
- Current: 30-60 seconds for 1000 rows
- Optimized: 1-3 seconds for 1000 rows
- **10-20x faster**

---

### SIMP-004: No Binary Export Format (MEDIUM)

**File**: `src/database/export-engine.ts`
**Lines**: 200-250
**Priority**: 🟢 MEDIUM
**Estimated Effort**: 2-3 days

**Current Implementation**:
```typescript
case "binary":
  // Binary format placeholder
  writeStream.write(Buffer.from(JSON.stringify(rows)));
  break;
```

**Problems**:
- "Binary" format is just JSON
- No space savings
- No performance improvement

**Proper Implementation**:
1. Use MessagePack or Protocol Buffers
2. Define schema for each table type
3. Serialize rows to efficient binary format
4. Add compression (LZ4 or Zstandard)

**Benefits**:
- 50-70% size reduction vs JSON
- 2-3x faster parsing
- Maintains type information

---

### SIMP-005: No AST Caching (MEDIUM)

**File**: `src/code-review/CodeAnalysisEngine.ts`
**Lines**: 818-830
**Priority**: 🟢 MEDIUM
**Estimated Effort**: 1-2 days

**Current Implementation**:
```typescript
// TODO: Validate cache entry is still fresh
if (cached) return cached.analysis;

// Parse again on every request
const analysis = this.parseCode(filePath, content);
```

**Problems**:
- Re-parses file on every code review
- No cache invalidation strategy
- Slow for large files

**Proper Implementation**:
```typescript
interface CacheEntry {
  fileHash: string;
  mtime: number;
  analysis: CodeAnalysis;
}

async getCachedAnalysis(filePath: string): Promise<CodeAnalysis | null> {
  const stats = await fs.stat(filePath);
  const cached = this.cache.get(filePath);

  if (cached && cached.mtime === stats.mtimeMs) {
    // File hasn't changed
    return cached.analysis;
  }

  // File changed or not cached
  const content = await fs.readFile(filePath, 'utf-8');
  const fileHash = crypto.createHash('sha256').update(content).digest('hex');

  if (cached && cached.fileHash === fileHash) {
    // Content is same (mtime changed but content didn't)
    cached.mtime = stats.mtimeMs;
    return cached.analysis;
  }

  return null;  // Need to re-parse
}
```

**Performance Improvement**:
- Current: 2-5 seconds per file
- With caching: <10ms for unchanged files
- **200-500x faster** for repeated reviews

---

## 4. Missing Features (Not Implemented)

### MISSING-001 to MISSING-026: Unregistered MCP Tools

**Priority**: 🔴 CRITICAL
**Total Count**: 26 tools
**Estimated Effort**: 3-5 days

See **PRE_RELEASE_AUDIT_REPORT.md Section 2.1** for complete list.

**Summary**:
- 2 VMap tools
- 2 MMap tools
- 6 Database tools
- 5 SOAP/WebSocket tools
- 5 Testing framework tools
- 5 Configuration manager tools
- 1 Session recorder/player tools

**Required Action**:
Register all tools in `src/index.ts` with proper:
- Tool name
- Description
- Input schema
- Handler function

---

## 5. Type Safety Issues

### TYPE-001: Unsafe Type Casts (MEDIUM)

**Total Count**: 70+ instances
**Priority**: 🟢 MEDIUM (individually), 🟡 HIGH (collectively)
**Estimated Effort**: 2-3 days

**Pattern**:
```typescript
const result = await someFunction() as any;
const error = (e as Error).message;
```

**Problems**:
- Defeats TypeScript's type safety
- Runtime type errors possible
- No IDE autocomplete
- Maintenance issues

**Proper Implementation**:
```typescript
// Instead of: const result = data as any;
// Use type guards:
interface Result {
  success: boolean;
  data?: any;
}

function isResult(obj: unknown): obj is Result {
  return typeof obj === 'object'
    && obj !== null
    && 'success' in obj;
}

const result = await someFunction();
if (isResult(result)) {
  // TypeScript knows result is Result here
  console.log(result.success);
}
```

**Remediation Plan**:
1. Create proper TypeScript interfaces for all API responses
2. Add type guards for runtime type checking
3. Use `unknown` type with narrowing instead of `any`
4. Enable `noImplicitAny` and `strictNullChecks` in tsconfig.json

---

## 6. Performance Issues

### PERF-001: N+1 Query in Database Sync (HIGH)

**Covered in SIMP-003** - See above for details.

---

### PERF-002: No Connection Pooling in Some Tools (MEDIUM)

**File**: Various database tools
**Priority**: 🟢 MEDIUM
**Estimated Effort**: 1 day

**Problem**:
Some tools create new database connections on every request instead of using a pool.

**Solution**:
```typescript
// Create once at startup
const pool = mysql.createPool({
  host: process.env.TRINITY_DB_HOST,
  user: process.env.TRINITY_DB_USER,
  password: process.env.TRINITY_DB_PASSWORD,
  database: process.env.TRINITY_DB_WORLD,
  connectionLimit: 10,
  queueLimit: 0
});

// Reuse for all queries
async function query(sql: string, params: any[]) {
  const connection = await pool.getConnection();
  try {
    const [rows] = await connection.execute(sql, params);
    return rows;
  } finally {
    connection.release();
  }
}
```

---

### PERF-003: No Prepared Statements (MEDIUM)

**File**: Various database tools
**Priority**: 🟢 MEDIUM
**Estimated Effort**: 0.5 days

**Problem**:
Many queries use string concatenation instead of prepared statements.

**Solution**:
```typescript
// Instead of:
const query = `SELECT * FROM creature WHERE entry = ${creatureId}`;

// Use prepared statements:
const query = `SELECT * FROM creature WHERE entry = ?`;
const rows = await connection.execute(query, [creatureId]);
```

**Benefits**:
- SQL injection protection
- Query plan caching (faster)
- Type safety

---

### PERF-004: Large Result Sets Not Streamed (MEDIUM)

**File**: `src/database/export-engine.ts`
**Priority**: 🟢 MEDIUM
**Estimated Effort**: 1-2 days

**Problem**:
Large table exports load all rows into memory before writing.

**Solution**:
```typescript
// Use streaming query
const stream = connection.query(`SELECT * FROM ${table}`).stream();

stream.on('data', (row) => {
  writeStream.write(formatRow(row));
});

stream.on('end', () => {
  writeStream.end();
  resolve();
});
```

**Benefits**:
- Constant memory usage
- Can export tables with millions of rows
- Faster start time (streaming)

---

## 7. Security Issues

### SEC-001: SQL Injection Vulnerability (HIGH)

**File**: Multiple files
**Priority**: 🟡 HIGH
**Estimated Effort**: 1 day

**Problem**:
Some queries use string concatenation with user input.

**Examples**:
```typescript
// VULNERABLE
const query = `SELECT * FROM ${tableName} WHERE id = ${userId}`;
```

**Solution**:
1. NEVER concatenate user input into SQL
2. Always use parameterized queries
3. Validate table names against whitelist
4. Escape identifiers properly

```typescript
// SAFE
const validTables = ['creature', 'gameobject', 'item_template'];
if (!validTables.includes(tableName)) {
  throw new Error('Invalid table name');
}

const query = `SELECT * FROM ?? WHERE id = ?`;
await connection.execute(query, [tableName, userId]);
```

---

### SEC-002: No Rate Limiting on API Routes (MEDIUM)

**File**: Web UI API routes
**Priority**: 🟢 MEDIUM
**Estimated Effort**: 1 day

**Problem**:
API routes have no rate limiting, allowing abuse.

**Solution**:
```typescript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

app.use('/api/', limiter);
```

---

### SEC-003: No Input Validation (MEDIUM)

**File**: API routes and tool inputs
**Priority**: 🟢 MEDIUM
**Estimated Effort**: 2-3 days

**Problem**:
User inputs not validated before use.

**Solution**:
```typescript
import { z } from 'zod';

const spellIdSchema = z.object({
  spellId: z.number().int().positive().max(999999)
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { spellId } = spellIdSchema.parse(body);
    // ... use validated spellId
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    throw error;
  }
}
```

---

## 8. Logging Issues

### LOG-001: console.log in Production (MEDIUM)

**Total Count**: 100+ statements
**Priority**: 🟢 MEDIUM
**Estimated Effort**: 1 day

**Problem**:
- Debug logs in production code
- No log levels
- No log rotation
- Can't filter logs

**Solution**:
```typescript
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

// Replace console.log with:
logger.debug('Debug message');
logger.info('Info message');
logger.warn('Warning message');
logger.error('Error message');
```

---

## 9. Testing Gaps

### TEST-001: No E2E Tests for WebSocket (HIGH)

**Priority**: 🟡 HIGH
**Estimated Effort**: 2-3 days

**Missing Coverage**:
- WebSocket connection lifecycle
- Authentication flow
- Event subscription/filtering
- Rate limiting enforcement
- Heartbeat protocol
- Reconnection logic

**Required Tests**:
```typescript
describe('WebSocket Server E2E', () => {
  it('should accept connections with valid auth', async () => {
    const ws = new WebSocket('ws://localhost:3001');
    ws.send(JSON.stringify({ type: 'auth', token: validToken }));
    const response = await waitForMessage(ws);
    expect(response.type).toBe('auth-success');
  });

  it('should enforce rate limiting', async () => {
    // Send 200 events/sec (over 100 limit)
    // Expect throttling
  });

  // ... more tests
});
```

---

### TEST-002: No Integration Tests for Database Sync (HIGH)

**Priority**: 🟡 HIGH
**Estimated Effort**: 2-3 days

**Missing Coverage**:
- Multi-server synchronization
- Conflict resolution strategies
- Large dataset sync (10,000+ rows)
- Transaction rollback on error
- Foreign key handling

**Required Tests**:
```typescript
describe('Database Sync Integration', () => {
  let sourceDB, targetDB;

  beforeAll(async () => {
    sourceDB = await createTestDatabase('source');
    targetDB = await createTestDatabase('target');
  });

  it('should sync 1000 rows with SOURCE_WINS strategy', async () => {
    // Insert 1000 rows in source
    // Insert conflicting rows in target
    // Run sync with SOURCE_WINS
    // Verify target matches source
  });

  // ... more tests
});
```

---

### TEST-003: No Tests for VMap/MMap Parsers (CRITICAL)

**Priority**: 🔴 CRITICAL
**Estimated Effort**: 3-5 days

**Missing Coverage**:
- Binary file parsing accuracy
- Ray-triangle intersection correctness
- A* pathfinding correctness
- Performance benchmarks

**Required Tests**:
```typescript
describe('VMap Parser', () => {
  it('should parse real .vmtree file', async () => {
    const buffer = await fs.readFile('test-data/0000.vmtree');
    const tree = parseVMapTree(buffer);
    expect(tree.header.magic).toBe('VMAP');
    expect(tree.nodes.length).toBeGreaterThan(0);
  });

  it('should detect collision on known path', async () => {
    // Use map with known collision point
    const result = await testLineOfSight({
      vmapDir: 'test-data/vmaps',
      mapId: 0,
      startX: 100, startY: 100, startZ: 10,
      endX: 200, endY: 200, endZ: 10
    });
    expect(result.clear).toBe(false);
    expect(result.hitPoint).toBeDefined();
  });
});
```

---

## 10. Documentation Gaps

### DOC-001: API Reference Missing (MEDIUM)

**Priority**: 🟢 MEDIUM
**Estimated Effort**: 2-3 days

**Missing**:
- Complete API reference for all MCP tools
- Request/response examples
- Error codes documentation
- Rate limits and quotas

**Required**:
Create `docs/API_REFERENCE.md` with:
- Tool catalog (all 110 tools)
- Input schemas
- Output examples
- Error handling

---

### DOC-002: Deployment Guide Missing (HIGH)

**Priority**: 🟡 HIGH
**Estimated Effort**: 1-2 days

**Missing**:
- Production deployment guide
- Environment setup steps
- Security checklist
- Backup procedures
- Monitoring setup

**Required**:
Create `docs/DEPLOYMENT.md` with:
- Prerequisites
- Step-by-step installation
- Configuration examples
- Troubleshooting guide

---

## Summary of Remediation Effort

### By Priority

| Priority | Count | Total Effort |
|----------|-------|--------------|
| 🔴 CRITICAL | 44 items | 30-45 days |
| 🟡 HIGH | 39 items | 25-35 days |
| 🟢 MEDIUM | 84 items | 20-30 days |
| ⚪ LOW | 2 items | 1-2 days |
| **TOTAL** | **169 items** | **76-112 days** |

### Recommended Phases

**Phase 1 (Critical - 3 weeks)**:
- Register all MCP tools
- Implement VMap/MMap functionality
- Connect web UI to real MCP tools
- Fix hardcoded data issues

**Phase 2 (High - 3 weeks)**:
- Complete all TODOs in production code
- Add comprehensive error handling
- Implement integration tests
- Add proper logging

**Phase 3 (Medium - 3 weeks)**:
- Fix type safety issues
- Performance optimizations
- Security hardening
- Complete documentation

**Total Estimated Time**: 9-12 weeks with 1-2 developers

---

## How to Use This Document

### For Developers

1. Pick items by priority level
2. Create GitHub issues for each item
3. Link to this document for context
4. Update status when fixed
5. Cross-reference with audit report

### For Project Managers

1. Use effort estimates for sprint planning
2. Allocate resources by priority
3. Track progress against phases
4. Set release gates (e.g., "No CRITICAL items for beta")

### For QA/Testers

1. Focus testing on STUB and SIMP items
2. Verify fixes actually work (not just TODO removed)
3. Write regression tests for each fix
4. Performance test SIMP items

---

**Document Version**: 1.0
**Last Updated**: 2025-11-06
**Maintained By**: Development Team
