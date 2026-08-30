/**
 * MySQL Database Connection Manager for TrinityCore
 * Enhanced with LRU caching, query timeout protection, and enterprise error handling
 */

import mysql from "mysql2/promise";
import { LRUCache } from "lru-cache";
import { DatabaseError, handleError } from "../utils/error-handler";
import { withRetry, DATABASE_RETRY_OPTIONS } from "../utils/retry";

/**
 * Read a setting under either naming scheme.
 *
 * This module is imported by the MCP server, which configures itself with
 * TRINITY_DB_*, and by the web UI's route handlers, which configure themselves
 * with DB_*. Reading only the TRINITY_* names meant that when the web UI
 * imported it directly the pool was built with an empty user, and every query
 * failed with "Access denied for user ''@'localhost'" - a message that reads as
 * a database problem rather than as two conventions meeting.
 *
 * @param trinityName The TRINITY_DB_* variable
 * @param webName The DB_* variable the web UI uses for the same setting
 * @param fallback Value when neither is set
 */
function setting(trinityName: string, webName: string, fallback: string): string {
  const value = process.env[trinityName] || process.env[webName];
  return value && value !== "" ? value : fallback;
}

// Environment variables
const DB_CONFIG = {
  host: setting("TRINITY_DB_HOST", "DB_HOST", "localhost"),
  port: parseInt(setting("TRINITY_DB_PORT", "DB_PORT", "3306")),
  user: setting("TRINITY_DB_USER", "DB_USERNAME", ""),
  password: setting("TRINITY_DB_PASSWORD", "DB_PASSWORD", ""),
};

// Database names
const DB_NAMES = {
  world: setting("TRINITY_DB_WORLD", "DB_WORLD_DATABASE", "world"),
  auth: setting("TRINITY_DB_AUTH", "DB_AUTH_DATABASE", "auth"),
  characters: setting("TRINITY_DB_CHARACTERS", "DB_CHARACTERS_DATABASE", "characters"),
  hotfixes: setting("TRINITY_DB_HOTFIXES", "DB_HOTFIXES_DATABASE", "hotfixes"),
};

// Query configuration
/**
 * Default per-query timeout.
 *
 * Sized for the point lookups that make up almost every query here. Analytics
 * over whole tables legitimately take longer, so those callers pass their own;
 * raising this for everyone would let a genuinely stuck lookup hang instead.
 */
const QUERY_TIMEOUT = 5000; // 5 seconds
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY = 1000; // 1 second

// LRU Cache configuration (max 1000 queries, 10 minute TTL)
const queryCache = new LRUCache<string, any>({
  max: 1000,
  ttl: 1000 * 60 * 10, // 10 minutes
});

// Statistics tracking
interface QueryStats {
  totalQueries: number;
  cacheHits: number;
  cacheMisses: number;
  errors: number;
  avgQueryTime: number;
  slowQueries: number; // queries > 1 second
}

const stats: Record<string, QueryStats> = {
  world: { totalQueries: 0, cacheHits: 0, cacheMisses: 0, errors: 0, avgQueryTime: 0, slowQueries: 0 },
  auth: { totalQueries: 0, cacheHits: 0, cacheMisses: 0, errors: 0, avgQueryTime: 0, slowQueries: 0 },
  characters: { totalQueries: 0, cacheHits: 0, cacheMisses: 0, errors: 0, avgQueryTime: 0, slowQueries: 0 },
  hotfixes: { totalQueries: 0, cacheHits: 0, cacheMisses: 0, errors: 0, avgQueryTime: 0, slowQueries: 0 },
};

// Connection pool
let worldPool: mysql.Pool | null = null;
let authPool: mysql.Pool | null = null;
let charactersPool: mysql.Pool | null = null;
let hotfixesPool: mysql.Pool | null = null;

/**
 * Create cache key from SQL and params
 */
function createCacheKey(sql: string, params?: any[]): string {
  return `${sql}|${JSON.stringify(params || [])}`;
}

/**
 * Execute query with timeout protection
 */
async function executeWithTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Query timeout after ${timeoutMs}ms`)), timeoutMs)
    ),
  ]);
}

/**
 * Execute query with retry logic
 */
async function executeWithRetry<T>(
  fn: () => Promise<T>,
  attempts: number = MAX_RETRY_ATTEMPTS
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (attempts <= 1) throw error;

    // Only retry on connection errors
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (
      errorMessage.includes("ECONNREFUSED") ||
      errorMessage.includes("ETIMEDOUT") ||
      errorMessage.includes("Connection lost")
    ) {
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
      return executeWithRetry(fn, attempts - 1);
    }

    throw error;
  }
}

/**
 * Update query statistics
 */
function updateStats(
  database: keyof typeof stats,
  queryTime: number,
  cacheHit: boolean,
  error: boolean = false
): void {
  const dbStats = stats[database];
  dbStats.totalQueries++;

  if (cacheHit) {
    dbStats.cacheHits++;
  } else {
    dbStats.cacheMisses++;
  }

  if (error) {
    dbStats.errors++;
  }

  if (!cacheHit) {
    // Update average query time (exponential moving average)
    dbStats.avgQueryTime = dbStats.avgQueryTime === 0
      ? queryTime
      : dbStats.avgQueryTime * 0.9 + queryTime * 0.1;

    if (queryTime > 1000) {
      dbStats.slowQueries++;
    }
  }
}

/**
 * Get connection pool for world database
 */
export function getWorldPool(): mysql.Pool {
  if (!worldPool) {
    worldPool = mysql.createPool({
      ...DB_CONFIG,
      database: DB_NAMES.world,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });
  }
  return worldPool;
}

/**
 * Get connection pool for auth database
 */
export function getAuthPool(): mysql.Pool {
  if (!authPool) {
    authPool = mysql.createPool({
      ...DB_CONFIG,
      database: DB_NAMES.auth,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });
  }
  return authPool;
}

/**
 * Get connection pool for characters database
 */
export function getCharactersPool(): mysql.Pool {
  if (!charactersPool) {
    charactersPool = mysql.createPool({
      ...DB_CONFIG,
      database: DB_NAMES.characters,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });
  }
  return charactersPool;
}

/**
 * Get connection pool for hotfixes database
 * The hotfixes database contains client data tables such as `item`, `item_sparse`,
 * `battle_pet_species`, and other tables that were moved from the world database
 * in TrinityCore 12.0.1. This replaces the old `item_template` and similar queries.
 */
export function getHotfixesPool(): mysql.Pool {
  if (!hotfixesPool) {
    hotfixesPool = mysql.createPool({
      ...DB_CONFIG,
      database: DB_NAMES.hotfixes,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });
  }
  return hotfixesPool;
}

/**
 * Execute cached query with timeout and retry protection
 */
async function executeCachedQuery(
  database: "world" | "auth" | "characters" | "hotfixes",
  pool: mysql.Pool,
  sql: string,
  params?: any[],
  useCache: boolean = true,
  /** Override the default timeout for a query that is legitimately slow. */
  timeoutMs?: number
): Promise<any> {
  const startTime = Date.now();
  const cacheKey = createCacheKey(sql, params);

  try {
    // Check cache first
    if (useCache) {
      const cached = queryCache.get(cacheKey);
      if (cached !== undefined) {
        updateStats(database, Date.now() - startTime, true);
        return cached;
      }
    }

    // Execute query with timeout and retry using enhanced retry utility
    const result = await withRetry(async () => {
      return executeWithTimeout(
        pool.execute(sql, params),
        timeoutMs ?? QUERY_TIMEOUT
      );
    }, DATABASE_RETRY_OPTIONS);

    const [rows] = result;
    const queryTime = Date.now() - startTime;

    // Cache result
    if (useCache) {
      queryCache.set(cacheKey, rows);
    }

    updateStats(database, queryTime, false);
    return rows;
  } catch (error) {
    const queryTime = Date.now() - startTime;
    updateStats(database, queryTime, false, true);

    // Use enhanced error handling
    const errorDetails = handleError(error, {
      database,
      sql: sql.substring(0, 100), // First 100 chars of SQL
      params,
      queryTime,
    });

    throw new DatabaseError(
      `Database query failed: ${errorDetails.message}`,
      errorDetails.severity,
      errorDetails.isRetryable,
      errorDetails.context
    );
  }
}

/**
 * Query world database with enterprise error handling
 */
export async function queryWorld(
  sql: string,
  params?: any[],
  useCache: boolean = true,
  timeoutMs?: number
): Promise<any> {
  try {
    const pool = getWorldPool();
    return await executeCachedQuery("world", pool, sql, params, useCache, timeoutMs);
  } catch (error) {
    throw new DatabaseError(
      `Failed to query world database: ${error instanceof Error ? error.message : String(error)}`,
      undefined,
      true,
      { database: "world", sql: sql.substring(0, 100), params }
    );
  }
}

/**
 * Query auth database with enterprise error handling
 */
export async function queryAuth(sql: string, params?: any[], useCache: boolean = true): Promise<any> {
  try {
    const pool = getAuthPool();
    return await executeCachedQuery("auth", pool, sql, params, useCache);
  } catch (error) {
    throw new DatabaseError(
      `Failed to query auth database: ${error instanceof Error ? error.message : String(error)}`,
      undefined,
      true,
      { database: "auth", sql: sql.substring(0, 100), params }
    );
  }
}

/**
 * Query characters database with enterprise error handling
 */
export async function queryCharacters(sql: string, params?: any[], useCache: boolean = true): Promise<any> {
  try {
    const pool = getCharactersPool();
    return await executeCachedQuery("characters", pool, sql, params, useCache);
  } catch (error) {
    throw new DatabaseError(
      `Failed to query characters database: ${error instanceof Error ? error.message : String(error)}`,
      undefined,
      true,
      { database: "characters", sql: sql.substring(0, 100), params }
    );
  }
}

/**
 * Query hotfixes database with enterprise error handling
 * The hotfixes database contains client data tables such as `item`, `item_sparse`,
 * `battle_pet_species`, and other tables that were moved from the world database
 * in TrinityCore 12.0.1. This replaces the old `item_template` and similar queries.
 */
export async function queryHotfixes(sql: string, params?: any[], useCache: boolean = true): Promise<any> {
  try {
    const pool = getHotfixesPool();
    return await executeCachedQuery("hotfixes", pool, sql, params, useCache);
  } catch (error) {
    throw new DatabaseError(
      `Failed to query hotfixes database: ${error instanceof Error ? error.message : String(error)}`,
      undefined,
      true,
      { database: "hotfixes", sql: sql.substring(0, 100), params }
    );
  }
}

/**
 * Get query statistics for a database
 */
export function getStats(database: "world" | "auth" | "characters" | "hotfixes"): QueryStats {
  return { ...stats[database] };
}

/**
 * Get all query statistics
 */
export function getAllStats(): Record<string, QueryStats> {
  return {
    world: { ...stats.world },
    auth: { ...stats.auth },
    characters: { ...stats.characters },
    hotfixes: { ...stats.hotfixes },
  };
}

/**
 * Clear query cache
 */
export function clearCache(): void {
  queryCache.clear();
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
  return {
    size: queryCache.size,
    max: queryCache.max,
    calculatedSize: queryCache.calculatedSize,
  };
}

/**
 * Close all connections
 */
export async function closeConnections(): Promise<void> {
  if (worldPool) await worldPool.end();
  if (authPool) await authPool.end();
  if (charactersPool) await charactersPool.end();
  if (hotfixesPool) await hotfixesPool.end();
}
