/**
 * React Hook for Comparison State Management
 * Manages comparison cart, batch queries, and comparison view state
 */

import { useState, useCallback, useEffect } from 'react';
import { ComparisonItem } from '@/lib/comparison';

const STORAGE_KEY = 'comparison-cart';
const MAX_ITEMS = 10;

export interface CompareState {
  items: ComparisonItem[];
  addItem: (item: ComparisonItem) => void;
  removeItem: (id: string | number) => void;
  clearItems: () => void;
  hasItem: (id: string | number) => boolean;
  itemCount: number;
  canAddMore: boolean;
}

/**
 * Hook for managing comparison state
 */
export function useCompare(type?: 'spell' | 'item' | 'creature'): CompareState {
  const [items, setItems] = useState<ComparisonItem[]>([]);

  // Load from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        const filtered = type ? parsed.filter((item: ComparisonItem) => item.type === type) : parsed;
        setItems(filtered);
      } catch (error) {
        console.error('Failed to load comparison items:', error);
      }
    }
  }, [type]);

  // Save to localStorage when items change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const addItem = useCallback((item: ComparisonItem) => {
    setItems(prev => {
      // Check if item already exists
      if (prev.some(i => i.id === item.id && i.type === item.type)) {
        return prev;
      }

      // Check max items limit
      if (prev.length >= MAX_ITEMS) {
        console.warn(`Maximum ${MAX_ITEMS} items allowed in comparison`);
        return prev;
      }

      // Filter by type if specified
      const newItem = { ...item, timestamp: Date.now() };
      if (type && item.type !== type) {
        console.warn(`Can only add ${type} items to this comparison`);
        return prev;
      }

      return [...prev, newItem];
    });
  }, [type]);

  const removeItem = useCallback((id: string | number) => {
    setItems(prev => prev.filter(item => item.id !== id));
  }, []);

  const clearItems = useCallback(() => {
    setItems([]);
  }, []);

  const hasItem = useCallback((id: string | number) => {
    return items.some(item => item.id === id);
  }, [items]);

  return {
    items,
    addItem,
    removeItem,
    clearItems,
    hasItem,
    itemCount: items.length,
    canAddMore: items.length < MAX_ITEMS,
  };
}

/**
 * Hook for batch query management
 */
export function useBatchQuery<T>(
  queryFn: (ids: Array<string | number>) => Promise<T[]>
) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const execute = useCallback(async (ids: Array<string | number>) => {
    if (ids.length === 0) {
      setData([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const results = await queryFn(ids);
      setData(results);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Batch query failed'));
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [queryFn]);

  const reset = useCallback(() => {
    setData([]);
    setError(null);
    setLoading(false);
  }, []);

  return {
    data,
    loading,
    error,
    execute,
    reset,
  };
}

/**
 * Hook for comparison view state
 */
export function useComparisonView() {
  const [viewMode, setViewMode] = useState<'side-by-side' | 'table' | 'diff'>('side-by-side');
  const [showOnlyDifferences, setShowOnlyDifferences] = useState(false);
  const [highlightDifferences, setHighlightDifferences] = useState(true);
  const [sortBy, setSortBy] = useState<'field' | 'difference'>('field');

  return {
    viewMode,
    setViewMode,
    showOnlyDifferences,
    setShowOnlyDifferences,
    highlightDifferences,
    setHighlightDifferences,
    sortBy,
    setSortBy,
  };
}
