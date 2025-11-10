'use client';

/**
 * Enhanced 2D Map View Component with Tiled Map Support
 *
 * Integrates TiledMapViewer for memory-efficient map display
 * while preserving spawn placement and editing functionality.
 */

import React, { useRef, useEffect, useCallback, useState } from 'react';
import type { WorldEditorState, WorldEditorActions } from '../hooks/useWorldEditorState';
import { canvasToWow, wowToCanvas } from '@/lib/map-editor';
import { getHeightAtPosition } from '@/lib/height-query';
import TiledMapViewer from '@/components/map/TiledMapViewer';

interface MapView2DEnhancedProps {
  state: WorldEditorState;
  actions: WorldEditorActions;
  width?: number;
  height?: number;
  onRequestExtraction?: () => void;
}

type Tool = 'select' | 'spawn' | 'waypoint' | 'road' | 'transition';

export function MapView2DEnhanced({
  state,
  actions,
  width = 1200,
  height = 800,
  onRequestExtraction
}: MapView2DEnhancedProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentTool, setCurrentTool] = useState<Tool>('spawn');
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [mouseCoords, setMouseCoords] = useState({ x: 0, y: 0, z: 0 });
  const [hasTiledMaps, setHasTiledMaps] = useState(false);
  const [checkingTiles, setCheckingTiles] = useState(true);

  // Check if tiled maps exist for current map
  useEffect(() => {
    const checkForTiles = async () => {
      setCheckingTiles(true);
      try {
        const response = await fetch(`/maps/tiles/${state.selectedMap}/metadata.json`);
        setHasTiledMaps(response.ok);
      } catch {
        setHasTiledMaps(false);
      } finally {
        setCheckingTiles(false);
      }
    };
    checkForTiles();
  }, [state.selectedMap]);

  // Draw overlay elements (spawns, waypoints, etc.) on top of tiled map
  const drawOverlay = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { camera2D } = state;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    ctx.save();
    ctx.translate(camera2D.offset.x, camera2D.offset.y);
    ctx.scale(camera2D.scale, camera2D.scale);

    // Draw grid
    if (state.showGrid) {
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1 / camera2D.scale;
      for (let i = 0; i <= 20; i++) {
        const x = (i * width) / 20 / camera2D.scale;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height / camera2D.scale);
        ctx.stroke();
      }
      for (let i = 0; i <= 20; i++) {
        const y = (i * height) / 20 / camera2D.scale;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width / camera2D.scale, y);
        ctx.stroke();
      }
    }

    // Draw roads
    const roadsLayer = state.layers.find(l => l.id === 'roads');
    if (roadsLayer?.visible) {
      ctx.globalAlpha = roadsLayer.opacity;
      state.roads.forEach(road => {
        const isSelected = state.selectedItems.has(road.id);
        ctx.strokeStyle = isSelected ? '#60a5fa' : '#fbbf24';
        ctx.lineWidth = (3 / camera2D.scale) * (isSelected ? 1.5 : 1);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        road.points.forEach((point, i) => {
          if (i === 0) ctx.moveTo(point.x, point.y);
          else ctx.lineTo(point.x, point.y);
        });
        ctx.stroke();
      });
      ctx.globalAlpha = 1;
    }

    // Draw waypoint paths
    const waypointsLayer = state.layers.find(l => l.id === 'waypoints');
    if (waypointsLayer?.visible) {
      ctx.globalAlpha = waypointsLayer.opacity;
      state.waypointPaths.forEach(path => {
        const isSelected = state.selectedItems.has(path.id);
        ctx.strokeStyle = isSelected ? '#a78bfa' : '#8b5cf6';
        ctx.lineWidth = (3 / camera2D.scale) * (isSelected ? 1.5 : 1);
        ctx.setLineDash([5 / camera2D.scale, 5 / camera2D.scale]);
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
          ctx.arc(wp.x, wp.y, 4 / camera2D.scale, 0, Math.PI * 2);
          ctx.fill();
        });
      });
      ctx.globalAlpha = 1;
    }

    // Draw spawn points
    const spawnsLayer = state.layers.find(l => l.id === 'spawns');
    if (spawnsLayer?.visible) {
      ctx.globalAlpha = spawnsLayer.opacity;
      state.coordinates.forEach(coord => {
        if (coord.type === 'spawn') {
          // Convert WoW world coordinates to canvas coordinates
          const canvasPos = wowToCanvas(coord.x, coord.y, state.selectedMap, width / camera2D.scale, height / camera2D.scale);

          const isSelected = state.selectedItems.has(coord.id);
          ctx.fillStyle = isSelected ? '#34d399' : '#10b981';
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = (2 / camera2D.scale) * (isSelected ? 1.5 : 1);
          ctx.beginPath();
          ctx.arc(canvasPos.x, canvasPos.y, (8 / camera2D.scale) * (isSelected ? 1.3 : 1), 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          // Draw label
          ctx.fillStyle = '#fff';
          ctx.font = `${12 / camera2D.scale}px sans-serif`;
          ctx.fillText(coord.label || '', canvasPos.x + 12 / camera2D.scale, canvasPos.y + 4 / camera2D.scale);
        }
      });
      ctx.globalAlpha = 1;
    }

    // Draw zone transitions
    const transitionsLayer = state.layers.find(l => l.id === 'transitions');
    if (transitionsLayer?.visible) {
      ctx.globalAlpha = transitionsLayer.opacity;
      state.transitions.forEach(transition => {
        const isSelected = state.selectedItems.has(transition.id);
        ctx.fillStyle = isSelected ? '#f472b6' : '#ec4899';
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = (2 / camera2D.scale) * (isSelected ? 1.5 : 1);
        ctx.fillRect(
          transition.entranceCoord.x - 10 / camera2D.scale,
          transition.entranceCoord.y - 10 / camera2D.scale,
          20 / camera2D.scale,
          20 / camera2D.scale
        );
        ctx.strokeRect(
          transition.entranceCoord.x - 10 / camera2D.scale,
          transition.entranceCoord.y - 10 / camera2D.scale,
          20 / camera2D.scale,
          20 / camera2D.scale
        );
      });
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }, [state, width, height]);

  // Redraw overlay on changes
  useEffect(() => {
    if (hasTiledMaps) {
      drawOverlay();
    }
  }, [hasTiledMaps, drawOverlay]);

  // Handle canvas click
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement | HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const canvasX = (e.clientX - rect.left - state.camera2D.offset.x) / state.camera2D.scale;
    const canvasY = (e.clientY - rect.top - state.camera2D.offset.y) / state.camera2D.scale;

    if (currentTool === 'spawn') {
      addSpawnPoint(canvasX, canvasY);
    }
  };

  const addSpawnPoint = (canvasX: number, canvasY: number) => {
    // Convert canvas coordinates to WoW world coordinates
    const wowCoords = canvasToWow(canvasX, canvasY, state.selectedMap, width, height);

    // Auto-detect height if enabled and collision data is available
    let z = 0;
    if (state.autoDetectHeight && (state.mapData || state.vmapData || state.mmapData)) {
      const heightResult = getHeightAtPosition(
        wowCoords.x,
        wowCoords.y,
        state.vmapData || undefined,
        state.mmapData || undefined,
        state.mapData || undefined,
        {
          preferVMap: true,
          searchRadius: 10.0,
          verbose: false,
        }
      );

      if (heightResult.z !== null) {
        z = heightResult.z;
        console.log(`[MapView2D] Auto-detected height: ${z.toFixed(2)} (source: ${heightResult.source})`);
      }
    }

    // Add coordinate using shared actions
    actions.addCoordinate({
      id: `spawn-${Date.now()}`,
      x: wowCoords.x,
      y: wowCoords.y,
      z,
      mapId: state.selectedMap,
      type: 'spawn',
      label: `Spawn ${state.coordinates.filter(c => c.type === 'spawn').length + 1}`,
    });
  };

  // Handle mouse wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.max(0.1, Math.min(5, state.camera2D.scale * delta));
    actions.setCamera2D({ ...state.camera2D, scale: newScale });
  };

  // Pan handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (currentTool === 'select' || e.button === 1) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - state.camera2D.offset.x, y: e.clientY - state.camera2D.offset.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    // Update mouse coordinates
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left - state.camera2D.offset.x) / state.camera2D.scale;
    const y = (e.clientY - rect.top - state.camera2D.offset.y) / state.camera2D.scale;
    const wow = canvasToWow(x, y, state.selectedMap, width, height);

    // Query height at cursor position if collision data is available
    let z = 0;
    if ((state.mapData || state.vmapData || state.mmapData) && state.autoDetectHeight) {
      const heightResult = getHeightAtPosition(
        wow.x,
        wow.y,
        state.vmapData || undefined,
        state.mmapData || undefined,
        state.mapData || undefined,
        {
          preferVMap: true,
          searchRadius: 10.0,
          verbose: false,
        }
      );
      if (heightResult.z !== null) {
        z = heightResult.z;
      }
    }

    setMouseCoords({ x: wow.x, y: wow.y, z });

    if (isPanning) {
      actions.setCamera2D({
        ...state.camera2D,
        offset: {
          x: e.clientX - panStart.x,
          y: e.clientY - panStart.y,
        },
      });
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  // Render tiled map version
  if (hasTiledMaps) {
    return (
      <div className="relative" style={{ width, height }}>
        {/* Tiled map background */}
        <div className="absolute inset-0">
          <TiledMapViewer
            mapId={state.selectedMap}
            initialZoom={0}
            onTileClick={(tileX, tileY, zoom) => {
              console.log(`Tile clicked: ${tileX}, ${tileY} at zoom ${zoom}`);
            }}
          />
        </div>

        {/* Overlay canvas for spawn points, waypoints, etc. */}
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          onClick={handleCanvasClick}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          className="absolute inset-0 cursor-crosshair"
          style={{ pointerEvents: 'auto' }}
        />

        {/* Tool selector overlay */}
        <div className="absolute top-4 left-4 bg-slate-800/90 backdrop-blur border border-slate-600 rounded-lg p-2 flex gap-2 z-10">
          <button
            onClick={() => setCurrentTool('select')}
            className={`px-3 py-2 rounded text-sm ${
              currentTool === 'select' ? 'bg-blue-500 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            Select
          </button>
          <button
            onClick={() => setCurrentTool('spawn')}
            className={`px-3 py-2 rounded text-sm ${
              currentTool === 'spawn' ? 'bg-green-500 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            Spawn
          </button>
        </div>

        {/* Coordinates overlay */}
        <div className="absolute bottom-4 left-4 bg-slate-800/90 backdrop-blur border border-slate-600 rounded-lg p-3 z-10">
          <div className="text-xs text-slate-300 space-y-1 font-mono">
            <div>X: {mouseCoords.x.toFixed(2)}</div>
            <div>Y: {mouseCoords.y.toFixed(2)}</div>
            <div className={mouseCoords.z !== 0 ? 'text-emerald-400' : ''}>
              Z: {mouseCoords.z.toFixed(2)}
              {mouseCoords.z !== 0 && ' ✓'}
            </div>
          </div>
        </div>

        {/* Zoom level overlay */}
        <div className="absolute bottom-4 right-4 bg-slate-800/90 backdrop-blur border border-slate-600 rounded-lg px-3 py-2 z-10">
          <div className="text-xs text-slate-300 font-mono">
            Zoom: {Math.round(state.camera2D.scale * 100)}%
          </div>
        </div>
      </div>
    );
  }

  // Render fallback: no tiled maps available
  return (
    <div className="relative" style={{ width, height }}>
      <div className="flex flex-col items-center justify-center h-full bg-slate-900 border border-slate-600 rounded">
        <div className="text-center space-y-4 p-8">
          <svg
            className="w-16 h-16 mx-auto text-slate-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
            />
          </svg>

          {checkingTiles ? (
            <>
              <h3 className="text-lg font-medium text-slate-300">Checking for map tiles...</h3>
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
            </>
          ) : (
            <>
              <h3 className="text-lg font-medium text-slate-300">No Map Tiles Available</h3>
              <p className="text-sm text-slate-400 max-w-md">
                Map tiles need to be extracted from your WoW installation for map {state.selectedMap}.
              </p>
              {onRequestExtraction && (
                <button
                  onClick={onRequestExtraction}
                  className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  Extract Map Tiles
                </button>
              )}
              <p className="text-xs text-slate-500">
                You can still place coordinates - they will be shown once maps are extracted
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
