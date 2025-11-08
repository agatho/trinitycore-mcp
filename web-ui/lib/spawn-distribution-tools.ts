/**
 * Smart Spawn Distribution Tools
 *
 * Algorithms for automatic spawn placement with collision awareness
 * and natural distribution patterns.
 */

import type { MapCoordinate, WaypointPath } from './map-editor';
import type { MMapData } from './mmap-types';
import { getHeightAtPosition } from './height-query';

export interface DistributionOptions {
  /** Number of spawns to place */
  count: number;

  /** Distribution pattern */
  pattern: 'random' | 'grid' | 'circular' | 'poisson';

  /** Minimum distance between spawns (yards) */
  minDistance?: number;

  /** Maximum placement attempts */
  maxAttempts?: number;

  /** Respect collision data (only place on walkable surfaces) */
  respectCollision?: boolean;

  /** Random jitter amount (0-1) */
  positionJitter?: number;

  /** Random rotation */
  randomRotation?: boolean;
}

export interface DistributionArea {
  /** Area type */
  type: 'rectangle' | 'circle' | 'polygon';

  /** Center point */
  center: { x: number; y: number };

  /** Rectangle dimensions */
  width?: number;
  height?: number;

  /** Circle radius */
  radius?: number;

  /** Polygon points */
  points?: Array<{ x: number; y: number }>;
}

/**
 * Spawn Distribution Manager
 */
export class SpawnDistributionManager {
  /**
   * Distribute spawns in an area
   */
  public distribute(
    area: DistributionArea,
    options: DistributionOptions,
    mapId: number,
    mmapData?: MMapData
  ): MapCoordinate[] {
    const spawns: MapCoordinate[] = [];

    switch (options.pattern) {
      case 'random':
        return this.randomDistribution(area, options, mapId, mmapData);
      case 'grid':
        return this.gridDistribution(area, options, mapId, mmapData);
      case 'circular':
        return this.circularDistribution(area, options, mapId, mmapData);
      case 'poisson':
        return this.poissonDistribution(area, options, mapId, mmapData);
      default:
        return this.randomDistribution(area, options, mapId, mmapData);
    }
  }

  /**
   * Random distribution (uniform)
   */
  private randomDistribution(
    area: DistributionArea,
    options: DistributionOptions,
    mapId: number,
    mmapData?: MMapData
  ): MapCoordinate[] {
    const spawns: MapCoordinate[] = [];
    const maxAttempts = options.maxAttempts || 1000;
    let attempts = 0;

    while (spawns.length < options.count && attempts < maxAttempts) {
      attempts++;

      const point = this.samplePointInArea(area);
      if (!point) continue;

      // Check min distance
      if (options.minDistance) {
        const tooClose = spawns.some(s => {
          const dx = s.x - point.x;
          const dy = s.y - point.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          return dist < options.minDistance!;
        });
        if (tooClose) continue;
      }

      // Check walkability
      if (options.respectCollision && mmapData) {
        const height = getHeightAtPosition(point.x, point.y, undefined, mmapData);
        if (height.z === null) continue; // Not walkable
      }

      // Apply jitter
      if (options.positionJitter) {
        point.x += (Math.random() - 0.5) * options.positionJitter * 10;
        point.y += (Math.random() - 0.5) * options.positionJitter * 10;
      }

      // Get height
      const z = getHeightAtPosition(point.x, point.y, undefined, mmapData).z || 0;

      spawns.push({
        id: `spawn-dist-${Date.now()}-${spawns.length}`,
        x: point.x,
        y: point.y,
        z,
        mapId,
        type: 'spawn',
        label: `Auto Spawn ${spawns.length + 1}`,
        orientation: options.randomRotation ? Math.random() * Math.PI * 2 : 0,
      });
    }

    return spawns;
  }

  /**
   * Grid distribution
   */
  private gridDistribution(
    area: DistributionArea,
    options: DistributionOptions,
    mapId: number,
    mmapData?: MMapData
  ): MapCoordinate[] {
    const spawns: MapCoordinate[] = [];

    if (area.type === 'rectangle' && area.width && area.height) {
      const cols = Math.ceil(Math.sqrt(options.count * (area.width / area.height)));
      const rows = Math.ceil(options.count / cols);

      const cellWidth = area.width / cols;
      const cellHeight = area.height / rows;

      for (let row = 0; row < rows && spawns.length < options.count; row++) {
        for (let col = 0; col < cols && spawns.length < options.count; col++) {
          let x = area.center.x - area.width / 2 + col * cellWidth + cellWidth / 2;
          let y = area.center.y - area.height / 2 + row * cellHeight + cellHeight / 2;

          // Apply jitter
          if (options.positionJitter) {
            x += (Math.random() - 0.5) * cellWidth * options.positionJitter;
            y += (Math.random() - 0.5) * cellHeight * options.positionJitter;
          }

          // Check walkability
          if (options.respectCollision && mmapData) {
            const height = getHeightAtPosition(x, y, undefined, mmapData);
            if (height.z === null) continue;
          }

          const z = getHeightAtPosition(x, y, undefined, mmapData).z || 0;

          spawns.push({
            id: `spawn-grid-${Date.now()}-${spawns.length}`,
            x,
            y,
            z,
            mapId,
            type: 'spawn',
            label: `Grid Spawn ${spawns.length + 1}`,
            orientation: options.randomRotation ? Math.random() * Math.PI * 2 : 0,
          });
        }
      }
    }

    return spawns;
  }

  /**
   * Circular distribution (around center)
   */
  private circularDistribution(
    area: DistributionArea,
    options: DistributionOptions,
    mapId: number,
    mmapData?: MMapData
  ): MapCoordinate[] {
    const spawns: MapCoordinate[] = [];
    const radius = area.radius || 50;
    const angleStep = (Math.PI * 2) / options.count;

    for (let i = 0; i < options.count; i++) {
      let angle = i * angleStep;
      let r = radius;

      // Apply jitter
      if (options.positionJitter) {
        angle += (Math.random() - 0.5) * angleStep * options.positionJitter;
        r += (Math.random() - 0.5) * radius * 0.3 * options.positionJitter;
      }

      const x = area.center.x + Math.cos(angle) * r;
      const y = area.center.y + Math.sin(angle) * r;

      // Check walkability
      if (options.respectCollision && mmapData) {
        const height = getHeightAtPosition(x, y, undefined, mmapData);
        if (height.z === null) continue;
      }

      const z = getHeightAtPosition(x, y, undefined, mmapData).z || 0;

      spawns.push({
        id: `spawn-circle-${Date.now()}-${spawns.length}`,
        x,
        y,
        z,
        mapId,
        type: 'spawn',
        label: `Circle Spawn ${spawns.length + 1}`,
        orientation: Math.atan2(y - area.center.y, x - area.center.x), // Face outward
      });
    }

    return spawns;
  }

  /**
   * Poisson disk sampling (natural distribution)
   */
  private poissonDistribution(
    area: DistributionArea,
    options: DistributionOptions,
    mapId: number,
    mmapData?: MMapData
  ): MapCoordinate[] {
    const spawns: MapCoordinate[] = [];
    const minDist = options.minDistance || 10;
    const k = 30; // Attempts before rejection

    // Grid for fast lookup
    const cellSize = minDist / Math.sqrt(2);
    const grid = new Map<string, { x: number; y: number }>();

    // Get bounds
    const bounds = this.getAreaBounds(area);
    const gridWidth = Math.ceil((bounds.maxX - bounds.minX) / cellSize);
    const gridHeight = Math.ceil((bounds.maxY - bounds.minY) / cellSize);

    const getGridKey = (x: number, y: number): string => {
      const gx = Math.floor((x - bounds.minX) / cellSize);
      const gy = Math.floor((y - bounds.minY) / cellSize);
      return `${gx},${gy}`;
    };

    // Start with random point
    const first = this.samplePointInArea(area);
    if (!first) return spawns;

    const active = [first];
    grid.set(getGridKey(first.x, first.y), first);

    while (active.length > 0 && spawns.length < options.count) {
      const idx = Math.floor(Math.random() * active.length);
      const point = active[idx];
      let found = false;

      for (let attempt = 0; attempt < k; attempt++) {
        const angle = Math.random() * Math.PI * 2;
        const radius = minDist + Math.random() * minDist;
        const newPoint = {
          x: point.x + Math.cos(angle) * radius,
          y: point.y + Math.sin(angle) * radius,
        };

        if (!this.pointInArea(newPoint, area)) continue;

        // Check neighbors
        const gx = Math.floor((newPoint.x - bounds.minX) / cellSize);
        const gy = Math.floor((newPoint.y - bounds.minY) / cellSize);

        let valid = true;
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            const neighbor = grid.get(`${gx + dx},${gy + dy}`);
            if (neighbor) {
              const dist = Math.hypot(neighbor.x - newPoint.x, neighbor.y - newPoint.y);
              if (dist < minDist) {
                valid = false;
                break;
              }
            }
          }
          if (!valid) break;
        }

        if (!valid) continue;

        // Check walkability
        if (options.respectCollision && mmapData) {
          const height = getHeightAtPosition(newPoint.x, newPoint.y, undefined, mmapData);
          if (height.z === null) continue;
        }

        grid.set(getGridKey(newPoint.x, newPoint.y), newPoint);
        active.push(newPoint);
        found = true;
        break;
      }

      if (!found) {
        active.splice(idx, 1);
      }
    }

    // Convert grid points to spawns
    for (const point of grid.values()) {
      if (spawns.length >= options.count) break;

      const z = getHeightAtPosition(point.x, point.y, undefined, mmapData).z || 0;

      spawns.push({
        id: `spawn-poisson-${Date.now()}-${spawns.length}`,
        x: point.x,
        y: point.y,
        z,
        mapId,
        type: 'spawn',
        label: `Poisson Spawn ${spawns.length + 1}`,
        orientation: options.randomRotation ? Math.random() * Math.PI * 2 : 0,
      });
    }

    return spawns;
  }

  /**
   * Sample random point in area
   */
  private samplePointInArea(area: DistributionArea): { x: number; y: number } | null {
    switch (area.type) {
      case 'rectangle':
        if (!area.width || !area.height) return null;
        return {
          x: area.center.x + (Math.random() - 0.5) * area.width,
          y: area.center.y + (Math.random() - 0.5) * area.height,
        };
      case 'circle':
        if (!area.radius) return null;
        const angle = Math.random() * Math.PI * 2;
        const r = Math.sqrt(Math.random()) * area.radius;
        return {
          x: area.center.x + Math.cos(angle) * r,
          y: area.center.y + Math.sin(angle) * r,
        };
      case 'polygon':
        // Simple implementation: sample from bounding box and reject if outside
        if (!area.points || area.points.length < 3) return null;
        const bounds = this.getPolygonBounds(area.points);
        for (let i = 0; i < 100; i++) {
          const point = {
            x: bounds.minX + Math.random() * (bounds.maxX - bounds.minX),
            y: bounds.minY + Math.random() * (bounds.maxY - bounds.minY),
          };
          if (this.pointInPolygon(point, area.points)) {
            return point;
          }
        }
        return null;
      default:
        return null;
    }
  }

  /**
   * Check if point is in area
   */
  private pointInArea(point: { x: number; y: number }, area: DistributionArea): boolean {
    switch (area.type) {
      case 'rectangle':
        if (!area.width || !area.height) return false;
        return (
          Math.abs(point.x - area.center.x) <= area.width / 2 &&
          Math.abs(point.y - area.center.y) <= area.height / 2
        );
      case 'circle':
        if (!area.radius) return false;
        const dx = point.x - area.center.x;
        const dy = point.y - area.center.y;
        return Math.sqrt(dx * dx + dy * dy) <= area.radius;
      case 'polygon':
        if (!area.points) return false;
        return this.pointInPolygon(point, area.points);
      default:
        return false;
    }
  }

  /**
   * Point in polygon test (ray casting)
   */
  private pointInPolygon(point: { x: number; y: number }, polygon: Array<{ x: number; y: number }>): boolean {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].x, yi = polygon[i].y;
      const xj = polygon[j].x, yj = polygon[j].y;

      const intersect = ((yi > point.y) !== (yj > point.y)) &&
        (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  /**
   * Get area bounds
   */
  private getAreaBounds(area: DistributionArea): { minX: number; minY: number; maxX: number; maxY: number } {
    switch (area.type) {
      case 'rectangle':
        return {
          minX: area.center.x - (area.width || 0) / 2,
          minY: area.center.y - (area.height || 0) / 2,
          maxX: area.center.x + (area.width || 0) / 2,
          maxY: area.center.y + (area.height || 0) / 2,
        };
      case 'circle':
        const r = area.radius || 0;
        return {
          minX: area.center.x - r,
          minY: area.center.y - r,
          maxX: area.center.x + r,
          maxY: area.center.y + r,
        };
      case 'polygon':
        return this.getPolygonBounds(area.points || []);
      default:
        return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
    }
  }

  /**
   * Get polygon bounds
   */
  private getPolygonBounds(points: Array<{ x: number; y: number }>): { minX: number; minY: number; maxX: number; maxY: number } {
    if (points.length === 0) {
      return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
    }

    let minX = points[0].x, minY = points[0].y;
    let maxX = points[0].x, maxY = points[0].y;

    for (const p of points) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }

    return { minX, minY, maxX, maxY };
  }
}

export const spawnDistribution = new SpawnDistributionManager();
