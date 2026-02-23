/**
 * CASC ListFile Manager
 *
 * Manages the mapping between FileDataIDs and file paths.
 * Modern WoW uses FileDataID-based CASC, so we need a listfile
 * to translate numeric IDs to human-readable paths.
 *
 * @module casc/CASCListFile
 */

import fs from 'fs/promises';
import path from 'path';
import { logger } from '../utils/logger.js';

/**
 * CASC ListFile Manager
 *
 * Loads and manages FileDataID → Path mappings from community listfile.
 */
export class CASCListFile {
  private fileDataToPath: Map<number, string> = new Map();
  private pathToFileData: Map<string, number> = new Map();
  private loaded = false;

  /**
   * Load listfile from CSV file
   *
   * Format: FileDataID;Path
   * Example: 270450;interface/worldmap/azeroth/azeroth11.blp
   *
   * @param listFilePath - Path to listfile CSV
   */
  async loadListFile(listFilePath: string): Promise<void> {
    try {
      logger.info('CASCListFile', `Loading listfile from: ${listFilePath}`);
      console.log(`[CASCListFile] Loading listfile: ${listFilePath}`);

      const content = await fs.readFile(listFilePath, 'utf8');
      const lines = content.split('\n');

      let validEntries = 0;
      let invalidEntries = 0;

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        // Format: FileDataID;Path
        const parts = trimmed.split(';');
        if (parts.length !== 2) {
          invalidEntries++;
          continue;
        }

        const fileDataId = parseInt(parts[0], 10);
        const filePath = parts[1].toLowerCase(); // Normalize to lowercase

        if (isNaN(fileDataId)) {
          invalidEntries++;
          continue;
        }

        this.fileDataToPath.set(fileDataId, filePath);
        this.pathToFileData.set(filePath, fileDataId);
        validEntries++;
      }

      this.loaded = true;

      console.log(`[CASCListFile] Loaded ${validEntries} listfile entries (${invalidEntries} invalid)`);
      logger.info('CASCListFile', `Loaded ${validEntries} listfile entries`);
    } catch (error) {
      logger.error('CASCListFile', error as Error, { listFilePath });
      throw new Error(`Failed to load listfile: ${(error as Error).message}`);
    }
  }

  /**
   * Get file path for a FileDataID
   *
   * @param fileDataId - Numeric FileDataID
   * @returns File path or null if not found
   */
  getPath(fileDataId: number): string | null {
    return this.fileDataToPath.get(fileDataId) || null;
  }

  /**
   * Get FileDataID for a file path
   *
   * @param filePath - File path (case-insensitive)
   * @returns FileDataID or null if not found
   */
  getFileDataId(filePath: string): number | null {
    const normalized = filePath.toLowerCase();
    return this.pathToFileData.get(normalized) || null;
  }

  /**
   * Check if listfile is loaded
   */
  isLoaded(): boolean {
    return this.loaded;
  }

  /**
   * Get total number of entries
   */
  getEntryCount(): number {
    return this.fileDataToPath.size;
  }

  /**
   * Parse FileDataID from hex string
   *
   * TVFS root stores FileDataIDs as hex strings like "000000020000"
   *
   * @param hexStr - Hex string FileDataID
   * @returns Decimal FileDataID
   */
  static parseFileDataId(hexStr: string): number {
    // TVFS files use encoded names in format:
    // LLLLLLLLCCCC:FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF
    // Where positions 13-20 (8 hex chars after ':') contain the FileDataID

    // Check for WoW generic format (52-53 chars with ':' at position 12)
    if (hexStr.length >= 52 && hexStr[12] === ':') {
      // Extract FileDataID from positions 13-20 (8 hex digits = 4 bytes)
      const fileDataIdHex = hexStr.substring(13, 21);
      return parseInt(fileDataIdHex, 16);
    }

    // Fallback: parse entire string as hex (for folder IDs, etc.)
    return parseInt(hexStr, 16);
  }

  /**
   * Convert FileDataID to hex string format
   *
   * @param fileDataId - Decimal FileDataID
   * @returns Hex string (12 chars, zero-padded)
   */
  static toHexString(fileDataId: number): string {
    return fileDataId.toString(16).padStart(12, '0');
  }
}
