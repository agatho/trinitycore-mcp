/**
 * Database Client
 *
 * MySQL/MariaDB client for TrinityCore database operations (export, import,
 * diff, backup, health checks) with connection pooling, batch execution,
 * and transaction support.
 *
 * CONSOLIDATION: This module reuses connection pools from connection.ts for
 * the standard TrinityCore databases (world, auth, characters). Standalone
 * pools are only created for non-standard database configs (e.g., when
 * diff-tool compares against a different database instance).
 *
 * @module db-client
 */

import type { DatabaseConfig } from "../types/database";
import mysql from "mysql2/promise";
import { getWorldPool, getAuthPool, getCharactersPool } from "./connection";

// ============================================================================
// Types
// ============================================================================

/** Query result */
export interface QueryResult {
  rows: any[];
  fields: any[];
  affectedRows?: number;
  insertId?: number;
}

// ============================================================================
// Connection Management - Unified Pool Resolution
// ============================================================================

/**
 * Standard TrinityCore database configuration from environment.
 * Used to detect when a config matches a standard pool (avoiding duplicate pools).
 */
const STANDARD_DB_CONFIG = {
  host: process.env.TRINITY_DB_HOST || "localhost",
  port: parseInt(process.env.TRINITY_DB_PORT || "3306"),
  world: process.env.TRINITY_DB_WORLD || "world",
  auth: process.env.TRINITY_DB_AUTH || "auth",
  characters: process.env.TRINITY_DB_CHARACTERS || "characters",
};

/** Standalone pools for non-standard database configs */
let standalonePools: Map<string, mysql.Pool> = new Map();

/**
 * Check if a config matches one of the standard TrinityCore databases.
 * If so, return the shared pool from connection.ts to avoid duplicate connections.
 */
function matchStandardPool(config: DatabaseConfig): mysql.Pool | null {
  if (config.host !== STANDARD_DB_CONFIG.host || config.port !== STANDARD_DB_CONFIG.port) {
    return null;
  }

  if (config.database === STANDARD_DB_CONFIG.world) return getWorldPool();
  if (config.database === STANDARD_DB_CONFIG.auth) return getAuthPool();
  if (config.database === STANDARD_DB_CONFIG.characters) return getCharactersPool();

  return null;
}

/**
 * Get or create connection pool for a database config.
 *
 * Reuses standard TrinityCore pools from connection.ts when the config matches
 * (same host:port + standard database name). Creates a standalone pool only
 * for non-standard configs (e.g., comparing against a remote database).
 */
export function getPool(config: DatabaseConfig): mysql.Pool {
  // Try to reuse a standard TrinityCore pool
  const standardPool = matchStandardPool(config);
  if (standardPool) return standardPool;

  // Create standalone pool for non-standard config
  const key = `${config.host}:${config.port}:${config.database}`;

  if (!standalonePools.has(key)) {
    const pool = mysql.createPool({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      database: config.database,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });

    standalonePools.set(key, pool);
  }

  return standalonePools.get(key)!;
}

/**
 * Close all standalone connection pools.
 * Does NOT close standard TrinityCore pools (those are managed by connection.ts).
 */
export async function closeAllPools(): Promise<void> {
  for (const pool of standalonePools.values()) {
    await pool.end();
  }
  standalonePools.clear();
}

/**
 * Close a specific standalone pool.
 */
export async function closePool(config: DatabaseConfig): Promise<void> {
  const key = `${config.host}:${config.port}:${config.database}`;
  const pool = standalonePools.get(key);

  if (pool) {
    await pool.end();
    standalonePools.delete(key);
  }
}

// ============================================================================
// Query Execution
// ============================================================================

/** Execute a single query */
export async function executeQuery(
  config: DatabaseConfig,
  query: string,
  params: any[] = [],
): Promise<QueryResult> {
  const pool = getPool(config);
  const [rows, fields] = await pool.execute(query, params);

  return {
    rows: rows as any[],
    fields: fields as any[],
    affectedRows: (rows as any).affectedRows,
    insertId: (rows as any).insertId,
  };
}

/** Execute a batch of queries in a single transaction */
export async function executeBatch(
  config: DatabaseConfig,
  queries: Array<{ query: string; params?: any[] }>,
): Promise<QueryResult[]> {
  const pool = getPool(config);
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const results: QueryResult[] = [];

    for (const { query, params = [] } of queries) {
      const [rows, fields] = await connection.execute(query, params);
      results.push({
        rows: rows as any[],
        fields: fields as any[],
        affectedRows: (rows as any).affectedRows,
        insertId: (rows as any).insertId,
      });
    }

    await connection.commit();
    return results;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/** Execute operations within a transaction */
export async function executeTransaction(
  config: DatabaseConfig,
  callback: (connection: mysql.PoolConnection) => Promise<void>,
): Promise<void> {
  const pool = getPool(config);
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    await callback(connection);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/** Test if a database connection is reachable */
export async function testConnection(config: DatabaseConfig): Promise<boolean> {
  try {
    const pool = getPool(config);
    const connection = await pool.getConnection();
    connection.release();
    return true;
  } catch {
    return false;
  }
}
