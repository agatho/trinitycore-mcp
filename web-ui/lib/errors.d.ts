/**
 * Custom Error Classes
 *
 * Provides structured errors with user-friendly messages,
 * technical details, and recovery suggestions.
 */
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
export declare class AppError extends Error {
    readonly context: ErrorContext;
    readonly timestamp: number;
    constructor(message: string, context?: Partial<ErrorContext>);
    /**
     * Get user-friendly error message
     */
    getUserMessage(): string;
    /**
     * Get full error details
     */
    getDetails(): string;
}
/**
 * File Parsing Error
 */
export declare class ParseError extends AppError {
    constructor(fileName: string, fileType: string, reason: string, technicalDetails?: string);
}
/**
 * Database Error
 */
export declare class DatabaseError extends AppError {
    constructor(operation: string, details: string, sqlState?: string);
}
/**
 * Validation Error
 */
export declare class ValidationError extends AppError {
    constructor(field: string, value: any, constraint: string);
}
/**
 * Network Error
 */
export declare class NetworkError extends AppError {
    constructor(url: string, statusCode?: number, statusText?: string);
}
/**
 * Permission Error
 */
export declare class PermissionError extends AppError {
    constructor(action: string, resource: string);
}
/**
 * Configuration Error
 */
export declare class ConfigurationError extends AppError {
    constructor(setting: string, issue: string);
}
/**
 * Not Found Error
 */
export declare class NotFoundError extends AppError {
    constructor(resourceType: string, identifier: string | number);
}
/**
 * Memory Error
 */
export declare class MemoryError extends AppError {
    constructor(operation: string, memoryUsed: number, memoryLimit: number);
}
/**
 * Error Handler Utilities
 */
export declare class ErrorHandler {
    /**
     * Handle error and return user-friendly message
     */
    static handle(error: unknown): ErrorContext;
    /**
     * Wrap async function with error handling
     */
    static wrapAsync<T>(fn: () => Promise<T>, context: string): Promise<{
        success: true;
        data: T;
    } | {
        success: false;
        error: ErrorContext;
    }>;
    /**
     * Wrap sync function with error handling
     */
    static wrap<T>(fn: () => T, context: string): {
        success: true;
        data: T;
    } | {
        success: false;
        error: ErrorContext;
    };
}
/**
 * Assert utility with custom errors
 */
export declare function assert(condition: boolean, message: string, ErrorClass?: typeof AppError): asserts condition;
/**
 * Type guard for AppError
 */
export declare function isAppError(error: unknown): error is AppError;
//# sourceMappingURL=errors.d.ts.map