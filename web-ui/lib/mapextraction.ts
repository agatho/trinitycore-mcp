/**
 * Map Extraction Library for Web UI
 *
 * Complete implementation of map extraction functionality for the TrinityCore Web UI.
 * This module handles listing available maps and checking their extraction status.
 */

import { existsSync } from 'fs';
import { readdir, access, rm, mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { getMCPClient, initializeMCPClient } from './mcp/client';

/**
 * Map information interface
 */
export interface MapInfo {
  id: number;
  name: string;
  extracted: boolean;
}

/**
 * Extraction status interface
 */
export interface ExtractionStatus {
  mapId: number;
  status: 'pending' | 'extracting' | 'converting' | 'tiling' | 'completed' | 'error';
  progress: number;
  error?: string;
}

/**
 * List of all available WoW maps (Retail WoW 11.x/12.x Map IDs)
 *
 * IMPORTANT: Modern WoW stores minimap tiles at world/minimaps/{folder}/*.blp
 * NOT as consecutive FileDataIDs from WdtFileDataID!
 *
 * Only maps with actual minimap data are listed here.
 */
const AVAILABLE_MAPS: Array<{ id: number; name: string }> = [
  // Classic continents
  { id: 58441, name: 'Azeroth (Eastern Kingdoms)' },  // 2,059 tiles at world/minimaps/azeroth/
  { id: 58276, name: 'Kalimdor' },                    // 2,131 tiles at world/minimaps/kalimdor/
  { id: 58346, name: 'Outland' },                     // 840 tiles at world/minimaps/expansion01/
  { id: 59446, name: 'Northrend' },                   // 1,131 tiles at world/minimaps/northrend/

  // Expansion continents
  { id: 870, name: 'Pandaria' },                      // 719 tiles at world/minimaps/hawaiimainland/
  { id: 1220, name: 'Broken Isles' },                 // 1,404 tiles at world/minimaps/troll raid/
  { id: 59838, name: 'Draenor' },                     // 1,221 tiles at world/minimaps/draenor/
  { id: 60399, name: 'Kul Tiras' },                   // 971 tiles at world/minimaps/kultiras/
  { id: 60621, name: 'Zandalar' },                    // 981 tiles at world/minimaps/zandalar/
  { id: 2444, name: 'Dragon Isles' },                 // 1,634 tiles at world/minimaps/2444/
  { id: 2601, name: 'Khaz Algar' },                   // 855 tiles at world/minimaps/2601/
];

/**
 * Check if a map is extracted by looking for metadata.json file
 *
 * @param mapId - Map ID to check
 * @returns True if map is extracted, false otherwise
 */
export function isMapExtracted(mapId: number): boolean {
  try {
    const metadataPath = join(
      process.cwd(),
      'public',
      'tile-data',
      mapId.toString(),
      'metadata.json'
    );
    return existsSync(metadataPath);
  } catch (error) {
    console.error(`Error checking extraction status for map ${mapId}:`, error);
    return false;
  }
}

/**
 * List all available maps with their extraction status
 *
 * @returns Promise resolving to array of map information
 */
export async function listAvailableMaps(): Promise<MapInfo[]> {
  try {
    // Map each available map to include extraction status
    const mapsWithStatus = AVAILABLE_MAPS.map(map => ({
      ...map,
      extracted: isMapExtracted(map.id)
    }));

    return mapsWithStatus;
  } catch (error) {
    console.error('Error listing available maps:', error);
    throw new Error(`Failed to list maps: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Extract map textures from WoW installation using MCP minimap tools
 *
 * @param params - Extraction parameters
 * @returns Promise resolving to extraction status
 */
export async function extractMapTextures(params: {
  mapId: number;
  quality?: 'low' | 'medium' | 'high' | 'all';
  enableTiling?: boolean;
  tileSize?: number;
}): Promise<ExtractionStatus> {
  const { mapId } = params;

  // Validate map ID
  const mapExists = AVAILABLE_MAPS.some(m => m.id === mapId);
  if (!mapExists) {
    return {
      mapId,
      status: 'error',
      progress: 0,
      error: `Invalid map ID: ${mapId}`
    };
  }

  try {
    console.log(`[MapExtraction] Starting extraction for map ${mapId}`);

    // Ensure MCP client is connected
    const client = getMCPClient();
    if (!client.isClientConnected()) {
      console.log(`[MapExtraction] MCP client not connected, initializing...`);
      await initializeMCPClient();
    }

    // First, get the map info to know how many tiles we need to extract
    console.log(`[MapExtraction] Fetching map info for ${mapId}...`);
    const mapInfoResult = await client.callTool('get-map-minimap', { mapId });

    let mapInfo: any;
    if (typeof mapInfoResult === 'string') {
      // Parse the text response to extract tile count
      // Handle both "**Total Tiles:**" (markdown) and "Total tiles:" formats
      const tileCountMatch = mapInfoResult.match(/\*\*Total Tiles:\*\*\s*(\d+)|Total [Tt]iles:\s*(\d+)/);
      if (!tileCountMatch) {
        throw new Error('Could not determine tile count from map info');
      }
      const tileCount = parseInt(tileCountMatch[1] || tileCountMatch[2]);
      mapInfo = { tiles: { length: tileCount } };
    } else if (mapInfoResult && typeof mapInfoResult === 'object' && 'content' in mapInfoResult) {
      const content = (mapInfoResult as any).content;
      if (Array.isArray(content) && content.length > 0 && content[0].text) {
        // Handle both "**Total Tiles:**" (markdown) and "Total tiles:" formats
        const tileCountMatch = content[0].text.match(/\*\*Total Tiles:\*\*\s*(\d+)|Total [Tt]iles:\s*(\d+)/);
        if (!tileCountMatch) {
          throw new Error('Could not determine tile count from map info');
        }
        const tileCount = parseInt(tileCountMatch[1] || tileCountMatch[2]);
        mapInfo = { tiles: { length: tileCount } };
      }
    }

    const totalTiles = mapInfo?.tiles?.length || 0;
    console.log(`[MapExtraction] Map ${mapId} has ${totalTiles} tiles`);

    // Extract all tiles at once (MCP tool handles the extraction internally)
    console.log(`[MapExtraction] Extracting all ${totalTiles} tiles...`);

    const batchResult = await client.callTool('get-minimap-tiles-batch', {
      mapId
    }, {
      timeout: 300000 // 5 minutes for full extraction
    });

    // Parse batch result to get actual tile count
    let text: string;
    if (typeof batchResult === 'string') {
      text = batchResult;
    } else if (batchResult && typeof batchResult === 'object' && 'content' in batchResult) {
      const content = (batchResult as any).content;
      if (Array.isArray(content) && content.length > 0 && content[0].text) {
        text = content[0].text;
      } else {
        throw new Error('Invalid batch result format');
      }
    } else {
      throw new Error(`Unexpected batch result type: ${typeof batchResult}`);
    }

    // Extract success count from result
    const successMatch = text.match(/\*\*Successful:\*\*\s*(\d+)/);
    const tileCount = successMatch ? parseInt(successMatch[1]) : 0;

    console.log(`[MapExtraction] Extracted ${tileCount} tiles`);

    // Create metadata.json file to mark map as extracted
    const metadataDir = join(process.cwd(), 'public', 'tile-data', mapId.toString());
    const metadataPath = join(metadataDir, 'metadata.json');

    try {
      // Ensure directory exists
      await mkdir(metadataDir, { recursive: true });

      // Get map name
      const mapInfo = AVAILABLE_MAPS.find(m => m.id === mapId);

      // Scan extracted tiles to get actual bounds and count
      const { readdir } = await import('fs/promises');
      const tilesDir = join(metadataDir, '0');
      let tileFiles: string[] = [];
      try {
        tileFiles = await readdir(tilesDir);
      } catch (e) {
        console.warn('[MapExtraction] No tiles directory found, using estimated metadata');
      }

      let minCol = Infinity, minRow = Infinity, maxCol = -Infinity, maxRow = -Infinity;
      let actualTileCount = 0;

      for (const file of tileFiles) {
        if (file.endsWith('.png')) {
          const match = file.match(/^(\d+)_(\d+)\.png$/);
          if (match) {
            const col = parseInt(match[1]);
            const row = parseInt(match[2]);
            minCol = Math.min(minCol, col);
            minRow = Math.min(minRow, row);
            maxCol = Math.max(maxCol, col);
            maxRow = Math.max(maxRow, row);
            actualTileCount++;
          }
        }
      }

      // If we found tiles, use actual bounds; otherwise estimate
      const tileCount = actualTileCount > 0 ? actualTileCount : totalExtracted;
      const cols = actualTileCount > 0 ? (maxCol - minCol + 1) : Math.ceil(Math.sqrt(tileCount));
      const rows = actualTileCount > 0 ? (maxRow - minRow + 1) : Math.ceil(Math.sqrt(tileCount));

      // Calculate original dimensions based on max coordinate bounds
      // For example, if tiles go from col 12-60, we need space for col 0-60 = 61 tiles
      const originalWidth = actualTileCount > 0 ? (maxCol + 1) * 256 : cols * 256;
      const originalHeight = actualTileCount > 0 ? (maxRow + 1) * 256 : rows * 256;

      const metadata = {
        mapId,
        mapName: mapInfo?.name || `Map_${mapId}`,
        tileCount,
        extractedAt: new Date().toISOString(),
        tileSize: 256,
        minCol: actualTileCount > 0 ? minCol : 0,
        minRow: actualTileCount > 0 ? minRow : 0,
        maxCol: actualTileCount > 0 ? maxCol : cols - 1,
        maxRow: actualTileCount > 0 ? maxRow : rows - 1,
        originalWidth,
        originalHeight,
        cols,
        rows,
        format: 'png'
      };

      await writeFile(metadataPath, JSON.stringify(metadata, null, 2));
      console.log(`[MapExtraction] Created metadata file at: ${metadataPath}`);
      console.log(`[MapExtraction] Tile bounds: col ${minCol}-${maxCol}, row ${minRow}-${maxRow}`);
    } catch (metadataError) {
      console.warn(`[MapExtraction] Failed to create metadata file:`, metadataError);
      // Don't fail the extraction if metadata creation fails
    }

    console.log(`[MapExtraction] Successfully extracted ${tileCount} tiles for map ${mapId}`);

    return {
      mapId,
      status: 'completed',
      progress: 100
    };
  } catch (error) {
    console.error(`[MapExtraction] Error extracting map ${mapId}:`, error);
    return {
      mapId,
      status: 'error',
      progress: 0,
      error: error instanceof Error ? error.message : 'Unknown error occurred during extraction'
    };
  }
}

/**
 * Delete extracted map data
 *
 * @param params - Deletion parameters
 * @returns Promise resolving to success status
 */
export async function deleteExtractedMap(params: {
  mapId: number;
}): Promise<boolean> {
  const { mapId } = params;

  try {
    // Validate map ID
    if (typeof mapId !== 'number' || mapId < 0) {
      throw new Error(`Invalid map ID: ${mapId}`);
    }

    // Get tiles directory path
    const tilesDir = join(
      process.cwd(),
      'public',
      'tile-data',
      mapId.toString()
    );

    // Check if directory exists
    if (!existsSync(tilesDir)) {
      console.warn(`Map ${mapId} tiles directory does not exist: ${tilesDir}`);
      return true; // Already deleted
    }

    // Delete the directory recursively
    await rm(tilesDir, { recursive: true, force: true });

    console.log(`Successfully deleted extracted map data for map ${mapId}`);
    return true;
  } catch (error) {
    console.error(`Error deleting extracted map ${mapId}:`, error);
    throw new Error(`Failed to delete map ${mapId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get extraction status for a specific map
 *
 * @param params - Parameters containing map ID
 * @returns Promise resolving to extraction status or null if not extracted
 */
export async function getExtractionStatus(params: {
  mapId: number;
}): Promise<ExtractionStatus | null> {
  const { mapId } = params;

  const extracted = isMapExtracted(mapId);

  if (!extracted) {
    return null;
  }

  return {
    mapId,
    status: 'completed',
    progress: 100
  };
}

/**
 * List all extracted maps
 *
 * @returns Promise resolving to array of extracted map IDs
 */
export async function listExtractedMaps(): Promise<number[]> {
  try {
    const tilesBaseDir = join(process.cwd(), 'public', 'tile-data');

    // Check if tiles directory exists
    if (!existsSync(tilesBaseDir)) {
      return [];
    }

    // Read all subdirectories (map IDs)
    const entries = await readdir(tilesBaseDir, { withFileTypes: true });

    const extractedMapIds: number[] = [];

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const mapId = parseInt(entry.name, 10);

        if (!isNaN(mapId) && mapId >= 0) {
          // Verify metadata exists
          if (isMapExtracted(mapId)) {
            extractedMapIds.push(mapId);
          }
        }
      }
    }

    return extractedMapIds.sort((a, b) => a - b);
  } catch (error) {
    console.error('Error listing extracted maps:', error);
    return [];
  }
}
