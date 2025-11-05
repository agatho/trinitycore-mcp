'use client';

import React, { useState, useRef, useEffect } from 'react';
import { MapPin, Layers, Settings, Download, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { MapFileBrowser } from '@/components/map-file-browser';
import { MapRenderer, RenderMode, ColorScheme } from '@/lib/map-renderer';
import type { ParsedMapFile } from '@/lib/map-file-parser';

export default function MapViewerPage() {
  const [loadedMap, setLoadedMap] = useState<ParsedMapFile | null>(null);
  const [renderMode, setRenderMode] = useState<RenderMode>('heightmap');
  const [colorScheme, setColorScheme] = useState<ColorScheme>('elevation');
  const [scale, setScale] = useState<number>(2);
  const [contourInterval, setContourInterval] = useState<number>(10);
  const [error, setError] = useState<string | null>(null);
  const [rendering, setRendering] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<MapRenderer | null>(null);

  // Initialize renderer when canvas is ready
  useEffect(() => {
    if (canvasRef.current && !rendererRef.current) {
      rendererRef.current = new MapRenderer(canvasRef.current);
    }
  }, []);

  // Render map when settings change
  useEffect(() => {
    if (loadedMap && rendererRef.current) {
      renderMap();
    }
  }, [loadedMap, renderMode, colorScheme, scale, contourInterval]);

  const renderMap = async () => {
    if (!loadedMap || !rendererRef.current) return;

    setRendering(true);
    setError(null);

    try {
      await rendererRef.current.render(loadedMap, {
        mode: renderMode,
        colorScheme,
        scale,
        contourInterval,
        showGrid: false,
        gridSize: 16,
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Rendering failed';
      setError(errorMsg);
      console.error('Rendering error:', err);
    } finally {
      setRendering(false);
    }
  };

  const handleMapLoad = (parsedMap: ParsedMapFile) => {
    setLoadedMap(parsedMap);
    setError(null);
  };

  const handleError = (errorMsg: string) => {
    setError(errorMsg);
  };

  const handleExportPNG = () => {
    if (rendererRef.current && loadedMap) {
      rendererRef.current.exportToPNG(`${loadedMap.filename}_${renderMode}.png`);
    }
  };

  const handleReset = () => {
    setRenderMode('heightmap');
    setColorScheme('elevation');
    setScale(2);
    setContourInterval(10);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8">
      <div className="max-w-[1800px] mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <MapPin className="w-8 h-8 text-blue-400" />
              <div>
                <h1 className="text-3xl font-bold text-white">TrinityCore Map Viewer</h1>
                <p className="text-slate-400">
                  Visualize extracted .map files with multiple render modes
                </p>
              </div>
            </div>
            {loadedMap && (
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleReset}>
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Reset View
                </Button>
                <Button variant="outline" onClick={handleExportPNG}>
                  <Download className="w-4 h-4 mr-2" />
                  Export PNG
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-[1fr_400px] gap-6">
          {/* Left Side - Canvas */}
          <div className="space-y-6">
            {/* Map Info */}
            {loadedMap && (
              <Card className="bg-slate-800/50 backdrop-blur border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Layers className="w-5 h-5 text-blue-400" />
                    {loadedMap.filename}
                  </CardTitle>
                  <CardDescription>
                    <div className="grid grid-cols-2 gap-4 mt-2 text-sm">
                      <div>
                        <span className="text-slate-500">Map ID:</span>{' '}
                        <span className="text-white font-mono">{loadedMap.mapId}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">Grid:</span>{' '}
                        <span className="text-white font-mono">
                          ({loadedMap.gridX}, {loadedMap.gridY})
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500">Height Range:</span>{' '}
                        <span className="text-white font-mono">
                          {loadedMap.heightMap.minHeight.toFixed(2)}m - {loadedMap.heightMap.maxHeight.toFixed(2)}m
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500">Grid Size:</span>{' '}
                        <span className="text-white font-mono">
                          {loadedMap.heightMap.gridWidth}x{loadedMap.heightMap.gridHeight}
                        </span>
                      </div>
                    </div>
                  </CardDescription>
                </CardHeader>
              </Card>
            )}

            {/* Canvas */}
            <Card className="bg-slate-800/50 backdrop-blur border-slate-700">
              <CardContent className="p-6">
                {rendering && (
                  <div className="absolute inset-0 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm rounded-lg z-10">
                    <div className="text-white text-lg">Rendering...</div>
                  </div>
                )}
                <div className="relative">
                  <canvas
                    ref={canvasRef}
                    className="w-full h-auto border border-slate-700 rounded-lg bg-slate-900"
                    style={{ maxHeight: '800px' }}
                  />
                  {!loadedMap && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center text-slate-400">
                        <MapPin className="w-16 h-16 mx-auto mb-4 opacity-20" />
                        <p>Load a map file to begin</p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Side - Controls */}
          <div className="space-y-6">
            <Tabs defaultValue="browser" className="w-full">
              <TabsList className="grid w-full grid-cols-2 bg-slate-800 border-slate-700">
                <TabsTrigger value="browser" className="data-[state=active]:bg-slate-700">
                  Browser
                </TabsTrigger>
                <TabsTrigger value="settings" className="data-[state=active]:bg-slate-700">
                  Settings
                </TabsTrigger>
              </TabsList>

              {/* Map Browser Tab */}
              <TabsContent value="browser" className="mt-4">
                <MapFileBrowser onMapLoad={handleMapLoad} onError={handleError} />
              </TabsContent>

              {/* Settings Tab */}
              <TabsContent value="settings" className="mt-4">
                <Card className="bg-slate-800/50 backdrop-blur border-slate-700">
                  <CardHeader>
                    <CardTitle className="text-white flex items-center gap-2">
                      <Settings className="w-5 h-5" />
                      Render Settings
                    </CardTitle>
                    <CardDescription>Customize map visualization</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Render Mode */}
                    <div className="space-y-2">
                      <Label htmlFor="render-mode" className="text-white">
                        Render Mode
                      </Label>
                      <Select
                        value={renderMode}
                        onValueChange={(value) => setRenderMode(value as RenderMode)}
                      >
                        <SelectTrigger id="render-mode" className="bg-slate-700 border-slate-600 text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-700 border-slate-600">
                          <SelectItem value="heightmap">Heightmap</SelectItem>
                          <SelectItem value="contours">Contour Lines</SelectItem>
                          <SelectItem value="wireframe">Wireframe</SelectItem>
                          <SelectItem value="shaded">Shaded Relief</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-slate-400">
                        {renderMode === 'heightmap' && 'Color-coded elevation visualization'}
                        {renderMode === 'contours' && 'Topographic contour lines'}
                        {renderMode === 'wireframe' && '3D wireframe mesh view'}
                        {renderMode === 'shaded' && 'Hillshade with directional lighting'}
                      </p>
                    </div>

                    {/* Color Scheme */}
                    <div className="space-y-2">
                      <Label htmlFor="color-scheme" className="text-white">
                        Color Scheme
                      </Label>
                      <Select
                        value={colorScheme}
                        onValueChange={(value) => setColorScheme(value as ColorScheme)}
                      >
                        <SelectTrigger id="color-scheme" className="bg-slate-700 border-slate-600 text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-700 border-slate-600">
                          <SelectItem value="grayscale">Grayscale</SelectItem>
                          <SelectItem value="elevation">Elevation</SelectItem>
                          <SelectItem value="terrain">Terrain</SelectItem>
                          <SelectItem value="heatmap">Heatmap</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Scale */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="scale" className="text-white">
                          Scale
                        </Label>
                        <span className="text-sm text-slate-400">{scale}x</span>
                      </div>
                      <Slider
                        id="scale"
                        min={1}
                        max={8}
                        step={1}
                        value={[scale]}
                        onValueChange={(value) => setScale(value[0])}
                        className="py-4"
                      />
                    </div>

                    {/* Contour Interval (only for contours mode) */}
                    {renderMode === 'contours' && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="contour-interval" className="text-white">
                            Contour Interval
                          </Label>
                          <span className="text-sm text-slate-400">{contourInterval}m</span>
                        </div>
                        <Slider
                          id="contour-interval"
                          min={5}
                          max={50}
                          step={5}
                          value={[contourInterval]}
                          onValueChange={(value) => setContourInterval(value[0])}
                          className="py-4"
                        />
                      </div>
                    )}

                    {/* Legend */}
                    {loadedMap && (
                      <div className="pt-4 border-t border-slate-700">
                        <h4 className="text-sm font-semibold text-white mb-2">Legend</h4>
                        <div className="space-y-2 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400">Min Elevation:</span>
                            <span className="text-white font-mono">
                              {loadedMap.heightMap.minHeight.toFixed(2)}m
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400">Max Elevation:</span>
                            <span className="text-white font-mono">
                              {loadedMap.heightMap.maxHeight.toFixed(2)}m
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400">Range:</span>
                            <span className="text-white font-mono">
                              {(loadedMap.heightMap.maxHeight - loadedMap.heightMap.minHeight).toFixed(2)}m
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
}
