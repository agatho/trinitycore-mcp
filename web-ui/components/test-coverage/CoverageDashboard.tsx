/**
 * Test Coverage Dashboard
 *
 * Visual dashboard for displaying test coverage metrics and results.
 *
 * @module CoverageDashboard
 */

"use client";

import React, { useState, useEffect } from "react";

// ============================================================================
// Types
// ============================================================================

interface CoverageData {
  overall: CoverageMetrics;
  files: FileCoverage[];
  suites: SuiteResult[];
}

interface CoverageMetrics {
  lines: number;
  branches: number;
  functions: number;
  statements: number;
}

interface FileCoverage {
  path: string;
  lines: number;
  branches: number;
  functions: number;
  uncoveredLines: number[];
}

interface SuiteResult {
  name: string;
  tests: number;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
}

// ============================================================================
// Component
// ============================================================================

export default function CoverageDashboard() {
  const [coverage, setCoverage] = useState<CoverageData | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "files" | "suites">("overview");

  /**
   * Load coverage data
   */
  useEffect(() => {
    // Mock data - in production, load from API
    setCoverage({
      overall: {
        lines: 85.5,
        branches: 78.2,
        functions: 92.1,
        statements: 86.3,
      },
      files: [
        {
          path: "src/database/export-engine.ts",
          lines: 92.5,
          branches: 85.0,
          functions: 95.0,
          uncoveredLines: [120, 145, 203],
        },
        {
          path: "src/database/import-engine.ts",
          lines: 88.3,
          branches: 80.5,
          functions: 90.0,
          uncoveredLines: [156, 201, 245, 289],
        },
        {
          path: "src/soap/soap-client.ts",
          lines: 75.8,
          branches: 68.5,
          functions: 82.0,
          uncoveredLines: [45, 67, 89, 102, 134, 156],
        },
      ],
      suites: [
        {
          name: "Database Export Tests",
          tests: 25,
          passed: 24,
          failed: 1,
          skipped: 0,
          duration: 1250,
        },
        {
          name: "Database Import Tests",
          tests: 30,
          passed: 28,
          failed: 0,
          skipped: 2,
          duration: 1580,
        },
        {
          name: "SOAP Client Tests",
          tests: 18,
          passed: 18,
          failed: 0,
          skipped: 0,
          duration: 890,
        },
      ],
    });
  }, []);

  if (!coverage) {
    return <div className="p-8 text-gray-400">Loading coverage data...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 p-6">
        <h1 className="text-3xl font-bold">Test Coverage Dashboard</h1>
        <p className="text-gray-400 mt-1">Code coverage and test results</p>
      </div>

      {/* Tabs */}
      <div className="bg-gray-800 border-b border-gray-700 px-6">
        <div className="flex gap-4">
          <TabButton
            active={activeTab === "overview"}
            onClick={() => setActiveTab("overview")}
            label="Overview"
          />
          <TabButton
            active={activeTab === "files"}
            onClick={() => setActiveTab("files")}
            label="Files"
          />
          <TabButton
            active={activeTab === "suites"}
            onClick={() => setActiveTab("suites")}
            label="Test Suites"
          />
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {activeTab === "overview" && <OverviewTab coverage={coverage} />}
        {activeTab === "files" && (
          <FilesTab
            files={coverage.files}
            selectedFile={selectedFile}
            onSelectFile={setSelectedFile}
          />
        )}
        {activeTab === "suites" && <SuitesTab suites={coverage.suites} />}
      </div>
    </div>
  );
}

// ============================================================================
// Tab Button
// ============================================================================

function TabButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-3 font-semibold border-b-2 transition-colors ${
        active
          ? "border-blue-500 text-white"
          : "border-transparent text-gray-400 hover:text-gray-200"
      }`}
    >
      {label}
    </button>
  );
}

// ============================================================================
// Overview Tab
// ============================================================================

function OverviewTab({ coverage }: { coverage: CoverageData }) {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Coverage Overview</h2>

      {/* Coverage Cards */}
      <div className="grid grid-cols-4 gap-4">
        <CoverageCard label="Lines" value={coverage.overall.lines} />
        <CoverageCard label="Branches" value={coverage.overall.branches} />
        <CoverageCard label="Functions" value={coverage.overall.functions} />
        <CoverageCard label="Statements" value={coverage.overall.statements} />
      </div>

      {/* Overall Progress Bar */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4">Overall Coverage</h3>
        <div className="space-y-3">
          <ProgressBar label="Lines" value={coverage.overall.lines} />
          <ProgressBar label="Branches" value={coverage.overall.branches} />
          <ProgressBar label="Functions" value={coverage.overall.functions} />
          <ProgressBar label="Statements" value={coverage.overall.statements} />
        </div>
      </div>

      {/* Test Summary */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4">Test Summary</h3>
        <div className="grid grid-cols-3 gap-4">
          <StatCard label="Total Suites" value={coverage.suites.length.toString()} color="blue" />
          <StatCard
            label="Total Tests"
            value={coverage.suites.reduce((sum, s) => sum + s.tests, 0).toString()}
            color="green"
          />
          <StatCard
            label="Passed"
            value={coverage.suites.reduce((sum, s) => sum + s.passed, 0).toString()}
            color="green"
          />
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Files Tab
// ============================================================================

function FilesTab({
  files,
  selectedFile,
  onSelectFile,
}: {
  files: FileCoverage[];
  selectedFile: string | null;
  onSelectFile: (file: string) => void;
}) {
  // Sort files by coverage (lowest first)
  const sortedFiles = [...files].sort((a, b) => a.lines - b.lines);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">File Coverage</h2>

      <div className="bg-gray-800 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-700">
            <tr>
              <th className="px-4 py-3 text-left">File</th>
              <th className="px-4 py-3 text-right">Lines</th>
              <th className="px-4 py-3 text-right">Branches</th>
              <th className="px-4 py-3 text-right">Functions</th>
              <th className="px-4 py-3 text-right">Uncovered</th>
            </tr>
          </thead>
          <tbody>
            {sortedFiles.map((file) => (
              <tr
                key={file.path}
                onClick={() => onSelectFile(file.path)}
                className={`border-t border-gray-700 cursor-pointer hover:bg-gray-750 ${
                  selectedFile === file.path ? "bg-gray-750" : ""
                }`}
              >
                <td className="px-4 py-3 font-mono text-sm">{file.path}</td>
                <td className="px-4 py-3 text-right">
                  <CoverageBadge value={file.lines} />
                </td>
                <td className="px-4 py-3 text-right">
                  <CoverageBadge value={file.branches} />
                </td>
                <td className="px-4 py-3 text-right">
                  <CoverageBadge value={file.functions} />
                </td>
                <td className="px-4 py-3 text-right">{file.uncoveredLines.length}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* File Details */}
      {selectedFile && (
        <div className="bg-gray-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">{selectedFile}</h3>
          <div className="space-y-2">
            <p className="text-sm text-gray-400">
              Uncovered lines:{" "}
              {files
                .find((f) => f.path === selectedFile)
                ?.uncoveredLines.join(", ") || "None"}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Suites Tab
// ============================================================================

function SuitesTab({ suites }: { suites: SuiteResult[] }) {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Test Suites</h2>

      <div className="space-y-4">
        {suites.map((suite) => (
          <div key={suite.name} className="bg-gray-800 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">{suite.name}</h3>
              <div className="text-sm text-gray-400">{suite.duration}ms</div>
            </div>

            <div className="grid grid-cols-4 gap-4 mb-4">
              <StatCard label="Total" value={suite.tests.toString()} color="blue" />
              <StatCard label="Passed" value={suite.passed.toString()} color="green" />
              <StatCard label="Failed" value={suite.failed.toString()} color="red" />
              <StatCard label="Skipped" value={suite.skipped.toString()} color="yellow" />
            </div>

            {/* Test Progress */}
            <div className="w-full h-2 bg-gray-700 rounded overflow-hidden">
              <div className="h-full flex">
                <div
                  className="bg-green-500"
                  style={{ width: `${(suite.passed / suite.tests) * 100}%` }}
                />
                <div
                  className="bg-red-500"
                  style={{ width: `${(suite.failed / suite.tests) * 100}%` }}
                />
                <div
                  className="bg-yellow-500"
                  style={{ width: `${(suite.skipped / suite.tests) * 100}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Coverage Card
// ============================================================================

function CoverageCard({ label, value }: { label: string; value: number }) {
  const color = value >= 90 ? "green" : value >= 80 ? "yellow" : value >= 70 ? "orange" : "red";
  const colors = {
    green: "bg-green-600",
    yellow: "bg-yellow-600",
    orange: "bg-orange-600",
    red: "bg-red-600",
  };

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <div className="text-sm text-gray-400 mb-2">{label}</div>
      <div className={`text-4xl font-bold ${colors[color].replace("bg-", "text-")}`}>
        {value.toFixed(1)}%
      </div>
    </div>
  );
}

// ============================================================================
// Progress Bar
// ============================================================================

function ProgressBar({ label, value }: { label: string; value: number }) {
  const color = value >= 90 ? "bg-green-500" : value >= 80 ? "bg-yellow-500" : "bg-red-500";

  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-gray-400">{label}</span>
        <span className="font-semibold">{value.toFixed(1)}%</span>
      </div>
      <div className="w-full h-2 bg-gray-700 rounded overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

// ============================================================================
// Stat Card
// ============================================================================

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: "blue" | "green" | "red" | "yellow";
}) {
  const colors = {
    blue: "bg-blue-600",
    green: "bg-green-600",
    red: "bg-red-600",
    yellow: "bg-yellow-600",
  };

  return (
    <div className="bg-gray-700 rounded p-4">
      <div className="text-sm text-gray-400 mb-1">{label}</div>
      <div className={`text-2xl font-bold ${colors[color].replace("bg-", "text-")}`}>
        {value}
      </div>
    </div>
  );
}

// ============================================================================
// Coverage Badge
// ============================================================================

function CoverageBadge({ value }: { value: number }) {
  const color = value >= 90 ? "green" : value >= 80 ? "yellow" : value >= 70 ? "orange" : "red";
  const colors = {
    green: "bg-green-600",
    yellow: "bg-yellow-600",
    orange: "bg-orange-600",
    red: "bg-red-600",
  };

  return (
    <span className={`px-2 py-1 rounded text-xs font-semibold ${colors[color]}`}>
      {value.toFixed(1)}%
    </span>
  );
}
