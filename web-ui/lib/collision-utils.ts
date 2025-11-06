/**
 * Collision Testing Utilities
 *
 * Raycasting and line-of-sight checks for VMap collision geometry.
 * Used for interactive collision testing in the 3D viewer.
 *
 * @module collision-utils
 */

import type { AABox, ModelSpawn, Vector3, VMapData } from "./vmap-types";

// ============================================================================
// Types
// ============================================================================

/**
 * Ray definition
 */
export interface Ray {
  /** Ray origin */
  origin: Vector3;

  /** Ray direction (normalized) */
  direction: Vector3;

  /** Maximum ray distance */
  maxDistance: number;
}

/**
 * Ray-AABB intersection result
 */
export interface RayAABBIntersection {
  /** Did the ray hit the AABB? */
  hit: boolean;

  /** Distance from ray origin to hit point */
  distance: number;

  /** Hit point in world space */
  point: Vector3;

  /** Normal at hit point */
  normal: Vector3;

  /** Which model spawn was hit */
  spawn: ModelSpawn | null;
}

/**
 * Line-of-sight check result
 */
export interface LineOfSightResult {
  /** Is there a clear line of sight? */
  clear: boolean;

  /** Distance between points */
  distance: number;

  /** If blocked, the blocking spawn */
  blockingSpawn: ModelSpawn | null;

  /** If blocked, the hit point */
  hitPoint: Vector3 | null;

  /** Number of spawns tested */
  testedCount: number;
}

// ============================================================================
// Ray-AABB Intersection
// ============================================================================

/**
 * Test ray intersection with axis-aligned bounding box
 *
 * Uses the slab method for efficient AABB intersection testing.
 *
 * @param ray Ray to test
 * @param aabb Bounding box to test against
 * @returns Intersection result
 */
export function rayAABBIntersection(ray: Ray, aabb: AABox): RayAABBIntersection {
  // Initialize result
  const result: RayAABBIntersection = {
    hit: false,
    distance: Infinity,
    point: { x: 0, y: 0, z: 0 },
    normal: { x: 0, y: 0, z: 0 },
    spawn: null,
  };

  // Slab method
  let tmin = 0;
  let tmax = ray.maxDistance;

  // X slab
  const invDirX = 1 / ray.direction.x;
  let t1 = (aabb.min.x - ray.origin.x) * invDirX;
  let t2 = (aabb.max.x - ray.origin.x) * invDirX;

  if (t1 > t2) [t1, t2] = [t2, t1];

  tmin = Math.max(tmin, t1);
  tmax = Math.min(tmax, t2);

  if (tmin > tmax) return result;

  // Y slab
  const invDirY = 1 / ray.direction.y;
  t1 = (aabb.min.y - ray.origin.y) * invDirY;
  t2 = (aabb.max.y - ray.origin.y) * invDirY;

  if (t1 > t2) [t1, t2] = [t2, t1];

  tmin = Math.max(tmin, t1);
  tmax = Math.min(tmax, t2);

  if (tmin > tmax) return result;

  // Z slab
  const invDirZ = 1 / ray.direction.z;
  t1 = (aabb.min.z - ray.origin.z) * invDirZ;
  t2 = (aabb.max.z - ray.origin.z) * invDirZ;

  if (t1 > t2) [t1, t2] = [t2, t1];

  tmin = Math.max(tmin, t1);
  tmax = Math.min(tmax, t2);

  if (tmin > tmax) return result;

  // We have an intersection
  result.hit = true;
  result.distance = tmin;

  // Calculate hit point
  result.point = {
    x: ray.origin.x + ray.direction.x * tmin,
    y: ray.origin.y + ray.direction.y * tmin,
    z: ray.origin.z + ray.direction.z * tmin,
  };

  // Calculate normal (which face was hit)
  const epsilon = 0.0001;
  if (Math.abs(result.point.x - aabb.min.x) < epsilon) {
    result.normal = { x: -1, y: 0, z: 0 };
  } else if (Math.abs(result.point.x - aabb.max.x) < epsilon) {
    result.normal = { x: 1, y: 0, z: 0 };
  } else if (Math.abs(result.point.y - aabb.min.y) < epsilon) {
    result.normal = { x: 0, y: -1, z: 0 };
  } else if (Math.abs(result.point.y - aabb.max.y) < epsilon) {
    result.normal = { x: 0, y: 1, z: 0 };
  } else if (Math.abs(result.point.z - aabb.min.z) < epsilon) {
    result.normal = { x: 0, y: 0, z: -1 };
  } else {
    result.normal = { x: 0, y: 0, z: 1 };
  }

  return result;
}

/**
 * Create a ray from two points
 */
export function createRayFromPoints(start: Vector3, end: Vector3): Ray {
  const direction = {
    x: end.x - start.x,
    y: end.y - start.y,
    z: end.z - start.z,
  };

  const length = Math.sqrt(
    direction.x * direction.x + direction.y * direction.y + direction.z * direction.z,
  );

  return {
    origin: start,
    direction: {
      x: direction.x / length,
      y: direction.y / length,
      z: direction.z / length,
    },
    maxDistance: length,
  };
}

// ============================================================================
// Line-of-Sight Testing
// ============================================================================

/**
 * Test line-of-sight between two points using VMap collision data
 *
 * @param vmapData VMap data containing collision geometry
 * @param start Start position
 * @param end End position
 * @returns Line-of-sight result
 */
export function testLineOfSight(
  vmapData: VMapData,
  start: Vector3,
  end: Vector3,
): LineOfSightResult {
  // Create ray from start to end
  const ray = createRayFromPoints(start, end);

  let closestHit: RayAABBIntersection | null = null;
  let testedCount = 0;

  // Test against all spawns
  for (const spawn of vmapData.allSpawns) {
    testedCount++;

    const intersection = rayAABBIntersection(ray, spawn.bounds);

    if (intersection.hit) {
      if (
        !closestHit ||
        intersection.distance < closestHit.distance
      ) {
        closestHit = intersection;
        closestHit.spawn = spawn;
      }
    }
  }

  // Calculate distance
  const distance = Math.sqrt(
    (end.x - start.x) ** 2 + (end.y - start.y) ** 2 + (end.z - start.z) ** 2,
  );

  return {
    clear: !closestHit,
    distance,
    blockingSpawn: closestHit?.spawn ?? null,
    hitPoint: closestHit?.point ?? null,
    testedCount,
  };
}

/**
 * Raycast against VMap collision geometry
 *
 * @param vmapData VMap data
 * @param origin Ray origin
 * @param direction Ray direction (normalized)
 * @param maxDistance Maximum ray distance
 * @returns First hit or null
 */
export function raycastVMap(
  vmapData: VMapData,
  origin: Vector3,
  direction: Vector3,
  maxDistance: number = 1000,
): RayAABBIntersection | null {
  const ray: Ray = { origin, direction, maxDistance };

  let closestHit: RayAABBIntersection | null = null;

  for (const spawn of vmapData.allSpawns) {
    const intersection = rayAABBIntersection(ray, spawn.bounds);

    if (intersection.hit) {
      if (
        !closestHit ||
        intersection.distance < closestHit.distance
      ) {
        closestHit = intersection;
        closestHit.spawn = spawn;
      }
    }
  }

  return closestHit;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Calculate distance between two points
 */
export function distance3D(a: Vector3, b: Vector3): number {
  return Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2 + (b.z - a.z) ** 2);
}

/**
 * Normalize a vector
 */
export function normalize(v: Vector3): Vector3 {
  const length = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
  if (length === 0) return { x: 0, y: 0, z: 0 };
  return {
    x: v.x / length,
    y: v.y / length,
    z: v.z / length,
  };
}

/**
 * Dot product of two vectors
 */
export function dot(a: Vector3, b: Vector3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

/**
 * Cross product of two vectors
 */
export function cross(a: Vector3, b: Vector3): Vector3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

/**
 * Check if a point is inside an AABB
 */
export function pointInAABB(point: Vector3, aabb: AABox): boolean {
  return (
    point.x >= aabb.min.x &&
    point.x <= aabb.max.x &&
    point.y >= aabb.min.y &&
    point.y <= aabb.max.y &&
    point.z >= aabb.min.z &&
    point.z <= aabb.max.z
  );
}

/**
 * Find all spawns within a sphere
 */
export function findSpawnsInSphere(
  vmapData: VMapData,
  center: Vector3,
  radius: number,
): ModelSpawn[] {
  const results: ModelSpawn[] = [];
  const radiusSq = radius * radius;

  for (const spawn of vmapData.allSpawns) {
    // Calculate distance from sphere center to AABB
    const closestPoint = {
      x: Math.max(spawn.bounds.min.x, Math.min(center.x, spawn.bounds.max.x)),
      y: Math.max(spawn.bounds.min.y, Math.min(center.y, spawn.bounds.max.y)),
      z: Math.max(spawn.bounds.min.z, Math.min(center.z, spawn.bounds.max.z)),
    };

    const distSq =
      (closestPoint.x - center.x) ** 2 +
      (closestPoint.y - center.y) ** 2 +
      (closestPoint.z - center.z) ** 2;

    if (distSq <= radiusSq) {
      results.push(spawn);
    }
  }

  return results;
}
