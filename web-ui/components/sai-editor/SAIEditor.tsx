/**
 * SAI Editor Component
 *
 * Main visual editor for TrinityCore Smart AI scripts.
 * Integrates ReactFlow with all SAI editing functionality.
 */

'use client';

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Connection,
  ConnectionMode,
  Controls,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  addEdge,
  Panel,
} from 'reactflow';
import 'reactflow/dist/style.css';

import { SAIScript, SAINode as SAINodeType, SAIConnection, ValidationResult, SAITemplate } from '@/lib/sai-unified/types';
import { validateScript } from '@/lib/sai-unified/validation';
import { autoLayout } from '@/lib/sai-unified/layout';
import { HistoryManager } from '@/lib/sai-unified/history';
import { copyNodes, pasteNodes, Clipboard } from '@/lib/sai-unified/clipboard';
import { generateSQL } from '@/lib/sai-unified/sql-generator';
import { parseSQL } from '@/lib/sai-unified/sql-parser';
import { instantiateTemplate } from '@/lib/sai-unified/templates';
import { getParametersForEvent, getParametersForAction, getParametersForTarget } from '@/lib/sai-unified/parameters';
import { useDebouncedCallback, useRenderTime } from '@/lib/sai-unified/performance';
import { getSQLHistoryManager } from '@/lib/sai-unified/sql-history';

import SAINodeComponent from './SAINode';
import CustomEdge from './CustomEdge';
import EnhancedMiniMap from './EnhancedMiniMap';
import CollaborationProvider, { useCollaboration } from './CollaborationProvider';
import PresenceIndicator from './PresenceIndicator';
import PerformanceMonitor from './PerformanceMonitor';
import EditorToolbar from './EditorToolbar';
import NodeEditor from './NodeEditor';
import ValidationPanel from './ValidationPanel';
import TemplateLibrary from './TemplateLibrary';
import AIGenerationPanel from './AIGenerationPanel';
import ContextMenu, { ContextMenuItem } from './ContextMenu';
import KeyboardShortcutsPanel from './KeyboardShortcutsPanel';
import SQLHistoryPanel from './SQLHistoryPanel';
import SimulatorPanel from './SimulatorPanel';

import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
  Copy,
  Trash2,
  Edit,
  Unlink,
  Plus,
  Scissors,
  Settings as SettingsIcon,
  Layers,
} from 'lucide-react';

// Node types for ReactFlow
const nodeTypes = {
  saiNode: SAINodeComponent,
};

// Edge types for ReactFlow
const edgeTypes = {
  custom: CustomEdge,
};

interface SAIEditorProps {
  initialScript?: SAIScript;
  onSave?: (script: SAIScript) => void;
  onExport?: (sql: string) => void;
}

const SAIEditorInner: React.FC<SAIEditorProps> = ({
  initialScript,
  onSave,
  onExport,
}) => {
  // Collaboration hooks
  const { isNodeLocked, getNodeLock, lockNode, unlockNode, updateSelection } = useCollaboration();
  // State
  const [script, setScript] = useState<SAIScript>(
    initialScript || {
      id: `script-${Date.now()}`,
      name: 'New SAI Script',
      entryOrGuid: 0,
      sourceType: 0,
      nodes: [],
      connections: [],
      metadata: {
        version: '3.0.0',
        createdAt: Date.now(),
        modifiedAt: Date.now(),
      },
    }
  );

  const [selectedNode, setSelectedNode] = useState<SAINodeType | null>(null);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [clipboard, setClipboard] = useState<Clipboard | null>(null);
  const [historyManager] = useState(() => new HistoryManager(script));
  const [sqlHistoryManager] = useState(() => getSQLHistoryManager());
  const [showTemplates, setShowTemplates] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    type: 'node' | 'edge' | 'canvas';
    target?: any;
  } | null>(null);

  // Execution flow visualization state
  const [executingNodes, setExecutingNodes] = useState<Set<string>>(new Set());

  // ReactFlow state
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // Convert SAI script to ReactFlow nodes/edges
  const convertToReactFlow = useCallback((saiScript: SAIScript) => {
    const flowNodes: Node[] = saiScript.nodes.map((node) => {
      const lock = getNodeLock(node.id);
      return {
        id: node.id,
        type: 'saiNode',
        position: node.position,
        data: {
          ...node,
          locked: isNodeLocked(node.id),
          lockedBy: lock?.userName,
          isExecuting: executingNodes.has(node.id), // Visual execution flow
        },
      };
    });

    const flowEdges: Edge[] = saiScript.connections.map((conn) => ({
      id: conn.id,
      source: conn.source,
      target: conn.target,
      type: 'custom',
      data: {
        animated: true,
        status: 'active' as const,
        executionCount: 0,
        label: conn.type === 'link' ? 'Link' : undefined,
      },
    }));

    // Generate link edges from node.link field (visual representation of event chains)
    const linkEdges: Edge[] = saiScript.nodes
      .filter((node) => node.type === 'event' && node.link && node.link > 0)
      .map((node) => {
        // Find target node by link ID
        const targetNode = saiScript.nodes.find((n) => {
          const nodeIdNum = parseInt(n.id.replace('event-', ''));
          return n.type === 'event' && nodeIdNum === node.link;
        });

        if (targetNode) {
          return {
            id: `link-${node.id}-${targetNode.id}`,
            source: node.id,
            target: targetNode.id,
            type: 'custom',
            data: {
              animated: true,
              status: 'active' as const,
              executionCount: 0,
              label: 'Link',
              isLinkEdge: true, // Mark as link edge for special styling
            },
          };
        }
        return null;
      })
      .filter((edge): edge is Edge => edge !== null);

    setNodes(flowNodes);
    setEdges([...flowEdges, ...linkEdges]);
  }, [setNodes, setEdges, getNodeLock, isNodeLocked, executingNodes]);

  // Convert ReactFlow to SAI script
  const convertFromReactFlow = useCallback((): SAIScript => {
    const saiNodes: SAINodeType[] = nodes.map((node) => ({
      ...(node.data as SAINodeType),
      position: node.position,
    }));

    // Filter out link edges (generated automatically from node.link values)
    const saiConnections: SAIConnection[] = edges
      .filter((edge) => !(edge.data as any)?.isLinkEdge) // Exclude auto-generated link edges
      .map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: edge.animated ? 'link' : (edge.type === 'smoothstep' ? 'event-to-action' : 'action-to-target'),
      }));

    return {
      ...script,
      nodes: saiNodes,
      connections: saiConnections,
      metadata: {
        ...script.metadata,
        modifiedAt: Date.now(),
      },
    };
  }, [nodes, edges, script]);

  // Initialize ReactFlow from script
  useEffect(() => {
    convertToReactFlow(script);
  }, []);

  // Debounced validation function
  const runValidation = useDebouncedCallback(() => {
    const currentScript = convertFromReactFlow();
    const result = validateScript(currentScript);
    setValidation(result);
  }, 500); // 500ms debounce

  // Auto-validate on changes (debounced)
  useEffect(() => {
    runValidation();
  }, [nodes, edges, runValidation]);

  // Handle connection
  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => addEdge(connection, eds));
    },
    [setEdges]
  );

  // Handle node selection
  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    setSelectedNode(node.data as SAINodeType);
  }, []);

  // Track selection for collaboration
  useEffect(() => {
    const selectedIds = nodes.filter(n => n.selected).map(n => n.id);
    updateSelection(selectedIds);
  }, [nodes, updateSelection]);

  // Update node visualization when executingNodes changes
  useEffect(() => {
    setNodes((nds) =>
      nds.map((node) => ({
        ...node,
        data: {
          ...node.data,
          isExecuting: executingNodes.has(node.id),
        },
      }))
    );
  }, [executingNodes, setNodes]);

  // Handle execution event from simulator
  const handleExecutionEvent = useCallback((nodeId: string, duration: number = 300) => {
    // Highlight node during execution
    setExecutingNodes((prev) => new Set(prev).add(nodeId));

    // Remove highlight after duration
    setTimeout(() => {
      setExecutingNodes((prev) => {
        const next = new Set(prev);
        next.delete(nodeId);
        return next;
      });
    }, duration);
  }, []);

  // Add event node
  const handleAddEvent = useCallback(() => {
    const newNode: SAINodeType = {
      id: `event-${Date.now()}`,
      type: 'event',
      typeId: '0', // UPDATE_IC
      typeName: 'UPDATE_IC',
      label: 'Update In Combat',
      parameters: getParametersForEvent('0'),
      position: { x: 100, y: 100 + nodes.length * 50 },
    };

    setNodes((nds) => [
      ...nds,
      {
        id: newNode.id,
        type: 'saiNode',
        position: newNode.position,
        data: newNode,
      },
    ]);

    toast.success('Event node added');
  }, [nodes, setNodes]);

  // Add action node
  const handleAddAction = useCallback(() => {
    const newNode: SAINodeType = {
      id: `action-${Date.now()}`,
      type: 'action',
      typeId: '11', // CAST
      typeName: 'CAST',
      label: 'Cast Spell',
      parameters: getParametersForAction('11'),
      position: { x: 400, y: 100 + nodes.length * 50 },
    };

    setNodes((nds) => [
      ...nds,
      {
        id: newNode.id,
        type: 'saiNode',
        position: newNode.position,
        data: newNode,
      },
    ]);

    toast.success('Action node added');
  }, [nodes, setNodes]);

  // Add target node
  const handleAddTarget = useCallback(() => {
    const newNode: SAINodeType = {
      id: `target-${Date.now()}`,
      type: 'target',
      typeId: '2', // VICTIM
      typeName: 'VICTIM',
      label: 'Current Victim',
      parameters: getParametersForTarget('2'),
      position: { x: 700, y: 100 + nodes.length * 50 },
    };

    setNodes((nds) => [
      ...nds,
      {
        id: newNode.id,
        type: 'saiNode',
        position: newNode.position,
        data: newNode,
      },
    ]);

    toast.success('Target node added');
  }, [nodes, setNodes]);

  // Undo
  const handleUndo = useCallback(() => {
    const previousScript = historyManager.undo();
    if (previousScript) {
      setScript(previousScript);
      convertToReactFlow(previousScript);
      toast.success('Undo successful');
    }
  }, [historyManager, convertToReactFlow]);

  // Redo
  const handleRedo = useCallback(() => {
    const nextScript = historyManager.redo();
    if (nextScript) {
      setScript(nextScript);
      convertToReactFlow(nextScript);
      toast.success('Redo successful');
    }
  }, [historyManager, convertToReactFlow]);

  // Copy
  const handleCopy = useCallback(() => {
    const currentScript = convertFromReactFlow();
    const selectedIds = new Set(nodes.filter(n => n.selected).map(n => n.id));
    if (selectedIds.size === 0) {
      toast.error('No nodes selected');
      return;
    }

    const clip = copyNodes(selectedIds, currentScript);
    setClipboard(clip);
    toast.success(`Copied ${selectedIds.size} node(s)`);
  }, [nodes, convertFromReactFlow]);

  // Paste
  const handlePaste = useCallback(() => {
    if (!clipboard) {
      toast.error('Nothing to paste');
      return;
    }

    const currentScript = convertFromReactFlow();
    const { nodes: newNodes, connections: newConnections } = pasteNodes(clipboard, currentScript);

    // Add to ReactFlow
    const flowNodes: Node[] = newNodes.map((node) => ({
      id: node.id,
      type: 'saiNode',
      position: node.position,
      data: node,
    }));

    const flowEdges: Edge[] = newConnections.map((conn) => ({
      id: conn.id,
      source: conn.source,
      target: conn.target,
      type: 'smoothstep',
    }));

    setNodes((nds) => [...nds, ...flowNodes]);
    setEdges((eds) => [...eds, ...flowEdges]);

    toast.success(`Pasted ${newNodes.length} node(s)`);
  }, [clipboard, convertFromReactFlow, setNodes, setEdges]);

  // Cut
  const handleCut = useCallback(() => {
    handleCopy();
    const selectedIds = nodes.filter(n => n.selected).map(n => n.id);
    setNodes((nds) => nds.filter(n => !selectedIds.includes(n.id)));
    setEdges((eds) => eds.filter(e => !selectedIds.includes(e.source) && !selectedIds.includes(e.target)));
    toast.success(`Cut ${selectedIds.length} node(s)`);
  }, [nodes, handleCopy, setNodes, setEdges]);

  // Delete selected nodes and edges
  const handleDeleteSelected = useCallback(() => {
    const selectedNodeIds = nodes.filter(n => n.selected).map(n => n.id);
    const selectedEdgeIds = edges.filter(e => e.selected).map(e => e.id);

    if (selectedNodeIds.length === 0 && selectedEdgeIds.length === 0) {
      return;
    }

    // Record history before deletion
    historyManager.record(
      convertFromReactFlow(),
      `Delete ${selectedNodeIds.length} node(s) and ${selectedEdgeIds.length} edge(s)`,
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

    const totalDeleted = selectedNodeIds.length + selectedEdgeIds.length;
    toast.success(`Deleted ${selectedNodeIds.length} node(s) and ${totalDeleted} connection(s)`);
  }, [nodes, edges, setNodes, setEdges, convertFromReactFlow, historyManager]);

  // Delete specific node
  const handleDeleteNode = useCallback((nodeId: string) => {
    historyManager.record(convertFromReactFlow(), `Delete node ${nodeId}`, 'user');

    setNodes((nds) => nds.filter(n => n.id !== nodeId));
    setEdges((eds) => eds.filter(e => e.source !== nodeId && e.target !== nodeId));

    if (selectedNode?.id === nodeId) {
      setSelectedNode(null);
    }

    toast.success('Node deleted');
  }, [selectedNode, setNodes, setEdges, convertFromReactFlow, historyManager]);

  // Delete specific edge
  const handleDeleteEdge = useCallback((edgeId: string) => {
    historyManager.record(convertFromReactFlow(), `Delete edge ${edgeId}`, 'user');
    setEdges((eds) => eds.filter(e => e.id !== edgeId));
    toast.success('Connection deleted');
  }, [setEdges, convertFromReactFlow, historyManager]);

  // Duplicate node
  const handleDuplicateNode = useCallback((nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;

    const nodeData = node.data as SAINodeType;
    const newNode: SAINodeType = {
      ...nodeData,
      id: `${nodeData.type}-${Date.now()}`,
      position: {
        x: node.position.x + 50,
        y: node.position.y + 50,
      },
    };

    setNodes((nds) => [
      ...nds,
      {
        id: newNode.id,
        type: 'saiNode',
        position: newNode.position,
        data: newNode,
      },
    ]);

    toast.success('Node duplicated');
  }, [nodes, setNodes]);

  // Keyboard event handler
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Check if user is typing in an input field
      const activeElement = document.activeElement;
      const isTyping = activeElement?.tagName === 'INPUT' ||
                       activeElement?.tagName === 'TEXTAREA' ||
                       activeElement?.tagName === 'SELECT';

      // DELETE or BACKSPACE key
      if ((event.key === 'Delete' || event.key === 'Backspace') && !isTyping) {
        event.preventDefault();
        handleDeleteSelected();
      }

      // Ctrl+A - Select all
      if (event.ctrlKey && event.key === 'a' && !isTyping) {
        event.preventDefault();
        setNodes((nds) => nds.map(n => ({ ...n, selected: true })));
        setEdges((eds) => eds.map(e => ({ ...e, selected: true })));
        toast.info('All nodes selected');
      }

      // Ctrl+D - Duplicate
      if (event.ctrlKey && event.key === 'd' && !isTyping) {
        event.preventDefault();
        const selectedNodeIds = nodes.filter(n => n.selected).map(n => n.id);
        if (selectedNodeIds.length === 1) {
          handleDuplicateNode(selectedNodeIds[0]);
        } else if (selectedNodeIds.length > 1) {
          toast.error('Can only duplicate one node at a time');
        }
      }

      // Ctrl+S - Save
      if (event.ctrlKey && event.key === 's' && !isTyping) {
        event.preventDefault();
        if (onSave) {
          handleSave();
        }
      }

      // Ctrl+E - Export SQL
      if (event.ctrlKey && event.key === 'e' && !isTyping) {
        event.preventDefault();
        handleExportSQL();
      }

      // Ctrl+L - Auto layout
      if (event.ctrlKey && event.key === 'l' && !isTyping) {
        event.preventDefault();
        handleAutoLayout();
      }

      // Escape - Deselect all
      if (event.key === 'Escape') {
        setNodes((nds) => nds.map(n => ({ ...n, selected: false })));
        setEdges((eds) => eds.map(e => ({ ...e, selected: false })));
        setSelectedNode(null);
      }

      // Enter - Edit selected node
      if (event.key === 'Enter' && !isTyping) {
        const selectedNodes = nodes.filter(n => n.selected);
        if (selectedNodes.length === 1) {
          setSelectedNode(selectedNodes[0].data as SAINodeType);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nodes, edges, setNodes, setEdges, handleDeleteSelected, handleDuplicateNode, handleSave, handleExportSQL, handleAutoLayout, onSave]);

  // Auto layout
  const handleAutoLayout = useCallback(() => {
    const currentScript = convertFromReactFlow();
    const layoutedScript = autoLayout(currentScript);
    convertToReactFlow(layoutedScript);
    toast.success('Layout applied');
  }, [convertFromReactFlow, convertToReactFlow]);

  // Export SQL
  const handleExportSQL = useCallback(() => {
    const currentScript = convertFromReactFlow();
    const sql = generateSQL(currentScript);

    // Add to SQL history
    sqlHistoryManager.addEntry(sql, currentScript, 'Manual SQL export');

    // Download as file
    const blob = new Blob([sql], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sai_${currentScript.entryOrGuid}_${Date.now()}.sql`;
    a.click();
    URL.revokeObjectURL(url);

    if (onExport) {
      onExport(sql);
    }

    toast.success('SQL exported');
  }, [convertFromReactFlow, onExport, sqlHistoryManager]);

  // Restore from SQL history
  const handleRestoreFromHistory = useCallback((restoredScript: SAIScript) => {
    setScript(restoredScript);
    convertToReactFlow(restoredScript);
    toast.success('Restored from history');
  }, [convertToReactFlow]);

  // Import SQL
  const handleImportSQL = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.sql';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (e) => {
        const sql = e.target?.result as string;
        const imported = parseSQL(sql);
        if (imported) {
          setScript(imported);
          convertToReactFlow(imported);
          toast.success('SQL imported successfully');
        } else {
          toast.error('Failed to parse SQL');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }, [convertToReactFlow]);

  // Export JSON
  const handleExportJSON = useCallback(() => {
    const currentScript = convertFromReactFlow();
    const json = JSON.stringify(currentScript, null, 2);

    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sai_${currentScript.entryOrGuid}_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);

    toast.success('JSON exported');
  }, [convertFromReactFlow]);

  // Apply template
  const handleApplyTemplate = useCallback((template: SAITemplate, placeholders: Record<string, any>) => {
    const instantiated = instantiateTemplate(template, placeholders, { entryOrGuid: script.entryOrGuid });
    setScript(instantiated);
    convertToReactFlow(instantiated);
    setShowTemplates(false);
    toast.success(`Template "${template.name}" applied`);
  }, [script.entryOrGuid, convertToReactFlow]);

  // Save
  const handleSave = useCallback(() => {
    const currentScript = convertFromReactFlow();
    if (onSave) {
      onSave(currentScript);
      toast.success('Script saved');
    }
  }, [convertFromReactFlow, onSave]);

  // Context menu handlers
  const onNodeContextMenu = useCallback((event: React.MouseEvent, node: Node) => {
    event.preventDefault();
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      type: 'node',
      target: node,
    });
  }, []);

  const onEdgeContextMenu = useCallback((event: React.MouseEvent, edge: Edge) => {
    event.preventDefault();
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      type: 'edge',
      target: edge,
    });
  }, []);

  const onPaneContextMenu = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      type: 'canvas',
    });
  }, []);

  // Get context menu items based on type
  const getContextMenuItems = useCallback((): ContextMenuItem[] => {
    if (!contextMenu) return [];

    switch (contextMenu.type) {
      case 'node':
        return [
          {
            label: 'Edit Properties',
            icon: <Edit className="w-4 h-4" />,
            onClick: () => setSelectedNode(contextMenu.target.data),
            shortcut: 'Enter',
          },
          {
            label: 'Duplicate',
            icon: <Copy className="w-4 h-4" />,
            onClick: () => handleDuplicateNode(contextMenu.target.id),
            shortcut: 'Ctrl+D',
          },
          { separator: true },
          {
            label: 'Copy',
            icon: <Copy className="w-4 h-4" />,
            onClick: () => {
              // Select this node and copy
              setNodes((nds) => nds.map(n => ({ ...n, selected: n.id === contextMenu.target.id })));
              setTimeout(handleCopy, 50);
            },
            shortcut: 'Ctrl+C',
          },
          {
            label: 'Cut',
            icon: <Scissors className="w-4 h-4" />,
            onClick: () => {
              // Select this node and cut
              setNodes((nds) => nds.map(n => ({ ...n, selected: n.id === contextMenu.target.id })));
              setTimeout(handleCut, 50);
            },
            shortcut: 'Ctrl+X',
          },
          { separator: true },
          {
            label: 'Delete',
            icon: <Trash2 className="w-4 h-4" />,
            onClick: () => handleDeleteNode(contextMenu.target.id),
            shortcut: 'Delete',
            variant: 'danger' as const,
          },
        ];

      case 'edge':
        return [
          {
            label: 'Delete Connection',
            icon: <Unlink className="w-4 h-4" />,
            onClick: () => handleDeleteEdge(contextMenu.target.id),
            variant: 'danger' as const,
          },
        ];

      case 'canvas':
        return [
          {
            label: 'Add Event',
            icon: <Plus className="w-4 h-4" />,
            onClick: handleAddEvent,
          },
          {
            label: 'Add Action',
            icon: <Plus className="w-4 h-4" />,
            onClick: handleAddAction,
          },
          {
            label: 'Add Target',
            icon: <Plus className="w-4 h-4" />,
            onClick: handleAddTarget,
          },
          { separator: true },
          {
            label: 'Paste',
            icon: <Copy className="w-4 h-4" />,
            onClick: handlePaste,
            disabled: !clipboard,
            shortcut: 'Ctrl+V',
          },
          { separator: true },
          {
            label: 'Select All',
            onClick: () => {
              setNodes((nds) => nds.map(n => ({ ...n, selected: true })));
              setEdges((eds) => eds.map(e => ({ ...e, selected: true })));
            },
            shortcut: 'Ctrl+A',
          },
          {
            label: 'Auto Layout',
            icon: <Layers className="w-4 h-4" />,
            onClick: handleAutoLayout,
            shortcut: 'Ctrl+L',
          },
        ];

      default:
        return [];
    }
  }, [
    contextMenu,
    handleCopy,
    handleCut,
    handlePaste,
    handleAutoLayout,
    handleDeleteNode,
    handleDeleteEdge,
    handleDuplicateNode,
    handleAddEvent,
    handleAddAction,
    handleAddTarget,
    clipboard,
    setNodes,
    setEdges,
  ]);

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-950">
      {/* Toolbar */}
      <EditorToolbar
        canUndo={historyManager.canUndo()}
        canRedo={historyManager.canRedo()}
        onUndo={handleUndo}
        onRedo={handleRedo}
        canPaste={clipboard !== null}
        onCopy={handleCopy}
        onPaste={handlePaste}
        onCut={handleCut}
        onDelete={handleDeleteSelected}
        hasSelection={nodes.some(n => n.selected) || edges.some(e => e.selected)}
        onAddEvent={handleAddEvent}
        onAddAction={handleAddAction}
        onAddTarget={handleAddTarget}
        onAutoLayout={handleAutoLayout}
        onExportSQL={handleExportSQL}
        onImportSQL={handleImportSQL}
        onExportJSON={handleExportJSON}
        validationScore={validation?.score}
        onValidate={() => {}}
        onSave={onSave ? handleSave : undefined}
      />

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* ReactFlow Canvas */}
        <div className="flex-1">
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
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            connectionMode={ConnectionMode.Loose}
            defaultEdgeOptions={{
              type: 'custom',
              animated: true,
            }}
            fitView
          >
            <Background variant={BackgroundVariant.Dots} />
            <Controls />
            <EnhancedMiniMap />
            <PresenceIndicator showPanel={true} />
            <Panel position="top-right">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowTemplates(!showTemplates)}
              >
                Templates
              </Button>
            </Panel>
          </ReactFlow>
        </div>

        {/* Right Sidebar */}
        <div className="w-96 border-l border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden flex flex-col">
          <Tabs defaultValue="properties" className="flex-1 flex flex-col">
            <TabsList className="grid w-full grid-cols-8 rounded-none border-b text-xs">
              <TabsTrigger value="properties">Properties</TabsTrigger>
              <TabsTrigger value="validation">Validation</TabsTrigger>
              <TabsTrigger value="templates">Templates</TabsTrigger>
              <TabsTrigger value="ai">AI</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
              <TabsTrigger value="simulator">Simulator</TabsTrigger>
              <TabsTrigger value="performance">Performance</TabsTrigger>
              <TabsTrigger value="shortcuts">Shortcuts</TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-auto">
              <TabsContent value="properties" className="p-4 m-0">
                {selectedNode ? (
                  <NodeEditor
                    node={selectedNode}
                    allEventNodes={nodes.map(n => n.data as SAINodeType).filter(n => n.type === 'event')}
                    onChange={(updatedNode) => {
                      setSelectedNode(updatedNode);
                      setNodes((nds) =>
                        nds.map((n) =>
                          n.id === selectedNode.id ? { ...n, data: updatedNode } : n
                        )
                      );
                    }}
                  />
                ) : (
                  <div className="text-center text-gray-500 dark:text-gray-400 py-12">
                    Select a node to edit properties
                  </div>
                )}
              </TabsContent>

              <TabsContent value="validation" className="p-4 m-0">
                <ValidationPanel
                  validation={validation}
                  onNodeClick={(nodeId) => {
                    const node = nodes.find(n => n.id === nodeId);
                    if (node) {
                      setSelectedNode(node.data as SAINodeType);
                    }
                  }}
                />
              </TabsContent>

              <TabsContent value="templates" className="p-4 m-0">
                <TemplateLibrary onApplyTemplate={handleApplyTemplate} />
              </TabsContent>

              <TabsContent value="ai" className="p-4 m-0">
                <AIGenerationPanel
                  onGenerate={(generatedScript) => {
                    setScript(generatedScript);
                    convertToReactFlow(generatedScript);
                    toast.success('AI-generated script applied');
                  }}
                />
              </TabsContent>

              <TabsContent value="history" className="p-0 m-0 h-full">
                <SQLHistoryPanel
                  historyManager={sqlHistoryManager}
                  onRestore={handleRestoreFromHistory}
                />
              </TabsContent>

              <TabsContent value="simulator" className="p-0 m-0 h-full">
                <SimulatorPanel script={script} onExecutionEvent={handleExecutionEvent} />
              </TabsContent>

              <TabsContent value="performance" className="p-4 m-0">
                <PerformanceMonitor
                  script={script}
                  nodes={nodes}
                  onNodeClick={(nodeId) => {
                    const node = nodes.find(n => n.id === nodeId);
                    if (node) {
                      setSelectedNode(node.data as SAINodeType);
                    }
                  }}
                />
              </TabsContent>

              <TabsContent value="shortcuts" className="p-4 m-0">
                <KeyboardShortcutsPanel />
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={getContextMenuItems()}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
};

// Wrap with CollaborationProvider
export const SAIEditor: React.FC<SAIEditorProps> = (props) => {
  return (
    <CollaborationProvider roomId={props.initialScript?.id}>
      <SAIEditorInner {...props} />
    </CollaborationProvider>
  );
};

export default SAIEditor;
