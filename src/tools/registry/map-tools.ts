/**
 * Map Tools Registry
 *
 * VMap, MMap, and Minimap tools for height detection, pathfinding, and tile extraction.
 *
 * @module tools/registry/map-tools
 */

import { ToolRegistryEntry, ToolResponse, jsonResponse } from "./types";
import { listVMapFiles, getVMapFileInfo, testLineOfSight, findSpawnsInRadius } from "../vmap-tools";
import { listMMapFiles, getMMapFileInfo, findPath, isOnNavMesh } from "../mmap-tools";
import { getMapMinimap, getMinimapTile, getMinimapTilesBatch, clearMinimapCache } from "../minimap";

export const mapTools: ToolRegistryEntry[] = [
  // VMap Tools
  {
    definition: {
      name: "list-vmap-files",
      description: "List available VMap files in a directory. VMap files contain visibility and collision geometry for game maps.",
      inputSchema: {
        type: "object",
        properties: {
          vmapDir: { type: "string", description: "Path to VMap directory (default: from VMAP_PATH env variable)" },
        },
      },
    },
    handler: async (args) => {
      const vmapDir = (args.vmapDir as string | undefined) || process.env.VMAP_PATH || "./data/vmaps";
      const result = await listVMapFiles(vmapDir);
      return jsonResponse(result);
    },
  },
  {
    definition: {
      name: "get-vmap-file-info",
      description: "Get detailed information about a specific VMap file including size, type (tree/tile), and map coordinates.",
      inputSchema: {
        type: "object",
        properties: {
          vmapFile: { type: "string", description: "Path to VMap file (.vmtree or .vmtile)" },
        },
        required: ["vmapFile"],
      },
    },
    handler: async (args) => {
      const result = await getVMapFileInfo(args.vmapFile as string);
      return jsonResponse(result);
    },
  },
  {
    definition: {
      name: "vmap-test-line-of-sight",
      description: "Test line-of-sight between two points using VMap collision data. NOTE: Current implementation uses distance-based heuristics.",
      inputSchema: {
        type: "object",
        properties: {
          vmapDir: { type: "string", description: "VMap directory path" },
          mapId: { type: "number", description: "Map ID" },
          startX: { type: "number", description: "Start X coordinate" },
          startY: { type: "number", description: "Start Y coordinate" },
          startZ: { type: "number", description: "Start Z coordinate" },
          endX: { type: "number", description: "End X coordinate" },
          endY: { type: "number", description: "End Y coordinate" },
          endZ: { type: "number", description: "End Z coordinate" },
        },
        required: ["vmapDir", "mapId", "startX", "startY", "startZ", "endX", "endY", "endZ"],
      },
    },
    handler: async (args) => {
      const result = await testLineOfSight({
        vmapDir: args.vmapDir as string,
        mapId: args.mapId as number,
        startX: args.startX as number,
        startY: args.startY as number,
        startZ: args.startZ as number,
        endX: args.endX as number,
        endY: args.endY as number,
        endZ: args.endZ as number,
      });
      return jsonResponse(result);
    },
  },
  {
    definition: {
      name: "vmap-find-spawns-in-radius",
      description: "Find creature/gameobject spawns within radius of a point. NOTE: Current implementation queries database only.",
      inputSchema: {
        type: "object",
        properties: {
          vmapDir: { type: "string", description: "VMap directory path" },
          mapId: { type: "number", description: "Map ID" },
          centerX: { type: "number", description: "Center X coordinate" },
          centerY: { type: "number", description: "Center Y coordinate" },
          centerZ: { type: "number", description: "Center Z coordinate" },
          radius: { type: "number", description: "Search radius in game units" },
        },
        required: ["vmapDir", "mapId", "centerX", "centerY", "centerZ", "radius"],
      },
    },
    handler: async (args) => {
      const result = await findSpawnsInRadius({
        vmapDir: args.vmapDir as string,
        mapId: args.mapId as number,
        centerX: args.centerX as number,
        centerY: args.centerY as number,
        centerZ: args.centerZ as number,
        radius: args.radius as number,
      });
      return jsonResponse(result);
    },
  },
  // MMap Tools
  {
    definition: {
      name: "list-mmap-files",
      description: "List available MMap (Movement Map / Navigation Mesh) files in a directory. MMap files are used for AI pathfinding.",
      inputSchema: {
        type: "object",
        properties: {
          mmapDir: { type: "string", description: "Path to MMap directory (default: from MMAP_PATH env variable)" },
        },
      },
    },
    handler: async (args) => {
      const mmapDir = (args.mmapDir as string | undefined) || process.env.MMAP_PATH || "./data/mmaps";
      const result = await listMMapFiles(mmapDir);
      return jsonResponse(result);
    },
  },
  {
    definition: {
      name: "get-mmap-file-info",
      description: "Get detailed information about a specific MMap file including size, type (header/tile), and map coordinates.",
      inputSchema: {
        type: "object",
        properties: {
          mmapFile: { type: "string", description: "Path to MMap file (.mmap or .mmtile)" },
        },
        required: ["mmapFile"],
      },
    },
    handler: async (args) => {
      const result = await getMMapFileInfo(args.mmapFile as string);
      return jsonResponse(result);
    },
  },
  {
    definition: {
      name: "mmap-find-path",
      description: "Find walkable path between two points using navigation mesh. NOTE: Current implementation returns straight-line path with interpolated waypoints.",
      inputSchema: {
        type: "object",
        properties: {
          mmapDir: { type: "string", description: "MMap directory path" },
          mapId: { type: "number", description: "Map ID" },
          startX: { type: "number", description: "Start X coordinate" },
          startY: { type: "number", description: "Start Y coordinate" },
          startZ: { type: "number", description: "Start Z coordinate" },
          goalX: { type: "number", description: "Goal X coordinate" },
          goalY: { type: "number", description: "Goal Y coordinate" },
          goalZ: { type: "number", description: "Goal Z coordinate" },
        },
        required: ["mmapDir", "mapId", "startX", "startY", "startZ", "goalX", "goalY", "goalZ"],
      },
    },
    handler: async (args) => {
      const result = await findPath({
        mmapDir: args.mmapDir as string,
        mapId: args.mapId as number,
        startX: args.startX as number,
        startY: args.startY as number,
        startZ: args.startZ as number,
        goalX: args.goalX as number,
        goalY: args.goalY as number,
        goalZ: args.goalZ as number,
      });
      return jsonResponse(result);
    },
  },
  {
    definition: {
      name: "mmap-is-on-navmesh",
      description: "Check if a position is on the navigation mesh. NOTE: Current implementation returns true for all positions.",
      inputSchema: {
        type: "object",
        properties: {
          mmapDir: { type: "string", description: "MMap directory path" },
          mapId: { type: "number", description: "Map ID" },
          posX: { type: "number", description: "Position X coordinate" },
          posY: { type: "number", description: "Position Y coordinate" },
          posZ: { type: "number", description: "Position Z coordinate" },
        },
        required: ["mmapDir", "mapId", "posX", "posY", "posZ"],
      },
    },
    handler: async (args) => {
      const result = await isOnNavMesh({
        mmapDir: args.mmapDir as string,
        mapId: args.mapId as number,
        posX: args.posX as number,
        posY: args.posY as number,
        posZ: args.posZ as number,
      });
      return jsonResponse(result);
    },
  },
  // Minimap Tools
  {
    definition: {
      name: "get-map-minimap",
      description: "Get map information including starting FileDataID for minimap tiles.",
      inputSchema: {
        type: "object",
        properties: {
          mapId: { type: "number", description: "Map ID from Map.db2 (e.g. 0=Azeroth, 1=Kalimdor, 530=Outland)" },
        },
        required: ["mapId"],
      },
    },
    handler: async (args) => {
      return await getMapMinimap({ mapId: args.mapId as number }) as ToolResponse;
    },
  },
  {
    definition: {
      name: "get-minimap-tile",
      description: "Extract and convert a minimap tile from CASC to PNG format with caching.",
      inputSchema: {
        type: "object",
        properties: {
          fileDataId: { type: "number", description: "FileDataID of the BLP tile to extract" },
          forceRefresh: { type: "boolean", description: "Force re-extraction bypassing cache (default: false)" },
        },
        required: ["fileDataId"],
      },
    },
    handler: async (args) => {
      return await getMinimapTile({
        fileDataId: args.fileDataId as number,
        forceRefresh: args.forceRefresh as boolean | undefined,
      }) as ToolResponse;
    },
  },
  {
    definition: {
      name: "get-minimap-tiles-batch",
      description: "Extract multiple minimap tiles in batch for improved performance.",
      inputSchema: {
        type: "object",
        properties: {
          fileDataIds: { type: "array", items: { type: "number" }, description: "Array of FileDataIDs to extract" },
          mapId: { type: "number", description: "Map ID to extract all tiles for" },
          startFileDataId: { type: "number", description: "Starting FileDataID for consecutive extraction" },
          count: { type: "number", description: "Number of consecutive tiles to extract" },
        },
      },
    },
    handler: async (args) => {
      return await getMinimapTilesBatch({
        fileDataIds: (args.fileDataIds as number[] | undefined) || [],
        mapId: args.mapId as number | undefined,
        startFileDataId: args.startFileDataId as number | undefined,
        count: args.count as number | undefined,
      }) as ToolResponse;
    },
  },
  {
    definition: {
      name: "clear-minimap-cache",
      description: "Clear cached minimap tiles for a specific map or all maps.",
      inputSchema: {
        type: "object",
        properties: {
          mapId: { type: "number", description: "Map ID to clear cache for (omit to clear all cached tiles)" },
        },
      },
    },
    handler: async (args) => {
      return await clearMinimapCache({ mapId: args.mapId as number | undefined }) as ToolResponse;
    },
  },
];
