/**
 * Spell Attribute Flag Database - Unit Tests
 *
 * Validates the integrity and completeness of the SPELL_ATTRIBUTE_DATABASE.
 *
 * @module tests/data/spell-attributes
 */

import {
  SPELL_ATTRIBUTE_DATABASE,
  AttributeCategory,
  AttributeField,
  AttributeFlag,
} from '../../src/data/spell-attributes';

describe('SPELL_ATTRIBUTE_DATABASE structure', () => {
  it('should have 16 attribute fields (Attributes0-15)', () => {
    expect(SPELL_ATTRIBUTE_DATABASE.length).toBe(16);
  });

  it('should have sequential indices from 0 to 15', () => {
    for (let i = 0; i < 16; i++) {
      expect(SPELL_ATTRIBUTE_DATABASE[i].index).toBe(i);
    }
  });

  it('should have correct field names (Attributes0-Attributes15)', () => {
    for (let i = 0; i < 16; i++) {
      expect(SPELL_ATTRIBUTE_DATABASE[i].fieldName).toBe(`Attributes${i}`);
    }
  });

  it('should have 31 or 32 flags per attribute field', () => {
    for (const field of SPELL_ATTRIBUTE_DATABASE) {
      // Field 8 (Attributes8) has 31 flags (bit 18 / 0x00040000 removed)
      expect(field.flags.length).toBeGreaterThanOrEqual(31);
      expect(field.flags.length).toBeLessThanOrEqual(32);
    }
  });

  it('should have 511 total flags (15 fields x 32 + 1 field x 31)', () => {
    const totalFlags = SPELL_ATTRIBUTE_DATABASE.reduce(
      (sum, field) => sum + field.flags.length, 0
    );
    expect(totalFlags).toBe(511);
  });
});

describe('AttributeFlag values', () => {
  it('should have power-of-2 values (bit flags)', () => {
    for (const field of SPELL_ATTRIBUTE_DATABASE) {
      for (const flag of field.flags) {
        // Each flag value should be a power of 2 (exactly one bit set)
        // Using bitwise check: v & (v - 1) === 0 for power of 2, but v must be > 0
        if (flag.value !== 0) {
          const v = flag.value >>> 0; // Treat as unsigned
          expect(v & (v - 1)).toBe(0);
        }
      }
    }
  });

  it('should have unique values within each field', () => {
    for (const field of SPELL_ATTRIBUTE_DATABASE) {
      const values = field.flags.map(f => f.value);
      const uniqueValues = new Set(values);
      expect(uniqueValues.size).toBe(field.flags.length);
    }
  });

  it('should have non-empty names for all flags', () => {
    for (const field of SPELL_ATTRIBUTE_DATABASE) {
      for (const flag of field.flags) {
        expect(flag.name.length).toBeGreaterThan(0);
      }
    }
  });

  it('should have non-empty titles for all flags', () => {
    for (const field of SPELL_ATTRIBUTE_DATABASE) {
      for (const flag of field.flags) {
        expect(flag.title.length).toBeGreaterThan(0);
      }
    }
  });

  it('should have valid categories for all flags', () => {
    const validCategories = Object.values(AttributeCategory);

    for (const field of SPELL_ATTRIBUTE_DATABASE) {
      for (const flag of field.flags) {
        expect(validCategories).toContain(flag.category);
      }
    }
  });
});

describe('Known spell attribute flags', () => {
  it('should have PROC_FAILURE_BURNS_CHARGE in Attributes0', () => {
    const attr0 = SPELL_ATTRIBUTE_DATABASE[0];
    const flag = attr0.flags.find(f => f.name === 'PROC_FAILURE_BURNS_CHARGE');

    expect(flag).toBeDefined();
    expect(flag!.value).toBe(0x00000001);
  });

  it('should have consistent flag ordering (bit 0 = 0x01, bit 1 = 0x02, etc.)', () => {
    const attr0 = SPELL_ATTRIBUTE_DATABASE[0];

    // First flag should be bit 0 (0x01)
    expect(attr0.flags[0].value).toBe(0x00000001);
    // Second flag should be bit 1 (0x02)
    expect(attr0.flags[1].value).toBe(0x00000002);
    // Third flag should be bit 2 (0x04)
    expect(attr0.flags[2].value).toBe(0x00000004);
  });
});

describe('AttributeCategory enum', () => {
  it('should have all expected categories', () => {
    expect(AttributeCategory.CASTING).toBe('casting');
    expect(AttributeCategory.TARGETING).toBe('targeting');
    expect(AttributeCategory.EFFECTS).toBe('effects');
    expect(AttributeCategory.COMBAT).toBe('combat');
    expect(AttributeCategory.AURA).toBe('aura');
    expect(AttributeCategory.RESTRICTIONS).toBe('restrictions');
    expect(AttributeCategory.UI).toBe('ui');
    expect(AttributeCategory.PROC).toBe('proc');
    expect(AttributeCategory.MECHANICS).toBe('mechanics');
    expect(AttributeCategory.IMMUNITIES).toBe('immunities');
    expect(AttributeCategory.COSTS).toBe('costs');
    expect(AttributeCategory.MOVEMENT).toBe('movement');
    expect(AttributeCategory.UNKNOWN).toBe('unknown');
  });

  it('should have 13 categories total', () => {
    const categories = Object.values(AttributeCategory);
    expect(categories.length).toBe(13);
  });
});

describe('AttributeField interface compliance', () => {
  it('should have all required fields', () => {
    for (const field of SPELL_ATTRIBUTE_DATABASE) {
      expect(typeof field.index).toBe('number');
      expect(typeof field.fieldName).toBe('string');
      expect(Array.isArray(field.flags)).toBe(true);
    }
  });
});

describe('Flag distribution', () => {
  it('should have flags across multiple categories', () => {
    const allCategories = new Set<string>();

    for (const field of SPELL_ATTRIBUTE_DATABASE) {
      for (const flag of field.flags) {
        allCategories.add(flag.category);
      }
    }

    // Should use at least 5 different categories
    expect(allCategories.size).toBeGreaterThanOrEqual(5);
  });

  it('should have NYI flags clearly marked', () => {
    for (const field of SPELL_ATTRIBUTE_DATABASE) {
      for (const flag of field.flags) {
        if (flag.nyi !== undefined) {
          expect(typeof flag.nyi).toBe('boolean');
        }
      }
    }
  });

  it('should have client-only flags clearly marked', () => {
    for (const field of SPELL_ATTRIBUTE_DATABASE) {
      for (const flag of field.flags) {
        if (flag.clientOnly !== undefined) {
          expect(typeof flag.clientOnly).toBe('boolean');
        }
      }
    }
  });
});
