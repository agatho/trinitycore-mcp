/**
 * Performance Metrics Component
 *
 * Real-time performance monitoring and optimization suggestions for SAI scripts.
 * Detects hotspots, infinite loops, and provides actionable insights.
 * Phase 3 revolutionary feature.
 */

'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import {
  Activity,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Zap,
  Clock,
  Cpu,
  BarChart3,
  Download,
  Lightbulb,
  Target,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { SimulationEvent, SimulationState } from '@/lib/sai-unified/simulator';
import { SAINode, SAIScript } from '@/lib/sai-unified/types';

// ============================================================================
// TYPES
// ============================================================================

export interface PerformanceMetrics {
  // Execution metrics
  totalEvents: number;
  eventsPerSecond: number;
  actionsPerSecond: number;
  averageEventDuration: number;

  // Hotspot detection
  hotspots: Hotspot[];

  // Optimization suggestions
  suggestions: OptimizationSuggestion[];

  // Health score (0-100)
  healthScore: number;
}

export interface Hotspot {
  nodeId: string;
  nodeLabel: string;
  nodeType: 'event' | 'action' | 'target';
  executionCount: number;
  percentage: number;
}

export interface OptimizationSuggestion {
  id: string;
  severity: 'info' | 'warning' | 'error';
  category: 'performance' | 'logic' | 'best-practice';
  title: string;
  description: string;
  nodeId?: string;
  fix?: string;
}

export interface PerformanceMetricsPanelProps {
  /** Simulation state */
  state: SimulationState;
  /** Execution history */
  history: SimulationEvent[];
  /** Script nodes */
  script: SAIScript;
  /** Callback when exporting report */
  onExportReport?: () => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export const PerformanceMetricsPanel: React.FC<PerformanceMetricsPanelProps> = ({
  state,
  history,
  script,
  onExportReport,
}) => {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['overview', 'hotspots', 'suggestions'])
  );

  // Calculate metrics
  const metrics = useMemo(() => {
    return calculateMetrics(state, history, script);
  }, [state, history, script]);

  // Toggle section expansion
  const toggleSection = (section: string) => {
    setExpandedSections((sections) => {
      const newSections = new Set(sections);
      if (newSections.has(section)) {
        newSections.delete(section);
      } else {
        newSections.add(section);
      }
      return newSections;
    });
  };

  // Get health score color
  const getHealthScoreColor = (score: number): string => {
    if (score >= 80) return 'text-green-500';
    if (score >= 60) return 'text-yellow-500';
    if (score >= 40) return 'text-orange-500';
    return 'text-red-500';
  };

  // Get severity color
  const getSeverityColor = (severity: OptimizationSuggestion['severity']): string => {
    switch (severity) {
      case 'error':
        return 'text-red-500';
      case 'warning':
        return 'text-yellow-500';
      case 'info':
        return 'text-blue-500';
    }
  };

  // Get severity icon
  const getSeverityIcon = (severity: OptimizationSuggestion['severity']) => {
    switch (severity) {
      case 'error':
        return <XCircle className="w-4 h-4" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4" />;
      case 'info':
        return <CheckCircle className="w-4 h-4" />;
    }
  };

  // Export performance report
  const handleExportReport = useCallback(() => {
    const report = generatePerformanceReport(metrics, state, history, script);
    const blob = new Blob([report], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sai-performance-report-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);

    onExportReport?.();
  }, [metrics, state, history, script, onExportReport]);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center gap-2 mb-3">
          <Activity className="w-5 h-5 text-green-500" />
          <h2 className="font-semibold text-lg">Performance</h2>
          <Badge
            variant="outline"
            className={`ml-auto ${getHealthScoreColor(metrics.healthScore)}`}
          >
            Health: {metrics.healthScore}%
          </Badge>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={handleExportReport}
          className="w-full"
        >
          <Download className="w-4 h-4 mr-2" />
          Export Report
        </Button>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* Overview Section */}
          <Card className="overflow-hidden">
            <button
              className="w-full p-3 flex items-center gap-2 text-left hover:bg-gray-50 dark:hover:bg-gray-900"
              onClick={() => toggleSection('overview')}
            >
              {expandedSections.has('overview') ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
              <h3 className="font-semibold text-sm flex-1">Overview</h3>
            </button>

            {expandedSections.has('overview') && (
              <div className="p-3 pt-0 space-y-3">
                {/* Health Score */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-xs font-medium">Script Health</Label>
                    <span
                      className={`text-sm font-semibold ${getHealthScoreColor(
                        metrics.healthScore
                      )}`}
                    >
                      {metrics.healthScore}%
                    </span>
                  </div>
                  <Progress value={metrics.healthScore} className="h-2" />
                </div>

                {/* Key Metrics */}
                <div className="grid grid-cols-2 gap-3 mt-4">
                  <Card className="p-3 bg-gray-50 dark:bg-gray-900">
                    <div className="flex items-center gap-2 mb-1">
                      <Zap className="w-4 h-4 text-blue-500" />
                      <span className="text-xs text-gray-600 dark:text-gray-400">
                        Events/sec
                      </span>
                    </div>
                    <p className="text-lg font-semibold font-mono">
                      {metrics.eventsPerSecond.toFixed(2)}
                    </p>
                  </Card>

                  <Card className="p-3 bg-gray-50 dark:bg-gray-900">
                    <div className="flex items-center gap-2 mb-1">
                      <Activity className="w-4 h-4 text-green-500" />
                      <span className="text-xs text-gray-600 dark:text-gray-400">
                        Actions/sec
                      </span>
                    </div>
                    <p className="text-lg font-semibold font-mono">
                      {metrics.actionsPerSecond.toFixed(2)}
                    </p>
                  </Card>

                  <Card className="p-3 bg-gray-50 dark:bg-gray-900">
                    <div className="flex items-center gap-2 mb-1">
                      <Clock className="w-4 h-4 text-purple-500" />
                      <span className="text-xs text-gray-600 dark:text-gray-400">
                        Avg Duration
                      </span>
                    </div>
                    <p className="text-lg font-semibold font-mono">
                      {metrics.averageEventDuration.toFixed(1)}ms
                    </p>
                  </Card>

                  <Card className="p-3 bg-gray-50 dark:bg-gray-900">
                    <div className="flex items-center gap-2 mb-1">
                      <BarChart3 className="w-4 h-4 text-orange-500" />
                      <span className="text-xs text-gray-600 dark:text-gray-400">
                        Total Events
                      </span>
                    </div>
                    <p className="text-lg font-semibold font-mono">
                      {metrics.totalEvents}
                    </p>
                  </Card>
                </div>
              </div>
            )}
          </Card>

          {/* Hotspots Section */}
          <Card className="overflow-hidden">
            <button
              className="w-full p-3 flex items-center gap-2 text-left hover:bg-gray-50 dark:hover:bg-gray-900"
              onClick={() => toggleSection('hotspots')}
            >
              {expandedSections.has('hotspots') ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
              <h3 className="font-semibold text-sm flex-1">Execution Hotspots</h3>
              <Badge variant="outline" className="text-xs">
                {metrics.hotspots.length}
              </Badge>
            </button>

            {expandedSections.has('hotspots') && (
              <div className="p-3 pt-0 space-y-2">
                {metrics.hotspots.length === 0 ? (
                  <div className="text-center text-sm text-gray-500 dark:text-gray-400 py-4">
                    <Target className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>No hotspots detected</p>
                    <p className="text-xs mt-1">Run simulation to analyze</p>
                  </div>
                ) : (
                  metrics.hotspots.map((hotspot, index) => (
                    <Card key={hotspot.nodeId} className="p-3 bg-gray-50 dark:bg-gray-900">
                      <div className="flex items-start gap-3">
                        <Badge
                          variant={index === 0 ? 'default' : 'outline'}
                          className="text-xs"
                        >
                          #{index + 1}
                        </Badge>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {hotspot.nodeLabel}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-xs">
                              {hotspot.nodeType}
                            </Badge>
                            <span className="text-xs text-gray-600 dark:text-gray-400">
                              {hotspot.nodeId}
                            </span>
                          </div>
                          <div className="mt-2 space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-gray-600 dark:text-gray-400">
                                Executions:
                              </span>
                              <span className="font-mono font-semibold">
                                {hotspot.executionCount}
                              </span>
                            </div>
                            <Progress value={hotspot.percentage} className="h-1" />
                            <div className="text-right text-xs text-gray-500">
                              {hotspot.percentage.toFixed(1)}%
                            </div>
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))
                )}
              </div>
            )}
          </Card>

          {/* Optimization Suggestions Section */}
          <Card className="overflow-hidden">
            <button
              className="w-full p-3 flex items-center gap-2 text-left hover:bg-gray-50 dark:hover:bg-gray-900"
              onClick={() => toggleSection('suggestions')}
            >
              {expandedSections.has('suggestions') ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
              <h3 className="font-semibold text-sm flex-1">Optimization Suggestions</h3>
              <Badge variant="outline" className="text-xs">
                {metrics.suggestions.length}
              </Badge>
            </button>

            {expandedSections.has('suggestions') && (
              <div className="p-3 pt-0 space-y-2">
                {metrics.suggestions.length === 0 ? (
                  <div className="text-center text-sm text-gray-500 dark:text-gray-400 py-4">
                    <Lightbulb className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>No suggestions</p>
                    <p className="text-xs mt-1">Your script looks great!</p>
                  </div>
                ) : (
                  metrics.suggestions.map((suggestion) => (
                    <Card
                      key={suggestion.id}
                      className={`p-3 border-l-4 ${
                        suggestion.severity === 'error'
                          ? 'border-l-red-500'
                          : suggestion.severity === 'warning'
                          ? 'border-l-yellow-500'
                          : 'border-l-blue-500'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={getSeverityColor(suggestion.severity)}>
                          {getSeverityIcon(suggestion.severity)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-sm font-medium">{suggestion.title}</p>
                            <Badge variant="outline" className="text-xs">
                              {suggestion.category}
                            </Badge>
                          </div>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                            {suggestion.description}
                          </p>
                          {suggestion.nodeId && (
                            <div className="text-xs text-gray-500 mb-1">
                              Node: {suggestion.nodeId}
                            </div>
                          )}
                          {suggestion.fix && (
                            <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-950/30 rounded text-xs">
                              <Lightbulb className="w-3 h-3 inline mr-1" />
                              <strong>Fix:</strong> {suggestion.fix}
                            </div>
                          )}
                        </div>
                      </div>
                    </Card>
                  ))
                )}
              </div>
            )}
          </Card>
        </div>
      </ScrollArea>
    </div>
  );
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculate performance metrics from simulation data
 */
function calculateMetrics(
  state: SimulationState,
  history: SimulationEvent[],
  script: SAIScript
): PerformanceMetrics {
  const totalEvents = history.length;
  const duration = state.timestamp / 1000; // Convert to seconds
  const eventsPerSecond = duration > 0 ? totalEvents / duration : 0;

  // Count actions
  const actionEvents = history.filter((e) => e.type === 'action_executed');
  const actionsPerSecond = duration > 0 ? actionEvents.length / duration : 0;

  // Calculate average event duration (simplified - would need timestamps)
  const averageEventDuration = 10; // Placeholder

  // Detect hotspots
  const hotspots = detectHotspots(history, script);

  // Generate optimization suggestions
  const suggestions = generateSuggestions(state, history, script, hotspots);

  // Calculate health score
  const healthScore = calculateHealthScore(suggestions, hotspots, state);

  return {
    totalEvents,
    eventsPerSecond,
    actionsPerSecond,
    averageEventDuration,
    hotspots,
    suggestions,
    healthScore,
  };
}

/**
 * Detect execution hotspots
 */
function detectHotspots(history: SimulationEvent[], script: SAIScript): Hotspot[] {
  const executionCounts = new Map<string, { count: number; node: SAINode }>();

  // Count executions per node
  history.forEach((event) => {
    if (event.eventNode) {
      const id = event.eventNode.id;
      const existing = executionCounts.get(id);
      if (existing) {
        existing.count++;
      } else {
        executionCounts.set(id, { count: 1, node: event.eventNode });
      }
    }
    if (event.actionNode) {
      const id = event.actionNode.id;
      const existing = executionCounts.get(id);
      if (existing) {
        existing.count++;
      } else {
        executionCounts.set(id, { count: 1, node: event.actionNode });
      }
    }
  });

  // Convert to hotspots
  const totalExecutions = Array.from(executionCounts.values()).reduce(
    (sum, item) => sum + item.count,
    0
  );

  const hotspots: Hotspot[] = Array.from(executionCounts.entries())
    .map(([nodeId, { count, node }]) => ({
      nodeId,
      nodeLabel: node.label || nodeId,
      nodeType: node.type as 'event' | 'action' | 'target',
      executionCount: count,
      percentage: (count / totalExecutions) * 100,
    }))
    .sort((a, b) => b.executionCount - a.executionCount)
    .slice(0, 10); // Top 10 hotspots

  return hotspots;
}

/**
 * Generate optimization suggestions
 */
function generateSuggestions(
  state: SimulationState,
  history: SimulationEvent[],
  script: SAIScript,
  hotspots: Hotspot[]
): OptimizationSuggestion[] {
  const suggestions: OptimizationSuggestion[] = [];

  // Check for excessive event triggers
  const topHotspot = hotspots[0];
  if (topHotspot && topHotspot.percentage > 50) {
    suggestions.push({
      id: `hotspot-${topHotspot.nodeId}`,
      severity: 'warning',
      category: 'performance',
      title: 'Excessive Event Triggering',
      description: `Node "${topHotspot.nodeLabel}" accounts for ${topHotspot.percentage.toFixed(
        1
      )}% of all executions.`,
      nodeId: topHotspot.nodeId,
      fix: 'Consider adding cooldowns or phase restrictions to reduce trigger frequency.',
    });
  }

  // Check for events without cooldowns
  script.nodes
    .filter((node) => node.type === 'event')
    .forEach((node) => {
      if (!node.cooldownMin && !node.cooldownMax) {
        suggestions.push({
          id: `no-cooldown-${node.id}`,
          severity: 'info',
          category: 'best-practice',
          title: 'Event Without Cooldown',
          description: `Event "${node.label}" has no cooldown, which may cause frequent triggers.`,
          nodeId: node.id,
          fix: 'Add a cooldown to prevent excessive triggering.',
        });
      }
    });

  // Check for potential infinite loops (linked events)
  script.nodes
    .filter((node) => node.type === 'event' && node.link)
    .forEach((node) => {
      const linkedNode = script.nodes.find((n) => {
        const nodeIdNum = parseInt(n.id.replace('event-', ''));
        return n.type === 'event' && nodeIdNum === node.link;
      });

      if (linkedNode && linkedNode.link === parseInt(node.id.replace('event-', ''))) {
        suggestions.push({
          id: `circular-link-${node.id}`,
          severity: 'error',
          category: 'logic',
          title: 'Circular Link Detected',
          description: `Events "${node.label}" and "${linkedNode.label}" are circularly linked.`,
          nodeId: node.id,
          fix: 'Remove circular link to prevent infinite loops.',
        });
      }
    });

  // Check for orphaned actions (no incoming connections)
  script.nodes
    .filter((node) => node.type === 'action')
    .forEach((node) => {
      const hasIncomingConnection = script.connections.some(
        (conn) => conn.target === node.id && conn.type === 'event-to-action'
      );
      if (!hasIncomingConnection) {
        suggestions.push({
          id: `orphaned-action-${node.id}`,
          severity: 'warning',
          category: 'logic',
          title: 'Orphaned Action',
          description: `Action "${node.label}" is not connected to any event.`,
          nodeId: node.id,
          fix: 'Connect this action to an event or remove it.',
        });
      }
    });

  return suggestions;
}

/**
 * Calculate overall health score
 */
function calculateHealthScore(
  suggestions: OptimizationSuggestion[],
  hotspots: Hotspot[],
  state: SimulationState
): number {
  let score = 100;

  // Deduct points for suggestions
  suggestions.forEach((suggestion) => {
    switch (suggestion.severity) {
      case 'error':
        score -= 20;
        break;
      case 'warning':
        score -= 10;
        break;
      case 'info':
        score -= 5;
        break;
    }
  });

  // Deduct points for unbalanced hotspots
  if (hotspots.length > 0 && hotspots[0].percentage > 50) {
    score -= 15;
  }

  return Math.max(0, Math.min(100, score));
}

/**
 * Generate performance report in markdown
 */
function generatePerformanceReport(
  metrics: PerformanceMetrics,
  state: SimulationState,
  history: SimulationEvent[],
  script: SAIScript
): string {
  const timestamp = new Date().toISOString();

  let report = `# SAI Performance Report\n\n`;
  report += `**Generated:** ${timestamp}\n\n`;
  report += `---\n\n`;

  report += `## Health Score: ${metrics.healthScore}%\n\n`;

  report += `## Overview\n\n`;
  report += `- **Total Events:** ${metrics.totalEvents}\n`;
  report += `- **Events per Second:** ${metrics.eventsPerSecond.toFixed(2)}\n`;
  report += `- **Actions per Second:** ${metrics.actionsPerSecond.toFixed(2)}\n`;
  report += `- **Average Event Duration:** ${metrics.averageEventDuration.toFixed(1)}ms\n\n`;

  report += `## Execution Hotspots\n\n`;
  if (metrics.hotspots.length === 0) {
    report += `*No hotspots detected*\n\n`;
  } else {
    metrics.hotspots.forEach((hotspot, index) => {
      report += `${index + 1}. **${hotspot.nodeLabel}** (${hotspot.nodeType})\n`;
      report += `   - Executions: ${hotspot.executionCount}\n`;
      report += `   - Percentage: ${hotspot.percentage.toFixed(1)}%\n\n`;
    });
  }

  report += `## Optimization Suggestions\n\n`;
  if (metrics.suggestions.length === 0) {
    report += `*No suggestions - your script looks great!*\n\n`;
  } else {
    metrics.suggestions.forEach((suggestion, index) => {
      report += `${index + 1}. **[${suggestion.severity.toUpperCase()}]** ${
        suggestion.title
      }\n`;
      report += `   - **Category:** ${suggestion.category}\n`;
      report += `   - **Description:** ${suggestion.description}\n`;
      if (suggestion.nodeId) {
        report += `   - **Node:** ${suggestion.nodeId}\n`;
      }
      if (suggestion.fix) {
        report += `   - **Fix:** ${suggestion.fix}\n`;
      }
      report += `\n`;
    });
  }

  report += `---\n\n`;
  report += `*Report generated by TrinityCore SAI Unified Editor*\n`;

  return report;
}

export default PerformanceMetricsPanel;
