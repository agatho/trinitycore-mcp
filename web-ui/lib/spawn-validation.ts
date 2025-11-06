/**
 * Spawn Validation Utilities
 *
 * Validates creature and object spawn positions against collision and navigation data.
 * Identifies invalid spawns and suggests corrections.
 *
 * @module spawn-validation
 */

import type { MMapData } from "./mmap-types";
import type { ModelSpawn, VMapData } from "./vmap-types";
import { findNearestPoly, isOnNavMesh } from "./mmap-parser";
import { pointInAABB } from "./collision-utils";

// ============================================================================
// Types
// ============================================================================

/**
 * Spawn validation result
 */
export interface SpawnValidationResult {
  /** Is the spawn position valid? */
  valid: boolean;

  /** Validation issues found */
  issues: SpawnIssue[];

  /** Suggested correction (if any) */
  correction: SpawnCorrection | null;

  /** Spawn being validated */
  spawn: CreatureSpawn | ObjectSpawn;
}

/**
 * Spawn issue type
 */
export enum IssueType {
  NotOnNavMesh = "not_on_navmesh",
  InsideCollision = "inside_collision",
  TooHigh = "too_high",
  TooLow = "too_low",
  Unreachable = "unreachable",
  NoTileData = "no_tile_data",
}

/**
 * Spawn validation issue
 */
export interface SpawnIssue {
  /** Issue type */
  type: IssueType;

  /** Issue severity (1-10, 10 = critical) */
  severity: number;

  /** Human-readable description */
  description: string;

  /** Additional context */
  context?: Record<string, unknown>;
}

/**
 * Spawn correction suggestion
 */
export interface SpawnCorrection {
  /** Original position */
  original: [number, number, number];

  /** Suggested corrected position */
  suggested: [number, number, number];

  /** Distance moved */
  distance: number;

  /** Reason for correction */
  reason: string;
}

/**
 * Creature spawn
 */
export interface CreatureSpawn {
  guid: number;
  id: number;
  name: string;
  position: [number, number, number];
  orientation: number;
  map: number;
}

/**
 * Object spawn
 */
export interface ObjectSpawn {
  guid: number;
  id: number;
  name: string;
  position: [number, number, number];
  rotation: [number, number, number, number];
  map: number;
}

/**
 * Batch validation result
 */
export interface BatchValidationResult {
  /** Total spawns validated */
  total: number;

  /** Valid spawns */
  valid: number;

  /** Invalid spawns */
  invalid: number;

  /** Individual results */
  results: SpawnValidationResult[];

  /** Summary by issue type */
  issueSummary: Map<IssueType, number>;
}

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validate a creature spawn position
 *
 * @param spawn Spawn to validate
 * @param mmapData Navigation mesh data
 * @param vmapData Collision data (optional)
 * @returns Validation result
 */
export function validateCreatureSpawn(
  spawn: CreatureSpawn,
  mmapData: MMapData,
  vmapData?: VMapData,
): SpawnValidationResult {
  const issues: SpawnIssue[] = [];
  let correction: SpawnCorrection | null = null;

  const position: [number, number, number] = spawn.position;

  // Find tile
  const tileX = Math.floor(position[0] / mmapData.header.params.tileWidth);
  const tileY = Math.floor(position[2] / mmapData.header.params.tileHeight);
  const tileKey = `${tileX}_${tileY}`;
  const tile = mmapData.tiles.get(tileKey);

  if (!tile) {
    issues.push({
      type: IssueType.NoTileData,
      severity: 10,
      description: `No navigation tile found for position (tile ${tileKey})`,
      context: { tileX, tileY },
    });

    return {
      valid: false,
      issues,
      correction: null,
      spawn,
    };
  }

  // Check if on navmesh
  const onNavMesh = isOnNavMesh(tile, position, [2, 2, 2]);

  if (!onNavMesh) {
    issues.push({
      type: IssueType.NotOnNavMesh,
      severity: 9,
      description: "Spawn position is not on navigation mesh (creatures cannot walk here)",
      context: { position },
    });

    // Try to find nearest navmesh position
    const nearestPoly = findNearestPoly(tile, position, [10, 10, 10]);
    if (nearestPoly !== -1) {
      // Get polygon center as correction
      const poly = tile.polys[nearestPoly];
      let cx = 0;
      let cy = 0;
      let cz = 0;

      for (let i = 0; i < poly.vertCount; i++) {
        const vert = tile.verts[poly.verts[i]];
        cx += vert[0];
        cy += vert[1];
        cz += vert[2];
      }

      const suggested: [number, number, number] = [
        cx / poly.vertCount,
        cy / poly.vertCount,
        cz / poly.vertCount,
      ];

      const distance = Math.sqrt(
        (suggested[0] - position[0]) ** 2 +
          (suggested[1] - position[1]) ** 2 +
          (suggested[2] - position[2]) ** 2,
      );

      correction = {
        original: position,
        suggested,
        distance,
        reason: "Snapped to nearest walkable surface",
      };
    }
  }

  // Check collision (if vmap data provided)
  if (vmapData) {
    for (const modelSpawn of vmapData.allSpawns) {
      if (pointInAABB({ x: position[0], y: position[1], z: position[2] }, modelSpawn.bounds)) {
        issues.push({
          type: IssueType.InsideCollision,
          severity: 8,
          description: `Spawn is inside collision geometry: ${modelSpawn.name}`,
          context: { model: modelSpawn.name },
        });
        break;
      }
    }
  }

  // Check height (basic sanity check)
  const heightAboveGround = position[1];
  if (heightAboveGround > 1000) {
    issues.push({
      type: IssueType.TooHigh,
      severity: 7,
      description: "Spawn is very high above ground (possible floating spawn)",
      context: { height: heightAboveGround },
    });
  } else if (heightAboveGround < -500) {
    issues.push({
      type: IssueType.TooLow,
      severity: 7,
      description: "Spawn is very low (possible underground spawn)",
      context: { height: heightAboveGround },
    });
  }

  return {
    valid: issues.length === 0,
    issues,
    correction,
    spawn,
  };
}

/**
 * Validate an object spawn position
 *
 * @param spawn Object spawn to validate
 * @param mmapData Navigation mesh data
 * @param vmapData Collision data (optional)
 * @returns Validation result
 */
export function validateObjectSpawn(
  spawn: ObjectSpawn,
  mmapData: MMapData,
  vmapData?: VMapData,
): SpawnValidationResult {
  const issues: SpawnIssue[] = [];
  const position: [number, number, number] = spawn.position;

  // Objects are less strict than creatures - they can be off navmesh
  // Just check basic sanity

  // Check if tile exists
  const tileX = Math.floor(position[0] / mmapData.header.params.tileWidth);
  const tileY = Math.floor(position[2] / mmapData.header.params.tileHeight);
  const tileKey = `${tileX}_${tileY}`;
  const tile = mmapData.tiles.get(tileKey);

  if (!tile) {
    issues.push({
      type: IssueType.NoTileData,
      severity: 5,
      description: `No navigation tile found for position (tile ${tileKey})`,
      context: { tileX, tileY },
    });
  }

  // Check height
  const heightAboveGround = position[1];
  if (heightAboveGround > 1000) {
    issues.push({
      type: IssueType.TooHigh,
      severity: 6,
      description: "Object is very high above ground",
      context: { height: heightAboveGround },
    });
  } else if (heightAboveGround < -500) {
    issues.push({
      type: IssueType.TooLow,
      severity: 6,
      description: "Object is very low (possible underground)",
      context: { height: heightAboveGround },
    });
  }

  return {
    valid: issues.filter((i) => i.severity >= 8).length === 0,
    issues,
    correction: null,
    spawn,
  };
}

/**
 * Validate multiple spawns in batch
 *
 * @param spawns Array of spawns to validate
 * @param mmapData Navigation mesh data
 * @param vmapData Collision data (optional)
 * @param progressCallback Optional progress callback
 * @returns Batch validation result
 */
export function validateSpawnsBatch(
  spawns: (CreatureSpawn | ObjectSpawn)[],
  mmapData: MMapData,
  vmapData?: VMapData,
  progressCallback?: (progress: number) => void,
): BatchValidationResult {
  const results: SpawnValidationResult[] = [];
  const issueSummary = new Map<IssueType, number>();

  for (let i = 0; i < spawns.length; i++) {
    const spawn = spawns[i];

    const result =
      "orientation" in spawn
        ? validateCreatureSpawn(spawn as CreatureSpawn, mmapData, vmapData)
        : validateObjectSpawn(spawn as ObjectSpawn, mmapData, vmapData);

    results.push(result);

    // Update issue summary
    for (const issue of result.issues) {
      issueSummary.set(issue.type, (issueSummary.get(issue.type) || 0) + 1);
    }

    // Report progress
    if (progressCallback && i % 100 === 0) {
      progressCallback((i / spawns.length) * 100);
    }
  }

  if (progressCallback) {
    progressCallback(100);
  }

  const valid = results.filter((r) => r.valid).length;

  return {
    total: spawns.length,
    valid,
    invalid: spawns.length - valid,
    results,
    issueSummary,
  };
}

/**
 * Generate SQL correction script for invalid spawns
 *
 * @param results Validation results with corrections
 * @param tableName Database table name
 * @returns SQL UPDATE statements
 */
export function generateCorrectionSQL(
  results: SpawnValidationResult[],
  tableName: string = "creature",
): string {
  const lines: string[] = [];

  lines.push("-- Spawn Position Corrections");
  lines.push(`-- Generated: ${new Date().toISOString()}`);
  lines.push(`-- Total corrections: ${results.filter((r) => r.correction).length}`);
  lines.push("");

  for (const result of results) {
    if (!result.correction) continue;

    const spawn = result.spawn;
    const correction = result.correction;

    lines.push(`-- ${spawn.name} (GUID: ${spawn.guid})`);
    lines.push(`-- Issue: ${result.issues.map((i) => i.description).join(", ")}`);
    lines.push(`-- Original: (${correction.original.join(", ")})`);
    lines.push(`-- Corrected: (${correction.suggested.join(", ")}) - moved ${correction.distance.toFixed(2)} units`);
    lines.push(
      `UPDATE ${tableName} SET position_x = ${correction.suggested[0].toFixed(6)}, position_y = ${correction.suggested[1].toFixed(6)}, position_z = ${correction.suggested[2].toFixed(6)} WHERE guid = ${spawn.guid};`,
    );
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Export validation report as CSV
 *
 * @param results Validation results
 * @returns CSV string
 */
export function exportValidationCSV(results: SpawnValidationResult[]): string {
  const lines: string[] = [];

  // Header
  lines.push("GUID,Name,Map,X,Y,Z,Valid,Issues,Severity,Correction Distance");

  // Rows
  for (const result of results) {
    const spawn = result.spawn;
    const pos = spawn.position;
    const maxSeverity = Math.max(...result.issues.map((i) => i.severity), 0);
    const issueDesc = result.issues.map((i) => i.type).join(";");
    const correctionDist = result.correction?.distance.toFixed(2) || "N/A";

    lines.push(
      `${spawn.guid},"${spawn.name}",${spawn.map},${pos[0].toFixed(2)},${pos[1].toFixed(2)},${pos[2].toFixed(2)},${result.valid},${issueDesc},${maxSeverity},${correctionDist}`,
    );
  }

  return lines.join("\n");
}
