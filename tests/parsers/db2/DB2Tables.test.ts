/**
 * Unit tests for DB2 Support Tables
 * Tests ID tables, copy tables, and parent lookup tables
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  DB2IdTable,
  DB2CopyTable,
  DB2ParentLookupTable,
} from '../../../src/parsers/db2/DB2Tables';

describe('DB2IdTable', () => {
  let idTable: DB2IdTable;

  beforeEach(() => {
    idTable = new DB2IdTable();
  });

  it('should add ID table entries', () => {
    idTable.add(100, 0);
    idTable.add(200, 1);
    idTable.add(300, 2);

    expect(idTable.getSize()).toBe(3);
  });

  it('should retrieve record index by ID', () => {
    idTable.add(100, 5);
    idTable.add(200, 10);
    idTable.add(300, 15);

    expect(idTable.getRecordIndex(100)).toBe(5);
    expect(idTable.getRecordIndex(200)).toBe(10);
    expect(idTable.getRecordIndex(300)).toBe(15);
  });

  it('should return null for non-existent ID', () => {
    idTable.add(100, 0);

    expect(idTable.getRecordIndex(999)).toBeNull();
  });

  it('should check if ID exists', () => {
    idTable.add(100, 0);
    idTable.add(200, 1);

    expect(idTable.has(100)).toBe(true);
    expect(idTable.has(200)).toBe(true);
    expect(idTable.has(999)).toBe(false);
  });

  it('should get all record IDs sorted', () => {
    idTable.add(300, 2);
    idTable.add(100, 0);
    idTable.add(200, 1);

    const allIds = idTable.getAllIds();
    expect(allIds).toEqual([100, 200, 300]);
  });

  it('should clear all entries', () => {
    idTable.add(100, 0);
    idTable.add(200, 1);

    expect(idTable.getSize()).toBe(2);

    idTable.clear();

    expect(idTable.getSize()).toBe(0);
    expect(idTable.has(100)).toBe(false);
    expect(idTable.has(200)).toBe(false);
  });

  it('should load from buffer', () => {
    // Create buffer with 3 entries (each 8 bytes: uint32 + uint32)
    const buffer = Buffer.alloc(24);

    // Entry 0: ID 100, Index 0
    buffer.writeUInt32LE(100, 0);
    buffer.writeUInt32LE(0, 4);

    // Entry 1: ID 200, Index 1
    buffer.writeUInt32LE(200, 8);
    buffer.writeUInt32LE(1, 12);

    // Entry 2: ID 300, Index 2
    buffer.writeUInt32LE(300, 16);
    buffer.writeUInt32LE(2, 20);

    idTable.loadFromBuffer(buffer, 3);

    expect(idTable.getSize()).toBe(3);
    expect(idTable.getRecordIndex(100)).toBe(0);
    expect(idTable.getRecordIndex(200)).toBe(1);
    expect(idTable.getRecordIndex(300)).toBe(2);
  });

  it('should handle empty buffer load', () => {
    const buffer = Buffer.alloc(0);
    idTable.loadFromBuffer(buffer, 0);

    expect(idTable.getSize()).toBe(0);
  });

  it('should overwrite existing ID on duplicate add', () => {
    idTable.add(100, 5);
    idTable.add(100, 10); // Overwrite

    expect(idTable.getRecordIndex(100)).toBe(10);
    expect(idTable.getSize()).toBe(1);
  });
});

describe('DB2CopyTable', () => {
  let copyTable: DB2CopyTable;

  beforeEach(() => {
    copyTable = new DB2CopyTable();
  });

  it('should add copy table entries', () => {
    copyTable.add(1000, 100); // ID 1000 copies from ID 100
    copyTable.add(2000, 200);
    copyTable.add(3000, 300);

    expect(copyTable.getSize()).toBe(3);
  });

  it('should retrieve source row ID for copy', () => {
    copyTable.add(1000, 100);
    copyTable.add(2000, 200);

    expect(copyTable.getSourceRowId(1000)).toBe(100);
    expect(copyTable.getSourceRowId(2000)).toBe(200);
  });

  it('should return null for non-copy record', () => {
    copyTable.add(1000, 100);

    expect(copyTable.getSourceRowId(999)).toBeNull();
  });

  it('should check if record is a copy', () => {
    copyTable.add(1000, 100);
    copyTable.add(2000, 200);

    expect(copyTable.isCopy(1000)).toBe(true);
    expect(copyTable.isCopy(2000)).toBe(true);
    expect(copyTable.isCopy(999)).toBe(false);
  });

  it('should get all copy entries', () => {
    copyTable.add(1000, 100);
    copyTable.add(2000, 200);
    copyTable.add(3000, 300);

    const copies = copyTable.getAllCopies();
    expect(copies).toHaveLength(3);

    const ids = copies.map((c) => c.newRowId);
    expect(ids).toContain(1000);
    expect(ids).toContain(2000);
    expect(ids).toContain(3000);
  });

  it('should clear all entries', () => {
    copyTable.add(1000, 100);
    copyTable.add(2000, 200);

    expect(copyTable.getSize()).toBe(2);

    copyTable.clear();

    expect(copyTable.getSize()).toBe(0);
    expect(copyTable.isCopy(1000)).toBe(false);
  });

  it('should load from buffer', () => {
    // Create buffer with 2 entries (each 8 bytes: uint32 + uint32)
    const buffer = Buffer.alloc(16);

    // Entry 0: NewID 1000, SourceID 100
    buffer.writeUInt32LE(1000, 0);
    buffer.writeUInt32LE(100, 4);

    // Entry 1: NewID 2000, SourceID 200
    buffer.writeUInt32LE(2000, 8);
    buffer.writeUInt32LE(200, 12);

    copyTable.loadFromBuffer(buffer, 2);

    expect(copyTable.getSize()).toBe(2);
    expect(copyTable.getSourceRowId(1000)).toBe(100);
    expect(copyTable.getSourceRowId(2000)).toBe(200);
  });

  it('should handle copy chains', () => {
    // 3000 → 2000 → 1000 → 100 (chain)
    copyTable.add(1000, 100);
    copyTable.add(2000, 1000);
    copyTable.add(3000, 2000);

    expect(copyTable.getSourceRowId(1000)).toBe(100);
    expect(copyTable.getSourceRowId(2000)).toBe(1000);
    expect(copyTable.getSourceRowId(3000)).toBe(2000);
  });

  it('should overwrite existing copy on duplicate add', () => {
    copyTable.add(1000, 100);
    copyTable.add(1000, 200); // Overwrite

    expect(copyTable.getSourceRowId(1000)).toBe(200);
    expect(copyTable.getSize()).toBe(1);
  });
});

describe('DB2ParentLookupTable', () => {
  let parentTable: DB2ParentLookupTable;

  beforeEach(() => {
    parentTable = new DB2ParentLookupTable();
  });

  it('should add parent-child relationships', () => {
    parentTable.add(100, 0); // Parent 100 has child at index 0
    parentTable.add(100, 1); // Parent 100 has child at index 1
    parentTable.add(200, 2); // Parent 200 has child at index 2

    expect(parentTable.getParentCount()).toBe(2);
  });

  it('should retrieve children for a parent', () => {
    parentTable.add(100, 0);
    parentTable.add(100, 1);
    parentTable.add(100, 2);

    const children = parentTable.getChildren(100);
    expect(children).toEqual([0, 1, 2]);
  });

  it('should return empty array for parent with no children', () => {
    parentTable.add(100, 0);

    const children = parentTable.getChildren(999);
    expect(children).toEqual([]);
  });

  it('should check if parent has children', () => {
    parentTable.add(100, 0);
    parentTable.add(200, 1);

    expect(parentTable.hasChildren(100)).toBe(true);
    expect(parentTable.hasChildren(200)).toBe(true);
    expect(parentTable.hasChildren(999)).toBe(false);
  });

  it('should get all parent IDs sorted', () => {
    parentTable.add(300, 0);
    parentTable.add(100, 1);
    parentTable.add(200, 2);

    const parentIds = parentTable.getAllParentIds();
    expect(parentIds).toEqual([100, 200, 300]);
  });

  it('should get total child count', () => {
    parentTable.add(100, 0);
    parentTable.add(100, 1);
    parentTable.add(200, 2);
    parentTable.add(200, 3);
    parentTable.add(300, 4);

    expect(parentTable.getTotalChildCount()).toBe(5);
  });

  it('should clear all entries', () => {
    parentTable.add(100, 0);
    parentTable.add(200, 1);

    expect(parentTable.getParentCount()).toBe(2);

    parentTable.clear();

    expect(parentTable.getParentCount()).toBe(0);
    expect(parentTable.hasChildren(100)).toBe(false);
  });

  it('should load from buffer', () => {
    // Create buffer with 3 entries (each 8 bytes: uint32 + uint32)
    const buffer = Buffer.alloc(24);

    // Entry 0: Parent 100, Child Index 0
    buffer.writeUInt32LE(100, 0);
    buffer.writeUInt32LE(0, 4);

    // Entry 1: Parent 100, Child Index 1
    buffer.writeUInt32LE(100, 8);
    buffer.writeUInt32LE(1, 12);

    // Entry 2: Parent 200, Child Index 2
    buffer.writeUInt32LE(200, 16);
    buffer.writeUInt32LE(2, 20);

    parentTable.loadFromBuffer(buffer, 3);

    expect(parentTable.getParentCount()).toBe(2);
    expect(parentTable.getChildren(100)).toEqual([0, 1]);
    expect(parentTable.getChildren(200)).toEqual([2]);
  });

  it('should handle multiple children per parent', () => {
    parentTable.add(100, 0);
    parentTable.add(100, 1);
    parentTable.add(100, 2);
    parentTable.add(100, 3);
    parentTable.add(100, 4);

    const children = parentTable.getChildren(100);
    expect(children).toHaveLength(5);
    expect(children).toEqual([0, 1, 2, 3, 4]);
  });

  it('should handle parent with single child', () => {
    parentTable.add(100, 0);

    expect(parentTable.hasChildren(100)).toBe(true);
    expect(parentTable.getChildren(100)).toEqual([0]);
  });

  it('should handle many parents with few children each', () => {
    for (let parentId = 100; parentId < 110; parentId++) {
      parentTable.add(parentId, parentId - 100);
      parentTable.add(parentId, parentId - 99);
    }

    expect(parentTable.getParentCount()).toBe(10);
    expect(parentTable.getTotalChildCount()).toBe(20);
  });
});
