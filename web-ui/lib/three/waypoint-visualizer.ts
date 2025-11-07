/**
 * WaypointVisualizer - Visual waypoint path rendering with splines
 *
 * Renders smooth animated waypoint paths with control points, direction
 * arrows, and flow animations.
 *
 * @module lib/three/waypoint-visualizer
 */

import * as THREE from 'three';
import type { WaypointPath } from '@/lib/map-editor';

export interface WaypointStyle {
  lineColor: THREE.Color;
  lineWidth: number;
  nodeColor: THREE.Color;
  nodeSize: number;
  showArrows?: boolean;
  showFlow?: boolean;
  flowSpeed?: number;
}

/**
 * Waypoint visualizer
 */
export class WaypointVisualizer {
  private scene: THREE.Scene;
  private paths: Map<string, THREE.Group> = new Map();
  private style: WaypointStyle;
  private flowParticles: Map<string, THREE.Points> = new Map();
  private animationPhase = 0;

  constructor(scene: THREE.Scene, style?: Partial<WaypointStyle>) {
    this.scene = scene;

    this.style = {
      lineColor: style?.lineColor ?? new THREE.Color(0x00ff00),
      lineWidth: style?.lineWidth ?? 2,
      nodeColor: style?.nodeColor ?? new THREE.Color(0xffff00),
      nodeSize: style?.nodeSize ?? 2,
      showArrows: style?.showArrows ?? true,
      showFlow: style?.showFlow ?? true,
      flowSpeed: style?.flowSpeed ?? 1.0,
    };

    console.log('[WaypointVisualizer] Initialized');
  }

  /**
   * Add waypoint path
   */
  public addPath(path: WaypointPath): void {
    if (this.paths.has(path.id)) {
      this.removePath(path.id);
    }

    const group = new THREE.Group();
    group.name = `waypoint_path_${path.id}`;

    // Create spline from waypoints
    const points = path.waypoints.map(
      wp => new THREE.Vector3(wp.x, wp.z, wp.y) // WoW to Three.js coords
    );

    if (points.length < 2) return;

    // Create smooth curve
    const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.5);

    // Create path line
    const lineGeometry = new THREE.BufferGeometry().setFromPoints(
      curve.getPoints(path.waypoints.length * 10)
    );
    const lineMaterial = new THREE.LineBasicMaterial({
      color: this.style.lineColor,
      linewidth: this.style.lineWidth,
    });
    const line = new THREE.Line(lineGeometry, lineMaterial);
    group.add(line);

    // Create waypoint nodes
    const nodeGeometry = new THREE.SphereGeometry(this.style.nodeSize, 8, 8);
    const nodeMaterial = new THREE.MeshBasicMaterial({
      color: this.style.nodeColor,
    });

    for (const point of points) {
      const node = new THREE.Mesh(nodeGeometry, nodeMaterial);
      node.position.copy(point);
      group.add(node);
    }

    // Create direction arrows
    if (this.style.showArrows) {
      const arrowGroup = this.createDirectionArrows(curve, 10);
      group.add(arrowGroup);
    }

    // Create flow animation
    if (this.style.showFlow) {
      const flowPoints = this.createFlowParticles(curve, 20);
      this.flowParticles.set(path.id, flowPoints);
      group.add(flowPoints);
    }

    this.scene.add(group);
    this.paths.set(path.id, group);
  }

  /**
   * Update waypoint path
   */
  public updatePath(pathId: string, path: WaypointPath): void {
    this.removePath(pathId);
    this.addPath(path);
  }

  /**
   * Remove waypoint path
   */
  public removePath(pathId: string): void {
    const group = this.paths.get(pathId);
    if (!group) return;

    this.scene.remove(group);

    // Dispose geometries and materials
    group.traverse((child) => {
      if (child instanceof THREE.Mesh || child instanceof THREE.Line) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach(m => m.dispose());
        } else {
          child.material.dispose();
        }
      }
    });

    this.paths.delete(pathId);
    this.flowParticles.delete(pathId);
  }

  /**
   * Create direction arrows along path
   */
  private createDirectionArrows(curve: THREE.CatmullRomCurve3, count: number): THREE.Group {
    const group = new THREE.Group();

    const arrowGeometry = new THREE.ConeGeometry(1, 3, 8);
    const arrowMaterial = new THREE.MeshBasicMaterial({
      color: 0xff5555,
    });

    for (let i = 0; i < count; i++) {
      const t = (i + 0.5) / count;
      const point = curve.getPoint(t);
      const tangent = curve.getTangent(t);

      const arrow = new THREE.Mesh(arrowGeometry, arrowMaterial);
      arrow.position.copy(point);

      // Orient arrow along path
      const up = new THREE.Vector3(0, 1, 0);
      const quaternion = new THREE.Quaternion().setFromUnitVectors(up, tangent);
      arrow.setRotationFromQuaternion(quaternion);

      group.add(arrow);
    }

    return group;
  }

  /**
   * Create flow particles
   */
  private createFlowParticles(curve: THREE.CatmullRomCurve3, count: number): THREE.Points {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const t = i / count;
      const point = curve.getPoint(t);

      positions[i * 3] = point.x;
      positions[i * 3 + 1] = point.y;
      positions[i * 3 + 2] = point.z;

      // Color gradient
      colors[i * 3] = 0;
      colors[i * 3 + 1] = 1 - t;
      colors[i * 3 + 2] = t;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 3,
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
    });

    const points = new THREE.Points(geometry, material);
    points.userData.curve = curve;

    return points;
  }

  /**
   * Animate flow particles
   */
  public update(delta: number): void {
    this.animationPhase += delta * this.style.flowSpeed!;

    // Animate flow particles
    for (const [pathId, points] of this.flowParticles) {
      const curve = points.userData.curve as THREE.CatmullRomCurve3;
      const positions = points.geometry.attributes.position;

      for (let i = 0; i < positions.count; i++) {
        const t = ((i / positions.count) + this.animationPhase) % 1.0;
        const point = curve.getPoint(t);

        positions.setXYZ(i, point.x, point.y, point.z);
      }

      positions.needsUpdate = true;
    }
  }

  /**
   * Show/hide direction arrows
   */
  public setArrowsVisible(visible: boolean): void {
    this.style.showArrows = visible;

    for (const group of this.paths.values()) {
      group.children.forEach(child => {
        if (child instanceof THREE.Mesh && child.geometry instanceof THREE.ConeGeometry) {
          child.visible = visible;
        }
      });
    }
  }

  /**
   * Show/hide flow animation
   */
  public setFlowVisible(visible: boolean): void {
    this.style.showFlow = visible;

    for (const points of this.flowParticles.values()) {
      points.visible = visible;
    }
  }

  /**
   * Set path color
   */
  public setPathColor(pathId: string, color: THREE.Color): void {
    const group = this.paths.get(pathId);
    if (!group) return;

    group.children.forEach(child => {
      if (child instanceof THREE.Line) {
        (child.material as THREE.LineBasicMaterial).color = color;
      }
    });
  }

  /**
   * Dispose all resources
   */
  public dispose(): void {
    for (const pathId of Array.from(this.paths.keys())) {
      this.removePath(pathId);
    }

    console.log('[WaypointVisualizer] Disposed');
  }
}
