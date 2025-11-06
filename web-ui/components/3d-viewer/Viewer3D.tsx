"use client";

/**
 * 3D Viewer React Component
 *
 * React wrapper for the Three.js 3D renderer.
 * Provides a user-friendly interface for viewing VMap and MMap data.
 *
 * @module Viewer3D
 */

import React, { useEffect, useRef, useState } from "react";
import type { MMapData } from "@/lib/mmap-types";
import type { VMapData } from "@/lib/vmap-types";
import {
  CameraMode,
  type LayerVisibility,
  RenderLayer,
  Renderer3D,
  type RenderSettings,
  type RenderStats,
} from "@/lib/3d-renderer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Camera,
  Eye,
  EyeOff,
  Grid3x3,
  Maximize2,
  Navigation,
  Pause,
  Play,
  Settings,
} from "lucide-react";

// ============================================================================
// Props Interface
// ============================================================================

export interface Viewer3DProps {
  /** VMap data to visualize */
  vmapData?: VMapData;

  /** MMap data to visualize */
  mmapData?: MMapData;

  /** Initial render settings */
  settings?: Partial<RenderSettings>;

  /** Container height (default: 600px) */
  height?: number | string;

  /** Show controls panel */
  showControls?: boolean;

  /** Show stats panel */
  showStats?: boolean;

  /** Auto-start rendering */
  autoStart?: boolean;
}

// ============================================================================
// Component
// ============================================================================

export function Viewer3D({
  vmapData,
  mmapData,
  settings = {},
  height = 600,
  showControls = true,
  showStats = true,
  autoStart = true,
}: Viewer3DProps) {
  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<Renderer3D | null>(null);

  // State
  const [isRendering, setIsRendering] = useState(autoStart);
  const [cameraMode, setCameraMode] = useState<CameraMode>(CameraMode.Orbit);
  const [renderSettings, setRenderSettings] = useState<RenderSettings>({
    shadows: true,
    antialias: true,
    fog: false,
    fogDensity: 0.001,
    backgroundColor: 0x87ceeb,
    ambientLight: 0.5,
    directionalLight: 0.8,
    wireframe: false,
    vmapOpacity: 0.8,
    mmapOpacity: 0.6,
    heightScale: 1.0,
    frustumCulling: true,
    lod: true,
    ...settings,
  });
  const [layerVisibility, setLayerVisibility] = useState<LayerVisibility>({
    [RenderLayer.VMapCollision]: true,
    [RenderLayer.VMapSpawns]: true,
    [RenderLayer.MMapNavMesh]: true,
    [RenderLayer.MMapOffMesh]: true,
    [RenderLayer.Grid]: true,
    [RenderLayer.Axes]: true,
  });
  const [stats, setStats] = useState<RenderStats>({
    fps: 0,
    frameTime: 0,
    triangles: 0,
    drawCalls: 0,
    memory: 0,
    objects: 0,
  });
  const [showControlsPanel, setShowControlsPanel] = useState(showControls);

  // Initialize renderer
  useEffect(() => {
    if (!containerRef.current) return;

    const renderer = new Renderer3D(containerRef.current, renderSettings);
    rendererRef.current = renderer;

    // Load data
    if (vmapData) {
      renderer.loadVMapData(vmapData);
    }
    if (mmapData) {
      renderer.loadMMapData(mmapData);
    }

    // Start rendering
    if (autoStart) {
      renderer.start();
    }

    // Cleanup
    return () => {
      renderer.dispose();
    };
  }, []);

  // Update VMap data
  useEffect(() => {
    if (vmapData && rendererRef.current) {
      rendererRef.current.loadVMapData(vmapData);
    }
  }, [vmapData]);

  // Update MMap data
  useEffect(() => {
    if (mmapData && rendererRef.current) {
      rendererRef.current.loadMMapData(mmapData);
    }
  }, [mmapData]);

  // Update stats periodically
  useEffect(() => {
    if (!showStats || !rendererRef.current) return;

    const interval = setInterval(() => {
      if (rendererRef.current && isRendering) {
        setStats(rendererRef.current.getStats());
      }
    }, 500);

    return () => clearInterval(interval);
  }, [showStats, isRendering]);

  // Handle play/pause
  const toggleRendering = () => {
    if (!rendererRef.current) return;

    if (isRendering) {
      rendererRef.current.stop();
      setIsRendering(false);
    } else {
      rendererRef.current.start();
      setIsRendering(true);
    }
  };

  // Handle camera mode change
  const handleCameraModeChange = (mode: CameraMode) => {
    if (!rendererRef.current) return;
    rendererRef.current.setCameraMode(mode);
    setCameraMode(mode);
  };

  // Handle layer visibility toggle
  const handleLayerToggle = (layer: RenderLayer) => {
    if (!rendererRef.current) return;

    const newVisibility = !layerVisibility[layer];
    setLayerVisibility({
      ...layerVisibility,
      [layer]: newVisibility,
    });
    rendererRef.current.setLayerVisibility(layer, newVisibility);
  };

  // Handle settings change
  const handleSettingsChange = (key: keyof RenderSettings, value: number | boolean) => {
    const newSettings = { ...renderSettings, [key]: value };
    setRenderSettings(newSettings);
    rendererRef.current?.updateSettings({ [key]: value });
  };

  return (
    <div className="relative w-full" style={{ height }}>
      {/* 3D Canvas Container */}
      <div ref={containerRef} className="w-full h-full" />

      {/* Controls Overlay */}
      {showControlsPanel && (
        <div className="absolute top-4 left-4 z-10">
          <Card className="p-4 space-y-4 bg-white/90 backdrop-blur">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold flex items-center gap-2">
                <Settings className="w-4 h-4" />
                Controls
              </h3>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowControlsPanel(false)}
              >
                <EyeOff className="w-4 h-4" />
              </Button>
            </div>

            <Separator />

            {/* Camera Mode */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Camera className="w-4 h-4" />
                Camera Mode
              </Label>
              <Select value={cameraMode} onValueChange={(v) => handleCameraModeChange(v as CameraMode)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={CameraMode.Orbit}>Orbit</SelectItem>
                  <SelectItem value={CameraMode.Fly}>Fly</SelectItem>
                  <SelectItem value={CameraMode.FPS}>FPS</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Layer Visibility */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Eye className="w-4 h-4" />
                Layers
              </Label>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">VMap Collision</Label>
                  <Switch
                    checked={layerVisibility[RenderLayer.VMapCollision]}
                    onCheckedChange={() => handleLayerToggle(RenderLayer.VMapCollision)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm">VMap Spawns</Label>
                  <Switch
                    checked={layerVisibility[RenderLayer.VMapSpawns]}
                    onCheckedChange={() => handleLayerToggle(RenderLayer.VMapSpawns)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm">MMap NavMesh</Label>
                  <Switch
                    checked={layerVisibility[RenderLayer.MMapNavMesh]}
                    onCheckedChange={() => handleLayerToggle(RenderLayer.MMapNavMesh)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm">MMap Off-Mesh</Label>
                  <Switch
                    checked={layerVisibility[RenderLayer.MMapOffMesh]}
                    onCheckedChange={() => handleLayerToggle(RenderLayer.MMapOffMesh)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Grid</Label>
                  <Switch
                    checked={layerVisibility[RenderLayer.Grid]}
                    onCheckedChange={() => handleLayerToggle(RenderLayer.Grid)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Axes</Label>
                  <Switch
                    checked={layerVisibility[RenderLayer.Axes]}
                    onCheckedChange={() => handleLayerToggle(RenderLayer.Axes)}
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Visual Settings */}
            <div className="space-y-2">
              <Label>Visual Settings</Label>

              {/* Wireframe */}
              <div className="flex items-center justify-between">
                <Label className="text-sm">Wireframe</Label>
                <Switch
                  checked={renderSettings.wireframe}
                  onCheckedChange={(v) => handleSettingsChange("wireframe", v)}
                />
              </div>

              {/* VMap Opacity */}
              <div className="space-y-1">
                <Label className="text-sm">VMap Opacity: {renderSettings.vmapOpacity?.toFixed(2)}</Label>
                <Slider
                  value={[renderSettings.vmapOpacity ?? 0.8]}
                  onValueChange={([v]) => handleSettingsChange("vmapOpacity", v)}
                  min={0}
                  max={1}
                  step={0.05}
                />
              </div>

              {/* MMap Opacity */}
              <div className="space-y-1">
                <Label className="text-sm">MMap Opacity: {renderSettings.mmapOpacity?.toFixed(2)}</Label>
                <Slider
                  value={[renderSettings.mmapOpacity ?? 0.6]}
                  onValueChange={([v]) => handleSettingsChange("mmapOpacity", v)}
                  min={0}
                  max={1}
                  step={0.05}
                />
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Show Controls Button (when hidden) */}
      {!showControlsPanel && (
        <div className="absolute top-4 left-4 z-10">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setShowControlsPanel(true)}
            className="bg-white/90 backdrop-blur"
          >
            <Eye className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* Stats Panel */}
      {showStats && (
        <div className="absolute top-4 right-4 z-10">
          <Card className="p-3 bg-black/80 backdrop-blur text-white text-xs font-mono">
            <div className="space-y-1">
              <div>FPS: {stats.fps}</div>
              <div>Frame: {stats.frameTime.toFixed(2)}ms</div>
              <div>Triangles: {stats.triangles.toLocaleString()}</div>
              <div>Draw Calls: {stats.drawCalls}</div>
              <div>Objects: {stats.objects}</div>
            </div>
          </Card>
        </div>
      )}

      {/* Bottom Toolbar */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-10">
        <Card className="flex items-center gap-2 p-2 bg-white/90 backdrop-blur">
          <Button
            variant="outline"
            size="icon"
            onClick={toggleRendering}
            title={isRendering ? "Pause" : "Play"}
          >
            {isRendering ? (
              <Pause className="w-4 h-4" />
            ) : (
              <Play className="w-4 h-4" />
            )}
          </Button>

          <Separator orientation="vertical" className="h-8" />

          <Button
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
          >
            <Navigation className="w-4 h-4" />
            {cameraMode === CameraMode.Orbit && "Orbit"}
            {cameraMode === CameraMode.Fly && "Fly"}
            {cameraMode === CameraMode.FPS && "FPS"}
          </Button>
        </Card>
      </div>
    </div>
  );
}

export default Viewer3D;
