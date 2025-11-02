/**
 * Unit tests for CacheWarmer
 * Tests cache warming strategies and preloading
 */

import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { CacheWarmer } from "../../../src/parsers/cache/CacheWarmer";
import { DB2CachedLoaderFactory } from "../../../src/parsers/db2/DB2CachedFileLoader";
import { CacheManager } from "../../../src/parsers/cache/RecordCache";

// Mock DB2FileLoader
jest.mock("../../../src/parsers/db2/DB2FileLoader", () => {
  return {
    DB2FileLoader: jest.fn().mockImplementation(() => ({
      load: jest.fn(),
      loadFromFile: jest.fn(),
      getHeader: jest.fn(() => ({
        recordCount: 1000,
        recordSize: 64,
        fieldCount: 10,
      })),
      getSectionHeader: jest.fn((index: number) => ({
        recordCount: 500,
        stringTableSize: 1000,
      })),
      getRecordCount: jest.fn(() => 1000),
      getRecord: jest.fn((index: number) => {
        const buffer = Buffer.alloc(64);
        buffer.writeUInt32LE(index, 0);
        const stringTable = Buffer.from("MockString\0", "utf-8");
        const { DB2Record } = require("../../../src/parsers/db2/DB2Record");
        return new DB2Record(buffer, stringTable, [], index);
      }),
    })),
  };
});

// Mock SchemaFactory
jest.mock("../../../src/parsers/schemas/SchemaFactory", () => {
  return {
    SchemaFactory: {
      parseByFileName: jest.fn((fileName: string, record: any) => {
        return {
          id: record.getUInt32(0),
          name: `MockEntry_${record.getUInt32(0)}`,
          type: "test",
        };
      }),
      hasSchema: jest.fn(() => true),
    },
  };
});

// Mock fs
jest.mock("fs", () => ({
  existsSync: jest.fn(() => true),
}));

describe("CacheWarmer", () => {
  beforeEach(() => {
    CacheManager.resetAll();
    DB2CachedLoaderFactory.clearAll();
  });

  afterEach(() => {
    CacheManager.resetAll();
    DB2CachedLoaderFactory.clearAll();
  });

  describe("warmSpellCache", () => {
    it("should warm spell cache with default common spell IDs", async () => {
      const result = await CacheWarmer.warmSpellCache();

      expect(result.success).toBe(true);
      expect(result.filesWarmed).toBe(1);
      expect(result.recordsPreloaded).toBeGreaterThan(0);
      expect(result.totalTime).toBeGreaterThanOrEqual(0);
      expect(result.fileResults).toHaveLength(1);
      expect(result.fileResults[0].file).toBe("Spell.db2");
    });

    it("should accept custom configuration", async () => {
      const customIds = [100, 200, 300];
      const result = await CacheWarmer.warmSpellCache({
        idList: customIds,
        verbose: true,
      });

      expect(result.success).toBe(true);
      expect(result.recordsPreloaded).toBe(customIds.length);
    });

    it("should limit records with maxRecordsPerFile", async () => {
      const result = await CacheWarmer.warmSpellCache({
        maxRecordsPerFile: 5,
      });

      expect(result.success).toBe(true);
      expect(result.recordsPreloaded).toBeLessThanOrEqual(5);
    });
  });

  describe("warmItemCache", () => {
    it("should warm item cache with both Item.db2 and ItemSparse.db2", async () => {
      const result = await CacheWarmer.warmItemCache();

      expect(result.success).toBe(true);
      expect(result.filesWarmed).toBe(2);
      expect(result.recordsPreloaded).toBeGreaterThan(0);
      expect(result.fileResults).toHaveLength(2);
    });

    it("should accept custom item IDs", async () => {
      const customIds = [25, 117, 6948];
      const result = await CacheWarmer.warmItemCache({
        idList: customIds,
      });

      expect(result.success).toBe(true);
      expect(result.recordsPreloaded).toBeGreaterThanOrEqual(customIds.length);
    });
  });

  describe("warmAllCaches", () => {
    it("should warm all caches with default strategies", async () => {
      const result = await CacheWarmer.warmAllCaches();

      expect(result.success).toBe(true);
      expect(result.filesWarmed).toBeGreaterThanOrEqual(3); // Spell.db2 + Item.db2 + ItemSparse.db2
      expect(result.recordsPreloaded).toBeGreaterThan(0);
      expect(result.fileResults.length).toBeGreaterThanOrEqual(3);
    });

    it("should report total time", async () => {
      const result = await CacheWarmer.warmAllCaches();

      expect(result.totalTime).toBeGreaterThanOrEqual(0);
      expect(result.success).toBe(true);
    });
  });

  describe("warmCache with strategies", () => {
    it("should support 'list' strategy", async () => {
      const result = await CacheWarmer.warmCache({
        files: ["Spell.db2"],
        strategy: "list",
        idList: [100, 200, 300, 400],
        verbose: false,
      });

      expect(result.success).toBe(true);
      expect(result.recordsPreloaded).toBe(4);
    });

    it("should support 'range' strategy", async () => {
      const result = await CacheWarmer.warmCache({
        files: ["Spell.db2"],
        strategy: "range",
        rangeStart: 0,
        rangeEnd: 49,
        verbose: false,
      });

      expect(result.success).toBe(true);
      expect(result.recordsPreloaded).toBe(50);
    });

    it("should support 'all' strategy with limit", async () => {
      const result = await CacheWarmer.warmCache({
        files: ["Spell.db2"],
        strategy: "all",
        maxRecordsPerFile: 20,
        verbose: false,
      });

      expect(result.success).toBe(true);
      expect(result.recordsPreloaded).toBeLessThanOrEqual(20);
    });

    it("should respect maxRecordsPerFile in range strategy", async () => {
      const result = await CacheWarmer.warmCache({
        files: ["Spell.db2"],
        strategy: "range",
        rangeStart: 0,
        rangeEnd: 1000,
        maxRecordsPerFile: 50,
        verbose: false,
      });

      expect(result.success).toBe(true);
      expect(result.recordsPreloaded).toBeLessThanOrEqual(50);
    });
  });

  describe("getCacheRecommendations", () => {
    it("should return recommended warming configurations", () => {
      const recommendations = CacheWarmer.getCacheRecommendations();

      expect(recommendations).toBeInstanceOf(Array);
      expect(recommendations.length).toBeGreaterThan(0);

      // Check spell recommendation
      const spellRec = recommendations.find((r) => r.files.includes("Spell.db2"));
      expect(spellRec).toBeDefined();
      expect(spellRec?.strategy).toBe("list");
      expect(spellRec?.idList).toBeDefined();

      // Check item recommendation
      const itemRec = recommendations.find((r) => r.files.includes("Item.db2"));
      expect(itemRec).toBeDefined();
      expect(itemRec?.strategy).toBe("list");
      expect(itemRec?.idList).toBeDefined();
    });
  });

  describe("getCurrentCacheState", () => {
    it("should return global cache statistics", async () => {
      // Warm some caches first
      await CacheWarmer.warmSpellCache({ maxRecordsPerFile: 10 });

      const state = CacheWarmer.getCurrentCacheState();

      expect(state).toBeDefined();
      expect(state.totalFiles).toBeGreaterThanOrEqual(1);
      expect(state.totalMemoryMB).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Error Handling", () => {
    it("should handle missing files gracefully", async () => {
      const fs = require("fs");
      fs.existsSync.mockReturnValueOnce(false);

      const result = await CacheWarmer.warmCache({
        files: ["NonExistent.db2"],
        strategy: "list",
        idList: [1, 2, 3],
        verbose: true,
      });

      expect(result.success).toBe(true);
      expect(result.filesWarmed).toBe(0);
      expect(result.recordsPreloaded).toBe(0);
    });

    it("should handle empty ID list", async () => {
      const result = await CacheWarmer.warmCache({
        files: ["Spell.db2"],
        strategy: "list",
        idList: [],
        verbose: false,
      });

      expect(result.success).toBe(true);
      expect(result.recordsPreloaded).toBe(0);
    });
  });

  describe("Performance Metrics", () => {
    it("should track load time per file", async () => {
      const result = await CacheWarmer.warmSpellCache({ maxRecordsPerFile: 5 });

      expect(result.fileResults[0].loadTime).toBeGreaterThanOrEqual(0);
      expect(result.fileResults[0].recordsLoaded).toBe(5);
    });

    it("should track cache hit rate", async () => {
      const result = await CacheWarmer.warmSpellCache({ maxRecordsPerFile: 10 });

      expect(result.fileResults[0].cacheHitRate).toBeDefined();
      expect(result.fileResults[0].cacheHitRate).toMatch(/^\d+\.\d{2}%$/);
    });
  });

  describe("Verbose Logging", () => {
    it("should log when verbose is enabled", async () => {
      const consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});

      await CacheWarmer.warmSpellCache({
        verbose: true,
        maxRecordsPerFile: 5,
      });

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it("should not log when verbose is disabled", async () => {
      const consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});

      await CacheWarmer.warmSpellCache({
        verbose: false,
        maxRecordsPerFile: 5,
      });

      expect(consoleSpy).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });
});
