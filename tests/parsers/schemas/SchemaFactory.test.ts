/**
 * Unit tests for SchemaFactory
 * Tests schema registry, factory methods, and type guards
 */

import { describe, it, expect } from '@jest/globals';
import {
  SchemaFactory,
  SchemaRegistry,
  isSpellEntry,
  isItemEntry,
  isItemSparseEntry,
  isItemTemplate,
} from '../../../src/parsers/schemas/SchemaFactory';
import { SpellEntry } from '../../../src/parsers/schemas/SpellSchema';
import { ItemEntry, ItemSparseEntry, ItemTemplate } from '../../../src/parsers/schemas/ItemSchema';
import { MockDB2Record } from './MockDB2Record';

describe('SchemaRegistry', () => {
  describe('getParserByFileName()', () => {
    it('should find Spell.db2 parser', () => {
      const parser = SchemaRegistry.getParserByFileName('Spell.db2');
      expect(parser).not.toBeNull();
      expect(parser!.getSchemaName()).toBe('Spell');
    });

    it('should find Item.db2 parser', () => {
      const parser = SchemaRegistry.getParserByFileName('Item.db2');
      expect(parser).not.toBeNull();
      expect(parser!.getSchemaName()).toBe('Item');
    });

    it('should find ItemSparse.db2 parser', () => {
      const parser = SchemaRegistry.getParserByFileName('ItemSparse.db2');
      expect(parser).not.toBeNull();
      expect(parser!.getSchemaName()).toBe('ItemSparse');
    });

    it('should be case-insensitive', () => {
      const parser1 = SchemaRegistry.getParserByFileName('SPELL.DB2');
      const parser2 = SchemaRegistry.getParserByFileName('spell.db2');
      const parser3 = SchemaRegistry.getParserByFileName('Spell.db2');

      expect(parser1).not.toBeNull();
      expect(parser2).not.toBeNull();
      expect(parser3).not.toBeNull();
      expect(parser1!.getSchemaName()).toBe('Spell');
      expect(parser2!.getSchemaName()).toBe('Spell');
      expect(parser3!.getSchemaName()).toBe('Spell');
    });

    it('should return null for unknown files', () => {
      const parser = SchemaRegistry.getParserByFileName('Unknown.db2');
      expect(parser).toBeNull();
    });
  });

  describe('getParserByTableHash()', () => {
    it('should find Spell.db2 parser by hash', () => {
      const parser = SchemaRegistry.getParserByTableHash(0x8c2c0c55);
      expect(parser).not.toBeNull();
      expect(parser!.getSchemaName()).toBe('Spell');
    });

    it('should find Item.db2 parser by hash', () => {
      const parser = SchemaRegistry.getParserByTableHash(0x50238ec2);
      expect(parser).not.toBeNull();
      expect(parser!.getSchemaName()).toBe('Item');
    });

    it('should find ItemSparse.db2 parser by hash', () => {
      const parser = SchemaRegistry.getParserByTableHash(0x919be54e);
      expect(parser).not.toBeNull();
      expect(parser!.getSchemaName()).toBe('ItemSparse');
    });

    it('should return null for unknown hashes', () => {
      const parser = SchemaRegistry.getParserByTableHash(0xdeadbeef);
      expect(parser).toBeNull();
    });
  });

  describe('hasSchemaForFile()', () => {
    it('should return true for registered files', () => {
      expect(SchemaRegistry.hasSchemaForFile('Spell.db2')).toBe(true);
      expect(SchemaRegistry.hasSchemaForFile('Item.db2')).toBe(true);
      expect(SchemaRegistry.hasSchemaForFile('ItemSparse.db2')).toBe(true);
    });

    it('should return false for unregistered files', () => {
      expect(SchemaRegistry.hasSchemaForFile('Unknown.db2')).toBe(false);
    });
  });

  describe('hasSchemaForHash()', () => {
    it('should return true for registered hashes', () => {
      expect(SchemaRegistry.hasSchemaForHash(0x8c2c0c55)).toBe(true);
      expect(SchemaRegistry.hasSchemaForHash(0x50238ec2)).toBe(true);
      expect(SchemaRegistry.hasSchemaForHash(0x919be54e)).toBe(true);
    });

    it('should return false for unregistered hashes', () => {
      expect(SchemaRegistry.hasSchemaForHash(0xdeadbeef)).toBe(false);
    });
  });

  describe('getRegisteredFileNames()', () => {
    it('should return all registered file names', () => {
      const fileNames = SchemaRegistry.getRegisteredFileNames();
      expect(fileNames).toContain('spell.db2');
      expect(fileNames).toContain('item.db2');
      expect(fileNames).toContain('itemsparse.db2');
      expect(fileNames.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('getRegisteredTableHashes()', () => {
    it('should return all registered table hashes', () => {
      const hashes = SchemaRegistry.getRegisteredTableHashes();
      expect(hashes).toContain(0x8c2c0c55);
      expect(hashes).toContain(0x50238ec2);
      expect(hashes).toContain(0x919be54e);
      expect(hashes.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('getParserInfo()', () => {
    it('should return parser information', () => {
      const parser = SchemaRegistry.getParserByFileName('Spell.db2');
      expect(parser).not.toBeNull();

      const info = SchemaRegistry.getParserInfo(parser!);
      expect(info.name).toBe('Spell');
      expect(info.fileNames).toContain('Spell.db2');
      expect(info.tableHashes.length).toBeGreaterThan(0);
      expect(info.tableHashes[0]).toMatch(/^0x[0-9A-F]+$/);
    });
  });
});

describe('SchemaFactory', () => {
  describe('parseByFileName()', () => {
    it('should parse Spell.db2 record', () => {
      const mockRecord = new MockDB2Record({
        0: 8326, // id (Ghost spell)
        5: 0x00000100, // attributes (SPELL_ATTR0_PASSIVE)
      });

      const spell = SchemaFactory.parseByFileName<SpellEntry>('Spell.db2', mockRecord);
      expect(spell).not.toBeNull();
      expect(spell!.id).toBe(8326);
      expect(spell!.attributes).toBe(0x00000100);
    });

    it('should parse Item.db2 record', () => {
      const mockRecord = new MockDB2Record({
        0: 25, // id (Worn Shortsword)
        1: 2, // classId (WEAPON)
        2: 7, // subclassId (Sword)
      });

      const item = SchemaFactory.parseByFileName<ItemEntry>('Item.db2', mockRecord);
      expect(item).not.toBeNull();
      expect(item!.id).toBe(25);
      expect(item!.classId).toBe(2);
    });

    it('should return null for unknown file', () => {
      const mockRecord = new MockDB2Record({ 0: 1 });
      const result = SchemaFactory.parseByFileName('Unknown.db2', mockRecord);
      expect(result).toBeNull();
    });

    it('should handle case-insensitive file names', () => {
      const mockRecord = new MockDB2Record({ 0: 8326 });
      const spell = SchemaFactory.parseByFileName<SpellEntry>('SPELL.DB2', mockRecord);
      expect(spell).not.toBeNull();
      expect(spell!.id).toBe(8326);
    });
  });

  describe('parseByTableHash()', () => {
    it('should parse by Spell.db2 hash', () => {
      const mockRecord = new MockDB2Record({
        0: 8326,
        5: 0x00000100,
      });

      const spell = SchemaFactory.parseByTableHash<SpellEntry>(0x8c2c0c55, mockRecord);
      expect(spell).not.toBeNull();
      expect(spell!.id).toBe(8326);
    });

    it('should parse by Item.db2 hash', () => {
      const mockRecord = new MockDB2Record({
        0: 25,
        1: 2,
      });

      const item = SchemaFactory.parseByTableHash<ItemEntry>(0x50238ec2, mockRecord);
      expect(item).not.toBeNull();
      expect(item!.id).toBe(25);
    });

    it('should return null for unknown hash', () => {
      const mockRecord = new MockDB2Record({ 0: 1 });
      const result = SchemaFactory.parseByTableHash(0xdeadbeef, mockRecord);
      expect(result).toBeNull();
    });
  });

  describe('Type-safe parsing methods', () => {
    it('should parse spell with parseSpell()', () => {
      const mockRecord = new MockDB2Record({
        0: 8326,
        5: 0x00000100,
      });

      const spell = SchemaFactory.parseSpell(mockRecord);
      expect(spell.id).toBe(8326);
      expect(spell.attributes).toBe(0x00000100);
    });

    it('should parse item basic with parseItemBasic()', () => {
      const mockRecord = new MockDB2Record({
        0: 25,
        1: 2,
        2: 7,
      });

      const item = SchemaFactory.parseItemBasic(mockRecord);
      expect(item.id).toBe(25);
      expect(item.classId).toBe(2);
      expect(item.subclassId).toBe(7);
    });

    it('should parse item sparse with parseItemSparse()', () => {
      const mockRecord = new MockDB2Record({
        0: 25,
        1: 'Worn Shortsword',
        5: 18, // sellPrice
      });

      const item = SchemaFactory.parseItemSparse(mockRecord);
      expect(item.id).toBe(25);
      expect(item.name).toBe('Worn Shortsword');
      expect(item.sellPrice).toBe(18);
    });

    it('should combine item template with parseItemTemplate()', () => {
      const basicRecord = new MockDB2Record({
        0: 25,
        1: 2, // WEAPON
        2: 7,
      });

      const sparseRecord = new MockDB2Record({
        0: 25,
        1: 'Worn Shortsword',
        5: 18,
      });

      const template = SchemaFactory.parseItemTemplate(basicRecord, sparseRecord);
      expect(template.basic.id).toBe(25);
      expect(template.basic.classId).toBe(2);
      expect(template.extended.name).toBe('Worn Shortsword');
      expect(template.extended.sellPrice).toBe(18);
    });
  });

  describe('getSchemaInfo()', () => {
    it('should return schema info for registered file', () => {
      const info = SchemaFactory.getSchemaInfo('Spell.db2');
      expect(info).not.toBeNull();
      expect(info!.name).toBe('Spell');
      expect(info!.fileNames).toContain('Spell.db2');
      expect(info!.tableHashes.length).toBeGreaterThan(0);
    });

    it('should return null for unregistered file', () => {
      const info = SchemaFactory.getSchemaInfo('Unknown.db2');
      expect(info).toBeNull();
    });
  });

  describe('hasSchema()', () => {
    it('should return true for registered files', () => {
      expect(SchemaFactory.hasSchema('Spell.db2')).toBe(true);
      expect(SchemaFactory.hasSchema('Item.db2')).toBe(true);
      expect(SchemaFactory.hasSchema('ItemSparse.db2')).toBe(true);
    });

    it('should return false for unregistered files', () => {
      expect(SchemaFactory.hasSchema('Unknown.db2')).toBe(false);
    });
  });

  describe('getSupportedFiles()', () => {
    it('should return all supported file names', () => {
      const files = SchemaFactory.getSupportedFiles();
      expect(files).toContain('spell.db2');
      expect(files).toContain('item.db2');
      expect(files).toContain('itemsparse.db2');
      expect(files.length).toBeGreaterThanOrEqual(3);
    });
  });
});

describe('Type Guards', () => {
  describe('isSpellEntry()', () => {
    it('should return true for valid SpellEntry', () => {
      const spell: SpellEntry = {
        id: 8326,
        attributes: 0x00000100,
      } as SpellEntry;

      expect(isSpellEntry(spell)).toBe(true);
    });

    it('should return false for non-SpellEntry', () => {
      const notSpell = { id: 25, classId: 2 };
      expect(isSpellEntry(notSpell)).toBe(false);
    });

    it('should return false for null', () => {
      expect(isSpellEntry(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isSpellEntry(undefined)).toBe(false);
    });
  });

  describe('isItemEntry()', () => {
    it('should return true for valid ItemEntry', () => {
      const item: ItemEntry = {
        id: 25,
        classId: 2,
        subclassId: 7,
      } as ItemEntry;

      expect(isItemEntry(item)).toBe(true);
    });

    it('should return false for non-ItemEntry', () => {
      const notItem = { id: 8326, attributes: 0 };
      expect(isItemEntry(notItem)).toBe(false);
    });

    it('should return false for null', () => {
      expect(isItemEntry(null)).toBe(false);
    });
  });

  describe('isItemSparseEntry()', () => {
    it('should return true for valid ItemSparseEntry', () => {
      const item: ItemSparseEntry = {
        id: 25,
        name: 'Worn Shortsword',
        stats: [],
      } as unknown as ItemSparseEntry;

      expect(isItemSparseEntry(item)).toBe(true);
    });

    it('should return false for non-ItemSparseEntry', () => {
      const notItem = { id: 25, classId: 2 };
      expect(isItemSparseEntry(notItem)).toBe(false);
    });

    it('should return false for null', () => {
      expect(isItemSparseEntry(null)).toBe(false);
    });
  });

  describe('isItemTemplate()', () => {
    it('should return true for valid ItemTemplate', () => {
      const template: ItemTemplate = {
        basic: {
          id: 25,
          classId: 2,
          subclassId: 7,
        } as unknown as ItemEntry,
        extended: {
          id: 25,
          name: 'Worn Shortsword',
          stats: [],
        } as unknown as ItemSparseEntry,
      };

      expect(isItemTemplate(template)).toBe(true);
    });

    it('should return false for non-ItemTemplate', () => {
      const notTemplate = { id: 25, classId: 2 };
      expect(isItemTemplate(notTemplate)).toBe(false);
    });

    it('should return false for invalid basic', () => {
      const invalid = {
        basic: { id: 25 },
        extended: {
          id: 25,
          name: 'Test',
          stats: [],
        } as unknown as ItemSparseEntry,
      };
      expect(isItemTemplate(invalid)).toBe(false);
    });

    it('should return false for null', () => {
      expect(isItemTemplate(null)).toBe(false);
    });
  });
});

describe('Integration Tests', () => {
  it('should parse and validate spell end-to-end', () => {
    const mockRecord = new MockDB2Record({
      0: 8326,
      5: 0x00000100,
    });

    const spell = SchemaFactory.parseByFileName<SpellEntry>('Spell.db2', mockRecord);
    expect(spell).not.toBeNull();
    expect(isSpellEntry(spell)).toBe(true);
    expect(spell!.id).toBe(8326);
  });

  it('should parse and validate item end-to-end', () => {
    const basicRecord = new MockDB2Record({
      0: 25,
      1: 2,
    });

    const sparseRecord = new MockDB2Record({
      0: 25,
      1: 'Worn Shortsword',
      5: 18,
    });

    const template = SchemaFactory.parseItemTemplate(basicRecord, sparseRecord);
    expect(isItemTemplate(template)).toBe(true);
    expect(isItemEntry(template.basic)).toBe(true);
    expect(isItemSparseEntry(template.extended)).toBe(true);
  });

  it('should handle multiple parsers concurrently', () => {
    const spellRecord = new MockDB2Record({ 0: 8326 });
    const itemRecord = new MockDB2Record({ 0: 25 });

    const spell = SchemaFactory.parseByFileName<SpellEntry>('Spell.db2', spellRecord);
    const item = SchemaFactory.parseByFileName<ItemEntry>('Item.db2', itemRecord);

    expect(spell).not.toBeNull();
    expect(item).not.toBeNull();
    expect(spell!.id).toBe(8326);
    expect(item!.id).toBe(25);
  });
});
