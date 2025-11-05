import { NextRequest, NextResponse } from 'next/server';
import { parseSlowQuery, parseExplain, analyzeExplain, calculateBufferPoolHitRate, generateRecommendations, calculatePerformanceScore, detectNPlusOnePatterns } from '@/lib/performance-analyzer';
import type { SlowQuery, PerformanceMetrics } from '@/lib/performance-analyzer';

/**
 * GET /api/profiler - Get performance profiling data
 * Query params:
 *   - action: 'slow-queries' | 'explain' | 'metrics' | 'recommendations'
 *   - limit: number of results (default: 20)
 *   - query: SQL query to explain (for action=explain)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get('action') || 'metrics';
    const limit = parseInt(searchParams.get('limit') || '20');
    const query = searchParams.get('query');

    switch (action) {
      case 'slow-queries':
        return NextResponse.json(await getSlowQueries(limit));

      case 'explain':
        if (!query) {
          return NextResponse.json(
            { error: 'Query is required for EXPLAIN' },
            { status: 400 }
          );
        }
        return NextResponse.json(await explainQuery(query));

      case 'metrics':
        return NextResponse.json(await getPerformanceMetrics());

      case 'recommendations':
        return NextResponse.json(await getRecommendations());

      case 'n-plus-one':
        return NextResponse.json(await detectNPlusOne());

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error: any) {
    console.error('Profiler API error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Get slow queries from performance_schema
 */
async function getSlowQueries(limit: number) {
  // TODO: Call MCP tool to get actual data
  // For now, return mock data

  const mockQueries: SlowQuery[] = [
    {
      digest: 'abc123',
      query: 'SELECT * FROM creature_template WHERE entry IN (1,2,3,4,5,6,7,8,9,10) AND faction > 0',
      schema: 'world',
      executionCount: 1523,
      totalTime: 45.3,
      avgTime: 0.0298,
      minTime: 0.001,
      maxTime: 2.5,
      rowsExamined: 152300,
      rowsSent: 1523,
      lastSeen: new Date(),
    },
    {
      digest: 'def456',
      query: 'SELECT ct.*, c.guid FROM creature c JOIN creature_template ct ON c.id = ct.entry WHERE c.map = 0 ORDER BY ct.name',
      schema: 'world',
      executionCount: 892,
      totalTime: 89.2,
      avgTime: 0.1,
      minTime: 0.05,
      maxTime: 5.2,
      rowsExamined: 445000,
      rowsSent: 8920,
      lastSeen: new Date(),
    },
    {
      digest: 'ghi789',
      query: 'SELECT * FROM item_template WHERE class = 2 AND subclass = 15 AND quality >= 3',
      schema: 'world',
      executionCount: 2341,
      totalTime: 23.4,
      avgTime: 0.01,
      minTime: 0.005,
      maxTime: 0.5,
      rowsExamined: 62341,
      rowsSent: 234,
      lastSeen: new Date(),
    },
  ];

  return {
    queries: mockQueries.slice(0, limit),
    total: mockQueries.length,
  };
}

/**
 * Explain a query
 */
async function explainQuery(query: string) {
  // TODO: Call MCP tool to get actual EXPLAIN data
  // For now, return mock data

  const mockExplain = [
    {
      id: 1,
      select_type: 'SIMPLE',
      table: 'creature_template',
      type: 'ALL',
      possible_keys: 'PRIMARY,idx_entry',
      key: null,
      key_len: null,
      ref: null,
      rows: 45231,
      filtered: 10.0,
      Extra: 'Using where; Using filesort',
    },
  ];

  const parsed = parseExplain(mockExplain);
  const suggestions = analyzeExplain(parsed);

  return {
    query,
    explain: parsed,
    suggestions,
  };
}

/**
 * Get current performance metrics
 */
async function getPerformanceMetrics(): Promise<{ metrics: PerformanceMetrics; score: number }> {
  // TODO: Call MCP tool to get actual metrics
  // For now, return mock data

  const metrics: PerformanceMetrics = {
    queries: {
      total: 1523456,
      perSecond: 125.3,
      slow: 2341,
      cached: 892341,
    },
    connections: {
      current: 45,
      max: 150,
      aborted: 12,
    },
    innodb: {
      bufferPoolSize: '128 MB',
      bufferPoolHitRate: 98.5,
      rowsRead: 9234123,
      rowsInserted: 23451,
      rowsUpdated: 12341,
      rowsDeleted: 892,
    },
    tables: {
      openTables: 256,
      openedTables: 1234,
      tableLocksWaited: 45,
    },
  };

  const score = calculatePerformanceScore(metrics);

  return {
    metrics,
    score,
  };
}

/**
 * Get optimization recommendations
 */
async function getRecommendations() {
  const { metrics } = await getPerformanceMetrics();
  const { queries } = await getSlowQueries(20);

  const recommendations = generateRecommendations(queries, metrics);

  return {
    recommendations,
    count: recommendations.length,
  };
}

/**
 * Detect N+1 query patterns
 */
async function detectNPlusOne() {
  const { queries } = await getSlowQueries(100);
  const patterns = detectNPlusOnePatterns(queries);

  return {
    patterns,
    count: patterns.length,
  };
}
