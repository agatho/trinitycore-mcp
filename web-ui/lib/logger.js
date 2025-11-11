"use strict";
/**
 * Centralized Logging System
 *
 * Provides structured logging with multiple severity levels,
 * context tracking, and optional error reporting integration.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.Logger = exports.LogLevel = void 0;
exports.getLogger = getLogger;
exports.resetLogger = resetLogger;
var LogLevel;
(function (LogLevel) {
    LogLevel[LogLevel["DEBUG"] = 0] = "DEBUG";
    LogLevel[LogLevel["INFO"] = 1] = "INFO";
    LogLevel[LogLevel["WARN"] = 2] = "WARN";
    LogLevel[LogLevel["ERROR"] = 3] = "ERROR";
    LogLevel[LogLevel["FATAL"] = 4] = "FATAL";
})(LogLevel || (exports.LogLevel = LogLevel = {}));
class LoggerService {
    config;
    logs = [];
    listeners = new Set();
    constructor(config = {}) {
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
    debug(context, message, metadata) {
        this.log(LogLevel.DEBUG, context, message, metadata);
    }
    /**
     * Log info message
     */
    info(context, message, metadata) {
        this.log(LogLevel.INFO, context, message, metadata);
    }
    /**
     * Log warning message
     */
    warn(context, message, metadata) {
        this.log(LogLevel.WARN, context, message, metadata);
    }
    /**
     * Log error
     */
    error(context, error, metadata) {
        const errorObj = typeof error === 'string' ? new Error(error) : error;
        const entry = {
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
    fatal(context, error, metadata) {
        const errorObj = typeof error === 'string' ? new Error(error) : error;
        const entry = {
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
    log(level, context, message, metadata) {
        if (level < this.config.minLevel)
            return;
        const entry = {
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
    processLog(entry) {
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
    outputToConsole(entry) {
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
    getLogs(options) {
        let filtered = [...this.logs];
        if (options?.level !== undefined) {
            filtered = filtered.filter(log => log.level >= options.level);
        }
        if (options?.context) {
            filtered = filtered.filter(log => log.context === options.context);
        }
        if (options?.since) {
            filtered = filtered.filter(log => log.timestamp >= options.since);
        }
        if (options?.limit) {
            filtered = filtered.slice(-options.limit);
        }
        return filtered;
    }
    /**
     * Get error logs only
     */
    getErrors(limit) {
        return this.getLogs({
            level: LogLevel.ERROR,
            limit,
        });
    }
    /**
     * Clear all logs
     */
    clearLogs() {
        this.logs = [];
        if (typeof window !== 'undefined') {
            localStorage.removeItem('trinitycore-logs');
        }
    }
    /**
     * Subscribe to log events
     */
    subscribe(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }
    /**
     * Notify listeners
     */
    notifyListeners(entry) {
        this.listeners.forEach(listener => listener(entry));
    }
    /**
     * Persist logs to local storage
     */
    persistLogsToStorage() {
        if (typeof window === 'undefined')
            return;
        try {
            // Only persist errors and fatal
            const importantLogs = this.logs.filter(log => log.level >= LogLevel.ERROR);
            const logsToStore = importantLogs.slice(-this.config.maxStoredLogs);
            localStorage.setItem('trinitycore-logs', JSON.stringify(logsToStore));
        }
        catch (error) {
            // Storage quota exceeded or disabled
            console.warn('Failed to persist logs:', error);
        }
    }
    /**
     * Load persisted logs from storage
     */
    loadPersistedLogs() {
        if (typeof window === 'undefined')
            return;
        try {
            const stored = localStorage.getItem('trinitycore-logs');
            if (stored) {
                const logs = JSON.parse(stored);
                this.logs.push(...logs);
            }
        }
        catch (error) {
            console.warn('Failed to load persisted logs:', error);
        }
    }
    /**
     * Export logs as JSON
     */
    exportLogs() {
        return JSON.stringify(this.logs, null, 2);
    }
    /**
     * Get log statistics
     */
    getStats() {
        const byLevel = {
            [LogLevel.DEBUG]: 0,
            [LogLevel.INFO]: 0,
            [LogLevel.WARN]: 0,
            [LogLevel.ERROR]: 0,
            [LogLevel.FATAL]: 0,
        };
        const contextSet = new Set();
        for (const log of this.logs) {
            byLevel[log.level]++;
            contextSet.add(log.context);
        }
        // Count errors in last hour
        const oneHourAgo = Date.now() - 3600000;
        const recentErrors = this.logs.filter(log => log.level >= LogLevel.ERROR && log.timestamp >= oneHourAgo).length;
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
    setConfig(config) {
        this.config = { ...this.config, ...config };
    }
}
// Singleton instance
let loggerInstance = null;
function getLogger() {
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
function resetLogger() {
    if (loggerInstance) {
        loggerInstance.clearLogs();
    }
    loggerInstance = null;
}
// Convenience exports
exports.Logger = {
    debug: (context, message, metadata) => getLogger().debug(context, message, metadata),
    info: (context, message, metadata) => getLogger().info(context, message, metadata),
    warn: (context, message, metadata) => getLogger().warn(context, message, metadata),
    error: (context, error, metadata) => getLogger().error(context, error, metadata),
    fatal: (context, error, metadata) => getLogger().fatal(context, error, metadata),
    getLogs: (options) => getLogger().getLogs(options),
    getErrors: (limit) => getLogger().getErrors(limit),
    subscribe: (listener) => getLogger().subscribe(listener),
    exportLogs: () => getLogger().exportLogs(),
    clear: () => getLogger().clearLogs(),
    getStats: () => getLogger().getStats(),
    configure: (config) => getLogger().setConfig(config),
    reset: () => resetLogger(),
};
exports.default = exports.Logger;
//# sourceMappingURL=logger.js.map