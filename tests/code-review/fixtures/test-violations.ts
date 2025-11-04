/**
 * Test Fixtures - Expected Violations
 * Defines expected violations for testing rule accuracy
 */

import type { RuleViolation } from "../../../src/code-review/types";

export const expectedNullSafetyViolations: Partial<RuleViolation>[] = [
  {
    ruleId: "trinity-null-001",
    severity: "critical",
    message: "Potential null pointer dereference",
    line: 9,
    file: "sample-code.cpp",
    metadata: {
      category: "null_safety",
    },
  },
  {
    ruleId: "trinity-null-002",
    severity: "major",
    message: "Missing null check after allocation",
    line: 15,
    file: "sample-code.cpp",
    metadata: {
      category: "null_safety",
    },
  },
];

export const expectedMemoryViolations: Partial<RuleViolation>[] = [
  {
    ruleId: "trinity-mem-001",
    severity: "critical",
    message: "Memory leak detected",
    line: 27,
    file: "sample-code.cpp",
    metadata: {
      category: "memory",
    },
  },
  {
    ruleId: "trinity-mem-002",
    severity: "critical",
    message: "Double delete/free detected",
    line: 34,
    file: "sample-code.cpp",
    metadata: {
      category: "memory",
    },
  },
];

export const expectedConcurrencyViolations: Partial<RuleViolation>[] = [
  {
    ruleId: "trinity-conc-001",
    severity: "critical",
    message: "Race condition: unsynchronized access to shared data",
    line: 47,
    file: "sample-code.cpp",
    metadata: {
      category: "concurrency",
    },
  },
];

export const expectedConventionViolations: Partial<RuleViolation>[] = [
  {
    ruleId: "trinity-conv-001",
    severity: "minor",
    message: "Class name should use PascalCase (TrinityCore convention)",
    line: 63,
    file: "sample-code.cpp",
    metadata: {
      category: "convention",
    },
  },
  {
    ruleId: "trinity-conv-002",
    severity: "minor",
    message: "Method name should use PascalCase (TrinityCore convention)",
    line: 64,
    file: "sample-code.cpp",
    metadata: {
      category: "convention",
    },
  },
];

export const expectedSecurityViolations: Partial<RuleViolation>[] = [
  {
    ruleId: "trinity-sec-001",
    severity: "critical",
    message: "SQL injection vulnerability",
    line: 76,
    file: "sample-code.cpp",
    metadata: {
      category: "security",
    },
  },
  {
    ruleId: "trinity-sec-002",
    severity: "critical",
    message: "Buffer overflow risk: use of strcpy",
    line: 82,
    file: "sample-code.cpp",
    metadata: {
      category: "security",
    },
  },
];

export const expectedPerformanceViolations: Partial<RuleViolation>[] = [
  {
    ruleId: "trinity-perf-001",
    severity: "major",
    message: "Inefficient string concatenation in loop",
    line: 90,
    file: "sample-code.cpp",
    metadata: {
      category: "performance",
    },
  },
  {
    ruleId: "trinity-perf-002",
    severity: "major",
    message: "Large object passed by value",
    line: 101,
    file: "sample-code.cpp",
    metadata: {
      category: "performance",
    },
  },
];

export const expectedArchitectureViolations: Partial<RuleViolation>[] = [
  {
    ruleId: "trinity-arch-001",
    severity: "major",
    message: "God class detected: too many responsibilities",
    line: 108,
    file: "sample-code.cpp",
    metadata: {
      category: "architecture",
    },
  },
];

/**
 * All expected violations combined
 */
export const allExpectedViolations = [
  ...expectedNullSafetyViolations,
  ...expectedMemoryViolations,
  ...expectedConcurrencyViolations,
  ...expectedConventionViolations,
  ...expectedSecurityViolations,
  ...expectedPerformanceViolations,
  ...expectedArchitectureViolations,
];

/**
 * Mock AST for testing
 */
export const mockAST = {
  type: "TranslationUnit",
  declarations: [
    {
      type: "FunctionDeclaration",
      name: "nullDereference",
      line: 7,
      body: {
        type: "CompoundStatement",
        statements: [
          {
            type: "BinaryOperator",
            operator: "=",
            left: { type: "UnaryOperator", operator: "*", operand: { type: "Identifier", name: "ptr" } },
            right: { type: "IntegerLiteral", value: 42 },
            line: 9,
          },
        ],
      },
    },
  ],
};

/**
 * Mock CodeContext for testing
 */
export const mockCodeContext = {
  file: "sample-code.cpp",
  ast: mockAST,
  cfg: {
    nodes: [],
    edges: [],
    entry: { id: "entry", type: "entry" as const, statements: [], line: 0, predecessors: [], successors: [] },
    exit: { id: "exit", type: "exit" as const, statements: [], line: 0, predecessors: [], successors: [] },
  },
  dataFlow: {
    reachingDefinitions: new Map(),
    liveVariables: new Map(),
    definedVariables: new Map(),
    usedVariables: new Map(),
  },
  projectRoot: "/test/project",
  isTrinityCore: true,
  compilerType: "gcc" as const,
};
