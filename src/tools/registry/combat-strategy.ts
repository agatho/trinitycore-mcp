/**
 * Combat & Strategy Tools Registry
 *
 * Talent, combat mechanics, buff optimization, dungeon strategy, PvP, group coordination.
 *
 * @module tools/registry/combat-strategy
 */

import { ToolRegistryEntry, jsonResponse } from "./types";
import { getClassSpecializations, getRecommendedTalentBuild } from "../talent";
import { calculateMeleeDamage, calculateArmorMitigation } from "../combatmechanics";
import { getBuffRecommendations } from "../buffoptimizer";
import { getBossMechanics, getMythicPlusStrategy } from "../dungeonstrategy";
import { analyzeGroupComposition, coordinateCooldowns } from "../coordination";
import {
  analyzeArenaComposition,
  getBattlegroundStrategy,
  getPvPTalentBuild,
} from "../pvptactician";
import { getDefaultStatWeights } from "../gearoptimizer";

export const combatStrategyTools: ToolRegistryEntry[] = [
  {
    definition: {
      name: "get-class-specializations",
      description: "Get all available specializations for a WoW class",
      inputSchema: {
        type: "object",
        properties: {
          classId: { type: "number", description: "Class ID (1=Warrior, 2=Paladin, 3=Hunter, etc.)" },
        },
        required: ["classId"],
      },
    },
    handler: async (args) => {
      const result = await getClassSpecializations(args.classId as number);
      return jsonResponse(result);
    },
  },
  {
    definition: {
      name: "get-talent-build",
      description: "Get recommended talent build for a spec and purpose (leveling, raid, dungeon, pvp, solo)",
      inputSchema: {
        type: "object",
        properties: {
          specId: { type: "number", description: "Specialization ID" },
          purpose: { type: "string", description: "Build purpose: leveling, raid, dungeon, pvp, or solo" },
          playerLevel: { type: "number", description: "Player level" },
        },
        required: ["specId", "purpose", "playerLevel"],
      },
    },
    handler: async (args) => {
      const result = getRecommendedTalentBuild(
        args.specId as number,
        args.purpose as "leveling" | "raid" | "dungeon" | "pvp" | "solo",
        args.playerLevel as number
      );
      return jsonResponse(result);
    },
  },
  {
    definition: {
      name: "calculate-melee-damage",
      description: "Calculate melee damage with weapon stats, attack power, and crit",
      inputSchema: {
        type: "object",
        properties: {
          weaponDPS: { type: "number", description: "Weapon DPS value" },
          attackSpeed: { type: "number", description: "Weapon attack speed in seconds" },
          attackPower: { type: "number", description: "Total attack power" },
          critRating: { type: "number", description: "Critical strike rating" },
          level: { type: "number", description: "Player level" },
        },
        required: ["weaponDPS", "attackSpeed", "attackPower", "critRating", "level"],
      },
    },
    handler: async (args) => {
      const result = await calculateMeleeDamage({
        weaponDPS: args.weaponDPS as number,
        attackSpeed: args.attackSpeed as number,
        attackPower: args.attackPower as number,
        critRating: args.critRating as number,
        level: args.level as number,
      });
      return jsonResponse(result);
    },
  },
  {
    definition: {
      name: "calculate-armor-mitigation",
      description: "Calculate damage reduction from armor",
      inputSchema: {
        type: "object",
        properties: {
          rawDamage: { type: "number", description: "Raw incoming damage" },
          armor: { type: "number", description: "Target's armor value" },
          attackerLevel: { type: "number", description: "Attacker's level" },
        },
        required: ["rawDamage", "armor", "attackerLevel"],
      },
    },
    handler: async (args) => {
      const result = await calculateArmorMitigation(
        args.rawDamage as number,
        args.armor as number,
        args.attackerLevel as number
      );
      return jsonResponse(result);
    },
  },
  {
    definition: {
      name: "get-buff-recommendations",
      description: "Get buff and consumable recommendations for a role and class",
      inputSchema: {
        type: "object",
        properties: {
          role: { type: "string", description: "Role: tank, healer, melee_dps, or ranged_dps" },
          classId: { type: "number", description: "Class ID" },
          budget: { type: "number", description: "Optional: gold budget in copper for consumables" },
          contentType: { type: "string", description: "Optional: raid, dungeon, solo, or pvp" },
        },
        required: ["role", "classId"],
      },
    },
    handler: async (args) => {
      const classId = args.classId as number;
      const defaultSpecId = classId * 10;
      const statWeights = getDefaultStatWeights(classId, defaultSpecId);
      const result = getBuffRecommendations({
        role: args.role as "tank" | "healer" | "melee_dps" | "ranged_dps",
        classId,
        statWeights,
        budget: args.budget as number | undefined,
        contentType: (args.contentType as "raid" | "dungeon" | "solo" | "pvp" | undefined) || "raid",
      });
      return jsonResponse(result);
    },
  },
  {
    definition: {
      name: "get-boss-mechanics",
      description: "Get boss mechanics, abilities, and strategy for a boss creature",
      inputSchema: {
        type: "object",
        properties: {
          bossCreatureId: { type: "number", description: "Boss creature entry ID" },
        },
        required: ["bossCreatureId"],
      },
    },
    handler: async (args) => {
      const result = await getBossMechanics(args.bossCreatureId as number);
      return jsonResponse(result);
    },
  },
  {
    definition: {
      name: "get-mythic-plus-strategy",
      description: "Get Mythic+ specific strategy for keystone level and affixes",
      inputSchema: {
        type: "object",
        properties: {
          keystoneLevel: { type: "number", description: "Mythic+ keystone level (2-30)" },
          affixes: { type: "array", items: { type: "string" }, description: "Active affixes (e.g., Fortified, Tyrannical, Sanguine)" },
        },
        required: ["keystoneLevel", "affixes"],
      },
    },
    handler: async (args) => {
      const result = getMythicPlusStrategy(args.keystoneLevel as number, args.affixes as string[]);
      return jsonResponse(result);
    },
  },
  {
    definition: {
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
    handler: async (args) => {
      const result = analyzeGroupComposition(args.bots as any[]);
      return jsonResponse(result);
    },
  },
  {
    definition: {
      name: "coordinate-cooldowns",
      description: "Create coordinated cooldown plan for group encounters",
      inputSchema: {
        type: "object",
        properties: {
          bots: { type: "array", items: { type: "object" }, description: "Array of bot information objects" },
          encounterDuration: { type: "number", description: "Expected encounter duration in seconds" },
        },
        required: ["bots", "encounterDuration"],
      },
    },
    handler: async (args) => {
      const result = coordinateCooldowns(args.bots as any[], args.encounterDuration as number);
      return jsonResponse(result);
    },
  },
  {
    definition: {
      name: "analyze-arena-composition",
      description: "Analyze PvP arena team composition with strengths, weaknesses, and strategy",
      inputSchema: {
        type: "object",
        properties: {
          bracket: { type: "string", description: "Arena bracket: 2v2, 3v3, 5v5, or solo_shuffle" },
          team: { type: "array", items: { type: "object" }, description: "Array of team member objects" },
          rating: { type: "number", description: "Current arena rating" },
        },
        required: ["bracket", "team", "rating"],
      },
    },
    handler: async (args) => {
      const result = analyzeArenaComposition(args.bracket as any, args.team as any[], args.rating as number);
      return jsonResponse(result);
    },
  },
  {
    definition: {
      name: "get-battleground-strategy",
      description: "Get battleground strategy including objectives, roles, and timing",
      inputSchema: {
        type: "object",
        properties: {
          bgId: { type: "number", description: "Battleground ID (2=WSG, 3=AB, etc.)" },
        },
        required: ["bgId"],
      },
    },
    handler: async (args) => {
      const result = await getBattlegroundStrategy(args.bgId as number);
      return jsonResponse(result);
    },
  },
  {
    definition: {
      name: "get-pvp-talent-build",
      description: "Get PvP talent build for spec and bracket",
      inputSchema: {
        type: "object",
        properties: {
          specId: { type: "number", description: "Specialization ID" },
          bracket: { type: "string", description: "PvP bracket: 2v2, 3v3, 5v5, rbg, or solo_shuffle" },
        },
        required: ["specId", "bracket"],
      },
    },
    handler: async (args) => {
      const result = getPvPTalentBuild(args.specId as number, args.bracket as any);
      return jsonResponse(result);
    },
  },
];
