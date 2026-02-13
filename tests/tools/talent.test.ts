/**
 * Talent/Specialization Optimizer MCP - Unit Tests
 *
 * Tests for talent build recommendations, synergy calculations,
 * optimization, progression paths, and respec recommendations.
 *
 * All tested functions are synchronous and use local data (TALENT_BUILDS map),
 * so no mocking is needed.
 *
 * @module tests/tools/talent
 */

import {
  getClassSpecializations,
  getRecommendedTalentBuild,
  compareTalentTier,
  optimizeTalentBuild,
  calculateTalentSynergies,
  getTalentProgressionPath,
  recommendTalentRespec,
  SpecializationInfo,
  TalentBuild,
  TalentComparison,
  TalentOptimization,
  TalentSynergy,
} from '../../src/tools/talent';

// Mock the database connection (getClassSpecializations imports it but doesn't use it for logic)
jest.mock('../../src/database/connection', () => ({
  queryWorld: jest.fn(),
}));

// =============================================================================
// CLASS SPECIALIZATION TESTS
// =============================================================================

describe('getClassSpecializations', () => {
  it('should return all specs for Warrior (class 1)', async () => {
    const specs = await getClassSpecializations(1);

    expect(specs.length).toBe(3);
    const specNames = specs.map(s => s.specName);
    expect(specNames).toContain('Arms');
    expect(specNames).toContain('Fury');
    expect(specNames).toContain('Protection');
  });

  it('should return correct roles for Warrior specs', async () => {
    const specs = await getClassSpecializations(1);

    const arms = specs.find(s => s.specName === 'Arms');
    const fury = specs.find(s => s.specName === 'Fury');
    const prot = specs.find(s => s.specName === 'Protection');

    expect(arms?.role).toBe('melee_dps');
    expect(fury?.role).toBe('melee_dps');
    expect(prot?.role).toBe('tank');
  });

  it('should return correct primary stats', async () => {
    const warriorSpecs = await getClassSpecializations(1);
    for (const spec of warriorSpecs) {
      expect(spec.primaryStat).toBe('strength');
    }

    const mageSpecs = await getClassSpecializations(8);
    for (const spec of mageSpecs) {
      expect(spec.primaryStat).toBe('intellect');
    }

    const hunterSpecs = await getClassSpecializations(3);
    for (const spec of hunterSpecs) {
      expect(spec.primaryStat).toBe('agility');
    }
  });

  it('should return 4 specs for Druid (class 11)', async () => {
    const specs = await getClassSpecializations(11);

    expect(specs.length).toBe(4);
    const specNames = specs.map(s => s.specName);
    expect(specNames).toContain('Balance');
    expect(specNames).toContain('Feral');
    expect(specNames).toContain('Guardian');
    expect(specNames).toContain('Restoration');
  });

  it('should return 2 specs for Demon Hunter (class 12)', async () => {
    const specs = await getClassSpecializations(12);

    expect(specs.length).toBe(2);
    const specNames = specs.map(s => s.specName);
    expect(specNames).toContain('Havoc');
    expect(specNames).toContain('Vengeance');
  });

  it('should return 3 specs for Evoker (class 13)', async () => {
    const specs = await getClassSpecializations(13);

    expect(specs.length).toBe(3);
    const specNames = specs.map(s => s.specName);
    expect(specNames).toContain('Devastation');
    expect(specNames).toContain('Preservation');
    expect(specNames).toContain('Augmentation');
  });

  it('should return empty array for unknown class', async () => {
    const specs = await getClassSpecializations(99);
    expect(specs.length).toBe(0);
  });

  it('should include all 13 classes', async () => {
    for (let classId = 1; classId <= 13; classId++) {
      const specs = await getClassSpecializations(classId);
      expect(specs.length).toBeGreaterThanOrEqual(2);

      for (const spec of specs) {
        expect(spec.classId).toBe(classId);
        expect(spec.specId).toBeGreaterThan(0);
        expect(spec.specName.length).toBeGreaterThan(0);
        expect(['tank', 'healer', 'melee_dps', 'ranged_dps']).toContain(spec.role);
        expect(['strength', 'agility', 'intellect']).toContain(spec.primaryStat);
      }
    }
  });

  it('should set correct classId on all specs', async () => {
    const specs = await getClassSpecializations(5); // Priest
    for (const spec of specs) {
      expect(spec.classId).toBe(5);
      expect(spec.className).toBe('Priest');
    }
  });

  it('should have correct spec IDs for Mage', async () => {
    const specs = await getClassSpecializations(8);
    const specIds = specs.map(s => s.specId);

    expect(specIds).toContain(62); // Arcane
    expect(specIds).toContain(63); // Fire
    expect(specIds).toContain(64); // Frost
  });
});

// =============================================================================
// TALENT BUILD RECOMMENDATION TESTS
// =============================================================================

describe('getRecommendedTalentBuild', () => {
  it('should return a build for known spec + purpose', () => {
    const build = getRecommendedTalentBuild(64, 'raid', 80); // Frost Mage raid

    expect(build.specId).toBe(64);
    expect(build.purpose).toBe('raid');
    expect(build.talents.length).toBeGreaterThan(0);
    expect(build.score).toBeGreaterThanOrEqual(80);
    expect(build.description.length).toBeGreaterThan(0);
  });

  it('should fall back to raid build for unknown purpose', () => {
    const raid = getRecommendedTalentBuild(64, 'raid', 80);
    const dungeon = getRecommendedTalentBuild(64, 'dungeon', 80);

    // Dungeon has no specific build, so falls back to raid
    expect(dungeon.talents).toEqual(raid.talents);
  });

  it('should return a build even for unknown spec', () => {
    const build = getRecommendedTalentBuild(9999, 'raid', 80);

    expect(build.specId).toBe(9999);
    expect(build.purpose).toBe('raid');
    // May have empty talents but shouldn't throw
    expect(build.talents).toBeDefined();
  });

  it('should return leveling builds when available', () => {
    const build = getRecommendedTalentBuild(72, 'leveling', 50); // Fury Warrior leveling

    expect(build.purpose).toBe('leveling');
    expect(build.talents.length).toBeGreaterThan(0);
    expect(build.description).toContain('sustain');
  });

  it('should set proper build metadata', () => {
    const build = getRecommendedTalentBuild(63, 'raid', 80); // Fire Mage

    expect(build.buildId).toContain('raid');
    expect(build.synergies).toBeDefined();
    expect(Array.isArray(build.synergies)).toBe(true);
  });

  it('should return synergies for builds that have them', () => {
    const build = getRecommendedTalentBuild(63, 'raid', 80); // Fire Mage

    expect(build.synergies.length).toBeGreaterThan(0);
    for (const synergy of build.synergies) {
      expect(synergy.talent1).toBeGreaterThan(0);
      expect(synergy.talent2).toBeGreaterThan(0);
      expect(synergy.value).toBeGreaterThan(0);
      expect(['damage_multiplier', 'cooldown_reduction', 'resource_generation', 'proc_enabler'])
        .toContain(synergy.synergyType);
    }
  });

  it('should return builds for all DPS specs', () => {
    const dpsSpecs = [71, 72, 62, 63, 64, 259, 260, 254, 253, 252, 251, 267, 265, 102, 103, 262, 263, 258, 70, 577, 269, 1467];

    for (const specId of dpsSpecs) {
      const build = getRecommendedTalentBuild(specId, 'raid', 80);
      expect(build.specId).toBe(specId);
      expect(build.talents.length).toBeGreaterThan(0);
      expect(build.score).toBeGreaterThanOrEqual(80);
    }
  });
});

// =============================================================================
// TALENT TIER COMPARISON TESTS
// =============================================================================

describe('compareTalentTier', () => {
  it('should return options for the specified tier', () => {
    const comparison = compareTalentTier(64, 3, 'raid');

    expect(comparison.tier).toBe(3);
    expect(comparison.options.length).toBeGreaterThan(0);
  });

  it('should have proper recommendation values', () => {
    const comparison = compareTalentTier(64, 3, 'raid');

    for (const option of comparison.options) {
      expect(['best', 'situational', 'avoid']).toContain(option.recommendation);
      expect(option.score).toBeGreaterThan(0);
      expect(option.name.length).toBeGreaterThan(0);
      expect(option.reason.length).toBeGreaterThan(0);
    }
  });

  it('should include DPS, survival, and utility gains', () => {
    const comparison = compareTalentTier(64, 3, 'raid');

    for (const option of comparison.options) {
      expect(typeof option.dpsGain).toBe('number');
      expect(typeof option.survivalGain).toBe('number');
      expect(typeof option.utilityGain).toBe('number');
    }
  });

  it('should have at least one "best" recommendation', () => {
    const comparison = compareTalentTier(64, 3, 'raid');

    const bestOptions = comparison.options.filter(o => o.recommendation === 'best');
    expect(bestOptions.length).toBeGreaterThanOrEqual(1);
  });
});

// =============================================================================
// TALENT BUILD OPTIMIZATION TESTS
// =============================================================================

describe('optimizeTalentBuild', () => {
  it('should identify improvements when using suboptimal talents', () => {
    // Use an arbitrary talent set that differs from recommended
    const currentTalents = [10000, 10001, 10002, 10003, 10004, 10005, 10006];
    const optimization = optimizeTalentBuild(63, currentTalents, 'raid', 80);

    expect(optimization.currentBuild).toEqual(currentTalents);
    expect(optimization.recommendedBuild.length).toBeGreaterThan(0);
    expect(optimization.improvements.length).toBeGreaterThan(0);
    expect(optimization.totalGain).toBeGreaterThan(0);
  });

  it('should return no improvements when using optimal build', () => {
    // Get the recommended build and use it as current
    const recommended = getRecommendedTalentBuild(63, 'raid', 80);
    const optimization = optimizeTalentBuild(63, recommended.talents, 'raid', 80);

    expect(optimization.improvements.length).toBe(0);
    expect(optimization.totalGain).toBe(0);
  });

  it('should classify priority based on total gain', () => {
    const currentTalents = [10000, 10001, 10002, 10003, 10004, 10005, 10006];
    const optimization = optimizeTalentBuild(63, currentTalents, 'raid', 80);

    expect(['high', 'medium', 'low']).toContain(optimization.priority);
    if (optimization.totalGain > 10) {
      expect(optimization.priority).toBe('high');
    } else if (optimization.totalGain > 5) {
      expect(optimization.priority).toBe('medium');
    } else {
      expect(optimization.priority).toBe('low');
    }
  });

  it('should include tier and gain information in improvements', () => {
    const currentTalents = [10000, 10001, 10002, 10003, 10004, 10005, 10006];
    const optimization = optimizeTalentBuild(64, currentTalents, 'raid', 80);

    for (const improvement of optimization.improvements) {
      expect(improvement.tier).toBeGreaterThanOrEqual(1);
      expect(improvement.tier).toBeLessThanOrEqual(7);
      expect(improvement.gainPercent).toBeGreaterThan(0);
      expect(improvement.reason.length).toBeGreaterThan(0);
    }
  });

  it('should handle empty current talents', () => {
    const optimization = optimizeTalentBuild(63, [], 'raid', 80);

    expect(optimization.currentBuild).toEqual([]);
    // Should still work - recommending all talents as improvements
    expect(optimization.recommendedBuild.length).toBeGreaterThan(0);
  });
});

// =============================================================================
// TALENT SYNERGY CALCULATION TESTS
// =============================================================================

describe('calculateTalentSynergies', () => {
  it('should find synergies for a complete Fire Mage build', () => {
    // Fire Mage raid build talents
    const talents = [22456, 22458, 22463, 22465, 23071, 23072, 23079];
    const synergies = calculateTalentSynergies(talents);

    expect(synergies.length).toBeGreaterThan(0);
    for (const synergy of synergies) {
      expect(talents).toContain(synergy.talent1);
      expect(talents).toContain(synergy.talent2);
      expect(synergy.value).toBeGreaterThan(0);
      expect(synergy.description.length).toBeGreaterThan(0);
    }
  });

  it('should return empty array for unknown talents', () => {
    const synergies = calculateTalentSynergies([99999, 99998, 99997]);
    expect(synergies.length).toBe(0);
  });

  it('should not duplicate synergies', () => {
    const talents = [22456, 22458, 22463, 22465, 23071, 23072, 23079];
    const synergies = calculateTalentSynergies(talents);

    // Check no duplicate pairs
    const pairs = new Set<string>();
    for (const synergy of synergies) {
      const key1 = `${synergy.talent1}-${synergy.talent2}`;
      const key2 = `${synergy.talent2}-${synergy.talent1}`;
      expect(pairs.has(key1)).toBe(false);
      expect(pairs.has(key2)).toBe(false);
      pairs.add(key1);
    }
  });

  it('should require both talents present for synergy', () => {
    // Only include one talent from a known synergy pair
    const talents = [22463]; // Only Pyroblast, missing Combustion (23071)
    const synergies = calculateTalentSynergies(talents);

    // Should not find the 22463/23071 synergy since 23071 is missing
    const hasPyroCombustion = synergies.some(
      s => (s.talent1 === 22463 && s.talent2 === 23071) ||
           (s.talent1 === 23071 && s.talent2 === 22463)
    );
    expect(hasPyroCombustion).toBe(false);
  });

  it('should find synergies across different builds', () => {
    // Frost Mage synergy: 22446 + 23073
    const frostTalents = [22446, 22447, 22448, 23073, 23074, 23078, 23091];
    const synergies = calculateTalentSynergies(frostTalents);

    expect(synergies.length).toBeGreaterThan(0);
    const hasGlacialIceLance = synergies.some(
      s => (s.talent1 === 22446 && s.talent2 === 23073) ||
           (s.talent1 === 23073 && s.talent2 === 22446)
    );
    expect(hasGlacialIceLance).toBe(true);
  });

  it('should have valid synergy types', () => {
    const talents = [22463, 22465, 23071, 23072, 23079];
    const synergies = calculateTalentSynergies(talents);

    for (const synergy of synergies) {
      expect(['damage_multiplier', 'cooldown_reduction', 'resource_generation', 'proc_enabler'])
        .toContain(synergy.synergyType);
    }
  });
});

// =============================================================================
// TALENT PROGRESSION PATH TESTS
// =============================================================================

describe('getTalentProgressionPath', () => {
  it('should return progression for a level range', () => {
    const progression = getTalentProgressionPath(64, 1, 80);

    expect(progression.length).toBeGreaterThan(0);
    for (const step of progression) {
      expect(step.level).toBeGreaterThanOrEqual(1);
      expect(step.level).toBeLessThanOrEqual(80);
      expect(step.talentName.length).toBeGreaterThan(0);
      expect(step.reason.length).toBeGreaterThan(0);
    }
  });

  it('should respect start level', () => {
    const progression = getTalentProgressionPath(64, 40, 80);

    for (const step of progression) {
      expect(step.level).toBeGreaterThanOrEqual(40);
    }
  });

  it('should respect end level', () => {
    const progression = getTalentProgressionPath(64, 1, 50);

    for (const step of progression) {
      expect(step.level).toBeLessThanOrEqual(50);
    }
  });

  it('should return empty for invalid range', () => {
    const progression = getTalentProgressionPath(64, 80, 10);
    expect(progression.length).toBe(0);
  });

  it('should include known talent unlock levels', () => {
    const progression = getTalentProgressionPath(64, 1, 80);
    const levels = progression.map(p => p.level);

    // WoW talent unlock levels: 10, 15, 25, 30, 35, 40, 45, 50, 60, 70
    expect(levels).toContain(10);
    expect(levels).toContain(15);
    expect(levels).toContain(25);
  });
});

// =============================================================================
// TALENT RESPEC RECOMMENDATION TESTS
// =============================================================================

describe('recommendTalentRespec', () => {
  it('should recommend respec when purpose changes significantly', () => {
    const currentTalents = [10000, 10001, 10002, 10003, 10004, 10005, 10006];
    const result = recommendTalentRespec(63, 'raid', 'pvp', currentTalents);

    expect(result.shouldRespec).toBe(true);
    expect(result.expectedGain).toBeGreaterThan(0);
    expect(result.reason.length).toBeGreaterThan(0);
    expect(result.newBuild).toBeDefined();
    expect(result.newBuild.purpose).toBe('pvp');
  });

  it('should not recommend respec when builds are similar', () => {
    // Use the recommended raid build as current, and request raid again
    const recommended = getRecommendedTalentBuild(63, 'raid', 80);
    const result = recommendTalentRespec(63, 'raid', 'raid', recommended.talents);

    expect(result.shouldRespec).toBe(false);
    expect(result.reason).toContain('close enough');
  });

  it('should have zero cost (modern WoW free respecs)', () => {
    const result = recommendTalentRespec(63, 'raid', 'pvp', [1, 2, 3, 4, 5, 6, 7]);
    expect(result.cost).toBe(0);
  });

  it('should return a valid new build', () => {
    const result = recommendTalentRespec(64, 'leveling', 'raid', [1, 2, 3, 4, 5]);

    expect(result.newBuild.specId).toBe(64);
    expect(result.newBuild.purpose).toBe('raid');
    expect(result.newBuild.talents.length).toBeGreaterThan(0);
  });

  it('should calculate expected gain from synergy differences', () => {
    // Use a completely different talent set to ensure many differences
    const currentTalents = [99001, 99002, 99003, 99004, 99005, 99006, 99007];
    const result = recommendTalentRespec(63, 'raid', 'raid', currentTalents);

    // With 7 differences (all different), should recommend respec
    expect(result.shouldRespec).toBe(true);
    expect(result.expectedGain).toBeGreaterThan(0);
  });
});

// =============================================================================
// INTEGRATION TESTS (multiple functions working together)
// =============================================================================

describe('Talent System Integration', () => {
  it('should optimize a build and find synergies in the optimized version', () => {
    const suboptimalTalents = [10000, 10001, 10002, 10003, 10004, 10005, 10006];
    const optimization = optimizeTalentBuild(63, suboptimalTalents, 'raid', 80);
    const synergies = calculateTalentSynergies(optimization.recommendedBuild);

    // The recommended Fire Mage build should have synergies
    expect(synergies.length).toBeGreaterThan(0);
  });

  it('should provide consistent data across all functions for same spec', () => {
    const specId = 63; // Fire Mage
    const build = getRecommendedTalentBuild(specId, 'raid', 80);
    const synergies = calculateTalentSynergies(build.talents);

    // Build synergies should match standalone synergy calculation
    for (const buildSynergy of build.synergies) {
      const found = synergies.some(
        s => s.talent1 === buildSynergy.talent1 && s.talent2 === buildSynergy.talent2
      );
      expect(found).toBe(true);
    }
  });

  it('should cover all 13 WoW classes', async () => {
    const classNames = new Set<string>();

    for (let classId = 1; classId <= 13; classId++) {
      const specs = await getClassSpecializations(classId);
      expect(specs.length).toBeGreaterThanOrEqual(2);
      classNames.add(specs[0].className);
    }

    expect(classNames.size).toBe(13);
    expect(classNames).toContain('Warrior');
    expect(classNames).toContain('Paladin');
    expect(classNames).toContain('Hunter');
    expect(classNames).toContain('Rogue');
    expect(classNames).toContain('Priest');
    expect(classNames).toContain('Death Knight');
    expect(classNames).toContain('Shaman');
    expect(classNames).toContain('Mage');
    expect(classNames).toContain('Warlock');
    expect(classNames).toContain('Monk');
    expect(classNames).toContain('Druid');
    expect(classNames).toContain('Demon Hunter');
    expect(classNames).toContain('Evoker');
  });
});
