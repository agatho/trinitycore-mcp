'use client';

import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import {
  ReactFlow,
  Node,
  Edge,
  addEdge,
  Connection,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  MiniMap,
  Handle,
  Position,
  BackgroundVariant,
  type NodeProps,
  type NodeTypes,
  type OnConnect,
  type OnNodesDelete,
  type OnEdgesDelete,
  Panel,
  useReactFlow,
  ReactFlowProvider,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  ArrowRight,
  GitBranch,
  Columns,
  RefreshCw,
  Repeat,
  Check,
  RotateCw,
  Clock,
  Shield,
  Play,
  HelpCircle,
  Download,
  Upload,
  Save,
  Plus,
  Trash2,
  Undo2,
  Redo2,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  FileJson,
  ChevronDown,
  ChevronRight,
  Layers,
  Settings,
  Eye,
  EyeOff,
  Copy,
  Layout,
  FileText,
  X,
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
  type BTNode,
  type BTNodeType,
  type BTNodeCategory,
  type BehaviorTreeDocument,
  type ValidationError,
  type BTTemplate,
  NODE_VISUALS,
  BOT_ACTION_TYPES,
  BOT_CONDITION_TYPES,
  createNode,
  createEmptyDocument,
  findNode,
  removeNodeAndDescendants,
  addChildNode,
  autoLayoutTree,
  validateTree,
  serializeDocument,
  deserializeDocument,
  getNodeCategory,
  canHaveChildren,
  maxChildren,
  BT_TEMPLATES,
  type ActionParams,
  type ConditionParams,
  type DecoratorParams,
  type CompositeParams,
  type ConditionOperator,
} from '@/lib/behavior-tree';

// ============================================================================
// Lucide icon lookup (avoids dynamic import)
// ============================================================================

const ICON_MAP: Record<string, React.ReactNode> = {
  'arrow-right': <ArrowRight className="w-4 h-4" />,
  'git-branch': <GitBranch className="w-4 h-4" />,
  'columns': <Columns className="w-4 h-4" />,
  'refresh-cw': <RefreshCw className="w-4 h-4" />,
  'repeat': <Repeat className="w-4 h-4" />,
  'check': <Check className="w-4 h-4" />,
  'rotate-cw': <RotateCw className="w-4 h-4" />,
  'clock': <Clock className="w-4 h-4" />,
  'shield': <Shield className="w-4 h-4" />,
  'play': <Play className="w-4 h-4" />,
  'help-circle': <HelpCircle className="w-4 h-4" />,
};

// ============================================================================
// Custom Node Components
// ============================================================================

interface BTNodeData {
  btNode: BTNode;
  onSelect: (id: string) => void;
  onToggleCollapse: (id: string) => void;
  onToggleDisable: (id: string) => void;
  isSelected: boolean;
  validationErrors: ValidationError[];
  [key: string]: unknown;
}

function BehaviorTreeNode({ data, id }: NodeProps<Node<BTNodeData>>) {
  const btNode = data.btNode;
  const visual = NODE_VISUALS[btNode.type];
  const hasErrors = data.validationErrors.some((e) => e.nodeId === id && e.severity === 'error');
  const hasWarnings = data.validationErrors.some((e) => e.nodeId === id && e.severity === 'warning');

  const borderClass = data.isSelected
    ? visual.selectedBorderColor
    : hasErrors
      ? 'border-red-400'
      : hasWarnings
        ? 'border-yellow-400'
        : visual.borderColor;

  const category = getNodeCategory(btNode.type);
  const showSourceHandle = category !== 'leaf';
  const showTargetHandle = btNode.parentId !== null;

  return (
    <div
      className={`px-4 py-3 shadow-lg rounded-lg ${visual.color} border-2 ${borderClass} min-w-[200px] max-w-[260px] cursor-pointer transition-all ${btNode.disabled ? 'opacity-50' : ''}`}
      onClick={() => data.onSelect(id)}
    >
      {showTargetHandle && (
        <Handle
          type="target"
          position={Position.Top}
          className="w-3 h-3 !bg-white/80 !border-2 !border-white"
        />
      )}
      {showSourceHandle && (
        <Handle
          type="source"
          position={Position.Bottom}
          className="w-3 h-3 !bg-white/80 !border-2 !border-white"
        />
      )}

      <div className="text-white">
        <div className="flex items-center justify-between gap-2 mb-1">
          <div className="flex items-center gap-1.5">
            {ICON_MAP[visual.icon]}
            <span className="text-[10px] font-semibold uppercase tracking-wider opacity-80">
              {visual.label}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {hasErrors && <AlertCircle className="w-3.5 h-3.5 text-red-300" />}
            {hasWarnings && !hasErrors && <AlertTriangle className="w-3.5 h-3.5 text-yellow-300" />}
            {btNode.disabled && <EyeOff className="w-3.5 h-3.5 opacity-60" />}
            {btNode.collapsed && category !== 'leaf' && (
              <button
                onClick={(e) => { e.stopPropagation(); data.onToggleCollapse(id); }}
                className="hover:bg-white/20 rounded p-0.5"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
            {!btNode.collapsed && category !== 'leaf' && btNode.children.length > 0 && (
              <button
                onClick={(e) => { e.stopPropagation(); data.onToggleCollapse(id); }}
                className="hover:bg-white/20 rounded p-0.5"
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
        <div className="text-sm font-bold leading-tight">{btNode.name}</div>
        {btNode.description && (
          <div className="text-[11px] mt-1 opacity-75 leading-tight line-clamp-2">
            {btNode.description}
          </div>
        )}
        {/* Show key params inline */}
        {btNode.type === 'action' && btNode.actionParams?.actionType && btNode.actionParams.actionType !== 'Idle' && (
          <div className="text-[10px] mt-1.5 bg-white/15 px-2 py-0.5 rounded inline-block">
            {btNode.actionParams.actionType}
            {btNode.actionParams.spellId ? ` #${btNode.actionParams.spellId}` : ''}
          </div>
        )}
        {btNode.type === 'condition' && btNode.conditionParams && (
          <div className="text-[10px] mt-1.5 bg-white/15 px-2 py-0.5 rounded inline-block">
            {btNode.conditionParams.conditionType} {btNode.conditionParams.operator} {btNode.conditionParams.value}
          </div>
        )}
        {btNode.type === 'cooldown' && btNode.decoratorParams?.cooldownMs && (
          <div className="text-[10px] mt-1.5 bg-white/15 px-2 py-0.5 rounded inline-block">
            {btNode.decoratorParams.cooldownMs}ms
          </div>
        )}
        {btNode.type === 'repeater' && btNode.decoratorParams?.repeatCount && (
          <div className="text-[10px] mt-1.5 bg-white/15 px-2 py-0.5 rounded inline-block">
            x{btNode.decoratorParams.repeatCount === -1 ? '∞' : btNode.decoratorParams.repeatCount}
          </div>
        )}
        {btNode.comment && (
          <div className="text-[10px] mt-1 italic opacity-60">
            {btNode.comment}
          </div>
        )}
      </div>
    </div>
  );
}

const nodeTypes: NodeTypes = {
  btNode: BehaviorTreeNode as unknown as NodeTypes[string],
};

// ============================================================================
// Convert BT nodes to ReactFlow nodes/edges
// ============================================================================

function btNodesToFlow(
  btNodes: BTNode[],
  selectedId: string | null,
  validationErrors: ValidationError[],
  onSelect: (id: string) => void,
  onToggleCollapse: (id: string) => void,
  onToggleDisable: (id: string) => void
): { nodes: Node<BTNodeData>[]; edges: Edge[] } {
  const nodes: Node<BTNodeData>[] = [];
  const edges: Edge[] = [];

  // Find all collapsed ancestors
  const hiddenByCollapse = new Set<string>();
  function markHidden(nodeId: string) {
    const node = findNode(btNodes, nodeId);
    if (!node) return;
    for (const childId of node.children) {
      hiddenByCollapse.add(childId);
      markHidden(childId);
    }
  }
  for (const n of btNodes) {
    if (n.collapsed) markHidden(n.id);
  }

  for (const btNode of btNodes) {
    if (hiddenByCollapse.has(btNode.id)) continue;

    nodes.push({
      id: btNode.id,
      type: 'btNode',
      position: btNode.position,
      data: {
        btNode,
        onSelect,
        onToggleCollapse,
        onToggleDisable,
        isSelected: selectedId === btNode.id,
        validationErrors,
      },
    });

    // Edges from parent to children
    for (let i = 0; i < btNode.children.length; i++) {
      const childId = btNode.children[i];
      if (hiddenByCollapse.has(childId)) continue;
      edges.push({
        id: `${btNode.id}->${childId}`,
        source: btNode.id,
        target: childId,
        type: 'smoothstep',
        animated: false,
        style: { stroke: '#888', strokeWidth: 2 },
        label: getNodeCategory(btNode.type) === 'composite' ? `${i + 1}` : undefined,
        labelStyle: { fill: '#aaa', fontSize: 10 },
      });
    }
  }

  return { nodes, edges };
}

// ============================================================================
// Node Palette (Sidebar)
// ============================================================================

const PALETTE_CATEGORIES: { label: string; types: BTNodeType[] }[] = [
  { label: 'Composites', types: ['sequence', 'selector', 'parallel'] },
  { label: 'Decorators', types: ['inverter', 'repeater', 'succeeder', 'until_fail', 'cooldown', 'condition_guard'] },
  { label: 'Leaves', types: ['action', 'condition'] },
];

interface NodePaletteProps {
  onAddNode: (type: BTNodeType) => void;
  onLoadTemplate: (template: BTTemplate) => void;
  onNewTree: () => void;
}

function NodePalette({ onAddNode, onLoadTemplate, onNewTree }: NodePaletteProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(['Composites', 'Decorators', 'Leaves'])
  );

  const toggleCategory = (label: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  return (
    <div className="w-64 bg-zinc-900 border-r border-zinc-700 flex flex-col h-full overflow-hidden">
      <div className="p-3 border-b border-zinc-700">
        <h2 className="text-sm font-bold text-white mb-2">Node Palette</h2>
        <p className="text-[11px] text-zinc-400">Click to add a node to the selected parent, or to root if none selected.</p>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {PALETTE_CATEGORIES.map((cat) => (
          <div key={cat.label}>
            <button
              className="flex items-center gap-1.5 text-xs font-semibold text-zinc-300 hover:text-white w-full text-left py-1"
              onClick={() => toggleCategory(cat.label)}
            >
              {expandedCategories.has(cat.label) ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" />
              )}
              {cat.label}
            </button>
            {expandedCategories.has(cat.label) && (
              <div className="space-y-1 ml-2">
                {cat.types.map((type) => {
                  const visual = NODE_VISUALS[type];
                  return (
                    <button
                      key={type}
                      className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-left text-xs text-white ${visual.color} hover:brightness-110 transition-all border border-white/10`}
                      onClick={() => onAddNode(type)}
                      title={visual.description}
                    >
                      {ICON_MAP[visual.icon]}
                      <div>
                        <div className="font-semibold">{visual.label}</div>
                        <div className="text-[10px] opacity-70 line-clamp-1">{visual.description}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ))}

        {/* Templates section */}
        <div className="pt-2 border-t border-zinc-700">
          <h3 className="text-xs font-semibold text-zinc-300 mb-2">Templates</h3>
          <div className="space-y-1">
            {BT_TEMPLATES.map((template) => (
              <button
                key={template.name}
                className="w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-left text-xs text-zinc-300 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 transition-colors"
                onClick={() => onLoadTemplate(template)}
              >
                <FileText className="w-3.5 h-3.5 shrink-0" />
                <div>
                  <div className="font-semibold text-white">{template.name}</div>
                  <div className="text-[10px] opacity-60 line-clamp-1">{template.description}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="p-3 border-t border-zinc-700">
        <Button
          size="sm"
          variant="outline"
          className="w-full text-xs"
          onClick={onNewTree}
        >
          <Plus className="w-3.5 h-3.5 mr-1" />
          New Empty Tree
        </Button>
      </div>
    </div>
  );
}

// ============================================================================
// Properties Panel (Right Sidebar)
// ============================================================================

interface PropertiesPanelProps {
  node: BTNode | null;
  onUpdateNode: (id: string, updates: Partial<BTNode>) => void;
  onDeleteNode: (id: string) => void;
  onDuplicateNode: (id: string) => void;
  validationErrors: ValidationError[];
  document: BehaviorTreeDocument;
  onUpdateDocument: (updates: Partial<BehaviorTreeDocument>) => void;
}

function PropertiesPanel({
  node,
  onUpdateNode,
  onDeleteNode,
  onDuplicateNode,
  validationErrors,
  document: doc,
  onUpdateDocument,
}: PropertiesPanelProps) {
  const [activeTab, setActiveTab] = useState<string>('node');

  // Show tree properties if no node selected
  if (!node) {
    return (
      <div className="w-72 bg-zinc-900 border-l border-zinc-700 flex flex-col h-full overflow-hidden">
        <div className="p-3 border-b border-zinc-700">
          <h2 className="text-sm font-bold text-white">Tree Properties</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          <div>
            <Label className="text-xs text-zinc-400">Tree Name</Label>
            <Input
              value={doc.name}
              onChange={(e) => onUpdateDocument({ name: e.target.value })}
              className="mt-1 h-8 text-xs bg-zinc-800 border-zinc-700"
            />
          </div>
          <div>
            <Label className="text-xs text-zinc-400">Description</Label>
            <textarea
              value={doc.description}
              onChange={(e) => onUpdateDocument({ description: e.target.value })}
              className="mt-1 w-full h-20 text-xs bg-zinc-800 border border-zinc-700 rounded-md p-2 text-white resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs text-zinc-400">Bot Class</Label>
              <Select value={doc.botClass} onValueChange={(v) => onUpdateDocument({ botClass: v })}>
                <SelectTrigger className="mt-1 h-8 text-xs bg-zinc-800 border-zinc-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {['Any', 'Warrior', 'Paladin', 'Hunter', 'Rogue', 'Priest', 'Death Knight', 'Shaman', 'Mage', 'Warlock', 'Monk', 'Druid', 'Demon Hunter', 'Evoker'].map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-zinc-400">Bot Spec</Label>
              <Input
                value={doc.botSpec}
                onChange={(e) => onUpdateDocument({ botSpec: e.target.value })}
                className="mt-1 h-8 text-xs bg-zinc-800 border-zinc-700"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs text-zinc-400">Min Level</Label>
              <Input
                type="number"
                min={1}
                max={90}
                value={doc.minLevel}
                onChange={(e) => onUpdateDocument({ minLevel: parseInt(e.target.value) || 1 })}
                className="mt-1 h-8 text-xs bg-zinc-800 border-zinc-700"
              />
            </div>
            <div>
              <Label className="text-xs text-zinc-400">Max Level</Label>
              <Input
                type="number"
                min={1}
                max={90}
                value={doc.maxLevel}
                onChange={(e) => onUpdateDocument({ maxLevel: parseInt(e.target.value) || 90 })}
                className="mt-1 h-8 text-xs bg-zinc-800 border-zinc-700"
              />
            </div>
          </div>
          <div>
            <Label className="text-xs text-zinc-400">Author</Label>
            <Input
              value={doc.author}
              onChange={(e) => onUpdateDocument({ author: e.target.value })}
              className="mt-1 h-8 text-xs bg-zinc-800 border-zinc-700"
            />
          </div>
          <div>
            <Label className="text-xs text-zinc-400">Tags (comma-separated)</Label>
            <Input
              value={doc.tags.join(', ')}
              onChange={(e) => onUpdateDocument({ tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) })}
              className="mt-1 h-8 text-xs bg-zinc-800 border-zinc-700"
            />
          </div>

          <div className="text-[10px] text-zinc-500 pt-2 border-t border-zinc-700">
            <p>Nodes: {doc.nodes.length}</p>
            <p>Created: {new Date(doc.createdAt).toLocaleDateString()}</p>
            <p>Modified: {new Date(doc.modifiedAt).toLocaleDateString()}</p>
          </div>
        </div>
      </div>
    );
  }

  const nodeErrors = validationErrors.filter((e) => e.nodeId === node.id);
  const category = getNodeCategory(node.type);

  return (
    <div className="w-72 bg-zinc-900 border-l border-zinc-700 flex flex-col h-full overflow-hidden">
      <div className="p-3 border-b border-zinc-700">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-white">Node Properties</h2>
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" className="h-6 w-6 p-0" title="Duplicate" onClick={() => onDuplicateNode(node.id)}>
              <Copy className="w-3.5 h-3.5" />
            </Button>
            <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-red-400 hover:text-red-300" title="Delete" onClick={() => onDeleteNode(node.id)}>
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="mx-3 mt-2 bg-zinc-800">
          <TabsTrigger value="node" className="text-xs">General</TabsTrigger>
          <TabsTrigger value="params" className="text-xs">Params</TabsTrigger>
          {nodeErrors.length > 0 && (
            <TabsTrigger value="errors" className="text-xs">
              Issues ({nodeErrors.length})
            </TabsTrigger>
          )}
        </TabsList>

        <div className="flex-1 overflow-y-auto">
          <TabsContent value="node" className="p-3 space-y-3 mt-0">
            <div>
              <Label className="text-xs text-zinc-400">Name</Label>
              <Input
                value={node.name}
                onChange={(e) => onUpdateNode(node.id, { name: e.target.value })}
                className="mt-1 h-8 text-xs bg-zinc-800 border-zinc-700"
              />
            </div>
            <div>
              <Label className="text-xs text-zinc-400">Type</Label>
              <div className={`mt-1 text-xs px-2 py-1.5 rounded ${NODE_VISUALS[node.type].color} text-white font-medium`}>
                {NODE_VISUALS[node.type].label}
              </div>
            </div>
            <div>
              <Label className="text-xs text-zinc-400">Description</Label>
              <textarea
                value={node.description}
                onChange={(e) => onUpdateNode(node.id, { description: e.target.value })}
                className="mt-1 w-full h-16 text-xs bg-zinc-800 border border-zinc-700 rounded-md p-2 text-white resize-none"
                placeholder="Describe what this node does..."
              />
            </div>
            <div>
              <Label className="text-xs text-zinc-400">Comment</Label>
              <Input
                value={node.comment ?? ''}
                onChange={(e) => onUpdateNode(node.id, { comment: e.target.value || undefined })}
                className="mt-1 h-8 text-xs bg-zinc-800 border-zinc-700"
                placeholder="Optional note..."
              />
            </div>
            <div className="flex items-center gap-3 pt-1">
              <label className="flex items-center gap-1.5 text-xs text-zinc-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={node.disabled}
                  onChange={(e) => onUpdateNode(node.id, { disabled: e.target.checked })}
                  className="rounded border-zinc-600"
                />
                Disabled
              </label>
            </div>
            <div className="text-[10px] text-zinc-500 pt-2 border-t border-zinc-700">
              <p>ID: {node.id}</p>
              <p>Category: {category}</p>
              <p>Children: {node.children.length}{category === 'decorator' ? ' / 1' : category === 'composite' ? ' / ∞' : ' / 0'}</p>
              <p>Parent: {node.parentId ?? 'none (root)'}</p>
            </div>
          </TabsContent>

          <TabsContent value="params" className="p-3 space-y-3 mt-0">
            {/* Composite params */}
            {category === 'composite' && node.type === 'parallel' && (
              <>
                <div>
                  <Label className="text-xs text-zinc-400">Success Policy</Label>
                  <Select
                    value={node.compositeParams?.successPolicy ?? 'require_all'}
                    onValueChange={(v) =>
                      onUpdateNode(node.id, {
                        compositeParams: { ...node.compositeParams, successPolicy: v as CompositeParams['successPolicy'] },
                      })
                    }
                  >
                    <SelectTrigger className="mt-1 h-8 text-xs bg-zinc-800 border-zinc-700">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="require_all">Require All</SelectItem>
                      <SelectItem value="require_one">Require One</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-zinc-400">Failure Policy</Label>
                  <Select
                    value={node.compositeParams?.failurePolicy ?? 'require_one'}
                    onValueChange={(v) =>
                      onUpdateNode(node.id, {
                        compositeParams: { ...node.compositeParams, failurePolicy: v as CompositeParams['failurePolicy'] },
                      })
                    }
                  >
                    <SelectTrigger className="mt-1 h-8 text-xs bg-zinc-800 border-zinc-700">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="require_all">Require All</SelectItem>
                      <SelectItem value="require_one">Require One</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {/* Decorator params */}
            {category === 'decorator' && (
              <>
                {node.type === 'repeater' && (
                  <div>
                    <Label className="text-xs text-zinc-400">Repeat Count (-1 = infinite)</Label>
                    <Input
                      type="number"
                      min={-1}
                      value={node.decoratorParams?.repeatCount ?? 3}
                      onChange={(e) =>
                        onUpdateNode(node.id, {
                          decoratorParams: { ...node.decoratorParams, repeatCount: parseInt(e.target.value) || 3 },
                        })
                      }
                      className="mt-1 h-8 text-xs bg-zinc-800 border-zinc-700"
                    />
                  </div>
                )}
                {node.type === 'cooldown' && (
                  <div>
                    <Label className="text-xs text-zinc-400">Cooldown (ms)</Label>
                    <Input
                      type="number"
                      min={0}
                      step={100}
                      value={node.decoratorParams?.cooldownMs ?? 5000}
                      onChange={(e) =>
                        onUpdateNode(node.id, {
                          decoratorParams: { ...node.decoratorParams, cooldownMs: parseInt(e.target.value) || 0 },
                        })
                      }
                      className="mt-1 h-8 text-xs bg-zinc-800 border-zinc-700"
                    />
                  </div>
                )}
                {node.type === 'condition_guard' && (
                  <div>
                    <Label className="text-xs text-zinc-400">Guard Condition</Label>
                    <Input
                      value={node.decoratorParams?.guardCondition ?? ''}
                      onChange={(e) =>
                        onUpdateNode(node.id, {
                          decoratorParams: { ...node.decoratorParams, guardCondition: e.target.value },
                        })
                      }
                      className="mt-1 h-8 text-xs bg-zinc-800 border-zinc-700"
                      placeholder="e.g. health_pct > 50"
                    />
                  </div>
                )}
                {(node.type === 'inverter' || node.type === 'succeeder' || node.type === 'until_fail') && (
                  <p className="text-xs text-zinc-500 italic">
                    {NODE_VISUALS[node.type].description} No additional parameters needed.
                  </p>
                )}
              </>
            )}

            {/* Action params */}
            {node.type === 'action' && (
              <>
                <div>
                  <Label className="text-xs text-zinc-400">Action Type</Label>
                  <Select
                    value={node.actionParams?.actionType ?? 'Idle'}
                    onValueChange={(v) => {
                      const actionDef = BOT_ACTION_TYPES.find((a) => a.value === v);
                      onUpdateNode(node.id, {
                        actionParams: {
                          ...node.actionParams!,
                          actionType: v,
                          spellId: actionDef?.requiresSpellId ? node.actionParams?.spellId : undefined,
                          targetType: actionDef?.requiresTarget ? (node.actionParams?.targetType ?? 'enemy') : 'self',
                        },
                      });
                    }}
                  >
                    <SelectTrigger className="mt-1 h-8 text-xs bg-zinc-800 border-zinc-700">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      {Object.entries(
                        BOT_ACTION_TYPES.reduce<Record<string, typeof BOT_ACTION_TYPES>>((acc, a) => {
                          if (!acc[a.category]) acc[a.category] = [];
                          acc[a.category].push(a);
                          return acc;
                        }, {})
                      ).map(([cat, actions]) => (
                        <React.Fragment key={cat}>
                          <div className="px-2 py-1 text-[10px] font-semibold text-zinc-500 uppercase">{cat}</div>
                          {actions.map((a) => (
                            <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
                          ))}
                        </React.Fragment>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {BOT_ACTION_TYPES.find((a) => a.value === node.actionParams?.actionType)?.requiresSpellId && (
                  <div>
                    <Label className="text-xs text-zinc-400">Spell ID</Label>
                    <Input
                      type="number"
                      min={0}
                      value={node.actionParams?.spellId ?? 0}
                      onChange={(e) =>
                        onUpdateNode(node.id, {
                          actionParams: { ...node.actionParams!, spellId: parseInt(e.target.value) || 0 },
                        })
                      }
                      className="mt-1 h-8 text-xs bg-zinc-800 border-zinc-700"
                    />
                  </div>
                )}
                <div>
                  <Label className="text-xs text-zinc-400">Target Type</Label>
                  <Select
                    value={node.actionParams?.targetType ?? 'self'}
                    onValueChange={(v) =>
                      onUpdateNode(node.id, {
                        actionParams: { ...node.actionParams!, targetType: v },
                      })
                    }
                  >
                    <SelectTrigger className="mt-1 h-8 text-xs bg-zinc-800 border-zinc-700">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="self">Self</SelectItem>
                      <SelectItem value="enemy">Enemy</SelectItem>
                      <SelectItem value="friendly">Friendly</SelectItem>
                      <SelectItem value="ground">Ground</SelectItem>
                      <SelectItem value="pet">Pet</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-zinc-400">Target Strategy</Label>
                  <Select
                    value={node.actionParams?.targetStrategy ?? 'nearest'}
                    onValueChange={(v) =>
                      onUpdateNode(node.id, {
                        actionParams: { ...node.actionParams!, targetStrategy: v },
                      })
                    }
                  >
                    <SelectTrigger className="mt-1 h-8 text-xs bg-zinc-800 border-zinc-700">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nearest">Nearest</SelectItem>
                      <SelectItem value="lowest_health">Lowest Health</SelectItem>
                      <SelectItem value="highest_threat">Highest Threat</SelectItem>
                      <SelectItem value="random">Random</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-zinc-400">Range (yards)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={node.actionParams?.range ?? ''}
                    onChange={(e) =>
                      onUpdateNode(node.id, {
                        actionParams: { ...node.actionParams!, range: parseInt(e.target.value) || undefined },
                      })
                    }
                    className="mt-1 h-8 text-xs bg-zinc-800 border-zinc-700"
                    placeholder="Optional"
                  />
                </div>
                <div>
                  <Label className="text-xs text-zinc-400">Priority (1-100)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    value={node.actionParams?.priority ?? 50}
                    onChange={(e) =>
                      onUpdateNode(node.id, {
                        actionParams: { ...node.actionParams!, priority: parseInt(e.target.value) || 50 },
                      })
                    }
                    className="mt-1 h-8 text-xs bg-zinc-800 border-zinc-700"
                  />
                </div>
              </>
            )}

            {/* Condition params */}
            {node.type === 'condition' && (
              <>
                <div>
                  <Label className="text-xs text-zinc-400">Condition Type</Label>
                  <Select
                    value={node.conditionParams?.conditionType ?? 'health_pct'}
                    onValueChange={(v) => {
                      const condDef = BOT_CONDITION_TYPES.find((c) => c.value === v);
                      onUpdateNode(node.id, {
                        conditionParams: {
                          ...node.conditionParams!,
                          conditionType: v,
                          operator: condDef?.operators[0] ?? '>',
                        },
                      });
                    }}
                  >
                    <SelectTrigger className="mt-1 h-8 text-xs bg-zinc-800 border-zinc-700">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      {Object.entries(
                        BOT_CONDITION_TYPES.reduce<Record<string, typeof BOT_CONDITION_TYPES>>((acc, c) => {
                          if (!acc[c.category]) acc[c.category] = [];
                          acc[c.category].push(c);
                          return acc;
                        }, {})
                      ).map(([cat, conditions]) => (
                        <React.Fragment key={cat}>
                          <div className="px-2 py-1 text-[10px] font-semibold text-zinc-500 uppercase">{cat}</div>
                          {conditions.map((c) => (
                            <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                          ))}
                        </React.Fragment>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-zinc-400">Operator</Label>
                  <Select
                    value={node.conditionParams?.operator ?? '>'}
                    onValueChange={(v) =>
                      onUpdateNode(node.id, {
                        conditionParams: { ...node.conditionParams!, operator: v as ConditionOperator },
                      })
                    }
                  >
                    <SelectTrigger className="mt-1 h-8 text-xs bg-zinc-800 border-zinc-700">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(BOT_CONDITION_TYPES.find((c) => c.value === node.conditionParams?.conditionType)?.operators ?? ['==', '!=', '>', '<', '>=', '<=']).map((op) => (
                        <SelectItem key={op} value={op}>{op}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-zinc-400">
                    Value
                    {BOT_CONDITION_TYPES.find((c) => c.value === node.conditionParams?.conditionType)?.valueHint && (
                      <span className="text-zinc-600 ml-1">
                        ({BOT_CONDITION_TYPES.find((c) => c.value === node.conditionParams?.conditionType)?.valueHint})
                      </span>
                    )}
                  </Label>
                  <Input
                    value={node.conditionParams?.value ?? ''}
                    onChange={(e) =>
                      onUpdateNode(node.id, {
                        conditionParams: { ...node.conditionParams!, value: e.target.value },
                      })
                    }
                    className="mt-1 h-8 text-xs bg-zinc-800 border-zinc-700"
                  />
                </div>
                <div>
                  <Label className="text-xs text-zinc-400">Check Target</Label>
                  <Select
                    value={node.conditionParams?.checkTarget ?? 'self'}
                    onValueChange={(v) =>
                      onUpdateNode(node.id, {
                        conditionParams: { ...node.conditionParams!, checkTarget: v },
                      })
                    }
                  >
                    <SelectTrigger className="mt-1 h-8 text-xs bg-zinc-800 border-zinc-700">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="self">Self</SelectItem>
                      <SelectItem value="target">Target</SelectItem>
                      <SelectItem value="pet">Pet</SelectItem>
                      <SelectItem value="group">Group</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {/* No params message for simple composites */}
            {category === 'composite' && node.type !== 'parallel' && (
              <p className="text-xs text-zinc-500 italic">
                {NODE_VISUALS[node.type].description} No additional parameters needed.
              </p>
            )}
          </TabsContent>

          {nodeErrors.length > 0 && (
            <TabsContent value="errors" className="p-3 space-y-2 mt-0">
              {nodeErrors.map((err, i) => (
                <div
                  key={i}
                  className={`text-xs p-2 rounded-md ${
                    err.severity === 'error' ? 'bg-red-900/40 text-red-300' : 'bg-yellow-900/40 text-yellow-300'
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-0.5">
                    {err.severity === 'error' ? (
                      <AlertCircle className="w-3.5 h-3.5" />
                    ) : (
                      <AlertTriangle className="w-3.5 h-3.5" />
                    )}
                    <span className="font-semibold capitalize">{err.severity}</span>
                  </div>
                  <p>{err.message}</p>
                </div>
              ))}
            </TabsContent>
          )}
        </div>
      </Tabs>
    </div>
  );
}

// ============================================================================
// Main Editor Component (inside ReactFlowProvider)
// ============================================================================

function BehaviorTreeEditorInner() {
  const [document, setDocument] = useState<BehaviorTreeDocument>(createEmptyDocument());
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [showValidation, setShowValidation] = useState(false);

  // Undo/redo history
  const [history, setHistory] = useState<BehaviorTreeDocument[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const isUndoRedoRef = useRef(false);

  // File input ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { fitView } = useReactFlow();

  // Push state to history
  const pushHistory = useCallback((doc: BehaviorTreeDocument) => {
    if (isUndoRedoRef.current) {
      isUndoRedoRef.current = false;
      return;
    }
    setHistory((prev) => {
      const trimmed = prev.slice(0, historyIndex + 1);
      const next = [...trimmed, doc];
      // Keep last 50 states
      if (next.length > 50) next.shift();
      return next;
    });
    setHistoryIndex((prev) => Math.min(prev + 1, 49));
  }, [historyIndex]);

  // Update document and push history
  const updateDocument = useCallback(
    (updates: Partial<BehaviorTreeDocument>) => {
      setDocument((prev) => {
        const updated = { ...prev, ...updates, modifiedAt: new Date().toISOString() };
        pushHistory(updated);
        return updated;
      });
    },
    [pushHistory]
  );

  // Update a specific node
  const updateNode = useCallback(
    (nodeId: string, updates: Partial<BTNode>) => {
      setDocument((prev) => {
        const updated = {
          ...prev,
          nodes: prev.nodes.map((n) => (n.id === nodeId ? { ...n, ...updates } : n)),
          modifiedAt: new Date().toISOString(),
        };
        pushHistory(updated);
        return updated;
      });
    },
    [pushHistory]
  );

  // Undo
  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      isUndoRedoRef.current = true;
      const prevDoc = history[historyIndex - 1];
      setDocument(prevDoc);
      setHistoryIndex(historyIndex - 1);
    }
  }, [history, historyIndex]);

  // Redo
  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      isUndoRedoRef.current = true;
      const nextDoc = history[historyIndex + 1];
      setDocument(nextDoc);
      setHistoryIndex(historyIndex + 1);
    }
  }, [history, historyIndex]);

  // Add node from palette
  const handleAddNode = useCallback(
    (type: BTNodeType) => {
      const newNode = createNode(type, {
        position: { x: 100, y: 100 },
      });

      // If no root, make this the root
      if (!document.rootId) {
        setDocument((prev) => {
          const updated = {
            ...prev,
            nodes: [newNode],
            rootId: newNode.id,
            modifiedAt: new Date().toISOString(),
          };
          pushHistory(updated);
          return updated;
        });
        setSelectedNodeId(newNode.id);
        return;
      }

      // If a node is selected and can have children, add as child
      if (selectedNodeId) {
        const parentNode = findNode(document.nodes, selectedNodeId);
        if (parentNode && canHaveChildren(parentNode.type) && parentNode.children.length < maxChildren(parentNode.type)) {
          const childNode = { ...newNode, parentId: selectedNodeId };
          setDocument((prev) => {
            const updatedNodes = [
              ...prev.nodes.map((n) =>
                n.id === selectedNodeId
                  ? { ...n, children: [...n.children, childNode.id] }
                  : n
              ),
              childNode,
            ];
            const layouted = autoLayoutTree(updatedNodes, prev.rootId!);
            const updated = { ...prev, nodes: layouted, modifiedAt: new Date().toISOString() };
            pushHistory(updated);
            return updated;
          });
          setSelectedNodeId(childNode.id);
          return;
        }
      }

      // Otherwise add as child of root
      const rootNode = findNode(document.nodes, document.rootId);
      if (rootNode && canHaveChildren(rootNode.type)) {
        const childNode = { ...newNode, parentId: document.rootId };
        setDocument((prev) => {
          const updatedNodes = [
            ...prev.nodes.map((n) =>
              n.id === document.rootId
                ? { ...n, children: [...n.children, childNode.id] }
                : n
            ),
            childNode,
          ];
          const layouted = autoLayoutTree(updatedNodes, prev.rootId!);
          const updated = { ...prev, nodes: layouted, modifiedAt: new Date().toISOString() };
          pushHistory(updated);
          return updated;
        });
        setSelectedNodeId(childNode.id);
      }
    },
    [document, selectedNodeId, pushHistory]
  );

  // Delete node
  const handleDeleteNode = useCallback(
    (nodeId: string) => {
      const node = findNode(document.nodes, nodeId);
      if (!node) return;

      if (nodeId === document.rootId) {
        // Deleting root clears tree
        updateDocument({ nodes: [], rootId: null });
        setSelectedNodeId(null);
        return;
      }

      const updatedNodes = removeNodeAndDescendants(document.nodes, nodeId);
      const layouted = document.rootId ? autoLayoutTree(updatedNodes, document.rootId) : updatedNodes;
      updateDocument({ nodes: layouted });
      if (selectedNodeId === nodeId) setSelectedNodeId(null);
    },
    [document, selectedNodeId, updateDocument]
  );

  // Duplicate node (shallow copy, no children)
  const handleDuplicateNode = useCallback(
    (nodeId: string) => {
      const node = findNode(document.nodes, nodeId);
      if (!node || !node.parentId) return;

      const clone = createNode(node.type, {
        name: `${node.name} (copy)`,
        description: node.description,
        parentId: node.parentId,
        position: { x: node.position.x + 30, y: node.position.y + 30 },
        actionParams: node.actionParams ? { ...node.actionParams } : undefined,
        conditionParams: node.conditionParams ? { ...node.conditionParams } : undefined,
        decoratorParams: node.decoratorParams ? { ...node.decoratorParams } : undefined,
        compositeParams: node.compositeParams ? { ...node.compositeParams } : undefined,
        comment: node.comment,
      });

      setDocument((prev) => {
        const updatedNodes = [
          ...prev.nodes.map((n) =>
            n.id === node.parentId
              ? { ...n, children: [...n.children, clone.id] }
              : n
          ),
          clone,
        ];
        const layouted = prev.rootId ? autoLayoutTree(updatedNodes, prev.rootId) : updatedNodes;
        const updated = { ...prev, nodes: layouted, modifiedAt: new Date().toISOString() };
        pushHistory(updated);
        return updated;
      });
      setSelectedNodeId(clone.id);
    },
    [document, pushHistory]
  );

  // Toggle collapse
  const handleToggleCollapse = useCallback(
    (nodeId: string) => {
      updateNode(nodeId, { collapsed: !findNode(document.nodes, nodeId)?.collapsed });
    },
    [document.nodes, updateNode]
  );

  // Toggle disable
  const handleToggleDisable = useCallback(
    (nodeId: string) => {
      updateNode(nodeId, { disabled: !findNode(document.nodes, nodeId)?.disabled });
    },
    [document.nodes, updateNode]
  );

  // Load template
  const handleLoadTemplate = useCallback(
    (template: BTTemplate) => {
      const { nodes, rootId } = template.build();
      const layouted = autoLayoutTree(nodes, rootId);
      const now = new Date().toISOString();
      const newDoc: BehaviorTreeDocument = {
        version: 1,
        name: template.name,
        description: template.description,
        author: '',
        createdAt: now,
        modifiedAt: now,
        botClass: template.botClass,
        botSpec: 'Any',
        minLevel: 1,
        maxLevel: 90,
        nodes: layouted,
        rootId,
        tags: template.tags,
      };
      setDocument(newDoc);
      pushHistory(newDoc);
      setSelectedNodeId(null);
      setValidationErrors([]);
      setTimeout(() => fitView({ padding: 0.2, duration: 300 }), 100);
    },
    [pushHistory, fitView]
  );

  // New empty tree
  const handleNewTree = useCallback(() => {
    const newDoc = createEmptyDocument();
    setDocument(newDoc);
    pushHistory(newDoc);
    setSelectedNodeId(null);
    setValidationErrors([]);
  }, [pushHistory]);

  // Validate
  const handleValidate = useCallback(() => {
    const errors = validateTree(document);
    setValidationErrors(errors);
    setShowValidation(true);
  }, [document]);

  // Auto layout
  const handleAutoLayout = useCallback(() => {
    if (!document.rootId) return;
    const layouted = autoLayoutTree(document.nodes, document.rootId);
    updateDocument({ nodes: layouted });
    setTimeout(() => fitView({ padding: 0.2, duration: 300 }), 50);
  }, [document, updateDocument, fitView]);

  // Export JSON
  const handleExport = useCallback(() => {
    const json = serializeDocument(document);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = window.document.createElement('a');
    a.href = url;
    a.download = `${document.name.replace(/\s+/g, '_').toLowerCase()}.bt.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [document]);

  // Import JSON
  const handleImport = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const json = event.target?.result as string;
          const imported = deserializeDocument(json);
          setDocument(imported);
          pushHistory(imported);
          setSelectedNodeId(null);
          setValidationErrors([]);
          setTimeout(() => fitView({ padding: 0.2, duration: 300 }), 100);
        } catch (err) {
          alert(`Failed to import: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
      };
      reader.readAsText(file);
      e.target.value = '';
    },
    [pushHistory, fitView]
  );

  // Handle edge connection (reparenting)
  const onConnect: OnConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      const sourceNode = findNode(document.nodes, connection.source);
      const targetNode = findNode(document.nodes, connection.target);
      if (!sourceNode || !targetNode) return;

      // Can only connect to a node that can have children
      if (!canHaveChildren(sourceNode.type)) return;
      if (sourceNode.children.length >= maxChildren(sourceNode.type)) return;

      // Reparent the target under source
      if (targetNode.parentId) {
        // Remove from old parent
        const updatedNodes = document.nodes.map((n) => {
          if (n.id === targetNode.parentId) {
            return { ...n, children: n.children.filter((c) => c !== targetNode.id) };
          }
          if (n.id === targetNode.id) {
            return { ...n, parentId: sourceNode.id };
          }
          if (n.id === sourceNode.id) {
            return { ...n, children: [...n.children, targetNode.id] };
          }
          return n;
        });
        const layouted = document.rootId ? autoLayoutTree(updatedNodes, document.rootId) : updatedNodes;
        updateDocument({ nodes: layouted });
      }
    },
    [document, updateDocument]
  );

  // Handle node deletion from ReactFlow
  const onNodesDelete: OnNodesDelete = useCallback(
    (deleted) => {
      for (const n of deleted) {
        handleDeleteNode(n.id);
      }
    },
    [handleDeleteNode]
  );

  // Convert BT data to ReactFlow format
  const { nodes: flowNodes, edges: flowEdges } = useMemo(
    () =>
      btNodesToFlow(
        document.nodes,
        selectedNodeId,
        validationErrors,
        setSelectedNodeId,
        handleToggleCollapse,
        handleToggleDisable
      ),
    [document.nodes, selectedNodeId, validationErrors, handleToggleCollapse, handleToggleDisable]
  );

  // Use ReactFlow state hooks
  const [nodes, setNodes, onNodesChange] = useNodesState(flowNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(flowEdges);

  // Sync when BT data changes
  useEffect(() => {
    setNodes(flowNodes);
    setEdges(flowEdges);
  }, [flowNodes, flowEdges, setNodes, setEdges]);

  // Sync position changes back to BT nodes
  const handleNodesChange = useCallback(
    (changes: Parameters<typeof onNodesChange>[0]) => {
      onNodesChange(changes);

      // Update positions in document for drag moves
      for (const change of changes) {
        if (change.type === 'position' && change.position && change.dragging === false) {
          setDocument((prev) => ({
            ...prev,
            nodes: prev.nodes.map((n) =>
              n.id === change.id ? { ...n, position: change.position! } : n
            ),
          }));
        }
      }
    },
    [onNodesChange]
  );

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'z') {
        e.preventDefault();
        handleUndo();
      } else if (e.ctrlKey && e.key === 'y') {
        e.preventDefault();
        handleRedo();
      } else if (e.key === 'Delete' && selectedNodeId) {
        handleDeleteNode(selectedNodeId);
      } else if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        handleExport();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo, handleDeleteNode, handleExport, selectedNodeId]);

  const selectedNode = selectedNodeId ? findNode(document.nodes, selectedNodeId) : null;

  const errorCount = validationErrors.filter((e) => e.severity === 'error').length;
  const warningCount = validationErrors.filter((e) => e.severity === 'warning').length;

  return (
    <div className="flex h-[calc(100vh-7rem)] bg-zinc-950">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,.bt.json"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Left: Node Palette */}
      <NodePalette
        onAddNode={handleAddNode}
        onLoadTemplate={handleLoadTemplate}
        onNewTree={handleNewTree}
      />

      {/* Center: ReactFlow Canvas */}
      <div className="flex-1 relative">
        {/* Toolbar */}
        <div className="absolute top-3 left-3 right-3 z-10 flex items-center justify-between">
          <div className="flex items-center gap-1.5 bg-zinc-900/90 backdrop-blur-sm rounded-lg border border-zinc-700 p-1">
            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={handleUndo} disabled={historyIndex <= 0} title="Undo (Ctrl+Z)">
              <Undo2 className="w-3.5 h-3.5" />
            </Button>
            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={handleRedo} disabled={historyIndex >= history.length - 1} title="Redo (Ctrl+Y)">
              <Redo2 className="w-3.5 h-3.5" />
            </Button>
            <div className="w-px h-5 bg-zinc-700" />
            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={handleAutoLayout} disabled={!document.rootId} title="Auto Layout">
              <Layout className="w-3.5 h-3.5 mr-1" />
              Layout
            </Button>
            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={handleValidate} title="Validate Tree">
              <CheckCircle className="w-3.5 h-3.5 mr-1" />
              Validate
            </Button>
            <div className="w-px h-5 bg-zinc-700" />
            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={handleImport} title="Import JSON">
              <Upload className="w-3.5 h-3.5 mr-1" />
              Import
            </Button>
            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={handleExport} disabled={document.nodes.length === 0} title="Export JSON (Ctrl+S)">
              <Download className="w-3.5 h-3.5 mr-1" />
              Export
            </Button>
          </div>

          {/* Status badges */}
          <div className="flex items-center gap-2">
            {showValidation && errorCount > 0 && (
              <div className="flex items-center gap-1 bg-red-900/80 text-red-300 text-xs px-2 py-1 rounded-md">
                <AlertCircle className="w-3.5 h-3.5" />
                {errorCount} error{errorCount !== 1 ? 's' : ''}
              </div>
            )}
            {showValidation && warningCount > 0 && (
              <div className="flex items-center gap-1 bg-yellow-900/80 text-yellow-300 text-xs px-2 py-1 rounded-md">
                <AlertTriangle className="w-3.5 h-3.5" />
                {warningCount} warning{warningCount !== 1 ? 's' : ''}
              </div>
            )}
            {showValidation && errorCount === 0 && warningCount === 0 && document.nodes.length > 0 && (
              <div className="flex items-center gap-1 bg-green-900/80 text-green-300 text-xs px-2 py-1 rounded-md">
                <CheckCircle className="w-3.5 h-3.5" />
                Valid
              </div>
            )}
            <div className="bg-zinc-900/90 backdrop-blur-sm text-zinc-400 text-xs px-2.5 py-1 rounded-md border border-zinc-700">
              {document.nodes.length} nodes
            </div>
          </div>
        </div>

        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={handleNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodesDelete={onNodesDelete}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          defaultEdgeOptions={{
            type: 'smoothstep',
            animated: false,
          }}
          proOptions={{ hideAttribution: true }}
          className="bg-zinc-950"
          onPaneClick={() => setSelectedNodeId(null)}
          deleteKeyCode="Delete"
          minZoom={0.1}
          maxZoom={2}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#333" />
          <Controls className="!bg-zinc-800 !border-zinc-700 !text-white [&>button]:!bg-zinc-800 [&>button]:!border-zinc-700 [&>button:hover]:!bg-zinc-700 [&>button>svg]:!fill-white" />
          <MiniMap
            className="!bg-zinc-900 !border-zinc-700"
            nodeColor={(node) => {
              const btNode = (node.data as BTNodeData)?.btNode;
              if (!btNode) return '#555';
              const visual = NODE_VISUALS[btNode.type];
              // Extract color from Tailwind class for minimap
              const colorMap: Record<string, string> = {
                'bg-blue-600': '#2563eb',
                'bg-purple-600': '#9333ea',
                'bg-cyan-600': '#0891b2',
                'bg-amber-600': '#d97706',
                'bg-green-600': '#16a34a',
                'bg-red-500': '#ef4444',
              };
              return colorMap[visual.color] ?? '#555';
            }}
            maskColor="rgba(0,0,0,0.7)"
          />

          {/* Empty state */}
          {document.nodes.length === 0 && (
            <Panel position="top-center" className="mt-20">
              <div className="text-center bg-zinc-900/90 border border-zinc-700 rounded-lg p-6 max-w-md">
                <Layers className="w-10 h-10 text-zinc-500 mx-auto mb-3" />
                <h3 className="text-white font-bold mb-1">No Behavior Tree</h3>
                <p className="text-xs text-zinc-400 mb-4">
                  Click a node type in the palette to create a root node, or load a template to get started.
                </p>
                <div className="flex gap-2 justify-center">
                  <Button size="sm" variant="outline" className="text-xs" onClick={() => handleAddNode('selector')}>
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Add Root Selector
                  </Button>
                  <Button size="sm" variant="outline" className="text-xs" onClick={() => handleLoadTemplate(BT_TEMPLATES[0])}>
                    <FileText className="w-3.5 h-3.5 mr-1" />
                    Load Template
                  </Button>
                </div>
              </div>
            </Panel>
          )}
        </ReactFlow>
      </div>

      {/* Right: Properties Panel */}
      <PropertiesPanel
        node={selectedNode ?? null}
        onUpdateNode={updateNode}
        onDeleteNode={handleDeleteNode}
        onDuplicateNode={handleDuplicateNode}
        validationErrors={validationErrors}
        document={document}
        onUpdateDocument={(updates) =>
          setDocument((prev) => {
            const updated = { ...prev, ...updates, modifiedAt: new Date().toISOString() };
            pushHistory(updated);
            return updated;
          })
        }
      />
    </div>
  );
}

// ============================================================================
// Page Component (with Provider wrapper)
// ============================================================================

export default function BehaviorTreeEditorPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="px-4 py-3 bg-zinc-900 border-b border-zinc-700">
        <h1 className="text-lg font-bold">Visual Behavior Tree Editor</h1>
        <p className="text-xs text-zinc-400">
          Design bot AI behavior trees with drag-and-drop. Supports Sequence, Selector, Parallel, Decorator, Action, and Condition nodes.
        </p>
      </div>
      <ReactFlowProvider>
        <BehaviorTreeEditorInner />
      </ReactFlowProvider>
    </div>
  );
}
