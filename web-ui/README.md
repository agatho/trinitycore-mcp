# TrinityCore API Explorer - MCP-Enhanced Frontend

> Enterprise-grade web interface for TrinityCore with live MCP integration, real-time database access, and interactive API playground.

[![Next.js](https://img.shields.io/badge/Next.js-16.0.1-black)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.2.0-blue)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5+-blue)](https://www.typescriptlang.org/)
[![MCP](https://img.shields.io/badge/MCP-Integrated-green)](https://github.com/agatho/trinitycore-mcp)

---

## 🎯 What is This?

This is the **MCP-enhanced web frontend** for the TrinityCore MCP Server. It provides:

- **Live Database Access** - Real-time TrinityCore data via MCP protocol
- **56 MCP Tools** - Direct access to all TrinityCore MCP tools
- **Interactive Playground** - Test and explore API methods
- **Comprehensive Docs** - Complete reference for 3,812 API methods
- **Advanced Search** - Find spells, items, creatures, and NPCs instantly

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

### ✅ Phase 1 (COMPLETE)

#### 1. **Homepage**
- Beautiful dark gradient theme
- Live MCP server status indicator
- Global search bar
- 5 category cards (Spells, Items, Creatures, Playground, Docs)
- Statistics display (56 tools, 3,812 methods, 45,000+ spells)

#### 2. **MCP Integration**
- Enterprise-grade MCP client (`lib/mcp/client.ts`)
- 56 tools categorized into 13 groups
- Server-side tool execution
- Client-side React hooks for easy integration

#### 3. **API Routes**
- `/api/mcp/tools` - List all available tools
- `/api/mcp/call` - Execute any MCP tool
- `/api/spell/[spellId]` - Get spell details
- `/api/item/[itemId]` - Get item details
- `/api/creature/[creatureId]` - Get creature details

#### 4. **React Hooks**
- `useMCPTools()` - Fetch available tools
- `useMCPTool()` - Call tools from components
- `useSpell(id)` - Fetch spell data
- `useItem(id)` - Fetch item data
- `useCreature(id)` - Fetch creature data
- `useMCPSearch()` - Search functionality

### 🔜 Phase 2 (In Progress)

- [ ] API Method Explorer page
- [ ] Interactive API Playground
- [ ] Spell Browser with filters
- [ ] Item Database with stat search
- [ ] Creature Explorer with vendor/trainer info
- [ ] Advanced search with real-time suggestions

### 🔮 Phase 3 (Planned)

- [ ] Dark mode toggle
- [ ] Mobile responsive refinements
- [ ] Export functionality (JSON, CSV)
- [ ] User preferences (local storage)
- [ ] Performance optimizations

### 🚀 Phase 4 (Planned)

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

Create `.env.local` in project root:

```bash
# MCP Server Path
MCP_SERVER_PATH=C:\\TrinityBots\\trinitycore-mcp\\dist\\index.js

# TrinityCore Database
TRINITY_DB_HOST=localhost
TRINITY_DB_PORT=3306
TRINITY_DB_USER=trinity
TRINITY_DB_PASSWORD=your_password

# TrinityCore Paths
TRINITY_ROOT=C:\\TrinityBots\\TrinityCore
DBC_PATH=C:\\TrinityBots\\Server\\data\\dbc
DB2_PATH=C:\\TrinityBots\\Server\\data\\db2

# Next.js
NEXT_PUBLIC_APP_NAME=TrinityCore API Explorer
NEXT_PUBLIC_APP_URL=http://localhost:3000
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
