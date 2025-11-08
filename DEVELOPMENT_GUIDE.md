# TrinityCore-MCP Development Guide

Complete developer documentation for the TrinityCore Model Context Protocol implementation.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Foundation Systems](#foundation-systems)
3. [Development Workflow](#development-workflow)
4. [Best Practices](#best-practices)
5. [Testing Strategy](#testing-strategy)
6. [Performance Guidelines](#performance-guidelines)
7. [Debugging & Troubleshooting](#debugging--troubleshooting)

## Architecture Overview

### Core Modules

```
trinitycore-mcp/
├── src/                    # MCP Server (Node.js)
│   ├── database/          # Database connection & pooling
│   ├── tools/             # MCP tools implementation
│   └── types/             # TypeScript type definitions
└── web-ui/                # Web Interface (Next.js)
    ├── app/               # Next.js app router pages
    ├── components/        # React components
    └── lib/               # Core utilities
        ├── logger.ts      # Centralized logging
        ├── errors.ts      # Custom error classes
        ├── validation.ts  # Data validation (Zod)
        ├── keyboard-shortcuts.ts  # Keyboard shortcuts
        └── performance.ts # Performance utilities
```

### Technology Stack

- **Backend**: Node.js, TypeScript, MCP SDK
- **Frontend**: Next.js 16, React 19, TypeScript
- **Database**: MySQL/MariaDB (mysql2 driver with pooling)
- **Validation**: Zod schemas
- **Testing**: Vitest, Testing Library
- **UI**: Radix UI, Tailwind CSS, shadcn/ui
- **3D**: Three.js for world visualization

## Foundation Systems

### 1. Error Handling & Logging

**Logger Service** (`lib/logger.ts`)

```typescript
import { Logger } from '@/lib/logger';

// Log levels: DEBUG, INFO, WARN, ERROR, FATAL
Logger.info('Module', 'Operation completed', { count: 10 });
Logger.error('Module', new Error('Failed'), { context: 'details' });

// Get logs
const logs = Logger.getLogs({ level: LogLevel.ERROR, since: Date.now() - 3600000 });

// Subscribe to logs
const unsubscribe = Logger.subscribe((entry) => {
  console.log(entry);
});

// Statistics
const stats = Logger.getStats();
console.log(`Total errors: ${stats.byLevel[LogLevel.ERROR]}`);
```

**Custom Error Classes** (`lib/errors.ts`)

```typescript
import { DatabaseError, ValidationError, ParseError } from '@/lib/errors';

// Throw structured errors
throw new ValidationError('email', userInput, 'must be valid email format');

// Wrap operations
const result = await ErrorHandler.wrapAsync(
  async () => fetchData(),
  'FetchOperation'
);

if (!result.success) {
  console.error(result.error.userMessage);
}
```

### 2. Database Connection Pooling

**Enhanced Pool Manager** (`src/database/db-pool-manager.ts`)

```typescript
import { getPoolManager } from '@/database/db-pool-manager';

const poolManager = getPoolManager();
const pool = poolManager.getPool({
  host: 'localhost',
  port: 3306,
  user: 'trinity',
  password: 'trinity',
  database: 'world',
  maxConnections: 20,
  minConnections: 5,
  enableHealthCheck: true,
  maxRetries: 3,
});

// Execute query with auto-retry
const creatures = await pool.executeQuery<CreatureTemplate[]>(
  'SELECT * FROM creature_template WHERE entry = ?',
  [12345]
);

// Batch transaction
await pool.executeBatch([
  { query: 'UPDATE creature SET name = ?', params: ['Dragon'] },
  { query: 'INSERT INTO logs ...', params: [...] },
]);

// Health check
const healthy = await pool.checkHealth();

// Statistics
const stats = pool.getStats();
console.log(`Avg query time: ${stats.averageQueryTime}ms`);
```

### 3. Data Validation

**Validation Framework** (`lib/validation.ts`)

```typescript
import { validate, creatureTemplateSchema, sanitizeString } from '@/lib/validation';

// Validate data
const creature = validate(creatureTemplateSchema, userInput, 'creature');

// Safe validation (no throw)
const result = safeValidate(creatureTemplateSchema, data);
if (result.success) {
  // Use result.data
}

// Sanitize user input
const name = sanitizeString(req.body.name, 100);

// Composite validation
const validated = validateCreatureData({
  template: { entry: 12345, name: 'Dragon', ... },
  spawns: [...],
  loot: [...],
});
```

### 4. Keyboard Shortcuts & Command Palette

**Keyboard Shortcuts** (`lib/keyboard-shortcuts.ts`)

```typescript
import { getShortcutManager, getCommandPalette } from '@/lib/keyboard-shortcuts';

// Register shortcut
const shortcuts = getShortcutManager();
shortcuts.register({
  id: 'save-document',
  name: 'Save Document',
  description: 'Save the current document',
  category: 'File',
  keys: { key: 's', modifiers: ['ctrl'] },
  handler: () => saveDocument(),
});

// Register command
const palette = getCommandPalette();
palette.register({
  id: 'reload',
  name: 'Reload Page',
  category: 'General',
  keywords: ['refresh', 'reload'],
  handler: () => window.location.reload(),
});

// Search commands
const results = palette.search('reload');

// Execute command
await palette.execute('reload');
```

### 5. Performance Optimizations

**Performance Utilities** (`lib/performance.ts`)

```typescript
import { debounce, throttle, memoize, BatchProcessor } from '@/lib/performance';

// Debounce search input
const handleSearch = debounce((query: string) => {
  performSearch(query);
}, 300);

// Throttle scroll events
const handleScroll = throttle(() => {
  updateScrollPosition();
}, 100);

// Memoize expensive calculations
const calculateStats = memoize((data: number[]) => {
  return data.reduce((sum, n) => sum + n, 0) / data.length;
});

// Batch operations
const batchLogger = new BatchProcessor(
  (items) => saveToDatabase(items),
  { wait: 1000, maxSize: 100 }
);
batchLogger.add(logEntry);

// Measure performance
const result = await measurePerformance('FetchCreatures', async () => {
  return await fetchCreatures();
});
```

## Development Workflow

### Setup

```bash
# Clone repository
git clone https://github.com/agatho/trinitycore-mcp.git
cd trinitycore-mcp

# Install dependencies
cd web-ui && npm install

# Run tests
npm test

# Start development server
npm run dev
```

### Testing

```bash
# Run all tests
npm test

# Run specific test file
npm test validation.test.ts

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage

# UI mode (interactive)
npm run test:ui
```

### Code Quality

```bash
# Lint code
npm run lint

# Type check
npx tsc --noEmit
```

## Best Practices

### Error Handling

✅ **DO:**
- Use custom error classes for domain-specific errors
- Provide user-friendly messages and technical details separately
- Log all errors with context
- Catch and handle errors at appropriate boundaries

❌ **DON'T:**
- Swallow errors silently
- Use generic `Error` for all errors
- Log errors without context
- Let errors propagate to user without handling

### Database Operations

✅ **DO:**
- Use connection pooling
- Parameterize all queries (prevent SQL injection)
- Use transactions for multi-step operations
- Monitor pool statistics
- Set appropriate timeouts

❌ **DON'T:**
- Create connections on-demand
- Concatenate user input into SQL strings
- Leave connections open
- Ignore retry logic for transient failures

### Data Validation

✅ **DO:**
- Validate all user input
- Sanitize strings before storage
- Use Zod schemas for type safety
- Validate at API boundaries
- Provide specific error messages

❌ **DON'T:**
- Trust client-side validation alone
- Skip validation for "internal" data
- Use generic validation errors
- Validate after database insertion

### Performance

✅ **DO:**
- Debounce rapid user input
- Throttle frequent events (scroll, resize)
- Memoize expensive calculations
- Batch database operations
- Use virtual scrolling for large lists
- Lazy load heavy components

❌ **DON'T:**
- Re-render on every keystroke
- Fetch data on every scroll event
- Recalculate on every render
- Make individual database calls in loops
- Load all data upfront

## Testing Strategy

### Unit Tests

Test individual functions and classes in isolation:

```typescript
describe('validateCreatureData', () => {
  it('should accept valid creature data', () => {
    const data = { template: { ... }, spawns: [...] };
    expect(validateCreatureData(data)).toEqual(data);
  });

  it('should reject minlevel > maxlevel', () => {
    const data = { template: { minlevel: 85, maxlevel: 80 } };
    expect(() => validateCreatureData(data)).toThrow();
  });
});
```

### Integration Tests

Test interaction between modules:

```typescript
describe('Database Pool Integration', () => {
  it('should execute query and log success', async () => {
    const pool = poolManager.getPool(config);
    await pool.executeQuery('SELECT 1');

    const logs = Logger.getLogs({ context: 'DBPool' });
    expect(logs.some(l => l.message.includes('executed'))).toBe(true);
  });
});
```

### Coverage Targets

- **Lines**: 80%+
- **Functions**: 80%+
- **Branches**: 80%+
- **Statements**: 80%+

## Performance Guidelines

### Bundle Size

- Keep page bundles under 200KB (gzipped)
- Code-split routes and heavy components
- Use dynamic imports for large dependencies
- Tree-shake unused code

### Runtime Performance

- First Contentful Paint (FCP): < 1.8s
- Time to Interactive (TTI): < 3.8s
- Cumulative Layout Shift (CLS): < 0.1
- First Input Delay (FID): < 100ms

### Database Performance

- Query time: < 100ms (p95)
- Connection pool utilization: < 80%
- Active connections: Monitor and alert
- Failed queries: < 0.1%

## Debugging & Troubleshooting

### Enable Debug Logging

```typescript
Logger.configure({ minLevel: LogLevel.DEBUG });
```

### View Logs

```typescript
// All logs
const logs = Logger.getLogs();

// Errors only
const errors = Logger.getErrors();

// Last hour
const recent = Logger.getLogs({ since: Date.now() - 3600000 });

// Export logs
const exported = Logger.exportLogs();
console.log(exported);
```

### Database Issues

```typescript
// Check pool health
const health = await pool.checkHealth();

// View statistics
const stats = pool.getStats();
console.log(JSON.stringify(stats, null, 2));

// Check all pools
const allStats = poolManager.getAllStats();
```

### Performance Profiling

```typescript
// Mark start/end
mark('operation-start');
// ... do work ...
mark('operation-end');
measure('operation', 'operation-start', 'operation-end');

// Measure function
const result = await measurePerformance('fetchData', async () => {
  return await fetchData();
});
```

### Common Issues

**Issue**: Tests failing with "File has not been read yet"
**Solution**: Use `Read` tool before `Edit` or `Write` for existing files

**Issue**: Database connection errors
**Solution**: Check pool configuration, verify credentials, check network

**Issue**: Validation errors
**Solution**: Check Zod schema, verify data types, review error messages

**Issue**: Performance degradation
**Solution**: Check database pool stats, review slow queries, check memory usage

## Contributing

1. Create feature branch: `git checkout -b feature/my-feature`
2. Write tests first (TDD approach)
3. Implement feature
4. Ensure all tests pass: `npm test`
5. Run linter: `npm run lint`
6. Commit with clear message
7. Push and create pull request

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Zod Documentation](https://zod.dev/)
- [Next.js Documentation](https://nextjs.org/docs)
- [TrinityCore Documentation](https://trinitycore.info/)
- [MCP SDK](https://github.com/modelcontextprotocol/typescript-sdk)

---

**Last Updated**: 2025-01-08
**Version**: 3.0.0
**Contributors**: Claude Code
