/**
 * SQL History Panel Component
 *
 * Git-style history viewer for SQL script changes with diff viewing.
 * Provides version control, rollback, and changelog export capabilities.
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  History,
  Download,
  Trash2,
  FileText,
  TrendingUp,
  TrendingDown,
  Minus,
  RotateCcw,
  Eye,
} from 'lucide-react';
import {
  SQLHistoryManager,
  SQLHistoryEntry,
  SQLDiff,
} from '@/lib/sai-unified/sql-history';
import { SAIScript } from '@/lib/sai-unified/types';

interface SQLHistoryPanelProps {
  /** History manager instance */
  historyManager: SQLHistoryManager;
  /** Callback when user wants to restore a previous version */
  onRestore?: (script: SAIScript) => void;
}

export const SQLHistoryPanel: React.FC<SQLHistoryPanelProps> = ({
  historyManager,
  onRestore,
}) => {
  const [history, setHistory] = useState<SQLHistoryEntry[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<SQLHistoryEntry | null>(null);
  const [compareEntry, setCompareEntry] = useState<SQLHistoryEntry | null>(null);
  const [diff, setDiff] = useState<SQLDiff | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'detail' | 'diff'>('list');

  // Load history on mount and whenever it changes
  useEffect(() => {
    const loadHistory = () => {
      setHistory(historyManager.getHistory());
    };

    loadHistory();

    // Refresh every second to catch new entries
    const interval = setInterval(loadHistory, 1000);

    return () => clearInterval(interval);
  }, [historyManager]);

  // Handle entry selection
  const handleSelectEntry = (entry: SQLHistoryEntry) => {
    setSelectedEntry(entry);
    setViewMode('detail');
    setCompareEntry(null);
    setDiff(null);
  };

  // Handle compare mode
  const handleCompare = (entry: SQLHistoryEntry) => {
    if (!selectedEntry) {
      setSelectedEntry(entry);
      return;
    }

    setCompareEntry(entry);
    const computedDiff = historyManager.getDiff(entry.id, selectedEntry.id);
    setDiff(computedDiff);
    setViewMode('diff');
  };

  // Handle restore
  const handleRestore = (entry: SQLHistoryEntry) => {
    if (onRestore && confirm('Restore this version? Current unsaved changes will be lost.')) {
      onRestore(entry.script);
    }
  };

  // Handle clear history
  const handleClearHistory = () => {
    if (confirm('Clear all SQL history? This cannot be undone.')) {
      historyManager.clearHistory();
      setHistory([]);
      setSelectedEntry(null);
      setCompareEntry(null);
      setDiff(null);
      setViewMode('list');
    }
  };

  // Handle export changelog
  const handleExportChangelog = () => {
    const changelog = historyManager.exportChangelog();
    const blob = new Blob([changelog], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sai-changelog-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Handle export SQL
  const handleExportSQL = (entry: SQLHistoryEntry) => {
    const blob = new Blob([entry.sql], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sai-${entry.timestamp}.sql`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Get statistics
  const stats = historyManager.getStatistics();

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center gap-2 mb-3">
          <History className="w-5 h-5 text-blue-500" />
          <h2 className="font-semibold text-lg">SQL History</h2>
          <Badge variant="outline" className="ml-auto">
            {stats.totalEntries} {stats.totalEntries === 1 ? 'version' : 'versions'}
          </Badge>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportChangelog}
            disabled={history.length === 0}
            className="flex-1"
          >
            <FileText className="w-4 h-4 mr-1" />
            Export Changelog
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleClearHistory}
            disabled={history.length === 0}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        {history.length === 0 ? (
          /* Empty state */
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            <History className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="font-medium">No History Yet</p>
            <p className="text-sm mt-1">SQL versions will appear here after export</p>
          </div>
        ) : viewMode === 'list' ? (
          /* History List */
          <div className="p-4 space-y-2">
            {history.map((entry, index) => (
              <Card
                key={entry.id}
                className={`p-3 cursor-pointer transition-all hover:shadow-md ${
                  selectedEntry?.id === entry.id ? 'ring-2 ring-blue-500' : ''
                }`}
                onClick={() => handleSelectEntry(entry)}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-xs">
                        #{history.length - index}
                      </Badge>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {new Date(entry.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <p className="font-medium text-sm truncate">{entry.message}</p>
                    <div className="flex gap-3 mt-2 text-xs text-gray-600 dark:text-gray-400">
                      <span className="flex items-center gap-1">
                        <TrendingUp className="w-3 h-3 text-green-500" />
                        {entry.changes.nodesAdded} added
                      </span>
                      <span className="flex items-center gap-1">
                        <Minus className="w-3 h-3 text-blue-500" />
                        {entry.changes.nodesModified} modified
                      </span>
                      <span className="flex items-center gap-1">
                        <TrendingDown className="w-3 h-3 text-red-500" />
                        {entry.changes.nodesDeleted} deleted
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCompare(entry);
                      }}
                      title="Compare"
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRestore(entry);
                      }}
                      title="Restore"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleExportSQL(entry);
                      }}
                      title="Export SQL"
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : viewMode === 'detail' && selectedEntry ? (
          /* Detail View */
          <div className="p-4 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Button variant="outline" size="sm" onClick={() => setViewMode('list')}>
                ← Back
              </Button>
              <h3 className="font-semibold flex-1">{selectedEntry.message}</h3>
            </div>

            <Card className="p-4">
              <h4 className="font-medium text-sm mb-3">Changes</h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-green-500" />
                  <span>{selectedEntry.changes.nodesAdded} Nodes Added</span>
                </div>
                <div className="flex items-center gap-2">
                  <Minus className="w-4 h-4 text-blue-500" />
                  <span>{selectedEntry.changes.nodesModified} Nodes Modified</span>
                </div>
                <div className="flex items-center gap-2">
                  <TrendingDown className="w-4 h-4 text-red-500" />
                  <span>{selectedEntry.changes.nodesDeleted} Nodes Deleted</span>
                </div>
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-gray-500" />
                  <span>{selectedEntry.changes.totalNodes} Total Nodes</span>
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <h4 className="font-medium text-sm mb-3">Metrics</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">SQL Size:</span>
                  <span className="font-mono">
                    {(selectedEntry.metrics.sqlSize / 1024).toFixed(2)} KB
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Line Count:</span>
                  <span className="font-mono">{selectedEntry.metrics.lineCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">INSERT Statements:</span>
                  <span className="font-mono">{selectedEntry.metrics.insertCount}</span>
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <h4 className="font-medium text-sm mb-3">SQL Preview</h4>
              <pre className="text-xs bg-gray-50 dark:bg-gray-900 p-3 rounded overflow-x-auto font-mono">
                {selectedEntry.sql.split('\n').slice(0, 20).join('\n')}
                {selectedEntry.sql.split('\n').length > 20 && '\n...'}
              </pre>
            </Card>

            <div className="flex gap-2">
              <Button className="flex-1" onClick={() => handleRestore(selectedEntry)}>
                <RotateCcw className="w-4 h-4 mr-2" />
                Restore This Version
              </Button>
              <Button variant="outline" onClick={() => handleExportSQL(selectedEntry)}>
                <Download className="w-4 h-4 mr-2" />
                Export SQL
              </Button>
            </div>
          </div>
        ) : viewMode === 'diff' && diff && selectedEntry && compareEntry ? (
          /* Diff View */
          <div className="p-4 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Button variant="outline" size="sm" onClick={() => setViewMode('list')}>
                ← Back
              </Button>
              <h3 className="font-semibold flex-1">Comparing Versions</h3>
            </div>

            <Card className="p-4">
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-red-500">
                  <Minus className="w-4 h-4" />
                  <span className="font-medium">Old:</span>
                  <span className="text-gray-600 dark:text-gray-400">
                    {new Date(compareEntry.timestamp).toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-green-500">
                  <TrendingUp className="w-4 h-4" />
                  <span className="font-medium">New:</span>
                  <span className="text-gray-600 dark:text-gray-400">
                    {new Date(selectedEntry.timestamp).toLocaleString()}
                  </span>
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <h4 className="font-medium text-sm mb-3">Statistics</h4>
              <div className="flex gap-4 text-sm">
                <div className="flex items-center gap-2 text-green-500">
                  <TrendingUp className="w-4 h-4" />
                  <span>{diff.stats.additions} additions</span>
                </div>
                <div className="flex items-center gap-2 text-red-500">
                  <TrendingDown className="w-4 h-4" />
                  <span>{diff.stats.deletions} deletions</span>
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <h4 className="font-medium text-sm mb-3">Diff</h4>
              <pre className="text-xs bg-gray-50 dark:bg-gray-900 p-3 rounded overflow-x-auto font-mono max-h-96">
                {diff.unified}
              </pre>
            </Card>
          </div>
        ) : null}
      </ScrollArea>

      {/* Footer Stats */}
      {history.length > 0 && viewMode === 'list' && (
        <div className="p-3 border-t border-gray-200 dark:border-gray-800 text-xs text-gray-600 dark:text-gray-400">
          <div className="flex justify-between">
            <span>Total SQL: {(stats.totalSqlGenerated / 1024).toFixed(2)} KB</span>
            <span>Avg Size: {(stats.averageSqlSize / 1024).toFixed(2)} KB</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default SQLHistoryPanel;
