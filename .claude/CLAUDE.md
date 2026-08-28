# CLAUDE CODE CONFIGURATION - TrinityCore MCP Server

This file provides guidance to Claude Code when working with the TrinityCore MCP Server project.

## OVERARCHING QUALITY RULES - FUNDAMENTAL PRINCIPLES

These rules apply to **ALL** development work on this project, **WITHOUT EXCEPTION**:

### 1. ENTERPRISE-GRADE QUALITY - ALWAYS
- **ALWAYS** maintain production-ready code quality
- **ALWAYS** follow TypeScript strict mode conventions
- **ALWAYS** implement comprehensive error handling
- **ALWAYS** include proper logging and monitoring
- **ALWAYS** write maintainable, well-documented code
- **ALWAYS** consider performance and scalability
- **ALWAYS** validate inputs and outputs
- **ALWAYS** handle edge cases and error conditions

### 2. FULL AND COMPLETE IMPLEMENTATIONS - MANDATORY
- **NEVER** implement partial solutions
- **NEVER** leave TODO comments or placeholders
- **NEVER** defer implementation of critical features
- **NEVER** skip error handling or validation
- **NEVER** compromise on completeness
- **ALWAYS** implement the full feature end-to-end
- **ALWAYS** include all necessary tests
- **ALWAYS** provide complete documentation

### 3. NO SHORTCUTS OR WORKAROUNDS - FORBIDDEN
- ❌ **NEVER** use simplified approaches
- ❌ **NEVER** create stub implementations
- ❌ **NEVER** comment out broken code
- ❌ **NEVER** bypass proper architecture
- ❌ **NEVER** skip validation steps
- ❌ **NEVER** use temporary solutions
- ❌ **NEVER** suggest "quick fixes"
- ✅ **ALWAYS** implement the proper solution
- ✅ **ALWAYS** follow established patterns
- ✅ **ALWAYS** maintain architectural integrity

### 4. TIME AND TOKENS ARE NEVER CONSTRAINTS
- **TOKENS ARE UNLIMITED** - Write comprehensive code, documentation, and tests
- **TIME IS UNLIMITED** - Take as long as needed to do it right
- **QUALITY FIRST** - Never rush or compromise quality for speed
- **COMPLETENESS FIRST** - Never suggest "we can add this later"
- **NO PHASES** - Implement complete solutions, not iterative placeholders
- **NO DEFERRAL** - Don't suggest splitting work to save time/tokens

---

## Project Context

### What is TrinityCore MCP Server?
The TrinityCore MCP Server is an **enterprise-grade Model Context Protocol server** written in TypeScript that provides **107 MCP tools** for TrinityCore bot development. It serves as a comprehensive development platform offering:

- **Game Data Access**: 40 tools for spells, items, quests, creatures, world data, DBC/DB2 parsing
- **Combat & Optimization**: 12 tools for talents, combat mechanics, buffs, dungeon strategy
- **Code Analysis**: 11 AI-powered code review tools with 1,020+ TrinityCore-specific rules
- **Performance & Testing**: 9 tools for performance analysis, testing automation, coverage
- **Database Operations**: 11 tools for schema exploration, backup/restore, migrations
- **Production Monitoring**: 11 tools for health monitoring, logging, backups, security
- **VMap/MMap Integration**: 8 tools for height detection and pathfinding
- **Web UI**: Full-featured Next.js 16 interface with 36+ pages

### Project Mission
Provide a **production-ready, enterprise-grade MCP server** that enables AI-powered development of TrinityCore PlayerBots through comprehensive game data access, code analysis, and automation tools.

### Technical Scope
- **Development Type**: Production MCP server with web interface
- **Technology Stack**: TypeScript 5.3+, Node.js 18+, Next.js 16, MySQL 9.4, MCP Protocol
- **Tool Count**: 107 registered MCP tools across 12 categories
- **Performance Target**: <100ms response time per tool call, <50MB memory usage
- **Platform Support**: Cross-platform (Windows, Linux, macOS)
- **Current Version**: 0.9.0-RC1 (Release Candidate 1)

---

## CRITICAL BEHAVIOR RULES - NEVER VIOLATE

Before ANY code implementation, Claude MUST:
1. **Read and acknowledge these rules explicitly**
2. **Confirm full implementation approach (no shortcuts)**
3. **Plan complete solution including tests and documentation**
4. **Follow TypeScript and MCP best practices**
5. **Validate against enterprise-grade quality standards**

### FORBIDDEN ACTIONS (IMMEDIATE STOP)
- ❌ Implementing simplified/stub solutions
- ❌ Using placeholder comments instead of real code (TODO, FIXME, etc.)
- ❌ Skipping comprehensive error handling
- ❌ Bypassing TypeScript type safety (using `any` without justification)
- ❌ Skipping input validation or output sanitization
- ❌ Suggesting "quick fixes" or "temporary solutions"
- ❌ Breaking MCP protocol compliance
- ❌ Compromising on performance or scalability
- ❌ Leaving incomplete tool implementations
- ❌ Skipping tests or documentation

### REQUIRED ACTIONS (MANDATORY)
- ✅ Full, complete implementation every time
- ✅ Comprehensive TypeScript type definitions
- ✅ Complete error handling with proper error types
- ✅ Input validation for all MCP tool parameters
- ✅ Performance optimization from the start
- ✅ Comprehensive logging for debugging and monitoring
- ✅ Complete unit tests for all tools
- ✅ Complete JSDoc documentation
- ✅ MCP protocol compliance validation
- ✅ Database connection pooling and proper cleanup

---

## MANDATORY WORKFLOW - NO EXCEPTIONS

### Phase 1: PLANNING (Required before any code)
1. **Acknowledge Rules**: "I acknowledge the enterprise-grade quality rules and no-shortcuts policy"
2. **Define Complete Solution**: Full implementation plan with all components
3. **Identify Dependencies**: Database schema, DBC/DB2 files, TrinityCore APIs, MCP protocol requirements
4. **Architecture Design**: Tool structure, error handling, validation, caching, performance
5. **Test Strategy**: Unit tests, integration tests, performance tests
6. **Documentation Plan**: JSDoc, API docs, usage examples
7. **Wait for Approval**: Explicit GO/NO-GO from developer

### Phase 2: IMPLEMENTATION (Only after approval)
- **Complete Tool Implementation**: Full MCP tool with all features
- **TypeScript Strict Mode**: No `any` types without justification, full type safety
- **Comprehensive Validation**: All inputs validated, all outputs sanitized
- **Error Handling**: Try-catch blocks, proper error types, descriptive messages
- **Performance**: Caching, connection pooling, query optimization
- **Logging**: Structured logging with appropriate levels (debug, info, warn, error)
- **Documentation**: Complete JSDoc with examples

### Phase 3: TESTING (Before delivery)
- **Unit Tests**: Test all tool functionality with jest
- **Integration Tests**: Test database connections, DBC/DB2 parsing, MCP protocol
- **Performance Tests**: Validate <100ms response time target
- **Error Handling Tests**: Test all error conditions
- **Edge Case Tests**: Boundary conditions, null/undefined, invalid inputs

### Phase 4: VALIDATION (Before delivery)
- **Self-Review**: Against enterprise-grade quality standards
- **MCP Compliance**: Verify MCP protocol adherence
- **Type Safety**: Confirm TypeScript strict mode compliance
- **Documentation**: Verify complete JSDoc and examples
- **Performance**: Confirm <100ms response time

---

## TYPESCRIPT DEVELOPMENT STANDARDS

### Type Safety Requirements
```typescript
// ✅ GOOD: Full type safety
interface SpellInfo {
  id: number;
  name: string;
  description: string;
  schoolMask: number;
  effects: SpellEffect[];
}

function getSpellInfo(spellId: number): Promise<SpellInfo | null> {
  // Full implementation with error handling
  if (spellId <= 0) {
    throw new Error(`Invalid spell ID: ${spellId}`);
  }
  // ... complete implementation
}

// ❌ BAD: Using 'any' type
function getSpellInfo(spellId: any): Promise<any> {
  // TODO: Implement later
  return null as any;
}
```

### Error Handling Requirements
```typescript
// ✅ GOOD: Comprehensive error handling
export async function getSpellInfo(spellId: number): Promise<SpellInfo | null> {
  try {
    // Validate input
    if (typeof spellId !== 'number' || spellId <= 0) {
      throw new ValidationError(`Invalid spell ID: ${spellId}`);
    }

    // Database query with proper connection handling
    const connection = await getConnection();
    try {
      const result = await connection.query('SELECT * FROM spell_template WHERE id = ?', [spellId]);
      if (!result || result.length === 0) {
        return null;
      }
      return parseSpellData(result[0]);
    } finally {
      connection.release(); // Always release connection
    }
  } catch (error) {
    // Proper error logging and re-throwing
    logger.error('Failed to get spell info', { spellId, error });
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new DatabaseError(`Failed to retrieve spell ${spellId}`, error);
  }
}

// ❌ BAD: Minimal error handling
export async function getSpellInfo(spellId: number) {
  const result = await connection.query('SELECT * FROM spell_template WHERE id = ?', [spellId]);
  return result[0]; // No validation, no error handling, connection leak
}
```

### Input Validation Requirements
```typescript
// ✅ GOOD: Complete validation
import { z } from 'zod';

const SpellInfoSchema = z.object({
  spellId: z.number().int().positive()
});

export async function getSpellInfoTool(args: unknown) {
  // Validate input against schema
  const parsed = SpellInfoSchema.safeParse(args);
  if (!parsed.success) {
    throw new ValidationError('Invalid parameters', parsed.error);
  }

  const { spellId } = parsed.data;
  return await getSpellInfo(spellId);
}

// ❌ BAD: No validation
export async function getSpellInfoTool(args: any) {
  return await getSpellInfo(args.spellId); // Unsafe access
}
```

---

## MCP TOOL DEVELOPMENT STANDARDS

### Tool Registration Requirements
```typescript
// ✅ GOOD: Complete tool registration
server.tool(
  "get-spell-info",
  "Get detailed spell information by ID. Returns spell name, description, schools, effects, damage/healing calculations, and resource costs.",
  {
    spellId: {
      type: "number",
      description: "Spell ID to query (must be positive integer)",
      required: true
    }
  },
  async (args: { spellId: number }) => {
    // Full implementation with validation, error handling, logging
    const startTime = Date.now();
    try {
      logger.debug('get-spell-info called', { spellId: args.spellId });

      const spellInfo = await getSpellInfo(args.spellId);

      const duration = Date.now() - startTime;
      logger.info('get-spell-info completed', { spellId: args.spellId, duration });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(spellInfo, null, 2)
          }
        ]
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('get-spell-info failed', { spellId: args.spellId, duration, error });
      throw error;
    }
  }
);

// ❌ BAD: Incomplete tool registration
server.tool("get-spell-info", "Get spell", {}, async (args: any) => {
  return await getSpellInfo(args.spellId); // No validation, logging, or error handling
});
```

### Performance Requirements
- **Response Time**: <100ms for 95th percentile
- **Database Connection Pooling**: Always use connection pool
- **Caching**: Implement caching for frequently accessed data (DBC/DB2, API docs)
- **Query Optimization**: Use indexed queries, limit result sets, avoid N+1 queries
- **Memory Management**: Proper cleanup, avoid memory leaks

```typescript
// ✅ GOOD: Proper connection pooling and caching
import { createPool, Pool } from 'mysql2/promise';
import NodeCache from 'node-cache';

const connectionPool: Pool = createPool({
  host: process.env.TRINITY_DB_HOST,
  port: parseInt(process.env.TRINITY_DB_PORT || '3306'),
  user: process.env.TRINITY_DB_USER,
  password: process.env.TRINITY_DB_PASSWORD,
  database: process.env.TRINITY_DB_WORLD,
  connectionLimit: 10,
  waitForConnections: true,
  queueLimit: 0
});

const cache = new NodeCache({ stdTTL: 3600, checkperiod: 600 });

export async function getSpellInfo(spellId: number): Promise<SpellInfo | null> {
  // Check cache first
  const cacheKey = `spell:${spellId}`;
  const cached = cache.get<SpellInfo>(cacheKey);
  if (cached) {
    return cached;
  }

  // Query database with connection from pool
  const connection = await connectionPool.getConnection();
  try {
    const [rows] = await connection.query<RowDataPacket[]>(
      'SELECT * FROM spell_template WHERE id = ?',
      [spellId]
    );

    if (rows.length === 0) {
      return null;
    }

    const spellInfo = parseSpellData(rows[0]);

    // Store in cache
    cache.set(cacheKey, spellInfo);

    return spellInfo;
  } finally {
    connection.release(); // Always release back to pool
  }
}

// ❌ BAD: Creating new connections every time
export async function getSpellInfo(spellId: number) {
  const connection = await mysql.createConnection({ /* config */ });
  const result = await connection.query('SELECT * FROM spell_template WHERE id = ?', [spellId]);
  // Never closes connection - memory leak
  return result[0];
}
```

---

## DATABASE ACCESS STANDARDS

### Connection Management
```typescript
// ✅ GOOD: Proper connection lifecycle
export async function executeQuery<T>(
  query: string,
  params: any[]
): Promise<T[]> {
  const connection = await connectionPool.getConnection();
  try {
    const [rows] = await connection.query<RowDataPacket[]>(query, params);
    return rows as T[];
  } catch (error) {
    logger.error('Query failed', { query, params, error });
    throw new DatabaseError('Query execution failed', error);
  } finally {
    connection.release(); // Always release
  }
}

// ❌ BAD: Connection leak
export async function executeQuery(query: string) {
  const connection = await connectionPool.getConnection();
  const result = await connection.query(query);
  return result; // Never released - leak
}
```

### Transaction Management
```typescript
// ✅ GOOD: Proper transaction handling
export async function updateSpellData(
  spellId: number,
  updates: Partial<SpellInfo>
): Promise<void> {
  const connection = await connectionPool.getConnection();
  try {
    await connection.beginTransaction();

    try {
      // Multiple queries in transaction
      await connection.query('UPDATE spell_template SET ? WHERE id = ?', [updates, spellId]);
      await connection.query('INSERT INTO spell_audit (spell_id, action) VALUES (?, ?)', [spellId, 'UPDATE']);

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    }
  } catch (error) {
    logger.error('Transaction failed', { spellId, error });
    throw new DatabaseError('Failed to update spell data', error);
  } finally {
    connection.release();
  }
}
```

---

## DBC/DB2 PARSING STANDARDS

### Parser Implementation Requirements
```typescript
// ✅ GOOD: Complete DBC/DB2 parser
export class DBCParser {
  private header: DBCHeader;
  private records: Map<number, any>;
  private stringBlock: Buffer;

  constructor(private filePath: string) {
    this.records = new Map();
  }

  async parse(): Promise<void> {
    try {
      // Read file
      const buffer = await fs.readFile(this.filePath);

      // Parse header
      this.header = this.parseHeader(buffer);

      // Validate header
      if (this.header.magic !== 'WDBC' && this.header.magic !== 'WDC5' && this.header.magic !== 'WDC6') {
        throw new ParseError(`Invalid DBC/DB2 magic: ${this.header.magic}`);
      }

      // Parse records
      const recordsOffset = this.getRecordsOffset();
      for (let i = 0; i < this.header.recordCount; i++) {
        const offset = recordsOffset + (i * this.header.recordSize);
        const record = this.parseRecord(buffer, offset);
        this.records.set(record.id, record);
      }

      // Parse string block
      this.stringBlock = this.parseStringBlock(buffer);

      logger.info('DBC/DB2 parsed successfully', {
        file: this.filePath,
        recordCount: this.records.size
      });
    } catch (error) {
      logger.error('DBC/DB2 parsing failed', { file: this.filePath, error });
      throw new ParseError(`Failed to parse ${this.filePath}`, error);
    }
  }

  getRecord(id: number): any | null {
    return this.records.get(id) || null;
  }

  getAllRecords(): any[] {
    return Array.from(this.records.values());
  }

  // ... complete implementation with all methods
}
```

---

## WEB UI DEVELOPMENT STANDARDS

### Next.js Component Requirements
```typescript
// ✅ GOOD: Complete Next.js component with error handling
'use client';

import { useState, useEffect } from 'react';
import { callMCPTool } from '@/lib/mcp-client';

interface SpellInfo {
  id: number;
  name: string;
  description: string;
}

export default function SpellBrowser() {
  const [spells, setSpells] = useState<SpellInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSpells();
  }, []);

  async function loadSpells() {
    setLoading(true);
    setError(null);

    try {
      const result = await callMCPTool('search-spells', {
        query: '',
        limit: 100
      });

      setSpells(result.spells);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load spells';
      setError(errorMessage);
      console.error('Failed to load spells', err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <div>Loading spells...</div>;
  }

  if (error) {
    return <div className="error">Error: {error}</div>;
  }

  return (
    <div>
      <h1>Spell Browser</h1>
      <ul>
        {spells.map(spell => (
          <li key={spell.id}>
            {spell.name} - {spell.description}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ❌ BAD: No error handling, loading states
export default function SpellBrowser() {
  const [spells, setSpells] = useState([]);

  useEffect(() => {
    callMCPTool('search-spells', {}).then(result => {
      setSpells(result.spells); // No error handling
    });
  }, []);

  return (
    <ul>
      {spells.map(spell => <li>{spell.name}</li>)}
    </ul>
  );
}
```

---

## TESTING STANDARDS

### Unit Test Requirements
```typescript
// ✅ GOOD: Comprehensive unit tests
import { getSpellInfo } from '../src/tools/spell';
import { DatabaseError, ValidationError } from '../src/utils/errors';

describe('getSpellInfo', () => {
  // Test valid spell ID
  it('should return spell info for valid spell ID', async () => {
    const spellInfo = await getSpellInfo(133); // Fireball

    expect(spellInfo).not.toBeNull();
    expect(spellInfo?.id).toBe(133);
    expect(spellInfo?.name).toBe('Fireball');
    expect(spellInfo?.schoolMask).toBeGreaterThan(0);
  });

  // Test invalid spell ID
  it('should return null for non-existent spell ID', async () => {
    const spellInfo = await getSpellInfo(999999999);
    expect(spellInfo).toBeNull();
  });

  // Test validation error
  it('should throw ValidationError for negative spell ID', async () => {
    await expect(getSpellInfo(-1)).rejects.toThrow(ValidationError);
  });

  // Test validation error for zero
  it('should throw ValidationError for zero spell ID', async () => {
    await expect(getSpellInfo(0)).rejects.toThrow(ValidationError);
  });

  // Test caching
  it('should cache spell info on second call', async () => {
    const spy = jest.spyOn(connectionPool, 'getConnection');

    await getSpellInfo(133);
    await getSpellInfo(133);

    expect(spy).toHaveBeenCalledTimes(1); // Only one DB call due to caching
  });

  // Test performance
  it('should complete within 100ms', async () => {
    const startTime = Date.now();
    await getSpellInfo(133);
    const duration = Date.now() - startTime;

    expect(duration).toBeLessThan(100);
  });
});

// ❌ BAD: Minimal testing
describe('getSpellInfo', () => {
  it('works', async () => {
    const result = await getSpellInfo(133);
    expect(result).toBeTruthy(); // Not specific enough
  });
});
```

---

## DOCUMENTATION STANDARDS

### JSDoc Requirements
```typescript
// ✅ GOOD: Complete JSDoc documentation
/**
 * Retrieves detailed spell information from the TrinityCore database.
 *
 * @param spellId - The spell ID to query (must be a positive integer)
 * @returns Promise resolving to SpellInfo object if found, null if not found
 * @throws {ValidationError} If spellId is invalid (<=0 or not a number)
 * @throws {DatabaseError} If database query fails
 *
 * @example
 * ```typescript
 * // Get Fireball spell
 * const fireball = await getSpellInfo(133);
 * console.log(fireball.name); // "Fireball"
 *
 * // Handle non-existent spell
 * const missing = await getSpellInfo(999999999);
 * console.log(missing); // null
 * ```
 *
 * @remarks
 * This function uses connection pooling and caching (1 hour TTL) for performance.
 * Cache is invalidated when spell data is updated via updateSpellData().
 *
 * @see {@link updateSpellData} for updating spell information
 * @see {@link SpellInfo} for the return type structure
 */
export async function getSpellInfo(spellId: number): Promise<SpellInfo | null> {
  // Implementation
}

// ❌ BAD: Minimal or missing documentation
// Get spell info
export async function getSpellInfo(spellId: number) {
  // ...
}
```

---

## STOP CONDITIONS

If Claude suggests ANY of the following, STOP immediately:

**Shortcut Indicators:**
- "For now, let's implement a simple..."
- "We can start with a basic version..."
- "Here's a quick solution..."
- "TODO: Implement proper..."
- "This is a simplified approach..."
- "Let's skip [X] for now..."
- "We'll add [X] later..."
- "To save time/tokens, we can..."

**Required Response:** "This violates the no-shortcuts rule. Time and tokens are not constraints. Please provide complete implementation with full error handling, validation, tests, and documentation."

**Type Safety Violations:**
- Using `any` type without justification
- Skipping TypeScript type definitions
- Bypassing strict mode checks
- Missing input validation

**Required Response:** "This violates TypeScript strict mode requirements. Please provide full type safety with proper interfaces and validation."

**Incomplete Implementation:**
- Missing error handling
- No input validation
- Missing tests
- Incomplete documentation
- No logging

**Required Response:** "This is an incomplete implementation. Please provide full error handling, validation, tests, logging, and documentation."

---

## PROJECT STRUCTURE

```
trinitycore-mcp/
├── src/                          # TypeScript source code
│   ├── index.ts                  # Main MCP server entry point
│   ├── tools/                    # 107 MCP tool implementations
│   │   ├── spell.ts              # Spell-related tools
│   │   ├── item.ts               # Item-related tools
│   │   ├── quest.ts              # Quest-related tools
│   │   ├── creature.ts           # Creature/NPC tools
│   │   ├── dbc.ts                # DBC/DB2 tools
│   │   ├── codereview.ts         # AI code review tools
│   │   ├── performance.ts        # Performance analysis tools
│   │   ├── database.ts           # Database operation tools
│   │   ├── vmap.ts               # VMap tools
│   │   ├── mmap.ts               # MMap tools
│   │   └── ... (48 more files)
│   ├── database/
│   │   ├── connection.ts         # MySQL connection pool
│   │   └── queries.ts            # Prepared queries
│   ├── parsers/
│   │   ├── dbc/                  # DBC/DB2 parsers
│   │   │   ├── DBCParser.ts
│   │   │   ├── WDC5Parser.ts
│   │   │   └── WDC6Parser.ts
│   │   └── cache/                # Caching system
│   │       └── CacheManager.ts
│   └── utils/
│       ├── logger.ts             # Structured logging
│       ├── errors.ts             # Custom error types
│       └── validation.ts         # Input validation
├── web-ui/                       # Next.js 16 web interface
│   ├── app/                      # App Router pages (36+ pages)
│   │   ├── page.tsx              # Homepage
│   │   ├── playground/           # MCP tool playground
│   │   ├── spells/               # Spell browser
│   │   ├── items/                # Item database
│   │   ├── creatures/            # Creature explorer
│   │   ├── dashboard/            # Analytics dashboard
│   │   ├── code-review/          # AI code review
│   │   ├── monitoring/           # Server monitoring
│   │   └── ... (29 more pages)
│   ├── components/               # React components
│   ├── lib/
│   │   ├── mcp-client.ts         # MCP client library
│   │   └── utils.ts              # Utilities
│   └── public/                   # Static assets
├── data/
│   └── api_docs/                 # 3,800+ API documentation files
├── tests/                        # Test suites
│   ├── unit/                     # Unit tests
│   ├── integration/              # Integration tests
│   └── performance/              # Performance tests
├── dist/                         # Compiled JavaScript (build output)
├── .claude/
│   └── CLAUDE.md                 # This file
├── package.json                  # v0.9.0-RC1
├── tsconfig.json                 # TypeScript strict mode config
└── README.md                     # Project overview
```

---

## COMMON TASKS

### Adding a New MCP Tool

**Complete Implementation Checklist:**
1. ✅ Create tool implementation in `src/tools/[category].ts`
2. ✅ Define TypeScript interfaces for input/output
3. ✅ Implement complete validation logic
4. ✅ Implement full error handling
5. ✅ Add connection pooling and caching
6. ✅ Add structured logging
7. ✅ Register tool in `src/index.ts`
8. ✅ Write comprehensive unit tests
9. ✅ Write integration tests
10. ✅ Add complete JSDoc documentation
11. ✅ Add usage examples in documentation
12. ✅ Test performance (<100ms target)
13. ✅ Update README.md tool count
14. ✅ Add Web UI page if applicable

### Updating Database Schema

**Complete Implementation Checklist:**
1. ✅ Create migration script with up/down paths
2. ✅ Test migration on dev database
3. ✅ Update TypeScript interfaces
4. ✅ Update affected tools
5. ✅ Update tests for new schema
6. ✅ Update documentation
7. ✅ Test rollback scenario
8. ✅ Add migration tracking

### Adding Web UI Page

**Complete Implementation Checklist:**
1. ✅ Create Next.js page component in `web-ui/app/`
2. ✅ Implement complete error handling
3. ✅ Add loading states
4. ✅ Add empty states
5. ✅ Implement responsive design
6. ✅ Add dark mode support
7. ✅ Write component tests
8. ✅ Add navigation links
9. ✅ Update sitemap
10. ✅ Test accessibility (WCAG 2.1)

---

## DEVELOPMENT COMMANDS

### Build & Run
```bash
# Build TypeScript to JavaScript
npm run build

# Start MCP server (stdio mode)
npm start

# Start both MCP server and Web UI
npm run start:all

# Development mode (watch for changes)
npm run dev

# Start Web UI only
npm run start:web
```

### Testing
```bash
# Run all tests
npm test

# Run specific test file
npm test -- spell.test.ts

# Run tests with coverage
npm test -- --coverage

# Run performance tests
npm run test:performance
```

### Code Quality
```bash
# Lint TypeScript
npm run lint

# Type check
npm run typecheck

# Format code
npm run format
```

---

## INTEGRATION WITH TRINITYCORE PLAYERBOT PROJECT

This MCP server is designed to work alongside the main TrinityCore Playerbot project:

- **TrinityCore Playerbot**: C++ game server with bot AI (`C:\TrinityBots\TrinityCore`)
- **TrinityCore MCP Server**: TypeScript MCP server providing tools (`C:\TrinityBots\trinitycore-mcp`)

**Integration Points:**
1. **Database Access**: MCP server queries same MySQL databases as TrinityCore
2. **DBC/DB2 Files**: MCP server reads DBC/DB2 files from TrinityCore build
3. **VMap/MMap Data**: MCP server accesses VMap/MMap files for height/pathfinding
4. **Code Analysis**: MCP server provides AI-powered code review for C++ bot code
5. **Performance Monitoring**: MCP server monitors bot performance metrics

**When Working Across Projects:**
- This project focuses on **MCP tool implementation (TypeScript)**
- Main project focuses on **bot AI implementation (C++)**
- Coordinate database schema changes between both projects
- Ensure API documentation stays synchronized

---

## PERFORMANCE TARGETS

All MCP tools must meet these performance targets:

- **Response Time**: <100ms for 95th percentile
- **Memory Usage**: <50MB for MCP server process
- **Database Connections**: Max 10 concurrent connections (connection pool)
- **Cache Hit Rate**: >90% for frequently accessed data (spells, items, API docs)
- **Tool Registration Time**: <500ms for all 107 tools
- **Web UI Load Time**: <1s for initial page load
- **API Call Latency**: <50ms for cached data, <100ms for database queries

**Performance Monitoring:**
- Log all tool call durations
- Track cache hit/miss rates
- Monitor database connection pool usage
- Alert on slow queries (>100ms)
- Profile memory usage regularly

---

## SECURITY REQUIREMENTS

### Input Validation
- **ALWAYS** validate all MCP tool parameters
- **ALWAYS** sanitize database query inputs (use parameterized queries)
- **NEVER** trust user input
- **ALWAYS** use prepared statements for SQL queries

### Database Security
- **ALWAYS** use connection pooling with limited connections
- **ALWAYS** use read-only database user for query tools
- **NEVER** expose raw SQL errors to clients
- **ALWAYS** log security-relevant events

### Web UI Security
- **ALWAYS** validate API inputs on server side
- **ALWAYS** sanitize output to prevent XSS
- **NEVER** expose sensitive configuration in client-side code
- **ALWAYS** use HTTPS in production

---

## VERSION INFORMATION

- **Current Version**: 0.9.0-RC1 (Release Candidate 1)
- **Node.js**: 18+ required
- **TypeScript**: 5.3.3
- **Next.js**: 16
- **MySQL**: 9.4
- **MCP Protocol**: Latest specification

---

## CONTACT & SUPPORT

- **Repository**: https://github.com/agatho/trinitycore-mcp
- **Issues**: https://github.com/agatho/trinitycore-mcp/issues
- **TrinityCore**: https://github.com/TrinityCore/TrinityCore
- **MCP Protocol**: https://modelcontextprotocol.io/

---

**Remember: Enterprise-grade quality, complete implementations, no shortcuts, unlimited time and tokens.**

**Generated with [Claude Code](https://claude.com/claude-code)**

Co-Authored-By: Claude <noreply@anthropic.com>
