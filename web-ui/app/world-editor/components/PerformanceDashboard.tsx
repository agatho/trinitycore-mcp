'use client';

/**
 * Performance Dashboard Component
 *
 * Real-time performance monitoring overlay for the World Editor
 */

import React, { useState, useEffect } from 'react';
import {
  Activity,
  Cpu,
  HardDrive,
  Eye,
  AlertTriangle,
  Info,
  XCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  getPerformanceMonitor,
  type PerformanceMetrics,
  type PerformanceRecommendation,
} from '@/lib/performance-monitor';

interface PerformanceDashboardProps {
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  compact?: boolean;
}

export function PerformanceDashboard({
  position = 'top-right',
  compact = false,
}: PerformanceDashboardProps) {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [recommendations, setRecommendations] = useState<PerformanceRecommendation[]>([]);
  const [isExpanded, setIsExpanded] = useState(!compact);
  const [showRecommendations, setShowRecommendations] = useState(true);

  const monitor = getPerformanceMonitor();

  // Update metrics every second
  useEffect(() => {
    const interval = setInterval(() => {
      setMetrics(monitor.getMetrics());
      setRecommendations(monitor.getRecommendations());
    }, 1000);

    return () => clearInterval(interval);
  }, [monitor]);

  if (!metrics) return null;

  const grade = monitor.getPerformanceGrade();

  const positionClasses = {
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4',
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
  };

  const getFPSColor = (fps: number) => {
    if (fps >= 55) return 'text-green-400';
    if (fps >= 45) return 'text-blue-400';
    if (fps >= 30) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getMemoryColor = (used: number, limit: number) => {
    if (limit === 0) return 'text-slate-400';
    const percentage = (used / limit) * 100;
    if (percentage < 75) return 'text-green-400';
    if (percentage < 90) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <XCircle className="w-4 h-4 text-red-400" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-yellow-400" />;
      case 'info':
        return <Info className="w-4 h-4 text-blue-400" />;
      default:
        return null;
    }
  };

  return (
    <div
      className={`fixed ${positionClasses[position]} z-50 bg-slate-900/95 backdrop-blur border border-slate-700 rounded-lg shadow-2xl`}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-blue-400" />
          <span className="text-sm font-semibold text-white">Performance</span>
          <div className={`text-xs ${grade.color} font-medium`}>{grade.grade}</div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </Button>
      </div>

      {/* Content */}
      {isExpanded && (
        <div className="p-3 space-y-3 min-w-[280px]">
          {/* FPS */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-slate-400" />
              <span className="text-xs text-slate-300">FPS</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-sm font-bold ${getFPSColor(metrics.fps)}`}>
                {metrics.fps}
              </span>
              <span className="text-xs text-slate-500">
                ({metrics.frameTime.toFixed(1)}ms)
              </span>
            </div>
          </div>

          {/* Memory */}
          {metrics.memoryLimit > 0 && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-slate-400" />
                <span className="text-xs text-slate-300">Memory</span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`text-sm font-bold ${getMemoryColor(
                    metrics.memoryUsed,
                    metrics.memoryLimit
                  )}`}
                >
                  {metrics.memoryUsed} MB
                </span>
                <span className="text-xs text-slate-500">
                  / {metrics.memoryLimit} MB
                </span>
              </div>
            </div>
          )}

          {/* Draw Calls */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-slate-400" />
              <span className="text-xs text-slate-300">Draw Calls</span>
            </div>
            <span className="text-sm font-bold text-slate-200">{metrics.drawCalls}</span>
          </div>

          {/* Triangles */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">△</span>
              <span className="text-xs text-slate-300">Triangles</span>
            </div>
            <span className="text-sm font-bold text-slate-200">
              {metrics.triangles.toLocaleString()}
            </span>
          </div>

          {/* Assets */}
          <div className="border-t border-slate-700 pt-3 space-y-2">
            <div className="text-xs text-slate-400 font-semibold">Assets</div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-xs text-slate-500">Geo</div>
                <div className="text-sm font-bold text-slate-300">{metrics.geometries}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Tex</div>
                <div className="text-sm font-bold text-slate-300">{metrics.textures}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Prog</div>
                <div className="text-sm font-bold text-slate-300">{metrics.programs}</div>
              </div>
            </div>
          </div>

          {/* Recommendations */}
          {recommendations.length > 0 && (
            <div className="border-t border-slate-700 pt-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-xs text-slate-400 font-semibold">
                  Recommendations ({recommendations.length})
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 text-xs"
                  onClick={() => setShowRecommendations(!showRecommendations)}
                >
                  {showRecommendations ? 'Hide' : 'Show'}
                </Button>
              </div>

              {showRecommendations && (
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {recommendations.map((rec, idx) => (
                    <div
                      key={idx}
                      className="bg-slate-800/50 rounded p-2 space-y-1"
                    >
                      <div className="flex items-start gap-2">
                        {getSeverityIcon(rec.severity)}
                        <div className="flex-1">
                          <div className="text-xs text-slate-200">{rec.message}</div>
                          {rec.action && (
                            <div className="text-xs text-slate-400 mt-1">
                              → {rec.action}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Grade Message */}
          <div className="border-t border-slate-700 pt-2">
            <div className="text-xs text-slate-400 text-center">{grade.message}</div>
          </div>
        </div>
      )}

      {/* Compact View */}
      {!isExpanded && (
        <div className="p-2 flex items-center gap-3">
          <div className="flex items-center gap-1">
            <Cpu className="w-3 h-3 text-slate-400" />
            <span className={`text-sm font-bold ${getFPSColor(metrics.fps)}`}>
              {metrics.fps}
            </span>
          </div>
          {metrics.memoryLimit > 0 && (
            <div className="flex items-center gap-1">
              <HardDrive className="w-3 h-3 text-slate-400" />
              <span
                className={`text-sm font-bold ${getMemoryColor(
                  metrics.memoryUsed,
                  metrics.memoryLimit
                )}`}
              >
                {metrics.memoryUsed}
              </span>
            </div>
          )}
          {recommendations.length > 0 && (
            <div className="flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 text-yellow-400" />
              <span className="text-sm font-bold text-yellow-400">
                {recommendations.length}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
