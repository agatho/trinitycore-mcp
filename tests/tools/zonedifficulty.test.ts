/**
 * Zone Difficulty Calculator - Unit Tests
 *
 * Tests for the pure computation functions: calculateDifficultyRating
 * and exportZoneAnalysisMarkdown. Database-dependent functions are not
 * tested here (they require live DB or integration tests).
 *
 * @module tests/tools/zonedifficulty
 */

import {
  calculateDifficultyRating,
  exportZoneAnalysisMarkdown,
  ZoneInfo,
  MobStats,
  QuestStats,
  DifficultyRating,
  ZoneAnalysis,
} from '../../src/tools/zonedifficulty';

// Mock the database connection (imported by module but not used by pure functions)
jest.mock('../../src/database/connection', () => ({
  queryWorld: jest.fn(),
}));

// =============================================================================
// TEST DATA HELPERS
// =============================================================================

function createZoneInfo(overrides: Partial<ZoneInfo> = {}): ZoneInfo {
  return {
    id: 1,
    name: 'Test Zone',
    areaLevel: 30,
    expansion: 0,
    mapId: 0,
    ...overrides,
  };
}

function createMobStats(overrides: Partial<MobStats> = {}): MobStats {
  return {
    totalMobs: 100,
    avgLevel: 30,
    minLevel: 28,
    maxLevel: 32,
    eliteCount: 5,
    rareCount: 2,
    bossCount: 0,
    mobDensity: 10,
    dangerousAreas: [],
    ...overrides,
  };
}

function createQuestStats(overrides: Partial<QuestStats> = {}): QuestStats {
  return {
    totalQuests: 20,
    avgLevel: 30,
    minLevel: 28,
    maxLevel: 32,
    questDensity: 4.0,
    questTypes: { Normal: 15, Group: 3, Raid: 2 },
    dailyQuests: 3,
    eliteQuests: 2,
    ...overrides,
  };
}

// =============================================================================
// DIFFICULTY RATING CALCULATION TESTS
// =============================================================================

describe('calculateDifficultyRating', () => {
  it('should return difficulty on 1-10 scale', () => {
    const zone = createZoneInfo();
    const mobs = createMobStats();
    const quests = createQuestStats();

    const rating = calculateDifficultyRating(zone, mobs, quests);

    expect(rating.overall).toBeGreaterThanOrEqual(0);
    expect(rating.overall).toBeLessThanOrEqual(10);
    expect(rating.mobDifficulty).toBeGreaterThanOrEqual(0);
    expect(rating.mobDifficulty).toBeLessThanOrEqual(10);
    expect(rating.questDifficulty).toBeGreaterThanOrEqual(0);
    expect(rating.questDifficulty).toBeLessThanOrEqual(10);
  });

  it('should return "solo" recommendation for easy zones', () => {
    const zone = createZoneInfo();
    const mobs = createMobStats({
      eliteCount: 0,
      rareCount: 0,
      bossCount: 0,
    });
    const quests = createQuestStats({
      questTypes: { Normal: 20 },
      eliteQuests: 0,
    });

    const rating = calculateDifficultyRating(zone, mobs, quests);
    expect(rating.recommendation).toBe('solo');
  });

  it('should return "group" recommendation for elite-heavy zones', () => {
    const zone = createZoneInfo();
    const mobs = createMobStats({
      totalMobs: 100,
      eliteCount: 35, // 35% elite
    });
    const quests = createQuestStats({
      questTypes: { Normal: 10, Group: 10 },
    });

    const rating = calculateDifficultyRating(zone, mobs, quests);
    expect(rating.recommendation).toBe('group');
  });

  it('should return "raid" recommendation for boss-heavy zones', () => {
    const zone = createZoneInfo();
    const mobs = createMobStats({
      bossCount: 10,
    });
    const quests = createQuestStats({
      questTypes: { Normal: 10, Raid: 5 },
    });

    const rating = calculateDifficultyRating(zone, mobs, quests);
    expect(rating.recommendation).toBe('raid');
  });

  it('should return "mixed" for moderate elite presence', () => {
    const zone = createZoneInfo();
    const mobs = createMobStats({
      totalMobs: 100,
      eliteCount: 15, // 15% elite (above 10% threshold)
      bossCount: 0,
    });
    const quests = createQuestStats({
      questTypes: { Normal: 18, Group: 2 },
      eliteQuests: 1,
    });

    const rating = calculateDifficultyRating(zone, mobs, quests);
    expect(rating.recommendation).toBe('mixed');
  });

  it('should calculate player level range from mob stats', () => {
    const zone = createZoneInfo();
    const mobs = createMobStats({ minLevel: 25, maxLevel: 35, avgLevel: 30 });
    const quests = createQuestStats({ avgLevel: 30 });

    const rating = calculateDifficultyRating(zone, mobs, quests);

    expect(rating.playerLevelRange.min).toBeLessThanOrEqual(25);
    expect(rating.playerLevelRange.max).toBeGreaterThanOrEqual(35);
    expect(rating.playerLevelRange.optimal).toBe(30); // avg of mob and quest levels
  });

  it('should increase difficulty with higher elite percentages', () => {
    const zone = createZoneInfo();
    const quests = createQuestStats();

    const lowElite = calculateDifficultyRating(
      zone,
      createMobStats({ eliteCount: 2, totalMobs: 100 }),
      quests
    );
    const highElite = calculateDifficultyRating(
      zone,
      createMobStats({ eliteCount: 40, totalMobs: 100 }),
      quests
    );

    expect(highElite.mobDifficulty).toBeGreaterThanOrEqual(lowElite.mobDifficulty);
  });

  it('should increase difficulty with higher mob density', () => {
    const zone = createZoneInfo();
    const quests = createQuestStats();

    const lowDensity = calculateDifficultyRating(
      zone,
      createMobStats({ mobDensity: 10 }),
      quests
    );
    const highDensity = calculateDifficultyRating(
      zone,
      createMobStats({ mobDensity: 120 }),
      quests
    );

    expect(highDensity.mobDifficulty).toBeGreaterThanOrEqual(lowDensity.mobDifficulty);
  });

  it('should generate warnings for dangerous conditions', () => {
    const zone = createZoneInfo();
    const mobs = createMobStats({
      totalMobs: 100,
      eliteCount: 45, // 45% > 40% warning threshold
      bossCount: 2,
      mobDensity: 90, // > 80 warning threshold
      dangerousAreas: [{ name: 'Cave', avgLevel: 40, elitePercent: 80 }],
    });
    const quests = createQuestStats({
      totalQuests: 10,
      eliteQuests: 4, // 40% > 30% threshold
    });

    const rating = calculateDifficultyRating(zone, mobs, quests);

    expect(rating.warnings.length).toBeGreaterThan(0);
    // Should include elite warning
    expect(rating.warnings.some(w => w.includes('elite'))).toBe(true);
    // Should include boss warning
    expect(rating.warnings.some(w => w.includes('boss'))).toBe(true);
    // Should include dangerous areas warning
    expect(rating.warnings.some(w => w.includes('dangerous'))).toBe(true);
  });

  it('should generate tips for good leveling zones', () => {
    const zone = createZoneInfo();
    const mobs = createMobStats({ rareCount: 3 });
    const quests = createQuestStats({
      dailyQuests: 5,
      questDensity: 4.0,
      totalQuests: 25,
    });

    const rating = calculateDifficultyRating(zone, mobs, quests);

    expect(rating.tips.length).toBeGreaterThan(0);
    // Should include daily quest tip
    expect(rating.tips.some(t => t.includes('daily'))).toBe(true);
    // Should include rare spawn tip
    expect(rating.tips.some(t => t.includes('rare'))).toBe(true);
  });

  it('should handle zone with zero mobs without throwing', () => {
    const zone = createZoneInfo();
    const mobs = createMobStats({
      totalMobs: 0,
      avgLevel: 0,
      minLevel: 0,
      maxLevel: 0,
      eliteCount: 0,
      rareCount: 0,
      bossCount: 0,
      mobDensity: 0,
    });
    const quests = createQuestStats({ totalQuests: 10 });

    // Should not throw even with zero mobs (division by zero produces NaN)
    expect(() => calculateDifficultyRating(zone, mobs, quests)).not.toThrow();
    const rating = calculateDifficultyRating(zone, mobs, quests);
    expect(rating).toBeDefined();
    // NOTE: Zero totalMobs produces NaN from 0/0 division in elite/rare/boss percent
    // This is a known limitation - the function needs zero-guard for totalMobs
  });

  it('should handle zone with zero quests without throwing', () => {
    const zone = createZoneInfo();
    const mobs = createMobStats();
    const quests = createQuestStats({
      totalQuests: 0,
      avgLevel: 0,
      minLevel: 0,
      maxLevel: 0,
      questDensity: 0,
      questTypes: {},
      dailyQuests: 0,
      eliteQuests: 0,
    });

    // Should not throw even with zero quests
    expect(() => calculateDifficultyRating(zone, mobs, quests)).not.toThrow();
    const rating = calculateDifficultyRating(zone, mobs, quests);
    expect(rating).toBeDefined();
    // NOTE: Zero totalQuests produces NaN from 0/0 division in quest metrics
    // This is a known limitation - the function needs zero-guard for totalQuests
  });

  it('should cap all difficulty values at 10', () => {
    const zone = createZoneInfo();
    const mobs = createMobStats({
      totalMobs: 1000,
      avgLevel: 100,
      eliteCount: 500,
      rareCount: 200,
      bossCount: 100,
      mobDensity: 500,
      dangerousAreas: Array(10).fill({ name: 'Danger', avgLevel: 100, elitePercent: 100 }),
    });
    const quests = createQuestStats({
      totalQuests: 100,
      avgLevel: 100,
      eliteQuests: 50,
      questTypes: { Group: 30, Raid: 30, Normal: 40 },
    });

    const rating = calculateDifficultyRating(zone, mobs, quests);

    expect(rating.mobDifficulty).toBeLessThanOrEqual(10);
    expect(rating.questDifficulty).toBeLessThanOrEqual(10);
    expect(rating.overall).toBeLessThanOrEqual(10);
  });

  it('should return proper DifficultyRating interface', () => {
    const zone = createZoneInfo();
    const mobs = createMobStats();
    const quests = createQuestStats();

    const rating = calculateDifficultyRating(zone, mobs, quests);

    expect(rating).toHaveProperty('overall');
    expect(rating).toHaveProperty('mobDifficulty');
    expect(rating).toHaveProperty('questDifficulty');
    expect(rating).toHaveProperty('navigationDifficulty');
    expect(rating).toHaveProperty('recommendation');
    expect(rating).toHaveProperty('playerLevelRange');
    expect(rating).toHaveProperty('warnings');
    expect(rating).toHaveProperty('tips');
    expect(rating.playerLevelRange).toHaveProperty('min');
    expect(rating.playerLevelRange).toHaveProperty('max');
    expect(rating.playerLevelRange).toHaveProperty('optimal');
  });
});

// =============================================================================
// MARKDOWN EXPORT TESTS
// =============================================================================

describe('exportZoneAnalysisMarkdown', () => {
  function createZoneAnalysis(overrides: Partial<ZoneAnalysis> = {}): ZoneAnalysis {
    const zone = createZoneInfo({ name: 'Elwynn Forest', id: 12 });
    const mobs = createMobStats({ rareCount: 3, dangerousAreas: [{ name: 'Murloc Camp', avgLevel: 12, elitePercent: 20 }] });
    const quests = createQuestStats({ questTypes: { Normal: 15, Group: 5 } });
    const difficulty = calculateDifficultyRating(zone, mobs, quests);

    return {
      zone,
      mobs,
      quests,
      difficulty,
      ...overrides,
    };
  }

  it('should produce valid markdown with zone name as heading', () => {
    const analysis = createZoneAnalysis();
    const md = exportZoneAnalysisMarkdown(analysis);

    expect(md).toContain('# Elwynn Forest - Zone Analysis');
    expect(md).toContain('**Zone ID:** 12');
  });

  it('should include difficulty rating section', () => {
    const analysis = createZoneAnalysis();
    const md = exportZoneAnalysisMarkdown(analysis);

    expect(md).toContain('## Difficulty Rating');
    expect(md).toContain('**Overall:**');
    expect(md).toContain('**Mob Difficulty:**');
    expect(md).toContain('**Quest Difficulty:**');
    expect(md).toContain('**Recommendation:**');
  });

  it('should include mob statistics section', () => {
    const analysis = createZoneAnalysis();
    const md = exportZoneAnalysisMarkdown(analysis);

    expect(md).toContain('## Mob Statistics');
    expect(md).toContain('**Total Mobs:**');
    expect(md).toContain('**Elites:**');
    expect(md).toContain('**Rares:**');
  });

  it('should include dangerous areas when present', () => {
    const analysis = createZoneAnalysis();
    const md = exportZoneAnalysisMarkdown(analysis);

    expect(md).toContain('### Dangerous Areas');
    expect(md).toContain('Murloc Camp');
  });

  it('should include quest statistics section', () => {
    const analysis = createZoneAnalysis();
    const md = exportZoneAnalysisMarkdown(analysis);

    expect(md).toContain('## Quest Statistics');
    expect(md).toContain('**Total Quests:**');
    expect(md).toContain('**Daily Quests:**');
    expect(md).toContain('**Quest Density:**');
  });

  it('should include quest types when present', () => {
    const analysis = createZoneAnalysis();
    const md = exportZoneAnalysisMarkdown(analysis);

    expect(md).toContain('### Quest Types');
    expect(md).toContain('**Normal**');
    expect(md).toContain('**Group**');
  });

  it('should include warnings when present', () => {
    const analysis = createZoneAnalysis({
      mobs: createMobStats({
        totalMobs: 100,
        eliteCount: 50, // Triggers elite warning
        bossCount: 5,   // Triggers boss warning
      }),
    });
    // Recalculate difficulty to get warnings
    analysis.difficulty = calculateDifficultyRating(analysis.zone, analysis.mobs, analysis.quests);

    const md = exportZoneAnalysisMarkdown(analysis);

    if (analysis.difficulty.warnings.length > 0) {
      expect(md).toContain('## Warnings');
    }
  });

  it('should include tips when present', () => {
    const analysis = createZoneAnalysis();
    // Ensure tips exist
    analysis.difficulty = calculateDifficultyRating(analysis.zone, analysis.mobs, analysis.quests);

    const md = exportZoneAnalysisMarkdown(analysis);

    if (analysis.difficulty.tips.length > 0) {
      expect(md).toContain('## Tips');
    }
  });

  it('should handle empty dangerous areas gracefully', () => {
    const analysis = createZoneAnalysis({
      mobs: createMobStats({ dangerousAreas: [] }),
    });

    const md = exportZoneAnalysisMarkdown(analysis);

    // Should not contain dangerous areas section
    expect(md).not.toContain('### Dangerous Areas');
  });

  it('should handle empty quest types gracefully', () => {
    const analysis = createZoneAnalysis({
      quests: createQuestStats({ questTypes: {} }),
    });

    const md = exportZoneAnalysisMarkdown(analysis);

    // Should not contain quest types section
    expect(md).not.toContain('### Quest Types');
  });

  it('should produce non-empty output', () => {
    const analysis = createZoneAnalysis();
    const md = exportZoneAnalysisMarkdown(analysis);

    expect(md.length).toBeGreaterThan(100);
    expect(md.split('\n').length).toBeGreaterThan(10);
  });
});
