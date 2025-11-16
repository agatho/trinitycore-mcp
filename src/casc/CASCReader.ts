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
import { CASCListFile } from './CASCListFile.js';
import { BLTEDecompressor } from './BLTEDecompressor.js';
import { CASCStorage, CASC_LOCALE } from './CASCNative.js';

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
  private nativeStorage: CASCStorage | null = null;

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

    logger.info('CASCReader', `Initializing CASC reader for: ${this.config.wowPath}`);

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

    // Load encoding file if available (need build key first)
    let buildKey: Buffer | null = null;
    try {
      console.log('[CASCReader] Getting build key for encoding file...');
      buildKey = await this.findBuildKey();
      if (buildKey) {
        console.log('[CASCReader] Reading build config for encoding hash...');
        const encodingHash = await this.readBuildConfigForEncoding(buildKey);

        if (encodingHash) {
          console.log(`[CASCReader] Found encoding hash: ${encodingHash.toString('hex').substring(0, 16)}...`);

          // Try to extract encoding file from CASC data archives
          // The encoding hash is a content hash that should be in the index
          console.log('[CASCReader] Looking up encoding file in index...');
          const indexEntry = this.indexReader.findEntry(encodingHash);

          if (indexEntry) {
            console.log(`[CASCReader] Found encoding in archive ${indexEntry.archive} at offset ${indexEntry.offset}`);
            logger.info('CASCReader', 'Extracting CASC encoding file...');

            let encodingData = await this.dataReader.readData(
              indexEntry.archive,
              indexEntry.offset,
              indexEntry.size
            );
            console.log(`[CASCReader] Encoding file extracted: ${encodingData.length} bytes`);
            console.log(`[CASCReader] First 16 bytes: ${encodingData.subarray(0, Math.min(16, encodingData.length)).toString('hex')}`);
            console.log(`[CASCReader] First 4 bytes as ASCII: "${encodingData.toString('ascii', 0, 4)}"`);

            const entryCountBefore = this.encodingReader.getEntryCount();
            this.encodingReader.parseEncodingFile(encodingData);
            const entryCountAfter = this.encodingReader.getEntryCount();

            console.log(`[CASCReader] Encoding file parsed: ${entryCountAfter} entries (was ${entryCountBefore})`);
            logger.info('CASCReader', `Loaded ${entryCountAfter} encoding entries`);
          } else {
            console.log('[CASCReader] WARNING: Encoding file not found in index');
            logger.warn('CASCReader', 'Encoding file not found in data archives');
          }
        } else {
          console.log('[CASCReader] WARNING: Could not find encoding hash in build config');
        }
      } else {
        console.log('[CASCReader] WARNING: Build key not found');
        logger.warn('CASCReader', 'Build key not found, encoding file cannot be loaded');
      }
    } catch (error) {
      console.error('[CASCReader] ERROR loading encoding file:', error);
      logger.warn('CASCReader', 'Failed to load encoding file', { error: error as Error });
    }

    // Load listfile for FileDataID → Path mapping (required for modern WoW)
    try {
      const listFile = new CASCListFile();

      // Try multiple possible listfile locations (use forward slashes to avoid escape issues)
      const possiblePaths = [
        '/tmp/wow-listfile.csv',  // Linux/macOS temp
        'C:/temp/wow-listfile.csv',  // Windows temp (forward slashes work on Windows!)
        path.join(this.config.wowPath, 'listfile.csv')  // WoW directory
      ];

      let listFileLoaded = false;
      for (const listFilePath of possiblePaths) {
        try {
          await fs.access(listFilePath);
          console.log(`[CASCReader] Loading listfile from: ${listFilePath}`);
          await listFile.loadListFile(listFilePath);
          this.rootReader.setListFile(listFile);
          listFileLoaded = true;
          console.log(`[CASCReader] Listfile loaded successfully (${listFile.getEntryCount()} entries)`);
          break;
        } catch {
          // Try next path
        }
      }

      if (!listFileLoaded) {
        console.warn('[CASCReader] WARNING: Listfile not found. FileDataID-based files will not be accessible.');
        console.warn('[CASCReader] Download from: https://github.com/wowdev/wow-listfile/releases/latest/download/community-listfile.csv');
        logger.warn('CASCReader', 'Listfile not found - FileDataID resolution disabled');
      }
    } catch (error) {
      console.error('[CASCReader] ERROR loading listfile:', error);
      logger.warn('CASCReader', 'Failed to load listfile', { error: error as Error });
    }

    // Load root file if available (reuse buildKey from encoding step)
    try {
      if (!buildKey) {
        console.log('[CASCReader] Searching for build key in .build.info...');
        buildKey = await this.findBuildKey();
      }

      if (buildKey) {
        console.log(`[CASCReader] Found build key: ${buildKey.toString('hex').substring(0, 16)}...`);

        // Read build config to get ALL VFS root hashes (modern WoW builds have multiple VFS roots)
        console.log('[CASCReader] Reading build config for VFS roots...');
        const vfsRoots = await this.readBuildConfigForAllVFSRoots(buildKey);

        if (vfsRoots.length > 0) {
          console.log(`[CASCReader] Found ${vfsRoots.length} VFS root(s) in build config`);
          logger.info('CASCReader', `Loading ${vfsRoots.length} VFS root file(s)...`);

          // Parse each VFS root and accumulate files
          for (let i = 0; i < vfsRoots.length; i++) {
            const vfsRoot = vfsRoots[i];
            console.log(`[CASCReader] Processing VFS root ${i + 1}/${vfsRoots.length}: ${vfsRoot.name}`);
            console.log(`[CASCReader]   EKey: ${vfsRoot.eKey.toString('hex').substring(0, 16)}...`);

            try {
              const rootData = await this.extractRootFile(vfsRoot.eKey);
              if (rootData) {
                console.log(`[CASCReader]   Extracted ${rootData.length} bytes`);

                const beforeCount = this.rootReader.getFileCount();
                this.rootReader.parseRootFile(rootData, this.config.locale);
                const afterCount = this.rootReader.getFileCount();
                const addedFiles = afterCount - beforeCount;

                console.log(`[CASCReader]   Added ${addedFiles} files (total: ${afterCount})`);
              } else {
                console.log(`[CASCReader]   WARNING: Failed to extract VFS root ${vfsRoot.name}`);
              }
            } catch (error) {
              console.error(`[CASCReader]   ERROR processing VFS root ${vfsRoot.name}:`, error);
              logger.warn('CASCReader', `Failed to process VFS root ${vfsRoot.name}`, { error: error as Error });
            }
          }

          console.log(`[CASCReader] All VFS roots loaded: ${this.rootReader.getFileCount()} total files`);
          logger.info('CASCReader', `All VFS roots loaded: ${this.rootReader.getFileCount()} files`);
        } else {
          console.log('[CASCReader] WARNING: No VFS roots found in build config');
        }
      } else {
        console.log('[CASCReader] WARNING: Build key not found in .build.info');
        logger.warn('CASCReader', 'Build key not found, file path extraction will be limited');
      }
    } catch (error) {
      console.error('[CASCReader] ERROR loading root file:', error);
      logger.warn('CASCReader', 'Failed to load root file', { error: error as Error });
    }

    // Initialize native CASC storage for FileDataID lookups not in TVFS
    try {
      console.log('[CASCReader] Initializing native CASC storage for FileDataID lookups...');
      this.nativeStorage = new CASCStorage(this.config.wowPath, CASC_LOCALE.ALL_WOW);
      console.log('[CASCReader]   Native storage initialized successfully');
      logger.info('CASCReader', 'Native CASC storage initialized');
    } catch (error) {
      console.warn('[CASCReader] WARNING: Native CASC storage initialization failed');
      console.warn('[CASCReader]   FileDataID extraction will be limited to TVFS entries only');
      logger.warn('CASCReader', 'Failed to initialize native storage', { error: error as Error });
      this.nativeStorage = null;
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
   * Extract file by FileDataID
   *
   * @param fileDataId - FileDataID of the file to extract
   * @returns File data as Buffer
   */
  async getFileByID(fileDataId: number): Promise<Buffer> {
    if (!this.initialized || !this.indexReader || !this.dataReader || !this.rootReader) {
      throw new DatabaseError('CASC reader not initialized');
    }

    // TVFS root stores files as "$fid:XXXXX" - try that first
    const fidPath = `$fid:${fileDataId}`;
    let contentHash = this.rootReader.findByPath(fidPath);

    // If not found by FID, try looking up the actual path in listfile
    if (!contentHash) {
      const listFile = this.rootReader.getListFile();
      if (listFile) {
        const filePath = listFile.getPath(fileDataId);
        if (filePath) {
          contentHash = this.rootReader.findByPath(filePath);
        }
      }
    }

    // If not found in TVFS, try native storage as fallback
    if (!contentHash) {
      if (this.nativeStorage && this.nativeStorage.isOpen()) {
        logger.debug(`FileDataID ${fileDataId} not in TVFS, trying native CASC storage...`);
        try {
          const buffer = await this.nativeStorage.extractFileByID(fileDataId);
          logger.info(`Successfully extracted FileDataID ${fileDataId} using native storage (${buffer.length} bytes)`);
          return buffer;
        } catch (error) {
          throw new DatabaseError(
            `FileDataID ${fileDataId} not found in CASC: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
        }
      } else {
        throw new DatabaseError(
          `FileDataID ${fileDataId} not found in TVFS root (native storage not available)`
        );
      }
    }

    // Look up encoding key if available
    let lookupHash = contentHash;
    if (this.encodingReader) {
      const encodingKey = this.encodingReader.getEncodingKey(contentHash);
      if (encodingKey) {
        lookupHash = encodingKey;
      }
    }

    // Find data location in index
    const indexEntry = this.indexReader.findEntry(lookupHash);
    if (!indexEntry) {
      throw new DatabaseError(`FileDataID ${fileDataId} not found in CASC index`);
    }

    // Read and decompress data
    const data = await this.dataReader.readData(
      indexEntry.archive,
      indexEntry.offset,
      indexEntry.size
    );

    return data;
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

    logger.info('CASCReader', `Extracting map textures for map ${mapId}, quality: ${quality}`);

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

    logger.info('CASCReader', `Extracted ${extractedFiles.length} map texture files`);
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

    // Map texture paths in CASC follow this pattern (modern WoW 11.x):
    // world/minimaps/{zonename}/*.blp - Minimap tiles (map##_##.blp format)
    // world/maptextures/{zonename}/*.blp - High-res map textures
    // world/maps/{zonename}/*.adt - Terrain/ADT files

    const worldMapPaths = [
      `world/minimaps/${mapName}/*.blp`,       // Minimap tiles (primary)
      `world/maptextures/${mapName}/*.blp`,    // Map textures (if available)
      `world/maps/${mapName}/*.adt`            // Terrain data (ADT files)
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
            logger.warn('CASCReader', `Failed to extract ${file}`, { error });
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
    console.log(`[CASCReader] Listing CASC files with pattern: ${pathPattern}`);
    logger.info('CASCReader', `Listing CASC files with pattern: ${pathPattern}`);

    // If root file is loaded, use it to list files
    if (this.rootReader) {
      const files = this.rootReader.listFiles(pathPattern);
      console.log(`[CASCReader] Found ${files.length} files matching ${pathPattern} in root`);
      logger.info('CASCReader', `Found ${files.length} files matching ${pathPattern} in root`);

      // Log first few matches for debugging
      if (files.length > 0) {
        const sample = files.slice(0, 5);
        console.log(`[CASCReader] Sample matches:`, sample);
        logger.info('CASCReader', `Sample matches: ${sample.join(', ')}`);
      } else {
        // If no matches, log some root file entries for debugging
        const totalFiles = this.rootReader.getFileCount();
        console.log(`[CASCReader] WARNING: No matches found. Root file contains ${totalFiles} total files`);
        logger.warn('CASCReader', `No matches found. Root file contains ${totalFiles} total files`);

        // Log some example paths from root to help diagnose
        const allFiles = this.rootReader.listFiles('*');
        console.log(`[CASCReader] Root file has ${allFiles.length} total entries when matching '*'`);

        if (allFiles.length > 0) {
          // Show first 20 paths to understand structure
          console.log(`[CASCReader] First 20 paths in root file:`, allFiles.slice(0, 20));

          const interfaceSample = allFiles.filter(f => f.toLowerCase().includes('interface')).slice(0, 5);
          const textureSample = allFiles.filter(f => f.toLowerCase().includes('texture')).slice(0, 5);
          const blpSample = allFiles.filter(f => f.toLowerCase().endsWith('.blp')).slice(0, 10);
          const mapSample = allFiles.filter(f => f.toLowerCase().includes('map')).slice(0, 10);

          console.log(`[CASCReader] Sample Interface paths (${interfaceSample.length}):`, interfaceSample);
          console.log(`[CASCReader] Sample Texture paths (${textureSample.length}):`, textureSample);
          console.log(`[CASCReader] Sample .blp paths (${blpSample.length}):`, blpSample.slice(0, 5));
          console.log(`[CASCReader] Sample map paths (${mapSample.length}):`, mapSample.slice(0, 5));

          logger.info('CASCReader', `Sample Interface paths: ${interfaceSample.join(', ')}`);
          logger.info('CASCReader', `Sample Texture paths: ${textureSample.join(', ')}`);
        }
      }

      return files;
    }

    // Fallback to known paths
    console.log('[CASCReader] WARNING: Root file not loaded, using known paths fallback');
    logger.warn('CASCReader', 'Root file not loaded, using known paths fallback');
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
      logger.debug('CASCReader', `File already extracted: ${outputPath}`);
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
   * Read build config file and extract encoding hash
   *
   * @param buildKey - Build key hash from .build.info
   * @returns Encoding file hash(es) from build config - returns encoding key (second hash)
   */
  private async readBuildConfigForEncoding(buildKey: Buffer): Promise<Buffer | null> {
    try {
      const buildConfigPath = this.getBuildConfigPath(buildKey);

      // Read build config file
      const configContent = await fs.readFile(buildConfigPath, 'utf8');

      // Parse config file (key = value format)
      const lines = configContent.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('encoding = ')) {
          const hashes = trimmed.substring(11).trim().split(' ');
          const contentHash = hashes[0]; // First hash = content hash
          const encodingKey = hashes[1]; // Second hash = encoding key
          console.log(`[CASCReader] Found encoding entry: content=${contentHash}, key=${encodingKey}`);

          // Try the encoding key (second hash) for direct index lookup
          if (encodingKey && encodingKey.length === 32) {
            console.log(`[CASCReader] Using encoding key for lookup: ${encodingKey}`);
            return Buffer.from(encodingKey, 'hex');
          } else if (contentHash && contentHash.length === 32) {
            console.log(`[CASCReader] Falling back to content hash: ${contentHash}`);
            return Buffer.from(contentHash, 'hex');
          }
        }
      }

      console.log('[CASCReader] WARNING: No encoding entry found in build config');
      return null;
    } catch (error) {
      console.error('[CASCReader] ERROR reading build config for encoding:', error);
      return null;
    }
  }

  /**
   * Read build config file and extract root hash
   *
   * @param buildKey - Build key hash from .build.info
   * @returns Root file hash from build config
   */
  private async readBuildConfigForRoot(buildKey: Buffer): Promise<Buffer | null> {
    try {
      const buildConfigPath = this.getBuildConfigPath(buildKey);
      console.log(`[CASCReader] Reading build config from: ${buildConfigPath}`);

      // Read build config file
      const configContent = await fs.readFile(buildConfigPath, 'utf8');
      console.log(`[CASCReader] Build config size: ${configContent.length} bytes`);

      // Parse config file (key = value format)
      // Modern builds use vfs-root with format: vfs-root = <CKey> <EKey>
      // Legacy builds use root with format: root = <hash>
      const lines = configContent.split('\n');

      let vfsRootEKey: string | null = null;
      let legacyRootHash: string | null = null;

      for (const line of lines) {
        const trimmed = line.trim();

        // Debug: log lines that look like root entries
        if (trimmed.includes('root')) {
          console.log(`[CASCReader] Found root-related line: "${trimmed}"`);
        }

        // Check for modern VFS root (has CKey and EKey)
        if (trimmed.startsWith('vfs-root = ')) {
          const hashes = trimmed.substring(11).trim().split(/\s+/);
          if (hashes.length >= 2) {
            const cKey = hashes[0];
            const eKey = hashes[1];
            console.log(`[CASCReader] Found VFS root entry: CKey=${cKey}, EKey=${eKey}`);

            if (eKey.length === 32) {
              vfsRootEKey = eKey;
            }
          }
        }

        // Collect legacy root entry as fallback
        if (trimmed.startsWith('root = ')) {
          const rootHashStr = trimmed.substring(7).trim();
          console.log(`[CASCReader] Found legacy root entry: ${rootHashStr}`);

          if (rootHashStr.length === 32) {
            legacyRootHash = rootHashStr;
          }
        }
      }

      // Prefer VFS root over legacy root
      if (vfsRootEKey) {
        console.log(`[CASCReader] Using VFS root EKey directly: ${vfsRootEKey}`);
        return Buffer.from(vfsRootEKey, 'hex');
      } else if (legacyRootHash) {
        console.log(`[CASCReader] Using legacy root hash: ${legacyRootHash}`);
        return Buffer.from(legacyRootHash, 'hex');
      }

      console.log('[CASCReader] WARNING: No root or vfs-root entry found in build config');
      return null;
    } catch (error) {
      console.error('[CASCReader] ERROR reading build config:', error);
      return null;
    }
  }

  /**
   * Helper method to get build config file path
   *
   * @param buildKey - Build key hash from .build.info
   * @returns Path to build config file
   */
  private getBuildConfigPath(buildKey: Buffer): string {
    const hashStr = buildKey.toString('hex');
    return path.join(
      this.configPath,
      hashStr.substring(0, 2),
      hashStr.substring(2, 4),
      hashStr
    );
  }

  /**
   * Read build config file and extract ALL VFS root hashes
   *
   * Modern WoW builds have multiple VFS roots:
   * - vfs-root: Primary root with core files
   * - vfs-1, vfs-2, vfs-3, vfs-4: Additional content roots
   *
   * Each has format: vfs-{name} = <CKey> <EKey>
   *
   * @param buildKey - Build key hash from .build.info
   * @returns Array of VFS roots with name and EKey
   */
  private async readBuildConfigForAllVFSRoots(buildKey: Buffer): Promise<Array<{name: string, eKey: Buffer}>> {
    try {
      const buildConfigPath = this.getBuildConfigPath(buildKey);
      console.log(`[CASCReader] Reading build config for all VFS roots: ${buildConfigPath}`);

      // Read build config file
      const configContent = await fs.readFile(buildConfigPath, 'utf8');
      const lines = configContent.split('\n');
      const vfsRoots: Array<{name: string, eKey: Buffer}> = [];

      // Parse all vfs-* entries
      for (const line of lines) {
        const trimmed = line.trim();

        // Match any line starting with vfs- (vfs-root, vfs-1, vfs-2, etc.)
        // Format: vfs-{name} = <CKey> <EKey>
        // Exclude metadata entries like vfs-root-size, vfs-1-size, etc.
        const match = trimmed.match(/^(vfs-(?:root|\d+))\s*=\s*([0-9a-f]+)\s+([0-9a-f]+)/i);

        if (match) {
          const [_, name, cKey, eKey] = match;
          console.log(`[CASCReader]   Found ${name}: CKey=${cKey}, EKey=${eKey}`);

          // Validate EKey is 32 hex chars (16 bytes)
          if (eKey.length === 32) {
            vfsRoots.push({
              name,
              eKey: Buffer.from(eKey, 'hex')
            });
          } else {
            console.warn(`[CASCReader]   WARNING: Invalid EKey length for ${name}: ${eKey.length}`);
          }
        }
      }

      console.log(`[CASCReader] Found ${vfsRoots.length} VFS root(s) in build config`);
      return vfsRoots;
    } catch (error) {
      console.error('[CASCReader] ERROR reading build config for VFS roots:', error);
      return [];
    }
  }

  /**
   * Find build key in .build.info file
   *
   * The build key points to a build config file which contains the actual root hash
   */
  private async findBuildKey(): Promise<Buffer | null> {
    try {
      const buildInfoPath = path.join(this.config.wowPath, '.build.info');

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

      // First line is header with column names (format: "Name!TYPE:size")
      const headerLine = lines[0];
      console.log(`[CASCReader] .build.info header: ${headerLine.substring(0, 200)}...`);

      const headers = headerLine.split('|').map(h => h.split('!')[0]); // Extract just the name part
      console.log(`[CASCReader] Parsed headers:`, headers);

      // Modern .build.info files use "Build Key" instead of "Root"
      let rootIndex = headers.indexOf('Root');
      if (rootIndex === -1) {
        rootIndex = headers.indexOf('Build Key');
        console.log(`[CASCReader] No 'Root' column found, trying 'Build Key' at index ${rootIndex}`);
      }

      if (rootIndex === -1) {
        console.log('[CASCReader] WARNING: Neither Root nor Build Key column found in .build.info');
        logger.warn('CASCReader', 'Root/Build Key column not found in .build.info');
        return null;
      }

      const productIndex = headers.indexOf('Product');
      console.log(`[CASCReader] Product column at index ${productIndex}`);

      // Find the row for our product (wow, wowt, etc.)
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split('|');
        const productValue = productIndex >= 0 ? (values[productIndex] || '') : '';

        console.log(`[CASCReader] Row ${i}: Product='${productValue}', looking for '${this.config.product}'`);

        if (productValue === this.config.product) {
          const rootHash = values[rootIndex];
          console.log(`[CASCReader] Found matching product row, root/build hash: ${rootHash}`);

          if (rootHash && rootHash.length === 32) {
            logger.debug('CASCReader', `Found root hash: ${rootHash}`);
            return Buffer.from(rootHash, 'hex');
          }
        }
      }

      // If we didn't find a matching product, use the last (most recent) entry
      console.log('[CASCReader] No matching product found, using most recent entry');
      const lastLine = lines[lines.length - 1];
      const values = lastLine.split('|');
      const rootHash = values[rootIndex];

      console.log(`[CASCReader] Most recent hash: ${rootHash}`);

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
   * @param contentHash - Content hash of root file (or build manifest hash in modern CASC)
   * @returns Root file data or null if extraction fails
   */
  private async extractRootFile(hash: Buffer): Promise<Buffer | null> {
    try {
      console.log(`[CASCReader] Extracting root file with hash: ${hash.toString('hex')}`);

      if (!this.indexReader || !this.encodingReader || !this.dataReader) {
        throw new Error('CASC readers not initialized');
      }

      let encodingKey: Buffer | null = null;

      // Try as EKey first (for VFS root)
      console.log('[CASCReader] Trying hash as EKey (VFS root)...');
      let indexEntry = this.indexReader.findEntry(hash);

      if (indexEntry) {
        console.log('[CASCReader] Hash is an EKey! Found directly in index (VFS root)');
        encodingKey = hash;
      } else {
        // Try as CKey (legacy root) - look up in encoding table
        console.log('[CASCReader] Not found as EKey, trying as CKey (legacy root)...');
        encodingKey = this.encodingReader.getEncodingKey(hash);

        if (!encodingKey) {
          console.log('[CASCReader] WARNING: Root file not found in encoding table or index');
          console.log('[CASCReader] This may be a build manifest hash, not a direct root hash');
          logger.warn('CASCReader', 'Root file not found in encoding table or index');
          return null;
        }

        console.log(`[CASCReader] Found encoding key from CKey: ${encodingKey.toString('hex').substring(0, 16)}...`);

        // Find data location in index using the EKey
        console.log('[CASCReader] Looking up index entry with EKey...');
        indexEntry = this.indexReader.findEntry(encodingKey);

        if (!indexEntry) {
          console.log('[CASCReader] WARNING: Root file not found in index');
          logger.warn('CASCReader', 'Root file not found in index');
          return null;
        }
      }

      console.log(`[CASCReader] Found in archive ${indexEntry.archive} at offset ${indexEntry.offset}, size ${indexEntry.size}`);

      // Read and decompress data
      logger.debug('CASCReader', `Extracting root file from archive ${indexEntry.archive}`);
      const rootData = await this.dataReader.readData(
        indexEntry.archive,
        indexEntry.offset,
        indexEntry.size
      );

      console.log(`[CASCReader] Successfully extracted root file (${rootData.length} bytes)`);
      return rootData;
    } catch (error) {
      console.error('[CASCReader] ERROR extracting root file:', error);
      logger.warn('CASCReader', 'Failed to extract root file', { error: error as Error });
      return null;
    }
  }

  /**
   * Get map names mapping
   */
  private async getMapNames(): Promise<Map<number, string>> {
    // Map ID to folder name mapping (must match CASC folder names - lowercase!)
    // In full implementation, this would read from Map.db2
    const maps = new Map<number, string>([
      [0, 'azeroth'], // Eastern Kingdoms (lowercase!)
      [1, 'kalimdor'],
      [530, 'outland'],
      [571, 'northrend'],
      [860, 'pandaria'],
      [870, 'draenor'],
      [1116, 'brokenisles'],
      [1220, 'kultiras'],
      [1642, 'shadowlands'],
      [2444, 'dragonisles'],
      [2552, 'thewarwithin']
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
