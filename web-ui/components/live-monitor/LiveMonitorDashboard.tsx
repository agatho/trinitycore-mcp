/**
 * Live Monitor Dashboard Component
 *
 * Real-time monitoring dashboard for TrinityCore SOAP events.
 * Displays live events, statistics, and filtering controls.
 *
 * @module LiveMonitorDashboard
 */

"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  TrinityWebSocketClient,
  ConnectionState,
  type WebSocketClientConfig,
} from "../../lib/websocket-client";
import type { SOAPEvent, EventFilter } from "../../../src/soap/websocket-server";

// ============================================================================
// Types
// ============================================================================

interface DashboardProps {
  /** WebSocket server URL */
  url: string;

  /** Authentication token */
  authToken?: string;

  /** Maximum events to display */
  maxEvents?: number;

  /** Enable auto-scroll */
  autoScroll?: boolean;
}

interface EventDisplayItem extends SOAPEvent {
  id: string;
  displayTime: string;
}

// ============================================================================
// Component
// ============================================================================

export default function LiveMonitorDashboard({
  url,
  authToken,
  maxEvents = 1000,
  autoScroll = true,
}: DashboardProps) {
  // WebSocket client
  const clientRef = useRef<TrinityWebSocketClient | null>(null);

  // State
  const [connectionState, setConnectionState] = useState<ConnectionState>(
    ConnectionState.DISCONNECTED,
  );
  const [events, setEvents] = useState<EventDisplayItem[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<EventDisplayItem | null>(null);
  const [eventTypes, setEventTypes] = useState<Set<string>>(new Set());
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set());
  const [filterText, setFilterText] = useState("");
  const [paused, setPaused] = useState(false);
  const [statistics, setStatistics] = useState({
    eventsReceived: 0,
    messagesSent: 0,
    reconnects: 0,
    errors: 0,
    uptime: 0,
    timeSinceLastEvent: 0,
  });

  // Refs
  const eventsEndRef = useRef<HTMLDivElement>(null);

  /**
   * Initialize WebSocket client
   */
  useEffect(() => {
    const config: WebSocketClientConfig = {
      url,
      authToken,
      autoReconnect: true,
      subscriptions: ["*"], // All events
    };

    const client = new TrinityWebSocketClient(config);
    clientRef.current = client;

    // Event handler
    client.on((event: SOAPEvent) => {
      if (paused) return;

      const displayEvent: EventDisplayItem = {
        ...event,
        id: `${event.timestamp}_${Math.random()}`,
        displayTime: new Date(event.timestamp).toLocaleTimeString(),
      };

      setEvents((prev) => {
        const updated = [...prev, displayEvent];
        if (updated.length > maxEvents) {
          updated.shift();
        }
        return updated;
      });

      // Track event types
      setEventTypes((prev) => new Set(prev).add(event.type));
    });

    // State change handler
    client.onStateChange((newState) => {
      setConnectionState(newState);
    });

    // Connect
    client.connect().catch((error) => {
      console.error("Failed to connect:", error);
    });

    // Update statistics periodically
    const statsInterval = setInterval(() => {
      if (client) {
        setStatistics(client.getStatistics());
      }
    }, 1000);

    // Cleanup
    return () => {
      clearInterval(statsInterval);
      client.disconnect();
    };
  }, [url, authToken, maxEvents, paused]);

  /**
   * Auto-scroll to bottom
   */
  useEffect(() => {
    if (autoScroll && !paused && eventsEndRef.current) {
      eventsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [events, autoScroll, paused]);

  /**
   * Filter events
   */
  const filteredEvents = useCallback(() => {
    let filtered = events;

    // Filter by type
    if (selectedTypes.size > 0) {
      filtered = filtered.filter((e) => selectedTypes.has(e.type));
    }

    // Filter by text
    if (filterText) {
      const lower = filterText.toLowerCase();
      filtered = filtered.filter(
        (e) =>
          e.type.toLowerCase().includes(lower) ||
          JSON.stringify(e.data).toLowerCase().includes(lower),
      );
    }

    return filtered;
  }, [events, selectedTypes, filterText]);

  /**
   * Toggle event type filter
   */
  const toggleEventType = (type: string) => {
    setSelectedTypes((prev) => {
      const updated = new Set(prev);
      if (updated.has(type)) {
        updated.delete(type);
      } else {
        updated.add(type);
      }
      return updated;
    });
  };

  /**
   * Clear events
   */
  const clearEvents = () => {
    setEvents([]);
    setSelectedEvent(null);
  };

  /**
   * Export events as JSON
   */
  const exportEvents = () => {
    const dataStr = JSON.stringify(events, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `trinity-events-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  /**
   * Get connection state color
   */
  const getStateColor = () => {
    switch (connectionState) {
      case ConnectionState.AUTHENTICATED:
        return "text-green-500";
      case ConnectionState.CONNECTING:
      case ConnectionState.AUTHENTICATING:
        return "text-yellow-500";
      case ConnectionState.ERROR:
        return "text-red-500";
      default:
        return "text-gray-500";
    }
  };

  /**
   * Get event type color
   */
  const getEventTypeColor = (type: string) => {
    if (type.includes("error") || type.includes("death")) return "text-red-400";
    if (type.includes("login") || type.includes("levelup")) return "text-green-400";
    if (type.includes("chat")) return "text-blue-400";
    if (type.includes("combat")) return "text-orange-400";
    return "text-gray-400";
  };

  const displayed = filteredEvents();

  return (
    <div className="flex h-screen bg-gray-900 text-gray-100">
      {/* Sidebar */}
      <div className="w-64 bg-gray-800 border-r border-gray-700 p-4 overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">Live Monitor</h2>

        {/* Connection Status */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold mb-2">Connection</h3>
          <div className={`text-sm ${getStateColor()}`}>{connectionState}</div>
        </div>

        {/* Statistics */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold mb-2">Statistics</h3>
          <div className="text-xs space-y-1">
            <div>Events: {statistics.eventsReceived}</div>
            <div>Messages: {statistics.messagesSent}</div>
            <div>Reconnects: {statistics.reconnects}</div>
            <div>Errors: {statistics.errors}</div>
            <div>Uptime: {Math.floor(statistics.uptime / 1000)}s</div>
          </div>
        </div>

        {/* Event Types Filter */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold mb-2">Event Types</h3>
          <div className="space-y-1">
            {Array.from(eventTypes).map((type) => (
              <label key={type} className="flex items-center text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedTypes.has(type)}
                  onChange={() => toggleEventType(type)}
                  className="mr-2"
                />
                <span className={getEventTypeColor(type)}>{type}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Controls */}
        <div className="space-y-2">
          <button
            onClick={() => setPaused(!paused)}
            className={`w-full px-3 py-2 rounded text-sm ${
              paused ? "bg-green-600 hover:bg-green-700" : "bg-yellow-600 hover:bg-yellow-700"
            }`}
          >
            {paused ? "Resume" : "Pause"}
          </button>

          <button
            onClick={clearEvents}
            className="w-full px-3 py-2 bg-red-600 hover:bg-red-700 rounded text-sm"
          >
            Clear Events
          </button>

          <button
            onClick={exportEvents}
            className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm"
          >
            Export JSON
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-gray-800 border-b border-gray-700 p-4">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold">TrinityCore Event Stream</h1>
            <div className="flex-1">
              <input
                type="text"
                placeholder="Filter events..."
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm"
              />
            </div>
            <div className="text-sm text-gray-400">
              {displayed.length} / {events.length} events
            </div>
          </div>
        </div>

        {/* Event List */}
        <div className="flex-1 flex overflow-hidden">
          {/* Events */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="space-y-2">
              {displayed.map((event) => (
                <div
                  key={event.id}
                  onClick={() => setSelectedEvent(event)}
                  className={`p-3 rounded cursor-pointer transition-colors ${
                    selectedEvent?.id === event.id
                      ? "bg-blue-900 border-blue-500"
                      : "bg-gray-800 hover:bg-gray-750"
                  } border border-gray-700`}
                >
                  <div className="flex items-start gap-3">
                    <div className="text-xs text-gray-500 w-20">{event.displayTime}</div>
                    <div className="flex-1">
                      <div className={`text-sm font-semibold ${getEventTypeColor(event.type)}`}>
                        {event.type}
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        {event.serverId && <span className="mr-2">Server: {event.serverId}</span>}
                        {Object.keys(event.data).length} fields
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              <div ref={eventsEndRef} />
            </div>
          </div>

          {/* Event Detail Panel */}
          {selectedEvent && (
            <div className="w-96 bg-gray-800 border-l border-gray-700 p-4 overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Event Details</h3>
                <button
                  onClick={() => setSelectedEvent(null)}
                  className="text-gray-400 hover:text-gray-200"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="text-xs text-gray-500 mb-1">Type</div>
                  <div className={`text-sm font-semibold ${getEventTypeColor(selectedEvent.type)}`}>
                    {selectedEvent.type}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-gray-500 mb-1">Timestamp</div>
                  <div className="text-sm">
                    {new Date(selectedEvent.timestamp).toLocaleString()}
                  </div>
                </div>

                {selectedEvent.serverId && (
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Server ID</div>
                    <div className="text-sm">{selectedEvent.serverId}</div>
                  </div>
                )}

                <div>
                  <div className="text-xs text-gray-500 mb-1">Data</div>
                  <pre className="text-xs bg-gray-900 p-2 rounded overflow-x-auto">
                    {JSON.stringify(selectedEvent.data, null, 2)}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
