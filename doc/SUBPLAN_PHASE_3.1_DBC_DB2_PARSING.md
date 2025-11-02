# TrinityCore MCP Server - Phase 3.1: DBC/DB2 Binary Parsing

**Document Version:** 1.0
**Created:** October 31, 2025
**Phase:** 3.1 - DBC/DB2 Binary Parsing
**Duration:** 8 weeks
**Priority:** HIGH
**Status:** Planning Complete

---

## 📋 Executive Summary

### Objective

Implement enterprise-grade binary parsers for World of Warcraft DBC (DataBaseClient) and DB2 (DataBase 2) file formats, enabling direct access to client-side game data without relying solely on database tables. This unlocks accurate spell ranges, item stats, class/race data, and talent information directly from game files.

### Scope

- **DBC Format Parser**: Legacy format (Classic WoW through WotLK)
- **DB2 Format Parser**: Modern format (Cataclysm through The War Within 11.2)
- **Priority Files**: 8 critical files for immediate value
- **Caching Layer**: Redis integration for performance
- **MCP Integration**: Enhance existing tools with real client data

### Success Criteria

✅ Parse 8 priority DBC/DB2 files with 100% accuracy
✅ Cache layer achieving <50MB memory per file, <100ms load time
✅ Integration with 5+ existing MCP tools
✅ >99% data accuracy compared to source files
✅ Comprehensive test coverage (>80% code coverage)
✅ Production-ready error handling and validation

### Key Deliverables

1. **DBCReader class** - WDBC format parser (legacy)
2. **DB2Reader class** - WDB5/WDB6 format parser (modern)
3. **StringBlockReader class** - String table handler
4. **RecordCache class** - Redis-backed caching layer
5. **Updated MCP tools** - query-dbc, get-spell-info, get-item-info enhancements
6. **Comprehensive tests** - Unit, integration, validation suites
7. **Documentation** - API reference, usage guide, troubleshooting

### Timeline & Resources

- **Duration**: 8 weeks (concurrent with Phase 3.3 from Week 6)
- **Effort**: ~160 hours total (~20 hours/week)
- **Dependencies**: Binary file parsing libraries, Redis client
- **Risk Level**: Medium (file format complexity, version variations)

---

## 🎯 Background & Motivation

### Current Limitations

The TrinityCore MCP Server currently has a **placeholder implementation** for DBC/DB2 parsing (see `src/tools/dbc.ts` lines 27-32):

```typescript
// Current placeholder code
return {
  file: dbcFile,
  recordId,
  data: "DBC/DB2 parsing not yet implemented - requires binary format reader",
  note: "This feature requires implementing DBC/DB2 binary format parsing",
  filePath,
};
```

This means:
- ❌ No direct access to client-side game data
- ❌ Reliance on potentially incomplete database tables
- ❌ Missing accurate spell ranges, item stats, class data
- ❌ Cannot validate against official game data

### Value Proposition

Implementing DBC/DB2 parsing provides:
- ✅ **100% accurate game data** directly from client files
- ✅ **Spell ranges** (68 entries from SpellRange.dbc) - see `src/tools/spell.ts` lines 425-517
- ✅ **Item stats** from ItemSparse.db2 (detailed stat arrays)
- ✅ **Class/race data** for proper bot configuration
- ✅ **Talent information** for build optimization
- ✅ **Validation source** for database consistency checks

### Technical Challenge

DBC/DB2 formats are **binary file formats** with:
- Little-endian byte order
- Variable record structures
- Compressed data blocks (DB2)
- String table indirection
- Version-specific variations (WDB5, WDB6, WDB2, etc.)

---

## 🔍 Technical Specifications

### DBC Format (Legacy: Classic - WotLK)

#### File Structure

```
+------------------+
| Header (20 bytes)|
+------------------+
| Record 1         |
| Record 2         |
| ...              |
| Record N         |
+------------------+
| String Block     |
+------------------+
```

#### Header Format (20 bytes)

| Offset | Type    | Description                    |
|--------|---------|--------------------------------|
| 0x00   | char[4] | Magic signature: "WDBC"        |
| 0x04   | uint32  | Record count                   |
| 0x08   | uint32  | Field count (per record)       |
| 0x0C   | uint32  | Record size (bytes)            |
| 0x10   | uint32  | String block size (bytes)      |

#### Record Structure

- **Fixed-size records** (size specified in header)
- **Little-endian** 32-bit values
- **String references** as 32-bit offsets into string block
- **Integer fields** (uint32, int32)
- **Float fields** (IEEE 754 single precision)

#### String Block

- **Located at end of file** after all records
- **Null-terminated C strings**
- **Referenced by offset** from start of string block
- **Offset 0 always empty string** ("")

#### Example: Spell.dbc Record

```
Offset | Type   | Field Name
-------|--------|------------------
0x00   | uint32 | ID (spell ID)
0x04   | uint32 | Category
0x08   | uint32 | Dispel
0x0C   | uint32 | Mechanic
0x10   | uint32 | Attributes (bitfield)
... (continues for ~200+ fields)
```

### DB2 Format (Modern: Cataclysm - The War Within 11.2)

#### File Structure

```
+---------------------+
| Header (variable)   |
+---------------------+
| Field Structure     | (WDB5/WDB6)
+---------------------+
| Records (variable)  |
+---------------------+
| String Block        |
+---------------------+
| Copy Table          | (optional)
+---------------------+
| Offset Map          | (optional)
+---------------------+
| Relationship Data   | (optional)
+---------------------+
```

#### Header Variants

**WDB5 Header** (Warlords of Draenor):
```c
struct WDB5Header {
    char magic[4];          // "WDB5"
    uint32_t recordCount;
    uint32_t fieldCount;
    uint32_t recordSize;
    uint32_t stringBlockSize;
    uint32_t tableHash;
    uint32_t layoutHash;
    uint32_t minId;
    uint32_t maxId;
    uint32_t locale;
    uint16_t flags;
    uint16_t idIndex;
    uint32_t totalFieldCount;
    uint32_t bitpackedDataOffset;
    uint32_t lookupColumnCount;
    uint32_t offsetMapOffset;
    uint32_t idListOffset;
    uint32_t copyTableSize;
    uint32_t offsetMapIDCount;
    uint32_t relationshipDataSize;
};
```

**WDB6 Header** (Legion+):
```c
struct WDB6Header {
    char magic[4];          // "WDB6"
    uint32_t recordCount;
    uint32_t fieldCount;
    uint32_t recordSize;
    uint32_t stringBlockSize;
    uint32_t tableHash;
    uint32_t layoutHash;
    uint32_t minId;
    uint32_t maxId;
    uint32_t locale;
    uint16_t flags;
    uint16_t idIndex;
    uint32_t totalFieldCount;
    uint32_t bitpackedDataOffset;
    uint32_t lookupColumnCount;
    uint32_t fieldStorageInfoSize;
    uint32_t commonDataSize;
    uint32_t palletDataSize;
    uint32_t sectionCount;
};
```

#### Field Structure Block

**WDB5/WDB6 Field Storage**:
```c
struct FieldStorageInfo {
    uint16_t offset;        // Field offset in record
    uint16_t size;          // Field size in bits
    uint32_t additionalData; // Flags/compression info
};
```

#### Compression Modes

1. **NONE** (0): Raw data
2. **BITPACKED** (1): Packed into minimal bits
3. **COMMON_DATA** (2): Single value for all records
4. **ARRAY_PALLET** (3): Index into value array

#### 24-bit Integer Handling

Many DB2 fields use **24-bit integers** for space efficiency:

```typescript
// Reading 24-bit integer
function read24BitInt(buffer: Buffer, offset: number): number {
  const byte1 = buffer.readUInt8(offset);
  const byte2 = buffer.readUInt8(offset + 1);
  const byte3 = buffer.readUInt8(offset + 2);
  return byte1 | (byte2 << 8) | (byte3 << 16);
}
```

### Priority Files for Implementation

#### Phase 1: Core Spell/Item Data (Weeks 2-4)

| File             | Format | Priority | Records | Use Case                      |
|------------------|--------|----------|---------|-------------------------------|
| Spell.dbc/db2    | Both   | CRITICAL | ~50,000 | Spell ranges, attributes      |
| Item.db2         | DB2    | HIGH     | ~100,000| Item stats, quality           |
| ItemSparse.db2   | DB2    | HIGH     | ~100,000| Detailed item data            |

#### Phase 2: Class/Race/Talent (Weeks 4-5)

| File             | Format | Priority | Records | Use Case                      |
|------------------|--------|----------|---------|-------------------------------|
| ChrClasses.dbc   | DBC    | MEDIUM   | 13      | Class definitions             |
| ChrRaces.dbc     | DBC    | MEDIUM   | 25      | Race definitions              |
| Talent.db2       | DB2    | MEDIUM   | ~2,000  | Talent tree data              |

#### Phase 3: Extended Data (Week 5)

| File             | Format | Priority | Records | Use Case                      |
|------------------|--------|----------|---------|-------------------------------|
| SpellEffect.db2  | DB2    | MEDIUM   | ~150,000| Spell effect details          |
| SpellRange.dbc   | DBC    | LOW      | 68      | Spell range table (already in code)|

---

## 📅 Week-by-Week Implementation Plan

### Week 1: Research & Architecture Design

**Objectives:**
- Research DBC/DB2 format specifications
- Design parser architecture
- Set up development environment
- Create project skeleton

**Tasks:**

1. **Format Research** (8 hours)
   - Study wowdev.wiki DBC/DB2 documentation
   - Analyze existing parsers (WoWDBDefs, DBCD)
   - Document format variations (WDBC, WDB5, WDB6)
   - Create format specification document

2. **Architecture Design** (6 hours)
   - Design class hierarchy (DBCReader, DB2Reader, StringBlockReader)
   - Define interfaces and contracts
   - Plan error handling strategy
   - Design caching layer integration

3. **Environment Setup** (4 hours)
   - Install binary file parsing libraries (`binary-parser`, `iconv-lite`)
   - Configure TypeScript for binary operations
   - Set up test DBC/DB2 files
   - Create test fixtures

4. **Project Skeleton** (2 hours)
   - Create `src/parsers/` directory
   - Create base classes and interfaces
   - Set up unit test structure
   - Configure Jest for binary testing

**Deliverables:**
- ✅ DBC/DB2 format specification document
- ✅ Architecture design document
- ✅ Project skeleton with base classes
- ✅ Development environment configured

**Success Metrics:**
- Clear understanding of WDBC, WDB5, WDB6 formats
- All team members aligned on architecture
- Development environment ready for coding

---

### Week 2: Core DBC Parser Implementation

**Objectives:**
- Implement WDBC format parser
- Handle header parsing and validation
- Implement record iteration
- Implement string block reading

**Tasks:**

1. **DBCReader Base Implementation** (8 hours)
   ```typescript
   // src/parsers/DBCReader.ts
   export class DBCReader {
     private buffer: Buffer;
     private header: DBCHeader;
     private stringBlock: Buffer;
     private recordSize: number;

     constructor(filePath: string) {
       this.buffer = fs.readFileSync(filePath);
       this.parseHeader();
       this.validateHeader();
       this.extractStringBlock();
     }

     private parseHeader(): void {
       const magic = this.buffer.toString('ascii', 0, 4);
       if (magic !== 'WDBC') {
         throw new Error(`Invalid DBC magic: ${magic}`);
       }

       this.header = {
         magic,
         recordCount: this.buffer.readUInt32LE(4),
         fieldCount: this.buffer.readUInt32LE(8),
         recordSize: this.buffer.readUInt32LE(12),
         stringBlockSize: this.buffer.readUInt32LE(16),
       };
     }

     private validateHeader(): void {
       if (this.header.recordCount === 0) {
         throw new Error('DBC file has zero records');
       }
       if (this.header.recordSize === 0) {
         throw new Error('DBC file has zero record size');
       }
       // Additional validation...
     }

     private extractStringBlock(): void {
       const offset = 20 + (this.header.recordCount * this.header.recordSize);
       this.stringBlock = this.buffer.slice(offset, offset + this.header.stringBlockSize);
     }

     public getRecordCount(): number {
       return this.header.recordCount;
     }

     public getRecord(index: number): Buffer {
       if (index < 0 || index >= this.header.recordCount) {
         throw new Error(`Invalid record index: ${index}`);
       }
       const offset = 20 + (index * this.header.recordSize);
       return this.buffer.slice(offset, offset + this.header.recordSize);
     }

     public getString(offset: number): string {
       if (offset >= this.header.stringBlockSize) {
         return '';
       }
       const end = this.stringBlock.indexOf(0, offset);
       return this.stringBlock.toString('utf8', offset, end);
     }
   }
   ```

2. **StringBlockReader Implementation** (4 hours)
   ```typescript
   // src/parsers/StringBlockReader.ts
   export class StringBlockReader {
     private buffer: Buffer;
     private cache: Map<number, string>;

     constructor(stringBlock: Buffer) {
       this.buffer = stringBlock;
       this.cache = new Map();
     }

     public getString(offset: number): string {
       // Check cache first
       if (this.cache.has(offset)) {
         return this.cache.get(offset)!;
       }

       // Read null-terminated string
       if (offset >= this.buffer.length) {
         return '';
       }

       const end = this.buffer.indexOf(0, offset);
       if (end === -1) {
         throw new Error(`String at offset ${offset} not null-terminated`);
       }

       const str = this.buffer.toString('utf8', offset, end);
       this.cache.set(offset, str);
       return str;
     }

     public clearCache(): void {
       this.cache.clear();
     }
   }
   ```

3. **RecordIterator Implementation** (4 hours)
   - Implement iterator pattern for records
   - Support filtering by field values
   - Efficient memory usage

4. **Unit Tests** (4 hours)
   - Test header parsing with valid/invalid files
   - Test string block reading
   - Test record iteration
   - Test error conditions

**Deliverables:**
- ✅ Complete DBCReader class
- ✅ StringBlockReader class
- ✅ Unit tests with >80% coverage
- ✅ Sample DBC file parsing working

**Success Metrics:**
- Successfully parse SpellRange.dbc (68 records)
- All unit tests passing
- No memory leaks detected

---

### Week 3: Core DB2 Parser Implementation

**Objectives:**
- Implement DB2 format parser (WDB5/WDB6)
- Handle field structure parsing
- Implement compression handling
- Support 24-bit integers

**Tasks:**

1. **DB2Reader Base Implementation** (10 hours)
   ```typescript
   // src/parsers/DB2Reader.ts
   export class DB2Reader {
     private buffer: Buffer;
     private header: DB2Header;
     private fieldStorageInfo: FieldStorageInfo[];
     private stringBlock: Buffer;

     constructor(filePath: string) {
       this.buffer = fs.readFileSync(filePath);
       this.parseHeader();
       this.validateHeader();
       this.parseFieldStructure();
       this.extractStringBlock();
     }

     private parseHeader(): void {
       const magic = this.buffer.toString('ascii', 0, 4);
       if (magic !== 'WDB5' && magic !== 'WDB6') {
         throw new Error(`Unsupported DB2 magic: ${magic}`);
       }

       this.header = {
         magic,
         recordCount: this.buffer.readUInt32LE(4),
         fieldCount: this.buffer.readUInt32LE(8),
         recordSize: this.buffer.readUInt32LE(12),
         stringBlockSize: this.buffer.readUInt32LE(16),
         tableHash: this.buffer.readUInt32LE(20),
         layoutHash: this.buffer.readUInt32LE(24),
         minId: this.buffer.readUInt32LE(28),
         maxId: this.buffer.readUInt32LE(32),
         locale: this.buffer.readUInt32LE(36),
         flags: this.buffer.readUInt16LE(40),
         idIndex: this.buffer.readUInt16LE(42),
         totalFieldCount: this.buffer.readUInt32LE(44),
         // ... additional fields based on magic version
       };
     }

     private parseFieldStructure(): void {
       if (this.header.magic === 'WDB5' || this.header.magic === 'WDB6') {
         const fieldInfoOffset = this.getFieldInfoOffset();
         this.fieldStorageInfo = [];

         for (let i = 0; i < this.header.totalFieldCount; i++) {
           const offset = fieldInfoOffset + (i * 6); // 6 bytes per field
           this.fieldStorageInfo.push({
             offset: this.buffer.readUInt16LE(offset),
             size: this.buffer.readUInt16LE(offset + 2),
             additionalData: this.buffer.readUInt32LE(offset + 4),
           });
         }
       }
     }

     private getFieldInfoOffset(): number {
       let offset = 48; // Base header size
       if (this.header.magic === 'WDB6') {
         offset = 56; // WDB6 has larger header
       }
       return offset;
     }

     public getRecord(id: number): any {
       const recordOffset = this.findRecordOffset(id);
       if (recordOffset === -1) {
         throw new Error(`Record with ID ${id} not found`);
       }

       return this.parseRecord(recordOffset);
     }

     private parseRecord(offset: number): any {
       const record: any = {};

       for (let i = 0; i < this.fieldStorageInfo.length; i++) {
         const field = this.fieldStorageInfo[i];
         const value = this.readField(offset + field.offset, field.size, field.additionalData);
         record[`field_${i}`] = value;
       }

       return record;
     }

     private readField(offset: number, sizeInBits: number, compressionInfo: number): any {
       const compressionMode = compressionInfo & 0xFFFF;

       switch (compressionMode) {
         case 0: // NONE
           return this.readRawField(offset, sizeInBits);
         case 1: // BITPACKED
           return this.readBitpackedField(offset, sizeInBits, compressionInfo);
         case 2: // COMMON_DATA
           return this.readCommonDataField(compressionInfo);
         case 3: // ARRAY_PALLET
           return this.readArrayPalletField(offset, compressionInfo);
         default:
           throw new Error(`Unknown compression mode: ${compressionMode}`);
       }
     }

     private readRawField(offset: number, sizeInBits: number): any {
       const sizeInBytes = Math.ceil(sizeInBits / 8);

       if (sizeInBytes === 3) {
         // 24-bit integer
         return this.read24BitInt(offset);
       } else if (sizeInBytes === 4) {
         return this.buffer.readUInt32LE(offset);
       } else if (sizeInBytes === 2) {
         return this.buffer.readUInt16LE(offset);
       } else if (sizeInBytes === 1) {
         return this.buffer.readUInt8(offset);
       } else {
         throw new Error(`Unsupported field size: ${sizeInBytes} bytes`);
       }
     }

     private read24BitInt(offset: number): number {
       const byte1 = this.buffer.readUInt8(offset);
       const byte2 = this.buffer.readUInt8(offset + 1);
       const byte3 = this.buffer.readUInt8(offset + 2);
       return byte1 | (byte2 << 8) | (byte3 << 16);
     }

     private readBitpackedField(offset: number, sizeInBits: number, compressionInfo: number): number {
       // Bitpacking implementation
       const bitOffset = (compressionInfo >> 16) & 0xFF;
       const bitMask = (1 << sizeInBits) - 1;
       // ... bitpacking logic
       return 0; // Placeholder
     }

     private readCommonDataField(compressionInfo: number): any {
       // Common data is stored separately, reference by compressionInfo
       return compressionInfo >> 16;
     }

     private readArrayPalletField(offset: number, compressionInfo: number): any {
       // Array pallet implementation
       return 0; // Placeholder
     }

     private findRecordOffset(id: number): number {
       // Implementation depends on whether file has ID list
       return -1; // Placeholder
     }
   }
   ```

2. **Compression Handlers** (6 hours)
   - Implement bitpacking logic
   - Implement common data handling
   - Implement array pallet reading
   - Test each compression mode

3. **Unit Tests** (4 hours)
   - Test WDB5 header parsing
   - Test WDB6 header parsing
   - Test field structure parsing
   - Test 24-bit integer reading
   - Test compression modes

**Deliverables:**
- ✅ Complete DB2Reader class
- ✅ Compression support (all modes)
- ✅ 24-bit integer handling
- ✅ Unit tests with >80% coverage

**Success Metrics:**
- Successfully parse Item.db2 header
- Correctly read 24-bit integers
- All compression modes working

---

### Week 4: Priority File Implementation (Spell, Item)

**Objectives:**
- Implement Spell.dbc/db2 schema mapping
- Implement Item.db2 and ItemSparse.db2 mapping
- Create typed interfaces for records
- Integrate with existing MCP tools

**Tasks:**

1. **Spell Schema Implementation** (8 hours)
   ```typescript
   // src/parsers/schemas/SpellSchema.ts
   export interface SpellDBCRecord {
     id: number;
     category: number;
     dispel: number;
     mechanic: number;
     attributes: number[];
     castTime: number;
     cooldown: number;
     duration: number;
     manaCost: number;
     rangeIndex: number;
     speed: number;
     name: string;
     rank: string;
     description: string;
     tooltip: string;
   }

   export class SpellDBCParser {
     private reader: DBCReader;

     constructor(filePath: string) {
       this.reader = new DBCReader(filePath);
     }

     public getSpell(spellId: number): SpellDBCRecord | null {
       for (let i = 0; i < this.reader.getRecordCount(); i++) {
         const record = this.reader.getRecord(i);
         const id = record.readUInt32LE(0);

         if (id === spellId) {
           return this.parseSpellRecord(record);
         }
       }
       return null;
     }

     private parseSpellRecord(record: Buffer): SpellDBCRecord {
       return {
         id: record.readUInt32LE(0),
         category: record.readUInt32LE(4),
         dispel: record.readUInt32LE(8),
         mechanic: record.readUInt32LE(12),
         attributes: this.parseAttributes(record),
         castTime: record.readUInt32LE(64),
         cooldown: record.readUInt32LE(68),
         duration: record.readUInt32LE(72),
         manaCost: record.readUInt32LE(76),
         rangeIndex: record.readUInt32LE(80),
         speed: record.readFloatLE(84),
         name: this.reader.getString(record.readUInt32LE(100)),
         rank: this.reader.getString(record.readUInt32LE(104)),
         description: this.reader.getString(record.readUInt32LE(108)),
         tooltip: this.reader.getString(record.readUInt32LE(112)),
       };
     }

     private parseAttributes(record: Buffer): number[] {
       const attrs: number[] = [];
       for (let i = 0; i < 16; i++) {
         attrs.push(record.readUInt32LE(16 + (i * 4)));
       }
       return attrs;
     }
   }
   ```

2. **Item Schema Implementation** (6 hours)
   - Implement ItemDB2Parser for Item.db2
   - Implement ItemSparseDB2Parser for ItemSparse.db2
   - Map item stats, quality, level requirements
   - Test with sample items

3. **Integration with get-spell-info** (4 hours)
   ```typescript
   // Update src/tools/spell.ts
   import { SpellDBCParser } from '../parsers/schemas/SpellSchema';

   const spellParser = new SpellDBCParser(process.env.SPELL_DBC_PATH || './data/dbc/Spell.dbc');

   export async function getSpellInfo(spellId: number): Promise<SpellInfo> {
     try {
       // Try DBC first for accurate range data
       const dbcSpell = spellParser.getSpell(spellId);
       if (dbcSpell) {
         return {
           spellId: dbcSpell.id,
           name: dbcSpell.name,
           rank: dbcSpell.rank,
           description: dbcSpell.description,
           tooltip: dbcSpell.tooltip,
           category: dbcSpell.category,
           dispel: dbcSpell.dispel,
           mechanic: dbcSpell.mechanic,
           attributes: parseAttributeFlags(dbcSpell.attributes),
           castTime: dbcSpell.castTime,
           cooldown: dbcSpell.cooldown,
           duration: dbcSpell.duration,
           powerCost: dbcSpell.manaCost,
           powerType: 'MANA',
           range: getSpellRange(dbcSpell.rangeIndex), // Now from DBC!
           speed: dbcSpell.speed,
           effects: await getSpellEffects(spellId), // From database
         };
       }

       // Fallback to database query
       return await getSpellInfoFromDatabase(spellId);
     } catch (error) {
       // Error handling...
     }
   }
   ```

4. **Unit Tests** (2 hours)
   - Test spell parsing
   - Test item parsing
   - Test integration with MCP tools

**Deliverables:**
- ✅ SpellDBCParser implementation
- ✅ ItemDB2Parser implementation
- ✅ Integration with get-spell-info and get-item-info
- ✅ Unit tests for schema parsing

**Success Metrics:**
- Parse Spell.dbc with 100% accuracy (validate against known spells)
- Parse Item.db2 and ItemSparse.db2 successfully
- Enhanced MCP tools return DBC data

---

### Week 5: Extended File Implementation (ChrClasses, ChrRaces, Talent, SpellEffect)

**Objectives:**
- Implement remaining priority file schemas
- Create parsers for class, race, talent data
- Validate data accuracy

**Tasks:**

1. **ChrClasses.dbc Parser** (3 hours)
   ```typescript
   // src/parsers/schemas/ChrClassesSchema.ts
   export interface ChrClassesRecord {
     id: number;
     powerType: number;
     name: string;
     nameFemale: string;
     nameNeutral: string;
     filename: string;
     spellClassSet: number;
   }
   ```

2. **ChrRaces.dbc Parser** (3 hours)
   ```typescript
   export interface ChrRacesRecord {
     id: number;
     flags: number;
     factionId: number;
     explorationSoundId: number;
     maleDisplayId: number;
     femaleDisplayId: number;
     clientPrefix: string;
     baseLanguage: number;
     creatureType: number;
     name: string;
     nameFemale: string;
   }
   ```

3. **Talent.db2 Parser** (4 hours)
   - Parse talent tree structure
   - Map talent tiers and choices
   - Link to spec IDs

4. **SpellEffect.db2 Parser** (4 hours)
   - Parse spell effect details
   - Map effect types and values
   - Link to parent spells

5. **Integration Testing** (3 hours)
   - Test all parsers together
   - Validate cross-references (e.g., talent → spell)
   - Performance testing

6. **Documentation** (3 hours)
   - Document schema mappings
   - Create usage examples
   - Write troubleshooting guide

**Deliverables:**
- ✅ All 8 priority file parsers complete
- ✅ Cross-reference validation
- ✅ Documentation for each parser

**Success Metrics:**
- All 13 classes parsed from ChrClasses.dbc
- All 25 races parsed from ChrRaces.dbc
- Talent trees correctly structured

---

### Week 6: Caching Layer Implementation

**Objectives:**
- Implement Redis-backed cache
- Optimize memory usage (<50MB per file)
- Achieve <100ms load times
- LRU eviction strategy

**Tasks:**

1. **RecordCache Class** (8 hours)
   ```typescript
   // src/parsers/cache/RecordCache.ts
   import Redis from 'ioredis';

   export class RecordCache {
     private redis: Redis;
     private maxMemoryMB: number = 50;
     private ttl: number = 3600; // 1 hour

     constructor(redisUrl?: string) {
       this.redis = new Redis(redisUrl || process.env.REDIS_URL);
     }

     public async get(cacheKey: string): Promise<any | null> {
       const cached = await this.redis.get(cacheKey);
       if (cached) {
         return JSON.parse(cached);
       }
       return null;
     }

     public async set(cacheKey: string, value: any): Promise<void> {
       const serialized = JSON.stringify(value);
       await this.redis.setex(cacheKey, this.ttl, serialized);
     }

     public async has(cacheKey: string): Promise<boolean> {
       return (await this.redis.exists(cacheKey)) === 1;
     }

     public async clear(pattern: string = '*'): Promise<void> {
       const keys = await this.redis.keys(pattern);
       if (keys.length > 0) {
         await this.redis.del(...keys);
       }
     }

     public async getStats(): Promise<CacheStats> {
       const info = await this.redis.info('stats');
       // Parse Redis INFO output
       return {
         hits: 0,
         misses: 0,
         hitRate: 0,
         memoryUsedMB: 0,
       };
     }
   }
   ```

2. **Cache Integration** (6 hours)
   - Update DBCReader to use cache
   - Update DB2Reader to use cache
   - Implement cache warming strategy
   - Test cache performance

3. **Memory Optimization** (4 hours)
   - Implement lazy loading
   - Compress cached data
   - Tune TTL values
   - Monitor memory usage

4. **Performance Testing** (2 hours)
   - Benchmark cache hit rates
   - Measure load times
   - Stress test with multiple files
   - Validate <50MB, <100ms targets

**Deliverables:**
- ✅ RecordCache class with Redis
- ✅ Cache integration in all parsers
- ✅ Performance benchmarks passing

**Success Metrics:**
- Cache hit rate >80%
- Memory usage <50MB per file
- Load times <100ms
- Redis properly configured

---

### Week 7: MCP Tool Integration & Enhancement

**Objectives:**
- Update query-dbc tool with real parsing
- Enhance get-spell-info with DBC data
- Enhance get-item-info with DB2 data
- Update src/index.ts handler

**Tasks:**

1. **Update query-dbc Tool** (6 hours)
   ```typescript
   // src/tools/dbc.ts - REPLACE placeholder
   import { DBCReader } from '../parsers/DBCReader';
   import { DB2Reader } from '../parsers/DB2Reader';
   import { RecordCache } from '../parsers/cache/RecordCache';

   const cache = new RecordCache();
   const parsers = new Map<string, DBCReader | DB2Reader>();

   export async function queryDBC(dbcFile: string, recordId: number): Promise<any> {
     try {
       // Check cache first
       const cacheKey = `dbc:${dbcFile}:${recordId}`;
       const cached = await cache.get(cacheKey);
       if (cached) {
         return cached;
       }

       // Get or create parser
       let parser = parsers.get(dbcFile);
       if (!parser) {
         const filePath = path.join(getDBC Path(dbcFile), dbcFile);
         if (!fs.existsSync(filePath)) {
           return {
             error: `DBC/DB2 file not found: ${filePath}`,
             file: dbcFile,
             recordId,
           };
         }

         const isDBC = dbcFile.toLowerCase().endsWith('.dbc');
         parser = isDBC
           ? new DBCReader(filePath)
           : new DB2Reader(filePath);
         parsers.set(dbcFile, parser);
       }

       // Parse record
       const record = isDBC
         ? (parser as DBCReader).getRecord(recordId)
         : (parser as DB2Reader).getRecord(recordId);

       // Cache result
       await cache.set(cacheKey, record);

       return {
         file: dbcFile,
         recordId,
         data: record,
       };
     } catch (error) {
       return {
         error: error instanceof Error ? error.message : String(error),
         file: dbcFile,
         recordId,
       };
     }
   }

   function getDBCPath(dbcFile: string): string {
     return dbcFile.toLowerCase().endsWith('.dbc')
       ? process.env.DBC_PATH || './data/dbc'
       : process.env.DB2_PATH || './data/db2';
   }
   ```

2. **Enhance get-spell-info** (4 hours)
   - Integrate SpellDBCParser
   - Use DBC data for ranges and attributes
   - Fallback to database when DBC unavailable

3. **Enhance get-item-info** (4 hours)
   - Integrate ItemDB2Parser
   - Use DB2 data for accurate stats
   - Validate against database values

4. **Update MCP Server Handler** (3 hours)
   - Update src/index.ts tool handlers
   - Test all integrated tools
   - Validate error handling

5. **End-to-End Testing** (3 hours)
   - Test via MCP protocol
   - Validate Claude Code integration
   - Test error scenarios

**Deliverables:**
- ✅ Fully functional query-dbc tool
- ✅ Enhanced get-spell-info with DBC data
- ✅ Enhanced get-item-info with DB2 data
- ✅ All MCP tools passing E2E tests

**Success Metrics:**
- query-dbc returns real parsed data
- get-spell-info includes accurate spell ranges
- All tools respond in <500ms

---

### Week 8: Testing, Validation, Documentation

**Objectives:**
- Comprehensive test coverage (>80%)
- Validate data accuracy against known values
- Complete documentation
- Performance optimization

**Tasks:**

1. **Unit Test Completion** (6 hours)
   - Achieve >80% code coverage
   - Test all edge cases
   - Test error conditions
   - Test cache behavior

2. **Integration Test Suite** (6 hours)
   - Test all 8 priority files
   - Validate cross-references
   - Test MCP tool integration
   - Test concurrent access

3. **Data Validation** (4 hours)
   - Compare against wowhead.com data
   - Validate spell ranges with known spells
   - Validate item stats with known items
   - Document any discrepancies

4. **Performance Optimization** (2 hours)
   - Profile memory usage
   - Optimize hotspots
   - Tune cache parameters
   - Benchmark final performance

5. **Documentation** (2 hours)
   - API reference for all parsers
   - Usage examples for each file type
   - Troubleshooting guide
   - Performance tuning guide

**Deliverables:**
- ✅ >80% test coverage achieved
- ✅ All data validation passing
- ✅ Complete documentation
- ✅ Performance benchmarks documented

**Success Metrics:**
- All tests passing
- >99% data accuracy
- Documentation complete and clear
- Performance targets met

---

## 🔧 Technical Architecture

### Class Hierarchy

```
Parser (abstract base)
├── DBCReader (legacy format)
│   ├── SpellDBCParser
│   ├── ChrClassesDBCParser
│   └── ChrRacesDBCParser
└── DB2Reader (modern format)
    ├── ItemDB2Parser
    ├── ItemSparseDB2Parser
    ├── TalentDB2Parser
    └── SpellEffectDB2Parser

RecordCache (Redis-backed)
├── get(key): Promise<any>
├── set(key, value): Promise<void>
├── has(key): Promise<boolean>
└── clear(pattern): Promise<void>

StringBlockReader
├── getString(offset): string
└── clearCache(): void
```

### File Organization

```
src/
├── parsers/
│   ├── DBCReader.ts         # DBC format parser
│   ├── DB2Reader.ts         # DB2 format parser
│   ├── StringBlockReader.ts # String table handler
│   ├── cache/
│   │   └── RecordCache.ts   # Redis cache layer
│   ├── schemas/
│   │   ├── SpellSchema.ts   # Spell.dbc/db2 schema
│   │   ├── ItemSchema.ts    # Item.db2 schema
│   │   ├── ChrClassesSchema.ts
│   │   ├── ChrRacesSchema.ts
│   │   ├── TalentSchema.ts
│   │   └── SpellEffectSchema.ts
│   └── types/
│       ├── DBCHeader.ts
│       ├── DB2Header.ts
│       └── FieldStorageInfo.ts
├── tools/
│   ├── dbc.ts               # Updated query-dbc tool
│   ├── spell.ts             # Enhanced with DBC
│   └── item.ts              # Enhanced with DB2
└── tests/
    ├── parsers/
    │   ├── DBCReader.test.ts
    │   ├── DB2Reader.test.ts
    │   └── cache/RecordCache.test.ts
    └── integration/
        └── dbc-tools.test.ts
```

---

## 🧪 Testing Strategy

### Unit Tests

**Target Coverage:** >80%

**Test Categories:**
1. **Header Parsing**
   - Valid DBC/DB2 headers
   - Invalid magic signatures
   - Corrupted headers
   - Edge case values

2. **Record Parsing**
   - Standard records
   - Edge records (first, last)
   - Invalid indices
   - Boundary conditions

3. **String Block**
   - Valid strings
   - Empty strings
   - UTF-8 encoding
   - Invalid offsets

4. **Compression**
   - Each compression mode
   - 24-bit integers
   - Bitpacking edge cases

### Integration Tests

**Test Scenarios:**
1. Parse all 8 priority files
2. Cross-reference validation (spell → effect)
3. Cache behavior under load
4. MCP tool integration
5. Concurrent access

### Validation Tests

**Data Accuracy:**
- Compare Fireball (ID 133) spell data against Wowhead
- Validate Thunderfury (ID 19019) item stats
- Verify class/race counts (13 classes, 25 races)
- Check spell range table (68 entries)

---

## 📊 Performance Targets

### Load Times

| Metric           | Target    | Measurement Method      |
|------------------|-----------|-------------------------|
| Initial parse    | <1s       | Time to parse full file |
| Cached record    | <10ms     | Redis GET latency       |
| Uncached record  | <100ms    | Parse + cache time      |
| Cache warm-up    | <30s      | Load all priority files |

### Memory Usage

| Metric           | Target    | Measurement Method      |
|------------------|-----------|-------------------------|
| Parser instance  | <10MB     | Node.js heap snapshot   |
| Cache per file   | <50MB     | Redis MEMORY USAGE      |
| Total cache      | <400MB    | 8 files * 50MB          |
| String cache     | <5MB      | StringBlockReader cache |

### Cache Performance

| Metric           | Target    | Measurement Method      |
|------------------|-----------|-------------------------|
| Hit rate         | >80%      | Cache hits / total      |
| Miss penalty     | <100ms    | Parse on miss time      |
| Eviction rate    | <10%      | LRU evictions / hour    |

---

## 🔒 Error Handling

### Error Categories

1. **File System Errors**
   - File not found
   - Permission denied
   - Disk read errors

2. **Format Errors**
   - Invalid magic signature
   - Corrupted headers
   - Unexpected EOF

3. **Data Errors**
   - Invalid record ID
   - String offset out of bounds
   - Unsupported compression

4. **Cache Errors**
   - Redis connection failed
   - Cache full
   - Serialization errors

### Error Response Format

```typescript
interface DBCError {
  error: string;
  code: ErrorCode;
  file: string;
  recordId?: number;
  details?: any;
}

enum ErrorCode {
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  INVALID_FORMAT = 'INVALID_FORMAT',
  RECORD_NOT_FOUND = 'RECORD_NOT_FOUND',
  CACHE_ERROR = 'CACHE_ERROR',
  PARSE_ERROR = 'PARSE_ERROR',
}
```

---

## 📦 Dependencies

### New Dependencies

Add to `package.json`:

```json
{
  "dependencies": {
    "ioredis": "^5.3.2",
    "iconv-lite": "^0.6.3"
  },
  "devDependencies": {
    "@types/ioredis": "^5.0.0"
  }
}
```

### System Requirements

- **Redis 7+**: For caching layer
- **Node.js 18+**: For BigInt support
- **50GB disk space**: For DBC/DB2 files (optional, can use subset)

---

## ⚠️ Risk Assessment & Mitigation

### High Risk

**Risk:** DBC/DB2 format variations across WoW versions
**Impact:** Parser fails on certain files
**Mitigation:**
- Implement version detection
- Support WDB5 and WDB6 explicitly
- Graceful degradation for unknown formats
- Comprehensive logging

**Risk:** Performance degradation with large files (100K+ records)
**Impact:** Slow response times, high memory
**Mitigation:**
- Lazy loading of records
- Aggressive caching
- Stream-based parsing for large files
- Memory profiling and optimization

### Medium Risk

**Risk:** Endianness issues on big-endian systems
**Impact:** Incorrect data parsing
**Mitigation:**
- Force little-endian reads
- Test on multiple architectures
- Document platform requirements

**Risk:** String encoding issues (non-UTF8)
**Impact:** Garbled text data
**Mitigation:**
- Use iconv-lite for encoding detection
- Support latin1, utf8, utf16
- Log encoding warnings

### Low Risk

**Risk:** Cache inconsistency
**Impact:** Stale data returned
**Mitigation:**
- File hash-based cache keys
- TTL expiration (1 hour default)
- Manual cache invalidation API

**Risk:** Concurrent access race conditions
**Impact:** Data corruption
**Mitigation:**
- Redis atomic operations
- File-level locking
- Idempotent operations

---

## 🎯 Success Metrics

### Quantitative Metrics

| Metric                     | Target | Method                          |
|----------------------------|--------|---------------------------------|
| Code coverage              | >80%   | Jest coverage report            |
| Data accuracy              | >99%   | Validation against known values |
| Parse success rate         | >95%   | Error rate tracking             |
| Cache hit rate             | >80%   | Redis INFO stats                |
| Load time (cached)         | <10ms  | Performance benchmarks          |
| Load time (uncached)       | <100ms | Performance benchmarks          |
| Memory per file            | <50MB  | Redis MEMORY USAGE              |

### Qualitative Metrics

- ✅ All 8 priority files parsing successfully
- ✅ MCP tools returning DBC-enhanced data
- ✅ Documentation complete and clear
- ✅ No critical bugs in production
- ✅ Positive developer feedback

---

## 📚 Documentation Deliverables

1. **API Reference** (`docs/api/parsers.md`)
   - Class documentation
   - Method signatures
   - Usage examples

2. **Usage Guide** (`docs/guides/dbc-parsing.md`)
   - Getting started
   - Common patterns
   - Best practices

3. **Troubleshooting** (`docs/troubleshooting/dbc-errors.md`)
   - Common errors
   - Solutions
   - Debug tips

4. **Performance Tuning** (`docs/guides/dbc-performance.md`)
   - Cache optimization
   - Memory tuning
   - Profiling guide

---

## 🔄 Integration with Existing Codebase

### Files to Modify

1. **src/tools/dbc.ts** (REPLACE placeholder, lines 11-42)
2. **src/tools/spell.ts** (ADD DBC integration)
3. **src/tools/item.ts** (ADD DB2 integration)
4. **src/index.ts** (NO CHANGES - handlers already in place)
5. **package.json** (ADD new dependencies)

### Files to Create

1. **src/parsers/DBCReader.ts** (NEW)
2. **src/parsers/DB2Reader.ts** (NEW)
3. **src/parsers/StringBlockReader.ts** (NEW)
4. **src/parsers/cache/RecordCache.ts** (NEW)
5. **src/parsers/schemas/*.ts** (NEW, 8 files)
6. **src/tests/parsers/*.test.ts** (NEW, 10+ files)

### Backward Compatibility

- ✅ All existing MCP tools remain functional
- ✅ DBC parsing is **additive** (fallback to database)
- ✅ No breaking changes to API
- ✅ Graceful degradation if DBC files missing

---

## 📅 Timeline Summary

| Week | Focus                          | Deliverables                     | Risk  |
|------|--------------------------------|----------------------------------|-------|
| 1    | Research & Architecture        | Design docs, skeleton            | Low   |
| 2    | DBC Parser (legacy)            | DBCReader, StringBlockReader     | Low   |
| 3    | DB2 Parser (modern)            | DB2Reader, compression           | Med   |
| 4    | Spell & Item Implementation    | SpellDBCParser, ItemDB2Parser    | Med   |
| 5    | Extended Files                 | 4 additional parsers             | Low   |
| 6    | Caching Layer                  | RecordCache, Redis integration   | Med   |
| 7    | MCP Tool Integration           | Updated tools, E2E tests         | Med   |
| 8    | Testing & Documentation        | >80% coverage, full docs         | Low   |

**Total Duration:** 8 weeks
**Concurrent with Phase 3.3:** Starting Week 6

---

## ✅ Acceptance Criteria

Phase 3.1 is considered **complete** when:

1. ✅ All 8 priority DBC/DB2 files parse with 100% success rate
2. ✅ Data accuracy >99% validated against wowhead.com
3. ✅ Cache layer operational with >80% hit rate
4. ✅ Load times: <10ms (cached), <100ms (uncached)
5. ✅ Memory usage: <50MB per file
6. ✅ Unit test coverage >80%
7. ✅ Integration tests all passing
8. ✅ MCP tools enhanced with DBC/DB2 data
9. ✅ Documentation complete (API, usage, troubleshooting)
10. ✅ No critical bugs in production use

---

**Document Version:** 1.0
**Last Updated:** October 31, 2025
**Status:** ✅ Planning Complete - Ready for Implementation

🤖 Generated with [Claude Code](https://claude.com/claude-code)
