/**
 * CASC Root File Reader
 *
 * Parses CASC root files to map file paths to content hashes.
 * Supports multiple root file formats used across WoW versions.
 *
 * Root files provide the critical mapping from human-readable file paths
 * (e.g., "Interface/WorldMap/Azeroth/Azeroth1.blp") to content keys (MD5 hashes)
 * that can be looked up in the encoding and index files.
 *
 * @module casc/CASCRootReader
 */

import { logger } from '../utils/logger.js';
import { DatabaseError } from '../database/errors.js';
import { CASCListFile } from './CASCListFile.js';

/**
 * Locale flags for file availability
 */
export enum LocaleFlag {
  ALL = 0xFFFFFFFF,
  NONE = 0,
  enUS = 0x2,
  koKR = 0x4,
  frFR = 0x10,
  deDE = 0x20,
  zhCN = 0x40,
  esES = 0x80,
  zhTW = 0x100,
  enGB = 0x200,
  enCN = 0x400,
  enTW = 0x800,
  esMX = 0x1000,
  ruRU = 0x2000,
  ptBR = 0x4000,
  itIT = 0x8000,
  ptPT = 0x10000
}

/**
 * Content flags for file types
 */
export enum ContentFlag {
  NONE = 0,
  F00000001 = 0x1,
  F00000002 = 0x2,
  F00000004 = 0x4,
  F00000008 = 0x8,
  LOAD_ON_WINDOWS = 0x8,
  F00000010 = 0x10,
  LOAD_ON_MAC = 0x10,
  F00000020 = 0x20,
  F00000040 = 0x40,
  F00000080 = 0x80,
  F00000100 = 0x100,
  F00000200 = 0x200,
  F00000400 = 0x400,
  F00000800 = 0x800,
  F00001000 = 0x1000,
  F00002000 = 0x2000,
  F00004000 = 0x4000,
  F00008000 = 0x8000,
  F00010000 = 0x10000,
  F00020000 = 0x20000,
  ALTERNATE = 0x40000,
  F00080000 = 0x80000,
  F00100000 = 0x100000,
  F00200000 = 0x200000,
  F00400000 = 0x400000,
  F00800000 = 0x800000,
  F01000000 = 0x1000000,
  F02000000 = 0x2000000,
  F04000000 = 0x4000000,
  F08000000 = 0x8000000,
  F10000000 = 0x10000000,
  F20000000 = 0x20000000,
  ENCRYPTED = 0x40000000,
  NO_COMPRESS = 0x80000000
}

/**
 * Root file entry
 */
export interface CASCRootEntry {
  /** File path (normalized with forward slashes) */
  filePath: string;
  /** Content key (MD5 hash) */
  contentKey: Buffer;
  /** Locale flags */
  localeFlags: number;
  /** Content flags */
  contentFlags: number;
  /** File ID (if available) */
  fileId?: number;
}

/**
 * Root file block header
 */
interface RootBlockHeader {
  /** Number of entries in block */
  count: number;
  /** Content flags for entries */
  contentFlags: number;
  /** Locale flags for entries */
  localeFlags: number;
}

/**
 * CASC root file reader
 */
export class CASCRootReader {
  private entries: Map<string, CASCRootEntry[]> = new Map();
  private fileIdMap: Map<number, CASCRootEntry> = new Map();
  private totalEntries: number = 0;
  private listFile: CASCListFile | null = null;

  /**
   * Parse root file data
   *
   * @param data - Root file buffer
   * @param locale - Preferred locale (e.g., 'enUS')
   */
  parseRootFile(data: Buffer, locale: string = 'enUS'): void {
    console.log(`[CASCRootReader] Parsing root file (${data.length} bytes)`);
    logger.info('CASCRootReader', 'Parsing root file');

    try {
      // Check for signature
      const signature = data.toString('ascii', 0, 4);
      console.log(`[CASCRootReader] Root file signature: ${signature}`);

      if (signature === 'TVFS') {
        console.log('[CASCRootReader] Using TVFS format parser (modern WoW builds)');
        this.parseTVFSFormat(data, locale);
      } else if (signature === 'MNDX') {
        console.log('[CASCRootReader] Using MNDX format parser');
        this.parseMNDXFormat(data, locale);
      } else {
        // Try parsing as legacy format
        console.log('[CASCRootReader] Using legacy format parser');
        this.parseLegacyFormat(data, locale);
      }

      console.log(`[CASCRootReader] Loaded ${this.totalEntries} root entries, ${this.entries.size} unique paths`);
      logger.info('CASCRootReader', `Loaded ${this.totalEntries} root entries, ${this.entries.size} unique paths`);
    } catch (error) {
      console.error(`[CASCRootReader] ERROR parsing root file:`, error);
      logger.error('CASCRootReader', error as Error);
      throw new DatabaseError(`Failed to parse root file: ${(error as Error).message}`);
    }
  }

  /**
   * Parse MNDX (Multi-locale Index) format root file
   */
  private parseMNDXFormat(data: Buffer, locale: string): void {
    logger.debug('CASCRootReader', 'Parsing MNDX format root file');

    let offset = 0;

    // MNDX header
    const signature = data.toString('ascii', offset, offset + 4);
    offset += 4;

    const version = data.readUInt32LE(offset);
    offset += 4;

    logger.debug('CASCRootReader', { signature, version });

    // Read blocks until end of file
    while (offset < data.length - 12) {
      try {
        const blockSize = this.parseMNDXBlock(data, offset, locale);
        if (blockSize <= 0) break;
        offset += blockSize;
      } catch (error) {
        logger.warn('CASCRootReader', 'Error parsing MNDX block, stopping', {
          error: error as Error,
          offset
        });
        break;
      }
    }
  }

  /**
   * Parse a single MNDX block
   */
  private parseMNDXBlock(data: Buffer, startOffset: number, locale: string): number {
    let offset = startOffset;

    // Block header
    const count = data.readUInt32LE(offset);
    offset += 4;

    const contentFlags = data.readUInt32LE(offset);
    offset += 4;

    const localeFlags = data.readUInt32LE(offset);
    offset += 4;

    if (count === 0 || count > 1000000) {
      // Sanity check: if count is unreasonable, we've hit bad data
      return 0;
    }

    logger.debug('CASCRootReader', `Block: ${count} entries, content=${contentFlags.toString(16)}, locale=${localeFlags.toString(16)}`);

    // Check if this block matches our locale
    const localeFlag = this.getLocaleFlag(locale);
    const matchesLocale = (localeFlags & localeFlag) !== 0 || localeFlags === LocaleFlag.ALL;

    // Parse entries
    for (let i = 0; i < count; i++) {
      try {
        // Entry format: fileId (4) + contentKey (16) + nameLength (2) + name (variable)
        if (offset + 22 > data.length) break;

        // File ID (optional, may be 0)
        const fileId = data.readUInt32LE(offset);
        offset += 4;

        // Content key (MD5 hash, 16 bytes)
        const contentKey = Buffer.from(data.subarray(offset, offset + 16));
        offset += 16;

        // File name length
        const nameLength = data.readUInt16LE(offset);
        offset += 2;

        if (offset + nameLength > data.length) break;

        // File path
        const filePath = data.toString('utf8', offset, offset + nameLength);
        offset += nameLength;

        // Only store if matches our locale or we want all locales
        if (matchesLocale) {
          const entry: CASCRootEntry = {
            filePath: this.normalizePath(filePath),
            contentKey,
            localeFlags,
            contentFlags,
            fileId: fileId > 0 ? fileId : undefined
          };

          this.addEntry(entry);
        }
      } catch (error) {
        logger.warn('CASCRootReader', 'Error parsing entry, skipping', {
          error: error as Error,
          offset
        });
        break;
      }
    }

    return offset - startOffset;
  }

  /**
   * Parse legacy format root file (block-based)
   */
  private parseLegacyFormat(data: Buffer, locale: string): void {
    console.log('[CASCRootReader] Parsing legacy format root file');
    logger.debug('CASCRootReader', 'Parsing legacy format root file');

    let offset = 0;
    const localeFlag = this.getLocaleFlag(locale);
    let blocksProcessed = 0;

    // Parse blocks until end of file
    while (offset < data.length - 12) {
      try {
        // Block header: count (4) + contentFlags (4) + localeFlags (4)
        const count = data.readUInt32LE(offset);
        offset += 4;

        if (count === 0 || count > 1000000) {
          console.log(`[CASCRootReader] Invalid count ${count} at offset ${offset}, stopping`);
          break;
        }

        const contentFlags = data.readUInt32LE(offset);
        offset += 4;

        const localeFlags = data.readUInt32LE(offset);
        offset += 4;

        const matchesLocale = (localeFlags & localeFlag) !== 0 || localeFlags === LocaleFlag.ALL;
        console.log(`[CASCRootReader] Block ${blocksProcessed}: count=${count}, matches locale=${matchesLocale}`);
        blocksProcessed++;

        // Parse entries in block
        for (let i = 0; i < count; i++) {
          if (offset + 16 > data.length) break;

          // Content key (16 bytes)
          const contentKey = Buffer.from(data.subarray(offset, offset + 16));
          offset += 16;

          // File hash (8 bytes) - used for lookup in older versions
          const fileHash = data.readBigUInt64LE(offset);
          offset += 8;

          if (matchesLocale) {
            // In legacy format, we don't have file paths directly
            // Store by hash for now
            const entry: CASCRootEntry = {
              filePath: `hash_${fileHash.toString(16).padStart(16, '0')}`,
              contentKey,
              localeFlags,
              contentFlags
            };

            this.addEntry(entry);
          }
        }
      } catch (error) {
        console.error(`[CASCRootReader] Error parsing legacy block at offset ${offset}:`, error);
        logger.warn('CASCRootReader', 'Error parsing legacy block, stopping', {
          error: error as Error,
          offset
        });
        break;
      }
    }

    console.log(`[CASCRootReader] Legacy format: processed ${blocksProcessed} blocks, ${this.totalEntries} entries added`);
  }

  /**
   * Parse TVFS (Tagged Virtual File System) format root file
   * Used in modern WoW builds (11.x+)
   *
   * Based on CASCExplorer's TVFSRootHandler implementation
   */
  private parseTVFSFormat(data: Buffer, locale: string): void {
    console.log('[CASCRootReader] Parsing TVFS format root file');
    logger.debug('CASCRootReader', 'Parsing TVFS format root file');

    try {
      // Parse TVFS header
      const header = this.parseTVFSHeader(data);

      console.log(`[CASCRootReader] TVFS Header: FormatVersion=${header.formatVersion}, EKeySize=${header.eKeySize}, PathTableSize=${header.pathTableSize}, VfsTableSize=${header.vfsTableSize}, CftTableSize=${header.cftTableSize}`);

      // Extract tables from data
      const pathTable = data.subarray(header.pathTableOffset, header.pathTableOffset + header.pathTableSize);
      const vfsTable = data.subarray(header.vfsTableOffset, header.vfsTableOffset + header.vfsTableSize);
      const cftTable = data.subarray(header.cftTableOffset, header.cftTableOffset + header.cftTableSize);

      console.log(`[CASCRootReader] TVFS Tables extracted: pathTable=${pathTable.length}b, vfsTable=${vfsTable.length}b, cftTable=${cftTable.length}b`);

      // Parse the path/file tree
      this.parseTVFSPathTable(pathTable, vfsTable, cftTable, header);

      console.log(`[CASCRootReader] TVFS format: parsed ${this.totalEntries} entries`);
    } catch (error) {
      console.error(`[CASCRootReader] Error parsing TVFS format:`, error);
      throw error;
    }
  }

  /**
   * Parse TVFS header structure
   */
  private parseTVFSHeader(data: Buffer): any {
    let offset = 0;

    const magic = data.readUInt32LE(offset);
    offset += 4;

    if (magic !== 0x53465654) { // "TVFS" in little-endian
      throw new Error(`Invalid TVFS magic: 0x${magic.toString(16)}`);
    }

    const formatVersion = data.readUInt8(offset++);
    const headerSize = data.readUInt8(offset++);
    const eKeySize = data.readUInt8(offset++);
    const patchKeySize = data.readUInt8(offset++);

    if (formatVersion !== 1) {
      throw new Error(`Unsupported TVFS format version: ${formatVersion}`);
    }

    if (eKeySize !== 9) {
      throw new Error(`Unexpected EKey size: ${eKeySize} (expected 9)`);
    }

    const flags = data.readInt32BE(offset);
    offset += 4;

    const pathTableOffset = data.readInt32BE(offset);
    offset += 4;

    const pathTableSize = data.readInt32BE(offset);
    offset += 4;

    const vfsTableOffset = data.readInt32BE(offset);
    offset += 4;

    const vfsTableSize = data.readInt32BE(offset);
    offset += 4;

    const cftTableOffset = data.readInt32BE(offset);
    offset += 4;

    const cftTableSize = data.readInt32BE(offset);
    offset += 4;

    const maxDepth = data.readUInt16BE(offset);
    offset += 2;

    const estTableOffset = data.readInt32BE(offset);
    offset += 4;

    const estTableSize = data.readInt32BE(offset);
    offset += 4;

    // Calculate offset field sizes
    const cftOffsSize = this.getOffsetFieldSize(cftTableSize);
    const estOffsSize = this.getOffsetFieldSize(estTableSize);

    return {
      magic,
      formatVersion,
      headerSize,
      eKeySize,
      patchKeySize,
      flags,
      pathTableOffset,
      pathTableSize,
      vfsTableOffset,
      vfsTableSize,
      cftTableOffset,
      cftTableSize,
      maxDepth,
      estTableOffset,
      estTableSize,
      cftOffsSize,
      estOffsSize
    };
  }

  /**
   * Get offset field size based on table size
   */
  private getOffsetFieldSize(tableSize: number): number {
    if (tableSize > 0xffffff) return 4;
    if (tableSize > 0xffff) return 3;
    if (tableSize > 0xff) return 2;
    return 1;
  }

  /**
   * Parse TVFS path table and build file tree
   */
  private parseTVFSPathTable(pathTable: Buffer, vfsTable: Buffer, cftTable: Buffer, header: any): void {
    const pathBuffer: string[] = [];
    let offset = 0;

    // Skip initial node value if present
    if (offset + 1 + 4 < pathTable.length && pathTable[offset] === 0xFF) {
      const nodeValue = pathTable.readInt32BE(offset + 1);
      offset += 5;

      if ((nodeValue & 0x80000000) === 0) {
        throw new Error('Expected folder node at root');
      }
    }

    this.parseTVFSPathFileTable(pathTable, vfsTable, cftTable, header, offset, pathBuffer);
  }

  /**
   * Recursively parse TVFS path file table
   */
  private parseTVFSPathFileTable(pathTable: Buffer, vfsTable: Buffer, cftTable: Buffer, header: any, startOffset: number, pathBuffer: string[], maxOffset?: number): number {
    let offset = startOffset;
    const saveDepth = pathBuffer.length;
    const endBoundary = maxOffset !== undefined ? maxOffset : pathTable.length;

    while (offset < endBoundary) {
      // Safety check to prevent infinite loops
      if (offset >= pathTable.length) {
        console.log(`[CASCRootReader] TVFS parser reached end of pathTable at offset ${offset}`);
        break;
      }

      // Parse path entry
      const pathEntry = this.captureTVFSPathEntry(pathTable, offset);
      if (!pathEntry) {
        break;
      }

      offset = pathEntry.nextOffset;

      // Build path
      if (pathEntry.hasPreSeparator) {
        pathBuffer.push('/');
      }

      if (pathEntry.name) {
        pathBuffer.push(pathEntry.name);
      }

      if (pathEntry.hasPostSeparator) {
        pathBuffer.push('/');
      }

      // Handle node value
      if (pathEntry.hasNodeValue) {
        if ((pathEntry.nodeValue & 0x80000000) !== 0) {
          // Folder node - recurse with bounded offset
          const dirLen = (pathEntry.nodeValue & 0x7FFFFFFF) - 4;

          if (dirLen <= 0 || dirLen > pathTable.length) {
            console.warn(`[CASCRootReader] Invalid folder dirLen: ${dirLen}`);
            break;
          }

          const folderEndOffset = offset + dirLen;

          if (folderEndOffset > pathTable.length) {
            console.warn(`[CASCRootReader] Folder end offset ${folderEndOffset} exceeds buffer`);
            break;
          }

          // Recurse with bounded offset
          offset = this.parseTVFSPathFileTable(pathTable, vfsTable, cftTable, header, offset, pathBuffer, folderEndOffset);

          // Ensure we don't go backwards
          if (offset < folderEndOffset) {
            offset = folderEndOffset;
          }
        } else {
          // File node - extract VFS entry
          const vfsOffset = pathEntry.nodeValue;
          this.extractTVFSFile(pathBuffer.join(''), vfsTable, cftTable, header, vfsOffset);
        }

        // Restore path buffer to saved depth
        pathBuffer.length = saveDepth;
      }
    }

    return offset;
  }

  /**
   * Capture TVFS path entry
   */
  private captureTVFSPathEntry(pathTable: Buffer, offset: number): any {
    if (offset >= pathTable.length) return null;

    let hasPreSeparator = false;
    let hasPostSeparator = false;
    let hasNodeValue = false;
    let name = '';
    let nodeValue = 0;

    // Check for pre-separator
    if (pathTable[offset] === 0) {
      hasPreSeparator = true;
      offset++;
    }

    // Read name
    if (offset < pathTable.length && pathTable[offset] !== 0xFF) {
      const nameLen = pathTable[offset++];
      if (offset + nameLen > pathTable.length) return null;

      name = pathTable.toString('utf8', offset, offset + nameLen);
      offset += nameLen;
    }

    // Check for post-separator
    if (offset < pathTable.length && pathTable[offset] === 0) {
      hasPostSeparator = true;
      offset++;
    }

    // Read node value
    if (offset < pathTable.length) {
      if (pathTable[offset] === 0xFF) {
        if (offset + 5 > pathTable.length) return null;

        nodeValue = pathTable.readInt32BE(offset + 1);
        hasNodeValue = true;
        offset += 5;
      } else if (pathTable[offset] !== 0) {
        hasPostSeparator = true;
      }
    }

    return {
      hasPreSeparator,
      hasPostSeparator,
      hasNodeValue,
      name,
      nodeValue,
      nextOffset: offset
    };
  }

  /**
   * Extract TVFS file entry
   */
  private extractTVFSFile(filePath: string, vfsTable: Buffer, cftTable: Buffer, header: any, vfsOffset: number): void {
    try {
      if (vfsOffset >= vfsTable.length) return;

      // Read span count
      const spanCount = vfsTable[vfsOffset];
      if (spanCount < 1 || spanCount > 224) return;

      let offset = vfsOffset + 1;

      // For simplicity, we only handle single-span files for now
      // Multi-span files are rare and would need more complex handling
      if (spanCount !== 1) {
        logger.debug('CASCRootReader', `Skipping multi-span file (${spanCount} spans): ${filePath}`);
        return;
      }

      // Read VFS span entry
      if (offset + 4 + 4 + header.cftOffsSize > vfsTable.length) return;

      const contentOffset = vfsTable.readInt32BE(offset);
      offset += 4;

      const contentLength = vfsTable.readInt32BE(offset);
      offset += 4;

      const cftOffset = this.readVariableInt(vfsTable, offset, header.cftOffsSize);
      offset += header.cftOffsSize;

      // Read EKey from CFT table
      if (cftOffset + header.eKeySize > cftTable.length) return;

      const eKey = Buffer.alloc(16);
      cftTable.copy(eKey, 0, cftOffset, cftOffset + header.eKeySize);

      // Modern TVFS roots use FileDataIDs instead of paths
      // Try to convert FileDataID to actual path using listfile
      let actualFilePath = filePath;
      let fileDataId: number | undefined;

      if (this.listFile && this.listFile.isLoaded()) {
        // Parse FileDataID from hex path
        const parsedFileDataId = CASCListFile.parseFileDataId(filePath);

        // Debug: Log first few conversions
        if (this.totalEntries < 20) {
          console.log(`[CASCRootReader] FileDataID conversion: "${filePath}" → decimal ${parsedFileDataId}, listFile=${this.listFile ? 'loaded' : 'NULL'}`);
        }

        if (parsedFileDataId > 0) {
          fileDataId = parsedFileDataId;  // ✅ Store FileDataID for entry

          const resolvedPath = this.listFile.getPath(parsedFileDataId);
          if (resolvedPath) {
            actualFilePath = resolvedPath;
            if (this.totalEntries < 10) {
              console.log(`[CASCRootReader]   → Resolved to: "${resolvedPath}" (FileDataID: ${fileDataId})`);
            }
          } else {
            // FileDataID not in listfile - keep the hex ID as the path
            // This allows us to access files even if we don't know their human-readable name
            actualFilePath = `$fid:${parsedFileDataId}`;  // Prefix to distinguish from real paths
            if (this.totalEntries < 10) {
              console.log(`[CASCRootReader]   → NOT in listfile, using FileDataID: ${actualFilePath}`);
            }
          }
        } else {
          // FileDataID is 0 - skip this entry
          if (this.totalEntries < 10) {
            console.log(`[CASCRootReader]   → FileDataID is 0, skipping`);
          }
          return;
        }
      }

      // Add entry using EKey as content key (TVFS uses EKeys directly)
      const entry: CASCRootEntry = {
        filePath: this.normalizePath(actualFilePath),
        contentKey: eKey,
        localeFlags: LocaleFlag.ALL,
        contentFlags: ContentFlag.NONE,
        fileId: fileDataId  // ✅ Use the FileDataID we already parsed!
      };

      this.addEntry(entry);
    } catch (error) {
      logger.debug('CASCRootReader', `Error extracting TVFS file: ${filePath}`, { error: error as Error });
    }
  }

  /**
   * Read variable-length integer (big-endian)
   */
  private readVariableInt(buffer: Buffer, offset: number, numBytes: number): number {
    let value = 0;
    for (let i = 0; i < numBytes; i++) {
      value = (value << 8) | buffer[offset + i];
    }
    return value;
  }

  /**
   * Add entry to maps
   */
  private addEntry(entry: CASCRootEntry): void {
    const normalizedPath = entry.filePath.toLowerCase();

    // Add to path map (can have multiple entries per path for different locales)
    if (!this.entries.has(normalizedPath)) {
      this.entries.set(normalizedPath, []);
    }
    this.entries.get(normalizedPath)!.push(entry);

    // Add to file ID map if available
    if (entry.fileId !== undefined) {
      this.fileIdMap.set(entry.fileId, entry);

      // Debug: Log first 10 FileDataID additions
      if (this.fileIdMap.size <= 10) {
        console.log(`[CASCRootReader] ✅ Added FileDataID ${entry.fileId} → "${entry.filePath}" to fileIdMap (size: ${this.fileIdMap.size})`);
      }
    } else {
      // Debug: Log first 5 entries WITHOUT FileDataID
      if (this.totalEntries < 5) {
        console.log(`[CASCRootReader] ⚠️  Entry WITHOUT FileDataID: "${entry.filePath}"`);
      }
    }

    this.totalEntries++;
  }

  /**
   * Find entry by file path
   *
   * @param filePath - File path (case-insensitive)
   * @returns Content key or null if not found
   */
  findByPath(filePath: string): Buffer | null {
    const normalized = this.normalizePath(filePath).toLowerCase();
    const entries = this.entries.get(normalized);

    if (!entries || entries.length === 0) {
      return null;
    }

    // Return first matching entry's content key
    return entries[0].contentKey;
  }

  /**
   * Find entry by file ID
   *
   * @param fileId - Numeric file ID
   * @returns Content key or null if not found
   */
  findByFileId(fileId: number): Buffer | null {
    const entry = this.fileIdMap.get(fileId);
    return entry ? entry.contentKey : null;
  }

  /**
   * Get all entries for a file path (different locales)
   *
   * @param filePath - File path
   * @returns Array of entries
   */
  getEntries(filePath: string): CASCRootEntry[] {
    const normalized = this.normalizePath(filePath).toLowerCase();
    return this.entries.get(normalized) || [];
  }

  /**
   * Check if file exists
   *
   * @param filePath - File path
   * @returns True if file exists in root
   */
  hasFile(filePath: string): boolean {
    const normalized = this.normalizePath(filePath).toLowerCase();
    return this.entries.has(normalized);
  }

  /**
   * List all files matching a pattern
   *
   * @param pattern - Glob-like pattern (* and ? wildcards)
   * @returns Array of matching file paths
   */
  listFiles(pattern: string): string[] {
    const regex = this.patternToRegex(pattern);
    const matches: string[] = [];

    for (const [path] of this.entries) {
      if (regex.test(path)) {
        matches.push(path);
      }
    }

    return matches;
  }

  /**
   * Get entry count
   */
  getEntryCount(): number {
    return this.totalEntries;
  }

  /**
   * Get unique file count
   */
  getFileCount(): number {
    return this.entries.size;
  }

  /**
   * Set listfile for FileDataID → Path mapping
   *
   * Modern WoW uses FileDataIDs instead of paths in TVFS roots.
   * The listfile provides the mapping from numeric IDs to paths.
   *
   * @param listFile - CASCListFile instance
   */
  setListFile(listFile: CASCListFile): void {
    this.listFile = listFile;
    console.log(`[CASCRootReader] ListFile set (${listFile.getEntryCount()} entries)`);
  }

  /**
   * Get the list file instance
   *
   * @returns CASCListFile instance or null
   */
  getListFile(): CASCListFile | null {
    return this.listFile;
  }

  /**
   * Normalize file path (convert backslashes to forward slashes)
   */
  private normalizePath(filePath: string): string {
    return filePath.replace(/\\/g, '/');
  }

  /**
   * Get locale flag from locale string
   */
  private getLocaleFlag(locale: string): number {
    const localeUpper = locale.replace('-', '').replace('_', '');
    return (LocaleFlag as any)[localeUpper] || LocaleFlag.enUS;
  }

  /**
   * Convert glob pattern to regex
   */
  private patternToRegex(pattern: string): RegExp {
    // Escape special regex characters except * and ?
    let regex = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');

    return new RegExp(`^${regex}$`, 'i');
  }
}
