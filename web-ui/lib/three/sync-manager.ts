/**
 * SyncManager - Bidirectional 2D/3D state synchronization
 *
 * Coordinates selection, camera, and coordinate updates between 2D canvas
 * and 3D Three.js views with debouncing to prevent update loops.
 *
 * @module lib/three/sync-manager
 */

import * as THREE from 'three';
import type { WorldEditorState, WorldEditorActions } from '@/app/world-editor/hooks/useWorldEditorState';
import type { MapCoordinate } from '@/lib/map-editor';

export interface SyncOptions {
  syncSelection?: boolean;
  syncCamera?: boolean;
  syncCoordinates?: boolean;
  debounceMs?: number;
}

export type SyncDirection = '2d-to-3d' | '3d-to-2d' | 'bidirectional';

/**
 * Synchronization manager for 2D/3D coordination
 */
export class SyncManager {
  private state: WorldEditorState;
  private actions: WorldEditorActions;
  private options: Required<SyncOptions>;

  // Sync state
  private enabled = true;
  private lastSync: { [key: string]: number } = {};

  // Event listeners
  private listeners: Map<string, Set<Function>> = new Map();

  // Debounce timers
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor(
    state: WorldEditorState,
    actions: WorldEditorActions,
    options: SyncOptions = {}
  ) {
    this.state = state;
    this.actions = actions;

    this.options = {
      syncSelection: options.syncSelection ?? true,
      syncCamera: options.syncCamera ?? true,
      syncCoordinates: options.syncCoordinates ?? true,
      debounceMs: options.debounceMs ?? 100,
    };

    console.log('[SyncManager] Initialized');
  }

  /**
   * Sync selection from 2D to 3D
   */
  public syncSelectionTo3D(ids: string[]): void {
    if (!this.enabled || !this.options.syncSelection) return;

    // Check if sync is needed
    if (this.shouldDebounce('selection-3d')) {
      return;
    }

    this.emit('selectionSync3D', ids);
    this.recordSync('selection-3d');

    console.log('[SyncManager] Synced selection to 3D:', ids.length, 'items');
  }

  /**
   * Sync selection from 3D to 2D
   */
  public syncSelectionTo2D(ids: string[]): void {
    if (!this.enabled || !this.options.syncSelection) return;

    if (this.shouldDebounce('selection-2d')) {
      return;
    }

    // Update selection in state
    this.actions.setSelectedItems(new Set(ids));
    this.emit('selectionSync2D', ids);
    this.recordSync('selection-2d');

    console.log('[SyncManager] Synced selection to 2D:', ids.length, 'items');
  }

  /**
   * Sync camera position from 2D to 3D
   */
  public syncCameraTo3D(x: number, y: number, zoom: number): void {
    if (!this.enabled || !this.options.syncCamera) return;

    this.debounce('camera-3d', () => {
      // Calculate 3D camera position from 2D viewport
      // 2D coordinates (x, y) represent world position
      // zoom represents view scale

      const camera3D = {
        target: { x, y: 0, z: y }, // WoW Y becomes Three.js Z
        distance: 1000 / zoom, // Inverse relationship
      };

      this.emit('cameraSync3D', camera3D);
      console.log('[SyncManager] Synced camera to 3D');
    });
  }

  /**
   * Sync camera position from 3D to 2D
   */
  public syncCameraTo2D(position: THREE.Vector3, target: THREE.Vector3): void {
    if (!this.enabled || !this.options.syncCamera) return;

    this.debounce('camera-2d', () => {
      // Calculate 2D viewport from 3D camera
      // Three.js (X, Y, Z) to WoW (X, Z, Y)
      const x = target.x;
      const y = target.z; // Three.js Z becomes WoW Y

      const distance = position.distanceTo(target);
      const zoom = 1000 / distance;

      this.actions.setCamera2D({
        ...this.state.camera2D,
        centerX: x,
        centerY: y,
        zoom,
      });

      this.emit('cameraSync2D', { x, y, zoom });
      console.log('[SyncManager] Synced camera to 2D');
    });
  }

  /**
   * Focus 2D view on specific point
   */
  public focusOn2D(x: number, y: number): void {
    if (!this.enabled) return;

    this.actions.setCamera2D({
      ...this.state.camera2D,
      centerX: x,
      centerY: y,
    });

    this.emit('focus2D', { x, y });
  }

  /**
   * Focus 3D view on specific point
   */
  public focusOn3D(x: number, y: number, z: number, distance?: number): void {
    if (!this.enabled) return;

    this.emit('focus3D', { x, y, z, distance });
  }

  /**
   * Sync coordinate addition from 2D to 3D
   */
  public syncCoordinateAddedTo3D(coord: MapCoordinate): void {
    if (!this.enabled || !this.options.syncCoordinates) return;

    this.emit('coordinateAdded3D', coord);
    console.log('[SyncManager] Synced coordinate addition to 3D:', coord.id);
  }

  /**
   * Sync coordinate addition from 3D to 2D
   */
  public syncCoordinateAddedTo2D(coord: MapCoordinate): void {
    if (!this.enabled || !this.options.syncCoordinates) return;

    this.actions.addCoordinate(coord);
    this.emit('coordinateAdded2D', coord);
    console.log('[SyncManager] Synced coordinate addition to 2D:', coord.id);
  }

  /**
   * Sync coordinate update from 2D to 3D
   */
  public syncCoordinateUpdatedTo3D(coord: MapCoordinate): void {
    if (!this.enabled || !this.options.syncCoordinates) return;

    this.emit('coordinateUpdated3D', coord);
  }

  /**
   * Sync coordinate update from 3D to 2D
   */
  public syncCoordinateUpdatedTo2D(coord: MapCoordinate): void {
    if (!this.enabled || !this.options.syncCoordinates) return;

    this.actions.updateCoordinate(coord.id, coord);
    this.emit('coordinateUpdated2D', coord);
  }

  /**
   * Sync coordinate deletion from 2D to 3D
   */
  public syncCoordinateDeletedTo3D(id: string): void {
    if (!this.enabled || !this.options.syncCoordinates) return;

    this.emit('coordinateDeleted3D', id);
  }

  /**
   * Sync coordinate deletion from 3D to 2D
   */
  public syncCoordinateDeletedTo2D(id: string): void {
    if (!this.enabled || !this.options.syncCoordinates) return;

    this.actions.deleteCoordinate(id);
    this.emit('coordinateDeleted2D', id);
  }

  /**
   * Enable synchronization
   */
  public enable(): void {
    this.enabled = true;
    console.log('[SyncManager] Enabled');
  }

  /**
   * Disable synchronization (temporarily)
   */
  public disable(): void {
    this.enabled = false;
    console.log('[SyncManager] Disabled');
  }

  /**
   * Check if sync should be debounced
   */
  private shouldDebounce(key: string): boolean {
    const now = Date.now();
    const lastTime = this.lastSync[key] || 0;
    return now - lastTime < this.options.debounceMs;
  }

  /**
   * Record sync timestamp
   */
  private recordSync(key: string): void {
    this.lastSync[key] = Date.now();
  }

  /**
   * Debounce function execution
   */
  private debounce(key: string, fn: Function): void {
    // Clear existing timer
    const existingTimer = this.debounceTimers.get(key);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set new timer
    const timer = setTimeout(() => {
      fn();
      this.debounceTimers.delete(key);
    }, this.options.debounceMs);

    this.debounceTimers.set(key, timer);
  }

  /**
   * Register event listener
   */
  public on(event: string, callback: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  /**
   * Unregister event listener
   */
  public off(event: string, callback: Function): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.delete(callback);
    }
  }

  /**
   * Emit event
   */
  private emit(event: string, data?: any): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.forEach(callback => callback(data));
    }
  }

  /**
   * Dispose
   */
  public dispose(): void {
    // Clear all timers
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();

    // Clear listeners
    this.listeners.clear();

    console.log('[SyncManager] Disposed');
  }
}
