/**
 * Delete Extracted Map API Route
 */

import { NextRequest, NextResponse } from 'next/server';
import { deleteExtractedMap } from '@/lib/mapextraction';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ mapId: string }> }
) {
  try {
    const resolvedParams = await params;
    const mapId = parseInt(resolvedParams.mapId);

    if (isNaN(mapId) || mapId < 0) {
      return NextResponse.json(
        { error: 'Invalid map ID' },
        { status: 400 }
      );
    }

    const success = await deleteExtractedMap({ mapId });

    return NextResponse.json({ success });
  } catch (error: any) {
    console.error('Error in /api/maps/[mapId] DELETE:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
