/**
 * Delete Extracted Map API Route
 */

import { NextRequest, NextResponse } from 'next/server';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { mapId: string } }
) {
  try {
    const mapId = parseInt(params.mapId);
    const { deleteExtractedMap } = await import('@/../../src/tools/mapextraction.js');

    const success = await deleteExtractedMap({ mapId });

    return NextResponse.json({ success });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
