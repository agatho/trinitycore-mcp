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
  wowPath: string;
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
  const [envFileExists, setEnvFileExists] = useState<boolean>(false);
  const [envFiles, setEnvFiles] = useState<{ webUI: boolean; mcpServer: boolean }>({ webUI: false, mcpServer: false });
  const [showRestartInfo, setShowRestartInfo] = useState<boolean>(false);
  const [reloadInfo, setReloadInfo] = useState<string>("");
  const [diagnostic, setDiagnostic] = useState<any>(null);
  const [showDiagnostic, setShowDiagnostic] = useState<boolean>(false);

  // Load configuration on mount
  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async (reload = false) => {
    setLoading(true);
    setReloadInfo("");
    try {
      const url = reload ? "/api/config?reload=true" : "/api/config";
      const response = await fetch(url);
      const data = await response.json();
      setConfig(data.config);
      setEnvFileExists(data.envFileExists);
      if (data.envFiles) {
        setEnvFiles(data.envFiles);
      }
      if (reload && data.reloaded) {
        const reloadedFiles = [];
        if (data.envFiles?.webUI) reloadedFiles.push("web-ui/.env.local");
        if (data.envFiles?.mcpServer) reloadedFiles.push("root .env");

        const reloadMsg = reloadedFiles.length > 0
          ? `Configuration reloaded from: ${reloadedFiles.join(", ")}`
          : "Configuration reloaded (no .env files found)";

        setSuccessMessage(reloadMsg);
        setReloadInfo("✅ Web-UI configuration updated. Note: Changes to database, paths, and WOW_PATH take effect immediately. Server settings require restart.");
        setTimeout(() => {
          setSuccessMessage("");
          setReloadInfo("");
        }, 8000);
      }
    } catch (error) {
      console.error("Failed to load configuration:", error);
      setValidation({
        valid: false,
        errors: [`Failed to reload configuration: ${(error as Error).message}`],
        warnings: [],
      });
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async (persist = false) => {
    if (!config) return;

    setSaving(true);
    setValidation(null);
    setSuccessMessage("");
    setShowRestartInfo(false);

    try {
      const url = persist ? "/api/config?persist=true" : "/api/config";
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });

      const data = await response.json();

      if (data.success) {
        setValidation(data.validation);
        if (data.validation.valid) {
          setSuccessMessage(data.message || "Configuration saved successfully!");
          if (persist) {
            setShowRestartInfo(true);
          }
          setTimeout(() => {
            setSuccessMessage("");
            if (!persist) setShowRestartInfo(false);
          }, persist ? 10000 : 3000);
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

  const runDiagnostic = async () => {
    try {
      const response = await fetch("/api/config/diagnose");
      const data = await response.json();
      setDiagnostic(data.diagnostic);
      setShowDiagnostic(true);
    } catch (error) {
      console.error("Failed to run diagnostic:", error);
    }
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
        <div className="mt-2 flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-500">Web-UI:</span>
            {envFiles.webUI ? (
              <span className="text-sm text-green-600 flex items-center gap-1">
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                .env.local exists
              </span>
            ) : (
              <span className="text-sm text-orange-600 flex items-center gap-1">
                <span className="w-2 h-2 bg-orange-500 rounded-full"></span>
                No .env.local
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-500">MCP Server:</span>
            {envFiles.mcpServer ? (
              <span className="text-sm text-green-600 flex items-center gap-1">
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                .env exists
              </span>
            ) : (
              <span className="text-sm text-orange-600 flex items-center gap-1">
                <span className="w-2 h-2 bg-orange-500 rounded-full"></span>
                No .env
              </span>
            )}
          </div>
        </div>
        <button
          onClick={runDiagnostic}
          className="mt-3 px-4 py-2 bg-purple-600 text-white text-sm rounded hover:bg-purple-700"
        >
          🔍 Run Configuration Diagnostic
        </button>
      </div>

      {/* Diagnostic Information */}
      {showDiagnostic && diagnostic && (
        <div className="mb-4 p-4 bg-purple-50 border border-purple-300 rounded">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-bold text-purple-900">Configuration Diagnostic</h3>
            <button
              onClick={() => setShowDiagnostic(false)}
              className="text-purple-600 hover:text-purple-800"
            >
              ✕
            </button>
          </div>
          <div className="text-sm space-y-2">
            <div>
              <strong>Environment Files:</strong>
              <ul className="list-disc list-inside ml-3 text-xs mt-1">
                <li>web-ui/.env.local: {diagnostic.envFiles.webUI ? '✅ Exists' : '❌ Not found'}</li>
                <li>root .env: {diagnostic.envFiles.mcpServer ? '✅ Exists' : '❌ Not found'}</li>
              </ul>
            </div>
            <div>
              <strong>WOW_PATH Status:</strong>
              <ul className="list-disc list-inside ml-3 text-xs mt-1">
                <li>From process.env: {diagnostic.wowPath.fromProcessEnv || '(not set)'}</li>
                <li>From .env files: {diagnostic.wowPath.fromEnvFile || '(not set)'}</li>
                <li>Directory exists: {diagnostic.wowPath.exists ? '✅ Yes' : '❌ No'}</li>
                <li>Valid CASC installation: {diagnostic.wowPath.cascValid ? '✅ Yes' : '❌ No'}</li>
              </ul>
            </div>
            {!diagnostic.envFiles.webUI && !diagnostic.envFiles.mcpServer && (
              <div className="mt-3 p-3 bg-yellow-50 border border-yellow-300 rounded text-xs">
                <strong>⚠️ No .env files found!</strong>
                <p className="mt-1">You need to:</p>
                <ol className="list-decimal list-inside ml-2 mt-1">
                  <li>Enter your configuration values in the forms below</li>
                  <li>Click "Save & Persist to Both .env Files"</li>
                  <li>Click "Reload from .env Files"</li>
                </ol>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Success Message */}
      {successMessage && (
        <div className="mb-4 p-4 bg-green-100 border border-green-400 text-green-700 rounded">
          {successMessage}
        </div>
      )}

      {/* Reload Information */}
      {reloadInfo && (
        <div className="mb-4 p-4 bg-blue-50 border border-blue-300 text-blue-800 rounded">
          <div className="flex items-start gap-2">
            <div className="flex-1">
              {reloadInfo}
            </div>
          </div>
          <div className="mt-3 text-sm">
            <p className="font-semibold mb-1">Hot-reloadable (takes effect immediately):</p>
            <ul className="list-disc list-inside ml-3 text-xs space-y-1">
              <li>Database settings (reconnects automatically)</li>
              <li>Data paths (WOW_PATH, VMAP_PATH, etc.)</li>
              <li>Logging configuration</li>
            </ul>
            <p className="font-semibold mt-2 mb-1">Requires restart:</p>
            <ul className="list-disc list-inside ml-3 text-xs space-y-1">
              <li>Server host/port settings</li>
              <li>WebSocket port configuration</li>
            </ul>
          </div>
        </div>
      )}

      {/* Restart Information */}
      {showRestartInfo && (
        <div className="mb-4 p-4 bg-blue-100 border border-blue-400 text-blue-800 rounded">
          <h3 className="font-bold mb-2">Restart Required</h3>
          <p className="mb-2">
            Changes have been saved to both <strong>web-ui/.env.local</strong> and <strong>root .env</strong> files.
            Both services need to be restarted to apply changes.
          </p>
          <div className="mt-3 p-3 bg-blue-50 rounded border border-blue-300">
            <h4 className="font-semibold text-sm mb-2">How to restart services:</h4>

            <div className="mb-3">
              <p className="font-semibold text-xs mb-1">Web-UI (Next.js):</p>
              <ul className="text-sm space-y-1 list-disc list-inside ml-3">
                <li><strong>Dev:</strong> <code className="px-1 bg-blue-200 rounded">cd web-ui && npm run dev</code></li>
                <li><strong>Prod:</strong> <code className="px-1 bg-blue-200 rounded">cd web-ui && npm run build && npm start</code></li>
              </ul>
            </div>

            <div>
              <p className="font-semibold text-xs mb-1">MCP Server:</p>
              <ul className="text-sm space-y-1 list-disc list-inside ml-3">
                <li><strong>If standalone:</strong> Restart the MCP server process</li>
                <li><strong>If via Claude:</strong> Reload the MCP server in Claude settings</li>
                <li><strong>Docker:</strong> <code className="px-1 bg-blue-200 rounded">docker-compose restart</code></li>
              </ul>
            </div>
          </div>

          <div className="mt-3 p-2 bg-yellow-50 border border-yellow-300 rounded text-xs">
            <strong>Note:</strong> The MCP server will automatically use the new settings when spawned by the web-ui.
            Only restart the MCP server if you're running it standalone outside of the web-ui.
          </div>
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
                    className="w-full p-2 border rounded bg-white text-gray-900"
                    placeholder="localhost"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    MySQL/MariaDB server hostname or IP address
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Port</label>
                  <input
                    type="number"
                    value={config.database.port}
                    onChange={(e) => updateDatabase({ port: parseInt(e.target.value) })}
                    className="w-full p-2 border rounded bg-white text-gray-900"
                    placeholder="3306"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Database server port (default: 3306)
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">User</label>
                  <input
                    type="text"
                    value={config.database.user}
                    onChange={(e) => updateDatabase({ user: e.target.value })}
                    className="w-full p-2 border rounded bg-white text-gray-900"
                    placeholder="trinity"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Database username with read/write permissions
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Password</label>
                  <input
                    type="password"
                    value={config.database.password}
                    onChange={(e) => updateDatabase({ password: e.target.value })}
                    className="w-full p-2 border rounded bg-white text-gray-900"
                    placeholder="••••••••"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Database user password (stored securely)
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">World Database</label>
                  <input
                    type="text"
                    value={config.database.world}
                    onChange={(e) => updateDatabase({ world: e.target.value })}
                    className="w-full p-2 border rounded bg-white text-gray-900"
                    placeholder="world"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    World database name (game content, NPCs, quests)
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Auth Database</label>
                  <input
                    type="text"
                    value={config.database.auth}
                    onChange={(e) => updateDatabase({ auth: e.target.value })}
                    className="w-full p-2 border rounded bg-white text-gray-900"
                    placeholder="auth"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Auth database name (accounts, permissions)
                  </p>
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium mb-1">Characters Database</label>
                  <input
                    type="text"
                    value={config.database.characters}
                    onChange={(e) => updateDatabase({ characters: e.target.value })}
                    className="w-full p-2 border rounded bg-white text-gray-900"
                    placeholder="characters"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Characters database name (player data, inventory, achievements)
                  </p>
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
                  className="w-full p-2 border rounded bg-white text-gray-900"
                  placeholder="C:\TrinityCore or /home/user/TrinityCore"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Path to TrinityCore source code root directory
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  WoW Installation Path <span className="text-green-600 text-xs font-normal">● Hot-reloadable</span>
                </label>
                <input
                  type="text"
                  value={config.dataPaths.wowPath}
                  onChange={(e) => updateDataPaths({ wowPath: e.target.value })}
                  className="w-full p-2 border rounded bg-white text-gray-900"
                  placeholder="C:\Program Files (x86)\World of Warcraft\_retail_ or /Applications/World of Warcraft/_retail_"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Path to World of Warcraft retail installation directory (required for map extraction from CASC).
                  Changes take effect immediately after saving.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">GT Files Path</label>
                <input
                  type="text"
                  value={config.dataPaths.gtPath}
                  onChange={(e) => updateDataPaths({ gtPath: e.target.value })}
                  className="w-full p-2 border rounded bg-white text-gray-900"
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
                  className="w-full p-2 border rounded bg-white text-gray-900"
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
                  className="w-full p-2 border rounded bg-white text-gray-900"
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
                  className="w-full p-2 border rounded bg-white text-gray-900"
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
                  className="w-full p-2 border rounded bg-white text-gray-900"
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
                    className="w-full p-2 border rounded bg-white text-gray-900"
                    placeholder="localhost"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    MCP server bind address (0.0.0.0 for all interfaces)
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Port</label>
                  <input
                    type="number"
                    value={config.server.port}
                    onChange={(e) => updateServer({ port: parseInt(e.target.value) })}
                    className="w-full p-2 border rounded bg-white text-gray-900"
                    placeholder="3000"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    MCP server port (default: 3000)
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Max Connections</label>
                  <input
                    type="number"
                    value={config.server.maxConnections}
                    onChange={(e) => updateServer({ maxConnections: parseInt(e.target.value) })}
                    className="w-full p-2 border rounded bg-white text-gray-900"
                    placeholder="100"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Maximum concurrent connections allowed
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">CORS Origin</label>
                  <input
                    type="text"
                    value={config.server.corsOrigin}
                    onChange={(e) => updateServer({ corsOrigin: e.target.value })}
                    className="w-full p-2 border rounded bg-white text-gray-900"
                    placeholder="*"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Allowed origin(s) for CORS (* for all, or specific domain)
                  </p>
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
                  <p className="text-xs text-gray-500 mt-1 ml-6">
                    Cross-Origin Resource Sharing (enable for web clients)
                  </p>
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
                  <p className="text-xs text-gray-500 mt-1 ml-6">
                    Enable real-time bidirectional communication for live updates
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Port</label>
                  <input
                    type="number"
                    value={config.websocket.port}
                    onChange={(e) => updateWebSocket({ port: parseInt(e.target.value) })}
                    className="w-full p-2 border rounded bg-white text-gray-900"
                    placeholder="3001"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    WebSocket server port (must differ from HTTP port)
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Max Clients</label>
                  <input
                    type="number"
                    value={config.websocket.maxClients}
                    onChange={(e) => updateWebSocket({ maxClients: parseInt(e.target.value) })}
                    className="w-full p-2 border rounded bg-white text-gray-900"
                    placeholder="50"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Maximum simultaneous WebSocket connections
                  </p>
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
                    className="w-full p-2 border rounded bg-white text-gray-900"
                    placeholder="30000"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Keep-alive ping interval (30000ms = 30 seconds)
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Timeout (ms)</label>
                  <input
                    type="number"
                    value={config.websocket.timeoutMs}
                    onChange={(e) => updateWebSocket({ timeoutMs: parseInt(e.target.value) })}
                    className="w-full p-2 border rounded bg-white text-gray-900"
                    placeholder="60000"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Connection timeout before disconnect (60000ms = 1 minute)
                  </p>
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium mb-1">
                    Rate Limit (events/sec)
                  </label>
                  <input
                    type="number"
                    value={config.websocket.rateLimit}
                    onChange={(e) => updateWebSocket({ rateLimit: parseInt(e.target.value) })}
                    className="w-full p-2 border rounded bg-white text-gray-900"
                    placeholder="100"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Maximum events per second per client (prevents spam)
                  </p>
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
                <p className="text-xs text-gray-500 ml-6">
                  Activate automated testing tools and test execution
                </p>
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
                <p className="text-xs text-gray-500 ml-6">
                  Automatically create test cases from API endpoints and database schemas
                </p>
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
                <p className="text-xs text-gray-500 ml-6">
                  Record and monitor query execution times for performance regression detection
                </p>
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
                  className="w-full p-2 border rounded bg-white text-gray-900"
                  placeholder="80"
                  min="0"
                  max="100"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Minimum code coverage percentage required (0-100)
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
                  className="w-full p-2 border rounded bg-white text-gray-900"
                >
                  <option value="debug">Debug</option>
                  <option value="info">Info</option>
                  <option value="warn">Warning</option>
                  <option value="error">Error</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Minimum log level to capture (debug = all, error = only errors)
                </p>
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
                <p className="text-xs text-gray-500 ml-6">
                  Output logs to console/stdout for real-time monitoring
                </p>
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
                <p className="text-xs text-gray-500 ml-6">
                  Write logs to file with automatic rotation
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Log File Path</label>
                <input
                  type="text"
                  value={config.logging.filePath}
                  onChange={(e) => updateLogging({ filePath: e.target.value })}
                  className="w-full p-2 border rounded bg-white text-gray-900"
                  placeholder="./logs/trinity-mcp.log"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Path where log files will be written
                </p>
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
                    className="w-full p-2 border rounded bg-white text-gray-900"
                    placeholder="10485760"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Rotate log when size exceeds (10485760 = 10MB)
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Max Files</label>
                  <input
                    type="number"
                    value={config.logging.maxFiles}
                    onChange={(e) => updateLogging({ maxFiles: parseInt(e.target.value) })}
                    className="w-full p-2 border rounded bg-white text-gray-900"
                    placeholder="5"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Number of log files to keep (older files are deleted)
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => saveConfig(false)}
          disabled={saving}
          className="px-6 py-3 bg-gray-600 text-white rounded hover:bg-gray-700 disabled:bg-gray-400"
          title="Save changes temporarily (lost on restart)"
        >
          {saving ? "Saving..." : "Save (Memory Only)"}
        </button>

        <button
          onClick={() => saveConfig(true)}
          disabled={saving}
          className="px-6 py-3 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
          title="Save changes to both .env files (persisted)"
        >
          {saving ? "Saving..." : "Save & Persist to Both .env Files"}
        </button>

        <button
          onClick={() => loadConfig(true)}
          disabled={loading}
          className="px-6 py-3 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400"
          title="Reload configuration from .env files"
        >
          {loading ? "Loading..." : "Reload from .env Files"}
        </button>

        <button
          onClick={resetConfig}
          disabled={saving}
          className="px-6 py-3 bg-orange-600 text-white rounded hover:bg-orange-700 disabled:bg-gray-400"
          title="Reset all settings to default values"
        >
          Reset to Defaults
        </button>

        <button
          onClick={resetConfig}
          disabled={saving}
          className="px-6 py-3 bg-orange-600 text-white rounded hover:bg-orange-700 disabled:bg-gray-400"
          title="Reset all settings to default values"
        >
          Reset to Defaults
        </button>
      </div>

      {/* Help Section */}
      <div className="mt-6 p-4 bg-gray-100 border border-gray-300 rounded">
        <h3 className="font-bold text-gray-800 mb-2">Configuration Help</h3>
        <div className="text-sm text-gray-700 space-y-2">
          <p>
            <strong>Save (Memory Only):</strong> Saves changes temporarily. Changes will be lost when the server restarts.
          </p>
          <p>
            <strong>Save & Persist:</strong> Saves changes to <code className="px-1 bg-gray-200 rounded">web-ui/.env.local</code> file.
            Changes are permanent but require a server restart to take full effect.
          </p>
          <p>
            <strong>Reload from .env.local:</strong> Discards current changes and reloads configuration from the .env.local file.
          </p>
          <p>
            <strong>Reset to Defaults:</strong> Resets all settings to their default values (does not modify .env.local).
          </p>
          <p className="mt-3 pt-3 border-t border-gray-300">
            <strong>Note:</strong> The .env.local file should be located at <code className="px-1 bg-gray-200 rounded">web-ui/.env.local</code>.
            You can copy <code className="px-1 bg-gray-200 rounded">web-ui/.env.template</code> to create it.
          </p>
        </div>
      </div>

      {/* Help Section */}
      <div className="mt-6 p-4 bg-gray-100 border border-gray-300 rounded">
        <h3 className="font-bold text-gray-800 mb-2">Configuration Help</h3>
        <div className="text-sm text-gray-700 space-y-2">
          <p>
            <strong>Save (Memory Only):</strong> Saves changes temporarily. Changes will be lost when services restart.
          </p>
          <p>
            <strong>Save & Persist:</strong> Saves changes to BOTH:
          </p>
          <ul className="list-disc list-inside ml-4 mb-2">
            <li><code className="px-1 bg-gray-200 rounded">web-ui/.env.local</code> - Used by Next.js web-ui for direct database queries</li>
            <li><code className="px-1 bg-gray-200 rounded">.env</code> (root) - Used by standalone MCP server</li>
          </ul>
          <p>
            Changes are permanent but require restarting both services to take full effect.
          </p>
          <p>
            <strong>Reload from .env Files:</strong> Discards current changes and reloads configuration from both .env files.
          </p>
          <p>
            <strong>Reset to Defaults:</strong> Resets all settings to their default values (does not modify .env files).
          </p>
          <p className="mt-3 pt-3 border-t border-gray-300">
            <strong>Architecture:</strong>
          </p>
          <ul className="list-disc list-inside ml-4 text-xs">
            <li>The web-ui spawns the MCP server and passes environment variables</li>
            <li>Some features query the database directly (use web-ui/.env.local)</li>
            <li>Other features use the MCP server (which can use root .env if run standalone)</li>
            <li>This settings page keeps both files synchronized</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
