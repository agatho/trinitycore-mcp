/**
 * Collision Module - Public API
 *
 * Server-side VMap collision testing for TrinityCore MCP tools.
 *
 * @module collision
 */

export { testLineOfSight, findSpawnsInRadius, clearVMapCache, getVMapCacheStats, worldToTile } from "./vmap-collision";
export { rayAABBIntersection, createRayFromPoints, distance3D } from "./ray-aabb";
export { parseVMapTile, parseVMapTreeBounds } from "./vmap-parser";
export type {
  Vector3,
  AABox,
  ModelSpawn,
  Ray,
  RayHit,
  LineOfSightResult,
  SpawnQueryResult,
  VMapMapData,
  VMapTile,
} from "./types";
