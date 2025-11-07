/**
 * Enterprise-Grade Error Handling Utility
 *
 * Provides centralized error handling, logging, and standardized error responses
 * for the TrinityCore MCP server.
 *
 * @module utils/error-handler
 */

import { logger } from './logger';


// ============================================================================
// Types
// ============================================================================

export enum ErrorCategory {
  DATABASE = "DATABASE",
  FILE_SYSTEM = "FILE_SYSTEM",
  NETWORK = "NETWORK",
  VALIDATION = "VALIDATION",
  AUTHENTICATION = "AUTHENTICATION",
  AUTHORIZATION = "AUTHORIZATION",
  CONFIGURATION = "CONFIGURATION",
  EXTERNAL_SERVICE = "EXTERNAL_SERVICE",
  INTERNAL = "INTERNAL",
  UNKNOWN = "UNKNOWN",
}

export enum ErrorSeverity {
  LOW = "LOW",           // Informational, no action needed
  MEDIUM = "MEDIUM",     // Warning, may require attention
  HIGH = "HIGH",         // Error, requires action
  CRITICAL = "CRITICAL", // Critical failure, immediate action required
}

export interface ErrorDetails {
  category: ErrorCategory;
  severity: ErrorSeverity;
  message: string;
  originalError?: Error;
  context?: Record<string, any>;
  timestamp: Date;
  stack?: string;
  isRetryable: boolean;
  suggestedAction?: string;
}

export interface StandardErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    category: ErrorCategory;
    severity: ErrorSeverity;
    timestamp: string;
    details?: Record<string, any>;
    suggestedAction?: string;
  };
}

// ============================================================================
// Error Classes
// ============================================================================

export class MCPError extends Error {
  public readonly category: ErrorCategory;
  public readonly severity: ErrorSeverity;
  public readonly isRetryable: boolean;
  public readonly context?: Record<string, any>;
  public readonly timestamp: Date;
  public readonly suggestedAction?: string;

  constructor(
    message: string,
    category: ErrorCategory = ErrorCategory.INTERNAL,
    severity: ErrorSeverity = ErrorSeverity.HIGH,
    isRetryable: boolean = false,
    context?: Record<string, any>,
    suggestedAction?: string
  ) {
    super(message);
    this.name = "MCPError";
    this.category = category;
    this.severity = severity;
    this.isRetryable = isRetryable;
    this.context = context;
    this.timestamp = new Date();
    this.suggestedAction = suggestedAction;

    // Maintains proper stack trace for where our error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, MCPError);
    }
  }
}

export class DatabaseError extends MCPError {
  constructor(
    message: string,
    severity: ErrorSeverity = ErrorSeverity.HIGH,
    isRetryable: boolean = true,
    context?: Record<string, any>
  ) {
    super(
      message,
      ErrorCategory.DATABASE,
      severity,
      isRetryable,
      context,
      "Check database connection and query syntax. Verify database credentials in .env file."
    );
    this.name = "DatabaseError";
  }
}

export class ValidationError extends MCPError {
  constructor(
    message: string,
    context?: Record<string, any>
  ) {
    super(
      message,
      ErrorCategory.VALIDATION,
      ErrorSeverity.MEDIUM,
      false,
      context,
      "Verify input parameters match the expected schema."
    );
    this.name = "ValidationError";
  }
}

export class FileSystemError extends MCPError {
  constructor(
    message: string,
    severity: ErrorSeverity = ErrorSeverity.HIGH,
    context?: Record<string, any>
  ) {
    super(
      message,
      ErrorCategory.FILE_SYSTEM,
      severity,
      false,
      context,
      "Check file paths and permissions. Verify directories exist."
    );
    this.name = "FileSystemError";
  }
}

export class ConfigurationError extends MCPError {
  constructor(
    message: string,
    context?: Record<string, any>
  ) {
    super(
      message,
      ErrorCategory.CONFIGURATION,
      ErrorSeverity.CRITICAL,
      false,
      context,
      "Review configuration in .env file or config.json. Ensure all required settings are present."
    );
    this.name = "ConfigurationError";
  }
}

export class NetworkError extends MCPError {
  constructor(
    message: string,
    isRetryable: boolean = true,
    context?: Record<string, any>
  ) {
    super(
      message,
      ErrorCategory.NETWORK,
      ErrorSeverity.HIGH,
      isRetryable,
      context,
      "Check network connectivity. Verify external service endpoints are reachable."
    );
    this.name = "NetworkError";
  }
}

// ============================================================================
// Error Handler Functions
// ============================================================================

/**
 * Handle and log errors with appropriate formatting
 */
export function handleError(error: unknown, context?: Record<string, any>): ErrorDetails {
  const timestamp = new Date();

  // Handle MCPError instances
  if (error instanceof MCPError) {
    const details: ErrorDetails = {
      category: error.category,
      severity: error.severity,
      message: error.message,
      originalError: error,
      context: { ...error.context, ...context },
      timestamp,
      stack: error.stack,
      isRetryable: error.isRetryable,
      suggestedAction: error.suggestedAction,
    };

    logError(details);
    return details;
  }

  // Handle standard Error instances
  if (error instanceof Error) {
    const category = categorizeError(error);
    const severity = determineSeverity(error);
    const isRetryable = isErrorRetryable(error);

    const details: ErrorDetails = {
      category,
      severity,
      message: error.message,
      originalError: error,
      context,
      timestamp,
      stack: error.stack,
      isRetryable,
    };

    logError(details);
    return details;
  }

  // Handle string errors
  if (typeof error === "string") {
    const details: ErrorDetails = {
      category: ErrorCategory.UNKNOWN,
      severity: ErrorSeverity.MEDIUM,
      message: error,
      context,
      timestamp,
      isRetryable: false,
    };

    logError(details);
    return details;
  }

  // Handle unknown error types
  const details: ErrorDetails = {
    category: ErrorCategory.UNKNOWN,
    severity: ErrorSeverity.MEDIUM,
    message: "An unknown error occurred",
    context: { ...context, error: String(error) },
    timestamp,
    isRetryable: false,
  };

  logError(details);
  return details;
}

/**
 * Create a standardized error response for MCP tools
 */
export function createErrorResponse(
  error: unknown,
  context?: Record<string, any>
): StandardErrorResponse {
  const details = handleError(error, context);

  return {
    success: false,
    error: {
      code: generateErrorCode(details),
      message: details.message,
      category: details.category,
      severity: details.severity,
      timestamp: details.timestamp.toISOString(),
      details: details.context,
      suggestedAction: details.suggestedAction,
    },
  };
}

/**
 * Wrap async functions with error handling
 */
export function withErrorHandling<T>(
  fn: () => Promise<T>,
  context?: Record<string, any>
): Promise<T> {
  return fn().catch((error) => {
    const errorDetails = handleError(error, context);
    throw new MCPError(
      errorDetails.message,
      errorDetails.category,
      errorDetails.severity,
      errorDetails.isRetryable,
      errorDetails.context,
      errorDetails.suggestedAction
    );
  });
}

// ============================================================================
// Error Classification
// ============================================================================

/**
 * Categorize error based on error type and message
 */
function categorizeError(error: Error): ErrorCategory {
  const message = error.message.toLowerCase();

  // Database errors
  if (
    message.includes("database") ||
    message.includes("connection") ||
    message.includes("query") ||
    message.includes("sql") ||
    error.name === "SequelizeError"
  ) {
    return ErrorCategory.DATABASE;
  }

  // File system errors
  if (
    message.includes("enoent") ||
    message.includes("eacces") ||
    message.includes("file") ||
    message.includes("directory") ||
    message.includes("path")
  ) {
    return ErrorCategory.FILE_SYSTEM;
  }

  // Network errors
  if (
    message.includes("network") ||
    message.includes("timeout") ||
    message.includes("econnrefused") ||
    message.includes("enotfound") ||
    message.includes("fetch")
  ) {
    return ErrorCategory.NETWORK;
  }

  // Validation errors
  if (
    message.includes("validation") ||
    message.includes("invalid") ||
    message.includes("required") ||
    message.includes("expected")
  ) {
    return ErrorCategory.VALIDATION;
  }

  // Configuration errors
  if (
    message.includes("config") ||
    message.includes("environment") ||
    message.includes("missing")
  ) {
    return ErrorCategory.CONFIGURATION;
  }

  return ErrorCategory.INTERNAL;
}

/**
 * Determine error severity based on type and impact
 */
function determineSeverity(error: Error): ErrorSeverity {
  const message = error.message.toLowerCase();

  // Critical errors
  if (
    message.includes("critical") ||
    message.includes("fatal") ||
    message.includes("config")
  ) {
    return ErrorSeverity.CRITICAL;
  }

  // High severity errors
  if (
    message.includes("database") ||
    message.includes("connection") ||
    message.includes("authentication")
  ) {
    return ErrorSeverity.HIGH;
  }

  // Medium severity errors
  if (
    message.includes("validation") ||
    message.includes("invalid") ||
    message.includes("warning")
  ) {
    return ErrorSeverity.MEDIUM;
  }

  return ErrorSeverity.MEDIUM;
}

/**
 * Determine if error is retryable
 */
function isErrorRetryable(error: Error): boolean {
  const message = error.message.toLowerCase();

  // Retryable: Transient network/database errors
  if (
    message.includes("timeout") ||
    message.includes("connection refused") ||
    message.includes("network") ||
    message.includes("temporary")
  ) {
    return true;
  }

  // Not retryable: Validation, configuration, file system errors
  if (
    message.includes("validation") ||
    message.includes("invalid") ||
    message.includes("config") ||
    message.includes("not found") ||
    message.includes("permission denied")
  ) {
    return false;
  }

  // Default: not retryable
  return false;
}

/**
 * Generate error code from details
 */
function generateErrorCode(details: ErrorDetails): string {
  const categoryPrefix = details.category.substring(0, 3).toUpperCase();
  const severityCode = details.severity === ErrorSeverity.CRITICAL ? "C" :
                       details.severity === ErrorSeverity.HIGH ? "H" :
                       details.severity === ErrorSeverity.MEDIUM ? "M" : "L";
  const timestamp = details.timestamp.getTime();

  return `${categoryPrefix}_${severityCode}_${timestamp % 100000}`;
}

/**
 * Log error with appropriate level
 */
function logError(details: ErrorDetails): void {
  const logLevel =
    details.severity === ErrorSeverity.CRITICAL ? "error" :
    details.severity === ErrorSeverity.HIGH ? "error" :
    details.severity === ErrorSeverity.MEDIUM ? "warn" : "info";

  const logMessage = {
    timestamp: details.timestamp.toISOString(),
    level: logLevel,
    category: details.category,
    severity: details.severity,
    message: details.message,
    context: details.context,
    suggestedAction: details.suggestedAction,
    retryable: details.isRetryable,
  };

  if (logLevel === "error") {
    logger.error("[ERROR]", JSON.stringify(logMessage, null, 2));
    if (details.stack) {
      logger.error("Stack trace:", details.stack);
    }
  } else if (logLevel === "warn") {
    logger.warn("[WARN]", JSON.stringify(logMessage, null, 2));
  } else {
    logger.info("[INFO]", JSON.stringify(logMessage, null, 2));
  }
}

// ============================================================================
// Exports
// ============================================================================

export default {
  handleError,
  createErrorResponse,
  withErrorHandling,
  MCPError,
  DatabaseError,
  ValidationError,
  FileSystemError,
  ConfigurationError,
  NetworkError,
};
