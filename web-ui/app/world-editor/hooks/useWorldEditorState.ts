/**
 * World Editor Shared State Management
 *
 * Manages shared state between 2D map view and 3D viewer,
 * including spawns, collision data, selection, and camera state.
 */

import { useState, useCallback } from 'react';
import type { MapCoordinate, Road, ZoneTransition, WaypointPath } from '@/lib/map-editor';
import type { VMapData } from '@/lib/vmap-types';
import type { MMapData } from '@/lib/mmap-types';
import type { MapDataCollection } from '@/lib/map-parser';
import type { Layer, Measurement, Annotation } from '@/lib/map-editor-enhanced';

export type ViewMode = 'split' | 'tabbed' | 'pip';
export type ActiveView = '2d' | '3d';

export interface Camera2DState {
  offset: { x: number; y: number };
  scale: number;
}

export interface Camera3DState {
  position: { x: number; y: number; z: number };
  target: { x: number; y: number; z: number };
  fov: number;
}

/**
 * Shared focus position between 2D and 3D views
 * Uses WoW world coordinates (X = East/West, Y = North/South, Z = Height)
 */
export interface FocusPosition {
  x: number;  // WoW X (East/West)
  y: number;  // WoW Y (North/South)
  z: number;  // WoW Z (Height)
  source: '2d' | '3d' | 'external';  // Which view triggered the focus
}

export interface WorldEditorState {
  // Map and data
  selectedMap: number;
  mapImage: HTMLImageElement | null;
  coordinates: MapCoordinate[];
  roads: Road[];
  transitions: ZoneTransition[];
  waypointPaths: WaypointPath[];
  annotations: Annotation[];
  measurements: Measurement[];

  // Collision data
  vmapData: VMapData | null;
  mmapData: MMapData | null;
  mapData: MapDataCollection | null;
  collisionDataStatus: {
    vmap: 'none' | 'loading' | 'loaded' | 'error';
    mmap: 'none' | 'loading' | 'loaded' | 'error';
    map: 'none' | 'loading' | 'loaded' | 'error';
    message?: string;
  };

  // Editor state
  selectedItems: Set<string>;
  layers: Layer[];
  autoDetectHeight: boolean;

  // View state
  viewMode: ViewMode;
  activeView: ActiveView;
  camera2D: Camera2DState;
  camera3D: Camera3DState;
  focusPosition: FocusPosition | null;  // Shared focus point for 2D/3D sync

  // UI state
  showGrid: boolean;
  gridSize: number;
  snapToGridEnabled: boolean;
}

export interface WorldEditorActions {
  // Map actions
  setSelectedMap: (mapId: number) => void;
  setMapImage: (image: HTMLImageElement | null) => void;

  // Coordinate actions
  addCoordinate: (coord: MapCoordinate) => void;
  updateCoordinate: (id: string, updates: Partial<MapCoordinate>) => void;
  removeCoordinate: (id: string) => void;
  deleteCoordinate: (id: string) => void;  // Alias for removeCoordinate
  setCoordinates: (coords: MapCoordinate[]) => void;

  // Road actions
  addRoad: (road: Road) => void;
  updateRoad: (id: string, updates: Partial<Road>) => void;
  removeRoad: (id: string) => void;
  setRoads: (roads: Road[]) => void;

  // Waypoint actions
  addWaypointPath: (path: WaypointPath) => void;
  updateWaypointPath: (id: string, updates: Partial<WaypointPath>) => void;
  removeWaypointPath: (id: string) => void;
  setWaypointPaths: (paths: WaypointPath[]) => void;

  // Transition actions
  addTransition: (transition: ZoneTransition) => void;
  updateTransition: (id: string, updates: Partial<ZoneTransition>) => void;
  removeTransition: (id: string) => void;
  setTransitions: (transitions: ZoneTransition[]) => void;

  // Collision data actions
  setVMapData: (data: VMapData | null) => void;
  setMMapData: (data: MMapData | null) => void;
  setMapData: (data: MapDataCollection | null) => void;
  setCollisionDataStatus: (status: WorldEditorState['collisionDataStatus']) => void;

  // Selection actions
  selectItem: (id: string) => void;
  deselectItem: (id: string) => void;
  toggleSelection: (id: string) => void;
  clearSelection: () => void;
  setSelectedItems: (items: Set<string>) => void;

  // Layer actions
  setLayers: (layers: Layer[]) => void;
  updateLayer: (id: string, updates: Partial<Layer>) => void;

  // View actions
  setViewMode: (mode: ViewMode) => void;
  setActiveView: (view: ActiveView) => void;
  setCamera2D: (camera: Camera2DState) => void;
  setCamera3D: (camera: Camera3DState) => void;
  setFocusPosition: (position: FocusPosition | null) => void;
  focusOnWowCoords: (x: number, y: number, z: number, source: '2d' | '3d' | 'external') => void;

  // Settings actions
  setAutoDetectHeight: (enabled: boolean) => void;
  setShowGrid: (show: boolean) => void;
  setGridSize: (size: number) => void;
  setSnapToGridEnabled: (enabled: boolean) => void;
}

const DEFAULT_LAYERS: Layer[] = [
  { id: 'spawns', name: 'Spawns', visible: true, locked: false, opacity: 1, type: 'spawns' },
  { id: 'roads', name: 'Roads', visible: true, locked: false, opacity: 1, type: 'roads' },
  { id: 'waypoints', name: 'Waypoints', visible: true, locked: false, opacity: 1, type: 'waypoints' },
  { id: 'transitions', name: 'Transitions', visible: true, locked: false, opacity: 1, type: 'transitions' },
  { id: 'annotations', name: 'Annotations', visible: true, locked: false, opacity: 1, type: 'annotations' },
];

export function useWorldEditorState(): [WorldEditorState, WorldEditorActions] {
  // State
  const [selectedMap, setSelectedMap] = useState(58441); // Default to Azeroth (Retail 11.x)
  const [mapImage, setMapImage] = useState<HTMLImageElement | null>(null);
  const [coordinates, setCoordinates] = useState<MapCoordinate[]>([]);
  const [roads, setRoads] = useState<Road[]>([]);
  const [transitions, setTransitions] = useState<ZoneTransition[]>([]);
  const [waypointPaths, setWaypointPaths] = useState<WaypointPath[]>([]);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);

  const [vmapData, setVMapData] = useState<VMapData | null>(null);
  const [mmapData, setMMapData] = useState<MMapData | null>(null);
  const [mapData, setMapData] = useState<MapDataCollection | null>(null);
  const [collisionDataStatus, setCollisionDataStatus] = useState<WorldEditorState['collisionDataStatus']>({
    vmap: 'none',
    mmap: 'none',
    map: 'none',
  });

  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [layers, setLayers] = useState<Layer[]>(DEFAULT_LAYERS);
  const [autoDetectHeight, setAutoDetectHeight] = useState(true);

  const [viewMode, setViewMode] = useState<ViewMode>('split');
  const [activeView, setActiveView] = useState<ActiveView>('2d');
  const [camera2D, setCamera2D] = useState<Camera2DState>({
    offset: { x: 0, y: 0 },
    scale: 1,
  });
  const [camera3D, setCamera3D] = useState<Camera3DState>({
    position: { x: 0, y: 100, z: 0 },
    target: { x: 0, y: 0, z: 0 },
    fov: 75,
  });
  const [focusPosition, setFocusPosition] = useState<FocusPosition | null>(null);

  const [showGrid, setShowGrid] = useState(true);
  const [gridSize, setGridSize] = useState(10);
  const [snapToGridEnabled, setSnapToGridEnabled] = useState(false);

  // Actions
  const addCoordinate = useCallback((coord: MapCoordinate) => {
    setCoordinates(prev => [...prev, coord]);
  }, []);

  const updateCoordinate = useCallback((id: string, updates: Partial<MapCoordinate>) => {
    setCoordinates(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
  }, []);

  const removeCoordinate = useCallback((id: string) => {
    setCoordinates(prev => prev.filter(c => c.id !== id));
  }, []);

  const addRoad = useCallback((road: Road) => {
    setRoads(prev => [...prev, road]);
  }, []);

  const updateRoad = useCallback((id: string, updates: Partial<Road>) => {
    setRoads(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
  }, []);

  const removeRoad = useCallback((id: string) => {
    setRoads(prev => prev.filter(r => r.id !== id));
  }, []);

  const addWaypointPath = useCallback((path: WaypointPath) => {
    setWaypointPaths(prev => [...prev, path]);
  }, []);

  const updateWaypointPath = useCallback((id: string, updates: Partial<WaypointPath>) => {
    setWaypointPaths(prev => prev.map(w => w.id === id ? { ...w, ...updates } : w));
  }, []);

  const removeWaypointPath = useCallback((id: string) => {
    setWaypointPaths(prev => prev.filter(w => w.id !== id));
  }, []);

  const addTransition = useCallback((transition: ZoneTransition) => {
    setTransitions(prev => [...prev, transition]);
  }, []);

  const updateTransition = useCallback((id: string, updates: Partial<ZoneTransition>) => {
    setTransitions(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  }, []);

  const removeTransition = useCallback((id: string) => {
    setTransitions(prev => prev.filter(t => t.id !== id));
  }, []);

  const selectItem = useCallback((id: string) => {
    setSelectedItems(prev => new Set(prev).add(id));
  }, []);

  const deselectItem = useCallback((id: string) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      newSet.delete(id);
      return newSet;
    });
  }, []);

  const toggleSelection = useCallback((id: string) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedItems(new Set());
  }, []);

  const updateLayer = useCallback((id: string, updates: Partial<Layer>) => {
    setLayers(prev => prev.map(l => l.id === id ? { ...l, ...updates } : l));
  }, []);

  // Focus action - sets a shared focus position that both 2D and 3D views can respond to
  const focusOnWowCoords = useCallback((x: number, y: number, z: number, source: '2d' | '3d' | 'external') => {
    setFocusPosition({ x, y, z, source });
  }, []);

  const state: WorldEditorState = {
    selectedMap,
    mapImage,
    coordinates,
    roads,
    transitions,
    waypointPaths,
    annotations,
    measurements,
    vmapData,
    mmapData,
    mapData,
    collisionDataStatus,
    selectedItems,
    layers,
    autoDetectHeight,
    viewMode,
    activeView,
    camera2D,
    camera3D,
    focusPosition,
    showGrid,
    gridSize,
    snapToGridEnabled,
  };

  const actions: WorldEditorActions = {
    setSelectedMap,
    setMapImage,
    addCoordinate,
    updateCoordinate,
    removeCoordinate,
    deleteCoordinate: removeCoordinate,  // Alias
    setCoordinates,
    addRoad,
    updateRoad,
    removeRoad,
    setRoads,
    addWaypointPath,
    updateWaypointPath,
    removeWaypointPath,
    setWaypointPaths,
    addTransition,
    updateTransition,
    removeTransition,
    setTransitions,
    setVMapData,
    setMMapData,
    setMapData,
    setCollisionDataStatus,
    selectItem,
    deselectItem,
    toggleSelection,
    clearSelection,
    setSelectedItems,
    setLayers,
    updateLayer,
    setViewMode,
    setActiveView,
    setCamera2D,
    setCamera3D,
    setFocusPosition,
    focusOnWowCoords,
    setAutoDetectHeight,
    setShowGrid,
    setGridSize,
    setSnapToGridEnabled,
  };

  return [state, actions];
}
