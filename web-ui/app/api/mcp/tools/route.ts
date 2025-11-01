/**
 * API Route: GET /api/mcp/tools
 * Returns list of all available MCP tools
 */

import { NextResponse } from "next/server";
import { getMCPClient, initializeMCPClient } from "@/lib/mcp/client";

export async function GET() {
  try {
    // Ensure MCP client is connected
    const client = getMCPClient();
    if (!client.isClientConnected()) {
      await initializeMCPClient();
    }

    // Get all tools
    const tools = client.getTools();

    return NextResponse.json({
      success: true,
      count: tools.length,
      tools,
    });
  } catch (error) {
    console.error("Error fetching MCP tools:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
