/**
 * Test Framework
 *
 * Comprehensive testing framework for TrinityCore MCP with support for
 * unit tests, integration tests, E2E tests, and performance testing.
 *
 * @module test-framework
 */

import { EventEmitter } from "events";

// ============================================================================
// Types
// ============================================================================

/**
 * Test suite configuration
 */
export interface TestSuiteConfig {
  /** Suite name */
  name: string;

  /** Test files pattern */
  pattern?: string;

  /** Test type */
  type?: TestType;

  /** Timeout (ms) */
  timeout?: number;

  /** Setup function */
  setup?: () => Promise<void>;

  /** Teardown function */
  teardown?: () => Promise<void>;

  /** Parallel execution */
  parallel?: boolean;

  /** Coverage threshold */
  coverageThreshold?: number;
}

/**
 * Test type
 */
export enum TestType {
  UNIT = "unit",
  INTEGRATION = "integration",
  E2E = "e2e",
  PERFORMANCE = "performance",
}

/**
 * Test result
 */
export interface TestResult {
  /** Test name */
  name: string;

  /** Status */
  status: "passed" | "failed" | "skipped";

  /** Duration (ms) */
  duration: number;

  /** Error if failed */
  error?: string;

  /** Stack trace */
  stackTrace?: string;

  /** Assertions */
  assertions: {
    total: number;
    passed: number;
    failed: number;
  };
}

/**
 * Suite result
 */
export interface SuiteResult {
  /** Suite name */
  name: string;

  /** Test results */
  tests: TestResult[];

  /** Total duration */
  duration: number;

  /** Coverage */
  coverage?: CoverageResult;

  /** Summary */
  summary: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
  };
}

/**
 * Coverage result
 */
export interface CoverageResult {
  /** Line coverage percentage */
  lines: number;

  /** Branch coverage percentage */
  branches: number;

  /** Function coverage percentage */
  functions: number;

  /** Statement coverage percentage */
  statements: number;

  /** Files covered */
  files: FileCoverage[];
}

/**
 * File coverage
 */
export interface FileCoverage {
  /** File path */
  path: string;

  /** Line coverage */
  lines: number;

  /** Uncovered lines */
  uncoveredLines: number[];
}

// ============================================================================
// Test Framework
// ============================================================================

export class TestFramework extends EventEmitter {
  private suites: Map<string, TestSuite> = new Map();
  private results: Map<string, SuiteResult> = new Map();

  /**
   * Register test suite
   */
  public suite(name: string, config: Partial<TestSuiteConfig> = {}): TestSuite {
    const suite = new TestSuite({
      name,
      pattern: config.pattern ?? "**/*.test.ts",
      type: config.type ?? TestType.UNIT,
      timeout: config.timeout ?? 5000,
      parallel: config.parallel ?? false,
      coverageThreshold: config.coverageThreshold ?? 80,
      setup: config.setup ?? (async () => {}),
      teardown: config.teardown ?? (async () => {}),
    });

    this.suites.set(name, suite);
    return suite;
  }

  /**
   * Run all test suites
   */
  public async runAll(): Promise<Map<string, SuiteResult>> {
    this.emit("start", { suiteCount: this.suites.size });

    for (const [name, suite] of this.suites.entries()) {
      const result = await suite.run();
      this.results.set(name, result);

      this.emit("suiteComplete", { name, result });
    }

    this.emit("complete", { results: this.results });

    return this.results;
  }

  /**
   * Run specific suite
   */
  public async run(suiteName: string): Promise<SuiteResult> {
    const suite = this.suites.get(suiteName);
    if (!suite) {
      throw new Error(`Suite not found: ${suiteName}`);
    }

    const result = await suite.run();
    this.results.set(suiteName, result);

    return result;
  }

  /**
   * Get results
   */
  public getResults(): Map<string, SuiteResult> {
    return this.results;
  }

  /**
   * Get overall summary
   */
  public getSummary(): {
    suites: number;
    tests: number;
    passed: number;
    failed: number;
    skipped: number;
    coverage: number;
  } {
    let tests = 0;
    let passed = 0;
    let failed = 0;
    let skipped = 0;
    let totalCoverage = 0;
    let suiteCount = 0;

    for (const result of this.results.values()) {
      tests += result.summary.total;
      passed += result.summary.passed;
      failed += result.summary.failed;
      skipped += result.summary.skipped;

      if (result.coverage) {
        totalCoverage += result.coverage.lines;
        suiteCount++;
      }
    }

    return {
      suites: this.results.size,
      tests,
      passed,
      failed,
      skipped,
      coverage: suiteCount > 0 ? totalCoverage / suiteCount : 0,
    };
  }
}

// ============================================================================
// Test Suite
// ============================================================================

export class TestSuite extends EventEmitter {
  private config: Required<TestSuiteConfig>;
  private tests: TestCase[] = [];

  constructor(config: Required<TestSuiteConfig>) {
    super();
    this.config = config;
  }

  /**
   * Add test case
   */
  public test(name: string, fn: () => Promise<void> | void): void {
    this.tests.push(new TestCase(name, fn, this.config.timeout));
  }

  /**
   * Add test with custom timeout
   */
  public testWithTimeout(name: string, timeout: number, fn: () => Promise<void> | void): void {
    this.tests.push(new TestCase(name, fn, timeout));
  }

  /**
   * Skip test
   */
  public skip(name: string, fn: () => Promise<void> | void): void {
    const testCase = new TestCase(name, fn, this.config.timeout);
    testCase.skip();
    this.tests.push(testCase);
  }

  /**
   * Run suite
   */
  public async run(): Promise<SuiteResult> {
    const startTime = Date.now();

    // Setup
    if (this.config.setup) {
      await this.config.setup();
    }

    const results: TestResult[] = [];

    // Run tests
    if (this.config.parallel) {
      const promises = this.tests.map((test) => test.run());
      results.push(...(await Promise.all(promises)));
    } else {
      for (const test of this.tests) {
        const result = await test.run();
        results.push(result);
        this.emit("testComplete", result);
      }
    }

    // Teardown
    if (this.config.teardown) {
      await this.config.teardown();
    }

    // Calculate summary
    const summary = {
      total: results.length,
      passed: results.filter((r) => r.status === "passed").length,
      failed: results.filter((r) => r.status === "failed").length,
      skipped: results.filter((r) => r.status === "skipped").length,
    };

    return {
      name: this.config.name,
      tests: results,
      duration: Date.now() - startTime,
      summary,
    };
  }
}

// ============================================================================
// Test Case
// ============================================================================

export class TestCase {
  private name: string;
  private fn: () => Promise<void> | void;
  private timeout: number;
  private skipped = false;
  private assertions = {
    total: 0,
    passed: 0,
    failed: 0,
  };

  constructor(name: string, fn: () => Promise<void> | void, timeout: number) {
    this.name = name;
    this.fn = fn;
    this.timeout = timeout;
  }

  /**
   * Mark test as skipped
   */
  public skip(): void {
    this.skipped = true;
  }

  /**
   * Run test case
   */
  public async run(): Promise<TestResult> {
    if (this.skipped) {
      return {
        name: this.name,
        status: "skipped",
        duration: 0,
        assertions: this.assertions,
      };
    }

    const startTime = Date.now();

    try {
      // Run with timeout
      await Promise.race([
        this.fn(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Test timeout")), this.timeout),
        ),
      ]);

      return {
        name: this.name,
        status: "passed",
        duration: Date.now() - startTime,
        assertions: this.assertions,
      };
    } catch (error) {
      return {
        name: this.name,
        status: "failed",
        duration: Date.now() - startTime,
        error: (error as Error).message,
        stackTrace: (error as Error).stack,
        assertions: this.assertions,
      };
    }
  }

  /**
   * Increment assertion count
   */
  public assert(condition: boolean, message?: string): void {
    this.assertions.total++;

    if (condition) {
      this.assertions.passed++;
    } else {
      this.assertions.failed++;
      throw new Error(message || "Assertion failed");
    }
  }
}

// ============================================================================
// Assertion Helpers
// ============================================================================

export class Expect {
  private value: any;

  constructor(value: any) {
    this.value = value;
  }

  public toBe(expected: any): void {
    if (this.value !== expected) {
      throw new Error(`Expected ${expected} but got ${this.value}`);
    }
  }

  public toEqual(expected: any): void {
    if (JSON.stringify(this.value) !== JSON.stringify(expected)) {
      throw new Error(
        `Expected ${JSON.stringify(expected)} but got ${JSON.stringify(this.value)}`,
      );
    }
  }

  public toBeTruthy(): void {
    if (!this.value) {
      throw new Error(`Expected truthy value but got ${this.value}`);
    }
  }

  public toBeFalsy(): void {
    if (this.value) {
      throw new Error(`Expected falsy value but got ${this.value}`);
    }
  }

  public toBeNull(): void {
    if (this.value !== null) {
      throw new Error(`Expected null but got ${this.value}`);
    }
  }

  public toBeUndefined(): void {
    if (this.value !== undefined) {
      throw new Error(`Expected undefined but got ${this.value}`);
    }
  }

  public toContain(item: any): void {
    if (!Array.isArray(this.value) || !this.value.includes(item)) {
      throw new Error(`Expected array to contain ${item}`);
    }
  }

  public toHaveLength(length: number): void {
    if (!Array.isArray(this.value) || this.value.length !== length) {
      throw new Error(`Expected length ${length} but got ${this.value?.length}`);
    }
  }

  public toThrow(expectedError?: string): void {
    if (typeof this.value !== "function") {
      throw new Error("Expected a function");
    }

    try {
      this.value();
      throw new Error("Expected function to throw");
    } catch (error) {
      if (expectedError && (error as Error).message !== expectedError) {
        throw new Error(
          `Expected error "${expectedError}" but got "${(error as Error).message}"`,
        );
      }
    }
  }

  public async toResolve(): Promise<void> {
    try {
      await this.value;
    } catch {
      throw new Error("Expected promise to resolve");
    }
  }

  public async toReject(): Promise<void> {
    try {
      await this.value;
      throw new Error("Expected promise to reject");
    } catch {
      // Expected
    }
  }
}

/**
 * Create expectation
 */
export function expect(value: any): Expect {
  return new Expect(value);
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create test framework instance
 */
export function createTestFramework(): TestFramework {
  return new TestFramework();
}

/**
 * Describe test suite (convenience wrapper)
 */
export function describe(name: string, fn: (suite: TestSuite) => void): TestSuite {
  const framework = new TestFramework();
  const suite = framework.suite(name);
  fn(suite);
  return suite;
}

/**
 * Create test (standalone)
 */
export function it(name: string, fn: () => Promise<void> | void): TestCase {
  return new TestCase(name, fn, 5000);
}
