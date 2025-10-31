# DB2CachedFileLoader - Usage Guide

**Version**: v1.4.0 (Phase 3.1 Complete)
**Date**: 2025-10-31

---

## 🎯 Quick Start

### Installation

The DB2 caching system is part of the TrinityCore MCP Server:

```bash
git clone https://github.com/agatho/trinitycore-mcp.git
cd trinitycore-mcp
npm install
npm run build
```

### Basic Usage (5-Minute Tutorial)

```typescript
import { DB2CachedLoaderFactory } from './parsers/db2/DB2CachedFileLoader';

// 1. Get loader (singleton)
const loader = DB2CachedLoaderFactory.getLoader('Spell.db2');

// 2. Load DB2 file
loader.loadFromFile('/path/to/wow/DBFilesClient/Spell.db2');

// 3. Access records (auto-cached)
const spell = loader.getTypedRecord<SpellEntry>(100);
console.log(`Spell: ${spell?.spellName}`);

// 4. Check cache stats
const stats = loader.getCacheStats();
console.log(`Hit rate: ${stats.raw.hitRate.toFixed(2)}%`);
```

That's it! Records are automatically cached for <1ms access on subsequent reads.

---

## 📚 Core Concepts

### 1. Automatic Caching

Every record access is automatically cached:

```typescript
const loader = DB2CachedLoaderFactory.getLoader('Spell.db2');
loader.loadFromFile('/path/to/Spell.db2');

// First access: ~10ms (loads from file)
const spell1 = loader.getCachedRecord(100);

// Second access: <1ms (from cache)
const spell2 = loader.getCachedRecord(100);
```

### 2. Two Cache Layers

**Raw Cache**: Stores unparsed DB2Record objects
**Parsed Cache**: Stores schema-parsed typed objects

```typescript
// Raw access (DB2Record)
const rawRecord = loader.getCachedRecord(100);
const spellId = rawRecord.getUInt32(0);

// Typed access (SpellEntry)
const typedRecord = loader.getTypedRecord<SpellEntry>(100);
const spellId = typedRecord.id; // Type-safe!
```

### 3. LRU Eviction

When memory limit is reached, least recently used records are evicted:

```typescript
const loader = DB2CachedLoaderFactory.getLoader('Spell.db2', {
  maxMemoryMB: 50 // 50MB limit
});

// Load 10,000 records
for (let i = 0; i < 10000; i++) {
  loader.getCachedRecord(i);
}

const stats = loader.getCacheStats();
console.log(`Evictions: ${stats.raw.evictions}`); // Some records evicted
```

### 4. Singleton Pattern

Each file has one loader instance:

```typescript
const loader1 = DB2CachedLoaderFactory.getLoader('Spell.db2');
const loader2 = DB2CachedLoaderFactory.getLoader('Spell.db2');

console.log(loader1 === loader2); // true - same instance
```

---

## 🎓 Common Use Cases

### Use Case 1: Bot Spell Lookup

**Scenario**: Bot needs to check spell details during combat

```typescript
import { DB2CachedLoaderFactory } from './parsers/db2/DB2CachedFileLoader';
import { SpellEntry } from './parsers/schemas/SpellSchema';

class BotSpellManager {
  private spellLoader: DB2CachedFileLoader;

  constructor() {
    this.spellLoader = DB2CachedLoaderFactory.getLoader('Spell.db2');
    this.spellLoader.loadFromFile('/path/to/Spell.db2');
  }

  canCastSpell(spellId: number): boolean {
    const spell = this.spellLoader.getTypedRecord<SpellEntry>(spellId);
    if (!spell) return false;

    // Check spell properties
    return spell.maxRange > 0 && spell.castTime < 3000;
  }

  getSpellCooldown(spellId: number): number {
    const spell = this.spellLoader.getTypedRecord<SpellEntry>(spellId);
    return spell?.recoveryTime || 0;
  }
}
```

**Performance**:
- First spell lookup: ~10ms
- Subsequent lookups: <1ms
- Throughput: 100,000+ lookups/second

---

### Use Case 2: Item Quality Assessment

**Scenario**: Bot evaluates loot quality for sell/keep decisions

```typescript
import { DB2CachedLoaderFactory } from './parsers/db2/DB2CachedFileLoader';
import { ItemEntry, ItemSparseEntry } from './parsers/schemas/ItemSchema';

class BotLootManager {
  private itemLoader: DB2CachedFileLoader;
  private itemSparseLoader: DB2CachedFileLoader;

  constructor() {
    this.itemLoader = DB2CachedLoaderFactory.getLoader('Item.db2');
    this.itemSparseLoader = DB2CachedLoaderFactory.getLoader('ItemSparse.db2');

    this.itemLoader.loadFromFile('/path/to/Item.db2');
    this.itemSparseLoader.loadFromFile('/path/to/ItemSparse.db2');
  }

  shouldKeepItem(itemId: number): boolean {
    const item = this.itemLoader.getTypedRecord<ItemEntry>(itemId);
    const itemSparse = this.itemSparseLoader.getTypedRecord<ItemSparseEntry>(itemId);

    if (!item || !itemSparse) return false;

    // Keep epic+ items
    if (itemSparse.quality >= 4) return true;

    // Keep items with good stats
    const hasGoodStats = itemSparse.statTypes?.some(
      stat => stat === 32 || stat === 36 // Crit or Haste
    );

    return hasGoodStats;
  }

  getItemValue(itemId: number): number {
    const itemSparse = this.itemSparseLoader.getTypedRecord<ItemSparseEntry>(itemId);
    if (!itemSparse) return 0;

    // Value based on quality
    const qualityMultipliers = [1, 1, 1.2, 1.5, 3, 5]; // Poor to Legendary
    const baseValue = 100;

    return baseValue * (qualityMultipliers[itemSparse.quality] || 1);
  }
}
```

---

### Use Case 3: Server Startup Optimization

**Scenario**: Warm cache on server startup for instant queries

```typescript
import { CacheWarmer } from './parsers/cache/CacheWarmer';
import { DB2CachedLoaderFactory } from './parsers/db2/DB2CachedFileLoader';

async function initializeMCPServer() {
  console.log('🚀 Starting TrinityCore MCP Server...\n');

  // Step 1: Warm caches
  console.log('📦 Warming DB2 caches...');
  const startTime = Date.now();

  const result = await CacheWarmer.warmAllCaches();

  if (result.success) {
    console.log(`✅ Cache warming complete (${Date.now() - startTime}ms)`);
    console.log(`   Files warmed: ${result.filesWarmed}`);
    console.log(`   Records preloaded: ${result.recordsPreloaded}\n`);
  } else {
    console.error(`❌ Cache warming failed: ${result.error}\n`);
  }

  // Step 2: Show global stats
  const stats = DB2CachedLoaderFactory.getGlobalStats();
  console.log(`📊 Global Cache Statistics:`);
  console.log(`   Total files: ${stats.totalFiles}`);
  console.log(`   Total memory: ${stats.totalMemoryMB.toFixed(2)}MB`);
  console.log(`   Ready for queries!\n`);

  // Step 3: Start MCP server
  console.log('✅ TrinityCore MCP Server ready\n');
}

initializeMCPServer().catch(console.error);
```

**Startup Times**:
- Cold start (no warming): 200-500ms first query
- Warm start (with warming): <1ms first query
- Cache warming overhead: 50-200ms

---

### Use Case 4: Quest Chain Processing

**Scenario**: Bot processes quest chain, needs frequent quest lookups

```typescript
import { DB2CachedLoaderFactory } from './parsers/db2/DB2CachedFileLoader';
import { CacheWarmer } from './parsers/cache/CacheWarmer';

class BotQuestManager {
  private questLoader: DB2CachedFileLoader;
  private itemLoader: DB2CachedFileLoader;

  async initialize() {
    // Get loaders
    this.questLoader = DB2CachedLoaderFactory.getLoader('Quest.db2');
    this.itemLoader = DB2CachedLoaderFactory.getLoader('Item.db2');

    // Load files
    this.questLoader.loadFromFile('/path/to/Quest.db2');
    this.itemLoader.loadFromFile('/path/to/Item.db2');

    // Preload common quest items
    const questItemIds = [5175, 5176, 5177, 5178]; // Totems
    this.itemLoader.preloadRecords(questItemIds);

    console.log('Quest manager initialized');
  }

  async processQuestChain(questIds: number[]) {
    for (const questId of questIds) {
      // Fast lookup (cached after first access)
      const quest = this.questLoader.getTypedRecord(questId);

      if (quest) {
        console.log(`Processing quest: ${quest.logTitle}`);
        // Process quest objectives, rewards, etc.
      }
    }

    // Show cache performance
    const stats = this.questLoader.getCacheStats();
    console.log(`Quest lookups: ${stats.totalHits} hits, ${stats.totalMisses} misses`);
    console.log(`Hit rate: ${stats.raw.hitRate.toFixed(2)}%`);
  }
}
```

---

### Use Case 5: Real-Time Combat Decision Making

**Scenario**: Bot makes split-second combat decisions using spell data

```typescript
import { DB2CachedLoaderFactory } from './parsers/db2/DB2CachedFileLoader';
import { SpellEntry } from './parsers/schemas/SpellSchema';

class BotCombatAI {
  private spellLoader: DB2CachedFileLoader;
  private commonSpells: Map<number, SpellEntry>;

  constructor() {
    this.spellLoader = DB2CachedLoaderFactory.getLoader('Spell.db2');
    this.spellLoader.loadFromFile('/path/to/Spell.db2');

    // Preload all class spells
    this.preloadClassSpells();
  }

  private preloadClassSpells() {
    this.commonSpells = new Map();

    // Warrior spells
    const warriorSpells = [100, 772, 1715, 6673]; // Charge, Rend, Hamstring, etc.

    for (const spellId of warriorSpells) {
      const spell = this.spellLoader.getTypedRecord<SpellEntry>(spellId);
      if (spell) {
        this.commonSpells.set(spellId, spell);
      }
    }

    console.log(`Preloaded ${this.commonSpells.size} class spells`);
  }

  selectBestSpell(targetDistance: number, manaPercent: number): number | null {
    let bestSpell: SpellEntry | null = null;
    let bestScore = 0;

    for (const [spellId, spell] of this.commonSpells) {
      // Check range
      if (spell.maxRange > 0 && targetDistance > spell.maxRange) continue;

      // Check mana cost
      const manaCost = spell.manaCost || 0;
      if (manaCost > manaPercent * 10) continue;

      // Score spell (higher damage = better)
      const damage = spell.effectBasePointsPerLevel?.[0] || 0;
      const score = damage / (spell.castTime || 1);

      if (score > bestScore) {
        bestScore = score;
        bestSpell = spell;
      }
    }

    return bestSpell?.id || null;
  }

  // Called every frame (60 FPS)
  updateCombat() {
    const targetDistance = 15; // meters
    const manaPercent = 75; // 75% mana

    // <1ms lookup time - no performance impact
    const spellId = this.selectBestSpell(targetDistance, manaPercent);

    if (spellId) {
      console.log(`Casting spell ${spellId}`);
    }
  }
}
```

**Performance**: Spell lookup takes <0.1ms, suitable for real-time 60 FPS updates.

---

## ⚙️ Configuration

### Cache Configuration Options

```typescript
interface CacheConfig {
  maxMemoryMB: number;      // Max memory per cache (default: 50MB)
  maxEntries?: number;      // Max entries (optional)
  ttl?: number;             // Time-to-live in ms (0 = no expiry)
  autoEvict?: boolean;      // Enable LRU eviction (default: true)
}
```

### Example Configurations

#### Production (Balanced)
```typescript
const loader = DB2CachedLoaderFactory.getLoader('Spell.db2', {
  maxMemoryMB: 50,
  autoEvict: true,
  ttl: 0 // No expiry
});
```

#### Development (Aggressive Caching)
```typescript
const loader = DB2CachedLoaderFactory.getLoader('Spell.db2', {
  maxMemoryMB: 100, // Larger limit
  autoEvict: true,
  ttl: 0
});
```

#### Memory-Constrained (Small Cache)
```typescript
const loader = DB2CachedLoaderFactory.getLoader('Spell.db2', {
  maxMemoryMB: 20, // Smaller limit
  autoEvict: true,
  ttl: 3600000 // 1 hour TTL
});
```

---

## 🎯 Cache Warming Strategies

### Strategy 1: List (Production Recommended)

Preload specific commonly-used IDs:

```typescript
await CacheWarmer.warmCache({
  files: ['Spell.db2'],
  strategy: 'list',
  idList: [8326, 2584, 100, 116, 133], // Specific spells
  maxRecordsPerFile: 50
});
```

**Pros**: Fast (<100ms), predictable memory usage
**Cons**: Requires knowledge of common IDs

---

### Strategy 2: Range

Preload range of sequential IDs:

```typescript
await CacheWarmer.warmCache({
  files: ['Spell.db2'],
  strategy: 'range',
  rangeStart: 0,
  rangeEnd: 999,
  maxRecordsPerFile: 1000
});
```

**Pros**: Good for contiguous ID ranges
**Cons**: Slower (200-500ms), may load unused records

---

### Strategy 3: All

Preload all records (small files only):

```typescript
await CacheWarmer.warmCache({
  files: ['ChrClasses.db2'], // Only 13 records
  strategy: 'all',
  maxRecordsPerFile: 1000
});
```

**Pros**: Complete coverage
**Cons**: Only suitable for small files (<1000 records)

---

## 📊 Monitoring & Debugging

### Basic Monitoring

```typescript
import { DB2CachedLoaderFactory } from './parsers/db2/DB2CachedFileLoader';

function logCacheStats() {
  const stats = DB2CachedLoaderFactory.getGlobalStats();

  console.log(`[Cache Monitor]`);
  console.log(`  Files: ${stats.totalFiles}`);
  console.log(`  Memory: ${stats.totalMemoryMB.toFixed(2)}MB`);
  console.log(`  Hits: ${stats.totalHits}`);
  console.log(`  Misses: ${stats.totalMisses}`);
  console.log(`  Hit Rate: ${(stats.totalHits / (stats.totalHits + stats.totalMisses) * 100).toFixed(2)}%`);
}

// Log every minute
setInterval(logCacheStats, 60000);
```

---

### Detailed Per-File Monitoring

```typescript
function logDetailedStats() {
  const globalStats = DB2CachedLoaderFactory.getGlobalStats();

  console.log(`\n=== Detailed Cache Statistics ===\n`);

  for (const [fileName, stats] of globalStats.files) {
    console.log(`${fileName}:`);
    console.log(`  Raw Cache:`);
    console.log(`    Entries: ${stats.raw.entryCount}`);
    console.log(`    Hit Rate: ${stats.raw.hitRate.toFixed(2)}%`);
    console.log(`    Evictions: ${stats.raw.evictions}`);
    console.log(`  Parsed Cache:`);
    console.log(`    Entries: ${stats.parsed.entryCount}`);
    console.log(`    Hit Rate: ${stats.parsed.hitRate.toFixed(2)}%`);
    console.log(`    Evictions: ${stats.parsed.evictions}\n`);
  }
}
```

---

### Memory Alerts

```typescript
function checkMemoryUsage() {
  const stats = DB2CachedLoaderFactory.getGlobalStats();

  if (stats.totalMemoryMB > 100) {
    console.warn(`⚠️  High memory usage: ${stats.totalMemoryMB.toFixed(2)}MB`);
    console.warn(`    Consider clearing caches or reducing maxMemoryMB`);
  }

  // Per-file check
  for (const [fileName, fileStats] of stats.files) {
    const loader = DB2CachedLoaderFactory.getLoader(fileName);
    const memory = loader.getCacheMemoryUsage();

    if (memory.totalMB > 45) {
      console.warn(`⚠️  ${fileName} approaching limit: ${memory.totalMB.toFixed(2)}MB`);
    }
  }
}

// Check every 5 minutes
setInterval(checkMemoryUsage, 300000);
```

---

### Cache Report Generation

```typescript
function generateCacheReport() {
  const globalStats = DB2CachedLoaderFactory.getGlobalStats();

  let report = '=== TrinityCore MCP Cache Report ===\n\n';
  report += `Generated: ${new Date().toISOString()}\n\n`;
  report += `Global Statistics:\n`;
  report += `  Files Loaded: ${globalStats.totalFiles}\n`;
  report += `  Total Memory: ${globalStats.totalMemoryMB.toFixed(2)}MB\n`;
  report += `  Total Requests: ${globalStats.totalHits + globalStats.totalMisses}\n`;
  report += `  Global Hit Rate: ${(globalStats.totalHits / (globalStats.totalHits + globalStats.totalMisses) * 100).toFixed(2)}%\n\n`;

  report += 'Per-File Details:\n';
  for (const [fileName, stats] of globalStats.files) {
    const loader = DB2CachedLoaderFactory.getLoader(fileName);
    report += `\n${loader.getCacheReport()}\n`;
  }

  return report;
}

// Generate daily report
setInterval(() => {
  const report = generateCacheReport();
  console.log(report);
  // Optionally save to file
}, 86400000); // 24 hours
```

---

## 🐛 Troubleshooting

### Problem 1: High Memory Usage

**Symptoms**: Memory > 100MB, server slowing down

**Solutions**:

1. **Lower memory limits**:
```typescript
const loader = DB2CachedLoaderFactory.getLoader('Spell.db2', {
  maxMemoryMB: 30 // Reduced from 50MB
});
```

2. **Clear unused caches**:
```typescript
DB2CachedLoaderFactory.clearAll();
```

3. **Enable TTL expiry**:
```typescript
const loader = DB2CachedLoaderFactory.getLoader('Spell.db2', {
  ttl: 3600000 // 1 hour expiry
});
```

---

### Problem 2: Low Hit Rate (<50%)

**Symptoms**: Most accesses are cache misses

**Solutions**:

1. **Warm cache on startup**:
```typescript
await CacheWarmer.warmAllCaches();
```

2. **Preload commonly accessed records**:
```typescript
loader.preloadRecords([100, 116, 133, 772]); // Your common IDs
```

3. **Check access patterns**:
```typescript
const stats = loader.getCacheStats();
console.log(`Misses: ${stats.totalMisses}`);
// Identify which records are being missed
```

---

### Problem 3: Slow Initial Queries

**Symptoms**: First queries take >1 second

**Solutions**:

1. **Use cache warming**:
```typescript
await CacheWarmer.warmAllCaches();
```

2. **Load files at startup**:
```typescript
const loader = DB2CachedLoaderFactory.getLoader('Spell.db2');
loader.loadFromFile('/path/to/Spell.db2'); // Load immediately
```

3. **Async initialization**:
```typescript
async function init() {
  const loader = DB2CachedLoaderFactory.getLoader('Spell.db2');
  await new Promise(resolve => {
    loader.loadFromFile('/path/to/Spell.db2');
    resolve();
  });
}
```

---

### Problem 4: File Not Found Errors

**Symptoms**: `Error: File not found` or `ENOENT`

**Solutions**:

1. **Set DB2_PATH environment variable**:
```bash
export DB2_PATH=/path/to/wow/DBFilesClient
```

2. **Use absolute paths**:
```typescript
const absolutePath = path.resolve('/path/to/wow/DBFilesClient/Spell.db2');
loader.loadFromFile(absolutePath);
```

3. **Check file exists**:
```typescript
import * as fs from 'fs';

const filePath = '/path/to/Spell.db2';
if (fs.existsSync(filePath)) {
  loader.loadFromFile(filePath);
} else {
  console.error(`File not found: ${filePath}`);
}
```

---

## 🎯 Best Practices Checklist

- ✅ Always use `DB2CachedLoaderFactory.getLoader()` (singleton pattern)
- ✅ Warm cache on server startup with `CacheWarmer.warmAllCaches()`
- ✅ Monitor memory usage with `getCacheMemoryUsage()`
- ✅ Use typed records with `getTypedRecord<T>()` for type safety
- ✅ Preload common IDs with `preloadRecords()`
- ✅ Check cache hit rate regularly with `getCacheStats()`
- ✅ Set appropriate memory limits (30-50MB per file)
- ✅ Enable auto-eviction (`autoEvict: true`)
- ✅ Clear caches when no longer needed with `clearCache()`
- ✅ Log cache statistics for monitoring

---

## 📚 Additional Resources

- **API Reference**: See `doc/API_REFERENCE.md` for complete API documentation
- **Performance Benchmarks**: See `doc/PERFORMANCE_BENCHMARKS.md` for detailed benchmarks
- **Integration Tests**: See `tests/integration/DB2Integration.test.ts` for examples
- **Week 7 Progress**: See `WEEK_7_PROGRESS.md` for implementation details

---

**Usage Guide Version**: 1.0
**Last Updated**: 2025-10-31
**Author**: Claude Code
