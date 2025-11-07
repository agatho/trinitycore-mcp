/**
 * Terrain Mesh Loader - Generate 3D terrain from TrinityCore .map files
 *
 * Creates textured terrain meshes from height map data with LOD support.
 */

import * as THREE from 'three';
import type { MapDataCollection } from '../map-parser';

export interface TerrainMeshOptions {
  /** Use texture mapping from map image */
  textureEnabled?: boolean;

  /** Texture to apply to terrain */
  texture?: THREE.Texture;

  /** Height-based coloring if no texture */
  heightColors?: boolean;

  /** Wireframe mode */
  wireframe?: boolean;

  /** Mesh opacity */
  opacity?: number;

  /** Height scale multiplier */
  heightScale?: number;

  /** Show tile boundaries */
  showTileBoundaries?: boolean;
}

export interface TerrainMeshResult {
  group: THREE.Group;
  tiles: Map<string, THREE.Mesh>;
  bounds: THREE.Box3;
}

/**
 * Terrain Mesh Loader
 */
export class TerrainMeshLoader {
  private options: Required<TerrainMeshOptions>;

  constructor(options: TerrainMeshOptions = {}) {
    this.options = {
      textureEnabled: options.textureEnabled ?? true,
      texture: options.texture ?? null!,
      heightColors: options.heightColors ?? true,
      wireframe: options.wireframe ?? false,
      opacity: options.opacity ?? 1.0,
      heightScale: options.heightScale ?? 1.0,
      showTileBoundaries: options.showTileBoundaries ?? false,
    };
  }

  /**
   * Load terrain mesh from map data
   */
  public load(mapData: MapDataCollection): TerrainMeshResult {
    const group = new THREE.Group();
    group.name = `terrain-${mapData.mapId}`;

    const tiles = new Map<string, THREE.Mesh>();
    const bounds = new THREE.Box3();

    // Process each tile
    for (const [tileKey, tileData] of mapData.tiles) {
      if (!tileData.heightMap) continue;

      const mesh = this.createTileMesh(tileData);
      if (mesh) {
        tiles.set(tileKey, mesh);
        group.add(mesh);

        // Update bounds
        const tileBounds = new THREE.Box3().setFromObject(mesh);
        bounds.union(tileBounds);
      }
    }

    console.log(`[TerrainMeshLoader] Loaded ${tiles.size} terrain tiles`);

    return {
      group,
      tiles,
      bounds,
    };
  }

  /**
   * Create mesh for a single tile
   */
  private createTileMesh(tileData: any): THREE.Mesh | null {
    const { gridX, gridY, heightMap } = tileData;
    if (!heightMap || !heightMap.heights) return null;

    // TrinityCore uses 129x129 height grid per tile
    const gridSize = 129;
    const tileSize = 533.33333; // WoW tile size in yards

    // Create geometry
    const geometry = new THREE.PlaneGeometry(
      tileSize,
      tileSize,
      gridSize - 1,
      gridSize - 1
    );

    // Apply height data to vertices
    const vertices = geometry.attributes.position;
    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        const idx = y * gridSize + x;
        const heightIdx = idx;

        if (heightIdx < heightMap.heights.length) {
          const height = heightMap.heights[heightIdx] * this.options.heightScale;
          vertices.setZ(idx, height);
        }
      }
    }

    // Recalculate normals for proper lighting
    geometry.computeVertexNormals();

    // Create material
    const material = this.createTerrainMaterial(heightMap);

    // Create mesh
    const mesh = new THREE.Mesh(geometry, material);

    // Position mesh based on grid coordinates
    // WoW coordinates: X increases east, Y increases north
    const centerX = (32 - gridX) * tileSize - tileSize / 2;
    const centerY = (32 - gridY) * tileSize - tileSize / 2;

    mesh.position.set(centerX, 0, centerY);
    mesh.rotation.x = -Math.PI / 2; // Rotate to horizontal
    mesh.receiveShadow = true;
    mesh.castShadow = false; // Terrain doesn't cast shadows (performance)

    mesh.userData.gridX = gridX;
    mesh.userData.gridY = gridY;
    mesh.userData.isTerrain = true;

    // Add tile boundary visualization (optional)
    if (this.options.showTileBoundaries) {
      const boundaryBox = new THREE.Box3Helper(
        new THREE.Box3().setFromObject(mesh),
        0x00ff00
      );
      mesh.add(boundaryBox);
    }

    return mesh;
  }

  /**
   * Create terrain material
   */
  private createTerrainMaterial(heightMap: any): THREE.Material {
    // Texture mode
    if (this.options.texture && this.options.textureEnabled) {
      return new THREE.MeshStandardMaterial({
        map: this.options.texture,
        wireframe: this.options.wireframe,
        opacity: this.options.opacity,
        transparent: this.options.opacity < 1.0,
        side: THREE.DoubleSide,
      });
    }

    // Height-based coloring mode
    if (this.options.heightColors) {
      return new THREE.MeshStandardMaterial({
        color: 0x8b7355, // Brown base
        wireframe: this.options.wireframe,
        opacity: this.options.opacity,
        transparent: this.options.opacity < 1.0,
        side: THREE.DoubleSide,
        vertexColors: false,
      });
    }

    // Simple mode
    return new THREE.MeshStandardMaterial({
      color: 0x7cb342, // Green
      wireframe: this.options.wireframe,
      opacity: this.options.opacity,
      transparent: this.options.opacity < 1.0,
      side: THREE.DoubleSide,
    });
  }

  /**
   * Apply height-based vertex colors
   */
  private applyHeightColors(geometry: THREE.BufferGeometry, heightMap: any): void {
    const colors: number[] = [];
    const vertices = geometry.attributes.position;

    // Find min/max heights for normalization
    let minHeight = Infinity;
    let maxHeight = -Infinity;
    for (let i = 0; i < vertices.count; i++) {
      const z = vertices.getZ(i);
      minHeight = Math.min(minHeight, z);
      maxHeight = Math.max(maxHeight, z);
    }

    const range = maxHeight - minHeight;

    // Apply colors based on height
    for (let i = 0; i < vertices.count; i++) {
      const z = vertices.getZ(i);
      const normalizedHeight = range > 0 ? (z - minHeight) / range : 0.5;

      // Color gradient: blue (water) -> green (low) -> brown (mid) -> white (high)
      let color: THREE.Color;
      if (normalizedHeight < 0.2) {
        // Water/low - blue to green
        color = new THREE.Color().lerpColors(
          new THREE.Color(0x4a90e2),
          new THREE.Color(0x7cb342),
          normalizedHeight * 5
        );
      } else if (normalizedHeight < 0.6) {
        // Low to mid - green to brown
        color = new THREE.Color().lerpColors(
          new THREE.Color(0x7cb342),
          new THREE.Color(0x8b7355),
          (normalizedHeight - 0.2) * 2.5
        );
      } else if (normalizedHeight < 0.85) {
        // Mid to high - brown to gray
        color = new THREE.Color().lerpColors(
          new THREE.Color(0x8b7355),
          new THREE.Color(0x808080),
          (normalizedHeight - 0.6) * 4
        );
      } else {
        // High - gray to white (snow)
        color = new THREE.Color().lerpColors(
          new THREE.Color(0x808080),
          new THREE.Color(0xffffff),
          (normalizedHeight - 0.85) * 6.67
        );
      }

      colors.push(color.r, color.g, color.b);
    }

    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  }

  /**
   * Set texture
   */
  public setTexture(texture: THREE.Texture | null): void {
    this.options.texture = texture!;
    this.options.textureEnabled = texture !== null;
  }

  /**
   * Update options
   */
  public setOptions(options: Partial<TerrainMeshOptions>): void {
    Object.assign(this.options, options);
  }

  /**
   * Dispose of resources
   */
  public dispose(): void {
    // Cleanup if needed
  }
}
