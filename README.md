# TrinityCore MCP Server

[![Build](https://github.com/agatho/trinitycore-mcp/actions/workflows/build.yml/badge.svg)](https://github.com/agatho/trinitycore-mcp/actions/workflows/build.yml)
[![Code Quality](https://github.com/agatho/trinitycore-mcp/actions/workflows/code-quality.yml/badge.svg)](https://github.com/agatho/trinitycore-mcp/actions/workflows/code-quality.yml)
[![Version](https://img.shields.io/badge/version-0.9.0--RC1-blue.svg)](https://github.com/agatho/trinitycore-mcp/releases)
[![License](https://img.shields.io/badge/license-GPL--2.0-green.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3.3-blue.svg)](https://www.typescriptlang.org/)
[![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)
[![MCP Tools](https://img.shields.io/badge/MCP%20Tools-107%20registered-success.svg)](src/index.ts)

> **Enterprise-grade Model Context Protocol server** providing **107 MCP tools** for TrinityCore bot development with World of Warcraft 11.2 (The War Within). Includes comprehensive game data access, AI-powered code analysis, performance profiling, and a full-featured web interface.

---

## 🚀 Quick Start

```bash
# Clone repository
git clone https://github.com/agatho/trinitycore-mcp.git
cd trinitycore-mcp

# Install dependencies
npm install

# Build TypeScript
npm run build

# Start both MCP server and Web UI
npm run start:all
```

**Web UI will open at:** http://localhost:3000

---

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [MCP Tools (107 Total)](#mcp-tools-107-total)
- [Web UI](#web-ui)
- [Documentation](#documentation)
- [Development](#development)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

The **TrinityCore MCP Server** is a comprehensive development platform for building and managing TrinityCore PlayerBots. It provides:

- **107 MCP Tools** - Complete API for game data, code analysis, testing, and automation
- **Full-Featured Web UI** - Interactive Next.js 16 interface with 36+ pages
- **AI-Powered Code Review** - 1,020+ TrinityCore-specific rules for C++ analysis
- **DBC/DB2 Support** - Parse WDC5/WDC6 client database files
- **Performance Analysis** - Bot scaling simulation (100-5000 bots)
- **Live Database Access** - Real-time MySQL queries via MCP
- **3,800+ API Documentation** - Complete TrinityCore C++ API reference
- **VMap/MMap Integration** - Height detection and pathfinding support

---

## Features

### Core MCP Server (107 Tools)

#### Game Data & Queries (40 tools)
- **Spells** - Spell info, damage/healing calculations, comparisons, optimal selection
- **Items** - Item data, gear scoring, best-in-slot finder, set optimization
- **Quests** - Quest chains, prerequisites, rewards, route optimization
- **Creatures** - NPC data, vendors, trainers, spawn locations, statistics
- **World Data** - Points of interest, game objects, spawn searches
- **DBC/DB2** - Client database file parsing (WDC5/WDC6 support)
- **GameTables** - Combat ratings, XP tables, character stats, scaling data

#### Combat & Optimization (12 tools)
- **Talents** - Specialization info, recommended builds, tier comparisons
- **Combat Mechanics** - Melee damage, armor mitigation, threat, diminishing returns
- **Buffs** - Buff recommendations, group coverage analysis, consumable optimization
- **Dungeon Strategy** - Boss mechanics, layouts, group composition, Mythic+ strategies

#### Economy & Social (8 tools)
- **Economy** - Item pricing, auction house analysis, arbitrage, gold-making strategies
- **Reputation** - Faction info, reputation grinding paths, reward tracking
- **Professions** - Recipe data, skill-up plans, profitability analysis

#### Group Coordination & PvP (8 tools)
- **Coordination** - Group composition analysis, cooldown coordination, tactical assignments
- **PvP** - Arena composition analysis, battleground strategies, PvP talent builds

#### Collections & Leveling (7 tools)
- **Collections** - Pet/mount/toy tracking, missing collectibles, farming routes
- **Quest Routing** - Optimal quest paths, leveling routes, daily circuits, zone analysis

#### Knowledge Base & Code Generation (12 tools)
- **Documentation** - PlayerBot wiki search, code patterns, implementation guides
- **Code Generation** - Bot component templates, packet handlers, CMake integration
- **API Reference** - 3,800+ TrinityCore C++ method documentation

#### Performance & Testing (9 tools)
- **Performance Analysis** - Real-time metrics, scaling simulation, optimization suggestions
- **Testing Automation** - Test execution, multi-format reporting (JSON/HTML/Markdown/JUnit)
- **Coverage Analysis** - Code coverage with threshold validation

#### Database Tools (11 tools)
- **Schema Exploration** - Table listing, schema inspection, relationship mapping
- **Database Operations** - Export/import, backup/restore, health checks
- **Schema Comparison** - Database diff, migration support

#### AI Code Review & Analysis (11 tools)
- **Code Review** - 1,020+ rules across 7 categories (Null Safety, Memory, Concurrency, etc.)
- **Thread Safety** - Race condition detection, deadlock analysis, lock pattern validation
- **Memory Analysis** - Memory leak detection, RAII violations, circular references
- **API Migration** - Version migration support (3.3.5a → 11.2)
- **Bot AI Analysis** - Decision tree visualization, Mermaid flowchart generation
- **Combat Log Analysis** - DPS/HPS/TPS metrics, rotation quality, optimization suggestions

#### Production & Monitoring (11 tools)
- **Health Monitoring** - Server health status, component checks, system metrics
- **Logging** - Log querying, filtering, file location
- **Backups** - Automated/manual backups, verification, integrity checks
- **Security** - Security status, rate limiting, access control audit
- **Code Style** - Naming convention checks, formatting validation, auto-fix

#### VMap & MMap Tools (8 tools)
- **VMap** - Line-of-sight testing, height detection, spawn radius searches
- **MMap** - Pathfinding, navigation mesh validation, path calculation

#### Configuration & Test Generation (8 tools)
- **Configuration** - Get/update/validate/reset/export server configuration
- **AI Test Generation** - AI-powered test generation, performance/load testing

### Web UI (Next.js 16)

The included web interface provides **36+ interactive pages** for comprehensive TrinityCore development:

#### Core Features
- **Homepage** - Beautiful dark gradient UI with live MCP status
- **API Explorer** - Browse 3,800+ TrinityCore methods with search
- **Interactive Playground** - Test all 107 MCP tools with JSON editor and history
- **Real-time Database Access** - Direct MySQL queries via MCP protocol

#### Data Browsers
- **Spell Browser** - Search 45,000+ spells with school/effect filtering
- **Item Database** - Item search with quality/stat filtering
- **Creature Explorer** - NPC search with type/faction/vendor filters
- **Quest Viewer** - Quest chains, prerequisites, rewards visualization

#### Analytics & Tools
- **Analytics Dashboard** - Interactive charts (Recharts) for spell/item/creature distributions
- **Comparison Tool** - Side-by-side batch comparison (up to 10 items) with diff highlighting
- **Advanced Search** - Fuzzy search (Fuse.js), multi-criteria filtering, saved presets
- **Data Export** - Export to CSV, Excel, JSON, PDF, XML formats

#### Developer Tools
- **AI Code Review** - Upload C++ files for TrinityCore-specific analysis (1,020 rules)
- **Bot AI Visualizer** - Analyze PlayerBot AI with Mermaid flowcharts
- **Server Monitoring** - Real-time health, CPU, memory, latency graphs
- **Database Schema Explorer** - Visual ER diagrams, query builder, schema comparison
- **Performance Profiler** - Query optimization, slow query detection, N+1 analysis

#### Workflow & Data Management
- **Workflow Automation** - Automate dev tasks, code generation, server management
- **Migration Manager** - Database version control, migration tracking
- **Documentation Generator** - Auto-generate schema documentation
- **Live Data Inspector** - Real-time server monitoring via TrinityCore SOAP API

#### UI Features
- **Dark Mode** - Complete dark theme optimized for development
- **Responsive Design** - Desktop, tablet, and mobile optimized
- **Global Search** - Cmd+K quick search across all data
- **Copy to Clipboard** - JSON, CSV, TSV clipboard support
- **Print-Optimized** - PDF exports with clean layouts

---

## Installation

### Prerequisites

- **Node.js 18+** - [Download](https://nodejs.org/)
- **MySQL 9.4** (optional) - TrinityCore database for full functionality
- **TrinityCore Build** (optional) - For DBC/DB2 file paths

### Install Steps

```bash
# 1. Clone repository
git clone https://github.com/agatho/trinitycore-mcp.git
cd trinitycore-mcp

# 2. Install dependencies
npm install

# 3. Build TypeScript to JavaScript
npm run build

# 4. Verify build output
ls dist/
# Should see: index.js, tools/, database/, etc.
```

### Web UI Installation

```bash
# Install Web UI dependencies
cd web-ui
npm install
cd ..
```

---

## Configuration

### Environment Variables

Create `.env` file in project root:

```env
# TrinityCore Database (Required for game data queries)
TRINITY_DB_HOST=localhost
TRINITY_DB_PORT=3306
TRINITY_DB_USER=trinity
TRINITY_DB_PASSWORD=your_password
TRINITY_DB_AUTH=auth
TRINITY_DB_CHARACTERS=characters
TRINITY_DB_WORLD=world

# TrinityCore Paths (Optional - for DBC/DB2 reading)
TRINITY_ROOT=C:\TrinityBots\TrinityCore
DBC_PATH=C:\TrinityBots\Server\data\dbc
DB2_PATH=C:\TrinityBots\Server\data\db2

# VMap/MMap Paths (Optional - for height/pathfinding)
VMAP_DATA_PATH=C:\TrinityBots\Server\data\vmaps
MMAP_DATA_PATH=C:\TrinityBots\Server\data\mmaps

# MCP Server (Optional - defaults shown)
MCP_PORT=3000
MCP_HOST=localhost
```

### Claude Code Integration

Add to `.claude/mcp-servers-config.json` or `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "trinitycore": {
      "command": "node",
      "args": ["C:\\TrinityBots\\trinitycore-mcp\\dist\\index.js"],
      "env": {
        "TRINITY_DB_HOST": "localhost",
        "TRINITY_DB_PORT": "3306",
        "TRINITY_DB_USER": "trinity",
        "TRINITY_DB_PASSWORD": "${TRINITY_DB_PASSWORD}",
        "TRINITY_ROOT": "C:\\TrinityBots\\TrinityCore",
        "DBC_PATH": "C:\\TrinityBots\\Server\\data\\dbc",
        "DB2_PATH": "C:\\TrinityBots\\Server\\data\\db2"
      }
    }
  }
}
```

**For detailed configuration, see [MCP_CONFIGURATION.md](MCP_CONFIGURATION.md)**

---

## Usage

### Start Both MCP Server & Web UI (Recommended)

```bash
npm run start:all
```

This will:
1. Build the MCP server (if not already built)
2. Install Web UI dependencies (if needed)
3. Start the MCP server (stdio mode)
4. Start the Web UI (http://localhost:3000)
5. Automatically open your browser

### Start Services Individually

#### MCP Server Only

```bash
# Production mode (stdio transport)
npm start

# or
npm run start:mcp

# Development mode (watch for changes)
npm run dev
```

#### Web UI Only

```bash
npm run start:web
```

Starts Next.js development server on http://localhost:3000

---

## MCP Tools (107 Total)

The MCP server provides **107 registered tools** organized into the following categories:

### Quick Reference by Category

| Category | Tools | Description |
|----------|-------|-------------|
| **Game Data** | 40 | Spells, items, quests, creatures, world data, DBC/DB2, GameTables |
| **Combat & Optimization** | 12 | Talents, combat mechanics, buffs, dungeon strategy |
| **Economy & Social** | 8 | Item pricing, reputation, professions |
| **Group & PvP** | 8 | Coordination, arena, battlegrounds |
| **Collections & Leveling** | 7 | Collectibles, quest routing, zone analysis |
| **Knowledge & Codegen** | 12 | Documentation, code generation, API reference |
| **Performance & Testing** | 9 | Performance analysis, testing, coverage |
| **Database** | 11 | Schema, export/import, backup/restore |
| **AI Code Review** | 11 | Code review, thread safety, memory analysis, bot AI |
| **Production & Monitoring** | 11 | Health monitoring, logging, backups, security |
| **VMap & MMap** | 8 | Height detection, pathfinding |
| **Configuration & Tests** | 8 | Config management, AI test generation |

### Foundation Tools (6 tools)

```
get-spell-info          - Get detailed spell information by ID
get-item-info           - Get item data by ID
get-quest-info          - Get quest information by ID
query-dbc               - Query DBC/DB2 file by record ID
get-trinity-api         - Get TrinityCore C++ API documentation
get-opcode-info         - Get network packet opcode documentation
```

### GameTable Tools (4 tools)

```
query-gametable         - Query GameTable files (CombatRatings.txt, xp.txt, etc.)
list-gametables         - List all available GameTable files
get-combat-rating       - Get combat rating conversion for level
get-character-stats     - Get character base stats for level
```

### Example Tool Usage

```typescript
// Get spell information
const fireball = await callMCPTool("get-spell-info", { spellId: 133 });

// Analyze bot performance
const perf = await callMCPTool("analyze-bot-performance", {
  duration: 60000,
  sampleInterval: 1000
});

// Review C++ code
const review = await callMCPTool("review-code-file", {
  filePath: "src/modules/Playerbot/BotAI.cpp",
  minConfidence: 0.7
});

// Optimize quest route
const route = await callMCPTool("optimize-quest-route", {
  zone: "Elwynn Forest",
  level: 5
});
```

**For complete tool documentation, see the Web UI API Explorer at http://localhost:3000/playground**

---

## Web UI

### Access

Start the Web UI:

```bash
# Start both MCP server and Web UI
npm run start:all

# Or start Web UI only
npm run start:web
```

**Access at:** http://localhost:3000

### Key Pages

- **/** - Homepage with live MCP status and quick links
- **/playground** - Interactive API playground to test all 107 tools
- **/spells** - Search and filter 45,000+ spells
- **/items** - Browse item database with filtering
- **/creatures** - Explore NPCs, vendors, trainers
- **/dashboard** - Analytics dashboard with charts
- **/compare** - Side-by-side data comparison
- **/code-review** - AI-powered C++ code review
- **/ai-visualizer** - Bot AI behavior analysis
- **/monitoring** - Server health monitoring
- **/schema** - Database schema explorer
- **/docs** - Complete API documentation

### Web UI Features

✅ **36+ Interactive Pages**
✅ **107 MCP Tools Integration**
✅ **Real-time Database Access**
✅ **Advanced Search & Filtering**
✅ **Data Export** (CSV, Excel, JSON, PDF, XML)
✅ **AI Code Review** (1,020 rules)
✅ **Bot AI Visualization** (Mermaid flowcharts)
✅ **Server Monitoring** (Real-time metrics)
✅ **Dark Mode** (Optimized for development)
✅ **Responsive Design** (Desktop, tablet, mobile)

---

## Documentation

### Core Documentation

- [README.md](README.md) - This file (main overview)
- [CHANGELOG.md](CHANGELOG.md) - Version history and changes
- [MCP_CONFIGURATION.md](MCP_CONFIGURATION.md) - Detailed configuration guide
- [INSTALLATION.md](INSTALLATION.md) - Step-by-step installation instructions

### Web UI Documentation

- [web-ui/README.md](web-ui/README.md) - Web UI specific documentation
- **API Explorer** - Interactive docs at http://localhost:3000/docs

### Development Documentation

- [doc/API_REFERENCE.md](doc/API_REFERENCE.md) - DBC/DB2 API reference
- [doc/DEVELOPMENT_GUIDE.md](doc/DEVELOPMENT_GUIDE.md) - Developer guidelines
- [doc/TESTING_GUIDE.md](doc/TESTING_GUIDE.md) - Testing instructions

---

## Development

### Build

```bash
# Build TypeScript to JavaScript
npm run build

# Watch mode (rebuild on changes)
npm run dev
```

### Test

```bash
# Run tests
npm test

# Or use MCP testing tools via Claude Code
```

### Lint

```bash
npm run lint
```

### Project Structure

```
trinitycore-mcp/
├── src/
│   ├── index.ts              # Main MCP server entry point
│   ├── tools/                # 107 tool implementations (58 files)
│   │   ├── spell.ts
│   │   ├── item.ts
│   │   ├── quest.ts
│   │   ├── dbc.ts
│   │   ├── codereview.ts
│   │   ├── performance.ts
│   │   └── ... (52 more)
│   ├── database/
│   │   └── connection.ts     # MySQL connection pool
│   ├── parsers/
│   │   ├── dbc/              # DBC/DB2 parsers
│   │   └── cache/            # Caching system
│   └── utils/
│       └── logger.ts
├── web-ui/                   # Next.js 16 web interface
│   ├── app/                  # App Router pages (36+ pages)
│   ├── components/           # React components
│   ├── lib/                  # Utilities and MCP client
│   └── public/               # Static assets
├── data/
│   └── api_docs/             # 3,800+ API documentation files
├── tests/                    # Test suites
├── dist/                     # Compiled JavaScript (build output)
├── package.json              # v0.9.0-RC1
├── tsconfig.json
└── README.md                 # This file
```

---

## Contributing

Contributions welcome! Please follow TrinityCore coding standards.

### Development Workflow

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes
4. Build and test: `npm run build && npm test`
5. Commit with descriptive message
6. Push to fork: `git push origin feature/amazing-feature`
7. Open Pull Request

### Code Quality Standards

- ✅ TypeScript strict mode compliance
- ✅ Zero compilation errors/warnings
- ✅ Comprehensive error handling
- ✅ JSDoc documentation for public APIs
- ✅ Unit tests for new features
- ✅ Performance considerations

---

## License

**GPL-2.0** (same as TrinityCore)

See [LICENSE](LICENSE) file for details.

---

## Support

- **Documentation**: [doc/](doc/) directory
- **Issues**: [GitHub Issues](https://github.com/agatho/trinitycore-mcp/issues)
- **TrinityCore**: [TrinityCore Repository](https://github.com/TrinityCore/TrinityCore)
- **MCP Protocol**: [Model Context Protocol](https://modelcontextprotocol.io/)

---

## Acknowledgments

- **TrinityCore Team** - For the amazing WoW server framework
- **Model Context Protocol** - For the MCP standard
- **Anthropic** - For Claude Code and AI assistance
- **TypeScript Team** - For the excellent language
- **Next.js Team** - For the React framework
- **Vercel** - For shadcn/ui components

---

## Project Status

**Version**: 0.9.0-RC1 (Release Candidate 1)
**Status**: ✅ Production Ready
**MCP Tools**: 107 registered tools
**Web UI Pages**: 36+ interactive pages
**Last Updated**: 2025-11-08

---

**Generated with [Claude Code](https://claude.com/claude-code)**

Co-Authored-By: Claude <noreply@anthropic.com>
