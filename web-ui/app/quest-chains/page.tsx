'use client';

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
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
  ReactFlowInstance,
} from 'reactflow';
import 'reactflow/dist/style.css';
import {
  GitBranch,
  Search,
  Download,
  Upload,
  AlertTriangle,
  Plus,
  Loader2,
  Info,
  MapPin,
  Target,
  Gift,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface Quest {
  id: number;
  title: string;
  level: number;
  prevQuestId?: number;
  nextQuestId?: number;
  zone?: string;
  zoneId?: number;
  faction?: string;
  depth: number;
  prerequisites?: any;
  rewards?: any;
  objectives?: any[];
}

interface Zone {
  id: number;
  name: string;
  questCount: number;
  minLevel: number;
  maxLevel: number;
}

interface QuestChain {
  chainId: string;
  quests: Quest[];
  startQuest: number;
  endQuest: number;
  totalQuests: number;
  minLevel: number;
  maxLevel: number;
  estimatedTime: number;
}

export default function QuestChainsPage() {
  const [quests, setQuests] = useState<Quest[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [selectedZone, setSelectedZone] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedQuest, setSelectedQuest] = useState<Quest | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingZones, setLoadingZones] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);

  // Fetch zones on mount
  useEffect(() => {
    fetchZones();
  }, []);

  const fetchZones = async () => {
    setLoadingZones(true);
    try {
      const response = await fetch('/api/zones');
      const data = await response.json();

      if (data.zones) {
        setZones(data.zones);
      }
    } catch (err: any) {
      console.error('Failed to fetch zones:', err);
      setError('Failed to load zones');
    } finally {
      setLoadingZones(false);
    }
  };

  const fetchQuestChain = async (questId: number) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/quest-chains?questId=${questId}`);

      if (!response.ok) {
        throw new Error('Failed to fetch quest chain');
      }

      const data: QuestChain = await response.json();

      // Transform to Quest format
      const questsData = data.quests.map((q: any) => ({
        id: q.questId,
        title: q.name,
        level: q.level,
        prevQuestId: q.previousQuest,
        nextQuestId: q.nextQuest,
        depth: q.depth,
        zone: `Zone ${q.zoneId || 'Unknown'}`,
        prerequisites: q.prerequisites,
        rewards: q.rewards,
        objectives: q.objectives,
      }));

      setQuests(questsData);
    } catch (err: any) {
      console.error('Error fetching quest chain:', err);
      setError(err.message || 'Failed to load quest chain');
    } finally {
      setLoading(false);
    }
  };

  const fetchQuestChainsInZone = async (zoneId: number) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/quest-chains?zoneId=${zoneId}`);

      if (!response.ok) {
        throw new Error('Failed to fetch quest chains');
      }

      const data = await response.json();

      if (!data.chains || data.chains.length === 0) {
        setError('No quest chains found in this zone');
        setQuests([]);
        return;
      }

      // Flatten all chains into a single quest list
      const allQuests: Quest[] = [];

      data.chains.forEach((chain: QuestChain) => {
        chain.quests.forEach((q: any) => {
          allQuests.push({
            id: q.questId,
            title: q.name,
            level: q.level,
            prevQuestId: q.previousQuest,
            nextQuestId: q.nextQuest,
            depth: q.depth,
            zone: zones.find((z) => z.id === zoneId)?.name || `Zone ${zoneId}`,
            zoneId,
          });
        });
      });

      setQuests(allQuests);
    } catch (err: any) {
      console.error('Error fetching quest chains:', err);
      setError(err.message || 'Failed to load quest chains');
    } finally {
      setLoading(false);
    }
  };

  const handleZoneChange = (zoneId: string) => {
    setSelectedZone(zoneId);
    if (zoneId) {
      fetchQuestChainsInZone(parseInt(zoneId));
    }
  };

  const handleSearch = async () => {
    if (!searchTerm.trim()) return;

    setSearching(true);
    setError(null);

    try {
      const response = await fetch(`/api/quest-chains?search=${encodeURIComponent(searchTerm)}`);

      if (!response.ok) {
        throw new Error('Search failed');
      }

      const data = await response.json();
      setSearchResults(data.quests || []);
    } catch (err: any) {
      console.error('Search error:', err);
      setError('Search failed');
    } finally {
      setSearching(false);
    }
  };

  const handleSearchResultClick = (quest: any) => {
    // Load the quest chain starting from this quest
    fetchQuestChain(quest.id);

    // Clear search results
    setSearchResults([]);
    setSearchTerm('');
  };

  // Build ReactFlow nodes and edges from quests
  const { nodes: initialNodes, edges: initialEdges } = useMemo(() => {
    const nodeMap = new Map<number, { x: number; y: number; level: number }>();

    // Calculate positions using hierarchical layout
    const byLevel = new Map<number, Quest[]>();
    quests.forEach((quest) => {
      const depth = quest.depth || calculateChainDepth(quest);
      if (!byLevel.has(depth)) byLevel.set(depth, []);
      byLevel.get(depth)!.push(quest);
    });

    // Position nodes by depth level
    byLevel.forEach((questsAtLevel, level) => {
      questsAtLevel.forEach((quest, indexAtLevel) => {
        nodeMap.set(quest.id, {
          x: level * 300,
          y: indexAtLevel * 120 + 50,
          level,
        });
      });
    });

    const nodes: Node[] = quests.map((quest) => {
      const pos = nodeMap.get(quest.id)!;
      const isBroken = quest.prevQuestId && !quests.find((q) => q.id === quest.prevQuestId);
      const isOrphaned =
        !quest.prevQuestId && !quests.find((q) => q.prevQuestId === quest.id);

      return {
        id: `quest-${quest.id}`,
        type: 'default',
        position: { x: pos.x, y: pos.y },
        data: {
          label: (
            <div className="p-2 min-w-[200px]">
              <div className="font-bold text-sm">
                [{quest.level}] {quest.title}
              </div>
              <div className="text-xs text-slate-400 mt-1">{quest.zone || 'Unknown Zone'}</div>
              {quest.prevQuestId && (
                <div className="text-xs text-blue-400 mt-1">← Quest {quest.prevQuestId}</div>
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
          border: selectedQuest?.id === quest.id ? '4px solid #fbbf24' : '2px solid #fff',
          borderRadius: '8px',
          padding: '10px',
          width: 'auto',
        },
      };
    });

    const edges: Edge[] = quests
      .filter((quest) => quest.prevQuestId)
      .map((quest) => ({
        id: `edge-${quest.prevQuestId}-${quest.id}`,
        source: `quest-${quest.prevQuestId}`,
        target: `quest-${quest.id}`,
        type: 'smoothstep',
        animated: true,
        style: { stroke: '#64748b', strokeWidth: 2 },
      }));

    return { nodes, edges };
  }, [quests, selectedQuest]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Update nodes when quests change
  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

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
      const prev = quests.find((q) => q.id === current.prevQuestId);
      if (!prev) break;
      depth++;
      current = prev;
    }

    return depth;
  }

  // Handle quest node click with view update
  const handleQuestClick = (quest: Quest) => {
    setSelectedQuest(quest);
    setShowDetailModal(true);

    // Find and focus the node in ReactFlow
    const node = nodes.find((n) => n.id === `quest-${quest.id}`);
    if (node && reactFlowInstance) {
      reactFlowInstance.fitView({
        nodes: [node],
        duration: 800,
        padding: 0.5,
        maxZoom: 1.2,
      });

      // Highlight the node
      setNodes((nds) =>
        nds.map((n) => ({
          ...n,
          style: {
            ...n.style,
            border:
              n.id === `quest-${quest.id}`
                ? '4px solid #fbbf24'
                : n.data.quest?.prevQuestId &&
                  !quests.find((q) => q.id === n.data.quest.prevQuestId)
                ? '2px solid #ef4444'
                : !n.data.quest?.prevQuestId &&
                  !quests.find((q) => q.prevQuestId === n.data.quest?.id)
                ? '2px solid #f59e0b'
                : '2px solid #fff',
          },
        }))
      );
    }
  };

  // Detect broken chains
  const brokenChains = useMemo(() => {
    const broken: string[] = [];
    quests.forEach((quest) => {
      if (quest.prevQuestId && !quests.find((q) => q.id === quest.prevQuestId)) {
        broken.push(
          `Quest ${quest.id} "${quest.title}" references missing prerequisite ${quest.prevQuestId}`
        );
      }
      if (quest.nextQuestId && !quests.find((q) => q.id === quest.nextQuestId)) {
        broken.push(
          `Quest ${quest.id} "${quest.title}" references missing follow-up ${quest.nextQuestId}`
        );
      }
    });
    return broken;
  }, [quests]);

  // Calculate statistics
  const stats = useMemo(() => {
    const chains: Record<number, number> = {};
    quests.forEach((quest) => {
      chains[quest.id] = calculateChainDepth(quest) + 1;
    });

    const longestChain = quests.length > 0 ? Math.max(...Object.values(chains)) : 0;
    const avgChain =
      Object.values(chains).length > 0
        ? Object.values(chains).reduce((a, b) => a + b, 0) / Object.values(chains).length
        : 0;
    const orphaned = quests.filter(
      (q) => !q.prevQuestId && !quests.find((o) => o.prevQuestId === q.id)
    ).length;

    return { longestChain, avgChain: avgChain.toFixed(1), orphaned };
  }, [quests]);

  const exportJSON = () => {
    const json = JSON.stringify(quests, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'quest_chains.json';
    a.click();
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
                <p className="text-slate-400">
                  Interactive quest dependency flowchart powered by TrinityCore database
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={exportJSON} disabled={quests.length === 0}>
                <Download className="w-4 h-4 mr-2" />
                Export JSON
              </Button>
            </div>
          </div>
        </div>

        {/* Zone Selector and Search */}
        <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-lg p-4">
            <label className="text-sm font-semibold text-white mb-2 block">Select Zone</label>
            {loadingZones ? (
              <div className="flex items-center gap-2 text-slate-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading zones...
              </div>
            ) : (
              <Select onValueChange={handleZoneChange} value={selectedZone}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a zone to view quest chains..." />
                </SelectTrigger>
                <SelectContent>
                  {zones.map((zone) => (
                    <SelectItem key={zone.id} value={zone.id.toString()}>
                      {zone.name} ({zone.questCount} quests, Lv {zone.minLevel}-{zone.maxLevel})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-lg p-4">
            <label className="text-sm font-semibold text-white mb-2 block">
              Search by Quest Name or ID
            </label>
            <div className="flex gap-2">
              <Input
                placeholder="Enter quest name or ID (no guessing - exact match)..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
              <Button onClick={handleSearch} disabled={searching || !searchTerm.trim()}>
                {searching ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
              </Button>
            </div>

            {/* Search Results */}
            {searchResults.length > 0 && (
              <div className="mt-3 max-h-60 overflow-y-auto space-y-2">
                {searchResults.map((quest) => (
                  <div
                    key={quest.id}
                    className="p-2 bg-slate-700/50 rounded border border-slate-600 cursor-pointer hover:bg-slate-700 transition-colors"
                    onClick={() => handleSearchResultClick(quest)}
                  >
                    <div className="font-semibold text-white text-sm">
                      [{quest.id}] {quest.title}
                    </div>
                    <div className="text-xs text-slate-400">Level {quest.level}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              <div className="text-red-400">{error}</div>
            </div>
          </div>
        )}

        {/* Broken chains warning */}
        {brokenChains.length > 0 && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold text-red-400">Broken Quest Chains Detected</div>
                <ul className="text-sm text-red-300/80 mt-2 space-y-1">
                  {brokenChains.slice(0, 10).map((error, i) => (
                    <li key={i}>• {error}</li>
                  ))}
                  {brokenChains.length > 10 && (
                    <li className="text-red-400">... and {brokenChains.length - 10} more</li>
                  )}
                </ul>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-[300px_1fr] gap-6">
          {/* Left Sidebar */}
          <div className="space-y-6">
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
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full mt-3"
                    onClick={() => setShowDetailModal(true)}
                  >
                    <Info className="w-4 h-4 mr-2" />
                    View Full Details
                  </Button>
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
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-yellow-400 rounded border-4 border-yellow-400"></div>
                  <span className="text-slate-300">Selected/Highlighted</span>
                </div>
              </div>
            </div>
          </div>

          {/* Center - Graph */}
          <div
            className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-lg p-4 relative"
            style={{ height: 700 }}
          >
            {loading && (
              <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center rounded-lg">
                <div className="text-center">
                  <Loader2 className="w-12 h-12 text-purple-400 animate-spin mx-auto mb-4" />
                  <div className="text-white font-semibold">Loading quest chains...</div>
                </div>
              </div>
            )}

            {!loading && quests.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center text-slate-400">
                  <MapPin className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-semibold">No quest chains loaded</p>
                  <p className="text-sm mt-2">Select a zone or search for a quest to get started</p>
                </div>
              </div>
            )}

            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onNodeClick={(_, node) => {
                const quest = node.data.quest as Quest;
                handleQuestClick(quest);
              }}
              onInit={setReactFlowInstance}
              fitView
            >
              <Controls />
              <Background color="#64748b" gap={16} />
              <MiniMap
                nodeColor={(node) => {
                  const quest = node.data.quest as Quest;
                  const isBroken =
                    quest.prevQuestId && !quests.find((q) => q.id === quest.prevQuestId);
                  const isOrphaned =
                    !quest.prevQuestId && !quests.find((q) => q.prevQuestId === quest.id);
                  return isBroken ? '#ef4444' : isOrphaned ? '#f59e0b' : '#3b82f6';
                }}
              />
            </ReactFlow>
          </div>
        </div>
      </div>

      {/* Quest Detail Modal */}
      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl">
              [{selectedQuest?.id}] {selectedQuest?.title}
            </DialogTitle>
            <DialogDescription>Level {selectedQuest?.level} Quest</DialogDescription>
          </DialogHeader>

          {selectedQuest && (
            <Tabs defaultValue="overview" className="mt-4">
              <TabsList>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="objectives">
                  <Target className="w-4 h-4 mr-2" />
                  Objectives
                </TabsTrigger>
                <TabsTrigger value="rewards">
                  <Gift className="w-4 h-4 mr-2" />
                  Rewards
                </TabsTrigger>
                <TabsTrigger value="chain">
                  <ChevronRight className="w-4 h-4 mr-2" />
                  Chain Info
                </TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-slate-400">Quest ID:</span>
                    <span className="text-white ml-2 font-mono">{selectedQuest.id}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Level:</span>
                    <span className="text-white ml-2">{selectedQuest.level}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Zone:</span>
                    <span className="text-white ml-2">{selectedQuest.zone}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Chain Depth:</span>
                    <span className="text-white ml-2">
                      {calculateChainDepth(selectedQuest) + 1}
                    </span>
                  </div>
                </div>

                {selectedQuest.prerequisites && (
                  <div className="mt-4 p-4 bg-slate-800 rounded-lg">
                    <h4 className="font-semibold text-white mb-2">Prerequisites</h4>
                    <div className="space-y-2 text-sm">
                      {selectedQuest.prerequisites.minLevel > 0 && (
                        <div>
                          <span className="text-slate-400">Min Level:</span>
                          <span className="text-white ml-2">
                            {selectedQuest.prerequisites.minLevel}
                          </span>
                        </div>
                      )}
                      {selectedQuest.prerequisites.previousQuestName && (
                        <div>
                          <span className="text-slate-400">Previous Quest:</span>
                          <span className="text-white ml-2">
                            {selectedQuest.prerequisites.previousQuestName}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="objectives">
                {selectedQuest.objectives && selectedQuest.objectives.length > 0 ? (
                  <div className="space-y-3">
                    {selectedQuest.objectives.map((obj: any, idx: number) => (
                      <div key={idx} className="p-3 bg-slate-800 rounded-lg">
                        <div className="font-semibold text-white">{obj.description}</div>
                        <div className="text-sm text-slate-400 mt-1">
                          Type: {obj.type} • Required: {obj.requiredAmount}
                        </div>
                        <div className="text-xs text-slate-500 mt-1">
                          Est. Time: {obj.estimatedTime} min • Difficulty: {obj.difficultyRating}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-slate-400 py-8">
                    <Info className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    No objective data available
                  </div>
                )}
              </TabsContent>

              <TabsContent value="rewards">
                {selectedQuest.rewards ? (
                  <div className="space-y-4">
                    {selectedQuest.rewards.rewardXP > 0 && (
                      <div className="p-3 bg-slate-800 rounded-lg">
                        <span className="text-slate-400">Experience:</span>
                        <span className="text-white ml-2 font-semibold">
                          {selectedQuest.rewards.rewardXP} XP
                        </span>
                      </div>
                    )}

                    {selectedQuest.rewards.rewardMoney > 0 && (
                      <div className="p-3 bg-slate-800 rounded-lg">
                        <span className="text-slate-400">Gold:</span>
                        <span className="text-white ml-2 font-semibold">
                          {(selectedQuest.rewards.rewardMoney / 10000).toFixed(2)} gold
                        </span>
                      </div>
                    )}

                    {selectedQuest.rewards.choiceRewards &&
                      selectedQuest.rewards.choiceRewards.length > 0 && (
                        <div className="p-3 bg-slate-800 rounded-lg">
                          <h4 className="font-semibold text-white mb-2">Choice Rewards</h4>
                          <div className="space-y-2">
                            {selectedQuest.rewards.choiceRewards.map((item: any, idx: number) => (
                              <div key={idx} className="text-sm">
                                <span className="text-blue-400">Item {item.itemId}</span>
                                <span className="text-slate-400 ml-2">x{item.quantity}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                  </div>
                ) : (
                  <div className="text-center text-slate-400 py-8">
                    <Gift className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    No reward data available
                  </div>
                )}
              </TabsContent>

              <TabsContent value="chain">
                <div className="space-y-4">
                  <div className="p-4 bg-slate-800 rounded-lg">
                    <h4 className="font-semibold text-white mb-3">Chain Position</h4>
                    <div className="text-sm space-y-2">
                      <div>
                        <span className="text-slate-400">Depth in Chain:</span>
                        <span className="text-white ml-2">
                          Level {calculateChainDepth(selectedQuest) + 1}
                        </span>
                      </div>

                      {selectedQuest.prevQuestId && (
                        <div>
                          <span className="text-slate-400">Previous Quest:</span>
                          <span className="text-white ml-2">
                            {selectedQuest.prevQuestId}
                            {selectedQuest.prerequisites?.previousQuestName &&
                              ` - ${selectedQuest.prerequisites.previousQuestName}`}
                          </span>
                        </div>
                      )}

                      {selectedQuest.nextQuestId && (
                        <div>
                          <span className="text-slate-400">Next Quest:</span>
                          <span className="text-white ml-2">{selectedQuest.nextQuestId}</span>
                        </div>
                      )}

                      {!selectedQuest.prevQuestId && !selectedQuest.nextQuestId && (
                        <div className="text-yellow-400">
                          This quest is not part of a chain (standalone quest)
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
