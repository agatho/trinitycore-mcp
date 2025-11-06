/**
 * Enterprise-Grade Logging Utility
 *
 * Production-ready logging system using Winston with:
 * - Structured JSON logging for production
 * - Pretty console logging for development
 * - Automatic log rotation
 * - Contextual logging for tools and database operations
 *
 * @module utils/logger
 */

import winston from 'winston';
import path from 'path';
import fs from 'fs';

const LOG_DIR = process.env.LOG_DIR || './logs';
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const NODE_ENV = process.env.NODE_ENV || 'development';

// Ensure log directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

/**
 * Main logger instance
 */
export const logger = winston.createLogger({
  level: LOG_LEVEL,
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'trinitycore-mcp' },
  transports: [
    // Error log - only errors
    new winston.transports.File({
      filename: path.join(LOG_DIR, 'error.log'),
      level: 'error',
      maxsize: 10485760, // 10MB
      maxFiles: 5,
      tailable: true
    }),
    // Combined log - all levels
    new winston.transports.File({
      filename: path.join(LOG_DIR, 'combined.log'),
      maxsize: 10485760, // 10MB
      maxFiles: 5,
      tailable: true
    }),
    // Warn log - warnings only
    new winston.transports.File({
      filename: path.join(LOG_DIR, 'warn.log'),
      level: 'warn',
      maxsize: 5242880, // 5MB
      maxFiles: 3,
      tailable: true
    })
  ],
  // Handle exceptions and rejections
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(LOG_DIR, 'exceptions.log'),
      maxsize: 10485760,
      maxFiles: 3
    })
  ],
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(LOG_DIR, 'rejections.log'),
      maxsize: 10485760,
      maxFiles: 3
    })
  ]
});

// Console logging in development with pretty formatting
if (NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.printf(({ level, message, timestamp, ...metadata }) => {
        let msg = `${timestamp} [${level}]: ${message}`;

        // Add metadata if present
        const metaKeys = Object.keys(metadata).filter(
          key => !['service', 'timestamp', 'level', 'message'].includes(key)
        );
        if (metaKeys.length > 0) {
          const metaStr = JSON.stringify(
            Object.fromEntries(metaKeys.map(key => [key, metadata[key]])),
            null,
            2
          );
          msg += `\n${metaStr}`;
        }

        return msg;
      })
    )
  }));
}

/**
 * Log database query execution
 *
 * @param query - SQL query string
 * @param params - Query parameters
 * @param duration - Execution duration in milliseconds
 */
export function logQuery(query: string, params: any[], duration: number): void {
  logger.debug('Database query executed', {
    query: query.substring(0, 200), // Truncate long queries
    params: JSON.stringify(params).substring(0, 100),
    duration,
    type: 'database',
    durationMs: duration
  });

  // Warn on slow queries (>1000ms)
  if (duration > 1000) {
    logger.warn('Slow database query detected', {
      query: query.substring(0, 200),
      duration,
      type: 'database-slow'
    });
  }
}

/**
 * Log MCP tool execution
 *
 * @param toolName - Name of the MCP tool
 * @param args - Tool arguments
 * @param duration - Execution duration in milliseconds
 * @param success - Whether execution succeeded
 * @param error - Error if execution failed
 */
export function logToolExecution(
  toolName: string,
  args: any,
  duration: number,
  success: boolean,
  error?: Error
): void {
  const logData = {
    toolName,
    args: JSON.stringify(args).substring(0, 200),
    duration,
    success,
    type: 'mcp-tool',
    durationMs: duration
  };

  if (success) {
    logger.info('MCP tool executed successfully', logData);
  } else {
    logger.error('MCP tool execution failed', {
      ...logData,
      error: error?.message,
      stack: error?.stack
    });
  }

  // Warn on slow tool execution (>5000ms)
  if (duration > 5000) {
    logger.warn('Slow MCP tool execution', {
      toolName,
      duration,
      type: 'mcp-tool-slow'
    });
  }
}

/**
 * Log error with context
 *
 * @param error - Error object
 * @param context - Context string describing where error occurred
 * @param metadata - Additional metadata
 */
export function logError(error: Error, context: string, metadata?: any): void {
  logger.error('Error occurred', {
    message: error.message,
    stack: error.stack,
    context,
    ...metadata,
    type: 'error'
  });
}

/**
 * Log API request
 *
 * @param method - HTTP method
 * @param path - Request path
 * @param statusCode - Response status code
 * @param duration - Request duration in milliseconds
 */
export function logRequest(
  method: string,
  path: string,
  statusCode: number,
  duration: number
): void {
  const logData = {
    method,
    path,
    statusCode,
    duration,
    type: 'http-request',
    durationMs: duration
  };

  if (statusCode >= 500) {
    logger.error('HTTP request failed', logData);
  } else if (statusCode >= 400) {
    logger.warn('HTTP request error', logData);
  } else {
    logger.info('HTTP request completed', logData);
  }
}

/**
 * Log cache operation
 *
 * @param operation - Cache operation (hit/miss/set/delete)
 * @param key - Cache key
 * @param metadata - Additional metadata
 */
export function logCache(
  operation: 'hit' | 'miss' | 'set' | 'delete',
  key: string,
  metadata?: any
): void {
  logger.debug('Cache operation', {
    operation,
    key: key.substring(0, 100),
    type: 'cache',
    ...metadata
  });
}

/**
 * Log WebSocket event
 *
 * @param event - Event type
 * @param clientId - Client identifier
 * @param metadata - Additional metadata
 */
export function logWebSocket(
  event: 'connect' | 'disconnect' | 'message' | 'error',
  clientId: string,
  metadata?: any
): void {
  const logData = {
    event,
    clientId,
    type: 'websocket',
    ...metadata
  };

  if (event === 'error') {
    logger.error('WebSocket error', logData);
  } else {
    logger.info('WebSocket event', logData);
  }
}

/**
 * Log startup message
 *
 * @param message - Startup message
 * @param metadata - Additional metadata
 */
export function logStartup(message: string, metadata?: any): void {
  logger.info(message, {
    type: 'startup',
    ...metadata
  });
}

/**
 * Log shutdown message
 *
 * @param message - Shutdown message
 * @param metadata - Additional metadata
 */
export function logShutdown(message: string, metadata?: any): void {
  logger.info(message, {
    type: 'shutdown',
    ...metadata
  });
}

/**
 * Create child logger with additional context
 *
 * @param context - Context object to add to all logs
 * @returns Child logger instance
 */
export function createChildLogger(context: Record<string, any>): winston.Logger {
  return logger.child(context);
}

/**
 * Flush all log buffers (useful before shutdown)
 */
export async function flushLogs(): Promise<void> {
  return new Promise((resolve) => {
    logger.on('finish', resolve);
    logger.end();
  });
}

// Export default logger
export default logger;
