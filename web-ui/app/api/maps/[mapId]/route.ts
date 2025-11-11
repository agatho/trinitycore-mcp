/**
 * Delete Extracted Map API Route
 */

import { NextRequest, NextResponse } from 'next/server';
import path from 'path';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { mapId: string } }
) {
  try {
    const mapId = parseInt(params.mapId);

    // Import from the compiled dist directory
    const mapExtractionPath = path.join(process.cwd(), '..', 'dist', 'tools', 'mapextraction.js');
    const { deleteExtractedMap } = await import(mapExtractionPath);

    const success = await deleteExtractedMap({ mapId });

    return NextResponse.json({ success });
  } catch (error: any) {
    console.error('Failed to delete map:', error);
    return NextResponse.json(
      { error: error.message, stack: error.stack },
      { status: 500 }
    );
  }
}
