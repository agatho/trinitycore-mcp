/**
 * Minimap tile extraction tools for MCP
 */

import { getMinimapService } from '../services/MinimapService.js';
import { logger } from '../utils/logger.js';
import path from 'path';

/**
 * Get map information including starting FileDataID for minimap tiles
 */
export async function getMapMinimap(args: { mapId: number }) {
  try {
    const config = {
      wowPath: process.env.WOW_PATH || 'M:/World of Warcraft',
      listFilePath: process.env.LISTFILE_PATH || 'C:/temp/wow-listfile.csv',
      cacheDir: path.join(process.cwd(), 'cache', 'minimaps')
    };

    const minimapService = getMinimapService(config);
    await minimapService.initialize();

    const mapInfo = await minimapService.getMapInfo(args.mapId);

    if (!mapInfo) {
      return {
        content: [
          {
            type: 'text',
            text: `Map ${args.mapId} not found in Map.db2`
          }
        ]
      };
    }

    // Get sample tiles for documentation
    const sampleTiles = mapInfo.tiles.slice(0, 5);
    const sampleText = sampleTiles.map(t =>
      `- **${t.fileName}** (${t.x}, ${t.y}): FileDataID ${t.fileDataId}`
    ).join('\n');

    return {
      content: [
        {
          type: 'text',
          text: `# Map: ${mapInfo.mapName} (ID: ${mapInfo.mapId})

**Minimap Folder:** world/minimaps/${mapInfo.folderName}/
**Total Tiles:** ${mapInfo.tileCount}

Modern WoW (11.x) stores minimap tiles at:
  \`world/minimaps/{mapfolder}/mapXX_YY.blp\`

NOT as consecutive FileDataIDs from Map.db2's WdtFileDataID field!

## Sample Tiles
${sampleText}

## To Extract All Tiles
Use \`get-minimap-tiles-batch\` with the list of FileDataIDs:
\`\`\`json
{
  "fileDataIds": [${mapInfo.tiles.slice(0, 10).map(t => t.fileDataId).join(', ')}${mapInfo.tiles.length > 10 ? ', ...' : ''}]
}
\`\`\`

The tiles are in BLP format (DXT compressed) and will be automatically converted to PNG and cached.
`
        }
      ]
    };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    return {
      content: [{
        type: 'text',
        text: `Error in getMapMinimap: ${err.message}`
      }]
    };
  }
}

/**
 * Extract and convert a minimap tile to PNG
 */
export async function getMinimapTile(args: { fileDataId: number; forceRefresh?: boolean }) {
  try {
    const config = {
      wowPath: process.env.WOW_PATH || 'M:/World of Warcraft',
      listFilePath: process.env.LISTFILE_PATH || 'C:/temp/wow-listfile.csv',
      cacheDir: path.join(process.cwd(), 'cache', 'minimaps')
    };

    const minimapService = getMinimapService(config);
    await minimapService.initialize();

    const pngBuffer = await minimapService.getTilePNG(args.fileDataId, args.forceRefresh || false);

    const cachePath = path.join(config.cacheDir, `${args.fileDataId}.png`);

    return {
      content: [
        {
          type: 'text',
          text: `# Minimap Tile Extracted

**FileDataID:** ${args.fileDataId}
**Size:** ${(pngBuffer.length / 1024).toFixed(2)} KB
**Format:** PNG (converted from BLP/DXT)
**Cache Path:** ${cachePath}

The tile has been extracted from CASC, decompressed from DXT, converted to PNG, and cached.

To use in web UI:
\`\`\`html
<img src="data:image/png;base64,${pngBuffer.toString('base64').substring(0, 100)}..." />
\`\`\`

Or access via file system at: ${cachePath}
`
        },
        {
          type: 'resource',
          resource: {
            uri: `file://${cachePath}`,
            mimeType: 'image/png',
            text: `Minimap tile ${args.fileDataId}`
          }
        }
      ]
    };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    return {
      content: [{
        type: 'text',
        text: `Error in getMinimapTile: ${err.message}`
      }]
    };
  }
}

/**
 * Extract multiple tiles in batch
 */
export async function getMinimapTilesBatch(args: {
  fileDataIds?: number[];
  mapId?: number;
  startFileDataId?: number;
  startIndex?: number;
  count?: number;
}) {
  try {
    const config = {
      wowPath: process.env.WOW_PATH || 'M:/World of Warcraft',
      listFilePath: process.env.LISTFILE_PATH || 'C:/temp/wow-listfile.csv',
      cacheDir: path.join(process.cwd(), 'cache', 'minimaps')
    };

    const minimapService = getMinimapService(config);
    await minimapService.initialize();

    // Build tile list with coordinates
    let tiles: Array<{ fileDataId: number; x?: number; y?: number }>;
    if (args.fileDataIds && args.fileDataIds.length > 0) {
      tiles = args.fileDataIds.map(id => ({ fileDataId: id }));
    } else if (args.mapId) {
      // Extract all or subset of tiles for a map
      const mapInfo = await minimapService.getMapInfo(args.mapId);
      if (!mapInfo) {
        throw new Error(`Map ${args.mapId} not found or has no minimap data`);
      }

      // If startIndex and count are provided, extract a subset (for chunking)
      if (typeof args.startIndex === 'number' && typeof args.count === 'number') {
        const allTiles = mapInfo.tiles;
        tiles = allTiles.slice(args.startIndex, args.startIndex + args.count).map(t => ({
          fileDataId: t.fileDataId,
          x: t.x,
          y: t.y
        }));
        logger.info('MinimapTool', `Extracting chunk: tiles ${args.startIndex + 1}-${args.startIndex + tiles.length} of ${allTiles.length}`);
      } else {
        // Extract all tiles for the map
        tiles = mapInfo.tiles.map(t => ({
          fileDataId: t.fileDataId,
          x: t.x,
          y: t.y
        }));
      }
    } else if (args.startFileDataId && args.count) {
      tiles = Array.from({ length: args.count }, (_, i) => ({ fileDataId: args.startFileDataId! + i }));
    } else {
      throw new Error('Must provide either fileDataIds array, mapId, or startFileDataId+count');
    }

    // Progress reporting
    const progressReports: string[] = [];
    const progressCallback = (progress: { current: number; total: number; percent: number; successCount: number; failCount: number }) => {
      const report = `Progress: ${progress.current}/${progress.total} (${progress.percent}%) - Success: ${progress.successCount}, Failed: ${progress.failCount}`;
      progressReports.push(report);
      logger.info('MinimapTool', report);
    };

    const results = await minimapService.getTilesBatch(tiles, args.mapId, progressCallback);

    const successCount = results.size;
    const failCount = tiles.length - successCount;

    let summary = `# Minimap Batch Extraction Complete\n\n`;
    summary += `**Requested:** ${tiles.length} tiles\n`;
    summary += `**Successful:** ${successCount} tiles\n`;
    summary += `**Failed:** ${failCount} tiles\n\n`;

    if (progressReports.length > 0) {
      summary += `## Progress Log\n\n`;
      progressReports.forEach(report => {
        summary += `- ${report}\n`;
      });
      summary += `\n`;
    }

    if (successCount > 0 && successCount <= 20) {
      summary += `## Successfully Extracted Tiles\n\n`;
      for (const [fileDataId, buffer] of results.entries()) {
        summary += `- **${fileDataId}**: ${(buffer.length / 1024).toFixed(2)} KB\n`;
      }
    } else if (successCount > 20) {
      summary += `## Successfully Extracted ${successCount} Tiles\n\n`;
      summary += `Showing first 10 and last 10 tiles:\n\n`;
      const entries = Array.from(results.entries());
      const first10 = entries.slice(0, 10);
      const last10 = entries.slice(-10);
      first10.forEach(([fileDataId, buffer]) => {
        summary += `- **${fileDataId}**: ${(buffer.length / 1024).toFixed(2)} KB\n`;
      });
      summary += `... (${successCount - 20} more tiles)\n`;
      last10.forEach(([fileDataId, buffer]) => {
        summary += `- **${fileDataId}**: ${(buffer.length / 1024).toFixed(2)} KB\n`;
      });
    }

    if (args.mapId) {
      const cwd = process.cwd();
      const rootDir = cwd.endsWith('web-ui') ? path.join(cwd, '..') : cwd;
      const webUiPath = path.join(rootDir, 'web-ui', 'public', 'maps', 'tiles', args.mapId.toString());
      summary += `\n## Storage Location\nTiles stored in web-ui directory:\n${webUiPath}\n\n`;
      summary += `Access in web UI: \`/maps/tiles/${args.mapId}/{fileDataId}.png\`\n`;
    } else {
      summary += `\n## Cache Location\n${config.cacheDir}\n`;
    }

    return {
      content: [
        {
          type: 'text',
          text: summary
        }
      ]
    };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    return {
      content: [{
        type: 'text',
        text: `Error in getMinimapTilesBatch: ${err.message}`
      }]
    };
  }
}

/**
 * Clear minimap cache
 */
export async function clearMinimapCache(args?: { mapId?: number }) {
  try {
    const config = {
      wowPath: process.env.WOW_PATH || 'M:/World of Warcraft',
      listFilePath: process.env.LISTFILE_PATH || 'C:/temp/wow-listfile.csv',
      cacheDir: path.join(process.cwd(), 'cache', 'minimaps')
    };

    const minimapService = getMinimapService(config);
    await minimapService.initialize();

    await minimapService.clearCache(args?.mapId);

    const message = args?.mapId
      ? `Cleared minimap cache for map ${args.mapId}`
      : `Cleared all minimap cache`;

    return {
      content: [
        {
          type: 'text',
          text: `# Cache Cleared\n\n${message}\n\nCache directory: ${config.cacheDir}`
        }
      ]
    };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    return {
      content: [{
        type: 'text',
        text: `Error in clearMinimapCache: ${err.message}`
      }]
    };
  }
}
