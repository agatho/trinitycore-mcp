/**
 * Unit tests for DB2FileSource
 */

import { DB2MemorySource } from '../../../src/parsers/db2/DB2FileSource';

describe('DB2FileSource', () => {
  describe('DB2MemorySource', () => {
    it('should read from memory buffer', () => {
      const testData = Buffer.from('Hello World!', 'utf8');
      const source = new DB2MemorySource(testData, 'test.db2');

      expect(source.isOpen()).toBe(true);
      expect(source.getFileSize()).toBe(testData.length);
      expect(source.getFileName()).toBe('test.db2');
      expect(source.getPosition()).toBe(0);
    });

    it('should read bytes correctly', () => {
      const testData = Buffer.from([0x01, 0x02, 0x03, 0x04, 0x05]);
      const source = new DB2MemorySource(testData);

      const buffer = Buffer.alloc(3);
      const success = source.read(buffer, 3);

      expect(success).toBe(true);
      expect(buffer[0]).toBe(0x01);
      expect(buffer[1]).toBe(0x02);
      expect(buffer[2]).toBe(0x03);
      expect(source.getPosition()).toBe(3);
    });

    it('should fail to read beyond buffer size', () => {
      const testData = Buffer.from([0x01, 0x02]);
      const source = new DB2MemorySource(testData);

      const buffer = Buffer.alloc(5);
      const success = source.read(buffer, 5);

      expect(success).toBe(false);
    });

    it('should set position correctly', () => {
      const testData = Buffer.from([0x01, 0x02, 0x03, 0x04]);
      const source = new DB2MemorySource(testData);

      expect(source.setPosition(2)).toBe(true);
      expect(source.getPosition()).toBe(2);

      const buffer = Buffer.alloc(1);
      source.read(buffer, 1);
      expect(buffer[0]).toBe(0x03);
    });

    it('should fail to set position out of bounds', () => {
      const testData = Buffer.from([0x01, 0x02]);
      const source = new DB2MemorySource(testData);

      expect(source.setPosition(-1)).toBe(false);
      expect(source.setPosition(10)).toBe(false);
    });
  });
});
