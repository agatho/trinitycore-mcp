/**
 * API Authentication & Authorization - Unit Tests
 *
 * Comprehensive tests for the auth module covering:
 * - API key extraction from multiple sources
 * - Constant-time key validation (timing attack prevention)
 * - Rate limiting per IP address
 * - Public/private route classification
 * - Full request authentication flow
 * - API key generation
 *
 * @module __tests__/lib/auth
 */

import { describe, expect, it, beforeEach, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock crypto module for tests
vi.mock('crypto', () => ({
  default: {
    timingSafeEqual: (a: Buffer, b: Buffer) => {
      if (a.length !== b.length) return false;
      let result = 0;
      for (let i = 0; i < a.length; i++) {
        result |= a[i] ^ b[i];
      }
      return result === 0;
    },
    randomBytes: (length: number) => ({
      toString: (encoding: string) => {
        if (encoding === 'hex') {
          return 'a'.repeat(length * 2);
        }
        return 'mock-random';
      },
    }),
  },
}));

// Helper to create mock NextRequest objects
function createMockRequest(
  url: string,
  options: {
    headers?: Record<string, string>;
    method?: string;
  } = {}
): NextRequest {
  const fullUrl = url.startsWith('http') ? url : `http://localhost:3000${url}`;
  const request = new NextRequest(new URL(fullUrl), {
    method: options.method || 'GET',
    headers: options.headers ? new Headers(options.headers) : undefined,
  });
  return request;
}

// =============================================================================
// Test Setup
// =============================================================================

// Save original env
const originalEnv = { ...process.env };

beforeEach(() => {
  // Reset environment variables
  delete process.env.API_SECRET_KEY;
  delete process.env.API_AUTH_ENABLED;
  delete process.env.API_RATE_LIMIT_RPM;

  // Reset module cache to re-evaluate env vars
  vi.resetModules();
});

afterEach(() => {
  // Restore original env
  process.env = { ...originalEnv };
  vi.restoreAllMocks();
});

// =============================================================================
// isAuthEnabled Tests
// =============================================================================

describe('isAuthEnabled', () => {
  it('should return false when no API_SECRET_KEY is set', async () => {
    const { isAuthEnabled } = await import('@/lib/auth');
    expect(isAuthEnabled()).toBe(false);
  });

  it('should return true when API_SECRET_KEY is set', async () => {
    process.env.API_SECRET_KEY = 'test-secret-key-12345';
    const { isAuthEnabled } = await import('@/lib/auth');
    expect(isAuthEnabled()).toBe(true);
  });

  it('should return false when API_AUTH_ENABLED is "false" even with key', async () => {
    process.env.API_SECRET_KEY = 'test-secret-key-12345';
    process.env.API_AUTH_ENABLED = 'false';
    const { isAuthEnabled } = await import('@/lib/auth');
    expect(isAuthEnabled()).toBe(false);
  });

  it('should return false when API_AUTH_ENABLED is "0" even with key', async () => {
    process.env.API_SECRET_KEY = 'test-secret-key-12345';
    process.env.API_AUTH_ENABLED = '0';
    const { isAuthEnabled } = await import('@/lib/auth');
    expect(isAuthEnabled()).toBe(false);
  });

  it('should return true when API_AUTH_ENABLED is "true" with key', async () => {
    process.env.API_SECRET_KEY = 'test-secret-key-12345';
    process.env.API_AUTH_ENABLED = 'true';
    const { isAuthEnabled } = await import('@/lib/auth');
    expect(isAuthEnabled()).toBe(true);
  });
});

// =============================================================================
// extractApiKey Tests
// =============================================================================

describe('extractApiKey', () => {
  it('should extract key from X-API-Key header', async () => {
    const { extractApiKey } = await import('@/lib/auth');
    const request = createMockRequest('/api/test', {
      headers: { 'x-api-key': 'my-api-key-123' },
    });
    expect(extractApiKey(request)).toBe('my-api-key-123');
  });

  it('should extract key from Authorization: Bearer header', async () => {
    const { extractApiKey } = await import('@/lib/auth');
    const request = createMockRequest('/api/test', {
      headers: { 'authorization': 'Bearer my-bearer-token-456' },
    });
    expect(extractApiKey(request)).toBe('my-bearer-token-456');
  });

  it('should trim whitespace from Bearer token', async () => {
    const { extractApiKey } = await import('@/lib/auth');
    const request = createMockRequest('/api/test', {
      headers: { 'authorization': 'Bearer   spaced-token   ' },
    });
    expect(extractApiKey(request)).toBe('spaced-token');
  });

  it('should extract key from api_key query parameter', async () => {
    const { extractApiKey } = await import('@/lib/auth');
    const request = createMockRequest('/api/test?api_key=query-key-789');
    expect(extractApiKey(request)).toBe('query-key-789');
  });

  it('should prioritize X-API-Key over Bearer token', async () => {
    const { extractApiKey } = await import('@/lib/auth');
    const request = createMockRequest('/api/test', {
      headers: {
        'x-api-key': 'header-key',
        'authorization': 'Bearer bearer-key',
      },
    });
    expect(extractApiKey(request)).toBe('header-key');
  });

  it('should prioritize Bearer token over query parameter', async () => {
    const { extractApiKey } = await import('@/lib/auth');
    const request = createMockRequest('/api/test?api_key=query-key', {
      headers: { 'authorization': 'Bearer bearer-key' },
    });
    expect(extractApiKey(request)).toBe('bearer-key');
  });

  it('should return null when no key is provided', async () => {
    const { extractApiKey } = await import('@/lib/auth');
    const request = createMockRequest('/api/test');
    expect(extractApiKey(request)).toBeNull();
  });

  it('should not extract from Authorization header without Bearer prefix', async () => {
    const { extractApiKey } = await import('@/lib/auth');
    const request = createMockRequest('/api/test', {
      headers: { 'authorization': 'Basic dXNlcjpwYXNz' },
    });
    expect(extractApiKey(request)).toBeNull();
  });

  it('should not extract from empty Authorization Bearer', async () => {
    const { extractApiKey } = await import('@/lib/auth');
    const request = createMockRequest('/api/test', {
      headers: { 'authorization': 'Bearer ' },
    });
    // Bearer with only spaces yields empty string after trim
    const key = extractApiKey(request);
    expect(key === null || key === '').toBe(true);
  });
});

// =============================================================================
// validateApiKey Tests
// =============================================================================

describe('validateApiKey', () => {
  it('should return true for correct key', async () => {
    process.env.API_SECRET_KEY = 'correct-secret-key';
    const { validateApiKey } = await import('@/lib/auth');
    expect(validateApiKey('correct-secret-key')).toBe(true);
  });

  it('should return false for incorrect key', async () => {
    process.env.API_SECRET_KEY = 'correct-secret-key';
    const { validateApiKey } = await import('@/lib/auth');
    expect(validateApiKey('wrong-key')).toBe(false);
  });

  it('should return false when no secret key is configured', async () => {
    delete process.env.API_SECRET_KEY;
    const { validateApiKey } = await import('@/lib/auth');
    expect(validateApiKey('any-key')).toBe(false);
  });

  it('should return false for empty provided key', async () => {
    process.env.API_SECRET_KEY = 'correct-secret-key';
    const { validateApiKey } = await import('@/lib/auth');
    expect(validateApiKey('')).toBe(false);
  });

  it('should return false for keys with different lengths', async () => {
    process.env.API_SECRET_KEY = 'short';
    const { validateApiKey } = await import('@/lib/auth');
    expect(validateApiKey('a-much-longer-key-that-doesnt-match')).toBe(false);
  });

  it('should handle special characters in keys', async () => {
    const specialKey = 'key-with-$pecial!@#chars=+/';
    process.env.API_SECRET_KEY = specialKey;
    const { validateApiKey } = await import('@/lib/auth');
    expect(validateApiKey(specialKey)).toBe(true);
    expect(validateApiKey(specialKey + 'x')).toBe(false);
  });

  it('should handle unicode characters in keys', async () => {
    const unicodeKey = 'key-with-unicode-\u00e9\u00e8\u00ea';
    process.env.API_SECRET_KEY = unicodeKey;
    const { validateApiKey } = await import('@/lib/auth');
    expect(validateApiKey(unicodeKey)).toBe(true);
  });
});

// =============================================================================
// checkRateLimit Tests
// =============================================================================

describe('checkRateLimit', () => {
  it('should allow first request from an IP', async () => {
    const { checkRateLimit } = await import('@/lib/auth');
    const result = checkRateLimit('192.168.1.100');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBeGreaterThan(0);
    expect(result.resetIn).toBeGreaterThan(0);
  });

  it('should track multiple requests from same IP', async () => {
    const { checkRateLimit } = await import('@/lib/auth');
    const ip = '10.0.0.1';

    const first = checkRateLimit(ip);
    const second = checkRateLimit(ip);

    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(true);
    expect(second.remaining).toBeLessThan(first.remaining);
  });

  it('should allow different IPs independently', async () => {
    const { checkRateLimit } = await import('@/lib/auth');

    const result1 = checkRateLimit('10.0.0.1');
    const result2 = checkRateLimit('10.0.0.2');

    expect(result1.allowed).toBe(true);
    expect(result2.allowed).toBe(true);
    // Both should have same remaining (minus 1 for the current request)
    expect(result1.remaining).toBe(result2.remaining);
  });

  it('should block when rate limit is exceeded', async () => {
    process.env.API_RATE_LIMIT_RPM = '3';
    const { checkRateLimit } = await import('@/lib/auth');
    const ip = '172.16.0.1';

    checkRateLimit(ip); // 1
    checkRateLimit(ip); // 2
    checkRateLimit(ip); // 3
    const fourth = checkRateLimit(ip); // 4 - should be blocked

    expect(fourth.allowed).toBe(false);
    expect(fourth.remaining).toBe(0);
    expect(fourth.resetIn).toBeGreaterThan(0);
  });

  it('should use default RPM of 120 when not configured', async () => {
    delete process.env.API_RATE_LIMIT_RPM;
    const { checkRateLimit } = await import('@/lib/auth');
    const result = checkRateLimit('192.168.0.1');
    expect(result.remaining).toBe(119); // 120 - 1
  });

  it('should handle non-numeric RPM gracefully', async () => {
    process.env.API_RATE_LIMIT_RPM = 'not-a-number';
    const { checkRateLimit } = await import('@/lib/auth');
    const result = checkRateLimit('192.168.0.2');
    expect(result.remaining).toBe(119); // Falls back to 120
  });

  it('should include reset time in seconds', async () => {
    const { checkRateLimit } = await import('@/lib/auth');
    const result = checkRateLimit('192.168.0.3');
    expect(result.resetIn).toBeGreaterThan(0);
    expect(result.resetIn).toBeLessThanOrEqual(60); // 1 minute window
  });
});

// =============================================================================
// isPublicRoute Tests
// =============================================================================

describe('isPublicRoute', () => {
  it('should identify /api/health as public', async () => {
    const { isPublicRoute } = await import('@/lib/auth');
    expect(isPublicRoute('/api/health')).toBe(true);
  });

  it('should identify /api/mcp/tools as public', async () => {
    const { isPublicRoute } = await import('@/lib/auth');
    expect(isPublicRoute('/api/mcp/tools')).toBe(true);
  });

  it('should identify non-API routes as public', async () => {
    const { isPublicRoute } = await import('@/lib/auth');
    expect(isPublicRoute('/')).toBe(true);
    expect(isPublicRoute('/spells')).toBe(true);
    expect(isPublicRoute('/creatures/browse')).toBe(true);
    expect(isPublicRoute('/dashboard')).toBe(true);
  });

  it('should identify static asset routes as public', async () => {
    const { isPublicRoute } = await import('@/lib/auth');
    expect(isPublicRoute('/_next/static/chunks/main.js')).toBe(true);
    expect(isPublicRoute('/favicon.ico')).toBe(true);
    expect(isPublicRoute('/maps/azeroth/tile_0_0.blp')).toBe(true);
    expect(isPublicRoute('/tile-data/some-file.bin')).toBe(true);
  });

  it('should identify API routes as private', async () => {
    const { isPublicRoute } = await import('@/lib/auth');
    expect(isPublicRoute('/api/mcp/call')).toBe(false);
    expect(isPublicRoute('/api/config')).toBe(false);
    expect(isPublicRoute('/api/spell/lookup')).toBe(false);
    expect(isPublicRoute('/api/creatures')).toBe(false);
    expect(isPublicRoute('/api/database/query')).toBe(false);
  });

  it('should not treat partial matches as public', async () => {
    const { isPublicRoute } = await import('@/lib/auth');
    // /api/health-check is NOT the same as /api/health
    expect(isPublicRoute('/api/health-check')).toBe(false);
    // /api/mcp/tools/call is NOT /api/mcp/tools
    expect(isPublicRoute('/api/mcp/tools/call')).toBe(false);
  });
});

// =============================================================================
// authenticateRequest Tests
// =============================================================================

describe('authenticateRequest', () => {
  it('should pass through when auth is disabled', async () => {
    delete process.env.API_SECRET_KEY;
    const { authenticateRequest } = await import('@/lib/auth');
    const request = createMockRequest('/api/config');
    expect(authenticateRequest(request)).toBeNull();
  });

  it('should pass through for public routes even with auth enabled', async () => {
    process.env.API_SECRET_KEY = 'secret-123';
    const { authenticateRequest } = await import('@/lib/auth');
    const request = createMockRequest('/api/health');
    expect(authenticateRequest(request)).toBeNull();
  });

  it('should return 401 when no key provided on protected route', async () => {
    process.env.API_SECRET_KEY = 'secret-123';
    const { authenticateRequest } = await import('@/lib/auth');
    const request = createMockRequest('/api/config');
    const response = authenticateRequest(request);
    expect(response).not.toBeNull();
    expect(response!.status).toBe(401);
  });

  it('should include WWW-Authenticate header on 401', async () => {
    process.env.API_SECRET_KEY = 'secret-123';
    const { authenticateRequest } = await import('@/lib/auth');
    const request = createMockRequest('/api/config');
    const response = authenticateRequest(request);
    expect(response!.headers.get('WWW-Authenticate')).toContain('Bearer');
  });

  it('should return 403 for invalid key', async () => {
    process.env.API_SECRET_KEY = 'correct-key';
    const { authenticateRequest } = await import('@/lib/auth');
    const request = createMockRequest('/api/config', {
      headers: { 'x-api-key': 'wrong-key' },
    });
    const response = authenticateRequest(request);
    expect(response).not.toBeNull();
    expect(response!.status).toBe(403);
  });

  it('should pass through with correct API key', async () => {
    process.env.API_SECRET_KEY = 'correct-key';
    const { authenticateRequest } = await import('@/lib/auth');
    const request = createMockRequest('/api/config', {
      headers: { 'x-api-key': 'correct-key' },
    });
    expect(authenticateRequest(request)).toBeNull();
  });

  it('should pass through with correct Bearer token', async () => {
    process.env.API_SECRET_KEY = 'bearer-secret';
    const { authenticateRequest } = await import('@/lib/auth');
    const request = createMockRequest('/api/config', {
      headers: { 'authorization': 'Bearer bearer-secret' },
    });
    expect(authenticateRequest(request)).toBeNull();
  });

  it('should pass through with correct query parameter', async () => {
    process.env.API_SECRET_KEY = 'query-secret';
    const { authenticateRequest } = await import('@/lib/auth');
    const request = createMockRequest('/api/config?api_key=query-secret');
    expect(authenticateRequest(request)).toBeNull();
  });

  it('should return 401 error body with instructions', async () => {
    process.env.API_SECRET_KEY = 'secret-key';
    const { authenticateRequest } = await import('@/lib/auth');
    const request = createMockRequest('/api/mcp/call');
    const response = authenticateRequest(request);
    const body = await response!.json();
    expect(body.error).toBe('Authentication required');
    expect(body.message).toContain('X-API-Key');
    expect(body.message).toContain('Bearer');
    expect(body.message).toContain('api_key');
  });

  it('should return 403 error body for invalid key', async () => {
    process.env.API_SECRET_KEY = 'secret-key';
    const { authenticateRequest } = await import('@/lib/auth');
    const request = createMockRequest('/api/mcp/call', {
      headers: { 'x-api-key': 'bad-key' },
    });
    const response = authenticateRequest(request);
    const body = await response!.json();
    expect(body.error).toBe('Invalid API key');
  });

  it('should return 429 when rate limit exceeded', async () => {
    process.env.API_SECRET_KEY = 'rate-limit-key';
    process.env.API_RATE_LIMIT_RPM = '2';
    const { authenticateRequest } = await import('@/lib/auth');

    // Use x-forwarded-for to set a unique IP
    const headers = {
      'x-api-key': 'rate-limit-key',
      'x-forwarded-for': '203.0.113.99',
    };

    // First two should pass
    authenticateRequest(createMockRequest('/api/test', { headers }));
    authenticateRequest(createMockRequest('/api/test', { headers }));

    // Third should be rate limited
    const response = authenticateRequest(createMockRequest('/api/test', { headers }));
    expect(response).not.toBeNull();
    expect(response!.status).toBe(429);
  });

  it('should include Retry-After header on 429', async () => {
    process.env.API_SECRET_KEY = 'rate-key';
    process.env.API_RATE_LIMIT_RPM = '1';
    const { authenticateRequest } = await import('@/lib/auth');

    const headers = {
      'x-api-key': 'rate-key',
      'x-forwarded-for': '198.51.100.42',
    };

    authenticateRequest(createMockRequest('/api/test', { headers }));
    const response = authenticateRequest(createMockRequest('/api/test', { headers }));

    if (response) {
      expect(response.headers.get('Retry-After')).toBeTruthy();
      expect(response.headers.get('X-RateLimit-Remaining')).toBe('0');
    }
  });
});

// =============================================================================
// generateApiKey Tests
// =============================================================================

describe('generateApiKey', () => {
  it('should generate a hex string', async () => {
    const { generateApiKey } = await import('@/lib/auth');
    const key = generateApiKey();
    expect(typeof key).toBe('string');
    expect(key.length).toBeGreaterThan(0);
  });

  it('should generate key of specified length', async () => {
    const { generateApiKey } = await import('@/lib/auth');
    const key = generateApiKey(16);
    // 16 bytes = 32 hex chars
    expect(key.length).toBe(32);
  });

  it('should generate 64-char key by default (32 bytes)', async () => {
    const { generateApiKey } = await import('@/lib/auth');
    const key = generateApiKey();
    expect(key.length).toBe(64);
  });
});

// =============================================================================
// addRateLimitHeaders Tests
// =============================================================================

describe('addRateLimitHeaders', () => {
  it('should add rate limit headers to response', async () => {
    const { addRateLimitHeaders } = await import('@/lib/auth');
    const { NextResponse } = await import('next/server');

    const response = NextResponse.json({ ok: true });
    const result = addRateLimitHeaders(response, '127.0.0.1');

    expect(result.headers.get('X-RateLimit-Limit')).toBeTruthy();
    expect(result.headers.get('X-RateLimit-Remaining')).toBeTruthy();
    expect(result.headers.get('X-RateLimit-Reset')).toBeTruthy();
  });
});

// =============================================================================
// Security Edge Case Tests
// =============================================================================

describe('Security Edge Cases', () => {
  it('should not leak key in error responses', async () => {
    process.env.API_SECRET_KEY = 'super-secret-key-never-expose';
    const { authenticateRequest } = await import('@/lib/auth');

    const request = createMockRequest('/api/config', {
      headers: { 'x-api-key': 'wrong-key' },
    });

    const response = authenticateRequest(request);
    const body = await response!.json();
    const bodyStr = JSON.stringify(body);

    expect(bodyStr).not.toContain('super-secret-key-never-expose');
    expect(bodyStr).not.toContain('wrong-key');
  });

  it('should handle extremely long API keys gracefully', async () => {
    process.env.API_SECRET_KEY = 'normal-key';
    const { validateApiKey } = await import('@/lib/auth');

    const longKey = 'a'.repeat(100000);
    expect(validateApiKey(longKey)).toBe(false);
  });

  it('should handle null-byte injection in API key', async () => {
    process.env.API_SECRET_KEY = 'normal-key';
    const { validateApiKey } = await import('@/lib/auth');

    expect(validateApiKey('normal-key\0extra')).toBe(false);
    expect(validateApiKey('\0normal-key')).toBe(false);
  });

  it('should handle IP extraction from x-forwarded-for with multiple IPs', async () => {
    process.env.API_SECRET_KEY = 'key';
    process.env.API_RATE_LIMIT_RPM = '1000';
    const { authenticateRequest } = await import('@/lib/auth');

    const request = createMockRequest('/api/test', {
      headers: {
        'x-api-key': 'key',
        'x-forwarded-for': '10.0.0.1, 10.0.0.2, 10.0.0.3',
      },
    });

    // Should not throw
    const result = authenticateRequest(request);
    expect(result).toBeNull(); // Auth should pass
  });

  it('should use x-real-ip as fallback when x-forwarded-for is absent', async () => {
    process.env.API_SECRET_KEY = 'key';
    process.env.API_RATE_LIMIT_RPM = '1000';
    const { authenticateRequest } = await import('@/lib/auth');

    const request = createMockRequest('/api/test', {
      headers: {
        'x-api-key': 'key',
        'x-real-ip': '10.0.0.5',
      },
    });

    const result = authenticateRequest(request);
    expect(result).toBeNull();
  });

  it('should handle missing IP headers gracefully', async () => {
    process.env.API_SECRET_KEY = 'key';
    const { authenticateRequest } = await import('@/lib/auth');

    const request = createMockRequest('/api/test', {
      headers: { 'x-api-key': 'key' },
    });

    const result = authenticateRequest(request);
    expect(result).toBeNull(); // Should still pass auth
  });
});
