/**
 * TrinityCore MCP - Load Testing Framework
 *
 * Comprehensive load and stress testing framework for production readiness.
 * Simulates realistic workloads and measures system performance under stress.
 *
 * Features:
 * - Concurrent request simulation
 * - Realistic workload patterns
 * - Performance metrics collection
 * - Bottleneck identification
 * - Resource utilization monitoring
 * - Scalability testing
 * - Endurance testing
 * - Peak load simulation
 *
 * @module LoadTester
 */

import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';
import { logger } from '../utils/logger';
import * as os from 'os';

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Load test configuration
 */
export interface LoadTestConfig {
  name: string;
  description: string;
  duration: number; // seconds
  concurrency: number;
  rampUpTime?: number; // seconds
  requestsPerSecond?: number;
  scenarios: TestScenario[];
}

/**
 * Test scenario
 */
export interface TestScenario {
  name: string;
  weight: number; // Probability weight (0-1)
  execute: () => Promise<ScenarioResult>;
}

/**
 * Scenario result
 */
export interface ScenarioResult {
  success: boolean;
  duration: number;
  error?: string;
  metadata?: Record<string, any>;
}

/**
 * Load test result
 */
export interface LoadTestResult {
  config: LoadTestConfig;
  startTime: number;
  endTime: number;
  duration: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  requestsPerSecond: number;
  avgResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  p50ResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  errorRate: number;
  throughput: number;
  concurrency: number;
  cpuUsage: CPUStats;
  memoryUsage: MemoryStats;
  errors: ErrorSummary[];
  bottlenecks: Bottleneck[];
}

/**
 * CPU statistics
 */
export interface CPUStats {
  avgUsage: number;
  peakUsage: number;
  samples: number[];
}

/**
 * Memory statistics
 */
export interface MemoryStats {
  avgUsage: number;
  peakUsage: number;
  avgHeapUsed: number;
  peakHeapUsed: number;
  samples: number[];
}

/**
 * Error summary
 */
export interface ErrorSummary {
  error: string;
  count: number;
  percentage: number;
}

/**
 * Bottleneck
 */
export interface Bottleneck {
  type: 'cpu' | 'memory' | 'io' | 'network' | 'database';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  metric: number;
  threshold: number;
}

/**
 * Request metrics
 */
interface RequestMetrics {
  startTime: number;
  endTime: number;
  duration: number;
  success: boolean;
  error?: string;
  scenario: string;
}

// ============================================================================
// Load Tester Class
// ============================================================================

/**
 * Load Tester
 *
 * Executes load tests and collects comprehensive performance metrics.
 */
export class LoadTester extends EventEmitter {
  private isRunning: boolean = false;
  private metrics: RequestMetrics[] = [];
  private cpuSamples: number[] = [];
  private memorySamples: number[] = [];
  private errorCounts: Map<string, number> = new Map();

  constructor() {
    super();
    logger.info('LoadTester initialized');
  }

  /**
   * Run load test
   */
  async runTest(config: LoadTestConfig): Promise<LoadTestResult> {
    if (this.isRunning) {
      throw new Error('Load test already running');
    }

    logger.info('Starting load test', {
      name: config.name,
      duration: config.duration,
      concurrency: config.concurrency,
    });

    this.isRunning = true;
    this.metrics = [];
    this.cpuSamples = [];
    this.memorySamples = [];
    this.errorCounts.clear();

    const startTime = Date.now();

    try {
      // Start resource monitoring
      const monitoringInterval = this.startResourceMonitoring();

      // Execute test
      await this.executeLoadTest(config);

      // Stop monitoring
      clearInterval(monitoringInterval);

      const endTime = Date.now();

      // Calculate results
      const result = this.calculateResults(config, startTime, endTime);

      logger.info('Load test completed', {
        name: config.name,
        duration: result.duration,
        totalRequests: result.totalRequests,
        successRate: `${((1 - result.errorRate) * 100).toFixed(2)}%`,
        avgResponseTime: `${result.avgResponseTime.toFixed(2)}ms`,
      });

      this.emit('test-complete', result);

      return result;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Execute load test
   */
  private async executeLoadTest(config: LoadTestConfig): Promise<void> {
    const { duration, concurrency, rampUpTime = 0, scenarios } = config;

    const endTime = Date.now() + duration * 1000;
    const rampUpEndTime = Date.now() + rampUpTime * 1000;

    let currentConcurrency = rampUpTime > 0 ? 1 : concurrency;
    const workers: Promise<void>[] = [];

    // Ramp up workers
    if (rampUpTime > 0) {
      const rampUpInterval = setInterval(() => {
        if (Date.now() < rampUpEndTime) {
          const progress = (Date.now() - (endTime - duration * 1000)) / (rampUpTime * 1000);
          currentConcurrency = Math.ceil(concurrency * progress);
        } else {
          currentConcurrency = concurrency;
          clearInterval(rampUpInterval);
        }
      }, 100);
    }

    // Spawn workers
    for (let i = 0; i < concurrency; i++) {
      const worker = this.worker(scenarios, endTime, () => currentConcurrency > i);
      workers.push(worker);
    }

    // Wait for all workers to complete
    await Promise.all(workers);
  }

  /**
   * Worker function - executes scenarios continuously
   */
  private async worker(
    scenarios: TestScenario[],
    endTime: number,
    shouldRun: () => boolean
  ): Promise<void> {
    while (Date.now() < endTime && shouldRun()) {
      const scenario = this.selectScenario(scenarios);
      const startTime = performance.now();

      try {
        const result = await scenario.execute();
        const duration = performance.now() - startTime;

        this.metrics.push({
          startTime,
          endTime: performance.now(),
          duration,
          success: result.success,
          error: result.error,
          scenario: scenario.name,
        });

        if (!result.success && result.error) {
          this.errorCounts.set(
            result.error,
            (this.errorCounts.get(result.error) || 0) + 1
          );
        }

        this.emit('request-complete', {
          scenario: scenario.name,
          duration,
          success: result.success,
        });
      } catch (error: any) {
        const duration = performance.now() - startTime;

        this.metrics.push({
          startTime,
          endTime: performance.now(),
          duration,
          success: false,
          error: error.message,
          scenario: scenario.name,
        });

        this.errorCounts.set(
          error.message,
          (this.errorCounts.get(error.message) || 0) + 1
        );

        this.emit('request-error', {
          scenario: scenario.name,
          error: error.message,
        });
      }

      // Small delay to prevent overwhelming the system
      await this.sleep(1);
    }
  }

  /**
   * Select scenario based on weights
   */
  private selectScenario(scenarios: TestScenario[]): TestScenario {
    const totalWeight = scenarios.reduce((sum, s) => sum + s.weight, 0);
    let random = Math.random() * totalWeight;

    for (const scenario of scenarios) {
      random -= scenario.weight;
      if (random <= 0) {
        return scenario;
      }
    }

    return scenarios[scenarios.length - 1];
  }

  /**
   * Start resource monitoring
   */
  private startResourceMonitoring(): NodeJS.Timeout {
    return setInterval(() => {
      // CPU usage
      const cpus = os.cpus();
      const avgLoad = os.loadavg()[0];
      const cpuUsage = (avgLoad / cpus.length) * 100;
      this.cpuSamples.push(cpuUsage);

      // Memory usage
      const memUsage = process.memoryUsage();
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const memPercent = ((totalMem - freeMem) / totalMem) * 100;
      this.memorySamples.push(memPercent);
    }, 1000);
  }

  /**
   * Calculate test results
   */
  private calculateResults(
    config: LoadTestConfig,
    startTime: number,
    endTime: number
  ): LoadTestResult {
    const duration = endTime - startTime;
    const totalRequests = this.metrics.length;
    const successfulRequests = this.metrics.filter((m) => m.success).length;
    const failedRequests = totalRequests - successfulRequests;

    const durations = this.metrics.map((m) => m.duration).sort((a, b) => a - b);

    return {
      config,
      startTime,
      endTime,
      duration,
      totalRequests,
      successfulRequests,
      failedRequests,
      requestsPerSecond: totalRequests / (duration / 1000),
      avgResponseTime: this.average(durations),
      minResponseTime: durations[0] || 0,
      maxResponseTime: durations[durations.length - 1] || 0,
      p50ResponseTime: this.percentile(durations, 0.5),
      p95ResponseTime: this.percentile(durations, 0.95),
      p99ResponseTime: this.percentile(durations, 0.99),
      errorRate: failedRequests / totalRequests,
      throughput: successfulRequests / (duration / 1000),
      concurrency: config.concurrency,
      cpuUsage: {
        avgUsage: this.average(this.cpuSamples),
        peakUsage: Math.max(...this.cpuSamples),
        samples: this.cpuSamples,
      },
      memoryUsage: {
        avgUsage: this.average(this.memorySamples),
        peakUsage: Math.max(...this.memorySamples),
        avgHeapUsed: this.average(
          this.metrics.map(() => process.memoryUsage().heapUsed)
        ),
        peakHeapUsed: Math.max(
          ...this.metrics.map(() => process.memoryUsage().heapUsed)
        ),
        samples: this.memorySamples,
      },
      errors: this.summarizeErrors(totalRequests),
      bottlenecks: this.identifyBottlenecks(),
    };
  }

  /**
   * Summarize errors
   */
  private summarizeErrors(totalRequests: number): ErrorSummary[] {
    const errors: ErrorSummary[] = [];

    for (const [error, count] of this.errorCounts) {
      errors.push({
        error,
        count,
        percentage: (count / totalRequests) * 100,
      });
    }

    return errors.sort((a, b) => b.count - a.count);
  }

  /**
   * Identify performance bottlenecks
   */
  private identifyBottlenecks(): Bottleneck[] {
    const bottlenecks: Bottleneck[] = [];

    // CPU bottleneck
    const avgCPU = this.average(this.cpuSamples);
    const peakCPU = Math.max(...this.cpuSamples);

    if (peakCPU > 90) {
      bottlenecks.push({
        type: 'cpu',
        severity: 'critical',
        description: 'CPU usage exceeded 90%',
        metric: peakCPU,
        threshold: 90,
      });
    } else if (avgCPU > 75) {
      bottlenecks.push({
        type: 'cpu',
        severity: 'high',
        description: 'Average CPU usage exceeded 75%',
        metric: avgCPU,
        threshold: 75,
      });
    }

    // Memory bottleneck
    const avgMem = this.average(this.memorySamples);
    const peakMem = Math.max(...this.memorySamples);

    if (peakMem > 85) {
      bottlenecks.push({
        type: 'memory',
        severity: 'critical',
        description: 'Memory usage exceeded 85%',
        metric: peakMem,
        threshold: 85,
      });
    } else if (avgMem > 70) {
      bottlenecks.push({
        type: 'memory',
        severity: 'high',
        description: 'Average memory usage exceeded 70%',
        metric: avgMem,
        threshold: 70,
      });
    }

    // Response time bottleneck
    const p99 = this.percentile(
      this.metrics.map((m) => m.duration),
      0.99
    );

    if (p99 > 5000) {
      bottlenecks.push({
        type: 'io',
        severity: 'critical',
        description: 'P99 response time exceeded 5 seconds',
        metric: p99,
        threshold: 5000,
      });
    } else if (p99 > 2000) {
      bottlenecks.push({
        type: 'io',
        severity: 'high',
        description: 'P99 response time exceeded 2 seconds',
        metric: p99,
        threshold: 2000,
      });
    }

    return bottlenecks;
  }

  /**
   * Calculate average
   */
  private average(numbers: number[]): number {
    if (numbers.length === 0) return 0;
    return numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
  }

  /**
   * Calculate percentile
   */
  private percentile(sortedNumbers: number[], p: number): number {
    if (sortedNumbers.length === 0) return 0;
    const index = Math.ceil(sortedNumbers.length * p) - 1;
    return sortedNumbers[Math.max(0, index)];
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Generate HTML report
   */
  generateHTMLReport(result: LoadTestResult): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <title>Load Test Report - ${result.config.name}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    .summary { background: #f0f0f0; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
    .metric { display: inline-block; margin: 10px; }
    .metric-value { font-size: 2em; font-weight: bold; color: #333; }
    .metric-label { font-size: 0.9em; color: #666; }
    .error { background: #fff3cd; border-left: 4px solid #ffc107; padding: 10px; margin: 10px 0; }
    .bottleneck { background: #f8d7da; border-left: 4px solid #dc3545; padding: 10px; margin: 10px 0; }
    .success { color: #28a745; }
    .warning { color: #ffc107; }
    .danger { color: #dc3545; }
    table { width: 100%; border-collapse: collapse; }
    th, td { text-align: left; padding: 12px; border-bottom: 1px solid #ddd; }
    th { background-color: #f8f9fa; }
  </style>
</head>
<body>
  <h1>Load Test Report</h1>
  <h2>${result.config.name}</h2>
  <p>${result.config.description}</p>

  <div class="summary">
    <div class="metric">
      <div class="metric-value">${result.totalRequests}</div>
      <div class="metric-label">Total Requests</div>
    </div>
    <div class="metric">
      <div class="metric-value ${result.errorRate < 0.01 ? 'success' : 'danger'}">${((1 - result.errorRate) * 100).toFixed(2)}%</div>
      <div class="metric-label">Success Rate</div>
    </div>
    <div class="metric">
      <div class="metric-value">${result.requestsPerSecond.toFixed(2)}</div>
      <div class="metric-label">Requests/Second</div>
    </div>
    <div class="metric">
      <div class="metric-value">${result.avgResponseTime.toFixed(2)}ms</div>
      <div class="metric-label">Avg Response Time</div>
    </div>
  </div>

  <h3>Response Time Percentiles</h3>
  <table>
    <tr>
      <th>Metric</th>
      <th>Value</th>
    </tr>
    <tr>
      <td>Minimum</td>
      <td>${result.minResponseTime.toFixed(2)}ms</td>
    </tr>
    <tr>
      <td>Average</td>
      <td>${result.avgResponseTime.toFixed(2)}ms</td>
    </tr>
    <tr>
      <td>P50 (Median)</td>
      <td>${result.p50ResponseTime.toFixed(2)}ms</td>
    </tr>
    <tr>
      <td>P95</td>
      <td>${result.p95ResponseTime.toFixed(2)}ms</td>
    </tr>
    <tr>
      <td>P99</td>
      <td>${result.p99ResponseTime.toFixed(2)}ms</td>
    </tr>
    <tr>
      <td>Maximum</td>
      <td>${result.maxResponseTime.toFixed(2)}ms</td>
    </tr>
  </table>

  <h3>Resource Utilization</h3>
  <table>
    <tr>
      <th>Resource</th>
      <th>Average</th>
      <th>Peak</th>
    </tr>
    <tr>
      <td>CPU</td>
      <td>${result.cpuUsage.avgUsage.toFixed(2)}%</td>
      <td>${result.cpuUsage.peakUsage.toFixed(2)}%</td>
    </tr>
    <tr>
      <td>Memory</td>
      <td>${result.memoryUsage.avgUsage.toFixed(2)}%</td>
      <td>${result.memoryUsage.peakUsage.toFixed(2)}%</td>
    </tr>
  </table>

  ${result.bottlenecks.length > 0 ? `
  <h3>Bottlenecks Detected</h3>
  ${result.bottlenecks.map(b => `
    <div class="bottleneck">
      <strong>${b.severity.toUpperCase()}: ${b.type}</strong><br>
      ${b.description}<br>
      <em>Metric: ${b.metric.toFixed(2)}, Threshold: ${b.threshold}</em>
    </div>
  `).join('')}
  ` : ''}

  ${result.errors.length > 0 ? `
  <h3>Error Summary</h3>
  <table>
    <tr>
      <th>Error</th>
      <th>Count</th>
      <th>Percentage</th>
    </tr>
    ${result.errors.map(e => `
      <tr>
        <td>${e.error}</td>
        <td>${e.count}</td>
        <td>${e.percentage.toFixed(2)}%</td>
      </tr>
    `).join('')}
  </table>
  ` : ''}

  <p style="margin-top: 40px; color: #666; font-size: 0.9em;">
    Generated at: ${new Date().toISOString()}<br>
    Duration: ${(result.duration / 1000).toFixed(2)} seconds<br>
    Concurrency: ${result.concurrency}
  </p>
</body>
</html>
    `.trim();
  }
}
