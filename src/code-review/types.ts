/**
 * AI-Powered Code Review & Architecture Advisor - Type Definitions
 * Priority #4: Core Type System
 *
 * Comprehensive type definitions for the entire code review system
 * Performance target: >90% bug detection, <15% false positive rate
 */

// ============================================================================
// ENUMS AND CONSTANTS
// ============================================================================

export type RuleCategory =
  | 'null_safety'
  | 'memory'
  | 'concurrency'
  | 'convention'
  | 'security'
  | 'performance'
  | 'architecture';

export type IssueSeverity = 'critical' | 'major' | 'minor' | 'info';

export type FixType =
  | 'add_null_check'
  | 'convert_to_smart_pointer'
  | 'add_mutex'
  | 'fix_include_order'
  | 'use_prepared_statement'
  | 'add_bounds_check'
  | 'refactor_complexity'
  | 'custom';

export type Language = 'cpp' | 'c' | 'hpp' | 'h';

export type CompilerType = 'gcc' | 'clang' | 'msvc';

// ============================================================================
// AST (ABSTRACT SYNTAX TREE) TYPES
// ============================================================================

/**
 * Base AST node interface
 * All AST nodes extend this interface
 */
export interface ASTNode {
  type: string;
  file: string;
  line: number;
  column: number;
  endLine: number;
  endColumn: number;
  raw: string;
  parent?: ASTNode;
  children: ASTNode[];
}

/**
 * Represents the complete Abstract Syntax Tree for a source file
 */
export interface AST {
  file: string;
  language: Language;
  root: ASTNode;
  symbols: SymbolTable;
  includes: IncludeDirective[];
  metadata: {
    parseTime: number;
    nodeCount: number;
    linesOfCode: number;
  };

  // Convenience accessors for rules (array access to symbol maps)
  classes: ClassSymbol[];
  functions: FunctionSymbol[];
  methods: MethodSymbol[];
  variables: VariableSymbol[];
}

/**
 * Symbol table mapping names to symbols
 */
export interface SymbolTable {
  classes: Map<string, ClassSymbol>;
  methods: Map<string, MethodSymbol>;
  functions: Map<string, FunctionSymbol>;
  variables: Map<string, VariableSymbol>;
  typedefs: Map<string, TypedefSymbol>;
}

/**
 * Class symbol
 */
export interface ClassSymbol {
  name: string;
  namespace: string;
  fullyQualifiedName: string;
  file: string;
  line: number;
  column: number;
  baseClasses: string[];
  methods: MethodSymbol[];
  fields: VariableSymbol[];
  accessModifiers: {
    public: SymbolInfo[];
    protected: SymbolInfo[];
    private: SymbolInfo[];
  };
  isAbstract: boolean;
  isFinal: boolean;
  isTemplate: boolean;
  templateParameters?: string[];

  // Convenience properties for rules
  members: VariableSymbol[]; // Alias for fields
  documentation?: string; // Class documentation
  location: { file: string; line: number; column: number; endLine?: number; endColumn?: number }; // Combined location
}

/**
 * Method symbol
 */
export interface MethodSymbol {
  name: string;
  className: string;
  fullyQualifiedName: string;
  file: string;
  line: number;
  column: number;
  signature: string;
  returnType: string;
  parameters: ParameterInfo[];
  isVirtual: boolean;
  isOverride: boolean;
  isConst: boolean;
  isStatic: boolean;
  accessModifier: 'public' | 'protected' | 'private';
  body?: string;

  // Convenience properties for rules
  visibility: 'public' | 'protected' | 'private'; // Alias for accessModifier
  isPureVirtual: boolean; // Virtual with = 0
  documentation?: string; // Method documentation
  location: { file: string; line: number; column: number; endLine?: number; endColumn?: number }; // Combined location
}

/**
 * Function symbol (non-method)
 */
export interface FunctionSymbol {
  name: string;
  namespace: string;
  fullyQualifiedName: string;
  file: string;
  line: number;
  column: number;
  signature: string;
  returnType: string;
  parameters: ParameterInfo[];
  isStatic: boolean;
  isInline: boolean;
  body?: string;

  // Convenience properties for rules
  documentation?: string; // Function documentation
  location: { file: string; line: number; column: number; endLine?: number; endColumn?: number }; // Combined location
  visibility?: 'public' | 'protected' | 'private'; // For namespaced functions
}

/**
 * Variable symbol
 */
export interface VariableSymbol {
  name: string;
  type: string;
  file: string;
  line: number;
  column: number;
  scope: 'global' | 'class' | 'local' | 'parameter';
  isPointer: boolean;
  isReference: boolean;
  isConst: boolean;
  isStatic: boolean;
  initializer?: string;

  // Convenience properties for rules
  location: { file: string; line: number; column: number; endLine?: number; endColumn?: number }; // Combined location
  modifiers: string[]; // Modifiers array ['const', 'static', etc.]
  initialValue?: string; // Alias for initializer
  initialization?: string; // Alias for initializer
  visibility?: 'public' | 'protected' | 'private'; // For class member variables
}

/**
 * Typedef symbol
 */
export interface TypedefSymbol {
  name: string;
  underlyingType: string;
  file: string;
  line: number;
}

/**
 * Parameter information
 */
export interface ParameterInfo {
  name: string;
  type: string;
  defaultValue?: string;
  isConst: boolean;
  isReference: boolean;
  isPointer: boolean;
}

/**
 * Include directive
 */
export interface IncludeDirective {
  file: string;
  line: number;
  includedFile: string;
  isSystemInclude: boolean; // <> vs ""
  isResolved: boolean;
  resolvedPath?: string;
}

/**
 * Generic symbol info (used in access modifiers)
 */
export interface SymbolInfo {
  name: string;
  type: 'method' | 'field';
  line: number;
}

// ============================================================================
// CONTROL FLOW AND DATA FLOW TYPES
// ============================================================================

/**
 * Control Flow Graph (CFG)
 * Represents program control flow for analysis
 */
export interface ControlFlowGraph {
  nodes: CFGNode[];
  edges: CFGEdge[];
  entry: CFGNode;
  exit: CFGNode;
}

/**
 * CFG node (basic block)
 */
export interface CFGNode {
  id: string;
  type: 'entry' | 'exit' | 'statement' | 'condition' | 'loop';
  statements: ASTNode[];
  line: number;
  predecessors: string[]; // Node IDs
  successors: string[]; // Node IDs
}

/**
 * CFG edge (control flow transition)
 */
export interface CFGEdge {
  from: string; // Node ID
  to: string; // Node ID
  condition?: string; // For conditional edges (if/while)
  edgeType: 'unconditional' | 'true_branch' | 'false_branch' | 'exception';
}

/**
 * Data flow analysis result
 */
export interface DataFlowResult {
  reachingDefinitions: Map<string, Set<VariableSymbol>>; // Variable → definitions that reach this point
  liveVariables: Map<string, Set<string>>; // Node ID → live variables
  definedVariables: Map<string, Set<string>>; // Node ID → defined variables
  usedVariables: Map<string, Set<string>>; // Node ID → used variables
}

/**
 * Pointer lifetime tracking
 */
export interface Lifetime {
  variable: VariableSymbol;
  allocation: {
    line: number;
    type: 'stack' | 'heap' | 'parameter';
  };
  deallocation?: {
    line: number;
    type: 'delete' | 'smart_pointer' | 'scope_exit';
  };
  usages: {
    line: number;
    type: 'read' | 'write' | 'method_call';
  }[];
  isLeaked: boolean;
  isDoubleFree: boolean;
  isUseAfterFree: boolean;
}

/**
 * Null check path analysis
 */
export interface Path {
  nodes: CFGNode[];
  hasNullCheck: boolean;
  nullCheckLocation?: {
    line: number;
    column: number;
  };
}

// ============================================================================
// CODE REVIEW RULE TYPES
// ============================================================================

/**
 * Code review rule definition
 * Defines a single rule that can detect violations
 */
export interface CodeReviewRule {
  id: string;
  category: RuleCategory;
  severity: IssueSeverity;
  title: string;
  description: string;

  // Detection function
  detector: (ast: AST, context: CodeContext) => RuleViolation[];

  // Optional fix generator
  fixer?: (violation: RuleViolation, context?: CodeContext) => CodeFix | null;

  // Documentation
  references: string[];
  examples: {
    bad: string;
    good: string;
    explanation?: string; // Optional for backward compatibility
  }[];

  // Metadata
  priority: number; // Higher = more important (0-100)
  trinitySpecific: boolean; // TrinityCore-specific rule
  enabled: boolean;
  confidence: number; // Base confidence score (0.0-1.0)
  tags: string[]; // Categorization tags for the rule
}

/**
 * Code context for rule evaluation
 */
export interface CodeContext {
  file: string;
  ast: AST;
  cfg: ControlFlowGraph;
  dataFlow: DataFlowResult;
  projectRoot: string;
  isTrinityCore: boolean;
  compilerType: CompilerType;

  // Serena MCP integration
  serena?: SerenaIntegration;
}

/**
 * Rule violation detected by a rule
 */
export interface RuleViolation {
  ruleId: string;
  file: string;
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
  severity: IssueSeverity;
  message: string;
  explanation: string;
  codeSnippet: {
    before: string;
    context?: string; // Surrounding lines for context
    violatingLine?: string; // The actual violating line (for backward compat)
    afterContext?: string; // Lines after the violation (for backward compat)
  };
  suggestedFix?: CodeFix;
  confidence: number; // 0.0-1.0
  metadata: {
    detectedBy: 'rule_engine' | 'ai_model' | 'hybrid';
    category: RuleCategory;
    priority: number;
  };
}

/**
 * Code fix suggestion
 */
export interface CodeFix {
  type: FixType;
  file: string;
  line: number;
  diff: string; // Unified diff format
  unifiedDiff?: string; // Deprecated alias for diff (for backward compat)
  explanation: string;
  description?: string; // Deprecated alias for explanation (for backward compat)
  changes?: string[]; // Deprecated list of changes (for backward compat)
  codeSnippet: {
    before: string;
    after: string;
  };
  confidence: number; // 0.0-1.0
  autoApplicable: boolean; // Can be automatically applied
  estimatedImpact: 'low' | 'medium' | 'high';
}

// ============================================================================
// AI INTEGRATION TYPES
// ============================================================================

/**
 * AI review request
 */
export interface AIReviewRequest {
  code: string;
  context: CodeContext;
  detectedIssues: RuleViolation[];
  options?: {
    explainIssues?: boolean;
    suggestArchitecture?: boolean;
    provideLearningResources?: boolean;
  };
}

/**
 * AI review result
 */
export interface AIReviewResult {
  issues: AIDetectedIssue[];
  architectureSuggestions: ArchitectureSuggestion[];
  codeQualityScore: number; // 1-10
  explanation: string;
  learningResources?: LearningResource[];
  processingTime: number; // milliseconds
}

/**
 * AI-detected issue
 */
export interface AIDetectedIssue {
  issue: RuleViolation;
  aiExplanation: string; // Natural language explanation
  aiConfidence: number; // AI's confidence (0.0-1.0)
  isConfirmed: boolean; // Confirms static analysis detection
  additionalContext?: string; // Extra context AI provides
}

/**
 * Architecture improvement suggestion
 */
export interface ArchitectureSuggestion {
  type: 'refactoring' | 'pattern' | 'performance' | 'maintainability';
  title: string;
  description: string;
  impact: 'low' | 'medium' | 'high';
  effort: 'low' | 'medium' | 'high';
  references: string[];
  codeExample?: {
    before: string;
    after: string;
  };
}

/**
 * Learning resource recommendation
 */
export interface LearningResource {
  title: string;
  url: string;
  type: 'documentation' | 'article' | 'video' | 'book';
  relevance: number; // 0.0-1.0
}

// ============================================================================
// SERENA MCP INTEGRATION TYPES
// ============================================================================

/**
 * Serena MCP integration interface
 */
export interface SerenaIntegration {
  findSymbol(options: {
    namePath: string;
    relativePath?: string;
    includeBody?: boolean;
    depth?: number;
  }): Promise<SerenaSymbol[]>;

  findReferencingSymbols(options: {
    namePath: string;
    relativePath: string;
  }): Promise<SerenaReference[]>;

  searchForPattern(options: {
    pattern: string;
    relativePath?: string;
    restrictToCodeFiles?: boolean;
  }): Promise<SerenaMatch[]>;

  getSymbolsOverview(options: {
    relativePath: string;
  }): Promise<SerenaOverview>;
}

/**
 * Serena symbol result
 */
export interface SerenaSymbol {
  namePath: string;
  relativePath: string;
  line: number;
  kind: number; // LSP symbol kind
  body?: string;
  children?: SerenaSymbol[];
}

/**
 * Serena reference result
 */
export interface SerenaReference {
  referencingSymbol: SerenaSymbol;
  snippet: string;
  line: number;
}

/**
 * Serena pattern match
 */
export interface SerenaMatch {
  file: string;
  line: number;
  matchedText: string;
  context?: string;
}

/**
 * Serena symbols overview
 */
export interface SerenaOverview {
  file: string;
  symbols: SerenaSymbol[];
}

// ============================================================================
// REVIEW REPORT TYPES
// ============================================================================

/**
 * Complete code review report
 */
export interface ReviewReport {
  summary: ReviewSummary;
  issues: ReviewIssue[];
  metrics: CodeMetrics;
  architectureSuggestions: ArchitectureSuggestion[];
  metadata: {
    generatedAt: Date;
    reviewTime: number; // milliseconds
    filesReviewed: number;
    linesReviewed: number;
  };
}

/**
 * Review summary statistics
 */
export interface ReviewSummary {
  totalIssues: number;
  criticalIssues: number;
  majorIssues: number;
  minorIssues: number;
  infoIssues: number;
  autoFixableIssues: number;
  averageConfidence: number;
}

/**
 * Review issue (aggregated from all sources)
 */
export interface ReviewIssue {
  id: string;
  ruleId: string;
  file: string;
  line: number;
  column: number;
  severity: IssueSeverity;
  title: string;
  message: string;
  explanation: string;

  codeSnippet: {
    before: string;
    after?: string; // If fix suggested
    context?: string; // Surrounding lines
  };

  suggestedFix?: {
    diff: string;
    explanation: string;
    confidence: number;
    autoApplicable: boolean;
  };

  references: string[];

  metadata: {
    category: RuleCategory;
    priority: number;
    confidence: number;
    detectedBy: 'rule_engine' | 'ai_model' | 'hybrid';
    aiEnhanced: boolean;
  };
}

/**
 * Code quality metrics
 */
export interface CodeMetrics {
  complexity: ComplexityMetrics;
  maintainability: MaintainabilityMetrics;
  testCoverage: TestCoverageMetrics;
  codeSmells: CodeSmell[];
}

/**
 * Cyclomatic complexity metrics
 */
export interface ComplexityMetrics {
  average: number;
  max: number;
  threshold: number; // Target threshold (e.g., 10)
  violations: {
    function: string;
    file: string;
    line: number;
    complexity: number;
  }[];
}

/**
 * Maintainability index
 */
export interface MaintainabilityMetrics {
  score: number; // 0-100
  threshold: number; // Target threshold (e.g., 65)
  factors: {
    linesOfCode: number;
    cyclomaticComplexity: number;
    halsteadVolume: number;
    commentRatio: number;
  };
}

/**
 * Test coverage metrics
 */
export interface TestCoverageMetrics {
  percentage: number; // 0-100
  threshold: number; // Target threshold (e.g., 80)
  untested: {
    function: string;
    file: string;
    line: number;
  }[];
}

/**
 * Code smell detection
 */
export interface CodeSmell {
  type: 'god_class' | 'long_method' | 'duplicate_code' | 'dead_code' | 'magic_numbers';
  file: string;
  line: number;
  description: string;
  severity: 'minor' | 'major';
  suggestedRefactoring: string;
}

// ============================================================================
// ANALYSIS OPTIONS AND RESULTS
// ============================================================================

/**
 * Analysis options
 */
export interface AnalysisOptions {
  // Input
  diff?: string; // Git diff content
  files?: string[]; // Or list of files to review
  baseDirectory?: string; // Project root

  // Filters
  severity?: IssueSeverity | 'all'; // Filter by severity
  categories?: RuleCategory[]; // Filter by rule categories
  includeAutoFixable?: boolean; // Only show auto-fixable issues

  // AI options
  useAI?: boolean; // Enable AI-powered review (default: true)
  aiExplanations?: boolean; // Generate AI explanations (default: true)
  architectureAnalysis?: boolean; // Analyze architecture (default: true)

  // Output options
  format?: 'text' | 'json' | 'markdown';
  contextLines?: number; // Lines of context around issues (default: 3)
  showFixDiffs?: boolean; // Show diff patches (default: true)

  // Performance
  maxConcurrentRules?: number; // Max parallel rule execution (default: CPU cores)
  cacheResults?: boolean; // Cache analysis results (default: true)
}

/**
 * Complete analysis result
 */
export interface AnalysisResult {
  report: ReviewReport;
  appliedFixes?: AppliedFix[];
  errors?: AnalysisError[];
  performance: PerformanceMetrics;
}

/**
 * Applied fix result
 */
export interface AppliedFix {
  issue: ReviewIssue;
  fix: CodeFix;
  success: boolean;
  error?: string;
  timestamp: Date;
}

/**
 * Analysis error
 */
export interface AnalysisError {
  file: string;
  phase: 'parsing' | 'analysis' | 'ai_review' | 'report_generation';
  error: string;
  recoverable: boolean;
}

/**
 * Performance metrics
 */
export interface PerformanceMetrics {
  parseTime: number; // milliseconds
  analysisTime: number; // milliseconds
  aiReviewTime: number; // milliseconds
  reportGenerationTime: number; // milliseconds
  totalTime: number; // milliseconds
  issuesPerSecond: number;
  memoryUsage: number; // MB
}

// ============================================================================
// TRAINING AND VALIDATION TYPES
// ============================================================================

/**
 * Training example for AI model fine-tuning
 */
export interface TrainingExample {
  code: string;
  review: {
    issues: ReviewIssue[];
    explanation: string;
  };
  metadata: {
    commit: string;
    author: string;
    date: Date;
    bugType: string[];
  };
}

/**
 * Validation metrics
 */
export interface ValidationMetrics {
  accuracy: number; // 0.0-1.0
  precision: number; // True positives / (True positives + False positives)
  recall: number; // True positives / (True positives + False negatives)
  f1Score: number; // Harmonic mean of precision and recall
  falsePositiveRate: number; // False positives / (False positives + True negatives)
  confusionMatrix: {
    truePositives: number;
    falsePositives: number;
    trueNegatives: number;
    falseNegatives: number;
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

// Export all types for use in other modules
export type {
  // AST types exported above
  // Rule types exported above
  // etc.
};
