/**
 * Testing Automation Tools for MCP Server
 * Phase 5 - Week 5: Testing Automation
 */

import { TestRunner, TestRunConfig, TestRunResult } from '../testing/TestRunner.js';
import { TestReporter, ReportConfig, ReportSummary } from '../testing/TestReporter.js';
import { CoverageAnalyzer, CoverageOptions, CoverageReport } from '../testing/CoverageAnalyzer.js';
import * as fs from 'fs/promises';

// Global instances
const runner = new TestRunner();
const reporter = new TestReporter();
const coverage = new CoverageAnalyzer();

// ============================================================================
// Tool 1: run-tests
// ============================================================================

/**
 * Execute tests with configurable strategies
 * Performance target: <10s for 50 tests (sequential), <5s for 50 tests (parallel)
 */
export async function runTests(options: {
  // Discovery
  pattern?: string;           // Glob pattern (default: "**/*.test.{js,ts}")
  rootDir?: string;           // Root directory

  // Filtering
  testNamePattern?: string;   // Regex to match test names
  tags?: string[];            // Run only tests with these tags

  // Execution
  parallel?: boolean;         // Run in parallel (default: false)
  maxWorkers?: number;        // Max parallel workers (default: 4)
  timeout?: number;           // Timeout per test (default: 30000)
  retries?: number;           // Retries (default: 0)

  // Reporting
  verbose?: boolean;          // Verbose output
  silent?: boolean;           // Silent mode

  // Output
  outputFormat?: 'json' | 'summary';
  generateReport?: {
    format: 'json' | 'html' | 'markdown' | 'junit';
    outputPath: string;
  };
}): Promise<{
  summary: {
    totalTests: number;
    passed: number;
    failed: number;
    skipped: number;
    duration: number;
    successRate: number;
  };
  results: any[];
  failures: Array<{ testName: string; error: string; stack: string }>;
  reportPath?: string;
}> {
  const config: TestRunConfig = {
    pattern: options.pattern,
    rootDir: options.rootDir,
    testNamePattern: options.testNamePattern,
    tags: options.tags,
    parallel: options.parallel,
    maxWorkers: options.maxWorkers,
    timeout: options.timeout,
    retries: options.retries,
    verbose: options.verbose,
    silent: options.silent
  };

  // Run tests
  const testResult = await runner.runTests(config);

  // Generate report if requested
  let reportPath: string | undefined;
  if (options.generateReport) {
    const reportConfig: ReportConfig = {
      format: options.generateReport.format,
      outputPath: options.generateReport.outputPath,
      title: 'Test Report',
      timestamp: new Date()
    };

    reportPath = await reporter.generateReport(testResult, reportConfig);
  }

  // Return results
  const response: any = {
    summary: testResult.summary,
    failures: testResult.failures
  };

  if (options.outputFormat === 'json') {
    response.results = testResult.results;
  }

  if (reportPath) {
    response.reportPath = reportPath;
  }

  return response;
}

// ============================================================================
// Tool 2: generate-test-report
// ============================================================================

/**
 * Generate test reports from test results
 * Performance target: <500ms for HTML report with 100 tests
 */
export async function generateTestReport(options: {
  // Input source (choose one)
  testResults?: TestRunResult;
  testResultsFile?: string;   // Path to JSON test results

  // Format
  format: 'json' | 'html' | 'markdown' | 'junit';
  outputPath: string;

  // Options
  includePassedTests?: boolean;
  includeSkippedTests?: boolean;
  includeCharts?: boolean;    // HTML only

  // Metadata
  title?: string;
  metadata?: { [key: string]: any };
}): Promise<{
  reportPath: string;
  format: string;
  summary: ReportSummary;
  generationTime: number;
}> {
  const start = performance.now();

  // Load test results
  let testResults: TestRunResult;

  if (options.testResults) {
    testResults = options.testResults;
  } else if (options.testResultsFile) {
    const fileContent = await fs.readFile(options.testResultsFile, 'utf-8');
    testResults = JSON.parse(fileContent) as TestRunResult;
  } else {
    throw new Error('Either testResults or testResultsFile must be provided');
  }

  // Generate report
  const reportConfig: ReportConfig = {
    format: options.format,
    outputPath: options.outputPath,
    includePassedTests: options.includePassedTests,
    includeSkippedTests: options.includeSkippedTests,
    includeCharts: options.includeCharts,
    title: options.title || 'Test Report',
    timestamp: new Date(),
    metadata: options.metadata
  };

  const reportPath = await reporter.generateReport(testResults, reportConfig);
  const summary = reporter.generateSummary(testResults);
  const generationTime = performance.now() - start;

  return {
    reportPath,
    format: options.format,
    summary,
    generationTime
  };
}

// ============================================================================
// Tool 3: analyze-coverage
// ============================================================================

/**
 * Analyze code coverage from test runs
 * Performance target: <2000ms for 50 source files
 */
export async function analyzeCoverage(options: {
  // Coverage source (choose one)
  coverageData?: CoverageReport;
  coverageFile?: string;      // Path to coverage.json

  // Options
  include?: string[];         // Files to include (glob)
  exclude?: string[];         // Files to exclude (glob)

  // Thresholds
  thresholds?: {
    lines?: number;
    branches?: number;
    functions?: number;
    statements?: number;
  };

  // Output
  format?: 'json' | 'html' | 'text' | 'lcov';
  outputPath?: string;

  // Analysis
  findUncovered?: boolean;    // Find uncovered code (default: true)
  showDetails?: boolean;      // Show per-file details (default: true)
}): Promise<{
  summary: {
    lines: { total: number; covered: number; percentage: number };
    branches: { total: number; covered: number; percentage: number };
    functions: { total: number; covered: number; percentage: number };
    statements: { total: number; covered: number; percentage: number };
  };

  files: any[];

  thresholds?: {
    met: boolean;
    lines: { threshold: number; actual: number; met: boolean };
    branches: { threshold: number; actual: number; met: boolean };
    functions: { threshold: number; actual: number; met: boolean };
    statements: { threshold: number; actual: number; met: boolean };
  };

  uncovered?: {
    files: string[];
    lines: Array<{ file: string; lines: number[] }>;
  };

  reportPath?: string;
  analysisTime: number;
}> {
  const start = performance.now();

  // Load coverage data
  let coverageReport: CoverageReport;

  if (options.coverageData) {
    coverageReport = options.coverageData;
  } else if (options.coverageFile) {
    const fileContent = await fs.readFile(options.coverageFile, 'utf-8');
    coverageReport = JSON.parse(fileContent) as CoverageReport;
  } else {
    // Collect coverage
    const coverageOptions: CoverageOptions = {
      include: options.include,
      exclude: options.exclude,
      thresholds: options.thresholds
    };

    coverageReport = await coverage.collectCoverage(coverageOptions);
  }

  // Generate coverage report if requested
  let reportPath: string | undefined;
  if (options.format && options.outputPath) {
    reportPath = await coverage.generateCoverageReport(
      coverageReport,
      options.format,
      options.outputPath
    );
  }

  // Prepare response
  const response: any = {
    summary: coverageReport.summary,
    thresholds: coverageReport.thresholds,
    analysisTime: performance.now() - start
  };

  if (options.showDetails !== false) {
    response.files = coverageReport.files.map(f => ({
      file: f.filePath,
      lines: f.lines.percentage,
      branches: f.branches.percentage,
      functions: f.functions.percentage,
      statements: f.statements.percentage
    }));
  }

  if (options.findUncovered !== false) {
    const filesWithUncovered = coverageReport.files.filter(f => f.lines.uncovered.length > 0);

    response.uncovered = {
      files: filesWithUncovered.map(f => f.filePath),
      lines: filesWithUncovered.map(f => ({
        file: f.filePath,
        lines: f.lines.uncovered
      }))
    };
  }

  if (reportPath) {
    response.reportPath = reportPath;
  }

  return response;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Quick test run with default settings
 */
export async function quickTest(options?: {
  pattern?: string;
  parallel?: boolean;
}): Promise<{
  summary: any;
  failures: any[];
}> {
  const result = await runTests({
    pattern: options?.pattern,
    parallel: options?.parallel,
    outputFormat: 'summary'
  });

  return {
    summary: result.summary,
    failures: result.failures
  };
}

/**
 * Run tests and generate HTML report
 */
export async function testAndReport(options: {
  pattern?: string;
  parallel?: boolean;
  outputPath: string;
}): Promise<{
  summary: any;
  reportPath: string;
}> {
  const result = await runTests({
    pattern: options.pattern,
    parallel: options.parallel,
    outputFormat: 'summary',
    generateReport: {
      format: 'html',
      outputPath: options.outputPath
    }
  });

  return {
    summary: result.summary,
    reportPath: result.reportPath!
  };
}

/**
 * Get test runner instance
 */
export function getTestRunner(): TestRunner {
  return runner;
}

/**
 * Get test reporter instance
 */
export function getTestReporter(): TestReporter {
  return reporter;
}

/**
 * Get coverage analyzer instance
 */
export function getCoverageAnalyzer(): CoverageAnalyzer {
  return coverage;
}
