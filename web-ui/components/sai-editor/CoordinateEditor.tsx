/**
 * Coordinate Editor Component
 *
 * Professional editor for target position coordinates (x, y, z, orientation).
 * Supports manual input, clipboard paste, and visual orientation picker.
 */

'use client';

import React, { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MapPin, Copy, Clipboard, RotateCw, Info, Map } from 'lucide-react';
import { toast } from 'sonner';
import MapCoordinatePicker from './MapCoordinatePicker';

interface TargetPosition {
  x: number;
  y: number;
  z: number;
  o: number;
}

interface CoordinateEditorProps {
  value?: TargetPosition;
  onChange: (position: TargetPosition) => void;
  className?: string;
}

const DEFAULT_POSITION: TargetPosition = { x: 0, y: 0, z: 0, o: 0 };

export const CoordinateEditor: React.FC<CoordinateEditorProps> = ({
  value = DEFAULT_POSITION,
  onChange,
  className,
}) => {
  const [position, setPosition] = React.useState<TargetPosition>(value);

  // Update local state when props change
  React.useEffect(() => {
    setPosition(value);
  }, [value]);

  // Handle coordinate change
  const handleChange = (field: keyof TargetPosition, valueStr: string) => {
    const numValue = parseFloat(valueStr);
    if (isNaN(numValue)) return;

    const newPosition = { ...position, [field]: numValue };
    setPosition(newPosition);
    onChange(newPosition);
  };

  // Convert radians to degrees
  const radToDeg = (rad: number): number => {
    return (rad * 180) / Math.PI;
  };

  // Convert degrees to radians
  const degToRad = (deg: number): number => {
    return (deg * Math.PI) / 180;
  };

  // Handle orientation in degrees
  const handleOrientationDegrees = (degStr: string) => {
    const deg = parseFloat(degStr);
    if (isNaN(deg)) return;

    const rad = degToRad(deg);
    const newPosition = { ...position, o: rad };
    setPosition(newPosition);
    onChange(newPosition);
  };

  // Copy to clipboard
  const handleCopyCoords = () => {
    const coordStr = `X: ${position.x.toFixed(2)}, Y: ${position.y.toFixed(2)}, Z: ${position.z.toFixed(2)}, O: ${position.o.toFixed(4)}`;
    navigator.clipboard.writeText(coordStr);
    toast.success('Coordinates copied to clipboard');
  };

  // Paste from clipboard (expects format: "X: 1.23, Y: 4.56, Z: 7.89, O: 1.57" or similar)
  const handlePasteCoords = async () => {
    try {
      const text = await navigator.clipboard.readText();

      // Try to parse coordinates
      const xMatch = text.match(/[Xx]:?\s*([-\d.]+)/);
      const yMatch = text.match(/[Yy]:?\s*([-\d.]+)/);
      const zMatch = text.match(/[Zz]:?\s*([-\d.]+)/);
      const oMatch = text.match(/[Oo]:?\s*([-\d.]+)/);

      if (xMatch || yMatch || zMatch) {
        const newPosition = {
          x: xMatch ? parseFloat(xMatch[1]) : position.x,
          y: yMatch ? parseFloat(yMatch[1]) : position.y,
          z: zMatch ? parseFloat(zMatch[1]) : position.z,
          o: oMatch ? parseFloat(oMatch[1]) : position.o,
        };

        setPosition(newPosition);
        onChange(newPosition);
        toast.success('Coordinates pasted from clipboard');
      } else {
        toast.error('Could not parse coordinates from clipboard');
      }
    } catch (error) {
      toast.error('Failed to paste from clipboard');
    }
  };

  // Clear coordinates
  const handleClear = () => {
    setPosition(DEFAULT_POSITION);
    onChange(DEFAULT_POSITION);
  };

  // Check if coordinates are set
  const hasCoordinates = position.x !== 0 || position.y !== 0 || position.z !== 0 || position.o !== 0;

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Target Coordinates
          </CardTitle>
          {hasCoordinates && (
            <Badge variant="default">Set</Badge>
          )}
        </div>
        <CardDescription className="text-xs flex items-start gap-1">
          <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
          <span>
            Specify target position for movement, summon, teleport, or jump actions. Leave at 0 for relative positioning.
          </span>
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <Tabs defaultValue="manual" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="manual">Manual Entry</TabsTrigger>
            <TabsTrigger value="map">
              <Map className="w-4 h-4 mr-1" />
              Map Picker
            </TabsTrigger>
          </TabsList>

          <TabsContent value="manual" className="space-y-4 mt-4">
            {/* X, Y Coordinates */}
            <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="coord-x" className="text-xs">
              X Coordinate
            </Label>
            <Input
              id="coord-x"
              type="number"
              step="0.01"
              value={position.x.toFixed(2)}
              onChange={(e) => handleChange('x', e.target.value)}
              className="font-mono"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="coord-y" className="text-xs">
              Y Coordinate
            </Label>
            <Input
              id="coord-y"
              type="number"
              step="0.01"
              value={position.y.toFixed(2)}
              onChange={(e) => handleChange('y', e.target.value)}
              className="font-mono"
            />
          </div>
        </div>

        {/* Z, Orientation */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="coord-z" className="text-xs">
              Z Coordinate (Height)
            </Label>
            <Input
              id="coord-z"
              type="number"
              step="0.01"
              value={position.z.toFixed(2)}
              onChange={(e) => handleChange('z', e.target.value)}
              className="font-mono"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="coord-o" className="text-xs flex items-center gap-1">
              <RotateCw className="h-3 w-3" />
              Orientation
            </Label>
            <div className="space-y-1">
              <Input
                id="coord-o-deg"
                type="number"
                step="1"
                min="0"
                max="360"
                value={radToDeg(position.o).toFixed(0)}
                onChange={(e) => handleOrientationDegrees(e.target.value)}
                className="font-mono"
                placeholder="Degrees (0-360)"
              />
              <p className="text-xs text-gray-500">
                {position.o.toFixed(4)} rad
              </p>
            </div>
          </div>
        </div>

        {/* Orientation Visual Picker */}
        <div className="space-y-2">
          <Label className="text-xs">Visual Orientation Picker</Label>
          <div className="flex items-center justify-center p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
            <div className="relative w-32 h-32">
              {/* Circle */}
              <svg
                viewBox="0 0 100 100"
                className="w-full h-full"
              >
                {/* Background circle */}
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="text-gray-300 dark:text-gray-700"
                />

                {/* Direction indicators */}
                <text x="50" y="10" textAnchor="middle" className="text-xs fill-gray-500">N</text>
                <text x="90" y="55" textAnchor="middle" className="text-xs fill-gray-500">E</text>
                <text x="50" y="95" textAnchor="middle" className="text-xs fill-gray-500">S</text>
                <text x="10" y="55" textAnchor="middle" className="text-xs fill-gray-500">W</text>

                {/* Orientation arrow */}
                <line
                  x1="50"
                  y1="50"
                  x2={50 + 35 * Math.cos(position.o - Math.PI / 2)}
                  y2={50 + 35 * Math.sin(position.o - Math.PI / 2)}
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  className="text-blue-500"
                />

                {/* Arrowhead */}
                <circle
                  cx={50 + 35 * Math.cos(position.o - Math.PI / 2)}
                  cy={50 + 35 * Math.sin(position.o - Math.PI / 2)}
                  r="4"
                  fill="currentColor"
                  className="text-blue-500"
                />

                {/* Center dot */}
                <circle
                  cx="50"
                  cy="50"
                  r="3"
                  fill="currentColor"
                  className="text-gray-400"
                />
              </svg>
            </div>
          </div>
          <div className="text-center text-xs text-gray-500">
            {radToDeg(position.o).toFixed(0)}° ({['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(radToDeg(position.o) / 45) % 8]})
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyCoords}
            className="flex-1"
          >
            <Copy className="h-3 w-3 mr-2" />
            Copy
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handlePasteCoords}
            className="flex-1"
          >
            <Clipboard className="h-3 w-3 mr-2" />
            Paste
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleClear}
            className="flex-1"
          >
            Clear
          </Button>
        </div>

            {/* Info Display */}
            {hasCoordinates && (
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-xs space-y-1">
                <p className="font-medium text-blue-900 dark:text-blue-100">
                  Position Summary:
                </p>
                <p className="text-blue-800 dark:text-blue-200 font-mono">
                  ({position.x.toFixed(2)}, {position.y.toFixed(2)}, {position.z.toFixed(2)})
                  facing {radToDeg(position.o).toFixed(0)}°
                </p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="map" className="mt-4">
            <MapCoordinatePicker value={position} onChange={onChange} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default CoordinateEditor;
