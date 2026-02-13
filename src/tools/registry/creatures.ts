/**
 * Creature Tools Registry
 *
 * Creature/NPC data access tools: full info, search, type/faction filtering, statistics.
 *
 * @module tools/registry/creatures
 */

import { ToolRegistryEntry, jsonResponse } from "./types";
import {
  getCreatureFullInfo,
  searchCreatures,
  getCreaturesByType,
  getAllVendors,
  getAllTrainers,
  getCreaturesByFaction,
  getCreatureStatistics
} from "../creature";

export const creatureTools: ToolRegistryEntry[] = [
  {
    definition: {
      name: "get-creature-full-info",
      description: "Get complete creature/NPC information including template, difficulties, vendor items, trainer spells, loot, and AI analysis",
      inputSchema: {
        type: "object",
        properties: {
          entry: { type: "number", description: "Creature entry ID" },
          includeLoot: { type: "boolean", description: "Optional: include loot table (can be large, default: false)" },
        },
        required: ["entry"],
      },
    },
    handler: async (args) => {
      const result = await getCreatureFullInfo(args.entry as number, (args.includeLoot as boolean) || false);
      return jsonResponse(result);
    },
  },
  {
    definition: {
      name: "search-creatures",
      description: "Search for creatures matching filters (name, type, faction, classification, etc.)",
      inputSchema: {
        type: "object",
        properties: {
          name: { type: "string", description: "Optional: partial name match" },
          type: { type: "number", description: "Optional: creature type (0=None, 1=Beast, 2=Dragonkin, 3=Demon, etc.)" },
          family: { type: "number", description: "Optional: creature family (for beasts/pets)" },
          classification: { type: "number", description: "Optional: classification (0=Normal, 1=Elite, 2=Rare Elite, 3=Boss, 4=Rare)" },
          faction: { type: "number", description: "Optional: faction ID" },
          expansion: { type: "number", description: "Optional: required expansion ID" },
          isBoss: { type: "boolean", description: "Optional: filter for bosses only" },
          isElite: { type: "boolean", description: "Optional: filter for elite/rare/boss creatures" },
          isVendor: { type: "boolean", description: "Optional: filter for vendors only" },
          isTrainer: { type: "boolean", description: "Optional: filter for trainers only" },
          limit: { type: "number", description: "Optional: maximum results (default: 50)" },
        },
      },
    },
    handler: async (args) => {
      const filters: Record<string, unknown> = {};
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

      const result = await searchCreatures(filters as any);
      return jsonResponse(result);
    },
  },
  {
    definition: {
      name: "get-creatures-by-type",
      description: "Get all creatures of a specific type (Beast, Humanoid, Undead, etc.)",
      inputSchema: {
        type: "object",
        properties: {
          creatureType: { type: "number", description: "Creature type (0=None, 1=Beast, 2=Dragonkin, 3=Demon, 4=Elemental, 5=Giant, 6=Undead, 7=Humanoid, etc.)" },
          limit: { type: "number", description: "Optional: maximum results (default: 50)" },
        },
        required: ["creatureType"],
      },
    },
    handler: async (args) => {
      const result = await getCreaturesByType(args.creatureType as number, (args.limit as number) || 50);
      return jsonResponse(result);
    },
  },
  {
    definition: {
      name: "get-all-vendors",
      description: "Get list of all vendor NPCs in the database",
      inputSchema: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Optional: maximum results (default: 100)" },
        },
      },
    },
    handler: async (args) => {
      const result = await getAllVendors((args.limit as number) || 100);
      return jsonResponse(result);
    },
  },
  {
    definition: {
      name: "get-all-trainers",
      description: "Get list of all trainer NPCs in the database",
      inputSchema: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Optional: maximum results (default: 100)" },
        },
      },
    },
    handler: async (args) => {
      const result = await getAllTrainers((args.limit as number) || 100);
      return jsonResponse(result);
    },
  },
  {
    definition: {
      name: "get-creatures-by-faction",
      description: "Get all creatures belonging to a specific faction",
      inputSchema: {
        type: "object",
        properties: {
          faction: { type: "number", description: "Faction ID" },
          limit: { type: "number", description: "Optional: maximum results (default: 100)" },
        },
        required: ["faction"],
      },
    },
    handler: async (args) => {
      const result = await getCreaturesByFaction(args.faction as number, (args.limit as number) || 100);
      return jsonResponse(result);
    },
  },
  {
    definition: {
      name: "get-creature-statistics",
      description: "Get statistical breakdown of creatures (counts by type, classification, vendors, trainers, bosses)",
      inputSchema: {
        type: "object",
        properties: {
          type: { type: "number", description: "Optional: filter by creature type" },
          faction: { type: "number", description: "Optional: filter by faction" },
          expansion: { type: "number", description: "Optional: filter by expansion" },
        },
      },
    },
    handler: async (args) => {
      const filters: Record<string, unknown> = {};
      if (args.type !== undefined) filters.type = args.type as number;
      if (args.faction !== undefined) filters.faction = args.faction as number;
      if (args.expansion !== undefined) filters.expansion = args.expansion as number;
      const result = await getCreatureStatistics(filters as any);
      return jsonResponse(result);
    },
  },
];
