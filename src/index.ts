#!/usr/bin/env node

/**
 * TrinityCore MCP Server
 * Provides Model Context Protocol tools for TrinityCore game data access
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { getSpellInfo } from "./tools/spell.js";
import { getItemInfo } from "./tools/item.js";
import { getQuestInfo } from "./tools/quest.js";
import { queryDBC } from "./tools/dbc.js";
import { getTrinityAPI } from "./tools/api.js";
import { getOpcodeInfo } from "./tools/opcode.js";
import { queryGameTable, listGameTables, getCombatRating, getBaseMana, getXPForLevel, getHpPerSta } from "./tools/gametable.js";
import {
  getCreatureFullInfo,
  searchCreatures,
  getCreaturesByType,
  getAllVendors,
  getAllTrainers,
  getCreaturesByFaction,
  getCreatureStatistics
} from "./tools/creature.js";
import {
  calculateSpellDamage,
  calculateSpellHealing,
  compareSpells,
  calculateStatWeights,
  calculateRotationDps,
  getOptimalSpell
} from "./tools/spellcalculator.js";
import {
  getPointsOfInterest,
  getGameObjectsByEntry,
  getCreatureSpawns,
  findNearbyCreatures,
  findNearbyGameObjects
} from "./tools/worlddata.js";
import {
  getQuestPrerequisites,
  traceQuestChain,
  findQuestChainsInZone,
  getQuestRewards,
  findQuestHubs,
  analyzeQuestObjectives,
  optimizeQuestPath
} from "./tools/questchain.js";
import {
  getProfessionRecipes,
  calculateSkillUpPlan,
  findProfitableRecipes
} from "./tools/profession.js";
import {
  calculateItemScore,
  compareItems,
  findBestInSlot,
  optimizeGearSet,
  getDefaultStatWeights
} from "./tools/gearoptimizer.js";
import {
  getClassSpecializations,
  getRecommendedTalentBuild,
  compareTalentTier,
  optimizeTalentBuild
} from "./tools/talent.js";
import {
  calculateMeleeDamage,
  calculateArmorMitigation,
  calculateThreat,
  calculateDiminishingReturns
} from "./tools/combatmechanics.js";
import {
  getBuffRecommendations,
  analyzeGroupBuffCoverage,
  optimizeConsumables
} from "./tools/buffoptimizer.js";
import {
  getBossMechanics,
  getDungeonLayout,
  getOptimalGroupComposition,
  getMythicPlusStrategy
} from "./tools/dungeonstrategy.js";
import {
  getItemPricing,
  analyzeAuctionHouse,
  findArbitrageOpportunities,
  calculateProfessionProfitability,
  getGoldMakingStrategies
} from "./tools/economy.js";
import {
  getFactionInfo,
  calculateReputationStanding,
  getReputationGrindPath,
  getReputationRewards
} from "./tools/reputation.js";
import {
  analyzeGroupComposition,
  coordinateCooldowns,
  createTacticalAssignments,
  optimizeGroupDps
} from "./tools/coordination.js";
import {
  analyzeArenaComposition,
  getArenaStrategy,
  getBattlegroundStrategy,
  getPvPTalentBuild,
  getSoloShuffleStrategy
} from "./tools/pvptactician.js";
import {
  optimizeQuestRoute,
  getOptimalLevelingPath,
  analyzeQuestReward,
  getDailyQuestCircuit
} from "./tools/questroute.js";
import {
  getCollectionStatus,
  findMissingCollectibles,
  getFarmingRoute,
  createCompletionPlan
} from "./tools/collection.js";

// MCP Server instance
const server = new Server(
  {
    name: "trinitycore-mcp-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Define available tools
const TOOLS: Tool[] = [
  {
    name: "get-spell-info",
    description: "Get detailed information about a spell from TrinityCore database",
    inputSchema: {
      type: "object",
      properties: {
        spellId: {
          type: "number",
          description: "The spell ID to query",
        },
      },
      required: ["spellId"],
    },
  },
  {
    name: "get-item-info",
    description: "Get detailed information about an item from TrinityCore database",
    inputSchema: {
      type: "object",
      properties: {
        itemId: {
          type: "number",
          description: "The item ID (entry) to query",
        },
      },
      required: ["itemId"],
    },
  },
  {
    name: "get-quest-info",
    description: "Get detailed information about a quest from TrinityCore database",
    inputSchema: {
      type: "object",
      properties: {
        questId: {
          type: "number",
          description: "The quest ID to query",
        },
      },
      required: ["questId"],
    },
  },
  {
    name: "query-dbc",
    description: "Query a DBC/DB2 file for client-side game data",
    inputSchema: {
      type: "object",
      properties: {
        dbcFile: {
          type: "string",
          description: "Name of the DBC/DB2 file (e.g., 'Spell.dbc', 'Item.db2')",
        },
        recordId: {
          type: "number",
          description: "Record ID to retrieve",
        },
      },
      required: ["dbcFile", "recordId"],
    },
  },
  {
    name: "get-trinity-api",
    description: "Get TrinityCore C++ API documentation for a class or function",
    inputSchema: {
      type: "object",
      properties: {
        className: {
          type: "string",
          description: "Name of the C++ class (e.g., 'Player', 'Unit', 'Creature')",
        },
        methodName: {
          type: "string",
          description: "Optional: specific method name to search for",
        },
      },
      required: ["className"],
    },
  },
  {
    name: "get-opcode-info",
    description: "Get information about a network packet opcode",
    inputSchema: {
      type: "object",
      properties: {
        opcode: {
          type: "string",
          description: "Opcode name (e.g., 'CMSG_CAST_SPELL', 'SMSG_SPELL_GO')",
        },
      },
      required: ["opcode"],
    },
  },
  {
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
  {
    name: "list-gametables",
    description: "List all available GameTable files with descriptions",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
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
  {
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
  {
    name: "get-creature-full-info",
    description: "Get complete creature/NPC information including template, difficulties, vendor items, trainer spells, loot, and AI analysis",
    inputSchema: {
      type: "object",
      properties: {
        entry: {
          type: "number",
          description: "Creature entry ID",
        },
        includeLoot: {
          type: "boolean",
          description: "Optional: include loot table (can be large, default: false)",
        },
      },
      required: ["entry"],
    },
  },
  {
    name: "search-creatures",
    description: "Search for creatures matching filters (name, type, faction, classification, etc.)",
    inputSchema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Optional: partial name match",
        },
        type: {
          type: "number",
          description: "Optional: creature type (0=None, 1=Beast, 2=Dragonkin, 3=Demon, etc.)",
        },
        family: {
          type: "number",
          description: "Optional: creature family (for beasts/pets)",
        },
        classification: {
          type: "number",
          description: "Optional: classification (0=Normal, 1=Elite, 2=Rare Elite, 3=Boss, 4=Rare)",
        },
        faction: {
          type: "number",
          description: "Optional: faction ID",
        },
        expansion: {
          type: "number",
          description: "Optional: required expansion ID",
        },
        isBoss: {
          type: "boolean",
          description: "Optional: filter for bosses only",
        },
        isElite: {
          type: "boolean",
          description: "Optional: filter for elite/rare/boss creatures",
        },
        isVendor: {
          type: "boolean",
          description: "Optional: filter for vendors only",
        },
        isTrainer: {
          type: "boolean",
          description: "Optional: filter for trainers only",
        },
        limit: {
          type: "number",
          description: "Optional: maximum results (default: 50)",
        },
      },
    },
  },
  {
    name: "get-creatures-by-type",
    description: "Get all creatures of a specific type (Beast, Humanoid, Undead, etc.)",
    inputSchema: {
      type: "object",
      properties: {
        creatureType: {
          type: "number",
          description: "Creature type (0=None, 1=Beast, 2=Dragonkin, 3=Demon, 4=Elemental, 5=Giant, 6=Undead, 7=Humanoid, etc.)",
        },
        limit: {
          type: "number",
          description: "Optional: maximum results (default: 50)",
        },
      },
      required: ["creatureType"],
    },
  },
  {
    name: "get-all-vendors",
    description: "Get list of all vendor NPCs in the database",
    inputSchema: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "Optional: maximum results (default: 100)",
        },
      },
    },
  },
  {
    name: "get-all-trainers",
    description: "Get list of all trainer NPCs in the database",
    inputSchema: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "Optional: maximum results (default: 100)",
        },
      },
    },
  },
  {
    name: "get-creatures-by-faction",
    description: "Get all creatures belonging to a specific faction",
    inputSchema: {
      type: "object",
      properties: {
        faction: {
          type: "number",
          description: "Faction ID",
        },
        limit: {
          type: "number",
          description: "Optional: maximum results (default: 100)",
        },
      },
      required: ["faction"],
    },
  },
  {
    name: "get-creature-statistics",
    description: "Get statistical breakdown of creatures (counts by type, classification, vendors, trainers, bosses)",
    inputSchema: {
      type: "object",
      properties: {
        type: {
          type: "number",
          description: "Optional: filter by creature type",
        },
        faction: {
          type: "number",
          description: "Optional: filter by faction",
        },
        expansion: {
          type: "number",
          description: "Optional: filter by expansion",
        },
      },
    },
  },
  {
    name: "get-class-specializations",
    description: "Get all available specializations for a WoW class",
    inputSchema: {
      type: "object",
      properties: {
        classId: {
          type: "number",
          description: "Class ID (1=Warrior, 2=Paladin, 3=Hunter, etc.)",
        },
      },
      required: ["classId"],
    },
  },
  {
    name: "get-talent-build",
    description: "Get recommended talent build for a spec and purpose (leveling, raid, dungeon, pvp, solo)",
    inputSchema: {
      type: "object",
      properties: {
        specId: {
          type: "number",
          description: "Specialization ID",
        },
        purpose: {
          type: "string",
          description: "Build purpose: leveling, raid, dungeon, pvp, or solo",
        },
        playerLevel: {
          type: "number",
          description: "Player level",
        },
      },
      required: ["specId", "purpose", "playerLevel"],
    },
  },
  {
    name: "calculate-melee-damage",
    description: "Calculate melee damage with weapon stats, attack power, and crit",
    inputSchema: {
      type: "object",
      properties: {
        weaponDPS: {
          type: "number",
          description: "Weapon DPS value",
        },
        attackSpeed: {
          type: "number",
          description: "Weapon attack speed in seconds",
        },
        attackPower: {
          type: "number",
          description: "Total attack power",
        },
        critRating: {
          type: "number",
          description: "Critical strike rating",
        },
        level: {
          type: "number",
          description: "Player level",
        },
      },
      required: ["weaponDPS", "attackSpeed", "attackPower", "critRating", "level"],
    },
  },
  {
    name: "calculate-armor-mitigation",
    description: "Calculate damage reduction from armor",
    inputSchema: {
      type: "object",
      properties: {
        rawDamage: {
          type: "number",
          description: "Raw incoming damage",
        },
        armor: {
          type: "number",
          description: "Target's armor value",
        },
        attackerLevel: {
          type: "number",
          description: "Attacker's level",
        },
      },
      required: ["rawDamage", "armor", "attackerLevel"],
    },
  },
  {
    name: "get-buff-recommendations",
    description: "Get buff and consumable recommendations for a role and class",
    inputSchema: {
      type: "object",
      properties: {
        role: {
          type: "string",
          description: "Role: tank, healer, melee_dps, or ranged_dps",
        },
        classId: {
          type: "number",
          description: "Class ID",
        },
        budget: {
          type: "number",
          description: "Optional: gold budget in copper for consumables",
        },
        contentType: {
          type: "string",
          description: "Optional: raid, dungeon, solo, or pvp",
        },
      },
      required: ["role", "classId"],
    },
  },
  {
    name: "get-boss-mechanics",
    description: "Get boss mechanics, abilities, and strategy for a boss creature",
    inputSchema: {
      type: "object",
      properties: {
        bossCreatureId: {
          type: "number",
          description: "Boss creature entry ID",
        },
      },
      required: ["bossCreatureId"],
    },
  },
  {
    name: "get-mythic-plus-strategy",
    description: "Get Mythic+ specific strategy for keystone level and affixes",
    inputSchema: {
      type: "object",
      properties: {
        keystoneLevel: {
          type: "number",
          description: "Mythic+ keystone level (2-30)",
        },
        affixes: {
          type: "array",
          items: { type: "string" },
          description: "Active affixes (e.g., Fortified, Tyrannical, Sanguine)",
        },
      },
      required: ["keystoneLevel", "affixes"],
    },
  },
  {
    name: "get-item-pricing",
    description: "Get item pricing information including vendor prices and estimated market value",
    inputSchema: {
      type: "object",
      properties: {
        itemId: {
          type: "number",
          description: "Item ID to price",
        },
      },
      required: ["itemId"],
    },
  },
  {
    name: "get-gold-making-strategies",
    description: "Get gold-making strategies based on player level and professions",
    inputSchema: {
      type: "object",
      properties: {
        playerLevel: {
          type: "number",
          description: "Player level",
        },
        professions: {
          type: "array",
          items: { type: "string" },
          description: "Known professions (e.g., Mining, Herbalism, Alchemy)",
        },
      },
      required: ["playerLevel", "professions"],
    },
  },
  {
    name: "get-reputation-standing",
    description: "Calculate reputation standing from raw reputation value",
    inputSchema: {
      type: "object",
      properties: {
        factionId: {
          type: "number",
          description: "Faction ID",
        },
        factionName: {
          type: "string",
          description: "Faction name",
        },
        currentReputation: {
          type: "number",
          description: "Current reputation value",
        },
      },
      required: ["factionId", "factionName", "currentReputation"],
    },
  },
  {
    name: "get-reputation-grind-path",
    description: "Get optimal reputation grinding path from current to target standing",
    inputSchema: {
      type: "object",
      properties: {
        factionId: {
          type: "number",
          description: "Faction ID",
        },
        factionName: {
          type: "string",
          description: "Faction name",
        },
        currentRep: {
          type: "number",
          description: "Current reputation value",
        },
        targetStanding: {
          type: "string",
          description: "Target standing: friendly, honored, revered, or exalted",
        },
      },
      required: ["factionId", "factionName", "currentRep", "targetStanding"],
    },
  },
  {
    name: "analyze-group-composition",
    description: "Analyze group composition for balance, strengths, and weaknesses",
    inputSchema: {
      type: "object",
      properties: {
        bots: {
          type: "array",
          items: {
            type: "object",
            properties: {
              botId: { type: "string" },
              name: { type: "string" },
              classId: { type: "number" },
              className: { type: "string" },
              role: { type: "string" },
              level: { type: "number" },
              itemLevel: { type: "number" },
            },
          },
          description: "Array of bot information objects",
        },
      },
      required: ["bots"],
    },
  },
  {
    name: "coordinate-cooldowns",
    description: "Create coordinated cooldown plan for group encounters",
    inputSchema: {
      type: "object",
      properties: {
        bots: {
          type: "array",
          items: { type: "object" },
          description: "Array of bot information objects",
        },
        encounterDuration: {
          type: "number",
          description: "Expected encounter duration in seconds",
        },
      },
      required: ["bots", "encounterDuration"],
    },
  },
  {
    name: "analyze-arena-composition",
    description: "Analyze PvP arena team composition with strengths, weaknesses, and strategy",
    inputSchema: {
      type: "object",
      properties: {
        bracket: {
          type: "string",
          description: "Arena bracket: 2v2, 3v3, 5v5, or solo_shuffle",
        },
        team: {
          type: "array",
          items: { type: "object" },
          description: "Array of team member objects",
        },
        rating: {
          type: "number",
          description: "Current arena rating",
        },
      },
      required: ["bracket", "team", "rating"],
    },
  },
  {
    name: "get-battleground-strategy",
    description: "Get battleground strategy including objectives, roles, and timing",
    inputSchema: {
      type: "object",
      properties: {
        bgId: {
          type: "number",
          description: "Battleground ID (2=WSG, 3=AB, etc.)",
        },
      },
      required: ["bgId"],
    },
  },
  {
    name: "get-pvp-talent-build",
    description: "Get PvP talent build for spec and bracket",
    inputSchema: {
      type: "object",
      properties: {
        specId: {
          type: "number",
          description: "Specialization ID",
        },
        bracket: {
          type: "string",
          description: "PvP bracket: 2v2, 3v3, 5v5, rbg, or solo_shuffle",
        },
      },
      required: ["specId", "bracket"],
    },
  },
  {
    name: "optimize-quest-route",
    description: "Optimize quest route for a zone with XP/hour calculations",
    inputSchema: {
      type: "object",
      properties: {
        zoneId: {
          type: "number",
          description: "Zone/map ID",
        },
        playerLevel: {
          type: "number",
          description: "Current player level",
        },
        maxQuests: {
          type: "number",
          description: "Optional: maximum number of quests (default: 30)",
        },
      },
      required: ["zoneId", "playerLevel"],
    },
  },
  {
    name: "get-leveling-path",
    description: "Get optimal leveling path from start to target level",
    inputSchema: {
      type: "object",
      properties: {
        startLevel: {
          type: "number",
          description: "Starting level",
        },
        targetLevel: {
          type: "number",
          description: "Target level to reach",
        },
        faction: {
          type: "string",
          description: "Player faction: alliance or horde",
        },
      },
      required: ["startLevel", "targetLevel", "faction"],
    },
  },
  {
    name: "get-collection-status",
    description: "Get collection status for pets, mounts, toys, or heirlooms",
    inputSchema: {
      type: "object",
      properties: {
        type: {
          type: "string",
          description: "Collection type: pet, mount, toy, or heirloom",
        },
      },
      required: ["type"],
    },
  },
  {
    name: "find-missing-collectibles",
    description: "Find missing collectibles by type and rarity",
    inputSchema: {
      type: "object",
      properties: {
        type: {
          type: "string",
          description: "Collectible type: pet, mount, or toy",
        },
        minRarity: {
          type: "string",
          description: "Optional: minimum rarity filter (default: uncommon)",
        },
      },
      required: ["type"],
    },
  },
  {
    name: "get-farming-route",
    description: "Get farming route for a specific collectible",
    inputSchema: {
      type: "object",
      properties: {
        collectibleId: {
          type: "number",
          description: "Item ID of the collectible",
        },
        type: {
          type: "string",
          description: "Collectible type: pet, mount, or toy",
        },
      },
      required: ["collectibleId", "type"],
    },
  },
];

// List tools handler
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: TOOLS,
  };
});

// Call tool handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (!args) {
    throw new Error("Missing arguments");
  }

  try {
    switch (name) {
      case "get-spell-info": {
        const spellId = args.spellId as number;
        const result = await getSpellInfo(spellId);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "get-item-info": {
        const itemId = args.itemId as number;
        const result = await getItemInfo(itemId);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "get-quest-info": {
        const questId = args.questId as number;
        const result = await getQuestInfo(questId);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "query-dbc": {
        const dbcFile = args.dbcFile as string;
        const recordId = args.recordId as number;
        const result = await queryDBC(dbcFile, recordId);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "get-trinity-api": {
        const className = args.className as string;
        const methodName = args.methodName as string | undefined;
        const result = await getTrinityAPI(className, methodName);
        return {
          content: [
            {
              type: "text",
              text: result,
            },
          ],
        };
      }

      case "get-opcode-info": {
        const opcode = args.opcode as string;
        const result = await getOpcodeInfo(opcode);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "query-gametable": {
        const tableName = args.tableName as string;
        const rowId = args.rowId as number | undefined;
        const maxRows = (args.maxRows as number | undefined) || 100;
        const result = await queryGameTable(tableName, rowId, maxRows);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "list-gametables": {
        const tables = listGameTables();
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(tables, null, 2),
            },
          ],
        };
      }

      case "get-combat-rating": {
        const level = args.level as number;
        const statName = args.statName as string;
        const result = await getCombatRating(level, statName);
        return {
          content: [
            {
              type: "text",
              text: result !== null
                ? `At level ${level}, ${statName} rating: ${result.toFixed(6)}`
                : `Could not find ${statName} for level ${level}`,
            },
          ],
        };
      }

      case "get-character-stats": {
        const level = args.level as number;
        const className = args.className as string | undefined;

        const stats: any = {
          level,
          xpRequired: await getXPForLevel(level),
          hpPerStamina: await getHpPerSta(level),
        };

        if (className) {
          stats.baseMana = await getBaseMana(level, className);
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(stats, null, 2),
            },
          ],
        };
      }

      case "get-creature-full-info": {
        const entry = args.entry as number;
        const includeLoot = (args.includeLoot as boolean) || false;
        const result = await getCreatureFullInfo(entry, includeLoot);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "search-creatures": {
        const filters: any = {};
        if (args.name) filters.name = args.name as string;
        if (args.type !== undefined) filters.type = args.type as number;
        if (args.family !== undefined) filters.family = args.family as number;
        if (args.classification !== undefined) filters.classification = args.classification as number;
        if (args.faction !== undefined) filters.faction = args.faction as number;
        if (args.expansion !== undefined) filters.expansion = args.expansion as number;
        if (args.isBoss !== undefined) filters.isBoss = args.isBoss as boolean;
        if (args.isElite !== undefined) filters.isElite = args.isElite as boolean;
        if (args.isVendor !== undefined) filters.isVendor = args.isVendor as boolean;
        if (args.isTrainer !== undefined) filters.isTrainer = args.isTrainer as boolean;
        if (args.limit !== undefined) filters.limit = args.limit as number;

        const result = await searchCreatures(filters);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "get-creatures-by-type": {
        const creatureType = args.creatureType as number;
        const limit = (args.limit as number) || 50;
        const result = await getCreaturesByType(creatureType, limit);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "get-all-vendors": {
        const limit = (args.limit as number) || 100;
        const result = await getAllVendors(limit);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "get-all-trainers": {
        const limit = (args.limit as number) || 100;
        const result = await getAllTrainers(limit);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "get-creatures-by-faction": {
        const faction = args.faction as number;
        const limit = (args.limit as number) || 100;
        const result = await getCreaturesByFaction(faction, limit);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "get-creature-statistics": {
        const filters: any = {};
        if (args.type !== undefined) filters.type = args.type as number;
        if (args.faction !== undefined) filters.faction = args.faction as number;
        if (args.expansion !== undefined) filters.expansion = args.expansion as number;

        const result = await getCreatureStatistics(filters);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "get-class-specializations": {
        const classId = args.classId as number;
        const result = await getClassSpecializations(classId);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "get-talent-build": {
        const specId = args.specId as number;
        const purpose = args.purpose as "leveling" | "raid" | "dungeon" | "pvp" | "solo";
        const playerLevel = args.playerLevel as number;
        const result = getRecommendedTalentBuild(specId, purpose, playerLevel);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "calculate-melee-damage": {
        const result = await calculateMeleeDamage({
          weaponDPS: args.weaponDPS as number,
          attackSpeed: args.attackSpeed as number,
          attackPower: args.attackPower as number,
          critRating: args.critRating as number,
          level: args.level as number,
        });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "calculate-armor-mitigation": {
        const result = await calculateArmorMitigation(
          args.rawDamage as number,
          args.armor as number,
          args.attackerLevel as number
        );
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "get-buff-recommendations": {
        // Get default stat weights for the class (use first spec as default)
        const classId = args.classId as number;
        const defaultSpecId = classId * 10; // Simplified default spec selection
        const statWeights = getDefaultStatWeights(classId, defaultSpecId);
        const result = getBuffRecommendations({
          role: args.role as "tank" | "healer" | "melee_dps" | "ranged_dps",
          classId: classId,
          statWeights,
          budget: args.budget as number | undefined,
          contentType: (args.contentType as "raid" | "dungeon" | "solo" | "pvp" | undefined) || "raid",
        });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "get-boss-mechanics": {
        const result = await getBossMechanics(args.bossCreatureId as number);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "get-mythic-plus-strategy": {
        const result = getMythicPlusStrategy(
          args.keystoneLevel as number,
          args.affixes as string[]
        );
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "get-item-pricing": {
        const result = await getItemPricing(args.itemId as number);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "get-gold-making-strategies": {
        const result = getGoldMakingStrategies(
          args.playerLevel as number,
          args.professions as string[]
        );
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "get-reputation-standing": {
        const result = calculateReputationStanding(
          args.factionId as number,
          args.factionName as string,
          args.currentReputation as number
        );
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "get-reputation-grind-path": {
        const result = getReputationGrindPath(
          args.factionId as number,
          args.factionName as string,
          args.currentRep as number,
          args.targetStanding as string
        );
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "analyze-group-composition": {
        const result = analyzeGroupComposition(args.bots as any[]);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "coordinate-cooldowns": {
        const result = coordinateCooldowns(
          args.bots as any[],
          args.encounterDuration as number
        );
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "analyze-arena-composition": {
        const result = analyzeArenaComposition(
          args.bracket as any,
          args.team as any[],
          args.rating as number
        );
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "get-battleground-strategy": {
        const result = await getBattlegroundStrategy(args.bgId as number);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "get-pvp-talent-build": {
        const result = getPvPTalentBuild(
          args.specId as number,
          args.bracket as any
        );
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "optimize-quest-route": {
        const result = await optimizeQuestRoute(
          args.zoneId as number,
          args.playerLevel as number,
          args.maxQuests as number | undefined
        );
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "get-leveling-path": {
        const result = await getOptimalLevelingPath(
          args.startLevel as number,
          args.targetLevel as number,
          args.faction as "alliance" | "horde"
        );
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "get-collection-status": {
        const result = await getCollectionStatus(
          args.type as any,
          args.accountId as number | undefined
        );
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "find-missing-collectibles": {
        const result = await findMissingCollectibles(
          args.type as "pet" | "mount" | "toy",
          args.minRarity as string | undefined
        );
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "get-farming-route": {
        const result = await getFarmingRoute(
          args.collectibleId as number,
          args.type as "pet" | "mount" | "toy"
        );
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: "text",
          text: `Error: ${errorMessage}`,
        },
      ],
      isError: true,
    };
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("TrinityCore MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
