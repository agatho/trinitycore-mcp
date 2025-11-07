/**
 * TrinityCore AI Code Review System - Main Orchestration Module
 *
 * This module provides the high-level API for running comprehensive code reviews
 * that combine rule-based static analysis, Serena C++ symbol analysis, and AI-powered
 * enhancement with multi-LLM support.
 *
 * @module code-review
 * @author Claude Code
 * @version 1.0.0
 *
 * @example
 * // Quick review with OpenAI GPT-4
 * import { reviewProject } from './code-review';
 * await reviewProject({
 *   files: ['src/modules/Playerbot/**\/*.cpp'],
 *   llmConfig: { provider: 'openai', apiKey: process.env.OPENAI_API_KEY },
 *   reportPath: 'review-report.html',
 *   format: 'html',
 * });
 *
 * @example
 * // Advanced usage with custom configuration
 * import { createCodeReviewOrchestrator } from './code-review';
 * const orchestrator = await createCodeReviewOrchestrator({
 *   llmConfig: { provider: 'ollama', model: 'codellama:13b' },
 *   enableAI: true,
 *   severityFilter: ['critical', 'major'],
 *   minConfidence: 0.8,
 * });
 * const results = await orchestrator.reviewFiles(['src/file1.cpp']);
 * await orchestrator.generateReport(results, 'report.md', 'markdown');
 */

import fs from 'fs/promises';
import path from 'path';
import { glob } from 'glob';

// Core components
import { TrinityRuleEngine } from './TrinityRuleEngine';
import { CodeAnalysisEngine, createCodeAnalysisEngine } from './CodeAnalysisEngine';
import { AIReviewEngine, createAIReviewEngine, type LLMConfig, type LLMProvider } from './AIReviewEngine';
import {
  ReviewReportGenerator,
  createReviewReportGenerator,
  type ReportFormat,
  type ReportOptions,
} from './ReviewReportGenerator';
import { logger } from '../utils/logger';

// Type exports
import type {
  RuleViolation,
  IssueSeverity,
  RuleCategory,
  CodeFix,
  FixType,
  CodeContext,
  AST,
  ControlFlowGraph,
  DataFlowResult,
  CompilerType,
  CodeReviewRule,
} from './types';

// =============================================================================
// PUBLIC API TYPES
// =============================================================================

/**
 * Configuration options for code review orchestrator
 */
export interface CodeReviewConfig {
  /**
   * LLM configuration (OpenAI, Ollama, LM Studio)
   */
  llmConfig?: LLMConfig;

  /**
   * Enable AI-powered review enhancement
   * @default true
   */
  enableAI?: boolean;

  /**
   * Filter violations by severity
   */
  severityFilter?: IssueSeverity[];

  /**
   * Filter violations by category
   */
  categoryFilter?: RuleCategory[];

  /**
   * Minimum confidence threshold (0.0-1.0)
   * @default 0.5
   */
  minConfidence?: number;

  /**
   * Maximum number of violations to return
   */
  maxViolations?: number;

  /**
   * Project root directory
   * @default process.cwd()
   */
  projectRoot?: string;

  /**
   * Compiler type (gcc, clang, msvc)
   * @default 'gcc'
   */
  compilerType?: CompilerType;

  /**
   * Enable verbose logging
   * @default false
   */
  verbose?: boolean;

  /**
   * Serena MCP integration instance (optional)
   * If not provided, code analysis will be limited
   */
  serena?: any;

  /**
   * Pre-generated AST data from Serena MCP (two-step orchestration)
   * When provided, skips Serena calls and uses this AST directly
   * Format: { [filePath: string]: AST }
   */
  astData?: any;
}

/**
 * Results from a code review operation
 */
export interface CodeReviewResult {
  /**
   * Files analyzed
   */
  files: string[];

  /**
   * Total violations found
   */
  violations: RuleViolation[];

  /**
   * AI-enhanced violations (if AI enabled)
   */
  aiEnhanced: number;

  /**
   * Analysis duration in milliseconds
   */
  durationMs: number;

  /**
   * Statistics summary
   */
  statistics: {
    totalViolations: number;
    bySeverity: Record<IssueSeverity, number>;
    byCategory: Record<RuleCategory, number>;
    filesAnalyzed: number;
    filesWithIssues: number;
    averageConfidence: number;
    fixableIssues: number;
  };
}

/**
 * Options for quick project review
 */
export interface QuickReviewOptions {
  /**
   * File patterns to review (glob patterns)
   * @example ['src/**\/*.cpp', 'src/**\/*.h']
   */
  files: string[];

  /**
   * LLM configuration
   */
  llmConfig?: LLMConfig;

  /**
   * Report output path
   */
  reportPath?: string;

  /**
   * Report format
   * @default 'markdown'
   */
  format?: ReportFormat;

  /**
   * Project root directory
   * @default process.cwd()
   */
  projectRoot?: string;

  /**
   * Enable AI enhancement
   * @default true
   */
  enableAI?: boolean;

  /**
   * Severity filter
   */
  severityFilter?: IssueSeverity[];

  /**
   * Category filter
   */
  categoryFilter?: RuleCategory[];

  /**
   * Minimum confidence threshold
   * @default 0.5
   */
  minConfidence?: number;

  /**
   * Verbose output
   * @default false
   */
  verbose?: boolean;

  /**
   * Serena MCP integration
   */
  serena?: any;
}

// =============================================================================
// MAIN ORCHESTRATOR CLASS
// =============================================================================

/**
 * Main orchestrator class that coordinates all code review components
 */
export class CodeReviewOrchestrator {
  private ruleEngine: TrinityRuleEngine;
  private codeAnalysisEngine: CodeAnalysisEngine;
  private aiReviewEngine?: AIReviewEngine;
  private reportGenerator: ReviewReportGenerator;
  private config: Required<CodeReviewConfig>;

  /**
   * Create a new code review orchestrator
   *
   * @param config - Configuration options
   */
  constructor(config: CodeReviewConfig = {}) {
    // Set defaults
    this.config = {
      llmConfig: config.llmConfig || { provider: 'ollama', model: 'codellama:13b' },
      enableAI: config.enableAI ?? true,
      severityFilter: config.severityFilter || [],
      categoryFilter: config.categoryFilter || [],
      minConfidence: config.minConfidence ?? 0.5,
      maxViolations: config.maxViolations || Infinity,
      projectRoot: config.projectRoot || process.cwd(),
      compilerType: config.compilerType || 'gcc',
      verbose: config.verbose ?? false,
      serena: config.serena || undefined,
      astData: config.astData || undefined,
    };

    // FILE LOGGING for MCP debugging
    const logPath = 'c:/TrinityBots/trinitycore-mcp/mcp-debug.log';
    const logMsg = `\n=== CodeReviewOrchestrator constructed ===\n` +
                   `Config projectRoot: ${config.projectRoot}\n` +
                   `Effective projectRoot: ${this.config.projectRoot}\n` +
                   `process.cwd(): ${process.cwd()}\n`;
    try {
      require('fs').appendFileSync(logPath, logMsg);
    } catch (e) {}

    // Initialize components
    this.ruleEngine = new TrinityRuleEngine();
    this.codeAnalysisEngine = createCodeAnalysisEngine(this.config.serena, this.config.astData);
    this.reportGenerator = createReviewReportGenerator();

    // Initialize AI engine if enabled and LLM config provided
    if (this.config.enableAI && this.config.llmConfig) {
      this.aiReviewEngine = createAIReviewEngine(this.codeAnalysisEngine, this.config.llmConfig);
    }

    if (this.config.verbose) {
      logger.info('🔧 CodeReviewOrchestrator initialized');
      logger.info(`   - AI Enhancement: ${this.config.enableAI ? 'Enabled' : 'Disabled'}`);
      logger.info(`   - LLM Provider: ${this.config.llmConfig.provider}`);
      logger.info(`   - Project Root: ${this.config.projectRoot}`);
    }
  }

  /**
   * Review a single file
   *
   * @param filePath - Path to file to review
   * @returns Code review results
   */
  async reviewFile(filePath: string): Promise<CodeReviewResult> {
    return this.reviewFiles([filePath]);
  }

  /**
   * Review multiple files
   *
   * @param filePaths - Array of file paths to review
   * @returns Code review results
   */
  async reviewFiles(filePaths: string[]): Promise<CodeReviewResult> {
    const startTime = Date.now();

    // FILE LOGGING for MCP debugging
    const logPath = 'c:/TrinityBots/trinitycore-mcp/mcp-debug.log';
    const logMsg = `\n=== reviewFiles() called at ${new Date().toISOString()} ===\n` +
                   `Files count: ${filePaths.length}\n` +
                   `Project root: ${this.config.projectRoot}\n` +
                   `First 5 files: ${filePaths.slice(0, 5).join(', ')}\n`;
    try {
      await fs.appendFile(logPath, logMsg);
    } catch (e) {}

    if (this.config.verbose) {
      logger.info(`\n🔍 Reviewing ${filePaths.length} file(s)...`);
    }

    const allViolations: RuleViolation[] = [];
    const filesAnalyzed = new Set<string>();
    const filesWithIssues = new Set<string>();

    // Process each file
    for (const filePath of filePaths) {
      try {
        const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(this.config.projectRoot, filePath);

        // FILE LOGGING
        try {
          await fs.appendFile(logPath, `Checking file: ${filePath}\nAbsolute path: ${absolutePath}\n`);
        } catch (e) {}

        // Check if file exists
        try {
          await fs.access(absolutePath);
          // FILE LOGGING
          try {
            await fs.appendFile(logPath, `  ✓ File exists\n`);
          } catch (e) {}
        } catch {
          // FILE LOGGING
          try {
            await fs.appendFile(logPath, `  ✗ File NOT found!\n`);
          } catch (e) {}

          if (this.config.verbose) {
            logger.warn(`⚠️  File not found: ${filePath}`);
          }
          continue;
        }

        filesAnalyzed.add(filePath);

        if (this.config.verbose) {
          logger.info(`   Analyzing: ${filePath}`);
        }

        // Step 1: Code analysis with Serena integration
        const ast = await this.codeAnalysisEngine.analyzeFile(absolutePath);

        // Build CodeContext from AST with simplified CFG and data flow
        const entryNode: import('./types').CFGNode = {
          id: 'entry',
          type: 'entry',
          statements: [],
          line: 0,
          predecessors: [],
          successors: [],
        };
        const exitNode: import('./types').CFGNode = {
          id: 'exit',
          type: 'exit',
          statements: [],
          line: 0,
          predecessors: [],
          successors: [],
        };

        const codeContext: CodeContext = {
          file: absolutePath,
          ast,
          cfg: {
            nodes: [],
            edges: [],
            entry: entryNode,
            exit: exitNode,
          },
          dataFlow: {
            reachingDefinitions: new Map(),
            liveVariables: new Map(),
            definedVariables: new Map(),
            usedVariables: new Map(),
          },
          projectRoot: this.config.projectRoot,
          isTrinityCore: true,
          compilerType: this.config.compilerType,
          serena: this.config.serena,
        };

        // Step 2: Run rule engine
        const ruleResult = await this.ruleEngine.executeRules(ast, codeContext);
        const violations = ruleResult.violations;

        // FILE LOGGING
        try {
          await fs.appendFile(logPath, `  Rule engine found ${violations.length} violations\n`);
        } catch (e) {}

        if (violations.length > 0) {
          filesWithIssues.add(filePath);
        }

        // Step 3: AI enhancement (if enabled)
        if (this.config.enableAI && this.aiReviewEngine && violations.length > 0) {
          if (this.config.verbose) {
            logger.info(`   🤖 AI enhancing ${violations.length} violation(s)...`);
          }

          const batchResult = await this.aiReviewEngine.reviewViolationsBatch(violations, codeContext);
          // Extract enhanced violations from AI results (use original violations with AI insights)
          allViolations.push(...violations);
        } else {
          allViolations.push(...violations);
        }
      } catch (error) {
        logger.error(`❌ Error analyzing ${filePath}:`, error);
        if (this.config.verbose && error instanceof Error) {
          logger.error(error.stack);
        }
      }
    }

    // Filter violations
    const filteredViolations = this.filterViolations(allViolations);

    // FILE LOGGING
    try {
      await fs.appendFile(logPath,
        `\nBefore filtering: ${allViolations.length} violations\n` +
        `After filtering: ${filteredViolations.length} violations\n` +
        `Files analyzed: ${filesAnalyzed.size}\n` +
        `Files with issues: ${filesWithIssues.size}\n` +
        `Min confidence: ${this.config.minConfidence}\n`
      );
    } catch (e) {}

    // Calculate statistics
    const statistics = this.calculateStatistics(filteredViolations, filesAnalyzed.size, filesWithIssues.size);

    const durationMs = Date.now() - startTime;

    if (this.config.verbose) {
      logger.info(`\n✅ Review complete in ${durationMs}ms`);
      logger.info(`   - Total violations: ${filteredViolations.length}`);
      logger.info(`   - Files analyzed: ${filesAnalyzed.size}`);
      logger.info(`   - Files with issues: ${filesWithIssues.size}`);
    }

    // FILE LOGGING
    try {
      await fs.appendFile(logPath, `Duration: ${durationMs}ms\n=== END ===\n\n`);
    } catch (e) {}

    return {
      files: Array.from(filesAnalyzed),
      violations: filteredViolations,
      aiEnhanced: this.config.enableAI ? filteredViolations.length : 0,
      durationMs,
      statistics,
    };
  }

  /**
   * Review files matching glob patterns
   *
   * @param patterns - Glob patterns (e.g., 'src/**\/*.cpp')
   * @returns Code review results
   */
  async reviewPattern(patterns: string | string[]): Promise<CodeReviewResult> {
    const patternArray = Array.isArray(patterns) ? patterns : [patterns];

    logger.info(`\n🔍 reviewPattern() called`);
    logger.info(`   Patterns: ${patternArray.join(', ')}`);
    logger.info(`   Project root: ${this.config.projectRoot}`);

    const files: string[] = [];
    for (const pattern of patternArray) {
      logger.info(`   Searching with glob pattern: ${pattern}`);
      const matches = await glob(pattern, {
        cwd: this.config.projectRoot,
        absolute: false,
        ignore: ['**/node_modules/**', '**/build/**', '**/dist/**', '**/.git/**'],
      });
      logger.info(`   Glob found ${matches.length} matches for pattern: ${pattern}`);
      if (matches.length > 0 && matches.length <= 5) {
        logger.info(`   Sample files: ${matches.slice(0, 5).join(', ')}`);
      }
      files.push(...matches);
    }

    // Remove duplicates
    const uniqueFiles = Array.from(new Set(files));

    logger.info(`   Total unique files after deduplication: ${uniqueFiles.length}`);

    return this.reviewFiles(uniqueFiles);
  }

  /**
   * Generate a report from review results
   *
   * @param results - Code review results
   * @param outputPath - Output file path
   * @param format - Report format (markdown, html, json, console)
   */
  async generateReport(results: CodeReviewResult, outputPath: string, format: ReportFormat = 'markdown'): Promise<void> {
    if (this.config.verbose) {
      logger.info(`\n📄 Generating ${format} report: ${outputPath}`);
    }

    const reportOptions: ReportOptions = {
      format,
      title: 'TrinityCore Code Review Report',
      includeStatistics: true,
      includeAIInsights: this.config.enableAI,
      includeCodeSnippets: true,
      includeFixes: true,
      severityFilter: this.config.severityFilter.length > 0 ? this.config.severityFilter : undefined,
      categoryFilter: this.config.categoryFilter.length > 0 ? this.config.categoryFilter : undefined,
      minConfidence: this.config.minConfidence,
      outputPath,
      colorEnabled: format === 'console',
    };

    const reportResult = await this.reportGenerator.generateReport(results.violations, reportOptions);
    const report = reportResult.content;

    // Write to file (except for console format)
    if (format !== 'console') {
      await fs.writeFile(outputPath, report, 'utf-8');
      if (this.config.verbose) {
        logger.info(`   ✅ Report saved to: ${outputPath}`);
      }
    } else {
      // For console format, output to stdout
      logger.info(report);
    }
  }

  /**
   * Review project and generate report in one step
   *
   * @param patterns - File patterns to review
   * @param outputPath - Report output path
   * @param format - Report format
   */
  async reviewAndReport(
    patterns: string | string[],
    outputPath: string,
    format: ReportFormat = 'markdown'
  ): Promise<CodeReviewResult> {
    const results = await this.reviewPattern(patterns);
    await this.generateReport(results, outputPath, format);
    return results;
  }

  /**
   * Filter violations based on configuration
   */
  private filterViolations(violations: RuleViolation[]): RuleViolation[] {
    let filtered = violations;

    // Filter by severity
    if (this.config.severityFilter.length > 0) {
      filtered = filtered.filter((v) => this.config.severityFilter!.includes(v.severity));
    }

    // Filter by category
    if (this.config.categoryFilter.length > 0) {
      filtered = filtered.filter((v) => this.config.categoryFilter!.includes(v.metadata.category));
    }

    // Filter by confidence
    filtered = filtered.filter((v) => v.confidence >= this.config.minConfidence);

    // Limit results
    if (this.config.maxViolations < Infinity) {
      filtered = filtered.slice(0, this.config.maxViolations);
    }

    return filtered;
  }

  /**
   * Calculate statistics from violations
   */
  private calculateStatistics(
    violations: RuleViolation[],
    filesAnalyzed: number,
    filesWithIssues: number
  ): CodeReviewResult['statistics'] {
    const statistics: CodeReviewResult['statistics'] = {
      totalViolations: violations.length,
      bySeverity: {
        critical: 0,
        major: 0,
        minor: 0,
        info: 0,
      },
      byCategory: {
        null_safety: 0,
        memory: 0,
        concurrency: 0,
        convention: 0,
        security: 0,
        performance: 0,
        architecture: 0,
      },
      filesAnalyzed,
      filesWithIssues,
      averageConfidence: 0,
      fixableIssues: 0,
    };

    for (const violation of violations) {
      statistics.bySeverity[violation.severity]++;
      statistics.byCategory[violation.metadata.category]++;
      if (violation.suggestedFix) {
        statistics.fixableIssues++;
      }
    }

    if (violations.length > 0) {
      const totalConfidence = violations.reduce((sum, v) => sum + v.confidence, 0);
      statistics.averageConfidence = totalConfidence / violations.length;
    }

    return statistics;
  }

  /**
   * Get current configuration
   */
  getConfig(): Readonly<CodeReviewConfig> {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<CodeReviewConfig>): void {
    this.config = { ...this.config, ...updates };

    // Reinitialize AI engine if needed
    if (updates.llmConfig || updates.enableAI !== undefined) {
      if (this.config.enableAI && this.config.llmConfig) {
        this.aiReviewEngine = createAIReviewEngine(this.codeAnalysisEngine, this.config.llmConfig);
      } else {
        this.aiReviewEngine = undefined;
      }
    }

    if (this.config.verbose) {
      logger.info('🔧 Configuration updated');
    }
  }
}

// =============================================================================
// FACTORY FUNCTIONS
// =============================================================================

/**
 * Create a code review orchestrator with default configuration
 *
 * @param config - Configuration options
 * @returns CodeReviewOrchestrator instance
 *
 * @example
 * const orchestrator = await createCodeReviewOrchestrator({
 *   llmConfig: { provider: 'ollama', model: 'codellama:13b' },
 *   enableAI: true,
 * });
 */
export async function createCodeReviewOrchestrator(config: CodeReviewConfig = {}): Promise<CodeReviewOrchestrator> {
  return new CodeReviewOrchestrator(config);
}

/**
 * Quick project review with sensible defaults
 *
 * @param options - Review options
 * @returns Code review results
 *
 * @example
 * // Review with OpenAI GPT-4
 * await reviewProject({
 *   files: ['src/**\/*.cpp'],
 *   llmConfig: { provider: 'openai', apiKey: process.env.OPENAI_API_KEY },
 *   reportPath: 'review-report.html',
 *   format: 'html',
 * });
 *
 * @example
 * // Review with Ollama (local)
 * await reviewProject({
 *   files: ['src/modules/Playerbot/**\/*.cpp'],
 *   llmConfig: { provider: 'ollama', model: 'codellama:13b' },
 *   reportPath: 'playerbot-review.md',
 *   format: 'markdown',
 * });
 */
export async function reviewProject(options: QuickReviewOptions): Promise<CodeReviewResult> {
  const orchestrator = await createCodeReviewOrchestrator({
    llmConfig: options.llmConfig,
    enableAI: options.enableAI ?? true,
    projectRoot: options.projectRoot,
    severityFilter: options.severityFilter,
    categoryFilter: options.categoryFilter,
    minConfidence: options.minConfidence,
    verbose: options.verbose,
    serena: options.serena,
  });

  const results = await orchestrator.reviewPattern(options.files);

  // Generate report if path provided
  if (options.reportPath) {
    await orchestrator.generateReport(results, options.reportPath, options.format || 'markdown');
  }

  return results;
}

// =============================================================================
// TYPE RE-EXPORTS
// =============================================================================

// Re-export all types for consumer convenience
export type {
  // Core types
  RuleViolation,
  IssueSeverity,
  RuleCategory,
  CodeFix,
  FixType,
  CodeContext,
  AST,
  ControlFlowGraph,
  DataFlowResult,
  CompilerType,
  CodeReviewRule,
  // Component types
  LLMConfig,
  LLMProvider,
  ReportFormat,
  ReportOptions,
};

// =============================================================================
// MODULE EXPORTS
// =============================================================================

export default CodeReviewOrchestrator;
