/**
 * Advanced Database Pool Manager
 *
 * Enhanced connection pooling with health monitoring, retry logic,
 * metrics tracking, and error handling integration.
 *
 * @module db-pool-manager
 */

import mysql from 'mysql2/promise';
import type { DatabaseConfig } from '../types/database';
import { Logger } from '../../web-ui/lib/logger';
import { DatabaseError } from '../../web-ui/lib/errors';

// ============================================================================
// Types
// ============================================================================

/**
 * Pool configuration options
 */
export interface PoolConfig extends DatabaseConfig {
  /** Minimum connections in pool */
  minConnections?: number;

  /** Maximum connections in pool */
  maxConnections?: number;

  /** Connection timeout in ms */
  connectionTimeout?: number;

  /** Idle timeout in ms */
  idleTimeout?: number;

  /** Query timeout in ms */
  queryTimeout?: number;

  /** Max retry attempts */
  maxRetries?: number;

  /** Retry delay in ms */
  retryDelay?: number;

  /** Enable health check */
  enableHealthCheck?: boolean;

  /** Health check interval in ms */
  healthCheckInterval?: number;
}

/**
 * Pool statistics
 */
export interface PoolStats {
  poolId: string;
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  waitingRequests: number;
  queriesExecuted: number;
  queriesFailed: number;
  averageQueryTime: number;
  uptime: number;
  lastHealthCheck: number | null;
  healthy: boolean;
}

/**
 * Query metrics
 */
interface QueryMetrics {
  totalQueries: number;
  failedQueries: number;
  totalDuration: number;
  startTime: number;
}

/**
 * Enhanced pool wrapper
 */
class ManagedPool {
  private pool: mysql.Pool;
  private config: Required<PoolConfig>;
  private metrics: QueryMetrics;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private healthy: boolean = true;
  private lastHealthCheck: number | null = null;

  constructor(config: PoolConfig) {
    this.config = {
      ...config,
      minConnections: config.minConnections ?? 2,
      maxConnections: config.maxConnections ?? 10,
      connectionTimeout: config.connectionTimeout ?? 10000,
      idleTimeout: config.idleTimeout ?? 60000,
      queryTimeout: config.queryTimeout ?? 30000,
      maxRetries: config.maxRetries ?? 3,
      retryDelay: config.retryDelay ?? 1000,
      enableHealthCheck: config.enableHealthCheck ?? true,
      healthCheckInterval: config.healthCheckInterval ?? 30000,
    };

    this.metrics = {
      totalQueries: 0,
      failedQueries: 0,
      totalDuration: 0,
      startTime: Date.now(),
    };

    this.pool = this.createPool();
    this.setupEventHandlers();

    if (this.config.enableHealthCheck) {
      this.startHealthCheck();
    }

    Logger.info('DBPool', `Pool created for ${this.getPoolId()}`, {
      maxConnections: this.config.maxConnections,
      minConnections: this.config.minConnections,
    });
  }

  /**
   * Create MySQL pool
   */
  private createPool(): mysql.Pool {
    return mysql.createPool({
      host: this.config.host,
      port: this.config.port,
      user: this.config.user,
      password: this.config.password,
      database: this.config.database,
      waitForConnections: true,
      connectionLimit: this.config.maxConnections,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 10000,
      connectTimeout: this.config.connectionTimeout,
    });
  }

  /**
   * Setup pool event handlers
   */
  private setupEventHandlers(): void {
    this.pool.on('connection', (connection) => {
      Logger.debug('DBPool', `New connection created for ${this.getPoolId()}`);

      // Set session variables if needed
      connection.query('SET SESSION sql_mode = "TRADITIONAL"', (err) => {
        if (err) {
          Logger.warn('DBPool', 'Failed to set SQL mode', { error: err.message });
        }
      });
    });

    this.pool.on('acquire', () => {
      Logger.debug('DBPool', `Connection acquired from ${this.getPoolId()}`);
    });

    this.pool.on('release', () => {
      Logger.debug('DBPool', `Connection released to ${this.getPoolId()}`);
    });

    this.pool.on('enqueue', () => {
      Logger.debug('DBPool', `Connection request queued for ${this.getPoolId()}`);
    });
  }

  /**
   * Get pool identifier
   */
  private getPoolId(): string {
    return `${this.config.host}:${this.config.port}/${this.config.database}`;
  }

  /**
   * Execute query with retry logic
   */
  async executeQuery<T = any>(
    query: string,
    params: any[] = [],
    retries: number = this.config.maxRetries
  ): Promise<T> {
    const startTime = Date.now();

    try {
      const [rows] = await this.pool.execute(query, params);

      const duration = Date.now() - startTime;
      this.recordQuerySuccess(duration);

      Logger.debug('DBPool', `Query executed successfully`, {
        poolId: this.getPoolId(),
        duration,
        query: query.substring(0, 100),
      });

      return rows as T;
    } catch (error: any) {
      this.recordQueryFailure();

      // Check if we should retry
      if (retries > 0 && this.isRetryableError(error)) {
        Logger.warn('DBPool', `Query failed, retrying... (${retries} attempts left)`, {
          error: error.message,
          query: query.substring(0, 100),
        });

        await this.delay(this.config.retryDelay);
        return this.executeQuery(query, params, retries - 1);
      }

      // Log and throw wrapped error
      Logger.error('DBPool', error, {
        poolId: this.getPoolId(),
        query: query.substring(0, 100),
        params,
      });

      throw new DatabaseError(
        'query execution',
        error.message,
        error.sqlState || error.code
      );
    }
  }

  /**
   * Execute batch queries in transaction
   */
  async executeBatch(
    queries: Array<{ query: string; params?: any[] }>
  ): Promise<any[]> {
    const connection = await this.pool.getConnection();
    const results: any[] = [];

    try {
      await connection.beginTransaction();
      Logger.debug('DBPool', 'Transaction started', {
        poolId: this.getPoolId(),
        queries: queries.length,
      });

      for (const { query, params = [] } of queries) {
        const startTime = Date.now();
        const [rows] = await connection.execute(query, params);
        results.push(rows);
        this.recordQuerySuccess(Date.now() - startTime);
      }

      await connection.commit();
      Logger.info('DBPool', 'Transaction committed', {
        poolId: this.getPoolId(),
        queries: queries.length,
      });

      return results;
    } catch (error: any) {
      await connection.rollback();
      this.recordQueryFailure();

      Logger.error('DBPool', error, {
        poolId: this.getPoolId(),
        operation: 'batch transaction',
      });

      throw new DatabaseError(
        'batch transaction',
        error.message,
        error.sqlState || error.code
      );
    } finally {
      connection.release();
    }
  }

  /**
   * Execute with custom transaction handler
   */
  async executeTransaction<T>(
    callback: (connection: mysql.PoolConnection) => Promise<T>
  ): Promise<T> {
    const connection = await this.pool.getConnection();

    try {
      await connection.beginTransaction();
      Logger.debug('DBPool', 'Custom transaction started', {
        poolId: this.getPoolId(),
      });

      const result = await callback(connection);
      await connection.commit();

      Logger.info('DBPool', 'Custom transaction committed', {
        poolId: this.getPoolId(),
      });

      return result;
    } catch (error: any) {
      await connection.rollback();

      Logger.error('DBPool', error, {
        poolId: this.getPoolId(),
        operation: 'custom transaction',
      });

      throw new DatabaseError(
        'custom transaction',
        error.message,
        error.sqlState || error.code
      );
    } finally {
      connection.release();
    }
  }

  /**
   * Health check
   */
  async checkHealth(): Promise<boolean> {
    try {
      const connection = await this.pool.getConnection();
      await connection.ping();
      connection.release();

      this.healthy = true;
      this.lastHealthCheck = Date.now();

      Logger.debug('DBPool', `Health check passed for ${this.getPoolId()}`);
      return true;
    } catch (error: any) {
      this.healthy = false;
      this.lastHealthCheck = Date.now();

      Logger.error('DBPool', error, {
        poolId: this.getPoolId(),
        operation: 'health check',
      });

      return false;
    }
  }

  /**
   * Start periodic health checks
   */
  private startHealthCheck(): void {
    this.healthCheckInterval = setInterval(async () => {
      await this.checkHealth();
    }, this.config.healthCheckInterval);
  }

  /**
   * Stop health checks
   */
  private stopHealthCheck(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  /**
   * Get pool statistics
   */
  getStats(): PoolStats {
    const uptime = Date.now() - this.metrics.startTime;
    const averageQueryTime =
      this.metrics.totalQueries > 0
        ? this.metrics.totalDuration / this.metrics.totalQueries
        : 0;

    return {
      poolId: this.getPoolId(),
      totalConnections: this.config.maxConnections,
      activeConnections: (this.pool as any)._allConnections?.length || 0,
      idleConnections: (this.pool as any)._freeConnections?.length || 0,
      waitingRequests: (this.pool as any)._connectionQueue?.length || 0,
      queriesExecuted: this.metrics.totalQueries,
      queriesFailed: this.metrics.failedQueries,
      averageQueryTime,
      uptime,
      lastHealthCheck: this.lastHealthCheck,
      healthy: this.healthy,
    };
  }

  /**
   * Close pool
   */
  async close(): Promise<void> {
    this.stopHealthCheck();

    try {
      await this.pool.end();
      Logger.info('DBPool', `Pool closed for ${this.getPoolId()}`);
    } catch (error: any) {
      Logger.error('DBPool', error, {
        poolId: this.getPoolId(),
        operation: 'close pool',
      });
      throw error;
    }
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: any): boolean {
    const retryableCodes = [
      'PROTOCOL_CONNECTION_LOST',
      'ECONNRESET',
      'ETIMEDOUT',
      'ENOTFOUND',
      'ER_LOCK_WAIT_TIMEOUT',
      'ER_LOCK_DEADLOCK',
    ];

    return retryableCodes.includes(error.code);
  }

  /**
   * Record successful query
   */
  private recordQuerySuccess(duration: number): void {
    this.metrics.totalQueries++;
    this.metrics.totalDuration += duration;
  }

  /**
   * Record failed query
   */
  private recordQueryFailure(): void {
    this.metrics.totalQueries++;
    this.metrics.failedQueries++;
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get raw pool (for advanced usage)
   */
  getRawPool(): mysql.Pool {
    return this.pool;
  }
}

// ============================================================================
// Pool Manager
// ============================================================================

/**
 * Global pool manager
 */
export class DatabasePoolManager {
  private pools: Map<string, ManagedPool> = new Map();

  /**
   * Get or create pool
   */
  getPool(config: PoolConfig): ManagedPool {
    const key = `${config.host}:${config.port}:${config.database}`;

    if (!this.pools.has(key)) {
      const pool = new ManagedPool(config);
      this.pools.set(key, pool);
    }

    return this.pools.get(key)!;
  }

  /**
   * Close specific pool
   */
  async closePool(config: DatabaseConfig): Promise<void> {
    const key = `${config.host}:${config.port}:${config.database}`;
    const pool = this.pools.get(key);

    if (pool) {
      await pool.close();
      this.pools.delete(key);
    }
  }

  /**
   * Close all pools
   */
  async closeAllPools(): Promise<void> {
    const closePromises = Array.from(this.pools.values()).map(pool => pool.close());
    await Promise.all(closePromises);
    this.pools.clear();

    Logger.info('DBPool', 'All pools closed');
  }

  /**
   * Get statistics for all pools
   */
  getAllStats(): PoolStats[] {
    return Array.from(this.pools.values()).map(pool => pool.getStats());
  }

  /**
   * Health check all pools
   */
  async checkAllPools(): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();

    for (const [key, pool] of this.pools.entries()) {
      const healthy = await pool.checkHealth();
      results.set(key, healthy);
    }

    return results;
  }

  /**
   * Get pool count
   */
  getPoolCount(): number {
    return this.pools.size;
  }
}

// Singleton instance
let poolManager: DatabasePoolManager | null = null;

/**
 * Get pool manager instance
 */
export function getPoolManager(): DatabasePoolManager {
  if (!poolManager) {
    poolManager = new DatabasePoolManager();
  }
  return poolManager;
}

/**
 * Reset pool manager (for testing)
 */
export async function resetPoolManager(): Promise<void> {
  if (poolManager) {
    await poolManager.closeAllPools();
  }
  poolManager = null;
}
