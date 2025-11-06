/**
 * TrinityCore SAI Unified Editor - Database Validation
 *
 * Real-time validation against TrinityCore database using MCP tools.
 * Validates spell IDs, item IDs, quest IDs, creature IDs, and gameobject IDs.
 *
 * @module sai-unified/database-validation
 * @version 3.0.0
 */

import type { SAIScript, SAINode, SAIParameter, ValidationError } from './types';

// ============================================================================
// TYPES
// ============================================================================

export type ValidationType = 'spell' | 'item' | 'quest' | 'creature' | 'gameobject';

export interface DatabaseValidationRequest {
  type: ValidationType;
  id: number;
}

export interface DatabaseValidationResponse {
  valid: boolean;
  exists: boolean;
  data?: any;
  error?: string;
  cached?: boolean;
}

export interface BatchValidationResponse {
  results: (DatabaseValidationResponse & { type: ValidationType; id: number })[];
  total: number;
  valid: number;
  exists: number;
}

// ============================================================================
// CLIENT-SIDE CACHE
// ============================================================================

const clientCache = new Map<string, { result: DatabaseValidationResponse; timestamp: number }>();
const CLIENT_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

function getCacheKey(type: ValidationType, id: number): string {
  return `${type}:${id}`;
}

function getFromClientCache(type: ValidationType, id: number): DatabaseValidationResponse | null {
  const key = getCacheKey(type, id);
  const cached = clientCache.get(key);

  if (cached && Date.now() - cached.timestamp < CLIENT_CACHE_DURATION) {
    return cached.result;
  }

  return null;
}

function setInClientCache(type: ValidationType, id: number, result: DatabaseValidationResponse): void {
  const key = getCacheKey(type, id);
  clientCache.set(key, { result, timestamp: Date.now() });
}

// ============================================================================
// API CALLS
// ============================================================================

/**
 * Validate a single ID against the database
 */
export async function validateID(type: ValidationType, id: number): Promise<DatabaseValidationResponse> {
  // Check client cache first
  const cached = getFromClientCache(type, id);
  if (cached) {
    return { ...cached, cached: true };
  }

  try {
    const response = await fetch('/api/sai/validate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ type, id }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Validation request failed');
    }

    const result: DatabaseValidationResponse = await response.json();

    // Cache the result
    setInClientCache(type, id, result);

    return result;
  } catch (error: any) {
    console.error(`[DB Validation] Failed to validate ${type} ${id}:`, error);

    return {
      valid: false,
      exists: false,
      error: error.message || 'Validation failed',
    };
  }
}

/**
 * Validate multiple IDs in a single batch request
 */
export async function validateBatch(validations: DatabaseValidationRequest[]): Promise<BatchValidationResponse> {
  // Filter out cached items
  const uncached: DatabaseValidationRequest[] = [];
  const cachedResults: (DatabaseValidationResponse & { type: ValidationType; id: number })[] = [];

  for (const validation of validations) {
    const cached = getFromClientCache(validation.type, validation.id);
    if (cached) {
      cachedResults.push({
        type: validation.type,
        id: validation.id,
        ...cached,
        cached: true,
      });
    } else {
      uncached.push(validation);
    }
  }

  // If all are cached, return immediately
  if (uncached.length === 0) {
    return {
      results: cachedResults,
      total: cachedResults.length,
      valid: cachedResults.filter(r => r.valid).length,
      exists: cachedResults.filter(r => r.exists).length,
    };
  }

  try {
    const response = await fetch('/api/sai/validate', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ validations: uncached }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Batch validation request failed');
    }

    const result: BatchValidationResponse = await response.json();

    // Cache all results
    for (const item of result.results) {
      setInClientCache(item.type, item.id, {
        valid: item.valid,
        exists: item.exists,
        data: item.data,
        error: item.error,
      });
    }

    // Combine cached and new results
    const allResults = [...cachedResults, ...result.results];

    return {
      results: allResults,
      total: allResults.length,
      valid: allResults.filter(r => r.valid).length,
      exists: allResults.filter(r => r.exists).length,
    };
  } catch (error: any) {
    console.error('[DB Validation] Batch validation failed:', error);

    // Return cached results with error
    return {
      results: cachedResults,
      total: cachedResults.length,
      valid: cachedResults.filter(r => r.valid).length,
      exists: cachedResults.filter(r => r.exists).length,
    };
  }
}

/**
 * Clear client-side validation cache
 */
export function clearValidationCache(): void {
  clientCache.clear();
}

// ============================================================================
// SAI PARAMETER VALIDATION
// ============================================================================

/**
 * Extract IDs that need validation from SAI parameters
 */
export function extractValidationRequests(node: SAINode): DatabaseValidationRequest[] {
  const requests: DatabaseValidationRequest[] = [];

  // Common parameter names that reference database IDs
  const parameterMappings: Record<string, ValidationType> = {
    // Spell parameters
    'spell_id': 'spell',
    'spellId': 'spell',
    'triggered_spell': 'spell',

    // Item parameters
    'item_id': 'item',
    'itemId': 'item',
    'item_entry': 'item',

    // Quest parameters
    'quest_id': 'quest',
    'questId': 'quest',
    'quest': 'quest',

    // Creature parameters
    'creature_id': 'creature',
    'creatureId': 'creature',
    'creature_entry': 'creature',
    'entry': 'creature',
    'npc_entry': 'creature',

    // GameObject parameters
    'gameobject_id': 'gameobject',
    'gameobjectId': 'gameobject',
    'go_entry': 'gameobject',
  };

  for (const param of node.parameters) {
    // Check if parameter name matches any known database reference
    const paramName = param.name.toLowerCase();
    const validationType = parameterMappings[paramName];

    if (validationType && typeof param.value === 'number' && param.value > 0) {
      requests.push({
        type: validationType,
        id: param.value,
      });
    }
  }

  return requests;
}

/**
 * Validate all database references in a script
 */
export async function validateScriptDatabase(script: SAIScript): Promise<ValidationError[]> {
  const errors: ValidationError[] = [];

  // Collect all validation requests from all nodes
  const allRequests: (DatabaseValidationRequest & { nodeId: string; paramName: string })[] = [];

  for (const node of script.nodes) {
    const nodeRequests = extractValidationRequests(node);

    for (const request of nodeRequests) {
      // Find the parameter name for error reporting
      const param = node.parameters.find(p =>
        p.value === request.id &&
        p.name.toLowerCase().includes(request.type.substring(0, 4))
      );

      allRequests.push({
        ...request,
        nodeId: node.id,
        paramName: param?.name || 'Unknown',
      });
    }
  }

  // If no requests, return empty
  if (allRequests.length === 0) {
    return errors;
  }

  // Batch validate (max 50 at a time)
  const batchSize = 50;
  for (let i = 0; i < allRequests.length; i += batchSize) {
    const batch = allRequests.slice(i, i + batchSize);

    const result = await validateBatch(
      batch.map(r => ({ type: r.type, id: r.id }))
    );

    // Check results and add errors for non-existent IDs
    for (let j = 0; j < batch.length; j++) {
      const request = batch[j];
      const validation = result.results[j];

      if (validation && !validation.exists) {
        errors.push({
          nodeId: request.nodeId,
          message: `Invalid ${request.type} ID: ${request.id} does not exist in database`,
          severity: 'error',
          suggestion: `Check the ${request.type} ID in parameter "${request.paramName}". This ID was not found in the TrinityCore database.`,
        });
      }
    }
  }

  return errors;
}

/**
 * Validate a single parameter value against database
 */
export async function validateParameter(
  param: SAIParameter,
  nodeId: string
): Promise<ValidationError | null> {
  // Determine validation type from parameter name
  const paramName = param.name.toLowerCase();
  let validationType: ValidationType | null = null;

  if (paramName.includes('spell')) {
    validationType = 'spell';
  } else if (paramName.includes('item')) {
    validationType = 'item';
  } else if (paramName.includes('quest')) {
    validationType = 'quest';
  } else if (paramName.includes('creature') || paramName.includes('npc') || paramName === 'entry') {
    validationType = 'creature';
  } else if (paramName.includes('gameobject') || paramName.includes('go_')) {
    validationType = 'gameobject';
  }

  if (!validationType) {
    // Parameter doesn't reference database
    return null;
  }

  if (typeof param.value !== 'number' || param.value <= 0) {
    // Invalid value type or zero/negative (often means "none")
    return null;
  }

  // Validate against database
  const result = await validateID(validationType, param.value);

  if (!result.exists) {
    return {
      nodeId,
      message: `Invalid ${validationType} ID: ${param.value} does not exist in database`,
      severity: 'error',
      suggestion: `The ${validationType} ID ${param.value} in parameter "${param.name}" was not found in the TrinityCore database. Please verify the ID is correct.`,
    };
  }

  return null;
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Get human-readable name for a validated ID
 */
export function getIDName(result: DatabaseValidationResponse): string {
  if (!result.data) {
    return 'Unknown';
  }

  // Try common name fields
  return result.data.name ||
         result.data.Name ||
         result.data.title ||
         result.data.Title ||
         'Unknown';
}

/**
 * Get cache statistics
 */
export function getCacheStats(): {
  size: number;
  entries: Array<{ key: string; age: number }>;
} {
  const entries: Array<{ key: string; age: number }> = [];
  const now = Date.now();

  for (const [key, cached] of clientCache.entries()) {
    entries.push({
      key,
      age: now - cached.timestamp,
    });
  }

  return {
    size: clientCache.size,
    entries,
  };
}
