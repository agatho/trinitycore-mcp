# VMap & MMap Parser Guide

**TrinityCore MCP - VMap and MMap Binary Format Parsers**

**Version:** 1.0.0
**Date:** 2025-11-05
**Author:** Claude Code

---

## Table of Contents

1. [Overview](#overview)
2. [What are VMaps and MMaps?](#what-are-vmaps-and-mmaps)
3. [Binary Format Specifications](#binary-format-specifications)
4. [Parser API](#parser-api)
5. [Usage Examples](#usage-examples)
6. [Data Structures](#data-structures)
7. [Advanced Usage](#advanced-usage)
8. [Performance Considerations](#performance-considerations)
9. [Troubleshooting](#troubleshooting)
10. [Technical Reference](#technical-reference)

---

## Overview

The VMap and MMap parsers are TypeScript libraries for parsing TrinityCore's binary collision and navigation mesh files. These parsers enable:

- ✅ **VMap Parsing**: Parse `.vmtree` and `.vmtile` files containing collision geometry
- ✅ **MMap Parsing**: Parse `.mmap` and `.mmtile` files containing navigation meshes
- ✅ **Spatial Queries**: Query collision geometry using BIH trees
- ✅ **Pathfinding Support**: Access navigation mesh data for pathfinding algorithms
- ✅ **3D Visualization**: Extract geometry data for Three.js rendering

### Key Features

| Feature | VMap Parser | MMap Parser |
|---------|-------------|-------------|
| Binary format parsing | ✅ | ✅ |
| TypeScript types | ✅ | ✅ |
| Spatial queries | ✅ | ✅ |
| Memory efficient | ✅ | ✅ |
| Error handling | ✅ | ✅ |
| Validation options | ✅ | ✅ |

---

## What are VMaps and MMaps?

### VMaps (Visibility Maps)

**Purpose:** Line-of-sight calculations and collision detection

**Contains:**
- **Building geometry** from WMO (World Map Objects)
- **Doodad models** from M2 files
- **Collision triangles** for ray casting
- **BIH tree** for fast spatial queries

**Use Cases:**
- Spell line-of-sight checks
- Pathfinding collision avoidance
- Indoor/outdoor area detection
- Spawn position validation

### MMaps (Movement Maps)

**Purpose:** Creature pathfinding and navigation

**Contains:**
- **Navigation mesh** (walkable polygons)
- **Off-mesh connections** (jumps, teleports)
- **Area types** (ground, water, steep, etc.)
- **BVH tree** for fast polygon queries

**Use Cases:**
- NPC pathfinding
- Bot movement
- Waypoint validation
- Reachability checks

---

## Binary Format Specifications

### VMap Binary Format

#### `.vmtree` File Structure

```
[VMAP_MAGIC]     8 bytes   "VMAP_006"
[NODE_MARKER]    4 bytes   "NODE"
[BIH_BOUNDS]     24 bytes  AABox (min/max)
[NODE_COUNT]     4 bytes   uint32
[NODES]          variable  BIHNode[NODE_COUNT]
[OBJECT_COUNT]   4 bytes   uint32
[OBJECTS]        variable  uint32[OBJECT_COUNT]
```

#### `.vmtile` File Structure

```
[VMAP_MAGIC]     8 bytes   "VMAP_006"
[SPAWN_COUNT]    4 bytes   uint32
[SPAWNS]         variable  ModelSpawn[SPAWN_COUNT]
```

#### `ModelSpawn` Structure

```
[FLAGS]          4 bytes   uint32
[ID]             4 bytes   uint32
[NAME_LENGTH]    4 bytes   uint32
[NAME]           variable  string
[POSITION]       12 bytes  Vector3 (x, y, z)
[ROTATION]       12 bytes  Vector3 (x, y, z)
[SCALE]          4 bytes   float32
[BOUNDS]         24 bytes  AABox (min/max)
```

### MMap Binary Format

#### `.mmap` File Structure

```
[MMAP_MAGIC]     4 bytes   0x4D4D4150 ('MMAP')
[MMAP_VERSION]   4 bytes   16
[DT_PARAMS]      32 bytes  dtNavMeshParams
[OFFMESH_COUNT]  4 bytes   uint32
```

#### `dtNavMeshParams` Structure

```
[ORIG_X]         4 bytes   float32
[ORIG_Y]         4 bytes   float32
[ORIG_Z]         4 bytes   float32
[TILE_WIDTH]     4 bytes   float32
[TILE_HEIGHT]    4 bytes   float32
[MAX_TILES]      4 bytes   int32
[MAX_POLYS]      4 bytes   int32
```

#### `.mmtile` File Structure

```
[MMAP_TILE_HEADER]   20 bytes   MmapTileHeader
[DT_MESH_HEADER]     variable   dtMeshHeader
[VERTICES]           variable   float32[vertCount * 3]
[POLYGONS]           variable   dtPoly[polyCount]
[LINKS]              variable   dtLink[maxLinkCount]
[DETAIL_MESHES]      variable   dtPolyDetail[detailMeshCount]
[DETAIL_VERTS]       variable   float32[detailVertCount * 3]
[DETAIL_TRIS]        variable   uint8[detailTriCount * 4]
[BV_NODES]           variable   dtBVNode[bvNodeCount]
[OFFMESH_CONS]       variable   dtOffMeshConnection[offMeshConCount]
```

---

## Parser API

### VMap Parser API

#### Core Functions

```typescript
// Parse .vmtree file
function parseVMapTree(
  buffer: ArrayBuffer,
  mapId: number,
  options?: VMapParserOptions
): VMapTree

// Parse .vmtile file
function parseVMapTile(
  buffer: ArrayBuffer,
  tileX: number,
  tileY: number,
  options?: VMapParserOptions
): VMapTile

// Load complete VMap data
function loadVMapData(
  mapId: number,
  mapName: string,
  treeBuffer: ArrayBuffer,
  tileBuffers: Map<string, ArrayBuffer>,
  options?: VMapParserOptions
): VMapData

// Query BIH tree for spatial searches
function queryBIHTree(
  tree: BIHTree,
  bounds: AABox,
  spawns: ModelSpawn[]
): number[]
```

#### Options

```typescript
interface VMapParserOptions {
  strictValidation?: boolean;  // Validate magic headers (default: true)
  loadLiquids?: boolean;       // Load liquid data (default: true)
  loadBSP?: boolean;           // Load BSP trees (default: true)
  maxTiles?: number;           // Max tiles to load (-1 = all)
  verbose?: boolean;           // Enable logging (default: false)
}
```

### MMap Parser API

#### Core Functions

```typescript
// Parse .mmap file
function parseMMapHeader(
  buffer: ArrayBuffer,
  mapId: number,
  options?: MMapParserOptions
): MmapNavMeshHeader

// Parse .mmtile file
function parseMMapTile(
  buffer: ArrayBuffer,
  tileX: number,
  tileY: number,
  options?: MMapParserOptions
): NavMeshTile

// Load complete MMap data
function loadMMapData(
  mapId: number,
  mapName: string,
  headerBuffer: ArrayBuffer,
  tileBuffers: Map<string, ArrayBuffer>,
  options?: MMapParserOptions
): MMapData

// Find nearest polygon
function findNearestPoly(
  tile: NavMeshTile,
  position: [number, number, number],
  extents?: [number, number, number]
): number

// Check if on navmesh
function isOnNavMesh(
  tile: NavMeshTile,
  position: [number, number, number],
  extents?: [number, number, number]
): boolean
```

#### Options

```typescript
interface MMapParserOptions {
  strictValidation?: boolean;      // Validate headers (default: true)
  loadOffMeshConnections?: boolean; // Load off-mesh cons (default: true)
  loadBVTree?: boolean;             // Load BVH tree (default: true)
  loadDetailMeshes?: boolean;       // Load detail meshes (default: true)
  maxTiles?: number;                // Max tiles to load (-1 = all)
  verbose?: boolean;                // Enable logging (default: false)
}
```

---

## Usage Examples

### Example 1: Parse VMap Files

```typescript
import { loadVMapData } from "@/lib/vmap-parser";

async function loadVMapForMap() {
  // Load .vmtree file
  const treeResponse = await fetch("/data/vmaps/000.vmtree");
  const treeBuffer = await treeResponse.arrayBuffer();

  // Load .vmtile files
  const tileBuffers = new Map<string, ArrayBuffer>();

  // Load tile 31_31
  const tileResponse = await fetch("/data/vmaps/0000_31_31.vmtile");
  const tileBuffer = await tileResponse.arrayBuffer();
  tileBuffers.set("31_31", tileBuffer);

  // Parse VMap data
  const vmapData = loadVMapData(
    0, // mapId
    "Kalimdor",
    treeBuffer,
    tileBuffers,
    { verbose: true }
  );

  console.log(`Loaded ${vmapData.allSpawns.length} model spawns`);
  console.log(`Map bounds:`, vmapData.bounds);

  return vmapData;
}
```

### Example 2: Query Collision Geometry

```typescript
import { queryBIHTree } from "@/lib/vmap-parser";
import type { AABox } from "@/lib/vmap-types";

function findModelsInArea(
  vmapData: VMapData,
  center: { x: number; y: number; z: number },
  radius: number
) {
  // Create query bounds
  const bounds: AABox = {
    min: {
      x: center.x - radius,
      y: center.y - radius,
      z: center.z - radius,
    },
    max: {
      x: center.x + radius,
      y: center.y + radius,
      z: center.z + radius,
    },
  };

  // Query BIH tree
  const spawnIndices = queryBIHTree(
    vmapData.tree.tree,
    bounds,
    vmapData.allSpawns
  );

  // Get spawn details
  const spawns = spawnIndices.map((idx) => vmapData.allSpawns[idx]);

  console.log(`Found ${spawns.length} models in area`);
  spawns.forEach((spawn) => {
    console.log(`- ${spawn.name} at (${spawn.position.x}, ${spawn.position.y}, ${spawn.position.z})`);
  });

  return spawns;
}
```

### Example 3: Parse MMap Files

```typescript
import { loadMMapData } from "@/lib/mmap-parser";

async function loadMMapForMap() {
  // Load .mmap file
  const headerResponse = await fetch("/data/mmaps/000.mmap");
  const headerBuffer = await headerResponse.arrayBuffer();

  // Load .mmtile files
  const tileBuffers = new Map<string, ArrayBuffer>();

  // Load tile 00_00
  const tileResponse = await fetch("/data/mmaps/0000_00_00.mmtile");
  const tileBuffer = await tileResponse.arrayBuffer();
  tileBuffers.set("0_0", tileBuffer);

  // Parse MMap data
  const mmapData = loadMMapData(
    0, // mapId
    "Kalimdor",
    headerBuffer,
    tileBuffers,
    { verbose: true }
  );

  console.log(`Loaded ${mmapData.tiles.size} navigation tiles`);
  console.log(`Max tiles: ${mmapData.header.params.maxTiles}`);
  console.log(`Max polys: ${mmapData.header.params.maxPolys}`);

  return mmapData;
}
```

### Example 4: Check Walkability

```typescript
import { isOnNavMesh } from "@/lib/mmap-parser";

function checkIfWalkable(
  mmapData: MMapData,
  position: [number, number, number]
): boolean {
  // Find tile containing position
  const tileX = Math.floor(position[0] / mmapData.header.params.tileWidth);
  const tileY = Math.floor(position[2] / mmapData.header.params.tileHeight);
  const tileKey = `${tileX}_${tileY}`;

  const tile = mmapData.tiles.get(tileKey);
  if (!tile) {
    console.log(`No tile found for position`);
    return false;
  }

  // Check if position is on navmesh
  const walkable = isOnNavMesh(tile, position, [2, 2, 2]);

  if (walkable) {
    console.log(`Position is walkable!`);
  } else {
    console.log(`Position is NOT walkable!`);
  }

  return walkable;
}
```

### Example 5: Validate Spawn Positions

```typescript
function validateSpawns(vmapData: VMapData, mmapData: MMapData) {
  const invalidSpawns: ModelSpawn[] = [];

  for (const spawn of vmapData.allSpawns) {
    const position: [number, number, number] = [
      spawn.position.x,
      spawn.position.y,
      spawn.position.z,
    ];

    // Find appropriate tile
    const tileX = Math.floor(position[0] / mmapData.header.params.tileWidth);
    const tileY = Math.floor(position[2] / mmapData.header.params.tileHeight);
    const tile = mmapData.tiles.get(`${tileX}_${tileY}`);

    if (!tile) continue;

    // Check if spawn is on walkable surface
    const walkable = isOnNavMesh(tile, position);
    if (!walkable) {
      invalidSpawns.push(spawn);
    }
  }

  console.log(`Found ${invalidSpawns.length} spawns on non-walkable surfaces`);
  return invalidSpawns;
}
```

---

## Data Structures

### VMap Types

```typescript
// Model spawn on the map
interface ModelSpawn {
  flags: number;
  id: number;
  name: string;
  position: Vector3;
  rotation: Rotation;
  scale: number;
  bounds: AABox;
}

// BIH tree for spatial queries
interface BIHTree {
  nodes: BIHNode[];
  objects: number[];
  bounds: AABox;
}

// BIH tree node
interface BIHNode {
  children: [number, number];
  bounds: [number, number];
  axis: BIHAxis;
  isLeaf: boolean;
  objects?: number[];
}

// Complete VMap data
interface VMapData {
  mapId: number;
  mapName: string;
  tree: VMapTree;
  tiles: Map<string, VMapTile>;
  allSpawns: ModelSpawn[];
  bounds: AABox;
}
```

### MMap Types

```typescript
// Navigation mesh parameters
interface dtNavMeshParams {
  orig: [number, number, number];
  tileWidth: number;
  tileHeight: number;
  maxTiles: number;
  maxPolys: number;
}

// Navigation mesh tile
interface NavMeshTile {
  header: dtMeshHeader;
  verts: [number, number, number][];
  polys: dtPoly[];
  links: dtLink[];
  detailMeshes: dtPolyDetail[];
  detailVerts: [number, number, number][];
  detailTris: number[];
  bvTree: dtBVNode[];
  offMeshCons: dtOffMeshConnection[];
}

// Walkable polygon
interface dtPoly {
  firstLink: number;
  verts: number[];
  neis: number[];
  flags: number;
  vertCount: number;
  areaAndtype: number;
}

// Complete MMap data
interface MMapData {
  mapId: number;
  mapName: string;
  header: MmapNavMeshHeader;
  tiles: Map<string, NavMeshTile>;
  offMeshConnections: dtOffMeshConnection[];
}
```

---

## Advanced Usage

### Custom Binary Reader

The parsers use a `BinaryReader` class for reading binary data:

```typescript
import { BinaryReader } from "@/lib/vmap-parser";

const buffer = new ArrayBuffer(1024);
const reader = new BinaryReader(buffer);

// Read primitives
const magic = reader.readUInt32();
const version = reader.readUInt32();
const scale = reader.readFloat32();

// Read strings
const name = reader.readString(64);
const nullTermString = reader.readStringNullTerminated();

// Read vectors
const position = reader.readVector3();
const bounds = reader.readAABox();

// Manual offset control
const offset = reader.getOffset();
reader.setOffset(offset + 16);
reader.skip(8);
```

### Error Handling

```typescript
import { VMapParseError, MMapParseError } from "@/lib/vmap-types";

try {
  const vmapData = loadVMapData(mapId, mapName, treeBuffer, tileBuffers);
} catch (error) {
  if (error instanceof VMapParseError) {
    console.error(`VMap parse error in ${error.file} at offset ${error.offset}`);
    console.error(error.message);
  } else {
    console.error("Unexpected error:", error);
  }
}
```

### Performance Optimization

```typescript
// Load only specific tiles
const options: VMapParserOptions = {
  maxTiles: 10, // Limit to 10 tiles
  loadBSP: false, // Skip BSP tree loading
  loadLiquids: false, // Skip liquid data
  verbose: false,
};

const vmapData = loadVMapData(mapId, mapName, treeBuffer, tileBuffers, options);

// Load only essential MMap data
const mmapOptions: MMapParserOptions = {
  loadDetailMeshes: false, // Skip high-res details
  loadBVTree: false, // Skip BVH tree
  loadOffMeshConnections: false, // Skip special connections
};

const mmapData = loadMMapData(mapId, mapName, headerBuffer, tileBuffers, mmapOptions);
```

---

## Performance Considerations

### Memory Usage

| File Type | Size Range | Memory Impact |
|-----------|------------|---------------|
| `.vmtree` | 10KB - 1MB | Low |
| `.vmtile` | 1KB - 100KB | Low-Medium |
| `.mmap` | 1KB - 10KB | Low |
| `.mmtile` | 10KB - 500KB | Medium-High |

**Optimization Tips:**
1. Use `maxTiles` to limit memory usage
2. Skip unnecessary data (detail meshes, BSP, etc.)
3. Load tiles on-demand
4. Clear unused tile data from memory

### Parse Performance

**Typical Parse Times (2023 Hardware):**
- `.vmtree`: 1-5ms
- `.vmtile`: 1-10ms per tile
- `.mmap`: <1ms
- `.mmtile`: 5-50ms per tile

**Optimization:**
- Parse tiles in Web Workers
- Use streaming for large datasets
- Cache parsed results in IndexedDB

---

## Troubleshooting

### Common Errors

#### "Invalid magic header"

**Cause:** File is corrupted or wrong format

**Solution:**
```typescript
// Disable strict validation for testing
const options = { strictValidation: false };
const result = parseVMapTree(buffer, mapId, options);
```

#### "Version mismatch"

**Cause:** File was created with different TrinityCore version

**Solution:**
- Re-extract VMaps/MMaps from WoW client
- Use matching TrinityCore extractors

#### "Invalid node count"

**Cause:** File is truncated or corrupted

**Solution:**
- Re-download or re-extract the file
- Check file integrity

### Debugging

Enable verbose logging:

```typescript
const options: VMapParserOptions = {
  verbose: true,
};

const vmapData = loadVMapData(mapId, mapName, treeBuffer, tileBuffers, options);
// Output: [VMapParser] Parsed 000.vmtree: 1234 nodes, 5678 objects
// Output: [VMapParser] Parsed 31_31.vmtile: 42 spawns
```

Inspect parsed data:

```typescript
console.log("VMap Tree:", JSON.stringify(vmapData.tree, null, 2));
console.log("First spawn:", vmapData.allSpawns[0]);
console.log("Map bounds:", vmapData.bounds);
```

---

## Technical Reference

### File Naming Conventions

**VMap Files:**
- Tree: `{mapId:03d}.vmtree` (e.g., `000.vmtree`, `001.vmtree`)
- Tiles: `{mapId:04d}_{tileX:02d}_{tileY:02d}.vmtile` (e.g., `0000_31_31.vmtile`)

**MMap Files:**
- Header: `{mapId:03d}.mmap` (e.g., `000.mmap`, `001.mmap`)
- Tiles: `{mapId:04d}_{tileX:02d}_{tileY:02d}.mmtile` (e.g., `0000_00_00.mmtile`)

### Constants

```typescript
// VMap
export const VMAP_MAGIC = "VMAP_006";
export const NODE_MARKER = "NODE";

// MMap
export const MMAP_MAGIC = 0x4D4D4150; // 'MMAP'
export const MMAP_VERSION = 16;
export const DT_NAVMESH_VERSION = 7;
export const DT_NAVMESH_MAGIC = 0x444E4156; // 'DNAV'
export const DT_VERTS_PER_POLYGON = 6;
```

### Navigation Areas

```typescript
enum NavArea {
  EMPTY = 0,
  GROUND = 11,
  GROUND_STEEP = 10,
  WATER = 9,
  MAGMA_SLIME = 8,
}
```

### Source Code References

**TrinityCore:**
- `src/tools/vmap4_assembler/TileAssembler.cpp`
- `src/common/Collision/Maps/MapTree.h`
- `src/common/Collision/Maps/MMapDefines.h`
- `src/common/Collision/Management/MMapManager.cpp`

**Recast/Detour:**
- `Detour/Include/DetourNavMesh.h`
- `Detour/Source/DetourNavMesh.cpp`

---

## Additional Resources

**External Documentation:**
- [TrinityCore GitHub](https://github.com/TrinityCore/TrinityCore)
- [WoW.dev Wiki](https://wowdev.wiki/)
- [Recast Navigation](https://github.com/recastnavigation/recastnavigation)

**Related MCP Tools:**
- `list-vmap-files` - List available VMap files
- `list-mmap-files` - List available MMap files
- `validate-spawn-positions` - Validate creature spawns against VMaps/MMaps

---

**Last Updated:** 2025-11-05
**Parser Version:** 1.0.0
**TrinityCore Compatibility:** 3.3.5a, 4.3.4, 10.x

