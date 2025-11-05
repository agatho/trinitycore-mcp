'use client';

import React, { useState, useCallback } from 'react';
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
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Zap, Download, FileJson, Plus, Trash2, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  SAIScript,
  SAI_EVENT_TYPES,
  SAI_ACTION_TYPES,
  SAI_TARGET_TYPES,
  SAI_TEMPLATES,
  generateSAISQL,
  validateSAIScript,
  formatSAIScript,
} from '@/lib/sai-editor';

const initialNodes: Node[] = [];
const initialEdges: Edge[] = [];

export default function SAIEditorPage() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [scripts, setScripts] = useState<SAIScript[]>([]);
  const [selectedScript, setSelectedScript] = useState<SAIScript | null>(null);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const addEventNode = () => {
    const newNode: Node = {
      id: `event-${Date.now()}`,
      type: 'default',
      position: { x: Math.random() * 400, y: Math.random() * 300 },
      data: {
        label: (
          <div className="p-2">
            <div className="font-bold">Event</div>
            <select className="mt-2 bg-slate-700 text-white text-sm p-1 rounded">
              {SAI_EVENT_TYPES.map(type => (
                <option key={type.id} value={type.id}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>
        ),
      },
      style: { background: '#3b82f6', color: 'white', border: '2px solid #60a5fa', width: 200 },
    };
    setNodes((nds) => nds.concat(newNode));
  };

  const addActionNode = () => {
    const newNode: Node = {
      id: `action-${Date.now()}`,
      type: 'default',
      position: { x: Math.random() * 400 + 250, y: Math.random() * 300 },
      data: {
        label: (
          <div className="p-2">
            <div className="font-bold">Action</div>
            <select className="mt-2 bg-slate-700 text-white text-sm p-1 rounded">
              {SAI_ACTION_TYPES.map(type => (
                <option key={type.id} value={type.id}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>
        ),
      },
      style: { background: '#10b981', color: 'white', border: '2px solid #34d399', width: 200 },
    };
    setNodes((nds) => nds.concat(newNode));
  };

  const addTargetNode = () => {
    const newNode: Node = {
      id: `target-${Date.now()}`,
      type: 'default',
      position: { x: Math.random() * 400 + 500, y: Math.random() * 300 },
      data: {
        label: (
          <div className="p-2">
            <div className="font-bold">Target</div>
            <select className="mt-2 bg-slate-700 text-white text-sm p-1 rounded">
              {SAI_TARGET_TYPES.map(type => (
                <option key={type.id} value={type.id}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>
        ),
      },
      style: { background: '#f59e0b', color: 'white', border: '2px solid #fbbf24', width: 200 },
    };
    setNodes((nds) => nds.concat(newNode));
  };

  const loadTemplate = (templateId: string) => {
    const template = SAI_TEMPLATES.find(t => t.id === templateId);
    if (!template) return;

    setNodes([]);
    setEdges([]);

    // Create event node
    const eventNode: Node = {
      id: 'event-1',
      type: 'default',
      position: { x: 50, y: 150 },
      data: {
        label: (
          <div className="p-3">
            <div className="font-bold text-blue-300">Event</div>
            <div className="text-sm mt-1">{template.script.event.typeName}</div>
            <div className="text-xs text-slate-300 mt-1">{template.script.event.description}</div>
          </div>
        ),
      },
      style: { background: '#3b82f6', color: 'white', border: '2px solid #60a5fa', width: 220 },
    };

    // Create action nodes
    const actionNodes = template.script.actions.map((action, idx) => ({
      id: `action-${idx + 1}`,
      type: 'default',
      position: { x: 350, y: 50 + idx * 150 },
      data: {
        label: (
          <div className="p-3">
            <div className="font-bold text-green-300">Action {idx + 1}</div>
            <div className="text-sm mt-1">{action.typeName}</div>
            <div className="text-xs text-slate-300 mt-1">{action.description}</div>
          </div>
        ),
      },
      style: { background: '#10b981', color: 'white', border: '2px solid #34d399', width: 220 },
    }));

    // Create target node
    const targetNode: Node = {
      id: 'target-1',
      type: 'default',
      position: { x: 650, y: 150 },
      data: {
        label: (
          <div className="p-3">
            <div className="font-bold text-amber-300">Target</div>
            <div className="text-sm mt-1">{template.script.target.typeName}</div>
            <div className="text-xs text-slate-300 mt-1">{template.script.target.description}</div>
          </div>
        ),
      },
      style: { background: '#f59e0b', color: 'white', border: '2px solid #fbbf24', width: 220 },
    };

    // Create edges
    const newEdges: Edge[] = actionNodes.map((node, idx) => ({
      id: `e-event-action${idx + 1}`,
      source: 'event-1',
      target: node.id,
      animated: true,
    }));

    actionNodes.forEach((node, idx) => {
      newEdges.push({
        id: `e-action${idx + 1}-target`,
        source: node.id,
        target: 'target-1',
        animated: true,
      });
    });

    setNodes([eventNode, ...actionNodes, targetNode]);
    setEdges(newEdges);
  };

  const exportSQL = () => {
    // Simplified export - in a real implementation, extract data from nodes
    const mockScript: SAIScript = {
      id: 'script-1',
      entryOrGuid: 12345,
      sourceType: 0,
      eventType: 0,
      eventPhaseMask: 0,
      eventChance: 100,
      eventFlags: 0,
      event: { id: '1', type: '0', typeName: 'UPDATE_IC', param1: 5000, param2: 8000, param3: 12000, param4: 15000, description: 'Combat update' },
      actions: [
        { id: '1', type: '11', typeName: 'CAST', param1: 9613, description: 'Cast Shadow Bolt' }
      ],
      target: { id: '1', type: '2', typeName: 'VICTIM', description: 'Current victim' },
      comment: 'Visual SAI Script',
    };

    const sql = generateSAISQL(mockScript);
    const blob = new Blob([sql], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sai_script.sql';
    a.click();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8">
      <div className="max-w-[1800px] mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Zap className="w-8 h-8 text-blue-400" />
              <div>
                <h1 className="text-3xl font-bold text-white">Visual SAI Editor</h1>
                <p className="text-slate-400">Drag-and-drop Smart AI script builder</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={addEventNode}>
                <Plus className="w-4 h-4 mr-2" />
                Add Event
              </Button>
              <Button variant="outline" onClick={addActionNode}>
                <Plus className="w-4 h-4 mr-2" />
                Add Action
              </Button>
              <Button variant="outline" onClick={addTargetNode}>
                <Plus className="w-4 h-4 mr-2" />
                Add Target
              </Button>
              <Button variant="outline" onClick={exportSQL}>
                <Download className="w-4 h-4 mr-2" />
                Export SQL
              </Button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-[250px_1fr] gap-6">
          {/* Left Sidebar - Templates */}
          <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-white mb-4">Templates</h3>
            <div className="space-y-2">
              {SAI_TEMPLATES.map(template => (
                <Button
                  key={template.id}
                  variant="outline"
                  className="w-full justify-start text-left"
                  onClick={() => loadTemplate(template.id)}
                >
                  <div>
                    <div className="font-semibold">{template.name}</div>
                    <div className="text-xs text-slate-400">{template.description}</div>
                  </div>
                </Button>
              ))}
            </div>

            <div className="mt-6 pt-6 border-t border-slate-700">
              <h3 className="text-sm font-semibold text-white mb-3">Legend</h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-blue-500 rounded"></div>
                  <span className="text-slate-300">Event</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-green-500 rounded"></div>
                  <span className="text-slate-300">Action</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-amber-500 rounded"></div>
                  <span className="text-slate-300">Target</span>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-slate-700">
              <h3 className="text-sm font-semibold text-white mb-2">Instructions</h3>
              <div className="text-xs text-slate-400 space-y-2">
                <p>1. Add event, action, and target nodes</p>
                <p>2. Connect nodes by dragging from one to another</p>
                <p>3. Configure parameters in each node</p>
                <p>4. Export to SQL when ready</p>
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
              fitView
            >
              <Controls />
              <Background color="#64748b" gap={16} />
              <MiniMap
                nodeColor={(node) => {
                  if (node.id.startsWith('event')) return '#3b82f6';
                  if (node.id.startsWith('action')) return '#10b981';
                  if (node.id.startsWith('target')) return '#f59e0b';
                  return '#64748b';
                }}
              />
            </ReactFlow>
          </div>
        </div>
      </div>
    </div>
  );
}
