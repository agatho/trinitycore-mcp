/**
 * Logger Service Tests
 *
 * Unit tests for centralized logging system
 */

import { describe, expect, it, beforeEach, vi, afterEach } from 'vitest';
import { Logger, LogLevel, type LogEntry, type LoggerConfig } from '@/lib/logger';

describe('Logger Service', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    // Reset logger singleton
    Logger.reset();
    // Reset logger config to defaults
    Logger.configure({
      minLevel: LogLevel.DEBUG,
      enableConsole: false, // Disable console during tests
      persistLogs: true,
      maxStoredLogs: 1000,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Configuration', () => {
    it('should accept custom configuration', () => {
      const config: Partial<LoggerConfig> = {
        minLevel: LogLevel.WARN,
        enableConsole: false,
        maxStoredLogs: 500,
      };

      Logger.configure(config);

      // Log a DEBUG message (should be filtered)
      Logger.debug('Test', 'Debug message');

      // Log a WARN message (should be logged)
      Logger.warn('Test', 'Warning message');

      const logs = Logger.getLogs();
      expect(logs.length).toBe(1);
      expect(logs[0].level).toBe(LogLevel.WARN);
    });

    it('should disable console output when configured', () => {
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      Logger.configure({ enableConsole: false });
      Logger.info('Test', 'Info message');

      expect(consoleLogSpy).not.toHaveBeenCalled();
      consoleLogSpy.mockRestore();
    });

    it('should enable console output when configured', () => {
      const consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

      Logger.configure({ enableConsole: true });
      Logger.info('Test', 'Info message');

      expect(consoleInfoSpy).toHaveBeenCalled();
      consoleInfoSpy.mockRestore();
    });
  });

  describe('Log Levels', () => {
    it('should log DEBUG level messages', () => {
      Logger.debug('TestContext', 'Debug message', { foo: 'bar' });

      const logs = Logger.getLogs();
      expect(logs.length).toBe(1);
      expect(logs[0].level).toBe(LogLevel.DEBUG);
      expect(logs[0].context).toBe('TestContext');
      expect(logs[0].message).toBe('Debug message');
      expect(logs[0].metadata).toEqual({ foo: 'bar' });
    });

    it('should log INFO level messages', () => {
      Logger.info('TestContext', 'Info message');

      const logs = Logger.getLogs();
      expect(logs.length).toBe(1);
      expect(logs[0].level).toBe(LogLevel.INFO);
      expect(logs[0].message).toBe('Info message');
    });

    it('should log WARN level messages', () => {
      Logger.warn('TestContext', 'Warning message');

      const logs = Logger.getLogs();
      expect(logs.length).toBe(1);
      expect(logs[0].level).toBe(LogLevel.WARN);
      expect(logs[0].message).toBe('Warning message');
    });

    it('should log ERROR level messages with Error object', () => {
      const error = new Error('Test error');
      Logger.error('TestContext', error, { userId: 123 });

      const logs = Logger.getLogs();
      expect(logs.length).toBe(1);
      expect(logs[0].level).toBe(LogLevel.ERROR);
      expect(logs[0].error).toBe(error);
      expect(logs[0].stack).toBeDefined();
      expect(logs[0].metadata).toEqual({ userId: 123 });
    });

    it('should log ERROR level messages with string', () => {
      Logger.error('TestContext', 'Error message string');

      const logs = Logger.getLogs();
      expect(logs.length).toBe(1);
      expect(logs[0].level).toBe(LogLevel.ERROR);
      expect(logs[0].message).toBe('Error message string');
    });

    it('should log FATAL level messages', () => {
      const fatalError = new Error('Fatal error');
      Logger.fatal('TestContext', fatalError);

      const logs = Logger.getLogs();
      expect(logs.length).toBe(1);
      expect(logs[0].level).toBe(LogLevel.FATAL);
      expect(logs[0].error).toBe(fatalError);
    });
  });

  describe('Log Filtering', () => {
    it('should filter logs by minimum level', () => {
      Logger.configure({ minLevel: LogLevel.WARN });

      Logger.debug('Test', 'Debug');
      Logger.info('Test', 'Info');
      Logger.warn('Test', 'Warning');
      Logger.error('Test', 'Error');

      const logs = Logger.getLogs();
      expect(logs.length).toBe(2); // Only WARN and ERROR
      expect(logs[0].level).toBe(LogLevel.WARN);
      expect(logs[1].level).toBe(LogLevel.ERROR);
    });

    it('should retrieve logs by level filter', () => {
      Logger.debug('Test', 'Debug');
      Logger.info('Test', 'Info');
      Logger.warn('Test', 'Warning');

      const warnLogs = Logger.getLogs({ level: LogLevel.WARN });
      expect(warnLogs.length).toBe(1);
      expect(warnLogs[0].level).toBe(LogLevel.WARN);
    });

    it('should retrieve logs by context filter', () => {
      Logger.info('Context1', 'Message 1');
      Logger.info('Context2', 'Message 2');
      Logger.info('Context1', 'Message 3');

      const context1Logs = Logger.getLogs({ context: 'Context1' });
      expect(context1Logs.length).toBe(2);
      expect(context1Logs.every(log => log.context === 'Context1')).toBe(true);
    });

    it('should retrieve logs since timestamp', () => {
      const now = Date.now();
      Logger.info('Test', 'Old message');

      // Wait a bit
      const futureTimestamp = now + 100;

      Logger.info('Test', 'New message');

      const recentLogs = Logger.getLogs({ since: futureTimestamp });
      expect(recentLogs.length).toBeLessThanOrEqual(1);
    });

    it('should limit number of returned logs', () => {
      for (let i = 0; i < 10; i++) {
        Logger.info('Test', `Message ${i}`);
      }

      const limitedLogs = Logger.getLogs({ limit: 5 });
      expect(limitedLogs.length).toBe(5);
    });
  });

  describe('Log Persistence', () => {
    it('should persist ERROR logs to localStorage', () => {
      Logger.configure({ persistLogs: true });
      Logger.error('Test', 'Error message');

      const stored = localStorage.getItem('trinitycore-logs');
      expect(stored).toBeDefined();

      const logs = JSON.parse(stored!);
      expect(logs.length).toBe(1);
      expect(logs[0].level).toBe(LogLevel.ERROR);
    });

    it('should persist FATAL logs to localStorage', () => {
      Logger.configure({ persistLogs: true });
      Logger.fatal('Test', 'Fatal error');

      const stored = localStorage.getItem('trinitycore-logs');
      expect(stored).toBeDefined();

      const logs = JSON.parse(stored!);
      expect(logs.length).toBe(1);
      expect(logs[0].level).toBe(LogLevel.FATAL);
    });

    it('should not persist DEBUG/INFO/WARN logs to localStorage', () => {
      Logger.configure({ persistLogs: true });
      Logger.debug('Test', 'Debug');
      Logger.info('Test', 'Info');
      Logger.warn('Test', 'Warning');

      const stored = localStorage.getItem('trinitycore-logs');
      expect(stored).toBeNull();
    });

    it('should respect maxStoredLogs limit', () => {
      Logger.configure({ persistLogs: true, maxStoredLogs: 3 });

      for (let i = 0; i < 5; i++) {
        Logger.error('Test', `Error ${i}`);
      }

      const stored = localStorage.getItem('trinitycore-logs');
      const logs = JSON.parse(stored!);
      expect(logs.length).toBe(3);
    });

    it('should not persist when disabled', () => {
      Logger.configure({ persistLogs: false });
      Logger.error('Test', 'Error message');

      const stored = localStorage.getItem('trinitycore-logs');
      expect(stored).toBeNull();
    });
  });

  describe('Log Subscription', () => {
    it('should notify subscribers when logs are added', () => {
      const listener = vi.fn();
      const unsubscribe = Logger.subscribe(listener);

      Logger.info('Test', 'Info message');

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          level: LogLevel.INFO,
          message: 'Info message',
        })
      );

      unsubscribe();
    });

    it('should not notify unsubscribed listeners', () => {
      const listener = vi.fn();
      const unsubscribe = Logger.subscribe(listener);

      Logger.info('Test', 'Message 1');
      expect(listener).toHaveBeenCalledTimes(1);

      unsubscribe();

      Logger.info('Test', 'Message 2');
      expect(listener).toHaveBeenCalledTimes(1); // Still 1, not called again
    });

    it('should support multiple subscribers', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      Logger.subscribe(listener1);
      Logger.subscribe(listener2);

      Logger.info('Test', 'Message');

      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
    });
  });

  describe('Log Export', () => {
    it('should export logs as JSON string', () => {
      Logger.info('Test', 'Message 1');
      Logger.warn('Test', 'Message 2');

      const exported = Logger.exportLogs();
      expect(exported).toBeTruthy();

      const parsed = JSON.parse(exported);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed.length).toBe(2);
    });

    it('should export empty array when no logs', () => {
      const exported = Logger.exportLogs();
      const parsed = JSON.parse(exported);
      expect(parsed).toEqual([]);
    });
  });

  describe('Log Clearing', () => {
    it('should clear all logs', () => {
      Logger.info('Test', 'Message 1');
      Logger.info('Test', 'Message 2');

      expect(Logger.getLogs().length).toBe(2);

      Logger.clear();

      expect(Logger.getLogs().length).toBe(0);
    });

    it('should clear localStorage when clearing logs', () => {
      Logger.error('Test', 'Error');
      expect(localStorage.getItem('trinitycore-logs')).toBeDefined();

      Logger.clear();

      expect(localStorage.getItem('trinitycore-logs')).toBeNull();
    });
  });

  describe('Statistics', () => {
    it('should return correct log statistics', () => {
      Logger.debug('Test', 'Debug');
      Logger.info('Test', 'Info 1');
      Logger.info('Test', 'Info 2');
      Logger.warn('Test', 'Warning');
      Logger.error('Test', 'Error');

      const stats = Logger.getStats();

      expect(stats.total).toBe(5);
      expect(stats.byLevel[LogLevel.DEBUG]).toBe(1);
      expect(stats.byLevel[LogLevel.INFO]).toBe(2);
      expect(stats.byLevel[LogLevel.WARN]).toBe(1);
      expect(stats.byLevel[LogLevel.ERROR]).toBe(1);
      expect(stats.byLevel[LogLevel.FATAL]).toBe(0);
    });

    it('should track unique contexts', () => {
      Logger.info('Context1', 'Message');
      Logger.info('Context2', 'Message');
      Logger.info('Context1', 'Message');

      const stats = Logger.getStats();

      expect(stats.contexts.length).toBe(2);
      expect(stats.contexts).toContain('Context1');
      expect(stats.contexts).toContain('Context2');
    });
  });

  describe('Error Reporting', () => {
    it('should call error report callback for ERROR logs', () => {
      const reportCallback = vi.fn();
      Logger.configure({ onError: reportCallback });

      const error = new Error('Test error');
      Logger.error('Test', error);

      expect(reportCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          level: LogLevel.ERROR,
          error,
        })
      );
    });

    it('should call error report callback for FATAL logs', () => {
      const reportCallback = vi.fn();
      Logger.configure({ onError: reportCallback });

      const error = new Error('Fatal error');
      Logger.fatal('Test', error);

      expect(reportCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          level: LogLevel.FATAL,
          error,
        })
      );
    });

    it('should not call error report callback for lower levels', () => {
      const reportCallback = vi.fn();
      Logger.configure({ onError: reportCallback });

      Logger.debug('Test', 'Debug');
      Logger.info('Test', 'Info');
      Logger.warn('Test', 'Warning');

      expect(reportCallback).not.toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle undefined metadata gracefully', () => {
      Logger.info('Test', 'Message', undefined);

      const logs = Logger.getLogs();
      expect(logs[0].metadata).toBeUndefined();
    });

    it('should handle null values in metadata', () => {
      const metadata = { value: null };
      Logger.info('Test', 'Message', metadata);

      const logs = Logger.getLogs();
      expect(logs[0].metadata).toBeDefined();
      expect(logs[0].metadata.value).toBeNull();
    });

    it('should handle circular references in metadata', () => {
      const circular: any = { name: 'test' };
      circular.self = circular;

      // Should not throw
      expect(() => {
        Logger.info('Test', 'Message', circular);
      }).not.toThrow();
    });

    it('should handle very long messages', () => {
      const longMessage = 'x'.repeat(10000);
      Logger.debug('Test', longMessage);

      const logs = Logger.getLogs();
      expect(logs.length).toBe(1);
      expect(logs[0].message).toBe(longMessage);
    });
  });
});
