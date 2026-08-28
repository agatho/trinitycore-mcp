/**
 * VMapModelLoader - Load actual VMap model geometry from .vmo files
 *
 * This loader fetches .vmo files from the server and creates accurate
 * Three.js meshes with the actual collision geometry, transformed
 * according to each spawn's position/rotation/scale.
 *
 * @module lib/three/vmap-model-loader
 */

import * as THREE from 'three';
import { parseVMO, type WorldModel, type Vector3 as VMOVector3 } from '@/lib/vmo-parser';
import type { VMapData, VMapTile, ModelSpawn } from '@/lib/vmap-types';

export interface VMapModelLoadOptions {
  /** Maximum number of unique models to load (for performance) */
  maxModels?: number;
  /** Maximum triangles across all models */
  maxTriangles?: number;
  /** Maximum spawn instances per model (for instancing) */
  maxInstancesPerModel?: number;
  /** Use height-based vertex coloring */
  heightColors?: boolean;
  /** Enable wireframe mode */
  wireframe?: boolean;
  /** Mesh opacity */
  opacity?: number;
  /** Enable geometry merging for better performance */
  mergeGeometries?: boolean;
  /** Callback for progress updates */
  onProgress?: (loaded: number, total: number) => void;
}

export interface VMapModelResult {
  group: THREE.Group;
  triangleCount: number;
  vertexCount: number;
  modelCount: number;
  spawnCount: number;
  failedModels: string[];
}

/**
 * VMap Model Loader - loads actual geometry from .vmo files
 */
export class VMapModelLoader {
  private options: Required<Omit<VMapModelLoadOptions, 'onProgress'>> & { onProgress?: (loaded: number, total: number) => void };
  private modelCache: Map<string, WorldModel | null> = new Map();
  private materials: Map<string, THREE.Material> = new Map();

  constructor(options: VMapModelLoadOptions = {}) {
    this.options = {
      maxModels: options.maxModels ?? 100,           // Reduced from 500
      maxTriangles: options.maxTriangles ?? 500000,  // Reduced from 2M
      maxInstancesPerModel: options.maxInstancesPerModel ?? 50,
      heightColors: options.heightColors ?? true,
      wireframe: options.wireframe ?? false,
      opacity: options.opacity ?? 0.85,
      mergeGeometries: options.mergeGeometries ?? true,
      onProgress: options.onProgress,
    };
  }

  /**
   * Load VMap data with actual model geometry
   */
  public async load(vmapData: VMapData): Promise<VMapModelResult> {
    const group = new THREE.Group();
    group.name = `vmap_models_${vmapData.mapId}`;

    // Collect all unique model names from spawns
    const modelSpawns = new Map<string, ModelSpawn[]>();

    for (const [, tile] of vmapData.tiles) {
      if (!tile.spawns) continue;

      for (const spawn of tile.spawns) {
        if (!spawn.name) continue;

        const spawns = modelSpawns.get(spawn.name) || [];
        spawns.push(spawn);
        modelSpawns.set(spawn.name, spawns);
      }
    }

    console.log(`[VMapModelLoader] Found ${modelSpawns.size} unique models, ${vmapData.allSpawns.length} total spawns`);

    // Load models (up to limit)
    const modelNames = Array.from(modelSpawns.keys()).slice(0, this.options.maxModels);
    const failedModels: string[] = [];
    let totalTriangles = 0;
    let totalVertices = 0;
    let loadedModels = 0;

    for (let i = 0; i < modelNames.length; i++) {
      const modelName = modelNames[i];

      // Check triangle limit
      if (totalTriangles >= this.options.maxTriangles) {
        console.log(`[VMapModelLoader] Triangle limit reached at ${totalTriangles}`);
        break;
      }

      // Load model
      const model = await this.loadModel(modelName);
      if (!model) {
        failedModels.push(modelName);
        continue;
      }

      // Create meshes for each spawn of this model (with instance limit)
      const spawns = modelSpawns.get(modelName) || [];
      const limitedSpawns = spawns.slice(0, this.options.maxInstancesPerModel);

      for (const spawn of limitedSpawns) {
        if (totalTriangles >= this.options.maxTriangles) break;

        const mesh = this.createSpawnMesh(model, spawn);
        if (mesh) {
          group.add(mesh);

          const geom = mesh.geometry as THREE.BufferGeometry;
          const triCount = geom.index
            ? geom.index.count / 3
            : geom.attributes.position.count / 3;
          totalTriangles += triCount;
          totalVertices += geom.attributes.position.count;
        }
      }

      loadedModels++;

      // Progress callback
      if (this.options.onProgress) {
        this.options.onProgress(i + 1, modelNames.length);
      }
    }

    console.log(`[VMapModelLoader] Loaded ${loadedModels} models, ${totalTriangles} triangles, ${failedModels.length} failed`);

    if (failedModels.length > 0) {
      console.warn(`[VMapModelLoader] Failed models (first 10):`, failedModels.slice(0, 10));
    }

    if (loadedModels === 0 && failedModels.length > 0) {
      console.error(`[VMapModelLoader] ALL models failed to load! Check:
1. Is VMAP_PATH environment variable set in .env.local?
2. Do .vmo files exist in the vmaps folder?
3. Are the model names correct? First model attempted: "${failedModels[0]}"`);
    }

    return {
      group,
      triangleCount: totalTriangles,
      vertexCount: totalVertices,
      modelCount: loadedModels,
      spawnCount: vmapData.allSpawns.length,
      failedModels,
    };
  }

  /**
   * Load a model from cache or fetch from server
   */
  private async loadModel(modelName: string): Promise<WorldModel | null> {
    // Check cache
    if (this.modelCache.has(modelName)) {
      return this.modelCache.get(modelName)!;
    }

    try {
      // Fetch .vmo file from API
      const response = await fetch(
        `/api/collision-data?type=vmo&action=download&model=${encodeURIComponent(modelName)}`
      );

      if (!response.ok) {
        console.warn(`[VMapModelLoader] Failed to load model ${modelName}: ${response.status}`);
        this.modelCache.set(modelName, null);
        return null;
      }

      const buffer = await response.arrayBuffer();
      const model = parseVMO(buffer, modelName + '.vmo');

      this.modelCache.set(modelName, model);
      return model;
    } catch (error) {
      console.warn(`[VMapModelLoader] Error loading model ${modelName}:`, error);
      this.modelCache.set(modelName, null);
      return null;
    }
  }

  /**
   * Create a mesh for a spawn instance of a model
   */
  private createSpawnMesh(model: WorldModel, spawn: ModelSpawn): THREE.Mesh | null {
    // Collect all vertices and triangles from the model
    const allVertices: number[] = [];
    const allIndices: number[] = [];
    let indexOffset = 0;

    for (const groupModel of model.groupModels) {
      // Transform and add vertices
      for (const vertex of groupModel.vertices) {
        const transformed = this.transformVertex(vertex, spawn);
        allVertices.push(transformed.x, transformed.y, transformed.z);
      }

      // Add indices with offset
      for (const tri of groupModel.triangles) {
        allIndices.push(
          tri.idx0 + indexOffset,
          tri.idx1 + indexOffset,
          tri.idx2 + indexOffset
        );
      }

      indexOffset += groupModel.vertices.length;
    }

    if (allVertices.length === 0 || allIndices.length === 0) {
      return null;
    }

    // Create geometry
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(allVertices, 3));
    geometry.setIndex(allIndices);

    // Add vertex colors based on height
    if (this.options.heightColors) {
      const colors: number[] = [];
      for (let i = 0; i < allVertices.length; i += 3) {
        const y = allVertices[i + 1]; // Height is Y in Three.js
        const color = this.heightToColor(y);
        colors.push(color.r, color.g, color.b);
      }
      geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    }

    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();

    // Create mesh
    const material = this.getMaterial();
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = `spawn_${spawn.id}_${spawn.name}`;
    // Disable shadows for performance (major FPS impact)
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    // Enable frustum culling (default but explicit)
    mesh.frustumCulled = true;

    return mesh;
  }

  /**
   * Transform a vertex from model space to world space
   *
   * TrinityCore rotation format (from ModelInstance.cpp line 29):
   * - Rotation stored in DEGREES (not radians)
   * - Euler order: ZYX with arguments passed as (Y, X, Z) to fromEulerAnglesZYX
   * - The rotation matrix is then INVERTED for world-to-model transform
   *
   * For model-to-world transform, we use the non-inverted rotation.
   *
   * Coordinate System Notes:
   * - VMap spawn.position uses absolute coordinates where position ≈ tileIndex * TILE_SIZE
   * - Terrain meshes use inverted formula: worldX = (32 - gridX - 0.5) * TILE_SIZE
   *   This means terrain position = 32.5 * TILE_SIZE - tileIndex * TILE_SIZE
   *
   * To align VMap with terrain:
   *   terrainCoord = 32.5 * TILE_SIZE - vmapPosition
   */
  private transformVertex(vertex: VMOVector3, spawn: ModelSpawn): THREE.Vector3 {
    // Apply scale first (in model space)
    let x = vertex.x * spawn.scale;
    let y = vertex.y * spawn.scale;
    let z = vertex.z * spawn.scale;

    // Convert rotation from degrees to radians
    // TrinityCore uses: fromEulerAnglesZYX(Y_deg, X_deg, Z_deg) which means:
    // First rotate around Z, then X, then Y (in that application order)
    const rotY = (spawn.rotation.y * Math.PI) / 180;
    const rotX = (spawn.rotation.x * Math.PI) / 180;
    const rotZ = (spawn.rotation.z * Math.PI) / 180;

    // Apply rotation using ZYX order (same as TrinityCore's fromEulerAnglesZYX)
    // Three.js Euler 'ZYX' means: apply Z first, then Y, then X
    // But TrinityCore's fromEulerAnglesZYX(y, x, z) applies Z, then X, then Y
    // So we need 'ZXY' order in Three.js terms
    const euler = new THREE.Euler(rotX, rotY, rotZ, 'ZXY');
    const quaternion = new THREE.Quaternion().setFromEuler(euler);

    const vec = new THREE.Vector3(x, y, z);
    vec.applyQuaternion(quaternion);

    // World position in WoW coordinates (absolute)
    const wowX = spawn.position.x + vec.x;
    const wowY = spawn.position.y + vec.y;
    const wowZ = spawn.position.z + vec.z;

    // Simple WoW to Three.js coordinate conversion (no offset applied here)
    // WoW: X = East/West, Y = North/South, Z = Height
    // Three.js: X = Right, Y = Up, Z = Towards camera
    return new THREE.Vector3(
      wowX,             // WoW X -> Three.js X
      wowZ,             // WoW Z (height) -> Three.js Y
      -wowY             // WoW Y -> Three.js -Z
    );
  }

  /**
   * Convert height to color
   */
  private heightToColor(height: number): { r: number; g: number; b: number } {
    // Normalize height (-200 to 200 typical range for buildings)
    const normalized = Math.max(0, Math.min(1, (height + 200) / 400));

    // Blue to cyan to green
    if (normalized < 0.5) {
      const t = normalized * 2;
      return {
        r: 0.2,
        g: 0.3 + t * 0.4,
        b: 0.8 - t * 0.3,
      };
    } else {
      const t = (normalized - 0.5) * 2;
      return {
        r: 0.2 + t * 0.3,
        g: 0.7 - t * 0.2,
        b: 0.5 - t * 0.2,
      };
    }
  }

  /**
   * Get or create material
   */
  private getMaterial(): THREE.Material {
    const key = `vmap_${this.options.wireframe}_${this.options.heightColors}`;

    if (this.materials.has(key)) {
      return this.materials.get(key)!;
    }

    const material = new THREE.MeshLambertMaterial({
      vertexColors: this.options.heightColors,
      color: this.options.heightColors ? 0xffffff : 0x6699aa,
      side: THREE.DoubleSide,
      transparent: this.options.opacity < 1,
      opacity: this.options.opacity,
      wireframe: this.options.wireframe,
    });

    this.materials.set(key, material);
    return material;
  }

  /**
   * Dispose resources
   */
  public dispose(): void {
    this.modelCache.clear();
    for (const material of this.materials.values()) {
      material.dispose();
    }
    this.materials.clear();
  }
}
