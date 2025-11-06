"use client";

/**
 * Settings Dashboard Component
 *
 * Provides a comprehensive settings interface for TrinityCore MCP configuration.
 * Supports editing database, paths, server, websocket, testing, and logging settings.
 *
 * @module components/settings/SettingsDashboard
 */

import React, { useState, useEffect } from "react";

// ============================================================================
// Types
// ============================================================================

interface DatabaseConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  world: string;
  auth: string;
  characters: string;
}

interface DataPathsConfig {
  trinityRoot: string;
  gtPath: string;
  dbcPath: string;
  db2Path: string;
  vmapPath: string;
  mmapPath: string;
}

interface ServerConfig {
  port: number;
  host: string;
  corsEnabled: boolean;
  corsOrigin: string;
  maxConnections: number;
}

interface WebSocketConfig {
  enabled: boolean;
  port: number;
  maxClients: number;
  heartbeatInterval: number;
  timeoutMs: number;
  rateLimit: number;
}

interface TestingConfig {
  enabled: boolean;
  autoGenerateTests: boolean;
  coverageThreshold: number;
  performanceBaselines: boolean;
}

interface LoggingConfig {
  level: "debug" | "info" | "warn" | "error";
  console: boolean;
  file: boolean;
  filePath: string;
  maxFileSize: number;
  maxFiles: number;
}

interface TrinityMCPConfig {
  database: DatabaseConfig;
  dataPaths: DataPathsConfig;
  server: ServerConfig;
  websocket: WebSocketConfig;
  testing: TestingConfig;
  logging: LoggingConfig;
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// ============================================================================
// Component
// ============================================================================

export default function SettingsDashboard() {
  const [activeTab, setActiveTab] = useState<string>("database");
  const [config, setConfig] = useState<TrinityMCPConfig | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [successMessage, setSuccessMessage] = useState<string>("");

  // Load configuration on mount
  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/config");
      const data = await response.json();
      setConfig(data.config);
    } catch (error) {
      console.error("Failed to load configuration:", error);
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async () => {
    if (!config) return;

    setSaving(true);
    setValidation(null);
    setSuccessMessage("");

    try {
      const response = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });

      const data = await response.json();

      if (data.success) {
        setValidation(data.validation);
        if (data.validation.valid) {
          setSuccessMessage("Configuration saved successfully!");
          setTimeout(() => setSuccessMessage(""), 3000);
        }
      } else {
        setValidation({
          valid: false,
          errors: [data.error || "Failed to save configuration"],
          warnings: [],
        });
      }
    } catch (error) {
      setValidation({
        valid: false,
        errors: [`Network error: ${(error as Error).message}`],
        warnings: [],
      });
    } finally {
      setSaving(false);
    }
  };

  const resetConfig = async () => {
    if (!confirm("Are you sure you want to reset all settings to defaults?")) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/config/reset", { method: "POST" });
      const data = await response.json();
      if (data.success) {
        setConfig(data.config);
        setSuccessMessage("Configuration reset to defaults!");
        setTimeout(() => setSuccessMessage(""), 3000);
      }
    } catch (error) {
      console.error("Failed to reset configuration:", error);
    } finally {
      setLoading(false);
    }
  };

  const updateDatabase = (updates: Partial<DatabaseConfig>) => {
    if (!config) return;
    setConfig({ ...config, database: { ...config.database, ...updates } });
  };

  const updateDataPaths = (updates: Partial<DataPathsConfig>) => {
    if (!config) return;
    setConfig({ ...config, dataPaths: { ...config.dataPaths, ...updates } });
  };

  const updateServer = (updates: Partial<ServerConfig>) => {
    if (!config) return;
    setConfig({ ...config, server: { ...config.server, ...updates } });
  };

  const updateWebSocket = (updates: Partial<WebSocketConfig>) => {
    if (!config) return;
    setConfig({ ...config, websocket: { ...config.websocket, ...updates } });
  };

  const updateTesting = (updates: Partial<TestingConfig>) => {
    if (!config) return;
    setConfig({ ...config, testing: { ...config.testing, ...updates } });
  };

  const updateLogging = (updates: Partial<LoggingConfig>) => {
    if (!config) return;
    setConfig({ ...config, logging: { ...config.logging, ...updates } });
  };

  if (loading || !config) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="text-xl font-semibold mb-2">Loading settings...</div>
          <div className="text-gray-500">Please wait</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">TrinityCore MCP Settings</h1>
        <p className="text-gray-600">
          Configure database connections, file paths, server settings, and more
        </p>
      </div>

      {/* Success Message */}
      {successMessage && (
        <div className="mb-4 p-4 bg-green-100 border border-green-400 text-green-700 rounded">
          {successMessage}
        </div>
      )}

      {/* Validation Messages */}
      {validation && (
        <div className="mb-4">
          {validation.errors.length > 0 && (
            <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded mb-2">
              <h3 className="font-bold mb-2">Validation Errors:</h3>
              <ul className="list-disc list-inside">
                {validation.errors.map((error, i) => (
                  <li key={i}>{error}</li>
                ))}
              </ul>
            </div>
          )}
          {validation.warnings.length > 0 && (
            <div className="p-4 bg-yellow-100 border border-yellow-400 text-yellow-700 rounded">
              <h3 className="font-bold mb-2">Warnings:</h3>
              <ul className="list-disc list-inside">
                {validation.warnings.map((warning, i) => (
                  <li key={i}>{warning}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow mb-4">
        <div className="border-b flex overflow-x-auto">
          {[
            { id: "database", label: "Database" },
            { id: "paths", label: "Data Paths" },
            { id: "server", label: "Server" },
            { id: "websocket", label: "WebSocket" },
            { id: "testing", label: "Testing" },
            { id: "logging", label: "Logging" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-6 py-3 font-medium whitespace-nowrap ${
                activeTab === tab.id
                  ? "border-b-2 border-blue-500 text-blue-600"
                  : "text-gray-600 hover:text-gray-800"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {/* Database Tab */}
          {activeTab === "database" && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold mb-4">Database Configuration</h2>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Host</label>
                  <input
                    type="text"
                    value={config.database.host}
                    onChange={(e) => updateDatabase({ host: e.target.value })}
                    className="w-full p-2 border rounded"
                    placeholder="localhost"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Port</label>
                  <input
                    type="number"
                    value={config.database.port}
                    onChange={(e) => updateDatabase({ port: parseInt(e.target.value) })}
                    className="w-full p-2 border rounded"
                    placeholder="3306"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">User</label>
                  <input
                    type="text"
                    value={config.database.user}
                    onChange={(e) => updateDatabase({ user: e.target.value })}
                    className="w-full p-2 border rounded"
                    placeholder="trinity"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Password</label>
                  <input
                    type="password"
                    value={config.database.password}
                    onChange={(e) => updateDatabase({ password: e.target.value })}
                    className="w-full p-2 border rounded"
                    placeholder="••••••••"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">World Database</label>
                  <input
                    type="text"
                    value={config.database.world}
                    onChange={(e) => updateDatabase({ world: e.target.value })}
                    className="w-full p-2 border rounded"
                    placeholder="world"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Auth Database</label>
                  <input
                    type="text"
                    value={config.database.auth}
                    onChange={(e) => updateDatabase({ auth: e.target.value })}
                    className="w-full p-2 border rounded"
                    placeholder="auth"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium mb-1">Characters Database</label>
                  <input
                    type="text"
                    value={config.database.characters}
                    onChange={(e) => updateDatabase({ characters: e.target.value })}
                    className="w-full p-2 border rounded"
                    placeholder="characters"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Data Paths Tab */}
          {activeTab === "paths" && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold mb-4">Data Paths Configuration</h2>

              <div>
                <label className="block text-sm font-medium mb-1">
                  TrinityCore Root Directory
                </label>
                <input
                  type="text"
                  value={config.dataPaths.trinityRoot}
                  onChange={(e) => updateDataPaths({ trinityRoot: e.target.value })}
                  className="w-full p-2 border rounded"
                  placeholder="C:\TrinityCore or /home/user/TrinityCore"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Path to TrinityCore source code root directory
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">GT Files Path</label>
                <input
                  type="text"
                  value={config.dataPaths.gtPath}
                  onChange={(e) => updateDataPaths({ gtPath: e.target.value })}
                  className="w-full p-2 border rounded"
                  placeholder="./data/gt"
                />
                <p className="text-xs text-gray-500 mt-1">
                  GameTable files (combat ratings, XP tables, stat calculations)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">DBC Files Path</label>
                <input
                  type="text"
                  value={config.dataPaths.dbcPath}
                  onChange={(e) => updateDataPaths({ dbcPath: e.target.value })}
                  className="w-full p-2 border rounded"
                  placeholder="./data/dbc"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Legacy database client files (pre-WoW 4.0)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">DB2 Files Path</label>
                <input
                  type="text"
                  value={config.dataPaths.db2Path}
                  onChange={(e) => updateDataPaths({ db2Path: e.target.value })}
                  className="w-full p-2 border rounded"
                  placeholder="./data/db2"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Modern database client files (WoW 4.0+)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  VMap Files Path
                </label>
                <input
                  type="text"
                  value={config.dataPaths.vmapPath}
                  onChange={(e) => updateDataPaths({ vmapPath: e.target.value })}
                  className="w-full p-2 border rounded"
                  placeholder="./data/vmaps"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Visibility/Collision maps for line-of-sight and spawn validation
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  MMap Files Path
                </label>
                <input
                  type="text"
                  value={config.dataPaths.mmapPath}
                  onChange={(e) => updateDataPaths({ mmapPath: e.target.value })}
                  className="w-full p-2 border rounded"
                  placeholder="./data/mmaps"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Movement maps / Navigation mesh for pathfinding and AI movement
                </p>
              </div>
            </div>
          )}

          {/* Server Tab */}
          {activeTab === "server" && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold mb-4">Server Configuration</h2>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Host</label>
                  <input
                    type="text"
                    value={config.server.host}
                    onChange={(e) => updateServer({ host: e.target.value })}
                    className="w-full p-2 border rounded"
                    placeholder="localhost"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Port</label>
                  <input
                    type="number"
                    value={config.server.port}
                    onChange={(e) => updateServer({ port: parseInt(e.target.value) })}
                    className="w-full p-2 border rounded"
                    placeholder="3000"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Max Connections</label>
                  <input
                    type="number"
                    value={config.server.maxConnections}
                    onChange={(e) => updateServer({ maxConnections: parseInt(e.target.value) })}
                    className="w-full p-2 border rounded"
                    placeholder="100"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">CORS Origin</label>
                  <input
                    type="text"
                    value={config.server.corsOrigin}
                    onChange={(e) => updateServer({ corsOrigin: e.target.value })}
                    className="w-full p-2 border rounded"
                    placeholder="*"
                  />
                </div>

                <div className="col-span-2">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={config.server.corsEnabled}
                      onChange={(e) => updateServer({ corsEnabled: e.target.checked })}
                      className="mr-2"
                    />
                    <span className="text-sm font-medium">Enable CORS</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* WebSocket Tab */}
          {activeTab === "websocket" && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold mb-4">WebSocket Configuration</h2>

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={config.websocket.enabled}
                      onChange={(e) => updateWebSocket({ enabled: e.target.checked })}
                      className="mr-2"
                    />
                    <span className="text-sm font-medium">Enable WebSocket Server</span>
                  </label>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Port</label>
                  <input
                    type="number"
                    value={config.websocket.port}
                    onChange={(e) => updateWebSocket({ port: parseInt(e.target.value) })}
                    className="w-full p-2 border rounded"
                    placeholder="3001"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Max Clients</label>
                  <input
                    type="number"
                    value={config.websocket.maxClients}
                    onChange={(e) => updateWebSocket({ maxClients: parseInt(e.target.value) })}
                    className="w-full p-2 border rounded"
                    placeholder="50"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Heartbeat Interval (ms)
                  </label>
                  <input
                    type="number"
                    value={config.websocket.heartbeatInterval}
                    onChange={(e) =>
                      updateWebSocket({ heartbeatInterval: parseInt(e.target.value) })
                    }
                    className="w-full p-2 border rounded"
                    placeholder="30000"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Timeout (ms)</label>
                  <input
                    type="number"
                    value={config.websocket.timeoutMs}
                    onChange={(e) => updateWebSocket({ timeoutMs: parseInt(e.target.value) })}
                    className="w-full p-2 border rounded"
                    placeholder="60000"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium mb-1">
                    Rate Limit (events/sec)
                  </label>
                  <input
                    type="number"
                    value={config.websocket.rateLimit}
                    onChange={(e) => updateWebSocket({ rateLimit: parseInt(e.target.value) })}
                    className="w-full p-2 border rounded"
                    placeholder="100"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Testing Tab */}
          {activeTab === "testing" && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold mb-4">Testing Configuration</h2>

              <div>
                <label className="flex items-center mb-3">
                  <input
                    type="checkbox"
                    checked={config.testing.enabled}
                    onChange={(e) => updateTesting({ enabled: e.target.checked })}
                    className="mr-2"
                  />
                  <span className="text-sm font-medium">Enable Testing Framework</span>
                </label>
              </div>

              <div>
                <label className="flex items-center mb-3">
                  <input
                    type="checkbox"
                    checked={config.testing.autoGenerateTests}
                    onChange={(e) => updateTesting({ autoGenerateTests: e.target.checked })}
                    className="mr-2"
                  />
                  <span className="text-sm font-medium">Auto-Generate Tests</span>
                </label>
              </div>

              <div>
                <label className="flex items-center mb-3">
                  <input
                    type="checkbox"
                    checked={config.testing.performanceBaselines}
                    onChange={(e) => updateTesting({ performanceBaselines: e.target.checked })}
                    className="mr-2"
                  />
                  <span className="text-sm font-medium">Track Performance Baselines</span>
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Coverage Threshold (%)
                </label>
                <input
                  type="number"
                  value={config.testing.coverageThreshold}
                  onChange={(e) =>
                    updateTesting({ coverageThreshold: parseInt(e.target.value) })
                  }
                  className="w-full p-2 border rounded"
                  placeholder="80"
                  min="0"
                  max="100"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Minimum code coverage percentage required
                </p>
              </div>
            </div>
          )}

          {/* Logging Tab */}
          {activeTab === "logging" && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold mb-4">Logging Configuration</h2>

              <div>
                <label className="block text-sm font-medium mb-1">Log Level</label>
                <select
                  value={config.logging.level}
                  onChange={(e) =>
                    updateLogging({
                      level: e.target.value as "debug" | "info" | "warn" | "error",
                    })
                  }
                  className="w-full p-2 border rounded"
                >
                  <option value="debug">Debug</option>
                  <option value="info">Info</option>
                  <option value="warn">Warning</option>
                  <option value="error">Error</option>
                </select>
              </div>

              <div>
                <label className="flex items-center mb-3">
                  <input
                    type="checkbox"
                    checked={config.logging.console}
                    onChange={(e) => updateLogging({ console: e.target.checked })}
                    className="mr-2"
                  />
                  <span className="text-sm font-medium">Log to Console</span>
                </label>
              </div>

              <div>
                <label className="flex items-center mb-3">
                  <input
                    type="checkbox"
                    checked={config.logging.file}
                    onChange={(e) => updateLogging({ file: e.target.checked })}
                    className="mr-2"
                  />
                  <span className="text-sm font-medium">Log to File</span>
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Log File Path</label>
                <input
                  type="text"
                  value={config.logging.filePath}
                  onChange={(e) => updateLogging({ filePath: e.target.value })}
                  className="w-full p-2 border rounded"
                  placeholder="./logs/trinity-mcp.log"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Max File Size (bytes)
                  </label>
                  <input
                    type="number"
                    value={config.logging.maxFileSize}
                    onChange={(e) => updateLogging({ maxFileSize: parseInt(e.target.value) })}
                    className="w-full p-2 border rounded"
                    placeholder="10485760"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {(config.logging.maxFileSize / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Max Files</label>
                  <input
                    type="number"
                    value={config.logging.maxFiles}
                    onChange={(e) => updateLogging({ maxFiles: parseInt(e.target.value) })}
                    className="w-full p-2 border rounded"
                    placeholder="5"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          onClick={saveConfig}
          disabled={saving}
          className="px-6 py-3 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
        >
          {saving ? "Saving..." : "Save Settings"}
        </button>

        <button
          onClick={resetConfig}
          disabled={saving}
          className="px-6 py-3 bg-gray-600 text-white rounded hover:bg-gray-700 disabled:bg-gray-400"
        >
          Reset to Defaults
        </button>

        <button
          onClick={loadConfig}
          disabled={loading}
          className="px-6 py-3 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 disabled:bg-gray-100"
        >
          Reload
        </button>
      </div>
    </div>
  );
}
