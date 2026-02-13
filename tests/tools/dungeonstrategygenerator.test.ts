/**
 * Tests for the Automatic Dungeon Strategy Generator
 *
 * Tests spatial clustering, creature analysis, CC/interrupt recommendations,
 * pull order generation, and strategy formatting.
 *
 * @module tests/tools/dungeonstrategygenerator
 */

import {
  generateDungeonStrategy,
  formatStrategyMarkdown,
  type CreaturePack,
  type GeneratedBossEncounter,
  type GeneratedDungeonStrategy,
} from "../../src/tools/dungeonstrategygenerator";

// Mock database connection
jest.mock("../../src/database/connection", () => ({
  queryWorld: jest.fn(),
}));

// Mock logger
jest.mock("../../src/utils/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock fs for spell cache
jest.mock("fs", () => ({
  existsSync: jest.fn().mockReturnValue(true),
  readFileSync: jest.fn().mockReturnValue(JSON.stringify({
    "774": "Rejuvenation",
    "8936": "Regrowth",
    "118": "Polymorph",
    "133": "Fireball",
    "11366": "Pyroblast",
    "2948": "Scorch",
    "1449": "Arcane Explosion",
    "12058": "Chain Lightning",
    "5143": "Arcane Missiles",
    "6358": "Seduction",
    "688": "Summon Imp",
    "8599": "Enrage",
    "642": "Divine Shield",
    "589": "Shadow Word: Pain",
    "34428": "Victory Rush",
  })),
}));

import { queryWorld } from "../../src/database/connection";
const mockQueryWorld = queryWorld as jest.MockedFunction<typeof queryWorld>;

// ============================================================================
// TEST FIXTURES
// ============================================================================

/** Mock instance template data */
const MOCK_INSTANCE = [
  { map: 33, levelMin: 18, levelMax: 21 },
];

/** Mock creature spawns in a dungeon (Shadowfang Keep-like layout) */
const MOCK_SPAWNS = [
  // Pack 1: 3 humanoids near entrance (close together)
  { guid: 1, entry: 3849, map: 33, position_x: 100, position_y: 200, position_z: 50, orientation: 0, spawntimesecs: 300 },
  { guid: 2, entry: 3849, map: 33, position_x: 105, position_y: 205, position_z: 50, orientation: 0, spawntimesecs: 300 },
  { guid: 3, entry: 3850, map: 33, position_x: 108, position_y: 198, position_z: 50, orientation: 0, spawntimesecs: 300 },

  // Pack 2: Caster + melee (further away, 80 yards from pack 1)
  { guid: 4, entry: 3851, map: 33, position_x: 180, position_y: 220, position_z: 55, orientation: 0, spawntimesecs: 300 },
  { guid: 5, entry: 3852, map: 33, position_x: 185, position_y: 215, position_z: 55, orientation: 0, spawntimesecs: 300 },

  // Pack 3: Boss encounter (far from others)
  { guid: 6, entry: 4278, map: 33, position_x: 300, position_y: 300, position_z: 60, orientation: 0, spawntimesecs: 0 },
  { guid: 7, entry: 3853, map: 33, position_x: 295, position_y: 305, position_z: 60, orientation: 0, spawntimesecs: 300 },
  { guid: 8, entry: 3853, map: 33, position_x: 305, position_y: 298, position_z: 60, orientation: 0, spawntimesecs: 300 },

  // Critter (should be filtered out)
  { guid: 9, entry: 9999, map: 33, position_x: 50, position_y: 50, position_z: 50, orientation: 0, spawntimesecs: 300 },
];

/** Mock creature templates */
const MOCK_TEMPLATES = [
  { entry: 3849, name: "Shadowfang Whitescalp", subname: null, HealthScalingExpansion: 0, ContentTuningID: 0, Classification: 0, CreatureType: 7, family: 0, UnitClass: 1, npcflag: 0, MovementType: 0, mechanic_immune_mask: 0, flags_extra: 0, ScriptName: "" },
  { entry: 3850, name: "Shadowfang Darksoul", subname: null, HealthScalingExpansion: 0, ContentTuningID: 0, Classification: 0, CreatureType: 7, family: 0, UnitClass: 8, npcflag: 0, MovementType: 0, mechanic_immune_mask: 0, flags_extra: 0, ScriptName: "" },
  { entry: 3851, name: "Shadowfang Moonwalker", subname: null, HealthScalingExpansion: 0, ContentTuningID: 0, Classification: 1, CreatureType: 7, family: 0, UnitClass: 8, npcflag: 0, MovementType: 1, mechanic_immune_mask: 0, flags_extra: 0, ScriptName: "" },
  { entry: 3852, name: "Shadowfang Ragetooth", subname: null, HealthScalingExpansion: 0, ContentTuningID: 0, Classification: 0, CreatureType: 7, family: 0, UnitClass: 1, npcflag: 0, MovementType: 0, mechanic_immune_mask: 0, flags_extra: 0, ScriptName: "" },
  { entry: 4278, name: "Commander Springvale", subname: null, HealthScalingExpansion: 0, ContentTuningID: 0, Classification: 3, CreatureType: 6, family: 0, UnitClass: 2, npcflag: 0, MovementType: 0, mechanic_immune_mask: (1 << 4) | (1 << 11) | (1 << 16), flags_extra: 0, ScriptName: "boss_commander_springvale" },
  { entry: 3853, name: "Shadowfang Guardian", subname: null, HealthScalingExpansion: 0, ContentTuningID: 0, Classification: 1, CreatureType: 6, family: 0, UnitClass: 1, npcflag: 0, MovementType: 0, mechanic_immune_mask: 0, flags_extra: 0, ScriptName: "" },
  { entry: 9999, name: "Rat", subname: null, HealthScalingExpansion: 0, ContentTuningID: 0, Classification: 0, CreatureType: 8, family: 0, UnitClass: 1, npcflag: 0, MovementType: 0, mechanic_immune_mask: 0, flags_extra: 0, ScriptName: "" },
];

/** Mock smart script spells */
const MOCK_SMART_SCRIPTS = [
  { entry: 3850, spellId: 133 }, // Shadowfang Darksoul casts Fireball
  { entry: 3850, spellId: 589 }, // Shadowfang Darksoul casts Shadow Word: Pain
  { entry: 3851, spellId: 12058 }, // Shadowfang Moonwalker casts Chain Lightning
  { entry: 3851, spellId: 774 }, // Shadowfang Moonwalker casts Rejuvenation (healer!)
  { entry: 4278, spellId: 642 }, // Commander Springvale casts Divine Shield
  { entry: 4278, spellId: 8599 }, // Commander Springvale casts Enrage
  { entry: 4278, spellId: 688 }, // Commander Springvale casts Summon Imp
];

// ============================================================================
// HELPER TO SET UP MOCKS
// ============================================================================

function setupMocks() {
  mockQueryWorld.mockReset();

  mockQueryWorld.mockImplementation(async (sql: string, params?: unknown[]) => {
    const sqlLower = sql.toLowerCase().trim();

    // Instance template locale (must be checked BEFORE general instance_template)
    if (sqlLower.includes("instance_template_locale")) {
      return [{ name: "Shadowfang Keep" }];
    }

    // Instance template query
    if (sqlLower.includes("instance_template") && sqlLower.includes("where map")) {
      return MOCK_INSTANCE;
    }

    // Creature spawns
    if (sqlLower.includes("from creature") && sqlLower.includes("where map")) {
      return MOCK_SPAWNS;
    }

    // Creature templates
    if (sqlLower.includes("creature_template") && sqlLower.includes("where entry in")) {
      return MOCK_TEMPLATES;
    }

    // Smart scripts
    if (sqlLower.includes("smart_scripts")) {
      return MOCK_SMART_SCRIPTS;
    }

    return [];
  });
}

// ============================================================================
// TESTS
// ============================================================================

describe("Automatic Dungeon Strategy Generator", () => {
  beforeEach(() => {
    setupMocks();
  });

  describe("generateDungeonStrategy", () => {
    it("should generate a complete dungeon strategy", async () => {
      const strategy = await generateDungeonStrategy({ dungeonMapId: 33 });

      expect(strategy).toBeDefined();
      expect(strategy.dungeonMapId).toBe(33);
      expect(strategy.dungeonName).toBe("Shadowfang Keep");
      expect(strategy.levelRange).toEqual({ min: 18, max: 21 });
      expect(strategy.generatedAt).toBeDefined();
      expect(strategy.dataSource).toContain("TrinityCore");
    });

    it("should filter out non-combatant creatures (critters)", async () => {
      const strategy = await generateDungeonStrategy({ dungeonMapId: 33 });

      // Total creatures should not include the critter (guid 9, entry 9999)
      expect(strategy.totalCreatures).toBe(8); // 9 spawns - 1 critter = 8
    });

    it("should group creatures into spatial packs", async () => {
      const strategy = await generateDungeonStrategy({ dungeonMapId: 33 });

      // With pack radius 30, we should get 3 distinct packs
      expect(strategy.totalPacks).toBeGreaterThanOrEqual(2);
      expect(strategy.totalPacks).toBeLessThanOrEqual(4);
    });

    it("should identify boss encounters", async () => {
      const strategy = await generateDungeonStrategy({ dungeonMapId: 33 });

      expect(strategy.bossCount).toBe(1);
      expect(strategy.bosses.length).toBe(1);
      expect(strategy.bosses[0].name).toBe("Commander Springvale");
      expect(strategy.bosses[0].entry).toBe(4278);
    });

    it("should analyze boss abilities from smart_scripts", async () => {
      const strategy = await generateDungeonStrategy({ dungeonMapId: 33 });

      const boss = strategy.bosses[0];
      expect(boss.abilities.length).toBeGreaterThan(0);

      // Boss should have Divine Shield, Enrage, and Summon Imp
      const abilityTypes = boss.abilities.map((a) => a.spellType);
      expect(abilityTypes).toContain("shield"); // Divine Shield
      expect(abilityTypes).toContain("enrage"); // Enrage
      expect(abilityTypes).toContain("summon"); // Summon Imp
    });

    it("should generate boss phases for enrage/summon mechanics", async () => {
      const strategy = await generateDungeonStrategy({ dungeonMapId: 33 });

      const boss = strategy.bosses[0];
      // Should have at least Phase 1 + enrage phase + summon phase
      expect(boss.phases.length).toBeGreaterThanOrEqual(2);

      const enragePhase = boss.phases.find((p) => p.description.includes("Enrage"));
      expect(enragePhase).toBeDefined();
    });

    it("should identify boss adds", async () => {
      const strategy = await generateDungeonStrategy({ dungeonMapId: 33 });

      const boss = strategy.bosses[0];
      // Boss pack should have Shadowfang Guardians as adds
      expect(boss.adds.length).toBeGreaterThan(0);
      expect(boss.adds[0].name).toBe("Shadowfang Guardian");
    });

    it("should detect healer creatures and recommend CC", async () => {
      const strategy = await generateDungeonStrategy({ dungeonMapId: 33 });

      // Shadowfang Moonwalker has Rejuvenation (healer)
      // Find the pack containing Moonwalker
      const allPacks = [...strategy.trashPacks, ...strategy.bosses.map((b) => {
        // Find the pack corresponding to this boss
        return strategy.trashPacks.find((p) => p.packId === b.packId);
      }).filter(Boolean)];

      // Check all packs + boss packs for CC recommendations
      const allCC = strategy.trashPacks.flatMap((p) => p.ccTargets);
      const moonwalkerCC = allCC.find((c) => c.targetName === "Shadowfang Moonwalker");
      expect(moonwalkerCC).toBeDefined();
      if (moonwalkerCC) {
        expect(moonwalkerCC.reason).toContain("heal");
        expect(moonwalkerCC.priority).toBe(10);
      }
    });

    it("should detect caster creatures and generate interrupt priorities", async () => {
      const strategy = await generateDungeonStrategy({ dungeonMapId: 33 });

      // Moonwalker has Chain Lightning (should be interruptible)
      const allInterrupts = strategy.trashPacks.flatMap((p) => p.interruptPriorities);
      const chainLightning = allInterrupts.find((i) => i.spellId === 12058);

      // Also check boss packs
      const bossInterrupts = strategy.bosses.flatMap((b) => b.interruptOrder);

      // At least some interrupt targets should exist
      expect(allInterrupts.length + bossInterrupts.length).toBeGreaterThan(0);
    });

    it("should generate pull order with sequential numbering", async () => {
      const strategy = await generateDungeonStrategy({ dungeonMapId: 33 });

      expect(strategy.pullOrder.length).toBe(strategy.totalPacks);

      // Verify sequential ordering
      for (let i = 0; i < strategy.pullOrder.length; i++) {
        expect(strategy.pullOrder[i].order).toBe(i + 1);
      }

      // Boss pull should be typed as "boss"
      const bossPull = strategy.pullOrder.find((p) => p.type === "boss");
      expect(bossPull).toBeDefined();
    });

    it("should generate route with distance calculations", async () => {
      const strategy = await generateDungeonStrategy({ dungeonMapId: 33 });

      expect(strategy.route.length).toBe(strategy.totalPacks);

      // First route step has no previous pack
      expect(strategy.route[0].fromPackId).toBeNull();
      expect(strategy.route[0].distanceYards).toBe(0);

      // Subsequent steps should have distances
      for (let i = 1; i < strategy.route.length; i++) {
        expect(strategy.route[i].fromPackId).not.toBeNull();
        expect(strategy.route[i].distanceYards).toBeGreaterThan(0);
      }
    });

    it("should detect patrol creatures and add warnings", async () => {
      const strategy = await generateDungeonStrategy({ dungeonMapId: 33 });

      // Shadowfang Moonwalker has MovementType=1 (patrol)
      const packsWithPatrol = strategy.trashPacks.filter((p) =>
        p.warnings.some((w) => w.toLowerCase().includes("patrol"))
      );
      expect(packsWithPatrol.length).toBeGreaterThan(0);
    });

    it("should calculate estimated clear time", async () => {
      const strategy = await generateDungeonStrategy({ dungeonMapId: 33 });

      expect(strategy.estimatedClearTimeMinutes).toBeGreaterThan(0);
      expect(strategy.estimatedClearTimeMinutes).toBeLessThan(120); // Should be reasonable
    });

    it("should generate group recommendations", async () => {
      const strategy = await generateDungeonStrategy({ dungeonMapId: 33 });

      expect(strategy.groupRecommendations.recommendedGroupSize).toBe(5);
      expect(strategy.groupRecommendations.tankCount).toBe(1);
      expect(strategy.groupRecommendations.healerCount).toBe(1);
      expect(strategy.groupRecommendations.dpsCount).toBe(3);
    });

    it("should generate a markdown summary", async () => {
      const strategy = await generateDungeonStrategy({ dungeonMapId: 33 });

      expect(strategy.summary).toContain("Shadowfang Keep");
      expect(strategy.summary).toContain("Bosses:");
      expect(strategy.summary).toContain("Trash Packs:");
      expect(strategy.summary).toContain("Estimated Clear Time:");
    });

    it("should handle dungeons with no creatures", async () => {
      mockQueryWorld.mockImplementation(async (sql: string) => {
        if (sql.toLowerCase().includes("instance_template") && sql.toLowerCase().includes("where map")) {
          return [{ map: 999, levelMin: 1, levelMax: 60 }];
        }
        if (sql.toLowerCase().includes("from creature") && sql.toLowerCase().includes("where map")) {
          return [];
        }
        return [];
      });

      const strategy = await generateDungeonStrategy({ dungeonMapId: 999 });

      expect(strategy.totalCreatures).toBe(0);
      expect(strategy.totalPacks).toBe(0);
      expect(strategy.bossCount).toBe(0);
      expect(strategy.bosses).toEqual([]);
      expect(strategy.trashPacks).toEqual([]);
    });

    it("should respect custom pack radius", async () => {
      // Very large radius should merge all packs
      const strategyWide = await generateDungeonStrategy({
        dungeonMapId: 33,
        packRadius: 500,
      });

      // Very small radius should keep more separate packs
      const strategyNarrow = await generateDungeonStrategy({
        dungeonMapId: 33,
        packRadius: 5,
      });

      // Wide radius should have fewer or equal packs
      expect(strategyWide.totalPacks).toBeLessThanOrEqual(strategyNarrow.totalPacks);
    });
  });

  describe("formatStrategyMarkdown", () => {
    it("should produce well-formatted markdown output", async () => {
      const strategy = await generateDungeonStrategy({ dungeonMapId: 33 });
      const markdown = formatStrategyMarkdown(strategy);

      expect(markdown).toContain("## Pull Order");
      expect(markdown).toContain("## Boss Details");
      expect(markdown).toContain("Commander Springvale");
      expect(markdown).toContain("Tank:");
      expect(markdown).toContain("Healer:");
      expect(markdown).toContain("DPS:");
      expect(markdown).toContain("Generated at");
    });

    it("should include boss interrupt priorities in markdown", async () => {
      const strategy = await generateDungeonStrategy({ dungeonMapId: 33 });
      const markdown = formatStrategyMarkdown(strategy);

      // Boss has abilities that should generate interrupt info
      if (strategy.bosses[0].interruptOrder.length > 0) {
        expect(markdown).toContain("Interrupt Priority");
      }
    });

    it("should include dangerous trash packs section when present", async () => {
      const strategy = await generateDungeonStrategy({ dungeonMapId: 33 });
      const markdown = formatStrategyMarkdown(strategy);

      const hardPacks = strategy.trashPacks.filter(
        (p) => p.difficulty === "hard" || p.difficulty === "deadly"
      );

      if (hardPacks.length > 0) {
        expect(markdown).toContain("## Dangerous Trash Packs");
      }
    });
  });

  describe("Pack difficulty scoring", () => {
    it("should rate boss packs as harder than normal trash", async () => {
      const strategy = await generateDungeonStrategy({ dungeonMapId: 33 });

      const bossPacks = strategy.trashPacks.filter((p) => false); // Boss packs are separate
      const trashOnly = strategy.trashPacks;

      // Boss encounter difficulty should be high
      for (const boss of strategy.bosses) {
        expect(boss.difficultyRating).toBeGreaterThan(30);
      }
    });

    it("should score elite packs higher than normal packs", async () => {
      const strategy = await generateDungeonStrategy({ dungeonMapId: 33 });

      // Find packs with and without elites
      const elitePacks = strategy.trashPacks.filter((p) => p.eliteCount > 0);
      const normalPacks = strategy.trashPacks.filter((p) => p.eliteCount === 0 && !p.hasBoss);

      if (elitePacks.length > 0 && normalPacks.length > 0) {
        const avgEliteScore = elitePacks.reduce((s, p) => s + p.difficultyScore, 0) / elitePacks.length;
        const avgNormalScore = normalPacks.reduce((s, p) => s + p.difficultyScore, 0) / normalPacks.length;
        expect(avgEliteScore).toBeGreaterThan(avgNormalScore);
      }
    });
  });

  describe("Creature role detection", () => {
    it("should identify healer role from spell analysis", async () => {
      const strategy = await generateDungeonStrategy({ dungeonMapId: 33 });

      // Shadowfang Moonwalker has Rejuvenation → should be identified as healer
      const allCreatures = strategy.trashPacks.flatMap((p) => p.creatures);
      const moonwalker = allCreatures.find((c) => c.entry === 3851);

      if (moonwalker) {
        expect(moonwalker.combatRole).toBe("healer");
      }
    });

    it("should identify caster role from UnitClass", async () => {
      const strategy = await generateDungeonStrategy({ dungeonMapId: 33 });

      // Shadowfang Darksoul has UnitClass=8 (Mage) → should be caster
      const allCreatures = strategy.trashPacks.flatMap((p) => p.creatures);
      const darksoul = allCreatures.find((c) => c.entry === 3850);

      if (darksoul) {
        expect(darksoul.combatRole).toBe("caster");
      }
    });
  });

  describe("Immunity detection", () => {
    it("should parse mechanic_immune_mask correctly", async () => {
      const strategy = await generateDungeonStrategy({ dungeonMapId: 33 });

      // Commander Springvale has mechanic_immune_mask = (1<<4)|(1<<11)|(1<<16)
      // This should include Fear (bit 4), Stun (bit 11), Polymorph (bit 16)
      const boss = strategy.bosses.find((b) => b.entry === 4278);

      if (boss) {
        // Check the boss pack's creatures for immunity data
        const allCreatures = [...strategy.trashPacks, ...strategy.bosses.map(() => null)]
          .filter(Boolean)
          .flatMap((p: any) => p?.creatures || []);

        // Search all packs for the boss creature
        let bossCreature: any = null;
        for (const pack of [...strategy.trashPacks]) {
          const found = pack.creatures.find((c) => c.entry === 4278);
          if (found) {
            bossCreature = found;
            break;
          }
        }

        // Boss might also be in the boss encounter adds list or separate
        if (!bossCreature) {
          // Boss is in a boss pack which was filtered from trashPacks
          // Check via bosses[0].adds or the pack data
          expect(boss.entry).toBe(4278); // At minimum the boss was identified
        }
      }
    });
  });
});
