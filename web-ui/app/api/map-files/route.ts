/**
 * API Route: GET /api/map-files
 * Returns list of all available .map files from configured MAP_FILES_PATH
 */

import { NextResponse } from "next/server";
import * as fs from "fs/promises";
import * as path from "path";

interface MapFileInfo {
  name: string;
  filename: string;
  size: number;
  modified: string;
  path: string;
}

export async function GET() {
  try {
    const mapFilesPath = process.env.MAP_FILES_PATH;

    if (!mapFilesPath) {
      return NextResponse.json(
        {
          success: false,
          error: "MAP_FILES_PATH not configured. Please set MAP_FILES_PATH in .env.local",
          files: [],
        },
        { status: 400 }
      );
    }

    // Check if directory exists
    try {
      await fs.access(mapFilesPath);
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          error: `MAP_FILES_PATH directory not found: ${mapFilesPath}`,
          files: [],
        },
        { status: 404 }
      );
    }

    // Read directory
    const files = await fs.readdir(mapFilesPath);

    // Filter for .map files and get their stats
    const mapFiles: MapFileInfo[] = [];

    for (const file of files) {
      if (file.endsWith('.map')) {
        const filePath = path.join(mapFilesPath, file);
        try {
          const stats = await fs.stat(filePath);

          // Extract map name from filename (format: MapID_X_Y.map)
          const nameParts = file.replace('.map', '').split('_');
          const mapId = nameParts[0];
          const x = nameParts[1];
          const y = nameParts[2];

          mapFiles.push({
            name: `Map ${mapId} (${x}, ${y})`,
            filename: file,
            size: stats.size,
            modified: stats.mtime.toISOString(),
            path: `/api/map-files/${encodeURIComponent(file)}`,
          });
        } catch (error) {
          console.warn(`Failed to stat file ${file}:`, error);
        }
      }
    }

    // Sort by filename
    mapFiles.sort((a, b) => a.filename.localeCompare(b.filename));

    return NextResponse.json({
      success: true,
      count: mapFiles.length,
      basePath: mapFilesPath,
      files: mapFiles,
    });
  } catch (error) {
    console.error("Error listing map files:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        files: [],
      },
      { status: 500 }
    );
  }
}
