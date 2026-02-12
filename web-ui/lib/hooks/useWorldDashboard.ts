/**
 * Live World Dashboard Hook
 *
 * Manages real-time world state via WebSocket with automatic HTTP polling fallback.
 * Provides a unified interface for dashboard components regardless of connection method.
 *
 * Data flow:
 * 1. Attempts WebSocket connection for real-time events
 * 2. Falls back to HTTP polling if WebSocket unavailable
 * 3. Maintains consistent world state from either source
 *
 * @module hooks/useWorldDashboard
 */

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

// =============================================================================
// Types
// =============================================================================

/** Online player information */
export interface OnlinePlayer {
  guid: number;
  name: string;
  level: number;
  race: string;
  class: string;
  zone: string;
  map?: number;
  x?: number;
  y?: number;
  z?: number;
  lastSeen: number;
}

/** Server status information */
export interface ServerStatus {
  online: boolean;
  uptime: number;
  uptimeFormatted: string;
  playersOnline: number;
  peakPlayers: number;
  averageLatency: number;
  worldServerVersion?: string;
}

/** World event from WebSocket or polling */
export interface WorldEvent {
  id: string;
  type: string;
  timestamp: number;
  data: Record<string, unknown>;
  source: 'websocket' | 'polling';
}

/** Event rate metrics */
export interface EventMetrics {
  eventsPerSecond: number;
  eventsByType: Map<string, number>;
  totalEvents: number;
  windowSize: number;
}

/** Connection state for the dashboard */
export type DashboardConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected-ws'
  | 'connected-polling'
  | 'error';

/** Dashboard configuration */
export interface DashboardConfig {
  /** WebSocket server URL */
  wsUrl?: string;
  /** WebSocket auth token */
  wsAuthToken?: string;
  /** HTTP polling interval in ms (default: 5000) */
  pollingInterval?: number;
  /** Maximum events to retain (default: 500) */
  maxEvents?: number;
  /** Event metrics window in ms (default: 60000) */
  metricsWindow?: number;
  /** Whether to auto-connect on mount (default: true) */
  autoConnect?: boolean;
}

/** Complete world dashboard state */
export interface WorldDashboardState {
  connectionState: DashboardConnectionState;
  serverStatus: ServerStatus;
  players: OnlinePlayer[];
  events: WorldEvent[];
  metrics: EventMetrics;
  error: string | null;
  lastUpdate: number;
}

/** Dashboard actions */
export interface WorldDashboardActions {
  connect: () => void;
  disconnect: () => void;
  clearEvents: () => void;
  refresh: () => Promise<void>;
  pauseEvents: () => void;
  resumeEvents: () => void;
  isPaused: boolean;
}

// =============================================================================
// Default Values
// =============================================================================

const DEFAULT_SERVER_STATUS: ServerStatus = {
  online: false,
  uptime: 0,
  uptimeFormatted: '0s',
  playersOnline: 0,
  peakPlayers: 0,
  averageLatency: 0,
};

const DEFAULT_METRICS: EventMetrics = {
  eventsPerSecond: 0,
  eventsByType: new Map(),
  totalEvents: 0,
  windowSize: 60000,
};

// =============================================================================
// Utility Functions
// =============================================================================

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  parts.push(`${secs}s`);
  return parts.join(' ');
}

function generateEventId(): string {
  return `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// =============================================================================
// Hook Implementation
// =============================================================================

export function useWorldDashboard(
  config: DashboardConfig = {}
): [WorldDashboardState, WorldDashboardActions] {
  const {
    wsUrl = `ws://localhost:${typeof window !== 'undefined' ? '3001' : '3001'}/ws/soap-events`,
    wsAuthToken,
    pollingInterval = 5000,
    maxEvents = 500,
    metricsWindow = 60000,
    autoConnect = true,
  } = config;

  // State
  const [connectionState, setConnectionState] = useState<DashboardConnectionState>('disconnected');
  const [serverStatus, setServerStatus] = useState<ServerStatus>(DEFAULT_SERVER_STATUS);
  const [players, setPlayers] = useState<OnlinePlayer[]>([]);
  const [events, setEvents] = useState<WorldEvent[]>([]);
  const [metrics, setMetrics] = useState<EventMetrics>(DEFAULT_METRICS);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<number>(0);
  const [paused, setPaused] = useState(false);

  // Refs for cleanup and non-reactive values
  const wsRef = useRef<WebSocket | null>(null);
  const pollingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const metricsTimerRef = useRef<NodeJS.Timeout | null>(null);
  const eventsRef = useRef<WorldEvent[]>([]);
  const pausedRef = useRef(false);
  const peakPlayersRef = useRef(0);

  // Keep refs in sync
  useEffect(() => { eventsRef.current = events; }, [events]);
  useEffect(() => { pausedRef.current = paused; }, [paused]);

  // =====================================================================
  // Event Management
  // =====================================================================

  const addEvent = useCallback((event: WorldEvent) => {
    if (pausedRef.current) return;

    setEvents(prev => {
      const updated = [...prev, event];
      if (updated.length > maxEvents) {
        return updated.slice(updated.length - maxEvents);
      }
      return updated;
    });
  }, [maxEvents]);

  const clearEvents = useCallback(() => {
    setEvents([]);
  }, []);

  // =====================================================================
  // Metrics Calculation
  // =====================================================================

  const updateMetrics = useCallback(() => {
    const now = Date.now();
    const cutoff = now - metricsWindow;
    const recentEvents = eventsRef.current.filter(e => e.timestamp >= cutoff);

    const eventsByType = new Map<string, number>();
    for (const event of recentEvents) {
      eventsByType.set(event.type, (eventsByType.get(event.type) || 0) + 1);
    }

    setMetrics({
      eventsPerSecond: recentEvents.length / (metricsWindow / 1000),
      eventsByType,
      totalEvents: eventsRef.current.length,
      windowSize: metricsWindow,
    });
  }, [metricsWindow]);

  // =====================================================================
  // HTTP Polling Fallback
  // =====================================================================

  const fetchViaPolling = useCallback(async () => {
    try {
      const [playersRes, statusRes] = await Promise.allSettled([
        fetch('/api/soap?action=players'),
        fetch('/api/soap?action=status'),
      ]);

      const now = Date.now();

      // Process players
      if (playersRes.status === 'fulfilled' && playersRes.value.ok) {
        const data = await playersRes.value.json();
        if (data.players && Array.isArray(data.players)) {
          const playerList: OnlinePlayer[] = data.players.map((p: Record<string, unknown>) => ({
            guid: (p.guid as number) || 0,
            name: (p.name as string) || 'Unknown',
            level: (p.level as number) || 1,
            race: (p.race as string) || 'Unknown',
            class: (p.class as string) || 'Unknown',
            zone: (p.zone as string) || 'Unknown',
            map: p.map as number | undefined,
            lastSeen: now,
          }));
          setPlayers(playerList);

          if (playerList.length > peakPlayersRef.current) {
            peakPlayersRef.current = playerList.length;
          }

          // Generate player count event
          addEvent({
            id: generateEventId(),
            type: 'server.players',
            timestamp: now,
            data: { count: playerList.length, names: playerList.map(p => p.name) },
            source: 'polling',
          });
        }
      }

      // Process server status
      if (statusRes.status === 'fulfilled' && statusRes.value.ok) {
        const data = await statusRes.value.json();
        if (data.status) {
          const uptimeSec = (data.status.uptime as number) || 0;
          setServerStatus({
            online: true,
            uptime: uptimeSec,
            uptimeFormatted: formatUptime(uptimeSec),
            playersOnline: (data.status.playerCount as number) || players.length,
            peakPlayers: Math.max(peakPlayersRef.current, (data.status.peakPlayers as number) || 0),
            averageLatency: (data.status.avgLatency as number) || 0,
            worldServerVersion: data.status.version as string | undefined,
          });
        }
      }

      setLastUpdate(now);
      setError(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Polling failed';
      setError(msg);
    }
  }, [addEvent, players.length]);

  const startPolling = useCallback(() => {
    // Initial fetch
    fetchViaPolling();

    // Start interval
    pollingTimerRef.current = setInterval(fetchViaPolling, pollingInterval);
    setConnectionState('connected-polling');
  }, [fetchViaPolling, pollingInterval]);

  const stopPolling = useCallback(() => {
    if (pollingTimerRef.current) {
      clearInterval(pollingTimerRef.current);
      pollingTimerRef.current = null;
    }
  }, []);

  // =====================================================================
  // WebSocket Connection
  // =====================================================================

  const connectWebSocket = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      return; // Already connected
    }

    setConnectionState('connecting');
    setError(null);

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnectionState('connected-ws');
        setError(null);

        // Authenticate if token provided
        if (wsAuthToken) {
          ws.send(JSON.stringify({
            type: 'auth',
            data: { token: wsAuthToken },
            timestamp: Date.now(),
          }));
        }

        // Subscribe to all events
        ws.send(JSON.stringify({
          type: 'subscribe',
          data: { events: ['*'] },
          timestamp: Date.now(),
        }));

        // Stop polling since WS is working
        stopPolling();
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);

          if (message.type === 'event' && message.data) {
            const wsEvent: WorldEvent = {
              id: generateEventId(),
              type: message.data.type || 'unknown',
              timestamp: message.data.timestamp || Date.now(),
              data: message.data.data || {},
              source: 'websocket',
            };

            addEvent(wsEvent);

            // Update player data from specific event types
            if (wsEvent.type === 'server.players' || wsEvent.type === 'account.onlinelist') {
              const playerData = wsEvent.data.players || wsEvent.data.list;
              if (Array.isArray(playerData)) {
                const now = Date.now();
                const playerList: OnlinePlayer[] = playerData.map((p: Record<string, unknown>) => ({
                  guid: (p.guid as number) || 0,
                  name: (p.name as string) || 'Unknown',
                  level: (p.level as number) || 1,
                  race: (p.race as string) || 'Unknown',
                  class: (p.class as string) || 'Unknown',
                  zone: (p.zone as string) || 'Unknown',
                  map: p.map as number | undefined,
                  lastSeen: now,
                }));
                setPlayers(playerList);
                if (playerList.length > peakPlayersRef.current) {
                  peakPlayersRef.current = playerList.length;
                }
              }
            }

            // Update server info from server events
            if (wsEvent.type === 'server.info') {
              const uptimeSec = (wsEvent.data.uptime as number) || 0;
              setServerStatus(prev => ({
                ...prev,
                online: true,
                uptime: uptimeSec,
                uptimeFormatted: formatUptime(uptimeSec),
                playersOnline: (wsEvent.data.playerCount as number) || prev.playersOnline,
              }));
            }

            setLastUpdate(Date.now());
          }
        } catch {
          // Silently ignore parse errors for non-JSON messages
        }
      };

      ws.onerror = () => {
        // WebSocket failed - fall back to polling
        setError('WebSocket connection failed, using HTTP polling');
        startPolling();
      };

      ws.onclose = () => {
        wsRef.current = null;
        // If we were connected via WS, fall back to polling
        if (connectionState === 'connected-ws') {
          setError('WebSocket disconnected, falling back to HTTP polling');
          startPolling();
        }
      };
    } catch {
      // WebSocket constructor failed - fall back to polling
      setError('WebSocket unavailable, using HTTP polling');
      startPolling();
    }
  }, [wsUrl, wsAuthToken, connectionState, addEvent, startPolling, stopPolling]);

  const disconnectWebSocket = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  // =====================================================================
  // Public Actions
  // =====================================================================

  const connect = useCallback(() => {
    connectWebSocket();
  }, [connectWebSocket]);

  const disconnect = useCallback(() => {
    disconnectWebSocket();
    stopPolling();
    setConnectionState('disconnected');
  }, [disconnectWebSocket, stopPolling]);

  const refresh = useCallback(async () => {
    await fetchViaPolling();
  }, [fetchViaPolling]);

  const pauseEvents = useCallback(() => setPaused(true), []);
  const resumeEvents = useCallback(() => setPaused(false), []);

  // =====================================================================
  // Lifecycle
  // =====================================================================

  // Auto-connect on mount
  useEffect(() => {
    if (autoConnect) {
      // Try WebSocket first, fall back to polling
      connectWebSocket();
    }

    // Start metrics timer
    metricsTimerRef.current = setInterval(updateMetrics, 1000);

    return () => {
      // Cleanup on unmount
      disconnectWebSocket();
      stopPolling();
      if (metricsTimerRef.current) {
        clearInterval(metricsTimerRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // =====================================================================
  // Return State and Actions
  // =====================================================================

  const state: WorldDashboardState = {
    connectionState,
    serverStatus,
    players,
    events,
    metrics,
    error,
    lastUpdate,
  };

  const actions: WorldDashboardActions = {
    connect,
    disconnect,
    clearEvents,
    refresh,
    pauseEvents,
    resumeEvents,
    isPaused: paused,
  };

  return [state, actions];
}
