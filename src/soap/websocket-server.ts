/**
 * WebSocket Server for Real-Time SOAP Event Streaming
 *
 * Provides WebSocket endpoints for streaming TrinityCore SOAP events to clients.
 * Supports authentication, heartbeat, event filtering, and backpressure handling.
 *
 * @module websocket-server
 */

import { WebSocket, WebSocketServer } from "ws";
import { EventEmitter } from "events";
import type { Server as HTTPServer } from "http";

// ============================================================================
// Types
// ============================================================================

/**
 * WebSocket client connection
 */
export interface WSClient {
  id: string;
  ws: WebSocket;
  authenticated: boolean;
  subscriptions: Set<string>;
  filters: EventFilter[];
  rateLimit: {
    maxEventsPerSecond: number;
    currentCount: number;
    resetTime: number;
  };
  lastHeartbeat: number;
}

/**
 * Event filter
 */
export interface EventFilter {
  type?: string;
  player?: string;
  creature?: string;
  location?: {
    mapId: number;
    radius: number;
    x: number;
    y: number;
    z: number;
  };
  regex?: RegExp;
}

/**
 * WebSocket message
 */
export interface WSMessage {
  type: "auth" | "subscribe" | "unsubscribe" | "filter" | "heartbeat" | "event";
  data?: unknown;
  timestamp: number;
}

/**
 * SOAP event
 */
export interface SOAPEvent {
  type: string;
  timestamp: number;
  data: Record<string, unknown>;
  serverId?: string;
}

// ============================================================================
// WebSocket Server
// ============================================================================

export class SOAPWebSocketServer extends EventEmitter {
  private wss: WebSocketServer;
  private clients: Map<string, WSClient>;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(
    private server: HTTPServer,
    private options: {
      path?: string;
      heartbeatInterval?: number;
      clientTimeout?: number;
      maxEventsPerSecond?: number;
      authRequired?: boolean;
      authToken?: string;
    } = {},
  ) {
    super();

    // Set defaults
    this.options = {
      path: "/ws/soap-events",
      heartbeatInterval: 30000, // 30 seconds
      clientTimeout: 60000, // 60 seconds
      maxEventsPerSecond: 100,
      authRequired: true,
      ...options,
    };

    this.clients = new Map();

    // Initialize WebSocket server
    this.wss = new WebSocketServer({
      server: this.server,
      path: this.options.path,
    });

    this.setupWebSocketServer();
    this.startHeartbeat();
    this.startCleanup();
  }

  /**
   * Setup WebSocket server event handlers
   */
  private setupWebSocketServer(): void {
    this.wss.on("connection", (ws: WebSocket) => {
      this.handleConnection(ws);
    });

    this.wss.on("error", (error: Error) => {
      this.emit("error", error);
    });
  }

  /**
   * Handle new WebSocket connection
   */
  private handleConnection(ws: WebSocket): void {
    const clientId = this.generateClientId();

    const client: WSClient = {
      id: clientId,
      ws,
      authenticated: !this.options.authRequired,
      subscriptions: new Set(),
      filters: [],
      rateLimit: {
        maxEventsPerSecond: this.options.maxEventsPerSecond!,
        currentCount: 0,
        resetTime: Date.now() + 1000,
      },
      lastHeartbeat: Date.now(),
    };

    this.clients.set(clientId, client);

    // Setup client handlers
    ws.on("message", (data: Buffer) => {
      this.handleMessage(client, data);
    });

    ws.on("close", () => {
      this.handleDisconnect(client);
    });

    ws.on("error", (error: Error) => {
      this.emit("clientError", { clientId, error });
    });

    ws.on("pong", () => {
      client.lastHeartbeat = Date.now();
    });

    // Send welcome message
    this.sendMessage(client, {
      type: "auth",
      data: {
        clientId,
        authRequired: this.options.authRequired,
        message: "Connected to TrinityCore SOAP Event Stream",
      },
      timestamp: Date.now(),
    });

    this.emit("connection", { clientId });
  }

  /**
   * Handle incoming WebSocket message
   */
  private handleMessage(client: WSClient, data: Buffer): void {
    try {
      const message: WSMessage = JSON.parse(data.toString());

      switch (message.type) {
        case "auth":
          this.handleAuth(client, message.data);
          break;

        case "subscribe":
          this.handleSubscribe(client, message.data);
          break;

        case "unsubscribe":
          this.handleUnsubscribe(client, message.data);
          break;

        case "filter":
          this.handleFilter(client, message.data);
          break;

        case "heartbeat":
          client.lastHeartbeat = Date.now();
          this.sendMessage(client, {
            type: "heartbeat",
            timestamp: Date.now(),
          });
          break;

        default:
          this.sendError(client, `Unknown message type: ${message.type}`);
      }
    } catch (error) {
      this.sendError(client, `Invalid message format: ${(error as Error).message}`);
    }
  }

  /**
   * Handle authentication
   */
  private handleAuth(client: WSClient, data: unknown): void {
    if (!this.options.authRequired) {
      client.authenticated = true;
      this.sendMessage(client, {
        type: "auth",
        data: { success: true, message: "Authentication not required" },
        timestamp: Date.now(),
      });
      return;
    }

    const authData = data as { token?: string };

    if (authData.token === this.options.authToken) {
      client.authenticated = true;
      this.sendMessage(client, {
        type: "auth",
        data: { success: true, message: "Authenticated" },
        timestamp: Date.now(),
      });
      this.emit("authenticated", { clientId: client.id });
    } else {
      this.sendError(client, "Authentication failed");
      client.ws.close(4001, "Authentication failed");
    }
  }

  /**
   * Handle subscription
   */
  private handleSubscribe(client: WSClient, data: unknown): void {
    if (!client.authenticated) {
      this.sendError(client, "Not authenticated");
      return;
    }

    const subscribeData = data as { events: string[] };

    if (!subscribeData.events || !Array.isArray(subscribeData.events)) {
      this.sendError(client, "Invalid subscription data");
      return;
    }

    for (const event of subscribeData.events) {
      client.subscriptions.add(event);
    }

    this.sendMessage(client, {
      type: "subscribe",
      data: {
        success: true,
        subscriptions: Array.from(client.subscriptions),
      },
      timestamp: Date.now(),
    });
  }

  /**
   * Handle unsubscription
   */
  private handleUnsubscribe(client: WSClient, data: unknown): void {
    const unsubscribeData = data as { events: string[] };

    for (const event of unsubscribeData.events || []) {
      client.subscriptions.delete(event);
    }

    this.sendMessage(client, {
      type: "unsubscribe",
      data: { success: true, subscriptions: Array.from(client.subscriptions) },
      timestamp: Date.now(),
    });
  }

  /**
   * Handle filter update
   */
  private handleFilter(client: WSClient, data: unknown): void {
    const filterData = data as { filters: EventFilter[] };
    client.filters = filterData.filters || [];

    this.sendMessage(client, {
      type: "filter",
      data: { success: true, filterCount: client.filters.length },
      timestamp: Date.now(),
    });
  }

  /**
   * Handle client disconnect
   */
  private handleDisconnect(client: WSClient): void {
    this.clients.delete(client.id);
    this.emit("disconnect", { clientId: client.id });
  }

  /**
   * Broadcast SOAP event to subscribed clients
   */
  public broadcastEvent(event: SOAPEvent): void {
    for (const client of this.clients.values()) {
      if (!client.authenticated) continue;

      // Check subscription
      if (
        client.subscriptions.size > 0 &&
        !client.subscriptions.has(event.type) &&
        !client.subscriptions.has("*")
      ) {
        continue;
      }

      // Check filters
      if (client.filters.length > 0 && !this.matchesFilters(event, client.filters)) {
        continue;
      }

      // Check rate limit
      if (!this.checkRateLimit(client)) {
        continue;
      }

      // Send event
      this.sendMessage(client, {
        type: "event",
        data: event,
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Check if event matches filters
   */
  private matchesFilters(event: SOAPEvent, filters: EventFilter[]): boolean {
    for (const filter of filters) {
      if (filter.type && event.type !== filter.type) continue;
      if (filter.player && event.data.player !== filter.player) continue;
      if (filter.creature && event.data.creature !== filter.creature) continue;

      // Location filter
      if (filter.location) {
        const eventPos = event.data.position as { x: number; y: number; z: number; mapId: number } | undefined;
        if (eventPos && eventPos.mapId === filter.location.mapId) {
          const dist = Math.sqrt(
            (eventPos.x - filter.location.x) ** 2 +
              (eventPos.y - filter.location.y) ** 2 +
              (eventPos.z - filter.location.z) ** 2,
          );
          if (dist > filter.location.radius) continue;
        } else {
          continue;
        }
      }

      // Regex filter
      if (filter.regex) {
        const eventStr = JSON.stringify(event);
        if (!filter.regex.test(eventStr)) continue;
      }

      return true; // Matched at least one filter
    }

    return filters.length === 0; // No filters = allow all
  }

  /**
   * Check and update rate limit
   */
  private checkRateLimit(client: WSClient): boolean {
    const now = Date.now();

    if (now >= client.rateLimit.resetTime) {
      client.rateLimit.currentCount = 0;
      client.rateLimit.resetTime = now + 1000;
    }

    if (client.rateLimit.currentCount >= client.rateLimit.maxEventsPerSecond) {
      return false;
    }

    client.rateLimit.currentCount++;
    return true;
  }

  /**
   * Send message to client
   */
  private sendMessage(client: WSClient, message: WSMessage): void {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(message));
    }
  }

  /**
   * Send error to client
   */
  private sendError(client: WSClient, error: string): void {
    this.sendMessage(client, {
      type: "event",
      data: { error },
      timestamp: Date.now(),
    });
  }

  /**
   * Start heartbeat interval
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      for (const client of this.clients.values()) {
        if (client.ws.readyState === WebSocket.OPEN) {
          client.ws.ping();
        }
      }
    }, this.options.heartbeatInterval!);
  }

  /**
   * Start cleanup interval
   */
  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      const timeout = this.options.clientTimeout!;

      for (const client of this.clients.values()) {
        if (now - client.lastHeartbeat > timeout) {
          client.ws.close(4000, "Client timeout");
          this.clients.delete(client.id);
        }
      }
    }, this.options.heartbeatInterval!);
  }

  /**
   * Generate unique client ID
   */
  private generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get connected client count
   */
  public getClientCount(): number {
    return this.clients.size;
  }

  /**
   * Get client statistics
   */
  public getStatistics(): {
    totalClients: number;
    authenticatedClients: number;
    totalSubscriptions: number;
  } {
    let authenticatedClients = 0;
    let totalSubscriptions = 0;

    for (const client of this.clients.values()) {
      if (client.authenticated) authenticatedClients++;
      totalSubscriptions += client.subscriptions.size;
    }

    return {
      totalClients: this.clients.size,
      authenticatedClients,
      totalSubscriptions,
    };
  }

  /**
   * Close server
   */
  public close(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    this.wss.close();
  }
}
