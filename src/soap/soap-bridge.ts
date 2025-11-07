/**
 * SOAP Bridge for Real-Time Event Streaming
 *
 * Bridges TrinityCore SOAP interface to WebSocket event streaming.
 * Polls SOAP commands for events and broadcasts to WebSocket clients.
 *
 * @module soap-bridge
 */

import { EventEmitter } from "events";
import type { SOAPWebSocketServer, SOAPEvent } from "./websocket-server";
import type { SOAPConnectionConfig } from "../types/soap";

// ============================================================================
// Types
// ============================================================================

/**
 * SOAP bridge configuration
 */
export interface SOAPBridgeConfig {
  /** SOAP connection config */
  connection: SOAPConnectionConfig;

  /** Polling interval (ms) */
  pollInterval?: number;

  /** Event buffer size */
  bufferSize?: number;

  /** Enable event aggregation */
  aggregateEvents?: boolean;

  /** Server identifier */
  serverId?: string;

  /** Commands to poll for events */
  pollCommands?: string[];

  /** Event types to track */
  eventTypes?: string[];
}

/**
 * Parsed SOAP event
 */
interface ParsedSOAPEvent {
  timestamp: number;
  command: string;
  output: string;
  type?: string;
  data?: Record<string, unknown>;
}

/**
 * Event parser function
 */
type EventParser = (output: string) => ParsedSOAPEvent | null;

// ============================================================================
// SOAP Bridge
// ============================================================================

export class SOAPBridge extends EventEmitter {
  private config: Required<SOAPBridgeConfig>;
  private wsServer: SOAPWebSocketServer;
  private pollTimer: NodeJS.Timeout | null = null;
  private isPolling = false;
  private eventParsers: Map<string, EventParser>;
  private eventBuffer: SOAPEvent[] = [];
  private lastPollTime = 0;
  private connected = false;

  // Statistics
  private stats = {
    eventsReceived: 0,
    eventsSent: 0,
    errors: 0,
    avgPollTime: 0,
    lastPoll: 0,
  };

  constructor(wsServer: SOAPWebSocketServer, config: SOAPBridgeConfig) {
    super();

    this.wsServer = wsServer;

    // Set defaults
    this.config = {
      connection: config.connection,
      pollInterval: config.pollInterval ?? 1000, // 1 second
      bufferSize: config.bufferSize ?? 1000,
      aggregateEvents: config.aggregateEvents ?? true,
      serverId: config.serverId ?? "default",
      pollCommands: config.pollCommands ?? [
        "server info",
        "account onlinelist",
      ],
      eventTypes: config.eventTypes ?? [
        "player.login",
        "player.logout",
        "player.chat",
        "player.kill",
        "player.death",
        "player.levelup",
        "creature.spawn",
        "gameobject.use",
      ],
    };

    this.eventParsers = new Map();
    this.setupEventParsers();
  }

  /**
   * Setup event parsers for different SOAP commands
   */
  private setupEventParsers(): void {
    // Player login parser
    this.eventParsers.set("player.login", (output: string) => {
      const match = output.match(/Player\s+([^\s]+)\s+\(GUID:\s+(\d+)\)\s+logged in/i);
      if (match) {
        return {
          timestamp: Date.now(),
          command: "player.login",
          output,
          type: "player.login",
          data: {
            playerName: match[1],
            playerGuid: parseInt(match[2], 10),
          },
        };
      }
      return null;
    });

    // Player logout parser
    this.eventParsers.set("player.logout", (output: string) => {
      const match = output.match(/Player\s+([^\s]+)\s+\(GUID:\s+(\d+)\)\s+logged out/i);
      if (match) {
        return {
          timestamp: Date.now(),
          command: "player.logout",
          output,
          type: "player.logout",
          data: {
            playerName: match[1],
            playerGuid: parseInt(match[2], 10),
          },
        };
      }
      return null;
    });

    // Player chat parser
    this.eventParsers.set("player.chat", (output: string) => {
      const match = output.match(/\[([^\]]+)\]\s+([^:]+):\s+(.+)/);
      if (match) {
        return {
          timestamp: Date.now(),
          command: "player.chat",
          output,
          type: "player.chat",
          data: {
            channel: match[1],
            playerName: match[2],
            message: match[3],
          },
        };
      }
      return null;
    });

    // Player levelup parser
    this.eventParsers.set("player.levelup", (output: string) => {
      const match = output.match(/Player\s+([^\s]+)\s+reached level\s+(\d+)/i);
      if (match) {
        return {
          timestamp: Date.now(),
          command: "player.levelup",
          output,
          type: "player.levelup",
          data: {
            playerName: match[1],
            level: parseInt(match[2], 10),
          },
        };
      }
      return null;
    });

    // Server info parser
    this.eventParsers.set("server.info", (output: string) => {
      const uptimeMatch = output.match(/Uptime:\s+(.+)/i);
      const playersMatch = output.match(/Players online:\s+(\d+)/i);

      if (uptimeMatch || playersMatch) {
        return {
          timestamp: Date.now(),
          command: "server.info",
          output,
          type: "server.info",
          data: {
            uptime: uptimeMatch?.[1],
            playersOnline: playersMatch ? parseInt(playersMatch[1], 10) : 0,
          },
        };
      }
      return null;
    });

    // Online list parser
    this.eventParsers.set("account.onlinelist", (output: string) => {
      const players: string[] = [];
      const lines = output.split("\n");

      for (const line of lines) {
        const match = line.match(/^\s*([^\s]+)\s+\(GUID:\s+(\d+)\)/);
        if (match) {
          players.push(match[1]);
        }
      }

      if (players.length > 0) {
        return {
          timestamp: Date.now(),
          command: "account.onlinelist",
          output,
          type: "server.players",
          data: {
            players,
            count: players.length,
          },
        };
      }
      return null;
    });

    // Generic parser (fallback)
    this.eventParsers.set("generic", (output: string) => {
      return {
        timestamp: Date.now(),
        command: "generic",
        output,
        type: "server.message",
        data: {
          message: output,
        },
      };
    });
  }

  /**
   * Start the SOAP bridge
   */
  public async start(): Promise<void> {
    if (this.pollTimer) {
      throw new Error("SOAP bridge is already running");
    }

    try {
      // Test connection
      await this.testConnection();
      this.connected = true;

      // Start polling
      this.pollTimer = setInterval(() => {
        this.poll().catch((error) => {
          this.emit("error", error);
        });
      }, this.config.pollInterval);

      // Initial poll
      await this.poll();

      this.emit("started", { serverId: this.config.serverId });
    } catch (error) {
      this.emit("error", new Error(`Failed to start SOAP bridge: ${(error as Error).message}`));
      throw error;
    }
  }

  /**
   * Stop the SOAP bridge
   */
  public stop(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }

    this.connected = false;
    this.emit("stopped", { serverId: this.config.serverId });
  }

  /**
   * Test SOAP connection
   */
  private async testConnection(): Promise<void> {
    try {
      // Import SOAP client dynamically to avoid circular dependencies
      const { executeSOAPCommand } = await import("../soap/soap-client.js");

      const result = await executeSOAPCommand(this.config.connection, "server info", {
        timeout: 5000,
      });

      if (!result.success) {
        throw new Error(`SOAP connection test failed: ${result.error}`);
      }
    } catch (error) {
      throw new Error(`SOAP connection test failed: ${(error as Error).message}`);
    }
  }

  /**
   * Poll SOAP for events
   */
  private async poll(): Promise<void> {
    if (this.isPolling) {
      return; // Skip if already polling
    }

    this.isPolling = true;
    const startTime = Date.now();

    try {
      // Import SOAP client
      const { executeSOAPCommand } = await import("../soap/soap-client.js");

      // Execute poll commands
      for (const command of this.config.pollCommands) {
        try {
          const result = await executeSOAPCommand(this.config.connection, command, {
            timeout: 3000,
          });

          if (result.success && result.output) {
            this.processSOAPOutput(command, result.output);
          }
        } catch (error) {
          this.stats.errors++;
          this.emit("pollError", {
            command,
            error: (error as Error).message,
          });
        }
      }

      // Broadcast buffered events
      this.flushEventBuffer();

      // Update stats
      const pollTime = Date.now() - startTime;
      this.stats.avgPollTime = (this.stats.avgPollTime * 0.9 + pollTime * 0.1); // Rolling average
      this.stats.lastPoll = Date.now();
      this.lastPollTime = Date.now();

      this.emit("polled", {
        serverId: this.config.serverId,
        pollTime,
        eventCount: this.eventBuffer.length,
      });
    } catch (error) {
      this.stats.errors++;
      this.emit("error", new Error(`Poll failed: ${(error as Error).message}`));
    } finally {
      this.isPolling = false;
    }
  }

  /**
   * Process SOAP command output
   */
  private processSOAPOutput(command: string, output: string): void {
    // Try to parse with registered parsers
    for (const [eventType, parser] of this.eventParsers.entries()) {
      try {
        const parsed = parser(output);
        if (parsed && parsed.type) {
          const event: SOAPEvent = {
            type: parsed.type,
            timestamp: parsed.timestamp,
            data: parsed.data || {},
            serverId: this.config.serverId,
          };

          this.addEventToBuffer(event);
          this.stats.eventsReceived++;
        }
      } catch (error) {
        this.emit("parseError", {
          eventType,
          command,
          error: (error as Error).message,
        });
      }
    }
  }

  /**
   * Add event to buffer
   */
  private addEventToBuffer(event: SOAPEvent): void {
    // Check if buffer is full
    if (this.eventBuffer.length >= this.config.bufferSize) {
      // Remove oldest event
      this.eventBuffer.shift();
    }

    this.eventBuffer.push(event);
  }

  /**
   * Flush event buffer to WebSocket
   */
  private flushEventBuffer(): void {
    if (this.eventBuffer.length === 0) {
      return;
    }

    // Aggregate events if enabled
    const events = this.config.aggregateEvents
      ? this.aggregateEvents(this.eventBuffer)
      : this.eventBuffer;

    // Broadcast to WebSocket
    for (const event of events) {
      this.wsServer.broadcastEvent(event);
      this.stats.eventsSent++;
    }

    // Clear buffer
    this.eventBuffer = [];
  }

  /**
   * Aggregate similar events
   */
  private aggregateEvents(events: SOAPEvent[]): SOAPEvent[] {
    const aggregated = new Map<string, SOAPEvent>();

    for (const event of events) {
      const key = `${event.type}_${event.serverId}`;

      if (aggregated.has(key)) {
        // Merge with existing event
        const existing = aggregated.get(key)!;

        // For player lists, combine arrays
        if (event.type === "server.players" && Array.isArray(event.data.players)) {
          const existingPlayers = existing.data.players as string[];
          const newPlayers = event.data.players as string[];
          existing.data.players = [...new Set([...existingPlayers, ...newPlayers])];
          existing.data.count = (existing.data.players as string[]).length;
        }

        // Update timestamp to latest
        existing.timestamp = Math.max(existing.timestamp, event.timestamp);
      } else {
        // Add new event
        aggregated.set(key, { ...event });
      }
    }

    return Array.from(aggregated.values());
  }

  /**
   * Get bridge statistics
   */
  public getStatistics(): {
    connected: boolean;
    serverId: string;
    eventsReceived: number;
    eventsSent: number;
    errors: number;
    avgPollTime: number;
    lastPoll: number;
    bufferSize: number;
  } {
    return {
      connected: this.connected,
      serverId: this.config.serverId,
      eventsReceived: this.stats.eventsReceived,
      eventsSent: this.stats.eventsSent,
      errors: this.stats.errors,
      avgPollTime: this.stats.avgPollTime,
      lastPoll: this.stats.lastPoll,
      bufferSize: this.eventBuffer.length,
    };
  }

  /**
   * Add custom event parser
   */
  public addEventParser(eventType: string, parser: EventParser): void {
    this.eventParsers.set(eventType, parser);
  }

  /**
   * Remove event parser
   */
  public removeEventParser(eventType: string): void {
    this.eventParsers.delete(eventType);
  }

  /**
   * Manually inject event
   */
  public injectEvent(event: SOAPEvent): void {
    this.addEventToBuffer(event);
  }

  /**
   * Get connection status
   */
  public isConnected(): boolean {
    return this.connected;
  }

  /**
   * Get time since last poll
   */
  public getTimeSinceLastPoll(): number {
    return Date.now() - this.lastPollTime;
  }
}

// ============================================================================
// Multi-Server Bridge Manager
// ============================================================================

/**
 * Manages multiple SOAP bridges for different servers
 */
export class SOAPBridgeManager extends EventEmitter {
  private bridges: Map<string, SOAPBridge>;
  private wsServer: SOAPWebSocketServer;

  constructor(wsServer: SOAPWebSocketServer) {
    super();
    this.bridges = new Map();
    this.wsServer = wsServer;
  }

  /**
   * Add a SOAP bridge for a server
   */
  public async addBridge(serverId: string, config: SOAPBridgeConfig): Promise<void> {
    if (this.bridges.has(serverId)) {
      throw new Error(`Bridge for server ${serverId} already exists`);
    }

    const bridge = new SOAPBridge(this.wsServer, {
      ...config,
      serverId,
    });

    // Forward events
    bridge.on("error", (error) => {
      this.emit("bridgeError", { serverId, error });
    });

    bridge.on("polled", (data) => {
      this.emit("bridgePolled", { serverId, ...data });
    });

    bridge.on("started", () => {
      this.emit("bridgeStarted", { serverId });
    });

    bridge.on("stopped", () => {
      this.emit("bridgeStopped", { serverId });
    });

    this.bridges.set(serverId, bridge);

    // Start bridge
    await bridge.start();
  }

  /**
   * Remove a SOAP bridge
   */
  public removeBridge(serverId: string): void {
    const bridge = this.bridges.get(serverId);
    if (!bridge) {
      throw new Error(`Bridge for server ${serverId} not found`);
    }

    bridge.stop();
    bridge.removeAllListeners();
    this.bridges.delete(serverId);
  }

  /**
   * Get bridge for server
   */
  public getBridge(serverId: string): SOAPBridge | undefined {
    return this.bridges.get(serverId);
  }

  /**
   * Get all bridge statistics
   */
  public getAllStatistics(): Record<string, ReturnType<SOAPBridge["getStatistics"]>> {
    const stats: Record<string, ReturnType<SOAPBridge["getStatistics"]>> = {};

    for (const [serverId, bridge] of this.bridges.entries()) {
      stats[serverId] = bridge.getStatistics();
    }

    return stats;
  }

  /**
   * Stop all bridges
   */
  public stopAll(): void {
    for (const bridge of this.bridges.values()) {
      bridge.stop();
      bridge.removeAllListeners();
    }

    this.bridges.clear();
  }

  /**
   * Get bridge count
   */
  public getBridgeCount(): number {
    return this.bridges.size;
  }
}
