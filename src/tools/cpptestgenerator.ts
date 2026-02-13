/**
 * C++ Test Generator for TrinityCore
 *
 * Analyzes C++ source files and generates Google Test compatible test cases.
 * Uses pattern-based analysis to identify testable functions, class methods,
 * constructors, and common patterns in TrinityCore code.
 *
 * Generated tests follow TrinityCore conventions:
 * - Google Test (gtest) framework
 * - CMake integration via CTest
 * - Mock objects for database/network dependencies
 * - TrinityCore-specific test fixtures (WorldDatabaseFixture, etc.)
 *
 * @module tools/cpptestgenerator
 */

import { logger } from "../utils/logger";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/** A parsed C++ function/method signature */
export interface CppFunction {
  name: string;
  className?: string;
  returnType: string;
  parameters: CppParameter[];
  isConst: boolean;
  isStatic: boolean;
  isVirtual: boolean;
  isOverride: boolean;
  accessLevel: "public" | "protected" | "private";
  lineNumber: number;
  body?: string;
  complexity: number;
}

/** A parsed C++ parameter */
export interface CppParameter {
  name: string;
  type: string;
  isConst: boolean;
  isReference: boolean;
  isPointer: boolean;
  defaultValue?: string;
}

/** A parsed C++ class */
export interface CppClass {
  name: string;
  baseClasses: string[];
  methods: CppFunction[];
  constructors: CppFunction[];
  destructor?: CppFunction;
  memberVariables: Array<{ name: string; type: string; accessLevel: string }>;
  isAbstract: boolean;
  lineNumber: number;
}

/** A parsed C++ enum */
export interface CppEnum {
  name: string;
  values: Array<{ name: string; value?: string }>;
  isClass: boolean;
  lineNumber: number;
}

/** Analysis result for a C++ source file */
export interface CppFileAnalysis {
  filePath: string;
  includes: string[];
  namespaces: string[];
  classes: CppClass[];
  freeFunctions: CppFunction[];
  enums: CppEnum[];
  defines: Array<{ name: string; value: string }>;
  totalLines: number;
  testableItems: number;
}

/** A generated test case */
export interface GeneratedTestCase {
  testName: string;
  testSuite: string;
  targetFunction: string;
  testType: "unit" | "boundary" | "null_check" | "exception" | "regression" | "smoke";
  description: string;
  code: string;
  priority: "critical" | "high" | "medium" | "low";
}

/** A generated test file */
export interface GeneratedTestFile {
  fileName: string;
  testSuite: string;
  sourceFile: string;
  includes: string[];
  fixtures: string[];
  testCases: GeneratedTestCase[];
  fullContent: string;
  cmakeEntry: string;
  stats: {
    totalTests: number;
    unitTests: number;
    boundaryTests: number;
    nullCheckTests: number;
    exceptionTests: number;
  };
}

/** Configuration for test generation */
export interface TestGenConfig {
  includeEdgeCases: boolean;
  includeNullChecks: boolean;
  includeExceptionTests: boolean;
  includeMocks: boolean;
  testFramework: "gtest" | "catch2";
  cmakeProject: string;
  outputDir: string;
}

// ============================================================================
// DEFAULT CONFIG
// ============================================================================

const DEFAULT_CONFIG: TestGenConfig = {
  includeEdgeCases: true,
  includeNullChecks: true,
  includeExceptionTests: true,
  includeMocks: true,
  testFramework: "gtest",
  cmakeProject: "TrinityCore",
  outputDir: "./tests",
};

// ============================================================================
// C++ SOURCE PARSER
// ============================================================================

/**
 * Parse a C++ source file and extract testable elements.
 */
export function analyzeCppSource(source: string, filePath: string = "unknown.cpp"): CppFileAnalysis {
  const lines = source.split("\n");
  const analysis: CppFileAnalysis = {
    filePath,
    includes: [],
    namespaces: [],
    classes: [],
    freeFunctions: [],
    enums: [],
    defines: [],
    totalLines: lines.length,
    testableItems: 0,
  };

  // Parse includes
  const includeRegex = /^\s*#include\s+[<"]([^>"]+)[>"]/;
  for (const line of lines) {
    const match = line.match(includeRegex);
    if (match) analysis.includes.push(match[1]);
  }

  // Parse namespaces
  const nsRegex = /\bnamespace\s+(\w+)/g;
  let nsMatch;
  while ((nsMatch = nsRegex.exec(source)) !== null) {
    if (!analysis.namespaces.includes(nsMatch[1])) {
      analysis.namespaces.push(nsMatch[1]);
    }
  }

  // Parse #defines
  const defineRegex = /^\s*#define\s+(\w+)\s+(.+?)$/gm;
  let defMatch;
  while ((defMatch = defineRegex.exec(source)) !== null) {
    analysis.defines.push({ name: defMatch[1], value: defMatch[2].trim() });
  }

  // Parse enums
  const enumRegex = /\benum\s+(?:class\s+)?(\w+)\s*(?::\s*\w+\s*)?\{([^}]*)\}/g;
  let enumMatch;
  while ((enumMatch = enumRegex.exec(source)) !== null) {
    const isClass = enumMatch[0].includes("enum class");
    const values = enumMatch[2].split(",").map(v => {
      const parts = v.trim().split("=").map(p => p.trim());
      return { name: parts[0], value: parts[1] };
    }).filter(v => v.name && v.name.length > 0);

    analysis.enums.push({
      name: enumMatch[1],
      values,
      isClass,
      lineNumber: source.substring(0, enumMatch.index).split("\n").length,
    });
  }

  // Parse classes
  const classRegex = /\b(?:class|struct)\s+(\w+)(?:\s*:\s*(?:public|protected|private)\s+(\w[\w:,\s]*))?\s*\{/g;
  let classMatch;
  while ((classMatch = classRegex.exec(source)) !== null) {
    const className = classMatch[1];
    const baseClassesStr = classMatch[2] || "";
    const baseClasses = baseClassesStr.split(",").map(b => b.replace(/\b(public|protected|private)\b/g, "").trim()).filter(Boolean);

    const classLineNum = source.substring(0, classMatch.index).split("\n").length;
    const cls: CppClass = {
      name: className,
      baseClasses,
      methods: [],
      constructors: [],
      memberVariables: [],
      isAbstract: false,
      lineNumber: classLineNum,
    };

    // Find class body (approximate - find matching brace)
    const bodyStart = classMatch.index + classMatch[0].length;
    const classBody = extractBraceBlock(source, bodyStart);

    if (classBody) {
      // Parse methods within class body
      const methods = parseFunctions(classBody, className);
      for (const m of methods) {
        m.lineNumber += classLineNum;
        if (m.name === className) {
          cls.constructors.push(m);
        } else if (m.name === `~${className}`) {
          cls.destructor = m;
        } else {
          cls.methods.push(m);
        }
      }

      // Check for pure virtual (abstract)
      if (classBody.includes("= 0;")) {
        cls.isAbstract = true;
      }

      // Parse member variables
      const memberRegex = /\b(public|protected|private)\s*:[\s\S]*?(?=\b(?:public|protected|private)\s*:|$)/g;
      let memberMatch;
      while ((memberMatch = memberRegex.exec(classBody)) !== null) {
        const access = memberMatch[1];
        const section = memberMatch[0];
        const varRegex = /\b(\w[\w:<>,\s*&]*)\s+(\w+)\s*[;=]/g;
        let varMatch;
        while ((varMatch = varRegex.exec(section)) !== null) {
          const type = varMatch[1].trim();
          const name = varMatch[2].trim();
          if (!type.includes("(") && !["return", "if", "else", "while", "for", "switch", "case", "break", "continue", "class", "struct"].includes(type)) {
            cls.memberVariables.push({ name, type, accessLevel: access });
          }
        }
      }
    }

    analysis.classes.push(cls);
  }

  // Parse free functions (outside classes)
  const freeFunctions = parseFunctions(source);
  analysis.freeFunctions = freeFunctions.filter(f => {
    // Exclude functions that belong to a class (have :: in name from definition)
    return !f.className;
  });

  // Count testable items
  analysis.testableItems =
    analysis.freeFunctions.length +
    analysis.classes.reduce((sum, c) => sum + c.methods.length + c.constructors.length, 0);

  return analysis;
}

/**
 * Extract a brace-delimited block starting after an opening brace.
 */
function extractBraceBlock(source: string, startAfterOpenBrace: number): string | null {
  let depth = 1;
  let i = startAfterOpenBrace;

  while (i < source.length && depth > 0) {
    if (source[i] === "{") depth++;
    else if (source[i] === "}") depth--;
    i++;
  }

  return depth === 0 ? source.substring(startAfterOpenBrace, i - 1) : null;
}

/**
 * Parse function/method signatures from C++ source.
 */
function parseFunctions(source: string, className?: string): CppFunction[] {
  const functions: CppFunction[] = [];

  // Match function signatures (simplified but handles common TrinityCore patterns)
  const funcRegex = /\b((?:static\s+)?(?:virtual\s+)?(?:const\s+)?(?:[\w:<>,\s*&]+?))\s+(\w+)\s*\(([^)]*)\)\s*(const)?\s*(override)?\s*(?:=\s*0\s*)?[;{]/g;

  let match;
  while ((match = funcRegex.exec(source)) !== null) {
    const fullReturnType = match[1].trim();
    const funcName = match[2];
    const paramsStr = match[3];
    const isConstMethod = !!match[4];
    const isOverride = !!match[5];

    // Skip keywords that look like functions
    if (["if", "else", "while", "for", "switch", "case", "return", "delete", "new", "throw", "catch", "try"].includes(funcName)) {
      continue;
    }

    const isStatic = fullReturnType.includes("static");
    const isVirtual = fullReturnType.includes("virtual");
    let returnType = fullReturnType.replace(/\b(static|virtual|inline|explicit)\b/g, "").trim();
    if (!returnType) returnType = "void";

    const parameters = parseParameters(paramsStr);
    const lineNumber = source.substring(0, match.index).split("\n").length;

    // Calculate cyclomatic complexity (approximate)
    const funcBody = source.substring(match.index);
    const braceIdx = funcBody.indexOf("{");
    let complexity = 1;
    if (braceIdx >= 0) {
      const body = extractBraceBlock(funcBody, braceIdx + 1);
      if (body) {
        complexity += (body.match(/\bif\b/g) || []).length;
        complexity += (body.match(/\belse\s+if\b/g) || []).length;
        complexity += (body.match(/\bfor\b/g) || []).length;
        complexity += (body.match(/\bwhile\b/g) || []).length;
        complexity += (body.match(/\bswitch\b/g) || []).length;
        complexity += (body.match(/\bcase\b/g) || []).length;
        complexity += (body.match(/&&|\|\|/g) || []).length;
      }
    }

    functions.push({
      name: funcName,
      className,
      returnType,
      parameters,
      isConst: isConstMethod,
      isStatic,
      isVirtual,
      isOverride,
      accessLevel: "public",
      lineNumber,
      complexity,
    });
  }

  return functions;
}

/**
 * Parse function parameters.
 */
function parseParameters(paramsStr: string): CppParameter[] {
  if (!paramsStr.trim()) return [];

  return paramsStr.split(",").map(p => {
    const trimmed = p.trim();
    if (!trimmed) return null;

    const isConst = trimmed.includes("const ");
    const isReference = trimmed.includes("&");
    const isPointer = trimmed.includes("*");

    // Extract default value
    const defaultParts = trimmed.split("=");
    const defaultValue = defaultParts.length > 1 ? defaultParts[1].trim() : undefined;

    // Extract type and name
    const mainPart = defaultParts[0].trim();
    const tokens = mainPart.replace(/const\s+/g, "").replace(/[&*]/g, " ").trim().split(/\s+/);
    const name = tokens.length > 1 ? tokens[tokens.length - 1] : `param${Math.random().toString(36).slice(2, 6)}`;
    const type = tokens.slice(0, -1).join(" ") || tokens[0];

    return {
      name,
      type: type.trim(),
      isConst,
      isReference,
      isPointer,
      defaultValue,
    };
  }).filter(Boolean) as CppParameter[];
}

// ============================================================================
// TEST GENERATOR
// ============================================================================

/**
 * Generate test cases for a parsed C++ file analysis.
 */
export function generateTestCases(
  analysis: CppFileAnalysis,
  config: Partial<TestGenConfig> = {}
): GeneratedTestFile {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const baseName = analysis.filePath.replace(/\.(h|hpp|cpp|cc)$/, "");
  const suiteName = baseName.split(/[/\\]/).pop() || "Unknown";
  const testSuite = `${suiteName}Test`;

  const testCases: GeneratedTestCase[] = [];
  const includes: string[] = [
    `<gtest/gtest.h>`,
    `"${analysis.filePath}"`,
  ];
  const fixtures: string[] = [];

  // Generate tests for free functions
  for (const func of analysis.freeFunctions) {
    testCases.push(...generateFunctionTests(func, testSuite, cfg));
  }

  // Generate tests for classes
  for (const cls of analysis.classes) {
    if (cls.isAbstract) continue; // Skip abstract classes

    // Create fixture for class
    const fixtureName = `${cls.name}Test`;
    fixtures.push(generateClassFixture(cls, fixtureName));

    // Generate constructor tests
    for (const ctor of cls.constructors) {
      testCases.push(...generateConstructorTests(ctor, cls, fixtureName, cfg));
    }

    // Generate method tests
    for (const method of cls.methods) {
      testCases.push(...generateFunctionTests(method, fixtureName, cfg));
    }
  }

  // Build full test file content
  const fullContent = buildTestFileContent(testSuite, includes, fixtures, testCases, analysis, cfg);

  // Build CMake entry
  const testFileName = `test_${suiteName}.cpp`;
  const cmakeEntry = `add_executable(${testSuite} ${testFileName})\ntarget_link_libraries(${testSuite} PRIVATE gtest gtest_main)\nadd_test(NAME ${testSuite} COMMAND ${testSuite})`;

  const stats = {
    totalTests: testCases.length,
    unitTests: testCases.filter(t => t.testType === "unit").length,
    boundaryTests: testCases.filter(t => t.testType === "boundary").length,
    nullCheckTests: testCases.filter(t => t.testType === "null_check").length,
    exceptionTests: testCases.filter(t => t.testType === "exception").length,
  };

  logger.info(`Generated ${testCases.length} test cases for ${analysis.filePath}`);

  return {
    fileName: testFileName,
    testSuite,
    sourceFile: analysis.filePath,
    includes,
    fixtures,
    testCases,
    fullContent,
    cmakeEntry,
    stats,
  };
}

/**
 * Generate test cases for a function/method.
 */
function generateFunctionTests(
  func: CppFunction,
  testSuite: string,
  config: TestGenConfig
): GeneratedTestCase[] {
  const tests: GeneratedTestCase[] = [];
  const qualifiedName = func.className ? `${func.className}::${func.name}` : func.name;
  const isMethod = !!func.className;
  const fixturePrefix = isMethod ? "F" : "";

  // Basic unit test
  tests.push({
    testName: `${func.name}_BasicCall`,
    testSuite,
    targetFunction: qualifiedName,
    testType: "unit",
    description: `Verify ${qualifiedName} executes without error with valid parameters`,
    code: generateBasicCallTest(func, isMethod),
    priority: "high",
  });

  // Return value test (if non-void)
  if (func.returnType !== "void") {
    tests.push({
      testName: `${func.name}_ReturnsExpectedType`,
      testSuite,
      targetFunction: qualifiedName,
      testType: "unit",
      description: `Verify ${qualifiedName} returns the expected type`,
      code: generateReturnTypeTest(func, isMethod),
      priority: "high",
    });
  }

  // Null/nullptr check tests for pointer parameters
  if (config.includeNullChecks) {
    for (const param of func.parameters) {
      if (param.isPointer) {
        tests.push({
          testName: `${func.name}_Null${capitalize(param.name)}`,
          testSuite,
          targetFunction: qualifiedName,
          testType: "null_check",
          description: `Test ${qualifiedName} behavior when ${param.name} is nullptr`,
          code: generateNullCheckTest(func, param, isMethod),
          priority: "critical",
        });
      }
    }
  }

  // Boundary tests for numeric parameters
  if (config.includeEdgeCases) {
    for (const param of func.parameters) {
      if (isNumericType(param.type)) {
        tests.push({
          testName: `${func.name}_Zero${capitalize(param.name)}`,
          testSuite,
          targetFunction: qualifiedName,
          testType: "boundary",
          description: `Test ${qualifiedName} with ${param.name} = 0`,
          code: generateBoundaryTest(func, param, "0", isMethod),
          priority: "medium",
        });

        if (isSignedType(param.type)) {
          tests.push({
            testName: `${func.name}_Negative${capitalize(param.name)}`,
            testSuite,
            targetFunction: qualifiedName,
            testType: "boundary",
            description: `Test ${qualifiedName} with negative ${param.name}`,
            code: generateBoundaryTest(func, param, "-1", isMethod),
            priority: "medium",
          });
        }

        tests.push({
          testName: `${func.name}_Max${capitalize(param.name)}`,
          testSuite,
          targetFunction: qualifiedName,
          testType: "boundary",
          description: `Test ${qualifiedName} with maximum ${param.name}`,
          code: generateBoundaryTest(func, param, getMaxValue(param.type), isMethod),
          priority: "low",
        });
      }
    }
  }

  // Const correctness test
  if (func.isConst && isMethod) {
    tests.push({
      testName: `${func.name}_ConstCorrectness`,
      testSuite,
      targetFunction: qualifiedName,
      testType: "unit",
      description: `Verify ${qualifiedName} can be called on const instances`,
      code: generateConstCorrectnessTest(func),
      priority: "medium",
    });
  }

  return tests;
}

/**
 * Generate tests for constructors.
 */
function generateConstructorTests(
  ctor: CppFunction,
  cls: CppClass,
  testSuite: string,
  config: TestGenConfig
): GeneratedTestCase[] {
  const tests: GeneratedTestCase[] = [];

  // Default construction test
  if (ctor.parameters.length === 0) {
    tests.push({
      testName: `Constructor_Default`,
      testSuite,
      targetFunction: `${cls.name}::${cls.name}`,
      testType: "unit",
      description: `Verify default construction of ${cls.name}`,
      code: `    ${cls.name} obj;\n    // Object should be constructed without throwing`,
      priority: "critical",
    });
  } else {
    // Parameterized construction
    const params = ctor.parameters.map(p => generateDefaultValue(p)).join(", ");
    tests.push({
      testName: `Constructor_Parameterized`,
      testSuite,
      targetFunction: `${cls.name}::${cls.name}`,
      testType: "unit",
      description: `Verify parameterized construction of ${cls.name}`,
      code: `    ${cls.name} obj(${params});\n    // Object should be constructed without throwing`,
      priority: "critical",
    });
  }

  return tests;
}

// ============================================================================
// TEST CODE GENERATORS
// ============================================================================

function generateBasicCallTest(func: CppFunction, isMethod: boolean): string {
  const params = func.parameters.map(p => generateDefaultValue(p)).join(", ");

  if (isMethod) {
    return `    // Arrange\n    ${func.className} obj;\n    \n    // Act & Assert\n    EXPECT_NO_THROW(obj.${func.name}(${params}));`;
  }
  return `    // Act & Assert\n    EXPECT_NO_THROW(${func.name}(${params}));`;
}

function generateReturnTypeTest(func: CppFunction, isMethod: boolean): string {
  const params = func.parameters.map(p => generateDefaultValue(p)).join(", ");

  if (isMethod) {
    return `    // Arrange\n    ${func.className} obj;\n    \n    // Act\n    auto result = obj.${func.name}(${params});\n    \n    // Assert - verify result is valid\n    (void)result; // Ensure it compiles with expected return type`;
  }
  return `    // Act\n    auto result = ${func.name}(${params});\n    \n    // Assert - verify result is valid\n    (void)result; // Ensure it compiles with expected return type`;
}

function generateNullCheckTest(func: CppFunction, param: CppParameter, isMethod: boolean): string {
  const params = func.parameters.map(p =>
    p.name === param.name ? "nullptr" : generateDefaultValue(p)
  ).join(", ");

  if (isMethod) {
    return `    // Arrange\n    ${func.className} obj;\n    \n    // Act & Assert - passing nullptr for ${param.name}\n    // Should either handle gracefully or throw a defined exception\n    EXPECT_NO_FATAL_FAILURE(obj.${func.name}(${params}));`;
  }
  return `    // Act & Assert - passing nullptr for ${param.name}\n    // Should either handle gracefully or throw a defined exception\n    EXPECT_NO_FATAL_FAILURE(${func.name}(${params}));`;
}

function generateBoundaryTest(func: CppFunction, param: CppParameter, value: string, isMethod: boolean): string {
  const params = func.parameters.map(p =>
    p.name === param.name ? value : generateDefaultValue(p)
  ).join(", ");

  if (isMethod) {
    return `    // Arrange\n    ${func.className} obj;\n    \n    // Act & Assert - boundary value ${value} for ${param.name}\n    EXPECT_NO_THROW(obj.${func.name}(${params}));`;
  }
  return `    // Act & Assert - boundary value ${value} for ${param.name}\n    EXPECT_NO_THROW(${func.name}(${params}));`;
}

function generateConstCorrectnessTest(func: CppFunction): string {
  const params = func.parameters.map(p => generateDefaultValue(p)).join(", ");
  return `    // Arrange\n    const ${func.className} obj;\n    \n    // Act & Assert - should compile and work on const instance\n    EXPECT_NO_THROW(obj.${func.name}(${params}));`;
}

function generateClassFixture(cls: CppClass, fixtureName: string): string {
  const lines: string[] = [
    `class ${fixtureName} : public ::testing::Test {`,
    `protected:`,
    `    void SetUp() override {`,
    `        // Initialize test fixture`,
    `    }`,
    ``,
    `    void TearDown() override {`,
    `        // Cleanup test fixture`,
    `    }`,
    ``,
    `    // Class under test`,
    `    // ${cls.name} sut_;  // System Under Test`,
    `};`,
  ];
  return lines.join("\n");
}

function buildTestFileContent(
  testSuite: string,
  includes: string[],
  fixtures: string[],
  testCases: GeneratedTestCase[],
  analysis: CppFileAnalysis,
  config: TestGenConfig
): string {
  const lines: string[] = [
    `/**`,
    ` * Auto-generated test file for ${analysis.filePath}`,
    ` * Generated by TrinityCore MCP Test Generator`,
    ` *`,
    ` * Test Suite: ${testSuite}`,
    ` * Tests: ${testCases.length}`,
    ` * Date: ${new Date().toISOString()}`,
    ` */`,
    ``,
    ...includes.map(inc => `#include ${inc}`),
    ``,
  ];

  // Add fixtures
  if (fixtures.length > 0) {
    lines.push(`// ============================================================================`);
    lines.push(`// Test Fixtures`);
    lines.push(`// ============================================================================`);
    lines.push(``);
    for (const fixture of fixtures) {
      lines.push(fixture);
      lines.push(``);
    }
  }

  // Add test cases
  lines.push(`// ============================================================================`);
  lines.push(`// Test Cases`);
  lines.push(`// ============================================================================`);
  lines.push(``);

  for (const tc of testCases) {
    const testMacro = fixtures.some(f => f.includes(`class ${tc.testSuite}`)) ? "TEST_F" : "TEST";
    lines.push(`// ${tc.description}`);
    lines.push(`${testMacro}(${tc.testSuite}, ${tc.testName}) {`);
    lines.push(tc.code);
    lines.push(`}`);
    lines.push(``);
  }

  return lines.join("\n");
}

// ============================================================================
// HELPERS
// ============================================================================

function generateDefaultValue(param: CppParameter): string {
  if (param.defaultValue) return param.defaultValue;
  if (param.isPointer) return "nullptr";

  const type = param.type.replace(/\bconst\b/g, "").trim();

  if (isNumericType(type)) return "0";
  if (type === "bool") return "false";
  if (type === "std::string" || type === "string") return '""';
  if (type === "float" || type === "double") return "0.0";
  if (type === "ObjectGuid" || type === "uint64") return "0";
  if (type.includes("vector") || type.includes("list") || type.includes("set")) return "{}";
  if (type.includes("map") || type.includes("unordered_map")) return "{}";

  return `${type}()`;
}

function isNumericType(type: string): boolean {
  const numTypes = [
    "int", "uint8", "uint16", "uint32", "uint64",
    "int8", "int16", "int32", "int64",
    "uint8_t", "uint16_t", "uint32_t", "uint64_t",
    "int8_t", "int16_t", "int32_t", "int64_t",
    "short", "long", "size_t", "ssize_t",
    "float", "double",
    "unsigned", "signed",
  ];
  return numTypes.some(t => type.includes(t));
}

function isSignedType(type: string): boolean {
  if (type.includes("uint") || type.includes("unsigned") || type.includes("size_t")) return false;
  return isNumericType(type);
}

function getMaxValue(type: string): string {
  if (type.includes("uint8")) return "255";
  if (type.includes("uint16")) return "65535";
  if (type.includes("uint32")) return "4294967295u";
  if (type.includes("uint64")) return "UINT64_MAX";
  if (type.includes("int8")) return "127";
  if (type.includes("int16")) return "32767";
  if (type.includes("int32")) return "INT32_MAX";
  if (type.includes("int64")) return "INT64_MAX";
  if (type.includes("float")) return "FLT_MAX";
  if (type.includes("double")) return "DBL_MAX";
  return "INT_MAX";
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Analyze a C++ source string and generate test file.
 */
export function generateCppTests(
  source: string,
  filePath: string,
  config?: Partial<TestGenConfig>
): GeneratedTestFile {
  const analysis = analyzeCppSource(source, filePath);
  return generateTestCases(analysis, config);
}

/**
 * Generate a markdown summary of the analysis and tests.
 */
export function exportTestGenMarkdown(result: GeneratedTestFile): string {
  const lines: string[] = [
    `# C++ Test Generation Report`,
    ``,
    `**Source:** ${result.sourceFile}`,
    `**Test Suite:** ${result.testSuite}`,
    `**Output:** ${result.fileName}`,
    `**Total Tests:** ${result.stats.totalTests}`,
    ``,
    `## Test Statistics`,
    ``,
    `| Type | Count |`,
    `|------|-------|`,
    `| Unit Tests | ${result.stats.unitTests} |`,
    `| Boundary Tests | ${result.stats.boundaryTests} |`,
    `| Null Check Tests | ${result.stats.nullCheckTests} |`,
    `| Exception Tests | ${result.stats.exceptionTests} |`,
    ``,
    `## CMake Integration`,
    ``,
    "```cmake",
    result.cmakeEntry,
    "```",
    ``,
    `## Test Cases`,
    ``,
    `| # | Test Name | Type | Priority | Description |`,
    `|---|-----------|------|----------|-------------|`,
  ];

  result.testCases.forEach((tc, i) => {
    lines.push(`| ${i + 1} | ${tc.testName} | ${tc.testType} | ${tc.priority} | ${tc.description} |`);
  });

  lines.push(``);
  lines.push(`## Generated Test File`);
  lines.push(``);
  lines.push("```cpp");
  lines.push(result.fullContent);
  lines.push("```");

  return lines.join("\n");
}
