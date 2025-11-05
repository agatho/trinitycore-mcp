/**
 * Enhanced Map Coordinate Editor with Advanced Features
 *
 * New Features:
 * - Undo/redo system with full history
 * - Multi-select and batch operations
 * - Measurement tools (distance, area)
 * - A* pathfinding for auto-routing
 * - Snap-to-grid functionality
 * - Road intersection detection
 * - Layer management system
 * - Advanced validation
 * - Keyboard shortcuts
 */

import {
  MapCoordinate,
  Road,
  ZoneTransition,
  WaypointPath,
  calculateDistance,
} from './map-editor';

// ============================================================================
// TYPES
// ============================================================================

export interface Layer {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  opacity: number;
  type: 'spawns' | 'roads' | 'waypoints' | 'transitions' | 'annotations';
}

export interface Annotation {
  id: string;
  x: number;
  y: number;
  text: string;
  color: string;
  fontSize: number;
}

export interface Measurement {
  id: string;
  type: 'distance' | 'area' | 'angle';
  points: Array<{ x: number; y: number }>;
  result: number;
  label: string;
}

export interface EditorState {
  coordinates: MapCoordinate[];
  roads: Road[];
  transitions: ZoneTransition[];
  waypointPaths: WaypointPath[];
  annotations: Annotation[];
  measurements: Measurement[];
  layers: Layer[];
  selectedItems: Set<string>;
}

export interface HistoryEntry {
  state: EditorState;
  timestamp: number;
  description: string;
}

export interface ValidationIssue {
  id: string;
  type: 'error' | 'warning' | 'info';
  message: string;
  relatedItems: string[];
  autoFix?: () => void;
}

export interface PathfindingNode {
  x: number;
  y: number;
  g: number; // Cost from start
  h: number; // Heuristic to end
  f: number; // Total cost
  parent: PathfindingNode | null;
}

// ============================================================================
// HISTORY MANAGER (Undo/Redo)
// ============================================================================

export class HistoryManager {
  private history: HistoryEntry[] = [];
  private currentIndex: number = -1;
  private maxHistory: number = 100;

  pushState(state: EditorState, description: string): void {
    // Remove any history after current index
    this.history = this.history.slice(0, this.currentIndex + 1);

    // Add new state
    this.history.push({
      state: this.cloneState(state),
      timestamp: Date.now(),
      description,
    });

    // Limit history size
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    } else {
      this.currentIndex++;
    }
  }

  canUndo(): boolean {
    return this.currentIndex > 0;
  }

  canRedo(): boolean {
    return this.currentIndex < this.history.length - 1;
  }

  undo(): EditorState | null {
    if (!this.canUndo()) return null;
    this.currentIndex--;
    return this.cloneState(this.history[this.currentIndex].state);
  }

  redo(): EditorState | null {
    if (!this.canRedo()) return null;
    this.currentIndex++;
    return this.cloneState(this.history[this.currentIndex].state);
  }

  getHistory(): Array<{ description: string; timestamp: number }> {
    return this.history.map(h => ({
      description: h.description,
      timestamp: h.timestamp,
    }));
  }

  getCurrentIndex(): number {
    return this.currentIndex;
  }

  private cloneState(state: EditorState): EditorState {
    return JSON.parse(JSON.stringify(state));
  }

  clear(): void {
    this.history = [];
    this.currentIndex = -1;
  }
}

// ============================================================================
// SNAP TO GRID
// ============================================================================

export function snapToGrid(
  x: number,
  y: number,
  gridSize: number,
  enabled: boolean = true
): { x: number; y: number } {
  if (!enabled) return { x, y };

  return {
    x: Math.round(x / gridSize) * gridSize,
    y: Math.round(y / gridSize) * gridSize,
  };
}

// ============================================================================
// MEASUREMENT TOOLS
// ============================================================================

export function measureDistance(points: Array<{ x: number; y: number }>): number {
  if (points.length < 2) return 0;

  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += calculateDistance(points[i - 1], points[i]);
  }
  return total;
}

export function measureArea(points: Array<{ x: number; y: number }>): number {
  if (points.length < 3) return 0;

  // Shoelace formula for polygon area
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    area += points[i].x * points[j].y;
    area -= points[j].x * points[i].y;
  }
  return Math.abs(area / 2);
}

export function measureAngle(
  p1: { x: number; y: number },
  vertex: { x: number; y: number },
  p2: { x: number; y: number }
): number {
  const angle1 = Math.atan2(p1.y - vertex.y, p1.x - vertex.x);
  const angle2 = Math.atan2(p2.y - vertex.y, p2.x - vertex.x);
  let diff = angle2 - angle1;

  // Normalize to 0-360 degrees
  while (diff < 0) diff += 2 * Math.PI;
  while (diff > 2 * Math.PI) diff -= 2 * Math.PI;

  return (diff * 180) / Math.PI;
}

// ============================================================================
// A* PATHFINDING
// ============================================================================

export function findPath(
  start: { x: number; y: number },
  end: { x: number; y: number },
  obstacles: Array<{ x: number; y: number; radius: number }> = [],
  gridSize: number = 10
): Array<{ x: number; y: number }> | null {
  const openSet: PathfindingNode[] = [];
  const closedSet = new Set<string>();

  const startNode: PathfindingNode = {
    x: start.x,
    y: start.y,
    g: 0,
    h: heuristic(start, end),
    f: 0,
    parent: null,
  };
  startNode.f = startNode.g + startNode.h;
  openSet.push(startNode);

  while (openSet.length > 0) {
    // Find node with lowest f score
    let currentIndex = 0;
    for (let i = 1; i < openSet.length; i++) {
      if (openSet[i].f < openSet[currentIndex].f) {
        currentIndex = i;
      }
    }

    const current = openSet[currentIndex];

    // Check if we reached the goal
    if (calculateDistance(current, end) < gridSize) {
      return reconstructPath(current);
    }

    // Move current from open to closed
    openSet.splice(currentIndex, 1);
    closedSet.add(nodeKey(current));

    // Check neighbors
    const neighbors = getNeighbors(current, gridSize);
    for (const neighbor of neighbors) {
      const key = nodeKey(neighbor);

      if (closedSet.has(key)) continue;

      // Check if neighbor is blocked by obstacle
      if (isBlocked(neighbor, obstacles)) continue;

      const tentativeG = current.g + calculateDistance(current, neighbor);

      // Find if neighbor is already in open set
      const existingIndex = openSet.findIndex(n => nodeKey(n) === key);

      if (existingIndex === -1) {
        neighbor.g = tentativeG;
        neighbor.h = heuristic(neighbor, end);
        neighbor.f = neighbor.g + neighbor.h;
        neighbor.parent = current;
        openSet.push(neighbor);
      } else if (tentativeG < openSet[existingIndex].g) {
        openSet[existingIndex].g = tentativeG;
        openSet[existingIndex].f = tentativeG + openSet[existingIndex].h;
        openSet[existingIndex].parent = current;
      }
    }
  }

  return null; // No path found
}

function heuristic(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return calculateDistance(a, b);
}

function nodeKey(node: { x: number; y: number }): string {
  return `${Math.round(node.x)},${Math.round(node.y)}`;
}

function getNeighbors(
  node: PathfindingNode,
  gridSize: number
): PathfindingNode[] {
  const neighbors: PathfindingNode[] = [];
  const directions = [
    { dx: 1, dy: 0 },
    { dx: -1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: 0, dy: -1 },
    { dx: 1, dy: 1 },
    { dx: -1, dy: -1 },
    { dx: 1, dy: -1 },
    { dx: -1, dy: 1 },
  ];

  for (const dir of directions) {
    neighbors.push({
      x: node.x + dir.dx * gridSize,
      y: node.y + dir.dy * gridSize,
      g: 0,
      h: 0,
      f: 0,
      parent: null,
    });
  }

  return neighbors;
}

function reconstructPath(node: PathfindingNode): Array<{ x: number; y: number }> {
  const path: Array<{ x: number; y: number }> = [];
  let current: PathfindingNode | null = node;

  while (current !== null) {
    path.unshift({ x: current.x, y: current.y });
    current = current.parent;
  }

  return path;
}

function isBlocked(
  point: { x: number; y: number },
  obstacles: Array<{ x: number; y: number; radius: number }>
): boolean {
  for (const obstacle of obstacles) {
    if (calculateDistance(point, obstacle) < obstacle.radius) {
      return true;
    }
  }
  return false;
}

// ============================================================================
// ROAD INTERSECTION DETECTION
// ============================================================================

export interface Intersection {
  point: { x: number; y: number };
  road1: string;
  road2: string;
  segment1: number;
  segment2: number;
}

export function detectRoadIntersections(roads: Road[]): Intersection[] {
  const intersections: Intersection[] = [];

  for (let i = 0; i < roads.length; i++) {
    for (let j = i + 1; j < roads.length; j++) {
      const road1 = roads[i];
      const road2 = roads[j];

      // Check each segment of road1 against each segment of road2
      for (let s1 = 0; s1 < road1.points.length - 1; s1++) {
        for (let s2 = 0; s2 < road2.points.length - 1; s2++) {
          const intersection = lineSegmentsIntersect(
            road1.points[s1],
            road1.points[s1 + 1],
            road2.points[s2],
            road2.points[s2 + 1]
          );

          if (intersection) {
            intersections.push({
              point: intersection,
              road1: road1.id,
              road2: road2.id,
              segment1: s1,
              segment2: s2,
            });
          }
        }
      }
    }
  }

  return intersections;
}

function lineSegmentsIntersect(
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number },
  p4: { x: number; y: number }
): { x: number; y: number } | null {
  const denominator =
    (p4.y - p3.y) * (p2.x - p1.x) - (p4.x - p3.x) * (p2.y - p1.y);

  if (Math.abs(denominator) < 0.0001) {
    return null; // Lines are parallel
  }

  const ua =
    ((p4.x - p3.x) * (p1.y - p3.y) - (p4.y - p3.y) * (p1.x - p3.x)) /
    denominator;
  const ub =
    ((p2.x - p1.x) * (p1.y - p3.y) - (p2.y - p1.y) * (p1.x - p3.x)) /
    denominator;

  if (ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1) {
    return {
      x: p1.x + ua * (p2.x - p1.x),
      y: p1.y + ua * (p2.y - p1.y),
    };
  }

  return null;
}

// ============================================================================
// SNAP TO ROAD
// ============================================================================

export function snapToRoad(
  point: { x: number; y: number },
  roads: Road[],
  maxDistance: number = 50
): { x: number; y: number; road: Road | null; segmentIndex: number } {
  let closestPoint = point;
  let closestDistance = Infinity;
  let closestRoad: Road | null = null;
  let closestSegment = -1;

  for (const road of roads) {
    for (let i = 0; i < road.points.length - 1; i++) {
      const p1 = road.points[i];
      const p2 = road.points[i + 1];

      const closest = closestPointOnLineSegment(point, p1, p2);
      const distance = calculateDistance(point, closest);

      if (distance < closestDistance && distance <= maxDistance) {
        closestDistance = distance;
        closestPoint = closest;
        closestRoad = road;
        closestSegment = i;
      }
    }
  }

  return {
    x: closestPoint.x,
    y: closestPoint.y,
    road: closestRoad,
    segmentIndex: closestSegment,
  };
}

function closestPointOnLineSegment(
  point: { x: number; y: number },
  lineStart: { x: number; y: number },
  lineEnd: { x: number; y: number }
): { x: number; y: number } {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;

  if (dx === 0 && dy === 0) {
    return lineStart;
  }

  const t = Math.max(
    0,
    Math.min(
      1,
      ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) /
        (dx * dx + dy * dy)
    )
  );

  return {
    x: lineStart.x + t * dx,
    y: lineStart.y + t * dy,
  };
}

// ============================================================================
// CURVE SMOOTHING (Bezier/Catmull-Rom)
// ============================================================================

export function smoothPath(
  points: Array<{ x: number; y: number }>,
  method: 'bezier' | 'catmull-rom' = 'catmull-rom',
  numSegments: number = 10
): Array<{ x: number; y: number }> {
  if (points.length < 3) return points;

  if (method === 'catmull-rom') {
    return catmullRomSpline(points, numSegments);
  } else {
    return bezierSpline(points, numSegments);
  }
}

function catmullRomSpline(
  points: Array<{ x: number; y: number }>,
  segments: number
): Array<{ x: number; y: number }> {
  const result: Array<{ x: number; y: number }> = [points[0]];

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];

    for (let t = 0; t < segments; t++) {
      const s = t / segments;
      const s2 = s * s;
      const s3 = s2 * s;

      const x =
        0.5 *
        (2 * p1.x +
          (-p0.x + p2.x) * s +
          (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * s2 +
          (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * s3);

      const y =
        0.5 *
        (2 * p1.y +
          (-p0.y + p2.y) * s +
          (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * s2 +
          (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * s3);

      result.push({ x, y });
    }
  }

  result.push(points[points.length - 1]);
  return result;
}

function bezierSpline(
  points: Array<{ x: number; y: number }>,
  segments: number
): Array<{ x: number; y: number }> {
  const result: Array<{ x: number; y: number }> = [points[0]];

  for (let i = 0; i < points.length - 1; i += 2) {
    const p0 = points[i];
    const p1 = points[Math.min(i + 1, points.length - 1)];
    const p2 = points[Math.min(i + 2, points.length - 1)];
    const p3 = points[Math.min(i + 3, points.length - 1)];

    for (let t = 0; t < segments; t++) {
      const s = t / segments;
      const s2 = s * s;
      const s3 = s2 * s;
      const u = 1 - s;
      const u2 = u * u;
      const u3 = u2 * u;

      const x = u3 * p0.x + 3 * u2 * s * p1.x + 3 * u * s2 * p2.x + s3 * p3.x;
      const y = u3 * p0.y + 3 * u2 * s * p1.y + 3 * u * s2 * p2.y + s3 * p3.y;

      result.push({ x, y });
    }
  }

  result.push(points[points.length - 1]);
  return result;
}

// ============================================================================
// VALIDATION
// ============================================================================

export function validateMap(state: EditorState): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Check for overlapping spawn points
  for (let i = 0; i < state.coordinates.length; i++) {
    for (let j = i + 1; j < state.coordinates.length; j++) {
      const dist = calculateDistance(state.coordinates[i], state.coordinates[j]);
      if (dist < 1.0) {
        issues.push({
          id: `overlap-${i}-${j}`,
          type: 'warning',
          message: `Spawn points are very close together (${dist.toFixed(2)} yards)`,
          relatedItems: [state.coordinates[i].id, state.coordinates[j].id],
        });
      }
    }
  }

  // Check for roads with too few points
  state.roads.forEach(road => {
    if (road.points.length < 2) {
      issues.push({
        id: `road-${road.id}-invalid`,
        type: 'error',
        message: `Road "${road.name}" has fewer than 2 points`,
        relatedItems: [road.id],
      });
    }
  });

  // Check for unconnected waypoint paths
  state.waypointPaths.forEach(path => {
    if (path.waypoints.length < 2) {
      issues.push({
        id: `path-${path.id}-invalid`,
        type: 'error',
        message: `Waypoint path "${path.name}" has fewer than 2 waypoints`,
        relatedItems: [path.id],
      });
    }

    // Check for very long segments
    for (let i = 0; i < path.waypoints.length - 1; i++) {
      const dist = calculateDistance(path.waypoints[i], path.waypoints[i + 1]);
      if (dist > 500) {
        issues.push({
          id: `path-${path.id}-segment-${i}`,
          type: 'warning',
          message: `Waypoint path "${path.name}" has a very long segment (${dist.toFixed(2)} yards)`,
          relatedItems: [path.id],
        });
      }
    }
  });

  // Check for zone transitions without proper coordinates
  state.transitions.forEach(transition => {
    if (!transition.entranceCoord || !transition.exitCoord) {
      issues.push({
        id: `transition-${transition.id}-invalid`,
        type: 'error',
        message: `Zone transition "${transition.fromZone} → ${transition.toZone}" is missing coordinates`,
        relatedItems: [transition.id],
      });
    }
  });

  // Check for road intersections
  const intersections = detectRoadIntersections(state.roads);
  intersections.forEach((intersection, idx) => {
    issues.push({
      id: `intersection-${idx}`,
      type: 'info',
      message: `Roads intersect at (${intersection.point.x.toFixed(2)}, ${intersection.point.y.toFixed(2)})`,
      relatedItems: [intersection.road1, intersection.road2],
    });
  });

  return issues;
}

// ============================================================================
// SELECTION UTILITIES
// ============================================================================

export function selectInRectangle(
  items: Array<{ id: string; x: number; y: number }>,
  rect: { x: number; y: number; width: number; height: number }
): Set<string> {
  const selected = new Set<string>();

  items.forEach(item => {
    if (
      item.x >= rect.x &&
      item.x <= rect.x + rect.width &&
      item.y >= rect.y &&
      item.y <= rect.y + rect.height
    ) {
      selected.add(item.id);
    }
  });

  return selected;
}

export function selectInCircle(
  items: Array<{ id: string; x: number; y: number }>,
  center: { x: number; y: number },
  radius: number
): Set<string> {
  const selected = new Set<string>();

  items.forEach(item => {
    if (calculateDistance(item, center) <= radius) {
      selected.add(item.id);
    }
  });

  return selected;
}

// ============================================================================
// BATCH OPERATIONS
// ============================================================================

export function translateItems(
  items: Array<{ x: number; y: number }>,
  dx: number,
  dy: number
): void {
  items.forEach(item => {
    item.x += dx;
    item.y += dy;
  });
}

export function scaleItems(
  items: Array<{ x: number; y: number }>,
  center: { x: number; y: number },
  scaleFactor: number
): void {
  items.forEach(item => {
    item.x = center.x + (item.x - center.x) * scaleFactor;
    item.y = center.y + (item.y - center.y) * scaleFactor;
  });
}

export function rotateItems(
  items: Array<{ x: number; y: number }>,
  center: { x: number; y: number },
  angleDegrees: number
): void {
  const angleRadians = (angleDegrees * Math.PI) / 180;
  const cos = Math.cos(angleRadians);
  const sin = Math.sin(angleRadians);

  items.forEach(item => {
    const dx = item.x - center.x;
    const dy = item.y - center.y;

    item.x = center.x + dx * cos - dy * sin;
    item.y = center.y + dx * sin + dy * cos;
  });
}

// ============================================================================
// EXPORT FORMATS
// ============================================================================

export function exportToKML(state: EditorState, mapId: number): string {
  let kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>WoW Map ${mapId}</name>
`;

  // Export spawn points
  state.coordinates.forEach(coord => {
    if (coord.type === 'spawn') {
      kml += `    <Placemark>
      <name>${coord.label || 'Spawn'}</name>
      <Point>
        <coordinates>${coord.x},${coord.y},${coord.z || 0}</coordinates>
      </Point>
    </Placemark>
`;
    }
  });

  // Export roads
  state.roads.forEach(road => {
    kml += `    <Placemark>
      <name>${road.name}</name>
      <LineString>
        <coordinates>
`;
    road.points.forEach(p => {
      kml += `          ${p.x},${p.y},0\n`;
    });
    kml += `        </coordinates>
      </LineString>
    </Placemark>
`;
  });

  kml += `  </Document>
</kml>`;

  return kml;
}

export function exportToGeoJSON(state: EditorState, mapId: number): string {
  const features: any[] = [];

  // Export spawn points
  state.coordinates.forEach(coord => {
    features.push({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [coord.x, coord.y, coord.z || 0],
      },
      properties: {
        id: coord.id,
        type: coord.type,
        label: coord.label,
        mapId: coord.mapId,
      },
    });
  });

  // Export roads
  state.roads.forEach(road => {
    features.push({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: road.points.map(p => [p.x, p.y, 0]),
      },
      properties: {
        id: road.id,
        name: road.name,
        type: road.type,
        width: road.width,
      },
    });
  });

  return JSON.stringify(
    {
      type: 'FeatureCollection',
      features,
    },
    null,
    2
  );
}

// ============================================================================
// KEYBOARD SHORTCUTS
// ============================================================================

export interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  action: string;
  description: string;
}

export const DEFAULT_SHORTCUTS: KeyboardShortcut[] = [
  { key: 'z', ctrl: true, action: 'undo', description: 'Undo last action' },
  { key: 'z', ctrl: true, shift: true, action: 'redo', description: 'Redo last action' },
  { key: 'y', ctrl: true, action: 'redo', description: 'Redo last action' },
  { key: 'c', ctrl: true, action: 'copy', description: 'Copy selected items' },
  { key: 'v', ctrl: true, action: 'paste', description: 'Paste items' },
  { key: 'x', ctrl: true, action: 'cut', description: 'Cut selected items' },
  { key: 'a', ctrl: true, action: 'select-all', description: 'Select all items' },
  { key: 'Delete', action: 'delete', description: 'Delete selected items' },
  { key: 'Backspace', action: 'delete', description: 'Delete selected items' },
  { key: 'Escape', action: 'deselect', description: 'Clear selection' },
  { key: 's', action: 'spawn-tool', description: 'Activate spawn tool' },
  { key: 'r', action: 'road-tool', description: 'Activate road tool' },
  { key: 'w', action: 'waypoint-tool', description: 'Activate waypoint tool' },
  { key: 't', action: 'transition-tool', description: 'Activate transition tool' },
  { key: 'm', action: 'measure-tool', description: 'Activate measure tool' },
  { key: 'g', action: 'toggle-grid', description: 'Toggle grid' },
  { key: '+', action: 'zoom-in', description: 'Zoom in' },
  { key: '-', action: 'zoom-out', description: 'Zoom out' },
  { key: '0', action: 'zoom-reset', description: 'Reset zoom' },
];

export function matchesShortcut(
  event: KeyboardEvent,
  shortcut: KeyboardShortcut
): boolean {
  return (
    event.key === shortcut.key &&
    !!event.ctrlKey === !!shortcut.ctrl &&
    !!event.shiftKey === !!shortcut.shift &&
    !!event.altKey === !!shortcut.alt
  );
}
