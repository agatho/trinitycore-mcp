/**
 * DXT Texture Decompression
 *
 * Handles DXT1, DXT3, and DXT5 texture decompression for BLP files.
 *
 * @module DXTDecompressor
 */

export interface Color {
  r: number;
  g: number;
  b: number;
  a: number;
}

/**
 * DXT texture decompressor
 */
export class DXTDecompressor {
  /**
   * Decompress DXT1/DXT3/DXT5 texture data to RGBA8888
   *
   * @param data - Compressed DXT data
   * @param width - Image width
   * @param height - Image height
   * @param alphaDepth - Alpha channel depth (0 for DXT1, 8 for DXT3/5)
   * @param alphaEncoding - Alpha encoding (0=none, 1=DXT3, 7=DXT5)
   * @returns Decompressed RGBA pixel data
   */
  static decompress(
    data: Buffer,
    width: number,
    height: number,
    alphaDepth: number,
    alphaEncoding: number
  ): Uint8Array {
    const pixels = new Uint8Array(width * height * 4);

    // DXT compression uses 4x4 blocks
    const blocksWide = Math.ceil(width / 4);
    const blocksHigh = Math.ceil(height / 4);

    // Determine DXT variant
    const isDXT1 = alphaDepth === 0 || alphaEncoding === 0;
    const isDXT3 = alphaDepth === 8 && alphaEncoding === 1;
    const isDXT5 = alphaDepth === 8 && alphaEncoding === 7;

    let dataOffset = 0;

    for (let blockY = 0; blockY < blocksHigh; blockY++) {
      for (let blockX = 0; blockX < blocksWide; blockX++) {
        // Read alpha data for DXT3/DXT5
        let alphaData: number[] | null = null;
        if (isDXT3) {
          alphaData = this.decodeDXT3Alpha(data, dataOffset);
          dataOffset += 8;
        } else if (isDXT5) {
          alphaData = this.decodeDXT5Alpha(data, dataOffset);
          dataOffset += 8;
        }

        // Read color data (same for all DXT variants)
        const color0 = data.readUInt16LE(dataOffset);
        const color1 = data.readUInt16LE(dataOffset + 2);
        const colorIndices = data.readUInt32LE(dataOffset + 4);
        dataOffset += 8;

        // Decode RGB565 colors
        const colors = this.interpolateDXTColors(color0, color1, isDXT1);

        // Write block pixels
        for (let y = 0; y < 4; y++) {
          for (let x = 0; x < 4; x++) {
            const pixelX = blockX * 4 + x;
            const pixelY = blockY * 4 + y;

            if (pixelX >= width || pixelY >= height) continue;

            const colorIndex = (colorIndices >> ((y * 4 + x) * 2)) & 0x3;
            const color = colors[colorIndex];
            const pixelIndex = (pixelY * width + pixelX) * 4;

            pixels[pixelIndex] = color.r;
            pixels[pixelIndex + 1] = color.g;
            pixels[pixelIndex + 2] = color.b;
            pixels[pixelIndex + 3] = alphaData ? alphaData[y * 4 + x] : color.a;
          }
        }
      }
    }

    return pixels;
  }

  /**
   * Interpolate DXT colors from RGB565 color0 and color1
   */
  private static interpolateDXTColors(
    color0: number,
    color1: number,
    isDXT1: boolean
  ): Color[] {
    // Decode RGB565
    const r0 = (color0 >> 11) & 0x1F;
    const g0 = (color0 >> 5) & 0x3F;
    const b0 = color0 & 0x1F;

    const r1 = (color1 >> 11) & 0x1F;
    const g1 = (color1 >> 5) & 0x3F;
    const b1 = color1 & 0x1F;

    // Expand to 8-bit
    const colors: Color[] = [
      { r: (r0 << 3) | (r0 >> 2), g: (g0 << 2) | (g0 >> 4), b: (b0 << 3) | (b0 >> 2), a: 255 },
      { r: (r1 << 3) | (r1 >> 2), g: (g1 << 2) | (g1 >> 4), b: (b1 << 3) | (b1 >> 2), a: 255 },
      { r: 0, g: 0, b: 0, a: 255 },
      { r: 0, g: 0, b: 0, a: 255 }
    ];

    if (color0 > color1 || !isDXT1) {
      // 4-color mode
      colors[2].r = Math.floor((2 * colors[0].r + colors[1].r) / 3);
      colors[2].g = Math.floor((2 * colors[0].g + colors[1].g) / 3);
      colors[2].b = Math.floor((2 * colors[0].b + colors[1].b) / 3);

      colors[3].r = Math.floor((colors[0].r + 2 * colors[1].r) / 3);
      colors[3].g = Math.floor((colors[0].g + 2 * colors[1].g) / 3);
      colors[3].b = Math.floor((colors[0].b + 2 * colors[1].b) / 3);
    } else {
      // 3-color mode (DXT1 transparent)
      colors[2].r = Math.floor((colors[0].r + colors[1].r) / 2);
      colors[2].g = Math.floor((colors[0].g + colors[1].g) / 2);
      colors[2].b = Math.floor((colors[0].b + colors[1].b) / 2);

      colors[3].r = 0;
      colors[3].g = 0;
      colors[3].b = 0;
      colors[3].a = 0; // Transparent
    }

    return colors;
  }

  /**
   * Decode DXT3 explicit alpha (4 bits per pixel)
   */
  private static decodeDXT3Alpha(data: Buffer, offset: number): number[] {
    const alpha: number[] = [];
    for (let i = 0; i < 8; i++) {
      const byte = data[offset + i];
      alpha.push((byte & 0x0F) * 17); // Low nibble, scale 0-15 to 0-255
      alpha.push((byte >> 4) * 17);   // High nibble
    }
    return alpha;
  }

  /**
   * Decode DXT5 interpolated alpha
   */
  private static decodeDXT5Alpha(data: Buffer, offset: number): number[] {
    const alpha0 = data[offset];
    const alpha1 = data[offset + 1];

    // Build lookup table
    const alphas = [alpha0, alpha1];
    if (alpha0 > alpha1) {
      // 8-alpha block
      for (let i = 1; i < 7; i++) {
        alphas.push(Math.floor(((7 - i) * alpha0 + i * alpha1) / 7));
      }
    } else {
      // 6-alpha block
      for (let i = 1; i < 5; i++) {
        alphas.push(Math.floor(((5 - i) * alpha0 + i * alpha1) / 5));
      }
      alphas.push(0);
      alphas.push(255);
    }

    // Read 48-bit alpha indices (3 bits per pixel, 16 pixels)
    const indices: number[] = [];
    let bits = 0;
    let bitCount = 0;

    for (let i = 2; i < 8; i++) {
      bits |= data[offset + i] << bitCount;
      bitCount += 8;

      while (bitCount >= 3 && indices.length < 16) {
        indices.push(bits & 0x7);
        bits >>= 3;
        bitCount -= 3;
      }
    }

    return indices.map(idx => alphas[idx]);
  }
}
