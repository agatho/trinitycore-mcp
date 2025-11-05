/**
 * VMap and MMap Parser Tests
 *
 * Unit tests for VMap and MMap binary parsers
 *
 * @jest-environment node
 */

import { describe, expect, it } from "@jest/globals";
import type { MMapParserOptions, VMapParserOptions } from "../../lib/mmap-types";
import {
  DT_NAVMESH_MAGIC,
  DT_NAVMESH_VERSION,
  MMAP_MAGIC,
  MMAP_VERSION,
} from "../../lib/mmap-types";
import { loadMMapData, parseMMapHeader, parseMMapTile } from "../../lib/mmap-parser";
import { NODE_MARKER, VMAP_MAGIC } from "../../lib/vmap-types";
import { loadVMapData, parseVMapTile, parseVMapTree } from "../../lib/vmap-parser";

// ============================================================================
// Mock Data Generators
// ============================================================================

/**
 * Create a mock .vmtree file buffer
 */
function createMockVMapTreeBuffer(): ArrayBuffer {
  const buffer = new ArrayBuffer(512);
  const view = new DataView(buffer);
  let offset = 0;

  // Write magic header (8 bytes)
  const magic = "VMAP_006";
  for (let i = 0; i < 8; i++) {
    view.setUint8(offset++, magic.charCodeAt(i));
  }

  // Write node marker (4 bytes)
  const nodeMarker = "NODE";
  for (let i = 0; i < 4; i++) {
    view.setUint8(offset++, nodeMarker.charCodeAt(i));
  }

  // Write BIH tree data
  // Bounds (6 floats)
  view.setFloat32(offset, -1000, true);
  offset += 4;
  view.setFloat32(offset, -1000, true);
  offset += 4;
  view.setFloat32(offset, -1000, true);
  offset += 4;
  view.setFloat32(offset, 1000, true);
  offset += 4;
  view.setFloat32(offset, 1000, true);
  offset += 4;
  view.setFloat32(offset, 1000, true);
  offset += 4;

  // Node count (uint32)
  view.setUint32(offset, 1, true);
  offset += 4;

  // Node data (1 node)
  view.setUint32(offset, 0, true);
  offset += 4; // child0
  view.setUint32(offset, 0, true);
  offset += 4; // child1
  view.setFloat32(offset, -500, true);
  offset += 4; // bound0
  view.setFloat32(offset, 500, true);
  offset += 4; // bound1
  view.setUint32(offset, 0, true);
  offset += 4; // axis (X)

  // Object count (uint32)
  view.setUint32(offset, 0, true);
  offset += 4;

  return buffer;
}

/**
 * Create a mock .vmtile file buffer
 */
function createMockVMapTileBuffer(): ArrayBuffer {
  const buffer = new ArrayBuffer(256);
  const view = new DataView(buffer);
  let offset = 0;

  // Write magic header (8 bytes)
  const magic = "VMAP_006";
  for (let i = 0; i < 8; i++) {
    view.setUint8(offset++, magic.charCodeAt(i));
  }

  // Write spawn count (uint32)
  view.setUint32(offset, 1, true);
  offset += 4;

  // Write 1 ModelSpawn
  // flags (uint32)
  view.setUint32(offset, 0, true);
  offset += 4;
  // id (uint32)
  view.setUint32(offset, 1, true);
  offset += 4;
  // name_length (uint32)
  const name = "test.wmo";
  view.setUint32(offset, name.length, true);
  offset += 4;
  // name (string)
  for (let i = 0; i < name.length; i++) {
    view.setUint8(offset++, name.charCodeAt(i));
  }
  // position (Vector3)
  view.setFloat32(offset, 100, true);
  offset += 4;
  view.setFloat32(offset, 200, true);
  offset += 4;
  view.setFloat32(offset, 50, true);
  offset += 4;
  // rotation (Vector3)
  view.setFloat32(offset, 0, true);
  offset += 4;
  view.setFloat32(offset, 0, true);
  offset += 4;
  view.setFloat32(offset, 1, true);
  offset += 4;
  // scale (float32)
  view.setFloat32(offset, 1.0, true);
  offset += 4;
  // bounds (AABox - 6 floats)
  view.setFloat32(offset, 90, true);
  offset += 4;
  view.setFloat32(offset, 190, true);
  offset += 4;
  view.setFloat32(offset, 40, true);
  offset += 4;
  view.setFloat32(offset, 110, true);
  offset += 4;
  view.setFloat32(offset, 210, true);
  offset += 4;
  view.setFloat32(offset, 60, true);
  offset += 4;

  return buffer;
}

/**
 * Create a mock .mmap file buffer
 */
function createMockMMapHeaderBuffer(): ArrayBuffer {
  const buffer = new ArrayBuffer(40);
  const view = new DataView(buffer);
  let offset = 0;

  // mmapMagic (uint32)
  view.setUint32(offset, MMAP_MAGIC, true);
  offset += 4;
  // mmapVersion (uint32)
  view.setUint32(offset, MMAP_VERSION, true);
  offset += 4;
  // dtNavMeshParams (32 bytes)
  // orig (3 floats)
  view.setFloat32(offset, 0, true);
  offset += 4;
  view.setFloat32(offset, 0, true);
  offset += 4;
  view.setFloat32(offset, 0, true);
  offset += 4;
  // tileWidth (float)
  view.setFloat32(offset, 533.33333, true);
  offset += 4;
  // tileHeight (float)
  view.setFloat32(offset, 533.33333, true);
  offset += 4;
  // maxTiles (int32)
  view.setInt32(offset, 2048, true);
  offset += 4;
  // maxPolys (int32)
  view.setInt32(offset, 1024, true);
  offset += 4;
  // offmeshConnectionCount (uint32)
  view.setUint32(offset, 0, true);
  offset += 4;

  return buffer;
}

/**
 * Create a mock .mmtile file buffer
 */
function createMockMMapTileBuffer(): ArrayBuffer {
  const buffer = new ArrayBuffer(512);
  const view = new DataView(buffer);
  let offset = 0;

  // MmapTileHeader (20 bytes)
  view.setUint32(offset, MMAP_MAGIC, true);
  offset += 4;
  view.setUint32(offset, DT_NAVMESH_VERSION, true);
  offset += 4;
  view.setUint32(offset, MMAP_VERSION, true);
  offset += 4;
  view.setUint32(offset, 400, true);
  offset += 4; // size
  view.setUint8(offset, 0);
  offset += 1; // usesLiquids
  view.setUint8(offset, 0);
  offset += 1; // padding[0]
  view.setUint8(offset, 0);
  offset += 1; // padding[1]
  view.setUint8(offset, 0);
  offset += 1; // padding[2]

  // dtMeshHeader
  view.setInt32(offset, DT_NAVMESH_MAGIC, true);
  offset += 4;
  view.setInt32(offset, DT_NAVMESH_VERSION, true);
  offset += 4;
  view.setInt32(offset, 0, true);
  offset += 4; // x
  view.setInt32(offset, 0, true);
  offset += 4; // y
  view.setInt32(offset, 0, true);
  offset += 4; // layer
  view.setUint32(offset, 0, true);
  offset += 4; // userId
  view.setInt32(offset, 2, true);
  offset += 4; // polyCount
  view.setInt32(offset, 6, true);
  offset += 4; // vertCount
  view.setInt32(offset, 0, true);
  offset += 4; // maxLinkCount
  view.setInt32(offset, 0, true);
  offset += 4; // detailMeshCount
  view.setInt32(offset, 0, true);
  offset += 4; // detailVertCount
  view.setInt32(offset, 0, true);
  offset += 4; // detailTriCount
  view.setInt32(offset, 0, true);
  offset += 4; // bvNodeCount
  view.setInt32(offset, 0, true);
  offset += 4; // offMeshConCount
  view.setInt32(offset, 0, true);
  offset += 4; // offMeshBase
  view.setFloat32(offset, 2.0, true);
  offset += 4; // walkableHeight
  view.setFloat32(offset, 0.6, true);
  offset += 4; // walkableRadius
  view.setFloat32(offset, 0.9, true);
  offset += 4; // walkableClimb
  // bmin (3 floats)
  view.setFloat32(offset, -100, true);
  offset += 4;
  view.setFloat32(offset, -100, true);
  offset += 4;
  view.setFloat32(offset, -10, true);
  offset += 4;
  // bmax (3 floats)
  view.setFloat32(offset, 100, true);
  offset += 4;
  view.setFloat32(offset, 100, true);
  offset += 4;
  view.setFloat32(offset, 10, true);
  offset += 4;
  view.setFloat32(offset, 0.1, true);
  offset += 4; // bvQuantFactor

  // Vertices (6 vertices * 3 floats)
  for (let i = 0; i < 6; i++) {
    view.setFloat32(offset, i * 10, true);
    offset += 4;
    view.setFloat32(offset, i * 10, true);
    offset += 4;
    view.setFloat32(offset, 0, true);
    offset += 4;
  }

  // Polygons (2 polygons)
  for (let i = 0; i < 2; i++) {
    // firstLink (uint32)
    view.setUint32(offset, 0, true);
    offset += 4;
    // verts (6 uint16)
    for (let j = 0; j < 6; j++) {
      view.setUint16(offset, j, true);
      offset += 2;
    }
    // neis (6 uint16)
    for (let j = 0; j < 6; j++) {
      view.setUint16(offset, 0, true);
      offset += 2;
    }
    // flags (uint16)
    view.setUint16(offset, 1, true);
    offset += 2;
    // vertCount (uint8)
    view.setUint8(offset, 3);
    offset += 1;
    // areaAndtype (uint8)
    view.setUint8(offset, 0);
    offset += 1;
  }

  return buffer;
}

// ============================================================================
// VMap Parser Tests
// ============================================================================

describe("VMap Parser", () => {
  describe("parseVMapTree", () => {
    it("should parse a valid .vmtree file", () => {
      const buffer = createMockVMapTreeBuffer();
      const result = parseVMapTree(buffer, 0);

      expect(result.magic).toBe(VMAP_MAGIC);
      expect(result.nodeMarker).toBe(NODE_MARKER);
      expect(result.mapId).toBe(0);
      expect(result.tree.nodes.length).toBe(1);
      expect(result.tree.bounds).toBeDefined();
    });

    it("should throw error on invalid magic", () => {
      const buffer = new ArrayBuffer(64);
      const view = new DataView(buffer);
      // Write invalid magic
      for (let i = 0; i < 8; i++) {
        view.setUint8(i, "INVALID!".charCodeAt(i));
      }

      expect(() => parseVMapTree(buffer, 0)).toThrow("Invalid magic header");
    });

    it("should respect verbose option", () => {
      const buffer = createMockVMapTreeBuffer();
      const options: VMapParserOptions = { verbose: true };

      const consoleSpy = jest.spyOn(console, "log").mockImplementation();
      parseVMapTree(buffer, 0, options);

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe("parseVMapTile", () => {
    it("should parse a valid .vmtile file", () => {
      const buffer = createMockVMapTileBuffer();
      const result = parseVMapTile(buffer, 31, 31);

      expect(result.magic).toBe(VMAP_MAGIC);
      expect(result.spawnCount).toBe(1);
      expect(result.spawns.length).toBe(1);
      expect(result.tileX).toBe(31);
      expect(result.tileY).toBe(31);

      const spawn = result.spawns[0];
      expect(spawn.name).toBe("test.wmo");
      expect(spawn.position.x).toBe(100);
      expect(spawn.position.y).toBe(200);
      expect(spawn.position.z).toBe(50);
      expect(spawn.scale).toBe(1.0);
    });

    it("should throw error on unreasonably large spawn count", () => {
      const buffer = new ArrayBuffer(64);
      const view = new DataView(buffer);

      // Write valid magic
      const magic = "VMAP_006";
      for (let i = 0; i < 8; i++) {
        view.setUint8(i, magic.charCodeAt(i));
      }
      // Write huge spawn count
      view.setUint32(8, 999999999, true);

      expect(() => parseVMapTile(buffer, 0, 0)).toThrow("Unreasonably large spawn count");
    });
  });

  describe("loadVMapData", () => {
    it("should load complete VMap data", () => {
      const treeBuffer = createMockVMapTreeBuffer();
      const tileBuffers = new Map<string, ArrayBuffer>();
      tileBuffers.set("31_31", createMockVMapTileBuffer());

      const result = loadVMapData(0, "Kalimdor", treeBuffer, tileBuffers);

      expect(result.mapId).toBe(0);
      expect(result.mapName).toBe("Kalimdor");
      expect(result.tiles.size).toBe(1);
      expect(result.allSpawns.length).toBe(1);
      expect(result.bounds).toBeDefined();
    });

    it("should respect maxTiles option", () => {
      const treeBuffer = createMockVMapTreeBuffer();
      const tileBuffers = new Map<string, ArrayBuffer>();
      for (let i = 0; i < 5; i++) {
        tileBuffers.set(`${i}_${i}`, createMockVMapTileBuffer());
      }

      const options: VMapParserOptions = { maxTiles: 2 };
      const result = loadVMapData(0, "TestMap", treeBuffer, tileBuffers, options);

      expect(result.tiles.size).toBe(2);
    });
  });
});

// ============================================================================
// MMap Parser Tests
// ============================================================================

describe("MMap Parser", () => {
  describe("parseMMapHeader", () => {
    it("should parse a valid .mmap file", () => {
      const buffer = createMockMMapHeaderBuffer();
      const result = parseMMapHeader(buffer, 0);

      expect(result.mmapMagic).toBe(MMAP_MAGIC);
      expect(result.mmapVersion).toBe(MMAP_VERSION);
      expect(result.params).toBeDefined();
      expect(result.params.maxTiles).toBe(2048);
      expect(result.params.maxPolys).toBe(1024);
      expect(result.offmeshConnectionCount).toBe(0);
    });

    it("should throw error on invalid magic", () => {
      const buffer = new ArrayBuffer(40);
      const view = new DataView(buffer);
      view.setUint32(0, 0x12345678, true); // Invalid magic

      expect(() => parseMMapHeader(buffer, 0)).toThrow("Invalid magic number");
    });

    it("should throw error on version mismatch", () => {
      const buffer = new ArrayBuffer(40);
      const view = new DataView(buffer);
      view.setUint32(0, MMAP_MAGIC, true);
      view.setUint32(4, 999, true); // Invalid version

      expect(() => parseMMapHeader(buffer, 0)).toThrow("Version mismatch");
    });
  });

  describe("parseMMapTile", () => {
    it("should parse a valid .mmtile file", () => {
      const buffer = createMockMMapTileBuffer();
      const result = parseMMapTile(buffer, 0, 0);

      expect(result.header).toBeDefined();
      expect(result.header.magic).toBe(DT_NAVMESH_MAGIC);
      expect(result.header.version).toBe(DT_NAVMESH_VERSION);
      expect(result.header.polyCount).toBe(2);
      expect(result.header.vertCount).toBe(6);
      expect(result.verts.length).toBe(6);
      expect(result.polys.length).toBe(2);
    });

    it("should handle loadDetailMeshes=false option", () => {
      const buffer = createMockMMapTileBuffer();
      const options: MMapParserOptions = { loadDetailMeshes: false };
      const result = parseMMapTile(buffer, 0, 0, options);

      expect(result.detailMeshes.length).toBe(0);
      expect(result.detailVerts.length).toBe(0);
      expect(result.detailTris.length).toBe(0);
    });

    it("should throw error on invalid tile size", () => {
      const buffer = new ArrayBuffer(64);
      const view = new DataView(buffer);

      // Write valid headers
      view.setUint32(0, MMAP_MAGIC, true);
      view.setUint32(4, DT_NAVMESH_VERSION, true);
      view.setUint32(8, MMAP_VERSION, true);
      view.setUint32(12, 99999, true); // Huge size

      expect(() => parseMMapTile(buffer, 0, 0)).toThrow("Invalid tile size");
    });
  });

  describe("loadMMapData", () => {
    it("should load complete MMap data", () => {
      const headerBuffer = createMockMMapHeaderBuffer();
      const tileBuffers = new Map<string, ArrayBuffer>();
      tileBuffers.set("0_0", createMockMMapTileBuffer());

      const result = loadMMapData(0, "Kalimdor", headerBuffer, tileBuffers);

      expect(result.mapId).toBe(0);
      expect(result.mapName).toBe("Kalimdor");
      expect(result.tiles.size).toBe(1);
      expect(result.offMeshConnections.length).toBe(0);
    });

    it("should respect maxTiles option", () => {
      const headerBuffer = createMockMMapHeaderBuffer();
      const tileBuffers = new Map<string, ArrayBuffer>();
      for (let i = 0; i < 10; i++) {
        tileBuffers.set(`${i}_${i}`, createMockMMapTileBuffer());
      }

      const options: MMapParserOptions = { maxTiles: 3 };
      const result = loadMMapData(0, "TestMap", headerBuffer, tileBuffers, options);

      expect(result.tiles.size).toBe(3);
    });
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe("Integration Tests", () => {
  it("should parse both VMap and MMap data for the same map", () => {
    // Create mock data
    const vmapTreeBuffer = createMockVMapTreeBuffer();
    const vmapTileBuffers = new Map<string, ArrayBuffer>();
    vmapTileBuffers.set("0_0", createMockVMapTileBuffer());

    const mmapHeaderBuffer = createMockMMapHeaderBuffer();
    const mmapTileBuffers = new Map<string, ArrayBuffer>();
    mmapTileBuffers.set("0_0", createMockMMapTileBuffer());

    // Parse VMap
    const vmapData = loadVMapData(0, "TestMap", vmapTreeBuffer, vmapTileBuffers);

    // Parse MMap
    const mmapData = loadMMapData(0, "TestMap", mmapHeaderBuffer, mmapTileBuffers);

    // Verify both parsed successfully
    expect(vmapData.mapId).toBe(0);
    expect(mmapData.mapId).toBe(0);
    expect(vmapData.tiles.size).toBe(1);
    expect(mmapData.tiles.size).toBe(1);
  });
});
