"use strict";
/**
 * Custom Error Classes
 *
 * Provides structured errors with user-friendly messages,
 * technical details, and recovery suggestions.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ErrorHandler = exports.MemoryError = exports.NotFoundError = exports.ConfigurationError = exports.PermissionError = exports.NetworkError = exports.ValidationError = exports.DatabaseError = exports.ParseError = exports.AppError = void 0;
exports.assert = assert;
exports.isAppError = isAppError;
const logger_1 = require("./logger");
/**
 * Base Application Error
 */
class AppError extends Error {
    context;
    timestamp;
    constructor(message, context = {}) {
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
        logger_1.Logger.error(this.name, this, {
            context: this.context,
            timestamp: this.timestamp,
        });
    }
    /**
     * Get user-friendly error message
     */
    getUserMessage() {
        return this.context.userMessage;
    }
    /**
     * Get full error details
     */
    getDetails() {
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
exports.AppError = AppError;
/**
 * File Parsing Error
 */
class ParseError extends AppError {
    constructor(fileName, fileType, reason, technicalDetails) {
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
exports.ParseError = ParseError;
/**
 * Database Error
 */
class DatabaseError extends AppError {
    constructor(operation, details, sqlState) {
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
exports.DatabaseError = DatabaseError;
/**
 * Validation Error
 */
class ValidationError extends AppError {
    constructor(field, value, constraint) {
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
exports.ValidationError = ValidationError;
/**
 * Network Error
 */
class NetworkError extends AppError {
    constructor(url, statusCode, statusText) {
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
exports.NetworkError = NetworkError;
/**
 * Permission Error
 */
class PermissionError extends AppError {
    constructor(action, resource) {
        super(`Permission denied: ${action} on ${resource}`, {
            userMessage: `You do not have permission to ${action} ${resource}`,
            suggestedAction: 'Please contact your administrator for access.',
            recoverable: false,
            severity: 'medium',
            metadata: { action, resource },
        });
    }
}
exports.PermissionError = PermissionError;
/**
 * Configuration Error
 */
class ConfigurationError extends AppError {
    constructor(setting, issue) {
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
exports.ConfigurationError = ConfigurationError;
/**
 * Not Found Error
 */
class NotFoundError extends AppError {
    constructor(resourceType, identifier) {
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
exports.NotFoundError = NotFoundError;
/**
 * Memory Error
 */
class MemoryError extends AppError {
    constructor(operation, memoryUsed, memoryLimit) {
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
exports.MemoryError = MemoryError;
/**
 * Error Handler Utilities
 */
class ErrorHandler {
    /**
     * Handle error and return user-friendly message
     */
    static handle(error) {
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
    static async wrapAsync(fn, context) {
        try {
            const data = await fn();
            return { success: true, data };
        }
        catch (error) {
            logger_1.Logger.error(context, error);
            return { success: false, error: this.handle(error) };
        }
    }
    /**
     * Wrap sync function with error handling
     */
    static wrap(fn, context) {
        try {
            const data = fn();
            return { success: true, data };
        }
        catch (error) {
            logger_1.Logger.error(context, error);
            return { success: false, error: this.handle(error) };
        }
    }
}
exports.ErrorHandler = ErrorHandler;
/**
 * Assert utility with custom errors
 */
function assert(condition, message, ErrorClass = AppError) {
    if (!condition) {
        throw new ErrorClass(message);
    }
}
/**
 * Type guard for AppError
 */
function isAppError(error) {
    return error instanceof AppError;
}
//# sourceMappingURL=errors.js.map