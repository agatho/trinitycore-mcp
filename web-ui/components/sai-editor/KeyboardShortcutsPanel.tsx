/**
 * Keyboard Shortcuts Panel
 *
 * Displays all available keyboard shortcuts for the SAI Editor.
 * Helps users discover and learn efficient workflows.
 */

'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Keyboard } from 'lucide-react';

interface Shortcut {
  keys: string[];
  action: string;
  category: 'editing' | 'navigation' | 'file' | 'view';
}

const SHORTCUTS: Shortcut[] = [
  // Editing
  { keys: ['Delete'], action: 'Delete selected nodes/connections', category: 'editing' },
  { keys: ['Backspace'], action: 'Delete selected nodes/connections', category: 'editing' },
  { keys: ['Ctrl', 'C'], action: 'Copy selected nodes', category: 'editing' },
  { keys: ['Ctrl', 'X'], action: 'Cut selected nodes', category: 'editing' },
  { keys: ['Ctrl', 'V'], action: 'Paste nodes', category: 'editing' },
  { keys: ['Ctrl', 'Z'], action: 'Undo', category: 'editing' },
  { keys: ['Ctrl', 'Y'], action: 'Redo', category: 'editing' },
  { keys: ['Ctrl', 'D'], action: 'Duplicate selected node', category: 'editing' },

  // Navigation
  { keys: ['Ctrl', 'A'], action: 'Select all nodes', category: 'navigation' },
  { keys: ['Escape'], action: 'Deselect all', category: 'navigation' },
  { keys: ['Enter'], action: 'Edit selected node', category: 'navigation' },

  // File
  { keys: ['Ctrl', 'S'], action: 'Save script', category: 'file' },
  { keys: ['Ctrl', 'E'], action: 'Export SQL', category: 'file' },

  // View
  { keys: ['Ctrl', 'L'], action: 'Auto layout', category: 'view' },
  { keys: ['Ctrl', '='], action: 'Zoom in', category: 'view' },
  { keys: ['Ctrl', '-'], action: 'Zoom out', category: 'view' },
  { keys: ['Ctrl', '0'], action: 'Reset zoom', category: 'view' },
  { keys: ['Space'], action: 'Pan canvas (hold and drag)', category: 'view' },
];

const CATEGORY_LABELS = {
  editing: 'Editing',
  navigation: 'Navigation',
  file: 'File Operations',
  view: 'View & Layout',
};

const CATEGORY_COLORS = {
  editing: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  navigation: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  file: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  view: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
};

export const KeyboardShortcutsPanel: React.FC = () => {
  const categories = Object.keys(CATEGORY_LABELS) as Array<keyof typeof CATEGORY_LABELS>;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Keyboard className="h-5 w-5 text-primary" />
          <CardTitle>Keyboard Shortcuts</CardTitle>
        </div>
        <CardDescription>
          Master these shortcuts for faster SAI script editing
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {categories.map((category) => {
          const shortcuts = SHORTCUTS.filter(s => s.category === category);

          return (
            <div key={category} className="space-y-3">
              <Badge className={CATEGORY_COLORS[category]} variant="secondary">
                {CATEGORY_LABELS[category]}
              </Badge>

              <div className="space-y-2">
                {shortcuts.map((shortcut, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between py-2 px-3 rounded-lg bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {shortcut.action}
                    </span>
                    <div className="flex gap-1">
                      {shortcut.keys.map((key, i) => (
                        <React.Fragment key={i}>
                          <kbd className="px-2.5 py-1 text-xs font-mono bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded shadow-sm">
                            {key}
                          </kbd>
                          {i < shortcut.keys.length - 1 && (
                            <span className="text-slate-400 text-xs self-center">+</span>
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            💡 <strong>Tip:</strong> You can right-click on nodes, edges, or the canvas to access context menus with additional actions.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default KeyboardShortcutsPanel;
