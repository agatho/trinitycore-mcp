/**
 * Real-Time Server Health & Performance Dashboard
 * Live monitoring with metrics, health checks, and alerts
 */

"use client";

import { useState, useEffect } from "react";
import { ArrowLeft, Activity, Server, AlertCircle, CheckCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useMCPTool } from "@/hooks/useMCP";
import { TrendChart } from "@/components/charts/TrendChart";
import { ChartWrapper } from "@/components/charts/ChartWrapper";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface HealthStatus {
  database: string;
  mcp: string;
  overall: string;
}

interface MetricsSnapshot {
  timestamp: number;
  cpu: number;
  memory: number;
  queryLatency: number;
  activeConnections: number;
}

export default function MonitoringPage() {
  const [health, setHealth] = useState<HealthStatus>({ database: 'unknown', mcp: 'unknown', overall: 'unknown' });
  const [systemInfo, setSystemInfo] = useState<{
    uptime: string | null;
    version: string | null;
    toolCount: number | null;
    memory: string | null;
  }>({ uptime: null, version: null, toolCount: null, memory: null });
  const [metrics, setMetrics] = useState<MetricsSnapshot[]>([]);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const { callTool, loading } = useMCPTool();

  useEffect(() => {
    loadHealthStatus();
    loadMetrics();

    if (autoRefresh) {
      const interval = setInterval(() => {
        loadMetrics();
      }, 5000); // Refresh every 5 seconds

      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  /** Seconds to a readable duration, for the uptime the server reports. */
  const formatUptime = (seconds: number): string => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const loadHealthStatus = async () => {
    try {
      // The tool is get-health-status; "check-server-health" is not registered,
      // so this call failed and the result was cast to a shape it never had -
      // leaving health.overall undefined and crashing the render on
      // .toUpperCase(). The response is mapped explicitly now, and every field
      // falls back to "unknown" rather than to undefined.
      const result = (await callTool("get-health-status")) as {
        status?: string;
        summary?: { overall_status?: string; uptime_seconds?: number; version?: string };
        components?: Array<{ name?: string; status?: string; message?: string }>;
      };

      const componentStatus = (name: string): string =>
        result?.components?.find((c) => c.name === name)?.status || "unknown";

      setHealth({
        overall: result?.summary?.overall_status || result?.status || "unknown",
        database: componentStatus("database"),
        mcp: componentStatus("process"),
      });

      const seconds = result?.summary?.uptime_seconds;
      const process = result?.components?.find((c) => c.name === "process");
      setSystemInfo({
        uptime: typeof seconds === "number" ? formatUptime(seconds) : null,
        version: result?.summary?.version ?? null,
        toolCount: null,
        memory: process?.message ?? null,
      });
    } catch (err) {
      console.error('Failed to load health status:', err);
      setHealth({ overall: "unknown", database: "unknown", mcp: "unknown" });
    }
  };

  const loadMetrics = async () => {
    try {
      // These were Math.random(), plotted on a page headed "Real-time health &
      // performance metrics". Random numbers presented as live server telemetry
      // are worse than an empty chart: anyone reading them to judge whether the
      // server is healthy is being misled. The snapshot the tool already
      // returns is used instead, and a value the server does not report shows
      // as zero rather than as an invention.
      const result = (await callTool("get-metrics-snapshot", {
        format: "json",
        include_details: true,
      })) as {
        summary?: {
          system?: {
            cpu_percent?: number;
            memory_heap_used_mb?: number;
            memory_rss_mb?: number;
            active_connections?: number;
          };
          database?: { avg_query_ms?: number };
        };
      };

      const system = result?.summary?.system;
      const newMetric: MetricsSnapshot = {
        timestamp: Date.now(),
        cpu: system?.cpu_percent ?? 0,
        memory: system?.memory_heap_used_mb ?? 0,
        queryLatency: result?.summary?.database?.avg_query_ms ?? 0,
        activeConnections: system?.active_connections ?? 0,
      };

      setMetrics(prev => {
        const updated = [...prev, newMetric];
        // Keep last 20 data points
        return updated.slice(-20);
      });
    } catch (err) {
      console.error('Failed to load metrics:', err);
    }
  };

  const chartData = metrics.map(m => ({
    timestamp: new Date(m.timestamp).toLocaleTimeString(),
    CPU: m.cpu,
    Memory: m.memory,
    Latency: m.queryLatency,
  }));

  const getHealthColor = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'connected':
        return 'text-green-400';
      case 'degraded':
      case 'warning':
        return 'text-yellow-400';
      case 'unhealthy':
      case 'disconnected':
        return 'text-red-400';
      default:
        return 'text-slate-400';
    }
  };

  const getHealthIcon = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'connected':
        return <CheckCircle className="h-5 w-5 text-green-400" />;
      case 'degraded':
      case 'warning':
        return <AlertCircle className="h-5 w-5 text-yellow-400" />;
      case 'unhealthy':
      case 'disconnected':
        return <AlertCircle className="h-5 w-5 text-red-400" />;
      default:
        return <Activity className="h-5 w-5 text-slate-400" />;
    }
  };

  const latestMetrics = metrics[metrics.length - 1];

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <Link href="/">
              <Button variant="ghost" className="mb-4 text-slate-400 hover:text-white">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Home
              </Button>
            </Link>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4 mb-4">
                <div className="p-3 bg-green-500/20 rounded-lg">
                  <Activity className="w-8 h-8 text-green-400" />
                </div>
                <div>
                  <h1 className="text-5xl font-bold text-white">
                    Server Monitoring
                  </h1>
                  <p className="text-xl text-slate-300 mt-2">
                    Real-time <span className="text-green-400 font-semibold">health & performance</span> metrics
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant={autoRefresh ? "default" : "outline"}
                  size="sm"
                  onClick={() => setAutoRefresh(!autoRefresh)}
                >
                  <RefreshCw className={`mr-2 h-4 w-4 ${autoRefresh ? 'animate-spin' : ''}`} />
                  {autoRefresh ? 'Auto-Refresh On' : 'Auto-Refresh Off'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { loadHealthStatus(); loadMetrics(); }}
                  disabled={loading}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Refresh Now
                </Button>
              </div>
            </div>
          </div>

          {/* Health Status Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Overall Status
                  </CardTitle>
                  {getHealthIcon(health.overall)}
                </div>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${getHealthColor(health.overall)}`}>
                  {(health.overall || 'unknown').toUpperCase()}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Database
                  </CardTitle>
                  {getHealthIcon(health.database)}
                </div>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${getHealthColor(health.database)}`}>
                  {(health.database || 'unknown').toUpperCase()}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    MCP Server
                  </CardTitle>
                  {getHealthIcon(health.mcp)}
                </div>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${getHealthColor(health.mcp)}`}>
                  {(health.mcp || 'unknown').toUpperCase()}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Current Metrics */}
          {latestMetrics && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    CPU Usage
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">
                    {latestMetrics.cpu.toFixed(1)}%
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Heap Used
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">
                    {latestMetrics.memory.toFixed(0)} MB
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Query Latency
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">
                    {latestMetrics.queryLatency.toFixed(0)}ms
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Active Connections
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">
                    {latestMetrics.activeConnections}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Performance Trends */}
          <div className="space-y-6">
            <ChartWrapper
              title="CPU and Heap Usage"
              description="Real-time CPU and memory consumption over time"
              loading={loading || chartData.length === 0}
            >
              <TrendChart
                data={chartData}
                lines={[
                  { key: 'CPU', name: 'CPU Usage (%)', color: '#3b82f6' },
                  { key: 'Memory', name: 'Heap Used (MB)', color: '#10b981' },
                ]}
                height={300}
              />
            </ChartWrapper>

            <ChartWrapper
              title="Query Latency"
              description="Database query response time"
              loading={loading || chartData.length === 0}
            >
              <TrendChart
                data={chartData}
                lines={[
                  { key: 'Latency', name: 'Latency (ms)', color: '#f59e0b' },
                ]}
                height={300}
                type="area"
              />
            </ChartWrapper>
          </div>

          {/* System Information */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Server className="h-5 w-5 text-blue-400" />
                System Information
              </CardTitle>
              <CardDescription>
                Server configuration and runtime details
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* These were hardcoded - "7 days, 12 hours", "1,234,567 queries",
                  "MySQL 8.0.35", "80 tools" - and shown as if measured. On a
                  monitoring page that is worse than showing nothing: it reads
                  as fact. Only values actually reported are shown now, and
                  anything unavailable says so. */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="font-medium text-muted-foreground mb-1">Uptime</div>
                  <div>{systemInfo.uptime ?? "Not reported"}</div>
                </div>
                <div>
                  <div className="font-medium text-muted-foreground mb-1">Server Version</div>
                  <div>{systemInfo.version ?? "Not reported"}</div>
                </div>
                <div>
                  <div className="font-medium text-muted-foreground mb-1">MCP Tools</div>
                  <div>
                    {systemInfo.toolCount !== null
                      ? `${systemInfo.toolCount} tools available`
                      : "Not reported"}
                  </div>
                </div>
                <div>
                  <div className="font-medium text-muted-foreground mb-1">Memory</div>
                  <div>{systemInfo.memory ?? "Not reported"}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
