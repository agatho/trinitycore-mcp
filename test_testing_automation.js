#!/usr/bin/env node
/**
 * Test Script for Phase 5 Week 5: Testing Automation Tools
 * Tests TestRunner, TestReporter, and CoverageAnalyzer
 */

import { TestRunner, test, suite } from './dist/testing/TestRunner.js';
import { TestReporter } from './dist/testing/TestReporter.js';
import { CoverageAnalyzer } from './dist/testing/CoverageAnalyzer.js';
import * as fs from 'fs/promises';

// ANSI color codes
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';

async function test1_TestRunnerDiscovery() {
  console.log(`${YELLOW}Test 1: TestRunner - Test Discovery...${RESET}`);

  try {
    const runner = new TestRunner();

    // Register some test suites
    runner.registerSuite({
      name: 'Sample Suite 1',
      tests: [
        test('should pass test 1', async () => {}),
        test('should pass test 2', async () => {})
      ]
    });

    runner.registerSuite({
      name: 'Sample Suite 2',
      tests: [
        test('should pass test 3', async () => {}),
        test('should pass test 4', async () => {}),
        test('should pass test 5', async () => {})
      ]
    });

    console.log(`Registered suites: ${runner.getSuitesCount()}`);
    console.log(`Registered tests: ${runner.getTestsCount()}`);

    if (runner.getSuitesCount() === 2 && runner.getTestsCount() === 5) {
      console.log(`${GREEN}✓ Test 1 passed${RESET}\n`);
      return true;
    } else {
      console.log(`${RED}✗ Test 1 failed: Unexpected counts${RESET}\n`);
      return false;
    }
  } catch (error) {
    console.error(`${RED}✗ Test 1 failed: ${error}${RESET}\n`);
    return false;
  }
}

async function test2_TestRunnerSequential() {
  console.log(`${YELLOW}Test 2: TestRunner - Sequential Execution...${RESET}`);

  try {
    const runner = new TestRunner();

    const tests = [];
    for (let i = 1; i <= 10; i++) {
      tests.push(
        test(`should pass test ${i}`, async () => {
          await new Promise(resolve => setTimeout(resolve, 10));
        })
      );
    }

    runner.registerSuite({
      name: 'Sequential Suite',
      tests
    });

    const start = performance.now();
    const result = await runner.runTests({ silent: true });
    const duration = performance.now() - start;

    console.log(`Total tests: ${result.summary.totalTests}`);
    console.log(`Passed: ${result.summary.passed}`);
    console.log(`Duration: ${duration.toFixed(0)}ms`);

    // Check performance target (<10s for 10 tests)
    if (duration < 10000) {
      console.log(`${GREEN}✓ Performance target met (${duration.toFixed(0)}ms < 10000ms)${RESET}`);
    } else {
      console.log(`${YELLOW}⚠ Performance target exceeded${RESET}`);
    }

    if (result.summary.totalTests === 10 && result.summary.passed === 10) {
      console.log(`${GREEN}✓ Test 2 passed${RESET}\n`);
      return true;
    } else {
      console.log(`${RED}✗ Test 2 failed: Unexpected results${RESET}\n`);
      return false;
    }
  } catch (error) {
    console.error(`${RED}✗ Test 2 failed: ${error}${RESET}\n`);
    return false;
  }
}

async function test3_TestRunnerParallel() {
  console.log(`${YELLOW}Test 3: TestRunner - Parallel Execution...${RESET}`);

  try {
    const runner = new TestRunner();

    const tests = [];
    for (let i = 1; i <= 10; i++) {
      tests.push(
        test(`should pass test ${i}`, async () => {
          await new Promise(resolve => setTimeout(resolve, 50));
        })
      );
    }

    runner.registerSuite({
      name: 'Parallel Suite',
      tests
    });

    const start = performance.now();
    const result = await runner.runTests({ silent: true, parallel: true, maxWorkers: 4 });
    const duration = performance.now() - start;

    console.log(`Total tests: ${result.summary.totalTests}`);
    console.log(`Passed: ${result.summary.passed}`);
    console.log(`Duration: ${duration.toFixed(0)}ms`);

    // Parallel should be faster than sequential (10 tests * 50ms = 500ms sequential, ~150ms parallel with 4 workers)
    if (duration < 300) {
      console.log(`${GREEN}✓ Performance target met (${duration.toFixed(0)}ms < 300ms)${RESET}`);
    } else {
      console.log(`${YELLOW}⚠ Performance target exceeded${RESET}`);
    }

    if (result.summary.totalTests === 10 && result.summary.passed === 10) {
      console.log(`${GREEN}✓ Test 3 passed${RESET}\n`);
      return true;
    } else {
      console.log(`${RED}✗ Test 3 failed: Unexpected results${RESET}\n`);
      return false;
    }
  } catch (error) {
    console.error(`${RED}✗ Test 3 failed: ${error}${RESET}\n`);
    return false;
  }
}

async function test4_TestReporterFormats() {
  console.log(`${YELLOW}Test 4: TestReporter - Multiple Formats...${RESET}`);

  try {
    const runner = new TestRunner();
    const reporter = new TestReporter();

    runner.registerSuite({
      name: 'Report Suite',
      tests: [
        test('should pass 1', async () => {}),
        test('should pass 2', async () => {}),
        test('should fail 1', async () => { throw new Error('Test error'); })
      ]
    });

    const result = await runner.runTests({ silent: true });

    // Generate JSON report
    const jsonPath = './test-report.json';
    await reporter.generateReport(result, { format: 'json', outputPath: jsonPath });

    // Generate HTML report
    const htmlPath = './test-report.html';
    await reporter.generateReport(result, { format: 'html', outputPath: htmlPath });

    // Generate Markdown report
    const mdPath = './test-report.md';
    await reporter.generateReport(result, { format: 'markdown', outputPath: mdPath });

    // Generate JUnit XML report
    const junitPath = './test-report.xml';
    await reporter.generateReport(result, { format: 'junit', outputPath: junitPath });

    // Verify files exist
    const jsonExists = await fs.access(jsonPath).then(() => true).catch(() => false);
    const htmlExists = await fs.access(htmlPath).then(() => true).catch(() => false);
    const mdExists = await fs.access(mdPath).then(() => true).catch(() => false);
    const junitExists = await fs.access(junitPath).then(() => true).catch(() => false);

    console.log(`JSON report: ${jsonExists ? 'Created ✓' : 'Missing ✗'}`);
    console.log(`HTML report: ${htmlExists ? 'Created ✓' : 'Missing ✗'}`);
    console.log(`Markdown report: ${mdExists ? 'Created ✓' : 'Missing ✗'}`);
    console.log(`JUnit XML report: ${junitExists ? 'Created ✓' : 'Missing ✗'}`);

    if (jsonExists && htmlExists && mdExists && junitExists) {
      console.log(`${GREEN}✓ Test 4 passed${RESET}\n`);

      // Clean up
      await fs.unlink(jsonPath).catch(() => {});
      await fs.unlink(htmlPath).catch(() => {});
      await fs.unlink(mdPath).catch(() => {});
      await fs.unlink(junitPath).catch(() => {});

      return true;
    } else {
      console.log(`${RED}✗ Test 4 failed: Not all reports generated${RESET}\n`);
      return false;
    }
  } catch (error) {
    console.error(`${RED}✗ Test 4 failed: ${error}${RESET}\n`);
    return false;
  }
}

async function test5_TestReporterSummary() {
  console.log(`${YELLOW}Test 5: TestReporter - Summary Statistics...${RESET}`);

  try {
    const runner = new TestRunner();
    const reporter = new TestReporter();

    const tests = [];
    for (let i = 1; i <= 20; i++) {
      if (i <= 17) {
        tests.push(test(`should pass ${i}`, async () => {}));
      } else {
        tests.push(test(`should fail ${i}`, async () => { throw new Error('Test error'); }));
      }
    }

    runner.registerSuite({
      name: 'Summary Suite',
      tests
    });

    const result = await runner.runTests({ silent: true });
    const summary = reporter.generateSummary(result);

    console.log(`Total tests: ${summary.totalTests}`);
    console.log(`Passed: ${summary.passed}`);
    console.log(`Failed: ${summary.failed}`);
    console.log(`Success rate: ${summary.successRate.toFixed(1)}%`);
    console.log(`Average duration: ${summary.averageDuration.toFixed(2)}ms`);

    if (summary.slowestTest) {
      console.log(`Slowest test: ${summary.slowestTest.name} (${summary.slowestTest.duration.toFixed(0)}ms)`);
    }

    if (summary.totalTests === 20 && summary.passed === 17 && summary.failed === 3) {
      console.log(`${GREEN}✓ Test 5 passed${RESET}\n`);
      return true;
    } else {
      console.log(`${RED}✗ Test 5 failed: Unexpected summary${RESET}\n`);
      return false;
    }
  } catch (error) {
    console.error(`${RED}✗ Test 5 failed: ${error}${RESET}\n`);
    return false;
  }
}

async function test6_CoverageAnalyzer() {
  console.log(`${YELLOW}Test 6: CoverageAnalyzer - Coverage Collection...${RESET}`);

  try {
    const coverage = new CoverageAnalyzer();

    // Record some lines as executed
    coverage.recordLine('./src/testing/TestRunner.ts', 10);
    coverage.recordLine('./src/testing/TestRunner.ts', 20);
    coverage.recordLine('./src/testing/TestRunner.ts', 30);

    // Collect coverage (will analyze actual files)
    const report = await coverage.collectCoverage({
      include: ['src/testing/*.ts'],
      exclude: ['**/*.test.ts']
    });

    console.log(`Files analyzed: ${report.files.length}`);
    console.log(`Lines coverage: ${report.summary.lines.percentage.toFixed(1)}%`);
    console.log(`Total lines: ${report.summary.lines.total}`);
    console.log(`Covered lines: ${report.summary.lines.covered}`);

    if (report.files.length >= 3) {
      console.log(`${GREEN}✓ Test 6 passed${RESET}\n`);
      return true;
    } else {
      console.log(`${RED}✗ Test 6 failed: Unexpected file count${RESET}\n`);
      return false;
    }
  } catch (error) {
    console.error(`${RED}✗ Test 6 failed: ${error}${RESET}\n`);
    return false;
  }
}

async function runAllTests() {
  console.log(`${CYAN}=== TrinityCore MCP Server - Testing Automation Test Suite ===${RESET}\n`);

  const tests = [
    { name: 'TestRunner - Test Discovery', fn: test1_TestRunnerDiscovery },
    { name: 'TestRunner - Sequential Execution', fn: test2_TestRunnerSequential },
    { name: 'TestRunner - Parallel Execution', fn: test3_TestRunnerParallel },
    { name: 'TestReporter - Multiple Formats', fn: test4_TestReporterFormats },
    { name: 'TestReporter - Summary Statistics', fn: test5_TestReporterSummary },
    { name: 'CoverageAnalyzer - Coverage Collection', fn: test6_CoverageAnalyzer }
  ];

  const results = [];

  for (let i = 0; i < tests.length; i++) {
    const test = tests[i];
    const passed = await test.fn();
    results.push({ name: test.name, passed });
  }

  console.log(`${CYAN}=== Test Summary ===${RESET}\n`);

  const passed = results.filter(r => r.passed).length;
  const total = results.length;

  results.forEach(r => {
    const icon = r.passed ? GREEN + '✓' : RED + '✗';
    console.log(`${icon} ${r.name}${RESET}`);
  });

  console.log(`\n${passed}/${total} tests passed (${((passed / total) * 100).toFixed(1)}%)`);

  if (passed === total) {
    console.log(`${GREEN}\n=== All tests passed! ===${RESET}`);
  } else {
    console.log(`${RED}\n=== Some tests failed ===${RESET}`);
  }
}

// Run tests
runAllTests().catch(error => {
  console.error(`${RED}Fatal error: ${error}${RESET}`);
  console.error(error.stack);
  process.exit(1);
});
