'use client';

import React, { useState, useCallback, useMemo } from 'react';
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
  Position,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { GitBranch, Search, Download, Upload, AlertTriangle, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface Quest {
  id: number;
  title: string;
  level: number;
  prevQuestId?: number;
  nextQuestId?: number;
  zone: string;
  faction?: string;
}

// Sample quest data
const SAMPLE_QUESTS: Quest[] = [
  { id: 1, title: 'The Beginning', level: 1, zone: 'Elwynn Forest' },
  { id: 2, title: 'Wolves at the Door', level: 2, prevQuestId: 1, zone: 'Elwynn Forest' },
  { id: 3, title: 'Investigate the Camp', level: 3, prevQuestId: 2, zone: 'Elwynn Forest' },
  { id: 4, title: 'Report to Goldshire', level: 4, prevQuestId: 3, zone: 'Elwynn Forest' },
  { id: 5, title: 'Kobold Candles', level: 4, prevQuestId: 4, zone: 'Elwynn Forest' },
  { id: 6, title: 'The Fargodeep Mine', level: 5, prevQuestId: 5, zone: 'Elwynn Forest' },
  { id: 7, title: 'The Jasperlode Mine', level: 5, prevQuestId: 5, zone: 'Elwynn Forest' },
  { id: 8, title: 'Westbrook Garrison', level: 6, prevQuestId: 6, zone: 'Elwynn Forest' },
  { id: 9, title: 'Riverpaw Gnoll Bounty', level: 6, prevQuestId: 8, zone: 'Elwynn Forest' },
  { id: 10, title: 'Protect the Frontier', level: 7, prevQuestId: 9, zone: 'Elwynn Forest' },
  { id: 11, title: 'Into Westfall', level: 10, prevQuestId: 10, zone: 'Westfall' },
  { id: 12, title: 'The People\'s Militia', level: 10, zone: 'Westfall' }, // Orphaned
];

export default function QuestChainsPage() {
  const [quests, setQuests] = useState<Quest[]>(SAMPLE_QUESTS);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedQuest, setSelectedQuest] = useState<Quest | null>(null);

  // Build ReactFlow nodes and edges from quests
  const { nodes: initialNodes, edges: initialEdges } = useMemo(() => {
    const nodeMap = new Map<number, { x: number; y: number; level: number }>();

    // Calculate positions using hierarchical layout
    quests.forEach((quest, index) => {
      const chainDepth = calculateChainDepth(quest);
      nodeMap.set(quest.id, {
        x: chainDepth * 250,
        y: index * 120,
        level: chainDepth,
      });
    });

    // Optimize layout - group by chain depth
    const byLevel = new Map<number, Quest[]>();
    quests.forEach(quest => {
      const depth = calculateChainDepth(quest);
      if (!byLevel.has(depth)) byLevel.set(depth, []);
      byLevel.get(depth)!.push(quest);
    });

    // Re-position with better spacing
    byLevel.forEach((questsAtLevel, level) => {
      questsAtLevel.forEach((quest, indexAtLevel) => {
        nodeMap.set(quest.id, {
          x: level * 280,
          y: indexAtLevel * 100 + 50,
          level,
        });
      });
    });

    const nodes: Node[] = quests.map(quest => {
      const pos = nodeMap.get(quest.id)!;
      const isBroken = quest.prevQuestId && !quests.find(q => q.id === quest.prevQuestId);
      const isOrphaned = !quest.prevQuestId && !quests.find(q => q.prevQuestId === quest.id);

      return {
        id: `quest-${quest.id}`,
        type: 'default',
        position: { x: pos.x, y: pos.y },
        data: {
          label: (
            <div className="p-2 min-w-[200px]">
              <div className="font-bold text-sm">[{quest.level}] {quest.title}</div>
              <div className="text-xs text-slate-400 mt-1">{quest.zone}</div>
              {quest.prevQuestId && (
                <div className="text-xs text-blue-400 mt-1">
                  ← Quest {quest.prevQuestId}
                </div>
              )}
            </div>
          ),
          quest,
        },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
        style: {
          background: isBroken ? '#ef4444' : isOrphaned ? '#f59e0b' : '#3b82f6',
          color: 'white',
          border: '2px solid #fff',
          borderRadius: '8px',
          padding: '10px',
          width: 'auto',
        },
      };
    });

    const edges: Edge[] = quests
      .filter(quest => quest.prevQuestId)
      .map(quest => ({
        id: `edge-${quest.prevQuestId}-${quest.id}`,
        source: `quest-${quest.prevQuestId}`,
        target: `quest-${quest.id}`,
        type: 'smoothstep',
        animated: true,
        style: { stroke: '#64748b', strokeWidth: 2 },
      }));

    return { nodes, edges };
  }, [quests]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  // Calculate chain depth for a quest
  function calculateChainDepth(quest: Quest): number {
    let depth = 0;
    let current = quest;
    const visited = new Set<number>();

    while (current.prevQuestId && !visited.has(current.id)) {
      visited.add(current.id);
      const prev = quests.find(q => q.id === current.prevQuestId);
      if (!prev) break;
      depth++;
      current = prev;
    }

    return depth;
  }

  // Detect broken chains
  const brokenChains = useMemo(() => {
    const broken: string[] = [];
    quests.forEach(quest => {
      if (quest.prevQuestId && !quests.find(q => q.id === quest.prevQuestId)) {
        broken.push(`Quest ${quest.id} "${quest.title}" references missing prerequisite ${quest.prevQuestId}`);
      }
      if (quest.nextQuestId && !quests.find(q => q.id === quest.nextQuestId)) {
        broken.push(`Quest ${quest.id} "${quest.title}" references missing follow-up ${quest.nextQuestId}`);
      }
    });
    return broken;
  }, [quests]);

  // Calculate statistics
  const stats = useMemo(() => {
    const chains: Record<number, number> = {};
    quests.forEach(quest => {
      chains[quest.id] = calculateChainDepth(quest) + 1;
    });

    const longestChain = Math.max(...Object.values(chains));
    const avgChain = Object.values(chains).reduce((a, b) => a + b, 0) / Object.values(chains).length;
    const orphaned = quests.filter(q => !q.prevQuestId && !quests.find(o => o.prevQuestId === q.id)).length;

    return { longestChain, avgChain: avgChain.toFixed(1), orphaned };
  }, [quests]);

  const filteredQuests = quests.filter(q =>
    q.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    q.zone.toLowerCase().includes(searchTerm.toLowerCase()) ||
    q.id.toString().includes(searchTerm)
  );

  const exportJSON = () => {
    const json = JSON.stringify(quests, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'quest_chains.json';
    a.click();
  };

  const importJSON = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e: any) => {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target?.result as string);
          setQuests(data);
        } catch (error) {
          alert('Invalid JSON file');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const addQuest = () => {
    const newQuest: Quest = {
      id: Math.max(...quests.map(q => q.id)) + 1,
      title: `New Quest ${quests.length + 1}`,
      level: 1,
      zone: 'Custom Zone',
    };
    setQuests([...quests, newQuest]);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8">
      <div className="max-w-[1800px] mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <GitBranch className="w-8 h-8 text-purple-400" />
              <div>
                <h1 className="text-3xl font-bold text-white">Quest Chain Visualizer</h1>
                <p className="text-slate-400">Interactive quest dependency flowchart with ReactFlow</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={addQuest}>
                <Plus className="w-4 h-4 mr-2" />
                Add Quest
              </Button>
              <Button variant="outline" onClick={exportJSON}>
                <Download className="w-4 h-4 mr-2" />
                Export JSON
              </Button>
              <Button variant="outline" onClick={importJSON}>
                <Upload className="w-4 h-4 mr-2" />
                Import JSON
              </Button>
            </div>
          </div>
        </div>

        {/* Broken chains warning */}
        {brokenChains.length > 0 && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold text-red-400">Broken Quest Chains Detected</div>
                <ul className="text-sm text-red-300/80 mt-2 space-y-1">
                  {brokenChains.map((error, i) => (
                    <li key={i}>• {error}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-[300px_1fr] gap-6">
          {/* Left Sidebar */}
          <div className="space-y-6">
            <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-white mb-4">Search Quests</h3>
              <Input
                placeholder="Search by title, zone, or ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="mb-4"
              />

              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {filteredQuests.map(quest => (
                  <div
                    key={quest.id}
                    className="p-3 bg-slate-700/50 rounded border border-slate-600 cursor-pointer hover:bg-slate-700 transition-colors"
                    onClick={() => setSelectedQuest(quest)}
                  >
                    <div className="font-semibold text-white text-sm">{quest.title}</div>
                    <div className="text-xs text-slate-400 mt-1">
                      Level {quest.level} • {quest.zone}
                    </div>
                    {quest.prevQuestId && (
                      <div className="text-xs text-blue-400 mt-1">
                        ← Requires: Quest {quest.prevQuestId}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-white mb-4">Statistics</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">Total Quests:</span>
                  <span className="text-white font-semibold">{quests.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Longest Chain:</span>
                  <span className="text-white font-semibold">{stats.longestChain} quests</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Avg Chain Length:</span>
                  <span className="text-white font-semibold">{stats.avgChain}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Orphaned Quests:</span>
                  <span className="text-white font-semibold">{stats.orphaned}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Broken Chains:</span>
                  <span className="text-red-400 font-semibold">{brokenChains.length}</span>
                </div>
              </div>
            </div>

            {selectedQuest && (
              <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-white mb-4">Selected Quest</h3>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-slate-400">ID:</span>
                    <span className="text-white ml-2">{selectedQuest.id}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Title:</span>
                    <span className="text-white ml-2">{selectedQuest.title}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Level:</span>
                    <span className="text-white ml-2">{selectedQuest.level}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Zone:</span>
                    <span className="text-white ml-2">{selectedQuest.zone}</span>
                  </div>
                  {selectedQuest.prevQuestId && (
                    <div>
                      <span className="text-slate-400">Prerequisite:</span>
                      <span className="text-white ml-2">Quest {selectedQuest.prevQuestId}</span>
                    </div>
                  )}
                  <div>
                    <span className="text-slate-400">Chain Depth:</span>
                    <span className="text-white ml-2">{calculateChainDepth(selectedQuest) + 1}</span>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-white mb-3">Legend</h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-blue-500 rounded"></div>
                  <span className="text-slate-300">Normal Quest</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-red-500 rounded"></div>
                  <span className="text-slate-300">Broken Chain</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-amber-500 rounded"></div>
                  <span className="text-slate-300">Orphaned Quest</span>
                </div>
              </div>
            </div>
          </div>

          {/* Center - Graph */}
          <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-lg p-4" style={{ height: 700 }}>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onNodeClick={(_, node) => {
                const quest = node.data.quest as Quest;
                setSelectedQuest(quest);
              }}
              fitView
            >
              <Controls />
              <Background color="#64748b" gap={16} />
              <MiniMap
                nodeColor={(node) => {
                  const quest = node.data.quest as Quest;
                  const isBroken = quest.prevQuestId && !quests.find(q => q.id === quest.prevQuestId);
                  const isOrphaned = !quest.prevQuestId && !quests.find(q => q.prevQuestId === quest.id);
                  return isBroken ? '#ef4444' : isOrphaned ? '#f59e0b' : '#3b82f6';
                }}
              />
            </ReactFlow>
          </div>
        </div>
      </div>
    </div>
  );
}
