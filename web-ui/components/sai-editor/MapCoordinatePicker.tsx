/**
 * Map Coordinate Picker Component
 *
 * Interactive 2D map for visual coordinate selection.
 * Allows clicking on a map to select X/Y coordinates instead of manual entry.
 */

'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MapPin, Maximize2, Minimize2, Grid3x3, Crosshair, Copy, Check } from 'lucide-react';

interface MapCoordinatePickerProps {
  /** Current coordinates */
  value: { x: number; y: number; z: number; o: number };
  /** Callback when coordinates change */
  onChange: (coords: { x: number; y: number; z: number; o: number }) => void;
}

// Sample map zones (can be extended with real WoW maps)
const MAP_ZONES = [
  { id: 'generic', name: 'Generic Map', minX: -5000, maxX: 5000, minY: -5000, maxY: 5000, defaultZ: 0 },
  { id: 'stormwind', name: 'Stormwind City', minX: -9000, maxX: -8000, minY: 500, maxY: 1500, defaultZ: 60 },
  { id: 'orgrimmar', name: 'Orgrimmar', minX: 1200, maxX: 2200, minY: -4500, maxY: -3500, defaultZ: 25 },
  { id: 'elwynn', name: 'Elwynn Forest', minX: -9500, maxX: -8500, minY: -1000, maxY: 0, defaultZ: 50 },
  { id: 'durotar', name: 'Durotar', minX: -500, maxX: 2000, minY: -5000, maxY: -3000, defaultZ: 10 },
];

export const MapCoordinatePicker: React.FC<MapCoordinatePickerProps> = ({ value, onChange }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedZone, setSelectedZone] = useState(MAP_ZONES[0]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [hoveredCoords, setHoveredCoords] = useState<{ x: number; y: number } | null>(null);
  const [copied, setCopied] = useState(false);
  const [markers, setMarkers] = useState<Array<{ x: number; y: number; label: string }>>([]);

  const canvasSize = isExpanded ? 600 : 400;

  // Convert world coordinates to canvas coordinates
  const worldToCanvas = useCallback((worldX: number, worldY: number): { x: number; y: number } => {
    const { minX, maxX, minY, maxY } = selectedZone;
    const canvasX = ((worldX - minX) / (maxX - minX)) * canvasSize;
    const canvasY = canvasSize - ((worldY - minY) / (maxY - minY)) * canvasSize; // Flip Y axis
    return { x: canvasX, y: canvasY };
  }, [selectedZone, canvasSize]);

  // Convert canvas coordinates to world coordinates
  const canvasToWorld = useCallback((canvasX: number, canvasY: number): { x: number; y: number } => {
    const { minX, maxX, minY, maxY } = selectedZone;
    const worldX = minX + (canvasX / canvasSize) * (maxX - minX);
    const worldY = maxY - (canvasY / canvasSize) * (maxY - minY); // Flip Y axis
    return { x: Math.round(worldX * 100) / 100, y: Math.round(worldY * 100) / 100 };
  }, [selectedZone, canvasSize]);

  // Draw map
  const drawMap = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, canvasSize, canvasSize);

    // Draw grid
    if (showGrid) {
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 1;
      const gridSize = canvasSize / 10;
      for (let i = 0; i <= 10; i++) {
        // Vertical lines
        ctx.beginPath();
        ctx.moveTo(i * gridSize, 0);
        ctx.lineTo(i * gridSize, canvasSize);
        ctx.stroke();
        // Horizontal lines
        ctx.beginPath();
        ctx.moveTo(0, i * gridSize);
        ctx.lineTo(canvasSize, i * gridSize);
        ctx.stroke();
      }
    }

    // Draw zone border
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, canvasSize, canvasSize);

    // Draw markers
    markers.forEach((marker) => {
      const canvasPos = worldToCanvas(marker.x, marker.y);
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(canvasPos.x, canvasPos.y, 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#fff';
      ctx.font = '10px monospace';
      ctx.fillText(marker.label, canvasPos.x + 8, canvasPos.y - 8);
    });

    // Draw current position
    const currentPos = worldToCanvas(value.x, value.y);

    // Draw crosshair
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(currentPos.x - 10, currentPos.y);
    ctx.lineTo(currentPos.x + 10, currentPos.y);
    ctx.moveTo(currentPos.x, currentPos.y - 10);
    ctx.lineTo(currentPos.x, currentPos.y + 10);
    ctx.stroke();

    // Draw position marker
    ctx.fillStyle = '#3b82f6';
    ctx.beginPath();
    ctx.arc(currentPos.x, currentPos.y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw orientation indicator
    const orientationLength = 30;
    const orientationX = currentPos.x + orientationLength * Math.cos(value.o - Math.PI / 2);
    const orientationY = currentPos.y + orientationLength * Math.sin(value.o - Math.PI / 2);

    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(currentPos.x, currentPos.y);
    ctx.lineTo(orientationX, orientationY);
    ctx.stroke();

    // Draw arrow head
    const arrowSize = 8;
    const arrowAngle = 0.5;
    ctx.fillStyle = '#10b981';
    ctx.beginPath();
    ctx.moveTo(orientationX, orientationY);
    ctx.lineTo(
      orientationX - arrowSize * Math.cos(value.o - Math.PI / 2 - arrowAngle),
      orientationY - arrowSize * Math.sin(value.o - Math.PI / 2 - arrowAngle)
    );
    ctx.lineTo(
      orientationX - arrowSize * Math.cos(value.o - Math.PI / 2 + arrowAngle),
      orientationY - arrowSize * Math.sin(value.o - Math.PI / 2 + arrowAngle)
    );
    ctx.closePath();
    ctx.fill();

    // Draw hover indicator
    if (hoveredCoords) {
      const hoverPos = worldToCanvas(hoveredCoords.x, hoveredCoords.y);
      ctx.strokeStyle = '#666';
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(hoverPos.x - 5, hoverPos.y - 5, 10, 10);
      ctx.setLineDash([]);
    }
  }, [canvasSize, showGrid, value, worldToCanvas, hoveredCoords, markers]);

  // Redraw on changes
  useEffect(() => {
    drawMap();
  }, [drawMap]);

  // Handle canvas click
  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const canvasX = event.clientX - rect.left;
    const canvasY = event.clientY - rect.top;

    const worldCoords = canvasToWorld(canvasX, canvasY);

    onChange({
      x: worldCoords.x,
      y: worldCoords.y,
      z: value.z || selectedZone.defaultZ,
      o: value.o,
    });
  };

  // Handle canvas mouse move
  const handleCanvasMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const canvasX = event.clientX - rect.left;
    const canvasY = event.clientY - rect.top;

    const worldCoords = canvasToWorld(canvasX, canvasY);
    setHoveredCoords(worldCoords);
  };

  // Handle canvas mouse leave
  const handleCanvasMouseLeave = () => {
    setHoveredCoords(null);
  };

  // Handle zone change
  const handleZoneChange = (zoneId: string) => {
    const zone = MAP_ZONES.find((z) => z.id === zoneId);
    if (zone) {
      setSelectedZone(zone);
      // Reset Z to zone default
      onChange({ ...value, z: zone.defaultZ });
    }
  };

  // Add marker
  const handleAddMarker = () => {
    setMarkers([
      ...markers,
      { x: value.x, y: value.y, label: `M${markers.length + 1}` },
    ]);
  };

  // Clear markers
  const handleClearMarkers = () => {
    setMarkers([]);
  };

  // Copy coordinates
  const handleCopyCoordinates = () => {
    const coordsText = `${value.x.toFixed(2)}, ${value.y.toFixed(2)}, ${value.z.toFixed(2)}`;
    navigator.clipboard.writeText(coordsText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="p-4">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center gap-2">
          <MapPin className="w-5 h-5 text-blue-500" />
          <h3 className="font-semibold text-sm flex-1">Interactive Map Picker</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            title={isExpanded ? 'Minimize' : 'Maximize'}
          >
            {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </Button>
        </div>

        {/* Zone Selector */}
        <div className="space-y-2">
          <Label htmlFor="zone-select" className="text-xs font-medium">
            Map Zone
          </Label>
          <Select value={selectedZone.id} onValueChange={handleZoneChange}>
            <SelectTrigger id="zone-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MAP_ZONES.map((zone) => (
                <SelectItem key={zone.id} value={zone.id}>
                  {zone.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Canvas */}
        <div className="relative">
          <canvas
            ref={canvasRef}
            width={canvasSize}
            height={canvasSize}
            className="border border-gray-300 dark:border-gray-700 rounded cursor-crosshair w-full"
            onClick={handleCanvasClick}
            onMouseMove={handleCanvasMouseMove}
            onMouseLeave={handleCanvasMouseLeave}
            style={{ maxWidth: '100%', height: 'auto' }}
          />

          {/* Hover tooltip */}
          {hoveredCoords && (
            <div className="absolute top-2 left-2 bg-black/80 text-white px-2 py-1 rounded text-xs font-mono">
              X: {hoveredCoords.x.toFixed(2)}, Y: {hoveredCoords.y.toFixed(2)}
            </div>
          )}

          {/* Controls overlay */}
          <div className="absolute top-2 right-2 flex gap-1">
            <Button
              variant={showGrid ? 'default' : 'outline'}
              size="sm"
              onClick={() => setShowGrid(!showGrid)}
              title="Toggle Grid"
              className="h-8 w-8 p-0"
            >
              <Grid3x3 className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleAddMarker}
              title="Add Marker"
              className="h-8 w-8 p-0"
            >
              <MapPin className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Current Coordinates Display */}
        <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-medium text-xs text-gray-700 dark:text-gray-300">
              Current Position
            </h4>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopyCoordinates}
              className="h-6 px-2"
            >
              {copied ? (
                <Check className="w-3 h-3 text-green-500" />
              ) : (
                <Copy className="w-3 h-3" />
              )}
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs font-mono">
            <div>
              <span className="text-gray-500 dark:text-gray-400">X:</span>{' '}
              <span className="font-semibold">{value.x.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Y:</span>{' '}
              <span className="font-semibold">{value.y.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Z:</span>{' '}
              <span className="font-semibold">{value.z.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Z-axis control */}
        <div className="space-y-2">
          <Label htmlFor="z-input" className="text-xs font-medium">
            Z-Axis (Height)
          </Label>
          <Input
            id="z-input"
            type="number"
            step="0.01"
            value={value.z}
            onChange={(e) => onChange({ ...value, z: parseFloat(e.target.value) || 0 })}
            className="font-mono"
          />
        </div>

        {/* Markers */}
        {markers.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium">Markers ({markers.length})</Label>
              <Button variant="ghost" size="sm" onClick={handleClearMarkers} className="h-6 text-xs">
                Clear All
              </Button>
            </div>
            <div className="flex flex-wrap gap-1">
              {markers.map((marker, index) => (
                <Badge key={index} variant="outline" className="text-xs font-mono">
                  {marker.label}: {marker.x.toFixed(0)}, {marker.y.toFixed(0)}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <Crosshair className="w-4 h-4 text-blue-500 mt-0.5" />
            <div className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
              <p className="font-medium">How to use:</p>
              <ul className="list-disc list-inside space-y-0.5 ml-2">
                <li>Click anywhere on the map to set X/Y coordinates</li>
                <li>Blue marker shows current position</li>
                <li>Green arrow shows facing direction</li>
                <li>Add markers to save multiple positions</li>
                <li>Adjust Z-axis manually for height</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default MapCoordinatePicker;
