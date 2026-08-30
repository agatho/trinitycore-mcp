/**
 * Minimap Tile Extraction and Caching Service
 *
 * Extracts and serves WoW minimap tiles from CASC storage.
 * Handles BLP to PNG conversion with caching.
 *
 * IMPORTANT: Modern WoW (retail 11.x) stores minimap tiles at:
 *   world/minimaps/{mapfolder}/mapXX_YY.blp
 * NOT as sequential FileDataIDs from Map.db2's WdtFileDataID field!
 *
 * @module MinimapService
 */

import fs from 'fs/promises';
import path from 'path';
import { PNG } from 'pngjs';
import { logger } from '../utils/logger.js';
import { DatabaseError } from '../database/errors.js';
import { getCASCReader, CASCReader } from '../casc/CASCReader.js';
import { DXTDecompressor } from '../casc/DXTDecompressor.js';

/**
 * Map ID to minimap folder name mapping
 *
 * Modern WoW uses numeric Map IDs (from Map.db2) but minimap files
 * are stored in folders with legacy/numeric names.
 */
const MAP_ID_TO_FOLDER: Record<number, string> = {
  // Classic continents
  58441: 'azeroth',        // Azeroth (Eastern Kingdoms) - 2,059 tiles
  58276: 'kalimdor',       // Kalimdor - 2,131 tiles
  58346: 'expansion01',    // Outland - 840 tiles
  59446: 'northrend',      // Northrend - 1,131 tiles

  // Expansion continents
  870: 'hawaiimainland',   // Pandaria - 719 tiles
  1220: 'troll raid',      // Broken Isles - 1,404 tiles
  59838: 'draenor',        // Draenor - 1,221 tiles
  60399: 'kultiras',       // Kul Tiras - 971 tiles
  60621: 'zandalar',       // Zandalar - 981 tiles
  2444: '2444',            // Dragon Isles - 1,634 tiles
  2601: '2601',            // Khaz Algar - 855 tiles
};

/**
 * Map folder name to display name
 */
const FOLDER_TO_NAME: Record<string, string> = {
  'azeroth': 'Azeroth (Eastern Kingdoms)',
  'kalimdor': 'Kalimdor',
  'expansion01': 'Outland',
  'northrend': 'Northrend',
  'hawaiimainland': 'Pandaria',
  'troll raid': 'Broken Isles',
  'draenor': 'Draenor',
  'kultiras': 'Kul Tiras',
  'zandalar': 'Zandalar',
  '2444': 'Dragon Isles',
  '2601': 'Khaz Algar'
};

/**
 * Minimap tile info
 */
export interface MinimapTileInfo {
  fileDataId: number;
  filePath: string;
  x: number;
  y: number;
  fileName: string;
}

/**
 * Map info with minimap tiles
 */
export interface MapInfo {
  mapId: number;
  mapName: string;
  folderName: string;
  tileCount: number;
  tiles: MinimapTileInfo[];
}

/**
 * Minimap service configuration
 */
export interface MinimapServiceConfig {
  wowPath: string;
  listFilePath?: string;
  cacheDir?: string;
}

/**
 * Minimap tile extraction and caching service
 */
export class MinimapService {
  private config: MinimapServiceConfig;
  private cacheDir: string;
  private mapCache: Map<number, MapInfo> = new Map();
  private listFileCache: Map<string, number> = new Map(); // path -> fileDataId
  private cascReader: CASCReader | null = null; // Dedicated CASC instance

  constructor(config: MinimapServiceConfig) {
    this.config = config;
    this.cacheDir = config.cacheDir || path.join(process.cwd(), 'cache', 'minimaps');
  }

  /**
   * Release the CASC reader and everything it holds.
   *
   * Initialising CASC builds about 9.4 million Map entries and roughly 3.8 GB
   * of heap, which never comes back on its own - so a server that extracts one
   * tile reports critical memory usage from then on. Extraction is a batch
   * operation, not a hot path, so the reader is released when a caller is done
   * and rebuilt on next use.
   *
   * The tile cache on disk is untouched: a released reader costs a slower next
   * extraction, never a wrong answer.
   */
  async releaseCASC(): Promise<void> {
    if (this.cascReader) {
      this.cascReader.dispose();
      this.cascReader = null;
      logger.info('MinimapService', 'CASC reader released');
    }
  }

  /** Whether the CASC reader is currently loaded. */
  isCASCLoaded(): boolean {
    return this.cascReader !== null;
  }

  /**
   * Initialize service and create cache directory
   */
  async initialize(): Promise<void> {
    await fs.mkdir(this.cacheDir, { recursive: true });

    // Load listfile for path → FileDataID mapping
    await this.loadListFile();

    // Initialize dedicated CASC reader instance
    this.cascReader = new CASCReader({
      wowPath: this.config.wowPath,
      locale: 'enUS',
      product: 'wow',
      enableCDN: true
    });
    await this.cascReader.initialize();

    logger.info('MinimapService', `Initialized with cache dir: ${this.cacheDir}`);
    logger.info('MinimapService', `Loaded ${this.listFileCache.size} listfile entries`);
    logger.info('MinimapService', `CASC reader initialized`);
  }

  /**
   * Load listfile for path → FileDataID mapping
   */
  private async loadListFile(): Promise<void> {
    const listFilePath = this.config.listFilePath || 'C:/temp/wow-listfile.csv';

    try {
      const content = await fs.readFile(listFilePath, 'utf8');
      const lines = content.split('\n');

      for (const line of lines) {
        const parts = line.trim().split(';');
        if (parts.length === 2) {
          const fileDataId = parseInt(parts[0]);
          const filePath = parts[1].toLowerCase();

          if (!isNaN(fileDataId) && fileDataId > 0) {
            this.listFileCache.set(filePath, fileDataId);
          }
        }
      }

      logger.info('MinimapService', `Loaded ${this.listFileCache.size} listfile entries`);
    } catch (error) {
      logger.warn('MinimapService', 'Failed to load listfile, path-based extraction will fail', {
        error: error as Error
      });
    }
  }

  /**
   * Get map information including all minimap tiles
   */
  async getMapInfo(mapId: number): Promise<MapInfo | null> {
    // Check cache
    if (this.mapCache.has(mapId)) {
      return this.mapCache.get(mapId)!;
    }

    // Check if this map has minimap data
    const folderName = MAP_ID_TO_FOLDER[mapId];
    if (!folderName) {
      logger.warn('MinimapService', `Map ${mapId} has no minimap folder mapping`);
      return null;
    }

    try {
      // Query listfile for all minimap tiles for this map
      const tiles: MinimapTileInfo[] = [];
      const searchPattern = `world/minimaps/${folderName}/`;

      for (const [filePath, fileDataId] of this.listFileCache.entries()) {
        if (filePath.startsWith(searchPattern) && filePath.endsWith('.blp')) {
          // Extract coordinates from filename (e.g., "map25_30.blp" → x=25, y=30)
          const fileName = path.basename(filePath, '.blp');
          const match = fileName.match(/map(\d+)_(\d+)/);

          if (match) {
            const x = parseInt(match[1]);
            const y = parseInt(match[2]);

            tiles.push({
              fileDataId,
              filePath,
              x,
              y,
              fileName
            });
          }
        }
      }

      // Sort tiles by coordinates for consistency
      tiles.sort((a, b) => {
        if (a.y !== b.y) return a.y - b.y;
        return a.x - b.x;
      });

      const mapInfo: MapInfo = {
        mapId,
        mapName: FOLDER_TO_NAME[folderName] || folderName,
        folderName,
        tileCount: tiles.length,
        tiles
      };

      // Cache and return
      this.mapCache.set(mapId, mapInfo);

      logger.info('MinimapService', `Loaded map ${mapId} (${mapInfo.mapName}): ${tiles.length} tiles`);

      return mapInfo;
    } catch (error: any) {
      throw new DatabaseError(`Failed to get map info for ${mapId}: ${error.message}`);
    }
  }

  /**
   * Extract and convert minimap tile to PNG
   *
   * @param fileDataId - BLP tile FileDataID
   * @param forceRefresh - Skip cache and re-extract
   * @param mapId - Optional map ID for web-ui directory structure
   * @param tileCoords - Optional tile coordinates {x, y} for proper tile map naming
   * @returns PNG buffer
   */
  async getTilePNG(fileDataId: number, forceRefresh: boolean = false, mapId?: number, tileCoords?: { x: number; y: number }): Promise<Buffer> {
    // Determine cache path based on whether mapId is provided
    let cachePath: string;

    if (mapId !== undefined && tileCoords) {
      // Store in web-ui directory structure organized by mapId with x_y naming
      // Format: /tile-data/{mapId}/0/{x}_{y}.png
      const cwd = process.cwd();
      const rootDir = cwd.endsWith('web-ui') ? path.join(cwd, '..') : cwd;
      const zoomDir = path.join(rootDir, 'web-ui', 'public', 'tile-data', mapId.toString(), '0');
      await fs.mkdir(zoomDir, { recursive: true });
      cachePath = path.join(zoomDir, `${tileCoords.x}_${tileCoords.y}.png`);
    } else if (mapId !== undefined) {
      // Store in web-ui directory structure organized by mapId (legacy FileDataID naming)
      const cwd = process.cwd();
      const rootDir = cwd.endsWith('web-ui') ? path.join(cwd, '..') : cwd;
      const webUiPath = path.join(rootDir, 'web-ui', 'public', 'tile-data', mapId.toString());
      await fs.mkdir(webUiPath, { recursive: true });
      cachePath = path.join(webUiPath, `${fileDataId}.png`);
    } else {
      // Store in default cache directory (flat structure)
      cachePath = path.join(this.cacheDir, `${fileDataId}.png`);
    }

    if (!forceRefresh) {
      try {
        const cached = await fs.readFile(cachePath);
        logger.debug('MinimapService', `Serving cached tile: ${fileDataId}`);
        return cached;
      } catch (error) {
        // Cache miss, continue to extraction
      }
    }

    try {
      logger.debug('MinimapService', `Extracting tile: ${fileDataId}`);

      // Use our dedicated CASC reader instance
      if (!this.cascReader) {
        // Rebuilt on demand: releaseCASC() may have freed it since the last call.
        await this.initialize();
      }
      if (!this.cascReader) {
        throw new Error('CASC reader not initialized. Call initialize() first.');
      }

      const blpData = await this.cascReader.getFileByID(fileDataId);

      // Parse BLP header
      const header = this.parseBLPHeader(blpData);

      // Decompress DXT data
      const pixelData = DXTDecompressor.decompress(
        Buffer.from(blpData.slice(header.mipOffsets[0])),
        header.width,
        header.height,
        header.alphaDepth,
        header.alphaEncoding
      );

      // Create PNG
      const png = new PNG({ width: header.width, height: header.height });
      png.data = Buffer.from(pixelData);

      // Convert to buffer
      const pngBuffer = await this.pngToBuffer(png);

      // Cache the result
      await fs.writeFile(cachePath, pngBuffer);

      logger.info('MinimapService', `Extracted and cached tile: ${fileDataId} (${header.width}x${header.height})`);

      return pngBuffer;
    } catch (error: any) {
      throw new DatabaseError(`Failed to extract tile ${fileDataId}: ${error.message}`);
    }
  }

  /**
   * Get multiple tiles (batch extraction)
   *
   * @param fileDataIds - Array of FileDataIDs to extract
   * @param mapId - Optional map ID for web-ui directory structure
   * @param progressCallback - Optional callback for progress updates
   */
  async getTilesBatch(
    tiles: Array<{ fileDataId: number; x?: number; y?: number }>,
    mapId?: number,
    progressCallback?: (progress: { current: number; total: number; percent: number; successCount: number; failCount: number }) => void
  ): Promise<Map<number, Buffer>> {
    const results = new Map<number, Buffer>();
    let successCount = 0;
    let failCount = 0;
    const total = tiles.length;

    logger.info('MinimapService', `Batch extracting ${total} tiles${mapId ? ` for map ${mapId}` : ''}...`);

    for (let i = 0; i < tiles.length; i++) {
      const tile = tiles[i];
      const tileCoords = (tile.x !== undefined && tile.y !== undefined) ? { x: tile.x, y: tile.y } : undefined;

      try {
        const png = await this.getTilePNG(tile.fileDataId, false, mapId, tileCoords);
        results.set(tile.fileDataId, png);
        successCount++;
      } catch (error) {
        logger.error('MinimapService', error, { fileDataId: tile.fileDataId });
        failCount++;
      }

      // Report progress every 50 tiles or at completion
      const current = i + 1;
      if (progressCallback && (current % 50 === 0 || current === total)) {
        const percent = Math.round((current / total) * 100);
        progressCallback({ current, total, percent, successCount, failCount });
        logger.info('MinimapService', `Progress: ${current}/${total} (${percent}%) - Success: ${successCount}, Failed: ${failCount}`);
      }
    }

    logger.info('MinimapService', `Batch extraction completed: ${successCount} successful, ${failCount} failed`);

    // A finished batch is the natural point to hand back the ~3.8 GB that CASC
    // holds. Single-tile calls keep it, because paying 30 seconds to rebuild it
    // per tile would be worse than holding it; a batch has no such follow-up.
    await this.releaseCASC();

    return results;
  }

  /**
   * Get all available map IDs that have minimap data
   */
  getAvailableMapIds(): number[] {
    return Object.keys(MAP_ID_TO_FOLDER).map(id => parseInt(id));
  }

  /**
   * Check if a map has minimap data available
   */
  hasMinimapData(mapId: number): boolean {
    return MAP_ID_TO_FOLDER[mapId] !== undefined;
  }

  /**
   * Parse BLP header
   */
  private parseBLPHeader(data: Buffer): {
    magic: string;
    version: number;
    compression: number;
    alphaDepth: number;
    alphaEncoding: number;
    hasMips: number;
    width: number;
    height: number;
    mipOffsets: number[];
    mipSizes: number[];
  } {
    const magic = data.toString('ascii', 0, 4);

    if (magic !== 'BLP0' && magic !== 'BLP1' && magic !== 'BLP2') {
      throw new Error(`Invalid BLP magic: ${magic}`);
    }

    const header = {
      magic,
      version: data.readUInt32LE(4),
      compression: data.readUInt8(8),
      alphaDepth: data.readUInt8(9),
      alphaEncoding: data.readUInt8(10),
      hasMips: data.readUInt8(11),
      width: data.readUInt32LE(12),
      height: data.readUInt32LE(16),
      mipOffsets: [] as number[],
      mipSizes: [] as number[]
    };

    // Read mipmap offsets and sizes (16 levels max)
    for (let i = 0; i < 16; i++) {
      const offset = data.readUInt32LE(20 + i * 4);
      const size = data.readUInt32LE(84 + i * 4);

      if (offset > 0 && size > 0) {
        header.mipOffsets.push(offset);
        header.mipSizes.push(size);
      }
    }

    return header;
  }

  /**
   * Convert PNG object to buffer
   */
  private pngToBuffer(png: PNG): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      png.pack()
        .on('data', (chunk: Buffer) => chunks.push(chunk))
        .on('end', () => resolve(Buffer.concat(chunks)))
        .on('error', reject);
    });
  }

  /**
   * Clear cache for specific map or all maps
   */
  async clearCache(mapId?: number): Promise<void> {
    if (mapId !== undefined) {
      const mapInfo = await this.getMapInfo(mapId);
      if (mapInfo) {
        // Clear all tiles for this map
        for (const tile of mapInfo.tiles) {
          const tilePath = path.join(this.cacheDir, `${tile.fileDataId}.png`);
          try {
            await fs.unlink(tilePath);
          } catch (error) {
            // Ignore if file doesn't exist
          }
        }
        logger.info('MinimapService', `Cleared cache for map ${mapId} (${mapInfo.tileCount} tiles)`);
      }
    } else {
      // Clear all cache
      await fs.rm(this.cacheDir, { recursive: true, force: true });
      await fs.mkdir(this.cacheDir, { recursive: true });
      logger.info('MinimapService', 'Cleared all minimap cache');
    }
  }
}

/**
 * Singleton instance
 */
let minimapService: MinimapService | null = null;

/**
 * Get or create MinimapService instance
 */
export function getMinimapService(config?: MinimapServiceConfig): MinimapService {
  if (!minimapService && config) {
    minimapService = new MinimapService(config);
  }

  if (!minimapService) {
    throw new Error('MinimapService not initialized. Call getMinimapService(config) first.');
  }

  return minimapService;
}
