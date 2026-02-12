/**
 * XP Per Level Database for WoW 12.0 (Midnight)
 *
 * Experience requirements for each level extracted from GameTable xp.txt
 * Represents the accurate XP needed to progress from one level to the next
 *
 * Data Structure (from xp.txt GameTable):
 * - Total: Total XP required to reach this level from level 1
 * - PerKill: XP awarded for killing a creature of this level
 * - Divisor: XP scaling divisor (affects XP gain rates)
 *
 * Level Breakdown:
 * - Levels 1-10: Tutorial/starter zones (low XP, fast progression)
 * - Levels 10-29: Early game content (moderate XP curve)
 * - Levels 30-49: Mid-game content (reduced XP for "level squish")
 * - Levels 50-60: Shadowlands expansion (gradual increase)
 * - Levels 61-69: Dragonflight expansion (moderate curve)
 * - Levels 70-80: The War Within expansion (restructured curve)
 * - Levels 81-90: Midnight expansion (divisor 9, steep curve)
 * - Level 90: Max level (99,999,999 placeholder = no further progression)
 *
 * @module data/xp-per-level
 */

export interface XPLevelEntry {
    level: number;
    totalXP: number;        // Cumulative XP from level 1 to this level
    xpToNext: number;       // XP needed to go from this level to next
    perKillXP: number;      // XP from killing same-level creature
    divisor: number;        // XP scaling divisor
    expansion: string;      // Which expansion this level belongs to
}

/**
 * XP per level database with 90 entries
 *
 * Data based on:
 * - TrinityCore GameTable xp.txt (build 12.0.0.65028)
 * - WoW 12.0 (Midnight) game data
 * - Accurate XP requirements for leveling 1-90
 *
 * Key Level Milestones:
 * - Level 10: Tutorial complete (10,590 total XP)
 * - Level 20: Early game milestone (22,195 total XP)
 * - Level 30: Mid-game start (32,075 total XP)
 * - Level 50: Shadowlands start (40,435 total XP)
 * - Level 60: Dragonflight start (52,555 total XP)
 * - Level 70: The War Within start (58,645 total XP)
 * - Level 80: Midnight start (403,725 total XP)
 * - Level 90: Max level (99,999,999 total XP)
 *
 * Updated: February 12, 2026
 * Version: WoW 12.0 (Midnight) build 65028
 */
export const XP_PER_LEVEL: XPLevelEntry[] = [
    // Level 1-10: Tutorial and starter zones
    { level: 1, totalXP: 250, xpToNext: 405, perKillXP: 20, divisor: 1, expansion: 'Classic' },
    { level: 2, totalXP: 655, xpToNext: 590, perKillXP: 25, divisor: 1, expansion: 'Classic' },
    { level: 3, totalXP: 1245, xpToNext: 780, perKillXP: 30, divisor: 1, expansion: 'Classic' },
    { level: 4, totalXP: 2025, xpToNext: 970, perKillXP: 35, divisor: 1, expansion: 'Classic' },
    { level: 5, totalXP: 2995, xpToNext: 1160, perKillXP: 40, divisor: 1, expansion: 'Classic' },
    { level: 6, totalXP: 4155, xpToNext: 1350, perKillXP: 45, divisor: 1, expansion: 'Classic' },
    { level: 7, totalXP: 5505, xpToNext: 1535, perKillXP: 50, divisor: 1, expansion: 'Classic' },
    { level: 8, totalXP: 7040, xpToNext: 1730, perKillXP: 55, divisor: 1, expansion: 'Classic' },
    { level: 9, totalXP: 8770, xpToNext: 1820, perKillXP: 60, divisor: 1, expansion: 'Classic' },
    { level: 10, totalXP: 10590, xpToNext: 1095, perKillXP: 65, divisor: 1, expansion: 'Classic' },

    // Level 11-29: Early game progression
    { level: 11, totalXP: 11685, xpToNext: 1110, perKillXP: 70, divisor: 1, expansion: 'Classic' },
    { level: 12, totalXP: 12795, xpToNext: 1125, perKillXP: 75, divisor: 1, expansion: 'Classic' },
    { level: 13, totalXP: 13920, xpToNext: 1135, perKillXP: 80, divisor: 1, expansion: 'Classic' },
    { level: 14, totalXP: 15055, xpToNext: 1155, perKillXP: 85, divisor: 1, expansion: 'Classic' },
    { level: 15, totalXP: 16210, xpToNext: 1170, perKillXP: 90, divisor: 1, expansion: 'Classic' },
    { level: 16, totalXP: 17380, xpToNext: 1180, perKillXP: 95, divisor: 1, expansion: 'Classic' },
    { level: 17, totalXP: 18560, xpToNext: 1195, perKillXP: 100, divisor: 1, expansion: 'Classic' },
    { level: 18, totalXP: 19755, xpToNext: 1215, perKillXP: 105, divisor: 1, expansion: 'Classic' },
    { level: 19, totalXP: 20970, xpToNext: 1225, perKillXP: 110, divisor: 1, expansion: 'Classic' },
    { level: 20, totalXP: 22195, xpToNext: 1240, perKillXP: 115, divisor: 1, expansion: 'Classic' },
    { level: 21, totalXP: 23435, xpToNext: 1255, perKillXP: 120, divisor: 1, expansion: 'Classic' },
    { level: 22, totalXP: 24690, xpToNext: 1270, perKillXP: 125, divisor: 1, expansion: 'Classic' },
    { level: 23, totalXP: 25960, xpToNext: 1285, perKillXP: 130, divisor: 1, expansion: 'Classic' },
    { level: 24, totalXP: 27245, xpToNext: 1300, perKillXP: 135, divisor: 1, expansion: 'Classic' },
    { level: 25, totalXP: 28545, xpToNext: 1315, perKillXP: 140, divisor: 1, expansion: 'Classic' },
    { level: 26, totalXP: 29860, xpToNext: 1330, perKillXP: 145, divisor: 1, expansion: 'Classic' },
    { level: 27, totalXP: 31190, xpToNext: 1345, perKillXP: 150, divisor: 1, expansion: 'Classic' },
    { level: 28, totalXP: 32535, xpToNext: 1355, perKillXP: 155, divisor: 1, expansion: 'Classic' },
    { level: 29, totalXP: 33890, xpToNext: -1815, perKillXP: 160, divisor: 1, expansion: 'Classic' },

    // Level 30-49: Mid-game "level squish" content
    { level: 30, totalXP: 32075, xpToNext: 625, perKillXP: 165, divisor: 1, expansion: 'Classic' },
    { level: 31, totalXP: 32700, xpToNext: 595, perKillXP: 170, divisor: 1, expansion: 'Classic' },
    { level: 32, totalXP: 33295, xpToNext: 570, perKillXP: 175, divisor: 1, expansion: 'Classic' },
    { level: 33, totalXP: 33865, xpToNext: 545, perKillXP: 180, divisor: 1, expansion: 'Classic' },
    { level: 34, totalXP: 34410, xpToNext: 515, perKillXP: 185, divisor: 1, expansion: 'Classic' },
    { level: 35, totalXP: 34925, xpToNext: 490, perKillXP: 190, divisor: 1, expansion: 'Classic' },
    { level: 36, totalXP: 35415, xpToNext: 460, perKillXP: 195, divisor: 1, expansion: 'Classic' },
    { level: 37, totalXP: 35875, xpToNext: 435, perKillXP: 200, divisor: 1, expansion: 'Classic' },
    { level: 38, totalXP: 36310, xpToNext: 410, perKillXP: 205, divisor: 1, expansion: 'Classic' },
    { level: 39, totalXP: 36720, xpToNext: 380, perKillXP: 210, divisor: 1, expansion: 'Classic' },
    { level: 40, totalXP: 37100, xpToNext: 350, perKillXP: 215, divisor: 1, expansion: 'Classic' },
    { level: 41, totalXP: 37450, xpToNext: 330, perKillXP: 220, divisor: 1, expansion: 'Classic' },
    { level: 42, totalXP: 37780, xpToNext: 295, perKillXP: 225, divisor: 1, expansion: 'Classic' },
    { level: 43, totalXP: 38075, xpToNext: 275, perKillXP: 230, divisor: 1, expansion: 'Classic' },
    { level: 44, totalXP: 38350, xpToNext: 245, perKillXP: 235, divisor: 1, expansion: 'Classic' },
    { level: 45, totalXP: 38595, xpToNext: 215, perKillXP: 240, divisor: 1, expansion: 'Classic' },
    { level: 46, totalXP: 38810, xpToNext: 190, perKillXP: 245, divisor: 1, expansion: 'Classic' },
    { level: 47, totalXP: 39000, xpToNext: 165, perKillXP: 250, divisor: 1, expansion: 'Classic' },
    { level: 48, totalXP: 39165, xpToNext: 135, perKillXP: 255, divisor: 1, expansion: 'Classic' },
    { level: 49, totalXP: 39300, xpToNext: 1135, perKillXP: 260, divisor: 1, expansion: 'Classic' },

    // Level 50-60: Shadowlands expansion (gradual increase)
    { level: 50, totalXP: 40435, xpToNext: 1155, perKillXP: 265, divisor: 1, expansion: 'Shadowlands' },
    { level: 51, totalXP: 41590, xpToNext: 1160, perKillXP: 270, divisor: 1, expansion: 'Shadowlands' },
    { level: 52, totalXP: 42750, xpToNext: 1180, perKillXP: 275, divisor: 1, expansion: 'Shadowlands' },
    { level: 53, totalXP: 43930, xpToNext: 1190, perKillXP: 280, divisor: 1, expansion: 'Shadowlands' },
    { level: 54, totalXP: 45120, xpToNext: 1205, perKillXP: 285, divisor: 1, expansion: 'Shadowlands' },
    { level: 55, totalXP: 46325, xpToNext: 1220, perKillXP: 290, divisor: 1, expansion: 'Shadowlands' },
    { level: 56, totalXP: 47545, xpToNext: 1230, perKillXP: 295, divisor: 1, expansion: 'Shadowlands' },
    { level: 57, totalXP: 48775, xpToNext: 1245, perKillXP: 300, divisor: 1, expansion: 'Shadowlands' },
    { level: 58, totalXP: 50020, xpToNext: 1260, perKillXP: 305, divisor: 1, expansion: 'Shadowlands' },
    { level: 59, totalXP: 51280, xpToNext: 1275, perKillXP: 310, divisor: 1, expansion: 'Shadowlands' },
    { level: 60, totalXP: 52555, xpToNext: 1285, perKillXP: 315, divisor: 1, expansion: 'Shadowlands' },

    // Level 61-69: Dragonflight expansion (moderate curve)
    { level: 61, totalXP: 53840, xpToNext: 1300, perKillXP: 320, divisor: 1, expansion: 'Dragonflight' },
    { level: 62, totalXP: 55140, xpToNext: 1315, perKillXP: 325, divisor: 1, expansion: 'Dragonflight' },
    { level: 63, totalXP: 56455, xpToNext: 1325, perKillXP: 330, divisor: 1, expansion: 'Dragonflight' },
    { level: 64, totalXP: 57780, xpToNext: 1340, perKillXP: 335, divisor: 1, expansion: 'Dragonflight' },
    { level: 65, totalXP: 59120, xpToNext: 1355, perKillXP: 340, divisor: 1, expansion: 'Dragonflight' },
    { level: 66, totalXP: 60475, xpToNext: 1370, perKillXP: 345, divisor: 1, expansion: 'Dragonflight' },
    { level: 67, totalXP: 61845, xpToNext: 1380, perKillXP: 350, divisor: 1, expansion: 'Dragonflight' },
    { level: 68, totalXP: 63225, xpToNext: 1395, perKillXP: 355, divisor: 1, expansion: 'Dragonflight' },
    { level: 69, totalXP: 64620, xpToNext: -5975, perKillXP: 360, divisor: 1, expansion: 'Dragonflight' },

    // Level 70-80: The War Within expansion
    { level: 70, totalXP: 58645, xpToNext: 1690, perKillXP: 365, divisor: 1, expansion: 'The War Within' },
    { level: 71, totalXP: 60335, xpToNext: 1710, perKillXP: 370, divisor: 1, expansion: 'The War Within' },
    { level: 72, totalXP: 62045, xpToNext: 1735, perKillXP: 375, divisor: 1, expansion: 'The War Within' },
    { level: 73, totalXP: 63780, xpToNext: 1760, perKillXP: 380, divisor: 1, expansion: 'The War Within' },
    { level: 74, totalXP: 65540, xpToNext: 1785, perKillXP: 385, divisor: 1, expansion: 'The War Within' },
    { level: 75, totalXP: 67325, xpToNext: 1805, perKillXP: 390, divisor: 1, expansion: 'The War Within' },
    { level: 76, totalXP: 69130, xpToNext: 1835, perKillXP: 395, divisor: 1, expansion: 'The War Within' },
    { level: 77, totalXP: 70965, xpToNext: 1855, perKillXP: 400, divisor: 1, expansion: 'The War Within' },
    { level: 78, totalXP: 72820, xpToNext: 1880, perKillXP: 405, divisor: 1, expansion: 'The War Within' },
    { level: 79, totalXP: 74700, xpToNext: 329025, perKillXP: 410, divisor: 1, expansion: 'The War Within' },

    // Level 80-89: Midnight expansion (divisor 9, steep curve)
    // Note: Divisor 9 means quest XP and other rewards are divided by 9 at these levels
    { level: 80, totalXP: 403725, xpToNext: 19665, perKillXP: 450, divisor: 1, expansion: 'Midnight' },
    { level: 81, totalXP: 423390, xpToNext: 20005, perKillXP: 455, divisor: 9, expansion: 'Midnight' },
    { level: 82, totalXP: 443395, xpToNext: 20345, perKillXP: 460, divisor: 9, expansion: 'Midnight' },
    { level: 83, totalXP: 463740, xpToNext: 20690, perKillXP: 465, divisor: 9, expansion: 'Midnight' },
    { level: 84, totalXP: 484430, xpToNext: 21025, perKillXP: 470, divisor: 9, expansion: 'Midnight' },
    { level: 85, totalXP: 505455, xpToNext: 21370, perKillXP: 475, divisor: 9, expansion: 'Midnight' },
    { level: 86, totalXP: 526825, xpToNext: 21710, perKillXP: 480, divisor: 9, expansion: 'Midnight' },
    { level: 87, totalXP: 548535, xpToNext: 22055, perKillXP: 485, divisor: 9, expansion: 'Midnight' },
    { level: 88, totalXP: 570590, xpToNext: 22390, perKillXP: 490, divisor: 9, expansion: 'Midnight' },
    { level: 89, totalXP: 592980, xpToNext: 0, perKillXP: 495, divisor: 9, expansion: 'Midnight' },

    // Level 90: Max level
    { level: 90, totalXP: 99999999, xpToNext: 0, perKillXP: 530, divisor: 9, expansion: 'Midnight' },
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

    // Handle level squish levels where XP might be negative or zero
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
