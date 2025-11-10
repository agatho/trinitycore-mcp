/**
 * CASC Data File Reader
 *
 * Reads BLTE-encoded data from CASC archive files (data.XXX).
 * Uses index files to locate data blocks within archives.
 *
 * @module casc/CASCDataReader
 */

import fs from 'fs/promises';
import path from 'path';
import { logger } from '../utils/logger.js';
import { BLTEDecompressor } from './BLTEDecompressor.js';

/**
 * CASC data file reader
 */
export class CASCDataReader {
  private dataPath: string;
  private archiveHandles: Map<number, fs.FileHandle> = new Map();

  constructor(dataPath: string) {
    this.dataPath = dataPath;
  }

  /**
   * Read data from archive file at specified offset and size
   *
   * @param archive - Archive number (e.g., 0 for data.000)
   * @param offset - Offset in archive file
   * @param size - Size of data to read
   * @returns Decompressed data
   */
  async readData(archive: number, offset: number, size: number): Promise<Buffer> {
    logger.debug('CASCDataReader', `Reading archive ${archive} at offset ${offset}, size ${size}`);

    try {
      // Get or open archive file handle
      const handle = await this.getArchiveHandle(archive);

      // Read BLTE-encoded data
      const buffer = Buffer.allocUnsafe(size);
      await handle.read(buffer, 0, size, offset);

      // Check if data is BLTE-encoded
      if (BLTEDecompressor.isBLTE(buffer)) {
        logger.debug('CASCDataReader', 'Decompressing BLTE data');
        return BLTEDecompressor.decompress(buffer);
      }

      // Return raw data if not BLTE-encoded
      logger.debug('CASCDataReader', 'Returning raw data (not BLTE)');
      return buffer;
    } catch (error) {
      logger.error('CASCDataReader', error as Error, {
        archive,
        offset,
        size
      });
      throw error;
    }
  }

  /**
   * Get or open archive file handle
   */
  private async getArchiveHandle(archive: number): Promise<fs.FileHandle> {
    // Check if already open
    if (this.archiveHandles.has(archive)) {
      return this.archiveHandles.get(archive)!;
    }

    // Open archive file
    const archivePath = this.getArchivePath(archive);
    logger.debug('CASCDataReader', `Opening archive: ${archivePath}`);

    try {
      const handle = await fs.open(archivePath, 'r');
      this.archiveHandles.set(archive, handle);
      return handle;
    } catch (error) {
      throw new Error(`Failed to open archive ${archivePath}: ${(error as Error).message}`);
    }
  }

  /**
   * Get archive file path
   */
  private getArchivePath(archive: number): string {
    // Archive files are named: data.000, data.001, etc.
    const archiveNum = archive.toString().padStart(3, '0');
    return path.join(this.dataPath, `data.${archiveNum}`);
  }

  /**
   * Close all open archive handles
   */
  async close(): Promise<void> {
    logger.debug('CASCDataReader', `Closing ${this.archiveHandles.size} archive handles`);

    for (const [archive, handle] of this.archiveHandles) {
      try {
        await handle.close();
      } catch (error) {
        logger.warn('CASCDataReader', `Failed to close archive ${archive}`, {
          error: error as Error
        });
      }
    }

    this.archiveHandles.clear();
  }

  /**
   * Check if archive file exists
   */
  async archiveExists(archive: number): Promise<boolean> {
    const archivePath = this.getArchivePath(archive);
    try {
      await fs.access(archivePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get list of available archive files
   */
  async listArchives(): Promise<number[]> {
    const archives: number[] = [];

    try {
      const files = await fs.readdir(this.dataPath);

      for (const file of files) {
        const match = file.match(/^data\.(\d{3})$/);
        if (match) {
          archives.push(parseInt(match[1], 10));
        }
      }

      archives.sort((a, b) => a - b);
      logger.debug('CASCDataReader', `Found ${archives.length} archive files`);
      return archives;
    } catch (error) {
      logger.error('CASCDataReader', error as Error, {
        dataPath: this.dataPath
      });
      return [];
    }
  }
}
