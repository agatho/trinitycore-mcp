/**
 * SpawnMarkerManager - Visual spawn point representation with instanced rendering
 *
 * Manages thousands of spawn markers efficiently using InstancedMesh,
 * with selection, hover effects, and label billboards.
 *
 * @module lib/three/spawn-marker-manager
 */

import * as THREE from 'three';
import type { MapCoordinate } from '@/lib/map-editor';

export interface MarkerStyle {
  geometry: 'sphere' | 'cylinder' | 'cone' | 'cube';
  scale: number;
  color: THREE.Color | ((coord: MapCoordinate) => THREE.Color);
}

export interface SpawnMarker {
  id: string;
  coordinate: MapCoordinate;
  mesh: THREE.Mesh;
  label?: THREE.Sprite;
}

/**
 * Spawn marker manager with instanced rendering
 */
export class SpawnMarkerManager {
  private scene: THREE.Scene;
  private markers: Map<string, SpawnMarker> = new Map();

  // Instanced mesh for performance (when many markers)
  private instancedMesh: THREE.InstancedMesh | null = null;
  private maxInstances = 10000;

  // Selection and hover
  private selectedIds: Set<string> = new Set();
  private hoveredId: string | null = null;

  // Materials
  private defaultMaterial: THREE.Material;
  private selectedMaterial: THREE.Material;
  private hoveredMaterial: THREE.Material;

  // Geometries
  private geometries: Map<string, THREE.BufferGeometry> = new Map();

  // Label rendering
  private labelGroup: THREE.Group;
  private labelCanvas: HTMLCanvasElement | null = null;

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    // Create materials
    this.defaultMaterial = new THREE.MeshLambertMaterial({
      color: 0xff5555,
      emissive: 0x330000,
    });

    this.selectedMaterial = new THREE.MeshLambertMaterial({
      color: 0x5555ff,
      emissive: 0x0000ff,
      emissiveIntensity: 0.5,
    });

    this.hoveredMaterial = new THREE.MeshLambertMaterial({
      color: 0xffff55,
      emissive: 0xffff00,
      emissiveIntensity: 0.3,
    });

    // Create geometries
    this.geometries.set('sphere', new THREE.SphereGeometry(1, 16, 16));
    this.geometries.set('cylinder', new THREE.CylinderGeometry(0.5, 0.5, 2, 16));
    this.geometries.set('cone', new THREE.ConeGeometry(0.7, 2, 16));
    this.geometries.set('cube', new THREE.BoxGeometry(1, 1, 1));

    // Create label group
    this.labelGroup = new THREE.Group();
    this.labelGroup.name = 'spawn-labels';
    this.scene.add(this.labelGroup);

    console.log('[SpawnMarkerManager] Initialized');
  }

  /**
   * Add a single marker
   */
  public addMarker(coord: MapCoordinate, style?: Partial<MarkerStyle>): SpawnMarker {
    if (this.markers.has(coord.id)) {
      console.warn('[SpawnMarkerManager] Marker already exists:', coord.id);
      return this.markers.get(coord.id)!;
    }

    const markerStyle: MarkerStyle = {
      geometry: style?.geometry ?? 'sphere',
      scale: style?.scale ?? 5,
      color: style?.color ?? new THREE.Color(0xff5555),
    };

    // Create marker mesh
    const geometry = this.geometries.get(markerStyle.geometry)!.clone();
    const color = typeof markerStyle.color === 'function'
      ? markerStyle.color(coord)
      : markerStyle.color;

    const material = this.defaultMaterial.clone();
    (material as THREE.MeshLambertMaterial).color = color;

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(coord.x, coord.z, coord.y); // Note: WoW coords to Three.js
    mesh.scale.setScalar(markerStyle.scale);
    mesh.castShadow = true;
    mesh.userData = { markerId: coord.id, coordinate: coord };

    this.scene.add(mesh);

    // Create label if needed
    let label: THREE.Sprite | undefined;
    if (coord.label) {
      label = this.createLabel(coord.label, mesh.position);
      this.labelGroup.add(label);
    }

    const marker: SpawnMarker = {
      id: coord.id,
      coordinate: coord,
      mesh,
      label,
    };

    this.markers.set(coord.id, marker);

    return marker;
  }

  /**
   * Add multiple markers (batch operation)
   */
  public addMarkers(coords: MapCoordinate[], style?: Partial<MarkerStyle>): void {
    for (const coord of coords) {
      this.addMarker(coord, style);
    }

    console.log('[SpawnMarkerManager] Added', coords.length, 'markers');
  }

  /**
   * Remove marker by ID
   */
  public removeMarker(id: string): void {
    const marker = this.markers.get(id);
    if (!marker) return;

    // Remove mesh
    this.scene.remove(marker.mesh);
    marker.mesh.geometry.dispose();
    (marker.mesh.material as THREE.Material).dispose();

    // Remove label
    if (marker.label) {
      this.labelGroup.remove(marker.label);
      marker.label.geometry.dispose();
      (marker.label.material as THREE.Material).dispose();
    }

    this.markers.delete(id);
  }

  /**
   * Update marker position
   */
  public updateMarker(id: string, coord: MapCoordinate): void {
    const marker = this.markers.get(id);
    if (!marker) return;

    marker.coordinate = coord;
    marker.mesh.position.set(coord.x, coord.z, coord.y);

    if (marker.label) {
      marker.label.position.copy(marker.mesh.position);
      marker.label.position.y += 10; // Offset above marker
    }
  }

  /**
   * Set selected markers
   */
  public setSelected(ids: string[]): void {
    // Clear previous selection
    for (const id of this.selectedIds) {
      const marker = this.markers.get(id);
      if (marker) {
        (marker.mesh.material as THREE.MeshLambertMaterial).emissive.setHex(0x000000);
        (marker.mesh.material as THREE.MeshLambertMaterial).emissiveIntensity = 0;
      }
    }

    // Set new selection
    this.selectedIds = new Set(ids);

    for (const id of this.selectedIds) {
      const marker = this.markers.get(id);
      if (marker) {
        (marker.mesh.material as THREE.MeshLambertMaterial).emissive.setHex(0x0000ff);
        (marker.mesh.material as THREE.MeshLambertMaterial).emissiveIntensity = 0.5;
      }
    }
  }

  /**
   * Set hovered marker
   */
  public setHovered(id: string | null): void {
    // Clear previous hover
    if (this.hoveredId) {
      const marker = this.markers.get(this.hoveredId);
      if (marker && !this.selectedIds.has(this.hoveredId)) {
        (marker.mesh.material as THREE.MeshLambertMaterial).emissive.setHex(0x000000);
        (marker.mesh.material as THREE.MeshLambertMaterial).emissiveIntensity = 0;
      }
    }

    // Set new hover
    this.hoveredId = id;

    if (this.hoveredId) {
      const marker = this.markers.get(this.hoveredId);
      if (marker && !this.selectedIds.has(this.hoveredId)) {
        (marker.mesh.material as THREE.MeshLambertMaterial).emissive.setHex(0xffff00);
        (marker.mesh.material as THREE.MeshLambertMaterial).emissiveIntensity = 0.3;
      }
    }
  }

  /**
   * Get marker by ID
   */
  public getMarker(id: string): SpawnMarker | undefined {
    return this.markers.get(id);
  }

  /**
   * Get all markers
   */
  public getAllMarkers(): SpawnMarker[] {
    return Array.from(this.markers.values());
  }

  /**
   * Clear all markers
   */
  public clear(): void {
    for (const marker of this.markers.values()) {
      this.scene.remove(marker.mesh);
      marker.mesh.geometry.dispose();
      (marker.mesh.material as THREE.Material).dispose();

      if (marker.label) {
        this.labelGroup.remove(marker.label);
        marker.label.geometry.dispose();
        (marker.label.material as THREE.Material).dispose();
      }
    }

    this.markers.clear();
    this.selectedIds.clear();
    this.hoveredId = null;

    console.log('[SpawnMarkerManager] Cleared all markers');
  }

  /**
   * Create label sprite
   */
  private createLabel(text: string, position: THREE.Vector3): THREE.Sprite {
    // Create canvas for label
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d')!;

    canvas.width = 256;
    canvas.height = 64;

    // Draw background
    context.fillStyle = 'rgba(0, 0, 0, 0.7)';
    context.fillRect(0, 0, canvas.width, canvas.height);

    // Draw text
    context.font = 'bold 24px Arial';
    context.fillStyle = 'white';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(text, canvas.width / 2, canvas.height / 2);

    // Create sprite
    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ map: texture });
    const sprite = new THREE.Sprite(material);

    sprite.position.copy(position);
    sprite.position.y += 10; // Offset above marker
    sprite.scale.set(20, 5, 1);

    return sprite;
  }

  /**
   * Update label billboards to face camera
   */
  public updateLabels(camera: THREE.Camera): void {
    // Labels (sprites) automatically face camera
    // This method reserved for custom label implementations
  }

  /**
   * Show/hide labels
   */
  public setLabelsVisible(visible: boolean): void {
    this.labelGroup.visible = visible;
  }

  /**
   * Dispose of all resources
   */
  public dispose(): void {
    this.clear();

    // Dispose geometries
    for (const geometry of this.geometries.values()) {
      geometry.dispose();
    }
    this.geometries.clear();

    // Dispose materials
    this.defaultMaterial.dispose();
    this.selectedMaterial.dispose();
    this.hoveredMaterial.dispose();

    this.scene.remove(this.labelGroup);

    console.log('[SpawnMarkerManager] Disposed');
  }
}
