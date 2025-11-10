/**
 * CASC (Content Addressable Storage Container) Reader
 *
 * Reads files from World of Warcraft's CASC storage system.
 * Supports both local installation and CDN fallback.
 *
 * @module CASCReader
 */

import fs from 'fs/promises';
import path from 'path';
import { Logger } from '../lib/logger.js';
import { FileSystemError } from '../lib/errors.js';

/**
 * CASC configuration
 */
export interface CASCConfig {
  /** Path to WoW installation directory */
  wowPath: string;
  /** Locale (enUS, deDE, etc.) */
  locale?: string;
  /** Product (wow, wowt for PTR, wow_beta) */
  product?: string;
  /** Enable CDN fallback if local files missing */
  enableCDN?: boolean;
}

/**
 * CASC file info
 */
export interface CASCFileInfo {
  /** File path in CASC */
  filePath: string;
  /** File size in bytes */
  size: number;
  /** Content hash */
  hash?: string;
  /** File ID (for newer files) */
  fileId?: number;
}

/**
 * Map texture quality levels
 */
export enum MapQuality {
  /** Low quality (512x512 or smaller) */
  LOW = 'low',
  /** Medium quality (1024x1024) */
  MEDIUM = 'medium',
  /** High quality (2048x2048 or higher) */
  HIGH = 'high',
  /** All available qualities */
  ALL = 'all'
}

/**
 * CASC storage reader
 */
export class CASCReader {
  private config: Required<CASCConfig>;
  private initialized: boolean = false;
  private dataPath: string = '';
  private indicesPath: string = '';
  private configPath: string = '';

  constructor(config: CASCConfig) {
    this.config = {
      locale: 'enUS',
      product: 'wow',
      enableCDN: true,
      ...config
    };
  }

  /**
   * Initialize CASC reader
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    Logger.info('CASCReader', `Initializing CASC reader for: ${this.config.wowPath}`);

    // Verify WoW installation
    const dataDir = path.join(this.config.wowPath, 'Data');
    try {
      await fs.access(dataDir);
    } catch (error) {
      throw new FileSystemError(
        dataDir,
        'WoW Data directory not found. Please check WOW_PATH configuration.'
      );
    }

    this.dataPath = path.join(dataDir, 'data');
    this.indicesPath = path.join(dataDir, 'indices');
    this.configPath = path.join(dataDir, 'config');

    // Verify CASC structure
    try {
      await fs.access(this.dataPath);
      await fs.access(this.indicesPath);
    } catch (error) {
      throw new FileSystemError(
        dataDir,
        'Invalid CASC structure. This may not be a retail WoW installation.'
      );
    }

    this.initialized = true;
    Logger.info('CASCReader', 'CASC reader initialized successfully');
  }

  /**
   * Check if CASC reader is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Extract map textures from CASC
   *
   * @param mapId - Map ID (0 = Eastern Kingdoms, 1 = Kalimdor, etc.)
   * @param quality - Quality level(s) to extract
   * @returns Array of extracted file paths
   */
  async extractMapTextures(
    mapId: number,
    quality: MapQuality = MapQuality.ALL
  ): Promise<string[]> {
    if (!this.initialized) {
      await this.initialize();
    }

    Logger.info('CASCReader', `Extracting map textures for map ${mapId}, quality: ${quality}`);

    const extractedFiles: string[] = [];
    const mapNames = await this.getMapNames();
    const mapName = mapNames.get(mapId);

    if (!mapName) {
      throw new FileSystemError(
        `map_${mapId}`,
        `Map ID ${mapId} not found in CASC`
      );
    }

    // Extract different quality levels
    const qualities = quality === MapQuality.ALL
      ? [MapQuality.LOW, MapQuality.MEDIUM, MapQuality.HIGH]
      : [quality];

    for (const qual of qualities) {
      const files = await this.extractMapTexturesForQuality(mapId, mapName, qual);
      extractedFiles.push(...files);
    }

    Logger.info('CASCReader', `Extracted ${extractedFiles.length} map texture files`);
    return extractedFiles;
  }

  /**
   * Extract map textures for specific quality
   */
  private async extractMapTexturesForQuality(
    mapId: number,
    mapName: string,
    quality: MapQuality
  ): Promise<string[]> {
    const files: string[] = [];

    // Map texture paths in CASC follow this pattern:
    // Interface/WorldMap/{ExpansionName}/{ZoneName}/{ZoneName}{Quality}.blp
    // Textures/Minimap/md5{hash}.blp (for minimap tiles)

    const worldMapPaths = [
      `Interface/WorldMap/${mapName}`,
      `Interface/WorldMap/*/${mapName}`,
      `Textures/Minimap`
    ];

    // Quality suffix mapping
    const qualitySuffix = this.getQualitySuffix(quality);

    for (const basePath of worldMapPaths) {
      // List files in CASC directory
      const cascFiles = await this.listCASCFiles(basePath);

      for (const file of cascFiles) {
        // Filter by quality if applicable
        if (qualitySuffix && !file.includes(qualitySuffix)) {
          continue;
        }

        // Extract BLP file
        if (file.toLowerCase().endsWith('.blp')) {
          try {
            const outputPath = await this.extractFile(file, mapId, quality);
            files.push(outputPath);
          } catch (error) {
            Logger.warn('CASCReader', `Failed to extract ${file}`, { error });
          }
        }
      }
    }

    return files;
  }

  /**
   * Get quality suffix for file filtering
   */
  private getQualitySuffix(quality: MapQuality): string {
    switch (quality) {
      case MapQuality.LOW:
        return '512'; // or '1' for some maps
      case MapQuality.MEDIUM:
        return '1024'; // or '2'
      case MapQuality.HIGH:
        return '2048'; // or '3'
      default:
        return '';
    }
  }

  /**
   * List files in CASC storage by path pattern
   *
   * Note: This is a simplified implementation. Full implementation would
   * parse CASC root files and encoding tables.
   */
  private async listCASCFiles(pathPattern: string): Promise<string[]> {
    Logger.debug('CASCReader', `Listing CASC files: ${pathPattern}`);

    // TODO: Implement full CASC root file parsing
    // For now, return known map texture paths
    return this.getKnownMapTexturePaths(pathPattern);
  }

  /**
   * Get known map texture paths (fallback until full CASC parsing implemented)
   */
  private getKnownMapTexturePaths(pattern: string): string[] {
    // Common map texture patterns
    const knownPaths: string[] = [];

    if (pattern.includes('WorldMap')) {
      // Add known world map texture paths
      // These would be populated from CASC root file parsing
      knownPaths.push(
        'Interface/WorldMap/Kalimdor/Kalimdor1.blp',
        'Interface/WorldMap/Kalimdor/Kalimdor2.blp',
        'Interface/WorldMap/Azeroth/Azeroth1.blp',
        'Interface/WorldMap/Azeroth/Azeroth2.blp'
      );
    }

    return knownPaths;
  }

  /**
   * Extract a single file from CASC
   */
  private async extractFile(
    cascPath: string,
    mapId: number,
    quality: MapQuality
  ): Promise<string> {
    Logger.debug('CASCReader', `Extracting file: ${cascPath}`);

    // Output path structure
    const outputDir = path.join(
      process.cwd(),
      'data',
      'maps',
      'extracted',
      `${mapId}`,
      quality
    );

    await fs.mkdir(outputDir, { recursive: true });

    const fileName = path.basename(cascPath);
    const outputPath = path.join(outputDir, fileName);

    // Check if already extracted
    try {
      await fs.access(outputPath);
      Logger.debug('CASCReader', `File already extracted: ${outputPath}`);
      return outputPath;
    } catch {
      // File doesn't exist, extract it
    }

    // TODO: Implement actual CASC file extraction
    // For now, this is a placeholder that would:
    // 1. Look up file in CASC encoding table
    // 2. Find data in archive files
    // 3. Decompress BLTE-encoded data
    // 4. Write to output file

    throw new FileSystemError(
      cascPath,
      'CASC file extraction not yet implemented. Use external CASC extractor for now.'
    );
  }

  /**
   * Get map names mapping
   */
  private async getMapNames(): Promise<Map<number, string>> {
    // Map ID to name mapping
    // In full implementation, this would read from Map.db2
    const maps = new Map<number, string>([
      [0, 'Azeroth'], // Eastern Kingdoms
      [1, 'Kalimdor'],
      [530, 'Outland'],
      [571, 'Northrend'],
      [860, 'Pandaria'],
      [870, 'Draenor'],
      [1116, 'BrokenIsles'],
      [1220, 'KulTiras'],
      [1642, 'Shadowlands'],
      [2444, 'DragonIsles'],
      [2552, 'TheWarWithin']
    ]);

    return maps;
  }

  /**
   * Check if WoW installation path is valid
   */
  static async isValidWoWPath(wowPath: string): Promise<boolean> {
    try {
      const dataPath = path.join(wowPath, 'Data', 'data');
      await fs.access(dataPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Auto-detect WoW installation path
   */
  static async detectWoWPath(): Promise<string | null> {
    const commonPaths = [
      'C:\\Program Files (x86)\\World of Warcraft\\_retail_',
      'C:\\Program Files\\World of Warcraft\\_retail_',
      '/Applications/World of Warcraft/_retail_',
      process.env.WOW_PATH || ''
    ];

    for (const path of commonPaths) {
      if (path && await this.isValidWoWPath(path)) {
        return path;
      }
    }

    return null;
  }
}

/**
 * Singleton instance
 */
let cascReaderInstance: CASCReader | null = null;

/**
 * Get or create CASC reader instance
 */
export function getCASCReader(config?: CASCConfig): CASCReader {
  if (!cascReaderInstance) {
    if (!config) {
      throw new Error('CASC reader not initialized. Provide config on first call.');
    }
    cascReaderInstance = new CASCReader(config);
  }
  return cascReaderInstance;
}
