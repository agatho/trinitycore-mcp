# TrinityCore Web UI

[![Version](https://img.shields.io/badge/Version-0.9.0--RC1-brightgreen)](https://github.com/agatho/trinitycore-mcp)
[![Next.js](https://img.shields.io/badge/Next.js-16.0.1-black)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.2.0-blue)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5+-blue)](https://www.typescriptlang.org/)
[![MCP](https://img.shields.io/badge/MCP-Integrated-green)](https://github.com/agatho/trinitycore-mcp)
[![Tools](https://img.shields.io/badge/MCP_Tools-107-purple)](https://github.com/agatho/trinitycore-mcp)
[![Pages](https://img.shields.io/badge/Pages-36+-orange)](https://github.com/agatho/trinitycore-mcp)

> **Enterprise-grade web interface** for TrinityCore MCP Server with **36+ interactive pages**, **107 MCP tools integration**, real-time database access, AI-powered code review, analytics dashboards, and comprehensive developer tooling.

---

## 🎯 What is This?

The **TrinityCore Web UI** is a Next.js 16 web application providing a complete visual interface for the TrinityCore MCP Server. It offers:

- **36+ Interactive Pages** - Complete developer tooling ecosystem
- **107 MCP Tools Integration** - Direct access to all TrinityCore MCP tools
- **Real-time Database Access** - Live MySQL queries via MCP protocol
- **AI Code Review** - 1,020 TrinityCore-specific rules for C++ analysis
- **Analytics Dashboard** - Interactive data visualizations with charts
- **Bot AI Visualizer** - Analyze PlayerBot behavior with Mermaid flowcharts
- **Server Monitoring** - Real-time health and performance metrics
- **Database Schema Explorer** - Visual ER diagrams and query builder
- **Performance Profiler** - Query optimization and analysis
- **Data Export** - CSV, Excel, JSON, PDF, XML export support

**Live at:** http://localhost:3000 (after starting dev server)

---

## 🚀 Quick Start

### Prerequisites

- **Node.js 18+** installed
- **TrinityCore MCP Server** running (see [parent README](../README.md))
- **TrinityCore Database** (optional - for full functionality)

### Installation

```bash
# Navigate to web-ui directory
cd web-ui

# Install dependencies
npm install

# Start development server
npm run dev
```

**Server will start at:** http://localhost:3000

### Or Start from Project Root

```bash
# From project root, start both MCP server and Web UI
npm run start:all
```

---

## 📊 Features

### Core Pages

#### **Homepage** (`/`)
- Beautiful dark gradient theme
- Live MCP server status indicator
- Global search bar (Cmd+K)
- Quick access to all features
- Statistics display (107 tools, 36+ pages, 1,020 rules)

#### **API Playground** (`/playground`)
- Interactive testing of all 107 MCP tools
- JSON editor for tool arguments
- Request/response history
- Tool categorization and search
- Export results to JSON

#### **API Explorer** (`/docs`)
- Browse 3,800+ TrinityCore C++ API methods
- Search and filter documentation
- Method signatures and descriptions
- Class hierarchy navigation

### Data Browsers

#### **Spell Browser** (`/spells`)
- Search 45,000+ spells by ID or name
- Filter by school (Fire, Frost, Arcane, etc.)
- View spell effects and mechanics
- Damage/healing calculations
- Export spell data

#### **Item Database** (`/items`)
- Search items by ID or name
- Filter by quality tier
- View item stats and bonuses
- Gear scoring and comparisons
- Export item data

#### **Creature Explorer** (`/creatures`)
- Search NPCs by ID or name
- Filter by type, faction, level
- Find vendors and trainers
- View spawn locations
- Export creature data

#### **Quest Viewer** (`/quests`)
- Search quests by ID or name
- View quest chains and prerequisites
- Analyze rewards and objectives
- Route optimization
- Export quest data

### Analytics & Tools

#### **Analytics Dashboard** (`/dashboard`)
- Interactive data visualizations (Recharts)
- Spell distribution by school (bar & pie charts)
- Item distribution by quality tier
- Creature distribution by level brackets
- Real-time statistics cards
- Export charts to CSV, Excel, PDF, JSON, XML

#### **Comparison Tool** (`/compare`)
- Side-by-side batch comparison (up to 10 items)
- Automatic difference highlighting
- Table and card view modes
- Filter to show only differences
- Comparison cart with localStorage persistence
- Export comparison tables

#### **Advanced Search & Filtering**
- Fuzzy search with Fuse.js (Levenshtein distance)
- Multi-criteria filtering (equals, contains, range, in)
- Search autocomplete and suggestions
- Save/load search presets
- Search index for faster lookups

#### **Data Export System**
- Export to 5 formats: CSV, Excel, JSON, PDF, XML
- Customizable columns and headers
- Batch export support
- Copy to clipboard (JSON, CSV, TSV)
- Print-optimized PDF layouts

### Developer Tools

#### **AI Code Review** (`/code-review`)
- Upload C++ files for TrinityCore-specific analysis
- 1,020 rules across 7 categories
- Severity-based violation categorization (critical/major/minor)
- Auto-fix suggestions
- Side-by-side diff viewer (original vs fixed)
- Code score calculation
- Export review reports

#### **Bot AI Visualizer** (`/ai-visualizer`)
- Upload and analyze C++ AI code
- Generate Mermaid flowcharts of decision trees
- Detect issues (missing cooldowns, null pointers, unreachable code)
- Action priority analysis
- Optimization suggestions
- Export analysis reports

#### **Server Monitoring** (`/monitoring`)
- Real-time health and performance metrics
- Live CPU, memory, latency graphs
- Database connection status
- Auto-refresh every 5 seconds
- Historical trend analysis (20 data points)
- System information panel

#### **Database Schema Explorer** (`/schema`)
- Visual database exploration with ER diagrams
- Table schema inspection
- Relationship mapping
- Query builder (drag-and-drop)
- Schema comparison and diff
- Export schema documentation

#### **Performance Profiler** (`/profiler`)
- Query optimization tools
- Slow query analysis
- N+1 query detection
- Index usage analysis
- Performance recommendations

### Workflow & Data Management

#### **Workflow Automation** (`/workflows`)
- Automate development tasks
- Code generation workflows
- Server management automation
- Custom workflow builder

#### **Migration Manager** (`/migrations`)
- Database version control
- Migration tracking
- Rollback support
- Migration history

#### **Documentation Generator** (`/docs-generator`)
- Auto-generate schema documentation
- API documentation export
- Markdown/HTML output
- Customizable templates

#### **Live Data Inspector** (`/inspector`)
- Real-time server data monitoring
- TrinityCore SOAP API integration
- Live player/creature/object tracking
- Server command execution

---

## 🛠️ Technology Stack

### Core Framework
- **Next.js 16.0.1** - React framework with App Router & Turbopack
- **React 19.2.0** - UI library
- **TypeScript 5+** - Type safety
- **Tailwind CSS 4** - Utility-first CSS

### MCP Integration
- **@modelcontextprotocol/sdk** - Official MCP SDK
- **Custom MCP client** - TrinityCore-specific wrapper (`lib/mcp/client.ts`)

### UI Components
- **Radix UI** - Accessible component primitives
- **shadcn/ui** - Beautiful component library
- **lucide-react** - Icon library
- **class-variance-authority** - Component variants

### Data Visualization
- **Recharts** - Interactive charts and graphs
- **Mermaid** - Flowchart and diagram generation
- **Monaco Editor** - Code editor (VS Code engine)

### State & Data Management
- **zustand** - State management
- **swr** - Data fetching with caching
- **axios** - HTTP client

### Utilities
- **Fuse.js** - Fuzzy search
- **jsPDF** - PDF generation
- **xlsx** - Excel export
- **sql-formatter** - SQL formatting

---

## ⚙️ Configuration

### Environment Variables

Create `.env.local` in `web-ui` directory:

```env
# TrinityCore SOAP API (for Live Data Inspector)
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
NEXT_PUBLIC_APP_VERSION=0.9.0-RC1
```

### TrinityCore SOAP API Setup

For the **Live Data Inspector** to work, enable SOAP in `worldserver.conf`:

```ini
SOAP.Enabled = 1
SOAP.IP = "127.0.0.1"
SOAP.Port = 7878
```

**Security Warning:** SOAP provides full administrative access. Only expose on localhost unless using VPN/secure network.

---

## 📁 Project Structure

```
web-ui/
├── app/                      # Next.js App Router
│   ├── layout.tsx            # Root layout
│   ├── page.tsx              # Homepage
│   ├── globals.css           # Global styles
│   ├── playground/           # API playground
│   ├── spells/               # Spell browser
│   ├── items/                # Item database
│   ├── creatures/            # Creature explorer
│   ├── dashboard/            # Analytics dashboard
│   ├── compare/              # Comparison tool
│   ├── code-review/          # AI code review
│   ├── ai-visualizer/        # Bot AI visualizer
│   ├── monitoring/           # Server monitoring
│   ├── schema/               # Database schema explorer
│   └── api/                  # API routes
│       ├── mcp/              # MCP tool endpoints
│       ├── spell/            # Spell endpoints
│       ├── item/             # Item endpoints
│       └── creature/         # Creature endpoints
├── components/               # React components
│   ├── ui/                   # shadcn/ui components
│   ├── charts/               # Recharts components
│   └── ExportButton.tsx      # Universal export
├── lib/                      # Utility functions
│   ├── utils.ts              # Helper functions
│   ├── export.ts             # Export utilities
│   ├── search.ts             # Fuzzy search
│   ├── comparison.ts         # Comparison utilities
│   └── mcp/                  # MCP client
│       └── client.ts         # MCP integration (264 lines)
├── hooks/                    # React hooks
│   ├── useMCP.ts             # MCP hooks
│   ├── useCompare.ts         # Comparison hook
│   └── useBatchQuery.ts      # Batch query hook
├── public/                   # Static assets
├── .env.local                # Environment variables
├── package.json              # v0.9.0-RC1
└── README.md                 # This file
```

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

# Get spell information
curl http://localhost:3000/api/spell/133

# Get item information
curl http://localhost:3000/api/item/19019

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

## 🔧 Development

### Available Scripts

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm start        # Start production server
npm run lint     # Run ESLint
npm run test     # Run tests (Vitest)
```

### Adding New Features

#### 1. New API Route

Create file in `app/api/your-route/route.ts`:

```typescript
import { getMCPClient } from '@/lib/mcp/client';

export async function GET(request: Request) {
  const client = getMCPClient();
  const result = await client.callTool('tool-name', { args });
  return Response.json(result);
}
```

#### 2. New Page

Create file in `app/your-page/page.tsx`:

```typescript
import { useMCPTool } from '@/hooks/useMCP';

export default function YourPage() {
  const { data, loading } = useMCPTool('tool-name', { args });
  return <div>{/* Your UI */}</div>;
}
```

#### 3. New Component

Create file in `components/ui/your-component.tsx`:

```typescript
import { cn } from '@/lib/utils';

export function YourComponent() {
  return <div className={cn('...')}>...</div>;
}
```

---

## 📊 Statistics

| Metric | Value |
|--------|-------|
| **Total Pages** | 36+ |
| **MCP Tools** | 107 |
| **API Methods** | 3,800+ |
| **UI Components** | 50+ |
| **React Hooks** | 10+ |
| **Lines of Code** | ~15,000 |
| **Build Time** | ~5 seconds |
| **Startup Time** | ~1 second |

---

## 🎯 Use Cases

### 1. TrinityCore Developers
- Browse API documentation interactively
- Test MCP tools with instant feedback
- Search game data without SQL
- Visualize database schema

### 2. Bot Developers
- Analyze bot AI code visually
- Find optimal stats and talents
- Test combat calculations
- Review code quality

### 3. Server Administrators
- Monitor server health in real-time
- Query database with visual tools
- Generate documentation
- Automate workflows

### 4. Community & Education
- Public resource for TrinityCore data
- Interactive learning tool
- Real-time game database
- Educational reference

---

## 🤝 Contributing

This is part of the TrinityCore MCP Server ecosystem.

### Related Projects
- [TrinityCore MCP Server](https://github.com/agatho/trinitycore-mcp) - Backend MCP server
- [TrinityCore](https://github.com/TrinityCore/TrinityCore) - Main TrinityCore repository

### Development Workflow

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes
4. Test locally: `npm run dev`
5. Build: `npm run build`
6. Commit with descriptive message
7. Push to fork: `git push origin feature/amazing-feature`
8. Open Pull Request

---

## 📝 License

**GPL-2.0** (same as TrinityCore)

This project follows TrinityCore's licensing.

---

## 🎉 Acknowledgments

- **TrinityCore Team** - For the amazing WoW server framework
- **Model Context Protocol** - For the MCP standard
- **Next.js Team** - For the excellent React framework
- **Vercel** - For shadcn/ui component library
- **Radix UI** - For accessible component primitives
- **Recharts** - For beautiful charts

---

## 📞 Support

- **Documentation**: [Parent README](../README.md)
- **Issues**: [GitHub Issues](https://github.com/agatho/trinitycore-mcp/issues)
- **MCP Server**: [TrinityCore MCP Server](https://github.com/agatho/trinitycore-mcp)

---

## Project Status

**Version**: 0.9.0-RC1 (Release Candidate 1)
**Status**: ✅ Production Ready
**Pages**: 36+ interactive pages
**MCP Integration**: 107 tools
**Last Updated**: 2025-11-08

---

**Live at:** http://localhost:3000

**Generated with [Claude Code](https://claude.com/claude-code)**

Co-Authored-By: Claude <noreply@anthropic.com>
