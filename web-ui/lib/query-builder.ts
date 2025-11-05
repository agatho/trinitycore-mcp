/**
 * Visual SQL Query Builder
 * Builds SQL queries from visual components
 */

import { format } from 'sql-formatter';

export interface QueryTable {
  name: string;
  alias?: string;
}

export interface QueryColumn {
  table: string;
  column: string;
  alias?: string;
  aggregate?: 'COUNT' | 'SUM' | 'AVG' | 'MIN' | 'MAX' | 'GROUP_CONCAT';
}

export interface QueryJoin {
  type: 'INNER' | 'LEFT' | 'RIGHT' | 'FULL';
  table: string;
  alias?: string;
  on: {
    leftTable: string;
    leftColumn: string;
    operator: '=' | '!=' | '>' | '<' | '>=' | '<=';
    rightTable: string;
    rightColumn: string;
  };
}

export interface QueryCondition {
  type: 'AND' | 'OR';
  conditions: QueryWhere[];
}

export interface QueryWhere {
  table: string;
  column: string;
  operator: '=' | '!=' | '>' | '<' | '>=' | '<=' | 'LIKE' | 'IN' | 'NOT IN' | 'IS NULL' | 'IS NOT NULL' | 'BETWEEN';
  value?: any;
  value2?: any; // For BETWEEN
}

export interface QueryOrderBy {
  table: string;
  column: string;
  direction: 'ASC' | 'DESC';
}

export interface QueryGroupBy {
  table: string;
  column: string;
}

export interface QueryBuilder {
  select: QueryColumn[];
  from: QueryTable;
  joins: QueryJoin[];
  where: QueryCondition[];
  groupBy: QueryGroupBy[];
  having: QueryCondition[];
  orderBy: QueryOrderBy[];
  limit?: number;
  offset?: number;
}

/**
 * Build SELECT clause
 */
function buildSelectClause(columns: QueryColumn[]): string {
  if (columns.length === 0) {
    return 'SELECT *';
  }

  const cols = columns.map(col => {
    let colStr = `${col.table}.${col.column}`;

    if (col.aggregate) {
      colStr = `${col.aggregate}(${colStr})`;
    }

    if (col.alias) {
      colStr += ` AS ${col.alias}`;
    }

    return colStr;
  });

  return 'SELECT ' + cols.join(', ');
}

/**
 * Build FROM clause
 */
function buildFromClause(table: QueryTable): string {
  let fromStr = `FROM ${table.name}`;
  if (table.alias) {
    fromStr += ` AS ${table.alias}`;
  }
  return fromStr;
}

/**
 * Build JOIN clauses
 */
function buildJoinClauses(joins: QueryJoin[]): string {
  if (joins.length === 0) return '';

  return joins.map(join => {
    let joinStr = `${join.type} JOIN ${join.table}`;
    if (join.alias) {
      joinStr += ` AS ${join.alias}`;
    }

    const leftTable = join.on.leftTable;
    const rightTable = join.alias || join.table;

    joinStr += ` ON ${leftTable}.${join.on.leftColumn} ${join.on.operator} ${rightTable}.${join.on.rightColumn}`;

    return joinStr;
  }).join('\n');
}

/**
 * Build WHERE clause
 */
function buildWhereClause(conditions: QueryCondition[]): string {
  if (conditions.length === 0) return '';

  const whereStr = buildConditions(conditions);
  return whereStr ? `WHERE ${whereStr}` : '';
}

/**
 * Build conditions recursively
 */
function buildConditions(conditions: QueryCondition[]): string {
  if (conditions.length === 0) return '';

  const parts: string[] = [];

  for (const condition of conditions) {
    const condParts: string[] = [];

    for (const where of condition.conditions) {
      condParts.push(buildSingleCondition(where));
    }

    if (condParts.length > 0) {
      const joined = condParts.join(` ${condition.type} `);
      parts.push(condParts.length > 1 ? `(${joined})` : joined);
    }
  }

  return parts.join(' AND ');
}

/**
 * Build single WHERE condition
 */
function buildSingleCondition(where: QueryWhere): string {
  const column = `${where.table}.${where.column}`;

  switch (where.operator) {
    case 'IS NULL':
      return `${column} IS NULL`;
    case 'IS NOT NULL':
      return `${column} IS NOT NULL`;
    case 'BETWEEN':
      return `${column} BETWEEN ${formatValue(where.value)} AND ${formatValue(where.value2)}`;
    case 'IN':
    case 'NOT IN':
      if (Array.isArray(where.value)) {
        const values = where.value.map(formatValue).join(', ');
        return `${column} ${where.operator} (${values})`;
      }
      return `${column} ${where.operator} (${formatValue(where.value)})`;
    case 'LIKE':
      return `${column} LIKE ${formatValue(where.value)}`;
    default:
      return `${column} ${where.operator} ${formatValue(where.value)}`;
  }
}

/**
 * Format value for SQL
 */
function formatValue(value: any): string {
  if (value === null || value === undefined) {
    return 'NULL';
  }

  if (typeof value === 'string') {
    return `'${value.replace(/'/g, "''")}'`;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (value instanceof Date) {
    return `'${value.toISOString().slice(0, 19).replace('T', ' ')}'`;
  }

  return `'${String(value).replace(/'/g, "''")}'`;
}

/**
 * Build GROUP BY clause
 */
function buildGroupByClause(groupBy: QueryGroupBy[]): string {
  if (groupBy.length === 0) return '';

  const cols = groupBy.map(g => `${g.table}.${g.column}`).join(', ');
  return `GROUP BY ${cols}`;
}

/**
 * Build HAVING clause
 */
function buildHavingClause(conditions: QueryCondition[]): string {
  if (conditions.length === 0) return '';

  const havingStr = buildConditions(conditions);
  return havingStr ? `HAVING ${havingStr}` : '';
}

/**
 * Build ORDER BY clause
 */
function buildOrderByClause(orderBy: QueryOrderBy[]): string {
  if (orderBy.length === 0) return '';

  const cols = orderBy.map(o => `${o.table}.${o.column} ${o.direction}`).join(', ');
  return `ORDER BY ${cols}`;
}

/**
 * Build LIMIT clause
 */
function buildLimitClause(limit?: number, offset?: number): string {
  if (!limit) return '';

  let limitStr = `LIMIT ${limit}`;
  if (offset) {
    limitStr += ` OFFSET ${offset}`;
  }

  return limitStr;
}

/**
 * Build complete SQL query
 */
export function buildQuery(query: QueryBuilder): string {
  const parts: string[] = [
    buildSelectClause(query.select),
    buildFromClause(query.from),
    buildJoinClauses(query.joins),
    buildWhereClause(query.where),
    buildGroupByClause(query.groupBy),
    buildHavingClause(query.having),
    buildOrderByClause(query.orderBy),
    buildLimitClause(query.limit, query.offset),
  ];

  const sql = parts.filter(p => p.length > 0).join('\n');

  // Format SQL for readability
  return format(sql, {
    language: 'mysql',
    tabWidth: 2,
    keywordCase: 'upper',
    linesBetweenQueries: 2,
  });
}

/**
 * Create empty query builder
 */
export function createQueryBuilder(tableName: string): QueryBuilder {
  return {
    select: [],
    from: { name: tableName },
    joins: [],
    where: [],
    groupBy: [],
    having: [],
    orderBy: [],
  };
}

/**
 * Add column to SELECT
 */
export function addSelectColumn(
  query: QueryBuilder,
  table: string,
  column: string,
  alias?: string,
  aggregate?: QueryColumn['aggregate']
): QueryBuilder {
  return {
    ...query,
    select: [...query.select, { table, column, alias, aggregate }],
  };
}

/**
 * Add JOIN
 */
export function addJoin(
  query: QueryBuilder,
  type: QueryJoin['type'],
  table: string,
  leftTable: string,
  leftColumn: string,
  rightColumn: string,
  alias?: string
): QueryBuilder {
  return {
    ...query,
    joins: [
      ...query.joins,
      {
        type,
        table,
        alias,
        on: {
          leftTable,
          leftColumn,
          operator: '=',
          rightTable: alias || table,
          rightColumn,
        },
      },
    ],
  };
}

/**
 * Add WHERE condition
 */
export function addWhereCondition(
  query: QueryBuilder,
  table: string,
  column: string,
  operator: QueryWhere['operator'],
  value?: any,
  value2?: any,
  conditionType: 'AND' | 'OR' = 'AND'
): QueryBuilder {
  const where: QueryWhere = { table, column, operator, value, value2 };

  // Add to existing condition or create new one
  if (query.where.length > 0 && query.where[query.where.length - 1].type === conditionType) {
    const lastCondition = query.where[query.where.length - 1];
    return {
      ...query,
      where: [
        ...query.where.slice(0, -1),
        {
          ...lastCondition,
          conditions: [...lastCondition.conditions, where],
        },
      ],
    };
  } else {
    return {
      ...query,
      where: [...query.where, { type: conditionType, conditions: [where] }],
    };
  }
}

/**
 * Add GROUP BY
 */
export function addGroupBy(
  query: QueryBuilder,
  table: string,
  column: string
): QueryBuilder {
  return {
    ...query,
    groupBy: [...query.groupBy, { table, column }],
  };
}

/**
 * Add ORDER BY
 */
export function addOrderBy(
  query: QueryBuilder,
  table: string,
  column: string,
  direction: 'ASC' | 'DESC' = 'ASC'
): QueryBuilder {
  return {
    ...query,
    orderBy: [...query.orderBy, { table, column, direction }],
  };
}

/**
 * Set LIMIT
 */
export function setLimit(
  query: QueryBuilder,
  limit: number,
  offset?: number
): QueryBuilder {
  return {
    ...query,
    limit,
    offset,
  };
}

/**
 * Generate common query templates
 */
export const QueryTemplates = {
  /**
   * Select all from table
   */
  selectAll: (table: string): QueryBuilder => ({
    select: [],
    from: { name: table },
    joins: [],
    where: [],
    groupBy: [],
    having: [],
    orderBy: [],
  }),

  /**
   * Count rows
   */
  count: (table: string, column: string = '*'): QueryBuilder => ({
    select: [{ table, column, aggregate: 'COUNT', alias: 'count' }],
    from: { name: table },
    joins: [],
    where: [],
    groupBy: [],
    having: [],
    orderBy: [],
  }),

  /**
   * Find by ID
   */
  findById: (table: string, idColumn: string, idValue: any): QueryBuilder => ({
    select: [],
    from: { name: table },
    joins: [],
    where: [
      {
        type: 'AND',
        conditions: [{ table, column: idColumn, operator: '=', value: idValue }],
      },
    ],
    groupBy: [],
    having: [],
    orderBy: [],
    limit: 1,
  }),

  /**
   * Search by text field
   */
  search: (table: string, column: string, searchText: string): QueryBuilder => ({
    select: [],
    from: { name: table },
    joins: [],
    where: [
      {
        type: 'AND',
        conditions: [{ table, column, operator: 'LIKE', value: `%${searchText}%` }],
      },
    ],
    groupBy: [],
    having: [],
    orderBy: [],
  }),
};

/**
 * Validate query builder
 */
export function validateQuery(query: QueryBuilder): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!query.from || !query.from.name) {
    errors.push('FROM table is required');
  }

  // Check that all referenced tables exist in FROM or JOINs
  const availableTables = new Set<string>([query.from.name]);
  for (const join of query.joins) {
    availableTables.add(join.alias || join.table);
  }

  for (const col of query.select) {
    if (!availableTables.has(col.table)) {
      errors.push(`SELECT references unknown table: ${col.table}`);
    }
  }

  for (const condition of query.where) {
    for (const where of condition.conditions) {
      if (!availableTables.has(where.table)) {
        errors.push(`WHERE references unknown table: ${where.table}`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
