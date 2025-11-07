/**
 * Multi-Server Database Sync Engine
 *
 * Synchronizes database changes between multiple TrinityCore servers
 * with conflict resolution and change tracking.
 *
 * @module sync-engine
 */

import type { DatabaseConfig } from "../types/database";
import { executeQuery, executeBatch, executeTransaction } from "./db-client";
import { EventEmitter } from "events";

// ============================================================================
// Types
// ============================================================================

/**
 * Sync configuration
 */
export interface SyncConfig {
  /** Source database */
  source: DatabaseConfig;

  /** Target database(s) */
  targets: DatabaseConfig[];

  /** Tables to sync */
  tables?: string[];

  /** Sync direction */
  direction?: SyncDirection;

  /** Conflict resolution strategy */
  conflictResolution?: ConflictStrategy;

  /** Sync interval (ms) for continuous sync */
  syncInterval?: number;

  /** Batch size */
  batchSize?: number;

  /** Enable change tracking */
  changeTracking?: boolean;
}

/**
 * Sync direction
 */
export enum SyncDirection {
  ONE_WAY = "one-way", // Source -> Targets
  BIDIRECTIONAL = "bidirectional", // Both ways
}

/**
 * Conflict resolution strategy
 */
export enum ConflictStrategy {
  SOURCE_WINS = "source-wins",
  TARGET_WINS = "target-wins",
  NEWEST_WINS = "newest-wins",
  MANUAL = "manual",
}

/**
 * Sync result
 */
export interface SyncResult {
  success: boolean;
  tablessynced: number;
  rowsSynced: number;
  conflicts: SyncConflict[];
  errors: string[];
  duration: number;
  timestamp: number;
}

/**
 * Sync conflict
 */
export interface SyncConflict {
  table: string;
  primaryKey: Record<string, any>;
  sourceValue: Record<string, any>;
  targetValue: Record<string, any>;
  resolution?: "source" | "target" | "manual";
}

/**
 * Change record
 */
export interface ChangeRecord {
  table: string;
  operation: "INSERT" | "UPDATE" | "DELETE";
  primaryKey: Record<string, any>;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  timestamp: number;
  synced: boolean;
}

// ============================================================================
// Sync Engine
// ============================================================================

export class DatabaseSyncEngine extends EventEmitter {
  private config: Required<SyncConfig>;
  private syncTimer: NodeJS.Timeout | null = null;
  private isSyncing = false;
  private changeLog: Map<string, ChangeRecord[]> = new Map();

  constructor(config: SyncConfig) {
    super();

    this.config = {
      source: config.source,
      targets: config.targets,
      tables: config.tables ?? [],
      direction: config.direction ?? SyncDirection.ONE_WAY,
      conflictResolution: config.conflictResolution ?? ConflictStrategy.NEWEST_WINS,
      syncInterval: config.syncInterval ?? 0, // 0 = manual only
      batchSize: config.batchSize ?? 1000,
      changeTracking: config.changeTracking ?? true,
    };
  }

  /**
   * Start continuous sync
   */
  public startContinuousSync(): void {
    if (this.syncTimer) {
      throw new Error("Continuous sync already running");
    }

    if (this.config.syncInterval === 0) {
      throw new Error("Sync interval not configured");
    }

    this.syncTimer = setInterval(() => {
      this.syncOnce().catch((error) => {
        this.emit("error", error);
      });
    }, this.config.syncInterval);

    this.emit("started");
  }

  /**
   * Stop continuous sync
   */
  public stopContinuousSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
      this.emit("stopped");
    }
  }

  /**
   * Perform one-time sync
   */
  public async syncOnce(): Promise<SyncResult> {
    if (this.isSyncing) {
      throw new Error("Sync already in progress");
    }

    this.isSyncing = true;
    const startTime = Date.now();

    try {
      const results: SyncResult[] = [];

      // Sync to each target
      for (const target of this.config.targets) {
        const result = await this.syncToTarget(target);
        results.push(result);
      }

      // Aggregate results
      const aggregated: SyncResult = {
        success: results.every((r) => r.success),
        tablessynced: Math.max(...results.map((r) => r.tablessynced)),
        rowsSynced: results.reduce((sum, r) => sum + r.rowsSynced, 0),
        conflicts: results.flatMap((r) => r.conflicts),
        errors: results.flatMap((r) => r.errors),
        duration: Date.now() - startTime,
        timestamp: Date.now(),
      };

      this.emit("synced", aggregated);
      return aggregated;
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Sync to target database
   */
  private async syncToTarget(target: DatabaseConfig): Promise<SyncResult> {
    const conflicts: SyncConflict[] = [];
    const errors: string[] = [];
    let tablessynced = 0;
    let rowsSynced = 0;

    try {
      // Get tables to sync
      const tables = await this.getTablesToSync();

      for (const table of tables) {
        try {
          const result = await this.syncTable(table, target);
          rowsSynced += result.rowsSynced;
          conflicts.push(...result.conflicts);
          tablessynced++;
        } catch (error) {
          errors.push(`Error syncing table ${table}: ${(error as Error).message}`);
        }
      }

      return {
        success: errors.length === 0,
        tablessynced,
        rowsSynced,
        conflicts,
        errors,
        duration: 0,
        timestamp: Date.now(),
      };
    } catch (error) {
      return {
        success: false,
        tablessynced: 0,
        rowsSynced: 0,
        conflicts: [],
        errors: [(error as Error).message],
        duration: 0,
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Get tables to sync
   */
  private async getTablesToSync(): Promise<string[]> {
    if (this.config.tables.length > 0) {
      return this.config.tables;
    }

    // Get all tables from source
    const query = `
      SELECT TABLE_NAME
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = ?
      ORDER BY TABLE_NAME
    `;

    const result = await executeQuery(this.config.source, query, [
      this.config.source.database,
    ]);

    return result.rows.map((row: any) => row.TABLE_NAME);
  }

  /**
   * Sync table
   */
  private async syncTable(
    table: string,
    target: DatabaseConfig,
  ): Promise<{ rowsSynced: number; conflicts: SyncConflict[] }> {
    const conflicts: SyncConflict[] = [];
    let rowsSynced = 0;

    // Get primary key columns
    const pkColumns = await this.getPrimaryKeyColumns(table);

    if (pkColumns.length === 0) {
      throw new Error(`Table ${table} has no primary key`);
    }

    // Get source data
    const sourceData = await this.getTableData(this.config.source, table);

    // Get target data
    const targetData = await this.getTableData(target, table);

    // Build maps for efficient lookup
    const sourceMap = new Map<string, Record<string, any>>();
    for (const row of sourceData) {
      const key = this.buildPrimaryKey(row, pkColumns);
      sourceMap.set(key, row);
    }

    const targetMap = new Map<string, Record<string, any>>();
    for (const row of targetData) {
      const key = this.buildPrimaryKey(row, pkColumns);
      targetMap.set(key, row);
    }

    // Find differences
    const toInsert: Record<string, any>[] = [];
    const toUpdate: Array<{ key: string; row: Record<string, any> }> = [];

    for (const [key, sourceRow] of sourceMap.entries()) {
      if (!targetMap.has(key)) {
        // Row exists in source but not in target - INSERT
        toInsert.push(sourceRow);
      } else {
        // Row exists in both - check for differences
        const targetRow = targetMap.get(key)!;

        if (!this.rowsEqual(sourceRow, targetRow)) {
          // Rows differ - handle conflict
          const conflict = await this.resolveConflict(
            table,
            pkColumns,
            sourceRow,
            targetRow,
          );

          if (conflict.resolution === "source") {
            toUpdate.push({ key, row: sourceRow });
          } else if (conflict.resolution === "manual") {
            conflicts.push(conflict);
          }
          // If "target", do nothing
        }
      }
    }

    // Handle deletes (if bidirectional)
    const toDelete: string[] = [];
    if (this.config.direction === SyncDirection.BIDIRECTIONAL) {
      for (const key of targetMap.keys()) {
        if (!sourceMap.has(key)) {
          toDelete.push(key);
        }
      }
    }

    // Apply changes to target
    if (toInsert.length > 0) {
      await this.insertRows(target, table, toInsert);
      rowsSynced += toInsert.length;
    }

    if (toUpdate.length > 0) {
      await this.updateRows(target, table, pkColumns, toUpdate);
      rowsSynced += toUpdate.length;
    }

    if (toDelete.length > 0) {
      await this.deleteRows(target, table, pkColumns, toDelete);
      rowsSynced += toDelete.length;
    }

    return { rowsSynced, conflicts };
  }

  /**
   * Get primary key columns
   */
  private async getPrimaryKeyColumns(table: string): Promise<string[]> {
    const query = `
      SELECT COLUMN_NAME
      FROM information_schema.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = ?
        AND TABLE_NAME = ?
        AND CONSTRAINT_NAME = 'PRIMARY'
      ORDER BY ORDINAL_POSITION
    `;

    const result = await executeQuery(this.config.source, query, [
      this.config.source.database,
      table,
    ]);

    return result.rows.map((row: any) => row.COLUMN_NAME);
  }

  /**
   * Get table data
   */
  private async getTableData(
    database: DatabaseConfig,
    table: string,
  ): Promise<Record<string, any>[]> {
    const query = `SELECT * FROM \`${table}\``;
    const result = await executeQuery(database, query);
    return result.rows;
  }

  /**
   * Build primary key string
   */
  private buildPrimaryKey(row: Record<string, any>, pkColumns: string[]): string {
    return pkColumns.map((col) => String(row[col])).join(":");
  }

  /**
   * Check if rows are equal
   */
  private rowsEqual(row1: Record<string, any>, row2: Record<string, any>): boolean {
    const keys1 = Object.keys(row1).sort();
    const keys2 = Object.keys(row2).sort();

    if (keys1.length !== keys2.length) return false;

    for (const key of keys1) {
      if (row1[key] !== row2[key]) return false;
    }

    return true;
  }

  /**
   * Resolve conflict
   */
  private async resolveConflict(
    table: string,
    pkColumns: string[],
    sourceRow: Record<string, any>,
    targetRow: Record<string, any>,
  ): Promise<SyncConflict> {
    const primaryKey: Record<string, any> = {};
    for (const col of pkColumns) {
      primaryKey[col] = sourceRow[col];
    }

    let resolution: "source" | "target" | "manual" = "manual";

    switch (this.config.conflictResolution) {
      case ConflictStrategy.SOURCE_WINS:
        resolution = "source";
        break;

      case ConflictStrategy.TARGET_WINS:
        resolution = "target";
        break;

      case ConflictStrategy.NEWEST_WINS:
        // Check if there's a timestamp column
        const sourceTime = this.getTimestamp(sourceRow);
        const targetTime = this.getTimestamp(targetRow);

        if (sourceTime && targetTime) {
          resolution = sourceTime > targetTime ? "source" : "target";
        } else {
          resolution = "source"; // Default to source if no timestamp
        }
        break;

      case ConflictStrategy.MANUAL:
        resolution = "manual";
        break;
    }

    return {
      table,
      primaryKey,
      sourceValue: sourceRow,
      targetValue: targetRow,
      resolution,
    };
  }

  /**
   * Get timestamp from row
   */
  private getTimestamp(row: Record<string, any>): number | null {
    // Common timestamp column names
    const timestampCols = ["updated_at", "modified_at", "timestamp", "updated", "modified"];

    for (const col of timestampCols) {
      if (row[col]) {
        const time = new Date(row[col]).getTime();
        if (!isNaN(time)) return time;
      }
    }

    return null;
  }

  /**
   * Insert rows
   */
  private async insertRows(
    database: DatabaseConfig,
    table: string,
    rows: Record<string, any>[],
  ): Promise<void> {
    if (rows.length === 0) return;

    const columns = Object.keys(rows[0]);
    const placeholders = columns.map(() => "?").join(", ");
    const query = `INSERT INTO \`${table}\` (\`${columns.join("`, `")}\`) VALUES (${placeholders})`;

    for (let i = 0; i < rows.length; i += this.config.batchSize) {
      const batch = rows.slice(i, i + this.config.batchSize);
      const queries = batch.map((row) => ({
        query,
        params: columns.map((col) => row[col]),
      }));

      await executeBatch(database, queries);
    }
  }

  /**
   * Update rows
   */
  private async updateRows(
    database: DatabaseConfig,
    table: string,
    pkColumns: string[],
    rows: Array<{ key: string; row: Record<string, any> }>,
  ): Promise<void> {
    if (rows.length === 0) return;

    for (const { row } of rows) {
      const columns = Object.keys(row).filter((col) => !pkColumns.includes(col));
      const setClause = columns.map((col) => `\`${col}\` = ?`).join(", ");
      const whereClause = pkColumns.map((col) => `\`${col}\` = ?`).join(" AND ");

      const query = `UPDATE \`${table}\` SET ${setClause} WHERE ${whereClause}`;
      const params = [
        ...columns.map((col) => row[col]),
        ...pkColumns.map((col) => row[col]),
      ];

      await executeQuery(database, query, params);
    }
  }

  /**
   * Delete rows
   */
  private async deleteRows(
    database: DatabaseConfig,
    table: string,
    pkColumns: string[],
    keys: string[],
  ): Promise<void> {
    if (keys.length === 0) return;

    const whereClause = pkColumns.map((col) => `\`${col}\` = ?`).join(" AND ");
    const query = `DELETE FROM \`${table}\` WHERE ${whereClause}`;

    for (const key of keys) {
      const values = key.split(":");
      await executeQuery(database, query, values);
    }
  }

  /**
   * Record change
   */
  public recordChange(change: ChangeRecord): void {
    if (!this.config.changeTracking) return;

    const table = change.table;
    if (!this.changeLog.has(table)) {
      this.changeLog.set(table, []);
    }

    this.changeLog.get(table)!.push(change);
  }

  /**
   * Get change log
   */
  public getChangeLog(table?: string): ChangeRecord[] {
    if (table) {
      return this.changeLog.get(table) || [];
    }

    const all: ChangeRecord[] = [];
    for (const changes of this.changeLog.values()) {
      all.push(...changes);
    }
    return all;
  }

  /**
   * Clear change log
   */
  public clearChangeLog(table?: string): void {
    if (table) {
      this.changeLog.delete(table);
    } else {
      this.changeLog.clear();
    }
  }
}

// ============================================================================
// Multi-Server Sync Manager
// ============================================================================

export class MultiServerSyncManager extends EventEmitter {
  private syncEngines: Map<string, DatabaseSyncEngine> = new Map();

  /**
   * Add sync configuration
   */
  public addSync(id: string, config: SyncConfig): DatabaseSyncEngine {
    if (this.syncEngines.has(id)) {
      throw new Error(`Sync configuration ${id} already exists`);
    }

    const engine = new DatabaseSyncEngine(config);

    // Forward events
    engine.on("started", () => this.emit("syncStarted", { id }));
    engine.on("stopped", () => this.emit("syncStopped", { id }));
    engine.on("synced", (result) => this.emit("syncCompleted", { id, result }));
    engine.on("error", (error) => this.emit("syncError", { id, error }));

    this.syncEngines.set(id, engine);

    return engine;
  }

  /**
   * Remove sync configuration
   */
  public removeSync(id: string): void {
    const engine = this.syncEngines.get(id);
    if (engine) {
      engine.stopContinuousSync();
      engine.removeAllListeners();
      this.syncEngines.delete(id);
    }
  }

  /**
   * Get sync engine
   */
  public getSync(id: string): DatabaseSyncEngine | undefined {
    return this.syncEngines.get(id);
  }

  /**
   * Sync all
   */
  public async syncAll(): Promise<Record<string, SyncResult>> {
    const results: Record<string, SyncResult> = {};

    for (const [id, engine] of this.syncEngines.entries()) {
      try {
        results[id] = await engine.syncOnce();
      } catch (error) {
        results[id] = {
          success: false,
          tablessynced: 0,
          rowsSynced: 0,
          conflicts: [],
          errors: [(error as Error).message],
          duration: 0,
          timestamp: Date.now(),
        };
      }
    }

    return results;
  }

  /**
   * Start all
   */
  public startAll(): void {
    for (const engine of this.syncEngines.values()) {
      engine.startContinuousSync();
    }
  }

  /**
   * Stop all
   */
  public stopAll(): void {
    for (const engine of this.syncEngines.values()) {
      engine.stopContinuousSync();
    }
  }
}
