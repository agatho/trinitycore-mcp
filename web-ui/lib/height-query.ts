/**
 * Height Query Utility for VMap/MMap Integration
 *
 * Provides height detection at X/Y coordinates using VMap collision data
 * and MMap navigation mesh data. Uses ray-casting to find terrain height.
 *
 * @module height-query
 */

import type { VMapData, AABox, ModelSpawn, Vector3 } from "./vmap-types";
import type { MMapData, NavMeshTile } from "./mmap-types";
import type { MapDataCollection } from "./map-parser";
import { queryBIHTree } from "./vmap-parser";
import { findNearestPoly } from "./mmap-parser";
import { getHeightFromMapData } from "./map-parser";

// ============================================================================
// Constants
// ============================================================================

/** Ray-casting starts from this Z position (above highest terrain) */
const RAY_START_Z = 2000;

/** Ray-casting ends at this Z position (below lowest terrain) */
const RAY_END_Z = -500;

/** Small epsilon for floating point comparisons */
const EPSILON = 0.000001;

// ============================================================================
// Height Query Interface
// ============================================================================

export interface HeightQueryOptions {
  /** Prefer VMap over MMap if both available */
  preferVMap?: boolean;

  /** Search radius for nearby polygons (yards) */
  searchRadius?: number;

  /** Return all intersection points (for debugging) */
  returnAllIntersections?: boolean;

  /** Verbose logging */
  verbose?: boolean;
}

export interface HeightQueryResult {
  /** Height Z coordinate (or null if not found) */
  z: number | null;

  /** Source of height data */
  source: "map" | "vmap" | "mmap" | null;

  /** All intersection points found (if returnAllIntersections=true) */
  intersections?: Array<{ z: number; distance: number }>;

  /** Error message if query failed */
  error?: string;
}

// ============================================================================
// Main Height Query Function
// ============================================================================

/**
 * Query height at a given X/Y position
 *
 * @param x World X coordinate
 * @param y World Y coordinate
 * @param vmapData VMap collision data (optional)
 * @param mmapData MMap navigation mesh data (optional)
 * @param mapData TrinityCore .map terrain data (optional)
 * @param options Query options
 * @returns Height query result
 */
export function getHeightAtPosition(
  x: number,
  y: number,
  vmapData?: VMapData,
  mmapData?: MMapData,
  mapData?: MapDataCollection,
  options: HeightQueryOptions = {}
): HeightQueryResult {
  const {
    preferVMap = true,
    searchRadius = 5.0,
    returnAllIntersections = false,
    verbose = false,
  } = options;

  // Try .map data first if available (most accurate terrain heights)
  if (mapData) {
    const height = getHeightFromMapData(mapData, x, y);
    if (height !== null) {
      if (verbose) {
        console.log(`[HeightQuery] Found height from .map data: ${height.toFixed(2)}`);
      }
      return {
        z: height,
        source: "map",
      };
    }
  }

  // Try VMap first if preferred and available
  if (preferVMap && vmapData) {
    const vmapResult = queryVMapHeight(x, y, vmapData, returnAllIntersections, verbose);
    if (vmapResult.z !== null) {
      return vmapResult;
    }
  }

  // Try MMap if available
  if (mmapData) {
    const mmapResult = queryMMapHeight(x, y, mmapData, searchRadius, verbose);
    if (mmapResult.z !== null) {
      return mmapResult;
    }
  }

  // Try VMap if not tried yet
  if (!preferVMap && vmapData) {
    const vmapResult = queryVMapHeight(x, y, vmapData, returnAllIntersections, verbose);
    if (vmapResult.z !== null) {
      return vmapResult;
    }
  }

  // No height found
  return {
    z: null,
    source: null,
    error: "No collision data found at this position",
  };
}

// ============================================================================
// VMap Height Query
// ============================================================================

/**
 * Query height from VMap collision data using ray-casting
 *
 * @param x World X coordinate
 * @param y World Y coordinate
 * @param vmapData VMap collision data
 * @param returnAllIntersections Return all intersection points
 * @param verbose Verbose logging
 * @returns Height query result
 */
function queryVMapHeight(
  x: number,
  y: number,
  vmapData: VMapData,
  returnAllIntersections: boolean,
  verbose: boolean
): HeightQueryResult {
  // Define ray: from (x, y, RAY_START_Z) to (x, y, RAY_END_Z)
  const rayOrigin: Vector3 = { x, y, z: RAY_START_Z };
  const rayDirection: Vector3 = { x: 0, y: 0, z: -1 }; // Downward
  const rayLength = RAY_START_Z - RAY_END_Z;

  // Create bounding box for spatial query
  const queryBounds: AABox = {
    min: { x: x - 1, y: y - 1, z: RAY_END_Z },
    max: { x: x + 1, y: y + 1, z: RAY_START_Z },
  };

  // Query BIH tree for potential spawn intersections
  const spawnIndices = queryBIHTree(vmapData.tree.tree, queryBounds, vmapData.allSpawns);

  if (verbose) {
    console.log(`[HeightQuery] Found ${spawnIndices.length} potential spawns at (${x.toFixed(2)}, ${y.toFixed(2)})`);
  }

  // Collect all intersections
  const intersections: Array<{ z: number; distance: number }> = [];

  // Test ray against each spawn's bounding box and triangles
  for (const spawnIndex of spawnIndices) {
    const spawn = vmapData.allSpawns[spawnIndex];
    if (!spawn) continue;

    // Quick AABB test
    if (!rayIntersectsAABB(rayOrigin, rayDirection, rayLength, spawn.bounds)) {
      continue;
    }

    // For now, use simplified collision: assume terrain at center of bounding box
    // In a full implementation, you would load model geometry and test triangles
    const terrainZ = (spawn.bounds.min.z + spawn.bounds.max.z) / 2;

    // Check if ray passes through this Z level
    if (terrainZ >= RAY_END_Z && terrainZ <= RAY_START_Z) {
      // Check if X/Y is within spawn bounds
      if (
        x >= spawn.bounds.min.x &&
        x <= spawn.bounds.max.x &&
        y >= spawn.bounds.min.y &&
        y <= spawn.bounds.max.y
      ) {
        const distance = RAY_START_Z - terrainZ;
        intersections.push({ z: terrainZ, distance });

        if (verbose) {
          console.log(`[HeightQuery] Found intersection at Z=${terrainZ.toFixed(2)} (spawn ${spawn.id})`);
        }
      }
    }
  }

  // Sort intersections by distance (closest first)
  intersections.sort((a, b) => a.distance - b.distance);

  if (intersections.length === 0) {
    return { z: null, source: null };
  }

  // Return highest collision point (first intersection from top)
  const result: HeightQueryResult = {
    z: intersections[0].z,
    source: "vmap",
  };

  if (returnAllIntersections) {
    result.intersections = intersections;
  }

  return result;
}

// ============================================================================
// MMap Height Query
// ============================================================================

/**
 * Query height from MMap navigation mesh data
 *
 * @param x World X coordinate
 * @param y World Y coordinate
 * @param mmapData MMap navigation mesh data
 * @param searchRadius Search radius in yards
 * @param verbose Verbose logging
 * @returns Height query result
 */
function queryMMapHeight(
  x: number,
  y: number,
  mmapData: MMapData,
  searchRadius: number,
  verbose: boolean
): HeightQueryResult {
  // Find nearest tile
  const tileWidth = mmapData.header.params.tileWidth;
  const tileHeight = mmapData.header.params.tileHeight;
  const [originX, originY] = mmapData.header.params.orig;

  // Calculate tile coordinates
  const tileX = Math.floor((x - originX) / tileWidth);
  const tileY = Math.floor((y - originY) / tileHeight);
  const tileKey = `${tileX}_${tileY}`;

  // Get tile
  const tile = mmapData.tiles.get(tileKey);
  if (!tile) {
    if (verbose) {
      console.log(`[HeightQuery] No MMap tile found at (${tileX}, ${tileY})`);
    }
    return { z: null, source: null };
  }

  // Find nearest polygon
  const position: [number, number, number] = [x, y, 0];
  const extents: [number, number, number] = [searchRadius, searchRadius, searchRadius];
  const polyIndex = findNearestPoly(tile, position, extents);

  if (polyIndex === -1) {
    if (verbose) {
      console.log(`[HeightQuery] No polygon found within ${searchRadius} yards of (${x.toFixed(2)}, ${y.toFixed(2)})`);
    }
    return { z: null, source: null };
  }

  // Get polygon height (average of vertices)
  const poly = tile.polys[polyIndex];
  let totalZ = 0;
  let vertCount = 0;

  for (let i = 0; i < poly.vertCount; i++) {
    const vert = tile.verts[poly.verts[i]];
    if (vert) {
      totalZ += vert[2]; // Z coordinate
      vertCount++;
    }
  }

  if (vertCount === 0) {
    return { z: null, source: null };
  }

  const avgZ = totalZ / vertCount;

  if (verbose) {
    console.log(`[HeightQuery] Found MMap polygon at Z=${avgZ.toFixed(2)} (tile ${tileKey}, poly ${polyIndex})`);
  }

  return {
    z: avgZ,
    source: "mmap",
  };
}

// ============================================================================
// Ray-AABB Intersection
// ============================================================================

/**
 * Test if ray intersects axis-aligned bounding box
 *
 * @param rayOrigin Ray origin point
 * @param rayDirection Ray direction (normalized)
 * @param rayLength Ray length
 * @param aabb Axis-aligned bounding box
 * @returns True if ray intersects AABB
 */
function rayIntersectsAABB(
  rayOrigin: Vector3,
  rayDirection: Vector3,
  rayLength: number,
  aabb: AABox
): boolean {
  // Use slab method for ray-box intersection
  let tmin = 0;
  let tmax = rayLength;

  // X axis
  if (Math.abs(rayDirection.x) < EPSILON) {
    // Ray parallel to X axis
    if (rayOrigin.x < aabb.min.x || rayOrigin.x > aabb.max.x) {
      return false;
    }
  } else {
    const invD = 1.0 / rayDirection.x;
    let t1 = (aabb.min.x - rayOrigin.x) * invD;
    let t2 = (aabb.max.x - rayOrigin.x) * invD;

    if (t1 > t2) [t1, t2] = [t2, t1];

    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);

    if (tmin > tmax) return false;
  }

  // Y axis
  if (Math.abs(rayDirection.y) < EPSILON) {
    if (rayOrigin.y < aabb.min.y || rayOrigin.y > aabb.max.y) {
      return false;
    }
  } else {
    const invD = 1.0 / rayDirection.y;
    let t1 = (aabb.min.y - rayOrigin.y) * invD;
    let t2 = (aabb.max.y - rayOrigin.y) * invD;

    if (t1 > t2) [t1, t2] = [t2, t1];

    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);

    if (tmin > tmax) return false;
  }

  // Z axis
  if (Math.abs(rayDirection.z) < EPSILON) {
    if (rayOrigin.z < aabb.min.z || rayOrigin.z > aabb.max.z) {
      return false;
    }
  } else {
    const invD = 1.0 / rayDirection.z;
    let t1 = (aabb.min.z - rayOrigin.z) * invD;
    let t2 = (aabb.max.z - rayOrigin.z) * invD;

    if (t1 > t2) [t1, t2] = [t2, t1];

    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);

    if (tmin > tmax) return false;
  }

  return true;
}

// ============================================================================
// Ray-Triangle Intersection (Möller-Trumbore algorithm)
// ============================================================================

/**
 * Test if ray intersects triangle
 *
 * @param rayOrigin Ray origin point
 * @param rayDirection Ray direction (normalized)
 * @param v0 Triangle vertex 0
 * @param v1 Triangle vertex 1
 * @param v2 Triangle vertex 2
 * @returns Intersection distance or null if no intersection
 */
export function rayIntersectsTriangle(
  rayOrigin: Vector3,
  rayDirection: Vector3,
  v0: Vector3,
  v1: Vector3,
  v2: Vector3
): number | null {
  // Möller-Trumbore intersection algorithm
  const edge1: Vector3 = {
    x: v1.x - v0.x,
    y: v1.y - v0.y,
    z: v1.z - v0.z,
  };

  const edge2: Vector3 = {
    x: v2.x - v0.x,
    y: v2.y - v0.y,
    z: v2.z - v0.z,
  };

  // Cross product: rayDirection × edge2
  const h: Vector3 = {
    x: rayDirection.y * edge2.z - rayDirection.z * edge2.y,
    y: rayDirection.z * edge2.x - rayDirection.x * edge2.z,
    z: rayDirection.x * edge2.y - rayDirection.y * edge2.x,
  };

  // Dot product: edge1 · h
  const a = edge1.x * h.x + edge1.y * h.y + edge1.z * h.z;

  // Check if ray is parallel to triangle
  if (Math.abs(a) < EPSILON) {
    return null;
  }

  const f = 1.0 / a;

  const s: Vector3 = {
    x: rayOrigin.x - v0.x,
    y: rayOrigin.y - v0.y,
    z: rayOrigin.z - v0.z,
  };

  // Calculate u parameter
  const u = f * (s.x * h.x + s.y * h.y + s.z * h.z);

  if (u < 0.0 || u > 1.0) {
    return null;
  }

  // Cross product: s × edge1
  const q: Vector3 = {
    x: s.y * edge1.z - s.z * edge1.y,
    y: s.z * edge1.x - s.x * edge1.z,
    z: s.x * edge1.y - s.y * edge1.x,
  };

  // Calculate v parameter
  const v = f * (rayDirection.x * q.x + rayDirection.y * q.y + rayDirection.z * q.z);

  if (v < 0.0 || u + v > 1.0) {
    return null;
  }

  // Calculate t (intersection distance)
  const t = f * (edge2.x * q.x + edge2.y * q.y + edge2.z * q.z);

  if (t > EPSILON) {
    return t; // Ray intersects triangle
  }

  return null; // Line intersection, but not ray
}

// HeightQueryOptions and HeightQueryResult are exported where defined above
