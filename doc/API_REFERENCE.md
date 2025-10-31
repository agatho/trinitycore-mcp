# TrinityCore MCP Server - API Reference

**Version**: v1.4.0 (Phase 3.1 Complete)
**Date**: 2025-10-31

---

## 🎯 Table of Contents

1. [DB2CachedFileLoader API](#db2cachedfileloader-api)
2. [DB2CachedLoaderFactory API](#db2cachedloaderfactory-api)
3. [CacheWarmer API](#cachewarmer-api)
4. [RecordCache API](#recordcache-api)
5. [SchemaFactory API](#schemafactory-api)
6. [Usage Examples](#usage-examples)

---

## DB2CachedFileLoader API

The main class for loading and caching DB2 files with automatic schema parsing.

### Constructor

```typescript
constructor(fileName: string, cacheConfig?: Partial<CacheConfig>)
```

**Parameters:**
- `fileName` (string): DB2 file name (e.g., "Spell.db2")
- `cacheConfig` (optional): Cache configuration override

**Example:**
```typescript
import { DB2CachedFileLoader } from './parsers/db2/DB2CachedFileLoader';

const loader = new DB2CachedFileLoader('Spell.db2', {
  maxMemoryMB: 50,
  autoEvict: true
});
```

---

### loadFromFile()

Load DB2 file from disk into memory.

```typescript
loadFromFile(filePath: string): void
```

**Parameters:**
- `filePath` (string): Absolute path to DB2 file

**Throws:**
- `Error` if file doesn't exist or is invalid

**Example:**
```typescript
const loader = new DB2CachedFileLoader('Spell.db2');
loader.loadFromFile('/path/to/wow/DBFilesClient/Spell.db2');
console.log(`Loaded ${loader.getRecordCount()} records`);
```

---

### getCachedRecord()

Get a record by ID with caching (raw DB2Record).

```typescript
getCachedRecord(recordNumber: number): DB2Record | null
```

**Parameters:**
- `recordNumber` (number): Record index or ID

**Returns:**
- `DB2Record` if found
- `null` if not found

**Caching Behavior:**
- First access: Loads from DB2 file (~10ms)
- Subsequent access: Returns cached (<1ms)
- Automatic LRU eviction when memory limit reached

**Example:**
```typescript
const spellRecord = loader.getCachedRecord(100);
if (spellRecord) {
  const spellId = spellRecord.getUInt32(0); // ID field
  const name = spellRecord.getString(0); // Name field
  console.log(`Spell ${spellId}: ${name}`);
}
```

---

### getTypedRecord()

Get a record by ID with schema parsing (typed object).

```typescript
getTypedRecord<T>(recordNumber: number): T | null
```

**Parameters:**
- `recordNumber` (number): Record index or ID

**Returns:**
- Parsed schema object of type `T`
- `null` if not found or schema not available

**Example:**
```typescript
import { SpellEntry } from './parsers/schemas/SpellSchema';

const spellEntry = loader.getTypedRecord<SpellEntry>(100);
if (spellEntry) {
  console.log(`Spell: ${spellEntry.spellName}`);
  console.log(`Rank: ${spellEntry.rank || 'N/A'}`);
  console.log(`Description: ${spellEntry.description}`);
}
```

---

### preloadRecords()

Preload and cache specific records (cache warming).

```typescript
preloadRecords(recordNumbers: number[]): void
```

**Parameters:**
- `recordNumbers` (number[]): Array of record IDs to preload

**Use Cases:**
- Warm cache on startup with common spell IDs
- Preload quest-related items before processing
- Cache frequently accessed records

**Example:**
```typescript
// Preload common spell IDs
const commonSpells = [8326, 2584, 100, 116, 133]; // Ghost, Resurrect, Charge, etc.
loader.preloadRecords(commonSpells);

// Subsequent access is instant
const ghostSpell = loader.getCachedRecord(8326); // <1ms
```

---

### preloadAll()

Preload and cache all records in the file.

```typescript
preloadAll(): void
```

**Warning:** Only use for small files (<1000 records). Large files will exceed memory limits.

**Example:**
```typescript
// Safe for small files like ChrClasses.db2
const classLoader = new DB2CachedFileLoader('ChrClasses.db2');
classLoader.loadFromFile('/path/to/ChrClasses.db2');
classLoader.preloadAll(); // Only 13 records

console.log(`Cached ${classLoader.getRecordCount()} class definitions`);
```

---

### getCacheStats()

Get cache statistics for monitoring.

```typescript
getCacheStats(): {
  raw: CacheStats;
  parsed: CacheStats;
  totalHits: number;
  totalMisses: number;
  loadTime: number;
}
```

**Returns:**
- `raw`: Raw cache statistics (DB2Record objects)
- `parsed`: Parsed cache statistics (schema objects)
- `totalHits`: Total cache hits
- `totalMisses`: Total cache misses
- `loadTime`: File load time in milliseconds

**CacheStats Structure:**
```typescript
interface CacheStats {
  hits: number;        // Cache hits
  misses: number;      // Cache misses
  evictions: number;   // LRU evictions
  totalSize: number;   // Memory size in bytes
  entryCount: number;  // Number of cached entries
  hitRate: number;     // Hit rate percentage
}
```

**Example:**
```typescript
const stats = loader.getCacheStats();
console.log(`Cache Performance:`);
console.log(`  Hit Rate: ${stats.raw.hitRate.toFixed(2)}%`);
console.log(`  Total Hits: ${stats.totalHits}`);
console.log(`  Total Misses: ${stats.totalMisses}`);
console.log(`  Raw Cache: ${stats.raw.entryCount} entries`);
console.log(`  Parsed Cache: ${stats.parsed.entryCount} entries`);
```

---

### getCacheMemoryUsage()

Get memory usage in megabytes.

```typescript
getCacheMemoryUsage(): {
  rawMB: number;
  parsedMB: number;
  totalMB: number;
}
```

**Returns:**
- `rawMB`: Raw cache memory usage
- `parsedMB`: Parsed cache memory usage
- `totalMB`: Total memory usage

**Example:**
```typescript
const memory = loader.getCacheMemoryUsage();
console.log(`Memory Usage:`);
console.log(`  Raw Cache: ${memory.rawMB.toFixed(2)}MB`);
console.log(`  Parsed Cache: ${memory.parsedMB.toFixed(2)}MB`);
console.log(`  Total: ${memory.totalMB.toFixed(2)}MB`);

if (memory.totalMB > 40) {
  console.warn('⚠️  Memory usage approaching limit');
}
```

---

### getCacheEfficiency()

Get cache efficiency metrics.

```typescript
getCacheEfficiency(): {
  hitRate: number;
  memoryUsagePercent: number;
  cacheability: number;
}
```

**Returns:**
- `hitRate`: Cache hit rate percentage (0-100)
- `memoryUsagePercent`: Memory usage percentage of limit
- `cacheability`: Percentage of accessed records that are cacheable

**Example:**
```typescript
const efficiency = loader.getCacheEfficiency();
console.log(`Cache Efficiency:`);
console.log(`  Hit Rate: ${efficiency.hitRate.toFixed(2)}%`);
console.log(`  Memory Usage: ${efficiency.memoryUsagePercent.toFixed(2)}%`);
console.log(`  Cacheability: ${efficiency.cacheability.toFixed(2)}%`);
```

---

### clearCache()

Clear all caches for this file.

```typescript
clearCache(): void
```

**Use Cases:**
- Free memory when file no longer needed
- Reset cache during development/testing
- Force reload of all records

**Example:**
```typescript
// Clear cache to free memory
loader.clearCache();
console.log('Cache cleared');

// Subsequent access will reload from file
const spell = loader.getCachedRecord(100); // ~10ms (cache miss)
```

---

### getCacheReport()

Get human-readable cache report.

```typescript
getCacheReport(): string
```

**Returns:** Formatted cache report string

**Example:**
```typescript
console.log(loader.getCacheReport());

// Output:
// === DB2 Cache Report: Spell.db2 ===
//
// Load Time: 150ms
// Total Records: 50000
//
// Cache Statistics:
//   Raw Cache Entries: 100
//   Parsed Cache Entries: 100
//   Total Hits: 500
//   Total Misses: 100
//   Hit Rate: 83.33%
//
// Memory Usage:
//   Raw Cache: 15.23 MB
//   Parsed Cache: 8.45 MB
//   Total: 23.68 MB
//   Utilization: 47.36%
//
// Cache Efficiency:
//   Cacheability: 90.00%
//   Evictions: 10
```

---

## DB2CachedLoaderFactory API

Factory for managing DB2 loaders with global caching.

### getLoader()

Get or create cached loader for a DB2 file (singleton pattern).

```typescript
static getLoader(fileName: string, cacheConfig?: Partial<CacheConfig>): DB2CachedFileLoader
```

**Parameters:**
- `fileName` (string): DB2 file name
- `cacheConfig` (optional): Cache configuration

**Returns:** Singleton instance of DB2CachedFileLoader

**Example:**
```typescript
import { DB2CachedLoaderFactory } from './parsers/db2/DB2CachedFileLoader';

// Get loader (creates if first time)
const spellLoader = DB2CachedLoaderFactory.getLoader('Spell.db2');

// Subsequent calls return same instance
const spellLoader2 = DB2CachedLoaderFactory.getLoader('Spell.db2');
console.log(spellLoader === spellLoader2); // true
```

---

### getGlobalStats()

Get global cache statistics across all files.

```typescript
static getGlobalStats(): {
  totalFiles: number;
  totalMemoryMB: number;
  totalHits: number;
  totalMisses: number;
  files: Map<string, CacheStats>;
}
```

**Returns:** Aggregated statistics for all loaded files

**Example:**
```typescript
const globalStats = DB2CachedLoaderFactory.getGlobalStats();
console.log(`Global Cache Statistics:`);
console.log(`  Files Loaded: ${globalStats.totalFiles}`);
console.log(`  Total Memory: ${globalStats.totalMemoryMB.toFixed(2)}MB`);
console.log(`  Total Hits: ${globalStats.totalHits}`);
console.log(`  Total Misses: ${globalStats.totalMisses}`);
console.log(`  Global Hit Rate: ${(globalStats.totalHits / (globalStats.totalHits + globalStats.totalMisses) * 100).toFixed(2)}%`);

// Per-file breakdown
for (const [fileName, stats] of globalStats.files) {
  console.log(`\n  ${fileName}:`);
  console.log(`    Cached: ${stats.raw.entryCount + stats.parsed.entryCount}`);
  console.log(`    Hit Rate: ${stats.raw.hitRate.toFixed(2)}%`);
}
```

---

### clearAll()

Clear all loaders and caches.

```typescript
static clearAll(): void
```

**Example:**
```typescript
// Clear all caches
DB2CachedLoaderFactory.clearAll();
console.log('All caches cleared');
```

---

## CacheWarmer API

Intelligent cache warming for frequently accessed records.

### warmSpellCache()

Warm spell cache with common spell IDs.

```typescript
static async warmSpellCache(config?: Partial<CacheWarmingConfig>): Promise<CacheWarmingResult>
```

**Parameters:**
- `config` (optional): Custom warming configuration

**Default Config:**
```typescript
{
  files: ['Spell.db2'],
  strategy: 'list',
  idList: [8326, 2584, 100, 116, ...], // 20 common spells
  maxRecordsPerFile: 100,
  verbose: false
}
```

**Example:**
```typescript
import { CacheWarmer } from './parsers/cache/CacheWarmer';

// Use default common spells
const result = await CacheWarmer.warmSpellCache();
console.log(`Warmed ${result.recordsPreloaded} spells in ${result.totalTime}ms`);

// Custom spell list
const customResult = await CacheWarmer.warmSpellCache({
  idList: [100, 200, 300],
  verbose: true
});
```

---

### warmItemCache()

Warm item cache with common item IDs (dual-file).

```typescript
static async warmItemCache(config?: Partial<CacheWarmingConfig>): Promise<CacheWarmingResult>
```

**Default Config:**
```typescript
{
  files: ['Item.db2', 'ItemSparse.db2'],
  strategy: 'list',
  idList: [6948, 25, 2361, ...], // 15 common items
  maxRecordsPerFile: 50,
  verbose: false
}
```

**Example:**
```typescript
// Warm both Item.db2 and ItemSparse.db2
const result = await CacheWarmer.warmItemCache();
console.log(`Warmed ${result.filesWarmed} files`);
console.log(`Preloaded ${result.recordsPreloaded} items`);
```

---

### warmAllCaches()

Warm all caches with default strategies.

```typescript
static async warmAllCaches(): Promise<CacheWarmingResult>
```

**Warms:**
- Spell.db2 (20 common spells)
- Item.db2 + ItemSparse.db2 (15 common items)

**Example:**
```typescript
// Warm all caches on server startup
const result = await CacheWarmer.warmAllCaches();

if (result.success) {
  console.log(`✅ Cache warming complete:`);
  console.log(`   Files: ${result.filesWarmed}`);
  console.log(`   Records: ${result.recordsPreloaded}`);
  console.log(`   Time: ${result.totalTime}ms`);
} else {
  console.error(`❌ Cache warming failed: ${result.error}`);
}
```

---

### warmCache()

Warm cache with custom configuration.

```typescript
static async warmCache(config: CacheWarmingConfig): Promise<CacheWarmingResult>
```

**Parameters:**
- `config`: Complete warming configuration

**CacheWarmingConfig:**
```typescript
interface CacheWarmingConfig {
  files: string[];                    // Files to warm
  strategy: 'all' | 'range' | 'list'; // Warming strategy
  rangeStart?: number;                // For 'range' strategy
  rangeEnd?: number;                  // For 'range' strategy
  idList?: number[];                  // For 'list' strategy
  maxRecordsPerFile?: number;         // Max records per file
  verbose?: boolean;                  // Enable logging
}
```

**Strategies:**

1. **'list' Strategy** - Preload specific IDs
```typescript
await CacheWarmer.warmCache({
  files: ['Spell.db2'],
  strategy: 'list',
  idList: [100, 200, 300, 400],
  verbose: true
});
```

2. **'range' Strategy** - Preload range of IDs
```typescript
await CacheWarmer.warmCache({
  files: ['Spell.db2'],
  strategy: 'range',
  rangeStart: 0,
  rangeEnd: 99,
  maxRecordsPerFile: 100
});
```

3. **'all' Strategy** - Preload all records (with limit)
```typescript
await CacheWarmer.warmCache({
  files: ['ChrClasses.db2'], // Small file
  strategy: 'all',
  maxRecordsPerFile: 1000
});
```

---

### getCacheRecommendations()

Get recommended warming configurations.

```typescript
static getCacheRecommendations(): CacheWarmingConfig[]
```

**Returns:** Array of recommended configurations

**Example:**
```typescript
const recommendations = CacheWarmer.getCacheRecommendations();
console.log(`Cache warming recommendations:`);

for (const config of recommendations) {
  console.log(`\n  Strategy for ${config.files.join(', ')}:`);
  console.log(`    Strategy: ${config.strategy}`);
  console.log(`    Records: ${config.idList?.length || config.maxRecordsPerFile}`);
}
```

---

### getCurrentCacheState()

Get current cache state across all files.

```typescript
static getCurrentCacheState(): GlobalCacheStats
```

**Returns:** Global cache statistics

**Example:**
```typescript
const state = CacheWarmer.getCurrentCacheState();
console.log(`Current Cache State:`);
console.log(`  Files: ${state.totalFiles}`);
console.log(`  Memory: ${state.totalMemoryMB.toFixed(2)}MB`);
console.log(`  Hit Rate: ${(state.totalHits / (state.totalHits + state.totalMisses) * 100).toFixed(2)}%`);
```

---

## RecordCache API

Low-level LRU cache implementation.

### constructor()

```typescript
constructor(cacheId: string, config?: Partial<CacheConfig>)
```

**Parameters:**
- `cacheId` (string): Unique cache identifier
- `config` (optional): Cache configuration

**Default Config:**
```typescript
{
  maxMemoryMB: 50,
  maxEntries: undefined,
  ttl: 0, // No expiry
  autoEvict: true
}
```

---

### get(), set(), delete(), has(), clear()

Standard cache operations - see implementation for details.

---

## SchemaFactory API

Automatic schema detection and parsing.

### parseByFileName()

Parse record using schema detected from filename.

```typescript
static parseByFileName<T>(fileName: string, record: DB2Record): T | null
```

**Supported Files:**
- Spell.db2 → SpellEntry
- Item.db2 → ItemEntry
- ItemSparse.db2 → ItemSparseEntry
- ChrClasses.db2 → ChrClassesEntry
- ChrRaces.db2 → ChrRacesEntry
- Talent.db2 → TalentEntry
- SpellEffect.db2 → SpellEffectEntry
- ChrClasses_X_PowerTypes.db2 → ChrClassesXPowerTypesEntry

**Example:**
```typescript
import { SchemaFactory } from './parsers/schemas/SchemaFactory';

const spellRecord = loader.getCachedRecord(100);
const spellEntry = SchemaFactory.parseByFileName<SpellEntry>('Spell.db2', spellRecord);

if (spellEntry) {
  console.log(`Parsed spell: ${spellEntry.spellName}`);
}
```

---

### hasSchema()

Check if schema exists for filename.

```typescript
static hasSchema(fileName: string): boolean
```

**Example:**
```typescript
if (SchemaFactory.hasSchema('Spell.db2')) {
  console.log('Schema available for Spell.db2');
}
```

---

## Usage Examples

### Example 1: Basic Spell Loading

```typescript
import { DB2CachedLoaderFactory } from './parsers/db2/DB2CachedFileLoader';

// Get loader
const spellLoader = DB2CachedLoaderFactory.getLoader('Spell.db2');

// Load file
spellLoader.loadFromFile('/path/to/wow/DBFilesClient/Spell.db2');

// Access spell
const spell = spellLoader.getTypedRecord<SpellEntry>(100); // Charge
if (spell) {
  console.log(`${spell.spellName}: ${spell.description}`);
}
```

---

### Example 2: Dual-File Item Loading

```typescript
import { DB2CachedLoaderFactory } from './parsers/db2/DB2CachedFileLoader';

// Load both item files
const itemLoader = DB2CachedLoaderFactory.getLoader('Item.db2');
const itemSparseLoader = DB2CachedLoaderFactory.getLoader('ItemSparse.db2');

itemLoader.loadFromFile('/path/to/Item.db2');
itemSparseLoader.loadFromFile('/path/to/ItemSparse.db2');

// Get item data
const itemId = 6948; // Hearthstone
const item = itemLoader.getTypedRecord<ItemEntry>(itemId);
const itemSparse = itemSparseLoader.getTypedRecord<ItemSparseEntry>(itemId);

if (item && itemSparse) {
  console.log(`Item: ${itemSparse.display}`);
  console.log(`Quality: ${itemSparse.quality}`);
  console.log(`Class: ${item.classID}`);
}
```

---

### Example 3: Cache Warming on Startup

```typescript
import { CacheWarmer } from './parsers/cache/CacheWarmer';
import { DB2CachedLoaderFactory } from './parsers/db2/DB2CachedFileLoader';

async function initializeServer() {
  console.log('Starting server...');

  // Warm caches
  const result = await CacheWarmer.warmAllCaches();

  if (result.success) {
    console.log(`✅ Cache warming complete:`);
    console.log(`   ${result.filesWarmed} files`);
    console.log(`   ${result.recordsPreloaded} records`);
    console.log(`   ${result.totalTime}ms`);
  }

  // Show global stats
  const stats = DB2CachedLoaderFactory.getGlobalStats();
  console.log(`\nGlobal cache: ${stats.totalMemoryMB.toFixed(2)}MB`);
}

initializeServer().catch(console.error);
```

---

### Example 4: Performance Monitoring

```typescript
import { DB2CachedLoaderFactory } from './parsers/db2/DB2CachedFileLoader';

// Monitor cache performance
setInterval(() => {
  const stats = DB2CachedLoaderFactory.getGlobalStats();

  const totalRequests = stats.totalHits + stats.totalMisses;
  const hitRate = totalRequests > 0 ? (stats.totalHits / totalRequests * 100) : 0;

  console.log(`[Cache Monitor]`);
  console.log(`  Files: ${stats.totalFiles}`);
  console.log(`  Memory: ${stats.totalMemoryMB.toFixed(2)}MB`);
  console.log(`  Hit Rate: ${hitRate.toFixed(2)}%`);
  console.log(`  Requests: ${totalRequests}`);
}, 60000); // Every minute
```

---

### Example 5: Custom Cache Configuration

```typescript
import { DB2CachedLoaderFactory } from './parsers/db2/DB2CachedFileLoader';

// Custom cache config for large file
const spellLoader = DB2CachedLoaderFactory.getLoader('Spell.db2', {
  maxMemoryMB: 100,  // Larger limit
  autoEvict: true,   // Enable LRU eviction
  ttl: 3600000       // 1 hour TTL
});

spellLoader.loadFromFile('/path/to/Spell.db2');

// Monitor efficiency
const efficiency = spellLoader.getCacheEfficiency();
console.log(`Cache efficiency: ${efficiency.hitRate.toFixed(2)}%`);
```

---

## Best Practices

### 1. Use Factory Pattern
✅ **Good:**
```typescript
const loader = DB2CachedLoaderFactory.getLoader('Spell.db2');
```

❌ **Bad:**
```typescript
const loader = new DB2CachedFileLoader('Spell.db2'); // Creates duplicate
```

### 2. Warm Cache on Startup
✅ **Good:**
```typescript
await CacheWarmer.warmAllCaches();
```

### 3. Monitor Memory Usage
✅ **Good:**
```typescript
const memory = loader.getCacheMemoryUsage();
if (memory.totalMB > 45) {
  loader.clearCache(); // Preemptive clear
}
```

### 4. Use Typed Records
✅ **Good:**
```typescript
const spell = loader.getTypedRecord<SpellEntry>(100);
console.log(spell.spellName); // Type-safe
```

❌ **Bad:**
```typescript
const record = loader.getCachedRecord(100);
console.log(record.getString(0)); // Manual parsing
```

### 5. Handle Dual-File Items Properly
✅ **Good:**
```typescript
const item = itemLoader.getTypedRecord<ItemEntry>(id);
const itemSparse = itemSparseLoader.getTypedRecord<ItemSparseEntry>(id);
// Merge both data sources
```

---

## Error Handling

### Common Errors

1. **File Not Found**
```typescript
try {
  loader.loadFromFile('/invalid/path.db2');
} catch (error) {
  console.error(`Failed to load: ${error.message}`);
}
```

2. **Record Not Found**
```typescript
const spell = loader.getCachedRecord(999999);
if (!spell) {
  console.error('Spell not found');
}
```

3. **Memory Limit Exceeded**
```typescript
const memory = loader.getCacheMemoryUsage();
if (memory.totalMB > 50) {
  console.warn('Memory limit exceeded, clearing cache');
  loader.clearCache();
}
```

---

**API Reference Version**: 1.0
**Last Updated**: 2025-10-31
**Author**: Claude Code
