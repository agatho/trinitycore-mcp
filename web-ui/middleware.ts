/**
 * Next.js Middleware - API Authentication & Rate Limiting
 *
 * This middleware runs on every request matching the configured paths.
 * It enforces API key authentication for all `/api/` routes except
 * explicitly listed public routes.
 *
 * Authentication is enabled when API_SECRET_KEY is set in .env.local.
 * Without it, all routes are accessible (development mode).
 *
 * @module middleware
 * @see {@link lib/auth} for authentication implementation
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  authenticateRequest,
  isAuthEnabled,
  isPublicRoute,
  checkRateLimit,
} from './lib/auth';

/**
 * Main middleware function.
 *
 * Handles:
 * 1. CORS preflight (OPTIONS) requests - always allowed
 * 2. Public route bypass - no auth needed
 * 3. API key authentication for protected routes
 * 4. Rate limit headers on successful responses
 *
 * @param request - Incoming Next.js request
 * @returns NextResponse or undefined (passthrough)
 */
export function middleware(request: NextRequest): NextResponse | undefined {
  const { pathname } = request.nextUrl;

  // Always allow OPTIONS (CORS preflight) requests through
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  // Skip non-API routes entirely (pages, static assets, etc.)
  if (!pathname.startsWith('/api/')) {
    return undefined;
  }

  // Skip public routes
  if (isPublicRoute(pathname)) {
    return undefined;
  }

  // Authenticate the request
  const authError = authenticateRequest(request);
  if (authError) {
    return authError;
  }

  // Authentication passed - add rate limit info headers to response
  const response = NextResponse.next();

  // Add security headers
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Add auth status header (useful for debugging)
  if (isAuthEnabled()) {
    response.headers.set('X-Auth-Status', 'authenticated');

    // Add rate limit headers
    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip')
      || 'unknown';

    const rateLimit = checkRateLimit(clientIp);
    response.headers.set('X-RateLimit-Remaining', String(rateLimit.remaining));
    response.headers.set('X-RateLimit-Reset', String(rateLimit.resetIn));
  }

  return response;
}

/**
 * Configure which routes this middleware applies to.
 *
 * Only API routes are matched - pages, static assets, and Next.js
 * internal routes are excluded for performance.
 */
export const config = {
  matcher: [
    // Match all API routes
    '/api/:path*',
  ],
};
