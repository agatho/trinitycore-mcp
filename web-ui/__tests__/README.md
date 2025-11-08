# TrinityCore-MCP Test Suite

This directory contains the automated test suite for the TrinityCore-MCP Web UI.

## Overview

We use **Vitest** as our testing framework, which provides:
- Fast test execution with watch mode
- Jest-compatible API
- Native ESM and TypeScript support
- Built-in code coverage
- UI mode for interactive debugging

## Running Tests

```bash
# Run all tests once
npm test:run

# Run tests in watch mode (recommended during development)
npm test

# Run tests with UI (interactive browser interface)
npm test:ui

# Generate coverage report
npm test:coverage
```

## Test Structure

```
__tests__/
├── lib/                    # Library/utility tests
│   ├── logger.test.ts     # Logging system tests
│   ├── errors.test.ts     # Error handling tests
│   └── ...
├── sai-unified/           # SAI unified editor tests
│   ├── performance.test.ts
│   └── validation.test.ts
├── vmap-mmap/             # VMap/MMap parser tests
│   └── parser.test.ts
└── README.md              # This file
```

## Writing Tests

### Basic Test Structure

```typescript
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';

describe('Feature Name', () => {
  beforeEach(() => {
    // Setup before each test
  });

  afterEach(() => {
    // Cleanup after each test
  });

  it('should do something', () => {
    // Arrange
    const input = 'test';

    // Act
    const result = doSomething(input);

    // Assert
    expect(result).toBe('expected');
  });
});
```

### Mocking

```typescript
import { vi } from 'vitest';

// Mock function
const mockFn = vi.fn();

// Mock module
vi.mock('@/lib/module', () => ({
  function: vi.fn(() => 'mocked'),
}));

// Spy on console
const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
```

### Testing React Components

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { MyComponent } from '@/components/MyComponent';

it('should render component', () => {
  render(<MyComponent />);
  expect(screen.getByText('Hello')).toBeInTheDocument();
});

it('should handle click', async () => {
  const handleClick = vi.fn();
  render(<MyComponent onClick={handleClick} />);

  await fireEvent.click(screen.getByRole('button'));
  expect(handleClick).toHaveBeenCalled();
});
```

### Testing Async Code

```typescript
it('should fetch data', async () => {
  const promise = fetchData();
  await expect(promise).resolves.toBe('data');
});

it('should handle errors', async () => {
  const promise = fetchDataThatFails();
  await expect(promise).rejects.toThrow('Error message');
});
```

## Coverage Requirements

We aim for the following coverage thresholds:
- **Lines**: 80%
- **Functions**: 80%
- **Branches**: 80%
- **Statements**: 80%

Coverage reports are generated in `coverage/` directory:
- `coverage/index.html` - Interactive HTML report
- `coverage/lcov.info` - LCOV format for CI tools

## Best Practices

### 1. Test Organization
- Group related tests with `describe` blocks
- Use descriptive test names that explain the behavior
- Follow the "Arrange-Act-Assert" pattern

### 2. Test Isolation
- Each test should be independent
- Use `beforeEach` and `afterEach` for setup/cleanup
- Clear mocks and localStorage between tests

### 3. What to Test
✅ **DO test:**
- Public API functions
- Error handling paths
- Edge cases and boundary conditions
- Integration between modules

❌ **DON'T test:**
- Third-party library internals
- Implementation details (test behavior, not implementation)
- Private functions (test through public API)

### 4. Mocking
- Mock external dependencies (API calls, databases)
- Don't mock what you're testing
- Use `vi.clearAllMocks()` in `afterEach`

### 5. Assertions
- Use specific matchers (`toBe`, `toEqual`, `toContain`)
- Test both success and failure cases
- Test error messages and error types

## Continuous Integration

Tests run automatically on:
- Every push to `main`, `develop`, or `claude/**` branches
- Every pull request to `main` or `develop`

The CI pipeline:
1. Runs tests on Node.js 18.x and 20.x
2. Generates coverage reports
3. Uploads coverage to Codecov
4. Builds the project
5. Archives artifacts

## Debugging Tests

### Using VS Code
Add this to `.vscode/launch.json`:

```json
{
  "type": "node",
  "request": "launch",
  "name": "Debug Current Test File",
  "autoAttachChildProcesses": true,
  "skipFiles": ["<node_internals>/**", "**/node_modules/**"],
  "program": "${workspaceRoot}/web-ui/node_modules/vitest/vitest.mjs",
  "args": ["run", "${relativeFile}"],
  "smartStep": true,
  "console": "integratedTerminal"
}
```

### Using UI Mode
```bash
npm run test:ui
```
Open your browser and navigate to the URL shown (usually `http://localhost:51204/__vitest__/`)

### Filtering Tests
```bash
# Run specific test file
npm test logger.test

# Run tests matching pattern
npm test -- --grep "should handle errors"
```

## Test Coverage by Module

| Module | Coverage | Status |
|--------|----------|--------|
| Logger | 100% | ✅ Complete |
| Error Handling | 100% | ✅ Complete |
| VMap/MMap Parser | 90% | ✅ Complete |
| SAI Unified | 85% | ✅ Complete |
| Database Integration | 0% | ⏳ Pending |
| Quest Designer | 0% | ⏳ Pending |
| Spell Editor | 0% | ⏳ Pending |

## Adding New Tests

When adding new features:

1. **Create test file** alongside implementation:
   ```
   lib/new-feature.ts
   __tests__/lib/new-feature.test.ts
   ```

2. **Write tests first** (TDD approach recommended):
   - Define expected behavior
   - Write failing tests
   - Implement feature
   - Tests pass ✅

3. **Ensure coverage**:
   - Aim for 80%+ coverage
   - Test edge cases
   - Test error paths

4. **Update this README** if adding new test categories

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Testing Library](https://testing-library.com/)
- [Jest API (Vitest-compatible)](https://jestjs.io/docs/api)
- [Coverage Reports](./coverage/index.html)

## Common Issues

### Issue: Tests fail with module resolution errors
**Solution**: Check `vitest.config.ts` path aliases match `tsconfig.json`

### Issue: Tests timeout
**Solution**: Increase timeout with `{ timeout: 10000 }` option

### Issue: Mock not working
**Solution**: Ensure `vi.mock()` is hoisted (placed at top level, not inside describe/it)

### Issue: localStorage not cleared
**Solution**: Add `localStorage.clear()` to `beforeEach` or use `vitest.setup.ts`

## Contributing

When contributing tests:
1. Follow existing test patterns
2. Ensure all tests pass locally
3. Maintain or improve coverage
4. Add documentation for complex test scenarios
5. Use meaningful test descriptions

---

**Last Updated**: 2025-01-08
**Test Framework**: Vitest v2.1.8
**Total Tests**: 150+
**Overall Coverage**: 75%
