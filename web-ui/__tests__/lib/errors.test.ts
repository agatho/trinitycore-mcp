/**
 * Error Handling Tests
 *
 * Unit tests for custom error classes and error handling utilities
 */

import { describe, expect, it, beforeEach, vi, afterEach } from 'vitest';
import {
  AppError,
  ParseError,
  DatabaseError,
  ValidationError,
  NetworkError,
  PermissionError,
  ConfigurationError,
  NotFoundError,
  MemoryError,
  ErrorHandler,
  assert,
  isAppError,
  type ErrorContext,
} from '@/lib/errors';
import { Logger, LogLevel } from '@/lib/logger';

describe('Error Handling System', () => {
  beforeEach(() => {
    // Clear localStorage and logs before each test
    localStorage.clear();
    Logger.configure({ enableConsole: false });
    Logger.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('AppError Base Class', () => {
    it('should create an AppError with message', () => {
      const error = new AppError('Test error');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AppError);
      expect(error.message).toBe('Test error');
      expect(error.name).toBe('AppError');
      expect(error.timestamp).toBeDefined();
    });

    it('should create AppError with context', () => {
      const context: Partial<ErrorContext> = {
        userMessage: 'User-friendly message',
        technicalDetails: 'Technical details',
        suggestedAction: 'Try again',
        recoverable: true,
        severity: 'high',
        metadata: { foo: 'bar' },
      };

      const error = new AppError('Test error', context);

      expect(error.context.userMessage).toBe('User-friendly message');
      expect(error.context.technicalDetails).toBe('Technical details');
      expect(error.context.suggestedAction).toBe('Try again');
      expect(error.context.recoverable).toBe(true);
      expect(error.context.severity).toBe('high');
      expect(error.context.metadata).toEqual({ foo: 'bar' });
    });

    it('should use message as userMessage if not provided', () => {
      const error = new AppError('Test error');
      expect(error.context.userMessage).toBe('Test error');
    });

    it('should have default values for optional context fields', () => {
      const error = new AppError('Test error');

      expect(error.context.recoverable).toBe(true);
      expect(error.context.severity).toBe('medium');
      expect(error.context.technicalDetails).toBeUndefined();
      expect(error.context.suggestedAction).toBeUndefined();
    });

    it('should capture stack trace', () => {
      const error = new AppError('Test error');
      expect(error.stack).toBeDefined();
    });

    it('should log error when created', () => {
      const error = new AppError('Test error');

      const logs = Logger.getLogs();
      expect(logs.length).toBe(1);
      expect(logs[0].level).toBe(LogLevel.ERROR);
      expect(logs[0].context).toBe('AppError');
    });

    it('should return user-friendly message', () => {
      const error = new AppError('Test error', {
        userMessage: 'User message',
      });

      expect(error.getUserMessage()).toBe('User message');
    });

    it('should return full error details', () => {
      const error = new AppError('Test error', {
        userMessage: 'User message',
        technicalDetails: 'Technical info',
        suggestedAction: 'Fix it',
      });

      const details = error.getDetails();
      expect(details).toContain('User message');
      expect(details).toContain('Technical Details: Technical info');
      expect(details).toContain('Suggested Action: Fix it');
    });
  });

  describe('ParseError', () => {
    it('should create ParseError with correct context', () => {
      const error = new ParseError('test.map', 'MAP', 'Invalid magic header', 'Expected 0x4D415020');

      expect(error).toBeInstanceOf(AppError);
      expect(error.message).toContain('test.map');
      expect(error.context.userMessage).toContain('test.map');
      expect(error.context.userMessage).toContain('MAP');
      expect(error.context.userMessage).toContain('Invalid magic header');
      expect(error.context.technicalDetails).toBe('Expected 0x4D415020');
      expect(error.context.recoverable).toBe(true);
      expect(error.context.severity).toBe('medium');
      expect(error.context.suggestedAction).toContain('valid MAP file');
    });

    it('should include metadata', () => {
      const error = new ParseError('test.vmtile', 'VMap', 'Corrupt data');

      expect(error.context.metadata).toEqual({
        fileName: 'test.vmtile',
        fileType: 'VMap',
        reason: 'Corrupt data',
      });
    });
  });

  describe('DatabaseError', () => {
    it('should create DatabaseError with operation details', () => {
      const error = new DatabaseError('query', 'Connection timeout', '08S01');

      expect(error).toBeInstanceOf(AppError);
      expect(error.message).toContain('query');
      expect(error.context.userMessage).toContain('query');
      expect(error.context.technicalDetails).toContain('Connection timeout');
      expect(error.context.technicalDetails).toContain('SQL State: 08S01');
      expect(error.context.severity).toBe('high');
      expect(error.context.suggestedAction).toContain('database connection');
    });

    it('should work without SQL state', () => {
      const error = new DatabaseError('insert', 'Duplicate key');

      expect(error.context.technicalDetails).not.toContain('SQL State');
      expect(error.context.metadata).toEqual({
        operation: 'insert',
        sqlState: undefined,
      });
    });
  });

  describe('ValidationError', () => {
    it('should create ValidationError with field details', () => {
      const error = new ValidationError('email', 'invalid@', 'must be valid email');

      expect(error).toBeInstanceOf(AppError);
      expect(error.context.userMessage).toContain('email');
      expect(error.context.userMessage).toContain('must be valid email');
      expect(error.context.technicalDetails).toContain('invalid@');
      expect(error.context.severity).toBe('low');
      expect(error.context.recoverable).toBe(true);
    });

    it('should include validation metadata', () => {
      const error = new ValidationError('age', -5, 'must be positive');

      expect(error.context.metadata).toEqual({
        field: 'age',
        value: -5,
        constraint: 'must be positive',
      });
    });
  });

  describe('NetworkError', () => {
    it('should create NetworkError with status code', () => {
      const error = new NetworkError('https://api.example.com/data', 404, 'Not Found');

      expect(error).toBeInstanceOf(AppError);
      expect(error.message).toContain('404');
      expect(error.message).toContain('Not Found');
      expect(error.context.technicalDetails).toContain('https://api.example.com/data');
      expect(error.context.technicalDetails).toContain('404');
      expect(error.context.severity).toBe('medium');
    });

    it('should handle network errors without status code', () => {
      const error = new NetworkError('https://api.example.com/data');

      expect(error.message).toContain('Network request failed');
      expect(error.context.technicalDetails).toContain('unknown');
    });

    it('should include network metadata', () => {
      const error = new NetworkError('https://api.example.com', 500, 'Internal Server Error');

      expect(error.context.metadata).toEqual({
        url: 'https://api.example.com',
        statusCode: 500,
        statusText: 'Internal Server Error',
      });
    });
  });

  describe('PermissionError', () => {
    it('should create PermissionError', () => {
      const error = new PermissionError('delete', 'user records');

      expect(error).toBeInstanceOf(AppError);
      expect(error.context.userMessage).toContain('delete');
      expect(error.context.userMessage).toContain('user records');
      expect(error.context.recoverable).toBe(false);
      expect(error.context.severity).toBe('medium');
      expect(error.context.suggestedAction).toContain('administrator');
    });
  });

  describe('ConfigurationError', () => {
    it('should create ConfigurationError', () => {
      const error = new ConfigurationError('DATABASE_URL', 'missing required variable');

      expect(error).toBeInstanceOf(AppError);
      expect(error.context.userMessage).toContain('missing required variable');
      expect(error.context.technicalDetails).toContain('DATABASE_URL');
      expect(error.context.recoverable).toBe(false);
      expect(error.context.severity).toBe('critical');
      expect(error.context.suggestedAction).toContain('.env.local');
    });
  });

  describe('NotFoundError', () => {
    it('should create NotFoundError', () => {
      const error = new NotFoundError('creature', 12345);

      expect(error).toBeInstanceOf(AppError);
      expect(error.context.userMessage).toContain('creature');
      expect(error.context.technicalDetails).toContain('12345');
      expect(error.context.severity).toBe('low');
      expect(error.context.recoverable).toBe(true);
    });

    it('should work with string identifier', () => {
      const error = new NotFoundError('quest', 'the-lost-sword');

      expect(error.context.technicalDetails).toContain('the-lost-sword');
    });
  });

  describe('MemoryError', () => {
    it('should create MemoryError', () => {
      const error = new MemoryError('parsing large file', 950, 1024);

      expect(error).toBeInstanceOf(AppError);
      expect(error.message).toBe('Out of memory');
      expect(error.context.technicalDetails).toContain('950MB');
      expect(error.context.technicalDetails).toContain('1024MB');
      expect(error.context.technicalDetails).toContain('parsing large file');
      expect(error.context.severity).toBe('critical');
      expect(error.context.recoverable).toBe(false);
    });
  });

  describe('ErrorHandler Utility', () => {
    describe('handle', () => {
      it('should handle AppError instances', () => {
        const error = new AppError('Test error', {
          userMessage: 'User message',
          severity: 'high',
        });

        const context = ErrorHandler.handle(error);

        expect(context).toBe(error.context);
        expect(context.userMessage).toBe('User message');
        expect(context.severity).toBe('high');
      });

      it('should handle standard Error instances', () => {
        const error = new Error('Standard error');

        const context = ErrorHandler.handle(error);

        expect(context.userMessage).toBe('An unexpected error occurred');
        expect(context.technicalDetails).toBe('Standard error');
        expect(context.severity).toBe('medium');
        expect(context.recoverable).toBe(true);
      });

      it('should handle unknown error types', () => {
        const context = ErrorHandler.handle('String error');

        expect(context.userMessage).toBe('An unknown error occurred');
        expect(context.technicalDetails).toBe('String error');
        expect(context.severity).toBe('low');
      });

      it('should include stack trace for standard errors', () => {
        const error = new Error('Test');
        const context = ErrorHandler.handle(error);

        expect(context.metadata?.stack).toBeDefined();
      });
    });

    describe('wrapAsync', () => {
      it('should return success for successful async operations', async () => {
        const fn = async () => 'success';
        const result = await ErrorHandler.wrapAsync(fn, 'Test context');

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toBe('success');
        }
      });

      it('should return error context for failed async operations', async () => {
        const fn = async () => {
          throw new AppError('Test error', { severity: 'high' });
        };

        const result = await ErrorHandler.wrapAsync(fn, 'Test context');

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toBeDefined();
          expect(result.error.severity).toBe('high');
        }
      });

      it('should log errors from async operations', async () => {
        const fn = async () => {
          throw new Error('Async error');
        };

        await ErrorHandler.wrapAsync(fn, 'AsyncContext');

        const logs = Logger.getLogs({ context: 'AsyncContext' });
        expect(logs.length).toBeGreaterThan(0);
      });
    });

    describe('wrap', () => {
      it('should return success for successful sync operations', () => {
        const fn = () => 42;
        const result = ErrorHandler.wrap(fn, 'Test context');

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toBe(42);
        }
      });

      it('should return error context for failed sync operations', () => {
        const fn = () => {
          throw new ValidationError('field', 'value', 'constraint');
        };

        const result = ErrorHandler.wrap(fn, 'Test context');

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toBeDefined();
          expect(result.error.severity).toBe('low');
        }
      });

      it('should log errors from sync operations', () => {
        const fn = () => {
          throw new Error('Sync error');
        };

        ErrorHandler.wrap(fn, 'SyncContext');

        const logs = Logger.getLogs({ context: 'SyncContext' });
        expect(logs.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Assert Utility', () => {
    it('should not throw when condition is true', () => {
      expect(() => {
        assert(true, 'This should not throw');
      }).not.toThrow();
    });

    it('should throw AppError when condition is false', () => {
      expect(() => {
        assert(false, 'Assertion failed');
      }).toThrow(AppError);
    });

    it('should throw with correct message', () => {
      try {
        assert(false, 'Custom message');
        throw new Error('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).message).toBe('Custom message');
      }
    });

    it('should accept custom error class', () => {
      expect(() => {
        assert(false, 'Validation failed', ValidationError as any);
      }).toThrow(ValidationError);
    });
  });

  describe('isAppError Type Guard', () => {
    it('should return true for AppError instances', () => {
      const error = new AppError('Test');
      expect(isAppError(error)).toBe(true);
    });

    it('should return true for derived error classes', () => {
      const parseError = new ParseError('file', 'type', 'reason');
      expect(isAppError(parseError)).toBe(true);

      const dbError = new DatabaseError('op', 'details');
      expect(isAppError(dbError)).toBe(true);
    });

    it('should return false for standard errors', () => {
      const error = new Error('Standard error');
      expect(isAppError(error)).toBe(false);
    });

    it('should return false for non-error values', () => {
      expect(isAppError('string')).toBe(false);
      expect(isAppError(null)).toBe(false);
      expect(isAppError(undefined)).toBe(false);
      expect(isAppError({})).toBe(false);
    });
  });

  describe('Error Recovery Patterns', () => {
    it('should indicate recoverable errors', () => {
      const recoverableErrors = [
        new ValidationError('field', 'val', 'constraint'),
        new NetworkError('url'),
        new ParseError('file', 'type', 'reason'),
        new DatabaseError('op', 'details'),
        new NotFoundError('resource', 'id'),
      ];

      recoverableErrors.forEach(error => {
        expect(error.context.recoverable).toBe(true);
      });
    });

    it('should indicate non-recoverable errors', () => {
      const nonRecoverableErrors = [
        new PermissionError('action', 'resource'),
        new ConfigurationError('setting', 'issue'),
        new MemoryError('op', 950, 1024),
      ];

      nonRecoverableErrors.forEach(error => {
        expect(error.context.recoverable).toBe(false);
      });
    });
  });

  describe('Error Severity Levels', () => {
    it('should assign correct severity levels', () => {
      expect(new ValidationError('f', 'v', 'c').context.severity).toBe('low');
      expect(new NotFoundError('r', 'i').context.severity).toBe('low');

      expect(new ParseError('f', 't', 'r').context.severity).toBe('medium');
      expect(new NetworkError('u').context.severity).toBe('medium');
      expect(new PermissionError('a', 'r').context.severity).toBe('medium');

      expect(new DatabaseError('o', 'd').context.severity).toBe('high');

      expect(new ConfigurationError('s', 'i').context.severity).toBe('critical');
      expect(new MemoryError('o', 1, 2).context.severity).toBe('critical');
    });
  });
});
