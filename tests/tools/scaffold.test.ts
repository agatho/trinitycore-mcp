/**
 * Smart Code Scaffold Generator - Unit Tests
 *
 * Comprehensive tests for the scaffold generation system covering
 * all scaffold types, configuration validation, and output quality.
 *
 * @module tests/tools/scaffold
 */

import {
  generateScaffold,
  listScaffoldTypes,
  ScaffoldConfig,
  ScaffoldType,
} from '../../src/tools/scaffold';

// =============================================================================
// Configuration Validation Tests
// =============================================================================

describe('Scaffold Configuration Validation', () => {
  it('should reject missing type', async () => {
    await expect(generateScaffold({
      type: '' as any,
      name: 'test',
      description: 'Test scaffold',
    })).rejects.toThrow();
  });

  it('should reject missing name', async () => {
    await expect(generateScaffold({
      type: 'mcp-tool',
      name: '',
      description: 'Test scaffold',
    })).rejects.toThrow();
  });

  it('should reject missing description', async () => {
    await expect(generateScaffold({
      type: 'mcp-tool',
      name: 'test-tool',
      description: '',
    })).rejects.toThrow();
  });

  it('should reject non-kebab-case names', async () => {
    await expect(generateScaffold({
      type: 'mcp-tool',
      name: 'TestTool',
      description: 'Test scaffold',
    })).rejects.toThrow(/kebab-case/);

    await expect(generateScaffold({
      type: 'mcp-tool',
      name: 'test_tool',
      description: 'Test scaffold',
    })).rejects.toThrow(/kebab-case/);
  });

  it('should accept valid kebab-case names', async () => {
    const result = await generateScaffold({
      type: 'mcp-tool',
      name: 'my-awesome-tool',
      description: 'A test tool',
    });
    expect(result.files.length).toBeGreaterThan(0);
  });
});

// =============================================================================
// MCP Tool Scaffold Tests
// =============================================================================

describe('MCP Tool Scaffold', () => {
  let result: Awaited<ReturnType<typeof generateScaffold>>;

  beforeAll(async () => {
    result = await generateScaffold({
      type: 'mcp-tool',
      name: 'reputation-tracker',
      description: 'Track and analyze reputation standings',
      parameters: [
        { name: 'factionId', type: 'number', description: 'Faction ID', required: true },
        { name: 'characterName', type: 'string', description: 'Character name', required: false },
      ],
      includeTests: true,
    });
  });

  it('should generate main tool file', () => {
    const mainFile = result.files.find(f => f.path.includes('src/tools/'));
    expect(mainFile).toBeDefined();
    expect(mainFile!.path).toBe('src/tools/reputation_tracker.ts');
  });

  it('should generate test file when includeTests is true', () => {
    const testFile = result.files.find(f => f.path.includes('tests/'));
    expect(testFile).toBeDefined();
  });

  it('should include proper imports', () => {
    const mainFile = result.files.find(f => f.path.includes('src/tools/'))!;
    expect(mainFile.content).toContain('import { queryWorld }');
    expect(mainFile.content).toContain('import { logger }');
  });

  it('should include error handling', () => {
    const mainFile = result.files.find(f => f.path.includes('src/tools/'))!;
    expect(mainFile.content).toContain('try {');
    expect(mainFile.content).toContain('catch (error)');
    expect(mainFile.content).toContain('throw new Error');
  });

  it('should include parameter validation', () => {
    const mainFile = result.files.find(f => f.path.includes('src/tools/'))!;
    expect(mainFile.content).toContain('Validate inputs');
  });

  it('should include logging', () => {
    const mainFile = result.files.find(f => f.path.includes('src/tools/'))!;
    expect(mainFile.content).toContain('logger.debug');
    expect(mainFile.content).toContain('logger.info');
    expect(mainFile.content).toContain('logger.error');
  });

  it('should generate registration snippet', () => {
    expect(result.registrationSnippet).toBeDefined();
    expect(result.registrationSnippet).toContain('reputation-tracker');
    expect(result.registrationSnippet).toContain('inputSchema');
  });

  it('should include instructions', () => {
    expect(result.instructions.length).toBeGreaterThan(0);
    expect(result.instructions.some(i => i.includes('index.ts'))).toBe(true);
  });

  it('should track generation time', () => {
    expect(result.generationTime).toBeGreaterThan(0);
    expect(result.generationTime).toBeLessThan(1000); // Should be fast
  });

  it('should count lines of code', () => {
    expect(result.totalLinesOfCode).toBeGreaterThan(0);
  });
});

// =============================================================================
// Database Tool Scaffold Tests
// =============================================================================

describe('Database Tool Scaffold', () => {
  it('should generate database tool with search, getById, and statistics', async () => {
    const result = await generateScaffold({
      type: 'database-tool',
      name: 'arena-stats',
      description: 'Arena team statistics and rankings',
      databaseTables: ['arena_team', 'arena_team_member'],
    });

    const mainFile = result.files.find(f => f.path.includes('src/tools/'))!;
    expect(mainFile).toBeDefined();
    expect(mainFile.content).toContain('searchArenaStats');
    expect(mainFile.content).toContain('getArenaStatsById');
    expect(mainFile.content).toContain('getArenaStatsStatistics');
    expect(mainFile.content).toContain('arena_team');
  });

  it('should include caching by default', async () => {
    const result = await generateScaffold({
      type: 'database-tool',
      name: 'loot-table',
      description: 'Loot table analysis',
      databaseTables: ['creature_loot_template'],
    });

    const mainFile = result.files.find(f => f.path.includes('src/tools/'))!;
    expect(mainFile.content).toContain('cache');
    expect(mainFile.content).toContain('CACHE_TTL');
  });

  it('should use parameterized queries', async () => {
    const result = await generateScaffold({
      type: 'database-tool',
      name: 'vendor-items',
      description: 'Vendor inventory browser',
      databaseTables: ['npc_vendor'],
    });

    const mainFile = result.files.find(f => f.path.includes('src/tools/'))!;
    // Should use ? placeholders, not string interpolation for values
    expect(mainFile.content).toContain('LIKE ?');
    expect(mainFile.content).toContain('entry = ?');
    expect(mainFile.content).toContain('LIMIT ?');
  });
});

// =============================================================================
// Parser Scaffold Tests
// =============================================================================

describe('Parser Scaffold', () => {
  it('should generate parser with schema, parse, and search functions', async () => {
    const result = await generateScaffold({
      type: 'parser',
      name: 'achievement-criteria',
      description: 'Achievement Criteria DB2 parser',
      db2Files: ['AchievementCriteria.db2'],
    });

    const mainFile = result.files.find(f => f.path.includes('src/parsers/'))!;
    expect(mainFile).toBeDefined();
    expect(mainFile.content).toContain('AchievementCriteriaRecord');
    expect(mainFile.content).toContain('AchievementCriteriaSchema');
    expect(mainFile.content).toContain('parseAchievementCriteriaRecord');
    expect(mainFile.content).toContain('findAchievementCriteriaById');
    expect(mainFile.content).toContain('searchAchievementCriteriaByName');
    expect(mainFile.content).toContain('AchievementCriteria.db2');
  });
});

// =============================================================================
// Web Page Scaffold Tests
// =============================================================================

describe('Web Page Scaffold', () => {
  it('should generate Next.js page with search, loading, error states', async () => {
    const result = await generateScaffold({
      type: 'web-page',
      name: 'guild-browser',
      description: 'Guild Browser',
    });

    const pageFile = result.files.find(f => f.path.includes('web-ui/app/'))!;
    expect(pageFile).toBeDefined();
    expect(pageFile.path).toContain('guild-browser/page.tsx');
    expect(pageFile.content).toContain("'use client'");
    expect(pageFile.content).toContain('useState');
    expect(pageFile.content).toContain('Loading...');
    expect(pageFile.content).toContain('Error:');
    expect(pageFile.content).toContain('No results found');
  });

  it('should include dark mode by default', async () => {
    const result = await generateScaffold({
      type: 'web-page',
      name: 'test-page',
      description: 'Test Page',
    });

    const pageFile = result.files[0];
    expect(pageFile.content).toContain('dark:');
  });
});

// =============================================================================
// API Route Scaffold Tests
// =============================================================================

describe('API Route Scaffold', () => {
  it('should generate API route with GET handler', async () => {
    const result = await generateScaffold({
      type: 'api-route',
      name: 'zone-data',
      description: 'Zone data API endpoint',
    });

    const routeFile = result.files[0];
    expect(routeFile.path).toContain('web-ui/app/api/zone-data/route.ts');
    expect(routeFile.content).toContain('export async function GET');
    expect(routeFile.content).toContain('NextRequest');
    expect(routeFile.content).toContain('NextResponse');
    expect(routeFile.content).toContain('status: 400');
    expect(routeFile.content).toContain('status: 500');
  });
});

// =============================================================================
// Utility Scaffold Tests
// =============================================================================

describe('Utility Scaffold', () => {
  it('should generate utility with types, error class, and function', async () => {
    const result = await generateScaffold({
      type: 'utility',
      name: 'format-helper',
      description: 'String and number formatting utilities',
    });

    const utilFile = result.files[0];
    expect(utilFile.path).toBe('src/utils/format_helper.ts');
    expect(utilFile.content).toContain('FormatHelperConfig');
    expect(utilFile.content).toContain('FormatHelperError');
    expect(utilFile.content).toContain('export function formatHelper');
  });
});

// =============================================================================
// Database Migration Scaffold Tests
// =============================================================================

describe('Database Migration Scaffold', () => {
  it('should generate SQL migration with CREATE TABLE and rollback', async () => {
    const result = await generateScaffold({
      type: 'database-migration',
      name: 'bot-personality',
      description: 'Add bot personality traits table',
      databaseTables: ['bot_personality_traits'],
    });

    const migrationFile = result.files[0];
    expect(migrationFile.path).toContain('migrations/');
    expect(migrationFile.path).toContain('bot_personality');
    expect(migrationFile.content).toContain('CREATE TABLE');
    expect(migrationFile.content).toContain('bot_personality_traits');
    expect(migrationFile.content).toContain('DOWN Migration');
    expect(migrationFile.content).toContain('DROP TABLE');
  });
});

// =============================================================================
// List Scaffold Types Tests
// =============================================================================

describe('listScaffoldTypes', () => {
  it('should list all 9 scaffold types', () => {
    const types = listScaffoldTypes();
    expect(types.length).toBe(9);
  });

  it('should include description for each type', () => {
    const types = listScaffoldTypes();
    for (const type of types) {
      expect(type.description).toBeTruthy();
      expect(type.outputDirectory).toBeTruthy();
      expect(type.type).toBeTruthy();
    }
  });

  it('should include all expected types', () => {
    const types = listScaffoldTypes();
    const typeNames = types.map(t => t.type);

    expect(typeNames).toContain('mcp-tool');
    expect(typeNames).toContain('database-tool');
    expect(typeNames).toContain('parser');
    expect(typeNames).toContain('web-page');
    expect(typeNames).toContain('api-route');
    expect(typeNames).toContain('web-component');
    expect(typeNames).toContain('unit-test');
    expect(typeNames).toContain('database-migration');
    expect(typeNames).toContain('utility');
  });
});

// =============================================================================
// Feature Flag Tests
// =============================================================================

describe('Feature Flags', () => {
  it('should include caching when requested', async () => {
    const result = await generateScaffold({
      type: 'mcp-tool',
      name: 'cached-tool',
      description: 'A tool with caching',
      features: ['caching'],
    });

    const mainFile = result.files[0];
    expect(mainFile.content).toContain('cache');
    expect(mainFile.content).toContain('CACHE_TTL');
  });

  it('should include performance tracking when requested', async () => {
    const result = await generateScaffold({
      type: 'mcp-tool',
      name: 'perf-tool',
      description: 'A tool with performance tracking',
      features: ['performance'],
    });

    const mainFile = result.files[0];
    expect(mainFile.content).toContain('performance.now()');
    expect(mainFile.content).toContain('executionTime');
  });
});
