/**
 * Configuration API Routes
 *
 * Endpoints for managing TrinityCore MCP configuration.
 *
 * GET /api/config - Get current configuration
 * POST /api/config - Update configuration
 */

import { NextRequest, NextResponse } from "next/server";

// Mock configuration manager (in production, this would import from the actual config manager)
// For now, we'll use a simple in-memory configuration store

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

// Default configuration
let currentConfig: TrinityMCPConfig = {
  database: {
    host: process.env.TRINITY_DB_HOST || process.env.DB_HOST || "localhost",
    port: parseInt(process.env.TRINITY_DB_PORT || process.env.DB_PORT || "3306"),
    user: process.env.TRINITY_DB_USER || process.env.DB_USERNAME || "trinity",
    password: process.env.TRINITY_DB_PASSWORD || process.env.DB_PASSWORD || "",
    world: process.env.TRINITY_DB_WORLD || process.env.DB_WORLD_DATABASE || "world",
    auth: process.env.TRINITY_DB_AUTH || process.env.DB_AUTH_DATABASE || "auth",
    characters: process.env.TRINITY_DB_CHARACTERS || process.env.DB_CHARACTERS_DATABASE || "characters",
  },
  dataPaths: {
    trinityRoot: process.env.TRINITY_ROOT || "./",
    gtPath: process.env.GT_PATH || "./data/gt",
    dbcPath: process.env.DBC_PATH || "./data/dbc",
    db2Path: process.env.DB2_PATH || "./data/db2",
    vmapPath: process.env.VMAP_PATH || process.env.MAP_FILES_PATH || "./data/vmaps",
    mmapPath: process.env.MMAP_PATH || "./data/mmaps",
  },
  server: {
    port: parseInt(process.env.MCP_PORT || process.env.PORT || "3000"),
    host: process.env.MCP_HOST || "localhost",
    corsEnabled: true,
    corsOrigin: "*",
    maxConnections: 100,
  },
  websocket: {
    enabled: true,
    port: parseInt(process.env.WEBSOCKET_PORT || "3001"),
    maxClients: parseInt(process.env.WEBSOCKET_MAX_CLIENTS || "50"),
    heartbeatInterval: parseInt(process.env.WEBSOCKET_HEARTBEAT_INTERVAL || "30000"),
    timeoutMs: parseInt(process.env.WEBSOCKET_TIMEOUT_MS || "60000"),
    rateLimit: parseInt(process.env.WEBSOCKET_RATE_LIMIT || "100"),
  },
  testing: {
    enabled: process.env.TESTING_ENABLED === "true" || true,
    autoGenerateTests: process.env.TESTING_AUTO_GENERATE === "true" || false,
    coverageThreshold: parseInt(process.env.TESTING_COVERAGE_THRESHOLD || "80"),
    performanceBaselines: process.env.TESTING_PERFORMANCE_BASELINES === "true" || true,
  },
  logging: {
    level: (process.env.LOG_LEVEL as "debug" | "info" | "warn" | "error") || "info",
    console: process.env.LOG_CONSOLE !== "false",
    file: process.env.LOG_FILE !== "false",
    filePath: process.env.LOG_FILE_PATH || "./logs/trinity-mcp.log",
    maxFileSize: parseInt(process.env.LOG_MAX_FILE_SIZE || "10485760"), // 10MB
    maxFiles: parseInt(process.env.LOG_MAX_FILES || "5"),
  },
};

/**
 * Validate configuration
 */
function validateConfig(config: TrinityMCPConfig): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate database configuration
  if (!config.database.host) {
    errors.push("Database host is required");
  }
  if (config.database.port < 1 || config.database.port > 65535) {
    errors.push("Database port must be between 1 and 65535");
  }
  if (!config.database.user) {
    errors.push("Database user is required");
  }
  if (!config.database.password) {
    warnings.push("Database password is empty - connection may fail");
  }

  // Validate server configuration
  if (config.server.port < 1 || config.server.port > 65535) {
    errors.push("Server port must be between 1 and 65535");
  }
  if (config.server.maxConnections < 1) {
    errors.push("Max connections must be at least 1");
  }

  // Validate websocket configuration
  if (config.websocket.port < 1 || config.websocket.port > 65535) {
    errors.push("WebSocket port must be between 1 and 65535");
  }
  if (config.websocket.port === config.server.port) {
    errors.push("WebSocket port cannot be the same as server port");
  }
  if (config.websocket.maxClients < 1) {
    errors.push("Max WebSocket clients must be at least 1");
  }
  if (config.websocket.rateLimit < 1) {
    errors.push("Rate limit must be at least 1 event/sec");
  }

  // Validate testing configuration
  if (config.testing.coverageThreshold < 0 || config.testing.coverageThreshold > 100) {
    errors.push("Coverage threshold must be between 0 and 100");
  }

  // Validate logging configuration
  const validLogLevels = ["debug", "info", "warn", "error"];
  if (!validLogLevels.includes(config.logging.level)) {
    errors.push(`Log level must be one of: ${validLogLevels.join(", ")}`);
  }
  if (config.logging.maxFileSize < 1024) {
    warnings.push("Log file size is very small (< 1KB)");
  }
  if (config.logging.maxFiles < 1) {
    errors.push("Max log files must be at least 1");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * GET /api/config
 * Get current configuration
 */
export async function GET(request: NextRequest) {
  try {
    // Return current configuration (sanitized)
    const sanitizedConfig = {
      ...currentConfig,
      database: {
        ...currentConfig.database,
        password: currentConfig.database.password ? "••••••••" : "",
      },
    };

    return NextResponse.json({
      success: true,
      config: sanitizedConfig,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: `Failed to get configuration: ${(error as Error).message}`,
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/config
 * Update configuration
 */
export async function POST(request: NextRequest) {
  try {
    const updates = (await request.json()) as TrinityMCPConfig;

    // Merge updates with current config
    const newConfig = {
      database: { ...currentConfig.database, ...updates.database },
      dataPaths: { ...currentConfig.dataPaths, ...updates.dataPaths },
      server: { ...currentConfig.server, ...updates.server },
      websocket: { ...currentConfig.websocket, ...updates.websocket },
      testing: { ...currentConfig.testing, ...updates.testing },
      logging: { ...currentConfig.logging, ...updates.logging },
    };

    // Validate configuration
    const validation = validateConfig(newConfig);

    if (!validation.valid) {
      return NextResponse.json(
        {
          success: false,
          validation,
        },
        { status: 400 }
      );
    }

    // Update configuration
    currentConfig = newConfig;

    // In production, this would save to a file or database
    // For now, we just keep it in memory

    return NextResponse.json({
      success: true,
      validation,
      config: currentConfig,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: `Failed to update configuration: ${(error as Error).message}`,
      },
      { status: 500 }
    );
  }
}
