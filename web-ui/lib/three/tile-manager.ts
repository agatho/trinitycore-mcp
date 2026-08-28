/**
 * TileManager - Dynamic tile loading/unloading for 3D map view
 *
 * Manages VMap/MMap/Terrain tiles based on camera position.
 * Loads nearby tiles and unloads distant ones to optimize memory and performance.
 *
 * WoW Tile System:
 * - Each tile is 533.33333 yards (approximately 533.33 world units)
 * - Map coordinates range from 0-64 in both X and Y directions
 * - Tile (32, 32) is typically the center of the map
 *
 * @module lib/three/tile-manager
 */

import * as THREE from 'three';
import type { VMapData, VMapTile, ModelSpawn } from '@/lib/vmap-types';
import type { MMapData } from '@/lib/mmap-types';
import type { MapDataCollection } from '@/lib/map-parser';
import { parseVMO, type WorldModel } from '@/lib/vmo-parser';

/** WoW tile size in world units (yards) */
export const TILE_SIZE = 533.33333;

/** Maximum distance (in tiles) from camera to keep tiles loaded */
const DEFAULT_LOAD_RADIUS = 2;

/** Distance (in tiles) beyond load radius to unload tiles */
const UNLOAD_BUFFER = 1;

/** Minimum time (ms) between tile update checks */
const UPDATE_THROTTLE_MS = 500;

export interface TileCoord {
  x: number;
  y: number;
}

export interface LoadedTile {
  coord: TileCoord;
  group: THREE.Group;
  triangleCount: number;
  vertexCount: number;
  modelCount: number;
  loadedAt: number;
}

export interface TileManagerOptions {
  /** Number of tiles to load around camera position */
  loadRadius?: number;
  /** Maximum models to load per tile */
  maxModelsPerTile?: number;
  /** Maximum triangles per tile */
  maxTrianglesPerTile?: number;
  /** Enable debug logging */
  debug?: boolean;
  /** Callback when tiles are loaded/unloaded */
  onTileChange?: (loaded: number, unloaded: number) => void;
}

export interface TileManagerStats {
  loadedTileCount: number;
  totalTriangles: number;
  totalVertices: number;
  totalModels: number;
  currentTileX: number;
  currentTileY: number;
  pendingLoads: number;
}

/**
 * TileManager - Dynamic tile loading based on camera position
 */
export class TileManager {
  private options: Required<Omit<TileManagerOptions, 'onTileChange'>> & { onTileChange?: (loaded: number, unloaded: number) => void };
  private scene: THREE.Scene;
  private parentGroup: THREE.Group;

  // Tile state
  private loadedTiles: Map<string, LoadedTile> = new Map();
  private pendingLoads: Set<string> = new Set();
  private lastUpdateTime = 0;
  private lastCameraTileX = -999;
  private lastCameraTileY = -999;

  // Data sources
  private vmapData: VMapData | null = null;
  private mmapData: MMapData | null = null;
  private mapData: MapDataCollection | null = null;

  // Model cache
  private modelCache: Map<string, WorldModel | null> = new Map();

  // Materials (shared across tiles)
  private materials: Map<string, THREE.Material> = new Map();

  // Flag to prevent update() from loading tiles while forceLoadAllTiles is running
  private isForceLoading = false;

  constructor(scene: THREE.Scene, options: TileManagerOptions = {}) {
    this.scene = scene;
    this.options = {
      loadRadius: options.loadRadius ?? DEFAULT_LOAD_RADIUS,
      maxModelsPerTile: options.maxModelsPerTile ?? 30,
      maxTrianglesPerTile: options.maxTrianglesPerTile ?? 100000,
      debug: options.debug ?? false,
      onTileChange: options.onTileChange,
    };

    // Create parent group for all tiles
    this.parentGroup = new THREE.Group();
    this.parentGroup.name = 'tile_manager_root';
    this.parentGroup.visible = true;
    this.scene.add(this.parentGroup);

    if (this.options.debug) {
      console.log('[TileManager] Initialized with options:', this.options);
    }
  }

  /**
   * Set VMap data source
   */
  public setVMapData(data: VMapData | null): void {
    console.log(`[TileManager] setVMapData called: data=${data ? 'has data' : 'null'}, current=${this.vmapData ? 'has data' : 'null'}, loadedTiles=${this.loadedTiles.size}, isForceLoading=${this.isForceLoading}`);

    // Always clear loaded tiles when data is set
    // This handles HMR/hot reload scenarios and ensures fresh tile loading
    if (this.loadedTiles.size > 0) {
      console.log(`[TileManager] CLEARING ${this.loadedTiles.size} loaded tiles for fresh load`);
      this.clear();
      console.log(`[TileManager] After clear: loadedTiles=${this.loadedTiles.size}`);
    }

    this.vmapData = data;

    if (this.options.debug && data) {
      console.log(`[TileManager] VMap data set: ${data.tiles.size} tiles, ${data.allSpawns.length} spawns`);
    }
  }

  /**
   * Set MMap data source
   */
  public setMMapData(data: MMapData | null): void {
    this.mmapData = data;
    if (this.options.debug && data) {
      console.log(`[TileManager] MMap data set: ${data.tiles.size} tiles`);
    }
  }

  /**
   * Set terrain data source
   */
  public setMapData(data: MapDataCollection | null): void {
    this.mapData = data;
    if (this.options.debug && data) {
      console.log(`[TileManager] Map data set: ${data.tiles.size} tiles`);
    }
  }

  /**
   * Convert world position to tile coordinates
   *
   * WoW uses a coordinate system where:
   * - Origin is at the corner of the map
   * - Each tile is TILE_SIZE units
   * - Tile (32, 32) is typically near the center
   */
  public worldToTile(worldX: number, worldZ: number): TileCoord {
    // WoW coordinate system: tiles are indexed from 0-64
    // World position 0,0 corresponds to tile 32,32 (center of map)
    // Convert from world coords to tile coords
    const tileX = Math.floor(32 - worldX / TILE_SIZE);
    const tileY = Math.floor(32 - worldZ / TILE_SIZE);

    return { x: tileX, y: tileY };
  }

  /**
   * Convert tile coordinates to world center position
   */
  public tileToWorld(tileX: number, tileY: number): { x: number; z: number } {
    // Inverse of worldToTile
    const worldX = (32 - tileX) * TILE_SIZE + TILE_SIZE / 2;
    const worldZ = (32 - tileY) * TILE_SIZE + TILE_SIZE / 2;

    return { x: worldX, z: worldZ };
  }

  /**
   * Get tile key string
   */
  private getTileKey(x: number, y: number): string {
    return `${x}_${y}`;
  }

  /**
   * Update tiles based on camera position
   * Call this every frame or on camera move
   */
  public update(cameraPosition: THREE.Vector3): void {
    // Don't do anything if we don't have VMap data yet
    if (!this.vmapData) {
      return;
    }

    // Don't load tiles if forceLoadAllTiles is currently running
    if (this.isForceLoading) {
      return;
    }

    const now = Date.now();

    // Throttle updates
    if (now - this.lastUpdateTime < UPDATE_THROTTLE_MS) {
      return;
    }
    this.lastUpdateTime = now;

    // Get current camera tile
    // Note: In Three.js, Y is up, Z is towards camera
    // We use X and -Z to map to WoW's X and Y coordinates
    const cameraTile = this.worldToTile(cameraPosition.x, -cameraPosition.z);

    // Only update if camera moved to a different tile
    if (cameraTile.x === this.lastCameraTileX && cameraTile.y === this.lastCameraTileY) {
      return;
    }

    this.lastCameraTileX = cameraTile.x;
    this.lastCameraTileY = cameraTile.y;

    if (this.options.debug) {
      console.log(`[TileManager] Camera moved to tile (${cameraTile.x}, ${cameraTile.y})`);
    }

    // Calculate tiles that should be loaded
    const tilesToLoad = this.getTilesInRadius(cameraTile.x, cameraTile.y, this.options.loadRadius);

    // Calculate tiles to unload (outside radius + buffer)
    const unloadRadius = this.options.loadRadius + UNLOAD_BUFFER;
    const tilesToKeep = new Set(
      this.getTilesInRadius(cameraTile.x, cameraTile.y, unloadRadius).map(t => this.getTileKey(t.x, t.y))
    );

    // Unload distant tiles
    let unloadedCount = 0;
    for (const [key] of this.loadedTiles) {
      if (!tilesToKeep.has(key)) {
        this.unloadTile(key);
        unloadedCount++;
      }
    }

    // Load nearby tiles that aren't already loaded
    let loadedCount = 0;
    for (const tileCoord of tilesToLoad) {
      const key = this.getTileKey(tileCoord.x, tileCoord.y);
      if (!this.loadedTiles.has(key) && !this.pendingLoads.has(key)) {
        this.loadTile(tileCoord.x, tileCoord.y);
        loadedCount++;
      }
    }

    if ((loadedCount > 0 || unloadedCount > 0) && this.options.onTileChange) {
      this.options.onTileChange(loadedCount, unloadedCount);
    }
  }

  /**
   * Get all tile coordinates within radius of center tile
   */
  private getTilesInRadius(centerX: number, centerY: number, radius: number): TileCoord[] {
    const tiles: TileCoord[] = [];

    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        const x = centerX + dx;
        const y = centerY + dy;

        // Check if this tile exists in our data
        if (this.hasTileData(x, y)) {
          tiles.push({ x, y });
        }
      }
    }

    return tiles;
  }

  /**
   * Check if we have data for a tile
   */
  private hasTileData(x: number, y: number): boolean {
    const key = this.getTileKey(x, y);

    // Check VMap tiles
    if (this.vmapData?.tiles.has(key)) {
      return true;
    }

    // Check MMap tiles
    if (this.mmapData?.tiles.has(key)) {
      return true;
    }

    // Check terrain tiles
    if (this.mapData?.tiles.has(key)) {
      return true;
    }

    return false;
  }

  /**
   * Debug: Log available tile keys
   */
  public debugLogAvailableTiles(): void {
    if (this.vmapData) {
      const keys = Array.from(this.vmapData.tiles.keys()).slice(0, 20);
      console.log(`[TileManager] VMap tile keys (first 20): ${keys.join(', ')}`);

      // Also log the center tile for camera positioning
      const center = this.getDataCenter();
      if (center) {
        console.log(`[TileManager] Data center tile: (${center.tileX}, ${center.tileY}), world: (${center.worldX.toFixed(0)}, ${center.worldZ.toFixed(0)})`);
      }
    }
    if (this.mmapData) {
      const keys = Array.from(this.mmapData.tiles.keys()).slice(0, 20);
      console.log(`[TileManager] MMap tile keys (first 20): ${keys.join(', ')}`);
    }
    if (this.mapData) {
      const keys = Array.from(this.mapData.tiles.keys()).slice(0, 20);
      console.log(`[TileManager] Map tile keys (first 20): ${keys.join(', ')}`);
    }
  }

  /**
   * Get the center tile of available data
   */
  public getDataCenter(): { tileX: number; tileY: number; worldX: number; worldZ: number } | null {
    let allTileKeys: string[] = [];

    if (this.vmapData) {
      allTileKeys = allTileKeys.concat(Array.from(this.vmapData.tiles.keys()));
    }
    if (this.mmapData) {
      allTileKeys = allTileKeys.concat(Array.from(this.mmapData.tiles.keys()));
    }
    if (this.mapData) {
      allTileKeys = allTileKeys.concat(Array.from(this.mapData.tiles.keys()));
    }

    if (allTileKeys.length === 0) return null;

    // Parse tile coordinates and find center
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const key of allTileKeys) {
      const [xStr, yStr] = key.split('_');
      const x = parseInt(xStr, 10);
      const y = parseInt(yStr, 10);
      if (!isNaN(x) && !isNaN(y)) {
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
    }

    if (minX === Infinity) return null;

    const centerTileX = Math.floor((minX + maxX) / 2);
    const centerTileY = Math.floor((minY + maxY) / 2);
    const worldPos = this.tileToWorld(centerTileX, centerTileY);

    return {
      tileX: centerTileX,
      tileY: centerTileY,
      worldX: worldPos.x,
      worldZ: worldPos.z,
    };
  }

  /**
   * Force load all available tiles (ignoring camera position)
   * Useful for initial load or when camera is not positioned near data
   */
  public async forceLoadAllTiles(maxTiles: number = 25): Promise<void> {
    // Set flag to prevent update() from loading tiles during force load
    this.isForceLoading = true;

    try {
      let allTileKeys: string[] = [];

      if (this.vmapData) {
        allTileKeys = allTileKeys.concat(Array.from(this.vmapData.tiles.keys()));
      }

      // Remove duplicates and limit
      const uniqueKeys = [...new Set(allTileKeys)].slice(0, maxTiles);

      console.log(`[TileManager] Force loading ${uniqueKeys.length} tiles...`);

      for (const key of uniqueKeys) {
        const [xStr, yStr] = key.split('_');
        const x = parseInt(xStr, 10);
        const y = parseInt(yStr, 10);

        const alreadyLoaded = this.loadedTiles.has(key);
        const isPending = this.pendingLoads.has(key);
        console.log(`[TileManager] Force check tile ${key}: x=${x}, y=${y}, loaded=${alreadyLoaded}, pending=${isPending}`);

        if (!isNaN(x) && !isNaN(y) && !alreadyLoaded && !isPending) {
          console.log(`[TileManager] Calling loadTile for ${key}...`);
          await this.loadTile(x, y);
          console.log(`[TileManager] loadTile for ${key} complete`);
        }
      }

      console.log(`[TileManager] Force load complete. Loaded: ${this.loadedTiles.size} tiles`);
    } finally {
      // Always reset flag even if error occurs
      this.isForceLoading = false;
    }
  }

  /**
   * Load a tile asynchronously
   */
  private async loadTile(tileX: number, tileY: number): Promise<void> {
    const key = this.getTileKey(tileX, tileY);

    if (this.pendingLoads.has(key)) {
      return;
    }

    this.pendingLoads.add(key);

    console.log(`[TileManager] Loading tile (${tileX}, ${tileY}) key=${key}`);

    try {
      const group = new THREE.Group();
      group.name = `tile_${key}`;
      group.visible = true;

      let triangleCount = 0;
      let vertexCount = 0;
      let modelCount = 0;

      // Load VMap models for this tile
      if (this.vmapData) {
        const vmapTile = this.vmapData.tiles.get(key);
        console.log(`[TileManager] Tile ${key}: vmapTile exists=${!!vmapTile}, spawns=${vmapTile?.spawns?.length ?? 0}`);

        if (vmapTile && vmapTile.spawns && vmapTile.spawns.length > 0) {
          const vmapResult = await this.loadVMapTileModels(vmapTile, tileX, tileY);
          if (vmapResult) {
            group.add(vmapResult.group);
            triangleCount += vmapResult.triangleCount;
            vertexCount += vmapResult.vertexCount;
            modelCount += vmapResult.modelCount;
          }
        }
      } else {
        console.log(`[TileManager] Tile ${key}: No vmapData available`);
      }

      // TODO: Load MMap data for this tile
      // TODO: Load terrain data for this tile

      // Only add if we have content
      if (triangleCount > 0) {
        // Add directly to scene instead of parentGroup to test visibility
        this.scene.add(group);

        // Log bounds for debugging
        const box = new THREE.Box3().setFromObject(group);
        const center = box.getCenter(new THREE.Vector3());
        const tileSize = box.getSize(new THREE.Vector3());
        console.log(`[TileManager] Tile (${tileX}, ${tileY}) added to scene: ${triangleCount} tris, center=(${center.x.toFixed(0)}, ${center.y.toFixed(0)}, ${center.z.toFixed(0)}), size=(${tileSize.x.toFixed(0)}, ${tileSize.y.toFixed(0)}, ${tileSize.z.toFixed(0)})`);

        this.loadedTiles.set(key, {
          coord: { x: tileX, y: tileY },
          group,
          triangleCount,
          vertexCount,
          modelCount,
          loadedAt: Date.now(),
        });

        if (this.options.debug) {
          console.log(`[TileManager] Tile (${tileX}, ${tileY}) loaded: ${triangleCount} triangles, ${modelCount} models`);
        }
      } else {
        // No content but mark as loaded to avoid retrying
        this.loadedTiles.set(key, {
          coord: { x: tileX, y: tileY },
          group,
          triangleCount: 0,
          vertexCount: 0,
          modelCount: 0,
          loadedAt: Date.now(),
        });

        if (this.options.debug) {
          console.log(`[TileManager] Tile (${tileX}, ${tileY}) empty`);
        }
      }
    } catch (error) {
      console.error(`[TileManager] Error loading tile (${tileX}, ${tileY}):`, error);
    } finally {
      this.pendingLoads.delete(key);
    }
  }

  /**
   * Load VMap models for a specific tile
   */
  private async loadVMapTileModels(
    tile: VMapTile,
    tileX: number,
    tileY: number
  ): Promise<{ group: THREE.Group; triangleCount: number; vertexCount: number; modelCount: number } | null> {
    const group = new THREE.Group();
    group.name = `vmap_tile_${tileX}_${tileY}`;
    group.visible = true;

    let totalTriangles = 0;
    let totalVertices = 0;
    let loadedModels = 0;
    let failedModels = 0;

    // Collect unique models in this tile
    const modelSpawns = new Map<string, ModelSpawn[]>();
    for (const spawn of tile.spawns) {
      if (!spawn.name) continue;
      const spawns = modelSpawns.get(spawn.name) || [];
      spawns.push(spawn);
      modelSpawns.set(spawn.name, spawns);
    }

    // Always log tile spawn info for debugging
    console.log(`[TileManager] Tile (${tileX}, ${tileY}): ${tile.spawns.length} spawns, ${modelSpawns.size} unique models`);

    // Load models (up to limit)
    const modelNames = Array.from(modelSpawns.keys()).slice(0, this.options.maxModelsPerTile);

    for (const modelName of modelNames) {
      if (totalTriangles >= this.options.maxTrianglesPerTile) break;

      // Load model
      const model = await this.loadModel(modelName);
      if (!model) {
        failedModels++;
        continue;
      }

      // Create meshes for spawns of this model
      const spawns = modelSpawns.get(modelName) || [];
      let meshesCreated = 0;
      for (const spawn of spawns.slice(0, 10)) { // Limit instances per model per tile
        if (totalTriangles >= this.options.maxTrianglesPerTile) break;

        const mesh = this.createSpawnMesh(model, spawn);
        if (mesh) {
          group.add(mesh);
          meshesCreated++;

          const geom = mesh.geometry as THREE.BufferGeometry;
          const triCount = geom.index
            ? geom.index.count / 3
            : geom.attributes.position.count / 3;
          totalTriangles += triCount;
          totalVertices += geom.attributes.position.count;
        }
      }

      loadedModels++;
    }

    if (this.options.debug) {
      console.log(`[TileManager] Tile (${tileX}, ${tileY}) result: ${loadedModels} models loaded, ${failedModels} failed, ${totalTriangles} triangles`);
    }

    return {
      group,
      triangleCount: totalTriangles,
      vertexCount: totalVertices,
      modelCount: loadedModels,
    };
  }

  /**
   * Load a model from cache or fetch from server
   */
  private async loadModel(modelName: string): Promise<WorldModel | null> {
    if (this.modelCache.has(modelName)) {
      return this.modelCache.get(modelName)!;
    }

    try {
      const url = `/api/collision-data?type=vmo&action=download&model=${encodeURIComponent(modelName)}`;

      if (this.options.debug) {
        console.log(`[TileManager] Fetching model: ${modelName}`);
      }

      const response = await fetch(url);

      if (!response.ok) {
        if (this.options.debug && response.status !== 404) {
          console.warn(`[TileManager] Failed to fetch model ${modelName}: ${response.status}`);
        }
        this.modelCache.set(modelName, null);
        return null;
      }

      const buffer = await response.arrayBuffer();

      if (this.options.debug) {
        console.log(`[TileManager] Parsing model: ${modelName} (${buffer.byteLength} bytes)`);
      }

      const model = parseVMO(buffer, modelName + '.vmo');

      if (this.options.debug) {
        const stats = { groups: model.groupModels.length, vertices: 0, triangles: 0 };
        for (const g of model.groupModels) {
          stats.vertices += g.vertices.length;
          stats.triangles += g.triangles.length;
        }
        console.log(`[TileManager] Model parsed: ${modelName} - ${stats.groups} groups, ${stats.vertices} verts, ${stats.triangles} tris`);
      }

      this.modelCache.set(modelName, model);
      return model;
    } catch (error) {
      if (this.options.debug) {
        console.error(`[TileManager] Error loading model ${modelName}:`, error);
      }
      this.modelCache.set(modelName, null);
      return null;
    }
  }

  /**
   * Create a mesh for a spawn instance
   */
  private createSpawnMesh(model: WorldModel, spawn: ModelSpawn): THREE.Mesh | null {
    const allVertices: number[] = [];
    const allIndices: number[] = [];
    let indexOffset = 0;

    for (const groupModel of model.groupModels) {
      for (const vertex of groupModel.vertices) {
        const transformed = this.transformVertex(vertex, spawn);
        allVertices.push(transformed.x, transformed.y, transformed.z);
      }

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

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(allVertices, 3));
    geometry.setIndex(allIndices);

    // Height-based vertex colors (same as VMapModelLoader)
    const colors: number[] = [];
    for (let i = 0; i < allVertices.length; i += 3) {
      const y = allVertices[i + 1];
      const color = this.heightToColor(y);
      colors.push(color.r, color.g, color.b);
    }
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();

    const material = this.getMaterial();
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = `spawn_${spawn.id}_${spawn.name}`;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.frustumCulled = true;

    return mesh;
  }

  /**
   * Transform vertex from model space to world space
   *
   * Coordinate System Analysis:
   * - VMap spawn.position uses TrinityCore's internal coordinates where:
   *   - Position values are roughly tileIndex * TILE_SIZE
   *   - E.g., position 17066 ≈ tile 32 * 533.33
   *
   * - Terrain meshes use WoW-style centered coordinates:
   *   - worldX = (32 - gridX - 0.5) * TILE_SIZE
   *   - Tile 32 → position ≈ -267 (center of map)
   *   - Tile 0 → position ≈ +16800
   *
   * To align VMap with terrain, we need to convert from TrinityCore coords to WoW coords:
   *   wowCoord = 32 * TILE_SIZE - vmapPosition
   *
   * The formula works because:
   *   - VMap position 17066 (tile 32) → 17066 - 17066 = 0 (near center)
   *   - VMap position 0 (tile 0) → 17066 - 0 = 17066 (far corner)
   */
  private transformVertex(
    vertex: { x: number; y: number; z: number },
    spawn: ModelSpawn
  ): THREE.Vector3 {
    let x = vertex.x * spawn.scale;
    let y = vertex.y * spawn.scale;
    let z = vertex.z * spawn.scale;

    // Convert rotation from degrees to radians
    const rotY = (spawn.rotation.y * Math.PI) / 180;
    const rotX = (spawn.rotation.x * Math.PI) / 180;
    const rotZ = (spawn.rotation.z * Math.PI) / 180;

    // Apply rotation using ZXY order (matches TrinityCore's fromEulerAnglesZYX(y,x,z))
    const euler = new THREE.Euler(rotX, rotY, rotZ, 'ZXY');
    const quaternion = new THREE.Quaternion().setFromEuler(euler);

    const vec = new THREE.Vector3(x, y, z);
    vec.applyQuaternion(quaternion);

    // VMap position in TrinityCore coordinates
    const vmapX = spawn.position.x + vec.x;
    const vmapY = spawn.position.y + vec.y;
    const vmapZ = spawn.position.z + vec.z;

    // Convert from TrinityCore coords to WoW-style centered coords
    // TrinityCore: position ≈ tileIndex * TILE_SIZE (tile 32 ≈ 17066)
    // WoW/Terrain: tile 32 = position 0 (centered)
    // Formula: wowCoord = 32 * TILE_SIZE - vmapCoord
    const CENTER_OFFSET = 32 * TILE_SIZE; // ~17066.67
    const wowX = CENTER_OFFSET - vmapX;
    const wowY = CENTER_OFFSET - vmapY;

    // Convert WoW to Three.js
    // WoW X → Three.js X, WoW Y → Three.js -Z, WoW Z (height) → Three.js Y
    return new THREE.Vector3(
      wowX,             // WoW X -> Three.js X
      vmapZ,            // WoW Z (height) -> Three.js Y (no offset needed for height)
      -wowY             // WoW Y -> Three.js -Z
    );
  }

  /**
   * Convert height to color
   */
  private heightToColor(height: number): { r: number; g: number; b: number } {
    const normalized = Math.max(0, Math.min(1, (height + 200) / 400));

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
   * Get or create shared material
   * Matches VMapModelLoader's material for consistency
   */
  private getMaterial(): THREE.Material {
    const key = 'vmap_tile';

    if (this.materials.has(key)) {
      return this.materials.get(key)!;
    }

    // Use same material as VMapModelLoader for consistency
    const material = new THREE.MeshLambertMaterial({
      vertexColors: true,
      color: 0xffffff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
      wireframe: false,
    });

    console.log('[TileManager] Created material:', material);
    this.materials.set(key, material);
    return material;
  }

  /**
   * Unload a tile
   */
  private unloadTile(key: string): void {
    const tile = this.loadedTiles.get(key);
    if (!tile) return;

    // Remove from scene (matching where we added it)
    this.scene.remove(tile.group);

    // Dispose geometry and materials
    tile.group.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        // Don't dispose shared materials
      }
    });

    this.loadedTiles.delete(key);

    if (this.options.debug) {
      console.log(`[TileManager] Unloaded tile (${tile.coord.x}, ${tile.coord.y})`);
    }
  }

  /**
   * Force load tiles around a specific world position
   */
  public async loadTilesAround(worldX: number, worldZ: number): Promise<void> {
    const centerTile = this.worldToTile(worldX, worldZ);

    if (this.options.debug) {
      console.log(`[TileManager] Force loading tiles around (${worldX}, ${worldZ}) -> tile (${centerTile.x}, ${centerTile.y})`);
    }

    const tilesToLoad = this.getTilesInRadius(centerTile.x, centerTile.y, this.options.loadRadius);

    const loadPromises = tilesToLoad.map(async (coord) => {
      const key = this.getTileKey(coord.x, coord.y);
      if (!this.loadedTiles.has(key) && !this.pendingLoads.has(key)) {
        await this.loadTile(coord.x, coord.y);
      }
    });

    await Promise.all(loadPromises);
  }

  /**
   * Get current stats
   */
  public getStats(): TileManagerStats {
    let totalTriangles = 0;
    let totalVertices = 0;
    let totalModels = 0;

    for (const tile of this.loadedTiles.values()) {
      totalTriangles += tile.triangleCount;
      totalVertices += tile.vertexCount;
      totalModels += tile.modelCount;
    }

    return {
      loadedTileCount: this.loadedTiles.size,
      totalTriangles,
      totalVertices,
      totalModels,
      currentTileX: this.lastCameraTileX,
      currentTileY: this.lastCameraTileY,
      pendingLoads: this.pendingLoads.size,
    };
  }

  /**
   * Get the parent group containing all tiles
   */
  public getGroup(): THREE.Group {
    return this.parentGroup;
  }

  /**
   * Get the bounding box of all loaded tile content
   * Returns null if no tiles with content are loaded
   */
  public getBounds(): THREE.Box3 | null {
    const box = new THREE.Box3();
    let hasContent = false;

    for (const tile of this.loadedTiles.values()) {
      if (tile.triangleCount > 0) {
        const tileBox = new THREE.Box3().setFromObject(tile.group);
        if (!tileBox.isEmpty()) {
          box.union(tileBox);
          hasContent = true;
        }
      }
    }

    return hasContent ? box : null;
  }

  /**
   * Clear all loaded tiles
   */
  public clear(): void {
    for (const key of Array.from(this.loadedTiles.keys())) {
      this.unloadTile(key);
    }

    this.lastCameraTileX = -999;
    this.lastCameraTileY = -999;

    if (this.options.debug) {
      console.log('[TileManager] Cleared all tiles');
    }
  }

  /**
   * Dispose all resources
   */
  public dispose(): void {
    this.clear();

    this.scene.remove(this.parentGroup);

    for (const material of this.materials.values()) {
      material.dispose();
    }
    this.materials.clear();

    this.modelCache.clear();

    if (this.options.debug) {
      console.log('[TileManager] Disposed');
    }
  }
}
