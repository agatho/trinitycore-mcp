/**
 * SAI Validation API Route
 *
 * Validates SAI script parameters against real TrinityCore database data.
 * Uses MCP tools to check if spell IDs, item IDs, quest IDs, creature IDs etc. exist.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getMCPClient } from '@/lib/mcp-client';

// ============================================================================
// TYPES
// ============================================================================

interface ValidationRequest {
  type: 'spell' | 'item' | 'quest' | 'creature' | 'gameobject';
  id: number;
}

interface ValidationResponse {
  valid: boolean;
  exists: boolean;
  data?: any;
  error?: string;
}

// ============================================================================
// VALIDATION CACHE
// ============================================================================

// Simple in-memory cache to avoid redundant MCP calls
const validationCache = new Map<string, { result: ValidationResponse; timestamp: number }>();
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

function getCacheKey(type: string, id: number): string {
  return `${type}:${id}`;
}

function getFromCache(type: string, id: number): ValidationResponse | null {
  const key = getCacheKey(type, id);
  const cached = validationCache.get(key);

  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.result;
  }

  return null;
}

function setInCache(type: string, id: number, result: ValidationResponse): void {
  const key = getCacheKey(type, id);
  validationCache.set(key, { result, timestamp: Date.now() });
}

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

async function validateSpell(id: number): Promise<ValidationResponse> {
  try {
    const client = getMCPClient();
    const result = await client.callTool('get_spell_info', { spell_id: id });

    if (!result.success) {
      return {
        valid: false,
        exists: false,
        error: result.error,
      };
    }

    // Check if spell exists
    const exists = result.result && result.result.length > 0;

    return {
      valid: true,
      exists,
      data: exists ? result.result[0] : null,
    };
  } catch (error: any) {
    return {
      valid: false,
      exists: false,
      error: error.message || 'Failed to validate spell',
    };
  }
}

async function validateItem(id: number): Promise<ValidationResponse> {
  try {
    const client = getMCPClient();
    const result = await client.callTool('get_item_info', { item_id: id });

    if (!result.success) {
      return {
        valid: false,
        exists: false,
        error: result.error,
      };
    }

    const exists = result.result && result.result.length > 0;

    return {
      valid: true,
      exists,
      data: exists ? result.result[0] : null,
    };
  } catch (error: any) {
    return {
      valid: false,
      exists: false,
      error: error.message || 'Failed to validate item',
    };
  }
}

async function validateQuest(id: number): Promise<ValidationResponse> {
  try {
    const client = getMCPClient();
    const result = await client.callTool('get_quest_info', { quest_id: id });

    if (!result.success) {
      return {
        valid: false,
        exists: false,
        error: result.error,
      };
    }

    const exists = result.result && result.result.length > 0;

    return {
      valid: true,
      exists,
      data: exists ? result.result[0] : null,
    };
  } catch (error: any) {
    return {
      valid: false,
      exists: false,
      error: error.message || 'Failed to validate quest',
    };
  }
}

async function validateCreature(id: number): Promise<ValidationResponse> {
  try {
    const client = getMCPClient();
    const result = await client.callTool('get_creature_full_info', { entry: id });

    if (!result.success) {
      return {
        valid: false,
        exists: false,
        error: result.error,
      };
    }

    const exists = result.result && result.result.length > 0;

    return {
      valid: true,
      exists,
      data: exists ? result.result[0] : null,
    };
  } catch (error: any) {
    return {
      valid: false,
      exists: false,
      error: error.message || 'Failed to validate creature',
    };
  }
}

async function validateGameObject(id: number): Promise<ValidationResponse> {
  try {
    const client = getMCPClient();
    const result = await client.callTool('get_gameobjects_by_entry', { entry: id });

    if (!result.success) {
      return {
        valid: false,
        exists: false,
        error: result.error,
      };
    }

    const exists = result.result && result.result.length > 0;

    return {
      valid: true,
      exists,
      data: exists ? result.result[0] : null,
    };
  } catch (error: any) {
    return {
      valid: false,
      exists: false,
      error: error.message || 'Failed to validate game object',
    };
  }
}

// ============================================================================
// API ROUTE HANDLER
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body: ValidationRequest = await request.json();
    const { type, id } = body;

    // Input validation
    if (!type || id === undefined || id === null) {
      return NextResponse.json(
        { error: 'Missing required parameters: type and id' },
        { status: 400 }
      );
    }

    if (!['spell', 'item', 'quest', 'creature', 'gameobject'].includes(type)) {
      return NextResponse.json(
        { error: 'Invalid type. Must be: spell, item, quest, creature, or gameobject' },
        { status: 400 }
      );
    }

    if (typeof id !== 'number' || id < 0) {
      return NextResponse.json(
        { error: 'Invalid ID. Must be a non-negative number' },
        { status: 400 }
      );
    }

    // Check cache first
    const cached = getFromCache(type, id);
    if (cached) {
      return NextResponse.json({
        ...cached,
        cached: true,
      });
    }

    // Validate based on type
    let result: ValidationResponse;

    switch (type) {
      case 'spell':
        result = await validateSpell(id);
        break;
      case 'item':
        result = await validateItem(id);
        break;
      case 'quest':
        result = await validateQuest(id);
        break;
      case 'creature':
        result = await validateCreature(id);
        break;
      case 'gameobject':
        result = await validateGameObject(id);
        break;
      default:
        return NextResponse.json(
          { error: 'Unsupported validation type' },
          { status: 400 }
        );
    }

    // Cache the result
    setInCache(type, id, result);

    return NextResponse.json({
      ...result,
      cached: false,
    });

  } catch (error: any) {
    console.error('[SAI Validation API] Error:', error);

    return NextResponse.json(
      {
        valid: false,
        exists: false,
        error: error.message || 'Internal server error',
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// BATCH VALIDATION
// ============================================================================

export async function PUT(request: NextRequest) {
  try {
    const body: { validations: ValidationRequest[] } = await request.json();
    const { validations } = body;

    if (!validations || !Array.isArray(validations)) {
      return NextResponse.json(
        { error: 'Missing or invalid validations array' },
        { status: 400 }
      );
    }

    if (validations.length > 50) {
      return NextResponse.json(
        { error: 'Too many validations. Maximum 50 per request' },
        { status: 400 }
      );
    }

    // Validate all in parallel
    const results = await Promise.all(
      validations.map(async (validation) => {
        const { type, id } = validation;

        // Check cache first
        const cached = getFromCache(type, id);
        if (cached) {
          return {
            type,
            id,
            ...cached,
            cached: true,
          };
        }

        // Validate
        let result: ValidationResponse;

        switch (type) {
          case 'spell':
            result = await validateSpell(id);
            break;
          case 'item':
            result = await validateItem(id);
            break;
          case 'quest':
            result = await validateQuest(id);
            break;
          case 'creature':
            result = await validateCreature(id);
            break;
          case 'gameobject':
            result = await validateGameObject(id);
            break;
          default:
            result = {
              valid: false,
              exists: false,
              error: 'Unsupported validation type',
            };
        }

        // Cache the result
        setInCache(type, id, result);

        return {
          type,
          id,
          ...result,
          cached: false,
        };
      })
    );

    return NextResponse.json({
      results,
      total: results.length,
      valid: results.filter(r => r.valid).length,
      exists: results.filter(r => r.exists).length,
    });

  } catch (error: any) {
    console.error('[SAI Validation API] Batch error:', error);

    return NextResponse.json(
      {
        error: error.message || 'Internal server error',
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// CACHE MANAGEMENT
// ============================================================================

export async function DELETE(request: NextRequest) {
  try {
    // Clear validation cache
    validationCache.clear();

    return NextResponse.json({
      success: true,
      message: 'Validation cache cleared',
    });

  } catch (error: any) {
    console.error('[SAI Validation API] Cache clear error:', error);

    return NextResponse.json(
      {
        error: error.message || 'Failed to clear cache',
      },
      { status: 500 }
    );
  }
}
