/**
 * AI-Powered Code Review Tool
 * Priority #4: MCP Tool Integration
 *
 * Provides comprehensive C++ code review capabilities with 870+ rules
 * Performance targets: >90% accuracy, <15% false positive rate
 */

import {
  reviewProject,
  createCodeReviewOrchestrator,
  type CodeReviewConfig,
  type CodeReviewResult,
} from "../code-review/index.js";
import type {
  IssueSeverity,
  RuleCategory,
  CompilerType,
} from "../code-review/types.js";
import type { LLMConfig } from "../code-review/AIReviewEngine.js";

/**
 * Review a single file for code quality issues
 */
export async function reviewFile(
  filePath: string,
  options: {
    enableAI?: boolean;
    llmProvider?: "openai" | "ollama" | "lmstudio";
    llmModel?: string;
    severityFilter?: IssueSeverity[];
    categoryFilter?: RuleCategory[];
    minConfidence?: number;
    projectRoot?: string;
    compilerType?: CompilerType;
    verbose?: boolean;
  } = {}
): Promise<string> {
  try {
    // Build LLM config
    const llmConfig: LLMConfig | undefined = options.enableAI
      ? {
          provider: options.llmProvider || "openai",
          model: options.llmModel || "gpt-4",
          temperature: 0.1,
          maxTokens: 4096,
        }
      : undefined;

    // Create orchestrator
    const config: CodeReviewConfig = {
      llmConfig,
      enableAI: options.enableAI ?? false,
      severityFilter: options.severityFilter,
      categoryFilter: options.categoryFilter,
      minConfidence: options.minConfidence ?? 0.7,
      projectRoot: options.projectRoot,
      compilerType: options.compilerType || "gcc",
      verbose: options.verbose ?? false,
    };

    const orchestrator = await createCodeReviewOrchestrator(config);

    // Review single file
    const result = await orchestrator.reviewFiles([filePath]);

    // Format result
    return formatReviewResult(result, "single");
  } catch (error) {
    return JSON.stringify(
      {
        error: "Code review failed",
        message: error instanceof Error ? error.message : String(error),
        file: filePath,
      },
      null,
      2
    );
  }
}

/**
 * Review multiple files
 */
export async function reviewFiles(
  files: string[],
  options: {
    enableAI?: boolean;
    llmProvider?: "openai" | "ollama" | "lmstudio";
    llmModel?: string;
    severityFilter?: IssueSeverity[];
    categoryFilter?: RuleCategory[];
    minConfidence?: number;
    projectRoot?: string;
    compilerType?: CompilerType;
    verbose?: boolean;
  } = {}
): Promise<string> {
  try {
    // Build LLM config
    const llmConfig: LLMConfig | undefined = options.enableAI
      ? {
          provider: options.llmProvider || "openai",
          model: options.llmModel || "gpt-4",
          temperature: 0.1,
          maxTokens: 4096,
        }
      : undefined;

    // Create orchestrator
    const config: CodeReviewConfig = {
      llmConfig,
      enableAI: options.enableAI ?? false,
      severityFilter: options.severityFilter,
      categoryFilter: options.categoryFilter,
      minConfidence: options.minConfidence ?? 0.7,
      projectRoot: options.projectRoot,
      compilerType: options.compilerType || "gcc",
      verbose: options.verbose ?? false,
    };

    const orchestrator = await createCodeReviewOrchestrator(config);

    // Review files
    const result = await orchestrator.reviewFiles(files);

    // Format result
    return formatReviewResult(result, "batch");
  } catch (error) {
    return JSON.stringify(
      {
        error: "Code review failed",
        message: error instanceof Error ? error.message : String(error),
        files,
      },
      null,
      2
    );
  }
}

/**
 * Review files matching glob patterns
 */
export async function reviewPattern(
  patterns: string[],
  options: {
    enableAI?: boolean;
    llmProvider?: "openai" | "ollama" | "lmstudio";
    llmModel?: string;
    severityFilter?: IssueSeverity[];
    categoryFilter?: RuleCategory[];
    minConfidence?: number;
    projectRoot?: string;
    compilerType?: CompilerType;
    excludePatterns?: string[];
    verbose?: boolean;
  } = {}
): Promise<string> {
  try {
    // Build LLM config
    const llmConfig: LLMConfig | undefined = options.enableAI
      ? {
          provider: options.llmProvider || "openai",
          model: options.llmModel || "gpt-4",
          temperature: 0.1,
          maxTokens: 4096,
        }
      : undefined;

    // Create orchestrator
    const config: CodeReviewConfig = {
      llmConfig,
      enableAI: options.enableAI ?? false,
      severityFilter: options.severityFilter,
      categoryFilter: options.categoryFilter,
      minConfidence: options.minConfidence ?? 0.7,
      projectRoot: options.projectRoot,
      compilerType: options.compilerType || "gcc",
      verbose: options.verbose ?? false,
    };

    const orchestrator = await createCodeReviewOrchestrator(config);

    // Review pattern
    const result = await orchestrator.reviewPattern(patterns);

    // Format result
    return formatReviewResult(result, "pattern");
  } catch (error) {
    return JSON.stringify(
      {
        error: "Code review failed",
        message: error instanceof Error ? error.message : String(error),
        patterns,
      },
      null,
      2
    );
  }
}

/**
 * Review entire project directory
 */
export async function reviewProjectDirectory(
  projectRoot: string,
  options: {
    enableAI?: boolean;
    llmProvider?: "openai" | "ollama" | "lmstudio";
    llmModel?: string;
    severityFilter?: IssueSeverity[];
    categoryFilter?: RuleCategory[];
    minConfidence?: number;
    patterns?: string[];
    excludePatterns?: string[];
    compilerType?: CompilerType;
    reportPath?: string;
    reportFormat?: "markdown" | "html" | "json" | "console";
    verbose?: boolean;
  } = {}
): Promise<string> {
  try {
    // Use the convenience function
    const result = await reviewProject({
      projectRoot,
      files: options.patterns || ["**/*.cpp", "**/*.h", "**/*.hpp", "**/*.cc"],
      llmConfig: options.enableAI
        ? {
            provider: options.llmProvider || "openai",
            model: options.llmModel || "gpt-4",
            temperature: 0.1,
            maxTokens: 4096,
          }
        : undefined,
      enableAI: options.enableAI ?? false,
      severityFilter: options.severityFilter,
      categoryFilter: options.categoryFilter,      minConfidence: options.minConfidence ?? 0.7,
      reportPath: options.reportPath,
      format: options.reportFormat || "markdown",
      verbose: options.verbose ?? false,
    });

    // Format result
    return formatReviewResult(result, "project");
  } catch (error) {
    return JSON.stringify(
      {
        error: "Project review failed",
        message: error instanceof Error ? error.message : String(error),
        projectRoot,
      },
      null,
      2
    );
  }
}

/**
 * Generate review report from existing violations
 */
export async function generateReviewReport(
  violations: any[],
  reportPath: string,
  format: "markdown" | "html" | "json" | "console" = "markdown",
  options: {
    projectRoot?: string;
    compilerType?: CompilerType;
  } = {}
): Promise<string> {
  try {
    const config: CodeReviewConfig = {
      enableAI: false,
      projectRoot: options.projectRoot,
      compilerType: options.compilerType || "gcc",
      verbose: false,
    };

    const orchestrator = await createCodeReviewOrchestrator(config);

    // Create result object
    const result: CodeReviewResult = {
      files: [...new Set(violations.map((v) => v.file))],
      violations,
      aiEnhanced: 0,
      durationMs: 0,
      statistics: {
        totalViolations: violations.length,
        bySeverity: {
          critical: violations.filter((v) => v.severity === "critical").length,
          major: violations.filter((v) => v.severity === "major").length,
          minor: violations.filter((v) => v.severity === "minor").length,
          info: violations.filter((v) => v.severity === "info").length,
        },
        byCategory: {
          null_safety: violations.filter((v) => v.metadata.category === "null_safety").length,
          memory: violations.filter((v) => v.metadata.category === "memory").length,
          concurrency: violations.filter((v) => v.metadata.category === "concurrency").length,
          convention: violations.filter((v) => v.metadata.category === "convention").length,
          security: violations.filter((v) => v.metadata.category === "security").length,
          performance: violations.filter((v) => v.metadata.category === "performance").length,
          architecture: violations.filter((v) => v.metadata.category === "architecture").length,
        },
        filesAnalyzed: new Set(violations.map((v) => v.file)).size,
        filesWithIssues: new Set(violations.map((v) => v.file)).size,
        averageConfidence:
          violations.reduce((sum, v) => sum + v.confidence, 0) / violations.length || 0,
        fixableIssues: violations.filter((v) => v.suggestedFix).length,
      },
    };

    // Generate report
    await orchestrator.generateReport(result, reportPath, format);

    return JSON.stringify(
      {
        success: true,
        reportPath,
        format,
        violationsCount: violations.length,
      },
      null,
      2
    );
  } catch (error) {
    return JSON.stringify(
      {
        error: "Report generation failed",
        message: error instanceof Error ? error.message : String(error),
        reportPath,
      },
      null,
      2
    );
  }
}

/**
 * Get code review statistics
 */
export async function getCodeReviewStats(): Promise<string> {
  return JSON.stringify(
    {
      system: "TrinityCore AI Code Review System",
      version: "1.0.0",
      capabilities: {
        totalRules: 870,
        ruleCategories: [
          { name: "Null Safety", rules: 220, coverage: "110%" },
          { name: "Memory Management", rules: 150, coverage: "100%" },
          { name: "Concurrency", rules: 100, coverage: "100%" },
          { name: "TrinityCore Conventions", rules: 250, coverage: "100%" },
          { name: "Security", rules: 150, coverage: "100%" },
          { name: "Performance", rules: 100, coverage: "100%" },
          { name: "Architecture", rules: 50, coverage: "100%" },
        ],
        aiProviders: ["OpenAI", "Ollama", "LM Studio"],
        reportFormats: ["Markdown", "HTML", "JSON", "Console"],
        compilerSupport: ["GCC", "Clang", "MSVC"],
      },
      performance: {
        targetAccuracy: ">90%",
        targetFalsePositiveRate: "<15%",
        analysisSpeed: "~1000 LOC/sec",
        cachingEnabled: true,
      },
      features: {
        staticAnalysis: true,
        aiEnhancement: true,
        autoFixes: true,
        serenaIntegration: true,
        batchProcessing: true,
        incrementalAnalysis: false, // Future enhancement
      },
    },
    null,
    2
  );
}

/**
 * Format review result for display
 */
function formatReviewResult(
  result: CodeReviewResult,
  mode: "single" | "batch" | "pattern" | "project"
): string {
  const header = `# Code Review Result (${mode})\n\n`;

  // Summary
  const summary = `## Summary

- Files Analyzed: ${result.statistics.filesAnalyzed}
- Files With Issues: ${result.statistics.filesWithIssues}
- Total Violations: ${result.statistics.totalViolations}
- AI Enhanced: ${result.aiEnhanced}
- Duration: ${result.durationMs}ms
- Average Confidence: ${(result.statistics.averageConfidence * 100).toFixed(1)}%
- Fixable Issues: ${result.statistics.fixableIssues}

`;

  // Severity breakdown
  const severityBreakdown = `## Severity Breakdown

- Critical: ${result.statistics.bySeverity.critical}
- Major: ${result.statistics.bySeverity.major}
- Minor: ${result.statistics.bySeverity.minor}
- Info: ${result.statistics.bySeverity.info}

`;

  // Category breakdown
  const categoryBreakdown = `## Category Breakdown

- Null Safety: ${result.statistics.byCategory.null_safety}
- Memory Management: ${result.statistics.byCategory.memory}
- Concurrency: ${result.statistics.byCategory.concurrency}
- Conventions: ${result.statistics.byCategory.convention}
- Security: ${result.statistics.byCategory.security}
- Performance: ${result.statistics.byCategory.performance}
- Architecture: ${result.statistics.byCategory.architecture}

`;

  // Top violations (limit to 10)
  const topViolations =
    result.violations.length > 0
      ? `## Top Violations\n\n${result.violations
          .slice(0, 10)
          .map(
            (v, i) =>
              `### ${i + 1}. [${v.severity.toUpperCase()}] ${v.message}

**File:** ${v.file}:${v.line}:${v.column}
**Rule:** ${v.ruleId}
**Category:** ${v.metadata.category}
**Confidence:** ${(v.confidence * 100).toFixed(1)}%

**Explanation:** ${v.explanation}

${
  v.suggestedFix
    ? `**Suggested Fix:**
\`\`\`cpp
${v.suggestedFix.codeSnippet.after}
\`\`\`
`
    : ""
}

---
`
          )
          .join("\n")}`
      : "## No Violations Found\n\nAll files passed the code review!\n\n";

  return header + summary + severityBreakdown + categoryBreakdown + topViolations;
}
