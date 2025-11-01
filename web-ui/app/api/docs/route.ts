/**
 * API Documentation Route
 * GET /api/docs - List all API methods
 * GET /api/docs?class=Player - Filter by class
 * GET /api/docs?search=query - Search methods
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  loadAllAPIDocs,
  getMethodsByClass,
  searchMethods,
  getAllClasses,
  getAPIDocsStats,
} from '@/lib/api-docs-loader';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const className = searchParams.get('class');
    const searchQuery = searchParams.get('search');
    const statsOnly = searchParams.get('stats') === 'true';

    // Return stats only
    if (statsOnly) {
      const stats = getAPIDocsStats();
      return NextResponse.json({
        success: true,
        stats,
      });
    }

    // Return all class names
    if (searchParams.get('classes') === 'true') {
      const classes = getAllClasses();
      return NextResponse.json({
        success: true,
        classes,
        count: classes.length,
      });
    }

    // Search methods
    if (searchQuery) {
      const results = searchMethods(searchQuery);
      return NextResponse.json({
        success: true,
        query: searchQuery,
        results,
        count: results.length,
      });
    }

    // Filter by class
    if (className) {
      const methods = getMethodsByClass(className);
      return NextResponse.json({
        success: true,
        className,
        methods,
        count: methods.length,
      });
    }

    // Return all methods (paginated)
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const allMethods = loadAllAPIDocs();

    const start = (page - 1) * limit;
    const end = start + limit;
    const paginatedMethods = allMethods.slice(start, end);

    return NextResponse.json({
      success: true,
      methods: paginatedMethods,
      pagination: {
        page,
        limit,
        total: allMethods.length,
        totalPages: Math.ceil(allMethods.length / limit),
      },
    });
  } catch (error: any) {
    console.error('Error fetching API docs:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch API documentation',
      },
      { status: 500 }
    );
  }
}
