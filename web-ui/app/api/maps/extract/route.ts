/**
 * Map Extraction API Route
 */

import { NextRequest, NextResponse } from 'next/server';
import path from 'path';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { mapId, quality, enableTiling, tileSize } = body;

    // Import from the compiled dist directory
    const mapExtractionPath = path.join(process.cwd(), '..', 'dist', 'tools', 'mapextraction.js');
    const { extractMapTextures } = await import(mapExtractionPath);

    const status = await extractMapTextures({
      mapId,
      quality,
      enableTiling,
      tileSize
    });

    return NextResponse.json(status);
  } catch (error: any) {
    console.error('Failed to extract map:', error);
    return NextResponse.json(
      { error: error.message, stack: error.stack },
      { status: 500 }
    );
  }
}
