/**
 * CASC Index File Reader
 *
 * Reads CASC .idx files to locate data in archive files.
 *
 * Index file format:
 * - Header: version, bucket info
 * - Entries: hash (8 bytes) + size (4 bytes) + offset (4 bytes) + archive (1 byte)
 *
 * @module casc/CASCIndexReader
 */

import fs from 'fs/promises';
import path from 'path';
import { logger } from '../utils/logger.js';

/**
 * Index entry
 */
export interface CASCIndexEntry {
  /** Content hash (first 8 bytes) */
  hash: Buffer;
  /** Compressed size */
  size: number;
  /** Offset in data file */
  offset: number;
  /** Archive number (data file index) */
  archive: number;
}

/**
 * CASC Index Reader
 */
export class CASCIndexReader {
  private entries: Map<string, CASCIndexEntry> = new Map();

  /**
   * Load all index files from CASC indices directory
   */
  async loadIndices(indicesPath: string): Promise<void> {
    logger.info('CASCIndexReader', `Loading index files from: ${indicesPath}`);

    try {
      const files = await fs.readdir(indicesPath);
      const idxFiles = files.filter(f => f.endsWith('.idx'));

      logger.info('CASCIndexReader', `Found ${idxFiles.length} index files`);

      for (const file of idxFiles) {
        const filePath = path.join(indicesPath, file);
        await this.parseIndexFile(filePath);
      }

      logger.info('CASCIndexReader', `Loaded ${this.entries.size} index entries`);
    } catch (error: any) {
      logger.error('CASCIndexReader', error);
      throw error;
    }
  }

  /**
   * Parse a single index file
   */
  private async parseIndexFile(filePath: string): Promise<void> {
    const data = await fs.readFile(filePath);

    // Index file header
    const headerHashSize = data.readUInt32LE(0);
    const headerHash = data.subarray(4, 4 + headerHashSize);

    let offset = 4 + headerHashSize;

    // Read all entries
    // Each entry is 18 bytes: hash(9) + indexHigh(1) + sizeLow(4) + offsetLow(4)
    while (offset + 18 <= data.length) {
      // Last 9 bytes of content hash
      const hash = data.subarray(offset, offset + 9);

      // Index high byte (upper 2 bits) + archive index (lower 6 bits)
      const indexHigh = data[offset + 9];

      // Size (4 bytes, little-endian)
      const size = data.readUInt32LE(offset + 10);

      // Offset (4 bytes, little-endian)
      const fileOffset = data.readUInt32LE(offset + 14);

      // Archive number from indexHigh
      const archive = indexHigh & 0x0F;

      const entry: CASCIndexEntry = {
        hash,
        size,
        offset: fileOffset,
        archive
      };

      // Use hash as key (hex string for easy lookup)
      const hashKey = hash.toString('hex');
      this.entries.set(hashKey, entry);

      offset += 18;
    }

    logger.debug(
      'CASCIndexReader',
      `Parsed ${path.basename(filePath)}: ${this.entries.size} total entries`
    );
  }

  /**
   * Find entry by content hash
   */
  findEntry(hash: Buffer): CASCIndexEntry | null {
    // Try full hash
    let hashKey = hash.toString('hex');
    let entry = this.entries.get(hashKey);

    if (entry) return entry;

    // Try last 9 bytes (what's stored in index)
    if (hash.length > 9) {
      hashKey = hash.subarray(hash.length - 9).toString('hex');
      entry = this.entries.get(hashKey);
    }

    return entry || null;
  }

  /**
   * Get all entries
   */
  getAllEntries(): CASCIndexEntry[] {
    return Array.from(this.entries.values());
  }

  /**
   * Get entry count
   */
  getEntryCount(): number {
    return this.entries.size;
  }
}
