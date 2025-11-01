/**
 * Cache Warming Strategy Module
 * Week 7: Intelligent preloading of frequently accessed DB2 records
 *
 * Preloads common spell IDs, item IDs, and other frequently queried records
 * to minimize cache misses during initial MCP queries.
 */

import { DB2CachedLoaderFactory } from "../db2/DB2CachedFileLoader";
import * as path from "path";
import * as fs from "fs";

const DB2_PATH = process.env.DB2_PATH || "./data/db2";

/**
 * Cache warming configuration
 */
export interface CacheWarmingConfig {
  // Files to warm
  files: string[];

  // Strategy: "all" | "range" | "list"
  strategy: "all" | "range" | "list";

  // For range strategy: start and end IDs
  rangeStart?: number;
  rangeEnd?: number;

  // For list strategy: specific IDs to preload
  idList?: number[];

  // Maximum records to preload per file
  maxRecordsPerFile?: number;

  // Enable verbose logging
  verbose?: boolean;
}

/**
 * Cache warming result
 */
export interface CacheWarmingResult {
  success: boolean;
  filesWarmed: number;
  recordsPreloaded: number;
  totalTime: number;
  fileResults: {
    file: string;
    recordsLoaded: number;
    loadTime: number;
    cacheHitRate: string;
  }[];
  error?: string;
}

/**
 * Common spell IDs used in WoW 11.2 gameplay
 * Based on frequently queried spells by bots
 */
const COMMON_SPELL_IDS = [
  // Death/Resurrection
  8326,   // Ghost (death state)
  2584,   // Waiting to Resurrect
  20707,  // Soulstone Resurrection

  // Class basics (level 1-10 spells)
  100,    // Charge (Warrior)
  772,    // Rend (Warrior)
  2098,   // Run Through (Rogue)
  1752,   // Sinister Strike (Rogue)
  116,    // Frostbolt (Mage)
  133,    // Fireball (Mage)
  2061,   // Flash Heal (Priest)
  585,    // Smite (Priest)

  // Buffs and auras
  1126,   // Mark of the Wild (Druid)
  21562,  // Power Word: Fortitude (Priest)
  1459,   // Arcane Intellect (Mage)

  // Mounts (common)
  23161,  // Dreadsteed (Warlock)
  13819,  // Warhorse (Paladin)

  // Food/Drink
  430,    // Drink
  433,    // Food

  // Combat
  6603,   // Auto Attack
  75,     // Auto Shot
];

/**
 * Common item IDs used in WoW 11.2
 * Based on frequently queried items by bots
 */
const COMMON_ITEM_IDS = [
  // Starting gear (level 1)
  6948,   // Hearthstone
  2361,   // Battleworn Hammer
  25,     // Worn Shortsword
  2362,   // Battleworn Axe

  // Basic consumables
  117,    // Tough Jerky
  159,    // Refreshing Spring Water
  2512,   // Rough Arrow
  2516,   // Light Shot

  // Quest items (common)
  5175,   // Earth Totem
  5176,   // Fire Totem
  5177,   // Water Totem
  5178,   // Air Totem

  // Bags
  828,    // Small Blue Pouch (6-slot)
  4500,   // Traveler's Backpack (12-slot)

  // Currencies
  2589,   // Linen Cloth
  2592,   // Wool Cloth
];

/**
 * Cache Warmer - Preloads frequently accessed DB2 records
 */
export class CacheWarmer {
  /**
   * Warm spell cache with common spell IDs
   * @param config Optional custom configuration
   * @returns Warming result
   */
  public static async warmSpellCache(
    config?: Partial<CacheWarmingConfig>
  ): Promise<CacheWarmingResult> {
    const defaultConfig: CacheWarmingConfig = {
      files: ["Spell.db2"],
      strategy: "list",
      idList: COMMON_SPELL_IDS,
      maxRecordsPerFile: 100,
      verbose: false,
    };

    const finalConfig = { ...defaultConfig, ...config };
    return this.warmCache(finalConfig);
  }

  /**
   * Warm item cache with common item IDs
   * @param config Optional custom configuration
   * @returns Warming result
   */
  public static async warmItemCache(
    config?: Partial<CacheWarmingConfig>
  ): Promise<CacheWarmingResult> {
    const defaultConfig: CacheWarmingConfig = {
      files: ["Item.db2", "ItemSparse.db2"],
      strategy: "list",
      idList: COMMON_ITEM_IDS,
      maxRecordsPerFile: 50,
      verbose: false,
    };

    const finalConfig = { ...defaultConfig, ...config };
    return this.warmCache(finalConfig);
  }

  /**
   * Warm all caches with default strategies
   * @returns Combined warming result
   */
  public static async warmAllCaches(): Promise<CacheWarmingResult> {
    const startTime = Date.now();
    const fileResults: any[] = [];

    try {
      // Warm spell cache
      const spellResult = await this.warmSpellCache();
      if (spellResult.success) {
        fileResults.push(...spellResult.fileResults);
      }

      // Warm item cache
      const itemResult = await this.warmItemCache();
      if (itemResult.success) {
        fileResults.push(...itemResult.fileResults);
      }

      const totalRecords = fileResults.reduce((sum, r) => sum + r.recordsLoaded, 0);

      return {
        success: true,
        filesWarmed: fileResults.length,
        recordsPreloaded: totalRecords,
        totalTime: Date.now() - startTime,
        fileResults,
      };
    } catch (error) {
      return {
        success: false,
        filesWarmed: 0,
        recordsPreloaded: 0,
        totalTime: Date.now() - startTime,
        fileResults,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Warm cache with custom configuration
   * @param config Cache warming configuration
   * @returns Warming result
   */
  public static async warmCache(config: CacheWarmingConfig): Promise<CacheWarmingResult> {
    const startTime = Date.now();
    const fileResults: any[] = [];

    try {
      for (const fileName of config.files) {
        const fileStartTime = Date.now();
        const filePath = path.join(DB2_PATH, fileName);

        // Check if file exists
        if (!fs.existsSync(filePath)) {
          if (config.verbose) {
            console.log(`[CacheWarmer] Skipping ${fileName} - file not found`);
          }
          continue;
        }

        // Get or create loader
        const loader = DB2CachedLoaderFactory.getLoader(fileName);

        // Load file if not already loaded
        try {
          if (loader.getRecordCount() === 0) {
            loader.loadFromFile(filePath);
          }
        } catch (loadError) {
          loader.loadFromFile(filePath);
        }

        // Determine IDs to preload based on strategy
        let idsToLoad: number[] = [];

        switch (config.strategy) {
          case "all":
            // Preload all records (up to maxRecordsPerFile)
            const recordCount = loader.getRecordCount();
            const limit = Math.min(recordCount, config.maxRecordsPerFile || recordCount);
            idsToLoad = Array.from({ length: limit }, (_, i) => i);
            break;

          case "range":
            // Preload range
            if (config.rangeStart !== undefined && config.rangeEnd !== undefined) {
              const start = config.rangeStart;
              const maxEnd = config.rangeStart + (config.maxRecordsPerFile || 1000) - 1;
              const end = Math.min(config.rangeEnd, maxEnd);
              idsToLoad = Array.from({ length: end - start + 1 }, (_, i) => start + i);
            }
            break;

          case "list":
            // Preload specific IDs
            if (config.idList && config.idList.length > 0) {
              idsToLoad = config.idList.slice(0, config.maxRecordsPerFile || config.idList.length);
            }
            break;
        }

        // Preload records
        if (idsToLoad.length > 0) {
          loader.preloadRecords(idsToLoad);

          if (config.verbose) {
            console.log(
              `[CacheWarmer] Preloaded ${idsToLoad.length} records from ${fileName}`
            );
          }
        }

        // Get cache stats after warming
        const stats = loader.getCacheStats();
        const fileLoadTime = Date.now() - fileStartTime;

        fileResults.push({
          file: fileName,
          recordsLoaded: idsToLoad.length,
          loadTime: fileLoadTime,
          cacheHitRate: stats.raw.hitRate.toFixed(2) + "%",
        });
      }

      const totalRecords = fileResults.reduce((sum, r) => sum + r.recordsLoaded, 0);

      return {
        success: true,
        filesWarmed: fileResults.length,
        recordsPreloaded: totalRecords,
        totalTime: Date.now() - startTime,
        fileResults,
      };
    } catch (error) {
      return {
        success: false,
        filesWarmed: 0,
        recordsPreloaded: 0,
        totalTime: Date.now() - startTime,
        fileResults,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Get cache warming recommendations based on current cache state
   * @returns Recommended warming configuration
   */
  public static getCacheRecommendations(): CacheWarmingConfig[] {
    const recommendations: CacheWarmingConfig[] = [];

    // Spell cache recommendation
    recommendations.push({
      files: ["Spell.db2"],
      strategy: "list",
      idList: COMMON_SPELL_IDS,
      maxRecordsPerFile: 100,
      verbose: false,
    });

    // Item cache recommendation
    recommendations.push({
      files: ["Item.db2", "ItemSparse.db2"],
      strategy: "list",
      idList: COMMON_ITEM_IDS,
      maxRecordsPerFile: 50,
      verbose: false,
    });

    return recommendations;
  }

  /**
   * Get current cache statistics across all files
   * @returns Global cache statistics
   */
  public static getCurrentCacheState(): any {
    return DB2CachedLoaderFactory.getGlobalStats();
  }
}
