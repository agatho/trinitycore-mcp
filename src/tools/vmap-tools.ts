/**
 * VMap MCP Tools
 *
 * MCP server tools for working with VMap (Visibility/Collision Map) data.
 * Provides collision testing, spawn validation, and analysis capabilities.
 *
 * @module vmap-tools
 */

import fs from "fs/promises";
import path from "path";

// ============================================================================
// Types
// ============================================================================

interface VMapToolOptions {
  vmapDir: string;
  mapId: number;
  tileX?: number;
  tileY?: number;
}

interface RaycastOptions extends VMapToolOptions {
  startX: number;
  startY: number;
  startZ: number;
  endX: number;
  endY: number;
  endZ: number;
}

interface SpawnQueryOptions extends VMapToolOptions {
  centerX: number;
  centerY: number;
  centerZ: number;
  radius: number;
}

// ============================================================================
// VMap File Utilities
// ============================================================================

/**
 * List available VMap files
 *
 * @param vmapDir VMap directory
 * @returns List of available maps
 */
export async function listVMapFiles(vmapDir: string): Promise<{
  trees: string[];
  tiles: Map<string, string[]>;
}> {
  const trees: string[] = [];
  const tiles: Map<string, string[]> = new Map();

  try {
    const files = await fs.readdir(vmapDir);

    for (const file of files) {
      if (file.endsWith(".vmtree")) {
        trees.push(file);
      } else if (file.endsWith(".vmtile")) {
        // Extract map ID from filename
        const match = file.match(/^(\d{4})_\d+_\d+\.vmtile$/);
        if (match) {
          const mapId = match[1];
          if (!tiles.has(mapId)) {
            tiles.set(mapId, []);
          }
          tiles.get(mapId)!.push(file);
        }
      }
    }
  } catch (error) {
    throw new Error(`Failed to list VMap files: ${(error as Error).message}`);
  }

  return { trees, tiles };
}

/**
 * Get VMap file info
 *
 * @param vmapFile Path to VMap file
 * @returns File information
 */
export async function getVMapFileInfo(vmapFile: string): Promise<{
  path: string;
  size: number;
  type: "tree" | "tile";
  mapId?: number;
  tileX?: number;
  tileY?: number;
}> {
  const stats = await fs.stat(vmapFile);
  const filename = path.basename(vmapFile);

  let type: "tree" | "tile";
  let mapId: number | undefined;
  let tileX: number | undefined;
  let tileY: number | undefined;

  if (filename.endsWith(".vmtree")) {
    type = "tree";
    const match = filename.match(/^(\d{3})\.vmtree$/);
    if (match) {
      mapId = parseInt(match[1], 10);
    }
  } else {
    type = "tile";
    const match = filename.match(/^(\d{4})_(\d+)_(\d+)\.vmtile$/);
    if (match) {
      mapId = parseInt(match[1], 10);
      tileX = parseInt(match[2], 10);
      tileY = parseInt(match[3], 10);
    }
  }

  return {
    path: vmapFile,
    size: stats.size,
    type,
    mapId,
    tileX,
    tileY,
  };
}

/**
 * Validate VMap files
 *
 * @param vmapDir VMap directory
 * @param mapId Map ID
 * @returns Validation result
 */
export async function validateVMapFiles(
  vmapDir: string,
  mapId: number,
): Promise<{
  valid: boolean;
  hasTree: boolean;
  tileCount: number;
  issues: string[];
}> {
  const issues: string[] = [];

  // Check if tree file exists
  const treeFile = path.join(vmapDir, `${mapId.toString().padStart(3, "0")}.vmtree`);
  let hasTree = false;

  try {
    await fs.access(treeFile);
    hasTree = true;
  } catch {
    issues.push(`Missing tree file: ${path.basename(treeFile)}`);
  }

  // Count tile files
  const { tiles } = await listVMapFiles(vmapDir);
  const mapIdStr = mapId.toString().padStart(4, "0");
  const tileFiles = tiles.get(mapIdStr) || [];

  if (tileFiles.length === 0) {
    issues.push(`No tile files found for map ${mapId}`);
  }

  return {
    valid: issues.length === 0,
    hasTree,
    tileCount: tileFiles.length,
    issues,
  };
}

// ============================================================================
// Collision Testing (requires parser)
// ============================================================================

/**
 * Test line-of-sight between two points
 *
 * Note: This is a placeholder. In production, this would use the VMap parser
 * to load the actual collision data and perform ray-AABB intersection tests.
 *
 * @param options Raycast options
 * @returns Raycast result
 */
export async function testLineOfSight(
  options: RaycastOptions,
): Promise<{
  clear: boolean;
  distance: number;
  message: string;
}> {
  // Validate VMap files exist
  const validation = await validateVMapFiles(options.vmapDir, options.mapId);

  if (!validation.valid) {
    return {
      clear: false,
      distance: 0,
      message: `VMap validation failed: ${validation.issues.join(", ")}`,
    };
  }

  // Calculate distance
  const dx = options.endX - options.startX;
  const dy = options.endY - options.startY;
  const dz = options.endZ - options.startZ;
  const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

  // TODO: Load VMap data and perform actual raycast
  // For now, return placeholder response

  return {
    clear: true, // Placeholder
    distance,
    message: `LoS test from (${options.startX}, ${options.startY}, ${options.startZ}) to (${options.endX}, ${options.endY}, ${options.endZ}) - ${distance.toFixed(2)} units`,
  };
}

/**
 * Find spawns within radius
 *
 * Note: This is a placeholder. In production, this would use the VMap parser
 * to load spawn data and perform spatial queries.
 *
 * @param options Query options
 * @returns Found spawns
 */
export async function findSpawnsInRadius(
  options: SpawnQueryOptions,
): Promise<{
  count: number;
  message: string;
}> {
  const validation = await validateVMapFiles(options.vmapDir, options.mapId);

  if (!validation.valid) {
    return {
      count: 0,
      message: `VMap validation failed: ${validation.issues.join(", ")}`,
    };
  }

  // TODO: Load VMap data and perform spatial query

  return {
    count: 0, // Placeholder
    message: `Query for spawns within ${options.radius} units of (${options.centerX}, ${options.centerY}, ${options.centerZ})`,
  };
}

// ============================================================================
// Statistics
// ============================================================================

/**
 * Get VMap statistics
 *
 * @param vmapDir VMap directory
 * @param mapId Map ID
 * @returns Statistics
 */
export async function getVMapStatistics(
  vmapDir: string,
  mapId: number,
): Promise<{
  mapId: number;
  hasTree: boolean;
  tileCount: number;
  totalSize: number;
  coverage: string;
}> {
  const validation = await validateVMapFiles(vmapDir, mapId);
  const { tiles } = await listVMapFiles(vmapDir);
  const mapIdStr = mapId.toString().padStart(4, "0");
  const tileFiles = tiles.get(mapIdStr) || [];

  // Calculate total size
  let totalSize = 0;

  // Tree file
  const treeFile = path.join(vmapDir, `${mapId.toString().padStart(3, "0")}.vmtree`);
  try {
    const stats = await fs.stat(treeFile);
    totalSize += stats.size;
  } catch {
    // Tree file doesn't exist
  }

  // Tile files
  for (const tileFile of tileFiles) {
    const stats = await fs.stat(path.join(vmapDir, tileFile));
    totalSize += stats.size;
  }

  // Estimate coverage (rough approximation)
  const coverage = tileFiles.length > 0 ? "Partial" : "None";

  return {
    mapId,
    hasTree: validation.hasTree,
    tileCount: validation.tileCount,
    totalSize,
    coverage,
  };
}
