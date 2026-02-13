/**
 * Behavior Tree Data Model & Utilities
 *
 * Complete behavior tree system for TrinityCore PlayerBot AI editing.
 * Supports standard BT node types: Composite (Sequence, Selector, Parallel),
 * Decorator (Inverter, Repeater, Succeeder, UntilFail, Cooldown, Condition Guard),
 * and Leaf (Action, Condition) nodes.
 *
 * Features:
 * - Full type system with discriminated unions
 * - Structural validation (tree integrity, connectivity)
 * - Template library for common bot behaviors
 * - JSON serialization/deserialization with versioning
 * - Auto-layout algorithms for clean tree rendering
 *
 * @module lib/behavior-tree
 */

// ============================================================================
// Core Types
// ============================================================================

/** Categories of behavior tree nodes */
export type BTNodeCategory = "composite" | "decorator" | "leaf";

/** Specific node types within each category */
export type BTCompositeType = "sequence" | "selector" | "parallel";
export type BTDecoratorType =
  | "inverter"
  | "repeater"
  | "succeeder"
  | "until_fail"
  | "cooldown"
  | "condition_guard";
export type BTLeafType = "action" | "condition";
export type BTNodeType = BTCompositeType | BTDecoratorType | BTLeafType;

/** Execution status of a BT node */
export type BTStatus = "success" | "failure" | "running" | "idle";

/** Parallel node policy for success/failure determination */
export type ParallelPolicy = "require_all" | "require_one";

/** Condition comparison operators */
export type ConditionOperator = "==" | "!=" | ">" | "<" | ">=" | "<=" | "in" | "not_in";

// ============================================================================
// Node Parameter Definitions
// ============================================================================

/** Parameters specific to composite nodes */
export interface CompositeParams {
  /** For parallel: how many children must succeed */
  successPolicy?: ParallelPolicy;
  /** For parallel: how many children must fail to declare failure */
  failurePolicy?: ParallelPolicy;
}

/** Parameters specific to decorator nodes */
export interface DecoratorParams {
  /** For repeater: how many times to repeat (-1 = infinite) */
  repeatCount?: number;
  /** For cooldown: cooldown duration in milliseconds */
  cooldownMs?: number;
  /** For condition_guard: the condition expression to check */
  guardCondition?: string;
}

/** Parameters specific to action leaf nodes */
export interface ActionParams {
  /** The bot action to execute (e.g. "CastSpell", "MoveTo", "Loot") */
  actionType: string;
  /** Spell ID for spell-related actions */
  spellId?: number;
  /** Target type: "self", "enemy", "friendly", "ground", "pet" */
  targetType?: string;
  /** Target selection strategy: "nearest", "lowest_health", "highest_threat", "random" */
  targetStrategy?: string;
  /** Range in yards for range-sensitive actions */
  range?: number;
  /** Priority weight (higher = preferred) */
  priority?: number;
  /** Custom parameters as key-value pairs */
  customParams?: Record<string, string>;
}

/** Parameters specific to condition leaf nodes */
export interface ConditionParams {
  /** What to check: "health_pct", "mana_pct", "has_aura", "target_count", etc. */
  conditionType: string;
  /** Comparison operator */
  operator: ConditionOperator;
  /** Value to compare against */
  value: string;
  /** Check target: "self", "target", "pet", "group" */
  checkTarget?: string;
}

// ============================================================================
// Behavior Tree Node
// ============================================================================

/** A single node in the behavior tree */
export interface BTNode {
  /** Unique identifier */
  id: string;
  /** Display name */
  name: string;
  /** Node type */
  type: BTNodeType;
  /** Node category (derived from type) */
  category: BTNodeCategory;
  /** Human-readable description */
  description: string;
  /** Child node IDs (composites: multiple, decorators: exactly one, leaves: none) */
  children: string[];
  /** Parent node ID (null for root) */
  parentId: string | null;
  /** Position for visual editor */
  position: { x: number; y: number };
  /** Whether node is collapsed in the editor */
  collapsed: boolean;
  /** Whether node is disabled (skipped during execution) */
  disabled: boolean;
  /** Node-specific parameters */
  compositeParams?: CompositeParams;
  decoratorParams?: DecoratorParams;
  actionParams?: ActionParams;
  conditionParams?: ConditionParams;
  /** Optional comment/annotation */
  comment?: string;
}

// ============================================================================
// Behavior Tree Document
// ============================================================================

/** Complete behavior tree document for serialization */
export interface BehaviorTreeDocument {
  /** Document format version */
  version: number;
  /** Tree name */
  name: string;
  /** Human-readable description */
  description: string;
  /** Author name */
  author: string;
  /** Creation timestamp (ISO 8601) */
  createdAt: string;
  /** Last modification timestamp (ISO 8601) */
  modifiedAt: string;
  /** Bot class this tree is designed for (e.g. "Warrior", "Mage", "Any") */
  botClass: string;
  /** Bot specialization (e.g. "Arms", "Frost", "Any") */
  botSpec: string;
  /** Minimum bot level for this tree */
  minLevel: number;
  /** Maximum bot level for this tree */
  maxLevel: number;
  /** All nodes in the tree */
  nodes: BTNode[];
  /** Root node ID */
  rootId: string | null;
  /** Tags for categorization */
  tags: string[];
}

/** Current document version */
export const BT_DOCUMENT_VERSION = 1;

// ============================================================================
// Node Category Classification
// ============================================================================

const COMPOSITE_TYPES = new Set<BTNodeType>(["sequence", "selector", "parallel"] as const);
const DECORATOR_TYPES = new Set<BTNodeType>([
  "inverter",
  "repeater",
  "succeeder",
  "until_fail",
  "cooldown",
  "condition_guard",
] as const);
const LEAF_TYPES = new Set<BTNodeType>(["action", "condition"] as const);

/** Get the category of a node type */
export function getNodeCategory(type: BTNodeType): BTNodeCategory {
  if (COMPOSITE_TYPES.has(type)) return "composite";
  if (DECORATOR_TYPES.has(type)) return "decorator";
  return "leaf";
}

/** Check if a node type can have children */
export function canHaveChildren(type: BTNodeType): boolean {
  return COMPOSITE_TYPES.has(type) || DECORATOR_TYPES.has(type);
}

/** Get the maximum number of children a node type supports */
export function maxChildren(type: BTNodeType): number {
  if (COMPOSITE_TYPES.has(type)) return Infinity;
  if (DECORATOR_TYPES.has(type)) return 1;
  return 0;
}

// ============================================================================
// Node Visual Configuration
// ============================================================================

export interface NodeVisualConfig {
  label: string;
  description: string;
  color: string;
  borderColor: string;
  selectedBorderColor: string;
  icon: string;
  category: BTNodeCategory;
}

/** Visual configuration for each node type */
export const NODE_VISUALS: Record<BTNodeType, NodeVisualConfig> = {
  // Composites
  sequence: {
    label: "Sequence",
    description: "Executes children left-to-right. Fails on first failure.",
    color: "bg-blue-600",
    borderColor: "border-blue-700",
    selectedBorderColor: "border-blue-300",
    icon: "arrow-right",
    category: "composite",
  },
  selector: {
    label: "Selector",
    description: "Tries children left-to-right. Succeeds on first success.",
    color: "bg-purple-600",
    borderColor: "border-purple-700",
    selectedBorderColor: "border-purple-300",
    icon: "git-branch",
    category: "composite",
  },
  parallel: {
    label: "Parallel",
    description: "Executes all children simultaneously.",
    color: "bg-cyan-600",
    borderColor: "border-cyan-700",
    selectedBorderColor: "border-cyan-300",
    icon: "columns",
    category: "composite",
  },
  // Decorators
  inverter: {
    label: "Inverter",
    description: "Inverts the child's result (success ↔ failure).",
    color: "bg-amber-600",
    borderColor: "border-amber-700",
    selectedBorderColor: "border-amber-300",
    icon: "refresh-cw",
    category: "decorator",
  },
  repeater: {
    label: "Repeater",
    description: "Repeats child execution N times.",
    color: "bg-amber-600",
    borderColor: "border-amber-700",
    selectedBorderColor: "border-amber-300",
    icon: "repeat",
    category: "decorator",
  },
  succeeder: {
    label: "Succeeder",
    description: "Always returns success regardless of child result.",
    color: "bg-amber-600",
    borderColor: "border-amber-700",
    selectedBorderColor: "border-amber-300",
    icon: "check",
    category: "decorator",
  },
  until_fail: {
    label: "Until Fail",
    description: "Repeats child until it fails, then returns success.",
    color: "bg-amber-600",
    borderColor: "border-amber-700",
    selectedBorderColor: "border-amber-300",
    icon: "rotate-cw",
    category: "decorator",
  },
  cooldown: {
    label: "Cooldown",
    description: "Prevents child execution for a duration after last run.",
    color: "bg-amber-600",
    borderColor: "border-amber-700",
    selectedBorderColor: "border-amber-300",
    icon: "clock",
    category: "decorator",
  },
  condition_guard: {
    label: "Condition Guard",
    description: "Only executes child if guard condition is met.",
    color: "bg-amber-600",
    borderColor: "border-amber-700",
    selectedBorderColor: "border-amber-300",
    icon: "shield",
    category: "decorator",
  },
  // Leaves
  action: {
    label: "Action",
    description: "Executes a bot action (cast spell, move, loot, etc.).",
    color: "bg-green-600",
    borderColor: "border-green-700",
    selectedBorderColor: "border-green-300",
    icon: "play",
    category: "leaf",
  },
  condition: {
    label: "Condition",
    description: "Checks a condition (health, mana, aura, range, etc.).",
    color: "bg-red-500",
    borderColor: "border-red-600",
    selectedBorderColor: "border-red-300",
    icon: "help-circle",
    category: "leaf",
  },
};

// ============================================================================
// Node Factory
// ============================================================================

let nodeIdCounter = 0;

/** Generate a unique node ID */
export function generateNodeId(): string {
  return `bt_${Date.now()}_${++nodeIdCounter}`;
}

/** Reset the node ID counter (for testing) */
export function resetNodeIdCounter(): void {
  nodeIdCounter = 0;
}

/** Create a new node with defaults */
export function createNode(
  type: BTNodeType,
  overrides?: Partial<BTNode>
): BTNode {
  const visual = NODE_VISUALS[type];
  const category = getNodeCategory(type);
  const id = overrides?.id ?? generateNodeId();

  const node: BTNode = {
    id,
    name: overrides?.name ?? visual.label,
    type,
    category,
    description: overrides?.description ?? "",
    children: overrides?.children ?? [],
    parentId: overrides?.parentId ?? null,
    position: overrides?.position ?? { x: 0, y: 0 },
    collapsed: overrides?.collapsed ?? false,
    disabled: overrides?.disabled ?? false,
    comment: overrides?.comment,
  };

  // Add type-specific default params
  if (category === "composite") {
    node.compositeParams = overrides?.compositeParams ?? {
      successPolicy: type === "parallel" ? "require_all" : undefined,
      failurePolicy: type === "parallel" ? "require_one" : undefined,
    };
  } else if (category === "decorator") {
    node.decoratorParams = overrides?.decoratorParams ?? {
      repeatCount: type === "repeater" ? 3 : undefined,
      cooldownMs: type === "cooldown" ? 5000 : undefined,
      guardCondition: type === "condition_guard" ? "" : undefined,
    };
  } else if (type === "action") {
    node.actionParams = overrides?.actionParams ?? {
      actionType: "Idle",
      targetType: "self",
      priority: 50,
    };
  } else if (type === "condition") {
    node.conditionParams = overrides?.conditionParams ?? {
      conditionType: "health_pct",
      operator: ">",
      value: "50",
      checkTarget: "self",
    };
  }

  return node;
}

// ============================================================================
// Tree Operations
// ============================================================================

/** Find a node by ID */
export function findNode(nodes: BTNode[], id: string): BTNode | undefined {
  return nodes.find((n) => n.id === id);
}

/** Get all descendant IDs of a node (recursive) */
export function getDescendantIds(nodes: BTNode[], nodeId: string): string[] {
  const node = findNode(nodes, nodeId);
  if (!node) return [];

  const descendants: string[] = [];
  for (const childId of node.children) {
    descendants.push(childId);
    descendants.push(...getDescendantIds(nodes, childId));
  }
  return descendants;
}

/** Get the root node (node with no parent) */
export function findRootNode(nodes: BTNode[]): BTNode | undefined {
  return nodes.find((n) => n.parentId === null);
}

/** Remove a node and all its descendants */
export function removeNodeAndDescendants(
  nodes: BTNode[],
  nodeId: string
): BTNode[] {
  const idsToRemove = new Set([nodeId, ...getDescendantIds(nodes, nodeId)]);
  const node = findNode(nodes, nodeId);

  // Remove from parent's children list
  let result = nodes.filter((n) => !idsToRemove.has(n.id));
  if (node?.parentId) {
    result = result.map((n) => {
      if (n.id === node.parentId) {
        return { ...n, children: n.children.filter((c) => c !== nodeId) };
      }
      return n;
    });
  }

  return result;
}

/** Add a child node to a parent */
export function addChildNode(
  nodes: BTNode[],
  parentId: string,
  child: BTNode,
  insertIndex?: number
): BTNode[] {
  const parent = findNode(nodes, parentId);
  if (!parent) return nodes;

  const max = maxChildren(parent.type);
  if (parent.children.length >= max) return nodes;

  const childWithParent = { ...child, parentId };
  const updatedNodes = [...nodes, childWithParent];

  return updatedNodes.map((n) => {
    if (n.id === parentId) {
      const newChildren = [...n.children];
      if (insertIndex !== undefined && insertIndex >= 0) {
        newChildren.splice(insertIndex, 0, child.id);
      } else {
        newChildren.push(child.id);
      }
      return { ...n, children: newChildren };
    }
    return n;
  });
}

/** Move a node from one parent to another */
export function moveNode(
  nodes: BTNode[],
  nodeId: string,
  newParentId: string,
  insertIndex?: number
): BTNode[] {
  const node = findNode(nodes, nodeId);
  if (!node) return nodes;

  // Prevent moving to own descendant
  const descendantIds = getDescendantIds(nodes, nodeId);
  if (descendantIds.includes(newParentId) || nodeId === newParentId) {
    return nodes;
  }

  // Remove from old parent
  let result = nodes.map((n) => {
    if (n.id === node.parentId) {
      return { ...n, children: n.children.filter((c) => c !== nodeId) };
    }
    return n;
  });

  // Update parent reference
  result = result.map((n) => {
    if (n.id === nodeId) {
      return { ...n, parentId: newParentId };
    }
    return n;
  });

  // Add to new parent
  result = result.map((n) => {
    if (n.id === newParentId) {
      const newChildren = [...n.children];
      if (insertIndex !== undefined && insertIndex >= 0) {
        newChildren.splice(insertIndex, 0, nodeId);
      } else {
        newChildren.push(nodeId);
      }
      return { ...n, children: newChildren };
    }
    return n;
  });

  return result;
}

/** Reorder children of a node */
export function reorderChildren(
  nodes: BTNode[],
  parentId: string,
  fromIndex: number,
  toIndex: number
): BTNode[] {
  return nodes.map((n) => {
    if (n.id === parentId) {
      const newChildren = [...n.children];
      const [moved] = newChildren.splice(fromIndex, 1);
      newChildren.splice(toIndex, 0, moved);
      return { ...n, children: newChildren };
    }
    return n;
  });
}

// ============================================================================
// Validation
// ============================================================================

export interface ValidationError {
  nodeId: string;
  severity: "error" | "warning";
  message: string;
}

/** Validate a behavior tree document */
export function validateTree(doc: BehaviorTreeDocument): ValidationError[] {
  const errors: ValidationError[] = [];
  const nodeMap = new Map(doc.nodes.map((n) => [n.id, n]));

  // Check root exists
  if (!doc.rootId) {
    errors.push({
      nodeId: "",
      severity: "error",
      message: "Tree has no root node.",
    });
    return errors;
  }

  const root = nodeMap.get(doc.rootId);
  if (!root) {
    errors.push({
      nodeId: doc.rootId,
      severity: "error",
      message: "Root node ID does not reference a valid node.",
    });
    return errors;
  }

  if (root.parentId !== null) {
    errors.push({
      nodeId: root.id,
      severity: "error",
      message: "Root node must have no parent.",
    });
  }

  // Validate each node
  for (const node of doc.nodes) {
    // Check parent reference
    if (node.parentId !== null && !nodeMap.has(node.parentId)) {
      errors.push({
        nodeId: node.id,
        severity: "error",
        message: `Parent "${node.parentId}" does not exist.`,
      });
    }

    // Check children references
    for (const childId of node.children) {
      const child = nodeMap.get(childId);
      if (!child) {
        errors.push({
          nodeId: node.id,
          severity: "error",
          message: `Child "${childId}" does not exist.`,
        });
      } else if (child.parentId !== node.id) {
        errors.push({
          nodeId: node.id,
          severity: "error",
          message: `Child "${childId}" has mismatched parent reference.`,
        });
      }
    }

    // Check category constraints
    const category = getNodeCategory(node.type);

    if (category === "leaf" && node.children.length > 0) {
      errors.push({
        nodeId: node.id,
        severity: "error",
        message: `Leaf node "${node.name}" should not have children.`,
      });
    }

    if (category === "decorator" && node.children.length > 1) {
      errors.push({
        nodeId: node.id,
        severity: "error",
        message: `Decorator "${node.name}" must have at most 1 child, has ${node.children.length}.`,
      });
    }

    // Warnings for incomplete nodes
    if (category === "composite" && node.children.length === 0 && !node.disabled) {
      errors.push({
        nodeId: node.id,
        severity: "warning",
        message: `Composite "${node.name}" has no children.`,
      });
    }

    if (category === "decorator" && node.children.length === 0 && !node.disabled) {
      errors.push({
        nodeId: node.id,
        severity: "warning",
        message: `Decorator "${node.name}" has no child.`,
      });
    }

    // Action-specific validation
    if (node.type === "action" && node.actionParams) {
      if (!node.actionParams.actionType || node.actionParams.actionType === "Idle") {
        errors.push({
          nodeId: node.id,
          severity: "warning",
          message: `Action "${node.name}" has no action type configured.`,
        });
      }
      if (node.actionParams.actionType === "CastSpell" && !node.actionParams.spellId) {
        errors.push({
          nodeId: node.id,
          severity: "warning",
          message: `Action "${node.name}" uses CastSpell but has no spell ID.`,
        });
      }
    }

    // Condition-specific validation
    if (node.type === "condition" && node.conditionParams) {
      if (!node.conditionParams.value || node.conditionParams.value.trim() === "") {
        errors.push({
          nodeId: node.id,
          severity: "warning",
          message: `Condition "${node.name}" has no comparison value.`,
        });
      }
    }

    // Cooldown-specific validation
    if (node.type === "cooldown" && node.decoratorParams) {
      if (!node.decoratorParams.cooldownMs || node.decoratorParams.cooldownMs <= 0) {
        errors.push({
          nodeId: node.id,
          severity: "warning",
          message: `Cooldown "${node.name}" has no duration set.`,
        });
      }
    }
  }

  // Check for cycles (BFS reachability from root)
  const visited = new Set<string>();
  const queue = [doc.rootId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) {
      errors.push({
        nodeId: current,
        severity: "error",
        message: "Cycle detected in tree.",
      });
      break;
    }
    visited.add(current);
    const node = nodeMap.get(current);
    if (node) {
      queue.push(...node.children);
    }
  }

  // Check for orphaned nodes (not reachable from root)
  for (const node of doc.nodes) {
    if (!visited.has(node.id) && node.id !== doc.rootId) {
      errors.push({
        nodeId: node.id,
        severity: "warning",
        message: `Node "${node.name}" is not reachable from root (orphaned).`,
      });
    }
  }

  return errors;
}

// ============================================================================
// Auto Layout
// ============================================================================

/** Layout configuration */
export interface LayoutConfig {
  /** Horizontal spacing between siblings */
  horizontalGap: number;
  /** Vertical spacing between parent and children */
  verticalGap: number;
  /** Width of a single node */
  nodeWidth: number;
  /** Height of a single node */
  nodeHeight: number;
}

const DEFAULT_LAYOUT: LayoutConfig = {
  horizontalGap: 40,
  verticalGap: 80,
  nodeWidth: 220,
  nodeHeight: 80,
};

/** Calculate the subtree width for a node */
function subtreeWidth(
  nodes: BTNode[],
  nodeId: string,
  config: LayoutConfig
): number {
  const node = findNode(nodes, nodeId);
  if (!node || node.children.length === 0 || node.collapsed) {
    return config.nodeWidth;
  }

  let totalWidth = 0;
  for (let i = 0; i < node.children.length; i++) {
    if (i > 0) totalWidth += config.horizontalGap;
    totalWidth += subtreeWidth(nodes, node.children[i], config);
  }

  return Math.max(config.nodeWidth, totalWidth);
}

/** Auto-layout a behavior tree (top-down layout) */
export function autoLayoutTree(
  nodes: BTNode[],
  rootId: string,
  config: LayoutConfig = DEFAULT_LAYOUT,
  startX: number = 0,
  startY: number = 0
): BTNode[] {
  const nodeMap = new Map(nodes.map((n) => [n.id, { ...n }]));

  function layoutSubtree(nodeId: string, x: number, y: number): void {
    const node = nodeMap.get(nodeId);
    if (!node) return;

    const totalWidth = subtreeWidth(nodes, nodeId, config);
    node.position = {
      x: x + totalWidth / 2 - config.nodeWidth / 2,
      y,
    };

    if (node.children.length === 0 || node.collapsed) return;

    let childX = x;
    for (const childId of node.children) {
      const childWidth = subtreeWidth(nodes, childId, config);
      layoutSubtree(childId, childX, y + config.nodeHeight + config.verticalGap);
      childX += childWidth + config.horizontalGap;
    }
  }

  layoutSubtree(rootId, startX, startY);

  return nodes.map((n) => {
    const updated = nodeMap.get(n.id);
    return updated ?? n;
  });
}

// ============================================================================
// Serialization
// ============================================================================

/** Create a new empty behavior tree document */
export function createEmptyDocument(name?: string): BehaviorTreeDocument {
  const now = new Date().toISOString();
  return {
    version: BT_DOCUMENT_VERSION,
    name: name ?? "Untitled Behavior Tree",
    description: "",
    author: "",
    createdAt: now,
    modifiedAt: now,
    botClass: "Any",
    botSpec: "Any",
    minLevel: 1,
    maxLevel: 90,
    nodes: [],
    rootId: null,
    tags: [],
  };
}

/** Serialize a document to JSON string */
export function serializeDocument(doc: BehaviorTreeDocument): string {
  const updated = {
    ...doc,
    modifiedAt: new Date().toISOString(),
  };
  return JSON.stringify(updated, null, 2);
}

/** Deserialize a JSON string to a document */
export function deserializeDocument(json: string): BehaviorTreeDocument {
  const parsed = JSON.parse(json);

  if (!parsed.version || typeof parsed.version !== "number") {
    throw new Error("Invalid behavior tree document: missing version.");
  }

  if (parsed.version > BT_DOCUMENT_VERSION) {
    throw new Error(
      `Document version ${parsed.version} is newer than supported version ${BT_DOCUMENT_VERSION}.`
    );
  }

  if (!Array.isArray(parsed.nodes)) {
    throw new Error("Invalid behavior tree document: nodes must be an array.");
  }

  return parsed as BehaviorTreeDocument;
}

// ============================================================================
// Bot Action Types (for Action node dropdown)
// ============================================================================

export interface BotActionDef {
  value: string;
  label: string;
  description: string;
  requiresSpellId: boolean;
  requiresTarget: boolean;
  category: string;
}

export const BOT_ACTION_TYPES: BotActionDef[] = [
  // Combat
  { value: "CastSpell", label: "Cast Spell", description: "Cast a spell by ID", requiresSpellId: true, requiresTarget: true, category: "Combat" },
  { value: "AutoAttack", label: "Auto Attack", description: "Begin auto-attacking current target", requiresSpellId: false, requiresTarget: true, category: "Combat" },
  { value: "StopAttack", label: "Stop Attack", description: "Stop auto-attacking", requiresSpellId: false, requiresTarget: false, category: "Combat" },
  { value: "Flee", label: "Flee", description: "Run away from current enemy", requiresSpellId: false, requiresTarget: false, category: "Combat" },
  { value: "UseItem", label: "Use Item", description: "Use an item from inventory", requiresSpellId: false, requiresTarget: false, category: "Combat" },
  { value: "UseHealthPotion", label: "Use Health Potion", description: "Use highest available health potion", requiresSpellId: false, requiresTarget: false, category: "Combat" },
  { value: "UseManaPotion", label: "Use Mana Potion", description: "Use highest available mana potion", requiresSpellId: false, requiresTarget: false, category: "Combat" },

  // Movement
  { value: "MoveTo", label: "Move To", description: "Move to a specific position", requiresSpellId: false, requiresTarget: false, category: "Movement" },
  { value: "Follow", label: "Follow", description: "Follow the group leader", requiresSpellId: false, requiresTarget: true, category: "Movement" },
  { value: "Stay", label: "Stay", description: "Stay at current position", requiresSpellId: false, requiresTarget: false, category: "Movement" },
  { value: "Patrol", label: "Patrol", description: "Patrol a waypoint path", requiresSpellId: false, requiresTarget: false, category: "Movement" },
  { value: "MoveToTarget", label: "Move To Target", description: "Move towards current target", requiresSpellId: false, requiresTarget: true, category: "Movement" },
  { value: "Kite", label: "Kite", description: "Maintain distance from melee target", requiresSpellId: false, requiresTarget: true, category: "Movement" },

  // Interaction
  { value: "Loot", label: "Loot", description: "Loot nearby corpses", requiresSpellId: false, requiresTarget: false, category: "Interaction" },
  { value: "Gather", label: "Gather", description: "Gather nearby resource nodes", requiresSpellId: false, requiresTarget: false, category: "Interaction" },
  { value: "Interact", label: "Interact", description: "Interact with NPC/object", requiresSpellId: false, requiresTarget: true, category: "Interaction" },
  { value: "AcceptQuest", label: "Accept Quest", description: "Accept available quest from NPC", requiresSpellId: false, requiresTarget: true, category: "Interaction" },
  { value: "TurnInQuest", label: "Turn In Quest", description: "Turn in completed quest", requiresSpellId: false, requiresTarget: true, category: "Interaction" },
  { value: "BuyFromVendor", label: "Buy From Vendor", description: "Buy items from vendor NPC", requiresSpellId: false, requiresTarget: true, category: "Interaction" },
  { value: "SellToVendor", label: "Sell To Vendor", description: "Sell items to vendor NPC", requiresSpellId: false, requiresTarget: true, category: "Interaction" },
  { value: "Repair", label: "Repair", description: "Repair equipment at repair vendor", requiresSpellId: false, requiresTarget: true, category: "Interaction" },

  // Group
  { value: "Heal", label: "Heal", description: "Heal a group member", requiresSpellId: true, requiresTarget: true, category: "Group" },
  { value: "Buff", label: "Buff", description: "Apply a buff to group member", requiresSpellId: true, requiresTarget: true, category: "Group" },
  { value: "Resurrect", label: "Resurrect", description: "Resurrect a dead group member", requiresSpellId: true, requiresTarget: true, category: "Group" },
  { value: "Dispel", label: "Dispel", description: "Remove debuffs from ally", requiresSpellId: true, requiresTarget: true, category: "Group" },
  { value: "Tank", label: "Tank", description: "Generate threat and position as tank", requiresSpellId: false, requiresTarget: true, category: "Group" },
  { value: "AssistTank", label: "Assist Tank", description: "Attack tank's target", requiresSpellId: false, requiresTarget: true, category: "Group" },

  // Utility
  { value: "Idle", label: "Idle", description: "Do nothing for a tick", requiresSpellId: false, requiresTarget: false, category: "Utility" },
  { value: "Wait", label: "Wait", description: "Wait for a duration", requiresSpellId: false, requiresTarget: false, category: "Utility" },
  { value: "Emote", label: "Emote", description: "Play an emote animation", requiresSpellId: false, requiresTarget: false, category: "Utility" },
  { value: "Say", label: "Say", description: "Speak a message", requiresSpellId: false, requiresTarget: false, category: "Utility" },
  { value: "EquipBestGear", label: "Equip Best Gear", description: "Equip best available gear from bags", requiresSpellId: false, requiresTarget: false, category: "Utility" },
  { value: "Eat", label: "Eat", description: "Eat food to restore health", requiresSpellId: false, requiresTarget: false, category: "Utility" },
  { value: "Drink", label: "Drink", description: "Drink to restore mana", requiresSpellId: false, requiresTarget: false, category: "Utility" },
];

// ============================================================================
// Condition Types (for Condition node dropdown)
// ============================================================================

export interface BotConditionDef {
  value: string;
  label: string;
  description: string;
  operators: ConditionOperator[];
  valueHint: string;
  category: string;
}

export const BOT_CONDITION_TYPES: BotConditionDef[] = [
  // Health/Resources
  { value: "health_pct", label: "Health %", description: "Current health percentage", operators: ["==", "!=", ">", "<", ">=", "<="], valueHint: "0-100", category: "Resources" },
  { value: "mana_pct", label: "Mana %", description: "Current mana percentage", operators: ["==", "!=", ">", "<", ">=", "<="], valueHint: "0-100", category: "Resources" },
  { value: "rage", label: "Rage", description: "Current rage amount", operators: ["==", "!=", ">", "<", ">=", "<="], valueHint: "0-100", category: "Resources" },
  { value: "energy", label: "Energy", description: "Current energy amount", operators: ["==", "!=", ">", "<", ">=", "<="], valueHint: "0-100", category: "Resources" },
  { value: "combo_points", label: "Combo Points", description: "Current combo points", operators: ["==", "!=", ">", "<", ">=", "<="], valueHint: "0-5", category: "Resources" },
  { value: "runic_power", label: "Runic Power", description: "Current runic power", operators: ["==", "!=", ">", "<", ">=", "<="], valueHint: "0-100", category: "Resources" },

  // Target
  { value: "has_target", label: "Has Target", description: "Whether a target is selected", operators: ["=="], valueHint: "true/false", category: "Target" },
  { value: "target_health_pct", label: "Target Health %", description: "Target's health percentage", operators: ["==", "!=", ">", "<", ">=", "<="], valueHint: "0-100", category: "Target" },
  { value: "target_distance", label: "Target Distance", description: "Distance to current target in yards", operators: [">", "<", ">=", "<="], valueHint: "yards", category: "Target" },
  { value: "target_is_casting", label: "Target Casting", description: "Whether target is casting a spell", operators: ["=="], valueHint: "true/false", category: "Target" },
  { value: "target_count", label: "Target Count", description: "Number of enemies in combat", operators: ["==", "!=", ">", "<", ">=", "<="], valueHint: "number", category: "Target" },
  { value: "target_type", label: "Target Type", description: "Type of current target", operators: ["==", "!="], valueHint: "player/creature/pet", category: "Target" },

  // Auras
  { value: "has_aura", label: "Has Aura", description: "Whether a specific aura/buff is active", operators: ["=="], valueHint: "spell ID", category: "Auras" },
  { value: "aura_stacks", label: "Aura Stacks", description: "Number of stacks of an aura", operators: ["==", "!=", ">", "<", ">=", "<="], valueHint: "spell ID:stacks", category: "Auras" },
  { value: "target_has_aura", label: "Target Has Aura", description: "Whether target has a specific aura", operators: ["=="], valueHint: "spell ID", category: "Auras" },

  // Combat state
  { value: "in_combat", label: "In Combat", description: "Whether currently in combat", operators: ["=="], valueHint: "true/false", category: "Combat State" },
  { value: "is_moving", label: "Is Moving", description: "Whether currently moving", operators: ["=="], valueHint: "true/false", category: "Combat State" },
  { value: "is_casting", label: "Is Casting", description: "Whether currently casting a spell", operators: ["=="], valueHint: "true/false", category: "Combat State" },
  { value: "spell_ready", label: "Spell Ready", description: "Whether a spell is off cooldown", operators: ["=="], valueHint: "spell ID", category: "Combat State" },
  { value: "gcd_ready", label: "GCD Ready", description: "Whether global cooldown is ready", operators: ["=="], valueHint: "true/false", category: "Combat State" },

  // Group
  { value: "group_size", label: "Group Size", description: "Number of members in group", operators: ["==", "!=", ">", "<", ">=", "<="], valueHint: "1-40", category: "Group" },
  { value: "group_health_avg", label: "Group Avg Health %", description: "Average health of group members", operators: [">", "<", ">=", "<="], valueHint: "0-100", category: "Group" },
  { value: "group_member_dead", label: "Group Member Dead", description: "Whether any group member is dead", operators: ["=="], valueHint: "true/false", category: "Group" },
  { value: "tank_health_pct", label: "Tank Health %", description: "Tank's health percentage", operators: [">", "<", ">=", "<="], valueHint: "0-100", category: "Group" },

  // Environment
  { value: "is_indoors", label: "Is Indoors", description: "Whether in indoor environment", operators: ["=="], valueHint: "true/false", category: "Environment" },
  { value: "is_underwater", label: "Is Underwater", description: "Whether underwater", operators: ["=="], valueHint: "true/false", category: "Environment" },
  { value: "zone_id", label: "Zone ID", description: "Current zone identifier", operators: ["==", "!=", "in"], valueHint: "zone ID", category: "Environment" },
  { value: "map_id", label: "Map ID", description: "Current map identifier", operators: ["==", "!="], valueHint: "map ID", category: "Environment" },
];

// ============================================================================
// Template Library
// ============================================================================

export interface BTTemplate {
  name: string;
  description: string;
  botClass: string;
  tags: string[];
  build: () => { nodes: BTNode[]; rootId: string };
}

/** Build a simple combat rotation template */
function buildSimpleCombatRotation(): { nodes: BTNode[]; rootId: string } {
  const root = createNode("selector", { id: "root", name: "Combat Root" });
  const combatSeq = createNode("sequence", {
    id: "combat_seq",
    name: "Combat Sequence",
    parentId: "root",
  });
  const idleAction = createNode("action", {
    id: "idle_action",
    name: "Idle",
    parentId: "root",
    actionParams: { actionType: "Idle", targetType: "self", priority: 1 },
  });

  const inCombat = createNode("condition", {
    id: "check_combat",
    name: "In Combat?",
    parentId: "combat_seq",
    conditionParams: { conditionType: "in_combat", operator: "==", value: "true", checkTarget: "self" },
  });
  const attackAction = createNode("action", {
    id: "auto_attack",
    name: "Auto Attack",
    parentId: "combat_seq",
    actionParams: { actionType: "AutoAttack", targetType: "enemy", targetStrategy: "nearest", priority: 50 },
  });

  root.children = ["combat_seq", "idle_action"];
  combatSeq.children = ["check_combat", "auto_attack"];

  return {
    nodes: [root, combatSeq, idleAction, inCombat, attackAction],
    rootId: "root",
  };
}

/** Build a healer priority template */
function buildHealerPriority(): { nodes: BTNode[]; rootId: string } {
  const root = createNode("selector", { id: "root", name: "Healer Root" });
  const emergencySeq = createNode("sequence", {
    id: "emergency",
    name: "Emergency Heal",
    parentId: "root",
  });
  const normalSeq = createNode("sequence", {
    id: "normal_heal",
    name: "Normal Healing",
    parentId: "root",
  });
  const dpsSeq = createNode("sequence", {
    id: "dps_filler",
    name: "DPS Filler",
    parentId: "root",
  });

  const tankLow = createNode("condition", {
    id: "tank_low",
    name: "Tank Below 30%?",
    parentId: "emergency",
    conditionParams: { conditionType: "tank_health_pct", operator: "<", value: "30", checkTarget: "group" },
  });
  const bigHeal = createNode("action", {
    id: "big_heal",
    name: "Emergency Heal",
    parentId: "emergency",
    actionParams: { actionType: "Heal", targetType: "friendly", targetStrategy: "lowest_health", spellId: 0, priority: 100 },
  });

  const groupDamaged = createNode("condition", {
    id: "group_damaged",
    name: "Group Below 80%?",
    parentId: "normal_heal",
    conditionParams: { conditionType: "group_health_avg", operator: "<", value: "80", checkTarget: "group" },
  });
  const normalHealAction = createNode("action", {
    id: "normal_heal_action",
    name: "Heal Lowest",
    parentId: "normal_heal",
    actionParams: { actionType: "Heal", targetType: "friendly", targetStrategy: "lowest_health", spellId: 0, priority: 70 },
  });

  const inCombat = createNode("condition", {
    id: "dps_combat",
    name: "In Combat?",
    parentId: "dps_filler",
    conditionParams: { conditionType: "in_combat", operator: "==", value: "true", checkTarget: "self" },
  });
  const dpsAction = createNode("action", {
    id: "dps_action",
    name: "DPS Filler",
    parentId: "dps_filler",
    actionParams: { actionType: "CastSpell", targetType: "enemy", targetStrategy: "nearest", spellId: 0, priority: 20 },
  });

  root.children = ["emergency", "normal_heal", "dps_filler"];
  emergencySeq.children = ["tank_low", "big_heal"];
  normalSeq.children = ["group_damaged", "normal_heal_action"];
  dpsSeq.children = ["dps_combat", "dps_action"];

  return {
    nodes: [root, emergencySeq, normalSeq, dpsSeq, tankLow, bigHeal, groupDamaged, normalHealAction, inCombat, dpsAction],
    rootId: "root",
  };
}

/** Build a resource management template */
function buildResourceManagement(): { nodes: BTNode[]; rootId: string } {
  const root = createNode("selector", { id: "root", name: "Resource Management" });
  const eatSeq = createNode("sequence", {
    id: "eat_seq",
    name: "Eat When Low HP",
    parentId: "root",
  });
  const drinkSeq = createNode("sequence", {
    id: "drink_seq",
    name: "Drink When Low Mana",
    parentId: "root",
  });

  const outOfCombat = createNode("condition", {
    id: "ooc_check",
    name: "Out of Combat?",
    parentId: "eat_seq",
    conditionParams: { conditionType: "in_combat", operator: "==", value: "false", checkTarget: "self" },
  });
  const healthLow = createNode("condition", {
    id: "hp_low",
    name: "Health < 60%?",
    parentId: "eat_seq",
    conditionParams: { conditionType: "health_pct", operator: "<", value: "60", checkTarget: "self" },
  });
  const eatAction = createNode("action", {
    id: "eat_action",
    name: "Eat Food",
    parentId: "eat_seq",
    actionParams: { actionType: "Eat", targetType: "self", priority: 80 },
  });

  const outOfCombat2 = createNode("condition", {
    id: "ooc_check_2",
    name: "Out of Combat?",
    parentId: "drink_seq",
    conditionParams: { conditionType: "in_combat", operator: "==", value: "false", checkTarget: "self" },
  });
  const manaLow = createNode("condition", {
    id: "mana_low",
    name: "Mana < 40%?",
    parentId: "drink_seq",
    conditionParams: { conditionType: "mana_pct", operator: "<", value: "40", checkTarget: "self" },
  });
  const drinkAction = createNode("action", {
    id: "drink_action",
    name: "Drink Water",
    parentId: "drink_seq",
    actionParams: { actionType: "Drink", targetType: "self", priority: 80 },
  });

  root.children = ["eat_seq", "drink_seq"];
  eatSeq.children = ["ooc_check", "hp_low", "eat_action"];
  drinkSeq.children = ["ooc_check_2", "mana_low", "drink_action"];

  return {
    nodes: [root, eatSeq, drinkSeq, outOfCombat, healthLow, eatAction, outOfCombat2, manaLow, drinkAction],
    rootId: "root",
  };
}

export const BT_TEMPLATES: BTTemplate[] = [
  {
    name: "Simple Combat Rotation",
    description: "Basic combat: check if in combat → auto attack, otherwise idle.",
    botClass: "Any",
    tags: ["combat", "basic"],
    build: buildSimpleCombatRotation,
  },
  {
    name: "Healer Priority",
    description: "Emergency heal tank → heal lowest group member → DPS filler.",
    botClass: "Healer",
    tags: ["healer", "group", "combat"],
    build: buildHealerPriority,
  },
  {
    name: "Resource Management",
    description: "Out-of-combat eating and drinking when health/mana is low.",
    botClass: "Any",
    tags: ["utility", "resources", "basic"],
    build: buildResourceManagement,
  },
];
