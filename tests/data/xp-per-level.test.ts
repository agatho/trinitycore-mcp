/**
 * Tests for XP Per Level Database
 *
 * Verifies the correctness of xp.txt GameTable data including:
 * - No negative xpToNext values
 * - Monotonically increasing totalXP (cumulative)
 * - Correct cumulative XP calculations
 * - All 90 levels present with valid data
 * - Expansion boundary handling
 * - Utility function correctness
 *
 * @module tests/data/xp-per-level
 */

import {
  XP_PER_LEVEL,
  MAX_LEVEL,
  getXPForLevel,
  getXPToNextLevel,
  calculateTotalXPNeeded,
  calculateLevelsFromXP,
  getExpansionForLevel,
  hasXPDivisor,
  getXPDivisor,
  calculateQuestXP,
  getQuestColor,
  QuestColor,
  getQuestXPModifier,
  calculateQuestXPWithModifiers,
  calculateRestBonusPool,
  getLevelRangeStats,
  type XPLevelEntry,
} from "../../src/data/xp-per-level";

describe("XP_PER_LEVEL data integrity", () => {
  it("should have exactly 90 entries", () => {
    expect(XP_PER_LEVEL.length).toBe(90);
  });

  it("should have levels 1 through 90 in order", () => {
    for (let i = 0; i < XP_PER_LEVEL.length; i++) {
      expect(XP_PER_LEVEL[i].level).toBe(i + 1);
    }
  });

  it("should have NO negative xpToNext values", () => {
    for (const entry of XP_PER_LEVEL) {
      expect(entry.xpToNext).toBeGreaterThanOrEqual(0);
      if (entry.xpToNext < 0) {
        throw new Error(`Level ${entry.level} has negative xpToNext: ${entry.xpToNext}`);
      }
    }
  });

  it("should have monotonically increasing totalXP (cumulative)", () => {
    for (let i = 1; i < XP_PER_LEVEL.length; i++) {
      expect(XP_PER_LEVEL[i].totalXP).toBeGreaterThan(XP_PER_LEVEL[i - 1].totalXP);
    }
  });

  it("should have totalXP = 0 for level 1 (start of game)", () => {
    expect(XP_PER_LEVEL[0].totalXP).toBe(0);
  });

  it("should have xpToNext = 0 for max level (90)", () => {
    expect(XP_PER_LEVEL[89].xpToNext).toBe(0);
  });

  it("should have correct cumulative totalXP (sum of prior xpToNext)", () => {
    let cumulative = 0;
    for (const entry of XP_PER_LEVEL) {
      expect(entry.totalXP).toBe(cumulative);
      cumulative += entry.xpToNext;
    }
  });

  it("should have positive perKillXP for all levels", () => {
    for (const entry of XP_PER_LEVEL) {
      expect(entry.perKillXP).toBeGreaterThan(0);
    }
  });

  it("should have increasing perKillXP values", () => {
    for (let i = 1; i < XP_PER_LEVEL.length; i++) {
      expect(XP_PER_LEVEL[i].perKillXP).toBeGreaterThanOrEqual(XP_PER_LEVEL[i - 1].perKillXP);
    }
  });

  it("should have positive divisor for all levels", () => {
    for (const entry of XP_PER_LEVEL) {
      expect(entry.divisor).toBeGreaterThan(0);
    }
  });

  it("should have non-empty expansion name for all levels", () => {
    for (const entry of XP_PER_LEVEL) {
      expect(entry.expansion.length).toBeGreaterThan(0);
    }
  });

  it("should match xp.txt raw Total values for key levels", () => {
    // xpToNext = xp.txt Total column (XP needed to complete this level)
    expect(getXPToNextLevel(1)).toBe(250);
    expect(getXPToNextLevel(10)).toBe(10590);
    expect(getXPToNextLevel(29)).toBe(33890);   // Was -1815 before fix
    expect(getXPToNextLevel(30)).toBe(32075);
    expect(getXPToNextLevel(50)).toBe(40435);
    expect(getXPToNextLevel(69)).toBe(64620);   // Was -5975 before fix
    expect(getXPToNextLevel(70)).toBe(58645);
    expect(getXPToNextLevel(79)).toBe(74700);
    expect(getXPToNextLevel(80)).toBe(403725);
    expect(getXPToNextLevel(89)).toBe(592980);
    expect(getXPToNextLevel(90)).toBe(0);        // Max level
  });
});

describe("Expansion boundary handling", () => {
  it("should handle level 29→30 boundary (Chromie Time bracket)", () => {
    // xpToNext for level 29 should be positive (was -1815 before fix)
    const level29 = getXPForLevel(29)!;
    const level30 = getXPForLevel(30)!;

    expect(level29.xpToNext).toBe(33890);  // From xp.txt
    expect(level30.xpToNext).toBe(32075);  // Slightly less (new bracket)
    expect(level29.xpToNext).toBeGreaterThan(0);
    expect(level30.xpToNext).toBeGreaterThan(0);
  });

  it("should handle level 69→70 boundary (expansion boundary)", () => {
    // xpToNext for level 69 should be positive (was -5975 before fix)
    const level69 = getXPForLevel(69)!;
    const level70 = getXPForLevel(70)!;

    expect(level69.xpToNext).toBe(64620);  // From xp.txt
    expect(level70.xpToNext).toBe(58645);  // Slightly less (new bracket)
    expect(level69.xpToNext).toBeGreaterThan(0);
    expect(level70.xpToNext).toBeGreaterThan(0);
  });

  it("should handle level 79→80 boundary (Midnight expansion)", () => {
    const level79 = getXPForLevel(79)!;
    const level80 = getXPForLevel(80)!;

    expect(level79.xpToNext).toBe(74700);
    expect(level80.xpToNext).toBe(403725);   // Large jump for max-level expansion
  });
});

describe("Expansion assignments", () => {
  it("should assign Classic to levels 1-49", () => {
    for (let l = 1; l <= 49; l++) {
      expect(getExpansionForLevel(l)).toBe("Classic");
    }
  });

  it("should assign Shadowlands to levels 50-60", () => {
    for (let l = 50; l <= 60; l++) {
      expect(getExpansionForLevel(l)).toBe("Shadowlands");
    }
  });

  it("should assign Dragonflight to levels 61-69", () => {
    for (let l = 61; l <= 69; l++) {
      expect(getExpansionForLevel(l)).toBe("Dragonflight");
    }
  });

  it("should assign The War Within to levels 70-79", () => {
    for (let l = 70; l <= 79; l++) {
      expect(getExpansionForLevel(l)).toBe("The War Within");
    }
  });

  it("should assign Midnight to levels 80-90", () => {
    for (let l = 80; l <= 90; l++) {
      expect(getExpansionForLevel(l)).toBe("Midnight");
    }
  });
});

describe("XP divisor system", () => {
  it("should have divisor 1 for levels 1-80", () => {
    for (let l = 1; l <= 80; l++) {
      expect(getXPDivisor(l)).toBe(1);
      expect(hasXPDivisor(l)).toBe(false);
    }
  });

  it("should have divisor 9 for levels 81-90", () => {
    for (let l = 81; l <= 90; l++) {
      expect(getXPDivisor(l)).toBe(9);
      expect(hasXPDivisor(l)).toBe(true);
    }
  });

  it("should correctly calculate quest XP with divisor", () => {
    // At level 80 (divisor 1): 1000 XP quest gives 1000
    expect(calculateQuestXP(1000, 80)).toBe(1000);

    // At level 81 (divisor 9): 1000 XP quest gives 111 (floor(1000/9))
    expect(calculateQuestXP(1000, 81)).toBe(111);
  });
});

describe("getXPForLevel()", () => {
  it("should return entry for valid levels", () => {
    const entry = getXPForLevel(1);
    expect(entry).toBeDefined();
    expect(entry!.level).toBe(1);
  });

  it("should return undefined for level 0", () => {
    expect(getXPForLevel(0)).toBeUndefined();
  });

  it("should return undefined for level above max", () => {
    expect(getXPForLevel(91)).toBeUndefined();
  });

  it("should return undefined for negative level", () => {
    expect(getXPForLevel(-1)).toBeUndefined();
  });
});

describe("calculateTotalXPNeeded()", () => {
  it("should return 0 for same level", () => {
    expect(calculateTotalXPNeeded(50, 50)).toBe(0);
  });

  it("should return 0 for reversed levels", () => {
    expect(calculateTotalXPNeeded(50, 40)).toBe(0);
  });

  it("should correctly sum XP for a range", () => {
    // Level 1 to 3: xpToNext(1) + xpToNext(2) = 250 + 655 = 905
    expect(calculateTotalXPNeeded(1, 3)).toBe(250 + 655);
  });

  it("should handle expansion boundaries correctly", () => {
    // Level 29 to 31: xpToNext(29) + xpToNext(30) = 33890 + 32075 = 65965
    const xp = calculateTotalXPNeeded(29, 31);
    expect(xp).toBe(33890 + 32075);
    expect(xp).toBeGreaterThan(0); // Was negative before fix!
  });

  it("should handle level 69→71 boundary", () => {
    const xp = calculateTotalXPNeeded(69, 71);
    expect(xp).toBe(64620 + 58645);
    expect(xp).toBeGreaterThan(0);
  });
});

describe("calculateLevelsFromXP()", () => {
  it("should return 0 for 0 XP", () => {
    expect(calculateLevelsFromXP(0, 1)).toBe(0);
  });

  it("should return 0 for max level", () => {
    expect(calculateLevelsFromXP(10000, MAX_LEVEL)).toBe(0);
  });

  it("should return exactly 1 for completing a level", () => {
    // Level 1 needs 250 XP
    expect(calculateLevelsFromXP(250, 1)).toBe(1);
  });

  it("should return fractional levels for partial XP", () => {
    // Level 1 needs 250 XP, 125 XP = 0.5 levels
    expect(calculateLevelsFromXP(125, 1)).toBeCloseTo(0.5, 2);
  });

  it("should handle multiple level gains", () => {
    // Levels 1+2 need 250 + 655 = 905 XP
    expect(calculateLevelsFromXP(905, 1)).toBe(2);
  });

  it("should work across expansion boundaries without breaking", () => {
    // From level 29, gaining enough XP to reach level 31
    const xpNeeded = 33890 + 32075; // levels 29 and 30
    const levels = calculateLevelsFromXP(xpNeeded, 29);
    expect(levels).toBe(2);
  });
});

describe("Quest color system", () => {
  it("should return GRAY for quest 6+ levels below", () => {
    expect(getQuestColor(10, 20)).toBe(QuestColor.GRAY);
  });

  it("should return GREEN for quest 3-5 levels below", () => {
    expect(getQuestColor(15, 20)).toBe(QuestColor.GREEN);
  });

  it("should return YELLOW for same-level quest", () => {
    expect(getQuestColor(20, 20)).toBe(QuestColor.YELLOW);
  });

  it("should return ORANGE for quest 4-7 levels above", () => {
    expect(getQuestColor(25, 20)).toBe(QuestColor.ORANGE);
  });

  it("should return RED for quest 8+ levels above", () => {
    expect(getQuestColor(30, 20)).toBe(QuestColor.RED);
  });
});

describe("calculateQuestXPWithModifiers()", () => {
  it("should apply level divisor", () => {
    // Level 81 has divisor 9: floor(9000/9) = 1000
    const xp = calculateQuestXPWithModifiers(9000, 81, 81);
    expect(xp).toBe(1000);
  });

  it("should apply color modifier for gray quest", () => {
    // Gray quest: 0% XP
    const xp = calculateQuestXPWithModifiers(1000, 10, 20);
    expect(xp).toBe(0);
  });

  it("should apply rest bonus", () => {
    // Same-level quest (yellow, 100%), rest bonus (+50%)
    // floor(floor(1000 * 1.0) * 1.5) = 1500
    const xp = calculateQuestXPWithModifiers(1000, 50, 50, true);
    expect(xp).toBe(1500);
  });

  it("should not apply rest bonus to gray quests", () => {
    const xp = calculateQuestXPWithModifiers(1000, 10, 20, true);
    expect(xp).toBe(0); // Gray gives 0 even with rest
  });
});

describe("calculateRestBonusPool()", () => {
  it("should return 0 for max level", () => {
    expect(calculateRestBonusPool(MAX_LEVEL, 100)).toBe(0);
  });

  it("should return 0 for 0 hours", () => {
    expect(calculateRestBonusPool(50, 0)).toBe(0);
  });

  it("should increase with hours rested", () => {
    const pool8h = calculateRestBonusPool(50, 8);
    const pool16h = calculateRestBonusPool(50, 16);
    expect(pool16h).toBeGreaterThan(pool8h);
  });

  it("should cap at 150% of level bar", () => {
    const xpToNext = getXPToNextLevel(50);
    const maxRest = Math.floor(xpToNext * 1.5);
    const poolHuge = calculateRestBonusPool(50, 10000); // Way more than cap
    expect(poolHuge).toBe(maxRest);
  });
});

describe("getLevelRangeStats()", () => {
  it("should return stats for valid range", () => {
    const stats = getLevelRangeStats(1, 10);
    expect(stats.levelCount).toBe(9);
    expect(stats.totalXP).toBeGreaterThan(0);
    expect(stats.averageXPPerLevel).toBeGreaterThan(0);
    expect(stats.expansions).toContain("Classic");
  });

  it("should return empty for invalid range", () => {
    const stats = getLevelRangeStats(10, 5);
    expect(stats.totalXP).toBe(0);
    expect(stats.levelCount).toBe(0);
  });

  it("should handle cross-expansion ranges", () => {
    const stats = getLevelRangeStats(49, 52);
    expect(stats.expansions).toContain("Classic");
    expect(stats.expansions).toContain("Shadowlands");
  });
});

describe("MAX_LEVEL constant", () => {
  it("should be 90", () => {
    expect(MAX_LEVEL).toBe(90);
  });
});
