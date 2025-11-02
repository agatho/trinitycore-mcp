# List 1: AI Agent C++ Development Support - Detailed Implementation Subplan

**Version**: 1.0.0
**Date**: 2025-11-02
**Status**: Implementation Ready
**Total Tools**: 5 (3 High Priority, 2 Medium Priority)

---

## Overview

This subplan details the implementation of 5 AI Agent tools that enable AI assistants (Claude, ChatGPT, Copilot) to provide enterprise-grade C++ development assistance for TrinityCore and PlayerBot projects.

**Estimated Timeline**: 2-3 weeks for all 5 tools
**Total Lines of Code**: ~6,500 lines (enterprise-grade)
**Quality Standard**: Zero shortcuts, production-ready, comprehensive error handling

---

## Tool 1: Thread Safety & Concurrency Analyzer

**File**: `src/tools/threadsafety.ts`
**Priority**: HIGH
**Estimated Lines**: ~1,400 lines
**Implementation Time**: 3-4 days

### Features to Implement

#### 1.1 Lock Detection Engine
- Scan C++ code for mutex patterns:
  - `std::mutex`, `std::recursive_mutex`, `std::shared_mutex`
  - `std::lock_guard<T>`, `std::unique_lock<T>`, `std::shared_lock<T>`
  - `ACE_Guard<T>`, `ACE_Read_Guard`, `ACE_Write_Guard` (TrinityCore legacy)
- Parse lock scope and lifetime
- Track lock acquisition order across functions

#### 1.2 Race Condition Detector
- Identify shared state access patterns:
  - Member variable access without locks (`m_bots.push_back()`)
  - Static/global variable modifications
  - Shared container operations (vector, map, unordered_map)
- Detect unsynchronized reads and writes
- Track which threads can access each shared resource

#### 1.3 Deadlock Pattern Analyzer
- Build lock dependency graph
- Detect circular lock dependencies (A→B, B→A)
- Identify lock ordering violations
- Suggest lock ordering hierarchy

#### 1.4 Lock-Free Alternative Suggester
- Identify hot paths that use locks
- Suggest atomic operations for simple counters
- Recommend `TC::LockedQueue<T>` for producer-consumer patterns
- Suggest `std::atomic<T>` for flags and simple state

#### 1.5 WorldUpdateTime Safety Checker
- Verify bot code respects 50ms world update cycle
- Detect blocking operations in update loops
- Warn about operations >10ms in Update() methods

### Data Structures

```typescript
interface ThreadSafetyIssue {
  type: 'race_condition' | 'deadlock' | 'missing_lock' | 'performance';
  severity: 'critical' | 'high' | 'medium' | 'low';
  file: string;
  line: number;
  code: string;
  description: string;
  threadContext: string[];
  recommendation: string;
  references: string[]; // Example code locations
}

interface LockPattern {
  lockType: string; // std::mutex, ACE_Guard, etc.
  lockName: string;
  acquiredAt: CodeLocation;
  releasedAt: CodeLocation;
  scope: 'function' | 'block' | 'class';
  holdDuration: 'short' | 'medium' | 'long';
}

interface SharedResource {
  name: string;
  type: string;
  accessPoints: Array<{
    file: string;
    line: number;
    operation: 'read' | 'write';
    hasLock: boolean;
    lockName?: string;
  }>;
  threads: string[]; // Which threads can access this
}

interface DeadlockPath {
  locks: string[];
  acquisitionOrder: Array<{lock: string; location: CodeLocation}>;
  circularDependency: boolean;
  suggestedFix: string;
}
```

### Implementation Steps

1. **AST Parser Integration** (300 lines)
   - Use `@typescript-eslint/typescript-estree` for C++ parsing simulation
   - Extract class members, function bodies, variable accesses

2. **Lock Pattern Scanner** (250 lines)
   - Regex + AST patterns for mutex detection
   - Track lock lifetime and scope

3. **Race Condition Analyzer** (350 lines)
   - Build shared resource map
   - Cross-reference with lock coverage
   - Generate warnings for unprotected access

4. **Deadlock Detector** (250 lines)
   - Graph-based circular dependency detection
   - Topological sort for lock ordering

5. **Performance Optimizer** (150 lines)
   - Identify lock contention hot paths
   - Suggest lock-free alternatives

6. **Report Generator** (100 lines)
   - Format analysis results
   - Include fix suggestions and references

### MCP Tool Interface

```typescript
export async function analyzeThreadSafety(options: {
  filePath?: string;
  directory?: string;
  includePattern?: string; // e.g., "Playerbot/**/*.cpp"
  severity?: 'critical' | 'high' | 'medium' | 'low';
  checkTypes?: Array<'race_conditions' | 'deadlocks' | 'performance'>;
}): Promise<{
  summary: {
    totalIssues: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  issues: ThreadSafetyIssue[];
  suggestions: string[];
  safePatternsFound: number;
}>;
```

---

## Tool 2: TrinityCore API Migration Assistant

**File**: `src/tools/apimigration.ts`
**Priority**: HIGH
**Estimated Lines**: ~1,600 lines
**Implementation Time**: 4-5 days

### Features to Implement

#### 2.1 Deprecation Database
- Build comprehensive API change database:
  - TrinityCore 3.3.5a → 6.x → 7.x → 8.x → 9.x → 10.x → 11.2
  - Method signature changes
  - Class name changes
  - Header file relocations
  - Opcode changes

#### 2.2 API Scanner
- Scan codebase for deprecated API usage
- Match against deprecation database
- Track occurrence counts per file

#### 2.3 Auto-Refactoring Engine
- Generate automated fix suggestions
- Support find-and-replace transformations
- Handle complex refactorings (e.g., ObjectGuid changes)

#### 2.4 Breaking Change Detector
- Identify API changes that need manual review
- Detect packet structure changes
- Flag removed methods with no direct replacement

#### 2.5 C++20 Modernization
- Suggest `nullptr` instead of `NULL`
- Recommend smart pointers over raw pointers
- Suggest `auto` for complex types
- Recommend range-based for loops

### Data Structures

```typescript
interface APIChange {
  version: string; // "3.3.5a", "11.2", etc.
  type: 'method_rename' | 'signature_change' | 'class_rename' | 'header_move' | 'removal';
  category: 'auto_fixable' | 'manual_review' | 'breaking';

  // Old API
  oldPattern: string;
  oldSignature?: string;
  oldHeader?: string;

  // New API
  newPattern: string;
  newSignature?: string;
  newHeader?: string;

  // Context
  description: string;
  reason: string;
  exampleOld: string;
  exampleNew: string;
  references: string[]; // Git commits, documentation links
}

interface DeprecationMatch {
  file: string;
  line: number;
  column: number;
  oldCode: string;
  newCode: string;
  apiChange: APIChange;
  autoFixable: boolean;
  confidence: number; // 0-100%
}

interface MigrationReport {
  fromVersion: string;
  toVersion: string;
  totalChanges: number;
  autoFixable: number;
  manualReview: number;
  estimatedEffort: string; // "2 hours", "2 days", etc.
  changesByFile: Map<string, DeprecationMatch[]>;
}
```

### Implementation Steps

1. **API Change Database** (400 lines)
   - Load from JSON/YAML configuration
   - Support regex patterns for flexible matching
   - Version-specific change sets

2. **Code Scanner** (300 lines)
   - Regex-based pattern matching
   - AST-based signature matching
   - File-by-file analysis

3. **Auto-Fix Generator** (350 lines)
   - Simple find-replace transformations
   - Complex refactorings (ObjectGuid, PreparedStatement)
   - Batch fix application

4. **Manual Review Detector** (250 lines)
   - Identify breaking changes
   - Flag ambiguous matches
   - Confidence scoring

5. **C++20 Modernizer** (200 lines)
   - NULL → nullptr
   - Raw pointers → smart pointers detection
   - Modern C++ pattern suggestions

6. **Report Generator** (100 lines)
   - Summary statistics
   - File-by-file breakdown
   - Effort estimation

### MCP Tool Interface

```typescript
export async function analyzeAPIMigration(options: {
  directory: string;
  fromVersion: string; // "3.3.5a"
  toVersion: string; // "11.2"
  includePattern?: string;
  autoFix?: boolean; // Apply auto-fixes
  modernize?: boolean; // Apply C++20 improvements
}): Promise<MigrationReport>;

export async function getAPIChangeDetails(
  apiName: string,
  version?: string
): Promise<APIChange[]>;
```

---

## Tool 3: Smart Code Completion Context Provider

**File**: `src/tools/codecompletion.ts`
**Priority**: HIGH
**Estimated Lines**: ~1,300 lines
**Implementation Time**: 3-4 days

### Features to Implement

#### 3.1 Context Analyzer
- Determine current file module (Playerbot vs Core)
- Identify current class and method
- Parse included headers
- Detect coding patterns in surrounding code

#### 3.2 Pattern Learner
- Extract common patterns from existing code:
  - Method call sequences
  - Variable naming conventions
  - Error handling patterns
  - Resource management (RAII)

#### 3.3 Type System Navigator
- Understand TrinityCore complex types:
  - `ObjectGuid`, `PreparedStatement`, `QueryResult`
  - `TC::unique_trackable_ptr<T>`
  - Template types and aliases

#### 3.4 Include Recommender
- Suggest required headers for APIs
- Detect missing includes
- Recommend forward declarations

#### 3.5 Style Enforcer
- Enforce PascalCase for classes
- Enforce camelCase for variables
- Suggest Doxygen comments for public APIs

### Data Structures

```typescript
interface CodeContext {
  file: string;
  module: 'Playerbot' | 'Core' | 'Database' | 'Other';
  currentClass?: string;
  currentMethod?: string;
  currentLine: number;
  includedHeaders: string[];
  localVariables: Array<{name: string; type: string}>;
  patterns: CodePattern[];
}

interface CodePattern {
  name: string;
  frequency: number;
  template: string;
  example: string;
  usageContext: string; // When to use this pattern
}

interface CompletionSuggestion {
  rank: number;
  code: string;
  description: string;
  type: string; // Method signature
  usageCount: number; // How often used in module
  requiredIncludes: string[];
  example: string;
  pattern?: string; // Associated pattern name
}

interface TypeInfo {
  name: string;
  fullName: string; // With namespace
  header: string;
  isTemplate: boolean;
  templateParams?: string[];
  methods: Array<{name: string; signature: string; description: string}>;
}
```

### Implementation Steps

1. **Context Extractor** (250 lines)
   - Parse current file for context
   - Identify module and class
   - Extract local scope information

2. **Pattern Database Builder** (300 lines)
   - Scan existing codebase for patterns
   - Count pattern frequency
   - Categorize by module and use case

3. **Completion Ranker** (250 lines)
   - Score suggestions by relevance
   - Consider context (module, class, method)
   - Prioritize frequently-used patterns

4. **Type System Parser** (300 lines)
   - Parse TrinityCore type definitions
   - Extract method signatures
   - Build type hierarchy

5. **Include Analyzer** (150 lines)
   - Map APIs to required headers
   - Detect missing includes
   - Suggest include order

6. **Output Formatter** (50 lines)
   - Format suggestions for AI consumption
   - Include examples and usage context

### MCP Tool Interface

```typescript
export async function getCodeCompletionContext(options: {
  file: string;
  line: number;
  column: number;
  partialCode?: string; // e.g., "Player::Cast"
  limit?: number; // Max suggestions (default: 10)
}): Promise<{
  context: CodeContext;
  suggestions: CompletionSuggestion[];
  requiredIncludes: string[];
  patterns: CodePattern[];
}>;

export async function getTypeInfo(
  typeName: string
): Promise<TypeInfo | null>;
```

---

## Tool 4: Memory Leak & Resource Analyzer

**File**: `src/tools/memoryleak.ts`
**Priority**: HIGH
**Estimated Lines**: ~1,500 lines
**Implementation Time**: 4-5 days

### Features to Implement

#### 4.1 Static Analysis Engine
- Scan for `new` without corresponding `delete`
- Track pointer ownership and lifetime
- Detect raw pointers in class members

#### 4.2 RAII Violation Detector
- Identify non-RAII resource management:
  - Mutex locks without guards
  - File handles not in RAII wrappers
  - Database connections not scoped

#### 4.3 Circular Reference Detector
- Build object reference graph
- Detect `shared_ptr` cycles
- Suggest `weak_ptr` usage

#### 4.4 Leak Pattern Database
- TrinityCore-specific leak patterns:
  - `QueryResult` early returns
  - `WorldPacket` allocations
  - `Creature*` / `GameObject*` leaks

#### 4.5 Smart Pointer Suggester
- Recommend `std::unique_ptr<T>`
- Recommend `std::shared_ptr<T>` / `std::weak_ptr<T>`
- Recommend `TC::unique_trackable_ptr<T>`

### Data Structures

```typescript
interface MemoryLeakIssue {
  type: 'raw_pointer_leak' | 'circular_reference' | 'resource_leak' | 'raii_violation';
  severity: 'critical' | 'high' | 'medium' | 'low';
  file: string;
  line: number;
  code: string;
  description: string;
  leakedType: string;
  estimatedLeakSize: string; // "500 KB", "2.4 GB", etc.
  fix: string;
  example: string;
}

interface PointerTracking {
  variable: string;
  type: string;
  allocatedAt: CodeLocation;
  deletedAt?: CodeLocation;
  ownership: 'unique' | 'shared' | 'weak' | 'raw';
  escapedToHeap: boolean;
}

interface ResourceTracking {
  type: 'mutex' | 'file' | 'database' | 'network';
  acquiredAt: CodeLocation;
  releasedAt?: CodeLocation;
  hasRAII: boolean;
  raiiType?: string; // lock_guard, ScopedQueryResult, etc.
}

interface CircularDependency {
  objects: string[];
  referenceChain: Array<{from: string; to: string; viaSharedPtr: boolean}>;
  suggestedWeakPtrLocation: string;
}
```

### Implementation Steps

1. **Pointer Lifetime Tracker** (350 lines)
   - Track `new` allocations
   - Track `delete` calls
   - Detect missing deletes

2. **RAII Checker** (250 lines)
   - Identify resource acquisitions
   - Verify RAII wrappers
   - Suggest RAII patterns

3. **Reference Graph Builder** (300 lines)
   - Build object reference graph
   - Cycle detection algorithm
   - weak_ptr suggestion logic

4. **Leak Pattern Matcher** (250 lines)
   - Database of known leak patterns
   - Pattern matching against code
   - Context-aware detection

5. **Smart Pointer Recommender** (250 lines)
   - Analyze ownership semantics
   - Suggest appropriate smart pointer type
   - Generate refactoring code

6. **Leak Estimator** (100 lines)
   - Estimate memory leak size
   - Project 24-hour leak accumulation
   - Calculate impact on server stability

### MCP Tool Interface

```typescript
export async function analyzeMemoryLeaks(options: {
  filePath?: string;
  directory?: string;
  includePattern?: string;
  checkTypes?: Array<'pointers' | 'resources' | 'circular' | 'raii'>;
}): Promise<{
  summary: {
    totalIssues: number;
    estimatedLeakRate: string; // "2.3 MB per 1000 bots"
    criticalIssues: number;
  };
  issues: MemoryLeakIssue[];
  circularDependencies: CircularDependency[];
  suggestions: string[];
}>;
```

---

## Tool 5: Code Style & Convention Enforcer

**File**: `src/tools/codestyle.ts`
**Priority**: MEDIUM
**Estimated Lines**: ~700 lines
**Implementation Time**: 2-3 days

### Features to Implement

#### 5.1 Naming Convention Checker
- Class names: PascalCase
- Variable names: camelCase
- Constants: UPPER_SNAKE_CASE
- Private members: m_prefix

#### 5.2 Formatting Validator
- Match .clang-format rules:
  - 4-space indentation
  - Allman brace style
  - Line length ≤120 characters

#### 5.3 Comment Standards Enforcer
- Require Doxygen comments for public APIs
- Format: `/** @brief ... */`
- Check @param and @return tags

#### 5.4 File Organization Checker
- Validate header guards (#ifndef, #define, #endif)
- Check include order (system → project → local)
- Verify namespace usage

#### 5.5 Auto-Fixer
- Automatically apply naming convention fixes
- Reformat code to match .clang-format
- Generate missing Doxygen comments (templates)

### Data Structures

```typescript
interface StyleViolation {
  type: 'naming' | 'formatting' | 'comment' | 'organization';
  severity: 'error' | 'warning' | 'info';
  file: string;
  line: number;
  column: number;
  code: string;
  violation: string;
  expected: string;
  autoFixable: boolean;
  fix?: string;
}

interface StyleReport {
  totalViolations: number;
  autoFixable: number;
  violations: StyleViolation[];
  compliance: number; // 0-100%
  readyForReview: boolean;
}
```

### Implementation Steps

1. **Naming Convention Checker** (200 lines)
   - Regex patterns for each convention
   - AST-based identifier extraction
   - Violation detection and fixing

2. **Formatting Validator** (150 lines)
   - Parse .clang-format file
   - Check indentation, braces, line length
   - Generate fix diffs

3. **Comment Checker** (150 lines)
   - Detect missing Doxygen comments
   - Validate comment format
   - Generate comment templates

4. **File Organization Checker** (100 lines)
   - Header guard validation
   - Include order checking
   - Namespace verification

5. **Auto-Fixer** (100 lines)
   - Apply naming fixes
   - Apply formatting fixes
   - Insert comment templates

### MCP Tool Interface

```typescript
export async function checkCodeStyle(options: {
  filePath?: string;
  directory?: string;
  autoFix?: boolean;
  checkTypes?: Array<'naming' | 'formatting' | 'comments' | 'organization'>;
}): Promise<StyleReport>;

export async function formatCode(
  filePath: string,
  autoFix: boolean
): Promise<{
  original: string;
  formatted: string;
  violationsFixed: number;
}>;
```

---

## Implementation Order

### Phase 1: High Priority Tools (Week 1-2)
1. **Thread Safety Analyzer** (Days 1-4)
2. **API Migration Assistant** (Days 5-9)
3. **Smart Code Completion** (Days 10-13)
4. **Memory Leak Analyzer** (Days 14-18)

### Phase 2: Medium Priority Tools (Week 3)
5. **Code Style Enforcer** (Days 19-21)

### Phase 3: Integration & Testing (Week 3)
- Add MCP tool handlers to `src/index.ts`
- Test each tool with real TrinityCore/Playerbot code
- Fix edge cases and bugs
- Documentation and examples

---

## Quality Standards

### Code Quality Requirements
- ✅ Zero TODOs or placeholders
- ✅ Comprehensive error handling
- ✅ TypeScript strict mode compliance
- ✅ JSDoc documentation for all exports
- ✅ Unit tests for core algorithms
- ✅ Performance: <2s for typical file analysis

### Testing Requirements
- Test with real TrinityCore C++ code
- Test with PlayerBot module code
- Verify accuracy of detections
- Validate fix suggestions
- Edge case handling (empty files, malformed code)

---

## Dependencies

### NPM Packages Required
```json
{
  "@typescript-eslint/typescript-estree": "^6.0.0",
  "glob": "^10.0.0",
  "minimatch": "^9.0.0",
  "yaml": "^2.0.0"
}
```

### TrinityCore Knowledge Required
- C++ coding conventions (CLAUDE.md)
- Common concurrency patterns (WorldSession, BotManager)
- API evolution across versions
- Memory management patterns (smart pointers, RAII)

---

## Success Metrics

**Thread Safety Analyzer**:
- Detect 95%+ of race conditions
- Zero false positives on properly-locked code
- Suggest fixes with 90%+ accuracy

**API Migration Assistant**:
- Auto-fix 80%+ of deprecated API calls
- Identify 100% of breaking changes
- Reduce migration time from weeks to days

**Smart Code Completion**:
- Increase AI completion accuracy from 60% to 95%
- Suggest correct API 90%+ of the time
- Recommend proper includes 95%+ of the time

**Memory Leak Analyzer**:
- Detect 95%+ of memory leaks
- Identify 100% of circular references
- Suggest appropriate smart pointer type 90%+ of the time

**Code Style Enforcer**:
- Detect 100% of naming violations
- Auto-fix 95%+ of style issues
- Match .clang-format output exactly

---

**End of List 1 Subplan**

🤖 Generated with [Claude Code](https://claude.com/claude-code)
