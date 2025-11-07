/**
 * MultiSelectManager - Advanced selection system
 *
 * Handles box selection, multi-select with modifiers, and bulk operations
 * with filtering and selection manipulation.
 *
 * @module lib/three/multi-select-manager
 */

import * as THREE from 'three';

export interface SelectionOptions {
  multiSelect?: boolean;
  boxSelect?: boolean;
  selectThrough?: boolean; // Select objects behind others
}

export interface BoxSelection {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

/**
 * Multi-select manager
 */
export class MultiSelectManager {
  private camera: THREE.Camera;
  private scene: THREE.Scene;
  private domElement: HTMLElement;

  // Selection state
  public selectedIds: Set<string> = new Set();
  private selectableObjects: Map<string, THREE.Object3D> = new Map();

  // Box selection
  private isBoxSelecting = false;
  private boxSelection: BoxSelection | null = null;
  private boxHelper: THREE.Mesh | null = null;

  // Options
  private options: Required<SelectionOptions>;

  // Event listeners
  private listeners: Map<string, Set<Function>> = new Map();

  // Raycaster for frustum selection
  private raycaster = new THREE.Raycaster();

  constructor(
    camera: THREE.Camera,
    scene: THREE.Scene,
    domElement: HTMLElement,
    options: SelectionOptions = {}
  ) {
    this.camera = camera;
    this.scene = scene;
    this.domElement = domElement;

    this.options = {
      multiSelect: options.multiSelect ?? true,
      boxSelect: options.boxSelect ?? true,
      selectThrough: options.selectThrough ?? false,
    };

    console.log('[MultiSelectManager] Initialized');
  }

  /**
   * Register selectable object
   */
  public registerSelectable(id: string, object: THREE.Object3D): void {
    this.selectableObjects.set(id, object);
    object.userData.selectableId = id;
  }

  /**
   * Unregister selectable object
   */
  public unregisterSelectable(id: string): void {
    this.selectableObjects.delete(id);
  }

  /**
   * Select single object
   */
  public select(id: string): void {
    if (!this.options.multiSelect) {
      this.selectedIds.clear();
    }
    this.selectedIds.add(id);
    this.emit('selectionChanged', Array.from(this.selectedIds));
  }

  /**
   * Deselect object
   */
  public deselect(id: string): void {
    this.selectedIds.delete(id);
    this.emit('selectionChanged', Array.from(this.selectedIds));
  }

  /**
   * Toggle selection
   */
  public toggle(id: string): void {
    if (this.selectedIds.has(id)) {
      this.deselect(id);
    } else {
      this.select(id);
    }
  }

  /**
   * Select all objects
   */
  public selectAll(): void {
    this.selectedIds = new Set(this.selectableObjects.keys());
    this.emit('selectionChanged', Array.from(this.selectedIds));
  }

  /**
   * Deselect all objects
   */
  public deselectAll(): void {
    this.selectedIds.clear();
    this.emit('selectionChanged', []);
  }

  /**
   * Invert selection
   */
  public invertSelection(): void {
    const newSelection = new Set<string>();

    for (const id of this.selectableObjects.keys()) {
      if (!this.selectedIds.has(id)) {
        newSelection.add(id);
      }
    }

    this.selectedIds = newSelection;
    this.emit('selectionChanged', Array.from(this.selectedIds));
  }

  /**
   * Start box selection
   */
  public startBoxSelect(x: number, y: number): void {
    if (!this.options.boxSelect) return;

    this.isBoxSelecting = true;
    this.boxSelection = { startX: x, startY: y, endX: x, endY: y };

    // Create visual box helper
    this.createBoxHelper();

    this.emit('boxSelectStart', this.boxSelection);
  }

  /**
   * Update box selection
   */
  public updateBoxSelect(x: number, y: number): void {
    if (!this.isBoxSelecting || !this.boxSelection) return;

    this.boxSelection.endX = x;
    this.boxSelection.endY = y;

    // Update box helper
    this.updateBoxHelper();

    // Get objects in box
    const objectsInBox = this.getObjectsInBox();

    this.emit('boxSelectUpdate', { box: this.boxSelection, objects: objectsInBox });
  }

  /**
   * End box selection
   */
  public endBoxSelect(): void {
    if (!this.isBoxSelecting || !this.boxSelection) return;

    // Get final selection
    const objectsInBox = this.getObjectsInBox();

    // Update selection
    if (!this.options.multiSelect) {
      this.selectedIds.clear();
    }

    for (const id of objectsInBox) {
      this.selectedIds.add(id);
    }

    // Cleanup
    this.isBoxSelecting = false;
    this.boxSelection = null;
    this.removeBoxHelper();

    this.emit('selectionChanged', Array.from(this.selectedIds));
    this.emit('boxSelectEnd', objectsInBox);
  }

  /**
   * Get objects within selection box
   */
  private getObjectsInBox(): string[] {
    if (!this.boxSelection) return [];

    const { startX, startY, endX, endY } = this.boxSelection;

    // Normalize box coordinates
    const minX = Math.min(startX, endX);
    const maxX = Math.max(startX, endX);
    const minY = Math.min(startY, endY);
    const maxY = Math.max(startY, endY);

    const selected: string[] = [];

    // Check each selectable object
    for (const [id, object] of this.selectableObjects) {
      if (this.isObjectInBox(object, minX, minY, maxX, maxY)) {
        selected.push(id);
      }
    }

    return selected;
  }

  /**
   * Check if object is within box (using frustum)
   */
  private isObjectInBox(
    object: THREE.Object3D,
    minX: number,
    minY: number,
    maxX: number,
    maxY: number
  ): boolean {
    // Convert to NDC
    const rect = this.domElement.getBoundingClientRect();

    const ndcMinX = (minX / rect.width) * 2 - 1;
    const ndcMaxX = (maxX / rect.width) * 2 - 1;
    const ndcMinY = -((maxY / rect.height) * 2 - 1);
    const ndcMaxY = -((minY / rect.height) * 2 - 1);

    // Project object position to screen
    const position = new THREE.Vector3();
    object.getWorldPosition(position);

    const projected = position.clone().project(this.camera);

    // Check if within box
    return (
      projected.x >= ndcMinX &&
      projected.x <= ndcMaxX &&
      projected.y >= ndcMinY &&
      projected.y <= ndcMaxY &&
      projected.z >= -1 &&
      projected.z <= 1
    );
  }

  /**
   * Select objects by filter
   */
  public selectByFilter(filterFn: (id: string, object: THREE.Object3D) => boolean): void {
    this.selectedIds.clear();

    for (const [id, object] of this.selectableObjects) {
      if (filterFn(id, object)) {
        this.selectedIds.add(id);
      }
    }

    this.emit('selectionChanged', Array.from(this.selectedIds));
  }

  /**
   * Select objects by type
   */
  public selectByType(type: string): void {
    this.selectByFilter((id, object) => object.userData.type === type);
  }

  /**
   * Select objects in radius
   */
  public selectInRadius(centerX: number, centerY: number, centerZ: number, radius: number): void {
    const center = new THREE.Vector3(centerX, centerY, centerZ);

    this.selectByFilter((id, object) => {
      const pos = new THREE.Vector3();
      object.getWorldPosition(pos);
      return pos.distanceTo(center) <= radius;
    });
  }

  /**
   * Create box helper visual
   */
  private createBoxHelper(): void {
    const geometry = new THREE.PlaneGeometry(1, 1);
    const material = new THREE.MeshBasicMaterial({
      color: 0x5555ff,
      transparent: true,
      opacity: 0.2,
      side: THREE.DoubleSide,
      depthTest: false,
    });

    this.boxHelper = new THREE.Mesh(geometry, material);
    this.boxHelper.renderOrder = 999; // Render on top
    this.scene.add(this.boxHelper);
  }

  /**
   * Update box helper visual
   */
  private updateBoxHelper(): void {
    if (!this.boxHelper || !this.boxSelection) return;

    const { startX, startY, endX, endY } = this.boxSelection;

    const width = Math.abs(endX - startX);
    const height = Math.abs(endY - startY);
    const centerX = (startX + endX) / 2;
    const centerY = (startY + endY) / 2;

    // Update geometry
    this.boxHelper.scale.set(width, height, 1);
    this.boxHelper.position.set(centerX, centerY, 0);
  }

  /**
   * Remove box helper visual
   */
  private removeBoxHelper(): void {
    if (this.boxHelper) {
      this.scene.remove(this.boxHelper);
      this.boxHelper.geometry.dispose();
      (this.boxHelper.material as THREE.Material).dispose();
      this.boxHelper = null;
    }
  }

  /**
   * Get selected objects
   */
  public getSelectedObjects(): THREE.Object3D[] {
    return Array.from(this.selectedIds)
      .map(id => this.selectableObjects.get(id))
      .filter((obj): obj is THREE.Object3D => obj !== undefined);
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
    this.removeBoxHelper();
    this.selectableObjects.clear();
    this.selectedIds.clear();
    this.listeners.clear();

    console.log('[MultiSelectManager] Disposed');
  }
}
