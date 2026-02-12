/**
 * Live World Dashboard Page
 *
 * Comprehensive real-time monitoring dashboard for TrinityCore world state.
 * Connects via WebSocket for real-time events with automatic HTTP polling fallback.
 *
 * Sections:
 * - Connection status bar with live indicator
 * - Server health metrics (uptime, players, latency)
 * - Online players table with live updates
 * - Real-time event stream with filtering
 * - Event rate and distribution charts
 *
 * @module world-dashboard/page
 */

'use client';

import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  useWorldDashboard,
  type WorldEvent,
  type OnlinePlayer,
  type DashboardConnectionState,
} from '@/lib/hooks/useWorldDashboard';

// =============================================================================
// Connection Status Bar
// =============================================================================

function ConnectionStatusBar({
  state,
  error,
  lastUpdate,
  onConnect,
  onDisconnect,
  onRefresh,
}: {
  state: DashboardConnectionState;
  error: string | null;
  lastUpdate: number;
  onConnect: () => void;
  onDisconnect: () => void;
  onRefresh: () => Promise<void>;
}) {
  const stateConfig: Record<DashboardConnectionState, {
    label: string;
    color: string;
    dotColor: string;
    animate: boolean;
  }> = {
    'disconnected': { label: 'Disconnected', color: 'bg-gray-700', dotColor: 'bg-gray-400', animate: false },
    'connecting': { label: 'Connecting...', color: 'bg-yellow-900/50', dotColor: 'bg-yellow-400', animate: true },
    'connected-ws': { label: 'Live (WebSocket)', color: 'bg-green-900/50', dotColor: 'bg-green-400', animate: true },
    'connected-polling': { label: 'Polling (HTTP)', color: 'bg-blue-900/50', dotColor: 'bg-blue-400', animate: true },
    'error': { label: 'Error', color: 'bg-red-900/50', dotColor: 'bg-red-400', animate: false },
  };

  const cfg = stateConfig[state];
  const isConnected = state === 'connected-ws' || state === 'connected-polling';
  const timeSinceUpdate = lastUpdate > 0 ? Math.floor((Date.now() - lastUpdate) / 1000) : null;

  return (
    <div className={`${cfg.color} border-b border-gray-700 px-6 py-3`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative flex items-center">
            <div className={`w-2.5 h-2.5 rounded-full ${cfg.dotColor}`} />
            {cfg.animate && (
              <div className={`absolute w-2.5 h-2.5 rounded-full ${cfg.dotColor} animate-ping`} />
            )}
          </div>
          <span className="text-sm font-medium text-gray-200">{cfg.label}</span>
          {timeSinceUpdate !== null && (
            <span className="text-xs text-gray-500">
              Updated {timeSinceUpdate}s ago
            </span>
          )}
          {error && (
            <span className="text-xs text-yellow-400 ml-2">{error}</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isConnected && (
            <button
              onClick={onRefresh}
              className="px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded transition-colors"
              title="Force refresh"
            >
              Refresh
            </button>
          )}
          {isConnected ? (
            <button
              onClick={onDisconnect}
              className="px-3 py-1 text-xs bg-red-700 hover:bg-red-600 rounded transition-colors"
            >
              Disconnect
            </button>
          ) : (
            <button
              onClick={onConnect}
              className="px-3 py-1 text-xs bg-green-700 hover:bg-green-600 rounded transition-colors"
            >
              Connect
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Server Health Cards
// =============================================================================

function ServerHealthCards({
  serverStatus,
  metrics,
  connectionState,
}: {
  serverStatus: { online: boolean; uptime: number; uptimeFormatted: string; playersOnline: number; peakPlayers: number; averageLatency: number; worldServerVersion?: string };
  metrics: { eventsPerSecond: number; totalEvents: number };
  connectionState: DashboardConnectionState;
}) {
  const cards = [
    {
      label: 'Server Status',
      value: serverStatus.online ? 'Online' : 'Offline',
      color: serverStatus.online ? 'text-green-400' : 'text-red-400',
      sub: serverStatus.uptimeFormatted ? `Uptime: ${serverStatus.uptimeFormatted}` : undefined,
    },
    {
      label: 'Players Online',
      value: String(serverStatus.playersOnline),
      color: 'text-blue-400',
      sub: `Peak: ${serverStatus.peakPlayers}`,
    },
    {
      label: 'Event Rate',
      value: `${metrics.eventsPerSecond.toFixed(1)}/s`,
      color: 'text-purple-400',
      sub: `Total: ${metrics.totalEvents}`,
    },
    {
      label: 'Connection',
      value: connectionState === 'connected-ws' ? 'WebSocket' : connectionState === 'connected-polling' ? 'HTTP Poll' : 'None',
      color: connectionState.startsWith('connected') ? 'text-green-400' : 'text-gray-400',
      sub: serverStatus.averageLatency > 0 ? `Latency: ${serverStatus.averageLatency}ms` : undefined,
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 p-6">
      {cards.map((card) => (
        <div
          key={card.label}
          className="bg-gray-800 border border-gray-700 rounded-lg p-4"
        >
          <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">
            {card.label}
          </div>
          <div className={`text-2xl font-bold ${card.color}`}>
            {card.value}
          </div>
          {card.sub && (
            <div className="text-xs text-gray-500 mt-1">{card.sub}</div>
          )}
        </div>
      ))}
    </div>
  );
}

// =============================================================================
// Online Players Table
// =============================================================================

function OnlinePlayersTable({ players }: { players: OnlinePlayer[] }) {
  const [sortField, setSortField] = useState<keyof OnlinePlayer>('name');
  const [sortAsc, setSortAsc] = useState(true);

  const sortedPlayers = useMemo(() => {
    return [...players].sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortAsc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortAsc ? aVal - bVal : bVal - aVal;
      }
      return 0;
    });
  }, [players, sortField, sortAsc]);

  const toggleSort = (field: keyof OnlinePlayer) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const SortHeader = ({ field, label }: { field: keyof OnlinePlayer; label: string }) => (
    <th
      className="px-3 py-2 text-left text-xs font-semibold text-gray-400 uppercase cursor-pointer hover:text-gray-200 select-none"
      onClick={() => toggleSort(field)}
    >
      {label} {sortField === field ? (sortAsc ? '\u2191' : '\u2193') : ''}
    </th>
  );

  if (players.length === 0) {
    return (
      <div className="text-center text-gray-500 py-8 text-sm">
        No players online
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-700">
            <SortHeader field="name" label="Name" />
            <SortHeader field="level" label="Level" />
            <SortHeader field="race" label="Race" />
            <SortHeader field="class" label="Class" />
            <SortHeader field="zone" label="Zone" />
          </tr>
        </thead>
        <tbody>
          {sortedPlayers.map((player) => (
            <tr
              key={player.guid || player.name}
              className="border-b border-gray-800 hover:bg-gray-800/50 transition-colors"
            >
              <td className="px-3 py-2 font-medium text-gray-200">{player.name}</td>
              <td className="px-3 py-2 text-gray-300">{player.level}</td>
              <td className="px-3 py-2 text-gray-400">{player.race}</td>
              <td className="px-3 py-2 text-gray-400">{player.class}</td>
              <td className="px-3 py-2 text-gray-400">{player.zone}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// =============================================================================
// Event Stream Panel
// =============================================================================

function EventStreamPanel({
  events,
  isPaused,
  onPause,
  onResume,
  onClear,
}: {
  events: WorldEvent[];
  isPaused: boolean;
  onPause: () => void;
  onResume: () => void;
  onClear: () => void;
}) {
  const [filterText, setFilterText] = useState('');
  const [filterType, setFilterType] = useState<string>('');
  const [selectedEvent, setSelectedEvent] = useState<WorldEvent | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (!isPaused && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events.length, isPaused]);

  // Collect unique event types
  const eventTypes = useMemo(() => {
    const types = new Set<string>();
    for (const event of events) {
      types.add(event.type);
    }
    return Array.from(types).sort();
  }, [events]);

  // Filter events
  const filteredEvents = useMemo(() => {
    let filtered = events;

    if (filterType) {
      filtered = filtered.filter(e => e.type === filterType);
    }

    if (filterText) {
      const lower = filterText.toLowerCase();
      filtered = filtered.filter(e =>
        e.type.toLowerCase().includes(lower) ||
        JSON.stringify(e.data).toLowerCase().includes(lower)
      );
    }

    return filtered;
  }, [events, filterType, filterText]);

  const getEventColor = (type: string): string => {
    if (type.includes('error') || type.includes('death')) return 'text-red-400';
    if (type.includes('login') || type.includes('levelup')) return 'text-green-400';
    if (type.includes('logout')) return 'text-orange-400';
    if (type.includes('chat')) return 'text-blue-400';
    if (type.includes('combat')) return 'text-yellow-400';
    if (type.includes('server')) return 'text-purple-400';
    return 'text-gray-400';
  };

  const exportEvents = useCallback(() => {
    const dataStr = JSON.stringify(filteredEvents, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `world-events-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }, [filteredEvents]);

  return (
    <div className="flex flex-col h-full">
      {/* Controls */}
      <div className="flex items-center gap-2 p-3 border-b border-gray-700 flex-shrink-0">
        <input
          type="text"
          placeholder="Filter events..."
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          className="flex-1 px-2 py-1 text-xs bg-gray-700 border border-gray-600 rounded"
        />
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="px-2 py-1 text-xs bg-gray-700 border border-gray-600 rounded"
        >
          <option value="">All types</option>
          {eventTypes.map(t => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <button
          onClick={isPaused ? onResume : onPause}
          className={`px-2 py-1 text-xs rounded ${
            isPaused ? 'bg-green-700 hover:bg-green-600' : 'bg-yellow-700 hover:bg-yellow-600'
          }`}
        >
          {isPaused ? 'Resume' : 'Pause'}
        </button>
        <button
          onClick={onClear}
          className="px-2 py-1 text-xs bg-red-700 hover:bg-red-600 rounded"
        >
          Clear
        </button>
        <button
          onClick={exportEvents}
          className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded"
          title="Export as JSON"
        >
          Export
        </button>
      </div>

      {/* Event counts */}
      <div className="px-3 py-1 text-xs text-gray-500 border-b border-gray-800 flex-shrink-0">
        {filteredEvents.length} / {events.length} events
        {isPaused && <span className="ml-2 text-yellow-500">(paused)</span>}
      </div>

      {/* Event list */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-2 space-y-1"
      >
        {filteredEvents.length === 0 ? (
          <div className="text-center text-gray-600 py-8 text-xs">
            {events.length === 0 ? 'Waiting for events...' : 'No matching events'}
          </div>
        ) : (
          filteredEvents.slice(-200).map((event) => (
            <div
              key={event.id}
              onClick={() => setSelectedEvent(selectedEvent?.id === event.id ? null : event)}
              className={`px-2 py-1.5 rounded cursor-pointer text-xs font-mono transition-colors ${
                selectedEvent?.id === event.id
                  ? 'bg-blue-900/50 border border-blue-700'
                  : 'hover:bg-gray-800 border border-transparent'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-gray-600 w-16 flex-shrink-0">
                  {new Date(event.timestamp).toLocaleTimeString()}
                </span>
                <span className={`font-semibold ${getEventColor(event.type)}`}>
                  {event.type}
                </span>
                <span className="text-gray-600 text-[10px]">
                  [{event.source === 'websocket' ? 'WS' : 'HTTP'}]
                </span>
                <span className="text-gray-500 truncate flex-1">
                  {Object.entries(event.data).slice(0, 3).map(([k, v]) => `${k}=${String(v)}`).join(' ')}
                </span>
              </div>

              {/* Expanded detail */}
              {selectedEvent?.id === event.id && (
                <pre className="mt-2 p-2 bg-gray-900 rounded text-[10px] text-gray-400 overflow-x-auto">
                  {JSON.stringify(event.data, null, 2)}
                </pre>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Event Distribution Mini Chart
// =============================================================================

function EventDistributionChart({
  eventsByType,
}: {
  eventsByType: Map<string, number>;
}) {
  const entries = useMemo(() => {
    return Array.from(eventsByType.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
  }, [eventsByType]);

  const maxCount = entries.length > 0 ? entries[0][1] : 1;

  const colors = [
    'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-yellow-500',
    'bg-red-500', 'bg-pink-500', 'bg-cyan-500', 'bg-orange-500',
  ];

  if (entries.length === 0) {
    return (
      <div className="text-center text-gray-600 py-4 text-xs">
        No event data yet
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {entries.map(([type, count], i) => (
        <div key={type} className="flex items-center gap-2 text-xs">
          <span className="text-gray-400 w-32 truncate text-right" title={type}>
            {type.split('.').pop() || type}
          </span>
          <div className="flex-1 h-4 bg-gray-700 rounded overflow-hidden">
            <div
              className={`h-full ${colors[i % colors.length]} rounded transition-all duration-300`}
              style={{ width: `${(count / maxCount) * 100}%` }}
            />
          </div>
          <span className="text-gray-500 w-8 text-right">{count}</span>
        </div>
      ))}
    </div>
  );
}

// =============================================================================
// Main Dashboard Page
// =============================================================================

export default function WorldDashboardPage() {
  const [state, actions] = useWorldDashboard({
    pollingInterval: 5000,
    maxEvents: 500,
    autoConnect: true,
  });

  // Time ticker to update "X seconds ago"
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 flex flex-col">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Live World Dashboard</h1>
            <p className="text-sm text-gray-400 mt-1">
              Real-time TrinityCore server monitoring with WebSocket
            </p>
          </div>
          <div className="text-right">
            <div className="text-xs text-gray-500">
              {state.serverStatus.worldServerVersion || 'TrinityCore'}
            </div>
          </div>
        </div>
      </div>

      {/* Connection Status */}
      <ConnectionStatusBar
        state={state.connectionState}
        error={state.error}
        lastUpdate={state.lastUpdate}
        onConnect={actions.connect}
        onDisconnect={actions.disconnect}
        onRefresh={actions.refresh}
      />

      {/* Health Cards */}
      <ServerHealthCards
        serverStatus={state.serverStatus}
        metrics={state.metrics}
        connectionState={state.connectionState}
      />

      {/* Main Content Grid */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 p-6 pt-0 min-h-0">
        {/* Left Column: Players + Event Distribution */}
        <div className="flex flex-col gap-4">
          {/* Online Players */}
          <div className="bg-gray-800 border border-gray-700 rounded-lg flex-1 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-700">
              <h2 className="text-sm font-semibold">
                Online Players ({state.players.length})
              </h2>
            </div>
            <div className="overflow-y-auto max-h-80">
              <OnlinePlayersTable players={state.players} />
            </div>
          </div>

          {/* Event Distribution */}
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
            <h2 className="text-sm font-semibold mb-3">Event Distribution (1m)</h2>
            <EventDistributionChart eventsByType={state.metrics.eventsByType} />
          </div>
        </div>

        {/* Right Column: Event Stream (spans 2 cols on large screens) */}
        <div className="lg:col-span-2 bg-gray-800 border border-gray-700 rounded-lg overflow-hidden flex flex-col min-h-[500px]">
          <div className="px-4 py-3 border-b border-gray-700 flex-shrink-0">
            <h2 className="text-sm font-semibold">Event Stream</h2>
          </div>
          <EventStreamPanel
            events={state.events}
            isPaused={actions.isPaused}
            onPause={actions.pauseEvents}
            onResume={actions.resumeEvents}
            onClear={actions.clearEvents}
          />
        </div>
      </div>
    </div>
  );
}
