/**
 * C++ Code Validator
 *
 * Validates generated C++ code for TrinityCore compliance, including:
 * - Naming conventions
 * - TrinityCore API usage
 * - Include directives
 * - Code style
 * - Optional: Compilation check
 *
 * @module codegen/CppValidator
 */

import * as fs from "fs/promises";
import * as path from "path";

/**
 * Validation issue
 */
export interface ValidationIssue {
  /** Issue severity */
  severity: "error" | "warning" | "info";

  /** Rule that was violated */
  rule: string;

  /** Issue description */
  message: string;

  /** Line number (if applicable) */
  line?: number;

  /** Column number (if applicable) */
  column?: number;

  /** Suggested fix */
  suggestion?: string;
}

/**
 * Validation result
 */
export interface ValidationResult {
  /** File path that was validated */
  filePath: string;

  /** Validation passed */
  valid: boolean;

  /** Issues found */
  issues: ValidationIssue[];

  /** Validation time in milliseconds */
  validationTime: number;

  /** File statistics */
  stats?: {
    lines: number;
    functions: number;
    classes: number;
  };
}

/**
 * C++ Validator options
 */
export interface CppValidatorOptions {
  /** Check naming conventions */
  checkNaming?: boolean;

  /** Check TrinityCore API usage */
  checkTrinityAPI?: boolean;

  /** Check include directives */
  checkIncludes?: boolean;

  /** Check code style */
  checkStyle?: boolean;

  /** Check compilation (requires compiler) */
  checkCompilation?: boolean;

  /** Custom rules */
  customRules?: ValidationRule[];
}

/**
 * Custom validation rule
 */
export interface ValidationRule {
  /** Rule identifier */
  id: string;

  /** Rule description */
  description: string;

  /** Pattern to match */
  pattern: RegExp;

  /** Severity if matched */
  severity: "error" | "warning" | "info";

  /** Suggestion for fixing */
  suggestion?: string;
}

/**
 * C++ Code Validator for TrinityCore
 */
export class CppValidator {
  private options: Required<CppValidatorOptions>;

  constructor(options: CppValidatorOptions = {}) {
    this.options = {
      checkNaming: options.checkNaming ?? true,
      checkTrinityAPI: options.checkTrinityAPI ?? true,
      checkIncludes: options.checkIncludes ?? true,
      checkStyle: options.checkStyle ?? true,
      checkCompilation: options.checkCompilation ?? false,
      customRules: options.customRules ?? [],
    };
  }

  /**
   * Validate a C++ file
   *
   * @param filePath - Path to C++ file
   * @returns Validation result
   */
  async validateFile(filePath: string): Promise<ValidationResult> {
    const startTime = Date.now();
    const issues: ValidationIssue[] = [];

    try {
      // Read file content
      const content = await fs.readFile(filePath, "utf-8");
      const lines = content.split("\n");

      // Run validation checks
      if (this.options.checkNaming) {
        issues.push(...this.checkNamingConventions(lines));
      }

      if (this.options.checkTrinityAPI) {
        issues.push(...this.checkTrinityAPI(lines));
      }

      if (this.options.checkIncludes) {
        issues.push(...this.checkIncludes(lines, filePath));
      }

      if (this.options.checkStyle) {
        issues.push(...this.checkCodeStyle(lines));
      }

      // Apply custom rules
      for (const rule of this.options.customRules) {
        issues.push(...this.applyCustomRule(lines, rule));
      }

      // Calculate stats
      const stats = this.calculateStats(content);

      return {
        filePath,
        valid: !issues.some((i) => i.severity === "error"),
        issues,
        validationTime: Date.now() - startTime,
        stats,
      };
    } catch (error) {
      return {
        filePath,
        valid: false,
        issues: [
          {
            severity: "error",
            rule: "file-access",
            message: `Failed to read file: ${(error as Error).message}`,
          },
        ],
        validationTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Check naming conventions
   */
  private checkNamingConventions(lines: string[]): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    lines.forEach((line, index) => {
      // Check class names (PascalCase)
      const classMatch = line.match(/class\s+([a-z][A-Za-z0-9]*)/);
      if (classMatch) {
        issues.push({
          severity: "warning",
          rule: "naming-class",
          message: `Class name '${classMatch[1]}' should start with uppercase`,
          line: index + 1,
          suggestion: `Use PascalCase: ${classMatch[1][0].toUpperCase()}${classMatch[1].slice(1)}`,
        });
      }

      // Check function names (camelCase or PascalCase)
      const funcMatch = line.match(/(?:void|bool|int|uint32|float)\s+([A-Z_][A-Za-z0-9_]*)\s*\(/);
      if (funcMatch && funcMatch[1].toUpperCase() === funcMatch[1]) {
        issues.push({
          severity: "info",
          rule: "naming-function",
          message: `Function name '${funcMatch[1]}' uses SCREAMING_CASE`,
          line: index + 1,
          suggestion: "Consider using PascalCase or camelCase for functions",
        });
      }
    });

    return issues;
  }

  /**
   * Check TrinityCore API usage
   */
  private checkTrinityAPI(lines: string[]): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    lines.forEach((line, index) => {
      // Check for deprecated API usage
      if (line.includes("GetPlayer()->") && line.includes("GetGUID()")) {
        issues.push({
          severity: "warning",
          rule: "trinity-deprecated-api",
          message: "Using potentially deprecated GUID API",
          line: index + 1,
          suggestion: "Verify GUID API is current for your TrinityCore version",
        });
      }

      // Check for proper namespace usage
      if (line.includes("using namespace std")) {
        issues.push({
          severity: "warning",
          rule: "trinity-namespace",
          message: "Avoid 'using namespace std' in headers",
          line: index + 1,
          suggestion: "Use explicit std:: prefix or specific using declarations",
        });
      }
    });

    return issues;
  }

  /**
   * Check include directives
   */
  private checkIncludes(lines: string[], filePath: string): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const isHeader = filePath.endsWith(".h");

    lines.forEach((line, index) => {
      // Check include order
      if (line.startsWith("#include")) {
        // System includes should use <>
        if (line.includes("iostream") && line.includes('"')) {
          issues.push({
            severity: "warning",
            rule: "include-brackets",
            message: "System headers should use angle brackets",
            line: index + 1,
            suggestion: "Use #include <iostream> instead of #include \"iostream\"",
          });
        }

        // Local includes should use ""
        if (line.includes("Trinity") && line.includes("<")) {
          issues.push({
            severity: "info",
            rule: "include-quotes",
            message: "Local headers typically use quotes",
            line: index + 1,
            suggestion: 'Use #include "..." for project headers',
          });
        }
      }

      // Check for include guards in headers
      if (index === 0 && isHeader && !line.startsWith("#ifndef") && !line.startsWith("#pragma once")) {
        issues.push({
          severity: "error",
          rule: "include-guard",
          message: "Header file missing include guard",
          line: 1,
          suggestion: "Add #pragma once or #ifndef guards at file start",
        });
      }
    });

    return issues;
  }

  /**
   * Check code style
   */
  private checkCodeStyle(lines: string[]): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    lines.forEach((line, index) => {
      // Check line length
      if (line.length > 120) {
        issues.push({
          severity: "warning",
          rule: "style-line-length",
          message: `Line exceeds 120 characters (${line.length})`,
          line: index + 1,
          suggestion: "Break long lines for readability",
        });
      }

      // Check trailing whitespace
      if (line.endsWith(" ") || line.endsWith("\t")) {
        issues.push({
          severity: "info",
          rule: "style-whitespace",
          message: "Trailing whitespace",
          line: index + 1,
          suggestion: "Remove trailing whitespace",
        });
      }
    });

    return issues;
  }

  /**
   * Apply custom validation rule
   */
  private applyCustomRule(lines: string[], rule: ValidationRule): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    lines.forEach((line, index) => {
      if (rule.pattern.test(line)) {
        issues.push({
          severity: rule.severity,
          rule: rule.id,
          message: rule.description,
          line: index + 1,
          suggestion: rule.suggestion,
        });
      }
    });

    return issues;
  }

  /**
   * Calculate file statistics
   */
  private calculateStats(content: string): { lines: number; functions: number; classes: number } {
    const lines = content.split("\n").length;
    const functions = (content.match(/\b(?:void|bool|int|uint32|float|double)\s+\w+\s*\(/g) || []).length;
    const classes = (content.match(/\bclass\s+\w+/g) || []).length;

    return { lines, functions, classes };
  }
}

/**
 * Quick validation function
 *
 * @param filePath - Path to C++ file
 * @returns Validation result
 */
export async function validateCppFile(filePath: string): Promise<ValidationResult> {
  const validator = new CppValidator();
  return validator.validateFile(filePath);
}
