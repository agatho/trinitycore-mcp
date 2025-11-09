/**
 * Database-specific error classes
 *
 * @module database/errors
 */

/**
 * Database operation error
 */
export class DatabaseError extends Error {
  public readonly code?: string;
  public readonly query?: string;
  public readonly params?: any[];

  constructor(message: string, options?: {
    code?: string;
    query?: string;
    params?: any[];
    cause?: Error;
  }) {
    super(message);
    this.name = 'DatabaseError';
    this.code = options?.code;
    this.query = options?.query;
    this.params = options?.params;

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, DatabaseError);
    }

    // Store original error as cause if provided
    if (options?.cause) {
      this.cause = options.cause;
    }
  }
}
