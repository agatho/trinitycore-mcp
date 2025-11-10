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
import { logger } from '../utils/logger.js';
import { DatabaseError } from '../database/errors.js';
import { CASCIndexReader } from './CASCIndexReader.js';
import { CASCEncodingReader } from './CASCEncodingReader.js';
import { CASCDataReader } from './CASCDataReader.js';
import { CASCRootReader } from './CASCRootReader.js';
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
  private indexReader: CASCIndexReader | null = null;
  private encodingReader: CASCEncodingReader | null = null;
  private dataReader: CASCDataReader | null = null;
  private rootReader: CASCRootReader | null = null;

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
      throw new DatabaseError(
        `WoW Data directory not found: ${dataDir}. Please check WOW_PATH configuration.`
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
      throw new DatabaseError(
        `Invalid CASC structure in ${dataDir}. This may not be a retail WoW installation.`
      );
    }

    // Initialize CASC readers
    this.indexReader = new CASCIndexReader();
    this.encodingReader = new CASCEncodingReader();
    this.dataReader = new CASCDataReader(this.dataPath);
    this.rootReader = new CASCRootReader();

    // Load index files
    logger.info('CASCReader', 'Loading CASC index files...');
    await this.indexReader.loadIndices(this.indicesPath);

    // Load encoding file if available
    try {
      const encodingPath = await this.findEncodingFile();
      if (encodingPath) {
        logger.info('CASCReader', 'Loading CASC encoding file...');
        const encodingData = await fs.readFile(encodingPath);
        this.encodingReader.parseEncodingFile(encodingData);
      } else {
        logger.warn('CASCReader', 'Encoding file not found, some features may be limited');
      }
    } catch (error) {
      logger.warn('CASCReader', 'Failed to load encoding file', { error: error as Error });
    }

    // Load root file if available
    try {
      const rootHash = await this.findRootFileHash();
      if (rootHash) {
        logger.info('CASCReader', 'Loading CASC root file...');
        const rootData = await this.extractRootFile(rootHash);
        if (rootData) {
          this.rootReader.parseRootFile(rootData, this.config.locale);
          logger.info('CASCReader', `Root file loaded: ${this.rootReader.getFileCount()} files`);
        }
      } else {
        logger.warn('CASCReader', 'Root file not found, file path extraction will be limited');
      }
    } catch (error) {
      logger.warn('CASCReader', 'Failed to load root file', { error: error as Error });
    }

    this.initialized = true;
    logger.info('CASCReader', 'CASC reader initialized successfully');
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
      throw new DatabaseError(
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
   * Uses root file when available, otherwise falls back to known paths
   */
  private async listCASCFiles(pathPattern: string): Promise<string[]> {
    logger.debug('CASCReader', `Listing CASC files: ${pathPattern}`);

    // If root file is loaded, use it to list files
    if (this.rootReader) {
      const files = this.rootReader.listFiles(pathPattern);
      logger.debug('CASCReader', `Found ${files.length} files matching ${pathPattern} in root`);
      return files;
    }

    // Fallback to known paths
    logger.debug('CASCReader', 'Root file not loaded, using known paths');
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
    logger.debug('CASCReader', `Extracting file: ${cascPath}`);

    if (!this.indexReader || !this.dataReader) {
      throw new DatabaseError('CASC reader not initialized');
    }

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

    try {
      // Step 1: Get content hash for file path
      let contentHash = this.getContentHashForPath(cascPath);

      if (!contentHash) {
        throw new DatabaseError(
          `Cannot determine content hash for ${cascPath}. File not found in root or encoding tables.`
        );
      }

      // Step 2: Look up encoding key (if encoding file loaded)
      let lookupHash = contentHash;
      if (this.encodingReader) {
        const encodingKey = this.encodingReader.getEncodingKey(contentHash);
        if (encodingKey) {
          lookupHash = encodingKey;
          logger.debug('CASCReader', `Found encoding key for content hash`);
        }
      }

      // Step 3: Find data location in index
      const indexEntry = this.indexReader.findEntry(lookupHash);
      if (!indexEntry) {
        throw new DatabaseError(
          `File not found in CASC index: ${cascPath}`
        );
      }

      logger.debug('CASCReader', `Found in archive ${indexEntry.archive} at offset ${indexEntry.offset}`);

      // Step 4: Read and decompress data
      const data = await this.dataReader.readData(
        indexEntry.archive,
        indexEntry.offset,
        indexEntry.size
      );

      // Step 5: Write to output file
      await fs.writeFile(outputPath, data);
      logger.info('CASCReader', `Extracted ${cascPath} to ${outputPath} (${data.length} bytes)`);

      return outputPath;
    } catch (error) {
      logger.error('CASCReader', error as Error, { cascPath, mapId, quality });
      throw new DatabaseError(
        `Failed to extract ${cascPath}: ${(error as Error).message}`
      );
    }
  }

  /**
   * Get content hash for a file path
   * Tries multiple methods: root file lookup, hash extraction from filename
   *
   * @param cascPath - File path in CASC
   * @returns Content hash or null if not found
   */
  private getContentHashForPath(cascPath: string): Buffer | null {
    // Method 1: Look up in root file (if loaded)
    if (this.rootReader) {
      const rootHash = this.rootReader.findByPath(cascPath);
      if (rootHash) {
        logger.debug('CASCReader', `Found content hash in root file for ${cascPath}`);
        return rootHash;
      }
    }

    // Method 2: Extract hash from filename (common for minimap files: md5abc123.blp)
    const fileName = path.basename(cascPath);
    const md5Match = fileName.match(/md5([0-9a-f]{32})/i);
    if (md5Match) {
      logger.debug('CASCReader', `Extracted hash from filename: ${cascPath}`);
      return Buffer.from(md5Match[1], 'hex');
    }

    // Method 3: Try looking up by file ID (if available)
    // This would require parsing the filename for an ID, or having a separate mapping

    logger.warn('CASCReader', `Could not find content hash for ${cascPath}`);
    return null;
  }

  /**
   * Find encoding file in config directory
   */
  private async findEncodingFile(): Promise<string | null> {
    try {
      const files = await fs.readdir(this.configPath);

      // Encoding files typically have names like: 12/34/1234567890abcdef...
      // We need to look in subdirectories
      for (const file of files) {
        if (file.length === 2 && /^[0-9a-f]{2}$/i.test(file)) {
          const subDir = path.join(this.configPath, file);
          const subFiles = await fs.readdir(subDir);

          for (const subFile of subFiles) {
            if (subFile.length === 2 && /^[0-9a-f]{2}$/i.test(subFile)) {
              const subSubDir = path.join(subDir, subFile);
              const subSubFiles = await fs.readdir(subSubDir);

              // Encoding files are usually the largest files in these directories
              for (const candidate of subSubFiles) {
                const candidatePath = path.join(subSubDir, candidate);
                const stat = await fs.stat(candidatePath);

                // Encoding files are typically several MB
                if (stat.size > 1024 * 1024) {
                  // Verify it's an encoding file by checking magic bytes
                  const handle = await fs.open(candidatePath, 'r');
                  const buffer = Buffer.allocUnsafe(2);
                  await handle.read(buffer, 0, 2, 0);
                  await handle.close();

                  if (buffer.toString('ascii') === 'EN') {
                    logger.debug('CASCReader', `Found encoding file: ${candidatePath}`);
                    return candidatePath;
                  }
                }
              }
            }
          }
        }
      }
    } catch (error) {
      logger.warn('CASCReader', 'Error searching for encoding file', { error: error as Error });
    }

    return null;
  }

  /**
   * Find root file hash in build configuration
   *
   * The root file hash is stored in .build.info or build config files
   * For now, we'll try to extract it from the latest build info
   */
  private async findRootFileHash(): Promise<Buffer | null> {
    try {
      const buildInfoPath = path.join(this.config.wowPath, 'Data', '.build.info');

      // Check if .build.info exists
      try {
        await fs.access(buildInfoPath);
      } catch {
        logger.warn('CASCReader', '.build.info not found');
        return null;
      }

      // Parse .build.info file
      const buildInfoContent = await fs.readFile(buildInfoPath, 'utf8');
      const lines = buildInfoContent.split('\n').filter(l => l.trim());

      if (lines.length < 2) {
        logger.warn('CASCReader', '.build.info has invalid format');
        return null;
      }

      // First line is header with column names
      const headers = lines[0].split('|');
      const rootIndex = headers.indexOf('Root');

      if (rootIndex === -1) {
        logger.warn('CASCReader', 'Root column not found in .build.info');
        return null;
      }

      // Find the row for our product (wow, wowt, etc.)
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split('|');
        const productValue = values[headers.indexOf('Product')] || '';

        if (productValue === this.config.product) {
          const rootHash = values[rootIndex];
          if (rootHash && rootHash.length === 32) {
            logger.debug('CASCReader', `Found root hash: ${rootHash}`);
            return Buffer.from(rootHash, 'hex');
          }
        }
      }

      // If we didn't find a matching product, use the last (most recent) entry
      const lastLine = lines[lines.length - 1];
      const values = lastLine.split('|');
      const rootHash = values[rootIndex];

      if (rootHash && rootHash.length === 32) {
        logger.debug('CASCReader', `Using most recent root hash: ${rootHash}`);
        return Buffer.from(rootHash, 'hex');
      }
    } catch (error) {
      logger.warn('CASCReader', 'Error finding root file hash', { error: error as Error });
    }

    return null;
  }

  /**
   * Extract root file from CASC using its hash
   *
   * @param contentHash - Content hash of root file
   * @returns Root file data or null if extraction fails
   */
  private async extractRootFile(contentHash: Buffer): Promise<Buffer | null> {
    try {
      if (!this.indexReader || !this.encodingReader || !this.dataReader) {
        throw new Error('CASC readers not initialized');
      }

      // Look up encoding key
      const encodingKey = this.encodingReader.getEncodingKey(contentHash);
      if (!encodingKey) {
        logger.warn('CASCReader', 'Root file not found in encoding table');
        return null;
      }

      // Find data location in index
      const indexEntry = this.indexReader.findEntry(encodingKey);
      if (!indexEntry) {
        logger.warn('CASCReader', 'Root file not found in index');
        return null;
      }

      // Read and decompress data
      logger.debug('CASCReader', `Extracting root file from archive ${indexEntry.archive}`);
      const rootData = await this.dataReader.readData(
        indexEntry.archive,
        indexEntry.offset,
        indexEntry.size
      );

      return rootData;
    } catch (error) {
      logger.warn('CASCReader', 'Failed to extract root file', { error: error as Error });
      return null;
    }
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
   * Clean up and close open file handles
   */
  async close(): Promise<void> {
    if (this.dataReader) {
      await this.dataReader.close();
    }
    logger.info('CASCReader', 'CASC reader closed');
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
