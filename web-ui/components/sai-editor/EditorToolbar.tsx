/**
 * Editor Toolbar Component
 *
 * Main toolbar with actions for SAI editor:
 * - Add nodes (event, action, target)
 * - Undo/Redo
 * - Copy/Paste
 * - Layout
 * - Export/Import
 * - Validation
 */

'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Plus,
  Undo2,
  Redo2,
  Copy,
  ClipboardPaste,
  Scissors,
  Download,
  Upload,
  Layout as LayoutIcon,
  CheckCircle,
  Save,
  FileText,
  Zap,
  Target,
  MessageSquare,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface EditorToolbarProps {
  // Undo/Redo
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;

  // Clipboard
  canPaste: boolean;
  onCopy: () => void;
  onPaste: () => void;
  onCut: () => void;

  // Add nodes
  onAddEvent: () => void;
  onAddAction: () => void;
  onAddTarget: () => void;

  // Layout
  onAutoLayout: () => void;

  // Export/Import
  onExportSQL: () => void;
  onImportSQL: () => void;
  onExportJSON: () => void;

  // Validation
  validationScore?: number;
  onValidate: () => void;

  // Save
  onSave?: () => void;
}

export const EditorToolbar: React.FC<EditorToolbarProps> = ({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  canPaste,
  onCopy,
  onPaste,
  onCut,
  onAddEvent,
  onAddAction,
  onAddTarget,
  onAutoLayout,
  onExportSQL,
  onImportSQL,
  onExportJSON,
  validationScore,
  onValidate,
  onSave,
}) => {
  return (
    <div className="flex items-center gap-2 p-3 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex-wrap">
      {/* Add Nodes */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="default" size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add Node
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuLabel>Node Types</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onAddEvent}>
            <Zap className="h-4 w-4 mr-2 text-blue-500" />
            Event
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onAddAction}>
            <Target className="h-4 w-4 mr-2 text-green-500" />
            Action
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onAddTarget}>
            <Target className="h-4 w-4 mr-2 text-purple-500" />
            Target
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem>
            <MessageSquare className="h-4 w-4 mr-2 text-gray-500" />
            Comment
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Separator orientation="vertical" className="h-8" />

      {/* History */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={onUndo}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
        >
          <Undo2 className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onRedo}
          disabled={!canRedo}
          title="Redo (Ctrl+Y)"
        >
          <Redo2 className="h-4 w-4" />
        </Button>
      </div>

      <Separator orientation="vertical" className="h-8" />

      {/* Clipboard */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={onCopy}
          title="Copy (Ctrl+C)"
        >
          <Copy className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onCut}
          title="Cut (Ctrl+X)"
        >
          <Scissors className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onPaste}
          disabled={!canPaste}
          title="Paste (Ctrl+V)"
        >
          <ClipboardPaste className="h-4 w-4" />
        </Button>
      </div>

      <Separator orientation="vertical" className="h-8" />

      {/* Layout */}
      <Button
        variant="ghost"
        size="sm"
        onClick={onAutoLayout}
        title="Auto Layout"
      >
        <LayoutIcon className="h-4 w-4 mr-2" />
        Layout
      </Button>

      <Separator orientation="vertical" className="h-8" />

      {/* Export/Import */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuLabel>Export Script</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onExportSQL}>
            <FileText className="h-4 w-4 mr-2" />
            Export as SQL
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onExportJSON}>
            <FileText className="h-4 w-4 mr-2" />
            Export as JSON
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Button
        variant="ghost"
        size="sm"
        onClick={onImportSQL}
        title="Import SQL"
      >
        <Upload className="h-4 w-4 mr-2" />
        Import
      </Button>

      <Separator orientation="vertical" className="h-8" />

      {/* Validation */}
      <Button
        variant="ghost"
        size="sm"
        onClick={onValidate}
        title="Validate Script"
        className="flex items-center gap-2"
      >
        <CheckCircle className="h-4 w-4" />
        Validate
        {validationScore !== undefined && (
          <Badge
            variant={validationScore >= 90 ? 'default' : validationScore >= 70 ? 'secondary' : 'destructive'}
            className="text-xs"
          >
            {validationScore}
          </Badge>
        )}
      </Button>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Save */}
      {onSave && (
        <Button
          variant="default"
          size="sm"
          onClick={onSave}
          title="Save Script"
        >
          <Save className="h-4 w-4 mr-2" />
          Save
        </Button>
      )}
    </div>
  );
};

export default EditorToolbar;
