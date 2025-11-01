/**
 * Performance Analyzer Core Engine
 * Phase 5 - Week 4: Performance Analysis & Optimization
 *
 * Provides comprehensive performance analysis for Playerbot development including:
 * - Metrics collection (CPU, memory, network, custom)
 * - Statistical analysis (mean, median, percentiles)
 * - Bottleneck detection
 * - Trend analysis
 * - Report generation
 */

import pidusage from 'pidusage';
import si from 'systeminformation';
import * as fs from 'fs/promises';
import * as path from 'path';
import { create, all } from 'mathjs';

const math = create(all);

// ============================================================================
// Type Definitions
// ============================================================================

export interface MetricsOptions {
  processId?: number;                 // Target process ID (default: current process)
  duration?: number;                  // Collection duration in ms (default: 10000)
  interval?: number;                  // Sampling interval in ms (default: 100)
  metrics?: {
    cpu?: boolean;                    // Collect CPU metrics (default: true)
    memory?: boolean;                 // Collect memory metrics (default: true)
    network?: boolean;                // Collect network metrics (default: true)
    custom?: boolean;                 // Collect custom bot metrics (default: false)
  };
}

export interface MetricsSnapshot {
  timestamp: number;
  processId: number;

  cpu?: {
    percentUsage: number;             // CPU usage percentage
  };

  memory?: {
    privateBytesMB: number;           // Private memory in MB
    workingSetMB: number;             // Working set in MB
  };

  network?: {
    bytesSent: number;                // Bytes sent since last snapshot
    bytesReceived: number;            // Bytes received since last snapshot
  };

  custom?: {
    [key: string]: number;            // Custom metrics
  };
}

export interface Statistics {
  count: number;
  mean: number;
  median: number;
  min: number;
  max: number;
  stddev: number;
  variance: number;
  p50: number;
  p90: number;
  p95: number;
  p99: number;
}

export interface PerformanceSummary {
  totalSamples: number;
  timeRangeMs: number;
  samplingIntervalMs: number;

  cpu?: Statistics;
  memory?: Statistics;
  network?: {
    sentKBps: Statistics;
    recvKBps: Statistics;
  };
}

export interface Bottleneck {
  type: 'cpu' | 'memory' | 'network' | 'custom';
  severity: 'low' | 'medium' | 'high' | 'critical';
  metric: string;
  value: number;
  threshold: number;
  description: string;
  recommendation: string;
}

export interface TrendAnalysis {
  cpuTrend: 'increasing' | 'decreasing' | 'stable';
  memoryTrend: 'increasing' | 'decreasing' | 'stable';
  memoryLeakDetected: boolean;
  memoryLeakRateMBPerMinute?: number;
}

export interface PerformanceReport {
  metadata: {
    generatedAt: Date;
    processId: number;
    duration: number;
  };

  summary: PerformanceSummary;
  bottlenecks: Bottleneck[];
  trends: TrendAnalysis;
}

// ============================================================================
// PerformanceAnalyzer Class
// ============================================================================

export class PerformanceAnalyzer {
  private snapshots: MetricsSnapshot[] = [];
  private monitoring: boolean = false;
  private monitoringInterval?: NodeJS.Timeout;

  constructor() {}

  /**
   * Collect metrics for a specified duration
   */
  async collectMetrics(options: MetricsOptions = {}): Promise<MetricsSnapshot[]> {
    const {
      processId = process.pid,
      duration = 10000,
      interval = 100,
      metrics = { cpu: true, memory: true, network: true }
    } = options;

    const snapshots: MetricsSnapshot[] = [];
    const startTime = Date.now();

    // Initial network baseline
    let lastNetworkStats = metrics.network ? await si.networkStats() : null;

    while (Date.now() - startTime < duration) {
      const snapshot = await this.captureSnapshot(processId, metrics, lastNetworkStats);
      snapshots.push(snapshot);

      if (metrics.network) {
        lastNetworkStats = await si.networkStats();
      }

      // Wait for next interval
      await this.sleep(interval);
    }

    this.snapshots = snapshots;
    return snapshots;
  }

  /**
   * Capture a single metrics snapshot
   */
  private async captureSnapshot(
    processId: number,
    metricsOptions: any,
    lastNetworkStats: any
  ): Promise<MetricsSnapshot> {
    const snapshot: MetricsSnapshot = {
      timestamp: Date.now(),
      processId
    };

    // CPU and Memory (via pidusage)
    if (metricsOptions.cpu || metricsOptions.memory) {
      try {
        const stats = await pidusage(processId);

        if (metricsOptions.cpu) {
          snapshot.cpu = {
            percentUsage: stats.cpu
          };
        }

        if (metricsOptions.memory) {
          snapshot.memory = {
            privateBytesMB: stats.memory / 1024 / 1024,
            workingSetMB: stats.memory / 1024 / 1024  // pidusage doesn't distinguish, use same value
          };
        }
      } catch (error) {
        console.warn(`Failed to get process metrics: ${error}`);
      }
    }

    // Network stats
    if (metricsOptions.network) {
      try {
        const networkStats = await si.networkStats();

        if (networkStats && networkStats.length > 0) {
          const primaryInterface = networkStats[0];

          snapshot.network = {
            bytesSent: primaryInterface.tx_bytes,
            bytesReceived: primaryInterface.rx_bytes
          };
        }
      } catch (error) {
        console.warn(`Failed to get network stats: ${error}`);
      }
    }

    return snapshot;
  }

  /**
   * Start continuous monitoring
   */
  async startMonitoring(options: MetricsOptions = {}): Promise<void> {
    if (this.monitoring) {
      throw new Error('Already monitoring. Stop current monitoring first.');
    }

    const {
      processId = process.pid,
      interval = 1000,
      metrics = { cpu: true, memory: true, network: true }
    } = options;

    this.monitoring = true;
    this.snapshots = [];

    let lastNetworkStats = metrics.network ? await si.networkStats() : null;

    this.monitoringInterval = setInterval(async () => {
      const snapshot = await this.captureSnapshot(processId, metrics, lastNetworkStats);
      this.snapshots.push(snapshot);

      // Keep only last 10000 snapshots to prevent memory issues
      if (this.snapshots.length > 10000) {
        this.snapshots.shift();
      }

      if (metrics.network) {
        lastNetworkStats = await si.networkStats();
      }
    }, interval);
  }

  /**
   * Stop continuous monitoring
   */
  async stopMonitoring(): Promise<MetricsSnapshot[]> {
    if (!this.monitoring) {
      throw new Error('Not currently monitoring.');
    }

    this.monitoring = false;

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }

    return this.snapshots;
  }

  /**
   * Analyze collected performance data
   */
  async analyzePerformance(snapshots?: MetricsSnapshot[]): Promise<PerformanceReport> {
    const data = snapshots || this.snapshots;

    if (data.length === 0) {
      throw new Error('No metrics data to analyze');
    }

    const start = performance.now();

    // Calculate summary statistics
    const summary = this.calculateSummary(data);

    // Detect bottlenecks
    const bottlenecks = this.detectBottlenecks(data, summary);

    // Analyze trends
    const trends = this.analyzeTrends(data);

    const analysisTime = performance.now() - start;

    return {
      metadata: {
        generatedAt: new Date(),
        processId: data[0].processId,
        duration: data[data.length - 1].timestamp - data[0].timestamp
      },
      summary,
      bottlenecks,
      trends
    };
  }

  /**
   * Calculate summary statistics from snapshots
   */
  private calculateSummary(snapshots: MetricsSnapshot[]): PerformanceSummary {
    const timeRange = snapshots[snapshots.length - 1].timestamp - snapshots[0].timestamp;
    const samplingInterval = timeRange / (snapshots.length - 1);

    const summary: PerformanceSummary = {
      totalSamples: snapshots.length,
      timeRangeMs: timeRange,
      samplingIntervalMs: Math.round(samplingInterval)
    };

    // CPU statistics
    const cpuValues = snapshots
      .filter(s => s.cpu)
      .map(s => s.cpu!.percentUsage);

    if (cpuValues.length > 0) {
      summary.cpu = this.calculateStats(cpuValues);
    }

    // Memory statistics
    const memoryValues = snapshots
      .filter(s => s.memory)
      .map(s => s.memory!.privateBytesMB);

    if (memoryValues.length > 0) {
      summary.memory = this.calculateStats(memoryValues);
    }

    // Network statistics
    const networkSentKBps: number[] = [];
    const networkRecvKBps: number[] = [];

    for (let i = 1; i < snapshots.length; i++) {
      const prev = snapshots[i - 1];
      const curr = snapshots[i];

      if (prev.network && curr.network) {
        const timeDeltaS = (curr.timestamp - prev.timestamp) / 1000;
        const bytesSentDelta = curr.network.bytesSent - prev.network.bytesSent;
        const bytesRecvDelta = curr.network.bytesReceived - prev.network.bytesReceived;

        networkSentKBps.push((bytesSentDelta / 1024) / timeDeltaS);
        networkRecvKBps.push((bytesRecvDelta / 1024) / timeDeltaS);
      }
    }

    if (networkSentKBps.length > 0) {
      summary.network = {
        sentKBps: this.calculateStats(networkSentKBps),
        recvKBps: this.calculateStats(networkRecvKBps)
      };
    }

    return summary;
  }

  /**
   * Calculate statistical measures for a dataset
   */
  calculateStats(values: number[]): Statistics {
    if (values.length === 0) {
      throw new Error('Cannot calculate statistics for empty dataset');
    }

    const sorted = [...values].sort((a, b) => a - b);
    const mean = Number(math.mean(values));
    const median = Number(math.median(values));
    const stddev = Number(math.std(values));
    const variance = Number(math.variance(values));

    return {
      count: values.length,
      mean,
      median,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      stddev,
      variance,
      p50: this.percentile(sorted, 50),
      p90: this.percentile(sorted, 90),
      p95: this.percentile(sorted, 95),
      p99: this.percentile(sorted, 99)
    };
  }

  /**
   * Calculate percentile value from sorted array
   */
  private percentile(sortedValues: number[], p: number): number {
    if (p < 0 || p > 100) {
      throw new Error('Percentile must be between 0 and 100');
    }

    const index = (p / 100) * (sortedValues.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);

    if (lower === upper) {
      return sortedValues[lower];
    }

    const weight = index - lower;
    return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
  }

  /**
   * Detect performance bottlenecks
   */
  private detectBottlenecks(snapshots: MetricsSnapshot[], summary: PerformanceSummary): Bottleneck[] {
    const bottlenecks: Bottleneck[] = [];

    // CPU bottleneck detection
    if (summary.cpu) {
      if (summary.cpu.mean > 80) {
        bottlenecks.push({
          type: 'cpu',
          severity: 'critical',
          metric: 'CPU Usage (Mean)',
          value: summary.cpu.mean,
          threshold: 80,
          description: `Average CPU usage is ${summary.cpu.mean.toFixed(1)}%, exceeding 80% threshold`,
          recommendation: 'Consider optimizing hot paths, reducing lock contention, or distributing bots across threads'
        });
      } else if (summary.cpu.p95 > 90) {
        bottlenecks.push({
          type: 'cpu',
          severity: 'high',
          metric: 'CPU Usage (p95)',
          value: summary.cpu.p95,
          threshold: 90,
          description: `95th percentile CPU usage is ${summary.cpu.p95.toFixed(1)}%, indicating frequent spikes`,
          recommendation: 'Profile CPU hotspots and optimize high-frequency code paths'
        });
      }
    }

    // Memory bottleneck detection
    if (summary.memory) {
      if (summary.memory.mean > 8192) {  // 8 GB
        bottlenecks.push({
          type: 'memory',
          severity: 'critical',
          metric: 'Memory Usage (Mean)',
          value: summary.memory.mean,
          threshold: 8192,
          description: `Average memory usage is ${(summary.memory.mean / 1024).toFixed(1)} GB, exceeding 8 GB threshold`,
          recommendation: 'Investigate memory leaks, implement object pooling, or reduce per-bot memory footprint'
        });
      }

      // Check for high variance (potential memory leak)
      const memoryCoeffVar = summary.memory.stddev / summary.memory.mean;
      if (memoryCoeffVar > 0.2) {
        bottlenecks.push({
          type: 'memory',
          severity: 'medium',
          metric: 'Memory Variance',
          value: memoryCoeffVar,
          threshold: 0.2,
          description: 'High memory usage variance detected, possible memory leak',
          recommendation: 'Run memory profiler to identify leak sources'
        });
      }
    }

    // Network bottleneck detection
    if (summary.network) {
      const totalBandwidthMbps = (summary.network.sentKBps.mean + summary.network.recvKBps.mean) / 128;

      if (totalBandwidthMbps > 100) {
        bottlenecks.push({
          type: 'network',
          severity: 'high',
          metric: 'Network Bandwidth',
          value: totalBandwidthMbps,
          threshold: 100,
          description: `Network bandwidth usage is ${totalBandwidthMbps.toFixed(1)} Mbps, approaching saturation`,
          recommendation: 'Implement packet batching, reduce update frequency, or enable compression'
        });
      }
    }

    return bottlenecks;
  }

  /**
   * Analyze performance trends over time
   */
  private analyzeTrends(snapshots: MetricsSnapshot[]): TrendAnalysis {
    const cpuTrend = this.detectTrend(snapshots.filter(s => s.cpu).map(s => s.cpu!.percentUsage));
    const memoryValues = snapshots.filter(s => s.memory).map(s => s.memory!.privateBytesMB);
    const memoryTrend = this.detectTrend(memoryValues);

    // Memory leak detection (increasing memory over time)
    const memoryLeakDetected = memoryTrend === 'increasing';
    let memoryLeakRateMBPerMinute: number | undefined;

    if (memoryLeakDetected && memoryValues.length > 10) {
      // Calculate leak rate using linear regression
      const timeRange = (snapshots[snapshots.length - 1].timestamp - snapshots[0].timestamp) / 1000 / 60; // minutes
      const memoryIncrease = memoryValues[memoryValues.length - 1] - memoryValues[0];
      memoryLeakRateMBPerMinute = memoryIncrease / timeRange;
    }

    return {
      cpuTrend,
      memoryTrend,
      memoryLeakDetected,
      memoryLeakRateMBPerMinute
    };
  }

  /**
   * Detect trend direction in time series data
   */
  private detectTrend(values: number[]): 'increasing' | 'decreasing' | 'stable' {
    if (values.length < 2) {
      return 'stable';
    }

    // Simple linear regression slope
    const n = values.length;
    const sumX = (n * (n - 1)) / 2;
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = values.reduce((sum, y, x) => sum + x * y, 0);
    const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);

    // Threshold for detecting trend (>1% change per sample)
    const avgValue = sumY / n;
    const threshold = avgValue * 0.01;

    if (slope > threshold) {
      return 'increasing';
    } else if (slope < -threshold) {
      return 'decreasing';
    } else {
      return 'stable';
    }
  }

  /**
   * Export metrics to CSV
   */
  async exportCSV(snapshots: MetricsSnapshot[], outputPath: string): Promise<void> {
    const rows: string[] = [];

    // Header
    rows.push('timestamp,cpu_percent,memory_mb,network_sent_bytes,network_recv_bytes');

    // Data rows
    for (const snapshot of snapshots) {
      const row = [
        new Date(snapshot.timestamp).toISOString(),
        snapshot.cpu?.percentUsage.toFixed(2) || '',
        snapshot.memory?.privateBytesMB.toFixed(2) || '',
        snapshot.network?.bytesSent || '',
        snapshot.network?.bytesReceived || ''
      ];

      rows.push(row.join(','));
    }

    await fs.writeFile(outputPath, rows.join('\n'), 'utf-8');
  }

  /**
   * Helper: Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get current snapshots
   */
  getSnapshots(): MetricsSnapshot[] {
    return this.snapshots;
  }

  /**
   * Clear collected snapshots
   */
  clearSnapshots(): void {
    this.snapshots = [];
  }
}
