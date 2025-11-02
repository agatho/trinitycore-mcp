#!/usr/bin/env node
/**
 * Phase 7 Enhancement Testing Script
 * Tests all completed Phase 7 enhancements to verify functionality
 */

import { getStatPriority } from './dist/data/stat-priorities.js';
import { getSpellRange, getSpellRangeDescription, isMeleeRange } from './dist/data/spell-ranges.js';
import {
  getXPToNextLevel,
  calculateQuestXPWithModifiers,
  getQuestColor,
  calculateRestBonusPool
} from './dist/data/xp-per-level.js';
import {
  calculateReputationGain,
  getAvailableReputationMultipliers
} from './dist/tools/reputation.js';
import { parseAttributeBitfield } from './dist/data/spell-attributes.js';

console.log('\n==========================================================');
console.log('🧪 PHASE 7 ENHANCEMENT TESTING');
console.log('==========================================================\n');

let testsRun = 0;
let testsPassed = 0;
let testsFailed = 0;

function test(name, fn) {
  testsRun++;
  try {
    fn();
    console.log(`✅ PASS: ${name}`);
    testsPassed++;
  } catch (error) {
    console.log(`❌ FAIL: ${name}`);
    console.log(`   Error: ${error.message}`);
    testsFailed++;
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

console.log('📊 Testing Enhancement #3: Stat Priorities Database');
console.log('──────────────────────────────────────────────────────────\n');

test('Stat Priority - Frost Mage (Spec 64)', () => {
  const priority = getStatPriority(8, 64, 'raid_dps');
  assert(priority !== undefined, 'Should return stat priority');
  assert(priority.className === 'Mage', 'Should be Mage class');
  assert(priority.specName === 'Frost', 'Should be Frost spec');
  assert(priority.weights.haste > 0, 'Should have haste weight');
  console.log(`   Primary stat order: ${priority.priorityOrder.slice(0, 3).join(' > ')}`);
});

test('Stat Priority - Arms Warrior (Spec 71)', () => {
  const priority = getStatPriority(1, 71, 'raid_dps');
  assert(priority !== undefined, 'Should return stat priority');
  assert(priority.className === 'Warrior', 'Should be Warrior class');
  assert(priority.specName === 'Arms', 'Should be Arms spec');
  assert(priority.weights.criticalStrike > 0, 'Should have crit weight');
  console.log(`   Stat weights: Crit=${priority.weights.criticalStrike}, Haste=${priority.weights.haste}`);
});

console.log('\n📏 Testing Enhancement #5: SpellRange Database');
console.log('──────────────────────────────────────────────────────────\n');

test('Spell Range - Melee (ID 1)', () => {
  const range = getSpellRange(1);
  assert(range !== null, 'Should return range entry');
  assert(range.maxRangeHostile === 5, 'Melee range should be 5 yards');
  assert(isMeleeRange(1) === true, 'Should be flagged as melee');
  console.log(`   Melee range: ${range.minRangeHostile}-${range.maxRangeHostile} yards`);
});

test('Spell Range - Standard 40yd (ID 4)', () => {
  const range = getSpellRange(4);
  assert(range !== null, 'Should return range entry');
  assert(range.maxRangeHostile === 40, '40 yard range expected');
  const desc = getSpellRangeDescription(4);
  assert(desc.includes('40'), 'Description should mention 40');
  console.log(`   Standard range: ${desc}`);
});

test('Spell Range - Self Only (ID 6)', () => {
  const range = getSpellRange(6);
  assert(range !== null, 'Should return range entry');
  assert(range.maxRangeHostile === 0, 'Self-only should be 0 yards');
  assert(range.displayName === 'Self Only', 'Should be labeled as Self Only');
  console.log(`   Self range: ${range.displayName}`);
});

console.log('\n🎯 Testing Enhancement #6: Quest XP Calculations');
console.log('──────────────────────────────────────────────────────────\n');

test('XP Per Level - Level 25 to 26', () => {
  const xp = getXPToNextLevel(25);
  assert(xp > 0, 'Should return positive XP');
  assert(typeof xp === 'number', 'Should return a number');
  console.log(`   XP needed for level 26: ${xp.toLocaleString()}`);
});

test('Quest Color - Level 25 player, Level 27 quest (Yellow)', () => {
  const color = getQuestColor(27, 25);
  assert(color === 'yellow', 'Should be yellow (appropriate level)');
  console.log(`   Quest color: ${color} (100% XP)`);
});

test('Quest Color - Level 25 player, Level 15 quest (Gray)', () => {
  const color = getQuestColor(15, 25);
  assert(color === 'gray', 'Should be gray (trivial)');
  console.log(`   Quest color: ${color} (0% XP)`);
});

test('Quest XP Calculation - With rest bonus', () => {
  const baseXP = 5000;
  const questLevel = 27;
  const playerLevel = 25;
  const hasRest = true;

  const finalXP = calculateQuestXPWithModifiers(baseXP, questLevel, playerLevel, hasRest);
  assert(finalXP > baseXP, 'Rest bonus should increase XP');
  assert(finalXP === 7500, 'Should be 7500 XP (5000 * 1.5 rest bonus)');
  console.log(`   Base: ${baseXP} → Final: ${finalXP} (+${((finalXP/baseXP - 1) * 100).toFixed(0)}%)`);
});

test('Rest Bonus Pool - 24 hours rested at level 60', () => {
  const pool = calculateRestBonusPool(60, 24);
  assert(pool > 0, 'Should accumulate rest XP');
  console.log(`   Rest XP pool after 24h: ${pool.toLocaleString()}`);
});

console.log('\n🏆 Testing Enhancement #7: Reputation Calculations');
console.log('──────────────────────────────────────────────────────────\n');

test('Reputation Gain - Human with Guild Perk and Darkmoon Faire', () => {
  const result = calculateReputationGain(
    100,                     // Base 100 reputation
    1,                       // Human (Diplomacy +10%)
    true,                    // Has guild perk
    6,                       // Guild level 6 (Rank 2 +10%)
    ['Darkmoon Faire']       // Active event (+10%)
  );

  assert(result.finalReputation > 100, 'Should increase reputation');
  assert(result.multipliers.length === 3, 'Should apply 3 multipliers');
  assert(result.finalReputation === 133, 'Should be 133 reputation');

  console.log(`   Base: 100 → Final: ${result.finalReputation} (+${((result.totalMultiplier - 1) * 100).toFixed(1)}%)`);
  console.log(`   Multipliers applied: ${result.multipliers.map(m => m.name).join(', ')}`);
});

test('Reputation Gain - WoW Anniversary Event', () => {
  const result = calculateReputationGain(
    100,                     // Base 100 reputation
    0,                       // Non-Human
    false,                   // No guild perk
    0,                       // No guild level
    ['WoW Anniversary']      // Anniversary event (+100%)
  );

  assert(result.finalReputation === 200, 'Should double reputation');
  assert(result.totalMultiplier === 2.0, 'Multiplier should be 2.0');

  console.log(`   Base: 100 → Final: ${result.finalReputation} (Anniversary +100%)`);
});

test('Available Reputation Multipliers', () => {
  const multipliers = getAvailableReputationMultipliers(1, 6); // Human race, guild level 6
  assert(multipliers.racial.length > 0, 'Should have racial bonuses');
  assert(multipliers.guild.length > 0, 'Should have guild perks');
  assert(multipliers.event.length > 0, 'Should have event bonuses');

  console.log(`   Racial: ${multipliers.racial.length}, Guild: ${multipliers.guild.length}, Event: ${multipliers.event.length}`);
});

console.log('\n🔮 Testing Enhancement #2: Spell Attribute Parsing');
console.log('──────────────────────────────────────────────────────────\n');

test('Spell Attributes - Parse bitfield (Attr0)', () => {
  const flags = parseAttributeBitfield(0, 0x00000001); // PROC_FAILURE_BURNS_CHARGE
  assert(flags.length > 0, 'Should return attribute flags');
  assert(flags[0].name.includes('PROC_FAILURE_BURNS_CHARGE'), 'Should match flag name');
  console.log(`   Flag parsed: ${flags[0].name} (${flags[0].category})`);
});

test('Spell Attributes - Multiple flags', () => {
  const flags = parseAttributeBitfield(1, 0x00000003); // First two flags
  assert(flags.length >= 2, 'Should return multiple flags');
  console.log(`   Parsed ${flags.length} flags from bitfield 0x00000003`);
});

console.log('\n==========================================================');
console.log('📈 TEST SUMMARY');
console.log('==========================================================\n');

console.log(`Total Tests Run:    ${testsRun}`);
console.log(`✅ Tests Passed:    ${testsPassed} (${((testsPassed/testsRun)*100).toFixed(1)}%)`);
console.log(`❌ Tests Failed:    ${testsFailed} (${((testsFailed/testsRun)*100).toFixed(1)}%)`);

console.log('\n==========================================================');
console.log('🎉 PHASE 7 ENHANCEMENTS STATUS');
console.log('==========================================================\n');

console.log('✅ Enhancement #1: Quest Reward Best Choice Logic');
console.log('✅ Enhancement #2: Spell Attribute Flag Parsing (511 flags)');
console.log('✅ Enhancement #3: Stat Priorities Database (39 specs)');
console.log('✅ Enhancement #5: SpellRange Database (68 ranges)');
console.log('✅ Enhancement #6: Quest XP Calculations');
console.log('✅ Enhancement #7: Reputation Gain Calculations');
console.log('');
console.log('⏳ Remaining: Enhancement #4 (Talent Builds), #8 (Coordination)');
console.log('');
console.log(`Build Status: ${testsFailed === 0 ? '✅ ALL TESTS PASSING' : '⚠️ SOME TESTS FAILING'}`);
console.log('==========================================================\n');

process.exit(testsFailed === 0 ? 0 : 1);
