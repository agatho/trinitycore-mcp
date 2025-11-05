/**
 * TrinityCore SAI Unified Editor - Validation Engine
 *
 * Multi-level validation system for SAI scripts with auto-fix capabilities.
 * Provides errors (blocking), warnings (should fix), and info (suggestions).
 *
 * @module sai-unified/validation
 * @version 3.0.0
 */

import type {
  SAIScript,
  SAINode,
  SAIConnection,
  ValidationResult,
  ValidationError,
  ValidationWarning,
  ValidationInfo,
  ValidationIssue,
} from './types';
import { validateParameter } from './parameters';
import { getEventType, getActionType, getTargetType } from './constants';

// ============================================================================
// VALIDATION ORCHESTRATOR
// ============================================================================

/**
 * Validate entire SAI script
 * Returns comprehensive validation result with errors, warnings, and info
 */
export function validateScript(script: SAIScript): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  const info: ValidationInfo[] = [];

  // Run all validators
  errors.push(...validateStructure(script));
  errors.push(...validateNodes(script));
  errors.push(...validateConnections(script));
  errors.push(...validateParameters(script));

  warnings.push(...validateBestPractices(script));
  warnings.push(...validatePerformance(script));

  info.push(...validateSuggestions(script));

  // Calculate validation score (0-100)
  const score = calculateValidationScore(errors, warnings, info);

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    info,
    score,
    timestamp: Date.now(),
  };
}

/**
 * Quick validation (only critical errors)
 * For real-time validation while editing
 */
export function quickValidate(script: SAIScript): boolean {
  const errors = validateStructure(script);
  errors.push(...validateNodes(script));
  return errors.length === 0;
}

// ============================================================================
// STRUCTURE VALIDATION
// ============================================================================

/**
 * Validate script structure requirements
 */
function validateStructure(script: SAIScript): ValidationError[] {
  const errors: ValidationError[] = [];

  // Must have at least one event
  const eventNodes = script.nodes.filter((n) => n.type === 'event');
  if (eventNodes.length === 0) {
    errors.push({
      nodeId: '',
      message: 'Script must have at least one event node',
      severity: 'error',
      suggestion: 'Add an event node to trigger your script',
    });
  }

  // Must have at least one action
  const actionNodes = script.nodes.filter((n) => n.type === 'action');
  if (actionNodes.length === 0 && eventNodes.length > 0) {
    errors.push({
      nodeId: '',
      message: 'Script must have at least one action node',
      severity: 'error',
      suggestion: 'Add an action node to execute when events trigger',
    });
  }

  // Must have valid entry/guid
  if (!script.entryOrGuid || script.entryOrGuid === 0) {
    errors.push({
      nodeId: '',
      message: 'Script must have a valid entry or GUID',
      severity: 'error',
      suggestion: 'Set the creature/gameobject entry ID',
    });
  }

  // Check for duplicate node IDs
  const nodeIds = new Set<string>();
  script.nodes.forEach((node) => {
    if (nodeIds.has(node.id)) {
      errors.push({
        nodeId: node.id,
        message: `Duplicate node ID: ${node.id}`,
        severity: 'error',
        suggestion: 'This is a system error. Regenerate node IDs.',
      });
    }
    nodeIds.add(node.id);
  });

  // Check for orphaned connections
  const validNodeIds = new Set(script.nodes.map((n) => n.id));
  script.connections.forEach((conn) => {
    if (!validNodeIds.has(conn.source)) {
      errors.push({
        nodeId: conn.source,
        message: `Connection references non-existent source node: ${conn.source}`,
        severity: 'error',
        suggestion: 'Delete invalid connection',
      });
    }
    if (!validNodeIds.has(conn.target)) {
      errors.push({
        nodeId: conn.target,
        message: `Connection references non-existent target node: ${conn.target}`,
        severity: 'error',
        suggestion: 'Delete invalid connection',
      });
    }
  });

  return errors;
}

// ============================================================================
// NODE VALIDATION
// ============================================================================

/**
 * Validate all nodes in script
 */
function validateNodes(script: SAIScript): ValidationError[] {
  const errors: ValidationError[] = [];

  script.nodes.forEach((node) => {
    errors.push(...validateNode(node, script));
  });

  return errors;
}

/**
 * Validate individual node
 */
function validateNode(node: SAINode, script: SAIScript): ValidationError[] {
  const errors: ValidationError[] = [];

  // Validate node has valid type
  if (!['event', 'action', 'target', 'comment'].includes(node.type)) {
    errors.push({
      nodeId: node.id,
      message: `Invalid node type: ${node.type}`,
      severity: 'error',
      suggestion: 'Node type must be event, action, target, or comment',
    });
    return errors; // Can't continue validation
  }

  // Validate type ID exists
  if (node.type === 'event') {
    const eventType = getEventType(node.typeId);
    if (!eventType) {
      errors.push({
        nodeId: node.id,
        message: `Invalid event type ID: ${node.typeId}`,
        severity: 'error',
        suggestion: 'Select a valid event type',
      });
    }
  } else if (node.type === 'action') {
    const actionType = getActionType(node.typeId);
    if (!actionType) {
      errors.push({
        nodeId: node.id,
        message: `Invalid action type ID: ${node.typeId}`,
        severity: 'error',
        suggestion: 'Select a valid action type',
      });
    }
  } else if (node.type === 'target') {
    const targetType = getTargetType(node.typeId);
    if (!targetType) {
      errors.push({
        nodeId: node.id,
        message: `Invalid target type ID: ${node.typeId}`,
        severity: 'error',
        suggestion: 'Select a valid target type',
      });
    }
  }

  // Validate phase mask
  if (node.phase !== undefined && node.phase < 0) {
    errors.push({
      nodeId: node.id,
      message: 'Phase mask must be non-negative',
      severity: 'error',
      suggestion: 'Set phase to 0 (all phases) or positive value',
    });
  }

  // Validate chance
  if (node.chance !== undefined && (node.chance < 1 || node.chance > 100)) {
    errors.push({
      nodeId: node.id,
      message: 'Chance must be between 1 and 100',
      severity: 'error',
      suggestion: 'Set chance to a value between 1 (1%) and 100 (100%)',
    });
  }

  // Validate flags
  if (node.flags !== undefined && node.flags < 0) {
    errors.push({
      nodeId: node.id,
      message: 'Flags must be non-negative',
      severity: 'error',
      suggestion: 'Set flags to 0 or positive bitwise value',
    });
  }

  // Validate link
  if (node.link !== undefined && node.link !== 0) {
    const linkedNode = script.nodes.find((n) => n.id === node.link.toString());
    if (!linkedNode) {
      errors.push({
        nodeId: node.id,
        message: `Linked node not found: ${node.link}`,
        severity: 'error',
        suggestion: 'Remove link or create linked event',
      });
    } else if (linkedNode.type !== 'event') {
      errors.push({
        nodeId: node.id,
        message: 'Link target must be an event node',
        severity: 'error',
        suggestion: 'Link can only point to another event',
      });
    }
  }

  return errors;
}

// ============================================================================
// CONNECTION VALIDATION
// ============================================================================

/**
 * Validate all connections
 */
function validateConnections(script: SAIScript): ValidationError[] {
  const errors: ValidationError[] = [];

  script.connections.forEach((conn) => {
    errors.push(...validateConnection(conn, script));
  });

  // Check for circular dependencies
  errors.push(...detectCircularDependencies(script));

  return errors;
}

/**
 * Validate individual connection
 */
function validateConnection(
  conn: SAIConnection,
  script: SAIScript
): ValidationError[] {
  const errors: ValidationError[] = [];

  const sourceNode = script.nodes.find((n) => n.id === conn.source);
  const targetNode = script.nodes.find((n) => n.id === conn.target);

  if (!sourceNode || !targetNode) {
    return errors; // Already caught by structure validation
  }

  // Validate connection type matches node types
  if (conn.type === 'event-to-action') {
    if (sourceNode.type !== 'event') {
      errors.push({
        nodeId: conn.source,
        message: 'Event-to-action connection source must be an event',
        severity: 'error',
        suggestion: 'Change connection type or reconnect nodes',
      });
    }
    if (targetNode.type !== 'action') {
      errors.push({
        nodeId: conn.target,
        message: 'Event-to-action connection target must be an action',
        severity: 'error',
        suggestion: 'Change connection type or reconnect nodes',
      });
    }
  } else if (conn.type === 'action-to-target') {
    if (sourceNode.type !== 'action') {
      errors.push({
        nodeId: conn.source,
        message: 'Action-to-target connection source must be an action',
        severity: 'error',
        suggestion: 'Change connection type or reconnect nodes',
      });
    }
    if (targetNode.type !== 'target') {
      errors.push({
        nodeId: conn.target,
        message: 'Action-to-target connection target must be a target',
        severity: 'error',
        suggestion: 'Change connection type or reconnect nodes',
      });
    }
  } else if (conn.type === 'link') {
    if (sourceNode.type !== 'event') {
      errors.push({
        nodeId: conn.source,
        message: 'Link connection source must be an event',
        severity: 'error',
        suggestion: 'Links can only connect events',
      });
    }
    if (targetNode.type !== 'event') {
      errors.push({
        nodeId: conn.target,
        message: 'Link connection target must be an event',
        severity: 'error',
        suggestion: 'Links can only connect events',
      });
    }
  }

  return errors;
}

/**
 * Detect circular dependencies in event links
 */
function detectCircularDependencies(script: SAIScript): ValidationError[] {
  const errors: ValidationError[] = [];
  const linkConnections = script.connections.filter((c) => c.type === 'link');

  // Build adjacency list
  const graph = new Map<string, string[]>();
  linkConnections.forEach((conn) => {
    if (!graph.has(conn.source)) {
      graph.set(conn.source, []);
    }
    graph.get(conn.source)!.push(conn.target);
  });

  // DFS to detect cycles
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  function hasCycle(nodeId: string, path: string[]): boolean {
    visited.add(nodeId);
    recursionStack.add(nodeId);
    path.push(nodeId);

    const neighbors = graph.get(nodeId) || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        if (hasCycle(neighbor, path)) {
          return true;
        }
      } else if (recursionStack.has(neighbor)) {
        // Found cycle
        const cycleStart = path.indexOf(neighbor);
        const cycle = path.slice(cycleStart).concat(neighbor);
        errors.push({
          nodeId: nodeId,
          message: `Circular event link dependency detected: ${cycle.join(' → ')}`,
          severity: 'error',
          suggestion: 'Remove one of the links to break the cycle',
        });
        return true;
      }
    }

    recursionStack.delete(nodeId);
    path.pop();
    return false;
  }

  // Check each node
  graph.forEach((_, nodeId) => {
    if (!visited.has(nodeId)) {
      hasCycle(nodeId, []);
    }
  });

  return errors;
}

// ============================================================================
// PARAMETER VALIDATION
// ============================================================================

/**
 * Validate all node parameters
 */
function validateParameters(script: SAIScript): ValidationError[] {
  const errors: ValidationError[] = [];

  script.nodes.forEach((node) => {
    node.parameters.forEach((param) => {
      const error = validateParameter(param);
      if (error) {
        errors.push({
          nodeId: node.id,
          message: error,
          parameter: param.name,
          severity: 'error',
          suggestion: `Fix ${param.name} in ${node.label}`,
        });
      }
    });
  });

  return errors;
}

// ============================================================================
// BEST PRACTICES VALIDATION
// ============================================================================

/**
 * Validate best practices (warnings)
 */
function validateBestPractices(script: SAIScript): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];

  // Check for disconnected nodes
  warnings.push(...checkDisconnectedNodes(script));

  // Check for missing targets
  warnings.push(...checkMissingTargets(script));

  // Check for unreachable nodes
  warnings.push(...checkUnreachableNodes(script));

  // Check for missing comments
  warnings.push(...checkDocumentation(script));

  return warnings;
}

/**
 * Check for nodes without connections
 */
function checkDisconnectedNodes(script: SAIScript): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];

  script.nodes.forEach((node) => {
    const hasConnection = script.connections.some(
      (c) => c.source === node.id || c.target === node.id
    );

    if (!hasConnection && node.type !== 'comment') {
      warnings.push({
        nodeId: node.id,
        message: `${node.type} node has no connections`,
        severity: 'warning',
        suggestion: `Connect this ${node.type} to other nodes or delete it`,
      });
    }
  });

  return warnings;
}

/**
 * Check for actions without targets
 */
function checkMissingTargets(script: SAIScript): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];

  const actionNodes = script.nodes.filter((n) => n.type === 'action');
  actionNodes.forEach((node) => {
    const hasTarget = script.connections.some(
      (c) => c.source === node.id && c.type === 'action-to-target'
    );

    if (!hasTarget) {
      warnings.push({
        nodeId: node.id,
        message: 'Action has no target specified',
        severity: 'warning',
        suggestion:
          'Connect a target node (or action will use implicit self target)',
      });
    }
  });

  return warnings;
}

/**
 * Check for unreachable nodes
 */
function checkUnreachableNodes(script: SAIScript): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];

  // Get all event nodes (entry points)
  const eventNodes = script.nodes.filter((n) => n.type === 'event');
  const reachableNodes = new Set<string>(eventNodes.map((n) => n.id));

  // BFS to find all reachable nodes from events
  const queue = [...eventNodes.map((n) => n.id)];
  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    const outgoingConns = script.connections.filter((c) => c.source === nodeId);

    outgoingConns.forEach((conn) => {
      if (!reachableNodes.has(conn.target)) {
        reachableNodes.add(conn.target);
        queue.push(conn.target);
      }
    });
  }

  // Warn about unreachable nodes
  script.nodes.forEach((node) => {
    if (!reachableNodes.has(node.id) && node.type !== 'comment') {
      warnings.push({
        nodeId: node.id,
        message: `${node.type} node is unreachable from any event`,
        severity: 'warning',
        suggestion: 'Connect this node to an event or delete it',
      });
    }
  });

  return warnings;
}

/**
 * Check for missing documentation
 */
function checkDocumentation(script: SAIScript): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];

  // Check script description
  if (!script.metadata.description || script.metadata.description.trim() === '') {
    warnings.push({
      nodeId: '',
      message: 'Script has no description',
      severity: 'warning',
      suggestion: 'Add a description to explain what this script does',
    });
  }

  // Check for complex scripts without comments
  const nodeCount = script.nodes.length;
  const commentCount = script.nodes.filter((n) => n.type === 'comment').length;

  if (nodeCount > 10 && commentCount === 0) {
    warnings.push({
      nodeId: '',
      message: 'Complex script has no comment nodes',
      severity: 'warning',
      suggestion: 'Add comment nodes to document script logic',
    });
  }

  return warnings;
}

// ============================================================================
// PERFORMANCE VALIDATION
// ============================================================================

/**
 * Validate performance considerations
 */
function validatePerformance(script: SAIScript): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];

  // Check for too many events
  const eventCount = script.nodes.filter((n) => n.type === 'event').length;
  if (eventCount > 50) {
    warnings.push({
      nodeId: '',
      message: `Script has ${eventCount} events (high complexity)`,
      severity: 'warning',
      suggestion: 'Consider splitting into multiple scripts or optimizing',
    });
  }

  // Check for UPDATE_IC events with low timers
  script.nodes
    .filter((n) => n.type === 'event' && n.typeName === 'UPDATE_IC')
    .forEach((node) => {
      const repeatMin = node.parameters.find((p) => p.name === 'RepeatMin');
      if (repeatMin && typeof repeatMin.value === 'number' && repeatMin.value < 1000) {
        warnings.push({
          nodeId: node.id,
          message: 'UPDATE_IC event with very short repeat time (< 1 second)',
          severity: 'warning',
          suggestion: 'Consider increasing RepeatMin to reduce server load',
        });
      }
    });

  // Check for actions in tight loops
  const actionNodes = script.nodes.filter((n) => n.type === 'action');
  actionNodes.forEach((node) => {
    // Check if connected to high-frequency event
    const incomingConns = script.connections.filter(
      (c) => c.target === node.id && c.type === 'event-to-action'
    );

    incomingConns.forEach((conn) => {
      const eventNode = script.nodes.find((n) => n.id === conn.source);
      if (eventNode?.typeName === 'UPDATE_IC') {
        const repeatMin = eventNode.parameters.find((p) => p.name === 'RepeatMin');
        if (
          repeatMin &&
          typeof repeatMin.value === 'number' &&
          repeatMin.value < 1000
        ) {
          warnings.push({
            nodeId: node.id,
            message: `Action triggered by high-frequency event (every ${repeatMin.value}ms)`,
            severity: 'warning',
            suggestion: 'Verify this action needs to run so frequently',
          });
        }
      }
    });
  });

  return warnings;
}

// ============================================================================
// SUGGESTIONS
// ============================================================================

/**
 * Generate helpful suggestions (info level)
 */
function validateSuggestions(script: SAIScript): ValidationInfo[] {
  const info: ValidationInfo[] = [];

  // Suggest using phases for complex combat
  const eventCount = script.nodes.filter((n) => n.type === 'event').length;
  const hasPhases = script.nodes.some((n) => n.phase && n.phase > 0);

  if (eventCount > 5 && !hasPhases) {
    info.push({
      nodeId: '',
      message: 'Consider using phases to organize complex combat logic',
      severity: 'info',
      suggestion: 'Set phase masks on events to create distinct combat phases',
    });
  }

  // Suggest event linking
  const actionCount = script.nodes.filter((n) => n.type === 'action').length;
  const hasLinks = script.connections.some((c) => c.type === 'link');

  if (actionCount > eventCount * 2 && !hasLinks) {
    info.push({
      nodeId: '',
      message: 'Consider using event linking to chain actions',
      severity: 'info',
      suggestion: 'Link events together to execute multiple actions in sequence',
    });
  }

  // Suggest adding chance for variety
  const hasChance = script.nodes.some((n) => n.chance && n.chance < 100);
  if (eventCount > 3 && !hasChance) {
    info.push({
      nodeId: '',
      message: 'Consider adding chance to some events for variety',
      severity: 'info',
      suggestion: 'Set event chance < 100% to make behavior unpredictable',
    });
  }

  return info;
}

// ============================================================================
// VALIDATION SCORING
// ============================================================================

/**
 * Calculate overall validation score (0-100)
 */
function calculateValidationScore(
  errors: ValidationError[],
  warnings: ValidationWarning[],
  info: ValidationInfo[]
): number {
  let score = 100;

  // Errors: -10 points each (max -50)
  score -= Math.min(errors.length * 10, 50);

  // Warnings: -2 points each (max -30)
  score -= Math.min(warnings.length * 2, 30);

  // Info: -0.5 points each (max -20)
  score -= Math.min(info.length * 0.5, 20);

  return Math.max(0, score);
}

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Get validation issue by node ID
 */
export function getIssuesForNode(
  result: ValidationResult,
  nodeId: string
): ValidationIssue[] {
  return [
    ...result.errors.filter((e) => e.nodeId === nodeId),
    ...result.warnings.filter((w) => w.nodeId === nodeId),
    ...result.info.filter((i) => i.nodeId === nodeId),
  ];
}

/**
 * Get validation issue by parameter
 */
export function getIssuesForParameter(
  result: ValidationResult,
  nodeId: string,
  parameterName: string
): ValidationIssue[] {
  return [
    ...result.errors.filter(
      (e) => e.nodeId === nodeId && e.parameter === parameterName
    ),
    ...result.warnings.filter(
      (w) => w.nodeId === nodeId && w.parameter === parameterName
    ),
    ...result.info.filter(
      (i) => i.nodeId === nodeId && i.parameter === parameterName
    ),
  ];
}

/**
 * Check if script is safe to export
 */
export function canExportScript(result: ValidationResult): boolean {
  return result.valid && result.errors.length === 0;
}

/**
 * Get validation summary text
 */
export function getValidationSummary(result: ValidationResult): string {
  if (result.valid) {
    return `✅ Script is valid (Score: ${result.score}/100)`;
  }

  const parts: string[] = [];
  if (result.errors.length > 0) {
    parts.push(`${result.errors.length} error${result.errors.length > 1 ? 's' : ''}`);
  }
  if (result.warnings.length > 0) {
    parts.push(
      `${result.warnings.length} warning${result.warnings.length > 1 ? 's' : ''}`
    );
  }
  if (result.info.length > 0) {
    parts.push(
      `${result.info.length} suggestion${result.info.length > 1 ? 's' : ''}`
    );
  }

  return `⚠️ ${parts.join(', ')} (Score: ${result.score}/100)`;
}
