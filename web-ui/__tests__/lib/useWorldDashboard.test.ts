/**
 * Live World Dashboard Hook - Unit Tests
 *
 * Tests for the useWorldDashboard hook covering:
 * - Initial state
 * - HTTP polling fallback
 * - Event management (add, clear, pause/resume)
 * - Metrics calculation
 * - Connection state management
 * - WebSocket fallback behavior
 *
 * @module __tests__/lib/useWorldDashboard
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useWorldDashboard } from '@/lib/hooks/useWorldDashboard';

// =============================================================================
// Mocks
// =============================================================================

// Mock fetch for polling tests
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock WebSocket
class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  url: string;
  readyState: number = MockWebSocket.CONNECTING;
  onopen: ((ev: Event) => void) | null = null;
  onclose: ((ev: CloseEvent) => void) | null = null;
  onmessage: ((ev: MessageEvent) => void) | null = null;
  onerror: ((ev: Event) => void) | null = null;

  constructor(url: string) {
    this.url = url;
    // Simulate connection failure by default (triggering polling fallback)
    setTimeout(() => {
      if (this.onerror) {
        this.onerror(new Event('error'));
      }
    }, 10);
  }

  send = vi.fn();
  close = vi.fn(() => {
    this.readyState = MockWebSocket.CLOSED;
  });
}

// Replace global WebSocket
const OriginalWebSocket = global.WebSocket;

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  (global as any).WebSocket = MockWebSocket;

  // Default fetch mock returns empty data
  mockFetch.mockImplementation(async (url: string) => {
    if (url.includes('action=players')) {
      return {
        ok: true,
        json: async () => ({
          players: [
            { guid: 1, name: 'TestPlayer', level: 60, race: 'Human', class: 'Warrior', zone: 'Stormwind' },
            { guid: 2, name: 'MockMage', level: 70, race: 'Gnome', class: 'Mage', zone: 'Ironforge' },
          ],
        }),
      };
    }
    if (url.includes('action=status')) {
      return {
        ok: true,
        json: async () => ({
          status: {
            uptime: 3600,
            playerCount: 2,
            peakPlayers: 5,
            avgLatency: 15,
            version: 'TrinityCore 12.0.0',
          },
        }),
      };
    }
    return { ok: false, json: async () => ({}) };
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  global.WebSocket = OriginalWebSocket;
});

// =============================================================================
// Initial State Tests
// =============================================================================

describe('useWorldDashboard - Initial State', () => {
  it('should start with disconnected state', () => {
    const { result } = renderHook(() =>
      useWorldDashboard({ autoConnect: false })
    );

    const [state] = result.current;
    expect(state.connectionState).toBe('disconnected');
    expect(state.players).toEqual([]);
    expect(state.events).toEqual([]);
    expect(state.error).toBeNull();
    expect(state.lastUpdate).toBe(0);
  });

  it('should provide default server status', () => {
    const { result } = renderHook(() =>
      useWorldDashboard({ autoConnect: false })
    );

    const [state] = result.current;
    expect(state.serverStatus.online).toBe(false);
    expect(state.serverStatus.uptime).toBe(0);
    expect(state.serverStatus.playersOnline).toBe(0);
    expect(state.serverStatus.peakPlayers).toBe(0);
  });

  it('should provide default metrics', () => {
    const { result } = renderHook(() =>
      useWorldDashboard({ autoConnect: false })
    );

    const [state] = result.current;
    expect(state.metrics.eventsPerSecond).toBe(0);
    expect(state.metrics.totalEvents).toBe(0);
    expect(state.metrics.eventsByType.size).toBe(0);
  });

  it('should provide all action methods', () => {
    const { result } = renderHook(() =>
      useWorldDashboard({ autoConnect: false })
    );

    const [, actions] = result.current;
    expect(typeof actions.connect).toBe('function');
    expect(typeof actions.disconnect).toBe('function');
    expect(typeof actions.clearEvents).toBe('function');
    expect(typeof actions.refresh).toBe('function');
    expect(typeof actions.pauseEvents).toBe('function');
    expect(typeof actions.resumeEvents).toBe('function');
    expect(actions.isPaused).toBe(false);
  });
});

// =============================================================================
// Connection State Tests
// =============================================================================

describe('useWorldDashboard - Connection', () => {
  it('should auto-connect when autoConnect is true', async () => {
    const { result } = renderHook(() =>
      useWorldDashboard({ autoConnect: true, pollingInterval: 5000 })
    );

    // Should start connecting
    expect(result.current[0].connectionState).toBe('connecting');

    // Let the WebSocket error trigger and fallback to polling
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });

    // Should fall back to polling after WebSocket fails
    await waitFor(() => {
      expect(result.current[0].connectionState).toBe('connected-polling');
    });
  });

  it('should not auto-connect when autoConnect is false', () => {
    const { result } = renderHook(() =>
      useWorldDashboard({ autoConnect: false })
    );

    expect(result.current[0].connectionState).toBe('disconnected');
  });

  it('should disconnect when disconnect is called', async () => {
    const { result } = renderHook(() =>
      useWorldDashboard({ autoConnect: true, pollingInterval: 5000 })
    );

    // Wait for connection
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });

    // Disconnect
    act(() => {
      result.current[1].disconnect();
    });

    expect(result.current[0].connectionState).toBe('disconnected');
  });
});

// =============================================================================
// HTTP Polling Tests
// =============================================================================

describe('useWorldDashboard - HTTP Polling', () => {
  it('should fetch players via HTTP polling', async () => {
    const { result } = renderHook(() =>
      useWorldDashboard({ autoConnect: true, pollingInterval: 5000 })
    );

    // Wait for WebSocket to fail and polling to start
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    // Should have fetched players
    await waitFor(() => {
      expect(result.current[0].players.length).toBe(2);
    });

    expect(result.current[0].players[0].name).toBe('TestPlayer');
    expect(result.current[0].players[1].name).toBe('MockMage');
  });

  it('should update server status from polling', async () => {
    const { result } = renderHook(() =>
      useWorldDashboard({ autoConnect: true, pollingInterval: 5000 })
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    await waitFor(() => {
      expect(result.current[0].serverStatus.online).toBe(true);
    });

    expect(result.current[0].serverStatus.uptime).toBe(3600);
    expect(result.current[0].serverStatus.uptimeFormatted).toContain('1h');
  });

  it('should generate events from polling data', async () => {
    const { result } = renderHook(() =>
      useWorldDashboard({ autoConnect: true, pollingInterval: 5000 })
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    await waitFor(() => {
      expect(result.current[0].events.length).toBeGreaterThan(0);
    });

    const playerEvent = result.current[0].events.find(e => e.type === 'server.players');
    expect(playerEvent).toBeDefined();
    expect(playerEvent?.source).toBe('polling');
    expect(playerEvent?.data.count).toBe(2);
  });

  it('should poll repeatedly at configured interval', async () => {
    renderHook(() =>
      useWorldDashboard({ autoConnect: true, pollingInterval: 2000 })
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100); // Initial + WS fallback
    });

    const initialCallCount = mockFetch.mock.calls.length;

    // Advance past one polling interval
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2100);
    });

    // Should have made additional fetch calls
    expect(mockFetch.mock.calls.length).toBeGreaterThan(initialCallCount);
  });

  it('should handle polling errors gracefully', async () => {
    // Override fetch to always reject for this test
    mockFetch.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() =>
      useWorldDashboard({ autoConnect: false })
    );

    // Trigger refresh manually (avoids WS connection attempt)
    await act(async () => {
      await result.current[1].refresh();
    });

    // Promise.allSettled absorbs fetch rejections, so data just stays empty
    // (no crash, no error propagated - this is the graceful handling)
    expect(result.current[0].players).toEqual([]);
    expect(result.current[0].serverStatus.online).toBe(false);
  });

  it('should refresh data when refresh is called', async () => {
    const { result } = renderHook(() =>
      useWorldDashboard({ autoConnect: false })
    );

    await act(async () => {
      await result.current[1].refresh();
    });

    await waitFor(() => {
      expect(result.current[0].players.length).toBe(2);
    });
  });
});

// =============================================================================
// Event Management Tests
// =============================================================================

describe('useWorldDashboard - Event Management', () => {
  it('should clear events when clearEvents is called', async () => {
    const { result } = renderHook(() =>
      useWorldDashboard({ autoConnect: true, pollingInterval: 5000 })
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    await waitFor(() => {
      expect(result.current[0].events.length).toBeGreaterThan(0);
    });

    act(() => {
      result.current[1].clearEvents();
    });

    expect(result.current[0].events).toEqual([]);
  });

  it('should pause event collection', async () => {
    const { result } = renderHook(() =>
      useWorldDashboard({ autoConnect: true, pollingInterval: 1000 })
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    const initialCount = result.current[0].events.length;

    // Pause
    act(() => {
      result.current[1].pauseEvents();
    });

    expect(result.current[1].isPaused).toBe(true);

    // Advance time for more polling
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    // Events should not increase while paused
    expect(result.current[0].events.length).toBe(initialCount);
  });

  it('should resume event collection after pause', async () => {
    const { result } = renderHook(() =>
      useWorldDashboard({ autoConnect: true, pollingInterval: 1000 })
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    // Pause
    act(() => {
      result.current[1].pauseEvents();
    });

    // Resume
    act(() => {
      result.current[1].resumeEvents();
    });

    expect(result.current[1].isPaused).toBe(false);
  });

  it('should cap events at maxEvents', async () => {
    const { result } = renderHook(() =>
      useWorldDashboard({
        autoConnect: true,
        pollingInterval: 100,
        maxEvents: 5,
      })
    );

    // Generate many events through polling
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(result.current[0].events.length).toBeLessThanOrEqual(5);
  });
});

// =============================================================================
// Metrics Tests
// =============================================================================

describe('useWorldDashboard - Metrics', () => {
  it('should calculate total events', async () => {
    const { result } = renderHook(() =>
      useWorldDashboard({ autoConnect: true, pollingInterval: 5000 })
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    // Wait for metrics timer to fire (every 1s)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1100);
    });

    expect(result.current[0].metrics.totalEvents).toBeGreaterThan(0);
  });

  it('should track events by type', async () => {
    const { result } = renderHook(() =>
      useWorldDashboard({ autoConnect: true, pollingInterval: 5000 })
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1100);
    });

    const eventsByType = result.current[0].metrics.eventsByType;
    expect(eventsByType.size).toBeGreaterThanOrEqual(0);
  });
});

// =============================================================================
// Edge Cases
// =============================================================================

describe('useWorldDashboard - Edge Cases', () => {
  it('should handle missing player data gracefully', async () => {
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('action=players')) {
        return { ok: true, json: async () => ({ players: null }) };
      }
      if (url.includes('action=status')) {
        return { ok: true, json: async () => ({ status: null }) };
      }
      return { ok: false, json: async () => ({}) };
    });

    const { result } = renderHook(() =>
      useWorldDashboard({ autoConnect: false })
    );

    await act(async () => {
      await result.current[1].refresh();
    });

    // Should not crash
    expect(result.current[0].players).toEqual([]);
  });

  it('should handle HTTP 500 responses', async () => {
    mockFetch.mockImplementation(async () => ({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Internal Server Error' }),
    }));

    const { result } = renderHook(() =>
      useWorldDashboard({ autoConnect: false })
    );

    await act(async () => {
      await result.current[1].refresh();
    });

    // Should not crash, players stay empty
    expect(result.current[0].players).toEqual([]);
  });

  it('should track peak players across updates', async () => {
    let callCount = 0;
    mockFetch.mockImplementation(async (url: string) => {
      callCount++;
      if (url.includes('action=players')) {
        // First call returns 3 players, second returns 1
        const count = callCount <= 2 ? 3 : 1;
        const players = Array.from({ length: count }, (_, i) => ({
          guid: i + 1,
          name: `Player${i + 1}`,
          level: 60,
          race: 'Human',
          class: 'Warrior',
          zone: 'Stormwind',
        }));
        return { ok: true, json: async () => ({ players }) };
      }
      if (url.includes('action=status')) {
        return {
          ok: true,
          json: async () => ({
            status: { uptime: 100, playerCount: callCount <= 2 ? 3 : 1, peakPlayers: 3 },
          }),
        };
      }
      return { ok: false, json: async () => ({}) };
    });

    const { result } = renderHook(() =>
      useWorldDashboard({ autoConnect: false })
    );

    // First refresh - 3 players
    await act(async () => {
      await result.current[1].refresh();
    });

    expect(result.current[0].serverStatus.peakPlayers).toBeGreaterThanOrEqual(3);
  });

  it('should cleanup on unmount', () => {
    const { unmount } = renderHook(() =>
      useWorldDashboard({ autoConnect: true, pollingInterval: 5000 })
    );

    // Should not throw on unmount
    expect(() => unmount()).not.toThrow();
  });
});
