'use client';

/**
 * Undo/Redo Panel Component
 *
 * UI for undo/redo operations with history visualization
 */

import React, { useState, useEffect } from 'react';
import { Undo, Redo, History, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  getUndoRedoManager,
  type Command,
} from '@/lib/undo-redo-system';

interface UndoRedoPanelProps {
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  onUndo?: () => void;
  onRedo?: () => void;
}

export function UndoRedoPanel({
  position = 'top-right',
  onUndo,
  onRedo,
}: UndoRedoPanelProps) {
  const manager = getUndoRedoManager();

  const [canUndo, setCanUndo] = useState(manager.canUndo());
  const [canRedo, setCanRedo] = useState(manager.canRedo());
  const [undoStack, setUndoStack] = useState<Command[]>([]);
  const [redoStack, setRedoStack] = useState<Command[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // Subscribe to history changes
  useEffect(() => {
    const updateState = () => {
      setCanUndo(manager.canUndo());
      setCanRedo(manager.canRedo());
      setUndoStack(manager.getUndoStack());
      setRedoStack(manager.getRedoStack());
    };

    updateState();
    const unsubscribe = manager.subscribe(updateState);
    return unsubscribe;
  }, [manager]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + Z = Undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
      // Ctrl/Cmd + Shift + Z or Ctrl/Cmd + Y = Redo
      if (((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'z') ||
          ((e.ctrlKey || e.metaKey) && e.key === 'y')) {
        e.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleUndo = () => {
    if (manager.undo()) {
      onUndo?.();
    }
  };

  const handleRedo = () => {
    if (manager.redo()) {
      onRedo?.();
    }
  };

  const handleClearHistory = () => {
    if (confirm('Are you sure you want to clear all undo/redo history?')) {
      manager.clear();
    }
  };

  const formatTimestamp = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  };

  const positionClasses = {
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4',
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
  };

  const historySize = manager.getHistorySize();

  return (
    <div
      className={`fixed ${positionClasses[position]} z-40 bg-slate-900/95 backdrop-blur border border-slate-700 rounded-lg shadow-2xl`}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-blue-400" />
          <span className="text-sm font-semibold text-white">History</span>
          {historySize.undo > 0 && (
            <span className="text-xs text-slate-400">
              ({historySize.undo} actions)
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </Button>
      </div>

      {/* Compact View */}
      {!isExpanded && (
        <div className="p-2 flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleUndo}
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
            className="h-8"
          >
            <Undo className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRedo}
            disabled={!canRedo}
            title="Redo (Ctrl+Shift+Z)"
            className="h-8"
          >
            <Redo className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* Expanded View */}
      {isExpanded && (
        <div className="p-3 space-y-3 min-w-[280px]">
          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleUndo}
              disabled={!canUndo}
              className="flex-1"
            >
              <Undo className="w-4 h-4 mr-2" />
              Undo
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRedo}
              disabled={!canRedo}
              className="flex-1"
            >
              <Redo className="w-4 h-4 mr-2" />
              Redo
            </Button>
          </div>

          {/* Keyboard Shortcuts */}
          <div className="bg-slate-800/50 rounded p-2">
            <div className="text-xs text-slate-400 space-y-1">
              <div className="flex justify-between">
                <span>Undo:</span>
                <span className="text-slate-300 font-mono">Ctrl+Z</span>
              </div>
              <div className="flex justify-between">
                <span>Redo:</span>
                <span className="text-slate-300 font-mono">Ctrl+Shift+Z</span>
              </div>
            </div>
          </div>

          {/* Last Action */}
          {historySize.undo > 0 && (
            <div className="border-t border-slate-700 pt-2">
              <div className="text-xs text-slate-400 mb-1">Last Action:</div>
              <div className="bg-slate-800/50 rounded p-2">
                <div className="text-xs text-slate-200">
                  {manager.getLastCommandDescription()}
                </div>
                {undoStack.length > 0 && (
                  <div className="text-xs text-slate-500 mt-1">
                    {formatTimestamp(undoStack[undoStack.length - 1].timestamp)}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* History Toggle */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowHistory(!showHistory)}
            className="w-full"
          >
            {showHistory ? 'Hide History' : 'Show Full History'}
          </Button>

          {/* Full History */}
          {showHistory && (
            <div className="border-t border-slate-700 pt-2 space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-xs text-slate-400 font-semibold">
                  Undo Stack ({undoStack.length})
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearHistory}
                  className="h-6 text-xs"
                  title="Clear History"
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>

              <div className="max-h-60 overflow-y-auto space-y-1">
                {undoStack.length === 0 && (
                  <div className="text-xs text-slate-500 text-center py-4">
                    No actions in history
                  </div>
                )}

                {[...undoStack].reverse().map((cmd, idx) => (
                  <div
                    key={cmd.id}
                    className="bg-slate-800/50 rounded p-2 text-xs"
                  >
                    <div className="text-slate-200">{cmd.description}</div>
                    <div className="text-slate-500 mt-0.5">
                      {formatTimestamp(cmd.timestamp)}
                    </div>
                  </div>
                ))}
              </div>

              {redoStack.length > 0 && (
                <>
                  <div className="text-xs text-slate-400 font-semibold mt-3">
                    Redo Stack ({redoStack.length})
                  </div>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {[...redoStack].reverse().map((cmd) => (
                      <div
                        key={cmd.id}
                        className="bg-slate-800/30 rounded p-2 text-xs opacity-60"
                      >
                        <div className="text-slate-300">{cmd.description}</div>
                        <div className="text-slate-500 mt-0.5">
                          {formatTimestamp(cmd.timestamp)}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Stats */}
          <div className="border-t border-slate-700 pt-2">
            <div className="grid grid-cols-2 gap-2 text-center">
              <div>
                <div className="text-xs text-slate-500">Undo Available</div>
                <div className="text-lg font-bold text-blue-400">
                  {historySize.undo}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Redo Available</div>
                <div className="text-lg font-bold text-green-400">
                  {historySize.redo}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
