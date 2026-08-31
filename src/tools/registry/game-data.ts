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
import { validateBuildSchemas } from "../buildvalidation";
import { getBuildInfo } from "../buildinfo";
import { getDistributions } from "../distributions";
import { listOpcodes, diffOpcodes } from "../opcodetools";

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
      description:
        "Get information about a network packet opcode. Accepts an opcode name " +
        "(e.g. 'CMSG_CAST_SPELL') or a wire value (e.g. '0x430029'). Returns direction, " +
        "family, index, derivation confidence and source build.",
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
  {
    definition: {
      name: "validate-build-schemas",
      description:
        "Validate that every registered DB2 schema matches the extracted client data for a build. " +
        "Reports verified, unverified, mismatched and missing schemas, plus any drift between the " +
        "manifest's active build and the installed client.",
      inputSchema: {
        type: "object",
        properties: {
          buildId: {
            type: "string",
            description: "Build id to validate; defaults to the active build",
          },
        },
        required: [],
      },
    },
    handler: async (args) => {
      const result = await validateBuildSchemas({ buildId: args.buildId as string | undefined });
      return jsonResponse(result);
    },
  },
  {
    definition: {
      name: "get-data-distributions",
      description:
        "Spell counts by school, item counts by quality and creature counts by type for the active " +
        "build, computed from the client data and cached on disk. The scan takes about two seconds; " +
        "subsequent calls are served from the cache until the build changes.",
      inputSchema: {
        type: "object",
        properties: {
          forceRefresh: {
            type: "boolean",
            description: "Recompute even when a cached answer exists",
          },
        },
        required: [],
      },
    },
    handler: async (args) => {
      const { distributions, cached } = await getDistributions(args.forceRefresh === true);
      return jsonResponse({ ...distributions, servedFromCache: cached });
    },
  },
  {
    definition: {
      name: "list-builds",
      description:
        "Report the client builds in config/builds.json: which one is active, where each build's " +
        "DB2, gametable, vmap, mmap and listfile data lives, whether those directories exist, and " +
        "which legacy path environment variables disagree with the active build.",
      inputSchema: {
        type: "object",
        properties: {},
        required: [],
      },
    },
    handler: async () => jsonResponse(getBuildInfo()),
  },
  {
    definition: {
      name: "list-opcodes",
      description: "List network opcodes for the active build, filtered by name pattern, direction or protocol family.",
      inputSchema: {
        type: "object",
        properties: {
          pattern: { type: "string", description: "Substring to match against opcode names" },
          direction: { type: "string", description: "CMSG, SMSG or MSG" },
          family: { type: "string", description: "Protocol family, e.g. '0x43'" },
          offset: { type: "number", description: "Pagination offset (default 0)" },
          limit: { type: "number", description: "Maximum results (default 100)" },
        },
        required: [],
      },
    },
    handler: async (args) => jsonResponse(await listOpcodes(args as Parameters<typeof listOpcodes>[0])),
  },
  {
    definition: {
      name: "diff-opcodes",
      description: "Compare two builds' opcode tables, reporting added, removed and moved opcodes.",
      inputSchema: {
        type: "object",
        properties: {
          fromBuild: { type: "string", description: "Baseline table id, e.g. '12.0.7.67808'" },
          toBuild: { type: "string", description: "Comparison table id, e.g. '12.1.0.69214'" },
        },
        required: ["fromBuild", "toBuild"],
      },
    },
    handler: async (args) =>
      jsonResponse(await diffOpcodes({ fromBuild: args.fromBuild as string, toBuild: args.toBuild as string })),
  },
];
