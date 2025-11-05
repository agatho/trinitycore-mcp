/**
 * TrinityCore MMap (Movement Map / Navigation Mesh) Type Definitions
 *
 * MMap files contain navigation mesh data for creature pathfinding.
 * The system uses Recast/Detour library format:
 * - .mmap: Navigation mesh parameters and off-mesh connections
 * - .mmtile: Individual tile navigation mesh data
 *
 * Based on:
 * - TrinityCore: src/common/Collision/Maps/MMapDefines.h
 * - TrinityCore: src/common/Collision/Management/MMapManager.cpp
 * - Recast/Detour: DetourNavMesh.h
 */

// ============================================================================
// Constants
// ============================================================================

/**
 * MMap file format magic number ('MMAP')
 */
export const MMAP_MAGIC = 0x4d4d4150;

/**
 * MMap file format version
 */
export const MMAP_VERSION = 16;

/**
 * Detour NavMesh version
 */
export const DT_NAVMESH_VERSION = 7;

/**
 * Magic number for Detour tile data
 */
export const DT_NAVMESH_MAGIC = 0x444e4156; // 'DNAV'

/**
 * Maximum vertices per polygon in Detour
 */
export const DT_VERTS_PER_POLYGON = 6;

// ============================================================================
// Navigation Areas
// ============================================================================

/**
 * Navigation area types
 * These define different terrain types with different movement costs
 */
export enum NavArea {
  EMPTY = 0,
  GROUND = 11,
  GROUND_STEEP = 10,
  WATER = 9,
  MAGMA_SLIME = 8,
}

/**
 * Terrain flags corresponding to navigation areas
 */
export enum NavTerrainFlag {
  EMPTY = 0x00,
  GROUND = 0x01,
  GROUND_STEEP = 0x02,
  WATER = 0x04,
  MAGMA_SLIME = 0x08,
}

// ============================================================================
// Detour NavMesh Parameters
// ============================================================================

/**
 * Navigation mesh parameters
 * Defines the coordinate space and capacity of the navigation mesh
 */
export interface dtNavMeshParams {
  /** World space origin of tile space */
  orig: [number, number, number];

  /** Width of each tile (x-axis) */
  tileWidth: number;

  /** Height of each tile (z-axis) */
  tileHeight: number;

  /** Maximum tiles the mesh can contain */
  maxTiles: number;

  /** Maximum polygons per tile */
  maxPolys: number;
}

// ============================================================================
// TrinityCore MMap Headers
// ============================================================================

/**
 * MMap navigation mesh header (.mmap file)
 * Size: 40 bytes
 */
export interface MmapNavMeshHeader {
  /** Magic number (MMAP_MAGIC) */
  mmapMagic: number;

  /** MMap version (MMAP_VERSION) */
  mmapVersion: number;

  /** Detour navigation mesh parameters */
  params: dtNavMeshParams;

  /** Number of off-mesh connections */
  offmeshConnectionCount: number;
}

/**
 * MMap tile header (.mmtile file)
 * Size: 20 bytes
 */
export interface MmapTileHeader {
  /** Magic number (MMAP_MAGIC) */
  mmapMagic: number;

  /** Detour version (DT_NAVMESH_VERSION) */
  dtVersion: number;

  /** MMap version (MMAP_VERSION) */
  mmapVersion: number;

  /** Size of the navigation mesh data following the header */
  size: number;

  /** Whether this tile uses liquid data */
  usesLiquids: boolean;

  /** Padding (3 bytes) */
  padding: [number, number, number];
}

// ============================================================================
// Detour Mesh Data Structures
// ============================================================================

/**
 * Detour mesh header
 * Describes the contents and properties of a single mesh tile
 */
export interface dtMeshHeader {
  /** Format identification magic number */
  magic: number;

  /** Version number */
  version: number;

  /** Tile grid position X */
  x: number;

  /** Tile grid position Y */
  y: number;

  /** Layer index (for multi-layer tiles) */
  layer: number;

  /** User-defined tile ID */
  userId: number;

  /** Number of polygons in tile */
  polyCount: number;

  /** Number of vertices in tile */
  vertCount: number;

  /** Maximum number of links */
  maxLinkCount: number;

  /** Number of detail meshes */
  detailMeshCount: number;

  /** Number of detail vertices */
  detailVertCount: number;

  /** Number of detail triangles */
  detailTriCount: number;

  /** Number of BVH nodes */
  bvNodeCount: number;

  /** Number of off-mesh connections */
  offMeshConCount: number;

  /** Index of first off-mesh polygon */
  offMeshBase: number;

  /** Agent walkable height */
  walkableHeight: number;

  /** Agent walkable radius */
  walkableRadius: number;

  /** Agent walkable climb */
  walkableClimb: number;

  /** Tile bounding box minimum */
  bmin: [number, number, number];

  /** Tile bounding box maximum */
  bmax: [number, number, number];

  /** BV quantization factor */
  bvQuantFactor: number;
}

/**
 * Detour polygon
 * Defines an individual walkable polygon within a tile
 */
export interface dtPoly {
  /** Index of first link (for pathfinding) */
  firstLink: number;

  /** Vertex indices (up to DT_VERTS_PER_POLYGON) */
  verts: number[];

  /** Neighbor polygon references */
  neis: number[];

  /** Polygon flags */
  flags: number;

  /** Number of vertices */
  vertCount: number;

  /** Area type and polygon type encoded together */
  areaAndtype: number;
}

/**
 * Detour detail mesh
 * Stores high-resolution height detail for a polygon
 */
export interface dtPolyDetail {
  /** Index of first detail vertex */
  vertBase: number;

  /** Index of first detail triangle */
  triBase: number;

  /** Number of detail vertices */
  vertCount: number;

  /** Number of detail triangles */
  triCount: number;
}

/**
 * Detour BVH (Bounding Volume Hierarchy) node
 * Used for fast polygon queries
 */
export interface dtBVNode {
  /** Minimum bounds */
  bmin: [number, number, number];

  /** Maximum bounds */
  bmax: [number, number, number];

  /** Index of first polygon (leaf) or child node */
  i: number;
}

/**
 * Off-mesh connection
 * Represents special connections like jumps, teleports, etc.
 */
export interface dtOffMeshConnection {
  /** Start position */
  pos: [number, number, number, number, number, number]; // [startX, startY, startZ, endX, endY, endZ]

  /** Connection radius */
  rad: number;

  /** Reference to polygon */
  poly: number;

  /** Flags */
  flags: number;

  /** Connection side */
  side: number;

  /** User ID */
  userId: number;
}

// ============================================================================
// Complete Navigation Mesh Tile
// ============================================================================

/**
 * Complete navigation mesh tile data
 * Parsed from .mmtile file
 */
export interface NavMeshTile {
  /** Tile header */
  header: dtMeshHeader;

  /** Vertices */
  verts: [number, number, number][];

  /** Polygons */
  polys: dtPoly[];

  /** Links (for pathfinding) */
  links: dtLink[];

  /** Detail meshes */
  detailMeshes: dtPolyDetail[];

  /** Detail vertices */
  detailVerts: [number, number, number][];

  /** Detail triangles (indices into detailVerts) */
  detailTris: number[];

  /** BVH nodes */
  bvTree: dtBVNode[];

  /** Off-mesh connections */
  offMeshCons: dtOffMeshConnection[];
}

/**
 * Detour link (for pathfinding)
 */
export interface dtLink {
  /** Reference to neighbor polygon */
  ref: number;

  /** Index of next link */
  next: number;

  /** Edge index */
  edge: number;

  /** Connection side */
  side: number;

  /** Minimum connection height */
  bmin: number;

  /** Maximum connection height */
  bmax: number;
}

// ============================================================================
// Complete MMap Data
// ============================================================================

/**
 * Complete MMap data for a map
 * Combines .mmap and .mmtile data
 */
export interface MMapData {
  /** Map ID */
  mapId: number;

  /** Map name */
  mapName: string;

  /** Navigation mesh header */
  header: MmapNavMeshHeader;

  /** Tiles (keyed by "x_y") */
  tiles: Map<string, NavMeshTile>;

  /** Off-mesh connections */
  offMeshConnections: dtOffMeshConnection[];
}

// ============================================================================
// Pathfinding Result
// ============================================================================

/**
 * Pathfinding result
 */
export interface PathfindingResult {
  /** Was a path found? */
  success: boolean;

  /** Path waypoints */
  path: [number, number, number][];

  /** Total path length */
  length: number;

  /** Path cost */
  cost: number;

  /** Error message if failed */
  error?: string;
}

/**
 * Point query result
 */
export interface PointQueryResult {
  /** Was the point valid? */
  valid: boolean;

  /** Nearest polygon reference */
  polyRef: number;

  /** Nearest point on navmesh */
  nearestPoint: [number, number, number];

  /** Distance to nearest point */
  distance: number;

  /** Area type */
  area: NavArea;
}

// ============================================================================
// Parser Options
// ============================================================================

/**
 * Options for MMap parser
 */
export interface MMapParserOptions {
  /** Validate magic headers and versions strictly */
  strictValidation?: boolean;

  /** Load off-mesh connections */
  loadOffMeshConnections?: boolean;

  /** Load BVH trees */
  loadBVTree?: boolean;

  /** Load detail meshes */
  loadDetailMeshes?: boolean;

  /** Maximum tiles to load (-1 for all) */
  maxTiles?: number;

  /** Verbose logging */
  verbose?: boolean;
}

/**
 * Parse error
 */
export class MMapParseError extends Error {
  constructor(
    message: string,
    public readonly file: string,
    public readonly offset: number,
  ) {
    super(`MMap parse error in ${file} at offset ${offset}: ${message}`);
    this.name = "MMapParseError";
  }
}
