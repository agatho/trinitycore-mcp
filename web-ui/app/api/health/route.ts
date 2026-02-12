/**
 * API Route: GET /api/health
 *
 * Public health check endpoint for monitoring and load balancers.
 * This endpoint does NOT require authentication.
 *
 * Returns server status, uptime, version, and optional component health.
 *
 * @module api/health
 */

import { NextRequest, NextResponse } from 'next/server';

/**
 * Server start time for uptime calculation.
 */
const SERVER_START_TIME = Date.now();

/**
 * Health check response interface.
 */
interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  uptimeHuman: string;
  version: string;
  environment: string;
  components: {
    api: ComponentHealth;
    auth: ComponentHealth;
  };
}

interface ComponentHealth {
  status: 'up' | 'down' | 'unknown';
  message?: string;
}

/**
 * Format uptime in human-readable form.
 *
 * @param ms - Uptime in milliseconds
 * @returns Human-readable string like "2d 3h 15m 42s"
 */
function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours % 24 > 0) parts.push(`${hours % 24}h`);
  if (minutes % 60 > 0) parts.push(`${minutes % 60}m`);
  parts.push(`${seconds % 60}s`);

  return parts.join(' ');
}

/**
 * GET /api/health
 *
 * Returns health status of the Web UI API server.
 * This is a public endpoint - no authentication required.
 */
export async function GET(_request: NextRequest): Promise<NextResponse> {
  const now = Date.now();
  const uptimeMs = now - SERVER_START_TIME;

  // Check auth module status
  let authStatus: ComponentHealth;
  try {
    // Dynamic import to avoid circular dependencies with middleware
    const { isAuthEnabled } = await import('@/lib/auth');
    const enabled = isAuthEnabled();
    authStatus = {
      status: 'up',
      message: enabled ? 'Authentication enabled' : 'Authentication disabled (no API_SECRET_KEY)',
    };
  } catch {
    authStatus = {
      status: 'down',
      message: 'Auth module failed to load',
    };
  }

  const health: HealthResponse = {
    status: authStatus.status === 'down' ? 'degraded' : 'healthy',
    timestamp: new Date(now).toISOString(),
    uptime: Math.floor(uptimeMs / 1000),
    uptimeHuman: formatUptime(uptimeMs),
    version: process.env.NEXT_PUBLIC_APP_VERSION || '0.0.0',
    environment: process.env.NODE_ENV || 'development',
    components: {
      api: {
        status: 'up',
        message: 'API server responding',
      },
      auth: authStatus,
    },
  };

  const statusCode = health.status === 'healthy' ? 200 : 503;

  return NextResponse.json(health, {
    status: statusCode,
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    },
  });
}
