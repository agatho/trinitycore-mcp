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
   * Load all index files from CASC data directory
   * Uses Data/data/*.idx files (not Data/indices/*.index!)
   */
  async loadIndices(dataPath: string): Promise<void> {
    // The actual .idx files are in Data/data/, not Data/indices/
    const idxPath = path.join(path.dirname(dataPath), 'data');

    console.log(`[CASCIndexReader] Loading index files from: ${idxPath}`);
    logger.info('CASCIndexReader', `Loading index files from: ${idxPath}`);

    try {
      const files = await fs.readdir(idxPath);
      // Get latest .idx file for each prefix (00-0f)
      const latestIdx: string[] = [];

      for (let i = 0; i < 0x10; i++) {
        const prefix = i.toString(16).padStart(2, '0');
        const matching = files.filter(f => f.startsWith(prefix) && f.endsWith('.idx'));

        if (matching.length > 0) {
          // Get the latest version (highest number)
          const latest = matching.sort().pop();
          if (latest) {
            latestIdx.push(path.join(idxPath, latest));
          }
        }
      }

      console.log(`[CASCIndexReader] Found ${latestIdx.length} index files`);
      logger.info('CASCIndexReader', `Found ${latestIdx.length} index files`);

      for (const filePath of latestIdx) {
        await this.parseIndexFile(filePath);
      }

      console.log(`[CASCIndexReader] Loaded ${this.entries.size} index entries total`);
      logger.info('CASCIndexReader', `Loaded ${this.entries.size} index entries`);
    } catch (error: any) {
      console.error(`[CASCIndexReader] ERROR loading indices:`, error);
      logger.error('CASCIndexReader', error);
      throw error;
    }
  }

  /**
   * Parse a single index file (supports both .idx and .index formats)
   */
  private async parseIndexFile(filePath: string): Promise<void> {
    const data = await fs.readFile(filePath);
    const fileName = path.basename(filePath);

    // Try parsing as wow.export format (fixed 18-byte entries after header)
    await this.parseIndexFileWowExport(data, fileName);
  }

  /**
   * Parse index file using CASCExplorer format
   * Based on https://github.com/WoW-Tools/CASCExplorer
   *
   * Format from CASCExplorer LocalIndexHandler.cs:
   * - HeaderHashSize (4 bytes LE)
   * - HeaderHash (4 bytes LE) - IGNORED
   * - Header hash data (HeaderHashSize bytes)
   * - Align to 0x10 boundary
   * - EntriesSize (4 bytes LE)
   * - EntriesHash (4 bytes LE) - IGNORED
   * - Fixed 18-byte entries: 9-byte key + 1-byte indexHigh + 4-byte indexLow (BE) + 4-byte size (LE)
   *
   * Archive/Offset decoding:
   * - archive = (indexHigh << 2) | ((indexLow & 0xC0000000) >> 30)
   * - offset = indexLow & 0x3FFFFFFF
   */
  private async parseIndexFileWowExport(data: Buffer, fileName: string): Promise<void> {
    try {
      let offset = 0;

      // Read header
      const headerHashSize = data.readInt32LE(offset);
      offset += 4;

      // Validate headerHashSize (typically 16, but could vary)
      if (headerHashSize < 0 || headerHashSize > 256) {
        console.log(`[CASCIndexReader] WARNING: ${fileName} has invalid headerHashSize: ${headerHashSize}, skipping`);
        return;
      }

      const headerHash = data.readInt32LE(offset);  // Read but ignore
      offset += 4;

      // Read hash data
      const hashData = data.subarray(offset, offset + headerHashSize);
      offset += headerHashSize;

      // Align to 0x10 boundary
      offset = (8 + headerHashSize + 0x0F) & 0xFFFFFFF0;

      if (offset + 8 > data.length) {
        console.log(`[CASCIndexReader] WARNING: ${fileName} insufficient data after header`);
        return;
      }

      // Read entries section
      const entriesSize = data.readInt32LE(offset);
      offset += 4;

      const entriesHash = data.readInt32LE(offset);  // Read but ignore
      offset += 4;

      console.log(`[CASCIndexReader] ${fileName}: headerHashSize=${headerHashSize}, entriesSize=${entriesSize}`);

      // Parse fixed 18-byte entries
      const numBlocks = Math.floor(entriesSize / 18);
      let entryCount = 0;

      for (let i = 0; i < numBlocks && offset + 18 <= data.length; i++) {
        // 9-byte key (EKey, first 9 bytes of MD5)
        const key = data.subarray(offset, offset + 9);
        offset += 9;

        // 1 byte indexHigh
        const indexHigh = data.readUInt8(offset);
        offset += 1;

        // 4 bytes indexLow (BIG-ENDIAN!)
        const indexLow = data.readInt32BE(offset);
        offset += 4;

        // 4 bytes size (LITTLE-ENDIAN)
        const size = data.readInt32LE(offset);
        offset += 4;

        // Decode archive and offset using CASCExplorer's logic
        const archive = (indexHigh << 2) | ((indexLow & 0xC0000000) >>> 30);
        const fileOffset = indexLow & 0x3FFFFFFF;

        const entry: CASCIndexEntry = {
          hash: key,
          size,
          offset: fileOffset,
          archive
        };

        // Use 9-byte key as hash for lookup
        const hashKey = key.toString('hex');

        // Use first occurrence only (as CASCExplorer does)
        if (!this.entries.has(hashKey)) {
          this.entries.set(hashKey, entry);
          entryCount++;
        }
      }

      console.log(`[CASCIndexReader] ${fileName}: parsed ${entryCount} entries`);
    } catch (error) {
      console.error(`[CASCIndexReader] Error parsing ${fileName}:`, error);
    }
  }

  /**
   * Parse modern CASC index file (Version 7, used in WoW 11.x/12.x)
   *
   * Format specification from CascLib:
   * - Guarded block wrapper (BlockSize + BlockHash)
   * - FILE_INDEX_HEADER_V2 inside guarded block
   * - Variable-length entries
   */
  private async parseIndexFileV7(data: Buffer, fileName: string): Promise<void> {
    try {
      // Modern .index files start directly with FILE_INDEX_HEADER
      // No guarded block wrapper in these files
      const headerOffset = 0;

      // Read version as BIG-ENDIAN
      const version = data.readUInt16BE(headerOffset + 0x00);
      if (version !== 7 && version !== 5) {
        console.log(`[CASCIndexReader] WARNING: ${fileName} has unsupported version: ${version}`);
        return;
      }

      const bucketIndex = data.readUInt8(headerOffset + 0x02);

      // Entry specification (4 bytes at 0x03-0x06) per CASC_INDEX_HEADER struct
      const offsetBytes = data.readUInt8(headerOffset + 0x03); // StorageOffsetLength
      const sizeBytes = data.readUInt8(headerOffset + 0x04);   // EncodedSizeLength
      const keyBytes = data.readUInt8(headerOffset + 0x05);    // EKeyLength
      const offsetBits = data.readUInt8(headerOffset + 0x06);  // FileOffsetBits

      const entriesSize = data.readUInt32LE(headerOffset + 0x18);
      const entriesOffset = headerOffset + 0x20; // Entries start after header

      console.log(`[CASCIndexReader] ${fileName}: version=${version}, bucket=${bucketIndex}, keyBytes=${keyBytes}, offsetBytes=${offsetBytes}, sizeBytes=${sizeBytes}, offsetBits=${offsetBits}`);

      // Parse variable-length entries
      let offset = entriesOffset;
      const endOffset = entriesOffset + entriesSize;
      let entryCount = 0;

      while (offset < endOffset && offset + keyBytes + offsetBytes + sizeBytes <= data.length) {
        // Key: First N bytes of content hash
        const key = data.subarray(offset, offset + keyBytes);
        offset += keyBytes;

        // Offset: Big-endian N-byte integer (contains archive number and file offset)
        let encodedOffset = 0n;
        for (let i = 0; i < offsetBytes; i++) {
          encodedOffset = (encodedOffset << 8n) | BigInt(data[offset + i]);
        }
        offset += offsetBytes;

        // Size: Little-endian M-byte integer
        let size = 0;
        for (let i = 0; i < sizeBytes; i++) {
          size |= data[offset + i] << (i * 8);
        }
        offset += sizeBytes;

        // Decode offset and archive from encodedOffset
        const offsetMask = (1n << BigInt(offsetBits)) - 1n;
        const fileOffset = Number(encodedOffset & offsetMask);
        const archive = Number(encodedOffset >> BigInt(offsetBits));

        const entry: CASCIndexEntry = {
          hash: key,
          size,
          offset: fileOffset,
          archive
        };

        // Use key as hash for lookup
        const hashKey = key.toString('hex');
        this.entries.set(hashKey, entry);
        entryCount++;
      }

      console.log(`[CASCIndexReader] ${fileName}: parsed ${entryCount} entries`);
    } catch (error) {
      console.error(`[CASCIndexReader] Error parsing ${fileName}:`, error);
    }
  }

  /**
   * Parse legacy CASC index file (.idx format)
   */
  private async parseIndexFileLegacy(data: Buffer, fileName: string): Promise<void> {
    // Legacy format header
    const headerHashSize = data.readUInt32LE(0);
    const headerHash = data.subarray(4, 4 + headerHashSize);

    let offset = 4 + headerHashSize;

    // Read all entries (fixed 18-byte format)
    while (offset + 18 <= data.length) {
      // Last 9 bytes of content hash
      const hash = data.subarray(offset, offset + 9);

      // Index high byte + archive index
      const indexHigh = data[offset + 9];

      // Size (4 bytes, little-endian)
      const size = data.readUInt32LE(offset + 10);

      // Offset (4 bytes, little-endian)
      const fileOffset = data.readUInt32LE(offset + 14);

      // Archive number
      const archive = indexHigh & 0x0F;

      const entry: CASCIndexEntry = {
        hash,
        size,
        offset: fileOffset,
        archive
      };

      // Use hash as key
      const hashKey = hash.toString('hex');
      this.entries.set(hashKey, entry);

      offset += 18;
    }

    logger.debug(
      'CASCIndexReader',
      `Parsed ${fileName}: ${this.entries.size} total entries`
    );
  }

  /**
   * Find entry by content hash
   */
  findEntry(hash: Buffer): CASCIndexEntry | null {
    // Try full hash
    let hashKey = hash.toString('hex');
    let entry = this.entries.get(hashKey);

    if (entry) {
      console.log(`[CASCIndexReader] Found entry with full hash: ${hashKey.substring(0, 16)}...`);
      return entry;
    }

    // Try FIRST 9 bytes (what's stored in index!)
    if (hash.length > 9) {
      hashKey = hash.subarray(0, 9).toString('hex');
      entry = this.entries.get(hashKey);

      if (entry) {
        console.log(`[CASCIndexReader] Found entry with first 9 bytes: ${hashKey}`);
        return entry;
      } else {
        console.log(`[CASCIndexReader] Entry not found. Full hash: ${hash.toString('hex').substring(0, 16)}..., First 9: ${hashKey}`);
        console.log(`[CASCIndexReader] Total entries in index: ${this.entries.size}`);
      }
    }

    return null;
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
