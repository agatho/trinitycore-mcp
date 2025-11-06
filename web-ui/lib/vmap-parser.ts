/**
 * TrinityCore VMap (Visibility/Collision Map) Parser
 *
 * Parses binary VMap files from TrinityCore:
 * - .vmtree: BIH tree spatial index
 * - .vmtile: Model spawn data
 * - .vmtileidx: Optional spawn index data
 *
 * Binary Format Reference:
 * - TrinityCore: src/tools/vmap4_assembler/TileAssembler.cpp
 * - TrinityCore: src/common/Collision/Maps/MapTree.h
 *
 * @module vmap-parser
 */

import type {
  AABox,
  BIHAxis,
  BIHNode,
  BIHTree,
  ModelSpawn,
  Rotation,
  Vector3,
  VMapData,
  VMapParserOptions,
  VMapTile,
  VMapTileIndex,
  VMapTree,
} from "./vmap-types";
import { NODE_MARKER, VMAP_MAGIC, VMapParseError } from "./vmap-types";

// ============================================================================
// Binary Reader Utility
// ============================================================================

/**
 * Binary data reader with automatic offset tracking
 */
class BinaryReader {
  private offset: number = 0;
  private view: DataView;
  private textDecoder: TextDecoder;

  constructor(
    private buffer: ArrayBuffer,
    private littleEndian: boolean = true,
  ) {
    this.view = new DataView(buffer);
    this.textDecoder = new TextDecoder("utf-8");
  }

  getOffset(): number {
    return this.offset;
  }

  setOffset(offset: number): void {
    if (offset < 0 || offset > this.buffer.byteLength) {
      throw new Error(`Invalid offset: ${offset}`);
    }
    this.offset = offset;
  }

  skip(bytes: number): void {
    this.offset += bytes;
  }

  remaining(): number {
    return this.buffer.byteLength - this.offset;
  }

  readUInt8(): number {
    const value = this.view.getUint8(this.offset);
    this.offset += 1;
    return value;
  }

  readInt32(): number {
    const value = this.view.getInt32(this.offset, this.littleEndian);
    this.offset += 4;
    return value;
  }

  readUInt32(): number {
    const value = this.view.getUint32(this.offset, this.littleEndian);
    this.offset += 4;
    return value;
  }

  readFloat32(): number {
    const value = this.view.getFloat32(this.offset, this.littleEndian);
    this.offset += 4;
    return value;
  }

  readFloat64(): number {
    const value = this.view.getFloat64(this.offset, this.littleEndian);
    this.offset += 8;
    return value;
  }

  readString(length: number): string {
    const bytes = new Uint8Array(this.buffer, this.offset, length);
    this.offset += length;

    // Remove null terminators
    let endIndex = bytes.length;
    for (let i = 0; i < bytes.length; i++) {
      if (bytes[i] === 0) {
        endIndex = i;
        break;
      }
    }

    return this.textDecoder.decode(bytes.subarray(0, endIndex));
  }

  readStringNullTerminated(): string {
    let length = 0;
    const startOffset = this.offset;

    // Find null terminator
    while (
      this.offset + length < this.buffer.byteLength &&
      this.view.getUint8(this.offset + length) !== 0
    ) {
      length++;
    }

    const string = this.readString(length);
    this.offset++; // Skip null terminator
    return string;
  }

  readVector3(): Vector3 {
    return {
      x: this.readFloat32(),
      y: this.readFloat32(),
      z: this.readFloat32(),
    };
  }

  readAABox(): AABox {
    return {
      min: this.readVector3(),
      max: this.readVector3(),
    };
  }

  readBytes(length: number): Uint8Array {
    const bytes = new Uint8Array(this.buffer, this.offset, length);
    this.offset += length;
    return bytes;
  }
}

// ============================================================================
// VMap Tree Parser (.vmtree)
// ============================================================================

/**
 * Parse a .vmtree file
 *
 * Format:
 * - VMAP_MAGIC (8 bytes)
 * - NODE_MARKER (4 bytes)
 * - BIH tree data
 *
 * @param buffer .vmtree file contents
 * @param mapId Map ID
 * @param options Parser options
 * @returns Parsed VMapTree
 */
export function parseVMapTree(
  buffer: ArrayBuffer,
  mapId: number,
  options: VMapParserOptions = {},
): VMapTree {
  const reader = new BinaryReader(buffer);
  const fileName = `${mapId.toString().padStart(3, "0")}.vmtree`;

  // Read magic header (8 bytes)
  const magic = reader.readString(8);
  if (options.strictValidation !== false && magic !== VMAP_MAGIC) {
    throw new VMapParseError(
      `Invalid magic header: expected "${VMAP_MAGIC}", got "${magic}"`,
      fileName,
      reader.getOffset(),
    );
  }

  // Read node marker (4 bytes)
  const nodeMarker = reader.readString(4);
  if (options.strictValidation !== false && nodeMarker !== NODE_MARKER) {
    throw new VMapParseError(
      `Invalid node marker: expected "${NODE_MARKER}", got "${nodeMarker}"`,
      fileName,
      reader.getOffset(),
    );
  }

  // Parse BIH tree
  const tree = parseBIHTree(reader, fileName);

  if (options.verbose) {
    console.log(
      `[VMapParser] Parsed ${fileName}: ${tree.nodes.length} nodes, ${tree.objects.length} objects`,
    );
  }

  return {
    magic,
    nodeMarker,
    tree,
    mapId,
  };
}

/**
 * Parse BIH (Bounding Interval Hierarchy) tree
 *
 * Format (simplified):
 * - bounds (AABox)
 * - node_count (uint32)
 * - nodes[node_count]
 * - object_count (uint32)
 * - objects[object_count]
 */
function parseBIHTree(reader: BinaryReader, fileName: string): BIHTree {
  // Read bounding box
  const bounds = reader.readAABox();

  // Read node count
  const nodeCount = reader.readUInt32();
  if (nodeCount === 0 || nodeCount > 1000000) {
    throw new VMapParseError(
      `Invalid node count: ${nodeCount}`,
      fileName,
      reader.getOffset(),
    );
  }

  // Read nodes
  const nodes: BIHNode[] = [];
  for (let i = 0; i < nodeCount; i++) {
    nodes.push(parseBIHNode(reader));
  }

  // Read object count
  const objectCount = reader.readUInt32();
  if (objectCount > 10000000) {
    throw new VMapParseError(
      `Invalid object count: ${objectCount}`,
      fileName,
      reader.getOffset(),
    );
  }

  // Read object indices
  const objects: number[] = [];
  for (let i = 0; i < objectCount; i++) {
    objects.push(reader.readUInt32());
  }

  return {
    nodes,
    objects,
    bounds,
  };
}

/**
 * Parse a single BIH node
 */
function parseBIHNode(reader: BinaryReader): BIHNode {
  // Read children indices
  const child0 = reader.readUInt32();
  const child1 = reader.readUInt32();

  // Read bounds
  const bound0 = reader.readFloat32();
  const bound1 = reader.readFloat32();

  // Read axis (0=X, 1=Y, 2=Z)
  const axis = reader.readUInt32() as BIHAxis;

  // Determine if leaf node
  // Convention: leaf nodes have high bit set on child0
  const isLeaf = (child0 & 0x80000000) !== 0;

  // If leaf, read object indices
  let objects: number[] | undefined;
  if (isLeaf) {
    const objectCount = child0 & 0x7fffffff; // Clear high bit
    objects = [];
    for (let i = 0; i < objectCount; i++) {
      objects.push(reader.readUInt32());
    }
  }

  return {
    children: [child0, child1],
    bounds: [bound0, bound1],
    axis,
    isLeaf,
    objects,
  };
}

// ============================================================================
// VMap Tile Parser (.vmtile)
// ============================================================================

/**
 * Parse a .vmtile file
 *
 * Format:
 * - VMAP_MAGIC (8 bytes)
 * - spawn_count (uint32)
 * - ModelSpawn[spawn_count]
 *
 * @param buffer .vmtile file contents
 * @param tileX Tile X coordinate
 * @param tileY Tile Y coordinate
 * @param options Parser options
 * @returns Parsed VMapTile
 */
export function parseVMapTile(
  buffer: ArrayBuffer,
  tileX: number,
  tileY: number,
  options: VMapParserOptions = {},
): VMapTile {
  const reader = new BinaryReader(buffer);
  const fileName = `${tileX}_${tileY}.vmtile`;

  // Read magic header (8 bytes)
  const magic = reader.readString(8);
  if (options.strictValidation !== false && magic !== VMAP_MAGIC) {
    throw new VMapParseError(
      `Invalid magic header: expected "${VMAP_MAGIC}", got "${magic}"`,
      fileName,
      reader.getOffset(),
    );
  }

  // Read spawn count
  const spawnCount = reader.readUInt32();
  if (spawnCount > 100000) {
    throw new VMapParseError(
      `Unreasonably large spawn count: ${spawnCount}`,
      fileName,
      reader.getOffset(),
    );
  }

  // Read spawns
  const spawns: ModelSpawn[] = [];
  for (let i = 0; i < spawnCount; i++) {
    spawns.push(parseModelSpawn(reader));
  }

  if (options.verbose) {
    console.log(`[VMapParser] Parsed ${fileName}: ${spawnCount} spawns`);
  }

  return {
    magic,
    spawnCount,
    spawns,
    tileX,
    tileY,
  };
}

/**
 * Parse a ModelSpawn structure
 *
 * Format (approximate):
 * - flags (uint32)
 * - id (uint32)
 * - name_length (uint32)
 * - name (string)
 * - position (Vector3)
 * - rotation (Vector3)
 * - scale (float32)
 * - bounds (AABox)
 */
function parseModelSpawn(reader: BinaryReader): ModelSpawn {
  // Read flags
  const flags = reader.readUInt32();

  // Read unique ID
  const id = reader.readUInt32();

  // Read model name (null-terminated string)
  const nameLength = reader.readUInt32();
  const name = reader.readString(nameLength);

  // Read position
  const position = reader.readVector3();

  // Read rotation (unit vector)
  const rotation: Rotation = {
    x: reader.readFloat32(),
    y: reader.readFloat32(),
    z: reader.readFloat32(),
  };

  // Read scale
  const scale = reader.readFloat32();

  // Read bounding box
  const bounds = reader.readAABox();

  return {
    flags,
    id,
    name,
    position,
    rotation,
    scale,
    bounds,
  };
}

// ============================================================================
// VMap Tile Index Parser (.vmtileidx) - Optional
// ============================================================================

/**
 * Parse a .vmtileidx file (optional companion to .vmtile)
 *
 * Format:
 * - VMAP_MAGIC (8 bytes)
 * - spawn_count (uint32)
 * - node_indices[spawn_count] (uint32 each)
 *
 * @param buffer .vmtileidx file contents
 * @param options Parser options
 * @returns Parsed VMapTileIndex
 */
export function parseVMapTileIndex(
  buffer: ArrayBuffer,
  options: VMapParserOptions = {},
): VMapTileIndex {
  const reader = new BinaryReader(buffer);
  const fileName = "*.vmtileidx";

  // Read magic header (8 bytes)
  const magic = reader.readString(8);
  if (options.strictValidation !== false && magic !== VMAP_MAGIC) {
    throw new VMapParseError(
      `Invalid magic header: expected "${VMAP_MAGIC}", got "${magic}"`,
      fileName,
      reader.getOffset(),
    );
  }

  // Read spawn count
  const spawnCount = reader.readUInt32();

  // Read node indices
  const nodeIndices: number[] = [];
  for (let i = 0; i < spawnCount; i++) {
    nodeIndices.push(reader.readUInt32());
  }

  return {
    magic,
    spawnCount,
    nodeIndices,
  };
}

// ============================================================================
// High-Level API
// ============================================================================

/**
 * Load complete VMap data for a map
 *
 * @param mapId Map ID
 * @param treeBuffer .vmtree file buffer
 * @param tileBuffers Map of tile buffers (key: "x_y", value: buffer)
 * @param options Parser options
 * @returns Complete VMapData
 */
export function loadVMapData(
  mapId: number,
  mapName: string,
  treeBuffer: ArrayBuffer,
  tileBuffers: Map<string, ArrayBuffer>,
  options: VMapParserOptions = {},
): VMapData {
  // Parse tree
  const tree = parseVMapTree(treeBuffer, mapId, options);

  // Parse tiles
  const tiles = new Map<string, VMapTile>();
  const allSpawns: ModelSpawn[] = [];

  let tileCount = 0;
  for (const [key, buffer] of tileBuffers.entries()) {
    // Check max tiles limit
    if (options.maxTiles && options.maxTiles > 0 && tileCount >= options.maxTiles) {
      if (options.verbose) {
        console.log(
          `[VMapParser] Reached max tiles limit (${options.maxTiles}), stopping`,
        );
      }
      break;
    }

    // Parse tile coordinates from key "x_y"
    const [xStr, yStr] = key.split("_");
    const tileX = parseInt(xStr, 10);
    const tileY = parseInt(yStr, 10);

    // Parse tile
    const tile = parseVMapTile(buffer, tileX, tileY, options);
    tiles.set(key, tile);

    // Collect all spawns
    allSpawns.push(...tile.spawns);
    tileCount++;
  }

  // Calculate overall bounding box
  const bounds = calculateOverallBounds(allSpawns);

  if (options.verbose) {
    console.log(
      `[VMapParser] Loaded VMap data for map ${mapId}: ${tiles.size} tiles, ${allSpawns.length} total spawns`,
    );
  }

  return {
    mapId,
    mapName,
    tree,
    tiles,
    allSpawns,
    bounds,
  };
}

/**
 * Calculate overall bounding box from all spawns
 */
function calculateOverallBounds(spawns: ModelSpawn[]): AABox {
  if (spawns.length === 0) {
    return {
      min: { x: 0, y: 0, z: 0 },
      max: { x: 0, y: 0, z: 0 },
    };
  }

  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;

  for (const spawn of spawns) {
    minX = Math.min(minX, spawn.bounds.min.x);
    minY = Math.min(minY, spawn.bounds.min.y);
    minZ = Math.min(minZ, spawn.bounds.min.z);
    maxX = Math.max(maxX, spawn.bounds.max.x);
    maxY = Math.max(maxY, spawn.bounds.max.y);
    maxZ = Math.max(maxZ, spawn.bounds.max.z);
  }

  return {
    min: { x: minX, y: minY, z: minZ },
    max: { x: maxX, y: maxY, z: maxZ },
  };
}

// ============================================================================
// Spatial Query Utilities
// ============================================================================

/**
 * Query BIH tree for spawns intersecting a bounding box
 *
 * @param tree BIH tree
 * @param bounds Query bounding box
 * @param spawns All spawns
 * @returns Array of spawn indices
 */
export function queryBIHTree(
  tree: BIHTree,
  bounds: AABox,
  spawns: ModelSpawn[],
): number[] {
  const results: number[] = [];
  queryBIHTreeRecursive(tree, tree.nodes[0], bounds, spawns, results);
  return results;
}

function queryBIHTreeRecursive(
  tree: BIHTree,
  node: BIHNode,
  bounds: AABox,
  spawns: ModelSpawn[],
  results: number[],
): void {
  // If leaf node, check objects
  if (node.isLeaf && node.objects) {
    for (const objIndex of node.objects) {
      const spawn = spawns[objIndex];
      if (spawn && aabbIntersects(bounds, spawn.bounds)) {
        results.push(objIndex);
      }
    }
    return;
  }

  // Check children
  const [child0Idx, child1Idx] = node.children;

  // Check bounds overlap on split axis
  const axis = node.axis;
  const [bound0, bound1] = node.bounds;

  // Get min/max on split axis
  let boundsMin: number;
  let boundsMax: number;
  if (axis === 0) {
    // X axis
    boundsMin = bounds.min.x;
    boundsMax = bounds.max.x;
  } else if (axis === 1) {
    // Y axis
    boundsMin = bounds.min.y;
    boundsMax = bounds.max.y;
  } else {
    // Z axis
    boundsMin = bounds.min.z;
    boundsMax = bounds.max.z;
  }

  // Recurse to children if bounds overlap
  if (boundsMin <= bound0 && tree.nodes[child0Idx]) {
    queryBIHTreeRecursive(tree, tree.nodes[child0Idx], bounds, spawns, results);
  }
  if (boundsMax >= bound1 && tree.nodes[child1Idx]) {
    queryBIHTreeRecursive(tree, tree.nodes[child1Idx], bounds, spawns, results);
  }
}

/**
 * Check if two AABBs intersect
 */
function aabbIntersects(a: AABox, b: AABox): boolean {
  return (
    a.min.x <= b.max.x &&
    a.max.x >= b.min.x &&
    a.min.y <= b.max.y &&
    a.max.y >= b.min.y &&
    a.min.z <= b.max.z &&
    a.max.z >= b.min.z
  );
}

// ============================================================================
// Exports
// ============================================================================

export { BinaryReader };
export type { VMapData };
