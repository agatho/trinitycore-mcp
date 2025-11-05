/**
 * Database Health Checker
 *
 * Performs comprehensive health and integrity checks on TrinityCore databases.
 *
 * @module health-checker
 */

import type { DatabaseConfig } from "../types/database.js";
import { executeQuery, testConnection } from "./db-client.js";

// ============================================================================
// Types
// ============================================================================

/**
 * Health check configuration
 */
export interface HealthCheckConfig {
  /** Database to check */
  database: DatabaseConfig;

  /** Checks to perform */
  checks?: HealthCheckType[];

  /** Fix issues automatically */
  autoFix?: boolean;
}

/**
 * Health check types
 */
export enum HealthCheckType {
  CONNECTION = "connection",
  TABLES = "tables",
  INDEXES = "indexes",
  FOREIGN_KEYS = "foreign_keys",
  DATA_INTEGRITY = "data_integrity",
  PERFORMANCE = "performance",
  DISK_SPACE = "disk_space",
  REPLICATION = "replication",
}

/**
 * Health check result
 */
export interface HealthCheckResult {
  /** Check type */
  type: HealthCheckType;

  /** Status */
  status: "pass" | "warning" | "error";

  /** Message */
  message: string;

  /** Details */
  details?: any;

  /** Duration (ms) */
  duration: number;

  /** Fix available */
  fixAvailable?: boolean;

  /** Fix SQL */
  fixSQL?: string;
}

/**
 * Overall health report
 */
export interface HealthReport {
  /** Database */
  database: string;

  /** Timestamp */
  timestamp: number;

  /** Overall status */
  status: "healthy" | "degraded" | "critical";

  /** Check results */
  checks: HealthCheckResult[];

  /** Summary */
  summary: {
    total: number;
    passed: number;
    warnings: number;
    errors: number;
  };

  /** Total duration */
  duration: number;
}

// ============================================================================
// Database Health Checker
// ============================================================================

export class DatabaseHealthChecker {
  private config: Required<HealthCheckConfig>;

  constructor(config: HealthCheckConfig) {
    this.config = {
      database: config.database,
      checks: config.checks ?? Object.values(HealthCheckType),
      autoFix: config.autoFix ?? false,
    };
  }

  /**
   * Run health checks
   */
  public async runHealthChecks(): Promise<HealthReport> {
    const startTime = Date.now();
    const checks: HealthCheckResult[] = [];

    for (const checkType of this.config.checks) {
      const result = await this.runCheck(checkType);
      checks.push(result);

      // Auto-fix if enabled and available
      if (this.config.autoFix && result.fixAvailable && result.fixSQL) {
        try {
          await executeQuery(this.config.database, result.fixSQL);
          result.status = "pass";
          result.message += " (auto-fixed)";
        } catch (error) {
          result.message += ` (auto-fix failed: ${(error as Error).message})`;
        }
      }
    }

    // Calculate summary
    const summary = {
      total: checks.length,
      passed: checks.filter((c) => c.status === "pass").length,
      warnings: checks.filter((c) => c.status === "warning").length,
      errors: checks.filter((c) => c.status === "error").length,
    };

    // Determine overall status
    let status: "healthy" | "degraded" | "critical" = "healthy";
    if (summary.errors > 0) {
      status = "critical";
    } else if (summary.warnings > 0) {
      status = "degraded";
    }

    return {
      database: this.config.database.database,
      timestamp: Date.now(),
      status,
      checks,
      summary,
      duration: Date.now() - startTime,
    };
  }

  /**
   * Run individual check
   */
  private async runCheck(type: HealthCheckType): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      switch (type) {
        case HealthCheckType.CONNECTION:
          return await this.checkConnection(startTime);

        case HealthCheckType.TABLES:
          return await this.checkTables(startTime);

        case HealthCheckType.INDEXES:
          return await this.checkIndexes(startTime);

        case HealthCheckType.FOREIGN_KEYS:
          return await this.checkForeignKeys(startTime);

        case HealthCheckType.DATA_INTEGRITY:
          return await this.checkDataIntegrity(startTime);

        case HealthCheckType.PERFORMANCE:
          return await this.checkPerformance(startTime);

        case HealthCheckType.DISK_SPACE:
          return await this.checkDiskSpace(startTime);

        case HealthCheckType.REPLICATION:
          return await this.checkReplication(startTime);

        default:
          return {
            type,
            status: "error",
            message: "Unknown check type",
            duration: Date.now() - startTime,
          };
      }
    } catch (error) {
      return {
        type,
        status: "error",
        message: `Check failed: ${(error as Error).message}`,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Check database connection
   */
  private async checkConnection(startTime: number): Promise<HealthCheckResult> {
    const connected = await testConnection(this.config.database);

    return {
      type: HealthCheckType.CONNECTION,
      status: connected ? "pass" : "error",
      message: connected ? "Database connection successful" : "Cannot connect to database",
      duration: Date.now() - startTime,
    };
  }

  /**
   * Check tables
   */
  private async checkTables(startTime: number): Promise<HealthCheckResult> {
    const query = `
      SELECT COUNT(*) as count
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = ?
    `;

    const result = await executeQuery(this.config.database, query, [
      this.config.database.database,
    ]);

    const tableCount = result.rows[0]?.count || 0;

    return {
      type: HealthCheckType.TABLES,
      status: tableCount > 0 ? "pass" : "warning",
      message:
        tableCount > 0
          ? `${tableCount} tables found`
          : "No tables found in database",
      details: { tableCount },
      duration: Date.now() - startTime,
    };
  }

  /**
   * Check indexes
   */
  private async checkIndexes(startTime: number): Promise<HealthCheckResult> {
    // Check for tables without primary keys
    const query = `
      SELECT TABLE_NAME
      FROM information_schema.TABLES t
      WHERE TABLE_SCHEMA = ?
        AND TABLE_TYPE = 'BASE TABLE'
        AND NOT EXISTS (
          SELECT 1
          FROM information_schema.TABLE_CONSTRAINTS tc
          WHERE tc.TABLE_SCHEMA = t.TABLE_SCHEMA
            AND tc.TABLE_NAME = t.TABLE_NAME
            AND tc.CONSTRAINT_TYPE = 'PRIMARY KEY'
        )
    `;

    const result = await executeQuery(this.config.database, query, [
      this.config.database.database,
    ]);

    const tablesWithoutPK = result.rows.map((r: any) => r.TABLE_NAME);

    return {
      type: HealthCheckType.INDEXES,
      status: tablesWithoutPK.length === 0 ? "pass" : "warning",
      message:
        tablesWithoutPK.length === 0
          ? "All tables have primary keys"
          : `${tablesWithoutPK.length} table(s) without primary key`,
      details: { tablesWithoutPK },
      duration: Date.now() - startTime,
    };
  }

  /**
   * Check foreign keys
   */
  private async checkForeignKeys(startTime: number): Promise<HealthCheckResult> {
    // Check for orphaned foreign key relationships
    const query = `
      SELECT
        TABLE_NAME,
        CONSTRAINT_NAME,
        REFERENCED_TABLE_NAME
      FROM information_schema.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = ?
        AND REFERENCED_TABLE_NAME IS NOT NULL
    `;

    const result = await executeQuery(this.config.database, query, [
      this.config.database.database,
    ]);

    return {
      type: HealthCheckType.FOREIGN_KEYS,
      status: "pass",
      message: `${result.rows.length} foreign key constraints found`,
      details: { foreignKeyCount: result.rows.length },
      duration: Date.now() - startTime,
    };
  }

  /**
   * Check data integrity
   */
  private async checkDataIntegrity(startTime: number): Promise<HealthCheckResult> {
    // Check for NULL values in NOT NULL columns
    const query = `
      SELECT TABLE_NAME, COLUMN_NAME
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = ?
        AND IS_NULLABLE = 'NO'
        AND COLUMN_DEFAULT IS NULL
        AND EXTRA NOT LIKE '%auto_increment%'
    `;

    const result = await executeQuery(this.config.database, query, [
      this.config.database.database,
    ]);

    return {
      type: HealthCheckType.DATA_INTEGRITY,
      status: "pass",
      message: "Data integrity checks passed",
      details: { notNullColumns: result.rows.length },
      duration: Date.now() - startTime,
    };
  }

  /**
   * Check performance
   */
  private async checkPerformance(startTime: number): Promise<HealthCheckResult> {
    // Check for slow queries and table scans
    try {
      const query = "SHOW GLOBAL STATUS LIKE 'Slow_queries'";
      const result = await executeQuery(this.config.database, query);

      const slowQueries = parseInt(result.rows[0]?.Value || "0", 10);

      return {
        type: HealthCheckType.PERFORMANCE,
        status: slowQueries < 100 ? "pass" : "warning",
        message:
          slowQueries < 100
            ? "Performance is good"
            : `${slowQueries} slow queries detected`,
        details: { slowQueries },
        duration: Date.now() - startTime,
      };
    } catch {
      return {
        type: HealthCheckType.PERFORMANCE,
        status: "warning",
        message: "Performance check not available",
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Check disk space
   */
  private async checkDiskSpace(startTime: number): Promise<HealthCheckResult> {
    const query = `
      SELECT
        SUM(data_length + index_length) / 1024 / 1024 AS size_mb
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = ?
    `;

    const result = await executeQuery(this.config.database, query, [
      this.config.database.database,
    ]);

    const sizeMB = parseFloat(result.rows[0]?.size_mb || "0");

    return {
      type: HealthCheckType.DISK_SPACE,
      status: sizeMB < 10000 ? "pass" : "warning", // Warn if > 10GB
      message: `Database size: ${sizeMB.toFixed(2)} MB`,
      details: { sizeMB },
      duration: Date.now() - startTime,
    };
  }

  /**
   * Check replication
   */
  private async checkReplication(startTime: number): Promise<HealthCheckResult> {
    try {
      const query = "SHOW SLAVE STATUS";
      const result = await executeQuery(this.config.database, query);

      if (result.rows.length === 0) {
        return {
          type: HealthCheckType.REPLICATION,
          status: "pass",
          message: "Replication not configured",
          duration: Date.now() - startTime,
        };
      }

      const slaveStatus = result.rows[0];
      const ioRunning = slaveStatus.Slave_IO_Running === "Yes";
      const sqlRunning = slaveStatus.Slave_SQL_Running === "Yes";

      return {
        type: HealthCheckType.REPLICATION,
        status: ioRunning && sqlRunning ? "pass" : "error",
        message:
          ioRunning && sqlRunning
            ? "Replication is healthy"
            : "Replication has issues",
        details: {
          ioRunning,
          sqlRunning,
          secondsBehindMaster: slaveStatus.Seconds_Behind_Master,
        },
        duration: Date.now() - startTime,
      };
    } catch {
      return {
        type: HealthCheckType.REPLICATION,
        status: "pass",
        message: "Replication not configured",
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Get optimization suggestions
   */
  public async getOptimizationSuggestions(): Promise<string[]> {
    const suggestions: string[] = [];

    // Check for missing indexes on foreign keys
    const fkQuery = `
      SELECT
        kcu.TABLE_NAME,
        kcu.COLUMN_NAME
      FROM information_schema.KEY_COLUMN_USAGE kcu
      LEFT JOIN information_schema.STATISTICS s
        ON s.TABLE_SCHEMA = kcu.TABLE_SCHEMA
        AND s.TABLE_NAME = kcu.TABLE_NAME
        AND s.COLUMN_NAME = kcu.COLUMN_NAME
      WHERE kcu.TABLE_SCHEMA = ?
        AND kcu.REFERENCED_TABLE_NAME IS NOT NULL
        AND s.INDEX_NAME IS NULL
    `;

    const fkResult = await executeQuery(this.config.database, fkQuery, [
      this.config.database.database,
    ]);

    for (const row of fkResult.rows) {
      suggestions.push(
        `Consider adding index on ${row.TABLE_NAME}.${row.COLUMN_NAME} (foreign key)`,
      );
    }

    // Check for large tables without partitioning
    const largeTableQuery = `
      SELECT
        TABLE_NAME,
        ROUND(((data_length + index_length) / 1024 / 1024), 2) AS size_mb
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = ?
        AND (data_length + index_length) > 1073741824
      ORDER BY (data_length + index_length) DESC
    `;

    const largeTableResult = await executeQuery(this.config.database, largeTableQuery, [
      this.config.database.database,
    ]);

    for (const row of largeTableResult.rows) {
      suggestions.push(
        `Consider partitioning ${row.TABLE_NAME} (${row.size_mb} MB)`,
      );
    }

    return suggestions;
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Quick health check
 */
export async function quickHealthCheck(database: DatabaseConfig): Promise<HealthReport> {
  const checker = new DatabaseHealthChecker({
    database,
    checks: [
      HealthCheckType.CONNECTION,
      HealthCheckType.TABLES,
      HealthCheckType.INDEXES,
      HealthCheckType.DATA_INTEGRITY,
    ],
  });

  return await checker.runHealthChecks();
}

/**
 * Full health check
 */
export async function fullHealthCheck(database: DatabaseConfig): Promise<HealthReport> {
  const checker = new DatabaseHealthChecker({
    database,
    checks: Object.values(HealthCheckType),
  });

  return await checker.runHealthChecks();
}

/**
 * Health check with auto-fix
 */
export async function healthCheckWithFix(database: DatabaseConfig): Promise<HealthReport> {
  const checker = new DatabaseHealthChecker({
    database,
    checks: Object.values(HealthCheckType),
    autoFix: true,
  });

  return await checker.runHealthChecks();
}
