/**
 * BLTE Decompressor
 *
 * Decompresses BLTE-encoded data from Blizzard's CASC storage system.
 * BLTE = BLock Table Encoding
 *
 * @module casc/BLTEDecompressor
 */

import zlib from 'zlib';
import { logger } from '../utils/logger.js';

/**
 * BLTE chunk encoding types
 */
enum BLTEEncoding {
  /** No compression/encryption */
  NONE = 0x4E,  // 'N'
  /** Zlib compressed */
  ZLIB = 0x5A,  // 'Z'
  /** Encrypted */
  ENCRYPTED = 0x45,  // 'E'
  /** Recursive (nested BLTE) */
  RECURSIVE = 0x46   // 'F'
}

/**
 * BLTE chunk info
 */
interface BLTEChunk {
  compressedSize: number;
  decompressedSize: number;
  checksum: Buffer;
}

/**
 * BLTE Decompressor
 */
export class BLTEDecompressor {
  /**
   * Decompress BLTE-encoded data
   *
   * @param data BLTE-encoded buffer
   * @returns Decompressed buffer
   */
  static decompress(data: Buffer): Buffer {
    // Check BLTE signature
    const signature = data.toString('ascii', 0, 4);
    if (signature !== 'BLTE') {
      throw new Error(`Invalid BLTE signature: ${signature}`);
    }

    // Read header size (big-endian uint32)
    const headerSize = data.readUInt32BE(4);

    let chunks: BLTEChunk[] = [];
    let dataOffset = 8;

    if (headerSize > 0) {
      // Multiple chunks
      // Format: 0x0F (flag byte) + 3 bytes for chunk count (big-endian, 24-bit)
      const flagByte = data[8];
      if (flagByte !== 0x0F) {
        throw new Error(`Invalid BLTE chunk flag byte: expected 0x0F, got 0x${flagByte.toString(16)}`);
      }
      const chunkCount = (data[9] << 16) | (data[10] << 8) | data[11];
      // headerSize represents total header size from byte 0 (includes BLTE magic + headerSize field)
      // So data starts at byte headerSize, not 8 + headerSize
      dataOffset = headerSize;

      console.log(`[BLTEDecompressor] Header size: ${headerSize}, Chunk count: ${chunkCount}`);
      console.log(`[BLTEDecompressor] Data will start at offset: ${headerSize}`);
      logger.debug('BLTEDecompressor', `Decompressing ${chunkCount} chunks`);

      // Read chunk info table
      let chunkInfoOffset = 12;
      for (let i = 0; i < chunkCount; i++) {
        const compressedSize = data.readUInt32BE(chunkInfoOffset);
        const decompressedSize = data.readUInt32BE(chunkInfoOffset + 4);
        const checksum = data.subarray(chunkInfoOffset + 8, chunkInfoOffset + 24);

        console.log(`[BLTEDecompressor] Chunk ${i}: compressed=${compressedSize}, decompressed=${decompressedSize}`);

        chunks.push({
          compressedSize,
          decompressedSize,
          checksum
        });

        chunkInfoOffset += 24;
      }
      console.log(`[BLTEDecompressor] Chunk table ends at offset: ${chunkInfoOffset}`);
    } else {
      // Single chunk (entire file)
      chunks.push({
        compressedSize: data.length - 8,
        decompressedSize: 0, // Unknown
        checksum: Buffer.alloc(0)
      });
    }

    // Decompress chunks
    const decompressedChunks: Buffer[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      console.log(`[BLTEDecompressor] Extracting chunk ${i} from offset ${dataOffset}, size ${chunk.compressedSize}`);
      const chunkData = data.subarray(dataOffset, dataOffset + chunk.compressedSize);
      console.log(`[BLTEDecompressor] Chunk ${i} first 16 bytes: ${chunkData.subarray(0, Math.min(16, chunkData.length)).toString('hex')}`);
      console.log(`[BLTEDecompressor] Chunk ${i} encoding type byte: 0x${chunkData[0].toString(16)}`);
      const decompressed = this.decompressChunk(chunkData);
      decompressedChunks.push(decompressed);
      dataOffset += chunk.compressedSize;
    }

    // Concatenate all chunks
    return Buffer.concat(decompressedChunks);
  }

  /**
   * Decompress a single BLTE chunk
   */
  private static decompressChunk(chunkData: Buffer): Buffer {
    // First byte indicates encoding type
    const encoding = chunkData[0];

    // Actual data starts at byte 1
    const data = chunkData.subarray(1);

    switch (encoding) {
      case BLTEEncoding.NONE:
        // No compression, return as-is
        logger.debug('BLTEDecompressor', 'Chunk: Uncompressed');
        return data;

      case BLTEEncoding.ZLIB:
        // Zlib compressed
        logger.debug('BLTEDecompressor', 'Chunk: Zlib compressed');
        try {
          return zlib.inflateSync(data);
        } catch (error: any) {
          throw new Error(`Zlib decompression failed: ${error.message}`);
        }

      case BLTEEncoding.ENCRYPTED:
        throw new Error('Encrypted BLTE chunks not supported');

      case BLTEEncoding.RECURSIVE:
        // Recursively decompress
        logger.debug('BLTEDecompressor', 'Chunk: Recursive BLTE');
        return this.decompress(data);

      default:
        throw new Error(`Unknown BLTE encoding: 0x${encoding.toString(16)}`);
    }
  }

  /**
   * Check if data is BLTE-encoded
   */
  static isBLTE(data: Buffer): boolean {
    if (data.length < 4) return false;
    return data.toString('ascii', 0, 4) === 'BLTE';
  }
}
