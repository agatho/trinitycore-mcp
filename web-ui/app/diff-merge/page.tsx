'use client';

import React, { useState } from 'react';
import { GitCompare, Download, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { SchemaDiff } from '@/lib/diff-merger';

export default function DiffMergePage() {
  const [localSQL, setLocalSQL] = useState('');
  const [remoteSQL, setRemoteSQL] = useState('');
  const [diffs, setDiffs] = useState<SchemaDiff[]>([]);
  const [diffText, setDiffText] = useState('');
  const [loading, setLoading] = useState(false);

  const compareSchemasHandler = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/diff-merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'compare-sql',
          localSQL,
          remoteSQL,
        }),
      });
      const data = await response.json();
      setDiffText(data.diff);
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-500/10 text-red-400 border-red-500/30';
      case 'major': return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30';
      default: return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8">
      <div className="max-w-[1800px] mx-auto">
        <div className="mb-8">
          <div className="flex items-center gap-3">
            <GitCompare className="w-8 h-8 text-orange-400" />
            <div>
              <h1 className="text-3xl font-bold text-white">Database Diff & Merge Tool</h1>
              <p className="text-slate-400">Compare and merge database schemas</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6 mb-6">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Local SQL</label>
            <textarea
              value={localSQL}
              onChange={(e) => setLocalSQL(e.target.value)}
              className="w-full h-96 bg-slate-800/50 border border-slate-700 rounded p-4 font-mono text-sm text-slate-300"
              placeholder="Paste local SQL here..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Remote SQL</label>
            <textarea
              value={remoteSQL}
              onChange={(e) => setRemoteSQL(e.target.value)}
              className="w-full h-96 bg-slate-800/50 border border-slate-700 rounded p-4 font-mono text-sm text-slate-300"
              placeholder="Paste remote SQL here..."
            />
          </div>
        </div>

        <div className="flex justify-center mb-6">
          <Button onClick={compareSchemasHandler} disabled={loading || !localSQL || !remoteSQL}>
            <GitCompare className="w-4 h-4 mr-2" />
            Compare Schemas
          </Button>
        </div>

        {diffText && (
          <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Differences</h3>
              <Button size="sm" variant="outline">
                <Download className="w-4 h-4 mr-2" />
                Export Diff
              </Button>
            </div>
            <pre className="bg-slate-900/50 p-4 rounded overflow-auto max-h-96 font-mono text-sm">
              {diffText.split('\n').map((line, idx) => (
                <div
                  key={idx}
                  className={
                    line.startsWith('+') ? 'text-green-400' :
                    line.startsWith('-') ? 'text-red-400' :
                    'text-slate-400'
                  }
                >
                  {line}
                </div>
              ))}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
