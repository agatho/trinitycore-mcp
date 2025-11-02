/**
 * Unit tests for RecordCache
 * Tests LRU eviction, memory management, TTL, and statistics tracking
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { RecordCache, CacheManager, CacheStats, CacheConfig } from '../../../src/parsers/cache/RecordCache';

describe('RecordCache', () => {
  let cache: RecordCache<any>;

  beforeEach(() => {
    cache = new RecordCache({ maxMemoryMB: 1 }); // 1MB limit for testing
  });

  describe('Basic Operations', () => {
    it('should store and retrieve values', () => {
      cache.set('key1', { data: 'value1' });
      const result = cache.get('key1');
      expect(result).toEqual({ data: 'value1' });
    });

    it('should return null for missing keys', () => {
      const result = cache.get('nonexistent');
      expect(result).toBeNull();
    });

    it('should check key existence', () => {
      cache.set('key1', 'value1');
      expect(cache.has('key1')).toBe(true);
      expect(cache.has('key2')).toBe(false);
    });

    it('should delete entries', () => {
      cache.set('key1', 'value1');
      expect(cache.has('key1')).toBe(true);

      const deleted = cache.delete('key1');
      expect(deleted).toBe(true);
      expect(cache.has('key1')).toBe(false);
    });

    it('should return false when deleting nonexistent key', () => {
      const deleted = cache.delete('nonexistent');
      expect(deleted).toBe(false);
    });

    it('should clear all entries', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');

      cache.clear();

      expect(cache.has('key1')).toBe(false);
      expect(cache.has('key2')).toBe(false);
      expect(cache.has('key3')).toBe(false);
      expect(cache.getStats().entryCount).toBe(0);
    });

    it('should return all keys', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');

      const keys = cache.keys();
      expect(keys).toHaveLength(3);
      expect(keys).toContain('key1');
      expect(keys).toContain('key2');
      expect(keys).toContain('key3');
    });

    it('should update existing entries', () => {
      cache.set('key1', 'oldValue');
      cache.set('key1', 'newValue');

      expect(cache.get('key1')).toBe('newValue');
      expect(cache.getStats().entryCount).toBe(1);
    });
  });

  describe('Statistics Tracking', () => {
    it('should track cache hits', () => {
      cache.set('key1', 'value1');

      cache.get('key1');
      cache.get('key1');

      const stats = cache.getStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(0);
    });

    it('should track cache misses', () => {
      cache.get('nonexistent1');
      cache.get('nonexistent2');

      const stats = cache.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(2);
    });

    it('should calculate hit rate correctly', () => {
      cache.set('key1', 'value1');

      cache.get('key1'); // Hit
      cache.get('key1'); // Hit
      cache.get('key2'); // Miss

      const stats = cache.getStats();
      expect(stats.hitRate).toBeCloseTo(66.67, 1); // 2 hits / 3 total = 66.67%
    });

    it('should track entry count', () => {
      expect(cache.getStats().entryCount).toBe(0);

      cache.set('key1', 'value1');
      expect(cache.getStats().entryCount).toBe(1);

      cache.set('key2', 'value2');
      expect(cache.getStats().entryCount).toBe(2);

      cache.delete('key1');
      expect(cache.getStats().entryCount).toBe(1);
    });

    it('should track total size', () => {
      const stats1 = cache.getStats();
      expect(stats1.totalSize).toBe(0);

      cache.set('key1', 'test', 100); // Size hint: 100 bytes
      const stats2 = cache.getStats();
      expect(stats2.totalSize).toBe(100);

      cache.set('key2', 'test2', 200); // Size hint: 200 bytes
      const stats3 = cache.getStats();
      expect(stats3.totalSize).toBe(300);
    });

    it('should reset statistics', () => {
      cache.set('key1', 'value1');
      cache.get('key1'); // Hit
      cache.get('key2'); // Miss

      cache.resetStats();

      const stats = cache.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.hitRate).toBe(0);
      // entryCount and totalSize should NOT be reset
      expect(stats.entryCount).toBe(1);
    });
  });

  describe('Memory Management', () => {
    it('should report memory usage in MB', () => {
      cache.set('key1', 'test', 1024 * 1024); // 1MB

      const usageMB = cache.getMemoryUsageMB();
      expect(usageMB).toBeCloseTo(1.0, 1);
    });

    it('should report memory usage percentage', () => {
      const cache1MB = new RecordCache({ maxMemoryMB: 10 });
      cache1MB.set('key1', 'test', 5 * 1024 * 1024); // 5MB

      const percent = cache1MB.getMemoryUsagePercent();
      expect(percent).toBeCloseTo(50, 1); // 5MB / 10MB = 50%
    });

    it('should estimate size of strings', () => {
      cache.set('key1', 'test'); // 4 chars * 2 bytes = 8 bytes

      const stats = cache.getStats();
      expect(stats.totalSize).toBeGreaterThanOrEqual(8);
    });

    it('should estimate size of numbers', () => {
      cache.set('key1', 12345);

      const stats = cache.getStats();
      expect(stats.totalSize).toBe(8); // 64-bit number
    });

    it('should estimate size of arrays', () => {
      cache.set('key1', [1, 2, 3]); // Array overhead + 3 numbers

      const stats = cache.getStats();
      expect(stats.totalSize).toBeGreaterThanOrEqual(24 + 3 * 8); // 24 overhead + 3*8 numbers
    });

    it('should estimate size of objects', () => {
      cache.set('key1', { a: 1, b: 2 });

      const stats = cache.getStats();
      expect(stats.totalSize).toBeGreaterThan(40); // Object overhead + keys + values
    });

    it('should use size hint when provided', () => {
      cache.set('key1', 'test', 1000); // Size hint: 1000 bytes

      const stats = cache.getStats();
      expect(stats.totalSize).toBe(1000);
    });
  });

  describe('LRU Eviction', () => {
    it('should evict least recently used entries', () => {
      const smallCache = new RecordCache({ maxMemoryMB: 0.001 }); // ~1KB limit

      // Fill cache
      smallCache.set('key1', 'value1', 500);
      smallCache.set('key2', 'value2', 500);

      // Access key1 to make it recently used
      smallCache.get('key1');

      // Add new entry that requires eviction
      smallCache.set('key3', 'value3', 500);

      // key2 should be evicted (least recently used)
      expect(smallCache.has('key1')).toBe(true); // Recently accessed
      expect(smallCache.has('key2')).toBe(false); // Evicted
      expect(smallCache.has('key3')).toBe(true); // Just added
    });

    it('should evict by access count when last accessed times are equal', () => {
      const smallCache = new RecordCache({ maxMemoryMB: 0.001 }); // ~1KB limit

      // Fill cache
      smallCache.set('key1', 'value1', 500);
      smallCache.set('key2', 'value2', 500);

      // Access key1 multiple times
      smallCache.get('key1');
      smallCache.get('key1');
      smallCache.get('key1');

      // Access key2 once
      smallCache.get('key2');

      // Add new entry
      smallCache.set('key3', 'value3', 500);

      // key2 should be evicted (fewer accesses)
      expect(smallCache.has('key1')).toBe(true); // More accesses
      expect(smallCache.has('key2')).toBe(false); // Fewer accesses, evicted
      expect(smallCache.has('key3')).toBe(true); // Just added
    });

    it('should track eviction count', () => {
      const smallCache = new RecordCache({ maxMemoryMB: 0.001 }); // ~1KB limit

      smallCache.set('key1', 'value1', 500);
      smallCache.set('key2', 'value2', 500);
      smallCache.set('key3', 'value3', 500); // Triggers eviction

      const stats = smallCache.getStats();
      expect(stats.evictions).toBeGreaterThan(0);
    });

    it('should evict multiple entries if needed', () => {
      const smallCache = new RecordCache({ maxMemoryMB: 0.001 }); // ~1KB limit

      // Fill with small entries
      smallCache.set('key1', 'a', 200);
      smallCache.set('key2', 'b', 200);
      smallCache.set('key3', 'c', 200);
      smallCache.set('key4', 'd', 200);

      // Add large entry requiring multiple evictions
      smallCache.set('key5', 'large', 900);

      const stats = smallCache.getStats();
      expect(stats.evictions).toBeGreaterThanOrEqual(3); // Multiple entries evicted
      expect(smallCache.has('key5')).toBe(true);
    });

    it('should respect maxEntries limit', () => {
      const limitedCache = new RecordCache({ maxMemoryMB: 10, maxEntries: 3 });

      limitedCache.set('key1', 'value1', 10);
      limitedCache.set('key2', 'value2', 10);
      limitedCache.set('key3', 'value3', 10);

      expect(limitedCache.getStats().entryCount).toBe(3);

      // Adding 4th entry should trigger eviction
      limitedCache.set('key4', 'value4', 10);

      expect(limitedCache.getStats().entryCount).toBeLessThanOrEqual(3);
    });

    it('should not evict if autoEvict is disabled', () => {
      const noEvictCache = new RecordCache({ maxMemoryMB: 0.001, autoEvict: false });

      // Overfill cache
      noEvictCache.set('key1', 'value1', 500);
      noEvictCache.set('key2', 'value2', 500);
      noEvictCache.set('key3', 'value3', 500); // Exceeds limit but no eviction

      expect(noEvictCache.has('key1')).toBe(true);
      expect(noEvictCache.has('key2')).toBe(true);
      expect(noEvictCache.has('key3')).toBe(true);
      expect(noEvictCache.getStats().evictions).toBe(0);
    });
  });

  describe('TTL (Time-to-Live)', () => {
    it('should expire entries after TTL', (done) => {
      const ttlCache = new RecordCache({ maxMemoryMB: 10, ttl: 100 }); // 100ms TTL

      ttlCache.set('key1', 'value1');
      expect(ttlCache.get('key1')).toBe('value1');

      // Wait for TTL expiration
      setTimeout(() => {
        expect(ttlCache.get('key1')).toBeNull(); // Expired
        expect(ttlCache.has('key1')).toBe(false);
        done();
      }, 150);
    });

    it('should not expire if TTL is 0', (done) => {
      const noTtlCache = new RecordCache({ maxMemoryMB: 10, ttl: 0 });

      noTtlCache.set('key1', 'value1');

      setTimeout(() => {
        expect(noTtlCache.get('key1')).toBe('value1'); // Still valid
        done();
      }, 100);
    });

    it('should manually evict expired entries', (done) => {
      const ttlCache = new RecordCache({ maxMemoryMB: 10, ttl: 50 }); // 50ms TTL

      ttlCache.set('key1', 'value1');
      ttlCache.set('key2', 'value2');

      setTimeout(() => {
        const evicted = ttlCache.evictExpired();
        expect(evicted).toBe(2);
        expect(ttlCache.getStats().entryCount).toBe(0);
        done();
      }, 100);
    });

    it('should return 0 evictions if no TTL configured', () => {
      const noTtlCache = new RecordCache({ maxMemoryMB: 10, ttl: 0 });

      noTtlCache.set('key1', 'value1');
      const evicted = noTtlCache.evictExpired();

      expect(evicted).toBe(0);
    });
  });

  describe('Hot/Cold Entry Tracking', () => {
    it('should return hot entries by access count', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');

      // Make key2 hot
      cache.get('key2');
      cache.get('key2');
      cache.get('key2');

      // Make key1 warm
      cache.get('key1');

      const hotEntries = cache.getHotEntries(2);
      expect(hotEntries).toHaveLength(2);
      expect(hotEntries[0][0]).toBe('key2'); // Most accessed
      expect(hotEntries[1][0]).toBe('key1'); // Second most
    });

    it('should limit hot entries to specified count', () => {
      for (let i = 0; i < 10; i++) {
        cache.set(`key${i}`, `value${i}`);
      }

      const hotEntries = cache.getHotEntries(3);
      expect(hotEntries).toHaveLength(3);
    });

    it('should return cold entries by last accessed time', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');

      // Access key3 and key2 to make them warm
      cache.get('key3');
      cache.get('key2');

      const coldEntries = cache.getColdEntries(2);
      expect(coldEntries).toHaveLength(2);
      expect(coldEntries[0][0]).toBe('key1'); // Least recently accessed
    });

    it('should limit cold entries to specified count', () => {
      for (let i = 0; i < 10; i++) {
        cache.set(`key${i}`, `value${i}`);
      }

      const coldEntries = cache.getColdEntries(3);
      expect(coldEntries).toHaveLength(3);
    });
  });

  describe('Configuration Management', () => {
    it('should return current configuration', () => {
      const config = cache.getConfig();

      expect(config.maxMemoryMB).toBe(1);
      expect(config.maxEntries).toBeDefined();
      expect(config.ttl).toBeDefined();
      expect(config.autoEvict).toBeDefined();
    });

    it('should update configuration', () => {
      cache.updateConfig({ maxMemoryMB: 5, ttl: 1000 });

      const config = cache.getConfig();
      expect(config.maxMemoryMB).toBe(5);
      expect(config.ttl).toBe(1000);
    });

    it('should trigger eviction after lowering memory limit', () => {
      const isolatedCache = new RecordCache({ maxMemoryMB: 10, autoEvict: true });

      isolatedCache.set('key1', 'value1', 500 * 1024); // 500KB
      isolatedCache.set('key2', 'value2', 600 * 1024); // 600KB

      expect(isolatedCache.getStats().entryCount).toBe(2);

      // Lower limit to 0.8MB (should trigger eviction)
      isolatedCache.updateConfig({ maxMemoryMB: 0.8 });

      expect(isolatedCache.getStats().evictions).toBeGreaterThan(0);
    });

    it('should use default configuration values', () => {
      const defaultCache = new RecordCache();
      const config = defaultCache.getConfig();

      expect(config.maxMemoryMB).toBe(50); // Default
      expect(config.maxEntries).toBe(100000); // Default
      expect(config.ttl).toBe(0); // No expiry
      expect(config.autoEvict).toBe(true); // Auto evict
    });
  });
});

describe('CacheManager', () => {
  beforeEach(() => {
    CacheManager.resetAll();
  });

  afterEach(() => {
    CacheManager.resetAll();
  });

  describe('Cache Creation and Retrieval', () => {
    it('should create cache for file name', () => {
      const cache = CacheManager.getCache('Spell.db2');
      expect(cache).toBeDefined();
      expect(cache).toBeInstanceOf(RecordCache);
    });

    it('should return same cache instance for same file', () => {
      const cache1 = CacheManager.getCache('Spell.db2');
      const cache2 = CacheManager.getCache('Spell.db2');

      expect(cache1).toBe(cache2);
    });

    it('should be case-insensitive for file names', () => {
      const cache1 = CacheManager.getCache('Spell.db2');
      const cache2 = CacheManager.getCache('SPELL.DB2');
      const cache3 = CacheManager.getCache('spell.db2');

      expect(cache1).toBe(cache2);
      expect(cache2).toBe(cache3);
    });

    it('should create separate caches for different files', () => {
      const spellCache = CacheManager.getCache('Spell.db2');
      const itemCache = CacheManager.getCache('Item.db2');

      expect(spellCache).not.toBe(itemCache);
    });

    it('should apply custom configuration', () => {
      const cache = CacheManager.getCache('Test.db2', { maxMemoryMB: 100 });
      const config = cache.getConfig();

      expect(config.maxMemoryMB).toBe(100);
    });
  });

  describe('Cache Management', () => {
    it('should clear specific cache', () => {
      const cache = CacheManager.getCache('Spell.db2');
      cache.set('key1', 'value1');

      expect(cache.has('key1')).toBe(true);

      CacheManager.clearCache('Spell.db2');

      expect(cache.has('key1')).toBe(false);
    });

    it('should clear all caches', () => {
      const spellCache = CacheManager.getCache('Spell.db2');
      const itemCache = CacheManager.getCache('Item.db2');

      spellCache.set('key1', 'value1');
      itemCache.set('key2', 'value2');

      CacheManager.clearAll();

      expect(spellCache.has('key1')).toBe(false);
      expect(itemCache.has('key2')).toBe(false);
    });

    it('should return list of cached files', () => {
      CacheManager.getCache('Spell.db2');
      CacheManager.getCache('Item.db2');
      CacheManager.getCache('ItemSparse.db2');

      const files = CacheManager.getCachedFiles();

      expect(files).toHaveLength(3);
      expect(files).toContain('spell.db2'); // Normalized
      expect(files).toContain('item.db2');
      expect(files).toContain('itemsparse.db2');
    });
  });

  describe('Statistics Aggregation', () => {
    it('should calculate total memory usage', () => {
      const spellCache = CacheManager.getCache('Spell.db2');
      const itemCache = CacheManager.getCache('Item.db2');

      spellCache.set('key1', 'value1', 500 * 1024); // 500KB
      itemCache.set('key2', 'value2', 300 * 1024); // 300KB

      const totalMB = CacheManager.getTotalMemoryUsageMB();
      expect(totalMB).toBeCloseTo(0.8, 1); // ~800KB
    });

    it('should return statistics for all caches', () => {
      const spellCache = CacheManager.getCache('Spell.db2');
      const itemCache = CacheManager.getCache('Item.db2');

      spellCache.set('key1', 'value1');
      itemCache.set('key2', 'value2');

      const allStats = CacheManager.getAllStats();

      expect(allStats.size).toBe(2);
      expect(allStats.has('spell.db2')).toBe(true);
      expect(allStats.has('item.db2')).toBe(true);

      const spellStats = allStats.get('spell.db2');
      expect(spellStats?.entryCount).toBe(1);

      const itemStats = allStats.get('item.db2');
      expect(itemStats?.entryCount).toBe(1);
    });

    it('should return empty stats for no caches', () => {
      const totalMB = CacheManager.getTotalMemoryUsageMB();
      const allStats = CacheManager.getAllStats();

      expect(totalMB).toBe(0);
      expect(allStats.size).toBe(0);
    });
  });

  describe('Type-Safe Cache Access', () => {
    interface SpellRecord {
      id: number;
      name: string;
      manaCost: number;
    }

    interface ItemRecord {
      id: number;
      name: string;
      quality: number;
    }

    it('should support typed cache access', () => {
      const spellCache = CacheManager.getCache<SpellRecord>('Spell.db2');

      const spell: SpellRecord = { id: 8326, name: 'Ghost', manaCost: 0 };
      spellCache.set('spell:8326', spell);

      const retrieved = spellCache.get('spell:8326');
      expect(retrieved).toEqual(spell);
      expect(retrieved?.id).toBe(8326);
      expect(retrieved?.name).toBe('Ghost');
    });

    it('should maintain type safety across multiple caches', () => {
      const spellCache = CacheManager.getCache<SpellRecord>('Spell.db2');
      const itemCache = CacheManager.getCache<ItemRecord>('Item.db2');

      const spell: SpellRecord = { id: 8326, name: 'Ghost', manaCost: 0 };
      const item: ItemRecord = { id: 25, name: 'Worn Shortsword', quality: 1 };

      spellCache.set('spell:8326', spell);
      itemCache.set('item:25', item);

      const retrievedSpell = spellCache.get('spell:8326');
      const retrievedItem = itemCache.get('item:25');

      expect(retrievedSpell?.manaCost).toBe(0);
      expect(retrievedItem?.quality).toBe(1);
    });
  });
});

describe('RecordCache Integration', () => {
  beforeEach(() => {
    CacheManager.resetAll();
  });

  afterEach(() => {
    CacheManager.resetAll();
  });

  it('should handle realistic DB2 record caching', () => {
    const cache = CacheManager.getCache('Spell.db2', { maxMemoryMB: 10 });

    // Simulate caching spell records
    for (let i = 1; i <= 100; i++) {
      const spell = {
        id: i,
        name: `Spell ${i}`,
        attributes: i * 100,
        manaCost: i * 10,
        range: i * 5,
      };
      cache.set(`spell:${i}`, spell);
    }

    const stats = cache.getStats();
    expect(stats.entryCount).toBe(100);
    expect(stats.totalSize).toBeGreaterThan(0);

    // Access some entries
    cache.get('spell:50');
    cache.get('spell:75');
    cache.get('spell:25');

    const updatedStats = cache.getStats();
    expect(updatedStats.hits).toBeGreaterThan(0);
  });

  it('should handle large record sets efficiently', () => {
    const cache = CacheManager.getCache('Item.db2', { maxMemoryMB: 50 });

    // Cache 10,000 item records
    for (let i = 1; i <= 10000; i++) {
      cache.set(`item:${i}`, { id: i, name: `Item ${i}`, quality: i % 5 }, 500);
    }

    const stats = cache.getStats();
    expect(stats.entryCount).toBeLessThanOrEqual(10000);
    expect(cache.getMemoryUsageMB()).toBeLessThanOrEqual(50);
  });

  it('should support multiple file caches simultaneously', () => {
    const spellCache = CacheManager.getCache('Spell.db2');
    const itemCache = CacheManager.getCache('Item.db2');
    const itemSparseCache = CacheManager.getCache('ItemSparse.db2');

    spellCache.set('spell:1', { id: 1 });
    itemCache.set('item:1', { id: 1 });
    itemSparseCache.set('item:1', { id: 1 });

    expect(CacheManager.getCachedFiles()).toHaveLength(3);
    expect(CacheManager.getTotalMemoryUsageMB()).toBeGreaterThan(0);
  });
});
