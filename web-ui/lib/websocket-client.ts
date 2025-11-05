/**
 * WebSocket Client Library
 *
 * Client library for connecting to TrinityCore SOAP event stream.
 * Supports browser and Node.js environments with auto-reconnect and filtering.
 *
 * @module websocket-client
 */

import type { SOAPEvent, EventFilter } from "../../src/soap/websocket-server.js";

// ============================================================================
// Types
// ============================================================================

/**
 * Client configuration
 */
export interface WebSocketClientConfig {
  /** WebSocket server URL */
  url: string;

  /** Authentication token */
  authToken?: string;

  /** Auto-reconnect on disconnect */
  autoReconnect?: boolean;

  /** Reconnect delay (ms) */
  reconnectDelay?: number;

  /** Maximum reconnect attempts */
  maxReconnectAttempts?: number;

  /** Heartbeat interval (ms) */
  heartbeatInterval?: number;

  /** Event subscriptions */
  subscriptions?: string[];

  /** Event filters */
  filters?: EventFilter[];
}

/**
 * Connection state
 */
export enum ConnectionState {
  DISCONNECTED = "disconnected",
  CONNECTING = "connecting",
  CONNECTED = "connected",
  AUTHENTICATING = "authenticating",
  AUTHENTICATED = "authenticated",
  RECONNECTING = "reconnecting",
  ERROR = "error",
}

/**
 * WebSocket message
 */
interface WSMessage {
  type: "auth" | "subscribe" | "unsubscribe" | "filter" | "heartbeat" | "event";
  data?: unknown;
  timestamp: number;
}

/**
 * Event handler
 */
export type EventHandler = (event: SOAPEvent) => void;

/**
 * State change handler
 */
export type StateChangeHandler = (state: ConnectionState, prevState: ConnectionState) => void;

// ============================================================================
// WebSocket Client
// ============================================================================

export class TrinityWebSocketClient {
  private config: Required<WebSocketClientConfig>;
  private ws: WebSocket | null = null;
  private state: ConnectionState = ConnectionState.DISCONNECTED;
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private eventHandlers: Set<EventHandler> = new Set();
  private stateHandlers: Set<StateChangeHandler> = new Set();
  private authenticated = false;

  // Statistics
  private stats = {
    eventsReceived: 0,
    messagesSent: 0,
    reconnects: 0,
    errors: 0,
    connectedAt: 0,
    lastEventAt: 0,
  };

  constructor(config: WebSocketClientConfig) {
    this.config = {
      url: config.url,
      authToken: config.authToken ?? "",
      autoReconnect: config.autoReconnect ?? true,
      reconnectDelay: config.reconnectDelay ?? 3000,
      maxReconnectAttempts: config.maxReconnectAttempts ?? 10,
      heartbeatInterval: config.heartbeatInterval ?? 30000,
      subscriptions: config.subscriptions ?? [],
      filters: config.filters ?? [],
    };
  }

  /**
   * Connect to WebSocket server
   */
  public async connect(): Promise<void> {
    if (this.state !== ConnectionState.DISCONNECTED && this.state !== ConnectionState.ERROR) {
      throw new Error(`Cannot connect in state: ${this.state}`);
    }

    return new Promise((resolve, reject) => {
      try {
        this.setState(ConnectionState.CONNECTING);

        this.ws = new WebSocket(this.config.url);

        this.ws.onopen = () => {
          this.setState(ConnectionState.CONNECTED);
          this.stats.connectedAt = Date.now();
          this.reconnectAttempts = 0;

          // Authenticate if token provided
          if (this.config.authToken) {
            this.authenticate();
          } else {
            this.authenticated = true;
            this.onAuthenticated();
          }

          resolve();
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };

        this.ws.onerror = (error) => {
          this.setState(ConnectionState.ERROR);
          this.stats.errors++;
          reject(error);
        };

        this.ws.onclose = () => {
          this.handleDisconnect();
        };
      } catch (error) {
        this.setState(ConnectionState.ERROR);
        reject(error);
      }
    });
  }

  /**
   * Disconnect from server
   */
  public disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.authenticated = false;
    this.setState(ConnectionState.DISCONNECTED);
  }

  /**
   * Authenticate with server
   */
  private authenticate(): void {
    this.setState(ConnectionState.AUTHENTICATING);

    this.sendMessage({
      type: "auth",
      data: { token: this.config.authToken },
      timestamp: Date.now(),
    });
  }

  /**
   * Handle successful authentication
   */
  private onAuthenticated(): void {
    this.authenticated = true;
    this.setState(ConnectionState.AUTHENTICATED);

    // Subscribe to events
    if (this.config.subscriptions.length > 0) {
      this.subscribe(this.config.subscriptions);
    }

    // Set filters
    if (this.config.filters.length > 0) {
      this.setFilters(this.config.filters);
    }

    // Start heartbeat
    this.startHeartbeat();
  }

  /**
   * Handle incoming message
   */
  private handleMessage(data: string): void {
    try {
      const message: WSMessage = JSON.parse(data);

      switch (message.type) {
        case "auth":
          this.handleAuthResponse(message.data);
          break;

        case "subscribe":
        case "unsubscribe":
        case "filter":
          // Acknowledgment messages
          break;

        case "heartbeat":
          // Heartbeat response
          break;

        case "event":
          this.handleEvent(message.data as SOAPEvent);
          break;

        default:
          console.warn("Unknown message type:", message.type);
      }
    } catch (error) {
      console.error("Failed to parse message:", error);
      this.stats.errors++;
    }
  }

  /**
   * Handle authentication response
   */
  private handleAuthResponse(data: unknown): void {
    const authData = data as { success?: boolean; message?: string };

    if (authData.success) {
      this.onAuthenticated();
    } else {
      this.setState(ConnectionState.ERROR);
      console.error("Authentication failed:", authData.message);
    }
  }

  /**
   * Handle event
   */
  private handleEvent(event: SOAPEvent): void {
    this.stats.eventsReceived++;
    this.stats.lastEventAt = Date.now();

    // Call all event handlers
    for (const handler of this.eventHandlers) {
      try {
        handler(event);
      } catch (error) {
        console.error("Event handler error:", error);
      }
    }
  }

  /**
   * Handle disconnect
   */
  private handleDisconnect(): void {
    this.authenticated = false;

    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    if (this.config.autoReconnect && this.reconnectAttempts < this.config.maxReconnectAttempts) {
      this.setState(ConnectionState.RECONNECTING);
      this.reconnectAttempts++;
      this.stats.reconnects++;

      this.reconnectTimer = setTimeout(() => {
        this.connect().catch((error) => {
          console.error("Reconnect failed:", error);
        });
      }, this.config.reconnectDelay);
    } else {
      this.setState(ConnectionState.DISCONNECTED);
    }
  }

  /**
   * Send message to server
   */
  private sendMessage(message: WSMessage): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("WebSocket is not connected");
    }

    this.ws.send(JSON.stringify(message));
    this.stats.messagesSent++;
  }

  /**
   * Subscribe to events
   */
  public subscribe(events: string[]): void {
    this.config.subscriptions.push(...events);

    if (this.authenticated) {
      this.sendMessage({
        type: "subscribe",
        data: { events },
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Unsubscribe from events
   */
  public unsubscribe(events: string[]): void {
    this.config.subscriptions = this.config.subscriptions.filter((e) => !events.includes(e));

    if (this.authenticated) {
      this.sendMessage({
        type: "unsubscribe",
        data: { events },
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Set event filters
   */
  public setFilters(filters: EventFilter[]): void {
    this.config.filters = filters;

    if (this.authenticated) {
      this.sendMessage({
        type: "filter",
        data: { filters },
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Start heartbeat
   */
  private startHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }

    this.heartbeatTimer = setInterval(() => {
      if (this.authenticated && this.ws?.readyState === WebSocket.OPEN) {
        this.sendMessage({
          type: "heartbeat",
          timestamp: Date.now(),
        });
      }
    }, this.config.heartbeatInterval);
  }

  /**
   * Add event handler
   */
  public on(handler: EventHandler): void {
    this.eventHandlers.add(handler);
  }

  /**
   * Remove event handler
   */
  public off(handler: EventHandler): void {
    this.eventHandlers.delete(handler);
  }

  /**
   * Add state change handler
   */
  public onStateChange(handler: StateChangeHandler): void {
    this.stateHandlers.add(handler);
  }

  /**
   * Remove state change handler
   */
  public offStateChange(handler: StateChangeHandler): void {
    this.stateHandlers.delete(handler);
  }

  /**
   * Set connection state
   */
  private setState(newState: ConnectionState): void {
    const prevState = this.state;
    this.state = newState;

    // Call state change handlers
    for (const handler of this.stateHandlers) {
      try {
        handler(newState, prevState);
      } catch (error) {
        console.error("State change handler error:", error);
      }
    }
  }

  /**
   * Get connection state
   */
  public getState(): ConnectionState {
    return this.state;
  }

  /**
   * Check if connected and authenticated
   */
  public isConnected(): boolean {
    return this.state === ConnectionState.AUTHENTICATED;
  }

  /**
   * Get statistics
   */
  public getStatistics(): {
    eventsReceived: number;
    messagesSent: number;
    reconnects: number;
    errors: number;
    uptime: number;
    timeSinceLastEvent: number;
  } {
    return {
      eventsReceived: this.stats.eventsReceived,
      messagesSent: this.stats.messagesSent,
      reconnects: this.stats.reconnects,
      errors: this.stats.errors,
      uptime: this.stats.connectedAt > 0 ? Date.now() - this.stats.connectedAt : 0,
      timeSinceLastEvent: this.stats.lastEventAt > 0 ? Date.now() - this.stats.lastEventAt : 0,
    };
  }
}

// ============================================================================
// React Hook (Optional)
// ============================================================================

/**
 * React hook for WebSocket client
 */
export function useTrinityWebSocket(config: WebSocketClientConfig) {
  // This is a placeholder - actual implementation would use React hooks
  // For now, just return the client
  return new TrinityWebSocketClient(config);
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create WebSocket client with default config
 */
export function createWebSocketClient(
  url: string,
  authToken?: string,
): TrinityWebSocketClient {
  return new TrinityWebSocketClient({
    url,
    authToken,
    autoReconnect: true,
    subscriptions: ["*"], // Subscribe to all events by default
  });
}

/**
 * Create event filter for player
 */
export function createPlayerFilter(playerName: string): EventFilter {
  return {
    player: playerName,
  };
}

/**
 * Create event filter for location
 */
export function createLocationFilter(
  mapId: number,
  x: number,
  y: number,
  z: number,
  radius: number,
): EventFilter {
  return {
    location: { mapId, x, y, z, radius },
  };
}

/**
 * Create event filter for creature
 */
export function createCreatureFilter(creatureName: string): EventFilter {
  return {
    creature: creatureName,
  };
}

/**
 * Create event filter with regex
 */
export function createRegexFilter(pattern: string): EventFilter {
  return {
    regex: new RegExp(pattern),
  };
}
