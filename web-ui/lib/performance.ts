/**
 * Performance Optimization Utilities
 *
 * Debounce, throttle, memoization, lazy loading, and other performance helpers.
 *
 * @module performance
 */

import { Logger } from './logger';

// ============================================================================
// Debounce & Throttle
// ============================================================================

/**
 * Debounce function - delays execution until after wait time has elapsed
 * since the last invocation
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return function (this: any, ...args: Parameters<T>) {
    const context = this;

    if (timeout) {
      clearTimeout(timeout);
    }

    timeout = setTimeout(() => {
      func.apply(context, args);
    }, wait);
  };
}

/**
 * Throttle function - ensures function is called at most once per wait period
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean = false;

  return function (this: any, ...args: Parameters<T>) {
    const context = this;

    if (!inThrottle) {
      func.apply(context, args);
      inThrottle = true;

      setTimeout(() => {
        inThrottle = false;
      }, wait);
    }
  };
}

// ============================================================================
// Memoization
// ============================================================================

/**
 * Simple memoization cache
 */
export class MemoCache<K, V> {
  private cache: Map<string, { value: V; timestamp: number }> = new Map();
  private maxSize: number;
  private ttl: number;

  constructor(maxSize: number = 100, ttl: number = 5 * 60 * 1000) {
    this.maxSize = maxSize;
    this.ttl = ttl;
  }

  get(key: K): V | undefined {
    const cacheKey = this.serializeKey(key);
    const cached = this.cache.get(cacheKey);

    if (!cached) return undefined;

    // Check if expired
    if (Date.now() - cached.timestamp > this.ttl) {
      this.cache.delete(cacheKey);
      return undefined;
    }

    return cached.value;
  }

  set(key: K, value: V): void {
    const cacheKey = this.serializeKey(key);

    // Evict oldest entry if cache is full
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    this.cache.set(cacheKey, {
      value,
      timestamp: Date.now(),
    });
  }

  clear(): void {
    this.cache.clear();
  }

  private serializeKey(key: K): string {
    return JSON.stringify(key);
  }
}

/**
 * Memoize function results
 */
export function memoize<T extends (...args: any[]) => any>(
  func: T,
  options: { maxSize?: number; ttl?: number } = {}
): T {
  const cache = new MemoCache(options.maxSize, options.ttl);

  return function (this: any, ...args: Parameters<T>): ReturnType<T> {
    const cached = cache.get(args);
    if (cached !== undefined) {
      return cached;
    }

    const result = func.apply(this, args);
    cache.set(args, result);
    return result;
  } as T;
}

// ============================================================================
// Batching
// ============================================================================

/**
 * Batch multiple operations into a single execution
 */
export class BatchProcessor<T> {
  private queue: T[] = [];
  private timeout: NodeJS.Timeout | null = null;
  private processor: (items: T[]) => void | Promise<void>;
  private wait: number;
  private maxSize: number;

  constructor(
    processor: (items: T[]) => void | Promise<void>,
    options: { wait?: number; maxSize?: number } = {}
  ) {
    this.processor = processor;
    this.wait = options.wait ?? 100;
    this.maxSize = options.maxSize ?? 100;
  }

  add(item: T): void {
    this.queue.push(item);

    if (this.queue.length >= this.maxSize) {
      this.flush();
    } else {
      this.scheduleFlush();
    }
  }

  private scheduleFlush(): void {
    if (this.timeout) {
      clearTimeout(this.timeout);
    }

    this.timeout = setTimeout(() => {
      this.flush();
    }, this.wait);
  }

  flush(): void {
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }

    if (this.queue.length === 0) return;

    const items = [...this.queue];
    this.queue = [];

    try {
      const result = this.processor(items);
      if (result instanceof Promise) {
        result.catch(error => {
          Logger.error('BatchProcessor', error, { itemCount: items.length });
        });
      }
    } catch (error) {
      Logger.error('BatchProcessor', error as Error, { itemCount: items.length });
    }
  }
}

// ============================================================================
// Lazy Loading
// ============================================================================

/**
 * Lazy value - compute value only when first accessed
 */
export class Lazy<T> {
  private value: T | undefined = undefined;
  private computed: boolean = false;
  private factory: () => T;

  constructor(factory: () => T) {
    this.factory = factory;
  }

  get(): T {
    if (!this.computed) {
      this.value = this.factory();
      this.computed = true;
    }
    return this.value!;
  }

  reset(): void {
    this.value = undefined;
    this.computed = false;
  }
}

// ============================================================================
// Request Deduplication
// ============================================================================

/**
 * Deduplicate concurrent requests with same key
 */
export class RequestDeduplicator<K, V> {
  private pending: Map<string, Promise<V>> = new Map();

  async dedupe(key: K, fetcher: () => Promise<V>): Promise<V> {
    const cacheKey = JSON.stringify(key);
    const existing = this.pending.get(cacheKey);

    if (existing) {
      return existing;
    }

    const promise = fetcher()
      .then(result => {
        this.pending.delete(cacheKey);
        return result;
      })
      .catch(error => {
        this.pending.delete(cacheKey);
        throw error;
      });

    this.pending.set(cacheKey, promise);
    return promise;
  }
}

// ============================================================================
// Virtual Scrolling Helpers
// ============================================================================

/**
 * Calculate visible items for virtual scrolling
 */
export function calculateVisibleRange(
  scrollTop: number,
  containerHeight: number,
  itemHeight: number,
  totalItems: number,
  overscan: number = 3
): { start: number; end: number } {
  const visibleStart = Math.floor(scrollTop / itemHeight);
  const visibleEnd = Math.ceil((scrollTop + containerHeight) / itemHeight);

  const start = Math.max(0, visibleStart - overscan);
  const end = Math.min(totalItems, visibleEnd + overscan);

  return { start, end };
}

// ============================================================================
// Worker Pool
// ============================================================================

/**
 * Simple worker pool for CPU-intensive tasks
 */
export class WorkerPool {
  private workers: Worker[] = [];
  private taskQueue: Array<{
    task: any;
    resolve: (value: any) => void;
    reject: (error: any) => void;
  }> = [];
  private busyWorkers: Set<Worker> = new Set();

  constructor(workerScript: string, poolSize: number = 4) {
    for (let i = 0; i < poolSize; i++) {
      const worker = new Worker(workerScript);
      worker.onmessage = (e) => this.handleWorkerMessage(worker, e);
      worker.onerror = (e) => this.handleWorkerError(worker, e);
      this.workers.push(worker);
    }
  }

  async execute<T>(task: any): Promise<T> {
    return new Promise((resolve, reject) => {
      this.taskQueue.push({ task, resolve, reject });
      this.processQueue();
    });
  }

  private processQueue(): void {
    if (this.taskQueue.length === 0) return;

    const availableWorker = this.workers.find(w => !this.busyWorkers.has(w));
    if (!availableWorker) return;

    const { task, resolve, reject } = this.taskQueue.shift()!;
    this.busyWorkers.add(availableWorker);

    (availableWorker as any)._currentResolve = resolve;
    (availableWorker as any)._currentReject = reject;

    availableWorker.postMessage(task);
  }

  private handleWorkerMessage(worker: Worker, event: MessageEvent): void {
    this.busyWorkers.delete(worker);

    const resolve = (worker as any)._currentResolve;
    if (resolve) {
      resolve(event.data);
      delete (worker as any)._currentResolve;
      delete (worker as any)._currentReject;
    }

    this.processQueue();
  }

  private handleWorkerError(worker: Worker, error: ErrorEvent): void {
    this.busyWorkers.delete(worker);

    const reject = (worker as any)._currentReject;
    if (reject) {
      reject(error);
      delete (worker as any)._currentResolve;
      delete (worker as any)._currentReject;
    }

    this.processQueue();
  }

  terminate(): void {
    this.workers.forEach(w => w.terminate());
    this.workers = [];
    this.busyWorkers.clear();
    this.taskQueue = [];
  }
}

// ============================================================================
// Performance Measurement
// ============================================================================

/**
 * Measure function execution time
 */
export async function measurePerformance<T>(
  name: string,
  fn: () => T | Promise<T>
): Promise<T> {
  const start = performance.now();
  try {
    const result = await fn();
    const duration = performance.now() - start;
    Logger.debug('Performance', `${name} completed`, { duration: `${duration.toFixed(2)}ms` });
    return result;
  } catch (error) {
    const duration = performance.now() - start;
    Logger.error('Performance', error as Error, {
      operation: name,
      duration: `${duration.toFixed(2)}ms`,
    });
    throw error;
  }
}

/**
 * Performance marker for Chrome DevTools
 */
export function mark(name: string): void {
  if (typeof performance !== 'undefined' && performance.mark) {
    performance.mark(name);
  }
}

/**
 * Measure between two marks
 */
export function measure(name: string, startMark: string, endMark: string): void {
  if (typeof performance !== 'undefined' && performance.measure) {
    performance.measure(name, startMark, endMark);
  }
}

// ============================================================================
// Image Optimization
// ============================================================================

/**
 * Lazy load images with IntersectionObserver
 */
export function setupLazyImages(selector: string = 'img[data-src]'): () => void {
  if (typeof IntersectionObserver === 'undefined') {
    return () => {};
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target as HTMLImageElement;
        const src = img.dataset.src;
        if (src) {
          img.src = src;
          img.removeAttribute('data-src');
          observer.unobserve(img);
        }
      }
    });
  });

  document.querySelectorAll(selector).forEach(img => observer.observe(img));

  return () => observer.disconnect();
}

// ============================================================================
// Bundle Size Optimization
// ============================================================================

/**
 * Dynamic import with error handling
 */
export async function dynamicImport<T>(
  importFn: () => Promise<T>,
  fallback?: T
): Promise<T> {
  try {
    return await importFn();
  } catch (error) {
    Logger.error('DynamicImport', error as Error);
    if (fallback !== undefined) {
      return fallback;
    }
    throw error;
  }
}
