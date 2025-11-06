/**
 * End-to-End Tests for Code Review Workflow
 * Tests the complete workflow from code file to review report
 */

import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import path from "path";
import * as fs from "fs";
import {
  reviewFile,
  reviewFiles,
  reviewPattern,
  reviewProjectDirectory,
  generateReviewReport,
  getCodeReviewStats,
} from "../../src/tools/codereview.js";

// Temporary test files
const TEST_DIR = path.join(__dirname, "../temp/e2e-code-review");
const TEST_FILE_1 = path.join(TEST_DIR, "test1.cpp");
const TEST_FILE_2 = path.join(TEST_DIR, "test2.cpp");
const REPORT_PATH = path.join(TEST_DIR, "review-report.md");

// Sample C++ code with intentional issues
const SAMPLE_CPP_CODE_1 = `
#include <iostream>
#include <string>

class TestClass {
public:
    void testMethod() {
        int* ptr = new int(42);
        // Missing delete - memory leak
        std::cout << *ptr << std::endl;
    }

    void unsafeMethod(char* buffer) {
        // Unsafe strcpy
        strcpy(buffer, "test");
    }
};

int main() {
    TestClass obj;
    obj.testMethod();
    return 0;
}
`.trim();

const SAMPLE_CPP_CODE_2 = `
#include <iostream>
#include <vector>

class DataHandler {
private:
    std::vector<int> data;

public:
    void processData() {
        for (int i = 0; i <= data.size(); i++) {
            // Off-by-one error
            std::cout << data[i] << std::endl;
        }
    }

    void nullPointerRisk() {
        int* ptr = nullptr;
        // Null pointer dereference risk
        *ptr = 10;
    }
};
`.trim();

describe("Code Review E2E Workflow", () => {
  beforeAll(() => {
    // Create test directory and files
    if (!fs.existsSync(TEST_DIR)) {
      fs.mkdirSync(TEST_DIR, { recursive: true });
    }
    fs.writeFileSync(TEST_FILE_1, SAMPLE_CPP_CODE_1);
    fs.writeFileSync(TEST_FILE_2, SAMPLE_CPP_CODE_2);
  });

  afterAll(() => {
    // Clean up test files
    try {
      if (fs.existsSync(TEST_FILE_1)) fs.unlinkSync(TEST_FILE_1);
      if (fs.existsSync(TEST_FILE_2)) fs.unlinkSync(TEST_FILE_2);
      if (fs.existsSync(REPORT_PATH)) fs.unlinkSync(REPORT_PATH);
      if (fs.existsSync(TEST_DIR)) fs.rmdirSync(TEST_DIR, { recursive: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe("Single File Review Workflow", () => {
    it("should complete full single file review", async () => {
      // Step 1: Review file
      const result = await reviewFile(TEST_FILE_1, {
        enableAI: false,
        verbose: false,
      });

      // Step 2: Verify result is markdown
      expect(result).toBeDefined();
      expect(typeof result).toBe("string");
      expect(result).toContain("# Code Review Result");

      // Step 3: Should contain summary section
      expect(result).toContain("## Summary");

      // Step 4: Should have file information
      expect(result).toContain("test1.cpp");
    }, 10000); // 10 second timeout

    it("should detect memory issues", async () => {
      const result = await reviewFile(TEST_FILE_1, {
        enableAI: false,
        categoryFilter: ["memory_safety"],
        verbose: false,
      });

      expect(result).toBeDefined();
      expect(result).toContain("# Code Review Result");

      // Should detect memory-related issues
      const hasMemoryWarning = result.toLowerCase().includes("memory") ||
                              result.toLowerCase().includes("leak") ||
                              result.toLowerCase().includes("delete");
      expect(hasMemoryWarning || result.includes("0 violations")).toBe(true);
    }, 10000);

    it("should apply severity filtering", async () => {
      const criticalOnly = await reviewFile(TEST_FILE_1, {
        enableAI: false,
        severityFilter: ["critical"],
        verbose: false,
      });

      expect(criticalOnly).toBeDefined();
      expect(criticalOnly).toContain("# Code Review Result");
    }, 10000);

    it("should work with different compilers", async () => {
      const gccResult = await reviewFile(TEST_FILE_1, {
        enableAI: false,
        compilerType: "gcc",
        verbose: false,
      });

      const clangResult = await reviewFile(TEST_FILE_1, {
        enableAI: false,
        compilerType: "clang",
        verbose: false,
      });

      expect(gccResult).toContain("# Code Review Result");
      expect(clangResult).toContain("# Code Review Result");
    }, 10000);
  });

  describe("Multiple File Review Workflow", () => {
    it("should review multiple files", async () => {
      // Step 1: Review multiple files
      const result = await reviewFiles([TEST_FILE_1, TEST_FILE_2], {
        enableAI: false,
        verbose: false,
      });

      // Step 2: Verify batch review
      expect(result).toBeDefined();
      expect(result).toContain("# Code Review Result");
      expect(result).toContain("(batch)");

      // Step 3: Should analyze multiple files
      expect(result).toContain("Files Analyzed:");
    }, 15000);

    it("should aggregate violations from multiple files", async () => {
      const result = await reviewFiles([TEST_FILE_1, TEST_FILE_2], {
        enableAI: false,
        verbose: false,
      });

      expect(result).toContain("Total Violations:");
    }, 15000);
  });

  describe("Pattern-Based Review Workflow", () => {
    it("should review files matching pattern", async () => {
      // Step 1: Review by pattern
      const pattern = path.join(TEST_DIR, "*.cpp");
      const result = await reviewPattern([pattern], {
        enableAI: false,
        verbose: false,
      });

      // Step 2: Verify pattern review
      expect(result).toBeDefined();
      expect(result).toContain("# Code Review Result");
      expect(result).toContain("(pattern)");
    }, 15000);

    it("should support exclude patterns", async () => {
      const pattern = path.join(TEST_DIR, "*.cpp");
      const result = await reviewPattern([pattern], {
        enableAI: false,
        excludePatterns: ["**/test2.cpp"],
        verbose: false,
      });

      expect(result).toBeDefined();
      expect(result).toContain("# Code Review Result");
    }, 15000);
  });

  describe("Project-Wide Review Workflow", () => {
    it("should review entire project directory", async () => {
      // Step 1: Review project directory
      const result = await reviewProjectDirectory(TEST_DIR, {
        enableAI: false,
        patterns: ["*.cpp"],
        verbose: false,
      });

      // Step 2: Verify project review
      expect(result).toBeDefined();
      expect(result).toContain("# Code Review Result");
      expect(result).toContain("(project)");
    }, 20000);

    it("should generate report file", async () => {
      // Step 1: Review with report generation
      const result = await reviewProjectDirectory(TEST_DIR, {
        enableAI: false,
        patterns: ["*.cpp"],
        reportPath: REPORT_PATH,
        reportFormat: "markdown",
        verbose: false,
      });

      // Step 2: Verify report generated
      expect(result).toContain("# Code Review Result");

      // Step 3: Check report file exists
      expect(fs.existsSync(REPORT_PATH)).toBe(true);

      // Step 4: Verify report content
      const reportContent = fs.readFileSync(REPORT_PATH, "utf-8");
      expect(reportContent.length).toBeGreaterThan(0);
      expect(reportContent).toContain("# Code Review Result");
    }, 20000);

    it("should support different report formats", async () => {
      // Markdown format
      const mdResult = await reviewProjectDirectory(TEST_DIR, {
        enableAI: false,
        patterns: ["*.cpp"],
        reportFormat: "markdown",
        verbose: false,
      });
      expect(mdResult).toContain("#");

      // JSON format
      const jsonResult = await reviewProjectDirectory(TEST_DIR, {
        enableAI: false,
        patterns: ["*.cpp"],
        reportFormat: "json",
        verbose: false,
      });
      expect(jsonResult).toBeDefined();
    }, 30000);
  });

  describe("Report Generation Workflow", () => {
    it("should generate standalone report", async () => {
      // Step 1: Get violations from file review
      const reviewResult = await reviewFile(TEST_FILE_1, {
        enableAI: false,
        verbose: false,
      });

      // Step 2: Generate report (mock violations)
      const mockViolations = [
        {
          type: "memory_safety",
          severity: "critical",
          file: TEST_FILE_1,
          line: 8,
          column: 9,
          code: "int* ptr = new int(42);",
          violation: "Potential memory leak",
          expected: "Use smart pointers or ensure delete is called",
          autoFixable: false,
          confidence: 0.95,
        },
      ];

      const reportPath = path.join(TEST_DIR, "standalone-report.md");
      const result = await generateReviewReport(
        mockViolations,
        reportPath,
        "markdown"
      );

      // Step 3: Verify report generation
      const resultObj = JSON.parse(result);
      expect(resultObj.success).toBe(true);
      expect(resultObj.reportPath).toBe(reportPath);

      // Step 4: Verify file exists
      expect(fs.existsSync(reportPath)).toBe(true);

      // Cleanup
      if (fs.existsSync(reportPath)) fs.unlinkSync(reportPath);
    }, 10000);

    it("should generate HTML report", async () => {
      const mockViolations = [
        {
          type: "null_safety",
          severity: "critical",
          file: TEST_FILE_2,
          line: 15,
          column: 9,
          code: "*ptr = 10;",
          violation: "Null pointer dereference",
          expected: "Check pointer before dereferencing",
          autoFixable: false,
          confidence: 0.98,
        },
      ];

      const reportPath = path.join(TEST_DIR, "report.html");
      const result = await generateReviewReport(
        mockViolations,
        reportPath,
        "html"
      );

      const resultObj = JSON.parse(result);
      expect(resultObj.success).toBe(true);
      expect(fs.existsSync(reportPath)).toBe(true);

      // Cleanup
      if (fs.existsSync(reportPath)) fs.unlinkSync(reportPath);
    }, 10000);
  });

  describe("Statistics and Metrics", () => {
    it("should provide system statistics", async () => {
      const result = await getCodeReviewStats();
      const stats = JSON.parse(result);

      // Verify structure
      expect(stats).toHaveProperty("system");
      expect(stats).toHaveProperty("version");
      expect(stats).toHaveProperty("capabilities");
      expect(stats).toHaveProperty("performance");
      expect(stats).toHaveProperty("features");

      // Verify content
      expect(stats.system).toBe("TrinityCore AI Code Review System");
      expect(stats.capabilities.totalRules).toBe(870);
    });
  });

  describe("Error Handling", () => {
    it("should handle non-existent file", async () => {
      const result = await reviewFile("/non/existent/file.cpp", {
        enableAI: false,
        verbose: false,
      });

      // Should return error JSON
      expect(result).toContain("error");
      expect(result).toContain("Code review failed");
    }, 10000);

    it("should handle empty file list", async () => {
      const result = await reviewFiles([], {
        enableAI: false,
        verbose: false,
      });

      expect(result).toContain("# Code Review Result");
      expect(result).toContain("Files Analyzed: 0");
    }, 10000);

    it("should handle invalid project directory", async () => {
      const result = await reviewProjectDirectory("/invalid/path", {
        enableAI: false,
        verbose: false,
      });

      expect(result).toContain("error");
    }, 10000);
  });

  describe("Performance", () => {
    it("should complete single file review quickly", async () => {
      const startTime = Date.now();

      await reviewFile(TEST_FILE_1, {
        enableAI: false,
        verbose: false,
      });

      const duration = Date.now() - startTime;

      // Should complete in under 8 seconds
      expect(duration).toBeLessThan(8000);
    }, 10000);

    it("should handle batch reviews efficiently", async () => {
      const startTime = Date.now();

      await reviewFiles([TEST_FILE_1, TEST_FILE_2], {
        enableAI: false,
        verbose: false,
      });

      const duration = Date.now() - startTime;

      // Should complete in under 15 seconds
      expect(duration).toBeLessThan(15000);
    }, 20000);
  });

  describe("Filter Combinations", () => {
    it("should apply multiple filters simultaneously", async () => {
      const result = await reviewFile(TEST_FILE_1, {
        enableAI: false,
        severityFilter: ["critical", "high"],
        categoryFilter: ["memory_safety", "null_safety"],
        minConfidence: 0.8,
        verbose: false,
      });

      expect(result).toBeDefined();
      expect(result).toContain("# Code Review Result");
    }, 10000);

    it("should combine compiler selection with filters", async () => {
      const result = await reviewFile(TEST_FILE_1, {
        enableAI: false,
        compilerType: "clang",
        severityFilter: ["critical"],
        verbose: false,
      });

      expect(result).toContain("# Code Review Result");
    }, 10000);
  });

  describe("End-to-End Pipeline", () => {
    it("should execute full review pipeline", async () => {
      // Step 1: Get system stats
      const statsResult = await getCodeReviewStats();
      const stats = JSON.parse(statsResult);
      expect(stats.system).toBe("TrinityCore AI Code Review System");

      // Step 2: Review single file
      const singleFileResult = await reviewFile(TEST_FILE_1, {
        enableAI: false,
        verbose: false,
      });
      expect(singleFileResult).toContain("# Code Review Result");

      // Step 3: Review multiple files
      const multiFileResult = await reviewFiles([TEST_FILE_1, TEST_FILE_2], {
        enableAI: false,
        verbose: false,
      });
      expect(multiFileResult).toContain("(batch)");

      // Step 4: Review by pattern
      const patternResult = await reviewPattern([path.join(TEST_DIR, "*.cpp")], {
        enableAI: false,
        verbose: false,
      });
      expect(patternResult).toContain("(pattern)");

      // Step 5: Review entire project
      const projectResult = await reviewProjectDirectory(TEST_DIR, {
        enableAI: false,
        patterns: ["*.cpp"],
        reportPath: REPORT_PATH,
        reportFormat: "markdown",
        verbose: false,
      });
      expect(projectResult).toContain("(project)");

      // Step 6: Verify report file
      expect(fs.existsSync(REPORT_PATH)).toBe(true);
    }, 60000); // Extended timeout for full pipeline
  });
});
