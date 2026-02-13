/**
 * C++ Test Generator Tools Registry
 *
 * Registers MCP tools for the C++ Test Generator:
 * - generate-cpp-tests: Analyze C++ source and generate Google Test test cases
 * - generate-cpp-test-report: Generate a markdown report of test generation results
 *
 * @module tools/registry/cpp-test-tools
 */

import { ToolRegistryEntry, jsonResponse } from "./types";
import {
  generateCppTests,
  analyzeCppSource,
  generateTestCases,
  exportTestGenMarkdown,
  type TestGenConfig,
} from "../cpptestgenerator";

export const cppTestTools: ToolRegistryEntry[] = [
  {
    definition: {
      name: "generate-cpp-tests",
      description:
        "Analyze a C++ source file and generate Google Test compatible test cases. " +
        "Parses classes, methods, free functions, and constructors to produce unit tests, " +
        "boundary tests, null-check tests, and const-correctness tests. Returns generated " +
        "test file content, CMake integration snippet, and test statistics.",
      inputSchema: {
        type: "object",
        properties: {
          source: {
            type: "string",
            description: "C++ source code to analyze and generate tests for",
          },
          filePath: {
            type: "string",
            description: "Original file path of the source (used for naming test suite and includes)",
          },
          includeEdgeCases: {
            type: "boolean",
            description: "Generate boundary/edge-case tests for numeric parameters (default: true)",
          },
          includeNullChecks: {
            type: "boolean",
            description: "Generate nullptr tests for pointer parameters (default: true)",
          },
          includeExceptionTests: {
            type: "boolean",
            description: "Generate exception-handling tests (default: true)",
          },
          includeMocks: {
            type: "boolean",
            description: "Generate mock-based tests for dependencies (default: true)",
          },
          testFramework: {
            type: "string",
            description: "Test framework to target: gtest or catch2 (default: gtest)",
            enum: ["gtest", "catch2"],
          },
          cmakeProject: {
            type: "string",
            description: "CMake project name for integration snippet (default: TrinityCore)",
          },
          outputDir: {
            type: "string",
            description: "Output directory for generated test files (default: ./tests)",
          },
        },
        required: ["source", "filePath"],
      },
    },
    handler: async (args) => {
      const source = args.source as string;
      const filePath = args.filePath as string;

      if (!source || source.trim().length === 0) {
        return jsonResponse({ error: "source parameter is required and must be non-empty" });
      }
      if (!filePath || filePath.trim().length === 0) {
        return jsonResponse({ error: "filePath parameter is required and must be non-empty" });
      }

      const config: Partial<TestGenConfig> = {};
      if (args.includeEdgeCases !== undefined) config.includeEdgeCases = args.includeEdgeCases as boolean;
      if (args.includeNullChecks !== undefined) config.includeNullChecks = args.includeNullChecks as boolean;
      if (args.includeExceptionTests !== undefined) config.includeExceptionTests = args.includeExceptionTests as boolean;
      if (args.includeMocks !== undefined) config.includeMocks = args.includeMocks as boolean;
      if (args.testFramework !== undefined) config.testFramework = args.testFramework as "gtest" | "catch2";
      if (args.cmakeProject !== undefined) config.cmakeProject = args.cmakeProject as string;
      if (args.outputDir !== undefined) config.outputDir = args.outputDir as string;

      const result = generateCppTests(source, filePath, config);

      return jsonResponse({
        fileName: result.fileName,
        testSuite: result.testSuite,
        sourceFile: result.sourceFile,
        stats: result.stats,
        cmakeEntry: result.cmakeEntry,
        testCases: result.testCases.map(tc => ({
          testName: tc.testName,
          testSuite: tc.testSuite,
          targetFunction: tc.targetFunction,
          testType: tc.testType,
          description: tc.description,
          priority: tc.priority,
        })),
        generatedCode: result.fullContent,
      });
    },
  },
  {
    definition: {
      name: "generate-cpp-test-report",
      description:
        "Analyze C++ source code and generate a comprehensive markdown report of generated " +
        "test cases including statistics, CMake integration, test case table, and the complete " +
        "generated test file content.",
      inputSchema: {
        type: "object",
        properties: {
          source: {
            type: "string",
            description: "C++ source code to analyze",
          },
          filePath: {
            type: "string",
            description: "Original file path of the source",
          },
          includeEdgeCases: {
            type: "boolean",
            description: "Include boundary tests (default: true)",
          },
          includeNullChecks: {
            type: "boolean",
            description: "Include nullptr tests (default: true)",
          },
        },
        required: ["source", "filePath"],
      },
    },
    handler: async (args) => {
      const source = args.source as string;
      const filePath = args.filePath as string;

      if (!source || source.trim().length === 0) {
        return { content: [{ type: "text", text: "Error: source parameter is required and must be non-empty" }] };
      }
      if (!filePath || filePath.trim().length === 0) {
        return { content: [{ type: "text", text: "Error: filePath parameter is required and must be non-empty" }] };
      }

      const config: Partial<TestGenConfig> = {};
      if (args.includeEdgeCases !== undefined) config.includeEdgeCases = args.includeEdgeCases as boolean;
      if (args.includeNullChecks !== undefined) config.includeNullChecks = args.includeNullChecks as boolean;

      const result = generateCppTests(source, filePath, config);
      const markdown = exportTestGenMarkdown(result);

      return { content: [{ type: "text", text: markdown }] };
    },
  },
  {
    definition: {
      name: "analyze-cpp-source",
      description:
        "Analyze a C++ source file and extract structural information: classes, methods, " +
        "free functions, enums, includes, namespaces, and defines. Returns the analysis " +
        "without generating tests - useful for understanding file structure before test generation.",
      inputSchema: {
        type: "object",
        properties: {
          source: {
            type: "string",
            description: "C++ source code to analyze",
          },
          filePath: {
            type: "string",
            description: "File path for identification purposes",
          },
        },
        required: ["source", "filePath"],
      },
    },
    handler: async (args) => {
      const source = args.source as string;
      const filePath = args.filePath as string;

      if (!source || source.trim().length === 0) {
        return jsonResponse({ error: "source parameter is required and must be non-empty" });
      }

      const analysis = analyzeCppSource(source, filePath || "unknown.cpp");

      return jsonResponse({
        filePath: analysis.filePath,
        totalLines: analysis.totalLines,
        testableItems: analysis.testableItems,
        includes: analysis.includes,
        namespaces: analysis.namespaces,
        defines: analysis.defines,
        enums: analysis.enums.map(e => ({
          name: e.name,
          isClass: e.isClass,
          valueCount: e.values.length,
          values: e.values.slice(0, 10),
          lineNumber: e.lineNumber,
        })),
        classes: analysis.classes.map(c => ({
          name: c.name,
          baseClasses: c.baseClasses,
          isAbstract: c.isAbstract,
          methodCount: c.methods.length,
          constructorCount: c.constructors.length,
          memberVariableCount: c.memberVariables.length,
          methods: c.methods.map(m => ({
            name: m.name,
            returnType: m.returnType,
            paramCount: m.parameters.length,
            isConst: m.isConst,
            isStatic: m.isStatic,
            isVirtual: m.isVirtual,
            complexity: m.complexity,
            lineNumber: m.lineNumber,
          })),
          lineNumber: c.lineNumber,
        })),
        freeFunctions: analysis.freeFunctions.map(f => ({
          name: f.name,
          returnType: f.returnType,
          paramCount: f.parameters.length,
          parameters: f.parameters.map(p => ({
            name: p.name,
            type: p.type,
            isPointer: p.isPointer,
            isReference: p.isReference,
            isConst: p.isConst,
          })),
          isStatic: f.isStatic,
          complexity: f.complexity,
          lineNumber: f.lineNumber,
        })),
      });
    },
  },
];
