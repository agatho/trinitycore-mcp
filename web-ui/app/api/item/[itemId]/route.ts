/**
 * API Route: GET /api/item/[itemId]
 * Get detailed item information from TrinityCore MCP
 */

import { NextRequest, NextResponse } from "next/server";
import { getMCPClient, initializeMCPClient } from "@/lib/mcp/client";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  try {
    const { itemId } = await params;
    const itemIdNum = parseInt(itemId, 10);

    if (isNaN(itemIdNum)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid item ID",
        },
        { status: 400 }
      );
    }

    // Ensure MCP client is connected
    const client = getMCPClient();
    if (!client.isClientConnected()) {
      await initializeMCPClient();
    }

    // Call get-item-info tool
    const result = await client.callTool("get-item-info", {
      itemId: itemIdNum,
    });

    return NextResponse.json({
      success: true,
      item: result,
    });
  } catch (error) {
    console.error("Error fetching item info:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
