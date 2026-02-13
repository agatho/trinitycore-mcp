/**
 * Spell Range Database - Unit Tests
 *
 * Validates the integrity and correctness of the SPELL_RANGES data.
 *
 * @module tests/data/spell-ranges
 */

import { SPELL_RANGES, SpellRangeEntry } from '../../src/data/spell-ranges';

describe('SPELL_RANGES data integrity', () => {
  it('should have 68 entries', () => {
    expect(SPELL_RANGES.length).toBe(68);
  });

  it('should have unique IDs', () => {
    const ids = SPELL_RANGES.map(r => r.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(SPELL_RANGES.length);
  });

  it('should have valid numeric fields for all entries', () => {
    for (const range of SPELL_RANGES) {
      expect(typeof range.id).toBe('number');
      expect(range.id).toBeGreaterThan(0);
      expect(typeof range.minRangeHostile).toBe('number');
      expect(typeof range.minRangeFriend).toBe('number');
      expect(typeof range.maxRangeHostile).toBe('number');
      expect(typeof range.maxRangeFriend).toBe('number');
      expect(typeof range.flags).toBe('number');
      expect(range.minRangeHostile).toBeGreaterThanOrEqual(0);
      expect(range.minRangeFriend).toBeGreaterThanOrEqual(0);
      expect(range.maxRangeHostile).toBeGreaterThanOrEqual(0);
      expect(range.maxRangeFriend).toBeGreaterThanOrEqual(0);
    }
  });

  it('should have non-empty display names', () => {
    for (const range of SPELL_RANGES) {
      expect(range.displayName.length).toBeGreaterThan(0);
      expect(range.displayNameShort.length).toBeGreaterThan(0);
    }
  });

  it('should have min range <= max range for hostile', () => {
    for (const range of SPELL_RANGES) {
      expect(range.minRangeHostile).toBeLessThanOrEqual(range.maxRangeHostile);
    }
  });

  it('should have min range <= max range for friendly', () => {
    for (const range of SPELL_RANGES) {
      expect(range.minRangeFriend).toBeLessThanOrEqual(range.maxRangeFriend);
    }
  });
});

describe('SPELL_RANGES known entries', () => {
  it('should have Melee Range (ID 1) with 0-5 yards', () => {
    const melee = SPELL_RANGES.find(r => r.id === 1);

    expect(melee).toBeDefined();
    expect(melee!.maxRangeHostile).toBe(5);
    expect(melee!.maxRangeFriend).toBe(5);
    expect(melee!.minRangeHostile).toBe(0);
    expect(melee!.displayNameShort).toBe('Melee');
    expect(melee!.flags).toBe(1); // Combat range flag
  });

  it('should have Short Range (ID 2) with 0-30 yards', () => {
    const shortRange = SPELL_RANGES.find(r => r.id === 2);

    expect(shortRange).toBeDefined();
    expect(shortRange!.maxRangeHostile).toBe(30);
    expect(shortRange!.displayNameShort).toBe('30yd');
  });

  it('should have Medium Range (ID 3) with 0-35 yards', () => {
    const medRange = SPELL_RANGES.find(r => r.id === 3);

    expect(medRange).toBeDefined();
    expect(medRange!.maxRangeHostile).toBe(35);
  });

  it('should have Self Only range (ID 6) with 0-0 yards', () => {
    const selfOnly = SPELL_RANGES.find(r => r.id === 6);

    expect(selfOnly).toBeDefined();
    expect(selfOnly!.maxRangeHostile).toBe(0);
    expect(selfOnly!.maxRangeFriend).toBe(0);
  });

  it('should have a variety of max ranges', () => {
    const maxRanges = new Set(SPELL_RANGES.map(r => r.maxRangeHostile));

    // Should have multiple distinct ranges
    expect(maxRanges.size).toBeGreaterThan(5);
    // Common ranges should be present
    expect(maxRanges.has(0)).toBe(true);   // Self
    expect(maxRanges.has(5)).toBe(true);   // Melee
    expect(maxRanges.has(30)).toBe(true);  // Short
    expect(maxRanges.has(40)).toBe(true);  // Long
  });
});

describe('SpellRangeEntry type validation', () => {
  it('should conform to SpellRangeEntry interface', () => {
    const first = SPELL_RANGES[0];

    // TypeScript compile-time check, but also verify at runtime
    const entry: SpellRangeEntry = first;
    expect(entry.id).toBeDefined();
    expect(entry.minRangeHostile).toBeDefined();
    expect(entry.minRangeFriend).toBeDefined();
    expect(entry.maxRangeHostile).toBeDefined();
    expect(entry.maxRangeFriend).toBeDefined();
    expect(entry.flags).toBeDefined();
    expect(entry.displayName).toBeDefined();
    expect(entry.displayNameShort).toBeDefined();
  });
});
