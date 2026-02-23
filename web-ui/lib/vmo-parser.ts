/**
 * VMO File Parser - Parse TrinityCore .vmo (WorldModel) files
 *
 * VMO files contain collision geometry for WMO and M2 models.
 * Format based on TrinityCore's WorldModel.cpp
 *
 * @module lib/vmo-parser
 */

import { BinaryReader } from './vmap-parser';
import { SUPPORTED_VMAP_VERSIONS } from './vmap-types';

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
 * Mesh triangle - 3 vertex indices
 */
export interface MeshTriangle {
  idx0: number;
  idx1: number;
  idx2: number;
}

/**
 * WMO Liquid data
 */
export interface WmoLiquid {
  tilesX: number;
  tilesY: number;
  corner: Vector3;
  type: number;
  heights: Float32Array;
  flags: Uint8Array | null;
}

/**
 * Group model - a part of a WMO
 */
export interface GroupModel {
  bounds: AABox;
  mogpFlags: number;
  groupWmoId: number;
  vertices: Vector3[];
  triangles: MeshTriangle[];
  liquid: WmoLiquid | null;
}

/**
 * World model flags
 */
export enum ModelFlags {
  None = 0x0,
  IsM2 = 0x1,
}

/**
 * WorldModel - complete VMO file structure
 */
export interface WorldModel {
  magic: string;
  flags: ModelFlags;
  rootWmoId: number;
  groupModels: GroupModel[];
}

/**
 * Parse error
 */
export class VMOParseError extends Error {
  constructor(
    message: string,
    public fileName: string,
    public offset: number
  ) {
    super(`${message} (file: ${fileName}, offset: ${offset})`);
    this.name = 'VMOParseError';
  }
}

/**
 * Parse a .vmo file
 *
 * @param buffer File contents as ArrayBuffer
 * @param fileName File name for error messages
 * @returns Parsed WorldModel
 */
export function parseVMO(buffer: ArrayBuffer, fileName: string = 'unknown.vmo'): WorldModel {
  const reader = new BinaryReader(buffer);

  // Read and validate magic header
  const magic = reader.readString(8);
  if (!SUPPORTED_VMAP_VERSIONS.includes(magic as typeof SUPPORTED_VMAP_VERSIONS[number])) {
    throw new VMOParseError(
      `Invalid VMO magic: expected one of [${SUPPORTED_VMAP_VERSIONS.join(', ')}], got "${magic}"`,
      fileName,
      0
    );
  }

  // Read WMOD chunk
  const wmodChunk = reader.readString(4);
  if (wmodChunk !== 'WMOD') {
    throw new VMOParseError(
      `Expected WMOD chunk, got "${wmodChunk}"`,
      fileName,
      reader.getOffset()
    );
  }

  const wmodChunkSize = reader.readUInt32();
  const flags = reader.readUInt32() as ModelFlags;
  const rootWmoId = reader.readUInt32();

  // Read group models
  const groupModels: GroupModel[] = [];

  // Check for GMOD chunk
  if (reader.remaining() > 0) {
    const gmodChunk = reader.readString(4);
    if (gmodChunk === 'GMOD') {
      const groupCount = reader.readUInt32();

      for (let i = 0; i < groupCount; i++) {
        const group = parseGroupModel(reader, fileName);
        groupModels.push(group);
      }

      // Read group BIH (skip it, we don't need it for rendering)
      if (reader.remaining() > 4) {
        const gbihChunk = reader.readString(4);
        if (gbihChunk === 'GBIH') {
          // Skip BIH tree - we just need the geometry
          skipBIH(reader);
        }
      }
    }
  }

  return {
    magic,
    flags,
    rootWmoId,
    groupModels,
  };
}

/**
 * Parse a GroupModel
 */
function parseGroupModel(reader: BinaryReader, fileName: string): GroupModel {
  // Read bounding box
  const bounds = readAABox(reader);

  // Read flags
  const mogpFlags = reader.readUInt32();
  const groupWmoId = reader.readUInt32();

  // Read vertices
  const vertChunk = reader.readString(4);
  if (vertChunk !== 'VERT') {
    throw new VMOParseError(
      `Expected VERT chunk, got "${vertChunk}"`,
      fileName,
      reader.getOffset()
    );
  }

  const vertChunkSize = reader.readUInt32();
  const vertCount = reader.readUInt32();

  const vertices: Vector3[] = [];
  for (let i = 0; i < vertCount; i++) {
    vertices.push(readVector3(reader));
  }

  // Models without geometry end here
  if (vertCount === 0) {
    return {
      bounds,
      mogpFlags,
      groupWmoId,
      vertices: [],
      triangles: [],
      liquid: null,
    };
  }

  // Read triangles
  const trimChunk = reader.readString(4);
  if (trimChunk !== 'TRIM') {
    throw new VMOParseError(
      `Expected TRIM chunk, got "${trimChunk}"`,
      fileName,
      reader.getOffset()
    );
  }

  const trimChunkSize = reader.readUInt32();
  const triCount = reader.readUInt32();

  const triangles: MeshTriangle[] = [];
  for (let i = 0; i < triCount; i++) {
    triangles.push({
      idx0: reader.readUInt32(),
      idx1: reader.readUInt32(),
      idx2: reader.readUInt32(),
    });
  }

  // Read mesh BIH (skip it)
  const mbihChunk = reader.readString(4);
  if (mbihChunk !== 'MBIH') {
    throw new VMOParseError(
      `Expected MBIH chunk, got "${mbihChunk}"`,
      fileName,
      reader.getOffset()
    );
  }
  skipBIH(reader);

  // Read liquid data
  const liquChunk = reader.readString(4);
  if (liquChunk !== 'LIQU') {
    throw new VMOParseError(
      `Expected LIQU chunk, got "${liquChunk}"`,
      fileName,
      reader.getOffset()
    );
  }

  const liquChunkSize = reader.readUInt32();
  let liquid: WmoLiquid | null = null;

  if (liquChunkSize > 0) {
    liquid = parseLiquid(reader);
  }

  return {
    bounds,
    mogpFlags,
    groupWmoId,
    vertices,
    triangles,
    liquid,
  };
}

/**
 * Parse liquid data
 */
function parseLiquid(reader: BinaryReader): WmoLiquid {
  const tilesX = reader.readUInt32();
  const tilesY = reader.readUInt32();
  const corner = readVector3(reader);
  const type = reader.readUInt32();

  let heights: Float32Array;
  let flags: Uint8Array | null = null;

  if (tilesX && tilesY) {
    const heightCount = (tilesX + 1) * (tilesY + 1);
    heights = new Float32Array(heightCount);
    for (let i = 0; i < heightCount; i++) {
      heights[i] = reader.readFloat32();
    }

    const flagCount = tilesX * tilesY;
    flags = new Uint8Array(flagCount);
    for (let i = 0; i < flagCount; i++) {
      flags[i] = reader.readUInt8();
    }
  } else {
    heights = new Float32Array(1);
    heights[0] = reader.readFloat32();
  }

  return {
    tilesX,
    tilesY,
    corner,
    type,
    heights,
    flags,
  };
}

/**
 * Skip BIH tree data
 *
 * TrinityCore BIH binary format (from BoundingIntervalHierarchy.cpp):
 * 1. bounds.low (3 floats = 12 bytes)
 * 2. bounds.high (3 floats = 12 bytes)
 * 3. treeSize (1 uint32 = 4 bytes)
 * 4. tree data (treeSize uint32s = treeSize * 4 bytes)
 * 5. objectCount (1 uint32 = 4 bytes)
 * 6. objects data (objectCount uint32s = objectCount * 4 bytes)
 */
function skipBIH(reader: BinaryReader): void {
  // Skip bounds (low + high = 6 floats = 24 bytes)
  reader.skip(24);

  // Read tree size (number of uint32 entries, NOT number of nodes)
  const treeSize = reader.readUInt32();

  // Tree data is treeSize uint32 entries (4 bytes each)
  reader.skip(treeSize * 4);

  // Read object count
  const objectCount = reader.readUInt32();

  // Objects are uint32 indices (4 bytes each)
  reader.skip(objectCount * 4);
}

/**
 * Read a Vector3
 */
function readVector3(reader: BinaryReader): Vector3 {
  return {
    x: reader.readFloat32(),
    y: reader.readFloat32(),
    z: reader.readFloat32(),
  };
}

/**
 * Read an AABox
 */
function readAABox(reader: BinaryReader): AABox {
  return {
    min: readVector3(reader),
    max: readVector3(reader),
  };
}

/**
 * Convert WorldModel vertices to world coordinates
 *
 * VMap uses internal coordinates where:
 * internal = MID - world (MID = 32 * 533.33333 = 17066.67)
 *
 * For spawns, the model is transformed by spawn's position/rotation/scale
 */
export function transformModelVertex(
  vertex: Vector3,
  spawnPosition: Vector3,
  spawnRotation: Vector3,
  spawnScale: number
): Vector3 {
  // Apply scale
  let x = vertex.x * spawnScale;
  let y = vertex.y * spawnScale;
  let z = vertex.z * spawnScale;

  // Apply rotation (Euler angles in radians)
  // TrinityCore uses Y-up coordinate system
  // Rotation order: Y, then X, then Z
  const cosX = Math.cos(spawnRotation.x);
  const sinX = Math.sin(spawnRotation.x);
  const cosY = Math.cos(spawnRotation.y);
  const sinY = Math.sin(spawnRotation.y);
  const cosZ = Math.cos(spawnRotation.z);
  const sinZ = Math.sin(spawnRotation.z);

  // Rotation matrix multiplication
  // First rotate around Y
  let x1 = x * cosY + z * sinY;
  let z1 = -x * sinY + z * cosY;
  x = x1;
  z = z1;

  // Then rotate around X
  let y1 = y * cosX - z * sinX;
  z1 = y * sinX + z * cosX;
  y = y1;
  z = z1;

  // Finally rotate around Z
  x1 = x * cosZ - y * sinZ;
  y1 = x * sinZ + y * cosZ;
  x = x1;
  y = y1;

  // Apply translation (spawn position)
  x += spawnPosition.x;
  y += spawnPosition.y;
  z += spawnPosition.z;

  return { x, y, z };
}

/**
 * Get total vertex and triangle counts for a WorldModel
 */
export function getModelStats(model: WorldModel): { vertices: number; triangles: number } {
  let vertices = 0;
  let triangles = 0;

  for (const group of model.groupModels) {
    vertices += group.vertices.length;
    triangles += group.triangles.length;
  }

  return { vertices, triangles };
}
