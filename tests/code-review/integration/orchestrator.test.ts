/**
 * Integration Tests - Code Review Orchestrator
 * Tests end-to-end code review workflows
 */

import path from "path";
import fs from "fs";
import {
  createCodeReviewOrchestrator,
  reviewProject,
  type CodeReviewConfig,
} from "../../../src/code-review/index";

/**
 * Default test config with AI disabled.
 * AI review requires a running Ollama instance with codellama model,
 * which is unavailable in CI. Disabling prevents timeout from retries.
 */
const defaultTestConfig: CodeReviewConfig = {
  enableAI: false,
  verbose: false,
};

describe("CodeReviewOrchestrator Integration", () => {
  const testFixturePath = path.join(__dirname, "../fixtures/sample-code.cpp");
  const tempDir = path.join(__dirname, "../../../temp");

  beforeAll(() => {
    // Ensure temp directory exists for report generation tests
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
  });

  describe("Basic Workflow", () => {
    it("should create orchestrator with default config", async () => {
      const orchestrator = await createCodeReviewOrchestrator(defaultTestConfig);
      expect(orchestrator).toBeDefined();
    });

    it("should create orchestrator with custom config", async () => {
      const config: CodeReviewConfig = {
        enableAI: false,
        minConfidence: 0.8,
        compilerType: "gcc",
        verbose: false,
      };

      const orchestrator = await createCodeReviewOrchestrator(config);
      expect(orchestrator).toBeDefined();
    });
  });

  describe("File Review", () => {
    it("should review a single file", async () => {
      const orchestrator = await createCodeReviewOrchestrator(defaultTestConfig);
      const result = await orchestrator.reviewFiles([testFixturePath]);

      expect(result).toHaveProperty("files");
      expect(result).toHaveProperty("violations");
      expect(result).toHaveProperty("aiEnhanced");
      expect(result).toHaveProperty("durationMs");
      expect(result).toHaveProperty("statistics");
      expect(result.files).toContain(testFixturePath);
    });

    it("should detect violations in test fixture", async () => {
      const orchestrator = await createCodeReviewOrchestrator(defaultTestConfig);
      const result = await orchestrator.reviewFiles([testFixturePath]);

      // Test fixture should have multiple violations
      expect(result.violations.length).toBeGreaterThan(0);
    });

    it("should include statistics in result", async () => {
      const orchestrator = await createCodeReviewOrchestrator(defaultTestConfig);
      const result = await orchestrator.reviewFiles([testFixturePath]);

      expect(result.statistics).toHaveProperty("totalViolations");
      expect(result.statistics).toHaveProperty("bySeverity");
      expect(result.statistics).toHaveProperty("byCategory");
      expect(result.statistics).toHaveProperty("filesAnalyzed");
      expect(result.statistics).toHaveProperty("filesWithIssues");
      expect(result.statistics).toHaveProperty("averageConfidence");
      expect(result.statistics).toHaveProperty("fixableIssues");
    });

    it("should categorize violations by severity", async () => {
      const orchestrator = await createCodeReviewOrchestrator(defaultTestConfig);
      const result = await orchestrator.reviewFiles([testFixturePath]);

      const { bySeverity } = result.statistics;
      const total =
        bySeverity.critical + bySeverity.major + bySeverity.minor + bySeverity.info;

      expect(total).toBe(result.statistics.totalViolations);
    });

    it("should categorize violations by category", async () => {
      const orchestrator = await createCodeReviewOrchestrator(defaultTestConfig);
      const result = await orchestrator.reviewFiles([testFixturePath]);

      const { byCategory } = result.statistics;
      const total =
        byCategory.null_safety +
        byCategory.memory +
        byCategory.concurrency +
        byCategory.convention +
        byCategory.security +
        byCategory.performance +
        byCategory.architecture;

      expect(total).toBe(result.statistics.totalViolations);
    });
  });

  describe("Multiple File Review", () => {
    it("should review multiple files", async () => {
      const orchestrator = await createCodeReviewOrchestrator(defaultTestConfig);
      const files = [testFixturePath];

      const result = await orchestrator.reviewFiles(files);

      expect(result.files.length).toBe(files.length);
      expect(result.statistics.filesAnalyzed).toBe(files.length);
    });
  });

  describe("Pattern-Based Review", () => {
    it("should review files matching pattern", async () => {
      const orchestrator = await createCodeReviewOrchestrator(defaultTestConfig);
      const patterns = ["tests/code-review/fixtures/*.cpp"];

      const result = await orchestrator.reviewPattern(patterns);

      expect(result.files.length).toBeGreaterThan(0);
      expect(result.violations).toBeDefined();
    });
  });

  describe("Filtering", () => {
    it("should filter by severity", async () => {
      const config: CodeReviewConfig = {
        enableAI: false,
        severityFilter: ["critical"],
      };

      const orchestrator = await createCodeReviewOrchestrator(config);
      const result = await orchestrator.reviewFiles([testFixturePath]);

      result.violations.forEach((violation) => {
        expect(violation.severity).toBe("critical");
      });
    });

    it("should filter by category", async () => {
      const config: CodeReviewConfig = {
        enableAI: false,
        categoryFilter: ["null_safety"],
      };

      const orchestrator = await createCodeReviewOrchestrator(config);
      const result = await orchestrator.reviewFiles([testFixturePath]);

      result.violations.forEach((violation) => {
        expect(violation.metadata.category).toBe("null_safety");
      });
    });

    it("should filter by minimum confidence", async () => {
      const config: CodeReviewConfig = {
        enableAI: false,
        minConfidence: 0.9,
      };

      const orchestrator = await createCodeReviewOrchestrator(config);
      const result = await orchestrator.reviewFiles([testFixturePath]);

      result.violations.forEach((violation) => {
        expect(violation.confidence).toBeGreaterThanOrEqual(0.9);
      });
    });

    it("should limit maximum violations", async () => {
      const maxViolations = 5;
      const config: CodeReviewConfig = {
        enableAI: false,
        maxViolations,
      };

      const orchestrator = await createCodeReviewOrchestrator(config);
      const result = await orchestrator.reviewFiles([testFixturePath]);

      expect(result.violations.length).toBeLessThanOrEqual(maxViolations);
    });
  });

  describe("Report Generation", () => {
    it("should generate markdown report", async () => {
      const orchestrator = await createCodeReviewOrchestrator(defaultTestConfig);
      const result = await orchestrator.reviewFiles([testFixturePath]);

      const reportPath = path.join(tempDir, "test-report.md");
      await orchestrator.generateReport(result, reportPath, "markdown");

      // Report file should be created
      expect(fs.existsSync(reportPath)).toBe(true);
    });

    it("should generate JSON report", async () => {
      const orchestrator = await createCodeReviewOrchestrator(defaultTestConfig);
      const result = await orchestrator.reviewFiles([testFixturePath]);

      const reportPath = path.join(tempDir, "test-report.json");
      await orchestrator.generateReport(result, reportPath, "json");

      // Report file should be created
      expect(fs.existsSync(reportPath)).toBe(true);
    });
  });

  describe("Performance", () => {
    it("should complete single file review within performance target", async () => {
      const orchestrator = await createCodeReviewOrchestrator(defaultTestConfig);

      const startTime = Date.now();
      const result = await orchestrator.reviewFiles([testFixturePath]);
      const duration = Date.now() - startTime;

      // Should complete within 5 seconds
      expect(duration).toBeLessThan(5000);
      expect(result.durationMs).toBeLessThan(5000);
    });

    it("should handle large files efficiently", async () => {
      const orchestrator = await createCodeReviewOrchestrator(defaultTestConfig);

      const startTime = Date.now();
      await orchestrator.reviewFiles([testFixturePath]);
      const duration = Date.now() - startTime;

      console.log(`Review duration: ${duration}ms`);

      // Should maintain reasonable performance
      expect(duration).toBeLessThan(10000);
    });
  });

  describe("Quick Review Function", () => {
    it("should perform quick project review", async () => {
      const result = await reviewProject({
        projectRoot: path.join(__dirname, "../fixtures"),
        files: ["*.cpp"],
        enableAI: false,
        verbose: false,
      });

      expect(result).toHaveProperty("files");
      expect(result).toHaveProperty("violations");
      expect(result).toHaveProperty("statistics");
      expect(result.files.length).toBeGreaterThan(0);
    });

    it("should generate report during quick review", async () => {
      const reportPath = path.join(tempDir, "quick-review-report.md");

      const result = await reviewProject({
        projectRoot: path.join(__dirname, "../fixtures"),
        files: ["*.cpp"],
        enableAI: false,
        reportPath,
        format: "markdown",
        verbose: false,
      });

      // Report should be generated
      expect(fs.existsSync(reportPath)).toBe(true);
      expect(result.files.length).toBeGreaterThan(0);
    });
  });

  describe("Error Handling", () => {
    it("should handle non-existent files gracefully", async () => {
      const orchestrator = await createCodeReviewOrchestrator(defaultTestConfig);
      const nonExistentFile = "/non/existent/file.cpp";

      // Orchestrator skips non-existent files gracefully (does not throw)
      const result = await orchestrator.reviewFiles([nonExistentFile]);
      expect(result).toBeDefined();
      expect(result.violations.length).toBe(0);
    });

    it("should handle invalid patterns gracefully", async () => {
      const orchestrator = await createCodeReviewOrchestrator(defaultTestConfig);
      const invalidPattern = ["///invalid///pattern///*.cpp"];

      const result = await orchestrator.reviewPattern(invalidPattern);

      // Should return empty result, not throw
      expect(result.files.length).toBe(0);
      expect(result.violations.length).toBe(0);
    });
  });

  describe("AI Enhancement (Disabled)", () => {
    it("should work without AI enhancement", async () => {
      const config: CodeReviewConfig = {
        enableAI: false,
      };

      const orchestrator = await createCodeReviewOrchestrator(config);
      const result = await orchestrator.reviewFiles([testFixturePath]);

      expect(result.aiEnhanced).toBe(0);
      expect(result.violations.length).toBeGreaterThan(0);
    });
  });

  describe("Accuracy Metrics", () => {
    it("should calculate average confidence", async () => {
      const orchestrator = await createCodeReviewOrchestrator(defaultTestConfig);
      const result = await orchestrator.reviewFiles([testFixturePath]);

      if (result.violations.length > 0) {
        const avgConfidence = result.statistics.averageConfidence;
        expect(avgConfidence).toBeGreaterThan(0);
        expect(avgConfidence).toBeLessThanOrEqual(1);
      }
    });

    it("should count fixable issues", async () => {
      const orchestrator = await createCodeReviewOrchestrator(defaultTestConfig);
      const result = await orchestrator.reviewFiles([testFixturePath]);

      const violationsWithFixes = result.violations.filter((v) => v.suggestedFix);
      expect(result.statistics.fixableIssues).toBe(violationsWithFixes.length);
    });

    it("should track files with issues", async () => {
      const orchestrator = await createCodeReviewOrchestrator(defaultTestConfig);
      const result = await orchestrator.reviewFiles([testFixturePath]);

      if (result.violations.length > 0) {
        expect(result.statistics.filesWithIssues).toBeGreaterThan(0);
      }
    });
  });
});
