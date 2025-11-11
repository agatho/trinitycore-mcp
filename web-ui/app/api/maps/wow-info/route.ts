/**
 * WoW Installation Info API Route
 */

import { NextResponse } from 'next/server';
import { existsSync } from 'fs';
import { join } from 'path';
import { access } from 'fs/promises';

export async function GET() {
  try {
    // Read WOW_PATH directly from Next.js environment
    const wowPath = process.env.WOW_PATH;

    if (!wowPath) {
      // No WOW_PATH configured, try auto-detection
      return NextResponse.json({
        configured: false,
        valid: false,
      });
    }

    // Validate the path exists and has CASC data
    const pathExists = existsSync(wowPath);
    let cascValid = false;

    if (pathExists) {
      try {
        const dataPath = join(wowPath, 'Data', 'data');
        await access(dataPath);
        cascValid = true;
      } catch {
        cascValid = false;
      }
    }

    return NextResponse.json({
      configured: true,
      path: wowPath,
      valid: cascValid,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        configured: false,
        valid: false,
        error: error.message
      },
      { status: 500 }
    );
  }
}
