/**
 * TrinityCore MCP - VMap Manager
 *
 * Complete VMap (Visibility Map) management system for TrinityCore.
 * Handles loading, caching, and querying of VMap data for collision detection,
 * line-of-sight checks, and height queries.
 *
 * Features:
 * - Multi-threaded tile loading
 * - LRU cache for frequently accessed tiles
 * - Spatial indexing for fast queries
 * - Model spawn rendering support
 * - Line-of-sight (LOS) checking
 * - Height map queries
 * - Collision detection
 *
 * @module VMapManager
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { EventEmitter } from 'events';
import { Worker } from 'worker_threads';
import { logger } from '../utils/logger';

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * 3D Vector
 */
export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

/**
 * Bounding box
 */
export interface BoundingBox {
  min: Vector3;
  max: Vector3;
}

/**
 * VMap tile header
 */
export interface VMapTileHeader {
  magic: string;
  version: number;
  tileX: number;
  tileY: number;
  modelCount: number;
  bounds: BoundingBox;
}

/**
 * Model spawn instance
 */
export interface ModelSpawn {
  id: number;
  modelId: number;
  position: Vector3;
  rotation: Vector3;
  scale: number;
  flags: number;
  bounds: BoundingBox;
}

/**
 * VMap tile data
 */
export interface VMapTile {
  header: VMapTileHeader;
  models: ModelSpawn[];
  vertices: Float32Array;
  indices: Uint32Array;
  triangleCount: number;
}

/**
 * Line-of-sight result
 */
export interface LOSResult {
  hasLOS: boolean;
  hitPoint?: Vector3;
  distance?: number;
  hitModelId?: number;
}

/**
 * Height query result
 */
export interface HeightResult {
  height: number;
  found: boolean;
  floor: boolean;
}

/**
 * VMap manager configuration
 */
export interface VMapConfig {
  vmapPath: string;
  maxCacheSize: number;
  enableCache: boolean;
  workerThreads: number;
  preloadRadius: number;
}

/**
 * Cache entry
 */
interface CacheEntry {
  tile: VMapTile;
  lastAccess: number;
  size: number;
}

// ============================================================================
// VMap Manager Class
// ============================================================================

/**
 * VMap Manager
 *
 * Manages loading and querying of VMap data with caching and multi-threading.
 */
export class VMapManager extends EventEmitter {
  private config: VMapConfig;
  private cache: Map<string, CacheEntry>;
  private cacheSize: number = 0;
  private loading: Map<string, Promise<VMapTile>>;
  private workers: Worker[];
  private workerQueue: Array<{ resolve: Function; reject: Function; data: any }>;

  constructor(config: Partial<VMapConfig> = {}) {
    super();

    this.config = {
      vmapPath: config.vmapPath || './vmaps',
      maxCacheSize: config.maxCacheSize || 512 * 1024 * 1024, // 512 MB
      enableCache: config.enableCache !== false,
      workerThreads: config.workerThreads || 4,
      preloadRadius: config.preloadRadius || 2,
    };

    this.cache = new Map();
    this.loading = new Map();
    this.workers = [];
    this.workerQueue = [];

    logger.info('VMapManager initialized', {
      path: this.config.vmapPath,
      maxCache: `${this.config.maxCacheSize / 1024 / 1024}MB`,
      workers: this.config.workerThreads,
    });
  }

  /**
   * Initialize worker threads
   */
  async initialize(): Promise<void> {
    // Initialize worker pool for parallel tile loading
    for (let i = 0; i < this.config.workerThreads; i++) {
      const worker = new Worker(path.join(__dirname, 'vmap-worker.js'));

      worker.on('message', (result) => {
        const task = this.workerQueue.shift();
        if (task) {
          if (result.error) {
            task.reject(new Error(result.error));
          } else {
            task.resolve(result.data);
          }
        }

        // Process next task if available
        if (this.workerQueue.length > 0) {
          const nextTask = this.workerQueue[0];
          worker.postMessage(nextTask.data);
        }
      });

      worker.on('error', (error) => {
        logger.error('Worker error', { error: error.message });
      });

      this.workers.push(worker);
    }

    logger.info('VMap workers initialized', { count: this.workers.length });
  }

  /**
   * Load VMap tile
   */
  async loadTile(mapId: number, tileX: number, tileY: number): Promise<VMapTile> {
    const tileKey = this.getTileKey(mapId, tileX, tileY);

    // Check cache first
    if (this.config.enableCache && this.cache.has(tileKey)) {
      const entry = this.cache.get(tileKey)!;
      entry.lastAccess = Date.now();
      logger.debug('VMap tile cache hit', { mapId, tileX, tileY });
      return entry.tile;
    }

    // Check if already loading
    if (this.loading.has(tileKey)) {
      logger.debug('VMap tile already loading', { mapId, tileX, tileY });
      return this.loading.get(tileKey)!;
    }

    // Load tile
    const loadPromise = this.loadTileFromDisk(mapId, tileX, tileY);
    this.loading.set(tileKey, loadPromise);

    try {
      const tile = await loadPromise;

      // Add to cache
      if (this.config.enableCache) {
        this.addToCache(tileKey, tile);
      }

      return tile;
    } finally {
      this.loading.delete(tileKey);
    }
  }

  /**
   * Load tile from disk
   */
  private async loadTileFromDisk(
    mapId: number,
    tileX: number,
    tileY: number
  ): Promise<VMapTile> {
    const filePath = this.getTilePath(mapId, tileX, tileY);

    logger.debug('Loading VMap tile', { mapId, tileX, tileY, path: filePath });

    try {
      const buffer = await fs.readFile(filePath);
      const tile = await this.parseTile(buffer);

      logger.info('VMap tile loaded', {
        mapId,
        tileX,
        tileY,
        models: tile.models.length,
        triangles: tile.triangleCount,
        size: `${buffer.length / 1024}KB`,
      });

      return tile;
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        logger.warn('VMap tile not found', { mapId, tileX, tileY });
        // Return empty tile
        return this.createEmptyTile(mapId, tileX, tileY);
      }
      throw error;
    }
  }

  /**
   * Parse tile data
   */
  private async parseTile(buffer: Buffer): Promise<VMapTile> {
    // Use worker for parsing if available
    if (this.workers.length > 0) {
      return new Promise((resolve, reject) => {
        this.workerQueue.push({
          resolve,
          reject,
          data: { command: 'parse', buffer },
        });

        // If worker is idle, start processing
        const idleWorker = this.workers.find((w, i) => i >= this.workerQueue.length - 1);
        if (idleWorker) {
          const task = this.workerQueue[this.workerQueue.length - 1];
          idleWorker.postMessage(task.data);
        }
      });
    }

    // Fallback to synchronous parsing
    return this.parseTileSync(buffer);
  }

  /**
   * Synchronous tile parsing
   */
  private parseTileSync(buffer: Buffer): VMapTile {
    let offset = 0;

    // Read header
    const magic = buffer.toString('utf8', offset, offset + 4);
    offset += 4;

    if (magic !== 'VMAP') {
      throw new Error(`Invalid VMap magic: ${magic}`);
    }

    const version = buffer.readUInt32LE(offset);
    offset += 4;

    const tileX = buffer.readInt32LE(offset);
    offset += 4;

    const tileY = buffer.readInt32LE(offset);
    offset += 4;

    const modelCount = buffer.readUInt32LE(offset);
    offset += 4;

    // Read bounds
    const bounds: BoundingBox = {
      min: {
        x: buffer.readFloatLE(offset),
        y: buffer.readFloatLE(offset + 4),
        z: buffer.readFloatLE(offset + 8),
      },
      max: {
        x: buffer.readFloatLE(offset + 12),
        y: buffer.readFloatLE(offset + 16),
        z: buffer.readFloatLE(offset + 20),
      },
    };
    offset += 24;

    const header: VMapTileHeader = {
      magic,
      version,
      tileX,
      tileY,
      modelCount,
      bounds,
    };

    // Read models
    const models: ModelSpawn[] = [];
    for (let i = 0; i < modelCount; i++) {
      const modelId = buffer.readUInt32LE(offset);
      offset += 4;

      const position: Vector3 = {
        x: buffer.readFloatLE(offset),
        y: buffer.readFloatLE(offset + 4),
        z: buffer.readFloatLE(offset + 8),
      };
      offset += 12;

      const rotation: Vector3 = {
        x: buffer.readFloatLE(offset),
        y: buffer.readFloatLE(offset + 4),
        z: buffer.readFloatLE(offset + 8),
      };
      offset += 12;

      const scale = buffer.readFloatLE(offset);
      offset += 4;

      const flags = buffer.readUInt32LE(offset);
      offset += 4;

      const modelBounds: BoundingBox = {
        min: {
          x: buffer.readFloatLE(offset),
          y: buffer.readFloatLE(offset + 4),
          z: buffer.readFloatLE(offset + 8),
        },
        max: {
          x: buffer.readFloatLE(offset + 12),
          y: buffer.readFloatLE(offset + 16),
          z: buffer.readFloatLE(offset + 20),
        },
      };
      offset += 24;

      models.push({
        id: i,
        modelId,
        position,
        rotation,
        scale,
        flags,
        bounds: modelBounds,
      });
    }

    // Read geometry data
    const vertexCount = buffer.readUInt32LE(offset);
    offset += 4;

    const vertices = new Float32Array(
      buffer.buffer,
      buffer.byteOffset + offset,
      vertexCount * 3
    );
    offset += vertexCount * 3 * 4;

    const indexCount = buffer.readUInt32LE(offset);
    offset += 4;

    const indices = new Uint32Array(
      buffer.buffer,
      buffer.byteOffset + offset,
      indexCount
    );
    offset += indexCount * 4;

    return {
      header,
      models,
      vertices,
      indices,
      triangleCount: indexCount / 3,
    };
  }

  /**
   * Create empty tile
   */
  private createEmptyTile(mapId: number, tileX: number, tileY: number): VMapTile {
    return {
      header: {
        magic: 'VMAP',
        version: 1,
        tileX,
        tileY,
        modelCount: 0,
        bounds: {
          min: { x: 0, y: 0, z: 0 },
          max: { x: 0, y: 0, z: 0 },
        },
      },
      models: [],
      vertices: new Float32Array(0),
      indices: new Uint32Array(0),
      triangleCount: 0,
    };
  }

  /**
   * Check line-of-sight between two points
   */
  async checkLOS(
    mapId: number,
    start: Vector3,
    end: Vector3
  ): Promise<LOSResult> {
    // Get tiles that the line passes through
    const tiles = await this.getTilesAlongLine(mapId, start, end);

    // Check each tile for intersection
    for (const tile of tiles) {
      const hit = this.raycastTile(tile, start, end);
      if (hit.hasLOS === false) {
        return hit;
      }
    }

    return { hasLOS: true };
  }

  /**
   * Get height at position
   */
  async getHeight(mapId: number, x: number, y: number): Promise<HeightResult> {
    const tileX = Math.floor(x / 533.33333);
    const tileY = Math.floor(y / 533.33333);

    const tile = await this.loadTile(mapId, tileX, tileY);

    // Cast ray down from high point
    const start: Vector3 = { x, y: 10000, z: y };
    const end: Vector3 = { x, y: -10000, z: y };

    const hit = this.raycastTile(tile, start, end);

    if (hit.hasLOS === false && hit.hitPoint) {
      return {
        height: hit.hitPoint.y,
        found: true,
        floor: true,
      };
    }

    return {
      height: 0,
      found: false,
      floor: false,
    };
  }

  /**
   * Raycast against tile geometry
   */
  private raycastTile(tile: VMapTile, start: Vector3, end: Vector3): LOSResult {
    const { vertices, indices } = tile;

    let closestDistance = Infinity;
    let closestPoint: Vector3 | undefined;
    let hitModelId: number | undefined;

    // Check each triangle
    for (let i = 0; i < indices.length; i += 3) {
      const i0 = indices[i] * 3;
      const i1 = indices[i + 1] * 3;
      const i2 = indices[i + 2] * 3;

      const v0: Vector3 = {
        x: vertices[i0],
        y: vertices[i0 + 1],
        z: vertices[i0 + 2],
      };

      const v1: Vector3 = {
        x: vertices[i1],
        y: vertices[i1 + 1],
        z: vertices[i1 + 2],
      };

      const v2: Vector3 = {
        x: vertices[i2],
        y: vertices[i2 + 1],
        z: vertices[i2 + 2],
      };

      const hit = this.rayTriangleIntersect(start, end, v0, v1, v2);
      if (hit) {
        const distance = this.distance(start, hit);
        if (distance < closestDistance) {
          closestDistance = distance;
          closestPoint = hit;
        }
      }
    }

    if (closestPoint) {
      return {
        hasLOS: false,
        hitPoint: closestPoint,
        distance: closestDistance,
        hitModelId,
      };
    }

    return { hasLOS: true };
  }

  /**
   * Ray-triangle intersection (Möller-Trumbore algorithm)
   */
  private rayTriangleIntersect(
    origin: Vector3,
    direction: Vector3,
    v0: Vector3,
    v1: Vector3,
    v2: Vector3
  ): Vector3 | null {
    const EPSILON = 0.0000001;

    const edge1 = this.subtract(v1, v0);
    const edge2 = this.subtract(v2, v0);
    const h = this.cross(direction, edge2);
    const a = this.dot(edge1, h);

    if (a > -EPSILON && a < EPSILON) {
      return null; // Ray is parallel to triangle
    }

    const f = 1.0 / a;
    const s = this.subtract(origin, v0);
    const u = f * this.dot(s, h);

    if (u < 0.0 || u > 1.0) {
      return null;
    }

    const q = this.cross(s, edge1);
    const v = f * this.dot(direction, q);

    if (v < 0.0 || u + v > 1.0) {
      return null;
    }

    const t = f * this.dot(edge2, q);

    if (t > EPSILON) {
      return {
        x: origin.x + direction.x * t,
        y: origin.y + direction.y * t,
        z: origin.z + direction.z * t,
      };
    }

    return null;
  }

  /**
   * Get tiles along a line
   */
  private async getTilesAlongLine(
    mapId: number,
    start: Vector3,
    end: Vector3
  ): Promise<VMapTile[]> {
    const tiles: VMapTile[] = [];
    const tileSize = 533.33333;

    const startTileX = Math.floor(start.x / tileSize);
    const startTileY = Math.floor(start.z / tileSize);
    const endTileX = Math.floor(end.x / tileSize);
    const endTileY = Math.floor(end.z / tileSize);

    // Use DDA algorithm to traverse tiles
    const dx = Math.abs(endTileX - startTileX);
    const dy = Math.abs(endTileY - startTileY);
    const steps = Math.max(dx, dy);

    if (steps === 0) {
      tiles.push(await this.loadTile(mapId, startTileX, startTileY));
      return tiles;
    }

    const xInc = (endTileX - startTileX) / steps;
    const yInc = (endTileY - startTileY) / steps;

    let x = startTileX;
    let y = startTileY;

    for (let i = 0; i <= steps; i++) {
      const tileX = Math.floor(x);
      const tileY = Math.floor(y);

      tiles.push(await this.loadTile(mapId, tileX, tileY));

      x += xInc;
      y += yInc;
    }

    return tiles;
  }

  /**
   * Add tile to cache
   */
  private addToCache(key: string, tile: VMapTile): void {
    const size = this.estimateTileSize(tile);

    // Evict old entries if cache is full
    while (this.cacheSize + size > this.config.maxCacheSize && this.cache.size > 0) {
      this.evictOldest();
    }

    this.cache.set(key, {
      tile,
      lastAccess: Date.now(),
      size,
    });

    this.cacheSize += size;

    logger.debug('Tile added to cache', {
      key,
      size: `${size / 1024}KB`,
      cacheSize: `${this.cacheSize / 1024 / 1024}MB`,
      entries: this.cache.size,
    });
  }

  /**
   * Evict oldest cache entry
   */
  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache) {
      if (entry.lastAccess < oldestTime) {
        oldestTime = entry.lastAccess;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      const entry = this.cache.get(oldestKey)!;
      this.cache.delete(oldestKey);
      this.cacheSize -= entry.size;

      logger.debug('Cache entry evicted', {
        key: oldestKey,
        age: `${(Date.now() - entry.lastAccess) / 1000}s`,
      });
    }
  }

  /**
   * Estimate tile size in bytes
   */
  private estimateTileSize(tile: VMapTile): number {
    return (
      tile.vertices.byteLength +
      tile.indices.byteLength +
      tile.models.length * 200 // Rough estimate for model data
    );
  }

  /**
   * Get tile key
   */
  private getTileKey(mapId: number, tileX: number, tileY: number): string {
    return `${mapId}_${tileX}_${tileY}`;
  }

  /**
   * Get tile file path
   */
  private getTilePath(mapId: number, tileX: number, tileY: number): string {
    const mapStr = mapId.toString().padStart(3, '0');
    const tileStr = `${tileX.toString().padStart(2, '0')}_${tileY.toString().padStart(2, '0')}`;
    return path.join(this.config.vmapPath, mapStr, `${tileStr}.vmtile`);
  }

  // Vector math utilities
  private subtract(a: Vector3, b: Vector3): Vector3 {
    return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
  }

  private cross(a: Vector3, b: Vector3): Vector3 {
    return {
      x: a.y * b.z - a.z * b.y,
      y: a.z * b.x - a.x * b.z,
      z: a.x * b.y - a.y * b.x,
    };
  }

  private dot(a: Vector3, b: Vector3): number {
    return a.x * b.x + a.y * b.y + a.z * b.z;
  }

  private distance(a: Vector3, b: Vector3): number {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dz = b.z - a.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
    this.cacheSize = 0;
    logger.info('VMap cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      entries: this.cache.size,
      size: this.cacheSize,
      maxSize: this.config.maxCacheSize,
      utilizationPercent: (this.cacheSize / this.config.maxCacheSize) * 100,
    };
  }

  /**
   * Shutdown manager
   */
  async shutdown(): Promise<void> {
    // Terminate all workers
    for (const worker of this.workers) {
      await worker.terminate();
    }

    this.workers = [];
    this.clearCache();

    logger.info('VMapManager shutdown complete');
  }
}
