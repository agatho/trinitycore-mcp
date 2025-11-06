#!/usr/bin/env node
/**
 * Script to replace console.log/error/warn with Winston logger
 *
 * Usage: node scripts/replace-console-with-logger.js
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Configuration
const SRC_DIR = path.join(__dirname, '../src');
const LOGGER_IMPORT = "import { logger } from '../utils/logger.js';";
const LOGGER_IMPORT_RELATIVE = "import { logger } from './utils/logger.js';";

// Files to exclude from replacement
const EXCLUDE_FILES = [
  'src/utils/logger.ts', // The logger itself
  'src/monitoring/Logger.ts' // Existing custom logger
];

/**
 * Check if file should be processed
 */
function shouldProcessFile(filePath) {
  const relativePath = path.relative(path.join(__dirname, '..'), filePath);
  return !EXCLUDE_FILES.some(exclude => relativePath === exclude);
}

/**
 * Get correct logger import path based on file location
 */
function getLoggerImportPath(filePath) {
  const dir = path.dirname(filePath);
  const relativeToSrc = path.relative(dir, path.join(__dirname, '../src/utils'));
  const importPath = relativeToSrc.split(path.sep).join('/');
  return `import { logger } from '${importPath}/logger.js';`;
}

/**
 * Check if file already has logger import
 */
function hasLoggerImport(content) {
  return content.includes("from './utils/logger.js'") ||
         content.includes("from '../utils/logger.js'") ||
         content.includes('from \'../../utils/logger.js\'') ||
         content.includes('from \'../../../utils/logger.js\'');
}

/**
 * Add logger import to file
 */
function addLoggerImport(content, filePath) {
  if (hasLoggerImport(content)) {
    return content;
  }

  const loggerImport = getLoggerImportPath(filePath);

  // Find last import statement, properly handling multi-line imports
  const lines = content.split('\n');
  let lastImportIndex = -1;
  let inImport = false;
  let inBlockComment = false;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();

    // Track block comments
    if (trimmed.startsWith('/*')) {
      inBlockComment = true;
    }
    if (inBlockComment && trimmed.includes('*/')) {
      inBlockComment = false;
      continue;
    }
    if (inBlockComment) {
      continue;
    }

    // Skip line comments
    if (trimmed.startsWith('//')) {
      continue;
    }

    // Track multi-line imports
    if (trimmed.startsWith('import ')) {
      inImport = true;
      lastImportIndex = i;
    }

    // If we're in an import, check if it ends
    if (inImport) {
      lastImportIndex = i;
      if (trimmed.includes('from ') && trimmed.endsWith(';')) {
        inImport = false;
      }
    }

    // If we hit a non-import line (and we're not in an import), stop
    if (!inImport && trimmed &&
        !trimmed.startsWith('import ') &&
        !trimmed.startsWith('//') &&
        !trimmed.startsWith('/*') &&
        !trimmed.startsWith('*') &&
        lastImportIndex >= 0) {
      break;
    }
  }

  if (lastImportIndex >= 0) {
    lines.splice(lastImportIndex + 1, 0, loggerImport);
    return lines.join('\n');
  }

  // If no imports found, add at the beginning after file comment
  let insertIndex = 0;
  let inComment = false;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().startsWith('/**')) {
      inComment = true;
    }
    if (inComment && lines[i].trim().includes('*/')) {
      insertIndex = i + 1;
      break;
    }
    if (!inComment && lines[i].trim()) {
      insertIndex = i;
      break;
    }
  }

  lines.splice(insertIndex, 0, '', loggerImport, '');
  return lines.join('\n');
}

/**
 * Replace console calls with logger
 */
function replaceConsoleCalls(content) {
  let modified = content;

  // Replace console.log -> logger.info
  modified = modified.replace(/console\.log\(/g, 'logger.info(');

  // Replace console.error -> logger.error
  modified = modified.replace(/console\.error\(/g, 'logger.error(');

  // Replace console.warn -> logger.warn
  modified = modified.replace(/console\.warn\(/g, 'logger.warn(');

  // Replace console.debug -> logger.debug
  modified = modified.replace(/console\.debug\(/g, 'logger.debug(');

  return modified;
}

/**
 * Process a single file
 */
function processFile(filePath) {
  if (!shouldProcessFile(filePath)) {
    console.log(`⏭️  Skipping ${filePath}`);
    return { processed: false, changes: 0 };
  }

  const content = fs.readFileSync(filePath, 'utf-8');

  // Count console calls
  const consoleLogCount = (content.match(/console\.log\(/g) || []).length;
  const consoleErrorCount = (content.match(/console\.error\(/g) || []).length;
  const consoleWarnCount = (content.match(/console\.warn\(/g) || []).length;
  const consoleDebugCount = (content.match(/console\.debug\(/g) || []).length;
  const totalConsoleCount = consoleLogCount + consoleErrorCount + consoleWarnCount + consoleDebugCount;

  if (totalConsoleCount === 0) {
    return { processed: false, changes: 0 };
  }

  console.log(`📝 Processing ${filePath}...`);
  console.log(`   Found: ${consoleLogCount} log, ${consoleErrorCount} error, ${consoleWarnCount} warn, ${consoleDebugCount} debug`);

  // Add logger import
  let modified = addLoggerImport(content, filePath);

  // Replace console calls
  modified = replaceConsoleCalls(modified);

  // Write back to file
  fs.writeFileSync(filePath, modified, 'utf-8');

  console.log(`   ✅ Replaced ${totalConsoleCount} console calls`);

  return { processed: true, changes: totalConsoleCount };
}

/**
 * Main execution
 */
function main() {
  console.log('🔄 Replacing console calls with Winston logger...\n');

  // Find all TypeScript files in src/
  const files = glob.sync(path.join(SRC_DIR, '**/*.ts'), {
    ignore: ['**/node_modules/**', '**/dist/**']
  });

  console.log(`Found ${files.length} TypeScript files\n`);

  let totalProcessed = 0;
  let totalChanges = 0;

  for (const file of files) {
    const result = processFile(file);
    if (result.processed) {
      totalProcessed++;
      totalChanges += result.changes;
    }
  }

  console.log(`\n✅ Complete!`);
  console.log(`   Files processed: ${totalProcessed}`);
  console.log(`   Console calls replaced: ${totalChanges}`);
}

// Run
main();
