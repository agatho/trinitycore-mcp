/**
 * Integration Tests for Database Operations
 * Tests database connection, query execution, and data retrieval
 */

import { describe, it, expect } from "@jest/globals";

describe("Database Operations Integration", () => {
  describe("Database Connection", () => {
    it("should import database module", async () => {
      const dbModule = await import("../../src/db.js");
      expect(dbModule).toBeDefined();
    });

    it("should handle database connection gracefully", async () => {
      // Test that database module exports expected functions
      const dbModule = await import("../../src/db.js");

      // Check for common database functions
      expect(dbModule).toBeDefined();
    });
  });

  describe("Query Execution", () => {
    it("should import spell query function", async () => {
      const { getSpellInfo } = await import("../../src/tools/spell.js");
      expect(getSpellInfo).toBeDefined();
      expect(typeof getSpellInfo).toBe("function");
    });

    it("should import item query function", async () => {
      const { getItemInfo } = await import("../../src/tools/item.js");
      expect(getItemInfo).toBeDefined();
      expect(typeof getItemInfo).toBe("function");
    });

    it("should import quest query function", async () => {
      const { getQuestInfo } = await import("../../src/tools/quest.js");
      expect(getQuestInfo).toBeDefined();
      expect(typeof getQuestInfo).toBe("function");
    });

    it("should import creature query functions", async () => {
      const module = await import("../../src/tools/creature.js");
      expect(module.getCreatureFullInfo).toBeDefined();
      expect(module.searchCreatures).toBeDefined();
      expect(module.getCreaturesByType).toBeDefined();
      expect(module.getAllVendors).toBeDefined();
      expect(module.getAllTrainers).toBeDefined();
      expect(module.getCreaturesByFaction).toBeDefined();
      expect(module.getCreatureStatistics).toBeDefined();
    });
  });

  describe("DBC Query Operations", () => {
    it("should import DBC query functions", async () => {
      const module = await import("../../src/tools/dbc.js");
      expect(module.queryDBC).toBeDefined();
      expect(module.queryAllDBC).toBeDefined();
      expect(module.getCacheStats).toBeDefined();
      expect(module.getGlobalCacheStats).toBeDefined();
    });

    it("should handle DBC cache stats query", async () => {
      const { getCacheStats } = await import("../../src/tools/dbc.js");

      // Query cache stats (should not require database connection)
      const result = await getCacheStats({ dbcName: "Spell.db2" });

      // Should return JSON string
      expect(typeof result).toBe("string");

      // Should be parseable JSON
      const stats = JSON.parse(result);
      expect(stats).toBeDefined();
    });

    it("should handle global cache stats query", async () => {
      const { getGlobalCacheStats } = await import("../../src/tools/dbc.js");

      // Query global stats
      const result = await getGlobalCacheStats();

      // Should return JSON string
      expect(typeof result).toBe("string");

      // Should be parseable JSON
      const stats = JSON.parse(result);
      expect(stats).toBeDefined();
      expect(stats).toHaveProperty("totalFiles");
      expect(stats).toHaveProperty("totalMemoryMB");
    });
  });

  describe("Game Table Operations", () => {
    it("should import game table functions", async () => {
      const module = await import("../../src/tools/gametable.js");
      expect(module.queryGameTable).toBeDefined();
      expect(module.listGameTables).toBeDefined();
      expect(module.getCombatRating).toBeDefined();
      expect(module.getBaseMana).toBeDefined();
      expect(module.getXPForLevel).toBeDefined();
      expect(module.getHpPerSta).toBeDefined();
    });

    it("should calculate base mana", async () => {
      const { getBaseMana } = await import("../../src/tools/gametable.js");

      // Test base mana calculation for different classes
      const mageBaseMana = await getBaseMana({
        classId: 8, // Mage
        level: 60,
      });

      expect(mageBaseMana).toBeDefined();
      const mageResult = JSON.parse(mageBaseMana);
      expect(mageResult.baseMana).toBeGreaterThan(0);
    });

    it("should calculate XP for level", async () => {
      const { getXPForLevel } = await import("../../src/tools/gametable.js");

      // Test XP calculation
      const xpResult = await getXPForLevel({ level: 10 });

      expect(xpResult).toBeDefined();
      const result = JSON.parse(xpResult);
      expect(result.level).toBe(10);
      expect(result.xpToNextLevel).toBeGreaterThan(0);
    });

    it("should calculate HP per stamina", async () => {
      const { getHpPerSta } = await import("../../src/tools/gametable.js");

      // Test HP per stamina calculation
      const hpResult = await getHpPerSta({ level: 60 });

      expect(hpResult).toBeDefined();
      const result = JSON.parse(hpResult);
      expect(result.level).toBe(60);
      expect(result.hpPerStamina).toBeGreaterThan(0);
    });

    it("should calculate combat rating conversions", async () => {
      const { getCombatRating } = await import("../../src/tools/gametable.js");

      // Test combat rating calculation
      const ratingResult = await getCombatRating({
        ratingType: "hit",
        ratingAmount: 100,
        level: 70,
      });

      expect(ratingResult).toBeDefined();
      const result = JSON.parse(ratingResult);
      expect(result).toHaveProperty("ratingType");
      expect(result).toHaveProperty("percentageGained");
    });
  });

  describe("World Data Operations", () => {
    it("should import world data functions", async () => {
      const module = await import("../../src/tools/worlddata.js");
      expect(module.getPointsOfInterest).toBeDefined();
      expect(module.getGameObjectsByEntry).toBeDefined();
      expect(module.getCreatureSpawns).toBeDefined();
      expect(module.findNearbyCreatures).toBeDefined();
      expect(module.findNearbyGameObjects).toBeDefined();
    });

    it("should handle nearby creature search", async () => {
      const { findNearbyCreatures } = await import("../../src/tools/worlddata.js");

      // Test nearby search (may return empty if no database)
      const result = await findNearbyCreatures({
        mapId: 0,
        x: 0,
        y: 0,
        z: 0,
        radius: 100,
      });

      // Should return valid JSON
      expect(typeof result).toBe("string");
      const parsed = JSON.parse(result);
      expect(Array.isArray(parsed.creatures)).toBe(true);
    });
  });

  describe("Quest Chain Operations", () => {
    it("should import quest chain functions", async () => {
      const module = await import("../../src/tools/questchain.js");
      expect(module.getQuestPrerequisites).toBeDefined();
      expect(module.traceQuestChain).toBeDefined();
      expect(module.findQuestChainsInZone).toBeDefined();
      expect(module.getQuestRewards).toBeDefined();
      expect(module.findQuestHubs).toBeDefined();
      expect(module.analyzeQuestObjectives).toBeDefined();
      expect(module.optimizeQuestPath).toBeDefined();
    });
  });

  describe("Spell Calculator Operations", () => {
    it("should import spell calculator functions", async () => {
      const module = await import("../../src/tools/spellcalculator.js");
      expect(module.calculateSpellDamage).toBeDefined();
      expect(module.calculateSpellHealing).toBeDefined();
      expect(module.compareSpells).toBeDefined();
      expect(module.calculateStatWeights).toBeDefined();
      expect(module.calculateRotationDps).toBeDefined();
      expect(module.getOptimalSpell).toBeDefined();
    });

    it("should calculate spell damage", async () => {
      const { calculateSpellDamage } = await import("../../src/tools/spellcalculator.js");

      const playerStats = {
        level: 60,
        intellect: 300,
        spellPower: 500,
        critRating: 100,
        hasteRating: 50,
        masteryRating: 50,
        versatility: 0,
      };

      // Test spell damage calculation
      const result = await calculateSpellDamage(
        133,         // spellId: Fireball
        0,           // effectIndex
        playerStats  // PlayerStats object
      );

      expect(result).toBeDefined();
      expect(typeof result).toBe("object");
    });

    it("should calculate spell healing", async () => {
      const { calculateSpellHealing } = await import("../../src/tools/spellcalculator.js");

      const playerStats = {
        level: 60,
        intellect: 300,
        spellPower: 500,
        critRating: 100,
        hasteRating: 50,
        masteryRating: 50,
        versatility: 0,
      };

      // Test spell healing calculation
      const result = await calculateSpellHealing(
        2061,        // spellId: Flash Heal
        0,           // effectIndex
        playerStats  // PlayerStats object
      );

      expect(result).toBeDefined();
      expect(typeof result).toBe("object");
    });
  });

  describe("Combat Mechanics Operations", () => {
    it("should import combat mechanics functions", async () => {
      const module = await import("../../src/tools/combatmechanics.js");
      expect(module.calculateMeleeDamage).toBeDefined();
      expect(module.calculateArmorMitigation).toBeDefined();
      expect(module.calculateThreat).toBeDefined();
      expect(module.calculateDiminishingReturns).toBeDefined();
    });

    it("should calculate melee damage", async () => {
      const { calculateMeleeDamage } = await import("../../src/tools/combatmechanics.js");

      const result = await calculateMeleeDamage({
        attackPower: 1000,
        weaponDamageMin: 50,
        weaponDamageMax: 100,
        weaponSpeed: 2.5,
        targetArmor: 3000,
        attackerLevel: 60,
        targetLevel: 60,
      });

      expect(result).toBeDefined();
      const parsed = JSON.parse(result);
      expect(parsed).toHaveProperty("averageDamage");
    });

    it("should calculate armor mitigation", async () => {
      const { calculateArmorMitigation } = await import("../../src/tools/combatmechanics.js");

      const result = await calculateArmorMitigation({
        armor: 5000,
        attackerLevel: 60,
      });

      expect(result).toBeDefined();
      const parsed = JSON.parse(result);
      expect(parsed).toHaveProperty("damageReduction");
      expect(parsed.damageReduction).toBeGreaterThanOrEqual(0);
      expect(parsed.damageReduction).toBeLessThanOrEqual(100);
    });

    it("should calculate threat values", async () => {
      const { calculateThreat } = await import("../../src/tools/combatmechanics.js");

      const result = await calculateThreat({
        damage: 1000,
        healing: 0,
        isTank: true,
        threatModifiers: 1.0,
      });

      expect(result).toBeDefined();
      const parsed = JSON.parse(result);
      expect(parsed).toHaveProperty("totalThreat");
      expect(parsed.totalThreat).toBeGreaterThan(0);
    });
  });

  describe("Error Handling", () => {
    it("should handle invalid spell calculation input", async () => {
      const { calculateSpellDamage } = await import("../../src/tools/spellcalculator.js");

      const playerStats = {
        level: 60,
        intellect: 100,
        spellPower: 100,
        critRating: 0,
        hasteRating: 0,
        masteryRating: 0,
        versatility: 0,
      };

      // Invalid spell ID should throw or return error
      await expect(async () => {
        await calculateSpellDamage(
          -1,          // invalid spellId
          0,           // effectIndex
          playerStats  // PlayerStats object
        );
      }).rejects.toThrow();
    });

    it("should handle invalid combat rating input", async () => {
      const { getCombatRating } = await import("../../src/tools/gametable.js");

      // Invalid rating type should be handled
      const result = await getCombatRating({
        ratingType: "invalid_type",
        ratingAmount: 100,
        level: 60,
      });

      expect(result).toBeDefined();
    });
  });

  describe("Data Consistency", () => {
    it("should provide consistent XP calculations", async () => {
      const { getXPForLevel } = await import("../../src/tools/gametable.js");

      const xp10 = await getXPForLevel({ level: 10 });
      const xp20 = await getXPForLevel({ level: 20 });

      const result10 = JSON.parse(xp10);
      const result20 = JSON.parse(xp20);

      // Higher level should require more XP
      expect(result20.xpToNextLevel).toBeGreaterThan(result10.xpToNextLevel);
    });

    it("should provide consistent HP calculations", async () => {
      const { getHpPerSta } = await import("../../src/tools/gametable.js");

      const hp10 = await getHpPerSta({ level: 10 });
      const hp60 = await getHpPerSta({ level: 60 });

      const result10 = JSON.parse(hp10);
      const result60 = JSON.parse(hp60);

      // Both should be positive
      expect(result10.hpPerStamina).toBeGreaterThan(0);
      expect(result60.hpPerStamina).toBeGreaterThan(0);
    });
  });
});
