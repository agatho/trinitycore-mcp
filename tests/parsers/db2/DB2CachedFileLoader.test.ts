/**
 * Unit tests for DB2CachedFileLoader
 * Tests caching integration, performance, and memory management
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { DB2CachedFileLoader, DB2CachedLoaderFactory } from '../../../src/parsers/db2/DB2CachedFileLoader';
import { DB2Record } from '../../../src/parsers/db2/DB2Record';
import { CacheManager } from '../../../src/parsers/cache/RecordCache';

// Mock DB2FileLoader
jest.mock('../../../src/parsers/db2/DB2FileLoader', () => {
  return {
    DB2FileLoader: jest.fn().mockImplementation(() => ({
      load: jest.fn(),
      loadFromFile: jest.fn(),
      getHeader: jest.fn(() => ({
        recordCount: 100,
        recordSize: 64,
        fieldCount: 10,
      })),
      getSectionHeader: jest.fn((index: number) => ({
        recordCount: 50,
        stringTableSize: 1000,
      })),
      getRecordCount: jest.fn(() => 100),
      getRecord: jest.fn((index: number) => {
        // Create mock DB2Record
        const buffer = Buffer.alloc(64);
        buffer.writeUInt32LE(index, 0); // ID field
        const stringTable = Buffer.from('MockString\0', 'utf-8');
        return new DB2Record(buffer, stringTable, [], index);
      }),
    })),
  };
});

// Mock SchemaFactory
jest.mock('../../../src/parsers/schemas/SchemaFactory', () => {
  return {
    SchemaFactory: {
      parseByFileName: jest.fn((fileName: string, record: any) => {
        // Return mock parsed entry
        return {
          id: record.getUInt32(0),
          name: `MockEntry_${record.getUInt32(0)}`,
          type: 'test',
        };
      }),
      hasSchema: jest.fn(() => true),
    },
  };
});

describe('DB2CachedFileLoader', () => {
  let loader: DB2CachedFileLoader;

  beforeEach(() => {
    CacheManager.resetAll();
    loader = new DB2CachedFileLoader('Test.db2', { maxMemoryMB: 10 });
    loader.loadFromFile('/mock/path/Test.db2');
  });

  afterEach(() => {
    CacheManager.resetAll();
  });

  describe('Basic Operations', () => {
    it('should load DB2 file', () => {
      expect(loader.getRecordCount()).toBe(100);
    });

    it('should get header information', () => {
      const header = loader.getHeader();
      expect(header.recordCount).toBe(100);
      expect(header.recordSize).toBe(64);
    });

    it('should get section header', () => {
      const section = loader.getSectionHeader(0);
      expect(section.recordCount).toBe(50);
    });

    it('should get record count', () => {
      const count = loader.getRecordCount();
      expect(count).toBe(100);
    });
  });

  describe('Cached Record Access', () => {
    it('should cache records on first access', () => {
      const record1 = loader.getCachedRecord(0);
      expect(record1).toBeDefined();

      const stats = loader.getCacheStats();
      expect(stats.raw.entryCount).toBe(1);
    });

    it('should return cached record on second access', () => {
      const record1 = loader.getCachedRecord(0);
      const record2 = loader.getCachedRecord(0);

      // Same instance from cache
      expect(record1).toBe(record2);

      const stats = loader.getCacheStats();
      expect(stats.totalHits).toBe(1); // Second access was cache hit
      expect(stats.totalMisses).toBe(1); // First access was cache miss
    });

    it('should cache multiple records independently', () => {
      loader.getCachedRecord(0);
      loader.getCachedRecord(1);
      loader.getCachedRecord(2);

      const stats = loader.getCacheStats();
      expect(stats.raw.entryCount).toBe(3);
    });

    it('should track cache hits accurately', () => {
      // First accesses (misses)
      loader.getCachedRecord(0);
      loader.getCachedRecord(1);

      // Second accesses (hits)
      loader.getCachedRecord(0);
      loader.getCachedRecord(1);
      loader.getCachedRecord(0);

      const stats = loader.getCacheStats();
      expect(stats.totalHits).toBe(3);
      expect(stats.totalMisses).toBe(2);
    });
  });

  describe('Uncached Record Access', () => {
    it('should bypass cache with getRecord()', () => {
      const record1 = loader.getRecord(0);
      const record2 = loader.getRecord(0);

      // Different instances (not cached)
      expect(record1).not.toBe(record2);

      const stats = loader.getCacheStats();
      expect(stats.raw.entryCount).toBe(0); // No caching
    });
  });

  describe('Typed Record Access', () => {
    it('should parse and cache typed records', () => {
      const entry = loader.getTypedRecord<any>(0);

      expect(entry).toBeDefined();
      expect(entry?.id).toBe(0);
      expect(entry?.name).toBe('MockEntry_0');

      const stats = loader.getCacheStats();
      expect(stats.parsed.entryCount).toBe(1);
    });

    it('should return cached typed record on second access', () => {
      const entry1 = loader.getTypedRecord<any>(0);
      const entry2 = loader.getTypedRecord<any>(0);

      // Same instance from cache
      expect(entry1).toBe(entry2);

      const stats = loader.getCacheStats();
      expect(stats.totalHits).toBeGreaterThan(0);
    });

    it('should cache raw and parsed separately', () => {
      loader.getCachedRecord(0);
      loader.getTypedRecord<any>(0);

      const stats = loader.getCacheStats();
      expect(stats.raw.entryCount).toBe(1);
      expect(stats.parsed.entryCount).toBe(1);
    });
  });

  describe('Batch Operations', () => {
    it('should batch load raw records', () => {
      const records = loader.batchGetRecords([0, 1, 2, 3, 4]);

      expect(records).toHaveLength(5);
      expect(records[0].getUInt32(0)).toBe(0);
      expect(records[4].getUInt32(0)).toBe(4);

      const stats = loader.getCacheStats();
      expect(stats.raw.entryCount).toBe(5);
    });

    it('should batch load typed records', () => {
      const entries = loader.batchGetTypedRecords<any>([0, 1, 2]);

      expect(entries).toHaveLength(3);
      expect(entries[0]?.id).toBe(0);
      expect(entries[2]?.id).toBe(2);

      const stats = loader.getCacheStats();
      expect(stats.parsed.entryCount).toBe(3);
    });

    it('should leverage cache in batch operations', () => {
      // Preload some records
      loader.getCachedRecord(0);
      loader.getCachedRecord(1);

      // Batch load (should hit cache for 0 and 1)
      loader.batchGetRecords([0, 1, 2, 3]);

      const stats = loader.getCacheStats();
      expect(stats.totalHits).toBeGreaterThan(0);
    });
  });

  describe('Preloading', () => {
    it('should preload specific records', () => {
      loader.preloadRecords([0, 5, 10, 15]);

      const stats = loader.getCacheStats();
      expect(stats.raw.entryCount).toBe(4);
    });

    it('should preload all records', () => {
      loader.preloadAll();

      const stats = loader.getCacheStats();
      expect(stats.raw.entryCount).toBe(100);
    });

    it('should benefit from preloaded cache', () => {
      // Preload
      loader.preloadRecords([0, 1, 2]);

      // Access preloaded (should be cache hits)
      loader.getCachedRecord(0);
      loader.getCachedRecord(1);
      loader.getCachedRecord(2);

      const stats = loader.getCacheStats();
      expect(stats.totalHits).toBe(3);
    });
  });

  describe('Get All Records', () => {
    it('should get all raw records', () => {
      const records = loader.getAllRecords();

      expect(records).toHaveLength(100);
      expect(records[0].getUInt32(0)).toBe(0);
      expect(records[99].getUInt32(0)).toBe(99);
    });

    it('should get all typed records', () => {
      const entries = loader.getAllTypedRecords<any>();

      expect(entries).toHaveLength(100);
      expect(entries[0]?.id).toBe(0);
      expect(entries[99]?.id).toBe(99);
    });

    it('should cache all records when using getAllRecords', () => {
      loader.getAllRecords();

      const stats = loader.getCacheStats();
      expect(stats.raw.entryCount).toBe(100);
    });
  });

  describe('Cache Management', () => {
    it('should clear cache', () => {
      loader.getCachedRecord(0);
      loader.getCachedRecord(1);

      expect(loader.getCacheStats().raw.entryCount).toBe(2);

      loader.clearCache();

      expect(loader.getCacheStats().raw.entryCount).toBe(0);
    });

    it('should optimize cache by evicting cold entries', () => {
      // Fill cache beyond capacity (trigger eviction)
      for (let i = 0; i < 50; i++) {
        loader.getCachedRecord(i);
      }

      const statsBefore = loader.getCacheStats();
      const entriesBefore = statsBefore.raw.entryCount;

      loader.optimizeCache();

      const statsAfter = loader.getCacheStats();
      // Optimization may or may not evict depending on memory usage
      expect(statsAfter.raw.entryCount).toBeLessThanOrEqual(entriesBefore);
    });
  });

  describe('Cache Statistics', () => {
    it('should report cache statistics', () => {
      loader.getCachedRecord(0);
      loader.getTypedRecord<any>(1);

      const stats = loader.getCacheStats();

      // getTypedRecord(1) caches both raw (1) and parsed (1)
      // getCachedRecord(0) caches raw (0)
      // Total: raw = 2 (records 0 and 1), parsed = 1 (record 1)
      expect(stats.raw.entryCount).toBe(2);
      expect(stats.parsed.entryCount).toBe(1);
      expect(stats.totalHits).toBeDefined();
      expect(stats.totalMisses).toBeDefined();
      expect(stats.loadTime).toBeGreaterThanOrEqual(0);
    });

    it('should report memory usage', () => {
      loader.preloadRecords([0, 1, 2, 3, 4]);

      const memory = loader.getCacheMemoryUsage();

      expect(memory.rawMB).toBeGreaterThanOrEqual(0);
      expect(memory.parsedMB).toBeGreaterThanOrEqual(0);
      expect(memory.totalMB).toBe(memory.rawMB + memory.parsedMB);
    });

    it('should report cache efficiency', () => {
      // Generate some cache activity
      loader.getCachedRecord(0);
      loader.getCachedRecord(0); // Hit
      loader.getCachedRecord(1);

      const efficiency = loader.getCacheEfficiency();

      expect(efficiency.hitRate).toBeGreaterThan(0);
      expect(efficiency.hitRate).toBeLessThanOrEqual(100);
      expect(efficiency.memoryUsagePercent).toBeGreaterThanOrEqual(0);
      expect(efficiency.cacheablility).toBeGreaterThan(0);
    });

    it('should generate cache report', () => {
      loader.getCachedRecord(0);
      const report = loader.getCacheReport();

      expect(report).toContain('DB2 Cache Report');
      expect(report).toContain('Test.db2');
      expect(report).toContain('Load Time');
      expect(report).toContain('Cache Statistics');
      expect(report).toContain('Memory Usage');
    });
  });

  describe('Hot/Cold Records', () => {
    it('should identify hot records', () => {
      // Access record 0 multiple times
      loader.getCachedRecord(0);
      loader.getCachedRecord(0);
      loader.getCachedRecord(0);

      // Access other records once
      loader.getCachedRecord(1);
      loader.getCachedRecord(2);

      const hotRecords = loader.getHotRecords(3);

      expect(hotRecords.length).toBeGreaterThan(0);
      expect(hotRecords[0][0]).toContain('record:0'); // Most accessed
    });

    it('should identify cold records', () => {
      loader.getCachedRecord(0);
      loader.getCachedRecord(1);
      loader.getCachedRecord(2);

      // Access record 2 to make it warm
      loader.getCachedRecord(2);

      const coldRecords = loader.getColdRecords(3);

      expect(coldRecords.length).toBeGreaterThan(0);
      // Cold records should not include recently accessed record 2
    });
  });
});

describe('DB2CachedLoaderFactory', () => {
  beforeEach(() => {
    DB2CachedLoaderFactory.clearAll();
  });

  afterEach(() => {
    DB2CachedLoaderFactory.clearAll();
  });

  describe('Loader Creation', () => {
    it('should create loader for file', () => {
      const loader = DB2CachedLoaderFactory.getLoader('Spell.db2');
      expect(loader).toBeInstanceOf(DB2CachedFileLoader);
    });

    it('should return same loader instance for same file', () => {
      const loader1 = DB2CachedLoaderFactory.getLoader('Spell.db2');
      const loader2 = DB2CachedLoaderFactory.getLoader('Spell.db2');

      expect(loader1).toBe(loader2);
    });

    it('should be case-insensitive for file names', () => {
      const loader1 = DB2CachedLoaderFactory.getLoader('Spell.db2');
      const loader2 = DB2CachedLoaderFactory.getLoader('SPELL.DB2');
      const loader3 = DB2CachedLoaderFactory.getLoader('spell.db2');

      expect(loader1).toBe(loader2);
      expect(loader2).toBe(loader3);
    });

    it('should create separate loaders for different files', () => {
      const spellLoader = DB2CachedLoaderFactory.getLoader('Spell.db2');
      const itemLoader = DB2CachedLoaderFactory.getLoader('Item.db2');

      expect(spellLoader).not.toBe(itemLoader);
    });
  });

  describe('Global Management', () => {
    it('should clear all loaders', () => {
      const loader1 = DB2CachedLoaderFactory.getLoader('Spell.db2');
      const loader2 = DB2CachedLoaderFactory.getLoader('Item.db2');

      loader1.loadFromFile('/mock/Spell.db2');
      loader2.loadFromFile('/mock/Item.db2');

      loader1.getCachedRecord(0);
      loader2.getCachedRecord(0);

      DB2CachedLoaderFactory.clearAll();

      const files = DB2CachedLoaderFactory.getLoadedFiles();
      expect(files).toHaveLength(0);
    });

    it('should return list of loaded files', () => {
      DB2CachedLoaderFactory.getLoader('Spell.db2');
      DB2CachedLoaderFactory.getLoader('Item.db2');
      DB2CachedLoaderFactory.getLoader('ItemSparse.db2');

      const files = DB2CachedLoaderFactory.getLoadedFiles();

      expect(files).toHaveLength(3);
      expect(files).toContain('spell.db2');
      expect(files).toContain('item.db2');
      expect(files).toContain('itemsparse.db2');
    });

    it('should aggregate global statistics', () => {
      const loader1 = DB2CachedLoaderFactory.getLoader('Spell.db2');
      const loader2 = DB2CachedLoaderFactory.getLoader('Item.db2');

      loader1.loadFromFile('/mock/Spell.db2');
      loader2.loadFromFile('/mock/Item.db2');

      loader1.getCachedRecord(0);
      loader2.getCachedRecord(0);

      const globalStats = DB2CachedLoaderFactory.getGlobalStats();

      expect(globalStats.totalFiles).toBe(2);
      expect(globalStats.totalHits).toBeGreaterThanOrEqual(0);
      expect(globalStats.totalMisses).toBeGreaterThan(0);
      expect(globalStats.totalMemoryMB).toBeGreaterThanOrEqual(0);
      expect(globalStats.files.size).toBe(2);
    });
  });

  describe('Integration', () => {
    it('should support multiple files with independent caches', () => {
      const spellLoader = DB2CachedLoaderFactory.getLoader('Spell.db2');
      const itemLoader = DB2CachedLoaderFactory.getLoader('Item.db2');

      spellLoader.loadFromFile('/mock/Spell.db2');
      itemLoader.loadFromFile('/mock/Item.db2');

      spellLoader.getCachedRecord(0);
      itemLoader.getCachedRecord(0);

      const spellStats = spellLoader.getCacheStats();
      const itemStats = itemLoader.getCacheStats();

      expect(spellStats.raw.entryCount).toBe(1);
      expect(itemStats.raw.entryCount).toBe(1);
    });
  });
});
