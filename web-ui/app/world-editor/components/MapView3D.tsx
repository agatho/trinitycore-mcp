'use client';

/**
 * 3D Map View Component - Complete Three.js Integration
 *
 * Fully integrated 3D viewer with VMap/MMap visualization, spawn markers,
 * raycasting, synchronization, and interactive editing.
 */

import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import type { WorldEditorState, WorldEditorActions } from '../hooks/useWorldEditorState';
import { SceneManager } from '@/lib/three/scene-manager';
import { ControlsManager } from '@/lib/three/controls-manager';
import { LightingManager } from '@/lib/three/lighting-manager';
import { VMapMeshLoader } from '@/lib/three/vmap-mesh-loader';
import { VMapModelLoader } from '@/lib/three/vmap-model-loader';
import { MMapMeshLoader } from '@/lib/three/mmap-mesh-loader';
import { TerrainMeshLoader } from '@/lib/three/terrain-mesh-loader';
import { SpawnMarkerManager } from '@/lib/three/spawn-marker-manager';
import { RaycasterManager } from '@/lib/three/raycaster-manager';
import { SyncManager } from '@/lib/three/sync-manager';
import { HighlightManager } from '@/lib/three/highlight-manager';
import { TransformControlsWrapper } from '@/lib/three/transform-controls-wrapper';
import { MultiSelectManager } from '@/lib/three/multi-select-manager';
import { WaypointVisualizer } from '@/lib/three/waypoint-visualizer';
import { RoadEditor } from '@/lib/three/road-editor';
import { MeasurementTools } from '@/lib/three/measurement-tools';
import { TimeOfDaySystem } from '@/lib/three/time-of-day-system';
import { getPerformanceMonitor } from '@/lib/performance-monitor';
import { PerformanceDashboard } from './PerformanceDashboard';
import { TimeOfDayControl } from './TimeOfDayControl';
import { TileManager, type TileManagerStats } from '@/lib/three/tile-manager';

interface MapView3DProps {
  state: WorldEditorState;
  actions: WorldEditorActions;
  width?: number;
  height?: number;
}

type ActiveTool = 'navigate' | 'spawn' | 'select' | 'move' | 'measure';

export function MapView3D({ state, actions, width = 1200, height = 800 }: MapView3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Managers (stored in refs to persist across renders)
  const managersRef = useRef<{
    scene?: SceneManager;
    controls?: ControlsManager;
    lighting?: LightingManager;
    timeOfDay?: TimeOfDaySystem;
    vmapLoader?: VMapMeshLoader;
    vmapModelLoader?: VMapModelLoader;
    mmapLoader?: MMapMeshLoader;
    terrainLoader?: TerrainMeshLoader;
    spawnMarkers?: SpawnMarkerManager;
    raycaster?: RaycasterManager;
    sync?: SyncManager;
    highlight?: HighlightManager;
    transform?: TransformControlsWrapper;
    multiSelect?: MultiSelectManager;
    waypoints?: WaypointVisualizer;
    roads?: RoadEditor;
    measurement?: MeasurementTools;
    terrainGroup?: THREE.Group;
    tileManager?: TileManager;
  }>({});

  // UI state
  const [activeTool, setActiveTool] = useState<ActiveTool>('spawn');
  const [fps, setFps] = useState(60);
  const [isInitialized, setIsInitialized] = useState(false);

  // Time of Day state
  const [currentTime, setCurrentTime] = useState(12); // Noon
  const [autoProgress, setAutoProgress] = useState(false);
  const [timeSpeed, setTimeSpeed] = useState(0.5);

  // VMap model loading state
  const [vmapModelsLoading, setVmapModelsLoading] = useState(false);
  const [vmapModelsProgress, setVmapModelsProgress] = useState({ loaded: 0, total: 0 });
  const [vmapModelsLoaded, setVmapModelsLoaded] = useState(false);

  // Dynamic tile loading state
  const [dynamicTilesEnabled, setDynamicTilesEnabled] = useState(false);
  const [tileStats, setTileStats] = useState<TileManagerStats | null>(null);

  /**
   * Initialize Three.js scene
   */
  useEffect(() => {
    if (!canvasRef.current || isInitialized) return;

    console.log('[MapView3D] Initializing Three.js...');

    try {
      // Create managers
      const scene = new SceneManager(canvasRef.current, {
        antialias: true,
        shadows: false,  // Disabled for performance
        showGrid: state.showGrid,
        fogEnabled: true,
      });

      const controls = new ControlsManager(
        scene.getCamera(),
        canvasRef.current,
        {
          enableDamping: true,
          dampingFactor: 0.05,
        }
      );

      const lighting = new LightingManager(scene.getScene(), {
        shadowsEnabled: false,  // Disabled for performance
        shadowMapSize: 1024,
      });

      const spawnMarkers = new SpawnMarkerManager(scene.getScene());

      const raycaster = new RaycasterManager(
        scene.getCamera(),
        scene.getScene(),
        canvasRef.current
      );

      const sync = new SyncManager(state, actions);

      const highlight = new HighlightManager(scene.getScene());

      const transform = new TransformControlsWrapper(
        scene.getCamera(),
        canvasRef.current,
        scene.getScene()
      );

      const multiSelect = new MultiSelectManager(
        scene.getCamera(),
        scene.getScene(),
        canvasRef.current
      );

      const waypoints = new WaypointVisualizer(scene.getScene());

      const roads = new RoadEditor(scene.getScene());

      const measurement = new MeasurementTools(scene.getScene());

      // Time of Day System
      const timeOfDay = new TimeOfDaySystem(lighting, {
        currentTime: 12,
        timeSpeed: 0.5,
        autoProgress: false,
      });

      const vmapLoader = new VMapMeshLoader({
        heightColors: true,
        wireframe: false,
        opacity: 0.8,
      });

      const vmapModelLoader = new VMapModelLoader({
        maxModels: 50,           // Reduced for better FPS
        maxTriangles: 200000,    // Reduced for better FPS
        maxInstancesPerModel: 20,
        heightColors: true,
        wireframe: false,
        opacity: 0.85,
      });

      const mmapLoader = new MMapMeshLoader({
        wireframe: true,
        opacity: 0.5,
        colorByWalkability: true,
      });

      const terrainLoader = new TerrainMeshLoader({
        heightColors: true,
        wireframe: false,
        opacity: 1.0,
        heightScale: 1.0,
        showTileBoundaries: false,
      });

      // Create TileManager for dynamic tile loading
      const tileManager = new TileManager(scene.getScene(), {
        loadRadius: 2,
        maxModelsPerTile: 30,
        maxTrianglesPerTile: 100000,
        debug: true,
        onTileChange: (loaded, unloaded) => {
          console.log(`[TileManager] Tiles changed: +${loaded}/-${unloaded}`);
        },
      });

      // Store in ref
      managersRef.current = {
        scene,
        controls,
        lighting,
        timeOfDay,
        spawnMarkers,
        raycaster,
        sync,
        highlight,
        transform,
        multiSelect,
        waypoints,
        roads,
        measurement,
        vmapLoader,
        vmapModelLoader,
        mmapLoader,
        terrainLoader,
        terrainGroup: new THREE.Group(),
        tileManager,
      };

      // Setup event listeners
      setupEventListeners();

      // Enable controls
      controls.enable();
      raycaster.enable();

      // Get performance monitor
      const perfMonitor = getPerformanceMonitor();

      // Start animation
      scene.on('update', (data: { delta: number }) => {
        controls.update(data.delta);
        highlight.update(data.delta);
        waypoints.update(data.delta);

        // Update time of day system
        timeOfDay.update(data.delta);
        setCurrentTime(timeOfDay.getTime());

        // Update TileManager with camera position (dynamic tile loading)
        if (managersRef.current.tileManager) {
          managersRef.current.tileManager.update(scene.getCamera().position);

          // Periodically update tile stats for UI
          const stats = managersRef.current.tileManager.getStats();
          setTileStats(stats);
        }

        // Update performance monitor with renderer metrics
        perfMonitor.updateFrame(scene.getRenderer());

        // Update FPS
        const sceneStats = scene.getStats();
        setFps(sceneStats.fps);
      });

      scene.startAnimation();

      setIsInitialized(true);
      console.log('[MapView3D] Initialized successfully');

    } catch (error) {
      console.error('[MapView3D] Initialization error:', error);
    }

    // Cleanup
    return () => {
      console.log('[MapView3D] Cleaning up...');
      const m = managersRef.current;
      m.scene?.dispose();
      m.controls?.dispose();
      m.lighting?.dispose();
      m.spawnMarkers?.dispose();
      m.raycaster?.dispose();
      m.sync?.dispose();
      m.highlight?.dispose();
      m.transform?.dispose();
      m.multiSelect?.dispose();
      m.waypoints?.dispose();
      m.roads?.dispose();
      m.measurement?.dispose();
      m.vmapLoader?.dispose();
      m.vmapModelLoader?.dispose();
      m.mmapLoader?.dispose();
      m.terrainLoader?.dispose();
      m.tileManager?.dispose();
    };
  }, []);

  /**
   * Setup event listeners for interactions
   */
  function setupEventListeners() {
    const { raycaster, spawnMarkers, sync, highlight, transform, multiSelect } = managersRef.current;
    if (!raycaster || !spawnMarkers || !sync) return;

    // Terrain click for spawn placement
    raycaster.on('terrainClick', ({ point }: { point: THREE.Vector3 }) => {
      if (activeTool !== 'spawn') return;

      const coord = {
        id: `spawn-${Date.now()}`,
        x: point.x,
        y: point.z, // Three.js Z -> WoW Y
        z: point.y, // Three.js Y -> WoW Z (height)
        mapId: state.selectedMap,
        type: 'spawn' as const,
        label: `Spawn ${state.coordinates.filter(c => c.type === 'spawn').length + 1}`,
      };

      // Add via sync manager
      sync.syncCoordinateAddedTo2D(coord);
    });

    // Object click for selection
    raycaster.on('objectClick', ({ object }: { object: THREE.Object3D }) => {
      if (activeTool !== 'select') return;

      const markerId = object.userData.markerId;
      if (markerId) {
        multiSelect?.toggle(markerId);
      }
    });

    // Hover effects
    raycaster.on('hoverStart', ({ object }: { object: THREE.Object3D }) => {
      const markerId = object.userData.markerId;
      if (markerId) {
        spawnMarkers?.setHovered(markerId);
        highlight?.setHover(object);
      }
    });

    raycaster.on('hoverEnd', () => {
      spawnMarkers?.setHovered(null);
      highlight?.clearHover();
    });

    // Transform events
    transform?.on('dragEnd', ({ position }: any) => {
      // Update coordinate in state
      const markerId = transform.getControls().object?.userData.markerId;
      if (markerId) {
        const coord = state.coordinates.find(c => c.id === markerId);
        if (coord) {
          sync.syncCoordinateUpdatedTo2D({
            ...coord,
            x: position.x,
            y: position.z,
            z: position.y,
          });
        }
      }
    });

    // Selection changes
    multiSelect?.on('selectionChanged', (ids: string[]) => {
      spawnMarkers?.setSelected(ids);
      const objects = ids
        .map(id => spawnMarkers?.getMarker(id)?.mesh)
        .filter((m): m is THREE.Mesh => m !== undefined);
      highlight?.setSelection(objects);
      sync.syncSelectionTo2D(ids);
    });
  }

  /**
   * Load VMap model geometry (async)
   */
  async function loadVMapModels() {
    if (!state.vmapData || !managersRef.current.scene || !managersRef.current.vmapModelLoader) {
      console.warn('[MapView3D] Cannot load VMap models - missing data or loader');
      return;
    }

    if (vmapModelsLoading) {
      console.warn('[MapView3D] VMap models already loading');
      return;
    }

    setVmapModelsLoading(true);
    setVmapModelsProgress({ loaded: 0, total: 0 });

    try {
      console.log('[MapView3D] Starting VMap model loading...');

      // Update loader's progress callback
      const loader = managersRef.current.vmapModelLoader;

      const result = await loader.load(state.vmapData);

      // Add to scene
      result.group.userData.isVMapModels = true;
      managersRef.current.scene.add(result.group);

      console.log('[MapView3D] VMap models loaded:', {
        models: result.modelCount,
        triangles: result.triangleCount,
        spawns: result.spawnCount,
        failed: result.failedModels.length,
      });

      setVmapModelsLoaded(true);

      // Log bounds info but DON'T move the camera - keep existing view
      if (result.triangleCount > 0) {
        const box = new THREE.Box3().setFromObject(result.group);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        console.log('[MapView3D] VMap models bounds:', {
          center: { x: center.x.toFixed(0), y: center.y.toFixed(0), z: center.z.toFixed(0) },
          size: { x: size.x.toFixed(0), y: size.y.toFixed(0), z: size.z.toFixed(0) },
        });
        // Camera stays where it is - models should appear in the same coordinate space
      }
    } catch (error) {
      console.error('[MapView3D] Error loading VMap models:', error);
    } finally {
      setVmapModelsLoading(false);
    }
  }

  /**
   * Load VMap mesh when data changes
   *
   * Note: VMapMeshLoader currently returns empty geometry because it no longer
   * renders bounding boxes. Actual geometry comes from VMapModelLoader (.vmo files).
   * This effect is kept for potential future use with actual vertex data.
   */
  useEffect(() => {
    if (!state.vmapData || !managersRef.current.scene || !managersRef.current.vmapLoader) return;

    console.log('[MapView3D] Loading VMap mesh...');

    try {
      const result = managersRef.current.vmapLoader.load(state.vmapData);

      // Only add if there's actual geometry - don't remove existing terrain for empty results
      if (result.triangleCount > 0) {
        result.group.userData.isTerrain = true;

        if (managersRef.current.terrainGroup) {
          managersRef.current.scene.remove(managersRef.current.terrainGroup);
        }

        managersRef.current.terrainGroup = result.group;
        managersRef.current.scene.add(result.group);
        managersRef.current.raycaster?.setTerrainLayer(result.group);

        console.log('[MapView3D] VMap mesh loaded:', result.triangleCount, 'triangles');

        // Move camera to view the geometry
        const box = new THREE.Box3().setFromObject(result.group);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());

        console.log('[MapView3D] VMap bounds:', {
          center: { x: center.x, y: center.y, z: center.z },
          size: { x: size.x, y: size.y, z: size.z },
        });

        const maxDim = Math.max(size.x, size.y, size.z);
        const viewDistance = Math.max(500, maxDim * 0.8);
        managersRef.current.controls?.focusOn(center.x, center.y, center.z, viewDistance);
      } else {
        console.log('[MapView3D] VMap mesh empty (0 triangles) - keeping existing terrain');
      }
    } catch (error) {
      console.error('[MapView3D] Error loading VMap:', error);
    }
  }, [state.vmapData]);

  /**
   * Load MMap mesh when data changes
   */
  useEffect(() => {
    if (!state.mmapData || !managersRef.current.scene || !managersRef.current.mmapLoader) return;

    console.log('[MapView3D] Loading MMap mesh...');

    try {
      const result = managersRef.current.mmapLoader.load(state.mmapData);
      managersRef.current.scene.add(result.group);

      console.log('[MapView3D] MMap loaded:', result.polygonCount, 'polygons');

      // Move camera to view the loaded geometry if no VMap was loaded
      if (result.polygonCount > 0 && !state.vmapData) {
        const box = new THREE.Box3().setFromObject(result.group);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());

        console.log('[MapView3D] MMap bounds:', {
          center: { x: center.x, y: center.y, z: center.z },
          size: { x: size.x, y: size.y, z: size.z },
        });

        const maxDim = Math.max(size.x, size.y, size.z);
        const viewDistance = Math.max(500, maxDim * 0.8);
        managersRef.current.controls?.focusOn(center.x, center.y, center.z, viewDistance);
      }
    } catch (error) {
      console.error('[MapView3D] Error loading MMap:', error);
    }
  }, [state.mmapData, state.vmapData]);

  /**
   * Load Terrain mesh when .map data changes
   */
  useEffect(() => {
    if (!state.mapData || !managersRef.current.scene || !managersRef.current.terrainLoader) return;

    console.log('[MapView3D] Loading Terrain mesh...', {
      mapId: state.mapData.mapId,
      tileCount: state.mapData.tiles.size,
    });

    try {
      const result = managersRef.current.terrainLoader.load(state.mapData);
      result.group.userData.isTerrainMesh = true;
      managersRef.current.scene.add(result.group);

      // Set as terrain layer for raycasting
      managersRef.current.raycaster?.setTerrainLayer(result.group);

      console.log('[MapView3D] Terrain loaded:', result.tiles.size, 'tiles');

      // Log terrain bounds for debugging
      if (result.tiles.size > 0) {
        const box = new THREE.Box3().setFromObject(result.group);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());

        console.log('[MapView3D] Terrain bounds:', {
          center: { x: center.x.toFixed(0), y: center.y.toFixed(0), z: center.z.toFixed(0) },
          size: { x: size.x.toFixed(0), y: size.y.toFixed(0), z: size.z.toFixed(0) },
        });

        // If no VMap was loaded, focus camera on terrain
        if (!state.vmapData) {
          const maxDim = Math.max(size.x, size.y, size.z);
          const viewDistance = Math.max(500, maxDim * 0.8);
          managersRef.current.controls?.focusOn(center.x, center.y, center.z, viewDistance);
        }
      }
    } catch (error) {
      console.error('[MapView3D] Error loading Terrain:', error);
    }
  }, [state.mapData, state.vmapData]);

  /**
   * Update spawn markers when coordinates change
   */
  useEffect(() => {
    if (!managersRef.current.spawnMarkers) return;

    const spawnMarkers = managersRef.current.spawnMarkers;
    const spawns = state.coordinates.filter(c => c.type === 'spawn');

    // Remove deleted markers
    const existingIds = new Set(spawnMarkers.getAllMarkers().map(m => m.id));
    const currentIds = new Set(spawns.map(s => s.id));

    for (const id of existingIds) {
      if (!currentIds.has(id)) {
        spawnMarkers.removeMarker(id);
      }
    }

    // Add/update markers
    for (const spawn of spawns) {
      const existing = spawnMarkers.getMarker(spawn.id);
      if (existing) {
        spawnMarkers.updateMarker(spawn.id, spawn);
      } else {
        spawnMarkers.addMarker(spawn);
        managersRef.current.multiSelect?.registerSelectable(spawn.id, spawnMarkers.getMarker(spawn.id)!.mesh);
      }
    }
  }, [state.coordinates]);

  /**
   * Update waypoint paths
   */
  useEffect(() => {
    if (!managersRef.current.waypoints) return;

    for (const path of state.waypointPaths) {
      managersRef.current.waypoints.updatePath(path.id, path);
    }
  }, [state.waypointPaths]);

  /**
   * Handle tool change
   */
  useEffect(() => {
    const { transform, raycaster } = managersRef.current;

    if (activeTool === 'move') {
      transform?.setEnabled(true);
      transform?.setMode('translate');
    } else {
      transform?.setEnabled(false);
      transform?.detach();
    }
  }, [activeTool]);

  /**
   * Update TileManager when collision data changes
   * This feeds the data sources for dynamic tile loading
   */
  useEffect(() => {
    if (!managersRef.current.tileManager) return;

    const tm = managersRef.current.tileManager;

    // Update data sources
    tm.setVMapData(state.vmapData);
    tm.setMMapData(state.mmapData);
    tm.setMapData(state.mapData);

    if (state.vmapData || state.mmapData || state.mapData) {
      console.log('[MapView3D] TileManager data updated:', {
        vmap: state.vmapData ? `${state.vmapData.tiles.size} tiles` : 'none',
        mmap: state.mmapData ? `${state.mmapData.tiles.size} tiles` : 'none',
        map: state.mapData ? `${state.mapData.tiles.size} tiles` : 'none',
      });

      // Debug: log available tile keys to verify key format
      tm.debugLogAvailableTiles();

      // Force load tiles, then log bounds (don't auto-focus - let terrain control camera)
      tm.forceLoadAllTiles(16).then(() => {
        console.log('[MapView3D] TileManager: Initial tiles loaded');
        const stats = tm.getStats();
        console.log('[MapView3D] TileManager stats:', stats);

        // Log tile content bounds for debugging
        const bounds = tm.getBounds();
        if (bounds) {
          const center = bounds.getCenter(new THREE.Vector3());
          const size = bounds.getSize(new THREE.Vector3());
          console.log('[MapView3D] TileManager content bounds:', {
            center: { x: center.x.toFixed(0), y: center.y.toFixed(0), z: center.z.toFixed(0) },
            size: { x: size.x.toFixed(0), y: size.y.toFixed(0), z: size.z.toFixed(0) },
          });

          // Only focus on models if NO terrain is loaded
          // This prevents camera jumping away from terrain when models load
          if (!state.mapData && managersRef.current.controls) {
            const maxDim = Math.max(size.x, size.y, size.z);
            const viewDistance = Math.max(500, maxDim * 0.5);
            managersRef.current.controls.focusOn(center.x, center.y, center.z, viewDistance);
          }
        }
      });
    }
  }, [state.vmapData, state.mmapData, state.mapData]);

  /**
   * Respond to focus position changes from 2D map or external sources
   * This enables 2D/3D map synchronization
   */
  useEffect(() => {
    if (!state.focusPosition || !managersRef.current.controls) return;

    // Only respond to focus changes that didn't originate from 3D view
    if (state.focusPosition.source === '3d') return;

    const { x, y, z } = state.focusPosition;

    // Convert WoW coordinates to Three.js coordinates
    // WoW: X = East/West, Y = North/South, Z = Height
    // Three.js: X = Right, Y = Up, Z = Towards camera
    const threeX = x;
    const threeY = z;  // WoW Z (height) -> Three.js Y
    const threeZ = -y; // WoW Y -> Three.js -Z

    console.log('[MapView3D] Focusing on position from', state.focusPosition.source, {
      wow: { x, y, z },
      three: { x: threeX, y: threeY, z: threeZ },
    });

    // Focus camera on the position with a reasonable viewing distance
    managersRef.current.controls.focusOn(threeX, threeY, threeZ, 300);
  }, [state.focusPosition]);

  return (
    <div className="relative" style={{ width, height }}>
      {/* Debug info panel - ALWAYS visible for debugging */}
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-red-900/95 backdrop-blur border-2 border-yellow-500 rounded-lg p-3 z-[100] min-w-[300px]">
        <div className="text-xs text-white space-y-1">
          <div className="font-bold mb-2 text-yellow-400 text-center">🔧 3D View Debug</div>
          <div className="grid grid-cols-2 gap-x-4">
            <div>Initialized: {isInitialized ? '✅ Yes' : '❌ No'}</div>
            <div>Map ID: {state.selectedMap}</div>
            <div>VMap: {state.vmapData ? `✅ ${state.vmapData.tiles.size}t/${state.vmapData.allSpawns.length}s` : '❌ null'}</div>
            <div>MMap: {state.mmapData ? `✅ ${state.mmapData.tiles.size}t` : '❌ null'}</div>
            <div>MapData: {state.mapData ? `✅ ${state.mapData.tiles.size}t` : '❌ null'}</div>
            <div>Coords: {state.coordinates.length}</div>
            <div>FPS: {fps}</div>
            <div>Tool: {activeTool}</div>
          </div>
          {state.vmapData && (
            <div className="mt-2 text-green-400">
              VMap spawns: {state.vmapData.allSpawns.length}, tiles: {state.vmapData.tiles.size}
              {!vmapModelsLoaded && (
                <button
                  onClick={loadVMapModels}
                  disabled={vmapModelsLoading}
                  className="ml-2 px-2 py-1 text-xs bg-blue-600 hover:bg-blue-500 disabled:bg-slate-600 rounded"
                >
                  {vmapModelsLoading ? 'Loading...' : 'Load Models'}
                </button>
              )}
              {vmapModelsLoaded && <span className="ml-2 text-green-300">Models loaded ✓</span>}
            </div>
          )}
          {state.mmapData && (
            <div className="mt-1 text-blue-400">
              MMap tiles: {state.mmapData.tiles.size}
            </div>
          )}
          {/* Dynamic Tile Loading Stats */}
          {tileStats && (
            <div className="mt-2 pt-2 border-t border-slate-600">
              <div className="text-cyan-400 font-semibold">Dynamic Tiles</div>
              <div className="grid grid-cols-2 gap-x-4 mt-1">
                <div>Loaded: {tileStats.loadedTileCount}</div>
                <div>Triangles: {tileStats.totalTriangles.toLocaleString()}</div>
                <div>Tile: ({tileStats.currentTileX}, {tileStats.currentTileY})</div>
                <div>Pending: {tileStats.pendingLoads}</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Canvas must always be in DOM for initialization to work */}
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
          visibility: isInitialized ? 'visible' : 'hidden'
        }}
      />

      {/* Loading overlay - shown while initializing */}
      {!isInitialized && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
          <div className="text-center">
            <div className="text-4xl mb-4">⚡</div>
            <p className="text-slate-400">Initializing 3D Renderer...</p>
          </div>
        </div>
      )}

      {/* Only show controls when initialized */}
      {isInitialized && (
        <>
          {/* Tool selector */}
          <div className="absolute top-4 left-4 bg-slate-800/90 backdrop-blur border border-slate-600 rounded-lg p-2 flex gap-2">
            {(['navigate', 'spawn', 'select', 'move', 'measure'] as ActiveTool[]).map(tool => (
              <button
                key={tool}
                onClick={() => setActiveTool(tool)}
                className={`px-3 py-2 rounded text-sm capitalize ${
                  activeTool === tool
                    ? 'bg-blue-500 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                {tool}
              </button>
            ))}
          </div>

          {/* Performance Dashboard */}
          <PerformanceDashboard position="bottom-left" compact={false} />

          {/* Time of Day Control */}
          <TimeOfDayControl
            currentTime={currentTime}
            onTimeChange={(time) => managersRef.current.timeOfDay?.setTime(time)}
            autoProgress={autoProgress}
            onAutoProgressChange={(enabled) => {
              setAutoProgress(enabled);
              managersRef.current.timeOfDay?.setAutoProgress(enabled);
            }}
            timeSpeed={timeSpeed}
            onTimeSpeedChange={(speed) => {
              setTimeSpeed(speed);
              managersRef.current.timeOfDay?.setTimeSpeed(speed);
            }}
            position="top-right"
          />

          {/* Controls help */}
          <div className="absolute bottom-4 right-4 bg-slate-800/90 backdrop-blur border border-slate-600 rounded-lg p-3">
            <div className="text-xs text-slate-300 space-y-1">
              <div className="font-semibold mb-2">Controls</div>
              <div>WASD + QE: Move camera</div>
              <div>Left Drag: Rotate view</div>
              <div>Right Drag: Pan view</div>
              <div>Scroll: Zoom</div>
              <div>Shift: Sprint mode</div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
