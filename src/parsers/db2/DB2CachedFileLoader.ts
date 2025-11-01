/**
 * DB2CachedFileLoader.ts
 *
 * Cached wrapper around DB2FileLoader with automatic record caching.
 * Provides <100ms access times and <50MB memory usage per file.
 *
 * Week 6: Phase 3.1 - Caching Layer Integration
 */

import { DB2FileLoader } from './DB2FileLoader';
import { DB2Record } from './DB2Record';
import { DB2Header, DB2SectionHeader } from './DB2Header';
import { IDB2FileSource } from './DB2FileSource';
import { RecordCache, CacheManager, CacheConfig } from '../cache/RecordCache';
import { SchemaFactory } from '../schemas/SchemaFactory';

/**
 * Cached DB2 file loader with automatic record caching
 *
 * Features:
 * - Transparent caching of parsed records
 * - LRU eviction for memory management
 * - Cache statistics and monitoring
 * - Type-safe schema parsing with caching
 * - File-level cache configuration
 *
 * Usage:
 * ```typescript
 * const loader = new DB2CachedFileLoader('Spell.db2');
 * loader.loadFromFile('/path/to/Spell.db2');
 *
 * // First access: parses from binary
 * const spell1 = loader.getCachedRecord(0);
 *
 * // Second access: retrieved from cache (<1ms)
 * const spell2 = loader.getCachedRecord(0);
 *
 * // Get parsed schema entry (type-safe)
 * const spellEntry = loader.getTypedRecord<SpellEntry>(0);
 * ```
 */
export class DB2CachedFileLoader {
  private loader: DB2FileLoader;
  private cache: RecordCache<DB2Record>;
  private parsedCache: RecordCache<any>; // For schema-parsed entries
  private fileName: string;
  private loadTime: number = 0;
  private cacheHitsTotal: number = 0;
  private cacheMissesTotal: number = 0;

  /**
   * Create cached loader for a DB2 file
   * @param fileName DB2 file name (e.g., "Spell.db2")
   * @param cacheConfig Optional cache configuration
   */
  constructor(fileName: string, cacheConfig?: Partial<CacheConfig>) {
    this.fileName = fileName;
    this.loader = new DB2FileLoader();

    // Get file-specific caches
    this.cache = CacheManager.getCache<DB2Record>(`${fileName}:raw`, cacheConfig);
    this.parsedCache = CacheManager.getCache<any>(`${fileName}:parsed`, cacheConfig);
  }

  /**
   * Load DB2 file from source
   * @param source File source to read from
   */
  public load(source: IDB2FileSource): void {
    const startTime = Date.now();
    this.loader.load(source);
    this.loadTime = Date.now() - startTime;
  }

  /**
   * Load DB2 file from file path
   * @param filePath Path to DB2 file
   */
  public loadFromFile(filePath: string): void {
    const startTime = Date.now();
    this.loader.loadFromFile(filePath);
    this.loadTime = Date.now() - startTime;
  }

  /**
   * Get DB2 header
   * @returns Parsed header
   */
  public getHeader(): DB2Header {
    return this.loader.getHeader();
  }

  /**
   * Get section header
   * @param section Section index
   * @returns Section header
   */
  public getSectionHeader(section: number): DB2SectionHeader {
    return this.loader.getSectionHeader(section);
  }

  /**
   * Get total record count
   * @returns Total records across all sections
   */
  public getRecordCount(): number {
    return this.loader.getRecordCount();
  }

  /**
   * Get record with caching (raw DB2Record)
   * @param recordNumber Record index (0-based)
   * @returns DB2Record accessor
   */
  public getCachedRecord(recordNumber: number): DB2Record {
    const cacheKey = `record:${recordNumber}`;

    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached !== null) {
      this.cacheHitsTotal++;
      return cached;
    }

    // Cache miss: load from binary
    this.cacheMissesTotal++;
    const record = this.loader.getRecord(recordNumber);

    // Cache the record
    this.cache.set(cacheKey, record);

    return record;
  }

  /**
   * Get record without caching (direct binary access)
   * @param recordNumber Record index (0-based)
   * @returns DB2Record accessor
   */
  public getRecord(recordNumber: number): DB2Record {
    return this.loader.getRecord(recordNumber);
  }

  /**
   * Get typed schema entry with caching
   * @param recordNumber Record index (0-based)
   * @returns Parsed schema entry or null if schema not registered
   */
  public getTypedRecord<T>(recordNumber: number): T | null {
    const cacheKey = `typed:${recordNumber}`;

    // Check parsed cache first
    const cached = this.parsedCache.get(cacheKey);
    if (cached !== null) {
      this.cacheHitsTotal++;
      return cached as T;
    }

    // Cache miss: parse from raw record
    this.cacheMissesTotal++;
    const rawRecord = this.getCachedRecord(recordNumber);
    const parsed = SchemaFactory.parseByFileName<T>(this.fileName, rawRecord);

    if (parsed !== null) {
      // Cache the parsed entry
      this.parsedCache.set(cacheKey, parsed);
    }

    return parsed;
  }

  /**
   * Batch load records with caching
   * @param recordNumbers Array of record indices
   * @returns Array of DB2Records
   */
  public batchGetRecords(recordNumbers: number[]): DB2Record[] {
    return recordNumbers.map((index) => this.getCachedRecord(index));
  }

  /**
   * Batch load typed records with caching
   * @param recordNumbers Array of record indices
   * @returns Array of parsed schema entries (may contain nulls)
   */
  public batchGetTypedRecords<T>(recordNumbers: number[]): Array<T | null> {
    return recordNumbers.map((index) => this.getTypedRecord<T>(index));
  }

  /**
   * Get all records (with caching)
   * @returns Array of all DB2Records
   */
  public getAllRecords(): DB2Record[] {
    const count = this.getRecordCount();
    const records: DB2Record[] = [];

    for (let i = 0; i < count; i++) {
      records.push(this.getCachedRecord(i));
    }

    return records;
  }

  /**
   * Get all typed records (with caching)
   * @returns Array of all parsed schema entries
   */
  public getAllTypedRecords<T>(): Array<T | null> {
    const count = this.getRecordCount();
    const records: Array<T | null> = [];

    for (let i = 0; i < count; i++) {
      records.push(this.getTypedRecord<T>(i));
    }

    return records;
  }

  /**
   * Preload and cache specific records
   * @param recordNumbers Array of record indices to preload
   */
  public preloadRecords(recordNumbers: number[]): void {
    for (const index of recordNumbers) {
      this.getCachedRecord(index);
    }
  }

  /**
   * Preload and cache all records (warm cache)
   */
  public preloadAll(): void {
    const count = this.getRecordCount();
    for (let i = 0; i < count; i++) {
      this.getCachedRecord(i);
    }
  }

  /**
   * Clear all caches for this file
   */
  public clearCache(): void {
    this.cache.clear();
    this.parsedCache.clear();
  }

  /**
   * Get cache statistics
   * @returns Combined cache statistics
   */
  public getCacheStats(): {
    raw: ReturnType<RecordCache<DB2Record>['getStats']>;
    parsed: ReturnType<RecordCache<any>['getStats']>;
    totalHits: number;
    totalMisses: number;
    loadTime: number;
  } {
    return {
      raw: this.cache.getStats(),
      parsed: this.parsedCache.getStats(),
      totalHits: this.cacheHitsTotal,
      totalMisses: this.cacheMissesTotal,
      loadTime: this.loadTime,
    };
  }

  /**
   * Get cache memory usage
   * @returns Combined memory usage in MB
   */
  public getCacheMemoryUsage(): {
    rawMB: number;
    parsedMB: number;
    totalMB: number;
  } {
    const rawMB = this.cache.getMemoryUsageMB();
    const parsedMB = this.parsedCache.getMemoryUsageMB();

    return {
      rawMB,
      parsedMB,
      totalMB: rawMB + parsedMB,
    };
  }

  /**
   * Get cache efficiency metrics
   * @returns Cache efficiency percentages
   */
  public getCacheEfficiency(): {
    hitRate: number;
    memoryUsagePercent: number;
    cacheablility: number;
  } {
    const rawStats = this.cache.getStats();
    const parsedStats = this.parsedCache.getStats();

    const totalRequests = this.cacheHitsTotal + this.cacheMissesTotal;
    const hitRate = totalRequests > 0 ? (this.cacheHitsTotal / totalRequests) * 100 : 0;

    const rawPercent = this.cache.getMemoryUsagePercent();
    const parsedPercent = this.parsedCache.getMemoryUsagePercent();
    const avgMemoryUsage = (rawPercent + parsedPercent) / 2;

    const recordCount = this.getRecordCount();
    const cacheablility = recordCount > 0 ? (rawStats.entryCount / recordCount) * 100 : 0;

    return {
      hitRate,
      memoryUsagePercent: avgMemoryUsage,
      cacheablility,
    };
  }

  /**
   * Get hot records (most frequently accessed)
   * @param limit Maximum entries to return
   * @returns Array of [recordNumber, record] tuples
   */
  public getHotRecords(limit: number = 10): Array<[string, DB2Record]> {
    return this.cache.getHotEntries(limit);
  }

  /**
   * Get cold records (least recently used)
   * @param limit Maximum entries to return
   * @returns Array of [recordNumber, record] tuples
   */
  public getColdRecords(limit: number = 10): Array<[string, DB2Record]> {
    return this.cache.getColdEntries(limit);
  }

  /**
   * Optimize cache (evict cold entries if memory usage is high)
   */
  public optimizeCache(): void {
    const rawUsage = this.cache.getMemoryUsagePercent();
    const parsedUsage = this.parsedCache.getMemoryUsagePercent();

    // Evict cold entries if usage > 80%
    if (rawUsage > 80) {
      const coldRaw = this.cache.getColdEntries(10);
      for (const [key] of coldRaw) {
        this.cache.delete(key);
      }
    }

    if (parsedUsage > 80) {
      const coldParsed = this.parsedCache.getColdEntries(10);
      for (const [key] of coldParsed) {
        this.parsedCache.delete(key);
      }
    }
  }

  /**
   * Export cache statistics report
   * @returns Human-readable cache report
   */
  public getCacheReport(): string {
    const stats = this.getCacheStats();
    const memory = this.getCacheMemoryUsage();
    const efficiency = this.getCacheEfficiency();

    return `
=== DB2 Cache Report: ${this.fileName} ===

Load Time: ${this.loadTime}ms
Total Records: ${this.getRecordCount()}

Cache Statistics:
  Raw Cache Entries: ${stats.raw.entryCount}
  Parsed Cache Entries: ${stats.parsed.entryCount}
  Total Hits: ${stats.totalHits}
  Total Misses: ${stats.totalMisses}
  Hit Rate: ${efficiency.hitRate.toFixed(2)}%

Memory Usage:
  Raw Cache: ${memory.rawMB.toFixed(2)} MB
  Parsed Cache: ${memory.parsedMB.toFixed(2)} MB
  Total: ${memory.totalMB.toFixed(2)} MB
  Utilization: ${efficiency.memoryUsagePercent.toFixed(2)}%

Cache Efficiency:
  Cacheability: ${efficiency.cacheablility.toFixed(2)}%
  Evictions: ${stats.raw.evictions + stats.parsed.evictions}
`;
  }
}

/**
 * Factory for creating cached loaders with global cache management
 */
export class DB2CachedLoaderFactory {
  private static loaders: Map<string, DB2CachedFileLoader> = new Map();

  /**
   * Get or create cached loader for a DB2 file
   * @param fileName DB2 file name
   * @param cacheConfig Optional cache configuration
   * @returns Cached loader instance
   */
  public static getLoader(
    fileName: string,
    cacheConfig?: Partial<CacheConfig>
  ): DB2CachedFileLoader {
    const normalizedName = fileName.toLowerCase();

    if (!this.loaders.has(normalizedName)) {
      this.loaders.set(normalizedName, new DB2CachedFileLoader(fileName, cacheConfig));
    }

    return this.loaders.get(normalizedName)!;
  }

  /**
   * Clear all loaders and caches
   */
  public static clearAll(): void {
    for (const loader of this.loaders.values()) {
      loader.clearCache();
    }
    this.loaders.clear();
    CacheManager.clearAll();
  }

  /**
   * Get global cache statistics across all files
   * @returns Aggregated cache statistics
   */
  public static getGlobalStats(): {
    totalFiles: number;
    totalMemoryMB: number;
    totalHits: number;
    totalMisses: number;
    files: Map<string, ReturnType<DB2CachedFileLoader['getCacheStats']>>;
  } {
    let totalHits = 0;
    let totalMisses = 0;
    const files = new Map<string, ReturnType<DB2CachedFileLoader['getCacheStats']>>();

    for (const [fileName, loader] of this.loaders.entries()) {
      const stats = loader.getCacheStats();
      files.set(fileName, stats);
      totalHits += stats.totalHits;
      totalMisses += stats.totalMisses;
    }

    return {
      totalFiles: this.loaders.size,
      totalMemoryMB: CacheManager.getTotalMemoryUsageMB(),
      totalHits,
      totalMisses,
      files,
    };
  }

  /**
   * Get list of all loaded files
   * @returns Array of file names
   */
  public static getLoadedFiles(): string[] {
    return Array.from(this.loaders.keys());
  }
}
