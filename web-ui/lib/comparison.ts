/**
 * Comparison Utilities
 * Support for batch queries and side-by-side comparisons
 */

export interface ComparisonItem {
  id: string | number;
  type: 'spell' | 'item' | 'creature' | 'generic';
  data: any;
  timestamp: number;
}

export interface ComparisonDiff {
  field: string;
  values: any[];
  isDifferent: boolean;
}

/**
 * Compare multiple items and find differences
 */
export function compareItems(items: ComparisonItem[]): ComparisonDiff[] {
  if (items.length === 0) return [];

  // Get all unique fields from all items
  const allFields = new Set<string>();
  items.forEach(item => {
    Object.keys(item.data).forEach(key => allFields.add(key));
  });

  // Compare each field across all items
  const diffs: ComparisonDiff[] = [];

  allFields.forEach(field => {
    const values = items.map(item => item.data[field]);
    const isDifferent = !values.every(v => v === values[0]);

    diffs.push({
      field,
      values,
      isDifferent,
    });
  });

  return diffs;
}

/**
 * Calculate similarity percentage between two items
 */
export function calculateSimilarity(item1: any, item2: any): number {
  const fields = new Set([...Object.keys(item1), ...Object.keys(item2)]);
  let matches = 0;

  fields.forEach(field => {
    if (item1[field] === item2[field]) {
      matches++;
    }
  });

  return (matches / fields.size) * 100;
}

/**
 * Group items by similarity
 */
export function groupBySimilarity(items: any[], threshold: number = 80): any[][] {
  const groups: any[][] = [];
  const used = new Set<number>();

  items.forEach((item, index) => {
    if (used.has(index)) return;

    const group = [item];
    used.add(index);

    items.forEach((otherItem, otherIndex) => {
      if (otherIndex <= index || used.has(otherIndex)) return;

      const similarity = calculateSimilarity(item, otherItem);
      if (similarity >= threshold) {
        group.push(otherItem);
        used.add(otherIndex);
      }
    });

    groups.push(group);
  });

  return groups;
}

/**
 * Find common fields across items
 */
export function findCommonFields(items: any[]): Set<string> {
  if (items.length === 0) return new Set();

  const firstItemFields = new Set(Object.keys(items[0]));
  const commonFields = new Set<string>();

  firstItemFields.forEach(field => {
    const existsInAll = items.every(item => field in item);
    if (existsInAll) {
      commonFields.add(field);
    }
  });

  return commonFields;
}

/**
 * Find unique fields (fields that differ across items)
 */
export function findUniqueFields(items: any[]): Set<string> {
  const diffs = compareItems(items.map((data, index) => ({
    id: index,
    type: 'generic',
    data,
    timestamp: Date.now(),
  })));

  return new Set(diffs.filter(d => d.isDifferent).map(d => d.field));
}

/**
 * Get statistics about a field across items
 */
export function getFieldStats(items: any[], field: string): {
  min?: number;
  max?: number;
  avg?: number;
  median?: number;
  unique: Set<any>;
  nullCount: number;
} {
  const values = items.map(item => item[field]).filter(v => v !== null && v !== undefined);
  const unique = new Set(values);
  const nullCount = items.length - values.length;

  const numericValues = values.filter(v => typeof v === 'number');

  if (numericValues.length > 0) {
    const sorted = [...numericValues].sort((a, b) => a - b);
    return {
      min: Math.min(...numericValues),
      max: Math.max(...numericValues),
      avg: numericValues.reduce((sum, v) => sum + v, 0) / numericValues.length,
      median: sorted[Math.floor(sorted.length / 2)],
      unique,
      nullCount,
    };
  }

  return { unique, nullCount };
}

/**
 * Format comparison table for display
 */
export function formatComparisonTable(items: ComparisonItem[]): {
  headers: string[];
  rows: { field: string; values: any[]; isDifferent: boolean }[];
} {
  const diffs = compareItems(items);

  return {
    headers: ['Field', ...items.map((item, index) => `Item ${index + 1} (${item.id})`)],
    rows: diffs.map(diff => ({
      field: diff.field,
      values: diff.values,
      isDifferent: diff.isDifferent,
    })),
  };
}

/**
 * Export comparison to various formats
 */
export function exportComparison(items: ComparisonItem[], format: 'csv' | 'json' | 'markdown'): string {
  const table = formatComparisonTable(items);

  switch (format) {
    case 'csv':
      return [
        table.headers.join(','),
        ...table.rows.map(row => [row.field, ...row.values].join(',')),
      ].join('\n');

    case 'json':
      return JSON.stringify({ items, comparison: table.rows }, null, 2);

    case 'markdown':
      return [
        `| ${table.headers.join(' | ')} |`,
        `| ${table.headers.map(() => '---').join(' | ')} |`,
        ...table.rows.map(row => {
          const marker = row.isDifferent ? '⚠️' : '';
          return `| ${marker} ${row.field} | ${row.values.join(' | ')} |`;
        }),
      ].join('\n');

    default:
      return '';
  }
}

/**
 * Highlight differences in comparison view
 */
export function highlightDifferences(items: ComparisonItem[]): Map<string, number[]> {
  const diffs = compareItems(items);
  const highlighted = new Map<string, number[]>();

  diffs.forEach(diff => {
    if (diff.isDifferent) {
      // Find which items have different values
      const indices: number[] = [];
      const firstValue = diff.values[0];

      diff.values.forEach((value, index) => {
        if (value !== firstValue) {
          indices.push(index);
        }
      });

      if (indices.length > 0) {
        highlighted.set(diff.field, indices);
      }
    }
  });

  return highlighted;
}

/**
 * Score items by how well they match criteria
 */
export function scoreItems(items: any[], criteria: Record<string, any>): Array<{ item: any; score: number }> {
  return items.map(item => {
    let score = 0;
    let totalCriteria = 0;

    Object.entries(criteria).forEach(([field, expectedValue]) => {
      totalCriteria++;
      const actualValue = item[field];

      if (actualValue === expectedValue) {
        score += 1;
      } else if (typeof actualValue === 'number' && typeof expectedValue === 'number') {
        // Partial score for numeric fields based on proximity
        const diff = Math.abs(actualValue - expectedValue);
        const maxDiff = expectedValue || 1;
        score += Math.max(0, 1 - (diff / maxDiff));
      } else if (typeof actualValue === 'string' && typeof expectedValue === 'string') {
        // Partial score for string fields based on inclusion
        if (actualValue.toLowerCase().includes(expectedValue.toLowerCase())) {
          score += 0.5;
        }
      }
    });

    return {
      item,
      score: totalCriteria > 0 ? (score / totalCriteria) * 100 : 0,
    };
  }).sort((a, b) => b.score - a.score);
}
