/**
 * Performance Utilities Tests
 *
 * Tests for debouncing, throttling, memoization, and other
 * performance optimization utilities.
 */

import {
  debounce,
  throttle,
  deepEqual,
  shallowEqualArrays,
  MemoCache,
  scriptsEqual,
  getScriptHash,
  processBatch,
  PerformanceTimer,
} from '@/lib/sai-unified/performance';
import type { SAIScript } from '@/lib/sai-unified/types';

describe('Performance Utilities', () => {
  describe('debounce', () => {
    jest.useFakeTimers();

    test('delays function execution', () => {
      const fn = jest.fn();
      const debounced = debounce(fn, 100);

      debounced();
      expect(fn).not.toHaveBeenCalled();

      jest.advanceTimersByTime(100);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    test('cancels previous calls', () => {
      const fn = jest.fn();
      const debounced = debounce(fn, 100);

      debounced();
      debounced();
      debounced();

      jest.advanceTimersByTime(100);
      expect(fn).toHaveBeenCalledTimes(1); // Only last call
    });

    test('passes arguments correctly', () => {
      const fn = jest.fn();
      const debounced = debounce(fn, 100);

      debounced('a', 'b', 'c');
      jest.advanceTimersByTime(100);

      expect(fn).toHaveBeenCalledWith('a', 'b', 'c');
    });

    afterEach(() => {
      jest.clearAllTimers();
    });
  });

  describe('throttle', () => {
    jest.useFakeTimers();

    test('limits execution frequency', () => {
      const fn = jest.fn();
      const throttled = throttle(fn, 100);

      throttled();
      throttled();
      throttled();

      expect(fn).toHaveBeenCalledTimes(1); // Only first call

      jest.advanceTimersByTime(100);
      throttled();

      expect(fn).toHaveBeenCalledTimes(2);
    });

    test('executes immediately on first call', () => {
      const fn = jest.fn();
      const throttled = throttle(fn, 100);

      throttled();
      expect(fn).toHaveBeenCalledTimes(1);
    });

    afterEach(() => {
      jest.clearAllTimers();
    });
  });

  describe('deepEqual', () => {
    test('compares primitives', () => {
      expect(deepEqual(1, 1)).toBe(true);
      expect(deepEqual('a', 'a')).toBe(true);
      expect(deepEqual(true, true)).toBe(true);

      expect(deepEqual(1, 2)).toBe(false);
      expect(deepEqual('a', 'b')).toBe(false);
      expect(deepEqual(true, false)).toBe(false);
    });

    test('compares objects', () => {
      expect(deepEqual({ a: 1 }, { a: 1 })).toBe(true);
      expect(deepEqual({ a: 1, b: 2 }, { a: 1, b: 2 })).toBe(true);

      expect(deepEqual({ a: 1 }, { a: 2 })).toBe(false);
      expect(deepEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
    });

    test('compares nested objects', () => {
      const obj1 = { a: { b: { c: 1 } } };
      const obj2 = { a: { b: { c: 1 } } };
      const obj3 = { a: { b: { c: 2 } } };

      expect(deepEqual(obj1, obj2)).toBe(true);
      expect(deepEqual(obj1, obj3)).toBe(false);
    });

    test('compares arrays', () => {
      expect(deepEqual([1, 2, 3], [1, 2, 3])).toBe(true);
      expect(deepEqual([1, 2, 3], [1, 2, 4])).toBe(false);
    });

    test('handles null and undefined', () => {
      expect(deepEqual(null, null)).toBe(true);
      expect(deepEqual(undefined, undefined)).toBe(true);
      expect(deepEqual(null, undefined)).toBe(false);
    });
  });

  describe('shallowEqualArrays', () => {
    test('compares arrays shallowly', () => {
      expect(shallowEqualArrays([1, 2, 3], [1, 2, 3])).toBe(true);
      expect(shallowEqualArrays(['a', 'b'], ['a', 'b'])).toBe(true);

      expect(shallowEqualArrays([1, 2], [1, 3])).toBe(false);
      expect(shallowEqualArrays([1, 2], [1, 2, 3])).toBe(false);
    });

    test('handles empty arrays', () => {
      expect(shallowEqualArrays([], [])).toBe(true);
      expect(shallowEqualArrays([], [1])).toBe(false);
    });
  });

  describe('MemoCache', () => {
    test('caches values', () => {
      const cache = new MemoCache<string, number>();

      cache.set('key1', 100);
      expect(cache.get('key1')).toBe(100);
    });

    test('returns undefined for missing keys', () => {
      const cache = new MemoCache<string, number>();

      expect(cache.get('nonexistent')).toBeUndefined();
    });

    test('respects TTL', () => {
      jest.useFakeTimers();
      const cache = new MemoCache<string, number>(10, 1000); // 1 second TTL

      cache.set('key1', 100);
      expect(cache.get('key1')).toBe(100);

      jest.advanceTimersByTime(1001);
      expect(cache.get('key1')).toBeUndefined(); // Expired

      jest.useRealTimers();
    });

    test('respects max size', () => {
      const cache = new MemoCache<string, number>(2); // Max 2 items

      cache.set('key1', 100);
      cache.set('key2', 200);
      cache.set('key3', 300); // Should evict key1

      expect(cache.get('key1')).toBeUndefined();
      expect(cache.get('key2')).toBe(200);
      expect(cache.get('key3')).toBe(300);
    });

    test('clears cache', () => {
      const cache = new MemoCache<string, number>();

      cache.set('key1', 100);
      cache.set('key2', 200);

      cache.clear();

      expect(cache.get('key1')).toBeUndefined();
      expect(cache.get('key2')).toBeUndefined();
      expect(cache.size()).toBe(0);
    });

    test('tracks size', () => {
      const cache = new MemoCache<string, number>();

      expect(cache.size()).toBe(0);

      cache.set('key1', 100);
      expect(cache.size()).toBe(1);

      cache.set('key2', 200);
      expect(cache.size()).toBe(2);

      cache.clear();
      expect(cache.size()).toBe(0);
    });
  });

  describe('scriptsEqual', () => {
    const createScript = (nodeIds: string[], connIds: string[]): SAIScript => ({
      id: 'test',
      name: 'Test',
      entryOrGuid: 0,
      sourceType: 0,
      nodes: nodeIds.map((id) => ({
        id,
        type: 'event',
        typeId: 0,
        label: 'Event',
        typeName: 'SMART_EVENT_UPDATE_IC',
        parameters: [],
      })),
      connections: connIds.map((id) => ({
        id,
        source: nodeIds[0],
        target: nodeIds[1] || nodeIds[0],
        type: 'event-action',
      })),
      metadata: {
        version: '3.0.0',
        createdAt: Date.now(),
        modifiedAt: Date.now(),
      },
    });

    test('compares scripts by structure', () => {
      const script1 = createScript(['node1', 'node2'], ['conn1']);
      const script2 = createScript(['node1', 'node2'], ['conn1']);

      expect(scriptsEqual(script1, script2)).toBe(true);
    });

    test('detects different node counts', () => {
      const script1 = createScript(['node1', 'node2'], ['conn1']);
      const script2 = createScript(['node1'], ['conn1']);

      expect(scriptsEqual(script1, script2)).toBe(false);
    });

    test('detects different connection counts', () => {
      const script1 = createScript(['node1', 'node2'], ['conn1']);
      const script2 = createScript(['node1', 'node2'], ['conn1', 'conn2']);

      expect(scriptsEqual(script1, script2)).toBe(false);
    });
  });

  describe('getScriptHash', () => {
    const createScript = (nodeIds: string[], connIds: string[]): SAIScript => ({
      id: 'test',
      name: 'Test',
      entryOrGuid: 0,
      sourceType: 0,
      nodes: nodeIds.map((id) => ({
        id,
        type: 'event',
        typeId: 0,
        label: 'Event',
        typeName: 'SMART_EVENT_UPDATE_IC',
        parameters: [],
      })),
      connections: connIds.map((id) => ({
        id,
        source: nodeIds[0],
        target: nodeIds[1] || nodeIds[0],
        type: 'event-action',
      })),
      metadata: {
        version: '3.0.0',
        createdAt: Date.now(),
        modifiedAt: Date.now(),
      },
    });

    test('generates consistent hashes', () => {
      const script = createScript(['node1', 'node2'], ['conn1']);
      const hash1 = getScriptHash(script);
      const hash2 = getScriptHash(script);

      expect(hash1).toBe(hash2);
    });

    test('generates different hashes for different scripts', () => {
      const script1 = createScript(['node1', 'node2'], ['conn1']);
      const script2 = createScript(['node3', 'node4'], ['conn2']);

      const hash1 = getScriptHash(script1);
      const hash2 = getScriptHash(script2);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('processBatch', () => {
    test('processes items in batches', async () => {
      const items = [1, 2, 3, 4, 5];
      const processor = jest.fn((item) => Promise.resolve(item * 2));

      const results = await processBatch(items, processor, 2, 0);

      expect(results).toEqual([2, 4, 6, 8, 10]);
      expect(processor).toHaveBeenCalledTimes(5);
    });

    test('handles empty array', async () => {
      const processor = jest.fn();

      const results = await processBatch([], processor, 2, 0);

      expect(results).toEqual([]);
      expect(processor).not.toHaveBeenCalled();
    });

    test('handles batch size larger than array', async () => {
      const items = [1, 2, 3];
      const processor = jest.fn((item) => Promise.resolve(item * 2));

      const results = await processBatch(items, processor, 10, 0);

      expect(results).toEqual([2, 4, 6]);
    });
  });

  describe('PerformanceTimer', () => {
    test('measures elapsed time', () => {
      const timer = new PerformanceTimer();

      timer.start();
      // Simulate some work
      const start = performance.now();
      while (performance.now() - start < 10) {
        // Wait 10ms
      }

      const elapsed = timer.getElapsed();

      expect(elapsed).toBeGreaterThanOrEqual(10);
    });

    test('records marks', () => {
      const timer = new PerformanceTimer();

      timer.start();
      timer.mark('checkpoint1');
      timer.mark('checkpoint2');

      expect(timer.getMark('checkpoint1')).toBeDefined();
      expect(timer.getMark('checkpoint2')).toBeDefined();
    });

    test('gets all marks', () => {
      const timer = new PerformanceTimer();

      timer.start();
      timer.mark('mark1');
      timer.mark('mark2');

      const marks = timer.getAllMarks();

      expect(marks).toHaveProperty('mark1');
      expect(marks).toHaveProperty('mark2');
    });

    test('logs performance data', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const timer = new PerformanceTimer();
      timer.start();
      timer.mark('test');
      timer.log('[Test]');

      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });
});
