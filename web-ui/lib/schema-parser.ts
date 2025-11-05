/**
 * Database Schema Parser and Analyzer
 * Parses and analyzes TrinityCore database schemas
 */

export interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
  key: 'PRI' | 'UNI' | 'MUL' | '';
  default: string | null;
  extra: string;
  comment?: string;
}

export interface ForeignKey {
  columnName: string;
  referencedTable: string;
  referencedColumn: string;
  constraintName: string;
  onDelete?: string;
  onUpdate?: string;
}

export interface IndexInfo {
  name: string;
  columns: string[];
  unique: boolean;
  type: string;
}

export interface TableSchema {
  name: string;
  columns: ColumnInfo[];
  primaryKeys: string[];
  foreignKeys: ForeignKey[];
  indexes: IndexInfo[];
  engine?: string;
  charset?: string;
  collation?: string;
  rowCount?: number;
  dataSize?: string;
  comment?: string;
}

export interface SchemaRelationship {
  from: string;
  to: string;
  fromColumn: string;
  toColumn: string;
  type: 'one-to-one' | 'one-to-many' | 'many-to-many';
}

/**
 * Parse column information from INFORMATION_SCHEMA
 */
export function parseColumnInfo(row: any): ColumnInfo {
  return {
    name: row.COLUMN_NAME,
    type: row.COLUMN_TYPE,
    nullable: row.IS_NULLABLE === 'YES',
    key: row.COLUMN_KEY as 'PRI' | 'UNI' | 'MUL' | '',
    default: row.COLUMN_DEFAULT,
    extra: row.EXTRA || '',
    comment: row.COLUMN_COMMENT || undefined,
  };
}

/**
 * Parse foreign key relationships
 */
export function parseForeignKey(row: any): ForeignKey {
  return {
    columnName: row.COLUMN_NAME,
    referencedTable: row.REFERENCED_TABLE_NAME,
    referencedColumn: row.REFERENCED_COLUMN_NAME,
    constraintName: row.CONSTRAINT_NAME,
    onDelete: row.DELETE_RULE,
    onUpdate: row.UPDATE_RULE,
  };
}

/**
 * Parse index information
 */
export function parseIndexInfo(rows: any[]): IndexInfo[] {
  const indexMap = new Map<string, IndexInfo>();

  for (const row of rows) {
    const indexName = row.INDEX_NAME;

    if (!indexMap.has(indexName)) {
      indexMap.set(indexName, {
        name: indexName,
        columns: [],
        unique: row.NON_UNIQUE === 0,
        type: row.INDEX_TYPE,
      });
    }

    const index = indexMap.get(indexName)!;
    index.columns.push(row.COLUMN_NAME);
  }

  return Array.from(indexMap.values());
}

/**
 * Build complete table schema
 */
export function buildTableSchema(
  tableName: string,
  columns: any[],
  foreignKeys: any[],
  indexes: any[],
  tableInfo?: any
): TableSchema {
  const columnInfos = columns.map(parseColumnInfo);
  const foreignKeyInfos = foreignKeys.map(parseForeignKey);
  const indexInfos = parseIndexInfo(indexes);
  const primaryKeys = columnInfos
    .filter(col => col.key === 'PRI')
    .map(col => col.name);

  return {
    name: tableName,
    columns: columnInfos,
    primaryKeys,
    foreignKeys: foreignKeyInfos,
    indexes: indexInfos,
    engine: tableInfo?.ENGINE,
    charset: tableInfo?.TABLE_COLLATION?.split('_')[0],
    collation: tableInfo?.TABLE_COLLATION,
    rowCount: tableInfo?.TABLE_ROWS,
    dataSize: tableInfo?.DATA_LENGTH ? formatBytes(tableInfo.DATA_LENGTH) : undefined,
    comment: tableInfo?.TABLE_COMMENT,
  };
}

/**
 * Detect relationship type between tables
 */
export function detectRelationshipType(
  fromTable: TableSchema,
  toTable: TableSchema,
  foreignKey: ForeignKey
): 'one-to-one' | 'one-to-many' | 'many-to-many' {
  // Check if foreign key column is unique or primary key
  const fromColumn = fromTable.columns.find(c => c.name === foreignKey.columnName);
  const isFromUnique = fromColumn?.key === 'PRI' || fromColumn?.key === 'UNI';

  const toColumn = toTable.columns.find(c => c.name === foreignKey.referencedColumn);
  const isToUnique = toColumn?.key === 'PRI' || toColumn?.key === 'UNI';

  if (isFromUnique && isToUnique) {
    return 'one-to-one';
  } else if (!isFromUnique && isToUnique) {
    return 'one-to-many';
  } else {
    // This is a simplified check - true many-to-many requires junction table detection
    return 'many-to-many';
  }
}

/**
 * Build schema relationships from foreign keys
 */
export function buildSchemaRelationships(tables: TableSchema[]): SchemaRelationship[] {
  const relationships: SchemaRelationship[] = [];
  const tableMap = new Map(tables.map(t => [t.name, t]));

  for (const table of tables) {
    for (const fk of table.foreignKeys) {
      const toTable = tableMap.get(fk.referencedTable);
      if (toTable) {
        relationships.push({
          from: table.name,
          to: fk.referencedTable,
          fromColumn: fk.columnName,
          toColumn: fk.referencedColumn,
          type: detectRelationshipType(table, toTable, fk),
        });
      }
    }
  }

  return relationships;
}

/**
 * Generate SQL CREATE TABLE statement
 */
export function generateCreateTableSQL(table: TableSchema): string {
  const lines: string[] = [`CREATE TABLE \`${table.name}\` (`];

  // Columns
  for (const col of table.columns) {
    let line = `  \`${col.name}\` ${col.type}`;
    if (!col.nullable) line += ' NOT NULL';
    if (col.default !== null) {
      if (col.default === 'CURRENT_TIMESTAMP') {
        line += ` DEFAULT ${col.default}`;
      } else {
        line += ` DEFAULT '${col.default}'`;
      }
    }
    if (col.extra) line += ` ${col.extra}`;
    if (col.comment) line += ` COMMENT '${col.comment.replace(/'/g, "''")}'`;
    lines.push(line + ',');
  }

  // Primary key
  if (table.primaryKeys.length > 0) {
    lines.push(`  PRIMARY KEY (${table.primaryKeys.map(k => `\`${k}\``).join(', ')}),`);
  }

  // Indexes
  for (const idx of table.indexes) {
    if (idx.name === 'PRIMARY') continue;
    const uniqueStr = idx.unique ? 'UNIQUE ' : '';
    lines.push(`  ${uniqueStr}KEY \`${idx.name}\` (${idx.columns.map(c => `\`${c}\``).join(', ')}),`);
  }

  // Foreign keys
  for (const fk of table.foreignKeys) {
    let fkLine = `  CONSTRAINT \`${fk.constraintName}\` FOREIGN KEY (\`${fk.columnName}\`) `;
    fkLine += `REFERENCES \`${fk.referencedTable}\` (\`${fk.referencedColumn}\`)`;
    if (fk.onDelete) fkLine += ` ON DELETE ${fk.onDelete}`;
    if (fk.onUpdate) fkLine += ` ON UPDATE ${fk.onUpdate}`;
    lines.push(fkLine + ',');
  }

  // Remove trailing comma from last line
  lines[lines.length - 1] = lines[lines.length - 1].slice(0, -1);

  lines.push(')');

  // Table options
  const options: string[] = [];
  if (table.engine) options.push(`ENGINE=${table.engine}`);
  if (table.charset) options.push(`DEFAULT CHARSET=${table.charset}`);
  if (table.collation) options.push(`COLLATE=${table.collation}`);
  if (table.comment) options.push(`COMMENT='${table.comment.replace(/'/g, "''")}'`);

  if (options.length > 0) {
    lines[lines.length - 1] += ' ' + options.join(' ');
  }

  lines[lines.length - 1] += ';';

  return lines.join('\n');
}

/**
 * Find tables related to a given table
 */
export function findRelatedTables(
  tableName: string,
  relationships: SchemaRelationship[],
  depth: number = 1
): Set<string> {
  const related = new Set<string>();
  const queue: Array<{ name: string; depth: number }> = [{ name: tableName, depth: 0 }];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const { name, depth: currentDepth } = queue.shift()!;

    if (visited.has(name) || currentDepth > depth) continue;
    visited.add(name);

    for (const rel of relationships) {
      if (rel.from === name && !visited.has(rel.to)) {
        related.add(rel.to);
        queue.push({ name: rel.to, depth: currentDepth + 1 });
      } else if (rel.to === name && !visited.has(rel.from)) {
        related.add(rel.from);
        queue.push({ name: rel.from, depth: currentDepth + 1 });
      }
    }
  }

  related.delete(tableName);
  return related;
}

/**
 * Format bytes to human-readable size
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Search tables by name or column
 */
export function searchSchema(
  tables: TableSchema[],
  query: string
): Array<{ table: string; matches: string[] }> {
  const results: Array<{ table: string; matches: string[] }> = [];
  const lowerQuery = query.toLowerCase();

  for (const table of tables) {
    const matches: string[] = [];

    // Match table name
    if (table.name.toLowerCase().includes(lowerQuery)) {
      matches.push(`Table: ${table.name}`);
    }

    // Match column names
    for (const col of table.columns) {
      if (col.name.toLowerCase().includes(lowerQuery)) {
        matches.push(`Column: ${col.name} (${col.type})`);
      }
    }

    // Match comments
    if (table.comment?.toLowerCase().includes(lowerQuery)) {
      matches.push(`Comment: ${table.comment}`);
    }

    if (matches.length > 0) {
      results.push({ table: table.name, matches });
    }
  }

  return results;
}

/**
 * Generate ALTER TABLE statements for schema differences
 */
export function generateAlterTableSQL(
  oldTable: TableSchema,
  newTable: TableSchema
): string[] {
  const statements: string[] = [];

  // Check for added columns
  for (const newCol of newTable.columns) {
    const oldCol = oldTable.columns.find(c => c.name === newCol.name);
    if (!oldCol) {
      let sql = `ALTER TABLE \`${newTable.name}\` ADD COLUMN \`${newCol.name}\` ${newCol.type}`;
      if (!newCol.nullable) sql += ' NOT NULL';
      if (newCol.default !== null) sql += ` DEFAULT '${newCol.default}'`;
      if (newCol.comment) sql += ` COMMENT '${newCol.comment.replace(/'/g, "''")}'`;
      statements.push(sql + ';');
    }
  }

  // Check for removed columns
  for (const oldCol of oldTable.columns) {
    const newCol = newTable.columns.find(c => c.name === oldCol.name);
    if (!newCol) {
      statements.push(`ALTER TABLE \`${newTable.name}\` DROP COLUMN \`${oldCol.name}\`;`);
    }
  }

  // Check for modified columns
  for (const newCol of newTable.columns) {
    const oldCol = oldTable.columns.find(c => c.name === newCol.name);
    if (oldCol && (
      oldCol.type !== newCol.type ||
      oldCol.nullable !== newCol.nullable ||
      oldCol.default !== newCol.default
    )) {
      let sql = `ALTER TABLE \`${newTable.name}\` MODIFY COLUMN \`${newCol.name}\` ${newCol.type}`;
      if (!newCol.nullable) sql += ' NOT NULL';
      if (newCol.default !== null) sql += ` DEFAULT '${newCol.default}'`;
      statements.push(sql + ';');
    }
  }

  return statements;
}
