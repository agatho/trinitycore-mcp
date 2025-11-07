'use client';

/**
 * 2D Map View Component
 *
 * Canvas-based 2D map editor with spawn placement, height detection,
 * and synchronized state with 3D view.
 */

import React, { useRef, useEffect, useCallback, useState } from 'react';
import type { WorldEditorState, WorldEditorActions } from '../hooks/useWorldEditorState';
import { canvasToWow, wowToCanvas, loadMapImage } from '@/lib/map-editor';
import { getHeightAtPosition } from '@/lib/height-query';

interface MapView2DProps {
  state: WorldEditorState;
  actions: WorldEditorActions;
  width?: number;
  height?: number;
}

type Tool = 'select' | 'spawn' | 'waypoint' | 'road' | 'transition';

export function MapView2D({ state, actions, width = 1200, height = 800 }: MapView2DProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mapImage, setMapImage] = useState<HTMLImageElement | null>(null);
  const [currentTool, setCurrentTool] = useState<Tool>('spawn');
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [mouseCoords, setMouseCoords] = useState({ x: 0, y: 0, z: 0 });

  // Load map image when selected map changes
  useEffect(() => {
    const loadMap = async () => {
      try {
        const img = await loadMapImage(state.selectedMap);
        setMapImage(img);
      } catch (error) {
        console.error('Failed to load map:', error);
        setMapImage(null);
      }
    };
    loadMap();
  }, [state.selectedMap]);

  // Draw everything on canvas
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { camera2D } = state;

    // Clear canvas
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.translate(camera2D.offset.x, camera2D.offset.y);
    ctx.scale(camera2D.scale, camera2D.scale);

    // Draw background map image
    if (mapImage) {
      ctx.globalAlpha = 0.8;
      ctx.drawImage(mapImage, 0, 0, width / camera2D.scale, height / camera2D.scale);
      ctx.globalAlpha = 1.0;
    } else {
      // Draw "no map loaded" message
      ctx.fillStyle = '#475569';
      ctx.font = `${20 / camera2D.scale}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('No Map Image Available', width / (2 * camera2D.scale), height / (2 * camera2D.scale) - 50);
      ctx.fillStyle = '#64748b';
      ctx.font = `${14 / camera2D.scale}px sans-serif`;
      ctx.fillText('You can still place coordinates and export SQL', width / (2 * camera2D.scale), height / (2 * camera2D.scale));
      ctx.textAlign = 'left';
    }

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
  }, [state, mapImage, width, height]);

  // Redraw on changes
  useEffect(() => {
    draw();
  }, [draw]);

  // Handle canvas click
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
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
    if (state.autoDetectHeight && (state.vmapData || state.mmapData)) {
      const heightResult = getHeightAtPosition(
        wowCoords.x,
        wowCoords.y,
        state.vmapData || undefined,
        state.mmapData || undefined,
        {
          preferVMap: true,
          searchRadius: 10.0,
          verbose: false,
        }
      );

      if (heightResult.z !== null) {
        z = heightResult.z;
        console.log(`[MapView2D] Auto-detected height: ${z.toFixed(2)} (source: ${heightResult.source})`);
      } else {
        console.log(`[MapView2D] Could not detect height at (${wowCoords.x.toFixed(2)}, ${wowCoords.y.toFixed(2)})`);
      }
    }

    // Add coordinate using shared actions
    actions.addCoordinate({
      id: `spawn-${Date.now()}`,
      x: wowCoords.x, // WoW world X coordinate
      y: wowCoords.y, // WoW world Y coordinate
      z,
      mapId: state.selectedMap,
      type: 'spawn',
      label: `Spawn ${state.coordinates.filter(c => c.type === 'spawn').length + 1}`,
    });
  };

  // Handle mouse wheel zoom
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.max(0.1, Math.min(5, state.camera2D.scale * delta));
    actions.setCamera2D({ ...state.camera2D, scale: newScale });
  };

  // Pan handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (currentTool === 'select' || e.button === 1) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - state.camera2D.offset.x, y: e.clientY - state.camera2D.offset.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // Update mouse coordinates
    const canvas = canvasRef.current;
    if (canvas) {
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left - state.camera2D.offset.x) / state.camera2D.scale;
      const y = (e.clientY - rect.top - state.camera2D.offset.y) / state.camera2D.scale;
      const wow = canvasToWow(x, y, state.selectedMap, width, height);

      // Query height at cursor position if collision data is available
      let z = 0;
      if ((state.vmapData || state.mmapData) && state.autoDetectHeight) {
        const heightResult = getHeightAtPosition(
          wow.x,
          wow.y,
          state.vmapData || undefined,
          state.mmapData || undefined,
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
    }

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

  return (
    <div className="relative">
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
        className="cursor-crosshair border border-slate-600 rounded"
      />

      {/* Tool selector overlay */}
      <div className="absolute top-4 left-4 bg-slate-800/90 backdrop-blur border border-slate-600 rounded-lg p-2 flex gap-2">
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
      <div className="absolute bottom-4 left-4 bg-slate-800/90 backdrop-blur border border-slate-600 rounded-lg p-3">
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
      <div className="absolute bottom-4 right-4 bg-slate-800/90 backdrop-blur border border-slate-600 rounded-lg px-3 py-2">
        <div className="text-xs text-slate-300 font-mono">
          Zoom: {Math.round(state.camera2D.scale * 100)}%
        </div>
      </div>
    </div>
  );
}
