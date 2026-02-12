/**
 * TrinityCore VMap (Visibility/Collision Map) Type Definitions
 *
 * VMap files contain collision geometry and visibility data for World of Warcraft maps.
 * The system consists of two main file types:
 * - .vmtree: BIH (Bounding Interval Hierarchy) tree for spatial queries
 * - .vmtile: Model spawn data for map tiles
 *
 * Based on TrinityCore source code:
 * - src/tools/vmap4_assembler/TileAssembler.cpp
 * - src/common/Collision/Maps/MapTree.h
 */

// ============================================================================
// Constants
// ============================================================================

/**
 * VMAP file format magic headers (8 bytes)
 * Different TrinityCore versions use different VMAP formats
 */
export const VMAP_MAGIC_V4 = "VMAP_4.D"; // WotLK era (3.3.5)
export const VMAP_MAGIC_V005 = "VMAP_005"; // Cataclysm era (4.3.4)
export const VMAP_MAGIC_V006 = "VMAP_006"; // Modern (MoP+, 5.x+)

/**
 * All supported VMAP versions
 */
export const SUPPORTED_VMAP_VERSIONS = [
  VMAP_MAGIC_V4,
  VMAP_MAGIC_V005,
  VMAP_MAGIC_V006,
] as const;

/**
 * Primary VMAP magic (latest version)
 */
export const VMAP_MAGIC = VMAP_MAGIC_V006;

/**
 * Node section marker (4 bytes)
 * Appears in .vmtree files before BIH tree data
 */
export const NODE_MARKER = "NODE";

// ============================================================================
// Basic Data Structures
// ============================================================================

/**
 * 3D Vector
 */
export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

/**
 * Axis-Aligned Bounding Box
 */
export interface AABox {
  min: Vector3;
  max: Vector3;
}

/**
 * Rotation represented as unit vector
 */
export interface Rotation {
  x: number;
  y: number;
  z: number;
}

// ============================================================================
// Model Spawn
// ============================================================================

/**
 * Flags for ModelSpawn
 */
export enum ModelSpawnFlags {
  None = 0,
  DestinationBound = 1 << 0, // Model is bound to destination
  UseLiquid = 1 << 1,        // Model uses liquid data
}

/**
 * ModelSpawn represents an instance of a model placed on the map
 * Contains position, rotation, scale, and bounds information
 */
export interface ModelSpawn {
  /** Model instance flags */
  flags: number;

  /** Unique identifier for this spawn */
  id: number;

  /** Model filename (e.g., "world/wmo/azeroth/buildings/stormwind_cathedral.wmo") */
  name: string;

  /** Position in world space */
  position: Vector3;

  /** Rotation (unit vector) */
  rotation: Rotation;

  /** Scale factor (1.0 = normal size) */
  scale: number;

  /** Axis-aligned bounding box in world space */
  bounds: AABox;

  /** Additional properties */
  adtId?: number;      // ADT tile ID if applicable
  uniqueId?: number;   // Unique instance ID
  reserved?: number;   // Reserved for future use
}

// ============================================================================
// BIH (Bounding Interval Hierarchy) Tree
// ============================================================================

/**
 * BIH node axis enum
 */
export enum BIHAxis {
  X = 0,
  Y = 1,
  Z = 2,
}

/**
 * BIH Tree Node
 * Binary Interval Hierarchy for fast spatial queries
 */
export interface BIHNode {
  /** Child indices (2 children per node) */
  children: [number, number];

  /** Bounding intervals for children */
  bounds: [number, number];

  /** Split axis (X, Y, or Z) */
  axis: BIHAxis;

  /** Is this a leaf node? */
  isLeaf: boolean;

  /** For leaf nodes: start index into objects array */
  objectStart?: number;

  /** For leaf nodes: count of objects */
  objectCount?: number;

  /** For leaf nodes: resolved indices of ModelSpawns contained (deprecated, use objectStart/objectCount) */
  objects?: number[];
}

/**
 * Complete BIH Tree structure
 */
export interface BIHTree {
  /** Tree nodes */
  nodes: BIHNode[];

  /** Object indices (ModelSpawn references) */
  objects: number[];

  /** Root node bounding box */
  bounds: AABox;
}

// ============================================================================
// Collision Geometry
// ============================================================================

/**
 * Triangle for collision detection
 */
export interface Triangle {
  /** Vertex indices (3 vertices per triangle) */
  vertices: [number, number, number];

  /** Material ID (0xFF = collision-only, not rendered) */
  materialId: number;

  /** Flags (e.g., walkable, no collision, etc.) */
  flags: number;
}

/**
 * Mesh geometry data
 */
export interface Mesh {
  /** Vertex positions */
  vertices: Vector3[];

  /** Triangle indices */
  triangles: Triangle[];

  /** Bounding box */
  bounds: AABox;

  /** Material names/IDs */
  materials?: string[];
}

/**
 * Group model (part of a WMO)
 */
export interface GroupModel {
  /** Group ID */
  id: number;

  /** Group name */
  name: string;

  /** Collision mesh */
  mesh: Mesh;

  /** Liquid data (if present) */
  liquid?: LiquidData;

  /** BSP tree for indoor/outdoor detection */
  bsp?: BSPNode[];
}

// ============================================================================
// Liquid Data
// ============================================================================

/**
 * WMO Liquid Header (packed structure)
 */
export interface WMOLiquidHeader {
  /** Grid dimensions */
  xverts: number;
  yverts: number;
  xtiles: number;
  ytiles: number;

  /** Position offset */
  pos_x: number;
  pos_y: number;
  pos_z: number;

  /** Liquid material type */
  material: number;
}

/**
 * Liquid geometry data
 */
export interface LiquidData {
  /** Header information */
  header: WMOLiquidHeader;

  /** Height map (xverts * yverts) */
  heightMap: number[];

  /** Tile flags (xtiles * ytiles) */
  tileFlags: number[];
}

// ============================================================================
// BSP Tree (for indoor/outdoor detection)
// ============================================================================

/**
 * BSP Tree Node
 * Used for determining if a point is inside/outside a WMO
 */
export interface BSPNode {
  /** Plane normal */
  planeNormal: Vector3;

  /** Plane distance from origin */
  planeDistance: number;

  /** Child indices (-1 for leaf) */
  children: [number, number];

  /** Face indices for this node */
  faceIndices?: number[];
}

// ============================================================================
// VMap File Structures
// ============================================================================

/**
 * .vmtree file contents
 * Contains the spatial index for a map
 */
export interface VMapTree {
  /** Magic header for validation */
  magic: string;

  /** Node marker */
  nodeMarker: string;

  /** BIH tree structure */
  tree: BIHTree;

  /** Map ID */
  mapId: number;
}

/**
 * .vmtile file contents
 * Contains model spawn data for a specific tile
 */
export interface VMapTile {
  /** Magic header for validation */
  magic: string;

  /** Number of spawns in this tile */
  spawnCount: number;

  /** Model spawns */
  spawns: ModelSpawn[];

  /** Tile coordinates */
  tileX: number;
  tileY: number;
}

/**
 * .vmtileidx file contents (optional)
 * Contains BIH node indices for spawns
 */
export interface VMapTileIndex {
  /** Magic header for validation */
  magic: string;

  /** Number of spawns */
  spawnCount: number;

  /** Node indices (one per spawn) */
  nodeIndices: number[];
}

/**
 * Complete VMap data for a map
 * Combines tree and tile data
 */
export interface VMapData {
  /** Map ID */
  mapId: number;

  /** Map name */
  mapName: string;

  /** Spatial index tree */
  tree: VMapTree;

  /** Tiles (keyed by "x_y") */
  tiles: Map<string, VMapTile>;

  /** All model spawns across all tiles */
  allSpawns: ModelSpawn[];

  /** Bounding box for entire map */
  bounds: AABox;
}

// ============================================================================
// Query Results
// ============================================================================

/**
 * Location info from collision query
 */
export interface LocationInfo {
  /** Root spawn ID */
  rootId: number;

  /** Hit model spawn */
  hitSpawn: ModelSpawn | null;

  /** Ground Z elevation */
  ground_Z: number;

  /** Did the query hit anything? */
  hit: boolean;
}

/**
 * Area info from collision query
 */
export interface AreaInfo {
  /** Query result status */
  result: boolean;

  /** Ground Z elevation */
  ground_Z: number;

  /** Collision flags */
  flags: number;

  /** ADT tile ID */
  adtId: number;

  /** Root spawn ID */
  rootId: number;

  /** Group ID */
  groupId: number;
}

/**
 * Ray cast result
 */
export interface RayCastResult {
  /** Did the ray hit something? */
  hit: boolean;

  /** Hit position */
  position: Vector3;

  /** Hit normal */
  normal: Vector3;

  /** Distance from ray origin */
  distance: number;

  /** Model spawn that was hit */
  spawn: ModelSpawn | null;

  /** Triangle that was hit */
  triangle: Triangle | null;
}

// ============================================================================
// Parser Options
// ============================================================================

/**
 * Options for VMap parser
 */
export interface VMapParserOptions {
  /** Validate magic headers strictly */
  strictValidation?: boolean;

  /** Load liquid data */
  loadLiquids?: boolean;

  /** Load BSP trees */
  loadBSP?: boolean;

  /** Maximum tiles to load (-1 for all) */
  maxTiles?: number;

  /** Verbose logging */
  verbose?: boolean;
}

/**
 * Parse error
 */
export class VMapParseError extends Error {
  constructor(
    message: string,
    public readonly file: string,
    public readonly offset: number,
  ) {
    super(`VMap parse error in ${file} at offset ${offset}: ${message}`);
    this.name = "VMapParseError";
  }
}
