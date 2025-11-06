/**
 * TrinityCore SAI Unified Editor - Collaboration System
 *
 * Real-time collaborative editing with WebSocket support.
 * Supports presence awareness, cursor sharing, and change broadcasting.
 *
 * @module sai-unified/collaboration
 * @version 3.0.0
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import type { SAIScript, SAINode, SAIConnection } from './types';

// ============================================================================
// TYPES
// ============================================================================

export interface CollaborationUser {
  id: string;
  name: string;
  color: string;
  cursor?: { x: number; y: number };
  selection?: string[]; // Selected node IDs
  lastSeen: number;
}

export interface CollaborationMessage {
  type: 'join' | 'leave' | 'update' | 'cursor' | 'selection' | 'lock' | 'unlock' | 'heartbeat';
  userId: string;
  timestamp: number;
  data?: any;
}

export interface ScriptUpdate {
  scriptId: string;
  changes: ScriptChange[];
  userId: string;
  timestamp: number;
}

export type ScriptChange =
  | { type: 'node-add'; node: SAINode }
  | { type: 'node-update'; nodeId: string; node: Partial<SAINode> }
  | { type: 'node-delete'; nodeId: string }
  | { type: 'connection-add'; connection: SAIConnection }
  | { type: 'connection-delete'; connectionId: string };

export interface CollaborationState {
  connected: boolean;
  users: Map<string, CollaborationUser>;
  locks: Map<string, string>; // nodeId -> userId
  myUserId: string | null;
}

// ============================================================================
// COLLABORATION MANAGER
// ============================================================================

export class CollaborationManager {
  private ws: WebSocket | null = null;
  private scriptId: string;
  private userId: string;
  private userName: string;
  private userColor: string;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 1000;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  // Callbacks
  private onUserJoinCallback?: (user: CollaborationUser) => void;
  private onUserLeaveCallback?: (userId: string) => void;
  private onUpdateCallback?: (update: ScriptUpdate) => void;
  private onCursorMoveCallback?: (userId: string, x: number, y: number) => void;
  private onSelectionChangeCallback?: (userId: string, nodeIds: string[]) => void;
  private onLockCallback?: (nodeId: string, userId: string) => void;
  private onUnlockCallback?: (nodeId: string) => void;
  private onConnectedCallback?: () => void;
  private onDisconnectedCallback?: () => void;

  constructor(scriptId: string, userId: string, userName: string, userColor: string) {
    this.scriptId = scriptId;
    this.userId = userId;
    this.userName = userName;
    this.userColor = userColor;
  }

  /**
   * Connect to collaboration server
   */
  connect(wsUrl?: string): void {
    const url = wsUrl || this.getWebSocketUrl();

    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      console.log('[Collaboration] Connected to server');
      this.reconnectAttempts = 0;

      // Send join message
      this.send({
        type: 'join',
        userId: this.userId,
        timestamp: Date.now(),
        data: {
          scriptId: this.scriptId,
          userName: this.userName,
          userColor: this.userColor,
        },
      });

      // Start heartbeat
      this.startHeartbeat();

      if (this.onConnectedCallback) {
        this.onConnectedCallback();
      }
    };

    this.ws.onmessage = (event) => {
      try {
        const message: CollaborationMessage = JSON.parse(event.data);
        this.handleMessage(message);
      } catch (error) {
        console.error('[Collaboration] Failed to parse message:', error);
      }
    };

    this.ws.onerror = (error) => {
      console.error('[Collaboration] WebSocket error:', error);
    };

    this.ws.onclose = () => {
      console.log('[Collaboration] Disconnected from server');
      this.stopHeartbeat();

      if (this.onDisconnectedCallback) {
        this.onDisconnectedCallback();
      }

      // Attempt reconnection
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

        console.log(`[Collaboration] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

        setTimeout(() => {
          this.connect(wsUrl);
        }, delay);
      }
    };
  }

  /**
   * Disconnect from collaboration server
   */
  disconnect(): void {
    if (this.ws) {
      // Send leave message
      this.send({
        type: 'leave',
        userId: this.userId,
        timestamp: Date.now(),
      });

      this.ws.close();
      this.ws = null;
    }

    this.stopHeartbeat();
  }

  /**
   * Broadcast script update
   */
  broadcastUpdate(changes: ScriptChange[]): void {
    this.send({
      type: 'update',
      userId: this.userId,
      timestamp: Date.now(),
      data: {
        scriptId: this.scriptId,
        changes,
      },
    });
  }

  /**
   * Broadcast cursor position
   */
  broadcastCursor(x: number, y: number): void {
    this.send({
      type: 'cursor',
      userId: this.userId,
      timestamp: Date.now(),
      data: { x, y },
    });
  }

  /**
   * Broadcast selection change
   */
  broadcastSelection(nodeIds: string[]): void {
    this.send({
      type: 'selection',
      userId: this.userId,
      timestamp: Date.now(),
      data: { nodeIds },
    });
  }

  /**
   * Lock a node for editing
   */
  lockNode(nodeId: string): void {
    this.send({
      type: 'lock',
      userId: this.userId,
      timestamp: Date.now(),
      data: { nodeId },
    });
  }

  /**
   * Unlock a node
   */
  unlockNode(nodeId: string): void {
    this.send({
      type: 'unlock',
      userId: this.userId,
      timestamp: Date.now(),
      data: { nodeId },
    });
  }

  /**
   * Event handlers
   */
  onUserJoin(callback: (user: CollaborationUser) => void): void {
    this.onUserJoinCallback = callback;
  }

  onUserLeave(callback: (userId: string) => void): void {
    this.onUserLeaveCallback = callback;
  }

  onUpdate(callback: (update: ScriptUpdate) => void): void {
    this.onUpdateCallback = callback;
  }

  onCursorMove(callback: (userId: string, x: number, y: number) => void): void {
    this.onCursorMoveCallback = callback;
  }

  onSelectionChange(callback: (userId: string, nodeIds: string[]) => void): void {
    this.onSelectionChangeCallback = callback;
  }

  onLock(callback: (nodeId: string, userId: string) => void): void {
    this.onLockCallback = callback;
  }

  onUnlock(callback: (nodeId: string) => void): void {
    this.onUnlockCallback = callback;
  }

  onConnected(callback: () => void): void {
    this.onConnectedCallback = callback;
  }

  onDisconnected(callback: () => void): void {
    this.onDisconnectedCallback = callback;
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private send(message: CollaborationMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  private handleMessage(message: CollaborationMessage): void {
    // Ignore own messages
    if (message.userId === this.userId) {
      return;
    }

    switch (message.type) {
      case 'join':
        if (this.onUserJoinCallback && message.data) {
          this.onUserJoinCallback({
            id: message.userId,
            name: message.data.userName,
            color: message.data.userColor,
            lastSeen: message.timestamp,
          });
        }
        break;

      case 'leave':
        if (this.onUserLeaveCallback) {
          this.onUserLeaveCallback(message.userId);
        }
        break;

      case 'update':
        if (this.onUpdateCallback && message.data) {
          this.onUpdateCallback({
            scriptId: message.data.scriptId,
            changes: message.data.changes,
            userId: message.userId,
            timestamp: message.timestamp,
          });
        }
        break;

      case 'cursor':
        if (this.onCursorMoveCallback && message.data) {
          this.onCursorMoveCallback(message.userId, message.data.x, message.data.y);
        }
        break;

      case 'selection':
        if (this.onSelectionChangeCallback && message.data) {
          this.onSelectionChangeCallback(message.userId, message.data.nodeIds);
        }
        break;

      case 'lock':
        if (this.onLockCallback && message.data) {
          this.onLockCallback(message.data.nodeId, message.userId);
        }
        break;

      case 'unlock':
        if (this.onUnlockCallback && message.data) {
          this.onUnlockCallback(message.data.nodeId);
        }
        break;

      case 'heartbeat':
        // Server heartbeat - no action needed
        break;

      default:
        console.warn('[Collaboration] Unknown message type:', message.type);
    }
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      this.send({
        type: 'heartbeat',
        userId: this.userId,
        timestamp: Date.now(),
      });
    }, 30000); // 30 seconds
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private getWebSocketUrl(): string {
    // Determine WebSocket URL based on environment
    if (typeof window !== 'undefined') {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      return `${protocol}//${host}/api/sai/collaborate?scriptId=${this.scriptId}`;
    }

    return 'ws://localhost:3000/api/sai/collaborate';
  }
}

// ============================================================================
// REACT HOOKS
// ============================================================================

/**
 * React hook for collaborative editing
 */
export function useCollaboration(
  scriptId: string,
  enabled: boolean = true
): {
  state: CollaborationState;
  manager: CollaborationManager | null;
  broadcastUpdate: (changes: ScriptChange[]) => void;
  broadcastCursor: (x: number, y: number) => void;
  broadcastSelection: (nodeIds: string[]) => void;
  lockNode: (nodeId: string) => void;
  unlockNode: (nodeId: string) => void;
} {
  const [state, setState] = useState<CollaborationState>({
    connected: false,
    users: new Map(),
    locks: new Map(),
    myUserId: null,
  });

  const managerRef = useRef<CollaborationManager | null>(null);

  useEffect(() => {
    if (!enabled) return;

    // Generate user ID and details
    const userId = `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const userName = `User ${Math.floor(Math.random() * 1000)}`;
    const userColor = `#${Math.floor(Math.random() * 16777215).toString(16)}`;

    // Create collaboration manager
    const manager = new CollaborationManager(scriptId, userId, userName, userColor);

    // Set up event handlers
    manager.onConnected(() => {
      setState((prev) => ({ ...prev, connected: true, myUserId: userId }));
    });

    manager.onDisconnected(() => {
      setState((prev) => ({ ...prev, connected: false }));
    });

    manager.onUserJoin((user) => {
      setState((prev) => {
        const newUsers = new Map(prev.users);
        newUsers.set(user.id, user);
        return { ...prev, users: newUsers };
      });
    });

    manager.onUserLeave((userId) => {
      setState((prev) => {
        const newUsers = new Map(prev.users);
        newUsers.delete(userId);
        return { ...prev, users: newUsers };
      });
    });

    manager.onLock((nodeId, userId) => {
      setState((prev) => {
        const newLocks = new Map(prev.locks);
        newLocks.set(nodeId, userId);
        return { ...prev, locks: newLocks };
      });
    });

    manager.onUnlock((nodeId) => {
      setState((prev) => {
        const newLocks = new Map(prev.locks);
        newLocks.delete(nodeId);
        return { ...prev, locks: newLocks };
      });
    });

    // Connect
    manager.connect();
    managerRef.current = manager;

    // Cleanup
    return () => {
      manager.disconnect();
      managerRef.current = null;
    };
  }, [scriptId, enabled]);

  const broadcastUpdate = useCallback(
    (changes: ScriptChange[]) => {
      if (managerRef.current) {
        managerRef.current.broadcastUpdate(changes);
      }
    },
    []
  );

  const broadcastCursor = useCallback(
    (x: number, y: number) => {
      if (managerRef.current) {
        managerRef.current.broadcastCursor(x, y);
      }
    },
    []
  );

  const broadcastSelection = useCallback(
    (nodeIds: string[]) => {
      if (managerRef.current) {
        managerRef.current.broadcastSelection(nodeIds);
      }
    },
    []
  );

  const lockNode = useCallback(
    (nodeId: string) => {
      if (managerRef.current) {
        managerRef.current.lockNode(nodeId);
      }
    },
    []
  );

  const unlockNode = useCallback(
    (nodeId: string) => {
      if (managerRef.current) {
        managerRef.current.unlockNode(nodeId);
      }
    },
    []
  );

  return {
    state,
    manager: managerRef.current,
    broadcastUpdate,
    broadcastCursor,
    broadcastSelection,
    lockNode,
    unlockNode,
  };
}

/**
 * Generate random user color
 */
export function generateUserColor(): string {
  const colors = [
    '#3B82F6', // blue
    '#10B981', // green
    '#F59E0B', // amber
    '#EF4444', // red
    '#8B5CF6', // purple
    '#EC4899', // pink
    '#14B8A6', // teal
    '#F97316', // orange
  ];

  return colors[Math.floor(Math.random() * colors.length)];
}

/**
 * Get user initials from name
 */
export function getUserInitials(name: string): string {
  const parts = name.split(' ');
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
}
