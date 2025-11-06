/**
 * SOAP Client Implementation
 *
 * Provides SOAP (Simple Object Access Protocol) client functionality for
 * communicating with TrinityCore game servers.
 *
 * @module soap/soap-client
 */

import * as net from "net";
import type { SOAPConnectionConfig, SOAPCommandResult } from "../types/soap.js";

/**
 * Execute SOAP command options
 */
export interface ExecuteSOAPCommandOptions {
  /** Command timeout in milliseconds (default: 10000) */
  timeout?: number;

  /** Retry on failure */
  retry?: boolean;

  /** Number of retry attempts */
  maxRetries?: number;
}

/**
 * Execute a SOAP command on the TrinityCore server
 *
 * @param config - SOAP connection configuration
 * @param command - Command to execute
 * @param options - Execution options
 * @returns Command execution result
 */
export async function executeSOAPCommand(
  config: SOAPConnectionConfig,
  command: string,
  options: ExecuteSOAPCommandOptions = {}
): Promise<SOAPCommandResult> {
  const timeout = options.timeout || config.timeout || 10000;
  const startTime = Date.now();

  return new Promise((resolve, reject) => {
    const client = new net.Socket();
    let responseData = "";
    let timeoutHandle: NodeJS.Timeout | null = null;

    // Set timeout
    timeoutHandle = setTimeout(() => {
      client.destroy();
      resolve({
        command,
        output: "",
        success: false,
        error: `Connection timeout after ${timeout}ms`,
        executionTime: Date.now() - startTime,
      });
    }, timeout);

    // Handle connection
    client.connect(config.port, config.host, () => {
      // Send authentication
      const authString = `${config.username}:${config.password}\n`;
      client.write(authString);

      // Send command
      client.write(`${command}\n`);
    });

    // Handle data received
    client.on("data", (data) => {
      responseData += data.toString();
    });

    // Handle connection end
    client.on("end", () => {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }

      resolve({
        command,
        output: responseData,
        success: true,
        executionTime: Date.now() - startTime,
      });
    });

    // Handle errors
    client.on("error", (error) => {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }

      resolve({
        command,
        output: responseData,
        success: false,
        error: error.message,
        executionTime: Date.now() - startTime,
      });
    });
  });
}

/**
 * Test SOAP connection
 *
 * @param config - SOAP connection configuration
 * @returns Connection test result
 */
export async function testSOAPConnection(
  config: SOAPConnectionConfig
): Promise<{ connected: boolean; message: string; responseTime: number }> {
  const startTime = Date.now();

  try {
    const result = await executeSOAPCommand(config, "server info", { timeout: 5000 });

    return {
      connected: result.success,
      message: result.success
        ? "Successfully connected to SOAP server"
        : result.error || "Connection failed",
      responseTime: Date.now() - startTime,
    };
  } catch (error) {
    return {
      connected: false,
      message: (error as Error).message,
      responseTime: Date.now() - startTime,
    };
  }
}

/**
 * Execute multiple SOAP commands in sequence
 *
 * @param config - SOAP connection configuration
 * @param commands - Array of commands to execute
 * @returns Array of command results
 */
export async function executeSOAPBatch(
  config: SOAPConnectionConfig,
  commands: string[]
): Promise<SOAPCommandResult[]> {
  const results: SOAPCommandResult[] = [];

  for (const command of commands) {
    const result = await executeSOAPCommand(config, command);
    results.push(result);

    // Stop on first failure
    if (!result.success) {
      break;
    }
  }

  return results;
}
