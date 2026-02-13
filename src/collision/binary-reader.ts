/**
 * Binary Reader for VMap Files (Server-Side)
 *
 * Reads binary data from Node.js Buffer with automatic offset tracking.
 * Adapted from web-ui/lib/vmap-parser.ts BinaryReader for server-side use.
 *
 * @module collision/binary-reader
 */

import type { Vector3, AABox } from "./types";

/**
 * Binary data reader with automatic offset tracking.
 * All multi-byte reads use little-endian byte order (x86 native).
 */
export class BinaryReader {
  private offset: number = 0;

  constructor(private buffer: Buffer) {}

  getOffset(): number {
    return this.offset;
  }

  setOffset(offset: number): void {
    if (offset < 0 || offset > this.buffer.length) {
      throw new Error(`Invalid offset: ${offset} (buffer size: ${this.buffer.length})`);
    }
    this.offset = offset;
  }

  skip(bytes: number): void {
    this.offset += bytes;
  }

  remaining(): number {
    return this.buffer.length - this.offset;
  }

  private checkBounds(size: number): void {
    if (this.offset + size > this.buffer.length) {
      throw new Error(
        `Buffer overflow: trying to read ${size} bytes at offset ${this.offset}, buffer is ${this.buffer.length} bytes`,
      );
    }
  }

  readUInt8(): number {
    this.checkBounds(1);
    const value = this.buffer.readUInt8(this.offset);
    this.offset += 1;
    return value;
  }

  readUInt16LE(): number {
    this.checkBounds(2);
    const value = this.buffer.readUInt16LE(this.offset);
    this.offset += 2;
    return value;
  }

  readInt32LE(): number {
    this.checkBounds(4);
    const value = this.buffer.readInt32LE(this.offset);
    this.offset += 4;
    return value;
  }

  readUInt32LE(): number {
    this.checkBounds(4);
    const value = this.buffer.readUInt32LE(this.offset);
    this.offset += 4;
    return value;
  }

  readFloatLE(): number {
    this.checkBounds(4);
    const value = this.buffer.readFloatLE(this.offset);
    this.offset += 4;
    return value;
  }

  readString(length: number): string {
    this.checkBounds(length);
    const slice = this.buffer.subarray(this.offset, this.offset + length);
    this.offset += length;

    // Find null terminator
    let endIdx = slice.length;
    for (let i = 0; i < slice.length; i++) {
      if (slice[i] === 0) {
        endIdx = i;
        break;
      }
    }

    return slice.subarray(0, endIdx).toString("utf-8");
  }

  readVector3(): Vector3 {
    return {
      x: this.readFloatLE(),
      y: this.readFloatLE(),
      z: this.readFloatLE(),
    };
  }

  readAABox(): AABox {
    return {
      min: this.readVector3(),
      max: this.readVector3(),
    };
  }
}
