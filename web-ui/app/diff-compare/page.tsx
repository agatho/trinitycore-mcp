'use client';

import React, { useState } from 'react';
import { GitCompare, Search, ArrowLeftRight, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function DiffComparePage() {
  const [leftId, setLeftId] = useState('');
  const [rightId, setRightId] = useState('');
  const [leftData, setLeftData] = useState<any>(null);
  const [rightData, setRightData] = useState<any>(null);
  const [compareType, setCompareType] = useState<'spell' | 'item' | 'creature'>('spell');
  const [loading, setLoading] = useState(false);

  const fetchData = async (id: string, type: string) => {
    const response = await fetch(`/api/${type}/${id}`);
    if (!response.ok) return null;
    return response.json();
  };

  const handleCompare = async () => {
    setLoading(true);
    try {
      const [left, right] = await Promise.all([
        fetchData(leftId, compareType),
        fetchData(rightId, compareType),
      ]);
      setLeftData(left);
      setRightData(right);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      alert('Failed to fetch data. Make sure the IDs are valid.');
    } finally {
      setLoading(false);
    }
  };

  const formatDataForDiff = (data: any): string => {
    if (!data) return '';
    return JSON.stringify(data, null, 2);
  };

  const generateDiffReport = () => {
    if (!leftData || !rightData) return '';

    let report = `# Comparison Report\n\n`;
    report += `## ${compareType.toUpperCase()} Comparison\n`;
    report += `Left: ${compareType} ${leftId}\n`;
    report += `Right: ${compareType} ${rightId}\n\n`;

    report += `### Differences:\n`;
    const leftKeys = new Set(Object.keys(leftData));
    const rightKeys = new Set(Object.keys(rightData));

    // Find modified keys
    const allKeys = new Set([...leftKeys, ...rightKeys]);
    allKeys.forEach(key => {
      if (leftData[key] !== rightData[key]) {
        report += `- **${key}**: ${leftData[key]} → ${rightData[key]}\n`;
      }
    });

    return report;
  };

  const exportDiff = () => {
    const report = generateDiffReport();
    const blob = new Blob([report], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${compareType}_comparison_${leftId}_vs_${rightId}.md`;
    a.click();
  };

  const highlightedDifferences = () => {
    if (!leftData || !rightData) return [];

    const diffs: Array<{ field: string; left: any; right: any; severity: 'critical' | 'major' | 'minor' }> = [];

    Object.keys({ ...leftData, ...rightData }).forEach(key => {
      if (leftData[key] !== rightData[key]) {
        let severity: 'critical' | 'major' | 'minor' = 'minor';

        // Determine severity based on field type
        if (['id', 'entry', 'spellID'].includes(key)) {
          severity = 'critical';
        } else if (['name', 'description', 'damage', 'armor'].includes(key)) {
          severity = 'major';
        }

        diffs.push({
          field: key,
          left: leftData[key],
          right: rightData[key],
          severity,
        });
      }
    });

    return diffs;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8">
      <div className="max-w-[1800px] mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <GitCompare className="w-8 h-8 text-cyan-400" />
              <div>
                <h1 className="text-3xl font-bold text-white">Spell/Item Compare & Diff</h1>
                <p className="text-slate-400">Visual diff comparison with highlighted changes</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={exportDiff}
                disabled={!leftData || !rightData}
              >
                <Download className="w-4 h-4 mr-2" />
                Export Diff
              </Button>
            </div>
          </div>
        </div>

        {/* Compare Controls */}
        <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-lg p-6 mb-6">
          <div className="flex items-end gap-4">
            <div className="flex-1">
              <label className="text-sm text-slate-400 mb-2 block">Type</label>
              <select
                className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white"
                value={compareType}
                onChange={(e) => setCompareType(e.target.value as any)}
              >
                <option value="spell">Spell</option>
                <option value="item">Item</option>
                <option value="creature">Creature</option>
              </select>
            </div>

            <div className="flex-1">
              <label className="text-sm text-slate-400 mb-2 block">Left ID</label>
              <Input
                type="number"
                placeholder="Enter ID..."
                value={leftId}
                onChange={(e) => setLeftId(e.target.value)}
              />
            </div>

            <div className="pt-6">
              <ArrowLeftRight className="w-5 h-5 text-slate-400" />
            </div>

            <div className="flex-1">
              <label className="text-sm text-slate-400 mb-2 block">Right ID</label>
              <Input
                type="number"
                placeholder="Enter ID..."
                value={rightId}
                onChange={(e) => setRightId(e.target.value)}
              />
            </div>

            <Button
              onClick={handleCompare}
              disabled={!leftId || !rightId || loading}
            >
              <GitCompare className="w-4 h-4 mr-2" />
              {loading ? 'Loading...' : 'Compare'}
            </Button>
          </div>
        </div>

        {leftData && rightData && (
          <Tabs defaultValue="diff" className="space-y-6">
            <TabsList>
              <TabsTrigger value="diff">Visual Diff</TabsTrigger>
              <TabsTrigger value="side-by-side">Side by Side</TabsTrigger>
              <TabsTrigger value="highlights">Highlighted Changes</TabsTrigger>
            </TabsList>

            <TabsContent value="diff">
              <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-lg overflow-hidden p-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-slate-400 mb-2 font-semibold">
                      {compareType} {leftId}
                    </div>
                    <pre className="bg-slate-900/50 p-4 rounded text-xs font-mono text-white overflow-auto max-h-[600px]">
                      {formatDataForDiff(leftData)}
                    </pre>
                  </div>
                  <div>
                    <div className="text-sm text-slate-400 mb-2 font-semibold">
                      {compareType} {rightId}
                    </div>
                    <pre className="bg-slate-900/50 p-4 rounded text-xs font-mono text-white overflow-auto max-h-[600px]">
                      {formatDataForDiff(rightData)}
                    </pre>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="side-by-side">
              <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-lg overflow-hidden p-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-slate-400 mb-2 font-semibold">
                      {compareType} {leftId}
                    </div>
                    <pre className="bg-slate-900/50 p-4 rounded text-xs font-mono text-white overflow-auto max-h-[600px]">
                      {formatDataForDiff(leftData)}
                    </pre>
                  </div>
                  <div>
                    <div className="text-sm text-slate-400 mb-2 font-semibold">
                      {compareType} {rightId}
                    </div>
                    <pre className="bg-slate-900/50 p-4 rounded text-xs font-mono text-white overflow-auto max-h-[600px]">
                      {formatDataForDiff(rightData)}
                    </pre>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="highlights">
              <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-white mb-4">
                  {highlightedDifferences().length} Differences Found
                </h3>

                <div className="space-y-3">
                  {highlightedDifferences().map((diff, i) => (
                    <div
                      key={i}
                      className={`p-4 rounded border ${
                        diff.severity === 'critical'
                          ? 'bg-red-500/10 border-red-500/30'
                          : diff.severity === 'major'
                          ? 'bg-yellow-500/10 border-yellow-500/30'
                          : 'bg-blue-500/10 border-blue-500/30'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="font-semibold text-white">{diff.field}</div>
                        <span
                          className={`text-xs px-2 py-1 rounded ${
                            diff.severity === 'critical'
                              ? 'bg-red-500 text-white'
                              : diff.severity === 'major'
                              ? 'bg-yellow-500 text-black'
                              : 'bg-blue-500 text-white'
                          }`}
                        >
                          {diff.severity.toUpperCase()}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <div className="text-slate-400 text-xs mb-1">Left ({leftId})</div>
                          <div className="bg-slate-900/50 p-2 rounded font-mono">
                            {JSON.stringify(diff.left, null, 2)}
                          </div>
                        </div>
                        <div>
                          <div className="text-slate-400 text-xs mb-1">Right ({rightId})</div>
                          <div className="bg-slate-900/50 p-2 rounded font-mono">
                            {JSON.stringify(diff.right, null, 2)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {highlightedDifferences().length === 0 && (
                  <div className="text-center text-slate-400 py-8">
                    No differences found. The {compareType}s are identical.
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        )}

        {!leftData && !rightData && (
          <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-lg p-12 text-center">
            <GitCompare className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-slate-400 mb-2">
              Ready to Compare
            </h3>
            <p className="text-slate-500">
              Enter two {compareType} IDs above and click Compare to see the differences
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
