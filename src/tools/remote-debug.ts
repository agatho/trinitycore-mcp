/**
 * Remote Debugging Tools
 *
 * Remote debugging capabilities for TrinityCore servers.
 * Provides command execution, state inspection, and diagnostic capture.
 *
 * @module remote-debug
 */

import type { SOAPConnectionConfig } from "../types/soap";
import { executeSOAPCommand } from "../soap/soap-client";

// ============================================================================
// Types
// ============================================================================

/**
 * Debug session configuration
 */
export interface DebugSessionConfig {
  /** SOAP connection */
  connection: SOAPConnectionConfig;

  /** Session name */
  name?: string;

  /** Auto-capture on errors */
  autoCaptureErrors?: boolean;

  /** Command history size */
  historySize?: number;
}

/**
 * Command execution result
 */
export interface CommandResult {
  command: string;
  success: boolean;
  output: string;
  duration: number;
  timestamp: number;
  error?: string;
}

/**
 * Server state snapshot
 */
export interface ServerStateSnapshot {
  timestamp: number;
  serverInfo: {
    uptime: string;
    playersOnline: number;
    version: string;
  };
  performance: {
    avgWorldUpdateTime: number;
    avgSessionUpdateTime: number;
    connections: number;
  };
  database: {
    worldConnections: number;
    charactersConnections: number;
    authConnections: number;
  };
  memory: {
    used: number;
    available: number;
  };
}

/**
 * Diagnostic capture
 */
export interface DiagnosticCapture {
  timestamp: number;
  sessionName: string;
  reason: string;
  serverState: ServerStateSnapshot;
  recentCommands: CommandResult[];
  logs: string[];
}

// ============================================================================
// Remote Debug Session
// ============================================================================

export class RemoteDebugSession {
  private config: Required<DebugSessionConfig>;
  private commandHistory: CommandResult[] = [];
  private captureHistory: DiagnosticCapture[] = [];
  private isCapturing = false;

  constructor(config: DebugSessionConfig) {
    this.config = {
      connection: config.connection,
      name: config.name ?? `debug-${Date.now()}`,
      autoCaptureErrors: config.autoCaptureErrors ?? true,
      historySize: config.historySize ?? 100,
    };
  }

  /**
   * Execute remote command
   */
  public async executeCommand(command: string): Promise<CommandResult> {
    const startTime = Date.now();

    try {
      const result = await executeSOAPCommand(this.config.connection, command, {
        timeout: 10000,
      });

      const commandResult: CommandResult = {
        command,
        success: result.success,
        output: result.output || "",
        duration: Date.now() - startTime,
        timestamp: Date.now(),
        error: result.error,
      };

      // Add to history
      this.addToHistory(commandResult);

      // Auto-capture on error
      if (!result.success && this.config.autoCaptureErrors) {
        await this.captureDiagnostics(`Command failed: ${command}`);
      }

      return commandResult;
    } catch (error) {
      const commandResult: CommandResult = {
        command,
        success: false,
        output: "",
        duration: Date.now() - startTime,
        timestamp: Date.now(),
        error: (error as Error).message,
      };

      this.addToHistory(commandResult);

      if (this.config.autoCaptureErrors) {
        await this.captureDiagnostics(`Command exception: ${command}`);
      }

      return commandResult;
    }
  }

  /**
   * Capture server state snapshot
   */
  public async captureServerState(): Promise<ServerStateSnapshot> {
    const timestamp = Date.now();

    // Get server info
    const serverInfoResult = await executeSOAPCommand(this.config.connection, "server info");
    const serverInfo = this.parseServerInfo(serverInfoResult.output || "");

    // Get performance metrics (simulated - actual commands may vary)
    const perfResult = await executeSOAPCommand(this.config.connection, "server debug");
    const performance = this.parsePerformanceMetrics(perfResult.output || "");

    // Database connections (simulated)
    const database = {
      worldConnections: 0,
      charactersConnections: 0,
      authConnections: 0,
    };

    // Memory (simulated)
    const memory = {
      used: 0,
      available: 0,
    };

    return {
      timestamp,
      serverInfo,
      performance,
      database,
      memory,
    };
  }

  /**
   * Capture full diagnostics
   */
  public async captureDiagnostics(reason: string): Promise<DiagnosticCapture> {
    if (this.isCapturing) {
      throw new Error("Already capturing diagnostics");
    }

    this.isCapturing = true;

    try {
      const timestamp = Date.now();

      // Capture server state
      const serverState = await this.captureServerState();

      // Get recent commands
      const recentCommands = this.commandHistory.slice(-20);

      // Capture logs (simulated - would need log access)
      const logs: string[] = [];

      const capture: DiagnosticCapture = {
        timestamp,
        sessionName: this.config.name,
        reason,
        serverState,
        recentCommands,
        logs,
      };

      this.captureHistory.push(capture);

      return capture;
    } finally {
      this.isCapturing = false;
    }
  }

  /**
   * Inspect player
   */
  public async inspectPlayer(playerName: string): Promise<Record<string, unknown>> {
    const commands = [
      `character info ${playerName}`,
      `character reputation ${playerName}`,
      `character money ${playerName}`,
      `character level ${playerName}`,
    ];

    const results: Record<string, string> = {};

    for (const cmd of commands) {
      const result = await this.executeCommand(cmd);
      results[cmd] = result.output;
    }

    return {
      name: playerName,
      timestamp: Date.now(),
      data: results,
    };
  }

  /**
   * Inspect creature
   */
  public async inspectCreature(creatureGuid: number): Promise<Record<string, unknown>> {
    const commands = [
      `npc info ${creatureGuid}`,
      `gobject near ${creatureGuid}`,
    ];

    const results: Record<string, string> = {};

    for (const cmd of commands) {
      const result = await this.executeCommand(cmd);
      results[cmd] = result.output;
    }

    return {
      guid: creatureGuid,
      timestamp: Date.now(),
      data: results,
    };
  }

  /**
   * Run diagnostic suite
   */
  public async runDiagnostics(): Promise<{
    serverState: ServerStateSnapshot;
    checks: Array<{ name: string; passed: boolean; message: string }>;
  }> {
    const checks: Array<{ name: string; passed: boolean; message: string }> = [];

    // Check 1: Server responding
    try {
      const result = await executeSOAPCommand(this.config.connection, "server info", {
        timeout: 5000,
      });
      checks.push({
        name: "Server Responding",
        passed: result.success,
        message: result.success ? "Server is responding" : "Server not responding",
      });
    } catch (error) {
      checks.push({
        name: "Server Responding",
        passed: false,
        message: (error as Error).message,
      });
    }

    // Check 2: Database connectivity (simulated)
    try {
      const result = await executeSOAPCommand(this.config.connection, "server info");
      const hasDbInfo = result.output?.includes("Database") || false;
      checks.push({
        name: "Database Connectivity",
        passed: hasDbInfo,
        message: hasDbInfo ? "Database accessible" : "Database status unknown",
      });
    } catch (error) {
      checks.push({
        name: "Database Connectivity",
        passed: false,
        message: (error as Error).message,
      });
    }

    // Check 3: Player services (simulated)
    try {
      const result = await executeSOAPCommand(this.config.connection, "account onlinelist");
      checks.push({
        name: "Player Services",
        passed: result.success,
        message: result.success ? "Player services operational" : "Player services unavailable",
      });
    } catch (error) {
      checks.push({
        name: "Player Services",
        passed: false,
        message: (error as Error).message,
      });
    }

    const serverState = await this.captureServerState();

    return {
      serverState,
      checks,
    };
  }

  /**
   * Get command history
   */
  public getCommandHistory(): CommandResult[] {
    return [...this.commandHistory];
  }

  /**
   * Get capture history
   */
  public getCaptureHistory(): DiagnosticCapture[] {
    return [...this.captureHistory];
  }

  /**
   * Export diagnostics
   */
  public exportDiagnostics(): string {
    return JSON.stringify(
      {
        sessionName: this.config.name,
        commandHistory: this.commandHistory,
        captureHistory: this.captureHistory,
        exportedAt: Date.now(),
      },
      null,
      2,
    );
  }

  /**
   * Clear history
   */
  public clearHistory(): void {
    this.commandHistory = [];
    this.captureHistory = [];
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Add command to history
   */
  private addToHistory(result: CommandResult): void {
    this.commandHistory.push(result);

    // Trim to max size
    if (this.commandHistory.length > this.config.historySize) {
      this.commandHistory.shift();
    }
  }

  /**
   * Parse server info output
   */
  private parseServerInfo(output: string): ServerStateSnapshot["serverInfo"] {
    const uptimeMatch = output.match(/Uptime:\s+(.+)/i);
    const playersMatch = output.match(/Players online:\s+(\d+)/i);
    const versionMatch = output.match(/TrinityCore rev\.\s+([^\s]+)/i);

    return {
      uptime: uptimeMatch?.[1] || "unknown",
      playersOnline: playersMatch ? parseInt(playersMatch[1], 10) : 0,
      version: versionMatch?.[1] || "unknown",
    };
  }

  /**
   * Parse performance metrics
   */
  private parsePerformanceMetrics(output: string): ServerStateSnapshot["performance"] {
    // Simulated parsing - actual format depends on TrinityCore debug output
    return {
      avgWorldUpdateTime: 0,
      avgSessionUpdateTime: 0,
      connections: 0,
    };
  }
}

// ============================================================================
// Debug Session Manager
// ============================================================================

/**
 * Manages multiple debug sessions
 */
export class DebugSessionManager {
  private sessions: Map<string, RemoteDebugSession> = new Map();

  /**
   * Create debug session
   */
  public createSession(config: DebugSessionConfig): RemoteDebugSession {
    const name = config.name || `debug-${Date.now()}`;

    if (this.sessions.has(name)) {
      throw new Error(`Session ${name} already exists`);
    }

    const session = new RemoteDebugSession({ ...config, name });
    this.sessions.set(name, session);

    return session;
  }

  /**
   * Get session
   */
  public getSession(name: string): RemoteDebugSession | undefined {
    return this.sessions.get(name);
  }

  /**
   * Remove session
   */
  public removeSession(name: string): boolean {
    return this.sessions.delete(name);
  }

  /**
   * List sessions
   */
  public listSessions(): string[] {
    return Array.from(this.sessions.keys());
  }

  /**
   * Get all sessions
   */
  public getAllSessions(): Map<string, RemoteDebugSession> {
    return new Map(this.sessions);
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Quick server health check
 */
export async function quickHealthCheck(
  connection: SOAPConnectionConfig,
): Promise<{
  healthy: boolean;
  responseTime: number;
  message: string;
}> {
  const startTime = Date.now();

  try {
    const result = await executeSOAPCommand(connection, "server info", { timeout: 5000 });

    return {
      healthy: result.success,
      responseTime: Date.now() - startTime,
      message: result.success ? "Server is healthy" : result.error || "Server check failed",
    };
  } catch (error) {
    return {
      healthy: false,
      responseTime: Date.now() - startTime,
      message: (error as Error).message,
    };
  }
}

/**
 * Batch command execution
 */
export async function executeBatch(
  connection: SOAPConnectionConfig,
  commands: string[],
): Promise<CommandResult[]> {
  const results: CommandResult[] = [];

  for (const command of commands) {
    const startTime = Date.now();

    try {
      const result = await executeSOAPCommand(connection, command);

      results.push({
        command,
        success: result.success,
        output: result.output || "",
        duration: Date.now() - startTime,
        timestamp: Date.now(),
        error: result.error,
      });
    } catch (error) {
      results.push({
        command,
        success: false,
        output: "",
        duration: Date.now() - startTime,
        timestamp: Date.now(),
        error: (error as Error).message,
      });
    }
  }

  return results;
}
