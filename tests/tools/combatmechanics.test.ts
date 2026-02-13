/**
 * Combat Mechanics MCP - Unit Tests
 *
 * Tests for combat calculations: melee damage, armor mitigation, threat,
 * diminishing returns, proc chances, resource regeneration, avoidance, crit cap.
 *
 * Async functions that depend on GameTable file I/O are tested by mocking
 * the gametable module exports.
 *
 * @module tests/tools/combatmechanics
 */

import {
  calculateThreat,
  calculateProcChance,
  calculateArmorMitigation,
  calculateMeleeDamage,
  calculateDiminishingReturns,
  calculateResourceRegen,
  calculateAvoidance,
  analyzeCritCap,
  ThreatCalculation,
  ProcCalculation,
  MeleeDamageResult,
  ArmorMitigationResult,
  DiminishingReturnsInfo,
  ResourceRegeneration,
  AvoidanceCalculation,
  CritCapAnalysis,
} from '../../src/tools/combatmechanics';

// Mock the gametable module so async functions don't read real files
jest.mock('../../src/tools/gametable', () => ({
  getCombatRating: jest.fn(async (level: number, statName: string): Promise<number | null> => {
    // Return realistic combat rating conversion values at level 80
    // These approximate real WoW values where ~180 rating = 1% for most stats
    const ratingMap: Record<string, number> = {
      'Crit - Melee': 180,
      'Crit - Spell': 180,
      'Haste - Melee': 128,
      'Haste': 128,
      'Mastery': 180,
      'Versatility': 205,
      'Dodge': 216,
      'Parry': 216,
    };
    return ratingMap[statName] ?? null;
  }),
  getHpPerSta: jest.fn(async (level: number): Promise<number | null> => {
    return 20; // 20 HP per stamina
  }),
  queryGameTable: jest.fn(),
}));

// =============================================================================
// THREAT CALCULATION TESTS
// =============================================================================

describe('calculateThreat', () => {
  it('should calculate base threat from damage only', () => {
    const result = calculateThreat({
      damageDealt: 1000,
      isTankStance: false,
    });

    expect(result.damageDealt).toBe(1000);
    expect(result.healingDone).toBe(0);
    expect(result.baseThreat).toBe(1000); // 1:1 damage to threat
    expect(result.isTankStance).toBe(false);
    expect(result.totalThreat).toBeGreaterThan(0);
  });

  it('should calculate base threat from healing only', () => {
    const result = calculateThreat({
      healingDone: 2000,
      isTankStance: false,
    });

    expect(result.healingDone).toBe(2000);
    // Healing threat is 50% of healing
    expect(result.baseThreat).toBe(1000);
  });

  it('should calculate combined damage and healing threat', () => {
    const result = calculateThreat({
      damageDealt: 500,
      healingDone: 1000,
      isTankStance: false,
    });

    // 500 (damage) + 500 (50% of 1000 healing) = 1000 base threat
    expect(result.baseThreat).toBe(1000);
  });

  it('should apply tank stance 5x multiplier', () => {
    const noTank = calculateThreat({
      damageDealt: 1000,
      isTankStance: false,
    });

    const withTank = calculateThreat({
      damageDealt: 1000,
      isTankStance: true,
    });

    expect(withTank.isTankStance).toBe(true);
    expect(withTank.totalThreat).toBeGreaterThan(noTank.totalThreat);
    // Tank stance is 5x multiplier
    expect(withTank.totalThreat / noTank.totalThreat).toBeCloseTo(5.0, 0);
  });

  it('should apply threat modifiers from abilities', () => {
    const base = calculateThreat({
      damageDealt: 1000,
      isTankStance: false,
      threatModifiers: 1.0,
    });

    const withModifier = calculateThreat({
      damageDealt: 1000,
      isTankStance: false,
      threatModifiers: 2.0,
    });

    expect(withModifier.totalThreat).toBeGreaterThan(base.totalThreat);
  });

  it('should handle zero damage and zero healing', () => {
    const result = calculateThreat({
      isTankStance: false,
    });

    expect(result.damageDealt).toBe(0);
    expect(result.healingDone).toBe(0);
    expect(result.baseThreat).toBe(0);
    expect(result.totalThreat).toBe(0);
  });

  it('should return proper ThreatCalculation interface', () => {
    const result = calculateThreat({
      damageDealt: 1000,
      healingDone: 500,
      isTankStance: true,
      threatModifiers: 1.5,
    });

    expect(result).toHaveProperty('damageDealt');
    expect(result).toHaveProperty('healingDone');
    expect(result).toHaveProperty('threatModifier');
    expect(result).toHaveProperty('baseThreat');
    expect(result).toHaveProperty('bonusThreat');
    expect(result).toHaveProperty('totalThreat');
    expect(result).toHaveProperty('isTankStance');
  });

  it('should combine tank stance and threat modifiers multiplicatively', () => {
    const result = calculateThreat({
      damageDealt: 100,
      isTankStance: true,
      threatModifiers: 2.0,
    });

    // baseThreat = 100, bonusThreat = 100 * 2.0 = 200
    // total = (100 + 200) * 5.0 (tank stance) = 1500
    expect(result.totalThreat).toBe(1500);
  });
});

// =============================================================================
// PROC CHANCE CALCULATION TESTS
// =============================================================================

describe('calculateProcChance', () => {
  it('should calculate fixed proc chance correctly', () => {
    const result = calculateProcChance({
      baseProcChance: 0.10, // 10%
      attackSpeed: 2.6,
    });

    expect(result.procChance).toBeCloseTo(0.10);
    expect(result.realProcChance).toBeCloseTo(0.10);
    // 60/2.6 attacks per minute * 0.10 chance = ~2.3 procs per minute
    expect(result.expectedProcsPerMinute).toBeCloseTo(60 / 2.6 * 0.10, 1);
  });

  it('should calculate PPM-based proc chance', () => {
    const result = calculateProcChance({
      ppmRate: 2.0, // 2 procs per minute
      attackSpeed: 3.0,
    });

    // PPM: chance = (2.0 * 3.0 * 1.0) / 60 = 0.10
    expect(result.realProcChance).toBeCloseTo(0.10);
    expect(result.expectedProcsPerMinute).toBeCloseTo(2.0);
    expect(result.ppmRate).toBe(2.0);
  });

  it('should apply haste to PPM calculations', () => {
    const noHaste = calculateProcChance({
      ppmRate: 2.0,
      attackSpeed: 3.0,
      hastePercent: 0,
    });

    const withHaste = calculateProcChance({
      ppmRate: 2.0,
      attackSpeed: 3.0,
      hastePercent: 30,
    });

    // With 30% haste, PPM is 2.0 * 1.3 = 2.6
    expect(withHaste.expectedProcsPerMinute).toBeCloseTo(2.6);
    expect(withHaste.expectedProcsPerMinute).toBeGreaterThan(noHaste.expectedProcsPerMinute);
  });

  it('should respect internal cooldown', () => {
    const result = calculateProcChance({
      baseProcChance: 0.50, // 50%
      attackSpeed: 1.5,
      internalCooldown: 10, // 10 second ICD
    });

    // Max procs from ICD: 60/10 = 6 per minute
    // Expected without ICD: (60/1.5) * 0.5 = 20 per minute
    // Should be capped at 6
    expect(result.expectedProcsPerMinute).toBeLessThanOrEqual(6);
    expect(result.internalCooldown).toBe(10);
  });

  it('should return Infinity for averageTimeBetweenProcs when no procs', () => {
    const result = calculateProcChance({});

    expect(result.expectedProcsPerMinute).toBe(0);
    expect(result.averageTimeBetweenProcs).toBe(Infinity);
  });

  it('should calculate average time between procs', () => {
    const result = calculateProcChance({
      ppmRate: 3.0,
      attackSpeed: 2.0,
    });

    // 3 procs per minute = 20 seconds between procs
    expect(result.averageTimeBetweenProcs).toBeCloseTo(20, 0);
  });

  it('should return proper ProcCalculation interface', () => {
    const result = calculateProcChance({
      baseProcChance: 0.15,
      ppmRate: 1.5,
      attackSpeed: 2.6,
      internalCooldown: 5,
      hastePercent: 10,
    });

    expect(result).toHaveProperty('procChance');
    expect(result).toHaveProperty('ppmRate');
    expect(result).toHaveProperty('internalCooldown');
    expect(result).toHaveProperty('realProcChance');
    expect(result).toHaveProperty('expectedProcsPerMinute');
    expect(result).toHaveProperty('averageTimeBetweenProcs');
  });
});

// =============================================================================
// ARMOR MITIGATION TESTS
// =============================================================================

describe('calculateArmorMitigation', () => {
  it('should calculate damage reduction from armor', async () => {
    const result = await calculateArmorMitigation(1000, 5000, 80);

    expect(result.rawDamage).toBe(1000);
    expect(result.armor).toBe(5000);
    expect(result.damageReduction).toBeGreaterThan(0);
    expect(result.damageReduction).toBeLessThan(100);
    expect(result.effectiveDamage).toBeLessThan(1000);
    expect(result.effectiveDamage).toBeGreaterThan(0);
    expect(result.mitigatedDamage).toBeCloseTo(1000 - result.effectiveDamage);
  });

  it('should use correct armor constant formula K = 400 + 85*level', async () => {
    const result = await calculateArmorMitigation(1000, 5000, 80);

    const expectedK = 400 + (85 * 80); // 7200
    expect(result.armorConstant).toBe(expectedK);
  });

  it('should have higher damage reduction at lower attacker levels', async () => {
    const lowLevel = await calculateArmorMitigation(1000, 5000, 20);
    const highLevel = await calculateArmorMitigation(1000, 5000, 80);

    // At lower levels, K is smaller, so armor is relatively more effective
    expect(lowLevel.damageReduction).toBeGreaterThan(highLevel.damageReduction);
  });

  it('should handle zero armor', async () => {
    const result = await calculateArmorMitigation(1000, 0, 80);

    expect(result.damageReduction).toBe(0);
    expect(result.effectiveDamage).toBe(1000);
    expect(result.mitigatedDamage).toBe(0);
  });

  it('should handle very high armor', async () => {
    const result = await calculateArmorMitigation(1000, 100000, 80);

    expect(result.damageReduction).toBeGreaterThan(90);
    expect(result.effectiveDamage).toBeLessThan(100);
  });

  it('should scale linearly with raw damage', async () => {
    const result1 = await calculateArmorMitigation(1000, 5000, 80);
    const result2 = await calculateArmorMitigation(2000, 5000, 80);

    expect(result2.effectiveDamage).toBeCloseTo(result1.effectiveDamage * 2, 1);
    expect(result1.damageReduction).toBeCloseTo(result2.damageReduction, 5);
  });

  it('should return proper ArmorMitigationResult interface', async () => {
    const result = await calculateArmorMitigation(1000, 5000, 80);

    expect(result).toHaveProperty('rawDamage');
    expect(result).toHaveProperty('armor');
    expect(result).toHaveProperty('damageReduction');
    expect(result).toHaveProperty('mitigatedDamage');
    expect(result).toHaveProperty('effectiveDamage');
    expect(result).toHaveProperty('armorConstant');
    expect(typeof result.rawDamage).toBe('number');
    expect(typeof result.damageReduction).toBe('number');
  });
});

// =============================================================================
// MELEE DAMAGE CALCULATION TESTS
// =============================================================================

describe('calculateMeleeDamage', () => {
  it('should calculate basic melee damage', async () => {
    const result = await calculateMeleeDamage({
      weaponDPS: 100,
      attackSpeed: 2.6,
      attackPower: 1000,
      critRating: 0,
      level: 80,
    });

    expect(result.weaponDamage).toBeCloseTo(100 * 2.6); // 260
    expect(result.attackPowerBonus).toBeCloseTo((1000 / 3.5) * 2.6, 0); // ~743
    expect(result.baseDamage).toBeCloseTo(result.weaponDamage + result.attackPowerBonus, 1);
    expect(result.attackSpeed).toBe(2.6);
  });

  it('should calculate crit chance from crit rating', async () => {
    const result = await calculateMeleeDamage({
      weaponDPS: 100,
      attackSpeed: 2.6,
      attackPower: 1000,
      critRating: 360, // 360/180 = 2% crit (mocked rating is 180)
      level: 80,
    });

    // With mock: critRating 360 / ratingValue 180 * 100 = 200% (unrealistic but matches formula)
    // The formula: critChance = (critRating / ratingValue) * 100
    expect(result.critChance).toBeGreaterThan(0);
  });

  it('should produce higher expected damage with crit', async () => {
    const noCrit = await calculateMeleeDamage({
      weaponDPS: 100,
      attackSpeed: 2.6,
      attackPower: 1000,
      critRating: 0,
      level: 80,
    });

    const withCrit = await calculateMeleeDamage({
      weaponDPS: 100,
      attackSpeed: 2.6,
      attackPower: 1000,
      critRating: 90, // 50% crit
      level: 80,
    });

    expect(withCrit.expectedDamage).toBeGreaterThan(noCrit.expectedDamage);
  });

  it('should calculate DPS correctly', async () => {
    const result = await calculateMeleeDamage({
      weaponDPS: 100,
      attackSpeed: 2.6,
      attackPower: 1000,
      critRating: 0,
      level: 80,
    });

    expect(result.dps).toBeCloseTo(result.expectedDamage / result.attackSpeed, 1);
  });

  it('should apply armor mitigation when target armor provided', async () => {
    const noArmor = await calculateMeleeDamage({
      weaponDPS: 100,
      attackSpeed: 2.6,
      attackPower: 1000,
      critRating: 0,
      level: 80,
    });

    const withArmor = await calculateMeleeDamage({
      weaponDPS: 100,
      attackSpeed: 2.6,
      attackPower: 1000,
      critRating: 0,
      level: 80,
      targetArmor: 5000,
    });

    expect(withArmor.expectedDamage).toBeLessThan(noArmor.expectedDamage);
  });

  it('should return proper MeleeDamageResult interface', async () => {
    const result = await calculateMeleeDamage({
      weaponDPS: 100,
      attackSpeed: 2.6,
      attackPower: 1000,
      critRating: 90,
      level: 80,
    });

    expect(result).toHaveProperty('baseDamage');
    expect(result).toHaveProperty('weaponDamage');
    expect(result).toHaveProperty('attackPowerBonus');
    expect(result).toHaveProperty('totalDamage');
    expect(result).toHaveProperty('critChance');
    expect(result).toHaveProperty('critDamage');
    expect(result).toHaveProperty('expectedDamage');
    expect(result).toHaveProperty('dps');
    expect(result).toHaveProperty('attackSpeed');
  });
});

// =============================================================================
// DIMINISHING RETURNS TESTS
// =============================================================================

describe('calculateDiminishingReturns', () => {
  it('should return no DR category below 30% threshold', async () => {
    // Mock returns 180 for crit. linearPercent = (rating / 180) * 100
    // For 15% linear: rating = 180 * 15 / 100 = 27
    const result = await calculateDiminishingReturns({
      stat: 'crit',
      currentRating: 27,  // 27/180*100 = 15% linear (below 30% threshold)
      ratingToAdd: 9,     // +5% linear
      level: 80,
    });

    expect(result.stat).toBe('crit');
    expect(result.rating).toBe(27);
    expect(result.ratingToAdd).toBe(9);
    expect(result.percentBefore).toBeGreaterThan(0);
    expect(result.percentAfter).toBeGreaterThan(result.percentBefore);
    expect(result.gainPercent).toBeGreaterThan(0);
  });

  it('should reduce efficiency above soft cap', async () => {
    // Mock returns 128 for haste. For 50% linear: rating = 128 * 50 / 100 = 64
    const result = await calculateDiminishingReturns({
      stat: 'haste',
      currentRating: 64,  // 64/128*100 = 50% linear (past 39% soft cap after DR)
      ratingToAdd: 13,    // +~10% linear
      level: 80,
    });

    expect(result.efficiency).toBeLessThan(1.0); // DR should reduce efficiency
  });

  it('should handle null rating value gracefully', async () => {
    const gametable = require('../../src/tools/gametable');
    gametable.getCombatRating.mockResolvedValueOnce(null);

    const result = await calculateDiminishingReturns({
      stat: 'crit',
      currentRating: 1000,
      ratingToAdd: 500,
      level: 80,
    });

    expect(result.drCategory).toBe('none');
    expect(result.efficiency).toBe(0);
    expect(result.percentBefore).toBe(0);
    expect(result.percentAfter).toBe(0);
  });

  it('should handle zero rating value gracefully', async () => {
    const gametable = require('../../src/tools/gametable');
    gametable.getCombatRating.mockResolvedValueOnce(0);

    const result = await calculateDiminishingReturns({
      stat: 'haste',
      currentRating: 1000,
      ratingToAdd: 500,
      level: 80,
    });

    expect(result.efficiency).toBe(0);
  });

  it('should return correct DR categories for different stat levels', async () => {
    // Mock returns 180 for mastery. linearPercent = (rating / 180) * 100
    // Low rating = "none" category (below 30%)
    // For 10% linear: rating = 180 * 10 / 100 = 18
    const low = await calculateDiminishingReturns({
      stat: 'mastery',
      currentRating: 18,  // 18/180*100 = 10% linear
      ratingToAdd: 2,
      level: 80,
    });
    expect(low.drCategory).toBe('none');

    // Medium rating - above 30% but below soft cap
    // For 33% linear: rating = 180 * 33 / 100 = 59.4
    const med = await calculateDiminishingReturns({
      stat: 'mastery',
      currentRating: 59,  // 59/180*100 = ~32.8% linear -> after DR ~32.5%, above 30%
      ratingToAdd: 2,
      level: 80,
    });
    expect(['none', 'linear']).toContain(med.drCategory);
  });

  it('should return proper DiminishingReturnsInfo interface', async () => {
    // Mock returns 205 for versatility. 20/205*100 = ~9.8% linear
    const result = await calculateDiminishingReturns({
      stat: 'versatility',
      currentRating: 20,
      ratingToAdd: 10,
      level: 80,
    });

    expect(result).toHaveProperty('stat');
    expect(result).toHaveProperty('rating');
    expect(result).toHaveProperty('percentBefore');
    expect(result).toHaveProperty('ratingToAdd');
    expect(result).toHaveProperty('percentAfter');
    expect(result).toHaveProperty('gainPercent');
    expect(result).toHaveProperty('efficiency');
    expect(result).toHaveProperty('drCategory');
    expect(['none', 'linear', 'soft_cap', 'hard_cap']).toContain(result.drCategory);
  });
});

// =============================================================================
// RESOURCE REGENERATION TESTS
// =============================================================================

describe('calculateResourceRegen', () => {
  it('should calculate energy regeneration at 10 per second base', async () => {
    const result = await calculateResourceRegen({
      resourceType: 'energy',
      level: 80,
      maxResource: 100,
    });

    expect(result.resourceType).toBe('energy');
    expect(result.regenPerSecond).toBeCloseTo(10, 0);
    expect(result.regenPer5).toBeCloseTo(50, 0);
    expect(result.timeToFull).toBeCloseTo(10, 0); // 100 / 10 = 10 seconds
  });

  it('should calculate focus regeneration at 7.5 per second base', async () => {
    const result = await calculateResourceRegen({
      resourceType: 'focus',
      level: 80,
      maxResource: 120,
    });

    expect(result.resourceType).toBe('focus');
    expect(result.regenPerSecond).toBeCloseTo(7.5, 0);
    expect(result.timeToFull).toBeCloseTo(120 / 7.5, 0);
  });

  it('should calculate rage regeneration as zero (event-driven)', async () => {
    const result = await calculateResourceRegen({
      resourceType: 'rage',
      level: 80,
      maxResource: 100,
    });

    expect(result.resourceType).toBe('rage');
    expect(result.regenPerSecond).toBe(0);
  });

  it('should calculate mana regeneration without spirit', async () => {
    const result = await calculateResourceRegen({
      resourceType: 'mana',
      level: 80,
      maxResource: 50000,
    });

    expect(result.resourceType).toBe('mana');
    // Base regen: 1% of 50000 per 5 seconds = 500 MP5 = 100 per second
    expect(result.regenPerSecond).toBeCloseTo(100, 0);
    expect(result.regenPer5).toBeCloseTo(500, 0);
  });

  it('should calculate mana regeneration with spirit (legacy)', async () => {
    const result = await calculateResourceRegen({
      resourceType: 'mana',
      level: 80,
      spirit: 500,
      maxResource: 50000,
    });

    expect(result.spiritBonus).toBeDefined();
    expect(result.spiritBonus!).toBeGreaterThan(0);
  });

  it('should apply haste to energy regeneration', async () => {
    const noHaste = await calculateResourceRegen({
      resourceType: 'energy',
      level: 80,
      maxResource: 100,
    });

    const withHaste = await calculateResourceRegen({
      resourceType: 'energy',
      level: 80,
      hasteRating: 640, // 640/128*100 = 500% haste (extreme for testing)
      maxResource: 100,
    });

    expect(withHaste.regenPerSecond).toBeGreaterThan(noHaste.regenPerSecond);
  });

  it('should return proper ResourceRegeneration interface', async () => {
    const result = await calculateResourceRegen({
      resourceType: 'energy',
      level: 80,
      maxResource: 100,
    });

    expect(result).toHaveProperty('resourceType');
    expect(result).toHaveProperty('baseRegen');
    expect(result).toHaveProperty('hasteBonus');
    expect(result).toHaveProperty('totalRegen');
    expect(result).toHaveProperty('regenPer5');
    expect(result).toHaveProperty('regenPerSecond');
    expect(result).toHaveProperty('timeToFull');
  });
});

// =============================================================================
// AVOIDANCE CALCULATION TESTS
// =============================================================================

describe('calculateAvoidance', () => {
  it('should calculate dodge and parry from ratings', async () => {
    const result = await calculateAvoidance({
      level: 80,
      dodgeRating: 1080, // 1080/216*100 = 5% dodge
      parryRating: 1080, // 1080/216*100 = 5% parry
      baseStamina: 1000,
      armor: 30000,
      health: 100000,
    });

    expect(result.dodge).toBeGreaterThan(0);
    expect(result.parry).toBeGreaterThan(0);
    expect(result.miss).toBe(3); // Base miss chance
  });

  it('should cap total avoidance at 85%', async () => {
    const result = await calculateAvoidance({
      level: 80,
      dodgeRating: 50000, // Way too much
      parryRating: 50000,
      baseStamina: 1000,
      armor: 30000,
      health: 100000,
    });

    expect(result.totalAvoidance).toBeLessThanOrEqual(85);
  });

  it('should calculate hit chance as complement of avoidance', async () => {
    const result = await calculateAvoidance({
      level: 80,
      dodgeRating: 1080,
      parryRating: 1080,
      baseStamina: 1000,
      armor: 30000,
      health: 100000,
    });

    expect(result.hitChance).toBeCloseTo(100 - result.totalAvoidance, 5);
  });

  it('should calculate effective health', async () => {
    const result = await calculateAvoidance({
      level: 80,
      dodgeRating: 1080,
      parryRating: 1080,
      baseStamina: 1000,
      armor: 30000,
      health: 100000,
    });

    // Effective health = health / (hitChance / 100)
    expect(result.effectiveHealth).toBeGreaterThan(100000);
    expect(result.effectiveHealth).toBeCloseTo(100000 / (result.hitChance / 100), 0);
  });

  it('should handle zero dodge and parry ratings', async () => {
    const result = await calculateAvoidance({
      level: 80,
      dodgeRating: 0,
      parryRating: 0,
      baseStamina: 1000,
      armor: 30000,
      health: 100000,
    });

    expect(result.dodge).toBe(0);
    expect(result.parry).toBe(0);
    expect(result.totalAvoidance).toBe(3); // Base miss only
    expect(result.hitChance).toBe(97);
  });

  it('should return proper AvoidanceCalculation interface', async () => {
    const result = await calculateAvoidance({
      level: 80,
      dodgeRating: 1000,
      parryRating: 1000,
      baseStamina: 500,
      armor: 20000,
      health: 80000,
    });

    expect(result).toHaveProperty('dodge');
    expect(result).toHaveProperty('parry');
    expect(result).toHaveProperty('miss');
    expect(result).toHaveProperty('totalAvoidance');
    expect(result).toHaveProperty('hitChance');
    expect(result).toHaveProperty('effectiveHealth');
  });
});

// =============================================================================
// CRIT CAP ANALYSIS TESTS
// =============================================================================

describe('analyzeCritCap', () => {
  it('should analyze crit rating below soft cap', async () => {
    // Mock returns 180 for crit. 18/180*100 = 10% linear -> well below soft cap
    const result = await analyzeCritCap(18, 80, 'melee');

    expect(result.currentCritRating).toBe(18);
    expect(result.currentCritPercent).toBeGreaterThan(0);
    expect(result.softCap).toBeGreaterThan(0);
    expect(result.hardCap).toBeGreaterThan(result.softCap);
    expect(result.ratingToSoftCap).toBeGreaterThan(0);
    expect(result.recommendation).toContain('soft cap');
  });

  it('should handle null rating value', async () => {
    const gametable = require('../../src/tools/gametable');
    gametable.getCombatRating.mockResolvedValueOnce(null);

    const result = await analyzeCritCap(1000, 80, 'melee');

    expect(result.currentCritPercent).toBe(0);
    expect(result.recommendation).toContain('unavailable');
  });

  it('should distinguish spell and melee crit', async () => {
    const melee = await analyzeCritCap(18, 80, 'melee');
    const spell = await analyzeCritCap(18, 80, 'spell');

    expect(melee.currentCritRating).toBe(18);
    expect(spell.currentCritRating).toBe(18);
    // Both use same mock value (180), so results should be identical
    expect(melee.currentCritPercent).toBeCloseTo(spell.currentCritPercent, 1);
  });

  it('should return proper CritCapAnalysis interface', async () => {
    const result = await analyzeCritCap(18, 80, 'melee');

    expect(result).toHaveProperty('currentCritRating');
    expect(result).toHaveProperty('currentCritPercent');
    expect(result).toHaveProperty('softCap');
    expect(result).toHaveProperty('hardCap');
    expect(result).toHaveProperty('ratingToSoftCap');
    expect(result).toHaveProperty('efficiency');
    expect(result).toHaveProperty('recommendation');
    expect(typeof result.recommendation).toBe('string');
  });

  it('should have efficiency between 0 and 1 for reasonable ratings', async () => {
    const result = await analyzeCritCap(18, 80, 'melee');

    expect(result.efficiency).toBeGreaterThan(0);
    expect(result.efficiency).toBeLessThanOrEqual(1.0);
  });
});
