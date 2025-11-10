/**
 * Configuration Diagnostic API Route
 *
 * GET /api/config/diagnose - Get diagnostic information about configuration
 */

import { NextResponse } from "next/server";
import { envFileExists, readAllEnvFiles } from "@/lib/env-utils";
import { existsSync } from "fs";
import { join } from "path";

export async function GET() {
  try {
    const envFiles = envFileExists();
    const envVars = readAllEnvFiles();

    // Check WOW_PATH
    const wowPathFromEnv = process.env.WOW_PATH;
    const wowPathFromFile = envVars.merged.WOW_PATH;
    const wowPathValid = wowPathFromEnv ? existsSync(wowPathFromEnv) : false;

    // Check if CASC files exist
    let cascValid = false;
    if (wowPathFromEnv) {
      const buildInfoPath = join(wowPathFromEnv, '.build.info');
      cascValid = existsSync(buildInfoPath);
    }

    return NextResponse.json({
      success: true,
      diagnostic: {
        envFiles: {
          webUI: envFiles.webUI,
          mcpServer: envFiles.mcpServer,
        },
        wowPath: {
          fromProcessEnv: wowPathFromEnv || null,
          fromEnvFile: wowPathFromFile || null,
          exists: wowPathValid,
          cascValid: cascValid,
        },
        allEnvVars: Object.keys(envVars.merged).length,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: `Failed to diagnose configuration: ${(error as Error).message}`,
      },
      { status: 500 }
    );
  }
}
