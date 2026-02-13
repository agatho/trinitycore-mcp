/**
 * Knowledge Base & Code Generation Tools Registry
 *
 * Wiki search, patterns, guides, code generation, scaffolding, game master, DB2 schema diff.
 *
 * @module tools/registry/knowledge-codegen
 */

import { ToolRegistryEntry, jsonResponse, textResponse } from "./types";
import {
  searchPlayerbotWiki,
  getPlayerbotPattern,
  getImplementationGuide,
  getTroubleshootingGuide,
  getAPIReference,
  listDocumentationCategories
} from "../knowledge";
import {
  generateBotComponent,
  generatePacketHandler,
  generateCMakeIntegration,
  validateGeneratedCode,
} from "../codegen";
import { generateScaffold, listScaffoldTypes } from "../scaffold";
import { processGameMasterCommand } from "../gamemaster";
import { diffDB2Files, diffDB2Directories, inspectDB2File } from "../db2schemadiff";

export const knowledgeCodegenTools: ToolRegistryEntry[] = [
  // Knowledge Base Tools
  {
    definition: {
      name: "search-playerbot-wiki",
      description: "Search the Playerbot wiki documentation (Phase 5 knowledge base with full-text search, <50ms p95)",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query (supports fuzzy matching and multi-word queries)" },
          category: { type: "string", description: "Optional: filter by category (getting_started, patterns, workflows, troubleshooting, api_reference, examples, advanced)" },
          difficulty: { type: "string", description: "Optional: filter by difficulty level (basic, intermediate, advanced)" },
          limit: { type: "number", description: "Optional: maximum number of results (default: 10)" },
        },
        required: ["query"],
      },
    },
    handler: async (args) => {
      const result = await searchPlayerbotWiki(args.query as string, {
        category: args.category as any,
        difficulty: args.difficulty as any,
        limit: args.limit as number | undefined,
      });
      return jsonResponse(result);
    },
  },
  {
    definition: {
      name: "get-playerbot-pattern",
      description: "Get a specific Playerbot design pattern with implementation examples (Phase 5 pattern library)",
      inputSchema: {
        type: "object",
        properties: {
          patternId: { type: "string", description: "Pattern ID (e.g., 'patterns/combat/01_combat_ai_strategy')" },
        },
        required: ["patternId"],
      },
    },
    handler: async (args) => {
      const result = await getPlayerbotPattern(args.patternId as string);
      return jsonResponse(result);
    },
  },
  {
    definition: {
      name: "get-implementation-guide",
      description: "Get step-by-step implementation guide for Playerbot features (Phase 5 tutorials)",
      inputSchema: {
        type: "object",
        properties: {
          guideId: { type: "string", description: "Guide ID (e.g., 'getting_started/01_introduction' or 'workflows/01_build_workflow')" },
        },
        required: ["guideId"],
      },
    },
    handler: async (args) => {
      const result = await getImplementationGuide(args.guideId as string);
      return jsonResponse(result);
    },
  },
  {
    definition: {
      name: "get-troubleshooting-guide",
      description: "Search for troubleshooting solutions for common Playerbot problems (Phase 5 debugging help)",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Problem description or error message" },
        },
        required: ["query"],
      },
    },
    handler: async (args) => {
      const result = await getTroubleshootingGuide(args.query as string);
      return jsonResponse(result);
    },
  },
  {
    definition: {
      name: "get-api-reference",
      description: "Get TrinityCore API reference documentation for a specific class (Phase 5 API docs)",
      inputSchema: {
        type: "object",
        properties: {
          className: { type: "string", description: "Class name (e.g., 'Player', 'Unit', 'Spell', 'BotAI')" },
        },
        required: ["className"],
      },
    },
    handler: async (args) => {
      const result = await getAPIReference(args.className as string);
      return jsonResponse(result);
    },
  },
  {
    definition: {
      name: "list-documentation-categories",
      description: "List all documentation categories with statistics (Phase 5 knowledge base overview)",
      inputSchema: { type: "object", properties: {} },
    },
    handler: async () => {
      const result = await listDocumentationCategories();
      return jsonResponse(result);
    },
  },
  // Code Generation Tools
  {
    definition: {
      name: "generate-bot-component",
      description: "Generate AI strategy, state manager, or event handler component (Phase 5 code generation, <500ms p95)",
      inputSchema: {
        type: "object",
        properties: {
          componentType: { type: "string", description: "Component type: ai_strategy, state_manager, or event_handler" },
          className: { type: "string", description: "C++ class name (e.g., 'WarriorTankStrategy')" },
          description: { type: "string", description: "Optional: component description" },
          role: { type: "string", description: "Optional: bot role for AI strategies (tank, healer, dps)" },
          outputPath: { type: "string", description: "Optional: output file path (default: generated/{type}/{class}.h)" },
          namespace: { type: "string", description: "Optional: C++ namespace (default: Playerbot)" },
          includeTests: { type: "boolean", description: "Optional: generate test file (default: false)" },
        },
        required: ["componentType", "className"],
      },
    },
    handler: async (args) => {
      const result = await generateBotComponent({
        componentType: args.componentType as any,
        className: args.className as string,
        description: args.description as string | undefined,
        role: args.role as any,
        outputPath: args.outputPath as string | undefined,
        namespace: args.namespace as string | undefined,
        includeTests: args.includeTests as boolean | undefined,
      });
      return jsonResponse(result);
    },
  },
  {
    definition: {
      name: "generate-packet-handler",
      description: "Generate packet handler for client/server communication (Phase 5 code generation, <312ms p95)",
      inputSchema: {
        type: "object",
        properties: {
          handlerName: { type: "string", description: "Handler class name (e.g., 'SpellCastPacketHandler')" },
          opcode: { type: "string", description: "Packet opcode (e.g., 'CMSG_CAST_SPELL')" },
          direction: { type: "string", description: "Packet direction: client, server, or bidirectional" },
          fields: { type: "array", description: "Packet fields array with {name, type, description, isGuid?, isString?}" },
          outputPath: { type: "string", description: "Optional: output file path" },
          namespace: { type: "string", description: "Optional: C++ namespace (default: Playerbot::Packets)" },
        },
        required: ["handlerName", "opcode", "direction", "fields"],
      },
    },
    handler: async (args) => {
      const result = await generatePacketHandler({
        handlerName: args.handlerName as string,
        opcode: args.opcode as string,
        direction: args.direction as any,
        fields: args.fields as any[],
        outputPath: args.outputPath as string | undefined,
        namespace: args.namespace as string | undefined,
      });
      return jsonResponse(result);
    },
  },
  {
    definition: {
      name: "generate-cmake-integration",
      description: "Generate CMakeLists.txt for bot component integration (Phase 5 code generation, <200ms p95)",
      inputSchema: {
        type: "object",
        properties: {
          projectName: { type: "string", description: "Project/module name" },
          sourceFiles: { type: "array", description: "Array of .cpp source file paths" },
          headerFiles: { type: "array", description: "Array of .h header file paths" },
          testFiles: { type: "array", description: "Optional: array of test file paths" },
          isLibrary: { type: "boolean", description: "Optional: create as static library (default: false)" },
          dependencies: { type: "array", description: "Optional: array of dependency library names" },
          outputPath: { type: "string", description: "Optional: output file path" },
        },
        required: ["projectName", "sourceFiles", "headerFiles"],
      },
    },
    handler: async (args) => {
      const result = await generateCMakeIntegration({
        projectName: args.projectName as string,
        sourceFiles: args.sourceFiles as string[],
        headerFiles: args.headerFiles as string[],
        testFiles: args.testFiles as string[] | undefined,
        isLibrary: args.isLibrary as boolean | undefined,
        dependencies: args.dependencies as string[] | undefined,
        outputPath: args.outputPath as string | undefined,
      });
      return jsonResponse(result);
    },
  },
  {
    definition: {
      name: "validate-generated-code",
      description: "Validate generated C++ code for compilation errors (Phase 5 validation, <2000ms p95)",
      inputSchema: {
        type: "object",
        properties: {
          filePath: { type: "string", description: "Path to generated file to validate" },
          checkCompilation: { type: "boolean", description: "Optional: perform compilation check (requires g++ or clang)" },
          checkStyle: { type: "boolean", description: "Optional: check code style (default: false)" },
        },
        required: ["filePath"],
      },
    },
    handler: async (args) => {
      const result = await validateGeneratedCode({
        filePath: args.filePath as string,
        checkCompilation: args.checkCompilation as boolean | undefined,
        checkStyle: args.checkStyle as boolean | undefined,
      });
      return jsonResponse(result);
    },
  },
  // Scaffold Generator
  {
    definition: {
      name: "generate-scaffold",
      description: "Smart code scaffold generator - creates production-ready scaffolds for MCP tools, database tools, parsers, web pages, API routes, components, tests, migrations, and utilities. Analyzes project conventions and generates complete, context-aware code.",
      inputSchema: {
        type: "object",
        properties: {
          type: { type: "string", description: "Scaffold type to generate", enum: ["mcp-tool", "database-tool", "parser", "web-page", "api-route", "web-component", "unit-test", "database-migration", "utility"] },
          name: { type: "string", description: "Component name in kebab-case (e.g., 'arena-stats', 'reputation-tracker')" },
          description: { type: "string", description: "Human-readable description of the component" },
          features: { type: "array", description: "Optional features to include: caching, pagination, filtering, sorting, export, validation, logging, error-handling, performance, websocket, dark-mode, responsive" },
          databaseTables: { type: "array", description: "For database-tool type: tables to query" },
          db2Files: { type: "array", description: "For parser type: DB2 files to parse" },
          parameters: { type: "array", description: "For MCP tools: input parameters as [{name, type, description, required}]" },
          includeTests: { type: "boolean", description: "Generate corresponding unit tests (default: false)" },
          category: { type: "string", description: "Optional: custom category for organization" },
        },
        required: ["type", "name", "description"],
      },
    },
    handler: async (args) => {
      const result = await generateScaffold({
        type: args.type as any,
        name: args.name as string,
        description: args.description as string,
        features: args.features as any,
        databaseTables: args.databaseTables as string[] | undefined,
        db2Files: args.db2Files as string[] | undefined,
        parameters: args.parameters as any,
        includeTests: args.includeTests as boolean | undefined,
        category: args.category as string | undefined,
      });

      let scaffoldOutput = `## Scaffold Generated: ${args.name}\n\n`;
      scaffoldOutput += `**Type:** ${args.type}\n`;
      scaffoldOutput += `**Files:** ${result.files.length}\n`;
      scaffoldOutput += `**Total Lines:** ${result.totalLinesOfCode}\n`;
      scaffoldOutput += `**Generation Time:** ${result.generationTime.toFixed(1)}ms\n\n`;

      for (const file of result.files) {
        scaffoldOutput += `### ${file.path}\n`;
        scaffoldOutput += `${file.description} (${file.linesOfCode} lines)\n\n`;
        scaffoldOutput += "```typescript\n";
        scaffoldOutput += file.content;
        scaffoldOutput += "\n```\n\n";
      }

      if (result.registrationSnippet) {
        scaffoldOutput += `### Registration Snippet (add to src/index.ts)\n\n`;
        scaffoldOutput += "```typescript\n";
        scaffoldOutput += result.registrationSnippet;
        scaffoldOutput += "\n```\n\n";
      }

      if (result.instructions.length > 0) {
        scaffoldOutput += `### Next Steps\n\n`;
        for (const instruction of result.instructions) {
          scaffoldOutput += `${instruction}\n`;
        }
      }

      return textResponse(scaffoldOutput);
    },
  },
  {
    definition: {
      name: "list-scaffold-types",
      description: "List all available scaffold types with their descriptions, default features, and output directories",
      inputSchema: { type: "object", properties: {} },
    },
    handler: async () => {
      const types = listScaffoldTypes();
      let typesOutput = "## Available Scaffold Types\n\n";
      for (const t of types) {
        typesOutput += `### ${t.type}\n`;
        typesOutput += `${t.description}\n`;
        typesOutput += `**Output:** ${t.outputDirectory}\n`;
        typesOutput += `**Default Features:** ${t.defaultFeatures.join(', ') || 'none'}\n\n`;
      }
      return textResponse(typesOutput);
    },
  },
  // Game Master
  {
    definition: {
      name: "game-master",
      description: "Natural Language Game Master - parse natural language commands into TrinityCore GM commands. Supports: spawn creatures, teleport players, modify stats, give items, change weather, announcements, lookups, and more. Returns executable .commands with risk assessment.",
      inputSchema: {
        type: "object",
        properties: {
          command: { type: "string", description: "Natural language GM command (e.g., 'spawn 5 wolves near Goldshire', 'teleport me to Orgrimmar', 'set Player1 level to 80', 'give item 19019 to Player1', 'make it rain', 'announce Server maintenance in 30 minutes')" },
          dryRun: { type: "boolean", description: "If true (default), only generates commands without executing. Set to false to execute via SOAP." },
        },
        required: ["command"],
      },
    },
    handler: async (args) => {
      const result = await processGameMasterCommand(args.command as string, args.dryRun !== false);
      return jsonResponse(result);
    },
  },
  // DB2 Schema Diff
  {
    definition: {
      name: "db2-schema-diff",
      description: "Compare two DB2 files or directories to detect schema changes. Reports header diffs (table hash, layout hash, field count, record size), field-level changes (added/removed/modified fields with size and offset), section diffs, and produces a compatibility assessment with migration notes. Supports single-file comparison, directory batch comparison, and single-file inspection.",
      inputSchema: {
        type: "object",
        properties: {
          mode: { type: "string", enum: ["diff", "directory-diff", "inspect"], description: "Operation mode: 'diff' compares two files, 'directory-diff' compares all DB2 files in two directories, 'inspect' shows metadata for a single file" },
          fileA: { type: "string", description: "Path to the first (old/baseline) DB2 file or directory" },
          fileB: { type: "string", description: "Path to the second (new/updated) DB2 file or directory (not needed for 'inspect' mode)" },
          fileFilter: { type: "string", description: "Optional filename filter for directory-diff mode (e.g., 'Spell*' to only compare Spell files)" },
        },
        required: ["mode", "fileA"],
      },
    },
    handler: async (args) => {
      const mode = args.mode as string;
      const fileA = args.fileA as string;
      const fileB = args.fileB as string | undefined;
      const fileFilter = args.fileFilter as string | undefined;

      let result: unknown;
      switch (mode) {
        case "diff": {
          if (!fileB) throw new Error("fileB is required for 'diff' mode");
          result = diffDB2Files(fileA, fileB);
          break;
        }
        case "directory-diff": {
          if (!fileB) throw new Error("fileB is required for 'directory-diff' mode");
          result = diffDB2Directories(fileA, fileB, fileFilter);
          break;
        }
        case "inspect": {
          result = inspectDB2File(fileA);
          break;
        }
        default:
          throw new Error(`Unknown mode: ${mode}. Use 'diff', 'directory-diff', or 'inspect'.`);
      }

      return jsonResponse(result);
    },
  },
];
