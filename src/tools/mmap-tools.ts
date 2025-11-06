/**
 * MMap MCP Tools
 *
 * MCP server tools for working with MMap (Movement Map / Navigation Mesh) data.
 * Provides pathfinding, navmesh validation, and analysis capabilities.
 *
 * @module mmap-tools
 */

import fs from "fs/promises";
import path from "path";

// ============================================================================
// Types
// ============================================================================

interface MMapToolOptions {
  mmapDir: string;
  mapId: number;
  tileX?: number;
  tileY?: number;
}

interface PathfindingOptions extends MMapToolOptions {
  startX: number;
  startY: number;
  startZ: number;
  goalX: number;
  goalY: number;
  goalZ: number;
}

interface NavMeshQueryOptions extends MMapToolOptions {
  posX: number;
  posY: number;
  posZ: number;
}

// ============================================================================
// MMap File Utilities
// ============================================================================

/**
 * List available MMap files
 *
 * @param mmapDir MMap directory
 * @returns List of available maps
 */
export async function listMMapFiles(mmapDir: string): Promise<{
  headers: string[];
  tiles: Map<string, string[]>;
}> {
  const headers: string[] = [];
  const tiles: Map<string, string[]> = new Map();

  try {
    const files = await fs.readdir(mmapDir);

    for (const file of files) {
      if (file.endsWith(".mmap")) {
        headers.push(file);
      } else if (file.endsWith(".mmtile")) {
        // Extract map ID from filename
        const match = file.match(/^(\d{4})_\d+_\d+\.mmtile$/);
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
    throw new Error(`Failed to list MMap files: ${(error as Error).message}`);
  }

  return { headers, tiles };
}

/**
 * Get MMap file info
 *
 * @param mmapFile Path to MMap file
 * @returns File information
 */
export async function getMMapFileInfo(mmapFile: string): Promise<{
  path: string;
  size: number;
  type: "header" | "tile";
  mapId?: number;
  tileX?: number;
  tileY?: number;
}> {
  const stats = await fs.stat(mmapFile);
  const filename = path.basename(mmapFile);

  let type: "header" | "tile";
  let mapId: number | undefined;
  let tileX: number | undefined;
  let tileY: number | undefined;

  if (filename.endsWith(".mmap")) {
    type = "header";
    const match = filename.match(/^(\d{3})\.mmap$/);
    if (match) {
      mapId = parseInt(match[1], 10);
    }
  } else {
    type = "tile";
    const match = filename.match(/^(\d{4})_(\d{2})_(\d{2})\.mmtile$/);
    if (match) {
      mapId = parseInt(match[1], 10);
      tileX = parseInt(match[2], 10);
      tileY = parseInt(match[3], 10);
    }
  }

  return {
    path: mmapFile,
    size: stats.size,
    type,
    mapId,
    tileX,
    tileY,
  };
}

/**
 * Validate MMap files
 *
 * @param mmapDir MMap directory
 * @param mapId Map ID
 * @returns Validation result
 */
export async function validateMMapFiles(
  mmapDir: string,
  mapId: number,
): Promise<{
  valid: boolean;
  hasHeader: boolean;
  tileCount: number;
  issues: string[];
}> {
  const issues: string[] = [];

  // Check if header file exists
  const headerFile = path.join(mmapDir, `${mapId.toString().padStart(3, "0")}.mmap`);
  let hasHeader = false;

  try {
    await fs.access(headerFile);
    hasHeader = true;
  } catch {
    issues.push(`Missing header file: ${path.basename(headerFile)}`);
  }

  // Count tile files
  const { tiles } = await listMMapFiles(mmapDir);
  const mapIdStr = mapId.toString().padStart(4, "0");
  const tileFiles = tiles.get(mapIdStr) || [];

  if (tileFiles.length === 0) {
    issues.push(`No tile files found for map ${mapId}`);
  }

  return {
    valid: issues.length === 0,
    hasHeader,
    tileCount: tileFiles.length,
    issues,
  };
}

// ============================================================================
// Pathfinding (requires parser)
// ============================================================================

/**
 * Find path between two points
 *
 * Note: This is a placeholder. In production, this would use the MMap parser
 * to load the actual navigation mesh data and perform A* pathfinding.
 *
 * @param options Pathfinding options
 * @returns Pathfinding result
 */
export async function findPath(
  options: PathfindingOptions,
): Promise<{
  success: boolean;
  pathLength: number;
  waypoints: number;
  message: string;
}> {
  // Validate MMap files exist
  const validation = await validateMMapFiles(options.mmapDir, options.mapId);

  if (!validation.valid) {
    return {
      success: false,
      pathLength: 0,
      waypoints: 0,
      message: `MMap validation failed: ${validation.issues.join(", ")}`,
    };
  }

  // Calculate straight-line distance
  const dx = options.goalX - options.startX;
  const dy = options.goalY - options.startY;
  const dz = options.goalZ - options.startZ;
  const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

  // TODO: Load MMap data and perform actual A* pathfinding

  return {
    success: true, // Placeholder
    pathLength: distance,
    waypoints: 0,
    message: `Pathfinding from (${options.startX}, ${options.startY}, ${options.startZ}) to (${options.goalX}, ${options.goalY}, ${options.goalZ}) - ${distance.toFixed(2)} units`,
  };
}

/**
 * Check if position is on navigation mesh
 *
 * Note: This is a placeholder. In production, this would use the MMap parser
 * to load navmesh data and perform polygon containment tests.
 *
 * @param options Query options
 * @returns Query result
 */
export async function isOnNavMesh(
  options: NavMeshQueryOptions,
): Promise<{
  onNavMesh: boolean;
  nearestDistance: number;
  message: string;
}> {
  const validation = await validateMMapFiles(options.mmapDir, options.mapId);

  if (!validation.valid) {
    return {
      onNavMesh: false,
      nearestDistance: 0,
      message: `MMap validation failed: ${validation.issues.join(", ")}`,
    };
  }

  // TODO: Load MMap data and perform navmesh query

  return {
    onNavMesh: true, // Placeholder
    nearestDistance: 0,
    message: `NavMesh query for position (${options.posX}, ${options.posY}, ${options.posZ})`,
  };
}

// ============================================================================
// Statistics
// ============================================================================

/**
 * Get MMap statistics
 *
 * @param mmapDir MMap directory
 * @param mapId Map ID
 * @returns Statistics
 */
export async function getMMapStatistics(
  mmapDir: string,
  mapId: number,
): Promise<{
  mapId: number;
  hasHeader: boolean;
  tileCount: number;
  totalSize: number;
  coverage: string;
  estimatedPolygons: number;
}> {
  const validation = await validateMMapFiles(mmapDir, mapId);
  const { tiles } = await listMMapFiles(mmapDir);
  const mapIdStr = mapId.toString().padStart(4, "0");
  const tileFiles = tiles.get(mapIdStr) || [];

  // Calculate total size
  let totalSize = 0;

  // Header file
  const headerFile = path.join(mmapDir, `${mapId.toString().padStart(3, "0")}.mmap`);
  try {
    const stats = await fs.stat(headerFile);
    totalSize += stats.size;
  } catch {
    // Header file doesn't exist
  }

  // Tile files
  for (const tileFile of tileFiles) {
    const stats = await fs.stat(path.join(mmapDir, tileFile));
    totalSize += stats.size;
  }

  // Estimate coverage
  const coverage = tileFiles.length > 0 ? "Partial" : "None";

  // Rough estimate: ~100-500 polygons per tile (very approximate)
  const estimatedPolygons = tileFiles.length * 300;

  return {
    mapId,
    hasHeader: validation.hasHeader,
    tileCount: validation.tileCount,
    totalSize,
    coverage,
    estimatedPolygons,
  };
}

/**
 * Get tile coverage map
 *
 * @param mmapDir MMap directory
 * @param mapId Map ID
 * @returns Coverage map (tile coordinates)
 */
export async function getTileCoverage(
  mmapDir: string,
  mapId: number,
): Promise<{
  tiles: Array<{ x: number; y: number; size: number }>;
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
}> {
  const { tiles: allTiles } = await listMMapFiles(mmapDir);
  const mapIdStr = mapId.toString().padStart(4, "0");
  const tileFiles = allTiles.get(mapIdStr) || [];

  const tiles: Array<{ x: number; y: number; size: number }> = [];
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const tileFile of tileFiles) {
    const match = tileFile.match(/\d{4}_(\d{2})_(\d{2})\.mmtile$/);
    if (match) {
      const x = parseInt(match[1], 10);
      const y = parseInt(match[2], 10);

      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);

      const stats = await fs.stat(path.join(mmapDir, tileFile));
      tiles.push({ x, y, size: stats.size });
    }
  }

  return {
    tiles,
    bounds: {
      minX: minX === Infinity ? 0 : minX,
      maxX: maxX === -Infinity ? 0 : maxX,
      minY: minY === Infinity ? 0 : minY,
      maxY: maxY === -Infinity ? 0 : maxY,
    },
  };
}
