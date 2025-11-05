/**
 * TrinityCore SAI Unified Editor - SQL Generator
 *
 * Generates optimized SQL INSERT statements from SAI scripts.
 * Supports TrinityCore smart_scripts table format.
 *
 * @module sai-unified/sql-generator
 * @version 3.0.0
 */

import type { SAIScript, SAINode, SAIConnection, ExportOptions } from './types';
import { getEventType, getActionType, getTargetType } from './constants';

// ============================================================================
// SQL GENERATION
// ============================================================================

/**
 * Generate complete SQL for a SAI script
 */
export function generateSQL(
  script: SAIScript,
  options: Partial<ExportOptions> = {}
): string {
  const opts: ExportOptions = {
    format: 'sql',
    includeComments: true,
    prettyPrint: true,
    includeMetadata: true,
    compress: false,
    ...options,
  };

  let sql = '';

  // Header comments
  if (opts.includeComments) {
    sql += generateHeader(script, opts);
  }

  // DELETE statement
  sql += generateDeleteStatement(script);
  sql += '\n';

  // INSERT statement
  sql += generateInsertStatement(script, opts);

  return sql;
}

/**
 * Generate SQL header with metadata
 */
function generateHeader(script: SAIScript, options: ExportOptions): string {
  let header = '-- ============================================================================\n';
  header += `-- SAI Script: ${script.name}\n`;
  header += '-- ============================================================================\n';

  if (options.includeMetadata && script.metadata) {
    header += `-- Entry/GUID: ${script.entryOrGuid}\n`;
    header += `-- Source Type: ${getSourceTypeName(script.sourceType)}\n`;

    if (script.metadata.description) {
      header += `-- Description: ${script.metadata.description}\n`;
    }

    if (script.metadata.author) {
      header += `-- Author: ${script.metadata.author}\n`;
    }

    header += `-- Created: ${new Date(script.metadata.createdAt).toISOString()}\n`;
    header += `-- Modified: ${new Date(script.metadata.modifiedAt).toISOString()}\n`;

    if (script.metadata.tags && script.metadata.tags.length > 0) {
      header += `-- Tags: ${script.metadata.tags.join(', ')}\n`;
    }
  }

  header += `-- Generated: ${new Date().toISOString()}\n`;
  header += `-- Generator: TrinityCore SAI Unified Editor v3.0.0\n`;
  header += '-- ============================================================================\n\n';

  return header;
}

/**
 * Generate DELETE statement
 */
function generateDeleteStatement(script: SAIScript): string {
  return `DELETE FROM \`smart_scripts\` WHERE \`entryorguid\` = ${script.entryOrGuid} AND \`source_type\` = ${script.sourceType};\n`;
}

/**
 * Generate INSERT statement with all entries
 */
function generateInsertStatement(script: SAIScript, options: ExportOptions): string {
  const entries = buildSQLEntries(script, options);

  if (entries.length === 0) {
    return '-- No valid SAI entries to generate\n';
  }

  let sql = 'INSERT INTO `smart_scripts` (\n';
  sql += '  `entryorguid`, `source_type`, `id`, `link`,\n';
  sql += '  `event_type`, `event_phase_mask`, `event_chance`, `event_flags`,\n';
  sql += '  `event_param1`, `event_param2`, `event_param3`, `event_param4`, `event_param5`,\n';
  sql += '  `action_type`, `action_param1`, `action_param2`, `action_param3`, `action_param4`, `action_param5`, `action_param6`,\n';
  sql += '  `target_type`, `target_param1`, `target_param2`, `target_param3`, `target_param4`,\n';
  sql += '  `target_x`, `target_y`, `target_z`, `target_o`,\n';
  sql += '  `comment`\n';
  sql += ') VALUES\n';

  // Add entries
  const sqlEntries = entries.map((entry, idx) => {
    const isLast = idx === entries.length - 1;
    return formatSQLEntry(entry, options, isLast);
  });

  sql += sqlEntries.join(',\n');
  sql += ';\n';

  return sql;
}

/**
 * Build array of SQL entry objects
 */
function buildSQLEntries(script: SAIScript, options: ExportOptions): SQLEntry[] {
  const entries: SQLEntry[] = [];
  let id = 0;

  // Group by events
  const eventNodes = script.nodes.filter((n) => n.type === 'event');

  eventNodes.forEach((eventNode) => {
    // Find actions connected to this event
    const actionConnections = script.connections.filter(
      (c) => c.source === eventNode.id && c.type === 'event-to-action'
    );

    if (actionConnections.length === 0) {
      // Event with no actions - skip or warn
      if (options.includeComments) {
        console.warn(`Event ${eventNode.id} has no connected actions`);
      }
      return;
    }

    actionConnections.forEach((actionConn) => {
      const actionNode = script.nodes.find((n) => n.id === actionConn.target);
      if (!actionNode) return;

      // Find target connected to this action
      const targetConnection = script.connections.find(
        (c) => c.source === actionNode.id && c.type === 'action-to-target'
      );
      const targetNode = targetConnection
        ? script.nodes.find((n) => n.id === targetConnection.target)
        : null;

      // Build SQL entry
      const entry: SQLEntry = {
        entryorguid: script.entryOrGuid,
        source_type: script.sourceType,
        id: id,
        link: eventNode.link || 0,

        // Event fields
        event_type: parseInt(eventNode.typeId),
        event_phase_mask: eventNode.phase || 0,
        event_chance: eventNode.chance || 100,
        event_flags: eventNode.flags || 0,
        event_param1: getParamValue(eventNode, 0),
        event_param2: getParamValue(eventNode, 1),
        event_param3: getParamValue(eventNode, 2),
        event_param4: getParamValue(eventNode, 3),
        event_param5: getParamValue(eventNode, 4),

        // Action fields
        action_type: parseInt(actionNode.typeId),
        action_param1: getParamValue(actionNode, 0),
        action_param2: getParamValue(actionNode, 1),
        action_param3: getParamValue(actionNode, 2),
        action_param4: getParamValue(actionNode, 3),
        action_param5: getParamValue(actionNode, 4),
        action_param6: getParamValue(actionNode, 5),

        // Target fields
        target_type: targetNode ? parseInt(targetNode.typeId) : 0,
        target_param1: targetNode ? getParamValue(targetNode, 0) : 0,
        target_param2: targetNode ? getParamValue(targetNode, 1) : 0,
        target_param3: targetNode ? getParamValue(targetNode, 2) : 0,
        target_param4: targetNode ? getParamValue(targetNode, 3) : 0,
        target_x: 0,
        target_y: 0,
        target_z: 0,
        target_o: 0,

        // Comment
        comment: generateComment(eventNode, actionNode, targetNode),
      };

      entries.push(entry);
      id++;
    });
  });

  return entries;
}

/**
 * Format a SQL entry as a string
 */
function formatSQLEntry(
  entry: SQLEntry,
  options: ExportOptions,
  isLast: boolean
): string {
  if (options.prettyPrint) {
    let sql = '(\n';
    sql += `  ${entry.entryorguid}, ${entry.source_type}, ${entry.id}, ${entry.link},\n`;
    sql += `  ${entry.event_type}, ${entry.event_phase_mask}, ${entry.event_chance}, ${entry.event_flags},\n`;
    sql += `  ${entry.event_param1}, ${entry.event_param2}, ${entry.event_param3}, ${entry.event_param4}, ${entry.event_param5},\n`;
    sql += `  ${entry.action_type}, ${entry.action_param1}, ${entry.action_param2}, ${entry.action_param3}, ${entry.action_param4}, ${entry.action_param5}, ${entry.action_param6},\n`;
    sql += `  ${entry.target_type}, ${entry.target_param1}, ${entry.target_param2}, ${entry.target_param3}, ${entry.target_param4},\n`;
    sql += `  ${entry.target_x}, ${entry.target_y}, ${entry.target_z}, ${entry.target_o},\n`;
    sql += `  ${escapeSQL(entry.comment)}\n`;
    sql += ')';
    return sql;
  } else {
    // Compact format
    return `(${entry.entryorguid}, ${entry.source_type}, ${entry.id}, ${entry.link}, ${entry.event_type}, ${entry.event_phase_mask}, ${entry.event_chance}, ${entry.event_flags}, ${entry.event_param1}, ${entry.event_param2}, ${entry.event_param3}, ${entry.event_param4}, ${entry.event_param5}, ${entry.action_type}, ${entry.action_param1}, ${entry.action_param2}, ${entry.action_param3}, ${entry.action_param4}, ${entry.action_param5}, ${entry.action_param6}, ${entry.target_type}, ${entry.target_param1}, ${entry.target_param2}, ${entry.target_param3}, ${entry.target_param4}, ${entry.target_x}, ${entry.target_y}, ${entry.target_z}, ${entry.target_o}, ${escapeSQL(entry.comment)})`;
  }
}

/**
 * Generate human-readable comment for SQL entry
 */
function generateComment(
  eventNode: SAINode,
  actionNode: SAINode,
  targetNode: SAINode | null
): string {
  let comment = '';

  // Event part
  const eventType = getEventType(eventNode.typeId);
  comment += eventType ? eventType.label : eventNode.label;

  // Add relevant event parameters to comment
  const eventParams = getRelevantParams(eventNode);
  if (eventParams.length > 0) {
    comment += ` (${eventParams.join(', ')})`;
  }

  comment += ' - ';

  // Action part
  const actionType = getActionType(actionNode.typeId);
  comment += actionType ? actionType.label : actionNode.label;

  // Add relevant action parameters
  const actionParams = getRelevantParams(actionNode);
  if (actionParams.length > 0) {
    comment += ` (${actionParams.join(', ')})`;
  }

  // Target part (if present)
  if (targetNode) {
    comment += ' on ';
    const targetType = getTargetType(targetNode.typeId);
    comment += targetType ? targetType.label : targetNode.label;

    const targetParams = getRelevantParams(targetNode);
    if (targetParams.length > 0) {
      comment += ` (${targetParams.join(', ')})`;
    }
  }

  return comment;
}

/**
 * Get relevant (non-zero) parameters for comment
 */
function getRelevantParams(node: SAINode): string[] {
  const relevant: string[] = [];

  node.parameters.forEach((param) => {
    // Skip zero values unless it's a required parameter
    if (param.value === 0 && !param.required) return;

    // Format based on type
    let formatted = '';
    if (param.type === 'spell' || param.type === 'creature' || param.type === 'item' || param.type === 'quest' || param.type === 'gameobject') {
      formatted = `${param.name}: ${param.value}`;
    } else if (param.type === 'enum' && param.options) {
      const option = param.options.find((o) => o.value === param.value);
      formatted = `${param.name}: ${option?.label || param.value}`;
    } else if (param.units) {
      formatted = `${param.name}: ${param.value}${param.units}`;
    } else if (param.value !== 0) {
      formatted = `${param.name}: ${param.value}`;
    }

    if (formatted) {
      relevant.push(formatted);
    }
  });

  return relevant;
}

/**
 * Get parameter value by index from node
 */
function getParamValue(node: SAINode, index: number): number {
  if (index >= node.parameters.length) return 0;

  const param = node.parameters[index];
  const value = param.value;

  // Convert to number
  if (typeof value === 'number') {
    return value;
  } else if (typeof value === 'string') {
    const num = parseInt(value, 10);
    return isNaN(num) ? 0 : num;
  }

  return 0;
}

/**
 * Escape SQL string
 */
function escapeSQL(str: string): string {
  return `'${str.replace(/'/g, "''")}'`;
}

/**
 * Get source type name
 */
function getSourceTypeName(sourceType: number): string {
  const names: Record<number, string> = {
    0: 'Creature',
    1: 'GameObject',
    2: 'AreaTrigger',
    3: 'Event',
    4: 'Gossip',
    5: 'Quest',
    6: 'Spell',
    7: 'Transport',
    8: 'Instance',
    9: 'Timed Actionlist',
  };

  return names[sourceType] || `Unknown (${sourceType})`;
}

// ============================================================================
// SQL ENTRY TYPE
// ============================================================================

interface SQLEntry {
  entryorguid: number;
  source_type: number;
  id: number;
  link: number;

  event_type: number;
  event_phase_mask: number;
  event_chance: number;
  event_flags: number;
  event_param1: number;
  event_param2: number;
  event_param3: number;
  event_param4: number;
  event_param5: number;

  action_type: number;
  action_param1: number;
  action_param2: number;
  action_param3: number;
  action_param4: number;
  action_param5: number;
  action_param6: number;

  target_type: number;
  target_param1: number;
  target_param2: number;
  target_param3: number;
  target_param4: number;
  target_x: number;
  target_y: number;
  target_z: number;
  target_o: number;

  comment: string;
}

// ============================================================================
// BATCH EXPORT
// ============================================================================

/**
 * Export multiple scripts to a single SQL file
 */
export function generateBatchSQL(
  scripts: SAIScript[],
  options: Partial<ExportOptions> = {}
): string {
  let sql = '';

  if (options.includeComments) {
    sql += '-- ============================================================================\n';
    sql += '-- TrinityCore SAI Batch Export\n';
    sql += `-- Scripts: ${scripts.length}\n`;
    sql += `-- Generated: ${new Date().toISOString()}\n`;
    sql += '-- ============================================================================\n\n';
  }

  scripts.forEach((script, idx) => {
    if (idx > 0) {
      sql += '\n\n';
    }

    sql += generateSQL(script, options);
  });

  return sql;
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate script can be exported to SQL
 */
export function canExportToSQL(script: SAIScript): { valid: boolean; error?: string } {
  // Must have valid entry/guid
  if (!script.entryOrGuid || script.entryOrGuid === 0) {
    return {
      valid: false,
      error: 'Script must have a valid entry or GUID',
    };
  }

  // Must have at least one event
  const eventNodes = script.nodes.filter((n) => n.type === 'event');
  if (eventNodes.length === 0) {
    return {
      valid: false,
      error: 'Script must have at least one event',
    };
  }

  // Must have at least one action
  const actionNodes = script.nodes.filter((n) => n.type === 'action');
  if (actionNodes.length === 0) {
    return {
      valid: false,
      error: 'Script must have at least one action',
    };
  }

  // Check that events have actions
  let hasValidChain = false;
  eventNodes.forEach((event) => {
    const hasAction = script.connections.some(
      (c) => c.source === event.id && c.type === 'event-to-action'
    );
    if (hasAction) {
      hasValidChain = true;
    }
  });

  if (!hasValidChain) {
    return {
      valid: false,
      error: 'No events are connected to actions',
    };
  }

  return { valid: true };
}

// ============================================================================
// SQL UTILITIES
// ============================================================================

/**
 * Generate UPDATE statement for existing entry
 */
export function generateUpdateSQL(
  script: SAIScript,
  entryId: number
): string {
  let sql = '-- Update existing SAI entry\n';
  sql += `UPDATE \`smart_scripts\` SET\n`;

  const entries = buildSQLEntries(script, { format: 'sql', includeComments: false, prettyPrint: true, includeMetadata: false });

  if (entries.length === 0) {
    return '-- No entries to update\n';
  }

  const entry = entries[entryId] || entries[0];

  sql += `  \`event_type\` = ${entry.event_type},\n`;
  sql += `  \`event_phase_mask\` = ${entry.event_phase_mask},\n`;
  sql += `  \`event_chance\` = ${entry.event_chance},\n`;
  sql += `  \`event_flags\` = ${entry.event_flags},\n`;
  sql += `  \`event_param1\` = ${entry.event_param1},\n`;
  sql += `  \`event_param2\` = ${entry.event_param2},\n`;
  sql += `  \`event_param3\` = ${entry.event_param3},\n`;
  sql += `  \`event_param4\` = ${entry.event_param4},\n`;
  sql += `  \`event_param5\` = ${entry.event_param5},\n`;
  sql += `  \`action_type\` = ${entry.action_type},\n`;
  sql += `  \`action_param1\` = ${entry.action_param1},\n`;
  sql += `  \`action_param2\` = ${entry.action_param2},\n`;
  sql += `  \`action_param3\` = ${entry.action_param3},\n`;
  sql += `  \`action_param4\` = ${entry.action_param4},\n`;
  sql += `  \`action_param5\` = ${entry.action_param5},\n`;
  sql += `  \`action_param6\` = ${entry.action_param6},\n`;
  sql += `  \`target_type\` = ${entry.target_type},\n`;
  sql += `  \`target_param1\` = ${entry.target_param1},\n`;
  sql += `  \`target_param2\` = ${entry.target_param2},\n`;
  sql += `  \`target_param3\` = ${entry.target_param3},\n`;
  sql += `  \`target_param4\` = ${entry.target_param4},\n`;
  sql += `  \`comment\` = ${escapeSQL(entry.comment)}\n`;
  sql += `WHERE \`entryorguid\` = ${script.entryOrGuid} AND \`source_type\` = ${script.sourceType} AND \`id\` = ${entryId};\n`;

  return sql;
}

/**
 * Get SQL statistics
 */
export function getSQLStatistics(script: SAIScript): {
  eventCount: number;
  actionCount: number;
  targetCount: number;
  entriesCount: number;
  estimatedSize: number;
} {
  const entries = buildSQLEntries(script, { format: 'sql', includeComments: false, prettyPrint: false, includeMetadata: false });
  const sql = generateSQL(script, { includeComments: false, prettyPrint: false });

  return {
    eventCount: script.nodes.filter((n) => n.type === 'event').length,
    actionCount: script.nodes.filter((n) => n.type === 'action').length,
    targetCount: script.nodes.filter((n) => n.type === 'target').length,
    entriesCount: entries.length,
    estimatedSize: sql.length,
  };
}
