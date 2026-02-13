/**
 * Unit tests for JsonCacheLoader utility
 *
 * Tests the generic cache loading mechanism that eliminated 260+ lines
 * of duplicate boilerplate across spell.ts, item.ts, creature.ts, and
 * dungeonstrategygenerator.ts.
 */

import { JsonCacheLoader } from "../../src/utils/json-cache-loader";
import * as fs from "fs";

// Mock fs and logger
jest.mock("fs");
jest.mock("../../src/utils/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

const mockFs = fs as jest.Mocked<typeof fs>;

describe("JsonCacheLoader", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("constructor", () => {
    it("should create instance without loading", () => {
      const loader = new JsonCacheLoader<string>("test.json", "test");
      expect(loader.isLoaded).toBe(false);
      expect(mockFs.existsSync).not.toHaveBeenCalled();
    });
  });

  describe("load", () => {
    it("should load JSON file into Map", () => {
      const testData = { "1": "Fireball", "2": "Frostbolt", "133": "Heal" };
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(testData));

      const loader = new JsonCacheLoader<string>("spells.json", "spell");
      const result = loader.load();

      expect(result).toBe(true);
      expect(loader.isLoaded).toBe(true);
      expect(loader.size).toBe(3);
    });

    it("should return false when file does not exist", () => {
      mockFs.existsSync.mockReturnValue(false);

      const loader = new JsonCacheLoader<string>("missing.json", "test");
      const result = loader.load();

      expect(result).toBe(false);
      expect(loader.isLoaded).toBe(false);
    });

    it("should return false on parse error", () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue("not valid json{{{");

      const loader = new JsonCacheLoader<string>("bad.json", "test");
      const result = loader.load();

      expect(result).toBe(false);
      expect(loader.isLoaded).toBe(false);
    });

    it("should be idempotent (no-op on second call)", () => {
      const testData = { "1": "value" };
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(testData));

      const loader = new JsonCacheLoader<string>("test.json", "test");
      loader.load();
      loader.load();
      loader.load();

      // Only called once despite 3 load() calls
      expect(mockFs.readFileSync).toHaveBeenCalledTimes(1);
    });

    it("should handle empty JSON object", () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue("{}");

      const loader = new JsonCacheLoader<string>("empty.json", "test");
      const result = loader.load();

      expect(result).toBe(true);
      expect(loader.size).toBe(0);
    });

    it("should parse numeric keys correctly", () => {
      const testData = { "100": "A", "200": "B", "999999": "C" };
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(testData));

      const loader = new JsonCacheLoader<string>("test.json", "test");
      loader.load();

      expect(loader.get(100)).toBe("A");
      expect(loader.get(200)).toBe("B");
      expect(loader.get(999999)).toBe("C");
    });

    it("should handle complex object values", () => {
      interface TestEntry {
        name: string;
        level: number;
      }
      const testData = {
        "1": { name: "Hogger", level: 11 },
        "2": { name: "Defias Pillager", level: 15 },
      };
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(testData));

      const loader = new JsonCacheLoader<TestEntry>("creatures.json", "creature");
      loader.load();

      const entry = loader.get(1);
      expect(entry).toEqual({ name: "Hogger", level: 11 });
      expect(entry?.name).toBe("Hogger");
      expect(entry?.level).toBe(11);
    });
  });

  describe("get", () => {
    it("should lazy-load on first get()", () => {
      const testData = { "42": "Power Word: Shield" };
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(testData));

      const loader = new JsonCacheLoader<string>("test.json", "test");
      expect(loader.isLoaded).toBe(false);

      const result = loader.get(42);
      expect(result).toBe("Power Word: Shield");
      expect(loader.isLoaded).toBe(true);
    });

    it("should return null for missing keys", () => {
      const testData = { "1": "Fireball" };
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(testData));

      const loader = new JsonCacheLoader<string>("test.json", "test");
      expect(loader.get(999)).toBeNull();
    });

    it("should return null when cache failed to load", () => {
      mockFs.existsSync.mockReturnValue(false);

      const loader = new JsonCacheLoader<string>("missing.json", "test");
      expect(loader.get(1)).toBeNull();
    });
  });

  describe("getMap", () => {
    it("should return underlying Map", () => {
      const testData = { "1": "A", "2": "B" };
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(testData));

      const loader = new JsonCacheLoader<string>("test.json", "test");
      const map = loader.getMap();

      expect(map).toBeInstanceOf(Map);
      expect(map?.size).toBe(2);
      expect(map?.get(1)).toBe("A");
    });

    it("should return null when cache unavailable", () => {
      mockFs.existsSync.mockReturnValue(false);

      const loader = new JsonCacheLoader<string>("missing.json", "test");
      expect(loader.getMap()).toBeNull();
    });
  });

  describe("size", () => {
    it("should return entry count", () => {
      const testData = { "1": "A", "2": "B", "3": "C" };
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(testData));

      const loader = new JsonCacheLoader<string>("test.json", "test");
      expect(loader.size).toBe(3);
    });

    it("should return 0 when cache unavailable", () => {
      mockFs.existsSync.mockReturnValue(false);

      const loader = new JsonCacheLoader<string>("missing.json", "test");
      expect(loader.size).toBe(0);
    });
  });

  describe("reload", () => {
    it("should force reload from disk", () => {
      const testData1 = { "1": "Old" };
      const testData2 = { "1": "New", "2": "Added" };

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync
        .mockReturnValueOnce(JSON.stringify(testData1))
        .mockReturnValueOnce(JSON.stringify(testData2));

      const loader = new JsonCacheLoader<string>("test.json", "test");
      loader.load();
      expect(loader.get(1)).toBe("Old");
      expect(loader.size).toBe(1);

      loader.reload();
      expect(loader.get(1)).toBe("New");
      expect(loader.size).toBe(2);
      expect(mockFs.readFileSync).toHaveBeenCalledTimes(2);
    });

    it("should handle reload failure gracefully", () => {
      const testData = { "1": "value" };
      mockFs.existsSync.mockReturnValueOnce(true).mockReturnValueOnce(false);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(testData));

      const loader = new JsonCacheLoader<string>("test.json", "test");
      loader.load();
      expect(loader.size).toBe(1);

      const result = loader.reload();
      expect(result).toBe(false);
      expect(loader.size).toBe(0);
    });
  });
});
