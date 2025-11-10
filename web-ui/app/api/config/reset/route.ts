/**
 * Configuration Reset API Route
 *
 * POST /api/config/reset - Reset configuration to defaults
 */

import { NextRequest, NextResponse } from "next/server";

interface DatabaseConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  world: string;
  auth: string;
  characters: string;
}

interface DataPathsConfig {
  trinityRoot: string;
  wowPath: string;
  gtPath: string;
  dbcPath: string;
  db2Path: string;
  vmapPath: string;
  mmapPath: string;
}

interface ServerConfig {
  port: number;
  host: string;
  corsEnabled: boolean;
  corsOrigin: string;
  maxConnections: number;
}

interface WebSocketConfig {
  enabled: boolean;
  port: number;
  maxClients: number;
  heartbeatInterval: number;
  timeoutMs: number;
  rateLimit: number;
}

interface TestingConfig {
  enabled: boolean;
  autoGenerateTests: boolean;
  coverageThreshold: number;
  performanceBaselines: boolean;
}

interface LoggingConfig {
  level: "debug" | "info" | "warn" | "error";
  console: boolean;
  file: boolean;
  filePath: string;
  maxFileSize: number;
  maxFiles: number;
}

interface TrinityMCPConfig {
  database: DatabaseConfig;
  dataPaths: DataPathsConfig;
  server: ServerConfig;
  websocket: WebSocketConfig;
  testing: TestingConfig;
  logging: LoggingConfig;
}

// Default configuration (same as in route.ts)
const DEFAULT_CONFIG: TrinityMCPConfig = {
  database: {
    host: process.env.TRINITY_DB_HOST || "localhost",
    port: parseInt(process.env.TRINITY_DB_PORT || "3306"),
    user: process.env.TRINITY_DB_USER || "trinity",
    password: process.env.TRINITY_DB_PASSWORD || "",
    world: process.env.TRINITY_DB_WORLD || "world",
    auth: process.env.TRINITY_DB_AUTH || "auth",
    characters: process.env.TRINITY_DB_CHARACTERS || "characters",
  },
  dataPaths: {
    trinityRoot: process.env.TRINITY_ROOT || "./",
    wowPath: process.env.WOW_PATH || "",
    gtPath: process.env.GT_PATH || "./data/gt",
    dbcPath: process.env.DBC_PATH || "./data/dbc",
    db2Path: process.env.DB2_PATH || "./data/db2",
    vmapPath: process.env.VMAP_PATH || "./data/vmaps",
    mmapPath: process.env.MMAP_PATH || "./data/mmaps",
  },
  server: {
    port: parseInt(process.env.MCP_PORT || "3000"),
    host: process.env.MCP_HOST || "localhost",
    corsEnabled: true,
    corsOrigin: "*",
    maxConnections: 100,
  },
  websocket: {
    enabled: true,
    port: 3001,
    maxClients: 50,
    heartbeatInterval: 30000,
    timeoutMs: 60000,
    rateLimit: 100,
  },
  testing: {
    enabled: true,
    autoGenerateTests: false,
    coverageThreshold: 80,
    performanceBaselines: true,
  },
  logging: {
    level: "info",
    console: true,
    file: true,
    filePath: "./logs/trinity-mcp.log",
    maxFileSize: 10485760, // 10MB
    maxFiles: 5,
  },
};

/**
 * POST /api/config/reset
 * Reset configuration to defaults
 */
export async function POST(request: NextRequest) {
  try {
    // Reset to default configuration
    const resetConfig = { ...DEFAULT_CONFIG };

    // Return sanitized configuration
    const sanitizedConfig = {
      ...resetConfig,
      database: {
        ...resetConfig.database,
        password: resetConfig.database.password ? "••••••••" : "",
      },
    };

    return NextResponse.json({
      success: true,
      config: sanitizedConfig,
      message: "Configuration reset to defaults",
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: `Failed to reset configuration: ${(error as Error).message}`,
      },
      { status: 500 }
    );
  }
}
