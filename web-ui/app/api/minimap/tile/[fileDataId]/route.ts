/**
 * API Route: GET /api/minimap/tile/[fileDataId]
 * Get minimap tile as PNG image
 */

import { NextRequest, NextResponse } from 'next/server';
import { getMCPClient, initializeMCPClient } from '@/lib/mcp/client';
import fs from 'fs/promises';
import path from 'path';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fileDataId: string }> }
) {
  try {
    const resolvedParams = await params;
    const fileDataId = parseInt(resolvedParams.fileDataId);

    if (isNaN(fileDataId) || fileDataId < 0) {
      return NextResponse.json(
        { success: false, error: 'Invalid file data ID' },
        { status: 400 }
      );
    }

    // Get force refresh parameter
    const { searchParams } = new URL(request.url);
    const forceRefresh = searchParams.get('forceRefresh') === 'true';

    // Ensure MCP client is connected
    const client = getMCPClient();
    if (!client.isClientConnected()) {
      await initializeMCPClient();
    }

    // Call the minimap tile tool
    const result = await client.callTool('get-minimap-tile', {
      fileDataId,
      forceRefresh
    });

    // Handle both string and structured MCP responses
    let text: string;
    if (typeof result === 'string') {
      // Direct text response
      text = result;
    } else if (result && typeof result === 'object' && 'content' in result) {
      // Structured response with content array
      const content = (result as any).content;
      if (Array.isArray(content) && content.length > 0 && content[0].text) {
        text = content[0].text;
      } else {
        throw new Error('Invalid structured response format');
      }
    } else {
      throw new Error(`Unexpected response type: ${typeof result}`);
    }

    // The MCP tool caches tiles at process.cwd()/cache/minimaps/{fileDataId}.png
    // Since the MCP server runs from the project root, compute the path directly
    const cachePath = path.join(process.cwd(), '..', 'cache', 'minimaps', `${fileDataId}.png`);

    // Check if extraction was successful by verifying the file exists
    if (!text.includes('Minimap Tile Extracted')) {
      // MCP tool returned an error
      throw new Error(text);
    }

    // Read the PNG file
    const pngData = await fs.readFile(cachePath);

    // Return the PNG image
    return new NextResponse(pngData, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=31536000, immutable', // Cache for 1 year
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    // A FileDataID that names no tile is a request for something that does not
    // exist, not a failure of this endpoint. Answering 500 made every absent
    // tile look like a server fault.
    const notFound = /not found|does not exist|no such file|ENOENT/i.test(message);

    console.error('Error in /api/minimap/tile/[fileDataId]:', error);
    return NextResponse.json(
      { success: false, error: message },
      { status: notFound ? 404 : 500 }
    );
  }
}
