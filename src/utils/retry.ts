/**
 * Retry Utility for Transient Failures
 *
 * Provides retry logic with exponential backoff for handling transient errors
 * in database connections, network requests, and other temporary failures.
 *
 * @module utils/retry
 */

import { MCPError, ErrorSeverity, ErrorCategory } from "./error-handler.js";
import { logger } from './logger.js';

// ============================================================================
// Types
// ============================================================================

export interface RetryOptions {
  maxAttempts?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
  retryableErrors?: ((error: unknown) => boolean);
  onRetry?: (attempt: number, error: unknown) => void;
}

export interface RetryResult<T> {
  success: boolean;
  result?: T;
  error?: unknown;
  attempts: number;
  totalDuration: number;
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
  retryableErrors: isTransientError,
  onRetry: (attempt, error) => {
    logger.info(`[Retry] Attempt ${attempt} failed:`, error);
  },
};

// ============================================================================
// Retry Functions
// ============================================================================

/**
 * Execute a function with retry logic
 *
 * @param fn - Async function to execute
 * @param options - Retry configuration
 * @returns Promise resolving to function result
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: RetryOptions
): Promise<T> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
  const startTime = Date.now();

  let lastError: unknown;
  let attempt = 0;

  while (attempt < opts.maxAttempts) {
    attempt++;

    try {
      const result = await fn();
      return result;
    } catch (error) {
      lastError = error;

      // Check if error is retryable
      if (!opts.retryableErrors(error)) {
        throw error;
      }

      // Call retry callback
      if (opts.onRetry) {
        opts.onRetry(attempt, error);
      }

      // If this was the last attempt, throw the error
      if (attempt >= opts.maxAttempts) {
        throw new MCPError(
          `Operation failed after ${attempt} attempts: ${getErrorMessage(error)}`,
          getErrorCategory(error),
          ErrorSeverity.HIGH,
          false,
          {
            attempts: attempt,
            totalDuration: Date.now() - startTime,
            lastError: getErrorMessage(error),
          }
        );
      }

      // Calculate delay with exponential backoff
      const delay = calculateBackoffDelay(
        attempt,
        opts.initialDelayMs,
        opts.maxDelayMs,
        opts.backoffMultiplier
      );

      logger.info(`[Retry] Waiting ${delay}ms before attempt ${attempt + 1}...`);
      await sleep(delay);
    }
  }

  // This should never be reached, but TypeScript requires it
  throw lastError;
}

/**
 * Execute a function with retry logic and return detailed result
 *
 * @param fn - Async function to execute
 * @param options - Retry configuration
 * @returns Promise resolving to detailed retry result
 */
export async function retryWithResult<T>(
  fn: () => Promise<T>,
  options?: RetryOptions
): Promise<RetryResult<T>> {
  const startTime = Date.now();

  try {
    const result = await withRetry(fn, options);
    return {
      success: true,
      result,
      attempts: 1,
      totalDuration: Date.now() - startTime,
    };
  } catch (error) {
    const attempts = options?.maxAttempts || DEFAULT_RETRY_OPTIONS.maxAttempts;
    return {
      success: false,
      error,
      attempts,
      totalDuration: Date.now() - startTime,
    };
  }
}

/**
 * Execute multiple functions with retry logic in parallel
 *
 * @param fns - Array of async functions to execute
 * @param options - Retry configuration
 * @returns Promise resolving to array of results
 */
export async function retryAll<T>(
  fns: Array<() => Promise<T>>,
  options?: RetryOptions
): Promise<T[]> {
  const promises = fns.map((fn) => withRetry(fn, options));
  return Promise.all(promises);
}

/**
 * Execute multiple functions with retry logic, returning all results (success and failures)
 *
 * @param fns - Array of async functions to execute
 * @param options - Retry configuration
 * @returns Promise resolving to array of detailed results
 */
export async function retryAllSettled<T>(
  fns: Array<() => Promise<T>>,
  options?: RetryOptions
): Promise<RetryResult<T>[]> {
  const promises = fns.map((fn) => retryWithResult(fn, options));
  return Promise.all(promises);
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate exponential backoff delay
 */
function calculateBackoffDelay(
  attempt: number,
  initialDelayMs: number,
  maxDelayMs: number,
  backoffMultiplier: number
): number {
  const exponentialDelay = initialDelayMs * Math.pow(backoffMultiplier, attempt - 1);
  const jitter = Math.random() * 0.1 * exponentialDelay; // Add 10% jitter
  const delay = Math.min(exponentialDelay + jitter, maxDelayMs);
  return Math.floor(delay);
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Check if error is transient and should be retried
 */
function isTransientError(error: unknown): boolean {
  if (error instanceof MCPError) {
    return error.isRetryable;
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    // Network errors (usually transient)
    if (
      message.includes("timeout") ||
      message.includes("econnrefused") ||
      message.includes("enotfound") ||
      message.includes("network") ||
      message.includes("fetch failed") ||
      message.includes("socket hang up")
    ) {
      return true;
    }

    // Database connection errors (usually transient)
    if (
      message.includes("connection") ||
      message.includes("lost connection") ||
      message.includes("too many connections") ||
      message.includes("deadlock")
    ) {
      return true;
    }

    // Rate limiting (transient)
    if (
      message.includes("rate limit") ||
      message.includes("too many requests") ||
      message.includes("429")
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Extract error message from unknown error
 */
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return "Unknown error";
}

/**
 * Get error category from unknown error
 */
function getErrorCategory(error: unknown): ErrorCategory {
  if (error instanceof MCPError) {
    return error.category;
  }
  return ErrorCategory.INTERNAL;
}

// ============================================================================
// Predefined Retry Strategies
// ============================================================================

/**
 * Retry options for database operations
 */
export const DATABASE_RETRY_OPTIONS: RetryOptions = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 5000,
  backoffMultiplier: 2,
  onRetry: (attempt, error) => {
    logger.info(`[Database Retry] Attempt ${attempt} failed:`, getErrorMessage(error));
  },
};

/**
 * Retry options for network operations
 */
export const NETWORK_RETRY_OPTIONS: RetryOptions = {
  maxAttempts: 5,
  initialDelayMs: 2000,
  maxDelayMs: 16000,
  backoffMultiplier: 2,
  onRetry: (attempt, error) => {
    logger.info(`[Network Retry] Attempt ${attempt} failed:`, getErrorMessage(error));
  },
};

/**
 * Retry options for file system operations
 */
export const FILE_SYSTEM_RETRY_OPTIONS: RetryOptions = {
  maxAttempts: 2,
  initialDelayMs: 500,
  maxDelayMs: 2000,
  backoffMultiplier: 2,
  retryableErrors: (error) => {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      // Only retry EBUSY (file in use) errors
      return message.includes("ebusy");
    }
    return false;
  },
};

/**
 * No retry - fail immediately
 */
export const NO_RETRY_OPTIONS: RetryOptions = {
  maxAttempts: 1,
  initialDelayMs: 0,
  maxDelayMs: 0,
  backoffMultiplier: 1,
  retryableErrors: () => false,
};

// ============================================================================
// Exports
// ============================================================================

export default {
  withRetry,
  retryWithResult,
  retryAll,
  retryAllSettled,
  DATABASE_RETRY_OPTIONS,
  NETWORK_RETRY_OPTIONS,
  FILE_SYSTEM_RETRY_OPTIONS,
  NO_RETRY_OPTIONS,
};
