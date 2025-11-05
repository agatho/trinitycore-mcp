'use client';

import React, { useState } from 'react';
import { GitBranch, Play, RotateCcw, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Migration {
  id: string;
  name: string;
  status: 'pending' | 'applied' | 'failed';
  appliedAt?: Date;
  sql: string;
}

export default function MigrationsPage() {
  const [migrations, setMigrations] = useState<Migration[]>([
    {
      id: '001',
      name: '2024_01_create_custom_tables.sql',
      status: 'applied',
      appliedAt: new Date(),
      sql: 'CREATE TABLE custom_table ...',
    },
    {
      id: '002',
      name: '2024_02_add_columns.sql',
      status: 'applied',
      appliedAt: new Date(),
      sql: 'ALTER TABLE ...',
    },
    {
      id: '003',
      name: '2024_03_new_indexes.sql',
      status: 'pending',
      sql: 'CREATE INDEX ...',
    },
  ]);

  const applyMigration = (id: string) => {
    setMigrations(prev =>
      prev.map(m =>
        m.id === id ? { ...m, status: 'applied' as const, appliedAt: new Date() } : m
      )
    );
  };

  const rollbackMigration = (id: string) => {
    setMigrations(prev =>
      prev.map(m => (m.id === id ? { ...m, status: 'pending' as const, appliedAt: undefined } : m))
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <GitBranch className="w-8 h-8 text-indigo-400" />
              <div>
                <h1 className="text-3xl font-bold text-white">Migration Manager</h1>
                <p className="text-slate-400">Database version control and migrations</p>
              </div>
            </div>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              New Migration
            </Button>
          </div>
        </div>

        <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-lg overflow-hidden">
          <div className="p-4 border-b border-slate-700">
            <h3 className="font-semibold text-white">Migrations ({migrations.length})</h3>
          </div>
          <div className="divide-y divide-slate-700">
            {migrations.map((migration) => (
              <div key={migration.id} className="p-4 hover:bg-slate-700/30">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="font-mono text-white">{migration.name}</span>
                      <span
                        className={`px-2 py-1 rounded text-xs ${
                          migration.status === 'applied'
                            ? 'bg-green-500/10 text-green-400 border border-green-500/30'
                            : migration.status === 'failed'
                            ? 'bg-red-500/10 text-red-400 border border-red-500/30'
                            : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/30'
                        }`}
                      >
                        {migration.status}
                      </span>
                    </div>
                    {migration.appliedAt && (
                      <div className="text-xs text-slate-500">
                        Applied: {migration.appliedAt.toLocaleString()}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {migration.status === 'pending' && (
                      <Button
                        size="sm"
                        onClick={() => applyMigration(migration.id)}
                      >
                        <Play className="w-3 h-3 mr-1" />
                        Apply
                      </Button>
                    )}
                    {migration.status === 'applied' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => rollbackMigration(migration.id)}
                      >
                        <RotateCcw className="w-3 h-3 mr-1" />
                        Rollback
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
