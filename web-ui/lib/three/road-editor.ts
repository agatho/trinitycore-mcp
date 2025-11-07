/**
 * RoadEditor - Interactive road network creation and editing
 *
 * Creates bezier curve roads with width adjustment, junction detection,
 * and terrain conforming capabilities.
 *
 * @module lib/three/road-editor
 */

import * as THREE from 'three';
import type { Road } from '@/lib/map-editor';

export type RoadSurface = 'paved' | 'dirt' | 'cobblestone';

export interface Road3D {
  id: string;
  path: THREE.Vector3[];
  width: number;
  surface: RoadSurface;
  mesh: THREE.Mesh;
  handles: THREE.Mesh[];
}

export interface Junction {
  position: THREE.Vector3;
  roadIds: string[];
}

/**
 * Road editor for network creation
 */
export class RoadEditor {
  private scene: THREE.Scene;
  private roads: Map<string, Road3D> = new Map();
  private surfaceMaterials: Map<RoadSurface, THREE.Material>;

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    // Create surface materials
    this.surfaceMaterials = new Map([
      ['paved', new THREE.MeshLambertMaterial({ color: 0x444444 })],
      ['dirt', new THREE.MeshLambertMaterial({ color: 0x8b7355 })],
      ['cobblestone', new THREE.MeshLambertMaterial({ color: 0x6b6b6b })],
    ]);

    console.log('[RoadEditor] Initialized');
  }

  /**
   * Create road from points
   */
  public createRoad(
    id: string,
    points: THREE.Vector3[],
    width: number = 10,
    surface: RoadSurface = 'paved'
  ): Road3D {
    if (points.length < 2) {
      throw new Error('Road must have at least 2 points');
    }

    // Create bezier curve
    const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.3);

    // Generate road mesh
    const mesh = this.createRoadMesh(curve, width, surface);

    // Create control point handles
    const handles = this.createHandles(points);

    const road: Road3D = {
      id,
      path: points,
      width,
      surface,
      mesh,
      handles,
    };

    this.scene.add(mesh);
    handles.forEach(h => this.scene.add(h));

    this.roads.set(id, road);

    return road;
  }

  /**
   * Create road mesh from curve
   */
  private createRoadMesh(
    curve: THREE.CatmullRomCurve3,
    width: number,
    surface: RoadSurface
  ): THREE.Mesh {
    // Create tube geometry along curve
    const geometry = new THREE.TubeGeometry(curve, 100, width / 2, 8, false);

    // Flatten the tube to create road surface
    const positions = geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const y = positions.getY(i);
      positions.setY(i, y * 0.1); // Flatten
    }
    geometry.computeVertexNormals();

    const material = this.surfaceMaterials.get(surface)!;
    const mesh = new THREE.Mesh(geometry, material);
    mesh.receiveShadow = true;

    return mesh;
  }

  /**
   * Create control point handles
   */
  private createHandles(points: THREE.Vector3[]): THREE.Mesh[] {
    const geometry = new THREE.SphereGeometry(2, 8, 8);
    const material = new THREE.MeshBasicMaterial({
      color: 0xff5555,
      transparent: true,
      opacity: 0.7,
    });

    return points.map(point => {
      const handle = new THREE.Mesh(geometry, material);
      handle.position.copy(point);
      return handle;
    });
  }

  /**
   * Update road width
   */
  public updateWidth(roadId: string, width: number): void {
    const road = this.roads.get(roadId);
    if (!road) return;

    road.width = width;

    // Recreate mesh
    this.scene.remove(road.mesh);
    road.mesh.geometry.dispose();

    const curve = new THREE.CatmullRomCurve3(road.path, false, 'catmullrom', 0.3);
    road.mesh = this.createRoadMesh(curve, width, road.surface);
    this.scene.add(road.mesh);
  }

  /**
   * Conform road to terrain
   */
  public conformToTerrain(roadId: string, terrainLayer: THREE.Object3D): void {
    const road = this.roads.get(roadId);
    if (!road) return;

    const raycaster = new THREE.Raycaster();
    const direction = new THREE.Vector3(0, -1, 0);

    // Adjust each point to terrain height
    for (const point of road.path) {
      const origin = new THREE.Vector3(point.x, 1000, point.z);
      raycaster.set(origin, direction);

      const intersects = raycaster.intersectObjects(terrainLayer.children, true);
      if (intersects.length > 0) {
        point.y = intersects[0].point.y + 0.1; // Slightly above terrain
      }
    }

    // Recreate mesh with adjusted points
    this.scene.remove(road.mesh);
    road.mesh.geometry.dispose();

    const curve = new THREE.CatmullRomCurve3(road.path, false, 'catmullrom', 0.3);
    road.mesh = this.createRoadMesh(curve, road.width, road.surface);
    this.scene.add(road.mesh);

    // Update handles
    for (let i = 0; i < road.handles.length; i++) {
      road.handles[i].position.copy(road.path[i]);
    }
  }

  /**
   * Detect junctions between roads
   */
  public detectJunctions(threshold: number = 5): Junction[] {
    const junctions: Junction[] = [];
    const roadIds = Array.from(this.roads.keys());

    // Check each pair of roads
    for (let i = 0; i < roadIds.length; i++) {
      for (let j = i + 1; j < roadIds.length; j++) {
        const road1 = this.roads.get(roadIds[i])!;
        const road2 = this.roads.get(roadIds[j])!;

        // Check endpoints
        for (const point1 of road1.path) {
          for (const point2 of road2.path) {
            if (point1.distanceTo(point2) < threshold) {
              junctions.push({
                position: point1.clone().lerp(point2, 0.5),
                roadIds: [road1.id, road2.id],
              });
            }
          }
        }
      }
    }

    return junctions;
  }

  /**
   * Remove road
   */
  public removeRoad(roadId: string): void {
    const road = this.roads.get(roadId);
    if (!road) return;

    this.scene.remove(road.mesh);
    road.mesh.geometry.dispose();

    road.handles.forEach(handle => {
      this.scene.remove(handle);
      handle.geometry.dispose();
      (handle.material as THREE.Material).dispose();
    });

    this.roads.delete(roadId);
  }

  /**
   * Show/hide road handles
   */
  public setHandlesVisible(visible: boolean): void {
    for (const road of this.roads.values()) {
      road.handles.forEach(handle => {
        handle.visible = visible;
      });
    }
  }

  /**
   * Dispose all resources
   */
  public dispose(): void {
    for (const roadId of Array.from(this.roads.keys())) {
      this.removeRoad(roadId);
    }

    for (const material of this.surfaceMaterials.values()) {
      material.dispose();
    }
    this.surfaceMaterials.clear();

    console.log('[RoadEditor] Disposed');
  }
}
