"use client";

/**
 * 3D Viewer Page
 *
 * Main page for viewing VMap and MMap data in 3D.
 * Allows loading files and visualizing collision geometry and navigation meshes.
 */

import { useState } from "react";
import dynamic from "next/dynamic";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertCircle,
  FileUp,
  Loader2,
  Map,
  Navigation,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { loadVMapData, parseVMapTile, parseVMapTree } from "@/lib/vmap-parser";
import { loadMMapData, parseMMapHeader, parseMMapTile } from "@/lib/mmap-parser";
import type { VMapData } from "@/lib/vmap-types";
import type { MMapData } from "@/lib/mmap-types";

// Dynamic import to avoid SSR issues with Three.js
const Viewer3D = dynamic(() => import("@/components/3d-viewer/Viewer3D"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-[600px] bg-gray-100">
      <Loader2 className="w-8 h-8 animate-spin" />
    </div>
  ),
});

export default function Viewer3DPage() {
  const [vmapData, setVmapData] = useState<VMapData | null>(null);
  const [mmapData, setMmapData] = useState<MMapData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Handle VMap file upload
   */
  const handleVMapUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
    fileType: "tree" | "tile",
  ) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setLoading(true);
    setError(null);

    try {
      if (fileType === "tree") {
        // Load .vmtree file
        const file = files[0];
        const buffer = await file.arrayBuffer();
        const mapId = 0; // Extract from filename if needed

        const tree = parseVMapTree(buffer, mapId, { verbose: true });

        // Create minimal VMapData for visualization
        const data: VMapData = {
          mapId,
          mapName: file.name.replace(".vmtree", ""),
          tree,
          tiles: new Map(),
          allSpawns: [],
          bounds: {
            min: { x: -1000, y: -1000, z: -1000 },
            max: { x: 1000, y: 1000, z: 1000 },
          },
        };

        setVmapData(data);
      } else {
        // Load .vmtile file(s)
        const tileBuffers = new Map<string, ArrayBuffer>();

        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const buffer = await file.arrayBuffer();

          // Extract tile coordinates from filename (e.g., "0000_31_31.vmtile")
          const match = file.name.match(/(\d+)_(\d+)\.vmtile$/);
          if (match) {
            const tileX = parseInt(match[1], 10);
            const tileY = parseInt(match[2], 10);
            const key = `${tileX}_${tileY}`;
            tileBuffers.set(key, buffer);
          }
        }

        // If we have existing vmapData with a tree, update it with tiles
        if (vmapData && vmapData.tree) {
          const updatedData = loadVMapData(
            vmapData.mapId,
            vmapData.mapName,
            new ArrayBuffer(0), // We already have the tree
            tileBuffers,
            { verbose: true },
          );

          // Merge with existing tree
          setVmapData({
            ...vmapData,
            tiles: updatedData.tiles,
            allSpawns: updatedData.allSpawns,
            bounds: updatedData.bounds,
          });
        }
      }
    } catch (err) {
      console.error("Failed to load VMap file:", err);
      setError(`Failed to load VMap file: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle MMap file upload
   */
  const handleMMapUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
    fileType: "header" | "tile",
  ) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setLoading(true);
    setError(null);

    try {
      if (fileType === "header") {
        // Load .mmap file
        const file = files[0];
        const buffer = await file.arrayBuffer();
        const mapId = 0; // Extract from filename if needed

        const header = parseMMapHeader(buffer, mapId, { verbose: true });

        // Create minimal MMapData for visualization
        const data: MMapData = {
          mapId,
          mapName: file.name.replace(".mmap", ""),
          header,
          tiles: new Map(),
          offMeshConnections: [],
        };

        setMmapData(data);
      } else {
        // Load .mmtile file(s)
        const tileBuffers = new Map<string, ArrayBuffer>();

        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const buffer = await file.arrayBuffer();

          // Extract tile coordinates from filename (e.g., "0000_00_00.mmtile")
          const match = file.name.match(/\d{4}_(\d{2})_(\d{2})\.mmtile$/);
          if (match) {
            const tileX = parseInt(match[1], 10);
            const tileY = parseInt(match[2], 10);
            const key = `${tileX}_${tileY}`;
            tileBuffers.set(key, buffer);
          }
        }

        // If we have existing mmapData with a header, update it with tiles
        if (mmapData && mmapData.header) {
          const headerBuffer = new ArrayBuffer(40); // Dummy buffer
          const updatedData = loadMMapData(
            mmapData.mapId,
            mmapData.mapName,
            headerBuffer,
            tileBuffers,
            { verbose: true },
          );

          // Merge with existing header
          setMmapData({
            ...mmapData,
            tiles: updatedData.tiles,
            offMeshConnections: updatedData.offMeshConnections,
          });
        }
      }
    } catch (err) {
      console.error("Failed to load MMap file:", err);
      setError(`Failed to load MMap file: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Load sample data
   */
  const loadSampleData = async () => {
    setLoading(true);
    setError(null);

    try {
      // TODO: Load sample data from server
      // For now, show a message
      setError("Sample data loading not yet implemented. Please upload VMap/MMap files.");
    } catch (err) {
      setError(`Failed to load sample data: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  const hasData = vmapData || mmapData;

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">3D Viewer</h1>
        <p className="text-muted-foreground">
          Visualize VMap collision geometry and MMap navigation meshes in 3D.
        </p>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* File Upload Section */}
      <Card className="p-6">
        <Tabs defaultValue="vmap">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="vmap" className="flex items-center gap-2">
              <Map className="w-4 h-4" />
              VMap Files
            </TabsTrigger>
            <TabsTrigger value="mmap" className="flex items-center gap-2">
              <Navigation className="w-4 h-4" />
              MMap Files
            </TabsTrigger>
          </TabsList>

          <TabsContent value="vmap" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>VMap Tree (.vmtree)</Label>
                <div className="flex gap-2">
                  <input
                    type="file"
                    accept=".vmtree"
                    onChange={(e) => handleVMapUpload(e, "tree")}
                    disabled={loading}
                    className="flex-1 text-sm file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Upload the spatial index file (e.g., 000.vmtree)
                </p>
              </div>

              <div className="space-y-2">
                <Label>VMap Tiles (.vmtile)</Label>
                <div className="flex gap-2">
                  <input
                    type="file"
                    accept=".vmtile"
                    multiple
                    onChange={(e) => handleVMapUpload(e, "tile")}
                    disabled={loading}
                    className="flex-1 text-sm file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Upload one or more tile files (e.g., 0000_31_31.vmtile)
                </p>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="mmap" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>MMap Header (.mmap)</Label>
                <div className="flex gap-2">
                  <input
                    type="file"
                    accept=".mmap"
                    onChange={(e) => handleMMapUpload(e, "header")}
                    disabled={loading}
                    className="flex-1 text-sm file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Upload the navigation mesh header (e.g., 000.mmap)
                </p>
              </div>

              <div className="space-y-2">
                <Label>MMap Tiles (.mmtile)</Label>
                <div className="flex gap-2">
                  <input
                    type="file"
                    accept=".mmtile"
                    multiple
                    onChange={(e) => handleMMapUpload(e, "tile")}
                    disabled={loading}
                    className="flex-1 text-sm file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Upload one or more tile files (e.g., 0000_00_00.mmtile)
                </p>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <div className="mt-4 flex justify-center">
          <Button
            variant="outline"
            onClick={loadSampleData}
            disabled={loading}
            className="flex items-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading...
              </>
            ) : (
              <>
                <FileUp className="w-4 h-4" />
                Load Sample Data
              </>
            )}
          </Button>
        </div>
      </Card>

      {/* 3D Viewer */}
      {hasData ? (
        <Card>
          <Viewer3D
            vmapData={vmapData ?? undefined}
            mmapData={mmapData ?? undefined}
            height="70vh"
            showControls={true}
            showStats={true}
            autoStart={true}
          />
        </Card>
      ) : (
        <Card className="p-12">
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                <Map className="w-8 h-8 text-muted-foreground" />
              </div>
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">No Data Loaded</h3>
              <p className="text-muted-foreground">
                Upload VMap or MMap files to visualize them in 3D.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Info Section */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">How to Use</h3>
        <div className="space-y-4 text-sm text-muted-foreground">
          <div>
            <h4 className="font-semibold text-foreground mb-1">1. Extract VMap/MMap Files</h4>
            <p>
              Use TrinityCore's extraction tools (vmap4extractor, vmap4assembler, mmaps_generator)
              to extract collision and navigation data from your WoW client.
            </p>
          </div>
          <div>
            <h4 className="font-semibold text-foreground mb-1">2. Upload Files</h4>
            <p>
              Upload the extracted .vmtree/.vmtile or .mmap/.mmtile files using the form above.
              You can upload multiple tile files at once.
            </p>
          </div>
          <div>
            <h4 className="font-semibold text-foreground mb-1">3. Explore in 3D</h4>
            <p>
              Use the camera controls to navigate the 3D view. Toggle layers on/off,
              adjust opacity, and switch between camera modes (Orbit, Fly, FPS).
            </p>
          </div>
          <div>
            <h4 className="font-semibold text-foreground mb-1">Camera Controls</h4>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li><strong>Orbit:</strong> Left-click to rotate, right-click to pan, scroll to zoom</li>
              <li><strong>Fly:</strong> WASD to move, Q/E for up/down, drag to look around</li>
              <li><strong>FPS:</strong> WASD to move, mouse to look around</li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
}
