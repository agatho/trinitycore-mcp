/**
 * RaycasterManager - 3D mouse picking and interaction system
 *
 * Handles raycasting from mouse position to 3D scene, terrain intersection,
 * object picking, and drag operations with debouncing.
 *
 * @module lib/three/raycaster-manager
 */

import * as THREE from 'three';

export interface RaycastOptions {
  terrainLayer?: THREE.Object3D;
  pickableLayer?: THREE.Object3D;
  hoverDebounce?: number;
  dragThreshold?: number;
}

export interface Intersection {
  object: THREE.Object3D;
  point: THREE.Vector3;
  distance: number;
  normal?: THREE.Vector3;
}

export type InteractionCallback = (data: any) => void;

/**
 * Raycaster manager for 3D picking and interaction
 */
export class RaycasterManager {
  private camera: THREE.Camera;
  private scene: THREE.Scene;
  private domElement: HTMLElement;

  // Raycaster
  private raycaster: THREE.Raycaster;
  private mouse: THREE.Vector2;

  // Layers
  private terrainLayer: THREE.Object3D | null = null;
  private pickableLayer: THREE.Object3D | null = null;

  // Hover state
  private hoveredObject: THREE.Object3D | null = null;
  private hoverDebounceTimer: NodeJS.Timeout | null = null;
  private hoverDebounce: number;

  // Drag state
  private isDragging = false;
  private dragStartPosition: THREE.Vector2 | null = null;
  private dragObject: THREE.Object3D | null = null;
  private dragThreshold: number;

  // Event listeners
  private eventListeners: Map<string, Set<InteractionCallback>> = new Map();

  // DOM event handlers
  private mouseMoveHandler: (e: MouseEvent) => void;
  private mouseDownHandler: (e: MouseEvent) => void;
  private mouseUpHandler: (e: MouseEvent) => void;
  private clickHandler: (e: MouseEvent) => void;

  constructor(
    camera: THREE.Camera,
    scene: THREE.Scene,
    domElement: HTMLElement,
    options: RaycastOptions = {}
  ) {
    this.camera = camera;
    this.scene = scene;
    this.domElement = domElement;

    this.terrainLayer = options.terrainLayer ?? null;
    this.pickableLayer = options.pickableLayer ?? null;
    this.hoverDebounce = options.hoverDebounce ?? 50;
    this.dragThreshold = options.dragThreshold ?? 5;

    // Initialize raycaster
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    // Bind event handlers
    this.mouseMoveHandler = this.handleMouseMove.bind(this);
    this.mouseDownHandler = this.handleMouseDown.bind(this);
    this.mouseUpHandler = this.handleMouseUp.bind(this);
    this.clickHandler = this.handleClick.bind(this);

    console.log('[RaycasterManager] Initialized');
  }

  /**
   * Enable raycasting
   */
  public enable(): void {
    this.domElement.addEventListener('mousemove', this.mouseMoveHandler);
    this.domElement.addEventListener('mousedown', this.mouseDownHandler);
    this.domElement.addEventListener('mouseup', this.mouseUpHandler);
    this.domElement.addEventListener('click', this.clickHandler);

    console.log('[RaycasterManager] Enabled');
  }

  /**
   * Disable raycasting
   */
  public disable(): void {
    this.domElement.removeEventListener('mousemove', this.mouseMoveHandler);
    this.domElement.removeEventListener('mousedown', this.mouseDownHandler);
    this.domElement.removeEventListener('mouseup', this.mouseUpHandler);
    this.domElement.removeEventListener('click', this.clickHandler);

    console.log('[RaycasterManager] Disabled');
  }

  /**
   * Handle mouse move
   */
  private handleMouseMove(event: MouseEvent): void {
    this.updateMousePosition(event);

    // Check for hover
    if (!this.isDragging) {
      this.checkHover();
    }

    // Handle drag
    if (this.isDragging && this.dragObject) {
      const intersection = this.raycastTerrain();
      if (intersection) {
        const delta = new THREE.Vector3().subVectors(
          intersection.point,
          this.dragObject.position
        );
        this.emit('drag', { object: this.dragObject, delta });
      }
    }
  }

  /**
   * Handle mouse down
   */
  private handleMouseDown(event: MouseEvent): void {
    if (event.button !== 0) return; // Only left click

    this.updateMousePosition(event);
    this.dragStartPosition = this.mouse.clone();

    // Check for pickable object
    const picked = this.pickObject();
    if (picked) {
      this.dragObject = picked.object;
      this.isDragging = true;
      this.emit('dragStart', { object: picked.object, point: picked.point });
    }
  }

  /**
   * Handle mouse up
   */
  private handleMouseUp(event: MouseEvent): void {
    if (this.isDragging && this.dragObject) {
      this.emit('dragEnd', { object: this.dragObject });
      this.isDragging = false;
      this.dragObject = null;
    }

    this.dragStartPosition = null;
  }

  /**
   * Handle click
   */
  private handleClick(event: MouseEvent): void {
    // Don't emit click if we were dragging
    if (this.dragStartPosition && this.mouse.distanceTo(this.dragStartPosition) > this.dragThreshold / 100) {
      return;
    }

    this.updateMousePosition(event);

    // Check for object pick
    const picked = this.pickObject();
    if (picked) {
      this.emit('objectClick', { object: picked.object, point: picked.point });
      return;
    }

    // Check for terrain click
    const terrain = this.raycastTerrain();
    if (terrain) {
      this.emit('terrainClick', { point: terrain.point, normal: terrain.normal });
    }
  }

  /**
   * Update mouse position to normalized device coordinates
   */
  private updateMousePosition(event: MouseEvent): void {
    const rect = this.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  /**
   * Check for hover with debouncing
   */
  private checkHover(): void {
    if (this.hoverDebounceTimer) {
      clearTimeout(this.hoverDebounceTimer);
    }

    this.hoverDebounceTimer = setTimeout(() => {
      const picked = this.pickObject();

      if (picked && picked.object !== this.hoveredObject) {
        // New hover
        if (this.hoveredObject) {
          this.emit('hoverEnd', { object: this.hoveredObject });
        }
        this.hoveredObject = picked.object;
        this.emit('hoverStart', { object: this.hoveredObject, point: picked.point });
      } else if (!picked && this.hoveredObject) {
        // Hover ended
        this.emit('hoverEnd', { object: this.hoveredObject });
        this.hoveredObject = null;
      }
    }, this.hoverDebounce);
  }

  /**
   * Raycast to find pickable objects
   */
  public pickObject(): Intersection | null {
    this.raycaster.setFromCamera(this.mouse, this.camera);

    const objects = this.pickableLayer
      ? this.pickableLayer.children
      : this.scene.children;

    const intersects = this.raycaster.intersectObjects(objects, true);

    if (intersects.length > 0) {
      const closest = intersects[0];
      return {
        object: closest.object,
        point: closest.point,
        distance: closest.distance,
        normal: closest.face?.normal,
      };
    }

    return null;
  }

  /**
   * Raycast to find terrain intersection
   */
  public raycastTerrain(): Intersection | null {
    this.raycaster.setFromCamera(this.mouse, this.camera);

    const objects = this.terrainLayer
      ? this.terrainLayer.children
      : this.scene.children.filter(obj => obj.userData.isTerrain);

    const intersects = this.raycaster.intersectObjects(objects, true);

    if (intersects.length > 0) {
      const closest = intersects[0];
      return {
        object: closest.object,
        point: closest.point,
        distance: closest.distance,
        normal: closest.face?.normal,
      };
    }

    return null;
  }

  /**
   * Get terrain height at specific XZ position
   */
  public getTerrainHeight(x: number, z: number): number | null {
    // Cast ray downward from high Y position
    const origin = new THREE.Vector3(x, 1000, z);
    const direction = new THREE.Vector3(0, -1, 0);

    this.raycaster.set(origin, direction);

    const objects = this.terrainLayer
      ? this.terrainLayer.children
      : this.scene.children.filter(obj => obj.userData.isTerrain);

    const intersects = this.raycaster.intersectObjects(objects, true);

    if (intersects.length > 0) {
      return intersects[0].point.y;
    }

    return null;
  }

  /**
   * Raycast from arbitrary position and direction
   */
  public raycast(
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    objects?: THREE.Object3D[]
  ): Intersection[] {
    this.raycaster.set(origin, direction.normalize());

    const targets = objects ?? this.scene.children;
    const intersects = this.raycaster.intersectObjects(targets, true);

    return intersects.map(i => ({
      object: i.object,
      point: i.point,
      distance: i.distance,
      normal: i.face?.normal,
    }));
  }

  /**
   * Set terrain layer
   */
  public setTerrainLayer(layer: THREE.Object3D | null): void {
    this.terrainLayer = layer;
  }

  /**
   * Set pickable layer
   */
  public setPickableLayer(layer: THREE.Object3D | null): void {
    this.pickableLayer = layer;
  }

  /**
   * Register event listener
   */
  public on(event: string, callback: InteractionCallback): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(callback);
  }

  /**
   * Unregister event listener
   */
  public off(event: string, callback: InteractionCallback): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.delete(callback);
    }
  }

  /**
   * Emit event
   */
  private emit(event: string, data: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => callback(data));
    }
  }

  /**
   * Dispose
   */
  public dispose(): void {
    this.disable();

    if (this.hoverDebounceTimer) {
      clearTimeout(this.hoverDebounceTimer);
    }

    this.eventListeners.clear();

    console.log('[RaycasterManager] Disposed');
  }
}
