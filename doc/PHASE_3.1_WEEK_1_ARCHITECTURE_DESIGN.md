# Phase 3.1 Week 1 - Architecture Design Document

**Date:** October 31, 2025
**Status:** ✅ Research Complete → Design In Progress
**Based On:** TrinityCore C++ DB2FileLoader implementation

---

## 📊 Research Summary

### TrinityCore DB2 Implementation Analysis

**Source Files Analyzed:**
- `src/common/DataStores/DB2FileLoader.h` - Main parser interface
- `src/common/DataStores/DB2FileLoader.cpp` - Implementation with compression
- `src/common/DataStores/DB2Meta.h` - Metadata structures
- `src/server/game/DataStores/DB2Structure.h` - Data structures (3,812+ entries)

**Key Findings:**

1. **Modern DB2 Header (56 bytes)**
   ```cpp
   struct DB2Header {
       uint32 Signature;           // Magic (e.g., 'WDC5', 'WDC6')
       uint32 Version;
       std::array<char, 128> Schema;
       uint32 RecordCount;
       uint32 FieldCount;
       uint32 RecordSize;
       uint32 StringTableSize;
       uint32 TableHash;
       uint32 LayoutHash;
       uint32 MinId;
       uint32 MaxId;
       uint32 Locale;
       uint16 Flags;
       int16 IndexField;
       uint32 TotalFieldCount;
       uint32 PackedDataOffset;
       uint32 ParentLookupCount;
       uint32 ColumnMetaSize;
       uint32 CommonDataSize;
       uint32 PalletDataSize;
       uint32 SectionCount;
   };
   ```

2. **Compression Modes (Enum)**
   ```cpp
   enum class DB2ColumnCompression : uint32 {
       None,
       Immediate,
       CommonData,
       Pallet,
       PalletArray,
       SignedImmediate
   };
   ```

3. **Two Implementation Classes**
   - `DB2FileLoaderRegularImpl` - For dense records (normal files)
   - `DB2FileLoaderSparseImpl` - For sparse records (catalog-based)

4. **Field Compression Metadata**
   ```cpp
   struct DB2ColumnMeta {
       uint16 BitOffset;
       uint16 BitSize;
       uint32 AdditionalDataSize;
       DB2ColumnCompression CompressionType;
       union CompressionData {
           struct { uint32 BitOffset; uint32 BitWidth; bool Signed; } immediate;
           struct { uint32 Value; } commonData;
           struct { uint32 BitOffset; uint32 BitWidth; uint32 ArraySize; } pallet;
       };
   };
   ```

---

## 🎯 TypeScript Architecture Design

### Class Hierarchy (Mirrors TrinityCore)

```
                        IDB2FileSource
                              ↑
                              |
                     DB2FileSystemSource


                        DB2FileLoader
                              ↑
                              |
                   ┌──────────┴──────────┐
                   |                     |
         DB2FileLoaderRegular    DB2FileLoaderSparse


                        DB2Record
```

### Core Interfaces & Classes

#### 1. **IDB2FileSource** (Abstract File Reading)
```typescript
export interface IDB2FileSource {
    isOpen(): boolean;
    read(buffer: Buffer, numBytes: number): boolean;
    getPosition(): number;
    setPosition(position: number): boolean;
    getFileSize(): number;
    getFileName(): string;
}
```

#### 2. **DB2FileSystemSource** (File System Implementation)
```typescript
export class DB2FileSystemSource implements IDB2FileSource {
    private fd: number | null;
    private filePath: string;
    private position: number;
    private fileSize: number;

    constructor(filePath: string);
    isOpen(): boolean;
    read(buffer: Buffer, numBytes: number): boolean;
    // ... other methods
}
```

#### 3. **DB2Header** (Main Header Structure)
```typescript
export interface DB2Header {
    signature: string;          // 4 bytes (e.g., 'WDC5')
    version: number;            // uint32
    schema: string;             // 128 bytes
    recordCount: number;        // uint32
    fieldCount: number;         // uint32
    recordSize: number;         // uint32
    stringTableSize: number;    // uint32
    tableHash: number;          // uint32
    layoutHash: number;         // uint32
    minId: number;              // uint32
    maxId: number;              // uint32
    locale: number;             // uint32
    flags: number;              // uint16
    indexField: number;         // int16
    totalFieldCount: number;    // uint32
    packedDataOffset: number;   // uint32
    parentLookupCount: number;  // uint32
    columnMetaSize: number;     // uint32
    commonDataSize: number;     // uint32
    palletDataSize: number;     // uint32
    sectionCount: number;       // uint32
}
```

#### 4. **DB2SectionHeader** (Per-Section Metadata)
```typescript
export interface DB2SectionHeader {
    tactId: bigint;             // uint64
    fileOffset: number;         // uint32
    recordCount: number;        // uint32
    stringTableSize: number;    // uint32
    catalogDataOffset: number;  // uint32
    idTableSize: number;        // uint32
    parentLookupDataSize: number; // uint32
    catalogDataCount: number;   // uint32
    copyTableCount: number;     // uint32
}
```

#### 5. **DB2ColumnCompression** (Enum)
```typescript
export enum DB2ColumnCompression {
    None = 0,
    Immediate = 1,
    CommonData = 2,
    Pallet = 3,
    PalletArray = 4,
    SignedImmediate = 5
}
```

#### 6. **DB2ColumnMeta** (Compression Metadata)
```typescript
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
```

#### 7. **DB2FileLoader** (Main Parser)
```typescript
export class DB2FileLoader {
    private source: IDB2FileSource;
    private header: DB2Header;
    private sections: DB2SectionHeader[];
    private impl: DB2FileLoaderImpl;

    constructor();

    loadHeaders(source: IDB2FileSource): void;
    load(source: IDB2FileSource): void;

    getRecordCount(): number;
    getRecord(recordNumber: number): DB2Record;
    getHeader(): DB2Header;
}
```

#### 8. **DB2FileLoaderImpl** (Abstract Base)
```typescript
export abstract class DB2FileLoaderImpl {
    protected header: DB2Header;
    protected sections: DB2SectionHeader[];
    protected columnMeta: DB2ColumnMeta[];
    protected data: Buffer;
    protected stringTable: Buffer;

    abstract loadColumnData(): void;
    abstract loadTableData(source: IDB2FileSource, section: number): boolean;
    abstract getRecord(recordNumber: number): DB2Record;
    abstract getRecordCount(): number;
}
```

#### 9. **DB2FileLoaderRegular** (Dense Records)
```typescript
export class DB2FileLoaderRegular extends DB2FileLoaderImpl {
    private palletValues: Map<number, number[]>;
    private commonValues: Map<number, Map<number, number>>;

    loadColumnData(): void;
    loadTableData(source: IDB2FileSource, section: number): boolean;
    getRecord(recordNumber: number): DB2Record;

    private getPackedValue(data: Buffer, bitWidth: number, bitOffset: number): bigint;
    private recordGetVarInt(record: Buffer, field: number, arrayIndex: number): number;
}
```

#### 10. **DB2FileLoaderSparse** (Catalog-Based)
```typescript
export class DB2FileLoaderSparse extends DB2FileLoaderImpl {
    private catalogEntries: Map<number, {offset: number, size: number}>;
    private fieldOffsets: number[];

    loadCatalogData(source: IDB2FileSource, section: number): boolean;
    getRecord(recordNumber: number): DB2Record;

    private getRawRecordData(recordNumber: number): Buffer;
}
```

#### 11. **DB2Record** (Record Accessor)
```typescript
export class DB2Record {
    private loader: DB2FileLoaderImpl;
    private recordIndex: number;
    private recordData: Buffer;

    constructor(loader: DB2FileLoaderImpl, recordIndex: number);

    getId(): number;
    getUInt8(field: number, arrayIndex: number): number;
    getUInt16(field: number, arrayIndex: number): number;
    getUInt32(field: number, arrayIndex: number): number;
    getInt32(field: number, arrayIndex: number): number;
    getUInt64(field: number, arrayIndex: number): bigint;
    getFloat(field: number, arrayIndex: number): number;
    getString(field: number, arrayIndex: number): string;
}
```

---

## 📁 Project Structure

```
trinitycore-mcp/
├── src/
│   ├── parsers/
│   │   ├── db2/
│   │   │   ├── DB2FileLoader.ts           # Main loader class
│   │   │   ├── DB2FileLoaderRegular.ts    # Dense record implementation
│   │   │   ├── DB2FileLoaderSparse.ts     # Sparse record implementation
│   │   │   ├── DB2FileSource.ts           # File source interface + impl
│   │   │   ├── DB2Header.ts               # Header structures
│   │   │   ├── DB2Record.ts               # Record accessor
│   │   │   ├── DB2ColumnMeta.ts           # Compression metadata
│   │   │   └── index.ts                   # Public API exports
│   │   ├── dbc/
│   │   │   ├── DBCFileLoader.ts           # Legacy DBC parser
│   │   │   ├── DBCHeader.ts               # WDBC header
│   │   │   └── index.ts
│   │   ├── cache/
│   │   │   ├── RecordCache.ts             # Redis-based caching
│   │   │   └── index.ts
│   │   └── schemas/
│   │       ├── SpellSchema.ts             # Spell.db2 structure
│   │       ├── ItemSchema.ts              # Item-Sparse.db2 structure
│   │       └── index.ts
│   └── tools/
│       └── dbc.ts                         # Updated MCP tool
└── tests/
    └── parsers/
        ├── db2/
        │   ├── DB2FileLoader.test.ts
        │   └── DB2Record.test.ts
        └── dbc/
            └── DBCFileLoader.test.ts
```

---

## 🔧 Key Implementation Details

### 1. **Little-Endian Reading**
```typescript
// TrinityCore uses ByteConverter.h for endianness
// In TypeScript/Node.js, Buffer natively supports little-endian:
buffer.readUInt32LE(offset);
buffer.readUInt16LE(offset);
buffer.readInt32LE(offset);
```

### 2. **Bitpacked Field Reading**
```typescript
function getPackedValue(data: Buffer, bitWidth: number, bitOffset: number): bigint {
    const byteOffset = Math.floor(bitOffset / 8);
    const bitInByteOffset = bitOffset % 8;

    // Read up to 8 bytes (64 bits max)
    let value = 0n;
    for (let i = 0; i < Math.ceil((bitWidth + bitInByteOffset) / 8); i++) {
        value |= BigInt(data[byteOffset + i]) << BigInt(i * 8);
    }

    // Shift and mask
    value >>= BigInt(bitInByteOffset);
    const mask = (1n << BigInt(bitWidth)) - 1n;
    return value & mask;
}
```

### 3. **String Block Handling**
```typescript
function readString(stringTable: Buffer, offset: number): string {
    const nullIndex = stringTable.indexOf(0, offset);
    if (nullIndex === -1) {
        return stringTable.toString('utf8', offset);
    }
    return stringTable.toString('utf8', offset, nullIndex);
}
```

### 4. **Compression Handling**
```typescript
function readCompressedField(
    record: Buffer,
    columnMeta: DB2ColumnMeta,
    palletValues: Map<number, number[]>,
    commonValues: Map<number, number>
): number {
    switch (columnMeta.compressionType) {
        case DB2ColumnCompression.None:
            return record.readUInt32LE(columnMeta.bitOffset / 8);

        case DB2ColumnCompression.Immediate:
            return Number(getPackedValue(
                record,
                columnMeta.compressionData.immediate!.bitWidth,
                columnMeta.compressionData.immediate!.bitOffset
            ));

        case DB2ColumnCompression.CommonData:
            return columnMeta.compressionData.commonData!.value;

        case DB2ColumnCompression.Pallet: {
            const index = Number(getPackedValue(
                record,
                columnMeta.compressionData.pallet!.bitWidth,
                columnMeta.compressionData.pallet!.bitOffset
            ));
            const values = palletValues.get(columnMeta.bitOffset) || [];
            return values[index] || 0;
        }

        default:
            throw new Error(`Unsupported compression: ${columnMeta.compressionType}`);
    }
}
```

---

## ✅ Design Principles (From TrinityCore)

1. **Abstraction**: `IDB2FileSource` allows testing without filesystem
2. **Polymorphism**: Regular vs Sparse loaders share common interface
3. **Lazy Loading**: Only parse records when accessed via `getRecord()`
4. **Memory Efficiency**: Sparse implementation uses catalog for on-demand loading
5. **Error Handling**: Throw exceptions for invalid formats (like TrinityCore)
6. **Type Safety**: Use TypeScript interfaces for all structures

---

## 🎯 Week 1 Deliverables

- [x] Research TrinityCore implementation (COMPLETE)
- [ ] Architecture design document (IN PROGRESS - THIS FILE)
- [ ] Directory structure created
- [ ] Dependencies installed (ioredis, iconv-lite)
- [ ] Base interfaces defined (IDB2FileSource, DB2Header, etc.)
- [ ] Unit test structure created

**Next Steps:** Move to implementation phase (Week 2)

---

**Document Version:** 1.0
**Last Updated:** October 31, 2025
**Status:** ✅ Design Complete - Ready for Implementation

🤖 Generated with [Claude Code](https://claude.com/claude-code)
