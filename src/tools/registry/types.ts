/**
 * Tool Registry Types
 *
 * Shared type definitions for the modular tool registry system.
 * Each category file exports an array of ToolRegistryEntry objects
 * containing both the MCP tool definition and its handler function.
 *
 * Types use index signatures to maintain compatibility with the MCP SDK's
 * passthrough zod schema types which require `[x: string]: unknown`.
 *
 * @module tools/registry/types
 */

/**
 * MCP tool response content block.
 * Includes index signature for MCP SDK compatibility.
 */
export interface ToolContentBlock {
  [key: string]: unknown;
  type: "text" | "image" | "resource";
  text?: string;
  data?: string;
  mimeType?: string;
}

/**
 * MCP tool response.
 * Includes index signature for MCP SDK compatibility.
 */
export interface ToolResponse {
  [key: string]: unknown;
  content: ToolContentBlock[];
  isError?: boolean;
}

/**
 * Tool handler function signature
 */
export type ToolHandler = (
  args: Record<string, unknown>
) => Promise<ToolResponse>;

/**
 * Property definition within a tool input schema.
 * Flexible enough to support all JSON Schema features used by MCP tools.
 */
export interface ToolPropertyDefinition {
  [key: string]: unknown;
  type: string;
  description?: string;
  enum?: string[];
  items?: Record<string, unknown>;
  default?: unknown;
  properties?: Record<string, ToolPropertyDefinition>;
}

/**
 * Tool input schema (JSON Schema subset).
 * Includes index signature for MCP SDK compatibility.
 */
export interface ToolInputSchema {
  [key: string]: unknown;
  type: "object";
  properties: Record<string, ToolPropertyDefinition>;
  required?: string[];
}

/**
 * MCP tool definition (name + description + schema)
 */
export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: ToolInputSchema;
}

/**
 * Complete registry entry combining definition with handler
 */
export interface ToolRegistryEntry {
  definition: ToolDefinition;
  handler: ToolHandler;
}

/**
 * Helper to create a JSON text response (most common pattern)
 */
export function jsonResponse(data: unknown): ToolResponse {
  return {
    content: [{
      type: "text" as const,
      text: JSON.stringify(data, null, 2),
    }],
  };
}

/**
 * Helper to create a plain text response
 */
export function textResponse(text: string): ToolResponse {
  return {
    content: [{
      type: "text" as const,
      text,
    }],
  };
}
