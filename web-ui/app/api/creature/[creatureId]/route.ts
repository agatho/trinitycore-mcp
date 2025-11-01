/**
 * API Route: GET /api/creature/[creatureId]
 * Get detailed creature information from TrinityCore MCP
 */

import { NextRequest, NextResponse } from "next/server";
import { getMCPClient, initializeMCPClient } from "@/lib/mcp/client";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ creatureId: string }> }
) {
  try {
    const { creatureId } = await params;
    const creatureEntry = parseInt(creatureId, 10);

    if (isNaN(creatureEntry)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid creature ID",
        },
        { status: 400 }
      );
    }

    // Ensure MCP client is connected
    const client = getMCPClient();
    if (!client.isClientConnected()) {
      await initializeMCPClient();
    }

    // Call get-creature-full-info tool
    const result = await client.callTool("get-creature-full-info", {
      entry: creatureEntry,
      includeLoot: true, // Include loot table
    });

    return NextResponse.json({
      success: true,
      creature: result,
    });
  } catch (error) {
    console.error("Error fetching creature info:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
