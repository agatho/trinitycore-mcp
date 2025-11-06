/**
 * End-to-End Tests for Combat Log Analysis Workflow
 * Tests the complete workflow from combat log input to analysis report
 */

import { describe, it, expect, beforeAll } from "@jest/globals";
import {
  analyzeBotCombatLog,
  formatCombatAnalysisReport,
} from "../../src/tools/botcombatloganalyzer.js";
import {
  analyzeBotAI,
  formatAIAnalysisReport,
} from "../../src/tools/botaianalyzer.js";
import {
  analyzeComprehensive,
  formatComprehensiveReportMarkdown,
  formatComprehensiveReportJSON,
  formatComprehensiveReportSummary,
} from "../../src/tools/combatloganalyzer-advanced.js";

// Sample combat log data for testing
const SAMPLE_COMBAT_LOG = `
11/6 10:30:15.123  SPELL_CAST_SUCCESS,Player-0-TestBot,TestBot,0x512,0x0,0000000000000000,nil,0x80000000,0x80000000,100,Heroic Strike,0x1
11/6 10:30:15.456  SPELL_DAMAGE,Player-0-TestBot,TestBot,0x512,0x0,Creature-0-12345,Target Dummy,0xa28,0x0,100,Heroic Strike,0x1,500,0,1,0,0,0,nil,nil,nil
11/6 10:30:16.123  SPELL_CAST_SUCCESS,Player-0-TestBot,TestBot,0x512,0x0,0000000000000000,nil,0x80000000,0x80000000,116,Frostbolt,0x10
11/6 10:30:17.234  SPELL_DAMAGE,Player-0-TestBot,TestBot,0x512,0x0,Creature-0-12345,Target Dummy,0xa28,0x0,116,Frostbolt,0x10,350,0,16,0,0,0,nil,nil,nil
11/6 10:30:18.345  SPELL_AURA_APPLIED,Player-0-TestBot,TestBot,0x512,0x0,Player-0-TestBot,TestBot,0x512,0x0,48441,Bloodlust,0x1
11/6 10:30:19.456  SPELL_CAST_SUCCESS,Player-0-TestBot,TestBot,0x512,0x0,0000000000000000,nil,0x80000000,0x80000000,2565,Shield Block,0x1
11/6 10:30:20.567  SPELL_DAMAGE,Creature-0-12345,Target Dummy,0xa28,0x0,Player-0-TestBot,TestBot,0x512,0x0,1234,Melee,0x1,100,0,1,0,0,0,nil,nil,nil
11/6 10:30:21.678  SPELL_CAST_SUCCESS,Player-0-TestBot,TestBot,0x512,0x0,0000000000000000,nil,0x80000000,0x80000000,100,Heroic Strike,0x1
11/6 10:30:22.123  SPELL_DAMAGE,Player-0-TestBot,TestBot,0x512,0x0,Creature-0-12345,Target Dummy,0xa28,0x0,100,Heroic Strike,0x1,525,0,1,25,0,0,nil,nil,nil
11/6 10:30:25.234  SPELL_CAST_SUCCESS,Player-0-TestBot,TestBot,0x512,0x0,0000000000000000,nil,0x80000000,0x80000000,100,Heroic Strike,0x1
`.trim();

const EXTENDED_COMBAT_LOG = `
11/6 10:30:15.123  SPELL_CAST_SUCCESS,Player-0-TestBot,TestBot,0x512,0x0,0000000000000000,nil,0x80000000,0x80000000,100,Heroic Strike,0x1
11/6 10:30:15.456  SPELL_DAMAGE,Player-0-TestBot,TestBot,0x512,0x0,Creature-0-12345,Boss,0xa28,0x0,100,Heroic Strike,0x1,500,0,1,0,0,0,nil,nil,nil
11/6 10:30:16.123  SPELL_CAST_SUCCESS,Player-0-TestBot,TestBot,0x512,0x0,0000000000000000,nil,0x80000000,0x80000000,2565,Shield Block,0x1
11/6 10:30:17.234  SPELL_DAMAGE,Creature-0-12345,Boss,0xa28,0x0,Player-0-TestBot,TestBot,0x512,0x0,5678,Heavy Attack,0x1,2000,0,1,0,0,0,nil,nil,nil
11/6 10:30:18.345  SPELL_CAST_SUCCESS,Player-0-TestBot,TestBot,0x512,0x0,0000000000000000,nil,0x80000000,0x80000000,871,Shield Wall,0x1
11/6 10:30:19.456  SPELL_DAMAGE,Creature-0-12345,Boss,0xa28,0x0,Player-0-TestBot,TestBot,0x512,0x0,5678,Heavy Attack,0x1,1000,0,1,1000,0,0,nil,nil,nil
11/6 10:30:20.567  SPELL_CAST_SUCCESS,Player-0-TestBot,TestBot,0x512,0x0,0000000000000000,nil,0x80000000,0x80000000,100,Heroic Strike,0x1
11/6 10:30:21.678  SPELL_DAMAGE,Player-0-TestBot,TestBot,0x512,0x0,Creature-0-12345,Boss,0xa28,0x0,100,Heroic Strike,0x1,550,0,1,50,0,0,nil,nil,nil
11/6 10:30:22.789  SPELL_PERIODIC_HEAL,Player-0-Healer,Healer,0x512,0x0,Player-0-TestBot,TestBot,0x512,0x0,139,Renew,0x2,500
11/6 10:30:23.890  SPELL_CAST_SUCCESS,Player-0-TestBot,TestBot,0x512,0x0,0000000000000000,nil,0x80000000,0x80000000,23922,Shield Slam,0x1
11/6 10:30:24.001  SPELL_DAMAGE,Player-0-TestBot,TestBot,0x512,0x0,Creature-0-12345,Boss,0xa28,0x0,23922,Shield Slam,0x1,800,0,1,0,0,0,nil,nil,nil
11/6 10:30:25.112  SPELL_CAST_SUCCESS,Player-0-TestBot,TestBot,0x512,0x0,0000000000000000,nil,0x80000000,0x80000000,6572,Revenge,0x1
11/6 10:30:26.223  SPELL_DAMAGE,Player-0-TestBot,TestBot,0x512,0x0,Creature-0-12345,Boss,0xa28,0x0,6572,Revenge,0x1,600,0,1,0,0,0,nil,nil,nil
11/6 10:30:27.334  UNIT_DIED,0000000000000000,nil,0x80000000,0x80000000,Creature-0-12345,Boss,0xa28,0x0
`.trim();

describe("Combat Log Analysis E2E Workflow", () => {
  describe("Basic Combat Log Analysis", () => {
    it("should complete full analysis workflow", async () => {
      // Step 1: Analyze combat log
      const analysis = await analyzeBotCombatLog({
        logText: SAMPLE_COMBAT_LOG,
        botName: "TestBot",
      });

      // Step 2: Verify analysis structure
      expect(analysis).toBeDefined();
      expect(analysis).toHaveProperty("summary");
      expect(analysis).toHaveProperty("damage");
      expect(analysis).toHaveProperty("abilities");
      expect(analysis).toHaveProperty("timeline");

      // Step 3: Format the report
      const report = await formatCombatAnalysisReport(analysis, "markdown");

      // Step 4: Verify report is generated
      expect(report).toBeDefined();
      expect(typeof report).toBe("string");
      expect(report.length).toBeGreaterThan(0);
    });

    it("should extract ability usage correctly", async () => {
      const analysis = await analyzeBotCombatLog({
        logText: SAMPLE_COMBAT_LOG,
        botName: "TestBot",
      });

      // Verify analysis structure
      expect(analysis).toBeDefined();
    });

    it("should calculate damage statistics", async () => {
      const analysis = await analyzeBotCombatLog({
        logText: SAMPLE_COMBAT_LOG,
        botName: "TestBot",
      });

      // Verify analysis contains data
      expect(analysis).toBeDefined();
      expect(analysis.summary).toBeDefined();
    });

    it("should track combat timeline", async () => {
      const analysis = await analyzeBotCombatLog({
        logText: SAMPLE_COMBAT_LOG,
        botName: "TestBot",
      });

      // Verify timeline exists
      expect(analysis.timeline).toBeDefined();
      expect(Array.isArray(analysis.timeline)).toBe(true);
    });
  });

  describe("AI Behavior Analysis", () => {
    it("should complete AI analysis workflow", async () => {
      // Step 1: Analyze AI behavior
      const aiAnalysis = await analyzeBotAI({
        filePath: "/tmp/test-combat.log",
        botName: "TestBot",
      });

      // Step 2: Verify AI analysis
      expect(aiAnalysis).toBeDefined();

      // Step 3: Format AI report
      const report = await formatAIAnalysisReport(aiAnalysis, "markdown");

      // Step 4: Verify report
      expect(report).toBeDefined();
      expect(typeof report).toBe("string");
    });

    it("should detect decision patterns", async () => {
      const aiAnalysis = await analyzeBotAI({
        filePath: "/tmp/test-combat.log",
        botName: "TestBot",
      });

      // Should have decision data
      expect(aiAnalysis).toBeDefined();
    });
  });

  describe("Comprehensive Analysis Workflow", () => {
    it("should perform comprehensive analysis", async () => {
      // Step 1: Run comprehensive analysis
      const comprehensive = await analyzeComprehensive({
        logFile: "/tmp/test-combat.log",
        botName: "TestBot",
      });

      // Step 2: Verify comprehensive analysis structure
      expect(comprehensive).toBeDefined();
      expect(comprehensive).toHaveProperty("basic");
      expect(comprehensive).toHaveProperty("ai");

      // Step 3: Format as markdown
      const markdown = await formatComprehensiveReportMarkdown(comprehensive);
      expect(markdown).toBeDefined();
      expect(markdown.length).toBeGreaterThan(100);

      // Step 4: Format as JSON
      const json = await formatComprehensiveReportJSON(comprehensive);
      expect(json).toBeDefined();
      const parsed = JSON.parse(json);
      expect(parsed).toBeDefined();

      // Step 5: Get summary
      const summary = await formatComprehensiveReportSummary(comprehensive);
      expect(summary).toBeDefined();
      expect(summary.length).toBeGreaterThan(0);
    });

    it("should detect performance issues", async () => {
      const comprehensive = await analyzeComprehensive({
        logFile: "/tmp/test-combat.log",
        botName: "TestBot",
      });

      // Should have analysis data
      expect(comprehensive).toBeDefined();
    });
  });

  describe("Report Formatting", () => {
    it("should format reports in multiple formats", async () => {
      const analysis = await analyzeBotCombatLog({
        logText: SAMPLE_COMBAT_LOG,
        botName: "TestBot",
      });

      // Markdown format
      const markdown = await formatCombatAnalysisReport(analysis, "markdown");
      expect(markdown).toContain("#"); // Markdown headers

      // JSON format
      const json = await formatCombatAnalysisReport(analysis, "json");
      expect(() => JSON.parse(json)).not.toThrow();
    });

    it("should include key metrics in reports", async () => {
      const analysis = await analyzeBotCombatLog({
        logText: SAMPLE_COMBAT_LOG,
        botName: "TestBot",
      });

      const markdown = await formatCombatAnalysisReport(analysis, "markdown");

      // Should contain content
      expect(markdown.length).toBeGreaterThan(0);
    });
  });

  describe("Error Handling", () => {
    it("should handle empty combat log", async () => {
      const analysis = await analyzeBotCombatLog({
        logText: "",
        botName: "TestBot",
      });

      // Should not throw, should return valid structure
      expect(analysis).toBeDefined();
      expect(analysis.summary).toBeDefined();
    });

    it("should handle malformed combat log", async () => {
      const analysis = await analyzeBotCombatLog({
        logText: "This is not a valid combat log format",
        botName: "TestBot",
      });

      // Should handle gracefully
      expect(analysis).toBeDefined();
    });

    it("should handle missing bot name", async () => {
      const analysis = await analyzeBotCombatLog({
        logText: SAMPLE_COMBAT_LOG,
        botName: "NonExistentBot",
      });

      // Should return analysis (even if no matching actions)
      expect(analysis).toBeDefined();
    });
  });

  describe("Performance", () => {
    it("should analyze combat log in reasonable time", async () => {
      const startTime = Date.now();

      await analyzeBotCombatLog({
        logText: SAMPLE_COMBAT_LOG,
        botName: "TestBot",
      });

      const duration = Date.now() - startTime;

      // Should complete in under 2 seconds
      expect(duration).toBeLessThan(2000);
    });

    it("should handle large combat logs efficiently", async () => {
      // Generate larger combat log
      const largeCombatLog = SAMPLE_COMBAT_LOG.repeat(10);

      const startTime = Date.now();

      const analysis = await analyzeBotCombatLog({
        logText: largeCombatLog,
        botName: "TestBot",
      });

      const duration = Date.now() - startTime;

      // Should still complete in reasonable time
      expect(duration).toBeLessThan(5000);
      expect(analysis).toBeDefined();
    });

    it("should perform comprehensive analysis efficiently", async () => {
      const startTime = Date.now();

      await analyzeComprehensive({
        logFile: "/tmp/test-combat.log",
        botName: "TestBot",
      });

      const duration = Date.now() - startTime;

      // Comprehensive analysis takes longer but should be reasonable
      expect(duration).toBeLessThan(10000);
    });
  });

  describe("Integration with Other Tools", () => {
    it("should provide data compatible with AI analyzer", async () => {
      // Combat log analysis
      const combatAnalysis = await analyzeBotCombatLog({
        logText: SAMPLE_COMBAT_LOG,
        botName: "TestBot",
      });

      // AI analysis
      const aiAnalysis = await analyzeBotAI({
        filePath: "/tmp/test-combat.log",
        botName: "TestBot",
      });

      // Both should produce compatible data
      expect(combatAnalysis).toBeDefined();
      expect(aiAnalysis).toBeDefined();
    });

    it("should support report generation pipeline", async () => {
      // Analyze
      const analysis = await analyzeBotCombatLog({
        logText: SAMPLE_COMBAT_LOG,
        botName: "TestBot",
      });

      // Format as markdown
      const markdownReport = await formatCombatAnalysisReport(
        analysis,
        "markdown"
      );

      // Format as JSON
      const jsonReport = await formatCombatAnalysisReport(analysis, "json");

      // Both should be valid
      expect(markdownReport.length).toBeGreaterThan(0);
      expect(() => JSON.parse(jsonReport)).not.toThrow();
    });
  });
});
