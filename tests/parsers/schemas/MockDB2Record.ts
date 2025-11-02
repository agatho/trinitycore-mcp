/**
 * Mock DB2Record for testing schema parsers
 * Extends DB2Record with test-friendly constructor
 */

import { DB2Record } from '../../../src/parsers/db2/DB2Record';
import { DB2ColumnMeta, DB2ColumnCompression } from '../../../src/parsers/db2/DB2Header';

/**
 * Mock DB2Record that accepts data by field index
 * Simplifies test setup by avoiding Buffer management
 */
export class MockDB2Record extends DB2Record {
  private fieldData: Map<number, any> = new Map();

  constructor(data: { [key: number]: any }) {
    // Create empty buffers for parent constructor
    const recordData = Buffer.alloc(4096);
    const stringBlock = Buffer.alloc(4096);
    const columnMeta: DB2ColumnMeta[] = [];

    super(recordData, stringBlock, columnMeta, 0);

    // Store field data
    Object.entries(data).forEach(([key, value]) => {
      this.fieldData.set(Number(key), value);
    });
  }

  // Override getUInt32 to return mock data
  public getUInt32(field: number, arrayIndex: number = 0): number {
    const value = this.fieldData.get(field);
    if (Array.isArray(value)) {
      return value[arrayIndex] || 0;
    }
    return value || 0;
  }

  // Override getInt32 to return mock data
  public getInt32(field: number, arrayIndex: number = 0): number {
    const value = this.fieldData.get(field);
    if (Array.isArray(value)) {
      return value[arrayIndex] || 0;
    }
    return value || 0;
  }

  // Override getUInt16 to return mock data
  public getUInt16(field: number, arrayIndex: number = 0): number {
    const value = this.fieldData.get(field);
    if (Array.isArray(value)) {
      return value[arrayIndex] || 0;
    }
    return value || 0;
  }

  // Override getUInt8 to return mock data
  public getUInt8(field: number, arrayIndex: number = 0): number {
    const value = this.fieldData.get(field);
    if (Array.isArray(value)) {
      return value[arrayIndex] || 0;
    }
    return value || 0;
  }

  // Override getUInt64 to return mock data
  public getUInt64(field: number): bigint {
    const value = this.fieldData.get(field);
    return typeof value === 'bigint' ? value : BigInt(value || 0);
  }

  // Override getFloat to return mock data
  public getFloat(field: number, arrayIndex: number = 0): number {
    const value = this.fieldData.get(field);
    if (Array.isArray(value)) {
      return value[arrayIndex] || 0.0;
    }
    return value || 0.0;
  }

  // Override getString to return mock data
  public getString(field: number): string {
    const value = this.fieldData.get(field);
    return value || '';
  }
}
