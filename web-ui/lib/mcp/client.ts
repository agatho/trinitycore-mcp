// TrinityCore MCP Client
// Enterprise-grade MCP client for Next.js frontend integration
// Provides direct access to all 56 TrinityCore MCP tools
//
// WARNING: This file contains Node.js dependencies (child_process, fs)
// ONLY import this in API routes and Server components
// For client components, import types from lib/mcp/types instead

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { MCPTool, MCPClientConfig } from "./types";
import { MCPToolCategory } from "./types";

// Re-export types for convenience
export type { MCPTool, MCPClientConfig } from "./types";
export { MCPToolCategory } from "./types";

// MCP Client Class
export class TrinityCoreMCPClient {
  private client: Client | null = null;
  private transport: StdioClientTransport | null = null;
  private isConnected: boolean = false;
  private tools: MCPTool[] = [];

  constructor(private config: MCPClientConfig) {}

  
/*
    Connect to the TrinityCore MCP server
   */
  async connect(): Promise<void> {
    if (this.isConnected) {
      return;
    }

    try {
      // Create stdio transport (for local MCP server)
      // Filter out undefined values from env
      const envVars: Record<string, string> = {};
      for (const [key, value] of Object.entries(process.env)) {
        if (value !== undefined) {
          envVars[key] = value;
        }
      }
      for (const [key, value] of Object.entries(this.config.env || {})) {
        if (value !== undefined) {
          envVars[key] = value;
        }
      }

      this.transport = new StdioClientTransport({
        command: "node",
        args: [this.config.serverPath],
        env: envVars,
      });

      // Create MCP client
      this.client = new Client(
        {
          name: "trinitycore-web-ui",
          version: "1.0.0",
        },
        {
          capabilities: {
            tools: {},
          },
        }
      );

      // Connect to server
      await this.client.connect(this.transport);
      this.isConnected = true;

      // Fetch available tools
      await this.refreshTools();

      console.log(`✅ Connected to TrinityCore MCP Server (${this.tools.length} tools available)`);
    } catch (error) {
      console.error("❌ Failed to connect to MCP server:", error);
      throw error;
    }
  }

  
/*
    Disconnect from the MCP server
   */
  async disconnect(): Promise<void> {
    if (!this.isConnected) {
      return;
    }

    try {
      await this.client?.close();
      this.isConnected = false;
      this.client = null;
      this.transport = null;
      console.log("✅ Disconnected from TrinityCore MCP Server");
    } catch (error) {
      console.error("❌ Error disconnecting from MCP server:", error);
      throw error;
    }
  }

  
/*
    Refresh the list of available tools
   */
  async refreshTools(): Promise<void> {
    if (!this.client || !this.isConnected) {
      throw new Error("MCP client not connected");
    }

    try {
      const response = await this.client.listTools();
      this.tools = response.tools.map((tool) => ({
        name: tool.name,
        description: tool.description || "",
        category: this.categorizeTool(tool.name),
        inputSchema: tool.inputSchema,
      }));
    } catch (error) {
      console.error("❌ Failed to refresh tools:", error);
      throw error;
    }
  }

  
/*
    Get all available tools
   */
  getTools(): MCPTool[] {
    return this.tools;
  }

  
/*
    Get tools by category
   */
  getToolsByCategory(category: MCPToolCategory): MCPTool[] {
    return this.tools.filter((tool) => tool.category === category);
  }


/*
    Call an MCP tool
   */
  async callTool<T = any>(
    toolName: string,
    args: Record<string, any> = {},
    options?: { timeout?: number }
  ): Promise<T> {
    if (!this.client || !this.isConnected) {
      throw new Error("MCP client not connected");
    }

    try {
      // Create a promise with custom timeout for long-running operations
      const timeoutMs = options?.timeout || 600000; // Default 10 minutes for large extractions

      const toolCallPromise = this.client.callTool({
        name: toolName,
        arguments: args,
      });

      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Tool call timeout after ${timeoutMs}ms`));
        }, timeoutMs);
      });

      const response = await Promise.race([toolCallPromise, timeoutPromise]);

      // Parse response content
      if (response.content && Array.isArray(response.content) && response.content.length > 0) {
        const content = response.content[0];
        if (content.type === "text" && "text" in content) {
          try {
            return JSON.parse(content.text) as T;
          } catch {
            return content.text as T;
          }
        }
      }

      throw new Error("Invalid response from MCP tool");
    } catch (error) {
      console.error(`❌ Error calling tool ${toolName}:`, error);
      throw error;
    }
  }

  
/*
    Categorize a tool based on its name
   */
  private categorizeTool(toolName: string): MCPToolCategory {
    const name = toolName.toLowerCase();

    if (name.includes("spell")) return MCPToolCategory.SPELL;
    if (name.includes("item")) return MCPToolCategory.ITEM;
    if (name.includes("creature") || name.includes("npc")) return MCPToolCategory.CREATURE;
    if (name.includes("quest")) return MCPToolCategory.QUEST;
    if (name.includes("combat") || name.includes("damage") || name.includes("armor"))
      return MCPToolCategory.COMBAT;
    if (name.includes("talent") || name.includes("build")) return MCPToolCategory.TALENT;
    if (name.includes("reputation") || name.includes("faction")) return MCPToolCategory.REPUTATION;
    if (name.includes("economy") || name.includes("gold") || name.includes("auction"))
      return MCPToolCategory.ECONOMY;
    if (name.includes("pvp") || name.includes("arena") || name.includes("battleground"))
      return MCPToolCategory.PVP;
    if (name.includes("dungeon") || name.includes("raid") || name.includes("boss"))
      return MCPToolCategory.DUNGEON;
    if (name.includes("level") || name.includes("xp") || name.includes("quest-route"))
      return MCPToolCategory.LEVELING;
    if (name.includes("coordinate") || name.includes("group") || name.includes("composition"))
      return MCPToolCategory.COORDINATION;

    return MCPToolCategory.DATABASE;
  }

  
/*
    Check if client is connected
   */
  isClientConnected(): boolean {
    return this.isConnected;
  }
}

// Singleton instance for server-side usage
let mcpClientInstance: TrinityCoreMCPClient | null = null;


/*
  Get the singleton MCP client instance (server-side only)
 */
export function getMCPClient(): TrinityCoreMCPClient {
  if (!mcpClientInstance) {
    mcpClientInstance = new TrinityCoreMCPClient({
      serverPath: process.env.MCP_SERVER_PATH || "C:\\TrinityBots\\trinitycore-mcp\\dist\\index.js",
      env: {
        TRINITY_DB_HOST: process.env.TRINITY_DB_HOST || "localhost",
        TRINITY_DB_PORT: process.env.TRINITY_DB_PORT || "3306",
        TRINITY_DB_USER: process.env.TRINITY_DB_USER || "",
        TRINITY_DB_PASSWORD: process.env.TRINITY_DB_PASSWORD || "",
        TRINITY_ROOT: process.env.TRINITY_ROOT || "C:\\TrinityBots\\TrinityCore",
        DBC_PATH: process.env.DBC_PATH || "C:\\TrinityBots\\Server\\data\\dbc",
        DB2_PATH: process.env.DB2_PATH || "C:\\TrinityBots\\Server\\data\\db2",
      },
    });
  }
  return mcpClientInstance;
}


/*
  Initialize MCP client connection (call once on server startup)
 */
export async function initializeMCPClient(): Promise<void> {
  const client = getMCPClient();
  if (!client.isClientConnected()) {
    await client.connect();
  }
}


/*
  Cleanup MCP client connection (call on server shutdown)
 */
export async function cleanupMCPClient(): Promise<void> {
  if (mcpClientInstance) {
    await mcpClientInstance.disconnect();
    mcpClientInstance = null;
  }
}
