/**
 * TrinityCore SAI Unified Editor - Clipboard Operations
 *
 * Copy, paste, duplicate, and cut operations for SAI nodes.
 * Supports multi-node selection and connection preservation.
 *
 * @module sai-unified/clipboard
 * @version 3.0.0
 */

import type { SAINode, SAIConnection, SAIScript } from './types';

// ============================================================================
// CLIPBOARD TYPE
// ============================================================================

export interface Clipboard {
  /** Copied nodes */
  nodes: SAINode[];

  /** Connections between copied nodes */
  connections: SAIConnection[];

  /** Timestamp of copy operation */
  timestamp: number;

  /** Source script ID (for validation) */
  sourceScriptId?: string;
}

// ============================================================================
// COPY OPERATIONS
// ============================================================================

/**
 * Copy selected nodes to clipboard
 */
export function copyNodes(
  nodeIds: Set<string>,
  script: SAIScript
): Clipboard {
  // Get selected nodes
  const nodes = script.nodes.filter((n) => nodeIds.has(n.id));

  // Get connections between selected nodes only
  const connections = script.connections.filter(
    (c) => nodeIds.has(c.source) && nodeIds.has(c.target)
  );

  // Deep clone nodes and connections
  return {
    nodes: JSON.parse(JSON.stringify(nodes)),
    connections: JSON.parse(JSON.stringify(connections)),
    timestamp: Date.now(),
    sourceScriptId: script.id,
  };
}

/**
 * Copy entire script to clipboard
 */
export function copyScript(script: SAIScript): Clipboard {
  const allNodeIds = new Set(script.nodes.map((n) => n.id));
  return copyNodes(allNodeIds, script);
}

/**
 * Copy single node to clipboard
 */
export function copyNode(nodeId: string, script: SAIScript): Clipboard {
  return copyNodes(new Set([nodeId]), script);
}

// ============================================================================
// PASTE OPERATIONS
// ============================================================================

/**
 * Paste clipboard contents to script at offset position
 */
export function pasteNodes(
  clipboard: Clipboard,
  script: SAIScript,
  offset: { x: number; y: number } = { x: 50, y: 50 }
): {
  nodes: SAINode[];
  connections: SAIConnection[];
  idMap: Map<string, string>;
} {
  // Create new IDs for pasted nodes
  const idMap = new Map<string, string>();

  const newNodes: SAINode[] = clipboard.nodes.map((node) => {
    const newId = `${node.type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    idMap.set(node.id, newId);

    return {
      ...JSON.parse(JSON.stringify(node)),
      id: newId,
      position: {
        x: node.position.x + offset.x,
        y: node.position.y + offset.y,
      },
      // Update metadata
      metadata: {
        ...node.metadata,
        createdAt: Date.now(),
        modifiedAt: Date.now(),
        createdBy: undefined, // Will be set by editor
      },
    };
  });

  // Remap connection IDs
  const newConnections: SAIConnection[] = clipboard.connections.map((conn) => {
    const newId = `conn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    return {
      ...JSON.parse(JSON.stringify(conn)),
      id: newId,
      source: idMap.get(conn.source) || conn.source,
      target: idMap.get(conn.target) || conn.target,
      metadata: {
        ...conn.metadata,
        createdAt: Date.now(),
      },
    };
  });

  return { nodes: newNodes, connections: newConnections, idMap };
}

/**
 * Paste nodes and add to existing script
 */
export function pasteToScript(
  clipboard: Clipboard,
  script: SAIScript,
  offset?: { x: number; y: number }
): SAIScript {
  const { nodes, connections } = pasteNodes(clipboard, script, offset);

  return {
    ...script,
    nodes: [...script.nodes, ...nodes],
    connections: [...script.connections, ...connections],
    metadata: {
      ...script.metadata,
      modifiedAt: Date.now(),
    },
  };
}

// ============================================================================
// DUPLICATE OPERATIONS
// ============================================================================

/**
 * Duplicate selected nodes in place (with offset)
 */
export function duplicateNodes(
  nodeIds: Set<string>,
  script: SAIScript,
  offset: { x: number; y: number } = { x: 50, y: 50 }
): SAIScript {
  const clipboard = copyNodes(nodeIds, script);
  return pasteToScript(clipboard, script, offset);
}

/**
 * Duplicate single node
 */
export function duplicateNode(
  nodeId: string,
  script: SAIScript,
  offset?: { x: number; y: number }
): SAIScript {
  return duplicateNodes(new Set([nodeId]), script, offset);
}

// ============================================================================
// CUT OPERATIONS
// ============================================================================

/**
 * Cut selected nodes (copy + delete)
 */
export function cutNodes(
  nodeIds: Set<string>,
  script: SAIScript
): {
  clipboard: Clipboard;
  script: SAIScript;
} {
  // Copy nodes first
  const clipboard = copyNodes(nodeIds, script);

  // Delete nodes and their connections
  const remainingNodes = script.nodes.filter((n) => !nodeIds.has(n.id));
  const remainingConnections = script.connections.filter(
    (c) => !nodeIds.has(c.source) && !nodeIds.has(c.target)
  );

  const newScript: SAIScript = {
    ...script,
    nodes: remainingNodes,
    connections: remainingConnections,
    metadata: {
      ...script.metadata,
      modifiedAt: Date.now(),
    },
  };

  return { clipboard, script: newScript };
}

// ============================================================================
// SELECTION HELPERS
// ============================================================================

/**
 * Get nodes in bounding box
 */
export function selectNodesInBox(
  nodes: SAINode[],
  box: { x: number; y: number; width: number; height: number }
): Set<string> {
  const selected = new Set<string>();

  nodes.forEach((node) => {
    if (
      node.position.x >= box.x &&
      node.position.x <= box.x + box.width &&
      node.position.y >= box.y &&
      node.position.y <= box.y + box.height
    ) {
      selected.add(node.id);
    }
  });

  return selected;
}

/**
 * Select all connected nodes (transitive closure)
 */
export function selectConnectedNodes(
  startNodeId: string,
  script: SAIScript
): Set<string> {
  const selected = new Set<string>([startNodeId]);
  const queue = [startNodeId];

  while (queue.length > 0) {
    const nodeId = queue.shift()!;

    // Find all connected nodes
    script.connections.forEach((conn) => {
      if (conn.source === nodeId && !selected.has(conn.target)) {
        selected.add(conn.target);
        queue.push(conn.target);
      }
      if (conn.target === nodeId && !selected.has(conn.source)) {
        selected.add(conn.source);
        queue.push(conn.source);
      }
    });
  }

  return selected;
}

/**
 * Select all nodes of a specific type
 */
export function selectNodesByType(
  nodes: SAINode[],
  type: 'event' | 'action' | 'target' | 'comment'
): Set<string> {
  return new Set(nodes.filter((n) => n.type === type).map((n) => n.id));
}

/**
 * Select all nodes downstream from given node
 */
export function selectDownstream(
  startNodeId: string,
  script: SAIScript
): Set<string> {
  const selected = new Set<string>([startNodeId]);
  const queue = [startNodeId];

  while (queue.length > 0) {
    const nodeId = queue.shift()!;

    // Find downstream nodes (where this node is source)
    script.connections.forEach((conn) => {
      if (conn.source === nodeId && !selected.has(conn.target)) {
        selected.add(conn.target);
        queue.push(conn.target);
      }
    });
  }

  return selected;
}

/**
 * Select all nodes upstream from given node
 */
export function selectUpstream(
  startNodeId: string,
  script: SAIScript
): Set<string> {
  const selected = new Set<string>([startNodeId]);
  const queue = [startNodeId];

  while (queue.length > 0) {
    const nodeId = queue.shift()!;

    // Find upstream nodes (where this node is target)
    script.connections.forEach((conn) => {
      if (conn.target === nodeId && !selected.has(conn.source)) {
        selected.add(conn.source);
        queue.push(conn.source);
      }
    });
  }

  return selected;
}

// ============================================================================
// CLIPBOARD VALIDATION
// ============================================================================

/**
 * Check if clipboard is valid
 */
export function isClipboardValid(clipboard: Clipboard): boolean {
  return (
    clipboard &&
    clipboard.nodes &&
    Array.isArray(clipboard.nodes) &&
    clipboard.nodes.length > 0
  );
}

/**
 * Check if clipboard is empty
 */
export function isClipboardEmpty(clipboard: Clipboard | null): boolean {
  return !clipboard || !isClipboardValid(clipboard);
}

/**
 * Get clipboard statistics
 */
export function getClipboardStats(clipboard: Clipboard): {
  nodeCount: number;
  connectionCount: number;
  eventCount: number;
  actionCount: number;
  targetCount: number;
  commentCount: number;
  age: number;
} {
  return {
    nodeCount: clipboard.nodes.length,
    connectionCount: clipboard.connections.length,
    eventCount: clipboard.nodes.filter((n) => n.type === 'event').length,
    actionCount: clipboard.nodes.filter((n) => n.type === 'action').length,
    targetCount: clipboard.nodes.filter((n) => n.type === 'target').length,
    commentCount: clipboard.nodes.filter((n) => n.type === 'comment').length,
    age: Date.now() - clipboard.timestamp,
  };
}

// ============================================================================
// SMART PASTE
// ============================================================================

/**
 * Smart paste that avoids overlap with existing nodes
 */
export function smartPaste(
  clipboard: Clipboard,
  script: SAIScript,
  initialOffset: { x: number; y: number } = { x: 50, y: 50 }
): {
  nodes: SAINode[];
  connections: SAIConnection[];
  idMap: Map<string, string>;
  finalOffset: { x: number; y: number };
} {
  let offset = { ...initialOffset };
  let maxAttempts = 10;
  let attempt = 0;

  // Try to find non-overlapping position
  while (attempt < maxAttempts) {
    const hasOverlap = clipboard.nodes.some((clipNode) => {
      const targetX = clipNode.position.x + offset.x;
      const targetY = clipNode.position.y + offset.y;

      return script.nodes.some((existingNode) => {
        const dx = Math.abs(existingNode.position.x - targetX);
        const dy = Math.abs(existingNode.position.y - targetY);

        // Check for overlap (within 100px threshold)
        return dx < 100 && dy < 100;
      });
    });

    if (!hasOverlap) {
      break;
    }

    // Try next offset
    offset.x += 50;
    offset.y += 50;
    attempt++;
  }

  const result = pasteNodes(clipboard, script, offset);

  return {
    ...result,
    finalOffset: offset,
  };
}

/**
 * Paste and connect to specific node
 */
export function pasteAndConnect(
  clipboard: Clipboard,
  script: SAIScript,
  targetNodeId: string,
  connectionType: 'event-to-action' | 'action-to-target'
): SAIScript {
  const { nodes, connections, idMap } = smartPaste(clipboard, script);

  // Find first compatible node in pasted nodes
  let firstNodeId: string | undefined;

  if (connectionType === 'event-to-action') {
    firstNodeId = nodes.find((n) => n.type === 'event')?.id;
  } else if (connectionType === 'action-to-target') {
    firstNodeId = nodes.find((n) => n.type === 'action')?.id;
  }

  // Create connection
  const newConnection: SAIConnection | undefined = firstNodeId
    ? {
        id: `conn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        source: targetNodeId,
        target: firstNodeId,
        type: connectionType,
      }
    : undefined;

  return {
    ...script,
    nodes: [...script.nodes, ...nodes],
    connections: [
      ...script.connections,
      ...connections,
      ...(newConnection ? [newConnection] : []),
    ],
    metadata: {
      ...script.metadata,
      modifiedAt: Date.now(),
    },
  };
}
