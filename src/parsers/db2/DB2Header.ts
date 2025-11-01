/**
 * DB2 Header structures based on TrinityCore implementation
 * Source: src/common/DataStores/DB2FileLoader.h
 */

export interface DB2Header {
  signature: string; // 4 bytes (e.g., 'WDC5', 'WDC6')
  version: number; // uint32
  schema: string; // 128 bytes
  recordCount: number; // uint32
  fieldCount: number; // uint32
  recordSize: number; // uint32
  stringTableSize: number; // uint32
  tableHash: number; // uint32
  layoutHash: number; // uint32
  minId: number; // uint32
  maxId: number; // uint32
  locale: number; // uint32
  flags: number; // uint16
  indexField: number; // int16
  totalFieldCount: number; // uint32
  packedDataOffset: number; // uint32
  parentLookupCount: number; // uint32
  columnMetaSize: number; // uint32
  commonDataSize: number; // uint32
  palletDataSize: number; // uint32
  sectionCount: number; // uint32
}

export interface DB2SectionHeader {
  tactId: bigint; // uint64
  fileOffset: number; // uint32
  recordCount: number; // uint32
  stringTableSize: number; // uint32
  catalogDataOffset: number; // uint32
  idTableSize: number; // uint32
  parentLookupDataSize: number; // uint32
  catalogDataCount: number; // uint32
  copyTableCount: number; // uint32
}

export enum DB2ColumnCompression {
  None = 0,
  Immediate = 1,
  CommonData = 2,
  Pallet = 3,
  PalletArray = 4,
  SignedImmediate = 5,
}

export interface DB2ColumnMeta {
  bitOffset: number;
  bitSize: number;
  additionalDataSize: number;
  compressionType: DB2ColumnCompression;
  compressionData: {
    immediate?: {
      bitOffset: number;
      bitWidth: number;
      signed: boolean;
    };
    commonData?: {
      value: number;
    };
    pallet?: {
      bitOffset: number;
      bitWidth: number;
      arraySize: number;
    };
  };
}

export interface DB2RecordCopy {
  newRowId: number; // uint32
  sourceRowId: number; // uint32
}

/**
 * Parse DB2 header from buffer
 * @param buffer Binary data buffer
 * @returns Parsed DB2 header
 */
export function parseDB2Header(buffer: Buffer): DB2Header {
  if (buffer.length < 56) {
    throw new Error(`DB2 header too small: ${buffer.length} bytes (expected 56+)`);
  }

  const signature = buffer.toString("ascii", 0, 4);
  const version = buffer.readUInt32LE(4);

  // Read 128-byte schema string (find null terminator between offsets 8-135)
  let schemaEnd = 136;
  for (let i = 8; i < 136; i++) {
    if (buffer[i] === 0) {
      schemaEnd = i;
      break;
    }
  }
  const schema = buffer.toString("ascii", 8, schemaEnd);

  return {
    signature,
    version,
    schema,
    recordCount: buffer.readUInt32LE(136),
    fieldCount: buffer.readUInt32LE(140),
    recordSize: buffer.readUInt32LE(144),
    stringTableSize: buffer.readUInt32LE(148),
    tableHash: buffer.readUInt32LE(152),
    layoutHash: buffer.readUInt32LE(156),
    minId: buffer.readUInt32LE(160),
    maxId: buffer.readUInt32LE(164),
    locale: buffer.readUInt32LE(168),
    flags: buffer.readUInt16LE(172),
    indexField: buffer.readInt16LE(174),
    totalFieldCount: buffer.readUInt32LE(176),
    packedDataOffset: buffer.readUInt32LE(180),
    parentLookupCount: buffer.readUInt32LE(184),
    columnMetaSize: buffer.readUInt32LE(188),
    commonDataSize: buffer.readUInt32LE(192),
    palletDataSize: buffer.readUInt32LE(196),
    sectionCount: buffer.readUInt32LE(200),
  };
}

/**
 * Parse DB2 section header from buffer
 * @param buffer Binary data buffer
 * @param offset Offset to section header
 * @returns Parsed section header
 */
export function parseDB2SectionHeader(buffer: Buffer, offset: number): DB2SectionHeader {
  if (buffer.length < offset + 36) {
    throw new Error(`Buffer too small for section header at offset ${offset}`);
  }

  return {
    tactId: buffer.readBigUInt64LE(offset),
    fileOffset: buffer.readUInt32LE(offset + 8),
    recordCount: buffer.readUInt32LE(offset + 12),
    stringTableSize: buffer.readUInt32LE(offset + 16),
    catalogDataOffset: buffer.readUInt32LE(offset + 20),
    idTableSize: buffer.readUInt32LE(offset + 24),
    parentLookupDataSize: buffer.readUInt32LE(offset + 28),
    catalogDataCount: buffer.readUInt32LE(offset + 32),
    copyTableCount: buffer.readUInt32LE(offset + 36),
  };
}

/**
 * Validate DB2 signature
 * @param signature Magic signature string
 * @returns True if valid DB2 signature
 */
export function isValidDB2Signature(signature: string): boolean {
  return signature === "WDC5" || signature === "WDC6" || signature === "WDC4" || signature === "WDC3";
}
