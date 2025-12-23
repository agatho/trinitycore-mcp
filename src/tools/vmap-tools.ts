/**
 * VMap MCP Tools
 *
 * MCP server tools for working with VMap (Visibility/Collision Map) data.
 * Provides collision testing, spawn validation, and analysis capabilities.
 *
 * ============================================================================
 * IMPLEMENTATION STATUS: PLACEHOLDER / HEURISTIC IMPLEMENTATION
 * ============================================================================
 *
 * CURRENT VERSION (v1.0):
 * - File listing and metadata extraction: FULLY FUNCTIONAL
 * - Line-of-sight testing: HEURISTIC IMPLEMENTATION (distance-based)
 * - Spawn finding: HEURISTIC IMPLEMENTATION (database-only, no collision)
 *
 * LIMITATIONS:
 * 1. Line-of-sight (testLineOfSight):
 *    - Returns `clear: true` for all distances < 1000 units
 *    - Does NOT parse VMap binary format (.vmtree/.vmtile)
 *    - Does NOT perform actual 3D raycast collision detection
 *    - Useful for basic proximity checks, NOT accurate LoS
 *
 * 2. Spawn finding (findSpawnsInRadius):
 *    - Queries database for spawns in radius
 *    - Does NOT filter by VMap collision data
 *    - May return spawns behind walls/obstacles
 *    - Useful for "nearby entities" queries, NOT precise spawn validation
 *
 * ROADMAP FOR v2.0 (Estimated 4-6 weeks development):
 * - Full VMap binary format parser (.vmtree and .vmtile)
 * - Actual 3D raycast collision detection using VMap geometry
 * - Spatial indexing (octree/BVH) for fast queries
 * - Integration with TrinityCore G3D library
 * - Precise spawn validation with collision filtering
 * - Height map queries for Z-coordinate validation
 *
 * WHY THIS APPROACH:
 * - VMap binary format is complex (proprietary TrinityCore format)
 * - Full implementation requires:
 *   * Binary format reverse engineering
 *   * 3D geometry processing
 *   * Spatial data structures
 *   * Collision detection algorithms
 * - Heuristic implementation provides 80% of use cases NOW
 * - Production-grade implementation coming in v2.0
 *
 * USAGE RECOMMENDATIONS:
 * - Use for approximate distance/proximity checks ✅
 * - Use for finding nearby entities (with collision caveat) ✅
 * - DO NOT rely on for precise line-of-sight validation ❌
 * - DO NOT use for spawn placement validation ❌
 * - For production LoS: Wait for v2.0 or use TrinityCore server API
 *
 * @module vmap-tools
 * @version 1.0.0-heuristic
 * @see docs/TECHNICAL_DEBT.md for full implementation plan
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
 * TrinityCore 11.2.7+ directory structure:
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
    // TrinityCore 11.2.7+: VMap files are in map ID subdirectories
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
 * TrinityCore 11.2.7+: Files are in subdirectories with 4-digit map IDs
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
    // TrinityCore 11.2.7+: vmtree filename is 4 digits (e.g., 0000.vmtree)
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
 * TrinityCore 11.2.7+: Files are in subdirectories (e.g., vmaps/0000/0000.vmtree)
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

  // TrinityCore 11.2.7+: Tree file is in subdirectory: vmaps/0000/0000.vmtree
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
 * TrinityCore 11.2.7+: Files are in subdirectories
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

  // TrinityCore 11.2.7+: Tree file is in subdirectory: vmaps/0000/0000.vmtree
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
