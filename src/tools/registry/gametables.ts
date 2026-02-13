/**
 * GameTable Tools Registry
 *
 * Game calculation data tools: combat ratings, XP, stats, base mana, HP per stamina.
 *
 * @module tools/registry/gametables
 */

import { ToolRegistryEntry, jsonResponse, textResponse } from "./types";
import { queryGameTable, listGameTables, getCombatRating, getBaseMana, getXPForLevel, getHpPerSta } from "../gametable";

export const gametableTools: ToolRegistryEntry[] = [
  {
    definition: {
      name: "query-gametable",
      description: "Query a GameTable file for game calculation data (combat ratings, XP, stats, etc.)",
      inputSchema: {
        type: "object",
        properties: {
          tableName: {
            type: "string",
            description: "GameTable file name (e.g., 'CombatRatings.txt', 'xp.txt')",
          },
          rowId: {
            type: "number",
            description: "Optional: specific row/level to query",
          },
          maxRows: {
            type: "number",
            description: "Optional: maximum rows to return (default: 100)",
          },
        },
        required: ["tableName"],
      },
    },
    handler: async (args) => {
      const result = await queryGameTable(
        args.tableName as string,
        args.rowId as number | undefined,
        (args.maxRows as number | undefined) || 100
      );
      return jsonResponse(result);
    },
  },
  {
    definition: {
      name: "list-gametables",
      description: "List all available GameTable files with descriptions",
      inputSchema: {
        type: "object",
        properties: {},
      },
    },
    handler: async () => {
      const tables = listGameTables();
      return jsonResponse(tables);
    },
  },
  {
    definition: {
      name: "get-combat-rating",
      description: "Get combat rating conversion value for a specific level and stat",
      inputSchema: {
        type: "object",
        properties: {
          level: {
            type: "number",
            description: "Character level (1-120+)",
          },
          statName: {
            type: "string",
            description: "Stat name (e.g., 'Crit - Melee', 'Haste - Spell', 'Mastery')",
          },
        },
        required: ["level", "statName"],
      },
    },
    handler: async (args) => {
      const level = args.level as number;
      const statName = args.statName as string;
      const result = await getCombatRating(level, statName);
      return textResponse(
        result !== null
          ? `At level ${level}, ${statName} rating: ${result.toFixed(6)}`
          : `Could not find ${statName} for level ${level}`
      );
    },
  },
  {
    definition: {
      name: "get-character-stats",
      description: "Get character stat values for a specific level (base mana, HP per stamina, XP required)",
      inputSchema: {
        type: "object",
        properties: {
          level: {
            type: "number",
            description: "Character level (1-120+)",
          },
          className: {
            type: "string",
            description: "Optional: class name for base mana (Warrior, Mage, etc.)",
          },
        },
        required: ["level"],
      },
    },
    handler: async (args) => {
      const level = args.level as number;
      const className = args.className as string | undefined;

      const stats: Record<string, unknown> = {
        level,
        xpRequired: await getXPForLevel(level),
        hpPerStamina: await getHpPerSta(level),
      };

      if (className) {
        stats.baseMana = await getBaseMana(level, className);
      }

      return jsonResponse(stats);
    },
  },
];
