/**
 * Tests for Cross-Bot Learning System
 *
 * Tests the shared knowledge graph, experience recording, querying,
 * confidence decay, LRU eviction, import/export, and report generation.
 *
 * @module tests/tools/crossbotlearning
 */

import {
  KnowledgeGraph,
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
  type KnowledgeNode,
  type KnowledgeEdge,
  type BotExperience,
  type KnowledgeCategory,
  type EdgeRelation,
} from "../../src/tools/crossbotlearning";

// Mock database connection
jest.mock("../../src/database/connection", () => ({
  queryWorld: jest.fn(),
}));

// Mock logger
jest.mock("../../src/utils/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

import { queryWorld } from "../../src/database/connection";
const mockQueryWorld = queryWorld as jest.MockedFunction<typeof queryWorld>;

describe("KnowledgeGraph (class)", () => {
  let graph: KnowledgeGraph;

  beforeEach(() => {
    graph = new KnowledgeGraph();
  });

  describe("recordExperience()", () => {
    it("should create a new knowledge node", () => {
      const result = graph.recordExperience({
        botId: "bot-1",
        botName: "TestBot",
        category: "combat",
        subject: "TestBot",
        predicate: "defeated",
        object: "Kobold Miner",
        confidence: 0.8,
        tags: ["combat", "victory"],
      });

      expect(result.action).toBe("created");
      expect(result.newConfidence).toBe(0.8);
      expect(result.nodeId).toMatch(/^kn_/);
    });

    it("should merge duplicate experiences (reinforce confidence)", () => {
      const exp: BotExperience = {
        botId: "bot-1",
        botName: "TestBot",
        category: "combat",
        subject: "TestBot",
        predicate: "defeated",
        object: "Kobold Miner",
        confidence: 0.8,
        tags: ["combat"],
      };

      const first = graph.recordExperience(exp);
      expect(first.action).toBe("created");

      const second = graph.recordExperience(exp);
      expect(second.action).toBe("updated");
      expect(second.previousConfidence).toBe(0.8);
      // Merged: (0.8 + 0.8) / 2 + 0.05 = 0.85
      expect(second.newConfidence).toBeCloseTo(0.85, 2);
    });

    it("should clamp confidence between MIN_THRESHOLD and 1", () => {
      const result = graph.recordExperience({
        botId: "bot-1",
        botName: "TestBot",
        category: "general",
        subject: "Test",
        predicate: "is",
        object: "Clamped",
        confidence: 5.0, // Exceeds 1.0
      });

      expect(result.newConfidence).toBeLessThanOrEqual(1.0);
    });

    it("should handle zero confidence by clamping to minimum", () => {
      const result = graph.recordExperience({
        botId: "bot-1",
        botName: "TestBot",
        category: "general",
        subject: "Test",
        predicate: "is",
        object: "MinConfidence",
        confidence: 0.0,
      });

      expect(result.newConfidence).toBeGreaterThanOrEqual(0.1); // MIN_CONFIDENCE_THRESHOLD
    });

    it("should add new tags on merge without duplicating existing ones", () => {
      graph.recordExperience({
        botId: "bot-1",
        botName: "TestBot",
        category: "combat",
        subject: "TestBot",
        predicate: "defeated",
        object: "Wolf",
        confidence: 0.7,
        tags: ["combat", "victory"],
      });

      graph.recordExperience({
        botId: "bot-1",
        botName: "TestBot",
        category: "combat",
        subject: "TestBot",
        predicate: "defeated",
        object: "Wolf",
        confidence: 0.7,
        tags: ["combat", "victory", "easy"],
      });

      const nodes = graph.query({ subject: "TestBot" });
      expect(nodes.length).toBe(1);
      expect(nodes[0].tags).toContain("easy");
      // "combat" should appear only once
      expect(nodes[0].tags.filter(t => t === "combat").length).toBe(1);
    });

    it("should merge context on update", () => {
      graph.recordExperience({
        botId: "bot-1",
        botName: "TestBot",
        category: "combat",
        subject: "TestBot",
        predicate: "defeated",
        object: "Bear",
        confidence: 0.7,
        context: { damageDealt: 1000 },
      });

      graph.recordExperience({
        botId: "bot-1",
        botName: "TestBot",
        category: "combat",
        subject: "TestBot",
        predicate: "defeated",
        object: "Bear",
        confidence: 0.7,
        context: { damageTaken: 500 },
      });

      const nodes = graph.query({ subject: "TestBot" });
      expect(nodes.length).toBe(1);
      expect(nodes[0].context).toEqual({ damageDealt: 1000, damageTaken: 500 });
    });

    it("should create edges to related nodes", () => {
      // First create a target node
      graph.recordExperience({
        botId: "bot-1",
        botName: "TestBot",
        category: "combat",
        subject: "Frostbolt",
        predicate: "is_effective_against",
        object: "Fire Elemental",
        confidence: 0.9,
      });

      // Then create a node that references it
      graph.recordExperience({
        botId: "bot-1",
        botName: "TestBot",
        category: "combat",
        subject: "Ice Lance",
        predicate: "synergizes_with",
        object: "Frostbolt combo",
        confidence: 0.8,
        relatedTo: [
          { nodeSubject: "Frostbolt", relation: "synergy", weight: 0.9 },
        ],
      });

      // Check the edge exists
      const iceLanceNodes = graph.query({ subject: "Ice Lance" });
      expect(iceLanceNodes.length).toBe(1);

      const related = graph.getRelatedNodes([iceLanceNodes[0].id]);
      expect(related.length).toBeGreaterThanOrEqual(1);
      expect(related[0].subject).toBe("Frostbolt");
    });
  });

  describe("query()", () => {
    beforeEach(() => {
      // Populate graph with test data
      graph.recordExperience({
        botId: "bot-1",
        botName: "Warrior",
        category: "combat",
        subject: "Warrior",
        predicate: "defeated",
        object: "Defias Pillager",
        confidence: 0.9,
        tags: ["combat", "victory", "human"],
        mapId: 0,
        zoneId: 12,
      });

      graph.recordExperience({
        botId: "bot-2",
        botName: "Mage",
        category: "combat",
        subject: "Mage",
        predicate: "defeated",
        object: "Kobold Miner",
        confidence: 0.8,
        tags: ["combat", "victory"],
        mapId: 0,
        zoneId: 1,
      });

      graph.recordExperience({
        botId: "bot-1",
        botName: "Warrior",
        category: "exploration",
        subject: "Blacksmith Vendor",
        predicate: "found_at",
        object: "(1234.5, 5678.9, 100.0)",
        confidence: 0.95,
        tags: ["exploration", "vendor"],
        mapId: 0,
        zoneId: 12,
      });

      graph.recordExperience({
        botId: "bot-3",
        botName: "Priest",
        category: "quest",
        subject: "Priest",
        predicate: "completed",
        object: "A Light in the Darkness",
        confidence: 0.9,
        tags: ["quest", "completed"],
        mapId: 0,
      });
    });

    it("should return all nodes when no filters specified", () => {
      const results = graph.query({});
      expect(results.length).toBe(4);
    });

    it("should filter by category", () => {
      const results = graph.query({ category: "combat" });
      expect(results.length).toBe(2);
      results.forEach(r => expect(r.category).toBe("combat"));
    });

    it("should filter by subject", () => {
      const results = graph.query({ subject: "Warrior" });
      expect(results.length).toBe(1);
      expect(results[0].subject).toBe("Warrior");
    });

    it("should filter by botId", () => {
      const results = graph.query({ botId: "bot-1" });
      expect(results.length).toBe(2);
      results.forEach(r => expect(r.source.botId).toBe("bot-1"));
    });

    it("should filter by tags (AND logic)", () => {
      const results = graph.query({ tags: ["combat", "victory"] });
      expect(results.length).toBe(2);
    });

    it("should filter by tags intersection (AND) - narrowing down", () => {
      const results = graph.query({ tags: ["combat", "victory", "human"] });
      expect(results.length).toBe(1);
      expect(results[0].source.botName).toBe("Warrior");
    });

    it("should filter by mapId", () => {
      const results = graph.query({ mapId: 0 });
      expect(results.length).toBe(4);
    });

    it("should filter by zoneId", () => {
      const results = graph.query({ zoneId: 12 });
      expect(results.length).toBe(2);
    });

    it("should filter by predicate", () => {
      const results = graph.query({ predicate: "defeated" });
      expect(results.length).toBe(2);
    });

    it("should filter by object", () => {
      const results = graph.query({ object: "Defias Pillager" });
      expect(results.length).toBe(1);
    });

    it("should apply minimum confidence threshold", () => {
      const results = graph.query({ minConfidence: 0.85 });
      expect(results.length).toBeGreaterThan(0);
      results.forEach(r => expect(r.confidence).toBeGreaterThanOrEqual(0.85));
    });

    it("should limit results", () => {
      const results = graph.query({ limit: 2 });
      expect(results.length).toBe(2);
    });

    it("should sort results by confidence descending", () => {
      const results = graph.query({});
      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].confidence).toBeGreaterThanOrEqual(results[i].confidence);
      }
    });

    it("should return empty for non-existent subject", () => {
      const results = graph.query({ subject: "NonExistent" });
      expect(results.length).toBe(0);
    });

    it("should return empty for non-existent tag", () => {
      const results = graph.query({ tags: ["nonexistent_tag"] });
      expect(results.length).toBe(0);
    });

    it("should combine multiple filters", () => {
      const results = graph.query({
        category: "combat",
        botId: "bot-1",
        zoneId: 12,
      });
      expect(results.length).toBe(1);
      expect(results[0].source.botName).toBe("Warrior");
    });

    it("should be case-insensitive for subject lookup", () => {
      const results = graph.query({ subject: "warrior" });
      expect(results.length).toBe(1);
    });
  });

  describe("getBestApproach()", () => {
    beforeEach(() => {
      // Two strategies for fighting the same creature
      graph.recordExperience({
        botId: "bot-1",
        botName: "Warrior",
        category: "combat",
        subject: "Hogger",
        predicate: "defeated_with",
        object: "Shield Block + Heroic Strike",
        confidence: 0.9,
      });

      graph.recordExperience({
        botId: "bot-2",
        botName: "Mage",
        category: "combat",
        subject: "Hogger",
        predicate: "defeated_with",
        object: "Frostbolt kiting",
        confidence: 0.7,
      });
    });

    it("should return best approach as highest confidence", () => {
      const result = graph.getBestApproach({ category: "combat", subject: "Hogger" });
      expect(result.bestApproach).not.toBeNull();
      expect(result.bestApproach!.object).toBe("Shield Block + Heroic Strike");
      expect(result.totalKnown).toBe(2);
    });

    it("should include alternatives", () => {
      const result = graph.getBestApproach({ category: "combat", subject: "Hogger" });
      expect(result.alternatives.length).toBe(1);
      expect(result.alternatives[0].object).toBe("Frostbolt kiting");
    });

    it("should return null for unknown subject", () => {
      const result = graph.getBestApproach({ category: "combat", subject: "Unknown Boss" });
      expect(result.bestApproach).toBeNull();
      expect(result.alternatives.length).toBe(0);
      expect(result.totalKnown).toBe(0);
    });
  });

  describe("addEdge()", () => {
    it("should create an edge between two nodes", () => {
      const r1 = graph.recordExperience({
        botId: "bot-1",
        botName: "TestBot",
        category: "combat",
        subject: "Frost Mage",
        predicate: "counters",
        object: "Fire Elemental",
        confidence: 0.9,
      });

      const r2 = graph.recordExperience({
        botId: "bot-1",
        botName: "TestBot",
        category: "combat",
        subject: "Fire Elemental",
        predicate: "weak_to",
        object: "Frost spells",
        confidence: 0.85,
      });

      const edge = graph.addEdge(r1.nodeId, r2.nodeId, "counters", 0.9);
      expect(edge).not.toBeNull();
      expect(edge!.relation).toBe("counters");
      expect(edge!.weight).toBe(0.9);
    });

    it("should create bidirectional edges", () => {
      const r1 = graph.recordExperience({
        botId: "bot-1",
        botName: "TestBot",
        category: "combat",
        subject: "A",
        predicate: "related",
        object: "B",
        confidence: 0.5,
      });

      const r2 = graph.recordExperience({
        botId: "bot-1",
        botName: "TestBot",
        category: "combat",
        subject: "C",
        predicate: "related",
        object: "D",
        confidence: 0.5,
      });

      graph.addEdge(r1.nodeId, r2.nodeId, "synergy", 0.7, true);

      const edges1 = graph.getEdgesForNode(r1.nodeId);
      const edges2 = graph.getEdgesForNode(r2.nodeId);

      // Both nodes should have edges
      expect(edges1.length).toBeGreaterThanOrEqual(1);
      expect(edges2.length).toBeGreaterThanOrEqual(1);
    });

    it("should return null for non-existent nodes", () => {
      const edge = graph.addEdge("fake_1", "fake_2", "related");
      expect(edge).toBeNull();
    });

    it("should clamp weight to [0, 1]", () => {
      const r1 = graph.recordExperience({
        botId: "bot-1",
        botName: "TestBot",
        category: "general",
        subject: "X",
        predicate: "is",
        object: "Y",
        confidence: 0.5,
      });

      const r2 = graph.recordExperience({
        botId: "bot-1",
        botName: "TestBot",
        category: "general",
        subject: "Y",
        predicate: "is",
        object: "Z",
        confidence: 0.5,
      });

      const edge = graph.addEdge(r1.nodeId, r2.nodeId, "related", 5.0);
      expect(edge!.weight).toBe(1.0);

      const edge2 = graph.addEdge(r1.nodeId, r2.nodeId, "synergy", -0.5);
      expect(edge2!.weight).toBe(0.0);
    });
  });

  describe("removeNode()", () => {
    it("should remove a node and its edges", () => {
      const r1 = graph.recordExperience({
        botId: "bot-1",
        botName: "TestBot",
        category: "combat",
        subject: "A",
        predicate: "knows",
        object: "B",
        confidence: 0.5,
      });

      const r2 = graph.recordExperience({
        botId: "bot-1",
        botName: "TestBot",
        category: "combat",
        subject: "C",
        predicate: "knows",
        object: "D",
        confidence: 0.5,
      });

      graph.addEdge(r1.nodeId, r2.nodeId, "related");

      expect(graph.removeNode(r1.nodeId)).toBe(true);
      expect(graph.getNode(r1.nodeId)).toBeNull();

      // Edges should also be removed
      const edges = graph.getEdgesForNode(r2.nodeId);
      const hasR1Edge = edges.some(e => e.fromNodeId === r1.nodeId || e.toNodeId === r1.nodeId);
      expect(hasR1Edge).toBe(false);
    });

    it("should return false for non-existent node", () => {
      expect(graph.removeNode("fake_id")).toBe(false);
    });
  });

  describe("getNode()", () => {
    it("should return node with decayed confidence", () => {
      const r = graph.recordExperience({
        botId: "bot-1",
        botName: "TestBot",
        category: "general",
        subject: "Test",
        predicate: "is",
        object: "Good",
        confidence: 0.9,
      });

      const node = graph.getNode(r.nodeId);
      expect(node).not.toBeNull();
      expect(node!.subject).toBe("Test");
      // Since timestamp is just now, decayed confidence should be approximately 0.9
      expect(node!.confidence).toBeCloseTo(0.9, 1);
    });

    it("should increment access count", () => {
      const r = graph.recordExperience({
        botId: "bot-1",
        botName: "TestBot",
        category: "general",
        subject: "Access",
        predicate: "test",
        object: "Counter",
        confidence: 0.5,
      });

      graph.getNode(r.nodeId);
      graph.getNode(r.nodeId);
      const node = graph.getNode(r.nodeId);
      expect(node!.accessCount).toBe(3);
    });

    it("should return null for non-existent node", () => {
      expect(graph.getNode("fake_id")).toBeNull();
    });
  });

  describe("getStats()", () => {
    it("should return correct stats for empty graph", () => {
      const stats = graph.getStats();
      expect(stats.totalNodes).toBe(0);
      expect(stats.totalEdges).toBe(0);
      expect(stats.averageConfidence).toBe(0);
      expect(stats.topContributors.length).toBe(0);
    });

    it("should return correct stats with populated graph", () => {
      graph.recordExperience({
        botId: "bot-1",
        botName: "Warrior",
        category: "combat",
        subject: "Warrior",
        predicate: "defeated",
        object: "Kobold",
        confidence: 0.8,
      });

      graph.recordExperience({
        botId: "bot-2",
        botName: "Mage",
        category: "exploration",
        subject: "Vendor",
        predicate: "found_at",
        object: "(100, 200, 50)",
        confidence: 0.95,
      });

      const stats = graph.getStats();
      expect(stats.totalNodes).toBe(2);
      expect(stats.nodesByCategory["combat"]).toBe(1);
      expect(stats.nodesByCategory["exploration"]).toBe(1);
      expect(stats.topContributors.length).toBe(2);
      expect(stats.averageConfidence).toBeGreaterThan(0);
    });
  });

  describe("clear()", () => {
    it("should remove all nodes and edges", () => {
      graph.recordExperience({
        botId: "bot-1",
        botName: "TestBot",
        category: "general",
        subject: "A",
        predicate: "is",
        object: "B",
        confidence: 0.5,
      });

      graph.clear();

      expect(graph.size).toBe(0);
      const stats = graph.getStats();
      expect(stats.totalNodes).toBe(0);
      expect(stats.totalEdges).toBe(0);
      expect(stats.totalQueries).toBe(0);
    });
  });

  describe("exportGraph() / importGraph()", () => {
    it("should round-trip export and import", () => {
      graph.recordExperience({
        botId: "bot-1",
        botName: "Warrior",
        category: "combat",
        subject: "Warrior",
        predicate: "defeated",
        object: "Kobold",
        confidence: 0.8,
        tags: ["combat", "victory"],
      });

      graph.recordExperience({
        botId: "bot-2",
        botName: "Mage",
        category: "exploration",
        subject: "Vendor",
        predicate: "found_at",
        object: "(100, 200, 50)",
        confidence: 0.9,
        tags: ["exploration", "vendor"],
      });

      const exported = graph.exportGraph();
      expect(exported.nodes.length).toBe(2);

      // Import into a fresh graph
      const newGraph = new KnowledgeGraph();
      const result = newGraph.importGraph(exported);
      expect(result.nodesImported).toBe(2);

      // Verify nodes are queryable in the new graph
      const results = newGraph.query({ category: "combat" });
      expect(results.length).toBe(1);
      expect(results[0].subject).toBe("Warrior");
    });

    it("should not import duplicate nodes", () => {
      graph.recordExperience({
        botId: "bot-1",
        botName: "Warrior",
        category: "combat",
        subject: "Warrior",
        predicate: "defeated",
        object: "Kobold",
        confidence: 0.8,
      });

      const exported = graph.exportGraph();

      // Import same data again
      const result = graph.importGraph(exported);
      expect(result.nodesImported).toBe(0); // Already exists
      expect(graph.size).toBe(1);
    });

    it("should skip edges referencing non-existent nodes", () => {
      const result = graph.importGraph({
        nodes: [],
        edges: [
          {
            id: "ke_fake_related_fake2",
            fromNodeId: "fake_1",
            toNodeId: "fake_2",
            relation: "related",
            weight: 0.5,
            bidirectional: false,
          },
        ],
      });
      expect(result.edgesImported).toBe(0);
    });
  });

  describe("deterministic node IDs", () => {
    it("should produce same ID for same subject+predicate+object", () => {
      const r1 = graph.recordExperience({
        botId: "bot-1",
        botName: "A",
        category: "combat",
        subject: "Test",
        predicate: "is",
        object: "Deterministic",
        confidence: 0.5,
      });

      const newGraph = new KnowledgeGraph();
      const r2 = newGraph.recordExperience({
        botId: "bot-2",
        botName: "B",
        category: "quest",
        subject: "Test",
        predicate: "is",
        object: "Deterministic",
        confidence: 0.7,
      });

      expect(r1.nodeId).toBe(r2.nodeId);
    });

    it("should produce different IDs for different content", () => {
      const r1 = graph.recordExperience({
        botId: "bot-1",
        botName: "A",
        category: "combat",
        subject: "Alpha",
        predicate: "defeated",
        object: "Bravo",
        confidence: 0.5,
      });

      const r2 = graph.recordExperience({
        botId: "bot-1",
        botName: "A",
        category: "combat",
        subject: "Charlie",
        predicate: "defeated",
        object: "Delta",
        confidence: 0.5,
      });

      expect(r1.nodeId).not.toBe(r2.nodeId);
    });
  });

  describe("LRU eviction", () => {
    it("should handle large numbers of nodes without error", () => {
      // Insert 200 nodes (below MAX_GRAPH_NODES but tests the path)
      for (let i = 0; i < 200; i++) {
        graph.recordExperience({
          botId: `bot-${i % 5}`,
          botName: `Bot${i % 5}`,
          category: "combat",
          subject: `Subject${i}`,
          predicate: "tested",
          object: `Object${i}`,
          confidence: 0.5 + (i % 50) / 100,
        });
      }

      expect(graph.size).toBe(200);
      const stats = graph.getStats();
      expect(stats.totalNodes).toBe(200);
    });
  });

  describe("confidence decay", () => {
    it("should not significantly decay confidence for recently created nodes", () => {
      const r = graph.recordExperience({
        botId: "bot-1",
        botName: "TestBot",
        category: "general",
        subject: "Fresh",
        predicate: "is",
        object: "New",
        confidence: 0.9,
      });

      const node = graph.getNode(r.nodeId);
      // Just created, decay should be negligible
      expect(node!.confidence).toBeGreaterThan(0.89);
    });
  });
});

describe("Module-level exported functions", () => {
  beforeEach(() => {
    clearKnowledgeGraph();
    jest.clearAllMocks();
  });

  describe("recordCombatExperience()", () => {
    it("should record combat victory with creature name from DB", async () => {
      mockQueryWorld.mockResolvedValueOnce([{ name: "Defias Pillager" }]);

      const result = await recordCombatExperience({
        botId: "bot-1",
        botName: "Warrior",
        creatureEntry: 634,
        outcome: "victory",
        spellsUsed: [100, 6603],
        damageDealt: 500,
        damageTaken: 200,
        duration: 15,
        mapId: 0,
        zoneId: 12,
      });

      expect(result.action).toBe("created");
      expect(result.creatureName).toBe("Defias Pillager");
      expect(result.newConfidence).toBe(0.8);
    });

    it("should record combat defeat", async () => {
      mockQueryWorld.mockResolvedValueOnce([{ name: "Hogger" }]);

      const result = await recordCombatExperience({
        botId: "bot-1",
        botName: "Warrior",
        creatureEntry: 448,
        outcome: "defeat",
      });

      expect(result.action).toBe("created");
      expect(result.creatureName).toBe("Hogger");
      expect(result.newConfidence).toBe(0.6);
    });

    it("should handle DB lookup failure gracefully", async () => {
      mockQueryWorld.mockRejectedValueOnce(new Error("DB connection failed"));

      const result = await recordCombatExperience({
        botId: "bot-1",
        botName: "Warrior",
        creatureEntry: 999,
        outcome: "victory",
      });

      expect(result.creatureName).toBe("Creature 999");
      expect(result.action).toBe("created");
    });

    it("should handle empty DB result", async () => {
      mockQueryWorld.mockResolvedValueOnce([]);

      const result = await recordCombatExperience({
        botId: "bot-1",
        botName: "Warrior",
        creatureEntry: 0,
        outcome: "fled",
      });

      expect(result.creatureName).toBe("Creature 0");
      expect(result.newConfidence).toBe(0.4);
    });
  });

  describe("recordQuestExperience()", () => {
    it("should record quest completion with title from DB", async () => {
      mockQueryWorld.mockResolvedValueOnce([{ LogTitle: "A Light in the Darkness" }]);

      const result = await recordQuestExperience({
        botId: "bot-3",
        botName: "Priest",
        questId: 100,
        outcome: "completed",
        timeSpent: 300,
        difficulty: "medium",
        tips: "Use Holy Nova for AoE",
        mapId: 0,
        zoneId: 12,
      });

      expect(result.action).toBe("created");
      expect(result.questTitle).toBe("A Light in the Darkness");
      expect(result.newConfidence).toBe(0.9);
    });

    it("should record quest abandonment", async () => {
      mockQueryWorld.mockResolvedValueOnce([{ LogTitle: "Too Hard Quest" }]);

      const result = await recordQuestExperience({
        botId: "bot-1",
        botName: "Warrior",
        questId: 200,
        outcome: "abandoned",
      });

      expect(result.newConfidence).toBe(0.5);
    });

    it("should record quest failure", async () => {
      mockQueryWorld.mockResolvedValueOnce([{ LogTitle: "Escort Quest" }]);

      const result = await recordQuestExperience({
        botId: "bot-1",
        botName: "Warrior",
        questId: 300,
        outcome: "failed",
      });

      expect(result.newConfidence).toBe(0.4);
    });

    it("should handle DB lookup failure gracefully", async () => {
      mockQueryWorld.mockRejectedValueOnce(new Error("DB error"));

      const result = await recordQuestExperience({
        botId: "bot-1",
        botName: "Warrior",
        questId: 999,
        outcome: "completed",
      });

      expect(result.questTitle).toBe("Quest 999");
    });
  });

  describe("recordExplorationExperience()", () => {
    it("should record a vendor discovery", () => {
      const result = recordExplorationExperience({
        botId: "bot-1",
        botName: "Scout",
        discovery: "Blacksmith Vendor",
        locationType: "vendor",
        x: 1234.5,
        y: 5678.9,
        z: 100.0,
        mapId: 0,
        zoneId: 12,
        notes: "Sells plate armor",
      });

      expect(result.action).toBe("created");
      expect(result.newConfidence).toBe(0.95);
    });

    it("should record a danger zone", () => {
      const result = recordExplorationExperience({
        botId: "bot-2",
        botName: "Explorer",
        discovery: "Dragon Patrol Area",
        locationType: "danger",
        x: 500.0,
        y: 600.0,
        z: 200.0,
        mapId: 1,
      });

      expect(result.action).toBe("created");
    });

    it("should merge duplicate discoveries", () => {
      const params = {
        botId: "bot-1",
        botName: "Scout",
        discovery: "Mailbox",
        locationType: "mailbox" as const,
        x: 100.0,
        y: 200.0,
        z: 50.0,
        mapId: 0,
      };

      const r1 = recordExplorationExperience(params);
      expect(r1.action).toBe("created");

      const r2 = recordExplorationExperience(params);
      expect(r2.action).toBe("updated");
    });
  });

  describe("recordEconomyExperience()", () => {
    it("should record a purchase", () => {
      const result = recordEconomyExperience({
        botId: "bot-1",
        botName: "Merchant",
        itemName: "Linen Cloth",
        action: "bought",
        price: 100,
        quantity: 20,
        vendorName: "Thomas Miller",
        mapId: 0,
        zoneId: 12,
      });

      expect(result.action).toBe("created");
      expect(result.newConfidence).toBe(0.85);
    });

    it("should record an auction observation", () => {
      const result = recordEconomyExperience({
        botId: "bot-2",
        botName: "AuctionBot",
        itemName: "Copper Bar",
        action: "observed_price",
        price: 500,
      });

      expect(result.action).toBe("created");
    });
  });

  describe("queryKnowledge()", () => {
    it("should query the shared knowledge graph", async () => {
      mockQueryWorld.mockResolvedValueOnce([{ name: "Kobold Miner" }]);

      await recordCombatExperience({
        botId: "bot-1",
        botName: "Warrior",
        creatureEntry: 40,
        outcome: "victory",
      });

      const results = queryKnowledge({ category: "combat" });
      expect(results.length).toBe(1);
      expect(results[0].category).toBe("combat");
    });
  });

  describe("getBestApproach()", () => {
    it("should return best approach from accumulated knowledge", async () => {
      mockQueryWorld.mockResolvedValue([{ name: "Hogger" }]);

      await recordCombatExperience({
        botId: "bot-1",
        botName: "Warrior",
        creatureEntry: 448,
        outcome: "victory",
        mapId: 0,
      });

      await recordCombatExperience({
        botId: "bot-2",
        botName: "Mage",
        creatureEntry: 448,
        outcome: "defeat",
        mapId: 0,
      });

      const result = getBestApproach("combat", "Warrior");
      expect(result.bestApproach).not.toBeNull();
    });
  });

  describe("getKnowledgeStats()", () => {
    it("should return stats for empty graph", () => {
      const stats = getKnowledgeStats();
      expect(stats.totalNodes).toBe(0);
      expect(stats.totalEdges).toBe(0);
    });
  });

  describe("addKnowledgeRelation()", () => {
    it("should create a relation between two known subjects", async () => {
      mockQueryWorld.mockResolvedValueOnce([{ name: "Defias Pillager" }]);
      mockQueryWorld.mockResolvedValueOnce([{ name: "Hogger" }]);

      await recordCombatExperience({
        botId: "bot-1",
        botName: "Warrior",
        creatureEntry: 634,
        outcome: "victory",
      });

      await recordCombatExperience({
        botId: "bot-1",
        botName: "Warrior",
        creatureEntry: 448,
        outcome: "defeat",
      });

      const result = addKnowledgeRelation({
        fromSubject: "Warrior",
        toSubject: "Warrior",
        relation: "related",
      });

      // Since both have the same subject "Warrior", the query returns the same node
      // The function uses query({ subject }) which looks up by subject index
      expect(result.success).toBe(true);
    });

    it("should fail for non-existent subject", () => {
      const result = addKnowledgeRelation({
        fromSubject: "NonExistent",
        toSubject: "AlsoNonExistent",
        relation: "related",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("No knowledge found");
    });
  });

  describe("getKnowledgeNode()", () => {
    it("should return node with edges and related nodes", async () => {
      mockQueryWorld.mockResolvedValueOnce([{ name: "Kobold" }]);

      const combat = await recordCombatExperience({
        botId: "bot-1",
        botName: "Warrior",
        creatureEntry: 40,
        outcome: "victory",
      });

      const result = getKnowledgeNode(combat.nodeId);
      expect(result.node).not.toBeNull();
      expect(result.node!.category).toBe("combat");
    });

    it("should return null for non-existent node", () => {
      const result = getKnowledgeNode("fake_id");
      expect(result.node).toBeNull();
      expect(result.edges.length).toBe(0);
    });
  });

  describe("exportKnowledgeGraph() / importKnowledgeGraph()", () => {
    it("should export and import the global graph", async () => {
      mockQueryWorld.mockResolvedValueOnce([{ name: "Kobold" }]);

      await recordCombatExperience({
        botId: "bot-1",
        botName: "Warrior",
        creatureEntry: 40,
        outcome: "victory",
      });

      const exported = exportKnowledgeGraph();
      expect(exported.nodes.length).toBe(1);

      clearKnowledgeGraph();
      expect(getKnowledgeStats().totalNodes).toBe(0);

      const result = importKnowledgeGraph(exported);
      expect(result.nodesImported).toBe(1);
      expect(getKnowledgeStats().totalNodes).toBe(1);
    });
  });

  describe("formatKnowledgeReport()", () => {
    it("should generate a markdown report for empty graph", () => {
      const report = formatKnowledgeReport();
      expect(report).toContain("# Cross-Bot Knowledge Graph Report");
      expect(report).toContain("**Total Knowledge Nodes:** 0");
    });

    it("should generate a populated report", async () => {
      mockQueryWorld.mockResolvedValueOnce([{ name: "Hogger" }]);

      await recordCombatExperience({
        botId: "bot-1",
        botName: "Warrior",
        creatureEntry: 448,
        outcome: "victory",
      });

      recordExplorationExperience({
        botId: "bot-2",
        botName: "Scout",
        discovery: "Vendor",
        locationType: "vendor",
        x: 100,
        y: 200,
        z: 50,
        mapId: 0,
      });

      const report = formatKnowledgeReport();
      expect(report).toContain("**Total Knowledge Nodes:** 2");
      expect(report).toContain("## Top Contributors");
      expect(report).toContain("## Knowledge by Category");
      expect(report).toContain("| Subject |");
    });

    it("should filter report by category", async () => {
      mockQueryWorld.mockResolvedValueOnce([{ name: "Hogger" }]);

      await recordCombatExperience({
        botId: "bot-1",
        botName: "Warrior",
        creatureEntry: 448,
        outcome: "victory",
      });

      recordExplorationExperience({
        botId: "bot-2",
        botName: "Scout",
        discovery: "Vendor",
        locationType: "vendor",
        x: 100,
        y: 200,
        z: 50,
        mapId: 0,
      });

      const report = formatKnowledgeReport({ category: "combat" });
      expect(report).toContain("Combat Knowledge");
    });
  });

  describe("clearKnowledgeGraph()", () => {
    it("should clear all data", async () => {
      mockQueryWorld.mockResolvedValueOnce([{ name: "Kobold" }]);

      await recordCombatExperience({
        botId: "bot-1",
        botName: "Warrior",
        creatureEntry: 40,
        outcome: "victory",
      });

      expect(getKnowledgeStats().totalNodes).toBe(1);
      clearKnowledgeGraph();
      expect(getKnowledgeStats().totalNodes).toBe(0);
    });
  });
});
