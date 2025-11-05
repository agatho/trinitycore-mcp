/**
 * TrinityCore MMap (Movement Map / Navigation Mesh) Parser
 *
 * Parses binary MMap files from TrinityCore:
 * - .mmap: Navigation mesh parameters
 * - .mmtile: Tile navigation mesh data (Recast/Detour format)
 *
 * Binary Format Reference:
 * - TrinityCore: src/common/Collision/Maps/MMapDefines.h
 * - TrinityCore: src/common/Collision/Management/MMapManager.cpp
 * - Recast/Detour: DetourNavMesh.h
 *
 * @module mmap-parser
 */

import type {
  dtBVNode,
  dtLink,
  dtMeshHeader,
  dtNavMeshParams,
  dtOffMeshConnection,
  dtPoly,
  dtPolyDetail,
  MMapData,
  MMapParserOptions,
  MmapNavMeshHeader,
  MmapTileHeader,
  NavMeshTile,
} from "./mmap-types";
import {
  DT_NAVMESH_MAGIC,
  DT_NAVMESH_VERSION,
  DT_VERTS_PER_POLYGON,
  MMAP_MAGIC,
  MMAP_VERSION,
  MMapParseError,
} from "./mmap-types";
import { BinaryReader } from "./vmap-parser";

// ============================================================================
// MMap Navigation Mesh Parser (.mmap)
// ============================================================================

/**
 * Parse a .mmap file
 *
 * Format:
 * - MmapNavMeshHeader (40 bytes)
 * - Off-mesh connections (if any)
 *
 * @param buffer .mmap file contents
 * @param mapId Map ID
 * @param options Parser options
 * @returns Parsed navigation mesh header
 */
export function parseMMapHeader(
  buffer: ArrayBuffer,
  mapId: number,
  options: MMapParserOptions = {},
): MmapNavMeshHeader {
  const reader = new BinaryReader(buffer);
  const fileName = `${mapId.toString().padStart(3, "0")}.mmap`;

  // Read magic number (4 bytes)
  const mmapMagic = reader.readUInt32();
  if (options.strictValidation !== false && mmapMagic !== MMAP_MAGIC) {
    throw new MMapParseError(
      `Invalid magic number: expected 0x${MMAP_MAGIC.toString(16)}, got 0x${mmapMagic.toString(16)}`,
      fileName,
      reader.getOffset(),
    );
  }

  // Read MMAP version (4 bytes)
  const mmapVersion = reader.readUInt32();
  if (options.strictValidation !== false && mmapVersion !== MMAP_VERSION) {
    throw new MMapParseError(
      `Version mismatch: expected ${MMAP_VERSION}, got ${mmapVersion}`,
      fileName,
      reader.getOffset(),
    );
  }

  // Read dtNavMeshParams (32 bytes)
  const params = parseDtNavMeshParams(reader);

  // Read off-mesh connection count (4 bytes)
  const offmeshConnectionCount = reader.readUInt32();

  if (options.verbose) {
    console.log(
      `[MMapParser] Parsed ${fileName}: ${offmeshConnectionCount} off-mesh connections, ` +
        `maxTiles=${params.maxTiles}, maxPolys=${params.maxPolys}`,
    );
  }

  return {
    mmapMagic,
    mmapVersion,
    params,
    offmeshConnectionCount,
  };
}

/**
 * Parse dtNavMeshParams structure (32 bytes)
 */
function parseDtNavMeshParams(reader: BinaryReader): dtNavMeshParams {
  return {
    orig: [reader.readFloat32(), reader.readFloat32(), reader.readFloat32()],
    tileWidth: reader.readFloat32(),
    tileHeight: reader.readFloat32(),
    maxTiles: reader.readInt32(),
    maxPolys: reader.readInt32(),
  };
}

// ============================================================================
// MMap Tile Parser (.mmtile)
// ============================================================================

/**
 * Parse a .mmtile file
 *
 * Format:
 * - MmapTileHeader (20 bytes)
 * - Detour tile data (dtMeshHeader + tile contents)
 *
 * @param buffer .mmtile file contents
 * @param tileX Tile X coordinate
 * @param tileY Tile Y coordinate
 * @param options Parser options
 * @returns Parsed navigation mesh tile
 */
export function parseMMapTile(
  buffer: ArrayBuffer,
  tileX: number,
  tileY: number,
  options: MMapParserOptions = {},
): NavMeshTile {
  const reader = new BinaryReader(buffer);
  const fileName = `${tileX.toString().padStart(2, "0")}${tileY.toString().padStart(2, "0")}.mmtile`;

  // Read MmapTileHeader (20 bytes)
  const tileHeader = parseMmapTileHeader(reader, fileName, options);

  // Validate size
  const remainingSize = reader.remaining();
  if (tileHeader.size > remainingSize) {
    throw new MMapParseError(
      `Invalid tile size: header says ${tileHeader.size} bytes, but only ${remainingSize} bytes remaining`,
      fileName,
      reader.getOffset(),
    );
  }

  // Parse Detour tile data
  const tile = parseDetourTileData(reader, fileName, options);

  if (options.verbose) {
    console.log(
      `[MMapParser] Parsed ${fileName}: ${tile.header.polyCount} polys, ` +
        `${tile.header.vertCount} verts, ${tile.header.offMeshConCount} off-mesh connections`,
    );
  }

  return tile;
}

/**
 * Parse MmapTileHeader structure (20 bytes)
 */
function parseMmapTileHeader(
  reader: BinaryReader,
  fileName: string,
  options: MMapParserOptions,
): MmapTileHeader {
  // Read magic number (4 bytes)
  const mmapMagic = reader.readUInt32();
  if (options.strictValidation !== false && mmapMagic !== MMAP_MAGIC) {
    throw new MMapParseError(
      `Invalid magic number: expected 0x${MMAP_MAGIC.toString(16)}, got 0x${mmapMagic.toString(16)}`,
      fileName,
      reader.getOffset(),
    );
  }

  // Read Detour version (4 bytes)
  const dtVersion = reader.readUInt32();
  if (options.strictValidation !== false && dtVersion !== DT_NAVMESH_VERSION) {
    throw new MMapParseError(
      `Detour version mismatch: expected ${DT_NAVMESH_VERSION}, got ${dtVersion}`,
      fileName,
      reader.getOffset(),
    );
  }

  // Read MMAP version (4 bytes)
  const mmapVersion = reader.readUInt32();
  if (options.strictValidation !== false && mmapVersion !== MMAP_VERSION) {
    throw new MMapParseError(
      `MMap version mismatch: expected ${MMAP_VERSION}, got ${mmapVersion}`,
      fileName,
      reader.getOffset(),
    );
  }

  // Read size (4 bytes)
  const size = reader.readUInt32();

  // Read usesLiquids (1 byte)
  const usesLiquids = reader.readUInt8() !== 0;

  // Read padding (3 bytes)
  const padding: [number, number, number] = [
    reader.readUInt8(),
    reader.readUInt8(),
    reader.readUInt8(),
  ];

  return {
    mmapMagic,
    dtVersion,
    mmapVersion,
    size,
    usesLiquids,
    padding,
  };
}

// ============================================================================
// Detour Tile Data Parser
// ============================================================================

/**
 * Parse Detour tile data
 *
 * Format follows Detour's dtNavMesh tile format:
 * - dtMeshHeader
 * - Vertices
 * - Polygons
 * - Links
 * - Detail meshes
 * - Detail vertices
 * - Detail triangles
 * - BVH nodes
 * - Off-mesh connections
 */
function parseDetourTileData(
  reader: BinaryReader,
  fileName: string,
  options: MMapParserOptions,
): NavMeshTile {
  // Parse mesh header
  const header = parseDtMeshHeader(reader, fileName, options);

  // Parse vertices
  const verts: [number, number, number][] = [];
  for (let i = 0; i < header.vertCount; i++) {
    verts.push([reader.readFloat32(), reader.readFloat32(), reader.readFloat32()]);
  }

  // Parse polygons
  const polys: dtPoly[] = [];
  for (let i = 0; i < header.polyCount; i++) {
    polys.push(parseDtPoly(reader));
  }

  // Parse links (initially empty, populated during pathfinding)
  const links: dtLink[] = [];
  for (let i = 0; i < header.maxLinkCount; i++) {
    links.push(parseDtLink(reader));
  }

  // Parse detail meshes
  const detailMeshes: dtPolyDetail[] = [];
  if (options.loadDetailMeshes !== false && header.detailMeshCount > 0) {
    for (let i = 0; i < header.detailMeshCount; i++) {
      detailMeshes.push(parseDtPolyDetail(reader));
    }
  } else {
    // Skip detail meshes
    reader.skip(header.detailMeshCount * 12); // sizeof(dtPolyDetail) = 12
  }

  // Parse detail vertices
  const detailVerts: [number, number, number][] = [];
  if (options.loadDetailMeshes !== false && header.detailVertCount > 0) {
    for (let i = 0; i < header.detailVertCount; i++) {
      detailVerts.push([reader.readFloat32(), reader.readFloat32(), reader.readFloat32()]);
    }
  } else {
    // Skip detail vertices
    reader.skip(header.detailVertCount * 12);
  }

  // Parse detail triangles
  const detailTris: number[] = [];
  if (options.loadDetailMeshes !== false && header.detailTriCount > 0) {
    for (let i = 0; i < header.detailTriCount * 4; i++) {
      detailTris.push(reader.readUInt8());
    }
  } else {
    // Skip detail triangles
    reader.skip(header.detailTriCount * 4);
  }

  // Parse BVH tree
  const bvTree: dtBVNode[] = [];
  if (options.loadBVTree !== false && header.bvNodeCount > 0) {
    for (let i = 0; i < header.bvNodeCount; i++) {
      bvTree.push(parseDtBVNode(reader));
    }
  } else {
    // Skip BVH nodes
    reader.skip(header.bvNodeCount * 16); // sizeof(dtBVNode) = 16
  }

  // Parse off-mesh connections
  const offMeshCons: dtOffMeshConnection[] = [];
  if (options.loadOffMeshConnections !== false && header.offMeshConCount > 0) {
    for (let i = 0; i < header.offMeshConCount; i++) {
      offMeshCons.push(parseDtOffMeshConnection(reader));
    }
  } else {
    // Skip off-mesh connections
    reader.skip(header.offMeshConCount * 36); // sizeof(dtOffMeshConnection) = 36
  }

  return {
    header,
    verts,
    polys,
    links,
    detailMeshes,
    detailVerts,
    detailTris,
    bvTree,
    offMeshCons,
  };
}

/**
 * Parse dtMeshHeader structure
 */
function parseDtMeshHeader(
  reader: BinaryReader,
  fileName: string,
  options: MMapParserOptions,
): dtMeshHeader {
  // Read magic number (4 bytes)
  const magic = reader.readInt32();
  if (options.strictValidation !== false && magic !== DT_NAVMESH_MAGIC) {
    throw new MMapParseError(
      `Invalid Detour magic: expected 0x${DT_NAVMESH_MAGIC.toString(16)}, got 0x${magic.toString(16)}`,
      fileName,
      reader.getOffset(),
    );
  }

  // Read version (4 bytes)
  const version = reader.readInt32();
  if (options.strictValidation !== false && version !== DT_NAVMESH_VERSION) {
    throw new MMapParseError(
      `Detour version mismatch: expected ${DT_NAVMESH_VERSION}, got ${version}`,
      fileName,
      reader.getOffset(),
    );
  }

  return {
    magic,
    version,
    x: reader.readInt32(),
    y: reader.readInt32(),
    layer: reader.readInt32(),
    userId: reader.readUInt32(),
    polyCount: reader.readInt32(),
    vertCount: reader.readInt32(),
    maxLinkCount: reader.readInt32(),
    detailMeshCount: reader.readInt32(),
    detailVertCount: reader.readInt32(),
    detailTriCount: reader.readInt32(),
    bvNodeCount: reader.readInt32(),
    offMeshConCount: reader.readInt32(),
    offMeshBase: reader.readInt32(),
    walkableHeight: reader.readFloat32(),
    walkableRadius: reader.readFloat32(),
    walkableClimb: reader.readFloat32(),
    bmin: [reader.readFloat32(), reader.readFloat32(), reader.readFloat32()],
    bmax: [reader.readFloat32(), reader.readFloat32(), reader.readFloat32()],
    bvQuantFactor: reader.readFloat32(),
  };
}

/**
 * Parse dtPoly structure
 */
function parseDtPoly(reader: BinaryReader): dtPoly {
  const firstLink = reader.readUInt32();

  const verts: number[] = [];
  for (let i = 0; i < DT_VERTS_PER_POLYGON; i++) {
    verts.push(reader.readUInt16());
  }

  const neis: number[] = [];
  for (let i = 0; i < DT_VERTS_PER_POLYGON; i++) {
    neis.push(reader.readUInt16());
  }

  const flags = reader.readUInt16();
  const vertCount = reader.readUInt8();
  const areaAndtype = reader.readUInt8();

  return {
    firstLink,
    verts,
    neis,
    flags,
    vertCount,
    areaAndtype,
  };
}

// Helper for reading uint16
BinaryReader.prototype.readUInt16 = function (): number {
  const value = this.view.getUint16(this.offset, this.littleEndian);
  this.offset += 2;
  return value;
};

/**
 * Parse dtLink structure
 */
function parseDtLink(reader: BinaryReader): dtLink {
  return {
    ref: reader.readUInt32(),
    next: reader.readUInt32(),
    edge: reader.readUInt8(),
    side: reader.readUInt8(),
    bmin: reader.readUInt8(),
    bmax: reader.readUInt8(),
  };
}

/**
 * Parse dtPolyDetail structure
 */
function parseDtPolyDetail(reader: BinaryReader): dtPolyDetail {
  return {
    vertBase: reader.readUInt32(),
    triBase: reader.readUInt32(),
    vertCount: reader.readUInt8(),
    triCount: reader.readUInt8(),
  };
}

/**
 * Parse dtBVNode structure
 */
function parseDtBVNode(reader: BinaryReader): dtBVNode {
  return {
    bmin: [reader.readUInt16(), reader.readUInt16(), reader.readUInt16()],
    bmax: [reader.readUInt16(), reader.readUInt16(), reader.readUInt16()],
    i: reader.readInt32(),
  };
}

/**
 * Parse dtOffMeshConnection structure
 */
function parseDtOffMeshConnection(reader: BinaryReader): dtOffMeshConnection {
  return {
    pos: [
      reader.readFloat32(),
      reader.readFloat32(),
      reader.readFloat32(),
      reader.readFloat32(),
      reader.readFloat32(),
      reader.readFloat32(),
    ],
    rad: reader.readFloat32(),
    poly: reader.readUInt16(),
    flags: reader.readUInt8(),
    side: reader.readUInt8(),
    userId: reader.readUInt32(),
  };
}

// ============================================================================
// High-Level API
// ============================================================================

/**
 * Load complete MMap data for a map
 *
 * @param mapId Map ID
 * @param mapName Map name
 * @param headerBuffer .mmap file buffer
 * @param tileBuffers Map of tile buffers (key: "x_y", value: buffer)
 * @param options Parser options
 * @returns Complete MMapData
 */
export function loadMMapData(
  mapId: number,
  mapName: string,
  headerBuffer: ArrayBuffer,
  tileBuffers: Map<string, ArrayBuffer>,
  options: MMapParserOptions = {},
): MMapData {
  // Parse header
  const header = parseMMapHeader(headerBuffer, mapId, options);

  // Parse tiles
  const tiles = new Map<string, NavMeshTile>();
  let tileCount = 0;

  for (const [key, buffer] of tileBuffers.entries()) {
    // Check max tiles limit
    if (options.maxTiles && options.maxTiles > 0 && tileCount >= options.maxTiles) {
      if (options.verbose) {
        console.log(
          `[MMapParser] Reached max tiles limit (${options.maxTiles}), stopping`,
        );
      }
      break;
    }

    // Parse tile coordinates from key "x_y"
    const [xStr, yStr] = key.split("_");
    const tileX = parseInt(xStr, 10);
    const tileY = parseInt(yStr, 10);

    // Parse tile
    const tile = parseMMapTile(buffer, tileX, tileY, options);
    tiles.set(key, tile);
    tileCount++;
  }

  // Collect all off-mesh connections
  const offMeshConnections: dtOffMeshConnection[] = [];
  for (const tile of tiles.values()) {
    offMeshConnections.push(...tile.offMeshCons);
  }

  if (options.verbose) {
    console.log(
      `[MMapParser] Loaded MMap data for map ${mapId}: ${tiles.size} tiles, ` +
        `${offMeshConnections.length} off-mesh connections`,
    );
  }

  return {
    mapId,
    mapName,
    header,
    tiles,
    offMeshConnections,
  };
}

// ============================================================================
// Navigation Mesh Queries
// ============================================================================

/**
 * Find polygon at a given position
 *
 * @param tile Navigation mesh tile
 * @param position Query position [x, y, z]
 * @param extents Search extents [x, y, z]
 * @returns Polygon index or -1 if not found
 */
export function findNearestPoly(
  tile: NavMeshTile,
  position: [number, number, number],
  extents: [number, number, number] = [1, 1, 1],
): number {
  let nearestPoly = -1;
  let nearestDistSq = Infinity;

  for (let i = 0; i < tile.header.polyCount; i++) {
    const poly = tile.polys[i];

    // Get polygon center
    let cx = 0;
    let cy = 0;
    let cz = 0;
    for (let j = 0; j < poly.vertCount; j++) {
      const vert = tile.verts[poly.verts[j]];
      cx += vert[0];
      cy += vert[1];
      cz += vert[2];
    }
    cx /= poly.vertCount;
    cy /= poly.vertCount;
    cz /= poly.vertCount;

    // Check if within extents
    const dx = Math.abs(cx - position[0]);
    const dy = Math.abs(cy - position[1]);
    const dz = Math.abs(cz - position[2]);

    if (dx <= extents[0] && dy <= extents[1] && dz <= extents[2]) {
      const distSq = dx * dx + dy * dy + dz * dz;
      if (distSq < nearestDistSq) {
        nearestDistSq = distSq;
        nearestPoly = i;
      }
    }
  }

  return nearestPoly;
}

/**
 * Check if a position is on the navigation mesh
 *
 * @param tile Navigation mesh tile
 * @param position Query position [x, y, z]
 * @param extents Search extents [x, y, z]
 * @returns True if position is on navmesh
 */
export function isOnNavMesh(
  tile: NavMeshTile,
  position: [number, number, number],
  extents: [number, number, number] = [1, 1, 1],
): boolean {
  return findNearestPoly(tile, position, extents) !== -1;
}

// ============================================================================
// Exports
// ============================================================================

export type { MMapData, NavMeshTile };
