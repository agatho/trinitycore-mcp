/**
 * API Method Detail Route
 * GET /api/docs/[method] - Get specific method documentation
 * Example: GET /api/docs/Player::CastSpell
 */

import { NextRequest, NextResponse } from 'next/server';
import { getMethodByName } from '@/lib/api-docs-loader';

export async function GET(
  request: NextRequest,
  { params }: { params: { method: string } }
) {
  try {
    const methodName = decodeURIComponent(params.method);

    // Get method documentation
    const method = getMethodByName(methodName);

    if (!method) {
      return NextResponse.json(
        {
          success: false,
          error: `Method ${methodName} not found`,
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
