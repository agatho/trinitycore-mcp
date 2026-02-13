/**
 * XP Per Level Database for WoW 12.0 (Midnight)
 *
 * Experience requirements for each level extracted from GameTable xp.txt.
 *
 * IMPORTANT: The "Total" column in xp.txt represents the XP needed to complete
 * that level (go from level N to N+1), NOT cumulative XP from level 1.
 * TrinityCore's ObjectMgr::GetXPForLevel(N) returns xp.txt[N].Total directly.
 * When a player levels up, their current XP is reduced by this amount.
 *
 * Data Structure:
 * - xpToNext: XP needed to complete this level (from xp.txt "Total" column)
 * - totalXP: Cumulative XP earned from level 1 to reach this level (computed)
 * - perKillXP: XP awarded for killing a creature of this level
 * - divisor: XP scaling divisor (quest XP rewards divided by this)
 *
 * Level Breakdown:
 * - Levels 1-10: Tutorial/starter zones (fast progression)
 * - Levels 11-29: Early game content (moderate XP curve)
 * - Levels 30-49: Mid-game content (XP curve dips at Chromie Time boundary)
 * - Levels 50-60: Shadowlands expansion (gradual increase)
 * - Levels 61-69: Dragonflight expansion (moderate curve)
 * - Levels 70-79: The War Within expansion (XP dips at expansion boundary)
 * - Levels 80-89: Midnight expansion (divisor 9, steep XP per level)
 * - Level 90: Max level (xpToNext = 0)
 *
 * @module data/xp-per-level
 */

export interface XPLevelEntry {
    level: number;
    totalXP: number;        // Cumulative XP earned from level 1 to reach this level
    xpToNext: number;       // XP needed to complete this level (xp.txt "Total" column)
    perKillXP: number;      // XP from killing same-level creature
    divisor: number;        // XP scaling divisor (quest XP divided by this)
    expansion: string;      // Which expansion this level belongs to
}

/**
 * XP per level database with 90 entries
 *
 * Data source: TrinityCore GameTable xp.txt (build 12.0.0.65028)
 *
 * The xp.txt "Total" column is the XP needed to complete each level (used as
 * xpToNext here). The totalXP field is the cumulative sum of all prior levels'
 * xpToNext values, representing how much XP a character has earned to reach
 * that level from level 1.
 *
 * Note: xpToNext naturally dips at expansion boundaries (levels 30, 70) where
 * the leveling curve resets. This is NOT a data error - it reflects WoW's
 * Chromie Time bracket system where each expansion has its own XP pacing.
 *
 * Updated: February 13, 2026
 * Version: WoW 12.0 (Midnight) build 65028
 */
export const XP_PER_LEVEL: XPLevelEntry[] = [
    // Level 1-10: Tutorial and starter zones
    { level: 1, totalXP: 0, xpToNext: 250, perKillXP: 20, divisor: 1, expansion: 'Classic' },
    { level: 2, totalXP: 250, xpToNext: 655, perKillXP: 25, divisor: 1, expansion: 'Classic' },
    { level: 3, totalXP: 905, xpToNext: 1245, perKillXP: 30, divisor: 1, expansion: 'Classic' },
    { level: 4, totalXP: 2150, xpToNext: 2025, perKillXP: 35, divisor: 1, expansion: 'Classic' },
    { level: 5, totalXP: 4175, xpToNext: 2995, perKillXP: 40, divisor: 1, expansion: 'Classic' },
    { level: 6, totalXP: 7170, xpToNext: 4155, perKillXP: 45, divisor: 1, expansion: 'Classic' },
    { level: 7, totalXP: 11325, xpToNext: 5505, perKillXP: 50, divisor: 1, expansion: 'Classic' },
    { level: 8, totalXP: 16830, xpToNext: 7040, perKillXP: 55, divisor: 1, expansion: 'Classic' },
    { level: 9, totalXP: 23870, xpToNext: 8770, perKillXP: 60, divisor: 1, expansion: 'Classic' },
    { level: 10, totalXP: 32640, xpToNext: 10590, perKillXP: 65, divisor: 1, expansion: 'Classic' },

    // Level 11-29: Early game progression
    { level: 11, totalXP: 43230, xpToNext: 11685, perKillXP: 70, divisor: 1, expansion: 'Classic' },
    { level: 12, totalXP: 54915, xpToNext: 12795, perKillXP: 75, divisor: 1, expansion: 'Classic' },
    { level: 13, totalXP: 67710, xpToNext: 13920, perKillXP: 80, divisor: 1, expansion: 'Classic' },
    { level: 14, totalXP: 81630, xpToNext: 15055, perKillXP: 85, divisor: 1, expansion: 'Classic' },
    { level: 15, totalXP: 96685, xpToNext: 16210, perKillXP: 90, divisor: 1, expansion: 'Classic' },
    { level: 16, totalXP: 112895, xpToNext: 17380, perKillXP: 95, divisor: 1, expansion: 'Classic' },
    { level: 17, totalXP: 130275, xpToNext: 18560, perKillXP: 100, divisor: 1, expansion: 'Classic' },
    { level: 18, totalXP: 148835, xpToNext: 19755, perKillXP: 105, divisor: 1, expansion: 'Classic' },
    { level: 19, totalXP: 168590, xpToNext: 20970, perKillXP: 110, divisor: 1, expansion: 'Classic' },
    { level: 20, totalXP: 189560, xpToNext: 22195, perKillXP: 115, divisor: 1, expansion: 'Classic' },
    { level: 21, totalXP: 211755, xpToNext: 23435, perKillXP: 120, divisor: 1, expansion: 'Classic' },
    { level: 22, totalXP: 235190, xpToNext: 24690, perKillXP: 125, divisor: 1, expansion: 'Classic' },
    { level: 23, totalXP: 259880, xpToNext: 25960, perKillXP: 130, divisor: 1, expansion: 'Classic' },
    { level: 24, totalXP: 285840, xpToNext: 27245, perKillXP: 135, divisor: 1, expansion: 'Classic' },
    { level: 25, totalXP: 313085, xpToNext: 28545, perKillXP: 140, divisor: 1, expansion: 'Classic' },
    { level: 26, totalXP: 341630, xpToNext: 29860, perKillXP: 145, divisor: 1, expansion: 'Classic' },
    { level: 27, totalXP: 371490, xpToNext: 31190, perKillXP: 150, divisor: 1, expansion: 'Classic' },
    { level: 28, totalXP: 402680, xpToNext: 32535, perKillXP: 155, divisor: 1, expansion: 'Classic' },
    { level: 29, totalXP: 435215, xpToNext: 33890, perKillXP: 160, divisor: 1, expansion: 'Classic' },

    // Level 30-49: Mid-game content (Chromie Time bracket, xpToNext dips at boundary)
    { level: 30, totalXP: 469105, xpToNext: 32075, perKillXP: 165, divisor: 1, expansion: 'Classic' },
    { level: 31, totalXP: 501180, xpToNext: 32700, perKillXP: 170, divisor: 1, expansion: 'Classic' },
    { level: 32, totalXP: 533880, xpToNext: 33295, perKillXP: 175, divisor: 1, expansion: 'Classic' },
    { level: 33, totalXP: 567175, xpToNext: 33865, perKillXP: 180, divisor: 1, expansion: 'Classic' },
    { level: 34, totalXP: 601040, xpToNext: 34410, perKillXP: 185, divisor: 1, expansion: 'Classic' },
    { level: 35, totalXP: 635450, xpToNext: 34925, perKillXP: 190, divisor: 1, expansion: 'Classic' },
    { level: 36, totalXP: 670375, xpToNext: 35415, perKillXP: 195, divisor: 1, expansion: 'Classic' },
    { level: 37, totalXP: 705790, xpToNext: 35875, perKillXP: 200, divisor: 1, expansion: 'Classic' },
    { level: 38, totalXP: 741665, xpToNext: 36310, perKillXP: 205, divisor: 1, expansion: 'Classic' },
    { level: 39, totalXP: 777975, xpToNext: 36720, perKillXP: 210, divisor: 1, expansion: 'Classic' },
    { level: 40, totalXP: 814695, xpToNext: 37100, perKillXP: 215, divisor: 1, expansion: 'Classic' },
    { level: 41, totalXP: 851795, xpToNext: 37450, perKillXP: 220, divisor: 1, expansion: 'Classic' },
    { level: 42, totalXP: 889245, xpToNext: 37780, perKillXP: 225, divisor: 1, expansion: 'Classic' },
    { level: 43, totalXP: 927025, xpToNext: 38075, perKillXP: 230, divisor: 1, expansion: 'Classic' },
    { level: 44, totalXP: 965100, xpToNext: 38350, perKillXP: 235, divisor: 1, expansion: 'Classic' },
    { level: 45, totalXP: 1003450, xpToNext: 38595, perKillXP: 240, divisor: 1, expansion: 'Classic' },
    { level: 46, totalXP: 1042045, xpToNext: 38810, perKillXP: 245, divisor: 1, expansion: 'Classic' },
    { level: 47, totalXP: 1080855, xpToNext: 39000, perKillXP: 250, divisor: 1, expansion: 'Classic' },
    { level: 48, totalXP: 1119855, xpToNext: 39165, perKillXP: 255, divisor: 1, expansion: 'Classic' },
    { level: 49, totalXP: 1159020, xpToNext: 39300, perKillXP: 260, divisor: 1, expansion: 'Classic' },

    // Level 50-60: Shadowlands expansion
    { level: 50, totalXP: 1198320, xpToNext: 40435, perKillXP: 265, divisor: 1, expansion: 'Shadowlands' },
    { level: 51, totalXP: 1238755, xpToNext: 41590, perKillXP: 270, divisor: 1, expansion: 'Shadowlands' },
    { level: 52, totalXP: 1280345, xpToNext: 42750, perKillXP: 275, divisor: 1, expansion: 'Shadowlands' },
    { level: 53, totalXP: 1323095, xpToNext: 43930, perKillXP: 280, divisor: 1, expansion: 'Shadowlands' },
    { level: 54, totalXP: 1367025, xpToNext: 45120, perKillXP: 285, divisor: 1, expansion: 'Shadowlands' },
    { level: 55, totalXP: 1412145, xpToNext: 46325, perKillXP: 290, divisor: 1, expansion: 'Shadowlands' },
    { level: 56, totalXP: 1458470, xpToNext: 47545, perKillXP: 295, divisor: 1, expansion: 'Shadowlands' },
    { level: 57, totalXP: 1506015, xpToNext: 48775, perKillXP: 300, divisor: 1, expansion: 'Shadowlands' },
    { level: 58, totalXP: 1554790, xpToNext: 50020, perKillXP: 305, divisor: 1, expansion: 'Shadowlands' },
    { level: 59, totalXP: 1604810, xpToNext: 51280, perKillXP: 310, divisor: 1, expansion: 'Shadowlands' },
    { level: 60, totalXP: 1656090, xpToNext: 52555, perKillXP: 315, divisor: 1, expansion: 'Shadowlands' },

    // Level 61-69: Dragonflight expansion
    { level: 61, totalXP: 1708645, xpToNext: 53840, perKillXP: 320, divisor: 1, expansion: 'Dragonflight' },
    { level: 62, totalXP: 1762485, xpToNext: 55140, perKillXP: 325, divisor: 1, expansion: 'Dragonflight' },
    { level: 63, totalXP: 1817625, xpToNext: 56455, perKillXP: 330, divisor: 1, expansion: 'Dragonflight' },
    { level: 64, totalXP: 1874080, xpToNext: 57780, perKillXP: 335, divisor: 1, expansion: 'Dragonflight' },
    { level: 65, totalXP: 1931860, xpToNext: 59120, perKillXP: 340, divisor: 1, expansion: 'Dragonflight' },
    { level: 66, totalXP: 1990980, xpToNext: 60475, perKillXP: 345, divisor: 1, expansion: 'Dragonflight' },
    { level: 67, totalXP: 2051455, xpToNext: 61845, perKillXP: 350, divisor: 1, expansion: 'Dragonflight' },
    { level: 68, totalXP: 2113300, xpToNext: 63225, perKillXP: 355, divisor: 1, expansion: 'Dragonflight' },
    { level: 69, totalXP: 2176525, xpToNext: 64620, perKillXP: 360, divisor: 1, expansion: 'Dragonflight' },

    // Level 70-79: The War Within expansion (xpToNext dips at expansion boundary)
    { level: 70, totalXP: 2241145, xpToNext: 58645, perKillXP: 365, divisor: 1, expansion: 'The War Within' },
    { level: 71, totalXP: 2299790, xpToNext: 60335, perKillXP: 370, divisor: 1, expansion: 'The War Within' },
    { level: 72, totalXP: 2360125, xpToNext: 62045, perKillXP: 375, divisor: 1, expansion: 'The War Within' },
    { level: 73, totalXP: 2422170, xpToNext: 63780, perKillXP: 380, divisor: 1, expansion: 'The War Within' },
    { level: 74, totalXP: 2485950, xpToNext: 65540, perKillXP: 385, divisor: 1, expansion: 'The War Within' },
    { level: 75, totalXP: 2551490, xpToNext: 67325, perKillXP: 390, divisor: 1, expansion: 'The War Within' },
    { level: 76, totalXP: 2618815, xpToNext: 69130, perKillXP: 395, divisor: 1, expansion: 'The War Within' },
    { level: 77, totalXP: 2687945, xpToNext: 70965, perKillXP: 400, divisor: 1, expansion: 'The War Within' },
    { level: 78, totalXP: 2758910, xpToNext: 72820, perKillXP: 405, divisor: 1, expansion: 'The War Within' },
    { level: 79, totalXP: 2831730, xpToNext: 74700, perKillXP: 410, divisor: 1, expansion: 'The War Within' },

    // Level 80-89: Midnight expansion (divisor 9, steep XP per level)
    { level: 80, totalXP: 2906430, xpToNext: 403725, perKillXP: 450, divisor: 1, expansion: 'Midnight' },
    { level: 81, totalXP: 3310155, xpToNext: 423390, perKillXP: 455, divisor: 9, expansion: 'Midnight' },
    { level: 82, totalXP: 3733545, xpToNext: 443395, perKillXP: 460, divisor: 9, expansion: 'Midnight' },
    { level: 83, totalXP: 4176940, xpToNext: 463740, perKillXP: 465, divisor: 9, expansion: 'Midnight' },
    { level: 84, totalXP: 4640680, xpToNext: 484430, perKillXP: 470, divisor: 9, expansion: 'Midnight' },
    { level: 85, totalXP: 5125110, xpToNext: 505455, perKillXP: 475, divisor: 9, expansion: 'Midnight' },
    { level: 86, totalXP: 5630565, xpToNext: 526825, perKillXP: 480, divisor: 9, expansion: 'Midnight' },
    { level: 87, totalXP: 6157390, xpToNext: 548535, perKillXP: 485, divisor: 9, expansion: 'Midnight' },
    { level: 88, totalXP: 6705925, xpToNext: 570590, perKillXP: 490, divisor: 9, expansion: 'Midnight' },
    { level: 89, totalXP: 7276515, xpToNext: 592980, perKillXP: 495, divisor: 9, expansion: 'Midnight' },

    // Level 90: Max level
    { level: 90, totalXP: 7869495, xpToNext: 0, perKillXP: 530, divisor: 9, expansion: 'Midnight' },
];

/**
 * Maximum player level in WoW 12.0 (Midnight)
 */
export const MAX_LEVEL = 90;

/**
 * Get XP entry for a specific level
 */
export function getXPForLevel(level: number): XPLevelEntry | undefined {
    if (level < 1 || level > MAX_LEVEL) {
        return undefined;
    }
    return XP_PER_LEVEL[level - 1]; // Array is 0-indexed, levels are 1-indexed
}

/**
 * Get XP needed to go from current level to next level
 */
export function getXPToNextLevel(currentLevel: number): number {
    const entry = getXPForLevel(currentLevel);
    return entry?.xpToNext || 0;
}

/**
 * Calculate total XP needed to reach target level from current level
 */
export function calculateTotalXPNeeded(currentLevel: number, targetLevel: number): number {
    if (currentLevel >= targetLevel || currentLevel < 1 || targetLevel > MAX_LEVEL) {
        return 0;
    }

    let totalXP = 0;
    for (let level = currentLevel; level < targetLevel; level++) {
        totalXP += getXPToNextLevel(level);
    }

    return totalXP;
}

/**
 * Calculate how many levels can be gained from an XP amount
 * Returns fractional levels (e.g., 2.5 levels)
 */
export function calculateLevelsFromXP(xpAmount: number, currentLevel: number): number {
    if (xpAmount <= 0 || currentLevel >= MAX_LEVEL) {
        return 0;
    }

    let remainingXP = xpAmount;
    let levelsGained = 0;
    let checkLevel = currentLevel;

    while (remainingXP > 0 && checkLevel < MAX_LEVEL) {
        const xpForLevel = getXPToNextLevel(checkLevel);

        if (xpForLevel <= 0) {
            // Level squish anomaly or max level reached
            break;
        }

        if (remainingXP >= xpForLevel) {
            // Complete level
            remainingXP -= xpForLevel;
            levelsGained += 1;
            checkLevel++;
        } else {
            // Partial level
            levelsGained += remainingXP / xpForLevel;
            break;
        }
    }

    return levelsGained;
}

/**
 * Get expansion name for a level
 */
export function getExpansionForLevel(level: number): string {
    const entry = getXPForLevel(level);
    return entry?.expansion || 'Unknown';
}

/**
 * Check if level uses XP divisor (affects quest XP rewards)
 */
export function hasXPDivisor(level: number): boolean {
    const entry = getXPForLevel(level);
    return entry ? entry.divisor > 1 : false;
}

/**
 * Get XP divisor for level (quest rewards are divided by this)
 */
export function getXPDivisor(level: number): number {
    const entry = getXPForLevel(level);
    return entry?.divisor || 1;
}

/**
 * Calculate quest XP after applying level divisor
 */
export function calculateQuestXP(baseQuestXP: number, playerLevel: number): number {
    const divisor = getXPDivisor(playerLevel);
    return Math.floor(baseQuestXP / divisor);
}

/**
 * Get summary statistics for a level range
 */
export function getLevelRangeStats(startLevel: number, endLevel: number): {
    totalXP: number;
    averageXPPerLevel: number;
    levelCount: number;
    expansions: string[];
} {
    if (startLevel < 1 || endLevel > MAX_LEVEL || startLevel >= endLevel) {
        return { totalXP: 0, averageXPPerLevel: 0, levelCount: 0, expansions: [] };
    }

    const totalXP = calculateTotalXPNeeded(startLevel, endLevel);
    const levelCount = endLevel - startLevel;
    const averageXPPerLevel = totalXP / levelCount;

    const expansions = new Set<string>();
    for (let level = startLevel; level < endLevel; level++) {
        const expansion = getExpansionForLevel(level);
        expansions.add(expansion);
    }

    return {
        totalXP,
        averageXPPerLevel: Math.round(averageXPPerLevel),
        levelCount,
        expansions: Array.from(expansions),
    };
}

// ============================================================================
// PHASE 7 ENHANCEMENT #6: Quest XP Modifiers and Color System
// ============================================================================

/**
 * Quest difficulty color based on level difference
 * Determines the visual color and XP modifier for a quest
 */
export enum QuestColor {
    GRAY = "gray",      // Trivial quest (-6+ levels below player)
    GREEN = "green",    // Low-level quest (-3 to -5 levels)
    YELLOW = "yellow",  // Appropriate-level quest (-2 to +3 levels)
    ORANGE = "orange",  // High-level quest (+4 to +7 levels)
    RED = "red"         // Very high-level quest (+8+ levels)
}

/**
 * XP modifier multipliers for each quest color
 * Based on WoW 12.0 (Midnight) XP scaling mechanics
 */
export const QUEST_XP_MODIFIERS: Record<QuestColor, number> = {
    [QuestColor.GRAY]: 0.0,      // No XP (trivial content)
    [QuestColor.GREEN]: 0.2,     // 20% XP (low-level content)
    [QuestColor.YELLOW]: 1.0,    // 100% XP (appropriate content)
    [QuestColor.ORANGE]: 1.1,    // 110% XP (challenging content)
    [QuestColor.RED]: 1.15       // 115% XP (very challenging content)
};

/**
 * Determine quest color based on level difference between player and quest
 *
 * @param questLevel - The minimum level requirement of the quest
 * @param playerLevel - The current player level
 * @returns Quest color (gray, green, yellow, orange, red)
 */
export function getQuestColor(questLevel: number, playerLevel: number): QuestColor {
    const levelDiff = questLevel - playerLevel;

    if (levelDiff <= -6) {
        return QuestColor.GRAY;     // 6+ levels below = trivial
    } else if (levelDiff <= -3) {
        return QuestColor.GREEN;    // 3-5 levels below = low-level
    } else if (levelDiff <= 3) {
        return QuestColor.YELLOW;   // -2 to +3 = appropriate
    } else if (levelDiff <= 7) {
        return QuestColor.ORANGE;   // +4 to +7 = high-level
    } else {
        return QuestColor.RED;      // +8+ = very high-level
    }
}

/**
 * Get XP modifier for a quest based on level difference
 *
 * @param questLevel - The minimum level requirement of the quest
 * @param playerLevel - The current player level
 * @returns XP multiplier (0.0 to 1.15)
 */
export function getQuestXPModifier(questLevel: number, playerLevel: number): number {
    const color = getQuestColor(questLevel, playerLevel);
    return QUEST_XP_MODIFIERS[color];
}

/**
 * Calculate quest XP reward with all modifiers applied
 *
 * @param baseQuestXP - The base XP reward from quest_template
 * @param questLevel - The minimum level requirement of the quest
 * @param playerLevel - The current player level
 * @param hasRestBonus - Whether player has rested XP bonus active
 * @returns Final XP reward after all modifiers
 */
export function calculateQuestXPWithModifiers(
    baseQuestXP: number,
    questLevel: number,
    playerLevel: number,
    hasRestBonus = false
): number {
    // Step 1: Apply level divisor (expansion-based scaling)
    const divisor = getXPDivisor(playerLevel);
    let xp = Math.floor(baseQuestXP / divisor);

    // Step 2: Apply quest color modifier (level difference penalty/bonus)
    const colorModifier = getQuestXPModifier(questLevel, playerLevel);
    xp = Math.floor(xp * colorModifier);

    // Step 3: Apply rest bonus (+50% XP if rested)
    if (hasRestBonus && colorModifier > 0) {
        xp = Math.floor(xp * 1.5);
    }

    return xp;
}

/**
 * Calculate rest bonus XP pool size for a player
 * Rest bonus accumulates while logged out at an inn or city
 *
 * @param playerLevel - Current player level
 * @param hoursRested - Hours spent rested (capped at 10 days = 240 hours)
 * @returns Rest bonus XP pool size in XP points
 */
export function calculateRestBonusPool(playerLevel: number, hoursRested: number): number {
    // Rest XP accumulates at 5% of level bar per 8 hours
    // Maximum: 150% of level bar (30 bubbles * 5% each)
    const xpToNextLevel = getXPToNextLevel(playerLevel);

    // Handle max level (xpToNext = 0)
    if (xpToNextLevel <= 0) {
        return 0;
    }

    const maxRestXP = Math.floor(xpToNextLevel * 1.5); // 150% of level bar

    // Accumulation rate: 5% per 8 hours = 0.625% per hour
    const restXPPerHour = xpToNextLevel * 0.00625;
    const accumulatedRestXP = Math.floor(restXPPerHour * hoursRested);

    // Cap at maximum (150% of level bar)
    return Math.min(accumulatedRestXP, maxRestXP);
}

/**
 * Check if player should have rest bonus based on rest pool
 *
 * @param restPoolXP - Remaining rest bonus XP pool
 * @returns Whether player has active rest bonus
 */
export function hasRestBonus(restPoolXP: number): boolean {
    return restPoolXP > 0;
}

/**
 * Deduct XP from rest bonus pool when XP is gained
 * Rest bonus applies 1:1 with XP earned (50% bonus on top of normal XP)
 *
 * @param restPoolXP - Current rest bonus XP pool
 * @param xpGained - XP gained from killing/questing
 * @returns New rest pool after deduction
 */
export function deductRestBonus(restPoolXP: number, xpGained: number): number {
    // Rest bonus is consumed 1:1 with XP earned
    // If you earn 100 XP normally, you get +50 bonus = 150 total
    // This consumes 100 rest XP from the pool
    return Math.max(0, restPoolXP - xpGained);
}
