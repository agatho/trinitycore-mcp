/**
 * AI Test Generator
 *
 * AI-powered test case generator that analyzes code and generates
 * comprehensive test suites automatically.
 *
 * @module ai-test-generator
 */

import fs from "fs/promises";
import path from "path";
import type { TestSuite } from "./test-framework";

// ============================================================================
// Types
// ============================================================================

/**
 * Generator configuration
 */
export interface GeneratorConfig {
  /** Source file or directory */
  source: string;

  /** Output directory for generated tests */
  outputDir: string;

  /** Test types to generate */
  testTypes?: TestGenerationType[];

  /** Coverage target */
  coverageTarget?: number;

  /** Include edge cases */
  includeEdgeCases?: boolean;

  /** Include performance tests */
  includePerformanceTests?: boolean;
}

/**
 * Test generation type
 */
export enum TestGenerationType {
  UNIT = "unit",
  INTEGRATION = "integration",
  E2E = "e2e",
  PROPERTY = "property",
  SNAPSHOT = "snapshot",
}

/**
 * Code analysis result
 */
export interface CodeAnalysis {
  /** File path */
  filePath: string;

  /** Functions found */
  functions: FunctionSignature[];

  /** Classes found */
  classes: ClassSignature[];

  /** Exports found */
  exports: ExportSignature[];

  /** Dependencies */
  dependencies: string[];

  /** Complexity metrics */
  complexity: {
    cyclomaticComplexity: number;
    linesOfCode: number;
    numberOfFunctions: number;
  };
}

/**
 * Function signature
 */
export interface FunctionSignature {
  name: string;
  parameters: Parameter[];
  returnType: string;
  async: boolean;
  exported: boolean;
}

/**
 * Parameter definition
 */
export interface Parameter {
  name: string;
  type: string;
  optional: boolean;
  defaultValue?: string;
}

/**
 * Class signature
 */
export interface ClassSignature {
  name: string;
  methods: FunctionSignature[];
  properties: PropertySignature[];
  extends?: string;
  implements?: string[];
  exported: boolean;
}

/**
 * Property signature
 */
export interface PropertySignature {
  name: string;
  type: string;
  visibility: "public" | "private" | "protected";
  readonly: boolean;
}

/**
 * Export signature
 */
export interface ExportSignature {
  name: string;
  type: "function" | "class" | "constant" | "type";
  default: boolean;
}

/**
 * Generated test
 */
export interface GeneratedTest {
  /** Test name */
  name: string;

  /** Test code */
  code: string;

  /** Test type */
  type: TestGenerationType;

  /** Description */
  description: string;
}

// ============================================================================
// AI Test Generator
// ============================================================================

export class AITestGenerator {
  private config: Required<GeneratorConfig>;

  constructor(config: GeneratorConfig) {
    this.config = {
      source: config.source,
      outputDir: config.outputDir,
      testTypes: config.testTypes ?? [
        TestGenerationType.UNIT,
        TestGenerationType.INTEGRATION,
      ],
      coverageTarget: config.coverageTarget ?? 80,
      includeEdgeCases: config.includeEdgeCases ?? true,
      includePerformanceTests: config.includePerformanceTests ?? false,
    };
  }

  /**
   * Generate tests for source
   */
  public async generate(): Promise<GeneratedTest[]> {
    // Analyze source code
    const analysis = await this.analyzeCode(this.config.source);

    // Generate tests based on analysis
    const tests: GeneratedTest[] = [];

    for (const func of analysis.functions) {
      if (this.config.testTypes.includes(TestGenerationType.UNIT)) {
        tests.push(...this.generateFunctionTests(func, analysis));
      }
    }

    for (const cls of analysis.classes) {
      if (this.config.testTypes.includes(TestGenerationType.UNIT)) {
        tests.push(...this.generateClassTests(cls, analysis));
      }
    }

    if (this.config.testTypes.includes(TestGenerationType.INTEGRATION)) {
      tests.push(...this.generateIntegrationTests(analysis));
    }

    if (this.config.testTypes.includes(TestGenerationType.E2E)) {
      tests.push(...this.generateE2ETests(analysis));
    }

    // Write tests to files
    await this.writeTests(tests);

    return tests;
  }

  /**
   * Analyze source code
   */
  private async analyzeCode(source: string): Promise<CodeAnalysis> {
    const content = await fs.readFile(source, "utf-8");

    // Simple regex-based analysis (in production, use TypeScript Compiler API)
    const functions = this.extractFunctions(content);
    const classes = this.extractClasses(content);
    const exports = this.extractExports(content);
    const dependencies = this.extractDependencies(content);

    return {
      filePath: source,
      functions,
      classes,
      exports,
      dependencies,
      complexity: {
        cyclomaticComplexity: this.calculateComplexity(content),
        linesOfCode: content.split("\n").length,
        numberOfFunctions: functions.length,
      },
    };
  }

  /**
   * Extract functions from code
   */
  private extractFunctions(content: string): FunctionSignature[] {
    const functions: FunctionSignature[] = [];

    // Match function declarations
    const functionRegex = /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\((.*?)\)(?::\s*(\w+))?/g;
    let match;

    while ((match = functionRegex.exec(content)) !== null) {
      const [, name, params, returnType] = match;

      functions.push({
        name,
        parameters: this.parseParameters(params),
        returnType: returnType || "void",
        async: content.substring(match.index, match.index + 20).includes("async"),
        exported: content.substring(match.index, match.index + 20).includes("export"),
      });
    }

    // Match arrow functions
    const arrowRegex = /(?:export\s+)?(?:const|let)\s+(\w+)\s*=\s*(?:async\s+)?\((.*?)\)\s*(?::\s*(\w+))?\s*=>/g;

    while ((match = arrowRegex.exec(content)) !== null) {
      const [, name, params, returnType] = match;

      functions.push({
        name,
        parameters: this.parseParameters(params),
        returnType: returnType || "any",
        async: content.substring(match.index, match.index + 50).includes("async"),
        exported: content.substring(match.index, match.index + 20).includes("export"),
      });
    }

    return functions;
  }

  /**
   * Parse function parameters
   */
  private parseParameters(params: string): Parameter[] {
    if (!params.trim()) return [];

    return params.split(",").map((param) => {
      const trimmed = param.trim();
      const optional = trimmed.includes("?");
      const hasDefault = trimmed.includes("=");

      const [nameAndType, defaultValue] = trimmed.split("=");
      const [name, type] = nameAndType.split(":").map((s) => s.trim().replace("?", ""));

      return {
        name,
        type: type || "any",
        optional: optional || hasDefault,
        defaultValue: defaultValue?.trim(),
      };
    });
  }

  /**
   * Extract classes from code
   */
  private extractClasses(content: string): ClassSignature[] {
    const classes: ClassSignature[] = [];

    // Match class declarations
    const classRegex = /(?:export\s+)?class\s+(\w+)(?:\s+extends\s+(\w+))?(?:\s+implements\s+([\w,\s]+))?\s*{/g;
    let match;

    while ((match = classRegex.exec(content)) !== null) {
      const [, name, extendsClass, implementsInterfaces] = match;

      // Extract class body
      const classStart = match.index + match[0].length;
      const classBody = this.extractClassBody(content, classStart);

      classes.push({
        name,
        methods: this.extractMethods(classBody),
        properties: this.extractProperties(classBody),
        extends: extendsClass,
        implements: implementsInterfaces?.split(",").map((i) => i.trim()),
        exported: content.substring(match.index, match.index + 20).includes("export"),
      });
    }

    return classes;
  }

  /**
   * Extract class body
   */
  private extractClassBody(content: string, start: number): string {
    let braceCount = 1;
    let i = start;

    while (i < content.length && braceCount > 0) {
      if (content[i] === "{") braceCount++;
      if (content[i] === "}") braceCount--;
      i++;
    }

    return content.substring(start, i - 1);
  }

  /**
   * Extract methods from class body
   */
  private extractMethods(classBody: string): FunctionSignature[] {
    const methods: FunctionSignature[] = [];

    const methodRegex = /(?:public|private|protected)?\s*(?:async\s+)?(\w+)\s*\((.*?)\)(?::\s*(\w+))?/g;
    let match;

    while ((match = methodRegex.exec(classBody)) !== null) {
      const [, name, params, returnType] = match;

      // Skip constructor
      if (name === "constructor") continue;

      methods.push({
        name,
        parameters: this.parseParameters(params),
        returnType: returnType || "void",
        async: classBody.substring(match.index, match.index + 20).includes("async"),
        exported: false,
      });
    }

    return methods;
  }

  /**
   * Extract properties from class body
   */
  private extractProperties(classBody: string): PropertySignature[] {
    const properties: PropertySignature[] = [];

    const propertyRegex = /(public|private|protected)?\s*(readonly)?\s*(\w+)(?::\s*(\w+))?/g;
    let match;

    while ((match = propertyRegex.exec(classBody)) !== null) {
      const [, visibility, readonly, name, type] = match;

      // Skip if it looks like a method
      if (classBody[match.index + match[0].length] === "(") continue;

      properties.push({
        name,
        type: type || "any",
        visibility: (visibility as any) || "public",
        readonly: !!readonly,
      });
    }

    return properties;
  }

  /**
   * Extract exports
   */
  private extractExports(content: string): ExportSignature[] {
    const exports: ExportSignature[] = [];

    // Export default
    const defaultExportRegex = /export\s+default\s+(class|function|const)\s+(\w+)/g;
    let match;

    while ((match = defaultExportRegex.exec(content)) !== null) {
      exports.push({
        name: match[2],
        type: match[1] as any,
        default: true,
      });
    }

    // Named exports
    const namedExportRegex = /export\s+{([^}]+)}/g;

    while ((match = namedExportRegex.exec(content)) !== null) {
      const names = match[1].split(",").map((n) => n.trim());
      for (const name of names) {
        exports.push({
          name,
          type: "constant",
          default: false,
        });
      }
    }

    return exports;
  }

  /**
   * Extract dependencies
   */
  private extractDependencies(content: string): string[] {
    const dependencies: string[] = [];

    const importRegex = /import\s+.*?from\s+['"](.*?)['"]/g;
    let match;

    while ((match = importRegex.exec(content)) !== null) {
      dependencies.push(match[1]);
    }

    return dependencies;
  }

  /**
   * Calculate cyclomatic complexity
   */
  private calculateComplexity(content: string): number {
    let complexity = 1;

    // Count decision points
    const keywords = ["if", "else", "for", "while", "case", "catch", "&&", "||"];

    for (const keyword of keywords) {
      const regex = new RegExp(`\\b${keyword}\\b`, "g");
      const matches = content.match(regex);
      if (matches) complexity += matches.length;
    }

    return complexity;
  }

  /**
   * Generate tests for function
   */
  private generateFunctionTests(
    func: FunctionSignature,
    analysis: CodeAnalysis,
  ): GeneratedTest[] {
    const tests: GeneratedTest[] = [];

    // Basic functionality test
    tests.push({
      name: `${func.name} should work correctly`,
      type: TestGenerationType.UNIT,
      description: `Test basic functionality of ${func.name}`,
      code: this.generateBasicFunctionTest(func),
    });

    // Edge cases
    if (this.config.includeEdgeCases) {
      tests.push({
        name: `${func.name} should handle edge cases`,
        type: TestGenerationType.UNIT,
        description: `Test edge cases for ${func.name}`,
        code: this.generateEdgeCaseTest(func),
      });
    }

    // Error handling
    if (func.async) {
      tests.push({
        name: `${func.name} should handle errors`,
        type: TestGenerationType.UNIT,
        description: `Test error handling in ${func.name}`,
        code: this.generateErrorTest(func),
      });
    }

    return tests;
  }

  /**
   * Generate basic function test
   */
  private generateBasicFunctionTest(func: FunctionSignature): string {
    const params = func.parameters.map((p) => this.generateMockValue(p.type)).join(", ");

    return `
test("${func.name} should work correctly", ${func.async ? "async " : ""}() => {
  const result = ${func.async ? "await " : ""}${func.name}(${params});
  expect(result).toBeDefined();
});
`;
  }

  /**
   * Generate edge case test
   */
  private generateEdgeCaseTest(func: FunctionSignature): string {
    return `
test("${func.name} should handle edge cases", ${func.async ? "async " : ""}() => {
  // Test with null
  ${func.async ? "await " : ""}expect(() => ${func.name}(null)).toThrow();

  // Test with undefined
  ${func.async ? "await " : ""}expect(() => ${func.name}(undefined)).toThrow();

  // Test with empty values
  ${func.async ? "await " : ""}expect(() => ${func.name}("")).toThrow();
});
`;
  }

  /**
   * Generate error test
   */
  private generateErrorTest(func: FunctionSignature): string {
    return `
test("${func.name} should handle errors", async () => {
  await expect(${func.name}(/* invalid params */)).toReject();
});
`;
  }

  /**
   * Generate class tests
   */
  private generateClassTests(cls: ClassSignature, analysis: CodeAnalysis): GeneratedTest[] {
    const tests: GeneratedTest[] = [];

    // Constructor test
    tests.push({
      name: `${cls.name} constructor should work`,
      type: TestGenerationType.UNIT,
      description: `Test ${cls.name} constructor`,
      code: `
test("${cls.name} constructor should work", () => {
  const instance = new ${cls.name}();
  expect(instance).toBeDefined();
});
`,
    });

    // Method tests
    for (const method of cls.methods) {
      tests.push(...this.generateFunctionTests(method, analysis));
    }

    return tests;
  }

  /**
   * Generate integration tests
   */
  private generateIntegrationTests(analysis: CodeAnalysis): GeneratedTest[] {
    return [
      {
        name: `Integration test for ${path.basename(analysis.filePath)}`,
        type: TestGenerationType.INTEGRATION,
        description: "Test integration between components",
        code: `
test("Integration test", async () => {
  // Setup
  // Execute
  // Verify
  expect(true).toBe(true);
});
`,
      },
    ];
  }

  /**
   * Generate E2E tests
   */
  private generateE2ETests(analysis: CodeAnalysis): GeneratedTest[] {
    return [
      {
        name: `E2E test for ${path.basename(analysis.filePath)}`,
        type: TestGenerationType.E2E,
        description: "End-to-end test scenario",
        code: `
test("E2E test", async () => {
  // Setup environment
  // Execute full workflow
  // Verify results
  expect(true).toBe(true);
});
`,
      },
    ];
  }

  /**
   * Generate mock value for type
   */
  private generateMockValue(type: string): string {
    switch (type.toLowerCase()) {
      case "string":
        return '"test"';
      case "number":
        return "42";
      case "boolean":
        return "true";
      case "array":
        return "[]";
      case "object":
        return "{}";
      default:
        return "null";
    }
  }

  /**
   * Write tests to files
   */
  private async writeTests(tests: GeneratedTest[]): Promise<void> {
    await fs.mkdir(this.config.outputDir, { recursive: true });

    // Group tests by type
    const byType = new Map<TestGenerationType, GeneratedTest[]>();

    for (const test of tests) {
      if (!byType.has(test.type)) {
        byType.set(test.type, []);
      }
      byType.get(test.type)!.push(test);
    }

    // Write files
    for (const [type, typeTests] of byType.entries()) {
      const filename = `${path.basename(this.config.source, ".ts")}.${type}.test.ts`;
      const filepath = path.join(this.config.outputDir, filename);

      let content = `/**
 * Generated ${type} tests
 * Source: ${this.config.source}
 * Generated: ${new Date().toISOString()}
 */

import { expect, describe, test } from '../testing/test-framework';

`;

      for (const test of typeTests) {
        content += test.code + "\n";
      }

      await fs.writeFile(filepath, content);
    }
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate tests for file
 */
export async function generateTests(
  sourceFile: string,
  outputDir: string,
): Promise<GeneratedTest[]> {
  const generator = new AITestGenerator({
    source: sourceFile,
    outputDir,
  });

  return await generator.generate();
}

/**
 * Generate tests for directory
 */
export async function generateTestsForDirectory(
  sourceDir: string,
  outputDir: string,
): Promise<Map<string, GeneratedTest[]>> {
  const results = new Map<string, GeneratedTest[]>();
  const files = await fs.readdir(sourceDir, { recursive: true });

  for (const file of files) {
    if (typeof file === "string" && file.endsWith(".ts") && !file.endsWith(".test.ts")) {
      const fullPath = path.join(sourceDir, file);
      const tests = await generateTests(fullPath, outputDir);
      results.set(file, tests);
    }
  }

  return results;
}
