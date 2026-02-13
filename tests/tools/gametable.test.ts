/**
 * GameTable (GT) File Reading Tool - Unit Tests
 *
 * Tests for GameTable file parsing, querying, and helper functions.
 * File system access is mocked to avoid dependency on actual GT files.
 *
 * @module tests/tools/gametable
 */

import {
  queryGameTable,
  getGameTableDoc,
  listGameTables,
  getGameTableValue,
  getCombatRating,
  getBaseMana,
  getXPForLevel,
  getHpPerSta,
  GAME_TABLES,
  GameTableInfo,
} from '../../src/tools/gametable';

// Mock the fs module for file-based tests
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
}));

const fs = require('fs');

// =============================================================================
// PURE FUNCTION TESTS (no mocking needed)
// =============================================================================

describe('listGameTables', () => {
  it('should return all 20 game tables', () => {
    const tables = listGameTables();

    expect(Object.keys(tables).length).toBe(20);
  });

  it('should include key game table files', () => {
    const tables = listGameTables();
    const files = Object.keys(tables);

    expect(files).toContain('CombatRatings.txt');
    expect(files).toContain('xp.txt');
    expect(files).toContain('HpPerSta.txt');
    expect(files).toContain('BaseMp.txt');
    expect(files).toContain('SpellScaling.txt');
  });

  it('should NOT include removed 12.0 tables', () => {
    const tables = listGameTables();
    const files = Object.keys(tables);

    // ChallengeModeDamage and ChallengeModeHealth were removed in 12.0
    expect(files).not.toContain('ChallengeModeDamage.txt');
    expect(files).not.toContain('ChallengeModeHealth.txt');
  });

  it('should have descriptions for all tables', () => {
    const tables = listGameTables();

    for (const [file, description] of Object.entries(tables)) {
      expect(typeof description).toBe('string');
      expect(description.length).toBeGreaterThan(5);
    }
  });

  it('should return same object as GAME_TABLES constant', () => {
    const tables = listGameTables();
    expect(tables).toBe(GAME_TABLES);
  });
});

describe('getGameTableDoc', () => {
  it('should return documentation for known table', () => {
    const doc = getGameTableDoc('CombatRatings.txt');

    expect(doc).toContain('CombatRatings.txt');
    expect(doc).toContain('Combat rating');
  });

  it('should return no documentation message for unknown table', () => {
    const doc = getGameTableDoc('NonExistent.txt');

    expect(doc).toContain('NonExistent.txt');
    expect(doc).toContain('No documentation available');
  });

  it('should return documentation for xp.txt', () => {
    const doc = getGameTableDoc('xp.txt');

    expect(doc).toContain('xp.txt');
    expect(doc).toContain('Experience');
  });

  it('should return documentation for HpPerSta.txt', () => {
    const doc = getGameTableDoc('HpPerSta.txt');

    expect(doc).toContain('HpPerSta.txt');
    expect(doc).toContain('Health');
  });
});

// =============================================================================
// GAME TABLE QUERY TESTS (mocked fs)
// =============================================================================

describe('queryGameTable', () => {
  const MOCK_TABLE = [
    'ID\tCrit - Melee\tHaste - Melee\tDodge',
    '1\t10.5\t8.2\t12.1',
    '2\t12.3\t9.5\t14.0',
    '3\t14.1\t10.8\t15.9',
    '60\t180.0\t128.0\t216.0',
    '80\t220.0\t156.0\t264.0',
  ].join('\n');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should parse a valid GameTable file', async () => {
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue(MOCK_TABLE);

    const result = await queryGameTable('CombatRatings.txt');

    expect(result.file).toBe('CombatRatings.txt');
    expect(result.error).toBeUndefined();
    expect(result.headers).toEqual(['Crit - Melee', 'Haste - Melee', 'Dodge']);
    expect(result.rowCount).toBe(5);
    expect(result.rows!.length).toBe(5);
  });

  it('should parse numeric values correctly', async () => {
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue(MOCK_TABLE);

    const result = await queryGameTable('CombatRatings.txt');

    const row1 = result.rows![0];
    expect(row1.id).toBe(1);
    expect(row1.values['Crit - Melee']).toBeCloseTo(10.5);
    expect(row1.values['Haste - Melee']).toBeCloseTo(8.2);
    expect(row1.values['Dodge']).toBeCloseTo(12.1);
  });

  it('should filter by row ID when specified', async () => {
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue(MOCK_TABLE);

    const result = await queryGameTable('CombatRatings.txt', 60);

    expect(result.rows!.length).toBe(1);
    expect(result.rows![0].id).toBe(60);
    expect(result.rows![0].values['Crit - Melee']).toBeCloseTo(180.0);
  });

  it('should return empty rows when row ID not found', async () => {
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue(MOCK_TABLE);

    const result = await queryGameTable('CombatRatings.txt', 999);

    expect(result.rows!.length).toBe(0);
  });

  it('should limit rows to maxRows parameter', async () => {
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue(MOCK_TABLE);

    const result = await queryGameTable('CombatRatings.txt', undefined, 2);

    expect(result.rows!.length).toBe(2);
  });

  it('should return error for non-existent file', async () => {
    fs.existsSync.mockReturnValue(false);

    const result = await queryGameTable('NonExistent.txt');

    expect(result.error).toBeDefined();
    expect(result.error).toContain('not found');
    expect(result.rows).toBeUndefined();
    expect(result.rowCount).toBe(0);
  });

  it('should return error for empty file', async () => {
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue('');

    const result = await queryGameTable('Empty.txt');

    expect(result.error).toBeDefined();
    expect(result.error).toContain('empty');
  });

  it('should handle file read errors gracefully', async () => {
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockImplementation(() => {
      throw new Error('Permission denied');
    });

    const result = await queryGameTable('CombatRatings.txt');

    expect(result.error).toBeDefined();
    expect(result.error).toContain('Permission denied');
  });

  it('should handle non-numeric values as 0', async () => {
    const tableWithNaN = 'ID\tCol1\tCol2\n1\tabc\t5.0';
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue(tableWithNaN);

    const result = await queryGameTable('Test.txt');

    expect(result.rows![0].values['Col1']).toBe(0);
    expect(result.rows![0].values['Col2']).toBeCloseTo(5.0);
  });

  it('should exclude ID column from headers', async () => {
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue(MOCK_TABLE);

    const result = await queryGameTable('CombatRatings.txt');

    expect(result.headers).not.toContain('ID');
    expect(result.headers.length).toBe(3);
  });

  it('should handle Windows line endings', async () => {
    const windowsTable = 'ID\tCol1\r\n1\t10.0\r\n2\t20.0\r\n';
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue(windowsTable);

    const result = await queryGameTable('Test.txt');

    expect(result.rows!.length).toBe(2);
    expect(result.rows![0].values['Col1']).toBeCloseTo(10.0);
  });
});

// =============================================================================
// HELPER FUNCTION TESTS (mocked fs)
// =============================================================================

describe('getGameTableValue', () => {
  const MOCK_TABLE = 'ID\tTotal\tDivisor\n60\t150000\t7\n80\t300000\t8';

  beforeEach(() => {
    jest.clearAllMocks();
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue(MOCK_TABLE);
  });

  it('should return value for specific row and column', async () => {
    const value = await getGameTableValue('xp.txt', 60, 'Total');

    expect(value).toBeCloseTo(150000);
  });

  it('should return null for non-existent row', async () => {
    const value = await getGameTableValue('xp.txt', 999, 'Total');
    expect(value).toBeNull();
  });

  it('should return null for non-existent column', async () => {
    const value = await getGameTableValue('xp.txt', 60, 'NonExistent');
    expect(value).toBeNull();
  });

  it('should return null for non-existent file', async () => {
    fs.existsSync.mockReturnValue(false);

    const value = await getGameTableValue('NonExistent.txt', 60, 'Total');
    expect(value).toBeNull();
  });
});

describe('getCombatRating', () => {
  const COMBAT_RATINGS_TABLE =
    'ID\tCrit - Melee\tCrit - Spell\tHaste - Melee\n60\t180.0\t180.0\t128.0\n80\t220.0\t220.0\t156.0';

  beforeEach(() => {
    jest.clearAllMocks();
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue(COMBAT_RATINGS_TABLE);
  });

  it('should return crit rating for level 60', async () => {
    const value = await getCombatRating(60, 'Crit - Melee');
    expect(value).toBeCloseTo(180.0);
  });

  it('should return haste rating for level 80', async () => {
    const value = await getCombatRating(80, 'Haste - Melee');
    expect(value).toBeCloseTo(156.0);
  });

  it('should return null for invalid level', async () => {
    const value = await getCombatRating(999, 'Crit - Melee');
    expect(value).toBeNull();
  });
});

describe('getBaseMana', () => {
  const BASE_MP_TABLE = 'ID\tWarrior\tMage\tPriest\n60\t0\t15000\t12000\n80\t0\t25000\t20000';

  beforeEach(() => {
    jest.clearAllMocks();
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue(BASE_MP_TABLE);
  });

  it('should return mana for Mage at level 60', async () => {
    const value = await getBaseMana(60, 'Mage');
    expect(value).toBeCloseTo(15000);
  });

  it('should return 0 mana for Warrior', async () => {
    const value = await getBaseMana(60, 'Warrior');
    expect(value).toBe(0);
  });
});

describe('getXPForLevel', () => {
  const XP_TABLE = 'ID\tTotal\tDivisor\n10\t10590\t1\n80\t300000\t8';

  beforeEach(() => {
    jest.clearAllMocks();
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue(XP_TABLE);
  });

  it('should return XP for level 80', async () => {
    const value = await getXPForLevel(80);
    expect(value).toBeCloseTo(300000);
  });

  it('should return null for invalid level', async () => {
    const value = await getXPForLevel(999);
    expect(value).toBeNull();
  });
});

describe('getHpPerSta', () => {
  const HP_PER_STA_TABLE = 'ID\tHealth\n60\t14.0\n80\t20.0';

  beforeEach(() => {
    jest.clearAllMocks();
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue(HP_PER_STA_TABLE);
  });

  it('should return HP per stamina for level 80', async () => {
    const value = await getHpPerSta(80);
    expect(value).toBeCloseTo(20.0);
  });

  it('should return HP per stamina for level 60', async () => {
    const value = await getHpPerSta(60);
    expect(value).toBeCloseTo(14.0);
  });
});

// =============================================================================
// GAME_TABLES CONSTANT TESTS
// =============================================================================

describe('GAME_TABLES constant', () => {
  it('should have 20 entries matching WoW 12.0', () => {
    expect(Object.keys(GAME_TABLES).length).toBe(20);
  });

  it('should include all expected categories', () => {
    const files = Object.keys(GAME_TABLES);

    // Artifact System
    expect(files).toContain('ArtifactKnowledgeMultiplier.txt');
    expect(files).toContain('ArtifactLevelXP.txt');

    // Character Stats
    expect(files).toContain('BaseMp.txt');
    expect(files).toContain('HpPerSta.txt');
    expect(files).toContain('SpellScaling.txt');

    // Combat Ratings
    expect(files).toContain('CombatRatings.txt');
    expect(files).toContain('CombatRatingsMultByILvl.txt');

    // Item Levels
    expect(files).toContain('ItemLevelByLevel.txt');

    // Experience
    expect(files).toContain('xp.txt');

    // Battle Pets
    expect(files).toContain('BattlePetXP.txt');
    expect(files).toContain('BattlePetTypeDamageMod.txt');

    // NPC Scaling
    expect(files).toContain('NPCManaCostScaler.txt');

    // Profession
    expect(files).toContain('BaseProfessionRatings.txt');
    expect(files).toContain('ProfessionRatings.txt');

    // Other
    expect(files).toContain('BarberShopCostBase.txt');
    expect(files).toContain('HonorLevel.txt');
  });

  it('should have .txt extension for all files', () => {
    for (const file of Object.keys(GAME_TABLES)) {
      expect(file.endsWith('.txt')).toBe(true);
    }
  });
});
