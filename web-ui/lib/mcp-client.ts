/**
 * MCP Client Integration Layer
 * Provides server-side MCP communication for Next.js API routes
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import fs from 'fs';
import path from 'path';

/**
 * MCP Tool Schema Interface
 * Matches the structure returned by client.listTools()
 */
export interface ToolSchema {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description: string;
      enum?: string[];
      default?: any;
      items?: any;
    }>;
    required?: string[];
  };
}

/**
 * MCP Tool Execution Result
 */
export interface ToolExecutionResult {
  success: boolean;
  result?: any;
  error?: string;
  executionTime: number;
}

/**
 * MCP Client Class
 * Manages connection to TrinityCore MCP server and tool execution
 */
export class MCPClient {
  private client: Client | null = null;
  private transport: StdioClientTransport | null = null;
  private connected: boolean = false;
  private toolsCache: ToolSchema[] | null = null;
  private cacheExpiry: number = 0;

  /**
   * Connect to MCP server
   */
  async connect(): Promise<void> {
    if (this.connected && this.client) {
      return;
    }

    try {
      // Read MCP server config from trinitycore-mcp/.mcp.json
      // web-ui is at: C:\TrinityBots\trinitycore-mcp\web-ui
      // .mcp.json is at: C:\TrinityBots\trinitycore-mcp\.mcp.json
      const mcpConfigPath = path.join(process.cwd(), '..', '.mcp.json');

      if (!fs.existsSync(mcpConfigPath)) {
        throw new Error(`MCP config not found at: ${mcpConfigPath}`);
      }

      const mcpConfigContent = fs.readFileSync(mcpConfigPath, 'utf8');
      const mcpConfig = JSON.parse(mcpConfigContent);

      if (!mcpConfig.mcpServers?.trinitycore) {
        throw new Error('TrinityCore MCP server not configured in .mcp.json');
      }

      const serverConfig = mcpConfig.mcpServers.trinitycore;

      // Create stdio transport
      this.transport = new StdioClientTransport({
        command: serverConfig.command,
        args: serverConfig.args,
        env: {
          ...process.env,
          ...serverConfig.env,
        },
      });

      // Create MCP client
      this.client = new Client({
        name: 'trinitycore-web-ui',
        version: '1.0.0',
      }, {
        capabilities: {},
      });

      // Connect to MCP server
      await this.client.connect(this.transport);
      this.connected = true;

      console.log('[MCP Client] Connected to TrinityCore MCP server');
    } catch (error) {
      console.error('[MCP Client] Connection error:', error);
      this.connected = false;
      this.client = null;
      this.transport = null;
      throw error;
    }
  }

  /**
   * List all available MCP tools
   * Results are cached for 1 hour
   */
  async listTools(): Promise<ToolSchema[]> {
    // Check cache
    const now = Date.now();
    if (this.toolsCache && this.cacheExpiry > now) {
      return this.toolsCache;
    }

    try {
      await this.connect();

      if (!this.client) {
        throw new Error('MCP client not connected');
      }

      const result = await this.client.listTools();
      this.toolsCache = result.tools as ToolSchema[];
      this.cacheExpiry = now + (60 * 60 * 1000); // Cache for 1 hour

      console.log(`[MCP Client] Loaded ${this.toolsCache.length} tools`);

      return this.toolsCache;
    } catch (error) {
      console.error('[MCP Client] List tools error:', error);
      throw error;
    }
  }

  /**
   * Call a specific MCP tool with parameters
   */
  async callTool(name: string, parameters: Record<string, any>): Promise<ToolExecutionResult> {
    const startTime = Date.now();

    try {
      await this.connect();

      if (!this.client) {
        throw new Error('MCP client not connected');
      }

      console.log(`[MCP Client] Calling tool: ${name}`, parameters);

      const result = await this.client.callTool({
        name,
        arguments: parameters,
      });

      const executionTime = Date.now() - startTime;

      console.log(`[MCP Client] Tool ${name} completed in ${executionTime}ms`);

      return {
        success: true,
        result: result.content,
        executionTime,
      };
    } catch (error: any) {
      const executionTime = Date.now() - startTime;

      console.error(`[MCP Client] Tool ${name} failed:`, error);

      return {
        success: false,
        error: error.message || 'Tool execution failed',
        executionTime,
      };
    }
  }

  /**
   * Get tool schema by name
   */
  async getToolSchema(name: string): Promise<ToolSchema | null> {
    const tools = await this.listTools();
    return tools.find(t => t.name === name) || null;
  }

  /**
   * Disconnect from MCP server
   */
  async disconnect(): Promise<void> {
    if (this.connected && this.client) {
      try {
        await this.client.close();
        console.log('[MCP Client] Disconnected from MCP server');
      } catch (error) {
        console.error('[MCP Client] Disconnect error:', error);
      } finally {
        this.connected = false;
        this.client = null;
        this.transport = null;
      }
    }
  }

  /**
   * Clear tools cache
   */
  clearCache(): void {
    this.toolsCache = null;
    this.cacheExpiry = 0;
  }
}

/**
 * Singleton MCP client instance
 * Reused across all API route calls for connection pooling
 */
let mcpClientInstance: MCPClient | null = null;

/**
 * Get or create MCP client singleton
 */
export function getMCPClient(): MCPClient {
  if (!mcpClientInstance) {
    mcpClientInstance = new MCPClient();
  }
  return mcpClientInstance;
}

/**
 * Cleanup function for graceful shutdown
 */
export async function shutdownMCPClient(): Promise<void> {
  if (mcpClientInstance) {
    await mcpClientInstance.disconnect();
    mcpClientInstance = null;
  }
}
