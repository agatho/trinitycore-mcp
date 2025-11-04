/**
 * Review Report Generator
 * Priority #4: Component #14 - Multi-Format Report Generation
 *
 * Generates comprehensive code review reports in multiple formats:
 * - Markdown (GitHub/GitLab compatible)
 * - HTML (standalone, self-contained)
 * - JSON (machine-readable, API integration)
 * - Console (terminal output with colors)
 *
 * Features:
 * - Statistics and summaries
 * - Severity grouping and filtering
 * - Code snippets with syntax highlighting
 * - AI insights integration
 * - Actionable recommendations
 * - CI/CD integration support
 */

import type {
  RuleViolation,
  CodeFix,
  IssueSeverity,
  RuleCategory,
} from './types.js';
import type { AIReviewResult, BatchAIReviewResult } from './AIReviewEngine.js';

// ============================================================================
// REPORT TYPES
// ============================================================================

/**
 * Report format options
 */
export type ReportFormat = 'markdown' | 'html' | 'json' | 'console';

/**
 * Report generation options
 */
export interface ReportOptions {
  format: ReportFormat;
  title?: string;
  includeStatistics?: boolean;
  includeAIInsights?: boolean;
  includeCodeSnippets?: boolean;
  includeFixes?: boolean;
  severityFilter?: IssueSeverity[];
  categoryFilter?: RuleCategory[];
  minConfidence?: number;
  outputPath?: string;
  colorEnabled?: boolean; // For console format
}

/**
 * Report statistics
 */
export interface ReportStatistics {
  totalViolations: number;
  bySeverity: {
    critical: number;
    major: number;
    minor: number;
    info: number;
  };
  byCategory: Record<RuleCategory, number>;
  filesAnalyzed: number;
  filesWithIssues: number;
  averageConfidence: number;
  aiEnhanced: number;
  fixable: number;
}

/**
 * Generated report
 */
export interface GeneratedReport {
  format: ReportFormat;
  content: string;
  statistics: ReportStatistics;
  timestamp: Date;
  metadata: {
    generator: string;
    version: string;
    duration: number;
  };
}

// ============================================================================
// REVIEW REPORT GENERATOR
// ============================================================================

export class ReviewReportGenerator {
  private readonly VERSION = '1.0.0';
  private readonly GENERATOR = 'TrinityCore AI Code Review';

  /**
   * Generate report from rule violations (without AI enhancement)
   *
   * @param violations - Array of rule violations
   * @param options - Report generation options
   * @returns Generated report
   */
  async generateReport(
    violations: RuleViolation[],
    options: ReportOptions
  ): Promise<GeneratedReport> {
    const startTime = Date.now();

    // Filter violations
    const filteredViolations = this.filterViolations(violations, options);

    // Generate statistics
    const statistics = this.generateStatistics(filteredViolations, []);

    // Generate report content based on format
    let content: string;
    switch (options.format) {
      case 'markdown':
        content = this.generateMarkdown(filteredViolations, [], statistics, options);
        break;
      case 'html':
        content = this.generateHTML(filteredViolations, [], statistics, options);
        break;
      case 'json':
        content = this.generateJSON(filteredViolations, [], statistics, options);
        break;
      case 'console':
        content = this.generateConsole(filteredViolations, [], statistics, options);
        break;
      default:
        throw new Error(`Unsupported report format: ${options.format}`);
    }

    return {
      format: options.format,
      content,
      statistics,
      timestamp: new Date(),
      metadata: {
        generator: this.GENERATOR,
        version: this.VERSION,
        duration: Date.now() - startTime,
      },
    };
  }

  /**
   * Generate report from AI-enhanced review results
   *
   * @param aiResults - Array of AI-enhanced review results
   * @param options - Report generation options
   * @returns Generated report
   */
  async generateAIReport(
    aiResults: AIReviewResult[],
    options: ReportOptions
  ): Promise<GeneratedReport> {
    const startTime = Date.now();

    // Extract violations from AI results
    const violations = aiResults.map((r) => r.originalViolation);

    // Filter violations
    const filteredViolations = this.filterViolations(violations, options);

    // Filter corresponding AI results
    const filteredAIResults = aiResults.filter((r) =>
      filteredViolations.some((v) => v.ruleId === r.originalViolation.ruleId && v.line === r.originalViolation.line)
    );

    // Generate statistics
    const statistics = this.generateStatistics(filteredViolations, filteredAIResults);

    // Generate report content based on format
    let content: string;
    switch (options.format) {
      case 'markdown':
        content = this.generateMarkdown(filteredViolations, filteredAIResults, statistics, options);
        break;
      case 'html':
        content = this.generateHTML(filteredViolations, filteredAIResults, statistics, options);
        break;
      case 'json':
        content = this.generateJSON(filteredViolations, filteredAIResults, statistics, options);
        break;
      case 'console':
        content = this.generateConsole(filteredViolations, filteredAIResults, statistics, options);
        break;
      default:
        throw new Error(`Unsupported report format: ${options.format}`);
    }

    return {
      format: options.format,
      content,
      statistics,
      timestamp: new Date(),
      metadata: {
        generator: this.GENERATOR,
        version: this.VERSION,
        duration: Date.now() - startTime,
      },
    };
  }

  /**
   * Generate report from batch AI review results
   *
   * @param batchResults - Batch AI review results
   * @param options - Report generation options
   * @returns Generated report
   */
  async generateBatchReport(
    batchResults: BatchAIReviewResult,
    options: ReportOptions
  ): Promise<GeneratedReport> {
    return this.generateAIReport(batchResults.results, options);
  }

  // ==========================================================================
  // PRIVATE METHODS - FILTERING & STATISTICS
  // ==========================================================================

  /**
   * Filter violations based on options
   */
  private filterViolations(violations: RuleViolation[], options: ReportOptions): RuleViolation[] {
    let filtered = violations;

    // Filter by severity
    if (options.severityFilter && options.severityFilter.length > 0) {
      filtered = filtered.filter((v) => options.severityFilter!.includes(v.severity));
    }

    // Filter by category
    if (options.categoryFilter && options.categoryFilter.length > 0) {
      filtered = filtered.filter((v) => options.categoryFilter!.includes(v.metadata.category));
    }

    // Filter by confidence
    if (options.minConfidence !== undefined) {
      filtered = filtered.filter((v) => v.confidence >= options.minConfidence!);
    }

    return filtered;
  }

  /**
   * Generate statistics from violations
   */
  private generateStatistics(violations: RuleViolation[], aiResults: AIReviewResult[]): ReportStatistics {
    const statistics: ReportStatistics = {
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
      filesAnalyzed: 0,
      filesWithIssues: 0,
      averageConfidence: 0,
      aiEnhanced: aiResults.length,
      fixable: 0,
    };

    // Count by severity
    for (const violation of violations) {
      statistics.bySeverity[violation.severity]++;
      statistics.byCategory[violation.metadata.category]++;
      if (violation.suggestedFix) {
        statistics.fixable++;
      }
    }

    // Calculate unique files
    const uniqueFiles = new Set(violations.map((v) => v.file));
    statistics.filesAnalyzed = uniqueFiles.size;
    statistics.filesWithIssues = uniqueFiles.size;

    // Calculate average confidence
    if (violations.length > 0) {
      const totalConfidence = violations.reduce((sum, v) => sum + v.confidence, 0);
      statistics.averageConfidence = totalConfidence / violations.length;
    }

    return statistics;
  }

  // ==========================================================================
  // PRIVATE METHODS - MARKDOWN GENERATION
  // ==========================================================================

  /**
   * Generate Markdown report
   */
  private generateMarkdown(
    violations: RuleViolation[],
    aiResults: AIReviewResult[],
    statistics: ReportStatistics,
    options: ReportOptions
  ): string {
    const title = options.title || 'Code Review Report';
    const sections: string[] = [];

    // Header
    sections.push(`# ${title}\n`);
    sections.push(`Generated: ${new Date().toISOString()}\n`);
    sections.push(`Generator: ${this.GENERATOR} v${this.VERSION}\n`);

    // Statistics
    if (options.includeStatistics !== false) {
      sections.push('\n## Summary\n');
      sections.push(`- **Total Issues**: ${statistics.totalViolations}`);
      sections.push(`- **Critical**: ${statistics.bySeverity.critical}`);
      sections.push(`- **Major**: ${statistics.bySeverity.major}`);
      sections.push(`- **Minor**: ${statistics.bySeverity.minor}`);
      sections.push(`- **Info**: ${statistics.bySeverity.info}`);
      sections.push(`- **Files Analyzed**: ${statistics.filesAnalyzed}`);
      sections.push(`- **Files with Issues**: ${statistics.filesWithIssues}`);
      sections.push(`- **Fixable Issues**: ${statistics.fixable}`);
      if (aiResults.length > 0) {
        sections.push(`- **AI Enhanced**: ${statistics.aiEnhanced}`);
      }
      sections.push(`- **Average Confidence**: ${(statistics.averageConfidence * 100).toFixed(1)}%\n`);

      // Category breakdown
      sections.push('\n### Issues by Category\n');
      for (const [category, count] of Object.entries(statistics.byCategory)) {
        if (count > 0) {
          sections.push(`- **${this.formatCategoryName(category as RuleCategory)}**: ${count}`);
        }
      }
    }

    // Group violations by severity
    sections.push('\n## Issues\n');

    const grouped = this.groupBySeverity(violations);
    const severityOrder: IssueSeverity[] = ['critical', 'major', 'minor', 'info'];

    for (const severity of severityOrder) {
      const items = grouped[severity];
      if (items.length === 0) continue;

      sections.push(`\n### ${this.formatSeverityIcon(severity)} ${this.formatSeverityName(severity)} (${items.length})\n`);

      for (const violation of items) {
        sections.push(this.formatViolationMarkdown(violation, aiResults, options));
      }
    }

    return sections.join('\n');
  }

  /**
   * Format single violation as Markdown
   */
  private formatViolationMarkdown(
    violation: RuleViolation,
    aiResults: AIReviewResult[],
    options: ReportOptions
  ): string {
    const sections: string[] = [];

    // Header
    sections.push(`#### ${violation.file}:${violation.line}`);
    sections.push(`**Rule**: \`${violation.ruleId}\` | **Category**: ${this.formatCategoryName(violation.metadata.category)} | **Confidence**: ${(violation.confidence * 100).toFixed(0)}%`);
    sections.push(`\n${violation.message}\n`);

    // Code snippet
    if (options.includeCodeSnippets !== false && violation.codeSnippet) {
      sections.push('```cpp');
      sections.push(violation.codeSnippet.before);
      sections.push('```\n');
    }

    // AI insights
    const aiResult = aiResults.find((r) => r.originalViolation.ruleId === violation.ruleId && r.originalViolation.line === violation.line);
    if (aiResult && options.includeAIInsights !== false) {
      sections.push('**AI Analysis**:');
      sections.push(aiResult.enhancedExplanation);

      if (aiResult.contextualInsights.length > 0) {
        sections.push('\n**Insights**:');
        for (const insight of aiResult.contextualInsights) {
          sections.push(`- ${insight}`);
        }
      }

      if (aiResult.bestPractices.length > 0) {
        sections.push('\n**Best Practices**:');
        for (const practice of aiResult.bestPractices) {
          sections.push(`- ${practice}`);
        }
      }
    }

    // Suggested fix
    if (options.includeFixes !== false) {
      const fix = aiResult?.improvedFix || violation.suggestedFix;
      if (fix) {
        sections.push('\n**Suggested Fix**:');
        sections.push(fix.explanation);
        if (fix.codeSnippet) {
          sections.push('\n```cpp');
          sections.push(fix.codeSnippet.after);
          sections.push('```');
        }
      }
    }

    sections.push('\n---\n');
    return sections.join('\n');
  }

  // ==========================================================================
  // PRIVATE METHODS - HTML GENERATION
  // ==========================================================================

  /**
   * Generate HTML report (self-contained)
   */
  private generateHTML(
    violations: RuleViolation[],
    aiResults: AIReviewResult[],
    statistics: ReportStatistics,
    options: ReportOptions
  ): string {
    const title = options.title || 'Code Review Report';
    const sections: string[] = [];

    // HTML header with embedded CSS
    sections.push('<!DOCTYPE html>');
    sections.push('<html lang="en">');
    sections.push('<head>');
    sections.push('  <meta charset="UTF-8">');
    sections.push('  <meta name="viewport" content="width=device-width, initial-scale=1.0">');
    sections.push(`  <title>${title}</title>`);
    sections.push('  <style>');
    sections.push(this.getHTMLStyles());
    sections.push('  </style>');
    sections.push('</head>');
    sections.push('<body>');

    // Header
    sections.push(`  <header>`);
    sections.push(`    <h1>${title}</h1>`);
    sections.push(`    <p>Generated: ${new Date().toISOString()} | ${this.GENERATOR} v${this.VERSION}</p>`);
    sections.push(`  </header>`);

    // Statistics
    if (options.includeStatistics !== false) {
      sections.push('  <section class="statistics">');
      sections.push('    <h2>Summary</h2>');
      sections.push('    <div class="stats-grid">');
      sections.push(`      <div class="stat-card"><div class="stat-value">${statistics.totalViolations}</div><div class="stat-label">Total Issues</div></div>`);
      sections.push(`      <div class="stat-card critical"><div class="stat-value">${statistics.bySeverity.critical}</div><div class="stat-label">Critical</div></div>`);
      sections.push(`      <div class="stat-card major"><div class="stat-value">${statistics.bySeverity.major}</div><div class="stat-label">Major</div></div>`);
      sections.push(`      <div class="stat-card minor"><div class="stat-value">${statistics.bySeverity.minor}</div><div class="stat-label">Minor</div></div>`);
      sections.push(`      <div class="stat-card info"><div class="stat-value">${statistics.bySeverity.info}</div><div class="stat-label">Info</div></div>`);
      sections.push(`      <div class="stat-card"><div class="stat-value">${statistics.fixable}</div><div class="stat-label">Fixable</div></div>`);
      sections.push('    </div>');
      sections.push('  </section>');
    }

    // Violations
    sections.push('  <section class="violations">');
    sections.push('    <h2>Issues</h2>');

    const grouped = this.groupBySeverity(violations);
    const severityOrder: IssueSeverity[] = ['critical', 'major', 'minor', 'info'];

    for (const severity of severityOrder) {
      const items = grouped[severity];
      if (items.length === 0) continue;

      sections.push(`    <h3 class="severity-${severity}">${this.formatSeverityName(severity)} (${items.length})</h3>`);

      for (const violation of items) {
        sections.push(this.formatViolationHTML(violation, aiResults, options));
      }
    }

    sections.push('  </section>');

    // Footer
    sections.push('  <footer>');
    sections.push(`    <p>${this.GENERATOR} v${this.VERSION}</p>`);
    sections.push('  </footer>');
    sections.push('</body>');
    sections.push('</html>');

    return sections.join('\n');
  }

  /**
   * Format single violation as HTML
   */
  private formatViolationHTML(
    violation: RuleViolation,
    aiResults: AIReviewResult[],
    options: ReportOptions
  ): string {
    const sections: string[] = [];

    sections.push(`    <div class="violation severity-${violation.severity}">`);
    sections.push(`      <div class="violation-header">`);
    sections.push(`        <span class="location">${this.escapeHTML(violation.file)}:${violation.line}</span>`);
    sections.push(`        <span class="badge">${this.escapeHTML(violation.ruleId)}</span>`);
    sections.push(`        <span class="confidence">${(violation.confidence * 100).toFixed(0)}%</span>`);
    sections.push(`      </div>`);
    sections.push(`      <div class="violation-message">${this.escapeHTML(violation.message)}</div>`);

    // Code snippet
    if (options.includeCodeSnippets !== false && violation.codeSnippet) {
      sections.push(`      <pre><code class="language-cpp">${this.escapeHTML(violation.codeSnippet.before)}</code></pre>`);
    }

    // AI insights
    const aiResult = aiResults.find((r) => r.originalViolation.ruleId === violation.ruleId && r.originalViolation.line === violation.line);
    if (aiResult && options.includeAIInsights !== false) {
      sections.push(`      <div class="ai-insights">`);
      sections.push(`        <h4>AI Analysis</h4>`);
      sections.push(`        <p>${this.escapeHTML(aiResult.enhancedExplanation)}</p>`);

      if (aiResult.contextualInsights.length > 0) {
        sections.push(`        <h5>Insights</h5><ul>`);
        for (const insight of aiResult.contextualInsights) {
          sections.push(`          <li>${this.escapeHTML(insight)}</li>`);
        }
        sections.push(`        </ul>`);
      }
    }

    // Suggested fix
    if (options.includeFixes !== false) {
      const fix = aiResult?.improvedFix || violation.suggestedFix;
      if (fix) {
        sections.push(`      <div class="suggested-fix">`);
        sections.push(`        <h4>Suggested Fix</h4>`);
        sections.push(`        <p>${this.escapeHTML(fix.explanation)}</p>`);
        if (fix.codeSnippet) {
          sections.push(`        <pre><code class="language-cpp">${this.escapeHTML(fix.codeSnippet.after)}</code></pre>`);
        }
        sections.push(`      </div>`);
      }
    }

    sections.push(`    </div>`);

    return sections.join('\n');
  }

  /**
   * Get embedded HTML styles
   */
  private getHTMLStyles(): string {
    return `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; line-height: 1.6; color: #333; background: #f5f5f5; }
    header { background: #2c3e50; color: white; padding: 2rem; text-align: center; }
    header h1 { margin-bottom: 0.5rem; }
    header p { opacity: 0.9; font-size: 0.9rem; }
    section { max-width: 1200px; margin: 2rem auto; padding: 2rem; background: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    h2 { margin-bottom: 1.5rem; color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 0.5rem; }
    h3 { margin: 1.5rem 0 1rem; }
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; }
    .stat-card { padding: 1.5rem; background: #ecf0f1; border-radius: 8px; text-align: center; }
    .stat-card.critical { background: #fee; border-left: 4px solid #e74c3c; }
    .stat-card.major { background: #ffe; border-left: 4px solid #f39c12; }
    .stat-card.minor { background: #eff; border-left: 4px solid #3498db; }
    .stat-card.info { background: #efe; border-left: 4px solid #2ecc71; }
    .stat-value { font-size: 2rem; font-weight: bold; color: #2c3e50; }
    .stat-label { margin-top: 0.5rem; font-size: 0.9rem; color: #7f8c8d; }
    .violation { margin-bottom: 1.5rem; padding: 1rem; border-left: 4px solid #95a5a6; background: #fafafa; border-radius: 4px; }
    .violation.severity-critical { border-color: #e74c3c; }
    .violation.severity-major { border-color: #f39c12; }
    .violation.severity-minor { border-color: #3498db; }
    .violation.severity-info { border-color: #2ecc71; }
    .violation-header { display: flex; gap: 1rem; align-items: center; margin-bottom: 0.75rem; flex-wrap: wrap; }
    .location { font-family: monospace; font-weight: bold; color: #2c3e50; }
    .badge { padding: 0.25rem 0.75rem; background: #3498db; color: white; border-radius: 12px; font-size: 0.85rem; }
    .confidence { padding: 0.25rem 0.75rem; background: #2ecc71; color: white; border-radius: 4px; font-size: 0.85rem; }
    .violation-message { margin-bottom: 1rem; color: #555; }
    pre { background: #2c3e50; color: #ecf0f1; padding: 1rem; border-radius: 4px; overflow-x: auto; }
    code { font-family: "Monaco", "Courier New", monospace; font-size: 0.9rem; }
    .ai-insights { margin-top: 1rem; padding: 1rem; background: #e8f4f8; border-radius: 4px; }
    .ai-insights h4 { color: #2980b9; margin-bottom: 0.5rem; }
    .ai-insights ul { margin: 0.5rem 0 0 1.5rem; }
    .suggested-fix { margin-top: 1rem; padding: 1rem; background: #e8f8f5; border-radius: 4px; }
    .suggested-fix h4 { color: #27ae60; margin-bottom: 0.5rem; }
    footer { text-align: center; padding: 2rem; color: #7f8c8d; font-size: 0.9rem; }
    `;
  }

  // ==========================================================================
  // PRIVATE METHODS - JSON GENERATION
  // ==========================================================================

  /**
   * Generate JSON report
   */
  private generateJSON(
    violations: RuleViolation[],
    aiResults: AIReviewResult[],
    statistics: ReportStatistics,
    options: ReportOptions
  ): string {
    const report = {
      generator: this.GENERATOR,
      version: this.VERSION,
      timestamp: new Date().toISOString(),
      statistics,
      violations: violations.map((v) => {
        const aiResult = aiResults.find((r) => r.originalViolation.ruleId === v.ruleId && r.originalViolation.line === v.line);
        return {
          ...v,
          aiEnhanced: aiResult
            ? {
                enhancedExplanation: aiResult.enhancedExplanation,
                contextualInsights: aiResult.contextualInsights,
                bestPractices: aiResult.bestPractices,
                relatedIssues: aiResult.relatedIssues,
                confidenceScore: aiResult.confidenceScore,
                improvedFix: aiResult.improvedFix,
              }
            : undefined,
        };
      }),
    };

    return JSON.stringify(report, null, 2);
  }

  // ==========================================================================
  // PRIVATE METHODS - CONSOLE GENERATION
  // ==========================================================================

  /**
   * Generate console report (terminal output)
   */
  private generateConsole(
    violations: RuleViolation[],
    aiResults: AIReviewResult[],
    statistics: ReportStatistics,
    options: ReportOptions
  ): string {
    const sections: string[] = [];
    const colors = options.colorEnabled !== false;

    // Header
    sections.push(this.colorize('\n=== CODE REVIEW REPORT ===\n', 'bold', colors));

    // Statistics
    if (options.includeStatistics !== false) {
      sections.push('Summary:');
      sections.push(`  Total Issues: ${this.colorize(statistics.totalViolations.toString(), 'bold', colors)}`);
      sections.push(`  Critical: ${this.colorize(statistics.bySeverity.critical.toString(), 'red', colors)}`);
      sections.push(`  Major: ${this.colorize(statistics.bySeverity.major.toString(), 'yellow', colors)}`);
      sections.push(`  Minor: ${this.colorize(statistics.bySeverity.minor.toString(), 'blue', colors)}`);
      sections.push(`  Info: ${this.colorize(statistics.bySeverity.info.toString(), 'green', colors)}`);
      sections.push(`  Fixable: ${statistics.fixable}`);
      sections.push('');
    }

    // Violations
    const grouped = this.groupBySeverity(violations);
    const severityOrder: IssueSeverity[] = ['critical', 'major', 'minor', 'info'];

    for (const severity of severityOrder) {
      const items = grouped[severity];
      if (items.length === 0) continue;

      sections.push(this.colorize(`\n${this.formatSeverityName(severity).toUpperCase()} (${items.length}):`, this.getSeverityColor(severity), colors));

      for (const violation of items) {
        sections.push(this.formatViolationConsole(violation, aiResults, options, colors));
      }
    }

    return sections.join('\n');
  }

  /**
   * Format single violation for console
   */
  private formatViolationConsole(
    violation: RuleViolation,
    aiResults: AIReviewResult[],
    options: ReportOptions,
    colors: boolean
  ): string {
    const sections: string[] = [];

    sections.push(`\n  ${violation.file}:${violation.line}`);
    sections.push(`  ${this.colorize(violation.ruleId, 'cyan', colors)} | ${violation.message}`);

    if (options.includeCodeSnippets !== false && violation.codeSnippet) {
      sections.push(`  ${this.colorize('>', 'gray', colors)} ${violation.codeSnippet.before}`);
    }

    return sections.join('\n');
  }

  // ==========================================================================
  // PRIVATE METHODS - UTILITIES
  // ==========================================================================

  /**
   * Group violations by severity
   */
  private groupBySeverity(violations: RuleViolation[]): Record<IssueSeverity, RuleViolation[]> {
    return {
      critical: violations.filter((v) => v.severity === 'critical'),
      major: violations.filter((v) => v.severity === 'major'),
      minor: violations.filter((v) => v.severity === 'minor'),
      info: violations.filter((v) => v.severity === 'info'),
    };
  }

  /**
   * Format severity name
   */
  private formatSeverityName(severity: IssueSeverity): string {
    return severity.charAt(0).toUpperCase() + severity.slice(1);
  }

  /**
   * Format severity icon (emoji)
   */
  private formatSeverityIcon(severity: IssueSeverity): string {
    const icons: Record<IssueSeverity, string> = {
      critical: '🔴',
      major: '🟠',
      minor: '🔵',
      info: '🟢',
    };
    return icons[severity];
  }

  /**
   * Format category name
   */
  private formatCategoryName(category: RuleCategory): string {
    return category
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Get severity color for console output
   */
  private getSeverityColor(severity: IssueSeverity): 'red' | 'yellow' | 'blue' | 'green' {
    const colors: Record<IssueSeverity, 'red' | 'yellow' | 'blue' | 'green'> = {
      critical: 'red',
      major: 'yellow',
      minor: 'blue',
      info: 'green',
    };
    return colors[severity];
  }

  /**
   * Colorize text for terminal (ANSI codes)
   */
  private colorize(text: string, color: 'red' | 'yellow' | 'blue' | 'green' | 'cyan' | 'gray' | 'bold', enabled: boolean): string {
    if (!enabled) return text;

    const codes: Record<string, string> = {
      red: '\x1b[31m',
      yellow: '\x1b[33m',
      blue: '\x1b[34m',
      green: '\x1b[32m',
      cyan: '\x1b[36m',
      gray: '\x1b[90m',
      bold: '\x1b[1m',
      reset: '\x1b[0m',
    };

    return `${codes[color]}${text}${codes.reset}`;
  }

  /**
   * Escape HTML special characters
   */
  private escapeHTML(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return text.replace(/[&<>"']/g, (char) => map[char]);
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create ReviewReportGenerator
 *
 * @returns Configured ReviewReportGenerator
 */
export function createReviewReportGenerator(): ReviewReportGenerator {
  return new ReviewReportGenerator();
}

export default ReviewReportGenerator;
