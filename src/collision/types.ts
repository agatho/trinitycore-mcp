/**
 * VMap Collision Type Definitions (Server-Side)
 *
 * Minimal type definitions for server-side VMap collision testing.
 * These mirror the web-ui/lib/vmap-types.ts types but are independent
 * to avoid cross-project imports.
 *
 * @module collision/types
 */

/** 3D Vector */
export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

/** Axis-Aligned Bounding Box */
export interface AABox {
  min: Vector3;
  max: Vector3;
}

/** Model spawn in VMap data */
export interface ModelSpawn {
  flags: number;
  id: number;
  name: string;
  position: Vector3;
  rotation: Vector3;
  scale: number;
  bounds: AABox;
  adtId?: number;
}

/** Parsed VMap tile (from .vmtile file) */
export interface VMapTile {
  magic: string;
  spawnCount: number;
  spawns: ModelSpawn[];
  tileX: number;
  tileY: number;
}

/** Cached VMap data for a map */
export interface VMapMapData {
  mapId: number;
  /** Loaded tiles keyed by "tileX_tileY" */
  tiles: Map<string, VMapTile>;
  /** All spawns across all loaded tiles */
  allSpawns: ModelSpawn[];
  /** Overall bounding box of loaded data */
  bounds: AABox;
}

/** Ray definition */
export interface Ray {
  origin: Vector3;
  direction: Vector3;
  maxDistance: number;
}

/** Ray-AABB intersection result */
export interface RayHit {
  hit: boolean;
  distance: number;
  point: Vector3;
  normal: Vector3;
  spawn: ModelSpawn | null;
}

/** Line-of-sight result */
export interface LineOfSightResult {
  /** Is there a clear line of sight? */
  clear: boolean;
  /** Distance between start and end points */
  distance: number;
  /** If blocked, the blocking model spawn */
  blockingSpawn: ModelSpawn | null;
  /** If blocked, the hit point */
  hitPoint: Vector3 | null;
  /** Hit distance from start (if blocked) */
  hitDistance: number | null;
  /** Number of spawns tested */
  testedCount: number;
  /** Number of tiles loaded */
  tilesLoaded: number;
  /** Descriptive message */
  message: string;
}

/** Spawn query result */
export interface SpawnQueryResult {
  /** Spawns found within radius */
  spawns: Array<{
    spawn: ModelSpawn;
    distance: number;
  }>;
  /** Total spawns tested */
  testedCount: number;
  /** Number of tiles loaded */
  tilesLoaded: number;
}

/** Supported VMAP magic strings */
export const SUPPORTED_VMAP_MAGICS = ["VMAP_4.D", "VMAP_005", "VMAP_006"] as const;

/** Size of one map tile in world units (yards) */
export const TILE_SIZE = 533.33333;

/** Grid dimensions (64x64 tiles per map) */
export const GRID_SIZE = 64;

/** Grid center offset */
export const GRID_CENTER = 32;

/** MOD_HAS_BOUND flag for ModelSpawn */
export const MOD_HAS_BOUND = 1;
