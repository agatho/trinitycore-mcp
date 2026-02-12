/**
 * TrinityCore SOAP API Client
 *
 * Provides integration with TrinityCore's built-in SOAP API for remote command execution.
 *
 * Configuration in worldserver.conf:
 * SOAP.Enabled = 1
 * SOAP.IP = "127.0.0.1"
 * SOAP.Port = 7878
 *
 * @see https://trinitycore.info/en/install/Server-Setup/SOAP
 */

import soap from 'soap';

export interface SOAPConfig {
  host: string;
  port: number;
  username: string;
  password: string;
}

export interface SOAPCommandResult {
  success: boolean;
  result: string;
  error?: string;
}

export interface OnlinePlayer {
  guid: number;
  name: string;
  level: number;
  race: string;
  class: string;
  zone: string;
}

export interface ServerStatus {
  uptime: string;
  playersOnline: number;
  peakPlayers: number;
  avgLatency: number;
}

/**
 * Get SOAP configuration from environment variables
 */
export function getSOAPConfig(): SOAPConfig {
  return {
    host: process.env.TRINITY_SOAP_HOST || '127.0.0.1',
    port: parseInt(process.env.TRINITY_SOAP_PORT || '7878'),
    username: process.env.TRINITY_SOAP_USERNAME || '',
    password: process.env.TRINITY_SOAP_PASSWORD || '',
  };
}

/**
 * Build SOAP URL from config
 */
export function buildSOAPUrl(config: SOAPConfig): string {
  return `http://${config.host}:${config.port}/`;
}

/**
 * Execute a TrinityCore command via SOAP API
 *
 * @param command - The server command to execute (e.g., "server info", "account list")
 * @param config - SOAP configuration (optional, defaults to env vars)
 * @returns Command result
 *
 * @example
 * ```typescript
 * const result = await executeCommand('server info');
 * console.log(result.result);
 * ```
 */
export async function executeCommand(
  command: string,
  config?: SOAPConfig
): Promise<SOAPCommandResult> {
  try {
    const soapConfig = config || getSOAPConfig();
    const url = buildSOAPUrl(soapConfig);

    // Create SOAP client
    const client = await soap.createClientAsync(url, {
      wsdl_options: {
        timeout: 5000,
      },
    });

    // Set authentication
    client.setSecurity(
      new soap.BasicAuthSecurity(soapConfig.username, soapConfig.password)
    );

    // Execute command
    const [result] = await client.executeCommandAsync({
      command: command,
    });

    return {
      success: true,
      result: result?.return || '',
    };
  } catch (error: any) {
    return {
      success: false,
      result: '',
      error: error.message || 'SOAP request failed',
    };
  }
}

/**
 * Get list of online players using SOAP API
 *
 * @returns Array of online players
 */
export async function getOnlinePlayers(config?: SOAPConfig): Promise<OnlinePlayer[]> {
  const result = await executeCommand('list', config);

  if (!result.success) {
    console.error('Failed to get online players:', result.error);
    return [];
  }

  // Parse player list from command output
  // Example format: "1. PlayerName (Level 80 Human Warrior) - Stormwind"
  const players: OnlinePlayer[] = [];
  const lines = result.result.split('\n');

  for (const line of lines) {
    const match = line.match(/^\d+\.\s+(\w+)\s+\(Level\s+(\d+)\s+(\w+)\s+(\w+)\)\s+-\s+(.+)$/);
    if (match) {
      players.push({
        guid: players.length + 1,
        name: match[1],
        level: parseInt(match[2]),
        race: match[3],
        class: match[4],
        zone: match[5],
      });
    }
  }

  return players;
}

/**
 * Get server status and statistics using SOAP API
 *
 * @returns Server status information
 */
export async function getServerStatus(config?: SOAPConfig): Promise<ServerStatus> {
  const [infoResult, uptimeResult] = await Promise.all([
    executeCommand('server info', config),
    executeCommand('server uptime', config),
  ]);

  // Parse server info
  let playersOnline = 0;
  let peakPlayers = 0;

  if (infoResult.success) {
    const playersMatch = infoResult.result.match(/Players online:\s+(\d+)/);
    const peakMatch = infoResult.result.match(/Peak players:\s+(\d+)/);

    if (playersMatch) playersOnline = parseInt(playersMatch[1]);
    if (peakMatch) peakPlayers = parseInt(peakMatch[1]);
  }

  // Parse uptime
  let uptime = 'Unknown';
  if (uptimeResult.success) {
    const uptimeMatch = uptimeResult.result.match(/Server uptime:\s+(.+)/);
    if (uptimeMatch) uptime = uptimeMatch[1];
  }

  return {
    uptime,
    playersOnline,
    peakPlayers,
    avgLatency: 45, // TODO: Calculate from player latencies
  };
}

/**
 * Get detailed server information
 */
export async function getServerInfo(config?: SOAPConfig): Promise<Record<string, any>> {
  const result = await executeCommand('server info', config);

  if (!result.success) {
    return { error: result.error };
  }

  // Parse server info into structured data
  const info: Record<string, any> = {};
  const lines = result.result.split('\n');

  for (const line of lines) {
    const [key, ...values] = line.split(':');
    if (key && values.length > 0) {
      info[key.trim()] = values.join(':').trim();
    }
  }

  return info;
}

/**
 * Test SOAP connection to TrinityCore server
 *
 * @returns True if connection successful, false otherwise
 */
export async function testConnection(config?: SOAPConfig): Promise<boolean> {
  const result = await executeCommand('server info', config);
  return result.success;
}

/**
 * Get account information by username
 */
export async function getAccountInfo(username: string, config?: SOAPConfig): Promise<Record<string, any> | null> {
  const result = await executeCommand(`account ${username}`, config);

  if (!result.success) {
    return null;
  }

  const info: Record<string, any> = { username };
  const lines = result.result.split('\n');

  for (const line of lines) {
    const [key, ...values] = line.split(':');
    if (key && values.length > 0) {
      info[key.trim()] = values.join(':').trim();
    }
  }

  return info;
}

/**
 * Kick a player from the server
 */
export async function kickPlayer(playerName: string, reason?: string, config?: SOAPConfig): Promise<SOAPCommandResult> {
  const command = reason
    ? `kick ${playerName} ${reason}`
    : `kick ${playerName}`;

  return executeCommand(command, config);
}

/**
 * Broadcast a message to all players
 */
export async function broadcastMessage(message: string, config?: SOAPConfig): Promise<SOAPCommandResult> {
  return executeCommand(`announce ${message}`, config);
}

/**
 * Reload server configuration
 */
export async function reloadConfig(config?: SOAPConfig): Promise<SOAPCommandResult> {
  return executeCommand('reload config', config);
}

/**
 * Save all players
 */
export async function saveAll(config?: SOAPConfig): Promise<SOAPCommandResult> {
  return executeCommand('saveall', config);
}

/**
 * Get list of available commands (requires admin privileges)
 */
export async function getAvailableCommands(config?: SOAPConfig): Promise<string[]> {
  const result = await executeCommand('help', config);

  if (!result.success) {
    return [];
  }

  // Parse command list
  const commands: string[] = [];
  const lines = result.result.split('\n');

  for (const line of lines) {
    const match = line.match(/^\s*\.(\w+)/);
    if (match) {
      commands.push(match[1]);
    }
  }

  return commands;
}

/**
 * Common TrinityCore SOAP commands
 */
export const CommonCommands = {
  // Server management
  SERVER_INFO: 'server info',
  SERVER_UPTIME: 'server uptime',
  SERVER_SHUTDOWN: 'server shutdown',
  SERVER_RESTART: 'server restart',

  // Player management
  LIST_PLAYERS: 'list',
  KICK_PLAYER: (name: string) => `kick ${name}`,
  BAN_ACCOUNT: (account: string, duration: string) => `ban account ${account} ${duration}`,

  // Account management
  ACCOUNT_CREATE: (username: string, password: string) => `account create ${username} ${password}`,
  ACCOUNT_DELETE: (username: string) => `account delete ${username}`,
  ACCOUNT_SET_PASSWORD: (username: string, password: string) => `account set password ${username} ${password}`,

  // World management
  ANNOUNCE: (message: string) => `announce ${message}`,
  NOTIFY: (message: string) => `notify ${message}`,
  SAVE_ALL: 'saveall',

  // Configuration
  RELOAD_CONFIG: 'reload config',
  RELOAD_SCRIPTS: 'reload scripts',

  // Debug
  DEBUG_PLAY_CINEMATIC: (id: number) => `debug play cinematic ${id}`,
  DEBUG_PLAY_SOUND: (id: number) => `debug play sound ${id}`,
};

/**
 * Mock SOAP client for development/testing when SOAP is not available
 */
export class MockSOAPClient {
  async executeCommand(command: string): Promise<SOAPCommandResult> {
    console.log('[MOCK SOAP] Executing command:', command);

    // Simulate command execution with mock data
    if (command === 'list' || command === CommonCommands.LIST_PLAYERS) {
      return {
        success: true,
        result: `1. PlayerOne (Level 80 Human Warrior) - Stormwind
2. PlayerTwo (Level 70 Orc Shaman) - Orgrimmar
3. PlayerThree (Level 75 Night Elf Druid) - Darnassus`,
      };
    }

    if (command === 'server info' || command === CommonCommands.SERVER_INFO) {
      return {
        success: true,
        result: `TrinityCore Server Info
Version: TrinityCore rev. 2024.11.05
Players online: 3
Peak players: 150
Active threads: 4
Uptime: 2d 14h 32m`,
      };
    }

    if (command === 'server uptime' || command === CommonCommands.SERVER_UPTIME) {
      return {
        success: true,
        result: 'Server uptime: 2d 14h 32m',
      };
    }

    return {
      success: true,
      result: `Command executed: ${command}`,
    };
  }

  async getOnlinePlayers(): Promise<OnlinePlayer[]> {
    return [
      { guid: 1, name: 'PlayerOne', level: 90, race: 'Human', class: 'Warrior', zone: 'Stormwind' },
      { guid: 2, name: 'PlayerTwo', level: 70, race: 'Orc', class: 'Shaman', zone: 'Orgrimmar' },
      { guid: 3, name: 'PlayerThree', level: 75, race: 'Night Elf', class: 'Druid', zone: 'Darnassus' },
    ];
  }

  async getServerStatus(): Promise<ServerStatus> {
    return {
      uptime: '2d 14h 32m',
      playersOnline: 3,
      peakPlayers: 150,
      avgLatency: 45,
    };
  }
}

/**
 * Get SOAP client (mock or real based on environment)
 */
export function getSOAPClient(): MockSOAPClient | typeof import('./soap-client') {
  const useMock = process.env.TRINITY_SOAP_MOCK === 'true' || process.env.NODE_ENV === 'development';

  if (useMock) {
    console.log('[SOAP] Using mock SOAP client for development');
    return new MockSOAPClient();
  }

  return require('./soap-client');
}
