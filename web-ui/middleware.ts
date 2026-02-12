/**
 * Next.js Middleware - API Authentication, Rate Limiting & CORS
 *
 * This middleware runs on every request matching the configured paths.
 * It enforces API key authentication for all `/api/` routes except
 * explicitly listed public routes.
 *
 * Authentication is enabled when API_SECRET_KEY is set in .env.local.
 * Without it, all routes are accessible (development mode).
 *
 * CORS is configured via CORS_ORIGIN environment variable.
 * Defaults to http://localhost:3000. Set to comma-separated origins
 * for multiple allowed origins. Use "*" only for development.
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
 * Parse allowed CORS origins from environment variable.
 * Supports comma-separated list of origins.
 * Defaults to http://localhost:3000 if not set.
 */
function getAllowedOrigins(): string[] {
  const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:3000';
  if (corsOrigin === '*') {
    return ['*'];
  }
  return corsOrigin
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);
}

/**
 * Check if the request origin is allowed by CORS policy.
 *
 * @param requestOrigin - The Origin header from the request
 * @returns The allowed origin string, or null if not allowed
 */
function getValidCorsOrigin(requestOrigin: string | null): string | null {
  const allowedOrigins = getAllowedOrigins();

  // Wildcard allows everything (development only)
  if (allowedOrigins.includes('*')) {
    return requestOrigin || '*';
  }

  // No origin header (same-origin requests, curl, etc.) - allow
  if (!requestOrigin) {
    return allowedOrigins[0] || null;
  }

  // Check if origin is in allowed list
  if (allowedOrigins.includes(requestOrigin)) {
    return requestOrigin;
  }

  return null;
}

/**
 * Add CORS headers to a response.
 */
function addCorsHeaders(response: NextResponse, origin: string): void {
  response.headers.set('Access-Control-Allow-Origin', origin);
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key');
  response.headers.set('Access-Control-Max-Age', '86400');
  // Vary header is required when origin is not wildcard
  if (origin !== '*') {
    response.headers.set('Vary', 'Origin');
  }
}

/**
 * Main middleware function.
 *
 * Handles:
 * 1. CORS preflight (OPTIONS) requests with origin validation
 * 2. CORS headers on all API responses
 * 3. Public route bypass - no auth needed
 * 4. API key authentication for protected routes
 * 5. Rate limit headers on successful responses
 * 6. Security headers on all responses
 *
 * @param request - Incoming Next.js request
 * @returns NextResponse or undefined (passthrough)
 */
export function middleware(request: NextRequest): NextResponse | undefined {
  const { pathname } = request.nextUrl;
  const requestOrigin = request.headers.get('origin');

  // Always allow OPTIONS (CORS preflight) requests through
  if (request.method === 'OPTIONS') {
    const validOrigin = getValidCorsOrigin(requestOrigin);

    if (!validOrigin) {
      // Origin not allowed - reject preflight
      return new NextResponse(null, { status: 403 });
    }

    const preflightResponse = new NextResponse(null, { status: 204 });
    addCorsHeaders(preflightResponse, validOrigin);
    return preflightResponse;
  }

  // Skip non-API routes entirely (pages, static assets, etc.)
  if (!pathname.startsWith('/api/')) {
    return undefined;
  }

  // Validate CORS origin for cross-origin API requests
  const validOrigin = getValidCorsOrigin(requestOrigin);
  if (requestOrigin && !validOrigin) {
    // Cross-origin request from disallowed origin
    return new NextResponse(
      JSON.stringify({ error: 'CORS origin not allowed' }),
      {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  // Skip public routes (no auth needed, but still add CORS/security headers)
  if (isPublicRoute(pathname)) {
    const response = NextResponse.next();
    if (validOrigin) {
      addCorsHeaders(response, validOrigin);
    }
    return response;
  }

  // Authenticate the request
  const authError = authenticateRequest(request);
  if (authError) {
    // Add CORS headers to error responses too (so browser can read the error)
    if (validOrigin) {
      addCorsHeaders(authError, validOrigin);
    }
    return authError;
  }

  // Authentication passed - build response with all headers
  const response = NextResponse.next();

  // Add CORS headers
  if (validOrigin) {
    addCorsHeaders(response, validOrigin);
  }

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
