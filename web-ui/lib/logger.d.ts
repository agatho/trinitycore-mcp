/**
 * Centralized Logging System
 *
 * Provides structured logging with multiple severity levels,
 * context tracking, and optional error reporting integration.
 */
export declare enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3,
    FATAL = 4
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
declare class LoggerService {
    private config;
    private logs;
    private listeners;
    constructor(config?: Partial<LoggerConfig>);
    /**
     * Log debug message
     */
    debug(context: string, message: string, metadata?: any): void;
    /**
     * Log info message
     */
    info(context: string, message: string, metadata?: any): void;
    /**
     * Log warning message
     */
    warn(context: string, message: string, metadata?: any): void;
    /**
     * Log error
     */
    error(context: string, error: Error | string, metadata?: any): void;
    /**
     * Log fatal error (application crash)
     */
    fatal(context: string, error: Error | string, metadata?: any): void;
    /**
     * Generic log method
     */
    private log;
    /**
     * Process log entry
     */
    private processLog;
    /**
     * Output to browser console
     */
    private outputToConsole;
    /**
     * Get all logs
     */
    getLogs(options?: {
        level?: LogLevel;
        context?: string;
        since?: number;
        limit?: number;
    }): LogEntry[];
    /**
     * Get error logs only
     */
    getErrors(limit?: number): LogEntry[];
    /**
     * Clear all logs
     */
    clearLogs(): void;
    /**
     * Subscribe to log events
     */
    subscribe(listener: (entry: LogEntry) => void): () => void;
    /**
     * Notify listeners
     */
    private notifyListeners;
    /**
     * Persist logs to local storage
     */
    private persistLogsToStorage;
    /**
     * Load persisted logs from storage
     */
    private loadPersistedLogs;
    /**
     * Export logs as JSON
     */
    exportLogs(): string;
    /**
     * Get log statistics
     */
    getStats(): {
        total: number;
        byLevel: Record<number, number>;
        contexts: string[];
        recentErrors: number;
    };
    /**
     * Update configuration
     */
    setConfig(config: Partial<LoggerConfig>): void;
}
export declare function getLogger(): LoggerService;
/**
 * Reset logger instance (for testing)
 */
export declare function resetLogger(): void;
export declare const Logger: {
    debug: (context: string, message: string, metadata?: any) => void;
    info: (context: string, message: string, metadata?: any) => void;
    warn: (context: string, message: string, metadata?: any) => void;
    error: (context: string, error: Error | string, metadata?: any) => void;
    fatal: (context: string, error: Error | string, metadata?: any) => void;
    getLogs: (options?: {
        level?: LogLevel;
        context?: string;
        since?: number;
        limit?: number;
    }) => LogEntry[];
    getErrors: (limit?: number) => LogEntry[];
    subscribe: (listener: (entry: LogEntry) => void) => () => void;
    exportLogs: () => string;
    clear: () => void;
    getStats: () => {
        total: number;
        byLevel: Record<number, number>;
        contexts: string[];
        recentErrors: number;
    };
    configure: (config: Partial<LoggerConfig>) => void;
    reset: () => void;
};
export default Logger;
//# sourceMappingURL=logger.d.ts.map