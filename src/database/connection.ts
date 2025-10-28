/**
 * MySQL Database Connection Manager for TrinityCore
 */

import mysql from "mysql2/promise";

// Environment variables
const DB_CONFIG = {
  host: process.env.TRINITY_DB_HOST || "localhost",
  port: parseInt(process.env.TRINITY_DB_PORT || "3306"),
  user: process.env.TRINITY_DB_USER || "trinity",
  password: process.env.TRINITY_DB_PASSWORD || "",
};

// Database names
const DB_NAMES = {
  world: process.env.TRINITY_DB_WORLD || "world",
  auth: process.env.TRINITY_DB_AUTH || "auth",
  characters: process.env.TRINITY_DB_CHARACTERS || "characters",
};

// Connection pool
let worldPool: mysql.Pool | null = null;
let authPool: mysql.Pool | null = null;
let charactersPool: mysql.Pool | null = null;

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
 * Query world database
 */
export async function queryWorld(sql: string, params?: any[]): Promise<any> {
  const pool = getWorldPool();
  const [rows] = await pool.execute(sql, params);
  return rows;
}

/**
 * Query auth database
 */
export async function queryAuth(sql: string, params?: any[]): Promise<any> {
  const pool = getAuthPool();
  const [rows] = await pool.execute(sql, params);
  return rows;
}

/**
 * Query characters database
 */
export async function queryCharacters(sql: string, params?: any[]): Promise<any> {
  const pool = getCharactersPool();
  const [rows] = await pool.execute(sql, params);
  return rows;
}

/**
 * Close all connections
 */
export async function closeConnections(): Promise<void> {
  if (worldPool) await worldPool.end();
  if (authPool) await authPool.end();
  if (charactersPool) await charactersPool.end();
}
