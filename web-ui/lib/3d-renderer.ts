/**
 * TrinityCore MCP - 3D Rendering Engine
 *
 * WebGL-based 3D visualization using Three.js for VMap and MMap data.
 * Supports multiple camera modes, layer management, and performance optimization.
 *
 * Features:
 * - VMap rendering (collision geometry, model spawns)
 * - MMap rendering (navigation meshes, walkable areas)
 * - Multiple camera modes (Orbit, Fly, FPS)
 * - Layer visibility controls
 * - LOD and frustum culling
 * - Performance monitoring
 *
 * @module 3d-renderer
 */

import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { FlyControls } from "three/examples/jsm/controls/FlyControls.js";
import { FirstPersonControls } from "three/examples/jsm/controls/FirstPersonControls.js";
import type { MMapData, NavMeshTile } from "./mmap-types";
import type { ModelSpawn, VMapData } from "./vmap-types";

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Camera mode enum
 */
export enum CameraMode {
  Orbit = "orbit",
  Fly = "fly",
  FPS = "fps",
}

/**
 * Render layer enum
 */
export enum RenderLayer {
  VMapCollision = "vmap-collision",
  VMapSpawns = "vmap-spawns",
  MMapNavMesh = "mmap-navmesh",
  MMapOffMesh = "mmap-offmesh",
  Grid = "grid",
  Axes = "axes",
}

/**
 * Render settings
 */
export interface RenderSettings {
  /** Enable shadows */
  shadows?: boolean;

  /** Enable anti-aliasing */
  antialias?: boolean;

  /** Enable fog */
  fog?: boolean;

  /** Fog density */
  fogDensity?: number;

  /** Background color */
  backgroundColor?: number;

  /** Ambient light intensity */
  ambientLight?: number;

  /** Directional light intensity */
  directionalLight?: number;

  /** Show wireframe */
  wireframe?: boolean;

  /** VMap opacity */
  vmapOpacity?: number;

  /** MMap opacity */
  mmapOpacity?: number;

  /** Height exaggeration */
  heightScale?: number;

  /** Enable frustum culling */
  frustumCulling?: boolean;

  /** Enable LOD */
  lod?: boolean;
}

/**
 * Layer visibility state
 */
export interface LayerVisibility {
  [RenderLayer.VMapCollision]: boolean;
  [RenderLayer.VMapSpawns]: boolean;
  [RenderLayer.MMapNavMesh]: boolean;
  [RenderLayer.MMapOffMesh]: boolean;
  [RenderLayer.Grid]: boolean;
  [RenderLayer.Axes]: boolean;
}

/**
 * Rendering statistics
 */
export interface RenderStats {
  fps: number;
  frameTime: number;
  triangles: number;
  drawCalls: number;
  memory: number;
  objects: number;
}

/**
 * 3D Renderer class
 */
export class Renderer3D {
  // Core Three.js objects
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls | FlyControls | FirstPersonControls | null = null;

  // Containers for different layers
  private vmapGroup: THREE.Group;
  private mmapGroup: THREE.Group;
  private gridGroup: THREE.Group;
  private axesGroup: THREE.Group;

  // State
  private cameraMode: CameraMode = CameraMode.Orbit;
  private layerVisibility: LayerVisibility;
  private settings: RenderSettings;
  private animationId: number | null = null;
  private lastFrameTime: number = 0;
  private fps: number = 60;

  // Data
  private vmapData: VMapData | null = null;
  private mmapData: MMapData | null = null;

  /**
   * Constructor
   */
  constructor(
    private container: HTMLElement,
    settings: Partial<RenderSettings> = {},
  ) {
    // Initialize settings
    this.settings = {
      shadows: true,
      antialias: true,
      fog: false,
      fogDensity: 0.001,
      backgroundColor: 0x87ceeb,
      ambientLight: 0.5,
      directionalLight: 0.8,
      wireframe: false,
      vmapOpacity: 0.8,
      mmapOpacity: 0.6,
      heightScale: 1.0,
      frustumCulling: true,
      lod: true,
      ...settings,
    };

    // Initialize layer visibility
    this.layerVisibility = {
      [RenderLayer.VMapCollision]: true,
      [RenderLayer.VMapSpawns]: true,
      [RenderLayer.MMapNavMesh]: true,
      [RenderLayer.MMapOffMesh]: true,
      [RenderLayer.Grid]: true,
      [RenderLayer.Axes]: true,
    };

    // Initialize scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(this.settings.backgroundColor);

    // Setup fog
    if (this.settings.fog) {
      this.scene.fog = new THREE.FogExp2(0x000000, this.settings.fogDensity);
    }

    // Initialize camera
    const aspect = container.clientWidth / container.clientHeight;
    this.camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 10000);
    this.camera.position.set(0, 100, 100);
    this.camera.lookAt(0, 0, 0);

    // Initialize renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: this.settings.antialias,
    });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.shadowMap.enabled = this.settings.shadows ?? false;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    // Initialize groups
    this.vmapGroup = new THREE.Group();
    this.vmapGroup.name = "VMap";
    this.scene.add(this.vmapGroup);

    this.mmapGroup = new THREE.Group();
    this.mmapGroup.name = "MMap";
    this.scene.add(this.mmapGroup);

    this.gridGroup = new THREE.Group();
    this.gridGroup.name = "Grid";
    this.scene.add(this.gridGroup);

    this.axesGroup = new THREE.Group();
    this.axesGroup.name = "Axes";
    this.scene.add(this.axesGroup);

    // Setup lights
    this.setupLights();

    // Setup helpers
    this.setupHelpers();

    // Setup controls
    this.setupControls(CameraMode.Orbit);

    // Handle window resize
    window.addEventListener("resize", this.onWindowResize.bind(this));
  }

  /**
   * Setup lights
   */
  private setupLights(): void {
    // Ambient light
    const ambient = new THREE.AmbientLight(
      0xffffff,
      this.settings.ambientLight,
    );
    this.scene.add(ambient);

    // Directional light (sun)
    const directional = new THREE.DirectionalLight(
      0xffffff,
      this.settings.directionalLight,
    );
    directional.position.set(100, 200, 100);
    directional.castShadow = this.settings.shadows ?? false;
    directional.shadow.camera.left = -1000;
    directional.shadow.camera.right = 1000;
    directional.shadow.camera.top = 1000;
    directional.shadow.camera.bottom = -1000;
    directional.shadow.camera.near = 0.5;
    directional.shadow.camera.far = 5000;
    directional.shadow.mapSize.width = 2048;
    directional.shadow.mapSize.height = 2048;
    this.scene.add(directional);

    // Hemisphere light (sky/ground)
    const hemisphere = new THREE.HemisphereLight(0x87ceeb, 0x444444, 0.3);
    hemisphere.position.set(0, 500, 0);
    this.scene.add(hemisphere);
  }

  /**
   * Setup helper objects (grid, axes)
   */
  private setupHelpers(): void {
    // Grid helper
    const gridSize = 1000;
    const gridDivisions = 100;
    const gridHelper = new THREE.GridHelper(gridSize, gridDivisions);
    this.gridGroup.add(gridHelper);

    // Axes helper
    const axesSize = 100;
    const axesHelper = new THREE.AxesHelper(axesSize);
    this.axesGroup.add(axesHelper);
  }

  /**
   * Setup camera controls
   */
  private setupControls(mode: CameraMode): void {
    // Dispose existing controls
    if (this.controls) {
      this.controls.dispose();
    }

    switch (mode) {
      case CameraMode.Orbit:
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.screenSpacePanning = false;
        this.controls.minDistance = 10;
        this.controls.maxDistance = 5000;
        this.controls.maxPolarAngle = Math.PI / 2;
        break;

      case CameraMode.Fly:
        this.controls = new FlyControls(this.camera, this.renderer.domElement);
        this.controls.movementSpeed = 50;
        this.controls.rollSpeed = Math.PI / 12;
        this.controls.autoForward = false;
        this.controls.dragToLook = true;
        break;

      case CameraMode.FPS:
        this.controls = new FirstPersonControls(
          this.camera,
          this.renderer.domElement,
        );
        this.controls.movementSpeed = 50;
        this.controls.lookSpeed = 0.1;
        this.controls.lookVertical = true;
        break;
    }

    this.cameraMode = mode;
  }

  /**
   * Handle window resize
   */
  private onWindowResize(): void {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(width, height);
  }

  /**
   * Load VMap data and create geometry
   */
  public loadVMapData(vmapData: VMapData): void {
    this.vmapData = vmapData;

    // Clear existing VMap geometry
    this.vmapGroup.clear();

    // Create collision mesh geometry
    this.createVMapCollisionGeometry(vmapData);

    // Create spawn markers
    this.createVMapSpawnMarkers(vmapData);

    // Center camera on data
    this.centerCameraOnBounds(vmapData.bounds);
  }

  /**
   * Create VMap collision geometry
   */
  private createVMapCollisionGeometry(vmapData: VMapData): void {
    const collisionGroup = new THREE.Group();
    collisionGroup.name = RenderLayer.VMapCollision;

    // For each spawn, create a bounding box mesh
    for (const spawn of vmapData.allSpawns) {
      // Calculate box dimensions
      const size = new THREE.Vector3(
        spawn.bounds.max.x - spawn.bounds.min.x,
        spawn.bounds.max.y - spawn.bounds.min.y,
        spawn.bounds.max.z - spawn.bounds.min.z,
      );

      // Calculate center
      const center = new THREE.Vector3(
        (spawn.bounds.min.x + spawn.bounds.max.x) / 2,
        (spawn.bounds.min.y + spawn.bounds.max.y) / 2,
        (spawn.bounds.min.z + spawn.bounds.max.z) / 2,
      );

      // Create box geometry
      const geometry = new THREE.BoxGeometry(size.x, size.y, size.z);
      const material = new THREE.MeshStandardMaterial({
        color: 0x00ff00,
        opacity: this.settings.vmapOpacity,
        transparent: true,
        wireframe: this.settings.wireframe,
        side: THREE.DoubleSide,
      });

      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.copy(center);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData = { spawn };

      collisionGroup.add(mesh);
    }

    this.vmapGroup.add(collisionGroup);
  }

  /**
   * Create VMap spawn markers
   */
  private createVMapSpawnMarkers(vmapData: VMapData): void {
    const spawnGroup = new THREE.Group();
    spawnGroup.name = RenderLayer.VMapSpawns;

    for (const spawn of vmapData.allSpawns) {
      // Create sphere marker at spawn position
      const geometry = new THREE.SphereGeometry(2, 16, 16);
      const material = new THREE.MeshBasicMaterial({
        color: 0xff0000,
      });

      const marker = new THREE.Mesh(geometry, material);
      marker.position.set(spawn.position.x, spawn.position.y, spawn.position.z);
      marker.userData = { spawn };

      spawnGroup.add(marker);
    }

    this.vmapGroup.add(spawnGroup);
  }

  /**
   * Load MMap data and create geometry
   */
  public loadMMapData(mmapData: MMapData): void {
    this.mmapData = mmapData;

    // Clear existing MMap geometry
    this.mmapGroup.clear();

    // Create navigation mesh geometry
    this.createMMapNavMeshGeometry(mmapData);

    // Create off-mesh connection markers
    this.createMMapOffMeshMarkers(mmapData);
  }

  /**
   * Create MMap navigation mesh geometry
   */
  private createMMapNavMeshGeometry(mmapData: MMapData): void {
    const navMeshGroup = new THREE.Group();
    navMeshGroup.name = RenderLayer.MMapNavMesh;

    for (const [tileKey, tile] of mmapData.tiles.entries()) {
      // Create geometry for this tile
      const geometry = this.createNavMeshTileGeometry(tile);

      // Color-code by area type
      const material = new THREE.MeshStandardMaterial({
        color: this.getNavMeshColor(tile),
        opacity: this.settings.mmapOpacity,
        transparent: true,
        wireframe: this.settings.wireframe,
        side: THREE.DoubleSide,
      });

      const mesh = new THREE.Mesh(geometry, material);
      mesh.castShadow = false;
      mesh.receiveShadow = true;
      mesh.userData = { tile, tileKey };

      navMeshGroup.add(mesh);
    }

    this.mmapGroup.add(navMeshGroup);
  }

  /**
   * Create geometry for a single navigation mesh tile
   */
  private createNavMeshTileGeometry(tile: NavMeshTile): THREE.BufferGeometry {
    const positions: number[] = [];
    const indices: number[] = [];
    let vertexOffset = 0;

    // For each polygon, create triangles
    for (const poly of tile.polys) {
      if (poly.vertCount < 3) continue;

      // Get vertices for this polygon
      const polyVerts = poly.verts.slice(0, poly.vertCount);

      // Triangulate polygon (simple fan triangulation)
      for (let i = 1; i < poly.vertCount - 1; i++) {
        const v0 = tile.verts[polyVerts[0]];
        const v1 = tile.verts[polyVerts[i]];
        const v2 = tile.verts[polyVerts[i + 1]];

        // Add positions
        positions.push(v0[0], v0[1], v0[2]);
        positions.push(v1[0], v1[1], v1[2]);
        positions.push(v2[0], v2[1], v2[2]);

        // Add indices
        indices.push(vertexOffset, vertexOffset + 1, vertexOffset + 2);
        vertexOffset += 3;
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3),
    );
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    return geometry;
  }

  /**
   * Get color for navigation mesh based on area type
   */
  private getNavMeshColor(tile: NavMeshTile): number {
    // Use first polygon's area type as representative
    if (tile.polys.length === 0) return 0x808080;

    const areaType = tile.polys[0].areaAndtype & 0x3f;

    // Color coding for different terrain types
    switch (areaType) {
      case 11: // GROUND
        return 0x00ff00; // Green
      case 10: // GROUND_STEEP
        return 0xffff00; // Yellow
      case 9: // WATER
        return 0x0000ff; // Blue
      case 8: // MAGMA_SLIME
        return 0xff0000; // Red
      default:
        return 0x808080; // Gray
    }
  }

  /**
   * Create off-mesh connection markers
   */
  private createMMapOffMeshMarkers(mmapData: MMapData): void {
    const offMeshGroup = new THREE.Group();
    offMeshGroup.name = RenderLayer.MMapOffMesh;

    for (const connection of mmapData.offMeshConnections) {
      // Create line from start to end
      const start = new THREE.Vector3(
        connection.pos[0],
        connection.pos[1],
        connection.pos[2],
      );
      const end = new THREE.Vector3(
        connection.pos[3],
        connection.pos[4],
        connection.pos[5],
      );

      const points = [start, end];
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const material = new THREE.LineBasicMaterial({
        color: 0xff00ff,
        linewidth: 2,
      });

      const line = new THREE.Line(geometry, material);
      line.userData = { connection };

      offMeshGroup.add(line);
    }

    this.mmapGroup.add(offMeshGroup);
  }

  /**
   * Center camera on bounding box
   */
  private centerCameraOnBounds(bounds: { min: { x: number; y: number; z: number }; max: { x: number; y: number; z: number } }): void {
    const center = new THREE.Vector3(
      (bounds.min.x + bounds.max.x) / 2,
      (bounds.min.y + bounds.max.y) / 2,
      (bounds.min.z + bounds.max.z) / 2,
    );

    const size = new THREE.Vector3(
      bounds.max.x - bounds.min.x,
      bounds.max.y - bounds.min.y,
      bounds.max.z - bounds.max.z,
    );

    const maxDim = Math.max(size.x, size.y, size.z);
    const distance = maxDim * 1.5;

    this.camera.position.set(
      center.x + distance,
      center.y + distance,
      center.z + distance,
    );
    this.camera.lookAt(center);

    if (this.controls && "target" in this.controls) {
      this.controls.target.copy(center);
    }
  }

  /**
   * Toggle layer visibility
   */
  public setLayerVisibility(layer: RenderLayer, visible: boolean): void {
    this.layerVisibility[layer] = visible;

    // Find and update group visibility
    const groups = [this.vmapGroup, this.mmapGroup, this.gridGroup, this.axesGroup];
    for (const group of groups) {
      group.traverse((child) => {
        if (child.name === layer) {
          child.visible = visible;
        }
      });
    }
  }

  /**
   * Set camera mode
   */
  public setCameraMode(mode: CameraMode): void {
    this.setupControls(mode);
  }

  /**
   * Update settings
   */
  public updateSettings(settings: Partial<RenderSettings>): void {
    this.settings = { ...this.settings, ...settings };

    // Apply settings
    if (settings.backgroundColor !== undefined) {
      this.scene.background = new THREE.Color(settings.backgroundColor);
    }

    if (settings.wireframe !== undefined) {
      this.scene.traverse((object) => {
        if ((object as THREE.Mesh).isMesh) {
          const mesh = object as THREE.Mesh;
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach((mat) => {
              if ((mat as THREE.Material).type.includes("Mesh")) {
                (mat as THREE.MeshStandardMaterial).wireframe = settings.wireframe!;
              }
            });
          } else if ((mesh.material as THREE.Material).type.includes("Mesh")) {
            (mesh.material as THREE.MeshStandardMaterial).wireframe = settings.wireframe!;
          }
        }
      });
    }
  }

  /**
   * Start rendering loop
   */
  public start(): void {
    if (this.animationId !== null) return;

    const animate = (time: number): void => {
      this.animationId = requestAnimationFrame(animate);

      // Calculate FPS
      if (this.lastFrameTime > 0) {
        const delta = time - this.lastFrameTime;
        this.fps = 1000 / delta;
      }
      this.lastFrameTime = time;

      // Update controls
      if (this.controls) {
        if ("update" in this.controls) {
          if (
            this.controls instanceof FlyControls ||
            this.controls instanceof FirstPersonControls
          ) {
            this.controls.update(0.016); // 60 FPS delta
          } else {
            this.controls.update();
          }
        }
      }

      // Render scene
      this.renderer.render(this.scene, this.camera);
    };

    animate(performance.now());
  }

  /**
   * Stop rendering loop
   */
  public stop(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  /**
   * Get rendering statistics
   */
  public getStats(): RenderStats {
    return {
      fps: Math.round(this.fps),
      frameTime: 1000 / this.fps,
      triangles: this.renderer.info.render.triangles,
      drawCalls: this.renderer.info.render.calls,
      memory: this.renderer.info.memory.geometries + this.renderer.info.memory.textures,
      objects: this.scene.children.length,
    };
  }

  /**
   * Dispose resources
   */
  public dispose(): void {
    this.stop();

    // Dispose controls
    if (this.controls) {
      this.controls.dispose();
    }

    // Dispose geometries and materials
    this.scene.traverse((object) => {
      if ((object as THREE.Mesh).isMesh) {
        const mesh = object as THREE.Mesh;
        mesh.geometry.dispose();
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((mat) => mat.dispose());
        } else {
          mesh.material.dispose();
        }
      }
    });

    // Dispose renderer
    this.renderer.dispose();

    // Remove canvas from DOM
    this.container.removeChild(this.renderer.domElement);

    // Remove event listener
    window.removeEventListener("resize", this.onWindowResize.bind(this));
  }
}
