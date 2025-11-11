/**
 * List Available Maps API Route
 */

import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Return a list of available WoW maps
    // TODO: Check which maps are actually extracted by looking at filesystem
    const maps = [
      { id: 0, name: 'Eastern Kingdoms', extracted: false },
      { id: 1, name: 'Kalimdor', extracted: false },
      { id: 530, name: 'Outland', extracted: false },
      { id: 571, name: 'Northrend', extracted: false },
      { id: 860, name: 'Pandaria', extracted: false },
      { id: 870, name: 'Draenor', extracted: false },
      { id: 1116, name: 'Broken Isles', extracted: false },
      { id: 1220, name: 'Kul Tiras', extracted: false },
      { id: 1642, name: 'Shadowlands', extracted: false },
      { id: 2444, name: 'Dragon Isles', extracted: false },
      { id: 2552, name: 'The War Within', extracted: false }
    ];

    return NextResponse.json(maps);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
