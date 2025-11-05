/**
 * Event Parsers and Aggregation
 *
 * Comprehensive parsing and aggregation of TrinityCore SOAP events.
 * Supports player events, server events, combat logs, and custom parsing.
 *
 * @module event-parsers
 */

import type { SOAPEvent } from "./websocket-server.js";

// ============================================================================
// Types
// ============================================================================

/**
 * Parser result
 */
export interface ParserResult {
  success: boolean;
  events: SOAPEvent[];
  error?: string;
}

/**
 * Parser configuration
 */
export interface ParserConfig {
  /** Enable aggregation */
  aggregation?: boolean;

  /** Aggregation window (ms) */
  aggregationWindow?: number;

  /** Server ID */
  serverId?: string;

  /** Custom parsers */
  customParsers?: Map<string, EventParser>;
}

/**
 * Event parser function
 */
export type EventParser = (output: string, timestamp: number) => SOAPEvent[];

/**
 * Aggregation rule
 */
export interface AggregationRule {
  /** Event types to aggregate */
  eventTypes: string[];

  /** Aggregation function */
  aggregate: (events: SOAPEvent[]) => SOAPEvent;

  /** Maximum events to aggregate */
  maxEvents?: number;
}

// ============================================================================
// Event Parsers
// ============================================================================

/**
 * Player login parser
 */
export function parsePlayerLogin(output: string, timestamp: number): SOAPEvent[] {
  const events: SOAPEvent[] = [];
  const lines = output.split("\n");

  for (const line of lines) {
    const match = line.match(
      /Player\s+['"]?([^'"]+)['"]?\s+\((?:Account:\s+(\d+)|GUID:\s+(\d+))\)\s+logged in/i,
    );

    if (match) {
      events.push({
        type: "player.login",
        timestamp,
        data: {
          playerName: match[1],
          accountId: match[2] ? parseInt(match[2], 10) : undefined,
          playerGuid: match[3] ? parseInt(match[3], 10) : undefined,
        },
      });
    }
  }

  return events;
}

/**
 * Player logout parser
 */
export function parsePlayerLogout(output: string, timestamp: number): SOAPEvent[] {
  const events: SOAPEvent[] = [];
  const lines = output.split("\n");

  for (const line of lines) {
    const match = line.match(/Player\s+['"]?([^'"]+)['"]?\s+\(GUID:\s+(\d+)\)\s+logged out/i);

    if (match) {
      events.push({
        type: "player.logout",
        timestamp,
        data: {
          playerName: match[1],
          playerGuid: parseInt(match[2], 10),
        },
      });
    }
  }

  return events;
}

/**
 * Player chat parser
 */
export function parsePlayerChat(output: string, timestamp: number): SOAPEvent[] {
  const events: SOAPEvent[] = [];
  const lines = output.split("\n");

  for (const line of lines) {
    // Format: [Channel] PlayerName: Message
    const match = line.match(/\[([^\]]+)\]\s+([^:]+):\s+(.+)/);

    if (match) {
      events.push({
        type: "player.chat",
        timestamp,
        data: {
          channel: match[1],
          playerName: match[2].trim(),
          message: match[3].trim(),
        },
      });
    }
  }

  return events;
}

/**
 * Player level up parser
 */
export function parsePlayerLevelUp(output: string, timestamp: number): SOAPEvent[] {
  const events: SOAPEvent[] = [];
  const lines = output.split("\n");

  for (const line of lines) {
    const match = line.match(/Player\s+['"]?([^'"]+)['"]?\s+reached level\s+(\d+)/i);

    if (match) {
      events.push({
        type: "player.levelup",
        timestamp,
        data: {
          playerName: match[1],
          level: parseInt(match[2], 10),
        },
      });
    }
  }

  return events;
}

/**
 * Player death parser
 */
export function parsePlayerDeath(output: string, timestamp: number): SOAPEvent[] {
  const events: SOAPEvent[] = [];
  const lines = output.split("\n");

  for (const line of lines) {
    const match = line.match(/Player\s+['"]?([^'"]+)['"]?\s+died/i);

    if (match) {
      events.push({
        type: "player.death",
        timestamp,
        data: {
          playerName: match[1],
        },
      });
    }
  }

  return events;
}

/**
 * Player kill parser (PvP or creature)
 */
export function parsePlayerKill(output: string, timestamp: number): SOAPEvent[] {
  const events: SOAPEvent[] = [];
  const lines = output.split("\n");

  for (const line of lines) {
    // PvP kill
    const pvpMatch = line.match(/Player\s+['"]?([^'"]+)['"]?\s+killed\s+['"]?([^'"]+)['"]?/i);
    if (pvpMatch) {
      events.push({
        type: "player.kill.pvp",
        timestamp,
        data: {
          killer: pvpMatch[1],
          victim: pvpMatch[2],
        },
      });
      continue;
    }

    // Creature kill
    const creatureMatch = line.match(
      /Player\s+['"]?([^'"]+)['"]?\s+killed\s+creature\s+['"]?([^'"]+)['"]?\s+\(Entry:\s+(\d+)\)/i,
    );
    if (creatureMatch) {
      events.push({
        type: "player.kill.creature",
        timestamp,
        data: {
          playerName: creatureMatch[1],
          creatureName: creatureMatch[2],
          creatureEntry: parseInt(creatureMatch[3], 10),
        },
      });
    }
  }

  return events;
}

/**
 * Server info parser
 */
export function parseServerInfo(output: string, timestamp: number): SOAPEvent[] {
  const events: SOAPEvent[] = [];

  const uptimeMatch = output.match(/Uptime:\s+(.+)/i);
  const playersMatch = output.match(/Players online:\s+(\d+)(?:\s*\/\s*(\d+))?/i);
  const versionMatch = output.match(/TrinityCore rev\.\s+([^\s]+)/i);
  const peakMatch = output.match(/Peak:\s+(\d+)/i);

  if (uptimeMatch || playersMatch) {
    events.push({
      type: "server.info",
      timestamp,
      data: {
        uptime: uptimeMatch?.[1],
        playersOnline: playersMatch ? parseInt(playersMatch[1], 10) : 0,
        maxPlayers: playersMatch?.[2] ? parseInt(playersMatch[2], 10) : undefined,
        version: versionMatch?.[1],
        peakPlayers: peakMatch ? parseInt(peakMatch[1], 10) : undefined,
      },
    });
  }

  return events;
}

/**
 * Online players list parser
 */
export function parseOnlineList(output: string, timestamp: number): SOAPEvent[] {
  const events: SOAPEvent[] = [];
  const lines = output.split("\n");
  const players: Array<{ name: string; guid: number; account: number; level?: number }> = [];

  for (const line of lines) {
    // Format: PlayerName (GUID: 123) Account: 456 Level: 80
    const match = line.match(
      /^\s*([^\s(]+)\s+\(GUID:\s+(\d+)\)(?:\s+Account:\s+(\d+))?(?:\s+Level:\s+(\d+))?/i,
    );

    if (match) {
      players.push({
        name: match[1],
        guid: parseInt(match[2], 10),
        account: match[3] ? parseInt(match[3], 10) : 0,
        level: match[4] ? parseInt(match[4], 10) : undefined,
      });
    }
  }

  if (players.length > 0) {
    events.push({
      type: "server.players",
      timestamp,
      data: {
        players,
        count: players.length,
      },
    });
  }

  return events;
}

/**
 * Creature spawn parser
 */
export function parseCreatureSpawn(output: string, timestamp: number): SOAPEvent[] {
  const events: SOAPEvent[] = [];
  const lines = output.split("\n");

  for (const line of lines) {
    const match = line.match(
      /Creature\s+['"]?([^'"]+)['"]?\s+\(Entry:\s+(\d+)\)\s+spawned at\s+\(([^)]+)\)/i,
    );

    if (match) {
      const [x, y, z, mapId] = match[3].split(",").map((s) => parseFloat(s.trim()));

      events.push({
        type: "creature.spawn",
        timestamp,
        data: {
          creatureName: match[1],
          creatureEntry: parseInt(match[2], 10),
          position: { x, y, z, mapId },
        },
      });
    }
  }

  return events;
}

/**
 * GameObject use parser
 */
export function parseGameObjectUse(output: string, timestamp: number): SOAPEvent[] {
  const events: SOAPEvent[] = [];
  const lines = output.split("\n");

  for (const line of lines) {
    const match = line.match(
      /Player\s+['"]?([^'"]+)['"]?\s+used\s+GameObject\s+['"]?([^'"]+)['"]?\s+\(Entry:\s+(\d+)\)/i,
    );

    if (match) {
      events.push({
        type: "gameobject.use",
        timestamp,
        data: {
          playerName: match[1],
          objectName: match[2],
          objectEntry: parseInt(match[3], 10),
        },
      });
    }
  }

  return events;
}

/**
 * Combat log parser
 */
export function parseCombatLog(output: string, timestamp: number): SOAPEvent[] {
  const events: SOAPEvent[] = [];
  const lines = output.split("\n");

  for (const line of lines) {
    // Damage event
    const damageMatch = line.match(
      /([^\s]+)\s+dealt\s+(\d+)\s+([^\s]+)\s+damage to\s+([^\s]+)/i,
    );
    if (damageMatch) {
      events.push({
        type: "combat.damage",
        timestamp,
        data: {
          source: damageMatch[1],
          amount: parseInt(damageMatch[2], 10),
          damageType: damageMatch[3],
          target: damageMatch[4],
        },
      });
      continue;
    }

    // Heal event
    const healMatch = line.match(/([^\s]+)\s+healed\s+([^\s]+)\s+for\s+(\d+)/i);
    if (healMatch) {
      events.push({
        type: "combat.heal",
        timestamp,
        data: {
          source: healMatch[1],
          target: healMatch[2],
          amount: parseInt(healMatch[3], 10),
        },
      });
    }
  }

  return events;
}

/**
 * Guild event parser
 */
export function parseGuildEvent(output: string, timestamp: number): SOAPEvent[] {
  const events: SOAPEvent[] = [];
  const lines = output.split("\n");

  for (const line of lines) {
    // Guild creation
    const createMatch = line.match(/Guild\s+['"]?([^'"]+)['"]?\s+was created/i);
    if (createMatch) {
      events.push({
        type: "guild.created",
        timestamp,
        data: {
          guildName: createMatch[1],
        },
      });
      continue;
    }

    // Player joined guild
    const joinMatch = line.match(/Player\s+['"]?([^'"]+)['"]?\s+joined guild\s+['"]?([^'"]+)['"]?/i);
    if (joinMatch) {
      events.push({
        type: "guild.join",
        timestamp,
        data: {
          playerName: joinMatch[1],
          guildName: joinMatch[2],
        },
      });
    }
  }

  return events;
}

// ============================================================================
// Master Parser
// ============================================================================

/**
 * Main event parser that routes to specific parsers
 */
export class SOAPEventParser {
  private parsers: Map<string, EventParser>;
  private config: Required<ParserConfig>;
  private aggregationBuffer: Map<string, SOAPEvent[]>;
  private aggregationTimers: Map<string, NodeJS.Timeout>;

  constructor(config: ParserConfig = {}) {
    this.config = {
      aggregation: config.aggregation ?? true,
      aggregationWindow: config.aggregationWindow ?? 5000, // 5 seconds
      serverId: config.serverId ?? "default",
      customParsers: config.customParsers ?? new Map(),
    };

    this.aggregationBuffer = new Map();
    this.aggregationTimers = new Map();

    // Initialize parsers
    this.parsers = new Map([
      ["player.login", parsePlayerLogin],
      ["player.logout", parsePlayerLogout],
      ["player.chat", parsePlayerChat],
      ["player.levelup", parsePlayerLevelUp],
      ["player.death", parsePlayerDeath],
      ["player.kill", parsePlayerKill],
      ["server.info", parseServerInfo],
      ["server.players", parseOnlineList],
      ["creature.spawn", parseCreatureSpawn],
      ["gameobject.use", parseGameObjectUse],
      ["combat.log", parseCombatLog],
      ["guild.event", parseGuildEvent],
      ...this.config.customParsers,
    ]);
  }

  /**
   * Parse SOAP output
   */
  public parse(output: string, commandType?: string): ParserResult {
    try {
      const timestamp = Date.now();
      const events: SOAPEvent[] = [];

      // Try specific parser if command type is known
      if (commandType) {
        const parser = this.parsers.get(commandType);
        if (parser) {
          const parsed = parser(output, timestamp);
          events.push(...parsed);
        }
      }

      // Try all parsers if no specific type or no results
      if (events.length === 0) {
        for (const parser of this.parsers.values()) {
          const parsed = parser(output, timestamp);
          events.push(...parsed);
        }
      }

      // Add server ID
      for (const event of events) {
        event.serverId = this.config.serverId;
      }

      // Apply aggregation if enabled
      if (this.config.aggregation && events.length > 0) {
        this.bufferForAggregation(events);
        return { success: true, events: [] }; // Events will be emitted after aggregation
      }

      return { success: true, events };
    } catch (error) {
      return {
        success: false,
        events: [],
        error: (error as Error).message,
      };
    }
  }

  /**
   * Buffer events for aggregation
   */
  private bufferForAggregation(events: SOAPEvent[]): void {
    for (const event of events) {
      const key = `${event.type}_${event.serverId}`;

      if (!this.aggregationBuffer.has(key)) {
        this.aggregationBuffer.set(key, []);
      }

      this.aggregationBuffer.get(key)!.push(event);

      // Set or reset aggregation timer
      if (this.aggregationTimers.has(key)) {
        clearTimeout(this.aggregationTimers.get(key)!);
      }

      const timer = setTimeout(() => {
        this.flushAggregation(key);
      }, this.config.aggregationWindow);

      this.aggregationTimers.set(key, timer);
    }
  }

  /**
   * Flush aggregated events
   */
  private flushAggregation(key: string): void {
    const events = this.aggregationBuffer.get(key);
    if (!events || events.length === 0) {
      return;
    }

    // Clear buffer and timer
    this.aggregationBuffer.delete(key);
    const timer = this.aggregationTimers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.aggregationTimers.delete(key);
    }

    // Aggregate events
    const aggregated = this.aggregateEvents(events);

    // Emit aggregated events
    for (const event of aggregated) {
      this.emit("event", event);
    }
  }

  /**
   * Aggregate events
   */
  private aggregateEvents(events: SOAPEvent[]): SOAPEvent[] {
    if (events.length === 1) {
      return events;
    }

    const eventType = events[0].type;

    // Type-specific aggregation
    switch (eventType) {
      case "player.chat":
        return this.aggregateChatEvents(events);

      case "combat.damage":
      case "combat.heal":
        return this.aggregateCombatEvents(events);

      case "server.players":
        return this.aggregatePlayerListEvents(events);

      default:
        // Default: keep all events
        return events;
    }
  }

  /**
   * Aggregate chat events
   */
  private aggregateChatEvents(events: SOAPEvent[]): SOAPEvent[] {
    // Group by channel
    const byChannel = new Map<string, SOAPEvent[]>();

    for (const event of events) {
      const channel = (event.data.channel as string) || "unknown";
      if (!byChannel.has(channel)) {
        byChannel.set(channel, []);
      }
      byChannel.get(channel)!.push(event);
    }

    // Create aggregated event per channel
    const aggregated: SOAPEvent[] = [];

    for (const [channel, channelEvents] of byChannel.entries()) {
      if (channelEvents.length === 1) {
        aggregated.push(channelEvents[0]);
      } else {
        aggregated.push({
          type: "player.chat.aggregated",
          timestamp: channelEvents[channelEvents.length - 1].timestamp,
          serverId: channelEvents[0].serverId,
          data: {
            channel,
            messages: channelEvents.map((e) => ({
              playerName: e.data.playerName,
              message: e.data.message,
              timestamp: e.timestamp,
            })),
            count: channelEvents.length,
          },
        });
      }
    }

    return aggregated;
  }

  /**
   * Aggregate combat events
   */
  private aggregateCombatEvents(events: SOAPEvent[]): SOAPEvent[] {
    // Group by source-target pair
    const pairs = new Map<string, SOAPEvent[]>();

    for (const event of events) {
      const key = `${event.data.source}_${event.data.target}`;
      if (!pairs.has(key)) {
        pairs.set(key, []);
      }
      pairs.get(key)!.push(event);
    }

    const aggregated: SOAPEvent[] = [];

    for (const pairEvents of pairs.values()) {
      if (pairEvents.length === 1) {
        aggregated.push(pairEvents[0]);
      } else {
        const totalAmount = pairEvents.reduce((sum, e) => sum + (e.data.amount as number), 0);

        aggregated.push({
          type: `${pairEvents[0].type}.aggregated`,
          timestamp: pairEvents[pairEvents.length - 1].timestamp,
          serverId: pairEvents[0].serverId,
          data: {
            source: pairEvents[0].data.source,
            target: pairEvents[0].data.target,
            totalAmount,
            count: pairEvents.length,
            events: pairEvents.map((e) => ({
              amount: e.data.amount,
              timestamp: e.timestamp,
            })),
          },
        });
      }
    }

    return aggregated;
  }

  /**
   * Aggregate player list events
   */
  private aggregatePlayerListEvents(events: SOAPEvent[]): SOAPEvent[] {
    // Use latest player list
    return [events[events.length - 1]];
  }

  /**
   * Add custom parser
   */
  public addParser(type: string, parser: EventParser): void {
    this.parsers.set(type, parser);
  }

  /**
   * Remove parser
   */
  public removeParser(type: string): void {
    this.parsers.delete(type);
  }

  /**
   * Flush all aggregations immediately
   */
  public flushAll(): void {
    for (const key of this.aggregationBuffer.keys()) {
      this.flushAggregation(key);
    }
  }

  /**
   * EventEmitter methods
   */
  private listeners: Map<string, Function[]> = new Map();

  public on(event: string, listener: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(listener);
  }

  private emit(event: string, data: unknown): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      for (const listener of listeners) {
        listener(data);
      }
    }
  }
}
