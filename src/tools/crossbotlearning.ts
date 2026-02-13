/**
 * Cross-Bot Learning System
 *
 * Enables bots to share learned knowledge through an in-memory graph-based
 * knowledge store with optional database persistence. Bots record experiences
 * from combat, exploration, quests, and economy—then other bots can query the
 * graph for the best known approaches.
 *
 * Knowledge Graph Structure:
 *   - Nodes represent facts/experiences (e.g. "Fireball effective against Defias Pillager")
 *   - Edges represent relationships (e.g. "counters", "prerequisite", "alternative")
 *   - Each node has a confidence score (0-1) that decays over time
 *   - Nodes are attributed to the bot that recorded them
 *
 * @module tools/crossbotlearning
 */

import { queryWorld } from "../database/connection";
import { logger } from "../utils/logger";

// ─── Types ────────────────────────────────────────────────────────────────────

/** Knowledge categories */
export type KnowledgeCategory = "combat" | "exploration" | "social" | "economy" | "quest" | "general";

/** Relationship types between knowledge nodes */
export type EdgeRelation =
  | "counters"        // A counters B (combat)
  | "weakness"        // A is weak to B (combat)
  | "requires"        // A requires B (prerequisite)
  | "alternative"     // A is alternative to B
  | "synergy"         // A synergizes with B
  | "location"        // A is located at B
  | "drops"           // A drops B (loot)
  | "sells"           // A sells B (economy)
  | "teaches"         // A teaches B
  | "part_of"         // A is part of B (zone/area)
  | "related";        // generic relationship

/** A single knowledge node in the graph */
export interface KnowledgeNode {
  id: string;
  category: KnowledgeCategory;
  subject: string;
  predicate: string;
  object: string;
  context: Record<string, unknown>;
  confidence: number;
  source: {
    botId: string;
    botName: string;
    timestamp: number;
    mapId?: number;
    zoneId?: number;
  };
  tags: string[];
  accessCount: number;
  lastAccessed: number;
}

/** An edge connecting two knowledge nodes */
export interface KnowledgeEdge {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  relation: EdgeRelation;
  weight: number;       // 0-1 strength of the relationship
  bidirectional: boolean;
}

/** Query parameters for searching the knowledge graph */
export interface KnowledgeQuery {
  category?: KnowledgeCategory;
  subject?: string;
  predicate?: string;
  object?: string;
  tags?: string[];
  botId?: string;
  minConfidence?: number;
  mapId?: number;
  zoneId?: number;
  limit?: number;
  includeRelated?: boolean;
}

/** Statistics about the knowledge graph */
export interface KnowledgeGraphStats {
  totalNodes: number;
  totalEdges: number;
  nodesByCategory: Record<string, number>;
  topContributors: Array<{ botId: string; botName: string; count: number }>;
  averageConfidence: number;
  oldestEntry: number;
  newestEntry: number;
  totalQueries: number;
  cacheHitRate: number;
}

/** Batch learning input from a bot session */
export interface BotExperience {
  botId: string;
  botName: string;
  category: KnowledgeCategory;
  subject: string;
  predicate: string;
  object: string;
  confidence: number;
  context?: Record<string, unknown>;
  tags?: string[];
  mapId?: number;
  zoneId?: number;
  relatedTo?: Array<{
    nodeSubject: string;
    relation: EdgeRelation;
    weight?: number;
  }>;
}

/** Result of a knowledge merge operation */
export interface MergeResult {
  action: "created" | "updated" | "unchanged";
  nodeId: string;
  previousConfidence?: number;
  newConfidence: number;
}

// ─── Knowledge Graph Implementation ──────────────────────────────────────────

/** Confidence decay rate per hour (knowledge becomes less reliable over time) */
const CONFIDENCE_DECAY_PER_HOUR = 0.001;

/** Minimum confidence threshold before a node is considered unreliable */
const MIN_CONFIDENCE_THRESHOLD = 0.1;

/** Maximum nodes in the graph (memory management) */
const MAX_GRAPH_NODES = 100000;

/** LRU eviction threshold: when graph exceeds MAX, evict least accessed nodes */
const EVICTION_BATCH_SIZE = 1000;

class KnowledgeGraph {
  private nodes: Map<string, KnowledgeNode> = new Map();
  private edges: Map<string, KnowledgeEdge> = new Map();
  private subjectIndex: Map<string, Set<string>> = new Map();
  private categoryIndex: Map<string, Set<string>> = new Map();
  private tagIndex: Map<string, Set<string>> = new Map();
  private botIndex: Map<string, Set<string>> = new Map();
  private totalQueries = 0;
  private cacheHits = 0;

  /** Generate a deterministic node ID from subject+predicate+object */
  private makeNodeId(subject: string, predicate: string, object: string): string {
    const key = `${subject.toLowerCase()}|${predicate.toLowerCase()}|${object.toLowerCase()}`;
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      const char = key.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    return `kn_${Math.abs(hash).toString(36)}`;
  }

  /** Generate an edge ID */
  private makeEdgeId(fromId: string, toId: string, relation: EdgeRelation): string {
    return `ke_${fromId}_${relation}_${toId}`;
  }

  /** Add or update a node in the index maps */
  private indexNode(node: KnowledgeNode): void {
    // Subject index
    const subjKey = node.subject.toLowerCase();
    if (!this.subjectIndex.has(subjKey)) {
      this.subjectIndex.set(subjKey, new Set());
    }
    this.subjectIndex.get(subjKey)!.add(node.id);

    // Category index
    if (!this.categoryIndex.has(node.category)) {
      this.categoryIndex.set(node.category, new Set());
    }
    this.categoryIndex.get(node.category)!.add(node.id);

    // Tag index
    for (const tag of node.tags) {
      const tagKey = tag.toLowerCase();
      if (!this.tagIndex.has(tagKey)) {
        this.tagIndex.set(tagKey, new Set());
      }
      this.tagIndex.get(tagKey)!.add(node.id);
    }

    // Bot index
    if (!this.botIndex.has(node.source.botId)) {
      this.botIndex.set(node.source.botId, new Set());
    }
    this.botIndex.get(node.source.botId)!.add(node.id);
  }

  /** Remove a node from all indexes */
  private unindexNode(node: KnowledgeNode): void {
    const subjKey = node.subject.toLowerCase();
    this.subjectIndex.get(subjKey)?.delete(node.id);

    this.categoryIndex.get(node.category)?.delete(node.id);

    for (const tag of node.tags) {
      this.tagIndex.get(tag.toLowerCase())?.delete(node.id);
    }

    this.botIndex.get(node.source.botId)?.delete(node.id);
  }

  /** Apply time-based confidence decay to a node */
  private getDecayedConfidence(node: KnowledgeNode): number {
    const hoursElapsed = (Date.now() - node.source.timestamp) / (1000 * 60 * 60);
    const decayed = node.confidence - (hoursElapsed * CONFIDENCE_DECAY_PER_HOUR);
    return Math.max(MIN_CONFIDENCE_THRESHOLD, Math.min(1, decayed));
  }

  /** Evict least-accessed nodes when graph exceeds capacity */
  private evictIfNeeded(): void {
    if (this.nodes.size <= MAX_GRAPH_NODES) return;

    logger.info(`Knowledge graph at capacity (${this.nodes.size}/${MAX_GRAPH_NODES}), evicting ${EVICTION_BATCH_SIZE} nodes`);

    // Sort by (accessCount ascending, then lastAccessed ascending)
    const sorted = Array.from(this.nodes.values())
      .sort((a, b) => a.accessCount - b.accessCount || a.lastAccessed - b.lastAccessed);

    const toEvict = sorted.slice(0, EVICTION_BATCH_SIZE);
    for (const node of toEvict) {
      this.removeNode(node.id);
    }
  }

  // ─── Public API ──────────────────────────────────────────────────────────

  /**
   * Record a bot experience as a knowledge node.
   * If a matching node already exists, merges confidence (reinforcement learning).
   */
  public recordExperience(exp: BotExperience): MergeResult {
    const nodeId = this.makeNodeId(exp.subject, exp.predicate, exp.object);
    const existing = this.nodes.get(nodeId);

    if (existing) {
      // Merge: reinforce confidence (weighted average favoring higher confidence)
      const prevConfidence = existing.confidence;
      const merged = Math.min(1, (existing.confidence + exp.confidence) / 2 + 0.05);
      existing.confidence = merged;
      existing.accessCount++;
      existing.lastAccessed = Date.now();

      // Update context if new info provided
      if (exp.context) {
        existing.context = { ...existing.context, ...exp.context };
      }

      // Add new tags
      if (exp.tags) {
        for (const tag of exp.tags) {
          if (!existing.tags.includes(tag)) {
            existing.tags.push(tag);
            const tagKey = tag.toLowerCase();
            if (!this.tagIndex.has(tagKey)) {
              this.tagIndex.set(tagKey, new Set());
            }
            this.tagIndex.get(tagKey)!.add(nodeId);
          }
        }
      }

      if (Math.abs(prevConfidence - merged) < 0.001) {
        return { action: "unchanged", nodeId, previousConfidence: prevConfidence, newConfidence: merged };
      }

      return { action: "updated", nodeId, previousConfidence: prevConfidence, newConfidence: merged };
    }

    // Create new node
    const node: KnowledgeNode = {
      id: nodeId,
      category: exp.category,
      subject: exp.subject,
      predicate: exp.predicate,
      object: exp.object,
      context: exp.context || {},
      confidence: Math.max(MIN_CONFIDENCE_THRESHOLD, Math.min(1, exp.confidence)),
      source: {
        botId: exp.botId,
        botName: exp.botName,
        timestamp: Date.now(),
        mapId: exp.mapId,
        zoneId: exp.zoneId,
      },
      tags: exp.tags || [],
      accessCount: 0,
      lastAccessed: Date.now(),
    };

    this.nodes.set(nodeId, node);
    this.indexNode(node);
    this.evictIfNeeded();

    // Create edges to related nodes
    if (exp.relatedTo) {
      for (const rel of exp.relatedTo) {
        this.createEdgeBySubject(nodeId, rel.nodeSubject, rel.relation, rel.weight);
      }
    }

    return { action: "created", nodeId, newConfidence: node.confidence };
  }

  /**
   * Record multiple experiences at once (batch operation).
   */
  public recordBatch(experiences: BotExperience[]): MergeResult[] {
    return experiences.map(exp => this.recordExperience(exp));
  }

  /**
   * Query the knowledge graph for matching nodes.
   */
  public query(params: KnowledgeQuery): KnowledgeNode[] {
    this.totalQueries++;

    let candidateIds: Set<string> | null = null;

    // Intersect index lookups for efficient filtering
    if (params.category) {
      const catIds = this.categoryIndex.get(params.category);
      candidateIds = catIds ? new Set(catIds) : new Set();
    }

    if (params.subject) {
      const subjIds = this.subjectIndex.get(params.subject.toLowerCase());
      if (subjIds) {
        candidateIds = candidateIds
          ? new Set([...candidateIds].filter(id => subjIds.has(id)))
          : new Set(subjIds);
      } else {
        return [];
      }
    }

    if (params.tags && params.tags.length > 0) {
      for (const tag of params.tags) {
        const tagIds = this.tagIndex.get(tag.toLowerCase());
        if (tagIds) {
          candidateIds = candidateIds
            ? new Set([...candidateIds].filter(id => tagIds.has(id)))
            : new Set(tagIds);
        } else {
          return [];
        }
      }
    }

    if (params.botId) {
      const botIds = this.botIndex.get(params.botId);
      if (botIds) {
        candidateIds = candidateIds
          ? new Set([...candidateIds].filter(id => botIds.has(id)))
          : new Set(botIds);
      } else {
        return [];
      }
    }

    // If no index was used, scan all nodes
    if (candidateIds === null) {
      candidateIds = new Set(this.nodes.keys());
    }

    const minConfidence = params.minConfidence || MIN_CONFIDENCE_THRESHOLD;
    const limit = params.limit || 50;

    // Filter and sort
    const results: KnowledgeNode[] = [];
    for (const id of candidateIds) {
      const node = this.nodes.get(id);
      if (!node) continue;

      const decayedConf = this.getDecayedConfidence(node);
      if (decayedConf < minConfidence) continue;

      if (params.predicate && node.predicate.toLowerCase() !== params.predicate.toLowerCase()) continue;
      if (params.object && node.object.toLowerCase() !== params.object.toLowerCase()) continue;
      if (params.mapId !== undefined && node.source.mapId !== params.mapId) continue;
      if (params.zoneId !== undefined && node.source.zoneId !== params.zoneId) continue;

      // Update access stats
      node.accessCount++;
      node.lastAccessed = Date.now();

      results.push({ ...node, confidence: decayedConf });
    }

    // Sort by confidence descending
    results.sort((a, b) => b.confidence - a.confidence);

    const limited = results.slice(0, limit);

    // Optionally include related nodes
    if (params.includeRelated && limited.length > 0) {
      const relatedNodes = this.getRelatedNodes(limited.map(n => n.id));
      // Append unique related nodes
      const resultIds = new Set(limited.map(n => n.id));
      for (const rn of relatedNodes) {
        if (!resultIds.has(rn.id)) {
          limited.push(rn);
          resultIds.add(rn.id);
        }
      }
    }

    return limited;
  }

  /**
   * Get the best known approach for a specific situation.
   * Returns the highest-confidence knowledge for a combat encounter, quest, etc.
   */
  public getBestApproach(params: {
    category: KnowledgeCategory;
    subject: string;
    minConfidence?: number;
  }): {
    bestApproach: KnowledgeNode | null;
    alternatives: KnowledgeNode[];
    totalKnown: number;
  } {
    const all = this.query({
      category: params.category,
      subject: params.subject,
      minConfidence: params.minConfidence || 0.3,
      limit: 20,
    });

    return {
      bestApproach: all.length > 0 ? all[0] : null,
      alternatives: all.slice(1, 5),
      totalKnown: all.length,
    };
  }

  /**
   * Create an edge between two nodes.
   */
  public addEdge(fromNodeId: string, toNodeId: string, relation: EdgeRelation, weight: number = 0.5, bidirectional: boolean = false): KnowledgeEdge | null {
    if (!this.nodes.has(fromNodeId) || !this.nodes.has(toNodeId)) {
      return null;
    }

    const edgeId = this.makeEdgeId(fromNodeId, toNodeId, relation);
    const edge: KnowledgeEdge = {
      id: edgeId,
      fromNodeId,
      toNodeId,
      relation,
      weight: Math.max(0, Math.min(1, weight)),
      bidirectional,
    };

    this.edges.set(edgeId, edge);

    if (bidirectional) {
      const reverseId = this.makeEdgeId(toNodeId, fromNodeId, relation);
      this.edges.set(reverseId, {
        ...edge,
        id: reverseId,
        fromNodeId: toNodeId,
        toNodeId: fromNodeId,
      });
    }

    return edge;
  }

  /** Create an edge from a node to another node identified by subject string */
  private createEdgeBySubject(fromNodeId: string, targetSubject: string, relation: EdgeRelation, weight?: number): void {
    const targetIds = this.subjectIndex.get(targetSubject.toLowerCase());
    if (!targetIds || targetIds.size === 0) return;

    // Connect to the first matching node
    const targetId = targetIds.values().next().value;
    if (targetId) {
      this.addEdge(fromNodeId, targetId, relation, weight || 0.5);
    }
  }

  /**
   * Get all nodes connected to the given node IDs via edges.
   */
  public getRelatedNodes(nodeIds: string[]): KnowledgeNode[] {
    const relatedIds = new Set<string>();
    const sourceIds = new Set(nodeIds);

    for (const edge of this.edges.values()) {
      if (sourceIds.has(edge.fromNodeId) && !sourceIds.has(edge.toNodeId)) {
        relatedIds.add(edge.toNodeId);
      }
      if (sourceIds.has(edge.toNodeId) && !sourceIds.has(edge.fromNodeId)) {
        relatedIds.add(edge.fromNodeId);
      }
    }

    const results: KnowledgeNode[] = [];
    for (const id of relatedIds) {
      const node = this.nodes.get(id);
      if (node) {
        results.push({ ...node, confidence: this.getDecayedConfidence(node) });
      }
    }

    return results;
  }

  /**
   * Remove a node and all its edges.
   */
  public removeNode(nodeId: string): boolean {
    const node = this.nodes.get(nodeId);
    if (!node) return false;

    this.unindexNode(node);
    this.nodes.delete(nodeId);

    // Remove all edges involving this node
    for (const [edgeId, edge] of this.edges) {
      if (edge.fromNodeId === nodeId || edge.toNodeId === nodeId) {
        this.edges.delete(edgeId);
      }
    }

    return true;
  }

  /**
   * Get a specific node by ID.
   */
  public getNode(nodeId: string): KnowledgeNode | null {
    const node = this.nodes.get(nodeId);
    if (!node) return null;

    node.accessCount++;
    node.lastAccessed = Date.now();
    return { ...node, confidence: this.getDecayedConfidence(node) };
  }

  /**
   * Get edges connected to a node.
   */
  public getEdgesForNode(nodeId: string): KnowledgeEdge[] {
    const result: KnowledgeEdge[] = [];
    for (const edge of this.edges.values()) {
      if (edge.fromNodeId === nodeId || edge.toNodeId === nodeId) {
        result.push(edge);
      }
    }
    return result;
  }

  /**
   * Get comprehensive graph statistics.
   */
  public getStats(): KnowledgeGraphStats {
    const nodesByCategory: Record<string, number> = {};
    const contributorMap = new Map<string, { botName: string; count: number }>();
    let totalConfidence = 0;
    let oldest = Infinity;
    let newest = 0;

    for (const node of this.nodes.values()) {
      nodesByCategory[node.category] = (nodesByCategory[node.category] || 0) + 1;
      totalConfidence += this.getDecayedConfidence(node);

      const contrib = contributorMap.get(node.source.botId);
      if (contrib) {
        contrib.count++;
      } else {
        contributorMap.set(node.source.botId, { botName: node.source.botName, count: 1 });
      }

      if (node.source.timestamp < oldest) oldest = node.source.timestamp;
      if (node.source.timestamp > newest) newest = node.source.timestamp;
    }

    const topContributors = Array.from(contributorMap.entries())
      .map(([botId, data]) => ({ botId, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalNodes: this.nodes.size,
      totalEdges: this.edges.size,
      nodesByCategory,
      topContributors,
      averageConfidence: this.nodes.size > 0 ? totalConfidence / this.nodes.size : 0,
      oldestEntry: oldest === Infinity ? 0 : oldest,
      newestEntry: newest,
      totalQueries: this.totalQueries,
      cacheHitRate: this.totalQueries > 0 ? this.cacheHits / this.totalQueries : 0,
    };
  }

  /**
   * Clear the entire knowledge graph.
   */
  public clear(): void {
    this.nodes.clear();
    this.edges.clear();
    this.subjectIndex.clear();
    this.categoryIndex.clear();
    this.tagIndex.clear();
    this.botIndex.clear();
    this.totalQueries = 0;
    this.cacheHits = 0;
  }

  /**
   * Export the graph as a serializable object.
   */
  public exportGraph(): { nodes: KnowledgeNode[]; edges: KnowledgeEdge[] } {
    return {
      nodes: Array.from(this.nodes.values()),
      edges: Array.from(this.edges.values()),
    };
  }

  /**
   * Import nodes and edges into the graph.
   */
  public importGraph(data: { nodes: KnowledgeNode[]; edges: KnowledgeEdge[] }): { nodesImported: number; edgesImported: number } {
    let nodesImported = 0;
    let edgesImported = 0;

    for (const node of data.nodes) {
      if (!this.nodes.has(node.id)) {
        this.nodes.set(node.id, node);
        this.indexNode(node);
        nodesImported++;
      }
    }

    for (const edge of data.edges) {
      if (!this.edges.has(edge.id) && this.nodes.has(edge.fromNodeId) && this.nodes.has(edge.toNodeId)) {
        this.edges.set(edge.id, edge);
        edgesImported++;
      }
    }

    this.evictIfNeeded();
    return { nodesImported, edgesImported };
  }

  /** Get size of the graph */
  public get size(): number {
    return this.nodes.size;
  }
}

// ─── Singleton Instance ──────────────────────────────────────────────────────

const knowledgeGraph = new KnowledgeGraph();

// ─── Database-Enriched Functions ─────────────────────────────────────────────

/**
 * Record a bot combat experience, enriching with creature data from DB.
 */
export async function recordCombatExperience(params: {
  botId: string;
  botName: string;
  creatureEntry: number;
  outcome: "victory" | "defeat" | "fled";
  spellsUsed?: number[];
  damageDealt?: number;
  damageTaken?: number;
  duration?: number;
  mapId?: number;
  zoneId?: number;
  notes?: string;
}): Promise<MergeResult & { creatureName: string }> {
  // Look up creature name from database
  let creatureName = `Creature ${params.creatureEntry}`;
  try {
    const rows = await queryWorld(
      `SELECT name FROM creature_template WHERE entry = ?`,
      [params.creatureEntry]
    );
    if (rows && rows.length > 0 && rows[0].name) {
      creatureName = rows[0].name;
    }
  } catch (err) {
    logger.warn(`Failed to look up creature ${params.creatureEntry}: ${err}`);
  }

  const predicate = params.outcome === "victory" ? "defeated" :
                    params.outcome === "defeat" ? "was defeated by" : "fled from";

  const result = knowledgeGraph.recordExperience({
    botId: params.botId,
    botName: params.botName,
    category: "combat",
    subject: params.botName,
    predicate,
    object: creatureName,
    confidence: params.outcome === "victory" ? 0.8 :
                params.outcome === "defeat" ? 0.6 : 0.4,
    context: {
      creatureEntry: params.creatureEntry,
      outcome: params.outcome,
      spellsUsed: params.spellsUsed,
      damageDealt: params.damageDealt,
      damageTaken: params.damageTaken,
      duration: params.duration,
      notes: params.notes,
    },
    tags: ["combat", params.outcome, creatureName.toLowerCase()],
    mapId: params.mapId,
    zoneId: params.zoneId,
  });

  logger.info(`Recorded combat experience: ${params.botName} ${predicate} ${creatureName} [${result.action}]`);
  return { ...result, creatureName };
}

/**
 * Record a quest completion experience.
 */
export async function recordQuestExperience(params: {
  botId: string;
  botName: string;
  questId: number;
  outcome: "completed" | "abandoned" | "failed";
  timeSpent?: number;
  difficulty?: "easy" | "medium" | "hard";
  tips?: string;
  mapId?: number;
  zoneId?: number;
}): Promise<MergeResult & { questTitle: string }> {
  let questTitle = `Quest ${params.questId}`;
  try {
    const rows = await queryWorld(
      `SELECT LogTitle FROM quest_template WHERE ID = ?`,
      [params.questId]
    );
    if (rows && rows.length > 0 && rows[0].LogTitle) {
      questTitle = rows[0].LogTitle;
    }
  } catch (err) {
    logger.warn(`Failed to look up quest ${params.questId}: ${err}`);
  }

  const result = knowledgeGraph.recordExperience({
    botId: params.botId,
    botName: params.botName,
    category: "quest",
    subject: params.botName,
    predicate: params.outcome === "completed" ? "completed" :
              params.outcome === "abandoned" ? "abandoned" : "failed",
    object: questTitle,
    confidence: params.outcome === "completed" ? 0.9 :
               params.outcome === "abandoned" ? 0.5 : 0.4,
    context: {
      questId: params.questId,
      outcome: params.outcome,
      timeSpent: params.timeSpent,
      difficulty: params.difficulty,
      tips: params.tips,
    },
    tags: ["quest", params.outcome, ...(params.difficulty ? [params.difficulty] : [])],
    mapId: params.mapId,
    zoneId: params.zoneId,
  });

  logger.info(`Recorded quest experience: ${params.botName} ${params.outcome} ${questTitle} [${result.action}]`);
  return { ...result, questTitle };
}

/**
 * Record an exploration discovery.
 */
export function recordExplorationExperience(params: {
  botId: string;
  botName: string;
  discovery: string;
  locationType: "vendor" | "trainer" | "mailbox" | "flightpath" | "resource" | "rare" | "path" | "danger" | "other";
  x: number;
  y: number;
  z: number;
  mapId: number;
  zoneId?: number;
  notes?: string;
}): MergeResult {
  const result = knowledgeGraph.recordExperience({
    botId: params.botId,
    botName: params.botName,
    category: "exploration",
    subject: params.discovery,
    predicate: "found_at",
    object: `(${params.x.toFixed(1)}, ${params.y.toFixed(1)}, ${params.z.toFixed(1)})`,
    confidence: 0.95,
    context: {
      locationType: params.locationType,
      x: params.x,
      y: params.y,
      z: params.z,
      notes: params.notes,
    },
    tags: ["exploration", params.locationType],
    mapId: params.mapId,
    zoneId: params.zoneId,
  });

  logger.info(`Recorded exploration: ${params.botName} found ${params.discovery} [${result.action}]`);
  return result;
}

/**
 * Record an economy observation (price, vendor, auction).
 */
export function recordEconomyExperience(params: {
  botId: string;
  botName: string;
  itemName: string;
  action: "bought" | "sold" | "auctioned" | "observed_price";
  price: number;
  quantity?: number;
  vendorName?: string;
  mapId?: number;
  zoneId?: number;
}): MergeResult {
  const result = knowledgeGraph.recordExperience({
    botId: params.botId,
    botName: params.botName,
    category: "economy",
    subject: params.itemName,
    predicate: params.action,
    object: `${params.price} copper${params.vendorName ? ` at ${params.vendorName}` : ""}`,
    confidence: 0.85,
    context: {
      price: params.price,
      quantity: params.quantity || 1,
      vendorName: params.vendorName,
      action: params.action,
    },
    tags: ["economy", params.action, params.itemName.toLowerCase()],
    mapId: params.mapId,
    zoneId: params.zoneId,
  });

  logger.info(`Recorded economy: ${params.botName} ${params.action} ${params.itemName} for ${params.price}c [${result.action}]`);
  return result;
}

/**
 * Query the knowledge graph.
 */
export function queryKnowledge(params: KnowledgeQuery): KnowledgeNode[] {
  return knowledgeGraph.query(params);
}

/**
 * Get the best known approach for a situation.
 */
export function getBestApproach(category: KnowledgeCategory, subject: string, minConfidence?: number): {
  bestApproach: KnowledgeNode | null;
  alternatives: KnowledgeNode[];
  totalKnown: number;
} {
  return knowledgeGraph.getBestApproach({ category, subject, minConfidence });
}

/**
 * Get knowledge graph statistics.
 */
export function getKnowledgeStats(): KnowledgeGraphStats {
  return knowledgeGraph.getStats();
}

/**
 * Add a relationship between two knowledge subjects.
 */
export function addKnowledgeRelation(params: {
  fromSubject: string;
  toSubject: string;
  relation: EdgeRelation;
  weight?: number;
  bidirectional?: boolean;
}): { success: boolean; edgeId?: string; error?: string } {
  // Find nodes by subject
  const fromNodes = knowledgeGraph.query({ subject: params.fromSubject, limit: 1 });
  const toNodes = knowledgeGraph.query({ subject: params.toSubject, limit: 1 });

  if (fromNodes.length === 0) {
    return { success: false, error: `No knowledge found for subject "${params.fromSubject}"` };
  }
  if (toNodes.length === 0) {
    return { success: false, error: `No knowledge found for subject "${params.toSubject}"` };
  }

  const edge = knowledgeGraph.addEdge(
    fromNodes[0].id,
    toNodes[0].id,
    params.relation,
    params.weight || 0.5,
    params.bidirectional || false
  );

  if (!edge) {
    return { success: false, error: "Failed to create edge" };
  }

  return { success: true, edgeId: edge.id };
}

/**
 * Get a specific knowledge node and its relationships.
 */
export function getKnowledgeNode(nodeId: string): {
  node: KnowledgeNode | null;
  edges: KnowledgeEdge[];
  relatedNodes: KnowledgeNode[];
} {
  const node = knowledgeGraph.getNode(nodeId);
  if (!node) {
    return { node: null, edges: [], relatedNodes: [] };
  }

  const edges = knowledgeGraph.getEdgesForNode(nodeId);
  const relatedNodes = knowledgeGraph.getRelatedNodes([nodeId]);

  return { node, edges, relatedNodes };
}

/**
 * Export the entire knowledge graph.
 */
export function exportKnowledgeGraph(): { nodes: KnowledgeNode[]; edges: KnowledgeEdge[] } {
  return knowledgeGraph.exportGraph();
}

/**
 * Import knowledge from an exported graph.
 */
export function importKnowledgeGraph(data: { nodes: KnowledgeNode[]; edges: KnowledgeEdge[] }): {
  nodesImported: number;
  edgesImported: number;
} {
  return knowledgeGraph.importGraph(data);
}

/**
 * Clear the knowledge graph (for testing or reset).
 */
export function clearKnowledgeGraph(): void {
  knowledgeGraph.clear();
  logger.info("Knowledge graph cleared");
}

/**
 * Format knowledge graph as a markdown report.
 */
export function formatKnowledgeReport(params?: { category?: KnowledgeCategory; limit?: number }): string {
  const stats = knowledgeGraph.getStats();
  const nodes = knowledgeGraph.query({
    category: params?.category,
    limit: params?.limit || 30,
    minConfidence: 0.2,
  });

  const lines: string[] = [];
  lines.push("# Cross-Bot Knowledge Graph Report");
  lines.push("");
  lines.push("## Statistics");
  lines.push(`- **Total Knowledge Nodes:** ${stats.totalNodes}`);
  lines.push(`- **Total Relationships:** ${stats.totalEdges}`);
  lines.push(`- **Average Confidence:** ${(stats.averageConfidence * 100).toFixed(1)}%`);
  lines.push(`- **Total Queries:** ${stats.totalQueries}`);
  lines.push("");

  if (stats.topContributors.length > 0) {
    lines.push("## Top Contributors");
    for (const c of stats.topContributors.slice(0, 5)) {
      lines.push(`- **${c.botName}** (${c.botId}): ${c.count} contributions`);
    }
    lines.push("");
  }

  if (Object.keys(stats.nodesByCategory).length > 0) {
    lines.push("## Knowledge by Category");
    for (const [cat, count] of Object.entries(stats.nodesByCategory).sort((a, b) => b[1] - a[1])) {
      lines.push(`- **${cat}:** ${count} entries`);
    }
    lines.push("");
  }

  if (nodes.length > 0) {
    const heading = params?.category ? `## ${params.category.charAt(0).toUpperCase() + params.category.slice(1)} Knowledge` : "## Recent Knowledge";
    lines.push(heading);
    lines.push("");
    lines.push("| Subject | Predicate | Object | Confidence | Source |");
    lines.push("|---------|-----------|--------|------------|--------|");
    for (const n of nodes) {
      const conf = (n.confidence * 100).toFixed(0);
      lines.push(`| ${n.subject} | ${n.predicate} | ${n.object} | ${conf}% | ${n.source.botName} |`);
    }
  }

  return lines.join("\n");
}

// Export the class for testing purposes
export { KnowledgeGraph };
