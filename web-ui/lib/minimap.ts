/**
 * Minimap Utilities
 *
 * Utilities for loading and displaying WoW minimap tiles in the web UI.
 */

/**
 * Get map minimap information
 */
export async function getMapMinimapInfo(mapId: number) {
  try {
    const response = await fetch(`/api/minimap/${mapId}`);
    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Failed to get minimap info');
    }

    return data.result;
  } catch (error) {
    console.error('Error fetching minimap info:', error);
    throw error;
  }
}

/**
 * Get URL for a minimap tile
 */
export function getMinimapTileUrl(fileDataId: number, forceRefresh = false): string {
  const params = forceRefresh ? '?forceRefresh=true' : '';
  return `/api/minimap/tile/${fileDataId}${params}`;
}

/**
 * Load a minimap tile as an Image element
 */
export async function loadMinimapTile(fileDataId: number): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load tile ${fileDataId}`));
    img.src = getMinimapTileUrl(fileDataId);
  });
}

/**
 * Load multiple minimap tiles
 */
export async function loadMinimapTiles(fileDataIds: number[]): Promise<Map<number, HTMLImageElement>> {
  const results = new Map<number, HTMLImageElement>();

  await Promise.all(
    fileDataIds.map(async (fileDataId) => {
      try {
        const img = await loadMinimapTile(fileDataId);
        results.set(fileDataId, img);
      } catch (error) {
        console.error(`Failed to load tile ${fileDataId}:`, error);
      }
    })
  );

  return results;
}

/**
 * Map ID to folder name mapping
 */
const MAP_ID_TO_FOLDER: Record<number, string> = {
  58441: 'azeroth',
  58276: 'kalimdor',
  58346: 'expansion01',
  59446: 'northrend',
  870: 'hawaiimainland',
  1220: 'troll raid',
  59838: 'draenor',
  60399: 'kultiras',
  60621: 'zandalar',
  2444: '2444',
  2601: '2601'
};

/**
 * Load extracted minimap metadata
 */
export async function loadMinimapMetadata(mapId: number): Promise<any> {
  const folderName = MAP_ID_TO_FOLDER[mapId];
  if (!folderName) {
    throw new Error(`Map ${mapId} has no minimap data`);
  }

  try {
    const response = await fetch(`/tile-data/${mapId}/metadata.json`);
    if (!response.ok) {
      throw new Error(`Map metadata not found: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`Failed to load metadata for map ${mapId}:`, error);
    throw error;
  }
}

/**
 * Load an extracted minimap tile by coordinates
 */
export async function loadExtractedTile(
  mapId: number,
  x: number,
  y: number
): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const fileName = `${x}_${y}.png`;
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load tile ${fileName}`));
    img.src = `/tile-data/${mapId}/0/${fileName}`;
  });
}

/**
 * Create a composite minimap image from extracted tiles
 *
 * Loads tiles from the extracted minimap directory structure created by
 * the batch extractor (scripts/extract-minimaps-batch.js).
 */
export async function createMinimapComposite(
  mapId: number,
  maxTiles: number = 64 // Maximum tiles to load (for performance)
): Promise<HTMLCanvasElement> {
  // Get folder name
  const folderName = MAP_ID_TO_FOLDER[mapId];
  if (!folderName) {
    throw new Error(`Map ${mapId} has no minimap data`);
  }

  // Try to load extracted metadata
  let metadata;
  try {
    metadata = await loadMinimapMetadata(mapId);
  } catch (error) {
    console.warn('Failed to load extracted metadata, falling back to API');

    // Fallback to API-based loading
    return createMinimapCompositeFromAPI(mapId, maxTiles);
  }

  // Our metadata format: { minCol, maxCol, minRow, maxRow, tileSize, ... }
  const { minCol, maxCol, minRow, maxRow, tileSize = 256 } = metadata;

  // Build tiles array from coordinate ranges
  const tiles: Array<{ x: number; y: number }> = [];
  for (let row = minRow; row <= maxRow; row++) {
    for (let col = minCol; col <= maxCol; col++) {
      tiles.push({ x: col, y: row });
    }
  }

  // Calculate which tiles to load (center area if too many)
  const tilesToLoad = tiles.slice(0, Math.min(tiles.length, maxTiles));

  // Determine canvas size from bounds
  const canvasWidth = (maxCol - minCol + 1) * tileSize;
  const canvasHeight = (maxRow - minRow + 1) * tileSize;

  // Create composite canvas
  const canvas = document.createElement('canvas');
  canvas.width = Math.min(canvasWidth, 8192); // Limit canvas size
  canvas.height = Math.min(canvasHeight, 8192);
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }

  // Load and draw tiles
  const loadPromises = tilesToLoad.map(async (tile: any) => {
    try {
      const img = await loadExtractedTile(mapId, tile.x, tile.y);

      // Calculate position on canvas
      const canvasX = (tile.x - minCol) * tileSize;
      const canvasY = (tile.y - minRow) * tileSize;

      ctx.drawImage(img, canvasX, canvasY, tileSize, tileSize);
    } catch (error) {
      console.warn(`Failed to load tile (${tile.x}, ${tile.y}):`, error);
    }
  });

  await Promise.all(loadPromises);

  return canvas;
}

/**
 * Fallback: Create composite from API (old method)
 */
async function createMinimapCompositeFromAPI(
  mapId: number,
  tileCount: number = 64
): Promise<HTMLCanvasElement> {
  // Get map info to determine starting FileDataID
  const mapInfo = await getMapMinimapInfo(mapId);

  if (!mapInfo || !mapInfo.content || !mapInfo.content[0]) {
    throw new Error('Invalid map info response');
  }

  const text = mapInfo.content[0].text;
  const startMatch = text.match(/Starting FileDataID:\*\* (\d+)/);

  if (!startMatch) {
    throw new Error('Could not find starting FileDataID');
  }

  const startFileDataId = parseInt(startMatch[1]);
  const tilesPerRow = Math.sqrt(tileCount);

  // Load tiles
  const fileDataIds = Array.from(
    { length: tileCount },
    (_, i) => startFileDataId + i
  );

  const tiles = await loadMinimapTiles(fileDataIds);

  // Assume 512x512 tiles (WoW minimap tile size)
  const tileSize = 512;
  const canvasSize = tileSize * tilesPerRow;

  // Create composite canvas
  const canvas = document.createElement('canvas');
  canvas.width = canvasSize;
  canvas.height = canvasSize;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }

  // Draw tiles in grid pattern
  tiles.forEach((img, fileDataId) => {
    const index = fileDataId - startFileDataId;
    const row = Math.floor(index / tilesPerRow);
    const col = index % tilesPerRow;

    ctx.drawImage(img, col * tileSize, row * tileSize);
  });

  return canvas;
}
