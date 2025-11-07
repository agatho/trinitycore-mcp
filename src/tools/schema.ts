/**
 * Database Schema Inspector
 * AI Agent Development Tool #1
 *
 * Purpose: Parse and analyze TrinityCore database schemas for AI-assisted C++ development.
 * Benefit: Enables AI agents to understand data structures without manual SQL exploration.
 */

import { queryWorld, queryAuth, queryCharacters } from "../database/connection";

/**
 * Column information from INFORMATION_SCHEMA
 */
export interface TableColumn {
  name: string;
  type: string;
  nullable: boolean;
  default: string | null;
  key: "PRI" | "UNI" | "MUL" | "";
  extra: string;
  comment: string;
}

/**
 * Index information
 */
export interface TableIndex {
  name: string;
  columns: string[];
  unique: boolean;
  type: string;
}

/**
 * Foreign key relationship
 */
export interface ForeignKey {
  name: string;
  column: string;
  referencedTable: string;
  referencedColumn: string;
  onDelete: string;
  onUpdate: string;
}

/**
 * Complete table schema information
 */
export interface TableSchema {
  database: "world" | "auth" | "characters";
  table: string;
  columns: TableColumn[];
  indexes: TableIndex[];
  foreignKeys: ForeignKey[];
  engine: string;
  charset: string;
  collation: string;
  rowCount: number;
  dataSize: string;
  indexSize: string;
  comment: string;
}

/**
 * Schema comparison result
 */
export interface SchemaComparison {
  addedColumns: string[];
  removedColumns: string[];
  modifiedColumns: Array<{
    name: string;
    changes: string[];
  }>;
  addedIndexes: string[];
  removedIndexes: string[];
}

/**
 * Get database name based on type
 */
function getDatabaseName(database: "world" | "auth" | "characters"): string {
  const mapping = {
    world: process.env.TRINITY_DB_WORLD || "world",
    auth: process.env.TRINITY_DB_AUTH || "auth",
    characters: process.env.TRINITY_DB_CHARACTERS || "characters",
  };
  return mapping[database];
}

/**
 * Get query function for database type
 */
function getQueryFunction(database: "world" | "auth" | "characters") {
  const mapping = {
    world: queryWorld,
    auth: queryAuth,
    characters: queryCharacters,
  };
  return mapping[database];
}

/**
 * List all tables in a database
 */
export async function listTables(
  database: "world" | "auth" | "characters"
): Promise<string[]> {
  const dbName = getDatabaseName(database);
  const queryFn = getQueryFunction(database);

  const tables = await queryFn(
    `SELECT TABLE_NAME
     FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = ?
     ORDER BY TABLE_NAME`,
    [dbName]
  );

  return tables.map((row: any) => row.TABLE_NAME);
}

/**
 * Get detailed schema information for a table
 */
export async function getTableSchema(
  database: "world" | "auth" | "characters",
  tableName: string
): Promise<TableSchema> {
  const dbName = getDatabaseName(database);
  const queryFn = getQueryFunction(database);

  // Get column information
  const columnRows = await queryFn(
    `SELECT
      COLUMN_NAME as name,
      COLUMN_TYPE as type,
      IS_NULLABLE = 'YES' as nullable,
      COLUMN_DEFAULT as \`default\`,
      COLUMN_KEY as \`key\`,
      EXTRA as extra,
      COLUMN_COMMENT as comment
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
     ORDER BY ORDINAL_POSITION`,
    [dbName, tableName]
  );

  const columns: TableColumn[] = columnRows.map((row: any) => ({
    name: row.name,
    type: row.type,
    nullable: Boolean(row.nullable),
    default: row.default,
    key: row.key as "PRI" | "UNI" | "MUL" | "",
    extra: row.extra || "",
    comment: row.comment || "",
  }));

  // Get index information
  const indexRows = await queryFn(
    `SELECT
      INDEX_NAME as indexName,
      COLUMN_NAME as columnName,
      NON_UNIQUE as nonUnique,
      INDEX_TYPE as indexType,
      SEQ_IN_INDEX as seqInIndex
     FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
     ORDER BY INDEX_NAME, SEQ_IN_INDEX`,
    [dbName, tableName]
  );

  // Group columns by index name
  const indexMap = new Map<string, TableIndex>();
  for (const row of indexRows) {
    if (!indexMap.has(row.indexName)) {
      indexMap.set(row.indexName, {
        name: row.indexName,
        columns: [],
        unique: !row.nonUnique,
        type: row.indexType,
      });
    }
    indexMap.get(row.indexName)!.columns.push(row.columnName);
  }
  const indexes = Array.from(indexMap.values());

  // Get foreign key information
  const fkRows = await queryFn(
    `SELECT
      CONSTRAINT_NAME as constraintName,
      COLUMN_NAME as columnName,
      REFERENCED_TABLE_NAME as referencedTable,
      REFERENCED_COLUMN_NAME as referencedColumn
     FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
     WHERE TABLE_SCHEMA = ?
       AND TABLE_NAME = ?
       AND REFERENCED_TABLE_NAME IS NOT NULL`,
    [dbName, tableName]
  );

  const foreignKeys: ForeignKey[] = [];
  for (const row of fkRows) {
    // Get ON DELETE and ON UPDATE rules
    const rcRows = await queryFn(
      `SELECT
        DELETE_RULE as deleteRule,
        UPDATE_RULE as updateRule
       FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS
       WHERE CONSTRAINT_SCHEMA = ? AND CONSTRAINT_NAME = ?`,
      [dbName, row.constraintName]
    );

    foreignKeys.push({
      name: row.constraintName,
      column: row.columnName,
      referencedTable: row.referencedTable,
      referencedColumn: row.referencedColumn,
      onDelete: rcRows[0]?.deleteRule || "NO ACTION",
      onUpdate: rcRows[0]?.updateRule || "NO ACTION",
    });
  }

  // Get table statistics
  const tableRows = await queryFn(
    `SELECT
      ENGINE as engine,
      TABLE_COLLATION as collation,
      TABLE_ROWS as rowCount,
      DATA_LENGTH as dataLength,
      INDEX_LENGTH as indexLength,
      TABLE_COMMENT as comment
     FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
    [dbName, tableName]
  );

  const tableInfo = tableRows[0];

  return {
    database,
    table: tableName,
    columns,
    indexes,
    foreignKeys,
    engine: tableInfo.engine,
    charset: tableInfo.collation.split("_")[0], // Extract charset from collation
    collation: tableInfo.collation,
    rowCount: tableInfo.rowCount,
    dataSize: formatBytes(tableInfo.dataLength),
    indexSize: formatBytes(tableInfo.indexLength),
    comment: tableInfo.comment || "",
  };
}

/**
 * Search for tables matching a pattern
 */
export async function searchTables(
  database: "world" | "auth" | "characters",
  pattern: string
): Promise<string[]> {
  const dbName = getDatabaseName(database);
  const queryFn = getQueryFunction(database);

  const tables = await queryFn(
    `SELECT TABLE_NAME
     FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = ?
       AND TABLE_NAME LIKE ?
     ORDER BY TABLE_NAME`,
    [dbName, `%${pattern}%`]
  );

  return tables.map((row: any) => row.TABLE_NAME);
}

/**
 * Find tables with a specific column
 */
export async function findTablesWithColumn(
  database: "world" | "auth" | "characters",
  columnName: string
): Promise<Array<{ table: string; columnType: string }>> {
  const dbName = getDatabaseName(database);
  const queryFn = getQueryFunction(database);

  const results = await queryFn(
    `SELECT
      TABLE_NAME as tableName,
      COLUMN_TYPE as columnType
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = ? AND COLUMN_NAME = ?
     ORDER BY TABLE_NAME`,
    [dbName, columnName]
  );

  return results.map((row: any) => ({
    table: row.tableName,
    columnType: row.columnType,
  }));
}

/**
 * Get all foreign key relationships for a table
 */
export async function getTableRelationships(
  database: "world" | "auth" | "characters",
  tableName: string
): Promise<{
  outgoing: ForeignKey[];
  incoming: Array<{
    fromTable: string;
    fromColumn: string;
    toColumn: string;
  }>;
}> {
  const dbName = getDatabaseName(database);
  const queryFn = getQueryFunction(database);

  // Get outgoing foreign keys (this table references others)
  const outgoingRows = await queryFn(
    `SELECT
      kcu.CONSTRAINT_NAME as constraintName,
      kcu.COLUMN_NAME as columnName,
      kcu.REFERENCED_TABLE_NAME as referencedTable,
      kcu.REFERENCED_COLUMN_NAME as referencedColumn,
      rc.DELETE_RULE as deleteRule,
      rc.UPDATE_RULE as updateRule
     FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
     JOIN INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS rc
       ON kcu.CONSTRAINT_NAME = rc.CONSTRAINT_NAME
       AND kcu.CONSTRAINT_SCHEMA = rc.CONSTRAINT_SCHEMA
     WHERE kcu.TABLE_SCHEMA = ?
       AND kcu.TABLE_NAME = ?
       AND kcu.REFERENCED_TABLE_NAME IS NOT NULL`,
    [dbName, tableName]
  );

  const outgoing: ForeignKey[] = outgoingRows.map((row: any) => ({
    name: row.constraintName,
    column: row.columnName,
    referencedTable: row.referencedTable,
    referencedColumn: row.referencedColumn,
    onDelete: row.deleteRule,
    onUpdate: row.updateRule,
  }));

  // Get incoming foreign keys (other tables reference this table)
  const incomingRows = await queryFn(
    `SELECT
      TABLE_NAME as fromTable,
      COLUMN_NAME as fromColumn,
      REFERENCED_COLUMN_NAME as toColumn
     FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
     WHERE REFERENCED_TABLE_SCHEMA = ?
       AND REFERENCED_TABLE_NAME = ?`,
    [dbName, tableName]
  );

  const incoming = incomingRows.map((row: any) => ({
    fromTable: row.fromTable,
    fromColumn: row.fromColumn,
    toColumn: row.toColumn,
  }));

  return { outgoing, incoming };
}

/**
 * Compare two table schemas
 */
export async function compareSchemas(
  database: "world" | "auth" | "characters",
  table1: string,
  table2: string
): Promise<SchemaComparison> {
  const schema1 = await getTableSchema(database, table1);
  const schema2 = await getTableSchema(database, table2);

  // Compare columns
  const columns1 = new Map(schema1.columns.map((c) => [c.name, c]));
  const columns2 = new Map(schema2.columns.map((c) => [c.name, c]));

  const addedColumns: string[] = [];
  const removedColumns: string[] = [];
  const modifiedColumns: Array<{ name: string; changes: string[] }> = [];

  // Find added and modified columns
  for (const [name, col2] of columns2) {
    if (!columns1.has(name)) {
      addedColumns.push(name);
    } else {
      const col1 = columns1.get(name)!;
      const changes: string[] = [];

      if (col1.type !== col2.type) {
        changes.push(`type: ${col1.type} → ${col2.type}`);
      }
      if (col1.nullable !== col2.nullable) {
        changes.push(`nullable: ${col1.nullable} → ${col2.nullable}`);
      }
      if (col1.default !== col2.default) {
        changes.push(`default: ${col1.default} → ${col2.default}`);
      }
      if (col1.key !== col2.key) {
        changes.push(`key: ${col1.key} → ${col2.key}`);
      }

      if (changes.length > 0) {
        modifiedColumns.push({ name, changes });
      }
    }
  }

  // Find removed columns
  for (const name of columns1.keys()) {
    if (!columns2.has(name)) {
      removedColumns.push(name);
    }
  }

  // Compare indexes
  const indexes1 = new Set(schema1.indexes.map((i) => i.name));
  const indexes2 = new Set(schema2.indexes.map((i) => i.name));

  const addedIndexes = Array.from(indexes2).filter((i) => !indexes1.has(i));
  const removedIndexes = Array.from(indexes1).filter((i) => !indexes2.has(i));

  return {
    addedColumns,
    removedColumns,
    modifiedColumns,
    addedIndexes,
    removedIndexes,
  };
}

/**
 * Get database statistics
 */
export async function getDatabaseStats(
  database: "world" | "auth" | "characters"
): Promise<{
  totalTables: number;
  totalRows: number;
  totalDataSize: string;
  totalIndexSize: string;
  largestTables: Array<{
    name: string;
    rows: number;
    dataSize: string;
  }>;
}> {
  const dbName = getDatabaseName(database);
  const queryFn = getQueryFunction(database);

  const stats = await queryFn(
    `SELECT
      COUNT(*) as totalTables,
      SUM(TABLE_ROWS) as totalRows,
      SUM(DATA_LENGTH) as totalDataSize,
      SUM(INDEX_LENGTH) as totalIndexSize
     FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = ?`,
    [dbName]
  );

  const largest = await queryFn(
    `SELECT
      TABLE_NAME as name,
      TABLE_ROWS as rows,
      DATA_LENGTH as dataSize
     FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = ?
     ORDER BY DATA_LENGTH DESC
     LIMIT 10`,
    [dbName]
  );

  return {
    totalTables: stats[0].totalTables,
    totalRows: stats[0].totalRows,
    totalDataSize: formatBytes(stats[0].totalDataSize),
    totalIndexSize: formatBytes(stats[0].totalIndexSize),
    largestTables: largest.map((row: any) => ({
      name: row.name,
      rows: row.rows,
      dataSize: formatBytes(row.dataSize),
    })),
  };
}

/**
 * Generate CREATE TABLE statement for a table
 */
export async function getCreateTableStatement(
  database: "world" | "auth" | "characters",
  tableName: string
): Promise<string> {
  const queryFn = getQueryFunction(database);

  const result = await queryFn(`SHOW CREATE TABLE ${tableName}`, []);

  return result[0]["Create Table"];
}

/**
 * Find tables with missing indexes (tables without primary keys)
 */
export async function findTablesWithoutPrimaryKey(
  database: "world" | "auth" | "characters"
): Promise<string[]> {
  const dbName = getDatabaseName(database);
  const queryFn = getQueryFunction(database);

  const tables = await queryFn(
    `SELECT TABLE_NAME
     FROM INFORMATION_SCHEMA.TABLES t
     WHERE TABLE_SCHEMA = ?
       AND NOT EXISTS (
         SELECT 1
         FROM INFORMATION_SCHEMA.STATISTICS s
         WHERE s.TABLE_SCHEMA = t.TABLE_SCHEMA
           AND s.TABLE_NAME = t.TABLE_NAME
           AND s.INDEX_NAME = 'PRIMARY'
       )
     ORDER BY TABLE_NAME`,
    [dbName]
  );

  return tables.map((row: any) => row.TABLE_NAME);
}

/**
 * Analyze table for optimization opportunities
 */
export async function analyzeTable(
  database: "world" | "auth" | "characters",
  tableName: string
): Promise<{
  issues: Array<{
    type: "warning" | "info" | "error";
    message: string;
  }>;
  suggestions: string[];
}> {
  const schema = await getTableSchema(database, tableName);
  const issues: Array<{ type: "warning" | "info" | "error"; message: string }> = [];
  const suggestions: string[] = [];

  // Check for primary key
  const hasPrimaryKey = schema.columns.some((c) => c.key === "PRI");
  if (!hasPrimaryKey) {
    issues.push({
      type: "error",
      message: "Table has no primary key",
    });
    suggestions.push("Add a primary key for better performance and data integrity");
  }

  // Check for large VARCHAR columns
  const largeVarchars = schema.columns.filter((c) => {
    const match = c.type.match(/varchar\((\d+)\)/);
    return match && parseInt(match[1]) > 255;
  });
  if (largeVarchars.length > 0) {
    issues.push({
      type: "warning",
      message: `Found ${largeVarchars.length} VARCHAR columns larger than 255 characters`,
    });
    suggestions.push("Consider using TEXT type for large text fields");
  }

  // Check for TEXT/BLOB columns without indexes
  const textColumns = schema.columns.filter(
    (c) => c.type.includes("text") || c.type.includes("blob")
  );
  if (textColumns.length > 5) {
    issues.push({
      type: "info",
      message: `Table has ${textColumns.length} TEXT/BLOB columns`,
    });
  }

  // Check for nullable foreign keys
  const nullableFKs = schema.foreignKeys.filter((fk) => {
    const column = schema.columns.find((c) => c.name === fk.column);
    return column?.nullable;
  });
  if (nullableFKs.length > 0) {
    issues.push({
      type: "warning",
      message: `Found ${nullableFKs.length} nullable foreign key columns`,
    });
    suggestions.push("Consider making foreign key columns NOT NULL when appropriate");
  }

  // Check row count vs index count
  if (schema.rowCount > 10000 && schema.indexes.length < 3) {
    issues.push({
      type: "warning",
      message: "Large table with few indexes",
    });
    suggestions.push("Consider adding indexes on frequently queried columns");
  }

  return { issues, suggestions };
}

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}
