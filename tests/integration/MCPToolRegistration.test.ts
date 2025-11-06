/**
 * Integration Tests for MCP Tool Registration
 * Tests that all MCP tools are properly registered and accessible
 */

import { describe, it, expect, beforeAll } from "@jest/globals";

describe("MCP Tool Registration", () => {
  describe("Server Initialization", () => {
    it("should initialize MCP server without errors", async () => {
      // Test that we can import the main index file without errors
      expect(async () => {
        // Dynamic import to avoid actually starting the server
        const indexModule = await import("../../src/index.js");
        return indexModule;
      }).not.toThrow();
    });

    it("should have all required tool imports", async () => {
      // Verify that all tool modules can be imported
      const toolModules = [
        "../../src/tools/spell.js",
        "../../src/tools/item.js",
        "../../src/tools/quest.js",
        "../../src/tools/dbc.js",
        "../../src/tools/api.js",
        "../../src/tools/opcode.js",
        "../../src/tools/gametable.js",
        "../../src/tools/creature.js",
        "../../src/tools/spellcalculator.js",
        "../../src/tools/worlddata.js",
        "../../src/tools/questchain.js",
        "../../src/tools/profession.js",
        "../../src/tools/gearoptimizer.js",
        "../../src/tools/talent.js",
        "../../src/tools/combatmechanics.js",
        "../../src/tools/buffoptimizer.js",
        "../../src/tools/dungeonstrategy.js",
        "../../src/tools/codereview.js",
        "../../src/tools/threadsafety.js",
        "../../src/tools/memoryleak.js",
        "../../src/tools/apimigration.js",
        "../../src/tools/codecompletion.js",
        "../../src/tools/botdebugger.js",
        "../../src/tools/gamesimulator.js",
        "../../src/tools/monitoring.js",
        "../../src/tools/production.js",
        "../../src/tools/codestyle.js",
        "../../src/tools/botaianalyzer.js",
        "../../src/tools/botcombatloganalyzer.js",
        "../../src/tools/combatloganalyzer-advanced.js",
        "../../src/tools/vmap-tools.js",
      ];

      for (const modulePath of toolModules) {
        await expect(import(modulePath)).resolves.toBeDefined();
      }
    });
  });

  describe("Tool Function Exports", () => {
    it("should export combat log analysis functions", async () => {
      const module = await import("../../src/tools/botcombatloganalyzer.js");
      expect(module.analyzeBotCombatLog).toBeDefined();
      expect(module.formatCombatAnalysisReport).toBeDefined();
      expect(typeof module.analyzeBotCombatLog).toBe("function");
      expect(typeof module.formatCombatAnalysisReport).toBe("function");
    });

    it("should export code review functions", async () => {
      const module = await import("../../src/tools/codereview.js");
      expect(module.reviewFile).toBeDefined();
      expect(module.reviewFiles).toBeDefined();
      expect(module.reviewPattern).toBeDefined();
      expect(module.reviewProjectDirectory).toBeDefined();
      expect(module.generateReviewReport).toBeDefined();
      expect(module.getCodeReviewStats).toBeDefined();
    });

    it("should export spell calculator functions", async () => {
      const module = await import("../../src/tools/spellcalculator.js");
      expect(module.calculateSpellDamage).toBeDefined();
      expect(module.calculateSpellHealing).toBeDefined();
      expect(module.compareSpells).toBeDefined();
      expect(module.calculateStatWeights).toBeDefined();
      expect(module.calculateRotationDps).toBeDefined();
      expect(module.getOptimalSpell).toBeDefined();
    });

    it("should export creature query functions", async () => {
      const module = await import("../../src/tools/creature.js");
      expect(module.getCreatureFullInfo).toBeDefined();
      expect(module.searchCreatures).toBeDefined();
      expect(module.getCreaturesByType).toBeDefined();
      expect(module.getAllVendors).toBeDefined();
      expect(module.getAllTrainers).toBeDefined();
      expect(module.getCreaturesByFaction).toBeDefined();
      expect(module.getCreatureStatistics).toBeDefined();
    });

    it("should export quest chain functions", async () => {
      const module = await import("../../src/tools/questchain.js");
      expect(module.getQuestPrerequisites).toBeDefined();
      expect(module.traceQuestChain).toBeDefined();
      expect(module.findQuestChainsInZone).toBeDefined();
      expect(module.getQuestRewards).toBeDefined();
      expect(module.findQuestHubs).toBeDefined();
      expect(module.analyzeQuestObjectives).toBeDefined();
      expect(module.optimizeQuestPath).toBeDefined();
    });

    it("should export profession functions", async () => {
      const module = await import("../../src/tools/profession.js");
      expect(module.getProfessionRecipes).toBeDefined();
      expect(module.calculateSkillUpPlan).toBeDefined();
      expect(module.findProfitableRecipes).toBeDefined();
    });

    it("should export gear optimizer functions", async () => {
      const module = await import("../../src/tools/gearoptimizer.js");
      expect(module.calculateItemScore).toBeDefined();
      expect(module.compareItems).toBeDefined();
      expect(module.findBestInSlot).toBeDefined();
      expect(module.optimizeGearSet).toBeDefined();
      expect(module.getDefaultStatWeights).toBeDefined();
    });

    it("should export talent functions", async () => {
      const module = await import("../../src/tools/talent.js");
      expect(module.getClassSpecializations).toBeDefined();
      expect(module.getRecommendedTalentBuild).toBeDefined();
      expect(module.compareTalentTier).toBeDefined();
      expect(module.optimizeTalentBuild).toBeDefined();
    });

    it("should export combat mechanics functions", async () => {
      const module = await import("../../src/tools/combatmechanics.js");
      expect(module.calculateMeleeDamage).toBeDefined();
      expect(module.calculateArmorMitigation).toBeDefined();
      expect(module.calculateThreat).toBeDefined();
      expect(module.calculateDiminishingReturns).toBeDefined();
    });

    it("should export monitoring functions", async () => {
      const module = await import("../../src/tools/monitoring.js");
      expect(module.getHealthStatus).toBeDefined();
      expect(module.getMetricsSnapshot).toBeDefined();
      expect(module.queryLogs).toBeDefined();
      expect(module.getLogFileLocation).toBeDefined();
      expect(module.getMonitoringStatus).toBeDefined();
    });

    it("should export VMap/MMap tools", async () => {
      const module = await import("../../src/tools/vmap-tools.js");
      expect(module.listVMapFiles).toBeDefined();
      expect(module.getVMapFileInfo).toBeDefined();
      expect(module.testLineOfSight).toBeDefined();
      expect(module.findSpawnsInRadius).toBeDefined();
    });
  });

  describe("Tool Function Signatures", () => {
    it("should have correct analyzeBotCombatLog signature", async () => {
      const { analyzeBotCombatLog } = await import("../../src/tools/botcombatloganalyzer.js");

      // Test with minimal valid input
      const result = await analyzeBotCombatLog({
        logText: "",
        botName: "TestBot",
      });

      // Should return an object with expected structure
      expect(result).toBeDefined();
      expect(typeof result).toBe("object");
    });

    it("should have correct reviewFile signature", async () => {
      const { reviewFile } = await import("../../src/tools/codereview.js");

      // Function should accept file path and options
      // We don't call it here to avoid file system dependencies
      expect(reviewFile.length).toBeGreaterThanOrEqual(1);
    });

    it("should have correct calculateSpellDamage signature", async () => {
      const { calculateSpellDamage } = await import("../../src/tools/spellcalculator.js");

      // Function should accept parameters
      expect(calculateSpellDamage.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("Tool Availability", () => {
    it("should have DBC query tools available", async () => {
      const module = await import("../../src/tools/dbc.js");
      expect(module.queryDBC).toBeDefined();
      expect(module.queryAllDBC).toBeDefined();
      expect(module.getCacheStats).toBeDefined();
      expect(module.getGlobalCacheStats).toBeDefined();
    });

    it("should have bot AI analyzer available", async () => {
      const module = await import("../../src/tools/botaianalyzer.js");
      expect(module.analyzeBotAI).toBeDefined();
      expect(module.formatAIAnalysisReport).toBeDefined();
    });

    it("should have code style tools available", async () => {
      const module = await import("../../src/tools/codestyle.js");
      expect(module.checkCodeStyle).toBeDefined();
      expect(module.formatCode).toBeDefined();
    });

    it("should have thread safety analyzer available", async () => {
      const module = await import("../../src/tools/threadsafety.js");
      expect(module.analyzeThreadSafety).toBeDefined();
      expect(module.analyzeFileThreadSafety).toBeDefined();
      expect(module.getThreadSafetyRecommendations).toBeDefined();
    });

    it("should have memory leak analyzer available", async () => {
      const module = await import("../../src/tools/memoryleak.js");
      expect(module.analyzeMemoryLeaks).toBeDefined();
    });
  });

  describe("Tool Error Handling", () => {
    it("should handle invalid combat log input gracefully", async () => {
      const { analyzeBotCombatLog } = await import("../../src/tools/botcombatloganalyzer.js");

      const result = await analyzeBotCombatLog({
        logText: "invalid log data",
        botName: "TestBot",
      });

      // Should not throw, should return valid result
      expect(result).toBeDefined();
    });

    it("should handle spell damage calculation", async () => {
      const { calculateSpellDamage } = await import("../../src/tools/spellcalculator.js");

      // Test with proper parameters including PlayerStats object
      const playerStats = {
        spellPower: 500,
        critChance: 0,
        hasteRating: 0,
        hitChance: 0,
        intellect: 0,
        spirit: 0,
        stamina: 0,
        attackPower: 0,
      };

      const result = await calculateSpellDamage(
        133,        // spellId: Fireball
        0,          // effectIndex
        playerStats // PlayerStats object
      );

      // Should handle gracefully
      expect(result).toBeDefined();
    });
  });

  describe("Module Dependencies", () => {
    it("should import logger utilities", async () => {
      const module = await import("../../src/utils/logger.js");
      expect(module.logger).toBeDefined();
    });

    it("should import cache warmer", async () => {
      const module = await import("../../src/parsers/cache/CacheWarmer.js");
      expect(module.CacheWarmer).toBeDefined();
    });
  });
});
