/**
 * Data distributions endpoint.
 *
 * Serves the spell, item and creature distributions computed from the active
 * build's client data. The dashboard previously charted hardcoded figures and a
 * Math.random() series because the real numbers need a scan of 417,632
 * SpellMisc and 175,059 ItemSparse rows - too much for a page load, but fine
 * for a cached computation that only changes when the build does.
 *
 * @module api/distributions
 */

import { NextRequest, NextResponse } from "next/server";
import { getDistributions } from "@/../src/tools/distributions";
import { loadBuildManifest } from "@/../src/version/BuildManifest";

export interface DistributionsResponse {
  success: boolean;
  /** Whether the answer came from the on-disk cache rather than a fresh scan. */
  cached?: boolean;
  data?: unknown;
  error?: string;
}

export async function GET(request: NextRequest): Promise<NextResponse<DistributionsResponse>> {
  try {
    // The manifest decides which build's files are scanned, and it is not
    // guaranteed to have been loaded in this process yet.
    await loadBuildManifest();

    const forceRefresh = request.nextUrl.searchParams.get("refresh") === "true";
    const { distributions, cached } = await getDistributions(forceRefresh);

    return NextResponse.json({ success: true, cached, data: distributions });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in /api/distributions:", error);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
