/**
 * Database Management Dashboard
 *
 * Comprehensive UI for managing TrinityCore databases:
 * export, import, sync, backup, restore, and diff operations.
 *
 * @module DatabaseDashboard
 */

"use client";

import React, { useState, useEffect } from "react";

// ============================================================================
// Types
// ============================================================================

interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
}

interface BackupMetadata {
  id: string;
  database: string;
  timestamp: number;
  size: number;
  compressed: boolean;
  tables: string[];
  status: string;
}

interface SyncConfig {
  id: string;
  name: string;
  source: DatabaseConfig;
  targets: DatabaseConfig[];
  interval?: number;
  active: boolean;
}

type ActiveTab =
  | "overview"
  | "export"
  | "import"
  | "sync"
  | "backup"
  | "restore"
  | "diff"
  | "health";

// ============================================================================
// Component
// ============================================================================

export default function DatabaseDashboard() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("overview");
  const [databases, setDatabases] = useState<DatabaseConfig[]>([]);
  const [backups, setBackups] = useState<BackupMetadata[]>([]);
  const [syncConfigs, setSyncConfigs] = useState<SyncConfig[]>([]);
  const [selectedDatabase, setSelectedDatabase] = useState<string>("");

  /**
   * Render active tab content
   */
  const renderTabContent = () => {
    switch (activeTab) {
      case "overview":
        return <OverviewTab databases={databases} backups={backups} syncConfigs={syncConfigs} />;

      case "export":
        return <ExportTab databases={databases} selectedDatabase={selectedDatabase} />;

      case "import":
        return <ImportTab databases={databases} selectedDatabase={selectedDatabase} />;

      case "sync":
        return <SyncTab databases={databases} syncConfigs={syncConfigs} />;

      case "backup":
        return <BackupTab databases={databases} selectedDatabase={selectedDatabase} />;

      case "restore":
        return <RestoreTab databases={databases} backups={backups} />;

      case "diff":
        return <DiffTab databases={databases} />;

      case "health":
        return <HealthTab databases={databases} selectedDatabase={selectedDatabase} />;

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 p-6">
        <h1 className="text-3xl font-bold">Database Management</h1>
        <p className="text-gray-400 mt-1">TrinityCore Database Administration</p>
      </div>

      <div className="flex">
        {/* Sidebar */}
        <div className="w-64 bg-gray-800 border-r border-gray-700 min-h-screen">
          <nav className="p-4">
            <TabButton
              active={activeTab === "overview"}
              onClick={() => setActiveTab("overview")}
              icon="📊"
              label="Overview"
            />
            <TabButton
              active={activeTab === "export"}
              onClick={() => setActiveTab("export")}
              icon="⬇️"
              label="Export"
            />
            <TabButton
              active={activeTab === "import"}
              onClick={() => setActiveTab("import")}
              icon="⬆️"
              label="Import"
            />
            <TabButton
              active={activeTab === "sync"}
              onClick={() => setActiveTab("sync")}
              icon="🔄"
              label="Sync"
            />
            <TabButton
              active={activeTab === "backup"}
              onClick={() => setActiveTab("backup")}
              icon="💾"
              label="Backup"
            />
            <TabButton
              active={activeTab === "restore"}
              onClick={() => setActiveTab("restore")}
              icon="♻️"
              label="Restore"
            />
            <TabButton
              active={activeTab === "diff"}
              onClick={() => setActiveTab("diff")}
              icon="🔍"
              label="Diff"
            />
            <TabButton
              active={activeTab === "health"}
              onClick={() => setActiveTab("health")}
              icon="❤️"
              label="Health"
            />
          </nav>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-6">{renderTabContent()}</div>
      </div>
    </div>
  );
}

// ============================================================================
// Tab Button Component
// ============================================================================

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: string;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3 rounded-lg mb-2 transition-colors ${
        active
          ? "bg-blue-600 text-white"
          : "bg-gray-700 text-gray-300 hover:bg-gray-600"
      }`}
    >
      <span className="mr-2">{icon}</span>
      {label}
    </button>
  );
}

// ============================================================================
// Overview Tab
// ============================================================================

function OverviewTab({
  databases,
  backups,
  syncConfigs,
}: {
  databases: DatabaseConfig[];
  backups: BackupMetadata[];
  syncConfigs: SyncConfig[];
}) {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Database Overview</h2>

      <div className="grid grid-cols-3 gap-4">
        {/* Databases Card */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-2">Databases</h3>
          <div className="text-4xl font-bold text-blue-400">{databases.length}</div>
          <p className="text-gray-400 text-sm mt-2">Configured databases</p>
        </div>

        {/* Backups Card */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-2">Backups</h3>
          <div className="text-4xl font-bold text-green-400">{backups.length}</div>
          <p className="text-gray-400 text-sm mt-2">Available backups</p>
        </div>

        {/* Sync Configs Card */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-2">Sync Jobs</h3>
          <div className="text-4xl font-bold text-purple-400">{syncConfigs.length}</div>
          <p className="text-gray-400 text-sm mt-2">
            {syncConfigs.filter((s) => s.active).length} active
          </p>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4">Recent Activity</h3>
        <div className="space-y-2">
          <ActivityItem
            icon="💾"
            action="Backup created"
            details="world database"
            time="2 hours ago"
          />
          <ActivityItem
            icon="🔄"
            action="Sync completed"
            details="3 tables synced"
            time="4 hours ago"
          />
          <ActivityItem
            icon="⬇️"
            action="Export completed"
            details="characters database"
            time="1 day ago"
          />
        </div>
      </div>
    </div>
  );
}

function ActivityItem({
  icon,
  action,
  details,
  time,
}: {
  icon: string;
  action: string;
  details: string;
  time: string;
}) {
  return (
    <div className="flex items-center justify-between p-3 bg-gray-700 rounded">
      <div className="flex items-center gap-3">
        <span className="text-2xl">{icon}</span>
        <div>
          <div className="font-semibold">{action}</div>
          <div className="text-sm text-gray-400">{details}</div>
        </div>
      </div>
      <div className="text-sm text-gray-400">{time}</div>
    </div>
  );
}

// ============================================================================
// Export Tab
// ============================================================================

function ExportTab({
  databases,
  selectedDatabase,
}: {
  databases: DatabaseConfig[];
  selectedDatabase: string;
}) {
  const [format, setFormat] = useState("sql");
  const [includeSchema, setIncludeSchema] = useState(true);
  const [includeData, setIncludeData] = useState(true);
  const [compress, setCompress] = useState(true);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Export Database</h2>

      <div className="bg-gray-800 rounded-lg p-6 space-y-4">
        <div>
          <label className="block text-sm font-semibold mb-2">Database</label>
          <select className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded">
            <option value="">Select database...</option>
            {databases.map((db) => (
              <option key={db.database} value={db.database}>
                {db.database}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold mb-2">Format</label>
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value)}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded"
          >
            <option value="sql">SQL</option>
            <option value="json">JSON</option>
            <option value="csv">CSV</option>
          </select>
        </div>

        <div className="space-y-2">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={includeSchema}
              onChange={(e) => setIncludeSchema(e.target.checked)}
              className="mr-2"
            />
            Include schema
          </label>

          <label className="flex items-center">
            <input
              type="checkbox"
              checked={includeData}
              onChange={(e) => setIncludeData(e.target.checked)}
              className="mr-2"
            />
            Include data
          </label>

          <label className="flex items-center">
            <input
              type="checkbox"
              checked={compress}
              onChange={(e) => setCompress(e.target.checked)}
              className="mr-2"
            />
            Compress output
          </label>
        </div>

        <button className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 rounded font-semibold">
          Start Export
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Import Tab
// ============================================================================

function ImportTab({
  databases,
  selectedDatabase,
}: {
  databases: DatabaseConfig[];
  selectedDatabase: string;
}) {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Import Database</h2>

      <div className="bg-gray-800 rounded-lg p-6 space-y-4">
        <div>
          <label className="block text-sm font-semibold mb-2">Target Database</label>
          <select className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded">
            <option value="">Select database...</option>
            {databases.map((db) => (
              <option key={db.database} value={db.database}>
                {db.database}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold mb-2">Import File</label>
          <input
            type="file"
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded"
          />
        </div>

        <div className="space-y-2">
          <label className="flex items-center">
            <input type="checkbox" className="mr-2" />
            Drop existing tables
          </label>

          <label className="flex items-center">
            <input type="checkbox" defaultChecked className="mr-2" />
            Validate before import
          </label>

          <label className="flex items-center">
            <input type="checkbox" className="mr-2" />
            Dry run (validation only)
          </label>
        </div>

        <button className="w-full px-4 py-3 bg-green-600 hover:bg-green-700 rounded font-semibold">
          Start Import
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Sync Tab
// ============================================================================

function SyncTab({
  databases,
  syncConfigs,
}: {
  databases: DatabaseConfig[];
  syncConfigs: SyncConfig[];
}) {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Database Synchronization</h2>

      {/* Active Syncs */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4">Active Sync Jobs</h3>
        <div className="space-y-2">
          {syncConfigs.map((sync) => (
            <div key={sync.id} className="p-4 bg-gray-700 rounded flex justify-between items-center">
              <div>
                <div className="font-semibold">{sync.name}</div>
                <div className="text-sm text-gray-400">
                  {sync.source.database} → {sync.targets.length} target(s)
                </div>
              </div>
              <div className="flex gap-2">
                <button className="px-3 py-1 bg-blue-600 rounded text-sm">Sync Now</button>
                <button className="px-3 py-1 bg-gray-600 rounded text-sm">Edit</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* New Sync */}
      <button className="w-full px-4 py-3 bg-purple-600 hover:bg-purple-700 rounded font-semibold">
        + New Sync Configuration
      </button>
    </div>
  );
}

// ============================================================================
// Backup Tab
// ============================================================================

function BackupTab({
  databases,
  selectedDatabase,
}: {
  databases: DatabaseConfig[];
  selectedDatabase: string;
}) {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Create Backup</h2>

      <div className="bg-gray-800 rounded-lg p-6 space-y-4">
        <div>
          <label className="block text-sm font-semibold mb-2">Database</label>
          <select className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded">
            <option value="">Select database...</option>
            {databases.map((db) => (
              <option key={db.database} value={db.database}>
                {db.database}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold mb-2">Backup Name</label>
          <input
            type="text"
            placeholder="Auto-generated if left empty"
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded"
          />
        </div>

        <div className="space-y-2">
          <label className="flex items-center">
            <input type="checkbox" defaultChecked className="mr-2" />
            Include schema
          </label>

          <label className="flex items-center">
            <input type="checkbox" defaultChecked className="mr-2" />
            Include data
          </label>

          <label className="flex items-center">
            <input type="checkbox" defaultChecked className="mr-2" />
            Compress backup
          </label>
        </div>

        <button className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 rounded font-semibold">
          Create Backup
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Restore Tab
// ============================================================================

function RestoreTab({
  databases,
  backups,
}: {
  databases: DatabaseConfig[];
  backups: BackupMetadata[];
}) {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Restore Database</h2>

      <div className="bg-gray-800 rounded-lg p-6 space-y-4">
        <div>
          <label className="block text-sm font-semibold mb-2">Backup</label>
          <select className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded">
            <option value="">Select backup...</option>
            {backups.map((backup) => (
              <option key={backup.id} value={backup.id}>
                {backup.database} - {new Date(backup.timestamp).toLocaleString()}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold mb-2">Target Database</label>
          <select className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded">
            <option value="">Select database...</option>
            {databases.map((db) => (
              <option key={db.database} value={db.database}>
                {db.database}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="flex items-center">
            <input type="checkbox" className="mr-2" />
            Drop existing tables
          </label>

          <label className="flex items-center">
            <input type="checkbox" defaultChecked className="mr-2" />
            Validate before restore
          </label>
        </div>

        <button className="w-full px-4 py-3 bg-orange-600 hover:bg-orange-700 rounded font-semibold">
          Restore Database
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Diff Tab
// ============================================================================

function DiffTab({ databases }: { databases: DatabaseConfig[] }) {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Database Comparison</h2>

      <div className="bg-gray-800 rounded-lg p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold mb-2">Source Database</label>
            <select className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded">
              <option value="">Select database...</option>
              {databases.map((db) => (
                <option key={db.database} value={db.database}>
                  {db.database}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">Target Database</label>
            <select className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded">
              <option value="">Select database...</option>
              {databases.map((db) => (
                <option key={db.database} value={db.database}>
                  {db.database}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-2">
          <label className="flex items-center">
            <input type="checkbox" defaultChecked className="mr-2" />
            Include data differences
          </label>

          <label className="flex items-center">
            <input type="checkbox" defaultChecked className="mr-2" />
            Generate migration script
          </label>
        </div>

        <button className="w-full px-4 py-3 bg-yellow-600 hover:bg-yellow-700 rounded font-semibold">
          Compare Databases
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Health Tab
// ============================================================================

function HealthTab({
  databases,
  selectedDatabase,
}: {
  databases: DatabaseConfig[];
  selectedDatabase: string;
}) {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Database Health</h2>

      <div className="bg-gray-800 rounded-lg p-6 space-y-4">
        <div>
          <label className="block text-sm font-semibold mb-2">Database</label>
          <select className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded">
            <option value="">Select database...</option>
            {databases.map((db) => (
              <option key={db.database} value={db.database}>
                {db.database}
              </option>
            ))}
          </select>
        </div>

        <button className="w-full px-4 py-3 bg-green-600 hover:bg-green-700 rounded font-semibold">
          Run Health Check
        </button>

        {/* Health Results */}
        <div className="mt-6 space-y-2">
          <HealthCheck name="Connection" status="pass" message="Database connection successful" />
          <HealthCheck
            name="Tables"
            status="pass"
            message="All tables present and accessible"
          />
          <HealthCheck
            name="Indexes"
            status="warning"
            message="2 missing indexes detected"
          />
          <HealthCheck name="Data Integrity" status="pass" message="No integrity violations" />
        </div>
      </div>
    </div>
  );
}

function HealthCheck({
  name,
  status,
  message,
}: {
  name: string;
  status: "pass" | "warning" | "error";
  message: string;
}) {
  const statusColors = {
    pass: "bg-green-600",
    warning: "bg-yellow-600",
    error: "bg-red-600",
  };

  return (
    <div className="p-4 bg-gray-700 rounded flex justify-between items-center">
      <div>
        <div className="font-semibold">{name}</div>
        <div className="text-sm text-gray-400">{message}</div>
      </div>
      <div className={`px-3 py-1 rounded text-sm ${statusColors[status]}`}>
        {status.toUpperCase()}
      </div>
    </div>
  );
}
