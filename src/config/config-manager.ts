/**
 * Configuration Manager
 *
 * Manages TrinityCore MCP server configuration with support for:
 * - Environment variable defaults
 * - Runtime configuration overrides
 * - Persistent configuration storage
 * - Configuration validation
 * - Hot-reload capabilities
 *
 * @module config-manager
 */

import fs from "fs/promises";
import path from "path";
import { EventEmitter } from "events";
import { logger } from '../utils/logger';

// ============================================================================
// Types
// ============================================================================

/**
 * Database configuration
 */
export interface DatabaseConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  world: string;
  auth: string;
  characters: string;
}

/**
 * Data paths configuration
 */
export interface DataPathsConfig {
  trinityRoot: string;
  wowPath: string;
  gtPath: string;
  dbcPath: string;
  db2Path: string;
  vmapPath: string;
  mmapPath: string;
}

/**
 * Server configuration
 */
export interface ServerConfig {
  port: number;
  host: string;
  corsEnabled: boolean;
  corsOrigin: string;
  maxConnections: number;
}

/**
 * WebSocket configuration
 */
export interface WebSocketConfig {
  enabled: boolean;
  port: number;
  maxClients: number;
  heartbeatInterval: number;
  timeoutMs: number;
  rateLimit: number;
}

/**
 * Testing configuration
 */
export interface TestingConfig {
  enabled: boolean;
  autoGenerateTests: boolean;
  coverageThreshold: number;
  performanceBaselines: boolean;
}

/**
 * Logging configuration
 */
export interface LoggingConfig {
  level: "debug" | "info" | "warn" | "error";
  console: boolean;
  file: boolean;
  filePath: string;
  maxFileSize: number;
  maxFiles: number;
}

/**
 * Complete configuration
 */
export interface TrinityMCPConfig {
  database: DatabaseConfig;
  dataPaths: DataPathsConfig;
  server: ServerConfig;
  websocket: WebSocketConfig;
  testing: TestingConfig;
  logging: LoggingConfig;
}

/**
 * Configuration validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_CONFIG: TrinityMCPConfig = {
  database: {
    host: "localhost",
    port: 3306,
    user: "trinity",
    password: "",
    world: "world",
    auth: "auth",
    characters: "characters",
  },
  dataPaths: {
    trinityRoot: "./",
    wowPath: "",
    gtPath: "./data/gt",
    dbcPath: "./data/dbc",
    db2Path: "./data/db2",
    vmapPath: "./data/vmaps",
    mmapPath: "./data/mmaps",
  },
  server: {
    port: 3000,
    host: "localhost",
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

// ============================================================================
// Configuration Manager
// ============================================================================

/**
 * Configuration manager with hot-reload and validation
 */
export class ConfigManager extends EventEmitter {
  private config: TrinityMCPConfig;
  private configPath: string;
  private envLoaded: boolean = false;

  constructor(configPath?: string) {
    super();
    this.configPath = configPath || path.join(process.cwd(), "config", "trinity-mcp.json");
    this.config = { ...DEFAULT_CONFIG };
  }

  /**
   * Initialize configuration
   * Loads from environment variables and config file
   */
  public async initialize(): Promise<void> {
    // Load from environment variables
    this.loadFromEnv();
    this.envLoaded = true;

    // Load from config file (overrides env)
    try {
      await this.loadFromFile();
    } catch (error) {
      // Config file doesn't exist yet, will be created on first save
      logger.info("No config file found, using defaults from .env");
    }

    this.emit("initialized", this.config);
  }

  /**
   * Load configuration from environment variables
   */
  private loadFromEnv(): void {
    // Database configuration
    if (process.env.TRINITY_DB_HOST) {
      this.config.database.host = process.env.TRINITY_DB_HOST;
    }
    if (process.env.TRINITY_DB_PORT) {
      this.config.database.port = parseInt(process.env.TRINITY_DB_PORT, 10);
    }
    if (process.env.TRINITY_DB_USER) {
      this.config.database.user = process.env.TRINITY_DB_USER;
    }
    if (process.env.TRINITY_DB_PASSWORD) {
      this.config.database.password = process.env.TRINITY_DB_PASSWORD;
    }
    if (process.env.TRINITY_DB_WORLD) {
      this.config.database.world = process.env.TRINITY_DB_WORLD;
    }
    if (process.env.TRINITY_DB_AUTH) {
      this.config.database.auth = process.env.TRINITY_DB_AUTH;
    }
    if (process.env.TRINITY_DB_CHARACTERS) {
      this.config.database.characters = process.env.TRINITY_DB_CHARACTERS;
    }

    // Data paths configuration
    if (process.env.TRINITY_ROOT) {
      this.config.dataPaths.trinityRoot = process.env.TRINITY_ROOT;
    }
    if (process.env.WOW_PATH) {
      this.config.dataPaths.wowPath = process.env.WOW_PATH;
    }
    if (process.env.GT_PATH) {
      this.config.dataPaths.gtPath = process.env.GT_PATH;
    }
    if (process.env.DBC_PATH) {
      this.config.dataPaths.dbcPath = process.env.DBC_PATH;
    }
    if (process.env.DB2_PATH) {
      this.config.dataPaths.db2Path = process.env.DB2_PATH;
    }
    if (process.env.VMAP_PATH) {
      this.config.dataPaths.vmapPath = process.env.VMAP_PATH;
    }
    if (process.env.MMAP_PATH) {
      this.config.dataPaths.mmapPath = process.env.MMAP_PATH;
    }

    // Server configuration
    if (process.env.MCP_PORT) {
      this.config.server.port = parseInt(process.env.MCP_PORT, 10);
    }
    if (process.env.MCP_HOST) {
      this.config.server.host = process.env.MCP_HOST;
    }
  }

  /**
   * Load configuration from file
   */
  private async loadFromFile(): Promise<void> {
    const content = await fs.readFile(this.configPath, "utf-8");
    const fileConfig = JSON.parse(content) as Partial<TrinityMCPConfig>;

    // Deep merge file config with current config
    this.config = this.deepMerge(this.config, fileConfig);
  }

  /**
   * Save configuration to file
   */
  public async save(): Promise<void> {
    // Ensure config directory exists
    const configDir = path.dirname(this.configPath);
    await fs.mkdir(configDir, { recursive: true });

    // Write config file
    await fs.writeFile(
      this.configPath,
      JSON.stringify(this.config, null, 2),
      "utf-8"
    );

    this.emit("saved", this.config);
  }

  /**
   * Get current configuration
   */
  public getConfig(): TrinityMCPConfig {
    return { ...this.config };
  }

  /**
   * Get specific configuration section
   */
  public getDatabase(): DatabaseConfig {
    return { ...this.config.database };
  }

  public getDataPaths(): DataPathsConfig {
    return { ...this.config.dataPaths };
  }

  public getServer(): ServerConfig {
    return { ...this.config.server };
  }

  public getWebSocket(): WebSocketConfig {
    return { ...this.config.websocket };
  }

  public getTesting(): TestingConfig {
    return { ...this.config.testing };
  }

  public getLogging(): LoggingConfig {
    return { ...this.config.logging };
  }

  /**
   * Update configuration
   */
  public async updateConfig(updates: Partial<TrinityMCPConfig>): Promise<ValidationResult> {
    // Validate updates
    const validation = this.validate(updates);
    if (!validation.valid) {
      return validation;
    }

    // Apply updates
    this.config = this.deepMerge(this.config, updates);

    // Save to file
    await this.save();

    this.emit("updated", this.config);

    return { valid: true, errors: [], warnings: validation.warnings };
  }

  /**
   * Update specific configuration section
   */
  public async updateDatabase(updates: Partial<DatabaseConfig>): Promise<ValidationResult> {
    return this.updateConfig({ database: { ...this.config.database, ...updates } });
  }

  public async updateDataPaths(updates: Partial<DataPathsConfig>): Promise<ValidationResult> {
    return this.updateConfig({ dataPaths: { ...this.config.dataPaths, ...updates } });
  }

  public async updateServer(updates: Partial<ServerConfig>): Promise<ValidationResult> {
    return this.updateConfig({ server: { ...this.config.server, ...updates } });
  }

  public async updateWebSocket(updates: Partial<WebSocketConfig>): Promise<ValidationResult> {
    return this.updateConfig({ websocket: { ...this.config.websocket, ...updates } });
  }

  public async updateTesting(updates: Partial<TestingConfig>): Promise<ValidationResult> {
    return this.updateConfig({ testing: { ...this.config.testing, ...updates } });
  }

  public async updateLogging(updates: Partial<LoggingConfig>): Promise<ValidationResult> {
    return this.updateConfig({ logging: { ...this.config.logging, ...updates } });
  }

  /**
   * Reset configuration to defaults
   */
  public async reset(): Promise<void> {
    this.config = { ...DEFAULT_CONFIG };
    this.loadFromEnv(); // Re-apply environment variables
    await this.save();
    this.emit("reset", this.config);
  }

  /**
   * Validate configuration
   */
  public validate(config?: Partial<TrinityMCPConfig>): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    const toValidate = config ? this.deepMerge(this.config, config) : this.config;

    // Validate database configuration
    if (!toValidate.database.host) {
      errors.push("Database host is required");
    }
    if (toValidate.database.port < 1 || toValidate.database.port > 65535) {
      errors.push("Database port must be between 1 and 65535");
    }
    if (!toValidate.database.user) {
      errors.push("Database user is required");
    }
    if (!toValidate.database.password && this.envLoaded) {
      warnings.push("Database password is empty - connection may fail");
    }

    // Validate server configuration
    if (toValidate.server.port < 1 || toValidate.server.port > 65535) {
      errors.push("Server port must be between 1 and 65535");
    }
    if (toValidate.server.maxConnections < 1) {
      errors.push("Max connections must be at least 1");
    }

    // Validate websocket configuration
    if (toValidate.websocket.port < 1 || toValidate.websocket.port > 65535) {
      errors.push("WebSocket port must be between 1 and 65535");
    }
    if (toValidate.websocket.port === toValidate.server.port) {
      errors.push("WebSocket port cannot be the same as server port");
    }
    if (toValidate.websocket.maxClients < 1) {
      errors.push("Max WebSocket clients must be at least 1");
    }
    if (toValidate.websocket.rateLimit < 1) {
      errors.push("Rate limit must be at least 1 event/sec");
    }

    // Validate testing configuration
    if (toValidate.testing.coverageThreshold < 0 || toValidate.testing.coverageThreshold > 100) {
      errors.push("Coverage threshold must be between 0 and 100");
    }

    // Validate logging configuration
    const validLogLevels = ["debug", "info", "warn", "error"];
    if (!validLogLevels.includes(toValidate.logging.level)) {
      errors.push(`Log level must be one of: ${validLogLevels.join(", ")}`);
    }
    if (toValidate.logging.maxFileSize < 1024) {
      warnings.push("Log file size is very small (< 1KB)");
    }
    if (toValidate.logging.maxFiles < 1) {
      errors.push("Max log files must be at least 1");
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Export configuration (sanitized, without sensitive data)
   */
  public exportConfig(): Partial<TrinityMCPConfig> {
    const exported = { ...this.config };

    // Remove sensitive data
    exported.database.password = "***REDACTED***";

    return exported;
  }

  /**
   * Deep merge two objects
   */
  private deepMerge<T extends Record<string, any>>(target: T, source: Partial<T>): T {
    const output = { ...target };

    for (const key in source) {
      const sourceValue = source[key];
      const targetValue = target[key as keyof T];

      if (
        sourceValue !== null &&
        typeof sourceValue === 'object' &&
        !Array.isArray(sourceValue) &&
        targetValue !== null &&
        typeof targetValue === 'object' &&
        !Array.isArray(targetValue)
      ) {
        output[key] = this.deepMerge(targetValue as any, sourceValue as any);
      } else {
        output[key] = sourceValue as any;
      }
    }

    return output;
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let configManagerInstance: ConfigManager | null = null;

/**
 * Get singleton configuration manager instance
 */
export function getConfigManager(): ConfigManager {
  if (!configManagerInstance) {
    configManagerInstance = new ConfigManager();
  }
  return configManagerInstance;
}

/**
 * Initialize configuration manager
 */
export async function initializeConfig(configPath?: string): Promise<ConfigManager> {
  if (!configManagerInstance) {
    configManagerInstance = new ConfigManager(configPath);
  }
  await configManagerInstance.initialize();
  return configManagerInstance;
}

// ============================================================================
// Exports
// ============================================================================

export default ConfigManager;
