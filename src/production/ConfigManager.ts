import * as fs from 'fs';
import * as path from 'path';
import { EventEmitter } from 'events';

/**
 * Configuration environment types
 */
export enum Environment {
  DEVELOPMENT = 'development',
  STAGING = 'staging',
  PRODUCTION = 'production',
  TEST = 'test'
}

/**
 * Configuration schema definition
 */
export interface ConfigSchema {
  [key: string]: {
    type: 'string' | 'number' | 'boolean' | 'object' | 'array';
    required?: boolean;
    default?: any;
    validation?: (value: any) => boolean;
    description?: string;
  };
}

/**
 * Configuration source types
 */
export enum ConfigSource {
  FILE = 'file',
  ENVIRONMENT = 'environment',
  REMOTE = 'remote',
  DEFAULT = 'default'
}

/**
 * Configuration entry with metadata
 */
interface ConfigEntry {
  value: any;
  source: ConfigSource;
  lastModified: Date;
  validated: boolean;
}

/**
 * Enterprise-grade configuration manager
 * Supports multiple environments, hot-reloading, validation, and encryption
 */
export class ConfigManager extends EventEmitter {
  private environment: Environment;
  private config: Map<string, ConfigEntry> = new Map();
  private schema: ConfigSchema;
  private configPaths: string[] = [];
  private watchHandles: fs.FSWatcher[] = [];
  private encryptedKeys: Set<string> = new Set();

  constructor(
    environment: Environment = Environment.DEVELOPMENT,
    schema: ConfigSchema = {}
  ) {
    super();
    this.environment = environment;
    this.schema = schema;
    this.loadDefaultConfig();
  }

  /**
   * Load default configuration from schema
   */
  private loadDefaultConfig(): void {
    for (const [key, def] of Object.entries(this.schema)) {
      if (def.default !== undefined) {
        this.config.set(key, {
          value: def.default,
          source: ConfigSource.DEFAULT,
          lastModified: new Date(),
          validated: true
        });
      }
    }
  }

  /**
   * Load configuration from file
   */
  public async loadFromFile(filePath: string): Promise<void> {
    try {
      const absolutePath = path.resolve(filePath);
      
      if (!fs.existsSync(absolutePath)) {
        throw new Error(`Configuration file not found: ${absolutePath}`);
      }

      const fileContent = fs.readFileSync(absolutePath, 'utf8');
      const configData = JSON.parse(fileContent);

      // Load environment-specific config if exists
      const envConfig = configData[this.environment] || configData;

      for (const [key, value] of Object.entries(envConfig)) {
        this.set(key, value, ConfigSource.FILE);
      }

      this.configPaths.push(absolutePath);
      this.emit('config-loaded', { path: absolutePath, environment: this.environment });
    } catch (error) {
      this.emit('config-error', { path: filePath, error });
      throw error;
    }
  }

  /**
   * Load configuration from environment variables
   */
  public loadFromEnvironment(prefix: string = 'TRINITY_'): void {
    for (const [key, value] of Object.entries(process.env)) {
      if (key.startsWith(prefix)) {
        const configKey = key.substring(prefix.length).toLowerCase();
        const parsedValue = this.parseEnvironmentValue(value!);
        this.set(configKey, parsedValue, ConfigSource.ENVIRONMENT);
      }
    }
    this.emit('environment-loaded', { prefix });
  }

  /**
   * Parse environment variable value
   */
  private parseEnvironmentValue(value: string): any {
    // Try to parse as JSON
    try {
      return JSON.parse(value);
    } catch {
      // Return as string if not valid JSON
      return value;
    }
  }

  /**
   * Set configuration value
   */
  public set(
    key: string,
    value: any,
    source: ConfigSource = ConfigSource.DEFAULT
  ): void {
    // Validate against schema if defined
    if (this.schema[key]) {
      const validation = this.validateValue(key, value);
      if (!validation.valid) {
        throw new Error(`Invalid configuration value for ${key}: ${validation.error}`);
      }
    }

    const oldValue = this.config.get(key)?.value;
    
    this.config.set(key, {
      value,
      source,
      lastModified: new Date(),
      validated: true
    });

    if (oldValue !== value) {
      this.emit('config-changed', { key, oldValue, newValue: value, source });
    }
  }

  /**
   * Get configuration value
   */
  public get<T = any>(key: string, defaultValue?: T): T {
    const entry = this.config.get(key);
    if (entry) {
      return entry.value as T;
    }
    return defaultValue as T;
  }

  /**
   * Get all configuration
   */
  public getAll(): Record<string, any> {
    const result: Record<string, any> = {};
    for (const [key, entry] of this.config.entries()) {
      result[key] = entry.value;
    }
    return result;
  }

  /**
   * Check if configuration key exists
   */
  public has(key: string): boolean {
    return this.config.has(key);
  }

  /**
   * Delete configuration key
   */
  public delete(key: string): boolean {
    const deleted = this.config.delete(key);
    if (deleted) {
      this.emit('config-deleted', { key });
    }
    return deleted;
  }

  /**
   * Validate configuration value against schema
   */
  private validateValue(key: string, value: any): { valid: boolean; error?: string } {
    const def = this.schema[key];
    if (!def) {
      return { valid: true };
    }

    // Type validation
    const actualType = Array.isArray(value) ? 'array' : typeof value;
    if (actualType !== def.type) {
      return { 
        valid: false, 
        error: `Expected type ${def.type}, got ${actualType}` 
      };
    }

    // Custom validation
    if (def.validation && !def.validation(value)) {
      return { 
        valid: false, 
        error: 'Custom validation failed' 
      };
    }

    return { valid: true };
  }

  /**
   * Validate all configuration against schema
   */
  public validateAll(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check required fields
    for (const [key, def] of Object.entries(this.schema)) {
      if (def.required && !this.config.has(key)) {
        errors.push(`Required configuration missing: ${key}`);
      }
    }

    // Validate existing values
    for (const [key, entry] of this.config.entries()) {
      if (this.schema[key]) {
        const validation = this.validateValue(key, entry.value);
        if (!validation.valid) {
          errors.push(`${key}: ${validation.error}`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Watch configuration files for changes
   */
  public watchFiles(hotReload: boolean = true): void {
    for (const filePath of this.configPaths) {
      const watcher = fs.watch(filePath, async (eventType) => {
        if (eventType === 'change') {
          this.emit('config-file-changed', { path: filePath });
          
          if (hotReload) {
            try {
              await this.loadFromFile(filePath);
              this.emit('config-reloaded', { path: filePath });
            } catch (error) {
              this.emit('config-reload-error', { path: filePath, error });
            }
          }
        }
      });
      
      this.watchHandles.push(watcher);
    }
  }

  /**
   * Stop watching configuration files
   */
  public unwatchFiles(): void {
    for (const watcher of this.watchHandles) {
      watcher.close();
    }
    this.watchHandles = [];
  }

  /**
   * Get configuration metadata
   */
  public getMetadata(key: string): Omit<ConfigEntry, 'value'> | undefined {
    const entry = this.config.get(key);
    if (!entry) {
      return undefined;
    }

    return {
      source: entry.source,
      lastModified: entry.lastModified,
      validated: entry.validated
    };
  }

  /**
   * Export configuration to file
   */
  public exportToFile(filePath: string, pretty: boolean = true): void {
    const config = this.getAll();
    const content = pretty 
      ? JSON.stringify(config, null, 2)
      : JSON.stringify(config);
    
    fs.writeFileSync(filePath, content, 'utf8');
    this.emit('config-exported', { path: filePath });
  }

  /**
   * Merge configuration from another source
   */
  public merge(config: Record<string, any>, source: ConfigSource = ConfigSource.DEFAULT): void {
    for (const [key, value] of Object.entries(config)) {
      this.set(key, value, source);
    }
  }

  /**
   * Get environment
   */
  public getEnvironment(): Environment {
    return this.environment;
  }

  /**
   * Set environment
   */
  public setEnvironment(environment: Environment): void {
    const oldEnvironment = this.environment;
    this.environment = environment;
    this.emit('environment-changed', { oldEnvironment, newEnvironment: environment });
  }

  /**
   * Get configuration summary
   */
  public getSummary(): {
    environment: Environment;
    totalKeys: number;
    sources: Record<ConfigSource, number>;
    lastModified: Date;
  } {
    const sources: Record<ConfigSource, number> = {
      [ConfigSource.FILE]: 0,
      [ConfigSource.ENVIRONMENT]: 0,
      [ConfigSource.REMOTE]: 0,
      [ConfigSource.DEFAULT]: 0
    };

    let lastModified = new Date(0);

    for (const entry of this.config.values()) {
      sources[entry.source]++;
      if (entry.lastModified > lastModified) {
        lastModified = entry.lastModified;
      }
    }

    return {
      environment: this.environment,
      totalKeys: this.config.size,
      sources,
      lastModified
    };
  }

  /**
   * Mark key as encrypted
   */
  public markEncrypted(key: string): void {
    this.encryptedKeys.add(key);
  }

  /**
   * Check if key is encrypted
   */
  public isEncrypted(key: string): boolean {
    return this.encryptedKeys.has(key);
  }

  /**
   * Clone configuration manager
   */
  public clone(): ConfigManager {
    const clone = new ConfigManager(this.environment, this.schema);
    clone.merge(this.getAll());
    return clone;
  }

  /**
   * Reset to defaults
   */
  public reset(): void {
    this.config.clear();
    this.loadDefaultConfig();
    this.emit('config-reset');
  }

  /**
   * Shutdown configuration manager
   */
  public shutdown(): void {
    this.unwatchFiles();
    this.config.clear();
    this.emit('shutdown');
  }
}

/**
 * Global configuration manager instance
 */
let globalConfigManager: ConfigManager | null = null;

/**
 * Get or create global configuration manager
 */
export function getConfigManager(
  environment?: Environment,
  schema?: ConfigSchema
): ConfigManager {
  if (!globalConfigManager) {
    globalConfigManager = new ConfigManager(environment, schema);
  }
  return globalConfigManager;
}

/**
 * Set global configuration manager
 */
export function setConfigManager(manager: ConfigManager): void {
  globalConfigManager = manager;
}
