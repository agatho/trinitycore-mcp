/**
 * DB2 Record accessor for WoW 12.0 (Midnight)
 * Based on TrinityCore's DB2Record implementation
 */

import { DB2ColumnCompression, DB2ColumnMeta, DB2FieldEntry } from './DB2Header';

/**
 * DB2 Record accessor
 * Provides typed access to fields with compression support
 */
export class DB2Record {
  private recordData: Buffer;
  private stringBlock: Buffer;
  private columnMeta: DB2ColumnMeta[];
  private fieldEntries: DB2FieldEntry[];
  private recordIndex: number;
  private recordId: number | null; // For sparse files, ID comes from catalog
  private isSparseFile: boolean; // True for sparse files (Spell.db2), false for inline files (SpellName.db2)
  private recordSize: number; // Size of a single record (for inline files)
  private recordCount: number; // Total record count in section (for inline files)
  private sectionFileOffset: number; // File offset where section's records begin (for string offset calculation)
  private stringOffsetCorrection: number; // Correction to translate TrinityCore combined-buffer offsets to per-section buffer positions
  /** Per-field pallet value tables (Pallet / PalletArray compression). */
  private palletValues: number[][];
  /** Per-field record-id -> value maps (CommonData compression). */
  private commonValues: Map<number, number>[];
  /** header.packedDataOffset - base for bit-packed and pallet field offsets. */
  private packedDataOffset: number;
  /**
   * Byte offset of this record within recordData. Dense records sit at
   * recordIndex * recordSize; sparse records are variable length and are placed
   * by the catalog, so their offset is supplied directly.
   */
  private recordBaseOffset: number;
  /**
   * Field element positions within a sparse record, indexed [field][arrayIndex]
   * and relative to recordBaseOffset. Null for dense records, whose offsets come
   * from the file's own field metadata.
   */
  private sparseFieldOffsets: number[][] | null;

  constructor(
    recordData: Buffer,
    stringBlock: Buffer,
    columnMeta: DB2ColumnMeta[],
    recordIndex: number,
    fieldEntries?: DB2FieldEntry[],
    recordId?: number, // Optional: For sparse files where ID is in catalog, or inline files where ID is in ID list
    isSparseFile?: boolean, // Optional: Indicates file type (true = sparse/variable-size records, false = inline/fixed-size records)
    recordSize?: number, // Optional: Record size (for inline files to calculate string table offset)
    recordCount?: number, // Optional: Total records in section (for inline files to calculate string table offset)
    sectionFileOffset?: number, // Optional: File offset where section begins (for inline files to calculate string offset)
    stringOffsetCorrection?: number, // Optional: Correction for translating raw string offsets to per-section buffer positions
    palletValues?: number[][], // Optional: per-field pallet tables (compressed fields)
    commonValues?: Map<number, number>[], // Optional: per-field common-value maps
    packedDataOffset?: number, // Optional: header.packedDataOffset for packed field addressing
    recordDataOffset?: number, // Optional: explicit byte offset of this record (sparse files)
    sparseFieldOffsets?: number[][] // Optional: per-record field positions (sparse files)
  ) {
    this.recordData = recordData;
    this.stringBlock = stringBlock;
    this.columnMeta = columnMeta;
    this.fieldEntries = fieldEntries || [];
    this.recordIndex = recordIndex;
    this.recordId = recordId !== undefined ? recordId : null;
    this.isSparseFile = isSparseFile !== undefined ? isSparseFile : false;
    this.recordSize = recordSize || recordData.length;
    this.recordCount = recordCount || 0;
    this.sectionFileOffset = sectionFileOffset || 0;
    this.stringOffsetCorrection = stringOffsetCorrection || 0;
    this.palletValues = palletValues || [];
    this.commonValues = commonValues || [];
    this.packedDataOffset = packedDataOffset || 0;
    this.sparseFieldOffsets = sparseFieldOffsets || null;
    this.recordBaseOffset =
      recordDataOffset !== undefined ? recordDataOffset : this.recordIndex * this.recordSize;
  }

  /**
   * Get record ID
   * For sparse files, returns the ID from catalog (passed in constructor)
   * For regular files, reads field 0
   * @returns Record ID
   */
  public getId(): number {
    // If recordId was provided (sparse file), use it
    if (this.recordId !== null) {
      return this.recordId;
    }

    // Otherwise read from field 0 (regular file)
    return this.getUInt32(0, 0);
  }

  /**
   * Get uint8 field value
   * @param field Field index
   * @param arrayIndex Array index within field (default 0)
   * @returns Unsigned 8-bit integer
   */
  public getUInt8(field: number, arrayIndex: number = 0): number {
    const recordOffset = this.recordBaseOffset;
    return this.recordData.readUInt8(recordOffset + this.getFieldOffset(field, arrayIndex));
  }

  /**
   * Get int8 field value
   * @param field Field index
   * @param arrayIndex Array index within field (default 0)
   * @returns Signed 8-bit integer
   */
  public getInt8(field: number, arrayIndex: number = 0): number {
    const recordOffset = this.recordBaseOffset;
    return this.recordData.readInt8(recordOffset + this.getFieldOffset(field, arrayIndex));
  }

  /**
   * Get int16 field value
   * @param field Field index
   * @param arrayIndex Array index within field (default 0)
   * @returns Signed 16-bit integer
   */
  public getInt16(field: number, arrayIndex: number = 0): number {
    const recordOffset = this.recordBaseOffset;
    return this.recordData.readInt16LE(recordOffset + this.getFieldOffset(field, arrayIndex));
  }

  /**
   * Get uint16 field value
   * @param field Field index
   * @param arrayIndex Array index within field (default 0)
   * @returns Unsigned 16-bit integer
   */
  public getUInt16(field: number, arrayIndex: number = 0): number {
    const recordOffset = this.recordBaseOffset;
    return this.recordData.readUInt16LE(recordOffset + this.getFieldOffset(field, arrayIndex));
  }

  /**
   * Get uint32 field value
   * @param field Field index
   * @param arrayIndex Array index within field (default 0)
   * @returns Unsigned 32-bit integer
   */
  public getUInt32(field: number, arrayIndex: number = 0): number {
    // Sparse records store their fields uncompressed and inline. The file's
    // column metadata and field entries describe dense records, where every
    // record shares one set of offsets, so neither applies here: read straight
    // from the position the per-record walk found.
    if (this.sparseFieldOffsets) {
      return this.recordData.readUInt32LE(
        this.recordBaseOffset + this.getFieldOffset(field, arrayIndex)
      );
    }

    // Prefer TrinityCore-style field entries if available
    if (this.fieldEntries.length > 0) {
      return this.recordGetVarInt(field, arrayIndex, false);
    }

    // Fall back to legacy column metadata
    const meta = this.getColumnMeta(field);
    const recordOffset = this.recordBaseOffset;

    if (!meta) {
      // No compression metadata, read raw
      return this.recordData.readUInt32LE(recordOffset + this.getFieldOffset(field, arrayIndex));
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
    const recordOffset = this.recordBaseOffset;
    const offset = recordOffset + this.getFieldOffset(field, arrayIndex);
    return this.recordData.readBigUInt64LE(offset);
  }

  /**
   * Get float field value
   * @param field Field index
   * @param arrayIndex Array index within field (default 0)
   * @returns 32-bit floating point number
   */
  public getFloat(field: number, arrayIndex: number = 0): number {
    const recordOffset = this.recordBaseOffset;
    return this.recordData.readFloatLE(recordOffset + this.getFieldOffset(field, arrayIndex));
  }

  /**
   * Get string field value
   * @param field Field index
   * @param arrayIndex Array index within field (default 0)
   * @returns String from string block or inline from record data
   */
  public getString(field: number, arrayIndex: number = 0): string {
    // SPARSE FILES (Spell.db2):
    // - Variable-sized records with catalog entries
    // - Strings are stored INLINE in record data
    // - Based on TrinityCore's DB2FileLoaderSparseImpl::RecordGetString()
    //   Line 1484-1488: return reinterpret_cast<char const*>(record + GetFieldOffset(field, arrayIndex));
    //
    // INLINE/DENSE FILES (SpellName.db2):
    // - Fixed-size records with ID list
    // - Strings are in separate STRING TABLE
    // - Record contains uint32 STRING OFFSET pointing into string table
    // - Based on TrinityCore's DB2FileLoaderRegularImpl::RecordGetString()

    if (this.isSparseFile) {
      // SPARSE FILE: String is stored inline in record data
      const fieldOffset = this.recordBaseOffset + this.getFieldOffset(field, arrayIndex);

      // Find null terminator starting from field offset
      const nullIndex = this.recordData.indexOf(0, fieldOffset);
      if (nullIndex === -1) {
        // No null terminator, read to end of buffer
        return this.recordData.toString('utf8', fieldOffset);
      }

      // Read from field offset up to null terminator
      return this.recordData.toString('utf8', fieldOffset, nullIndex);
    } else {
      // INLINE/DENSE FILE: Strings are in section-specific string table
      //
      // TrinityCore's DB2FileLoaderRegularImpl::RecordGetString() formula:
      //   return reinterpret_cast<char const*>(record + fieldOffset + stringOffset);
      //
      // In TrinityCore's combined buffer layout:
      //   [Section 0 Records][Section 1 Records]...[Section 0 Strings][Section 1 Strings]...
      //   String table starts at: header.recordCount * header.recordSize
      //
      // Our per-section buffer layout:
      //   [Section Records][Section Strings]
      //   String table starts at: section.recordCount * recordSize
      //
      // The raw string offset is calibrated for TrinityCore's full combined buffer.
      // stringOffsetCorrection translates from TrinityCore layout to our per-section layout:
      //   correction = (sectionRecordCount - headerRecordCount) * recordSize
      //              + sectionRecordStartOffset - sectionStringTableStartOffset
      //
      // Final formula:
      //   bufferPosition = recordIndex * recordSize + fieldOffset + rawOffset + correction

      const fieldOffset = this.getFieldOffset(field, arrayIndex);
      const recordPositionInBuffer = this.recordIndex * this.recordSize;
      const rawStringOffset = this.recordData.readUInt32LE(recordPositionInBuffer + fieldOffset);

      if (rawStringOffset === 0) {
        return '';
      }

      // Apply TrinityCore formula with correction for per-section buffer layout
      const bufferPosition = recordPositionInBuffer + fieldOffset + rawStringOffset + this.stringOffsetCorrection;

      // Validate: position must be within the string table portion of our buffer
      const stringTableStart = this.recordCount * this.recordSize;
      if (bufferPosition < stringTableStart || bufferPosition >= this.stringBlock.length) {
        return '';
      }

      // Read null-terminated string
      const nullIndex = this.stringBlock.indexOf(0, bufferPosition);
      if (nullIndex === -1) {
        return this.stringBlock.toString('utf8', bufferPosition);
      }

      return this.stringBlock.toString('utf8', bufferPosition, nullIndex);
    }
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
    // Sparse records carry their own walked offsets: variable-length strings
    // move every field after them, so position depends on record contents.
    if (this.sparseFieldOffsets) {
      const elementOffsets = this.sparseFieldOffsets[field];
      if (!elementOffsets) {
        throw new Error(
          `Field ${field} is outside the sparse layout (${this.sparseFieldOffsets.length} fields)`
        );
      }
      const offset = elementOffsets[arrayIndex];
      if (offset === undefined) {
        throw new Error(
          `Array index ${arrayIndex} is outside field ${field} (${elementOffsets.length} elements)`
        );
      }
      return offset;
    }

    // For sparse files, use fieldEntries offset (matches TrinityCore's _fieldAndArrayOffsets)
    if (this.fieldEntries && this.fieldEntries.length > field) {
      return this.fieldEntries[field].offset + arrayIndex * 4;
    }

    // For regular files, use columnMeta
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

  /**
   * TrinityCore-style variable-width integer reading
   * Based on DB2FileLoaderSparseImpl::RecordGetVarInt()
   * @param field Field index
   * @param arrayIndex Array index within field (default 0)
   * @param isSigned Whether to sign-extend the value
   * @returns Variable-width integer value
   */
  /**
   * Extract a bit-packed value starting at a byte boundary.
   *
   * Mirrors TrinityCore's RecordGetPackedValue: read 8 bytes from the byte
   * containing the value, discard the leading bits, then keep bitWidth bits.
   * BigInt is used because a 64-bit intermediate is required - JavaScript's
   * 32-bit bitwise operators silently truncate fields wider than 32 bits.
   */
  private readPackedValue(byteOffset: number, bitWidth: number, bitOffset: number): bigint {
    if (bitWidth === 0) {
      return 0n;
    }

    const bitsToSkip = BigInt(bitOffset & 7);
    const width = BigInt(bitWidth);

    let raw = 0n;
    for (let i = 0; i < 8; i++) {
      const idx = byteOffset + i;
      const byte = idx < this.recordData.length ? BigInt(this.recordData[idx]) : 0n;
      raw |= byte << BigInt(i * 8);
    }

    return (raw >> bitsToSkip) & ((1n << width) - 1n);
  }

  /**
   * Byte offset of a field within a record, per its storage type.
   * CommonData fields live outside the record entirely.
   */
  private getStorageFieldOffset(field: number): number {
    const meta = this.columnMeta[field];
    if (!meta) {
      return this.fieldEntries[field] ? this.fieldEntries[field].offset : 0;
    }

    switch (meta.compressionType) {
      case DB2ColumnCompression.None:
        return meta.bitOffset >> 3;
      case DB2ColumnCompression.Immediate:
      case DB2ColumnCompression.SignedImmediate:
        return (meta.compressionData.immediate!.bitOffset >> 3) + this.packedDataOffset;
      case DB2ColumnCompression.Pallet:
      case DB2ColumnCompression.PalletArray:
        return (meta.compressionData.pallet!.bitOffset >> 3) + this.packedDataOffset;
      case DB2ColumnCompression.CommonData:
        return -1; // not stored in the record
      default:
        return meta.bitOffset >> 3;
    }
  }

  /**
   * Read a field, honouring its storage type.
   *
   * WDC3+ stores fields four different ways beyond plain values: bit-packed
   * immediates, pallet-indexed lookups, pallet arrays, and per-id common
   * values. Treating everything as a plain read is why compressed tables
   * previously returned zeroes.
   */
  private recordGetVarInt(field: number, arrayIndex: number, isSigned: boolean): number {
    const meta = this.columnMeta[field];
    const recordBase = this.recordIndex * this.recordSize;

    // No storage metadata: fall back to the plain field-structure layout.
    if (!meta) {
      const entry = this.fieldEntries[field];
      if (!entry) {
        throw new Error(`Field ${field} out of range (0-${this.fieldEntries.length - 1})`);
      }
      const size = 4 - Math.floor(entry.unusedBits / 8);
      const off = recordBase + entry.offset + arrayIndex * size;
      let v = 0;
      for (let i = 0; i < size; i++) {
        v |= (this.recordData[off + i] ?? 0) << (i * 8);
      }
      return isSigned
        ? (v << entry.unusedBits) >> entry.unusedBits
        : (v << entry.unusedBits) >>> entry.unusedBits;
    }

    switch (meta.compressionType) {
      case DB2ColumnCompression.None: {
        const size = Math.max(1, meta.bitSize >> 3);
        const off = recordBase + this.getStorageFieldOffset(field) + arrayIndex * size;
        let v = 0;
        for (let i = 0; i < Math.min(size, 4); i++) {
          v |= (this.recordData[off + i] ?? 0) << (i * 8);
        }
        return isSigned ? v | 0 : v >>> 0;
      }

      case DB2ColumnCompression.Immediate:
      case DB2ColumnCompression.SignedImmediate: {
        const imm = meta.compressionData.immediate!;
        const off = recordBase + this.getStorageFieldOffset(field);
        let value = this.readPackedValue(off, imm.bitWidth, imm.bitOffset);
        if (meta.compressionType === DB2ColumnCompression.SignedImmediate || (isSigned && imm.signed)) {
          const mask = 1n << BigInt(imm.bitWidth - 1);
          value = (value ^ mask) - mask;
        }
        return Number(BigInt.asIntN(64, value)) | (isSigned ? 0 : 0);
      }

      case DB2ColumnCompression.Pallet:
      case DB2ColumnCompression.PalletArray: {
        const pal = meta.compressionData.pallet!;
        const off = recordBase + this.getStorageFieldOffset(field);
        const index = Number(this.readPackedValue(off, pal.bitWidth, pal.bitOffset));
        const table = this.palletValues[field] || [];
        const slot =
          meta.compressionType === DB2ColumnCompression.PalletArray
            ? index * Math.max(1, pal.arraySize) + arrayIndex
            : index;
        const value = table[slot] ?? 0;
        return isSigned ? value | 0 : value >>> 0;
      }

      case DB2ColumnCompression.CommonData: {
        const id = this.recordId;
        const map = this.commonValues[field];
        const fallback = meta.compressionData.commonData?.value ?? 0;
        const value = id !== null && map ? map.get(id) ?? fallback : fallback;
        return isSigned ? value | 0 : value >>> 0;
      }

      default:
        return 0;
    }
  }

  /**
   * Get field size for a field entry
   * @param field Field index
   * @returns Field size in bytes (1-4)
   */
  private getFieldSize(field: number): number {
    if (field < 0 || field >= this.fieldEntries.length) {
      return 4; // Default to 4 bytes
    }

    const fieldEntry = this.fieldEntries[field];
    return 4 - Math.floor(fieldEntry.unusedBits / 8);
  }
}
