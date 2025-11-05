/**
 * MCP Types
 * Type definitions that can be safely imported in client components
 * Separated from client implementation to avoid Node.js dependencies in browser
 */

// MCP Tool Categories
export enum MCPToolCategory {
  SPELL = "spell",
  ITEM = "item",
  CREATURE = "creature",
  QUEST = "quest",
  DATABASE = "database",
  COMBAT = "combat",
  TALENT = "talent",
  REPUTATION = "reputation",
  ECONOMY = "economy",
  PVP = "pvp",
  DUNGEON = "dungeon",
  LEVELING = "leveling",
  COORDINATION = "coordination",
}

// MCP Tool Interface
export interface MCPTool {
  name: string;
  description: string;
  category: MCPToolCategory;
  inputSchema: any;
}

// MCP Client Configuration
export interface MCPClientConfig {
  serverPath: string;
  env?: Record<string, string>;
}
