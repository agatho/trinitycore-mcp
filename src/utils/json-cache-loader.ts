/**
 * Generic JSON Cache Loader
 *
 * Provides a reusable, type-safe mechanism for loading JSON cache files
 * into Map<number, T> structures with lazy initialization, logging, and
 * error handling.
 *
 * Eliminates 600+ lines of duplicated cache loading code across spell.ts,
 * item.ts, creature.ts, and dungeonstrategygenerator.ts.
 *
 * @module utils/json-cache-loader
 */

import * as fs from "fs";
import { logger } from "./logger";

/**
 * A lazy-loaded JSON cache that maps numeric IDs to typed entries.
 *
 * Usage:
 * ```typescript
 * const spellNameCache = new JsonCacheLoader<string>("./data/cache/spell_names_cache.json", "spell name");
 * const name = spellNameCache.get(133);  // Lazy loads on first access
 * ```
 */
export class JsonCacheLoader<T> {
  private cache: Map<number, T> | null = null;
  private loaded = false;

  /**
   * @param filePath - Path to the JSON cache file
   * @param label - Human-readable label for log messages (e.g., "spell name", "item", "creature")
   */
  constructor(
    private readonly filePath: string,
    private readonly label: string
  ) {}

  /**
   * Load the cache from disk. Subsequent calls are no-ops if already loaded.
   * @returns true if cache is available (loaded successfully), false otherwise
   */
  load(): boolean {
    if (this.loaded) {
      return this.cache !== null;
    }

    this.loaded = true;

    try {
      if (!fs.existsSync(this.filePath)) {
        logger.warn(`${this.label} cache not found at ${this.filePath}.`);
        return false;
      }

      const raw = JSON.parse(fs.readFileSync(this.filePath, "utf8"));
      this.cache = new Map<number, T>();

      if (typeof raw === "object" && raw !== null) {
        for (const [key, value] of Object.entries(raw)) {
          this.cache.set(parseInt(key, 10), value as T);
        }
      }

      logger.info(`Loaded ${this.label} cache: ${this.cache.size} entries`);
      return true;
    } catch (error) {
      logger.error(`Failed to load ${this.label} cache: ${error}`);
      this.cache = null;
      return false;
    }
  }

  /**
   * Get an entry by numeric ID. Lazy loads the cache on first access.
   * @returns The cached entry or null if not found / cache unavailable
   */
  get(id: number): T | null {
    if (!this.loaded) {
      this.load();
    }
    return this.cache?.get(id) ?? null;
  }

  /**
   * Get the underlying Map (lazy loads if needed).
   * @returns The Map or null if cache is unavailable
   */
  getMap(): Map<number, T> | null {
    if (!this.loaded) {
      this.load();
    }
    return this.cache;
  }

  /**
   * Get the number of entries in the cache.
   */
  get size(): number {
    if (!this.loaded) {
      this.load();
    }
    return this.cache?.size ?? 0;
  }

  /**
   * Check if the cache has been loaded and is available.
   */
  get isLoaded(): boolean {
    return this.loaded && this.cache !== null;
  }

  /**
   * Force reload the cache from disk (useful for invalidation).
   */
  reload(): boolean {
    this.loaded = false;
    this.cache = null;
    return this.load();
  }
}
