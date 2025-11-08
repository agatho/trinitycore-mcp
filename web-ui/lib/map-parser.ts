/**
 * TrinityCore .map File Parser
 *
 * Parses terrain height map files (.map) extracted by TrinityCore mapextractor.
 * These files contain height data, area information, and liquid data.
 *
 * File format (from mapextractor):
 * - Folder: maps/
 * - Tilelist: <mapId>.tilelist (e.g., 0001.tilelist)
 * - Naming: <mapId>_<x>_<y>.map (e.g., 0001_55_42.map = map 1, grid 55,42)
 * - Header with offsets and sizes
 * - Area map (grid of zone IDs)
 * - Height map (129x129 grid of heights)
 * - Liquid map (water/lava information)
 *
 * @module lib/map-parser
 */

/**
 * Map file header structure
 */
export interface MapFileHeader {
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
 */
export interface HeightMapData {
  gridHeight: number;
  gridMaxHeight: number;
  flags: Uint8Array;
  heights: Float32Array; // 129x129 grid
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

const MAP_MAGIC = 0x5350414D; // 'MAPS' in little-endian
const MAP_VERSION_MAGIC = 0x322E3176; // 'v1.2' for TrinityCore

const GRID_SIZE = 533.33333; // yards
const GRID_PART_SIZE = 129;

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

  // Read header
  const buildMagic = view.getUint32(offset, true);
  offset += 4;

  if (buildMagic !== MAP_MAGIC) {
    throw new Error(`Invalid map file magic: 0x${buildMagic.toString(16)}`);
  }

  const header: MapFileHeader = {
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
 */
function parseAreaMap(
  view: DataView,
  offset: number,
  size: number
): AreaMapData {
  const gridArea = view.getUint32(offset, true);
  offset += 4;

  const flagCount = 16;
  const flags: number[] = [];
  for (let i = 0; i < flagCount; i++) {
    flags.push(view.getUint16(offset, true));
    offset += 2;
  }

  const areaIdCount = 16 * 16;
  const areaIds: number[] = [];
  for (let i = 0; i < areaIdCount; i++) {
    areaIds.push(view.getUint16(offset, true));
    offset += 2;
  }

  return {
    gridArea,
    flags,
    areaIds,
  };
}

/**
 * Parse height map section
 */
function parseHeightMap(
  view: DataView,
  offset: number,
  size: number
): HeightMapData {
  const gridHeight = view.getFloat32(offset, true);
  offset += 4;

  const gridMaxHeight = view.getFloat32(offset, true);
  offset += 4;

  // Flags for each cell (indicate if height data exists)
  const flagCount = Math.ceil((GRID_PART_SIZE * GRID_PART_SIZE) / 8);
  const flags = new Uint8Array(view.buffer, view.byteOffset + offset, flagCount);
  offset += flagCount;

  // Height values (129x129 grid)
  const heightCount = GRID_PART_SIZE * GRID_PART_SIZE;
  const heights = new Float32Array(heightCount);

  for (let i = 0; i < heightCount; i++) {
    // Check if this cell has height data
    const byteIndex = Math.floor(i / 8);
    const bitIndex = i % 8;
    const hasHeight = (flags[byteIndex] & (1 << bitIndex)) !== 0;

    if (hasHeight && offset + 4 <= view.byteOffset + view.byteLength) {
      heights[i] = view.getFloat32(offset, true);
      offset += 4;
    } else {
      heights[i] = gridHeight; // Use default grid height
    }
  }

  return {
    gridHeight,
    gridMaxHeight,
    flags,
    heights,
  };
}

/**
 * Parse liquid map section
 */
function parseLiquidMap(
  view: DataView,
  offset: number,
  size: number
): LiquidMapData {
  const liquidType = view.getUint16(offset, true);
  offset += 2;

  const flagCount = 128;
  const flags = new Uint8Array(view.buffer, view.byteOffset + offset, flagCount);
  offset += flagCount;

  const heightCount = 128 * 128;
  const heights = new Float32Array(heightCount);

  for (let i = 0; i < heightCount && offset + 4 <= view.byteOffset + view.byteLength; i++) {
    heights[i] = view.getFloat32(offset, true);
    offset += 4;
  }

  return {
    liquidType,
    flags,
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
  const cellX = Math.floor((localX / GRID_SIZE) * (GRID_PART_SIZE - 1));
  const cellY = Math.floor((localY / GRID_SIZE) * (GRID_PART_SIZE - 1));

  const index = cellY * GRID_PART_SIZE + cellX;

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
