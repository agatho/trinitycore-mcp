/**
 * MMapMeshLoader - Convert MMap navigation mesh to Three.js geometry
 *
 * Extracts polygon data from Recast/Detour navigation meshes and creates
 * wireframe visualization with walkability color coding.
 *
 * @module lib/three/mmap-mesh-loader
 */

import * as THREE from 'three';
import type { MMapData, NavMeshTile } from '@/lib/mmap-types';

type MMapTile = NavMeshTile;

export interface MMapLoadOptions {
  wireframe?: boolean;
  opacity?: number;
  heightOffset?: number;
  colorByWalkability?: boolean;
  maxPolygons?: number;
}

export interface MMapMeshResult {
  group: THREE.Group;
  polygonCount: number;
  vertexCount: number;
  tileCount: number;
}

/**
 * MMap mesh loader - converts navigation mesh to Three.js
 */
export class MMapMeshLoader {
  private options: Required<MMapLoadOptions>;

  // Material cache
  private materials: Map<string, THREE.Material> = new Map();

  constructor(options: MMapLoadOptions = {}) {
    this.options = {
      wireframe: options.wireframe ?? true,
      opacity: options.opacity ?? 0.6,
      heightOffset: options.heightOffset ?? 0.5,
      colorByWalkability: options.colorByWalkability ?? true,
      maxPolygons: options.maxPolygons ?? 500000,
    };
  }

  /**
   * Load MMap data as Three.js mesh group
   */
  public load(mmapData: MMapData): MMapMeshResult {
    console.log('[MMapMeshLoader] Loading MMap data...', {
      mapId: mmapData.mapId,
      tiles: mmapData.tiles.size,
    });

    const group = new THREE.Group();
    group.name = `mmap_${mmapData.mapId}`;

    let totalPolygons = 0;
    let totalVertices = 0;

    // Process each tile
    for (const [tileKey, tile] of mmapData.tiles) {
      const tileMesh = this.createTileMesh(tile, tileKey);
      if (tileMesh) {
        group.add(tileMesh);

        const geometry = (tileMesh as THREE.Mesh).geometry as THREE.BufferGeometry;
        totalPolygons += geometry.index ? geometry.index.count / 3 : geometry.attributes.position.count / 3;
        totalVertices += geometry.attributes.position.count;

        // Check polygon limit
        if (totalPolygons >= this.options.maxPolygons) {
          console.warn('[MMapMeshLoader] Polygon limit reached, stopping at', totalPolygons);
          break;
        }
      }
    }

    console.log('[MMapMeshLoader] Loaded', {
      polygons: totalPolygons,
      vertices: totalVertices,
      tiles: mmapData.tiles.size,
    });

    return {
      group,
      polygonCount: totalPolygons,
      vertexCount: totalVertices,
      tileCount: mmapData.tiles.size,
    };
  }

  /**
   * Create mesh for a single tile
   */
  private createTileMesh(tile: MMapTile, tileKey: string): THREE.Object3D | null {
    try {
      const polygons = this.extractPolygons(tile);

      if (polygons.length === 0) {
        return null;
      }

      const geometry = this.createGeometryFromPolygons(polygons);
      const material = this.getMaterial('navmesh');

      const mesh = new THREE.Mesh(geometry, material);
      mesh.name = `mmtile_${tileKey}`;
      mesh.position.y = this.options.heightOffset; // Slightly above ground
      mesh.renderOrder = 1; // Render after terrain

      return mesh;
    } catch (error) {
      console.error('[MMapMeshLoader] Error creating tile mesh:', error);
      return null;
    }
  }

  /**
   * Extract polygons from tile
   */
  private extractPolygons(tile: MMapTile): Array<{
    vertices: Float32Array;
    walkable: boolean;
  }> {
    const polygons: Array<{ vertices: Float32Array; walkable: boolean }> = [];

    // Extract from detailVerts/detailTris if available
    if (tile.detailVerts && tile.detailVerts.length > 0 && tile.detailTris && tile.detailTris.length > 0) {
      const verts = tile.detailVerts;
      const tris = tile.detailTris;

      // Each detail triangle uses 4 values (3 indices + flags)
      for (let i = 0; i < tris.length; i += 4) {
        const i1 = tris[i];
        const i2 = tris[i + 1];
        const i3 = tris[i + 2];

        if (i1 < verts.length && i2 < verts.length && i3 < verts.length) {
          const vertices = new Float32Array(9);
          const v1 = verts[i1];
          const v2 = verts[i2];
          const v3 = verts[i3];

          // Vertex 1
          vertices[0] = v1[0];
          vertices[1] = v1[1];
          vertices[2] = v1[2];

          // Vertex 2
          vertices[3] = v2[0];
          vertices[4] = v2[1];
          vertices[5] = v2[2];

          // Vertex 3
          vertices[6] = v3[0];
          vertices[7] = v3[1];
          vertices[8] = v3[2];

          polygons.push({
            vertices,
            walkable: true, // Assume walkable if in navmesh
          });
        }
      }
    }

    // Fallback to tile verts/polys if no detailVerts
    else if (tile.verts && tile.verts.length > 0 && tile.polys && tile.polys.length > 0) {
      const verts = tile.verts;
      const polys = tile.polys;

      // Each poly can have multiple vertices (typically 3-6)
      for (const poly of polys) {
        if (poly.verts && poly.vertCount >= 3) {
          // Triangulate polygon (simple fan triangulation)
          const validVerts = poly.verts.slice(0, poly.vertCount);
          for (let i = 1; i < validVerts.length - 1; i++) {
            const i1 = validVerts[0];
            const i2 = validVerts[i];
            const i3 = validVerts[i + 1];

            if (i1 < verts.length && i2 < verts.length && i3 < verts.length) {
              const vertices = new Float32Array(9);
              const v1 = verts[i1];
              const v2 = verts[i2];
              const v3 = verts[i3];

              vertices[0] = v1[0];
              vertices[1] = v1[1];
              vertices[2] = v1[2];

              vertices[3] = v2[0];
              vertices[4] = v2[1];
              vertices[5] = v2[2];

              vertices[6] = v3[0];
              vertices[7] = v3[1];
              vertices[8] = v3[2];

              polygons.push({
                vertices,
                walkable: (poly.areaAndtype & 0x3f) !== 0, // Lower 6 bits = area type
              });
            }
          }
        }
      }
    }

    return polygons;
  }

  /**
   * Create BufferGeometry from polygons
   */
  private createGeometryFromPolygons(
    polygons: Array<{ vertices: Float32Array; walkable: boolean }>
  ): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry();

    const vertexCount = polygons.length * 3;
    const positions = new Float32Array(vertexCount * 3);
    const colors = this.options.colorByWalkability ? new Float32Array(vertexCount * 3) : null;

    let offset = 0;

    for (const polygon of polygons) {
      // Copy vertices
      for (let i = 0; i < 9; i++) {
        positions[offset + i] = polygon.vertices[i];
      }

      // Color by walkability
      if (colors && this.options.colorByWalkability) {
        const color = polygon.walkable
          ? { r: 0.2, g: 0.8, b: 0.2 } // Green = walkable
          : { r: 0.8, g: 0.2, b: 0.2 }; // Red = unwalkable

        for (let v = 0; v < 3; v++) {
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
    geometry.computeVertexNormals();

    // Compute bounding sphere for culling
    geometry.computeBoundingSphere();

    return geometry;
  }

  /**
   * Get or create material
   */
  private getMaterial(type: string): THREE.Material {
    if (this.materials.has(type)) {
      return this.materials.get(type)!;
    }

    let material: THREE.Material;

    if (this.options.colorByWalkability) {
      // Vertex color material
      material = new THREE.MeshBasicMaterial({
        vertexColors: true,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: this.options.opacity,
        wireframe: this.options.wireframe,
        depthWrite: false, // Don't write to depth buffer (overlay effect)
      });
    } else {
      // Standard navmesh material
      material = new THREE.MeshBasicMaterial({
        color: 0x00ff00,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: this.options.opacity,
        wireframe: this.options.wireframe,
        depthWrite: false,
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
