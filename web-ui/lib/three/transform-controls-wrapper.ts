/**
 * TransformControlsWrapper - Object manipulation with gizmos
 *
 * Wraps Three.js TransformControls with terrain snapping, multi-object
 * support, and undo/redo integration.
 *
 * @module lib/three/transform-controls-wrapper
 */

import * as THREE from 'three';
import { TransformControls } from 'three-stdlib';

export type TransformMode = 'translate' | 'rotate' | 'scale';
export type TransformSpace = 'world' | 'local';

export interface TransformOptions {
  mode?: TransformMode;
  space?: TransformSpace;
  translationSnap?: number;
  rotationSnap?: number;
  scaleSnap?: number;
  snapToTerrain?: boolean;
  size?: number;
}

export interface TransformEvent {
  object: THREE.Object3D;
  position?: THREE.Vector3;
  rotation?: THREE.Euler;
  scale?: THREE.Vector3;
}

/**
 * Transform controls wrapper with advanced features
 */
export class TransformControlsWrapper {
  private controls: TransformControls;
  private camera: THREE.Camera;
  private scene: THREE.Scene;
  private domElement: HTMLElement;

  // Options
  private options: Required<TransformOptions>;

  // Multi-object support
  private attachedObjects: THREE.Object3D[] = [];
  private transformGroup: THREE.Group | null = null;

  // Event listeners
  private listeners: Map<string, Set<Function>> = new Map();

  // Terrain snapping
  private terrainLayer: THREE.Object3D | null = null;
  private raycaster: THREE.Raycaster = new THREE.Raycaster();

  constructor(
    camera: THREE.Camera,
    domElement: HTMLElement,
    scene: THREE.Scene,
    options: TransformOptions = {}
  ) {
    this.camera = camera;
    this.domElement = domElement;
    this.scene = scene;

    this.options = {
      mode: options.mode ?? 'translate',
      space: options.space ?? 'world',
      translationSnap: options.translationSnap ?? 1,
      rotationSnap: options.rotationSnap ?? Math.PI / 12, // 15 degrees
      scaleSnap: options.scaleSnap ?? 0.1,
      snapToTerrain: options.snapToTerrain ?? false,
      size: options.size ?? 1,
    };

    // Create TransformControls
    this.controls = new TransformControls(camera, domElement);
    this.controls.setMode(this.options.mode);
    this.controls.setSpace(this.options.space);
    this.controls.setSize(this.options.size);

    // Apply snapping
    this.controls.setTranslationSnap(this.options.translationSnap);
    this.controls.setRotationSnap(this.options.rotationSnap);
    this.controls.setScaleSnap(this.options.scaleSnap);

    // Add to scene
    this.scene.add(this.controls);

    // Bind events
    this.controls.addEventListener('change', this.handleChange.bind(this));
    this.controls.addEventListener('dragging-changed', this.handleDraggingChanged.bind(this));

    console.log('[TransformControlsWrapper] Initialized');
  }

  /**
   * Attach to single object
   */
  public attach(object: THREE.Object3D): void {
    this.attachedObjects = [object];
    this.controls.attach(object);

    this.emit('attached', { object });
  }

  /**
   * Attach to multiple objects
   */
  public attachMultiple(objects: THREE.Object3D[]): void {
    if (objects.length === 0) return;

    this.attachedObjects = objects;

    if (objects.length === 1) {
      this.controls.attach(objects[0]);
    } else {
      // Create group at center of objects
      this.transformGroup = new THREE.Group();

      // Calculate center
      const center = new THREE.Vector3();
      for (const obj of objects) {
        center.add(obj.position);
      }
      center.divideScalar(objects.length);

      this.transformGroup.position.copy(center);
      this.scene.add(this.transformGroup);

      // Parent objects to group
      for (const obj of objects) {
        this.transformGroup.attach(obj);
      }

      this.controls.attach(this.transformGroup);
    }

    this.emit('attached', { objects });
  }

  /**
   * Detach from all objects
   */
  public detach(): void {
    if (this.transformGroup) {
      // Un-parent objects
      while (this.transformGroup.children.length > 0) {
        this.scene.attach(this.transformGroup.children[0]);
      }
      this.scene.remove(this.transformGroup);
      this.transformGroup = null;
    }

    this.controls.detach();
    this.attachedObjects = [];

    this.emit('detached', {});
  }

  /**
   * Set transform mode
   */
  public setMode(mode: TransformMode): void {
    this.options.mode = mode;
    this.controls.setMode(mode);
  }

  /**
   * Set transform space
   */
  public setSpace(space: TransformSpace): void {
    this.options.space = space;
    this.controls.setSpace(space);
  }

  /**
   * Enable/disable translation snap
   */
  public setTranslationSnap(snap: number | null): void {
    this.controls.setTranslationSnap(snap);
  }

  /**
   * Enable/disable rotation snap
   */
  public setRotationSnap(snap: number | null): void {
    this.controls.setRotationSnap(snap);
  }

  /**
   * Enable/disable scale snap
   */
  public setScaleSnap(snap: number | null): void {
    this.controls.setScaleSnap(snap);
  }

  /**
   * Enable/disable terrain snapping
   */
  public setTerrainSnap(enabled: boolean, terrainLayer?: THREE.Object3D): void {
    this.options.snapToTerrain = enabled;
    if (terrainLayer) {
      this.terrainLayer = terrainLayer;
    }
  }

  /**
   * Handle change event
   */
  private handleChange(): void {
    // Apply terrain snapping if enabled
    if (this.options.snapToTerrain && this.options.mode === 'translate') {
      this.applyTerrainSnap();
    }

    // Emit change event
    const event: TransformEvent = {
      object: this.controls.object!,
      position: this.controls.object!.position.clone(),
      rotation: this.controls.object!.rotation.clone(),
      scale: this.controls.object!.scale.clone(),
    };

    this.emit('change', event);
  }

  /**
   * Handle dragging state change
   */
  private handleDraggingChanged(event: any): void {
    const isDragging = event.value;

    if (isDragging) {
      this.emit('dragStart', {
        object: this.controls.object!,
      });
    } else {
      this.emit('dragEnd', {
        object: this.controls.object!,
        position: this.controls.object!.position.clone(),
        rotation: this.controls.object!.rotation.clone(),
        scale: this.controls.object!.scale.clone(),
      });
    }

    // Emit for OrbitControls coordination
    this.emit('dragging-changed', { value: isDragging });
  }

  /**
   * Apply terrain snapping
   */
  private applyTerrainSnap(): void {
    if (!this.controls.object || !this.terrainLayer) return;

    const object = this.controls.object;
    const position = object.position;

    // Cast ray downward from object
    const origin = new THREE.Vector3(position.x, 1000, position.z);
    const direction = new THREE.Vector3(0, -1, 0);

    this.raycaster.set(origin, direction);

    const intersects = this.raycaster.intersectObjects(this.terrainLayer.children, true);

    if (intersects.length > 0) {
      // Snap to terrain height
      position.y = intersects[0].point.y;
    }
  }

  /**
   * Get controls for direct access
   */
  public getControls(): TransformControls {
    return this.controls;
  }

  /**
   * Show/hide controls
   */
  public setVisible(visible: boolean): void {
    this.controls.visible = visible;
  }

  /**
   * Enable/disable controls
   */
  public setEnabled(enabled: boolean): void {
    this.controls.enabled = enabled;
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
  private emit(event: string, data: any): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.forEach(callback => callback(data));
    }
  }

  /**
   * Dispose
   */
  public dispose(): void {
    this.detach();
    this.controls.dispose();
    this.listeners.clear();

    console.log('[TransformControlsWrapper] Disposed');
  }
}
