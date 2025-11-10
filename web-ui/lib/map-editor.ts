/**
 * Map Coordinate Editor Utilities
 *
 * Provides utilities for working with WoW map coordinates, roads, and zone transitions.
 */

export interface MapCoordinate {
  id: string;
  x: number;
  y: number;
  z?: number;
  mapId: number;
  type: 'spawn' | 'waypoint' | 'portal' | 'flightpath' | 'zone-transition';
  label?: string;
  orientation?: number;
  metadata?: Record<string, any>;
}

export interface Road {
  id: string;
  name: string;
  mapId: number;
  points: Array<{ x: number; y: number }>;
  width: number;
  type: 'main-road' | 'side-road' | 'path' | 'bridge';
  connectsZones?: string[];
}

export interface ZoneTransition {
  id: string;
  fromZone: string;
  toZone: string;
  fromMapId: number;
  toMapId: number;
  entranceCoord: { x: number; y: number; z?: number };
  exitCoord: { x: number; y: number; z?: number };
  type: 'portal' | 'instance-entrance' | 'zone-border' | 'teleporter' | 'elevator';
  bidirectional: boolean;
  requirementLevel?: number;
  requirementQuest?: number;
}

export interface FlightPath {
  id: string;
  name: string;
  fromTaxiNode: number;
  toTaxiNode: number;
  path: Array<{ x: number; y: number; z: number; mapId: number }>;
  cost: number;
  travelTime: number;
}

export interface WaypointPath {
  id: string;
  name: string;
  mapId: number;
  waypoints: Array<{
    x: number;
    y: number;
    z?: number;
    waitTime?: number;
    scriptId?: number;
  }>;
  isLoop: boolean;
  creatureEntry?: number;
}

/**
 * WoW Coordinate System Constants
 *
 * Based on TrinityCore map data:
 * - World coordinates range from -17066.66 to +17066.66 (total: 34133.32 units)
 * - Origin (0,0) is at the map center
 * - Positive X = North, Positive Y = West, Z = Height (0 = sea level)
 * - Each continent map is 64x64 ADT tiles
 */
export const WOW_COORD_CONSTANTS = {
  /** Maximum world coordinate value */
  MAX_COORD: 17066.66,
  /** Minimum world coordinate value */
  MIN_COORD: -17066.66,
  /** Total coordinate span */
  COORD_SPAN: 34133.32,
  /** Number of ADT tiles per axis */
  ADT_TILES: 64,
  /** Size of one ADT tile in yards */
  ADT_SIZE: 533.33333,
} as const;

/**
 * WoW Maps Registry with coordinate metadata
 */
export const WoWMaps = {
  // Classic Maps
  EASTERN_KINGDOMS: {
    id: 0,
    name: 'Eastern Kingdoms',
    expansion: 'classic',
    coordRange: { minX: -17066.66, maxX: 17066.66, minY: -17066.66, maxY: 17066.66 },
    imageUrl: '/maps/eastern_kingdoms.jpg', // Placeholder - replace with actual path
    hasImage: false,
  },
  KALIMDOR: {
    id: 1,
    name: 'Kalimdor',
    expansion: 'classic',
    coordRange: { minX: -17066.66, maxX: 17066.66, minY: -17066.66, maxY: 17066.66 },
    imageUrl: '/maps/kalimdor.jpg',
    hasImage: false,
  },

  // Instances (examples)
  DEADMINES: {
    id: 36,
    name: 'The Deadmines',
    expansion: 'classic',
    type: 'dungeon',
    coordRange: { minX: -300, maxX: 300, minY: -300, maxY: 300 },
    imageUrl: '/maps/deadmines_36.jpg',
    hasImage: false,
  },
  WAILING_CAVERNS: {
    id: 43,
    name: 'Wailing Caverns',
    expansion: 'classic',
    type: 'dungeon',
    coordRange: { minX: -300, maxX: 300, minY: -300, maxY: 300 },
    imageUrl: '/maps/wailing_caverns_43.jpg',
    hasImage: false,
  },

  // TBC Maps
  OUTLAND: {
    id: 530,
    name: 'Outland',
    expansion: 'tbc',
    coordRange: { minX: -17066.66, maxX: 17066.66, minY: -17066.66, maxY: 17066.66 },
    imageUrl: '/maps/outland.jpg',
    hasImage: false,
  },

  // WotLK Maps
  NORTHREND: {
    id: 571,
    name: 'Northrend',
    expansion: 'wotlk',
    coordRange: { minX: -17066.66, maxX: 17066.66, minY: -17066.66, maxY: 17066.66 },
    imageUrl: '/maps/northrend.jpg',
    hasImage: false,
  },

  // Cataclysm Maps
  DEEPHOLM: {
    id: 646,
    name: 'Deepholm',
    expansion: 'cataclysm',
    coordRange: { minX: -17066.66, maxX: 17066.66, minY: -17066.66, maxY: 17066.66 },
    imageUrl: '/maps/deepholm.jpg',
    hasImage: false,
  },

  // MoP Maps
  PANDARIA: {
    id: 860,
    name: 'Pandaria',
    expansion: 'mop',
    coordRange: { minX: -17066.66, maxX: 17066.66, minY: -17066.66, maxY: 17066.66 },
    imageUrl: '/maps/pandaria.jpg',
    hasImage: false,
  },

  // WoD Maps
  DRAENOR: {
    id: 870,
    name: 'Draenor',
    expansion: 'wod',
    coordRange: { minX: -17066.66, maxX: 17066.66, minY: -17066.66, maxY: 17066.66 },
    imageUrl: '/maps/draenor.jpg',
    hasImage: false,
  },

  // Legion Maps
  BROKEN_ISLES: {
    id: 1116,
    name: 'Broken Isles',
    expansion: 'legion',
    coordRange: { minX: -17066.66, maxX: 17066.66, minY: -17066.66, maxY: 17066.66 },
    imageUrl: '/maps/broken_isles.jpg',
    hasImage: false,
  },

  // BfA Maps
  KUL_TIRAS: {
    id: 1643,
    name: 'Kul Tiras',
    expansion: 'bfa',
    coordRange: { minX: -17066.66, maxX: 17066.66, minY: -17066.66, maxY: 17066.66 },
    imageUrl: '/maps/kul_tiras.jpg',
    hasImage: false,
  },
  ZANDALAR: {
    id: 1642,
    name: 'Zandalar',
    expansion: 'bfa',
    coordRange: { minX: -17066.66, maxX: 17066.66, minY: -17066.66, maxY: 17066.66 },
    imageUrl: '/maps/zandalar.jpg',
    hasImage: false,
  },

  // Shadowlands Maps
  SHADOWLANDS: {
    id: 1543,
    name: 'Shadowlands (The Maw)',
    expansion: 'shadowlands',
    coordRange: { minX: -17066.66, maxX: 17066.66, minY: -17066.66, maxY: 17066.66 },
    imageUrl: '/maps/shadowlands.jpg',
    hasImage: false,
  },
  ARDENWEALD: {
    id: 1565,
    name: 'Ardenweald',
    expansion: 'shadowlands',
    coordRange: { minX: -17066.66, maxX: 17066.66, minY: -17066.66, maxY: 17066.66 },
    imageUrl: '/maps/ardenweald.jpg',
    hasImage: false,
  },

  // Dragonflight Maps
  DRAGON_ISLES: {
    id: 2444,
    name: 'Dragon Isles',
    expansion: 'dragonflight',
    coordRange: { minX: -17066.66, maxX: 17066.66, minY: -17066.66, maxY: 17066.66 },
    imageUrl: '/maps/dragon_isles.jpg',
    hasImage: false,
  },

  // The War Within Maps
  KHAZ_ALGAR: {
    id: 2552,
    name: 'Khaz Algar (The War Within)',
    expansion: 'tww',
    coordRange: { minX: -17066.66, maxX: 17066.66, minY: -17066.66, maxY: 17066.66 },
    imageUrl: '/maps/khaz_algar.jpg',
    hasImage: false,
  },
} as const;

/**
 * Convert WoW world coordinates to canvas pixel coordinates
 *
 * WoW coordinate system:
 * - Range: -17066.66 to +17066.66 (origin at center)
 * - Positive X = North, Positive Y = West
 *
 * Canvas coordinate system:
 * - Origin at top-left (0, 0)
 * - Positive X = Right (East), Positive Y = Down (South)
 *
 * @param wowX WoW X coordinate (North-South axis)
 * @param wowY WoW Y coordinate (East-West axis)
 * @param mapId Map ID to get coordinate ranges
 * @param canvasWidth Canvas width in pixels
 * @param canvasHeight Canvas height in pixels
 */
export function wowToCanvas(
  wowX: number,
  wowY: number,
  mapId: number,
  canvasWidth: number,
  canvasHeight: number
): { x: number; y: number } {
  // Get coordinate range for this map
  const mapData = Object.values(WoWMaps).find(m => m.id === mapId);
  const coordRange = mapData?.coordRange || {
    minX: WOW_COORD_CONSTANTS.MIN_COORD,
    maxX: WOW_COORD_CONSTANTS.MAX_COORD,
    minY: WOW_COORD_CONSTANTS.MIN_COORD,
    maxY: WOW_COORD_CONSTANTS.MAX_COORD,
  };

  // Convert WoW coords to normalized 0-1 range
  const normalizedX = (wowX - coordRange.minX) / (coordRange.maxX - coordRange.minX);
  const normalizedY = (wowY - coordRange.minY) / (coordRange.maxY - coordRange.minY);

  // Convert to canvas coordinates
  // Note: WoW Y (West) maps to canvas X (Right/East) - we invert it
  // WoW X (North) maps to canvas Y (Down/South) - we invert it
  const canvasX = (1 - normalizedY) * canvasWidth;  // Invert Y axis
  const canvasY = (1 - normalizedX) * canvasHeight; // Invert X axis

  return { x: canvasX, y: canvasY };
}

/**
 * Convert canvas pixel coordinates to WoW world coordinates
 *
 * @param canvasX Canvas X coordinate (pixels from left)
 * @param canvasY Canvas Y coordinate (pixels from top)
 * @param mapId Map ID to get coordinate ranges
 * @param canvasWidth Canvas width in pixels
 * @param canvasHeight Canvas height in pixels
 */
export function canvasToWow(
  canvasX: number,
  canvasY: number,
  mapId: number,
  canvasWidth: number,
  canvasHeight: number
): { x: number; y: number } {
  // Get coordinate range for this map
  const mapData = Object.values(WoWMaps).find(m => m.id === mapId);
  const coordRange = mapData?.coordRange || {
    minX: WOW_COORD_CONSTANTS.MIN_COORD,
    maxX: WOW_COORD_CONSTANTS.MAX_COORD,
    minY: WOW_COORD_CONSTANTS.MIN_COORD,
    maxY: WOW_COORD_CONSTANTS.MAX_COORD,
  };

  // Normalize canvas coords to 0-1
  const normalizedCanvasX = canvasX / canvasWidth;
  const normalizedCanvasY = canvasY / canvasHeight;

  // Invert back to WoW coordinate system
  // Canvas X (Right/East) → WoW Y (West) - inverted
  // Canvas Y (Down/South) → WoW X (North) - inverted
  const normalizedWowX = 1 - normalizedCanvasY;
  const normalizedWowY = 1 - normalizedCanvasX;

  // Convert from normalized to actual WoW coordinates
  const wowX = coordRange.minX + normalizedWowX * (coordRange.maxX - coordRange.minX);
  const wowY = coordRange.minY + normalizedWowY * (coordRange.maxY - coordRange.minY);

  return { x: wowX, y: wowY };
}

/**
 * Convert zone coordinates (0-100 in-game UI) to world coordinates
 *
 * @param zoneX Zone X coordinate (0-100, where 0 is left, 100 is right)
 * @param zoneY Zone Y coordinate (0-100, where 0 is top, 100 is bottom)
 * @param zoneMinX Minimum X world coordinate for this zone
 * @param zoneMaxX Maximum X world coordinate for this zone
 * @param zoneMinY Minimum Y world coordinate for this zone
 * @param zoneMaxY Maximum Y world coordinate for this zone
 */
export function zoneToWorld(
  zoneX: number,
  zoneY: number,
  zoneMinX: number,
  zoneMaxX: number,
  zoneMinY: number,
  zoneMaxY: number
): { x: number; y: number } {
  // Zone coords are 0-100, convert to world coords
  const worldX = zoneMinX + (zoneX / 100) * (zoneMaxX - zoneMinX);
  const worldY = zoneMinY + (zoneY / 100) * (zoneMaxY - zoneMinY);
  return { x: worldX, y: worldY };
}

/**
 * Convert world coordinates to zone coordinates (0-100 in-game UI)
 */
export function worldToZone(
  worldX: number,
  worldY: number,
  zoneMinX: number,
  zoneMaxX: number,
  zoneMinY: number,
  zoneMaxY: number
): { x: number; y: number } {
  const zoneX = ((worldX - zoneMinX) / (zoneMaxX - zoneMinX)) * 100;
  const zoneY = ((worldY - zoneMinY) / (zoneMaxY - zoneMinY)) * 100;
  return { x: zoneX, y: zoneY };
}

/**
 * Load map image for display
 *
 * @param mapId Map ID
 * @returns Promise that resolves with HTMLImageElement or null if no image
 */
export async function loadMapImage(mapId: number): Promise<HTMLImageElement | null> {
  const mapData = Object.values(WoWMaps).find(m => m.id === mapId);

  if (!mapData?.imageUrl || !mapData.hasImage) {
    return null;
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null); // Return null instead of rejecting
    img.src = mapData.imageUrl;
  });
}

/**
 * Calculate distance between two coordinates
 */
export function calculateDistance(
  coord1: { x: number; y: number; z?: number },
  coord2: { x: number; y: number; z?: number }
): number {
  const dx = coord2.x - coord1.x;
  const dy = coord2.y - coord1.y;
  const dz = (coord2.z || 0) - (coord1.z || 0);

  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Generate SQL for creature spawn
 */
export function generateSpawnSQL(coord: MapCoordinate, creatureEntry: number): string {
  return `INSERT INTO creature (guid, id, map, position_x, position_y, position_z, orientation)
VALUES (
  NULL, -- Auto-generate GUID
  ${creatureEntry},
  ${coord.mapId},
  ${coord.x.toFixed(4)},
  ${coord.y.toFixed(4)},
  ${coord.z?.toFixed(4) || '0.0000'},
  ${coord.orientation?.toFixed(4) || '0.0000'}
);`;
}

/**
 * Generate SQL for waypoint path
 */
export function generateWaypointSQL(path: WaypointPath): string {
  let sql = `-- Waypoint Path: ${path.name}\n`;
  sql += `DELETE FROM waypoint_data WHERE id = ${path.id};\n\n`;

  path.waypoints.forEach((wp, index) => {
    sql += `INSERT INTO waypoint_data (id, point, position_x, position_y, position_z, delay, action) VALUES
(${path.id}, ${index + 1}, ${wp.x.toFixed(4)}, ${wp.y.toFixed(4)}, ${wp.z?.toFixed(4) || '0.0000'}, ${wp.waitTime || 0}, ${wp.scriptId || 0});\n`;
  });

  return sql;
}

/**
 * Generate SQL for zone transition (areatrigger_teleport)
 */
export function generateZoneTransitionSQL(transition: ZoneTransition): string {
  return `INSERT INTO areatrigger_teleport (ID, Name, target_map, target_position_x, target_position_y, target_position_z, target_orientation)
VALUES (
  NULL, -- Auto-generate ID
  '${transition.fromZone} to ${transition.toZone}',
  ${transition.toMapId},
  ${transition.exitCoord.x.toFixed(4)},
  ${transition.exitCoord.y.toFixed(4)},
  ${transition.exitCoord.z?.toFixed(4) || '0.0000'},
  0.0000
);

-- Place areatrigger at entrance coordinates (map ${transition.fromMapId})
-- X: ${transition.entranceCoord.x.toFixed(4)}, Y: ${transition.entranceCoord.y.toFixed(4)}`;
}

/**
 * Simplify path using Ramer-Douglas-Peucker algorithm
 * Reduces number of waypoints while maintaining path shape
 */
export function simplifyPath(
  points: Array<{ x: number; y: number }>,
  epsilon: number = 1.0
): Array<{ x: number; y: number }> {
  if (points.length <= 2) return points;

  // Find point with maximum distance from line between first and last
  let maxDistance = 0;
  let maxIndex = 0;

  const first = points[0];
  const last = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i++) {
    const distance = perpendicularDistance(points[i], first, last);
    if (distance > maxDistance) {
      maxDistance = distance;
      maxIndex = i;
    }
  }

  // If max distance is greater than epsilon, recursively simplify
  if (maxDistance > epsilon) {
    const left = simplifyPath(points.slice(0, maxIndex + 1), epsilon);
    const right = simplifyPath(points.slice(maxIndex), epsilon);

    return [...left.slice(0, -1), ...right];
  } else {
    return [first, last];
  }
}

/**
 * Calculate perpendicular distance from point to line
 */
function perpendicularDistance(
  point: { x: number; y: number },
  lineStart: { x: number; y: number },
  lineEnd: { x: number; y: number }
): number {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;

  const numerator = Math.abs(
    dy * point.x - dx * point.y + lineEnd.x * lineStart.y - lineEnd.y * lineStart.x
  );
  const denominator = Math.sqrt(dx * dx + dy * dy);

  return numerator / denominator;
}

/**
 * Find shortest path between two zones using A* algorithm
 */
export function findPathBetweenZones(
  fromZone: string,
  toZone: string,
  roads: Road[],
  transitions: ZoneTransition[]
): { path: string[]; distance: number } | null {
  // Build graph of zone connections
  const graph = new Map<string, Array<{ zone: string; distance: number }>>();

  // Add road connections
  roads.forEach(road => {
    if (road.connectsZones && road.connectsZones.length >= 2) {
      road.connectsZones.forEach((zone, i) => {
        if (i < road.connectsZones!.length - 1) {
          const nextZone = road.connectsZones![i + 1];
          const distance = road.points.reduce((sum, point, j) => {
            if (j === 0) return 0;
            const prev = road.points[j - 1];
            return sum + calculateDistance(prev, point);
          }, 0);

          if (!graph.has(zone)) graph.set(zone, []);
          graph.get(zone)!.push({ zone: nextZone, distance });
        }
      });
    }
  });

  // Add transition connections
  transitions.forEach(transition => {
    if (!graph.has(transition.fromZone)) graph.set(transition.fromZone, []);
    graph.get(transition.fromZone)!.push({
      zone: transition.toZone,
      distance: 10, // Fixed cost for teleports/transitions
    });

    if (transition.bidirectional) {
      if (!graph.has(transition.toZone)) graph.set(transition.toZone, []);
      graph.get(transition.toZone)!.push({
        zone: transition.fromZone,
        distance: 10,
      });
    }
  });

  // A* pathfinding
  const openSet = new Set([fromZone]);
  const cameFrom = new Map<string, string>();
  const gScore = new Map<string, number>([[fromZone, 0]]);
  const fScore = new Map<string, number>([[fromZone, 0]]);

  while (openSet.size > 0) {
    // Find node with lowest fScore
    let current = '';
    let lowestScore = Infinity;
    openSet.forEach(node => {
      const score = fScore.get(node) || Infinity;
      if (score < lowestScore) {
        lowestScore = score;
        current = node;
      }
    });

    if (current === toZone) {
      // Reconstruct path
      const path: string[] = [current];
      while (cameFrom.has(current)) {
        current = cameFrom.get(current)!;
        path.unshift(current);
      }
      return { path, distance: gScore.get(toZone) || 0 };
    }

    openSet.delete(current);

    const neighbors = graph.get(current) || [];
    neighbors.forEach(({ zone: neighbor, distance }) => {
      const tentativeGScore = (gScore.get(current) || 0) + distance;

      if (tentativeGScore < (gScore.get(neighbor) || Infinity)) {
        cameFrom.set(neighbor, current);
        gScore.set(neighbor, tentativeGScore);
        fScore.set(neighbor, tentativeGScore); // No heuristic for simplicity
        openSet.add(neighbor);
      }
    });
  }

  return null; // No path found
}

/**
 * Export all map data to JSON
 */
export function exportMapData(
  coordinates: MapCoordinate[],
  roads: Road[],
  transitions: ZoneTransition[],
  paths: WaypointPath[]
): string {
  return JSON.stringify(
    {
      version: '1.0',
      exportDate: new Date().toISOString(),
      coordinates,
      roads,
      transitions,
      paths,
    },
    null,
    2
  );
}

/**
 * Import map data from JSON
 */
export function importMapData(jsonString: string): {
  coordinates: MapCoordinate[];
  roads: Road[];
  transitions: ZoneTransition[];
  paths: WaypointPath[];
} | null {
  try {
    const data = JSON.parse(jsonString);

    return {
      coordinates: data.coordinates || [],
      roads: data.roads || [],
      transitions: data.transitions || [],
      paths: data.paths || [],
    };
  } catch (error) {
    console.error('Failed to import map data:', error);
    return null;
  }
}
