/**
 * TrinityCore SAI Unified Editor - SQL Parser
 *
 * Complete SQL import functionality for smart_scripts table.
 * Parses SQL INSERT statements and reconstructs node graph.
 *
 * @module sai-unified/sql-parser
 * @version 3.0.0
 */

import type { SAIScript, SAINode, SAIConnection, SAISourceType } from './types';
import { getEventType, getActionType, getTargetType } from './constants';
import { getParametersForEvent, getParametersForAction, getParametersForTarget } from './parameters';

// ============================================================================
// SQL PARSING
// ============================================================================

/**
 * Parse SQL to SAI script
 */
export function parseSQL(sql: string): SAIScript | null {
  try {
    // Clean and normalize SQL
    const normalized = normalizSQL(sql);

    // Extract metadata
    const metadata = extractMetadata(normalized);

    // Parse DELETE statement
    const deleteInfo = parseDeleteStatement(normalized);
    if (!deleteInfo) {
      throw new Error('Could not parse DELETE statement');
    }

    // Parse INSERT VALUES
    const entries = parseInsertValues(normalized);
    if (entries.length === 0) {
      throw new Error('No valid entries found in SQL');
    }

    // Build node graph
    const { nodes, connections } = buildNodeGraph(entries);

    // Create script
    const script: SAIScript = {
      id: `script-${Date.now()}`,
      name: metadata.name || `SAI Script ${deleteInfo.entryorguid}`,
      entryOrGuid: deleteInfo.entryorguid,
      sourceType: deleteInfo.source_type,
      nodes,
      connections,
      metadata: {
        version: '3.0.0',
        createdAt: Date.now(),
        modifiedAt: Date.now(),
        author: metadata.author,
        description: metadata.description || 'Imported from SQL',
        tags: metadata.tags,
      },
    };

    return script;
  } catch (error) {
    console.error('SQL parsing error:', error);
    return null;
  }
}

/**
 * Parse multiple SQL scripts from batch file
 */
export function parseBatchSQL(sql: string): SAIScript[] {
  const scripts: SAIScript[] = [];

  // Split by DELETE statements (each script starts with DELETE)
  const scriptBlocks = sql.split(/DELETE FROM/i);

  scriptBlocks.forEach((block, idx) => {
    if (idx === 0 && !block.trim()) return; // Skip empty first block

    // Reconstruct DELETE statement
    const scriptSQL = idx > 0 ? 'DELETE FROM' + block : block;

    const script = parseSQL(scriptSQL);
    if (script) {
      scripts.push(script);
    }
  });

  return scripts;
}

// ============================================================================
// SQL NORMALIZATION
// ============================================================================

/**
 * Normalize SQL for parsing
 */
function normalizSQL(sql: string): string {
  // Remove SQL comments (-- style)
  let normalized = sql.replace(/--[^\n]*/g, '');

  // Remove SQL comments (/* */ style)
  normalized = normalized.replace(/\/\*[\s\S]*?\*\//g, '');

  // Normalize whitespace
  normalized = normalized.replace(/\s+/g, ' ').trim();

  // Remove backticks around table/column names
  normalized = normalized.replace(/`/g, '');

  return normalized;
}

// ============================================================================
// METADATA EXTRACTION
// ============================================================================

/**
 * Extract metadata from SQL comments
 */
function extractMetadata(sql: string): {
  name?: string;
  author?: string;
  description?: string;
  tags?: string[];
} {
  const metadata: any = {};

  // Extract from original (with comments)
  const nameMatch = sql.match(/--\s*(?:SAI Script|Script):\s*(.+)/i);
  if (nameMatch) {
    metadata.name = nameMatch[1].trim();
  }

  const authorMatch = sql.match(/--\s*Author:\s*(.+)/i);
  if (authorMatch) {
    metadata.author = authorMatch[1].trim();
  }

  const descMatch = sql.match(/--\s*Description:\s*(.+)/i);
  if (descMatch) {
    metadata.description = descMatch[1].trim();
  }

  const tagsMatch = sql.match(/--\s*Tags:\s*(.+)/i);
  if (tagsMatch) {
    metadata.tags = tagsMatch[1].split(',').map((t) => t.trim());
  }

  return metadata;
}

// ============================================================================
// DELETE STATEMENT PARSING
// ============================================================================

/**
 * Parse DELETE statement
 */
function parseDeleteStatement(sql: string): {
  entryorguid: number;
  source_type: number;
} | null {
  // Match: DELETE FROM smart_scripts WHERE entryorguid = X AND source_type = Y
  const match = sql.match(
    /DELETE\s+FROM\s+smart_scripts\s+WHERE\s+entryorguid\s*=\s*(-?\d+)\s+AND\s+source_type\s*=\s*(\d+)/i
  );

  if (match) {
    return {
      entryorguid: parseInt(match[1]),
      source_type: parseInt(match[2]),
    };
  }

  return null;
}

// ============================================================================
// INSERT VALUES PARSING
// ============================================================================

/**
 * Parse INSERT VALUES entries
 */
function parseInsertValues(sql: string): SQLEntry[] {
  const entries: SQLEntry[] = [];

  // Find VALUES clause
  const valuesMatch = sql.match(/VALUES\s*(.+)/is);
  if (!valuesMatch) return entries;

  let valuesStr = valuesMatch[1];

  // Remove trailing semicolon
  valuesStr = valuesStr.replace(/;\s*$/, '');

  // Split into individual entries - handle nested parentheses properly
  const entryStrings = splitSQLEntries(valuesStr);

  entryStrings.forEach((entryStr) => {
    const entry = parseSQLEntry(entryStr);
    if (entry) {
      entries.push(entry);
    }
  });

  return entries;
}

/**
 * Split SQL VALUES into individual entries
 */
function splitSQLEntries(valuesStr: string): string[] {
  const entries: string[] = [];
  let current = '';
  let depth = 0;
  let inString = false;
  let stringChar = '';

  for (let i = 0; i < valuesStr.length; i++) {
    const char = valuesStr[i];
    const prevChar = i > 0 ? valuesStr[i - 1] : '';

    // Track string state
    if ((char === "'" || char === '"') && prevChar !== '\\') {
      if (!inString) {
        inString = true;
        stringChar = char;
      } else if (char === stringChar) {
        inString = false;
      }
    }

    // Track parentheses depth (only outside strings)
    if (!inString) {
      if (char === '(') {
        depth++;
      } else if (char === ')') {
        depth--;

        // Complete entry at depth 0
        if (depth === 0) {
          current += char;
          entries.push(current.trim());
          current = '';
          continue;
        }
      } else if (char === ',' && depth === 0) {
        // Skip commas between entries
        continue;
      }
    }

    current += char;
  }

  // Add final entry if exists
  if (current.trim()) {
    entries.push(current.trim());
  }

  return entries;
}

/**
 * Parse individual SQL entry
 */
function parseSQLEntry(entryStr: string): SQLEntry | null {
  // Remove outer parentheses
  entryStr = entryStr.trim();
  if (entryStr.startsWith('(')) {
    entryStr = entryStr.substring(1);
  }
  if (entryStr.endsWith(')')) {
    entryStr = entryStr.substring(0, entryStr.length - 1);
  }

  // Split into values - handle quoted strings properly
  const values = splitSQLValues(entryStr);

  if (values.length < 28) {
    console.warn('SQL entry has insufficient values:', values.length);
    return null;
  }

  try {
    const entry: SQLEntry = {
      entryorguid: parseInt(values[0]),
      source_type: parseInt(values[1]),
      id: parseInt(values[2]),
      link: parseInt(values[3]),

      event_type: parseInt(values[4]),
      event_phase_mask: parseInt(values[5]),
      event_chance: parseInt(values[6]),
      event_flags: parseInt(values[7]),
      event_param1: parseInt(values[8]),
      event_param2: parseInt(values[9]),
      event_param3: parseInt(values[10]),
      event_param4: parseInt(values[11]),
      event_param5: parseInt(values[12]),

      action_type: parseInt(values[13]),
      action_param1: parseInt(values[14]),
      action_param2: parseInt(values[15]),
      action_param3: parseInt(values[16]),
      action_param4: parseInt(values[17]),
      action_param5: parseInt(values[18]),
      action_param6: parseInt(values[19]),

      target_type: parseInt(values[20]),
      target_param1: parseInt(values[21]),
      target_param2: parseInt(values[22]),
      target_param3: parseInt(values[23]),
      target_param4: parseInt(values[24]),
      target_x: parseFloat(values[25]),
      target_y: parseFloat(values[26]),
      target_z: parseFloat(values[27]),
      target_o: parseFloat(values[28]),

      comment: values[29] ? unescapeSQL(values[29]) : '',
    };

    return entry;
  } catch (error) {
    console.error('Error parsing SQL entry:', error);
    return null;
  }
}

/**
 * Split SQL entry values handling quoted strings
 */
function splitSQLValues(str: string): string[] {
  const values: string[] = [];
  let current = '';
  let inString = false;
  let stringChar = '';

  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    const prevChar = i > 0 ? str[i - 1] : '';

    // Track string state
    if ((char === "'" || char === '"') && prevChar !== '\\') {
      if (!inString) {
        inString = true;
        stringChar = char;
        continue; // Skip opening quote
      } else if (char === stringChar) {
        inString = false;
        values.push(current);
        current = '';
        continue; // Skip closing quote
      }
    }

    // Split on comma outside strings
    if (!inString && char === ',') {
      if (current.trim()) {
        values.push(current.trim());
      }
      current = '';
      continue;
    }

    if (inString || char !== ' ' || current.length > 0) {
      current += char;
    }
  }

  // Add final value
  if (current.trim()) {
    values.push(current.trim());
  }

  return values;
}

/**
 * Unescape SQL string
 */
function unescapeSQL(str: string): string {
  return str.replace(/''/g, "'");
}

// ============================================================================
// NODE GRAPH CONSTRUCTION
// ============================================================================

/**
 * Build node graph from SQL entries
 */
function buildNodeGraph(entries: SQLEntry[]): {
  nodes: SAINode[];
  connections: SAIConnection[];
} {
  const nodes: SAINode[] = [];
  const connections: SAIConnection[] = [];

  // Track created nodes by entry ID to avoid duplicates
  const eventNodeMap = new Map<string, SAINode>();
  const actionNodeMap = new Map<string, SAINode>();
  const targetNodeMap = new Map<string, SAINode>();

  entries.forEach((entry, entryIdx) => {
    // Create event node (or reuse if same event)
    const eventKey = `event-${entry.event_type}-${entry.id}`;
    let eventNode = eventNodeMap.get(eventKey);

    if (!eventNode) {
      eventNode = createEventNode(entry, entryIdx);
      nodes.push(eventNode);
      eventNodeMap.set(eventKey, eventNode);
    }

    // Create action node
    const actionNode = createActionNode(entry, entryIdx);
    nodes.push(actionNode);
    actionNodeMap.set(actionNode.id, actionNode);

    // Create connection: event -> action
    connections.push({
      id: `conn-e-a-${entryIdx}`,
      source: eventNode.id,
      target: actionNode.id,
      type: 'event-to-action',
    });

    // Create target node (if target_type > 0)
    if (entry.target_type > 0) {
      const targetNode = createTargetNode(entry, entryIdx);
      nodes.push(targetNode);
      targetNodeMap.set(targetNode.id, targetNode);

      // Create connection: action -> target
      connections.push({
        id: `conn-a-t-${entryIdx}`,
        source: actionNode.id,
        target: targetNode.id,
        type: 'action-to-target',
      });
    }

    // Handle event links
    if (entry.link > 0) {
      const linkedEventKey = `event-link-${entry.link}`;
      // Note: Linked event will be created when we parse its entry
      // We'll create link connections in a second pass
    }
  });

  return { nodes, connections };
}

/**
 * Create event node from SQL entry
 */
function createEventNode(entry: SQLEntry, index: number): SAINode {
  const eventType = getEventType(entry.event_type.toString());
  const label = eventType?.label || `Event ${entry.event_type}`;

  // Get parameters
  const parameters = getParametersForEvent(entry.event_type.toString());

  // Set parameter values
  if (parameters[0]) parameters[0].value = entry.event_param1;
  if (parameters[1]) parameters[1].value = entry.event_param2;
  if (parameters[2]) parameters[2].value = entry.event_param3;
  if (parameters[3]) parameters[3].value = entry.event_param4;
  if (parameters[4]) parameters[4].value = entry.event_param5;

  return {
    id: `event-${index}-${Date.now()}`,
    type: 'event',
    typeId: entry.event_type.toString(),
    typeName: eventType?.name || 'UNKNOWN',
    label,
    parameters,
    position: { x: 50, y: 50 + index * 150 },
    phase: entry.event_phase_mask,
    chance: entry.event_chance,
    flags: entry.event_flags,
    link: entry.link,
  };
}

/**
 * Create action node from SQL entry
 */
function createActionNode(entry: SQLEntry, index: number): SAINode {
  const actionType = getActionType(entry.action_type.toString());
  const label = actionType?.label || `Action ${entry.action_type}`;

  // Get parameters
  const parameters = getParametersForAction(entry.action_type.toString());

  // Set parameter values
  if (parameters[0]) parameters[0].value = entry.action_param1;
  if (parameters[1]) parameters[1].value = entry.action_param2;
  if (parameters[2]) parameters[2].value = entry.action_param3;
  if (parameters[3]) parameters[3].value = entry.action_param4;
  if (parameters[4]) parameters[4].value = entry.action_param5;
  if (parameters[5]) parameters[5].value = entry.action_param6;

  return {
    id: `action-${index}-${Date.now()}`,
    type: 'action',
    typeId: entry.action_type.toString(),
    typeName: actionType?.name || 'UNKNOWN',
    label,
    parameters,
    position: { x: 350, y: 50 + index * 150 },
  };
}

/**
 * Create target node from SQL entry
 */
function createTargetNode(entry: SQLEntry, index: number): SAINode {
  const targetType = getTargetType(entry.target_type.toString());
  const label = targetType?.label || `Target ${entry.target_type}`;

  // Get parameters
  const parameters = getParametersForTarget(entry.target_type.toString());

  // Set parameter values
  if (parameters[0]) parameters[0].value = entry.target_param1;
  if (parameters[1]) parameters[1].value = entry.target_param2;
  if (parameters[2]) parameters[2].value = entry.target_param3;
  if (parameters[3]) parameters[3].value = entry.target_param4;

  // Handle position parameters (X, Y, Z, O)
  if (entry.target_x !== 0 || entry.target_y !== 0 || entry.target_z !== 0) {
    parameters.push(
      { name: 'X', value: entry.target_x, type: 'number', description: 'X coordinate' },
      { name: 'Y', value: entry.target_y, type: 'number', description: 'Y coordinate' },
      { name: 'Z', value: entry.target_z, type: 'number', description: 'Z coordinate' },
      { name: 'O', value: entry.target_o, type: 'number', description: 'Orientation' }
    );
  }

  return {
    id: `target-${index}-${Date.now()}`,
    type: 'target',
    typeId: entry.target_type.toString(),
    typeName: targetType?.name || 'UNKNOWN',
    label,
    parameters,
    position: { x: 650, y: 50 + index * 150 },
  };
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
// VALIDATION
// ============================================================================

/**
 * Validate SQL before parsing
 */
export function validateSQL(sql: string): { valid: boolean; error?: string } {
  // Check for DELETE statement
  if (!sql.match(/DELETE\s+FROM\s+smart_scripts/i)) {
    return {
      valid: false,
      error: 'Missing DELETE FROM smart_scripts statement',
    };
  }

  // Check for INSERT statement
  if (!sql.match(/INSERT\s+INTO\s+smart_scripts/i)) {
    return {
      valid: false,
      error: 'Missing INSERT INTO smart_scripts statement',
    };
  }

  // Check for VALUES clause
  if (!sql.match(/VALUES/i)) {
    return {
      valid: false,
      error: 'Missing VALUES clause',
    };
  }

  return { valid: true };
}

/**
 * Get SQL import statistics
 */
export function getSQLImportStatistics(sql: string): {
  entriesCount: number;
  estimatedEvents: number;
  estimatedActions: number;
  estimatedTargets: number;
  hasMetadata: boolean;
} {
  const normalized = normalizSQL(sql);
  const entries = parseInsertValues(normalized);
  const metadata = extractMetadata(sql);

  const uniqueEvents = new Set(entries.map((e) => e.event_type)).size;
  const targetCount = entries.filter((e) => e.target_type > 0).length;

  return {
    entriesCount: entries.length,
    estimatedEvents: uniqueEvents,
    estimatedActions: entries.length,
    estimatedTargets: targetCount,
    hasMetadata: !!(metadata.name || metadata.author || metadata.description),
  };
}
