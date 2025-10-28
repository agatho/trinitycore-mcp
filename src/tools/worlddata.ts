/**
 * World Data MCP Tool
 *
 * Provides world navigation data: points of interest, gameobjects,
 * spawn locations, and coordinate information for bot pathfinding.
 *
 * @module worlddata
 */

import { queryWorld } from "../database/connection";

export interface PointOfInterest {
  id: number;
  posX: number;
  posY: number;
  posZ: number;
  icon: number;
  flags: number;
  importance: number;
  name: string;
}

export interface GameObject {
  guid: string;
  entry: number;
  map: number;
  zoneId: number;
  areaId: number;
  posX: number;
  posY: number;
  posZ: number;
  orientation: number;
  rotation: number[];
  spawntimesecs: number;
  state: number;
  phaseId: number;
}

export interface CreatureSpawn {
  guid: string;
  entry: number;
  map: number;
  zoneId: number;
  areaId: number;
  posX: number;
  posY: number;
  posZ: number;
  orientation: number;
  spawntimesecs: number;
  movementType: number;
}

export async function getPointsOfInterest(name?: string): Promise<PointOfInterest[]> {
  let query = "SELECT ID as id, PositionX as posX, PositionY as posY, PositionZ as posZ, Icon as icon, Flags as flags, Importance as importance, Name as name FROM points_of_interest";
  const params: any[] = [];

  if (name) {
    query += " WHERE Name LIKE ?";
    params.push(`%${name}%`);
  }

  query += " LIMIT 100";
  return await queryWorld(query, params) as PointOfInterest[];
}

export async function getGameObjectsByEntry(entry: number): Promise<GameObject[]> {
  const query = `
    SELECT guid, id as entry, map, zoneId, areaId,
           position_x as posX, position_y as posY, position_z as posZ,
           orientation, rotation0, rotation1, rotation2, rotation3,
           spawntimesecs, state, PhaseId as phaseId
    FROM gameobject
    WHERE id = ?
    LIMIT 100
  `;

  const results = await queryWorld(query, [entry]);
  return results.map((r: any) => ({
    ...r,
    rotation: [r.rotation0, r.rotation1, r.rotation2, r.rotation3]
  })) as GameObject[];
}

export async function getCreatureSpawns(entry: number): Promise<CreatureSpawn[]> {
  const query = `
    SELECT guid, id as entry, map, zoneId, areaId,
           position_x as posX, position_y as posY, position_z as posZ,
           orientation, spawntimesecs, MovementType as movementType
    FROM creature
    WHERE id = ?
    LIMIT 100
  `;

  return await queryWorld(query, [entry]) as CreatureSpawn[];
}

export async function findNearbyCreatures(map: number, x: number, y: number, radius: number = 100): Promise<CreatureSpawn[]> {
  const query = `
    SELECT guid, id as entry, map, zoneId, areaId,
           position_x as posX, position_y as posY, position_z as posZ,
           orientation, spawntimesecs, MovementType as movementType
    FROM creature
    WHERE map = ?
      AND SQRT(POW(position_x - ?, 2) + POW(position_y - ?, 2)) < ?
    LIMIT 50
  `;

  return await queryWorld(query, [map, x, y, radius]) as CreatureSpawn[];
}

export async function findNearbyGameObjects(map: number, x: number, y: number, radius: number = 100): Promise<GameObject[]> {
  const query = `
    SELECT guid, id as entry, map, zoneId, areaId,
           position_x as posX, position_y as posY, position_z as posZ,
           orientation, rotation0, rotation1, rotation2, rotation3,
           spawntimesecs, state, PhaseId as phaseId
    FROM gameobject
    WHERE map = ?
      AND SQRT(POW(position_x - ?, 2) + POW(position_y - ?, 2)) < ?
    LIMIT 50
  `;

  const results = await queryWorld(query, [map, x, y, radius]);
  return results.map((r: any) => ({
    ...r,
    rotation: [r.rotation0, r.rotation1, r.rotation2, r.rotation3]
  })) as GameObject[];
}
