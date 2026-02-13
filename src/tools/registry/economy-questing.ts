/**
 * Economy & Questing Tools Registry
 *
 * Economy, reputation, quest routing, leveling paths, and collectible tools.
 *
 * @module tools/registry/economy-questing
 */

import { ToolRegistryEntry, jsonResponse } from "./types";
import { getItemPricing, getGoldMakingStrategies } from "../economy";
import { calculateReputationStanding, getReputationGrindPath } from "../reputation";
import { optimizeQuestRoute, getOptimalLevelingPath } from "../questroute";
import { getCollectionStatus, findMissingCollectibles, getFarmingRoute } from "../collection";

export const economyQuestingTools: ToolRegistryEntry[] = [
  {
    definition: {
      name: "get-item-pricing",
      description: "Get item pricing information including vendor prices and estimated market value",
      inputSchema: {
        type: "object",
        properties: {
          itemId: { type: "number", description: "Item ID to price" },
        },
        required: ["itemId"],
      },
    },
    handler: async (args) => {
      const result = await getItemPricing(args.itemId as number);
      return jsonResponse(result);
    },
  },
  {
    definition: {
      name: "get-gold-making-strategies",
      description: "Get gold-making strategies based on player level and professions",
      inputSchema: {
        type: "object",
        properties: {
          playerLevel: { type: "number", description: "Player level" },
          professions: { type: "array", items: { type: "string" }, description: "Known professions (e.g., Mining, Herbalism, Alchemy)" },
        },
        required: ["playerLevel", "professions"],
      },
    },
    handler: async (args) => {
      const result = getGoldMakingStrategies(args.playerLevel as number, args.professions as string[]);
      return jsonResponse(result);
    },
  },
  {
    definition: {
      name: "get-reputation-standing",
      description: "Calculate reputation standing from raw reputation value",
      inputSchema: {
        type: "object",
        properties: {
          factionId: { type: "number", description: "Faction ID" },
          factionName: { type: "string", description: "Faction name" },
          currentReputation: { type: "number", description: "Current reputation value" },
        },
        required: ["factionId", "factionName", "currentReputation"],
      },
    },
    handler: async (args) => {
      const result = calculateReputationStanding(
        args.factionId as number,
        args.factionName as string,
        args.currentReputation as number
      );
      return jsonResponse(result);
    },
  },
  {
    definition: {
      name: "get-reputation-grind-path",
      description: "Get optimal reputation grinding path from current to target standing",
      inputSchema: {
        type: "object",
        properties: {
          factionId: { type: "number", description: "Faction ID" },
          factionName: { type: "string", description: "Faction name" },
          currentRep: { type: "number", description: "Current reputation value" },
          targetStanding: { type: "string", description: "Target standing: friendly, honored, revered, or exalted" },
        },
        required: ["factionId", "factionName", "currentRep", "targetStanding"],
      },
    },
    handler: async (args) => {
      const result = getReputationGrindPath(
        args.factionId as number,
        args.factionName as string,
        args.currentRep as number,
        args.targetStanding as string
      );
      return jsonResponse(result);
    },
  },
  {
    definition: {
      name: "optimize-quest-route",
      description: "Optimize quest route for a zone with XP/hour calculations",
      inputSchema: {
        type: "object",
        properties: {
          zoneId: { type: "number", description: "Zone/map ID" },
          playerLevel: { type: "number", description: "Current player level" },
          maxQuests: { type: "number", description: "Optional: maximum number of quests (default: 30)" },
        },
        required: ["zoneId", "playerLevel"],
      },
    },
    handler: async (args) => {
      const result = await optimizeQuestRoute(
        args.zoneId as number,
        args.playerLevel as number,
        args.maxQuests as number | undefined
      );
      return jsonResponse(result);
    },
  },
  {
    definition: {
      name: "get-leveling-path",
      description: "Get optimal leveling path from start to target level",
      inputSchema: {
        type: "object",
        properties: {
          startLevel: { type: "number", description: "Starting level" },
          targetLevel: { type: "number", description: "Target level to reach" },
          faction: { type: "string", description: "Player faction: alliance or horde" },
        },
        required: ["startLevel", "targetLevel", "faction"],
      },
    },
    handler: async (args) => {
      const result = await getOptimalLevelingPath(
        args.startLevel as number,
        args.targetLevel as number,
        args.faction as "alliance" | "horde"
      );
      return jsonResponse(result);
    },
  },
  {
    definition: {
      name: "get-collection-status",
      description: "Get collection status for pets, mounts, toys, or heirlooms",
      inputSchema: {
        type: "object",
        properties: {
          type: { type: "string", description: "Collection type: pet, mount, toy, or heirloom" },
        },
        required: ["type"],
      },
    },
    handler: async (args) => {
      const result = await getCollectionStatus(args.type as any, args.accountId as number | undefined);
      return jsonResponse(result);
    },
  },
  {
    definition: {
      name: "find-missing-collectibles",
      description: "Find missing collectibles by type and rarity",
      inputSchema: {
        type: "object",
        properties: {
          type: { type: "string", description: "Collectible type: pet, mount, or toy" },
          minRarity: { type: "string", description: "Optional: minimum rarity filter (default: uncommon)" },
        },
        required: ["type"],
      },
    },
    handler: async (args) => {
      const result = await findMissingCollectibles(
        args.type as "pet" | "mount" | "toy",
        args.minRarity as string | undefined
      );
      return jsonResponse(result);
    },
  },
  {
    definition: {
      name: "get-farming-route",
      description: "Get farming route for a specific collectible",
      inputSchema: {
        type: "object",
        properties: {
          collectibleId: { type: "number", description: "Item ID of the collectible" },
          type: { type: "string", description: "Collectible type: pet, mount, or toy" },
        },
        required: ["collectibleId", "type"],
      },
    },
    handler: async (args) => {
      const result = await getFarmingRoute(
        args.collectibleId as number,
        args.type as "pet" | "mount" | "toy"
      );
      return jsonResponse(result);
    },
  },
];
