# VMap/MMap Limitations Documentation

## Overview

This document describes the current limitations of VMap (Visibility Map) and MMap (Movement Map) functionality in the TrinityCore MCP Server, as implemented in Phase 1.4 of the development plan.

**Status**: ⚠️ **Basic Implementation with Known Limitations**

---

## Background

VMap and MMap are binary data files used by TrinityCore for:
- **VMap**: Line-of-sight calculations, collision detection, and spatial queries
- **MMap**: Navigation mesh data for pathfinding (A* algorithm)

Full implementation requires:
1. Binary data format parsing (`.vmtree`, `.vmap`, `.mmap` files)
2. Octree/quadtree data structures for spatial queries
3. A* pathfinding algorithm implementation
4. Integration with TrinityCore's coordinate system

---

## Current Implementation

### VMap Tools (`src/tools/vmap-tools.ts`)

#### ✅ **Implemented:**
- Tool registration with MCP server
- Input validation (coordinates, map IDs, radius)
- Error handling with proper error types
- Placeholder functions with clear documentation

#### ⚠️ **Limited/Placeholder:**

**1. Line-of-Sight Check (`checkLineOfSight`)**
- **Location**: `src/tools/vmap-tools.ts:262`
- **Status**: Placeholder implementation
- **Current Behavior**: Returns `{visible: false, blocked: true, blockingObject: "VMap data not loaded"}`
- **TODO**: `// TODO: Load VMap data and perform actual raycast`
- **Required**: Binary `.vmap` file parsing, raycast algorithm

**2. Spatial Query (`querySpatialObjects`)**
- **Location**: `src/tools/vmap-tools.ts:296`
- **Status**: Placeholder implementation
- **Current Behavior**: Returns empty array `{objects: [], count: 0}`
- **TODO**: `// TODO: Load VMap data and perform spatial query`
- **Required**: Octree data structure, spatial indexing

---

### MMap Tools (`src/tools/mmap-tools.ts`)

#### ✅ **Implemented:**
- Tool registration with MCP server
- Input validation (coordinates, map IDs)
- Error handling with proper error types
- Placeholder functions with clear documentation

#### ⚠️ **Limited/Placeholder:**

**1. Find Path (`findPath`)**
- **Location**: `src/tools/mmap-tools.ts:272`
- **Status**: Placeholder implementation
- **Current Behavior**: Returns straight-line path between start and end
- **TODO**: `// TODO: Load MMap data and perform actual A* pathfinding`
- **Required**: Binary `.mmap` file parsing, A* algorithm, navmesh traversal

**2. Check Reachability (`checkReachability`)**
- **Location**: `src/tools/mmap-tools.ts:308`
- **Status**: Placeholder implementation
- **Current Behavior**: Returns `{reachable: true}` always
- **TODO**: `// TODO: Load MMap data and perform navmesh query`
- **Required**: Navmesh polygon queries, reachability checks

---

## Technical Requirements for Full Implementation

### 1. Binary File Parsing

**VMap Files:**
- `.vmtree` - Octree structure for spatial partitioning
- `.vmap` - Geometry data (vertices, triangles, normals)
- Format: Custom TrinityCore binary format

**MMap Files:**
- `.mmap` - Navigation mesh tiles
- Format: Recast/Detour binary format
- Contains: Polygon meshes, off-mesh connections, areas

**Challenges:**
- No official format documentation
- Requires reverse engineering or TrinityCore source analysis
- Binary formats are platform-dependent (endianness, padding)

### 2. Data Structures

**VMap Requirements:**
- Octree for spatial partitioning
- AABB (Axis-Aligned Bounding Box) trees
- Triangle mesh storage
- Material properties

**MMap Requirements:**
- Navmesh polygon representation
- Tile-based structure (256x256 tiles)
- Off-mesh connections
- Area flags (water, ground, etc.)

### 3. Algorithms

**VMap Algorithms:**
- Ray-triangle intersection (Möller–Trumbore algorithm)
- Octree traversal
- Spatial query optimization

**MMap Algorithms:**
- A* pathfinding
- Navmesh polygon queries
- Funnel algorithm for path smoothing
- Dynamic obstacle avoidance

### 4. Integration Requirements

**Coordinate System:**
- TrinityCore uses different coordinate systems per expansion
- Map-specific transformations needed
- Height map integration

**Performance:**
- Binary data can be 100MB+ per map
- Caching strategy required
- Lazy loading by tile/region

---

## Workarounds and Alternatives

### For Development/Testing:

**1. Database-Based Approximations:**
```sql
-- Check if position is indoors (approximation)
SELECT * FROM areatrigger WHERE map_id = ?
  AND x BETWEEN ? AND ?
  AND y BETWEEN ? AND ?;
```

**2. Spawn Point Validation:**
- Use existing creature spawn points as valid positions
- Query `creature` table for known-good coordinates

**3. Simple Distance Checks:**
- Euclidean distance for basic reachability
- Ignores terrain/obstacles but provides rough estimate

**4. External Service Integration:**
```typescript
// Example: Call TrinityCore SOAP for pathfinding
import { executeSOAPCommand } from '../soap/soap-client.js';

async function findPathViaSOAP(start, end) {
  const result = await executeSOAPCommand(config,
    `.path ${start.x} ${start.y} ${start.z} ${end.x} ${end.y} ${end.z}`
  );
  return parsePathResult(result.output);
}
```

---

## Development Roadmap

### Phase 1 (Current - Beta Release):
- ✅ Basic tool structure
- ✅ Input validation
- ✅ Error handling
- ✅ Documentation
- ⚠️ Placeholder implementations

### Phase 2 (Post-Beta):
- [ ] Research TrinityCore VMap/MMap formats
- [ ] Implement binary file readers
- [ ] Build basic spatial data structures

### Phase 3 (Future):
- [ ] Implement full raycast algorithm
- [ ] Implement A* pathfinding
- [ ] Add caching layer
- [ ] Performance optimization

### Phase 4 (Advanced):
- [ ] Dynamic obstacle detection
- [ ] Real-time navmesh updates
- [ ] Multi-map support
- [ ] Height map integration

---

## Code Locations

### VMap Implementation:
```
src/tools/vmap-tools.ts:262  - Line of sight TODO
src/tools/vmap-tools.ts:296  - Spatial query TODO
```

### MMap Implementation:
```
src/tools/mmap-tools.ts:272  - Pathfinding TODO
src/tools/mmap-tools.ts:308  - Reachability TODO
```

### Related Files:
```
src/types/vmap.ts           - Type definitions
src/types/mmap.ts           - Type definitions
```

---

## References

### TrinityCore Documentation:
- [VMap Extractor](https://github.com/TrinityCore/TrinityCore/tree/master/src/tools/vmap4_extractor)
- [MMap Generator](https://github.com/TrinityCore/TrinityCore/tree/master/src/tools/mmaps_generator)

### External Libraries:
- [Recast/Detour](https://github.com/recastnavigation/recastnavigation) - Navigation mesh library
- [node-gyp](https://github.com/nodejs/node-gyp) - For native C++ bindings if needed

### Research Papers:
- "Efficient Ray-Triangle Intersection" - Möller–Trumbore (1997)
- "A* Pathfinding" - Hart, Nilsson, Raphael (1968)
- "Simple Stupid Funnel Algorithm" - Demyen & Buro (2006)

---

## Impact on Features

### Limited Features Due to VMap/MMap:

**High Impact:**
- ❌ Accurate bot pathfinding
- ❌ Line-of-sight for casting/targeting
- ❌ Collision detection
- ❌ Indoor/outdoor detection

**Medium Impact:**
- ⚠️ Bot positioning validation
- ⚠️ Dungeon navigation
- ⚠️ Strategic positioning

**Low Impact:**
- ✅ Database queries (unaffected)
- ✅ Combat log analysis (unaffected)
- ✅ Code generation (unaffected)
- ✅ Most other tools (unaffected)

---

## Testing Strategy

### Current Testing:
1. **Unit Tests**: Validate input/output structure
2. **Integration Tests**: Test tool registration
3. **Error Handling**: Verify graceful failures

### Future Testing (Post-Implementation):
1. **Binary File Loading**: Test with real VMap/MMap files
2. **Pathfinding Accuracy**: Compare with TrinityCore results
3. **Performance**: Benchmark spatial queries
4. **Memory Usage**: Monitor cache efficiency

---

## Conclusion

VMap and MMap functionality is currently **documented and structured** but **not fully implemented** due to complexity of binary data parsing and algorithmic requirements. The current placeholder implementations:

- ✅ Provide clear API contracts
- ✅ Handle errors gracefully
- ✅ Document limitations explicitly
- ✅ Enable future implementation

**Recommendation**: Use database-based approximations and SOAP integration for production use until full VMap/MMap implementation is completed in future phases.

---

**Last Updated**: 2025-01-06
**Version**: 1.0
**Status**: Beta Release - Documented Limitations
