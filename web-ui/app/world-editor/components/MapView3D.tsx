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
import { MMapMeshLoader } from '@/lib/three/mmap-mesh-loader';
import { SpawnMarkerManager } from '@/lib/three/spawn-marker-manager';
import { RaycasterManager } from '@/lib/three/raycaster-manager';
import { SyncManager } from '@/lib/three/sync-manager';
import { HighlightManager } from '@/lib/three/highlight-manager';
import { TransformControlsWrapper } from '@/lib/three/transform-controls-wrapper';
import { MultiSelectManager } from '@/lib/three/multi-select-manager';
import { WaypointVisualizer } from '@/lib/three/waypoint-visualizer';
import { RoadEditor } from '@/lib/three/road-editor';
import { MeasurementTools } from '@/lib/three/measurement-tools';

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
    vmapLoader?: VMapMeshLoader;
    mmapLoader?: MMapMeshLoader;
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
  }>({});

  // UI state
  const [activeTool, setActiveTool] = useState<ActiveTool>('spawn');
  const [fps, setFps] = useState(60);
  const [isInitialized, setIsInitialized] = useState(false);

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
        shadows: true,
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
        shadowsEnabled: true,
        shadowMapSize: 2048,
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

      const vmapLoader = new VMapMeshLoader({
        heightColors: true,
        wireframe: false,
        opacity: 0.8,
      });

      const mmapLoader = new MMapMeshLoader({
        wireframe: true,
        opacity: 0.5,
        colorByWalkability: true,
      });

      // Store in ref
      managersRef.current = {
        scene,
        controls,
        lighting,
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
        mmapLoader,
        terrainGroup: new THREE.Group(),
      };

      // Setup event listeners
      setupEventListeners();

      // Enable controls
      controls.enable();
      raycaster.enable();

      // Start animation
      scene.on('update', (data: { delta: number }) => {
        controls.update(data.delta);
        highlight.update(data.delta);
        waypoints.update(data.delta);

        // Update FPS
        const stats = scene.getStats();
        setFps(stats.fps);
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
      m.mmapLoader?.dispose();
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
   * Load VMap mesh when data changes
   */
  useEffect(() => {
    if (!state.vmapData || !managersRef.current.scene || !managersRef.current.vmapLoader) return;

    console.log('[MapView3D] Loading VMap mesh...');

    try {
      const result = managersRef.current.vmapLoader.load(state.vmapData);
      result.group.userData.isTerrain = true;

      if (managersRef.current.terrainGroup) {
        managersRef.current.scene.remove(managersRef.current.terrainGroup);
      }

      managersRef.current.terrainGroup = result.group;
      managersRef.current.scene.add(result.group);
      managersRef.current.raycaster?.setTerrainLayer(result.group);

      console.log('[MapView3D] VMap loaded:', result.triangleCount, 'triangles');
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
    } catch (error) {
      console.error('[MapView3D] Error loading MMap:', error);
    }
  }, [state.mmapData]);

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

  if (!isInitialized) {
    return (
      <div className="relative flex items-center justify-center bg-slate-900" style={{ width, height }}>
        <div className="text-center">
          <div className="text-4xl mb-4">⚡</div>
          <p className="text-slate-400">Initializing 3D Renderer...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative" style={{ width, height }}>
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block' }}
      />

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

      {/* Stats */}
      <div className="absolute bottom-4 left-4 bg-slate-800/90 backdrop-blur border border-slate-600 rounded-lg p-3">
        <div className="text-xs text-slate-300 space-y-1">
          <div>FPS: {fps}</div>
          <div>Spawns: {state.coordinates.filter(c => c.type === 'spawn').length}</div>
          <div>Selected: {state.selectedItems.size}</div>
          <div className={state.vmapData ? 'text-green-400' : 'text-slate-500'}>
            VMap: {state.vmapData ? '✓' : '✗'}
          </div>
          <div className={state.mmapData ? 'text-green-400' : 'text-slate-500'}>
            MMap: {state.mmapData ? '✓' : '✗'}
          </div>
        </div>
      </div>

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
    </div>
  );
}
