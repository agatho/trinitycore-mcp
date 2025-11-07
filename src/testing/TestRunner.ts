/**
 * TestRunner
 * Phase 5 - Week 5: Testing Automation Tools
 *
 * Executes tests with configurable strategies (parallel, sequential, filtered)
 * with error handling, retry logic, and result collection.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { glob } from 'glob';
import { logger } from '../utils/logger';

// ============================================================================
// Type Definitions
// ============================================================================

export interface TestCase {
  id: string;
  name: string;
  description?: string;
  tags?: string[];
  timeout?: number;           // ms (default: 30000)
  retries?: number;           // default: 0
  fn: () => Promise<void>;
}

export interface TestSuite {
  name: string;
  description?: string;
  tests: TestCase[];
  beforeAll?: () => Promise<void>;
  afterAll?: () => Promise<void>;
  beforeEach?: () => Promise<void>;
  afterEach?: () => Promise<void>;
}

export interface TestResult {
  testId: string;
  testName: string;
  status: 'pass' | 'fail' | 'skip';
  duration: number;           // ms
  error?: {
    message: string;
    stack: string;
  };
  assertions?: {
    passed: number;
    failed: number;
    total: number;
  };
  retries?: number;           // Number of retries attempted
}

export interface TestRunConfig {
  // Discovery
  pattern?: string;           // Glob pattern (default: "**/*.test.{js,ts}")
  rootDir?: string;           // Root directory (default: "./")

  // Filtering
  testNamePattern?: string;   // Regex to match test names
  tags?: string[];            // Run only tests with these tags

  // Execution
  parallel?: boolean;         // Run tests in parallel (default: false)
  maxWorkers?: number;        // Max parallel workers (default: 4)
  timeout?: number;           // Default timeout per test (default: 30000)
  retries?: number;           // Default retries (default: 0)

  // Reporting
  verbose?: boolean;          // Verbose output (default: false)
  silent?: boolean;           // Silent mode (default: false)
}

export interface TestRunResult {
  summary: {
    totalTests: number;
    passed: number;
    failed: number;
    skipped: number;
    duration: number;         // ms
    successRate: number;      // percentage
  };

  results: TestResult[];

  failures: {
    testName: string;
    error: string;
    stack: string;
  }[];
}

// ============================================================================
// TestRunner Class
// ============================================================================

export class TestRunner {
  private registeredSuites: TestSuite[] = [];

  constructor() {}

  /**
   * Register a test suite
   */
  registerSuite(suite: TestSuite): void {
    this.registeredSuites.push(suite);
  }

  /**
   * Register a single test case (creates a suite with one test)
   */
  registerTest(test: TestCase): void {
    this.registeredSuites.push({
      name: 'Default Suite',
      tests: [test]
    });
  }

  /**
   * Discover test files using glob pattern
   * Performance target: <500ms for 100 test files
   */
  async discoverTests(config: TestRunConfig): Promise<TestSuite[]> {
    const pattern = config.pattern || '**/*.test.{js,ts}';
    const rootDir = config.rootDir || './';

    const testFiles = await glob(pattern, {
      cwd: rootDir,
      absolute: true,
      ignore: ['**/node_modules/**', '**/dist/**']
    });

    const suites: TestSuite[] = [];

    for (const file of testFiles) {
      try {
        // Import test file (assumes it registers tests)
        const module = await import(file);

        // If module exports test suite
        if (module.suite) {
          suites.push(module.suite);
        }

        // If module exports tests array
        if (module.tests && Array.isArray(module.tests)) {
          suites.push({
            name: path.basename(file, path.extname(file)),
            tests: module.tests
          });
        }
      } catch (error: any) {
        if (!config.silent) {
          logger.warn(`Warning: Failed to load test file ${file}: ${error.message}`);
        }
      }
    }

    // Include registered suites
    suites.push(...this.registeredSuites);

    return suites;
  }

  /**
   * Run all tests with given configuration
   * Performance target: <10s for 50 tests (sequential), <5s (parallel)
   */
  async runTests(config: TestRunConfig = {}): Promise<TestRunResult> {
    const start = performance.now();

    // Discover tests
    const suites = await this.discoverTests(config);

    // Filter tests
    const filteredSuites = this.filterTests(suites, config);

    // Collect all tests
    const allTests: Array<{ suite: TestSuite; test: TestCase }> = [];
    for (const suite of filteredSuites) {
      for (const test of suite.tests) {
        allTests.push({ suite, test });
      }
    }

    if (!config.silent && config.verbose) {
      logger.info(`Running ${allTests.length} tests from ${filteredSuites.length} suites...`);
    }

    // Execute tests
    const results: TestResult[] = [];

    if (config.parallel) {
      // Parallel execution
      const parallelResults = await this.runParallel(
        allTests.map(t => t.test),
        config
      );
      results.push(...parallelResults);
    } else {
      // Sequential execution (run suite by suite)
      for (const suite of filteredSuites) {
        const suiteResults = await this.runTestSuite(suite, config);
        results.push(...suiteResults);
      }
    }

    const duration = performance.now() - start;

    // Calculate summary
    const summary = {
      totalTests: results.length,
      passed: results.filter(r => r.status === 'pass').length,
      failed: results.filter(r => r.status === 'fail').length,
      skipped: results.filter(r => r.status === 'skip').length,
      duration,
      successRate: 0
    };

    summary.successRate = summary.totalTests > 0
      ? (summary.passed / summary.totalTests) * 100
      : 0;

    // Collect failures
    const failures = results
      .filter(r => r.status === 'fail' && r.error)
      .map(r => ({
        testName: r.testName,
        error: r.error!.message,
        stack: r.error!.stack
      }));

    return {
      summary,
      results,
      failures
    };
  }

  /**
   * Run a single test suite
   */
  async runTestSuite(suite: TestSuite, config: TestRunConfig): Promise<TestResult[]> {
    const results: TestResult[] = [];

    // Run beforeAll hook
    if (suite.beforeAll) {
      try {
        await suite.beforeAll();
      } catch (error: any) {
        if (!config.silent) {
          logger.error(`beforeAll hook failed for suite "${suite.name}": ${error.message}`);
        }
        // Mark all tests as skipped if beforeAll fails
        return suite.tests.map(test => ({
          testId: test.id,
          testName: test.name,
          status: 'skip' as const,
          duration: 0,
          error: {
            message: `Suite setup failed: ${error.message}`,
            stack: error.stack || ''
          }
        }));
      }
    }

    // Run each test
    for (const test of suite.tests) {
      // Run beforeEach hook
      if (suite.beforeEach) {
        try {
          await suite.beforeEach();
        } catch (error: any) {
          if (!config.silent && config.verbose) {
            logger.error(`beforeEach hook failed for test "${test.name}": ${error.message}`);
          }
        }
      }

      // Run test
      const result = await this.runTestCase(test, config);
      results.push(result);

      if (!config.silent && config.verbose) {
        const status = result.status === 'pass' ? '✓' : (result.status === 'fail' ? '✗' : '○');
        logger.info(`  ${status} ${result.testName} (${result.duration.toFixed(0)}ms)`);
      }

      // Run afterEach hook
      if (suite.afterEach) {
        try {
          await suite.afterEach();
        } catch (error: any) {
          if (!config.silent && config.verbose) {
            logger.error(`afterEach hook failed for test "${test.name}": ${error.message}`);
          }
        }
      }
    }

    // Run afterAll hook
    if (suite.afterAll) {
      try {
        await suite.afterAll();
      } catch (error: any) {
        if (!config.silent) {
          logger.error(`afterAll hook failed for suite "${suite.name}": ${error.message}`);
        }
      }
    }

    return results;
  }

  /**
   * Run a single test case
   */
  async runTestCase(test: TestCase, config: TestRunConfig): Promise<TestResult> {
    const timeout = test.timeout || config.timeout || 30000;
    const retries = test.retries ?? config.retries ?? 0;

    return await this.executeWithRetry(test, retries, timeout);
  }

  /**
   * Execute test with retry logic
   */
  private async executeWithRetry(
    test: TestCase,
    retries: number,
    timeout: number
  ): Promise<TestResult> {
    let lastError: Error | null = null;
    let attempt = 0;

    while (attempt <= retries) {
      try {
        const result = await this.executeWithTimeout(test, timeout);

        // If successful, return result
        if (result.status === 'pass') {
          if (attempt > 0) {
            result.retries = attempt;
          }
          return result;
        }

        // If failed, store error and retry
        lastError = result.error ? new Error(result.error.message) : null;
        attempt++;
      } catch (error: any) {
        lastError = error;
        attempt++;
      }
    }

    // All retries exhausted, return failure
    return {
      testId: test.id,
      testName: test.name,
      status: 'fail',
      duration: 0,
      error: {
        message: lastError?.message || 'Test failed',
        stack: lastError?.stack || ''
      },
      retries: retries
    };
  }

  /**
   * Execute test with timeout
   */
  private async executeWithTimeout(test: TestCase, timeout: number): Promise<TestResult> {
    const start = performance.now();

    return new Promise<TestResult>((resolve) => {
      let completed = false;

      // Timeout handler
      const timeoutId = setTimeout(() => {
        if (!completed) {
          completed = true;
          resolve({
            testId: test.id,
            testName: test.name,
            status: 'fail',
            duration: performance.now() - start,
            error: {
              message: `Test timeout exceeded (${timeout}ms)`,
              stack: ''
            }
          });
        }
      }, timeout);

      // Execute test
      test.fn()
        .then(() => {
          if (!completed) {
            completed = true;
            clearTimeout(timeoutId);
            resolve({
              testId: test.id,
              testName: test.name,
              status: 'pass',
              duration: performance.now() - start
            });
          }
        })
        .catch((error: Error) => {
          if (!completed) {
            completed = true;
            clearTimeout(timeoutId);
            resolve({
              testId: test.id,
              testName: test.name,
              status: 'fail',
              duration: performance.now() - start,
              error: {
                message: error.message,
                stack: error.stack || ''
              }
            });
          }
        });
    });
  }

  /**
   * Filter tests based on configuration
   */
  private filterTests(suites: TestSuite[], config: TestRunConfig): TestSuite[] {
    let filtered = suites;

    // Filter by test name pattern
    if (config.testNamePattern) {
      const regex = new RegExp(config.testNamePattern);
      filtered = filtered.map(suite => ({
        ...suite,
        tests: suite.tests.filter(test => regex.test(test.name))
      })).filter(suite => suite.tests.length > 0);
    }

    // Filter by tags
    if (config.tags && config.tags.length > 0) {
      filtered = filtered.map(suite => ({
        ...suite,
        tests: suite.tests.filter(test =>
          test.tags && test.tags.some(tag => config.tags!.includes(tag))
        )
      })).filter(suite => suite.tests.length > 0);
    }

    return filtered;
  }

  /**
   * Run tests in parallel
   * Performance target: <5s for 50 tests with 4 workers
   */
  private async runParallel(tests: TestCase[], config: TestRunConfig): Promise<TestResult[]> {
    const maxWorkers = config.maxWorkers || 4;
    const results: TestResult[] = [];

    // Split tests into batches
    const batches: TestCase[][] = [];
    for (let i = 0; i < tests.length; i += maxWorkers) {
      batches.push(tests.slice(i, i + maxWorkers));
    }

    // Execute batches
    for (const batch of batches) {
      const batchResults = await Promise.all(
        batch.map(test => this.runTestCase(test, config))
      );
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Run tests sequentially
   * Performance target: <10s for 50 tests
   */
  private async runSequential(tests: TestCase[], config: TestRunConfig): Promise<TestResult[]> {
    const results: TestResult[] = [];

    for (const test of tests) {
      const result = await this.runTestCase(test, config);
      results.push(result);
    }

    return results;
  }

  /**
   * Clear registered suites
   */
  clear(): void {
    this.registeredSuites = [];
  }

  /**
   * Get registered suites count
   */
  getSuitesCount(): number {
    return this.registeredSuites.length;
  }

  /**
   * Get registered tests count
   */
  getTestsCount(): number {
    return this.registeredSuites.reduce((sum, suite) => sum + suite.tests.length, 0);
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Create a test case
 */
export function test(name: string, fn: () => Promise<void>, options?: {
  description?: string;
  tags?: string[];
  timeout?: number;
  retries?: number;
}): TestCase {
  return {
    id: `test-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    name,
    fn,
    ...options
  };
}

/**
 * Create a test suite
 */
export function suite(name: string, tests: TestCase[], options?: {
  description?: string;
  beforeAll?: () => Promise<void>;
  afterAll?: () => Promise<void>;
  beforeEach?: () => Promise<void>;
  afterEach?: () => Promise<void>;
}): TestSuite {
  return {
    name,
    tests,
    ...options
  };
}

/**
 * Skip a test
 */
export function skip(name: string): TestCase {
  return {
    id: `test-skip-${Date.now()}`,
    name,
    fn: async () => {}, // No-op
    tags: ['skip']
  };
}
