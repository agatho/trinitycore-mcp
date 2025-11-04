/**
 * Integration Tests - MCP Tools
 * Tests the 6 MCP tool functions
 */

import path from "path";
import {
  reviewFile,
  reviewFiles,
  reviewPattern,
  reviewProjectDirectory,
  generateReviewReport,
  getCodeReviewStats,
} from "../../../src/tools/codereview";
import { allExpectedViolations } from "../fixtures/test-violations";

describe("MCP Tools Integration", () => {
  const testFixturePath = path.join(__dirname, "../fixtures/sample-code.cpp");
  const tempDir = path.join(__dirname, "../../../temp");

  beforeAll(() => {
    // Create temp directory for reports
    const fs = require("fs");
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
  });

  describe("review-code-file", () => {
    it("should review a single file", async () => {
      const result = await reviewFile(testFixturePath, {
        enableAI: false,
        verbose: false,
      });

      // Result should be formatted markdown string
      expect(typeof result).toBe("string");
      expect(result).toContain("# Code Review Result");
      expect(result).toContain("## Summary");
    });

    it("should apply severity filter", async () => {
      const result = await reviewFile(testFixturePath, {
        enableAI: false,
        severityFilter: ["critical"],
        verbose: false,
      });

      expect(result).toContain("# Code Review Result");
      // If there are violations, they should only be critical
      if (result.includes("## Top Violations")) {
        expect(result).toContain("[CRITICAL]");
      }
    });

    it("should apply category filter", async () => {
      const result = await reviewFile(testFixturePath, {
        enableAI: false,
        categoryFilter: ["null_safety"],
        verbose: false,
      });

      expect(result).toContain("# Code Review Result");
    });

    it("should apply min confidence filter", async () => {
      const result = await reviewFile(testFixturePath, {
        enableAI: false,
        minConfidence: 0.9,
        verbose: false,
      });

      expect(result).toContain("# Code Review Result");
    });

    it("should handle non-existent file", async () => {
      const result = await reviewFile("/non/existent/file.cpp", {
        enableAI: false,
        verbose: false,
      });

      // Should return error JSON
      expect(result).toContain("error");
      expect(result).toContain("Code review failed");
    });

    it("should work with different compiler types", async () => {
      const gccResult = await reviewFile(testFixturePath, {
        enableAI: false,
        compilerType: "gcc",
        verbose: false,
      });

      const clangResult = await reviewFile(testFixturePath, {
        enableAI: false,
        compilerType: "clang",
        verbose: false,
      });

      expect(gccResult).toContain("# Code Review Result");
      expect(clangResult).toContain("# Code Review Result");
    });
  });

  describe("review-code-files", () => {
    it("should review multiple files", async () => {
      const result = await reviewFiles([testFixturePath], {
        enableAI: false,
        verbose: false,
      });

      expect(result).toContain("# Code Review Result");
      expect(result).toContain("(batch)");
    });

    it("should handle empty file list", async () => {
      const result = await reviewFiles([], {
        enableAI: false,
        verbose: false,
      });

      expect(result).toContain("# Code Review Result");
      expect(result).toContain("Files Analyzed: 0");
    });

    it("should aggregate violations from multiple files", async () => {
      const result = await reviewFiles([testFixturePath], {
        enableAI: false,
        verbose: false,
      });

      expect(result).toContain("## Summary");
      expect(result).toContain("Total Violations:");
    });
  });

  describe("review-code-pattern", () => {
    it("should review files matching pattern", async () => {
      const result = await reviewPattern(["tests/code-review/fixtures/*.cpp"], {
        enableAI: false,
        verbose: false,
      });

      expect(result).toContain("# Code Review Result");
      expect(result).toContain("(pattern)");
    });

    it("should handle invalid patterns", async () => {
      const result = await reviewPattern(["///invalid///pattern///*.cpp"], {
        enableAI: false,
        verbose: false,
      });

      // Should handle gracefully
      expect(result).toContain("# Code Review Result");
    });

    it("should support exclude patterns", async () => {
      const result = await reviewPattern(["tests/code-review/**/*.cpp"], {
        enableAI: false,
        excludePatterns: ["**/node_modules/**"],
        verbose: false,
      });

      expect(result).toContain("# Code Review Result");
    });
  });

  describe("review-code-project", () => {
    it("should review entire project directory", async () => {
      const projectRoot = path.join(__dirname, "../fixtures");
      const result = await reviewProjectDirectory(projectRoot, {
        enableAI: false,
        patterns: ["*.cpp"],
        verbose: false,
      });

      expect(result).toContain("# Code Review Result");
      expect(result).toContain("(project)");
    });

    it("should generate report file", async () => {
      const projectRoot = path.join(__dirname, "../fixtures");
      const reportPath = path.join(tempDir, "project-review.md");

      const result = await reviewProjectDirectory(projectRoot, {
        enableAI: false,
        patterns: ["*.cpp"],
        reportPath,
        reportFormat: "markdown",
        verbose: false,
      });

      expect(result).toContain("# Code Review Result");

      // Report file should be created
      const fs = require("fs");
      expect(fs.existsSync(reportPath)).toBe(true);
    });

    it("should support different report formats", async () => {
      const projectRoot = path.join(__dirname, "../fixtures");

      // Markdown
      const mdResult = await reviewProjectDirectory(projectRoot, {
        enableAI: false,
        patterns: ["*.cpp"],
        reportFormat: "markdown",
        verbose: false,
      });
      expect(mdResult).toContain("# Code Review Result");

      // JSON
      const jsonResult = await reviewProjectDirectory(projectRoot, {
        enableAI: false,
        patterns: ["*.cpp"],
        reportFormat: "json",
        verbose: false,
      });
      expect(jsonResult).toContain("# Code Review Result");
    });

    it("should handle non-existent project root", async () => {
      const result = await reviewProjectDirectory("/non/existent/project", {
        enableAI: false,
        verbose: false,
      });

      // Should return error JSON
      expect(result).toContain("error");
      expect(result).toContain("Project review failed");
    });
  });

  describe("generate-code-review-report", () => {
    it("should generate report from violations", async () => {
      const reportPath = path.join(tempDir, "violations-report.md");
      const violations = allExpectedViolations;

      const result = await generateReviewReport(
        violations,
        reportPath,
        "markdown"
      );

      // Should return success JSON
      const resultObj = JSON.parse(result);
      expect(resultObj.success).toBe(true);
      expect(resultObj.reportPath).toBe(reportPath);
      expect(resultObj.format).toBe("markdown");

      // Report file should be created
      const fs = require("fs");
      expect(fs.existsSync(reportPath)).toBe(true);
    });

    it("should generate HTML report", async () => {
      const reportPath = path.join(tempDir, "violations-report.html");
      const violations = allExpectedViolations;

      const result = await generateReviewReport(
        violations,
        reportPath,
        "html"
      );

      const resultObj = JSON.parse(result);
      expect(resultObj.success).toBe(true);

      // Report file should be created
      const fs = require("fs");
      expect(fs.existsSync(reportPath)).toBe(true);
    });

    it("should generate JSON report", async () => {
      const reportPath = path.join(tempDir, "violations-report.json");
      const violations = allExpectedViolations;

      const result = await generateReviewReport(
        violations,
        reportPath,
        "json"
      );

      const resultObj = JSON.parse(result);
      expect(resultObj.success).toBe(true);

      // Report file should be created and be valid JSON
      const fs = require("fs");
      expect(fs.existsSync(reportPath)).toBe(true);

      const reportContent = fs.readFileSync(reportPath, "utf-8");
      expect(() => JSON.parse(reportContent)).not.toThrow();
    });

    it("should handle empty violations list", async () => {
      const reportPath = path.join(tempDir, "empty-violations-report.md");

      const result = await generateReviewReport(
        [],
        reportPath,
        "markdown"
      );

      const resultObj = JSON.parse(result);
      expect(resultObj.success).toBe(true);
      expect(resultObj.violationsCount).toBe(0);
    });

    it("should handle invalid report path", async () => {
      const result = await generateReviewReport(
        allExpectedViolations,
        "/invalid/path/report.md",
        "markdown"
      );

      // Should return error JSON
      expect(result).toContain("error");
      expect(result).toContain("Report generation failed");
    });
  });

  describe("get-code-review-stats", () => {
    it("should return system statistics", async () => {
      const result = await getCodeReviewStats();

      // Should return JSON
      const stats = JSON.parse(result);

      expect(stats).toHaveProperty("system");
      expect(stats).toHaveProperty("version");
      expect(stats).toHaveProperty("capabilities");
      expect(stats).toHaveProperty("performance");
      expect(stats).toHaveProperty("features");

      expect(stats.system).toBe("TrinityCore AI Code Review System");
      expect(stats.version).toBe("1.0.0");
    });

    it("should include rule counts", async () => {
      const result = await getCodeReviewStats();
      const stats = JSON.parse(result);

      expect(stats.capabilities.totalRules).toBe(870);
      expect(Array.isArray(stats.capabilities.ruleCategories)).toBe(true);
      expect(stats.capabilities.ruleCategories.length).toBe(7);
    });

    it("should include performance targets", async () => {
      const result = await getCodeReviewStats();
      const stats = JSON.parse(result);

      expect(stats.performance.targetAccuracy).toBe(">90%");
      expect(stats.performance.targetFalsePositiveRate).toBe("<15%");
      expect(stats.performance.analysisSpeed).toBe("~1000 LOC/sec");
    });

    it("should include feature flags", async () => {
      const result = await getCodeReviewStats();
      const stats = JSON.parse(result);

      expect(stats.features.staticAnalysis).toBe(true);
      expect(stats.features.aiEnhancement).toBe(true);
      expect(stats.features.autoFixes).toBe(true);
      expect(stats.features.serenaIntegration).toBe(true);
      expect(stats.features.batchProcessing).toBe(true);
    });

    it("should include supported providers and formats", async () => {
      const result = await getCodeReviewStats();
      const stats = JSON.parse(result);

      expect(stats.capabilities.aiProviders).toContain("OpenAI");
      expect(stats.capabilities.aiProviders).toContain("Ollama");
      expect(stats.capabilities.aiProviders).toContain("LM Studio");

      expect(stats.capabilities.reportFormats).toContain("Markdown");
      expect(stats.capabilities.reportFormats).toContain("HTML");
      expect(stats.capabilities.reportFormats).toContain("JSON");
      expect(stats.capabilities.reportFormats).toContain("Console");
    });
  });

  describe("Error Handling", () => {
    it("should handle errors gracefully across all tools", async () => {
      // Each tool should return error JSON on failure, not throw
      const invalidPath = "/invalid/path/file.cpp";

      const fileResult = await reviewFile(invalidPath, { enableAI: false });
      expect(fileResult).toContain("error");

      const filesResult = await reviewFiles([invalidPath], { enableAI: false });
      expect(filesResult).toContain("error");

      const patternResult = await reviewPattern(["///invalid///"], { enableAI: false });
      // Pattern might return empty result or error
      expect(patternResult).toContain("# Code Review Result");

      const projectResult = await reviewProjectDirectory("/invalid/project", { enableAI: false });
      expect(projectResult).toContain("error");
    });
  });

  describe("Performance", () => {
    it("should complete single file review quickly", async () => {
      const startTime = Date.now();
      await reviewFile(testFixturePath, { enableAI: false, verbose: false });
      const duration = Date.now() - startTime;

      // Should complete within 5 seconds
      expect(duration).toBeLessThan(5000);
    });

    it("should handle batch reviews efficiently", async () => {
      const files = [testFixturePath];

      const startTime = Date.now();
      await reviewFiles(files, { enableAI: false, verbose: false });
      const duration = Date.now() - startTime;

      console.log(`Batch review duration: ${duration}ms`);

      // Should complete within reasonable time
      expect(duration).toBeLessThan(10000);
    });
  });
});
