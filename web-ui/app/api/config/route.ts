/**
 * Configuration API Routes
 *
 * Endpoints for managing TrinityCore MCP configuration.
 *
 * GET /api/config - Get current configuration
 * GET /api/config?reload=true - Reload from .env.local and get configuration
 * POST /api/config - Update configuration
 * POST /api/config?persist=true - Update and persist to .env.local
 */

import { NextRequest, NextResponse } from "next/server";
import { readAllEnvFiles, writeAllEnvFiles, reloadEnvVars, envFileExists } from "@/lib/env-utils";

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

/**
 * Load configuration from environment variables
 */
function loadConfigFromEnv(): TrinityMCPConfig {
  return {
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
      corsEnabled: process.env.CORS_ENABLED !== "false",
      corsOrigin: process.env.CORS_ORIGIN || "*",
      maxConnections: parseInt(process.env.MAX_CONNECTIONS || "100"),
    },
    websocket: {
      enabled: process.env.WEBSOCKET_ENABLED !== "false",
      port: parseInt(process.env.WEBSOCKET_PORT || "3001"),
      maxClients: parseInt(process.env.WEBSOCKET_MAX_CLIENTS || "50"),
      heartbeatInterval: parseInt(process.env.WEBSOCKET_HEARTBEAT_INTERVAL || "30000"),
      timeoutMs: parseInt(process.env.WEBSOCKET_TIMEOUT_MS || "60000"),
      rateLimit: parseInt(process.env.WEBSOCKET_RATE_LIMIT || "100"),
    },
    testing: {
      enabled: process.env.TESTING_ENABLED !== "false",
      autoGenerateTests: process.env.TESTING_AUTO_GENERATE === "true",
      coverageThreshold: parseInt(process.env.TESTING_COVERAGE_THRESHOLD || "80"),
      performanceBaselines: process.env.TESTING_PERFORMANCE_BASELINES !== "false",
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
}

// Initialize config from environment
let currentConfig: TrinityMCPConfig = loadConfigFromEnv();

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
 * Convert config to environment variable format
 */
function configToEnvVars(config: TrinityMCPConfig): Record<string, string> {
  return {
    // Database
    DB_HOST: config.database.host,
    DB_PORT: config.database.port.toString(),
    DB_USERNAME: config.database.user,
    DB_PASSWORD: config.database.password,
    DB_WORLD_DATABASE: config.database.world,
    DB_AUTH_DATABASE: config.database.auth,
    DB_CHARACTERS_DATABASE: config.database.characters,

    // Data Paths
    TRINITY_ROOT: config.dataPaths.trinityRoot,
    GT_PATH: config.dataPaths.gtPath,
    DBC_PATH: config.dataPaths.dbcPath,
    DB2_PATH: config.dataPaths.db2Path,
    VMAP_PATH: config.dataPaths.vmapPath,
    MMAP_PATH: config.dataPaths.mmapPath,

    // Server
    MCP_HOST: config.server.host,
    MCP_PORT: config.server.port.toString(),
    CORS_ENABLED: config.server.corsEnabled.toString(),
    CORS_ORIGIN: config.server.corsOrigin,
    MAX_CONNECTIONS: config.server.maxConnections.toString(),

    // WebSocket
    WEBSOCKET_ENABLED: config.websocket.enabled.toString(),
    WEBSOCKET_PORT: config.websocket.port.toString(),
    WEBSOCKET_MAX_CLIENTS: config.websocket.maxClients.toString(),
    WEBSOCKET_HEARTBEAT_INTERVAL: config.websocket.heartbeatInterval.toString(),
    WEBSOCKET_TIMEOUT_MS: config.websocket.timeoutMs.toString(),
    WEBSOCKET_RATE_LIMIT: config.websocket.rateLimit.toString(),

    // Testing
    TESTING_ENABLED: config.testing.enabled.toString(),
    TESTING_AUTO_GENERATE: config.testing.autoGenerateTests.toString(),
    TESTING_COVERAGE_THRESHOLD: config.testing.coverageThreshold.toString(),
    TESTING_PERFORMANCE_BASELINES: config.testing.performanceBaselines.toString(),

    // Logging
    LOG_LEVEL: config.logging.level,
    LOG_CONSOLE: config.logging.console.toString(),
    LOG_FILE: config.logging.file.toString(),
    LOG_FILE_PATH: config.logging.filePath,
    LOG_MAX_FILE_SIZE: config.logging.maxFileSize.toString(),
    LOG_MAX_FILES: config.logging.maxFiles.toString(),
  };
}

/**
 * GET /api/config
 * Get current configuration
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const shouldReload = searchParams.get('reload') === 'true';
    const showPassword = searchParams.get('showPassword') === 'true';

    if (shouldReload) {
      // Reload environment variables from .env.local
      reloadEnvVars();
      // Reload config from environment
      currentConfig = loadConfigFromEnv();
    }

    // Return current configuration (optionally sanitized)
    const responseConfig = {
      ...currentConfig,
      database: {
        ...currentConfig.database,
        password: showPassword ? currentConfig.database.password : (currentConfig.database.password ? "••••••••" : ""),
      },
    };

    const envFiles = envFileExists();

    return NextResponse.json({
      success: true,
      config: responseConfig,
      envFileExists: envFiles.webUI || envFiles.mcpServer,
      envFiles: envFiles,
      reloaded: shouldReload,
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
    const searchParams = request.nextUrl.searchParams;
    const shouldPersist = searchParams.get('persist') === 'true';

    const updates = (await request.json()) as TrinityMCPConfig;

    // Handle password: if it's masked, keep the current password
    if (updates.database.password === "••••••••") {
      updates.database.password = currentConfig.database.password;
    }

    // Merge updates with current config
    const newConfig: TrinityMCPConfig = {
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

    // Persist to both .env files if requested
    if (shouldPersist) {
      try {
        const envVars = configToEnvVars(newConfig);
        writeAllEnvFiles(envVars);
      } catch (error) {
        return NextResponse.json(
          {
            success: false,
            error: `Configuration validated but failed to persist: ${(error as Error).message}`,
            validation,
          },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      validation,
      persisted: shouldPersist,
      message: shouldPersist
        ? "Configuration saved to both web-ui/.env.local and root .env files. Restart both services to apply changes."
        : "Configuration saved in memory. Changes will be lost on restart.",
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
