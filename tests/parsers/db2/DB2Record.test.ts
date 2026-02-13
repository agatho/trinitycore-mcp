/**
 * Unit tests for DB2Record - WDC5 String Offset Resolution
 *
 * Tests the TrinityCore-compatible string offset formula that correctly
 * resolves string offsets from WDC5 inline (dense) records.
 *
 * The key insight: raw string offsets in WDC5 records are calibrated for
 * TrinityCore's combined buffer layout where ALL sections' records come
 * first, then ALL sections' strings. Our per-section buffers need a
 * correction factor to translate these offsets.
 *
 * Formula: bufferPosition = recordIndex * recordSize + fieldOffset + rawOffset + correction
 * Where: correction = (sectionRecordCount - headerRecordCount) * recordSize
 *                    + sectionRecordStartOffset - sectionStringTableStartOffset
 */

import { describe, it, expect } from '@jest/globals';
import { DB2Record } from '../../../src/parsers/db2/DB2Record';
import { DB2ColumnMeta, DB2FieldEntry } from '../../../src/parsers/db2/DB2Header';

/**
 * Helper: Build a per-section combined buffer [Records][StringTable]
 * mimicking what DB2FileLoader produces.
 *
 * The buffer is sized as: sectionRecordCount * recordSize + stringTableSize
 * Records are written at their correct positions (index * recordSize).
 * Strings are written at recordAreaSize + offset.
 */
function buildCombinedBuffer(
  sectionRecordCount: number,
  records: { index: number; rawOffset: number }[],
  strings: { offset: number; text: string }[],
  recordSize: number
): Buffer {
  // Calculate string table size
  let stringTableSize = 0;
  for (const s of strings) {
    stringTableSize = Math.max(stringTableSize, s.offset + Buffer.byteLength(s.text, 'utf8') + 1);
  }

  const recordDataSize = sectionRecordCount * recordSize;
  const buffer = Buffer.alloc(recordDataSize + stringTableSize);

  // Write records at their correct positions
  for (const r of records) {
    buffer.writeUInt32LE(r.rawOffset, r.index * recordSize);
  }

  // Write strings into string table area
  for (const s of strings) {
    buffer.write(s.text, recordDataSize + s.offset, 'utf8');
    buffer[recordDataSize + s.offset + Buffer.byteLength(s.text, 'utf8')] = 0; // null terminator
  }

  return buffer;
}

describe('DB2Record', () => {
  describe('getString() for dense/inline files', () => {
    const recordSize = 4;

    // Simulate SpellName.db2-like scenario:
    // - Section 0: 100 records, headerRecordCount: 110 (10 records in other sections)
    // - String offset correction: (100 - 110) * 4 + 0 - 0 = -40
    const sectionRecordCount = 100;
    const headerRecordCount = 110;
    const correction = (sectionRecordCount - headerRecordCount) * recordSize; // -40

    it('should correctly resolve string at offset 0 with TrinityCore formula', () => {
      // String "Hello" at string table offset 0
      // For record 0: TrinityCore target = 0 + 0 + rawOffset
      // TrinityCore string table starts at headerRecordCount * recordSize = 440
      // So rawOffset for string table offset 0 = 440
      const rawOffset = headerRecordCount * recordSize; // 440
      const strings = [{ offset: 0, text: 'Hello' }];
      const records = [{ index: 0, rawOffset }];
      const buffer = buildCombinedBuffer(sectionRecordCount, records, strings, recordSize);

      const record = new DB2Record(
        buffer, buffer, [], 0, [],
        1,     // recordId
        false, // not sparse
        recordSize,
        sectionRecordCount,
        0,     // sectionFileOffset
        correction
      );

      expect(record.getString(0, 0)).toBe('Hello');
    });

    it('should correctly resolve string at non-zero offset', () => {
      // String "World" at string table offset 10
      // For record 0: rawOffset = headerRecordCount * recordSize + 10 = 450
      const rawOffset = headerRecordCount * recordSize + 10; // 450
      const strings = [
        { offset: 0, text: 'Other' },
        { offset: 10, text: 'World' },
      ];
      const records = [{ index: 0, rawOffset }];
      const buffer = buildCombinedBuffer(sectionRecordCount, records, strings, recordSize);

      const record = new DB2Record(
        buffer, buffer, [], 0, [],
        1, false, recordSize, sectionRecordCount, 0, correction
      );

      expect(record.getString(0, 0)).toBe('World');
    });

    it('should handle non-zero record index (offset shifts with record position)', () => {
      // For record 5: TrinityCore target = 5*4 + 0 + rawOffset
      // String at string table offset 2 → TrinityCore position = 440 + 2 = 442
      // rawOffset = 442 - 20 = 422 (subtracting record position 5*4=20)
      const rawOffset = headerRecordCount * recordSize + 2 - (5 * recordSize); // 440 + 2 - 20 = 422
      const strings = [
        { offset: 0, text: 'X' },
        { offset: 2, text: 'Fireball' },
      ];

      const records = [{ index: 5, rawOffset }];
      const buffer = buildCombinedBuffer(sectionRecordCount, records, strings, recordSize);

      const record = new DB2Record(
        buffer, buffer, [], 5, [],
        100, false, recordSize, sectionRecordCount, 0, correction
      );

      expect(record.getString(0, 0)).toBe('Fireball');
    });

    it('should return empty string for rawOffset === 0', () => {
      const strings = [{ offset: 0, text: 'ShouldNotReturn' }];
      const records = [{ index: 0, rawOffset: 0 }];
      const buffer = buildCombinedBuffer(sectionRecordCount, records, strings, recordSize);

      const record = new DB2Record(
        buffer, buffer, [], 0, [],
        1, false, recordSize, sectionRecordCount, 0, correction
      );

      expect(record.getString(0, 0)).toBe('');
    });

    it('should return empty string for out-of-bounds offset', () => {
      const strings = [{ offset: 0, text: 'Hello' }];
      const records = [{ index: 0, rawOffset: 999999 }]; // Way too large
      const buffer = buildCombinedBuffer(sectionRecordCount, records, strings, recordSize);

      const record = new DB2Record(
        buffer, buffer, [], 0, [],
        1, false, recordSize, sectionRecordCount, 0, correction
      );

      expect(record.getString(0, 0)).toBe('');
    });

    it('should work with zero correction (single section file)', () => {
      // If headerRecordCount === sectionRecordCount, correction is 0
      const singleSectionRecordCount = 50;
      const zeroCorrection = 0;
      // String at offset 5, record 0: rawOffset = 50*4 + 5 = 205
      const rawOffset = singleSectionRecordCount * recordSize + 5;
      const strings = [
        { offset: 0, text: 'AAAA' },
        { offset: 5, text: 'Frostbolt' },
      ];
      const records = [{ index: 0, rawOffset }];
      const buffer = buildCombinedBuffer(singleSectionRecordCount, records, strings, recordSize);

      const record = new DB2Record(
        buffer, buffer, [], 0, [],
        1, false, recordSize, singleSectionRecordCount, 0, zeroCorrection
      );

      expect(record.getString(0, 0)).toBe('Frostbolt');
    });

    it('should handle SpellName.db2-like dimensions (177k records, 372 correction)', () => {
      // Simulate real SpellName.db2 proportions:
      // sectionRecordCount = 177216, headerRecordCount = 177309
      // correction = (177216 - 177309) * 4 = -372
      //
      // We use small numbers that produce the same -372 correction:
      // sectionRecordCount = 20, headerRecordCount = 113 → correction = (20-113)*4 = -372

      const simSectionRecordCount = 20;
      const simHeaderRecordCount = 113;
      const simCorrection = (simSectionRecordCount - simHeaderRecordCount) * recordSize; // -372

      expect(simCorrection).toBe(-372);

      // String "Word of Recall (OLD)" at string table offset 2
      // For record 0: rawOffset = 113*4 + 2 = 454
      const rawOffset = simHeaderRecordCount * recordSize + 2; // 454
      const strings = [
        { offset: 0, text: 'X' },
        { offset: 2, text: 'Word of Recall (OLD)' },
      ];
      const records = [{ index: 0, rawOffset }];
      const buffer = buildCombinedBuffer(simSectionRecordCount, records, strings, recordSize);

      const record = new DB2Record(
        buffer, buffer, [], 0, [],
        1, false, recordSize, simSectionRecordCount, 0, simCorrection
      );

      expect(record.getString(0, 0)).toBe('Word of Recall (OLD)');
    });

    it('should handle multi-section correction with section offsets', () => {
      // Section 1 with:
      // - sectionRecordStartOffset = 400 (section 0 had 100 records * 4 bytes)
      // - sectionStringTableStartOffset = 5000 (section 0 had 5000 bytes of strings)
      // - sectionRecordCount = 10
      // - headerRecordCount = 120
      // correction = (10 - 120) * 4 + 400 - 5000 = -440 + 400 - 5000 = -5040

      const sec1RecordCount = 10;
      const sec1HeaderRecordCount = 120;
      const sec1RecordStartOffset = 400; // 100 records * 4 bytes from section 0
      const sec1StringTableStartOffset = 5000; // section 0's string table size
      const sec1Correction =
        (sec1RecordCount - sec1HeaderRecordCount) * recordSize
        + sec1RecordStartOffset
        - sec1StringTableStartOffset;

      expect(sec1Correction).toBe(-5040);

      // String at section 1's string table offset 3
      // In TrinityCore's buffer:
      //   record buffer position = sec1RecordStartOffset + 0 = 400
      //   target = 400 + 0 + rawOffset
      //   overall string table start = 120 * 4 = 480
      //   section 1 string table starts at overall offset 5000
      //   section 1 local string offset 3 → overall offset 5003
      //   target = 480 + 5003 = 5483
      //   rawOffset = 5483 - 400 = 5083
      const rawOffset = (sec1HeaderRecordCount * recordSize + sec1StringTableStartOffset + 3) - sec1RecordStartOffset;
      // = (480 + 5000 + 3) - 400 = 5083

      const strings = [
        { offset: 0, text: 'AB' },
        { offset: 3, text: 'Shadowmeld' },
      ];
      const records = [{ index: 0, rawOffset }];
      const buffer = buildCombinedBuffer(sec1RecordCount, records, strings, recordSize);

      const record = new DB2Record(
        buffer, buffer, [], 0, [],
        500, false, recordSize, sec1RecordCount, 0, sec1Correction
      );

      expect(record.getString(0, 0)).toBe('Shadowmeld');
    });

    it('should handle UTF-8 multibyte characters in spell names', () => {
      const rawOffset = headerRecordCount * recordSize + 5;
      const strings = [
        { offset: 0, text: 'AAAA' },
        { offset: 5, text: 'Zürich Ätherblitz' },
      ];
      const records = [{ index: 0, rawOffset }];
      const buffer = buildCombinedBuffer(sectionRecordCount, records, strings, recordSize);

      const record = new DB2Record(
        buffer, buffer, [], 0, [],
        1, false, recordSize, sectionRecordCount, 0, correction
      );

      expect(record.getString(0, 0)).toBe('Zürich Ätherblitz');
    });
  });

  describe('getString() for sparse files', () => {
    it('should read inline string from sparse record', () => {
      // Sparse records have strings inline in record data
      // Record: [uint32 id][string "Fireball\0"]
      const recordData = Buffer.alloc(20);
      recordData.writeUInt32LE(133, 0); // id
      recordData.write('Fireball', 4, 'utf8');
      recordData[12] = 0; // null terminator

      const record = new DB2Record(
        recordData, Buffer.alloc(0), [], 0,
        [{ unusedBits: 0, offset: 0 }, { unusedBits: 0, offset: 4 }], // field entries
        133,  // recordId
        true, // isSparseFile
        20,   // recordSize
        0,    // recordCount
        0     // sectionFileOffset
      );

      expect(record.getString(1, 0)).toBe('Fireball');
    });
  });

  describe('getId()', () => {
    it('should return provided record ID', () => {
      const buffer = Buffer.alloc(4);
      const record = new DB2Record(
        buffer, buffer, [], 0, [], 42, false, 4, 1, 0, 0
      );
      expect(record.getId()).toBe(42);
    });
  });

  describe('getUInt32()', () => {
    it('should read uint32 from record', () => {
      const buffer = Buffer.alloc(8);
      buffer.writeUInt32LE(12345, 0);
      buffer.writeUInt32LE(67890, 4);

      const record = new DB2Record(
        buffer, buffer, [], 0, [], 1, false, 8, 1, 0, 0
      );

      expect(record.getUInt32(0, 0)).toBe(12345);
    });
  });

  describe('getFloat()', () => {
    it('should read float from record', () => {
      const buffer = Buffer.alloc(8);
      buffer.writeFloatLE(3.14, 0);

      const record = new DB2Record(
        buffer, buffer, [], 0, [], 1, false, 8, 1, 0, 0
      );

      expect(record.getFloat(0, 0)).toBeCloseTo(3.14, 2);
    });
  });
});
