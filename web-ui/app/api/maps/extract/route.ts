/**
 * Map Extraction API Route
 */

import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { mapId, quality, enableTiling, tileSize } = body;

    // Call MCP tool (would be actual MCP call in production)
    // For now, simulate the extraction process
    const { extractMapTextures } = await import('@/../../src/tools/mapextraction.js');

    const status = await extractMapTextures({
      mapId,
      quality,
      enableTiling,
      tileSize
    });

    return NextResponse.json(status);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
