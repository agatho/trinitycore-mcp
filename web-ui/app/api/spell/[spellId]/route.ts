/**
 * API Route: GET /api/spell/[spellId]
 * Get detailed spell information from TrinityCore MCP
 */

import { NextRequest, NextResponse } from "next/server";
import { getMCPClient, initializeMCPClient } from "@/lib/mcp/client";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ spellId: string }> }
) {
  try {
    const { spellId } = await params;
    const spellIdNum = parseInt(spellId, 10);

    if (isNaN(spellIdNum)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid spell ID",
        },
        { status: 400 }
      );
    }

    // Ensure MCP client is connected
    const client = getMCPClient();
    if (!client.isClientConnected()) {
      await initializeMCPClient();
    }

    // Call get-spell-info tool
    const result = await client.callTool("get-spell-info", {
      spellId: spellIdNum,
    });

    return NextResponse.json({
      success: true,
      spell: result,
    });
  } catch (error) {
    console.error("Error fetching spell info:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
