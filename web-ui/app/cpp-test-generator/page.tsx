"use client";

import { useState, useCallback } from "react";

// ============================================================================
// Types
// ============================================================================

interface TestCase {
  testName: string;
  testSuite: string;
  targetFunction: string;
  testType: "unit" | "boundary" | "null_check" | "exception" | "regression" | "smoke";
  description: string;
  priority: "critical" | "high" | "medium" | "low";
}

interface TestStats {
  totalTests: number;
  unitTests: number;
  boundaryTests: number;
  nullCheckTests: number;
  exceptionTests: number;
}

interface GenerationResult {
  fileName: string;
  testSuite: string;
  sourceFile: string;
  stats: TestStats;
  cmakeEntry: string;
  testCases: TestCase[];
  generatedCode?: string;
  generatedAt: string;
}

interface CppClass {
  name: string;
  baseClasses: string[];
  isAbstract: boolean;
  methodCount: number;
  constructorCount: number;
  memberVariableCount: number;
  methods: Array<{
    name: string;
    returnType: string;
    paramCount: number;
    isConst: boolean;
    isStatic: boolean;
    isVirtual: boolean;
    complexity: number;
    lineNumber: number;
  }>;
  lineNumber: number;
}

interface CppFreeFunction {
  name: string;
  returnType: string;
  paramCount: number;
  isStatic: boolean;
  complexity: number;
  lineNumber: number;
}

interface AnalysisResult {
  filePath: string;
  totalLines: number;
  testableItems: number;
  includes: string[];
  namespaces: string[];
  classes: CppClass[];
  freeFunctions: CppFreeFunction[];
}

interface RecentGeneration {
  id: string;
  filePath: string;
  testSuite: string;
  testCount: number;
  generatedAt: string;
  stats: TestStats;
}

// ============================================================================
// Helpers
// ============================================================================

function priorityColor(priority: string): string {
  switch (priority) {
    case "critical": return "text-red-400 bg-red-900/30";
    case "high": return "text-orange-400 bg-orange-900/30";
    case "medium": return "text-yellow-400 bg-yellow-900/30";
    case "low": return "text-blue-400 bg-blue-900/30";
    default: return "text-gray-400 bg-gray-900/30";
  }
}

function testTypeColor(type: string): string {
  switch (type) {
    case "unit": return "text-green-400 bg-green-900/30";
    case "boundary": return "text-cyan-400 bg-cyan-900/30";
    case "null_check": return "text-red-400 bg-red-900/30";
    case "exception": return "text-purple-400 bg-purple-900/30";
    case "regression": return "text-orange-400 bg-orange-900/30";
    case "smoke": return "text-blue-400 bg-blue-900/30";
    default: return "text-gray-400 bg-gray-900/30";
  }
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <div className="text-sm text-gray-400">{label}</div>
      <div className="text-2xl font-bold text-white mt-1">{value}</div>
      {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
    </div>
  );
}

// ============================================================================
// Tabs
// ============================================================================

type TabKey = "generate" | "analysis" | "results" | "history";

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: "generate", label: "Generate Tests" },
  { key: "analysis", label: "Source Analysis" },
  { key: "results", label: "Test Cases" },
  { key: "history", label: "History" },
];

const SAMPLE_SOURCE = `#include "SpellManager.h"
#include "Unit.h"

class SpellManager {
public:
    SpellManager();
    ~SpellManager();

    bool CastSpell(uint32 spellId, Unit* target);
    float CalculateDamage(uint32 spellId, uint32 level) const;
    void RemoveAura(uint32 auraId);
    const SpellInfo* GetSpellInfo(uint32 spellId) const;
    int32 GetCooldownRemaining(uint32 spellId) const;

private:
    std::map<uint32, SpellInfo*> _spellMap;
    uint32 _ownerId;
};

bool IsValidSpellTarget(Unit* caster, Unit* target, uint32 spellId);
float GetSpellRange(uint32 spellId);
uint32 CalculateSpellCost(uint32 spellId, uint32 level);`;

// ============================================================================
// Main Page
// ============================================================================

export default function CppTestGeneratorPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("generate");
  const [source, setSource] = useState(SAMPLE_SOURCE);
  const [filePath, setFilePath] = useState("src/server/game/Spells/SpellManager.h");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generationResult, setGenerationResult] = useState<GenerationResult | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [recentGenerations, setRecentGenerations] = useState<RecentGeneration[]>([]);

  // Options
  const [includeEdgeCases, setIncludeEdgeCases] = useState(true);
  const [includeNullChecks, setIncludeNullChecks] = useState(true);

  const generateTests = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/cpp-test-gen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate-tests",
          source,
          filePath,
          includeEdgeCases,
          includeNullChecks,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      const data = await res.json();
      setGenerationResult(data);
      setActiveTab("results");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [source, filePath, includeEdgeCases, includeNullChecks]);

  const analyzeSource = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/cpp-test-gen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "analyze-source", source, filePath }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      const data = await res.json();
      setAnalysisResult(data.analysis);
      setActiveTab("analysis");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [source, filePath]);

  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/cpp-test-gen?action=recent-generations");
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      const data = await res.json();
      setRecentGenerations(data.generations);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    }
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">C++ Test Generator</h1>
          <p className="text-gray-400 mt-2">
            Analyze TrinityCore C++ source files and generate Google Test compatible test suites
          </p>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="bg-red-900/50 border border-red-600 rounded-lg p-4 mb-6">
            <p className="text-red-300">{error}</p>
            <button onClick={() => setError(null)} className="text-red-400 underline text-sm mt-1">
              Dismiss
            </button>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex space-x-1 mb-6 bg-gray-800 rounded-lg p-1 w-fit">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => {
                setActiveTab(tab.key);
                if (tab.key === "history") loadHistory();
              }}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? "bg-blue-600 text-white"
                  : "text-gray-400 hover:text-white hover:bg-gray-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Generate Tab */}
        {activeTab === "generate" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Source Input */}
              <div className="lg:col-span-2">
                <label className="block text-sm font-medium text-gray-300 mb-2">C++ Source Code</label>
                <textarea
                  value={source}
                  onChange={e => setSource(e.target.value)}
                  className="w-full h-96 bg-gray-800 text-gray-100 font-mono text-sm p-4 rounded-lg border border-gray-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-y"
                  placeholder="Paste your C++ header or source file here..."
                  spellCheck={false}
                />
              </div>

              {/* Options Panel */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">File Path</label>
                  <input
                    type="text"
                    value={filePath}
                    onChange={e => setFilePath(e.target.value)}
                    className="w-full bg-gray-800 text-gray-100 px-3 py-2 rounded-lg border border-gray-700 focus:border-blue-500 text-sm"
                    placeholder="src/server/game/..."
                  />
                </div>

                <div className="bg-gray-800 rounded-lg p-4 space-y-3">
                  <h3 className="text-sm font-medium text-gray-300">Generation Options</h3>

                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeEdgeCases}
                      onChange={e => setIncludeEdgeCases(e.target.checked)}
                      className="rounded border-gray-600 bg-gray-700 text-blue-500"
                    />
                    <span className="text-sm text-gray-400">Boundary/edge-case tests</span>
                  </label>

                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeNullChecks}
                      onChange={e => setIncludeNullChecks(e.target.checked)}
                      className="rounded border-gray-600 bg-gray-700 text-blue-500"
                    />
                    <span className="text-sm text-gray-400">Null pointer checks</span>
                  </label>
                </div>

                <div className="space-y-2">
                  <button
                    onClick={generateTests}
                    disabled={loading || !source.trim()}
                    className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-medium py-3 px-4 rounded-lg transition-colors"
                  >
                    {loading ? "Generating..." : "Generate Tests"}
                  </button>

                  <button
                    onClick={analyzeSource}
                    disabled={loading || !source.trim()}
                    className="w-full bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-500 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                  >
                    {loading ? "Analyzing..." : "Analyze Only"}
                  </button>
                </div>

                {/* Quick stats */}
                {source.trim() && (
                  <div className="bg-gray-800 rounded-lg p-4">
                    <h3 className="text-sm font-medium text-gray-300 mb-2">Source Stats</h3>
                    <div className="space-y-1 text-xs text-gray-400">
                      <div>Lines: {source.split("\n").length}</div>
                      <div>Characters: {source.length.toLocaleString()}</div>
                      <div>
                        Includes: {(source.match(/#include/g) || []).length}
                      </div>
                      <div>
                        Classes: {(source.match(/\bclass\s+\w+/g) || []).length}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Analysis Tab */}
        {activeTab === "analysis" && analysisResult && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="Total Lines" value={analysisResult.totalLines} />
              <StatCard label="Testable Items" value={analysisResult.testableItems} />
              <StatCard label="Classes" value={analysisResult.classes.length} />
              <StatCard label="Free Functions" value={analysisResult.freeFunctions.length} />
            </div>

            {/* Includes */}
            {analysisResult.includes.length > 0 && (
              <div className="bg-gray-800 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-300 mb-2">Includes</h3>
                <div className="flex flex-wrap gap-2">
                  {analysisResult.includes.map((inc, i) => (
                    <span key={i} className="text-xs bg-gray-700 text-gray-300 px-2 py-1 rounded font-mono">
                      {inc}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Classes */}
            {analysisResult.classes.map((cls, i) => (
              <div key={i} className="bg-gray-800 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-medium text-white">
                    class {cls.name}
                    {cls.isAbstract && <span className="text-yellow-400 text-sm ml-2">(abstract)</span>}
                  </h3>
                  <div className="text-xs text-gray-500">Line {cls.lineNumber}</div>
                </div>
                {cls.baseClasses.length > 0 && (
                  <div className="text-xs text-gray-400 mb-2">
                    Inherits: {cls.baseClasses.join(", ")}
                  </div>
                )}
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-gray-400 text-xs">
                      <th className="text-left py-1">Method</th>
                      <th className="text-left py-1">Return</th>
                      <th className="text-center py-1">Params</th>
                      <th className="text-center py-1">Const</th>
                      <th className="text-center py-1">Virtual</th>
                      <th className="text-center py-1">Complexity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cls.methods.map((m, j) => (
                      <tr key={j} className="border-t border-gray-700">
                        <td className="py-1 font-mono text-blue-400">{m.name}</td>
                        <td className="py-1 font-mono text-gray-400">{m.returnType}</td>
                        <td className="py-1 text-center">{m.paramCount}</td>
                        <td className="py-1 text-center">{m.isConst ? "Yes" : ""}</td>
                        <td className="py-1 text-center">{m.isVirtual ? "Yes" : ""}</td>
                        <td className="py-1 text-center">{m.complexity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}

            {/* Free Functions */}
            {analysisResult.freeFunctions.length > 0 && (
              <div className="bg-gray-800 rounded-lg p-4">
                <h3 className="text-lg font-medium text-white mb-3">Free Functions</h3>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-gray-400 text-xs">
                      <th className="text-left py-1">Function</th>
                      <th className="text-left py-1">Return</th>
                      <th className="text-center py-1">Params</th>
                      <th className="text-center py-1">Static</th>
                      <th className="text-center py-1">Complexity</th>
                      <th className="text-center py-1">Line</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analysisResult.freeFunctions.map((f, i) => (
                      <tr key={i} className="border-t border-gray-700">
                        <td className="py-1 font-mono text-green-400">{f.name}</td>
                        <td className="py-1 font-mono text-gray-400">{f.returnType}</td>
                        <td className="py-1 text-center">{f.paramCount}</td>
                        <td className="py-1 text-center">{f.isStatic ? "Yes" : ""}</td>
                        <td className="py-1 text-center">{f.complexity}</td>
                        <td className="py-1 text-center">{f.lineNumber}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === "analysis" && !analysisResult && (
          <div className="bg-gray-800 rounded-lg p-12 text-center">
            <p className="text-gray-400">No analysis yet. Switch to the Generate tab and click &quot;Analyze Only&quot;.</p>
          </div>
        )}

        {/* Results Tab */}
        {activeTab === "results" && generationResult && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <StatCard label="Total Tests" value={generationResult.stats.totalTests} />
              <StatCard label="Unit Tests" value={generationResult.stats.unitTests} />
              <StatCard label="Boundary Tests" value={generationResult.stats.boundaryTests} />
              <StatCard label="Null Checks" value={generationResult.stats.nullCheckTests} />
              <StatCard label="Exception Tests" value={generationResult.stats.exceptionTests} />
            </div>

            {/* File Info */}
            <div className="bg-gray-800 rounded-lg p-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-gray-400">Test File: </span>
                  <span className="font-mono text-blue-400">{generationResult.fileName}</span>
                </div>
                <div>
                  <span className="text-gray-400">Test Suite: </span>
                  <span className="font-mono text-green-400">{generationResult.testSuite}</span>
                </div>
                <div>
                  <span className="text-gray-400">Source: </span>
                  <span className="font-mono text-gray-300">{generationResult.sourceFile}</span>
                </div>
              </div>
            </div>

            {/* CMake */}
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-300 mb-2">CMake Integration</h3>
              <pre className="bg-gray-900 text-green-300 text-xs p-3 rounded font-mono overflow-x-auto">
                {generationResult.cmakeEntry}
              </pre>
            </div>

            {/* Test Cases Table */}
            <div className="bg-gray-800 rounded-lg overflow-hidden">
              <div className="p-4 border-b border-gray-700">
                <h3 className="text-sm font-medium text-gray-300">Generated Test Cases</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-gray-400 text-xs bg-gray-900/50">
                      <th className="text-left px-4 py-2">#</th>
                      <th className="text-left px-4 py-2">Test Name</th>
                      <th className="text-left px-4 py-2">Target</th>
                      <th className="text-center px-4 py-2">Type</th>
                      <th className="text-center px-4 py-2">Priority</th>
                      <th className="text-left px-4 py-2">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {generationResult.testCases.map((tc, i) => (
                      <tr key={i} className="border-t border-gray-700 hover:bg-gray-700/50">
                        <td className="px-4 py-2 text-gray-500">{i + 1}</td>
                        <td className="px-4 py-2 font-mono text-blue-400">{tc.testName}</td>
                        <td className="px-4 py-2 font-mono text-gray-300 text-xs">{tc.targetFunction}</td>
                        <td className="px-4 py-2 text-center">
                          <span className={`px-2 py-0.5 rounded text-xs ${testTypeColor(tc.testType)}`}>
                            {tc.testType}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-center">
                          <span className={`px-2 py-0.5 rounded text-xs ${priorityColor(tc.priority)}`}>
                            {tc.priority}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-gray-400 text-xs">{tc.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Generated Code */}
            {generationResult.generatedCode && (
              <div className="bg-gray-800 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-gray-300">Generated Test File</h3>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(generationResult.generatedCode || "");
                    }}
                    className="text-xs text-blue-400 hover:text-blue-300"
                  >
                    Copy to Clipboard
                  </button>
                </div>
                <pre className="bg-gray-900 text-gray-300 text-xs p-4 rounded font-mono overflow-x-auto max-h-96 overflow-y-auto">
                  {generationResult.generatedCode}
                </pre>
              </div>
            )}
          </div>
        )}

        {activeTab === "results" && !generationResult && (
          <div className="bg-gray-800 rounded-lg p-12 text-center">
            <p className="text-gray-400">No test generation results yet. Switch to the Generate tab and click &quot;Generate Tests&quot;.</p>
          </div>
        )}

        {/* History Tab */}
        {activeTab === "history" && (
          <div className="space-y-4">
            {recentGenerations.length === 0 ? (
              <div className="bg-gray-800 rounded-lg p-12 text-center">
                <p className="text-gray-400">No recent generations. Generate some tests to see them here.</p>
              </div>
            ) : (
              recentGenerations.map(gen => (
                <div key={gen.id} className="bg-gray-800 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-mono text-blue-400">{gen.filePath}</h3>
                    <span className="text-xs text-gray-500">{new Date(gen.generatedAt).toLocaleString()}</span>
                  </div>
                  <div className="flex items-center space-x-6 text-sm text-gray-400">
                    <span>Suite: <span className="text-green-400">{gen.testSuite}</span></span>
                    <span>Tests: <span className="text-white">{gen.testCount}</span></span>
                    <span>Unit: {gen.stats.unitTests}</span>
                    <span>Boundary: {gen.stats.boundaryTests}</span>
                    <span>Null: {gen.stats.nullCheckTests}</span>
                    <span>Exception: {gen.stats.exceptionTests}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
