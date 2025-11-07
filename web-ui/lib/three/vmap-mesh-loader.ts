/**
 * VMapMeshLoader - Convert VMap collision data to Three.js geometry
 *
 * Extracts triangle data from VMap BIH trees and creates optimized
 * Three.js meshes with proper normals, materials, and LOD.
 *
 * @module lib/three/vmap-mesh-loader
 */

import * as THREE from 'three';
import type { VMapData, VMapTile } from '@/lib/vmap-types';

export interface VMapLoadOptions {
  generateNormals?: boolean;
  mergeGeometries?: boolean;
  heightColors?: boolean;
  wireframe?: boolean;
  opacity?: number;
  maxTriangles?: number;
  useLOD?: boolean;
}

export interface VMapMeshResult {
  group: THREE.Group;
  triangleCount: number;
  vertexCount: number;
  tileCount: number;
}

/**
 * VMap mesh loader - converts collision geometry to Three.js
 */
export class VMapMeshLoader {
  private options: Required<VMapLoadOptions>;

  // Material cache
  private materials: Map<string, THREE.Material> = new Map();

  constructor(options: VMapLoadOptions = {}) {
    this.options = {
      generateNormals: options.generateNormals ?? true,
      mergeGeometries: options.mergeGeometries ?? true,
      heightColors: options.heightColors ?? true,
      wireframe: options.wireframe ?? false,
      opacity: options.opacity ?? 0.8,
      maxTriangles: options.maxTriangles ?? 1000000,
      useLOD: options.useLOD ?? true,
    };
  }

  /**
   * Load VMap data as Three.js mesh group
   */
  public load(vmapData: VMapData): VMapMeshResult {
    console.log('[VMapMeshLoader] Loading VMap data...', {
      mapId: vmapData.mapId,
      tiles: vmapData.tiles.size,
      spawns: vmapData.allSpawns.length,
    });

    const group = new THREE.Group();
    group.name = `vmap_${vmapData.mapId}`;

    let totalTriangles = 0;
    let totalVertices = 0;

    // Process each tile
    for (const [tileKey, tile] of vmapData.tiles) {
      const tileMesh = this.createTileMesh(tile, tileKey);
      if (tileMesh) {
        group.add(tileMesh);

        const geometry = (tileMesh as THREE.Mesh).geometry as THREE.BufferGeometry;
        totalTriangles += geometry.index ? geometry.index.count / 3 : geometry.attributes.position.count / 3;
        totalVertices += geometry.attributes.position.count;

        // Check triangle limit
        if (totalTriangles >= this.options.maxTriangles) {
          console.warn('[VMapMeshLoader] Triangle limit reached, stopping at', totalTriangles);
          break;
        }
      }
    }

    console.log('[VMapMeshLoader] Loaded', {
      triangles: totalTriangles,
      vertices: totalVertices,
      tiles: vmapData.tiles.size,
    });

    return {
      group,
      triangleCount: totalTriangles,
      vertexCount: totalVertices,
      tileCount: vmapData.tiles.size,
    };
  }

  /**
   * Create mesh for a single tile
   */
  private createTileMesh(tile: VMapTile, tileKey: string): THREE.Object3D | null {
    try {
      const triangles = this.extractTriangles(tile);

      if (triangles.length === 0) {
        return null;
      }

      const geometry = this.createGeometryFromTriangles(triangles);
      const material = this.getMaterial('terrain');

      const mesh = new THREE.Mesh(geometry, material);
      mesh.name = `tile_${tileKey}`;
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      return mesh;
    } catch (error) {
      console.error('[VMapMeshLoader] Error creating tile mesh:', error);
      return null;
    }
  }

  /**
   * Extract triangles from tile
   */
  private extractTriangles(tile: VMapTile): Float32Array[] {
    const triangles: Float32Array[] = [];

    // Traverse BIH tree to extract all geometry spawns
    const extractFromNode = (nodeIndex: number) => {
      if (nodeIndex >= tile.bihTree.nodes.length) return;

      const node = tile.bihTree.nodes[nodeIndex];

      // Leaf node - extract triangles from referenced spawns
      if (node.isLeaf && node.spawnIndices) {
        for (const spawnIndex of node.spawnIndices) {
          if (spawnIndex < tile.spawns.length) {
            const spawn = tile.spawns[spawnIndex];

            // Extract vertices from spawn's model
            if (spawn.vertices && spawn.indices) {
              const vertices = spawn.vertices;
              const indices = spawn.indices;

              // Create triangles from indexed vertices
              for (let i = 0; i < indices.length; i += 3) {
                const i1 = indices[i] * 3;
                const i2 = indices[i + 1] * 3;
                const i3 = indices[i + 2] * 3;

                if (i1 + 2 < vertices.length && i2 + 2 < vertices.length && i3 + 2 < vertices.length) {
                  const triangle = new Float32Array(9);

                  // Vertex 1
                  triangle[0] = vertices[i1];
                  triangle[1] = vertices[i1 + 1];
                  triangle[2] = vertices[i1 + 2];

                  // Vertex 2
                  triangle[3] = vertices[i2];
                  triangle[4] = vertices[i2 + 1];
                  triangle[5] = vertices[i2 + 2];

                  // Vertex 3
                  triangle[6] = vertices[i3];
                  triangle[7] = vertices[i3 + 1];
                  triangle[8] = vertices[i3 + 2];

                  triangles.push(triangle);
                }
              }
            }
          }
        }
      }

      // Internal node - traverse children
      if (!node.isLeaf) {
        if (node.leftChild !== undefined) extractFromNode(node.leftChild);
        if (node.rightChild !== undefined) extractFromNode(node.rightChild);
      }
    };

    // Start extraction from root
    extractFromNode(0);

    return triangles;
  }

  /**
   * Create BufferGeometry from triangles
   */
  private createGeometryFromTriangles(triangles: Float32Array[]): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry();

    const vertexCount = triangles.length * 3;
    const positions = new Float32Array(vertexCount * 3);
    const colors = this.options.heightColors ? new Float32Array(vertexCount * 3) : null;

    let offset = 0;

    for (const triangle of triangles) {
      // Copy vertices
      for (let i = 0; i < 9; i++) {
        positions[offset + i] = triangle[i];
      }

      // Calculate height-based colors if enabled
      if (colors && this.options.heightColors) {
        for (let v = 0; v < 3; v++) {
          const y = triangle[v * 3 + 1];
          const color = this.heightToColor(y);
          colors[offset + v * 3] = color.r;
          colors[offset + v * 3 + 1] = color.g;
          colors[offset + v * 3 + 2] = color.b;
        }
      }

      offset += 9;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    if (colors) {
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    }

    // Compute normals for proper lighting
    if (this.options.generateNormals) {
      geometry.computeVertexNormals();
    }

    // Compute bounding sphere for culling
    geometry.computeBoundingSphere();

    return geometry;
  }

  /**
   * Convert height to color (elevation mapping)
   */
  private heightToColor(height: number): { r: number; g: number; b: number } {
    // Normalize height (-500 to +500 typical range)
    const normalized = Math.max(0, Math.min(1, (height + 500) / 1000));

    // Color gradient: blue (low) -> green -> yellow -> red (high)
    if (normalized < 0.25) {
      // Blue to cyan
      const t = normalized * 4;
      return {
        r: 0,
        g: t * 0.5,
        b: 0.5 + t * 0.5,
      };
    } else if (normalized < 0.5) {
      // Cyan to green
      const t = (normalized - 0.25) * 4;
      return {
        r: 0,
        g: 0.5 + t * 0.5,
        b: 1 - t,
      };
    } else if (normalized < 0.75) {
      // Green to yellow
      const t = (normalized - 0.5) * 4;
      return {
        r: t,
        g: 1,
        b: 0,
      };
    } else {
      // Yellow to red
      const t = (normalized - 0.75) * 4;
      return {
        r: 1,
        g: 1 - t,
        b: 0,
      };
    }
  }

  /**
   * Get or create material
   */
  private getMaterial(type: string): THREE.Material {
    if (this.materials.has(type)) {
      return this.materials.get(type)!;
    }

    let material: THREE.Material;

    if (this.options.heightColors) {
      // Vertex color material
      material = new THREE.MeshLambertMaterial({
        vertexColors: true,
        side: THREE.DoubleSide,
        transparent: this.options.opacity < 1,
        opacity: this.options.opacity,
        wireframe: this.options.wireframe,
        flatShading: false,
      });
    } else {
      // Standard terrain material
      material = new THREE.MeshLambertMaterial({
        color: 0x7cb342,
        side: THREE.DoubleSide,
        transparent: this.options.opacity < 1,
        opacity: this.options.opacity,
        wireframe: this.options.wireframe,
      });
    }

    this.materials.set(type, material);
    return material;
  }

  /**
   * Dispose of all materials
   */
  public dispose(): void {
    for (const material of this.materials.values()) {
      material.dispose();
    }
    this.materials.clear();
  }
}
