'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Map,
  Plus,
  Download,
  Upload,
  Save,
  Trash2,
  Move,
  Waypoints,
  Route,
  Link,
  MapPin,
  ZoomIn,
  ZoomOut,
  Undo2,
  Redo2,
  Copy,
  Scissors,
  Clipboard,
  Search,
  Ruler,
  Navigation,
  Grid3x3,
  Layers,
  AlertCircle,
  CheckCircle,
  Info,
  Settings,
  Keyboard,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  MapCoordinate,
  Road,
  ZoneTransition,
  WaypointPath,
  generateSpawnSQL,
  generateWaypointSQL,
  generateZoneTransitionSQL,
  exportMapData,
  importMapData,
  simplifyPath,
  canvasToWow,
  wowToCanvas,
  WoWMaps,
  loadMapImage,
} from '@/lib/map-editor';
import type { VMapData } from '@/lib/vmap-types';
import type { MMapData } from '@/lib/mmap-types';
import { parseVMapTree, parseVMapTile, loadVMapData } from '@/lib/vmap-parser';
import { parseMMapHeader, parseMMapTile, loadMMapData } from '@/lib/mmap-parser';
import { getHeightAtPosition } from '@/lib/height-query';
import { useAutoLoadCollisionData } from '@/lib/hooks/useAutoLoadCollisionData';
import {
  HistoryManager,
  EditorState,
  Layer,
  Measurement,
  Annotation,
  snapToGrid,
  measureDistance,
  measureArea,
  findPath,
  detectRoadIntersections,
  snapToRoad,
  smoothPath,
  validateMap,
  selectInRectangle,
  translateItems,
  rotateItems,
  scaleItems,
  exportToKML,
  exportToGeoJSON,
  DEFAULT_SHORTCUTS,
  matchesShortcut,
} from '@/lib/map-editor-enhanced';

type Tool =
  | 'select'
  | 'spawn'
  | 'waypoint'
  | 'road'
  | 'transition'
  | 'measure-distance'
  | 'measure-area'
  | 'annotate'
  | 'pathfind';

export default function EnhancedMapPickerPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const historyManager = useRef(new HistoryManager());

  // Map state
  const [selectedMap, setSelectedMap] = useState(0); // Default to Eastern Kingdoms
  const [availableMaps] = useState(() => Object.values(WoWMaps));
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [isLoadingMap, setIsLoadingMap] = useState(false);

  // Editor state
  const [currentTool, setCurrentTool] = useState<Tool>('select');
  const [coordinates, setCoordinates] = useState<MapCoordinate[]>([]);
  const [roads, setRoads] = useState<Road[]>([]);
  const [transitions, setTransitions] = useState<ZoneTransition[]>([]);
  const [waypointPaths, setWaypointPaths] = useState<WaypointPath[]>([]);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [layers, setLayers] = useState<Layer[]>([
    { id: 'spawns', name: 'Spawns', visible: true, locked: false, opacity: 1, type: 'spawns' },
    { id: 'roads', name: 'Roads', visible: true, locked: false, opacity: 1, type: 'roads' },
    { id: 'waypoints', name: 'Waypoints', visible: true, locked: false, opacity: 1, type: 'waypoints' },
    { id: 'transitions', name: 'Transitions', visible: true, locked: false, opacity: 1, type: 'transitions' },
    { id: 'annotations', name: 'Annotations', visible: true, locked: false, opacity: 1, type: 'annotations' },
  ]);

  // Drawing state
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPath, setCurrentPath] = useState<Array<{ x: number; y: number }>>([]);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [mapImage, setMapImage] = useState<HTMLImageElement | null>(null);
  const [selectionRect, setSelectionRect] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [clipboard, setClipboard] = useState<any>(null);

  // Settings
  const [gridSize, setGridSize] = useState(10);
  const [snapToGridEnabled, setSnapToGridEnabled] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [showMinimap, setShowMinimap] = useState(true);
  const [showIntersections, setShowIntersections] = useState(false);
  const [showCoordinates, setShowCoordinates] = useState(true);
  const [mouseCoords, setMouseCoords] = useState({ x: 0, y: 0, z: 0 });

  // Search and validation
  const [searchQuery, setSearchQuery] = useState('');
  const [validationIssues, setValidationIssues] = useState<any[]>([]);

  // VMap/MMap collision data
  const [vmapData, setVmapData] = useState<VMapData | null>(null);
  const [mmapData, setMmapData] = useState<MMapData | null>(null);
  const [collisionDataStatus, setCollisionDataStatus] = useState<{
    vmap: 'none' | 'loading' | 'loaded' | 'error';
    mmap: 'none' | 'loading' | 'loaded' | 'error';
    message?: string;
  }>({ vmap: 'none', mmap: 'none' });
  const [autoDetectHeight, setAutoDetectHeight] = useState(true);

  const CANVAS_WIDTH = 1200;
  const CANVAS_HEIGHT = 800;

  // Auto-load collision data from configured paths
  const autoLoadResult = useAutoLoadCollisionData(selectedMap, {
    autoLoad: true,
    maxTiles: 100,
    verbose: false,
  });

  // Update collision data when auto-load completes
  useEffect(() => {
    if (autoLoadResult.vmap && !vmapData) {
      setVmapData(autoLoadResult.vmap);
    }
    if (autoLoadResult.mmap && !mmapData) {
      setMmapData(autoLoadResult.mmap);
    }

    // Update status
    setCollisionDataStatus({
      vmap: autoLoadResult.status.vmap === 'loaded' ? 'loaded' :
            autoLoadResult.status.vmap === 'loading' ? 'loading' :
            autoLoadResult.status.vmap === 'error' ? 'error' : 'none',
      mmap: autoLoadResult.status.mmap === 'loaded' ? 'loaded' :
            autoLoadResult.status.mmap === 'loading' ? 'loading' :
            autoLoadResult.status.mmap === 'error' ? 'error' : 'none',
      message: autoLoadResult.status.vmapMessage || autoLoadResult.status.mmapMessage,
    });
  }, [autoLoadResult.vmap, autoLoadResult.mmap, autoLoadResult.status]);

  // Get current editor state
  const getEditorState = useCallback(
    (): EditorState => ({
      coordinates,
      roads,
      transitions,
      waypointPaths,
      annotations,
      measurements,
      layers,
      selectedItems,
    }),
    [coordinates, roads, transitions, waypointPaths, annotations, measurements, layers, selectedItems]
  );

  // Save state to history
  const saveState = useCallback(
    (description: string) => {
      historyManager.current.pushState(getEditorState(), description);
    },
    [getEditorState]
  );

  // Undo/redo handlers
  const handleUndo = useCallback(() => {
    const state = historyManager.current.undo();
    if (state) {
      setCoordinates(state.coordinates);
      setRoads(state.roads);
      setTransitions(state.transitions);
      setWaypointPaths(state.waypointPaths);
      setAnnotations(state.annotations);
      setMeasurements(state.measurements);
      setLayers(state.layers);
      setSelectedItems(state.selectedItems);
    }
  }, []);

  const handleRedo = useCallback(() => {
    const state = historyManager.current.redo();
    if (state) {
      setCoordinates(state.coordinates);
      setRoads(state.roads);
      setTransitions(state.transitions);
      setWaypointPaths(state.waypointPaths);
      setAnnotations(state.annotations);
      setMeasurements(state.measurements);
      setLayers(state.layers);
      setSelectedItems(state.selectedItems);
    }
  }, []);

  // Load map image when selected map changes
  useEffect(() => {
    const loadMap = async () => {
      setIsLoadingMap(true);
      try {
        const img = await loadMapImage(selectedMap);
        setMapImage(img);
      } catch (error) {
        console.error('Failed to load map:', error);
        setMapImage(null);
      } finally {
        setIsLoadingMap(false);
      }
    };
    loadMap();
  }, [selectedMap]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for shortcuts
      for (const shortcut of DEFAULT_SHORTCUTS) {
        if (matchesShortcut(e, shortcut)) {
          e.preventDefault();
          handleShortcut(shortcut.action);
          return;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedItems, clipboard]);

  const handleShortcut = (action: string) => {
    switch (action) {
      case 'undo':
        handleUndo();
        break;
      case 'redo':
        handleRedo();
        break;
      case 'copy':
        handleCopy();
        break;
      case 'paste':
        handlePaste();
        break;
      case 'cut':
        handleCut();
        break;
      case 'delete':
        handleDelete();
        break;
      case 'select-all':
        handleSelectAll();
        break;
      case 'deselect':
        setSelectedItems(new Set());
        break;
      case 'spawn-tool':
        setCurrentTool('spawn');
        break;
      case 'road-tool':
        setCurrentTool('road');
        break;
      case 'waypoint-tool':
        setCurrentTool('waypoint');
        break;
      case 'transition-tool':
        setCurrentTool('transition');
        break;
      case 'measure-tool':
        setCurrentTool('measure-distance');
        break;
      case 'toggle-grid':
        setShowGrid(!showGrid);
        break;
      case 'zoom-in':
        setScale(Math.min(5, scale * 1.2));
        break;
      case 'zoom-out':
        setScale(Math.max(0.1, scale / 1.2));
        break;
      case 'zoom-reset':
        setScale(1);
        setOffset({ x: 0, y: 0 });
        break;
    }
  };

  // Copy/paste/cut handlers
  const handleCopy = () => {
    const selected = {
      coordinates: coordinates.filter(c => selectedItems.has(c.id)),
      roads: roads.filter(r => selectedItems.has(r.id)),
      transitions: transitions.filter(t => selectedItems.has(t.id)),
      waypointPaths: waypointPaths.filter(w => selectedItems.has(w.id)),
    };
    setClipboard(selected);
  };

  const handlePaste = () => {
    if (!clipboard) return;

    saveState('Paste items');

    const offset = { x: 50, y: 50 };

    const newCoordinates = clipboard.coordinates.map((c: MapCoordinate) => ({
      ...c,
      id: `spawn-${Date.now()}-${Math.random()}`,
      x: c.x + offset.x,
      y: c.y + offset.y,
    }));

    const newRoads = clipboard.roads.map((r: Road) => ({
      ...r,
      id: `road-${Date.now()}-${Math.random()}`,
      points: r.points.map(p => ({ x: p.x + offset.x, y: p.y + offset.y })),
    }));

    setCoordinates([...coordinates, ...newCoordinates]);
    setRoads([...roads, ...newRoads]);
  };

  const handleCut = () => {
    handleCopy();
    handleDelete();
  };

  const handleDelete = () => {
    if (selectedItems.size === 0) return;

    saveState('Delete items');

    setCoordinates(coordinates.filter(c => !selectedItems.has(c.id)));
    setRoads(roads.filter(r => !selectedItems.has(r.id)));
    setTransitions(transitions.filter(t => !selectedItems.has(t.id)));
    setWaypointPaths(waypointPaths.filter(w => !selectedItems.has(w.id)));
    setSelectedItems(new Set());
  };

  const handleSelectAll = () => {
    const allIds = new Set([
      ...coordinates.map(c => c.id),
      ...roads.map(r => r.id),
      ...transitions.map(t => t.id),
      ...waypointPaths.map(w => w.id),
    ]);
    setSelectedItems(allIds);
  };

  // Draw everything on canvas
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    ctx.save();
    ctx.translate(offset.x, offset.y);
    ctx.scale(scale, scale);

    // Draw background map image if available
    if (mapImage) {
      ctx.globalAlpha = 0.8; // Make map slightly transparent so overlays are visible
      ctx.drawImage(mapImage, 0, 0, CANVAS_WIDTH / scale, CANVAS_HEIGHT / scale);
      ctx.globalAlpha = 1.0;
    } else {
      // Draw "no map loaded" message
      ctx.fillStyle = '#475569';
      ctx.font = `${20 / scale}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('No Map Image Available', CANVAS_WIDTH / (2 * scale), CANVAS_HEIGHT / (2 * scale) - 50 / scale);
      ctx.fillStyle = '#64748b';
      ctx.font = `${14 / scale}px sans-serif`;
      ctx.fillText('Map will use WoW coordinate system without visual background', CANVAS_WIDTH / (2 * scale), CANVAS_HEIGHT / (2 * scale) - 20 / scale);
      ctx.fillText('You can still place coordinates and export SQL', CANVAS_WIDTH / (2 * scale), CANVAS_HEIGHT / (2 * scale) + 5 / scale);
      ctx.fillText('Upload a custom map image using the button in the left panel', CANVAS_WIDTH / (2 * scale), CANVAS_HEIGHT / (2 * scale) + 30 / scale);
      ctx.textAlign = 'left';
    }

    // Draw grid
    if (showGrid) {
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1 / scale;
      for (let i = 0; i <= 20; i++) {
        const x = (i * CANVAS_WIDTH) / 20 / scale;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, CANVAS_HEIGHT / scale);
        ctx.stroke();
      }
      for (let i = 0; i <= 20; i++) {
        const y = (i * CANVAS_HEIGHT) / 20 / scale;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(CANVAS_WIDTH / scale, y);
        ctx.stroke();
      }
    }

    // Draw roads
    const roadsLayer = layers.find(l => l.id === 'roads');
    if (roadsLayer?.visible) {
      ctx.globalAlpha = roadsLayer.opacity;
      roads.forEach(road => {
        const isSelected = selectedItems.has(road.id);
        ctx.strokeStyle = isSelected ? '#60a5fa' : '#fbbf24';
        ctx.lineWidth = (road.width / scale) * (isSelected ? 1.5 : 1);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        road.points.forEach((point, i) => {
          if (i === 0) ctx.moveTo(point.x, point.y);
          else ctx.lineTo(point.x, point.y);
        });
        ctx.stroke();

        // Draw road name
        if (road.points.length > 0) {
          const midPoint = road.points[Math.floor(road.points.length / 2)];
          ctx.fillStyle = '#fff';
          ctx.font = `${10 / scale}px sans-serif`;
          ctx.fillText(road.name, midPoint.x, midPoint.y - 10 / scale);
        }
      });
      ctx.globalAlpha = 1;
    }

    // Draw waypoint paths
    const waypointsLayer = layers.find(l => l.id === 'waypoints');
    if (waypointsLayer?.visible) {
      ctx.globalAlpha = waypointsLayer.opacity;
      waypointPaths.forEach(path => {
        const isSelected = selectedItems.has(path.id);
        ctx.strokeStyle = isSelected ? '#a78bfa' : '#8b5cf6';
        ctx.lineWidth = (3 / scale) * (isSelected ? 1.5 : 1);
        ctx.setLineDash([5 / scale, 5 / scale]);
        ctx.beginPath();
        path.waypoints.forEach((wp, i) => {
          if (i === 0) ctx.moveTo(wp.x, wp.y);
          else ctx.lineTo(wp.x, wp.y);
        });
        ctx.stroke();
        ctx.setLineDash([]);

        // Draw waypoint circles
        path.waypoints.forEach((wp, idx) => {
          ctx.fillStyle = isSelected ? '#a78bfa' : '#8b5cf6';
          ctx.beginPath();
          ctx.arc(wp.x, wp.y, 4 / scale, 0, Math.PI * 2);
          ctx.fill();

          // Draw waypoint number
          ctx.fillStyle = '#fff';
          ctx.font = `${8 / scale}px sans-serif`;
          ctx.fillText(String(idx + 1), wp.x + 6 / scale, wp.y + 3 / scale);
        });
      });
      ctx.globalAlpha = 1;
    }

    // Draw current path being drawn
    if (isDrawing && currentPath.length > 0) {
      ctx.strokeStyle = currentTool === 'road' ? '#60a5fa' : '#a78bfa';
      ctx.lineWidth = 3 / scale;
      ctx.setLineDash([10 / scale, 5 / scale]);
      ctx.beginPath();
      currentPath.forEach((point, i) => {
        if (i === 0) ctx.moveTo(point.x, point.y);
        else ctx.lineTo(point.x, point.y);
      });
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Draw spawn points
    const spawnsLayer = layers.find(l => l.id === 'spawns');
    if (spawnsLayer?.visible) {
      ctx.globalAlpha = spawnsLayer.opacity;
      coordinates.forEach(coord => {
        if (coord.type === 'spawn') {
          // Convert WoW world coordinates to canvas coordinates for rendering
          const canvasPos = wowToCanvas(coord.x, coord.y, selectedMap, CANVAS_WIDTH / scale, CANVAS_HEIGHT / scale);

          const isSelected = selectedItems.has(coord.id);
          ctx.fillStyle = isSelected ? '#34d399' : '#10b981';
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = (2 / scale) * (isSelected ? 1.5 : 1);
          ctx.beginPath();
          ctx.arc(canvasPos.x, canvasPos.y, (8 / scale) * (isSelected ? 1.3 : 1), 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          // Draw label
          ctx.fillStyle = '#fff';
          ctx.font = `${12 / scale}px sans-serif`;
          ctx.fillText(coord.label || '', canvasPos.x + 12 / scale, canvasPos.y + 4 / scale);
        }
      });
      ctx.globalAlpha = 1;
    }

    // Draw zone transitions
    const transitionsLayer = layers.find(l => l.id === 'transitions');
    if (transitionsLayer?.visible) {
      ctx.globalAlpha = transitionsLayer.opacity;
      transitions.forEach(transition => {
        const isSelected = selectedItems.has(transition.id);
        ctx.fillStyle = isSelected ? '#f472b6' : '#ec4899';
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = (2 / scale) * (isSelected ? 1.5 : 1);
        ctx.fillRect(
          transition.entranceCoord.x - 10 / scale,
          transition.entranceCoord.y - 10 / scale,
          20 / scale,
          20 / scale
        );
        ctx.strokeRect(
          transition.entranceCoord.x - 10 / scale,
          transition.entranceCoord.y - 10 / scale,
          20 / scale,
          20 / scale
        );

        // Draw arrow
        ctx.strokeStyle = isSelected ? '#f472b6' : '#ec4899';
        ctx.lineWidth = 2 / scale;
        ctx.beginPath();
        ctx.moveTo(transition.entranceCoord.x, transition.entranceCoord.y);
        ctx.lineTo(transition.exitCoord.x, transition.exitCoord.y);
        ctx.stroke();
      });
      ctx.globalAlpha = 1;
    }

    // Draw measurements
    measurements.forEach(measurement => {
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 2 / scale;
      ctx.setLineDash([5 / scale, 5 / scale]);
      ctx.beginPath();
      measurement.points.forEach((point, i) => {
        if (i === 0) ctx.moveTo(point.x, point.y);
        else ctx.lineTo(point.x, point.y);
      });
      if (measurement.type === 'area' && measurement.points.length > 2) {
        ctx.closePath();
      }
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw result label
      if (measurement.points.length > 0) {
        const lastPoint = measurement.points[measurement.points.length - 1];
        ctx.fillStyle = '#fbbf24';
        ctx.font = `${12 / scale}px sans-serif`;
        ctx.fillText(measurement.label, lastPoint.x + 10 / scale, lastPoint.y);
      }
    });

    // Draw selection rectangle
    if (selectionRect) {
      ctx.strokeStyle = '#60a5fa';
      ctx.lineWidth = 2 / scale;
      ctx.setLineDash([5 / scale, 5 / scale]);
      ctx.strokeRect(selectionRect.x, selectionRect.y, selectionRect.width, selectionRect.height);
      ctx.setLineDash([]);
    }

    // Draw intersections
    if (showIntersections) {
      const intersections = detectRoadIntersections(roads);
      intersections.forEach(intersection => {
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(intersection.point.x, intersection.point.y, 6 / scale, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    ctx.restore();
  }, [
    scale,
    offset,
    coordinates,
    roads,
    transitions,
    waypointPaths,
    currentPath,
    isDrawing,
    mapImage,
    selectedItems,
    selectionRect,
    measurements,
    layers,
    showGrid,
    showIntersections,
    currentTool,
  ]);

  // Redraw on changes
  useEffect(() => {
    draw();
  }, [draw]);

  // Handle canvas click
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    let x = (e.clientX - rect.left - offset.x) / scale;
    let y = (e.clientY - rect.top - offset.y) / scale;

    // Apply snap to grid if enabled
    if (snapToGridEnabled) {
      const snapped = snapToGrid(x, y, gridSize, true);
      x = snapped.x;
      y = snapped.y;
    }

    switch (currentTool) {
      case 'spawn':
        addSpawnPoint(x, y);
        break;
      case 'waypoint':
      case 'road':
        addPathPoint(x, y);
        break;
      case 'transition':
        addTransition(x, y);
        break;
      case 'measure-distance':
      case 'measure-area':
        addMeasurementPoint(x, y);
        break;
    }
  };

  const addSpawnPoint = (canvasX: number, canvasY: number) => {
    saveState('Add spawn point');

    // Convert canvas coordinates to WoW world coordinates
    const wowCoords = canvasToWow(canvasX, canvasY, selectedMap, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Auto-detect height if enabled and collision data is available
    let z = 0;
    if (autoDetectHeight && (vmapData || mmapData)) {
      const heightResult = getHeightAtPosition(wowCoords.x, wowCoords.y, vmapData || undefined, mmapData || undefined, {
        preferVMap: true,
        searchRadius: 10.0,
        verbose: false,
      });

      if (heightResult.z !== null) {
        z = heightResult.z;
        console.log(`[MapPicker] Auto-detected height: ${z.toFixed(2)} (source: ${heightResult.source})`);
      } else {
        console.log(`[MapPicker] Could not detect height at (${wowCoords.x.toFixed(2)}, ${wowCoords.y.toFixed(2)})`);
      }
    }

    // Store WoW world coordinates (NOT canvas coordinates)
    // The drawing code will convert WoW -> canvas for rendering
    const newCoord: MapCoordinate = {
      id: `spawn-${Date.now()}`,
      x: wowCoords.x, // WoW world X coordinate
      y: wowCoords.y, // WoW world Y coordinate
      z,
      mapId: selectedMap,
      type: 'spawn',
      label: `Spawn ${coordinates.filter(c => c.type === 'spawn').length + 1}`,
    };
    setCoordinates([...coordinates, newCoord]);
  };

  const addPathPoint = (x: number, y: number) => {
    if (isDrawing) {
      setCurrentPath([...currentPath, { x, y }]);
    } else {
      setIsDrawing(true);
      setCurrentPath([{ x, y }]);
    }
  };

  const addTransition = (x: number, y: number) => {
    saveState('Add zone transition');

    const newTransition: ZoneTransition = {
      id: `transition-${Date.now()}`,
      fromZone: 'Zone A',
      toZone: 'Zone B',
      fromMapId: selectedMap,
      toMapId: selectedMap,
      entranceCoord: { x, y },
      exitCoord: { x: x + 50, y: y + 50 },
      type: 'portal',
      bidirectional: true,
    };
    setTransitions([...transitions, newTransition]);
  };

  const addMeasurementPoint = (x: number, y: number) => {
    if (isDrawing && currentPath.length > 0) {
      const newPath = [...currentPath, { x, y }];
      setCurrentPath(newPath);

      // Calculate measurement
      if (currentTool === 'measure-distance') {
        const distance = measureDistance(newPath);
        const measurement: Measurement = {
          id: `measure-${Date.now()}`,
          type: 'distance',
          points: newPath,
          result: distance,
          label: `${distance.toFixed(2)} yards`,
        };
        setMeasurements([...measurements, measurement]);
        setIsDrawing(false);
        setCurrentPath([]);
      } else if (currentTool === 'measure-area' && newPath.length >= 3) {
        const area = measureArea(newPath);
        const measurement: Measurement = {
          id: `measure-${Date.now()}`,
          type: 'area',
          points: newPath,
          result: area,
          label: `${area.toFixed(2)} sq yards`,
        };
        setMeasurements([...measurements, measurement]);
        setIsDrawing(false);
        setCurrentPath([]);
      }
    } else {
      setIsDrawing(true);
      setCurrentPath([{ x, y }]);
    }
  };

  const finishDrawing = () => {
    if (currentTool === 'road' && currentPath.length >= 2) {
      saveState('Add road');

      const simplified = simplifyPath(currentPath, 2.0);
      const newRoad: Road = {
        id: `road-${Date.now()}`,
        name: `Road ${roads.length + 1}`,
        mapId: selectedMap,
        points: simplified,
        width: 5,
        type: 'main-road',
      };
      setRoads([...roads, newRoad]);
      setCurrentPath([]);
    } else if (currentTool === 'waypoint' && currentPath.length >= 2) {
      saveState('Add waypoint path');

      const newPath: WaypointPath = {
        id: `${Date.now()}`,
        name: `Path ${waypointPaths.length + 1}`,
        mapId: selectedMap,
        waypoints: currentPath.map(p => ({ x: p.x, y: p.y })),
        isLoop: false,
      };
      setWaypointPaths([...waypointPaths, newPath]);
      setCurrentPath([]);
    }
    setIsDrawing(false);
  };

  const cancelDrawing = () => {
    setIsDrawing(false);
    setCurrentPath([]);
  };

  // Auto-pathfinding
  const handleAutoPath = () => {
    if (selectedItems.size !== 2) {
      alert('Select exactly 2 spawn points to create a path between them');
      return;
    }

    const selectedCoords = coordinates.filter(c => selectedItems.has(c.id));
    if (selectedCoords.length !== 2) return;

    const start = selectedCoords[0];
    const end = selectedCoords[1];

    const path = findPath(start, end, [], gridSize);
    if (path) {
      saveState('Add auto-generated path');

      const newPath: WaypointPath = {
        id: `${Date.now()}`,
        name: `Auto Path ${waypointPaths.length + 1}`,
        mapId: selectedMap,
        waypoints: path.map(p => ({ x: p.x, y: p.y })),
        isLoop: false,
      };
      setWaypointPaths([...waypointPaths, newPath]);
    } else {
      alert('No path found between selected points');
    }
  };

  // Smooth selected road
  const handleSmoothRoad = () => {
    if (selectedItems.size !== 1) {
      alert('Select exactly one road to smooth');
      return;
    }

    const roadId = Array.from(selectedItems)[0];
    const road = roads.find(r => r.id === roadId);
    if (!road) return;

    saveState('Smooth road');

    const smoothed = smoothPath(road.points, 'catmull-rom', 10);
    const updatedRoad = { ...road, points: smoothed };
    setRoads(roads.map(r => (r.id === roadId ? updatedRoad : r)));
  };

  // Validate map
  const handleValidate = () => {
    const issues = validateMap(getEditorState());
    setValidationIssues(issues);
  };

  // Mouse wheel zoom
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setScale(Math.max(0.1, Math.min(5, scale * delta)));
  };

  // Pan handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (currentTool === 'select' || e.button === 1) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // Update mouse coordinates
    const canvas = canvasRef.current;
    if (canvas) {
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left - offset.x) / scale;
      const y = (e.clientY - rect.top - offset.y) / scale;
      const wow = canvasToWow(x, y, selectedMap, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Query height at cursor position if collision data is available
      let z = 0;
      if ((vmapData || mmapData) && autoDetectHeight) {
        const heightResult = getHeightAtPosition(wow.x, wow.y, vmapData || undefined, mmapData || undefined, {
          preferVMap: true,
          searchRadius: 10.0,
          verbose: false,
        });
        if (heightResult.z !== null) {
          z = heightResult.z;
        }
      }

      setMouseCoords({ x: wow.x, y: wow.y, z });
    }

    if (isPanning) {
      setOffset({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  // Upload map image
  const handleMapUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = event => {
        const img = new Image();
        img.onload = () => setMapImage(img);
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  // Upload VMap files
  const handleVMapUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setCollisionDataStatus({ ...collisionDataStatus, vmap: 'loading', message: 'Loading VMap files...' });

    try {
      // Find .vmtree file
      let treeFile: File | null = null;
      const tileFiles: File[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.name.endsWith('.vmtree')) {
          treeFile = file;
        } else if (file.name.endsWith('.vmtile')) {
          tileFiles.push(file);
        }
      }

      if (!treeFile) {
        throw new Error('No .vmtree file found. Please select the tree file for this map.');
      }

      // Read tree file
      const treeBuffer = await treeFile.arrayBuffer();

      // Read tile files
      const tileBuffers = new Map<string, ArrayBuffer>();
      for (const tileFile of tileFiles) {
        // Extract tile coordinates from filename (e.g., "32_48.vmtile")
        const match = tileFile.name.match(/(\d+)_(\d+)\.vmtile/);
        if (match) {
          const tileX = parseInt(match[1], 10);
          const tileY = parseInt(match[2], 10);
          const buffer = await tileFile.arrayBuffer();
          tileBuffers.set(`${tileX}_${tileY}`, buffer);
        }
      }

      // Load VMap data
      const mapData = Object.values(WoWMaps).find(m => m.id === selectedMap);
      const mapName = mapData?.name || `Map ${selectedMap}`;

      const vmap = loadVMapData(selectedMap, mapName, treeBuffer, tileBuffers, {
        verbose: true,
        maxTiles: 100, // Limit tiles to prevent memory issues
      });

      setVmapData(vmap);
      setCollisionDataStatus({
        ...collisionDataStatus,
        vmap: 'loaded',
        message: `VMap loaded: ${vmap.allSpawns.length} spawns, ${vmap.tiles.size} tiles`,
      });
    } catch (error: any) {
      console.error('Failed to load VMap:', error);
      setCollisionDataStatus({
        ...collisionDataStatus,
        vmap: 'error',
        message: `VMap error: ${error.message}`,
      });
    }
  };

  // Upload MMap files
  const handleMMapUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setCollisionDataStatus({ ...collisionDataStatus, mmap: 'loading', message: 'Loading MMap files...' });

    try {
      // Find .mmap header file
      let headerFile: File | null = null;
      const tileFiles: File[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.name.endsWith('.mmap') && !file.name.includes('mmtile')) {
          headerFile = file;
        } else if (file.name.endsWith('.mmtile')) {
          tileFiles.push(file);
        }
      }

      if (!headerFile) {
        throw new Error('No .mmap header file found. Please select the header file for this map.');
      }

      // Read header file
      const headerBuffer = await headerFile.arrayBuffer();

      // Read tile files
      const tileBuffers = new Map<string, ArrayBuffer>();
      for (const tileFile of tileFiles) {
        // Extract tile coordinates from filename (e.g., "3248.mmtile")
        const match = tileFile.name.match(/(\d{2})(\d{2})\.mmtile/);
        if (match) {
          const tileX = parseInt(match[1], 10);
          const tileY = parseInt(match[2], 10);
          const buffer = await tileFile.arrayBuffer();
          tileBuffers.set(`${tileX}_${tileY}`, buffer);
        }
      }

      // Load MMap data
      const mapData = Object.values(WoWMaps).find(m => m.id === selectedMap);
      const mapName = mapData?.name || `Map ${selectedMap}`;

      const mmap = loadMMapData(selectedMap, mapName, headerBuffer, tileBuffers, {
        verbose: true,
        maxTiles: 100, // Limit tiles to prevent memory issues
      });

      setMmapData(mmap);
      setCollisionDataStatus({
        ...collisionDataStatus,
        mmap: 'loaded',
        message: `MMap loaded: ${mmap.tiles.size} tiles`,
      });
    } catch (error: any) {
      console.error('Failed to load MMap:', error);
      setCollisionDataStatus({
        ...collisionDataStatus,
        mmap: 'error',
        message: `MMap error: ${error.message}`,
      });
    }
  };

  const exportSQL = () => {
    let sql = `-- Map Coordinate Export\n-- Map ID: ${selectedMap}\n-- Generated: ${new Date().toISOString()}\n\n`;

    coordinates.forEach(coord => {
      if (coord.type === 'spawn') {
        sql += generateSpawnSQL(coord, 1234) + '\n\n';
      }
    });

    waypointPaths.forEach(path => {
      sql += generateWaypointSQL(path) + '\n\n';
    });

    transitions.forEach(transition => {
      sql += generateZoneTransitionSQL(transition) + '\n\n';
    });

    const blob = new Blob([sql], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `map_${selectedMap}_export.sql`;
    a.click();
  };

  const exportJSON = () => {
    const json = exportMapData(coordinates, roads, transitions, waypointPaths);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `map_${selectedMap}_export.json`;
    a.click();
  };

  const exportAsKML = () => {
    const kml = exportToKML(getEditorState(), selectedMap);
    const blob = new Blob([kml], { type: 'application/vnd.google-earth.kml+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `map_${selectedMap}_export.kml`;
    a.click();
  };

  const exportAsGeoJSON = () => {
    const geojson = exportToGeoJSON(getEditorState(), selectedMap);
    const blob = new Blob([geojson], { type: 'application/geo+json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `map_${selectedMap}_export.geojson`;
    a.click();
  };

  const importJSON = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e: any) => {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = event => {
        const data = importMapData(event.target?.result as string);
        if (data) {
          saveState('Import data');
          setCoordinates(data.coordinates);
          setRoads(data.roads);
          setTransitions(data.transitions);
          setWaypointPaths(data.paths);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const clearAll = () => {
    if (confirm('Clear all data? This cannot be undone.')) {
      saveState('Clear all');
      setCoordinates([]);
      setRoads([]);
      setTransitions([]);
      setWaypointPaths([]);
      setMeasurements([]);
      setAnnotations([]);
      setCurrentPath([]);
      setSelectedItems(new Set());
    }
  };

  const filteredCoordinates = searchQuery
    ? coordinates.filter(c => c.label?.toLowerCase().includes(searchQuery.toLowerCase()))
    : coordinates;

  const filteredRoads = searchQuery
    ? roads.filter(r => r.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : roads;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8">
      <div className="max-w-[1800px] mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Map className="w-8 h-8 text-blue-400" />
              <div>
                <h1 className="text-3xl font-bold text-white">Enhanced Map Editor</h1>
                <p className="text-slate-400">
                  Professional map editor with undo/redo, pathfinding, measurements, and more
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleUndo} disabled={!historyManager.current.canUndo()}>
                <Undo2 className="w-4 h-4 mr-2" />
                Undo
              </Button>
              <Button variant="outline" onClick={handleRedo} disabled={!historyManager.current.canRedo()}>
                <Redo2 className="w-4 h-4 mr-2" />
                Redo
              </Button>
              <Button variant="outline" onClick={exportSQL}>
                <Download className="w-4 h-4 mr-2" />
                Export SQL
              </Button>
              <Button variant="outline" onClick={exportJSON}>
                <Save className="w-4 h-4 mr-2" />
                Export JSON
              </Button>
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <Settings className="w-4 h-4 mr-2" />
                    More...
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Export Options</DialogTitle>
                    <DialogDescription>Choose export format</DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-2">
                    <Button onClick={exportAsKML}>Export as KML</Button>
                    <Button onClick={exportAsGeoJSON}>Export as GeoJSON</Button>
                    <Button onClick={importJSON}>Import JSON</Button>
                    <Button onClick={clearAll} variant="destructive">
                      Clear All
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-[280px_1fr_320px] gap-6">
          {/* Left Sidebar - Tools */}
          <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-lg p-4 space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">Tools</h3>

              {/* Map Selection */}
              <div className="mb-4 p-3 bg-blue-900/30 border border-blue-700 rounded">
                <label className="block mb-2">
                  <span className="text-sm font-semibold text-blue-300">Select WoW Map</span>
                  <select
                    value={selectedMap}
                    onChange={(e) => setSelectedMap(parseInt(e.target.value))}
                    className="w-full mt-2 p-2 bg-slate-800 border border-slate-600 rounded text-white"
                  >
                    {availableMaps.map((map) => (
                      <option key={map.id} value={map.id}>
                        {map.name} (ID: {map.id})
                      </option>
                    ))}
                  </select>
                </label>
                {isLoadingMap && (
                  <p className="text-xs text-yellow-400 mt-2 flex items-center">
                    <AlertCircle className="w-3 h-3 mr-1 animate-spin" />
                    Loading map...
                  </p>
                )}
                {!isLoadingMap && !mapImage && (
                  <p className="text-xs text-orange-400 mt-2 flex items-center">
                    <AlertCircle className="w-3 h-3 mr-1" />
                    No image available. Use custom upload below.
                  </p>
                )}
                {!isLoadingMap && mapImage && (
                  <p className="text-xs text-green-400 mt-2 flex items-center">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Map loaded
                  </p>
                )}
              </div>

              {/* Custom Map Upload (fallback) */}
              <div className="mb-4 p-3 bg-slate-900/30 border border-slate-600 rounded">
                <label className="block mb-2">
                  <span className="text-xs font-semibold text-slate-400">Custom Map Image</span>
                  <p className="text-xs text-slate-500 mt-1 mb-2">
                    Upload your own map image if official maps are not available
                  </p>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleMapUpload}
                    className="hidden"
                    id="map-upload"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => document.getElementById('map-upload')?.click()}
                  >
                    <Upload className="w-3 h-3 mr-2" />
                    Upload Custom
                  </Button>
                </label>
              </div>

              {/* Collision Data Upload */}
              <div className="mb-4 p-3 bg-emerald-900/30 border border-emerald-700 rounded">
                <div className="mb-2 flex items-center justify-between">
                  <div>
                    <span className="text-sm font-semibold text-emerald-300 flex items-center gap-2">
                      <Layers className="w-4 h-4" />
                      Collision Data
                    </span>
                    <p className="text-xs text-slate-400 mt-1">
                      Auto-loads from server or upload manually
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={autoLoadResult.reload}
                    title="Reload collision data from configured paths"
                    className="h-8 w-8 p-0"
                  >
                    <RefreshCw className="w-3 h-3" />
                  </Button>
                </div>

                {/* VMap Upload */}
                <div className="mb-2">
                  {/* Auto-load status */}
                  {autoLoadResult.status.vmap === 'checking' && (
                    <p className="text-xs text-blue-400 mb-1">Checking for VMap...</p>
                  )}
                  {autoLoadResult.status.vmap === 'unavailable' && (
                    <p className="text-xs text-slate-500 mb-1">VMap not configured - upload manually</p>
                  )}

                  <input
                    type="file"
                    accept=".vmtree,.vmtile"
                    onChange={handleVMapUpload}
                    className="hidden"
                    id="vmap-upload"
                    multiple
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => document.getElementById('vmap-upload')?.click()}
                    disabled={collisionDataStatus.vmap === 'loading'}
                  >
                    <Upload className="w-3 h-3 mr-2" />
                    {collisionDataStatus.vmap === 'loading' ? 'Loading VMap...' : 'Upload VMap'}
                  </Button>
                  {collisionDataStatus.vmap === 'loaded' && (
                    <p className="text-xs text-green-400 mt-1 flex items-center">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      VMap loaded
                    </p>
                  )}
                  {collisionDataStatus.vmap === 'error' && (
                    <p className="text-xs text-red-400 mt-1 flex items-center">
                      <AlertCircle className="w-3 h-3 mr-1" />
                      VMap error
                    </p>
                  )}
                </div>

                {/* MMap Upload */}
                <div className="mb-2">
                  {/* Auto-load status */}
                  {autoLoadResult.status.mmap === 'checking' && (
                    <p className="text-xs text-blue-400 mb-1">Checking for MMap...</p>
                  )}
                  {autoLoadResult.status.mmap === 'unavailable' && (
                    <p className="text-xs text-slate-500 mb-1">MMap not configured - upload manually</p>
                  )}

                  <input
                    type="file"
                    accept=".mmap,.mmtile"
                    onChange={handleMMapUpload}
                    className="hidden"
                    id="mmap-upload"
                    multiple
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => document.getElementById('mmap-upload')?.click()}
                    disabled={collisionDataStatus.mmap === 'loading'}
                  >
                    <Upload className="w-3 h-3 mr-2" />
                    {collisionDataStatus.mmap === 'loading' ? 'Loading MMap...' : 'Upload MMap'}
                  </Button>
                  {collisionDataStatus.mmap === 'loaded' && (
                    <p className="text-xs text-green-400 mt-1 flex items-center">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      MMap loaded
                    </p>
                  )}
                  {collisionDataStatus.mmap === 'error' && (
                    <p className="text-xs text-red-400 mt-1 flex items-center">
                      <AlertCircle className="w-3 h-3 mr-1" />
                      MMap error
                    </p>
                  )}
                </div>

                {/* Status Message */}
                {collisionDataStatus.message && (
                  <p className="text-xs text-slate-400 mt-2 p-2 bg-slate-800/50 rounded">
                    {collisionDataStatus.message}
                  </p>
                )}

                {/* Auto-detect Height Toggle */}
                <div className="mt-3 pt-2 border-t border-emerald-800">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-slate-300">Auto-detect Height (Z)</Label>
                    <Switch
                      checked={autoDetectHeight}
                      onCheckedChange={setAutoDetectHeight}
                      disabled={!vmapData && !mmapData}
                    />
                  </div>
                  {autoDetectHeight && (vmapData || mmapData) && (
                    <p className="text-xs text-emerald-400 mt-1">
                      Height will be auto-filled when placing spawns
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Button
                  variant={currentTool === 'select' ? 'default' : 'outline'}
                  className="w-full justify-start"
                  onClick={() => setCurrentTool('select')}
                >
                  <Move className="w-4 h-4 mr-2" />
                  Select / Pan
                </Button>
                <Button
                  variant={currentTool === 'spawn' ? 'default' : 'outline'}
                  className="w-full justify-start"
                  onClick={() => setCurrentTool('spawn')}
                >
                  <MapPin className="w-4 h-4 mr-2" />
                  Spawn Point (S)
                </Button>
                <Button
                  variant={currentTool === 'waypoint' ? 'default' : 'outline'}
                  className="w-full justify-start"
                  onClick={() => setCurrentTool('waypoint')}
                >
                  <Waypoints className="w-4 h-4 mr-2" />
                  Waypoint (W)
                </Button>
                <Button
                  variant={currentTool === 'road' ? 'default' : 'outline'}
                  className="w-full justify-start"
                  onClick={() => setCurrentTool('road')}
                >
                  <Route className="w-4 h-4 mr-2" />
                  Road (R)
                </Button>
                <Button
                  variant={currentTool === 'transition' ? 'default' : 'outline'}
                  className="w-full justify-start"
                  onClick={() => setCurrentTool('transition')}
                >
                  <Link className="w-4 h-4 mr-2" />
                  Zone Transition (T)
                </Button>
                <Button
                  variant={currentTool === 'measure-distance' ? 'default' : 'outline'}
                  className="w-full justify-start"
                  onClick={() => setCurrentTool('measure-distance')}
                >
                  <Ruler className="w-4 h-4 mr-2" />
                  Measure Distance (M)
                </Button>
                <Button
                  variant={currentTool === 'measure-area' ? 'default' : 'outline'}
                  className="w-full justify-start"
                  onClick={() => setCurrentTool('measure-area')}
                >
                  <Ruler className="w-4 h-4 mr-2" />
                  Measure Area
                </Button>

                {isDrawing && (
                  <div className="flex gap-2">
                    <Button variant="default" className="flex-1" onClick={finishDrawing}>
                      Finish
                    </Button>
                    <Button variant="outline" className="flex-1" onClick={cancelDrawing}>
                      Cancel
                    </Button>
                  </div>
                )}
              </div>
            </div>

            <div className="pt-4 border-t border-slate-700">
              <h3 className="text-sm font-semibold text-white mb-3">Advanced</h3>
              <div className="space-y-2">
                <Button variant="outline" className="w-full justify-start" onClick={handleAutoPath}>
                  <Navigation className="w-4 h-4 mr-2" />
                  Auto Path
                </Button>
                <Button variant="outline" className="w-full justify-start" onClick={handleSmoothRoad}>
                  <Route className="w-4 h-4 mr-2" />
                  Smooth Road
                </Button>
                <Button variant="outline" className="w-full justify-start" onClick={handleValidate}>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Validate
                </Button>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-700">
              <h3 className="text-sm font-semibold text-white mb-3">Settings</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm text-slate-300">Show Grid</Label>
                  <Switch checked={showGrid} onCheckedChange={setShowGrid} />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm text-slate-300">Snap to Grid</Label>
                  <Switch checked={snapToGridEnabled} onCheckedChange={setSnapToGridEnabled} />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm text-slate-300">Show Intersections</Label>
                  <Switch checked={showIntersections} onCheckedChange={setShowIntersections} />
                </div>
                <div>
                  <Label className="text-sm text-slate-300">Grid Size</Label>
                  <Input
                    type="number"
                    value={gridSize}
                    onChange={e => setGridSize(parseInt(e.target.value) || 10)}
                    min={5}
                    max={100}
                    className="mt-1"
                  />
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-700">
              <h3 className="text-sm font-semibold text-white mb-2">Stats</h3>
              <div className="space-y-1 text-sm text-slate-400">
                <div>Spawns: {coordinates.filter(c => c.type === 'spawn').length}</div>
                <div>Roads: {roads.length}</div>
                <div>Transitions: {transitions.length}</div>
                <div>Waypoints: {waypointPaths.length}</div>
                <div>Selected: {selectedItems.size}</div>
              </div>
            </div>

            {showCoordinates && (
              <div className="pt-4 border-t border-slate-700">
                <h3 className="text-sm font-semibold text-white mb-2">Cursor (WoW Coords)</h3>
                <div className="space-y-1 text-xs text-slate-400 font-mono">
                  <div>X: {mouseCoords.x.toFixed(2)}</div>
                  <div>Y: {mouseCoords.y.toFixed(2)}</div>
                  <div className={mouseCoords.z !== 0 ? 'text-emerald-400' : ''}>
                    Z: {mouseCoords.z.toFixed(2)}
                    {mouseCoords.z !== 0 && ' (detected)'}
                  </div>
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  TrinityCore world coordinates
                  {(vmapData || mmapData) && autoDetectHeight && (
                    <span className="block text-emerald-400 mt-1">
                      Height detection active
                    </span>
                  )}
                </p>
              </div>
            )}
          </div>

          {/* Center - Canvas */}
          <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-lg p-4">
            <div className="relative">
              <canvas
                ref={canvasRef}
                width={CANVAS_WIDTH}
                height={CANVAS_HEIGHT}
                onClick={handleCanvasClick}
                onWheel={handleWheel}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                className="cursor-crosshair border border-slate-600 rounded"
              />

              {/* Zoom Controls */}
              <div className="absolute top-4 right-4 flex flex-col gap-2">
                <Button size="sm" variant="outline" onClick={() => setScale(Math.min(5, scale * 1.2))}>
                  <ZoomIn className="w-4 h-4" />
                </Button>
                <div className="text-xs text-white text-center bg-slate-800 px-2 py-1 rounded border border-slate-600">
                  {Math.round(scale * 100)}%
                </div>
                <Button size="sm" variant="outline" onClick={() => setScale(Math.max(0.1, scale / 1.2))}>
                  <ZoomOut className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="mt-4 text-sm text-slate-400">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  <span>Spawns</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-yellow-500"></div>
                  <span>Roads</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-purple-500"></div>
                  <span>Waypoints</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-pink-500"></div>
                  <span>Transitions</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-amber-500"></div>
                  <span>Measurements</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Sidebar */}
          <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-lg p-4">
            <div className="mb-4">
              <Input
                placeholder="Search items..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full"
              />
            </div>

            <Tabs defaultValue="spawns">
              <TabsList className="grid grid-cols-4 mb-4">
                <TabsTrigger value="spawns">Spawns</TabsTrigger>
                <TabsTrigger value="roads">Roads</TabsTrigger>
                <TabsTrigger value="layers">Layers</TabsTrigger>
                <TabsTrigger value="validate">Validate</TabsTrigger>
              </TabsList>

              <TabsContent value="spawns">
                <div className="space-y-2 max-h-[600px] overflow-y-auto">
                  {filteredCoordinates
                    .filter(c => c.type === 'spawn')
                    .map(coord => (
                      <div
                        key={coord.id}
                        className={`p-3 rounded border text-sm cursor-pointer ${
                          selectedItems.has(coord.id)
                            ? 'bg-blue-500/20 border-blue-500'
                            : 'bg-slate-700/50 border-slate-600'
                        }`}
                        onClick={() => {
                          const newSelected = new Set(selectedItems);
                          if (newSelected.has(coord.id)) {
                            newSelected.delete(coord.id);
                          } else {
                            newSelected.add(coord.id);
                          }
                          setSelectedItems(newSelected);
                        }}
                      >
                        <div className="font-semibold text-white">{coord.label}</div>
                        <div className="text-slate-400 text-xs mt-1">
                          X: {coord.x.toFixed(2)}, Y: {coord.y.toFixed(2)}, Z: {coord.z?.toFixed(2) || '0.00'}
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="mt-2 w-full"
                          onClick={e => {
                            e.stopPropagation();
                            const sql = generateSpawnSQL(coord, 1234);
                            navigator.clipboard.writeText(sql);
                            alert('SQL copied to clipboard!');
                          }}
                        >
                          Copy SQL
                        </Button>
                      </div>
                    ))}
                </div>
              </TabsContent>

              <TabsContent value="roads">
                <div className="space-y-2 max-h-[600px] overflow-y-auto">
                  {filteredRoads.map(road => (
                    <div
                      key={road.id}
                      className={`p-3 rounded border text-sm cursor-pointer ${
                        selectedItems.has(road.id)
                          ? 'bg-blue-500/20 border-blue-500'
                          : 'bg-slate-700/50 border-slate-600'
                      }`}
                      onClick={() => {
                        const newSelected = new Set(selectedItems);
                        if (newSelected.has(road.id)) {
                          newSelected.delete(road.id);
                        } else {
                          newSelected.add(road.id);
                        }
                        setSelectedItems(newSelected);
                      }}
                    >
                      <div className="font-semibold text-white">{road.name}</div>
                      <div className="text-slate-400 text-xs mt-1">
                        {road.points.length} points • {road.type}
                      </div>
                      <div className="text-slate-400 text-xs">
                        Length: {measureDistance(road.points).toFixed(2)} yards
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="layers">
                <div className="space-y-3">
                  {layers.map(layer => (
                    <div key={layer.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={layer.visible}
                          onCheckedChange={visible => {
                            setLayers(layers.map(l => (l.id === layer.id ? { ...l, visible } : l)));
                          }}
                        />
                        <Label className="text-sm text-slate-300">{layer.name}</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setLayers(layers.map(l => (l.id === layer.id ? { ...l, locked: !l.locked } : l)));
                          }}
                        >
                          {layer.locked ? '🔒' : '🔓'}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="validate">
                <div className="space-y-2 max-h-[600px] overflow-y-auto">
                  {validationIssues.length === 0 && (
                    <div className="text-center text-slate-400 text-sm py-8">
                      <CheckCircle className="w-8 h-8 mx-auto mb-2" />
                      <div>No issues found</div>
                      <div className="text-xs mt-1">Click Validate to check for issues</div>
                    </div>
                  )}
                  {validationIssues.map((issue, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded border text-sm ${
                        issue.type === 'error'
                          ? 'bg-red-500/10 border-red-500'
                          : issue.type === 'warning'
                          ? 'bg-yellow-500/10 border-yellow-500'
                          : 'bg-blue-500/10 border-blue-500'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        {issue.type === 'error' && <AlertCircle className="w-4 h-4 text-red-500 mt-0.5" />}
                        {issue.type === 'warning' && <AlertCircle className="w-4 h-4 text-yellow-500 mt-0.5" />}
                        {issue.type === 'info' && <Info className="w-4 h-4 text-blue-500 mt-0.5" />}
                        <div className="flex-1">
                          <div className="text-white">{issue.message}</div>
                          {issue.relatedItems && (
                            <div className="text-xs text-slate-400 mt-1">
                              Items: {issue.relatedItems.slice(0, 3).join(', ')}
                              {issue.relatedItems.length > 3 && ` +${issue.relatedItems.length - 3} more`}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>

        {/* Keyboard Shortcuts Dialog */}
        <Dialog>
          <DialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="fixed bottom-4 right-4"
            >
              <Keyboard className="w-4 h-4 mr-2" />
              Shortcuts
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Keyboard Shortcuts</DialogTitle>
              <DialogDescription>Quick reference for all keyboard shortcuts</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4 max-h-96 overflow-y-auto">
              {DEFAULT_SHORTCUTS.map((shortcut, idx) => (
                <div key={idx} className="flex justify-between items-center py-2 border-b border-slate-700">
                  <span className="text-sm text-slate-300">{shortcut.description}</span>
                  <kbd className="px-2 py-1 text-xs bg-slate-700 rounded border border-slate-600">
                    {shortcut.ctrl && 'Ctrl+'}
                    {shortcut.shift && 'Shift+'}
                    {shortcut.alt && 'Alt+'}
                    {shortcut.key}
                  </kbd>
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
