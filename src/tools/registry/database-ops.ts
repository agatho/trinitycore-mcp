/**
 * Database Operations Tools Registry
 *
 * Export, import, backup, restore, health check, and comparison tools for TrinityCore databases.
 *
 * @module tools/registry/database-ops
 */

import { ToolRegistryEntry, jsonResponse } from "./types";
import { exportAllDatabases, exportTables, ExportFormat } from "../../database/export-engine";
import { importFromDirectory, importFromFile } from "../../database/import-engine";
import { quickBackup, quickRestore } from "../../database/backup-restore";
import { quickHealthCheck, fullHealthCheck, healthCheckWithFix } from "../../database/health-checker";
import { compareDatabases } from "../../database/diff-tool";

/** Map user-provided format string to ExportFormat enum */
function toExportFormat(format: unknown): ExportFormat {
  const str = ((format as string) || "SQL").toUpperCase();
  switch (str) {
    case "JSON": return ExportFormat.JSON;
    case "CSV": return ExportFormat.CSV;
    case "SQL":
    default: return ExportFormat.SQL;
  }
}

/** Common database connection config builder */
function buildDbConfig(args: Record<string, unknown>) {
  return {
    host: args.host as string,
    port: (args.port as number) || 3306,
    user: args.user as string,
    password: args.password as string,
    database: args.database as string,
  };
}

/** Base connection config (without database) for multi-database operations */
function buildBaseConfig(args: Record<string, unknown>) {
  return {
    host: args.host as string,
    port: (args.port as number) || 3306,
    user: args.user as string,
    password: args.password as string,
  };
}

export const databaseOpsTools: ToolRegistryEntry[] = [
  {
    definition: {
      name: "export-database",
      description: "Export TrinityCore databases (world, auth, characters) to SQL or JSON format. Supports schema-only, data-only, or complete exports with compression.",
      inputSchema: {
        type: "object",
        properties: {
          host: { type: "string", description: "Database host" },
          port: { type: "number", description: "Database port (default: 3306)" },
          user: { type: "string", description: "Database user" },
          password: { type: "string", description: "Database password" },
          outputDir: { type: "string", description: "Output directory path" },
          format: { type: "string", enum: ["SQL", "JSON", "CSV"], description: "Export format (default: SQL)" },
        },
        required: ["host", "user", "password", "outputDir"],
      },
    },
    handler: async (args) => {
      const baseConfig = buildBaseConfig(args);
      const result = await exportAllDatabases(
        baseConfig,
        args.outputDir as string,
        toExportFormat(args.format)
      );
      return jsonResponse(result);
    },
  },
  {
    definition: {
      name: "export-database-tables",
      description: "Export specific tables from a TrinityCore database. Useful for partial backups or data migration.",
      inputSchema: {
        type: "object",
        properties: {
          host: { type: "string", description: "Database host" },
          port: { type: "number", description: "Database port (default: 3306)" },
          user: { type: "string", description: "Database user" },
          password: { type: "string", description: "Database password" },
          database: { type: "string", description: "Database name (world, auth, or characters)" },
          tables: { type: "array", items: { type: "string" }, description: "List of table names to export" },
          outputDir: { type: "string", description: "Output directory path" },
          format: { type: "string", enum: ["SQL", "JSON", "CSV"], description: "Export format (default: SQL)" },
        },
        required: ["host", "user", "password", "database", "tables", "outputDir"],
      },
    },
    handler: async (args) => {
      const dbConfig = buildDbConfig(args);
      const result = await exportTables(
        dbConfig,
        args.tables as string[],
        args.outputDir as string,
        toExportFormat(args.format)
      );
      return jsonResponse(result);
    },
  },
  {
    definition: {
      name: "import-database-from-directory",
      description: "Import database from a directory containing SQL/JSON export files. Validates and imports schema and data.",
      inputSchema: {
        type: "object",
        properties: {
          host: { type: "string", description: "Database host" },
          port: { type: "number", description: "Database port (default: 3306)" },
          user: { type: "string", description: "Database user" },
          password: { type: "string", description: "Database password" },
          database: { type: "string", description: "Database name (world, auth, or characters)" },
          directory: { type: "string", description: "Directory containing export files" },
          format: { type: "string", enum: ["SQL", "JSON", "CSV"], description: "Import format (default: SQL)" },
        },
        required: ["host", "user", "password", "database", "directory"],
      },
    },
    handler: async (args) => {
      const dbConfig = buildDbConfig(args);
      const result = await importFromDirectory(
        dbConfig,
        args.directory as string,
        toExportFormat(args.format)
      );
      return jsonResponse(result);
    },
  },
  {
    definition: {
      name: "import-database-from-file",
      description: "Import database from a single SQL/JSON file. Quick import for single-file backups.",
      inputSchema: {
        type: "object",
        properties: {
          host: { type: "string", description: "Database host" },
          port: { type: "number", description: "Database port (default: 3306)" },
          user: { type: "string", description: "Database user" },
          password: { type: "string", description: "Database password" },
          database: { type: "string", description: "Database name (world, auth, or characters)" },
          filepath: { type: "string", description: "Path to import file" },
          dropExisting: { type: "boolean", description: "Drop existing tables before import (default: false)" },
        },
        required: ["host", "user", "password", "database", "filepath"],
      },
    },
    handler: async (args) => {
      const dbConfig = buildDbConfig(args);
      const result = await importFromFile(
        dbConfig,
        args.filepath as string,
        (args.dropExisting as boolean) || false
      );
      return jsonResponse(result);
    },
  },
  {
    definition: {
      name: "backup-database",
      description: "Create a compressed backup of a TrinityCore database. Includes schema and data with metadata.",
      inputSchema: {
        type: "object",
        properties: {
          host: { type: "string", description: "Database host" },
          port: { type: "number", description: "Database port (default: 3306)" },
          user: { type: "string", description: "Database user" },
          password: { type: "string", description: "Database password" },
          database: { type: "string", description: "Database name (world, auth, or characters)" },
          backupDir: { type: "string", description: "Backup directory path" },
        },
        required: ["host", "user", "password", "database", "backupDir"],
      },
    },
    handler: async (args) => {
      const dbConfig = buildDbConfig(args);
      const result = await quickBackup(dbConfig, args.backupDir as string);
      return jsonResponse(result);
    },
  },
  {
    definition: {
      name: "restore-database",
      description: "Restore a database from a backup file. Validates backup integrity before restoration.",
      inputSchema: {
        type: "object",
        properties: {
          host: { type: "string", description: "Database host" },
          port: { type: "number", description: "Database port (default: 3306)" },
          user: { type: "string", description: "Database user" },
          password: { type: "string", description: "Database password" },
          database: { type: "string", description: "Database name (world, auth, or characters)" },
          backup: { type: "string", description: "Path to backup file" },
          dropExisting: { type: "boolean", description: "Drop existing database before restore (default: false)" },
        },
        required: ["host", "user", "password", "database", "backup"],
      },
    },
    handler: async (args) => {
      const dbConfig = buildDbConfig(args);
      const result = await quickRestore(
        dbConfig,
        args.backup as string,
        (args.dropExisting as boolean) || false
      );
      return jsonResponse(result);
    },
  },
  {
    definition: {
      name: "database-health-check-quick",
      description: "Quick health check of database: connection, table count, index status, basic integrity. Takes ~5-10 seconds.",
      inputSchema: {
        type: "object",
        properties: {
          host: { type: "string", description: "Database host" },
          port: { type: "number", description: "Database port (default: 3306)" },
          user: { type: "string", description: "Database user" },
          password: { type: "string", description: "Database password" },
          database: { type: "string", description: "Database name (world, auth, or characters)" },
        },
        required: ["host", "user", "password", "database"],
      },
    },
    handler: async (args) => {
      const dbConfig = buildDbConfig(args);
      const result = await quickHealthCheck(dbConfig);
      return jsonResponse(result);
    },
  },
  {
    definition: {
      name: "database-health-check-full",
      description: "Comprehensive health check: connection, integrity, performance, indexes, foreign keys, statistics. Takes several minutes.",
      inputSchema: {
        type: "object",
        properties: {
          host: { type: "string", description: "Database host" },
          port: { type: "number", description: "Database port (default: 3306)" },
          user: { type: "string", description: "Database user" },
          password: { type: "string", description: "Database password" },
          database: { type: "string", description: "Database name (world, auth, or characters)" },
        },
        required: ["host", "user", "password", "database"],
      },
    },
    handler: async (args) => {
      const dbConfig = buildDbConfig(args);
      const result = await fullHealthCheck(dbConfig);
      return jsonResponse(result);
    },
  },
  {
    definition: {
      name: "database-health-check-and-fix",
      description: "Health check with automatic repair: checks integrity, repairs tables, rebuilds indexes, updates statistics.",
      inputSchema: {
        type: "object",
        properties: {
          host: { type: "string", description: "Database host" },
          port: { type: "number", description: "Database port (default: 3306)" },
          user: { type: "string", description: "Database user" },
          password: { type: "string", description: "Database password" },
          database: { type: "string", description: "Database name (world, auth, or characters)" },
        },
        required: ["host", "user", "password", "database"],
      },
    },
    handler: async (args) => {
      const dbConfig = buildDbConfig(args);
      const result = await healthCheckWithFix(dbConfig);
      return jsonResponse(result);
    },
  },
  {
    definition: {
      name: "compare-databases",
      description: "Compare two database schemas/data and generate detailed diff report. Useful for migration planning and synchronization.",
      inputSchema: {
        type: "object",
        properties: {
          sourceHost: { type: "string", description: "Source database host" },
          sourcePort: { type: "number", description: "Source database port (default: 3306)" },
          sourceUser: { type: "string", description: "Source database user" },
          sourcePassword: { type: "string", description: "Source database password" },
          sourceDatabase: { type: "string", description: "Source database name" },
          targetHost: { type: "string", description: "Target database host" },
          targetPort: { type: "number", description: "Target database port (default: 3306)" },
          targetUser: { type: "string", description: "Target database user" },
          targetPassword: { type: "string", description: "Target database password" },
          targetDatabase: { type: "string", description: "Target database name" },
        },
        required: [
          "sourceHost", "sourceUser", "sourcePassword", "sourceDatabase",
          "targetHost", "targetUser", "targetPassword", "targetDatabase",
        ],
      },
    },
    handler: async (args) => {
      const sourceConfig = {
        host: args.sourceHost as string,
        port: (args.sourcePort as number) || 3306,
        user: args.sourceUser as string,
        password: args.sourcePassword as string,
        database: args.sourceDatabase as string,
      };
      const targetConfig = {
        host: args.targetHost as string,
        port: (args.targetPort as number) || 3306,
        user: args.targetUser as string,
        password: args.targetPassword as string,
        database: args.targetDatabase as string,
      };
      const result = await compareDatabases(sourceConfig, targetConfig);
      return jsonResponse(result);
    },
  },
];
