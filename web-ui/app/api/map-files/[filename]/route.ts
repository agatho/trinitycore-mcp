/**
 * API Route: GET /api/map-files/[filename]
 * Serves a specific .map file from configured MAP_FILES_PATH
 */

import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs/promises";
import * as path from "path";

export async function GET(
  request: NextRequest,
  { params }: { params: { filename: string } }
) {
  try {
    const mapFilesPath = process.env.MAP_FILES_PATH;
    const { filename } = params;

    if (!mapFilesPath) {
      return NextResponse.json(
        {
          success: false,
          error: "MAP_FILES_PATH not configured. Please set MAP_FILES_PATH in .env.local",
        },
        { status: 400 }
      );
    }

    // Validate filename (prevent path traversal)
    if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid filename",
        },
        { status: 400 }
      );
    }

    // Only allow .map files
    if (!filename.endsWith('.map')) {
      return NextResponse.json(
        {
          success: false,
          error: "Only .map files are allowed",
        },
        { status: 400 }
      );
    }

    const filePath = path.join(mapFilesPath, filename);

    // Check if file exists
    try {
      await fs.access(filePath);
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          error: `Map file not found: ${filename}`,
        },
        { status: 404 }
      );
    }

    // Read file
    const fileBuffer = await fs.readFile(filePath);

    // Return file as binary response
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': fileBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error("Error serving map file:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
