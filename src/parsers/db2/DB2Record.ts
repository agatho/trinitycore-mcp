/**
 * DB2 Record accessor for WoW 11.2 (The War Within)
 * Based on TrinityCore's DB2Record implementation
 */

import { DB2ColumnCompression, DB2ColumnMeta } from './DB2Header';

/**
 * DB2 Record accessor
 * Provides typed access to fields with compression support
 */
export class DB2Record {
  private recordData: Buffer;
  private stringBlock: Buffer;
  private columnMeta: DB2ColumnMeta[];
  private recordIndex: number;

  constructor(
    recordData: Buffer,
    stringBlock: Buffer,
    columnMeta: DB2ColumnMeta[],
    recordIndex: number
  ) {
    this.recordData = recordData;
    this.stringBlock = stringBlock;
    this.columnMeta = columnMeta;
    this.recordIndex = recordIndex;
  }

  /**
   * Get record ID (typically field 0)
   * @returns Record ID
   */
  public getId(): number {
    return this.getUInt32(0, 0);
  }

  /**
   * Get uint8 field value
   * @param field Field index
   * @param arrayIndex Array index within field (default 0)
   * @returns Unsigned 8-bit integer
   */
  public getUInt8(field: number, arrayIndex: number = 0): number {
    return this.recordData.readUInt8(this.getFieldOffset(field, arrayIndex));
  }

  /**
   * Get uint16 field value
   * @param field Field index
   * @param arrayIndex Array index within field (default 0)
   * @returns Unsigned 16-bit integer
   */
  public getUInt16(field: number, arrayIndex: number = 0): number {
    return this.recordData.readUInt16LE(this.getFieldOffset(field, arrayIndex));
  }

  /**
   * Get uint32 field value
   * @param field Field index
   * @param arrayIndex Array index within field (default 0)
   * @returns Unsigned 32-bit integer
   */
  public getUInt32(field: number, arrayIndex: number = 0): number {
    const meta = this.getColumnMeta(field);

    if (!meta) {
      // No compression metadata, read raw
      return this.recordData.readUInt32LE(this.getFieldOffset(field, arrayIndex));
    }

    // Handle compression
    return this.readCompressedField(meta, arrayIndex);
  }

  /**
   * Get int32 field value
   * @param field Field index
   * @param arrayIndex Array index within field (default 0)
   * @returns Signed 32-bit integer
   */
  public getInt32(field: number, arrayIndex: number = 0): number {
    const value = this.getUInt32(field, arrayIndex);
    return value | 0; // Convert to signed
  }

  /**
   * Get uint64 field value
   * @param field Field index
   * @param arrayIndex Array index within field (default 0)
   * @returns Unsigned 64-bit integer as BigInt
   */
  public getUInt64(field: number, arrayIndex: number = 0): bigint {
    const offset = this.getFieldOffset(field, arrayIndex);
    return this.recordData.readBigUInt64LE(offset);
  }

  /**
   * Get float field value
   * @param field Field index
   * @param arrayIndex Array index within field (default 0)
   * @returns 32-bit floating point number
   */
  public getFloat(field: number, arrayIndex: number = 0): number {
    return this.recordData.readFloatLE(this.getFieldOffset(field, arrayIndex));
  }

  /**
   * Get string field value
   * @param field Field index
   * @param arrayIndex Array index within field (default 0)
   * @returns String from string block
   */
  public getString(field: number, arrayIndex: number = 0): string {
    const stringOffset = this.getUInt32(field, arrayIndex);

    if (stringOffset === 0 || stringOffset >= this.stringBlock.length) {
      return '';
    }

    // Find null terminator
    const nullIndex = this.stringBlock.indexOf(0, stringOffset);
    if (nullIndex === -1) {
      return this.stringBlock.toString('utf8', stringOffset);
    }

    return this.stringBlock.toString('utf8', stringOffset, nullIndex);
  }

  /**
   * Get column metadata for field
   * @param field Field index
   * @returns Column metadata or null
   */
  private getColumnMeta(field: number): DB2ColumnMeta | null {
    if (field < 0 || field >= this.columnMeta.length) {
      return null;
    }
    return this.columnMeta[field];
  }

  /**
   * Get field offset in record data
   * @param field Field index
   * @param arrayIndex Array index
   * @returns Byte offset
   */
  private getFieldOffset(field: number, arrayIndex: number): number {
    const meta = this.getColumnMeta(field);
    if (!meta) {
      // Assume 4-byte fields if no metadata
      return (field + arrayIndex) * 4;
    }

    return (meta.bitOffset + arrayIndex * meta.bitSize) / 8;
  }

  /**
   * Read compressed field value
   * @param meta Column metadata
   * @param arrayIndex Array index
   * @returns Decompressed value
   */
  private readCompressedField(meta: DB2ColumnMeta, arrayIndex: number): number {
    switch (meta.compressionType) {
      case DB2ColumnCompression.None:
        return this.recordData.readUInt32LE(meta.bitOffset / 8 + arrayIndex * 4);

      case DB2ColumnCompression.Immediate:
        if (!meta.compressionData.immediate) {
          throw new Error('Missing immediate compression data');
        }
        return Number(
          this.getPackedValue(
            meta.compressionData.immediate.bitOffset + arrayIndex * meta.compressionData.immediate.bitWidth,
            meta.compressionData.immediate.bitWidth
          )
        );

      case DB2ColumnCompression.CommonData:
        if (!meta.compressionData.commonData) {
          throw new Error('Missing common data compression data');
        }
        return meta.compressionData.commonData.value;

      case DB2ColumnCompression.Pallet:
        if (!meta.compressionData.pallet) {
          throw new Error('Missing pallet compression data');
        }
        // Pallet requires external pallet values - simplified for now
        return 0;

      case DB2ColumnCompression.PalletArray:
        if (!meta.compressionData.pallet) {
          throw new Error('Missing pallet array compression data');
        }
        return 0;

      case DB2ColumnCompression.SignedImmediate:
        if (!meta.compressionData.immediate) {
          throw new Error('Missing signed immediate compression data');
        }
        const value = this.getPackedValue(
          meta.compressionData.immediate.bitOffset + arrayIndex * meta.compressionData.immediate.bitWidth,
          meta.compressionData.immediate.bitWidth
        );
        // Sign-extend if needed
        if (meta.compressionData.immediate.signed) {
          const signBit = 1n << BigInt(meta.compressionData.immediate.bitWidth - 1);
          if (value & signBit) {
            const mask = (1n << BigInt(meta.compressionData.immediate.bitWidth)) - 1n;
            return Number(value | ~mask);
          }
        }
        return Number(value);

      default:
        throw new Error(`Unknown compression type: ${meta.compressionType}`);
    }
  }

  /**
   * Read bitpacked value from record data
   * @param bitOffset Bit offset in record
   * @param bitWidth Number of bits to read
   * @returns Packed value as BigInt
   */
  private getPackedValue(bitOffset: number, bitWidth: number): bigint {
    const byteOffset = Math.floor(bitOffset / 8);
    const bitInByteOffset = bitOffset % 8;

    // Read up to 8 bytes (64 bits max)
    let value = 0n;
    const bytesToRead = Math.ceil((bitWidth + bitInByteOffset) / 8);

    for (let i = 0; i < bytesToRead && byteOffset + i < this.recordData.length; i++) {
      value |= BigInt(this.recordData[byteOffset + i]) << BigInt(i * 8);
    }

    // Shift and mask
    value >>= BigInt(bitInByteOffset);
    const mask = (1n << BigInt(bitWidth)) - 1n;
    return value & mask;
  }
}
