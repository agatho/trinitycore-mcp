/**
 * Debug Panel Component
 *
 * Professional debugging interface with breakpoints, variable inspector,
 * call stack visualization, and step-through controls.
 * Phase 3 revolutionary feature.
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Bug,
  Pause,
  Play,
  StepForward,
  StopCircle,
  Circle,
  CircleDot,
  Eye,
  EyeOff,
  Trash2,
  Plus,
  AlertCircle,
  Layers,
  ChevronRight,
  ChevronDown,
} from 'lucide-react';
import { SAINode } from '@/lib/sai-unified/types';
import { SimulationState, SimulationEvent } from '@/lib/sai-unified/simulator';

// ============================================================================
// TYPES
// ============================================================================

export interface Breakpoint {
  id: string;
  nodeId: string;
  nodeLabel: string;
  enabled: boolean;
  hitCount: number;
  condition?: string;
}

export interface WatchExpression {
  id: string;
  expression: string;
  value: any;
  error?: string;
}

export interface CallStackFrame {
  id: string;
  type: 'event' | 'action' | 'target';
  node: SAINode;
  timestamp: number;
}

export interface DebugState {
  isPaused: boolean;
  currentNode: SAINode | null;
  breakpoints: Breakpoint[];
  watchExpressions: WatchExpression[];
  callStack: CallStackFrame[];
  variables: Map<string, any>;
}

export interface DebugPanelProps {
  /** Current simulation state */
  state: SimulationState;
  /** All nodes in script */
  nodes: SAINode[];
  /** Callback when breakpoint is toggled */
  onBreakpointToggle?: (nodeId: string, enabled: boolean) => void;
  /** Callback when breakpoint is added */
  onBreakpointAdd?: (nodeId: string) => void;
  /** Callback when breakpoint is removed */
  onBreakpointRemove?: (breakpointId: string) => void;
  /** Callback when stepping through execution */
  onStep?: () => void;
  /** Callback when continuing execution */
  onContinue?: () => void;
  /** Callback when stopping execution */
  onStop?: () => void;
  /** Current execution event */
  currentEvent?: SimulationEvent | null;
}

// ============================================================================
// COMPONENT
// ============================================================================

export const DebugPanel: React.FC<DebugPanelProps> = ({
  state,
  nodes,
  onBreakpointToggle,
  onBreakpointAdd,
  onBreakpointRemove,
  onStep,
  onContinue,
  onStop,
  currentEvent,
}) => {
  const [breakpoints, setBreakpoints] = useState<Breakpoint[]>([]);
  const [watchExpressions, setWatchExpressions] = useState<WatchExpression[]>([]);
  const [newWatchExpression, setNewWatchExpression] = useState('');
  const [isPaused, setIsPaused] = useState(false);
  const [callStack, setCallStack] = useState<CallStackFrame[]>([]);
  const [selectedBreakpoint, setSelectedBreakpoint] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['breakpoints', 'variables', 'callstack'])
  );

  // Update call stack from current event
  useEffect(() => {
    if (currentEvent) {
      const newStack: CallStackFrame[] = [];

      if (currentEvent.eventNode) {
        newStack.push({
          id: `frame-event-${currentEvent.id}`,
          type: 'event',
          node: currentEvent.eventNode,
          timestamp: currentEvent.timestamp,
        });
      }

      if (currentEvent.actionNode) {
        newStack.push({
          id: `frame-action-${currentEvent.id}`,
          type: 'action',
          node: currentEvent.actionNode,
          timestamp: currentEvent.timestamp,
        });
      }

      if (currentEvent.targetNode) {
        newStack.push({
          id: `frame-target-${currentEvent.id}`,
          type: 'target',
          node: currentEvent.targetNode,
          timestamp: currentEvent.timestamp,
        });
      }

      setCallStack(newStack);
    }
  }, [currentEvent]);

  // Evaluate watch expressions
  useEffect(() => {
    setWatchExpressions((watches) =>
      watches.map((watch) => {
        try {
          // Evaluate expression against state
          const value = evaluateExpression(watch.expression, state);
          return { ...watch, value, error: undefined };
        } catch (error) {
          return { ...watch, value: undefined, error: (error as Error).message };
        }
      })
    );
  }, [state]);

  // Evaluate expression against state
  const evaluateExpression = (expression: string, evalState: SimulationState): any => {
    try {
      // Simple expression evaluator for common patterns
      if (expression === 'health') return evalState.healthPercent;
      if (expression === 'mana') return evalState.manaPercent;
      if (expression === 'phase') return evalState.phase;
      if (expression === 'inCombat') return evalState.inCombat;
      if (expression === 'timestamp') return evalState.timestamp;

      // Variable access: variables.key
      if (expression.startsWith('variables.')) {
        const key = expression.substring(10);
        return evalState.variables.get(key);
      }

      // For safety, don't use eval() - return expression as-is
      return expression;
    } catch (error) {
      throw new Error(`Cannot evaluate: ${expression}`);
    }
  };

  // Toggle breakpoint
  const handleToggleBreakpoint = useCallback(
    (breakpoint: Breakpoint) => {
      const newEnabled = !breakpoint.enabled;
      setBreakpoints((bps) =>
        bps.map((bp) => (bp.id === breakpoint.id ? { ...bp, enabled: newEnabled } : bp))
      );
      onBreakpointToggle?.(breakpoint.nodeId, newEnabled);
    },
    [onBreakpointToggle]
  );

  // Add breakpoint
  const handleAddBreakpoint = useCallback(
    (nodeId: string) => {
      const node = nodes.find((n) => n.id === nodeId);
      if (!node) return;

      const newBreakpoint: Breakpoint = {
        id: `bp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        nodeId,
        nodeLabel: node.label || node.id,
        enabled: true,
        hitCount: 0,
      };

      setBreakpoints((bps) => [...bps, newBreakpoint]);
      onBreakpointAdd?.(nodeId);
    },
    [nodes, onBreakpointAdd]
  );

  // Remove breakpoint
  const handleRemoveBreakpoint = useCallback(
    (breakpointId: string) => {
      setBreakpoints((bps) => bps.filter((bp) => bp.id !== breakpointId));
      onBreakpointRemove?.(breakpointId);
    },
    [onBreakpointRemove]
  );

  // Add watch expression
  const handleAddWatch = useCallback(() => {
    if (!newWatchExpression.trim()) return;

    const newWatch: WatchExpression = {
      id: `watch-${Date.now()}`,
      expression: newWatchExpression.trim(),
      value: undefined,
    };

    setWatchExpressions((watches) => [...watches, newWatch]);
    setNewWatchExpression('');
  }, [newWatchExpression]);

  // Remove watch expression
  const handleRemoveWatch = useCallback((watchId: string) => {
    setWatchExpressions((watches) => watches.filter((w) => w.id !== watchId));
  }, []);

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

  // Get icon for node type
  const getNodeTypeIcon = (type: CallStackFrame['type']) => {
    switch (type) {
      case 'event':
        return '🎯';
      case 'action':
        return '⚡';
      case 'target':
        return '🎪';
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center gap-2 mb-3">
          <Bug className="w-5 h-5 text-purple-500" />
          <h2 className="font-semibold text-lg">Debugger</h2>
          <Badge variant={isPaused ? 'destructive' : 'default'} className="ml-auto">
            {isPaused ? 'Paused' : 'Running'}
          </Badge>
        </div>

        {/* Debug Controls */}
        <div className="flex gap-2">
          <Button
            variant={isPaused ? 'default' : 'outline'}
            size="sm"
            onClick={() => {
              setIsPaused(!isPaused);
              if (isPaused) {
                onContinue?.();
              }
            }}
            className="flex-1"
          >
            {isPaused ? (
              <>
                <Play className="w-4 h-4 mr-1" />
                Continue
              </>
            ) : (
              <>
                <Pause className="w-4 h-4 mr-1" />
                Pause
              </>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onStep}
            disabled={!isPaused}
            title="Step"
          >
            <StepForward className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onStop}
            title="Stop"
          >
            <StopCircle className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* Breakpoints Section */}
          <Card className="overflow-hidden">
            <button
              className="w-full p-3 flex items-center gap-2 text-left hover:bg-gray-50 dark:hover:bg-gray-900"
              onClick={() => toggleSection('breakpoints')}
            >
              {expandedSections.has('breakpoints') ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
              <h3 className="font-semibold text-sm flex-1">Breakpoints</h3>
              <Badge variant="outline" className="text-xs">
                {breakpoints.length}
              </Badge>
            </button>

            {expandedSections.has('breakpoints') && (
              <div className="p-3 pt-0 space-y-2">
                {breakpoints.length === 0 ? (
                  <div className="text-center text-sm text-gray-500 dark:text-gray-400 py-4">
                    <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>No breakpoints set</p>
                    <p className="text-xs mt-1">Click a node to add a breakpoint</p>
                  </div>
                ) : (
                  breakpoints.map((breakpoint) => (
                    <div
                      key={breakpoint.id}
                      className={`p-2 border rounded flex items-center gap-2 ${
                        selectedBreakpoint === breakpoint.id
                          ? 'border-purple-500 bg-purple-50 dark:bg-purple-950/30'
                          : 'border-gray-200 dark:border-gray-700'
                      }`}
                      onClick={() => setSelectedBreakpoint(breakpoint.id)}
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleBreakpoint(breakpoint);
                        }}
                        className="p-1"
                      >
                        {breakpoint.enabled ? (
                          <CircleDot className="w-4 h-4 text-red-500" />
                        ) : (
                          <Circle className="w-4 h-4 text-gray-400" />
                        )}
                      </button>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{breakpoint.nodeLabel}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {breakpoint.nodeId} • Hit {breakpoint.hitCount} times
                        </p>
                      </div>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveBreakpoint(breakpoint.id);
                        }}
                        className="h-6 w-6 p-0"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  ))
                )}

                <Separator className="my-2" />

                <div className="flex gap-2">
                  <select
                    className="flex-1 h-8 px-2 text-sm border rounded"
                    onChange={(e) => {
                      if (e.target.value) {
                        handleAddBreakpoint(e.target.value);
                        e.target.value = '';
                      }
                    }}
                  >
                    <option value="">Add breakpoint...</option>
                    {nodes
                      .filter((n) => !breakpoints.some((bp) => bp.nodeId === n.id))
                      .map((node) => (
                        <option key={node.id} value={node.id}>
                          {node.label || node.id}
                        </option>
                      ))}
                  </select>
                </div>
              </div>
            )}
          </Card>

          {/* Variables Section */}
          <Card className="overflow-hidden">
            <button
              className="w-full p-3 flex items-center gap-2 text-left hover:bg-gray-50 dark:hover:bg-gray-900"
              onClick={() => toggleSection('variables')}
            >
              {expandedSections.has('variables') ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
              <h3 className="font-semibold text-sm flex-1">Variables</h3>
            </button>

            {expandedSections.has('variables') && (
              <div className="p-3 pt-0">
                <div className="space-y-2 text-sm font-mono">
                  <div className="flex justify-between py-1 border-b border-gray-200 dark:border-gray-700">
                    <span className="text-gray-600 dark:text-gray-400">health</span>
                    <span className="font-semibold">{state.healthPercent.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-gray-200 dark:border-gray-700">
                    <span className="text-gray-600 dark:text-gray-400">mana</span>
                    <span className="font-semibold">{state.manaPercent.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-gray-200 dark:border-gray-700">
                    <span className="text-gray-600 dark:text-gray-400">phase</span>
                    <span className="font-semibold">{state.phase}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-gray-200 dark:border-gray-700">
                    <span className="text-gray-600 dark:text-gray-400">inCombat</span>
                    <span className="font-semibold">{state.inCombat ? 'true' : 'false'}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-gray-200 dark:border-gray-700">
                    <span className="text-gray-600 dark:text-gray-400">timestamp</span>
                    <span className="font-semibold">{(state.timestamp / 1000).toFixed(1)}s</span>
                  </div>

                  {Array.from(state.variables.entries()).map(([key, value]) => (
                    <div
                      key={key}
                      className="flex justify-between py-1 border-b border-gray-200 dark:border-gray-700"
                    >
                      <span className="text-gray-600 dark:text-gray-400">{key}</span>
                      <span className="font-semibold">{JSON.stringify(value)}</span>
                    </div>
                  ))}

                  {state.variables.size === 0 && (
                    <p className="text-center text-gray-500 dark:text-gray-400 py-4 text-xs">
                      No custom variables
                    </p>
                  )}
                </div>
              </div>
            )}
          </Card>

          {/* Watch Expressions Section */}
          <Card className="overflow-hidden">
            <button
              className="w-full p-3 flex items-center gap-2 text-left hover:bg-gray-50 dark:hover:bg-gray-900"
              onClick={() => toggleSection('watch')}
            >
              {expandedSections.has('watch') ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
              <h3 className="font-semibold text-sm flex-1">Watch</h3>
              <Badge variant="outline" className="text-xs">
                {watchExpressions.length}
              </Badge>
            </button>

            {expandedSections.has('watch') && (
              <div className="p-3 pt-0 space-y-2">
                {watchExpressions.map((watch) => (
                  <div
                    key={watch.id}
                    className="p-2 border border-gray-200 dark:border-gray-700 rounded"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <code className="text-xs flex-1 font-mono">{watch.expression}</code>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveWatch(watch.id)}
                        className="h-6 w-6 p-0"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                    <div className="text-xs font-mono">
                      {watch.error ? (
                        <span className="text-red-500">{watch.error}</span>
                      ) : (
                        <span className="text-green-600 dark:text-green-400">
                          {JSON.stringify(watch.value)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}

                <div className="flex gap-2">
                  <Input
                    type="text"
                    placeholder="Add watch expression..."
                    value={newWatchExpression}
                    onChange={(e) => setNewWatchExpression(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleAddWatch();
                      }
                    }}
                    className="flex-1 h-8 text-xs font-mono"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleAddWatch}
                    className="h-8"
                    disabled={!newWatchExpression.trim()}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>

                <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  <p className="font-medium mb-1">Available expressions:</p>
                  <ul className="list-disc list-inside space-y-0.5 ml-2">
                    <li>health, mana, phase, inCombat, timestamp</li>
                    <li>variables.keyName (custom variables)</li>
                  </ul>
                </div>
              </div>
            )}
          </Card>

          {/* Call Stack Section */}
          <Card className="overflow-hidden">
            <button
              className="w-full p-3 flex items-center gap-2 text-left hover:bg-gray-50 dark:hover:bg-gray-900"
              onClick={() => toggleSection('callstack')}
            >
              {expandedSections.has('callstack') ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
              <h3 className="font-semibold text-sm flex-1">Call Stack</h3>
              <Badge variant="outline" className="text-xs">
                {callStack.length}
              </Badge>
            </button>

            {expandedSections.has('callstack') && (
              <div className="p-3 pt-0 space-y-2">
                {callStack.length === 0 ? (
                  <div className="text-center text-sm text-gray-500 dark:text-gray-400 py-4">
                    <Layers className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>No active execution</p>
                  </div>
                ) : (
                  callStack.map((frame, index) => (
                    <div
                      key={frame.id}
                      className="p-2 border border-gray-200 dark:border-gray-700 rounded"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{getNodeTypeIcon(frame.type)}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">
                            <Badge variant="outline" className="mr-2 text-xs">
                              {frame.type}
                            </Badge>
                            {frame.node.label || frame.node.id}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {frame.node.id} • {(frame.timestamp / 1000).toFixed(1)}s
                          </p>
                        </div>
                      </div>
                    </div>
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

export default DebugPanel;
