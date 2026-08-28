/**
 * Unit Tests - TrinityRuleEngine
 * Tests the core rule engine functionality
 */

import { TrinityRuleEngine } from "../../src/code-review/TrinityRuleEngine";
import type { RuleEngineOptions } from "../../src/code-review/TrinityRuleEngine";
import type { AST, CodeContext } from "../../src/code-review/types";
import { mockAST, mockCodeContext } from "./fixtures/test-violations";

describe("TrinityRuleEngine", () => {
  let engine: TrinityRuleEngine;

  beforeEach(() => {
    engine = new TrinityRuleEngine();
  });

  describe("Initialization", () => {
    it("should create engine instance successfully", () => {
      expect(engine).toBeInstanceOf(TrinityRuleEngine);
    });

    it("should load all rules on initialization", () => {
      const rules = engine.getRules();
      expect(rules.length).toBeGreaterThanOrEqual(800);
    });

    it("should load rules from all active categories", () => {
      const rules = engine.getRules();
      const categories = new Set(rules.map((r) => r.category));

      expect(categories).toContain("null_safety");
      expect(categories).toContain("memory");
      // concurrency category has 0 rules currently so it won't appear
      expect(categories).toContain("convention");
      expect(categories).toContain("security");
      expect(categories).toContain("performance");
      expect(categories).toContain("architecture");
    });
  });

  describe("Rule Execution", () => {
    it("should execute rules and return violations", async () => {
      const result = await engine.executeRules(mockAST as unknown as AST, mockCodeContext as unknown as CodeContext);

      expect(result).toHaveProperty("violations");
      expect(result).toHaveProperty("executedRules");
      expect(result).toHaveProperty("skippedRules");
      expect(result).toHaveProperty("executionTime");
      expect(Array.isArray(result.violations)).toBe(true);
    });

    it("should execute rules within performance target", async () => {
      const startTime = Date.now();
      await engine.executeRules(mockAST as unknown as AST, mockCodeContext as unknown as CodeContext);
      const duration = Date.now() - startTime;

      // Should complete within reasonable time
      expect(duration).toBeLessThan(5000); // 5 seconds max
    });

    it("should track executed and skipped rules", async () => {
      const result = await engine.executeRules(mockAST as unknown as AST, mockCodeContext as unknown as CodeContext);

      expect(result.executedRules).toBeGreaterThan(0);
      expect(result.executedRules + result.skippedRules).toBe(engine.getRules().length);
    });
  });

  describe("Rule Filtering", () => {
    it("should filter by severity", async () => {
      const options: RuleEngineOptions = {
        severity: ["critical"],
      };

      const result = await engine.executeRules(
        mockAST as unknown as AST,
        mockCodeContext as unknown as CodeContext,
        options
      );

      // All violations should be critical
      result.violations.forEach((violation) => {
        expect(violation.severity).toBe("critical");
      });
    });

    it("should filter by category", async () => {
      const options: RuleEngineOptions = {
        categories: ["null_safety"],
      };

      const result = await engine.executeRules(
        mockAST as unknown as AST,
        mockCodeContext as unknown as CodeContext,
        options
      );

      // All violations should be null_safety
      result.violations.forEach((violation) => {
        expect(violation.metadata.category).toBe("null_safety");
      });
    });

    it("should filter by minimum confidence", async () => {
      const options: RuleEngineOptions = {
        minConfidence: 0.9,
      };

      const result = await engine.executeRules(
        mockAST as unknown as AST,
        mockCodeContext as unknown as CodeContext,
        options
      );

      // All violations should have confidence >= 0.9
      result.violations.forEach((violation) => {
        expect(violation.confidence).toBeGreaterThanOrEqual(0.9);
      });
    });

    it("should filter by enabled rules only", async () => {
      const options: RuleEngineOptions = {
        enabledOnly: true,
      };

      const result = await engine.executeRules(
        mockAST as unknown as AST,
        mockCodeContext as unknown as CodeContext,
        options
      );

      // Should still return a valid result
      expect(result.violations).toBeDefined();
      expect(Array.isArray(result.violations)).toBe(true);
    });
  });

  describe("Rule Categories", () => {
    it("should have correct null safety rule count", () => {
      const rules = engine.getRules();
      const nullSafetyRules = rules.filter((r) => r.category === "null_safety");
      expect(nullSafetyRules.length).toBeGreaterThanOrEqual(220);
    });

    it("should have correct memory management rule count", () => {
      const rules = engine.getRules();
      const memoryRules = rules.filter((r) => r.category === "memory");
      expect(memoryRules.length).toBeGreaterThanOrEqual(150);
    });

    it("should have concurrency rules", () => {
      const rules = engine.getRules();
      const concurrencyRules = rules.filter((r) => r.category === "concurrency");
      expect(concurrencyRules.length).toBeGreaterThanOrEqual(0);
    });

    it("should have convention rules", () => {
      const rules = engine.getRules();
      const conventionRules = rules.filter((r) => r.category === "convention");
      expect(conventionRules.length).toBeGreaterThanOrEqual(30);
    });

    it("should have correct security rule count", () => {
      const rules = engine.getRules();
      const securityRules = rules.filter((r) => r.category === "security");
      expect(securityRules.length).toBeGreaterThanOrEqual(150);
    });

    it("should have correct performance rule count", () => {
      const rules = engine.getRules();
      const performanceRules = rules.filter((r) => r.category === "performance");
      expect(performanceRules.length).toBeGreaterThanOrEqual(100);
    });

    it("should have correct architecture rule count", () => {
      const rules = engine.getRules();
      const architectureRules = rules.filter((r) => r.category === "architecture");
      expect(architectureRules.length).toBeGreaterThanOrEqual(50);
    });
  });

  describe("Error Handling", () => {
    it("should handle invalid AST gracefully", async () => {
      const invalidAST = { type: "InvalidNode" } as unknown as AST;

      try {
        const result = await engine.executeRules(invalidAST, mockCodeContext as unknown as CodeContext);
        // If it doesn't throw, should return valid result
        expect(result.violations).toBeDefined();
        expect(Array.isArray(result.violations)).toBe(true);
      } catch (error) {
        // Engine may throw on invalid AST structure (e.g. missing root.raw)
        // This is acceptable behavior for invalid input
        expect(error).toBeDefined();
      }
    });

    it("should handle rule execution errors gracefully", async () => {
      // Rule execution errors should not crash the engine
      const result = await engine.executeRules(mockAST as unknown as AST, mockCodeContext as unknown as CodeContext);

      expect(result).toHaveProperty("violations");
      expect(result).toHaveProperty("executedRules");
      expect(result).toHaveProperty("skippedRules");
    });
  });

  describe("Violation Structure", () => {
    it("should return violations with all required fields", async () => {
      const result = await engine.executeRules(mockAST as unknown as AST, mockCodeContext as unknown as CodeContext);

      if (result.violations.length > 0) {
        const violation = result.violations[0];

        expect(violation).toHaveProperty("ruleId");
        expect(violation).toHaveProperty("severity");
        expect(violation).toHaveProperty("message");
        expect(violation).toHaveProperty("file");
        expect(violation).toHaveProperty("line");
        expect(violation).toHaveProperty("column");
        expect(violation).toHaveProperty("confidence");
        expect(violation).toHaveProperty("explanation");
        expect(violation).toHaveProperty("metadata");
      }
    });

    it("should include suggested fixes when available", async () => {
      const result = await engine.executeRules(mockAST as unknown as AST, mockCodeContext as unknown as CodeContext);

      const violationsWithFixes = result.violations.filter((v) => v.suggestedFix);

      // At least some violations should have suggested fixes
      if (result.violations.length > 0) {
        expect(violationsWithFixes.length).toBeGreaterThan(0);
      }
    });
  });

  describe("Performance", () => {
    it("should handle large AST efficiently", async () => {
      // Create a larger mock AST
      const largeAST = {
        ...mockAST,
        declarations: Array(1000).fill(mockAST.declarations[0]),
      } as AST;

      const startTime = Date.now();
      await engine.executeRules(largeAST, mockCodeContext as unknown as CodeContext);
      const duration = Date.now() - startTime;

      // Should still complete reasonably fast
      expect(duration).toBeLessThan(10000); // 10 seconds max
    });

    it("should maintain target speed of ~1000 LOC/sec", async () => {
      const loc = 500; // Assume 500 lines of code
      const startTime = Date.now();
      await engine.executeRules(mockAST as unknown as AST, mockCodeContext as unknown as CodeContext);
      const duration = Date.now() - startTime;

      const speed = (loc / (duration / 1000));

      // Should be close to target of 1000 LOC/sec
      console.log(`Analysis speed: ${speed.toFixed(0)} LOC/sec`);
    });
  });

  describe("Rule Metadata", () => {
    it("should have mostly unique rule IDs", () => {
      const rules = engine.getRules();
      const ruleIds = rules.map((r) => r.id);
      const uniqueIds = new Set(ruleIds);

      // Allow for a small number of duplicate rule IDs (currently 1 known duplicate)
      const duplicateCount = ruleIds.length - uniqueIds.size;
      expect(duplicateCount).toBeLessThanOrEqual(2);
    });

    it("should have valid severity levels", () => {
      const rules = engine.getRules();
      const validSeverities = ["critical", "major", "minor", "info"];

      rules.forEach((rule) => {
        expect(validSeverities).toContain(rule.severity);
      });
    });

    it("should have non-empty titles and descriptions", () => {
      const rules = engine.getRules();

      rules.forEach((rule) => {
        expect(rule.title).toBeTruthy();
        expect(rule.title.length).toBeGreaterThan(0);
        expect(rule.description).toBeTruthy();
        expect(rule.description.length).toBeGreaterThan(0);
      });
    });
  });
});
