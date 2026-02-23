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
    line: 14,
    file: "sample-code.cpp",
    metadata: {
      category: "null_safety",
      detectedBy: "rule_engine",
      priority: 1,
    },
  },
  {
    ruleId: "trinity-null-002",
    severity: "critical",
    message: "Potential null pointer dereference",
    line: 22,
    file: "sample-code.cpp",
    metadata: {
      category: "null_safety",
      detectedBy: "rule_engine",
      priority: 1,
    },
  },
];

export const expectedMemoryViolations: Partial<RuleViolation>[] = [
  {
    ruleId: "trinity-mem-001",
    severity: "critical",
    message: "Memory leak detected",
    line: 44,
    file: "sample-code.cpp",
    metadata: {
      category: "memory",
      detectedBy: "rule_engine",
      priority: 1,
    },
  },
  {
    ruleId: "trinity-mem-002",
    severity: "critical",
    message: "Double delete/free detected",
    line: 51,
    file: "sample-code.cpp",
    metadata: {
      category: "memory",
      detectedBy: "rule_engine",
      priority: 1,
    },
  },
];

export const expectedConcurrencyViolations: Partial<RuleViolation>[] = [
  {
    ruleId: "trinity-conc-001",
    severity: "critical",
    message: "Race condition: unsynchronized access to shared data",
    line: 67,
    file: "sample-code.cpp",
    metadata: {
      category: "concurrency",
      detectedBy: "rule_engine",
      priority: 1,
    },
  },
];

export const expectedConventionViolations: Partial<RuleViolation>[] = [
  {
    ruleId: "trinity-conv-001",
    severity: "minor",
    message: "Class name should use PascalCase (TrinityCore convention)",
    line: 85,
    file: "sample-code.cpp",
    metadata: {
      category: "convention",
      detectedBy: "rule_engine",
      priority: 3,
    },
  },
  {
    ruleId: "trinity-conv-002",
    severity: "minor",
    message: "Method name should use PascalCase (TrinityCore convention)",
    line: 86,
    file: "sample-code.cpp",
    metadata: {
      category: "convention",
      detectedBy: "rule_engine",
      priority: 3,
    },
  },
];

export const expectedSecurityViolations: Partial<RuleViolation>[] = [
  {
    ruleId: "trinity-sec-001",
    severity: "critical",
    message: "SQL injection vulnerability",
    line: 99,
    file: "sample-code.cpp",
    metadata: {
      category: "security",
      detectedBy: "rule_engine",
      priority: 1,
    },
  },
  {
    ruleId: "trinity-sec-002",
    severity: "critical",
    message: "Buffer overflow risk: use of strcpy",
    line: 104,
    file: "sample-code.cpp",
    metadata: {
      category: "security",
      detectedBy: "rule_engine",
      priority: 1,
    },
  },
];

export const expectedPerformanceViolations: Partial<RuleViolation>[] = [
  {
    ruleId: "trinity-perf-001",
    severity: "major",
    message: "Inefficient string concatenation in loop",
    line: 113,
    file: "sample-code.cpp",
    metadata: {
      category: "performance",
      detectedBy: "rule_engine",
      priority: 2,
    },
  },
  {
    ruleId: "trinity-perf-002",
    severity: "major",
    message: "Large object passed by value",
    line: 123,
    file: "sample-code.cpp",
    metadata: {
      category: "performance",
      detectedBy: "rule_engine",
      priority: 2,
    },
  },
];

export const expectedArchitectureViolations: Partial<RuleViolation>[] = [
  {
    ruleId: "trinity-arch-001",
    severity: "major",
    message: "God class detected: too many responsibilities",
    line: 130,
    file: "sample-code.cpp",
    metadata: {
      category: "architecture",
      detectedBy: "rule_engine",
      priority: 2,
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
  file: "sample-code.cpp",
  language: "cpp" as const,
  root: {
    type: "TranslationUnit",
    file: "sample-code.cpp",
    line: 1,
    column: 1,
    endLine: 200,
    endColumn: 1,
    raw: "",
    children: [],
  },
  symbols: {
    classes: new Map(),
    methods: new Map(),
    functions: new Map(),
    variables: new Map(),
    typedefs: new Map(),
  },
  includes: [],
  metadata: {
    parseTime: 0,
    nodeCount: 1,
    linesOfCode: 200,
  },
  classes: [],
  functions: [],
  methods: [],
  variables: [],

  // Legacy properties used by some tests
  type: "TranslationUnit",
  declarations: [
    {
      type: "FunctionDeclaration",
      name: "HandlePlayerLogin",
      line: 12,
      body: {
        type: "CompoundStatement",
        statements: [
          {
            type: "MemberExpression",
            operator: "->",
            object: { type: "Identifier", name: "player" },
            property: { type: "Identifier", name: "GetGUID" },
            line: 14,
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
