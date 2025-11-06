/**
 * Custom Next.js Server with WebSocket Support
 *
 * Enables real-time collaboration for SAI Editor using WebSockets.
 *
 * To use:
 * 1. Install dependencies: npm install ws
 * 2. Run: node server.js
 *
 * Production:
 * - Use pm2 or similar process manager
 * - Set NODE_ENV=production
 * - Enable clustering for multiple cores
 */

const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const WebSocket = require('ws');

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOSTNAME || 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// ============================================================================
// ROOM MANAGEMENT
// ============================================================================

class CollaborationServer {
  constructor() {
    this.rooms = new Map(); // scriptId -> Set of { ws, userId, userName, userColor }
    this.userToRoom = new Map(); // ws -> scriptId
  }

  /**
   * Add client to room
   */
  addClient(scriptId, ws, userId, userName, userColor) {
    if (!this.rooms.has(scriptId)) {
      this.rooms.set(scriptId, new Set());
    }

    const client = { ws, userId, userName, userColor };
    this.rooms.get(scriptId).add(client);
    this.userToRoom.set(ws, scriptId);

    console.log(`[Collaboration] User ${userName} (${userId}) joined room ${scriptId}`);
    console.log(`[Collaboration] Room ${scriptId} now has ${this.rooms.get(scriptId).size} clients`);

    return client;
  }

  /**
   * Remove client from room
   */
  removeClient(ws) {
    const scriptId = this.userToRoom.get(ws);
    if (!scriptId) return null;

    const room = this.rooms.get(scriptId);
    if (room) {
      // Find and remove client
      let removedClient = null;
      for (const client of room) {
        if (client.ws === ws) {
          removedClient = client;
          room.delete(client);
          break;
        }
      }

      // Clean up empty room
      if (room.size === 0) {
        this.rooms.delete(scriptId);
        console.log(`[Collaboration] Room ${scriptId} is now empty and deleted`);
      } else {
        console.log(`[Collaboration] Room ${scriptId} now has ${room.size} clients`);
      }

      this.userToRoom.delete(ws);
      return removedClient;
    }

    return null;
  }

  /**
   * Broadcast message to all clients in a room except sender
   */
  broadcast(scriptId, senderWs, message) {
    const room = this.rooms.get(scriptId);
    if (!room) return;

    let sentCount = 0;
    room.forEach((client) => {
      if (client.ws !== senderWs && client.ws.readyState === WebSocket.OPEN) {
        try {
          client.ws.send(JSON.stringify(message));
          sentCount++;
        } catch (error) {
          console.error('[Collaboration] Error sending message:', error);
        }
      }
    });

    if (sentCount > 0) {
      console.log(`[Collaboration] Broadcasted ${message.type} to ${sentCount} clients in room ${scriptId}`);
    }
  }

  /**
   * Get all clients in a room
   */
  getClients(scriptId) {
    const room = this.rooms.get(scriptId);
    if (!room) return [];

    return Array.from(room).map((client) => ({
      userId: client.userId,
      userName: client.userName,
      userColor: client.userColor,
    }));
  }

  /**
   * Get room statistics
   */
  getStats() {
    return {
      totalRooms: this.rooms.size,
      totalClients: this.userToRoom.size,
      rooms: Array.from(this.rooms.entries()).map(([scriptId, clients]) => ({
        scriptId,
        clientCount: clients.size,
      })),
    };
  }
}

// ============================================================================
// START SERVER
// ============================================================================

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  // Create WebSocket server
  const wss = new WebSocket.Server({
    server,
    path: '/api/sai/collaborate',
  });

  const collabServer = new CollaborationServer();

  console.log('[Collaboration] WebSocket server initialized');

  // Handle WebSocket connections
  wss.on('connection', (ws, req) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const scriptId = url.searchParams.get('scriptId');

    if (!scriptId) {
      console.error('[Collaboration] Connection rejected: missing scriptId');
      ws.close(1008, 'scriptId parameter required');
      return;
    }

    let currentClient = null;

    // Handle messages
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());

        // Handle different message types
        switch (message.type) {
          case 'join':
            // Add client to room
            currentClient = collabServer.addClient(
              scriptId,
              ws,
              message.userId,
              message.data?.userName || 'Anonymous',
              message.data?.userColor || '#3B82F6'
            );

            // Send existing clients to new user
            const existingClients = collabServer.getClients(scriptId).filter(
              (c) => c.userId !== message.userId
            );

            if (existingClients.length > 0) {
              ws.send(
                JSON.stringify({
                  type: 'existing-users',
                  userId: 'server',
                  timestamp: Date.now(),
                  data: { users: existingClients },
                })
              );
            }

            // Broadcast join to other clients
            collabServer.broadcast(scriptId, ws, message);
            break;

          case 'leave':
            // Broadcast leave and remove client
            collabServer.broadcast(scriptId, ws, message);
            collabServer.removeClient(ws);
            currentClient = null;
            break;

          case 'update':
          case 'cursor':
          case 'selection':
          case 'lock':
          case 'unlock':
            // Broadcast to other clients
            collabServer.broadcast(scriptId, ws, message);
            break;

          case 'heartbeat':
            // Send heartbeat back
            ws.send(
              JSON.stringify({
                type: 'heartbeat',
                userId: 'server',
                timestamp: Date.now(),
              })
            );
            break;

          default:
            console.warn('[Collaboration] Unknown message type:', message.type);
        }
      } catch (error) {
        console.error('[Collaboration] Error handling message:', error);
      }
    });

    // Handle disconnect
    ws.on('close', (code, reason) => {
      console.log(`[Collaboration] Connection closed: ${code} ${reason}`);

      const removedClient = collabServer.removeClient(ws);

      if (removedClient) {
        // Broadcast leave message
        collabServer.broadcast(scriptId, ws, {
          type: 'leave',
          userId: removedClient.userId,
          timestamp: Date.now(),
        });
      }
    });

    // Handle errors
    ws.on('error', (error) => {
      console.error('[Collaboration] WebSocket error:', error);
    });

    console.log(`[Collaboration] New connection for script ${scriptId}`);
  });

  // Periodic stats logging
  setInterval(() => {
    const stats = collabServer.getStats();
    if (stats.totalClients > 0) {
      console.log('[Collaboration] Stats:', stats);
    }
  }, 60000); // Every minute

  // Start HTTP server
  server.listen(port, (err) => {
    if (err) throw err;
    console.log(`> Ready on http://${hostname}:${port}`);
    console.log(`> WebSocket endpoint: ws://${hostname}:${port}/api/sai/collaborate`);
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('[Collaboration] SIGTERM received, closing server...');
    wss.close(() => {
      server.close(() => {
        console.log('[Collaboration] Server closed');
        process.exit(0);
      });
    });
  });
});
