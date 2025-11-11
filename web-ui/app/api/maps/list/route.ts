/**
 * List Available Maps API Route
 */

import { NextResponse } from 'next/server';
import path from 'path';

export async function GET() {
  try {
    // Import from the compiled dist directory
    const mapExtractionPath = path.join(process.cwd(), '..', 'dist', 'tools', 'mapextraction.js');
    const { listAvailableMaps } = await import(mapExtractionPath);
    const maps = await listAvailableMaps();
    return NextResponse.json(maps);
  } catch (error: any) {
    console.error('Failed to load maps:', error);
    return NextResponse.json(
      { error: error.message, stack: error.stack },
      { status: 500 }
    );
  }
}
