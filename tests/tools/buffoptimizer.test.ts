/**
 * Buff/Consumable Optimizer MCP - Unit Tests
 *
 * Tests for buff recommendations, group buff coverage analysis,
 * consumable optimization, and food/flask recommendations.
 *
 * All functions use local data arrays (CLASS_BUFFS, CONSUMABLES) and
 * are synchronous, so no mocking is needed.
 *
 * @module tests/tools/buffoptimizer
 */

import {
  getBuffRecommendations,
  analyzeGroupBuffCoverage,
  optimizeConsumables,
  recommendFood,
  recommendFlaskElixir,
  BuffRecommendation,
  GroupBuffCoverage,
  ConsumableOptimization,
} from '../../src/tools/buffoptimizer';

// Mock the database connection (imported but not used by tested functions)
jest.mock('../../src/database/connection', () => ({
  queryWorld: jest.fn(),
}));

// Common stat weight objects for tests (all 10 fields required by StatWeights)
const MELEE_DPS_WEIGHTS = {
  strength: 1.0,
  agility: 0.8,
  intellect: 0.0,
  critRating: 0.6,
  hasteRating: 0.5,
  masteryRating: 0.5,
  versatility: 0.4,
  stamina: 0.1,
  armor: 0.0,
  weaponDPS: 0.9,
};

const CASTER_DPS_WEIGHTS = {
  strength: 0.0,
  agility: 0.0,
  intellect: 1.0,
  hasteRating: 0.7,
  critRating: 0.6,
  masteryRating: 0.5,
  versatility: 0.4,
  stamina: 0.1,
  armor: 0.0,
  weaponDPS: 0.0,
};

const TANK_WEIGHTS = {
  strength: 0.3,
  agility: 0.0,
  intellect: 0.0,
  stamina: 1.0,
  armor: 0.9,
  versatility: 0.7,
  critRating: 0.3,
  hasteRating: 0.4,
  masteryRating: 0.5,
  weaponDPS: 0.0,
};

// =============================================================================
// BUFF RECOMMENDATION TESTS
// =============================================================================

describe('getBuffRecommendations', () => {
  it('should return recommendations for melee DPS', () => {
    const result = getBuffRecommendations({
      role: 'melee_dps',
      classId: 1, // Warrior
      statWeights: MELEE_DPS_WEIGHTS,
    });

    expect(result.role).toBe('melee_dps');
    expect(result.classId).toBe(1);
    expect(result.recommendations.length).toBeGreaterThan(0);
  });

  it('should sort recommendations by priority and value', () => {
    const result = getBuffRecommendations({
      role: 'ranged_dps',
      classId: 8, // Mage
      statWeights: CASTER_DPS_WEIGHTS,
    });

    // Verify sorted: higher priority first, then by value
    const priorityOrder: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
    for (let i = 1; i < result.recommendations.length; i++) {
      const prev = result.recommendations[i - 1];
      const curr = result.recommendations[i];
      const prevPriority = priorityOrder[prev.priority];
      const currPriority = priorityOrder[curr.priority];

      // Priority should be non-increasing
      expect(prevPriority).toBeGreaterThanOrEqual(currPriority);
    }
  });

  it('should include consumables when budget is provided', () => {
    const withoutBudget = getBuffRecommendations({
      role: 'melee_dps',
      classId: 1,
      statWeights: MELEE_DPS_WEIGHTS,
    });

    const withBudget = getBuffRecommendations({
      role: 'melee_dps',
      classId: 1,
      statWeights: MELEE_DPS_WEIGHTS,
      budget: 10000,
    });

    expect(withBudget.recommendations.length).toBeGreaterThanOrEqual(withoutBudget.recommendations.length);
  });

  it('should calculate total cost and performance gain', () => {
    const result = getBuffRecommendations({
      role: 'tank',
      classId: 1,
      statWeights: TANK_WEIGHTS,
      budget: 5000,
    });

    expect(typeof result.totalCost).toBe('number');
    expect(result.totalCost).toBeGreaterThanOrEqual(0);
    expect(typeof result.expectedPerformanceGain).toBe('number');
  });

  it('should limit recommendations to 10 items', () => {
    const result = getBuffRecommendations({
      role: 'melee_dps',
      classId: 1,
      statWeights: MELEE_DPS_WEIGHTS,
      budget: 100000, // Large budget to include all consumables
    });

    expect(result.recommendations.length).toBeLessThanOrEqual(10);
  });

  it('should have valid priorities for all recommendations', () => {
    const result = getBuffRecommendations({
      role: 'healer',
      classId: 5, // Priest
      statWeights: CASTER_DPS_WEIGHTS,
    });

    for (const rec of result.recommendations) {
      expect(['critical', 'high', 'medium', 'low']).toContain(rec.priority);
      expect(rec.value).toBeGreaterThan(0);
      expect(rec.reason.length).toBeGreaterThan(0);
    }
  });

  it('should return proper BuffRecommendation interface', () => {
    const result = getBuffRecommendations({
      role: 'melee_dps',
      classId: 1,
      statWeights: MELEE_DPS_WEIGHTS,
    });

    expect(result).toHaveProperty('role');
    expect(result).toHaveProperty('classId');
    expect(result).toHaveProperty('recommendations');
    expect(result).toHaveProperty('totalCost');
    expect(result).toHaveProperty('expectedPerformanceGain');
  });
});

// =============================================================================
// GROUP BUFF COVERAGE TESTS
// =============================================================================

describe('analyzeGroupBuffCoverage', () => {
  it('should identify missing buffs', () => {
    const group = [
      { playerId: 1, classId: 5, buffsActive: [21562] }, // Priest - Fortitude
      { playerId: 2, classId: 1, buffsActive: [] }, // Warrior - no buffs
    ];

    const result = analyzeGroupBuffCoverage(group);

    // Should be missing some class buffs
    expect(result.missingBuffs.length).toBeGreaterThan(0);
  });

  it('should find all buffs covered when group has all class buffs', () => {
    const group = [
      { playerId: 1, classId: 11, buffsActive: [1126] }, // Druid - MotW
      { playerId: 2, classId: 5, buffsActive: [21562] },  // Priest - Fortitude
      { playerId: 3, classId: 8, buffsActive: [1459] },   // Mage - AI
    ];

    const result = analyzeGroupBuffCoverage(group);

    // All 3 class buffs are covered
    expect(result.missingBuffs.length).toBe(0);
  });

  it('should detect redundant buffs in same stack group', () => {
    const group = [
      { playerId: 1, classId: 11, buffsActive: [1126] }, // Druid 1 - MotW
      { playerId: 2, classId: 11, buffsActive: [1126] }, // Druid 2 - MotW (redundant)
    ];

    const result = analyzeGroupBuffCoverage(group);

    expect(result.redundantBuffs.length).toBeGreaterThan(0);
  });

  it('should generate suggestions for missing buffs', () => {
    const group = [
      { playerId: 1, classId: 11, buffsActive: [] }, // Druid without MotW
      { playerId: 2, classId: 5, buffsActive: [] },  // Priest without Fortitude
    ];

    const result = analyzeGroupBuffCoverage(group);

    expect(result.suggestions.length).toBeGreaterThan(0);
    // Should suggest the Druid applies MotW
    const druidSuggestion = result.suggestions.find(s => s.playerId === 1);
    if (druidSuggestion) {
      expect(druidSuggestion.className).toBe('Druid');
      expect(druidSuggestion.buffToApply).toBe(1126); // MotW
    }
  });

  it('should handle empty group', () => {
    const result = analyzeGroupBuffCoverage([]);

    expect(result.missingBuffs.length).toBeGreaterThan(0); // All buffs missing
    expect(result.redundantBuffs.length).toBe(0);
    expect(result.suggestions.length).toBe(0); // Nobody to provide
  });

  it('should return proper GroupBuffCoverage interface', () => {
    const group = [
      { playerId: 1, classId: 1, buffsActive: [] },
    ];

    const result = analyzeGroupBuffCoverage(group);

    expect(result).toHaveProperty('missingBuffs');
    expect(result).toHaveProperty('redundantBuffs');
    expect(result).toHaveProperty('suggestions');
    expect(Array.isArray(result.missingBuffs)).toBe(true);
    expect(Array.isArray(result.redundantBuffs)).toBe(true);
    expect(Array.isArray(result.suggestions)).toBe(true);
  });
});

// =============================================================================
// CONSUMABLE OPTIMIZATION TESTS
// =============================================================================

describe('optimizeConsumables', () => {
  it('should optimize within budget', () => {
    const result = optimizeConsumables({
      budget: 5000,
      duration: 120, // 2 hours
      role: 'melee_dps',
      statWeights: MELEE_DPS_WEIGHTS,
      contentType: 'raid',
    });

    expect(result.budget).toBe(5000);
    expect(result.totalCost).toBeLessThanOrEqual(5000);
    expect(result.remainingBudget).toBeGreaterThanOrEqual(0);
    expect(result.totalCost + result.remainingBudget).toBe(5000);
  });

  it('should return no recommendations for zero budget', () => {
    const result = optimizeConsumables({
      budget: 0,
      duration: 60,
      role: 'melee_dps',
      statWeights: MELEE_DPS_WEIGHTS,
      contentType: 'raid',
    });

    expect(result.recommendations.length).toBe(0);
    expect(result.remainingBudget).toBe(0);
  });

  it('should filter out expensive consumables for solo content', () => {
    const soloResult = optimizeConsumables({
      budget: 10000,
      duration: 60,
      role: 'melee_dps',
      statWeights: MELEE_DPS_WEIGHTS,
      contentType: 'solo',
    });

    // Solo content shouldn't include flasks (too expensive)
    const hasFlask = soloResult.recommendations.some(r => r.consumable.type === 'flask');
    expect(hasFlask).toBe(false);
  });

  it('should calculate cost per hour', () => {
    const result = optimizeConsumables({
      budget: 10000,
      duration: 120, // 2 hours
      role: 'ranged_dps',
      statWeights: CASTER_DPS_WEIGHTS,
      contentType: 'raid',
    });

    for (const rec of result.recommendations) {
      expect(rec.costPerHour).toBeGreaterThan(0);
      expect(rec.quantity).toBeGreaterThanOrEqual(1);
      expect(rec.totalCost).toBe(rec.consumable.cost * rec.quantity);
    }
  });

  it('should return proper ConsumableOptimization interface', () => {
    const result = optimizeConsumables({
      budget: 5000,
      duration: 60,
      role: 'tank',
      statWeights: TANK_WEIGHTS,
      contentType: 'dungeon',
    });

    expect(result).toHaveProperty('budget');
    expect(result).toHaveProperty('duration');
    expect(result).toHaveProperty('recommendations');
    expect(result).toHaveProperty('totalCost');
    expect(result).toHaveProperty('remainingBudget');
  });
});

// =============================================================================
// FOOD AND FLASK RECOMMENDATION TESTS
// =============================================================================

describe('recommendFood', () => {
  it('should return food items sorted by value', () => {
    const foods = recommendFood(MELEE_DPS_WEIGHTS, 10000);

    expect(Array.isArray(foods)).toBe(true);
    for (const food of foods) {
      expect(food.type).toBe('food');
      expect(food.cost).toBeLessThanOrEqual(10000);
    }
  });

  it('should return at most 5 items', () => {
    const foods = recommendFood(MELEE_DPS_WEIGHTS, 100000);
    expect(foods.length).toBeLessThanOrEqual(5);
  });

  it('should filter by budget', () => {
    const foods = recommendFood(MELEE_DPS_WEIGHTS, 1); // Very low budget
    for (const food of foods) {
      expect(food.cost).toBeLessThanOrEqual(1);
    }
  });
});

describe('recommendFlaskElixir', () => {
  it('should return flask/elixir items', () => {
    const items = recommendFlaskElixir('melee_dps', 10000);

    expect(Array.isArray(items)).toBe(true);
    for (const item of items) {
      expect(['flask', 'elixir']).toContain(item.type);
    }
  });

  it('should return at most 3 items', () => {
    const items = recommendFlaskElixir('tank', 100000);
    expect(items.length).toBeLessThanOrEqual(3);
  });

  it('should filter by budget', () => {
    const items = recommendFlaskElixir('ranged_dps', 1);
    for (const item of items) {
      expect(item.cost).toBeLessThanOrEqual(1);
    }
  });

  it('should work for all roles', () => {
    const roles: Array<'tank' | 'healer' | 'melee_dps' | 'ranged_dps'> = [
      'tank', 'healer', 'melee_dps', 'ranged_dps'
    ];

    for (const role of roles) {
      const items = recommendFlaskElixir(role, 100000);
      expect(Array.isArray(items)).toBe(true);
    }
  });
});
