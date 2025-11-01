/**
 * RecordCache.ts
 *
 * In-memory LRU cache for DB2/DBC records with automatic eviction
 * Optimized for <50MB memory usage per file and <100ms access times
 *
 * Week 6: Phase 3.1 - Caching Layer Implementation
 */

/**
 * Cache Entry with access tracking
 */
interface CacheEntry<T> {
  key: string;
  value: T;
  size: number; // Estimated size in bytes
  accessCount: number;
  lastAccessed: number; // Timestamp
}

/**
 * Cache Statistics
 */
export interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  totalSize: number;
  entryCount: number;
  hitRate: number;
}

/**
 * Cache Configuration
 */
export interface CacheConfig {
  maxMemoryMB: number; // Maximum memory in megabytes
  maxEntries?: number; // Maximum number of entries (optional)
  ttl?: number; // Time-to-live in milliseconds (optional, 0 = no expiry)
  autoEvict?: boolean; // Automatically evict on memory pressure (default: true)
}

/**
 * RecordCache - In-memory LRU cache for DB2/DBC records
 *
 * Features:
 * - LRU eviction strategy
 * - Memory limit enforcement (<50MB default)
 * - Fast access (<100ms guaranteed)
 * - Size-based eviction
 * - TTL support (optional)
 * - Hit/miss statistics
 */
export class RecordCache<T = any> {
  private cache: Map<string, CacheEntry<T>>;
  private config: Required<CacheConfig>;
  private stats: CacheStats;

  constructor(config: Partial<CacheConfig> = {}) {
    this.cache = new Map();

    // Default configuration
    this.config = {
      maxMemoryMB: config.maxMemoryMB || 50,
      maxEntries: config.maxEntries || 100000,
      ttl: config.ttl || 0, // No expiry by default
      autoEvict: config.autoEvict !== undefined ? config.autoEvict : true,
    };

    // Initialize statistics
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      totalSize: 0,
      entryCount: 0,
      hitRate: 0,
    };
  }

  /**
   * Get value from cache
   * @param key Cache key
   * @returns Cached value or null if not found
   */
  public get(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      this.updateHitRate();
      return null;
    }

    // Check TTL expiry
    if (this.config.ttl > 0) {
      const age = Date.now() - entry.lastAccessed;
      if (age > this.config.ttl) {
        // Expired, remove and return null
        this.delete(key);
        this.stats.misses++;
        this.updateHitRate();
        return null;
      }
    }

    // Update access metadata
    entry.accessCount++;
    entry.lastAccessed = Date.now();

    this.stats.hits++;
    this.updateHitRate();

    return entry.value;
  }

  /**
   * Set value in cache
   * @param key Cache key
   * @param value Value to cache
   * @param sizeHint Optional size hint in bytes (auto-estimated if not provided)
   */
  public set(key: string, value: T, sizeHint?: number): void {
    // Check if already exists
    const existing = this.cache.get(key);
    if (existing) {
      // Update existing entry
      this.stats.totalSize -= existing.size;
    }

    // Estimate size if not provided
    const size = sizeHint || this.estimateSize(value);

    // Check if we need to evict
    if (this.config.autoEvict) {
      this.evictIfNeeded(size);
    }

    // Create new entry
    const entry: CacheEntry<T> = {
      key,
      value,
      size,
      accessCount: 1,
      lastAccessed: Date.now(),
    };

    this.cache.set(key, entry);
    this.stats.totalSize += size;
    this.stats.entryCount = this.cache.size;
  }

  /**
   * Delete entry from cache
   * @param key Cache key
   * @returns True if deleted, false if not found
   */
  public delete(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) {
      return false;
    }

    this.stats.totalSize -= entry.size;
    this.cache.delete(key);
    this.stats.entryCount = this.cache.size;

    return true;
  }

  /**
   * Check if key exists in cache
   * @param key Cache key
   * @returns True if exists and not expired
   */
  public has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) {
      return false;
    }

    // Check TTL expiry
    if (this.config.ttl > 0) {
      const age = Date.now() - entry.lastAccessed;
      if (age > this.config.ttl) {
        this.delete(key);
        return false;
      }
    }

    return true;
  }

  /**
   * Clear entire cache
   */
  public clear(): void {
    this.cache.clear();
    this.stats.totalSize = 0;
    this.stats.entryCount = 0;
  }

  /**
   * Get all keys in cache
   * @returns Array of cache keys
   */
  public keys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Get cache statistics
   * @returns Cache statistics object
   */
  public getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Get current memory usage in MB
   * @returns Memory usage in megabytes
   */
  public getMemoryUsageMB(): number {
    return this.stats.totalSize / (1024 * 1024);
  }

  /**
   * Get memory usage percentage
   * @returns Percentage of max memory used (0-100)
   */
  public getMemoryUsagePercent(): number {
    return (this.getMemoryUsageMB() / this.config.maxMemoryMB) * 100;
  }

  /**
   * Reset statistics
   */
  public resetStats(): void {
    this.stats.hits = 0;
    this.stats.misses = 0;
    this.stats.evictions = 0;
    // Keep totalSize and entryCount
    this.updateHitRate();
  }

  /**
   * Evict entries if needed to make room
   * @param requiredSpace Space needed in bytes
   */
  private evictIfNeeded(requiredSpace: number): void {
    const maxBytes = this.config.maxMemoryMB * 1024 * 1024;
    const currentUsage = this.stats.totalSize;
    const spaceNeeded = currentUsage + requiredSpace - maxBytes;

    if (spaceNeeded <= 0 && this.cache.size < this.config.maxEntries) {
      // No eviction needed
      return;
    }

    // Convert cache to array for sorting
    const entries = Array.from(this.cache.values());

    // Sort by LRU: least recently used first
    entries.sort((a, b) => {
      // Primary sort: last accessed time (older first)
      const timeDiff = a.lastAccessed - b.lastAccessed;
      if (timeDiff !== 0) return timeDiff;

      // Secondary sort: access count (fewer accesses first)
      return a.accessCount - b.accessCount;
    });

    // Evict entries until we have enough space
    let freedSpace = 0;
    let evictedCount = 0;

    for (const entry of entries) {
      if (
        freedSpace >= spaceNeeded &&
        this.cache.size - evictedCount < this.config.maxEntries
      ) {
        break;
      }

      this.cache.delete(entry.key);
      freedSpace += entry.size;
      evictedCount++;
    }

    this.stats.evictions += evictedCount;
    this.stats.totalSize = Math.max(0, currentUsage - freedSpace);
    this.stats.entryCount = this.cache.size;
  }

  /**
   * Estimate size of value in bytes
   * @param value Value to estimate
   * @returns Estimated size in bytes
   */
  private estimateSize(value: T): number {
    if (value === null || value === undefined) {
      return 8; // Pointer size
    }

    const type = typeof value;

    if (type === 'boolean') {
      return 4;
    }

    if (type === 'number') {
      return 8; // 64-bit number
    }

    if (type === 'string') {
      return (value as unknown as string).length * 2; // 2 bytes per char (UTF-16)
    }

    if (Array.isArray(value)) {
      let size = 24; // Array overhead
      for (const item of value) {
        size += this.estimateSize(item as any);
      }
      return size;
    }

    if (type === 'object') {
      let size = 40; // Object overhead
      for (const [key, val] of Object.entries(value as object)) {
        size += key.length * 2; // Key string
        size += this.estimateSize(val as any); // Value
      }
      return size;
    }

    return 16; // Default for unknown types
  }

  /**
   * Update hit rate statistic
   */
  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0;
  }

  /**
   * Get entries sorted by access frequency (hot data)
   * @param limit Maximum entries to return
   * @returns Array of [key, value] tuples
   */
  public getHotEntries(limit: number = 10): Array<[string, T]> {
    const entries = Array.from(this.cache.values());

    // Sort by access count (descending)
    entries.sort((a, b) => b.accessCount - a.accessCount);

    return entries
      .slice(0, limit)
      .map((entry) => [entry.key, entry.value] as [string, T]);
  }

  /**
   * Get entries sorted by least recently used (cold data)
   * @param limit Maximum entries to return
   * @returns Array of [key, value] tuples
   */
  public getColdEntries(limit: number = 10): Array<[string, T]> {
    const entries = Array.from(this.cache.values());

    // Sort by last accessed time (ascending)
    entries.sort((a, b) => a.lastAccessed - b.lastAccessed);

    return entries
      .slice(0, limit)
      .map((entry) => [entry.key, entry.value] as [string, T]);
  }

  /**
   * Manually trigger eviction of expired entries
   * @returns Number of entries evicted
   */
  public evictExpired(): number {
    if (this.config.ttl === 0) {
      return 0; // No TTL configured
    }

    const now = Date.now();
    let evicted = 0;

    for (const [key, entry] of this.cache.entries()) {
      const age = now - entry.lastAccessed;
      if (age > this.config.ttl) {
        this.delete(key);
        evicted++;
      }
    }

    return evicted;
  }

  /**
   * Get cache configuration
   * @returns Current cache configuration
   */
  public getConfig(): Required<CacheConfig> {
    return { ...this.config };
  }

  /**
   * Update cache configuration
   * @param config New configuration (partial)
   */
  public updateConfig(config: Partial<CacheConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };

    // Trigger eviction if new limits are lower
    if (this.config.autoEvict) {
      this.evictIfNeeded(0);
    }
  }
}

/**
 * Global cache manager for DB2/DBC files
 */
export class CacheManager {
  private static caches: Map<string, RecordCache<any>> = new Map();

  /**
   * Get or create cache for a specific file
   * @param fileName DB2/DBC file name
   * @param config Optional cache configuration
   * @returns RecordCache instance
   */
  public static getCache<T = any>(
    fileName: string,
    config?: Partial<CacheConfig>
  ): RecordCache<T> {
    const normalizedName = fileName.toLowerCase();

    if (!this.caches.has(normalizedName)) {
      this.caches.set(normalizedName, new RecordCache<T>(config));
    }

    return this.caches.get(normalizedName) as RecordCache<T>;
  }

  /**
   * Clear cache for specific file
   * @param fileName DB2/DBC file name
   */
  public static clearCache(fileName: string): void {
    const normalizedName = fileName.toLowerCase();
    const cache = this.caches.get(normalizedName);
    if (cache) {
      cache.clear();
    }
  }

  /**
   * Clear all caches
   */
  public static clearAll(): void {
    for (const cache of this.caches.values()) {
      cache.clear();
    }
  }

  /**
   * Reset all caches (remove instances completely)
   * Useful for testing to ensure clean slate
   */
  public static resetAll(): void {
    this.caches.clear();
  }

  /**
   * Get total memory usage across all caches
   * @returns Total memory in MB
   */
  public static getTotalMemoryUsageMB(): number {
    let total = 0;
    for (const cache of this.caches.values()) {
      total += cache.getMemoryUsageMB();
    }
    return total;
  }

  /**
   * Get statistics for all caches
   * @returns Map of file name to cache stats
   */
  public static getAllStats(): Map<string, CacheStats> {
    const stats = new Map<string, CacheStats>();
    for (const [fileName, cache] of this.caches.entries()) {
      stats.set(fileName, cache.getStats());
    }
    return stats;
  }

  /**
   * Get list of all cached files
   * @returns Array of file names
   */
  public static getCachedFiles(): string[] {
    return Array.from(this.caches.keys());
  }
}
