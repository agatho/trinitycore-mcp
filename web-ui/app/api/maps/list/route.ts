/**
 * List Available Maps API Route
 */

import { NextResponse } from 'next/server';
import { listAvailableMaps } from '@/lib/mapextraction';

export async function GET() {
  try {
    const maps = await listAvailableMaps();
    return NextResponse.json(maps);
  } catch (error: any) {
    console.error('Error in /api/maps/list:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
