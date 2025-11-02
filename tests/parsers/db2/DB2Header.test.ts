/**
 * Unit tests for DB2Header parsing
 */

import { parseDB2Header, isValidDB2Signature, DB2ColumnCompression } from '../../../src/parsers/db2/DB2Header';

describe('DB2Header', () => {
  describe('parseDB2Header', () => {
    it('should parse valid WDC5 header', () => {
      // Create mock WDC5 header
      const buffer = Buffer.alloc(204);
      buffer.write('WDC5', 0, 'ascii'); // Signature
      buffer.writeUInt32LE(5, 4); // Version
      // Schema at offset 8-135 (128 bytes)
      buffer.write('TestSchema', 8, 'ascii');
      buffer.writeUInt32LE(100, 136); // recordCount
      buffer.writeUInt32LE(10, 140); // fieldCount
      buffer.writeUInt32LE(40, 144); // recordSize
      buffer.writeUInt32LE(5000, 148); // stringTableSize
      buffer.writeUInt32LE(0x12345678, 152); // tableHash
      buffer.writeUInt32LE(0x87654321, 156); // layoutHash
      buffer.writeUInt32LE(1, 160); // minId
      buffer.writeUInt32LE(1000, 164); // maxId
      buffer.writeUInt32LE(0, 168); // locale
      buffer.writeUInt16LE(0, 172); // flags
      buffer.writeInt16LE(0, 174); // indexField
      buffer.writeUInt32LE(10, 176); // totalFieldCount
      buffer.writeUInt32LE(0, 180); // packedDataOffset
      buffer.writeUInt32LE(0, 184); // parentLookupCount
      buffer.writeUInt32LE(0, 188); // columnMetaSize
      buffer.writeUInt32LE(0, 192); // commonDataSize
      buffer.writeUInt32LE(0, 196); // palletDataSize
      buffer.writeUInt32LE(1, 200); // sectionCount

      const header = parseDB2Header(buffer);

      expect(header.signature).toBe('WDC5');
      expect(header.version).toBe(5);
      expect(header.schema).toBe('TestSchema');
      expect(header.recordCount).toBe(100);
      expect(header.fieldCount).toBe(10);
      expect(header.recordSize).toBe(40);
      expect(header.stringTableSize).toBe(5000);
      expect(header.tableHash).toBe(0x12345678);
      expect(header.layoutHash).toBe(0x87654321);
      expect(header.minId).toBe(1);
      expect(header.maxId).toBe(1000);
      expect(header.sectionCount).toBe(1);
    });

    it('should throw on buffer too small', () => {
      const buffer = Buffer.alloc(50);
      expect(() => parseDB2Header(buffer)).toThrow('DB2 header too small');
    });

    it('should parse WDC6 signature', () => {
      const buffer = Buffer.alloc(204);
      buffer.write('WDC6', 0, 'ascii');
      buffer.writeUInt32LE(6, 4);
      buffer.writeUInt32LE(100, 136);
      buffer.writeUInt32LE(10, 140);
      buffer.writeUInt32LE(40, 144);
      buffer.writeUInt32LE(1000, 148);
      buffer.writeUInt32LE(1, 200);

      const header = parseDB2Header(buffer);
      expect(header.signature).toBe('WDC6');
      expect(header.version).toBe(6);
    });
  });

  describe('isValidDB2Signature', () => {
    it('should return true for WDC5', () => {
      expect(isValidDB2Signature('WDC5')).toBe(true);
    });

    it('should return true for WDC6', () => {
      expect(isValidDB2Signature('WDC6')).toBe(true);
    });

    it('should return true for WDC4', () => {
      expect(isValidDB2Signature('WDC4')).toBe(true);
    });

    it('should return true for WDC3', () => {
      expect(isValidDB2Signature('WDC3')).toBe(true);
    });

    it('should return false for invalid signature', () => {
      expect(isValidDB2Signature('WDBC')).toBe(false);
      expect(isValidDB2Signature('WDC2')).toBe(false);
      expect(isValidDB2Signature('XXXX')).toBe(false);
    });
  });

  describe('DB2ColumnCompression', () => {
    it('should have correct enum values', () => {
      expect(DB2ColumnCompression.None).toBe(0);
      expect(DB2ColumnCompression.Immediate).toBe(1);
      expect(DB2ColumnCompression.CommonData).toBe(2);
      expect(DB2ColumnCompression.Pallet).toBe(3);
      expect(DB2ColumnCompression.PalletArray).toBe(4);
      expect(DB2ColumnCompression.SignedImmediate).toBe(5);
    });
  });
});
