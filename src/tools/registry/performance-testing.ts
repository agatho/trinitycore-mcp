/**
 * Performance & Testing Tools Registry
 *
 * Bot performance analysis, scaling simulation, test execution, coverage, AI test generation.
 *
 * @module tools/registry/performance-testing
 */

import { ToolRegistryEntry, jsonResponse } from "./types";
import { analyzeBotPerformance, simulateScaling, getOptimizationSuggestions } from "../performance";
import { runTests, generateTestReport, analyzeCoverage } from "../testing";
import { generateTests, generateTestsForDirectory } from "../../testing/ai-test-generator";

export const performanceTestingTools: ToolRegistryEntry[] = [
  {
    definition: {
      name: "analyze-bot-performance",
      description: "Analyze bot performance metrics (CPU, memory, network). Performance target: <500ms realtime, <2000ms historical",
      inputSchema: {
        type: "object",
        properties: {
          mode: { type: "string", enum: ["realtime", "snapshot"], description: "Analysis mode: realtime (collect over duration) or snapshot (single capture)" },
          metrics: { type: "object", description: "Optional: metrics to collect (cpu, memory, network booleans)" },
          duration: { type: "number", description: "Optional: collection duration in ms (default: 10000 for realtime)" },
          interval: { type: "number", description: "Optional: sampling interval in ms (default: 100)" },
          exportCSV: { type: "string", description: "Optional: path to export CSV file" },
        },
        required: ["mode"],
      },
    },
    handler: async (args) => {
      const result = await analyzeBotPerformance({
        mode: args.mode as 'realtime' | 'snapshot',
        metrics: args.metrics as any,
        duration: args.duration as number | undefined,
        interval: args.interval as number | undefined,
        exportCSV: args.exportCSV as string | undefined,
      });
      return jsonResponse(result);
    },
  },
  {
    definition: {
      name: "simulate-scaling",
      description: "Simulate bot scaling from minBots to maxBots. Performance target: <3000ms for 50 steps (100-5000 bots)",
      inputSchema: {
        type: "object",
        properties: {
          minBots: { type: "number", description: "Starting bot count" },
          maxBots: { type: "number", description: "Maximum bot count" },
          stepSize: { type: "number", description: "Optional: increment per step (default: 100)" },
          profile: { type: "object", description: "Bot profile configuration" },
          baseline: { type: "object", description: "Baseline metrics (from analyze-bot-performance)" },
          scalingFactors: { type: "object", description: "Optional: non-linear scaling factors" },
          limits: { type: "object", description: "Optional: resource limits" },
        },
        required: ["minBots", "maxBots", "profile", "baseline"],
      },
    },
    handler: async (args) => {
      const result = await simulateScaling({
        minBots: args.minBots as number,
        maxBots: args.maxBots as number,
        stepSize: args.stepSize as number | undefined,
        profile: args.profile as any,
        baseline: args.baseline as any,
        scalingFactors: args.scalingFactors as any,
        limits: args.limits as any,
      });
      return jsonResponse(result);
    },
  },
  {
    definition: {
      name: "get-optimization-suggestions",
      description: "Get AI-powered optimization suggestions based on performance analysis. Performance target: <1000ms perf data, <5000ms code analysis",
      inputSchema: {
        type: "object",
        properties: {
          performanceReport: { type: "object", description: "Performance report from analyze-bot-performance" },
          performanceReportFile: { type: "string", description: "Or path to performance report JSON file" },
          filters: { type: "object", description: "Optional: suggestion filters (minImpact, maxDifficulty, categories)" },
          includeQuickWins: { type: "boolean", description: "Optional: include quick wins (default: true)" },
        },
      },
    },
    handler: async (args) => {
      const result = await getOptimizationSuggestions({
        performanceReport: args.performanceReport as any,
        performanceReportFile: args.performanceReportFile as string | undefined,
        filters: args.filters as any,
        includeQuickWins: args.includeQuickWins as boolean | undefined,
      });
      return jsonResponse(result);
    },
  },
  {
    definition: {
      name: "run-tests",
      description: "Execute tests with configurable strategies. Performance target: <10s for 50 tests (sequential), <5s (parallel)",
      inputSchema: {
        type: "object",
        properties: {
          pattern: { type: "string", description: "Glob pattern for test files (default: **/*.test.{js,ts})" },
          rootDir: { type: "string", description: "Root directory for test discovery" },
          testNamePattern: { type: "string", description: "Regex to match test names" },
          tags: { type: "array", items: { type: "string" }, description: "Run only tests with these tags" },
          parallel: { type: "boolean", description: "Run tests in parallel (default: false)" },
          maxWorkers: { type: "number", description: "Max parallel workers (default: 4)" },
          timeout: { type: "number", description: "Timeout per test in ms (default: 30000)" },
          retries: { type: "number", description: "Number of retries for failed tests (default: 0)" },
          verbose: { type: "boolean", description: "Verbose output" },
          silent: { type: "boolean", description: "Silent mode" },
          outputFormat: { type: "string", enum: ["json", "summary"], description: "Output format" },
          generateReport: { type: "object", description: "Optional: generate test report" },
        },
      },
    },
    handler: async (args) => {
      const result = await runTests({
        pattern: args.pattern as string | undefined,
        rootDir: args.rootDir as string | undefined,
        testNamePattern: args.testNamePattern as string | undefined,
        tags: args.tags as string[] | undefined,
        parallel: args.parallel as boolean | undefined,
        maxWorkers: args.maxWorkers as number | undefined,
        timeout: args.timeout as number | undefined,
        retries: args.retries as number | undefined,
        verbose: args.verbose as boolean | undefined,
        silent: args.silent as boolean | undefined,
        outputFormat: args.outputFormat as 'json' | 'summary' | undefined,
        generateReport: args.generateReport as any | undefined,
      });
      return jsonResponse(result);
    },
  },
  {
    definition: {
      name: "generate-test-report",
      description: "Generate test reports from test results. Performance target: <500ms for HTML report with 100 tests",
      inputSchema: {
        type: "object",
        properties: {
          testResults: { type: "object", description: "Test results object" },
          testResultsFile: { type: "string", description: "Or path to test results JSON file" },
          format: { type: "string", enum: ["json", "html", "markdown", "junit"], description: "Report format" },
          outputPath: { type: "string", description: "Report output path" },
          includePassedTests: { type: "boolean", description: "Include passed tests (default: true)" },
          includeSkippedTests: { type: "boolean", description: "Include skipped tests (default: true)" },
          includeCharts: { type: "boolean", description: "Include charts in HTML report (default: true)" },
          title: { type: "string", description: "Report title" },
          metadata: { type: "object", description: "Custom metadata" },
        },
        required: ["format", "outputPath"],
      },
    },
    handler: async (args) => {
      const result = await generateTestReport({
        testResults: args.testResults as any | undefined,
        testResultsFile: args.testResultsFile as string | undefined,
        format: args.format as 'json' | 'html' | 'markdown' | 'junit',
        outputPath: args.outputPath as string,
        includePassedTests: args.includePassedTests as boolean | undefined,
        includeSkippedTests: args.includeSkippedTests as boolean | undefined,
        includeCharts: args.includeCharts as boolean | undefined,
        title: args.title as string | undefined,
        metadata: args.metadata as any | undefined,
      });
      return jsonResponse(result);
    },
  },
  {
    definition: {
      name: "analyze-coverage",
      description: "Analyze code coverage from test runs. Performance target: <2000ms for 50 source files",
      inputSchema: {
        type: "object",
        properties: {
          coverageData: { type: "object", description: "Coverage data object" },
          coverageFile: { type: "string", description: "Or path to coverage JSON file" },
          include: { type: "array", items: { type: "string" }, description: "Files to include (glob patterns)" },
          exclude: { type: "array", items: { type: "string" }, description: "Files to exclude (glob patterns)" },
          thresholds: { type: "object", description: "Coverage thresholds" },
          format: { type: "string", enum: ["json", "html", "text", "lcov"], description: "Output format" },
          outputPath: { type: "string", description: "Output path for report" },
          findUncovered: { type: "boolean", description: "Find uncovered code (default: true)" },
          showDetails: { type: "boolean", description: "Show per-file details (default: true)" },
        },
      },
    },
    handler: async (args) => {
      const result = await analyzeCoverage({
        coverageData: args.coverageData as any | undefined,
        coverageFile: args.coverageFile as string | undefined,
        include: args.include as string[] | undefined,
        exclude: args.exclude as string[] | undefined,
        thresholds: args.thresholds as any | undefined,
        format: args.format as 'json' | 'html' | 'text' | 'lcov' | undefined,
        outputPath: args.outputPath as string | undefined,
        findUncovered: args.findUncovered as boolean | undefined,
        showDetails: args.showDetails as boolean | undefined,
      });
      return jsonResponse(result);
    },
  },
  {
    definition: {
      name: "generate-tests-ai",
      description: "Generate comprehensive test cases from source code using AI analysis. Creates unit tests with edge cases, mocks, and assertions.",
      inputSchema: {
        type: "object",
        properties: {
          sourceFile: { type: "string", description: "Path to source code file to generate tests for" },
          testType: { type: "string", enum: ["unit", "integration", "e2e"], description: "Type of tests to generate (default: unit)" },
          includeEdgeCases: { type: "boolean", description: "Include edge case testing (default: true)" },
          mockDependencies: { type: "boolean", description: "Auto-generate mocks for dependencies (default: true)" },
        },
        required: ["sourceFile"],
      },
    },
    handler: async (args) => {
      const outputDir = (args.outputDir as string) || "./tests";
      const result = await generateTests(args.sourceFile as string, outputDir);
      return jsonResponse(Array.from(result));
    },
  },
  {
    definition: {
      name: "generate-tests-directory",
      description: "Generate test files for all source files in a directory. Batch AI test generation with configurable coverage.",
      inputSchema: {
        type: "object",
        properties: {
          directory: { type: "string", description: "Directory containing source files" },
          outputDir: { type: "string", description: "Output directory for test files (default: ./tests)" },
          pattern: { type: "string", description: "File pattern to match (default: **/*.ts)" },
          testType: { type: "string", enum: ["unit", "integration", "e2e"], description: "Type of tests to generate (default: unit)" },
        },
        required: ["directory"],
      },
    },
    handler: async (args) => {
      const outputDir = (args.outputDir as string) || "./tests";
      const resultMap = await generateTestsForDirectory(args.directory as string, outputDir);
      const result = Object.fromEntries(resultMap);
      return jsonResponse(result);
    },
  },
  {
    definition: {
      name: "run-performance-test",
      description: "Run performance test on a function. Measures execution time, memory usage, throughput with statistical analysis.",
      inputSchema: {
        type: "object",
        properties: {
          testName: { type: "string", description: "Name of performance test" },
          iterations: { type: "number", description: "Number of iterations to run (default: 1000)" },
          warmupIterations: { type: "number", description: "Warmup iterations before measurement (default: 100)" },
          targetFunction: { type: "string", description: "Function path to test (module:function format)" },
          params: { type: "array", description: "Parameters to pass to function" },
        },
        required: ["testName", "targetFunction"],
      },
    },
    handler: async (args) => {
      const result = {
        testName: args.testName as string,
        targetFunction: args.targetFunction as string,
        iterations: (args.iterations as number) || 1000,
        warmupIterations: (args.warmupIterations as number) || 100,
        status: "pending",
        message: "Performance testing requires dynamic function execution - implement custom wrapper for production use",
      };
      return jsonResponse(result);
    },
  },
  {
    definition: {
      name: "run-load-test",
      description: "Run load test with concurrent requests. Simulates multiple users/requests to test scalability and identify bottlenecks.",
      inputSchema: {
        type: "object",
        properties: {
          testName: { type: "string", description: "Name of load test" },
          targetFunction: { type: "string", description: "Function path to test (module:function format)" },
          concurrentUsers: { type: "number", description: "Number of concurrent users to simulate (default: 10)" },
          duration: { type: "number", description: "Test duration in seconds (default: 60)" },
          rampUp: { type: "number", description: "Ramp-up time in seconds (default: 10)" },
        },
        required: ["testName", "targetFunction"],
      },
    },
    handler: async (args) => {
      const result = {
        testName: args.testName as string,
        targetFunction: args.targetFunction as string,
        concurrentUsers: (args.concurrentUsers as number) || 10,
        duration: (args.duration as number) || 60,
        rampUp: (args.rampUp as number) || 10,
        status: "pending",
        message: "Load testing requires dynamic function execution - implement custom wrapper for production use",
      };
      return jsonResponse(result);
    },
  },
];
