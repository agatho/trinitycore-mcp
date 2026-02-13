/**
 * Multi-Bot Coordination MCP - Unit Tests
 *
 * Tests for group composition analysis, cooldown coordination,
 * DPS optimization, formation strategy, and resource coordination.
 *
 * @module tests/tools/coordination
 */

import {
  analyzeGroupComposition,
  coordinateCooldowns,
  BotInfo,
  GroupComposition,
  CooldownCoordination,
} from '../../src/tools/coordination';

// Mock the database connection (imported but not used by tested functions)
jest.mock('../../src/database/connection', () => ({
  queryWorld: jest.fn(),
}));

// =============================================================================
// TEST DATA HELPERS
// =============================================================================

function createBot(overrides: Partial<BotInfo> = {}): BotInfo {
  return {
    botId: `bot_${Math.random().toString(36).slice(2, 8)}`,
    name: 'TestBot',
    classId: 1,
    className: 'Warrior',
    specId: 71,
    specName: 'Arms',
    level: 80,
    itemLevel: 450,
    role: 'melee_dps',
    position: { x: 0, y: 0, z: 0 },
    health: 100000,
    maxHealth: 100000,
    power: 100,
    maxPower: 100,
    powerType: 'rage',
    ...overrides,
  };
}

function createTank(overrides: Partial<BotInfo> = {}): BotInfo {
  return createBot({
    role: 'tank',
    classId: 1,
    className: 'Warrior',
    specId: 73,
    specName: 'Protection',
    health: 200000,
    maxHealth: 200000,
    ...overrides,
  });
}

function createHealer(overrides: Partial<BotInfo> = {}): BotInfo {
  return createBot({
    role: 'healer',
    classId: 5,
    className: 'Priest',
    specId: 257,
    specName: 'Holy',
    powerType: 'mana',
    power: 50000,
    maxPower: 50000,
    ...overrides,
  });
}

function createMeleeDps(overrides: Partial<BotInfo> = {}): BotInfo {
  return createBot({
    role: 'melee_dps',
    classId: 4,
    className: 'Rogue',
    specId: 260,
    specName: 'Outlaw',
    powerType: 'energy',
    power: 100,
    maxPower: 100,
    ...overrides,
  });
}

function createRangedDps(overrides: Partial<BotInfo> = {}): BotInfo {
  return createBot({
    role: 'ranged_dps',
    classId: 8,
    className: 'Mage',
    specId: 63,
    specName: 'Fire',
    powerType: 'mana',
    power: 50000,
    maxPower: 50000,
    ...overrides,
  });
}

function createStandard5ManGroup(): BotInfo[] {
  return [
    createTank({ name: 'MainTank', botId: 'tank_1' }),
    createHealer({ name: 'MainHealer', botId: 'healer_1' }),
    createMeleeDps({ name: 'MeleeDPS1', botId: 'dps_1' }),
    createRangedDps({ name: 'RangedDPS1', botId: 'dps_2' }),
    createMeleeDps({ name: 'MeleeDPS2', botId: 'dps_3', classId: 2, className: 'Paladin', specId: 70, specName: 'Retribution' }),
  ];
}

// =============================================================================
// GROUP COMPOSITION ANALYSIS TESTS
// =============================================================================

describe('analyzeGroupComposition', () => {
  it('should correctly categorize roles in a 5-man group', () => {
    const group = createStandard5ManGroup();
    const result = analyzeGroupComposition(group);

    expect(result.tanks.length).toBe(1);
    expect(result.healers.length).toBe(1);
    expect(result.meleeDps.length).toBe(2);
    expect(result.rangedDps.length).toBe(1);
    expect(result.bots.length).toBe(5);
  });

  it('should report strengths for a balanced group', () => {
    const group = createStandard5ManGroup();
    const result = analyzeGroupComposition(group);

    expect(result.strengths.length).toBeGreaterThan(0);
    // Should note good tank presence
    expect(result.strengths.some(s => s.includes('tank'))).toBe(true);
    // Should note good DPS count
    expect(result.strengths.some(s => s.includes('DPS'))).toBe(true);
  });

  it('should report weaknesses for a group with no tank', () => {
    const group = [
      createHealer({ botId: 'h1' }),
      createMeleeDps({ botId: 'd1' }),
      createMeleeDps({ botId: 'd2' }),
      createRangedDps({ botId: 'd3' }),
    ];

    const result = analyzeGroupComposition(group);

    expect(result.tanks.length).toBe(0);
    expect(result.weaknesses.some(w => w.includes('No tank'))).toBe(true);
    expect(result.recommendations.some(r => r.includes('tank'))).toBe(true);
    expect(result.balance).toBeLessThan(70);
  });

  it('should report weaknesses for a group with no healer', () => {
    const group = [
      createTank({ botId: 't1' }),
      createMeleeDps({ botId: 'd1' }),
      createMeleeDps({ botId: 'd2' }),
      createRangedDps({ botId: 'd3' }),
    ];

    const result = analyzeGroupComposition(group);

    expect(result.healers.length).toBe(0);
    expect(result.weaknesses.some(w => w.includes('No healer'))).toBe(true);
    expect(result.recommendations.some(r => r.includes('healer'))).toBe(true);
  });

  it('should report weaknesses for too few DPS', () => {
    const group = [
      createTank({ botId: 't1' }),
      createHealer({ botId: 'h1' }),
      createMeleeDps({ botId: 'd1' }),
    ];

    const result = analyzeGroupComposition(group);

    expect(result.weaknesses.some(w => w.includes('Low DPS') || w.includes('slow kill'))).toBe(true);
  });

  it('should note balanced melee/ranged when both present', () => {
    const group = createStandard5ManGroup();
    const result = analyzeGroupComposition(group);

    expect(result.strengths.some(s => s.includes('Balanced melee and ranged'))).toBe(true);
  });

  it('should note class diversity strength', () => {
    const group = [
      createTank({ botId: 't1', classId: 1, className: 'Warrior' }),
      createHealer({ botId: 'h1', classId: 5, className: 'Priest' }),
      createMeleeDps({ botId: 'd1', classId: 4, className: 'Rogue' }),
      createRangedDps({ botId: 'd2', classId: 8, className: 'Mage' }),
      createMeleeDps({ botId: 'd3', classId: 2, className: 'Paladin' }),
    ];

    const result = analyzeGroupComposition(group);

    expect(result.strengths.some(s => s.includes('class diversity'))).toBe(true);
  });

  it('should calculate balance score between 0 and 100', () => {
    const group = createStandard5ManGroup();
    const result = analyzeGroupComposition(group);

    expect(result.balance).toBeGreaterThanOrEqual(0);
    expect(result.balance).toBeLessThanOrEqual(100);
  });

  it('should calculate total DPS and HPS', () => {
    const group = createStandard5ManGroup();
    const result = analyzeGroupComposition(group);

    expect(typeof result.totalDps).toBe('number');
    expect(typeof result.totalHps).toBe('number');
    expect(result.totalDps).toBeGreaterThanOrEqual(0);
    expect(result.totalHps).toBeGreaterThanOrEqual(0);
  });

  it('should handle empty group', () => {
    const result = analyzeGroupComposition([]);

    expect(result.tanks.length).toBe(0);
    expect(result.healers.length).toBe(0);
    expect(result.meleeDps.length).toBe(0);
    expect(result.rangedDps.length).toBe(0);
    expect(result.weaknesses.length).toBeGreaterThan(0);
  });

  it('should handle single bot group', () => {
    const result = analyzeGroupComposition([createTank({ botId: 'solo' })]);

    expect(result.tanks.length).toBe(1);
    expect(result.healers.length).toBe(0);
    expect(result.weaknesses.length).toBeGreaterThan(0);
  });

  it('should return proper GroupComposition interface', () => {
    const group = createStandard5ManGroup();
    const result = analyzeGroupComposition(group);

    expect(result).toHaveProperty('groupId');
    expect(result).toHaveProperty('bots');
    expect(result).toHaveProperty('tanks');
    expect(result).toHaveProperty('healers');
    expect(result).toHaveProperty('meleeDps');
    expect(result).toHaveProperty('rangedDps');
    expect(result).toHaveProperty('totalDps');
    expect(result).toHaveProperty('totalHps');
    expect(result).toHaveProperty('balance');
    expect(result).toHaveProperty('strengths');
    expect(result).toHaveProperty('weaknesses');
    expect(result).toHaveProperty('recommendations');
  });

  it('should penalize too many tanks', () => {
    const group = [
      createTank({ botId: 't1', classId: 1 }),
      createTank({ botId: 't2', classId: 2 }),
      createTank({ botId: 't3', classId: 6 }),
      createHealer({ botId: 'h1' }),
      createMeleeDps({ botId: 'd1' }),
    ];

    const result = analyzeGroupComposition(group);
    expect(result.weaknesses.some(w => w.includes('Too many tanks'))).toBe(true);
  });

  it('should note multiple healers as a strength', () => {
    const group = [
      createTank({ botId: 't1' }),
      createHealer({ botId: 'h1', classId: 5, className: 'Priest' }),
      createHealer({ botId: 'h2', classId: 11, className: 'Druid' }),
      createMeleeDps({ botId: 'd1' }),
      createRangedDps({ botId: 'd2' }),
    ];

    const result = analyzeGroupComposition(group);
    expect(result.strengths.some(s => s.includes('Multiple healers'))).toBe(true);
  });
});

// =============================================================================
// COOLDOWN COORDINATION TESTS
// =============================================================================

describe('coordinateCooldowns', () => {
  it('should create cooldown plan for standard group', () => {
    const group = createStandard5ManGroup();
    const result = coordinateCooldowns(group, 300); // 5 minute encounter

    expect(result.cooldownPlan.length).toBeGreaterThan(0);
    expect(result.totalDuration).toBeGreaterThan(0);
  });

  it('should start with Bloodlust in first phase', () => {
    const group = createStandard5ManGroup();
    const result = coordinateCooldowns(group, 300);

    const firstPhase = result.cooldownPlan[0];
    expect(firstPhase.phaseNumber).toBe(1);
    expect(firstPhase.startTime).toBe(0);

    const hasBloodlust = firstPhase.cooldowns.some(
      c => c.abilityName === 'Bloodlust' || c.abilityId === 2825
    );
    expect(hasBloodlust).toBe(true);
  });

  it('should create appropriate number of phases for encounter duration', () => {
    const group = createStandard5ManGroup();

    // 5 minute fight = 300 seconds / 120 = 3 phases (ceil)
    const result = coordinateCooldowns(group, 300);
    expect(result.cooldownPlan.length).toBeGreaterThanOrEqual(2);

    // 2 minute fight = 1 phase
    const shortResult = coordinateCooldowns(group, 120);
    expect(shortResult.cooldownPlan.length).toBeGreaterThanOrEqual(1);
  });

  it('should include DPS windows', () => {
    const group = createStandard5ManGroup();
    const result = coordinateCooldowns(group, 300);

    expect(result.dpsWindows.length).toBeGreaterThan(0);
    for (const window of result.dpsWindows) {
      expect(window.startTime).toBeGreaterThanOrEqual(0);
      expect(window.duration).toBeGreaterThan(0);
      expect(window.expectedDps).toBeGreaterThan(0);
      expect(window.activeCooldowns.length).toBeGreaterThan(0);
    }
  });

  it('should return proper CooldownCoordination interface', () => {
    const group = createStandard5ManGroup();
    const result = coordinateCooldowns(group, 300);

    expect(result).toHaveProperty('groupId');
    expect(result).toHaveProperty('cooldownPlan');
    expect(result).toHaveProperty('totalDuration');
    expect(result).toHaveProperty('dpsWindows');
    expect(Array.isArray(result.cooldownPlan)).toBe(true);
    expect(Array.isArray(result.dpsWindows)).toBe(true);
  });

  it('should assign DPS cooldowns to DPS bots', () => {
    const group = createStandard5ManGroup();
    const result = coordinateCooldowns(group, 300);

    const firstPhase = result.cooldownPlan[0];
    const dpsBotIds = group.filter(b => b.role.includes('dps')).map(b => b.botId);

    // At least some DPS bots should have cooldowns in first phase
    const dpsCooldowns = firstPhase.cooldowns.filter(c => dpsBotIds.includes(c.botId));
    expect(dpsCooldowns.length).toBeGreaterThan(0);
  });
});
