/**
 * ControlsManager - Camera controls and user interaction
 *
 * Provides OrbitControls integration with custom keyboard shortcuts,
 * state persistence, and smooth camera movements.
 *
 * @module lib/three/controls-manager
 */

import * as THREE from 'three';
import { OrbitControls } from 'three-stdlib';

export interface ControlsOptions {
  enableDamping?: boolean;
  dampingFactor?: number;
  minDistance?: number;
  maxDistance?: number;
  minPolarAngle?: number;
  maxPolarAngle?: number;
  enablePan?: boolean;
  panSpeed?: number;
  enableZoom?: boolean;
  zoomSpeed?: number;
  enableRotate?: boolean;
  rotateSpeed?: number;
  autoRotate?: boolean;
  autoRotateSpeed?: number;
}

export interface ControlState {
  target: { x: number; y: number; z: number };
  distance: number;
  azimuthAngle: number;
  polarAngle: number;
}

export interface KeyboardState {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  shift: boolean;
}

/**
 * Camera controls manager
 */
export class ControlsManager {
  private controls: OrbitControls;
  private camera: THREE.PerspectiveCamera;
  private domElement: HTMLElement;

  // Keyboard state
  private keyboardState: KeyboardState = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    up: false,
    down: false,
    shift: false,
  };

  // Movement
  private moveSpeed = 100; // Units per second
  private sprintMultiplier = 3;
  private isMoving = false;

  // Event listeners
  private keyDownListener: (e: KeyboardEvent) => void;
  private keyUpListener: (e: KeyboardEvent) => void;
  private changeListener: () => void;

  // Options
  private options: Required<ControlsOptions>;

  constructor(
    camera: THREE.PerspectiveCamera,
    domElement: HTMLElement,
    options: ControlsOptions = {}
  ) {
    this.camera = camera;
    this.domElement = domElement;

    this.options = {
      enableDamping: options.enableDamping ?? true,
      dampingFactor: options.dampingFactor ?? 0.05,
      minDistance: options.minDistance ?? 10,
      maxDistance: options.maxDistance ?? 5000,
      minPolarAngle: options.minPolarAngle ?? 0,
      maxPolarAngle: options.maxPolarAngle ?? Math.PI / 2, // Don't allow below ground
      enablePan: options.enablePan ?? true,
      panSpeed: options.panSpeed ?? 1.0,
      enableZoom: options.enableZoom ?? true,
      zoomSpeed: options.zoomSpeed ?? 1.0,
      enableRotate: options.enableRotate ?? true,
      rotateSpeed: options.rotateSpeed ?? 0.5,
      autoRotate: options.autoRotate ?? false,
      autoRotateSpeed: options.autoRotateSpeed ?? 2.0,
    };

    // Create OrbitControls
    this.controls = new OrbitControls(camera, domElement);
    this.applyOptions();

    // Bind event listeners
    this.keyDownListener = this.handleKeyDown.bind(this);
    this.keyUpListener = this.handleKeyUp.bind(this);
    this.changeListener = this.handleChange.bind(this);

    console.log('[ControlsManager] Initialized');
  }

  /**
   * Apply options to controls
   */
  private applyOptions(): void {
    this.controls.enableDamping = this.options.enableDamping;
    this.controls.dampingFactor = this.options.dampingFactor;
    this.controls.minDistance = this.options.minDistance;
    this.controls.maxDistance = this.options.maxDistance;
    this.controls.minPolarAngle = this.options.minPolarAngle;
    this.controls.maxPolarAngle = this.options.maxPolarAngle;
    this.controls.enablePan = this.options.enablePan;
    this.controls.panSpeed = this.options.panSpeed;
    this.controls.enableZoom = this.options.enableZoom;
    this.controls.zoomSpeed = this.options.zoomSpeed;
    this.controls.enableRotate = this.options.enableRotate;
    this.controls.rotateSpeed = this.options.rotateSpeed;
    this.controls.autoRotate = this.options.autoRotate;
    this.controls.autoRotateSpeed = this.options.autoRotateSpeed;

    // Mouse buttons
    this.controls.mouseButtons = {
      LEFT: THREE.MOUSE.ROTATE,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.PAN,
    };
  }

  /**
   * Enable controls
   */
  public enable(): void {
    this.controls.enabled = true;
    this.domElement.addEventListener('keydown', this.keyDownListener);
    this.domElement.addEventListener('keyup', this.keyUpListener);
    this.controls.addEventListener('change', this.changeListener);

    // Make element focusable for keyboard events
    if (!this.domElement.getAttribute('tabindex')) {
      this.domElement.setAttribute('tabindex', '0');
    }

    console.log('[ControlsManager] Enabled');
  }

  /**
   * Disable controls
   */
  public disable(): void {
    this.controls.enabled = false;
    this.domElement.removeEventListener('keydown', this.keyDownListener);
    this.domElement.removeEventListener('keyup', this.keyUpListener);
    this.controls.removeEventListener('change', this.changeListener);

    console.log('[ControlsManager] Disabled');
  }

  /**
   * Handle keyboard key down
   */
  private handleKeyDown(event: KeyboardEvent): void {
    // Don't capture if typing in input
    if (
      event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLTextAreaElement
    ) {
      return;
    }

    const key = event.key.toLowerCase();

    switch (key) {
      case 'w':
      case 'arrowup':
        this.keyboardState.forward = true;
        this.isMoving = true;
        break;
      case 's':
      case 'arrowdown':
        this.keyboardState.backward = true;
        this.isMoving = true;
        break;
      case 'a':
      case 'arrowleft':
        this.keyboardState.left = true;
        this.isMoving = true;
        break;
      case 'd':
      case 'arrowright':
        this.keyboardState.right = true;
        this.isMoving = true;
        break;
      case 'q':
      case 'pageup':
        this.keyboardState.up = true;
        this.isMoving = true;
        break;
      case 'e':
      case 'pagedown':
        this.keyboardState.down = true;
        this.isMoving = true;
        break;
      case 'shift':
        this.keyboardState.shift = true;
        break;
    }

    event.preventDefault();
  }

  /**
   * Handle keyboard key up
   */
  private handleKeyUp(event: KeyboardEvent): void {
    const key = event.key.toLowerCase();

    switch (key) {
      case 'w':
      case 'arrowup':
        this.keyboardState.forward = false;
        break;
      case 's':
      case 'arrowdown':
        this.keyboardState.backward = false;
        break;
      case 'a':
      case 'arrowleft':
        this.keyboardState.left = false;
        break;
      case 'd':
      case 'arrowright':
        this.keyboardState.right = false;
        break;
      case 'q':
      case 'pageup':
        this.keyboardState.up = false;
        break;
      case 'e':
      case 'pagedown':
        this.keyboardState.down = false;
        break;
      case 'shift':
        this.keyboardState.shift = false;
        break;
    }

    // Check if still moving
    this.isMoving =
      this.keyboardState.forward ||
      this.keyboardState.backward ||
      this.keyboardState.left ||
      this.keyboardState.right ||
      this.keyboardState.up ||
      this.keyboardState.down;

    event.preventDefault();
  }

  /**
   * Handle controls change
   */
  private handleChange(): void {
    // Override if needed
  }

  /**
   * Update controls (call every frame)
   */
  public update(delta: number): void {
    // Apply keyboard movement
    if (this.isMoving) {
      this.applyKeyboardMovement(delta);
    }

    // Update OrbitControls (for damping)
    this.controls.update();
  }

  /**
   * Apply keyboard movement to camera
   */
  private applyKeyboardMovement(delta: number): void {
    const speed = this.moveSpeed * delta * (this.keyboardState.shift ? this.sprintMultiplier : 1);

    // Get camera direction vectors
    const forward = new THREE.Vector3();
    const right = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);

    this.camera.getWorldDirection(forward);
    forward.y = 0; // Keep movement horizontal
    forward.normalize();

    right.crossVectors(forward, up).normalize();

    // Calculate movement vector
    const movement = new THREE.Vector3();

    if (this.keyboardState.forward) movement.add(forward);
    if (this.keyboardState.backward) movement.sub(forward);
    if (this.keyboardState.right) movement.add(right);
    if (this.keyboardState.left) movement.sub(right);
    if (this.keyboardState.up) movement.add(up);
    if (this.keyboardState.down) movement.sub(up);

    if (movement.length() > 0) {
      movement.normalize().multiplyScalar(speed);

      // Move camera and target
      this.camera.position.add(movement);
      this.controls.target.add(movement);
    }
  }

  /**
   * Focus on a specific point
   */
  public focusOn(x: number, y: number, z: number, distance?: number): void {
    const target = new THREE.Vector3(x, y, z);
    this.controls.target.copy(target);

    if (distance !== undefined) {
      // Calculate new camera position
      const direction = new THREE.Vector3()
        .subVectors(this.camera.position, target)
        .normalize();

      const newPosition = target.clone().add(direction.multiplyScalar(distance));
      this.camera.position.copy(newPosition);
    }

    this.controls.update();
  }

  /**
   * Reset camera to default position
   */
  public reset(): void {
    this.camera.position.set(0, 500, 500);
    this.controls.target.set(0, 0, 0);
    this.camera.up.set(0, 1, 0);
    this.controls.update();
  }

  /**
   * Get current state
   */
  public getState(): ControlState {
    const distance = this.camera.position.distanceTo(this.controls.target);
    const direction = new THREE.Vector3().subVectors(this.camera.position, this.controls.target);

    const azimuthAngle = Math.atan2(direction.x, direction.z);
    const polarAngle = Math.acos(direction.y / distance);

    return {
      target: {
        x: this.controls.target.x,
        y: this.controls.target.y,
        z: this.controls.target.z,
      },
      distance,
      azimuthAngle,
      polarAngle,
    };
  }

  /**
   * Restore state
   */
  public setState(state: ControlState): void {
    this.controls.target.set(state.target.x, state.target.y, state.target.z);

    // Calculate camera position from spherical coordinates
    const position = new THREE.Vector3();
    position.x = state.distance * Math.sin(state.polarAngle) * Math.sin(state.azimuthAngle);
    position.y = state.distance * Math.cos(state.polarAngle);
    position.z = state.distance * Math.sin(state.polarAngle) * Math.cos(state.azimuthAngle);
    position.add(this.controls.target);

    this.camera.position.copy(position);
    this.controls.update();
  }

  /**
   * Enable auto-rotate
   */
  public setAutoRotate(enabled: boolean, speed?: number): void {
    this.controls.autoRotate = enabled;
    if (speed !== undefined) {
      this.controls.autoRotateSpeed = speed;
    }
  }

  /**
   * Set movement speed
   */
  public setMoveSpeed(speed: number): void {
    this.moveSpeed = speed;
  }

  /**
   * Get OrbitControls instance
   */
  public getControls(): OrbitControls {
    return this.controls;
  }

  /**
   * Dispose
   */
  public dispose(): void {
    this.disable();
    this.controls.dispose();

    console.log('[ControlsManager] Disposed');
  }
}
