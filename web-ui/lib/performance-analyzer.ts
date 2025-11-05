/**
 * Performance Analysis Utilities
 * Analyzes database query performance and identifies bottlenecks
 */

export interface SlowQuery {
  digest: string;
  query: string;
  schema: string;
  executionCount: number;
  totalTime: number;
  avgTime: number;
  minTime: number;
  maxTime: number;
  rowsExamined: number;
  rowsSent: number;
  lastSeen: Date;
}

export interface QueryExplain {
  id: number;
  selectType: string;
  table: string;
  type: string;
  possibleKeys: string[];
  key: string | null;
  keyLen: number | null;
  ref: string | null;
  rows: number;
  filtered: number;
  extra: string;
}

export interface IndexSuggestion {
  table: string;
  columns: string[];
  reason: string;
  impact: 'high' | 'medium' | 'low';
  estimatedImprovement: string;
}

export interface PerformanceMetrics {
  queries: {
    total: number;
    perSecond: number;
    slow: number;
    cached: number;
  };
  connections: {
    current: number;
    max: number;
    aborted: number;
  };
  innodb: {
    bufferPoolSize: string;
    bufferPoolHitRate: number;
    rowsRead: number;
    rowsInserted: number;
    rowsUpdated: number;
    rowsDeleted: number;
  };
  tables: {
    openTables: number;
    openedTables: number;
    tableLocksWaited: number;
  };
}

/**
 * Parse slow query log entry
 */
export function parseSlowQuery(row: any): SlowQuery {
  return {
    digest: row.DIGEST || row.digest,
    query: row.QUERY_SAMPLE_TEXT || row.query_sample_text || row.query,
    schema: row.SCHEMA_NAME || row.schema_name,
    executionCount: parseInt(row.COUNT_STAR || row.count_star || '0'),
    totalTime: parseFloat(row.SUM_TIMER_WAIT || row.sum_timer_wait || '0') / 1000000000, // Convert picoseconds to seconds
    avgTime: parseFloat(row.AVG_TIMER_WAIT || row.avg_timer_wait || '0') / 1000000000,
    minTime: parseFloat(row.MIN_TIMER_WAIT || row.min_timer_wait || '0') / 1000000000,
    maxTime: parseFloat(row.MAX_TIMER_WAIT || row.max_timer_wait || '0') / 1000000000,
    rowsExamined: parseInt(row.SUM_ROWS_EXAMINED || row.sum_rows_examined || '0'),
    rowsSent: parseInt(row.SUM_ROWS_SENT || row.sum_rows_sent || '0'),
    lastSeen: new Date(row.LAST_SEEN || row.last_seen || Date.now()),
  };
}

/**
 * Parse EXPLAIN output
 */
export function parseExplain(rows: any[]): QueryExplain[] {
  return rows.map((row) => ({
    id: parseInt(row.id || '0'),
    selectType: row.select_type || row.selectType,
    table: row.table,
    type: row.type,
    possibleKeys: row.possible_keys ? row.possible_keys.split(',') : [],
    key: row.key || null,
    keyLen: row.key_len ? parseInt(row.key_len) : null,
    ref: row.ref || null,
    rows: parseInt(row.rows || '0'),
    filtered: parseFloat(row.filtered || '100'),
    extra: row.Extra || row.extra || '',
  }));
}

/**
 * Analyze EXPLAIN output and suggest optimizations
 */
export function analyzeExplain(explain: QueryExplain[]): IndexSuggestion[] {
  const suggestions: IndexSuggestion[] = [];

  for (const step of explain) {
    // Full table scan detected
    if (step.type === 'ALL' && step.rows > 1000) {
      suggestions.push({
        table: step.table,
        columns: step.possibleKeys.length > 0 ? step.possibleKeys : ['id'],
        reason: `Full table scan on ${step.rows.toLocaleString()} rows. Consider adding an index.`,
        impact: step.rows > 100000 ? 'high' : step.rows > 10000 ? 'medium' : 'low',
        estimatedImprovement: `Could reduce scan from ${step.rows.toLocaleString()} to ~${Math.ceil(step.rows * step.filtered / 100).toLocaleString()} rows`,
      });
    }

    // Using filesort
    if (step.extra.includes('Using filesort')) {
      suggestions.push({
        table: step.table,
        columns: ['ORDER BY columns'],
        reason: 'Query uses filesort which is expensive. Consider adding an index on ORDER BY columns.',
        impact: step.rows > 10000 ? 'high' : 'medium',
        estimatedImprovement: 'Eliminate filesort operation',
      });
    }

    // Using temporary table
    if (step.extra.includes('Using temporary')) {
      suggestions.push({
        table: step.table,
        columns: ['GROUP BY columns'],
        reason: 'Query uses temporary table. Consider adding an index on GROUP BY columns.',
        impact: 'medium',
        estimatedImprovement: 'Avoid temporary table creation',
      });
    }

    // Low filtered percentage
    if (step.filtered < 10 && step.rows > 1000) {
      suggestions.push({
        table: step.table,
        columns: step.ref ? step.ref.split(',') : [],
        reason: `Only ${step.filtered}% of rows match WHERE conditions. Index selectivity is poor.`,
        impact: 'medium',
        estimatedImprovement: 'Improve index selectivity',
      });
    }
  }

  return suggestions;
}

/**
 * Calculate InnoDB buffer pool hit rate
 */
export function calculateBufferPoolHitRate(
  reads: number,
  readRequests: number
): number {
  if (readRequests === 0) return 100;
  return ((readRequests - reads) / readRequests) * 100;
}

/**
 * Format time duration
 */
export function formatDuration(seconds: number): string {
  if (seconds < 0.001) {
    return `${(seconds * 1000000).toFixed(0)} μs`;
  } else if (seconds < 1) {
    return `${(seconds * 1000).toFixed(2)} ms`;
  } else if (seconds < 60) {
    return `${seconds.toFixed(2)} s`;
  } else {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}m ${secs.toFixed(0)}s`;
  }
}

/**
 * Categorize query type
 */
export function categorizeQuery(query: string): string {
  const upperQuery = query.trim().toUpperCase();

  if (upperQuery.startsWith('SELECT')) {
    if (upperQuery.includes('JOIN')) return 'SELECT with JOIN';
    if (upperQuery.includes('GROUP BY')) return 'SELECT with GROUP BY';
    if (upperQuery.includes('ORDER BY')) return 'SELECT with ORDER BY';
    if (upperQuery.includes('WHERE')) return 'SELECT with WHERE';
    return 'SELECT';
  }

  if (upperQuery.startsWith('INSERT')) return 'INSERT';
  if (upperQuery.startsWith('UPDATE')) return 'UPDATE';
  if (upperQuery.startsWith('DELETE')) return 'DELETE';
  if (upperQuery.startsWith('REPLACE')) return 'REPLACE';
  if (upperQuery.startsWith('CREATE')) return 'DDL (CREATE)';
  if (upperQuery.startsWith('ALTER')) return 'DDL (ALTER)';
  if (upperQuery.startsWith('DROP')) return 'DDL (DROP)';

  return 'OTHER';
}

/**
 * Generate optimization recommendations
 */
export function generateRecommendations(
  slowQueries: SlowQuery[],
  metrics: PerformanceMetrics
): string[] {
  const recommendations: string[] = [];

  // Check buffer pool hit rate
  if (metrics.innodb.bufferPoolHitRate < 95) {
    recommendations.push(
      `InnoDB buffer pool hit rate is ${metrics.innodb.bufferPoolHitRate.toFixed(1)}% (target: >95%). ` +
      `Consider increasing innodb_buffer_pool_size to ${metrics.innodb.bufferPoolSize}.`
    );
  }

  // Check table locks
  if (metrics.tables.tableLocksWaited > 100) {
    recommendations.push(
      `High table lock waits (${metrics.tables.tableLocksWaited}). ` +
      'Consider using InnoDB tables instead of MyISAM for better concurrency.'
    );
  }

  // Check opened tables
  const tableOpenRate = metrics.tables.openedTables / metrics.queries.total;
  if (tableOpenRate > 0.1) {
    recommendations.push(
      `High table open rate (${(tableOpenRate * 100).toFixed(1)}% of queries). ` +
      'Consider increasing table_open_cache.'
    );
  }

  // Check slow queries
  const slowQueryRate = (metrics.queries.slow / metrics.queries.total) * 100;
  if (slowQueryRate > 1) {
    recommendations.push(
      `${slowQueryRate.toFixed(1)}% of queries are slow (target: <1%). ` +
      'Review and optimize slow queries below.'
    );
  }

  // Check connection usage
  const connectionUsage = (metrics.connections.current / metrics.connections.max) * 100;
  if (connectionUsage > 80) {
    recommendations.push(
      `Connection pool usage is ${connectionUsage.toFixed(0)}% (${metrics.connections.current}/${metrics.connections.max}). ` +
      'Consider increasing max_connections or implementing connection pooling.'
    );
  }

  // Analyze top slow queries
  const topQueries = slowQueries.slice(0, 5);
  for (const query of topQueries) {
    const scanRate = query.rowsExamined / Math.max(query.rowsSent, 1);
    if (scanRate > 100) {
      recommendations.push(
        `Query examines ${scanRate.toFixed(0)}x more rows than it returns. ` +
        `Add indexes to improve efficiency: ${query.query.substring(0, 100)}...`
      );
    }
  }

  return recommendations;
}

/**
 * Calculate query efficiency score (0-100)
 */
export function calculateQueryEfficiency(query: SlowQuery): number {
  let score = 100;

  // Penalize for high execution time
  if (query.avgTime > 10) score -= 50;
  else if (query.avgTime > 1) score -= 30;
  else if (query.avgTime > 0.1) score -= 10;

  // Penalize for high row examination ratio
  const scanRate = query.rowsExamined / Math.max(query.rowsSent, 1);
  if (scanRate > 1000) score -= 30;
  else if (scanRate > 100) score -= 20;
  else if (scanRate > 10) score -= 10;

  // Penalize for high execution count with slow avg time
  if (query.executionCount > 1000 && query.avgTime > 0.1) {
    score -= 20;
  }

  return Math.max(0, Math.min(100, score));
}

/**
 * Group queries by pattern (normalize literals)
 */
export function normalizeQuery(query: string): string {
  return query
    .replace(/\d+/g, '?') // Replace numbers with ?
    .replace(/'[^']*'/g, '?') // Replace string literals with ?
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

/**
 * Detect N+1 query patterns
 */
export function detectNPlusOnePatterns(queries: SlowQuery[]): Array<{
  pattern: string;
  count: number;
  totalTime: number;
  suggestion: string;
}> {
  const patterns = new Map<string, { count: number; totalTime: number; sample: string }>();

  for (const query of queries) {
    if (query.executionCount < 10) continue; // Only look for repeated queries

    const normalized = normalizeQuery(query.query);
    const existing = patterns.get(normalized);

    if (existing) {
      existing.count += query.executionCount;
      existing.totalTime += query.totalTime;
    } else {
      patterns.set(normalized, {
        count: query.executionCount,
        totalTime: query.totalTime,
        sample: query.query,
      });
    }
  }

  const results: Array<{
    pattern: string;
    count: number;
    totalTime: number;
    suggestion: string;
  }> = [];

  for (const [pattern, data] of patterns.entries()) {
    if (data.count > 100 && data.totalTime > 1) {
      results.push({
        pattern: data.sample,
        count: data.count,
        totalTime: data.totalTime,
        suggestion: 'Consider using JOIN or batch loading to reduce query count',
      });
    }
  }

  return results.sort((a, b) => b.totalTime - a.totalTime).slice(0, 5);
}

/**
 * Calculate performance score (0-100)
 */
export function calculatePerformanceScore(metrics: PerformanceMetrics): number {
  let score = 100;

  // Buffer pool hit rate (0-30 points)
  const hitRateScore = (metrics.innodb.bufferPoolHitRate / 100) * 30;
  score = hitRateScore;

  // Slow query rate (0-30 points)
  const slowQueryRate = metrics.queries.slow / Math.max(metrics.queries.total, 1);
  const slowQueryScore = Math.max(0, 30 - slowQueryRate * 3000);
  score += slowQueryScore;

  // Connection efficiency (0-20 points)
  const connectionUsage = metrics.connections.current / metrics.connections.max;
  const connectionScore = connectionUsage < 0.8 ? 20 : 20 - (connectionUsage - 0.8) * 100;
  score += Math.max(0, connectionScore);

  // Table lock efficiency (0-20 points)
  const lockRate = metrics.tables.tableLocksWaited / Math.max(metrics.queries.total, 1);
  const lockScore = Math.max(0, 20 - lockRate * 1000);
  score += lockScore;

  return Math.max(0, Math.min(100, Math.round(score)));
}
