/**
 * TrinityCore .map File Parser
 *
 * Parses binary .map files extracted by TrinityCore's mapextractor tool.
 * Format based on TrinityCore master branch (11.x+) and 3.3.5a.
 *
 * File Format:
 * - Header (44 bytes)
 * - Area Data (variable)
 * - Height Data (variable)
 * - Liquid Data (variable)
 * - Holes Data (variable)
 *
 * References:
 * - TrinityCore/src/tools/map_extractor/System.cpp
 * - TrinityCore/src/server/game/Maps/GridMap.cpp
 */

// ============================================================================
// CONSTANTS
// ============================================================================

export const MAP_MAGIC = 0x5350414D; // 'MAPS' in little-endian
export const MAP_VERSION_MAGIC = 0x322E3176; // 'v1.2' in little-endian

export const AREA_MAGIC = 0x41455241; // 'AREA'
export const HEIGHT_MAGIC = 0x5448474D; // 'MGHT'
export const LIQUID_MAGIC = 0x44495551; // 'QUID' (backward: LIQU)

// Grid constants
export const MAP_SIZE = 533.33333;
export const MAP_HALF_SIZE = MAP_SIZE / 2;
export const MAP_RESOLUTION = 128;
export const MAP_RESOLUTION_PLUS_ONE = MAP_RESOLUTION + 1;

// Grid sizes
export const V9_SIZE = 129;
export const V8_SIZE = 128;
export const V9_SIZE_SQ = V9_SIZE * V9_SIZE; // 16641
export const V8_SIZE_SQ = V8_SIZE * V8_SIZE; // 16384

// ============================================================================
// FLAGS
// ============================================================================

export enum MapAreaHeaderFlags {
  NoArea = 0x0001,
}

export enum MapHeightHeaderFlags {
  NoHeight = 0x0001,
  HeightAsInt16 = 0x0002,
  HeightAsInt8 = 0x0004,
  HasFlightBounds = 0x0008,
}

export enum MapLiquidHeaderFlags {
  NoWater = 0x0001,
  NoType = 0x0002,
  NoHeight = 0x0004,
}

export enum LiquidTypeFlags {
  Water = 0x01,
  Ocean = 0x02,
  Magma = 0x04,
  Slime = 0x08,
  DarkWater = 0x10,
}

// ============================================================================
// STRUCTURES
// ============================================================================

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

export interface MapAreaHeader {
  areaMagic: number;
  flags: MapAreaHeaderFlags;
  gridArea: number;
}

export interface MapHeightHeader {
  heightMagic: number;
  flags: MapHeightHeaderFlags;
  gridHeight: number;
  gridMaxHeight: number;
}

export interface MapLiquidHeader {
  liquidMagic: number;
  flags: MapLiquidHeaderFlags;
  liquidType: number;
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
  liquidLevel: number;
}

export interface MapData {
  header: MapFileHeader;
  areaMap: Uint16Array | null;
  heightMap: Float32Array | Uint16Array | Uint8Array | null;
  heightFlags: MapHeightHeaderFlags;
  gridHeight: number;
  gridMaxHeight: number;
  liquidMap: Float32Array | null;
  liquidEntry: Uint16Array | null;
  liquidFlags: Uint8Array | null;
  liquidHeader: MapLiquidHeader | null;
  holes: Uint8Array | null;
}

export interface ParsedMapFile {
  filename: string;
  mapId: number;
  gridX: number;
  gridY: number;
  data: MapData;
  bounds: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  };
  stats: {
    areaCount: number;
    minHeight: number;
    maxHeight: number;
    hasLiquid: boolean;
    liquidType: string;
    hasHoles: boolean;
  };
}

// ============================================================================
// PARSER CLASS
// ============================================================================

export class MapFileParser {
  private dataView: DataView;
  private offset: number = 0;

  constructor(arrayBuffer: ArrayBuffer) {
    this.dataView = new DataView(arrayBuffer);
  }

  /**
   * Parse the entire .map file
   */
  parse(): MapData {
    this.offset = 0;

    // Read header
    const header = this.readHeader();

    // Validate magic numbers
    if (header.mapMagic !== MAP_MAGIC) {
      throw new Error(
        `Invalid map file magic: 0x${header.mapMagic.toString(16)} (expected 0x${MAP_MAGIC.toString(16)})`
      );
    }

    if (header.versionMagic !== MAP_VERSION_MAGIC) {
      throw new Error(
        `Incompatible map version: 0x${header.versionMagic.toString(16)} (expected 0x${MAP_VERSION_MAGIC.toString(16)})`
      );
    }

    // Parse area data
    const areaMap = header.areaMapSize > 0 ? this.readAreaData(header) : null;

    // Parse height data
    const { heightMap, heightFlags, gridHeight, gridMaxHeight } =
      header.heightMapSize > 0
        ? this.readHeightData(header)
        : { heightMap: null, heightFlags: MapHeightHeaderFlags.NoHeight, gridHeight: 0, gridMaxHeight: 0 };

    // Parse liquid data
    const { liquidMap, liquidEntry, liquidFlags, liquidHeader } =
      header.liquidMapSize > 0
        ? this.readLiquidData(header)
        : { liquidMap: null, liquidEntry: null, liquidFlags: null, liquidHeader: null };

    // Parse holes data
    const holes = header.holesSize > 0 ? this.readHolesData(header) : null;

    return {
      header,
      areaMap,
      heightMap,
      heightFlags,
      gridHeight,
      gridMaxHeight,
      liquidMap,
      liquidEntry,
      liquidFlags,
      liquidHeader,
      holes,
    };
  }

  /**
   * Read file header (44 bytes)
   */
  private readHeader(): MapFileHeader {
    const header: MapFileHeader = {
      mapMagic: this.readUint32(),
      versionMagic: this.readUint32(),
      buildMagic: this.readUint32(),
      areaMapOffset: this.readUint32(),
      areaMapSize: this.readUint32(),
      heightMapOffset: this.readUint32(),
      heightMapSize: this.readUint32(),
      liquidMapOffset: this.readUint32(),
      liquidMapSize: this.readUint32(),
      holesOffset: this.readUint32(),
      holesSize: this.readUint32(),
    };

    return header;
  }

  /**
   * Read area data (zone IDs)
   */
  private readAreaData(header: MapFileHeader): Uint16Array | null {
    this.offset = header.areaMapOffset;

    const areaHeader: MapAreaHeader = {
      areaMagic: this.readUint32(),
      flags: this.readUint32() as MapAreaHeaderFlags,
      gridArea: this.readUint16(),
    };

    // Validate magic
    if (areaHeader.areaMagic !== AREA_MAGIC) {
      console.warn('Invalid area magic, skipping area data');
      return null;
    }

    // Check if no area data
    if (areaHeader.flags & MapAreaHeaderFlags.NoArea) {
      return null;
    }

    // Read area map (16x16 = 256 uint16s)
    const areaMap = new Uint16Array(V8_SIZE_SQ);
    for (let i = 0; i < V8_SIZE_SQ; i++) {
      areaMap[i] = this.readUint16();
    }

    return areaMap;
  }

  /**
   * Read height data (terrain elevation)
   */
  private readHeightData(header: MapFileHeader): {
    heightMap: Float32Array | Uint16Array | Uint8Array | null;
    heightFlags: MapHeightHeaderFlags;
    gridHeight: number;
    gridMaxHeight: number;
  } {
    this.offset = header.heightMapOffset;

    const heightHeader: MapHeightHeader = {
      heightMagic: this.readUint32(),
      flags: this.readUint32() as MapHeightHeaderFlags,
      gridHeight: this.readFloat32(),
      gridMaxHeight: this.readFloat32(),
    };

    // Validate magic
    if (heightHeader.heightMagic !== HEIGHT_MAGIC) {
      console.warn('Invalid height magic, skipping height data');
      return { heightMap: null, heightFlags: MapHeightHeaderFlags.NoHeight, gridHeight: 0, gridMaxHeight: 0 };
    }

    // Check if no height data
    if (heightHeader.flags & MapHeightHeaderFlags.NoHeight) {
      return {
        heightMap: null,
        heightFlags: heightHeader.flags,
        gridHeight: heightHeader.gridHeight,
        gridMaxHeight: heightHeader.gridMaxHeight,
      };
    }

    // Determine data type and read height map
    let heightMap: Float32Array | Uint16Array | Uint8Array;

    if (heightHeader.flags & MapHeightHeaderFlags.HeightAsInt16) {
      // 16-bit unsigned integers
      heightMap = new Uint16Array(V9_SIZE_SQ);
      for (let i = 0; i < V9_SIZE_SQ; i++) {
        heightMap[i] = this.readUint16();
      }
    } else if (heightHeader.flags & MapHeightHeaderFlags.HeightAsInt8) {
      // 8-bit unsigned integers
      heightMap = new Uint8Array(V9_SIZE_SQ);
      for (let i = 0; i < V9_SIZE_SQ; i++) {
        heightMap[i] = this.readUint8();
      }
    } else {
      // 32-bit floats
      heightMap = new Float32Array(V9_SIZE_SQ);
      for (let i = 0; i < V9_SIZE_SQ; i++) {
        heightMap[i] = this.readFloat32();
      }
    }

    // Read flight bounds if present (min height planes)
    if (heightHeader.flags & MapHeightHeaderFlags.HasFlightBounds) {
      // Skip flight bounds data (3 planes, each with 4 floats = 48 bytes)
      this.offset += 48;
    }

    return {
      heightMap,
      heightFlags: heightHeader.flags,
      gridHeight: heightHeader.gridHeight,
      gridMaxHeight: heightHeader.gridMaxHeight,
    };
  }

  /**
   * Read liquid data (water/lava/slime)
   */
  private readLiquidData(header: MapFileHeader): {
    liquidMap: Float32Array | null;
    liquidEntry: Uint16Array | null;
    liquidFlags: Uint8Array | null;
    liquidHeader: MapLiquidHeader | null;
  } {
    this.offset = header.liquidMapOffset;

    const liquidHeader: MapLiquidHeader = {
      liquidMagic: this.readUint32(),
      flags: this.readUint32() as MapLiquidHeaderFlags,
      liquidType: this.readUint16(),
      offsetX: this.readUint8(),
      offsetY: this.readUint8(),
      width: this.readUint8(),
      height: this.readUint8(),
      liquidLevel: this.readFloat32(),
    };

    // Validate magic
    if (liquidHeader.liquidMagic !== LIQUID_MAGIC) {
      console.warn('Invalid liquid magic, skipping liquid data');
      return { liquidMap: null, liquidEntry: null, liquidFlags: null, liquidHeader: null };
    }

    // Check if no liquid data
    if (liquidHeader.flags & MapLiquidHeaderFlags.NoWater) {
      return { liquidMap: null, liquidEntry: null, liquidFlags: null, liquidHeader };
    }

    const liquidSize = liquidHeader.width * liquidHeader.height;

    // Read liquid entry IDs if present
    let liquidEntry: Uint16Array | null = null;
    if (!(liquidHeader.flags & MapLiquidHeaderFlags.NoType)) {
      liquidEntry = new Uint16Array(liquidSize);
      for (let i = 0; i < liquidSize; i++) {
        liquidEntry[i] = this.readUint16();
      }
    }

    // Read liquid flags
    let liquidFlags: Uint8Array | null = null;
    liquidFlags = new Uint8Array(liquidSize);
    for (let i = 0; i < liquidSize; i++) {
      liquidFlags[i] = this.readUint8();
    }

    // Read liquid height map if present
    let liquidMap: Float32Array | null = null;
    if (!(liquidHeader.flags & MapLiquidHeaderFlags.NoHeight)) {
      const liquidHeightSize = (liquidHeader.width + 1) * (liquidHeader.height + 1);
      liquidMap = new Float32Array(liquidHeightSize);
      for (let i = 0; i < liquidHeightSize; i++) {
        liquidMap[i] = this.readFloat32();
      }
    }

    return { liquidMap, liquidEntry, liquidFlags, liquidHeader };
  }

  /**
   * Read holes data (terrain gaps/missing chunks)
   */
  private readHolesData(header: MapFileHeader): Uint8Array {
    this.offset = header.holesOffset;

    // Holes are stored as a bitmask (8x8 = 64 bits = 8 bytes)
    const holes = new Uint8Array(8);
    for (let i = 0; i < 8; i++) {
      holes[i] = this.readUint8();
    }

    return holes;
  }

  // Helper methods for reading binary data
  private readUint8(): number {
    const value = this.dataView.getUint8(this.offset);
    this.offset += 1;
    return value;
  }

  private readUint16(): number {
    const value = this.dataView.getUint16(this.offset, true); // little-endian
    this.offset += 2;
    return value;
  }

  private readUint32(): number {
    const value = this.dataView.getUint32(this.offset, true); // little-endian
    this.offset += 4;
    return value;
  }

  private readFloat32(): number {
    const value = this.dataView.getFloat32(this.offset, true); // little-endian
    this.offset += 4;
    return value;
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Parse map filename to extract map ID and grid coordinates
 * Format: MMMM_XX_YY.map (e.g., 0000_31_43.map)
 */
export function parseMapFilename(filename: string): { mapId: number; gridX: number; gridY: number } | null {
  const match = filename.match(/(\d{4})_(\d{2})_(\d{2})\.map/);
  if (!match) return null;

  return {
    mapId: parseInt(match[1], 10),
    gridX: parseInt(match[2], 10),
    gridY: parseInt(match[3], 10),
  };
}

/**
 * Convert grid coordinates to world coordinates
 */
export function gridToWorld(gridX: number, gridY: number, mapId: number): { x: number; y: number } {
  // TrinityCore grid system: (32 - gridX - 0.5) * MAP_SIZE
  const worldX = (32 - gridX - 0.5) * MAP_SIZE;
  const worldY = (32 - gridY - 0.5) * MAP_SIZE;

  return { x: worldX, y: worldY };
}

/**
 * Get height at specific grid position
 */
export function getHeightAt(
  heightMap: Float32Array | Uint16Array | Uint8Array,
  flags: MapHeightHeaderFlags,
  gridHeight: number,
  gridMaxHeight: number,
  x: number, // 0-128
  y: number  // 0-128
): number {
  if (!heightMap) return gridHeight;

  // Clamp coordinates
  x = Math.max(0, Math.min(V8_SIZE, x));
  y = Math.max(0, Math.min(V8_SIZE, y));

  // Calculate index (V9 grid: 129x129)
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const index = iy * V9_SIZE + ix;

  if (index >= heightMap.length) return gridHeight;

  const rawValue = heightMap[index];

  // Convert to actual height based on flags
  if (flags & MapHeightHeaderFlags.HeightAsInt16) {
    // uint16: (value / 65535) * (maxHeight - minHeight) + minHeight
    return (rawValue / 65535.0) * (gridMaxHeight - gridHeight) + gridHeight;
  } else if (flags & MapHeightHeaderFlags.HeightAsInt8) {
    // uint8: (value / 255) * (maxHeight - minHeight) + minHeight
    return (rawValue / 255.0) * (gridMaxHeight - gridHeight) + gridHeight;
  } else {
    // float: direct value
    return rawValue as number;
  }
}

/**
 * Get area ID at specific grid position
 */
export function getAreaAt(areaMap: Uint16Array | null, x: number, y: number): number {
  if (!areaMap) return 0;

  // Clamp coordinates
  x = Math.max(0, Math.min(V8_SIZE - 1, Math.floor(x)));
  y = Math.max(0, Math.min(V8_SIZE - 1, Math.floor(y)));

  const index = y * V8_SIZE + x;
  return areaMap[index];
}

/**
 * Check if there's a hole at grid position
 */
export function hasHoleAt(holes: Uint8Array | null, row: number, col: number): boolean {
  if (!holes || row < 0 || row >= 8 || col < 0 || col >= 8) return false;

  const byteIndex = Math.floor(row / 2);
  const bitIndex = (row % 2) * 4 + col / 2;

  return (holes[byteIndex] & (1 << bitIndex)) !== 0;
}

/**
 * Get liquid type name
 */
export function getLiquidTypeName(flags: number): string {
  if (flags & LiquidTypeFlags.Ocean) return 'Ocean';
  if (flags & LiquidTypeFlags.Magma) return 'Magma/Lava';
  if (flags & LiquidTypeFlags.Slime) return 'Slime';
  if (flags & LiquidTypeFlags.DarkWater) return 'Dark Water';
  if (flags & LiquidTypeFlags.Water) return 'Water';
  return 'Unknown';
}

/**
 * Calculate statistics from map data
 */
export function calculateMapStats(data: MapData): {
  areaCount: number;
  minHeight: number;
  maxHeight: number;
  hasLiquid: boolean;
  liquidType: string;
  hasHoles: boolean;
} {
  let areaCount = 0;
  let minHeight = Infinity;
  let maxHeight = -Infinity;

  // Count unique areas
  if (data.areaMap) {
    const uniqueAreas = new Set(Array.from(data.areaMap));
    areaCount = uniqueAreas.size;
  }

  // Find min/max height
  if (data.heightMap) {
    for (let i = 0; i < data.heightMap.length; i++) {
      const height = getHeightAt(
        data.heightMap,
        data.heightFlags,
        data.gridHeight,
        data.gridMaxHeight,
        i % V9_SIZE,
        Math.floor(i / V9_SIZE)
      );
      minHeight = Math.min(minHeight, height);
      maxHeight = Math.max(maxHeight, height);
    }
  } else {
    minHeight = data.gridHeight;
    maxHeight = data.gridMaxHeight;
  }

  // Check liquid
  const hasLiquid = data.liquidMap !== null || data.liquidEntry !== null;
  const liquidType = data.liquidHeader
    ? getLiquidTypeName(data.liquidHeader.liquidType)
    : 'None';

  // Check holes
  const hasHoles = data.holes !== null && Array.from(data.holes).some(b => b !== 0);

  return {
    areaCount,
    minHeight: isFinite(minHeight) ? minHeight : 0,
    maxHeight: isFinite(maxHeight) ? maxHeight : 0,
    hasLiquid,
    liquidType,
    hasHoles,
  };
}

/**
 * Parse a complete .map file from ArrayBuffer
 */
export async function parseMapFile(filename: string, arrayBuffer: ArrayBuffer): Promise<ParsedMapFile> {
  // Parse filename
  const filenameData = parseMapFilename(filename);
  if (!filenameData) {
    throw new Error(`Invalid map filename format: ${filename}`);
  }

  // Parse binary data
  const parser = new MapFileParser(arrayBuffer);
  const data = parser.parse();

  // Calculate world bounds
  const worldPos = gridToWorld(filenameData.gridX, filenameData.gridY, filenameData.mapId);
  const bounds = {
    minX: worldPos.x - MAP_HALF_SIZE,
    maxX: worldPos.x + MAP_HALF_SIZE,
    minY: worldPos.y - MAP_HALF_SIZE,
    maxY: worldPos.y + MAP_HALF_SIZE,
  };

  // Calculate statistics
  const stats = calculateMapStats(data);

  return {
    filename,
    mapId: filenameData.mapId,
    gridX: filenameData.gridX,
    gridY: filenameData.gridY,
    data,
    bounds,
    stats,
  };
}

/**
 * Load .map file from File object
 */
export async function loadMapFile(file: File): Promise<ParsedMapFile> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const arrayBuffer = e.target?.result as ArrayBuffer;
        const parsed = await parseMapFile(file.name, arrayBuffer);
        resolve(parsed);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsArrayBuffer(file);
  });
}
