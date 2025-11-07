'use client';

/**
 * 3D Map View Component
 *
 * Three.js-based 3D viewer with VMap/MMap visualization
 * and click-to-place spawn functionality.
 */

import React, { useRef, useEffect, useState } from 'react';
import type { WorldEditorState, WorldEditorActions } from '../hooks/useWorldEditorState';

interface MapView3DProps {
  state: WorldEditorState;
  actions: WorldEditorActions;
  width?: number;
  height?: number;
}

export function MapView3D({ state, actions, width = 1200, height = 800 }: MapView3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isSpawnMode, setIsSpawnMode] = useState(true);

  // Placeholder for 3D renderer
  // In a full implementation, this would:
  // 1. Initialize Three.js scene, camera, renderer
  // 2. Load VMap/MMap collision meshes
  // 3. Add raycasting for click-to-place spawns
  // 4. Render spawn points as 3D spheres
  // 5. Synchronize camera with state.camera3D

  useEffect(() => {
    if (!containerRef.current) return;

    // TODO: Initialize Three.js renderer
    // const scene = new THREE.Scene();
    // const camera = new THREE.PerspectiveCamera(state.camera3D.fov, width / height, 0.1, 10000);
    // const renderer = new THREE.WebGLRenderer({ antialias: true });

    // TODO: Load VMap/MMap meshes when available
    if (state.vmapData) {
      console.log('[MapView3D] VMap data available:', state.vmapData.allSpawns.length, 'spawns');
    }
    if (state.mmapData) {
      console.log('[MapView3D] MMap data available:', state.mmapData.tiles.size, 'tiles');
    }

    // TODO: Add click handler for spawn placement
    const handleClick = (event: MouseEvent) => {
      if (!isSpawnMode) return;

      // TODO: Raycasting logic
      // const raycaster = new THREE.Raycaster();
      // const mouse = new THREE.Vector2();
      // mouse.x = (event.clientX / width) * 2 - 1;
      // mouse.y = -(event.clientY / height) * 2 + 1;
      // raycaster.setFromCamera(mouse, camera);
      // const intersects = raycaster.intersectObjects(scene.children, true);

      // if (intersects.length > 0) {
      //   const point = intersects[0].point;
      //   actions.addCoordinate({
      //     id: `spawn-${Date.now()}`,
      //     x: point.x,
      //     y: point.y,
      //     z: point.z,
      //     mapId: state.selectedMap,
      //     type: 'spawn',
      //     label: `Spawn ${state.coordinates.filter(c => c.type === 'spawn').length + 1}`,
      //   });
      // }
    };

    const container = containerRef.current;
    container.addEventListener('click', handleClick);

    return () => {
      container.removeEventListener('click', handleClick);
      // TODO: Cleanup Three.js resources
    };
  }, [state, actions, isSpawnMode, width, height]);

  // Render spawn points as 3D objects
  useEffect(() => {
    // TODO: Update 3D spawn point meshes when coordinates change
    state.coordinates.forEach(coord => {
      if (coord.type === 'spawn') {
        // TODO: Create/update sphere mesh at (coord.x, coord.y, coord.z)
        // Highlight if coord.id in state.selectedItems
      }
    });
  }, [state.coordinates, state.selectedItems]);

  return (
    <div className="relative" style={{ width, height }}>
      <div
        ref={containerRef}
        className="w-full h-full bg-slate-900 rounded flex items-center justify-center"
      >
        <div className="text-center">
          <div className="text-6xl mb-4">🎮</div>
          <p className="text-slate-400 text-lg mb-2">3D View</p>
          <p className="text-slate-500 text-sm max-w-md">
            Three.js 3D renderer will be integrated here with:
          </p>
          <ul className="text-slate-500 text-sm mt-3 space-y-1 text-left max-w-md mx-auto">
            <li>• VMap collision mesh visualization</li>
            <li>• MMap navigation mesh overlay</li>
            <li>• Click-to-place spawn points (raycasting)</li>
            <li>• Interactive 3D spawn markers</li>
            <li>• Synchronized camera with 2D view</li>
          </ul>
          {state.vmapData && (
            <div className="mt-4 text-green-400 text-sm">
              ✓ VMap loaded: {state.vmapData.allSpawns.length} spawns
            </div>
          )}
          {state.mmapData && (
            <div className="mt-2 text-green-400 text-sm">
              ✓ MMap loaded: {state.mmapData.tiles.size} tiles
            </div>
          )}
        </div>
      </div>

      {/* Tool selector overlay */}
      <div className="absolute top-4 left-4 bg-slate-800/90 backdrop-blur border border-slate-600 rounded-lg p-2 flex gap-2">
        <button
          onClick={() => setIsSpawnMode(false)}
          className={`px-3 py-2 rounded text-sm ${
            !isSpawnMode ? 'bg-blue-500 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
          }`}
        >
          Navigate
        </button>
        <button
          onClick={() => setIsSpawnMode(true)}
          className={`px-3 py-2 rounded text-sm ${
            isSpawnMode ? 'bg-green-500 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
          }`}
        >
          Place Spawn
        </button>
      </div>

      {/* Stats overlay */}
      <div className="absolute bottom-4 left-4 bg-slate-800/90 backdrop-blur border border-slate-600 rounded-lg p-3">
        <div className="text-xs text-slate-300 space-y-1">
          <div>Spawns: {state.coordinates.filter(c => c.type === 'spawn').length}</div>
          <div>Selected: {state.selectedItems.size}</div>
          <div className={state.vmapData ? 'text-green-400' : 'text-slate-500'}>
            VMap: {state.vmapData ? 'Loaded' : 'Not loaded'}
          </div>
          <div className={state.mmapData ? 'text-green-400' : 'text-slate-500'}>
            MMap: {state.mmapData ? 'Loaded' : 'Not loaded'}
          </div>
        </div>
      </div>

      {/* Controls help */}
      <div className="absolute bottom-4 right-4 bg-slate-800/90 backdrop-blur border border-slate-600 rounded-lg p-3">
        <div className="text-xs text-slate-300 space-y-1">
          <div className="font-semibold mb-2">Controls</div>
          <div>Left Click: Place spawn / Select</div>
          <div>Right Drag: Rotate camera</div>
          <div>Scroll: Zoom</div>
          <div>Middle Drag: Pan</div>
        </div>
      </div>
    </div>
  );
}
