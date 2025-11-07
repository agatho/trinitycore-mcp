/**
 * Visual Quest Chain Mapper
 * Human Exploration Tool #5
 *
 * Purpose: Generate visual dependency graphs for quest chains using Mermaid diagrams.
 * Benefit: Humans can understand complex quest dependencies and progression paths visually.
 */

import { queryWorld } from "../database/connection";

/**
 * Quest information
 */
export interface QuestInfo {
  id: number;
  title: string;
  level: number;
  minLevel: number;
  type: string;
  prevQuest?: number;
  nextQuest?: number;
  exclusiveGroup?: number;
  breadcrumbQuest?: number;
}

/**
 * Quest dependency relationship
 */
export interface QuestDependency {
  from: number;
  to: number;
  type: "prerequisite" | "followup" | "breadcrumb" | "exclusive";
}

/**
 * Quest chain graph
 */
export interface QuestChain {
  quests: QuestInfo[];
  dependencies: QuestDependency[];
  entryPoints: number[]; // Quest IDs with no prerequisites
  terminals: number[]; // Quest IDs with no followups
  branches: Array<{
    questId: number;
    branches: number[];
  }>;
  criticalPath: number[]; // Longest path through the chain
}

/**
 * Mermaid diagram options
 */
export interface MermaidOptions {
  orientation: "TB" | "LR" | "BT" | "RL";
  includeQuestLevel: boolean;
  includeQuestType: boolean;
  highlightCriticalPath: boolean;
  colorByLevel: boolean;
}

/**
 * Get quest information by ID
 */
export async function getQuestInfo(questId: number): Promise<QuestInfo | null> {
  const rows = await queryWorld(
    `SELECT
      ID as id,
      LogTitle as title,
      QuestLevel as level,
      MinLevel as minLevel,
      QuestType as type,
      qta.PrevQuestID as prevQuest,
      qta.NextQuestID as nextQuest,
      COALESCE(qta.ExclusiveGroup, 0) as exclusiveGroup,
      qt.BreadcrumbForQuestId as breadcrumbQuest
     FROM quest_template qt
     LEFT JOIN quest_template_addon qta ON qt.ID = qta.ID
     WHERE qt.ID = ?`,
    [questId]
  );

  if (rows.length === 0) return null;

  return rows[0];
}

/**
 * Find all quests in a chain starting from a quest
 */
export async function findQuestChain(startQuestId: number): Promise<QuestChain> {
  const visited = new Set<number>();
  const quests: QuestInfo[] = [];
  const dependencies: QuestDependency[] = [];
  const queue: number[] = [startQuestId];

  // BFS to find all connected quests
  while (queue.length > 0) {
    const currentId = queue.shift()!;

    if (visited.has(currentId)) continue;
    visited.add(currentId);

    const questInfo = await getQuestInfo(currentId);
    if (!questInfo) continue;

    quests.push(questInfo);

    // Add prerequisite relationship
    if (questInfo.prevQuest) {
      dependencies.push({
        from: questInfo.prevQuest,
        to: currentId,
        type: "prerequisite",
      });
      queue.push(questInfo.prevQuest);
    }

    // Add followup relationship
    if (questInfo.nextQuest) {
      dependencies.push({
        from: currentId,
        to: questInfo.nextQuest,
        type: "followup",
      });
      queue.push(questInfo.nextQuest);
    }

    // Add breadcrumb relationship
    if (questInfo.breadcrumbQuest) {
      dependencies.push({
        from: currentId,
        to: questInfo.breadcrumbQuest,
        type: "breadcrumb",
      });
      queue.push(questInfo.breadcrumbQuest);
    }

    // Find exclusive group quests
    if (questInfo.exclusiveGroup) {
      const exclusiveQuests = await queryWorld(
        `SELECT ID FROM quest_template WHERE ExclusiveGroup = ? AND ID != ?`,
        [questInfo.exclusiveGroup, currentId]
      );

      for (const row of exclusiveQuests) {
        dependencies.push({
          from: currentId,
          to: row.ID,
          type: "exclusive",
        });
        queue.push(row.ID);
      }
    }
  }

  // Find entry points (no prerequisites)
  const questIds = new Set(quests.map((q) => q.id));
  const hasPrereq = new Set(
    dependencies.filter((d) => d.type === "prerequisite").map((d) => d.to)
  );
  const entryPoints = quests.filter((q) => !hasPrereq.has(q.id)).map((q) => q.id);

  // Find terminals (no followups)
  const hasFollowup = new Set(
    dependencies.filter((d) => d.type === "followup").map((d) => d.from)
  );
  const terminals = quests.filter((q) => !hasFollowup.has(q.id)).map((q) => q.id);

  // Find branches (quests with multiple followups)
  const branches: Array<{ questId: number; branches: number[] }> = [];
  for (const quest of quests) {
    const followups = dependencies
      .filter((d) => d.from === quest.id && d.type === "followup")
      .map((d) => d.to);

    if (followups.length > 1) {
      branches.push({
        questId: quest.id,
        branches: followups,
      });
    }
  }

  // Calculate critical path (longest path)
  const criticalPath = calculateCriticalPath(quests, dependencies);

  return {
    quests,
    dependencies,
    entryPoints,
    terminals,
    branches,
    criticalPath,
  };
}

/**
 * Calculate critical path (longest path through quest chain)
 */
function calculateCriticalPath(
  quests: QuestInfo[],
  dependencies: QuestDependency[]
): number[] {
  // Build adjacency list
  const graph = new Map<number, number[]>();
  const inDegree = new Map<number, number>();

  for (const quest of quests) {
    graph.set(quest.id, []);
    inDegree.set(quest.id, 0);
  }

  for (const dep of dependencies) {
    if (dep.type === "prerequisite" || dep.type === "followup") {
      graph.get(dep.from)?.push(dep.to);
      inDegree.set(dep.to, (inDegree.get(dep.to) || 0) + 1);
    }
  }

  // Topological sort with path tracking
  const queue: number[] = [];
  const distance = new Map<number, number>();
  const parent = new Map<number, number>();

  for (const [questId, degree] of inDegree) {
    if (degree === 0) {
      queue.push(questId);
      distance.set(questId, 0);
    }
  }

  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentDist = distance.get(current) || 0;

    for (const neighbor of graph.get(current) || []) {
      const neighborDegree = inDegree.get(neighbor) || 0;
      inDegree.set(neighbor, neighborDegree - 1);

      // Update distance if longer path found
      const newDist = currentDist + 1;
      if (!distance.has(neighbor) || newDist > distance.get(neighbor)!) {
        distance.set(neighbor, newDist);
        parent.set(neighbor, current);
      }

      if (inDegree.get(neighbor) === 0) {
        queue.push(neighbor);
      }
    }
  }

  // Find longest path
  let maxDist = 0;
  let endQuest = 0;

  for (const [questId, dist] of distance) {
    if (dist > maxDist) {
      maxDist = dist;
      endQuest = questId;
    }
  }

  // Reconstruct path
  const path: number[] = [];
  let current: number | undefined = endQuest;

  while (current !== undefined) {
    path.unshift(current);
    current = parent.get(current);
  }

  return path;
}

/**
 * Generate Mermaid diagram for quest chain
 */
export function generateMermaidDiagram(
  chain: QuestChain,
  options: MermaidOptions = {
    orientation: "TB",
    includeQuestLevel: true,
    includeQuestType: false,
    highlightCriticalPath: true,
    colorByLevel: true,
  }
): string {
  const lines: string[] = [];

  // Header
  lines.push(`graph ${options.orientation}`);

  // Define nodes
  const questMap = new Map(chain.quests.map((q) => [q.id, q]));

  for (const quest of chain.quests) {
    let label = quest.title;

    if (options.includeQuestLevel) {
      label += ` (Lv${quest.level})`;
    }

    if (options.includeQuestType) {
      label += ` [${quest.type}]`;
    }

    // Determine node style
    const isCritical =
      options.highlightCriticalPath && chain.criticalPath.includes(quest.id);
    const isEntry = chain.entryPoints.includes(quest.id);
    const isTerminal = chain.terminals.includes(quest.id);

    let nodeStyle = "";
    if (isCritical) {
      nodeStyle = ":::critical";
    } else if (isEntry) {
      nodeStyle = ":::entry";
    } else if (isTerminal) {
      nodeStyle = ":::terminal";
    } else if (options.colorByLevel) {
      const levelTier = Math.floor(quest.level / 10);
      nodeStyle = `:::level${levelTier}`;
    }

    lines.push(`  Q${quest.id}["${label}"]${nodeStyle}`);
  }

  // Define edges
  for (const dep of chain.dependencies) {
    const fromQuest = questMap.get(dep.from);
    const toQuest = questMap.get(dep.to);

    if (!fromQuest || !toQuest) continue;

    let edgeStyle = "";
    let edgeLabel = "";

    switch (dep.type) {
      case "prerequisite":
      case "followup":
        edgeStyle = "-->";
        break;
      case "breadcrumb":
        edgeStyle = "-.->";
        edgeLabel = "|breadcrumb|";
        break;
      case "exclusive":
        edgeStyle = "-.->";
        edgeLabel = "|exclusive|";
        break;
    }

    lines.push(`  Q${dep.from} ${edgeLabel}${edgeStyle} Q${dep.to}`);
  }

  // Define styles
  lines.push("");
  lines.push("  classDef critical fill:#ff6b6b,stroke:#c92a2a,stroke-width:3px");
  lines.push("  classDef entry fill:#51cf66,stroke:#2f9e44,stroke-width:2px");
  lines.push("  classDef terminal fill:#339af0,stroke:#1971c2,stroke-width:2px");

  if (options.colorByLevel) {
    lines.push("  classDef level0 fill:#e7f5ff,stroke:#339af0");
    lines.push("  classDef level1 fill:#d0ebff,stroke:#228be6");
    lines.push("  classDef level2 fill:#a5d8ff,stroke:#1c7ed6");
    lines.push("  classDef level3 fill:#74c0fc,stroke:#1864ab");
    lines.push("  classDef level4 fill:#4dabf7,stroke:#1971c2");
    lines.push("  classDef level5 fill:#339af0,stroke:#1864ab");
    lines.push("  classDef level6 fill:#228be6,stroke:#1971c2");
    lines.push("  classDef level7 fill:#1c7ed6,stroke:#1864ab");
    lines.push("  classDef level8 fill:#1971c2,stroke:#1864ab");
  }

  return lines.join("\n");
}

/**
 * Find quest chains by zone
 */
export async function findQuestChainsByZone(zoneId: number): Promise<number[]> {
  const rows = await queryWorld(
    `SELECT DISTINCT ID
     FROM quest_template qt
     LEFT JOIN quest_template_addon qta ON qt.ID = qta.ID
     WHERE (qt.QuestSortID = ? OR qt.ZoneOrSort = ?)
       AND (qta.PrevQuestID = 0 OR qta.PrevQuestID IS NULL)
     ORDER BY QuestLevel, ID`,
    [zoneId, zoneId]
  );

  return rows.map((row: any) => row.ID);
}

/**
 * Find quest chains by level range
 */
export async function findQuestChainsByLevel(
  minLevel: number,
  maxLevel: number
): Promise<number[]> {
  const rows = await queryWorld(
    `SELECT DISTINCT ID
     FROM quest_template qt
     LEFT JOIN quest_template_addon qta ON qt.ID = qta.ID
     WHERE qt.QuestLevel BETWEEN ? AND ?
       AND (qta.PrevQuestID = 0 OR qta.PrevQuestID IS NULL)
     ORDER BY QuestLevel, ID`,
    [minLevel, maxLevel]
  );

  return rows.map((row: any) => row.ID);
}

/**
 * Analyze quest chain complexity
 */
export function analyzeQuestChainComplexity(chain: QuestChain): {
  length: number;
  branches: number;
  exclusiveChoices: number;
  avgQuestLevel: number;
  levelRange: { min: number; max: number };
  estimatedCompletionTime: number; // minutes
  difficulty: "simple" | "moderate" | "complex" | "very_complex";
} {
  const length = chain.quests.length;
  const branches = chain.branches.length;
  const exclusiveChoices = chain.dependencies.filter((d) => d.type === "exclusive")
    .length;

  const levels = chain.quests.map((q) => q.level);
  const avgQuestLevel = levels.reduce((a, b) => a + b, 0) / levels.length;
  const levelRange = {
    min: Math.min(...levels),
    max: Math.max(...levels),
  };

  // Estimate 5 minutes per quest
  const estimatedCompletionTime = length * 5;

  // Determine difficulty
  let difficulty: "simple" | "moderate" | "complex" | "very_complex";
  if (length < 5 && branches === 0) {
    difficulty = "simple";
  } else if (length < 10 && branches < 3) {
    difficulty = "moderate";
  } else if (length < 20 && branches < 5) {
    difficulty = "complex";
  } else {
    difficulty = "very_complex";
  }

  return {
    length,
    branches,
    exclusiveChoices,
    avgQuestLevel: Math.round(avgQuestLevel),
    levelRange,
    estimatedCompletionTime,
    difficulty,
  };
}

/**
 * Find circular dependencies in quest chains
 */
export function findCircularDependencies(chain: QuestChain): number[][] {
  const graph = new Map<number, number[]>();

  for (const quest of chain.quests) {
    graph.set(quest.id, []);
  }

  for (const dep of chain.dependencies) {
    if (dep.type === "prerequisite" || dep.type === "followup") {
      graph.get(dep.from)?.push(dep.to);
    }
  }

  const cycles: number[][] = [];
  const visited = new Set<number>();
  const recStack = new Set<number>();
  const path: number[] = [];

  function dfs(node: number): void {
    visited.add(node);
    recStack.add(node);
    path.push(node);

    for (const neighbor of graph.get(node) || []) {
      if (!visited.has(neighbor)) {
        dfs(neighbor);
      } else if (recStack.has(neighbor)) {
        // Found cycle
        const cycleStart = path.indexOf(neighbor);
        cycles.push(path.slice(cycleStart));
      }
    }

    path.pop();
    recStack.delete(node);
  }

  for (const quest of chain.quests) {
    if (!visited.has(quest.id)) {
      dfs(quest.id);
    }
  }

  return cycles;
}

/**
 * Get quest rewards summary
 */
export async function getQuestRewards(questId: number): Promise<{
  experience: number;
  money: number;
  items: Array<{ id: number; name: string; quantity: number }>;
  reputation: Array<{ faction: string; amount: number }>;
}> {
  const questData = await queryWorld(
    `SELECT
      RewardXP as experience,
      RewardMoney as money,
      RewardItem1, RewardAmount1,
      RewardItem2, RewardAmount2,
      RewardItem3, RewardAmount3,
      RewardItem4, RewardAmount4
     FROM quest_template
     WHERE ID = ?`,
    [questId]
  );

  if (questData.length === 0) {
    return {
      experience: 0,
      money: 0,
      items: [],
      reputation: [],
    };
  }

  const quest = questData[0];
  const items: Array<{ id: number; name: string; quantity: number }> = [];

  // Get reward items
  for (let i = 1; i <= 4; i++) {
    const itemId = quest[`RewardItem${i}`];
    const amount = quest[`RewardAmount${i}`];

    if (itemId && amount) {
      const itemData = await queryWorld(
        `SELECT name FROM item_template WHERE entry = ?`,
        [itemId]
      );

      if (itemData.length > 0) {
        items.push({
          id: itemId,
          name: itemData[0].name,
          quantity: amount,
        });
      }
    }
  }

  return {
    experience: quest.experience,
    money: quest.money,
    items,
    reputation: [], // Would need reputation faction query
  };
}

/**
 * Export quest chain to different formats
 */
export interface QuestChainExport {
  format: "mermaid" | "json" | "graphviz" | "markdown";
  content: string;
  filename: string;
}

export function exportQuestChain(
  chain: QuestChain,
  format: "mermaid" | "json" | "graphviz" | "markdown",
  options?: MermaidOptions
): QuestChainExport {
  switch (format) {
    case "mermaid":
      return {
        format: "mermaid",
        content: generateMermaidDiagram(chain, options),
        filename: "quest_chain.mmd",
      };

    case "json":
      return {
        format: "json",
        content: JSON.stringify(chain, null, 2),
        filename: "quest_chain.json",
      };

    case "graphviz":
      const dotLines = ["digraph QuestChain {"];
      for (const quest of chain.quests) {
        dotLines.push(`  Q${quest.id} [label="${quest.title}"];`);
      }
      for (const dep of chain.dependencies) {
        dotLines.push(`  Q${dep.from} -> Q${dep.to};`);
      }
      dotLines.push("}");

      return {
        format: "graphviz",
        content: dotLines.join("\n"),
        filename: "quest_chain.dot",
      };

    case "markdown":
      const mdLines = ["# Quest Chain"];
      mdLines.push("");
      mdLines.push("## Quests");
      for (const quest of chain.quests) {
        mdLines.push(
          `- **${quest.title}** (ID: ${quest.id}, Level: ${quest.level})`
        );
      }
      mdLines.push("");
      mdLines.push("## Dependencies");
      for (const dep of chain.dependencies) {
        const from = chain.quests.find((q) => q.id === dep.from);
        const to = chain.quests.find((q) => q.id === dep.to);
        mdLines.push(`- ${from?.title} → ${to?.title} (${dep.type})`);
      }

      return {
        format: "markdown",
        content: mdLines.join("\n"),
        filename: "quest_chain.md",
      };
  }
}
