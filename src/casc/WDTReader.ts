/**
 * WDT (World Data Table) File Reader
 *
 * Parses WDT files to extract map tile information, specifically the MAID chunk
 * which contains FileDataIDs for all minimap tiles in modern WoW (8.1.0+)
 *
 * @module casc/WDTReader
 */

import { logger } from '../utils/logger.js';

/**
 * MAID Entry Structure (32 bytes)
 *
 * Each map tile has 8 FileDataID references
 */
export interface MAIDEntry {
  rootADT: number;          // mapname_xx_yy.adt
  obj0ADT: number;          // mapname_xx_yy_obj0.adt
  obj1ADT: number;          // mapname_xx_yy_obj1.adt
  tex0ADT: number;          // mapname_xx_yy_tex0.adt
  lodADT: number;           // mapname_xx_yy_lod.adt
  mapTexture: number;       // mapname_xx_yy.blp (LOD texture)
  mapTextureN: number;      // mapname_xx_yy_n.blp (LOD normal map)
  minimapTexture: number;   // mapxx_yy.blp (MINIMAP TILE - This is what we need!)
}

/**
 * Tile coordinate with FileDataID
 */
export interface TileInfo {
  x: number;
  y: number;
  fileDataId: number;
}

/**
 * WDT File Reader
 *
 * Parses WDT chunk-based format to extract minimap tile FileDataIDs
 */
export class WDTReader {
  private data: Buffer;
  private maidEntries: MAIDEntry[][] = [];  // 64x64 grid

  constructor(data: Buffer) {
    this.data = data;
  }

  /**
   * Parse WDT file and extract MAID chunk
   */
  parse(): void {
    process.stderr.write(`[WDTReader] Parsing WDT file (${this.data.length} bytes)
`);

    let offset = 0;

    while (offset < this.data.length) {
      // Read chunk signature (4 bytes, ASCII)
      if (offset + 8 > this.data.length) break;

      const chunkSig = this.data.toString('ascii', offset, offset + 4);
      offset += 4;

      const chunkSize = this.data.readUInt32LE(offset);
      offset += 4;

      process.stderr.write(`[WDTReader]   Chunk: "${chunkSig}" Size: ${chunkSize} bytes at offset ${offset - 8}
`);

      if (offset + chunkSize > this.data.length) {
        process.stderr.write(`[WDTReader]   Chunk size exceeds buffer, stopping
`);
        break;
      }

      // Process chunk (WDT chunks are little-endian, so MAID appears as DIAM)
      if (chunkSig === 'DIAM') {
        this.parseMAIDChunk(offset, chunkSize);
      }

      offset += chunkSize;
    }
  }

  /**
   * Parse MAID chunk (Map ADT IDs)
   *
   * Contains 64x64 grid of MAIDEntry structures (4096 entries total)
   * Each entry is 32 bytes (8 uint32 FileDataIDs)
   */
  private parseMAIDChunk(offset: number, size: number): void {
    process.stderr.write(`[WDTReader]   Parsing MAID chunk...
`);

    const expectedSize = 64 * 64 * 32;  // 64x64 grid, 32 bytes per entry
    if (size !== expectedSize) {
      process.stderr.write(`[WDTReader]   MAID chunk size mismatch: expected ${expectedSize}, got ${size}
`);
    }

    this.maidEntries = [];

    let entryOffset = offset;
    let tilesWithMinimap = 0;

    // Parse 64x64 grid
    for (let y = 0; y < 64; y++) {
      this.maidEntries[y] = [];

      for (let x = 0; x < 64; x++) {
        const entry: MAIDEntry = {
          rootADT: this.data.readUInt32LE(entryOffset),
          obj0ADT: this.data.readUInt32LE(entryOffset + 4),
          obj1ADT: this.data.readUInt32LE(entryOffset + 8),
          tex0ADT: this.data.readUInt32LE(entryOffset + 12),
          lodADT: this.data.readUInt32LE(entryOffset + 16),
          mapTexture: this.data.readUInt32LE(entryOffset + 20),
          mapTextureN: this.data.readUInt32LE(entryOffset + 24),
          minimapTexture: this.data.readUInt32LE(entryOffset + 28)  // <-- KEY FIELD!
        };

        this.maidEntries[y][x] = entry;
        entryOffset += 32;

        if (entry.minimapTexture > 0) {
          tilesWithMinimap++;
        }
      }
    }

    process.stderr.write(`[WDTReader]   Found ${tilesWithMinimap} tiles with minimap textures
`);
    logger.info('WDTReader', `MAID chunk parsed: ${tilesWithMinimap} tiles with minimaps`);
  }

  /**
   * Get all minimap tile FileDataIDs
   *
   * @returns Array of {x, y, fileDataId} for all tiles with minimap textures
   */
  getMinimapTiles(): TileInfo[] {
    const tiles: TileInfo[] = [];

    for (let y = 0; y < 64; y++) {
      for (let x = 0; x < 64; x++) {
        if (this.maidEntries[y] && this.maidEntries[y][x]) {
          const entry = this.maidEntries[y][x];

          if (entry.minimapTexture > 0) {
            tiles.push({
              x,
              y,
              fileDataId: entry.minimapTexture
            });
          }
        }
      }
    }

    return tiles;
  }

  /**
   * Check if WDT has MAID chunk
   */
  hasMAIDChunk(): boolean {
    return this.maidEntries.length > 0;
  }

  /**
   * Get MAID entry for specific tile
   */
  getMAIDEntry(x: number, y: number): MAIDEntry | null {
    if (y >= 0 && y < this.maidEntries.length) {
      if (x >= 0 && x < this.maidEntries[y].length) {
        return this.maidEntries[y][x];
      }
    }
    return null;
  }
}
