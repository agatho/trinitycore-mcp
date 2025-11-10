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

  /**
   * Parse root file data
   *
   * @param data - Root file buffer
   * @param locale - Preferred locale (e.g., 'enUS')
   */
  parseRootFile(data: Buffer, locale: string = 'enUS'): void {
    logger.info('CASCRootReader', 'Parsing root file');

    try {
      // Check for MNDX signature (Multi-locale Index format)
      const signature = data.toString('ascii', 0, 4);

      if (signature === 'MNDX') {
        this.parseMNDXFormat(data, locale);
      } else {
        // Try parsing as legacy format
        this.parseLegacyFormat(data, locale);
      }

      logger.info('CASCRootReader', `Loaded ${this.totalEntries} root entries, ${this.entries.size} unique paths`);
    } catch (error) {
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
    logger.debug('CASCRootReader', 'Parsing legacy format root file');

    let offset = 0;
    const localeFlag = this.getLocaleFlag(locale);

    // Parse blocks until end of file
    while (offset < data.length - 12) {
      try {
        // Block header: count (4) + contentFlags (4) + localeFlags (4)
        const count = data.readUInt32LE(offset);
        offset += 4;

        if (count === 0 || count > 1000000) break;

        const contentFlags = data.readUInt32LE(offset);
        offset += 4;

        const localeFlags = data.readUInt32LE(offset);
        offset += 4;

        const matchesLocale = (localeFlags & localeFlag) !== 0 || localeFlags === LocaleFlag.ALL;

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
        logger.warn('CASCRootReader', 'Error parsing legacy block, stopping', {
          error: error as Error,
          offset
        });
        break;
      }
    }
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
