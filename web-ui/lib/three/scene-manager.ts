/**
 * SceneManager - Central Three.js scene management
 *
 * Handles scene initialization, rendering, camera management, and lifecycle.
 * Provides a high-level API for 3D world editor functionality.
 *
 * @module lib/three/scene-manager
 */

import * as THREE from 'three';

export interface SceneOptions {
  antialias?: boolean;
  shadows?: boolean;
  showGrid?: boolean;
  showAxes?: boolean;
  backgroundColor?: number;
  fogEnabled?: boolean;
  fogColor?: number;
  fogNear?: number;
  fogFar?: number;
}

export interface CameraState {
  position: { x: number; y: number; z: number };
  target: { x: number; y: number; z: number };
  fov: number;
  zoom: number;
}

export interface PerformanceStats {
  fps: number;
  frameTime: number;
  triangles: number;
  drawCalls: number;
  geometries: number;
  textures: number;
}

/**
 * Main scene manager class for Three.js integration
 */
export class SceneManager {
  // Core Three.js components
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private canvas: HTMLCanvasElement;

  // Helpers
  private gridHelper: THREE.GridHelper | null = null;
  private axesHelper: THREE.AxesHelper | null = null;

  // Animation
  private animationFrameId: number | null = null;
  private isAnimating = false;

  // Performance tracking
  private clock: THREE.Clock;
  private lastFrameTime = 0;
  private frameCount = 0;
  private fps = 60;

  // Event system
  private eventListeners: Map<string, Set<Function>> = new Map();

  // Options
  private options: Required<SceneOptions>;

  // Resize observer
  private resizeObserver: ResizeObserver | null = null;

  constructor(canvas: HTMLCanvasElement, options: SceneOptions = {}) {
    this.canvas = canvas;
    this.options = {
      antialias: options.antialias ?? true,
      shadows: options.shadows ?? true,
      showGrid: options.showGrid ?? true,
      showAxes: options.showAxes ?? false,
      backgroundColor: options.backgroundColor ?? 0x1a1a2e,
      fogEnabled: options.fogEnabled ?? true,
      fogColor: options.fogColor ?? 0x1a1a2e,
      fogNear: options.fogNear ?? 500,
      fogFar: options.fogFar ?? 3000,
    };

    // Initialize clock
    this.clock = new THREE.Clock();

    // Initialize scene
    this.scene = this.createScene();

    // Initialize camera
    this.camera = this.createCamera();

    // Initialize renderer
    this.renderer = this.createRenderer();

    // Setup helpers
    this.setupHelpers();

    // Setup resize handling
    this.setupResizeObserver();

    console.log('[SceneManager] Initialized', {
      renderer: this.renderer.info.render,
      memory: this.renderer.info.memory,
    });
  }

  /**
   * Create the Three.js scene
   */
  private createScene(): THREE.Scene {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(this.options.backgroundColor);

    // Add fog for depth perception
    if (this.options.fogEnabled) {
      scene.fog = new THREE.Fog(
        this.options.fogColor,
        this.options.fogNear,
        this.options.fogFar
      );
    }

    return scene;
  }

  /**
   * Create the perspective camera
   */
  private createCamera(): THREE.PerspectiveCamera {
    const aspect = this.canvas.clientWidth / this.canvas.clientHeight;
    const camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 10000);

    // Default camera position (bird's eye view)
    camera.position.set(0, 500, 500);
    camera.lookAt(0, 0, 0);

    return camera;
  }

  /**
   * Create the WebGL renderer
   */
  private createRenderer(): THREE.WebGLRenderer {
    const renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: this.options.antialias,
      alpha: false,
      powerPreference: 'high-performance',
    });

    renderer.setSize(this.canvas.clientWidth, this.canvas.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Cap at 2x for performance

    // Enable shadows if requested (but limit for performance)
    if (this.options.shadows) {
      renderer.shadowMap.enabled = true;
      // Use basic shadows for better performance (PCFSoftShadowMap is expensive)
      renderer.shadowMap.type = THREE.BasicShadowMap;
      renderer.shadowMap.autoUpdate = false; // Only update when needed
    }

    // Output encoding for proper colors
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;

    return renderer;
  }

  /**
   * Setup scene helpers (grid, axes)
   */
  private setupHelpers(): void {
    if (this.options.showGrid) {
      // Grid size matching WoW coordinate system (~34km)
      this.gridHelper = new THREE.GridHelper(34000, 100, 0x444444, 0x222222);
      this.scene.add(this.gridHelper);
    }

    if (this.options.showAxes) {
      this.axesHelper = new THREE.AxesHelper(1000);
      this.scene.add(this.axesHelper);
    }
  }

  /**
   * Setup resize observer for responsive canvas
   */
  private setupResizeObserver(): void {
    this.resizeObserver = new ResizeObserver(() => {
      this.handleResize();
    });
    this.resizeObserver.observe(this.canvas);
  }

  /**
   * Handle canvas resize
   */
  private handleResize(): void {
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(width, height, false);

    this.emit('resize', { width, height });
  }

  /**
   * Start animation loop
   */
  public startAnimation(): void {
    if (this.isAnimating) return;

    this.isAnimating = true;
    this.animate();

    console.log('[SceneManager] Animation started');
  }

  /**
   * Stop animation loop
   */
  public stopAnimation(): void {
    if (!this.isAnimating) return;

    this.isAnimating = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    console.log('[SceneManager] Animation stopped');
  }

  /**
   * Animation loop
   */
  private animate = (): void => {
    if (!this.isAnimating) return;

    this.animationFrameId = requestAnimationFrame(this.animate);

    // Calculate delta time
    const delta = this.clock.getDelta();

    // Update FPS counter
    this.frameCount++;
    const currentTime = performance.now();
    if (currentTime - this.lastFrameTime >= 1000) {
      this.fps = Math.round((this.frameCount * 1000) / (currentTime - this.lastFrameTime));
      this.frameCount = 0;
      this.lastFrameTime = currentTime;
    }

    // Emit update event for custom animations
    this.emit('update', { delta, time: this.clock.elapsedTime });

    // Render scene
    this.render();
  };

  /**
   * Render a single frame
   */
  public render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  /**
   * Add object to scene
   */
  public add(object: THREE.Object3D): void {
    this.scene.add(object);
    this.emit('objectAdded', object);
  }

  /**
   * Remove object from scene
   */
  public remove(object: THREE.Object3D): void {
    this.scene.remove(object);
    this.emit('objectRemoved', object);
  }

  /**
   * Clear all objects from scene (except helpers)
   */
  public clear(): void {
    const objectsToRemove: THREE.Object3D[] = [];

    this.scene.children.forEach((child) => {
      // Keep helpers and built-in objects
      if (
        child !== this.gridHelper &&
        child !== this.axesHelper &&
        !(child instanceof THREE.Light)
      ) {
        objectsToRemove.push(child);
      }
    });

    objectsToRemove.forEach((obj) => {
      this.scene.remove(obj);

      // Dispose geometry and materials
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        if (Array.isArray(obj.material)) {
          obj.material.forEach((mat) => mat.dispose());
        } else {
          obj.material.dispose();
        }
      }
    });

    this.emit('cleared');
    console.log('[SceneManager] Scene cleared');
  }

  /**
   * Set camera position
   */
  public setCameraPosition(x: number, y: number, z: number): void {
    this.camera.position.set(x, y, z);
    this.emit('cameraMove', this.camera.position.clone());
  }

  /**
   * Focus camera on a point
   */
  public focusOnPoint(x: number, y: number, z: number, distance = 500): void {
    const target = new THREE.Vector3(x, y, z);

    // Calculate camera position maintaining current angle
    const direction = new THREE.Vector3()
      .subVectors(this.camera.position, target)
      .normalize();

    const newPosition = target.clone().add(direction.multiplyScalar(distance));

    this.camera.position.copy(newPosition);
    this.camera.lookAt(target);

    this.emit('cameraFocus', { target, distance });
  }

  /**
   * Get camera state
   */
  public getCameraState(): CameraState {
    const target = new THREE.Vector3();
    this.camera.getWorldDirection(target);
    target.multiplyScalar(100).add(this.camera.position);

    return {
      position: {
        x: this.camera.position.x,
        y: this.camera.position.y,
        z: this.camera.position.z,
      },
      target: {
        x: target.x,
        y: target.y,
        z: target.z,
      },
      fov: this.camera.fov,
      zoom: this.camera.zoom,
    };
  }

  /**
   * Set camera state
   */
  public setCameraState(state: CameraState): void {
    this.camera.position.set(state.position.x, state.position.y, state.position.z);
    this.camera.fov = state.fov;
    this.camera.zoom = state.zoom;
    this.camera.updateProjectionMatrix();

    const target = new THREE.Vector3(state.target.x, state.target.y, state.target.z);
    this.camera.lookAt(target);
  }

  /**
   * Get performance statistics
   */
  public getStats(): PerformanceStats {
    const info = this.renderer.info;

    return {
      fps: this.fps,
      frameTime: 1000 / this.fps,
      triangles: info.render.triangles,
      drawCalls: info.render.calls,
      geometries: info.memory.geometries,
      textures: info.memory.textures,
    };
  }

  /**
   * Toggle grid visibility
   */
  public setGridVisible(visible: boolean): void {
    if (this.gridHelper) {
      this.gridHelper.visible = visible;
    }
  }

  /**
   * Toggle axes visibility
   */
  public setAxesVisible(visible: boolean): void {
    if (this.axesHelper) {
      this.axesHelper.visible = visible;
    }
  }

  /**
   * Get scene reference (use with caution)
   */
  public getScene(): THREE.Scene {
    return this.scene;
  }

  /**
   * Get camera reference (use with caution)
   */
  public getCamera(): THREE.PerspectiveCamera {
    return this.camera;
  }

  /**
   * Get renderer reference (use with caution)
   */
  public getRenderer(): THREE.WebGLRenderer {
    return this.renderer;
  }

  /**
   * Event system - register listener
   */
  public on(event: string, callback: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(callback);
  }

  /**
   * Event system - unregister listener
   */
  public off(event: string, callback: Function): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.delete(callback);
    }
  }

  /**
   * Event system - emit event
   */
  private emit(event: string, data?: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach((callback) => callback(data));
    }
  }

  /**
   * Dispose of all resources
   */
  public dispose(): void {
    console.log('[SceneManager] Disposing...');

    // Stop animation
    this.stopAnimation();

    // Disconnect resize observer
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }

    // Clear scene
    this.clear();

    // Dispose helpers
    if (this.gridHelper) {
      this.gridHelper.geometry.dispose();
      (this.gridHelper.material as THREE.Material).dispose();
    }
    if (this.axesHelper) {
      this.axesHelper.geometry.dispose();
      (this.axesHelper.material as THREE.Material).dispose();
    }

    // Dispose renderer
    this.renderer.dispose();

    // Clear event listeners
    this.eventListeners.clear();

    console.log('[SceneManager] Disposed');
  }
}
