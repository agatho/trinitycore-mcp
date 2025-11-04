# AI Code Review System - Test Suite

Comprehensive test suite for the TrinityCore AI Code Review System (Priority #4).

## Overview

This test suite validates all components of the AI Code Review System, ensuring:
- **>90% accuracy target** for violation detection
- **<15% false positive rate** for code quality checks
- **~1000 LOC/sec** analysis speed
- **Complete API coverage** for all 6 MCP tools
- **Rule engine integrity** across all 870+ rules

## Test Structure

```
tests/code-review/
├── fixtures/                      # Test data and fixtures
│   ├── sample-code.cpp           # Sample code with known violations
│   └── test-violations.ts        # Expected violations and mock data
│
├── integration/                   # Integration tests
│   ├── orchestrator.test.ts      # End-to-end workflow tests
│   └── mcp-tools.test.ts         # MCP tool integration tests
│
├── TrinityRuleEngine.test.ts     # Rule engine unit tests
├── accuracy-validation.test.ts   # Accuracy metrics validation
└── README.md                      # This file
```

## Test Categories

### 1. Unit Tests

#### TrinityRuleEngine.test.ts
Tests the core rule engine functionality:
- ✅ Rule initialization (870+ rules across 7 categories)
- ✅ Rule execution and violation detection
- ✅ Rule filtering (severity, category, confidence)
- ✅ Performance benchmarks (~1000 LOC/sec target)
- ✅ Error handling and edge cases
- ✅ Rule metadata validation

**Test Count:** 25+ tests covering all engine functionality

### 2. Integration Tests

#### orchestrator.test.ts
Tests end-to-end code review workflows:
- ✅ Single file review
- ✅ Multiple file review
- ✅ Pattern-based review (glob patterns)
- ✅ Report generation (Markdown, HTML, JSON, Console)
- ✅ Filtering and configuration
- ✅ Performance validation
- ✅ Quick review function
- ✅ Error handling

**Test Count:** 35+ tests covering complete workflows

#### mcp-tools.test.ts
Tests all 6 MCP tool functions:
- ✅ `review-code-file` - Single file review
- ✅ `review-code-files` - Multiple file review
- ✅ `review-code-pattern` - Pattern-based review
- ✅ `review-code-project` - Project directory review
- ✅ `generate-code-review-report` - Report generation
- ✅ `get-code-review-stats` - System statistics

**Test Count:** 40+ tests covering all MCP tools

### 3. Accuracy Validation

#### accuracy-validation.test.ts
Validates accuracy targets (>90%, <15% FP):
- ✅ Null safety violation detection
- ✅ Memory management violation detection
- ✅ Security violation detection
- ✅ False positive rate validation
- ✅ Precision, Recall, F1 Score calculation
- ✅ Confidence scoring validation
- ✅ Category-specific accuracy metrics

**Test Count:** 15+ tests validating accuracy targets

## Test Fixtures

### sample-code.cpp
Contains 16 test cases across all 7 rule categories:

**Null Safety (2 cases)**
1. Null pointer dereference without check (line 9)
2. Missing null check after allocation (line 15)
3. Proper null checking (negative test, line 19-22)

**Memory Management (2 cases)**
4. Memory leak - no delete (line 27)
5. Double delete (line 34)
6. Proper RAII (negative test, line 35-38)

**Concurrency (1 case)**
7. Missing mutex protection (line 47)
8. Proper mutex usage (negative test, line 51-59)

**Convention (2 cases)**
9. Non-TrinityCore naming - snake_case (line 63-64)
10. Proper TrinityCore naming - PascalCase (negative test, line 67-70)

**Security (2 cases)**
11. SQL injection risk (line 76)
12. Buffer overflow risk (line 82)

**Performance (2 cases)**
13. Inefficient string concatenation in loop (line 90)
14. Passing large object by value (line 101)

**Architecture (1 case)**
15. God class - too many responsibilities (line 108)
16. Proper separation of concerns (negative test, line 123-129)

### test-violations.ts
Defines expected violations for accuracy validation:
- Expected violation metadata (ruleId, severity, line, category)
- Mock AST structures for testing
- Mock CodeContext for rule engine tests

## Running Tests

### Run All Tests
```bash
npm test
```

### Run Specific Test Suite
```bash
# Unit tests
npm test -- TrinityRuleEngine.test.ts

# Integration tests
npm test -- integration/orchestrator.test.ts
npm test -- integration/mcp-tools.test.ts

# Accuracy validation
npm test -- accuracy-validation.test.ts
```

### Run Tests with Coverage
```bash
npm test -- --coverage
```

### Run Tests in Watch Mode
```bash
npm test -- --watch
```

### Run Specific Test Pattern
```bash
# Run only accuracy tests
npm test -- --testNamePattern="accuracy"

# Run only MCP tool tests
npm test -- --testNamePattern="MCP"

# Run only performance tests
npm test -- --testNamePattern="performance"
```

## Test Configuration

Tests use Jest with TypeScript support (`ts-jest`):

```javascript
// jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
  ],
};
```

## Coverage Targets

### Minimum Coverage Requirements
- **Lines:** 80%
- **Functions:** 80%
- **Branches:** 75%
- **Statements:** 80%

### Current Coverage (Target)
- **TrinityRuleEngine:** 90%+
- **CodeAnalysisEngine:** 85%+
- **AIReviewEngine:** 80%+
- **ReviewReportGenerator:** 85%+
- **MCP Tools:** 95%+

## Accuracy Targets

### Detection Accuracy (Target: >90%)
Measures how accurately the system detects real code quality issues:
- **Precision:** True Positives / (True Positives + False Positives)
- **Recall:** True Positives / (True Positives + False Negatives)
- **F1 Score:** 2 * (Precision * Recall) / (Precision + Recall)

### False Positive Rate (Target: <15%)
Measures incorrect violation reports:
- **FP Rate:** False Positives / Total Detected Violations

### Confidence Scoring
All violations include confidence scores (0.0-1.0):
- **Critical violations:** Average confidence >0.85
- **Major violations:** Average confidence >0.75
- **Minor violations:** Average confidence >0.65
- **Info violations:** Average confidence >0.50

## Performance Benchmarks

### Analysis Speed (Target: ~1000 LOC/sec)
- Single file review: <5 seconds
- Batch file review (10 files): <15 seconds
- Project review (100+ files): <60 seconds

### Memory Usage
- Per-file analysis: <50MB
- Large project analysis: <500MB

### Rule Execution
- 870+ rules: <3 seconds per file

## Continuous Integration

Tests run automatically on:
- ✅ Push to main/master/develop
- ✅ Pull requests
- ✅ Manual workflow dispatch

See `.github/workflows/code-review-ci.yml` for CI/CD configuration.

## Adding New Tests

### 1. Create Test File
```typescript
// tests/code-review/MyComponent.test.ts
import { MyComponent } from "../../src/code-review/MyComponent";

describe("MyComponent", () => {
  it("should do something", () => {
    const component = new MyComponent();
    expect(component.doSomething()).toBe(true);
  });
});
```

### 2. Add Test Fixtures (if needed)
```typescript
// tests/code-review/fixtures/my-fixtures.ts
export const mockData = {
  // Your fixture data
};
```

### 3. Update Test Coverage
Ensure new code is covered by tests:
```bash
npm test -- --coverage --collectCoverageFrom="src/code-review/MyComponent.ts"
```

## Troubleshooting

### Tests Failing Due to Missing Build Artifacts
```bash
# Build the project first
npm run build

# Then run tests
npm test
```

### Import/Module Resolution Errors
```bash
# Clear Jest cache
npx jest --clearCache

# Reinstall dependencies
rm -rf node_modules
npm install

# Run tests again
npm test
```

### Timeout Errors
Increase Jest timeout in test files:
```typescript
jest.setTimeout(30000); // 30 seconds
```

### Coverage Report Issues
```bash
# Generate coverage report
npm test -- --coverage

# Open coverage report
open coverage/lcov-report/index.html
```

## Test Quality Standards

### ✅ Good Test Practices
- **Descriptive test names** that explain what is being tested
- **Arrange-Act-Assert** pattern for test structure
- **Independent tests** that don't rely on other tests
- **Mock external dependencies** (databases, APIs, file system)
- **Test edge cases** and error conditions
- **Measure performance** where relevant

### ❌ Anti-Patterns to Avoid
- Tests that depend on execution order
- Tests that modify global state
- Tests with unclear assertions
- Tests that test implementation details instead of behavior
- Flaky tests that pass/fail intermittently
- Tests without clear failure messages

## Future Enhancements

### Planned Test Additions
- [ ] **CodeAnalysisEngine.test.ts** - Serena integration tests
- [ ] **AIReviewEngine.test.ts** - LLM enhancement tests
- [ ] **ReviewReportGenerator.test.ts** - Report format tests
- [ ] **Rule-specific tests** - Tests for each rule category
- [ ] **Performance stress tests** - Large file handling
- [ ] **Real-world TrinityCore tests** - Actual codebase validation

### Test Infrastructure Improvements
- [ ] **Test database** - Curated dataset of real violations
- [ ] **Mutation testing** - Verify test effectiveness
- [ ] **Property-based testing** - Random input generation
- [ ] **Snapshot testing** - Report format validation
- [ ] **Visual regression testing** - HTML report validation

## Related Documentation

- **Main README:** `../../README.md`
- **Code Review System:** `../../src/code-review/README.md` (to be created)
- **CI/CD Workflow:** `../../.github/workflows/code-review-ci.yml`
- **MCP Tools:** `../../src/tools/codereview.ts`

## Support

For questions or issues with the test suite:
1. Check the main project README
2. Review the test code for examples
3. Check GitHub Issues for known problems
4. Create a new issue with test failure details

---

**Last Updated:** 2025-01-04
**Test Suite Version:** 1.0.0
**Total Tests:** 115+
**Coverage Target:** 85%+
