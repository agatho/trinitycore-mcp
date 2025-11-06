/**
 * TrinityCore SAI Unified Editor - Performance Utilities
 *
 * Performance optimization utilities including debouncing, throttling,
 * memoization, and lazy loading helpers.
 *
 * @module sai-unified/performance
 * @version 3.0.0
 */

import React, { useEffect, useRef, useCallback, useMemo, useState } from 'react';
import type { SAIScript } from './types';

// ============================================================================
// DEBOUNCING & THROTTLING
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

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };

    if (timeout) {
      clearTimeout(timeout);
    }

    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle function - ensures function is called at most once per specified time period
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean = false;

  return function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  };
}

/**
 * React hook for debounced value
 * Updates only after the value has stopped changing for the specified delay
 */
export function useDebouncedValue<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = React.useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * React hook for debounced callback
 */
export function useDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): (...args: Parameters<T>) => void {
  const callbackRef = useRef(callback);

  // Update callback ref when callback changes
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // Create debounced function
  const debouncedCallback = useMemo(() => {
    return debounce((...args: Parameters<T>) => {
      callbackRef.current(...args);
    }, delay);
  }, [delay]);

  return debouncedCallback;
}

// ============================================================================
// MEMOIZATION
// ============================================================================

/**
 * Deep comparison for objects
 * Used in useMemo dependencies
 */
export function deepEqual(a: any, b: any): boolean {
  if (a === b) return true;

  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) {
    return false;
  }

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);

  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    if (!keysB.includes(key)) return false;
    if (!deepEqual(a[key], b[key])) return false;
  }

  return true;
}

/**
 * Shallow comparison for arrays
 */
export function shallowEqualArrays<T>(a: T[], b: T[]): boolean {
  if (a.length !== b.length) return false;

  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }

  return true;
}

/**
 * Memoization cache for expensive computations
 */
export class MemoCache<K, V> {
  private cache: Map<string, { value: V; timestamp: number }> = new Map();
  private maxSize: number;
  private ttl: number; // Time to live in milliseconds

  constructor(maxSize: number = 100, ttl: number = 60000) {
    this.maxSize = maxSize;
    this.ttl = ttl;
  }

  /**
   * Get value from cache
   */
  get(key: K): V | undefined {
    const keyStr = this.serializeKey(key);
    const cached = this.cache.get(keyStr);

    if (!cached) return undefined;

    // Check if expired
    if (Date.now() - cached.timestamp > this.ttl) {
      this.cache.delete(keyStr);
      return undefined;
    }

    return cached.value;
  }

  /**
   * Set value in cache
   */
  set(key: K, value: V): void {
    const keyStr = this.serializeKey(key);

    // Remove oldest entry if cache is full
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(keyStr, {
      value,
      timestamp: Date.now(),
    });
  }

  /**
   * Clear cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Serialize key for storage
   */
  private serializeKey(key: K): string {
    if (typeof key === 'string') return key;
    if (typeof key === 'number') return String(key);

    try {
      return JSON.stringify(key);
    } catch (e) {
      return String(key);
    }
  }
}

// ============================================================================
// SCRIPT OPTIMIZATION
// ============================================================================

/**
 * Check if two scripts are effectively equal (for memoization)
 * Only compares structure, not positions
 */
export function scriptsEqual(a: SAIScript, b: SAIScript): boolean {
  if (a.nodes.length !== b.nodes.length) return false;
  if (a.connections.length !== b.connections.length) return false;

  // Compare node IDs and types
  const aNodeIds = a.nodes.map(n => n.id).sort();
  const bNodeIds = b.nodes.map(n => n.id).sort();

  if (!shallowEqualArrays(aNodeIds, bNodeIds)) return false;

  // Compare connection IDs
  const aConnIds = a.connections.map(c => c.id).sort();
  const bConnIds = b.connections.map(c => c.id).sort();

  if (!shallowEqualArrays(aConnIds, bConnIds)) return false;

  return true;
}

/**
 * Get script hash for quick comparison
 */
export function getScriptHash(script: SAIScript): string {
  const nodeIds = script.nodes.map(n => n.id).sort().join(',');
  const connIds = script.connections.map(c => c.id).sort().join(',');

  return `${nodeIds}|${connIds}`;
}

// ============================================================================
// LAZY LOADING
// ============================================================================

/**
 * Lazy load component with loading fallback
 */
export function lazyWithPreload<T extends React.ComponentType<any>>(
  factory: () => Promise<{ default: T }>
) {
  const LazyComponent = React.lazy(factory);

  // Add preload function
  (LazyComponent as any).preload = factory;

  return LazyComponent;
}

/**
 * Intersection Observer hook for lazy rendering
 * Only renders children when element is in viewport
 */
export function useIntersectionObserver(
  ref: React.RefObject<HTMLElement>,
  options?: IntersectionObserverInit
): boolean {
  const [isIntersecting, setIsIntersecting] = React.useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(([entry]) => {
      setIsIntersecting(entry.isIntersecting);
    }, options);

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [ref, options]);

  return isIntersecting;
}

// ============================================================================
// BATCH PROCESSING
// ============================================================================

/**
 * Process items in batches to avoid blocking UI
 */
export async function processBatch<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  batchSize: number = 10,
  delayBetweenBatches: number = 10
): Promise<R[]> {
  const results: R[] = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(processor));
    results.push(...batchResults);

    // Delay between batches to give UI time to update
    if (i + batchSize < items.length) {
      await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
    }
  }

  return results;
}

/**
 * Request animation frame helper for smooth updates
 */
export function rafThrottle<T extends (...args: any[]) => any>(callback: T): T {
  let requestId: number | null = null;

  const throttled = (...args: Parameters<T>) => {
    if (requestId !== null) return;

    requestId = requestAnimationFrame(() => {
      callback(...args);
      requestId = null;
    });
  };

  return throttled as T;
}

// ============================================================================
// PERFORMANCE MONITORING
// ============================================================================

/**
 * Simple performance timer
 */
export class PerformanceTimer {
  private startTime: number = 0;
  private marks: Map<string, number> = new Map();

  start(): void {
    this.startTime = performance.now();
    this.marks.clear();
  }

  mark(name: string): void {
    this.marks.set(name, performance.now() - this.startTime);
  }

  getElapsed(): number {
    return performance.now() - this.startTime;
  }

  getMark(name: string): number | undefined {
    return this.marks.get(name);
  }

  getAllMarks(): Record<string, number> {
    const result: Record<string, number> = {};

    this.marks.forEach((time, name) => {
      result[name] = time;
    });

    return result;
  }

  log(prefix: string = '[Performance]'): void {
    console.log(`${prefix} Total: ${this.getElapsed().toFixed(2)}ms`);

    this.marks.forEach((time, name) => {
      console.log(`${prefix}   ${name}: ${time.toFixed(2)}ms`);
    });
  }
}

/**
 * Hook for measuring component render time
 */
export function useRenderTime(componentName: string, enabled: boolean = process.env.NODE_ENV === 'development'): void {
  const renderCount = useRef(0);
  const renderStart = useRef(0);

  if (!enabled) return;

  renderCount.current++;

  if (renderStart.current === 0) {
    renderStart.current = performance.now();
  }

  useEffect(() => {
    const renderTime = performance.now() - renderStart.current;

    console.log(`[Render] ${componentName} #${renderCount.current}: ${renderTime.toFixed(2)}ms`);

    renderStart.current = 0;
  });
}
