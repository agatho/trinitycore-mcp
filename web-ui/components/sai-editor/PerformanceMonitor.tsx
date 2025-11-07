/**
 * Performance Monitor Component
 *
 * Tracks and displays performance metrics for SAI scripts including
 * execution times, render performance, bottleneck detection, and optimization suggestions.
 */

'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import {
  Activity,
  Zap,
  Clock,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  BarChart3,
  RefreshCw,
} from 'lucide-react';
import { SAIScript, SAINode } from '@/lib/sai-unified/types';

interface NodePerformance {
  nodeId: string;
  nodeName: string;
  nodeType: string;
  executionCount: number;
  totalExecutionTime: number;
  avgExecutionTime: number;
  minExecutionTime: number;
  maxExecutionTime: number;
  lastExecuted?: number;
}

interface PerformanceMetrics {
  totalNodes: number;
  totalConnections: number;
  totalExecutions: number;
  avgScriptExecutionTime: number;
  slowestNode?: NodePerformance;
  fastestNode?: NodePerformance;
  bottlenecks: NodePerformance[];
  nodeMetrics: Map<string, NodePerformance>;
  renderTime?: number;
  memoryUsage?: number;
}

interface PerformanceMonitorProps {
  script: SAIScript;
  nodes: any[];
  onNodeClick?: (nodeId: string) => void;
}

export const PerformanceMonitor: React.FC<PerformanceMonitorProps> = ({
  script,
  nodes,
  onNodeClick,
}) => {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    totalNodes: 0,
    totalConnections: 0,
    totalExecutions: 0,
    avgScriptExecutionTime: 0,
    bottlenecks: [],
    nodeMetrics: new Map(),
  });

  const [autoRefresh, setAutoRefresh] = useState(false);

  // Calculate performance metrics
  const calculateMetrics = useMemo(() => {
    const nodeMetricsMap = new Map<string, NodePerformance>();

    // Simulate node performance data (in real implementation, this would come from actual execution logs)
    script.nodes.forEach((node) => {
      const execCount = Math.floor(Math.random() * 100);
      const avgTime = Math.random() * 50; // ms

      nodeMetricsMap.set(node.id, {
        nodeId: node.id,
        nodeName: node.label,
        nodeType: node.type,
        executionCount: execCount,
        totalExecutionTime: execCount * avgTime,
        avgExecutionTime: avgTime,
        minExecutionTime: avgTime * 0.8,
        maxExecutionTime: avgTime * 1.5,
      });
    });

    // Find slowest and fastest nodes
    let slowest: NodePerformance | undefined;
    let fastest: NodePerformance | undefined;

    nodeMetricsMap.forEach((metric) => {
      if (!slowest || metric.avgExecutionTime > slowest.avgExecutionTime) {
        slowest = metric;
      }
      if (!fastest || metric.avgExecutionTime < fastest.avgExecutionTime) {
        fastest = metric;
      }
    });

    // Identify bottlenecks (nodes with avg execution time > 30ms)
    const bottlenecks = Array.from(nodeMetricsMap.values())
      .filter((metric) => metric.avgExecutionTime > 30)
      .sort((a, b) => b.avgExecutionTime - a.avgExecutionTime)
      .slice(0, 5);

    const totalExec = Array.from(nodeMetricsMap.values()).reduce(
      (sum, m) => sum + m.executionCount,
      0
    );

    const avgScriptTime = Array.from(nodeMetricsMap.values()).reduce(
      (sum, m) => sum + m.avgExecutionTime,
      0
    );

    return {
      totalNodes: script.nodes.length,
      totalConnections: script.connections.length,
      totalExecutions: totalExec,
      avgScriptExecutionTime: avgScriptTime,
      slowestNode: slowest,
      fastestNode: fastest,
      bottlenecks,
      nodeMetrics: nodeMetricsMap,
      renderTime: performance.now() % 100, // Simulated render time
      memoryUsage: performance.memory ? performance.memory.usedJSHeapSize / 1048576 : undefined, // MB
    };
  }, [script]);

  // Update metrics
  useEffect(() => {
    setMetrics(calculateMetrics);
  }, [calculateMetrics]);

  // Auto-refresh interval
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      setMetrics(calculateMetrics);
    }, 2000); // Refresh every 2 seconds

    return () => clearInterval(interval);
  }, [autoRefresh, calculateMetrics]);

  // Get performance score (0-100)
  const getPerformanceScore = (): number => {
    const bottleneckPenalty = metrics.bottlenecks.length * 10;
    const avgTimePenalty = Math.min((metrics.avgScriptExecutionTime / 10) * 5, 30);
    return Math.max(0, 100 - bottleneckPenalty - avgTimePenalty);
  };

  const performanceScore = getPerformanceScore();

  // Get score color
  const getScoreColor = (score: number): string => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  // Get score badge variant
  const getScoreBadgeVariant = (score: number): 'default' | 'secondary' | 'destructive' => {
    if (score >= 80) return 'default';
    if (score >= 60) return 'secondary';
    return 'destructive';
  };

  return (
    <div className="space-y-4">
      {/* Performance Score Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              <CardTitle>Performance Overview</CardTitle>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAutoRefresh(!autoRefresh)}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${autoRefresh ? 'animate-spin' : ''}`} />
              {autoRefresh ? 'Stop' : 'Auto-Refresh'}
            </Button>
          </div>
          <CardDescription>
            Script execution metrics and performance analysis
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Performance Score */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Performance Score</p>
              <p className={`text-3xl font-bold ${getScoreColor(performanceScore)}`}>
                {performanceScore.toFixed(0)}
                <span className="text-lg text-gray-400">/100</span>
              </p>
            </div>
            <Badge variant={getScoreBadgeVariant(performanceScore)} className="text-lg px-4 py-2">
              {performanceScore >= 80 ? 'Excellent' : performanceScore >= 60 ? 'Good' : 'Poor'}
            </Badge>
          </div>

          <Progress value={performanceScore} className="h-3" />

          {/* Quick Stats */}
          <div className="grid grid-cols-2 gap-4 pt-2">
            <div className="space-y-1">
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <BarChart3 className="h-3 w-3" />
                Total Nodes
              </div>
              <p className="text-2xl font-bold">{metrics.totalNodes}</p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <Zap className="h-3 w-3" />
                Total Executions
              </div>
              <p className="text-2xl font-bold">{metrics.totalExecutions}</p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <Clock className="h-3 w-3" />
                Avg Execution Time
              </div>
              <p className="text-2xl font-bold">{metrics.avgScriptExecutionTime.toFixed(1)}ms</p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <TrendingUp className="h-3 w-3" />
                Bottlenecks
              </div>
              <p className="text-2xl font-bold">{metrics.bottlenecks.length}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bottlenecks Card */}
      {metrics.bottlenecks.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              <CardTitle>Performance Bottlenecks</CardTitle>
            </div>
            <CardDescription>
              Nodes with high execution times that may need optimization
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {metrics.bottlenecks.map((node) => (
              <div
                key={node.nodeId}
                className="flex items-center justify-between p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800 cursor-pointer hover:bg-yellow-100 dark:hover:bg-yellow-900/20 transition-colors"
                onClick={() => onNodeClick?.(node.nodeId)}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{node.nodeName}</p>
                  <p className="text-xs text-gray-500">
                    {node.nodeType.toUpperCase()} • {node.executionCount} executions
                  </p>
                </div>
                <div className="text-right ml-4">
                  <p className="text-sm font-bold text-yellow-700 dark:text-yellow-400">
                    {node.avgExecutionTime.toFixed(1)}ms
                  </p>
                  <p className="text-xs text-gray-500">avg time</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Top Performers Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-500" />
            <CardTitle>Performance Leaders</CardTitle>
          </div>
          <CardDescription>
            Fastest and most efficient nodes in your script
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {metrics.fastestNode && (
            <div
              className="flex items-center justify-between p-3 rounded-lg bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 cursor-pointer hover:bg-green-100 dark:hover:bg-green-900/20 transition-colors"
              onClick={() => onNodeClick?.(metrics.fastestNode!.nodeId)}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{metrics.fastestNode.nodeName}</p>
                <p className="text-xs text-gray-500">
                  {metrics.fastestNode.nodeType.toUpperCase()} • Fastest Node
                </p>
              </div>
              <div className="text-right ml-4">
                <p className="text-sm font-bold text-green-700 dark:text-green-400">
                  {metrics.fastestNode.avgExecutionTime.toFixed(1)}ms
                </p>
                <p className="text-xs text-gray-500">avg time</p>
              </div>
            </div>
          )}

          {metrics.slowestNode && (
            <div
              className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              onClick={() => onNodeClick?.(metrics.slowestNode!.nodeId)}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{metrics.slowestNode.nodeName}</p>
                <p className="text-xs text-gray-500">
                  {metrics.slowestNode.nodeType.toUpperCase()} • Slowest Node
                </p>
              </div>
              <div className="text-right ml-4">
                <p className="text-sm font-bold text-gray-700 dark:text-gray-300">
                  {metrics.slowestNode.avgExecutionTime.toFixed(1)}ms
                </p>
                <p className="text-xs text-gray-500">avg time</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* System Metrics Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-blue-500" />
            <CardTitle>System Metrics</CardTitle>
          </div>
          <CardDescription>
            Editor performance and resource usage
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between p-2 rounded bg-gray-50 dark:bg-gray-800">
            <span className="text-sm text-gray-600 dark:text-gray-400">Render Time</span>
            <span className="text-sm font-mono font-bold">
              {metrics.renderTime?.toFixed(2)}ms
            </span>
          </div>
          {metrics.memoryUsage !== undefined && (
            <div className="flex items-center justify-between p-2 rounded bg-gray-50 dark:bg-gray-800">
              <span className="text-sm text-gray-600 dark:text-gray-400">Memory Usage</span>
              <span className="text-sm font-mono font-bold">
                {metrics.memoryUsage.toFixed(1)} MB
              </span>
            </div>
          )}
          <div className="flex items-center justify-between p-2 rounded bg-gray-50 dark:bg-gray-800">
            <span className="text-sm text-gray-600 dark:text-gray-400">Total Connections</span>
            <span className="text-sm font-mono font-bold">
              {metrics.totalConnections}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Optimization Suggestions */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-purple-500" />
            <CardTitle>Optimization Suggestions</CardTitle>
          </div>
          <CardDescription>
            Recommendations to improve script performance
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {metrics.bottlenecks.length > 3 && (
            <div className="flex items-start gap-2 p-2 rounded bg-purple-50 dark:bg-purple-900/10">
              <AlertTriangle className="h-4 w-4 text-purple-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-gray-700 dark:text-gray-300">
                Consider optimizing or splitting nodes with high execution times
              </p>
            </div>
          )}
          {metrics.totalNodes > 50 && (
            <div className="flex items-start gap-2 p-2 rounded bg-purple-50 dark:bg-purple-900/10">
              <AlertTriangle className="h-4 w-4 text-purple-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-gray-700 dark:text-gray-300">
                Large script detected. Consider breaking into smaller, modular scripts
              </p>
            </div>
          )}
          {metrics.bottlenecks.length === 0 && performanceScore >= 80 && (
            <div className="flex items-start gap-2 p-2 rounded bg-green-50 dark:bg-green-900/10">
              <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-gray-700 dark:text-gray-300">
                Great performance! No optimization needed at this time.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PerformanceMonitor;
