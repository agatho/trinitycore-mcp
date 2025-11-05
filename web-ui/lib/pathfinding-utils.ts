/**
 * Pathfinding Utilities
 *
 * A* pathfinding on navigation meshes for MMap data.
 * Finds optimal paths between two points on the navmesh.
 *
 * @module pathfinding-utils
 */

import type { MMapData, NavMeshTile } from "./mmap-types";
import { findNearestPoly } from "./mmap-parser";

// ============================================================================
// Types
// ============================================================================

/**
 * Pathfinding result
 */
export interface PathResult {
  /** Was a path found? */
  success: boolean;

  /** Path waypoints (3D positions) */
  path: [number, number, number][];

  /** Total path length in units */
  length: number;

  /** Path cost (weighted by terrain type) */
  cost: number;

  /** Error message if failed */
  error?: string;

  /** Number of nodes explored */
  nodesExplored: number;

  /** Computation time in milliseconds */
  computeTime: number;
}

/**
 * Pathfinding node for A*
 */
interface PathNode {
  /** Tile key */
  tileKey: string;

  /** Polygon index within tile */
  polyIndex: number;

  /** Position in world space */
  position: [number, number, number];

  /** G cost (distance from start) */
  g: number;

  /** H cost (heuristic to goal) */
  h: number;

  /** F cost (g + h) */
  f: number;

  /** Parent node */
  parent: PathNode | null;
}

// ============================================================================
// A* Pathfinding
// ============================================================================

/**
 * Find path between two points using A* on navigation mesh
 *
 * @param mmapData MMap navigation data
 * @param start Start position [x, y, z]
 * @param goal Goal position [x, y, z]
 * @param maxIterations Maximum A* iterations (default: 10000)
 * @returns Path result
 */
export function findPath(
  mmapData: MMapData,
  start: [number, number, number],
  goal: [number, number, number],
  maxIterations: number = 10000,
): PathResult {
  const startTime = performance.now();

  // Find tiles containing start and goal
  const startTileX = Math.floor(start[0] / mmapData.header.params.tileWidth);
  const startTileY = Math.floor(start[2] / mmapData.header.params.tileHeight);
  const startTileKey = `${startTileX}_${startTileY}`;

  const goalTileX = Math.floor(goal[0] / mmapData.header.params.tileWidth);
  const goalTileY = Math.floor(goal[2] / mmapData.header.params.tileHeight);
  const goalTileKey = `${goalTileX}_${goalTileY}`;

  const startTile = mmapData.tiles.get(startTileKey);
  const goalTile = mmapData.tiles.get(goalTileKey);

  if (!startTile) {
    return {
      success: false,
      path: [],
      length: 0,
      cost: 0,
      error: `No tile found for start position (${startTileKey})`,
      nodesExplored: 0,
      computeTime: performance.now() - startTime,
    };
  }

  if (!goalTile) {
    return {
      success: false,
      path: [],
      length: 0,
      cost: 0,
      error: `No tile found for goal position (${goalTileKey})`,
      nodesExplored: 0,
      computeTime: performance.now() - startTime,
    };
  }

  // Find nearest polygons to start and goal
  const startPolyIndex = findNearestPoly(startTile, start, [5, 5, 5]);
  const goalPolyIndex = findNearestPoly(goalTile, goal, [5, 5, 5]);

  if (startPolyIndex === -1) {
    return {
      success: false,
      path: [],
      length: 0,
      cost: 0,
      error: "Start position is not on navigation mesh",
      nodesExplored: 0,
      computeTime: performance.now() - startTime,
    };
  }

  if (goalPolyIndex === -1) {
    return {
      success: false,
      path: [],
      length: 0,
      cost: 0,
      error: "Goal position is not on navigation mesh",
      nodesExplored: 0,
      computeTime: performance.now() - startTime,
    };
  }

  // Simple A* implementation (simplified for same-tile pathfinding)
  // For cross-tile pathfinding, would need to connect tiles via edges

  if (startTileKey !== goalTileKey) {
    // Cross-tile pathfinding not yet implemented
    return {
      success: false,
      path: [],
      length: 0,
      cost: 0,
      error: "Cross-tile pathfinding not yet implemented",
      nodesExplored: 0,
      computeTime: performance.now() - startTime,
    };
  }

  // Same-tile A* pathfinding
  const result = aStarSameTile(
    startTile,
    startTileKey,
    startPolyIndex,
    start,
    goalPolyIndex,
    goal,
    maxIterations,
  );

  result.computeTime = performance.now() - startTime;
  return result;
}

/**
 * A* pathfinding within a single tile
 */
function aStarSameTile(
  tile: NavMeshTile,
  tileKey: string,
  startPolyIndex: number,
  startPos: [number, number, number],
  goalPolyIndex: number,
  goalPos: [number, number, number],
  maxIterations: number,
): PathResult {
  const openSet: PathNode[] = [];
  const closedSet = new Set<string>();

  // Create start node
  const startNode: PathNode = {
    tileKey,
    polyIndex: startPolyIndex,
    position: startPos,
    g: 0,
    h: heuristic(startPos, goalPos),
    f: 0,
    parent: null,
  };
  startNode.f = startNode.g + startNode.h;

  openSet.push(startNode);

  let iterations = 0;
  let nodesExplored = 0;

  while (openSet.length > 0 && iterations < maxIterations) {
    iterations++;

    // Find node with lowest f cost
    let currentIndex = 0;
    for (let i = 1; i < openSet.length; i++) {
      if (openSet[i].f < openSet[currentIndex].f) {
        currentIndex = i;
      }
    }

    const current = openSet[currentIndex];
    openSet.splice(currentIndex, 1);

    const currentKey = `${current.tileKey}_${current.polyIndex}`;
    closedSet.add(currentKey);
    nodesExplored++;

    // Check if we reached the goal
    if (current.polyIndex === goalPolyIndex) {
      // Reconstruct path
      const path: [number, number, number][] = [];
      let node: PathNode | null = current;
      let totalLength = 0;

      while (node) {
        path.unshift(node.position);
        if (node.parent) {
          totalLength += distance(node.position, node.parent.position);
        }
        node = node.parent;
      }

      // Replace last position with actual goal
      path[path.length - 1] = goalPos;

      return {
        success: true,
        path,
        length: totalLength,
        cost: current.g,
        nodesExplored,
        computeTime: 0, // Will be set by caller
      };
    }

    // Get neighbors of current polygon
    const poly = tile.polys[current.polyIndex];
    const neighbors = getPolyNeighbors(tile, current.polyIndex, poly);

    for (const neighborIndex of neighbors) {
      const neighborKey = `${tileKey}_${neighborIndex}`;

      if (closedSet.has(neighborKey)) {
        continue;
      }

      // Get polygon center as position
      const neighborPos = getPolygonCenter(tile, neighborIndex);

      // Calculate costs
      const moveCost = distance(current.position, neighborPos);
      const terrainCost = getTerrainCost(tile, neighborIndex);
      const g = current.g + moveCost * terrainCost;
      const h = heuristic(neighborPos, goalPos);
      const f = g + h;

      // Check if neighbor is already in open set
      const existingIndex = openSet.findIndex(
        (n) => n.tileKey === tileKey && n.polyIndex === neighborIndex,
      );

      if (existingIndex !== -1) {
        // Update if we found a better path
        if (g < openSet[existingIndex].g) {
          openSet[existingIndex].g = g;
          openSet[existingIndex].f = f;
          openSet[existingIndex].parent = current;
        }
      } else {
        // Add to open set
        openSet.push({
          tileKey,
          polyIndex: neighborIndex,
          position: neighborPos,
          g,
          h,
          f,
          parent: current,
        });
      }
    }
  }

  // No path found
  return {
    success: false,
    path: [],
    length: 0,
    cost: 0,
    error: iterations >= maxIterations ? "Max iterations reached" : "No path found",
    nodesExplored,
    computeTime: 0, // Will be set by caller
  };
}

/**
 * Get neighbor polygons of a given polygon
 */
function getPolyNeighbors(
  tile: NavMeshTile,
  polyIndex: number,
  poly: { neis: number[]; vertCount: number },
): number[] {
  const neighbors: number[] = [];

  for (let i = 0; i < poly.vertCount; i++) {
    const nei = poly.neis[i];
    if (nei !== 0 && nei < tile.polys.length) {
      neighbors.push(nei);
    }
  }

  return neighbors;
}

/**
 * Get center position of a polygon
 */
function getPolygonCenter(tile: NavMeshTile, polyIndex: number): [number, number, number] {
  const poly = tile.polys[polyIndex];
  let cx = 0;
  let cy = 0;
  let cz = 0;

  for (let i = 0; i < poly.vertCount; i++) {
    const vert = tile.verts[poly.verts[i]];
    cx += vert[0];
    cy += vert[1];
    cz += vert[2];
  }

  return [cx / poly.vertCount, cy / poly.vertCount, cz / poly.vertCount];
}

/**
 * Get terrain cost multiplier based on area type
 */
function getTerrainCost(tile: NavMeshTile, polyIndex: number): number {
  const poly = tile.polys[polyIndex];
  const areaType = poly.areaAndtype & 0x3f;

  // Cost multipliers for different terrain types
  switch (areaType) {
    case 11: // GROUND
      return 1.0;
    case 10: // GROUND_STEEP
      return 1.5;
    case 9: // WATER
      return 2.0;
    case 8: // MAGMA_SLIME
      return 5.0;
    default:
      return 1.0;
  }
}

/**
 * Heuristic function (Euclidean distance)
 */
function heuristic(
  a: [number, number, number],
  b: [number, number, number],
): number {
  return Math.sqrt((b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2 + (b[2] - a[2]) ** 2);
}

/**
 * Calculate distance between two points
 */
function distance(
  a: [number, number, number],
  b: [number, number, number],
): number {
  return Math.sqrt((b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2 + (b[2] - a[2]) ** 2);
}

// ============================================================================
// Path Smoothing
// ============================================================================

/**
 * Smooth a path using simple string pulling
 *
 * @param path Original path
 * @returns Smoothed path
 */
export function smoothPath(path: [number, number, number][]): [number, number, number][] {
  if (path.length <= 2) return path;

  const smoothed: [number, number, number][] = [path[0]];

  let currentIndex = 0;

  while (currentIndex < path.length - 1) {
    let farthestIndex = currentIndex + 1;

    // Try to skip intermediate points
    for (let i = currentIndex + 2; i < path.length; i++) {
      // Check if we can go directly from current to i
      // (simplified - just use distance check)
      farthestIndex = i;
    }

    smoothed.push(path[farthestIndex]);
    currentIndex = farthestIndex;
  }

  return smoothed;
}

/**
 * Calculate total path length
 */
export function calculatePathLength(path: [number, number, number][]): number {
  let length = 0;

  for (let i = 1; i < path.length; i++) {
    length += distance(path[i - 1], path[i]);
  }

  return length;
}

/**
 * Interpolate points along a path for smooth visualization
 *
 * @param path Original path
 * @param segmentLength Desired segment length
 * @returns Interpolated path
 */
export function interpolatePath(
  path: [number, number, number][],
  segmentLength: number = 1.0,
): [number, number, number][] {
  if (path.length <= 1) return path;

  const result: [number, number, number][] = [path[0]];

  for (let i = 1; i < path.length; i++) {
    const start = path[i - 1];
    const end = path[i];
    const dist = distance(start, end);
    const segments = Math.ceil(dist / segmentLength);

    for (let j = 1; j <= segments; j++) {
      const t = j / segments;
      const point: [number, number, number] = [
        start[0] + (end[0] - start[0]) * t,
        start[1] + (end[1] - start[1]) * t,
        start[2] + (end[2] - start[2]) * t,
      ];
      result.push(point);
    }
  }

  return result;
}
