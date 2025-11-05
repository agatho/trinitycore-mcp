/**
 * Database Type Definitions
 *
 * Type definitions for TrinityCore database operations.
 *
 * @module types/database
 */

/**
 * Database configuration
 */
export interface DatabaseConfig {
  /** MySQL/MariaDB host */
  host: string;

  /** MySQL/MariaDB port */
  port: number;

  /** Database name */
  database: string;

  /** Username */
  user: string;

  /** Password */
  password: string;
}

/**
 * TrinityCore database types
 */
export enum DatabaseType {
  WORLD = "world",
  CHARACTERS = "characters",
  AUTH = "auth",
}

/**
 * Database connection info
 */
export interface DatabaseConnectionInfo {
  type: DatabaseType;
  config: DatabaseConfig;
  connected: boolean;
  lastError?: string;
}
