/**
 * API Route: POST /api/mcp/call
 * Calls an MCP tool with provided arguments
 */

import { NextRequest, NextResponse } from "next/server";
import { getMCPClient, initializeMCPClient } from "@/lib/mcp/client";

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json();
    const { toolName, args } = body;

    if (!toolName) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required parameter: toolName",
        },
        { status: 400 }
      );
    }

    // Ensure MCP client is connected
    const client = getMCPClient();
    if (!client.isClientConnected()) {
      await initializeMCPClient();
    }

    // Call the tool
    const startTime = Date.now();
    const result = await client.callTool(toolName, args || {});
    const duration = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      toolName,
      result,
      metadata: {
        duration: `${duration}ms`,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Error calling MCP tool:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
