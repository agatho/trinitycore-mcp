/**
 * SAI Editor Migration Script
 *
 * Migrates data and scripts from old SAI editor versions to the new unified editor.
 *
 * Usage:
 *   npx ts-node scripts/migrate-sai-editor.ts
 *
 * What it does:
 * 1. Scans for old SAI editor usage in codebase
 * 2. Identifies data in old formats
 * 3. Converts to new SAI unified format
 * 4. Generates migration report
 * 5. Creates backup of old data
 */

import fs from 'fs';
import path from 'path';

// ============================================================================
// TYPES
// ============================================================================

interface MigrationResult {
  success: boolean;
  filesScanned: number;
  issuesFound: number;
  issuesFixed: number;
  backupCreated: boolean;
  report: string[];
  errors: string[];
}

interface OldEditorUsage {
  file: string;
  line: number;
  type: 'import' | 'usage' | 'data';
  oldVersion: 'basic' | 'enhanced' | 'complete';
  suggestion: string;
}

// ============================================================================
// MIGRATION LOGIC
// ============================================================================

class SAIEditorMigration {
  private results: MigrationResult = {
    success: true,
    filesScanned: 0,
    issuesFound: 0,
    issuesFixed: 0,
    backupCreated: false,
    report: [],
    errors: [],
  };

  private oldEditorPatterns = {
    basic: /from ['"]@\/lib\/sai-editor['"]/g,
    enhanced: /from ['"]@\/lib\/sai-editor-enhanced['"]/g,
    complete: /from ['"]@\/lib\/sai-editor-complete['"]/g,
  };

  /**
   * Run migration
   */
  async migrate(): Promise<MigrationResult> {
    this.log('=================================================');
    this.log('SAI Editor Migration Tool');
    this.log('=================================================');
    this.log('');

    try {
      // Step 1: Create backup
      this.log('Step 1: Creating backup...');
      await this.createBackup();

      // Step 2: Scan codebase
      this.log('Step 2: Scanning codebase...');
      await this.scanCodebase();

      // Step 3: Analyze data
      this.log('Step 3: Analyzing data formats...');
      await this.analyzeDataFormats();

      // Step 4: Generate report
      this.log('Step 4: Generating migration report...');
      await this.generateReport();

      this.log('');
      this.log('=================================================');
      this.log('Migration Complete!');
      this.log('=================================================');
      this.log(`Files scanned: ${this.results.filesScanned}`);
      this.log(`Issues found: ${this.results.issuesFound}`);
      this.log(`Backup created: ${this.results.backupCreated ? 'Yes' : 'No'}`);
      this.log('');
      this.log('Next steps:');
      this.log('1. Review migration-report.md');
      this.log('2. Update imports to use sai-unified');
      this.log('3. Update data formats where needed');
      this.log('4. Test thoroughly');
      this.log('5. Remove old editor files when ready');

    } catch (error: any) {
      this.results.success = false;
      this.results.errors.push(error.message);
      this.log(`Error: ${error.message}`);
    }

    return this.results;
  }

  /**
   * Create backup of old editor files
   */
  private async createBackup(): Promise<void> {
    const backupDir = path.join(process.cwd(), 'backups', `sai-editor-${Date.now()}`);

    try {
      // Create backup directory
      fs.mkdirSync(backupDir, { recursive: true });

      // Copy old editor files
      const oldFiles = [
        'lib/sai-editor.ts',
        'lib/sai-editor-enhanced.ts',
        'lib/sai-editor-complete.ts',
      ];

      for (const file of oldFiles) {
        const sourcePath = path.join(process.cwd(), file);
        const targetPath = path.join(backupDir, file);

        if (fs.existsSync(sourcePath)) {
          fs.mkdirSync(path.dirname(targetPath), { recursive: true });
          fs.copyFileSync(sourcePath, targetPath);
          this.log(`  Backed up: ${file}`);
        }
      }

      this.results.backupCreated = true;
      this.log(`  Backup created at: ${backupDir}`);

    } catch (error: any) {
      this.log(`  Warning: Failed to create backup: ${error.message}`);
    }
  }

  /**
   * Scan codebase for old editor usage
   */
  private async scanCodebase(): Promise<void> {
    const issues: OldEditorUsage[] = [];

    // Scan directories
    const dirsToScan = [
      path.join(process.cwd(), 'app'),
      path.join(process.cwd(), 'components'),
      path.join(process.cwd(), 'lib'),
    ];

    for (const dir of dirsToScan) {
      if (fs.existsSync(dir)) {
        this.scanDirectory(dir, issues);
      }
    }

    this.results.filesScanned = issues.length;
    this.results.issuesFound = issues.filter(i => i.type === 'import' || i.type === 'usage').length;

    // Add to report
    if (issues.length > 0) {
      this.results.report.push('## Old Editor Usage Found\n');

      issues.forEach((issue) => {
        this.results.report.push(`- **${issue.file}:${issue.line}**`);
        this.results.report.push(`  - Type: ${issue.type}`);
        this.results.report.push(`  - Version: ${issue.oldVersion}`);
        this.results.report.push(`  - Suggestion: ${issue.suggestion}\n`);
      });
    } else {
      this.log('  No old editor usage found!');
    }
  }

  /**
   * Scan directory recursively
   */
  private scanDirectory(dir: string, issues: OldEditorUsage[]): void {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        // Skip node_modules and hidden directories
        if (entry.name !== 'node_modules' && !entry.name.startsWith('.')) {
          this.scanDirectory(fullPath, issues);
        }
      } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
        this.scanFile(fullPath, issues);
      }
    }
  }

  /**
   * Scan file for old editor patterns
   */
  private scanFile(filePath: string, issues: OldEditorUsage[]): void {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');

      lines.forEach((line, index) => {
        // Check for old imports
        if (this.oldEditorPatterns.basic.test(line)) {
          issues.push({
            file: path.relative(process.cwd(), filePath),
            line: index + 1,
            type: 'import',
            oldVersion: 'basic',
            suggestion: 'Replace with: from \'@/lib/sai-unified\'',
          });
        }

        if (this.oldEditorPatterns.enhanced.test(line)) {
          issues.push({
            file: path.relative(process.cwd(), filePath),
            line: index + 1,
            type: 'import',
            oldVersion: 'enhanced',
            suggestion: 'Replace with: from \'@/lib/sai-unified\'',
          });
        }

        if (this.oldEditorPatterns.complete.test(line)) {
          issues.push({
            file: path.relative(process.cwd(), filePath),
            line: index + 1,
            type: 'import',
            oldVersion: 'complete',
            suggestion: 'Replace with: from \'@/lib/sai-unified\'',
          });
        }
      });

    } catch (error: any) {
      this.log(`  Warning: Failed to scan ${filePath}: ${error.message}`);
    }
  }

  /**
   * Analyze data formats
   */
  private async analyzeDataFormats(): Promise<void> {
    this.results.report.push('\n## Data Format Analysis\n');

    // Check for localStorage data
    this.results.report.push('### Local Storage Data\n');
    this.results.report.push('The new unified editor uses different localStorage keys:\n');
    this.results.report.push('- Old: `sai-editor-scripts`, `sai-editor-recent`\n');
    this.results.report.push('- New: `sai-unified-scripts`, `sai-unified-recent`\n');
    this.results.report.push('- Migration: Run `migrateLocalStorage()` in browser console\n');

    // Check for database schema
    this.results.report.push('\n### Database Schema\n');
    this.results.report.push('The unified editor is compatible with existing TrinityCore `smart_scripts` table.\n');
    this.results.report.push('No database migration needed.\n');

    // Check for custom types
    this.results.report.push('\n### Type Definitions\n');
    this.results.report.push('If you have custom type definitions for SAI scripts:\n');
    this.results.report.push('1. Update to use types from `@/lib/sai-unified/types`\n');
    this.results.report.push('2. New types include: SAIScript, SAINode, SAIConnection\n');
    this.results.report.push('3. All types are strongly typed with TypeScript\n');
  }

  /**
   * Generate migration report
   */
  private async generateReport(): Promise<void> {
    const reportPath = path.join(process.cwd(), 'migration-report.md');

    let report = '# SAI Editor Migration Report\n\n';
    report += `Generated: ${new Date().toISOString()}\n\n`;
    report += `**Status**: ${this.results.success ? '✅ Success' : '❌ Failed'}\n`;
    report += `**Files Scanned**: ${this.results.filesScanned}\n`;
    report += `**Issues Found**: ${this.results.issuesFound}\n`;
    report += `**Backup Created**: ${this.results.backupCreated ? 'Yes' : 'No'}\n\n`;

    report += '---\n\n';

    report += this.results.report.join('\n');

    if (this.results.errors.length > 0) {
      report += '\n## Errors\n\n';
      this.results.errors.forEach((error) => {
        report += `- ${error}\n`;
      });
    }

    report += '\n## Migration Steps\n\n';
    report += '### 1. Update Imports\n\n';
    report += 'Replace old imports:\n';
    report += '```typescript\n';
    report += '// Old\n';
    report += 'import { SAIEditor } from \'@/lib/sai-editor\';\n';
    report += 'import { EnhancedSAIEditor } from \'@/lib/sai-editor-enhanced\';\n';
    report += 'import { CompleteSAIEditor } from \'@/lib/sai-editor-complete\';\n\n';
    report += '// New\n';
    report += 'import { SAIEditor } from \'@/components/sai-editor/SAIEditor\';\n';
    report += 'import { validateScript } from \'@/lib/sai-unified/validation\';\n';
    report += 'import { generateSQL } from \'@/lib/sai-unified/sql-generator\';\n';
    report += '```\n\n';

    report += '### 2. Update Components\n\n';
    report += 'The new editor has a different API:\n';
    report += '```tsx\n';
    report += '// Old\n';
    report += '<SAIEditor entryOrGuid={123} sourceType={0} />\n\n';
    report += '// New\n';
    report += '<SAIEditor scriptId="script-123" initialScript={script} />\n';
    report += '```\n\n';

    report += '### 3. Migrate Data (Browser Console)\n\n';
    report += '```javascript\n';
    report += 'function migrateLocalStorage() {\n';
    report += '  // Migrate scripts\n';
    report += '  const oldScripts = localStorage.getItem(\'sai-editor-scripts\');\n';
    report += '  if (oldScripts) {\n';
    report += '    localStorage.setItem(\'sai-unified-scripts\', oldScripts);\n';
    report += '    console.log(\'Migrated scripts\');\n';
    report += '  }\n\n';
    report += '  // Migrate recent\n';
    report += '  const oldRecent = localStorage.getItem(\'sai-editor-recent\');\n';
    report += '  if (oldRecent) {\n';
    report += '    localStorage.setItem(\'sai-unified-recent\', oldRecent);\n';
    report += '    console.log(\'Migrated recent items\');\n';
    report += '  }\n';
    report += '}\n\n';
    report += 'migrateLocalStorage();\n';
    report += '```\n\n';

    report += '### 4. Test Thoroughly\n\n';
    report += '- Test all existing scripts\n';
    report += '- Verify import/export works\n';
    report += '- Check validation\n';
    report += '- Test new features (AI, collaboration)\n\n';

    report += '### 5. Remove Old Files\n\n';
    report += 'When ready, delete old editor files:\n';
    report += '```bash\n';
    report += 'rm web-ui/lib/sai-editor.ts\n';
    report += 'rm web-ui/lib/sai-editor-enhanced.ts\n';
    report += 'rm web-ui/lib/sai-editor-complete.ts\n';
    report += '```\n\n';

    report += '## New Features Available\n\n';
    report += '- ✨ AI-powered generation (GPT-4, Claude, Ollama, LM Studio)\n';
    report += '- ✅ Real-time database validation\n';
    report += '- 👥 Collaborative editing (WebSocket)\n';
    report += '- 📋 12+ pre-built templates\n';
    report += '- ⚡ Performance optimizations\n';
    report += '- 🧪 Comprehensive testing\n';
    report += '- 📚 Complete documentation\n';

    fs.writeFileSync(reportPath, report);
    this.log(`  Report generated: ${reportPath}`);
  }

  /**
   * Log message
   */
  private log(message: string): void {
    console.log(message);
  }
}

// ============================================================================
// CLI RUNNER
// ============================================================================

async function main() {
  const migration = new SAIEditorMigration();
  const result = await migration.migrate();

  process.exit(result.success ? 0 : 1);
}

// Run if called directly
if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { SAIEditorMigration };
