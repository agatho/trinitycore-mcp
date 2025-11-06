# SAI Editor Testing Guide

Comprehensive testing guide for the TrinityCore SAI Unified Editor.

## Overview

The testing suite includes:
- **Unit Tests**: Individual functions and modules
- **Integration Tests**: Component interactions
- **Performance Tests**: Optimization validation
- **E2E Tests**: Full user workflows (future)

---

## Quick Start

### Install Dependencies

```bash
cd web-ui
npm install --save-dev jest @testing-library/react @testing-library/jest-dom @testing-library/user-event @swc/jest
```

### Run Tests

```bash
# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Run in watch mode
npm test -- --watch

# Run specific test file
npm test -- validation.test.ts

# Run tests matching pattern
npm test -- --testNamePattern="validates node"
```

---

## Test Structure

```
web-ui/
├── __tests__/
│   ├── sai-unified/
│   │   ├── validation.test.ts      # Validation engine tests
│   │   ├── performance.test.ts     # Performance utilities tests
│   │   ├── collaboration.test.ts   # Collaboration system tests
│   │   ├── database-validation.test.ts
│   │   └── ai-providers.test.ts
│   └── components/
│       ├── SAIEditor.test.tsx
│       ├── SAINode.test.tsx
│       └── ParameterEditor.test.tsx
├── jest.config.js                  # Jest configuration
└── jest.setup.js                   # Test environment setup
```

---

## Writing Tests

### Basic Test Structure

```typescript
describe('ModuleName', () => {
  describe('FunctionName', () => {
    test('should do something', () => {
      // Arrange
      const input = createTestData();

      // Act
      const result = functionToTest(input);

      // Assert
      expect(result).toBe(expected);
    });
  });
});
```

### Testing React Components

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { SAIEditor } from '@/components/sai-editor/SAIEditor';

describe('SAIEditor', () => {
  test('renders editor toolbar', () => {
    render(<SAIEditor scriptId="test" />);

    expect(screen.getByText('Add Node')).toBeInTheDocument();
  });

  test('adds node on button click', async () => {
    const { user } = render(<SAIEditor scriptId="test" />);

    await user.click(screen.getByText('Add Node'));
    await user.click(screen.getByText('Event'));

    expect(screen.getByText('Event Node')).toBeInTheDocument();
  });
});
```

### Testing Async Functions

```typescript
test('fetches data successfully', async () => {
  const mockData = { id: 1, name: 'Test' };

  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => mockData,
  });

  const result = await fetchData(1);

  expect(result).toEqual(mockData);
  expect(fetch).toHaveBeenCalledWith('/api/data/1');
});
```

### Testing Hooks

```typescript
import { renderHook, act } from '@testing-library/react';
import { useCollaboration } from '@/lib/sai-unified/collaboration';

test('manages collaboration state', () => {
  const { result } = renderHook(() => useCollaboration('script-1', true));

  expect(result.current.state.connected).toBe(false);

  act(() => {
    result.current.manager?.connect();
  });

  expect(result.current.state.connected).toBe(true);
});
```

---

## Test Categories

### 1. Validation Tests

Tests for the SAI validation engine.

```typescript
// __tests__/sai-unified/validation.test.ts

describe('Validation Engine', () => {
  test('validates minimal script', () => {
    const script = createMinimalScript();
    const result = validateScript(script);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('detects missing event nodes', () => {
    const script = createScriptWithoutEvents();
    const result = validateScript(script);

    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({
        message: expect.stringContaining('event'),
      })
    );
  });
});
```

### 2. Performance Tests

Tests for optimization utilities.

```typescript
// __tests__/sai-unified/performance.test.ts

describe('Performance Utilities', () => {
  test('debounce delays execution', () => {
    jest.useFakeTimers();

    const fn = jest.fn();
    const debounced = debounce(fn, 100);

    debounced();
    expect(fn).not.toHaveBeenCalled();

    jest.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test('cache respects TTL', () => {
    const cache = new MemoCache(10, 1000);

    cache.set('key', 'value');
    expect(cache.get('key')).toBe('value');

    jest.advanceTimersByTime(1001);
    expect(cache.get('key')).toBeUndefined();
  });
});
```

### 3. Collaboration Tests

Tests for real-time collaboration.

```typescript
// __tests__/sai-unified/collaboration.test.ts

describe('Collaboration', () => {
  test('broadcasts updates to other users', (done) => {
    const manager1 = new CollaborationManager('script', 'user1', 'User 1', '#FF0000');
    const manager2 = new CollaborationManager('script', 'user2', 'User 2', '#00FF00');

    manager2.onUpdate((update) => {
      expect(update.userId).toBe('user1');
      done();
    });

    manager1.connect();
    manager2.connect();

    setTimeout(() => {
      manager1.broadcastUpdate([
        { type: 'node-add', node: testNode }
      ]);
    }, 100);
  });
});
```

### 4. Component Tests

Tests for React components.

```typescript
// __tests__/components/SAINode.test.tsx

describe('SAINode Component', () => {
  test('renders event node', () => {
    const data = {
      id: 'event-1',
      type: 'event',
      label: 'Update IC',
      typeName: 'SMART_EVENT_UPDATE_IC',
      parameters: [],
    };

    render(
      <ReactFlowProvider>
        <SAINode data={data} />
      </ReactFlowProvider>
    );

    expect(screen.getByText('Update IC')).toBeInTheDocument();
  });

  test('shows validation errors', () => {
    const data = {
      ...testNodeData,
      validation: { hasErrors: true },
    };

    render(<SAINode data={data} />);

    expect(screen.getByTestId('error-icon')).toBeInTheDocument();
  });
});
```

---

## Mocking

### Mock MCP Client

```typescript
jest.mock('@/lib/mcp-client', () => ({
  getMCPClient: jest.fn(() => ({
    callTool: jest.fn().mockResolvedValue({
      success: true,
      result: [{ id: 1, name: 'Test Spell' }],
    }),
  })),
}));
```

### Mock WebSocket

```typescript
const mockWs = global.testUtils.mockWebSocket();

jest.spyOn(global, 'WebSocket').mockImplementation(() => mockWs);

// Trigger events
mockWs.trigger('message', { type: 'update', data: {} });
```

### Mock Fetch

```typescript
global.fetch = global.testUtils.mockFetch({
  id: 1,
  name: 'Test',
});

// Or with error
global.fetch = global.testUtils.mockFetch(
  { error: 'Not found' },
  false,
  404
);
```

---

## Coverage

### View Coverage Report

```bash
npm test -- --coverage

# Open HTML report
open coverage/lcov-report/index.html
```

### Coverage Thresholds

The project requires:
- 70% branch coverage
- 70% function coverage
- 70% line coverage
- 70% statement coverage

### Improving Coverage

1. **Identify uncovered code**:
```bash
npm test -- --coverage --collectCoverageFrom='lib/sai-unified/**/*.ts'
```

2. **Write tests for uncovered paths**:
```typescript
test('handles error case', () => {
  expect(() => {
    functionThatThrows();
  }).toThrow();
});
```

3. **Test edge cases**:
```typescript
test('handles empty input', () => {
  expect(processData([])).toEqual([]);
});

test('handles null input', () => {
  expect(processData(null)).toBeNull();
});
```

---

## Best Practices

### 1. Test Isolation

Each test should be independent:

```typescript
beforeEach(() => {
  // Reset state before each test
  jest.clearAllMocks();
  localStorage.clear();
});

afterEach(() => {
  // Clean up after each test
  jest.restoreAllMocks();
});
```

### 2. Descriptive Test Names

```typescript
// ✅ Good
test('validates node with missing required parameters', () => {});

// ❌ Bad
test('test1', () => {});
```

### 3. Arrange-Act-Assert Pattern

```typescript
test('calculates total correctly', () => {
  // Arrange
  const items = [1, 2, 3];

  // Act
  const total = calculateTotal(items);

  // Assert
  expect(total).toBe(6);
});
```

### 4. Test One Thing

```typescript
// ✅ Good - One assertion
test('returns uppercase string', () => {
  expect(toUpperCase('hello')).toBe('HELLO');
});

// ❌ Bad - Multiple unrelated assertions
test('string functions', () => {
  expect(toUpperCase('hello')).toBe('HELLO');
  expect(toLowerCase('HELLO')).toBe('hello');
  expect(trim('  hello  ')).toBe('hello');
});
```

### 5. Use Test Data Builders

```typescript
const createTestScript = (overrides = {}) => ({
  id: 'test-script',
  name: 'Test Script',
  nodes: [],
  connections: [],
  ...overrides,
});

test('validates empty script', () => {
  const script = createTestScript({ nodes: [] });
  // ...
});
```

---

## Debugging Tests

### Run Single Test

```bash
npm test -- -t "validates node types"
```

### Debug in VS Code

Add to `.vscode/launch.json`:

```json
{
  "type": "node",
  "request": "launch",
  "name": "Jest Debug",
  "program": "${workspaceFolder}/node_modules/.bin/jest",
  "args": [
    "--runInBand",
    "--no-cache",
    "${file}"
  ],
  "console": "integratedTerminal",
  "internalConsoleOptions": "neverOpen"
}
```

### Console Logging

```typescript
test('debug test', () => {
  console.log('Debug info:', data);
  expect(true).toBe(true);
});
```

### Snapshot Debugging

```typescript
test('matches snapshot', () => {
  const result = complexFunction();

  // Update snapshot
  expect(result).toMatchSnapshot();
});

// Update all snapshots
// npm test -- -u
```

---

## Continuous Integration

### GitHub Actions

```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm test -- --coverage
      - uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
```

---

## Common Issues

### Issue: Tests timeout

**Solution**: Increase timeout

```typescript
test('slow operation', async () => {
  // ...
}, 30000); // 30 seconds
```

### Issue: Async operations not completing

**Solution**: Use `await` or return promise

```typescript
// ✅ Good
test('async test', async () => {
  await asyncOperation();
  expect(result).toBe(expected);
});

// ❌ Bad
test('async test', () => {
  asyncOperation(); // Not awaited!
  expect(result).toBe(expected);
});
```

### Issue: Mocks not resetting

**Solution**: Clear mocks between tests

```typescript
beforeEach(() => {
  jest.clearAllMocks();
});
```

---

## Resources

- [Jest Documentation](https://jestjs.io/)
- [Testing Library](https://testing-library.com/)
- [React Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
- [Testing Trophy](https://kentcdodds.com/blog/the-testing-trophy-and-testing-classifications)

---

## Roadmap

- [ ] E2E tests with Playwright
- [ ] Visual regression tests
- [ ] Performance benchmarks
- [ ] Mutation testing
- [ ] Property-based testing
- [ ] Contract testing for API
- [ ] Load testing for WebSocket
- [ ] Accessibility testing
