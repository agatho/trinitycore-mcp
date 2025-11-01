/**
 * TestReporter
 * Phase 5 - Week 5: Testing Automation Tools
 *
 * Generates test reports in multiple formats (JSON, HTML, Markdown, JUnit XML)
 * with comprehensive statistics and failure analysis.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { TestRunResult, TestResult } from './TestRunner.js';

// ============================================================================
// Type Definitions
// ============================================================================

export interface ReportConfig {
  format: 'json' | 'html' | 'markdown' | 'junit';
  outputPath: string;

  // Options
  includePassedTests?: boolean;   // Include passed tests (default: true)
  includeSkippedTests?: boolean;  // Include skipped tests (default: true)
  includeCharts?: boolean;        // Include charts (HTML only, default: true)

  // Metadata
  title?: string;                 // Report title
  timestamp?: Date;               // Report timestamp
  metadata?: {                    // Custom metadata
    [key: string]: string | number | boolean;
  };
}

export interface ReportSummary {
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  successRate: number;            // percentage
  duration: number;               // ms

  // Performance metrics
  averageDuration: number;        // ms per test
  slowestTest?: {
    name: string;
    duration: number;
  };
  fastestTest?: {
    name: string;
    duration: number;
  };
}

// ============================================================================
// TestReporter Class
// ============================================================================

export class TestReporter {
  constructor() {}

  /**
   * Generate test report
   * Performance target: <100ms JSON, <500ms HTML, <200ms MD, <100ms JUnit
   */
  async generateReport(testResult: TestRunResult, config: ReportConfig): Promise<string> {
    const start = performance.now();

    let content: string;

    switch (config.format) {
      case 'json':
        content = this.generateJSON(testResult, config);
        break;
      case 'html':
        content = this.generateHTML(testResult, config);
        break;
      case 'markdown':
        content = this.generateMarkdown(testResult, config);
        break;
      case 'junit':
        content = this.generateJUnitXML(testResult, config);
        break;
      default:
        throw new Error(`Unsupported format: ${config.format}`);
    }

    // Write to file
    await fs.mkdir(path.dirname(config.outputPath), { recursive: true });
    await fs.writeFile(config.outputPath, content, 'utf-8');

    const generationTime = performance.now() - start;

    return config.outputPath;
  }

  /**
   * Generate summary from test results
   */
  generateSummary(testResult: TestRunResult): ReportSummary {
    const summary: ReportSummary = {
      totalTests: testResult.summary.totalTests,
      passed: testResult.summary.passed,
      failed: testResult.summary.failed,
      skipped: testResult.summary.skipped,
      successRate: testResult.summary.successRate,
      duration: testResult.summary.duration,
      averageDuration: 0
    };

    // Calculate average duration
    if (summary.totalTests > 0) {
      const totalDuration = testResult.results.reduce((sum, r) => sum + r.duration, 0);
      summary.averageDuration = totalDuration / summary.totalTests;
    }

    // Find slowest and fastest tests
    if (testResult.results.length > 0) {
      const sortedByDuration = [...testResult.results].sort((a, b) => b.duration - a.duration);

      summary.slowestTest = {
        name: sortedByDuration[0].testName,
        duration: sortedByDuration[0].duration
      };

      summary.fastestTest = {
        name: sortedByDuration[sortedByDuration.length - 1].testName,
        duration: sortedByDuration[sortedByDuration.length - 1].duration
      };
    }

    return summary;
  }

  /**
   * Generate JSON report
   */
  private generateJSON(testResult: TestRunResult, config: ReportConfig): string {
    const summary = this.generateSummary(testResult);

    const report = {
      format: 'json',
      timestamp: config.timestamp || new Date(),
      title: config.title || 'Test Report',
      summary,
      results: config.includePassedTests !== false
        ? testResult.results
        : testResult.results.filter(r => r.status !== 'pass'),
      failures: testResult.failures,
      metadata: config.metadata || {}
    };

    return JSON.stringify(report, null, 2);
  }

  /**
   * Generate HTML report
   */
  private generateHTML(testResult: TestRunResult, config: ReportConfig): string {
    const summary = this.generateSummary(testResult);
    const timestamp = (config.timestamp || new Date()).toLocaleString();
    const title = config.title || 'Test Report';

    const passPercentNum = summary.successRate;
    const failPercentNum = summary.failed / summary.totalTests * 100;
    const skipPercentNum = summary.skipped / summary.totalTests * 100;

    const passPercent = passPercentNum.toFixed(1);
    const failPercent = failPercentNum.toFixed(1);
    const skipPercent = skipPercentNum.toFixed(1);

    // Filter results based on config
    let results = testResult.results;
    if (config.includePassedTests === false) {
      results = results.filter(r => r.status !== 'pass');
    }
    if (config.includeSkippedTests === false) {
      results = results.filter(r => r.status !== 'skip');
    }

    // Generate results table
    const resultsHTML = results.map(r => {
      const statusClass = r.status === 'pass' ? 'success' : (r.status === 'fail' ? 'danger' : 'warning');
      const statusIcon = r.status === 'pass' ? '✓' : (r.status === 'fail' ? '✗' : '○');

      return `
        <tr class="${statusClass}">
          <td>${statusIcon} ${this.escapeHTML(r.testName)}</td>
          <td><span class="badge badge-${statusClass}">${r.status.toUpperCase()}</span></td>
          <td>${r.duration.toFixed(0)}ms</td>
          <td>${r.retries || 0}</td>
          <td>${r.error ? this.escapeHTML(r.error.message) : '-'}</td>
        </tr>
      `;
    }).join('');

    // Generate failures section
    const failuresHTML = testResult.failures.length > 0 ? `
      <h2>Failures</h2>
      <div class="failures">
        ${testResult.failures.map(f => `
          <div class="failure">
            <h4>${this.escapeHTML(f.testName)}</h4>
            <p class="error-message">${this.escapeHTML(f.error)}</p>
            <pre class="stack-trace">${this.escapeHTML(f.stack)}</pre>
          </div>
        `).join('')}
      </div>
    ` : '';

    // Generate chart (if enabled)
    const chartHTML = config.includeCharts !== false ? `
      <div class="chart">
        <svg viewBox="0 0 200 200" width="200" height="200">
          <circle cx="100" cy="100" r="90" fill="#28a745" stroke="none"
                  stroke-dasharray="${passPercentNum * 5.65} 565"
                  transform="rotate(-90 100 100)"/>
          <circle cx="100" cy="100" r="90" fill="none" stroke="#dc3545" stroke-width="180"
                  stroke-dasharray="${failPercentNum * 5.65} 565"
                  stroke-dashoffset="${-passPercentNum * 5.65}"
                  transform="rotate(-90 100 100)"/>
          <circle cx="100" cy="100" r="90" fill="none" stroke="#ffc107" stroke-width="180"
                  stroke-dasharray="${skipPercentNum * 5.65} 565"
                  stroke-dashoffset="${-(passPercentNum + failPercentNum) * 5.65}"
                  transform="rotate(-90 100 100)"/>
          <text x="100" y="105" text-anchor="middle" font-size="24" font-weight="bold">${passPercent}%</text>
        </svg>
        <div class="legend">
          <div><span class="dot success"></span> Passed: ${summary.passed}</div>
          <div><span class="dot danger"></span> Failed: ${summary.failed}</div>
          <div><span class="dot warning"></span> Skipped: ${summary.skipped}</div>
        </div>
      </div>
    ` : '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${this.escapeHTML(title)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; padding: 20px; }
    .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    h1 { color: #333; margin-bottom: 10px; }
    .timestamp { color: #666; font-size: 14px; margin-bottom: 30px; }
    .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
    .metric { padding: 20px; border-radius: 6px; background: #f8f9fa; border-left: 4px solid #007bff; }
    .metric.success { border-left-color: #28a745; }
    .metric.danger { border-left-color: #dc3545; }
    .metric.warning { border-left-color: #ffc107; }
    .metric .label { font-size: 12px; color: #666; text-transform: uppercase; margin-bottom: 5px; }
    .metric .value { font-size: 28px; font-weight: bold; color: #333; }
    .chart { display: flex; align-items: center; gap: 30px; margin: 30px 0; padding: 20px; background: #f8f9fa; border-radius: 6px; }
    .legend { display: flex; flex-direction: column; gap: 10px; }
    .legend .dot { display: inline-block; width: 12px; height: 12px; border-radius: 50%; margin-right: 8px; }
    .legend .dot.success { background: #28a745; }
    .legend .dot.danger { background: #dc3545; }
    .legend .dot.warning { background: #ffc107; }
    h2 { color: #333; margin: 30px 0 15px; padding-bottom: 10px; border-bottom: 2px solid #e9ecef; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
    th { background: #f8f9fa; padding: 12px; text-align: left; font-weight: 600; border-bottom: 2px solid #dee2e6; }
    td { padding: 12px; border-bottom: 1px solid #dee2e6; }
    tr.success { background: #f8fff9; }
    tr.danger { background: #fff8f8; }
    tr.warning { background: #fffbf0; }
    .badge { padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; }
    .badge-success { background: #28a745; color: white; }
    .badge-danger { background: #dc3545; color: white; }
    .badge-warning { background: #ffc107; color: #333; }
    .failures { display: flex; flex-direction: column; gap: 20px; }
    .failure { padding: 20px; background: #fff8f8; border-left: 4px solid #dc3545; border-radius: 6px; }
    .failure h4 { color: #dc3545; margin-bottom: 10px; }
    .error-message { color: #721c24; margin-bottom: 10px; }
    .stack-trace { background: #f8f9fa; padding: 15px; border-radius: 4px; font-size: 12px; overflow-x: auto; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <h1>${this.escapeHTML(title)}</h1>
    <div class="timestamp">Generated on ${timestamp}</div>

    <div class="summary">
      <div class="metric">
        <div class="label">Total Tests</div>
        <div class="value">${summary.totalTests}</div>
      </div>
      <div class="metric success">
        <div class="label">Passed</div>
        <div class="value">${summary.passed} (${passPercent}%)</div>
      </div>
      <div class="metric danger">
        <div class="label">Failed</div>
        <div class="value">${summary.failed} (${failPercent}%)</div>
      </div>
      <div class="metric warning">
        <div class="label">Skipped</div>
        <div class="value">${summary.skipped} (${skipPercent}%)</div>
      </div>
      <div class="metric">
        <div class="label">Duration</div>
        <div class="value">${this.formatDuration(summary.duration)}</div>
      </div>
      <div class="metric">
        <div class="label">Avg Duration</div>
        <div class="value">${summary.averageDuration.toFixed(0)}ms</div>
      </div>
    </div>

    ${chartHTML}

    <h2>Test Results</h2>
    <table>
      <thead>
        <tr>
          <th>Test Name</th>
          <th>Status</th>
          <th>Duration</th>
          <th>Retries</th>
          <th>Error</th>
        </tr>
      </thead>
      <tbody>
        ${resultsHTML}
      </tbody>
    </table>

    ${failuresHTML}
  </div>
</body>
</html>`;
  }

  /**
   * Generate Markdown report
   */
  private generateMarkdown(testResult: TestRunResult, config: ReportConfig): string {
    const summary = this.generateSummary(testResult);
    const timestamp = (config.timestamp || new Date()).toLocaleString();
    const title = config.title || 'Test Report';

    const passPercent = summary.successRate.toFixed(1);
    const failPercent = (summary.failed / summary.totalTests * 100).toFixed(1);
    const skipPercent = (summary.skipped / summary.totalTests * 100).toFixed(1);

    // Generate badges
    const badges = this.generateBadges(summary);

    // Filter results
    let results = testResult.results;
    if (config.includePassedTests === false) {
      results = results.filter(r => r.status !== 'pass');
    }
    if (config.includeSkippedTests === false) {
      results = results.filter(r => r.status !== 'skip');
    }

    // Generate results table
    const resultsTable = results.length > 0 ? `
## Test Results

| Test Name | Status | Duration | Retries | Error |
|-----------|--------|----------|---------|-------|
${results.map(r => {
  const statusIcon = r.status === 'pass' ? '✅' : (r.status === 'fail' ? '❌' : '⚠️');
  const error = r.error ? r.error.message : '-';
  return `| ${r.testName} | ${statusIcon} ${r.status.toUpperCase()} | ${r.duration.toFixed(0)}ms | ${r.retries || 0} | ${error} |`;
}).join('\n')}
` : '';

    // Generate failures section
    const failuresSection = testResult.failures.length > 0 ? `
## Failures

${testResult.failures.map(f => `
### ${f.testName}

**Error**: ${f.error}

**Stack Trace**:
\`\`\`
${f.stack}
\`\`\`
`).join('\n')}
` : '';

    return `# ${title}

${badges}

*Generated on ${timestamp}*

## Summary

- **Total Tests**: ${summary.totalTests}
- **Passed**: ${summary.passed} (${passPercent}%)
- **Failed**: ${summary.failed} (${failPercent}%)
- **Skipped**: ${summary.skipped} (${skipPercent}%)
- **Duration**: ${this.formatDuration(summary.duration)}
- **Average Duration**: ${summary.averageDuration.toFixed(0)}ms

${summary.slowestTest ? `- **Slowest Test**: ${summary.slowestTest.name} (${summary.slowestTest.duration.toFixed(0)}ms)` : ''}
${summary.fastestTest ? `- **Fastest Test**: ${summary.fastestTest.name} (${summary.fastestTest.duration.toFixed(0)}ms)` : ''}

${resultsTable}

${failuresSection}
`;
  }

  /**
   * Generate JUnit XML report
   */
  private generateJUnitXML(testResult: TestRunResult, config: ReportConfig): string {
    const summary = this.generateSummary(testResult);
    const timestamp = (config.timestamp || new Date()).toISOString();

    // Group tests by suite (extract suite name from test name if possible)
    const suites: Map<string, TestResult[]> = new Map();

    for (const result of testResult.results) {
      // Extract suite name (before first "should" or use "Default")
      const match = result.testName.match(/^(.+?)\s+should/);
      const suiteName = match ? match[1] : 'Default Suite';

      if (!suites.has(suiteName)) {
        suites.set(suiteName, []);
      }
      suites.get(suiteName)!.push(result);
    }

    // Generate testsuites XML
    const suitesXML = Array.from(suites.entries()).map(([suiteName, tests]) => {
      const suiteTests = tests.length;
      const suiteFailures = tests.filter(t => t.status === 'fail').length;
      const suiteSkipped = tests.filter(t => t.status === 'skip').length;
      const suiteDuration = tests.reduce((sum, t) => sum + t.duration, 0) / 1000; // convert to seconds

      const testcases = tests.map(test => {
        const testcaseAttrs = [
          `name="${this.escapeXML(test.testName)}"`,
          `classname="${this.escapeXML(suiteName)}"`,
          `time="${(test.duration / 1000).toFixed(3)}"`
        ].join(' ');

        let testcaseContent = '';
        if (test.status === 'fail' && test.error) {
          testcaseContent = `
      <failure message="${this.escapeXML(test.error.message)}">
${this.escapeXML(test.error.stack)}
      </failure>`;
        } else if (test.status === 'skip') {
          testcaseContent = `
      <skipped/>`;
        }

        return `    <testcase ${testcaseAttrs}>${testcaseContent}
    </testcase>`;
      }).join('\n');

      return `  <testsuite name="${this.escapeXML(suiteName)}" tests="${suiteTests}" failures="${suiteFailures}" skipped="${suiteSkipped}" time="${suiteDuration.toFixed(3)}" timestamp="${timestamp}">
${testcases}
  </testsuite>`;
    }).join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<testsuites name="${this.escapeXML(config.title || 'Test Report')}" tests="${summary.totalTests}" failures="${summary.failed}" skipped="${summary.skipped}" time="${(summary.duration / 1000).toFixed(3)}">
${suitesXML}
</testsuites>`;
  }

  /**
   * Generate markdown badges
   */
  private generateBadges(summary: ReportSummary): string {
    const passColor = summary.successRate >= 90 ? 'green' : (summary.successRate >= 70 ? 'yellow' : 'red');
    const durationColor = summary.duration < 5000 ? 'green' : (summary.duration < 10000 ? 'yellow' : 'red');

    return [
      `![Tests](https://img.shields.io/badge/tests-${summary.totalTests}-blue)`,
      `![Passed](https://img.shields.io/badge/passed-${summary.passed}-green)`,
      summary.failed > 0 ? `![Failed](https://img.shields.io/badge/failed-${summary.failed}-red)` : '',
      summary.skipped > 0 ? `![Skipped](https://img.shields.io/badge/skipped-${summary.skipped}-yellow)` : '',
      `![Success Rate](https://img.shields.io/badge/success%20rate-${summary.successRate.toFixed(1)}%25-${passColor})`,
      `![Duration](https://img.shields.io/badge/duration-${this.formatDuration(summary.duration)}-${durationColor})`
    ].filter(b => b).join(' ');
  }

  /**
   * Format duration to human-readable string
   */
  private formatDuration(ms: number): string {
    if (ms < 1000) {
      return `${ms.toFixed(0)}ms`;
    } else if (ms < 60000) {
      return `${(ms / 1000).toFixed(2)}s`;
    } else {
      const minutes = Math.floor(ms / 60000);
      const seconds = ((ms % 60000) / 1000).toFixed(0);
      return `${minutes}m ${seconds}s`;
    }
  }

  /**
   * Escape HTML special characters
   */
  private escapeHTML(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Escape XML special characters
   */
  private escapeXML(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}
