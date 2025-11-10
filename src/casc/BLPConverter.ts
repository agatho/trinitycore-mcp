/**
 * BLP (Blizzard Picture) to PNG Converter
 *
 * Converts WoW's BLP texture format to standard PNG images.
 * Supports BLP0, BLP1, and BLP2 formats.
 *
 * @module BLPConverter
 */

import fs from 'fs/promises';
import { PNG } from 'pngjs';
import { Logger } from '../lib/logger.js';
import { FileSystemError } from '../lib/errors.js';

/**
 * BLP format version
 */
export enum BLPFormat {
  BLP0 = 'BLP0',
  BLP1 = 'BLP1',
  BLP2 = 'BLP2'
}

/**
 * BLP compression type
 */
export enum BLPCompression {
  JPEG = 0,
  UNCOMPRESSED = 1,
  DXT = 2,
  UNCOMPRESSED_BGRA = 3
}

/**
 * BLP header structure
 */
interface BLPHeader {
  magic: string;
  version: number;
  compression: BLPCompression;
  alphaDepth: number;
  alphaEncoding: number;
  hasMips: number;
  width: number;
  height: number;
  mipOffsets: number[];
  mipSizes: number[];
}

/**
 * BLP to PNG converter
 */
export class BLPConverter {
  /**
   * Convert BLP file to PNG
   *
   * @param blpPath - Path to BLP file
   * @param pngPath - Output PNG path
   * @param mipLevel - Mipmap level to extract (0 = full resolution)
   */
  static async convertToPNG(
    blpPath: string,
    pngPath: string,
    mipLevel: number = 0
  ): Promise<void> {
    Logger.debug('BLPConverter', `Converting ${blpPath} to ${pngPath}`);

    try {
      // Read BLP file
      const blpData = await fs.readFile(blpPath);

      // Parse header
      const header = this.parseHeader(blpData);

      // Validate mip level
      if (mipLevel >= header.mipOffsets.length) {
        throw new FileSystemError(
          blpPath,
          `Invalid mip level ${mipLevel}. Max: ${header.mipOffsets.length - 1}`
        );
      }

      // Extract pixel data for specified mip level
      const { width, height } = this.getMipDimensions(header, mipLevel);
      const pixelData = await this.extractPixels(blpData, header, mipLevel);

      // Create PNG
      const png = new PNG({ width, height });
      png.data = Buffer.from(pixelData);

      // Write PNG file
      await this.writePNG(png, pngPath);

      logger.debug('BLPConverter', `Converted ${blpPath} to ${pngPath} (${width}x${height})`);
    } catch (error: any) {
      throw new DatabaseError(
        `Failed to convert BLP to PNG (${blpPath}): ${error.message}`
      );
    }
  }

  /**
   * Parse BLP header
   */
  private static parseHeader(data: Buffer): BLPHeader {
    const magic = data.toString('ascii', 0, 4);

    if (magic !== 'BLP0' && magic !== 'BLP1' && magic !== 'BLP2') {
      throw new Error(`Invalid BLP magic: ${magic}`);
    }

    const header: BLPHeader = {
      magic,
      version: data.readUInt32LE(4),
      compression: data.readUInt8(8),
      alphaDepth: data.readUInt8(9),
      alphaEncoding: data.readUInt8(10),
      hasMips: data.readUInt8(11),
      width: data.readUInt32LE(12),
      height: data.readUInt32LE(16),
      mipOffsets: [],
      mipSizes: []
    };

    // Read mipmap offsets and sizes (16 levels max)
    for (let i = 0; i < 16; i++) {
      const offset = data.readUInt32LE(20 + i * 4);
      const size = data.readUInt32LE(84 + i * 4);

      if (offset > 0 && size > 0) {
        header.mipOffsets.push(offset);
        header.mipSizes.push(size);
      }
    }

    return header;
  }

  /**
   * Get dimensions for specific mip level
   */
  private static getMipDimensions(
    header: BLPHeader,
    mipLevel: number
  ): { width: number; height: number } {
    const divisor = Math.pow(2, mipLevel);
    return {
      width: Math.max(1, Math.floor(header.width / divisor)),
      height: Math.max(1, Math.floor(header.height / divisor))
    };
  }

  /**
   * Extract pixel data from BLP
   */
  private static async extractPixels(
    data: Buffer,
    header: BLPHeader,
    mipLevel: number
  ): Promise<Uint8Array> {
    const { width, height } = this.getMipDimensions(header, mipLevel);
    const offset = header.mipOffsets[mipLevel];
    const size = header.mipSizes[mipLevel];

    switch (header.compression) {
      case BLPCompression.UNCOMPRESSED:
      case BLPCompression.UNCOMPRESSED_BGRA:
        return this.extractUncompressed(data, offset, size, width, height, header);

      case BLPCompression.DXT:
        return this.extractDXT(data, offset, size, width, height, header);

      case BLPCompression.JPEG:
        throw new Error('JPEG compression not yet supported');

      default:
        throw new Error(`Unknown compression type: ${header.compression}`);
    }
  }

  /**
   * Extract uncompressed pixel data
   */
  private static extractUncompressed(
    data: Buffer,
    offset: number,
    size: number,
    width: number,
    height: number,
    header: BLPHeader
  ): Uint8Array {
    const pixels = new Uint8Array(width * height * 4);
    const palette = this.readPalette(data);

    let pixelIdx = 0;
    for (let i = 0; i < width * height; i++) {
      const paletteIdx = data[offset + i];
      const color = palette[paletteIdx];

      pixels[pixelIdx++] = color.r;
      pixels[pixelIdx++] = color.g;
      pixels[pixelIdx++] = color.b;
      pixels[pixelIdx++] = 255; // Alpha
    }

    return pixels;
  }

  /**
   * Extract DXT compressed pixel data
   */
  private static extractDXT(
    data: Buffer,
    offset: number,
    size: number,
    width: number,
    height: number,
    header: BLPHeader
  ): Uint8Array {
    // Simplified DXT1/DXT3/DXT5 decompression
    // Full implementation would handle all DXT variants
    const pixels = new Uint8Array(width * height * 4);

    // DXT compression uses 4x4 blocks
    const blocksWide = Math.ceil(width / 4);
    const blocksHigh = Math.ceil(height / 4);

    // Placeholder: Fill with pink to indicate DXT decoding needed
    for (let i = 0; i < pixels.length; i += 4) {
      pixels[i] = 255;     // R
      pixels[i + 1] = 0;   // G
      pixels[i + 2] = 255; // B
      pixels[i + 3] = 255; // A
    }

    Logger.warn(
      'BLPConverter',
      'DXT decompression not fully implemented. Output will be pink placeholder.'
    );

    return pixels;
  }

  /**
   * Read color palette from BLP
   */
  private static readPalette(data: Buffer): Array<{ r: number; g: number; b: number; a: number }> {
    const palette: Array<{ r: number; g: number; b: number; a: number }> = [];
    const paletteOffset = 148; // After header

    for (let i = 0; i < 256; i++) {
      const offset = paletteOffset + i * 4;
      palette.push({
        b: data[offset],
        g: data[offset + 1],
        r: data[offset + 2],
        a: data[offset + 3]
      });
    }

    return palette;
  }

  /**
   * Write PNG to file
   */
  private static async writePNG(png: PNG, outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const stream = fs.open(outputPath, 'w')
        .then(handle => handle.createWriteStream());

      stream
        .then(ws => {
          png.pack().pipe(ws);
          ws.on('finish', resolve);
          ws.on('error', reject);
        })
        .catch(reject);
    });
  }

  /**
   * Batch convert BLP files to PNG
   */
  static async convertBatch(
    blpFiles: string[],
    outputDir: string,
    mipLevel: number = 0
  ): Promise<string[]> {
    const outputFiles: string[] = [];

    for (const blpFile of blpFiles) {
      try {
        const baseName = blpFile.replace(/\.blp$/i, '');
        const pngPath = `${outputDir}/${baseName}.png`;
        await this.convertToPNG(blpFile, pngPath, mipLevel);
        outputFiles.push(pngPath);
      } catch (error) {
        Logger.error('BLPConverter', error, { file: blpFile });
      }
    }

    return outputFiles;
  }
}
