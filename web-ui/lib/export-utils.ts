/**
 * Export Utilities
 *
 * Export functionality for 3D viewer content.
 * Supports glTF, screenshots, and data exports.
 *
 * @module export-utils
 */

import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import type { VMapData } from "./vmap-types";
import type { MMapData } from "./mmap-types";
import type { PathResult } from "./pathfinding-utils";
import type { SpawnValidationResult } from "./spawn-validation";

// ============================================================================
// Types
// ============================================================================

/**
 * Export format
 */
export enum ExportFormat {
  GLTF = "gltf",
  GLB = "glb",
  PNG = "png",
  JPEG = "jpeg",
  JSON = "json",
  CSV = "csv",
  SQL = "sql",
}

/**
 * Export options
 */
export interface ExportOptions {
  /** Export format */
  format: ExportFormat;

  /** Filename (without extension) */
  filename?: string;

  /** Include specific layers */
  layers?: string[];

  /** JPEG quality (0-1) */
  quality?: number;

  /** Image width (for screenshots) */
  width?: number;

  /** Image height (for screenshots) */
  height?: number;
}

// ============================================================================
// 3D Model Export (glTF/GLB)
// ============================================================================

/**
 * Export scene as glTF/GLB
 *
 * @param scene Three.js scene to export
 * @param options Export options
 * @returns Promise that resolves when export is complete
 */
export async function exportSceneAsGLTF(
  scene: THREE.Scene,
  options: ExportOptions = { format: ExportFormat.GLTF },
): Promise<void> {
  const exporter = new GLTFExporter();

  // Configure export options
  const exportOptions = {
    binary: options.format === ExportFormat.GLB,
    maxTextureSize: 4096,
    includeCustomExtensions: false,
  };

  return new Promise((resolve, reject) => {
    exporter.parse(
      scene,
      (result: unknown) => {
        let blob: Blob;
        let extension: string;

        if (options.format === ExportFormat.GLB) {
          // Binary GLB
          blob = new Blob([result as ArrayBuffer], { type: "model/gltf-binary" });
          extension = "glb";
        } else {
          // JSON glTF
          const json = JSON.stringify(result, null, 2);
          blob = new Blob([json], { type: "application/json" });
          extension = "gltf";
        }

        // Trigger download
        const filename = options.filename || "scene";
        downloadBlob(blob, `${filename}.${extension}`);

        resolve();
      },
      (error: unknown) => {
        console.error("glTF export failed:", error);
        reject(error);
      },
      exportOptions,
    );
  });
}

/**
 * Export selected mesh as glTF
 *
 * @param mesh Three.js mesh to export
 * @param options Export options
 */
export async function exportMeshAsGLTF(
  mesh: THREE.Mesh | THREE.Group,
  options: ExportOptions = { format: ExportFormat.GLTF },
): Promise<void> {
  const exporter = new GLTFExporter();

  const exportOptions = {
    binary: options.format === ExportFormat.GLB,
  };

  return new Promise((resolve, reject) => {
    exporter.parse(
      mesh,
      (result: unknown) => {
        let blob: Blob;
        let extension: string;

        if (options.format === ExportFormat.GLB) {
          blob = new Blob([result as ArrayBuffer], { type: "model/gltf-binary" });
          extension = "glb";
        } else {
          const json = JSON.stringify(result, null, 2);
          blob = new Blob([json], { type: "application/json" });
          extension = "gltf";
        }

        const filename = options.filename || "mesh";
        downloadBlob(blob, `${filename}.${extension}`);

        resolve();
      },
      (error: unknown) => {
        console.error("glTF export failed:", error);
        reject(error);
      },
      exportOptions,
    );
  });
}

// ============================================================================
// Screenshot Export
// ============================================================================

/**
 * Export canvas as screenshot
 *
 * @param renderer Three.js renderer
 * @param options Export options
 */
export function exportScreenshot(
  renderer: THREE.WebGLRenderer,
  options: ExportOptions = { format: ExportFormat.PNG },
): void {
  // Render the scene
  renderer.render(renderer.info.render.frame as unknown as THREE.Scene, renderer.info.render.frame as unknown as THREE.Camera);

  // Get canvas data
  const canvas = renderer.domElement;
  const dataURL = canvas.toDataURL(
    options.format === ExportFormat.PNG ? "image/png" : "image/jpeg",
    options.quality || 0.95,
  );

  // Convert to blob and download
  fetch(dataURL)
    .then((res) => res.blob())
    .then((blob) => {
      const extension = options.format === ExportFormat.PNG ? "png" : "jpg";
      const filename = options.filename || "screenshot";
      downloadBlob(blob, `${filename}.${extension}`);
    });
}

/**
 * Export canvas with custom size
 *
 * @param scene Scene to render
 * @param camera Camera to use
 * @param width Desired width
 * @param height Desired height
 * @param options Export options
 */
export function exportScreenshotCustomSize(
  scene: THREE.Scene,
  camera: THREE.Camera,
  width: number,
  height: number,
  options: ExportOptions = { format: ExportFormat.PNG },
): void {
  // Create offscreen renderer
  const offscreenRenderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  offscreenRenderer.setSize(width, height);
  offscreenRenderer.render(scene, camera);

  // Get data URL
  const canvas = offscreenRenderer.domElement;
  const dataURL = canvas.toDataURL(
    options.format === ExportFormat.PNG ? "image/png" : "image/jpeg",
    options.quality || 0.95,
  );

  // Download
  fetch(dataURL)
    .then((res) => res.blob())
    .then((blob) => {
      const extension = options.format === ExportFormat.PNG ? "png" : "jpg";
      const filename = options.filename || "screenshot";
      downloadBlob(blob, `${filename}.${extension}`);
    })
    .finally(() => {
      offscreenRenderer.dispose();
    });
}

// ============================================================================
// Data Export (JSON, CSV, SQL)
// ============================================================================

/**
 * Export VMap data as JSON
 *
 * @param vmapData VMap data
 * @param filename Filename
 */
export function exportVMapJSON(vmapData: VMapData, filename: string = "vmap_data"): void {
  const json = JSON.stringify(vmapData, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  downloadBlob(blob, `${filename}.json`);
}

/**
 * Export MMap data as JSON
 *
 * @param mmapData MMap data
 * @param filename Filename
 */
export function exportMMapJSON(mmapData: MMapData, filename: string = "mmap_data"): void {
  const json = JSON.stringify(mmapData, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  downloadBlob(blob, `${filename}.json`);
}

/**
 * Export path as JSON
 *
 * @param pathResult Pathfinding result
 * @param filename Filename
 */
export function exportPathJSON(pathResult: PathResult, filename: string = "path"): void {
  const json = JSON.stringify(pathResult, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  downloadBlob(blob, `${filename}.json`);
}

/**
 * Export path as waypoints SQL
 *
 * @param path Path waypoints
 * @param creatureGuid Creature GUID
 * @param filename Filename
 */
export function exportPathSQL(
  path: [number, number, number][],
  creatureGuid: number,
  filename: string = "waypoints",
): void {
  const lines: string[] = [];

  lines.push("-- Waypoint Path");
  lines.push(`-- Creature GUID: ${creatureGuid}`);
  lines.push(`-- Generated: ${new Date().toISOString()}`);
  lines.push("");

  // Delete existing waypoints
  lines.push(`DELETE FROM creature_addon WHERE guid = ${creatureGuid};`);
  lines.push(`DELETE FROM waypoint_data WHERE id = ${creatureGuid};`);
  lines.push("");

  // Insert waypoints
  for (let i = 0; i < path.length; i++) {
    const [x, y, z] = path[i];
    lines.push(
      `INSERT INTO waypoint_data (id, point, position_x, position_y, position_z) VALUES (${creatureGuid}, ${i + 1}, ${x.toFixed(6)}, ${y.toFixed(6)}, ${z.toFixed(6)});`,
    );
  }

  lines.push("");
  lines.push(`-- Update creature to use waypoints`);
  lines.push(
    `INSERT INTO creature_addon (guid, path_id, mount, bytes1, bytes2, emote, auras) VALUES (${creatureGuid}, ${creatureGuid}, 0, 0, 0, 0, '');`,
  );

  const sql = lines.join("\n");
  const blob = new Blob([sql], { type: "text/plain" });
  downloadBlob(blob, `${filename}.sql`);
}

/**
 * Export spawn validation results as CSV
 *
 * @param results Validation results
 * @param filename Filename
 */
export function exportValidationCSV(
  results: SpawnValidationResult[],
  filename: string = "spawn_validation",
): void {
  const lines: string[] = [];

  // Header
  lines.push("GUID,Name,Map,X,Y,Z,Valid,Issues,Max Severity,Suggested X,Suggested Y,Suggested Z,Distance");

  // Rows
  for (const result of results) {
    const spawn = result.spawn;
    const pos = spawn.position;
    const maxSeverity = Math.max(...result.issues.map((i) => i.severity), 0);
    const issueTypes = result.issues.map((i) => i.type).join(";");

    const suggestedX = result.correction?.suggested[0]?.toFixed(2) || "";
    const suggestedY = result.correction?.suggested[1]?.toFixed(2) || "";
    const suggestedZ = result.correction?.suggested[2]?.toFixed(2) || "";
    const distance = result.correction?.distance.toFixed(2) || "";

    lines.push(
      `${spawn.guid},"${spawn.name}",${spawn.map},${pos[0].toFixed(2)},${pos[1].toFixed(2)},${pos[2].toFixed(2)},${result.valid},"${issueTypes}",${maxSeverity},"${suggestedX}","${suggestedY}","${suggestedZ}","${distance}"`,
    );
  }

  const csv = lines.join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  downloadBlob(blob, `${filename}.csv`);
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Trigger browser download of a blob
 *
 * @param blob Blob to download
 * @param filename Filename
 */
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Copy text to clipboard
 *
 * @param text Text to copy
 * @returns Promise
 */
export async function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard) {
    await navigator.clipboard.writeText(text);
  } else {
    // Fallback for older browsers
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);
  }
}
