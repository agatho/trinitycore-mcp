/**
 * CoverageAnalyzer
 * Phase 5 - Week 5: Testing Automation Tools
 *
 * Analyzes code coverage to identify untested code paths.
 * Simplified implementation focusing on line coverage tracking.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { glob } from 'glob';

// ============================================================================
// Type Definitions
// ============================================================================

export interface CoverageOptions {
  include?: string[];         // Files to include (glob patterns)
  exclude?: string[];         // Files to exclude (glob patterns)

  // Coverage types
  lines?: boolean;            // Track line coverage (default: true)
  branches?: boolean;         // Track branch coverage (default: false - simplified)
  functions?: boolean;        // Track function coverage (default: false - simplified)
  statements?: boolean;       // Track statement coverage (default: false - simplified)

  // Thresholds
  thresholds?: {
    lines?: number;           // Min line coverage % (default: 80)
    branches?: number;        // Min branch coverage % (default: 80)
    functions?: number;       // Min function coverage % (default: 80)
    statements?: number;      // Min statement coverage % (default: 80)
  };

  // Output
  outputDirectory?: string;   // Coverage output dir (default: "./coverage")
  reporters?: ('json' | 'html' | 'text' | 'lcov')[];
}

export interface FileCoverage {
  filePath: string;

  lines: {
    total: number;
    covered: number;
    uncovered: number[];      // Line numbers
    percentage: number;
  };

  branches: {
    total: number;
    covered: number;
    uncovered: Array<{
      line: number;
      branch: number;
    }>;
    percentage: number;
  };

  functions: {
    total: number;
    covered: number;
    uncovered: string[];      // Function names
    percentage: number;
  };

  statements: {
    total: number;
    covered: number;
    percentage: number;
  };
}

export interface CoverageReport {
  timestamp: Date;

  summary: {
    lines: { total: number; covered: number; percentage: number; };
    branches: { total: number; covered: number; percentage: number; };
    functions: { total: number; covered: number; percentage: number; };
    statements: { total: number; covered: number; percentage: number; };
  };

  files: FileCoverage[];

  thresholds?: {
    met: boolean;
    lines: { threshold: number; actual: number; met: boolean; };
    branches: { threshold: number; actual: number; met: boolean; };
    functions: { threshold: number; actual: number; met: boolean; };
    statements: { threshold: number; actual: number; met: boolean; };
  };
}

// ============================================================================
// CoverageAnalyzer Class
// ============================================================================

export class CoverageAnalyzer {
  private executedLines: Map<string, Set<number>> = new Map();

  constructor() {}

  /**
   * Collect coverage data
   * Performance target: <2000ms for 50 test files
   *
   * NOTE: This is a simplified implementation. For production use,
   * consider integrating with c8/nyc for V8 coverage or istanbul for instrumentation.
   */
  async collectCoverage(options: CoverageOptions = {}): Promise<CoverageReport> {
    const start = performance.now();

    const include = options.include || ['src/**/*.ts', 'src/**/*.js'];
    const exclude = options.exclude || ['**/node_modules/**', '**/dist/**', '**/*.test.ts', '**/*.test.js'];

    // Find all source files
    const sourceFiles: string[] = [];
    for (const pattern of include) {
      const files = await glob(pattern, {
        ignore: exclude,
        absolute: true
      });
      sourceFiles.push(...files);
    }

    // Analyze each file
    const files: FileCoverage[] = [];
    for (const filePath of sourceFiles) {
      const fileCoverage = await this.analyzeFile(filePath);
      files.push(fileCoverage);
    }

    // Calculate summary
    const summary = {
      lines: {
        total: files.reduce((sum, f) => sum + f.lines.total, 0),
        covered: files.reduce((sum, f) => sum + f.lines.covered, 0),
        percentage: 0
      },
      branches: {
        total: files.reduce((sum, f) => sum + f.branches.total, 0),
        covered: files.reduce((sum, f) => sum + f.branches.covered, 0),
        percentage: 0
      },
      functions: {
        total: files.reduce((sum, f) => sum + f.functions.total, 0),
        covered: files.reduce((sum, f) => sum + f.functions.covered, 0),
        percentage: 0
      },
      statements: {
        total: files.reduce((sum, f) => sum + f.statements.total, 0),
        covered: files.reduce((sum, f) => sum + f.statements.covered, 0),
        percentage: 0
      }
    };

    summary.lines.percentage = this.calculatePercentage(summary.lines.covered, summary.lines.total);
    summary.branches.percentage = this.calculatePercentage(summary.branches.covered, summary.branches.total);
    summary.functions.percentage = this.calculatePercentage(summary.functions.covered, summary.functions.total);
    summary.statements.percentage = this.calculatePercentage(summary.statements.covered, summary.statements.total);

    // Validate thresholds
    const thresholds = options.thresholds ? {
      met: true,
      lines: {
        threshold: options.thresholds.lines || 80,
        actual: summary.lines.percentage,
        met: summary.lines.percentage >= (options.thresholds.lines || 80)
      },
      branches: {
        threshold: options.thresholds.branches || 80,
        actual: summary.branches.percentage,
        met: summary.branches.percentage >= (options.thresholds.branches || 80)
      },
      functions: {
        threshold: options.thresholds.functions || 80,
        actual: summary.functions.percentage,
        met: summary.functions.percentage >= (options.thresholds.functions || 80)
      },
      statements: {
        threshold: options.thresholds.statements || 80,
        actual: summary.statements.percentage,
        met: summary.statements.percentage >= (options.thresholds.statements || 80)
      }
    } : undefined;

    if (thresholds) {
      thresholds.met = thresholds.lines.met && thresholds.branches.met &&
                       thresholds.functions.met && thresholds.statements.met;
    }

    return {
      timestamp: new Date(),
      summary,
      files,
      thresholds
    };
  }

  /**
   * Analyze a single file for coverage
   * Performance target: <10ms per file
   */
  async analyzeFile(filePath: string): Promise<FileCoverage> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n');

      // Count executable lines (simplified: non-empty, non-comment lines)
      const executableLines = lines
        .map((line, index) => ({ line: line.trim(), number: index + 1 }))
        .filter(({ line }) => {
          // Skip empty lines, comments, and braces
          if (!line) return false;
          if (line.startsWith('//')) return false;
          if (line.startsWith('/*')) return false;
          if (line.startsWith('*')) return false;
          if (line === '{' || line === '}') return false;
          if (line.startsWith('import ') || line.startsWith('export ')) return false;
          return true;
        });

      const totalLines = executableLines.length;
      const executedSet = this.executedLines.get(filePath) || new Set<number>();
      const coveredLines = executableLines.filter(({ number }) => executedSet.has(number)).length;
      const uncoveredLines = executableLines
        .filter(({ number }) => !executedSet.has(number))
        .map(({ number }) => number);

      // Simplified: For branches/functions/statements, use same as lines
      // In production, use proper AST parsing
      const fileCoverage: FileCoverage = {
        filePath,
        lines: {
          total: totalLines,
          covered: coveredLines,
          uncovered: uncoveredLines,
          percentage: this.calculatePercentage(coveredLines, totalLines)
        },
        branches: {
          total: 0,
          covered: 0,
          uncovered: [],
          percentage: 0
        },
        functions: {
          total: 0,
          covered: 0,
          uncovered: [],
          percentage: 0
        },
        statements: {
          total: totalLines,
          covered: coveredLines,
          percentage: this.calculatePercentage(coveredLines, totalLines)
        }
      };

      return fileCoverage;
    } catch (error) {
      // Return empty coverage for inaccessible files
      return {
        filePath,
        lines: { total: 0, covered: 0, uncovered: [], percentage: 0 },
        branches: { total: 0, covered: 0, uncovered: [], percentage: 0 },
        functions: { total: 0, covered: 0, uncovered: [], percentage: 0 },
        statements: { total: 0, covered: 0, percentage: 0 }
      };
    }
  }

  /**
   * Record executed line (for instrumentation)
   */
  recordLine(filePath: string, lineNumber: number): void {
    if (!this.executedLines.has(filePath)) {
      this.executedLines.set(filePath, new Set());
    }
    this.executedLines.get(filePath)!.add(lineNumber);
  }

  /**
   * Calculate coverage percentage
   */
  private calculatePercentage(covered: number, total: number): number {
    if (total === 0) return 0;
    return (covered / total) * 100;
  }

  /**
   * Generate coverage report in specified format
   * Performance target: <500ms for HTML, <100ms for JSON/text
   */
  async generateCoverageReport(
    coverage: CoverageReport,
    format: 'json' | 'html' | 'text' | 'lcov',
    outputPath: string
  ): Promise<string> {
    let content: string;

    switch (format) {
      case 'json':
        content = this.generateJSON(coverage);
        break;
      case 'html':
        content = this.generateHTML(coverage);
        break;
      case 'text':
        content = this.generateText(coverage);
        break;
      case 'lcov':
        content = this.generateLCOV(coverage);
        break;
      default:
        throw new Error(`Unsupported format: ${format}`);
    }

    // Write to file
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, content, 'utf-8');

    return outputPath;
  }

  /**
   * Generate JSON coverage report
   */
  private generateJSON(coverage: CoverageReport): string {
    return JSON.stringify(coverage, null, 2);
  }

  /**
   * Generate text coverage report
   */
  private generateText(coverage: CoverageReport): string {
    const { summary, files } = coverage;

    let text = '================== Coverage Summary ==================\n';
    text += `Lines:      ${summary.lines.percentage.toFixed(1)}% ( ${summary.lines.covered} / ${summary.lines.total} )\n`;
    text += `Branches:   ${summary.branches.percentage.toFixed(1)}% ( ${summary.branches.covered} / ${summary.branches.total} )\n`;
    text += `Functions:  ${summary.functions.percentage.toFixed(1)}% ( ${summary.functions.covered} / ${summary.functions.total} )\n`;
    text += `Statements: ${summary.statements.percentage.toFixed(1)}% ( ${summary.statements.covered} / ${summary.statements.total} )\n`;
    text += '\n';

    if (coverage.thresholds) {
      text += '================== Threshold Validation ==============\n';
      text += `Overall: ${coverage.thresholds.met ? 'PASS ✓' : 'FAIL ✗'}\n`;
      text += `Lines:      ${coverage.thresholds.lines.met ? 'PASS ✓' : 'FAIL ✗'} (${coverage.thresholds.lines.actual.toFixed(1)}% >= ${coverage.thresholds.lines.threshold}%)\n`;
      text += `Branches:   ${coverage.thresholds.branches.met ? 'PASS ✓' : 'FAIL ✗'} (${coverage.thresholds.branches.actual.toFixed(1)}% >= ${coverage.thresholds.branches.threshold}%)\n`;
      text += `Functions:  ${coverage.thresholds.functions.met ? 'PASS ✓' : 'FAIL ✗'} (${coverage.thresholds.functions.actual.toFixed(1)}% >= ${coverage.thresholds.functions.threshold}%)\n`;
      text += `Statements: ${coverage.thresholds.statements.met ? 'PASS ✓' : 'FAIL ✗'} (${coverage.thresholds.statements.actual.toFixed(1)}% >= ${coverage.thresholds.statements.threshold}%)\n`;
      text += '\n';
    }

    text += '================== File Coverage =====================\n';
    text += 'File'.padEnd(60) + 'Lines'.padEnd(10) + 'Branches'.padEnd(10) + 'Functions\n';
    text += '-'.repeat(80) + '\n';

    for (const file of files) {
      const fileName = path.basename(file.filePath);
      text += fileName.padEnd(60);
      text += `${file.lines.percentage.toFixed(1)}%`.padEnd(10);
      text += `${file.branches.percentage.toFixed(1)}%`.padEnd(10);
      text += `${file.functions.percentage.toFixed(1)}%\n`;
    }
    text += '\n';

    // Show uncovered lines
    const filesWithUncovered = files.filter(f => f.lines.uncovered.length > 0);
    if (filesWithUncovered.length > 0) {
      text += '================== Uncovered Lines ===================\n';
      for (const file of filesWithUncovered) {
        text += `${path.basename(file.filePath)}:\n`;
        text += `  Lines: ${file.lines.uncovered.join(', ')}\n`;
      }
    }

    return text;
  }

  /**
   * Generate HTML coverage report
   */
  private generateHTML(coverage: CoverageReport): string {
    const { summary, files } = coverage;

    const filesHTML = files.map(file => {
      const fileName = path.basename(file.filePath);
      const lineColor = this.getColorClass(file.lines.percentage);
      const uncoveredLines = file.lines.uncovered.length > 0
        ? file.lines.uncovered.slice(0, 10).join(', ') + (file.lines.uncovered.length > 10 ? '...' : '')
        : '-';

      return `
        <tr class="${lineColor}">
          <td>${fileName}</td>
          <td>${file.lines.percentage.toFixed(1)}%</td>
          <td>${file.lines.covered} / ${file.lines.total}</td>
          <td>${uncoveredLines}</td>
        </tr>
      `;
    }).join('');

    const thresholdsHTML = coverage.thresholds ? `
      <h2>Threshold Validation</h2>
      <div class="thresholds ${coverage.thresholds.met ? 'pass' : 'fail'}">
        <p><strong>Overall:</strong> ${coverage.thresholds.met ? 'PASS ✓' : 'FAIL ✗'}</p>
        <ul>
          <li>Lines: ${coverage.thresholds.lines.met ? '✓' : '✗'} ${coverage.thresholds.lines.actual.toFixed(1)}% (threshold: ${coverage.thresholds.lines.threshold}%)</li>
          <li>Branches: ${coverage.thresholds.branches.met ? '✓' : '✗'} ${coverage.thresholds.branches.actual.toFixed(1)}% (threshold: ${coverage.thresholds.branches.threshold}%)</li>
          <li>Functions: ${coverage.thresholds.functions.met ? '✓' : '✗'} ${coverage.thresholds.functions.actual.toFixed(1)}% (threshold: ${coverage.thresholds.functions.threshold}%)</li>
          <li>Statements: ${coverage.thresholds.statements.met ? '✓' : '✗'} ${coverage.thresholds.statements.actual.toFixed(1)}% (threshold: ${coverage.thresholds.statements.threshold}%)</li>
        </ul>
      </div>
    ` : '';

    return `<!DOCTYPE html>
<html>
<head>
  <title>Coverage Report</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; padding: 20px; background: #f5f5f5; }
    .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; }
    h1 { color: #333; margin-bottom: 20px; }
    h2 { color: #666; margin: 20px 0 10px; }
    .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 30px; }
    .metric { padding: 15px; background: #f8f9fa; border-radius: 6px; border-left: 4px solid #007bff; }
    .metric .label { font-size: 12px; color: #666; margin-bottom: 5px; }
    .metric .value { font-size: 24px; font-weight: bold; color: #333; }
    .thresholds { padding: 15px; background: #f8f9fa; border-radius: 6px; margin-bottom: 20px; }
    .thresholds.pass { border-left: 4px solid #28a745; }
    .thresholds.fail { border-left: 4px solid #dc3545; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    th { background: #f8f9fa; padding: 12px; text-align: left; font-weight: 600; border-bottom: 2px solid #dee2e6; }
    td { padding: 12px; border-bottom: 1px solid #dee2e6; }
    .high { background: #d4edda; }
    .medium { background: #fff3cd; }
    .low { background: #f8d7da; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Coverage Report</h1>
    <div class="summary">
      <div class="metric">
        <div class="label">Lines</div>
        <div class="value">${summary.lines.percentage.toFixed(1)}%</div>
        <small>${summary.lines.covered} / ${summary.lines.total}</small>
      </div>
      <div class="metric">
        <div class="label">Branches</div>
        <div class="value">${summary.branches.percentage.toFixed(1)}%</div>
        <small>${summary.branches.covered} / ${summary.branches.total}</small>
      </div>
      <div class="metric">
        <div class="label">Functions</div>
        <div class="value">${summary.functions.percentage.toFixed(1)}%</div>
        <small>${summary.functions.covered} / ${summary.functions.total}</small>
      </div>
      <div class="metric">
        <div class="label">Statements</div>
        <div class="value">${summary.statements.percentage.toFixed(1)}%</div>
        <small>${summary.statements.covered} / ${summary.statements.total}</small>
      </div>
    </div>

    ${thresholdsHTML}

    <h2>File Coverage</h2>
    <table>
      <thead>
        <tr>
          <th>File</th>
          <th>Coverage</th>
          <th>Lines</th>
          <th>Uncovered Lines</th>
        </tr>
      </thead>
      <tbody>
        ${filesHTML}
      </tbody>
    </table>
  </div>
</body>
</html>`;
  }

  /**
   * Generate LCOV coverage report
   */
  private generateLCOV(coverage: CoverageReport): string {
    let lcov = '';

    for (const file of coverage.files) {
      lcov += `TN:\n`;
      lcov += `SF:${file.filePath}\n`;

      // Line coverage
      for (let i = 1; i <= file.lines.total; i++) {
        const hit = file.lines.uncovered.includes(i) ? 0 : 1;
        lcov += `DA:${i},${hit}\n`;
      }

      lcov += `LF:${file.lines.total}\n`;
      lcov += `LH:${file.lines.covered}\n`;
      lcov += `end_of_record\n`;
    }

    return lcov;
  }

  /**
   * Get color class based on coverage percentage
   */
  private getColorClass(percentage: number): string {
    if (percentage >= 80) return 'high';
    if (percentage >= 50) return 'medium';
    return 'low';
  }

  /**
   * Clear coverage data
   */
  clear(): void {
    this.executedLines.clear();
  }
}
