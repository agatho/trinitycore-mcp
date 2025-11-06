/**
 * SAI Collaboration WebSocket API Route
 *
 * Note: Next.js doesn't natively support WebSocket in API routes.
 * This is a placeholder for custom server implementation.
 *
 * To enable WebSocket support:
 * 1. Create a custom server.js file
 * 2. Use 'ws' library for WebSocket handling
 * 3. Integrate with Next.js custom server
 *
 * See: https://nextjs.org/docs/pages/building-your-application/configuring/custom-server
 */

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const scriptId = searchParams.get('scriptId');

  // Check if this is a WebSocket upgrade request
  const upgrade = request.headers.get('upgrade');

  if (upgrade?.toLowerCase() === 'websocket') {
    return new NextResponse(
      'WebSocket support requires a custom server. Please see the collaboration documentation for setup instructions.',
      { status: 426 } // Upgrade Required
    );
  }

  return NextResponse.json({
    error: 'WebSocket endpoint',
    message: 'This endpoint requires WebSocket connection',
    scriptId,
    documentation: '/docs/collaboration-setup',
  });
}

/**
 * WebSocket Server Implementation (separate file: server.js)
 *
 * Example custom server implementation:
 *
 * ```javascript
 * const { createServer } = require('http');
 * const { parse } = require('url');
 * const next = require('next');
 * const WebSocket = require('ws');
 *
 * const dev = process.env.NODE_ENV !== 'production';
 * const app = next({ dev });
 * const handle = app.getRequestHandler();
 *
 * app.prepare().then(() => {
 *   const server = createServer((req, res) => {
 *     const parsedUrl = parse(req.url, true);
 *     handle(req, res, parsedUrl);
 *   });
 *
 *   const wss = new WebSocket.Server({ server, path: '/api/sai/collaborate' });
 *
 *   // Room management
 *   const rooms = new Map(); // scriptId -> Set of WebSocket clients
 *
 *   wss.on('connection', (ws, req) => {
 *     const url = new URL(req.url, 'http://localhost');
 *     const scriptId = url.searchParams.get('scriptId');
 *
 *     if (!scriptId) {
 *       ws.close(1008, 'scriptId required');
 *       return;
 *     }
 *
 *     // Add to room
 *     if (!rooms.has(scriptId)) {
 *       rooms.set(scriptId, new Set());
 *     }
 *     rooms.get(scriptId).add(ws);
 *
 *     console.log(`[WebSocket] Client joined room: ${scriptId}`);
 *
 *     // Handle messages
 *     ws.on('message', (data) => {
 *       try {
 *         const message = JSON.parse(data.toString());
 *
 *         // Broadcast to all clients in the same room
 *         const room = rooms.get(scriptId);
 *         if (room) {
 *           room.forEach((client) => {
 *             if (client !== ws && client.readyState === WebSocket.OPEN) {
 *               client.send(JSON.stringify(message));
 *             }
 *           });
 *         }
 *       } catch (error) {
 *         console.error('[WebSocket] Error parsing message:', error);
 *       }
 *     });
 *
 *     // Handle disconnect
 *     ws.on('close', () => {
 *       const room = rooms.get(scriptId);
 *       if (room) {
 *         room.delete(ws);
 *         if (room.size === 0) {
 *           rooms.delete(scriptId);
 *         }
 *       }
 *       console.log(`[WebSocket] Client left room: ${scriptId}`);
 *     });
 *   });
 *
 *   const port = process.env.PORT || 3000;
 *   server.listen(port, () => {
 *     console.log(`> Ready on http://localhost:${port}`);
 *   });
 * });
 * ```
 *
 * Then run with: node server.js
 */
