/**
 * GameTable (GT) file reading tool
 * These files contain critical game calculations used by TrinityCore
 */

import * as fs from "fs";
import * as path from "path";

const GT_PATH = process.env.GT_PATH || "./data/gt";

export interface GameTableInfo {
  file: string;
  headers: string[];
  rowCount: number;
  rows?: GameTableRow[];
  error?: string;
}

export interface GameTableRow {
  id: number;
  values: { [column: string]: number };
}

/**
 * Available GameTables in TrinityCore (WoW 12.0 Midnight - 20 tables)
 *
 * Note: ChallengeModeDamage.txt and ChallengeModeHealth.txt were removed in 12.0
 */
export const GAME_TABLES = {
  // Artifact System
  "ArtifactKnowledgeMultiplier.txt": "Artifact Knowledge multiplier per level",
  "ArtifactLevelXP.txt": "XP required for artifact power levels",

  // Character Stats
  "BaseMp.txt": "Base mana per class and level",
  "HpPerSta.txt": "Health gained per point of stamina",
  "SpellScaling.txt": "Spell power scaling per class and level",

  // Combat Ratings
  "CombatRatings.txt": "Combat rating conversion factors per level (crit, haste, mastery, etc.)",
  "CombatRatingsMultByILvl.txt": "Item level multipliers for combat ratings",

  // Item Levels
  "ItemLevelByLevel.txt": "Expected item level per character level",
  "ItemLevelSquish.txt": "Item level squish formula (if present)",
  "ItemSocketCostPerLevel.txt": "Cost to socket items per level",
  "StaminaMultByILvl.txt": "Stamina multipliers by item level",

  // Experience
  "xp.txt": "Experience required per level",

  // Battle Pets
  "BattlePetXP.txt": "Battle pet XP progression",
  "BattlePetTypeDamageMod.txt": "Battle pet type damage modifiers",

  // NPC Scaling
  "NPCManaCostScaler.txt": "NPC spell mana cost scaling",
  "SandboxScaling.txt": "Sandbox mode scaling factors",

  // Profession
  "BaseProfessionRatings.txt": "Base profession skill ratings",
  "ProfessionRatings.txt": "Profession skill scaling",

  // Other
  "BarberShopCostBase.txt": "Barber shop service costs",
  "HonorLevel.txt": "PvP honor level progression",
};

/**
 * Query a GameTable file
 */
export async function queryGameTable(
  tableName: string,
  rowId?: number,
  maxRows: number = 100
): Promise<GameTableInfo> {
  try {
    const filePath = path.join(GT_PATH, tableName);

    if (!fs.existsSync(filePath)) {
      return {
        file: tableName,
        headers: [],
        rowCount: 0,
        error: `GameTable file not found: ${filePath}`,
      };
    }

    const content = fs.readFileSync(filePath, "utf-8");
    const lines = content.split(/\r?\n/).filter(line => line.trim());

    if (lines.length === 0) {
      return {
        file: tableName,
        headers: [],
        rowCount: 0,
        error: "GameTable file is empty",
      };
    }

    // Parse headers
    const headers = lines[0].split("\t");

    // Parse data rows
    const dataLines = lines.slice(1);
    const rows: GameTableRow[] = [];

    for (let i = 0; i < dataLines.length; i++) {
      const line = dataLines[i];
      const values = line.split("\t");

      if (values.length === 0) continue;

      const id = parseInt(values[0]);

      // If specific row requested, only return that row
      if (rowId !== undefined && id !== rowId) {
        continue;
      }

      const row: GameTableRow = {
        id,
        values: {},
      };

      // Map values to column names (skip first column which is ID)
      for (let j = 1; j < Math.min(values.length, headers.length); j++) {
        const columnName = headers[j];
        const value = parseFloat(values[j]);
        row.values[columnName] = isNaN(value) ? 0 : value;
      }

      rows.push(row);

      // Limit rows if not requesting specific row
      if (rowId === undefined && rows.length >= maxRows) {
        break;
      }
    }

    return {
      file: tableName,
      headers: headers.slice(1), // Remove ID column from headers
      rowCount: dataLines.length,
      rows,
    };
  } catch (error) {
    return {
      file: tableName,
      headers: [],
      rowCount: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Get documentation for a specific GameTable
 */
export function getGameTableDoc(tableName: string): string {
  const doc = GAME_TABLES[tableName as keyof typeof GAME_TABLES];
  if (doc) {
    return `${tableName}: ${doc}`;
  }

  return `${tableName}: No documentation available`;
}

/**
 * List all available GameTables
 */
export function listGameTables(): { [file: string]: string } {
  return GAME_TABLES;
}

/**
 * Get specific value from a GameTable
 * Useful for calculations like: "Get crit rating for level 60"
 */
export async function getGameTableValue(
  tableName: string,
  rowId: number,
  columnName: string
): Promise<number | null> {
  const result = await queryGameTable(tableName, rowId, 1);

  if (result.error || !result.rows || result.rows.length === 0) {
    return null;
  }

  return result.rows[0].values[columnName] ?? null;
}

/**
 * Get combat rating value for a specific level and stat
 * Example: getCombatRating(60, "Crit - Melee") returns the rating needed for 1% crit at level 60
 */
export async function getCombatRating(level: number, statName: string): Promise<number | null> {
  return getGameTableValue("CombatRatings.txt", level, statName);
}

/**
 * Get base mana for a class at a specific level
 */
export async function getBaseMana(level: number, className: string): Promise<number | null> {
  return getGameTableValue("BaseMp.txt", level, className);
}

/**
 * Get XP required for a specific level
 */
export async function getXPForLevel(level: number): Promise<number | null> {
  const result = await queryGameTable("xp.txt", level, 1);
  if (result.error || !result.rows || result.rows.length === 0) {
    return null;
  }
  return result.rows[0].values["Total"] ?? null;
}

/**
 * Get health per stamina at a specific level
 */
export async function getHpPerSta(level: number): Promise<number | null> {
  return getGameTableValue("HpPerSta.txt", level, "Health");
}
