/**
 * Database Diff & Merge Utilities
 * Compare database schemas and merge changes
 */

import { diffLines, Change } from 'diff';
import type { TableSchema } from './schema-parser';

export interface SchemaDiff {
  type: 'added' | 'removed' | 'modified';
  table: string;
  field: 'table' | 'column' | 'index' | 'foreign_key';
  detail: string;
  severity: 'critical' | 'major' | 'minor';
  oldValue?: any;
  newValue?: any;
}

export interface MigrationScript {
  id: string;
  name: string;
  type: 'up' | 'down';
  sql: string[];
  description: string;
  createdAt: Date;
}

export interface ConflictResolution {
  conflict: SchemaDiff;
  resolution: 'keep-local' | 'keep-remote' | 'merge' | 'custom';
  customSql?: string;
}

/**
 * Compare two database schemas
 */
export function compareSchemas(
  localSchema: TableSchema[],
  remoteSchema: TableSchema[]
): SchemaDiff[] {
  const diffs: SchemaDiff[] = [];

  const localTableMap = new Map(localSchema.map((t) => [t.name, t]));
  const remoteTableMap = new Map(remoteSchema.map((t) => [t.name, t]));

  // Check for added tables
  for (const remoteTable of remoteSchema) {
    if (!localTableMap.has(remoteTable.name)) {
      diffs.push({
        type: 'added',
        table: remoteTable.name,
        field: 'table',
        detail: `Table ${remoteTable.name} was added`,
        severity: 'major',
        newValue: remoteTable,
      });
    }
  }

  // Check for removed tables
  for (const localTable of localSchema) {
    if (!remoteTableMap.has(localTable.name)) {
      diffs.push({
        type: 'removed',
        table: localTable.name,
        field: 'table',
        detail: `Table ${localTable.name} was removed`,
        severity: 'critical',
        oldValue: localTable,
      });
    }
  }

  // Check for modified tables
  for (const localTable of localSchema) {
    const remoteTable = remoteTableMap.get(localTable.name);
    if (remoteTable) {
      diffs.push(...compareTableSchemas(localTable, remoteTable));
    }
  }

  return diffs;
}

/**
 * Compare two table schemas
 */
function compareTableSchemas(
  localTable: TableSchema,
  remoteTable: TableSchema
): SchemaDiff[] {
  const diffs: SchemaDiff[] = [];

  const localColumnMap = new Map(localTable.columns.map((c) => [c.name, c]));
  const remoteColumnMap = new Map(remoteTable.columns.map((c) => [c.name, c]));

  // Check for added columns
  for (const remoteColumn of remoteTable.columns) {
    if (!localColumnMap.has(remoteColumn.name)) {
      diffs.push({
        type: 'added',
        table: localTable.name,
        field: 'column',
        detail: `Column ${remoteColumn.name} was added`,
        severity: 'major',
        newValue: remoteColumn,
      });
    }
  }

  // Check for removed columns
  for (const localColumn of localTable.columns) {
    if (!remoteColumnMap.has(localColumn.name)) {
      diffs.push({
        type: 'removed',
        table: localTable.name,
        field: 'column',
        detail: `Column ${localColumn.name} was removed`,
        severity: 'critical',
        oldValue: localColumn,
      });
    }
  }

  // Check for modified columns
  for (const localColumn of localTable.columns) {
    const remoteColumn = remoteColumnMap.get(localColumn.name);
    if (remoteColumn) {
      if (localColumn.type !== remoteColumn.type) {
        diffs.push({
          type: 'modified',
          table: localTable.name,
          field: 'column',
          detail: `Column ${localColumn.name} type changed from ${localColumn.type} to ${remoteColumn.type}`,
          severity: 'major',
          oldValue: localColumn,
          newValue: remoteColumn,
        });
      }

      if (localColumn.nullable !== remoteColumn.nullable) {
        diffs.push({
          type: 'modified',
          table: localTable.name,
          field: 'column',
          detail: `Column ${localColumn.name} nullable changed`,
          severity: 'minor',
          oldValue: localColumn,
          newValue: remoteColumn,
        });
      }

      if (localColumn.default !== remoteColumn.default) {
        diffs.push({
          type: 'modified',
          table: localTable.name,
          field: 'column',
          detail: `Column ${localColumn.name} default value changed`,
          severity: 'minor',
          oldValue: localColumn,
          newValue: remoteColumn,
        });
      }
    }
  }

  // Check indexes
  const localIndexMap = new Map(localTable.indexes.map((i) => [i.name, i]));
  const remoteIndexMap = new Map(remoteTable.indexes.map((i) => [i.name, i]));

  for (const remoteIndex of remoteTable.indexes) {
    if (!localIndexMap.has(remoteIndex.name)) {
      diffs.push({
        type: 'added',
        table: localTable.name,
        field: 'index',
        detail: `Index ${remoteIndex.name} was added`,
        severity: 'minor',
        newValue: remoteIndex,
      });
    }
  }

  for (const localIndex of localTable.indexes) {
    if (!remoteIndexMap.has(localIndex.name)) {
      diffs.push({
        type: 'removed',
        table: localTable.name,
        field: 'index',
        detail: `Index ${localIndex.name} was removed`,
        severity: 'minor',
        oldValue: localIndex,
      });
    }
  }

  // Check foreign keys
  const localFkMap = new Map(localTable.foreignKeys.map((fk) => [fk.constraintName, fk]));
  const remoteFkMap = new Map(remoteTable.foreignKeys.map((fk) => [fk.constraintName, fk]));

  for (const remoteFk of remoteTable.foreignKeys) {
    if (!localFkMap.has(remoteFk.constraintName)) {
      diffs.push({
        type: 'added',
        table: localTable.name,
        field: 'foreign_key',
        detail: `Foreign key ${remoteFk.constraintName} was added`,
        severity: 'major',
        newValue: remoteFk,
      });
    }
  }

  for (const localFk of localTable.foreignKeys) {
    if (!remoteFkMap.has(localFk.constraintName)) {
      diffs.push({
        type: 'removed',
        table: localTable.name,
        field: 'foreign_key',
        detail: `Foreign key ${localFk.constraintName} was removed`,
        severity: 'major',
        oldValue: localFk,
      });
    }
  }

  return diffs;
}

/**
 * Generate migration script from diffs
 */
export function generateMigrationScript(
  diffs: SchemaDiff[],
  direction: 'up' | 'down' = 'up'
): MigrationScript {
  const sql: string[] = [];
  const timestamp = Date.now();

  for (const diff of diffs) {
    const statement = generateMigrationStatement(diff, direction);
    if (statement) {
      sql.push(statement);
    }
  }

  return {
    id: `migration_${timestamp}`,
    name: `Migration ${new Date().toISOString().split('T')[0]}`,
    type: direction,
    sql,
    description: `Auto-generated migration with ${diffs.length} changes`,
    createdAt: new Date(),
  };
}

/**
 * Generate SQL statement for a single diff
 */
function generateMigrationStatement(
  diff: SchemaDiff,
  direction: 'up' | 'down'
): string | null {
  if (direction === 'up') {
    switch (diff.type) {
      case 'added':
        if (diff.field === 'table') {
          return `-- TODO: Add CREATE TABLE statement for ${diff.table}`;
        } else if (diff.field === 'column') {
          const col = diff.newValue;
          return `ALTER TABLE \`${diff.table}\` ADD COLUMN \`${col.name}\` ${col.type}${
            col.nullable ? '' : ' NOT NULL'
          }${col.default !== null ? ` DEFAULT '${col.default}'` : ''};`;
        } else if (diff.field === 'index') {
          const idx = diff.newValue;
          return `ALTER TABLE \`${diff.table}\` ADD ${idx.unique ? 'UNIQUE ' : ''}INDEX \`${
            idx.name
          }\` (${idx.columns.map((c: string) => `\`${c}\``).join(', ')});`;
        } else if (diff.field === 'foreign_key') {
          const fk = diff.newValue;
          return `ALTER TABLE \`${diff.table}\` ADD CONSTRAINT \`${fk.constraintName}\` FOREIGN KEY (\`${fk.columnName}\`) REFERENCES \`${fk.referencedTable}\` (\`${fk.referencedColumn}\`);`;
        }
        break;

      case 'removed':
        if (diff.field === 'table') {
          return `DROP TABLE IF EXISTS \`${diff.table}\`;`;
        } else if (diff.field === 'column') {
          return `ALTER TABLE \`${diff.table}\` DROP COLUMN \`${diff.oldValue.name}\`;`;
        } else if (diff.field === 'index') {
          return `ALTER TABLE \`${diff.table}\` DROP INDEX \`${diff.oldValue.name}\`;`;
        } else if (diff.field === 'foreign_key') {
          return `ALTER TABLE \`${diff.table}\` DROP FOREIGN KEY \`${diff.oldValue.constraintName}\`;`;
        }
        break;

      case 'modified':
        if (diff.field === 'column') {
          const col = diff.newValue;
          return `ALTER TABLE \`${diff.table}\` MODIFY COLUMN \`${col.name}\` ${col.type}${
            col.nullable ? '' : ' NOT NULL'
          }${col.default !== null ? ` DEFAULT '${col.default}'` : ''};`;
        }
        break;
    }
  } else {
    // Reverse operations for 'down' migration
    const reversedDiff = {
      ...diff,
      type: diff.type === 'added' ? 'removed' : diff.type === 'removed' ? 'added' : 'modified',
      oldValue: diff.newValue,
      newValue: diff.oldValue,
    } as SchemaDiff;

    return generateMigrationStatement(reversedDiff, 'up');
  }

  return null;
}

/**
 * Compare two SQL files
 */
export function compareSQLFiles(local: string, remote: string): Change[] {
  return diffLines(local, remote);
}

/**
 * Generate unified diff format
 */
export function generateUnifiedDiff(changes: Change[]): string {
  let diff = '';
  let lineNum = 1;

  for (const change of changes) {
    const lines = change.value.split('\n');

    for (let i = 0; i < lines.length - 1; i++) {
      if (change.added) {
        diff += `+ ${lines[i]}\n`;
      } else if (change.removed) {
        diff += `- ${lines[i]}\n`;
      } else {
        diff += `  ${lines[i]}\n`;
        lineNum++;
      }
    }
  }

  return diff;
}

/**
 * Detect conflicts in schema changes
 */
export function detectConflicts(diffs: SchemaDiff[]): SchemaDiff[] {
  const conflicts: SchemaDiff[] = [];

  // Group by table and field
  const groups = new Map<string, SchemaDiff[]>();

  for (const diff of diffs) {
    const key = `${diff.table}.${diff.field}`;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(diff);
  }

  // Check for conflicting changes
  for (const [key, group] of groups.entries()) {
    if (group.length > 1) {
      // Multiple changes to the same field could be a conflict
      const hasAddAndRemove = group.some((d) => d.type === 'added') && group.some((d) => d.type === 'removed');

      if (hasAddAndRemove) {
        conflicts.push(...group);
      }
    }
  }

  return conflicts;
}

/**
 * Merge schema changes with conflict resolution
 */
export function mergeSchemas(
  baseSchema: TableSchema[],
  localChanges: SchemaDiff[],
  remoteChanges: SchemaDiff[],
  resolutions: ConflictResolution[]
): { merged: TableSchema[]; conflicts: SchemaDiff[] } {
  const conflicts: SchemaDiff[] = [];
  let merged = JSON.parse(JSON.stringify(baseSchema)) as TableSchema[];

  // Apply local changes
  for (const change of localChanges) {
    const conflictingRemote = remoteChanges.find(
      (r) => r.table === change.table && r.field === change.field
    );

    if (conflictingRemote) {
      // Check if there's a resolution
      const resolution = resolutions.find(
        (res) => res.conflict.table === change.table && res.conflict.field === change.field
      );

      if (resolution) {
        // Apply resolved change
        merged = applyChange(merged, change, resolution.resolution === 'keep-local' ? change : conflictingRemote);
      } else {
        conflicts.push(change);
      }
    } else {
      merged = applyChange(merged, change, change);
    }
  }

  // Apply non-conflicting remote changes
  for (const change of remoteChanges) {
    const hasConflict = localChanges.some(
      (l) => l.table === change.table && l.field === change.field
    );

    if (!hasConflict) {
      merged = applyChange(merged, change, change);
    }
  }

  return { merged, conflicts };
}

/**
 * Apply a change to schema
 */
function applyChange(
  schema: TableSchema[],
  original: SchemaDiff,
  change: SchemaDiff
): TableSchema[] {
  const updated = [...schema];
  const tableIndex = updated.findIndex((t) => t.name === change.table);

  if (tableIndex === -1 && change.type === 'added' && change.field === 'table') {
    updated.push(change.newValue);
  } else if (tableIndex >= 0) {
    const table = { ...updated[tableIndex] };

    if (change.type === 'removed' && change.field === 'table') {
      updated.splice(tableIndex, 1);
    } else if (change.field === 'column') {
      if (change.type === 'added') {
        table.columns = [...table.columns, change.newValue];
      } else if (change.type === 'removed') {
        table.columns = table.columns.filter((c) => c.name !== change.oldValue.name);
      } else if (change.type === 'modified') {
        table.columns = table.columns.map((c) =>
          c.name === change.oldValue.name ? change.newValue : c
        );
      }
    }

    updated[tableIndex] = table;
  }

  return updated;
}

/**
 * Calculate diff statistics
 */
export function getDiffStatistics(diffs: SchemaDiff[]): {
  total: number;
  added: number;
  removed: number;
  modified: number;
  critical: number;
  major: number;
  minor: number;
} {
  return {
    total: diffs.length,
    added: diffs.filter((d) => d.type === 'added').length,
    removed: diffs.filter((d) => d.type === 'removed').length,
    modified: diffs.filter((d) => d.type === 'modified').length,
    critical: diffs.filter((d) => d.severity === 'critical').length,
    major: diffs.filter((d) => d.severity === 'major').length,
    minor: diffs.filter((d) => d.severity === 'minor').length,
  };
}
