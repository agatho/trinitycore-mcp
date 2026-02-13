/**
 * VMap MCP Tools
 *
 * MCP server tools for working with VMap (Visibility/Collision Map) data.
 * Provides collision testing, spawn validation, and analysis capabilities.
 *
 * ============================================================================
 * IMPLEMENTATION STATUS: REAL COLLISION (v2.0)
 * ============================================================================
 *
 * CURRENT VERSION (v2.0):
 * - File listing and metadata extraction: FULLY FUNCTIONAL
 * - Line-of-sight testing: REAL RAY-AABB COLLISION against VMap spawn data
 * - Spawn finding: REAL SPATIAL QUERY against VMap spawn bounding boxes
 *
 * COLLISION APPROACH:
 * - Parses TrinityCore .vmtile binary files to extract model spawn bounding boxes
 * - Performs ray-AABB intersection (slab method) for line-of-sight testing
 * - Lazy tile loading: only loads tiles along the ray path
 * - LRU cache: keeps recently used map data in memory
 *
 * ACCURACY NOTES:
 * - Tests against model bounding boxes (AABB), not triangle meshes
 * - May have false positives (ray hits bounding box but misses actual geometry)
 * - For triangle-level precision, .vmo model files would need parsing
 * - AABB-level testing is sufficient for most game mechanic checks
 *
 * @module vmap-tools
 * @version 2.0.0
 */

import fs from "fs/promises";
import path from "path";
import {
  testLineOfSight as realTestLineOfSight,
  findSpawnsInRadius as realFindSpawnsInRadius,
  getVMapCacheStats,
} from "../collision";

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
 * TrinityCore 12.0.0+ directory structure:
 * vmaps/
 *   0000/
 *     0000.vmtree
 *     0000_xx_yy.vmtile
 *     0000_xx_yy.vmtileidx
 *   0001/
 *     0001.vmtree
 *     ...
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
    // TrinityCore 12.0.0+: VMap files are in map ID subdirectories
    const subdirs = await fs.readdir(vmapDir);

    for (const subdir of subdirs) {
      // Check if it's a 4-digit map ID directory
      if (!/^\d{4}$/.test(subdir)) {
        continue;
      }

      const mapDir = path.join(vmapDir, subdir);
      const stat = await fs.stat(mapDir);

      if (!stat.isDirectory()) {
        continue;
      }

      try {
        const files = await fs.readdir(mapDir);

        for (const file of files) {
          if (file.endsWith(".vmtree")) {
            trees.push(`${subdir}/${file}`);
          } else if (file.endsWith(".vmtile")) {
            // Extract map ID from filename
            const match = file.match(/^(\d{4})_\d+_\d+\.vmtile$/);
            if (match) {
              const mapId = match[1];
              if (!tiles.has(mapId)) {
                tiles.set(mapId, []);
              }
              tiles.get(mapId)!.push(`${subdir}/${file}`);
            }
          }
        }
      } catch (error) {
        // Skip directories we can't read
        continue;
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
 * TrinityCore 12.0.0+: Files are in subdirectories with 4-digit map IDs
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
    // TrinityCore 12.0.0+: vmtree filename is 4 digits (e.g., 0000.vmtree)
    const match = filename.match(/^(\d{4})\.vmtree$/);
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
 * TrinityCore 12.0.0+: Files are in subdirectories (e.g., vmaps/0000/0000.vmtree)
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
  const mapIdStr = mapId.toString().padStart(4, "0");

  // TrinityCore 12.0.0+: Tree file is in subdirectory: vmaps/0000/0000.vmtree
  const treeFile = path.join(vmapDir, mapIdStr, `${mapIdStr}.vmtree`);
  let hasTree = false;

  try {
    await fs.access(treeFile);
    hasTree = true;
  } catch {
    issues.push(`Missing tree file: ${mapIdStr}/${mapIdStr}.vmtree`);
  }

  // Count tile files
  const { tiles } = await listVMapFiles(vmapDir);
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
 * Test line-of-sight between two points using real VMap collision data.
 *
 * Loads VMap tiles along the ray path, parses model spawn bounding boxes,
 * and performs ray-AABB intersection testing (slab method).
 *
 * @param options Raycast options
 * @returns Raycast result with collision details
 */
export async function testLineOfSight(
  options: RaycastOptions,
): Promise<{
  clear: boolean;
  distance: number;
  message: string;
  blockingModel?: string;
  blockingModelId?: number;
  hitPoint?: { x: number; y: number; z: number };
  hitDistance?: number;
  testedCount?: number;
  tilesLoaded?: number;
}> {
  const result = await realTestLineOfSight(
    options.vmapDir,
    options.mapId,
    { x: options.startX, y: options.startY, z: options.startZ },
    { x: options.endX, y: options.endY, z: options.endZ },
  );

  return {
    clear: result.clear,
    distance: result.distance,
    message: result.message,
    blockingModel: result.blockingSpawn?.name,
    blockingModelId: result.blockingSpawn?.id,
    hitPoint: result.hitPoint ?? undefined,
    hitDistance: result.hitDistance ?? undefined,
    testedCount: result.testedCount,
    tilesLoaded: result.tilesLoaded,
  };
}

/**
 * Find VMap model spawns within a radius of a point.
 *
 * Loads nearby tiles and checks each model spawn's bounding box
 * against the query sphere. Returns spawns sorted by distance.
 *
 * @param options Query options
 * @returns Found spawns with distances
 */
export async function findSpawnsInRadius(
  options: SpawnQueryOptions,
): Promise<{
  count: number;
  message: string;
  spawns: Array<{
    name: string;
    id: number;
    distance: number;
    position: { x: number; y: number; z: number };
  }>;
  testedCount: number;
  tilesLoaded: number;
}> {
  const result = await realFindSpawnsInRadius(
    options.vmapDir,
    options.mapId,
    { x: options.centerX, y: options.centerY, z: options.centerZ },
    options.radius,
  );

  return {
    count: result.spawns.length,
    message: `Found ${result.spawns.length} spawns within ${options.radius} units. Tested ${result.testedCount} spawns across ${result.tilesLoaded} tiles.`,
    spawns: result.spawns.map(s => ({
      name: s.spawn.name,
      id: s.spawn.id,
      distance: Math.round(s.distance * 100) / 100,
      position: s.spawn.position,
    })),
    testedCount: result.testedCount,
    tilesLoaded: result.tilesLoaded,
  };
}

// ============================================================================
// Statistics
// ============================================================================

/**
 * Get VMap statistics
 *
 * TrinityCore 12.0.0+: Files are in subdirectories
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

  // TrinityCore 12.0.0+: Tree file is in subdirectory: vmaps/0000/0000.vmtree
  const treeFile = path.join(vmapDir, mapIdStr, `${mapIdStr}.vmtree`);
  try {
    const stats = await fs.stat(treeFile);
    totalSize += stats.size;
  } catch {
    // Tree file doesn't exist
  }

  // Tile files (already include subdir path from listVMapFiles)
  for (const tileFile of tileFiles) {
    try {
      const stats = await fs.stat(path.join(vmapDir, tileFile));
      totalSize += stats.size;
    } catch {
      // Skip files we can't stat
    }
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
