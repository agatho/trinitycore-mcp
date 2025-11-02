/**
 * TrinityCore API Usage Examples
 * AI Agent Development Tool #2
 *
 * Purpose: Search TrinityCore codebase for real usage patterns of C++ APIs.
 * Benefit: AI agents can learn from actual code instead of documentation, seeing how APIs are used in practice.
 */

import { exec } from "child_process";
import { promisify } from "util";
import * as path from "path";
import * as fs from "fs/promises";

const execAsync = promisify(exec);

/**
 * Usage example with context
 */
export interface UsageExample {
  file: string;
  lineNumber: number;
  className: string;
  methodName: string;
  context: string; // 5 lines before and after
  pattern: string; // The actual usage pattern
  category: "declaration" | "definition" | "usage" | "test";
}

/**
 * API usage pattern
 */
export interface UsagePattern {
  pattern: string;
  frequency: number;
  examples: UsageExample[];
  description: string;
}

/**
 * API search result
 */
export interface APISearchResult {
  className: string;
  methodName: string;
  totalUsages: number;
  patterns: UsagePattern[];
  commonMistakes: string[];
  bestPractices: string[];
}

/**
 * Configuration for codebase path
 */
const TRINITY_CORE_PATH =
  process.env.TRINITY_CORE_PATH || "C:\\TrinityBots\\TrinityCore";

/**
 * Check if TrinityCore path exists
 */
async function validateTrinityCorePathInternal(): Promise<void> {
  try {
    await fs.access(TRINITY_CORE_PATH);
  } catch {
    throw new Error(
      `TrinityCore path not found: ${TRINITY_CORE_PATH}. Set TRINITY_CORE_PATH environment variable.`
    );
  }
}

/**
 * Search for API usage using ripgrep
 */
async function searchCodebase(
  pattern: string,
  filePattern: string = "*.cpp",
  contextLines: number = 5
): Promise<Array<{ file: string; lineNumber: number; line: string; context: string }>> {
  await validateTrinityCorePathInternal();

  // Use ripgrep for fast searching
  const rgCommand = `rg "${pattern}" --type cpp --line-number --context ${contextLines} --json`;

  try {
    const { stdout } = await execAsync(rgCommand, {
      cwd: TRINITY_CORE_PATH,
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
    });

    const results: Array<{
      file: string;
      lineNumber: number;
      line: string;
      context: string;
    }> = [];
    const lines = stdout.trim().split("\n");
    let currentMatch: any = null;
    let contextLines: string[] = [];

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const data = JSON.parse(line);

        if (data.type === "match") {
          // Store previous match if exists
          if (currentMatch) {
            results.push({
              file: currentMatch.file,
              lineNumber: currentMatch.lineNumber,
              line: currentMatch.line,
              context: contextLines.join("\n"),
            });
          }

          // Start new match
          currentMatch = {
            file: data.data.path.text,
            lineNumber: data.data.line_number,
            line: data.data.lines.text,
          };
          contextLines = [data.data.lines.text];
        } else if (data.type === "context" && currentMatch) {
          // Add context lines
          contextLines.push(data.data.lines.text);
        }
      } catch {
        // Skip invalid JSON lines
      }
    }

    // Add last match
    if (currentMatch) {
      results.push({
        file: currentMatch.file,
        lineNumber: currentMatch.lineNumber,
        line: currentMatch.line,
        context: contextLines.join("\n"),
      });
    }

    return results;
  } catch (error) {
    // If ripgrep fails, return empty results
    return [];
  }
}

/**
 * Find usage examples for a C++ API
 */
export async function findAPIUsageExamples(
  className: string,
  methodName?: string
): Promise<APISearchResult> {
  await validateTrinityCorePathInternal();

  // Build search patterns
  const searchPatterns: string[] = [];

  if (methodName) {
    // Search for specific method usage
    searchPatterns.push(`${className}::${methodName}`);
    searchPatterns.push(`->${methodName}\\(`); // Pointer call
    searchPatterns.push(`\\.${methodName}\\(`); // Object call
  } else {
    // Search for class usage
    searchPatterns.push(`${className}::`);
    searchPatterns.push(`new ${className}`);
    searchPatterns.push(`${className}\\*`);
  }

  const allResults: UsageExample[] = [];

  // Search for each pattern
  for (const pattern of searchPatterns) {
    const searchResults = await searchCodebase(pattern);

    for (const result of searchResults) {
      // Categorize the usage
      let category: "declaration" | "definition" | "usage" | "test" = "usage";

      if (result.file.includes("Test")) {
        category = "test";
      } else if (result.line.includes("class " + className)) {
        category = "declaration";
      } else if (result.context.includes("{") && result.context.includes("}")) {
        category = "definition";
      }

      allResults.push({
        file: result.file,
        lineNumber: result.lineNumber,
        className,
        methodName: methodName || "",
        context: result.context,
        pattern: result.line.trim(),
        category,
      });
    }
  }

  // Analyze patterns
  const patternMap = new Map<string, UsageExample[]>();

  for (const example of allResults) {
    // Extract the core pattern (remove variable names, literals)
    const corePattern = extractCorePattern(example.pattern);

    if (!patternMap.has(corePattern)) {
      patternMap.set(corePattern, []);
    }
    patternMap.get(corePattern)!.push(example);
  }

  // Build usage patterns sorted by frequency
  const patterns: UsagePattern[] = Array.from(patternMap.entries())
    .map(([pattern, examples]) => ({
      pattern,
      frequency: examples.length,
      examples: examples.slice(0, 5), // Top 5 examples
      description: generatePatternDescription(pattern, className, methodName),
    }))
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, 10); // Top 10 patterns

  // Detect common mistakes
  const commonMistakes = detectCommonMistakes(allResults, className, methodName);

  // Extract best practices
  const bestPractices = extractBestPractices(allResults, className, methodName);

  return {
    className,
    methodName: methodName || "",
    totalUsages: allResults.length,
    patterns,
    commonMistakes,
    bestPractices,
  };
}

/**
 * Extract core pattern from usage line
 */
function extractCorePattern(line: string): string {
  // Remove comments
  let pattern = line.split("//")[0].trim();

  // Replace string literals
  pattern = pattern.replace(/"[^"]*"/g, '"..."');

  // Replace numeric literals
  pattern = pattern.replace(/\b\d+\b/g, "N");

  // Replace variable names (simplified)
  pattern = pattern.replace(/\b[a-z][a-zA-Z0-9]*\b/g, (match) => {
    // Keep common keywords and class names
    if (
      ["if", "for", "while", "return", "new", "delete", "this"].includes(match) ||
      match[0] === match[0].toUpperCase()
    ) {
      return match;
    }
    return "var";
  });

  return pattern;
}

/**
 * Generate description for a usage pattern
 */
function generatePatternDescription(
  pattern: string,
  className: string,
  methodName?: string
): string {
  const descriptions: string[] = [];

  if (pattern.includes("new " + className)) {
    descriptions.push("Object instantiation");
  }
  if (pattern.includes("->")) {
    descriptions.push("Pointer member access");
  }
  if (pattern.includes(".")) {
    descriptions.push("Object member access");
  }
  if (pattern.includes("if") || pattern.includes("while")) {
    descriptions.push("Conditional usage");
  }
  if (pattern.includes("return")) {
    descriptions.push("Return value");
  }
  if (methodName && pattern.includes(methodName)) {
    descriptions.push(`${methodName} method call`);
  }

  return descriptions.join(", ") || "Usage pattern";
}

/**
 * Detect common mistakes in API usage
 */
function detectCommonMistakes(
  examples: UsageExample[],
  className: string,
  methodName?: string
): string[] {
  const mistakes: string[] = [];

  // Check for null pointer dereferences
  const nullCheckMissing = examples.filter((ex) => {
    return (
      ex.pattern.includes("->") &&
      !ex.context.toLowerCase().includes("if") &&
      !ex.context.toLowerCase().includes("null") &&
      !ex.context.toLowerCase().includes("ensure")
    );
  });

  if (nullCheckMissing.length > 5) {
    mistakes.push("Missing null pointer checks before dereferencing");
  }

  // Check for memory leaks (new without delete)
  const newWithoutDelete = examples.filter((ex) => {
    return (
      ex.pattern.includes("new " + className) &&
      !ex.context.includes("delete") &&
      !ex.context.includes("unique_ptr") &&
      !ex.context.includes("shared_ptr")
    );
  });

  if (newWithoutDelete.length > 3) {
    mistakes.push("Potential memory leaks: new without delete or smart pointers");
  }

  // Check for missing const correctness
  const nonConstMethods = examples.filter((ex) => {
    return (
      methodName &&
      ex.category === "definition" &&
      ex.pattern.includes(methodName) &&
      !ex.pattern.includes("const")
    );
  });

  if (nonConstMethods.length > 5) {
    mistakes.push("Methods not marked const when they could be");
  }

  return mistakes;
}

/**
 * Extract best practices from usage examples
 */
function extractBestPractices(
  examples: UsageExample[],
  className: string,
  methodName?: string
): string[] {
  const practices: string[] = [];

  // Check for smart pointer usage
  const smartPointers = examples.filter((ex) => {
    return ex.context.includes("std::unique_ptr") || ex.context.includes("std::shared_ptr");
  });

  if (smartPointers.length > 3) {
    practices.push("Use smart pointers (std::unique_ptr, std::shared_ptr) for memory management");
  }

  // Check for null checks
  const nullChecks = examples.filter((ex) => {
    return (
      ex.context.toLowerCase().includes("if") &&
      (ex.context.toLowerCase().includes("null") ||
        ex.context.toLowerCase().includes("ensure"))
    );
  });

  if (nullChecks.length > 5) {
    practices.push("Always check for null pointers before dereferencing");
  }

  // Check for const usage
  const constUsage = examples.filter((ex) => {
    return ex.pattern.includes("const");
  });

  if (constUsage.length > 5) {
    practices.push("Use const correctness for immutable references and methods");
  }

  // Check for RAII patterns
  const raiiPatterns = examples.filter((ex) => {
    return ex.context.includes("ObjectGuard") || ex.context.includes("Lock");
  });

  if (raiiPatterns.length > 3) {
    practices.push("Use RAII patterns for resource management (locks, guards, etc.)");
  }

  return practices;
}

/**
 * Find class definition location
 */
export async function findClassDefinition(
  className: string
): Promise<{ file: string; lineNumber: number; definition: string } | null> {
  const pattern = `class\\s+${className}\\s*[:{]`;
  const results = await searchCodebase(pattern, "*.h");

  if (results.length === 0) {
    return null;
  }

  const first = results[0];
  return {
    file: first.file,
    lineNumber: first.lineNumber,
    definition: first.context,
  };
}

/**
 * Find method definition location
 */
export async function findMethodDefinition(
  className: string,
  methodName: string
): Promise<{ file: string; lineNumber: number; definition: string } | null> {
  const pattern = `${className}::${methodName}\\s*\\(`;
  const results = await searchCodebase(pattern, "*.cpp");

  if (results.length === 0) {
    return null;
  }

  const first = results[0];
  return {
    file: first.file,
    lineNumber: first.lineNumber,
    definition: first.context,
  };
}

/**
 * Search for similar APIs
 */
export async function findSimilarAPIs(className: string): Promise<string[]> {
  // Extract base name (remove "Manager", "Handler", etc.)
  const baseName = className
    .replace(/Manager$/, "")
    .replace(/Handler$/, "")
    .replace(/System$/, "")
    .replace(/Controller$/, "");

  const pattern = `class\\s+${baseName}`;
  const results = await searchCodebase(pattern, "*.h");

  const classNames = new Set<string>();
  for (const result of results) {
    const match = result.line.match(/class\s+(\w+)/);
    if (match && match[1] !== className) {
      classNames.add(match[1]);
    }
  }

  return Array.from(classNames).slice(0, 10);
}

/**
 * Get inheritance hierarchy for a class
 */
export async function getInheritanceHierarchy(
  className: string
): Promise<{
  parents: string[];
  children: string[];
}> {
  // Find parent classes
  const parentPattern = `class\\s+${className}\\s*:\\s*public\\s+(\\w+)`;
  const parentResults = await searchCodebase(parentPattern, "*.h");

  const parents: string[] = [];
  for (const result of parentResults) {
    const match = result.line.match(/public\s+(\w+)/g);
    if (match) {
      parents.push(
        ...match.map((m) => m.replace("public ", "").trim())
      );
    }
  }

  // Find child classes
  const childPattern = `class\\s+(\\w+)\\s*:\\s*public\\s+${className}`;
  const childResults = await searchCodebase(childPattern, "*.h");

  const children: string[] = [];
  for (const result of childResults) {
    const match = result.line.match(/class\s+(\w+)/);
    if (match && match[1] !== className) {
      children.push(match[1]);
    }
  }

  return {
    parents: Array.from(new Set(parents)),
    children: Array.from(new Set(children)),
  };
}

/**
 * Find all methods in a class
 */
export async function findClassMethods(
  className: string
): Promise<Array<{ name: string; returnType: string; parameters: string; isConst: boolean }>> {
  // Search for method declarations in header files
  const pattern = `${className}::(\\w+)\\s*\\(`;
  const results = await searchCodebase(pattern, "*.h");

  const methods: Array<{
    name: string;
    returnType: string;
    parameters: string;
    isConst: boolean;
  }> = [];
  const seen = new Set<string>();

  for (const result of results) {
    // Extract method signature
    const match = result.line.match(
      /(\w+(?:\s*\*)?)\s+(\w+)\s*\(([^)]*)\)\s*(const)?/
    );

    if (match) {
      const [, returnType, methodName, parameters, constKeyword] = match;

      const signature = `${methodName}(${parameters})`;
      if (!seen.has(signature)) {
        seen.add(signature);
        methods.push({
          name: methodName,
          returnType: returnType.trim(),
          parameters: parameters.trim(),
          isConst: Boolean(constKeyword),
        });
      }
    }
  }

  return methods;
}

/**
 * Analyze API complexity
 */
export async function analyzeAPIComplexity(
  className: string
): Promise<{
  methodCount: number;
  averageParameters: number;
  publicMethods: number;
  privateMethods: number;
  dependencies: string[];
  complexity: "low" | "medium" | "high" | "very_high";
}> {
  const methods = await findClassMethods(className);

  // Count parameters
  const totalParams = methods.reduce((sum, m) => {
    const paramCount = m.parameters ? m.parameters.split(",").length : 0;
    return sum + paramCount;
  }, 0);

  // Find dependencies (included headers)
  const classDefResult = await findClassDefinition(className);
  const dependencies: string[] = [];

  if (classDefResult) {
    const includeMatches = classDefResult.definition.match(/#include\s+[<"]([^>"]+)[>"]/g);
    if (includeMatches) {
      dependencies.push(
        ...includeMatches.map((inc) => inc.replace(/#include\s+[<"]([^>"]+)[>"]/, "$1"))
      );
    }
  }

  const methodCount = methods.length;
  const averageParameters = methodCount > 0 ? totalParams / methodCount : 0;

  // Determine complexity
  let complexity: "low" | "medium" | "high" | "very_high";
  if (methodCount < 10 && averageParameters < 3) {
    complexity = "low";
  } else if (methodCount < 30 && averageParameters < 5) {
    complexity = "medium";
  } else if (methodCount < 50) {
    complexity = "high";
  } else {
    complexity = "very_high";
  }

  return {
    methodCount,
    averageParameters: Math.round(averageParameters * 10) / 10,
    publicMethods: methodCount, // Simplified - would need more parsing
    privateMethods: 0,
    dependencies,
    complexity,
  };
}

/**
 * Validate TrinityCore path (public export)
 */
export async function validateTrinityCorePathExport(): Promise<boolean> {
  try {
    await validateTrinityCorePathInternal();
    return true;
  } catch {
    return false;
  }
}
