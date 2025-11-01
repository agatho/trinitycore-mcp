/**
 * DBC/DB2 file reading tool
 * Week 7: Enhanced with DB2CachedFileLoader integration
 */

import * as fs from "fs";
import * as path from "path";
import { DB2CachedLoaderFactory } from "../parsers/db2/DB2CachedFileLoader";
import { SchemaFactory } from "../parsers/schemas/SchemaFactory";

const DBC_PATH = process.env.DBC_PATH || "./data/dbc";
const DB2_PATH = process.env.DB2_PATH || "./data/db2";

/**
 * Query result for DBC/DB2 records
 */
export interface DBCQueryResult {
  file: string;
  recordId?: number;
  recordNumber?: number;
  success: boolean;
  data?: any;
  rawData?: any;
  cacheStats?: any;
  error?: string;
  note?: string;
  filePath?: string;
}

/**
 * Query DBC/DB2 file for a specific record
 * @param dbcFile File name (e.g., "Spell.db2", "Item.db2")
 * @param recordId Record ID to query (0-based index)
 * @returns Query result with parsed data
 */
export async function queryDBC(dbcFile: string, recordId: number): Promise<DBCQueryResult> {
  try {
    // Determine if it's DBC or DB2
    const isDBC = dbcFile.toLowerCase().endsWith(".dbc");
    const basePath = isDBC ? DBC_PATH : DB2_PATH;
    const filePath = path.join(basePath, dbcFile);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return {
        file: dbcFile,
        recordId,
        success: false,
        error: `DBC/DB2 file not found: ${filePath}`,
        note: "Please ensure the file exists in the configured DBC/DB2 path",
        filePath,
      };
    }

    // Get or create cached loader
    const loader = DB2CachedLoaderFactory.getLoader(dbcFile);

    // Load file if not already loaded
    try {
      if (loader.getRecordCount() === 0) {
        loader.loadFromFile(filePath);
      }
    } catch (loadError) {
      // File not loaded yet, load it now
      loader.loadFromFile(filePath);
    }

    // Validate record ID
    const recordCount = loader.getRecordCount();
    if (recordId < 0 || recordId >= recordCount) {
      return {
        file: dbcFile,
        recordId,
        success: false,
        error: `Invalid record ID: ${recordId}. Valid range: 0-${recordCount - 1}`,
        note: `File contains ${recordCount} records`,
        filePath,
      };
    }

    // Get cached record
    const rawRecord = loader.getCachedRecord(recordId);

    // Try to parse with schema if available
    let parsedData = null;
    if (SchemaFactory.hasSchema(dbcFile)) {
      parsedData = loader.getTypedRecord(recordId);
    }

    // Get cache statistics
    const cacheStats = loader.getCacheStats();

    return {
      file: dbcFile,
      recordId,
      recordNumber: recordId,
      success: true,
      data: parsedData,
      rawData: rawRecord ? {
        recordNumber: recordId,
        fields: extractRawFields(rawRecord),
      } : null,
      cacheStats: {
        rawCacheEntries: cacheStats.raw.entryCount,
        parsedCacheEntries: cacheStats.parsed.entryCount,
        totalHits: cacheStats.totalHits,
        totalMisses: cacheStats.totalMisses,
        hitRate: cacheStats.raw.hitRate.toFixed(2) + "%",
        loadTime: cacheStats.loadTime + "ms",
      },
      filePath,
    };
  } catch (error) {
    return {
      file: dbcFile,
      recordId,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Query all records from a DBC/DB2 file
 * @param dbcFile File name
 * @param limit Maximum records to return (default: 100)
 * @returns Array of query results
 */
export async function queryAllDBC(
  dbcFile: string,
  limit: number = 100
): Promise<DBCQueryResult> {
  try {
    const isDBC = dbcFile.toLowerCase().endsWith(".dbc");
    const basePath = isDBC ? DBC_PATH : DB2_PATH;
    const filePath = path.join(basePath, dbcFile);

    if (!fs.existsSync(filePath)) {
      return {
        file: dbcFile,
        success: false,
        error: `DBC/DB2 file not found: ${filePath}`,
        filePath,
      };
    }

    const loader = DB2CachedLoaderFactory.getLoader(dbcFile);

    try {
      if (loader.getRecordCount() === 0) {
        loader.loadFromFile(filePath);
      }
    } catch (loadError) {
      loader.loadFromFile(filePath);
    }

    const recordCount = loader.getRecordCount();
    const actualLimit = Math.min(limit, recordCount);

    // Get records with schema parsing if available
    let records: any[] = [];
    if (SchemaFactory.hasSchema(dbcFile)) {
      const typedRecords = loader.batchGetTypedRecords(
        Array.from({ length: actualLimit }, (_, i) => i)
      );
      records = typedRecords.filter((r) => r !== null);
    } else {
      const rawRecords = loader.batchGetRecords(
        Array.from({ length: actualLimit }, (_, i) => i)
      );
      records = rawRecords.map((r, i) => ({
        recordNumber: i,
        fields: extractRawFields(r),
      }));
    }

    const cacheStats = loader.getCacheStats();

    return {
      file: dbcFile,
      success: true,
      data: {
        totalRecords: recordCount,
        returnedRecords: records.length,
        limit: actualLimit,
        records,
      },
      cacheStats: {
        rawCacheEntries: cacheStats.raw.entryCount,
        parsedCacheEntries: cacheStats.parsed.entryCount,
        totalHits: cacheStats.totalHits,
        totalMisses: cacheStats.totalMisses,
        hitRate: cacheStats.raw.hitRate.toFixed(2) + "%",
        loadTime: cacheStats.loadTime + "ms",
      },
      filePath,
    };
  } catch (error) {
    return {
      file: dbcFile,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Get cache statistics for a loaded file
 * @param dbcFile File name
 * @returns Cache statistics
 */
export async function getCacheStats(dbcFile: string): Promise<DBCQueryResult> {
  try {
    const loader = DB2CachedLoaderFactory.getLoader(dbcFile);
    const stats = loader.getCacheStats();
    const memory = loader.getCacheMemoryUsage();
    const efficiency = loader.getCacheEfficiency();

    return {
      file: dbcFile,
      success: true,
      data: {
        cacheStats: {
          rawCache: {
            entries: stats.raw.entryCount,
            hits: stats.raw.hits,
            misses: stats.raw.misses,
            evictions: stats.raw.evictions,
            hitRate: stats.raw.hitRate.toFixed(2) + "%",
            memoryMB: memory.rawMB.toFixed(2),
          },
          parsedCache: {
            entries: stats.parsed.entryCount,
            hits: stats.parsed.hits,
            misses: stats.parsed.misses,
            evictions: stats.parsed.evictions,
            hitRate: stats.parsed.hitRate.toFixed(2) + "%",
            memoryMB: memory.parsedMB.toFixed(2),
          },
          overall: {
            totalHits: stats.totalHits,
            totalMisses: stats.totalMisses,
            totalMemoryMB: memory.totalMB.toFixed(2),
            overallHitRate: efficiency.hitRate.toFixed(2) + "%",
            memoryUsagePercent: efficiency.memoryUsagePercent.toFixed(2) + "%",
            loadTime: stats.loadTime + "ms",
          },
        },
      },
    };
  } catch (error) {
    return {
      file: dbcFile,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Get global cache statistics across all loaded files
 * @returns Global cache statistics
 */
export async function getGlobalCacheStats(): Promise<any> {
  try {
    const globalStats = DB2CachedLoaderFactory.getGlobalStats();

    const fileStats: any[] = [];
    for (const [fileName, stats] of globalStats.files.entries()) {
      fileStats.push({
        file: fileName,
        loadTime: stats.loadTime + "ms",
        rawEntries: stats.raw.entryCount,
        parsedEntries: stats.parsed.entryCount,
        totalHits: stats.totalHits,
        totalMisses: stats.totalMisses,
        hitRate:
          stats.totalHits + stats.totalMisses > 0
            ? ((stats.totalHits / (stats.totalHits + stats.totalMisses)) * 100).toFixed(2) + "%"
            : "0.00%",
      });
    }

    return {
      success: true,
      data: {
        totalFiles: globalStats.totalFiles,
        totalMemoryMB: globalStats.totalMemoryMB.toFixed(2),
        totalHits: globalStats.totalHits,
        totalMisses: globalStats.totalMisses,
        overallHitRate:
          globalStats.totalHits + globalStats.totalMisses > 0
            ? (
                (globalStats.totalHits / (globalStats.totalHits + globalStats.totalMisses)) *
                100
              ).toFixed(2) + "%"
            : "0.00%",
        files: fileStats,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Extract raw field values from a DB2Record
 * @param record DB2Record to extract from
 * @returns Object with field indices and values
 */
function extractRawFields(record: any): Record<string, any> {
  const fields: Record<string, any> = {};

  try {
    // Try to extract first 10 fields as uint32
    for (let i = 0; i < 10; i++) {
      try {
        fields[`field_${i}`] = record.getUInt32(i);
      } catch (e) {
        // Field doesn't exist or wrong type
        break;
      }
    }
  } catch (error) {
    // Could not extract fields
  }

  return fields;
}
