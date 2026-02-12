/**
 * TrinityCore .map File Parser
 *
 * Parses terrain height map files (.map) extracted by TrinityCore mapextractor.
 * These files contain height data, area information, and liquid data.
 *
 * File format (from TrinityCore GridMap.cpp / MapDefines.h):
 * - Folder: maps/
 * - Naming: <mapId>_<x>_<y>.map (e.g., 0001_55_42.map = map 1, grid 55,42)
 *
 * File structure:
 * 1. map_fileheader (40 bytes):
 *    - mapMagic: 4 bytes "MAPS"
 *    - versionMagic: 4 bytes
 *    - buildMagic: 4 bytes
 *    - areaMapOffset/Size: 4+4 bytes
 *    - heightMapOffset/Size: 4+4 bytes
 *    - liquidMapOffset/Size: 4+4 bytes
 *    - holesOffset/Size: 4+4 bytes
 *
 * 2. Area section (at areaMapOffset):
 *    - areaMagic: 4 bytes "AREA"
 *    - flags: 2 bytes (NoArea flag)
 *    - gridArea: 2 bytes
 *    - areaMap: 16*16 uint16 (if no NoArea flag)
 *
 * 3. Height section (at heightMapOffset):
 *    - heightMagic: 4 bytes "MHGT"
 *    - flags: 4 bytes (NoHeight, HeightAsInt16, HeightAsInt8, HasFlightBounds)
 *    - gridHeight: float32
 *    - gridMaxHeight: float32
 *    - Height data based on flags:
 *      - NoHeight: no data, use gridHeight for all
 *      - HeightAsInt8: uint8 V9[129*129] + uint8 V8[128*128]
 *      - HeightAsInt16: uint16 V9[129*129] + uint16 V8[128*128]
 *      - else: float V9[129*129] + float V8[128*128]
 *
 * 4. Liquid section (at liquidMapOffset)
 * 5. Holes section (at holesOffset)
 *
 * @module lib/map-parser
 */

// Magic constants (little-endian)
const MAP_MAGIC = 0x5350414D; // "MAPS" = { 'M', 'A', 'P', 'S' }
const MAP_AREA_MAGIC = 0x41455241; // "AREA" = { 'A', 'R', 'E', 'A' }
const MAP_HEIGHT_MAGIC = 0x5447484D; // "MHGT" = { 'M', 'H', 'G', 'T' }
const MAP_LIQUID_MAGIC = 0x51494C4D; // "MLIQ" = { 'M', 'L', 'I', 'Q' }

// Height header flags
enum MapHeightHeaderFlags {
  None = 0x0000,
  NoHeight = 0x0001,
  HeightAsInt16 = 0x0002,
  HeightAsInt8 = 0x0004,
  HasFlightBounds = 0x0008,
}

// Area header flags
enum MapAreaHeaderFlags {
  None = 0x0000,
  NoArea = 0x0001,
}

/**
 * Map file header structure
 */
export interface MapFileHeader {
  mapMagic: number;
  versionMagic: number;
  buildMagic: number;
  areaMapOffset: number;
  areaMapSize: number;
  heightMapOffset: number;
  heightMapSize: number;
  liquidMapOffset: number;
  liquidMapSize: number;
  holesOffset: number;
  holesSize: number;
}

/**
 * Area map data (zone/area IDs)
 */
export interface AreaMapData {
  gridArea: number;
  flags: number[];
  areaIds: number[];
}

/**
 * Height map data
 *
 * TrinityCore uses V9 (129x129) for corner heights and V8 (128x128) for center heights.
 * V9 grid defines the height at each corner of the 128x128 cells.
 * V8 grid defines the center height of each cell.
 *
 * The final height at any point is interpolated using V8 and V9 values.
 */
export interface HeightMapData {
  gridHeight: number;      // Minimum/base height for this tile
  gridMaxHeight: number;   // Maximum height for this tile (used for compression)
  heightFlags: number;     // Flags (NoHeight, HeightAsInt16, HeightAsInt8, etc.)
  v9Heights: Float32Array; // 129x129 corner heights
  v8Heights: Float32Array; // 128x128 center heights
  // Legacy: combined heights array for backwards compatibility
  heights: Float32Array;   // 129x129 grid (from V9)
}

/**
 * Liquid map data
 */
export interface LiquidMapData {
  liquidType: number;
  flags: Uint8Array;
  heights: Float32Array;
}

/**
 * Parsed map file data
 */
export interface MapData {
  mapId: number;
  gridX: number;
  gridY: number;
  header: MapFileHeader;
  areaMap: AreaMapData | null;
  heightMap: HeightMapData | null;
  liquidMap: LiquidMapData | null;
}

/**
 * Collection of map tiles
 */
export interface MapDataCollection {
  mapId: number;
  mapName: string;
  tiles: Map<string, MapData>;
  bounds: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  };
}

const GRID_SIZE = 533.33333; // yards
const V9_SIZE = 129; // V9 grid is 129x129
const V8_SIZE = 128; // V8 grid is 128x128

/**
 * Parse a single .map file
 *
 * TrinityCore naming convention: <mapId>_<x>_<y>.map
 * - mapId: 4 digits (0000-9999)
 * - x: 2 digits (00-63)
 * - y: 2 digits (00-63)
 * Example: 0001_55_42.map = Map 1, Grid (55, 42)
 */
export function parseMapFile(
  buffer: ArrayBuffer,
  filename: string
): MapData {
  const view = new DataView(buffer);
  let offset = 0;

  // Parse filename: <mapId>_<x>_<y>.map (e.g., 0001_55_42.map)
  const match = filename.match(/(\d{4})_(\d{2})_(\d{2})\.map/);
  if (!match) {
    throw new Error(`Invalid map filename format: ${filename} (expected format: <mapId>_<x>_<y>.map, e.g., 0001_55_42.map)`);
  }

  const mapId = parseInt(match[1], 10);
  const gridX = parseInt(match[2], 10);
  const gridY = parseInt(match[3], 10);

  // Read map_fileheader (40 bytes total)
  // struct map_fileheader {
  //   u_map_magic mapMagic;     // 4 bytes "MAPS"
  //   uint32 versionMagic;      // 4 bytes
  //   uint32 buildMagic;        // 4 bytes
  //   uint32 areaMapOffset;     // 4 bytes
  //   uint32 areaMapSize;       // 4 bytes
  //   uint32 heightMapOffset;   // 4 bytes
  //   uint32 heightMapSize;     // 4 bytes
  //   uint32 liquidMapOffset;   // 4 bytes
  //   uint32 liquidMapSize;     // 4 bytes
  //   uint32 holesOffset;       // 4 bytes
  //   uint32 holesSize;         // 4 bytes
  // };

  const mapMagic = view.getUint32(offset, true);
  offset += 4;

  if (mapMagic !== MAP_MAGIC) {
    // Try reading as string for debug
    const magicStr = String.fromCharCode(
      mapMagic & 0xFF,
      (mapMagic >> 8) & 0xFF,
      (mapMagic >> 16) & 0xFF,
      (mapMagic >> 24) & 0xFF
    );
    throw new Error(`Invalid map file magic: 0x${mapMagic.toString(16)} ("${magicStr}"), expected 0x${MAP_MAGIC.toString(16)} ("MAPS")`);
  }

  const versionMagic = view.getUint32(offset, true);
  offset += 4;

  const buildMagic = view.getUint32(offset, true);
  offset += 4;

  const header: MapFileHeader = {
    mapMagic,
    versionMagic,
    buildMagic,
    areaMapOffset: view.getUint32(offset, true),
    areaMapSize: view.getUint32(offset + 4, true),
    heightMapOffset: view.getUint32(offset + 8, true),
    heightMapSize: view.getUint32(offset + 12, true),
    liquidMapOffset: view.getUint32(offset + 16, true),
    liquidMapSize: view.getUint32(offset + 20, true),
    holesOffset: view.getUint32(offset + 24, true),
    holesSize: view.getUint32(offset + 28, true),
  };
  offset += 32;

  console.log(`[MapParser] File ${filename}: mapMagic=0x${mapMagic.toString(16)}, version=0x${versionMagic.toString(16)}, build=${buildMagic}`);

  // Parse area map
  let areaMap: AreaMapData | null = null;
  if (header.areaMapSize > 0 && header.areaMapOffset > 0) {
    areaMap = parseAreaMap(view, header.areaMapOffset, header.areaMapSize);
  }

  // Parse height map
  let heightMap: HeightMapData | null = null;
  if (header.heightMapSize > 0 && header.heightMapOffset > 0) {
    heightMap = parseHeightMap(view, header.heightMapOffset, header.heightMapSize);
  }

  // Parse liquid map
  let liquidMap: LiquidMapData | null = null;
  if (header.liquidMapSize > 0 && header.liquidMapOffset > 0) {
    liquidMap = parseLiquidMap(view, header.liquidMapOffset, header.liquidMapSize);
  }

  return {
    mapId,
    gridX,
    gridY,
    header,
    areaMap,
    heightMap,
    liquidMap,
  };
}

/**
 * Parse area map section
 *
 * TrinityCore format (from GridMap.cpp):
 * struct map_areaHeader {
 *   u_map_magic areaMagic;                       // 4 bytes "AREA"
 *   EnumFlag<map_areaHeaderFlags> flags;         // 2 bytes (NoArea flag)
 *   uint16 gridArea;                             // 2 bytes
 * };
 *
 * If NoArea flag is not set, followed by uint16[16*16] area IDs
 */
function parseAreaMap(
  view: DataView,
  offset: number,
  size: number
): AreaMapData {
  // Read area header (8 bytes)
  const areaMagic = view.getUint32(offset, true);
  offset += 4;

  if (areaMagic !== MAP_AREA_MAGIC) {
    const magicStr = String.fromCharCode(
      areaMagic & 0xFF,
      (areaMagic >> 8) & 0xFF,
      (areaMagic >> 16) & 0xFF,
      (areaMagic >> 24) & 0xFF
    );
    console.warn(`[MapParser] Invalid area magic: 0x${areaMagic.toString(16)} ("${magicStr}"), expected 0x${MAP_AREA_MAGIC.toString(16)} ("AREA")`);
  }

  const areaFlags = view.getUint16(offset, true);
  offset += 2;

  const gridArea = view.getUint16(offset, true);
  offset += 2;

  const hasNoArea = (areaFlags & MapAreaHeaderFlags.NoArea) !== 0;

  const flags: number[] = [areaFlags];
  const areaIds: number[] = [];

  if (!hasNoArea) {
    // Read 16x16 area IDs
    const areaIdCount = 16 * 16;
    for (let i = 0; i < areaIdCount && offset + 1 < view.byteLength; i++) {
      areaIds.push(view.getUint16(offset, true));
      offset += 2;
    }
  }

  return {
    gridArea,
    flags,
    areaIds,
  };
}

/**
 * Parse height map section
 *
 * TrinityCore format (from GridMap.cpp):
 * struct map_heightHeader {
 *   u_map_magic heightMagic;                    // 4 bytes "MHGT"
 *   EnumFlag<map_heightHeaderFlags> flags;      // 4 bytes
 *   float gridHeight;                           // 4 bytes - base height
 *   float gridMaxHeight;                        // 4 bytes - max height (for compression)
 * };
 *
 * Height data formats:
 * - NoHeight flag: no data, use gridHeight for all points
 * - HeightAsInt8 flag: uint8 V9[129*129] + uint8 V8[128*128]
 *   Formula: height = gridHeight + value * (gridMaxHeight - gridHeight) / 255
 * - HeightAsInt16 flag: uint16 V9[129*129] + uint16 V8[128*128]
 *   Formula: height = gridHeight + value * (gridMaxHeight - gridHeight) / 65535
 * - No compression flags: float V9[129*129] + float V8[128*128]
 */
function parseHeightMap(
  view: DataView,
  offset: number,
  size: number
): HeightMapData {
  const startOffset = offset;

  // Read height header (16 bytes)
  const heightMagic = view.getUint32(offset, true);
  offset += 4;

  if (heightMagic !== MAP_HEIGHT_MAGIC) {
    const magicStr = String.fromCharCode(
      heightMagic & 0xFF,
      (heightMagic >> 8) & 0xFF,
      (heightMagic >> 16) & 0xFF,
      (heightMagic >> 24) & 0xFF
    );
    console.warn(`[MapParser] Invalid height magic: 0x${heightMagic.toString(16)} ("${magicStr}"), expected 0x${MAP_HEIGHT_MAGIC.toString(16)} ("MHGT")`);
  }

  const heightFlags = view.getUint32(offset, true);
  offset += 4;

  const gridHeight = view.getFloat32(offset, true);
  offset += 4;

  const gridMaxHeight = view.getFloat32(offset, true);
  offset += 4;

  const hasNoHeight = (heightFlags & MapHeightHeaderFlags.NoHeight) !== 0;
  const hasInt16 = (heightFlags & MapHeightHeaderFlags.HeightAsInt16) !== 0;
  const hasInt8 = (heightFlags & MapHeightHeaderFlags.HeightAsInt8) !== 0;
  const hasFlightBounds = (heightFlags & MapHeightHeaderFlags.HasFlightBounds) !== 0;

  console.log('[MapParser] parseHeightMap:', {
    startOffset,
    size,
    heightMagic: `0x${heightMagic.toString(16)}`,
    heightFlags: `0x${heightFlags.toString(16)}`,
    hasNoHeight,
    hasInt16,
    hasInt8,
    hasFlightBounds,
    gridHeight: isFinite(gridHeight) ? gridHeight.toFixed(2) : 'NaN/Inf',
    gridMaxHeight: isFinite(gridMaxHeight) ? gridMaxHeight.toFixed(2) : 'NaN/Inf',
  });

  const v9Count = V9_SIZE * V9_SIZE; // 129 * 129 = 16641
  const v8Count = V8_SIZE * V8_SIZE; // 128 * 128 = 16384

  const v9Heights = new Float32Array(v9Count);
  const v8Heights = new Float32Array(v8Count);

  // Fill with base height initially
  const baseHeight = isFinite(gridHeight) ? gridHeight : 0;
  v9Heights.fill(baseHeight);
  v8Heights.fill(baseHeight);

  if (hasNoHeight) {
    // Flat tile - all heights are gridHeight
    console.log('[MapParser] NoHeight flag - flat tile at height', baseHeight.toFixed(2));
  } else if (hasInt8) {
    // uint8 compressed format
    const multiplier = (gridMaxHeight - gridHeight) / 255;
    console.log('[MapParser] Using uint8 compression, multiplier:', multiplier.toFixed(4));

    // Read V9 (129*129 uint8)
    for (let i = 0; i < v9Count && offset < view.byteLength; i++) {
      const value = view.getUint8(offset);
      offset += 1;
      v9Heights[i] = gridHeight + value * multiplier;
    }

    // Read V8 (128*128 uint8)
    for (let i = 0; i < v8Count && offset < view.byteLength; i++) {
      const value = view.getUint8(offset);
      offset += 1;
      v8Heights[i] = gridHeight + value * multiplier;
    }
  } else if (hasInt16) {
    // uint16 compressed format
    const multiplier = (gridMaxHeight - gridHeight) / 65535;
    console.log('[MapParser] Using uint16 compression, multiplier:', multiplier.toFixed(6));

    // Read V9 (129*129 uint16)
    for (let i = 0; i < v9Count && offset + 1 < view.byteLength; i++) {
      const value = view.getUint16(offset, true);
      offset += 2;
      v9Heights[i] = gridHeight + value * multiplier;
    }

    // Read V8 (128*128 uint16)
    for (let i = 0; i < v8Count && offset + 1 < view.byteLength; i++) {
      const value = view.getUint16(offset, true);
      offset += 2;
      v8Heights[i] = gridHeight + value * multiplier;
    }
  } else {
    // Float format (uncompressed)
    console.log('[MapParser] Using float (uncompressed) format');

    // Read V9 (129*129 float)
    for (let i = 0; i < v9Count && offset + 3 < view.byteLength; i++) {
      v9Heights[i] = view.getFloat32(offset, true);
      offset += 4;
    }

    // Read V8 (128*128 float)
    for (let i = 0; i < v8Count && offset + 3 < view.byteLength; i++) {
      v8Heights[i] = view.getFloat32(offset, true);
      offset += 4;
    }
  }

  // Calculate statistics
  let minV9 = Infinity, maxV9 = -Infinity;
  for (let i = 0; i < v9Heights.length; i++) {
    const h = v9Heights[i];
    if (isFinite(h)) {
      minV9 = Math.min(minV9, h);
      maxV9 = Math.max(maxV9, h);
    }
  }

  console.log('[MapParser] V9 heights parsed:', {
    count: v9Count,
    min: isFinite(minV9) ? minV9.toFixed(2) : 'N/A',
    max: isFinite(maxV9) ? maxV9.toFixed(2) : 'N/A',
    range: isFinite(maxV9 - minV9) ? (maxV9 - minV9).toFixed(2) : 'N/A',
    sample: Array.from(v9Heights.slice(0, 5)).map(h => h.toFixed(1)),
  });

  // For backwards compatibility, use V9 as the heights array
  return {
    gridHeight: isFinite(gridHeight) ? gridHeight : 0,
    gridMaxHeight: isFinite(gridMaxHeight) ? gridMaxHeight : 0,
    heightFlags,
    v9Heights,
    v8Heights,
    heights: v9Heights, // Legacy compatibility
  };
}

/**
 * Parse liquid map section
 *
 * TrinityCore format (from GridMap.cpp):
 * struct map_liquidHeader {
 *   u_map_magic liquidMagic;                             // 4 bytes "MLIQ"
 *   EnumFlag<map_liquidHeaderFlags> flags;               // 1 byte (NoType, NoHeight)
 *   EnumFlag<map_liquidHeaderTypeFlags> liquidFlags;     // 1 byte
 *   uint16 liquidType;                                   // 2 bytes
 *   uint8  offsetX;                                      // 1 byte
 *   uint8  offsetY;                                      // 1 byte
 *   uint8  width;                                        // 1 byte
 *   uint8  height;                                       // 1 byte
 *   float  liquidLevel;                                  // 4 bytes
 * };
 *
 * Data following header:
 * - If !NoType: uint16[16*16] liquidEntry + uint8[16*16] liquidTypeFlags
 * - If !NoHeight: float[width*height] liquidHeights
 */
function parseLiquidMap(
  view: DataView,
  offset: number,
  size: number
): LiquidMapData {
  // Read liquid header
  const liquidMagic = view.getUint32(offset, true);
  offset += 4;

  if (liquidMagic !== MAP_LIQUID_MAGIC) {
    const magicStr = String.fromCharCode(
      liquidMagic & 0xFF,
      (liquidMagic >> 8) & 0xFF,
      (liquidMagic >> 16) & 0xFF,
      (liquidMagic >> 24) & 0xFF
    );
    console.warn(`[MapParser] Invalid liquid magic: 0x${liquidMagic.toString(16)} ("${magicStr}"), expected 0x${MAP_LIQUID_MAGIC.toString(16)} ("MLIQ")`);
  }

  const liquidHeaderFlags = view.getUint8(offset);
  offset += 1;

  const liquidTypeFlags = view.getUint8(offset);
  offset += 1;

  const liquidType = view.getUint16(offset, true);
  offset += 2;

  const offsetX = view.getUint8(offset);
  offset += 1;

  const offsetY = view.getUint8(offset);
  offset += 1;

  const width = view.getUint8(offset);
  offset += 1;

  const height = view.getUint8(offset);
  offset += 1;

  const liquidLevel = view.getFloat32(offset, true);
  offset += 4;

  const hasNoType = (liquidHeaderFlags & 0x01) !== 0;
  const hasNoHeight = (liquidHeaderFlags & 0x02) !== 0;

  // Skip type data if present (not used for terrain)
  if (!hasNoType) {
    // Skip uint16[16*16] liquidEntry + uint8[16*16] liquidTypeFlags
    offset += 16 * 16 * 2 + 16 * 16;
  }

  // Read liquid heights
  const heightCount = width * height;
  const heights = new Float32Array(heightCount);

  if (!hasNoHeight && heightCount > 0) {
    for (let i = 0; i < heightCount && offset + 3 < view.byteLength; i++) {
      heights[i] = view.getFloat32(offset, true);
      offset += 4;
    }
  } else {
    heights.fill(liquidLevel);
  }

  return {
    liquidType,
    flags: new Uint8Array([liquidHeaderFlags, liquidTypeFlags]),
    heights,
  };
}

/**
 * Load multiple .map files into a collection
 */
export function loadMapData(
  mapId: number,
  mapName: string,
  fileBuffers: Map<string, ArrayBuffer>,
  options: {
    verbose?: boolean;
    maxTiles?: number;
  } = {}
): MapDataCollection {
  const { verbose = false, maxTiles = 1000 } = options;

  const tiles = new Map<string, MapData>();
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  let tileCount = 0;

  for (const [filename, buffer] of fileBuffers.entries()) {
    if (tileCount >= maxTiles) {
      if (verbose) {
        console.log(`[MapParser] Reached max tile limit (${maxTiles})`);
      }
      break;
    }

    try {
      const mapData = parseMapFile(buffer, filename);

      if (mapData.mapId !== mapId) {
        if (verbose) {
          console.warn(`[MapParser] Skipping file ${filename}: mapId mismatch`);
        }
        continue;
      }

      const key = `${mapData.gridX}_${mapData.gridY}`;
      tiles.set(key, mapData);

      minX = Math.min(minX, mapData.gridX);
      maxX = Math.max(maxX, mapData.gridX);
      minY = Math.min(minY, mapData.gridY);
      maxY = Math.max(maxY, mapData.gridY);

      tileCount++;

      if (verbose) {
        console.log(
          `[MapParser] Loaded ${filename}: grid (${mapData.gridX}, ${mapData.gridY})`
        );
      }
    } catch (error) {
      console.error(`[MapParser] Failed to parse ${filename}:`, error);
    }
  }

  if (verbose) {
    console.log(`[MapParser] Loaded ${tiles.size} tiles for map ${mapId} (${mapName})`);
    console.log(`[MapParser] Grid bounds: X[${minX}, ${maxX}], Y[${minY}, ${maxY}]`);
  }

  return {
    mapId,
    mapName,
    tiles,
    bounds: {
      minX: minX === Infinity ? 0 : minX,
      maxX: maxX === -Infinity ? 0 : maxX,
      minY: minY === Infinity ? 0 : minY,
      maxY: maxY === -Infinity ? 0 : maxY,
    },
  };
}

/**
 * Get height at specific world coordinates
 */
export function getHeightFromMapData(
  mapData: MapDataCollection,
  worldX: number,
  worldY: number
): number | null {
  // Convert world coordinates to grid coordinates
  const gridX = Math.floor(32 - worldY / GRID_SIZE);
  const gridY = Math.floor(32 - worldX / GRID_SIZE);

  const key = `${gridX}_${gridY}`;
  const tile = mapData.tiles.get(key);

  if (!tile || !tile.heightMap) {
    return null;
  }

  // Calculate position within grid (0-533.33)
  const localX = (32 - worldY / GRID_SIZE - gridX) * GRID_SIZE;
  const localY = (32 - worldX / GRID_SIZE - gridY) * GRID_SIZE;

  // Convert to height map indices (0-128)
  const cellX = Math.floor((localX / GRID_SIZE) * (V9_SIZE - 1));
  const cellY = Math.floor((localY / GRID_SIZE) * (V9_SIZE - 1));

  const index = cellY * V9_SIZE + cellX;

  if (index < 0 || index >= tile.heightMap.heights.length) {
    return tile.heightMap.gridHeight;
  }

  return tile.heightMap.heights[index];
}

/**
 * Export map data statistics
 */
export function getMapDataStats(mapData: MapDataCollection): {
  tileCount: number;
  totalHeightPoints: number;
  totalLiquidPoints: number;
  averageHeight: number;
  minHeight: number;
  maxHeight: number;
} {
  let totalHeightPoints = 0;
  let totalLiquidPoints = 0;
  let heightSum = 0;
  let minHeight = Infinity;
  let maxHeight = -Infinity;

  for (const tile of mapData.tiles.values()) {
    if (tile.heightMap) {
      totalHeightPoints += tile.heightMap.heights.length;

      for (const height of tile.heightMap.heights) {
        heightSum += height;
        minHeight = Math.min(minHeight, height);
        maxHeight = Math.max(maxHeight, height);
      }
    }

    if (tile.liquidMap) {
      totalLiquidPoints += tile.liquidMap.heights.length;
    }
  }

  return {
    tileCount: mapData.tiles.size,
    totalHeightPoints,
    totalLiquidPoints,
    averageHeight: totalHeightPoints > 0 ? heightSum / totalHeightPoints : 0,
    minHeight: minHeight === Infinity ? 0 : minHeight,
    maxHeight: maxHeight === -Infinity ? 0 : maxHeight,
  };
}
