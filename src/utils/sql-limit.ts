/**
 * Safe LIMIT and OFFSET values for prepared statements.
 *
 * MySQL's binary protocol will not accept a placeholder for LIMIT or OFFSET:
 * `pool.execute("... LIMIT ?", [25])` fails with "Incorrect arguments to
 * mysqld_stmt_execute". Ten queries in this codebase were written that way, so
 * every one failed whenever it was reached - creature search, item search,
 * spell search, quest routing and table export among them.
 *
 * The fix is to put the number into the SQL text, which is only safe if it is
 * genuinely a number. These helpers guarantee that: they coerce to an integer,
 * clamp it to a sane range, and never return anything a caller could inject
 * through.
 *
 * @module utils/sql-limit
 */

/** Rows a query returns when the caller does not say. */
export const DEFAULT_LIMIT = 100;

/** Ceiling applied to any requested limit, to keep one query from returning everything. */
export const MAX_LIMIT = 10000;

/**
 * Turn a caller-supplied limit into an integer safe to inline into SQL.
 *
 * Anything that is not a finite number - a string, null, NaN, an injection
 * attempt - falls back to the default rather than reaching the query.
 *
 * @param value Limit as received from the caller
 * @param fallback Value to use when none was supplied or it was unusable
 * @param max Ceiling to clamp to
 * @returns A non-negative integer
 *
 * @example
 * ```typescript
 * const limit = safeLimit(args.limit, 25);
 * const sql = `SELECT ... LIMIT ${limit}`;
 * ```
 */
export function safeLimit(
  value: unknown,
  fallback: number = DEFAULT_LIMIT,
  max: number = MAX_LIMIT
): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    return clamp(fallback, max);
  }
  return clamp(Math.floor(parsed), max);
}

/**
 * Turn a caller-supplied offset into an integer safe to inline into SQL.
 *
 * @param value Offset as received from the caller
 * @param fallback Value to use when none was supplied or it was unusable
 * @returns A non-negative integer
 */
export function safeOffset(value: unknown, fallback: number = 0): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    return Math.max(0, Math.floor(fallback));
  }
  return Math.max(0, Math.floor(parsed));
}

function clamp(value: number, max: number): number {
  if (value < 0) {
    return 0;
  }
  return value > max ? max : value;
}
