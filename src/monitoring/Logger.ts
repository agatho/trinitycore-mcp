/**
 * Logger.ts
 *
 * Structured logging system for TrinityCore MCP Server
 * Provides JSON-formatted logs with contextual information
 *
 * Features:
 * - Multiple log levels (DEBUG, INFO, WARN, ERROR, FATAL)
 * - Structured JSON output
 * - Request correlation via trace IDs
 * - Performance timing
 * - Error stack traces
 * - Log rotation support
 * - Contextual metadata
 *
 * @module monitoring/Logger
 */

import * as fs from 'fs';
import * as path from 'path';
import { getMetricsExporter } from './MetricsExporter';

/**
 * Log levels enumeration
 */
export enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3,
    FATAL = 4,
}

/**
 * Log level names mapping
 */
const LOG_LEVEL_NAMES: { [key in LogLevel]: string } = {
    [LogLevel.DEBUG]: 'DEBUG',
    [LogLevel.INFO]: 'INFO',
    [LogLevel.WARN]: 'WARN',
    [LogLevel.ERROR]: 'ERROR',
    [LogLevel.FATAL]: 'FATAL',
};

/**
 * Log entry interface
 */
export interface LogEntry {
    timestamp: string;
    level: string;
    message: string;
    traceId?: string;
    service: string;
    environment: string;
    metadata?: any;
    error?: {
        name: string;
        message: string;
        stack?: string;
    };
    performance?: {
        duration_ms: number;
        operation: string;
    };
}

/**
 * Logger configuration
 */
export interface LoggerConfig {
    service?: string;
    environment?: string;
    minLevel?: LogLevel;
    enableConsole?: boolean;
    enableFile?: boolean;
    logDirectory?: string;
    maxFileSize?: number; // in bytes
    maxFiles?: number;
    enableMetrics?: boolean;
}

/**
 * Logger class
 * Provides structured logging with multiple outputs
 */
export class Logger {
    private config: Required<LoggerConfig>;
    private currentLogFile: string | null = null;
    private currentLogStream: fs.WriteStream | null = null;
    private logFileSize: number = 0;

    constructor(config: LoggerConfig = {}) {
        this.config = {
            service: config.service || 'trinitycore-mcp',
            environment: config.environment || process.env.NODE_ENV || 'development',
            minLevel: config.minLevel !== undefined ? config.minLevel : LogLevel.INFO,
            enableConsole: config.enableConsole !== undefined ? config.enableConsole : true,
            enableFile: config.enableFile !== undefined ? config.enableFile : true,
            logDirectory: config.logDirectory || path.join(process.cwd(), 'logs'),
            maxFileSize: config.maxFileSize || 100 * 1024 * 1024, // 100MB default
            maxFiles: config.maxFiles || 10,
            enableMetrics: config.enableMetrics !== undefined ? config.enableMetrics : true,
        };

        // Ensure log directory exists
        if (this.config.enableFile) {
            this.ensureLogDirectory();
            this.initializeLogFile();
        }
    }

    /**
     * Ensure log directory exists
     */
    private ensureLogDirectory(): void {
        if (!fs.existsSync(this.config.logDirectory)) {
            fs.mkdirSync(this.config.logDirectory, { recursive: true });
        }
    }

    /**
     * Initialize log file
     */
    private initializeLogFile(): void {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        this.currentLogFile = path.join(
            this.config.logDirectory,
            `${this.config.service}-${timestamp}.log`
        );

        this.currentLogStream = fs.createWriteStream(this.currentLogFile, { flags: 'a' });
        this.logFileSize = 0;
    }

    /**
     * Rotate log file if needed
     */
    private rotateLogFileIfNeeded(): void {
        if (!this.config.enableFile || !this.currentLogFile) return;

        if (this.logFileSize >= this.config.maxFileSize) {
            // Close current stream
            if (this.currentLogStream) {
                this.currentLogStream.end();
            }

            // Initialize new log file
            this.initializeLogFile();

            // Clean up old log files
            this.cleanupOldLogFiles();
        }
    }

    /**
     * Clean up old log files
     */
    private cleanupOldLogFiles(): void {
        try {
            const files = fs.readdirSync(this.config.logDirectory)
                .filter(file => file.startsWith(this.config.service) && file.endsWith('.log'))
                .map(file => ({
                    name: file,
                    path: path.join(this.config.logDirectory, file),
                    mtime: fs.statSync(path.join(this.config.logDirectory, file)).mtime.getTime(),
                }))
                .sort((a, b) => b.mtime - a.mtime);

            // Keep only the most recent maxFiles files
            if (files.length > this.config.maxFiles) {
                const filesToDelete = files.slice(this.config.maxFiles);
                for (const file of filesToDelete) {
                    fs.unlinkSync(file.path);
                }
            }
        } catch (error) {
            // Silently fail on cleanup errors
            console.error('Failed to cleanup old log files:', error);
        }
    }

    /**
     * Create log entry
     */
    private createLogEntry(
        level: LogLevel,
        message: string,
        metadata?: any,
        error?: Error,
        traceId?: string
    ): LogEntry {
        const entry: LogEntry = {
            timestamp: new Date().toISOString(),
            level: LOG_LEVEL_NAMES[level],
            message,
            service: this.config.service,
            environment: this.config.environment,
        };

        if (traceId) {
            entry.traceId = traceId;
        }

        if (metadata) {
            entry.metadata = metadata;
        }

        if (error) {
            entry.error = {
                name: error.name,
                message: error.message,
                stack: error.stack,
            };
        }

        return entry;
    }

    /**
     * Write log entry
     */
    private writeLog(entry: LogEntry): void {
        const logLine = JSON.stringify(entry) + '\n';

        // Write to console
        if (this.config.enableConsole) {
            const coloredOutput = this.colorizeLogLevel(entry.level, logLine);
            if (entry.level === 'ERROR' || entry.level === 'FATAL') {
                console.error(coloredOutput);
            } else {
                console.log(coloredOutput);
            }
        }

        // Write to file
        if (this.config.enableFile && this.currentLogStream) {
            this.currentLogStream.write(logLine);
            this.logFileSize += Buffer.byteLength(logLine);
            this.rotateLogFileIfNeeded();
        }
    }

    /**
     * Colorize log level for console output
     */
    private colorizeLogLevel(level: string, message: string): string {
        const colors: { [key: string]: string } = {
            DEBUG: '\x1b[36m', // Cyan
            INFO: '\x1b[32m',  // Green
            WARN: '\x1b[33m',  // Yellow
            ERROR: '\x1b[31m', // Red
            FATAL: '\x1b[35m', // Magenta
        };

        const reset = '\x1b[0m';
        const color = colors[level] || '';

        return `${color}${message}${reset}`;
    }

    /**
     * Check if level should be logged
     */
    private shouldLog(level: LogLevel): boolean {
        return level >= this.config.minLevel;
    }

    /**
     * Debug log
     */
    public debug(message: string, metadata?: any, traceId?: string): void {
        if (!this.shouldLog(LogLevel.DEBUG)) return;

        const entry = this.createLogEntry(LogLevel.DEBUG, message, metadata, undefined, traceId);
        this.writeLog(entry);
    }

    /**
     * Info log
     */
    public info(message: string, metadata?: any, traceId?: string): void {
        if (!this.shouldLog(LogLevel.INFO)) return;

        const entry = this.createLogEntry(LogLevel.INFO, message, metadata, undefined, traceId);
        this.writeLog(entry);
    }

    /**
     * Warning log
     */
    public warn(message: string, metadata?: any, traceId?: string): void {
        if (!this.shouldLog(LogLevel.WARN)) return;

        const entry = this.createLogEntry(LogLevel.WARN, message, metadata, undefined, traceId);
        this.writeLog(entry);
    }

    /**
     * Error log
     */
    public error(message: string, error?: Error, metadata?: any, traceId?: string): void {
        if (!this.shouldLog(LogLevel.ERROR)) return;

        const entry = this.createLogEntry(LogLevel.ERROR, message, metadata, error, traceId);
        this.writeLog(entry);

        // Record error metric
        if (this.config.enableMetrics) {
            try {
                const metrics = getMetricsExporter();
                // Could add error metrics here if needed
            } catch (e) {
                // Ignore metrics errors
            }
        }
    }

    /**
     * Fatal log
     */
    public fatal(message: string, error?: Error, metadata?: any, traceId?: string): void {
        const entry = this.createLogEntry(LogLevel.FATAL, message, metadata, error, traceId);
        this.writeLog(entry);

        // Flush and close streams on fatal errors
        if (this.currentLogStream) {
            this.currentLogStream.end();
        }
    }

    /**
     * Log with performance timing
     */
    public performance(
        level: LogLevel,
        operation: string,
        duration: number,
        message?: string,
        metadata?: any,
        traceId?: string
    ): void {
        if (!this.shouldLog(level)) return;

        const entry = this.createLogEntry(
            level,
            message || `Operation ${operation} completed`,
            metadata,
            undefined,
            traceId
        );

        entry.performance = {
            duration_ms: duration,
            operation,
        };

        this.writeLog(entry);
    }

    /**
     * Create a child logger with trace ID
     */
    public child(traceId: string): ChildLogger {
        return new ChildLogger(this, traceId);
    }

    /**
     * Query logs from file
     */
    public async queryLogs(options: {
        level?: string;
        startTime?: Date;
        endTime?: Date;
        traceId?: string;
        limit?: number;
    }): Promise<LogEntry[]> {
        if (!this.config.enableFile) {
            throw new Error('File logging is not enabled');
        }

        const results: LogEntry[] = [];
        const logFiles = fs.readdirSync(this.config.logDirectory)
            .filter(file => file.startsWith(this.config.service) && file.endsWith('.log'))
            .map(file => path.join(this.config.logDirectory, file))
            .sort((a, b) => {
                const statA = fs.statSync(a);
                const statB = fs.statSync(b);
                return statB.mtime.getTime() - statA.mtime.getTime();
            });

        for (const logFile of logFiles) {
            const content = fs.readFileSync(logFile, 'utf-8');
            const lines = content.split('\n').filter(line => line.trim());

            for (const line of lines) {
                try {
                    const entry: LogEntry = JSON.parse(line);

                    // Apply filters
                    if (options.level && entry.level !== options.level) continue;
                    if (options.traceId && entry.traceId !== options.traceId) continue;
                    if (options.startTime && new Date(entry.timestamp) < options.startTime) continue;
                    if (options.endTime && new Date(entry.timestamp) > options.endTime) continue;

                    results.push(entry);

                    // Check limit
                    if (options.limit && results.length >= options.limit) {
                        return results;
                    }
                } catch (e) {
                    // Skip invalid JSON lines
                }
            }
        }

        return results;
    }

    /**
     * Get current log file path
     */
    public getCurrentLogFile(): string | null {
        return this.currentLogFile;
    }

    /**
     * Close logger and flush streams
     */
    public close(): void {
        if (this.currentLogStream) {
            this.currentLogStream.end();
            this.currentLogStream = null;
        }
    }
}

/**
 * Child logger with trace ID context
 */
export class ChildLogger {
    constructor(
        private parent: Logger,
        private traceId: string
    ) {}

    public debug(message: string, metadata?: any): void {
        this.parent.debug(message, metadata, this.traceId);
    }

    public info(message: string, metadata?: any): void {
        this.parent.info(message, metadata, this.traceId);
    }

    public warn(message: string, metadata?: any): void {
        this.parent.warn(message, metadata, this.traceId);
    }

    public error(message: string, error?: Error, metadata?: any): void {
        this.parent.error(message, error, metadata, this.traceId);
    }

    public fatal(message: string, error?: Error, metadata?: any): void {
        this.parent.fatal(message, error, metadata, this.traceId);
    }

    public performance(level: LogLevel, operation: string, duration: number, message?: string, metadata?: any): void {
        this.parent.performance(level, operation, duration, message, metadata, this.traceId);
    }
}

// Singleton instance
let logger: Logger | null = null;

/**
 * Get or create the singleton Logger instance
 */
export function getLogger(config?: LoggerConfig): Logger {
    if (!logger) {
        logger = new Logger(config);
    }
    return logger;
}

/**
 * Reset the singleton instance (for testing)
 */
export function resetLogger(): void {
    if (logger) {
        logger.close();
    }
    logger = null;
}
