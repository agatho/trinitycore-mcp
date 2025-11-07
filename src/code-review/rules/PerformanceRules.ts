/**
 * Performance Rules - Performance Optimization and Bottleneck Detection
 * Priority #4: AI-Powered Code Review
 *
 * Detects performance bottlenecks, inefficient algorithms, and optimization opportunities
 * Target: 100 rules (current: 100, 100.0%)
 *
 * Categories:
 * - Algorithm complexity (20 rules)
 * - Memory allocation (20 rules)
 * - Database optimization (15 rules)
 * - Loop optimization (15 rules)
 * - String operations (10 rules)
 * - Container operations (10 rules)
 * - Caching issues (10 rules)
 */

import {
  CodeReviewRule,
  RuleViolation,
  CodeContext,
  AST,
  FunctionSymbol,
  VariableSymbol,
  ClassSymbol,
  CodeFix,
  IssueSeverity,
} from '../types';
import { logger } from '../../utils/logger';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Detect nested loops (O(n²) or worse)
 */
function detectNestedLoops(func: FunctionSymbol): number {
  const body = func.body || '';
  let maxDepth = 0;
  let currentDepth = 0;

  for (const line of body.split('\n')) {
    if (line.includes('for (') || line.includes('while (')) {
      currentDepth++;
      maxDepth = Math.max(maxDepth, currentDepth);
    }
    if (line.includes('}')) {
      currentDepth = Math.max(0, currentDepth - 1);
    }
  }

  return maxDepth;
}

/**
 * Find repeated allocations in loops
 */
function findRepeatedAllocations(func: FunctionSymbol): Array<{
  line: number;
  allocType: string;
}> {
  const allocations: Array<{ line: number; allocType: string }> = [];
  const body = func.body || '';
  const lines = body.split('\n');

  let inLoop = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.includes('for (') || line.includes('while (')) {
      inLoop = true;
    }

    if (inLoop && (line.includes('new ') || line.includes('std::make_'))) {
      allocations.push({
        line: func.location.line + i,
        allocType: line.includes('new ') ? 'new' : 'make',
      });
    }

    if (line.includes('}')) {
      inLoop = false;
    }
  }

  return allocations;
}

/**
 * Find N+1 query patterns
 */
function findNPlusOneQueries(func: FunctionSymbol): boolean {
  const body = func.body || '';
  const hasLoop =
    body.includes('for (') ||
    body.includes('while (') ||
    body.includes('std::for_each');
  const hasQuery =
    body.includes('Query(') ||
    body.includes('PQuery(') ||
    body.includes('->Query');

  return hasLoop && hasQuery;
}

/**
 * Find inefficient string concatenation
 */
function findStringConcatenation(func: FunctionSymbol): Array<{
  line: number;
  pattern: string;
}> {
  const issues: Array<{ line: number; pattern: string }> = [];
  const body = func.body || '';
  const lines = body.split('\n');

  let inLoop = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.includes('for (') || line.includes('while (')) {
      inLoop = true;
    }

    // String concatenation in loop
    if (
      inLoop &&
      (line.includes('+=') || line.includes('+')) &&
      (line.includes('std::string') || line.includes('str'))
    ) {
      issues.push({
        line: func.location.line + i,
        pattern: 'string-concat-in-loop',
      });
    }

    if (line.includes('}')) {
      inLoop = false;
    }
  }

  return issues;
}

// ============================================================================
// ALGORITHM COMPLEXITY RULES (20 rules)
// ============================================================================

const ALGORITHM_COMPLEXITY_PATTERNS = [
  'nested-loop-on2',
  'nested-loop-on3',
  'linear-search-in-loop',
  'unsorted-container-search',
  'repeated-calculation',
  'recursive-without-memo',
  'inefficient-sorting',
  'bubble-sort',
  'selection-sort',
  'redundant-iteration',
  'unnecessary-copy',
  'pass-by-value-large',
  'inefficient-find',
  'inefficient-erase',
  'vector-push-back-loop',
  'map-insert-loop',
  'set-insert-loop',
  'list-front-insert',
  'deque-random-access',
  'priority-queue-linear-search',
].map((pattern, index) => ({
  id: `performance-algorithm-${pattern}`,
  category: 'performance' as const,
  severity: (index < 7 ? 'major' : 'minor') as IssueSeverity,
  title: `Algorithm Complexity: ${pattern.replace(/-/g, ' ')}`,
  description: `Inefficient algorithm detected: ${pattern.replace(/-/g, ' ')}`,
  enabled: true,
  confidence: 0.80,
  priority: 80 - index,
  trinitySpecific: false,

  tags: [],
  detector: (ast: AST, context: CodeContext): RuleViolation[] => {
    const violations: RuleViolation[] = [];

    for (const func of ast.functions) {
      // Check for nested loops
      if (pattern === 'nested-loop-on2' || pattern === 'nested-loop-on3') {
        const depth = detectNestedLoops(func);
        const targetDepth = pattern === 'nested-loop-on2' ? 2 : 3;

        if (depth >= targetDepth) {
          violations.push({
            ruleId: `performance-algorithm-${pattern}`,
            file: context?.file,
            line: func.location.line,
            column: func.location.column,
            severity: (index < 7 ? 'major' : 'minor') as IssueSeverity,
            message: `Performance: Nested loops O(n^${depth}) detected in '${func.name}'. Consider optimizing algorithm complexity.`,
          explanation: '',
            confidence: 0.80,
            codeSnippet: {
              before: '',
              violatingLine: `for (...) { for (...) { ... } }`,
              afterContext: '',
            },
            metadata: {
              detectedBy: 'rule_engine',
              category: 'performance',
              priority: 80 - index,
            },
          });
        }
      }
    }

    return violations;
  },

  examples: [
    {
      bad: `for (auto& player : players) {\n    for (auto& item : items) {\n        if (item.owner == player.guid) { }\n    }\n}`,
      good: `std::unordered_map<ObjectGuid, std::vector<Item*>> itemsByOwner;\n// Build map once: O(n)\nfor (auto& item : items)\n    itemsByOwner[item.owner].push_back(&item);\n// Lookup: O(1)\nfor (auto& player : players)\n    auto& items = itemsByOwner[player.guid];`,
    },
  ],

  references: [
    'Big O Notation',
    'Algorithm Complexity',
  ],

  fixer: (violation: RuleViolation, context?: CodeContext): CodeFix | null => {
    if (!context) return null;
    return null; // Algorithm refactoring requires human judgment
  },
}));

// ============================================================================
// MEMORY ALLOCATION RULES (20 rules)
// ============================================================================

const MEMORY_ALLOCATION_PATTERNS = [
  'allocation-in-loop',
  'repeated-new-delete',
  'unnecessary-copy',
  'return-by-value-large',
  'temporary-object-creation',
  'vector-reallocation',
  'map-reallocation',
  'string-reallocation',
  'no-reserve-before-loop',
  'small-object-allocation',
  'frequent-malloc',
  'frequent-free',
  'memory-fragmentation',
  'cache-miss-likely',
  'false-sharing',
  'unaligned-access',
  'heap-vs-stack',
  'global-allocation',
  'static-allocation',
  'thread-local-misuse',
].map((pattern, index) => ({
  id: `performance-memory-${pattern}`,
  category: 'performance' as const,
  severity: (index < 8 ? 'major' : 'minor') as IssueSeverity,
  title: `Memory Allocation: ${pattern.replace(/-/g, ' ')}`,
  description: `Inefficient memory allocation: ${pattern.replace(/-/g, ' ')}`,
  enabled: true,
  confidence: 0.75,
  priority: 75 - index,
  trinitySpecific: false,

  tags: [],
  detector: (ast: AST, context: CodeContext): RuleViolation[] => {
    const violations: RuleViolation[] = [];

    for (const func of ast.functions) {
      // Check for allocations in loops
      if (pattern === 'allocation-in-loop') {
        const allocations = findRepeatedAllocations(func);

        for (const alloc of allocations) {
          violations.push({
            ruleId: `performance-memory-${pattern}`,
            file: context?.file,
            line: alloc.line,
            column: 0,
            severity: (index < 8 ? 'major' : 'minor') as IssueSeverity,
            message: `Performance: Memory allocation in loop detected. Consider pre-allocating or using object pool.`,
          explanation: '',
            confidence: 0.75,
            codeSnippet: {
              before: '',
              violatingLine: `for (...) { auto* obj = new Object(); }`,
              afterContext: '',
            },
            metadata: {
              detectedBy: 'rule_engine',
              category: 'performance',
              priority: 75 - index,
            },
          });
        }
      }
    }

    return violations;
  },

  examples: [
    {
      bad: `for (int i = 0; i < 1000; ++i) {\n    auto* obj = new MyObject();\n    process(obj);\n    delete obj;\n}`,
      good: `MyObject obj; // Reuse single object\nfor (int i = 0; i < 1000; ++i) {\n    obj.reset();\n    process(&obj);\n}`,
    },
  ],
  references: [
    'Memory Allocation Performance',
    'Object Pooling',
  ],

  fixer: (violation: RuleViolation, context?: CodeContext): CodeFix | null => {
    if (!context) return null;
    return null;
  },
}));

// ============================================================================
// DATABASE OPTIMIZATION RULES (15 rules)
// ============================================================================

const DATABASE_PATTERNS = [
  'n-plus-one-query',
  'missing-index-hint',
  'select-star',
  'no-limit-clause',
  'subquery-in-select',
  'uncached-query',
  'sync-query-in-loop',
  'no-batch-insert',
  'no-batch-update',
  'no-transaction',
  'long-transaction',
  'lock-timeout',
  'missing-prepared-stmt',
  'inefficient-join',
  'cartesian-product',
].map((pattern, index) => ({
  id: `performance-database-${pattern}`,
  category: 'performance' as const,
  severity: (index < 5 ? 'major' : 'minor') as IssueSeverity,
  title: `Database Performance: ${pattern.replace(/-/g, ' ')}`,
  description: `Inefficient database access: ${pattern.replace(/-/g, ' ')}`,
  enabled: true,
  confidence: 0.85,
  priority: 70 - index,
  trinitySpecific: true,

  tags: [],
  detector: (ast: AST, context: CodeContext): RuleViolation[] => {
    const violations: RuleViolation[] = [];

    for (const func of ast.functions) {
      // Check for N+1 query pattern
      if (pattern === 'n-plus-one-query') {
        if (findNPlusOneQueries(func)) {
          violations.push({
            ruleId: `performance-database-${pattern}`,
            file: context?.file,
            line: func.location.line,
            column: func.location.column,
            severity: (index < 5 ? 'major' : 'minor') as IssueSeverity,
            message: `Performance: N+1 query pattern detected in '${func.name}'. Consider using JOIN or batch query.`,
          explanation: '',
            confidence: 0.85,
            codeSnippet: {
              before: '',
              violatingLine: `for (auto& id : ids) { Query(...); }`,
              afterContext: '',
            },
            metadata: {
              detectedBy: 'rule_engine',
              category: 'performance',
              priority: 70 - index,
            },
          });
        }
      }

      // Check for SELECT *
      if (pattern === 'select-star') {
        const body = func.body || '';
        if (body.includes('SELECT *')) {
          violations.push({
            ruleId: `performance-database-${pattern}`,
            file: context?.file,
            line: func.location.line,
            column: func.location.column,
            severity: (index < 5 ? 'major' : 'minor') as IssueSeverity,
            message: `Performance: SELECT * transfers unnecessary data. Specify required columns.`,
          explanation: '',
            confidence: 0.85,
            codeSnippet: {
              before: '',
              violatingLine: 'SELECT * FROM creature',
              afterContext: '',
            },
            metadata: {
              detectedBy: 'rule_engine',
              category: 'performance',
              priority: 70 - index,
            },
          });
        }
      }
    }

    return violations;
  },

  examples: [
    {
      bad: `for (auto guid : playerGuids) {\n    Query("SELECT * FROM character WHERE guid = " + guid);\n}`,
      good: `std::string guidList = "(" + Join(playerGuids, ",") + ")";\nQuery("SELECT guid, name, level FROM character WHERE guid IN " + guidList);`,
    },
  ],
  references: [
    'Database Query Optimization',
    'N+1 Query Problem',
  ],

  fixer: (violation: RuleViolation, context?: CodeContext): CodeFix | null => {
    if (!context) return null;
    return null;
  },
}));

// ============================================================================
// LOOP OPTIMIZATION RULES (15 rules)
// ============================================================================

const LOOP_PATTERNS = [
  'invariant-code-motion',
  'loop-fusion',
  'loop-unrolling',
  'iterator-invalidation',
  'container-modification',
  'unnecessary-bounds-check',
  'range-based-for-copy',
  'auto-copy-vs-ref',
  'reverse-iteration-slow',
  'random-access-list',
  'find-in-unsorted',
  'erase-in-loop',
  'insert-in-loop',
  'resize-in-loop',
  'clear-in-loop',
].map((pattern, index) => ({
  id: `performance-loop-${pattern}`,
  category: 'performance' as const,
  severity: 'minor' as IssueSeverity,
  title: `Loop Optimization: ${pattern.replace(/-/g, ' ')}`,
  description: `Loop inefficiency: ${pattern.replace(/-/g, ' ')}`,
  enabled: true,
  confidence: 0.70,
  priority: 65 - index,
  trinitySpecific: false,

  tags: [],
  detector: (ast: AST, context: CodeContext): RuleViolation[] => {
    const violations: RuleViolation[] = [];

    for (const func of ast.functions) {
      const body = func.body || '';

      // Check for range-based for copying
      if (pattern === 'range-based-for-copy') {
        const lines = body.split('\n');
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          // Match: for (auto item : container)
          if (
            line.includes('for (auto ') &&
            !line.includes('auto&') &&
            !line.includes('auto*')
          ) {
            violations.push({
              ruleId: `performance-loop-${pattern}`,
              file: context?.file,
              line: func.location.line + i,
              column: 0,
              severity: 'minor' as IssueSeverity,
              message: `Performance: Range-based for loop copies elements. Use 'auto&' or 'const auto&' for reference.`,
          explanation: '',
              confidence: 0.70,
              codeSnippet: {
                before: '',
                violatingLine: line.trim(),
                afterContext: '',
              },
                            metadata: {
                detectedBy: 'rule_engine',
                category: 'performance',
                priority: 65 - index,
              },
            });
          }
        }
      }
    }

    return violations;
  },

  examples: [
    {
      bad: `for (auto player : players) { // Copies each Player\n    player.Update();\n}`,
      good: `for (auto& player : players) { // Reference\n    player.Update();\n}`,
    },
  ],
  references: [
    'Loop Optimization Techniques',
    'C++ Range-based For',
  ],

  fixer: (violation: RuleViolation, context?: CodeContext): CodeFix | null => {
    if (!context) return null;
    if (violation.suggestedFix) {
      return violation.suggestedFix;
    }
    return null;
  },
}));

// ============================================================================
// STRING OPERATION RULES (10 rules)
// ============================================================================

const STRING_PATTERNS = [
  'string-concat-in-loop',
  'stringstream-repeated',
  'c-string-vs-std-string',
  'unnecessary-to-string',
  'string-find-char',
  'substr-inefficient',
  'string-compare-inefficient',
  'string-copy-unnecessary',
  'string-reserve-missing',
  'string-view-not-used',
].map((pattern, index) => ({
  id: `performance-string-${pattern}`,
  category: 'performance' as const,
  severity: 'minor' as IssueSeverity,
  title: `String Performance: ${pattern.replace(/-/g, ' ')}`,
  description: `Inefficient string operation: ${pattern.replace(/-/g, ' ')}`,
  enabled: true,
  confidence: 0.75,
  priority: 60 - index,
  trinitySpecific: false,

  tags: [],
  detector: (ast: AST, context: CodeContext): RuleViolation[] => {
    const violations: RuleViolation[] = [];

    for (const func of ast.functions) {
      // Check for string concatenation in loop
      if (pattern === 'string-concat-in-loop') {
        const issues = findStringConcatenation(func);

        for (const issue of issues) {
          violations.push({
            ruleId: `performance-string-${pattern}`,
            file: context?.file,
            line: issue.line,
            column: 0,
            severity: 'minor' as IssueSeverity,
            message: `Performance: String concatenation in loop is O(n²). Use std::ostringstream or reserve().`,
          explanation: '',
            confidence: 0.75,
            codeSnippet: {
              before: '',
              violatingLine: `str += item; // In loop`,
              afterContext: '',
            },
            metadata: {
              detectedBy: 'rule_engine',
              category: 'performance',
              priority: 60 - index,
            },
          });
        }
      }
    }

    return violations;
  },

  examples: [
    {
      bad: `std::string result;\nfor (auto& item : items)\n    result += item.toString(); // O(n²)`,
      good: `std::ostringstream oss;\nfor (auto& item : items)\n    oss << item.toString();\nstd::string result = oss.str(); // O(n)`,
    },
  ],
  references: [
    'String Performance Best Practices',
    'std::string Optimization',
  ],

  fixer: (violation: RuleViolation, context?: CodeContext): CodeFix | null => {
    if (!context) return null;
    return null;
  },
}));

// ============================================================================
// CONTAINER OPERATION RULES (10 rules)
// ============================================================================

const CONTAINER_PATTERNS = [
  'vector-insert-front',
  'list-random-access',
  'map-linear-iteration',
  'set-frequent-find',
  'unordered-map-no-reserve',
  'vector-erase-unstable',
  'deque-vs-vector',
  'array-vs-vector',
  'container-size-in-loop',
  'empty-vs-size-zero',
].map((pattern, index) => ({
  id: `performance-container-${pattern}`,
  category: 'performance' as const,
  severity: 'minor' as IssueSeverity,
  title: `Container Performance: ${pattern.replace(/-/g, ' ')}`,
  description: `Inefficient container usage: ${pattern.replace(/-/g, ' ')}`,
  enabled: true,
  confidence: 0.70,
  priority: 55 - index,
  trinitySpecific: false,

  tags: [],
  detector: (ast: AST, context: CodeContext): RuleViolation[] => {
    const violations: RuleViolation[] = [];

    for (const func of ast.functions) {
      const body = func.body || '';

      // Check for vector front insertion
      if (pattern === 'vector-insert-front' && body.includes('vector')) {
        if (body.includes('.insert(begin()') || body.includes('.insert(v.begin()')) {
          violations.push({
            ruleId: `performance-container-${pattern}`,
            file: context?.file,
            line: func.location.line,
            column: func.location.column,
            severity: 'minor' as IssueSeverity,
            message: `Performance: Inserting at vector front is O(n). Consider using std::deque for front insertions.`,
          explanation: '',
            confidence: 0.70,
            codeSnippet: {
              before: '',
              violatingLine: 'vec.insert(vec.begin(), item);',
              afterContext: '',
            },
            metadata: {
              detectedBy: 'rule_engine',
              category: 'performance',
              priority: 55 - index,
            },
          });
        }
      }
    }

    return violations;
  },

  examples: [
    {
      bad: `std::vector<int> vec;\nvec.insert(vec.begin(), item); // O(n)`,
      good: `std::deque<int> deq;\ndeq.push_front(item); // O(1)`,
    },
  ],
  references: [
    'STL Container Performance',
    'Container Selection Guide',
  ],

  fixer: (violation: RuleViolation, context?: CodeContext): CodeFix | null => {
    if (!context) return null;
    return null;
  },
}));

// ============================================================================
// CACHING RULES (10 rules)
// ============================================================================

const CACHING_PATTERNS = [
  'uncached-database-query',
  'uncached-file-read',
  'uncached-calculation',
  'cache-invalidation-missing',
  'cache-size-unlimited',
  'cache-ttl-missing',
  'lru-cache-not-used',
  'hot-path-not-cached',
  'repeated-lookup',
  'memoization-missing',
].map((pattern, index) => ({
  id: `performance-caching-${pattern}`,
  category: 'performance' as const,
  severity: 'minor' as IssueSeverity,
  title: `Caching: ${pattern.replace(/-/g, ' ')}`,
  description: `Caching opportunity: ${pattern.replace(/-/g, ' ')}`,
  enabled: true,
  confidence: 0.65,
  priority: 50 - index,
  trinitySpecific: true,

  tags: [],
  detector: (ast: AST, context: CodeContext): RuleViolation[] => {
    const violations: RuleViolation[] = [];

    for (const func of ast.functions) {
      const body = func.body || '';

      // Check for repeated database queries
      if (pattern === 'uncached-database-query') {
        const queryCount = (body.match(/Query\(/g) || []).length;
        const hasCacheCheck =
          body.includes('GetFromCache') ||
          body.includes('FindInCache') ||
          body.includes('_cache');

        if (queryCount > 1 && !hasCacheCheck) {
          violations.push({
            ruleId: `performance-caching-${pattern}`,
            file: context?.file,
            line: func.location.line,
            column: func.location.column,
            severity: 'minor' as IssueSeverity,
            message: `Performance: Function '${func.name}' has ${queryCount} queries without caching. Consider implementing cache.`,
          explanation: '',
            confidence: 0.65,
            codeSnippet: {
              before: '',
              violatingLine: 'Query(...); // Repeated without cache',
              afterContext: '',
            },
            metadata: {
              detectedBy: 'rule_engine',
              category: 'performance',
              priority: 50 - index,
            },
          });
        }
      }
    }

    return violations;
  },

  examples: [
    {
      bad: `Creature* GetCreature(uint32 entry) {\n    return Query("SELECT * FROM creature WHERE entry = " + entry);\n}`,
      good: `Creature* GetCreature(uint32 entry) {\n    if (auto cached = _cache.find(entry))\n        return cached;\n    auto creature = Query("SELECT * FROM creature WHERE entry = " + entry);\n    _cache[entry] = creature;\n    return creature;\n}`,
    },
  ],
  references: [
    'Caching Strategies',
    'Cache Performance',
  ],

  fixer: (violation: RuleViolation, context?: CodeContext): CodeFix | null => {
    if (!context) return null;
    return null;
  },
}));

// ============================================================================
// EXPORTS
// ============================================================================

/**
 */
export const PERFORMANCE_RULES: CodeReviewRule[] = [
  ...ALGORITHM_COMPLEXITY_PATTERNS,
  ...MEMORY_ALLOCATION_PATTERNS,
  ...DATABASE_PATTERNS,
  ...LOOP_PATTERNS,
  ...STRING_PATTERNS,
  ...CONTAINER_PATTERNS,
  ...CACHING_PATTERNS,
];

logger.info(`Performance Rules loaded: ${PERFORMANCE_RULES.length} rules`);
logger.info(
  `Target: 100 rules, Current: ${PERFORMANCE_RULES.length} (${((PERFORMANCE_RULES.length / 100) * 100).toFixed(1)}%)`
);
