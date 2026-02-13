/**
 * VMap Collision Testing System
 *
 * Server-side VMap collision testing using real binary VMap data.
 * Loads .vmtile files from disk, parses model spawns with bounding boxes,
 * and performs ray-AABB intersection for line-of-sight and spatial queries.
 *
 * Features:
 * - Lazy tile loading: Only loads tiles along the ray path
 * - LRU cache: Keeps recently loaded maps in memory
 * - Automatic tile coordinate calculation from world coordinates
 * - AABB-based collision (bounding box level, not triangle level)
 *
 * Limitations:
 * - Tests against model bounding boxes, not triangle meshes
 * - May report false positives (ray hits bounding box but would miss geometry)
 * - Does not account for model rotation on bounding boxes
 * - For precise triangle-level collision, .vmo model files would be needed
 *
 * @module collision/vmap-collision
 */

import fs from "fs/promises";
import path from "path";
import { logger } from "../utils/logger";
import { parseVMapTile, parseVMapTreeBounds } from "./vmap-parser";
import { rayAABBIntersection, createRayFromPoints, distance3D } from "./ray-aabb";
import type {
  Vector3,
  AABox,
  ModelSpawn,
  VMapMapData,
  VMapTile,
  LineOfSightResult,
  SpawnQueryResult,
  RayHit,
} from "./types";
import { TILE_SIZE, GRID_CENTER } from "./types";

// ============================================================================
// VMap Data Cache
// ============================================================================

/** Cache of loaded VMap map data, keyed by mapId */
const vmapCache = new Map<number, VMapMapData>();

/** Maximum number of maps to keep in cache */
const MAX_CACHED_MAPS = 5;

/**
 * Get or initialize VMapMapData for a map.
 */
function getOrCreateMapData(mapId: number): VMapMapData {
  let mapData = vmapCache.get(mapId);
  if (!mapData) {
    // Evict oldest entry if cache is full
    if (vmapCache.size >= MAX_CACHED_MAPS) {
      const oldestKey = vmapCache.keys().next().value;
      if (oldestKey !== undefined) {
        vmapCache.delete(oldestKey);
      }
    }

    mapData = {
      mapId,
      tiles: new Map(),
      allSpawns: [],
      bounds: { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } },
    };
    vmapCache.set(mapId, mapData);
  }
  return mapData;
}

// ============================================================================
// Coordinate Conversion
// ============================================================================

/**
 * Convert world coordinates to tile coordinates.
 *
 * WoW/TrinityCore uses a 64x64 tile grid per map, centered at tile (32, 32).
 * Each tile is 533.33333 world units (yards).
 *
 * @param worldX World X coordinate
 * @param worldY World Y coordinate
 * @returns Tile coordinates [tileX, tileY]
 */
export function worldToTile(worldX: number, worldY: number): [number, number] {
  const tileX = Math.floor(GRID_CENTER - worldX / TILE_SIZE);
  const tileY = Math.floor(GRID_CENTER - worldY / TILE_SIZE);
  return [tileX, tileY];
}

/**
 * Get the set of tiles that a ray passes through.
 * Uses a conservative approach: returns all tiles in the bounding rectangle
 * of start and end points, with a 1-tile margin.
 */
function getTilesAlongRay(
  startX: number, startY: number,
  endX: number, endY: number,
): Array<[number, number]> {
  const [startTileX, startTileY] = worldToTile(startX, startY);
  const [endTileX, endTileY] = worldToTile(endX, endY);

  const minTileX = Math.max(0, Math.min(startTileX, endTileX) - 1);
  const maxTileX = Math.min(63, Math.max(startTileX, endTileX) + 1);
  const minTileY = Math.max(0, Math.min(startTileY, endTileY) - 1);
  const maxTileY = Math.min(63, Math.max(startTileY, endTileY) + 1);

  const tiles: Array<[number, number]> = [];
  for (let tx = minTileX; tx <= maxTileX; tx++) {
    for (let ty = minTileY; ty <= maxTileY; ty++) {
      tiles.push([tx, ty]);
    }
  }
  return tiles;
}

/**
 * Get tiles within a radius of a center point.
 */
function getTilesInRadius(
  centerX: number, centerY: number, radius: number,
): Array<[number, number]> {
  const tileRadius = Math.ceil(radius / TILE_SIZE) + 1;
  const [centerTileX, centerTileY] = worldToTile(centerX, centerY);

  const tiles: Array<[number, number]> = [];
  for (let dx = -tileRadius; dx <= tileRadius; dx++) {
    for (let dy = -tileRadius; dy <= tileRadius; dy++) {
      const tx = centerTileX + dx;
      const ty = centerTileY + dy;
      if (tx >= 0 && tx <= 63 && ty >= 0 && ty <= 63) {
        tiles.push([tx, ty]);
      }
    }
  }
  return tiles;
}

// ============================================================================
// Tile Loading
// ============================================================================

/**
 * Resolve the VMap tile file path.
 *
 * TrinityCore 12.0.0+: vmaps/<mapId4>/<mapId4>_<tileX>_<tileY>.vmtile
 * Legacy: vmaps/<mapId3>_<tileX>_<tileY>.vmtile
 */
async function findTileFile(
  vmapDir: string, mapId: number, tileX: number, tileY: number,
): Promise<string | null> {
  const mapId4 = mapId.toString().padStart(4, "0");
  const mapId3 = mapId.toString().padStart(3, "0");

  // Try 12.0.0+ format first (subdirectory)
  const newPath = path.join(vmapDir, mapId4, `${mapId4}_${tileX}_${tileY}.vmtile`);
  try {
    await fs.access(newPath);
    return newPath;
  } catch {
    // Not found in new format
  }

  // Try legacy format (flat directory)
  const legacyPath = path.join(vmapDir, `${mapId3}_${tileX}_${tileY}.vmtile`);
  try {
    await fs.access(legacyPath);
    return legacyPath;
  } catch {
    return null;
  }
}

/**
 * Load a VMap tile from disk into the map cache.
 * Returns true if the tile was loaded (or already cached), false if not found.
 */
async function loadTile(
  vmapDir: string, mapData: VMapMapData, tileX: number, tileY: number,
): Promise<boolean> {
  const tileKey = `${tileX}_${tileY}`;

  // Already cached
  if (mapData.tiles.has(tileKey)) return true;

  const filePath = await findTileFile(vmapDir, mapData.mapId, tileX, tileY);
  if (!filePath) return false;

  try {
    const buffer = await fs.readFile(filePath);
    const tile = parseVMapTile(buffer, tileX, tileY);

    mapData.tiles.set(tileKey, tile);

    // Add spawns to allSpawns (only those with valid bounds)
    for (const spawn of tile.spawns) {
      if (hasValidBounds(spawn.bounds)) {
        mapData.allSpawns.push(spawn);
      }
    }

    return true;
  } catch (error) {
    logger.warn(`Failed to load VMap tile ${tileKey} for map ${mapData.mapId}: ${(error as Error).message}`);
    return false;
  }
}

/**
 * Load multiple tiles needed for a query.
 */
async function loadTiles(
  vmapDir: string, mapData: VMapMapData, tileCoords: Array<[number, number]>,
): Promise<number> {
  let loadedCount = 0;
  for (const [tx, ty] of tileCoords) {
    const loaded = await loadTile(vmapDir, mapData, tx, ty);
    if (loaded) loadedCount++;
  }
  return loadedCount;
}

/**
 * Check if a bounding box has non-zero extent (valid for collision testing).
 */
function hasValidBounds(bounds: AABox): boolean {
  const dx = bounds.max.x - bounds.min.x;
  const dy = bounds.max.y - bounds.min.y;
  const dz = bounds.max.z - bounds.min.z;
  return dx > 0.001 && dy > 0.001 && dz > 0.001;
}

// ============================================================================
// Line-of-Sight Testing
// ============================================================================

/**
 * Test line-of-sight between two points using real VMap collision data.
 *
 * Loads the VMap tiles along the ray path, then tests the ray against
 * all model spawn bounding boxes. Returns the closest hit (if any).
 *
 * This is AABB-level collision testing. It provides much better accuracy
 * than the distance-based heuristic, but may have false positives where
 * the ray hits a bounding box but would miss the actual model geometry.
 *
 * @param vmapDir Path to VMap directory
 * @param mapId Map ID (0 = Eastern Kingdoms, 1 = Kalimdor, etc.)
 * @param start Start position
 * @param end End position
 * @returns Line-of-sight result
 */
export async function testLineOfSight(
  vmapDir: string,
  mapId: number,
  start: Vector3,
  end: Vector3,
): Promise<LineOfSightResult> {
  const dist = distance3D(start, end);

  // Get tiles along the ray path
  const tileCoords = getTilesAlongRay(start.x, start.y, end.x, end.y);
  const mapData = getOrCreateMapData(mapId);
  const tilesLoaded = await loadTiles(vmapDir, mapData, tileCoords);

  if (tilesLoaded === 0) {
    return {
      clear: true,
      distance: dist,
      blockingSpawn: null,
      hitPoint: null,
      hitDistance: null,
      testedCount: 0,
      tilesLoaded: 0,
      message: `No VMap tiles found for map ${mapId} along ray path. LoS assumed clear (${dist.toFixed(1)} units).`,
    };
  }

  // Create ray and test against all loaded spawns
  const ray = createRayFromPoints(start, end);
  let closestHit: RayHit | null = null;
  let testedCount = 0;

  for (const spawn of mapData.allSpawns) {
    // Quick bounding box relevance check: skip spawns far from the ray path
    if (!hasValidBounds(spawn.bounds)) continue;

    testedCount++;
    const hit = rayAABBIntersection(ray, spawn.bounds);

    if (hit.hit && hit.distance < ray.maxDistance) {
      if (!closestHit || hit.distance < closestHit.distance) {
        closestHit = { ...hit, spawn };
      }
    }
  }

  if (closestHit && closestHit.spawn) {
    return {
      clear: false,
      distance: dist,
      blockingSpawn: closestHit.spawn,
      hitPoint: closestHit.point,
      hitDistance: closestHit.distance,
      testedCount,
      tilesLoaded,
      message: `LoS BLOCKED at ${closestHit.distance.toFixed(1)} units by "${closestHit.spawn.name}" (ID: ${closestHit.spawn.id}). ` +
        `Hit at (${closestHit.point.x.toFixed(1)}, ${closestHit.point.y.toFixed(1)}, ${closestHit.point.z.toFixed(1)}). ` +
        `Tested ${testedCount} spawns across ${tilesLoaded} tiles.`,
    };
  }

  return {
    clear: true,
    distance: dist,
    blockingSpawn: null,
    hitPoint: null,
    hitDistance: null,
    testedCount,
    tilesLoaded,
    message: `LoS CLEAR over ${dist.toFixed(1)} units. ` +
      `Tested ${testedCount} spawns across ${tilesLoaded} tiles.`,
  };
}

// ============================================================================
// Spawn Radius Query
// ============================================================================

/**
 * Find model spawns within a radius of a point using real VMap data.
 *
 * Loads nearby tiles and checks each spawn's bounding box against the
 * query sphere. Returns spawns sorted by distance.
 *
 * @param vmapDir Path to VMap directory
 * @param mapId Map ID
 * @param center Center point
 * @param radius Search radius in world units
 * @returns Spawns found within radius
 */
export async function findSpawnsInRadius(
  vmapDir: string,
  mapId: number,
  center: Vector3,
  radius: number,
): Promise<SpawnQueryResult> {
  const tileCoords = getTilesInRadius(center.x, center.y, radius);
  const mapData = getOrCreateMapData(mapId);
  const tilesLoaded = await loadTiles(vmapDir, mapData, tileCoords);

  const radiusSq = radius * radius;
  const results: Array<{ spawn: ModelSpawn; distance: number }> = [];
  let testedCount = 0;

  for (const spawn of mapData.allSpawns) {
    if (!hasValidBounds(spawn.bounds)) continue;
    testedCount++;

    // Check distance from center to closest point on AABB
    const closest = {
      x: Math.max(spawn.bounds.min.x, Math.min(center.x, spawn.bounds.max.x)),
      y: Math.max(spawn.bounds.min.y, Math.min(center.y, spawn.bounds.max.y)),
      z: Math.max(spawn.bounds.min.z, Math.min(center.z, spawn.bounds.max.z)),
    };

    const distSq =
      (closest.x - center.x) ** 2 +
      (closest.y - center.y) ** 2 +
      (closest.z - center.z) ** 2;

    if (distSq <= radiusSq) {
      results.push({ spawn, distance: Math.sqrt(distSq) });
    }
  }

  // Sort by distance
  results.sort((a, b) => a.distance - b.distance);

  return { spawns: results, testedCount, tilesLoaded };
}

// ============================================================================
// Cache Management
// ============================================================================

/**
 * Clear the VMap data cache.
 */
export function clearVMapCache(): void {
  vmapCache.clear();
}

/**
 * Get cache statistics.
 */
export function getVMapCacheStats(): {
  cachedMaps: number;
  totalTiles: number;
  totalSpawns: number;
} {
  let totalTiles = 0;
  let totalSpawns = 0;
  for (const mapData of vmapCache.values()) {
    totalTiles += mapData.tiles.size;
    totalSpawns += mapData.allSpawns.length;
  }
  return { cachedMaps: vmapCache.size, totalTiles, totalSpawns };
}
