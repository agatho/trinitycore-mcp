/**
 * Compilation Error Parser
 * AI Agent Development Tool #3
 *
 * Purpose: Parse and categorize C++ compilation errors from GCC, Clang, and MSVC.
 * Benefit: AI agents can understand build failures and suggest fixes automatically.
 */

import * as fs from "fs/promises";
import * as path from "path";

/**
 * Compilation error severity
 */
export type ErrorSeverity = "error" | "warning" | "note" | "fatal";

/**
 * Compilation error category
 */
export type ErrorCategory =
  | "syntax"
  | "type"
  | "linker"
  | "undefined"
  | "template"
  | "include"
  | "memory"
  | "const"
  | "conversion"
  | "deprecated"
  | "other";

/**
 * Parsed compilation error
 */
export interface CompilationError {
  severity: ErrorSeverity;
  category: ErrorCategory;
  file: string;
  line: number;
  column?: number;
  message: string;
  code?: string; // Error code (e.g., "C2065" for MSVC)
  context?: string; // Surrounding code if available
  suggestion?: string; // AI-generated fix suggestion
}

/**
 * Build error summary
 */
export interface BuildErrorSummary {
  totalErrors: number;
  totalWarnings: number;
  totalNotes: number;
  errorsByCategory: Record<ErrorCategory, number>;
  errorsByFile: Array<{ file: string; count: number }>;
  mostCommonErrors: Array<{ message: string; count: number }>;
  criticalErrors: CompilationError[];
  fixSuggestions: Array<{ error: string; fix: string; confidence: number }>;
}

/**
 * Compiler type detection
 */
export type CompilerType = "gcc" | "clang" | "msvc" | "unknown";

/**
 * Detect compiler type from error output
 */
export function detectCompiler(errorOutput: string): CompilerType {
  if (errorOutput.includes("error C") || errorOutput.includes("warning C")) {
    return "msvc";
  }
  if (errorOutput.includes("clang") || errorOutput.includes("-Wunused")) {
    return "clang";
  }
  if (errorOutput.includes("gcc") || errorOutput.includes("g++")) {
    return "gcc";
  }
  return "unknown";
}

/**
 * Parse GCC/Clang error format
 */
function parseGCCError(line: string): CompilationError | null {
  // Format: file:line:column: severity: message
  const match = line.match(
    /^([^:]+):(\d+):(\d+):\s+(error|warning|note|fatal error):\s+(.+)$/
  );

  if (!match) return null;

  const [, file, lineStr, columnStr, severity, message] = match;

  return {
    severity: severity === "fatal error" ? "fatal" : (severity as ErrorSeverity),
    category: categorizeError(message),
    file,
    line: parseInt(lineStr),
    column: parseInt(columnStr),
    message,
  };
}

/**
 * Parse MSVC error format
 */
function parseMSVCError(line: string): CompilationError | null {
  // Format: file(line): severity CCode: message
  // or: file(line,column): severity CCode: message
  const match = line.match(
    /^([^(]+)\((\d+)(?:,(\d+))?\):\s+(error|warning|note)\s+([A-Z]\d+):\s+(.+)$/
  );

  if (!match) return null;

  const [, file, lineStr, columnStr, severity, code, message] = match;

  return {
    severity: severity as ErrorSeverity,
    category: categorizeError(message),
    file,
    line: parseInt(lineStr),
    column: columnStr ? parseInt(columnStr) : undefined,
    message,
    code,
  };
}

/**
 * Parse error output from build log
 */
export function parseErrorOutput(errorOutput: string): CompilationError[] {
  const compiler = detectCompiler(errorOutput);
  const lines = errorOutput.split("\n");
  const errors: CompilationError[] = [];

  for (const line of lines) {
    let error: CompilationError | null = null;

    if (compiler === "gcc" || compiler === "clang") {
      error = parseGCCError(line);
    } else if (compiler === "msvc") {
      error = parseMSVCError(line);
    }

    if (error) {
      // Try to add fix suggestion
      error.suggestion = generateFixSuggestion(error);
      errors.push(error);
    }
  }

  return errors;
}

/**
 * Categorize error based on message content
 */
function categorizeError(message: string): ErrorCategory {
  const lowerMessage = message.toLowerCase();

  // Syntax errors
  if (
    lowerMessage.includes("expected") ||
    lowerMessage.includes("syntax") ||
    lowerMessage.includes("missing semicolon") ||
    lowerMessage.includes("unexpected")
  ) {
    return "syntax";
  }

  // Type errors
  if (
    lowerMessage.includes("type mismatch") ||
    lowerMessage.includes("cannot convert") ||
    lowerMessage.includes("invalid conversion") ||
    lowerMessage.includes("incompatible")
  ) {
    return "type";
  }

  // Linker errors
  if (
    lowerMessage.includes("undefined reference") ||
    lowerMessage.includes("unresolved external") ||
    lowerMessage.includes("multiple definition") ||
    lowerMessage.includes("link")
  ) {
    return "linker";
  }

  // Undefined errors
  if (
    lowerMessage.includes("not declared") ||
    lowerMessage.includes("was not declared") ||
    lowerMessage.includes("identifier") ||
    lowerMessage.includes("undeclared")
  ) {
    return "undefined";
  }

  // Template errors
  if (
    lowerMessage.includes("template") ||
    lowerMessage.includes("instantiation") ||
    lowerMessage.includes("deduction")
  ) {
    return "template";
  }

  // Include errors
  if (
    lowerMessage.includes("no such file") ||
    lowerMessage.includes("cannot open") ||
    lowerMessage.includes("#include")
  ) {
    return "include";
  }

  // Memory errors
  if (
    lowerMessage.includes("memory") ||
    lowerMessage.includes("delete") ||
    lowerMessage.includes("allocation") ||
    lowerMessage.includes("leak")
  ) {
    return "memory";
  }

  // Const correctness
  if (
    lowerMessage.includes("const") ||
    lowerMessage.includes("read-only") ||
    lowerMessage.includes("discards qualifiers")
  ) {
    return "const";
  }

  // Conversion warnings
  if (
    lowerMessage.includes("conversion") ||
    lowerMessage.includes("truncation") ||
    lowerMessage.includes("narrowing")
  ) {
    return "conversion";
  }

  // Deprecated warnings
  if (lowerMessage.includes("deprecated")) {
    return "deprecated";
  }

  return "other";
}

/**
 * Generate fix suggestion for an error
 */
function generateFixSuggestion(error: CompilationError): string {
  const message = error.message.toLowerCase();

  // Common fix patterns
  if (message.includes("not declared") || message.includes("was not declared")) {
    if (message.includes("in this scope")) {
      return "Add #include directive for the missing declaration or check for typos in the identifier name.";
    }
    return "Declare the variable or function before use, or check for missing #include directives.";
  }

  if (message.includes("expected") && message.includes("before")) {
    return "Check for missing semicolons, braces, or parentheses on the previous line.";
  }

  if (message.includes("cannot convert")) {
    return "Add an explicit type cast or change the type to match the expected type.";
  }

  if (message.includes("undefined reference")) {
    return "Ensure the function is defined in a linked source file or library. Check CMakeLists.txt.";
  }

  if (message.includes("unresolved external")) {
    return "Link the library containing the symbol or verify the function signature matches the declaration.";
  }

  if (message.includes("no such file")) {
    return "Check the #include path and verify the file exists. Update include directories in CMakeLists.txt.";
  }

  if (message.includes("template")) {
    return "Verify template parameter types match the template definition constraints.";
  }

  if (message.includes("discards qualifiers")) {
    return "Add const qualifier to the variable or cast away constness (use with caution).";
  }

  if (message.includes("deprecated")) {
    return "Replace with the recommended alternative API mentioned in the warning.";
  }

  if (message.includes("memory") || message.includes("delete")) {
    return "Use smart pointers (std::unique_ptr, std::shared_ptr) or ensure manual delete is called.";
  }

  if (message.includes("multiple definition")) {
    return "Move function definition to .cpp file or mark as inline if in header.";
  }

  return "Review the error message and check TrinityCore coding standards.";
}

/**
 * Analyze build errors and generate summary
 */
export function analyzeBuildErrors(errors: CompilationError[]): BuildErrorSummary {
  const errorsByCategory: Record<ErrorCategory, number> = {
    syntax: 0,
    type: 0,
    linker: 0,
    undefined: 0,
    template: 0,
    include: 0,
    memory: 0,
    const: 0,
    conversion: 0,
    deprecated: 0,
    other: 0,
  };

  const errorsByFile = new Map<string, number>();
  const errorMessages = new Map<string, number>();

  let totalErrors = 0;
  let totalWarnings = 0;
  let totalNotes = 0;

  for (const error of errors) {
    // Count by severity
    if (error.severity === "error" || error.severity === "fatal") {
      totalErrors++;
    } else if (error.severity === "warning") {
      totalWarnings++;
    } else if (error.severity === "note") {
      totalNotes++;
    }

    // Count by category
    errorsByCategory[error.category]++;

    // Count by file
    errorsByFile.set(error.file, (errorsByFile.get(error.file) || 0) + 1);

    // Count message frequency
    const normalizedMessage = normalizeErrorMessage(error.message);
    errorMessages.set(normalizedMessage, (errorMessages.get(normalizedMessage) || 0) + 1);
  }

  // Get top files with errors
  const topFiles = Array.from(errorsByFile.entries())
    .map(([file, count]) => ({ file, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Get most common errors
  const mostCommonErrors = Array.from(errorMessages.entries())
    .map(([message, count]) => ({ message, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Find critical errors (fatal or linker errors)
  const criticalErrors = errors.filter(
    (e) => e.severity === "fatal" || e.category === "linker"
  );

  // Generate fix suggestions
  const fixSuggestions = generateFixSuggestions(errors, errorsByCategory);

  return {
    totalErrors,
    totalWarnings,
    totalNotes,
    errorsByCategory,
    errorsByFile: topFiles,
    mostCommonErrors,
    criticalErrors,
    fixSuggestions,
  };
}

/**
 * Normalize error message for comparison
 */
function normalizeErrorMessage(message: string): string {
  // Remove file-specific details, line numbers, variable names
  return message
    .replace(/\b[a-zA-Z_][a-zA-Z0-9_]*\b/g, "IDENTIFIER")
    .replace(/\d+/g, "N")
    .replace(/'[^']*'/g, "'...'")
    .replace(/"[^"]*"/g, '"..."');
}

/**
 * Generate comprehensive fix suggestions
 */
function generateFixSuggestions(
  errors: CompilationError[],
  errorsByCategory: Record<ErrorCategory, number>
): Array<{ error: string; fix: string; confidence: number }> {
  const suggestions: Array<{ error: string; fix: string; confidence: number }> = [];

  // Suggest fixes based on error patterns
  if (errorsByCategory.undefined > 5) {
    suggestions.push({
      error: "Multiple undefined identifier errors",
      fix: "Check for missing #include directives. Run: grep -r 'class ClassName' src/",
      confidence: 0.8,
    });
  }

  if (errorsByCategory.linker > 3) {
    suggestions.push({
      error: "Multiple linker errors",
      fix: "Verify CMakeLists.txt includes all source files. Check for missing library links.",
      confidence: 0.9,
    });
  }

  if (errorsByCategory.include > 5) {
    suggestions.push({
      error: "Multiple include file errors",
      fix: "Update include paths in CMakeLists.txt: target_include_directories()",
      confidence: 0.85,
    });
  }

  if (errorsByCategory.template > 5) {
    suggestions.push({
      error: "Multiple template instantiation errors",
      fix: "Ensure template definitions are in header files, not .cpp files.",
      confidence: 0.75,
    });
  }

  if (errorsByCategory.const > 5) {
    suggestions.push({
      error: "Multiple const-correctness errors",
      fix: "Add const qualifiers to method declarations and function parameters.",
      confidence: 0.9,
    });
  }

  if (errorsByCategory.type > 5) {
    suggestions.push({
      error: "Multiple type conversion errors",
      fix: "Use explicit static_cast<> or verify type compatibility.",
      confidence: 0.8,
    });
  }

  // Analyze error patterns for TrinityCore-specific issues
  const trinitySuggestions = analyzeTrinityCorePatternsInternal(errors);
  suggestions.push(...trinitySuggestions);

  return suggestions.sort((a, b) => b.confidence - a.confidence).slice(0, 10);
}

/**
 * Analyze TrinityCore-specific error patterns
 */
function analyzeTrinityCorePatternsInternal(
  errors: CompilationError[]
): Array<{ error: string; fix: string; confidence: number }> {
  const suggestions: Array<{ error: string; fix: string; confidence: number }> = [];

  // Check for Player/Unit/Creature API usage errors
  const playerErrors = errors.filter(
    (e) =>
      e.message.includes("Player::") ||
      e.message.includes("Unit::") ||
      e.message.includes("Creature::")
  );

  if (playerErrors.length > 3) {
    suggestions.push({
      error: "Multiple Player/Unit/Creature API errors",
      fix: "Review TrinityCore API documentation. Use MCP tool: get-trinity-api Player",
      confidence: 0.85,
    });
  }

  // Check for spell system errors
  const spellErrors = errors.filter(
    (e) => e.message.includes("Spell::") || e.message.includes("SpellInfo")
  );

  if (spellErrors.length > 2) {
    suggestions.push({
      error: "Spell system API errors",
      fix: "Check SpellInfo API usage. Spell data may need database queries.",
      confidence: 0.8,
    });
  }

  // Check for database query errors
  const dbErrors = errors.filter(
    (e) =>
      e.message.includes("QueryResult") ||
      e.message.includes("PreparedStatement") ||
      e.message.includes("WorldDatabase")
  );

  if (dbErrors.length > 2) {
    suggestions.push({
      error: "Database query API errors",
      fix: "Verify PreparedStatement usage. Check database connection pool initialization.",
      confidence: 0.9,
    });
  }

  // Check for network packet errors
  const packetErrors = errors.filter(
    (e) => e.message.includes("WorldPacket") || e.message.includes("WorldSession")
  );

  if (packetErrors.length > 2) {
    suggestions.push({
      error: "Network packet handling errors",
      fix: "Review WorldPacket API. Ensure opcode handlers are registered.",
      confidence: 0.85,
    });
  }

  // Check for ObjectGuid errors
  const guidErrors = errors.filter((e) => e.message.includes("ObjectGuid"));

  if (guidErrors.length > 2) {
    suggestions.push({
      error: "ObjectGuid usage errors",
      fix: "Use ObjectGuid::Create() or ObjectGuid::Empty. Check for null GUIDs.",
      confidence: 0.9,
    });
  }

  return suggestions;
}

/**
 * Parse build log file
 */
export async function parseBuildLog(logFilePath: string): Promise<CompilationError[]> {
  try {
    const content = await fs.readFile(logFilePath, "utf-8");
    return parseErrorOutput(content);
  } catch (error) {
    throw new Error(`Failed to read build log: ${error}`);
  }
}

/**
 * Get error context from source file
 */
export async function getErrorContext(
  error: CompilationError,
  contextLines: number = 5
): Promise<string | null> {
  try {
    const content = await fs.readFile(error.file, "utf-8");
    const lines = content.split("\n");

    const startLine = Math.max(0, error.line - contextLines - 1);
    const endLine = Math.min(lines.length, error.line + contextLines);

    const contextArray = lines.slice(startLine, endLine);

    // Mark the error line
    const errorLineIndex = error.line - startLine - 1;
    if (errorLineIndex >= 0 && errorLineIndex < contextArray.length) {
      contextArray[errorLineIndex] = `>>> ${contextArray[errorLineIndex]}`;
    }

    return contextArray.join("\n");
  } catch {
    return null;
  }
}

/**
 * Find root cause of cascading errors
 */
export function findRootCause(errors: CompilationError[]): CompilationError | null {
  if (errors.length === 0) return null;

  // Sort errors by file and line
  const sorted = [...errors].sort((a, b) => {
    if (a.file !== b.file) return a.file.localeCompare(b.file);
    return a.line - b.line;
  });

  // Find the first fatal or error
  const firstError = sorted.find((e) => e.severity === "fatal" || e.severity === "error");

  // If it's an include or undefined error, it's likely the root cause
  if (firstError && (firstError.category === "include" || firstError.category === "undefined")) {
    return firstError;
  }

  return firstError || sorted[0];
}

/**
 * Group related errors
 */
export function groupRelatedErrors(
  errors: CompilationError[]
): Array<{ root: CompilationError; related: CompilationError[] }> {
  const groups: Array<{ root: CompilationError; related: CompilationError[] }> = [];

  // Group by file and proximity
  const byFile = new Map<string, CompilationError[]>();
  for (const error of errors) {
    if (!byFile.has(error.file)) {
      byFile.set(error.file, []);
    }
    byFile.get(error.file)!.push(error);
  }

  // Within each file, group by proximity (within 10 lines)
  for (const [file, fileErrors] of byFile) {
    const sorted = fileErrors.sort((a, b) => a.line - b.line);

    let currentGroup: CompilationError[] = [];
    for (let i = 0; i < sorted.length; i++) {
      if (currentGroup.length === 0) {
        currentGroup.push(sorted[i]);
      } else {
        const lastError = currentGroup[currentGroup.length - 1];
        if (sorted[i].line - lastError.line <= 10) {
          currentGroup.push(sorted[i]);
        } else {
          // Create group
          groups.push({
            root: currentGroup[0],
            related: currentGroup.slice(1),
          });
          currentGroup = [sorted[i]];
        }
      }
    }

    if (currentGroup.length > 0) {
      groups.push({
        root: currentGroup[0],
        related: currentGroup.slice(1),
      });
    }
  }

  return groups;
}

/**
 * Export for external use
 */
export function analyzeTrinityCorePatternsExport(
  errors: CompilationError[]
): Array<{ error: string; fix: string; confidence: number }> {
  return analyzeTrinityCorePatternsInternal(errors);
}
