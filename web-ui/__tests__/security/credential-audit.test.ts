/**
 * Credential Audit Tests
 *
 * Ensures no hardcoded credentials exist in tracked source files.
 * This test suite prevents credential leaks from re-entering the codebase.
 *
 * @module __tests__/security/credential-audit
 */

import { describe, expect, it } from 'vitest';
import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

// Get repository root (two levels up from web-ui/__tests__/security/)
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const WEB_UI_ROOT = path.resolve(__dirname, '..', '..');

/**
 * Get list of tracked files from git
 */
function getTrackedFiles(cwd: string): string[] {
  try {
    const output = execSync('git ls-files', { cwd, encoding: 'utf-8' });
    return output.split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Read file contents if it's a text file (skip binaries)
 */
function readFileIfText(filePath: string): string | null {
  const binaryExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.ico', '.woff', '.woff2', '.ttf', '.eot', '.svg', '.map', '.json'];
  const ext = path.extname(filePath).toLowerCase();

  if (binaryExtensions.includes(ext)) {
    return null;
  }

  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
}

// =============================================================================
// Credential Pattern Tests
// =============================================================================

describe('Credential Audit - No Hardcoded Credentials', () => {
  // Patterns that indicate hardcoded credentials in source code
  // (not in .env files, templates use placeholders)
  const CREDENTIAL_PATTERNS = [
    // Fallback credentials in source code (|| "username")
    {
      pattern: /\|\|\s*["'](?:trinity|admin|acore|root)["']/gi,
      description: 'hardcoded credential fallback (|| "username")',
    },
    // Direct password assignments (password: "value" or password = "value")
    // Only match non-empty, non-placeholder passwords
    {
      pattern: /password\s*[:=]\s*["'](?:trinity|admin|acore|password123|letmein|qwerty)["']/gi,
      description: 'hardcoded password value',
    },
  ];

  // Files to scan (tracked TypeScript/JavaScript source files, excluding node_modules/dist)
  const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];

  it('should not have hardcoded credential fallbacks in MCP server source', () => {
    const trackedFiles = getTrackedFiles(REPO_ROOT);
    const violations: string[] = [];

    for (const relPath of trackedFiles) {
      const ext = path.extname(relPath).toLowerCase();
      if (!SOURCE_EXTENSIONS.includes(ext)) continue;
      if (relPath.includes('node_modules/') || relPath.includes('dist/')) continue;
      // Skip test files that test FOR credentials (like this file)
      if (relPath.includes('credential-audit')) continue;

      const fullPath = path.join(REPO_ROOT, relPath);
      const content = readFileIfText(fullPath);
      if (!content) continue;

      for (const { pattern, description } of CREDENTIAL_PATTERNS) {
        // Reset regex lastIndex for global patterns
        pattern.lastIndex = 0;
        const match = pattern.exec(content);
        if (match) {
          violations.push(`${relPath}: ${description} - "${match[0]}"`);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it('should not have hardcoded credential fallbacks in web-ui source', () => {
    const trackedFiles = getTrackedFiles(WEB_UI_ROOT);
    const violations: string[] = [];

    for (const relPath of trackedFiles) {
      const ext = path.extname(relPath).toLowerCase();
      if (!SOURCE_EXTENSIONS.includes(ext)) continue;
      if (relPath.includes('node_modules/') || relPath.includes('dist/') || relPath.includes('.next/')) continue;
      if (relPath.includes('credential-audit')) continue;

      const fullPath = path.join(WEB_UI_ROOT, relPath);
      const content = readFileIfText(fullPath);
      if (!content) continue;

      for (const { pattern, description } of CREDENTIAL_PATTERNS) {
        pattern.lastIndex = 0;
        const match = pattern.exec(content);
        if (match) {
          violations.push(`${relPath}: ${description} - "${match[0]}"`);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it('should not have real credentials in .env.template files', () => {
    const templateFiles = [
      path.join(REPO_ROOT, '.env.template'),
      path.join(WEB_UI_ROOT, '.env.template'),
      path.join(WEB_UI_ROOT, '.env.local.example'),
    ];

    const TEMPLATE_CREDENTIAL_PATTERNS = [
      // Real-looking usernames/passwords (not placeholders)
      /(?:USERNAME|USER|PASSWORD)=(?:trinity|admin|acore|root)\s*$/gim,
    ];

    const violations: string[] = [];

    for (const filePath of templateFiles) {
      if (!fs.existsSync(filePath)) continue;

      const content = fs.readFileSync(filePath, 'utf-8');
      const relPath = path.relative(REPO_ROOT, filePath);

      for (const pattern of TEMPLATE_CREDENTIAL_PATTERNS) {
        pattern.lastIndex = 0;
        const match = pattern.exec(content);
        if (match) {
          violations.push(`${relPath}: real-looking credential in template - "${match[0].trim()}"`);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it('should have .env files in .gitignore', () => {
    const gitignorePath = path.join(REPO_ROOT, '.gitignore');
    expect(fs.existsSync(gitignorePath)).toBe(true);

    const content = fs.readFileSync(gitignorePath, 'utf-8');

    // Should have some form of .env exclusion
    const hasEnvExclusion = content.includes('.env') || content.includes('*.env');
    expect(hasEnvExclusion).toBe(true);
  });

  it('should not track .env files in git', () => {
    const trackedFiles = getTrackedFiles(REPO_ROOT);

    // Filter for actual .env files (not .env.template, .env.local.example)
    const envFiles = trackedFiles.filter(f => {
      const basename = path.basename(f);
      return basename === '.env' || basename === '.env.local' || basename === '.env.production';
    });

    expect(envFiles).toEqual([]);
  });

  it('should use test-prefixed credentials in test utilities', () => {
    const testUtilPath = path.join(REPO_ROOT, 'src', 'testing', 'test-utilities.ts');
    if (!fs.existsSync(testUtilPath)) return;

    const content = fs.readFileSync(testUtilPath, 'utf-8');

    // Should NOT contain real-looking credentials
    expect(content).not.toMatch(/user:\s*["']trinity["']/);
    expect(content).not.toMatch(/password:\s*["']trinity["']/);
    expect(content).not.toMatch(/username:\s*["']admin["']/);
    expect(content).not.toMatch(/password:\s*["']admin["']/);

    // Should use test-prefixed credentials
    expect(content).toMatch(/test-db-user/);
    expect(content).toMatch(/test-db-password/);
    expect(content).toMatch(/test-soap-user/);
    expect(content).toMatch(/test-soap-password/);
  });
});
