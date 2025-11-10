/**
 * WoW Installation Info API Route
 */

import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const { getWoWInstallationInfo } = await import('@/../../src/tools/mapextraction.js');
    const info = await getWoWInstallationInfo();
    return NextResponse.json(info);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
