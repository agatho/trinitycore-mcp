/**
 * API Method Detail Route
 * GET /api/docs/[method] - Get specific method documentation
 * Example: GET /api/docs/Player_CastSpell (uses ID, not full signature)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getMethodById } from '@/lib/api-docs-loader';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ method: string }> }
) {
  try {
    const { method: methodParam } = await params;
    const methodId = decodeURIComponent(methodParam);

    // Get method documentation by ID (ClassName_MethodName format)
    const method = getMethodById(methodId);

    if (!method) {
      return NextResponse.json(
        {
          success: false,
          error: `Method with ID ${methodId} not found`,
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      method,
    });
  } catch (error: any) {
    console.error('Error fetching method details:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch method details',
      },
      { status: 500 }
    );
  }
}
