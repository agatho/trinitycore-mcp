/**
 * WDT MAID Extraction API Route
 *
 * Extracts minimap FileDataIDs from WDT MAID chunks using the optimized native-only script.
 */

import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import { join } from 'path';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { mapName, forceReExtract } = body;

    const projectRoot = join(process.cwd(), '..');
    const scriptPath = join(projectRoot, 'scripts', 'extract-wdt-minimap-tiles-optimized.js');

    // Build command arguments
    const args = [scriptPath];
    if (forceReExtract) {
      args.push('--force');
    }
    if (mapName) {
      args.push(`--map=${mapName}`);
    }

    return new Promise((resolve) => {
      let output = '';
      let errorOutput = '';
      let processedMaps = 0;
      let totalTiles = 0;
      let cacheHits = 0;
      let duration = 0;

      const child = spawn('node', args, {
        cwd: projectRoot,
        env: { ...process.env }
      });

      child.stdout.on('data', (data) => {
        const text = data.toString();
        output += text;

        // Parse progress from output
        const processedMatch = text.match(/Successfully processed: (\d+) WDT files/);
        if (processedMatch) {
          processedMaps = parseInt(processedMatch[1]);
        }

        const tilesMatch = text.match(/Total minimap tiles found: (\d+)/);
        if (tilesMatch) {
          totalTiles = parseInt(tilesMatch[1]);
        }

        const cacheMatch = text.match(/Cache hits: (\d+)/);
        if (cacheMatch) {
          cacheHits = parseInt(cacheMatch[1]);
        }

        const durationMatch = text.match(/Total duration: ([\d.]+)s/);
        if (durationMatch) {
          duration = parseFloat(durationMatch[1]);
        }
      });

      child.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve(NextResponse.json({
            success: true,
            processedMaps,
            totalTiles,
            cacheHits,
            duration,
            output: output.split('\n').slice(-20).join('\n') // Last 20 lines
          }));
        } else {
          resolve(NextResponse.json({
            success: false,
            error: errorOutput || 'WDT extraction failed',
            output: output.split('\n').slice(-20).join('\n')
          }, { status: 500 }));
        }
      });

      child.on('error', (error) => {
        resolve(NextResponse.json({
          success: false,
          error: error.message
        }, { status: 500 }));
      });
    });
  } catch (error: any) {
    console.error('Error in /api/wdt/extract:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
