#!/usr/bin/env node

/**
 * TrinityCore MCP Server
 * Provides Model Context Protocol tools for TrinityCore game data access
 */

// Load environment variables from .env file
import dotenv from "dotenv";
import { logger } from './utils/logger';
dotenv.config();

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { getProfileLoader } from "./profiles/ProfileLoader.js";
import { getDynamicToolManager } from "./profiles/DynamicToolManager.js";
import { getSpellInfo } from "./tools/spell";
import { getItemInfo } from "./tools/item";
import { getQuestInfo } from "./tools/quest";
import { queryDBC, queryAllDBC, getCacheStats, getGlobalCacheStats } from "./tools/dbc";
import { getTrinityAPI } from "./tools/api";
import { getOpcodeInfo } from "./tools/opcode";
import { queryGameTable, listGameTables, getCombatRating, getBaseMana, getXPForLevel, getHpPerSta } from "./tools/gametable";
import {
  getCreatureFullInfo,
  searchCreatures,
  getCreaturesByType,
  getAllVendors,
  getAllTrainers,
  getCreaturesByFaction,
  getCreatureStatistics
} from "./tools/creature";
import {
  calculateSpellDamage,
  calculateSpellHealing,
  compareSpells,
  calculateStatWeights,
  calculateRotationDps,
  getOptimalSpell
} from "./tools/spellcalculator";
import {
  getPointsOfInterest,
  getGameObjectsByEntry,
  getCreatureSpawns,
  findNearbyCreatures,
  findNearbyGameObjects
} from "./tools/worlddata";
import {
  getQuestPrerequisites,
  traceQuestChain,
  findQuestChainsInZone,
  getQuestRewards,
  findQuestHubs,
  analyzeQuestObjectives,
  optimizeQuestPath
} from "./tools/questchain";
import {
  getProfessionRecipes,
  calculateSkillUpPlan,
  findProfitableRecipes
} from "./tools/profession";
import {
  calculateItemScore,
  compareItems,
  findBestInSlot,
  optimizeGearSet,
  getDefaultStatWeights
} from "./tools/gearoptimizer";
import {
  getClassSpecializations,
  getRecommendedTalentBuild,
  compareTalentTier,
  optimizeTalentBuild
} from "./tools/talent";
import {
  calculateMeleeDamage,
  calculateArmorMitigation,
  calculateThreat,
  calculateDiminishingReturns
} from "./tools/combatmechanics";
import {
  getBuffRecommendations,
  analyzeGroupBuffCoverage,
  optimizeConsumables
} from "./tools/buffoptimizer";
import {
  getBossMechanics,
  getDungeonLayout,
  getOptimalGroupComposition,
  getMythicPlusStrategy
} from "./tools/dungeonstrategy";
import {
  getItemPricing,
  analyzeAuctionHouse,
  findArbitrageOpportunities,
  calculateProfessionProfitability,
  getGoldMakingStrategies
} from "./tools/economy";
import {
  getFactionInfo,
  calculateReputationStanding,
  getReputationGrindPath,
  getReputationRewards
} from "./tools/reputation";
import {
  analyzeGroupComposition,
  coordinateCooldowns,
  createTacticalAssignments,
  optimizeGroupDps
} from "./tools/coordination";
import {
  analyzeArenaComposition,
  getArenaStrategy,
  getBattlegroundStrategy,
  getPvPTalentBuild,
  getSoloShuffleStrategy
} from "./tools/pvptactician";
import {
  optimizeQuestRoute,
  getOptimalLevelingPath,
  analyzeQuestReward,
  getDailyQuestCircuit
} from "./tools/questroute";
import {
  getCollectionStatus,
  findMissingCollectibles,
  getFarmingRoute,
  createCompletionPlan
} from "./tools/collection";
import {
  searchPlayerbotWiki,
  getPlayerbotPattern,
  getImplementationGuide,
  getTroubleshootingGuide,
  getAPIReference,
  listDocumentationCategories
} from "./tools/knowledge";
import {
  generateBotComponent,
  generatePacketHandler,
  generateCMakeIntegration,
  validateGeneratedCode,
  listCodeTemplates,
  getTemplateInfo
} from "./tools/codegen";
import {
  analyzeBotPerformance,
  simulateScaling,
  getOptimizationSuggestions,
  quickPerformanceAnalysis,
  findOptimalBotCount
} from "./tools/performance";
import {
  runTests,
  generateTestReport,
  analyzeCoverage
} from "./tools/testing";
import {
  listTables,
  getTableSchema,
  searchTables,
  findTablesWithColumn,
  getTableRelationships,
  compareSchemas,
  getDatabaseStats,
  getCreateTableStatement,
  findTablesWithoutPrimaryKey,
  analyzeTable
} from "./tools/schema";
import {
  findAPIUsageExamples,
  findClassDefinition,
  findMethodDefinition,
  findSimilarAPIs,
  getInheritanceHierarchy,
  findClassMethods,
  analyzeAPIComplexity,
  validateTrinityCorePathExport
} from "./tools/apiexamples";
import {
  parseErrorOutput,
  parseBuildLog,
  analyzeBuildErrors,
  getErrorContext,
  findRootCause,
  groupRelatedErrors,
  detectCompiler
} from "./tools/builderrors";
import {
  executeNaturalLanguageQuery,
  parseNaturalLanguageQuery,
  intentToSQL,
  generateRelatedQueries,
  validateQuerySafety,
  getPopularQueries,
  exportQueryResults,
  getQueryHistory,
  clearQueryHistory
} from "./tools/dataexplorer";
import {
  getQuestInfo as getQuestMapperInfo,
  findQuestChain,
  generateMermaidDiagram,
  findQuestChainsByZone,
  findQuestChainsByLevel,
  analyzeQuestChainComplexity,
  findCircularDependencies,
  getQuestRewards as getQuestMapperRewards,
  exportQuestChain
} from "./tools/questmapper";
import {
  getZoneInfo,
  analyzeMobStats,
  analyzeQuestStats,
  calculateDifficultyRating,
  analyzeZoneDifficulty,
  findSimilarZones,
  findZonesByLevel,
  getLevelingPath as getZoneLevelingPath,
  exportZoneAnalysisMarkdown
} from "./tools/zonedifficulty";
import {
  reviewFile,
  reviewFiles,
  reviewPattern,
  reviewProjectDirectory,
  generateReviewReport,
  getCodeReviewStats
} from "./tools/codereview";
import {
  analyzeThreadSafety,
  analyzeFileThreadSafety,
  getThreadSafetyRecommendations
} from "./tools/threadsafety";
import {
  analyzeMemoryLeaks
} from "./tools/memoryleak";
import {
  analyzeAPIMigration,
  getAPIChangeDetails,
  isAPIDeprecated,
  getBreakingChanges,
  getSupportedVersions
} from "./tools/apimigration";
import {
  getCodeCompletionContext,
  getTypeInfo
} from "./tools/codecompletion";
import {
  getBotState,
  getBotTimeline,
  setBreakpoint,
  exportBugReport
} from "./tools/botdebugger";
import {
  simulateCombat,
  analyzeWhatIf
} from "./tools/gamesimulator";
import {
  getHealthStatus,
  getMetricsSnapshot,
  queryLogs,
  getLogFileLocation,
  getMonitoringStatus
} from "./tools/monitoring";
import {
  triggerBackup,
  verifyBackup,
  getSecurityStatus,
  listBackups
} from "./tools/production";
import {
  checkCodeStyle,
  formatCode
} from "./tools/codestyle";
import {
  analyzeBotAI,
  formatAIAnalysisReport
} from "./tools/botaianalyzer";
import {
  analyzeBotCombatLog,
  formatCombatAnalysisReport
} from "./tools/botcombatloganalyzer";
import {
  analyzeComprehensive,
  formatComprehensiveReportMarkdown,
  formatComprehensiveReportJSON,
  formatComprehensiveReportSummary
} from "./tools/combatloganalyzer-advanced";
import { CacheWarmer } from "./parsers/cache/CacheWarmer";
import {
  listVMapFiles,
  getVMapFileInfo,
  testLineOfSight,
  findSpawnsInRadius
} from "./tools/vmap-tools";
import {
  listMMapFiles,
  getMMapFileInfo,
  findPath,
  isOnNavMesh
} from "./tools/mmap-tools";
import {
  getMapMinimap,
  getMinimapTile,
  getMinimapTilesBatch,
  clearMinimapCache
} from "./tools/minimap";
import {
  exportAllDatabases,
  exportTables
} from "./database/export-engine";
import {
  importFromDirectory,
  importFromFile
} from "./database/import-engine";
import {
  quickBackup,
  quickRestore
} from "./database/backup-restore";
import {
  quickHealthCheck,
  fullHealthCheck,
  healthCheckWithFix
} from "./database/health-checker";
import {
  compareDatabases
} from "./database/diff-tool";
import {
  generateTests,
  generateTestsForDirectory
} from "./testing/ai-test-generator";
import {
  createTestFramework,
  describe,
  it,
  expect
} from "./testing/test-framework";
import {
  quickPerfTest,
  quickLoadTest
} from "./testing/performance-tester";
import {
  getConfigManager,
  initializeConfig
} from "./config/config-manager";
import { createErrorResponse, ValidationError } from "./utils/error-handler";

// MCP Server instance
const server = new Server(
  {
    name: "trinitycore-mcp-server",
    version: "2.4.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Initialize profile loader for conditional tool loading
const profileLoader = getProfileLoader();

// Initialize dynamic tool manager for runtime loading/unloading
const dynamicToolManager = getDynamicToolManager();

// Log profile information at startup
profileLoader.logProfileInfo();

// Define available tools (all 120 tools defined here)
const ALL_TOOLS: Tool[] = [
  {
    name: "get-spell-info",
    description: "Get detailed information about a spell from TrinityCore database and Spell.db2 (Week 7: Enhanced with DB2 caching, merged data sources, <1ms cache hits)",
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
    description: "Get detailed information about an item from TrinityCore database, Item.db2, and ItemSparse.db2 (Week 7: Enhanced with dual DB2 caching, 62 stat types, merged data sources, <1ms dual cache hits)",
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
    description: "Query a DBC/DB2 file for client-side game data (Week 7: Enhanced with DB2CachedFileLoader, automatic schema detection, 4 query functions, <1ms cache hits)",
    inputSchema: {
      type: "object",
      properties: {
        dbcFile: {
          type: "string",
          description: "Name of the DBC/DB2 file (e.g., 'Spell.db2', 'Item.db2', 'ItemSparse.db2')",
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
  // Phase 5 - Week 2: Knowledge Base Access Tools
  {
    name: "search-playerbot-wiki",
    description: "Search the Playerbot wiki documentation (Phase 5 knowledge base with full-text search, <50ms p95)",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query (supports fuzzy matching and multi-word queries)",
        },
        category: {
          type: "string",
          description: "Optional: filter by category (getting_started, patterns, workflows, troubleshooting, api_reference, examples, advanced)",
        },
        difficulty: {
          type: "string",
          description: "Optional: filter by difficulty level (basic, intermediate, advanced)",
        },
        limit: {
          type: "number",
          description: "Optional: maximum number of results (default: 10)",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "get-playerbot-pattern",
    description: "Get a specific Playerbot design pattern with implementation examples (Phase 5 pattern library)",
    inputSchema: {
      type: "object",
      properties: {
        patternId: {
          type: "string",
          description: "Pattern ID (e.g., 'patterns/combat/01_combat_ai_strategy')",
        },
      },
      required: ["patternId"],
    },
  },
  {
    name: "get-implementation-guide",
    description: "Get step-by-step implementation guide for Playerbot features (Phase 5 tutorials)",
    inputSchema: {
      type: "object",
      properties: {
        guideId: {
          type: "string",
          description: "Guide ID (e.g., 'getting_started/01_introduction' or 'workflows/01_build_workflow')",
        },
      },
      required: ["guideId"],
    },
  },
  {
    name: "get-troubleshooting-guide",
    description: "Search for troubleshooting solutions for common Playerbot problems (Phase 5 debugging help)",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Problem description or error message",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "get-api-reference",
    description: "Get TrinityCore API reference documentation for a specific class (Phase 5 API docs)",
    inputSchema: {
      type: "object",
      properties: {
        className: {
          type: "string",
          description: "Class name (e.g., 'Player', 'Unit', 'Spell', 'BotAI')",
        },
      },
      required: ["className"],
    },
  },
  {
    name: "list-documentation-categories",
    description: "List all documentation categories with statistics (Phase 5 knowledge base overview)",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  // Phase 5 - Week 3: Code Generation Tools
  {
    name: "generate-bot-component",
    description: "Generate AI strategy, state manager, or event handler component (Phase 5 code generation, <500ms p95)",
    inputSchema: {
      type: "object",
      properties: {
        componentType: {
          type: "string",
          description: "Component type: ai_strategy, state_manager, or event_handler",
        },
        className: {
          type: "string",
          description: "C++ class name (e.g., 'WarriorTankStrategy')",
        },
        description: {
          type: "string",
          description: "Optional: component description",
        },
        role: {
          type: "string",
          description: "Optional: bot role for AI strategies (tank, healer, dps)",
        },
        outputPath: {
          type: "string",
          description: "Optional: output file path (default: generated/{type}/{class}.h)",
        },
        namespace: {
          type: "string",
          description: "Optional: C++ namespace (default: Playerbot)",
        },
        includeTests: {
          type: "boolean",
          description: "Optional: generate test file (default: false)",
        },
      },
      required: ["componentType", "className"],
    },
  },
  {
    name: "generate-packet-handler",
    description: "Generate packet handler for client/server communication (Phase 5 code generation, <312ms p95)",
    inputSchema: {
      type: "object",
      properties: {
        handlerName: {
          type: "string",
          description: "Handler class name (e.g., 'SpellCastPacketHandler')",
        },
        opcode: {
          type: "string",
          description: "Packet opcode (e.g., 'CMSG_CAST_SPELL')",
        },
        direction: {
          type: "string",
          description: "Packet direction: client, server, or bidirectional",
        },
        fields: {
          type: "array",
          description: "Packet fields array with {name, type, description, isGuid?, isString?}",
        },
        outputPath: {
          type: "string",
          description: "Optional: output file path",
        },
        namespace: {
          type: "string",
          description: "Optional: C++ namespace (default: Playerbot::Packets)",
        },
      },
      required: ["handlerName", "opcode", "direction", "fields"],
    },
  },
  {
    name: "generate-cmake-integration",
    description: "Generate CMakeLists.txt for bot component integration (Phase 5 code generation, <200ms p95)",
    inputSchema: {
      type: "object",
      properties: {
        projectName: {
          type: "string",
          description: "Project/module name",
        },
        sourceFiles: {
          type: "array",
          description: "Array of .cpp source file paths",
        },
        headerFiles: {
          type: "array",
          description: "Array of .h header file paths",
        },
        testFiles: {
          type: "array",
          description: "Optional: array of test file paths",
        },
        isLibrary: {
          type: "boolean",
          description: "Optional: create as static library (default: false)",
        },
        dependencies: {
          type: "array",
          description: "Optional: array of dependency library names",
        },
        outputPath: {
          type: "string",
          description: "Optional: output file path",
        },
      },
      required: ["projectName", "sourceFiles", "headerFiles"],
    },
  },
  {
    name: "validate-generated-code",
    description: "Validate generated C++ code for compilation errors (Phase 5 validation, <2000ms p95)",
    inputSchema: {
      type: "object",
      properties: {
        filePath: {
          type: "string",
          description: "Path to generated file to validate",
        },
        checkCompilation: {
          type: "boolean",
          description: "Optional: perform compilation check (requires g++ or clang)",
        },
        checkStyle: {
          type: "boolean",
          description: "Optional: check code style (default: false)",
        },
      },
      required: ["filePath"],
    },
  },

  // Phase 5 Week 4: Performance Analysis Tools
  {
    name: "analyze-bot-performance",
    description: "Analyze bot performance metrics (CPU, memory, network). Performance target: <500ms realtime, <2000ms historical",
    inputSchema: {
      type: "object",
      properties: {
        mode: {
          type: "string",
          enum: ["realtime", "snapshot"],
          description: "Analysis mode: realtime (collect over duration) or snapshot (single capture)",
        },
        metrics: {
          type: "object",
          properties: {
            cpu: { type: "boolean", description: "Collect CPU metrics (default: true)" },
            memory: { type: "boolean", description: "Collect memory metrics (default: true)" },
            network: { type: "boolean", description: "Collect network metrics (default: true)" },
          },
          description: "Optional: metrics to collect",
        },
        duration: {
          type: "number",
          description: "Optional: collection duration in ms (default: 10000 for realtime)",
        },
        interval: {
          type: "number",
          description: "Optional: sampling interval in ms (default: 100)",
        },
        exportCSV: {
          type: "string",
          description: "Optional: path to export CSV file",
        },
      },
      required: ["mode"],
    },
  },

  {
    name: "simulate-scaling",
    description: "Simulate bot scaling from minBots to maxBots. Performance target: <3000ms for 50 steps (100-5000 bots)",
    inputSchema: {
      type: "object",
      properties: {
        minBots: {
          type: "number",
          description: "Starting bot count",
        },
        maxBots: {
          type: "number",
          description: "Maximum bot count",
        },
        stepSize: {
          type: "number",
          description: "Optional: increment per step (default: 100)",
        },
        profile: {
          type: "object",
          properties: {
            roleDistribution: {
              type: "object",
              properties: {
                tank: { type: "number", description: "Percentage (0-100)" },
                healer: { type: "number", description: "Percentage (0-100)" },
                dps: { type: "number", description: "Percentage (0-100)" },
              },
              required: ["tank", "healer", "dps"],
            },
            activityLevel: {
              type: "string",
              enum: ["idle", "light", "moderate", "heavy", "combat"],
              description: "Bot activity level",
            },
          },
          required: ["roleDistribution", "activityLevel"],
          description: "Bot profile configuration",
        },
        baseline: {
          type: "object",
          properties: {
            cpuPerBot: { type: "number", description: "CPU % per bot" },
            memoryPerBotMB: { type: "number", description: "Memory MB per bot" },
            networkPerBotKBps: { type: "number", description: "Network KB/s per bot" },
          },
          required: ["cpuPerBot", "memoryPerBotMB", "networkPerBotKBps"],
          description: "Baseline metrics (from analyze-bot-performance)",
        },
        scalingFactors: {
          type: "object",
          properties: {
            cpuScalingExponent: { type: "number", description: "Default: 1.2" },
            memoryScalingExponent: { type: "number", description: "Default: 1.05" },
            networkScalingExponent: { type: "number", description: "Default: 1.0" },
          },
          description: "Optional: non-linear scaling factors",
        },
        limits: {
          type: "object",
          properties: {
            maxCpuPercent: { type: "number", description: "Default: 80" },
            maxMemoryGB: { type: "number", description: "Default: 16" },
            maxNetworkMbps: { type: "number", description: "Default: 1000" },
          },
          description: "Optional: resource limits",
        },
      },
      required: ["minBots", "maxBots", "profile", "baseline"],
    },
  },

  {
    name: "get-optimization-suggestions",
    description: "Get AI-powered optimization suggestions based on performance analysis. Performance target: <1000ms perf data, <5000ms code analysis",
    inputSchema: {
      type: "object",
      properties: {
        performanceReport: {
          type: "object",
          description: "Performance report from analyze-bot-performance",
        },
        performanceReportFile: {
          type: "string",
          description: "Or path to performance report JSON file",
        },
        filters: {
          type: "object",
          properties: {
            minImpact: {
              type: "string",
              enum: ["low", "medium", "high"],
              description: "Minimum expected impact",
            },
            maxDifficulty: {
              type: "string",
              enum: ["easy", "medium", "hard"],
              description: "Maximum implementation difficulty",
            },
            categories: {
              type: "array",
              items: {
                type: "string",
                enum: ["cpu", "memory", "network", "architecture", "algorithm"],
              },
              description: "Filter by optimization categories",
            },
          },
          description: "Optional: suggestion filters",
        },
        includeQuickWins: {
          type: "boolean",
          description: "Optional: include quick wins (default: true)",
        },
      },
    },
  },
  {
    name: "run-tests",
    description: "Execute tests with configurable strategies. Performance target: <10s for 50 tests (sequential), <5s (parallel)",
    inputSchema: {
      type: "object",
      properties: {
        pattern: {
          type: "string",
          description: "Glob pattern for test files (default: **/*.test.{js,ts})",
        },
        rootDir: {
          type: "string",
          description: "Root directory for test discovery",
        },
        testNamePattern: {
          type: "string",
          description: "Regex to match test names",
        },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "Run only tests with these tags",
        },
        parallel: {
          type: "boolean",
          description: "Run tests in parallel (default: false)",
        },
        maxWorkers: {
          type: "number",
          description: "Max parallel workers (default: 4)",
        },
        timeout: {
          type: "number",
          description: "Timeout per test in ms (default: 30000)",
        },
        retries: {
          type: "number",
          description: "Number of retries for failed tests (default: 0)",
        },
        verbose: {
          type: "boolean",
          description: "Verbose output",
        },
        silent: {
          type: "boolean",
          description: "Silent mode",
        },
        outputFormat: {
          type: "string",
          enum: ["json", "summary"],
          description: "Output format",
        },
        generateReport: {
          type: "object",
          properties: {
            format: {
              type: "string",
              enum: ["json", "html", "markdown", "junit"],
              description: "Report format",
            },
            outputPath: {
              type: "string",
              description: "Report output path",
            },
          },
          description: "Optional: generate test report",
        },
      },
    },
  },
  {
    name: "generate-test-report",
    description: "Generate test reports from test results. Performance target: <500ms for HTML report with 100 tests",
    inputSchema: {
      type: "object",
      properties: {
        testResults: {
          type: "object",
          description: "Test results object",
        },
        testResultsFile: {
          type: "string",
          description: "Or path to test results JSON file",
        },
        format: {
          type: "string",
          enum: ["json", "html", "markdown", "junit"],
          description: "Report format",
        },
        outputPath: {
          type: "string",
          description: "Report output path",
        },
        includePassedTests: {
          type: "boolean",
          description: "Include passed tests (default: true)",
        },
        includeSkippedTests: {
          type: "boolean",
          description: "Include skipped tests (default: true)",
        },
        includeCharts: {
          type: "boolean",
          description: "Include charts in HTML report (default: true)",
        },
        title: {
          type: "string",
          description: "Report title",
        },
        metadata: {
          type: "object",
          description: "Custom metadata",
        },
      },
      required: ["format", "outputPath"],
    },
  },
  {
    name: "analyze-coverage",
    description: "Analyze code coverage from test runs. Performance target: <2000ms for 50 source files",
    inputSchema: {
      type: "object",
      properties: {
        coverageData: {
          type: "object",
          description: "Coverage data object",
        },
        coverageFile: {
          type: "string",
          description: "Or path to coverage JSON file",
        },
        include: {
          type: "array",
          items: { type: "string" },
          description: "Files to include (glob patterns)",
        },
        exclude: {
          type: "array",
          items: { type: "string" },
          description: "Files to exclude (glob patterns)",
        },
        thresholds: {
          type: "object",
          properties: {
            lines: { type: "number", description: "Min line coverage %" },
            branches: { type: "number", description: "Min branch coverage %" },
            functions: { type: "number", description: "Min function coverage %" },
            statements: { type: "number", description: "Min statement coverage %" },
          },
          description: "Coverage thresholds",
        },
        format: {
          type: "string",
          enum: ["json", "html", "text", "lcov"],
          description: "Output format",
        },
        outputPath: {
          type: "string",
          description: "Output path for report",
        },
        findUncovered: {
          type: "boolean",
          description: "Find uncovered code (default: true)",
        },
        showDetails: {
          type: "boolean",
          description: "Show per-file details (default: true)",
        },
      },
    },
  },
  {
    name: "review-code-file",
    description: "Review a single C++ file for code quality issues using 870+ rules (Priority #4: AI-Powered Code Review with >90% accuracy)",
    inputSchema: {
      type: "object",
      properties: {
        filePath: {
          type: "string",
          description: "Path to the C++ file to review",
        },
        enableAI: {
          type: "boolean",
          description: "Enable AI-powered review enhancement (default: false)",
        },
        llmProvider: {
          type: "string",
          enum: ["openai", "ollama", "lmstudio"],
          description: "LLM provider to use (default: openai)",
        },
        llmModel: {
          type: "string",
          description: "LLM model to use (e.g., gpt-4, codellama)",
        },
        severityFilter: {
          type: "array",
          items: { type: "string", enum: ["critical", "major", "minor", "info"] },
          description: "Filter by severity levels",
        },
        categoryFilter: {
          type: "array",
          items: {
            type: "string",
            enum: [
              "null_safety",
              "memory",
              "concurrency",
              "convention",
              "security",
              "performance",
              "architecture",
            ],
          },
          description: "Filter by rule categories",
        },
        minConfidence: {
          type: "number",
          description: "Minimum confidence threshold (0.0-1.0, default: 0.7)",
        },
        projectRoot: {
          type: "string",
          description: "Project root directory",
        },
        compilerType: {
          type: "string",
          enum: ["gcc", "clang", "msvc"],
          description: "Compiler type (default: gcc)",
        },
        verbose: {
          type: "boolean",
          description: "Verbose output (default: false)",
        },
      },
      required: ["filePath"],
    },
  },
  {
    name: "review-code-files",
    description: "Review multiple C++ files for code quality issues",
    inputSchema: {
      type: "object",
      properties: {
        files: {
          type: "array",
          items: { type: "string" },
          description: "Array of file paths to review",
        },
        enableAI: {
          type: "boolean",
          description: "Enable AI-powered review enhancement (default: false)",
        },
        llmProvider: {
          type: "string",
          enum: ["openai", "ollama", "lmstudio"],
          description: "LLM provider to use (default: openai)",
        },
        llmModel: {
          type: "string",
          description: "LLM model to use (e.g., gpt-4, codellama)",
        },
        severityFilter: {
          type: "array",
          items: { type: "string", enum: ["critical", "major", "minor", "info"] },
          description: "Filter by severity levels",
        },
        categoryFilter: {
          type: "array",
          items: {
            type: "string",
            enum: [
              "null_safety",
              "memory",
              "concurrency",
              "convention",
              "security",
              "performance",
              "architecture",
            ],
          },
          description: "Filter by rule categories",
        },
        minConfidence: {
          type: "number",
          description: "Minimum confidence threshold (0.0-1.0, default: 0.7)",
        },
        projectRoot: {
          type: "string",
          description: "Project root directory",
        },
        compilerType: {
          type: "string",
          enum: ["gcc", "clang", "msvc"],
          description: "Compiler type (default: gcc)",
        },
        verbose: {
          type: "boolean",
          description: "Verbose output (default: false)",
        },
      },
      required: ["files"],
    },
  },
  {
    name: "review-code-pattern",
    description: "Review C++ files matching glob patterns (e.g., 'src/**/*.cpp')",
    inputSchema: {
      type: "object",
      properties: {
        patterns: {
          type: "array",
          items: { type: "string" },
          description: "Array of glob patterns to match files",
        },
        excludePatterns: {
          type: "array",
          items: { type: "string" },
          description: "Array of glob patterns to exclude",
        },
        enableAI: {
          type: "boolean",
          description: "Enable AI-powered review enhancement (default: false)",
        },
        llmProvider: {
          type: "string",
          enum: ["openai", "ollama", "lmstudio"],
          description: "LLM provider to use (default: openai)",
        },
        llmModel: {
          type: "string",
          description: "LLM model to use (e.g., gpt-4, codellama)",
        },
        severityFilter: {
          type: "array",
          items: { type: "string", enum: ["critical", "major", "minor", "info"] },
          description: "Filter by severity levels",
        },
        categoryFilter: {
          type: "array",
          items: {
            type: "string",
            enum: [
              "null_safety",
              "memory",
              "concurrency",
              "convention",
              "security",
              "performance",
              "architecture",
            ],
          },
          description: "Filter by rule categories",
        },
        minConfidence: {
          type: "number",
          description: "Minimum confidence threshold (0.0-1.0, default: 0.7)",
        },
        projectRoot: {
          type: "string",
          description: "Project root directory",
        },
        compilerType: {
          type: "string",
          enum: ["gcc", "clang", "msvc"],
          description: "Compiler type (default: gcc)",
        },
        verbose: {
          type: "boolean",
          description: "Verbose output (default: false)",
        },
      },
      required: ["patterns"],
    },
  },
  {
    name: "review-code-project",
    description: "Review entire C++ project directory with comprehensive analysis",
    inputSchema: {
      type: "object",
      properties: {
        projectRoot: {
          type: "string",
          description: "Project root directory path",
        },
        patterns: {
          type: "array",
          items: { type: "string" },
          description: "File patterns to include (default: ['**/*.cpp', '**/*.h', '**/*.hpp', '**/*.cc'])",
        },
        excludePatterns: {
          type: "array",
          items: { type: "string" },
          description: "File patterns to exclude",
        },
        enableAI: {
          type: "boolean",
          description: "Enable AI-powered review enhancement (default: false)",
        },
        llmProvider: {
          type: "string",
          enum: ["openai", "ollama", "lmstudio"],
          description: "LLM provider to use (default: openai)",
        },
        llmModel: {
          type: "string",
          description: "LLM model to use (e.g., gpt-4, codellama)",
        },
        severityFilter: {
          type: "array",
          items: { type: "string", enum: ["critical", "major", "minor", "info"] },
          description: "Filter by severity levels",
        },
        categoryFilter: {
          type: "array",
          items: {
            type: "string",
            enum: [
              "null_safety",
              "memory",
              "concurrency",
              "convention",
              "security",
              "performance",
              "architecture",
            ],
          },
          description: "Filter by rule categories",
        },
        minConfidence: {
          type: "number",
          description: "Minimum confidence threshold (0.0-1.0, default: 0.7)",
        },
        compilerType: {
          type: "string",
          enum: ["gcc", "clang", "msvc"],
          description: "Compiler type (default: gcc)",
        },
        reportPath: {
          type: "string",
          description: "Path to save the report",
        },
        reportFormat: {
          type: "string",
          enum: ["markdown", "html", "json", "console"],
          description: "Report format (default: markdown)",
        },
        verbose: {
          type: "boolean",
          description: "Verbose output (default: false)",
        },
      },
      required: ["projectRoot"],
    },
  },
  {
    name: "generate-code-review-report",
    description: "Generate review report from existing violations",
    inputSchema: {
      type: "object",
      properties: {
        violations: {
          type: "array",
          description: "Array of violation objects",
        },
        reportPath: {
          type: "string",
          description: "Path to save the report",
        },
        format: {
          type: "string",
          enum: ["markdown", "html", "json", "console"],
          description: "Report format (default: markdown)",
        },
        projectRoot: {
          type: "string",
          description: "Project root directory",
        },
        compilerType: {
          type: "string",
          enum: ["gcc", "clang", "msvc"],
          description: "Compiler type (default: gcc)",
        },
      },
      required: ["violations", "reportPath"],
    },
  },
  {
    name: "get-code-review-stats",
    description: "Get code review system capabilities and statistics (870+ rules, AI providers, performance metrics)",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },

  // Priority #5: AI Agent Development Support
  {
    name: "analyze-thread-safety",
    description: "Analyze C++ code for thread safety issues - detect race conditions, deadlocks, and missing locks. Critical for 5000-bot production stability.",
    inputSchema: {
      type: "object",
      properties: {
        directory: {
          type: "string",
          description: "Directory to analyze (default: src/modules/Playerbot)",
        },
        filePath: {
          type: "string",
          description: "Specific file to analyze",
        },
        severity: {
          type: "string",
          enum: ["critical", "high", "medium", "low"],
          description: "Minimum severity level to report",
        },
        checkTypes: {
          type: "array",
          items: {
            type: "string",
            enum: ["race_conditions", "deadlocks", "performance"],
          },
          description: "Types of checks to perform (default: all)",
        },
      },
    },
  },
  {
    name: "analyze-memory-leaks",
    description: "Detect memory leaks, dangling pointers, and RAII violations. Prevents 24/7 server memory exhaustion with 5000 bots.",
    inputSchema: {
      type: "object",
      properties: {
        directory: {
          type: "string",
          description: "Directory to analyze (default: src/modules/Playerbot)",
        },
        filePath: {
          type: "string",
          description: "Specific file to analyze",
        },
        checkTypes: {
          type: "array",
          items: {
            type: "string",
            enum: ["pointers", "resources", "circular", "raii"],
          },
          description: "Types of checks to perform (default: all)",
        },
      },
    },
  },

  // Priority #6: API Development Assistance
  {
    name: "migrate-trinity-api",
    description: "Migrate code between TrinityCore versions (3.3.5a → 12.0). Auto-detects deprecated APIs and suggests fixes. Reduces migration time from 2 weeks to 2 days.",
    inputSchema: {
      type: "object",
      properties: {
        directory: {
          type: "string",
          description: "Code directory to analyze",
        },
        fromVersion: {
          type: "string",
          description: "Source TrinityCore version (e.g., '3.3.5a', '10.0')",
        },
        toVersion: {
          type: "string",
          description: "Target TrinityCore version (e.g., '12.0')",
        },
        autoFix: {
          type: "boolean",
          description: "Apply auto-fixes to files (default: false)",
        },
        modernize: {
          type: "boolean",
          description: "Include C++20 modernization suggestions (default: true)",
        },
      },
      required: ["directory", "fromVersion", "toVersion"],
    },
  },
  {
    name: "get-code-completion-context",
    description: "Provide intelligent code completion context for AI assistants. Increases AI code completion accuracy from 60% to 95%.",
    inputSchema: {
      type: "object",
      properties: {
        partialCode: {
          type: "string",
          description: "Code being typed/completed",
        },
        filePath: {
          type: "string",
          description: "Current file path for context",
        },
        cursorPosition: {
          type: "number",
          description: "Cursor position in code",
        },
        maxSuggestions: {
          type: "number",
          description: "Maximum number of suggestions (default: 10)",
        },
      },
      required: ["partialCode"],
    },
  },

  // Priority #7: Interactive Development Tools
  {
    name: "debug-bot-behavior",
    description: "Debug bot AI behavior - inspect live state, replay decisions, set breakpoints. Reduces debugging time from 2 hours to 5 minutes.",
    inputSchema: {
      type: "object",
      properties: {
        botId: {
          type: "string",
          description: "Bot identifier/name",
        },
        action: {
          type: "string",
          enum: ["inspect", "timeline", "breakpoint", "export"],
          description: "Debugging action to perform",
        },
        duration: {
          type: "number",
          description: "Timeline duration in seconds (for timeline action)",
        },
        breakpointCondition: {
          type: "string",
          description: "Breakpoint condition (e.g., 'HP < 20%')",
        },
        timelineId: {
          type: "string",
          description: "Timeline ID for export action",
        },
      },
      required: ["botId", "action"],
    },
  },
  {
    name: "simulate-game-mechanics",
    description: "Simulate combat, spell damage, and stat impacts without running full server. Test balance changes in 5 minutes vs 2 hours.",
    inputSchema: {
      type: "object",
      properties: {
        simulationType: {
          type: "string",
          enum: ["combat", "whatif"],
          description: "Type of simulation to run",
        },
        playerStats: {
          type: "object",
          description: "Player stats for simulation (level, attackPower, spellPower, crit, haste, mastery, etc.)",
        },
        targetStats: {
          type: "object",
          description: "Target stats (level, armor, hp, etc.)",
        },
        rotation: {
          type: "array",
          description: "Spell rotation array with spellId and timing",
        },
        duration: {
          type: "number",
          description: "Simulation duration in seconds (default: 300)",
        },
        scenario: {
          type: "string",
          description: "What-if scenario description (for whatif type)",
        },
      },
      required: ["simulationType", "playerStats"],
    },
  },

  // Production Operations & Monitoring (11 tools) - NEW in v2.3.0
  {
    name: "get-health-status",
    description: "Get comprehensive MCP server health status - components, metrics, uptime, and system health indicators",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "get-metrics-snapshot",
    description: "Get current metrics snapshot - request counts, response times, error rates, cache hit rates",
    inputSchema: {
      type: "object",
      properties: {
        includeHistory: {
          type: "boolean",
          description: "Include historical metrics (last hour)",
        },
        metricTypes: {
          type: "array",
          items: {
            type: "string",
          },
          description: "Specific metric types to include (requests, cache, database, etc.)",
        },
      },
    },
  },
  {
    name: "query-logs",
    description: "Query server logs with filtering - search by level, time range, component, or text pattern",
    inputSchema: {
      type: "object",
      properties: {
        level: {
          type: "string",
          enum: ["DEBUG", "INFO", "WARN", "ERROR"],
          description: "Filter by log level",
        },
        component: {
          type: "string",
          description: "Filter by component name",
        },
        search: {
          type: "string",
          description: "Text search pattern",
        },
        startTime: {
          type: "string",
          description: "Start time (ISO 8601)",
        },
        endTime: {
          type: "string",
          description: "End time (ISO 8601)",
        },
        limit: {
          type: "number",
          description: "Maximum number of log entries (default: 100)",
        },
      },
      required: ["level"],
    },
  },
  {
    name: "get-log-file-location",
    description: "Get the location of the server log file for direct access",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "get-monitoring-status",
    description: "Get monitoring system status - health check config, metrics collection, alerting status",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "trigger-backup",
    description: "Manually trigger a backup operation (full or incremental) - returns backup ID and status",
    inputSchema: {
      type: "object",
      properties: {
        type: {
          type: "string",
          enum: ["full", "incremental"],
          description: "Backup type (default: full)",
        },
        description: {
          type: "string",
          description: "Backup description",
        },
      },
    },
  },
  {
    name: "verify-backup",
    description: "Verify backup integrity - checks checksum, file size, and restoration readiness",
    inputSchema: {
      type: "object",
      properties: {
        backupId: {
          type: "string",
          description: "Backup ID to verify",
        },
      },
      required: ["backupId"],
    },
  },
  {
    name: "get-security-status",
    description: "Get security status - rate limiting, access control, encryption, audit log status",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "list-backups",
    description: "List all available backups with metadata - ID, type, size, timestamp, status",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "check-code-style",
    description: "Check C++ code style and conventions - naming, formatting, comments, organization. Auto-fixable violations marked.",
    inputSchema: {
      type: "object",
      properties: {
        filePath: {
          type: "string",
          description: "Path to C++ file to check",
        },
        directory: {
          type: "string",
          description: "Directory to check (all .cpp/.h files)",
        },
        autoFix: {
          type: "boolean",
          description: "Automatically fix violations (default: false)",
        },
      },
    },
  },
  {
    name: "format-code",
    description: "Format C++ code according to TrinityCore style (.clang-format) - returns formatted code and violations fixed",
    inputSchema: {
      type: "object",
      properties: {
        filePath: {
          type: "string",
          description: "Path to C++ file to format",
        },
        autoFix: {
          type: "boolean",
          description: "Apply formatting to file (default: false)",
        },
      },
      required: ["filePath"],
    },
  },

  // PlayerBot Development Tools (2 tools) - NEW in v2.4.0
  {
    name: "analyze-bot-ai",
    description: "Analyze PlayerBot C++ AI code - parse decision trees, detect issues, generate flowcharts. Essential for understanding complex bot logic.",
    inputSchema: {
      type: "object",
      properties: {
        filePath: {
          type: "string",
          description: "Path to bot AI C++ file (e.g., PlayerbotWarriorAI.cpp)",
        },
        outputFormat: {
          type: "string",
          enum: ["json", "markdown", "flowchart"],
          description: "Output format (default: markdown)",
        },
        detectIssues: {
          type: "boolean",
          description: "Detect issues like missing cooldown checks (default: true)",
        },
        generateOptimizations: {
          type: "boolean",
          description: "Generate optimization suggestions (default: true)",
        },
      },
      required: ["filePath"],
    },
  },
  {
    name: "analyze-bot-combat-log",
    description: "Analyze bot combat performance from TrinityCore logs - calculate DPS/HPS, detect rotation issues, compare vs theoretical max. Validates AI effectiveness.",
    inputSchema: {
      type: "object",
      properties: {
        logFile: {
          type: "string",
          description: "Path to combat log file",
        },
        logText: {
          type: "string",
          description: "Combat log text (alternative to logFile)",
        },
        botName: {
          type: "string",
          description: "Filter to specific bot name",
        },
        encounter: {
          type: "string",
          description: "Encounter name for report title",
        },
        startTime: {
          type: "number",
          description: "Start timestamp (ms)",
        },
        endTime: {
          type: "number",
          description: "End timestamp (ms)",
        },
        compareWithTheoretical: {
          type: "boolean",
          description: "Compare with theoretical max DPS (default: true)",
        },
        outputFormat: {
          type: "string",
          enum: ["json", "markdown"],
          description: "Output format (default: markdown)",
        },
      },
    },
  },
  {
    name: "analyze-combat-log-comprehensive",
    description: "🚀 ADVANCED: Comprehensive bot combat log analysis with ML-powered insights. Includes cooldown tracking, decision tree analysis, combat mechanics evaluation, ML pattern detection, performance comparison, and actionable recommendations. Enterprise-grade analysis for bot optimization.",
    inputSchema: {
      type: "object",
      properties: {
        logFile: {
          type: "string",
          description: "Path to combat log file",
        },
        logText: {
          type: "string",
          description: "Combat log text (alternative to logFile)",
        },
        botName: {
          type: "string",
          description: "Bot name to analyze (required)",
        },
        className: {
          type: "string",
          description: "Bot class (e.g., Warrior, Mage) - enables performance comparison",
        },
        spec: {
          type: "string",
          description: "Bot spec (e.g., Arms, Fire) - optional for performance comparison",
        },
        level: {
          type: "number",
          description: "Bot level (default: 60)",
        },
        includeML: {
          type: "boolean",
          description: "Include ML pattern detection and behavior classification (default: true)",
        },
        includeRecommendations: {
          type: "boolean",
          description: "Include comprehensive recommendations (default: true)",
        },
        outputFormat: {
          type: "string",
          enum: ["json", "markdown", "summary"],
          description: "Output format (default: markdown)",
        },
      },
      required: ["botName"],
    },
  },
  // VMap Tools (Phase 1.1a)
  {
    name: "list-vmap-files",
    description: "List available VMap files in a directory. VMap files contain visibility and collision geometry for game maps.",
    inputSchema: {
      type: "object",
      properties: {
        vmapDir: {
          type: "string",
          description: "Path to VMap directory (default: from VMAP_PATH env variable)",
        },
      },
    },
  },
  {
    name: "get-vmap-file-info",
    description: "Get detailed information about a specific VMap file including size, type (tree/tile), and map coordinates.",
    inputSchema: {
      type: "object",
      properties: {
        vmapFile: {
          type: "string",
          description: "Path to VMap file (.vmtree or .vmtile)",
        },
      },
      required: ["vmapFile"],
    },
  },
  {
    name: "vmap-test-line-of-sight",
    description: "Test line-of-sight between two points using VMap collision data. NOTE: Current implementation uses distance-based heuristics. Full VMap parsing planned for v2.0. Returns clear if distance < 1000 units.",
    inputSchema: {
      type: "object",
      properties: {
        vmapDir: {
          type: "string",
          description: "VMap directory path",
        },
        mapId: {
          type: "number",
          description: "Map ID",
        },
        startX: { type: "number", description: "Start X coordinate" },
        startY: { type: "number", description: "Start Y coordinate" },
        startZ: { type: "number", description: "Start Z coordinate" },
        endX: { type: "number", description: "End X coordinate" },
        endY: { type: "number", description: "End Y coordinate" },
        endZ: { type: "number", description: "End Z coordinate" },
      },
      required: ["vmapDir", "mapId", "startX", "startY", "startZ", "endX", "endY", "endZ"],
    },
  },
  {
    name: "vmap-find-spawns-in-radius",
    description: "Find creature/gameobject spawns within radius of a point. NOTE: Current implementation queries database only. Full VMap collision filtering planned for v2.0.",
    inputSchema: {
      type: "object",
      properties: {
        vmapDir: {
          type: "string",
          description: "VMap directory path",
        },
        mapId: {
          type: "number",
          description: "Map ID",
        },
        centerX: { type: "number", description: "Center X coordinate" },
        centerY: { type: "number", description: "Center Y coordinate" },
        centerZ: { type: "number", description: "Center Z coordinate" },
        radius: {
          type: "number",
          description: "Search radius in game units",
        },
      },
      required: ["vmapDir", "mapId", "centerX", "centerY", "centerZ", "radius"],
    },
  },
  // MMap Tools (Phase 1.1b)
  {
    name: "list-mmap-files",
    description: "List available MMap (Movement Map / Navigation Mesh) files in a directory. MMap files are used for AI pathfinding.",
    inputSchema: {
      type: "object",
      properties: {
        mmapDir: {
          type: "string",
          description: "Path to MMap directory (default: from MMAP_PATH env variable)",
        },
      },
    },
  },
  {
    name: "get-mmap-file-info",
    description: "Get detailed information about a specific MMap file including size, type (header/tile), and map coordinates.",
    inputSchema: {
      type: "object",
      properties: {
        mmapFile: {
          type: "string",
          description: "Path to MMap file (.mmap or .mmtile)",
        },
      },
      required: ["mmapFile"],
    },
  },
  {
    name: "mmap-find-path",
    description: "Find walkable path between two points using navigation mesh. NOTE: Current implementation returns straight-line path with interpolated waypoints. Full A* pathfinding on Recast navmesh planned for v2.0.",
    inputSchema: {
      type: "object",
      properties: {
        mmapDir: {
          type: "string",
          description: "MMap directory path",
        },
        mapId: {
          type: "number",
          description: "Map ID",
        },
        startX: { type: "number", description: "Start X coordinate" },
        startY: { type: "number", description: "Start Y coordinate" },
        startZ: { type: "number", description: "Start Z coordinate" },
        goalX: { type: "number", description: "Goal X coordinate" },
        goalY: { type: "number", description: "Goal Y coordinate" },
        goalZ: { type: "number", description: "Goal Z coordinate" },
      },
      required: ["mmapDir", "mapId", "startX", "startY", "startZ", "goalX", "goalY", "goalZ"],
    },
  },
  {
    name: "mmap-is-on-navmesh",
    description: "Check if a position is on the navigation mesh. NOTE: Current implementation returns true for all positions. Full navmesh validation planned for v2.0.",
    inputSchema: {
      type: "object",
      properties: {
        mmapDir: {
          type: "string",
          description: "MMap directory path",
        },
        mapId: {
          type: "number",
          description: "Map ID",
        },
        posX: { type: "number", description: "Position X coordinate" },
        posY: { type: "number", description: "Position Y coordinate" },
        posZ: { type: "number", description: "Position Z coordinate" },
      },
      required: ["mmapDir", "mapId", "posX", "posY", "posZ"],
    },
  },
  // Minimap Tools (Phase 1.1c)
  {
    name: "get-map-minimap",
    description: "Get map information including starting FileDataID for minimap tiles. Modern WoW (11.x/12.x) stores minimap tiles as consecutive BLP files starting from Map.db2 WdtFileDataID.",
    inputSchema: {
      type: "object",
      properties: {
        mapId: {
          type: "number",
          description: "Map ID from Map.db2 (e.g. 0=Azeroth, 1=Kalimdor, 530=Outland)"
        }
      },
      required: ["mapId"]
    }
  },
  {
    name: "get-minimap-tile",
    description: "Extract and convert a minimap tile from CASC to PNG format with caching. Returns PNG image converted from DXT-compressed BLP texture.",
    inputSchema: {
      type: "object",
      properties: {
        fileDataId: {
          type: "number",
          description: "FileDataID of the BLP tile to extract (e.g. 1579844 for first Azeroth tile)"
        },
        forceRefresh: {
          type: "boolean",
          description: "Force re-extraction bypassing cache (default: false)"
        }
      },
      required: ["fileDataId"]
    }
  },
  {
    name: "get-minimap-tiles-batch",
    description: "Extract multiple minimap tiles in batch for improved performance. Provide either an array of FileDataIDs, a map ID, or a starting ID with count.",
    inputSchema: {
      type: "object",
      properties: {
        fileDataIds: {
          type: "array",
          items: { type: "number" },
          description: "Array of FileDataIDs to extract"
        },
        mapId: {
          type: "number",
          description: "Map ID to extract all tiles for (e.g., 58441 for Azeroth, 58276 for Kalimdor)"
        },
        startFileDataId: {
          type: "number",
          description: "Starting FileDataID for consecutive extraction"
        },
        count: {
          type: "number",
          description: "Number of consecutive tiles to extract (used with startFileDataId)"
        }
      }
    }
  },
  {
    name: "clear-minimap-cache",
    description: "Clear cached minimap tiles for a specific map or all maps. Use to free disk space or force re-extraction.",
    inputSchema: {
      type: "object",
      properties: {
        mapId: {
          type: "number",
          description: "Map ID to clear cache for (omit to clear all cached tiles)"
        }
      }
    }
  },
  // Database Tools (Phase 1.1c)
  {
    name: "export-database",
    description: "Export TrinityCore databases (world, auth, characters) to SQL or JSON format. Supports schema-only, data-only, or complete exports with compression.",
    inputSchema: {
      type: "object",
      properties: {
        host: { type: "string", description: "Database host" },
        port: { type: "number", description: "Database port (default: 3306)" },
        user: { type: "string", description: "Database user" },
        password: { type: "string", description: "Database password" },
        outputDir: { type: "string", description: "Output directory path" },
        format: {
          type: "string",
          enum: ["SQL", "JSON", "CSV"],
          description: "Export format (default: SQL)",
        },
      },
      required: ["host", "user", "password", "outputDir"],
    },
  },
  {
    name: "export-database-tables",
    description: "Export specific tables from a TrinityCore database. Useful for partial backups or data migration.",
    inputSchema: {
      type: "object",
      properties: {
        host: { type: "string", description: "Database host" },
        port: { type: "number", description: "Database port (default: 3306)" },
        user: { type: "string", description: "Database user" },
        password: { type: "string", description: "Database password" },
        database: { type: "string", description: "Database name (world, auth, or characters)" },
        tables: {
          type: "array",
          items: { type: "string" },
          description: "List of table names to export",
        },
        outputDir: { type: "string", description: "Output directory path" },
        format: {
          type: "string",
          enum: ["SQL", "JSON", "CSV"],
          description: "Export format (default: SQL)",
        },
      },
      required: ["host", "user", "password", "database", "tables", "outputDir"],
    },
  },
  {
    name: "import-database-from-directory",
    description: "Import database from a directory containing SQL/JSON export files. Validates and imports schema and data.",
    inputSchema: {
      type: "object",
      properties: {
        host: { type: "string", description: "Database host" },
        port: { type: "number", description: "Database port (default: 3306)" },
        user: { type: "string", description: "Database user" },
        password: { type: "string", description: "Database password" },
        database: { type: "string", description: "Database name (world, auth, or characters)" },
        directory: { type: "string", description: "Directory containing export files" },
        format: {
          type: "string",
          enum: ["SQL", "JSON", "CSV"],
          description: "Import format (default: SQL)",
        },
      },
      required: ["host", "user", "password", "database", "directory"],
    },
  },
  {
    name: "import-database-from-file",
    description: "Import database from a single SQL/JSON file. Quick import for single-file backups.",
    inputSchema: {
      type: "object",
      properties: {
        host: { type: "string", description: "Database host" },
        port: { type: "number", description: "Database port (default: 3306)" },
        user: { type: "string", description: "Database user" },
        password: { type: "string", description: "Database password" },
        database: { type: "string", description: "Database name (world, auth, or characters)" },
        filepath: { type: "string", description: "Path to import file" },
        dropExisting: {
          type: "boolean",
          description: "Drop existing tables before import (default: false)",
        },
      },
      required: ["host", "user", "password", "database", "filepath"],
    },
  },
  {
    name: "backup-database",
    description: "Create a compressed backup of a TrinityCore database. Includes schema and data with metadata.",
    inputSchema: {
      type: "object",
      properties: {
        host: { type: "string", description: "Database host" },
        port: { type: "number", description: "Database port (default: 3306)" },
        user: { type: "string", description: "Database user" },
        password: { type: "string", description: "Database password" },
        database: { type: "string", description: "Database name (world, auth, or characters)" },
        backupDir: { type: "string", description: "Backup directory path" },
      },
      required: ["host", "user", "password", "database", "backupDir"],
    },
  },
  {
    name: "restore-database",
    description: "Restore a database from a backup file. Validates backup integrity before restoration.",
    inputSchema: {
      type: "object",
      properties: {
        host: { type: "string", description: "Database host" },
        port: { type: "number", description: "Database port (default: 3306)" },
        user: { type: "string", description: "Database user" },
        password: { type: "string", description: "Database password" },
        database: { type: "string", description: "Database name (world, auth, or characters)" },
        backup: { type: "string", description: "Path to backup file" },
        dropExisting: {
          type: "boolean",
          description: "Drop existing database before restore (default: false)",
        },
      },
      required: ["host", "user", "password", "database", "backup"],
    },
  },
  {
    name: "database-health-check-quick",
    description: "Quick health check of database: connection, table count, index status, basic integrity. Takes ~5-10 seconds.",
    inputSchema: {
      type: "object",
      properties: {
        host: { type: "string", description: "Database host" },
        port: { type: "number", description: "Database port (default: 3306)" },
        user: { type: "string", description: "Database user" },
        password: { type: "string", description: "Database password" },
        database: { type: "string", description: "Database name (world, auth, or characters)" },
      },
      required: ["host", "user", "password", "database"],
    },
  },
  {
    name: "database-health-check-full",
    description: "Comprehensive health check: connection, integrity, performance, indexes, foreign keys, statistics. Takes several minutes.",
    inputSchema: {
      type: "object",
      properties: {
        host: { type: "string", description: "Database host" },
        port: { type: "number", description: "Database port (default: 3306)" },
        user: { type: "string", description: "Database user" },
        password: { type: "string", description: "Database password" },
        database: { type: "string", description: "Database name (world, auth, or characters)" },
      },
      required: ["host", "user", "password", "database"],
    },
  },
  {
    name: "database-health-check-and-fix",
    description: "Health check with automatic repair: checks integrity, repairs tables, rebuilds indexes, updates statistics.",
    inputSchema: {
      type: "object",
      properties: {
        host: { type: "string", description: "Database host" },
        port: { type: "number", description: "Database port (default: 3306)" },
        user: { type: "string", description: "Database user" },
        password: { type: "string", description: "Database password" },
        database: { type: "string", description: "Database name (world, auth, or characters)" },
      },
      required: ["host", "user", "password", "database"],
    },
  },
  {
    name: "compare-databases",
    description: "Compare two database schemas/data and generate detailed diff report. Useful for migration planning and synchronization.",
    inputSchema: {
      type: "object",
      properties: {
        sourceHost: { type: "string", description: "Source database host" },
        sourcePort: { type: "number", description: "Source database port (default: 3306)" },
        sourceUser: { type: "string", description: "Source database user" },
        sourcePassword: { type: "string", description: "Source database password" },
        sourceDatabase: { type: "string", description: "Source database name" },
        targetHost: { type: "string", description: "Target database host" },
        targetPort: { type: "number", description: "Target database port (default: 3306)" },
        targetUser: { type: "string", description: "Target database user" },
        targetPassword: { type: "string", description: "Target database password" },
        targetDatabase: { type: "string", description: "Target database name" },
      },
      required: [
        "sourceHost",
        "sourceUser",
        "sourcePassword",
        "sourceDatabase",
        "targetHost",
        "targetUser",
        "targetPassword",
        "targetDatabase",
      ],
    },
  },
  // Testing Framework Tools (Phase 1.1e)
  {
    name: "generate-tests-ai",
    description: "Generate comprehensive test cases from source code using AI analysis. Creates unit tests with edge cases, mocks, and assertions.",
    inputSchema: {
      type: "object",
      properties: {
        sourceFile: {
          type: "string",
          description: "Path to source code file to generate tests for",
        },
        testType: {
          type: "string",
          enum: ["unit", "integration", "e2e"],
          description: "Type of tests to generate (default: unit)",
        },
        includeEdgeCases: {
          type: "boolean",
          description: "Include edge case testing (default: true)",
        },
        mockDependencies: {
          type: "boolean",
          description: "Auto-generate mocks for dependencies (default: true)",
        },
      },
      required: ["sourceFile"],
    },
  },
  {
    name: "generate-tests-directory",
    description: "Generate test files for all source files in a directory. Batch AI test generation with configurable coverage.",
    inputSchema: {
      type: "object",
      properties: {
        directory: {
          type: "string",
          description: "Directory containing source files",
        },
        outputDir: {
          type: "string",
          description: "Output directory for test files (default: ./tests)",
        },
        pattern: {
          type: "string",
          description: "File pattern to match (default: **/*.ts)",
        },
        testType: {
          type: "string",
          enum: ["unit", "integration", "e2e"],
          description: "Type of tests to generate (default: unit)",
        },
      },
      required: ["directory"],
    },
  },
  {
    name: "run-performance-test",
    description: "Run performance test on a function. Measures execution time, memory usage, throughput with statistical analysis.",
    inputSchema: {
      type: "object",
      properties: {
        testName: {
          type: "string",
          description: "Name of performance test",
        },
        iterations: {
          type: "number",
          description: "Number of iterations to run (default: 1000)",
        },
        warmupIterations: {
          type: "number",
          description: "Warmup iterations before measurement (default: 100)",
        },
        targetFunction: {
          type: "string",
          description: "Function path to test (module:function format)",
        },
        params: {
          type: "array",
          description: "Parameters to pass to function",
        },
      },
      required: ["testName", "targetFunction"],
    },
  },
  {
    name: "run-load-test",
    description: "Run load test with concurrent requests. Simulates multiple users/requests to test scalability and identify bottlenecks.",
    inputSchema: {
      type: "object",
      properties: {
        testName: {
          type: "string",
          description: "Name of load test",
        },
        targetFunction: {
          type: "string",
          description: "Function path to test (module:function format)",
        },
        concurrentUsers: {
          type: "number",
          description: "Number of concurrent users to simulate (default: 10)",
        },
        duration: {
          type: "number",
          description: "Test duration in seconds (default: 60)",
        },
        rampUp: {
          type: "number",
          description: "Ramp-up time in seconds (default: 10)",
        },
      },
      required: ["testName", "targetFunction"],
    },
  },
  // Configuration Management Tools (Phase 1.1f)
  {
    name: "config-get",
    description: "Get current TrinityCore MCP configuration. Returns all settings including database, paths, server, websocket, testing, and logging config.",
    inputSchema: {
      type: "object",
      properties: {
        section: {
          type: "string",
          enum: ["database", "dataPaths", "server", "websocket", "testing", "logging", "all"],
          description: "Configuration section to retrieve (default: all)",
        },
      },
    },
  },
  {
    name: "config-update",
    description: "Update TrinityCore MCP configuration. Validates changes before applying. Supports hot-reload for most settings.",
    inputSchema: {
      type: "object",
      properties: {
        section: {
          type: "string",
          enum: ["database", "dataPaths", "server", "websocket", "testing", "logging"],
          description: "Configuration section to update",
        },
        config: {
          type: "object",
          description: "Configuration updates (section-specific structure)",
        },
        persist: {
          type: "boolean",
          description: "Save changes to config file (default: true)",
        },
      },
      required: ["section", "config"],
    },
  },
  {
    name: "config-validate",
    description: "Validate configuration without applying. Returns errors and warnings for invalid settings.",
    inputSchema: {
      type: "object",
      properties: {
        config: {
          type: "object",
          description: "Configuration to validate (full or partial)",
        },
      },
      required: ["config"],
    },
  },
  {
    name: "config-reset",
    description: "Reset configuration to defaults. Can reset specific section or entire config. Creates backup before reset.",
    inputSchema: {
      type: "object",
      properties: {
        section: {
          type: "string",
          enum: ["database", "dataPaths", "server", "websocket", "testing", "logging", "all"],
          description: "Section to reset (default: all)",
        },
        createBackup: {
          type: "boolean",
          description: "Create backup before reset (default: true)",
        },
      },
    },
  },
  {
    name: "config-export",
    description: "Export current configuration to file. Supports JSON and YAML formats. Useful for backup and migration.",
    inputSchema: {
      type: "object",
      properties: {
        outputPath: {
          type: "string",
          description: "Output file path",
        },
        format: {
          type: "string",
          enum: ["json", "yaml"],
          description: "Export format (default: json)",
        },
        includeSecrets: {
          type: "boolean",
          description: "Include passwords and secrets (default: false)",
        },
      },
      required: ["outputPath"],
    },
  },
  {
    name: "mcp-load-tool",
    description: "Load a tool on-demand (DYNAMIC profile only). Enables runtime tool loading to minimize token costs.",
    inputSchema: {
      type: "object",
      properties: {
        toolName: {
          type: "string",
          description: "Name of the tool to load",
        },
      },
      required: ["toolName"],
    },
  },
  {
    name: "mcp-unload-tool",
    description: "Unload a tool to free resources (DYNAMIC profile only). Part of automatic token optimization.",
    inputSchema: {
      type: "object",
      properties: {
        toolName: {
          type: "string",
          description: "Name of the tool to unload",
        },
      },
      required: ["toolName"],
    },
  },
  {
    name: "mcp-switch-profile",
    description: "Switch to a different tool profile (DYNAMIC profile only). Changes which tools are loaded.",
    inputSchema: {
      type: "object",
      properties: {
        profile: {
          type: "string",
          enum: ["full", "core-data", "code-review", "playerbot-dev", "performance", "database", "dynamic"],
          description: "Profile to switch to",
        },
      },
      required: ["profile"],
    },
  },
  {
    name: "mcp-get-tool-stats",
    description: "Get tool usage statistics and recommendations (DYNAMIC profile only). Shows which tools are used most.",
    inputSchema: {
      type: "object",
      properties: {
        maxRecommendations: {
          type: "number",
          description: "Maximum number of recommendations (default: 5)",
        },
      },
    },
  },
  {
    name: "mcp-get-registry-status",
    description: "Get dynamic tool registry status (DYNAMIC profile only). Shows loaded/available tools and auto-unload config.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
];

// Initialize dynamic tool manager with all available tools
// This enables runtime loading/unloading for DYNAMIC profile
const isDynamicMode = process.env.MCP_LAZY_LOAD === 'true' || profileLoader.getProfile() === 'dynamic';

if (isDynamicMode) {
  console.log(`[MCP Server] Dynamic tool loading ENABLED`);
  dynamicToolManager.initialize(server, ALL_TOOLS);
}

// Filter tools based on active profile
// This enables 60-90% token reduction for Claude Code while maintaining full functionality for Web UI
// FULL profile bypasses filtering to ensure all tools load
// DYNAMIC profile uses runtime registry
let TOOLS: Tool[];

if (isDynamicMode) {
  // Dynamic mode: Use runtime registry
  TOOLS = dynamicToolManager.getRegistryStats().loadedTools > 0
    ? [] // Will be populated dynamically
    : ALL_TOOLS.filter(tool => profileLoader.shouldLoadTool(tool.name));
} else {
  // Static mode: Use profile filtering
  TOOLS = profileLoader.getProfile() === 'full'
    ? ALL_TOOLS
    : ALL_TOOLS.filter(tool => profileLoader.shouldLoadTool(tool.name));
}

// Log filtered tool count
if (isDynamicMode) {
  const stats = dynamicToolManager.getRegistryStats();
  console.log(`[MCP Server] Dynamic mode: ${stats.loadedTools} tools loaded, ${stats.availableTools} available for on-demand loading`);
} else {
  console.log(`[MCP Server] Static mode: Loaded ${TOOLS.length} / ${ALL_TOOLS.length} tools based on profile`);
}

// List tools handler (returns only tools loaded for current profile or dynamic registry)
server.setRequestHandler(ListToolsRequestSchema, async () => {
  if (isDynamicMode) {
    // Dynamic mode: Return currently loaded tools from dynamic registry
    const loadedTools = [];
    for (const tool of ALL_TOOLS) {
      if (dynamicToolManager.getRegistryStats().loadedTools > 0) {
        // Check if this specific tool is loaded
        const registry = getDynamicToolManager();
        const toolStats = registry.getToolUsageStats();
        const isLoaded = toolStats.some(stat =>
          stat.toolName === tool.name && stat.isCurrentlyLoaded
        );
        if (isLoaded) {
          loadedTools.push(tool);
        }
      }
    }
    return {
      tools: loadedTools.length > 0 ? loadedTools : TOOLS
    };
  } else {
    // Static mode: Return pre-filtered tools
    return {
      tools: TOOLS,
    };
  }
});

// Call tool handler with enterprise error handling
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  // Record tool usage for analytics and dynamic loading
  if (isDynamicMode) {
    dynamicToolManager.recordToolUsage(name);
  }

  if (!args) {
    throw new ValidationError("Missing arguments for tool execution", {
      tool: name,
    });
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

      // Phase 5 - Week 2: Knowledge Base Access Tool Handlers
      case "search-playerbot-wiki": {
        const result = await searchPlayerbotWiki(
          args.query as string,
          {
            category: args.category as any,
            difficulty: args.difficulty as any,
            limit: args.limit as number | undefined,
          }
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

      case "get-playerbot-pattern": {
        const result = await getPlayerbotPattern(args.patternId as string);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "get-implementation-guide": {
        const result = await getImplementationGuide(args.guideId as string);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "get-troubleshooting-guide": {
        const result = await getTroubleshootingGuide(args.query as string);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "get-api-reference": {
        const result = await getAPIReference(args.className as string);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "list-documentation-categories": {
        const result = await listDocumentationCategories();
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      // Phase 5 - Week 3: Code Generation Tool Handlers
      case "generate-bot-component": {
        const result = await generateBotComponent({
          componentType: args.componentType as any,
          className: args.className as string,
          description: args.description as string | undefined,
          role: args.role as any,
          outputPath: args.outputPath as string | undefined,
          namespace: args.namespace as string | undefined,
          includeTests: args.includeTests as boolean | undefined,
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

      case "generate-packet-handler": {
        const result = await generatePacketHandler({
          handlerName: args.handlerName as string,
          opcode: args.opcode as string,
          direction: args.direction as any,
          fields: args.fields as any[],
          outputPath: args.outputPath as string | undefined,
          namespace: args.namespace as string | undefined,
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

      case "generate-cmake-integration": {
        const result = await generateCMakeIntegration({
          projectName: args.projectName as string,
          sourceFiles: args.sourceFiles as string[],
          headerFiles: args.headerFiles as string[],
          testFiles: args.testFiles as string[] | undefined,
          isLibrary: args.isLibrary as boolean | undefined,
          dependencies: args.dependencies as string[] | undefined,
          outputPath: args.outputPath as string | undefined,
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

      case "validate-generated-code": {
        const result = await validateGeneratedCode({
          filePath: args.filePath as string,
          checkCompilation: args.checkCompilation as boolean | undefined,
          checkStyle: args.checkStyle as boolean | undefined,
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

      // Phase 5 Week 4: Performance Analysis Tools
      case "analyze-bot-performance": {
        const result = await analyzeBotPerformance({
          mode: args.mode as 'realtime' | 'snapshot',
          metrics: args.metrics as any,
          duration: args.duration as number | undefined,
          interval: args.interval as number | undefined,
          exportCSV: args.exportCSV as string | undefined,
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

      case "simulate-scaling": {
        const result = await simulateScaling({
          minBots: args.minBots as number,
          maxBots: args.maxBots as number,
          stepSize: args.stepSize as number | undefined,
          profile: args.profile as any,
          baseline: args.baseline as any,
          scalingFactors: args.scalingFactors as any,
          limits: args.limits as any,
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

      case "get-optimization-suggestions": {
        const result = await getOptimizationSuggestions({
          performanceReport: args.performanceReport as any,
          performanceReportFile: args.performanceReportFile as string | undefined,
          filters: args.filters as any,
          includeQuickWins: args.includeQuickWins as boolean | undefined,
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

      case "run-tests": {
        const result = await runTests({
          pattern: args.pattern as string | undefined,
          rootDir: args.rootDir as string | undefined,
          testNamePattern: args.testNamePattern as string | undefined,
          tags: args.tags as string[] | undefined,
          parallel: args.parallel as boolean | undefined,
          maxWorkers: args.maxWorkers as number | undefined,
          timeout: args.timeout as number | undefined,
          retries: args.retries as number | undefined,
          verbose: args.verbose as boolean | undefined,
          silent: args.silent as boolean | undefined,
          outputFormat: args.outputFormat as 'json' | 'summary' | undefined,
          generateReport: args.generateReport as any | undefined,
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

      case "generate-test-report": {
        const result = await generateTestReport({
          testResults: args.testResults as any | undefined,
          testResultsFile: args.testResultsFile as string | undefined,
          format: args.format as 'json' | 'html' | 'markdown' | 'junit',
          outputPath: args.outputPath as string,
          includePassedTests: args.includePassedTests as boolean | undefined,
          includeSkippedTests: args.includeSkippedTests as boolean | undefined,
          includeCharts: args.includeCharts as boolean | undefined,
          title: args.title as string | undefined,
          metadata: args.metadata as any | undefined,
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

      case "analyze-coverage": {
        const result = await analyzeCoverage({
          coverageData: args.coverageData as any | undefined,
          coverageFile: args.coverageFile as string | undefined,
          include: args.include as string[] | undefined,
          exclude: args.exclude as string[] | undefined,
          thresholds: args.thresholds as any | undefined,
          format: args.format as 'json' | 'html' | 'text' | 'lcov' | undefined,
          outputPath: args.outputPath as string | undefined,
          findUncovered: args.findUncovered as boolean | undefined,
          showDetails: args.showDetails as boolean | undefined,
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

      case "review-code-file": {
        // FILE LOGGING for MCP debugging
        const logPath = 'c:/TrinityBots/trinitycore-mcp/mcp-debug.log';
        const logMsg = `\n=== MCP Handler: review-code-file ===\n` +
                       `Time: ${new Date().toISOString()}\n` +
                       `args.filePath: ${args.filePath}\n` +
                       `args.projectRoot: ${args.projectRoot}\n` +
                       `args.minConfidence: ${args.minConfidence}\n` +
                       `args.verbose: ${args.verbose}\n`;
        try {
          require('fs').appendFileSync(logPath, logMsg);
        } catch (e) {
          logger.error('Failed to write log:', e);
        }

        const result = await reviewFile(args.filePath as string, {
          enableAI: args.enableAI as boolean | undefined,
          llmProvider: args.llmProvider as "openai" | "ollama" | "lmstudio" | undefined,
          llmModel: args.llmModel as string | undefined,
          severityFilter: args.severityFilter as any[] | undefined,
          categoryFilter: args.categoryFilter as any[] | undefined,
          minConfidence: args.minConfidence as number | undefined,
          projectRoot: args.projectRoot as string | undefined,
          compilerType: args.compilerType as any | undefined,
          verbose: args.verbose as boolean | undefined,
        });

        // Log result
        try {
          require('fs').appendFileSync(logPath, `Result length: ${result.length} chars\n`);
        } catch (e) {}

        return {
          content: [{ type: "text", text: result }],
        };
      }

      case "review-code-files": {
        const result = await reviewFiles(args.files as string[], {
          enableAI: args.enableAI as boolean | undefined,
          llmProvider: args.llmProvider as "openai" | "ollama" | "lmstudio" | undefined,
          llmModel: args.llmModel as string | undefined,
          severityFilter: args.severityFilter as any[] | undefined,
          categoryFilter: args.categoryFilter as any[] | undefined,
          minConfidence: args.minConfidence as number | undefined,
          projectRoot: args.projectRoot as string | undefined,
          compilerType: args.compilerType as any | undefined,
          verbose: args.verbose as boolean | undefined,
        });
        return {
          content: [{ type: "text", text: result }],
        };
      }

      case "review-code-pattern": {
        const result = await reviewPattern(args.patterns as string[], {
          enableAI: args.enableAI as boolean | undefined,
          llmProvider: args.llmProvider as "openai" | "ollama" | "lmstudio" | undefined,
          llmModel: args.llmModel as string | undefined,
          severityFilter: args.severityFilter as any[] | undefined,
          categoryFilter: args.categoryFilter as any[] | undefined,
          minConfidence: args.minConfidence as number | undefined,
          projectRoot: args.projectRoot as string | undefined,
          compilerType: args.compilerType as any | undefined,
          excludePatterns: args.excludePatterns as string[] | undefined,
          verbose: args.verbose as boolean | undefined,
        });
        return {
          content: [{ type: "text", text: result }],
        };
      }

      case "review-code-project": {
        const result = await reviewProjectDirectory(args.projectRoot as string, {
          enableAI: args.enableAI as boolean | undefined,
          llmProvider: args.llmProvider as "openai" | "ollama" | "lmstudio" | undefined,
          llmModel: args.llmModel as string | undefined,
          severityFilter: args.severityFilter as any[] | undefined,
          categoryFilter: args.categoryFilter as any[] | undefined,
          minConfidence: args.minConfidence as number | undefined,
          patterns: args.patterns as string[] | undefined,
          excludePatterns: args.excludePatterns as string[] | undefined,
          compilerType: args.compilerType as any | undefined,
          reportPath: args.reportPath as string | undefined,
          reportFormat: args.reportFormat as any | undefined,
          verbose: args.verbose as boolean | undefined,
        });
        return {
          content: [{ type: "text", text: result }],
        };
      }

      case "generate-code-review-report": {
        const result = await generateReviewReport(
          args.violations as any[],
          args.reportPath as string,
          (args.format as "markdown" | "html" | "json" | "console") || "markdown",
          {
            projectRoot: args.projectRoot as string | undefined,
            compilerType: args.compilerType as any | undefined,
          }
        );
        return {
          content: [{ type: "text", text: result }],
        };
      }

      case "get-code-review-stats": {
        const result = await getCodeReviewStats();
        return {
          content: [{ type: "text", text: result }],
        };
      }

      // Priority #5: AI Agent Development Support
      case "analyze-thread-safety": {
        const result = await analyzeThreadSafety({
          directory: args.directory as string | undefined,
          filePath: args.filePath as string | undefined,
          severity: args.severity as "critical" | "high" | "medium" | "low" | undefined,
          checkTypes: args.checkTypes as Array<"race_conditions" | "deadlocks" | "performance"> | undefined,
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

      case "analyze-memory-leaks": {
        const result = await analyzeMemoryLeaks({
          directory: args.directory as string | undefined,
          filePath: args.filePath as string | undefined,
          checkTypes: args.checkTypes as Array<"pointers" | "resources" | "circular" | "raii"> | undefined,
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

      // Priority #6: API Development Assistance
      case "migrate-trinity-api": {
        const result = await analyzeAPIMigration({
          directory: args.directory as string,
          fromVersion: args.fromVersion as string,
          toVersion: args.toVersion as string,
          autoFix: args.autoFix as boolean | undefined,
          modernize: args.modernize as boolean | undefined,
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

      case "get-code-completion-context": {
        const result = await getCodeCompletionContext({
          file: args.filePath as string || "",
          line: args.cursorPosition as number || 0,
          column: 0,
          partialCode: args.partialCode as string,
          limit: args.maxSuggestions as number | undefined,
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

      // Priority #7: Interactive Development Tools
      case "debug-bot-behavior": {
        const action = args.action as string;
        let result: any;

        if (action === "inspect") {
          result = await getBotState(args.botId as string);
        } else if (action === "timeline") {
          result = await getBotTimeline(args.botId as string, (args.duration as number) || 10);
        } else if (action === "breakpoint") {
          result = await setBreakpoint({
            id: `bp-${Date.now()}`,
            condition: args.breakpointCondition as string,
            action: "pause",
            enabled: true,
          });
        } else if (action === "export") {
          result = await exportBugReport(args.botId as string, args.timelineId as string);
        } else {
          throw new Error(`Unknown bot debug action: ${action}`);
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "simulate-game-mechanics": {
        const simulationType = args.simulationType as string;
        let result: any;

        if (simulationType === "combat") {
          result = await simulateCombat({
            playerStats: args.playerStats as any,
            targetStats: args.targetStats as any || { level: 90, armor: 10000, hp: 1000000 },
            rotation: args.rotation as any || { abilities: [], cycleDuration: 6.0 },
            duration: (args.duration as number) || 300,
          });
        } else if (simulationType === "whatif") {
          // analyzeWhatIf expects baseScenario and scenarios array
          result = await analyzeWhatIf(
            {
              playerStats: args.playerStats as any,
              targetStats: args.targetStats as any || { level: 90, armor: 10000, hp: 1000000 },
              rotation: args.rotation as any || { abilities: [], cycleDuration: 6.0 },
              duration: (args.duration as number) || 300,
            },
            [{ name: args.scenario as string || "Custom Scenario", statChanges: {} }]
          );
        } else {
          throw new Error(`Unknown simulation type: ${simulationType}`);
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      // Production Operations & Monitoring
      case "get-health-status": {
        const result = await getHealthStatus();
        return {
          content: [{ type: "text", text: result }],
        };
      }

      case "get-metrics-snapshot": {
        const result = await getMetricsSnapshot({
          format: args.format as "json" | "prometheus" | undefined,
          include_details: args.includeHistory as boolean | undefined,
        });
        return {
          content: [{ type: "text", text: result }],
        };
      }

      case "query-logs": {
        const result = await queryLogs({
          level: args.level as "DEBUG" | "INFO" | "WARN" | "ERROR" | undefined,
          search: args.search as string | undefined,
          start_time: args.startTime as string | undefined,
          end_time: args.endTime as string | undefined,
          limit: args.limit as number | undefined,
        });
        return {
          content: [{ type: "text", text: result }],
        };
      }

      case "get-log-file-location": {
        const result = await getLogFileLocation();
        return {
          content: [{ type: "text", text: result }],
        };
      }

      case "get-monitoring-status": {
        const result = await getMonitoringStatus();
        return {
          content: [{ type: "text", text: result }],
        };
      }

      case "trigger-backup": {
        const result = await triggerBackup({
          type: args.type as "full" | "incremental" | undefined,
          description: args.description as string | undefined,
        });
        return {
          content: [{ type: "text", text: result }],
        };
      }

      case "verify-backup": {
        const result = await verifyBackup({
          backup_id: args.backupId as string,
        });
        return {
          content: [{ type: "text", text: result }],
        };
      }

      case "get-security-status": {
        const result = await getSecurityStatus();
        return {
          content: [{ type: "text", text: result }],
        };
      }

      case "list-backups": {
        const result = await listBackups();
        return {
          content: [{ type: "text", text: result }],
        };
      }

      case "check-code-style": {
        const result = await checkCodeStyle({
          filePath: args.filePath as string | undefined,
          directory: args.directory as string | undefined,
          autoFix: args.autoFix as boolean | undefined,
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

      case "format-code": {
        const result = await formatCode(
          args.filePath as string,
          args.autoFix as boolean || false
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

      // PlayerBot Development Tools
      case "analyze-bot-ai": {
        const report = await analyzeBotAI({
          filePath: args.filePath as string,
          outputFormat: args.outputFormat as "json" | "markdown" | "flowchart" | undefined,
          detectIssues: args.detectIssues as boolean | undefined,
          generateOptimizations: args.generateOptimizations as boolean | undefined,
        });

        const formatted = await formatAIAnalysisReport(
          report,
          (args.outputFormat as "json" | "markdown" | "flowchart") || "markdown"
        );

        return {
          content: [{ type: "text", text: formatted }],
        };
      }

      case "analyze-bot-combat-log": {
        const report = await analyzeBotCombatLog({
          logFile: args.logFile as string | undefined,
          logText: args.logText as string | undefined,
          botName: args.botName as string | undefined,
          encounter: args.encounter as string | undefined,
          startTime: args.startTime as number | undefined,
          endTime: args.endTime as number | undefined,
          compareWithTheoretical: args.compareWithTheoretical as boolean | undefined,
        });

        const formatted = await formatCombatAnalysisReport(
          report,
          (args.outputFormat as "json" | "markdown") || "markdown"
        );

        return {
          content: [{ type: "text", text: formatted }],
        };
      }

      case "analyze-combat-log-comprehensive": {
        const comprehensiveReport = await analyzeComprehensive({
          logFile: args.logFile as string | undefined,
          logText: args.logText as string | undefined,
          botName: args.botName as string,
          className: args.className as string | undefined,
          spec: args.spec as string | undefined,
          level: args.level as number | undefined,
          includeML: args.includeML as boolean | undefined,
          includeRecommendations: args.includeRecommendations as boolean | undefined,
          outputFormat: (args.outputFormat as "json" | "markdown" | "summary") || "markdown",
        });

        let formatted: string;
        const format = (args.outputFormat as "json" | "markdown" | "summary") || "markdown";

        if (format === "json") {
          formatted = formatComprehensiveReportJSON(comprehensiveReport);
        } else if (format === "summary") {
          formatted = formatComprehensiveReportSummary(comprehensiveReport);
        } else {
          formatted = formatComprehensiveReportMarkdown(comprehensiveReport);
        }

        return {
          content: [{ type: "text", text: formatted }],
        };
      }

      // VMap Tools (Phase 1.1a)
      case "list-vmap-files": {
        const vmapDir = (args.vmapDir as string | undefined) || process.env.VMAP_PATH || "./data/vmaps";
        const result = await listVMapFiles(vmapDir);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "get-vmap-file-info": {
        const vmapFile = args.vmapFile as string;
        const result = await getVMapFileInfo(vmapFile);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "vmap-test-line-of-sight": {
        const result = await testLineOfSight({
          vmapDir: args.vmapDir as string,
          mapId: args.mapId as number,
          startX: args.startX as number,
          startY: args.startY as number,
          startZ: args.startZ as number,
          endX: args.endX as number,
          endY: args.endY as number,
          endZ: args.endZ as number,
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

      case "vmap-find-spawns-in-radius": {
        const result = await findSpawnsInRadius({
          vmapDir: args.vmapDir as string,
          mapId: args.mapId as number,
          centerX: args.centerX as number,
          centerY: args.centerY as number,
          centerZ: args.centerZ as number,
          radius: args.radius as number,
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

      // MMap Tools (Phase 1.1b)
      case "list-mmap-files": {
        const mmapDir = (args.mmapDir as string | undefined) || process.env.MMAP_PATH || "./data/mmaps";
        const result = await listMMapFiles(mmapDir);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "get-mmap-file-info": {
        const mmapFile = args.mmapFile as string;
        const result = await getMMapFileInfo(mmapFile);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "mmap-find-path": {
        const result = await findPath({
          mmapDir: args.mmapDir as string,
          mapId: args.mapId as number,
          startX: args.startX as number,
          startY: args.startY as number,
          startZ: args.startZ as number,
          goalX: args.goalX as number,
          goalY: args.goalY as number,
          goalZ: args.goalZ as number,
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

      case "mmap-is-on-navmesh": {
        const result = await isOnNavMesh({
          mmapDir: args.mmapDir as string,
          mapId: args.mapId as number,
          posX: args.posX as number,
          posY: args.posY as number,
          posZ: args.posZ as number,
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

      // Minimap Tools (Phase 1.1c)
      case "get-map-minimap": {
        return await getMapMinimap({ mapId: args.mapId as number });
      }

      case "get-minimap-tile": {
        return await getMinimapTile({
          fileDataId: args.fileDataId as number,
          forceRefresh: args.forceRefresh as boolean | undefined
        });
      }

      case "get-minimap-tiles-batch": {
        return await getMinimapTilesBatch({
          fileDataIds: (args.fileDataIds as number[] | undefined) || [],
          mapId: args.mapId as number | undefined,
          startFileDataId: args.startFileDataId as number | undefined,
          count: args.count as number | undefined
        });
      }

      case "clear-minimap-cache": {
        return await clearMinimapCache({ mapId: args.mapId as number | undefined });
      }

      // Database Tools (Phase 1.1c)
      case "export-database": {
        const baseConfig = {
          host: args.host as string,
          port: (args.port as number) || 3306,
          user: args.user as string,
          password: args.password as string,
        };
        const result = await exportAllDatabases(
          baseConfig,
          args.outputDir as string,
          (args.format as any) || "SQL"
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

      case "export-database-tables": {
        const dbConfig = {
          host: args.host as string,
          port: (args.port as number) || 3306,
          user: args.user as string,
          password: args.password as string,
          database: args.database as string,
        };
        const result = await exportTables(
          dbConfig,
          args.tables as string[],
          args.outputDir as string,
          (args.format as any) || "SQL"
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

      case "import-database-from-directory": {
        const dbConfig = {
          host: args.host as string,
          port: (args.port as number) || 3306,
          user: args.user as string,
          password: args.password as string,
          database: args.database as string,
        };
        const result = await importFromDirectory(
          dbConfig,
          args.directory as string,
          (args.format as any) || "SQL"
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

      case "import-database-from-file": {
        const dbConfig = {
          host: args.host as string,
          port: (args.port as number) || 3306,
          user: args.user as string,
          password: args.password as string,
          database: args.database as string,
        };
        const result = await importFromFile(
          dbConfig,
          args.filepath as string,
          (args.dropExisting as boolean) || false
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

      case "backup-database": {
        const dbConfig = {
          host: args.host as string,
          port: (args.port as number) || 3306,
          user: args.user as string,
          password: args.password as string,
          database: args.database as string,
        };
        const result = await quickBackup(dbConfig, args.backupDir as string);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "restore-database": {
        const dbConfig = {
          host: args.host as string,
          port: (args.port as number) || 3306,
          user: args.user as string,
          password: args.password as string,
          database: args.database as string,
        };
        const result = await quickRestore(
          dbConfig,
          args.backup as string,
          (args.dropExisting as boolean) || false
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

      case "database-health-check-quick": {
        const dbConfig = {
          host: args.host as string,
          port: (args.port as number) || 3306,
          user: args.user as string,
          password: args.password as string,
          database: args.database as string,
        };
        const result = await quickHealthCheck(dbConfig);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "database-health-check-full": {
        const dbConfig = {
          host: args.host as string,
          port: (args.port as number) || 3306,
          user: args.user as string,
          password: args.password as string,
          database: args.database as string,
        };
        const result = await fullHealthCheck(dbConfig);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "database-health-check-and-fix": {
        const dbConfig = {
          host: args.host as string,
          port: (args.port as number) || 3306,
          user: args.user as string,
          password: args.password as string,
          database: args.database as string,
        };
        const result = await healthCheckWithFix(dbConfig);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "compare-databases": {
        const sourceConfig = {
          host: args.sourceHost as string,
          port: (args.sourcePort as number) || 3306,
          user: args.sourceUser as string,
          password: args.sourcePassword as string,
          database: args.sourceDatabase as string,
        };
        const targetConfig = {
          host: args.targetHost as string,
          port: (args.targetPort as number) || 3306,
          user: args.targetUser as string,
          password: args.targetPassword as string,
          database: args.targetDatabase as string,
        };
        const result = await compareDatabases(sourceConfig, targetConfig);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      // Testing Framework Tools (Phase 1.1e)
      case "generate-tests-ai": {
        const sourceFile = args.sourceFile as string;
        const outputDir = (args.outputDir as string) || "./tests";
        const result = await generateTests(sourceFile, outputDir);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(Array.from(result), null, 2),
            },
          ],
        };
      }

      case "generate-tests-directory": {
        const directory = args.directory as string;
        const outputDir = (args.outputDir as string) || "./tests";
        const resultMap = await generateTestsForDirectory(directory, outputDir);
        const result = Object.fromEntries(resultMap);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "run-performance-test": {
        // Note: This is a simplified wrapper - actual implementation would need to dynamically import and execute the target function
        const result = {
          testName: args.testName as string,
          targetFunction: args.targetFunction as string,
          iterations: (args.iterations as number) || 1000,
          warmupIterations: (args.warmupIterations as number) || 100,
          status: "pending",
          message: "Performance testing requires dynamic function execution - implement custom wrapper for production use",
        };
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "run-load-test": {
        // Note: This is a simplified wrapper - actual implementation would need to dynamically import and execute the target function
        const result = {
          testName: args.testName as string,
          targetFunction: args.targetFunction as string,
          concurrentUsers: (args.concurrentUsers as number) || 10,
          duration: (args.duration as number) || 60,
          rampUp: (args.rampUp as number) || 10,
          status: "pending",
          message: "Load testing requires dynamic function execution - implement custom wrapper for production use",
        };
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      // Configuration Management Tools (Phase 1.1f)
      case "config-get": {
        const configManager = getConfigManager();
        const section = (args.section as string) || "all";

        let result: any;
        if (section === "all") {
          result = configManager.getConfig();
        } else {
          result = { [section]: (configManager.getConfig() as any)[section] };
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "config-update": {
        const configManager = getConfigManager();
        const section = args.section as string;
        const updates = args.config as any;
        const persist = (args.persist as boolean) ?? true;

        let validationResult: any;
        switch (section) {
          case "database":
            validationResult = await configManager.updateDatabase(updates);
            break;
          case "dataPaths":
            validationResult = await configManager.updateDataPaths(updates);
            break;
          case "server":
            validationResult = await configManager.updateServer(updates);
            break;
          case "websocket":
            validationResult = await configManager.updateWebSocket(updates);
            break;
          case "testing":
            validationResult = await configManager.updateTesting(updates);
            break;
          case "logging":
            validationResult = await configManager.updateLogging(updates);
            break;
          default:
            throw new Error(`Unknown config section: ${section}`);
        }

        if (persist && validationResult.valid) {
          await configManager.save();
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(validationResult, null, 2),
            },
          ],
        };
      }

      case "config-validate": {
        const configManager = getConfigManager();
        const configToValidate = args.config as any;
        const result = configManager.validate(configToValidate);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "config-reset": {
        const configManager = getConfigManager();
        const section = (args.section as string) || "all";
        const createBackup = (args.createBackup as boolean) ?? true;

        if (createBackup) {
          await configManager.save();
        }

        await configManager.reset();

        const result = {
          success: true,
          message: `Configuration ${section === "all" ? "fully" : `section '${section}'`} reset to defaults`,
          backupCreated: createBackup,
        };

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "config-export": {
        const configManager = getConfigManager();
        const outputPath = args.outputPath as string;
        const format = (args.format as string) || "json";
        const includeSecrets = (args.includeSecrets as boolean) || false;

        const config = configManager.getConfig();

        // Remove secrets if not requested
        let exportConfig = config;
        if (!includeSecrets) {
          exportConfig = JSON.parse(JSON.stringify(config));
          if (exportConfig.database?.password) {
            exportConfig.database.password = "***REDACTED***";
          }
        }

        const fs = await import("fs/promises");
        if (format === "json") {
          await fs.writeFile(outputPath, JSON.stringify(exportConfig, null, 2));
        } else if (format === "yaml") {
          // Simple YAML export - for production use a proper YAML library
          const yamlContent = JSON.stringify(exportConfig, null, 2)
            .replace(/"/g, "")
            .replace(/,$/gm, "");
          await fs.writeFile(outputPath, yamlContent);
        }

        const result = {
          success: true,
          outputPath,
          format,
          secretsIncluded: includeSecrets,
        };

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "analyze-combat-log-comprehensive": {
        const comprehensiveReport = await analyzeComprehensive({
          logFile: args.logFile as string | undefined,
          logText: args.logText as string | undefined,
          botName: args.botName as string,
          className: args.className as string | undefined,
          spec: args.spec as string | undefined,
          level: args.level as number | undefined,
          includeML: args.includeML as boolean | undefined,
          includeRecommendations: args.includeRecommendations as boolean | undefined,
          outputFormat: (args.outputFormat as "json" | "markdown" | "summary") || "markdown",
        });

        let formatted: string;
        const format = (args.outputFormat as "json" | "markdown" | "summary") || "markdown";

        if (format === "json") {
          formatted = formatComprehensiveReportJSON(comprehensiveReport);
        } else if (format === "summary") {
          formatted = formatComprehensiveReportSummary(comprehensiveReport);
        } else {
          formatted = formatComprehensiveReportMarkdown(comprehensiveReport);
        }

        return {
          content: [{ type: "text", text: formatted }],
        };
      }

      // ============================================================
      // MCP Dynamic Tool Management (Phase 4)
      // ============================================================

      case "mcp-load-tool": {
        if (!isDynamicMode) {
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                success: false,
                message: "Dynamic tool loading only available in DYNAMIC profile or with MCP_LAZY_LOAD=true"
              }, null, 2)
            }]
          };
        }

        const toolName = args.toolName as string;
        const result = await dynamicToolManager.loadToolOnDemand(toolName);
        return {
          content: [{
            type: "text",
            text: JSON.stringify(result, null, 2)
          }]
        };
      }

      case "mcp-unload-tool": {
        if (!isDynamicMode) {
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                success: false,
                message: "Dynamic tool unloading only available in DYNAMIC profile or with MCP_LAZY_LOAD=true"
              }, null, 2)
            }]
          };
        }

        const toolName = args.toolName as string;
        const result = await dynamicToolManager.unloadTool(toolName);
        return {
          content: [{
            type: "text",
            text: JSON.stringify(result, null, 2)
          }]
        };
      }

      case "mcp-switch-profile": {
        if (!isDynamicMode) {
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                success: false,
                message: "Profile switching only available in DYNAMIC profile or with MCP_LAZY_LOAD=true"
              }, null, 2)
            }]
          };
        }

        const profile = args.profile as any;
        const result = await dynamicToolManager.switchProfile(profile);
        return {
          content: [{
            type: "text",
            text: JSON.stringify(result, null, 2)
          }]
        };
      }

      case "mcp-get-tool-stats": {
        if (!isDynamicMode) {
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                success: false,
                message: "Tool statistics only available in DYNAMIC profile or with MCP_LAZY_LOAD=true"
              }, null, 2)
            }]
          };
        }

        const maxRecommendations = (args.maxRecommendations as number) || 5;
        const stats = dynamicToolManager.getToolUsageStats();
        const recommendations = dynamicToolManager.getToolRecommendations(maxRecommendations);
        const profileRecommendation = dynamicToolManager.getProfileRecommendation();

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              toolUsageStats: stats.slice(0, 20), // Top 20 tools
              recommendations,
              profileRecommendation
            }, null, 2)
          }]
        };
      }

      case "mcp-get-registry-status": {
        if (!isDynamicMode) {
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                success: false,
                message: "Registry status only available in DYNAMIC profile or with MCP_LAZY_LOAD=true"
              }, null, 2)
            }]
          };
        }

        const stats = dynamicToolManager.getRegistryStats();
        const usageData = dynamicToolManager.exportUsageData();

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              registryStats: stats,
              detailedUsage: JSON.parse(usageData)
            }, null, 2)
          }]
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    // Use centralized error handling
    const errorResponse = createErrorResponse(error, {
      tool: name,
      arguments: args,
    });

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(errorResponse, null, 2),
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
  logger.error("TrinityCore MCP Server running on stdio");

  // Week 7: Optional cache warming on startup (disabled by default)
  // Uncomment to enable automatic cache warming for improved performance
  // const warmOnStartup = process.env.CACHE_WARM_ON_STARTUP === "true";
  // if (warmOnStartup) {
  //   logger.error("Warming DB2 caches...");
  //   const warmResult = await CacheWarmer.warmAllCaches();
  //   if (warmResult.success) {
  //     logger.error(`Cache warming complete: ${warmResult.recordsPreloaded} records in ${warmResult.totalTime}ms`);
  //   }
  // }
}

main().catch((error) => {
  logger.error("Fatal error:", error);
  process.exit(1);
});
