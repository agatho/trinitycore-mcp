'use client';

/**
 * Database Schema Explorer & Visual Query Builder
 * Enterprise-grade database schema visualization and query building tool
 */

import React, { useState, useEffect } from 'react';
import { Search, Database, Table, FileCode, Download, Play, Copy, Settings } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { format } from 'sql-formatter';
import type { TableSchema } from '@/lib/schema-parser';
import { buildQuery, createQueryBuilder, addSelectColumn, addJoin, addWhereCondition, addOrderBy, setLimit, QueryBuilder, QueryTemplates } from '@/lib/query-builder';

export default function SchemaExplorerPage() {
  const [database, setDatabase] = useState('world');
  const [tables, setTables] = useState<any[]>([]);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [tableSchema, setTableSchema] = useState<TableSchema | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('tables');

  // Query builder state
  const [queryBuilder, setQueryBuilder] = useState<QueryBuilder | null>(null);
  const [generatedSQL, setGeneratedSQL] = useState('');
  const [queryResults, setQueryResults] = useState<any[]>([]);

  // Load tables on mount
  useEffect(() => {
    loadTables();
  }, [database]);

  // Generate SQL when query builder changes
  useEffect(() => {
    if (queryBuilder) {
      try {
        const sql = buildQuery(queryBuilder);
        setGeneratedSQL(sql);
      } catch (error) {
        console.error('Error generating SQL:', error);
      }
    }
  }, [queryBuilder]);

  const loadTables = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/schema?action=list&database=${database}`);
      const data = await response.json();
      setTables(data.tables || []);
    } catch (error) {
      console.error('Failed to load tables:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTableSchema = async (tableName: string) => {
    try {
      setLoading(true);
      setSelectedTable(tableName);
      const response = await fetch(`/api/schema?action=table&database=${database}&table=${tableName}`);
      const data = await response.json();
      setTableSchema(data.table);

      // Initialize query builder for this table
      setQueryBuilder(createQueryBuilder(tableName));
    } catch (error) {
      console.error('Failed to load table schema:', error);
    } finally {
      setLoading(false);
    }
  };

  const searchTables = async () => {
    if (!searchQuery.trim()) {
      loadTables();
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`/api/schema?action=search&database=${database}&query=${encodeURIComponent(searchQuery)}`);
      const data = await response.json();

      // Convert search results to table format
      const searchTables = data.results.map((r: any) => ({
        name: r.table,
        matches: r.matches.join(', '),
      }));
      setTables(searchTables);
    } catch (error) {
      console.error('Failed to search tables:', error);
    } finally {
      setLoading(false);
    }
  };

  const copySQL = () => {
    if (generatedSQL) {
      navigator.clipboard.writeText(generatedSQL);
    }
  };

  const executeQuery = async () => {
    if (!generatedSQL) return;

    try {
      setLoading(true);
      const response = await fetch('/api/schema', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'execute',
          database,
          sql: generatedSQL,
        }),
      });
      const data = await response.json();

      if (data.error) {
        alert(`Query Error: ${data.error}`);
        setQueryResults([]);
      } else {
        setQueryResults(data.results || data.rows || []);
      }
    } catch (error: any) {
      console.error('Failed to execute query:', error);
      alert(`Execution Error: ${error.message}`);
      setQueryResults([]);
    } finally {
      setLoading(false);
    }
  };

  const downloadTableDDL = async (tableName: string) => {
    try {
      const response = await fetch(`/api/schema?action=ddl&database=${database}&table=${tableName}`);
      const data = await response.json();

      const blob = new Blob([data.ddl], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${tableName}.sql`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download DDL:', error);
    }
  };

  const filteredTables = tables.filter(table =>
    table.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8">
      <div className="max-w-[1800px] mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Database className="w-8 h-8 text-blue-400" />
            <div>
              <h1 className="text-3xl font-bold text-white">Database Schema Explorer</h1>
              <p className="text-slate-400">Visual database exploration and query building</p>
            </div>
          </div>

          {/* Database Selector */}
          <div className="flex gap-4 items-center">
            <div className="flex gap-2">
              <Button
                variant={database === 'world' ? 'default' : 'outline'}
                onClick={() => setDatabase('world')}
                className="text-sm"
              >
                World DB
              </Button>
              <Button
                variant={database === 'characters' ? 'default' : 'outline'}
                onClick={() => setDatabase('characters')}
                className="text-sm"
              >
                Characters DB
              </Button>
              <Button
                variant={database === 'auth' ? 'default' : 'outline'}
                onClick={() => setDatabase('auth')}
                className="text-sm"
              >
                Auth DB
              </Button>
            </div>

            {/* Search */}
            <div className="flex-1 max-w-md">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  type="text"
                  placeholder="Search tables, columns..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && searchTables()}
                  className="pl-10 bg-slate-800 border-slate-700 text-white"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-6">
          {/* Left Sidebar - Table List */}
          <div className="col-span-3">
            <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Table className="w-5 h-5" />
                  Tables ({filteredTables.length})
                </h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={loadTables}
                  disabled={loading}
                >
                  <Settings className="w-4 h-4" />
                </Button>
              </div>

              <div className="space-y-1 max-h-[800px] overflow-y-auto">
                {loading && filteredTables.length === 0 ? (
                  <div className="text-slate-400 text-sm text-center py-4">Loading...</div>
                ) : (
                  filteredTables.map((table) => (
                    <button
                      key={table.name}
                      onClick={() => loadTableSchema(table.name)}
                      className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                        selectedTable === table.name
                          ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                          : 'text-slate-300 hover:bg-slate-700/50'
                      }`}
                    >
                      <div className="font-medium">{table.name}</div>
                      {table.rowCount && (
                        <div className="text-xs text-slate-500 mt-1">
                          {table.rowCount.toLocaleString()} rows • {table.dataSize}
                        </div>
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="col-span-9">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="bg-slate-800/50 border-b border-slate-700">
                <TabsTrigger value="tables">Schema Browser</TabsTrigger>
                <TabsTrigger value="query-builder">Query Builder</TabsTrigger>
                <TabsTrigger value="sql-editor">SQL Editor</TabsTrigger>
              </TabsList>

              {/* Schema Browser Tab */}
              <TabsContent value="tables" className="mt-4">
                {!selectedTable ? (
                  <div className="bg-slate-800/30 backdrop-blur border border-slate-700 rounded-lg p-12 text-center">
                    <Database className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-slate-400 mb-2">
                      Select a Table
                    </h3>
                    <p className="text-slate-500">
                      Choose a table from the left sidebar to view its schema
                    </p>
                  </div>
                ) : tableSchema ? (
                  <div className="space-y-4">
                    {/* Table Info Card */}
                    <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-lg p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h2 className="text-2xl font-bold text-white mb-1">{tableSchema.name}</h2>
                          {tableSchema.comment && (
                            <p className="text-slate-400">{tableSchema.comment}</p>
                          )}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => downloadTableDDL(tableSchema.name)}
                          className="flex items-center gap-2"
                        >
                          <Download className="w-4 h-4" />
                          Export DDL
                        </Button>
                      </div>

                      <div className="grid grid-cols-4 gap-4 text-sm">
                        <div>
                          <div className="text-slate-500">Columns</div>
                          <div className="text-xl font-semibold text-white">{tableSchema.columns.length}</div>
                        </div>
                        <div>
                          <div className="text-slate-500">Rows</div>
                          <div className="text-xl font-semibold text-white">
                            {tableSchema.rowCount?.toLocaleString() || 'N/A'}
                          </div>
                        </div>
                        <div>
                          <div className="text-slate-500">Size</div>
                          <div className="text-xl font-semibold text-white">{tableSchema.dataSize || 'N/A'}</div>
                        </div>
                        <div>
                          <div className="text-slate-500">Engine</div>
                          <div className="text-xl font-semibold text-white">{tableSchema.engine || 'N/A'}</div>
                        </div>
                      </div>
                    </div>

                    {/* Columns Table */}
                    <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-lg overflow-hidden">
                      <div className="p-4 border-b border-slate-700">
                        <h3 className="font-semibold text-white">Columns</h3>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-slate-900/50">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Name</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Type</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Nullable</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Key</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Default</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Comment</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-700">
                            {tableSchema.columns.map((column) => (
                              <tr key={column.name} className="hover:bg-slate-700/30">
                                <td className="px-4 py-3 text-sm font-mono text-white">{column.name}</td>
                                <td className="px-4 py-3 text-sm font-mono text-blue-400">{column.type}</td>
                                <td className="px-4 py-3 text-sm">
                                  <span className={`px-2 py-1 rounded text-xs ${
                                    column.nullable
                                      ? 'bg-yellow-500/10 text-yellow-400'
                                      : 'bg-green-500/10 text-green-400'
                                  }`}>
                                    {column.nullable ? 'YES' : 'NO'}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-sm">
                                  {column.key && (
                                    <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                      column.key === 'PRI'
                                        ? 'bg-purple-500/10 text-purple-400'
                                        : column.key === 'UNI'
                                        ? 'bg-blue-500/10 text-blue-400'
                                        : 'bg-slate-500/10 text-slate-400'
                                    }`}>
                                      {column.key}
                                    </span>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-sm font-mono text-slate-400">
                                  {column.default || '-'}
                                </td>
                                <td className="px-4 py-3 text-sm text-slate-400">{column.comment || '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Indexes */}
                    {tableSchema.indexes.length > 0 && (
                      <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-lg overflow-hidden">
                        <div className="p-4 border-b border-slate-700">
                          <h3 className="font-semibold text-white">Indexes</h3>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead className="bg-slate-900/50">
                              <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Name</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Columns</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Type</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Unique</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700">
                              {tableSchema.indexes.map((index) => (
                                <tr key={index.name} className="hover:bg-slate-700/30">
                                  <td className="px-4 py-3 text-sm font-mono text-white">{index.name}</td>
                                  <td className="px-4 py-3 text-sm font-mono text-blue-400">
                                    {index.columns.join(', ')}
                                  </td>
                                  <td className="px-4 py-3 text-sm text-slate-400">{index.type}</td>
                                  <td className="px-4 py-3 text-sm">
                                    {index.unique && (
                                      <span className="px-2 py-1 rounded text-xs bg-green-500/10 text-green-400">
                                        Yes
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-400">Loading schema...</div>
                )}
              </TabsContent>

              {/* Query Builder Tab */}
              <TabsContent value="query-builder" className="mt-4">
                <div className="grid grid-cols-2 gap-6">
                  {/* Query Builder Panel */}
                  <div className="space-y-4">
                    <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-lg p-6">
                      <h3 className="text-lg font-semibold text-white mb-4">Visual Query Builder</h3>

                      {!selectedTable ? (
                        <div className="text-center py-8 text-slate-400">
                          Select a table to start building a query
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {/* Quick Templates */}
                          <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                              Quick Templates
                            </label>
                            <div className="flex gap-2 flex-wrap">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setQueryBuilder(QueryTemplates.selectAll(selectedTable))}
                              >
                                Select All
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setQueryBuilder(QueryTemplates.count(selectedTable))}
                              >
                                Count Rows
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  const qb = QueryTemplates.selectAll(selectedTable);
                                  setQueryBuilder(setLimit(qb, 10));
                                }}
                              >
                                Top 10
                              </Button>
                            </div>
                          </div>

                          {/* Column Selection */}
                          {tableSchema && (
                            <div>
                              <label className="block text-sm font-medium text-slate-300 mb-2">
                                Select Columns
                              </label>
                              <div className="max-h-48 overflow-y-auto space-y-1 bg-slate-900/50 p-3 rounded border border-slate-700">
                                {tableSchema.columns.map((col) => (
                                  <label key={col.name} className="flex items-center gap-2 text-sm text-slate-300">
                                    <input
                                      type="checkbox"
                                      onChange={(e) => {
                                        if (e.target.checked && queryBuilder) {
                                          setQueryBuilder(
                                            addSelectColumn(queryBuilder, selectedTable, col.name)
                                          );
                                        }
                                      }}
                                      className="rounded border-slate-600"
                                    />
                                    <span className="font-mono">{col.name}</span>
                                    <span className="text-xs text-slate-500">({col.type})</span>
                                  </label>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* SQL Preview Panel */}
                  <div className="space-y-4">
                    <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-lg overflow-hidden">
                      <div className="p-4 border-b border-slate-700 flex items-center justify-between">
                        <h3 className="font-semibold text-white">Generated SQL</h3>
                        <div className="flex gap-2">
                          <Button size="sm" variant="ghost" onClick={copySQL}>
                            <Copy className="w-4 h-4" />
                          </Button>
                          <Button size="sm" onClick={executeQuery} disabled={!generatedSQL || loading}>
                            <Play className="w-4 h-4 mr-2" />
                            Execute
                          </Button>
                        </div>
                      </div>
                      <pre className="p-4 text-sm font-mono text-slate-300 overflow-x-auto bg-slate-900/50 min-h-[200px]">
                        {generatedSQL || '-- Build a query to see the SQL here'}
                      </pre>
                    </div>

                    {/* Query Results */}
                    {queryResults.length > 0 && (
                      <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-lg overflow-hidden">
                        <div className="p-4 border-b border-slate-700">
                          <h3 className="font-semibold text-white">Query Results ({queryResults.length} rows)</h3>
                        </div>
                        <div className="overflow-x-auto max-h-96">
                          <table className="w-full">
                            <thead className="bg-slate-900/50 sticky top-0">
                              <tr>
                                {Object.keys(queryResults[0] || {}).map((key) => (
                                  <th key={key} className="px-4 py-3 text-left text-xs font-medium text-slate-400">
                                    {key}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700">
                              {queryResults.map((row, idx) => (
                                <tr key={idx} className="hover:bg-slate-700/30">
                                  {Object.values(row).map((val: any, vidx) => (
                                    <td key={vidx} className="px-4 py-3 text-sm text-slate-300">
                                      {String(val)}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>

              {/* SQL Editor Tab */}
              <TabsContent value="sql-editor" className="mt-4">
                <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">SQL Editor</h3>
                  <textarea
                    className="w-full h-96 bg-slate-900/50 border border-slate-700 rounded p-4 font-mono text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="-- Write your SQL query here&#10;SELECT * FROM creature_template LIMIT 10;"
                    value={generatedSQL}
                    onChange={(e) => setGeneratedSQL(e.target.value)}
                  />
                  <div className="flex gap-2 mt-4">
                    <Button onClick={executeQuery} disabled={!generatedSQL || loading}>
                      <Play className="w-4 h-4 mr-2" />
                      Execute Query
                    </Button>
                    <Button variant="outline" onClick={copySQL}>
                      <Copy className="w-4 h-4 mr-2" />
                      Copy SQL
                    </Button>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
}
