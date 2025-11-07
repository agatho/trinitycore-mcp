/**
 * Collision Data API Route
 *
 * Serves VMap/MMap files from configured filesystem paths.
 * Falls back gracefully if paths are not configured.
 *
 * Environment Variables:
 * - VMAP_DATA_PATH: Path to VMap directory (e.g., /path/to/vmaps)
 * - MMAP_DATA_PATH: Path to MMap directory (e.g., /path/to/mmaps)
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

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const mapId = searchParams.get('mapId');
  const type = searchParams.get('type'); // 'vmap' or 'mmap'
  const action = searchParams.get('action'); // 'list' or 'download'
  const filename = searchParams.get('filename');

  if (!mapId || !type) {
    return NextResponse.json(
      { error: 'Missing required parameters: mapId and type' },
      { status: 400 }
    );
  }

  // Get base path from environment
  const basePath = type === 'vmap'
    ? process.env.VMAP_DATA_PATH
    : process.env.MMAP_DATA_PATH;

  if (!basePath) {
    return NextResponse.json(
      {
        error: 'Collision data path not configured',
        hint: `Set ${type === 'vmap' ? 'VMAP_DATA_PATH' : 'MMAP_DATA_PATH'} in .env.local`,
        available: false,
      },
      { status: 404 }
    );
  }

  try {
    // List available files for this map
    if (action === 'list' || !action) {
      const files = await listCollisionFiles(basePath, mapId, type);
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
 * List available collision files for a map
 */
async function listCollisionFiles(
  basePath: string,
  mapId: string,
  type: 'vmap' | 'mmap'
): Promise<CollisionFileInfo[]> {
  const files: CollisionFileInfo[] = [];
  const mapIdPadded = mapId.padStart(type === 'vmap' ? 4 : 3, '0');

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
      // Format: <mapId><x><y>.mmtile (e.g., 0003248.mmtile = map 000, tile 32,48)
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
    }
  } catch (error) {
    console.error(`[CollisionDataAPI] Failed to list files:`, error);
  }

  return files;
}
