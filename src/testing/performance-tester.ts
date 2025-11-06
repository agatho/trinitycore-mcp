/**
 * Performance Tester
 *
 * Performance and load testing framework for TrinityCore MCP.
 *
 * @module performance-tester
 */

import { EventEmitter } from "events";

// ============================================================================
// Types
// ============================================================================

/**
 * Performance test configuration
 */
export interface PerformanceConfig {
  /** Test name */
  name: string;

  /** Number of iterations */
  iterations?: number;

  /** Number of concurrent executions */
  concurrency?: number;

  /** Warm-up iterations */
  warmup?: number;

  /** Timeout per iteration (ms) */
  timeout?: number;

  /** Memory limit (MB) */
  memoryLimit?: number;
}

/**
 * Performance result
 */
export interface PerformanceResult {
  /** Test name */
  name: string;

  /** Total iterations */
  iterations: number;

  /** Timing statistics */
  timing: {
    min: number;
    max: number;
    mean: number;
    median: number;
    p95: number;
    p99: number;
    stdDev: number;
  };

  /** Memory statistics */
  memory: {
    initial: number;
    peak: number;
    final: number;
    leaked: number;
  };

  /** Throughput (ops/sec) */
  throughput: number;

  /** Duration (ms) */
  duration: number;

  /** Success rate */
  successRate: number;

  /** Errors */
  errors: number;
}

/**
 * Load test configuration
 */
export interface LoadTestConfig {
  /** Test name */
  name: string;

  /** Target requests per second */
  rps?: number;

  /** Test duration (ms) */
  duration?: number;

  /** Ramp-up time (ms) */
  rampUp?: number;

  /** Max concurrent requests */
  maxConcurrency?: number;
}

/**
 * Load test result
 */
export interface LoadTestResult {
  /** Test name */
  name: string;

  /** Total requests */
  totalRequests: number;

  /** Successful requests */
  successfulRequests: number;

  /** Failed requests */
  failedRequests: number;

  /** Average response time (ms) */
  avgResponseTime: number;

  /** Requests per second achieved */
  actualRps: number;

  /** Duration (ms) */
  duration: number;

  /** Latency percentiles */
  latency: {
    p50: number;
    p75: number;
    p95: number;
    p99: number;
    max: number;
  };
}

// ============================================================================
// Performance Tester
// ============================================================================

export class PerformanceTester extends EventEmitter {
  /**
   * Run performance test
   */
  public async test<T>(
    fn: () => Promise<T> | T,
    config: PerformanceConfig,
  ): Promise<PerformanceResult> {
    const iterations = config.iterations ?? 1000;
    const warmup = config.warmup ?? 10;
    const concurrency = config.concurrency ?? 1;

    this.emit("start", { name: config.name, iterations });

    // Warm-up
    for (let i = 0; i < warmup; i++) {
      await fn();
    }

    // Collect baseline memory
    const initialMemory = this.getMemoryUsage();

    // Run test
    const durations: number[] = [];
    const memorySnapshots: number[] = [];
    let errors = 0;

    const startTime = Date.now();

    if (concurrency === 1) {
      // Sequential execution
      for (let i = 0; i < iterations; i++) {
        const iterStart = Date.now();

        try {
          await fn();
          durations.push(Date.now() - iterStart);
        } catch (error) {
          errors++;
        }

        memorySnapshots.push(this.getMemoryUsage());

        this.emit("progress", {
          iteration: i + 1,
          total: iterations,
        });
      }
    } else {
      // Concurrent execution
      const batches = Math.ceil(iterations / concurrency);

      for (let batch = 0; batch < batches; batch++) {
        const batchSize = Math.min(concurrency, iterations - batch * concurrency);
        const promises: Promise<void>[] = [];

        for (let i = 0; i < batchSize; i++) {
          const iterStart = Date.now();

          promises.push(
            fn()
              .then(() => {
                durations.push(Date.now() - iterStart);
              })
              .catch(() => {
                errors++;
              }),
          );
        }

        await Promise.all(promises);
        memorySnapshots.push(this.getMemoryUsage());

        this.emit("progress", {
          iteration: (batch + 1) * batchSize,
          total: iterations,
        });
      }
    }

    const duration = Date.now() - startTime;
    const finalMemory = this.getMemoryUsage();

    // Calculate statistics
    const result: PerformanceResult = {
      name: config.name,
      iterations: iterations - errors,
      timing: this.calculateTimingStats(durations),
      memory: {
        initial: initialMemory,
        peak: Math.max(...memorySnapshots),
        final: finalMemory,
        leaked: finalMemory - initialMemory,
      },
      throughput: (iterations - errors) / (duration / 1000),
      duration,
      successRate: ((iterations - errors) / iterations) * 100,
      errors,
    };

    this.emit("complete", result);

    return result;
  }

  /**
   * Run load test
   */
  public async loadTest<T>(
    fn: () => Promise<T> | T,
    config: LoadTestConfig,
  ): Promise<LoadTestResult> {
    const duration = config.duration ?? 60000; // 1 minute
    const rampUp = config.rampUp ?? 5000; // 5 seconds
    const targetRps = config.rps ?? 100;
    const maxConcurrency = config.maxConcurrency ?? 1000;

    this.emit("loadTestStart", { name: config.name, duration, targetRps });

    const startTime = Date.now();
    const endTime = startTime + duration;
    const responseTimes: number[] = [];

    let totalRequests = 0;
    let successfulRequests = 0;
    let failedRequests = 0;
    let currentConcurrency = 0;

    const executeRequest = async () => {
      if (currentConcurrency >= maxConcurrency) {
        return;
      }

      currentConcurrency++;
      totalRequests++;

      const requestStart = Date.now();

      try {
        await fn();
        successfulRequests++;
        responseTimes.push(Date.now() - requestStart);
      } catch {
        failedRequests++;
      } finally {
        currentConcurrency--;
      }
    };

    // Main loop
    while (Date.now() < endTime) {
      const elapsed = Date.now() - startTime;

      // Calculate current target RPS (with ramp-up)
      const currentTargetRps = elapsed < rampUp
        ? (targetRps * elapsed) / rampUp
        : targetRps;

      // Calculate interval between requests
      const interval = 1000 / currentTargetRps;

      // Execute request
      executeRequest(); // Don't await - fire and forget

      // Wait for next interval
      await this.delay(interval);

      // Emit progress
      if (totalRequests % 100 === 0) {
        this.emit("loadTestProgress", {
          totalRequests,
          successfulRequests,
          failedRequests,
          currentRps: (successfulRequests / (elapsed / 1000)).toFixed(2),
        });
      }
    }

    // Wait for pending requests
    while (currentConcurrency > 0) {
      await this.delay(100);
    }

    const actualDuration = Date.now() - startTime;

    const result: LoadTestResult = {
      name: config.name,
      totalRequests,
      successfulRequests,
      failedRequests,
      avgResponseTime: this.mean(responseTimes),
      actualRps: successfulRequests / (actualDuration / 1000),
      duration: actualDuration,
      latency: {
        p50: this.percentile(responseTimes, 50),
        p75: this.percentile(responseTimes, 75),
        p95: this.percentile(responseTimes, 95),
        p99: this.percentile(responseTimes, 99),
        max: Math.max(...responseTimes),
      },
    };

    this.emit("loadTestComplete", result);

    return result;
  }

  /**
   * Benchmark multiple functions
   */
  public async benchmark(
    tests: Record<string, () => Promise<any> | any>,
    iterations: number = 1000,
  ): Promise<Record<string, PerformanceResult>> {
    const results: Record<string, PerformanceResult> = {};

    for (const [name, fn] of Object.entries(tests)) {
      results[name] = await this.test(fn, { name, iterations });
    }

    // Print comparison
    this.printBenchmarkComparison(results);

    return results;
  }

  /**
   * Profile memory usage
   */
  public async profileMemory<T>(
    fn: () => Promise<T> | T,
    samplingInterval: number = 100,
  ): Promise<{ result: T; profile: number[] }> {
    const profile: number[] = [];

    const sampler = setInterval(() => {
      profile.push(this.getMemoryUsage());
    }, samplingInterval);

    try {
      const result = await fn();
      return { result, profile };
    } finally {
      clearInterval(sampler);
    }
  }

  /**
   * Calculate timing statistics
   */
  private calculateTimingStats(durations: number[]): PerformanceResult["timing"] {
    const sorted = [...durations].sort((a, b) => a - b);

    return {
      min: Math.min(...durations),
      max: Math.max(...durations),
      mean: this.mean(durations),
      median: this.median(sorted),
      p95: this.percentile(sorted, 95),
      p99: this.percentile(sorted, 99),
      stdDev: this.standardDeviation(durations),
    };
  }

  /**
   * Calculate mean
   */
  private mean(values: number[]): number {
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  /**
   * Calculate median
   */
  private median(sortedValues: number[]): number {
    const mid = Math.floor(sortedValues.length / 2);
    return sortedValues.length % 2 === 0
      ? (sortedValues[mid - 1] + sortedValues[mid]) / 2
      : sortedValues[mid];
  }

  /**
   * Calculate percentile
   */
  private percentile(sortedValues: number[], p: number): number {
    const index = Math.ceil((p / 100) * sortedValues.length) - 1;
    return sortedValues[Math.max(0, index)];
  }

  /**
   * Calculate standard deviation
   */
  private standardDeviation(values: number[]): number {
    const avg = this.mean(values);
    const squareDiffs = values.map((value) => Math.pow(value - avg, 2));
    const avgSquareDiff = this.mean(squareDiffs);
    return Math.sqrt(avgSquareDiff);
  }

  /**
   * Get memory usage (MB)
   */
  private getMemoryUsage(): number {
    const usage = process.memoryUsage();
    return usage.heapUsed / 1024 / 1024;
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Print benchmark comparison
   */
  private printBenchmarkComparison(results: Record<string, PerformanceResult>): void {
    console.log("\nBenchmark Comparison:");
    console.log("─".repeat(80));

    const sorted = Object.entries(results).sort((a, b) => a[1].timing.mean - b[1].timing.mean);

    const fastest = sorted[0][1].timing.mean;

    for (const [name, result] of sorted) {
      const relative = result.timing.mean / fastest;
      const ops = (1000 / result.timing.mean).toFixed(0);

      console.log(`${name}:`);
      console.log(`  ${result.timing.mean.toFixed(2)}ms (${ops} ops/sec)`);
      console.log(`  ${relative.toFixed(2)}x ${relative === 1 ? "(fastest)" : "slower"}`);
    }

    console.log("─".repeat(80));
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create performance tester
 */
export function createPerformanceTester(): PerformanceTester {
  return new PerformanceTester();
}

/**
 * Quick performance test
 */
export async function quickPerfTest<T>(
  name: string,
  fn: () => Promise<T> | T,
  iterations: number = 1000,
): Promise<PerformanceResult> {
  const tester = new PerformanceTester();
  return await tester.test(fn, { name, iterations });
}

/**
 * Quick load test
 */
export async function quickLoadTest<T>(
  name: string,
  fn: () => Promise<T> | T,
  rps: number = 100,
  duration: number = 60000,
): Promise<LoadTestResult> {
  const tester = new PerformanceTester();
  return await tester.loadTest(fn, { name, rps, duration });
}
