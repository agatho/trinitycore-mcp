/**
 * Database Diff and Migration Tool
 *
 * Compares database schemas and generates migration scripts for
 * TrinityCore databases.
 *
 * @module diff-tool
 */

import type { DatabaseConfig } from "../types/database";
import { DatabaseExportEngine, type TableSchema, type ColumnSchema, type IndexSchema } from "./export-engine";
import { executeQuery } from "./db-client";
import fs from "fs/promises";

// ============================================================================
// Types
// ============================================================================

/**
 * Diff configuration
 */
export interface DiffConfig {
  /** Source database */
  source: DatabaseConfig;

  /** Target database */
  target: DatabaseConfig;

  /** Tables to compare (empty = all) */
  tables?: string[];

  /** Include data differences */
  includeData?: boolean;

  /** Generate migration SQL */
  generateMigration?: boolean;
}

/**
 * Schema difference
 */
export interface SchemaDiff {
  /** Tables only in source */
  tablesOnlyInSource: string[];

  /** Tables only in target */
  tablesOnlyInTarget: string[];

  /** Tables with differences */
  tablesWithDifferences: TableDiff[];

  /** Total differences count */
  totalDifferences: number;
}

/**
 * Table difference
 */
export interface TableDiff {
  /** Table name */
  table: string;

  /** Column differences */
  columns: ColumnDiff[];

  /** Index differences */
  indexes: IndexDiff[];

  /** Foreign key differences */
  foreignKeys: ForeignKeyDiff[];

  /** Table option differences */
  options: OptionDiff[];
}

/**
 * Column difference
 */
export interface ColumnDiff {
  /** Column name */
  column: string;

  /** Difference type */
  type: "added" | "removed" | "modified";

  /** Source column (if exists) */
  source?: ColumnSchema;

  /** Target column (if exists) */
  target?: ColumnSchema;

  /** Specific changes */
  changes?: string[];
}

/**
 * Index difference
 */
export interface IndexDiff {
  /** Index name */
  index: string;

  /** Difference type */
  type: "added" | "removed" | "modified";

  /** Source index (if exists) */
  source?: IndexSchema;

  /** Target index (if exists) */
  target?: IndexSchema;
}

/**
 * Foreign key difference
 */
export interface ForeignKeyDiff {
  /** Foreign key name */
  foreignKey: string;

  /** Difference type */
  type: "added" | "removed" | "modified";
}

/**
 * Option difference (engine, charset, etc.)
 */
export interface OptionDiff {
  /** Option name */
  option: string;

  /** Source value */
  sourceValue: string;

  /** Target value */
  targetValue: string;
}

/**
 * Migration script
 */
export interface MigrationScript {
  /** Script ID */
  id: string;

  /** Timestamp */
  timestamp: number;

  /** Source database */
  sourceDatabase: string;

  /** Target database */
  targetDatabase: string;

  /** Up script (apply migration) */
  up: string;

  /** Down script (rollback migration) */
  down: string;

  /** Description */
  description: string;
}

// ============================================================================
// Database Diff Tool
// ============================================================================

export class DatabaseDiffTool {
  private config: Required<DiffConfig>;

  constructor(config: DiffConfig) {
    this.config = {
      source: config.source,
      target: config.target,
      tables: config.tables ?? [],
      includeData: config.includeData ?? false,
      generateMigration: config.generateMigration ?? true,
    };
  }

  /**
   * Compare databases
   */
  public async compare(): Promise<SchemaDiff> {
    // Get source schema
    const sourceSchemas = await this.getSchemas(this.config.source);

    // Get target schema
    const targetSchemas = await this.getSchemas(this.config.target);

    // Build maps for efficient lookup
    const sourceMap = new Map(sourceSchemas.map((s) => [s.name, s]));
    const targetMap = new Map(targetSchemas.map((s) => [s.name, s]));

    // Find tables only in source
    const tablesOnlyInSource: string[] = [];
    for (const name of sourceMap.keys()) {
      if (!targetMap.has(name)) {
        tablesOnlyInSource.push(name);
      }
    }

    // Find tables only in target
    const tablesOnlyInTarget: string[] = [];
    for (const name of targetMap.keys()) {
      if (!sourceMap.has(name)) {
        tablesOnlyInTarget.push(name);
      }
    }

    // Find tables with differences
    const tablesWithDifferences: TableDiff[] = [];
    for (const [name, sourceSchema] of sourceMap.entries()) {
      const targetSchema = targetMap.get(name);
      if (!targetSchema) continue;

      const tableDiff = this.compareTable(sourceSchema, targetSchema);
      if (this.hasTableDifferences(tableDiff)) {
        tablesWithDifferences.push(tableDiff);
      }
    }

    const totalDifferences =
      tablesOnlyInSource.length +
      tablesOnlyInTarget.length +
      tablesWithDifferences.reduce(
        (sum, t) =>
          sum + t.columns.length + t.indexes.length + t.foreignKeys.length + t.options.length,
        0,
      );

    return {
      tablesOnlyInSource,
      tablesOnlyInTarget,
      tablesWithDifferences,
      totalDifferences,
    };
  }

  /**
   * Generate migration script
   */
  public async generateMigration(diff: SchemaDiff): Promise<MigrationScript> {
    const timestamp = Date.now();
    const id = `migration_${timestamp}`;

    let up = "";
    let down = "";

    // Generate header
    up += `-- Migration: ${id}\n`;
    up += `-- From: ${this.config.source.database}\n`;
    up += `-- To: ${this.config.target.database}\n`;
    up += `-- Generated: ${new Date(timestamp).toISOString()}\n\n`;

    down += `-- Rollback: ${id}\n\n`;

    // Handle tables only in source (create in target)
    for (const table of diff.tablesOnlyInSource) {
      const sourceSchemas = await this.getSchemas(this.config.source);
      const schema = sourceSchemas.find((s) => s.name === table);

      if (schema) {
        up += this.generateCreateTableSQL(schema);
        down += `DROP TABLE IF EXISTS \`${table}\`;\n\n`;
      }
    }

    // Handle tables only in target (drop in target)
    for (const table of diff.tablesOnlyInTarget) {
      up += `DROP TABLE IF EXISTS \`${table}\`;\n\n`;

      const targetSchemas = await this.getSchemas(this.config.target);
      const schema = targetSchemas.find((s) => s.name === table);

      if (schema) {
        down += this.generateCreateTableSQL(schema);
      }
    }

    // Handle table differences
    for (const tableDiff of diff.tablesWithDifferences) {
      const { upSQL, downSQL } = this.generateAlterTableSQL(tableDiff);
      up += upSQL;
      down += downSQL;
    }

    return {
      id,
      timestamp,
      sourceDatabase: this.config.source.database,
      targetDatabase: this.config.target.database,
      up,
      down,
      description: `Migration from ${this.config.source.database} to ${this.config.target.database}`,
    };
  }

  /**
   * Get schemas
   */
  private async getSchemas(database: DatabaseConfig): Promise<TableSchema[]> {
    const exportEngine = new DatabaseExportEngine({
      database,
      outputDir: "/tmp", // Not used
      includeSchema: true,
      includeData: false,
    });

    // Get table names
    const query = `
      SELECT TABLE_NAME
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = ?
      ORDER BY TABLE_NAME
    `;

    const result = await executeQuery(database, query, [database.database]);
    const tableNames = result.rows.map((row: any) => row.TABLE_NAME);

    // Filter tables if specified
    const filteredTables =
      this.config.tables.length > 0
        ? tableNames.filter((t: string) => this.config.tables.includes(t))
        : tableNames;

    // Get schema for each table
    const schemas: TableSchema[] = [];
    for (const table of filteredTables) {
      const schema = await (exportEngine as any).getTableSchema(table);
      schemas.push(schema);
    }

    return schemas;
  }

  /**
   * Compare table
   */
  private compareTable(source: TableSchema, target: TableSchema): TableDiff {
    return {
      table: source.name,
      columns: this.compareColumns(source.columns, target.columns),
      indexes: this.compareIndexes(source.indexes, target.indexes),
      foreignKeys: [], // Simplified for now
      options: this.compareOptions(source, target),
    };
  }

  /**
   * Compare columns
   */
  private compareColumns(
    sourceColumns: ColumnSchema[],
    targetColumns: ColumnSchema[],
  ): ColumnDiff[] {
    const diffs: ColumnDiff[] = [];

    const sourceMap = new Map(sourceColumns.map((c) => [c.name, c]));
    const targetMap = new Map(targetColumns.map((c) => [c.name, c]));

    // Find added columns
    for (const [name, sourceCol] of sourceMap.entries()) {
      if (!targetMap.has(name)) {
        diffs.push({
          column: name,
          type: "added",
          source: sourceCol,
        });
      }
    }

    // Find removed columns
    for (const [name, targetCol] of targetMap.entries()) {
      if (!sourceMap.has(name)) {
        diffs.push({
          column: name,
          type: "removed",
          target: targetCol,
        });
      }
    }

    // Find modified columns
    for (const [name, sourceCol] of sourceMap.entries()) {
      const targetCol = targetMap.get(name);
      if (!targetCol) continue;

      const changes: string[] = [];

      if (sourceCol.type !== targetCol.type) {
        changes.push(`type: ${targetCol.type} -> ${sourceCol.type}`);
      }

      if (sourceCol.nullable !== targetCol.nullable) {
        changes.push(`nullable: ${targetCol.nullable} -> ${sourceCol.nullable}`);
      }

      if (sourceCol.defaultValue !== targetCol.defaultValue) {
        changes.push(`default: ${targetCol.defaultValue} -> ${sourceCol.defaultValue}`);
      }

      if (changes.length > 0) {
        diffs.push({
          column: name,
          type: "modified",
          source: sourceCol,
          target: targetCol,
          changes,
        });
      }
    }

    return diffs;
  }

  /**
   * Compare indexes
   */
  private compareIndexes(
    sourceIndexes: IndexSchema[],
    targetIndexes: IndexSchema[],
  ): IndexDiff[] {
    const diffs: IndexDiff[] = [];

    const sourceMap = new Map(sourceIndexes.map((i) => [i.name, i]));
    const targetMap = new Map(targetIndexes.map((i) => [i.name, i]));

    // Find added indexes
    for (const [name, sourceIdx] of sourceMap.entries()) {
      if (!targetMap.has(name)) {
        diffs.push({
          index: name,
          type: "added",
          source: sourceIdx,
        });
      }
    }

    // Find removed indexes
    for (const [name, targetIdx] of targetMap.entries()) {
      if (!sourceMap.has(name)) {
        diffs.push({
          index: name,
          type: "removed",
          target: targetIdx,
        });
      }
    }

    // Find modified indexes
    for (const [name, sourceIdx] of sourceMap.entries()) {
      const targetIdx = targetMap.get(name);
      if (!targetIdx) continue;

      if (
        JSON.stringify(sourceIdx.columns) !== JSON.stringify(targetIdx.columns) ||
        sourceIdx.unique !== targetIdx.unique
      ) {
        diffs.push({
          index: name,
          type: "modified",
          source: sourceIdx,
          target: targetIdx,
        });
      }
    }

    return diffs;
  }

  /**
   * Compare options
   */
  private compareOptions(source: TableSchema, target: TableSchema): OptionDiff[] {
    const diffs: OptionDiff[] = [];

    if (source.engine !== target.engine) {
      diffs.push({
        option: "ENGINE",
        sourceValue: source.engine,
        targetValue: target.engine,
      });
    }

    if (source.charset !== target.charset) {
      diffs.push({
        option: "CHARSET",
        sourceValue: source.charset,
        targetValue: target.charset,
      });
    }

    if (source.collation !== target.collation) {
      diffs.push({
        option: "COLLATION",
        sourceValue: source.collation,
        targetValue: target.collation,
      });
    }

    return diffs;
  }

  /**
   * Check if table has differences
   */
  private hasTableDifferences(tableDiff: TableDiff): boolean {
    return (
      tableDiff.columns.length > 0 ||
      tableDiff.indexes.length > 0 ||
      tableDiff.foreignKeys.length > 0 ||
      tableDiff.options.length > 0
    );
  }

  /**
   * Generate CREATE TABLE SQL
   */
  private generateCreateTableSQL(schema: TableSchema): string {
    let sql = `CREATE TABLE \`${schema.name}\` (\n`;

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

    sql += `\n) ENGINE=${schema.engine} DEFAULT CHARSET=${schema.charset} COLLATE=${schema.collation};\n\n`;

    return sql;
  }

  /**
   * Generate ALTER TABLE SQL
   */
  private generateAlterTableSQL(tableDiff: TableDiff): { upSQL: string; downSQL: string } {
    let upSQL = "";
    let downSQL = "";

    const table = tableDiff.table;

    // Column changes
    for (const colDiff of tableDiff.columns) {
      if (colDiff.type === "added" && colDiff.source) {
        const col = colDiff.source;
        let def = `${col.type}`;
        if (!col.nullable) def += " NOT NULL";
        if (col.defaultValue !== null) def += ` DEFAULT ${col.defaultValue}`;

        upSQL += `ALTER TABLE \`${table}\` ADD COLUMN \`${col.name}\` ${def};\n`;
        downSQL = `ALTER TABLE \`${table}\` DROP COLUMN \`${col.name}\`;\n` + downSQL;
      } else if (colDiff.type === "removed" && colDiff.target) {
        const col = colDiff.target;
        upSQL += `ALTER TABLE \`${table}\` DROP COLUMN \`${col.name}\`;\n`;

        let def = `${col.type}`;
        if (!col.nullable) def += " NOT NULL";
        if (col.defaultValue !== null) def += ` DEFAULT ${col.defaultValue}`;

        downSQL = `ALTER TABLE \`${table}\` ADD COLUMN \`${col.name}\` ${def};\n` + downSQL;
      } else if (colDiff.type === "modified" && colDiff.source && colDiff.target) {
        const sourceCol = colDiff.source;
        const targetCol = colDiff.target;

        let sourceDef = `${sourceCol.type}`;
        if (!sourceCol.nullable) sourceDef += " NOT NULL";
        if (sourceCol.defaultValue !== null) sourceDef += ` DEFAULT ${sourceCol.defaultValue}`;

        let targetDef = `${targetCol.type}`;
        if (!targetCol.nullable) targetDef += " NOT NULL";
        if (targetCol.defaultValue !== null) targetDef += ` DEFAULT ${targetCol.defaultValue}`;

        upSQL += `ALTER TABLE \`${table}\` MODIFY COLUMN \`${sourceCol.name}\` ${sourceDef};\n`;
        downSQL = `ALTER TABLE \`${table}\` MODIFY COLUMN \`${targetCol.name}\` ${targetDef};\n` + downSQL;
      }
    }

    // Index changes
    for (const idxDiff of tableDiff.indexes) {
      if (idxDiff.type === "added" && idxDiff.source) {
        const idx = idxDiff.source;
        const unique = idx.unique ? "UNIQUE " : "";
        const cols = idx.columns.map((c) => `\`${c}\``).join(", ");

        upSQL += `ALTER TABLE \`${table}\` ADD ${unique}INDEX \`${idx.name}\` (${cols});\n`;
        downSQL = `ALTER TABLE \`${table}\` DROP INDEX \`${idx.name}\`;\n` + downSQL;
      } else if (idxDiff.type === "removed" && idxDiff.target) {
        upSQL += `ALTER TABLE \`${table}\` DROP INDEX \`${idxDiff.target.name}\`;\n`;

        const idx = idxDiff.target;
        const unique = idx.unique ? "UNIQUE " : "";
        const cols = idx.columns.map((c) => `\`${c}\``).join(", ");

        downSQL = `ALTER TABLE \`${table}\` ADD ${unique}INDEX \`${idx.name}\` (${cols});\n` + downSQL;
      }
    }

    // Table options
    for (const optDiff of tableDiff.options) {
      upSQL += `ALTER TABLE \`${table}\` ${optDiff.option}=${optDiff.sourceValue};\n`;
      downSQL = `ALTER TABLE \`${table}\` ${optDiff.option}=${optDiff.targetValue};\n` + downSQL;
    }

    if (upSQL) upSQL = `-- Table: ${table}\n${upSQL}\n`;
    if (downSQL) downSQL = `-- Rollback for table: ${table}\n${downSQL}\n`;

    return { upSQL, downSQL };
  }

  /**
   * Save migration to file
   */
  public async saveMigration(migration: MigrationScript, outputDir: string): Promise<void> {
    await fs.mkdir(outputDir, { recursive: true });

    const upPath = `${outputDir}/${migration.id}_up.sql`;
    const downPath = `${outputDir}/${migration.id}_down.sql`;
    const metaPath = `${outputDir}/${migration.id}_meta.json`;

    await fs.writeFile(upPath, migration.up);
    await fs.writeFile(downPath, migration.down);
    await fs.writeFile(
      metaPath,
      JSON.stringify(
        {
          id: migration.id,
          timestamp: migration.timestamp,
          sourceDatabase: migration.sourceDatabase,
          targetDatabase: migration.targetDatabase,
          description: migration.description,
        },
        null,
        2,
      ),
    );
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Compare two databases and generate migration
 */
export async function compareDatabases(
  source: DatabaseConfig,
  target: DatabaseConfig,
  outputDir?: string,
): Promise<{ diff: SchemaDiff; migration?: MigrationScript }> {
  const tool = new DatabaseDiffTool({
    source,
    target,
    generateMigration: true,
  });

  const diff = await tool.compare();
  const migration = await tool.generateMigration(diff);

  if (outputDir) {
    await tool.saveMigration(migration, outputDir);
  }

  return { diff, migration };
}
