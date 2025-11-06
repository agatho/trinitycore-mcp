/**
 * Collaboration Provider - Real-Time Multi-User Support
 *
 * Manages real-time collaborative editing with presence indicators,
 * node locking, and conflict resolution.
 */

'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Node, Edge } from 'reactflow';

// User presence information
export interface UserPresence {
  id: string;
  name: string;
  color: string;
  avatar?: string;
  cursor?: { x: number; y: number };
  selectedNodes?: string[];
  lastActive: number;
}

// Node lock information
export interface NodeLock {
  nodeId: string;
  userId: string;
  userName: string;
  lockedAt: number;
}

// Collaboration event types
export type CollaborationEvent =
  | { type: 'user:join'; user: UserPresence }
  | { type: 'user:leave'; userId: string }
  | { type: 'user:cursor'; userId: string; x: number; y: number }
  | { type: 'user:select'; userId: string; nodeIds: string[] }
  | { type: 'node:lock'; lock: NodeLock }
  | { type: 'node:unlock'; nodeId: string }
  | { type: 'node:update'; nodeId: string; data: any }
  | { type: 'edge:add'; edge: Edge }
  | { type: 'edge:delete'; edgeId: string };

interface CollaborationContextType {
  // Current user
  currentUser: UserPresence | null;
  setCurrentUser: (user: UserPresence) => void;

  // Active users
  activeUsers: UserPresence[];

  // Node locks
  locks: NodeLock[];
  isNodeLocked: (nodeId: string) => boolean;
  lockNode: (nodeId: string) => Promise<boolean>;
  unlockNode: (nodeId: string) => void;
  getNodeLock: (nodeId: string) => NodeLock | undefined;

  // Presence
  updateCursor: (x: number, y: number) => void;
  updateSelection: (nodeIds: string[]) => void;

  // Real-time sync (placeholder for WebSocket/server implementation)
  syncEnabled: boolean;
  setSyncEnabled: (enabled: boolean) => void;
}

const CollaborationContext = createContext<CollaborationContextType | undefined>(undefined);

export const useCollaboration = () => {
  const context = useContext(CollaborationContext);
  if (!context) {
    throw new Error('useCollaboration must be used within CollaborationProvider');
  }
  return context;
};

interface CollaborationProviderProps {
  children: React.ReactNode;
  roomId?: string; // Script/room identifier for multi-room support
}

export const CollaborationProvider: React.FC<CollaborationProviderProps> = ({
  children,
  roomId,
}) => {
  const [currentUser, setCurrentUser] = useState<UserPresence | null>(null);
  const [activeUsers, setActiveUsers] = useState<UserPresence[]>([]);
  const [locks, setLocks] = useState<NodeLock[]>([]);
  const [syncEnabled, setSyncEnabled] = useState(false);

  // Generate random color for user
  const generateUserColor = useCallback(() => {
    const colors = [
      '#3b82f6', // Blue
      '#10b981', // Green
      '#f59e0b', // Amber
      '#ef4444', // Red
      '#8b5cf6', // Violet
      '#ec4899', // Pink
      '#06b6d4', // Cyan
      '#f97316', // Orange
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }, []);

  // Initialize current user
  useEffect(() => {
    if (!currentUser) {
      const userId = `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const userName = `User ${Math.floor(Math.random() * 1000)}`;

      setCurrentUser({
        id: userId,
        name: userName,
        color: generateUserColor(),
        lastActive: Date.now(),
      });
    }
  }, [currentUser, generateUserColor]);

  // Cleanup inactive users
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const timeout = 30000; // 30 seconds

      setActiveUsers((users) =>
        users.filter((user) => now - user.lastActive < timeout)
      );

      // Release locks from inactive users
      setLocks((currentLocks) =>
        currentLocks.filter((lock) => {
          const user = activeUsers.find((u) => u.id === lock.userId);
          return user && now - user.lastActive < timeout;
        })
      );
    }, 5000); // Check every 5 seconds

    return () => clearInterval(interval);
  }, [activeUsers]);

  // Check if a node is locked
  const isNodeLocked = useCallback(
    (nodeId: string): boolean => {
      const lock = locks.find((l) => l.nodeId === nodeId);
      if (!lock) return false;

      // Node is not locked if current user owns the lock
      if (currentUser && lock.userId === currentUser.id) return false;

      return true;
    },
    [locks, currentUser]
  );

  // Get node lock info
  const getNodeLock = useCallback(
    (nodeId: string): NodeLock | undefined => {
      return locks.find((l) => l.nodeId === nodeId);
    },
    [locks]
  );

  // Lock a node
  const lockNode = useCallback(
    async (nodeId: string): Promise<boolean> => {
      if (!currentUser) return false;

      // Check if already locked by someone else
      if (isNodeLocked(nodeId)) {
        return false;
      }

      const newLock: NodeLock = {
        nodeId,
        userId: currentUser.id,
        userName: currentUser.name,
        lockedAt: Date.now(),
      };

      setLocks((currentLocks) => {
        // Remove any existing lock by current user on this node
        const filtered = currentLocks.filter(
          (l) => !(l.nodeId === nodeId && l.userId === currentUser.id)
        );
        return [...filtered, newLock];
      });

      // TODO: Broadcast lock event to other users via WebSocket
      // broadcastEvent({ type: 'node:lock', lock: newLock });

      return true;
    },
    [currentUser, isNodeLocked]
  );

  // Unlock a node
  const unlockNode = useCallback(
    (nodeId: string) => {
      if (!currentUser) return;

      setLocks((currentLocks) =>
        currentLocks.filter(
          (l) => !(l.nodeId === nodeId && l.userId === currentUser.id)
        )
      );

      // TODO: Broadcast unlock event to other users via WebSocket
      // broadcastEvent({ type: 'node:unlock', nodeId });
    },
    [currentUser]
  );

  // Update cursor position
  const updateCursor = useCallback(
    (x: number, y: number) => {
      if (!currentUser) return;

      setCurrentUser((user) =>
        user ? { ...user, cursor: { x, y }, lastActive: Date.now() } : null
      );

      // TODO: Broadcast cursor position to other users
      // broadcastEvent({ type: 'user:cursor', userId: currentUser.id, x, y });
    },
    [currentUser]
  );

  // Update node selection
  const updateSelection = useCallback(
    (nodeIds: string[]) => {
      if (!currentUser) return;

      setCurrentUser((user) =>
        user ? { ...user, selectedNodes: nodeIds, lastActive: Date.now() } : null
      );

      // TODO: Broadcast selection to other users
      // broadcastEvent({ type: 'user:select', userId: currentUser.id, nodeIds });
    },
    [currentUser]
  );

  // TODO: WebSocket connection and event handling
  // useEffect(() => {
  //   if (!syncEnabled || !roomId) return;
  //
  //   const ws = new WebSocket(`ws://localhost:3001/collab/${roomId}`);
  //
  //   ws.onopen = () => {
  //     if (currentUser) {
  //       ws.send(JSON.stringify({ type: 'user:join', user: currentUser }));
  //     }
  //   };
  //
  //   ws.onmessage = (event) => {
  //     const data: CollaborationEvent = JSON.parse(event.data);
  //     handleCollaborationEvent(data);
  //   };
  //
  //   ws.onerror = (error) => {
  //     console.error('WebSocket error:', error);
  //     setSyncEnabled(false);
  //   };
  //
  //   ws.onclose = () => {
  //     setSyncEnabled(false);
  //   };
  //
  //   return () => {
  //     if (currentUser) {
  //       ws.send(JSON.stringify({ type: 'user:leave', userId: currentUser.id }));
  //     }
  //     ws.close();
  //   };
  // }, [syncEnabled, roomId, currentUser]);

  const value: CollaborationContextType = {
    currentUser,
    setCurrentUser,
    activeUsers,
    locks,
    isNodeLocked,
    lockNode,
    unlockNode,
    getNodeLock,
    updateCursor,
    updateSelection,
    syncEnabled,
    setSyncEnabled,
  };

  return (
    <CollaborationContext.Provider value={value}>
      {children}
    </CollaborationContext.Provider>
  );
};

export default CollaborationProvider;
