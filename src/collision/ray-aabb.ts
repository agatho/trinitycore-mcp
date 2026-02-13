/**
 * Ray-AABB Intersection Testing
 *
 * Implements the slab method for efficient axis-aligned bounding box
 * intersection testing. Used by the VMap collision system for line-of-sight
 * and raycast queries.
 *
 * Adapted from web-ui/lib/collision-utils.ts for server-side use.
 *
 * @module collision/ray-aabb
 */

import type { Vector3, AABox, Ray, RayHit, ModelSpawn } from "./types";

/**
 * Test ray intersection with an axis-aligned bounding box using the slab method.
 *
 * The slab method tests the ray against each pair of parallel planes (X, Y, Z slabs)
 * and finds the interval where the ray is inside all three slabs simultaneously.
 *
 * @param ray Ray to test (origin + direction + maxDistance)
 * @param aabb Bounding box to test against
 * @returns Intersection result with hit point, distance, and normal
 */
export function rayAABBIntersection(ray: Ray, aabb: AABox): RayHit {
  const result: RayHit = {
    hit: false,
    distance: Infinity,
    point: { x: 0, y: 0, z: 0 },
    normal: { x: 0, y: 0, z: 0 },
    spawn: null,
  };

  let tmin = 0;
  let tmax = ray.maxDistance;

  // X slab
  if (ray.direction.x !== 0) {
    const invDirX = 1 / ray.direction.x;
    let t1 = (aabb.min.x - ray.origin.x) * invDirX;
    let t2 = (aabb.max.x - ray.origin.x) * invDirX;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return result;
  } else {
    // Ray is parallel to X slab — check if origin is inside
    if (ray.origin.x < aabb.min.x || ray.origin.x > aabb.max.x) return result;
  }

  // Y slab
  if (ray.direction.y !== 0) {
    const invDirY = 1 / ray.direction.y;
    let t1 = (aabb.min.y - ray.origin.y) * invDirY;
    let t2 = (aabb.max.y - ray.origin.y) * invDirY;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return result;
  } else {
    if (ray.origin.y < aabb.min.y || ray.origin.y > aabb.max.y) return result;
  }

  // Z slab
  if (ray.direction.z !== 0) {
    const invDirZ = 1 / ray.direction.z;
    let t1 = (aabb.min.z - ray.origin.z) * invDirZ;
    let t2 = (aabb.max.z - ray.origin.z) * invDirZ;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return result;
  } else {
    if (ray.origin.z < aabb.min.z || ray.origin.z > aabb.max.z) return result;
  }

  // Intersection found
  result.hit = true;
  result.distance = tmin;

  // Calculate hit point
  result.point = {
    x: ray.origin.x + ray.direction.x * tmin,
    y: ray.origin.y + ray.direction.y * tmin,
    z: ray.origin.z + ray.direction.z * tmin,
  };

  // Determine which face was hit (for normal calculation)
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
 * Create a ray from two points (start → end).
 * Direction is normalized, maxDistance is the distance between points.
 */
export function createRayFromPoints(start: Vector3, end: Vector3): Ray {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const dz = end.z - start.z;
  const length = Math.sqrt(dx * dx + dy * dy + dz * dz);

  if (length === 0) {
    return {
      origin: start,
      direction: { x: 0, y: 0, z: 1 },
      maxDistance: 0,
    };
  }

  return {
    origin: start,
    direction: {
      x: dx / length,
      y: dy / length,
      z: dz / length,
    },
    maxDistance: length,
  };
}

/**
 * Calculate Euclidean distance between two 3D points.
 */
export function distance3D(a: Vector3, b: Vector3): number {
  return Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2 + (b.z - a.z) ** 2);
}
