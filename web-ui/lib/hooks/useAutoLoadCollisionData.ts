/**
 * Auto-Load Collision Data Hook
 *
 * Attempts to automatically load VMap/MMap data from configured server paths.
 * Falls back gracefully to allow manual upload if auto-load fails.
 *
 * Usage:
 * const { vmap, mmap, status } = useAutoLoadCollisionData(mapId, { autoLoad: true });
 */

import { useEffect, useState } from 'react';
import type { VMapData } from '@/lib/vmap-types';
import type { MMapData } from '@/lib/mmap-types';
import { loadVMapData } from '@/lib/vmap-parser';
import { loadMMapData } from '@/lib/mmap-parser';
import { WoWMaps } from '@/lib/map-editor';

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
}

export interface AutoLoadStatus {
  vmap: 'idle' | 'checking' | 'loading' | 'loaded' | 'unavailable' | 'error';
  mmap: 'idle' | 'checking' | 'loading' | 'loaded' | 'unavailable' | 'error';
  vmapMessage?: string;
  mmapMessage?: string;
}

export interface AutoLoadResult {
  vmap: VMapData | null;
  mmap: MMapData | null;
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
  } = options;

  const [vmap, setVmap] = useState<VMapData | null>(null);
  const [mmap, setMmap] = useState<MMapData | null>(null);
  const [status, setStatus] = useState<AutoLoadStatus>({
    vmap: 'idle',
    mmap: 'idle',
  });

  const loadCollisionData = async () => {
    if (!autoLoad) return;

    // Load VMap
    if (loadVMap) {
      setStatus(prev => ({ ...prev, vmap: 'checking', vmapMessage: 'Checking for VMap data...' }));

      try {
        const result = await autoLoadVMap(mapId, maxTiles, verbose);

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
        const result = await autoLoadMMap(mapId, maxTiles, verbose);

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
  };

  useEffect(() => {
    loadCollisionData();
  }, [mapId, autoLoad, loadVMap, loadMMap]);

  return {
    vmap,
    mmap,
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
  try {
    // Check if files are available
    const listResponse = await fetch(`/api/collision-data?mapId=${mapId}&type=vmap&action=list`);
    const listData = await listResponse.json();

    if (!listData.available || listData.files.length === 0) {
      return {
        success: false,
        message: listData.error || 'No VMap files found',
      };
    }

    if (verbose) {
      console.log(`[AutoLoad] Found ${listData.files.length} VMap files for map ${mapId}`);
    }

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
    const tileFiles = listData.files.filter((f: any) => f.filename.endsWith('.vmtile')).slice(0, maxTiles);
    const tileBuffers = new Map<string, ArrayBuffer>();

    for (const tileFile of tileFiles) {
      const match = tileFile.filename.match(/(\d+)_(\d+)\.vmtile/);
      if (match) {
        const tileX = parseInt(match[1], 10);
        const tileY = parseInt(match[2], 10);

        const tileResponse = await fetch(`/api/collision-data?mapId=${mapId}&type=vmap&action=download&filename=${tileFile.filename}`);
        const tileBuffer = await tileResponse.arrayBuffer();

        tileBuffers.set(`${tileX}_${tileY}`, tileBuffer);
      }
    }

    // Load VMap data
    const mapData = Object.values(WoWMaps).find(m => m.id === mapId);
    const mapName = mapData?.name || `Map ${mapId}`;

    const vmap = loadVMapData(mapId, mapName, treeBuffer, tileBuffers, {
      verbose,
      maxTiles,
    });

    return {
      success: true,
      data: vmap,
    };
  } catch (error: any) {
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
  try {
    // Check if files are available
    const listResponse = await fetch(`/api/collision-data?mapId=${mapId}&type=mmap&action=list`);
    const listData = await listResponse.json();

    if (!listData.available || listData.files.length === 0) {
      return {
        success: false,
        message: listData.error || 'No MMap files found',
      };
    }

    if (verbose) {
      console.log(`[AutoLoad] Found ${listData.files.length} MMap files for map ${mapId}`);
    }

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
    const tileFiles = listData.files.filter((f: any) => f.filename.endsWith('.mmtile')).slice(0, maxTiles);
    const tileBuffers = new Map<string, ArrayBuffer>();

    for (const tileFile of tileFiles) {
      // TrinityCore format: <mapId><x><y>.mmtile (e.g., 00003248.mmtile)
      const match = tileFile.filename.match(/(\d{4})(\d{2})(\d{2})\.mmtile/);
      if (match) {
        const fileMapId = parseInt(match[1], 10);
        const tileX = parseInt(match[2], 10);
        const tileY = parseInt(match[3], 10);

        // Verify mapId matches
        if (fileMapId !== mapId) {
          continue;
        }

        const tileResponse = await fetch(`/api/collision-data?mapId=${mapId}&type=mmap&action=download&filename=${tileFile.filename}`);
        const tileBuffer = await tileResponse.arrayBuffer();

        tileBuffers.set(`${tileX}_${tileY}`, tileBuffer);
      }
    }

    // Load MMap data
    const mapData = Object.values(WoWMaps).find(m => m.id === mapId);
    const mapName = mapData?.name || `Map ${mapId}`;

    const mmap = loadMMapData(mapId, mapName, headerBuffer, tileBuffers, {
      verbose,
      maxTiles,
    });

    return {
      success: true,
      data: mmap,
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message,
    };
  }
}
