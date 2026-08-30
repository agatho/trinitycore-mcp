/**
 * Client build endpoint.
 *
 * Reports which WoW client build the MCP server is configured to read, where
 * that build's data lives and whether those directories are present. The web UI
 * previously had no way to know this and inferred it from environment
 * variables, which after a build cutover named the previous build.
 *
 * Named build-info rather than build: the repository ignores any directory
 * called `build/`, which would have kept this route out of version control.
 *
 * @module api/build-info
 */

import { NextResponse } from "next/server";
import {
  readBuildManifest,
  checkDataPaths,
  type DataPathStatus,
} from "@/lib/build-manifest";

export interface BuildResponse {
  /** False when no manifest could be read; every other field is then absent. */
  available: boolean;
  activeBuild?: {
    id: string;
    build: number;
    expansion: string;
    status: string;
    db2Format: string;
    opcodeTable?: string;
    cacheDir: string;
  };
  /** Other declared builds, so the UI can show what a cutover would move to. */
  otherBuilds?: Array<{ id: string; build: number; expansion: string; status: string }>;
  dataPaths?: DataPathStatus[];
  /** Data directories the active build declares that are not present. */
  missingPaths?: string[];
  manifestPath?: string;
  message?: string;
}

export async function GET(): Promise<NextResponse<BuildResponse>> {
  const info = readBuildManifest();

  if (!info) {
    return NextResponse.json({
      available: false,
      message:
        "No build manifest found. The MCP server falls back to environment variables when " +
        "config/builds.json is absent, so paths shown elsewhere may not match what tools read.",
    });
  }

  const { activeBuild, builds, manifestPath } = info;
  const dataPaths = checkDataPaths(activeBuild);

  return NextResponse.json({
    available: true,
    activeBuild: {
      id: activeBuild.id,
      build: activeBuild.build,
      expansion: activeBuild.expansion,
      status: activeBuild.status,
      db2Format: activeBuild.db2Format,
      opcodeTable: activeBuild.opcodeTable,
      cacheDir: activeBuild.cacheDir,
    },
    otherBuilds: builds
      .filter((b) => b.id !== activeBuild.id)
      .map((b) => ({ id: b.id, build: b.build, expansion: b.expansion, status: b.status })),
    dataPaths,
    missingPaths: dataPaths.filter((p) => !p.exists).map((p) => `${p.kind}: ${p.path}`),
    manifestPath,
  });
}
