/**
 * Tests for tool argument validation.
 *
 * These pin the contract that a run of the test plan found missing: a tool that
 * declares a parameter required must not accept a call without it. The failure
 * being prevented is not a crash but a plausible answer built from `undefined` -
 * one tool reported a reputation standing of "exalted" for no input at all.
 */

import {
  validateToolArgs,
  ToolArgumentError,
} from "../../../src/tools/registry/validate-args";
import { ToolDefinition } from "../../../src/tools/registry/types";

function tool(properties: Record<string, unknown>, required?: string[]): ToolDefinition {
  return {
    name: "test-tool",
    description: "A tool used for testing validation",
    inputSchema: { type: "object", properties, required } as ToolDefinition["inputSchema"],
  };
}

describe("validateToolArgs", () => {
  describe("required parameters", () => {
    const definition = tool({ itemId: { type: "number" } }, ["itemId"]);

    it("accepts a call that supplies them", () => {
      expect(() => validateToolArgs(definition, { itemId: 25 })).not.toThrow();
    });

    it("rejects a call that omits them", () => {
      expect(() => validateToolArgs(definition, {})).toThrow(ToolArgumentError);
    });

    it("names the missing parameter in the message", () => {
      expect(() => validateToolArgs(definition, {})).toThrow(/itemId/);
    });

    it("treats null as absent", () => {
      expect(() => validateToolArgs(definition, { itemId: null })).toThrow(/itemId/);
    });

    it("treats undefined as absent", () => {
      expect(() => validateToolArgs(definition, { itemId: undefined })).toThrow(/itemId/);
    });

    it("accepts zero, which is a value and not an absence", () => {
      expect(() => validateToolArgs(definition, { itemId: 0 })).not.toThrow();
    });

    it("reports every missing parameter at once", () => {
      const multi = tool(
        { a: { type: "number" }, b: { type: "string" }, c: { type: "number" } },
        ["a", "b", "c"]
      );
      try {
        validateToolArgs(multi, {});
        fail("expected a ToolArgumentError");
      } catch (error) {
        expect(error).toBeInstanceOf(ToolArgumentError);
        expect((error as ToolArgumentError).problems.map((p) => p.parameter)).toEqual(["a", "b", "c"]);
      }
    });
  });

  describe("types", () => {
    it("rejects a string where a number is declared, rather than coercing it", () => {
      const definition = tool({ spellId: { type: "number" } }, ["spellId"]);
      expect(() => validateToolArgs(definition, { spellId: "133" })).toThrow(
        /expected number, received string/
      );
    });

    it("rejects a number where a string is declared", () => {
      const definition = tool({ name: { type: "string" } });
      expect(() => validateToolArgs(definition, { name: 42 })).toThrow(/expected string/);
    });

    it("rejects a non-integer where an integer is declared", () => {
      const definition = tool({ count: { type: "integer" } });
      expect(() => validateToolArgs(definition, { count: 1.5 })).toThrow(/expected integer/);
      expect(() => validateToolArgs(definition, { count: 2 })).not.toThrow();
    });

    it("rejects NaN and Infinity as numbers", () => {
      const definition = tool({ value: { type: "number" } });
      expect(() => validateToolArgs(definition, { value: NaN })).toThrow(/expected number/);
      expect(() => validateToolArgs(definition, { value: Infinity })).toThrow(/expected number/);
    });

    it("distinguishes arrays from objects", () => {
      expect(() => validateToolArgs(tool({ v: { type: "array" } }), { v: {} })).toThrow(/expected array/);
      expect(() => validateToolArgs(tool({ v: { type: "object" } }), { v: [] })).toThrow(/expected object/);
      expect(() => validateToolArgs(tool({ v: { type: "array" } }), { v: [1] })).not.toThrow();
    });

    it("accepts any of a union of declared types", () => {
      const definition = tool({ v: { type: ["string", "number"] } });
      expect(() => validateToolArgs(definition, { v: "x" })).not.toThrow();
      expect(() => validateToolArgs(definition, { v: 1 })).not.toThrow();
      expect(() => validateToolArgs(definition, { v: true })).toThrow(/expected string or number/);
    });
  });

  describe("enums and bounds", () => {
    it("rejects a value outside a declared enum", () => {
      const definition = tool({ dir: { type: "string", enum: ["CMSG", "SMSG"] } });
      expect(() => validateToolArgs(definition, { dir: "XMSG" })).toThrow(/must be one of/);
      expect(() => validateToolArgs(definition, { dir: "CMSG" })).not.toThrow();
    });

    it("enforces minimum and maximum", () => {
      const definition = tool({ level: { type: "number", minimum: 1, maximum: 80 } });
      expect(() => validateToolArgs(definition, { level: 0 })).toThrow(/at least 1/);
      expect(() => validateToolArgs(definition, { level: 81 })).toThrow(/at most 80/);
      expect(() => validateToolArgs(definition, { level: 70 })).not.toThrow();
    });
  });

  describe("tolerance", () => {
    it("ignores parameters the schema does not declare", () => {
      const definition = tool({ itemId: { type: "number" } }, ["itemId"]);
      expect(() => validateToolArgs(definition, { itemId: 25, extra: "ignored" })).not.toThrow();
    });

    it("accepts anything when the schema declares nothing", () => {
      expect(() => validateToolArgs(tool({}), { whatever: 1 })).not.toThrow();
    });

    it("accepts an empty call when nothing is required", () => {
      expect(() => validateToolArgs(tool({ optional: { type: "string" } }), {})).not.toThrow();
    });
  });

  describe("error shape", () => {
    it("carries the tool name and every problem", () => {
      const definition = tool({ a: { type: "number" }, b: { type: "string" } }, ["a"]);
      try {
        validateToolArgs(definition, { b: 5 });
        fail("expected a ToolArgumentError");
      } catch (error) {
        const e = error as ToolArgumentError;
        expect(e.toolName).toBe("test-tool");
        expect(e.problems).toHaveLength(2); // a missing, b wrong type
        expect(e.message).toContain("test-tool");
      }
    });
  });
});
