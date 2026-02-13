/**
 * Unit tests for the VMap binary parser
 *
 * Tests parsing of .vmtile binary files and model spawn extraction.
 */

import { parseVMapTile, parseVMapTreeBounds } from "../../src/collision/vmap-parser";

// ============================================================================
// Test Helpers - Build VMap Binary Buffers
// ============================================================================

/**
 * Build a mock .vmtile buffer with the given spawns.
 */
function buildVMapTileBuffer(spawns: Array<{
  flags?: number;
  adtId?: number;
  id?: number;
  position?: { x: number; y: number; z: number };
  rotation?: { x: number; y: number; z: number };
  scale?: number;
  bounds?: { min: { x: number; y: number; z: number }; max: { x: number; y: number; z: number } };
  name?: string;
}>): Buffer {
  const parts: Buffer[] = [];

  // Magic header (8 bytes) - "VMAP_006"
  const magic = Buffer.from("VMAP_006", "utf-8");
  parts.push(magic);

  // Spawn count (uint32 LE)
  const countBuf = Buffer.alloc(4);
  countBuf.writeUInt32LE(spawns.length, 0);
  parts.push(countBuf);

  // Write each spawn
  for (const spawn of spawns) {
    const hasBounds = spawn.bounds !== undefined;
    const flags = hasBounds ? (spawn.flags ?? 0) | 0x01 : (spawn.flags ?? 0);
    const name = spawn.name ?? "test_model.wmo";

    // flags (uint8)
    const flagBuf = Buffer.alloc(1);
    flagBuf.writeUInt8(flags, 0);
    parts.push(flagBuf);

    // adtId (uint8)
    const adtBuf = Buffer.alloc(1);
    adtBuf.writeUInt8(spawn.adtId ?? 0, 0);
    parts.push(adtBuf);

    // id (uint32 LE)
    const idBuf = Buffer.alloc(4);
    idBuf.writeUInt32LE(spawn.id ?? 1, 0);
    parts.push(idBuf);

    // position (3 floats)
    const posBuf = Buffer.alloc(12);
    const pos = spawn.position ?? { x: 0, y: 0, z: 0 };
    posBuf.writeFloatLE(pos.x, 0);
    posBuf.writeFloatLE(pos.y, 4);
    posBuf.writeFloatLE(pos.z, 8);
    parts.push(posBuf);

    // rotation (3 floats)
    const rotBuf = Buffer.alloc(12);
    const rot = spawn.rotation ?? { x: 0, y: 0, z: 0 };
    rotBuf.writeFloatLE(rot.x, 0);
    rotBuf.writeFloatLE(rot.y, 4);
    rotBuf.writeFloatLE(rot.z, 8);
    parts.push(rotBuf);

    // scale (float)
    const scaleBuf = Buffer.alloc(4);
    scaleBuf.writeFloatLE(spawn.scale ?? 1.0, 0);
    parts.push(scaleBuf);

    // bounds (AABox: 6 floats) - only if MOD_HAS_BOUND
    if (hasBounds && spawn.bounds) {
      const boundsBuf = Buffer.alloc(24);
      boundsBuf.writeFloatLE(spawn.bounds.min.x, 0);
      boundsBuf.writeFloatLE(spawn.bounds.min.y, 4);
      boundsBuf.writeFloatLE(spawn.bounds.min.z, 8);
      boundsBuf.writeFloatLE(spawn.bounds.max.x, 12);
      boundsBuf.writeFloatLE(spawn.bounds.max.y, 16);
      boundsBuf.writeFloatLE(spawn.bounds.max.z, 20);
      parts.push(boundsBuf);
    }

    // nameLength (uint32 LE)
    const nameLenBuf = Buffer.alloc(4);
    nameLenBuf.writeUInt32LE(name.length, 0);
    parts.push(nameLenBuf);

    // name (raw bytes, not null-terminated)
    parts.push(Buffer.from(name, "utf-8"));
  }

  return Buffer.concat(parts);
}

/**
 * Build a minimal .vmtree buffer with bounds.
 */
function buildVMapTreeBuffer(bounds: {
  min: { x: number; y: number; z: number };
  max: { x: number; y: number; z: number };
}): Buffer {
  const parts: Buffer[] = [];

  // Magic header (8 bytes) - "VMAP_006"
  parts.push(Buffer.from("VMAP_006", "utf-8"));

  // Node marker (4 bytes) - "NODE"
  parts.push(Buffer.from("NODE", "utf-8"));

  // Bounds (AABox: 6 floats)
  const boundsBuf = Buffer.alloc(24);
  boundsBuf.writeFloatLE(bounds.min.x, 0);
  boundsBuf.writeFloatLE(bounds.min.y, 4);
  boundsBuf.writeFloatLE(bounds.min.z, 8);
  boundsBuf.writeFloatLE(bounds.max.x, 12);
  boundsBuf.writeFloatLE(bounds.max.y, 16);
  boundsBuf.writeFloatLE(bounds.max.z, 20);
  parts.push(boundsBuf);

  return Buffer.concat(parts);
}

// ============================================================================
// parseVMapTile Tests
// ============================================================================

describe("parseVMapTile", () => {
  describe("basic parsing", () => {
    it("should parse empty tile (0 spawns)", () => {
      const buffer = buildVMapTileBuffer([]);
      const tile = parseVMapTile(buffer, 32, 32);
      expect(tile.magic).toBe("VMAP_006");
      expect(tile.spawnCount).toBe(0);
      expect(tile.spawns).toHaveLength(0);
      expect(tile.tileX).toBe(32);
      expect(tile.tileY).toBe(32);
    });

    it("should parse tile with one spawn (no bounds)", () => {
      const buffer = buildVMapTileBuffer([{
        id: 42,
        name: "stormwind.wmo",
        position: { x: 100, y: 200, z: 300 },
      }]);
      const tile = parseVMapTile(buffer, 10, 20);
      expect(tile.spawnCount).toBe(1);
      expect(tile.spawns[0].id).toBe(42);
      expect(tile.spawns[0].name).toBe("stormwind.wmo");
      expect(tile.spawns[0].position.x).toBeCloseTo(100, 1);
      expect(tile.spawns[0].position.y).toBeCloseTo(200, 1);
      expect(tile.spawns[0].position.z).toBeCloseTo(300, 1);
    });

    it("should parse tile with spawn bounds", () => {
      const buffer = buildVMapTileBuffer([{
        id: 1,
        name: "building.wmo",
        position: { x: 0, y: 0, z: 0 },
        bounds: {
          min: { x: -10, y: -10, z: 0 },
          max: { x: 10, y: 10, z: 20 },
        },
      }]);
      const tile = parseVMapTile(buffer, 0, 0);
      expect(tile.spawns[0].bounds.min.x).toBeCloseTo(-10, 1);
      expect(tile.spawns[0].bounds.max.z).toBeCloseTo(20, 1);
    });

    it("should parse tile with multiple spawns", () => {
      const buffer = buildVMapTileBuffer([
        { id: 1, name: "a.wmo", position: { x: 0, y: 0, z: 0 }, bounds: { min: { x: -1, y: -1, z: -1 }, max: { x: 1, y: 1, z: 1 } } },
        { id: 2, name: "b.wmo", position: { x: 10, y: 10, z: 10 }, bounds: { min: { x: 9, y: 9, z: 9 }, max: { x: 11, y: 11, z: 11 } } },
        { id: 3, name: "c.wmo", position: { x: 20, y: 20, z: 20 } },
      ]);
      const tile = parseVMapTile(buffer, 0, 0);
      expect(tile.spawnCount).toBe(3);
      expect(tile.spawns[0].name).toBe("a.wmo");
      expect(tile.spawns[1].name).toBe("b.wmo");
      expect(tile.spawns[2].name).toBe("c.wmo");
    });
  });

  describe("spawn fields", () => {
    it("should read scale correctly", () => {
      const buffer = buildVMapTileBuffer([{
        id: 1, name: "test.wmo", scale: 2.5,
        position: { x: 0, y: 0, z: 0 },
      }]);
      const tile = parseVMapTile(buffer, 0, 0);
      expect(tile.spawns[0].scale).toBeCloseTo(2.5, 2);
    });

    it("should read rotation correctly", () => {
      const buffer = buildVMapTileBuffer([{
        id: 1, name: "test.wmo",
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 1.5, y: 2.5, z: 3.5 },
      }]);
      const tile = parseVMapTile(buffer, 0, 0);
      expect(tile.spawns[0].rotation.x).toBeCloseTo(1.5, 2);
      expect(tile.spawns[0].rotation.y).toBeCloseTo(2.5, 2);
      expect(tile.spawns[0].rotation.z).toBeCloseTo(3.5, 2);
    });

    it("should read adtId correctly", () => {
      const buffer = buildVMapTileBuffer([{
        id: 1, name: "test.wmo", adtId: 42,
        position: { x: 0, y: 0, z: 0 },
      }]);
      const tile = parseVMapTile(buffer, 0, 0);
      expect(tile.spawns[0].adtId).toBe(42);
    });
  });

  describe("error handling", () => {
    it("should reject invalid magic header", () => {
      const buffer = Buffer.from("INVALID_MAGIC");
      expect(() => parseVMapTile(buffer, 0, 0)).toThrow("Unsupported VMAP version");
    });

    it("should reject unreasonable spawn count", () => {
      const parts: Buffer[] = [];
      parts.push(Buffer.from("VMAP_006", "utf-8"));
      const countBuf = Buffer.alloc(4);
      countBuf.writeUInt32LE(200000, 0);
      parts.push(countBuf);
      const buffer = Buffer.concat(parts);

      expect(() => parseVMapTile(buffer, 0, 0)).toThrow("Unreasonable spawn count");
    });
  });
});

// ============================================================================
// parseVMapTreeBounds Tests
// ============================================================================

describe("parseVMapTreeBounds", () => {
  it("should parse tree bounds correctly", () => {
    const buffer = buildVMapTreeBuffer({
      min: { x: -17066, y: -17066, z: -500 },
      max: { x: 17066, y: 17066, z: 500 },
    });
    const bounds = parseVMapTreeBounds(buffer);
    expect(bounds.min.x).toBeCloseTo(-17066, 0);
    expect(bounds.max.x).toBeCloseTo(17066, 0);
    expect(bounds.min.z).toBeCloseTo(-500, 0);
    expect(bounds.max.z).toBeCloseTo(500, 0);
  });

  it("should reject invalid magic in vmtree", () => {
    const buffer = Buffer.from("BAD_HEAD");
    expect(() => parseVMapTreeBounds(buffer)).toThrow("Unsupported VMAP version");
  });

  it("should reject invalid node marker", () => {
    const parts: Buffer[] = [];
    parts.push(Buffer.from("VMAP_006", "utf-8"));
    parts.push(Buffer.from("NOPE", "utf-8"));
    parts.push(Buffer.alloc(24)); // dummy bounds
    const buffer = Buffer.concat(parts);
    expect(() => parseVMapTreeBounds(buffer)).toThrow("Invalid node marker");
  });
});
