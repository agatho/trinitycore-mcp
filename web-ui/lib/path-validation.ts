/**
 * Path Validation & Navigation Testing
 *
 * Validate waypoint paths for walkability, detect collisions,
 * and test NPC navigation before deployment.
 */

import type { WaypointPath } from './map-editor';
import type { MMapData } from './mmap-types';
import type { VMapData } from './vmap-types';
import { getHeightAtPosition } from './height-query';

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  type: 'unreachable' | 'collision' | 'steep-slope' | 'missing-height' | 'invalid-path';
  waypointIndex: number;
  position: { x: number; y: number; z: number };
  message: string;
}

export interface ValidationWarning {
  type: 'long-distance' | 'height-difference' | 'tight-corner' | 'near-collision';
  waypointIndex: number;
  position: { x: number; y: number; z: number };
  message: string;
}

export interface PathTestOptions {
  /** Maximum slope angle in degrees */
  maxSlopeAngle?: number;

  /** Maximum distance between waypoints (yards) */
  maxWaypointDistance?: number;

  /** Collision detection enabled */
  checkCollisions?: boolean;

  /** Check reachability using A* pathfinding */
  checkReachability?: boolean;

  /** NPC collision radius */
  npcRadius?: number;
}

/**
 * Path Validation Manager
 */
export class PathValidationManager {
  /**
   * Validate waypoint path
   */
  public validatePath(
    path: WaypointPath,
    mmapData?: MMapData,
    vmapData?: VMapData,
    options: PathTestOptions = {}
  ): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    const opts = {
      maxSlopeAngle: options.maxSlopeAngle ?? 60,
      maxWaypointDistance: options.maxWaypointDistance ?? 100,
      checkCollisions: options.checkCollisions ?? true,
      checkReachability: options.checkReachability ?? true,
      npcRadius: options.npcRadius ?? 0.5,
    };

    // Check each waypoint
    for (let i = 0; i < path.waypoints.length; i++) {
      const wp = path.waypoints[i];

      // Check height availability
      const heightResult = getHeightAtPosition(wp.x, wp.y, vmapData, mmapData);
      if (heightResult.z === null) {
        errors.push({
          type: 'missing-height',
          waypointIndex: i,
          position: { x: wp.x, y: wp.y, z: wp.z },
          message: `No terrain data at waypoint ${i + 1}`,
        });
        continue;
      }

      // Check if waypoint Z matches terrain
      const heightDiff = Math.abs(wp.z - heightResult.z);
      if (heightDiff > 5) {
        warnings.push({
          type: 'height-difference',
          waypointIndex: i,
          position: { x: wp.x, y: wp.y, z: wp.z },
          message: `Waypoint ${i + 1} is ${heightDiff.toFixed(1)} yards above/below terrain`,
        });
      }

      // Check distance to next waypoint
      if (i < path.waypoints.length - 1) {
        const next = path.waypoints[i + 1];
        const distance = Math.hypot(next.x - wp.x, next.y - wp.y, next.z - wp.z);

        if (distance > opts.maxWaypointDistance) {
          warnings.push({
            type: 'long-distance',
            waypointIndex: i,
            position: { x: wp.x, y: wp.y, z: wp.z },
            message: `Distance to waypoint ${i + 2} is ${distance.toFixed(1)} yards (max: ${opts.maxWaypointDistance})`,
          });
        }

        // Check slope between waypoints
        const heightChange = next.z - wp.z;
        const horizontalDist = Math.hypot(next.x - wp.x, next.y - wp.y);
        const slopeAngle = Math.abs(Math.atan2(heightChange, horizontalDist) * (180 / Math.PI));

        if (slopeAngle > opts.maxSlopeAngle) {
          errors.push({
            type: 'steep-slope',
            waypointIndex: i,
            position: { x: wp.x, y: wp.y, z: wp.z },
            message: `Slope to waypoint ${i + 2} is ${slopeAngle.toFixed(1)}° (max: ${opts.maxSlopeAngle}°)`,
          });
        }
      }

      // Check reachability (simplified - full implementation would use A*)
      if (opts.checkReachability && i > 0 && mmapData) {
        const prev = path.waypoints[i - 1];
        const reachable = this.checkReachability(prev, wp, mmapData);

        if (!reachable) {
          errors.push({
            type: 'unreachable',
            waypointIndex: i,
            position: { x: wp.x, y: wp.y, z: wp.z },
            message: `Waypoint ${i + 1} may not be reachable from waypoint ${i}`,
          });
        }
      }

      // Check collisions
      if (opts.checkCollisions && vmapData) {
        const hasCollision = this.checkCollision(wp, opts.npcRadius, vmapData);

        if (hasCollision) {
          errors.push({
            type: 'collision',
            waypointIndex: i,
            position: { x: wp.x, y: wp.y, z: wp.z },
            message: `Waypoint ${i + 1} collides with geometry`,
          });
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Check if waypoint B is reachable from waypoint A
   */
  private checkReachability(
    from: { x: number; y: number; z: number },
    to: { x: number; y: number; z: number },
    mmapData: MMapData
  ): boolean {
    // Simplified reachability check
    // Full implementation would use A* pathfinding on navmesh

    // Check if both points are on navmesh
    const fromHeight = getHeightAtPosition(from.x, from.y, undefined, mmapData);
    const toHeight = getHeightAtPosition(to.x, to.y, undefined, mmapData);

    if (fromHeight.z === null || toHeight.z === null) {
      return false;
    }

    // Simple line-of-sight check (not perfect but fast)
    const steps = 10;
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const x = from.x + (to.x - from.x) * t;
      const y = from.y + (to.y - from.y) * t;
      const height = getHeightAtPosition(x, y, undefined, mmapData);

      if (height.z === null) {
        return false; // Path goes through non-walkable area
      }
    }

    return true;
  }

  /**
   * Check if position collides with VMap geometry
   */
  private checkCollision(
    position: { x: number; y: number; z: number },
    radius: number,
    vmapData: VMapData
  ): boolean {
    // Simplified collision check
    // Full implementation would do sphere-vs-triangles collision

    for (const spawn of vmapData.allSpawns) {
      const bounds = spawn.bounds;

      // Simple AABB check
      if (
        position.x >= bounds.min.x - radius &&
        position.x <= bounds.max.x + radius &&
        position.y >= bounds.min.y - radius &&
        position.y <= bounds.max.y + radius &&
        position.z >= bounds.min.z - radius &&
        position.z <= bounds.max.z + radius
      ) {
        return true; // Potential collision
      }
    }

    return false;
  }

  /**
   * Test path with animated NPC
   */
  public testPath(
    path: WaypointPath,
    onProgress: (waypointIndex: number, position: { x: number; y: number; z: number }) => void,
    speed: number = 2.5 // yards per second
  ): { stop: () => void } {
    let currentWaypointIndex = 0;
    let progress = 0;
    let stopped = false;

    const animate = () => {
      if (stopped) return;

      const from = path.waypoints[currentWaypointIndex];
      const to = path.waypoints[(currentWaypointIndex + 1) % path.waypoints.length];

      const distance = Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z);
      const duration = distance / speed; // seconds

      progress += 0.016; // Assume 60 FPS

      if (progress >= duration) {
        currentWaypointIndex = (currentWaypointIndex + 1) % path.waypoints.length;
        progress = 0;
      }

      const t = Math.min(progress / duration, 1);
      const position = {
        x: from.x + (to.x - from.x) * t,
        y: from.y + (to.y - from.y) * t,
        z: from.z + (to.z - from.z) * t,
      };

      onProgress(currentWaypointIndex, position);

      requestAnimationFrame(animate);
    };

    animate();

    return {
      stop: () => {
        stopped = true;
      },
    };
  }

  /**
   * Optimize path (smooth out corners)
   */
  public optimizePath(path: WaypointPath): WaypointPath {
    // TODO: Implement path smoothing
    // - Remove redundant waypoints
    // - Smooth corners using catmull-rom splines
    // - Maintain walkability

    return path;
  }

  /**
   * Auto-fix common path issues
   */
  public autoFix(
    path: WaypointPath,
    mmapData?: MMapData,
    vmapData?: VMapData
  ): WaypointPath {
    const fixed = { ...path };

    // Fix waypoint heights
    for (const wp of fixed.waypoints) {
      const height = getHeightAtPosition(wp.x, wp.y, vmapData, mmapData);
      if (height.z !== null) {
        wp.z = height.z;
      }
    }

    // TODO: Additional auto-fixes
    // - Remove unreachable waypoints
    // - Insert intermediate waypoints for long distances
    // - Adjust positions to avoid collisions

    return fixed;
  }
}

// Singleton
let pathValidator: PathValidationManager | null = null;

export function getPathValidator(): PathValidationManager {
  if (!pathValidator) {
    pathValidator = new PathValidationManager();
  }
  return pathValidator;
}

/**
 * IMPLEMENTATION NOTES:
 *
 * 1. UI Components:
 *    - PathValidationPanel: Show errors and warnings
 *    - PathTestControls: Play/pause/speed controls
 *    - ValidationMarkers: Visual indicators on map
 *    - AutoFixButton: One-click path repair
 *
 * 2. A* Pathfinding:
 *    - Implement proper A* on navmesh for reachability
 *    - Use MMap polygon connectivity
 *    - Consider NPC size and movement flags
 *
 * 3. Visualization:
 *    - Draw path as colored line (green=valid, yellow=warning, red=error)
 *    - Animated NPC model following path
 *    - Show collision spheres at problem areas
 *    - Display slope angle heat map
 *
 * 4. Advanced Validation:
 *    - Check for loops and dead ends
 *    - Validate spawn time and movement speed
 *    - Test under different game conditions (weather, phase, etc.)
 */
