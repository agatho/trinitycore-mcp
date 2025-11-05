'use client';

import React, { useState, useCallback, useEffect } from 'react';
import ReactFlow, {
  Node,
  Edge,
  addEdge,
  Connection,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  MiniMap,
  NodeProps,
  Handle,
  Position,
} from 'reactflow';
import 'reactflow/dist/style.css';
import {
  Zap,
  Download,
  Save,
  Plus,
  Trash2,
  Copy,
  Scissors,
  Clipboard,
  Undo2,
  Redo2,
  Search,
  CheckCircle,
  AlertCircle,
  FileJson,
  Upload,
  Play,
  Grid3x3,
  Lightbulb,
  Settings,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  SAI_EVENT_TYPES_COMPLETE,
  SAI_ACTION_TYPES_COMPLETE,
  SAI_TARGET_TYPES_COMPLETE,
} from '@/lib/sai-editor-complete';
import {
  SAINode,
  SAIScript,
  SAIConnection,
  SAIParameter,
  getParametersForEvent,
  getParametersForAction,
  getParametersForTarget,
  validateScript,
  suggestActions,
  suggestTargets,
  generateSQL,
  parseSQL,
  SAI_TEMPLATE_LIBRARY,
  autoLayout,
  copyNodes,
  pasteNodes,
  Clipboard as ClipboardType,
} from '@/lib/sai-editor-enhanced';

// Custom node components
function EventNode({ data, selected }: NodeProps) {
  return (
    <div
      className={`px-4 py-3 shadow-lg rounded-lg bg-blue-600 border-2 ${
        selected ? 'border-blue-300' : 'border-blue-700'
      } min-w-[200px]`}
    >
      <Handle type="source" position={Position.Right} className="w-3 h-3 bg-blue-300" />
      <div className="text-white">
        <div className="text-xs font-semibold mb-1">EVENT</div>
        <div className="text-sm font-bold">{data.label}</div>
        {data.phase && (
          <div className="text-xs mt-1 bg-blue-700 px-2 py-0.5 rounded inline-block">
            Phase {data.phase}
          </div>
        )}
        {data.chance && data.chance < 100 && (
          <div className="text-xs mt-1 bg-blue-700 px-2 py-0.5 rounded inline-block ml-1">
            {data.chance}%
          </div>
        )}
      </div>
    </div>
  );
}

function ActionNode({ data, selected }: NodeProps) {
  return (
    <div
      className={`px-4 py-3 shadow-lg rounded-lg bg-green-600 border-2 ${
        selected ? 'border-green-300' : 'border-green-700'
      } min-w-[200px]`}
    >
      <Handle type="target" position={Position.Left} className="w-3 h-3 bg-green-300" />
      <Handle type="source" position={Position.Right} className="w-3 h-3 bg-green-300" />
      <div className="text-white">
        <div className="text-xs font-semibold mb-1">ACTION</div>
        <div className="text-sm font-bold">{data.label}</div>
        {data.description && <div className="text-xs mt-1 opacity-80">{data.description}</div>}
      </div>
    </div>
  );
}

function TargetNode({ data, selected }: NodeProps) {
  return (
    <div
      className={`px-4 py-3 shadow-lg rounded-lg bg-amber-600 border-2 ${
        selected ? 'border-amber-300' : 'border-amber-700'
      } min-w-[200px]`}
    >
      <Handle type="target" position={Position.Left} className="w-3 h-3 bg-amber-300" />
      <div className="text-white">
        <div className="text-xs font-semibold mb-1">TARGET</div>
        <div className="text-sm font-bold">{data.label}</div>
        {data.description && <div className="text-xs mt-1 opacity-80">{data.description}</div>}
      </div>
    </div>
  );
}

const nodeTypes = {
  event: EventNode,
  action: ActionNode,
  target: TargetNode,
};

export default function EnhancedSAIEditorPage() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [scripts, setScripts] = useState<SAIScript[]>([]);
  const [currentScript, setCurrentScript] = useState<SAIScript | null>(null);
  const [selectedNode, setSelectedNode] = useState<SAINode | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [clipboard, setClipboard] = useState<ClipboardType | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [validationResult, setValidationResult] = useState<any>(null);
  const [suggestions, setSuggestions] = useState<any>(null);

  // Script metadata
  const [scriptName, setScriptName] = useState('New SAI Script');
  const [entryOrGuid, setEntryOrGuid] = useState(0);
  const [sourceType, setSourceType] = useState(0);

  // Save state to history
  const saveHistory = useCallback(() => {
    const state = {
      nodes,
      edges,
      selectedNode,
    };
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(state);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }, [nodes, edges, selectedNode, history, historyIndex]);

  // Undo/Redo
  const handleUndo = () => {
    if (historyIndex > 0) {
      const prevState = history[historyIndex - 1];
      setNodes(prevState.nodes);
      setEdges(prevState.edges);
      setSelectedNode(prevState.selectedNode);
      setHistoryIndex(historyIndex - 1);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const nextState = history[historyIndex + 1];
      setNodes(nextState.nodes);
      setEdges(nextState.edges);
      setSelectedNode(nextState.selectedNode);
      setHistoryIndex(historyIndex + 1);
    }
  };

  const onConnect = useCallback(
    (params: Connection) => {
      saveHistory();
      setEdges(eds => addEdge(params, eds));
    },
    [setEdges, saveHistory]
  );

  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    const saiNode = node.data as SAINode;
    setSelectedNode(saiNode);

    // Generate suggestions based on node type
    if (saiNode.type === 'event') {
      const actionSuggestions = suggestActions(saiNode.typeId);
      setSuggestions(actionSuggestions);
    } else if (saiNode.type === 'action') {
      const targetSuggestions = suggestTargets(saiNode.typeId);
      setSuggestions(targetSuggestions);
    }
  }, []);

  // Add nodes
  const addEventNode = () => {
    saveHistory();

    const eventType = SAI_EVENT_TYPES_COMPLETE[0];
    const parameters = getParametersForEvent(eventType.id);

    const newNode: SAINode = {
      id: `event-${Date.now()}`,
      type: 'event',
      typeId: eventType.id,
      typeName: eventType.name,
      label: eventType.label,
      parameters,
      position: { x: 100, y: 100 + nodes.filter(n => n.type === 'event').length * 120 },
    };

    const reactFlowNode: Node = {
      id: newNode.id,
      type: 'event',
      position: newNode.position,
      data: newNode,
    };

    setNodes(nds => [...nds, reactFlowNode]);
  };

  const addActionNode = () => {
    saveHistory();

    const actionType = SAI_ACTION_TYPES_COMPLETE[1];
    const parameters = getParametersForAction(actionType.id);

    const newNode: SAINode = {
      id: `action-${Date.now()}`,
      type: 'action',
      typeId: actionType.id,
      typeName: actionType.name,
      label: actionType.label,
      parameters,
      position: { x: 400, y: 100 + nodes.filter(n => n.type === 'action').length * 120 },
    };

    const reactFlowNode: Node = {
      id: newNode.id,
      type: 'action',
      position: newNode.position,
      data: newNode,
    };

    setNodes(nds => [...nds, reactFlowNode]);
  };

  const addTargetNode = () => {
    saveHistory();

    const targetType = SAI_TARGET_TYPES_COMPLETE[2];
    const parameters = getParametersForTarget(targetType.id);

    const newNode: SAINode = {
      id: `target-${Date.now()}`,
      type: 'target',
      typeId: targetType.id,
      typeName: targetType.name,
      label: targetType.label,
      parameters,
      position: { x: 700, y: 100 + nodes.filter(n => n.type === 'target').length * 120 },
    };

    const reactFlowNode: Node = {
      id: newNode.id,
      type: 'target',
      position: newNode.position,
      data: newNode,
    };

    setNodes(nds => [...nds, reactFlowNode]);
  };

  // Delete selected nodes
  const handleDelete = () => {
    const selectedNodes = nodes.filter(n => n.selected);
    if (selectedNodes.length === 0) return;

    saveHistory();

    const selectedIds = new Set(selectedNodes.map(n => n.id));
    setNodes(nds => nds.filter(n => !selectedIds.has(n.id)));
    setEdges(eds => eds.filter(e => !selectedIds.has(e.source) && !selectedIds.has(e.target)));
    setSelectedNode(null);
  };

  // Copy/Paste
  const handleCopy = () => {
    const selectedIds = new Set(nodes.filter(n => n.selected).map(n => n.id));
    if (selectedIds.size === 0) return;

    const script: SAIScript = {
      id: 'temp',
      name: 'temp',
      entryOrGuid: 0,
      sourceType: 0,
      nodes: nodes.filter(n => selectedIds.has(n.id)).map(n => n.data as SAINode),
      connections: edges
        .filter(e => selectedIds.has(e.source) && selectedIds.has(e.target))
        .map(e => ({
          id: e.id,
          source: e.source,
          target: e.target,
          type: 'event-to-action' as const,
        })),
      metadata: {
        createdAt: Date.now(),
        modifiedAt: Date.now(),
      },
    };

    const copied = copyNodes(selectedIds, script);
    setClipboard(copied);
  };

  const handlePaste = () => {
    if (!clipboard) return;

    saveHistory();

    const pasted = pasteNodes(clipboard, { x: 50, y: 50 });

    // Convert to ReactFlow nodes
    const newNodes = pasted.nodes.map(n => ({
      id: n.id,
      type: n.type,
      position: n.position,
      data: n,
    }));

    const newEdges = pasted.connections.map(c => ({
      id: c.id,
      source: c.source,
      target: c.target,
      animated: true,
    }));

    setNodes(nds => [...nds, ...newNodes]);
    setEdges(eds => [...eds, ...newEdges]);
  };

  // Load template
  const loadTemplate = (templateId: string) => {
    saveHistory();

    const template = SAI_TEMPLATE_LIBRARY.find(t => t.id === templateId);
    if (!template) return;

    // Clear current nodes
    setNodes([]);
    setEdges([]);

    // Create nodes based on template (simplified)
    const eventNode: Node = {
      id: 'event-1',
      type: 'event',
      position: { x: 50, y: 150 },
      data: {
        id: 'event-1',
        type: 'event',
        typeId: '0',
        typeName: 'UPDATE_IC',
        label: 'Update In Combat',
        parameters: getParametersForEvent('0'),
        position: { x: 50, y: 150 },
      },
    };

    const actionNode: Node = {
      id: 'action-1',
      type: 'action',
      position: { x: 350, y: 150 },
      data: {
        id: 'action-1',
        type: 'action',
        typeId: '11',
        typeName: 'CAST',
        label: 'Cast Spell',
        parameters: getParametersForAction('11'),
        position: { x: 350, y: 150 },
      },
    };

    const targetNode: Node = {
      id: 'target-1',
      type: 'target',
      position: { x: 650, y: 150 },
      data: {
        id: 'target-1',
        type: 'target',
        typeId: '2',
        typeName: 'VICTIM',
        label: 'Current Victim',
        parameters: getParametersForTarget('2'),
        position: { x: 650, y: 150 },
      },
    };

    setNodes([eventNode, actionNode, targetNode]);
    setEdges([
      { id: 'e1-a1', source: 'event-1', target: 'action-1', animated: true },
      { id: 'a1-t1', source: 'action-1', target: 'target-1', animated: true },
    ]);
  };

  // Auto-layout
  const handleAutoLayout = () => {
    saveHistory();

    const saiNodes = nodes.map(n => n.data as SAINode);
    const connections = edges.map(e => ({
      id: e.id,
      source: e.source,
      target: e.target,
      type: 'event-to-action' as const,
    }));

    const layouted = autoLayout(saiNodes, connections);

    const newNodes = nodes.map(n => {
      const updated = layouted.find(ln => ln.id === n.id);
      return updated ? { ...n, position: updated.position } : n;
    });

    setNodes(newNodes);
  };

  // Validate script
  const handleValidate = () => {
    const saiNodes = nodes.map(n => n.data as SAINode);
    const connections = edges.map(e => ({
      id: e.id,
      source: e.source,
      target: e.target,
      type: 'event-to-action' as const,
    }));

    const script: SAIScript = {
      id: 'current',
      name: scriptName,
      entryOrGuid,
      sourceType,
      nodes: saiNodes,
      connections,
      metadata: {
        createdAt: Date.now(),
        modifiedAt: Date.now(),
      },
    };

    const result = validateScript(script);
    setValidationResult(result);
  };

  // Export SQL
  const exportSQL = () => {
    const saiNodes = nodes.map(n => n.data as SAINode);
    const connections = edges.map(e => ({
      id: e.id,
      source: e.source,
      target: e.target,
      type: 'event-to-action' as const,
    }));

    const script: SAIScript = {
      id: 'export',
      name: scriptName,
      entryOrGuid,
      sourceType,
      nodes: saiNodes,
      connections,
      metadata: {
        createdAt: Date.now(),
        modifiedAt: Date.now(),
      },
    };

    const sql = generateSQL(script);
    const blob = new Blob([sql], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sai_${entryOrGuid}_${Date.now()}.sql`;
    a.click();
  };

  // Export JSON
  const exportJSON = () => {
    const saiNodes = nodes.map(n => n.data as SAINode);
    const connections = edges.map(e => ({
      id: e.id,
      source: e.source,
      target: e.target,
      type: 'event-to-action' as const,
    }));

    const script: SAIScript = {
      id: 'export',
      name: scriptName,
      entryOrGuid,
      sourceType,
      nodes: saiNodes,
      connections,
      metadata: {
        createdAt: Date.now(),
        modifiedAt: Date.now(),
      },
    };

    const json = JSON.stringify(script, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sai_${entryOrGuid}_${Date.now()}.json`;
    a.click();
  };

  // Update selected node
  const updateSelectedNode = (updates: Partial<SAINode>) => {
    if (!selectedNode) return;

    saveHistory();

    const updatedNode = { ...selectedNode, ...updates };
    setSelectedNode(updatedNode);

    setNodes(nds =>
      nds.map(n => (n.id === selectedNode.id ? { ...n, data: updatedNode } : n))
    );
  };

  // Update parameter value
  const updateParameter = (paramIndex: number, value: any) => {
    if (!selectedNode) return;

    const updatedParams = [...selectedNode.parameters];
    updatedParams[paramIndex] = { ...updatedParams[paramIndex], value };

    updateSelectedNode({ parameters: updatedParams });
  };

  // Change node type
  const changeNodeType = (newTypeId: string) => {
    if (!selectedNode) return;

    saveHistory();

    let newParams: SAIParameter[] = [];
    let newType: any = null;

    if (selectedNode.type === 'event') {
      newType = SAI_EVENT_TYPES_COMPLETE.find(e => e.id === newTypeId);
      newParams = getParametersForEvent(newTypeId);
    } else if (selectedNode.type === 'action') {
      newType = SAI_ACTION_TYPES_COMPLETE.find(a => a.id === newTypeId);
      newParams = getParametersForAction(newTypeId);
    } else if (selectedNode.type === 'target') {
      newType = SAI_TARGET_TYPES_COMPLETE.find(t => t.id === newTypeId);
      newParams = getParametersForTarget(newTypeId);
    }

    if (newType) {
      updateSelectedNode({
        typeId: newType.id,
        typeName: newType.name,
        label: newType.label,
        parameters: newParams,
      });
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z' && !e.shiftKey) {
          e.preventDefault();
          handleUndo();
        } else if (e.key === 'z' && e.shiftKey) {
          e.preventDefault();
          handleRedo();
        } else if (e.key === 'y') {
          e.preventDefault();
          handleRedo();
        } else if (e.key === 'c') {
          e.preventDefault();
          handleCopy();
        } else if (e.key === 'v') {
          e.preventDefault();
          handlePaste();
        } else if (e.key === 's') {
          e.preventDefault();
          exportSQL();
        }
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        handleDelete();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nodes, edges, selectedNode, historyIndex, clipboard]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8">
      <div className="max-w-[1800px] mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Zap className="w-8 h-8 text-blue-400" />
              <div>
                <h1 className="text-3xl font-bold text-white">Enhanced SAI Editor</h1>
                <p className="text-slate-400">
                  Professional Smart AI editor with full parameter editing, validation, and suggestions
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleUndo} disabled={historyIndex <= 0}>
                <Undo2 className="w-4 h-4 mr-2" />
                Undo
              </Button>
              <Button variant="outline" onClick={handleRedo} disabled={historyIndex >= history.length - 1}>
                <Redo2 className="w-4 h-4 mr-2" />
                Redo
              </Button>
              <Button variant="outline" onClick={handleValidate}>
                <CheckCircle className="w-4 h-4 mr-2" />
                Validate
              </Button>
              <Button variant="outline" onClick={exportSQL}>
                <Download className="w-4 h-4 mr-2" />
                Export SQL
              </Button>
              <Button variant="outline" onClick={exportJSON}>
                <Save className="w-4 h-4 mr-2" />
                Export JSON
              </Button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-[280px_1fr_380px] gap-6">
          {/* Left Sidebar - Tools & Templates */}
          <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-lg p-4 space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">Add Nodes</h3>
              <div className="space-y-2">
                <Button
                  variant="outline"
                  className="w-full justify-start bg-blue-600 hover:bg-blue-700 text-white"
                  onClick={addEventNode}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Event Node
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start bg-green-600 hover:bg-green-700 text-white"
                  onClick={addActionNode}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Action Node
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start bg-amber-600 hover:bg-amber-700 text-white"
                  onClick={addTargetNode}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Target Node
                </Button>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-700">
              <h3 className="text-sm font-semibold text-white mb-3">Script Info</h3>
              <div className="space-y-3">
                <div>
                  <Label className="text-sm text-slate-300">Script Name</Label>
                  <Input
                    value={scriptName}
                    onChange={e => setScriptName(e.target.value)}
                    className="mt-1"
                    placeholder="My SAI Script"
                  />
                </div>
                <div>
                  <Label className="text-sm text-slate-300">Entry/GUID</Label>
                  <Input
                    type="number"
                    value={entryOrGuid}
                    onChange={e => setEntryOrGuid(parseInt(e.target.value) || 0)}
                    className="mt-1"
                    placeholder="12345"
                  />
                </div>
                <div>
                  <Label className="text-sm text-slate-300">Source Type</Label>
                  <Select value={String(sourceType)} onValueChange={v => setSourceType(parseInt(v))}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">Creature (0)</SelectItem>
                      <SelectItem value="1">GameObject (1)</SelectItem>
                      <SelectItem value="2">AreaTrigger (2)</SelectItem>
                      <SelectItem value="9">Timed Actionlist (9)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-700">
              <h3 className="text-sm font-semibold text-white mb-3">Templates</h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {SAI_TEMPLATE_LIBRARY.map(template => (
                  <Button
                    key={template.id}
                    variant="outline"
                    className="w-full justify-start text-left"
                    onClick={() => loadTemplate(template.id)}
                  >
                    <div>
                      <div className="font-semibold text-sm">{template.name}</div>
                      <div className="text-xs text-slate-400">{template.description}</div>
                    </div>
                  </Button>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-slate-700">
              <h3 className="text-sm font-semibold text-white mb-3">Tools</h3>
              <div className="space-y-2">
                <Button variant="outline" className="w-full justify-start" onClick={handleAutoLayout}>
                  <Grid3x3 className="w-4 h-4 mr-2" />
                  Auto Layout
                </Button>
                <Button variant="outline" className="w-full justify-start" onClick={handleCopy}>
                  <Copy className="w-4 h-4 mr-2" />
                  Copy (Ctrl+C)
                </Button>
                <Button variant="outline" className="w-full justify-start" onClick={handlePaste} disabled={!clipboard}>
                  <Clipboard className="w-4 h-4 mr-2" />
                  Paste (Ctrl+V)
                </Button>
                <Button variant="outline" className="w-full justify-start text-red-400" onClick={handleDelete}>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete (Del)
                </Button>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-700">
              <h3 className="text-sm font-semibold text-white mb-2">Stats</h3>
              <div className="space-y-1 text-sm text-slate-400">
                <div>Events: {nodes.filter(n => n.type === 'event').length}</div>
                <div>Actions: {nodes.filter(n => n.type === 'action').length}</div>
                <div>Targets: {nodes.filter(n => n.type === 'target').length}</div>
                <div>Connections: {edges.length}</div>
              </div>
            </div>
          </div>

          {/* Center - Canvas */}
          <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-lg p-4" style={{ height: 700 }}>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onNodeClick={onNodeClick}
              nodeTypes={nodeTypes}
              fitView
            >
              <Controls />
              <Background color="#64748b" gap={16} />
              <MiniMap
                nodeColor={node => {
                  if (node.type === 'event') return '#3b82f6';
                  if (node.type === 'action') return '#10b981';
                  if (node.type === 'target') return '#f59e0b';
                  return '#64748b';
                }}
              />
            </ReactFlow>
          </div>

          {/* Right Sidebar - Properties */}
          <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-lg p-4">
            <Tabs defaultValue="properties">
              <TabsList className="grid grid-cols-3 mb-4">
                <TabsTrigger value="properties">Properties</TabsTrigger>
                <TabsTrigger value="validation">Validation</TabsTrigger>
                <TabsTrigger value="suggestions">Suggestions</TabsTrigger>
              </TabsList>

              <TabsContent value="properties" className="space-y-4 max-h-[600px] overflow-y-auto">
                {!selectedNode && (
                  <div className="text-center text-slate-400 text-sm py-8">
                    <Settings className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <div>Select a node to edit properties</div>
                  </div>
                )}

                {selectedNode && (
                  <>
                    <div>
                      <Label className="text-sm text-slate-300">Node Type</Label>
                      <Select value={selectedNode.typeId} onValueChange={changeNodeType}>
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="max-h-64">
                          {selectedNode.type === 'event' &&
                            SAI_EVENT_TYPES_COMPLETE.map(e => (
                              <SelectItem key={e.id} value={e.id}>
                                [{e.id}] {e.label}
                              </SelectItem>
                            ))}
                          {selectedNode.type === 'action' &&
                            SAI_ACTION_TYPES_COMPLETE.map(a => (
                              <SelectItem key={a.id} value={a.id}>
                                [{a.id}] {a.label}
                              </SelectItem>
                            ))}
                          {selectedNode.type === 'target' &&
                            SAI_TARGET_TYPES_COMPLETE.map(t => (
                              <SelectItem key={t.id} value={t.id}>
                                [{t.id}] {t.label}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {selectedNode.type === 'event' && (
                      <>
                        <div>
                          <Label className="text-sm text-slate-300">Phase</Label>
                          <Input
                            type="number"
                            value={selectedNode.phase || 0}
                            onChange={e => updateSelectedNode({ phase: parseInt(e.target.value) || 0 })}
                            className="mt-1"
                            placeholder="0"
                          />
                        </div>
                        <div>
                          <Label className="text-sm text-slate-300">Chance (%)</Label>
                          <Input
                            type="number"
                            value={selectedNode.chance || 100}
                            onChange={e =>
                              updateSelectedNode({
                                chance: Math.max(0, Math.min(100, parseInt(e.target.value) || 100)),
                              })
                            }
                            className="mt-1"
                            min={0}
                            max={100}
                            placeholder="100"
                          />
                        </div>
                        <div>
                          <Label className="text-sm text-slate-300">Flags</Label>
                          <Input
                            type="number"
                            value={selectedNode.flags || 0}
                            onChange={e => updateSelectedNode({ flags: parseInt(e.target.value) || 0 })}
                            className="mt-1"
                            placeholder="0"
                          />
                        </div>
                      </>
                    )}

                    <div className="pt-4 border-t border-slate-700">
                      <h3 className="text-sm font-semibold text-white mb-3">Parameters</h3>
                      <div className="space-y-3">
                        {selectedNode.parameters.map((param, idx) => (
                          <div key={idx}>
                            <Label className="text-sm text-slate-300">
                              {param.name}
                              {param.description && (
                                <span className="text-xs text-slate-500 ml-1">- {param.description}</span>
                              )}
                            </Label>
                            {param.options ? (
                              <Select value={String(param.value)} onValueChange={v => updateParameter(idx, parseInt(v))}>
                                <SelectTrigger className="mt-1">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {param.options.map(opt => (
                                    <SelectItem key={opt.value} value={String(opt.value)}>
                                      {opt.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <Input
                                type={param.type === 'number' || param.type.includes('id') ? 'number' : 'text'}
                                value={param.value}
                                onChange={e => {
                                  const val = param.type === 'number' || param.type.includes('id')
                                    ? parseInt(e.target.value) || 0
                                    : e.target.value;
                                  updateParameter(idx, val);
                                }}
                                className="mt-1"
                                min={param.min}
                                max={param.max}
                                placeholder={String(param.value)}
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </TabsContent>

              <TabsContent value="validation" className="max-h-[600px] overflow-y-auto">
                {!validationResult && (
                  <div className="text-center text-slate-400 text-sm py-8">
                    <CheckCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <div>Click Validate to check for issues</div>
                  </div>
                )}

                {validationResult && validationResult.valid && (
                  <div className="bg-green-500/10 border border-green-500 rounded p-4 text-center">
                    <CheckCircle className="w-8 h-8 mx-auto text-green-500 mb-2" />
                    <div className="text-green-400 font-semibold">No issues found!</div>
                  </div>
                )}

                {validationResult && validationResult.errors.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-red-400">Errors</h3>
                    {validationResult.errors.map((error: any, idx: number) => (
                      <div key={idx} className="bg-red-500/10 border border-red-500 rounded p-3 text-sm">
                        <div className="flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 text-red-500 mt-0.5" />
                          <div className="flex-1">
                            <div className="text-red-400">{error.message}</div>
                            {error.parameter && (
                              <div className="text-xs text-slate-400 mt-1">Parameter: {error.parameter}</div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {validationResult && validationResult.warnings.length > 0 && (
                  <div className="space-y-2 mt-4">
                    <h3 className="text-sm font-semibold text-yellow-400">Warnings</h3>
                    {validationResult.warnings.map((warning: any, idx: number) => (
                      <div key={idx} className="bg-yellow-500/10 border border-yellow-500 rounded p-3 text-sm">
                        <div className="flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 text-yellow-500 mt-0.5" />
                          <div className="flex-1">
                            <div className="text-yellow-400">{warning.message}</div>
                            {warning.suggestion && (
                              <div className="text-xs text-slate-400 mt-1">💡 {warning.suggestion}</div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="suggestions" className="max-h-[600px] overflow-y-auto">
                {!suggestions && (
                  <div className="text-center text-slate-400 text-sm py-8">
                    <Lightbulb className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <div>Select a node to see suggestions</div>
                  </div>
                )}

                {suggestions && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-white mb-3">
                      Suggested {suggestions.type === 'action' ? 'Actions' : 'Targets'}
                    </h3>
                    {suggestions.items.map((item: any) => (
                      <div
                        key={item.id}
                        className="bg-slate-700/50 border border-slate-600 rounded p-3 text-sm cursor-pointer hover:bg-slate-700"
                      >
                        <div className="font-semibold text-white">
                          [{item.id}] {item.name}
                        </div>
                        <div className="text-slate-400 text-xs mt-1">{item.description}</div>
                        <div className="flex items-center gap-1 mt-2">
                          <div className="h-1 bg-blue-500 rounded" style={{ width: `${item.relevance}%` }}></div>
                          <span className="text-xs text-slate-500">{item.relevance}% relevant</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
}
