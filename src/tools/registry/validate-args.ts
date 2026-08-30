/**
 * Argument validation against a tool's own declared input schema.
 *
 * Every tool already publishes an `inputSchema` naming its parameters, their
 * types, and which are required. Nothing enforced it: a run of the test plan
 * found 27 of 68 exercised tools accepting empty arguments, returning output
 * built from `undefined` - one reporting a reputation standing of "exalted" for
 * no input at all, two starting real work (a recording session, a cooldown
 * group) from nothing.
 *
 * Validating here rather than in each tool means the schema is the contract:
 * one implementation covers every registered tool, including tools added later,
 * and a tool cannot drift out of agreement with what it advertises.
 *
 * @module tools/registry/validate-args
 */

import { ToolDefinition } from "./types";

/** A parameter that failed validation, and why. */
export interface ArgumentProblem {
  parameter: string;
  problem: string;
}

/**
 * Raised when arguments do not satisfy a tool's declared input schema.
 *
 * Carries the individual problems so a caller can report all of them at once
 * rather than making the user fix one parameter per round trip.
 */
export class ToolArgumentError extends Error {
  public readonly toolName: string;
  public readonly problems: ArgumentProblem[];

  constructor(toolName: string, problems: ArgumentProblem[]) {
    const detail = problems.map((p) => `${p.parameter} (${p.problem})`).join("; ");
    super(`Invalid arguments for ${toolName}: ${detail}`);
    this.name = "ToolArgumentError";
    this.toolName = toolName;
    this.problems = problems;
  }
}

/** JSON Schema type names this validator understands. */
type SchemaType = "string" | "number" | "integer" | "boolean" | "object" | "array";

interface PropertySchema {
  type?: SchemaType | SchemaType[];
  enum?: unknown[];
  minimum?: number;
  maximum?: number;
}

/**
 * Whether a value matches a declared JSON Schema type.
 *
 * Deliberately strict about strings and numbers: a numeric id arriving as
 * "133" is a caller bug, and silently coercing it hides the mismatch until
 * something downstream produces a wrong answer.
 */
function matchesType(value: unknown, type: SchemaType): boolean {
  switch (type) {
    case "string":
      return typeof value === "string";
    case "number":
      return typeof value === "number" && Number.isFinite(value);
    case "integer":
      return typeof value === "number" && Number.isInteger(value);
    case "boolean":
      return typeof value === "boolean";
    case "array":
      return Array.isArray(value);
    case "object":
      return typeof value === "object" && value !== null && !Array.isArray(value);
    default:
      return true;
  }
}

function describeType(type: SchemaType | SchemaType[]): string {
  return Array.isArray(type) ? type.join(" or ") : type;
}

/**
 * Validate arguments against a tool's declared input schema.
 *
 * Checks that every required parameter is present and that any supplied
 * parameter matches its declared type, enum and numeric bounds. Parameters the
 * schema does not declare are left alone: tools accept extra keys today, and
 * rejecting them would break callers for no safety gain.
 *
 * A `null` or `undefined` value counts as absent. Passing `null` for a required
 * parameter is the same mistake as omitting it, and the message should say so.
 *
 * @param definition The tool definition carrying the schema
 * @param args Arguments as received from the caller
 * @throws {ToolArgumentError} If any required parameter is missing or any
 *   supplied parameter has the wrong type or is out of range
 *
 * @example
 * ```typescript
 * validateToolArgs(getItemInfoDefinition, {});
 * // throws: Invalid arguments for get-item-info: itemId (required, but not provided)
 * ```
 */
export function validateToolArgs(
  definition: ToolDefinition,
  args: Record<string, unknown>
): void {
  const schema = definition.inputSchema as
    | { properties?: Record<string, PropertySchema>; required?: string[] }
    | undefined;

  if (!schema) {
    return;
  }

  const properties = schema.properties || {};
  const required = schema.required || [];
  const supplied = args || {};
  const problems: ArgumentProblem[] = [];

  for (const name of required) {
    const value = supplied[name];
    if (value === undefined || value === null) {
      problems.push({ parameter: name, problem: "required, but not provided" });
    }
  }

  for (const [name, value] of Object.entries(supplied)) {
    if (value === undefined || value === null) {
      continue; // absent, and already reported above when required
    }

    const property = properties[name];
    if (!property) {
      continue; // undeclared extras are tolerated
    }

    if (property.type) {
      const types = Array.isArray(property.type) ? property.type : [property.type];
      if (!types.some((t) => matchesType(value, t))) {
        problems.push({
          parameter: name,
          problem: `expected ${describeType(property.type)}, received ${
            Array.isArray(value) ? "array" : typeof value
          }`,
        });
        continue; // a wrong type makes range and enum checks meaningless
      }
    }

    if (Array.isArray(property.enum) && property.enum.length > 0 && !property.enum.includes(value)) {
      problems.push({
        parameter: name,
        problem: `must be one of ${property.enum.map((v) => JSON.stringify(v)).join(", ")}`,
      });
      continue;
    }

    if (typeof value === "number") {
      if (property.minimum !== undefined && value < property.minimum) {
        problems.push({ parameter: name, problem: `must be at least ${property.minimum}` });
      } else if (property.maximum !== undefined && value > property.maximum) {
        problems.push({ parameter: name, problem: `must be at most ${property.maximum}` });
      }
    }
  }

  if (problems.length > 0) {
    throw new ToolArgumentError(definition.name, problems);
  }
}
