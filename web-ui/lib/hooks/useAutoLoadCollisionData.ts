/**
 * Auto-Load Collision Data Hook
 *
 * Attempts to automatically load VMap/MMap/Map terrain data from configured server paths.
 * Falls back gracefully to allow manual upload if auto-load fails.
 *
 * Usage:
 * const { vmap, mmap, mapTerrain, status } = useAutoLoadCollisionData(mapId, { autoLoad: true });
 */

import { useEffect, useState } from 'react';
import type { VMapData } from '@/lib/vmap-types';
import type { MMapData } from '@/lib/mmap-types';
import type { MapDataCollection } from '@/lib/map-parser';
import { loadVMapData } from '@/lib/vmap-parser';
import { loadMMapData } from '@/lib/mmap-parser';
import { loadMapData, parseMapFile } from '@/lib/map-parser';
import { WoWMaps } from '@/lib/map-editor';

/**
 * Map display/retail map IDs to TrinityCore collision data map IDs
 * Retail WoW uses different map IDs than classic TrinityCore
 */
const COLLISION_MAP_ID_MAPPING: Record<number, number> = {
  // Retail Eastern Kingdoms (58441) -> Classic Eastern Kingdoms (0)
  58441: 0,
  // Retail Kalimdor (58276) -> Classic Kalimdor (1)
  58276: 1,
  // Also support old mapping
  58440: 1,
  // Outland
  58346: 530,
  // Northrend
  59446: 571,
  // Draenor
  59838: 1116,
};

/**
 * Get the collision data map ID for a given display map ID
 */
function getCollisionMapId(displayMapId: number): number {
  return COLLISION_MAP_ID_MAPPING[displayMapId] ?? displayMapId;
}

export interface AutoLoadOptions {
  /** Enable auto-loading (default: true if env vars are set) */
  autoLoad?: boolean;

  /** Maximum number of tiles to load (default: 100) */
  maxTiles?: number;

  /** Verbose logging (default: false) */
  verbose?: boolean;

  /** Auto-load VMap (default: true) */
  loadVMap?: boolean;

  /** Auto-load MMap (default: true) */
  loadMMap?: boolean;

  /** Auto-load Map terrain (default: true) */
  loadMapTerrain?: boolean;
}

export interface AutoLoadStatus {
  vmap: 'idle' | 'checking' | 'loading' | 'loaded' | 'unavailable' | 'error';
  mmap: 'idle' | 'checking' | 'loading' | 'loaded' | 'unavailable' | 'error';
  mapTerrain: 'idle' | 'checking' | 'loading' | 'loaded' | 'unavailable' | 'error';
  vmapMessage?: string;
  mmapMessage?: string;
  mapTerrainMessage?: string;
}

export interface AutoLoadResult {
  vmap: VMapData | null;
  mmap: MMapData | null;
  mapTerrain: MapDataCollection | null;
  status: AutoLoadStatus;
  reload: () => void;
}

export function useAutoLoadCollisionData(
  mapId: number,
  options: AutoLoadOptions = {}
): AutoLoadResult {
  const {
    autoLoad = true,
    maxTiles = 100,
    verbose = false,
    loadVMap = true,
    loadMMap = true,
    loadMapTerrain = true,
  } = options;

  const [vmap, setVmap] = useState<VMapData | null>(null);
  const [mmap, setMmap] = useState<MMapData | null>(null);
  const [mapTerrain, setMapTerrain] = useState<MapDataCollection | null>(null);
  const [status, setStatus] = useState<AutoLoadStatus>({
    vmap: 'idle',
    mmap: 'idle',
    mapTerrain: 'idle',
  });

  const loadCollisionData = async () => {
    console.log(`[AutoLoad] loadCollisionData called, autoLoad=${autoLoad}, mapId=${mapId}`);
    if (!autoLoad) {
      console.log('[AutoLoad] autoLoad is false, returning');
      return;
    }

    // Get the collision data map ID (handles retail -> classic mapping)
    const collisionMapId = getCollisionMapId(mapId);
    console.log(`[AutoLoad] Mapping display map ${mapId} -> collision map ${collisionMapId}`);
    if (verbose && collisionMapId !== mapId) {
      console.log(`[AutoLoad] Map ID translation: ${mapId} -> ${collisionMapId}`);
    }

    // Load VMap
    if (loadVMap) {
      setStatus(prev => ({ ...prev, vmap: 'checking', vmapMessage: 'Checking for VMap data...' }));

      try {
        const result = await autoLoadVMap(collisionMapId, maxTiles, verbose);

        if (result.success && result.data) {
          setVmap(result.data);
          setStatus(prev => ({
            ...prev,
            vmap: 'loaded',
            vmapMessage: `Auto-loaded VMap: ${result.data!.allSpawns.length} spawns, ${result.data!.tiles.size} tiles`,
          }));
        } else {
          setStatus(prev => ({
            ...prev,
            vmap: 'unavailable',
            vmapMessage: result.message || 'VMap not configured (manual upload available)',
          }));
        }
      } catch (error: any) {
        console.error('[AutoLoad] VMap error:', error);
        setStatus(prev => ({
          ...prev,
          vmap: 'error',
          vmapMessage: `VMap error: ${error.message}`,
        }));
      }
    }

    // Load MMap
    if (loadMMap) {
      setStatus(prev => ({ ...prev, mmap: 'checking', mmapMessage: 'Checking for MMap data...' }));

      try {
        const result = await autoLoadMMap(collisionMapId, maxTiles, verbose);

        if (result.success && result.data) {
          setMmap(result.data);
          setStatus(prev => ({
            ...prev,
            mmap: 'loaded',
            mmapMessage: `Auto-loaded MMap: ${result.data!.tiles.size} tiles`,
          }));
        } else {
          setStatus(prev => ({
            ...prev,
            mmap: 'unavailable',
            mmapMessage: result.message || 'MMap not configured (manual upload available)',
          }));
        }
      } catch (error: any) {
        console.error('[AutoLoad] MMap error:', error);
        setStatus(prev => ({
          ...prev,
          mmap: 'error',
          mmapMessage: `MMap error: ${error.message}`,
        }));
      }
    }

    // Load Map Terrain
    if (loadMapTerrain) {
      setStatus(prev => ({ ...prev, mapTerrain: 'checking', mapTerrainMessage: 'Checking for Map terrain data...' }));

      try {
        const result = await autoLoadMapTerrain(collisionMapId, maxTiles, verbose);

        if (result.success && result.data) {
          setMapTerrain(result.data);
          setStatus(prev => ({
            ...prev,
            mapTerrain: 'loaded',
            mapTerrainMessage: `Auto-loaded Map terrain: ${result.data!.tiles.size} tiles`,
          }));
        } else {
          setStatus(prev => ({
            ...prev,
            mapTerrain: 'unavailable',
            mapTerrainMessage: result.message || 'Map terrain not configured (manual upload available)',
          }));
        }
      } catch (error: any) {
        console.error('[AutoLoad] Map terrain error:', error);
        setStatus(prev => ({
          ...prev,
          mapTerrain: 'error',
          mapTerrainMessage: `Map terrain error: ${error.message}`,
        }));
      }
    }
  };

  useEffect(() => {
    loadCollisionData();
  }, [mapId, autoLoad, loadVMap, loadMMap, loadMapTerrain]);

  return {
    vmap,
    mmap,
    mapTerrain,
    status,
    reload: loadCollisionData,
  };
}

/**
 * Auto-load VMap data from server
 */
async function autoLoadVMap(
  mapId: number,
  maxTiles: number,
  verbose: boolean
): Promise<{ success: boolean; data?: VMapData; message?: string }> {
  console.log(`[AutoLoad] autoLoadVMap called for map ${mapId}`);
  try {
    // Check if files are available
    const url = `/api/collision-data?mapId=${mapId}&type=vmap&action=list`;
    console.log(`[AutoLoad] Fetching: ${url}`);
    const listResponse = await fetch(url);
    const listData = await listResponse.json();
    console.log(`[AutoLoad] Response:`, { available: listData.available, fileCount: listData.files?.length || 0, error: listData.error });

    if (!listData.available || listData.files.length === 0) {
      console.log(`[AutoLoad] VMap not available: ${listData.error || 'No files'}`);
      return {
        success: false,
        message: listData.error || 'No VMap files found',
      };
    }

    console.log(`[AutoLoad] Found ${listData.files.length} VMap files for map ${mapId}`);

    // Find tree file
    const treeFile = listData.files.find((f: any) => f.filename.endsWith('.vmtree'));
    if (!treeFile) {
      return {
        success: false,
        message: 'No .vmtree file found',
      };
    }

    // Download tree file
    const treeResponse = await fetch(`/api/collision-data?mapId=${mapId}&type=vmap&action=download&filename=${treeFile.filename}`);
    const treeBuffer = await treeResponse.arrayBuffer();

    // Download tile files (up to maxTiles)
    // Sort tiles by distance from center (32,32) to load main continent first, avoiding GM Island
    let tileFiles = listData.files.filter((f: any) => f.filename.endsWith('.vmtile'));

    // Parse coordinates and sort by distance from center
    // VMap tile format: {mapId}_{Y}_{X}.vmtile (TrinityCore uses Y_X order!)
    const tilesWithCoords = tileFiles.map((f: any) => {
      const match = f.filename.match(/\d{4}_(\d{2})_(\d{2})\.vmtile/);
      if (match) {
        // First capture is Y, second is X
        return { file: f, x: parseInt(match[2], 10), y: parseInt(match[1], 10) };
      }
      return { file: f, x: 0, y: 0 };
    });

    tilesWithCoords.sort((a: any, b: any) => {
      const distA = Math.abs(a.x - 32) + Math.abs(a.y - 32);
      const distB = Math.abs(b.x - 32) + Math.abs(b.y - 32);
      return distA - distB;
    });

    const sortedTiles = tilesWithCoords.slice(0, maxTiles);
    tileFiles = sortedTiles.map((t: any) => t.file);

    console.log(`[AutoLoad] Loading ${tileFiles.length} VMap tiles (sorted by distance from center)`);
    if (sortedTiles.length > 0) {
      const firstTile = sortedTiles[0];
      console.log(`[AutoLoad] VMap: First tile at (${firstTile.x}, ${firstTile.y})`);
    }

    const tileBuffers = new Map<string, ArrayBuffer>();

    for (const tileFile of tileFiles) {
      // VMap tile format: {mapId}_{Y}_{X}.vmtile (e.g., 0000_32_48.vmtile)
      // Note: TrinityCore uses Y_X order in filenames!
      const match = tileFile.filename.match(/\d{4}_(\d{2})_(\d{2})\.vmtile/);
      if (match) {
        // First capture is Y, second is X (per TrinityCore convention)
        const tileY = parseInt(match[1], 10);
        const tileX = parseInt(match[2], 10);

        const tileResponse = await fetch(`/api/collision-data?mapId=${mapId}&type=vmap&action=download&filename=${tileFile.filename}`);
        const tileBuffer = await tileResponse.arrayBuffer();

        // Key format: "X_Y" to match how TileManager looks up tiles
        tileBuffers.set(`${tileX}_${tileY}`, tileBuffer);
        console.log(`[AutoLoad] VMap tile: ${tileFile.filename} -> key ${tileX}_${tileY}`);
      }
    }

    // Load VMap data
    const mapData = Object.values(WoWMaps).find(m => m.id === mapId);
    const mapName = mapData?.name || `Map ${mapId}`;

    console.log(`[AutoLoad] Parsing VMap data for ${mapName} (${mapId})`);
    console.log(`[AutoLoad] Tree buffer size: ${treeBuffer.byteLength}, Tile buffers: ${tileBuffers.size}`);

    const vmap = loadVMapData(mapId, mapName, treeBuffer, tileBuffers, {
      verbose,
      maxTiles,
    });

    console.log(`[AutoLoad] VMap parsed: ${vmap.tiles.size} tiles, ${vmap.allSpawns.length} spawns`);

    return {
      success: true,
      data: vmap,
    };
  } catch (error: any) {
    console.error(`[AutoLoad] VMap loading failed:`, error);
    return {
      success: false,
      message: error.message,
    };
  }
}

/**
 * Auto-load MMap data from server
 */
async function autoLoadMMap(
  mapId: number,
  maxTiles: number,
  verbose: boolean
): Promise<{ success: boolean; data?: MMapData; message?: string }> {
  console.log(`[AutoLoad] autoLoadMMap called for map ${mapId}`);
  try {
    // Check if files are available
    const url = `/api/collision-data?mapId=${mapId}&type=mmap&action=list`;
    console.log(`[AutoLoad] MMap: Fetching ${url}`);
    const listResponse = await fetch(url);
    const listData = await listResponse.json();
    console.log(`[AutoLoad] MMap response:`, {
      available: listData.available,
      fileCount: listData.files?.length || 0,
      error: listData.error,
      files: listData.files?.slice(0, 5).map((f: any) => f.filename), // First 5 files
    });

    if (!listData.available || listData.files.length === 0) {
      console.log(`[AutoLoad] MMap not available: ${listData.error || 'No files'}`);
      return {
        success: false,
        message: listData.error || 'No MMap files found',
      };
    }

    console.log(`[AutoLoad] Found ${listData.files.length} MMap files for map ${mapId}`);

    // Find header file
    const headerFile = listData.files.find((f: any) => f.filename.endsWith('.mmap'));
    if (!headerFile) {
      return {
        success: false,
        message: 'No .mmap header file found',
      };
    }

    // Download header file
    const headerResponse = await fetch(`/api/collision-data?mapId=${mapId}&type=mmap&action=download&filename=${headerFile.filename}`);
    const headerBuffer = await headerResponse.arrayBuffer();

    // Download tile files (up to maxTiles)
    // Sort tiles by distance from center (32,32) to match VMap loading and load main continent first
    let tileFilesRaw = listData.files.filter((f: any) => f.filename.endsWith('.mmtile'));

    // Parse coordinates and sort by distance from center
    const mmapTilesWithCoords = tileFilesRaw.map((f: any) => {
      const match = f.filename.match(/(\d{4})(\d{2})(\d{2})\.mmtile/);
      if (match) {
        const fileMapId = parseInt(match[1], 10);
        const x = parseInt(match[2], 10);
        const y = parseInt(match[3], 10);
        return { file: f, mapId: fileMapId, x, y };
      }
      return { file: f, mapId: -1, x: 0, y: 0 };
    }).filter((t: any) => t.mapId === mapId); // Filter to matching mapId first

    mmapTilesWithCoords.sort((a: any, b: any) => {
      const distA = Math.abs(a.x - 32) + Math.abs(a.y - 32);
      const distB = Math.abs(b.x - 32) + Math.abs(b.y - 32);
      return distA - distB;
    });

    const tileFiles = mmapTilesWithCoords.slice(0, maxTiles);
    console.log(`[AutoLoad] MMap: ${tileFiles.length} .mmtile files to process (sorted by distance from center)`);
    if (tileFiles.length > 0) {
      const firstTile = tileFiles[0];
      console.log(`[AutoLoad] MMap: First tile: ${firstTile.file.filename} at (${firstTile.x}, ${firstTile.y})`);
    }
    const tileBuffers = new Map<string, ArrayBuffer>();

    for (const tileData of tileFiles) {
      const tileX = tileData.x;
      const tileY = tileData.y;

      const tileResponse = await fetch(`/api/collision-data?mapId=${mapId}&type=mmap&action=download&filename=${tileData.file.filename}`);
      const tileBuffer = await tileResponse.arrayBuffer();

      tileBuffers.set(`${tileX}_${tileY}`, tileBuffer);
    }

    console.log(`[AutoLoad] MMap: Downloaded ${tileBuffers.size} tile buffers`);

    // Load MMap data
    const mapData = Object.values(WoWMaps).find(m => m.id === mapId);
    const mapName = mapData?.name || `Map ${mapId}`;

    console.log(`[AutoLoad] MMap: Parsing data for ${mapName} (${mapId})...`);
    const mmap = loadMMapData(mapId, mapName, headerBuffer, tileBuffers, {
      verbose,
      maxTiles,
    });

    console.log(`[AutoLoad] MMap: Parsed ${mmap.tiles.size} tiles`);

    return {
      success: true,
      data: mmap,
    };
  } catch (error: any) {
    console.error(`[AutoLoad] MMap loading error:`, error);
    return {
      success: false,
      message: error.message,
    };
  }
}

/**
 * Auto-load Map terrain data from server
 */
async function autoLoadMapTerrain(
  mapId: number,
  maxTiles: number,
  verbose: boolean
): Promise<{ success: boolean; data?: MapDataCollection; message?: string }> {
  console.log(`[AutoLoad] autoLoadMapTerrain called for map ${mapId}`);
  try {
    // Check if files are available
    const url = `/api/collision-data?mapId=${mapId}&type=map&action=list`;
    console.log(`[AutoLoad] Map terrain: Fetching ${url}`);
    const listResponse = await fetch(url);
    const listData = await listResponse.json();
    console.log(`[AutoLoad] Map terrain response:`, {
      available: listData.available,
      fileCount: listData.files?.length || 0,
      error: listData.error,
      files: listData.files?.slice(0, 5).map((f: any) => f.filename), // First 5 files
    });

    if (!listData.available || listData.files.length === 0) {
      console.log(`[AutoLoad] Map terrain not available: ${listData.error || 'No files'}`);
      return {
        success: false,
        message: listData.error || 'No Map terrain files found',
      };
    }

    console.log(`[AutoLoad] Found ${listData.files.length} Map terrain files for map ${mapId}`);

    // Download tile files (up to maxTiles)
    // Sort tiles by distance from center (32,32) to match VMap/MMap loading
    let tileFilesRaw = listData.files.filter((f: any) => f.filename.endsWith('.map'));

    // Parse coordinates and sort by distance from center
    const mapTilesWithCoords = tileFilesRaw.map((f: any) => {
      // Format: <mapId>_<x>_<y>.map (e.g., 0000_32_48.map)
      const match = f.filename.match(/(\d{4})_(\d{2})_(\d{2})\.map/);
      if (match) {
        const fileMapId = parseInt(match[1], 10);
        const x = parseInt(match[2], 10);
        const y = parseInt(match[3], 10);
        return { file: f, mapId: fileMapId, x, y };
      }
      return { file: f, mapId: -1, x: 0, y: 0 };
    }).filter((t: any) => t.mapId === mapId); // Filter to matching mapId first

    mapTilesWithCoords.sort((a: any, b: any) => {
      const distA = Math.abs(a.x - 32) + Math.abs(a.y - 32);
      const distB = Math.abs(b.x - 32) + Math.abs(b.y - 32);
      return distA - distB;
    });

    const tileFiles = mapTilesWithCoords.slice(0, maxTiles);
    console.log(`[AutoLoad] Map terrain: ${tileFiles.length} .map files to process (sorted by distance from center)`);
    if (tileFiles.length > 0) {
      const firstTile = tileFiles[0];
      console.log(`[AutoLoad] Map terrain: First tile: ${firstTile.file.filename} at (${firstTile.x}, ${firstTile.y})`);
    }
    const tileBuffers = new Map<string, ArrayBuffer>();

    for (const tileData of tileFiles) {
      const tileResponse = await fetch(`/api/collision-data?mapId=${mapId}&type=map&action=download&filename=${tileData.file.filename}`);
      const tileBuffer = await tileResponse.arrayBuffer();

      tileBuffers.set(tileData.file.filename, tileBuffer);
    }

    console.log(`[AutoLoad] Map terrain: Downloaded ${tileBuffers.size} tile buffers`);

    // Load Map data
    const wowMapData = Object.values(WoWMaps).find(m => m.id === mapId);
    const mapName = wowMapData?.name || `Map ${mapId}`;

    console.log(`[AutoLoad] Map terrain: Parsing data for ${mapName} (${mapId})...`);
    const mapTerrainData = loadMapData(mapId, mapName, tileBuffers, {
      verbose,
      maxTiles,
    });

    console.log(`[AutoLoad] Map terrain: Parsed ${mapTerrainData.tiles.size} tiles`);

    return {
      success: true,
      data: mapTerrainData,
    };
  } catch (error: any) {
    console.error(`[AutoLoad] Map terrain loading error:`, error);
    return {
      success: false,
      message: error.message,
    };
  }
}
