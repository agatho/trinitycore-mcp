/**
 * MeasurementTools - Professional measurement utilities
 *
 * Provides distance measurement, area calculation, elevation profiles,
 * and coordinate display with export capabilities.
 *
 * @module lib/three/measurement-tools
 */

import * as THREE from 'three';

export interface DistanceMeasurement {
  distance2D: number;
  distance3D: number;
  elevationChange: number;
  slope: number;
}

export interface AreaMeasurement {
  area2D: number;
  area3D: number;
  perimeter: number;
  pointCount: number;
}

export interface ElevationProfile {
  points: Array<{ distance: number; height: number }>;
  minHeight: number;
  maxHeight: number;
  totalDistance: number;
}

/**
 * Measurement tools for world editor
 */
export class MeasurementTools {
  private scene: THREE.Scene;
  private measurements: Map<string, THREE.Group> = new Map();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    console.log('[MeasurementTools] Initialized');
  }

  /**
   * Measure distance between two points
   */
  public measureDistance(point1: THREE.Vector3, point2: THREE.Vector3): DistanceMeasurement {
    // 2D distance (ignoring height)
    const dx = point2.x - point1.x;
    const dz = point2.z - point1.z;
    const distance2D = Math.sqrt(dx * dx + dz * dz);

    // 3D distance
    const distance3D = point1.distanceTo(point2);

    // Elevation change
    const elevationChange = point2.y - point1.y;

    // Slope (degrees)
    const slope = Math.atan2(Math.abs(elevationChange), distance2D) * (180 / Math.PI);

    // Create visual
    this.createDistanceLine(point1, point2);

    return {
      distance2D,
      distance3D,
      elevationChange,
      slope,
    };
  }

  /**
   * Create distance measurement visual
   */
  private createDistanceLine(point1: THREE.Vector3, point2: THREE.Vector3): THREE.Group {
    const group = new THREE.Group();

    // Line
    const geometry = new THREE.BufferGeometry().setFromPoints([point1, point2]);
    const material = new THREE.LineBasicMaterial({
      color: 0xffff00,
      linewidth: 2,
    });
    const line = new THREE.Line(geometry, material);
    group.add(line);

    // Endpoints
    const sphereGeometry = new THREE.SphereGeometry(1, 8, 8);
    const sphereMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 });

    const sphere1 = new THREE.Mesh(sphereGeometry, sphereMaterial);
    sphere1.position.copy(point1);
    group.add(sphere1);

    const sphere2 = new THREE.Mesh(sphereGeometry, sphereMaterial);
    sphere2.position.copy(point2);
    group.add(sphere2);

    this.scene.add(group);
    return group;
  }

  /**
   * Measure area of polygon
   */
  public measureArea(points: THREE.Vector3[]): AreaMeasurement {
    if (points.length < 3) {
      throw new Error('Area measurement requires at least 3 points');
    }

    // 2D area using shoelace formula
    let area2D = 0;
    for (let i = 0; i < points.length; i++) {
      const j = (i + 1) % points.length;
      area2D += points[i].x * points[j].z - points[j].x * points[i].z;
    }
    area2D = Math.abs(area2D / 2);

    // Perimeter
    let perimeter = 0;
    for (let i = 0; i < points.length; i++) {
      const j = (i + 1) % points.length;
      perimeter += points[i].distanceTo(points[j]);
    }

    // Create visual
    this.createAreaPolygon(points);

    return {
      area2D,
      area3D: area2D, // Simplified - proper 3D area requires triangulation
      perimeter,
      pointCount: points.length,
    };
  }

  /**
   * Create area measurement visual
   */
  private createAreaPolygon(points: THREE.Vector3[]): THREE.Group {
    const group = new THREE.Group();

    // Create polygon shape
    const shape = new THREE.Shape();
    shape.moveTo(points[0].x, points[0].z);
    for (let i = 1; i < points.length; i++) {
      shape.lineTo(points[i].x, points[i].z);
    }
    shape.closePath();

    // Create filled polygon
    const geometry = new THREE.ShapeGeometry(shape);
    const material = new THREE.MeshBasicMaterial({
      color: 0x00ff00,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = points[0].y;
    group.add(mesh);

    // Outline
    const outlineGeometry = new THREE.BufferGeometry().setFromPoints([...points, points[0]]);
    const outlineMaterial = new THREE.LineBasicMaterial({
      color: 0x00ff00,
      linewidth: 2,
    });
    const outline = new THREE.Line(outlineGeometry, outlineMaterial);
    group.add(outline);

    this.scene.add(group);
    return group;
  }

  /**
   * Create elevation profile between two points
   */
  public createElevationProfile(
    start: THREE.Vector3,
    end: THREE.Vector3,
    samples: number = 50,
    terrainLayer?: THREE.Object3D
  ): ElevationProfile {
    const points: Array<{ distance: number; height: number }> = [];
    const raycaster = new THREE.Raycaster();
    const direction = new THREE.Vector3(0, -1, 0);

    let minHeight = Infinity;
    let maxHeight = -Infinity;

    for (let i = 0; i <= samples; i++) {
      const t = i / samples;
      const point = new THREE.Vector3().lerpVectors(start, end, t);
      const distance = start.distanceTo(point);

      let height = point.y;

      // Sample terrain if provided
      if (terrainLayer) {
        const origin = new THREE.Vector3(point.x, 1000, point.z);
        raycaster.set(origin, direction);
        const intersects = raycaster.intersectObjects(terrainLayer.children, true);
        if (intersects.length > 0) {
          height = intersects[0].point.y;
        }
      }

      points.push({ distance, height });
      minHeight = Math.min(minHeight, height);
      maxHeight = Math.max(maxHeight, height);
    }

    return {
      points,
      minHeight,
      maxHeight,
      totalDistance: start.distanceTo(end),
    };
  }

  /**
   * Export measurements to CSV
   */
  public exportMeasurements(measurements: any[], format: 'csv' | 'json' = 'csv'): string {
    if (format === 'json') {
      return JSON.stringify(measurements, null, 2);
    }

    // CSV format
    if (measurements.length === 0) return '';

    const headers = Object.keys(measurements[0]).join(',');
    const rows = measurements.map(m => Object.values(m).join(','));

    return [headers, ...rows].join('\n');
  }

  /**
   * Clear measurement by ID
   */
  public clearMeasurement(id: string): void {
    const group = this.measurements.get(id);
    if (!group) return;

    this.scene.remove(group);
    group.traverse(child => {
      if (child instanceof THREE.Mesh || child instanceof THREE.Line) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach(m => m.dispose());
        } else {
          child.material.dispose();
        }
      }
    });

    this.measurements.delete(id);
  }

  /**
   * Clear all measurements
   */
  public clearAll(): void {
    for (const id of Array.from(this.measurements.keys())) {
      this.clearMeasurement(id);
    }
  }

  /**
   * Dispose
   */
  public dispose(): void {
    this.clearAll();
    console.log('[MeasurementTools] Disposed');
  }
}
