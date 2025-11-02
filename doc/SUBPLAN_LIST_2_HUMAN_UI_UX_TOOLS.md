# List 2: Human UI/UX Exploration - Detailed Implementation Subplan

**Version**: 1.0.0
**Date**: 2025-11-02
**Status**: Implementation Ready
**Total Tools**: 5 (2 High Priority, 2 Medium Priority, 1 Low Priority)

---

## Overview

This subplan details the implementation of 5 Human UI/UX tools that provide interactive web interfaces for exploring TrinityCore data, debugging bot AI, and simulating game mechanics.

**Estimated Timeline**: 2-3 weeks for all 5 tools
**Total Lines of Code**: ~7,000 lines (enterprise-grade)
**Quality Standard**: Zero shortcuts, production-ready, React + TypeScript + Next.js

---

## Tool 1: Bot Behavior Debugger & Replay System

**Backend File**: `src/tools/botdebugger.ts`
**Frontend Directory**: `trinitycore-web-ui/app/bot-debugger/`
**Priority**: HIGH
**Estimated Lines**: ~2,000 lines (800 backend + 1,200 frontend)
**Implementation Time**: 5-6 days

### Features to Implement

#### 1.1 Live Bot State Inspector
- Real-time bot state query system
- WebSocket connection for live updates
- Bot selection and filtering

#### 1.2 Decision Timeline Recorder
- Record last N seconds of AI decisions
- Store decision reasons and outcomes
- Track state changes over time

#### 1.3 Action Replay Engine
- Step-by-step replay of bot actions
- Rewind and fast-forward controls
- Hypothetical "what-if" scenario testing

#### 1.4 Multi-Bot Comparator
- Side-by-side bot state comparison
- Diff highlighting for state differences
- Performance metric comparison

#### 1.5 State Breakpoint System
- Set conditional breakpoints on bot state
- Pause when conditions met
- Alert notifications

#### 1.6 Bug Report Exporter
- Export full bot state as JSON
- Include decision timeline
- Attach fix suggestions

### Data Structures

```typescript
// Backend
interface BotState {
  botId: string;
  name: string;
  class: string;
  level: number;

  // Current state
  hp: { current: number; max: number };
  mana: { current: number; max: number };
  target: { guid: string; name: string; hp: number; maxHp: number } | null;
  position: { x: number; y: number; z: number; map: string };
  combatState: 'IN_COMBAT' | 'NOT_IN_COMBAT';
  currentAction: string;

  // AI state
  currentGoal: string;
  decisionTree: string;
  cooldowns: Array<{spell: string; remaining: number}>;
  buffs: Array<{spell: string; duration: number}>;
  debuffs: Array<{spell: string; duration: number}>;
}

interface DecisionEntry {
  timestamp: number; // Unix timestamp in ms
  type: 'decision' | 'action' | 'result' | 'event';
  description: string;
  state: Partial<BotState>; // State at this moment
  success?: boolean;
  reason?: string;
}

interface BotTimeline {
  botId: string;
  startTime: number;
  endTime: number;
  entries: DecisionEntry[];
  bugDetected?: {
    time: number;
    description: string;
    rootCause: string;
  };
}

interface StateBreakpoint {
  id: string;
  condition: string; // e.g., "hp < 20 && !hasBuff('Renew')"
  action: 'pause' | 'alert' | 'log';
  enabled: boolean;
}
```

### Backend Implementation Steps

1. **Bot State Query API** (200 lines)
   - Query worldserver for bot data
   - Parse bot internal state
   - WebSocket push for live updates

2. **Decision Timeline Recorder** (250 lines)
   - Hook into bot AI decision points
   - Store last 60 seconds in circular buffer
   - Timestamp and state tracking

3. **Replay Engine** (200 lines)
   - Load timeline from storage
   - Step-by-step playback
   - State diff calculation

4. **Breakpoint Evaluator** (150 lines)
   - Parse breakpoint conditions
   - Evaluate against bot state
   - Trigger actions (pause/alert)

### Frontend Implementation Steps

1. **Bot Inspector UI** (400 lines)
   - Bot selection dropdown
   - Real-time state display
   - Health/mana/position visualization

2. **Decision Timeline Viewer** (350 lines)
   - Scrollable timeline with entries
   - Color-coded by type
   - Expandable details

3. **Replay Controls** (250 lines)
   - Play/pause/step buttons
   - Timeline scrubber
   - Speed control

4. **Multi-Bot Comparator** (200 lines)
   - Side-by-side panels
   - Diff highlighting
   - Metric charts

### MCP Tool Interface

```typescript
export async function getBotState(
  botId: string
): Promise<BotState>;

export async function getBotTimeline(
  botId: string,
  duration: number // seconds
): Promise<BotTimeline>;

export async function setBreakpoint(
  breakpoint: StateBreakpoint
): Promise<{success: boolean; id: string}>;

export async function exportBugReport(
  botId: string,
  timelineId: string
): Promise<{
  json: string;
  summary: string;
}>;
```

---

## Tool 2: Game Mechanics Simulator

**Backend File**: `src/tools/gamesimulator.ts`
**Frontend Directory**: `trinitycore-web-ui/app/simulator/`
**Priority**: HIGH
**Estimated Lines**: ~1,800 lines (700 backend + 1,100 frontend)
**Implementation Time**: 4-5 days

### Features to Implement

#### 2.1 Combat Simulator
- DPS rotation simulation
- Healing throughput calculation
- Tank mitigation formulas

#### 2.2 Spell Damage Calculator
- Base damage calculation
- Stat modifiers (AP, SP, Crit, Haste)
- Talent modifiers
- Buff/debuff effects

#### 2.3 Stat Impact Analyzer
- "What-if" stat changes
- DPS/HPS delta calculation
- Optimal stat allocation

#### 2.4 Comparison Mode
- Side-by-side talent builds
- Gear set comparison
- Rotation comparison

#### 2.5 Result Exporter
- Export to CSV/JSON
- Generate reports
- Share simulation links

### Data Structures

```typescript
interface PlayerStats {
  level: number;
  class: string;
  spec: string;

  // Primary stats
  strength: number;
  agility: number;
  intellect: number;
  stamina: number;
  spirit: number;

  // Secondary stats
  attackPower: number;
  spellPower: number;
  critRating: number;
  hasteRating: number;
  masteryRating: number;
  armorPenetration: number;
}

interface TargetStats {
  level: number;
  type: 'player' | 'creature' | 'boss';
  hp: number;
  armor: number;
  resistances: {
    holy: number;
    fire: number;
    nature: number;
    frost: number;
    shadow: number;
    arcane: number;
  };
}

interface Rotation {
  name: string;
  abilities: Array<{
    spellId: number;
    spellName: string;
    timing: number; // Seconds into rotation
    priority: number;
  }>;
  cycleDuration: number; // Seconds
}

interface SimulationResult {
  totalDamage: number;
  totalHealing: number;
  dps: number;
  hps: number;
  timeToKill: number;

  breakdown: Array<{
    ability: string;
    damage: number;
    casts: number;
    crits: number;
    percentage: number;
  }>;

  recommendations: string[];
}

interface WhatIfScenario {
  name: string;
  statChanges: Partial<PlayerStats>;
  result: SimulationResult;
  delta: {
    dps: number;
    dpsPercent: number;
    timeToKill: number;
  };
}
```

### Backend Implementation Steps

1. **Combat Formula Engine** (250 lines)
   - Damage calculation formulas
   - Crit/hit/miss calculations
   - Armor mitigation
   - Spell resistance

2. **Rotation Simulator** (200 lines)
   - Execute rotation step-by-step
   - Track cooldowns and resources
   - Calculate DPS over time

3. **Stat Modifier Engine** (150 lines)
   - Apply stat bonuses
   - Talent modifiers
   - Buff/debuff effects

4. **What-If Analyzer** (100 lines)
   - Run multiple simulations
   - Compare results
   - Calculate deltas

### Frontend Implementation Steps

1. **Setup Form** (300 lines)
   - Player stats input
   - Target stats input
   - Rotation builder

2. **Results Display** (350 lines)
   - DPS/HPS charts
   - Damage breakdown table
   - Timeline graph

3. **What-If Interface** (250 lines)
   - Scenario creation
   - Comparison table
   - Delta visualization

4. **Export UI** (200 lines)
   - CSV/JSON download
   - Report generation
   - Share link creation

### MCP Tool Interface

```typescript
export async function simulateCombat(options: {
  playerStats: PlayerStats;
  targetStats: TargetStats;
  rotation: Rotation;
  duration: number; // seconds
  buffs?: string[];
  debuffs?: string[];
}): Promise<SimulationResult>;

export async function analyzeWhatIf(
  baseScenario: SimulationOptions,
  scenarios: WhatIfScenario[]
): Promise<{
  base: SimulationResult;
  scenarios: Array<WhatIfScenario & {result: SimulationResult}>;
  best: string; // scenario name
}>;
```

---

## Tool 3: Visual AI Behavior Tree Editor

**Backend File**: `src/tools/behaviortree.ts`
**Frontend Directory**: `trinitycore-web-ui/app/behavior-editor/`
**Priority**: MEDIUM
**Estimated Lines**: ~1,600 lines (400 backend + 1,200 frontend)
**Implementation Time**: 4-5 days

### Features to Implement

#### 3.1 Drag-and-Drop Canvas
- Node library (conditions, actions, transitions)
- Visual flowchart editor
- Connection validation

#### 3.2 Node Types
- **Condition Nodes**: HP checks, mana checks, target checks
- **Action Nodes**: Cast spell, move, drink potion
- **Transition Nodes**: Decision branching

#### 3.3 Live Preview
- Simulate behavior with test inputs
- Step-by-step execution
- State visualization

#### 3.4 Debug Mode
- Breakpoints on nodes
- Step through execution
- Variable inspection

#### 3.5 C++ Code Generator
- Export to BotAI.cpp format
- Generate UpdateAI() method
- Include proper TrinityCore patterns

#### 3.6 Pattern Library
- Pre-built templates (healer, tank, DPS)
- Save custom patterns
- Share patterns

### Data Structures

```typescript
interface BehaviorNode {
  id: string;
  type: 'condition' | 'action' | 'transition';
  x: number;
  y: number;

  // Node-specific data
  data: ConditionData | ActionData | TransitionData;

  // Connections
  inputs: string[]; // Node IDs
  outputs: string[]; // Node IDs
}

interface ConditionData {
  conditionType: 'hp' | 'mana' | 'target' | 'buff' | 'cooldown' | 'custom';
  operator: '<' | '>' | '==' | '!=' | '<=' | '>=';
  value: number | string;
  target?: 'self' | 'ally' | 'enemy';
}

interface ActionData {
  actionType: 'cast' | 'move' | 'drink' | 'follow' | 'custom';
  spellId?: number;
  target?: string;
  code?: string; // Custom C++ code
}

interface TransitionData {
  label: string;
  trueOutput: string; // Node ID
  falseOutput: string; // Node ID
}

interface BehaviorTree {
  id: string;
  name: string;
  description: string;
  rootNode: string; // Node ID
  nodes: BehaviorNode[];
  metadata: {
    class?: string;
    spec?: string;
    role?: 'healer' | 'tank' | 'dps';
  };
}

interface SimulationState {
  currentNode: string;
  variables: Map<string, any>;
  stepCount: number;
  output: string[];
}
```

### Backend Implementation Steps

1. **Tree Validator** (100 lines)
   - Check for cycles
   - Validate connections
   - Ensure reachability

2. **Simulation Engine** (150 lines)
   - Execute tree with test inputs
   - Track state changes
   - Generate output log

3. **C++ Code Generator** (150 lines)
   - Convert tree to C++ code
   - Generate UpdateAI() method
   - Include TrinityCore patterns

### Frontend Implementation Steps

1. **Canvas Editor** (500 lines)
   - React Flow integration
   - Drag-and-drop nodes
   - Connection drawing

2. **Node Property Panels** (300 lines)
   - Condition editor
   - Action editor
   - Transition editor

3. **Live Preview** (250 lines)
   - Test input form
   - Step-by-step execution
   - Output console

4. **Export UI** (150 lines)
   - C++ code preview
   - Copy/download
   - Pattern library

### MCP Tool Interface

```typescript
export async function validateBehaviorTree(
  tree: BehaviorTree
): Promise<{
  valid: boolean;
  errors: string[];
  warnings: string[];
}>;

export async function simulateBehaviorTree(
  tree: BehaviorTree,
  inputs: Map<string, any>,
  maxSteps: number
): Promise<SimulationState>;

export async function generateCppCode(
  tree: BehaviorTree
): Promise<{
  headerCode: string;
  sourceCode: string;
}>;
```

---

## Tool 4: 3D World Map with Spawn Visualization

**Backend File**: `src/tools/worldmap.ts`
**Frontend Directory**: `trinitycore-web-ui/app/world-map/`
**Priority**: MEDIUM
**Estimated Lines**: ~1,500 lines (300 backend + 1,200 frontend)
**Implementation Time**: 4-5 days

### Features to Implement

#### 4.1 3D Map Renderer
- Three.js for 3D rendering
- Terrain elevation from heightmap
- Camera controls (WASD, mouse)

#### 4.2 Spawn Overlays
- Creature spawns as markers
- GameObject spawns
- Quest objectives
- NPCs (vendors, quest givers)

#### 4.3 Layer Filtering
- Toggle NPC/vendor/quest/rare layers
- Search and filter
- Custom marker sets

#### 4.4 Heat Maps
- Mob density visualization
- Quest concentration
- Danger zones

#### 4.5 Path Visualization
- Bot patrol paths
- Quest routes
- Flight paths

#### 4.6 Spawn Inspector
- Click spawn for details
- View loot table
- View scripts

### Data Structures

```typescript
interface WorldMap {
  mapId: number;
  name: string;
  heightmap: number[][]; // 2D array of elevations
  bounds: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  };
}

interface SpawnMarker {
  id: number;
  type: 'creature' | 'gameobject' | 'quest' | 'npc';
  position: { x: number; y: number; z: number };
  entry: number;
  name: string;
  subtype?: string; // 'vendor', 'quest_giver', 'rare', etc.
}

interface HeatmapData {
  type: 'mob_density' | 'quest_concentration' | 'danger';
  grid: number[][]; // 2D grid of intensity values
  max: number;
}

interface PathData {
  type: 'patrol' | 'quest' | 'flight';
  points: Array<{x: number; y: number; z: number}>;
  color: string;
}

interface SpawnDetails {
  entry: number;
  name: string;
  type: string;
  level: number;
  rank?: string; // 'elite', 'rare', 'boss'
  respawnTime: number;
  loot: Array<{itemId: number; name: string; chance: number}>;
  scripts: string[];
}
```

### Backend Implementation Steps

1. **Map Data API** (100 lines)
   - Load heightmap from database/files
   - Query spawn data
   - Filter by zone/type

2. **Heatmap Generator** (100 lines)
   - Calculate mob density
   - Calculate quest concentration
   - Generate danger zones

3. **Path Query** (100 lines)
   - Load patrol paths
   - Load quest routes
   - Load flight paths

### Frontend Implementation Steps

1. **3D Renderer** (500 lines)
   - Three.js setup
   - Terrain mesh generation
   - Camera controls

2. **Marker System** (300 lines)
   - Spawn marker rendering
   - Icon sprites
   - Filtering UI

3. **Heatmap Overlay** (200 lines)
   - Heatmap rendering
   - Color gradients
   - Toggle controls

4. **Spawn Inspector** (200 lines)
   - Click detection
   - Details panel
   - Loot table display

### MCP Tool Interface

```typescript
export async function getWorldMapData(
  mapId: number
): Promise<WorldMap>;

export async function getSpawnMarkers(
  mapId: number,
  types?: string[]
): Promise<SpawnMarker[]>;

export async function getHeatmap(
  mapId: number,
  type: 'mob_density' | 'quest_concentration' | 'danger'
): Promise<HeatmapData>;

export async function getSpawnDetails(
  spawnId: number,
  type: 'creature' | 'gameobject'
): Promise<SpawnDetails>;
```

---

## Tool 5: Visual Database Query Builder

**Backend File**: `src/tools/querybuilder.ts`
**Frontend Directory**: `trinitycore-web-ui/app/query-builder/`
**Priority**: LOW
**Estimated Lines**: ~1,100 lines (300 backend + 800 frontend)
**Implementation Time**: 3-4 days

### Features to Implement

#### 5.1 Table Selection UI
- Browse database tables
- Drag tables to canvas
- Auto-detect relationships

#### 5.2 Relationship Manager
- Foreign key detection
- Auto-suggest JOINs
- Visual relationship lines

#### 5.3 Filter Builder
- Drag-and-drop conditions
- Visual condition builder
- Preview results

#### 5.4 Column Selector
- Multi-select columns
- Aggregate functions (COUNT, SUM, AVG)
- Aliases

#### 5.5 SQL Generator
- Generate optimized SQL
- Syntax highlighting
- Explain query plan

#### 5.6 Template System
- Save common queries
- Share templates
- Template library

### Data Structures

```typescript
interface DatabaseTable {
  database: 'world' | 'auth' | 'characters';
  name: string;
  columns: Array<{
    name: string;
    type: string;
    nullable: boolean;
    key?: 'PRI' | 'UNI' | 'MUL';
  }>;
  foreignKeys: Array<{
    column: string;
    referencedTable: string;
    referencedColumn: string;
  }>;
}

interface QueryCanvas {
  tables: Array<{
    id: string;
    table: DatabaseTable;
    x: number;
    y: number;
    alias?: string;
  }>;
  joins: Array<{
    leftTable: string;
    leftColumn: string;
    rightTable: string;
    rightColumn: string;
    type: 'INNER' | 'LEFT' | 'RIGHT';
  }>;
}

interface QueryFilter {
  column: string;
  operator: '=' | '!=' | '>' | '<' | '>=' | '<=' | 'LIKE' | 'IN';
  value: string | number | string[];
  logicalOp?: 'AND' | 'OR';
}

interface QueryDefinition {
  tables: string[];
  joins: QueryCanvas['joins'];
  columns: Array<{
    table: string;
    column: string;
    alias?: string;
    aggregateFunction?: 'COUNT' | 'SUM' | 'AVG' | 'MIN' | 'MAX';
  }>;
  filters: QueryFilter[];
  groupBy?: string[];
  orderBy?: Array<{column: string; direction: 'ASC' | 'DESC'}>;
  limit?: number;
}

interface QueryResult {
  sql: string;
  rows: any[];
  rowCount: number;
  executionTime: number;
}
```

### Backend Implementation Steps

1. **Table Metadata API** (100 lines)
   - Load table schemas
   - Detect foreign keys
   - Suggest joins

2. **SQL Generator** (150 lines)
   - Build SQL from QueryDefinition
   - Optimize query
   - Validate syntax

3. **Query Executor** (50 lines)
   - Execute generated SQL
   - Return results
   - Handle errors

### Frontend Implementation Steps

1. **Table Canvas** (300 lines)
   - Drag-and-drop tables
   - Visual relationships
   - Join configuration

2. **Filter Builder** (250 lines)
   - Condition creation
   - Logical operators
   - Preview panel

3. **Column Selector** (150 lines)
   - Multi-select UI
   - Aggregate functions
   - Alias input

4. **SQL Preview** (100 lines)
   - Generated SQL display
   - Syntax highlighting
   - Copy button

### MCP Tool Interface

```typescript
export async function getTableMetadata(
  database: 'world' | 'auth' | 'characters',
  tableName: string
): Promise<DatabaseTable>;

export async function suggestJoins(
  tables: string[]
): Promise<QueryCanvas['joins']>;

export async function generateSQL(
  query: QueryDefinition
): Promise<string>;

export async function executeQuery(
  query: QueryDefinition,
  limit?: number
): Promise<QueryResult>;
```

---

## Implementation Order

### Phase 1: High Priority Tools (Week 1-2)
1. **Bot Behavior Debugger** (Days 1-6)
2. **Game Mechanics Simulator** (Days 7-11)

### Phase 2: Medium Priority Tools (Week 2-3)
3. **Visual AI Behavior Tree Editor** (Days 12-16)
4. **3D World Map** (Days 17-21)

### Phase 3: Low Priority Tool (Week 3)
5. **Visual Query Builder** (Days 22-25)

### Phase 4: Integration & Testing (Week 3)
- Add MCP tool handlers to `src/index.ts`
- Add frontend routes to `trinitycore-web-ui/app/`
- Test each tool with real data
- Fix edge cases and bugs
- Documentation and examples

---

## Quality Standards

### Code Quality Requirements
- ✅ Zero TODOs or placeholders
- ✅ Comprehensive error handling
- ✅ TypeScript strict mode compliance
- ✅ React best practices (hooks, suspense)
- ✅ Responsive design (mobile-friendly)
- ✅ Accessibility (WCAG 2.1 AA)
- ✅ Performance: <100ms for UI interactions

### Testing Requirements
- Test with real TrinityCore database
- Test with live worldserver (for bot debugger)
- Verify UI responsiveness
- Cross-browser testing (Chrome, Firefox, Safari)
- Mobile device testing

---

## Dependencies

### NPM Packages Required (Backend)
```json
{
  "ws": "^8.0.0",
  "three": "^0.160.0"
}
```

### NPM Packages Required (Frontend)
```json
{
  "react-flow-renderer": "^10.0.0",
  "three": "^0.160.0",
  "@react-three/fiber": "^8.0.0",
  "@react-three/drei": "^9.0.0",
  "recharts": "^2.0.0",
  "monaco-editor": "^0.45.0",
  "@monaco-editor/react": "^4.6.0"
}
```

---

## Success Metrics

**Bot Behavior Debugger**:
- Reduce debugging time from 2 hours to 5 minutes
- Capture 100% of AI decisions in timeline
- Export bug reports with 95%+ useful information

**Game Mechanics Simulator**:
- Accuracy within 5% of in-game results
- Simulate 1000 combat cycles in <2 seconds
- Support all 13 classes and specs

**Visual Behavior Tree Editor**:
- Generate valid C++ code 100% of the time
- Reduce AI design time by 70%
- Support non-programmers

**3D World Map**:
- Render 10,000+ spawns smoothly (60 FPS)
- Accurate heightmap visualization
- Click-to-inspect latency <50ms

**Visual Query Builder**:
- Generate valid SQL 100% of the time
- Support complex queries (joins, aggregates, subqueries)
- Reduce query building time by 90%

---

**End of List 2 Subplan**

🤖 Generated with [Claude Code](https://claude.com/claude-code)
