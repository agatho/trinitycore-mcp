/**
 * Configuration Diagnostic API Route
 *
 * GET /api/config/diagnose - Get diagnostic information about configuration
 */

import { NextResponse } from "next/server";
import { envFileExists, readAllEnvFiles } from "@/lib/env-utils";
import { existsSync } from "fs";
import { join } from "path";
import { access } from "fs/promises";

export async function GET() {
  try {
    const envFiles = envFileExists();
    const envVars = readAllEnvFiles();

    // Check WOW_PATH
    const wowPathFromEnv = process.env.WOW_PATH;
    const wowPathFromFile = envVars.merged.WOW_PATH;
    const wowPathValid = wowPathFromEnv ? existsSync(wowPathFromEnv) : false;

    // Check if CASC files exist (using same validation as CASCReader)
    let cascValid = false;
    let cascError = "";
    if (wowPathFromEnv) {
      try {
        const dataPath = join(wowPathFromEnv, 'Data', 'data');
        await access(dataPath);
        cascValid = true;
      } catch (error) {
        cascError = `Data/data directory not found. Expected at: ${join(wowPathFromEnv, 'Data', 'data')}`;
      }
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
          cascError: cascError || null,
          expectedPath: wowPathFromEnv ? join(wowPathFromEnv, 'Data', 'data') : null,
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
