/**
 * Validates that a hand-written DB2 schema matches the file it is about to parse.
 *
 * Schemas in src/parsers/schemas read fields by hard-coded index. When a DB2
 * layout changes between client builds they do not fail — they return wrong
 * values. This gate compares the file's layoutHash against what the schema was
 * written for, so a stale schema produces a named error instead.
 *
 * @module version/SchemaBuildGate
 */

import { logger } from "../utils/logger";

export interface BuildAwareSchema {
  name: string;
  VALID_BUILDS: { from: number; to: number | null };
  LAYOUT_HASHES: Map<number, number>;
}

export type GateVerdict =
  | { status: "verified" }
  | { status: "unverified"; reason: string };

export class SchemaLayoutMismatchError extends Error {
  constructor(
    public readonly schemaName: string,
    public readonly build: number,
    public readonly expected: number,
    public readonly actual: number
  ) {
    super(
      `Schema ${schemaName} does not match the DB2 file for build ${build}: ` +
        `expected layoutHash ${hex(expected)}, file has ${hex(actual)}. ` +
        `The schema's hard-coded field indices are stale for this build; parsing would return wrong values. ` +
        `Update ${schemaName} for build ${build} and record its layout hash.`
    );
    this.name = "SchemaLayoutMismatchError";
  }
}

function hex(n: number): string {
  return `0x${(n >>> 0).toString(16).padStart(8, "0")}`;
}

/** Schemas already warned about, so an unknown build warns once per process. */
const warned = new Set<string>();

/**
 * Check a schema against the layout hash of the file being opened.
 *
 * @throws {SchemaLayoutMismatchError} when the build is known and the hash differs
 * @throws {Error} when the build falls outside the schema's declared validity range
 */
export function checkSchemaLayout(
  schema: BuildAwareSchema,
  actualLayoutHash: number,
  build: number
): GateVerdict {
  const { from, to } = schema.VALID_BUILDS;

  if (build < from) {
    throw new Error(
      `Schema ${schema.name} is valid from build ${from}; refusing to parse build ${build}`
    );
  }
  if (to !== null && build > to) {
    throw new Error(
      `Schema ${schema.name} is valid through build ${to}; refusing to parse build ${build}`
    );
  }

  const expected = schema.LAYOUT_HASHES.get(build);

  if (expected === undefined) {
    if (!warned.has(schema.name)) {
      warned.add(schema.name);
      logger.warn(
        `Schema ${schema.name} has no recorded layout hash for build ${build}; ` +
          `results are unverified. Record the hash with the validate-build-schemas tool.`
      );
    }
    return { status: "unverified", reason: `No recorded layout hash for build ${build}` };
  }

  if ((expected >>> 0) !== (actualLayoutHash >>> 0)) {
    throw new SchemaLayoutMismatchError(schema.name, build, expected, actualLayoutHash);
  }

  return { status: "verified" };
}

/** Test-only: clear the once-per-schema warning guard. */
export function resetGateWarningsForTesting(): void {
  warned.clear();
}
