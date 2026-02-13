/**
 * VMap File Parser (Server-Side)
 *
 * Parses TrinityCore VMap binary files (.vmtree, .vmtile) from disk.
 * Extracts model spawn data with bounding boxes for collision testing.
 *
 * Adapted from web-ui/lib/vmap-parser.ts for server-side Node.js use.
 *
 * @module collision/vmap-parser
 */

import { BinaryReader } from "./binary-reader";
import type { ModelSpawn, VMapTile, AABox } from "./types";
import { SUPPORTED_VMAP_MAGICS, MOD_HAS_BOUND } from "./types";

/**
 * Parse a .vmtile file buffer into spawn data.
 *
 * Binary format:
 * - VMAP_MAGIC (8 bytes)
 * - spawn_count (uint32)
 * - ModelSpawn[spawn_count]
 *
 * @param buffer Raw .vmtile file contents
 * @param tileX Tile X coordinate
 * @param tileY Tile Y coordinate
 * @returns Parsed VMapTile with model spawns
 */
export function parseVMapTile(buffer: Buffer, tileX: number, tileY: number): VMapTile {
  const reader = new BinaryReader(buffer);

  // Read and validate magic header (8 bytes)
  const magic = reader.readString(8);
  if (!SUPPORTED_VMAP_MAGICS.includes(magic as any)) {
    throw new Error(
      `Unsupported VMAP version in tile ${tileX}_${tileY}: "${magic}"`,
    );
  }

  // Read spawn count
  const spawnCount = reader.readUInt32LE();
  if (spawnCount > 100000) {
    throw new Error(
      `Unreasonable spawn count ${spawnCount} in tile ${tileX}_${tileY}`,
    );
  }

  // Read model spawns
  const spawns: ModelSpawn[] = [];
  for (let i = 0; i < spawnCount; i++) {
    spawns.push(readModelSpawn(reader));
  }

  return { magic, spawnCount, spawns, tileX, tileY };
}

/**
 * Parse a .vmtree file buffer to extract the map bounds.
 *
 * Binary format:
 * - VMAP_MAGIC (8 bytes)
 * - NODE_MARKER (4 bytes)
 * - BIH tree bounds (AABox: 6 floats = 24 bytes)
 * - ... (BIH tree data, not needed for bounds-only parsing)
 *
 * @param buffer Raw .vmtree file contents
 * @returns Map bounds from BIH tree root
 */
export function parseVMapTreeBounds(buffer: Buffer): AABox {
  const reader = new BinaryReader(buffer);

  // Read and validate magic header (8 bytes)
  const magic = reader.readString(8);
  if (!SUPPORTED_VMAP_MAGICS.includes(magic as any)) {
    throw new Error(`Unsupported VMAP version in vmtree: "${magic}"`);
  }

  // Read node marker (4 bytes) - "NODE"
  const nodeMarker = reader.readString(4);
  if (nodeMarker !== "NODE") {
    throw new Error(`Invalid node marker in vmtree: "${nodeMarker}"`);
  }

  // Read BIH tree root bounds
  return reader.readAABox();
}

/**
 * Read a single ModelSpawn from the binary stream.
 *
 * Modern TrinityCore VMAP4 format:
 * - flags (uint8)
 * - adtId (uint8)
 * - uniqueId (uint32)
 * - position (Vector3: 3 floats)
 * - rotation (Vector3: 3 floats, Euler angles)
 * - scale (float32)
 * - bounds (AABox: 6 floats) - ONLY if MOD_HAS_BOUND flag is set
 * - nameLength (uint32)
 * - name (string, NOT null-terminated)
 */
function readModelSpawn(reader: BinaryReader): ModelSpawn {
  const flags = reader.readUInt8();
  const adtId = reader.readUInt8();
  const id = reader.readUInt32LE();
  const position = reader.readVector3();
  const rotation = reader.readVector3();
  const scale = reader.readFloatLE();

  let bounds: AABox;
  if (flags & MOD_HAS_BOUND) {
    bounds = reader.readAABox();
  } else {
    bounds = {
      min: { x: 0, y: 0, z: 0 },
      max: { x: 0, y: 0, z: 0 },
    };
  }

  const nameLength = reader.readUInt32LE();
  const name = reader.readString(nameLength);

  return { flags, id, name, position, rotation, scale, bounds, adtId };
}
