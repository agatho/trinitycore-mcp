/**
 * Map Extraction API Route
 */

import { NextRequest, NextResponse } from 'next/server';
import { extractMapTextures } from '@/lib/mapextraction';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { mapId, quality, enableTiling, tileSize } = body;

    const status = await extractMapTextures({
      mapId,
      quality,
      enableTiling,
      tileSize
    });

    return NextResponse.json(status);
  } catch (error: any) {
    console.error('Error in /api/maps/extract:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
