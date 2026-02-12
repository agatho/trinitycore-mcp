/**
 * Collision Data API Route
 *
 * Serves VMap/MMap/Map files from configured filesystem paths.
 * Falls back gracefully if paths are not configured.
 *
 * Environment Variables (supports multiple naming conventions):
 * - VMAP_PATH or VMAP_DATA_PATH: Path to VMap directory (e.g., /path/to/vmaps)
 * - MMAP_PATH or MMAP_DATA_PATH: Path to MMap directory (e.g., /path/to/mmaps)
 * - MAP_PATH or MAP_DATA_PATH: Path to .map terrain files (e.g., /path/to/maps)
 */

import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

interface CollisionFileInfo {
  filename: string;
  size: number;
  exists: boolean;
}

/**
 * Get the correct path for a given data type, checking multiple env var names
 */
function getDataPath(type: string): string | undefined {
  switch (type) {
    case 'vmap':
      return process.env.VMAP_PATH || process.env.VMAP_DATA_PATH;
    case 'mmap':
      return process.env.MMAP_PATH || process.env.MMAP_DATA_PATH;
    case 'map':
      return process.env.MAP_PATH || process.env.MAP_DATA_PATH;
    default:
      return undefined;
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const mapId = searchParams.get('mapId');
  const type = searchParams.get('type'); // 'vmap', 'mmap', 'map', or 'vmo'
  const action = searchParams.get('action'); // 'list' or 'download'
  const filename = searchParams.get('filename');
  const modelName = searchParams.get('model'); // For .vmo files

  // Special case: .vmo files don't need mapId
  if (type === 'vmo' && action === 'download' && modelName) {
    return await downloadVMOFile(modelName);
  }

  if (!mapId || !type) {
    return NextResponse.json(
      { error: 'Missing required parameters: mapId and type' },
      { status: 400 }
    );
  }

  // Get base path from environment (supports multiple naming conventions)
  const basePath = getDataPath(type);

  if (!basePath) {
    const envVarHint = type === 'vmap'
      ? 'VMAP_PATH or VMAP_DATA_PATH'
      : type === 'mmap'
        ? 'MMAP_PATH or MMAP_DATA_PATH'
        : 'MAP_PATH or MAP_DATA_PATH';

    return NextResponse.json(
      {
        error: 'Collision data path not configured',
        hint: `Set ${envVarHint} in .env.local`,
        available: false,
      },
      { status: 404 }
    );
  }

  try {
    // List available files for this map
    if (action === 'list' || !action) {
      const files = await listCollisionFiles(basePath, mapId, type as 'vmap' | 'mmap' | 'map');
      return NextResponse.json({
        available: true,
        mapId,
        type,
        files,
      });
    }

    // Download specific file
    if (action === 'download' && filename) {
      let filePath: string;

      // VMap files are in subfolders: vmaps/<mapId>/file
      // Other files are at root level
      if (type === 'vmap') {
        const mapIdPadded = mapId.padStart(4, '0');
        filePath = path.join(basePath, mapIdPadded, filename);
      } else {
        filePath = path.join(basePath, filename);
      }

      // Security: Prevent path traversal
      if (!filePath.startsWith(basePath)) {
        return NextResponse.json(
          { error: 'Invalid file path' },
          { status: 403 }
        );
      }

      const fileBuffer = await fs.readFile(filePath);

      return new NextResponse(fileBuffer, {
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Content-Length': fileBuffer.length.toString(),
        },
      });
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error: any) {
    console.error(`[CollisionDataAPI] Error:`, error);
    return NextResponse.json(
      {
        error: 'Failed to read collision data',
        message: error.message,
        available: false,
      },
      { status: 500 }
    );
  }
}

/**
 * Download a .vmo model file
 *
 * VMO files are stored at the root of the vmaps folder with names like:
 * - FILE0001A0B7.xxx.vmo
 *
 * The spawn's 'name' field contains the model name WITHOUT .vmo extension, e.g.:
 * - FILE0001A0B7.xxx
 *
 * TrinityCore loads models by appending ".vmo" to the spawn name.
 */
async function downloadVMOFile(modelName: string): Promise<NextResponse> {
  const vmapPath = getDataPath('vmap');

  if (!vmapPath) {
    return NextResponse.json(
      { error: 'VMap path not configured' },
      { status: 404 }
    );
  }

  try {
    // Construct the .vmo filename from the spawn name
    // TrinityCore uses: basepath + filename + ".vmo"
    let vmoFilename: string;

    if (modelName.endsWith('.vmo')) {
      // Already has .vmo extension
      vmoFilename = modelName;
    } else {
      // Append .vmo extension
      vmoFilename = modelName + '.vmo';
    }

    const filePath = path.join(vmapPath, vmoFilename);

    // Security: Prevent path traversal
    const resolvedPath = path.resolve(filePath);
    const resolvedBase = path.resolve(vmapPath);
    if (!resolvedPath.startsWith(resolvedBase)) {
      return NextResponse.json(
        { error: 'Invalid file path' },
        { status: 403 }
      );
    }

    // Try to read the file
    const fileBuffer = await fs.readFile(resolvedPath);

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${path.basename(vmoFilename)}"`,
        'Content-Length': fileBuffer.length.toString(),
      },
    });
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return NextResponse.json(
        { error: 'VMO file not found', model: modelName },
        { status: 404 }
      );
    }
    console.error('[CollisionDataAPI] Error downloading VMO:', error);
    return NextResponse.json(
      { error: 'Failed to download VMO file', message: error.message },
      { status: 500 }
    );
  }
}

/**
 * List available collision files for a map
 */
async function listCollisionFiles(
  basePath: string,
  mapId: string,
  type: 'vmap' | 'mmap' | 'map'
): Promise<CollisionFileInfo[]> {
  const files: CollisionFileInfo[] = [];
  const mapIdPadded = mapId.padStart(4, '0'); // All types use 4-digit map IDs

  try {
    if (type === 'vmap') {
      // VMap files are in subfolders: vmaps/<mapId>/
      const mapFolder = path.join(basePath, mapIdPadded);

      // Check if map folder exists
      try {
        await fs.access(mapFolder);
      } catch {
        // Folder doesn't exist - no files available
        return files;
      }

      const dirContents = await fs.readdir(mapFolder);

      // Look for .vmtree file
      const treeFile = `${mapIdPadded}.vmtree`;
      if (dirContents.includes(treeFile)) {
        const stats = await fs.stat(path.join(mapFolder, treeFile));
        files.push({
          filename: treeFile,
          size: stats.size,
          exists: true,
        });
      }

      // Find all .vmtile files for this map
      const tilePattern = new RegExp(`^${mapIdPadded}_\\d{2}_\\d{2}\\.vmtile$`);
      for (const file of dirContents) {
        if (tilePattern.test(file)) {
          const stats = await fs.stat(path.join(mapFolder, file));
          files.push({
            filename: file,
            size: stats.size,
            exists: true,
          });
        }
      }
    } else if (type === 'mmap') {
      // MMap files are at root level
      const dirContents = await fs.readdir(basePath);

      // Look for .mmap header file
      const headerFile = `${mapIdPadded}.mmap`;
      if (dirContents.includes(headerFile)) {
        const stats = await fs.stat(path.join(basePath, headerFile));
        files.push({
          filename: headerFile,
          size: stats.size,
          exists: true,
        });
      }

      // Find all .mmtile files for this map
      // Format: <mapId><x><y>.mmtile (e.g., 00003248.mmtile = map 0000, tile 32,48)
      const tilePattern = new RegExp(`^${mapIdPadded}\\d{4}\\.mmtile$`);
      for (const file of dirContents) {
        if (tilePattern.test(file)) {
          const stats = await fs.stat(path.join(basePath, file));
          files.push({
            filename: file,
            size: stats.size,
            exists: true,
          });
        }
      }
    } else if (type === 'map') {
      // Map (terrain height) files are at root level
      // Format: <mapId>_<x>_<y>.map (e.g., 0000_32_48.map)
      const dirContents = await fs.readdir(basePath);

      // Look for .tilelist file
      const tilelistFile = `${mapIdPadded}.tilelist`;
      if (dirContents.includes(tilelistFile)) {
        const stats = await fs.stat(path.join(basePath, tilelistFile));
        files.push({
          filename: tilelistFile,
          size: stats.size,
          exists: true,
        });
      }

      // Find all .map files for this map
      const tilePattern = new RegExp(`^${mapIdPadded}_\\d{2}_\\d{2}\\.map$`);
      for (const file of dirContents) {
        if (tilePattern.test(file)) {
          const stats = await fs.stat(path.join(basePath, file));
          files.push({
            filename: file,
            size: stats.size,
            exists: true,
          });
        }
      }
    }
  } catch (error) {
    console.error(`[CollisionDataAPI] Failed to list files:`, error);
  }

  return files;
}
