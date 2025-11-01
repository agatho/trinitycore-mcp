# Phase 2 Implementation Plan - MCP-Enhanced Frontend
**TrinityCore Web UI - Interactive Data Explorer**

## Executive Summary

Phase 2 transforms the TrinityCore Web UI from a static documentation browser into an **interactive data exploration platform** that directly leverages the Model Context Protocol (MCP) server's 54 tools to provide real-time access to game data, spell information, creature databases, and TrinityCore API methods.

**Phase 2 Status**: 30% Complete
- ✅ API Method Explorer (7,808 methods browsable)
- ⏳ Interactive API Playground (0%)
- ⏳ Spell Browser (0%)
- ⏳ Item Database (0%)
- ⏳ Creature Explorer (0%)
- ⏳ Advanced Global Search (0%)

**Estimated Completion**: 3-4 weeks of development

---

## Architecture Overview

### Core Principles

1. **MCP-First Data Access** - All data fetching goes through MCP server tools, not direct database access
2. **Server-Side MCP Calls** - Next.js API routes handle MCP communication to avoid client-side SDK complexity
3. **Real-Time Interactivity** - Users can execute MCP tools dynamically and see live results
4. **Type-Safe Integration** - Full TypeScript typing for all MCP tool schemas and responses
5. **Performance Optimization** - Caching, pagination, and lazy loading for large datasets
6. **Enterprise UX** - Professional UI matching Phase 1's dark theme with shadcn/ui components

### Technology Stack

**Frontend**:
- Next.js 16.0.1 (App Router, React Server Components)
- React 19.2.0 (Client Components for interactivity)
- TypeScript 5+
- Tailwind CSS 4
- shadcn/ui + Radix UI
- lucide-react (icons)

**MCP Integration**:
- `@modelcontextprotocol/sdk` (already installed)
- Server-side MCP client in API routes
- Tool schema parsing and validation
- Dynamic form generation from schemas

**Data Handling**:
- SWR for client-side data fetching/caching
- Server-side caching for expensive MCP calls
- Pagination for large datasets
- Real-time tool execution

---

## Feature 1: Interactive API Playground

### Overview
A live playground where users can select any of the 54 MCP tools, fill in parameters via auto-generated forms, execute the tool, and view formatted JSON responses.

### User Stories
1. As a developer, I want to **browse all available MCP tools** so I can discover what data I can access.
2. As a developer, I want to **execute MCP tools with custom parameters** so I can test queries interactively.
3. As a developer, I want to **view formatted JSON responses** so I can understand the data structure.
4. As a developer, I want to **copy responses to clipboard** so I can use them in my code.
5. As a developer, I want to **see my execution history** so I can re-run previous queries.

### Technical Design

#### Component Architecture

```
/playground
├── page.tsx (Main playground page)
├── components/
│   ├── ToolSelector.tsx (Sidebar with 54 tools)
│   ├── ParameterForm.tsx (Dynamic form from schema)
│   ├── ResponseViewer.tsx (JSON viewer with syntax highlighting)
│   ├── ExecutionHistory.tsx (Recent executions list)
│   └── ToolDocumentation.tsx (Tool description and examples)
```

#### API Routes

```typescript
// /api/mcp/tools/route.ts
GET /api/mcp/tools
Response: { tools: ToolSchema[] }
Description: List all 54 MCP tools with schemas

// /api/mcp/call/route.ts
POST /api/mcp/call
Body: { toolName: string, parameters: Record<string, any> }
Response: { success: boolean, result: any, executionTime: number }
Description: Execute MCP tool and return result
```

#### MCP Integration Layer

**File**: `lib/mcp-client.ts`

```typescript
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

export interface ToolSchema {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description: string;
      enum?: string[];
      default?: any;
    }>;
    required?: string[];
  };
}

export class MCPClient {
  private client: Client;
  private transport: StdioClientTransport;
  private connected: boolean = false;

  async connect(): Promise<void> {
    if (this.connected) return;

    // Read MCP server config from trinitycore-mcp/.mcp.json
    const mcpConfig = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), '..', '.mcp.json'), 'utf8')
    );

    this.transport = new StdioClientTransport({
      command: mcpConfig.mcpServers.trinitycore.command,
      args: mcpConfig.mcpServers.trinitycore.args,
      env: mcpConfig.mcpServers.trinitycore.env,
    });

    this.client = new Client({
      name: 'trinitycore-web-ui',
      version: '1.0.0',
    }, {
      capabilities: {},
    });

    await this.client.connect(this.transport);
    this.connected = true;
  }

  async listTools(): Promise<ToolSchema[]> {
    await this.connect();
    const result = await this.client.listTools();
    return result.tools as ToolSchema[];
  }

  async callTool(name: string, parameters: Record<string, any>): Promise<any> {
    await this.connect();
    const startTime = Date.now();

    const result = await this.client.callTool({
      name,
      arguments: parameters,
    });

    const executionTime = Date.now() - startTime;

    return {
      success: true,
      result: result.content,
      executionTime,
    };
  }

  async disconnect(): Promise<void> {
    if (this.connected) {
      await this.client.close();
      this.connected = false;
    }
  }
}

// Singleton instance
let mcpClientInstance: MCPClient | null = null;

export function getMCPClient(): MCPClient {
  if (!mcpClientInstance) {
    mcpClientInstance = new MCPClient();
  }
  return mcpClientInstance;
}
```

#### Dynamic Form Generation

**File**: `app/playground/components/ParameterForm.tsx`

```typescript
'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ToolSchema } from '@/lib/mcp-client';

interface ParameterFormProps {
  tool: ToolSchema;
  onExecute: (parameters: Record<string, any>) => void;
  isExecuting: boolean;
}

export function ParameterForm({ tool, onExecute, isExecuting }: ParameterFormProps) {
  const [parameters, setParameters] = useState<Record<string, any>>({});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onExecute(parameters);
  };

  const renderField = (name: string, schema: any) => {
    const isRequired = tool.inputSchema.required?.includes(name);

    // Enum field (select dropdown)
    if (schema.enum) {
      return (
        <div key={name} className="space-y-2">
          <Label htmlFor={name}>
            {name} {isRequired && <span className="text-red-400">*</span>}
          </Label>
          <Select
            value={parameters[name] || schema.default || ''}
            onValueChange={(value) => setParameters({ ...parameters, [name]: value })}
          >
            <SelectTrigger id={name}>
              <SelectValue placeholder={`Select ${name}`} />
            </SelectTrigger>
            <SelectContent>
              {schema.enum.map((option: string) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-slate-400">{schema.description}</p>
        </div>
      );
    }

    // Number field
    if (schema.type === 'number' || schema.type === 'integer') {
      return (
        <div key={name} className="space-y-2">
          <Label htmlFor={name}>
            {name} {isRequired && <span className="text-red-400">*</span>}
          </Label>
          <Input
            id={name}
            type="number"
            value={parameters[name] || schema.default || ''}
            onChange={(e) => setParameters({ ...parameters, [name]: parseFloat(e.target.value) })}
            placeholder={schema.description}
            className="bg-slate-800 border-slate-700"
          />
          <p className="text-xs text-slate-400">{schema.description}</p>
        </div>
      );
    }

    // Boolean field
    if (schema.type === 'boolean') {
      return (
        <div key={name} className="space-y-2">
          <Label htmlFor={name} className="flex items-center gap-2">
            <input
              id={name}
              type="checkbox"
              checked={parameters[name] || schema.default || false}
              onChange={(e) => setParameters({ ...parameters, [name]: e.target.checked })}
              className="w-4 h-4"
            />
            {name} {isRequired && <span className="text-red-400">*</span>}
          </Label>
          <p className="text-xs text-slate-400">{schema.description}</p>
        </div>
      );
    }

    // String field (default)
    return (
      <div key={name} className="space-y-2">
        <Label htmlFor={name}>
          {name} {isRequired && <span className="text-red-400">*</span>}
        </Label>
        <Input
          id={name}
          type="text"
          value={parameters[name] || schema.default || ''}
          onChange={(e) => setParameters({ ...parameters, [name]: e.target.value })}
          placeholder={schema.description}
          className="bg-slate-800 border-slate-700"
        />
        <p className="text-xs text-slate-400">{schema.description}</p>
      </div>
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {Object.entries(tool.inputSchema.properties).map(([name, schema]) =>
        renderField(name, schema)
      )}

      <Button
        type="submit"
        disabled={isExecuting}
        className="w-full bg-blue-600 hover:bg-blue-700"
      >
        {isExecuting ? 'Executing...' : 'Execute Tool'}
      </Button>
    </form>
  );
}
```

#### JSON Response Viewer

**File**: `app/playground/components/ResponseViewer.tsx`

```typescript
'use client';

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ResponseViewerProps {
  response: any;
  executionTime?: number;
}

export function ResponseViewer({ response, executionTime }: ResponseViewerProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify(response, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="bg-slate-800/50 border-slate-700">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-white">Response</CardTitle>
          <div className="flex items-center gap-4">
            {executionTime !== undefined && (
              <span className="text-sm text-slate-400">
                Execution time: {executionTime}ms
              </span>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              className="text-slate-400 hover:text-white"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 mr-2" />
                  Copy
                </>
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <pre className="bg-slate-900 p-4 rounded-lg overflow-x-auto max-h-[600px] overflow-y-auto">
          <code className="text-sm text-slate-300 font-mono">
            {JSON.stringify(response, null, 2)}
          </code>
        </pre>
      </CardContent>
    </Card>
  );
}
```

### Implementation Steps

1. ✅ Create `lib/mcp-client.ts` with MCPClient class
2. ✅ Create `/api/mcp/tools/route.ts` endpoint
3. ✅ Create `/api/mcp/call/route.ts` endpoint
4. ✅ Create `app/playground/page.tsx` main page
5. ✅ Create `ToolSelector` component
6. ✅ Create `ParameterForm` component with dynamic field generation
7. ✅ Create `ResponseViewer` component with syntax highlighting
8. ✅ Create `ExecutionHistory` component with localStorage persistence
9. ✅ Add error handling and loading states
10. ✅ Test with all 54 MCP tools

**Estimated Time**: 3-4 days

---

## Feature 2: Spell Browser

### Overview
Browse, search, and explore all WoW spells using the `mcp__trinitycore__get-spell-info` tool with advanced filtering.

### User Stories
1. As a player, I want to **browse all spells** so I can discover abilities.
2. As a developer, I want to **filter spells by school** (Fire, Frost, etc.) so I can find specific spell types.
3. As a developer, I want to **search spells by name** so I can quickly find a specific spell.
4. As a developer, I want to **view spell details** (effects, range, cast time, cooldown) so I can understand mechanics.

### Technical Design

#### Component Architecture

```
/spells
├── page.tsx (Spell list with search/filter)
├── [spellId]/
│   └── page.tsx (Spell detail page)
└── components/
    ├── SpellCard.tsx (Spell preview card)
    ├── SpellFilters.tsx (School, level, class filters)
    └── SpellTooltip.tsx (WoW-style tooltip)
```

#### API Routes

```typescript
// /api/spell/route.ts
GET /api/spell?search=fireball&school=fire&minLevel=1&maxLevel=80
Response: { spells: Spell[], count: number, pagination: {...} }

// /api/spell/[spellId]/route.ts
GET /api/spell/133
Response: { spell: SpellDetails }
```

#### Data Model

```typescript
interface Spell {
  spellId: number;
  name: string;
  description: string;
  school: 'Physical' | 'Fire' | 'Frost' | 'Arcane' | 'Nature' | 'Shadow' | 'Holy';
  spellLevel: number;
  baseLevel: number;
  maxLevel: number;
  castTime: number; // milliseconds
  cooldown: number; // milliseconds
  range: number; // yards
  effects: SpellEffect[];
  icon?: string;
}

interface SpellEffect {
  effectIndex: number;
  effectType: string;
  basePoints: number;
  radiusIndex?: number;
  mechanic?: string;
}
```

#### MCP Integration

```typescript
// lib/spell-loader.ts
import { getMCPClient } from './mcp-client';

export async function getSpellInfo(spellId: number): Promise<Spell> {
  const client = getMCPClient();

  const result = await client.callTool('mcp__trinitycore__get-spell-info', {
    spellId,
  });

  return parseSpellData(result.result);
}

export async function searchSpells(query: string, filters: SpellFilters): Promise<Spell[]> {
  // Since MCP doesn't have bulk search, we'll need to either:
  // 1. Pre-load common spells and cache them
  // 2. Use DBC query tool if available
  // 3. Implement server-side spell index from DBC files

  const client = getMCPClient();

  // Option: Use query-dbc tool for bulk access
  const result = await client.callTool('mcp__trinitycore__query-dbc', {
    dbcFile: 'Spell.dbc',
    // Apply filters here
  });

  return parseSpellList(result.result, query, filters);
}
```

### Implementation Steps

1. ✅ Create `lib/spell-loader.ts` with MCP integration
2. ✅ Create `/api/spell/route.ts` endpoint
3. ✅ Create `/api/spell/[spellId]/route.ts` endpoint
4. ✅ Create `app/spells/page.tsx` with search/filter
5. ✅ Create `SpellCard` component
6. ✅ Create `SpellFilters` component
7. ✅ Create `app/spells/[spellId]/page.tsx` detail page
8. ✅ Create `SpellTooltip` component
9. ✅ Add pagination for large spell lists
10. ✅ Test with various spell queries

**Estimated Time**: 2-3 days

---

## Feature 3: Item Database

### Overview
Browse, search, and explore all WoW items using `mcp__trinitycore__get-item-info` tool.

### User Stories
1. As a player, I want to **browse all items** so I can discover gear.
2. As a developer, I want to **filter items by quality** (Common, Rare, Epic, Legendary) so I can find specific item tiers.
3. As a developer, I want to **filter items by class restriction** so I can find class-specific gear.
4. As a developer, I want to **view item stats and vendor prices** so I can understand item value.

### Technical Design

#### Component Architecture

```
/items
├── page.tsx (Item list with search/filter)
├── [itemId]/
│   └── page.tsx (Item detail page)
└── components/
    ├── ItemCard.tsx (Item preview card with icon)
    ├── ItemFilters.tsx (Quality, class, level, stats filters)
    └── ItemTooltip.tsx (WoW-style item tooltip)
```

#### API Routes

```typescript
// /api/item/route.ts
GET /api/item?search=thunderfury&quality=legendary&class=warrior
Response: { items: Item[], count: number, pagination: {...} }

// /api/item/[itemId]/route.ts
GET /api/item/19019
Response: { item: ItemDetails, pricing: ItemPricing }
```

#### Data Model

```typescript
interface Item {
  itemId: number;
  name: string;
  description: string;
  quality: 0 | 1 | 2 | 3 | 4 | 5; // Poor, Common, Uncommon, Rare, Epic, Legendary
  itemLevel: number;
  requiredLevel: number;
  class: number; // Item class (weapon, armor, etc.)
  subclass: number; // Item subclass
  inventoryType: number; // Equipment slot
  stats: ItemStat[];
  vendorPrice: number; // In copper
  stackable: number;
  icon?: string;
}

interface ItemStat {
  type: number; // Stat type (strength, agility, etc.)
  value: number;
}

interface ItemPricing {
  vendorBuy: number;
  vendorSell: number;
  estimatedMarketValue: number;
}
```

#### MCP Integration

```typescript
// lib/item-loader.ts
import { getMCPClient } from './mcp-client';

export async function getItemInfo(itemId: number): Promise<Item> {
  const client = getMCPClient();

  const result = await client.callTool('mcp__trinitycore__get-item-info', {
    itemId,
  });

  return parseItemData(result.result);
}

export async function getItemPricing(itemId: number): Promise<ItemPricing> {
  const client = getMCPClient();

  const result = await client.callTool('mcp__trinitycore__get-item-pricing', {
    itemId,
  });

  return result.result;
}
```

### Implementation Steps

1. ✅ Create `lib/item-loader.ts` with MCP integration
2. ✅ Create `/api/item/route.ts` endpoint
3. ✅ Create `/api/item/[itemId]/route.ts` endpoint
4. ✅ Create `app/items/page.tsx` with search/filter
5. ✅ Create `ItemCard` component
6. ✅ Create `ItemFilters` component with quality/class selectors
7. ✅ Create `app/items/[itemId]/page.tsx` detail page
8. ✅ Create `ItemTooltip` component with stats display
9. ✅ Add pagination for large item lists
10. ✅ Test with various item queries

**Estimated Time**: 2-3 days

---

## Feature 4: Creature Explorer

### Overview
Browse, search, and explore all WoW creatures using `mcp__trinitycore__get-creature-full-info` tool.

### User Stories
1. As a player, I want to **browse all creatures** so I can discover NPCs and monsters.
2. As a developer, I want to **filter creatures by type** (Beast, Humanoid, Undead, etc.) so I can find specific creature families.
3. As a developer, I want to **find vendors and trainers** so I can locate service NPCs.
4. As a developer, I want to **view creature loot tables** so I can understand drop rates.

### Technical Design

#### Component Architecture

```
/creatures
├── page.tsx (Creature list with search/filter)
├── [creatureId]/
│   └── page.tsx (Creature detail page)
└── components/
    ├── CreatureCard.tsx (Creature preview card)
    ├── CreatureFilters.tsx (Type, classification, vendor/trainer filters)
    ├── LootTable.tsx (Loot drops display)
    └── VendorInventory.tsx (Vendor items display)
```

#### API Routes

```typescript
// /api/creature/route.ts
GET /api/creature?search=onyxia&type=dragonkin&isBoss=true
Response: { creatures: Creature[], count: number, pagination: {...} }

// /api/creature/[creatureId]/route.ts
GET /api/creature/10184
Response: { creature: CreatureDetails, vendor?: VendorItems[], trainer?: TrainerSpells[], loot?: LootTable[] }
```

#### Data Model

```typescript
interface Creature {
  entry: number;
  name: string;
  subname: string;
  type: 'None' | 'Beast' | 'Dragonkin' | 'Demon' | 'Elemental' | 'Giant' | 'Undead' | 'Humanoid' | 'Critter' | 'Mechanical' | 'NotSpecified' | 'Totem' | 'NonCombatPet' | 'GasCloud';
  family: number;
  rank: 0 | 1 | 2 | 3 | 4; // Normal, Elite, Rare Elite, Boss, Rare
  minLevel: number;
  maxLevel: number;
  faction: number;
  health: number;
  mana: number;
  isVendor: boolean;
  isTrainer: boolean;
  isBoss: boolean;
}

interface VendorItem {
  itemId: number;
  itemName: string;
  price: number; // In copper
  maxCount: number; // 0 = unlimited
}

interface TrainerSpell {
  spellId: number;
  spellName: string;
  cost: number; // In copper
  requiredLevel: number;
}

interface LootItem {
  itemId: number;
  itemName: string;
  dropChance: number; // Percentage
  minCount: number;
  maxCount: number;
}
```

#### MCP Integration

```typescript
// lib/creature-loader.ts
import { getMCPClient } from './mcp-client';

export async function getCreatureFullInfo(entry: number, includeLoot: boolean = false): Promise<CreatureDetails> {
  const client = getMCPClient();

  const result = await client.callTool('mcp__trinitycore__get-creature-full-info', {
    entry,
    includeLoot,
  });

  return parseCreatureData(result.result);
}

export async function searchCreatures(filters: CreatureFilters): Promise<Creature[]> {
  const client = getMCPClient();

  const result = await client.callTool('mcp__trinitycore__search-creatures', {
    name: filters.search,
    type: filters.type,
    classification: filters.rank,
    isVendor: filters.isVendor,
    isTrainer: filters.isTrainer,
    isBoss: filters.isBoss,
    limit: filters.limit || 50,
  });

  return result.result;
}
```

### Implementation Steps

1. ✅ Create `lib/creature-loader.ts` with MCP integration
2. ✅ Create `/api/creature/route.ts` endpoint
3. ✅ Create `/api/creature/[creatureId]/route.ts` endpoint
4. ✅ Create `app/creatures/page.tsx` with search/filter
5. ✅ Create `CreatureCard` component
6. ✅ Create `CreatureFilters` component
7. ✅ Create `app/creatures/[creatureId]/page.tsx` detail page
8. ✅ Create `LootTable` component
9. ✅ Create `VendorInventory` component
10. ✅ Test with various creature queries

**Estimated Time**: 2-3 days

---

## Feature 5: Advanced Global Search

### Overview
Unified search across all data types (API methods, spells, items, creatures, MCP tools) with real-time suggestions and keyboard shortcuts.

### User Stories
1. As a user, I want to **press Ctrl+K** to open quick search so I can access data from anywhere.
2. As a user, I want to **see search suggestions** as I type so I can quickly find what I need.
3. As a user, I want to **filter search by category** (spells, items, creatures, API) so I can narrow results.
4. As a user, I want to **see my recent searches** so I can quickly access previous queries.

### Technical Design

#### Component Architecture

```
/search
├── page.tsx (Full search results page)
└── components/
    ├── GlobalSearchModal.tsx (Ctrl+K modal overlay)
    ├── SearchInput.tsx (Input with autocomplete)
    ├── SearchSuggestions.tsx (Real-time suggestions dropdown)
    ├── SearchResults.tsx (Unified results display)
    └── SearchHistory.tsx (Recent searches)
```

#### Global Search Modal (Keyboard Shortcut)

```typescript
// app/components/GlobalSearchModal.tsx
'use client';

import { useState, useEffect } from 'react';
import { Search, Command } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

export function GlobalSearchModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');

  // Ctrl+K / Cmd+K keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors"
      >
        <Search className="w-4 h-4" />
        <span>Search...</span>
        <kbd className="ml-auto px-2 py-1 bg-slate-700 rounded text-xs">
          <Command className="w-3 h-3 inline" /> K
        </kbd>
      </button>

      {/* Modal */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-3xl bg-slate-900 border-slate-700">
          <div className="space-y-4">
            <Input
              type="text"
              placeholder="Search spells, items, creatures, API methods..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
              className="text-lg bg-slate-800 border-slate-700"
            />

            <SearchSuggestions query={query} onSelect={() => setIsOpen(false)} />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
```

#### API Routes

```typescript
// /api/search/route.ts
GET /api/search?q=fireball&categories=spells,items,api
Response: {
  results: {
    spells: Spell[],
    items: Item[],
    creatures: Creature[],
    apiMethods: APIMethod[],
    mcpTools: ToolSchema[]
  },
  totalCount: number,
  executionTime: number
}
```

#### Unified Search Index

```typescript
// lib/search-index.ts
export interface SearchResult {
  id: string;
  category: 'spell' | 'item' | 'creature' | 'api' | 'tool';
  title: string;
  description: string;
  url: string;
  metadata?: Record<string, any>;
}

export async function performGlobalSearch(
  query: string,
  categories?: string[]
): Promise<SearchResult[]> {
  const results: SearchResult[] = [];

  // Search API methods (from existing cache)
  if (!categories || categories.includes('api')) {
    const apiMethods = searchMethods(query);
    results.push(...apiMethods.map(m => ({
      id: m.method,
      category: 'api' as const,
      title: m.method,
      description: m.description,
      url: `/docs/${encodeURIComponent(m.method)}`,
      metadata: { className: m.className },
    })));
  }

  // Search spells (via MCP)
  if (!categories || categories.includes('spells')) {
    const spells = await searchSpells(query, {});
    results.push(...spells.map(s => ({
      id: `spell-${s.spellId}`,
      category: 'spell' as const,
      title: s.name,
      description: s.description,
      url: `/spells/${s.spellId}`,
      metadata: { school: s.school, level: s.spellLevel },
    })));
  }

  // Search items (via MCP)
  if (!categories || categories.includes('items')) {
    const items = await searchItems(query, {});
    results.push(...items.map(i => ({
      id: `item-${i.itemId}`,
      category: 'item' as const,
      title: i.name,
      description: i.description,
      url: `/items/${i.itemId}`,
      metadata: { quality: i.quality, level: i.itemLevel },
    })));
  }

  // Search creatures (via MCP)
  if (!categories || categories.includes('creatures')) {
    const creatures = await searchCreatures({ search: query, limit: 10 });
    results.push(...creatures.map(c => ({
      id: `creature-${c.entry}`,
      category: 'creature' as const,
      title: c.name,
      description: c.subname,
      url: `/creatures/${c.entry}`,
      metadata: { type: c.type, rank: c.rank },
    })));
  }

  // Search MCP tools
  if (!categories || categories.includes('tools')) {
    const tools = await getMCPClient().listTools();
    const matchingTools = tools.filter(t =>
      t.name.toLowerCase().includes(query.toLowerCase()) ||
      t.description.toLowerCase().includes(query.toLowerCase())
    );
    results.push(...matchingTools.map(t => ({
      id: `tool-${t.name}`,
      category: 'tool' as const,
      title: t.name,
      description: t.description,
      url: `/playground?tool=${encodeURIComponent(t.name)}`,
    })));
  }

  return results;
}
```

### Implementation Steps

1. ✅ Create `lib/search-index.ts` with unified search
2. ✅ Create `/api/search/route.ts` endpoint
3. ✅ Create `GlobalSearchModal` component with Ctrl+K shortcut
4. ✅ Create `SearchSuggestions` component with real-time results
5. ✅ Create `app/search/page.tsx` full search results page
6. ✅ Add search history with localStorage
7. ✅ Add category filtering
8. ✅ Integrate modal into main layout
9. ✅ Add keyboard navigation (arrow keys, Enter)
10. ✅ Test search performance with large datasets

**Estimated Time**: 2-3 days

---

## Implementation Timeline

### Week 1: Interactive API Playground
- Days 1-2: MCP client integration and API routes
- Days 3-4: Dynamic form generation and response viewer
- Day 5: Execution history and error handling

### Week 2: Data Browsers (Spells, Items, Creatures)
- Days 1-2: Spell Browser
- Days 2-3: Item Database
- Days 4-5: Creature Explorer

### Week 3: Advanced Search & Polish
- Days 1-2: Advanced Global Search
- Days 3-4: Performance optimization and caching
- Day 5: Testing, bug fixes, documentation

### Week 4: Testing & Deployment
- Days 1-2: End-to-end testing
- Days 3-4: Performance benchmarking
- Day 5: Production deployment and documentation

---

## Performance Targets

### Page Load Times
- Homepage: <500ms
- API Method Explorer: <800ms (7,808 methods)
- Spell/Item/Creature List: <1s (with pagination)
- Detail Pages: <300ms (single record)
- Search Results: <2s (unified search across all categories)

### MCP Tool Execution
- Simple queries (get-spell-info): <100ms
- Complex queries (search-creatures): <500ms
- Bulk operations (query-dbc): <2s

### Caching Strategy
- API documentation: In-memory cache (already implemented)
- MCP tool schemas: Cache for 1 hour
- Search results: Cache for 5 minutes
- Spell/Item/Creature data: Cache for 1 hour

---

## Quality Standards

### Code Quality
- ✅ Full TypeScript typing
- ✅ Comprehensive error handling
- ✅ Loading states for all async operations
- ✅ Responsive design (mobile, tablet, desktop)
- ✅ Accessibility (ARIA labels, keyboard navigation)

### Testing
- ✅ Unit tests for MCP client integration
- ✅ Integration tests for API routes
- ✅ E2E tests for critical user flows
- ✅ Performance testing with large datasets

### Documentation
- ✅ API route documentation
- ✅ Component usage examples
- ✅ MCP integration guide
- ✅ Deployment instructions

---

## Success Metrics

### Functionality
- ✅ All 54 MCP tools executable via playground
- ✅ 100% of spells/items/creatures browsable
- ✅ Search working across all categories
- ✅ Zero data loading errors

### Performance
- ✅ Page load times within targets
- ✅ MCP tool execution times within targets
- ✅ Cache hit rate >80%

### User Experience
- ✅ Intuitive navigation
- ✅ Professional UI matching Phase 1
- ✅ Fast, responsive interactions
- ✅ Helpful error messages

---

## Risk Mitigation

### Technical Risks

**Risk 1**: MCP server connection failures
**Mitigation**: Implement connection pooling, retry logic, fallback to cached data

**Risk 2**: Large dataset performance issues
**Mitigation**: Server-side pagination, lazy loading, aggressive caching

**Risk 3**: Type safety with MCP tool schemas
**Mitigation**: Generate TypeScript types from MCP tool schemas, runtime validation

**Risk 4**: Search performance across multiple categories
**Mitigation**: Parallel MCP queries, result limit per category, debounced search input

---

## Next Steps After Phase 2

### Phase 3: Real-Time Bot Control (Future)
- Live bot spawning via MCP tools
- Bot action monitoring dashboard
- Group composition builder
- Real-time combat logs

### Phase 4: Data Visualization (Future)
- Spell damage calculators
- Item stat comparisons
- Creature loot probability charts
- Bot performance metrics

---

## Conclusion

Phase 2 transforms the TrinityCore Web UI into a powerful, interactive data exploration platform. By leveraging the MCP server's 54 tools, we provide developers and players with real-time access to game data through an intuitive, enterprise-grade interface.

**Key Achievements**:
- Interactive API Playground for testing MCP tools
- Comprehensive data browsers for spells, items, and creatures
- Advanced global search across all data types
- Professional UX with dark theme and responsive design
- Performance-optimized with caching and pagination

**Phase 2 Completion Target**: 3-4 weeks
**Current Status**: 30% Complete (API Method Explorer done)
**Remaining Work**: 70% (5 major features)

---

**Document Version**: 1.0
**Last Updated**: 2025-11-01
**Author**: Claude Code
