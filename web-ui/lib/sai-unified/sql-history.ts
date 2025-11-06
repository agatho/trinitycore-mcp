/**
 * TrinityCore SAI Unified Editor - SQL History Manager
 *
 * Git-style version control for SQL script changes.
 * Tracks SQL generations, provides diff viewing, and rollback capability.
 *
 * @module sai-unified/sql-history
 * @version 3.0.0
 */

import { SAIScript } from './types';

// ============================================================================
// TYPES
// ============================================================================

export interface SQLHistoryEntry {
  /** Unique entry ID */
  id: string;

  /** Timestamp when SQL was generated */
  timestamp: number;

  /** Generated SQL content */
  sql: string;

  /** Script snapshot at time of generation */
  script: SAIScript;

  /** User who generated this SQL (if available) */
  user?: string;

  /** Commit message / description */
  message: string;

  /** Change summary */
  changes: {
    nodesAdded: number;
    nodesModified: number;
    nodesDeleted: number;
    totalNodes: number;
  };

  /** Size metrics */
  metrics: {
    sqlSize: number; // bytes
    lineCount: number;
    insertCount: number;
  };
}

export interface SQLDiff {
  /** Lines added */
  added: string[];

  /** Lines removed */
  removed: string[];

  /** Lines unchanged */
  unchanged: string[];

  /** Unified diff format */
  unified: string;

  /** Statistics */
  stats: {
    additions: number;
    deletions: number;
    changes: number;
  };
}

// ============================================================================
// HISTORY MANAGER
// ============================================================================

export class SQLHistoryManager {
  private history: SQLHistoryEntry[] = [];
  private maxHistory: number;

  constructor(maxHistory: number = 100) {
    this.maxHistory = maxHistory;
    this.loadFromLocalStorage();
  }

  /**
   * Add a new SQL history entry
   */
  addEntry(sql: string, script: SAIScript, message: string = 'Manual SQL generation'): SQLHistoryEntry {
    const previousEntry = this.history[0];

    // Calculate changes
    const changes = this.calculateChanges(previousEntry?.script, script);

    // Calculate metrics
    const metrics = {
      sqlSize: new Blob([sql]).size,
      lineCount: sql.split('\n').length,
      insertCount: (sql.match(/INSERT INTO/gi) || []).length,
    };

    const entry: SQLHistoryEntry = {
      id: `sql-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      sql,
      script: JSON.parse(JSON.stringify(script)), // Deep clone
      message,
      changes,
      metrics,
    };

    // Add to history (newest first)
    this.history.unshift(entry);

    // Trim history if needed
    if (this.history.length > this.maxHistory) {
      this.history = this.history.slice(0, this.maxHistory);
    }

    this.saveToLocalStorage();

    return entry;
  }

  /**
   * Get all history entries
   */
  getHistory(): SQLHistoryEntry[] {
    return [...this.history];
  }

  /**
   * Get a specific history entry
   */
  getEntry(id: string): SQLHistoryEntry | null {
    return this.history.find(entry => entry.id === id) || null;
  }

  /**
   * Get diff between two SQL entries
   */
  getDiff(fromId: string, toId: string): SQLDiff | null {
    const fromEntry = this.getEntry(fromId);
    const toEntry = this.getEntry(toId);

    if (!fromEntry || !toEntry) {
      return null;
    }

    return this.computeDiff(fromEntry.sql, toEntry.sql);
  }

  /**
   * Get diff between an entry and the current state
   */
  getDiffFromEntry(entryId: string, currentSql: string): SQLDiff | null {
    const entry = this.getEntry(entryId);

    if (!entry) {
      return null;
    }

    return this.computeDiff(entry.sql, currentSql);
  }

  /**
   * Clear all history
   */
  clearHistory(): void {
    this.history = [];
    this.saveToLocalStorage();
  }

  /**
   * Export history as JSON
   */
  exportHistory(): string {
    return JSON.stringify(this.history, null, 2);
  }

  /**
   * Import history from JSON
   */
  importHistory(json: string): void {
    try {
      const imported = JSON.parse(json);
      if (Array.isArray(imported)) {
        this.history = imported;
        this.saveToLocalStorage();
      }
    } catch (error) {
      console.error('[SQL History] Failed to import history:', error);
    }
  }

  /**
   * Export changelog (markdown format)
   */
  exportChangelog(): string {
    let changelog = '# SQL Change History\n\n';

    for (const entry of this.history) {
      const date = new Date(entry.timestamp).toLocaleString();
      changelog += `## ${date}\n`;
      changelog += `**Message:** ${entry.message}\n\n`;
      changelog += `**Changes:**\n`;
      changelog += `- Nodes Added: ${entry.changes.nodesAdded}\n`;
      changelog += `- Nodes Modified: ${entry.changes.nodesModified}\n`;
      changelog += `- Nodes Deleted: ${entry.changes.nodesDeleted}\n`;
      changelog += `- Total Nodes: ${entry.changes.totalNodes}\n\n`;
      changelog += `**Metrics:**\n`;
      changelog += `- SQL Size: ${(entry.metrics.sqlSize / 1024).toFixed(2)} KB\n`;
      changelog += `- Line Count: ${entry.metrics.lineCount}\n`;
      changelog += `- INSERT Statements: ${entry.metrics.insertCount}\n\n`;
      changelog += '---\n\n';
    }

    return changelog;
  }

  /**
   * Get statistics for all history
   */
  getStatistics(): {
    totalEntries: number;
    totalSqlGenerated: number;
    averageSqlSize: number;
    oldestEntry: number | null;
    newestEntry: number | null;
  } {
    if (this.history.length === 0) {
      return {
        totalEntries: 0,
        totalSqlGenerated: 0,
        averageSqlSize: 0,
        oldestEntry: null,
        newestEntry: null,
      };
    }

    const totalSqlGenerated = this.history.reduce(
      (sum, entry) => sum + entry.metrics.sqlSize,
      0
    );

    return {
      totalEntries: this.history.length,
      totalSqlGenerated,
      averageSqlSize: totalSqlGenerated / this.history.length,
      oldestEntry: this.history[this.history.length - 1].timestamp,
      newestEntry: this.history[0].timestamp,
    };
  }

  // ========================================================================
  // PRIVATE METHODS
  // ========================================================================

  /**
   * Calculate changes between two scripts
   */
  private calculateChanges(
    previousScript: SAIScript | undefined,
    currentScript: SAIScript
  ): SQLHistoryEntry['changes'] {
    if (!previousScript) {
      return {
        nodesAdded: currentScript.nodes.length,
        nodesModified: 0,
        nodesDeleted: 0,
        totalNodes: currentScript.nodes.length,
      };
    }

    const prevNodeIds = new Set(previousScript.nodes.map(n => n.id));
    const currNodeIds = new Set(currentScript.nodes.map(n => n.id));

    const added = currentScript.nodes.filter(n => !prevNodeIds.has(n.id));
    const deleted = previousScript.nodes.filter(n => !currNodeIds.has(n.id));

    // Nodes that exist in both but may have been modified
    const commonNodeIds = currentScript.nodes.filter(n => prevNodeIds.has(n.id));
    const modified = commonNodeIds.filter(currNode => {
      const prevNode = previousScript.nodes.find(n => n.id === currNode.id);
      return JSON.stringify(currNode) !== JSON.stringify(prevNode);
    });

    return {
      nodesAdded: added.length,
      nodesModified: modified.length,
      nodesDeleted: deleted.length,
      totalNodes: currentScript.nodes.length,
    };
  }

  /**
   * Compute diff between two SQL strings
   */
  private computeDiff(oldSql: string, newSql: string): SQLDiff {
    const oldLines = oldSql.split('\n');
    const newLines = newSql.split('\n');

    const added: string[] = [];
    const removed: string[] = [];
    const unchanged: string[] = [];

    // Simple line-by-line diff (could be enhanced with LCS algorithm)
    const oldSet = new Set(oldLines);
    const newSet = new Set(newLines);

    for (const line of oldLines) {
      if (!newSet.has(line)) {
        removed.push(line);
      } else {
        unchanged.push(line);
      }
    }

    for (const line of newLines) {
      if (!oldSet.has(line)) {
        added.push(line);
      }
    }

    // Generate unified diff format
    let unified = '--- Old SQL\n+++ New SQL\n@@ -1,{$oldLines.length} +1,${newLines.length} @@\n';

    for (const line of removed) {
      unified += `-${line}\n`;
    }

    for (const line of added) {
      unified += `+${line}\n`;
    }

    for (const line of unchanged) {
      unified += ` ${line}\n`;
    }

    return {
      added,
      removed,
      unchanged,
      unified,
      stats: {
        additions: added.length,
        deletions: removed.length,
        changes: added.length + removed.length,
      },
    };
  }

  /**
   * Save history to localStorage
   */
  private saveToLocalStorage(): void {
    try {
      localStorage.setItem('sai-sql-history', JSON.stringify(this.history));
    } catch (error) {
      console.error('[SQL History] Failed to save to localStorage:', error);
    }
  }

  /**
   * Load history from localStorage
   */
  private loadFromLocalStorage(): void {
    try {
      const stored = localStorage.getItem('sai-sql-history');
      if (stored) {
        this.history = JSON.parse(stored);
      }
    } catch (error) {
      console.error('[SQL History] Failed to load from localStorage:', error);
    }
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let historyManager: SQLHistoryManager | null = null;

/**
 * Get the global SQL history manager instance
 */
export function getSQLHistoryManager(): SQLHistoryManager {
  if (!historyManager) {
    historyManager = new SQLHistoryManager();
  }
  return historyManager;
}
