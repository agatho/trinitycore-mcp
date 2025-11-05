/**
 * Measurement Tools
 *
 * 3D measurement utilities for distance, height, area, and volume calculations.
 * Used in the interactive 3D viewer.
 *
 * @module measurement-tools
 */

import type { Vector3 } from "./vmap-types";

// ============================================================================
// Types
// ============================================================================

/**
 * Measurement types
 */
export enum MeasurementType {
  Distance = "distance",
  Height = "height",
  Area = "area",
  Volume = "volume",
  Angle = "angle",
}

/**
 * Distance measurement
 */
export interface DistanceMeasurement {
  type: MeasurementType.Distance;
  start: Vector3;
  end: Vector3;
  distance: number;
  horizontalDistance: number;
  verticalDistance: number;
}

/**
 * Height measurement
 */
export interface HeightMeasurement {
  type: MeasurementType.Height;
  base: Vector3;
  top: Vector3;
  height: number;
}

/**
 * Area measurement (polygon)
 */
export interface AreaMeasurement {
  type: MeasurementType.Area;
  points: Vector3[];
  area: number;
  perimeter: number;
}

/**
 * Volume measurement (bounding box)
 */
export interface VolumeMeasurement {
  type: MeasurementType.Volume;
  min: Vector3;
  max: Vector3;
  volume: number;
  dimensions: Vector3;
}

/**
 * Angle measurement
 */
export interface AngleMeasurement {
  type: MeasurementType.Angle;
  vertex: Vector3;
  pointA: Vector3;
  pointB: Vector3;
  angle: number; // degrees
  radians: number;
}

/**
 * Generic measurement
 */
export type Measurement =
  | DistanceMeasurement
  | HeightMeasurement
  | AreaMeasurement
  | VolumeMeasurement
  | AngleMeasurement;

// ============================================================================
// Distance Measurements
// ============================================================================

/**
 * Measure 3D distance between two points
 *
 * @param start Start point
 * @param end End point
 * @returns Distance measurement
 */
export function measureDistance(start: Vector3, end: Vector3): DistanceMeasurement {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const dz = end.z - start.z;

  const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
  const horizontalDistance = Math.sqrt(dx * dx + dz * dz);
  const verticalDistance = Math.abs(dy);

  return {
    type: MeasurementType.Distance,
    start,
    end,
    distance,
    horizontalDistance,
    verticalDistance,
  };
}

/**
 * Measure height (vertical distance only)
 *
 * @param base Base point
 * @param top Top point
 * @returns Height measurement
 */
export function measureHeight(base: Vector3, top: Vector3): HeightMeasurement {
  const height = Math.abs(top.y - base.y);

  return {
    type: MeasurementType.Height,
    base,
    top,
    height,
  };
}

// ============================================================================
// Area Measurements
// ============================================================================

/**
 * Measure area of a polygon defined by points
 *
 * Uses the Shoelace formula for polygon area calculation.
 * Points should be coplanar and in order (clockwise or counter-clockwise).
 *
 * @param points Polygon vertices
 * @returns Area measurement
 */
export function measureArea(points: Vector3[]): AreaMeasurement {
  if (points.length < 3) {
    return {
      type: MeasurementType.Area,
      points,
      area: 0,
      perimeter: 0,
    };
  }

  // Project to 2D (use XZ plane)
  const points2D = points.map((p) => ({ x: p.x, z: p.z }));

  // Shoelace formula
  let area = 0;
  for (let i = 0; i < points2D.length; i++) {
    const j = (i + 1) % points2D.length;
    area += points2D[i].x * points2D[j].z;
    area -= points2D[j].x * points2D[i].z;
  }
  area = Math.abs(area) / 2;

  // Calculate perimeter
  let perimeter = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    perimeter += distance3D(points[i], points[j]);
  }

  return {
    type: MeasurementType.Area,
    points,
    area,
    perimeter,
  };
}

/**
 * Measure area of a rectangle
 *
 * @param corner1 First corner
 * @param corner2 Opposite corner
 * @returns Area measurement
 */
export function measureRectangleArea(
  corner1: Vector3,
  corner2: Vector3,
): AreaMeasurement {
  const width = Math.abs(corner2.x - corner1.x);
  const depth = Math.abs(corner2.z - corner1.z);
  const area = width * depth;

  const points = [
    corner1,
    { x: corner2.x, y: corner1.y, z: corner1.z },
    corner2,
    { x: corner1.x, y: corner1.y, z: corner2.z },
  ];

  return {
    type: MeasurementType.Area,
    points,
    area,
    perimeter: 2 * (width + depth),
  };
}

/**
 * Measure area of a circle
 *
 * @param center Circle center
 * @param radius Circle radius
 * @returns Area measurement (approximated as polygon)
 */
export function measureCircleArea(center: Vector3, radius: number): AreaMeasurement {
  const area = Math.PI * radius * radius;
  const perimeter = 2 * Math.PI * radius;

  // Generate polygon points for visualization
  const segments = 32;
  const points: Vector3[] = [];
  for (let i = 0; i < segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    points.push({
      x: center.x + Math.cos(angle) * radius,
      y: center.y,
      z: center.z + Math.sin(angle) * radius,
    });
  }

  return {
    type: MeasurementType.Area,
    points,
    area,
    perimeter,
  };
}

// ============================================================================
// Volume Measurements
// ============================================================================

/**
 * Measure volume of an axis-aligned bounding box
 *
 * @param min Minimum corner
 * @param max Maximum corner
 * @returns Volume measurement
 */
export function measureVolume(min: Vector3, max: Vector3): VolumeMeasurement {
  const dimensions: Vector3 = {
    x: Math.abs(max.x - min.x),
    y: Math.abs(max.y - min.y),
    z: Math.abs(max.z - min.z),
  };

  const volume = dimensions.x * dimensions.y * dimensions.z;

  return {
    type: MeasurementType.Volume,
    min,
    max,
    volume,
    dimensions,
  };
}

/**
 * Measure volume of a sphere
 *
 * @param center Sphere center
 * @param radius Sphere radius
 * @returns Volume measurement
 */
export function measureSphereVolume(center: Vector3, radius: number): VolumeMeasurement {
  const volume = (4 / 3) * Math.PI * radius ** 3;

  const min: Vector3 = {
    x: center.x - radius,
    y: center.y - radius,
    z: center.z - radius,
  };

  const max: Vector3 = {
    x: center.x + radius,
    y: center.y + radius,
    z: center.z + radius,
  };

  return {
    type: MeasurementType.Volume,
    min,
    max,
    volume,
    dimensions: { x: radius * 2, y: radius * 2, z: radius * 2 },
  };
}

// ============================================================================
// Angle Measurements
// ============================================================================

/**
 * Measure angle between three points (vertex in the middle)
 *
 * @param pointA First point
 * @param vertex Vertex point
 * @param pointB Second point
 * @returns Angle measurement
 */
export function measureAngle(
  pointA: Vector3,
  vertex: Vector3,
  pointB: Vector3,
): AngleMeasurement {
  // Vectors from vertex to points
  const vecA = {
    x: pointA.x - vertex.x,
    y: pointA.y - vertex.y,
    z: pointA.z - vertex.z,
  };

  const vecB = {
    x: pointB.x - vertex.x,
    y: pointB.y - vertex.y,
    z: pointB.z - vertex.z,
  };

  // Dot product and magnitudes
  const dot = vecA.x * vecB.x + vecA.y * vecB.y + vecA.z * vecB.z;
  const magA = Math.sqrt(vecA.x ** 2 + vecA.y ** 2 + vecA.z ** 2);
  const magB = Math.sqrt(vecB.x ** 2 + vecB.y ** 2 + vecB.z ** 2);

  // Calculate angle
  const cosAngle = dot / (magA * magB);
  const radians = Math.acos(Math.max(-1, Math.min(1, cosAngle))); // Clamp to [-1, 1]
  const angle = (radians * 180) / Math.PI;

  return {
    type: MeasurementType.Angle,
    vertex,
    pointA,
    pointB,
    angle,
    radians,
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Calculate 3D distance between two points
 */
export function distance3D(a: Vector3, b: Vector3): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dz = b.z - a.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Calculate 2D distance (horizontal only)
 */
export function distance2D(a: Vector3, b: Vector3): number {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  return Math.sqrt(dx * dx + dz * dz);
}

/**
 * Format distance for display
 *
 * @param distance Distance in units
 * @returns Formatted string
 */
export function formatDistance(distance: number): string {
  if (distance < 1) {
    return `${(distance * 100).toFixed(1)} cm`;
  } else if (distance < 1000) {
    return `${distance.toFixed(2)} m`;
  } else {
    return `${(distance / 1000).toFixed(2)} km`;
  }
}

/**
 * Format area for display
 *
 * @param area Area in square units
 * @returns Formatted string
 */
export function formatArea(area: number): string {
  if (area < 1) {
    return `${(area * 10000).toFixed(1)} cm²`;
  } else if (area < 1000000) {
    return `${area.toFixed(2)} m²`;
  } else {
    return `${(area / 1000000).toFixed(2)} km²`;
  }
}

/**
 * Format volume for display
 *
 * @param volume Volume in cubic units
 * @returns Formatted string
 */
export function formatVolume(volume: number): string {
  if (volume < 1) {
    return `${(volume * 1000000).toFixed(1)} cm³`;
  } else if (volume < 1000000000) {
    return `${volume.toFixed(2)} m³`;
  } else {
    return `${(volume / 1000000000).toFixed(2)} km³`;
  }
}

/**
 * Format angle for display
 *
 * @param angle Angle in degrees
 * @returns Formatted string
 */
export function formatAngle(angle: number): string {
  return `${angle.toFixed(1)}°`;
}

/**
 * Get measurement summary as text
 *
 * @param measurement Measurement object
 * @returns Human-readable summary
 */
export function getMeasurementSummary(measurement: Measurement): string {
  switch (measurement.type) {
    case MeasurementType.Distance:
      return `Distance: ${formatDistance(measurement.distance)}\nHorizontal: ${formatDistance(measurement.horizontalDistance)}\nVertical: ${formatDistance(measurement.verticalDistance)}`;

    case MeasurementType.Height:
      return `Height: ${formatDistance(measurement.height)}`;

    case MeasurementType.Area:
      return `Area: ${formatArea(measurement.area)}\nPerimeter: ${formatDistance(measurement.perimeter)}`;

    case MeasurementType.Volume:
      return `Volume: ${formatVolume(measurement.volume)}\nDimensions: ${formatDistance(measurement.dimensions.x)} × ${formatDistance(measurement.dimensions.y)} × ${formatDistance(measurement.dimensions.z)}`;

    case MeasurementType.Angle:
      return `Angle: ${formatAngle(measurement.angle)}`;

    default:
      return "Unknown measurement";
  }
}

/**
 * Export measurements to CSV
 *
 * @param measurements Array of measurements
 * @returns CSV string
 */
export function exportMeasurementsCSV(measurements: Measurement[]): string {
  const lines: string[] = [];

  // Header
  lines.push("Type,Value,Units,Details");

  // Rows
  for (const m of measurements) {
    switch (m.type) {
      case MeasurementType.Distance:
        lines.push(
          `Distance,${m.distance.toFixed(3)},meters,"Horizontal: ${m.horizontalDistance.toFixed(3)}m, Vertical: ${m.verticalDistance.toFixed(3)}m"`,
        );
        break;
      case MeasurementType.Height:
        lines.push(`Height,${m.height.toFixed(3)},meters,""`);
        break;
      case MeasurementType.Area:
        lines.push(
          `Area,${m.area.toFixed(3)},square meters,"Perimeter: ${m.perimeter.toFixed(3)}m"`,
        );
        break;
      case MeasurementType.Volume:
        lines.push(
          `Volume,${m.volume.toFixed(3)},cubic meters,"Dimensions: ${m.dimensions.x.toFixed(1)}×${m.dimensions.y.toFixed(1)}×${m.dimensions.z.toFixed(1)}m"`,
        );
        break;
      case MeasurementType.Angle:
        lines.push(`Angle,${m.angle.toFixed(1)},degrees,"${m.radians.toFixed(3)} radians"`);
        break;
    }
  }

  return lines.join("\n");
}
