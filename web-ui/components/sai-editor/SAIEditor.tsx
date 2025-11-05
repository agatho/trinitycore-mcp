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
  MiniMap,
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

import SAINodeComponent from './SAINode';
import EditorToolbar from './EditorToolbar';
import ParameterEditor from './ParameterEditor';
import ValidationPanel from './ValidationPanel';
import TemplateLibrary from './TemplateLibrary';

import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';

// Node types for ReactFlow
const nodeTypes = {
  saiNode: SAINodeComponent,
};

interface SAIEditorProps {
  initialScript?: SAIScript;
  onSave?: (script: SAIScript) => void;
  onExport?: (sql: string) => void;
}

export const SAIEditor: React.FC<SAIEditorProps> = ({
  initialScript,
  onSave,
  onExport,
}) => {
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
  const [showTemplates, setShowTemplates] = useState(false);

  // ReactFlow state
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // Convert SAI script to ReactFlow nodes/edges
  const convertToReactFlow = useCallback((saiScript: SAIScript) => {
    const flowNodes: Node[] = saiScript.nodes.map((node) => ({
      id: node.id,
      type: 'saiNode',
      position: node.position,
      data: { ...node },
    }));

    const flowEdges: Edge[] = saiScript.connections.map((conn) => ({
      id: conn.id,
      source: conn.source,
      target: conn.target,
      type: conn.type === 'link' ? 'straight' : 'smoothstep',
      animated: conn.type === 'link',
    }));

    setNodes(flowNodes);
    setEdges(flowEdges);
  }, [setNodes, setEdges]);

  // Convert ReactFlow to SAI script
  const convertFromReactFlow = useCallback((): SAIScript => {
    const saiNodes: SAINodeType[] = nodes.map((node) => ({
      ...(node.data as SAINodeType),
      position: node.position,
    }));

    const saiConnections: SAIConnection[] = edges.map((edge) => ({
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

  // Auto-validate on changes
  useEffect(() => {
    const currentScript = convertFromReactFlow();
    const result = validateScript(currentScript);
    setValidation(result);
  }, [nodes, edges]);

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
  }, [convertFromReactFlow, onExport]);

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
            nodeTypes={nodeTypes}
            connectionMode={ConnectionMode.Loose}
            fitView
          >
            <Background variant={BackgroundVariant.Dots} />
            <Controls />
            <MiniMap
              nodeColor={(node) => {
                const data = node.data as SAINodeType;
                switch (data.type) {
                  case 'event':
                    return '#3b82f6';
                  case 'action':
                    return '#10b981';
                  case 'target':
                    return '#a855f7';
                  default:
                    return '#6b7280';
                }
              }}
            />
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
            <TabsList className="grid w-full grid-cols-3 rounded-none border-b">
              <TabsTrigger value="properties">Properties</TabsTrigger>
              <TabsTrigger value="validation">Validation</TabsTrigger>
              <TabsTrigger value="templates">Templates</TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-auto">
              <TabsContent value="properties" className="p-4 m-0">
                {selectedNode ? (
                  <ParameterEditor
                    parameters={selectedNode.parameters}
                    onChange={(params) => {
                      const updatedNode = { ...selectedNode, parameters: params };
                      setNodes((nds) =>
                        nds.map((n) =>
                          n.id === selectedNode.id ? { ...n, data: updatedNode } : n
                        )
                      );
                    }}
                    title={selectedNode.label}
                    description={selectedNode.typeName}
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
            </div>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default SAIEditor;
