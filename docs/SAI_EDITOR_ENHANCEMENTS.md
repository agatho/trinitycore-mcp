# SAI Editor Enhancement Plan - Enterprise-Grade Visual Editor

**Version:** 3.1.0
**Date:** 2025-11-06
**Status:** Enhancement Plan
**Priority:** HIGH

---

## Executive Summary

This document outlines comprehensive enhancements to transform the TrinityCore SAI Visual Editor into an enterprise-grade, n8n-inspired scripting environment. The current implementation has 282 SAI types fully supported but lacks critical UX features that prevent professional workflows.

### Critical Issues Identified

| Issue | Impact | Priority |
|-------|--------|----------|
| No node deletion (DELETE key) | Users cannot remove nodes | 🔴 CRITICAL |
| No context menus | Poor discoverability of features | 🔴 HIGH |
| Missing text input fields | Cannot add yell/say text for TALK actions | 🔴 CRITICAL |
| Basic visual feedback | Not intuitive for complex scripts | 🟡 MEDIUM |
| No keyboard shortcuts documentation | Reduced productivity | 🟡 MEDIUM |

---

## Part 1: Node Deletion System

### 1.1 Keyboard-Based Deletion

**Implementation in `/web-ui/components/sai-editor/SAIEditor.tsx`:**

```typescript
// Add useEffect for keyboard event handling
useEffect(() => {
  const handleKeyDown = (event: KeyboardEvent) => {
    // DELETE or BACKSPACE key
    if (event.key === 'Delete' || event.key === 'Backspace') {
      // Get selected nodes
      const selectedNodes = nodes.filter(n => n.selected);
      const selectedEdges = edges.filter(e => e.selected);

      if (selectedNodes.length === 0 && selectedEdges.length === 0) {
        return; // Nothing selected
      }

      // Prevent deletion if user is typing in an input field
      const activeElement = document.activeElement;
      if (activeElement?.tagName === 'INPUT' ||
          activeElement?.tagName === 'TEXTAREA' ||
          activeElement?.tagName === 'SELECT') {
        return; // Don't delete while typing
      }

      event.preventDefault();
      handleDeleteSelected();
    }

    // Ctrl+A - Select all
    if (event.ctrlKey && event.key === 'a') {
      event.preventDefault();
      setNodes((nds) => nds.map(n => ({ ...n, selected: true })));
      setEdges((eds) => eds.map(e => ({ ...e, selected: true })));
      toast.info('All nodes selected');
    }

    // Escape - Deselect all
    if (event.key === 'Escape') {
      setNodes((nds) => nds.map(n => ({ ...n, selected: false })));
      setEdges((eds) => eds.map(e => ({ ...e, selected: false })));
      setSelectedNode(null);
    }
  };

  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [nodes, edges, setNodes, setEdges]);

// Delete handler function
const handleDeleteSelected = useCallback(() => {
  const selectedNodeIds = nodes.filter(n => n.selected).map(n => n.id);
  const selectedEdgeIds = edges.filter(e => e.selected).map(e => e.id);

  if (selectedNodeIds.length === 0 && selectedEdgeIds.length === 0) {
    return;
  }

  // Record history before deletion
  historyManager.record(
    convertFromReactFlow(),
    `Delete ${selectedNodeIds.length} node(s) and ${selectedEdgeIds.length} connection(s)`,
    'user'
  );

  // Remove selected nodes
  setNodes((nds) => nds.filter(n => !selectedNodeIds.includes(n.id)));

  // Remove selected edges AND edges connected to deleted nodes
  setEdges((eds) => eds.filter(e =>
    !selectedEdgeIds.includes(e.id) &&
    !selectedNodeIds.includes(e.source) &&
    !selectedNodeIds.includes(e.target)
  ));

  // Clear selection
  setSelectedNode(null);

  toast.success(`Deleted ${selectedNodeIds.length} node(s) and ${selectedEdgeIds.length + selectedNodeIds.length} connection(s)`);
}, [nodes, edges, setNodes, setEdges, convertFromReactFlow, historyManager]);
```

### 1.2 Toolbar Delete Button

**Add to EditorToolbar.tsx:**

```typescript
<Button
  variant="outline"
  onClick={onDelete}
  disabled={!hasSelection}
  title="Delete selected (Delete key)"
>
  <Trash2 className="w-4 h-4 mr-2" />
  Delete
</Button>
```

---

## Part 2: Context Menu System (n8n-inspired)

### 2.1 Context Menu Component

**Create `/web-ui/components/sai-editor/ContextMenu.tsx`:**

```typescript
'use client';

import React from 'react';
import { Menu, Transition } from '@headlessui/react';
import {
  Copy, Trash2, Edit, Link, Unlink, ZoomIn, Settings,
  FileCode, Play, Pause, Lock, Unlock, Eye, EyeOff
} from 'lucide-react';

interface ContextMenuItem {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  separator?: boolean;
  shortcut?: string;
  variant?: 'default' | 'danger';
}

interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, items, onClose }) => {
  // Close on click outside
  React.useEffect(() => {
    const handleClick = () => onClose();
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [onClose]);

  return (
    <div
      className="fixed z-50 bg-slate-800 border border-slate-700 rounded-lg shadow-2xl py-2 min-w-[200px]"
      style={{ left: x, top: y }}
      onClick={(e) => e.stopPropagation()}
    >
      {items.map((item, idx) => (
        <React.Fragment key={idx}>
          {item.separator ? (
            <div className="my-1 border-t border-slate-700" />
          ) : (
            <button
              className={`
                w-full px-4 py-2 text-left flex items-center gap-3
                hover:bg-slate-700 transition-colors text-sm
                ${item.disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                ${item.variant === 'danger' ? 'text-red-400 hover:bg-red-900/20' : 'text-white'}
              `}
              onClick={() => {
                if (!item.disabled) {
                  item.onClick();
                  onClose();
                }
              }}
              disabled={item.disabled}
            >
              {item.icon && <span className="w-4 h-4">{item.icon}</span>}
              <span className="flex-1">{item.label}</span>
              {item.shortcut && (
                <span className="text-xs text-slate-400">{item.shortcut}</span>
              )}
            </button>
          )}
        </React.Fragment>
      ))}
    </div>
  );
};
```

### 2.2 Context Menu Integration

**Add to SAIEditor.tsx:**

```typescript
const [contextMenu, setContextMenu] = useState<{
  x: number;
  y: number;
  type: 'node' | 'edge' | 'canvas';
  target?: any;
} | null>(null);

// Node context menu
const onNodeContextMenu = useCallback((event: React.MouseEvent, node: Node) => {
  event.preventDefault();
  setContextMenu({
    x: event.clientX,
    y: event.clientY,
    type: 'node',
    target: node,
  });
}, []);

// Edge context menu
const onEdgeContextMenu = useCallback((event: React.MouseEvent, edge: Edge) => {
  event.preventDefault();
  setContextMenu({
    x: event.clientX,
    y: event.clientY,
    type: 'edge',
    target: edge,
  });
}, []);

// Canvas context menu
const onPaneContextMenu = useCallback((event: React.MouseEvent) => {
  event.preventDefault();
  setContextMenu({
    x: event.clientX,
    y: event.clientY,
    type: 'canvas',
  });
}, []);

// Generate context menu items
const getContextMenuItems = useCallback((): ContextMenuItem[] => {
  if (!contextMenu) return [];

  switch (contextMenu.type) {
    case 'node':
      return [
        {
          label: 'Edit Properties',
          icon: <Edit />,
          onClick: () => setSelectedNode(contextMenu.target.data),
          shortcut: 'Enter',
        },
        {
          label: 'Duplicate',
          icon: <Copy />,
          onClick: () => handleDuplicateNode(contextMenu.target.id),
          shortcut: 'Ctrl+D',
        },
        { separator: true },
        {
          label: 'Copy',
          icon: <Copy />,
          onClick: handleCopy,
          shortcut: 'Ctrl+C',
        },
        {
          label: 'Cut',
          icon: <FileCode />,
          onClick: handleCut,
          shortcut: 'Ctrl+X',
        },
        { separator: true },
        {
          label: 'Delete',
          icon: <Trash2 />,
          onClick: () => handleDeleteNode(contextMenu.target.id),
          shortcut: 'Delete',
          variant: 'danger',
        },
      ];

    case 'edge':
      return [
        {
          label: 'Delete Connection',
          icon: <Unlink />,
          onClick: () => handleDeleteEdge(contextMenu.target.id),
          variant: 'danger',
        },
      ];

    case 'canvas':
      return [
        {
          label: 'Add Event',
          icon: <Plus />,
          onClick: handleAddEvent,
        },
        {
          label: 'Add Action',
          icon: <Plus />,
          onClick: handleAddAction,
        },
        {
          label: 'Add Target',
          icon: <Plus />,
          onClick: handleAddTarget,
        },
        { separator: true },
        {
          label: 'Paste',
          icon: <Copy />,
          onClick: handlePaste,
          disabled: !clipboard,
          shortcut: 'Ctrl+V',
        },
        { separator: true },
        {
          label: 'Select All',
          onClick: () => {
            setNodes((nds) => nds.map(n => ({ ...n, selected: true })));
          },
          shortcut: 'Ctrl+A',
        },
        {
          label: 'Auto Layout',
          icon: <Settings />,
          onClick: handleAutoLayout,
        },
      ];

    default:
      return [];
  }
}, [contextMenu, handleCopy, handleCut, handlePaste, handleAutoLayout, clipboard]);

// Add to ReactFlow component
<ReactFlow
  nodes={nodes}
  edges={edges}
  onNodesChange={onNodesChange}
  onEdgesChange={onEdgesChange}
  onConnect={onConnect}
  onNodeClick={onNodeClick}
  onNodeContextMenu={onNodeContextMenu}
  onEdgeContextMenu={onEdgeContextMenu}
  onPaneContextMenu={onPaneContextMenu}
  // ... other props
>
  {/* ... */}
</ReactFlow>

{contextMenu && (
  <ContextMenu
    x={contextMenu.x}
    y={contextMenu.y}
    items={getContextMenuItems()}
    onClose={() => setContextMenu(null)}
  />
)}
```

---

## Part 3: Enhanced Parameter Editor with Text Fields

### 3.1 Text Parameter Support for TALK Actions

**Verification in parameters.ts:**

```typescript
// Add to PARAMETER_REGISTRY
TextID: {
  value: 0,
  type: 'text',
  min: 0,
  description: 'Text entry ID from creature_text table',
  tooltip: 'References creature_text.groupid for the text to say/yell/whisper',
  required: true,
  defaultValue: 0,
  // NEW: Add text input support
  allowTextInput: true,
  textInputPlaceholder: 'Enter text directly or use TextID',
},

TextGroupID: {
  value: 0,
  type: 'number',
  min: 0,
  description: 'Text group ID',
  tooltip: 'Group ID from creature_text table',
  required: false,
},

TextString: {
  value: '',
  type: 'text',
  description: 'Direct text input (alternative to TextID)',
  tooltip: 'Enter text directly instead of using creature_text table',
  required: false,
  multiline: true,
  maxLength: 1000,
},

Duration: {
  value: 0,
  type: 'number',
  min: 0,
  max: 300000, // 5 minutes
  units: 'ms',
  description: 'Duration text stays on screen',
  tooltip: 'How long the text displays (milliseconds)',
  defaultValue: 0,
},

UseTalkTarget: {
  value: 0,
  type: 'enum',
  options: [
    { value: 0, label: 'No' },
    { value: 1, label: 'Yes' },
  ],
  description: 'Use talk target from event',
  tooltip: 'If enabled, text is directed to the event invoker',
  defaultValue: 0,
},
```

### 3.2 Comprehensive Parameter Input Component

**Enhance `/web-ui/components/sai-editor/ParameterEditor.tsx`:**

```typescript
const renderParameterInput = (param: SAIParameter) => {
  switch (param.type) {
    case 'text':
      if (param.multiline) {
        return (
          <textarea
            value={param.value as string}
            onChange={(e) => onParameterChange(param.name, e.target.value)}
            placeholder={param.textInputPlaceholder || 'Enter text...'}
            className="w-full p-2 bg-slate-700 border border-slate-600 rounded text-white text-sm resize-vertical min-h-[80px]"
            maxLength={param.maxLength}
          />
        );
      } else {
        return (
          <input
            type="text"
            value={param.value as string}
            onChange={(e) => onParameterChange(param.name, e.target.value)}
            placeholder={param.textInputPlaceholder || ''}
            className="w-full p-2 bg-slate-700 border border-slate-600 rounded text-white text-sm"
          />
        );
      }

    case 'number':
      return (
        <div className="flex gap-2">
          <input
            type="number"
            value={param.value as number}
            onChange={(e) => onParameterChange(param.name, parseInt(e.target.value) || 0)}
            min={param.min}
            max={param.max}
            className="flex-1 p-2 bg-slate-700 border border-slate-600 rounded text-white text-sm"
          />
          {param.units && (
            <span className="text-slate-400 text-sm self-center">{param.units}</span>
          )}
        </div>
      );

    case 'enum':
      return (
        <select
          value={param.value as string | number}
          onChange={(e) => onParameterChange(param.name, e.target.value)}
          className="w-full p-2 bg-slate-700 border border-slate-600 rounded text-white text-sm"
        >
          {param.options?.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      );

    case 'spell':
    case 'creature':
    case 'item':
    case 'quest':
      return (
        <div className="space-y-2">
          <input
            type="number"
            value={param.value as number}
            onChange={(e) => onParameterChange(param.name, parseInt(e.target.value) || 0)}
            min={0}
            placeholder={`Enter ${param.type} ID...`}
            className="w-full p-2 bg-slate-700 border border-slate-600 rounded text-white text-sm"
          />
          {/* Add lookup button for database entries */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleLookup(param.type, param.value as number)}
            className="w-full"
          >
            <Search className="w-3 h-3 mr-2" />
            Lookup {param.type}
          </Button>
        </div>
      );

    default:
      return (
        <input
          type="text"
          value={String(param.value)}
          onChange={(e) => onParameterChange(param.name, e.target.value)}
          className="w-full p-2 bg-slate-700 border border-slate-600 rounded text-white text-sm"
        />
      );
  }
};
```

### 3.3 TALK Action-Specific UI

**Create specialized TALK action editor:**

```typescript
const TalkActionEditor: React.FC<{parameter: SAIParameter}> = ({ parameter }) => {
  const [mode, setMode] = useState<'textid' | 'direct'>('textid');

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button
          variant={mode === 'textid' ? 'default' : 'outline'}
          onClick={() => setMode('textid')}
        >
          Use Text ID
        </Button>
        <Button
          variant={mode === 'direct' ? 'default' : 'outline'}
          onClick={() => setMode('direct')}
        >
          Enter Text Directly
        </Button>
      </div>

      {mode === 'textid' ? (
        <div>
          <label className="text-sm text-slate-300">Text ID (creature_text)</label>
          <input
            type="number"
            value={parameter.value as number}
            onChange={(e) => onParameterChange(parameter.name, parseInt(e.target.value))}
            className="w-full p-2 bg-slate-700 border border-slate-600 rounded text-white"
          />
          <p className="text-xs text-slate-400 mt-1">
            Reference to creature_text.groupid
          </p>
        </div>
      ) : (
        <div>
          <label className="text-sm text-slate-300">Direct Text Input</label>
          <textarea
            value={parameter.textString || ''}
            onChange={(e) => onParameterChange('TextString', e.target.value)}
            placeholder="Enter the text the creature should say/yell..."
            className="w-full p-2 bg-slate-700 border border-slate-600 rounded text-white min-h-[100px]"
            maxLength={1000}
          />
          <div className="flex justify-between text-xs text-slate-400 mt-1">
            <span>What the creature will say</span>
            <span>{(parameter.textString?.length || 0)}/1000</span>
          </div>
        </div>
      )}

      <div>
        <label className="text-sm text-slate-300">Duration (ms)</label>
        <input
          type="number"
          value={parameter.duration || 0}
          onChange={(e) => onParameterChange('Duration', parseInt(e.target.value))}
          min={0}
          className="w-full p-2 bg-slate-700 border border-slate-600 rounded text-white"
        />
      </div>

      <div>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={parameter.useTalkTarget === 1}
            onChange={(e) => onParameterChange('UseTalkTarget', e.target.checked ? 1 : 0)}
            className="w-4 h-4"
          />
          <span className="text-sm text-slate-300">Use talk target from event</span>
        </label>
      </div>
    </div>
  );
};
```

---

## Part 4: n8n-Style Visual Enhancements

### 4.1 Node Styling (n8n-inspired)

**Update SAINode.tsx:**

```typescript
const getNodeStyle = (node: SAINodeType, isSelected: boolean, isConnecting: boolean) => {
  // Base colors by type
  const colorSchemes = {
    event: {
      bg: '#6366f1', // Indigo
      border: '#818cf8',
      hover: '#4f46e5',
      text: '#ffffff',
    },
    action: {
      bg: '#10b981', // Emerald
      border: '#34d399',
      hover: '#059669',
      text: '#ffffff',
    },
    target: {
      bg: '#f59e0b', // Amber
      border: '#fbbf24',
      hover: '#d97706',
      text: '#ffffff',
    },
  };

  const scheme = colorSchemes[node.type as 'event' | 'action' | 'target'];

  return {
    background: isSelected ? scheme.hover : scheme.bg,
    border: `2px solid ${isSelected ? '#ffffff' : scheme.border}`,
    borderRadius: '12px',
    boxShadow: isSelected
      ? '0 8px 30px rgba(0, 0, 0, 0.4), 0 0 0 3px rgba(255, 255, 255, 0.3)'
      : '0 4px 12px rgba(0, 0, 0, 0.2)',
    color: scheme.text,
    padding: '16px',
    minWidth: '280px',
    transition: 'all 0.2s ease',
    cursor: isConnecting ? 'crosshair' : 'grab',
    transform: isSelected ? 'scale(1.05)' : 'scale(1)',
  };
};

// Add connection handles (n8n-style)
<Handle
  type="source"
  position={Position.Right}
  style={{
    width: 12,
    height: 12,
    background: '#10b981',
    border: '2px solid #ffffff',
    cursor: 'crosshair',
  }}
  onConnect={(params) => toast.success('Connected!')}
/>

<Handle
  type="target"
  position={Position.Left}
  style={{
    width: 12,
    height: 12,
    background: '#3b82f6',
    border: '2px solid #ffffff',
  }}
/>
```

### 4.2 Connection Styling

```typescript
const connectionLineStyle = {
  strokeWidth: 2,
  stroke: '#64748b',
};

const edgeOptions = {
  animated: true,
  style: {
    strokeWidth: 2,
    stroke: '#64748b',
  },
};

// Add edge types
const edgeTypes = {
  default: 'smoothstep',
  straight: 'straight',
  step: 'step',
};
```

### 4.3 Visual Feedback System

```typescript
// Add connection validation feedback
const onConnectStart = useCallback((event, { nodeId, handleType }) => {
  // Show potential connection targets
  setNodes((nds) => nds.map(n => ({
    ...n,
    data: {
      ...n.data,
      isPotentialTarget: canConnect(nodeId, n.id, handleType),
    },
  })));
}, []);

const onConnectEnd = useCallback(() => {
  // Clear connection feedback
  setNodes((nds) => nds.map(n => ({
    ...n,
    data: { ...n.data, isPotentialTarget: false },
  })));
}, []);

// Add hover effects
<ReactFlow
  nodes={nodes}
  edges={edges}
  onNodeMouseEnter={(event, node) => {
    setNodes((nds) => nds.map(n =>
      n.id === node.id ? { ...n, data: { ...n.data, isHovered: true } } : n
    ));
  }}
  onNodeMouseLeave={(event, node) => {
    setNodes((nds) => nds.map(n =>
      n.id === node.id ? { ...n, data: { ...n.data, isHovered: false } } : n
    ));
  }}
/>
```

---

## Part 5: Keyboard Shortcuts Documentation

### 5.1 Shortcuts Panel Component

**Create `/web-ui/components/sai-editor/ShortcutsPanel.tsx`:**

```typescript
export const ShortcutsPanel = () => {
  const shortcuts = [
    { keys: ['Delete', 'Backspace'], action: 'Delete selected nodes/connections' },
    { keys: ['Ctrl', 'C'], action: 'Copy selected nodes' },
    { keys: ['Ctrl', 'X'], action: 'Cut selected nodes' },
    { keys: ['Ctrl', 'V'], action: 'Paste nodes' },
    { keys: ['Ctrl', 'Z'], action: 'Undo' },
    { keys: ['Ctrl', 'Y'], action: 'Redo' },
    { keys: ['Ctrl', 'A'], action: 'Select all nodes' },
    { keys: ['Ctrl', 'D'], action: 'Duplicate selected' },
    { keys: ['Escape'], action: 'Deselect all' },
    { keys: ['Enter'], action: 'Edit selected node' },
    { keys: ['Ctrl', 'S'], action: 'Save script' },
    { keys: ['Ctrl', 'E'], action: 'Export SQL' },
    { keys: ['Ctrl', 'L'], action: 'Auto layout' },
    { keys: ['Ctrl', '='], action: 'Zoom in' },
    { keys: ['Ctrl', '-'], action: 'Zoom out' },
    { keys: ['Ctrl', '0'], action: 'Reset zoom' },
    { keys: ['Space'], action: 'Pan canvas (hold)' },
  ];

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
      <h3 className="text-lg font-semibold text-white mb-4">Keyboard Shortcuts</h3>
      <div className="space-y-2">
        {shortcuts.map((shortcut, idx) => (
          <div key={idx} className="flex items-center justify-between text-sm">
            <span className="text-slate-300">{shortcut.action}</span>
            <div className="flex gap-1">
              {shortcut.keys.map((key, i) => (
                <React.Fragment key={i}>
                  <kbd className="px-2 py-1 bg-slate-700 border border-slate-600 rounded text-xs text-white">
                    {key}
                  </kbd>
                  {i < shortcut.keys.length - 1 && (
                    <span className="text-slate-500">+</span>
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
```

---

## Part 6: Implementation Checklist

### Phase 1: Critical Fixes (Week 1)
- [ ] Implement DELETE key handler
- [ ] Add node deletion function
- [ ] Add toolbar delete button
- [ ] Implement edge deletion
- [ ] Add confirmation dialog for deletions
- [ ] Test deletion with undo/redo

### Phase 2: Context Menus (Week 2)
- [ ] Create ContextMenu component
- [ ] Implement node context menu
- [ ] Implement edge context menu
- [ ] Implement canvas context menu
- [ ] Add right-click handlers
- [ ] Test all context menu actions

### Phase 3: Parameter Enhancement (Week 2-3)
- [ ] Add text input fields to TALK action
- [ ] Create TalkActionEditor component
- [ ] Add multiline text support
- [ ] Add character counter
- [ ] Add text ID lookup
- [ ] Enhance all parameter types
- [ ] Add validation feedback

### Phase 4: Visual Polish (Week 3)
- [ ] Update node styling (n8n-style)
- [ ] Add connection animations
- [ ] Implement hover effects
- [ ] Add selection indicators
- [ ] Improve color scheme
- [ ] Add visual feedback for connections

### Phase 5: UX Improvements (Week 4)
- [ ] Add keyboard shortcuts panel
- [ ] Implement Ctrl+D duplicate
- [ ] Add Ctrl+S save
- [ ] Add zoom shortcuts
- [ ] Add node search/filter
- [ ] Add performance optimizations

### Phase 6: Testing & Documentation (Week 4)
- [ ] Unit tests for deletion
- [ ] Integration tests for context menus
- [ ] E2E tests for workflows
- [ ] Update user documentation
- [ ] Create video tutorials
- [ ] Performance benchmarking

---

## Part 7: Expected Outcomes

### User Experience Improvements
1. **Faster workflows** - Delete nodes with one keystroke
2. **Better discoverability** - Context menus reveal all actions
3. **Complete parameter support** - All SAI features accessible
4. **Professional appearance** - n8n-quality visual design
5. **Intuitive interactions** - Visual feedback guides users

### Technical Improvements
1. **Code quality** - Proper TypeScript types
2. **Performance** - Optimized re-renders
3. **Accessibility** - Keyboard navigation
4. **Maintainability** - Modular components
5. **Testability** - Comprehensive test coverage

### Business Value
1. **Increased adoption** - Easier to use = more users
2. **Reduced support** - Intuitive UI = fewer questions
3. **Professional reputation** - Enterprise-grade tool
4. **Competitive advantage** - Best SAI editor available
5. **Community growth** - Contributors attracted to quality

---

## Part 8: Testing Strategy

### Manual Testing Checklist
- [ ] Delete node with DELETE key
- [ ] Delete node with Backspace
- [ ] Delete multiple selected nodes
- [ ] Delete edge with context menu
- [ ] Right-click node shows menu
- [ ] Right-click edge shows menu
- [ ] Right-click canvas shows menu
- [ ] TALK action has text field
- [ ] Text field supports multiline
- [ ] Character counter works
- [ ] Copy/paste after deletion
- [ ] Undo deletion works
- [ ] Redo deletion works

### Automated Tests
```typescript
describe('Node Deletion', () => {
  it('should delete selected nodes with DELETE key', () => {
    const { result } = renderHook(() => useSAIEditor());
    // Add nodes
    act(() => {
      result.current.addEventNode();
    });
    // Select node
    act(() => {
      result.current.selectNode('event-1');
    });
    // Delete with keyboard
    act(() => {
      const event = new KeyboardEvent('keydown', { key: 'Delete' });
      window.dispatchEvent(event);
    });
    // Verify deleted
    expect(result.current.nodes).toHaveLength(0);
  });
});
```

---

## Part 9: Performance Considerations

### Optimization Strategies
1. **Debounce validation** - Already implemented (500ms)
2. **Virtual scrolling** - For large node lists
3. **Memo node components** - Prevent unnecessary re-renders
4. **Lazy load templates** - Only load when needed
5. **Web Workers** - For SQL generation
6. **IndexedDB** - Cache database lookups

### Performance Metrics
- **Target:** < 50ms for delete operation
- **Target:** < 100ms for context menu render
- **Target:** < 200ms for parameter editor update
- **Target:** 60 FPS during canvas pan/zoom

---

## Part 10: Accessibility (A11y)

### WCAG 2.1 Level AA Compliance
- [ ] Keyboard navigation for all features
- [ ] Screen reader announcements
- [ ] Focus indicators on all interactive elements
- [ ] Color contrast ratios ≥ 4.5:1
- [ ] Alt text for icons
- [ ] ARIA labels for custom components
- [ ] Skip navigation links

### Implementation
```typescript
// Add aria labels
<button
  onClick={handleDelete}
  aria-label="Delete selected nodes (Delete key)"
  title="Delete selected nodes"
>
  <Trash2 />
</button>

// Add live region for announcements
<div
  role="status"
  aria-live="polite"
  aria-atomic="true"
  className="sr-only"
>
  {announcement}
</div>
```

---

## Conclusion

This enhancement plan transforms the SAI Editor from a functional tool into an enterprise-grade visual scripting environment. The focus on UX, performance, and accessibility ensures professional quality that rivals commercial tools like n8n.

**Estimated Timeline:** 4 weeks
**Estimated Effort:** 120 hours
**Priority:** HIGH - Critical UX issues block professional use
**Impact:** VERY HIGH - Transforms user experience

**Next Steps:**
1. Review and approve this plan
2. Begin Phase 1 (Critical Fixes)
3. Iterate based on user feedback
4. Launch enhanced version 3.1.0

---

**Document Version:** 1.0
**Last Updated:** 2025-11-06
**Author:** Claude AI Assistant
**Status:** READY FOR IMPLEMENTATION
