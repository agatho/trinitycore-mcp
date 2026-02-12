/**
 * MySQL Database Connection Manager for TrinityCore
 * Enhanced with LRU caching, query timeout protection, and enterprise error handling
 */

import mysql from "mysql2/promise";
import { LRUCache } from "lru-cache";
import { DatabaseError, handleError } from "../utils/error-handler";
import { withRetry, DATABASE_RETRY_OPTIONS } from "../utils/retry";

// Environment variables
const DB_CONFIG = {
  host: process.env.TRINITY_DB_HOST || "localhost",
  port: parseInt(process.env.TRINITY_DB_PORT || "3306"),
  user: process.env.TRINITY_DB_USER || "",
  password: process.env.TRINITY_DB_PASSWORD || "",
};

// Database names
const DB_NAMES = {
  world: process.env.TRINITY_DB_WORLD || "world",
  auth: process.env.TRINITY_DB_AUTH || "auth",
  characters: process.env.TRINITY_DB_CHARACTERS || "characters",
};

// Query configuration
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
};

// Connection pool
let worldPool: mysql.Pool | null = null;
let authPool: mysql.Pool | null = null;
let charactersPool: mysql.Pool | null = null;

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
 * Execute cached query with timeout and retry protection
 */
async function executeCachedQuery(
  database: "world" | "auth" | "characters",
  pool: mysql.Pool,
  sql: string,
  params?: any[],
  useCache: boolean = true
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
        QUERY_TIMEOUT
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
export async function queryWorld(sql: string, params?: any[], useCache: boolean = true): Promise<any> {
  try {
    const pool = getWorldPool();
    return await executeCachedQuery("world", pool, sql, params, useCache);
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
 * Get query statistics for a database
 */
export function getStats(database: "world" | "auth" | "characters"): QueryStats {
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
}
