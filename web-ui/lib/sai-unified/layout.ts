/**
 * TrinityCore SAI Unified Editor - Auto-Layout Algorithm
 *
 * Intelligent graph layout for SAI node visualization.
 * Uses force-directed and layered algorithms for optimal positioning.
 *
 * @module sai-unified/layout
 * @version 3.0.0
 */

import type { SAINode, SAIConnection, SAIScript } from './types';

// ============================================================================
// LAYOUT CONFIGURATION
// ============================================================================

export interface LayoutConfig {
  /** Horizontal spacing between layers */
  layerSpacing: number;

  /** Vertical spacing between nodes */
  nodeSpacing: number;

  /** Starting X position */
  startX: number;

  /** Starting Y position */
  startY: number;

  /** Layout algorithm to use */
  algorithm: 'layered' | 'force-directed' | 'hierarchical';

  /** Whether to animate the layout transition */
  animate: boolean;

  /** Animation duration (ms) */
  animationDuration: number;
}

const DEFAULT_LAYOUT_CONFIG: LayoutConfig = {
  layerSpacing: 300,
  nodeSpacing: 150,
  startX: 50,
  startY: 50,
  algorithm: 'layered',
  animate: true,
  animationDuration: 500,
};

// ============================================================================
// AUTO-LAYOUT
// ============================================================================

/**
 * Apply auto-layout to script nodes
 */
export function autoLayout(
  script: SAIScript,
  config: Partial<LayoutConfig> = {}
): SAIScript {
  const cfg = { ...DEFAULT_LAYOUT_CONFIG, ...config };

  // Clone script to avoid mutation
  const layoutScript: SAIScript = {
    ...script,
    nodes: script.nodes.map((n) => ({ ...n })),
  };

  // Apply layout algorithm
  switch (cfg.algorithm) {
    case 'layered':
      applyLayeredLayout(layoutScript, cfg);
      break;
    case 'force-directed':
      applyForceDirectedLayout(layoutScript, cfg);
      break;
    case 'hierarchical':
      applyHierarchicalLayout(layoutScript, cfg);
      break;
  }

  return layoutScript;
}

// ============================================================================
// LAYERED LAYOUT (DEFAULT)
// ============================================================================

/**
 * Simple layered layout: Events -> Actions -> Targets
 */
function applyLayeredLayout(script: SAIScript, config: LayoutConfig) {
  // Group nodes by type
  const eventNodes = script.nodes.filter((n) => n.type === 'event');
  const actionNodes = script.nodes.filter((n) => n.type === 'action');
  const targetNodes = script.nodes.filter((n) => n.type === 'target');
  const commentNodes = script.nodes.filter((n) => n.type === 'comment');

  // Position events in column 0
  eventNodes.forEach((node, idx) => {
    node.position = {
      x: config.startX,
      y: config.startY + idx * config.nodeSpacing,
    };
  });

  // Position actions in column 1
  actionNodes.forEach((node, idx) => {
    node.position = {
      x: config.startX + config.layerSpacing,
      y: config.startY + idx * config.nodeSpacing,
    };
  });

  // Position targets in column 2
  targetNodes.forEach((node, idx) => {
    node.position = {
      x: config.startX + config.layerSpacing * 2,
      y: config.startY + idx * config.nodeSpacing,
    };
  });

  // Position comments near their connected nodes
  commentNodes.forEach((node, idx) => {
    node.position = {
      x: config.startX + config.layerSpacing * 3,
      y: config.startY + idx * config.nodeSpacing,
    };
  });
}

// ============================================================================
// HIERARCHICAL LAYOUT
// ============================================================================

/**
 * Hierarchical layout based on connection graph
 */
function applyHierarchicalLayout(script: SAIScript, config: LayoutConfig) {
  // Build dependency graph
  const graph = buildDependencyGraph(script);

  // Compute layers using longest path algorithm
  const layers = computeLayers(graph, script.connections);

  // Position nodes by layer
  layers.forEach((layerNodes, layerIndex) => {
    layerNodes.forEach((nodeId, nodeIndex) => {
      const node = script.nodes.find((n) => n.id === nodeId);
      if (node) {
        node.position = {
          x: config.startX + layerIndex * config.layerSpacing,
          y: config.startY + nodeIndex * config.nodeSpacing,
        };
      }
    });
  });

  // Minimize edge crossings
  minimizeEdgeCrossings(script, layers, config);
}

/**
 * Build dependency graph
 */
function buildDependencyGraph(script: SAIScript): Map<string, Set<string>> {
  const graph = new Map<string, Set<string>>();

  // Initialize graph
  script.nodes.forEach((node) => {
    graph.set(node.id, new Set());
  });

  // Add dependencies
  script.connections.forEach((conn) => {
    const deps = graph.get(conn.target);
    if (deps) {
      deps.add(conn.source);
    }
  });

  return graph;
}

/**
 * Compute layers using longest path
 */
function computeLayers(
  graph: Map<string, Set<string>>,
  connections: SAIConnection[]
): string[][] {
  const layers: string[][] = [];
  const nodeLayer = new Map<string, number>();
  const processed = new Set<string>();

  // Find nodes with no dependencies (sources)
  const sources: string[] = [];
  graph.forEach((deps, nodeId) => {
    if (deps.size === 0) {
      sources.push(nodeId);
      nodeLayer.set(nodeId, 0);
    }
  });

  // BFS to compute layers
  const queue = [...sources];
  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    const layer = nodeLayer.get(nodeId) || 0;

    // Add to layer
    if (!layers[layer]) {
      layers[layer] = [];
    }
    layers[layer].push(nodeId);
    processed.add(nodeId);

    // Process dependents
    connections
      .filter((c) => c.source === nodeId)
      .forEach((conn) => {
        const targetId = conn.target;
        const currentLayer = nodeLayer.get(targetId) || 0;
        const newLayer = layer + 1;

        if (newLayer > currentLayer) {
          nodeLayer.set(targetId, newLayer);
        }

        // Check if all dependencies processed
        const deps = graph.get(targetId);
        if (deps && Array.from(deps).every((d) => processed.has(d))) {
          queue.push(targetId);
        }
      });
  }

  return layers;
}

/**
 * Minimize edge crossings between layers
 */
function minimizeEdgeCrossings(
  script: SAIScript,
  layers: string[][],
  config: LayoutConfig
) {
  // Barycenter heuristic: position nodes based on average position of neighbors
  for (let i = 1; i < layers.length; i++) {
    const layer = layers[i];

    layer.sort((a, b) => {
      const aNeighbors = script.connections
        .filter((c) => c.target === a)
        .map((c) => script.nodes.find((n) => n.id === c.source))
        .filter((n): n is SAINode => !!n);

      const bNeighbors = script.connections
        .filter((c) => c.target === b)
        .map((c) => script.nodes.find((n) => n.id === c.source))
        .filter((n): n is SAINode => !!n);

      const aAvg =
        aNeighbors.reduce((sum, n) => sum + n.position.y, 0) /
        (aNeighbors.length || 1);
      const bAvg =
        bNeighbors.reduce((sum, n) => sum + n.position.y, 0) /
        (bNeighbors.length || 1);

      return aAvg - bAvg;
    });

    // Update positions
    layer.forEach((nodeId, index) => {
      const node = script.nodes.find((n) => n.id === nodeId);
      if (node) {
        node.position.y = config.startY + index * config.nodeSpacing;
      }
    });
  }
}

// ============================================================================
// FORCE-DIRECTED LAYOUT
// ============================================================================

/**
 * Force-directed layout using physics simulation
 */
function applyForceDirectedLayout(script: SAIScript, config: LayoutConfig) {
  // Initialize random positions
  script.nodes.forEach((node, idx) => {
    if (!node.position || (node.position.x === 0 && node.position.y === 0)) {
      node.position = {
        x: config.startX + Math.random() * 600,
        y: config.startY + Math.random() * 600,
      };
    }
  });

  // Physics simulation parameters
  const ITERATIONS = 100;
  const REPULSION_STRENGTH = 50000;
  const ATTRACTION_STRENGTH = 0.01;
  const DAMPING = 0.9;

  // Velocities
  const velocities = new Map<string, { x: number; y: number }>();
  script.nodes.forEach((node) => {
    velocities.set(node.id, { x: 0, y: 0 });
  });

  // Run simulation
  for (let iter = 0; iter < ITERATIONS; iter++) {
    // Reset forces
    const forces = new Map<string, { x: number; y: number }>();
    script.nodes.forEach((node) => {
      forces.set(node.id, { x: 0, y: 0 });
    });

    // Repulsion between all nodes
    for (let i = 0; i < script.nodes.length; i++) {
      for (let j = i + 1; j < script.nodes.length; j++) {
        const nodeA = script.nodes[i];
        const nodeB = script.nodes[j];

        const dx = nodeB.position.x - nodeA.position.x;
        const dy = nodeB.position.y - nodeA.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy) || 1;

        const force = REPULSION_STRENGTH / (distance * distance);
        const fx = (force * dx) / distance;
        const fy = (force * dy) / distance;

        const forceA = forces.get(nodeA.id)!;
        const forceB = forces.get(nodeB.id)!;

        forceA.x -= fx;
        forceA.y -= fy;
        forceB.x += fx;
        forceB.y += fy;
      }
    }

    // Attraction along connections
    script.connections.forEach((conn) => {
      const sourceNode = script.nodes.find((n) => n.id === conn.source);
      const targetNode = script.nodes.find((n) => n.id === conn.target);

      if (sourceNode && targetNode) {
        const dx = targetNode.position.x - sourceNode.position.x;
        const dy = targetNode.position.y - sourceNode.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy) || 1;

        const force = distance * ATTRACTION_STRENGTH;
        const fx = (force * dx) / distance;
        const fy = (force * dy) / distance;

        const forceSource = forces.get(sourceNode.id)!;
        const forceTarget = forces.get(targetNode.id)!;

        forceSource.x += fx;
        forceSource.y += fy;
        forceTarget.x -= fx;
        forceTarget.y -= fy;
      }
    });

    // Apply forces and update positions
    script.nodes.forEach((node) => {
      const force = forces.get(node.id)!;
      const velocity = velocities.get(node.id)!;

      velocity.x = (velocity.x + force.x) * DAMPING;
      velocity.y = (velocity.y + force.y) * DAMPING;

      node.position.x += velocity.x;
      node.position.y += velocity.y;
    });
  }

  // Normalize positions to start from config.startX, config.startY
  normalizePositions(script.nodes, config);
}

/**
 * Normalize node positions to start from configured origin
 */
function normalizePositions(nodes: SAINode[], config: LayoutConfig) {
  // Find bounding box
  let minX = Infinity;
  let minY = Infinity;

  nodes.forEach((node) => {
    minX = Math.min(minX, node.position.x);
    minY = Math.min(minY, node.position.y);
  });

  // Shift all nodes
  nodes.forEach((node) => {
    node.position.x = node.position.x - minX + config.startX;
    node.position.y = node.position.y - minY + config.startY;
  });
}

// ============================================================================
// LAYOUT UTILITIES
// ============================================================================

/**
 * Get bounding box of all nodes
 */
export function getBoundingBox(nodes: SAINode[]): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
} {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  nodes.forEach((node) => {
    minX = Math.min(minX, node.position.x);
    minY = Math.min(minY, node.position.y);
    maxX = Math.max(maxX, node.position.x);
    maxY = Math.max(maxY, node.position.y);
  });

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

/**
 * Center nodes in viewport
 */
export function centerNodes(
  nodes: SAINode[],
  viewportWidth: number,
  viewportHeight: number
): SAINode[] {
  const bbox = getBoundingBox(nodes);

  const offsetX = (viewportWidth - bbox.width) / 2 - bbox.minX;
  const offsetY = (viewportHeight - bbox.height) / 2 - bbox.minY;

  return nodes.map((node) => ({
    ...node,
    position: {
      x: node.position.x + offsetX,
      y: node.position.y + offsetY,
    },
  }));
}

/**
 * Fit nodes to viewport
 */
export function fitNodesToViewport(
  nodes: SAINode[],
  viewportWidth: number,
  viewportHeight: number,
  padding: number = 50
): { nodes: SAINode[]; scale: number } {
  const bbox = getBoundingBox(nodes);

  const scaleX = (viewportWidth - padding * 2) / bbox.width;
  const scaleY = (viewportHeight - padding * 2) / bbox.height;
  const scale = Math.min(scaleX, scaleY, 1); // Don't zoom in, only out

  const scaledNodes = nodes.map((node) => ({
    ...node,
    position: {
      x: (node.position.x - bbox.minX) * scale + padding,
      y: (node.position.y - bbox.minY) * scale + padding,
    },
  }));

  return { nodes: scaledNodes, scale };
}

/**
 * Align nodes to grid
 */
export function alignToGrid(nodes: SAINode[], gridSize: number = 50): SAINode[] {
  return nodes.map((node) => ({
    ...node,
    position: {
      x: Math.round(node.position.x / gridSize) * gridSize,
      y: Math.round(node.position.y / gridSize) * gridSize,
    },
  }));
}

/**
 * Distribute nodes evenly
 */
export function distributeNodes(
  nodes: SAINode[],
  direction: 'horizontal' | 'vertical',
  spacing: number
): SAINode[] {
  const sorted = [...nodes].sort((a, b) => {
    return direction === 'horizontal'
      ? a.position.x - b.position.x
      : a.position.y - b.position.y;
  });

  sorted.forEach((node, index) => {
    if (direction === 'horizontal') {
      node.position.x = spacing * index;
    } else {
      node.position.y = spacing * index;
    }
  });

  return sorted;
}
