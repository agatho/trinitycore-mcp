/**
 * WDT MAID Extraction API Route
 *
 * Extracts minimap FileDataIDs from WDT MAID chunks using the extraction script.
 * The script (scripts/extract-wdt-minimap-tiles-optimized.js) parses WDT files
 * from the CASC data directory and outputs FileDataID mappings.
 *
 * Node.js built-in modules are loaded via dynamic import() with 'node:' prefix
 * to prevent Turbopack from statically analyzing the spawn arguments at build time.
 */

import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { mapName, forceReExtract } = body;

    // Dynamic imports to prevent Turbopack static analysis of spawn arguments
    const nodeCP = await import('node:child_process');
    const nodePath = await import('node:path');
    const nodeFs = await import('node:fs');

    const projectRoot = nodePath.resolve(process.cwd(), '..');
    const scriptPath = nodePath.resolve(
      projectRoot, 'scripts', 'extract-wdt-minimap-tiles-optimized.js'
    );

    // Verify extraction script exists before attempting to spawn
    if (!nodeFs.existsSync(scriptPath)) {
      return NextResponse.json({
        success: false,
        error: 'WDT extraction script not found. Ensure scripts/extract-wdt-minimap-tiles-optimized.js exists.',
      }, { status: 503 });
    }

    // Build command arguments
    const args = [scriptPath];
    if (forceReExtract) {
      args.push('--force');
    }
    if (mapName) {
      args.push(`--map=${mapName}`);
    }

    return new Promise<NextResponse>((resolve) => {
      let output = '';
      let errorOutput = '';
      let processedMaps = 0;
      let totalTiles = 0;
      let cacheHits = 0;
      let duration = 0;

      const child = nodeCP.spawn('node', args, {
        cwd: projectRoot,
        env: { ...process.env }
      });

      child.stdout.on('data', (data: Buffer) => {
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

      child.stderr.on('data', (data: Buffer) => {
        errorOutput += data.toString();
      });

      child.on('close', (code: number | null) => {
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

      child.on('error', (error: Error) => {
        resolve(NextResponse.json({
          success: false,
          error: error.message
        }, { status: 500 }));
      });
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Error in /api/wdt/extract:', error);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
