'use client';

/**
 * Performance Profiling Dashboard
 * Real-time database performance monitoring and query optimization
 */

import React, { useState, useEffect } from 'react';
import { Activity, Zap, AlertTriangle, TrendingUp, RefreshCw, Clock, Database, Target } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { TrendChart } from '@/components/charts/TrendChart';
import { formatDuration, calculateQueryEfficiency, categorizeQuery } from '@/lib/performance-analyzer';
import type { SlowQuery, PerformanceMetrics, IndexSuggestion } from '@/lib/performance-analyzer';

export default function ProfilerPage() {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [performanceScore, setPerformanceScore] = useState<number>(0);
  const [slowQueries, setSlowQueries] = useState<SlowQuery[]>([]);
  const [recommendations, setRecommendations] = useState<string[]>([]);
  const [nPlusOnePatterns, setNPlusOnePatterns] = useState<any[]>([]);
  const [selectedQuery, setSelectedQuery] = useState<SlowQuery | null>(null);
  const [explainData, setExplainData] = useState<{ explain: any[]; suggestions: IndexSuggestion[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  // Historical data for trends
  const [metricsHistory, setMetricsHistory] = useState<any[]>([]);

  useEffect(() => {
    loadAllData();
  }, []);

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(() => {
        loadAllData();
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const loadAllData = async () => {
    await Promise.all([
      loadMetrics(),
      loadSlowQueries(),
      loadRecommendations(),
      loadNPlusOnePatterns(),
    ]);
  };

  const loadMetrics = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/profiler?action=metrics');
      const data = await response.json();
      setMetrics(data.metrics);
      setPerformanceScore(data.score);

      // Add to history
      setMetricsHistory((prev) => {
        const newHistory = [
          ...prev,
          {
            timestamp: Date.now(),
            qps: data.metrics.queries.perSecond,
            connections: data.metrics.connections.current,
            hitRate: data.metrics.innodb.bufferPoolHitRate,
          },
        ];
        return newHistory.slice(-20); // Keep last 20 data points
      });
    } catch (error) {
      console.error('Failed to load metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSlowQueries = async () => {
    try {
      const response = await fetch('/api/profiler?action=slow-queries&limit=50');
      const data = await response.json();
      setSlowQueries(data.queries);
    } catch (error) {
      console.error('Failed to load slow queries:', error);
    }
  };

  const loadRecommendations = async () => {
    try {
      const response = await fetch('/api/profiler?action=recommendations');
      const data = await response.json();
      setRecommendations(data.recommendations);
    } catch (error) {
      console.error('Failed to load recommendations:', error);
    }
  };

  const loadNPlusOnePatterns = async () => {
    try {
      const response = await fetch('/api/profiler?action=n-plus-one');
      const data = await response.json();
      setNPlusOnePatterns(data.patterns);
    } catch (error) {
      console.error('Failed to load N+1 patterns:', error);
    }
  };

  const explainQuery = async (query: SlowQuery) => {
    try {
      setSelectedQuery(query);
      setLoading(true);
      const response = await fetch(
        `/api/profiler?action=explain&query=${encodeURIComponent(query.query)}`
      );
      const data = await response.json();
      setExplainData(data);
    } catch (error) {
      console.error('Failed to explain query:', error);
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-400';
    if (score >= 60) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getScoreBackground = (score: number) => {
    if (score >= 80) return 'bg-green-500/10 border-green-500/30';
    if (score >= 60) return 'bg-yellow-500/10 border-yellow-500/30';
    return 'bg-red-500/10 border-red-500/30';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8">
      <div className="max-w-[1800px] mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Activity className="w-8 h-8 text-purple-400" />
              <div>
                <h1 className="text-3xl font-bold text-white">Performance Profiler</h1>
                <p className="text-slate-400">Real-time database performance monitoring</p>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant={autoRefresh ? 'default' : 'outline'}
                onClick={() => setAutoRefresh(!autoRefresh)}
                className="flex items-center gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${autoRefresh ? 'animate-spin' : ''}`} />
                {autoRefresh ? 'Auto-Refresh On' : 'Auto-Refresh Off'}
              </Button>
              <Button onClick={loadAllData} disabled={loading}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh Now
              </Button>
            </div>
          </div>

          {/* Performance Score */}
          <div className={`p-6 rounded-lg border ${getScoreBackground(performanceScore)}`}>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-slate-400 mb-1">Overall Performance Score</div>
                <div className={`text-5xl font-bold ${getScoreColor(performanceScore)}`}>
                  {performanceScore}
                  <span className="text-2xl">/100</span>
                </div>
              </div>
              <Target className="w-16 h-16 text-slate-600" />
            </div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-slate-800/50 border-b border-slate-700">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="slow-queries">Slow Queries</TabsTrigger>
            <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
            <TabsTrigger value="n-plus-one">N+1 Detection</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="mt-6 space-y-6">
            {/* Metrics Cards */}
            {metrics && (
              <div className="grid grid-cols-4 gap-6">
                {/* Queries Per Second */}
                <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="text-sm text-slate-400">Queries/Second</div>
                    <Zap className="w-5 h-5 text-blue-400" />
                  </div>
                  <div className="text-3xl font-bold text-white mb-1">
                    {metrics.queries.perSecond.toFixed(1)}
                  </div>
                  <div className="text-xs text-slate-500">
                    {metrics.queries.total.toLocaleString()} total queries
                  </div>
                </div>

                {/* Buffer Pool Hit Rate */}
                <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="text-sm text-slate-400">Buffer Pool Hit Rate</div>
                    <TrendingUp className="w-5 h-5 text-green-400" />
                  </div>
                  <div className="text-3xl font-bold text-white mb-1">
                    {metrics.innodb.bufferPoolHitRate.toFixed(1)}%
                  </div>
                  <div className="text-xs text-slate-500">
                    Target: &gt;95%
                  </div>
                </div>

                {/* Active Connections */}
                <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="text-sm text-slate-400">Connections</div>
                    <Database className="w-5 h-5 text-purple-400" />
                  </div>
                  <div className="text-3xl font-bold text-white mb-1">
                    {metrics.connections.current}
                    <span className="text-lg text-slate-500">/{metrics.connections.max}</span>
                  </div>
                  <div className="text-xs text-slate-500">
                    {((metrics.connections.current / metrics.connections.max) * 100).toFixed(0)}% usage
                  </div>
                </div>

                {/* Slow Queries */}
                <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="text-sm text-slate-400">Slow Queries</div>
                    <Clock className="w-5 h-5 text-yellow-400" />
                  </div>
                  <div className="text-3xl font-bold text-white mb-1">
                    {metrics.queries.slow.toLocaleString()}
                  </div>
                  <div className="text-xs text-slate-500">
                    {((metrics.queries.slow / metrics.queries.total) * 100).toFixed(2)}% of total
                  </div>
                </div>
              </div>
            )}

            {/* Trend Charts */}
            {metricsHistory.length > 1 && (
              <div className="grid grid-cols-2 gap-6">
                <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">Queries Per Second</h3>
                  <TrendChart
                    data={metricsHistory.map((m) => ({
                      timestamp: m.timestamp,
                      qps: m.qps,
                    }))}
                    lines={[
                      { key: 'qps', name: 'QPS', color: '#3b82f6' },
                    ]}
                    height={200}
                    showLegend={false}
                  />
                </div>

                <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">Buffer Pool Hit Rate</h3>
                  <TrendChart
                    data={metricsHistory.map((m) => ({
                      timestamp: m.timestamp,
                      hitRate: m.hitRate,
                    }))}
                    lines={[
                      { key: 'hitRate', name: 'Hit Rate %', color: '#10b981' },
                    ]}
                    height={200}
                    showLegend={false}
                  />
                </div>
              </div>
            )}

            {/* InnoDB Stats */}
            {metrics && (
              <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-white mb-4">InnoDB Operations</h3>
                <div className="grid grid-cols-4 gap-6">
                  <div>
                    <div className="text-sm text-slate-400 mb-1">Rows Read</div>
                    <div className="text-2xl font-semibold text-white">
                      {metrics.innodb.rowsRead.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-slate-400 mb-1">Rows Inserted</div>
                    <div className="text-2xl font-semibold text-green-400">
                      {metrics.innodb.rowsInserted.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-slate-400 mb-1">Rows Updated</div>
                    <div className="text-2xl font-semibold text-blue-400">
                      {metrics.innodb.rowsUpdated.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-slate-400 mb-1">Rows Deleted</div>
                    <div className="text-2xl font-semibold text-red-400">
                      {metrics.innodb.rowsDeleted.toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </TabsContent>

          {/* Slow Queries Tab */}
          <TabsContent value="slow-queries" className="mt-6">
            <div className="grid grid-cols-12 gap-6">
              {/* Queries List */}
              <div className="col-span-7">
                <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-lg overflow-hidden">
                  <div className="p-4 border-b border-slate-700">
                    <h3 className="font-semibold text-white">Top Slow Queries ({slowQueries.length})</h3>
                  </div>
                  <div className="overflow-y-auto max-h-[800px]">
                    {slowQueries.map((query, idx) => {
                      const efficiency = calculateQueryEfficiency(query);
                      const category = categorizeQuery(query.query);

                      return (
                        <div
                          key={idx}
                          onClick={() => explainQuery(query)}
                          className={`p-4 border-b border-slate-700 hover:bg-slate-700/30 cursor-pointer transition-colors ${
                            selectedQuery?.digest === query.digest ? 'bg-slate-700/50' : ''
                          }`}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="px-2 py-0.5 rounded text-xs bg-blue-500/10 text-blue-400">
                                  {category}
                                </span>
                                <span className={`px-2 py-0.5 rounded text-xs ${
                                  efficiency >= 70
                                    ? 'bg-green-500/10 text-green-400'
                                    : efficiency >= 40
                                    ? 'bg-yellow-500/10 text-yellow-400'
                                    : 'bg-red-500/10 text-red-400'
                                }`}>
                                  Efficiency: {efficiency}%
                                </span>
                              </div>
                              <code className="text-sm text-slate-300 block overflow-hidden text-ellipsis whitespace-nowrap">
                                {query.query.substring(0, 120)}...
                              </code>
                            </div>
                          </div>
                          <div className="grid grid-cols-4 gap-4 text-xs text-slate-400">
                            <div>
                              <span className="text-slate-500">Avg Time:</span>{' '}
                              <span className="text-white">{formatDuration(query.avgTime)}</span>
                            </div>
                            <div>
                              <span className="text-slate-500">Count:</span>{' '}
                              <span className="text-white">{query.executionCount.toLocaleString()}</span>
                            </div>
                            <div>
                              <span className="text-slate-500">Total Time:</span>{' '}
                              <span className="text-white">{formatDuration(query.totalTime)}</span>
                            </div>
                            <div>
                              <span className="text-slate-500">Rows:</span>{' '}
                              <span className="text-white">
                                {query.rowsExamined.toLocaleString()} examined / {query.rowsSent.toLocaleString()} sent
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* EXPLAIN Panel */}
              <div className="col-span-5">
                {!selectedQuery ? (
                  <div className="bg-slate-800/30 backdrop-blur border border-slate-700 rounded-lg p-12 text-center">
                    <AlertTriangle className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-slate-400 mb-2">
                      Select a Query
                    </h3>
                    <p className="text-slate-500">
                      Click on a query to see EXPLAIN analysis and optimization suggestions
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Query Details */}
                    <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-lg p-6">
                      <h3 className="font-semibold text-white mb-4">Query Details</h3>
                      <pre className="text-sm text-slate-300 bg-slate-900/50 p-4 rounded overflow-x-auto">
                        {selectedQuery.query}
                      </pre>
                      <div className="grid grid-cols-2 gap-4 mt-4 text-sm">
                        <div>
                          <div className="text-slate-500">Average Time</div>
                          <div className="text-white font-semibold">{formatDuration(selectedQuery.avgTime)}</div>
                        </div>
                        <div>
                          <div className="text-slate-500">Execution Count</div>
                          <div className="text-white font-semibold">{selectedQuery.executionCount.toLocaleString()}</div>
                        </div>
                        <div>
                          <div className="text-slate-500">Rows Examined</div>
                          <div className="text-white font-semibold">{selectedQuery.rowsExamined.toLocaleString()}</div>
                        </div>
                        <div>
                          <div className="text-slate-500">Rows Sent</div>
                          <div className="text-white font-semibold">{selectedQuery.rowsSent.toLocaleString()}</div>
                        </div>
                      </div>
                    </div>

                    {/* EXPLAIN Results */}
                    {explainData && (
                      <>
                        <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-lg overflow-hidden">
                          <div className="p-4 border-b border-slate-700">
                            <h3 className="font-semibold text-white">EXPLAIN Analysis</h3>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead className="bg-slate-900/50">
                                <tr>
                                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Table</th>
                                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Type</th>
                                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Key</th>
                                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Rows</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-700">
                                {explainData.explain.map((step, idx) => (
                                  <tr key={idx} className="hover:bg-slate-700/30">
                                    <td className="px-3 py-2 text-white">{step.table}</td>
                                    <td className="px-3 py-2">
                                      <span className={`px-2 py-0.5 rounded text-xs ${
                                        step.type === 'ALL'
                                          ? 'bg-red-500/10 text-red-400'
                                          : step.type === 'index'
                                          ? 'bg-green-500/10 text-green-400'
                                          : 'bg-blue-500/10 text-blue-400'
                                      }`}>
                                        {step.type}
                                      </span>
                                    </td>
                                    <td className="px-3 py-2 text-slate-300">{step.key || '-'}</td>
                                    <td className="px-3 py-2 text-slate-300">{step.rows.toLocaleString()}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        {/* Optimization Suggestions */}
                        {explainData.suggestions.length > 0 && (
                          <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-lg p-6">
                            <h3 className="font-semibold text-white mb-4">Optimization Suggestions</h3>
                            <div className="space-y-3">
                              {explainData.suggestions.map((suggestion, idx) => (
                                <div
                                  key={idx}
                                  className={`p-3 rounded border ${
                                    suggestion.impact === 'high'
                                      ? 'bg-red-500/10 border-red-500/30'
                                      : suggestion.impact === 'medium'
                                      ? 'bg-yellow-500/10 border-yellow-500/30'
                                      : 'bg-blue-500/10 border-blue-500/30'
                                  }`}
                                >
                                  <div className="flex items-start gap-2">
                                    <AlertTriangle className={`w-4 h-4 mt-0.5 ${
                                      suggestion.impact === 'high'
                                        ? 'text-red-400'
                                        : suggestion.impact === 'medium'
                                        ? 'text-yellow-400'
                                        : 'text-blue-400'
                                    }`} />
                                    <div className="flex-1">
                                      <div className="text-sm text-white mb-1">{suggestion.reason}</div>
                                      <div className="text-xs text-slate-400">
                                        Table: <span className="font-mono">{suggestion.table}</span> |
                                        Columns: <span className="font-mono">{suggestion.columns.join(', ')}</span>
                                      </div>
                                      <div className="text-xs text-slate-500 mt-1">
                                        Impact: {suggestion.estimatedImprovement}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          {/* Recommendations Tab */}
          <TabsContent value="recommendations" className="mt-6">
            <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-white mb-4">
                Performance Recommendations ({recommendations.length})
              </h3>
              {recommendations.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  No recommendations at this time. Your database is performing well!
                </div>
              ) : (
                <div className="space-y-3">
                  {recommendations.map((rec, idx) => (
                    <div
                      key={idx}
                      className="p-4 bg-blue-500/10 border border-blue-500/30 rounded flex items-start gap-3"
                    >
                      <AlertTriangle className="w-5 h-5 text-blue-400 mt-0.5" />
                      <div className="flex-1 text-sm text-slate-300">{rec}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          {/* N+1 Detection Tab */}
          <TabsContent value="n-plus-one" className="mt-6">
            <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-lg overflow-hidden">
              <div className="p-4 border-b border-slate-700">
                <h3 className="font-semibold text-white">Potential N+1 Query Patterns</h3>
                <p className="text-sm text-slate-400 mt-1">
                  Queries that are executed many times with similar patterns
                </p>
              </div>
              {nPlusOnePatterns.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  No N+1 query patterns detected
                </div>
              ) : (
                <div className="divide-y divide-slate-700">
                  {nPlusOnePatterns.map((pattern, idx) => (
                    <div key={idx} className="p-6">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <code className="text-sm text-slate-300 block mb-2">
                            {pattern.pattern.substring(0, 200)}...
                          </code>
                        </div>
                        <span className="px-3 py-1 rounded text-sm bg-red-500/10 text-red-400 border border-red-500/30 whitespace-nowrap ml-4">
                          High Impact
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-sm mb-3">
                        <div>
                          <span className="text-slate-500">Execution Count:</span>{' '}
                          <span className="text-white font-semibold">{pattern.count.toLocaleString()}</span>
                        </div>
                        <div>
                          <span className="text-slate-500">Total Time:</span>{' '}
                          <span className="text-white font-semibold">{formatDuration(pattern.totalTime)}</span>
                        </div>
                        <div>
                          <span className="text-slate-500">Avg Time:</span>{' '}
                          <span className="text-white font-semibold">
                            {formatDuration(pattern.totalTime / pattern.count)}
                          </span>
                        </div>
                      </div>
                      <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded text-sm text-slate-300">
                        <strong className="text-blue-400">Suggestion:</strong> {pattern.suggestion}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
