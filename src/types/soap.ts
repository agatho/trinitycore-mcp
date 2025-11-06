/**
 * SOAP Type Definitions
 *
 * Type definitions for SOAP (Simple Object Access Protocol) connections
 * to TrinityCore servers.
 *
 * @module types/soap
 */

/**
 * SOAP connection configuration
 */
export interface SOAPConnectionConfig {
  /** Server hostname or IP address */
  host: string;

  /** SOAP port (default: 7878) */
  port: number;

  /** Authentication username */
  username: string;

  /** Authentication password */
  password: string;

  /** Optional: Enable SSL/TLS */
  secure?: boolean;

  /** Optional: Connection timeout in milliseconds */
  timeout?: number;

  /** Optional: Maximum retry attempts */
  maxRetries?: number;
}

/**
 * SOAP command result
 */
export interface SOAPCommandResult {
  /** Command that was executed */
  command: string;

  /** Command output/response */
  output: string;

  /** Execution success status */
  success: boolean;

  /** Error message if failed */
  error?: string;

  /** Execution time in milliseconds */
  executionTime: number;
}

/**
 * SOAP connection status
 */
export interface SOAPConnectionStatus {
  /** Connection state */
  connected: boolean;

  /** Server hostname */
  host: string;

  /** Server port */
  port: number;

  /** Last successful connection timestamp */
  lastConnected?: Date;

  /** Current error if any */
  error?: string;
}
