/**
 * Monitoring & Production Tools Registry
 *
 * Health status, metrics, logs, backups, security status.
 *
 * @module tools/registry/monitoring-production
 */

import { ToolRegistryEntry, jsonResponse, textResponse } from "./types";
import { getHealthStatus, getMetricsSnapshot, queryLogs, getLogFileLocation, getMonitoringStatus } from "../monitoring";
import { triggerBackup, verifyBackup, getSecurityStatus, listBackups } from "../production";

export const monitoringProductionTools: ToolRegistryEntry[] = [
  {
    definition: {
      name: "get-health-status",
      description: "Get comprehensive MCP server health status - components, metrics, uptime, and system health indicators",
      inputSchema: { type: "object", properties: {} },
    },
    handler: async () => {
      const result = await getHealthStatus();
      return textResponse(result);
    },
  },
  {
    definition: {
      name: "get-metrics-snapshot",
      description: "Get current metrics snapshot - request counts, response times, error rates, cache hit rates",
      inputSchema: {
        type: "object",
        properties: {
          includeHistory: { type: "boolean", description: "Include historical metrics (last hour)" },
          metricTypes: { type: "array", items: { type: "string" }, description: "Specific metric types to include (requests, cache, database, etc.)" },
        },
      },
    },
    handler: async (args) => {
      const result = await getMetricsSnapshot({
        format: args.format as "json" | "prometheus" | undefined,
        include_details: args.includeHistory as boolean | undefined,
      });
      return textResponse(result);
    },
  },
  {
    definition: {
      name: "query-logs",
      description: "Query server logs with filtering - search by level, time range, component, or text pattern",
      inputSchema: {
        type: "object",
        properties: {
          level: { type: "string", enum: ["DEBUG", "INFO", "WARN", "ERROR"], description: "Filter by log level" },
          component: { type: "string", description: "Filter by component name" },
          search: { type: "string", description: "Text search pattern" },
          startTime: { type: "string", description: "Start time (ISO 8601)" },
          endTime: { type: "string", description: "End time (ISO 8601)" },
          limit: { type: "number", description: "Maximum number of log entries (default: 100)" },
        },
        required: ["level"],
      },
    },
    handler: async (args) => {
      const result = await queryLogs({
        level: args.level as "DEBUG" | "INFO" | "WARN" | "ERROR" | undefined,
        search: args.search as string | undefined,
        start_time: args.startTime as string | undefined,
        end_time: args.endTime as string | undefined,
        limit: args.limit as number | undefined,
      });
      return textResponse(result);
    },
  },
  {
    definition: {
      name: "get-log-file-location",
      description: "Get the location of the server log file for direct access",
      inputSchema: { type: "object", properties: {} },
    },
    handler: async () => {
      const result = await getLogFileLocation();
      return textResponse(result);
    },
  },
  {
    definition: {
      name: "get-monitoring-status",
      description: "Get monitoring system status - health check config, metrics collection, alerting status",
      inputSchema: { type: "object", properties: {} },
    },
    handler: async () => {
      const result = await getMonitoringStatus();
      return textResponse(result);
    },
  },
  {
    definition: {
      name: "trigger-backup",
      description: "Manually trigger a backup operation (full or incremental) - returns backup ID and status",
      inputSchema: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["full", "incremental"], description: "Backup type (default: full)" },
          description: { type: "string", description: "Backup description" },
        },
      },
    },
    handler: async (args) => {
      const result = await triggerBackup({
        type: args.type as "full" | "incremental" | undefined,
        description: args.description as string | undefined,
      });
      return textResponse(result);
    },
  },
  {
    definition: {
      name: "verify-backup",
      description: "Verify backup integrity - checks checksum, file size, and restoration readiness",
      inputSchema: {
        type: "object",
        properties: {
          backupId: { type: "string", description: "Backup ID to verify" },
        },
        required: ["backupId"],
      },
    },
    handler: async (args) => {
      const result = await verifyBackup({ backup_id: args.backupId as string });
      return textResponse(result);
    },
  },
  {
    definition: {
      name: "get-security-status",
      description: "Get security status - rate limiting, access control, encryption, audit log status",
      inputSchema: { type: "object", properties: {} },
    },
    handler: async () => {
      const result = await getSecurityStatus();
      return textResponse(result);
    },
  },
  {
    definition: {
      name: "list-backups",
      description: "List all available backups with metadata - ID, type, size, timestamp, status",
      inputSchema: { type: "object", properties: {} },
    },
    handler: async () => {
      const result = await listBackups();
      return textResponse(result);
    },
  },
];
