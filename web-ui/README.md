# TrinityCore API Explorer - MCP-Enhanced Frontend v2.6.0

> Enterprise-grade web interface for TrinityCore with live MCP integration, real-time database access, interactive API playground, analytics dashboards, AI-powered code review, schema explorer, performance profiler, workflow automation, and complete developer tooling.

[![Version](https://img.shields.io/badge/Version-2.6.0-brightgreen)](https://github.com/agatho/trinitycore-mcp)
[![Next.js](https://img.shields.io/badge/Next.js-16.0.1-black)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.2.0-blue)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5+-blue)](https://www.typescriptlang.org/)
[![MCP](https://img.shields.io/badge/MCP-Integrated-green)](https://github.com/agatho/trinitycore-mcp)
[![Tools](https://img.shields.io/badge/MCP_Tools-80-purple)](https://github.com/agatho/trinitycore-mcp)
[![Pages](https://img.shields.io/badge/Pages-17-orange)](https://github.com/agatho/trinitycore-mcp)

---

## 🎯 What is This?

This is the **MCP-enhanced web frontend** for the TrinityCore MCP Server. It provides:

- **Live Database Access** - Real-time TrinityCore data via MCP protocol
- **80 MCP Tools** - Direct access to all TrinityCore MCP tools (v2.4.0)
- **17 Interactive Pages** - Complete developer tooling ecosystem
- **Interactive Playground** - Test and explore API methods
- **Analytics Dashboard** - Interactive data visualizations with charts and graphs
- **Comparison Tool** - Side-by-side batch comparison of items, spells, creatures
- **AI Code Review** - 1,020 TrinityCore-specific rules for C++ code analysis
- **PlayerBot AI Visualizer** - Analyze and visualize bot behavior with Mermaid flowcharts
- **Server Monitoring** - Real-time health & performance metrics
- **Database Schema Explorer** - Visual database exploration with ER diagrams & query builder
- **Performance Profiler** - Query optimization, slow query analysis, N+1 detection
- **Workflow Automation** - Automate dev tasks, code generation, server management
- **Diff & Merge Tool** - Database schema comparison and merging
- **Documentation Generator** - Auto-generate schema documentation
- **Migration Manager** - Database version control and migrations
- **Live Data Inspector** - Real-time server data monitoring via SOAP API
- **Data Export** - Export to CSV, Excel, JSON, PDF, XML formats
- **Advanced Search** - Fuzzy search with Fuse.js, multi-criteria filtering
- **Comprehensive Docs** - Complete reference for 3,812 API methods

**Live Demo:** http://localhost:3000 (after starting dev server)

---

## 🚀 Quick Start

### Prerequisites
- **Node.js 18+** installed
- **TrinityCore MCP Server** running (see [trinitycore-mcp](https://github.com/agatho/trinitycore-mcp))
- **TrinityCore Database** (optional - for full functionality)

### Installation

```bash
# Clone or navigate to project
cd C:\TrinityBots\trinitycore-web-ui

# Install dependencies (already done if following setup)
npm install

# Start development server
npm run dev
```

**Server will start at:** http://localhost:3000

---

## 📊 Features

### 🎉 NEW in v2.5.0 (November 2025)

#### **7 Major Feature Implementations:**

1. **📊 Analytics Dashboard** (`/dashboard`)
   - Interactive data visualizations using Recharts
   - Spell distribution by school (bar & pie charts)
   - Item distribution by quality tier
   - Creature distribution by level brackets
   - Real-time statistics cards
   - Export charts to CSV, Excel, PDF, JSON, XML

2. **🔄 Comparison Tool** (`/compare`)
   - Side-by-side batch comparison (up to 10 items)
   - Automatic difference highlighting
   - Table and card view modes
   - Filter to show only differences
   - Comparison cart with localStorage persistence
   - Export comparison tables

3. **🔍 Advanced Search & Filtering**
   - Fuzzy search with Fuse.js (Levenshtein distance)
   - Multi-criteria filtering (equals, contains, range, in)
   - Search autocomplete and suggestions
   - Save/load search presets
   - Search index for faster lookups

4. **📥 Data Export System**
   - Export to 5 formats: CSV, Excel, JSON, PDF, XML
   - Customizable columns and headers
   - Batch export support
   - Copy to clipboard (JSON, CSV, TSV)
   - Print-optimized PDF layouts

5. **🤖 PlayerBot AI Behavior Visualizer** (`/ai-visualizer`)
   - Upload and analyze C++ AI code
   - Generate Mermaid flowcharts of decision trees
   - Detect issues (missing cooldowns, null pointers, unreachable code)
   - Action priority analysis
   - Optimization suggestions
   - Export analysis reports

6. **📈 Server Monitoring Dashboard** (`/monitoring`)
   - Real-time health & performance metrics
   - Live CPU, memory, latency graphs
   - Database connection status
   - Auto-refresh every 5 seconds
   - Historical trend analysis (20 data points)
   - System information panel

7. **🔎 AI-Powered Code Review** (`/code-review`)
   - 1,020 TrinityCore-specific rules
   - Severity-based violation categorization (critical/major/minor)
   - Auto-fix suggestions
   - Side-by-side diff viewer (original vs fixed)
   - Code score calculation
   - Export review reports

#### **Core Utilities Added:**
- `lib/export.ts` - Universal export functions (200+ lines)
- `lib/search.ts` - Fuzzy search & filtering (350+ lines)
- `lib/comparison.ts` - Comparison utilities (250+ lines)
- `hooks/useCompare.ts` - React comparison hook
- `components/charts/` - Reusable chart components (Recharts-based)
- `components/ExportButton.tsx` - Universal export dropdown

### ✅ Phase 1-2 (COMPLETE)

#### 1. **Homepage**
- Beautiful dark gradient theme
- Live MCP server status indicator
- Global search bar (Cmd+K)
- 10 category cards (all pages accessible)
- Statistics display (80 tools, 10 pages, 1,020 rules, live monitoring)

#### 2. **MCP Integration**
- Enterprise-grade MCP client (`lib/mcp/client.ts`)
- 80 tools categorized into 13+ groups
- Server-side tool execution
- Client-side React hooks for easy integration

#### 3. **Core Pages**
- **Spells Browser** (`/spells`) - Search by ID, filter by school
- **Items Database** (`/items`) - Search by ID, filter by quality
- **Creatures Explorer** (`/creatures`) - Search by ID, multi-filters
- **API Playground** (`/playground`) - Interactive tool testing with history
- **Documentation** (`/docs`) - Complete API reference (3,812 methods)

#### 4. **React Hooks**
- `useMCPTools()` - Fetch available tools
- `useMCPTool()` - Call tools from components
- `useSpell(id)` - Fetch spell data
- `useItem(id)` - Fetch item data
- `useCreature(id)` - Fetch creature data
- `useMCPSearch()` - Search functionality
- `useCompare()` - Comparison state management
- `useBatchQuery()` - Batch query execution

### 🔮 Future Enhancements

- [ ] Dark mode toggle (currently dark-only)
- [ ] Mobile PWA with offline support
- [ ] Interactive Game Mechanics Sandbox
- [ ] Natural Language Query Interface (ChatMCP)
- [ ] WebSocket for live server events
- [ ] Predictive analytics for server capacity

- [ ] Production deployment
- [ ] Domain setup (api.trinitycore.org)
- [ ] CDN configuration
- [ ] Analytics integration

---

## 🛠️ Technology Stack

### Core
- **Next.js 16.0.1** - React framework with App Router & Turbopack
- **React 19.2.0** - UI library
- **TypeScript 5+** - Type safety
- **Tailwind CSS 4** - Utility-first CSS

### MCP Integration
- **@modelcontextprotocol/sdk** - Official MCP SDK
- **Custom MCP client** - TrinityCore-specific wrapper

### UI Libraries
- **Radix UI** - Accessible component primitives
- **lucide-react** - Icon library
- **class-variance-authority** - Component variants

### State & Data
- **zustand** - State management
- **swr** - Data fetching with caching
- **axios** - HTTP client

---

## 📁 Project Structure

```
trinitycore-web-ui/
├── app/                  # Next.js 14 App Router
│   ├── layout.tsx        # Root layout
│   ├── page.tsx          # Homepage
│   ├── globals.css       # Global styles
│   └── api/              # API routes
│       ├── mcp/          # MCP tool endpoints
│       ├── spell/        # Spell data endpoints
│       ├── item/         # Item data endpoints
│       └── creature/     # Creature data endpoints
├── lib/                  # Utility functions
│   ├── utils.ts          # Helper functions
│   └── mcp/              # MCP client
│       └── client.ts     # MCP integration (264 lines)
├── hooks/                # React hooks
│   └── useMCP.ts         # MCP hooks (147 lines)
├── components/           # UI components
│   └── ui/               # shadcn/ui components
│       ├── button.tsx
│       ├── input.tsx
│       └── card.tsx
├── public/               # Static assets
├── .env.local            # Environment variables
├── package.json          # Dependencies
└── README.md             # This file
```

---

## ⚙️ Configuration

### Environment Variables

Create `.env.local` in project root (copy from `.env.template`):

```bash
# TrinityCore SOAP API Configuration
# Required for Live Data Inspector to connect to worldserver
TRINITY_SOAP_HOST=127.0.0.1
TRINITY_SOAP_PORT=7878
TRINITY_SOAP_USERNAME=admin
TRINITY_SOAP_PASSWORD=admin
TRINITY_SOAP_MOCK=true  # Set to false when worldserver SOAP is running

# TrinityCore Database
TRINITY_DB_HOST=localhost
TRINITY_DB_PORT=3306
TRINITY_DB_AUTH_DATABASE=acore_auth
TRINITY_DB_CHARACTERS_DATABASE=acore_characters
TRINITY_DB_WORLD_DATABASE=acore_world
TRINITY_DB_USERNAME=acore
TRINITY_DB_PASSWORD=acore

# MCP Server Path
MCP_SERVER_PATH=C:\\TrinityBots\\trinitycore-mcp\\dist\\index.js

# TrinityCore Paths
TRINITY_ROOT=C:\\TrinityBots\\TrinityCore
DBC_PATH=C:\\TrinityBots\\Server\\data\\dbc
DB2_PATH=C:\\TrinityBots\\Server\\data\\db2

# Collision Data Auto-Load (Optional)
# Enable automatic VMap/MMap loading from filesystem for height detection
# If not set, users can still manually upload files via the UI
VMAP_DATA_PATH=C:\\TrinityBots\\Server\\data\\vmaps
MMAP_DATA_PATH=C:\\TrinityBots\\Server\\data\\mmaps

# Next.js
NEXT_PUBLIC_APP_NAME=TrinityCore API Explorer
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_VERSION=2.6.0
```

### TrinityCore SOAP API Setup

The **Live Data Inspector** requires TrinityCore's SOAP API to be enabled. Configure in `worldserver.conf`:

```ini
###################################################################################################
# SOAP
#
#    SOAP.Enabled
#        Description: Enable SOAP service for remote administration
#        Default:     0 - (Disabled)
#                     1 - (Enabled)
#
#    SOAP.IP
#        Description: Bind SOAP service to IP/hostname
#        Default:     "127.0.0.1"
#
#    SOAP.Port
#        Description: TCP port to reach the SOAP service
#        Default:     7878
#
###################################################################################################

SOAP.Enabled = 1
SOAP.IP = "127.0.0.1"
SOAP.Port = 7878
```

After enabling SOAP, restart your worldserver and update `.env.local` with `TRINITY_SOAP_MOCK=false` to connect to the real server.

**Security Warning:** SOAP provides full administrative access to your server. Only expose SOAP on localhost (127.0.0.1) unless you're using a VPN or other secure network. Never expose SOAP to the public internet without proper firewall rules and strong authentication.

---

## 🧪 Testing

### Start Development Server
```bash
npm run dev
```

Visit: http://localhost:3000

### Test API Endpoints
```bash
# List all MCP tools
curl http://localhost:3000/api/mcp/tools

# Get spell information (Fireball)
curl http://localhost:3000/api/spell/133

# Get item information (Thunderfury)
curl http://localhost:3000/api/item/19019

# Get creature information (Spirit Healer)
curl http://localhost:3000/api/creature/6491

# Call arbitrary MCP tool
curl -X POST http://localhost:3000/api/mcp/call \
  -H "Content-Type: application/json" \
  -d '{"toolName": "get-spell-info", "args": {"spellId": 133}}'
```

### Build for Production
```bash
npm run build
npm start
```

---

## 📊 Statistics

| Metric | Value |
|--------|-------|
| Total Files | 15+ |
| Lines of Code | ~1,200 |
| MCP Tools | 56 |
| API Methods | 3,812 |
| Spells | 45,000+ |
| Build Time | ~2 seconds |
| Startup Time | ~650ms |

---

## 🎯 Use Cases

### 1. **TrinityCore Developers**
- Browse API documentation
- Test MCP tools interactively
- Search spells, items, creatures
- Explore game data without database setup

### 2. **Bot Developers**
- Find optimal stat priorities
- Test talent builds
- Calculate quest XP
- Analyze reputation gains

### 3. **Server Administrators**
- Search creature vendors
- Find trainer NPCs
- Lookup quest information
- Explore dungeon/raid data

### 4. **Community**
- Public resource for TrinityCore data
- Interactive API playground
- Real-time game database
- Educational tool

---

## 🔧 Development

### Available Scripts

```bash
npm run dev      # Start development server (http://localhost:3000)
npm run build    # Build for production
npm start        # Start production server
npm run lint     # Run ESLint
```

### Adding New Features

1. **New API Route:**
   - Create file in `app/api/your-route/route.ts`
   - Use MCP client: `getMCPClient()` from `@/lib/mcp/client`

2. **New Page:**
   - Create file in `app/your-page/page.tsx`
   - Use hooks from `@/hooks/useMCP`

3. **New Component:**
   - Create file in `components/ui/your-component.tsx`
   - Follow shadcn/ui patterns

---

## 🤝 Contributing

This project is part of the TrinityCore MCP Server ecosystem.

### Related Projects
- [TrinityCore MCP Server](https://github.com/agatho/trinitycore-mcp) - Backend MCP server
- [TrinityCore](https://github.com/TrinityCore/TrinityCore) - Main TrinityCore repository

---

## 📝 License

This project follows TrinityCore's GPL-2.0 license.

---

## 🎉 Acknowledgments

- **TrinityCore Team** - For the amazing WoW server framework
- **Model Context Protocol** - For the MCP standard
- **Next.js Team** - For the excellent React framework
- **Vercel** - For shadcn/ui component library
- **Radix UI** - For accessible component primitives

---

## 📞 Support

- **Documentation:** [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md)
- **Issues:** Report bugs via GitHub Issues
- **MCP Server:** [trinitycore-mcp](https://github.com/agatho/trinitycore-mcp)

---

**Status:** ✅ Phase 1 Complete | 🔄 Phase 2 In Progress

**Live at:** http://localhost:3000

Generated with [Claude Code](https://claude.com/claude-code)
