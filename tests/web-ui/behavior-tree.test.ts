/**
 * Tests for Behavior Tree Data Model & Utilities
 *
 * Verifies:
 * - Node creation with correct defaults for all 11 node types
 * - Node category classification (composite, decorator, leaf)
 * - Tree operations (add child, remove, move, reorder)
 * - Validation (structural integrity, constraint checking, cycle detection)
 * - Auto-layout algorithm
 * - Serialization/deserialization with versioning
 * - Template library correctness
 * - Edge cases and error conditions
 *
 * @module tests/web-ui/behavior-tree
 */

import {
  type BTNode,
  type BTNodeType,
  type BehaviorTreeDocument,
  type ValidationError,
  getNodeCategory,
  canHaveChildren,
  maxChildren,
  NODE_VISUALS,
  createNode,
  generateNodeId,
  resetNodeIdCounter,
  findNode,
  getDescendantIds,
  findRootNode,
  removeNodeAndDescendants,
  addChildNode,
  moveNode,
  reorderChildren,
  validateTree,
  autoLayoutTree,
  createEmptyDocument,
  serializeDocument,
  deserializeDocument,
  BT_DOCUMENT_VERSION,
  BT_TEMPLATES,
  BOT_ACTION_TYPES,
  BOT_CONDITION_TYPES,
} from '../../web-ui/lib/behavior-tree';

// Reset ID counter before each test for determinism
beforeEach(() => {
  resetNodeIdCounter();
});

// ============================================================================
// Node Category Classification
// ============================================================================

describe('getNodeCategory()', () => {
  it('should classify composite types correctly', () => {
    expect(getNodeCategory('sequence')).toBe('composite');
    expect(getNodeCategory('selector')).toBe('composite');
    expect(getNodeCategory('parallel')).toBe('composite');
  });

  it('should classify decorator types correctly', () => {
    expect(getNodeCategory('inverter')).toBe('decorator');
    expect(getNodeCategory('repeater')).toBe('decorator');
    expect(getNodeCategory('succeeder')).toBe('decorator');
    expect(getNodeCategory('until_fail')).toBe('decorator');
    expect(getNodeCategory('cooldown')).toBe('decorator');
    expect(getNodeCategory('condition_guard')).toBe('decorator');
  });

  it('should classify leaf types correctly', () => {
    expect(getNodeCategory('action')).toBe('leaf');
    expect(getNodeCategory('condition')).toBe('leaf');
  });
});

describe('canHaveChildren()', () => {
  it('should return true for composite and decorator types', () => {
    expect(canHaveChildren('sequence')).toBe(true);
    expect(canHaveChildren('selector')).toBe(true);
    expect(canHaveChildren('parallel')).toBe(true);
    expect(canHaveChildren('inverter')).toBe(true);
    expect(canHaveChildren('repeater')).toBe(true);
  });

  it('should return false for leaf types', () => {
    expect(canHaveChildren('action')).toBe(false);
    expect(canHaveChildren('condition')).toBe(false);
  });
});

describe('maxChildren()', () => {
  it('should return Infinity for composite types', () => {
    expect(maxChildren('sequence')).toBe(Infinity);
    expect(maxChildren('selector')).toBe(Infinity);
    expect(maxChildren('parallel')).toBe(Infinity);
  });

  it('should return 1 for decorator types', () => {
    expect(maxChildren('inverter')).toBe(1);
    expect(maxChildren('repeater')).toBe(1);
    expect(maxChildren('cooldown')).toBe(1);
    expect(maxChildren('condition_guard')).toBe(1);
  });

  it('should return 0 for leaf types', () => {
    expect(maxChildren('action')).toBe(0);
    expect(maxChildren('condition')).toBe(0);
  });
});

// ============================================================================
// Node Visual Configuration
// ============================================================================

describe('NODE_VISUALS', () => {
  it('should have configuration for all 11 node types', () => {
    const allTypes: BTNodeType[] = [
      'sequence', 'selector', 'parallel',
      'inverter', 'repeater', 'succeeder', 'until_fail', 'cooldown', 'condition_guard',
      'action', 'condition',
    ];
    for (const type of allTypes) {
      expect(NODE_VISUALS[type]).toBeDefined();
      expect(NODE_VISUALS[type].label).toBeTruthy();
      expect(NODE_VISUALS[type].description).toBeTruthy();
      expect(NODE_VISUALS[type].color).toBeTruthy();
      expect(NODE_VISUALS[type].icon).toBeTruthy();
      expect(NODE_VISUALS[type].category).toBe(getNodeCategory(type));
    }
  });
});

// ============================================================================
// Node Creation
// ============================================================================

describe('createNode()', () => {
  it('should create a sequence node with correct defaults', () => {
    const node = createNode('sequence');
    expect(node.type).toBe('sequence');
    expect(node.category).toBe('composite');
    expect(node.name).toBe('Sequence');
    expect(node.children).toEqual([]);
    expect(node.parentId).toBeNull();
    expect(node.collapsed).toBe(false);
    expect(node.disabled).toBe(false);
    expect(node.compositeParams).toBeDefined();
  });

  it('should create a selector node with correct defaults', () => {
    const node = createNode('selector');
    expect(node.type).toBe('selector');
    expect(node.category).toBe('composite');
  });

  it('should create a parallel node with policy params', () => {
    const node = createNode('parallel');
    expect(node.type).toBe('parallel');
    expect(node.compositeParams?.successPolicy).toBe('require_all');
    expect(node.compositeParams?.failurePolicy).toBe('require_one');
  });

  it('should create a repeater with default repeat count', () => {
    const node = createNode('repeater');
    expect(node.type).toBe('repeater');
    expect(node.category).toBe('decorator');
    expect(node.decoratorParams?.repeatCount).toBe(3);
  });

  it('should create a cooldown with default duration', () => {
    const node = createNode('cooldown');
    expect(node.decoratorParams?.cooldownMs).toBe(5000);
  });

  it('should create a condition_guard with empty guard', () => {
    const node = createNode('condition_guard');
    expect(node.decoratorParams?.guardCondition).toBe('');
  });

  it('should create an action with default Idle action', () => {
    const node = createNode('action');
    expect(node.type).toBe('action');
    expect(node.category).toBe('leaf');
    expect(node.actionParams?.actionType).toBe('Idle');
    expect(node.actionParams?.targetType).toBe('self');
    expect(node.actionParams?.priority).toBe(50);
  });

  it('should create a condition with default health_pct check', () => {
    const node = createNode('condition');
    expect(node.type).toBe('condition');
    expect(node.category).toBe('leaf');
    expect(node.conditionParams?.conditionType).toBe('health_pct');
    expect(node.conditionParams?.operator).toBe('>');
    expect(node.conditionParams?.value).toBe('50');
    expect(node.conditionParams?.checkTarget).toBe('self');
  });

  it('should allow overriding defaults', () => {
    const node = createNode('action', {
      id: 'custom_id',
      name: 'Cast Fireball',
      description: 'Casts fireball at enemy',
      actionParams: { actionType: 'CastSpell', spellId: 133, targetType: 'enemy', priority: 80 },
    });
    expect(node.id).toBe('custom_id');
    expect(node.name).toBe('Cast Fireball');
    expect(node.description).toBe('Casts fireball at enemy');
    expect(node.actionParams?.spellId).toBe(133);
    expect(node.actionParams?.priority).toBe(80);
  });

  it('should generate unique IDs', () => {
    const n1 = createNode('action');
    const n2 = createNode('action');
    expect(n1.id).not.toBe(n2.id);
  });
});

describe('generateNodeId()', () => {
  it('should generate unique IDs', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      ids.add(generateNodeId());
    }
    expect(ids.size).toBe(100);
  });

  it('should start with bt_ prefix', () => {
    const id = generateNodeId();
    expect(id.startsWith('bt_')).toBe(true);
  });
});

// ============================================================================
// Tree Operations
// ============================================================================

describe('findNode()', () => {
  const nodes = [
    createNode('selector', { id: 'root' }),
    createNode('action', { id: 'child1' }),
    createNode('condition', { id: 'child2' }),
  ];

  it('should find existing nodes', () => {
    expect(findNode(nodes, 'root')?.id).toBe('root');
    expect(findNode(nodes, 'child1')?.type).toBe('action');
  });

  it('should return undefined for non-existent IDs', () => {
    expect(findNode(nodes, 'nonexistent')).toBeUndefined();
  });

  it('should return undefined for empty array', () => {
    expect(findNode([], 'root')).toBeUndefined();
  });
});

describe('findRootNode()', () => {
  it('should find the node with null parentId', () => {
    const nodes = [
      createNode('selector', { id: 'root', parentId: null }),
      createNode('action', { id: 'child', parentId: 'root' }),
    ];
    expect(findRootNode(nodes)?.id).toBe('root');
  });

  it('should return undefined when all nodes have parents', () => {
    const nodes = [
      createNode('action', { id: 'a', parentId: 'b' }),
      createNode('action', { id: 'b', parentId: 'a' }),
    ];
    expect(findRootNode(nodes)).toBeUndefined();
  });
});

describe('getDescendantIds()', () => {
  it('should return all descendants recursively', () => {
    const root = createNode('selector', { id: 'root', children: ['a', 'b'] });
    const a = createNode('sequence', { id: 'a', parentId: 'root', children: ['c'] });
    const b = createNode('action', { id: 'b', parentId: 'root' });
    const c = createNode('action', { id: 'c', parentId: 'a' });

    const descendants = getDescendantIds([root, a, b, c], 'root');
    expect(descendants).toContain('a');
    expect(descendants).toContain('b');
    expect(descendants).toContain('c');
    expect(descendants.length).toBe(3);
  });

  it('should return empty array for leaf nodes', () => {
    const leaf = createNode('action', { id: 'leaf' });
    expect(getDescendantIds([leaf], 'leaf')).toEqual([]);
  });

  it('should return empty array for non-existent node', () => {
    expect(getDescendantIds([], 'missing')).toEqual([]);
  });
});

describe('addChildNode()', () => {
  it('should add child to parent and update both', () => {
    const parent = createNode('selector', { id: 'root' });
    const child = createNode('action', { id: 'child' });
    const result = addChildNode([parent], 'root', child);

    const updatedParent = findNode(result, 'root');
    const addedChild = findNode(result, 'child');
    expect(updatedParent?.children).toContain('child');
    expect(addedChild?.parentId).toBe('root');
  });

  it('should insert at specific index', () => {
    const parent = createNode('selector', { id: 'root', children: ['a', 'b'] });
    const a = createNode('action', { id: 'a', parentId: 'root' });
    const b = createNode('action', { id: 'b', parentId: 'root' });
    const newChild = createNode('action', { id: 'new' });
    const result = addChildNode([parent, a, b], 'root', newChild, 1);

    const updatedParent = findNode(result, 'root');
    expect(updatedParent?.children).toEqual(['a', 'new', 'b']);
  });

  it('should not add to leaf node', () => {
    const leaf = createNode('action', { id: 'leaf' });
    const child = createNode('action', { id: 'child' });
    const result = addChildNode([leaf], 'leaf', child);
    expect(result.length).toBe(1);
  });

  it('should not exceed max children for decorators', () => {
    const dec = createNode('inverter', { id: 'dec', children: ['existing'] });
    const existing = createNode('action', { id: 'existing', parentId: 'dec' });
    const child = createNode('action', { id: 'extra' });
    const result = addChildNode([dec, existing], 'dec', child);
    expect(findNode(result, 'dec')?.children.length).toBe(1);
  });
});

describe('removeNodeAndDescendants()', () => {
  it('should remove node and all descendants', () => {
    const root = createNode('selector', { id: 'root', children: ['a'] });
    const a = createNode('sequence', { id: 'a', parentId: 'root', children: ['b'] });
    const b = createNode('action', { id: 'b', parentId: 'a' });

    const result = removeNodeAndDescendants([root, a, b], 'a');
    expect(result.length).toBe(1);
    expect(result[0].id).toBe('root');
    expect(result[0].children).toEqual([]);
  });

  it('should handle removing leaf node', () => {
    const root = createNode('selector', { id: 'root', children: ['leaf'] });
    const leaf = createNode('action', { id: 'leaf', parentId: 'root' });

    const result = removeNodeAndDescendants([root, leaf], 'leaf');
    expect(result.length).toBe(1);
    expect(result[0].children).toEqual([]);
  });
});

describe('moveNode()', () => {
  it('should move node from one parent to another', () => {
    const root = createNode('selector', { id: 'root', children: ['a', 'b'] });
    const a = createNode('sequence', { id: 'a', parentId: 'root', children: ['c'] });
    const b = createNode('sequence', { id: 'b', parentId: 'root' });
    const c = createNode('action', { id: 'c', parentId: 'a' });

    const result = moveNode([root, a, b, c], 'c', 'b');
    expect(findNode(result, 'a')?.children).toEqual([]);
    expect(findNode(result, 'b')?.children).toContain('c');
    expect(findNode(result, 'c')?.parentId).toBe('b');
  });

  it('should prevent moving to own descendant', () => {
    const root = createNode('selector', { id: 'root', children: ['a'] });
    const a = createNode('sequence', { id: 'a', parentId: 'root', children: ['b'] });
    const b = createNode('action', { id: 'b', parentId: 'a' });

    const result = moveNode([root, a, b], 'root', 'b');
    expect(findNode(result, 'root')?.parentId).toBeNull();
  });

  it('should prevent moving to self', () => {
    const root = createNode('selector', { id: 'root', children: ['a'] });
    const a = createNode('action', { id: 'a', parentId: 'root' });

    const result = moveNode([root, a], 'a', 'a');
    expect(findNode(result, 'a')?.parentId).toBe('root');
  });
});

describe('reorderChildren()', () => {
  it('should reorder children within a parent', () => {
    const root = createNode('selector', { id: 'root', children: ['a', 'b', 'c'] });
    const result = reorderChildren([root], 'root', 0, 2);
    expect(findNode(result, 'root')?.children).toEqual(['b', 'c', 'a']);
  });

  it('should handle swapping adjacent children', () => {
    const root = createNode('selector', { id: 'root', children: ['a', 'b'] });
    const result = reorderChildren([root], 'root', 0, 1);
    expect(findNode(result, 'root')?.children).toEqual(['b', 'a']);
  });
});

// ============================================================================
// Validation
// ============================================================================

describe('validateTree()', () => {
  it('should report error when no root is set', () => {
    const doc = createEmptyDocument();
    const errors = validateTree(doc);
    expect(errors.some((e) => e.severity === 'error' && e.message.includes('no root'))).toBe(true);
  });

  it('should report error for invalid root ID', () => {
    const doc = createEmptyDocument();
    doc.rootId = 'nonexistent';
    const errors = validateTree(doc);
    expect(errors.some((e) => e.severity === 'error' && e.message.includes('does not reference'))).toBe(true);
  });

  it('should validate a correct simple tree', () => {
    const root = createNode('selector', { id: 'root', children: ['child'] });
    const child = createNode('action', { id: 'child', parentId: 'root', actionParams: { actionType: 'CastSpell', spellId: 133, targetType: 'enemy', priority: 50 } });
    const doc: BehaviorTreeDocument = {
      ...createEmptyDocument(),
      nodes: [root, child],
      rootId: 'root',
    };
    const errors = validateTree(doc);
    const realErrors = errors.filter((e) => e.severity === 'error');
    expect(realErrors).toHaveLength(0);
  });

  it('should warn about empty composites', () => {
    const root = createNode('selector', { id: 'root' });
    const doc: BehaviorTreeDocument = {
      ...createEmptyDocument(),
      nodes: [root],
      rootId: 'root',
    };
    const errors = validateTree(doc);
    expect(errors.some((e) => e.severity === 'warning' && e.message.includes('no children'))).toBe(true);
  });

  it('should warn about empty decorators', () => {
    const root = createNode('inverter', { id: 'root' });
    const doc: BehaviorTreeDocument = {
      ...createEmptyDocument(),
      nodes: [root],
      rootId: 'root',
    };
    const errors = validateTree(doc);
    expect(errors.some((e) => e.severity === 'warning' && e.message.includes('no child'))).toBe(true);
  });

  it('should error on leaf with children', () => {
    const root = createNode('action', { id: 'root', children: ['child'] });
    const child = createNode('action', { id: 'child', parentId: 'root' });
    const doc: BehaviorTreeDocument = {
      ...createEmptyDocument(),
      nodes: [root, child],
      rootId: 'root',
    };
    const errors = validateTree(doc);
    expect(errors.some((e) => e.severity === 'error' && e.message.includes('should not have children'))).toBe(true);
  });

  it('should error on decorator with multiple children', () => {
    const root = createNode('inverter', { id: 'root', children: ['a', 'b'] });
    const a = createNode('action', { id: 'a', parentId: 'root' });
    const b = createNode('action', { id: 'b', parentId: 'root' });
    const doc: BehaviorTreeDocument = {
      ...createEmptyDocument(),
      nodes: [root, a, b],
      rootId: 'root',
    };
    const errors = validateTree(doc);
    expect(errors.some((e) => e.severity === 'error' && e.message.includes('at most 1 child'))).toBe(true);
  });

  it('should error on CastSpell action without spell ID', () => {
    const root = createNode('action', {
      id: 'root',
      actionParams: { actionType: 'CastSpell', targetType: 'enemy', priority: 50 },
    });
    const doc: BehaviorTreeDocument = {
      ...createEmptyDocument(),
      nodes: [root],
      rootId: 'root',
    };
    const errors = validateTree(doc);
    expect(errors.some((e) => e.severity === 'warning' && e.message.includes('no spell ID'))).toBe(true);
  });

  it('should warn about orphaned nodes', () => {
    const root = createNode('selector', { id: 'root', children: ['a'] });
    const a = createNode('action', { id: 'a', parentId: 'root' });
    const orphan = createNode('action', { id: 'orphan' });
    const doc: BehaviorTreeDocument = {
      ...createEmptyDocument(),
      nodes: [root, a, orphan],
      rootId: 'root',
    };
    const errors = validateTree(doc);
    expect(errors.some((e) => e.severity === 'warning' && e.message.includes('orphaned'))).toBe(true);
  });

  it('should error on mismatched parent references', () => {
    const root = createNode('selector', { id: 'root', children: ['a'] });
    const a = createNode('action', { id: 'a', parentId: 'wrong_parent' });
    const doc: BehaviorTreeDocument = {
      ...createEmptyDocument(),
      nodes: [root, a],
      rootId: 'root',
    };
    const errors = validateTree(doc);
    expect(errors.some((e) => e.severity === 'error' && e.message.includes('mismatched parent'))).toBe(true);
  });

  it('should not warn about disabled empty composites', () => {
    const root = createNode('selector', { id: 'root', disabled: true });
    const doc: BehaviorTreeDocument = {
      ...createEmptyDocument(),
      nodes: [root],
      rootId: 'root',
    };
    const errors = validateTree(doc);
    const warnings = errors.filter((e) => e.severity === 'warning' && e.message.includes('no children'));
    expect(warnings).toHaveLength(0);
  });

  it('should error when root has a parent', () => {
    const root = createNode('selector', { id: 'root', parentId: 'something' });
    const doc: BehaviorTreeDocument = {
      ...createEmptyDocument(),
      nodes: [root],
      rootId: 'root',
    };
    const errors = validateTree(doc);
    expect(errors.some((e) => e.severity === 'error' && e.message.includes('no parent'))).toBe(true);
  });
});

// ============================================================================
// Auto Layout
// ============================================================================

describe('autoLayoutTree()', () => {
  it('should position root at top', () => {
    const root = createNode('selector', { id: 'root', children: ['a', 'b'] });
    const a = createNode('action', { id: 'a', parentId: 'root' });
    const b = createNode('action', { id: 'b', parentId: 'root' });

    const result = autoLayoutTree([root, a, b], 'root');
    const rootNode = findNode(result, 'root');
    expect(rootNode?.position.y).toBe(0);
  });

  it('should position children below parent', () => {
    const root = createNode('selector', { id: 'root', children: ['a'] });
    const a = createNode('action', { id: 'a', parentId: 'root' });

    const result = autoLayoutTree([root, a], 'root');
    const rootNode = findNode(result, 'root');
    const childNode = findNode(result, 'a');
    expect(childNode!.position.y).toBeGreaterThan(rootNode!.position.y);
  });

  it('should spread siblings horizontally', () => {
    const root = createNode('selector', { id: 'root', children: ['a', 'b'] });
    const a = createNode('action', { id: 'a', parentId: 'root' });
    const b = createNode('action', { id: 'b', parentId: 'root' });

    const result = autoLayoutTree([root, a, b], 'root');
    const nodeA = findNode(result, 'a');
    const nodeB = findNode(result, 'b');
    expect(nodeB!.position.x).toBeGreaterThan(nodeA!.position.x);
  });

  it('should handle single-node tree', () => {
    const root = createNode('action', { id: 'root' });
    const result = autoLayoutTree([root], 'root');
    expect(findNode(result, 'root')?.position).toBeDefined();
  });

  it('should handle custom start position', () => {
    const root = createNode('action', { id: 'root' });
    const result = autoLayoutTree([root], 'root', undefined, 500, 200);
    const rootNode = findNode(result, 'root');
    expect(rootNode!.position.y).toBe(200);
  });
});

// ============================================================================
// Serialization
// ============================================================================

describe('createEmptyDocument()', () => {
  it('should create document with correct defaults', () => {
    const doc = createEmptyDocument();
    expect(doc.version).toBe(BT_DOCUMENT_VERSION);
    expect(doc.name).toBe('Untitled Behavior Tree');
    expect(doc.nodes).toEqual([]);
    expect(doc.rootId).toBeNull();
    expect(doc.tags).toEqual([]);
    expect(doc.botClass).toBe('Any');
    expect(doc.botSpec).toBe('Any');
    expect(doc.minLevel).toBe(1);
    expect(doc.maxLevel).toBe(90);
    expect(doc.createdAt).toBeTruthy();
    expect(doc.modifiedAt).toBeTruthy();
  });

  it('should accept custom name', () => {
    const doc = createEmptyDocument('My Tree');
    expect(doc.name).toBe('My Tree');
  });
});

describe('serializeDocument() / deserializeDocument()', () => {
  it('should round-trip a complete document', () => {
    const root = createNode('selector', { id: 'root', children: ['child'] });
    const child = createNode('action', { id: 'child', parentId: 'root', actionParams: { actionType: 'CastSpell', spellId: 133, targetType: 'enemy', priority: 80 } });
    const doc: BehaviorTreeDocument = {
      ...createEmptyDocument('Test Tree'),
      nodes: [root, child],
      rootId: 'root',
      tags: ['combat', 'mage'],
      botClass: 'Mage',
      author: 'Test',
    };

    const json = serializeDocument(doc);
    const restored = deserializeDocument(json);

    expect(restored.name).toBe('Test Tree');
    expect(restored.nodes.length).toBe(2);
    expect(restored.rootId).toBe('root');
    expect(restored.tags).toEqual(['combat', 'mage']);
    expect(restored.botClass).toBe('Mage');
    expect(restored.author).toBe('Test');

    const restoredChild = findNode(restored.nodes, 'child');
    expect(restoredChild?.actionParams?.spellId).toBe(133);
  });

  it('should update modifiedAt on serialize', () => {
    const doc = createEmptyDocument();
    const json = serializeDocument(doc);
    const restored = deserializeDocument(json);
    expect(restored.modifiedAt).toBeTruthy();
  });

  it('should reject documents with no version', () => {
    expect(() => deserializeDocument('{"nodes":[]}')).toThrow('missing version');
  });

  it('should reject documents with future version', () => {
    expect(() => deserializeDocument(`{"version":999,"nodes":[]}`)).toThrow('newer than supported');
  });

  it('should reject documents with invalid nodes', () => {
    expect(() => deserializeDocument('{"version":1}')).toThrow('nodes must be an array');
  });

  it('should handle valid JSON parse errors', () => {
    expect(() => deserializeDocument('not valid json')).toThrow();
  });
});

// ============================================================================
// Template Library
// ============================================================================

describe('BT_TEMPLATES', () => {
  it('should have at least 3 templates', () => {
    expect(BT_TEMPLATES.length).toBeGreaterThanOrEqual(3);
  });

  it('should produce valid trees for all templates', () => {
    for (const template of BT_TEMPLATES) {
      const { nodes, rootId } = template.build();
      expect(nodes.length).toBeGreaterThan(0);
      expect(rootId).toBeTruthy();
      expect(findNode(nodes, rootId)).toBeDefined();

      const doc: BehaviorTreeDocument = {
        ...createEmptyDocument(template.name),
        nodes,
        rootId,
      };
      const errors = validateTree(doc);
      const structuralErrors = errors.filter((e) => e.severity === 'error');
      expect(structuralErrors).toHaveLength(0);
    }
  });

  it('should have unique template names', () => {
    const names = BT_TEMPLATES.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('should have parent-child references consistent', () => {
    for (const template of BT_TEMPLATES) {
      const { nodes, rootId } = template.build();
      const nodeMap = new Map(nodes.map((n) => [n.id, n]));

      for (const node of nodes) {
        for (const childId of node.children) {
          const child = nodeMap.get(childId);
          expect(child).toBeDefined();
          expect(child!.parentId).toBe(node.id);
        }
      }

      const root = nodeMap.get(rootId);
      expect(root?.parentId).toBeNull();
    }
  });
});

// ============================================================================
// Bot Action/Condition Definitions
// ============================================================================

describe('BOT_ACTION_TYPES', () => {
  it('should have at least 20 action types', () => {
    expect(BOT_ACTION_TYPES.length).toBeGreaterThanOrEqual(20);
  });

  it('should have unique values', () => {
    const values = BOT_ACTION_TYPES.map((a) => a.value);
    expect(new Set(values).size).toBe(values.length);
  });

  it('should have categories for all actions', () => {
    for (const action of BOT_ACTION_TYPES) {
      expect(action.category).toBeTruthy();
      expect(action.label).toBeTruthy();
      expect(action.description).toBeTruthy();
    }
  });

  it('should have CastSpell requiring spell ID', () => {
    const castSpell = BOT_ACTION_TYPES.find((a) => a.value === 'CastSpell');
    expect(castSpell).toBeDefined();
    expect(castSpell!.requiresSpellId).toBe(true);
    expect(castSpell!.requiresTarget).toBe(true);
  });
});

describe('BOT_CONDITION_TYPES', () => {
  it('should have at least 15 condition types', () => {
    expect(BOT_CONDITION_TYPES.length).toBeGreaterThanOrEqual(15);
  });

  it('should have unique values', () => {
    const values = BOT_CONDITION_TYPES.map((c) => c.value);
    expect(new Set(values).size).toBe(values.length);
  });

  it('should have valid operators for all conditions', () => {
    for (const condition of BOT_CONDITION_TYPES) {
      expect(condition.operators.length).toBeGreaterThan(0);
      expect(condition.category).toBeTruthy();
      expect(condition.valueHint).toBeTruthy();
    }
  });

  it('should have health_pct with numeric operators', () => {
    const healthPct = BOT_CONDITION_TYPES.find((c) => c.value === 'health_pct');
    expect(healthPct).toBeDefined();
    expect(healthPct!.operators).toContain('>');
    expect(healthPct!.operators).toContain('<');
  });
});
