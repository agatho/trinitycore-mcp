/**
 * Learning Systems Tools Registry
 *
 * Cross-Bot Learning System for shared knowledge graphs, experience recording,
 * and collaborative intelligence between bots.
 *
 * @module tools/registry/learning-systems
 */

import { ToolRegistryEntry, jsonResponse, textResponse } from "./types";
import {
  recordCombatExperience,
  recordQuestExperience,
  recordExplorationExperience,
  recordEconomyExperience,
  queryKnowledge,
  getBestApproach,
  getKnowledgeStats,
  addKnowledgeRelation,
  getKnowledgeNode,
  exportKnowledgeGraph,
  importKnowledgeGraph,
  clearKnowledgeGraph,
  formatKnowledgeReport,
  KnowledgeCategory,
  EdgeRelation,
} from "../crossbotlearning";

export const learningSystemsTools: ToolRegistryEntry[] = [
  // ─── Experience Recording ──────────────────────────────────────────────
  {
    definition: {
      name: "record-combat-experience",
      description:
        "Record a bot's combat encounter in the shared knowledge graph. " +
        "Enriches with creature data from the database. Other bots can later " +
        "query this knowledge to learn from shared combat experiences.",
      inputSchema: {
        type: "object",
        properties: {
          botId: { type: "string", description: "Unique bot identifier" },
          botName: { type: "string", description: "Bot display name" },
          creatureEntry: { type: "number", description: "Creature template entry ID" },
          outcome: {
            type: "string",
            enum: ["victory", "defeat", "fled"],
            description: "Combat outcome",
          },
          spellsUsed: {
            type: "array",
            items: { type: "number" },
            description: "Spell IDs used during combat",
          },
          damageDealt: { type: "number", description: "Total damage dealt" },
          damageTaken: { type: "number", description: "Total damage taken" },
          duration: { type: "number", description: "Combat duration in seconds" },
          mapId: { type: "number", description: "Map ID where combat occurred" },
          zoneId: { type: "number", description: "Zone ID where combat occurred" },
          notes: { type: "string", description: "Additional notes about the encounter" },
        },
        required: ["botId", "botName", "creatureEntry", "outcome"],
      },
    },
    handler: async (args) => {
      const result = await recordCombatExperience({
        botId: args.botId as string,
        botName: args.botName as string,
        creatureEntry: args.creatureEntry as number,
        outcome: args.outcome as "victory" | "defeat" | "fled",
        spellsUsed: args.spellsUsed as number[] | undefined,
        damageDealt: args.damageDealt as number | undefined,
        damageTaken: args.damageTaken as number | undefined,
        duration: args.duration as number | undefined,
        mapId: args.mapId as number | undefined,
        zoneId: args.zoneId as number | undefined,
        notes: args.notes as string | undefined,
      });
      return jsonResponse(result);
    },
  },
  {
    definition: {
      name: "record-quest-experience",
      description:
        "Record a bot's quest completion/failure in the shared knowledge graph. " +
        "Enriches with quest title from the database.",
      inputSchema: {
        type: "object",
        properties: {
          botId: { type: "string", description: "Unique bot identifier" },
          botName: { type: "string", description: "Bot display name" },
          questId: { type: "number", description: "Quest template ID" },
          outcome: {
            type: "string",
            enum: ["completed", "abandoned", "failed"],
            description: "Quest outcome",
          },
          timeSpent: { type: "number", description: "Time spent in seconds" },
          difficulty: {
            type: "string",
            enum: ["easy", "medium", "hard"],
            description: "Perceived difficulty",
          },
          tips: { type: "string", description: "Tips for completing this quest" },
          mapId: { type: "number", description: "Map ID" },
          zoneId: { type: "number", description: "Zone ID" },
        },
        required: ["botId", "botName", "questId", "outcome"],
      },
    },
    handler: async (args) => {
      const result = await recordQuestExperience({
        botId: args.botId as string,
        botName: args.botName as string,
        questId: args.questId as number,
        outcome: args.outcome as "completed" | "abandoned" | "failed",
        timeSpent: args.timeSpent as number | undefined,
        difficulty: args.difficulty as "easy" | "medium" | "hard" | undefined,
        tips: args.tips as string | undefined,
        mapId: args.mapId as number | undefined,
        zoneId: args.zoneId as number | undefined,
      });
      return jsonResponse(result);
    },
  },
  {
    definition: {
      name: "record-exploration-discovery",
      description:
        "Record a location discovery in the shared knowledge graph. " +
        "Bots share points of interest like vendors, trainers, flight paths, " +
        "rare spawns, and dangerous areas.",
      inputSchema: {
        type: "object",
        properties: {
          botId: { type: "string", description: "Unique bot identifier" },
          botName: { type: "string", description: "Bot display name" },
          discovery: { type: "string", description: "What was discovered (e.g., 'Blacksmith Vendor')" },
          locationType: {
            type: "string",
            enum: ["vendor", "trainer", "mailbox", "flightpath", "resource", "rare", "path", "danger", "other"],
            description: "Type of location discovered",
          },
          x: { type: "number", description: "X coordinate" },
          y: { type: "number", description: "Y coordinate" },
          z: { type: "number", description: "Z coordinate" },
          mapId: { type: "number", description: "Map ID" },
          zoneId: { type: "number", description: "Zone ID" },
          notes: { type: "string", description: "Additional notes" },
        },
        required: ["botId", "botName", "discovery", "locationType", "x", "y", "z", "mapId"],
      },
    },
    handler: async (args) => {
      const result = recordExplorationExperience({
        botId: args.botId as string,
        botName: args.botName as string,
        discovery: args.discovery as string,
        locationType: args.locationType as "vendor" | "trainer" | "mailbox" | "flightpath" | "resource" | "rare" | "path" | "danger" | "other",
        x: args.x as number,
        y: args.y as number,
        z: args.z as number,
        mapId: args.mapId as number,
        zoneId: args.zoneId as number | undefined,
        notes: args.notes as string | undefined,
      });
      return jsonResponse(result);
    },
  },
  {
    definition: {
      name: "record-economy-observation",
      description:
        "Record an economy observation (price, vendor, auction) in the " +
        "shared knowledge graph. Helps bots learn market prices and trade routes.",
      inputSchema: {
        type: "object",
        properties: {
          botId: { type: "string", description: "Unique bot identifier" },
          botName: { type: "string", description: "Bot display name" },
          itemName: { type: "string", description: "Item name" },
          action: {
            type: "string",
            enum: ["bought", "sold", "auctioned", "observed_price"],
            description: "Economic action type",
          },
          price: { type: "number", description: "Price in copper" },
          quantity: { type: "number", description: "Item quantity (default: 1)" },
          vendorName: { type: "string", description: "Vendor NPC name (if applicable)" },
          mapId: { type: "number", description: "Map ID" },
          zoneId: { type: "number", description: "Zone ID" },
        },
        required: ["botId", "botName", "itemName", "action", "price"],
      },
    },
    handler: async (args) => {
      const result = recordEconomyExperience({
        botId: args.botId as string,
        botName: args.botName as string,
        itemName: args.itemName as string,
        action: args.action as "bought" | "sold" | "auctioned" | "observed_price",
        price: args.price as number,
        quantity: args.quantity as number | undefined,
        vendorName: args.vendorName as string | undefined,
        mapId: args.mapId as number | undefined,
        zoneId: args.zoneId as number | undefined,
      });
      return jsonResponse(result);
    },
  },

  // ─── Knowledge Querying ────────────────────────────────────────────────
  {
    definition: {
      name: "query-knowledge-graph",
      description:
        "Search the shared knowledge graph for learned experiences. " +
        "Filter by category, subject, tags, bot, map, confidence threshold. " +
        "Returns matching knowledge nodes sorted by confidence.",
      inputSchema: {
        type: "object",
        properties: {
          category: {
            type: "string",
            enum: ["combat", "exploration", "social", "economy", "quest", "general"],
            description: "Knowledge category filter",
          },
          subject: { type: "string", description: "Subject to search for" },
          predicate: { type: "string", description: "Predicate filter (e.g., 'defeated', 'found_at')" },
          object: { type: "string", description: "Object filter" },
          tags: {
            type: "array",
            items: { type: "string" },
            description: "Tags to filter by (AND logic)",
          },
          botId: { type: "string", description: "Filter by contributing bot" },
          minConfidence: { type: "number", description: "Minimum confidence threshold (0-1)" },
          mapId: { type: "number", description: "Map ID filter" },
          zoneId: { type: "number", description: "Zone ID filter" },
          limit: { type: "number", description: "Maximum results (default: 50)" },
          includeRelated: { type: "boolean", description: "Include related nodes via edges" },
        },
      },
    },
    handler: async (args) => {
      const results = queryKnowledge({
        category: args.category as KnowledgeCategory | undefined,
        subject: args.subject as string | undefined,
        predicate: args.predicate as string | undefined,
        object: args.object as string | undefined,
        tags: args.tags as string[] | undefined,
        botId: args.botId as string | undefined,
        minConfidence: args.minConfidence as number | undefined,
        mapId: args.mapId as number | undefined,
        zoneId: args.zoneId as number | undefined,
        limit: args.limit as number | undefined,
        includeRelated: args.includeRelated as boolean | undefined,
      });
      return jsonResponse({
        count: results.length,
        results,
      });
    },
  },
  {
    definition: {
      name: "get-best-approach",
      description:
        "Get the best known approach for a specific situation based on " +
        "accumulated bot knowledge. Returns the highest-confidence knowledge " +
        "plus alternatives. Use for combat tactics, quest strategies, etc.",
      inputSchema: {
        type: "object",
        properties: {
          category: {
            type: "string",
            enum: ["combat", "exploration", "social", "economy", "quest", "general"],
            description: "Knowledge category",
          },
          subject: { type: "string", description: "Subject to look up (e.g., creature name, quest name)" },
          minConfidence: { type: "number", description: "Minimum confidence threshold (default: 0.3)" },
        },
        required: ["category", "subject"],
      },
    },
    handler: async (args) => {
      const result = getBestApproach(
        args.category as KnowledgeCategory,
        args.subject as string,
        args.minConfidence as number | undefined
      );
      return jsonResponse(result);
    },
  },

  // ─── Graph Management ──────────────────────────────────────────────────
  {
    definition: {
      name: "get-knowledge-stats",
      description:
        "Get comprehensive statistics about the shared knowledge graph " +
        "including total nodes, edges, categories, top contributors, and query metrics.",
      inputSchema: {
        type: "object",
        properties: {},
      },
    },
    handler: async () => {
      const stats = getKnowledgeStats();
      return jsonResponse(stats);
    },
  },
  {
    definition: {
      name: "add-knowledge-relation",
      description:
        "Create a relationship (edge) between two knowledge subjects in the graph. " +
        "Types: counters, weakness, requires, alternative, synergy, location, " +
        "drops, sells, teaches, part_of, related.",
      inputSchema: {
        type: "object",
        properties: {
          fromSubject: { type: "string", description: "Source knowledge subject" },
          toSubject: { type: "string", description: "Target knowledge subject" },
          relation: {
            type: "string",
            enum: [
              "counters", "weakness", "requires", "alternative", "synergy",
              "location", "drops", "sells", "teaches", "part_of", "related",
            ],
            description: "Relationship type",
          },
          weight: { type: "number", description: "Relationship strength (0-1, default: 0.5)" },
          bidirectional: { type: "boolean", description: "Create reverse edge too (default: false)" },
        },
        required: ["fromSubject", "toSubject", "relation"],
      },
    },
    handler: async (args) => {
      const result = addKnowledgeRelation({
        fromSubject: args.fromSubject as string,
        toSubject: args.toSubject as string,
        relation: args.relation as EdgeRelation,
        weight: args.weight as number | undefined,
        bidirectional: args.bidirectional as boolean | undefined,
      });
      return jsonResponse(result);
    },
  },
  {
    definition: {
      name: "get-knowledge-node",
      description:
        "Get a specific knowledge node by ID, including its relationships " +
        "and connected nodes.",
      inputSchema: {
        type: "object",
        properties: {
          nodeId: { type: "string", description: "Knowledge node ID" },
        },
        required: ["nodeId"],
      },
    },
    handler: async (args) => {
      const result = getKnowledgeNode(args.nodeId as string);
      return jsonResponse(result);
    },
  },
  {
    definition: {
      name: "export-knowledge-graph",
      description:
        "Export the entire knowledge graph as JSON for backup or sharing between servers.",
      inputSchema: {
        type: "object",
        properties: {},
      },
    },
    handler: async () => {
      const data = exportKnowledgeGraph();
      return jsonResponse({
        exportedAt: new Date().toISOString(),
        nodeCount: data.nodes.length,
        edgeCount: data.edges.length,
        ...data,
      });
    },
  },
  {
    definition: {
      name: "import-knowledge-graph",
      description:
        "Import knowledge from a previously exported graph. " +
        "Merges with existing knowledge (does not overwrite duplicates).",
      inputSchema: {
        type: "object",
        properties: {
          nodes: {
            type: "array",
            items: { type: "object" },
            description: "Array of knowledge nodes to import",
          },
          edges: {
            type: "array",
            items: { type: "object" },
            description: "Array of knowledge edges to import",
          },
        },
        required: ["nodes", "edges"],
      },
    },
    handler: async (args) => {
      const result = importKnowledgeGraph({
        nodes: args.nodes as any[],
        edges: args.edges as any[],
      });
      return jsonResponse(result);
    },
  },
  {
    definition: {
      name: "get-knowledge-report",
      description:
        "Generate a formatted markdown report of the knowledge graph contents, " +
        "statistics, and top entries.",
      inputSchema: {
        type: "object",
        properties: {
          category: {
            type: "string",
            enum: ["combat", "exploration", "social", "economy", "quest", "general"],
            description: "Filter report to a specific category",
          },
          limit: { type: "number", description: "Maximum entries in report (default: 30)" },
        },
      },
    },
    handler: async (args) => {
      const report = formatKnowledgeReport({
        category: args.category as KnowledgeCategory | undefined,
        limit: args.limit as number | undefined,
      });
      return textResponse(report);
    },
  },
];
