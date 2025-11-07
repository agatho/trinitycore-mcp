/**
 * Database Client
 *
 * MySQL/MariaDB client for TrinityCore databases with connection pooling,
 * query execution, and transaction support.
 *
 * @module db-client
 */

import type { DatabaseConfig } from "../types/database";
import mysql from "mysql2/promise";

// ============================================================================
// Types
// ============================================================================

/**
 * Query result
 */
export interface QueryResult {
  rows: any[];
  fields: any[];
  affectedRows?: number;
  insertId?: number;
}

/**
 * Connection pool
 */
let pools: Map<string, mysql.Pool> = new Map();

// ============================================================================
// Connection Management
// ============================================================================

/**
 * Get or create connection pool
 */
export function getPool(config: DatabaseConfig): mysql.Pool {
  const key = `${config.host}:${config.port}:${config.database}`;

  if (!pools.has(key)) {
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

    pools.set(key, pool);
  }

  return pools.get(key)!;
}

/**
 * Close all connection pools
 */
export async function closeAllPools(): Promise<void> {
  for (const pool of pools.values()) {
    await pool.end();
  }
  pools.clear();
}

/**
 * Close specific pool
 */
export async function closePool(config: DatabaseConfig): Promise<void> {
  const key = `${config.host}:${config.port}:${config.database}`;
  const pool = pools.get(key);

  if (pool) {
    await pool.end();
    pools.delete(key);
  }
}

// ============================================================================
// Query Execution
// ============================================================================

/**
 * Execute query
 */
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

/**
 * Execute batch of queries
 */
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

/**
 * Execute with transaction
 */
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

/**
 * Test connection
 */
export async function testConnection(config: DatabaseConfig): Promise<boolean> {
  try {
    const pool = getPool(config);
    const connection = await pool.getConnection();
    connection.release();
    return true;
  } catch (error) {
    return false;
  }
}
