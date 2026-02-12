/**
 * Database Export Engine
 *
 * Exports TrinityCore database schemas and data with support for
 * incremental exports, filtering, and multiple formats.
 *
 * @module export-engine
 */

import type { DatabaseConfig } from "../types/database";
import { executeQuery, executeBatch } from "./db-client";
import fs from "fs/promises";
import path from "path";
import { validateIdentifier } from "../utils/sql-safety";

// ============================================================================
// Types
// ============================================================================

/**
 * Export configuration
 */
export interface ExportConfig {
  /** Database config */
  database: DatabaseConfig;

  /** Output directory */
  outputDir: string;

  /** Export format */
  format?: ExportFormat;

  /** Include schema */
  includeSchema?: boolean;

  /** Include data */
  includeData?: boolean;

  /** Table filters (regex patterns) */
  tableFilters?: string[];

  /** Exclude tables (regex patterns) */
  excludeTables?: string[];

  /** Batch size for data export */
  batchSize?: number;

  /** Compress output */
  compress?: boolean;

  /** Include timestamps */
  includeTimestamps?: boolean;
}

/**
 * Export format
 */
export enum ExportFormat {
  SQL = "sql",
  JSON = "json",
  CSV = "csv",
  BINARY = "binary",
}

/**
 * Table schema information
 */
export interface TableSchema {
  name: string;
  columns: ColumnSchema[];
  indexes: IndexSchema[];
  foreignKeys: ForeignKeySchema[];
  engine: string;
  charset: string;
  collation: string;
  rowCount: number;
}

/**
 * Column schema
 */
export interface ColumnSchema {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue: string | null;
  extra: string;
  key: string;
  comment: string;
}

/**
 * Index schema
 */
export interface IndexSchema {
  name: string;
  columns: string[];
  unique: boolean;
  type: string;
}

/**
 * Foreign key schema
 */
export interface ForeignKeySchema {
  name: string;
  column: string;
  referencedTable: string;
  referencedColumn: string;
  onDelete: string;
  onUpdate: string;
}

/**
 * Export result
 */
export interface ExportResult {
  success: boolean;
  database: string;
  tablesExported: number;
  rowsExported: number;
  filesCreated: string[];
  duration: number;
  size: number;
  error?: string;
}

// ============================================================================
// Database Export Engine
// ============================================================================

export class DatabaseExportEngine {
  private config: Required<ExportConfig>;

  constructor(config: ExportConfig) {
    this.config = {
      database: config.database,
      outputDir: config.outputDir,
      format: config.format ?? ExportFormat.SQL,
      includeSchema: config.includeSchema ?? true,
      includeData: config.includeData ?? true,
      tableFilters: config.tableFilters ?? [],
      excludeTables: config.excludeTables ?? [],
      batchSize: config.batchSize ?? 1000,
      compress: config.compress ?? false,
      includeTimestamps: config.includeTimestamps ?? true,
    };
  }

  /**
   * Export database
   */
  public async export(): Promise<ExportResult> {
    const startTime = Date.now();
    const filesCreated: string[] = [];
    let tablesExported = 0;
    let rowsExported = 0;

    try {
      // Ensure output directory exists
      await fs.mkdir(this.config.outputDir, { recursive: true });

      // Get list of tables
      const tables = await this.getTables();
      const filteredTables = this.filterTables(tables);

      // Export schema if requested
      if (this.config.includeSchema) {
        const schemaFile = await this.exportSchema(filteredTables);
        filesCreated.push(schemaFile);
      }

      // Export data if requested
      if (this.config.includeData) {
        for (const table of filteredTables) {
          const dataFile = await this.exportTableData(table);
          if (dataFile) {
            filesCreated.push(dataFile);
            tablesExported++;

            // Get row count
            const count = await this.getTableRowCount(table);
            rowsExported += count;
          }
        }
      }

      // Calculate total size
      let totalSize = 0;
      for (const file of filesCreated) {
        const stats = await fs.stat(file);
        totalSize += stats.size;
      }

      return {
        success: true,
        database: this.config.database.database,
        tablesExported,
        rowsExported,
        filesCreated,
        duration: Date.now() - startTime,
        size: totalSize,
      };
    } catch (error) {
      return {
        success: false,
        database: this.config.database.database,
        tablesExported,
        rowsExported,
        filesCreated,
        duration: Date.now() - startTime,
        size: 0,
        error: (error as Error).message,
      };
    }
  }

  /**
   * Get list of tables
   */
  private async getTables(): Promise<string[]> {
    const query = `
      SELECT TABLE_NAME
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = ?
      ORDER BY TABLE_NAME
    `;

    const result = await executeQuery(this.config.database, query, [
      this.config.database.database,
    ]);

    return result.rows.map((row: any) => row.TABLE_NAME);
  }

  /**
   * Filter tables based on config
   */
  private filterTables(tables: string[]): string[] {
    let filtered = tables;

    // Apply include filters
    if (this.config.tableFilters.length > 0) {
      filtered = filtered.filter((table) => {
        return this.config.tableFilters.some((pattern) => {
          const regex = new RegExp(pattern);
          return regex.test(table);
        });
      });
    }

    // Apply exclude filters
    if (this.config.excludeTables.length > 0) {
      filtered = filtered.filter((table) => {
        return !this.config.excludeTables.some((pattern) => {
          const regex = new RegExp(pattern);
          return regex.test(table);
        });
      });
    }

    return filtered;
  }

  /**
   * Export schema
   */
  private async exportSchema(tables: string[]): Promise<string> {
    const schemas: TableSchema[] = [];

    for (const table of tables) {
      const schema = await this.getTableSchema(table);
      schemas.push(schema);
    }

    const filename = `${this.config.database.database}_schema_${Date.now()}.${this.config.format}`;
    const filepath = path.join(this.config.outputDir, filename);

    switch (this.config.format) {
      case ExportFormat.SQL:
        await this.exportSchemaAsSQL(schemas, filepath);
        break;
      case ExportFormat.JSON:
        await this.exportSchemaAsJSON(schemas, filepath);
        break;
      default:
        throw new Error(`Unsupported format for schema export: ${this.config.format}`);
    }

    return filepath;
  }

  /**
   * Get table schema
   */
  private async getTableSchema(table: string): Promise<TableSchema> {
    // Get columns
    const columnsQuery = `
      SELECT
        COLUMN_NAME as name,
        COLUMN_TYPE as type,
        IS_NULLABLE as nullable,
        COLUMN_DEFAULT as defaultValue,
        EXTRA as extra,
        COLUMN_KEY as \`key\`,
        COLUMN_COMMENT as comment
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
      ORDER BY ORDINAL_POSITION
    `;

    const columnsResult = await executeQuery(this.config.database, columnsQuery, [
      this.config.database.database,
      table,
    ]);

    const columns: ColumnSchema[] = columnsResult.rows.map((row: any) => ({
      name: row.name,
      type: row.type,
      nullable: row.nullable === "YES",
      defaultValue: row.defaultValue,
      extra: row.extra,
      key: row.key,
      comment: row.comment,
    }));

    // Get indexes
    const indexesQuery = `
      SELECT
        INDEX_NAME as name,
        COLUMN_NAME as column_name,
        NON_UNIQUE as non_unique,
        INDEX_TYPE as type
      FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
      ORDER BY INDEX_NAME, SEQ_IN_INDEX
    `;

    const indexesResult = await executeQuery(this.config.database, indexesQuery, [
      this.config.database.database,
      table,
    ]);

    const indexMap = new Map<string, IndexSchema>();
    for (const row of indexesResult.rows) {
      const name = row.name;
      if (!indexMap.has(name)) {
        indexMap.set(name, {
          name,
          columns: [],
          unique: row.non_unique === 0,
          type: row.type,
        });
      }
      indexMap.get(name)!.columns.push(row.column_name);
    }

    const indexes = Array.from(indexMap.values());

    // Get foreign keys
    const fkQuery = `
      SELECT
        CONSTRAINT_NAME as name,
        COLUMN_NAME as column_name,
        REFERENCED_TABLE_NAME as referenced_table,
        REFERENCED_COLUMN_NAME as referenced_column
      FROM information_schema.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = ?
        AND TABLE_NAME = ?
        AND REFERENCED_TABLE_NAME IS NOT NULL
    `;

    const fkResult = await executeQuery(this.config.database, fkQuery, [
      this.config.database.database,
      table,
    ]);

    const foreignKeys: ForeignKeySchema[] = fkResult.rows.map((row: any) => ({
      name: row.name,
      column: row.column_name,
      referencedTable: row.referenced_table,
      referencedColumn: row.referenced_column,
      onDelete: "RESTRICT", // Default, could be queried from RC table
      onUpdate: "RESTRICT",
    }));

    // Get table info
    const tableInfoQuery = `
      SELECT
        ENGINE as engine,
        TABLE_COLLATION as collation,
        TABLE_ROWS as row_count
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
    `;

    const tableInfoResult = await executeQuery(this.config.database, tableInfoQuery, [
      this.config.database.database,
      table,
    ]);

    const tableInfo = tableInfoResult.rows[0] || {};

    return {
      name: table,
      columns,
      indexes,
      foreignKeys,
      engine: tableInfo.engine || "InnoDB",
      charset: "utf8mb4", // Default for TrinityCore
      collation: tableInfo.collation || "utf8mb4_general_ci",
      rowCount: tableInfo.row_count || 0,
    };
  }

  /**
   * Export schema as SQL
   */
  private async exportSchemaAsSQL(schemas: TableSchema[], filepath: string): Promise<void> {
    let sql = "";

    // Header
    if (this.config.includeTimestamps) {
      sql += `-- Database: ${this.config.database.database}\n`;
      sql += `-- Exported: ${new Date().toISOString()}\n`;
      sql += `-- Format: SQL Schema\n\n`;
    }

    for (const schema of schemas) {
      sql += `-- Table: ${schema.name}\n`;
      sql += `DROP TABLE IF EXISTS \`${schema.name}\`;\n`;
      sql += `CREATE TABLE \`${schema.name}\` (\n`;

      // Columns
      const columnDefs = schema.columns.map((col) => {
        let def = `  \`${col.name}\` ${col.type}`;
        if (!col.nullable) def += " NOT NULL";
        if (col.defaultValue !== null) def += ` DEFAULT ${col.defaultValue}`;
        if (col.extra) def += ` ${col.extra}`;
        if (col.comment) def += ` COMMENT '${col.comment}'`;
        return def;
      });

      sql += columnDefs.join(",\n");

      // Indexes
      if (schema.indexes.length > 0) {
        sql += ",\n";
        const indexDefs = schema.indexes.map((idx) => {
          const unique = idx.unique ? "UNIQUE " : "";
          const cols = idx.columns.map((c) => `\`${c}\``).join(", ");
          if (idx.name === "PRIMARY") {
            return `  PRIMARY KEY (${cols})`;
          }
          return `  ${unique}KEY \`${idx.name}\` (${cols})`;
        });
        sql += indexDefs.join(",\n");
      }

      // Foreign keys
      if (schema.foreignKeys.length > 0) {
        sql += ",\n";
        const fkDefs = schema.foreignKeys.map((fk) => {
          return `  CONSTRAINT \`${fk.name}\` FOREIGN KEY (\`${fk.column}\`) REFERENCES \`${fk.referencedTable}\` (\`${fk.referencedColumn}\`) ON DELETE ${fk.onDelete} ON UPDATE ${fk.onUpdate}`;
        });
        sql += fkDefs.join(",\n");
      }

      sql += `\n) ENGINE=${schema.engine} DEFAULT CHARSET=${schema.charset} COLLATE=${schema.collation};\n\n`;
    }

    await fs.writeFile(filepath, sql);
  }

  /**
   * Export schema as JSON
   */
  private async exportSchemaAsJSON(schemas: TableSchema[], filepath: string): Promise<void> {
    const data = {
      database: this.config.database.database,
      exportedAt: new Date().toISOString(),
      format: "JSON Schema",
      tables: schemas,
    };

    await fs.writeFile(filepath, JSON.stringify(data, null, 2));
  }

  /**
   * Export table data
   */
  private async exportTableData(table: string): Promise<string | null> {
    const filename = `${table}_${Date.now()}.${this.config.format}`;
    const filepath = path.join(this.config.outputDir, filename);

    switch (this.config.format) {
      case ExportFormat.SQL:
        await this.exportTableDataAsSQL(table, filepath);
        break;
      case ExportFormat.JSON:
        await this.exportTableDataAsJSON(table, filepath);
        break;
      case ExportFormat.CSV:
        await this.exportTableDataAsCSV(table, filepath);
        break;
      default:
        return null;
    }

    return filepath;
  }

  /**
   * Export table data as SQL
   */
  private async exportTableDataAsSQL(table: string, filepath: string): Promise<void> {
    const safeTable = validateIdentifier(table, 'table name');
    let sql = "";

    if (this.config.includeTimestamps) {
      sql += `-- Table: ${safeTable}\n`;
      sql += `-- Exported: ${new Date().toISOString()}\n\n`;
    }

    // Get data in batches
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const query = `SELECT * FROM \`${safeTable}\` LIMIT ? OFFSET ?`;
      const result = await executeQuery(this.config.database, query, [
        this.config.batchSize,
        offset,
      ]);

      if (result.rows.length === 0) {
        hasMore = false;
        break;
      }

      // Generate INSERT statements
      for (const row of result.rows) {
        const columns = Object.keys(row);
        const safeColumns = columns.map(col => validateIdentifier(col, 'column name'));
        const values = columns.map((col) => {
          const val = row[col];
          if (val === null) return "NULL";
          if (typeof val === "number") return val.toString();
          if (typeof val === "boolean") return val ? "1" : "0";
          return `'${String(val).replace(/'/g, "''")}'`;
        });

        sql += `INSERT INTO \`${safeTable}\` (\`${safeColumns.join("`, `")}\`) VALUES (${values.join(", ")});\n`;
      }

      offset += this.config.batchSize;
      hasMore = result.rows.length === this.config.batchSize;
    }

    await fs.writeFile(filepath, sql);
  }

  /**
   * Export table data as JSON
   */
  private async exportTableDataAsJSON(table: string, filepath: string): Promise<void> {
    const safeTable = validateIdentifier(table, 'table name');
    const query = `SELECT * FROM \`${safeTable}\``;
    const result = await executeQuery(this.config.database, query);

    const data = {
      table,
      exportedAt: new Date().toISOString(),
      rowCount: result.rows.length,
      data: result.rows,
    };

    await fs.writeFile(filepath, JSON.stringify(data, null, 2));
  }

  /**
   * Export table data as CSV
   */
  private async exportTableDataAsCSV(table: string, filepath: string): Promise<void> {
    const safeTable = validateIdentifier(table, 'table name');
    const query = `SELECT * FROM \`${safeTable}\``;
    const result = await executeQuery(this.config.database, query);

    if (result.rows.length === 0) {
      await fs.writeFile(filepath, "");
      return;
    }

    // Header
    const columns = Object.keys(result.rows[0]);
    let csv = columns.join(",") + "\n";

    // Rows
    for (const row of result.rows) {
      const values = columns.map((col) => {
        const val = row[col];
        if (val === null) return "";
        if (typeof val === "string") return `"${val.replace(/"/g, '""')}"`;
        return String(val);
      });
      csv += values.join(",") + "\n";
    }

    await fs.writeFile(filepath, csv);
  }

  /**
   * Get table row count
   */
  private async getTableRowCount(table: string): Promise<number> {
    const safeTable = validateIdentifier(table, 'table name');
    const query = `SELECT COUNT(*) as count FROM \`${safeTable}\``;
    const result = await executeQuery(this.config.database, query);
    return result.rows[0]?.count || 0;
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Export all TrinityCore databases
 */
export async function exportAllDatabases(
  baseConfig: Omit<DatabaseConfig, "database">,
  outputDir: string,
  format: ExportFormat = ExportFormat.SQL,
): Promise<Record<string, ExportResult>> {
  const databases = ["world", "characters", "auth"];
  const results: Record<string, ExportResult> = {};

  for (const db of databases) {
    const config: ExportConfig = {
      database: { ...baseConfig, database: db },
      outputDir: path.join(outputDir, db),
      format,
      includeSchema: true,
      includeData: true,
    };

    const engine = new DatabaseExportEngine(config);
    results[db] = await engine.export();
  }

  return results;
}

/**
 * Export specific tables
 */
export async function exportTables(
  database: DatabaseConfig,
  tables: string[],
  outputDir: string,
  format: ExportFormat = ExportFormat.SQL,
): Promise<ExportResult> {
  const config: ExportConfig = {
    database,
    outputDir,
    format,
    includeSchema: true,
    includeData: true,
    tableFilters: tables.map((t) => `^${t}$`), // Exact match
  };

  const engine = new DatabaseExportEngine(config);
  return await engine.export();
}
