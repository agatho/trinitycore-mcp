/**
 * Game Data Tools Registry
 *
 * Core game data access tools: spell, item, quest, DBC/DB2, API docs, opcodes.
 *
 * @module tools/registry/game-data
 */

import { ToolRegistryEntry, jsonResponse, textResponse } from "./types";
import { getSpellInfo } from "../spell";
import { getItemInfo } from "../item";
import { getQuestInfo } from "../quest";
import { queryDBC } from "../dbc";
import { getTrinityAPI } from "../api";
import { getOpcodeInfo } from "../opcode";

export const gameDataTools: ToolRegistryEntry[] = [
  {
    definition: {
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
    handler: async (args) => {
      const result = await getSpellInfo(args.spellId as number);
      return jsonResponse(result);
    },
  },
  {
    definition: {
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
    handler: async (args) => {
      const result = await getItemInfo(args.itemId as number);
      return jsonResponse(result);
    },
  },
  {
    definition: {
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
    handler: async (args) => {
      const result = await getQuestInfo(args.questId as number);
      return jsonResponse(result);
    },
  },
  {
    definition: {
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
    handler: async (args) => {
      const result = await queryDBC(args.dbcFile as string, args.recordId as number);
      return jsonResponse(result);
    },
  },
  {
    definition: {
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
    handler: async (args) => {
      const result = await getTrinityAPI(args.className as string, args.methodName as string | undefined);
      return textResponse(result);
    },
  },
  {
    definition: {
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
    handler: async (args) => {
      const result = await getOpcodeInfo(args.opcode as string);
      return jsonResponse(result);
    },
  },
];
