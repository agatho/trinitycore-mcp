/**
 * Database Pool Manager Tests
 *
 * Unit tests for enhanced database connection pooling
 */

import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import {
  DatabasePoolManager,
  getPoolManager,
  resetPoolManager,
  type PoolConfig,
} from '@src/database/db-pool-manager';
import { Logger } from '@/lib/logger';

// Mock mysql2/promise
vi.mock('mysql2/promise', () => {
  const mockConnection = {
    execute: vi.fn().mockResolvedValue([[], []]),
    query: vi.fn(),
    ping: vi.fn().mockResolvedValue(undefined),
    beginTransaction: vi.fn().mockResolvedValue(undefined),
    commit: vi.fn().mockResolvedValue(undefined),
    rollback: vi.fn().mockResolvedValue(undefined),
    release: vi.fn(),
  };

  const mockPool = {
    execute: vi.fn().mockResolvedValue([[], []]),
    getConnection: vi.fn().mockResolvedValue(mockConnection),
    end: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
    _allConnections: [],
    _freeConnections: [],
    _connectionQueue: [],
  };

  return {
    default: {
      createPool: vi.fn().mockReturnValue(mockPool),
    },
  };
});

describe('Database Pool Manager', () => {
  let poolManager: DatabasePoolManager;
  let testConfig: PoolConfig;

  beforeEach(async () => {
    // Reset pool manager and logger
    await resetPoolManager();
    Logger.reset();
    Logger.configure({ enableConsole: false });

    poolManager = getPoolManager();
    testConfig = {
      host: 'localhost',
      port: 3306,
      user: 'test_user',
      password: 'test_pass',
      database: 'test_db',
      maxConnections: 5,
      minConnections: 1,
      enableHealthCheck: false, // Disable for tests
    };
  });

  afterEach(async () => {
    await resetPoolManager();
    vi.clearAllMocks();
  });

  describe('Pool Creation', () => {
    it('should create a new pool', () => {
      const pool = poolManager.getPool(testConfig);
      expect(pool).toBeDefined();
      expect(poolManager.getPoolCount()).toBe(1);
    });

    it('should reuse existing pool for same config', () => {
      const pool1 = poolManager.getPool(testConfig);
      const pool2 = poolManager.getPool(testConfig);

      expect(pool1).toBe(pool2);
      expect(poolManager.getPoolCount()).toBe(1);
    });

    it('should create different pools for different databases', () => {
      const pool1 = poolManager.getPool(testConfig);
      const pool2 = poolManager.getPool({ ...testConfig, database: 'other_db' });

      expect(pool1).not.toBe(pool2);
      expect(poolManager.getPoolCount()).toBe(2);
    });

    it('should log pool creation', () => {
      poolManager.getPool(testConfig);

      const logs = Logger.getLogs({ context: 'DBPool' });
      expect(logs.some(log => log.message.includes('Pool created'))).toBe(true);
    });
  });

  describe('Query Execution', () => {
    it('should execute query successfully', async () => {
      const pool = poolManager.getPool(testConfig);
      const result = await pool.executeQuery('SELECT 1');

      expect(result).toBeDefined();
    });

    it('should execute query with parameters', async () => {
      const pool = poolManager.getPool(testConfig);
      const result = await pool.executeQuery('SELECT * FROM users WHERE id = ?', [1]);

      expect(result).toBeDefined();
    });

    it('should log successful query execution', async () => {
      const pool = poolManager.getPool(testConfig);
      await pool.executeQuery('SELECT 1');

      const logs = Logger.getLogs({ context: 'DBPool' });
      expect(logs.some(log => log.message.includes('Query executed successfully'))).toBe(true);
    });

    it('should handle query errors', async () => {
      const pool = poolManager.getPool(testConfig);
      const rawPool = pool.getRawPool();

      // Mock error
      (rawPool.execute as any).mockRejectedValueOnce(new Error('Query failed'));

      await expect(pool.executeQuery('SELECT invalid')).rejects.toThrow();
    });

    it('should retry on retryable errors', async () => {
      const pool = poolManager.getPool({ ...testConfig, maxRetries: 2, retryDelay: 10 });
      const rawPool = pool.getRawPool();

      let callCount = 0;
      (rawPool.execute as any).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          const error: any = new Error('Connection lost');
          error.code = 'PROTOCOL_CONNECTION_LOST';
          throw error;
        }
        return Promise.resolve([[], []]);
      });

      const result = await pool.executeQuery('SELECT 1');
      expect(result).toBeDefined();
      expect(callCount).toBe(2); // Initial + 1 retry
    });
  });

  describe('Batch Execution', () => {
    it('should execute batch queries in transaction', async () => {
      const pool = poolManager.getPool(testConfig);
      const queries = [
        { query: 'INSERT INTO users (name) VALUES (?)', params: ['Alice'] },
        { query: 'INSERT INTO users (name) VALUES (?)', params: ['Bob'] },
      ];

      const results = await pool.executeBatch(queries);
      expect(results).toHaveLength(2);
    });

    it('should rollback on batch error', async () => {
      const pool = poolManager.getPool(testConfig);
      const rawPool = pool.getRawPool();
      const mockConnection = await rawPool.getConnection();

      // Mock error on second query
      let executeCount = 0;
      (mockConnection.execute as any).mockImplementation(() => {
        executeCount++;
        if (executeCount === 2) {
          throw new Error('Batch query failed');
        }
        return Promise.resolve([[], []]);
      });

      const queries = [
        { query: 'INSERT INTO users (name) VALUES (?)', params: ['Alice'] },
        { query: 'INSERT INTO invalid', params: [] },
      ];

      await expect(pool.executeBatch(queries)).rejects.toThrow();
      expect(mockConnection.rollback).toHaveBeenCalled();
    });

    it('should commit successful batch', async () => {
      const pool = poolManager.getPool(testConfig);
      const rawPool = pool.getRawPool();
      const mockConnection = await rawPool.getConnection();

      const queries = [
        { query: 'INSERT INTO users (name) VALUES (?)', params: ['Alice'] },
      ];

      await pool.executeBatch(queries);
      expect(mockConnection.commit).toHaveBeenCalled();
    });
  });

  describe('Custom Transactions', () => {
    it('should execute custom transaction', async () => {
      const pool = poolManager.getPool(testConfig);

      const result = await pool.executeTransaction(async (conn) => {
        await conn.execute('INSERT INTO users (name) VALUES (?)', ['Alice']);
        return 'success';
      });

      expect(result).toBe('success');
    });

    it('should rollback failed transaction', async () => {
      const pool = poolManager.getPool(testConfig);
      const rawPool = pool.getRawPool();
      const mockConnection = await rawPool.getConnection();

      await expect(
        pool.executeTransaction(async () => {
          throw new Error('Transaction failed');
        })
      ).rejects.toThrow();

      expect(mockConnection.rollback).toHaveBeenCalled();
    });

    it('should commit successful transaction', async () => {
      const pool = poolManager.getPool(testConfig);
      const rawPool = pool.getRawPool();
      const mockConnection = await rawPool.getConnection();

      await pool.executeTransaction(async (conn) => {
        await conn.execute('SELECT 1');
      });

      expect(mockConnection.commit).toHaveBeenCalled();
    });
  });

  describe('Health Checks', () => {
    it('should perform health check successfully', async () => {
      const pool = poolManager.getPool(testConfig);
      const healthy = await pool.checkHealth();

      expect(healthy).toBe(true);
    });

    it('should detect unhealthy pool', async () => {
      const pool = poolManager.getPool(testConfig);
      const rawPool = pool.getRawPool();
      const mockConnection = await rawPool.getConnection();

      // Mock ping failure
      (mockConnection.ping as any).mockRejectedValueOnce(new Error('Ping failed'));

      const healthy = await pool.checkHealth();
      expect(healthy).toBe(false);
    });

    it('should check health of all pools', async () => {
      poolManager.getPool(testConfig);
      poolManager.getPool({ ...testConfig, database: 'other_db' });

      const results = await poolManager.checkAllPools();
      expect(results.size).toBe(2);
      expect(Array.from(results.values()).every(h => h === true)).toBe(true);
    });
  });

  describe('Pool Statistics', () => {
    it('should return pool statistics', () => {
      const pool = poolManager.getPool(testConfig);
      const stats = pool.getStats();

      expect(stats.poolId).toContain('localhost');
      expect(stats.totalConnections).toBe(5);
      expect(stats.queriesExecuted).toBe(0);
      expect(stats.queriesFailed).toBe(0);
      expect(stats.uptime).toBeGreaterThanOrEqual(0);
    });

    it('should update stats after query execution', async () => {
      const pool = poolManager.getPool(testConfig);
      await pool.executeQuery('SELECT 1');

      const stats = pool.getStats();
      expect(stats.queriesExecuted).toBe(1);
      expect(stats.queriesFailed).toBe(0);
      expect(stats.averageQueryTime).toBeGreaterThanOrEqual(0);
    });

    it('should track failed queries', async () => {
      const pool = poolManager.getPool(testConfig);
      const rawPool = pool.getRawPool();

      // Mock error
      (rawPool.execute as any).mockRejectedValueOnce(new Error('Query failed'));

      try {
        await pool.executeQuery('SELECT invalid');
      } catch (e) {
        // Expected error
      }

      const stats = pool.getStats();
      expect(stats.queriesExecuted).toBe(1);
      expect(stats.queriesFailed).toBe(1);
    });

    it('should return stats for all pools', () => {
      poolManager.getPool(testConfig);
      poolManager.getPool({ ...testConfig, database: 'other_db' });

      const allStats = poolManager.getAllStats();
      expect(allStats).toHaveLength(2);
    });
  });

  describe('Pool Lifecycle', () => {
    it('should close specific pool', async () => {
      const pool = poolManager.getPool(testConfig);
      await poolManager.closePool(testConfig);

      expect(poolManager.getPoolCount()).toBe(0);
    });

    it('should close all pools', async () => {
      poolManager.getPool(testConfig);
      poolManager.getPool({ ...testConfig, database: 'other_db' });

      expect(poolManager.getPoolCount()).toBe(2);

      await poolManager.closeAllPools();

      expect(poolManager.getPoolCount()).toBe(0);
    });

    it('should log pool closure', async () => {
      const pool = poolManager.getPool(testConfig);
      await pool.close();

      const logs = Logger.getLogs({ context: 'DBPool' });
      expect(logs.some(log => log.message.includes('Pool closed'))).toBe(true);
    });
  });

  describe('Configuration', () => {
    it('should use default config values', () => {
      const minimalConfig: PoolConfig = {
        host: 'localhost',
        port: 3306,
        user: 'user',
        password: 'pass',
        database: 'db',
      };

      const pool = poolManager.getPool(minimalConfig);
      const stats = pool.getStats();

      expect(stats.totalConnections).toBe(10); // Default maxConnections
    });

    it('should respect custom config values', () => {
      const customConfig: PoolConfig = {
        host: 'localhost',
        port: 3306,
        user: 'user',
        password: 'pass',
        database: 'db',
        maxConnections: 20,
        minConnections: 5,
      };

      const pool = poolManager.getPool(customConfig);
      const stats = pool.getStats();

      expect(stats.totalConnections).toBe(20);
    });
  });

  describe('Error Handling', () => {
    it('should integrate with error logging system', async () => {
      const pool = poolManager.getPool(testConfig);
      const rawPool = pool.getRawPool();

      // Mock error
      (rawPool.execute as any).mockRejectedValueOnce(new Error('Database error'));

      try {
        await pool.executeQuery('SELECT invalid');
      } catch (e) {
        // Expected
      }

      const errorLogs = Logger.getLogs().filter(log => log.error);
      expect(errorLogs.length).toBeGreaterThan(0);
    });

    it('should throw DatabaseError on query failure', async () => {
      const pool = poolManager.getPool(testConfig);
      const rawPool = pool.getRawPool();

      (rawPool.execute as any).mockRejectedValueOnce(new Error('Query failed'));

      await expect(pool.executeQuery('SELECT invalid')).rejects.toThrow('Database query execution failed');
    });
  });

  describe('Singleton Manager', () => {
    it('should return same manager instance', () => {
      const manager1 = getPoolManager();
      const manager2 = getPoolManager();

      expect(manager1).toBe(manager2);
    });

    it('should reset manager', async () => {
      const manager1 = getPoolManager();
      manager1.getPool(testConfig);

      await resetPoolManager();

      const manager2 = getPoolManager();
      expect(manager2.getPoolCount()).toBe(0);
    });
  });
});
