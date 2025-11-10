/**
 * Map Extraction MCP Tool
 *
 * Extracts and tiles WoW map textures from CASC storage for use in World Editor.
 *
 * @module tools/mapextraction
 */

import path from 'path';
import fs from 'fs/promises';
import { CASCReader, MapQuality, getCASCReader } from '../casc/CASCReader.js';
import { BLPConverter } from '../casc/BLPConverter.js';
import { MapTiler, TileMetadata } from '../casc/MapTiler.js';
import { Logger } from '../lib/logger.js';

/**
 * Map extraction status
 */
export interface ExtractionStatus {
  mapId: number;
  status: 'pending' | 'extracting' | 'converting' | 'tiling' | 'completed' | 'error';
  progress: number;
  error?: string;
  metadata?: TileMetadata;
}

/**
 * Extract map textures from WoW CASC
 */
export async function extractMapTextures(args: {
  /** Map ID to extract */
  mapId: number;
  /** Quality levels to extract */
  quality?: 'low' | 'medium' | 'high' | 'all';
  /** Enable tiling */
  enableTiling?: boolean;
  /** Tile size (default: 256) */
  tileSize?: number;
}): Promise<ExtractionStatus> {
  const { mapId, quality = 'all', enableTiling = true, tileSize = 256 } = args;

  Logger.info('MapExtraction', `Starting extraction for map ${mapId}, quality: ${quality}`);

  const status: ExtractionStatus = {
    mapId,
    status: 'pending',
    progress: 0
  };

  try {
    // Initialize CASC reader
    const wowPath = process.env.WOW_PATH;
    if (!wowPath) {
      throw new Error('WOW_PATH not configured. Set WOW_PATH environment variable.');
    }

    const cascReader = getCASCReader({ wowPath });
    await cascReader.initialize();

    status.status = 'extracting';
    status.progress = 10;

    // Extract BLP files from CASC
    const qualityLevel = quality as MapQuality;
    const blpFiles = await cascReader.extractMapTextures(mapId, qualityLevel);

    if (blpFiles.length === 0) {
      throw new Error(`No map textures found for map ${mapId}`);
    }

    Logger.info('MapExtraction', `Extracted ${blpFiles.length} BLP files`);

    status.status = 'converting';
    status.progress = 40;

    // Convert BLP to PNG
    const outputDir = path.join(process.cwd(), 'data', 'maps', 'converted', `${mapId}`);
    await fs.mkdir(outputDir, { recursive: true });

    const pngFiles = await BLPConverter.convertBatch(blpFiles, outputDir);

    Logger.info('MapExtraction', `Converted ${pngFiles.length} PNG files`);

    status.status = 'tiling';
    status.progress = 70;

    // Tile maps if enabled
    if (enableTiling && pngFiles.length > 0) {
      const tiler = new MapTiler({
        tileSize,
        generateZoomLevels: true,
        format: 'webp',
        quality: 85
      });

      const tilesOutputDir = path.join(
        process.cwd(),
        'web-ui',
        'public',
        'maps',
        'tiles',
        `${mapId}`
      );

      // Find the main map file (usually the largest)
      const mainMapFile = await findMainMapFile(pngFiles);

      const metadata = await tiler.tileImage(mainMapFile, tilesOutputDir);

      status.metadata = metadata;
      Logger.info('MapExtraction', `Tiled map into ${metadata.totalTiles} tiles`);
    }

    status.status = 'completed';
    status.progress = 100;

    Logger.info('MapExtraction', `Map ${mapId} extraction completed successfully`);

    return status;
  } catch (error: any) {
    Logger.error('MapExtraction', error, { mapId });

    status.status = 'error';
    status.error = error.message;

    return status;
  }
}

/**
 * Find the main map file (largest PNG)
 */
async function findMainMapFile(pngFiles: string[]): Promise<string> {
  let largestFile = pngFiles[0];
  let largestSize = 0;

  for (const file of pngFiles) {
    try {
      const stats = await fs.stat(file);
      if (stats.size > largestSize) {
        largestSize = stats.size;
        largestFile = file;
      }
    } catch {
      // Skip if file doesn't exist
    }
  }

  return largestFile;
}

/**
 * Check if map is already extracted
 */
export async function isMapExtracted(args: { mapId: number }): Promise<boolean> {
  const { mapId } = args;

  const tilesDir = path.join(
    process.cwd(),
    'web-ui',
    'public',
    'maps',
    'tiles',
    `${mapId}`
  );

  try {
    await fs.access(path.join(tilesDir, 'metadata.json'));
    return true;
  } catch {
    return false;
  }
}

/**
 * Get extraction status for a map
 */
export async function getExtractionStatus(args: {
  mapId: number;
}): Promise<ExtractionStatus | null> {
  const { mapId } = args;

  const isExtracted = await isMapExtracted({ mapId });

  if (!isExtracted) {
    return null;
  }

  try {
    const tilesDir = path.join(
      process.cwd(),
      'web-ui',
      'public',
      'maps',
      'tiles',
      `${mapId}`
    );

    const metadata = await MapTiler.loadMetadata(tilesDir);

    return {
      mapId,
      status: 'completed',
      progress: 100,
      metadata
    };
  } catch (error: any) {
    return {
      mapId,
      status: 'error',
      progress: 0,
      error: error.message
    };
  }
}

/**
 * List all available maps in WoW installation
 */
export async function listAvailableMaps(): Promise<
  Array<{ id: number; name: string; extracted: boolean }>
> {
  const maps = [
    { id: 0, name: 'Eastern Kingdoms' },
    { id: 1, name: 'Kalimdor' },
    { id: 530, name: 'Outland' },
    { id: 571, name: 'Northrend' },
    { id: 860, name: 'Pandaria' },
    { id: 870, name: 'Draenor' },
    { id: 1116, name: 'Broken Isles' },
    { id: 1220, name: 'Kul Tiras' },
    { id: 1642, name: 'Shadowlands' },
    { id: 2444, name: 'Dragon Isles' },
    { id: 2552, name: 'The War Within' }
  ];

  // Check which maps are extracted
  const results = await Promise.all(
    maps.map(async map => ({
      ...map,
      extracted: await isMapExtracted({ mapId: map.id })
    }))
  );

  return results;
}

/**
 * Delete extracted map data
 */
export async function deleteExtractedMap(args: { mapId: number }): Promise<boolean> {
  const { mapId } = args;

  try {
    const dirs = [
      path.join(process.cwd(), 'data', 'maps', 'extracted', `${mapId}`),
      path.join(process.cwd(), 'data', 'maps', 'converted', `${mapId}`),
      path.join(process.cwd(), 'web-ui', 'public', 'maps', 'tiles', `${mapId}`)
    ];

    for (const dir of dirs) {
      try {
        await fs.rm(dir, { recursive: true, force: true });
      } catch {
        // Ignore if directory doesn't exist
      }
    }

    Logger.info('MapExtraction', `Deleted extracted data for map ${mapId}`);
    return true;
  } catch (error: any) {
    Logger.error('MapExtraction', error, { mapId });
    return false;
  }
}

/**
 * Get WoW installation info
 */
export async function getWoWInstallationInfo(): Promise<{
  configured: boolean;
  path?: string;
  valid: boolean;
  autoDetected?: string;
}> {
  const configuredPath = process.env.WOW_PATH;

  if (configuredPath) {
    const valid = await CASCReader.isValidWoWPath(configuredPath);
    return {
      configured: true,
      path: configuredPath,
      valid
    };
  }

  // Try auto-detection
  const detectedPath = await CASCReader.detectWoWPath();

  return {
    configured: false,
    valid: detectedPath !== null,
    autoDetected: detectedPath || undefined
  };
}
