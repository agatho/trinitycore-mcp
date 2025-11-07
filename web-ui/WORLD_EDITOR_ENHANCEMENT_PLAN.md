# World Editor Enhancement Implementation Plan

## Executive Summary

This document outlines the comprehensive implementation plan for enhancing the TrinityCore World Editor with advanced 3D rendering, synchronization, interactive editing, and professional mapping tools.

**Total Estimated Effort:** ~40-50 hours
**Lines of Code:** ~3,500-4,000 new lines
**Files to Create/Modify:** ~20 files

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    World Editor UI                       │
│  ┌──────────────────────┐  ┌──────────────────────┐    │
│  │   MapView2D          │  │   MapView3D          │    │
│  │  (Canvas 2D)         │  │  (Three.js WebGL)    │    │
│  └──────────────────────┘  └──────────────────────┘    │
│              ▲                        ▲                  │
│              │                        │                  │
│              └────────┬───────────────┘                  │
│                       ▼                                  │
│              useWorldEditorState                         │
│         (Shared State Management)                        │
│                       │                                  │
│        ┌──────────────┼──────────────┐                  │
│        ▼              ▼               ▼                  │
│   Coordinates    VMap/MMap      Selection                │
│   Waypoints       Collision      Camera Sync             │
└─────────────────────────────────────────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        ▼              ▼               ▼
   SceneManager  MeshLoaders    InteractionManager
   (Three.js)    (Geometry)     (Raycasting/Edit)
```

---

## Phase 1: Three.js Foundation (Priority: Critical)

### Goals
- Set up robust Three.js scene management
- Create reusable scene components
- Establish rendering pipeline

### Files to Create

#### 1.1 `lib/three/scene-manager.ts` (~300 lines)
**Purpose:** Central scene management class

**Key Features:**
- Scene, camera, renderer initialization
- Animation loop management
- Resize handling
- Lighting setup (ambient + directional)
- Grid helper
- Performance monitoring (FPS counter)

**API:**
```typescript
class SceneManager {
  constructor(canvas: HTMLCanvasElement, options: SceneOptions)

  // Core
  init(): void
  dispose(): void
  render(): void

  // Camera
  setCameraPosition(x: number, y: number, z: number): void
  focusOnPoint(x: number, y: number, z: number): void

  // Scene management
  add(object: Object3D): void
  remove(object: Object3D): void
  clear(): void

  // Events
  on(event: string, callback: Function): void
  off(event: string, callback: Function): void
}
```

#### 1.2 `lib/three/controls-manager.ts` (~200 lines)
**Purpose:** Camera controls and interaction

**Features:**
- OrbitControls integration
- Custom keyboard shortcuts (WASD movement)
- Mouse wheel zoom
- Pan/tilt with mouse
- Double-click to focus
- Control state persistence

**API:**
```typescript
class ControlsManager {
  constructor(camera: Camera, domElement: HTMLElement)

  enable(): void
  disable(): void
  reset(): void
  saveState(): ControlState
  restoreState(state: ControlState): void
}
```

#### 1.3 `lib/three/lighting-manager.ts` (~150 lines)
**Purpose:** Dynamic lighting system

**Features:**
- Ambient light (base illumination)
- Directional light (sun)
- Hemisphere light (sky/ground)
- Shadow mapping configuration
- Time-of-day simulation

---

## Phase 2: Mesh Loading & Rendering (Priority: Critical)

### Goals
- Convert VMap collision data to Three.js meshes
- Convert MMap navigation mesh to visualizable geometry
- Optimize for performance (LOD, instancing)

### Files to Create

#### 2.1 `lib/three/vmap-mesh-loader.ts` (~400 lines)
**Purpose:** Convert VMap data to Three.js geometry

**Algorithm:**
```
1. Parse VMap BIH tree structure
2. For each tile:
   - Extract triangle data
   - Create BufferGeometry
   - Compute normals
   - Apply materials based on type (building, terrain, water)
3. Merge geometries for performance
4. Create instanced meshes for repeating structures
5. Apply LOD (Level of Detail) for distant objects
```

**Features:**
- Triangle mesh conversion
- Vertex color for height mapping
- Material assignment (terrain, water, buildings)
- Normal computation for lighting
- Bounding box optimization

**API:**
```typescript
class VMapMeshLoader {
  load(vmapData: VMapData, options: LoadOptions): Group

  // Utilities
  createTerrainMesh(triangles: Triangle[]): Mesh
  applyHeightColors(geometry: BufferGeometry): void
  optimizeGeometry(mesh: Mesh): Mesh
}
```

#### 2.2 `lib/three/mmap-mesh-loader.ts` (~300 lines)
**Purpose:** Convert MMap navigation mesh to Three.js

**Features:**
- Polygon extraction from Recast/Detour tiles
- Wireframe visualization
- Semi-transparent overlay
- Height offset (slightly above ground)
- Color coding by walkability

**API:**
```typescript
class MMapMeshLoader {
  load(mmapData: MMapData, options: LoadOptions): Group

  createNavMesh(polygons: Polygon[]): Mesh
  applyWalkabilityColors(geometry: BufferGeometry): void
}
```

#### 2.3 `lib/three/terrain-shader.ts` (~200 lines)
**Purpose:** Custom shaders for terrain rendering

**Features:**
- Elevation-based coloring
- Slope detection (flat = green, steep = brown)
- Water surface shader (reflective, animated)
- Fog for distant terrain

**Shader Example:**
```glsl
// Vertex shader
varying float vHeight;
void main() {
  vHeight = position.z;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}

// Fragment shader
varying float vHeight;
void main() {
  // Height-based coloring
  vec3 color = mix(
    vec3(0.2, 0.4, 0.2),  // Low = dark green
    vec3(0.6, 0.5, 0.4),  // High = brown
    smoothstep(-100.0, 500.0, vHeight)
  );
  gl_FragColor = vec4(color, 1.0);
}
```

---

## Phase 3: Spawn Markers & Raycasting (Priority: High)

### Files to Create

#### 3.1 `lib/three/spawn-marker.ts` (~250 lines)
**Purpose:** Visual spawn point representation

**Features:**
- Instanced mesh for performance (1000+ spawns)
- Different geometries per type (sphere, cylinder, cone)
- Color coding (creature = red, object = blue, NPC = green)
- Label billboards (always face camera)
- Hover glow effect
- Selection highlight (outline shader)

**API:**
```typescript
class SpawnMarkerManager {
  constructor(scene: Scene)

  addMarker(coord: MapCoordinate): SpawnMarker
  removeMarker(id: string): void
  updateMarker(id: string, coord: MapCoordinate): void

  setSelected(ids: string[]): void
  setHovered(id: string | null): void

  // Batch operations
  addMarkers(coords: MapCoordinate[]): void
  clear(): void
}
```

**Marker Types:**
```typescript
type MarkerGeometry = 'sphere' | 'cylinder' | 'cone' | 'cube';
type MarkerColor = Color | ((coord: MapCoordinate) => Color);

interface MarkerStyle {
  geometry: MarkerGeometry;
  scale: number;
  color: MarkerColor;
  label?: boolean;
  billboard?: boolean;
}
```

#### 3.2 `lib/three/raycaster-manager.ts` (~300 lines)
**Purpose:** 3D mouse picking and interaction

**Features:**
- Mouse position to 3D ray conversion
- Terrain intersection detection
- Spawn marker picking
- Multi-object intersection
- Hover detection with debouncing
- Click vs drag detection

**Algorithm:**
```
1. Convert mouse (x, y) to NDC (Normalized Device Coordinates)
2. Create ray from camera through mouse position
3. Test intersection with:
   - Terrain mesh (for spawn placement)
   - Spawn markers (for selection)
   - Waypoint lines (for editing)
4. Return closest intersection
5. Emit events (hover, click, drag)
```

**API:**
```typescript
class RaycasterManager {
  constructor(camera: Camera, scene: Scene)

  // Core raycasting
  raycastFromMouse(mouseX: number, mouseY: number): Intersection[]
  getTerrainHeight(x: number, y: number): number | null

  // Object picking
  pickSpawnMarker(mouseX: number, mouseY: number): SpawnMarker | null
  pickWaypoint(mouseX: number, mouseY: number): WaypointNode | null

  // Events
  onHover(callback: (object: Object3D | null) => void): void
  onClick(callback: (object: Object3D, point: Vector3) => void): void
  onDragStart(callback: (object: Object3D) => void): void
  onDrag(callback: (delta: Vector3) => void): void
  onDragEnd(callback: () => void): void
}
```

---

## Phase 4: Synchronization (Priority: High)

### Files to Create

#### 4.1 `lib/three/sync-manager.ts` (~250 lines)
**Purpose:** 2D ↔ 3D state synchronization

**Features:**
- Selection state sync (bidirectional)
- Camera position sync
- Coordinate updates (real-time)
- Focus/zoom sync
- Event debouncing to prevent loops

**Synchronization Events:**
```typescript
// 2D → 3D
on2DSelection(ids: string[]) → highlight3DMarkers(ids)
on2DDoubleClick(x, y) → focus3DCamera(x, y)
on2DPan(x, y) → update3DCameraTarget(x, y)

// 3D → 2D
on3DSelection(ids: string[]) → highlight2DMarkers(ids)
on3DCameraMove(x, y, z) → update2DViewport(x, y)
on3DSpawnPlace(x, y, z) → add2DMarker(x, y)
```

**API:**
```typescript
class SyncManager {
  constructor(state: WorldEditorState, actions: WorldEditorActions)

  // Selection sync
  syncSelectionTo2D(ids: string[]): void
  syncSelectionTo3D(ids: string[]): void

  // Camera sync
  syncCameraTo2D(position: Vector3, target: Vector3): void
  syncCameraTo3D(x: number, y: number, zoom: number): void

  // Focus sync
  focusOn2D(x: number, y: number): void
  focusOn3D(x: number, y: number, z: number): void

  // Enable/disable
  enableSync(): void
  disableSync(): void
}
```

#### 4.2 `lib/three/highlight-manager.ts` (~150 lines)
**Purpose:** Visual highlighting in both views

**Features:**
- Outline shader for 3D selection
- Pulsing animation for selected items
- Different colors (selection = blue, hover = yellow)
- Performance-optimized (post-processing)

---

## Phase 5: Interactive Editing (Priority: Medium)

### Files to Create

#### 5.1 `lib/three/transform-controls.ts` (~350 lines)
**Purpose:** 3D object manipulation

**Features:**
- Translate gizmo (XYZ arrows)
- Rotate gizmo (XYZ rings)
- Scale gizmo (XYZ boxes)
- Multi-object transform
- Snap to grid
- Snap to terrain (height detection)
- Undo/redo integration

**Transform Modes:**
```typescript
type TransformMode = 'translate' | 'rotate' | 'scale';
type TransformSpace = 'world' | 'local';

class TransformControls {
  mode: TransformMode;
  space: TransformSpace;

  attach(object: Object3D): void
  detach(): void

  setMode(mode: TransformMode): void
  setSpace(space: TransformSpace): void

  // Snapping
  setTranslationSnap(snap: number): void
  setRotationSnap(snap: number): void
  enableTerrainSnap(enabled: boolean): void

  // Events
  onChange(callback: (object: Object3D) => void): void
  onDragStart(callback: () => void): void
  onDragEnd(callback: () => void): void
}
```

#### 5.2 `lib/three/multi-select-manager.ts` (~200 lines)
**Purpose:** Advanced selection system

**Features:**
- Box selection (drag rectangle)
- Shift+Click to add to selection
- Ctrl+Click to remove from selection
- Select all in area
- Invert selection
- Select by type/layer

**API:**
```typescript
class MultiSelectManager {
  selectedIds: Set<string>;

  // Selection methods
  select(id: string): void
  deselect(id: string): void
  toggle(id: string): void
  selectAll(): void
  deselectAll(): void
  invertSelection(): void

  // Box selection
  startBoxSelect(x: number, y: number): void
  updateBoxSelect(x: number, y: number): void
  endBoxSelect(): void

  // Filtering
  selectByType(type: string): void
  selectInRadius(x: number, y: number, radius: number): void
}
```

---

## Phase 6: Waypoint & Path Visualization (Priority: Medium)

### Files to Create

#### 6.1 `lib/three/waypoint-visualizer.ts` (~300 lines)
**Purpose:** Visual waypoint path rendering

**Features:**
- Catmull-Rom spline interpolation
- Animated flow direction (moving dots)
- Color coding by wait time
- Editable control points
- Path statistics (distance, elevation change)

**Visual Elements:**
```typescript
// Path line (smooth spline)
const pathLine = new Line(geometry, material);

// Waypoint nodes (spheres at each point)
const nodes = waypoints.map(wp => new Mesh(
  new SphereGeometry(0.5),
  new MeshBasicMaterial({ color: 0x00ff00 })
));

// Direction arrows (show movement direction)
const arrows = createDirectionArrows(path);

// Animated flow (particles moving along path)
const flowParticles = new Points(geometry, pointsMaterial);
```

**API:**
```typescript
class WaypointVisualizer {
  constructor(scene: Scene)

  addPath(path: WaypointPath): void
  updatePath(pathId: string, path: WaypointPath): void
  removePath(pathId: string): void

  // Visualization
  showDirectionArrows(show: boolean): void
  showFlowAnimation(show: boolean): void
  setPathColor(pathId: string, color: Color): void

  // Editing
  addWaypoint(pathId: string, position: Vector3): void
  moveWaypoint(pathId: string, index: number, position: Vector3): void
  removeWaypoint(pathId: string, index: number): void

  // Animation
  animateFlow(): void
}
```

---

## Phase 7: Road Network Editing (Priority: Low)

### Files to Create

#### 7.1 `lib/three/road-editor.ts` (~350 lines)
**Purpose:** Interactive road network creation

**Features:**
- Bezier curve road paths
- Width adjustment (drag handles)
- Junction detection and merging
- Road surface texture
- Elevation following (terrain conforming)

**Road Components:**
```typescript
interface Road3D {
  id: string;
  path: Vector3[];
  width: number;
  surface: RoadSurface;
  mesh: Mesh;
  handles: Mesh[];
}

type RoadSurface = 'paved' | 'dirt' | 'cobblestone';

class RoadEditor {
  createRoad(points: Vector3[]): Road3D
  addControlPoint(roadId: string, position: Vector3): void
  updateWidth(roadId: string, width: number): void
  conformToTerrain(roadId: string): void

  // Junction handling
  detectJunctions(): Junction[]
  mergeRoads(roadId1: string, roadId2: string): void
}
```

---

## Phase 8: Advanced Features (Priority: Low)

### Files to Create

#### 8.1 `lib/three/zone-transition-visualizer.ts` (~200 lines)
**Purpose:** Portal and zone transition markers

**Features:**
- Portal mesh (glowing frame)
- Particle effects
- Destination preview (minimap overlay)
- Bidirectional arrows

#### 8.2 `lib/three/measurement-tools.ts` (~250 lines)
**Purpose:** Professional measurement utilities

**Features:**
- Distance ruler (click two points)
- Area measurement (polygon)
- Elevation profile (cross-section)
- Coordinate display (world + map)
- Export measurements to CSV

**Tools:**
```typescript
class MeasurementTools {
  // Distance
  measureDistance(point1: Vector3, point2: Vector3): DistanceMeasurement

  // Area
  measureArea(points: Vector3[]): AreaMeasurement

  // Elevation
  createElevationProfile(start: Vector3, end: Vector3, samples: number): ProfileData

  // Export
  exportMeasurements(format: 'csv' | 'json'): string
}

interface DistanceMeasurement {
  distance2D: number;
  distance3D: number;
  elevationChange: number;
  slope: number;
}
```

---

## Integration Points

### Updated Files

#### 1. `app/world-editor/components/MapView3D.tsx`
**Changes:**
- Replace placeholder with real Three.js implementation
- Integrate SceneManager
- Add raycasting event handlers
- Implement spawn placement
- Add toolbar for tools (select, move, rotate, measure)

#### 2. `app/world-editor/hooks/useWorldEditorState.ts`
**New State:**
```typescript
// 3D-specific state
interface WorldEditorState {
  // ... existing fields

  // 3D view state
  camera3D: {
    position: { x: number; y: number; z: number };
    target: { x: number; y: number; z: number };
    fov: number;
  };

  // Interaction
  transformMode: 'translate' | 'rotate' | 'scale';
  snapToTerrain: boolean;
  showWaypointPaths: boolean;
  showRoadNetwork: boolean;
  showZoneTransitions: boolean;

  // Measurement
  activeMeasurement: MeasurementTool | null;
  measurements: Measurement[];
}
```

#### 3. `app/world-editor/page.tsx`
**UI Additions:**
- 3D toolbar (transform modes, snap settings)
- Measurement panel
- Path editor panel
- Performance stats overlay

---

## Performance Optimization

### Strategies

1. **Instanced Rendering**
   - Use InstancedMesh for spawn markers
   - Target: 10,000+ spawns at 60 FPS

2. **Level of Detail (LOD)**
   - Terrain meshes: 3 LOD levels
   - Switch distances: 100, 500, 1000 units

3. **Frustum Culling**
   - Only render objects in camera view
   - Automatic in Three.js

4. **Geometry Merging**
   - Merge static terrain meshes
   - Reduce draw calls by 90%

5. **Texture Atlasing**
   - Combine terrain textures
   - Single material for large areas

6. **Web Workers**
   - Mesh generation in background
   - Non-blocking UI

---

## Testing Strategy

### Unit Tests
- VMap mesh conversion accuracy
- MMap polygon extraction
- Raycasting precision
- Transform calculations

### Integration Tests
- 2D/3D synchronization
- Selection state consistency
- Camera movement sync
- Undo/redo functionality

### Performance Tests
- 10,000 spawn markers: Target 60 FPS
- 1M triangle terrain: Target 60 FPS
- Memory usage: < 500MB for typical map

### User Acceptance
- Spawn placement accuracy (±0.1 WoW units)
- Transform responsiveness (< 16ms per frame)
- Visual quality (smooth terrain, proper lighting)

---

## Deployment Checklist

- [ ] Install Three.js dependencies
- [ ] Create all Phase 1-8 files
- [ ] Update MapView3D.tsx with implementation
- [ ] Add 3D toolbar UI
- [ ] Write comprehensive tests
- [ ] Performance profiling
- [ ] Documentation (JSDoc comments)
- [ ] User guide with screenshots
- [ ] Commit and push to branch
- [ ] Create pull request

---

## Dependencies

```json
{
  "dependencies": {
    "three": "^0.160.0",
    "@types/three": "^0.160.0",
    "three-stdlib": "^2.29.0"
  }
}
```

**Three.js Modules:**
- `OrbitControls` - Camera controls
- `TransformControls` - Object manipulation
- `GLTFLoader` - Model loading (future)
- `EffectComposer` - Post-processing (outlines)

---

## Timeline Estimate

| Phase | Hours | Priority |
|-------|-------|----------|
| Phase 1: Foundation | 6-8h | Critical |
| Phase 2: Mesh Loading | 8-10h | Critical |
| Phase 3: Markers & Raycasting | 6-8h | High |
| Phase 4: Synchronization | 4-6h | High |
| Phase 5: Interactive Editing | 8-10h | Medium |
| Phase 6: Waypoints | 4-6h | Medium |
| Phase 7: Roads | 4-6h | Low |
| Phase 8: Advanced | 4-6h | Low |
| **Total** | **44-60h** | - |

---

## Success Metrics

1. **Performance:** 60 FPS with 10,000 spawns and 1M triangle terrain
2. **Accuracy:** Spawn placement within ±0.1 WoW units
3. **Usability:** < 5 minute learning curve for basic operations
4. **Reliability:** Zero crashes in 1-hour editing session
5. **Quality:** Enterprise-grade code with 80%+ test coverage

---

**Status:** 📋 Plan Complete - Ready for Implementation
**Next Step:** Begin Phase 1 (Three.js Foundation)
