# TrinityCore MCP Server

[![Build](https://github.com/agatho/trinitycore-mcp/actions/workflows/build.yml/badge.svg)](https://github.com/agatho/trinitycore-mcp/actions/workflows/build.yml)
[![Code Quality](https://github.com/agatho/trinitycore-mcp/actions/workflows/code-quality.yml/badge.svg)](https://github.com/agatho/trinitycore-mcp/actions/workflows/code-quality.yml)
[![Version](https://img.shields.io/badge/version-1.4.0-blue.svg)](https://github.com/agatho/trinitycore-mcp/releases)
[![Phase 5](https://img.shields.io/badge/Phase%205-Complete-success.svg)](doc/PHASE_5_COMPLETE_SUMMARY.md)
[![License](https://img.shields.io/badge/license-GPL--2.0-green.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)
[![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)
[![Tests](https://img.shields.io/badge/tests-12%2F12%20passing-success.svg)](doc/PHASE_5_FINAL_VERIFICATION.md)
[![Issues](https://img.shields.io/github/issues/agatho/trinitycore-mcp)](https://github.com/agatho/trinitycore-mcp/issues)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/agatho/trinitycore-mcp/pulls)
[![API Docs](https://img.shields.io/badge/API%20Docs-3800%2B%20methods-success.svg)](data/api_docs/general/)

> Custom Model Context Protocol server providing **56 enterprise-grade tools** for TrinityCore bot development with World of Warcraft 11.2 (The War Within).

## 🆕 What's New in v1.4.0 - Phase 5 Complete! 🎉

🤖 **AI Enhancement Infrastructure** - Complete AI-powered development platform with knowledge management, code generation, performance analysis, and automated testing

🧪 **Testing Automation** - 3 new MCP tools for test execution, multi-format reporting (JSON/HTML/Markdown/JUnit), and code coverage analysis

📊 **Performance Analysis** - 3 new MCP tools for bot performance monitoring, scaling simulation (100-5000 bots), and AI-powered optimization suggestions

🎓 **Knowledge Base** - 3,756 API documentation files, 250+ stat weight profiles, intelligent code generation with template library

✅ **Production Ready** - 12/12 tests passing, 92.6% performance targets met, enterprise-grade code quality, comprehensive documentation

[See Phase 5 Summary →](doc/PHASE_5_COMPLETE_SUMMARY.md) | [Verification Report →](PHASE_5_FINAL_VERIFICATION.md)


## Features

### Phase 1-3: TrinityCore Knowledge (49 tools)
- **Game Data Queries**: Query spells, items, quests, creatures from World database
- **DBC/DB2 Reading**: Parse and query client-side database files
- **GameTable (GT) Files**: Access critical game calculation tables (combat ratings, XP, stats, scaling)
- **Trinity API Docs**: Access TrinityCore C++ API documentation (3,800+ methods)
- **Talent Optimization**: Recommended talent builds for all specs and purposes
- **Combat Mechanics**: Melee/spell damage calculations, armor mitigation, DPS estimates
- **Buff Optimization**: Optimal buff and consumable recommendations
- **Dungeon/Raid Strategy**: Boss mechanics, pull strategies, loot priorities
- **Economy/Auction House**: Item pricing analysis, market trends, crafting profitability
- **Reputation System**: Optimal reputation grinding paths with time estimates
- **Multi-Bot Coordination**: Raid cooldown coordination, formation management, group synergy
- **PvP Arena/BG Tactician**: Arena composition analysis, battleground strategies, PvP talent builds
- **Quest Route Optimizer**: Optimal quest routing, leveling paths, XP/hour calculations
- **Collection Manager**: Pet/mount/toy tracking, farming routes, completion planning

### Phase 5: AI Enhancement Infrastructure (7 tools) ✨ NEW

#### Knowledge & Code Generation (3 tools)
- **query-trinity-knowledge**: Query TrinityCore API documentation with curated examples and best practices
- **generate-code-from-template**: Generate code from 12+ pre-defined templates with variable substitution
- **validate-generated-code**: Validate generated code with syntax checking and best practices validation

#### Performance Analysis (3 tools)
- **analyze-bot-performance**: Real-time CPU/memory/network metrics collection with statistical analysis, bottleneck detection, and trend analysis
- **simulate-scaling**: Simulate 100-5000 bot scenarios with non-linear scaling models, resource prediction, and hardware recommendations
- **get-optimization-suggestions**: AI-powered optimization suggestions with priority scoring, quick win detection, and implementation guidance

#### Testing Automation (3 tools)
- **run-tests**: Execute tests with parallel/sequential strategies, test filtering, retry logic, and multi-format reporting
- **generate-test-report**: Generate JSON, HTML, Markdown, and JUnit XML reports with summary statistics and failure analysis
- **analyze-coverage**: Code coverage analysis with line coverage tracking, threshold validation, and multi-format reports

## Installation

```bash
cd C:\TrinityBots\trinitycore-mcp
npm install
npm run build
```

## Configuration

Create `.env` file:
```env
TRINITY_DB_HOST=localhost
TRINITY_DB_PORT=3306
TRINITY_DB_USER=trinity
TRINITY_DB_PASSWORD=your_password
TRINITY_ROOT=C:\TrinityBots\TrinityCore
DBC_PATH=C:\TrinityBots\Server\data\dbc
DB2_PATH=C:\TrinityBots\Server\data\db2
MCP_PORT=3000
```

## Usage

### Start Server
```bash
npm start
```

**For detailed configuration instructions, see [MCP_CONFIGURATION.md](MCP_CONFIGURATION.md)**
### Configure in Claude Code

Add to `.claude/mcp-servers-config.json`:
```json
{
  "trinitycore": {
    "command": "node",
    "args": ["C:\\TrinityBots\\trinitycore-mcp\\dist\\index.js"],
    "env": {
      "TRINITY_DB_HOST": "localhost",
      "TRINITY_DB_USER": "trinity",
      "TRINITY_DB_PASSWORD": "${TRINITY_DB_PASSWORD}"
    }
  }
}
```

## Available Tools

**Total: 56 MCP Tools** across 5 development phases

### Phase 1-3: TrinityCore Knowledge Tools (49 tools)

See [Phase 5 Complete Summary](doc/PHASE_5_COMPLETE_SUMMARY.md) for comprehensive tool documentation.

#### Foundation Tools (6 tools)

#### get-spell-info
Get detailed spell information:
```json
{
  "spellId": 1234
}
```

#### get-item-info
Get item data:
```json
{
  "itemId": 5678
}
```

#### get-quest-info
Get quest information:
```json
{
  "questId": 9012
}
```

#### query-dbc
Query DBC file:
```json
{
  "dbcFile": "Spell.dbc",
  "recordId": 1234
}
```

#### get-trinity-api
Get TrinityCore API documentation:
```json
{
  "className": "Player"
}
```

#### get-opcode-info
Get opcode documentation:
```json
{
  "opcode": "CMSG_CAST_SPELL"
}
```

#### Core Systems Tools (7 tools)

#### get-recommended-talent-build
Get optimized talent build for a specialization:
```json
{
  "specId": 71,
  "purpose": "raid",
  "playerLevel": 60
}
```

#### calculate-melee-damage
Calculate expected melee damage output:
```json
{
  "weaponDPS": 150.5,
  "attackSpeed": 2.6,
  "attackPower": 2500,
  "critRating": 1200,
  "level": 60
}
```

#### get-buff-recommendations
Get optimal buff and consumable recommendations:
```json
{
  "classId": 1,
  "specId": 71,
  "activity": "raid",
  "budget": "medium"
}
```

#### get-dungeon-strategy
Get comprehensive dungeon/raid strategy:
```json
{
  "dungeonId": 36,
  "difficulty": "heroic",
  "groupComp": ["tank", "healer", "dps", "dps", "dps"]
}
```

#### analyze-auction-item
Analyze auction house pricing and trends:
```json
{
  "itemId": 172230,
  "realm": "Area-52"
}
```

#### get-reputation-path
Get optimal reputation grinding path:
```json
{
  "factionId": 1134,
  "currentStanding": "friendly",
  "targetStanding": "exalted"
}
```

#### coordinate-cooldowns
Coordinate raid cooldowns across multiple bots:
```json
{
  "bots": [
    {
      "name": "BotTank",
      "classId": 1,
      "role": "tank",
      "cooldowns": [...]
    }
  ],
  "encounterDuration": 300
}
```

#### Advanced Features Tools (8 tools)

#### analyze-arena-composition
Analyze PvP arena team composition:
```json
{
  "bracket": "3v3",
  "team": [
    {
      "classId": 4,
      "className": "Rogue",
      "specId": 259,
      "role": "melee_dps",
      "rating": 2400
    }
  ],
  "rating": 2400
}
```

#### get-battleground-strategy
Get battleground strategy and tactics:
```json
{
  "bgId": 2
}
```

#### get-pvp-talent-build
Get PvP-optimized talent build:
```json
{
  "specId": 259,
  "bracket": "3v3"
}
```

#### optimize-quest-route
Optimize quest completion route for a zone:
```json
{
  "zoneId": 14,
  "playerLevel": 20,
  "maxQuests": 30
}
```

#### get-leveling-path
Get optimal multi-zone leveling path:
```json
{
  "startLevel": 10,
  "targetLevel": 60,
  "faction": "alliance"
}
```

#### get-collection-status
Get collection progress status:
```json
{
  "type": "mount",
  "accountId": 1
}
```

#### find-missing-collectibles
Find missing collectibles by rarity:
```json
{
  "type": "pet",
  "minRarity": "rare"
}
```

#### get-farming-route
Get optimized farming route for a collectible:
```json
{
  "collectibleId": 32768,
  "type": "mount"
}
```

#### GameTable Tools (4 tools)

**Note**: The remaining 24 TrinityCore knowledge tools are creature search, economy, reputation, and coordination tools. See full list in index.ts.

### Phase 5: AI Enhancement Tools (7 tools) ✨ NEW

#### query-trinity-knowledge
Query TrinityCore API documentation with curated examples:
```json
{
  "query": "Player resurrection",
  "context": "bot death recovery"
}
```

#### generate-code-from-template
Generate code from templates:
```json
{
  "templateName": "spell-cast-handler",
  "variables": {
    "spellId": "8326",
    "targetGuid": "player->GetGUID()"
  }
}
```

#### validate-generated-code
Validate generated code:
```json
{
  "code": "void MyClass::MyMethod() { ... }",
  "language": "cpp"
}
```

#### analyze-bot-performance
Analyze bot performance metrics:
```json
{
  "duration": 60000,
  "sampleInterval": 1000
}
```

#### simulate-scaling
Simulate bot scaling:
```json
{
  "currentBotCount": 100,
  "targetBotCount": 1000,
  "activityLevel": "medium"
}
```

#### get-optimization-suggestions
Get AI-powered optimization suggestions:
```json
{
  "performanceData": { ... },
  "currentBotCount": 500
}
```

#### run-tests
Execute tests:
```json
{
  "pattern": "**/*.test.ts",
  "parallel": true,
  "maxWorkers": 4
}
```

#### generate-test-report
Generate test reports:
```json
{
  "format": "html",
  "outputPath": "./test-report.html",
  "includeCharts": true
}
```

#### analyze-coverage
Analyze code coverage:
```json
{
  "include": ["src/**/*.ts"],
  "thresholds": { "lines": 80 }
}
```

#### GameTable Tools (4 tools)

#### query-gametable
Query a GameTable file:
```json
{
  "tableName": "CombatRatings.txt",
  "rowId": 60,
  "maxRows": 100
}
```

#### list-gametables
List all available GameTables:
```json
{}
```

#### get-combat-rating
Get combat rating for a level:
```json
{
  "level": 60,
  "statName": "Crit - Melee"
}
```

#### get-character-stats
Get character stats for a level:
```json
{
  "level": 60,
  "className": "Mage"
}
```

## Development

### Project Structure
```
trinitycore-mcp/
├── src/
│   ├── index.ts              # Main server entry point
│   ├── tools/
│   │   ├── spell.ts          # Spell-related tools
│   │   ├── item.ts           # Item-related tools
│   │   ├── quest.ts          # Quest-related tools
│   │   ├── dbc.ts            # DBC/DB2 reader
│   │   ├── api.ts            # Trinity API docs
│   │   ├── opcode.ts         # Opcode documentation
│   │   ├── knowledge.ts      # Knowledge base queries (Phase 5)
│   │   ├── codegen.ts        # Code generation (Phase 5)
│   │   ├── performance.ts    # Performance analysis (Phase 5)
│   │   └── testing.ts        # Testing automation (Phase 5)
│   ├── knowledge/
│   │   ├── KnowledgeBaseManager.ts  # API doc queries (Phase 5)
│   │   ├── CodeGenerator.ts         # Template-based codegen (Phase 5)
│   │   └── TemplateLibrary.ts       # Code templates (Phase 5)
│   ├── performance/
│   │   ├── PerformanceAnalyzer.ts   # Metrics collection (Phase 5)
│   │   ├── ScalingSimulator.ts      # Bot scaling sim (Phase 5)
│   │   └── OptimizationSuggester.ts # AI suggestions (Phase 5)
│   ├── testing/
│   │   ├── TestRunner.ts            # Test execution (Phase 5)
│   │   ├── TestReporter.ts          # Multi-format reports (Phase 5)
│   │   └── CoverageAnalyzer.ts      # Coverage analysis (Phase 5)
│   ├── database/
│   │   ├── connection.ts     # MySQL connection
│   │   └── queries.ts        # SQL queries
│   └── utils/
│       ├── parser.ts         # DBC/DB2 parser
│       └── cache.ts          # Caching layer
├── data/
│   └── api_docs/
│       └── general/          # 3,756 API docs (Phase 5)
├── doc/                      # Phase documentation
│   ├── PHASE_5_COMPLETE_SUMMARY.md
│   ├── PHASE_5_FINAL_VERIFICATION.md
│   └── ...
├── test_performance_analysis.js  # Performance tests (Phase 5)
├── test_testing_automation.js    # Testing tests (Phase 5)
├── package.json
├── tsconfig.json
└── README.md
```

### Build
```bash
npm run build
```

### Watch Mode
```bash
npm run dev
```

### Test
```bash
# Run performance analysis tests
node test_performance_analysis.js

# Run testing automation tests
node test_testing_automation.js

# Or use the testing automation MCP tool
# (see "run-tests" tool documentation above)
```

## Examples

### Phase 1-3: TrinityCore Knowledge Examples

#### Query Spell Data
```typescript
// Get Fireball spell
const fireball = await tools.getSpellInfo({ spellId: 133 });
console.log(fireball.name); // "Fireball"
console.log(fireball.effects); // Array of spell effects
```

#### Read DBC File
```typescript
// Read spell DBC record
const spellRecord = await tools.queryDBC({
  dbcFile: "Spell.dbc",
  recordId: 133
});
```

#### Get API Documentation
```typescript
// Get Player class API
const playerAPI = await tools.getTrinityAPI({
  className: "Player"
});
console.log(playerAPI.methods); // Available methods
```

### Phase 5: AI Enhancement Examples ✨ NEW

#### Query Knowledge Base
```typescript
// Query TrinityCore API knowledge
const knowledge = await tools.queryTrinityKnowledge({
  query: "Player resurrection methods",
  context: "bot death recovery"
});
console.log(knowledge.methods); // Relevant API methods
console.log(knowledge.examples); // Usage examples
```

#### Generate Code from Template
```typescript
// Generate spell cast handler
const code = await tools.generateCodeFromTemplate({
  templateName: "spell-cast-handler",
  variables: {
    spellId: "8326",
    spellName: "Ghost",
    targetGuid: "player->GetGUID()"
  }
});
console.log(code); // Generated C++ code
```

#### Analyze Bot Performance
```typescript
// Analyze 100 bots for 60 seconds
const perf = await tools.analyzeBotPerformance({
  duration: 60000,
  sampleInterval: 1000
});
console.log(perf.summary); // CPU, memory, network stats
console.log(perf.bottlenecks); // Detected bottlenecks
```

#### Simulate Scaling
```typescript
// Simulate scaling from 100 to 1000 bots
const scaling = await tools.simulateScaling({
  currentBotCount: 100,
  targetBotCount: 1000,
  activityLevel: "medium"
});
console.log(scaling.predictions); // Resource predictions
console.log(scaling.feasibility); // Feasibility analysis
```

#### Run Tests
```typescript
// Run tests in parallel
const testResult = await tools.runTests({
  pattern: "**/*.test.ts",
  parallel: true,
  maxWorkers: 4,
  generateReport: {
    format: "html",
    outputPath: "./test-report.html"
  }
});
console.log(testResult.summary); // Pass/fail stats
```

## Performance & Quality

### Phase 5 Metrics
- **Tests**: 12/12 passing (100%)
- **Performance Targets**: 25/27 met (92.6%)
- **Code Quality**: Enterprise-grade, TypeScript strict mode
- **Build**: Zero compilation errors
- **Documentation**: 4,700+ lines across 6 comprehensive docs

### Production Readiness
✅ **Approved for Production** - See [PHASE_5_FINAL_VERIFICATION.md](PHASE_5_FINAL_VERIFICATION.md)

## Documentation

### Phase 5 Documentation
- [Phase 5 Complete Summary](doc/PHASE_5_COMPLETE_SUMMARY.md) - Master summary of all 5 weeks
- [Phase 5 Final Verification](PHASE_5_FINAL_VERIFICATION.md) - Production approval report
- [Week 4 Complete](doc/PHASE_5_WEEK_4_COMPLETE.md) - Performance analysis implementation
- [Week 5 Complete](doc/PHASE_5_WEEK_5_COMPLETE.md) - Testing automation implementation

### Additional Resources
- [Week 4 Design](doc/PHASE_5_WEEK_4_DESIGN.md) - Performance tools architecture
- [Week 5 Design](doc/PHASE_5_WEEK_5_DESIGN.md) - Testing tools architecture

## Roadmap

### Phase 6: Production Deployment & Monitoring (Upcoming)
- **Week 1**: CI/CD Automation (GitHub Actions)
- **Week 2**: Containerization (Docker, Kubernetes)
- **Week 3**: Health Monitoring (dashboards, alerting)
- **Week 4**: Production Hardening (load balancing, HA, security)

## License

GPL-2.0 (same as TrinityCore)

## Contributing

Contributions welcome! Please follow TrinityCore coding standards.

### Running Tests
```bash
# Performance analysis tests
node test_performance_analysis.js

# Testing automation tests
node test_testing_automation.js
```

## Support

For issues or questions, create an issue in the [TrinityCore MCP Server repository](https://github.com/agatho/trinitycore-mcp/issues).
