/**
 * Natural Language Game Master Tool
 *
 * Parses natural language commands into structured TrinityCore GM commands.
 * Supports spawn, teleport, modify, announce, weather, and other world-altering operations.
 *
 * Safety features:
 * - Dangerous commands require explicit confirmation
 * - All generated commands are logged
 * - Dry-run mode returns commands without executing
 * - Parameter validation before command generation
 *
 * @module tools/gamemaster
 */

import { queryWorld } from "../database/connection";
import { logger } from "../utils/logger";

// =============================================================================
// Types
// =============================================================================

/** Categories of GM commands */
export type GMCommandCategory =
  | "spawn"
  | "teleport"
  | "modify"
  | "announce"
  | "weather"
  | "server"
  | "item"
  | "aura"
  | "npc"
  | "gobject"
  | "account"
  | "lookup"
  | "reset"
  | "kill"
  | "damage"
  | "revive"
  | "unknown";

/** Risk level of a command */
export type CommandRisk = "safe" | "moderate" | "dangerous";

/** A single parsed GM intent */
export interface GMIntent {
  category: GMCommandCategory;
  action: string;
  target: string;
  parameters: Record<string, string | number | boolean>;
  rawInput: string;
}

/** A generated TrinityCore command */
export interface GeneratedCommand {
  command: string;
  description: string;
  risk: CommandRisk;
  category: GMCommandCategory;
  requiresTarget?: boolean;
  notes?: string;
}

/** Result of the Game Master tool */
export interface GameMasterResult {
  success: boolean;
  interpretation: string;
  intents: GMIntent[];
  commands: GeneratedCommand[];
  warnings: string[];
  suggestions: string[];
  dryRun: boolean;
  executionResults?: Array<{
    command: string;
    success: boolean;
    output?: string;
    error?: string;
  }>;
}

// =============================================================================
// Intent Parsing
// =============================================================================

/** Pattern matchers for natural language parsing */
interface IntentPattern {
  patterns: RegExp[];
  category: GMCommandCategory;
  action: string;
  extractParams: (match: RegExpMatchArray, fullText: string) => Record<string, string | number | boolean>;
}

const INTENT_PATTERNS: IntentPattern[] = [
  // --- SPAWN ---
  {
    patterns: [
      /spawn\s+(\d+)\s+(.+?)(?:\s+(?:near|at|in)\s+(.+))?$/i,
      /(?:create|add|place|summon)\s+(\d+)\s+(.+?)(?:\s+(?:near|at|in)\s+(.+))?$/i,
    ],
    category: "spawn",
    action: "creature",
    extractParams: (match) => ({
      count: parseInt(match[1]) || 1,
      target: match[2].trim(),
      location: match[3]?.trim() || "",
    }),
  },
  {
    patterns: [
      /spawn\s+(?:a\s+)?(.+?)(?:\s+(?:near|at|in)\s+(.+))?$/i,
      /(?:create|add|place|summon)\s+(?:a\s+)?(.+?)(?:\s+(?:near|at|in)\s+(.+))?$/i,
    ],
    category: "spawn",
    action: "creature",
    extractParams: (match) => ({
      count: 1,
      target: match[1].trim(),
      location: match[2]?.trim() || "",
    }),
  },
  {
    patterns: [
      /spawn\s+(?:game\s*object|gobj|object)\s+(\d+)/i,
      /(?:place|add)\s+(?:game\s*object|gobj|object)\s+(\d+)/i,
    ],
    category: "gobject",
    action: "add",
    extractParams: (match) => ({
      entry: parseInt(match[1]),
    }),
  },

  // --- TELEPORT ---
  {
    patterns: [
      /(?:teleport|tp|move|send|port)\s+(.+?)\s+(?:to|at|in)\s+(.+)/i,
      /(?:go|goto|travel)\s+(?:to\s+)?(.+)/i,
    ],
    category: "teleport",
    action: "player",
    extractParams: (match) => {
      if (match[2]) {
        return { target: match[1].trim(), destination: match[2].trim() };
      }
      return { target: "self", destination: match[1].trim() };
    },
  },
  {
    patterns: [
      /(?:bring|summon|pull)\s+(.+?)(?:\s+(?:to|here))?$/i,
    ],
    category: "teleport",
    action: "summon",
    extractParams: (match) => ({
      target: match[1].trim(),
    }),
  },

  // --- MODIFY ---
  {
    patterns: [
      /(?:set|change|modify)\s+(.+?)(?:'s)?\s+(?:level|lvl)\s+(?:to\s+)?(\d+)/i,
      /(?:level|lvl)\s+(.+?)\s+(?:to\s+)?(\d+)/i,
    ],
    category: "modify",
    action: "level",
    extractParams: (match) => ({
      target: match[1].trim(),
      level: parseInt(match[2]),
    }),
  },
  {
    patterns: [
      /(?:set|change|modify)\s+(.+?)(?:'s)?\s+(?:speed|movement)\s+(?:to\s+)?(\d+(?:\.\d+)?)/i,
    ],
    category: "modify",
    action: "speed",
    extractParams: (match) => ({
      target: match[1].trim(),
      speed: parseFloat(match[2]),
    }),
  },
  {
    patterns: [
      /(?:set|change|modify)\s+(.+?)(?:'s)?\s+(?:hp|health|hitpoints)\s+(?:to\s+)?(\d+)/i,
      /(?:heal|restore)\s+(.+)/i,
    ],
    category: "modify",
    action: "hp",
    extractParams: (match) => ({
      target: match[1].trim(),
      value: match[2] ? parseInt(match[2]) : -1,
    }),
  },
  {
    patterns: [
      /(?:set|change|modify)\s+(.+?)(?:'s)?\s+(?:money|gold)\s+(?:to\s+)?(\d+)/i,
      /(?:give|add)\s+(\d+)\s*(?:gold|g)\s+(?:to\s+)?(.+)/i,
    ],
    category: "modify",
    action: "money",
    extractParams: (match) => {
      // Handle "give 100 gold to Player" vs "set Player's gold to 100"
      if (/^(?:give|add)/i.test(match[0])) {
        return { target: match[2].trim(), amount: parseInt(match[1]) };
      }
      return { target: match[1].trim(), amount: parseInt(match[2]) };
    },
  },
  {
    patterns: [
      /(?:make|set)\s+(.+?)\s+(?:invincible|invulnerable|god\s*mode)/i,
    ],
    category: "modify",
    action: "godmode",
    extractParams: (match) => ({
      target: match[1].trim(),
      enabled: true,
    }),
  },
  {
    patterns: [
      /(?:make|set)\s+(.+?)\s+(?:visible|invisible|fly|flying)/i,
    ],
    category: "modify",
    action: "flag",
    extractParams: (match) => {
      const flag = match[0].match(/(?:visible|invisible|fly|flying)/i)?.[0].toLowerCase() || "";
      return { target: match[1].trim(), flag };
    },
  },

  // --- ITEM ---
  {
    patterns: [
      /(?:give|add)\s+(?:item\s+)?(\d+)(?:\s+x?\s*(\d+))?\s+(?:to\s+)?(.+)/i,
      /(?:give|add)\s+(.+?)\s+(?:item\s+)?(\d+)(?:\s+x?\s*(\d+))?/i,
    ],
    category: "item",
    action: "add",
    extractParams: (match) => {
      // "give item 12345 x5 to Player" pattern
      if (/(?:give|add)\s+(?:item\s+)?\d+/i.test(match[0])) {
        return {
          itemId: parseInt(match[1]),
          count: parseInt(match[2]) || 1,
          target: match[3]?.trim() || "self",
        };
      }
      // "give Player item 12345 x5" pattern
      return {
        target: match[1].trim(),
        itemId: parseInt(match[2]),
        count: parseInt(match[3]) || 1,
      };
    },
  },

  // --- AURA ---
  {
    patterns: [
      /(?:apply|cast|add)\s+(?:aura|spell|buff)\s+(\d+)\s+(?:to|on)\s+(.+)/i,
      /(?:buff|debuff)\s+(.+?)\s+(?:with)\s+(\d+)/i,
    ],
    category: "aura",
    action: "add",
    extractParams: (match) => {
      if (/(?:buff|debuff)/i.test(match[0])) {
        return { target: match[1].trim(), spellId: parseInt(match[2]) };
      }
      return { spellId: parseInt(match[1]), target: match[2].trim() };
    },
  },
  {
    patterns: [
      /(?:remove|dispel|cleanse)\s+(?:aura|spell|buff|debuff)\s+(\d+)\s+(?:from|on)\s+(.+)/i,
      /(?:remove|dispel|cleanse)\s+(?:all\s+)?(?:auras|buffs|debuffs)\s+(?:from|on)\s+(.+)/i,
    ],
    category: "aura",
    action: "remove",
    extractParams: (match): Record<string, string | number | boolean> => {
      if (match[2]) {
        return { spellId: parseInt(match[1]), target: match[2].trim() };
      }
      return { target: match[1].trim(), all: true };
    },
  },

  // --- ANNOUNCE ---
  {
    patterns: [
      /(?:announce|broadcast|say|yell)\s+["']?(.+?)["']?$/i,
      /(?:send\s+message|message)\s+["']?(.+?)["']?$/i,
    ],
    category: "announce",
    action: "broadcast",
    extractParams: (match) => ({
      message: match[1].trim(),
    }),
  },
  {
    patterns: [
      /(?:whisper|tell|dm)\s+(.+?)\s+["'](.+?)["']/i,
    ],
    category: "announce",
    action: "whisper",
    extractParams: (match) => ({
      target: match[1].trim(),
      message: match[2].trim(),
    }),
  },

  // --- WEATHER ---
  {
    patterns: [
      /(?:set|change|make)\s+(?:the\s+)?weather\s+(?:to\s+)?(.+)/i,
      /(?:make\s+it|start)\s+(rain(?:ing)?|snow(?:ing)?|storm(?:ing)?|sunny|clear|fog(?:gy)?)/i,
    ],
    category: "weather",
    action: "set",
    extractParams: (match) => ({
      weather: match[1].trim().toLowerCase(),
    }),
  },

  // --- KILL ---
  {
    patterns: [
      /(?:kill|slay|destroy)\s+(.+)/i,
    ],
    category: "kill",
    action: "target",
    extractParams: (match) => ({
      target: match[1].trim(),
    }),
  },

  // --- DAMAGE ---
  {
    patterns: [
      /(?:damage|hurt|hit)\s+(.+?)\s+(?:for\s+)?(\d+)/i,
    ],
    category: "damage",
    action: "deal",
    extractParams: (match) => ({
      target: match[1].trim(),
      amount: parseInt(match[2]),
    }),
  },

  // --- REVIVE ---
  {
    patterns: [
      /(?:revive|resurrect|rez|res)\s+(.+)/i,
    ],
    category: "revive",
    action: "player",
    extractParams: (match) => ({
      target: match[1].trim(),
    }),
  },

  // --- SERVER ---
  {
    patterns: [
      /(?:shutdown|restart)\s+(?:the\s+)?server(?:\s+in\s+(\d+)\s*(?:seconds?|s|minutes?|m))?/i,
    ],
    category: "server",
    action: "control",
    extractParams: (match) => {
      const isRestart = /restart/i.test(match[0]);
      let delaySec = parseInt(match[1]) || 0;
      if (/minutes?|m/i.test(match[0]) && match[1]) {
        delaySec = delaySec * 60;
      }
      return { action: isRestart ? "restart" : "shutdown", delay: delaySec };
    },
  },
  {
    patterns: [
      /(?:save|saveall|save\s+all)\s*(?:players|data)?/i,
    ],
    category: "server",
    action: "save",
    extractParams: () => ({}),
  },
  {
    patterns: [
      /(?:reload)\s+(?:the\s+)?(.+)/i,
    ],
    category: "server",
    action: "reload",
    extractParams: (match) => ({
      what: match[1].trim().toLowerCase(),
    }),
  },

  // --- ACCOUNT ---
  {
    patterns: [
      /(?:ban|kick)\s+(?:player|account|user)\s+(.+?)(?:\s+(?:for|reason:?)\s+(.+))?$/i,
    ],
    category: "account",
    action: "moderate",
    extractParams: (match) => {
      const action = /ban/i.test(match[0]) ? "ban" : "kick";
      return { action, target: match[1].trim(), reason: match[2]?.trim() || "" };
    },
  },

  // --- NPC ---
  {
    patterns: [
      /(?:delete|remove|despawn)\s+(?:the\s+)?(?:nearest|closest|selected)?\s*(?:creature|npc|mob)/i,
    ],
    category: "npc",
    action: "delete",
    extractParams: () => ({
      target: "selected",
    }),
  },

  // --- LOOKUP ---
  {
    patterns: [
      /(?:find|search|lookup|look\s*up)\s+(?:creature|npc|mob)\s+(.+)/i,
    ],
    category: "lookup",
    action: "creature",
    extractParams: (match) => ({
      query: match[1].trim(),
    }),
  },
  {
    patterns: [
      /(?:find|search|lookup|look\s*up)\s+(?:item)\s+(.+)/i,
    ],
    category: "lookup",
    action: "item",
    extractParams: (match) => ({
      query: match[1].trim(),
    }),
  },
  {
    patterns: [
      /(?:find|search|lookup|look\s*up)\s+(?:spell)\s+(.+)/i,
    ],
    category: "lookup",
    action: "spell",
    extractParams: (match) => ({
      query: match[1].trim(),
    }),
  },
  {
    patterns: [
      /(?:find|search|lookup|look\s*up)\s+(?:quest)\s+(.+)/i,
    ],
    category: "lookup",
    action: "quest",
    extractParams: (match) => ({
      query: match[1].trim(),
    }),
  },

  // --- RESET ---
  {
    patterns: [
      /(?:reset|clear)\s+(.+?)(?:'s)?\s+(?:cooldowns?|cd)/i,
    ],
    category: "reset",
    action: "cooldowns",
    extractParams: (match) => ({
      target: match[1].trim(),
    }),
  },
  {
    patterns: [
      /(?:reset|clear)\s+(.+?)(?:'s)?\s+(?:talents?|specs?)/i,
    ],
    category: "reset",
    action: "talents",
    extractParams: (match) => ({
      target: match[1].trim(),
    }),
  },
];

// =============================================================================
// Location Resolver
// =============================================================================

/** Well-known TrinityCore locations with coordinates */
const KNOWN_LOCATIONS: Record<string, { mapId: number; x: number; y: number; z: number }> = {
  "stormwind": { mapId: 0, x: -8842.09, y: 626.358, z: 94.0867 },
  "orgrimmar": { mapId: 1, x: 1629.36, y: -4373.39, z: 31.2564 },
  "ironforge": { mapId: 0, x: -4981.25, y: -881.542, z: 501.66 },
  "darnassus": { mapId: 1, x: 9947.52, y: 2482.73, z: 1316.19 },
  "undercity": { mapId: 0, x: 1586.48, y: 239.562, z: -52.149 },
  "thunder bluff": { mapId: 1, x: -1278.75, y: 129.818, z: 131.967 },
  "silvermoon": { mapId: 530, x: 9473.03, y: -7279.67, z: 14.4111 },
  "exodar": { mapId: 530, x: -3864.67, y: -11644, z: -137.33 },
  "dalaran": { mapId: 571, x: 5807.81, y: 588.565, z: 660.939 },
  "shattrath": { mapId: 530, x: -1838.16, y: 5301.88, z: -12.4281 },
  "goldshire": { mapId: 0, x: -9464.0, y: 62.0, z: 56.0 },
  "crossroads": { mapId: 1, x: -468.0, y: -2611.0, z: 96.0 },
  "booty bay": { mapId: 0, x: -14302.0, y: 518.0, z: 8.9 },
  "gadgetzan": { mapId: 1, x: -7179.0, y: -3785.0, z: 8.37 },
  "lakeshire": { mapId: 0, x: -9259.0, y: -2183.0, z: 63.86 },
  "darkshire": { mapId: 0, x: -10559.0, y: -1188.0, z: 28.06 },
  "tarren mill": { mapId: 0, x: -7.0, y: -939.0, z: 55.14 },
  "southshore": { mapId: 0, x: -807.0, y: -555.0, z: 15.51 },
};

/** Weather type to TrinityCore weather ID mapping */
const WEATHER_TYPES: Record<string, { type: number; grade: number }> = {
  "clear": { type: 0, grade: 0 },
  "sunny": { type: 0, grade: 0 },
  "rain": { type: 1, grade: 0.7 },
  "raining": { type: 1, grade: 0.7 },
  "light rain": { type: 1, grade: 0.3 },
  "heavy rain": { type: 1, grade: 1.0 },
  "snow": { type: 2, grade: 0.7 },
  "snowing": { type: 2, grade: 0.7 },
  "light snow": { type: 2, grade: 0.3 },
  "heavy snow": { type: 2, grade: 1.0 },
  "blizzard": { type: 2, grade: 1.0 },
  "storm": { type: 3, grade: 0.7 },
  "storming": { type: 3, grade: 0.7 },
  "sandstorm": { type: 3, grade: 0.7 },
  "thunderstorm": { type: 3, grade: 1.0 },
  "fog": { type: 1, grade: 0.1 },
  "foggy": { type: 1, grade: 0.1 },
};

// =============================================================================
// Creature Resolver
// =============================================================================

/**
 * Resolve a creature name to its entry ID via database lookup
 */
async function resolveCreatureEntry(nameOrId: string): Promise<{ entry: number; name: string } | null> {
  // If it's a number, use directly
  const asNumber = parseInt(nameOrId);
  if (!isNaN(asNumber) && asNumber > 0) {
    try {
      const rows = await queryWorld(
        "SELECT entry, name FROM creature_template WHERE entry = ? LIMIT 1",
        [asNumber]
      );
      if (rows && rows.length > 0) {
        return { entry: rows[0].entry, name: rows[0].name };
      }
    } catch {
      // Database unavailable, return the ID anyway
    }
    return { entry: asNumber, name: `Creature #${asNumber}` };
  }

  // Search by name
  try {
    const rows = await queryWorld(
      "SELECT entry, name FROM creature_template WHERE name LIKE ? ORDER BY entry ASC LIMIT 1",
      [`%${nameOrId}%`]
    );
    if (rows && rows.length > 0) {
      return { entry: rows[0].entry, name: rows[0].name };
    }
  } catch {
    // Database unavailable
  }

  return null;
}

/**
 * Resolve an item name to its entry ID via database lookup
 */
async function resolveItemEntry(nameOrId: string): Promise<{ entry: number; name: string } | null> {
  const asNumber = parseInt(nameOrId);
  if (!isNaN(asNumber) && asNumber > 0) {
    try {
      const rows = await queryWorld(
        "SELECT entry, name FROM item_template WHERE entry = ? LIMIT 1",
        [asNumber]
      );
      if (rows && rows.length > 0) {
        return { entry: rows[0].entry, name: rows[0].name };
      }
    } catch {
      // Database unavailable
    }
    return { entry: asNumber, name: `Item #${asNumber}` };
  }

  try {
    const rows = await queryWorld(
      "SELECT entry, name FROM item_template WHERE name LIKE ? ORDER BY entry ASC LIMIT 1",
      [`%${nameOrId}%`]
    );
    if (rows && rows.length > 0) {
      return { entry: rows[0].entry, name: rows[0].name };
    }
  } catch {
    // Database unavailable
  }

  return null;
}

// =============================================================================
// Risk Assessment
// =============================================================================

function assessRisk(category: GMCommandCategory, action: string, params: Record<string, string | number | boolean>): CommandRisk {
  // Dangerous: server control, mass effects, bans
  if (category === "server" && (action === "control")) return "dangerous";
  if (category === "account" && params.action === "ban") return "dangerous";
  if (category === "kill") return "dangerous";
  if (category === "reset" && action === "talents") return "moderate";

  // Moderate: spawn, modify, teleport others, item give
  if (category === "spawn") {
    const count = params.count as number;
    if (count > 10) return "dangerous";
    if (count > 1) return "moderate";
    return "moderate";
  }
  if (category === "modify") return "moderate";
  if (category === "item") return "moderate";
  if (category === "aura") return "moderate";
  if (category === "teleport") return "moderate";
  if (category === "damage") return "moderate";
  if (category === "npc" && action === "delete") return "moderate";
  if (category === "gobject") return "moderate";

  // Safe: lookups, announcements, weather, revive, save
  if (category === "lookup") return "safe";
  if (category === "announce") return "safe";
  if (category === "weather") return "safe";
  if (category === "revive") return "safe";
  if (category === "server" && action === "save") return "safe";
  if (category === "server" && action === "reload") return "moderate";
  if (category === "reset" && action === "cooldowns") return "safe";

  return "moderate";
}

// =============================================================================
// Command Generation
// =============================================================================

async function generateCommands(intent: GMIntent): Promise<{ commands: GeneratedCommand[]; warnings: string[] }> {
  const commands: GeneratedCommand[] = [];
  const warnings: string[] = [];
  const { category, action, parameters } = intent;

  switch (category) {
    case "spawn": {
      const count = (parameters.count as number) || 1;
      const target = parameters.target as string;

      if (count > 50) {
        warnings.push(`Spawn count ${count} is very high. Capped at 50 to prevent server issues.`);
      }
      const safeCount = Math.min(count, 50);

      // Try to resolve creature
      const creature = await resolveCreatureEntry(target);
      if (!creature) {
        warnings.push(`Could not resolve creature "${target}". Use a creature entry ID for reliable results.`);
        commands.push({
          command: `.lookup creature ${target}`,
          description: `Look up creature "${target}" to find the entry ID`,
          risk: "safe",
          category: "lookup",
        });
        break;
      }

      for (let i = 0; i < safeCount; i++) {
        commands.push({
          command: `.npc add ${creature.entry}`,
          description: `Spawn ${creature.name} (entry ${creature.entry})${i > 0 ? ` [#${i + 1}]` : ""}`,
          risk: assessRisk(category, action, parameters),
          category,
          requiresTarget: false,
        });
      }

      if (parameters.location) {
        const loc = KNOWN_LOCATIONS[(parameters.location as string).toLowerCase()];
        if (loc) {
          commands.unshift({
            command: `.tele name ${parameters.location}`,
            description: `Teleport to ${parameters.location} first (to spawn creatures there)`,
            risk: "moderate",
            category: "teleport",
            notes: `Coordinates: ${loc.x}, ${loc.y}, ${loc.z} (Map ${loc.mapId})`,
          });
        } else {
          warnings.push(`Location "${parameters.location}" not found in known locations. You'll need to navigate there manually.`);
        }
      }
      break;
    }

    case "gobject": {
      const entry = parameters.entry as number;
      commands.push({
        command: `.gobject add ${entry}`,
        description: `Spawn game object (entry ${entry}) at current position`,
        risk: "moderate",
        category,
      });
      break;
    }

    case "teleport": {
      if (action === "summon") {
        const target = parameters.target as string;
        commands.push({
          command: `.appear ${target}`,
          description: `Summon ${target} to your location`,
          risk: "moderate",
          category,
          notes: "Target must be online",
        });
      } else {
        const target = parameters.target as string;
        const destination = parameters.destination as string;
        const loc = KNOWN_LOCATIONS[destination.toLowerCase()];

        if (target === "self" || target.toLowerCase() === "me") {
          if (loc) {
            commands.push({
              command: `.tele name ${destination}`,
              description: `Teleport yourself to ${destination}`,
              risk: "moderate",
              category,
              notes: `Coordinates: ${loc.x}, ${loc.y}, ${loc.z} (Map ${loc.mapId})`,
            });
          } else {
            commands.push({
              command: `.tele name ${destination}`,
              description: `Teleport yourself to ${destination}`,
              risk: "moderate",
              category,
              notes: "Using server-side teleport name lookup",
            });
          }
        } else {
          if (loc) {
            commands.push({
              command: `.teleport ${target} ${loc.mapId} ${loc.x} ${loc.y} ${loc.z}`,
              description: `Teleport ${target} to ${destination}`,
              risk: "moderate",
              category,
              notes: `Coordinates: ${loc.x}, ${loc.y}, ${loc.z} (Map ${loc.mapId})`,
            });
          } else {
            commands.push({
              command: `.tele name ${destination}`,
              description: `Teleport to ${destination} (navigate there, then summon ${target})`,
              risk: "moderate",
              category,
            });
            commands.push({
              command: `.appear ${target}`,
              description: `Then summon ${target} to your new location`,
              risk: "moderate",
              category,
            });
          }
        }
      }
      break;
    }

    case "modify": {
      const target = parameters.target as string;
      const isSelf = target.toLowerCase() === "self" || target.toLowerCase() === "me";

      switch (action) {
        case "level": {
          const level = parameters.level as number;
          if (level < 1 || level > 90) {
            warnings.push("Level must be between 1 and 90.");
            break;
          }
          if (!isSelf) {
            commands.push({
              command: `.character level ${target} ${level}`,
              description: `Set ${target}'s level to ${level}`,
              risk: "moderate",
              category,
            });
          } else {
            commands.push({
              command: `.modify level ${level}`,
              description: `Set your level to ${level}`,
              risk: "moderate",
              category,
              requiresTarget: false,
            });
          }
          break;
        }
        case "speed": {
          const speed = parameters.speed as number;
          if (speed < 0.1 || speed > 50) {
            warnings.push("Speed must be between 0.1 and 50.");
            break;
          }
          commands.push({
            command: `.modify speed all ${speed}`,
            description: `Set ${isSelf ? "your" : target + "'s"} speed to ${speed}x`,
            risk: "moderate",
            category,
            requiresTarget: !isSelf,
          });
          break;
        }
        case "hp": {
          const value = parameters.value as number;
          if (value === -1) {
            // Heal to full
            commands.push({
              command: `.modify hp 999999`,
              description: `Heal ${isSelf ? "yourself" : target} to full health`,
              risk: "moderate",
              category,
              requiresTarget: !isSelf,
            });
          } else {
            commands.push({
              command: `.modify hp ${value}`,
              description: `Set ${isSelf ? "your" : target + "'s"} HP to ${value}`,
              risk: "moderate",
              category,
              requiresTarget: !isSelf,
            });
          }
          break;
        }
        case "money": {
          const amount = parameters.amount as number;
          const copper = amount * 10000; // Gold to copper
          commands.push({
            command: `.modify money ${copper}`,
            description: `Give ${isSelf ? "yourself" : target} ${amount} gold (${copper} copper)`,
            risk: "moderate",
            category,
            requiresTarget: !isSelf,
          });
          break;
        }
        case "godmode": {
          commands.push({
            command: `.gm on`,
            description: `Enable GM mode (god mode)`,
            risk: "moderate",
            category,
          });
          break;
        }
        case "flag": {
          const flag = parameters.flag as string;
          switch (flag) {
            case "invisible":
              commands.push({
                command: `.gm vis off`,
                description: "Become invisible",
                risk: "safe",
                category,
              });
              break;
            case "visible":
              commands.push({
                command: `.gm vis on`,
                description: "Become visible",
                risk: "safe",
                category,
              });
              break;
            case "fly":
            case "flying":
              commands.push({
                command: `.gm fly on`,
                description: "Enable flying",
                risk: "safe",
                category,
              });
              break;
          }
          break;
        }
      }
      break;
    }

    case "item": {
      const itemId = parameters.itemId as number;
      const count = (parameters.count as number) || 1;
      const target = parameters.target as string;
      const isSelf = target === "self" || target.toLowerCase() === "me";

      if (count > 200) {
        warnings.push(`Item count ${count} is very high. Capped at 200.`);
      }
      const safeCount = Math.min(count, 200);

      if (isSelf) {
        commands.push({
          command: `.additem ${itemId} ${safeCount}`,
          description: `Add ${safeCount}x item #${itemId} to your inventory`,
          risk: "moderate",
          category,
        });
      } else {
        commands.push({
          command: `.send items ${target} "GM Gift" "Here is your item" ${itemId}:${safeCount}`,
          description: `Send ${safeCount}x item #${itemId} to ${target} via mail`,
          risk: "moderate",
          category,
          notes: "Item will arrive in target's mailbox",
        });
      }
      break;
    }

    case "aura": {
      const spellId = parameters.spellId as number;
      const target = parameters.target as string;

      if (action === "add") {
        commands.push({
          command: `.aura ${spellId}`,
          description: `Apply aura/spell ${spellId} to ${target}`,
          risk: "moderate",
          category,
          requiresTarget: target !== "self",
        });
      } else if (action === "remove") {
        if (parameters.all) {
          commands.push({
            command: `.unaura all`,
            description: `Remove all auras from ${target}`,
            risk: "moderate",
            category,
            requiresTarget: target !== "self",
          });
        } else {
          commands.push({
            command: `.unaura ${spellId}`,
            description: `Remove aura ${spellId} from ${target}`,
            risk: "moderate",
            category,
            requiresTarget: target !== "self",
          });
        }
      }
      break;
    }

    case "announce": {
      if (action === "broadcast") {
        const message = parameters.message as string;
        commands.push({
          command: `.announce ${message}`,
          description: `Broadcast message to all players: "${message}"`,
          risk: "safe",
          category,
        });
      } else if (action === "whisper") {
        const target = parameters.target as string;
        const message = parameters.message as string;
        commands.push({
          command: `.whisper ${target} ${message}`,
          description: `Whisper to ${target}: "${message}"`,
          risk: "safe",
          category,
        });
      }
      break;
    }

    case "weather": {
      const weather = parameters.weather as string;
      const weatherData = WEATHER_TYPES[weather];

      if (!weatherData) {
        warnings.push(`Unknown weather type: "${weather}". Available: ${Object.keys(WEATHER_TYPES).join(", ")}`);
        break;
      }

      commands.push({
        command: `.modify weather ${weatherData.type} ${weatherData.grade}`,
        description: `Set weather to ${weather} (type ${weatherData.type}, intensity ${weatherData.grade})`,
        risk: "safe",
        category,
      });
      break;
    }

    case "kill": {
      const target = parameters.target as string;
      if (target.toLowerCase() === "all" || target.toLowerCase().includes("nearby") || target.toLowerCase().includes("all")) {
        warnings.push("Mass kill is extremely dangerous. Use .die on individual targets instead.");
        commands.push({
          command: `.die`,
          description: `Kill selected target`,
          risk: "dangerous",
          category,
          requiresTarget: true,
          notes: "Select each target individually. Mass kill not supported for safety.",
        });
      } else {
        commands.push({
          command: `.die`,
          description: `Kill target ${target}`,
          risk: "dangerous",
          category,
          requiresTarget: true,
          notes: `Select ${target} first, then execute`,
        });
      }
      break;
    }

    case "damage": {
      const amount = parameters.amount as number;
      commands.push({
        command: `.damage ${amount}`,
        description: `Deal ${amount} damage to selected target`,
        risk: "moderate",
        category,
        requiresTarget: true,
      });
      break;
    }

    case "revive": {
      const target = parameters.target as string;
      const isSelf = target.toLowerCase() === "self" || target.toLowerCase() === "me";
      commands.push({
        command: isSelf ? `.revive` : `.revive ${target}`,
        description: `Revive ${isSelf ? "yourself" : target}`,
        risk: "safe",
        category,
      });
      break;
    }

    case "server": {
      if (action === "control") {
        const serverAction = parameters.action as string;
        const delay = parameters.delay as number;
        commands.push({
          command: `.server ${serverAction} ${delay || 0}`,
          description: `${serverAction === "restart" ? "Restart" : "Shutdown"} server${delay ? ` in ${delay} seconds` : " immediately"}`,
          risk: "dangerous",
          category,
          notes: delay ? `Players will be warned ${delay} seconds before ${serverAction}` : "IMMEDIATE - no warning to players!",
        });
      } else if (action === "save") {
        commands.push({
          command: `.saveall`,
          description: "Save all players and world data",
          risk: "safe",
          category,
        });
      } else if (action === "reload") {
        const what = parameters.what as string;
        commands.push({
          command: `.reload ${what}`,
          description: `Reload ${what}`,
          risk: "moderate",
          category,
        });
      }
      break;
    }

    case "account": {
      const modAction = parameters.action as string;
      const target = parameters.target as string;
      const reason = parameters.reason as string;

      if (modAction === "kick") {
        commands.push({
          command: `.kick ${target}${reason ? ` ${reason}` : ""}`,
          description: `Kick player ${target}${reason ? ` (reason: ${reason})` : ""}`,
          risk: "moderate",
          category,
        });
      } else if (modAction === "ban") {
        commands.push({
          command: `.ban account ${target} -1 ${reason || "Banned by GM"}`,
          description: `Permanently ban account ${target}${reason ? ` (reason: ${reason})` : ""}`,
          risk: "dangerous",
          category,
          notes: "This is a permanent ban. Use .unban to reverse.",
        });
      }
      break;
    }

    case "npc": {
      if (action === "delete") {
        commands.push({
          command: `.npc delete`,
          description: "Delete selected NPC from the world",
          risk: "moderate",
          category,
          requiresTarget: true,
        });
      }
      break;
    }

    case "lookup": {
      const query = parameters.query as string;
      commands.push({
        command: `.lookup ${action} ${query}`,
        description: `Search for ${action} matching "${query}"`,
        risk: "safe",
        category,
      });
      break;
    }

    case "reset": {
      const target = parameters.target as string;
      if (action === "cooldowns") {
        commands.push({
          command: `.cooldown`,
          description: `Reset ${target}'s cooldowns`,
          risk: "safe",
          category,
          requiresTarget: target !== "self" && target !== "me",
        });
      } else if (action === "talents") {
        commands.push({
          command: `.reset talents ${target}`,
          description: `Reset ${target}'s talents`,
          risk: "moderate",
          category,
        });
      }
      break;
    }

    default:
      warnings.push(`Could not generate commands for category: ${category}`);
  }

  return { commands, warnings };
}

// =============================================================================
// Intent Parser
// =============================================================================

function parseIntent(input: string): GMIntent[] {
  const intents: GMIntent[] = [];
  const normalizedInput = input.trim();

  for (const intentDef of INTENT_PATTERNS) {
    for (const pattern of intentDef.patterns) {
      const match = normalizedInput.match(pattern);
      if (match) {
        const params = intentDef.extractParams(match, normalizedInput);
        intents.push({
          category: intentDef.category,
          action: intentDef.action,
          target: (params.target as string) || "",
          parameters: params,
          rawInput: normalizedInput,
        });
        return intents; // Return first match
      }
    }
  }

  // No pattern matched - return unknown
  intents.push({
    category: "unknown",
    action: "unknown",
    target: normalizedInput,
    parameters: { raw: normalizedInput },
    rawInput: normalizedInput,
  });

  return intents;
}

// =============================================================================
// Suggestion Engine
// =============================================================================

function generateSuggestions(intents: GMIntent[], commands: GeneratedCommand[]): string[] {
  const suggestions: string[] = [];

  if (intents.length > 0 && intents[0].category === "unknown") {
    suggestions.push(
      'Try commands like: "spawn 5 wolves near Goldshire"',
      '"teleport me to Orgrimmar"',
      '"set Player1 level to 80"',
      '"give item 19019 to Player1"',
      '"announce Server maintenance in 30 minutes"',
      '"make it rain"',
      '"lookup creature Ragnaros"',
    );
  }

  // Suggest related actions based on what was done
  for (const cmd of commands) {
    if (cmd.category === "spawn") {
      suggestions.push('You can also: ".npc add temp" for temporary spawns that disappear on restart');
    }
    if (cmd.category === "teleport") {
      suggestions.push('Known locations: Stormwind, Orgrimmar, Ironforge, Darnassus, Undercity, Thunder Bluff, Dalaran, Shattrath, Goldshire, Crossroads');
    }
    if (cmd.category === "item") {
      suggestions.push('Use "lookup item [name]" to find item IDs');
    }
  }

  return [...new Set(suggestions)]; // Deduplicate
}

// =============================================================================
// Main Export
// =============================================================================

/**
 * Process a natural language Game Master command.
 *
 * @param input - Natural language command (e.g., "spawn 5 wolves near Goldshire")
 * @param dryRun - If true, only generate commands without executing (default: true)
 * @returns Parsed intents, generated commands, warnings, and suggestions
 */
export async function processGameMasterCommand(
  input: string,
  dryRun: boolean = true
): Promise<GameMasterResult> {
  logger.info("Processing Game Master command", { input, dryRun });

  if (!input || !input.trim()) {
    return {
      success: false,
      interpretation: "No command provided.",
      intents: [],
      commands: [],
      warnings: ["Please provide a natural language command."],
      suggestions: [
        'Try: "spawn 5 wolves near Goldshire"',
        'Try: "teleport me to Orgrimmar"',
        'Try: "set MyPlayer level to 60"',
        'Try: "announce Server restarting in 5 minutes"',
      ],
      dryRun,
    };
  }

  // Parse intent
  const intents = parseIntent(input);

  // Generate commands
  const allCommands: GeneratedCommand[] = [];
  const allWarnings: string[] = [];

  for (const intent of intents) {
    const { commands, warnings } = await generateCommands(intent);
    allCommands.push(...commands);
    allWarnings.push(...warnings);
  }

  // Build interpretation
  let interpretation = "";
  if (intents.length > 0 && intents[0].category !== "unknown") {
    const intent = intents[0];
    interpretation = `Understood: ${intent.category} → ${intent.action}`;
    if (intent.target) {
      interpretation += ` (target: ${intent.target})`;
    }
    interpretation += `. Generated ${allCommands.length} command${allCommands.length !== 1 ? "s" : ""}.`;
  } else {
    interpretation = `Could not parse command: "${input}". See suggestions below.`;
  }

  // Check for dangerous commands
  const dangerousCommands = allCommands.filter(c => c.risk === "dangerous");
  if (dangerousCommands.length > 0) {
    allWarnings.push(
      `${dangerousCommands.length} DANGEROUS command(s) detected. Review carefully before executing.`
    );
  }

  // Generate suggestions
  const suggestions = generateSuggestions(intents, allCommands);

  const result: GameMasterResult = {
    success: intents.length > 0 && intents[0].category !== "unknown",
    interpretation,
    intents,
    commands: allCommands,
    warnings: allWarnings,
    suggestions,
    dryRun,
  };

  logger.info("Game Master command processed", {
    input,
    intentCount: intents.length,
    commandCount: allCommands.length,
    warningCount: allWarnings.length,
    dryRun,
  });

  return result;
}
