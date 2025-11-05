/**
 * Advanced Search and Filtering Utilities
 * Supports fuzzy search, multi-criteria filtering, and autocomplete
 */

import Fuse, { IFuseOptions } from 'fuse.js';

export interface SearchOptions<T> {
  keys: string[];
  threshold?: number;
  includeScore?: boolean;
  minMatchCharLength?: number;
}

export interface FilterCriteria {
  field: string;
  operator: 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'gt' | 'lt' | 'gte' | 'lte' | 'between' | 'in';
  value: any;
  value2?: any; // For 'between' operator
}

export interface SearchResult<T> {
  item: T;
  score?: number;
  matches?: readonly any[];
}

/**
 * Fuzzy search using Fuse.js
 */
export function fuzzySearch<T>(
  items: T[],
  query: string,
  options: SearchOptions<T>
): SearchResult<T>[] {
  const fuseOptions: IFuseOptions<T> = {
    keys: options.keys,
    threshold: options.threshold ?? 0.4,
    includeScore: options.includeScore ?? true,
    minMatchCharLength: options.minMatchCharLength ?? 2,
    includeMatches: true,
  };

  const fuse = new Fuse(items, fuseOptions);
  const results = fuse.search(query);

  return results.map(result => ({
    item: result.item,
    score: result.score,
    matches: result.matches,
  }));
}

/**
 * Apply multiple filter criteria to data
 */
export function applyFilters<T>(items: T[], filters: FilterCriteria[]): T[] {
  return items.filter(item => {
    return filters.every(filter => matchesFilter(item, filter));
  });
}

/**
 * Check if an item matches a filter criterion
 */
function matchesFilter<T>(item: T, filter: FilterCriteria): boolean {
  const value = getNestedValue(item, filter.field);

  switch (filter.operator) {
    case 'equals':
      return value === filter.value;

    case 'contains':
      return String(value).toLowerCase().includes(String(filter.value).toLowerCase());

    case 'startsWith':
      return String(value).toLowerCase().startsWith(String(filter.value).toLowerCase());

    case 'endsWith':
      return String(value).toLowerCase().endsWith(String(filter.value).toLowerCase());

    case 'gt':
      return Number(value) > Number(filter.value);

    case 'lt':
      return Number(value) < Number(filter.value);

    case 'gte':
      return Number(value) >= Number(filter.value);

    case 'lte':
      return Number(value) <= Number(filter.value);

    case 'between':
      return Number(value) >= Number(filter.value) && Number(value) <= Number(filter.value2);

    case 'in':
      return Array.isArray(filter.value) && filter.value.includes(value);

    default:
      return true;
  }
}

/**
 * Get nested value from object using dot notation
 */
function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

/**
 * Generate autocomplete suggestions
 */
export function generateSuggestions<T>(
  items: T[],
  query: string,
  field: string,
  limit: number = 10
): string[] {
  if (!query) return [];

  const lowerQuery = query.toLowerCase();
  const suggestions = new Set<string>();

  for (const item of items) {
    const value = String(getNestedValue(item, field) || '');
    if (value.toLowerCase().includes(lowerQuery)) {
      suggestions.add(value);
      if (suggestions.size >= limit) break;
    }
  }

  return Array.from(suggestions);
}

/**
 * Highlight matching text in search results
 */
export function highlightMatches(text: string, query: string): string {
  if (!query) return text;

  const regex = new RegExp(`(${escapeRegExp(query)})`, 'gi');
  return text.replace(regex, '<mark>$1</mark>');
}

/**
 * Escape special regex characters
 */
function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Calculate Levenshtein distance for fuzzy matching
 */
export function levenshteinDistance(str1: string, str2: string): number {
  const len1 = str1.length;
  const len2 = str2.length;
  const matrix: number[][] = [];

  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[len1][len2];
}

/**
 * Sort results by relevance
 */
export function sortByRelevance<T>(
  results: SearchResult<T>[],
  query: string,
  primaryField: string
): SearchResult<T>[] {
  return results.sort((a, b) => {
    // First by score (if available)
    if (a.score !== undefined && b.score !== undefined) {
      if (a.score !== b.score) return a.score - b.score;
    }

    // Then by exact match
    const aValue = String(getNestedValue(a.item, primaryField) || '').toLowerCase();
    const bValue = String(getNestedValue(b.item, primaryField) || '').toLowerCase();
    const lowerQuery = query.toLowerCase();

    const aExact = aValue === lowerQuery;
    const bExact = bValue === lowerQuery;
    if (aExact && !bExact) return -1;
    if (!aExact && bExact) return 1;

    // Then by starts with
    const aStarts = aValue.startsWith(lowerQuery);
    const bStarts = bValue.startsWith(lowerQuery);
    if (aStarts && !bStarts) return -1;
    if (!aStarts && bStarts) return 1;

    // Finally by length (shorter is more relevant)
    return aValue.length - bValue.length;
  });
}

/**
 * Create search index for faster lookups
 */
export class SearchIndex<T> {
  private fuse: Fuse<T>;
  private items: T[];

  constructor(items: T[], options: SearchOptions<T>) {
    this.items = items;
    this.fuse = new Fuse(items, {
      keys: options.keys,
      threshold: options.threshold ?? 0.4,
      minMatchCharLength: options.minMatchCharLength ?? 2,
      includeScore: true,
      includeMatches: true,
    });
  }

  search(query: string): SearchResult<T>[] {
    const results = this.fuse.search(query);
    return results.map(result => ({
      item: result.item,
      score: result.score,
      matches: result.matches,
    }));
  }

  filter(filters: FilterCriteria[]): T[] {
    return applyFilters(this.items, filters);
  }

  searchAndFilter(query: string, filters: FilterCriteria[]): SearchResult<T>[] {
    let results = query ? this.search(query) : this.items.map(item => ({ item }));

    if (filters.length > 0) {
      const filteredItems = applyFilters(results.map(r => r.item), filters);
      results = results.filter(r => filteredItems.includes(r.item));
    }

    return results;
  }

  update(items: T[]): void {
    this.items = items;
    this.fuse.setCollection(items);
  }
}

/**
 * Save search preset to localStorage
 */
export function saveSearchPreset(name: string, filters: FilterCriteria[], query?: string): void {
  const presets = getSearchPresets();
  presets[name] = { filters, query, timestamp: Date.now() };
  localStorage.setItem('searchPresets', JSON.stringify(presets));
}

/**
 * Get saved search presets from localStorage
 */
export function getSearchPresets(): Record<string, { filters: FilterCriteria[]; query?: string; timestamp: number }> {
  const stored = localStorage.getItem('searchPresets');
  return stored ? JSON.parse(stored) : {};
}

/**
 * Delete search preset
 */
export function deleteSearchPreset(name: string): void {
  const presets = getSearchPresets();
  delete presets[name];
  localStorage.setItem('searchPresets', JSON.stringify(presets));
}
