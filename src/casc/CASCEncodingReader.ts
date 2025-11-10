/**
 * CASC Encoding File Reader
 *
 * Maps file paths to content hashes using encoding file.
 * The encoding file is stored in CASC data files and must be extracted first.
 *
 * @module casc/CASCEncodingReader
 */

import { logger } from '../utils/logger.js';

/**
 * Encoding entry
 */
export interface CASCEncodingEntry {
  /** Content key (MD5 hash of file) */
  contentKey: Buffer;
  /** Encoding keys (can be multiple) */
  encodingKeys: Buffer[];
  /** File size */
  size: number;
}

/**
 * CASC Encoding File Reader
 */
export class CASCEncodingReader {
  private entries: Map<string, CASCEncodingEntry> = new Map();

  /**
   * Parse encoding file data
   */
  parseEncodingFile(data: Buffer): void {
    logger.info('CASCEncodingReader', 'Parsing encoding file');

    // Encoding file header
    const magic = data.toString('ascii', 0, 2);
    if (magic !== 'EN') {
      throw new Error(`Invalid encoding file magic: ${magic}`);
    }

    const version = data[2];
    const hashSizeC = data[3];  // Content hash size (usually 16 for MD5)
    const hashSizeE = data[4];  // Encoding hash size (usually 16)
    const cKeyPageSize = data.readUInt16BE(5) * 1024;  // Content key page size
    const eKeyPageSize = data.readUInt16BE(7) * 1024;  // Encoding key page size
    const cKeyPageCount = data.readUInt32BE(9);  // Content key page count
    const eKeyPageCount = data.readUInt32BE(13); // Encoding key page count
    const specBlockSize = data[18];

    logger.debug('CASCEncodingReader', {
      version,
      hashSizeC,
      hashSizeE,
      cKeyPageSize,
      eKeyPageSize,
      cKeyPageCount,
      eKeyPageCount
    });

    // Start parsing content key pages
    let offset = 22 + specBlockSize;

    // Parse content key pages
    for (let page = 0; page < cKeyPageCount; page++) {
      const pageStart = offset;
      const pageEnd = Math.min(offset + cKeyPageSize, data.length);

      // Each entry: keyCount(1) + fileSize(5) + contentKey(16) + encodingKeys(16*keyCount)
      let entryOffset = pageStart;

      while (entryOffset + 1 < pageEnd && entryOffset < data.length) {
        const keyCount = data[entryOffset];
        if (keyCount === 0) break; // End of page

        entryOffset++;

        // File size (40-bit big-endian)
        if (entryOffset + 5 > data.length) break;
        const size =
          data[entryOffset] * 0x100000000 +
          data.readUInt32BE(entryOffset + 1);
        entryOffset += 5;

        // Content key (MD5 hash)
        if (entryOffset + hashSizeC > data.length) break;
        const contentKey = data.subarray(entryOffset, entryOffset + hashSizeC);
        entryOffset += hashSizeC;

        // Encoding keys
        const encodingKeys: Buffer[] = [];
        for (let k = 0; k < keyCount; k++) {
          if (entryOffset + hashSizeE > data.length) break;
          const encodingKey = data.subarray(entryOffset, entryOffset + hashSizeE);
          encodingKeys.push(encodingKey);
          entryOffset += hashSizeE;
        }

        // Store entry
        const entry: CASCEncodingEntry = {
          contentKey,
          encodingKeys,
          size
        };

        this.entries.set(contentKey.toString('hex'), entry);
      }

      offset += cKeyPageSize;
    }

    logger.info('CASCEncodingReader', `Loaded ${this.entries.size} encoding entries`);
  }

  /**
   * Find encoding entry by content key
   */
  findEntry(contentKey: Buffer): CASCEncodingEntry | null {
    const key = contentKey.toString('hex');
    return this.entries.get(key) || null;
  }

  /**
   * Get first encoding key for content key
   */
  getEncodingKey(contentKey: Buffer): Buffer | null {
    const entry = this.findEntry(contentKey);
    return entry && entry.encodingKeys.length > 0 ? entry.encodingKeys[0] : null;
  }

  /**
   * Get entry count
   */
  getEntryCount(): number {
    return this.entries.size;
  }
}
