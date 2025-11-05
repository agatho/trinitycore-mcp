/**
 * Database Import Engine
 *
 * Imports database schemas and data with validation, conflict resolution,
 * and rollback support.
 *
 * @module import-engine
 */

import type { DatabaseConfig } from "../types/database.js";
import { executeQuery, executeBatch, executeTransaction } from "./db-client.js";
import { ExportFormat, type TableSchema } from "./export-engine.js";
import fs from "fs/promises";
import path from "path";

// ============================================================================
// Types
// ============================================================================

/**
 * Import configuration
 */
export interface ImportConfig {
  /** Database config */
  database: DatabaseConfig;

  /** Import file or directory */
  source: string;

  /** Import format */
  format?: ExportFormat;

  /** Validate before import */
  validate?: boolean;

  /** Drop existing tables */
  dropExisting?: boolean;

  /** Conflict resolution strategy */
  conflictResolution?: ConflictResolution;

  /** Batch size for data import */
  batchSize?: number;

  /** Dry run (validate only, don't import) */
  dryRun?: boolean;

  /** Enable foreign key checks */
  foreignKeyChecks?: boolean;
}

/**
 * Conflict resolution strategy
 */
export enum ConflictResolution {
  SKIP = "skip",
  REPLACE = "replace",
  UPDATE = "update",
  ERROR = "error",
}

/**
 * Import result
 */
export interface ImportResult {
  success: boolean;
  database: string;
  tablesImported: number;
  rowsImported: number;
  errors: ImportError[];
  warnings: string[];
  duration: number;
}

/**
 * Import error
 */
export interface ImportError {
  table?: string;
  row?: number;
  error: string;
  severity: "error" | "warning";
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: ImportError[];
  warnings: string[];
  tablesFound: number;
  estimatedRows: number;
}

// ============================================================================
// Database Import Engine
// ============================================================================

export class DatabaseImportEngine {
  private config: Required<ImportConfig>;

  constructor(config: ImportConfig) {
    this.config = {
      database: config.database,
      source: config.source,
      format: config.format ?? ExportFormat.SQL,
      validate: config.validate ?? true,
      dropExisting: config.dropExisting ?? false,
      conflictResolution: config.conflictResolution ?? ConflictResolution.SKIP,
      batchSize: config.batchSize ?? 1000,
      dryRun: config.dryRun ?? false,
      foreignKeyChecks: config.foreignKeyChecks ?? false,
    };
  }

  /**
   * Import database
   */
  public async import(): Promise<ImportResult> {
    const startTime = Date.now();
    const errors: ImportError[] = [];
    const warnings: string[] = [];
    let tablesImported = 0;
    let rowsImported = 0;

    try {
      // Validate if requested
      if (this.config.validate) {
        const validation = await this.validate();
        if (!validation.valid) {
          return {
            success: false,
            database: this.config.database.database,
            tablesImported: 0,
            rowsImported: 0,
            errors: validation.errors,
            warnings: validation.warnings,
            duration: Date.now() - startTime,
          };
        }
        warnings.push(...validation.warnings);
      }

      // Check if dry run
      if (this.config.dryRun) {
        return {
          success: true,
          database: this.config.database.database,
          tablesImported: 0,
          rowsImported: 0,
          errors: [],
          warnings: ["Dry run - no data imported"],
          duration: Date.now() - startTime,
        };
      }

      // Disable foreign key checks if requested
      if (!this.config.foreignKeyChecks) {
        await executeQuery(this.config.database, "SET FOREIGN_KEY_CHECKS=0");
      }

      // Import based on format
      switch (this.config.format) {
        case ExportFormat.SQL:
          const sqlResult = await this.importSQL();
          tablesImported = sqlResult.tablesImported;
          rowsImported = sqlResult.rowsImported;
          errors.push(...sqlResult.errors);
          break;

        case ExportFormat.JSON:
          const jsonResult = await this.importJSON();
          tablesImported = jsonResult.tablesImported;
          rowsImported = jsonResult.rowsImported;
          errors.push(...jsonResult.errors);
          break;

        case ExportFormat.CSV:
          const csvResult = await this.importCSV();
          tablesImported = csvResult.tablesImported;
          rowsImported = csvResult.rowsImported;
          errors.push(...csvResult.errors);
          break;

        default:
          throw new Error(`Unsupported import format: ${this.config.format}`);
      }

      // Re-enable foreign key checks
      if (!this.config.foreignKeyChecks) {
        await executeQuery(this.config.database, "SET FOREIGN_KEY_CHECKS=1");
      }

      return {
        success: errors.filter((e) => e.severity === "error").length === 0,
        database: this.config.database.database,
        tablesImported,
        rowsImported,
        errors,
        warnings,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        database: this.config.database.database,
        tablesImported,
        rowsImported,
        errors: [
          ...errors,
          {
            error: (error as Error).message,
            severity: "error",
          },
        ],
        warnings,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Validate import
   */
  public async validate(): Promise<ValidationResult> {
    const errors: ImportError[] = [];
    const warnings: string[] = [];
    let tablesFound = 0;
    let estimatedRows = 0;

    try {
      // Check if source exists
      try {
        await fs.access(this.config.source);
      } catch {
        errors.push({
          error: `Source not found: ${this.config.source}`,
          severity: "error",
        });
        return {
          valid: false,
          errors,
          warnings,
          tablesFound: 0,
          estimatedRows: 0,
        };
      }

      // Check source type (file or directory)
      const stats = await fs.stat(this.config.source);

      if (stats.isDirectory()) {
        // Validate directory structure
        const files = await fs.readdir(this.config.source);
        const dataFiles = files.filter((f) => f.endsWith(`.${this.config.format}`));

        if (dataFiles.length === 0) {
          warnings.push(`No ${this.config.format} files found in directory`);
        }

        tablesFound = dataFiles.length;
      } else {
        // Validate single file
        const content = await fs.readFile(this.config.source, "utf-8");

        switch (this.config.format) {
          case ExportFormat.SQL:
            // Count CREATE TABLE statements
            const createMatches = content.match(/CREATE\s+TABLE/gi);
            tablesFound = createMatches?.length || 0;

            // Count INSERT statements
            const insertMatches = content.match(/INSERT\s+INTO/gi);
            estimatedRows = insertMatches?.length || 0;
            break;

          case ExportFormat.JSON:
            try {
              const data = JSON.parse(content);
              if (data.tables) {
                tablesFound = data.tables.length;
              } else if (data.data) {
                estimatedRows = data.data.length;
              }
            } catch (e) {
              errors.push({
                error: `Invalid JSON format: ${(e as Error).message}`,
                severity: "error",
              });
            }
            break;

          case ExportFormat.CSV:
            // Count lines
            const lines = content.split("\n").filter((l) => l.trim());
            estimatedRows = Math.max(0, lines.length - 1); // Exclude header
            tablesFound = 1;
            break;
        }
      }

      return {
        valid: errors.length === 0,
        errors,
        warnings,
        tablesFound,
        estimatedRows,
      };
    } catch (error) {
      errors.push({
        error: `Validation failed: ${(error as Error).message}`,
        severity: "error",
      });

      return {
        valid: false,
        errors,
        warnings,
        tablesFound: 0,
        estimatedRows: 0,
      };
    }
  }

  /**
   * Import SQL
   */
  private async importSQL(): Promise<{
    tablesImported: number;
    rowsImported: number;
    errors: ImportError[];
  }> {
    const errors: ImportError[] = [];
    let tablesImported = 0;
    let rowsImported = 0;

    try {
      const content = await fs.readFile(this.config.source, "utf-8");

      // Split into statements
      const statements = content
        .split(";")
        .map((s) => s.trim())
        .filter((s) => s && !s.startsWith("--"));

      // Execute statements in transaction
      await executeTransaction(this.config.database, async (connection) => {
        for (const statement of statements) {
          try {
            // Check statement type
            if (statement.match(/CREATE\s+TABLE/i)) {
              tablesImported++;
            } else if (statement.match(/INSERT\s+INTO/i)) {
              rowsImported++;
            }

            await connection.execute(statement);
          } catch (error) {
            errors.push({
              error: `SQL error: ${(error as Error).message}`,
              severity: "error",
            });

            if (errors.length > 100) {
              throw new Error("Too many errors, aborting import");
            }
          }
        }
      });
    } catch (error) {
      errors.push({
        error: `Import failed: ${(error as Error).message}`,
        severity: "error",
      });
    }

    return {
      tablesImported,
      rowsImported,
      errors,
    };
  }

  /**
   * Import JSON
   */
  private async importJSON(): Promise<{
    tablesImported: number;
    rowsImported: number;
    errors: ImportError[];
  }> {
    const errors: ImportError[] = [];
    let tablesImported = 0;
    let rowsImported = 0;

    try {
      const content = await fs.readFile(this.config.source, "utf-8");
      const data = JSON.parse(content);

      // Check if schema export
      if (data.tables && Array.isArray(data.tables)) {
        // Import schema
        for (const table of data.tables as TableSchema[]) {
          try {
            await this.importTableSchema(table);
            tablesImported++;
          } catch (error) {
            errors.push({
              table: table.name,
              error: (error as Error).message,
              severity: "error",
            });
          }
        }
      }

      // Check if data export
      if (data.table && data.data && Array.isArray(data.data)) {
        try {
          const imported = await this.importTableData(data.table, data.data);
          rowsImported = imported;
          tablesImported = 1;
        } catch (error) {
          errors.push({
            table: data.table,
            error: (error as Error).message,
            severity: "error",
          });
        }
      }
    } catch (error) {
      errors.push({
        error: `JSON import failed: ${(error as Error).message}`,
        severity: "error",
      });
    }

    return {
      tablesImported,
      rowsImported,
      errors,
    };
  }

  /**
   * Import CSV
   */
  private async importCSV(): Promise<{
    tablesImported: number;
    rowsImported: number;
    errors: ImportError[];
  }> {
    const errors: ImportError[] = [];
    let rowsImported = 0;

    try {
      // Get table name from filename
      const filename = path.basename(this.config.source, ".csv");
      const tableName = filename.split("_")[0]; // Assuming format: tablename_timestamp.csv

      const content = await fs.readFile(this.config.source, "utf-8");
      const lines = content.split("\n").filter((l) => l.trim());

      if (lines.length === 0) {
        return { tablesImported: 0, rowsImported: 0, errors };
      }

      // Parse header
      const header = this.parseCSVLine(lines[0]);

      // Parse rows
      const rows: Record<string, any>[] = [];
      for (let i = 1; i < lines.length; i++) {
        try {
          const values = this.parseCSVLine(lines[i]);
          if (values.length !== header.length) {
            errors.push({
              table: tableName,
              row: i,
              error: `Column count mismatch at line ${i}`,
              severity: "warning",
            });
            continue;
          }

          const row: Record<string, any> = {};
          for (let j = 0; j < header.length; j++) {
            row[header[j]] = values[j] === "" ? null : values[j];
          }
          rows.push(row);
        } catch (error) {
          errors.push({
            table: tableName,
            row: i,
            error: (error as Error).message,
            severity: "warning",
          });
        }
      }

      // Import data
      const imported = await this.importTableData(tableName, rows);
      rowsImported = imported;
    } catch (error) {
      errors.push({
        error: `CSV import failed: ${(error as Error).message}`,
        severity: "error",
      });
    }

    return {
      tablesImported: rowsImported > 0 ? 1 : 0,
      rowsImported,
      errors,
    };
  }

  /**
   * Parse CSV line
   */
  private parseCSVLine(line: string): string[] {
    const values: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === "," && !inQuotes) {
        values.push(current);
        current = "";
      } else {
        current += char;
      }
    }

    values.push(current);
    return values;
  }

  /**
   * Import table schema
   */
  private async importTableSchema(schema: TableSchema): Promise<void> {
    // Drop existing table if requested
    if (this.config.dropExisting) {
      await executeQuery(this.config.database, `DROP TABLE IF EXISTS \`${schema.name}\``);
    }

    // Build CREATE TABLE statement
    let sql = `CREATE TABLE IF NOT EXISTS \`${schema.name}\` (\n`;

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

    sql += `\n) ENGINE=${schema.engine} DEFAULT CHARSET=${schema.charset} COLLATE=${schema.collation}`;

    await executeQuery(this.config.database, sql);

    // Add foreign keys separately (after all tables are created)
    // This would need to be deferred in a full implementation
  }

  /**
   * Import table data
   */
  private async importTableData(table: string, rows: Record<string, any>[]): Promise<number> {
    if (rows.length === 0) return 0;

    let imported = 0;

    // Process in batches
    for (let i = 0; i < rows.length; i += this.config.batchSize) {
      const batch = rows.slice(i, i + this.config.batchSize);

      const columns = Object.keys(batch[0]);
      const placeholders = columns.map(() => "?").join(", ");

      let query = "";
      switch (this.config.conflictResolution) {
        case ConflictResolution.REPLACE:
          query = `REPLACE INTO \`${table}\` (\`${columns.join("`, `")}\`) VALUES (${placeholders})`;
          break;
        case ConflictResolution.UPDATE:
          const updates = columns.map((c) => `\`${c}\` = VALUES(\`${c}\`)`).join(", ");
          query = `INSERT INTO \`${table}\` (\`${columns.join("`, `")}\`) VALUES (${placeholders}) ON DUPLICATE KEY UPDATE ${updates}`;
          break;
        case ConflictResolution.SKIP:
          query = `INSERT IGNORE INTO \`${table}\` (\`${columns.join("`, `")}\`) VALUES (${placeholders})`;
          break;
        default:
          query = `INSERT INTO \`${table}\` (\`${columns.join("`, `")}\`) VALUES (${placeholders})`;
      }

      for (const row of batch) {
        const values = columns.map((c) => row[c]);
        await executeQuery(this.config.database, query, values);
        imported++;
      }
    }

    return imported;
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Import from directory
 */
export async function importFromDirectory(
  database: DatabaseConfig,
  directory: string,
  format: ExportFormat = ExportFormat.SQL,
): Promise<ImportResult> {
  const config: ImportConfig = {
    database,
    source: directory,
    format,
    validate: true,
    dropExisting: false,
  };

  const engine = new DatabaseImportEngine(config);
  return await engine.import();
}

/**
 * Quick import from file
 */
export async function importFromFile(
  database: DatabaseConfig,
  filepath: string,
  dropExisting: boolean = false,
): Promise<ImportResult> {
  const ext = path.extname(filepath).slice(1);
  const format = (ext as ExportFormat) || ExportFormat.SQL;

  const config: ImportConfig = {
    database,
    source: filepath,
    format,
    validate: true,
    dropExisting,
  };

  const engine = new DatabaseImportEngine(config);
  return await engine.import();
}
