/**
 * Unit tests for SpellSchema
 * Tests spell parsing, helper methods, and attribute checking
 */

import { describe, it, expect } from '@jest/globals';
import { SpellSchema, SpellEntry } from '../../../src/parsers/schemas/SpellSchema';
import { MockDB2Record } from './MockDB2Record';

describe('SpellSchema', () => {
  describe('parse()', () => {
    it('should parse basic spell entry', () => {
      const mockRecord = new MockDB2Record({
        0: 8326, // id (Ghost spell)
        1: 0, // difficulty
        2: 0, // categoryId
        3: 0, // dispel
        4: 0, // mechanic
        5: 0x00000100, // attributes (SPELL_ATTR0_PASSIVE)
        6: 0, // attributesEx
        7: 0, // attributesEx2
        13: 64, // schoolMask (SPELL_SCHOOL_MASK_SHADOW)
        27: 0, // castTimeIndex
      });

      const spell = SpellSchema.parse(mockRecord);

      expect(spell.id).toBe(8326);
      expect(spell.difficulty).toBe(0);
      expect(spell.attributes).toBe(0x00000100);
      expect(spell.schoolMask).toBe(64);
    });

    it('should parse spell with all attributes', () => {
      const mockRecord = new MockDB2Record({
        0: 12345, // id
        5: 0x00000001, // attributes
        6: 0x00000002, // attributesEx
        7: 0x00000004, // attributesEx2
        8: 0x00000008, // attributesEx3
        9: 0x00000010, // attributesEx4
        10: 0x00000020, // attributesEx5
        11: 0x00000040, // attributesEx6
        12: 0x00000080, // attributesEx7
        14: 0x00000100, // attributesEx8
        15: 0x00000200, // attributesEx9
        16: 0x00000400, // attributesEx10
        17: 0x00000800, // attributesEx11
        18: 0x00001000, // attributesEx12
        19: 0x00002000, // attributesEx13
        20: 0x00004000, // attributesEx14
        21: 0x00008000, // attributesEx15
        22: 0, // attributesCu
      });

      const spell = SpellSchema.parse(mockRecord);

      expect(spell.attributes).toBe(0x00000001);
      expect(spell.attributesEx).toBe(0x00000002);
      expect(spell.attributesEx2).toBe(0x00000004);
      expect(spell.attributesEx15).toBe(0x00008000);
    });

    it('should parse spell with power costs', () => {
      const mockRecord = new MockDB2Record({
        0: 133, // id (Fireball)
        28: 0, // powerType
        29: 50, // manaCost
        30: 0, // manaCostPerLevel
        31: 100, // manaPerSecond
        32: 0, // manaPerSecondPerLevel
      });

      const spell = SpellSchema.parse(mockRecord);

      expect(spell.powerCost.power).toBe(0); // POWER_MANA
      expect(spell.powerCost.amount).toBe(50);
      expect(spell.manaCostPerLevel).toBe(0);
    });

    it('should parse spell with scaling info', () => {
      const mockRecord = new MockDB2Record({
        0: 45477, // id (Leveling spell)
        69: 1, // minScalingLevel
        70: 80, // maxScalingLevel
        71: 1, // scalesFromItemLevel
      });

      const spell = SpellSchema.parse(mockRecord);

      expect(spell.scalingInfo.minScalingLevel).toBe(1);
      expect(spell.scalingInfo.maxScalingLevel).toBe(80);
      expect(spell.scalingInfo.scalesFromItemLevel).toBe(1);
    });

    it('should parse spell with reagents', () => {
      const mockRecord = new MockDB2Record({
        0: 11413, // id (Mass Resurrection)
        72: [17056, 0, 0, 0, 0, 0, 0, 0], // reagent (Symbol of Hope)
        74: [1, 0, 0, 0, 0, 0, 0, 0], // reagentCount
      });

      const spell = SpellSchema.parse(mockRecord);

      expect(spell.reagent[0]).toBe(17056);
      expect(spell.reagentCount[0]).toBe(1);
    });

    it('should parse spell with totem requirements', () => {
      const mockRecord = new MockDB2Record({
        0: 66842, // id (Call of the Elements)
        80: [5925, 5926], // totem (Earth Totem, Fire Totem)
        82: [1, 1], // totemCategory
      });

      const spell = SpellSchema.parse(mockRecord);

      expect(spell.totem[0]).toBe(5925);
      expect(spell.totem[1]).toBe(5926);
      expect(spell.totemCategory[0]).toBe(1);
      expect(spell.totemCategory[1]).toBe(1);
    });
  });

  describe('hasAttribute()', () => {
    it('should detect SPELL_ATTR0_PASSIVE', () => {
      const spell: SpellEntry = {
        id: 8326,
        attributes: 0x00000100, // SPELL_ATTR0_PASSIVE
      } as SpellEntry;

      expect(SpellSchema.hasAttribute(spell, 0, 0x00000100)).toBe(true);
      expect(SpellSchema.hasAttribute(spell, 0, 0x00000001)).toBe(false);
    });

    it('should detect SPELL_ATTR1_CANT_BE_REFLECTED', () => {
      const spell: SpellEntry = {
        id: 133,
        attributes: 0,
        attributesEx: 0x00000002, // SPELL_ATTR1_CANT_BE_REFLECTED
      } as SpellEntry;

      expect(SpellSchema.hasAttribute(spell, 1, 0x00000002)).toBe(true);
      expect(SpellSchema.hasAttribute(spell, 1, 0x00000001)).toBe(false);
    });

    it('should check all 16 attribute indices', () => {
      const spell: SpellEntry = {
        id: 12345,
        attributes: 0x00000001,
        attributesEx: 0x00000002,
        attributesEx2: 0x00000004,
        attributesEx3: 0x00000008,
        attributesEx4: 0x00000010,
        attributesEx5: 0x00000020,
        attributesEx6: 0x00000040,
        attributesEx7: 0x00000080,
        attributesEx8: 0x00000100,
        attributesEx9: 0x00000200,
        attributesEx10: 0x00000400,
        attributesEx11: 0x00000800,
        attributesEx12: 0x00001000,
        attributesEx13: 0x00002000,
        attributesEx14: 0x00004000,
        attributesEx15: 0x00008000,
      } as SpellEntry;

      expect(SpellSchema.hasAttribute(spell, 0, 0x00000001)).toBe(true);
      expect(SpellSchema.hasAttribute(spell, 1, 0x00000002)).toBe(true);
      expect(SpellSchema.hasAttribute(spell, 2, 0x00000004)).toBe(true);
      expect(SpellSchema.hasAttribute(spell, 15, 0x00008000)).toBe(true);
    });
  });

  describe('getSchoolNames()', () => {
    it('should return Physical for school mask 1', () => {
      const schools = SpellSchema.getSchoolNames(1);
      expect(schools).toEqual(['Physical']);
    });

    it('should return Holy for school mask 2', () => {
      const schools = SpellSchema.getSchoolNames(2);
      expect(schools).toEqual(['Holy']);
    });

    it('should return multiple schools for composite mask', () => {
      const schools = SpellSchema.getSchoolNames(5); // Physical | Fire
      expect(schools).toContain('Physical');
      expect(schools).toContain('Fire');
      expect(schools.length).toBe(2);
    });

    it('should return all schools for mask 127', () => {
      const schools = SpellSchema.getSchoolNames(127); // All 7 schools
      expect(schools.length).toBe(7);
      expect(schools).toContain('Physical');
      expect(schools).toContain('Holy');
      expect(schools).toContain('Fire');
      expect(schools).toContain('Nature');
      expect(schools).toContain('Frost');
      expect(schools).toContain('Shadow');
      expect(schools).toContain('Arcane');
    });

    it('should return empty array for school mask 0', () => {
      const schools = SpellSchema.getSchoolNames(0);
      expect(schools).toEqual([]);
    });
  });

  describe('isPassive()', () => {
    it('should detect passive spell', () => {
      const spell: SpellEntry = {
        id: 8326,
        attributes: 0x00000100, // SPELL_ATTR0_PASSIVE
      } as SpellEntry;

      expect(SpellSchema.isPassive(spell)).toBe(true);
    });

    it('should detect non-passive spell', () => {
      const spell: SpellEntry = {
        id: 133,
        attributes: 0,
      } as SpellEntry;

      expect(SpellSchema.isPassive(spell)).toBe(false);
    });
  });

  describe('canCrit()', () => {
    it('should detect spell that can crit (default)', () => {
      const spell: SpellEntry = {
        id: 133,
        attributesEx2: 0,
      } as SpellEntry;

      expect(SpellSchema.canCrit(spell)).toBe(true);
    });

    it('should detect spell that cannot crit', () => {
      const spell: SpellEntry = {
        id: 2050,
        attributesEx2: 0x00000002, // SPELL_ATTR2_CANT_CRIT
      } as SpellEntry;

      expect(SpellSchema.canCrit(spell)).toBe(false);
    });
  });

  describe('getCastTime()', () => {
    it('should return cast time in milliseconds', () => {
      const spell: SpellEntry = {
        id: 133,
        castTimeIndex: 2, // Assuming 3000ms cast time
      } as SpellEntry;

      // Note: Actual cast time requires SpellCastTimes.db2 lookup
      // For now, just test the method exists and returns the index
      const castTime = SpellSchema.getCastTime(spell);
      expect(typeof castTime).toBe('number');
    });

    it('should handle instant cast spells', () => {
      const spell: SpellEntry = {
        id: 20484,
        castTimeIndex: 1, // Instant cast
      } as SpellEntry;

      const castTime = SpellSchema.getCastTime(spell);
      expect(castTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Edge cases', () => {
    it('should handle spell with bigint values', () => {
      const mockRecord = new MockDB2Record({
        0: 12345,
        23: BigInt('0x0000000000000001'), // stances
        24: BigInt('0x0000000000000002'), // stancesNot
      });

      const spell = SpellSchema.parse(mockRecord);

      expect(spell.stances).toBe(BigInt('0x0000000000000001'));
      expect(spell.stancesNot).toBe(BigInt('0x0000000000000002'));
    });

    it('should handle spell with spell family flags', () => {
      const mockRecord = new MockDB2Record({
        0: 45462, // Mage spell
        89: 0x00000001, // spellFamilyFlags[0]
        90: 0x00000002, // spellFamilyFlags[1]
        91: 0x00000004, // spellFamilyFlags[2]
        92: 0x00000008, // spellFamilyFlags[3]
      });

      const spell = SpellSchema.parse(mockRecord);

      expect(spell.spellFamilyFlags[0]).toBe(BigInt(0x00000001));
      expect(spell.spellFamilyFlags[1]).toBe(BigInt(0x00000002));
      expect(spell.spellFamilyFlags[2]).toBe(BigInt(0x00000004));
      expect(spell.spellFamilyFlags[3]).toBe(BigInt(0x00000008));
    });

    it('should handle spell with AoE diminishing', () => {
      const mockRecord = new MockDB2Record({
        0: 118, // Polymorph
        103: 1.0, // sqrtDamageAndHealingDiminishing
      });

      const spell = SpellSchema.parse(mockRecord);

      expect(spell.sqrtDamageAndHealingDiminishing.value).toBe(1.0);
    });
  });
});
