'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Map, Plus, Download, Upload, Save, Trash2, Move, Waypoints, Route, Link, MapPin, ZoomIn, ZoomOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
} from '@/lib/map-editor';

type Tool = 'select' | 'spawn' | 'waypoint' | 'road' | 'transition';

export default function MapPickerPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedMap, setSelectedMap] = useState(0);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // Tools
  const [currentTool, setCurrentTool] = useState<Tool>('select');
  const [coordinates, setCoordinates] = useState<MapCoordinate[]>([]);
  const [roads, setRoads] = useState<Road[]>([]);
  const [transitions, setTransitions] = useState<ZoneTransition[]>([]);
  const [waypointPaths, setWaypointPaths] = useState<WaypointPath[]>([]);

  // Drawing state
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPath, setCurrentPath] = useState<Array<{ x: number; y: number }>>([]);
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [mapImage, setMapImage] = useState<HTMLImageElement | null>(null);

  const CANVAS_WIDTH = 1200;
  const CANVAS_HEIGHT = 800;

  // Draw everything on canvas
  const draw = () => {
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

    // Draw map image if loaded
    if (mapImage) {
      ctx.drawImage(mapImage, 0, 0, CANVAS_WIDTH / scale, CANVAS_HEIGHT / scale);
    } else {
      // Draw grid
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
    roads.forEach(road => {
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = road.width / scale;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      road.points.forEach((point, i) => {
        if (i === 0) ctx.moveTo(point.x, point.y);
        else ctx.lineTo(point.x, point.y);
      });
      ctx.stroke();
    });

    // Draw waypoint paths
    waypointPaths.forEach(path => {
      ctx.strokeStyle = '#8b5cf6';
      ctx.lineWidth = 3 / scale;
      ctx.setLineDash([5 / scale, 5 / scale]);
      ctx.beginPath();
      path.waypoints.forEach((wp, i) => {
        if (i === 0) ctx.moveTo(wp.x, wp.y);
        else ctx.lineTo(wp.x, wp.y);
      });
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw waypoint circles
      path.waypoints.forEach(wp => {
        ctx.fillStyle = '#8b5cf6';
        ctx.beginPath();
        ctx.arc(wp.x, wp.y, 4 / scale, 0, Math.PI * 2);
        ctx.fill();
      });
    });

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
    coordinates.forEach(coord => {
      if (coord.type === 'spawn') {
        ctx.fillStyle = '#10b981';
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2 / scale;
        ctx.beginPath();
        ctx.arc(coord.x, coord.y, 8 / scale, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Draw label
        ctx.fillStyle = '#fff';
        ctx.font = `${12 / scale}px sans-serif`;
        ctx.fillText(coord.label || '', coord.x + 12 / scale, coord.y + 4 / scale);
      }
    });

    // Draw zone transitions
    transitions.forEach(transition => {
      ctx.fillStyle = '#ec4899';
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2 / scale;
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
      ctx.strokeStyle = '#ec4899';
      ctx.lineWidth = 2 / scale;
      ctx.beginPath();
      ctx.moveTo(transition.entranceCoord.x, transition.entranceCoord.y);
      ctx.lineTo(transition.exitCoord.x, transition.exitCoord.y);
      ctx.stroke();

      // Draw arrowhead
      const angle = Math.atan2(
        transition.exitCoord.y - transition.entranceCoord.y,
        transition.exitCoord.x - transition.entranceCoord.x
      );
      const headLength = 10 / scale;
      ctx.beginPath();
      ctx.moveTo(transition.exitCoord.x, transition.exitCoord.y);
      ctx.lineTo(
        transition.exitCoord.x - headLength * Math.cos(angle - Math.PI / 6),
        transition.exitCoord.y - headLength * Math.sin(angle - Math.PI / 6)
      );
      ctx.moveTo(transition.exitCoord.x, transition.exitCoord.y);
      ctx.lineTo(
        transition.exitCoord.x - headLength * Math.cos(angle + Math.PI / 6),
        transition.exitCoord.y - headLength * Math.sin(angle + Math.PI / 6)
      );
      ctx.stroke();
    });

    ctx.restore();
  };

  // Redraw on changes
  useEffect(() => {
    draw();
  }, [scale, offset, coordinates, roads, transitions, waypointPaths, currentPath, isDrawing, mapImage]);

  // Handle canvas click
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left - offset.x) / scale;
    const y = (e.clientY - rect.top - offset.y) / scale;

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
    }
  };

  const addSpawnPoint = (x: number, y: number) => {
    const newCoord: MapCoordinate = {
      id: `spawn-${Date.now()}`,
      x,
      y,
      z: 0,
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

  const finishDrawing = () => {
    if (currentTool === 'road' && currentPath.length >= 2) {
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
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => setMapImage(img);
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
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

  const importJSON = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e: any) => {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        const data = importMapData(event.target?.result as string);
        if (data) {
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
      setCoordinates([]);
      setRoads([]);
      setTransitions([]);
      setWaypointPaths([]);
      setCurrentPath([]);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8">
      <div className="max-w-[1800px] mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Map className="w-8 h-8 text-blue-400" />
              <div>
                <h1 className="text-3xl font-bold text-white">Map Coordinate Picker</h1>
                <p className="text-slate-400">
                  Enterprise-grade map editor for coordinates, roads, and zone transitions
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
              <Button variant="outline" onClick={importJSON}>
                <Upload className="w-4 h-4 mr-2" />
                Import JSON
              </Button>
              <Button variant="outline" onClick={clearAll}>
                <Trash2 className="w-4 h-4 mr-2" />
                Clear All
              </Button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-[250px_1fr_300px] gap-6">
          {/* Left Sidebar */}
          <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-white mb-4">Tools</h3>

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
                Spawn Point
              </Button>
              <Button
                variant={currentTool === 'waypoint' ? 'default' : 'outline'}
                className="w-full justify-start"
                onClick={() => setCurrentTool('waypoint')}
              >
                <Waypoints className="w-4 h-4 mr-2" />
                Waypoint Path
              </Button>
              <Button
                variant={currentTool === 'road' ? 'default' : 'outline'}
                className="w-full justify-start"
                onClick={() => setCurrentTool('road')}
              >
                <Route className="w-4 h-4 mr-2" />
                Road
              </Button>
              <Button
                variant={currentTool === 'transition' ? 'default' : 'outline'}
                className="w-full justify-start"
                onClick={() => setCurrentTool('transition')}
              >
                <Link className="w-4 h-4 mr-2" />
                Zone Transition
              </Button>

              {isDrawing && (
                <Button
                  variant="default"
                  className="w-full mt-4"
                  onClick={finishDrawing}
                >
                  Finish Drawing
                </Button>
              )}
            </div>

            <div className="mt-6 pt-6 border-t border-slate-700">
              <h3 className="text-sm font-semibold text-white mb-3">Map Selection</h3>
              <select
                className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white text-sm"
                value={selectedMap}
                onChange={(e) => setSelectedMap(Number(e.target.value))}
              >
                <option value={0}>Eastern Kingdoms (0)</option>
                <option value={1}>Kalimdor (1)</option>
                <option value={530}>Outland (530)</option>
                <option value={571}>Northrend (571)</option>
              </select>

              <input
                type="file"
                accept="image/*"
                onChange={handleMapUpload}
                className="hidden"
                id="mapUpload"
              />
              <Button
                variant="outline"
                className="w-full mt-3"
                onClick={() => document.getElementById('mapUpload')?.click()}
              >
                <Upload className="w-4 h-4 mr-2" />
                Upload Map Image
              </Button>
            </div>

            <div className="mt-6 pt-6 border-t border-slate-700">
              <h3 className="text-sm font-semibold text-white mb-2">Stats</h3>
              <div className="space-y-1 text-sm text-slate-400">
                <div>Spawn Points: {coordinates.filter(c => c.type === 'spawn').length}</div>
                <div>Roads: {roads.length}</div>
                <div>Transitions: {transitions.length}</div>
                <div>Waypoint Paths: {waypointPaths.length}</div>
              </div>
            </div>
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
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setScale(Math.min(5, scale * 1.2))}
                >
                  <ZoomIn className="w-4 h-4" />
                </Button>
                <div className="text-xs text-white text-center bg-slate-800 px-2 py-1 rounded border border-slate-600">
                  {Math.round(scale * 100)}%
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setScale(Math.max(0.1, scale / 1.2))}
                >
                  <ZoomOut className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="mt-4 text-sm text-slate-400">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  <span>Spawn Points</span>
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
              </div>
            </div>
          </div>

          {/* Right Sidebar */}
          <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-white mb-4">Properties</h3>

            <Tabs defaultValue="spawn">
              <TabsList className="grid grid-cols-3 mb-4">
                <TabsTrigger value="spawn">Spawns</TabsTrigger>
                <TabsTrigger value="roads">Roads</TabsTrigger>
                <TabsTrigger value="transitions">Portals</TabsTrigger>
              </TabsList>

              <TabsContent value="spawn">
                <div className="space-y-2 max-h-[600px] overflow-y-auto">
                  {coordinates.filter(c => c.type === 'spawn').map(coord => (
                    <div
                      key={coord.id}
                      className="p-3 bg-slate-700/50 rounded border border-slate-600 text-sm"
                    >
                      <div className="font-semibold text-white">{coord.label}</div>
                      <div className="text-slate-400 text-xs mt-1">
                        X: {coord.x.toFixed(2)}, Y: {coord.y.toFixed(2)}
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-2 w-full"
                        onClick={() => {
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
                  {roads.map(road => (
                    <div
                      key={road.id}
                      className="p-3 bg-slate-700/50 rounded border border-slate-600 text-sm"
                    >
                      <div className="font-semibold text-white">{road.name}</div>
                      <div className="text-slate-400 text-xs mt-1">
                        {road.points.length} waypoints
                      </div>
                      <div className="text-slate-400 text-xs">
                        Type: {road.type}
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="transitions">
                <div className="space-y-2 max-h-[600px] overflow-y-auto">
                  {transitions.map(transition => (
                    <div
                      key={transition.id}
                      className="p-3 bg-slate-700/50 rounded border border-slate-600 text-sm"
                    >
                      <div className="font-semibold text-white">
                        {transition.fromZone} → {transition.toZone}
                      </div>
                      <div className="text-slate-400 text-xs mt-1">
                        Type: {transition.type}
                      </div>
                      <div className="text-slate-400 text-xs">
                        {transition.bidirectional ? '↔ Bidirectional' : '→ One-way'}
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-2 w-full"
                        onClick={() => {
                          const sql = generateZoneTransitionSQL(transition);
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
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
}
