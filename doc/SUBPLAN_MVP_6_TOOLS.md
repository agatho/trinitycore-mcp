# TrinityCore MCP Server - MVP 6 Tools Implementation Plan

**Version**: 1.0.0
**Date**: 2025-11-02
**Status**: In Progress
**Estimated Completion**: 5-7 days

---

## Executive Summary

This subplan details the implementation of 6 MVP tools for the TrinityCore MCP Server, split into two categories:

**List 1 (AI Agent Development)**: 3 tools
**List 2 (Human Exploration)**: 3 tools

**Total Scope**: ~4,500 lines of enterprise-grade TypeScript code
**Quality Standard**: Zero shortcuts, full implementation, comprehensive error handling

---

## List 1: AI Agent Development Tools

### Tool 1: Database Schema Inspector

**File**: `src/tools/schema.ts`
**MCP Tool Name**: `mcp__trinitycore__get-table-schema`
**Estimated Lines**: 600 lines

#### Requirements
1. Connect to MySQL database (world, auth, characters)
2. Fetch CREATE TABLE statements for any table
3. Parse schema into structured format
4. Return column types, indexes, foreign keys, constraints
5. Support all 3 databases (world, auth, characters)

#### Implementation Details

```typescript
interface TableColumn {
  name: string;
  type: string;
  nullable: boolean;
  default: string | null;
  key: 'PRI' | 'UNI' | 'MUL' | '';
  extra: string; // auto_increment, etc.
}

interface TableIndex {
  name: string;
  columns: string[];
  unique: boolean;
  type: 'BTREE' | 'HASH';
}

interface ForeignKey {
  constraint_name: string;
  column_name: string;
  referenced_table: string;
  referenced_column: string;
  on_delete: string;
  on_update: string;
}

interface TableSchema {
  database: 'world' | 'auth' | 'characters';
  table: string;
  columns: TableColumn[];
  indexes: TableIndex[];
  foreign_keys: ForeignKey[];
  engine: string;
  charset: string;
  collation: string;
  comment: string;
}

async function getTableSchema(
  database: string,
  tableName: string
): Promise<TableSchema>
```

#### Database Queries
1. `SHOW CREATE TABLE {table}` - Get full schema
2. `SHOW COLUMNS FROM {table}` - Get column details
3. `SHOW INDEXES FROM {table}` - Get index details
4. Query `INFORMATION_SCHEMA.KEY_COLUMN_USAGE` for foreign keys

#### Error Handling
- Database connection failures
- Invalid database name
- Table doesn't exist
- Permission denied
- Network timeouts

#### Testing
- Unit tests for schema parsing
- Integration tests with actual TrinityCore databases
- Edge cases: empty tables, large tables (>100 columns)

---

### Tool 2: TrinityCore API Usage Examples

**File**: `src/tools/apiexamples.ts`
**MCP Tool Name**: `mcp__trinitycore__find-api-usage-examples`
**Estimated Lines**: 800 lines

#### Requirements
1. Search TrinityCore source code for method usage
2. Parse C++ code to extract usage patterns
3. Return code snippets with context
4. Support class methods and global functions
5. Rank results by relevance

#### Implementation Details

```typescript
interface APIUsageExample {
  method: string;
  className?: string;
  filePath: string;
  lineNumber: number;
  snippet: string; // 5 lines before/after
  context: 'script' | 'core' | 'playerbot' | 'test';
  callerFunction: string;
  complexity: 'simple' | 'medium' | 'complex';
}

interface UsagePattern {
  pattern: string; // Common usage pattern
  frequency: number;
  examples: APIUsageExample[];
}

async function findAPIUsageExamples(
  methodName: string,
  className?: string,
  maxResults?: number
): Promise<{
  totalFound: number;
  examples: APIUsageExample[];
  patterns: UsagePattern[];
}>
```

#### Search Strategy
1. Use `ripgrep` (rg) for fast code search
2. Search patterns:
   - `ClassName::MethodName(` - exact match
   - `->MethodName(` - pointer calls
   - `.MethodName(` - object calls
3. Parse surrounding context with regex
4. Extract caller function name from context

#### Code Parsing
```typescript
function parseCodeContext(
  filePath: string,
  lineNumber: number
): {
  snippet: string;
  callerFunction: string;
  variables: string[];
  returnType?: string;
}
```

#### Pattern Detection
- Identify common usage patterns
- Group similar usages
- Rank by frequency
- Example: "90% of calls use nullptr as 3rd param"

#### Error Handling
- File read errors
- Invalid regex patterns
- Source code not found
- Too many results (>10,000)

#### Testing
- Search for common methods: `Player::CastSpell`, `Creature::AI`
- Verify snippet extraction accuracy
- Test pattern detection algorithm
- Performance test with 100+ file searches

---

### Tool 3: Compilation Error Parser

**File**: `src/tools/builderrors.ts`
**MCP Tool Name**: `mcp__trinitycore__parse-compilation-errors`
**Estimated Lines**: 900 lines

#### Requirements
1. Parse CMake, GCC, MSVC, Clang error output
2. Extract structured error data
3. Suggest fixes based on error type
4. Link to relevant documentation
5. Support multi-line errors

#### Implementation Details

```typescript
interface CompilationError {
  id: string; // unique error ID
  type: 'error' | 'warning' | 'note';
  severity: 'critical' | 'high' | 'medium' | 'low';
  compiler: 'gcc' | 'clang' | 'msvc' | 'cmake';
  code: string; // error code (e.g., C2065)
  message: string;
  file: string;
  line: number;
  column: number;
  snippet?: string; // code snippet
  suggestion?: string;
  relatedErrors?: string[]; // IDs of related errors
  docsUrl?: string;
}

interface ErrorCategory {
  category: 'linker' | 'syntax' | 'semantic' | 'cmake' | 'include';
  errors: CompilationError[];
  rootCause?: string;
  fixPriority: number;
}

async function parseCompilationErrors(
  buildLog: string
): Promise<{
  totalErrors: number;
  totalWarnings: number;
  errors: CompilationError[];
  categories: ErrorCategory[];
  quickFixes: string[];
}>
```

#### Error Patterns (Regex)

**GCC/Clang**:
```typescript
const GCC_ERROR_PATTERN = /^(.+?):(\d+):(\d+):\s+(error|warning|note):\s+(.+)$/gm;
const GCC_UNDEFINED_REF = /undefined reference to `(.+)'/;
const GCC_NO_SUCH_FILE = /fatal error: (.+): No such file or directory/;
```

**MSVC**:
```typescript
const MSVC_ERROR_PATTERN = /^(.+?)\((\d+)\):\s+(error|warning)\s+([A-Z]\d+):\s+(.+)$/gm;
const MSVC_UNRESOLVED = /unresolved external symbol (.+)/;
```

**CMake**:
```typescript
const CMAKE_ERROR_PATTERN = /CMake Error at (.+?):(\d+)\s+\((.+?)\):/;
const CMAKE_NOT_FOUND = /Could not find (.+)/;
```

#### Suggestion Engine

```typescript
interface ErrorSuggestion {
  errorPattern: RegExp;
  suggestion: string;
  autoFix?: (error: CompilationError) => string;
}

const SUGGESTION_DATABASE: ErrorSuggestion[] = [
  {
    errorPattern: /undefined reference to `(.+)'/,
    suggestion: 'Add missing library to target_link_libraries in CMakeLists.txt',
    autoFix: (error) => {
      const symbol = error.message.match(/`(.+)'/)?.[1];
      return `target_link_libraries(worldserver ${symbol})`;
    }
  },
  {
    errorPattern: /No such file or directory: (.+)/,
    suggestion: 'Add include directory or check file path',
    autoFix: (error) => {
      const file = error.message.match(/: (.+)/)?.[1];
      return `#include "${file}" // Check if path is correct`;
    }
  },
  // ... 50+ more patterns
];
```

#### Error Categorization
1. **Linker Errors**: Missing libraries, undefined symbols
2. **Syntax Errors**: Missing semicolons, brackets
3. **Semantic Errors**: Type mismatches, undefined variables
4. **CMake Errors**: Missing dependencies, configuration issues
5. **Include Errors**: Missing headers, circular dependencies

#### Root Cause Analysis
```typescript
function analyzeRootCause(errors: CompilationError[]): string {
  // If 100+ errors but only 1 file, likely include issue
  if (errors.length > 100 && new Set(errors.map(e => e.file)).size === 1) {
    return 'Likely missing or incorrect #include directive';
  }

  // If all errors are linker, likely CMakeLists.txt issue
  if (errors.every(e => e.category === 'linker')) {
    return 'Likely CMakeLists.txt configuration issue';
  }

  // ... more heuristics
}
```

#### Error Handling
- Invalid build log format
- Extremely large logs (>10MB)
- Unknown compiler output
- Encoding issues (non-UTF8)

#### Testing
- Parse real TrinityCore build logs
- Test all 3 compilers (GCC, Clang, MSVC)
- Test CMake errors
- Verify suggestion accuracy (manual review)

---

## List 2: Human Exploration Tools

### Tool 4: Interactive Data Explorer

**File**: `src/tools/dataexplorer.ts`
**MCP Tool Name**: `mcp__trinitycore__explore-database`
**Estimated Lines**: 1000 lines

#### Requirements
1. Natural language to SQL conversion
2. Execute safe queries against TrinityCore databases
3. Format results for UI display
4. Suggest visualizations based on data type
5. Handle complex queries (JOINs, aggregations)

#### Implementation Details

```typescript
interface ExplorerQuery {
  naturalLanguage: string;
  sql: string;
  parameters: any[];
  estimatedRows: number;
  executionTime?: number;
}

interface ExplorerResult {
  query: ExplorerQuery;
  rows: any[];
  columns: ColumnInfo[];
  rowCount: number;
  visualization: VisualizationSuggestion;
  relatedQueries: string[];
}

interface ColumnInfo {
  name: string;
  type: 'number' | 'string' | 'date' | 'boolean';
  nullable: boolean;
  distinct: number; // count of distinct values
  min?: any;
  max?: any;
  avg?: number; // for numeric
}

interface VisualizationSuggestion {
  type: 'table' | 'chart' | 'map' | 'graph';
  chartType?: 'bar' | 'line' | 'pie' | 'scatter';
  xAxis?: string;
  yAxis?: string;
  groupBy?: string;
}

async function exploreDatabase(
  naturalLanguageQuery: string,
  database?: 'world' | 'auth' | 'characters'
): Promise<ExplorerResult>
```

#### Natural Language Processing

```typescript
interface QueryPattern {
  pattern: RegExp;
  sqlTemplate: string;
  params: string[];
}

const NL_PATTERNS: QueryPattern[] = [
  {
    pattern: /show (?:me )?all (vendors?|trainers?) in (.+)/i,
    sqlTemplate: `
      SELECT c.entry, c.name, c.subname, ct.map, ct.position_x, ct.position_y
      FROM creature_template c
      JOIN creature ct ON c.entry = ct.id1
      WHERE c.npcflag & :npcflag AND ct.map = :mapId
      LIMIT 100
    `,
    params: ['npcflag', 'mapId']
  },
  {
    pattern: /find (items?|weapons?|armor?) (?:with|that have) (.+)/i,
    sqlTemplate: `
      SELECT entry, name, ItemLevel, RequiredLevel, class, subclass
      FROM item_template
      WHERE :condition
      LIMIT 100
    `,
    params: ['condition']
  },
  // ... 20+ more patterns
];
```

#### SQL Safety
```typescript
function validateSQL(sql: string): boolean {
  // Block dangerous operations
  const BLOCKED_KEYWORDS = [
    'DROP', 'DELETE', 'UPDATE', 'INSERT', 'TRUNCATE',
    'ALTER', 'CREATE', 'GRANT', 'REVOKE'
  ];

  const upperSQL = sql.toUpperCase();
  for (const keyword of BLOCKED_KEYWORDS) {
    if (upperSQL.includes(keyword)) {
      throw new Error(`Blocked keyword: ${keyword}`);
    }
  }

  // Max 100 rows
  if (!sql.toUpperCase().includes('LIMIT')) {
    sql += ' LIMIT 100';
  }

  return true;
}
```

#### Visualization Logic
```typescript
function suggestVisualization(
  columns: ColumnInfo[],
  rowCount: number
): VisualizationSuggestion {
  // Geo data? -> Map
  if (columns.some(c => c.name.includes('position_x'))) {
    return { type: 'map' };
  }

  // 2 numeric columns? -> Scatter plot
  const numericCols = columns.filter(c => c.type === 'number');
  if (numericCols.length >= 2) {
    return {
      type: 'chart',
      chartType: 'scatter',
      xAxis: numericCols[0].name,
      yAxis: numericCols[1].name
    };
  }

  // Categorical + numeric? -> Bar chart
  const categoricalCols = columns.filter(c => c.type === 'string' && c.distinct < 20);
  if (categoricalCols.length > 0 && numericCols.length > 0) {
    return {
      type: 'chart',
      chartType: 'bar',
      xAxis: categoricalCols[0].name,
      yAxis: numericCols[0].name
    };
  }

  // Default: table
  return { type: 'table' };
}
```

#### Related Queries
```typescript
function generateRelatedQueries(
  originalQuery: string,
  results: any[]
): string[] {
  const related = [];

  // If found vendors, suggest "show their items"
  if (originalQuery.includes('vendor')) {
    related.push('Show items sold by these vendors');
  }

  // If found creatures, suggest "show their loot"
  if (originalQuery.includes('creature')) {
    related.push('Show loot tables for these creatures');
  }

  // If numeric data, suggest aggregations
  if (results.some(r => typeof r[Object.keys(r)[0]] === 'number')) {
    related.push('Show average/min/max values');
  }

  return related;
}
```

#### Error Handling
- Ambiguous queries
- No results found
- Query timeout (>5 seconds)
- Invalid database name
- SQL injection attempts

#### Testing
- Test 50+ natural language queries
- Verify SQL safety (attempt DROP, DELETE)
- Test visualization suggestions
- Performance test with large result sets

---

### Tool 5: Visual Quest Chain Mapper

**File**: `src/tools/questmapper.ts`
**MCP Tool Name**: `mcp__trinitycore__visualize-quest-chain`
**Estimated Lines**: 700 lines

#### Requirements
1. Fetch quest dependencies (prerequisites, follow-ups)
2. Build directed graph of quest chains
3. Generate Mermaid diagram syntax
4. Support multiple chain formats (tree, graph, flowchart)
5. Highlight critical paths

#### Implementation Details

```typescript
interface QuestNode {
  id: number;
  title: string;
  level: number;
  faction: 'Alliance' | 'Horde' | 'Both';
  type: 'normal' | 'elite' | 'dungeon' | 'raid' | 'daily' | 'weekly';
  requiredLevel: number;
  suggestedPlayers: number;
}

interface QuestEdge {
  from: number; // quest ID
  to: number; // quest ID
  type: 'prerequisite' | 'followup' | 'breadcrumb';
}

interface QuestChain {
  rootQuest: QuestNode;
  nodes: QuestNode[];
  edges: QuestEdge[];
  totalQuests: number;
  estimatedTime: number; // minutes
  xpReward: number;
  goldReward: number;
}

interface QuestDiagram {
  chain: QuestChain;
  mermaidSyntax: string;
  format: 'graph' | 'flowchart' | 'tree';
  criticalPath: number[]; // quest IDs in optimal order
}

async function visualizeQuestChain(
  questId: number,
  maxDepth?: number
): Promise<QuestDiagram>
```

#### Graph Building Algorithm

```typescript
async function buildQuestGraph(
  startQuestId: number,
  maxDepth: number = 10
): Promise<QuestChain> {
  const visited = new Set<number>();
  const nodes: QuestNode[] = [];
  const edges: QuestEdge[] = [];

  async function traverse(questId: number, depth: number) {
    if (depth > maxDepth || visited.has(questId)) return;
    visited.add(questId);

    // Fetch quest data
    const quest = await getQuestInfo(questId);
    nodes.push(quest);

    // Find prerequisites
    const prereqs = await getQuestPrerequisites(questId);
    for (const prereq of prereqs) {
      edges.push({ from: prereq.id, to: questId, type: 'prerequisite' });
      await traverse(prereq.id, depth + 1);
    }

    // Find follow-ups
    const followups = await getQuestFollowups(questId);
    for (const followup of followups) {
      edges.push({ from: questId, to: followup.id, type: 'followup' });
      await traverse(followup.id, depth + 1);
    }

    // Find breadcrumbs
    const breadcrumbs = await getQuestBreadcrumbs(questId);
    for (const breadcrumb of breadcrumbs) {
      edges.push({ from: questId, to: breadcrumb.id, type: 'breadcrumb' });
      await traverse(breadcrumb.id, depth + 1);
    }
  }

  await traverse(startQuestId, 0);

  return {
    rootQuest: nodes.find(n => n.id === startQuestId)!,
    nodes,
    edges,
    totalQuests: nodes.length,
    // ... calculate rewards
  };
}
```

#### Mermaid Diagram Generation

```typescript
function generateMermaidDiagram(chain: QuestChain): string {
  let mermaid = 'graph TD\n';

  // Add nodes
  for (const node of chain.nodes) {
    const shape = getNodeShape(node.type);
    const style = getNodeStyle(node.faction);
    mermaid += `  Q${node.id}${shape}"${node.title} (Lv${node.level})"${shape}\n`;
    mermaid += `  style Q${node.id} ${style}\n`;
  }

  // Add edges
  for (const edge of chain.edges) {
    const arrow = getEdgeArrow(edge.type);
    mermaid += `  Q${edge.from} ${arrow} Q${edge.to}\n`;
  }

  return mermaid;
}

function getNodeShape(type: string): string {
  switch (type) {
    case 'elite': return '[';
    case 'dungeon': return '([';
    case 'raid': return '{{';
    case 'daily': return '[/';
    default: return '[';
  }
}

function getNodeStyle(faction: string): string {
  switch (faction) {
    case 'Alliance': return 'fill:#0078d7,color:#fff';
    case 'Horde': return 'fill:#b30000,color:#fff';
    default: return 'fill:#999,color:#fff';
  }
}

function getEdgeArrow(type: string): string {
  switch (type) {
    case 'prerequisite': return '-->|requires|';
    case 'followup': return '-.->|leads to|';
    case 'breadcrumb': return '==>|breadcrumb|';
    default: return '-->';
  }
}
```

#### Critical Path Algorithm

```typescript
function findCriticalPath(chain: QuestChain): number[] {
  // Topological sort + longest path
  const inDegree = new Map<number, number>();
  const dist = new Map<number, number>();
  const parent = new Map<number, number>();

  // Initialize
  for (const node of chain.nodes) {
    inDegree.set(node.id, 0);
    dist.set(node.id, 0);
  }

  // Calculate in-degrees
  for (const edge of chain.edges) {
    inDegree.set(edge.to, (inDegree.get(edge.to) || 0) + 1);
  }

  // Topological sort with longest path
  const queue: number[] = [];
  for (const [id, degree] of inDegree) {
    if (degree === 0) queue.push(id);
  }

  while (queue.length > 0) {
    const u = queue.shift()!;

    for (const edge of chain.edges.filter(e => e.from === u)) {
      const v = edge.to;

      if (dist.get(u)! + 1 > dist.get(v)!) {
        dist.set(v, dist.get(u)! + 1);
        parent.set(v, u);
      }

      inDegree.set(v, inDegree.get(v)! - 1);
      if (inDegree.get(v) === 0) {
        queue.push(v);
      }
    }
  }

  // Reconstruct path
  let maxDist = 0;
  let endNode = chain.rootQuest.id;
  for (const [id, d] of dist) {
    if (d > maxDist) {
      maxDist = d;
      endNode = id;
    }
  }

  const path: number[] = [];
  let current: number | undefined = endNode;
  while (current !== undefined) {
    path.unshift(current);
    current = parent.get(current);
  }

  return path;
}
```

#### Error Handling
- Quest doesn't exist
- Circular dependencies (detect and break)
- Too many quests (>500 in chain)
- Database connection errors

#### Testing
- Test with simple linear chains (A→B→C)
- Test with branching chains (A→B, A→C)
- Test with circular dependencies
- Test critical path algorithm

---

### Tool 6: Zone Difficulty Calculator

**File**: `src/tools/zonedifficulty.ts`
**MCP Tool Name**: `mcp__trinitycore__analyze-zone-difficulty`
**Estimated Lines**: 600 lines

#### Requirements
1. Calculate average mob level in zone
2. Count elite/boss mobs
3. Calculate quest density
4. Determine recommended player level
5. Identify dangerous areas

#### Implementation Details

```typescript
interface ZoneDifficulty {
  zoneId: number;
  zoneName: string;
  averageMobLevel: number;
  levelRange: [number, number];
  eliteDensity: number; // elites per 100 mobs
  bossDensity: number; // bosses per 100 mobs
  questDensity: number; // quests per square km
  recommendedLevel: number;
  difficulty: 'trivial' | 'easy' | 'medium' | 'hard' | 'extreme';
  dangerousAreas: DangerousArea[];
  safeRoutes: SafeRoute[];
}

interface DangerousArea {
  name: string;
  centerX: number;
  centerY: number;
  radius: number;
  reason: string; // "High elite density", "Boss spawn", etc.
  threatLevel: number; // 1-10
}

interface SafeRoute {
  from: { x: number; y: number };
  to: { x: number; y: number };
  waypoints: { x: number; y: number }[];
  avoidedThreats: string[];
}

async function analyzeZoneDifficulty(
  zoneId: number,
  playerLevel?: number
): Promise<ZoneDifficulty>
```

#### Mob Analysis

```typescript
async function analyzeMobs(zoneId: number): Promise<{
  totalMobs: number;
  averageLevel: number;
  levelRange: [number, number];
  eliteCount: number;
  bossCount: number;
}> {
  const [rows] = await worldDB.execute(`
    SELECT
      ct.entry,
      ct.minlevel,
      ct.maxlevel,
      ct.rank,
      COUNT(c.guid) as spawn_count
    FROM creature_template ct
    JOIN creature c ON ct.entry = c.id1
    WHERE c.map = ?
    GROUP BY ct.entry
  `, [zoneId]);

  let totalMobs = 0;
  let totalLevel = 0;
  let minLevel = 999;
  let maxLevel = 0;
  let eliteCount = 0;
  let bossCount = 0;

  for (const row of rows) {
    const count = row.spawn_count;
    const avgLevel = (row.minlevel + row.maxlevel) / 2;

    totalMobs += count;
    totalLevel += avgLevel * count;
    minLevel = Math.min(minLevel, row.minlevel);
    maxLevel = Math.max(maxLevel, row.maxlevel);

    if (row.rank === 1 || row.rank === 2) { // Elite or Rare Elite
      eliteCount += count;
    }
    if (row.rank === 3) { // Boss
      bossCount += count;
    }
  }

  return {
    totalMobs,
    averageLevel: totalLevel / totalMobs,
    levelRange: [minLevel, maxLevel],
    eliteCount,
    bossCount,
  };
}
```

#### Quest Density

```typescript
async function calculateQuestDensity(zoneId: number): Promise<number> {
  // Get zone area in km²
  const [zoneData] = await worldDB.execute(
    'SELECT AreaId, Exploration FROM exploration_basexp WHERE MapId = ?',
    [zoneId]
  );

  // Estimate area (this is approximate)
  const areaKm2 = estimateZoneArea(zoneId);

  // Count quests
  const [questCount] = await worldDB.execute(`
    SELECT COUNT(DISTINCT q.Id) as quest_count
    FROM quest_template q
    WHERE q.RequiredSkillId = 0 -- Not profession quests
      AND EXISTS (
        SELECT 1 FROM creature c
        JOIN creature_questrelation cq ON c.id1 = cq.id
        WHERE cq.quest = q.Id AND c.map = ?
      )
  `, [zoneId]);

  return questCount[0].quest_count / areaKm2;
}
```

#### Dangerous Area Detection

```typescript
async function findDangerousAreas(zoneId: number): Promise<DangerousArea[]> {
  const dangerousAreas: DangerousArea[] = [];

  // Find high elite density clusters
  const [eliteClusters] = await worldDB.execute(`
    SELECT
      FLOOR(c.position_x / 100) * 100 as grid_x,
      FLOOR(c.position_y / 100) * 100 as grid_y,
      COUNT(*) as elite_count,
      AVG(ct.maxlevel) as avg_level
    FROM creature c
    JOIN creature_template ct ON c.id1 = ct.entry
    WHERE c.map = ? AND ct.rank IN (1, 2, 3)
    GROUP BY grid_x, grid_y
    HAVING elite_count > 5
  `, [zoneId]);

  for (const cluster of eliteClusters) {
    dangerousAreas.push({
      name: `Elite Cluster (${cluster.elite_count} mobs)`,
      centerX: cluster.grid_x + 50,
      centerY: cluster.grid_y + 50,
      radius: 100,
      reason: `High elite density: ${cluster.elite_count} elites, avg level ${Math.round(cluster.avg_level)}`,
      threatLevel: Math.min(10, Math.floor(cluster.elite_count / 2)),
    });
  }

  // Find boss spawn points
  const [bosses] = await worldDB.execute(`
    SELECT
      ct.name,
      c.position_x,
      c.position_y,
      ct.maxlevel
    FROM creature c
    JOIN creature_template ct ON c.id1 = ct.entry
    WHERE c.map = ? AND ct.rank = 3
  `, [zoneId]);

  for (const boss of bosses) {
    dangerousAreas.push({
      name: boss.name,
      centerX: boss.position_x,
      centerY: boss.position_y,
      radius: 50,
      reason: `Boss spawn point (Level ${boss.maxlevel})`,
      threatLevel: 10,
    });
  }

  return dangerousAreas;
}
```

#### Difficulty Rating

```typescript
function calculateDifficultyRating(
  mobAnalysis: any,
  questDensity: number,
  playerLevel: number
): 'trivial' | 'easy' | 'medium' | 'hard' | 'extreme' {
  const levelDiff = mobAnalysis.averageLevel - playerLevel;
  const elitePct = (mobAnalysis.eliteCount / mobAnalysis.totalMobs) * 100;

  let difficultyScore = 0;

  // Level difference factor
  if (levelDiff < -10) difficultyScore += 0; // Trivial
  else if (levelDiff < -5) difficultyScore += 1; // Easy
  else if (levelDiff < 0) difficultyScore += 2; // Medium
  else if (levelDiff < 5) difficultyScore += 3; // Hard
  else difficultyScore += 4; // Extreme

  // Elite density factor
  if (elitePct < 5) difficultyScore += 0;
  else if (elitePct < 15) difficultyScore += 1;
  else if (elitePct < 30) difficultyScore += 2;
  else difficultyScore += 3;

  // Quest density factor (more quests = easier to level)
  if (questDensity > 10) difficultyScore -= 1;
  else if (questDensity < 5) difficultyScore += 1;

  // Map score to difficulty
  if (difficultyScore <= 1) return 'trivial';
  if (difficultyScore <= 3) return 'easy';
  if (difficultyScore <= 5) return 'medium';
  if (difficultyScore <= 7) return 'hard';
  return 'extreme';
}
```

#### Error Handling
- Invalid zone ID
- Zone has no mobs
- Database query timeout
- Division by zero (no mobs)

#### Testing
- Test with starter zones (Elwynn, Durotar)
- Test with high-level zones (Icecrown)
- Test with dungeons
- Verify difficulty calculations

---

## Implementation Timeline

### Day 1: Setup & Tool 1 (Schema Inspector)
- **Hours 1-2**: Database connection setup
  - Create `src/database/connection.ts`
  - Environment variables for DB credentials
  - Connection pooling configuration
  - Test connections to all 3 databases
- **Hours 3-6**: Implement schema.ts
  - SHOW CREATE TABLE parsing
  - Column metadata extraction
  - Index parsing
  - Foreign key detection
- **Hours 7-8**: Testing & documentation
  - Unit tests
  - Integration tests
  - API documentation

### Day 2: Tool 2 (API Usage Examples)
- **Hours 1-3**: Code search implementation
  - ripgrep integration
  - Search pattern generation
  - File reading and context extraction
- **Hours 4-6**: Pattern detection
  - Usage pattern clustering
  - Frequency analysis
  - Ranking algorithm
- **Hours 7-8**: Testing & optimization
  - Performance benchmarks
  - Edge case testing

### Day 3: Tool 3 (Compilation Error Parser)
- **Hours 1-4**: Error pattern matching
  - GCC/Clang regex patterns
  - MSVC regex patterns
  - CMake error parsing
- **Hours 5-7**: Suggestion engine
  - Build suggestion database
  - Auto-fix generation
  - Root cause analysis
- **Hour 8**: Testing with real build logs

### Day 4: Tool 4 (Data Explorer)
- **Hours 1-3**: Natural language processing
  - Query pattern database
  - SQL template system
  - Parameter extraction
- **Hours 4-6**: Query execution & safety
  - SQL injection prevention
  - Query validation
  - Result formatting
- **Hours 7-8**: Visualization suggestions
  - Heuristic algorithms
  - Related query generation

### Day 5: Tool 5 (Quest Chain Mapper)
- **Hours 1-4**: Graph building
  - Quest dependency traversal
  - Edge type detection
  - Circular dependency handling
- **Hours 5-7**: Mermaid generation
  - Diagram syntax generation
  - Node styling
  - Critical path highlighting
- **Hour 8**: Testing with complex chains

### Day 6: Tool 6 (Zone Difficulty)
- **Hours 1-4**: Mob analysis
  - Level range calculation
  - Elite/boss detection
  - Clustering algorithm
- **Hours 5-7**: Difficulty calculation
  - Quest density analysis
  - Dangerous area detection
  - Difficulty rating algorithm
- **Hour 8**: Testing & calibration

### Day 7: Integration & Web UI
- **Hours 1-4**: MCP tool registration
  - Update index.ts with all 6 tools
  - Tool schema definitions
  - Parameter validation
- **Hours 5-8**: Web UI integration
  - Add UI pages for each tool
  - Create interactive visualizations
  - End-to-end testing

---

## Quality Standards Checklist

For each tool, ensure:
- ✅ **Zero Shortcuts**: Full implementation, no TODOs
- ✅ **Error Handling**: Comprehensive try-catch, validation
- ✅ **TypeScript**: Strict typing, no `any` except where necessary
- ✅ **Testing**: Unit + integration tests
- ✅ **Documentation**: JSDoc comments, API docs
- ✅ **Performance**: <100ms for simple queries, <1s for complex
- ✅ **Security**: SQL injection prevention, input validation
- ✅ **Logging**: Structured logging for debugging
- ✅ **Database**: Proper connection pooling, prepared statements
- ✅ **Code Review**: Self-review against CLAUDE.md standards

---

## Dependencies

### New NPM Packages Required
```json
{
  "mysql2": "^3.6.5",
  "ripgrep-js": "^1.0.2",
  "mermaid": "^10.6.1",
  "natural": "^6.8.0",
  "lru-cache": "^10.0.1"
}
```

### Database Configuration
```env
TC_WORLD_DB_HOST=localhost
TC_WORLD_DB_PORT=3306
TC_WORLD_DB_USER=trinity
TC_WORLD_DB_PASSWORD=trinity
TC_WORLD_DB_NAME=world

TC_AUTH_DB_HOST=localhost
TC_AUTH_DB_PORT=3306
TC_AUTH_DB_USER=trinity
TC_AUTH_DB_PASSWORD=trinity
TC_AUTH_DB_NAME=auth

TC_CHARACTERS_DB_HOST=localhost
TC_CHARACTERS_DB_PORT=3306
TC_CHARACTERS_DB_USER=trinity
TC_CHARACTERS_DB_PASSWORD=trinity
TC_CHARACTERS_DB_NAME=characters
```

---

## Success Criteria

### Tool 1: Schema Inspector
- ✅ Can retrieve schema for any table in 3 databases
- ✅ Correctly parses all column types, indexes, foreign keys
- ✅ Handles tables with 100+ columns
- ✅ Response time <200ms

### Tool 2: API Usage Examples
- ✅ Finds 95%+ of actual method usages
- ✅ Extracts accurate code snippets
- ✅ Detects common usage patterns
- ✅ Response time <500ms for common methods

### Tool 3: Compilation Error Parser
- ✅ Parses GCC, Clang, MSVC errors correctly
- ✅ Provides accurate suggestions for 80%+ of errors
- ✅ Categorizes errors correctly
- ✅ Response time <100ms for typical build logs

### Tool 4: Data Explorer
- ✅ Converts 50+ natural language patterns to SQL
- ✅ Executes queries safely (no SQL injection)
- ✅ Suggests appropriate visualizations
- ✅ Response time <1s for most queries

### Tool 5: Quest Chain Mapper
- ✅ Builds complete quest chains (depth 10+)
- ✅ Generates valid Mermaid diagrams
- ✅ Identifies critical paths correctly
- ✅ Response time <500ms for chains with 50 quests

### Tool 6: Zone Difficulty
- ✅ Calculates accurate difficulty ratings
- ✅ Identifies 90%+ of dangerous areas
- ✅ Provides realistic recommended levels
- ✅ Response time <300ms

---

## Risk Mitigation

### Risk 1: Database Connection Issues
**Mitigation**:
- Implement robust connection pooling
- Add retry logic with exponential backoff
- Provide clear error messages
- Test with connection failures

### Risk 2: Performance Degradation
**Mitigation**:
- Implement caching for expensive queries
- Add query timeouts (5 seconds max)
- Use database indexes effectively
- Profile all queries

### Risk 3: Data Inconsistency
**Mitigation**:
- Validate all database results
- Handle NULL values gracefully
- Test with empty/incomplete databases
- Document assumptions

### Risk 4: Code Search Accuracy
**Mitigation**:
- Use multiple search strategies
- Implement fuzzy matching
- Validate regex patterns
- Manual verification of top results

---

## Post-Implementation Tasks

1. **Documentation**
   - Update README.md with new tools
   - Create usage examples for each tool
   - Document database schema requirements

2. **Web UI Integration**
   - Add UI pages for each tool
   - Create interactive visualizations
   - Add tool discovery/search

3. **Performance Optimization**
   - Profile all tools under load
   - Optimize slow queries
   - Implement caching strategy

4. **Monitoring**
   - Add tool usage analytics
   - Track error rates
   - Monitor database load

5. **User Feedback**
   - Collect feedback from AI agents
   - Collect feedback from human users
   - Iterate based on usage patterns

---

## Conclusion

This subplan provides a complete roadmap for implementing 6 MVP tools that will significantly enhance the TrinityCore MCP Server for both AI agent-based development and human exploration. All implementations will follow enterprise-grade quality standards with zero shortcuts.

**Next Step**: Begin implementation of Tool 1 (Database Schema Inspector).
