/**
 * Custom Error Classes
 *
 * Provides structured errors with user-friendly messages,
 * technical details, and recovery suggestions.
 */

import { Logger } from './logger';

export interface ErrorContext {
  /** User-friendly error message */
  userMessage: string;

  /** Technical details for developers */
  technicalDetails?: string;

  /** Suggested action for recovery */
  suggestedAction?: string;

  /** Can the error be recovered from? */
  recoverable: boolean;

  /** Error severity */
  severity: 'low' | 'medium' | 'high' | 'critical';

  /** Additional metadata */
  metadata?: Record<string, any>;
}

/**
 * Base Application Error
 */
export class AppError extends Error {
  public readonly context: ErrorContext;
  public readonly timestamp: number;

  constructor(message: string, context: Partial<ErrorContext> = {}) {
    super(message);
    this.name = this.constructor.name;
    this.timestamp = Date.now();

    this.context = {
      userMessage: context.userMessage || message,
      technicalDetails: context.technicalDetails,
      suggestedAction: context.suggestedAction,
      recoverable: context.recoverable ?? true,
      severity: context.severity ?? 'medium',
      metadata: context.metadata,
    };

    // Capture stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }

    // Log error
    Logger.error(this.name, this, {
      context: this.context,
      timestamp: this.timestamp,
    });
  }

  /**
   * Get user-friendly error message
   */
  getUserMessage(): string {
    return this.context.userMessage;
  }

  /**
   * Get full error details
   */
  getDetails(): string {
    let details = this.context.userMessage;

    if (this.context.technicalDetails) {
      details += `\n\nTechnical Details: ${this.context.technicalDetails}`;
    }

    if (this.context.suggestedAction) {
      details += `\n\nSuggested Action: ${this.context.suggestedAction}`;
    }

    return details;
  }
}

/**
 * File Parsing Error
 */
export class ParseError extends AppError {
  constructor(
    fileName: string,
    fileType: string,
    reason: string,
    technicalDetails?: string
  ) {
    super(`Failed to parse ${fileType} file: ${fileName}`, {
      userMessage: `The ${fileType} file "${fileName}" could not be parsed: ${reason}`,
      technicalDetails,
      suggestedAction: `Please ensure the file is a valid ${fileType} file extracted from the correct game version.`,
      recoverable: true,
      severity: 'medium',
      metadata: { fileName, fileType, reason },
    });
  }
}

/**
 * Database Error
 */
export class DatabaseError extends AppError {
  constructor(operation: string, details: string, sqlState?: string) {
    super(`Database ${operation} failed`, {
      userMessage: `Database operation failed: ${operation}`,
      technicalDetails: details + (sqlState ? ` (SQL State: ${sqlState})` : ''),
      suggestedAction: 'Please check your database connection and try again.',
      recoverable: true,
      severity: 'high',
      metadata: { operation, sqlState },
    });
  }
}

/**
 * Validation Error
 */
export class ValidationError extends AppError {
  constructor(field: string, value: any, constraint: string) {
    super(`Validation failed for ${field}`, {
      userMessage: `Invalid value for ${field}: ${constraint}`,
      technicalDetails: `Value "${value}" does not meet constraint: ${constraint}`,
      suggestedAction: 'Please correct the invalid value and try again.',
      recoverable: true,
      severity: 'low',
      metadata: { field, value, constraint },
    });
  }
}

/**
 * Network Error
 */
export class NetworkError extends AppError {
  constructor(url: string, statusCode?: number, statusText?: string) {
    const message = statusCode
      ? `HTTP ${statusCode}: ${statusText || 'Request failed'}`
      : 'Network request failed';

    super(message, {
      userMessage: `Failed to connect to server: ${message}`,
      technicalDetails: `URL: ${url}, Status: ${statusCode || 'unknown'}`,
      suggestedAction: 'Please check your internet connection and try again.',
      recoverable: true,
      severity: 'medium',
      metadata: { url, statusCode, statusText },
    });
  }
}

/**
 * Permission Error
 */
export class PermissionError extends AppError {
  constructor(action: string, resource: string) {
    super(`Permission denied: ${action} on ${resource}`, {
      userMessage: `You do not have permission to ${action} ${resource}`,
      suggestedAction: 'Please contact your administrator for access.',
      recoverable: false,
      severity: 'medium',
      metadata: { action, resource },
    });
  }
}

/**
 * Configuration Error
 */
export class ConfigurationError extends AppError {
  constructor(setting: string, issue: string) {
    super(`Configuration error: ${setting}`, {
      userMessage: `Application is not configured correctly: ${issue}`,
      technicalDetails: `Setting "${setting}" is invalid or missing`,
      suggestedAction: 'Please check your .env.local file and restart the application.',
      recoverable: false,
      severity: 'critical',
      metadata: { setting, issue },
    });
  }
}

/**
 * Not Found Error
 */
export class NotFoundError extends AppError {
  constructor(resourceType: string, identifier: string | number) {
    super(`${resourceType} not found`, {
      userMessage: `The ${resourceType} you're looking for does not exist`,
      technicalDetails: `No ${resourceType} found with identifier: ${identifier}`,
      suggestedAction: 'Please verify the ID and try again.',
      recoverable: true,
      severity: 'low',
      metadata: { resourceType, identifier },
    });
  }
}

/**
 * Memory Error
 */
export class MemoryError extends AppError {
  constructor(operation: string, memoryUsed: number, memoryLimit: number) {
    super('Out of memory', {
      userMessage: 'The application ran out of memory',
      technicalDetails: `Memory used: ${memoryUsed}MB, Limit: ${memoryLimit}MB during: ${operation}`,
      suggestedAction: 'Please close some tabs or restart your browser.',
      recoverable: false,
      severity: 'critical',
      metadata: { operation, memoryUsed, memoryLimit },
    });
  }
}

/**
 * Error Handler Utilities
 */
export class ErrorHandler {
  /**
   * Handle error and return user-friendly message
   */
  static handle(error: unknown): ErrorContext {
    if (error instanceof AppError) {
      return error.context;
    }

    if (error instanceof Error) {
      return {
        userMessage: 'An unexpected error occurred',
        technicalDetails: error.message,
        suggestedAction: 'Please try again or contact support if the problem persists.',
        recoverable: true,
        severity: 'medium',
        metadata: { stack: error.stack },
      };
    }

    return {
      userMessage: 'An unknown error occurred',
      technicalDetails: String(error),
      suggestedAction: 'Please try again.',
      recoverable: true,
      severity: 'low',
    };
  }

  /**
   * Wrap async function with error handling
   */
  static async wrapAsync<T>(
    fn: () => Promise<T>,
    context: string
  ): Promise<{ success: true; data: T } | { success: false; error: ErrorContext }> {
    try {
      const data = await fn();
      return { success: true, data };
    } catch (error) {
      Logger.error(context, error as Error);
      return { success: false, error: this.handle(error) };
    }
  }

  /**
   * Wrap sync function with error handling
   */
  static wrap<T>(
    fn: () => T,
    context: string
  ): { success: true; data: T } | { success: false; error: ErrorContext } {
    try {
      const data = fn();
      return { success: true, data };
    } catch (error) {
      Logger.error(context, error as Error);
      return { success: false, error: this.handle(error) };
    }
  }
}

/**
 * Assert utility with custom errors
 */
export function assert(
  condition: boolean,
  message: string,
  ErrorClass: typeof AppError = AppError
): asserts condition {
  if (!condition) {
    throw new ErrorClass(message);
  }
}

/**
 * Type guard for AppError
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
