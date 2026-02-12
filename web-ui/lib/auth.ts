/**
 * API Authentication & Authorization Library
 *
 * Provides API key-based authentication for the TrinityCore Web UI API.
 * All API routes are protected by default unless explicitly excluded.
 *
 * Authentication methods (in priority order):
 * 1. X-API-Key header
 * 2. Authorization: Bearer <key> header
 * 3. ?api_key=<key> query parameter (for browser-accessible endpoints)
 *
 * Configuration via environment variables:
 * - API_SECRET_KEY: Primary API key (required for API protection)
 * - API_AUTH_ENABLED: Enable/disable auth (default: true)
 * - API_RATE_LIMIT_RPM: Requests per minute limit (default: 120)
 *
 * @module lib/auth
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

// =============================================================================
// Configuration
// =============================================================================

/**
 * Whether authentication is enabled.
 * Disable for development by setting API_AUTH_ENABLED=false in .env.local
 */
export function isAuthEnabled(): boolean {
  const enabled = process.env.API_AUTH_ENABLED;
  // Default to enabled if API_SECRET_KEY is set
  if (enabled === 'false' || enabled === '0') return false;
  return !!process.env.API_SECRET_KEY;
}

/**
 * Get the configured API secret key.
 */
function getApiSecretKey(): string | null {
  return process.env.API_SECRET_KEY || null;
}

/**
 * Maximum requests per minute per IP.
 */
function getRateLimitRPM(): number {
  const rpm = parseInt(process.env.API_RATE_LIMIT_RPM || '120');
  return isNaN(rpm) ? 120 : rpm;
}

// =============================================================================
// Rate Limiting (in-memory, per-IP)
// =============================================================================

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

/**
 * In-memory rate limit store.
 * Keys are IP addresses, values are request counts within the current window.
 * This is suitable for single-instance deployments (which is the case for this tool).
 */
const rateLimitStore = new Map<string, RateLimitEntry>();

/**
 * Clean up expired rate limit entries (runs periodically).
 */
function cleanupRateLimitStore(): void {
  const now = Date.now();
  const windowMs = 60_000; // 1 minute
  for (const [ip, entry] of rateLimitStore) {
    if (now - entry.windowStart > windowMs) {
      rateLimitStore.delete(ip);
    }
  }
}

// Clean up every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(cleanupRateLimitStore, 5 * 60_000).unref?.();
}

/**
 * Check rate limit for a given IP address.
 *
 * @param ip - Client IP address
 * @returns Object with allowed status and remaining requests
 */
export function checkRateLimit(ip: string): {
  allowed: boolean;
  remaining: number;
  resetIn: number;
} {
  const maxRPM = getRateLimitRPM();
  const windowMs = 60_000; // 1 minute
  const now = Date.now();

  let entry = rateLimitStore.get(ip);

  if (!entry || now - entry.windowStart > windowMs) {
    // Start new window
    entry = { count: 1, windowStart: now };
    rateLimitStore.set(ip, entry);
    return {
      allowed: true,
      remaining: maxRPM - 1,
      resetIn: Math.ceil(windowMs / 1000),
    };
  }

  entry.count++;

  const resetIn = Math.ceil((entry.windowStart + windowMs - now) / 1000);
  const remaining = Math.max(0, maxRPM - entry.count);

  if (entry.count > maxRPM) {
    return {
      allowed: false,
      remaining: 0,
      resetIn,
    };
  }

  return {
    allowed: true,
    remaining,
    resetIn,
  };
}

// =============================================================================
// API Key Validation
// =============================================================================

/**
 * Extract API key from request using multiple strategies.
 *
 * Checks in order:
 * 1. X-API-Key header
 * 2. Authorization: Bearer <key>
 * 3. ?api_key=<key> query parameter
 *
 * @param request - Next.js request object
 * @returns The API key if found, null otherwise
 */
export function extractApiKey(request: NextRequest): string | null {
  // Strategy 1: X-API-Key header
  const xApiKey = request.headers.get('x-api-key');
  if (xApiKey) return xApiKey;

  // Strategy 2: Authorization: Bearer <key>
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }

  // Strategy 3: Query parameter (for browser requests)
  const queryKey = request.nextUrl.searchParams.get('api_key');
  if (queryKey) return queryKey;

  return null;
}

/**
 * Validate an API key using constant-time comparison.
 *
 * @param providedKey - Key from the request
 * @returns True if the key is valid
 */
export function validateApiKey(providedKey: string): boolean {
  const secretKey = getApiSecretKey();
  if (!secretKey) return false;

  // Use constant-time comparison to prevent timing attacks
  try {
    const providedBuffer = Buffer.from(providedKey, 'utf-8');
    const secretBuffer = Buffer.from(secretKey, 'utf-8');

    if (providedBuffer.length !== secretBuffer.length) {
      // Still do a comparison to maintain constant time
      crypto.timingSafeEqual(
        Buffer.alloc(32),
        Buffer.alloc(32)
      );
      return false;
    }

    return crypto.timingSafeEqual(providedBuffer, secretBuffer);
  } catch {
    return false;
  }
}

// =============================================================================
// Route Protection Configuration
// =============================================================================

/**
 * Routes that do NOT require authentication.
 * These are public endpoints accessible without an API key.
 */
const PUBLIC_ROUTES: ReadonlySet<string> = new Set([
  // Health check endpoint
  '/api/health',
  // Public info (no sensitive data)
  '/api/mcp/tools',
]);

/**
 * Route prefixes that are always public (e.g., static assets).
 */
const PUBLIC_PREFIXES: readonly string[] = [
  '/_next/',
  '/favicon',
  '/maps/',
  '/tile-data/',
];

/**
 * Check if a route is public (doesn't require auth).
 */
export function isPublicRoute(pathname: string): boolean {
  // Check exact matches
  if (PUBLIC_ROUTES.has(pathname)) return true;

  // Check prefixes
  for (const prefix of PUBLIC_PREFIXES) {
    if (pathname.startsWith(prefix)) return true;
  }

  // Non-API routes (pages) are public
  if (!pathname.startsWith('/api/')) return true;

  return false;
}

// =============================================================================
// Middleware Authentication Handler
// =============================================================================

/**
 * Authenticate an API request.
 * Returns null if authenticated, or a NextResponse with the error if not.
 *
 * @param request - Next.js request object
 * @returns null if authenticated, error response otherwise
 */
export function authenticateRequest(request: NextRequest): NextResponse | null {
  const pathname = request.nextUrl.pathname;

  // Skip auth for public routes
  if (isPublicRoute(pathname)) return null;

  // Skip auth if disabled
  if (!isAuthEnabled()) return null;

  // Extract and validate API key
  const apiKey = extractApiKey(request);

  if (!apiKey) {
    return NextResponse.json(
      {
        error: 'Authentication required',
        message: 'Provide an API key via X-API-Key header, Authorization: Bearer <key>, or ?api_key=<key> query parameter',
        docs: 'See API_SECRET_KEY in .env.local',
      },
      {
        status: 401,
        headers: {
          'WWW-Authenticate': 'Bearer realm="TrinityCore API"',
        },
      }
    );
  }

  if (!validateApiKey(apiKey)) {
    return NextResponse.json(
      {
        error: 'Invalid API key',
        message: 'The provided API key is not valid',
      },
      { status: 403 }
    );
  }

  // Check rate limit
  const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown';

  const rateLimit = checkRateLimit(clientIp);

  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        error: 'Rate limit exceeded',
        message: `Maximum ${getRateLimitRPM()} requests per minute exceeded. Try again in ${rateLimit.resetIn}s.`,
        retryAfter: rateLimit.resetIn,
      },
      {
        status: 429,
        headers: {
          'Retry-After': String(rateLimit.resetIn),
          'X-RateLimit-Limit': String(getRateLimitRPM()),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(rateLimit.resetIn),
        },
      }
    );
  }

  // Authentication passed - return null (no error)
  return null;
}

/**
 * Add rate limit headers to a response.
 */
export function addRateLimitHeaders(
  response: NextResponse,
  ip: string
): NextResponse {
  const rateLimit = checkRateLimit(ip);
  response.headers.set('X-RateLimit-Limit', String(getRateLimitRPM()));
  response.headers.set('X-RateLimit-Remaining', String(rateLimit.remaining));
  response.headers.set('X-RateLimit-Reset', String(rateLimit.resetIn));
  return response;
}

// =============================================================================
// Utility: Generate API Key
// =============================================================================

/**
 * Generate a cryptographically secure API key.
 * Use this to generate the initial API_SECRET_KEY value.
 *
 * @param length - Key length in bytes (default: 32, produces 64 hex chars)
 * @returns Hex-encoded random key
 */
export function generateApiKey(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}
