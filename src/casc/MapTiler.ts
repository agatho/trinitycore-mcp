/**
 * Map Tiler
 *
 * Tiles large map images into smaller chunks for efficient web display.
 * Supports multiple zoom levels and viewport-based loading.
 *
 * @module MapTiler
 */

import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import { logger } from '../utils/logger.js';
import { DatabaseError } from '../database/errors.js';

/**
 * Tiling options
 */
export interface TilingOptions {
  /** Tile size in pixels (default: 256) */
  tileSize?: number;
  /** Generate multiple zoom levels */
  generateZoomLevels?: boolean;
  /** Compression level (0-9, higher = smaller file) */
  compressionLevel?: number;
  /** Output format (png, webp, jpg) */
  format?: 'png' | 'webp' | 'jpg';
  /** JPEG/WebP quality (1-100) */
  quality?: number;
}

/**
 * Tile metadata
 */
export interface TileMetadata {
  /** Original image width */
  originalWidth: number;
  /** Original image height */
  originalHeight: number;
  /** Tile size in pixels */
  tileSize: number;
  /** Number of columns */
  cols: number;
  /** Number of rows */
  rows: number;
  /** Total number of tiles */
  totalTiles: number;
  /** Available zoom levels */
  zoomLevels?: number[];
  /** Output format */
  format: string;
}

/**
 * Tile coordinates
 */
export interface TileCoord {
  col: number;
  row: number;
  zoom: number;
}

/**
 * Map tiler for creating web-friendly map tiles
 */
export class MapTiler {
  private options: Required<TilingOptions>;

  constructor(options: TilingOptions = {}) {
    this.options = {
      tileSize: 256,
      generateZoomLevels: true,
      compressionLevel: 9,
      format: 'webp',
      quality: 85,
      ...options
    };
  }

  /**
   * Tile a single map image
   *
   * @param inputPath - Path to source image
   * @param outputDir - Output directory for tiles
   * @returns Tile metadata
   */
  async tileImage(inputPath: string, outputDir: string): Promise<TileMetadata> {
    logger.info('MapTiler', `Tiling image: ${inputPath}`);

    // Create output directory
    await fs.mkdir(outputDir, { recursive: true });

    // Get image metadata
    const image = sharp(inputPath);
    const metadata = await image.metadata();

    if (!metadata.width || !metadata.height) {
      throw new DatabaseError(`Could not read image dimensions for ${inputPath}`);
    }

    const { width, height } = metadata;
    const { tileSize } = this.options;

    // Calculate grid dimensions
    const cols = Math.ceil(width / tileSize);
    const rows = Math.ceil(height / tileSize);
    const totalTiles = cols * rows;

    logger.info(
      'MapTiler',
      `Image size: ${width}x${height}, Grid: ${cols}x${rows} (${totalTiles} tiles)`
    );

    // Generate base zoom level (zoom 0 = full resolution)
    await this.generateZoomLevel(inputPath, outputDir, 0, width, height);

    // Generate additional zoom levels if enabled
    const zoomLevels = [0];
    if (this.options.generateZoomLevels) {
      const maxZoom = this.calculateMaxZoomLevels(width, height);
      for (let zoom = 1; zoom <= maxZoom; zoom++) {
        await this.generateZoomLevel(inputPath, outputDir, zoom, width, height);
        zoomLevels.push(zoom);
      }
    }

    // Create metadata
    const tileMetadata: TileMetadata = {
      originalWidth: width,
      originalHeight: height,
      tileSize,
      cols,
      rows,
      totalTiles,
      zoomLevels,
      format: this.options.format
    };

    // Save metadata
    await this.saveMetadata(outputDir, tileMetadata);

    logger.info('MapTiler', `Tiling complete: ${totalTiles} tiles generated`);
    return tileMetadata;
  }

  /**
   * Generate tiles for a specific zoom level
   */
  private async generateZoomLevel(
    inputPath: string,
    outputDir: string,
    zoom: number,
    originalWidth: number,
    originalHeight: number
  ): Promise<void> {
    const scale = Math.pow(2, -zoom); // zoom 0 = 1.0, zoom 1 = 0.5, zoom 2 = 0.25
    const scaledWidth = Math.floor(originalWidth * scale);
    const scaledHeight = Math.floor(originalHeight * scale);

    logger.debug(
      'MapTiler',
      `Generating zoom level ${zoom}: ${scaledWidth}x${scaledHeight}`
    );

    // Resize image for this zoom level
    const resized = sharp(inputPath).resize(scaledWidth, scaledHeight, {
      kernel: sharp.kernel.lanczos3
    });

    // Calculate grid for this zoom level
    const { tileSize } = this.options;
    const cols = Math.ceil(scaledWidth / tileSize);
    const rows = Math.ceil(scaledHeight / tileSize);

    // Create zoom directory
    const zoomDir = path.join(outputDir, `${zoom}`);
    await fs.mkdir(zoomDir, { recursive: true });

    // Generate tiles
    const tiles: Promise<void>[] = [];

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const tilePromise = this.generateTile(
          resized,
          zoomDir,
          col,
          row,
          scaledWidth,
          scaledHeight
        );
        tiles.push(tilePromise);
      }
    }

    await Promise.all(tiles);
    logger.debug('MapTiler', `Zoom level ${zoom} complete: ${cols}x${rows} tiles`);
  }

  /**
   * Generate a single tile
   */
  private async generateTile(
    image: sharp.Sharp,
    outputDir: string,
    col: number,
    row: number,
    imageWidth: number,
    imageHeight: number
  ): Promise<void> {
    const { tileSize, format, compressionLevel, quality } = this.options;

    const left = col * tileSize;
    const top = row * tileSize;

    // Don't exceed image bounds
    const width = Math.min(tileSize, imageWidth - left);
    const height = Math.min(tileSize, imageHeight - top);

    const tilePath = path.join(outputDir, `${col}_${row}.${format}`);

    // Extract and save tile
    const tile = image.clone().extract({ left, top, width, height });

    // Apply format-specific options
    if (format === 'png') {
      await tile.png({ compressionLevel }).toFile(tilePath);
    } else if (format === 'webp') {
      await tile.webp({ quality, effort: 6 }).toFile(tilePath);
    } else if (format === 'jpg') {
      await tile.jpeg({ quality }).toFile(tilePath);
    }
  }

  /**
   * Calculate maximum useful zoom levels
   */
  private calculateMaxZoomLevels(width: number, height: number): number {
    const { tileSize } = this.options;

    // Keep zooming out until image fits in a single tile
    let zoom = 0;
    while (Math.max(width, height) / Math.pow(2, zoom + 1) > tileSize) {
      zoom++;
    }

    return Math.min(zoom, 5); // Cap at zoom level 5 (1/32 scale)
  }

  /**
   * Save tile metadata
   */
  private async saveMetadata(outputDir: string, metadata: TileMetadata): Promise<void> {
    const metadataPath = path.join(outputDir, 'metadata.json');
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
  }

  /**
   * Load tile metadata
   */
  static async loadMetadata(tilesDir: string): Promise<TileMetadata> {
    const metadataPath = path.join(tilesDir, 'metadata.json');
    const data = await fs.readFile(metadataPath, 'utf-8');
    return JSON.parse(data);
  }

  /**
   * Get required tiles for viewport
   *
   * @param metadata - Tile metadata
   * @param viewport - Viewport bounds {left, top, right, bottom}
   * @param zoom - Zoom level
   * @param padding - Extra tiles to load around viewport (default: 1)
   * @returns Array of tile coordinates to load
   */
  static getViewportTiles(
    metadata: TileMetadata,
    viewport: { left: number; top: number; right: number; bottom: number },
    zoom: number = 0,
    padding: number = 1
  ): TileCoord[] {
    const { tileSize } = metadata;
    const scale = Math.pow(2, -zoom);

    // Convert viewport to tile coordinates
    const startCol = Math.max(0, Math.floor(viewport.left / (tileSize * scale)) - padding);
    const endCol = Math.min(
      metadata.cols - 1,
      Math.ceil(viewport.right / (tileSize * scale)) + padding
    );
    const startRow = Math.max(0, Math.floor(viewport.top / (tileSize * scale)) - padding);
    const endRow = Math.min(
      metadata.rows - 1,
      Math.ceil(viewport.bottom / (tileSize * scale)) + padding
    );

    const tiles: TileCoord[] = [];

    for (let row = startRow; row <= endRow; row++) {
      for (let col = startCol; col <= endCol; col++) {
        tiles.push({ col, row, zoom });
      }
    }

    return tiles;
  }

  /**
   * Batch tile multiple maps
   */
  async tileMultipleMaps(
    inputMaps: Array<{ path: string; mapId: number }>,
    baseOutputDir: string
  ): Promise<Map<number, TileMetadata>> {
    const results = new Map<number, TileMetadata>();

    for (const { path: inputPath, mapId } of inputMaps) {
      try {
        const outputDir = path.join(baseOutputDir, `${mapId}`);
        const metadata = await this.tileImage(inputPath, outputDir);
        results.set(mapId, metadata);
      } catch (error) {
        logger.error('MapTiler', error, { mapId, inputPath });
      }
    }

    return results;
  }
}
