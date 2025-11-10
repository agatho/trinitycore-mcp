'use client';

/**
 * Enhanced World Editor
 *
 * Unified editor combining 2D map view and 3D visualization with:
 * - Split-screen mode (2D + 3D side-by-side)
 * - Tabbed mode (switch between 2D/3D)
 * - Picture-in-picture mode (3D main + 2D minimap)
 */

import React, { useState, useEffect } from 'react';
import {
  Map as MapIcon,
  Box,
  Layout,
  Maximize2,
  Minimize2,
  SplitSquareHorizontal,
  Layers,
  Upload,
  Download,
  Save,
  Settings,
  Grid3x3,
  CheckCircle,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { WoWMaps, generateSpawnSQL, generateWaypointSQL, exportMapData } from '@/lib/map-editor';
import { useWorldEditorState, type ViewMode } from './hooks/useWorldEditorState';
import { loadVMapData } from '@/lib/vmap-parser';
import { loadMMapData } from '@/lib/mmap-parser';
import { loadMapData } from '@/lib/map-parser';
import { useAutoLoadCollisionData } from '@/lib/hooks/useAutoLoadCollisionData';
import { MapView2D } from './components/MapView2D';
import { MapView2DEnhanced } from './components/MapView2DEnhanced';
import { MapView3D } from './components/MapView3D';
import { UndoRedoPanel } from './components/UndoRedoPanel';
import MapExtractionPanel from '@/components/map/MapExtractionPanel';

export default function WorldEditorPage() {
  const [state, actions] = useWorldEditorState();
  const [showExtractionPanel, setShowExtractionPanel] = useState(false);

  // Auto-load collision data from configured paths
  const autoLoadResult = useAutoLoadCollisionData(state.selectedMap, {
    autoLoad: true,
    maxTiles: 100,
    verbose: false,
  });

  // Update collision data when auto-load completes
  useEffect(() => {
    if (autoLoadResult.vmap && !state.vmapData) {
      actions.setVMapData(autoLoadResult.vmap);
    }
    if (autoLoadResult.mmap && !state.mmapData) {
      actions.setMMapData(autoLoadResult.mmap);
    }

    // Update status
    actions.setCollisionDataStatus({
      vmap: autoLoadResult.status.vmap === 'loaded' ? 'loaded' :
            autoLoadResult.status.vmap === 'loading' ? 'loading' :
            autoLoadResult.status.vmap === 'error' ? 'error' : 'none',
      mmap: autoLoadResult.status.mmap === 'loaded' ? 'loaded' :
            autoLoadResult.status.mmap === 'loading' ? 'loading' :
            autoLoadResult.status.mmap === 'error' ? 'error' : 'none',
      message: autoLoadResult.status.vmapMessage || autoLoadResult.status.mmapMessage,
    });
  }, [autoLoadResult.vmap, autoLoadResult.mmap, autoLoadResult.status]);

  // Handle VMap file upload
  const handleVMapUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    actions.setCollisionDataStatus({ ...state.collisionDataStatus, vmap: 'loading', message: 'Loading VMap files...' });

    try {
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

      const treeBuffer = await treeFile.arrayBuffer();
      const tileBuffers = new Map<string, ArrayBuffer>();

      for (const tileFile of tileFiles) {
        const match = tileFile.name.match(/(\d+)_(\d+)\.vmtile/);
        if (match) {
          const tileX = parseInt(match[1], 10);
          const tileY = parseInt(match[2], 10);
          const buffer = await tileFile.arrayBuffer();
          tileBuffers.set(`${tileX}_${tileY}`, buffer);
        }
      }

      const mapData = Object.values(WoWMaps).find(m => m.id === state.selectedMap);
      const mapName = mapData?.name || `Map ${state.selectedMap}`;

      const vmap = loadVMapData(state.selectedMap, mapName, treeBuffer, tileBuffers, {
        verbose: true,
        maxTiles: 100,
      });

      actions.setVMapData(vmap);
      actions.setCollisionDataStatus({
        ...state.collisionDataStatus,
        vmap: 'loaded',
        message: `VMap loaded: ${vmap.allSpawns.length} spawns, ${vmap.tiles.size} tiles`,
      });
    } catch (error: any) {
      console.error('Failed to load VMap:', error);
      actions.setCollisionDataStatus({
        ...state.collisionDataStatus,
        vmap: 'error',
        message: `VMap error: ${error.message}`,
      });
    }
  };

  // Handle map image upload
  const handleMapImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => actions.setMapImage(img);
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle TrinityCore .map file upload
  const handleMapFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    actions.setCollisionDataStatus({ ...state.collisionDataStatus, map: 'loading', message: 'Loading .map files...' });

    try {
      const fileBuffers = new Map<string, ArrayBuffer>();

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.name.endsWith('.map')) {
          const buffer = await file.arrayBuffer();
          fileBuffers.set(file.name, buffer);
        }
      }

      if (fileBuffers.size === 0) {
        throw new Error('No .map files found. Please select TrinityCore terrain map files.');
      }

      const mapInfo = Object.values(WoWMaps).find(m => m.id === state.selectedMap);
      const mapName = mapInfo?.name || `Map ${state.selectedMap}`;

      const mapData = loadMapData(state.selectedMap, mapName, fileBuffers, {
        verbose: true,
        maxTiles: 100,
      });

      actions.setMapData(mapData);
      actions.setCollisionDataStatus({
        ...state.collisionDataStatus,
        map: 'loaded',
        message: `Map loaded: ${mapData.tiles.size} tiles`,
      });
    } catch (error: any) {
      console.error('Failed to load .map files:', error);
      actions.setCollisionDataStatus({
        ...state.collisionDataStatus,
        map: 'error',
        message: `Map error: ${error.message}`,
      });
    }
  };

  // Handle MMap file upload
  const handleMMapUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    actions.setCollisionDataStatus({ ...state.collisionDataStatus, mmap: 'loading', message: 'Loading MMap files...' });

    try {
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

      const headerBuffer = await headerFile.arrayBuffer();
      const tileBuffers = new Map<string, ArrayBuffer>();

      for (const tileFile of tileFiles) {
        // TrinityCore format: <mapId><x><y>.mmtile (e.g., 00003248.mmtile)
        const match = tileFile.name.match(/(\d{4})(\d{2})(\d{2})\.mmtile/);
        if (match) {
          const fileMapId = parseInt(match[1], 10);
          const tileX = parseInt(match[2], 10);
          const tileY = parseInt(match[3], 10);

          // Verify mapId matches selected map
          if (fileMapId !== state.selectedMap) {
            console.warn(`Skipping ${tileFile.name}: mapId ${fileMapId} doesn't match selected map ${state.selectedMap}`);
            continue;
          }

          const buffer = await tileFile.arrayBuffer();
          tileBuffers.set(`${tileX}_${tileY}`, buffer);
        }
      }

      const mapData = Object.values(WoWMaps).find(m => m.id === state.selectedMap);
      const mapName = mapData?.name || `Map ${state.selectedMap}`;

      const mmap = loadMMapData(state.selectedMap, mapName, headerBuffer, tileBuffers, {
        verbose: true,
        maxTiles: 100,
      });

      actions.setMMapData(mmap);
      actions.setCollisionDataStatus({
        ...state.collisionDataStatus,
        mmap: 'loaded',
        message: `MMap loaded: ${mmap.tiles.size} tiles`,
      });
    } catch (error: any) {
      console.error('Failed to load MMap:', error);
      actions.setCollisionDataStatus({
        ...state.collisionDataStatus,
        mmap: 'error',
        message: `MMap error: ${error.message}`,
      });
    }
  };

  // Export SQL
  const exportSQL = () => {
    let sql = `-- World Editor Export\n-- Map ID: ${state.selectedMap}\n-- Generated: ${new Date().toISOString()}\n\n`;

    state.coordinates.forEach(coord => {
      if (coord.type === 'spawn') {
        sql += generateSpawnSQL(coord, 1234) + '\n\n';
      }
    });

    state.waypointPaths.forEach(path => {
      sql += generateWaypointSQL(path) + '\n\n';
    });

    const blob = new Blob([sql], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `world_editor_map_${state.selectedMap}_${Date.now()}.sql`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Export JSON
  const exportJSON = () => {
    const json = exportMapData(state.coordinates, state.roads, state.transitions, state.waypointPaths);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `world_editor_map_${state.selectedMap}_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Render view mode content
  const renderViewContent = () => {
    switch (state.viewMode) {
      case 'split':
        return (
          <div className="grid grid-cols-2 gap-4 h-full">
            <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <MapIcon className="w-4 h-4" />
                  2D Map View
                </h3>
              </div>
              <MapView2DEnhanced
                state={state}
                actions={actions}
                width={600}
                height={600}
                onRequestExtraction={() => setShowExtractionPanel(true)}
              />
            </div>
            <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Box className="w-4 h-4" />
                  3D View
                </h3>
              </div>
              <MapView3D state={state} actions={actions} width={600} height={600} />
            </div>
          </div>
        );

      case 'tabbed':
        return (
          <Tabs value={state.activeView} onValueChange={(v) => actions.setActiveView(v as '2d' | '3d')} className="h-full">
            <TabsList className="grid grid-cols-2 w-[400px]">
              <TabsTrigger value="2d" className="flex items-center gap-2">
                <MapIcon className="w-4 h-4" />
                2D Map
              </TabsTrigger>
              <TabsTrigger value="3d" className="flex items-center gap-2">
                <Box className="w-4 h-4" />
                3D View
              </TabsTrigger>
            </TabsList>
            <TabsContent value="2d" className="mt-4">
              <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-lg p-4">
                <MapView2DEnhanced
                  state={state}
                  actions={actions}
                  width={1400}
                  height={700}
                  onRequestExtraction={() => setShowExtractionPanel(true)}
                />
              </div>
            </TabsContent>
            <TabsContent value="3d" className="mt-4">
              <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-lg p-4">
                <MapView3D state={state} actions={actions} width={1400} height={700} />
              </div>
            </TabsContent>
          </Tabs>
        );

      case 'pip':
        return (
          <div className="relative h-full">
            <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-lg p-4 h-full">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Box className="w-4 h-4" />
                  3D View (Main)
                </h3>
              </div>
              <MapView3D state={state} actions={actions} width={1400} height={700} />
            </div>
            {/* Minimap overlay */}
            <div className="absolute bottom-6 right-6 w-80 h-60 bg-slate-800 border-2 border-slate-600 rounded-lg p-2 shadow-2xl">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-semibold text-white flex items-center gap-1">
                  <MapIcon className="w-3 h-3" />
                  2D Minimap
                </h4>
                <Button variant="ghost" size="icon" className="h-6 w-6">
                  <Minimize2 className="w-3 h-3" />
                </Button>
              </div>
              <MapView2DEnhanced
                state={state}
                actions={actions}
                width={300}
                height={200}
                onRequestExtraction={() => setShowExtractionPanel(true)}
              />
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8">
      {/* Undo/Redo Panel (Global) */}
      <UndoRedoPanel position="top-right" />

      <div className="max-w-[1920px] mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Layout className="w-8 h-8 text-blue-400" />
              <div>
                <h1 className="text-3xl font-bold text-white">Enhanced World Editor</h1>
                <p className="text-slate-400">
                  Professional map editor with 2D/3D views, collision detection, and spawn placement
                </p>
              </div>
            </div>
            <div className="flex gap-2">
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
                    Settings
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Editor Settings</DialogTitle>
                    <DialogDescription>Configure world editor preferences</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label>Show Grid</Label>
                      <Switch checked={state.showGrid} onCheckedChange={actions.setShowGrid} />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label>Snap to Grid</Label>
                      <Switch checked={state.snapToGridEnabled} onCheckedChange={actions.setSnapToGridEnabled} />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label>Auto-detect Height</Label>
                      <Switch
                        checked={state.autoDetectHeight}
                        onCheckedChange={actions.setAutoDetectHeight}
                        disabled={!state.vmapData && !state.mmapData}
                      />
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-6">
            {/* Map Selection */}
            <div className="flex items-center gap-2">
              <Label className="text-sm text-slate-300">Map:</Label>
              <Select
                value={state.selectedMap.toString()}
                onValueChange={(v) => actions.setSelectedMap(parseInt(v))}
              >
                <SelectTrigger className="w-[250px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(WoWMaps).map((map) => (
                    <SelectItem key={map.id} value={map.id.toString()}>
                      {map.name} (ID: {map.id})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* View Mode Selection */}
            <div className="flex items-center gap-2">
              <Label className="text-sm text-slate-300">View:</Label>
              <div className="flex gap-1 bg-slate-900 p-1 rounded">
                <Button
                  variant={state.viewMode === 'split' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => actions.setViewMode('split')}
                  className="gap-2"
                >
                  <SplitSquareHorizontal className="w-4 h-4" />
                  Split
                </Button>
                <Button
                  variant={state.viewMode === 'tabbed' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => actions.setViewMode('tabbed')}
                  className="gap-2"
                >
                  <Layers className="w-4 h-4" />
                  Tabs
                </Button>
                <Button
                  variant={state.viewMode === 'pip' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => actions.setViewMode('pip')}
                  className="gap-2"
                >
                  <Maximize2 className="w-4 h-4" />
                  PiP
                </Button>
              </div>
            </div>

            <div className="h-6 w-px bg-slate-600" />

            {/* Map Image Upload */}
            <div className="flex items-center gap-2">
              <input
                type="file"
                accept="image/*"
                onChange={handleMapImageUpload}
                className="hidden"
                id="map-image-upload"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => document.getElementById('map-image-upload')?.click()}
              >
                <Upload className="w-3 h-3 mr-2" />
                {state.mapImage ? 'Change Map Image' : 'Upload Map Image'}
              </Button>
              {state.mapImage && (
                <CheckCircle className="w-4 h-4 text-green-400" />
              )}
            </div>

            <div className="h-6 w-px bg-slate-600" />

            {/* Collision Data Status */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  accept=".map"
                  onChange={handleMapFileUpload}
                  className="hidden"
                  id="map-upload"
                  multiple
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => document.getElementById('map-upload')?.click()}
                  disabled={state.collisionDataStatus.map === 'loading'}
                  title="Upload TrinityCore .map terrain height files"
                >
                  <Upload className="w-3 h-3 mr-2" />
                  {state.collisionDataStatus.map === 'loading' ? 'Loading .map...' : 'Upload .map'}
                </Button>
                {state.collisionDataStatus.map === 'loaded' && (
                  <CheckCircle className="w-4 h-4 text-green-400" />
                )}
                {state.collisionDataStatus.map === 'error' && (
                  <AlertCircle className="w-4 h-4 text-red-400" />
                )}
              </div>

              <div className="flex items-center gap-2">
                {/* Auto-load status indicator */}
                {autoLoadResult.status.vmap === 'checking' && (
                  <span className="text-xs text-blue-400">Checking...</span>
                )}
                {autoLoadResult.status.vmap === 'unavailable' && (
                  <span className="text-xs text-slate-500">Not configured</span>
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
                  onClick={() => document.getElementById('vmap-upload')?.click()}
                  disabled={state.collisionDataStatus.vmap === 'loading'}
                >
                  <Upload className="w-3 h-3 mr-2" />
                  {state.collisionDataStatus.vmap === 'loading' ? 'Loading VMap...' : 'Upload VMap'}
                </Button>
                {state.collisionDataStatus.vmap === 'loaded' && (
                  <CheckCircle className="w-4 h-4 text-green-400" />
                )}
                {state.collisionDataStatus.vmap === 'error' && (
                  <AlertCircle className="w-4 h-4 text-red-400" />
                )}
              </div>

              <div className="flex items-center gap-2">
                {/* Auto-load status indicator */}
                {autoLoadResult.status.mmap === 'checking' && (
                  <span className="text-xs text-blue-400">Checking...</span>
                )}
                {autoLoadResult.status.mmap === 'unavailable' && (
                  <span className="text-xs text-slate-500">Not configured</span>
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
                  onClick={() => document.getElementById('mmap-upload')?.click()}
                  disabled={state.collisionDataStatus.mmap === 'loading'}
                >
                  <Upload className="w-3 h-3 mr-2" />
                  {state.collisionDataStatus.mmap === 'loading' ? 'Loading MMap...' : 'Upload MMap'}
                </Button>
                {state.collisionDataStatus.mmap === 'loaded' && (
                  <CheckCircle className="w-4 h-4 text-green-400" />
                )}
                {state.collisionDataStatus.mmap === 'error' && (
                  <AlertCircle className="w-4 h-4 text-red-400" />
                )}
              </div>

              {/* Reload button for auto-load */}
              <Button
                variant="ghost"
                size="sm"
                onClick={autoLoadResult.reload}
                title="Reload collision data from configured paths"
              >
                <RefreshCw className="w-3 h-3" />
              </Button>
            </div>

            {/* Status Message */}
            {state.collisionDataStatus.message && (
              <div className="flex-1 text-sm text-slate-400">
                {state.collisionDataStatus.message}
              </div>
            )}
          </div>
        </div>

        {/* Main Content */}
        <div className="min-h-[700px]">
          {renderViewContent()}
        </div>

        {/* Stats Footer */}
        <div className="mt-6 bg-slate-800/50 backdrop-blur border border-slate-700 rounded-lg p-4">
          <div className="flex items-center justify-between text-sm text-slate-400">
            <div className="flex gap-6">
              <div>Spawns: {state.coordinates.filter(c => c.type === 'spawn').length}</div>
              <div>Roads: {state.roads.length}</div>
              <div>Waypoints: {state.waypointPaths.length}</div>
              <div>Transitions: {state.transitions.length}</div>
              <div>Selected: {state.selectedItems.size}</div>
            </div>
            <div className="flex gap-4">
              <div className={state.mapData ? 'text-green-400' : ''}>
                Map: {state.mapData ? `${state.mapData.tiles.size} tiles` : 'Not loaded'}
              </div>
              <div className={state.vmapData ? 'text-green-400' : ''}>
                VMap: {state.vmapData ? `${state.vmapData.allSpawns.length} spawns` : 'Not loaded'}
              </div>
              <div className={state.mmapData ? 'text-green-400' : ''}>
                MMap: {state.mmapData ? `${state.mmapData.tiles.size} tiles` : 'Not loaded'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Map Extraction Panel Dialog */}
      <Dialog open={showExtractionPanel} onOpenChange={setShowExtractionPanel}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Extract Map Tiles from WoW Installation</DialogTitle>
            <DialogDescription>
              Extract and tile map textures from your World of Warcraft installation for use in the World Editor.
            </DialogDescription>
          </DialogHeader>
          <MapExtractionPanel
            selectedMapId={state.selectedMap}
            onExtractionComplete={() => {
              setShowExtractionPanel(false);
              // Trigger a refresh of the map view
              window.location.reload();
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
