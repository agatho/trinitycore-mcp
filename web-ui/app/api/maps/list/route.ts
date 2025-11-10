/**
 * List Available Maps API Route
 */

import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const { listAvailableMaps } = await import('@/../../src/tools/mapextraction.js');
    const maps = await listAvailableMaps();
    return NextResponse.json(maps);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
