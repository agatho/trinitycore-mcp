/**
 * Centralized Logging System
 *
 * Provides structured logging with multiple severity levels,
 * context tracking, and optional error reporting integration.
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  FATAL = 4,
}

export interface LogEntry {
  level: LogLevel;
  timestamp: number;
  context: string;
  message: string;
  metadata?: any;
  error?: Error;
  stack?: string;
}

export interface LoggerConfig {
  /** Minimum log level to output */
  minLevel: LogLevel;

  /** Enable console output */
  enableConsole: boolean;

  /** Enable local storage persistence */
  persistLogs: boolean;

  /** Maximum log entries to store */
  maxStoredLogs: number;

  /** Error reporting callback (e.g., Sentry) */
  onError?: (entry: LogEntry) => void;
}

class LoggerService {
  private config: LoggerConfig;
  private logs: LogEntry[] = [];
  private listeners: Set<(entry: LogEntry) => void> = new Set();

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = {
      minLevel: config.minLevel ?? LogLevel.INFO,
      enableConsole: config.enableConsole ?? true,
      persistLogs: config.persistLogs ?? true,
      maxStoredLogs: config.maxStoredLogs ?? 1000,
      onError: config.onError,
    };

    // Load persisted logs
    if (this.config.persistLogs && typeof window !== 'undefined') {
      this.loadPersistedLogs();
    }
  }

  /**
   * Log debug message
   */
  debug(context: string, message: string, metadata?: any): void {
    this.log(LogLevel.DEBUG, context, message, metadata);
  }

  /**
   * Log info message
   */
  info(context: string, message: string, metadata?: any): void {
    this.log(LogLevel.INFO, context, message, metadata);
  }

  /**
   * Log warning message
   */
  warn(context: string, message: string, metadata?: any): void {
    this.log(LogLevel.WARN, context, message, metadata);
  }

  /**
   * Log error
   */
  error(context: string, error: Error | string, metadata?: any): void {
    const errorObj = typeof error === 'string' ? new Error(error) : error;

    const entry: LogEntry = {
      level: LogLevel.ERROR,
      timestamp: Date.now(),
      context,
      message: errorObj.message,
      metadata,
      error: errorObj,
      stack: errorObj.stack,
    };

    this.processLog(entry);
  }

  /**
   * Log fatal error (application crash)
   */
  fatal(context: string, error: Error | string, metadata?: any): void {
    const errorObj = typeof error === 'string' ? new Error(error) : error;

    const entry: LogEntry = {
      level: LogLevel.FATAL,
      timestamp: Date.now(),
      context,
      message: errorObj.message,
      metadata,
      error: errorObj,
      stack: errorObj.stack,
    };

    this.processLog(entry);
  }

  /**
   * Generic log method
   */
  private log(level: LogLevel, context: string, message: string, metadata?: any): void {
    if (level < this.config.minLevel) return;

    const entry: LogEntry = {
      level,
      timestamp: Date.now(),
      context,
      message,
      metadata,
    };

    this.processLog(entry);
  }

  /**
   * Process log entry
   */
  private processLog(entry: LogEntry): void {
    // Store in memory
    this.logs.push(entry);
    if (this.logs.length > this.config.maxStoredLogs) {
      this.logs.shift();
    }

    // Persist to storage (only ERROR and FATAL)
    if (this.config.persistLogs && entry.level >= LogLevel.ERROR) {
      this.persistLogsToStorage();
    }

    // Output to console
    if (this.config.enableConsole) {
      this.outputToConsole(entry);
    }

    // Notify listeners
    this.notifyListeners(entry);

    // Call error reporting callback for ERROR and FATAL
    if (this.config.onError && entry.level >= LogLevel.ERROR) {
      this.config.onError(entry);
    }
  }

  /**
   * Output to browser console
   */
  private outputToConsole(entry: LogEntry): void {
    const timestamp = new Date(entry.timestamp).toISOString();
    const prefix = `[${timestamp}] [${LogLevel[entry.level]}] [${entry.context}]`;
    const message = `${prefix} ${entry.message}`;

    switch (entry.level) {
      case LogLevel.DEBUG:
        console.debug(message, entry.metadata);
        break;
      case LogLevel.INFO:
        console.info(message, entry.metadata);
        break;
      case LogLevel.WARN:
        console.warn(message, entry.metadata);
        break;
      case LogLevel.ERROR:
      case LogLevel.FATAL:
        console.error(message, entry.error || entry.metadata);
        if (entry.stack) {
          console.error(entry.stack);
        }
        break;
    }
  }

  /**
   * Get all logs
   */
  getLogs(options?: {
    level?: LogLevel;
    context?: string;
    since?: number;
    limit?: number;
  }): LogEntry[] {
    let filtered = [...this.logs];

    if (options?.level !== undefined) {
      filtered = filtered.filter(log => log.level >= options.level!);
    }

    if (options?.context) {
      filtered = filtered.filter(log => log.context === options.context);
    }

    if (options?.since) {
      filtered = filtered.filter(log => log.timestamp >= options.since!);
    }

    if (options?.limit) {
      filtered = filtered.slice(-options.limit);
    }

    return filtered;
  }

  /**
   * Get error logs only
   */
  getErrors(limit?: number): LogEntry[] {
    return this.getLogs({
      level: LogLevel.ERROR,
      limit,
    });
  }

  /**
   * Clear all logs
   */
  clearLogs(): void {
    this.logs = [];
    if (typeof window !== 'undefined') {
      localStorage.removeItem('trinitycore-logs');
    }
  }

  /**
   * Subscribe to log events
   */
  subscribe(listener: (entry: LogEntry) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Notify listeners
   */
  private notifyListeners(entry: LogEntry): void {
    this.listeners.forEach(listener => listener(entry));
  }

  /**
   * Persist logs to local storage
   */
  private persistLogsToStorage(): void {
    if (typeof window === 'undefined') return;

    try {
      // Only persist errors and fatal
      const importantLogs = this.logs.filter(
        log => log.level >= LogLevel.ERROR
      );

      const logsToStore = importantLogs.slice(-this.config.maxStoredLogs);
      localStorage.setItem('trinitycore-logs', JSON.stringify(logsToStore));
    } catch (error) {
      // Storage quota exceeded or disabled
      console.warn('Failed to persist logs:', error);
    }
  }

  /**
   * Load persisted logs from storage
   */
  private loadPersistedLogs(): void {
    if (typeof window === 'undefined') return;

    try {
      const stored = localStorage.getItem('trinitycore-logs');
      if (stored) {
        const logs = JSON.parse(stored) as LogEntry[];
        this.logs.push(...logs);
      }
    } catch (error) {
      console.warn('Failed to load persisted logs:', error);
    }
  }

  /**
   * Export logs as JSON
   */
  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }

  /**
   * Get log statistics
   */
  getStats(): {
    total: number;
    byLevel: Record<number, number>;
    contexts: string[];
    recentErrors: number;
  } {
    const byLevel: Record<number, number> = {
      [LogLevel.DEBUG]: 0,
      [LogLevel.INFO]: 0,
      [LogLevel.WARN]: 0,
      [LogLevel.ERROR]: 0,
      [LogLevel.FATAL]: 0,
    };
    const contextSet = new Set<string>();

    for (const log of this.logs) {
      byLevel[log.level]++;
      contextSet.add(log.context);
    }

    // Count errors in last hour
    const oneHourAgo = Date.now() - 3600000;
    const recentErrors = this.logs.filter(
      log => log.level >= LogLevel.ERROR && log.timestamp >= oneHourAgo
    ).length;

    return {
      total: this.logs.length,
      byLevel,
      contexts: Array.from(contextSet),
      recentErrors,
    };
  }

  /**
   * Update configuration
   */
  setConfig(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

// Singleton instance
let loggerInstance: LoggerService | null = null;

export function getLogger(): LoggerService {
  if (!loggerInstance) {
    loggerInstance = new LoggerService({
      minLevel: process.env.NODE_ENV === 'production' ? LogLevel.INFO : LogLevel.DEBUG,
      enableConsole: true,
      persistLogs: true,
    });
  }
  return loggerInstance;
}

/**
 * Reset logger instance (for testing)
 */
export function resetLogger(): void {
  if (loggerInstance) {
    loggerInstance.clearLogs();
  }
  loggerInstance = null;
}

// Convenience exports
export const Logger = {
  debug: (context: string, message: string, metadata?: any) =>
    getLogger().debug(context, message, metadata),
  info: (context: string, message: string, metadata?: any) =>
    getLogger().info(context, message, metadata),
  warn: (context: string, message: string, metadata?: any) =>
    getLogger().warn(context, message, metadata),
  error: (context: string, error: Error | string, metadata?: any) =>
    getLogger().error(context, error, metadata),
  fatal: (context: string, error: Error | string, metadata?: any) =>
    getLogger().fatal(context, error, metadata),
  getLogs: (options?: {
    level?: LogLevel;
    context?: string;
    since?: number;
    limit?: number;
  }) => getLogger().getLogs(options),
  getErrors: (limit?: number) => getLogger().getErrors(limit),
  subscribe: (listener: (entry: LogEntry) => void) => getLogger().subscribe(listener),
  exportLogs: () => getLogger().exportLogs(),
  clear: () => getLogger().clearLogs(),
  getStats: () => getLogger().getStats(),
  configure: (config: Partial<LoggerConfig>) => getLogger().setConfig(config),
  reset: () => resetLogger(),
};

export default Logger;
