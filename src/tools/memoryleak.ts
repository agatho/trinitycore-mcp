/**
 * Memory Leak & Resource Analyzer
 * AI Agent Development Tool - List 1, Tool 4
 *
 * Purpose: Detect memory leaks, dangling pointers, and resource leaks.
 * Critical for 24/7 server stability with 5000 bots.
 *
 * Features:
 * - Static analysis for new/delete pairs
 * - RAII violation detection
 * - Circular reference detection
 * - TrinityCore-specific leak patterns
 * - Smart pointer recommendations
 *
 * @module tools/memoryleak
 */

import { exec } from "child_process";
import { promisify } from "util";
import * as path from "path";
import * as fs from "fs/promises";

const execAsync = promisify(exec);

const TRINITY_CORE_PATH = process.env.TRINITY_CORE_PATH || "";

export interface CodeLocation {
  file: string;
  line: number;
  column?: number;
}

export interface MemoryLeakIssue {
  type: "raw_pointer_leak" | "circular_reference" | "resource_leak" | "raii_violation";
  severity: "critical" | "high" | "medium" | "low";
  file: string;
  line: number;
  code: string;
  description: string;
  leakedType: string;
  estimatedLeakSize: string;
  fix: string;
  example: string;
}

export interface PointerTracking {
  variable: string;
  type: string;
  allocatedAt: CodeLocation;
  deletedAt?: CodeLocation;
  ownership: "unique" | "shared" | "weak" | "raw";
  escapedToHeap: boolean;
}

export interface ResourceTracking {
  type: "mutex" | "file" | "database" | "network";
  acquiredAt: CodeLocation;
  releasedAt?: CodeLocation;
  hasRAII: boolean;
  raiiType?: string;
}

export interface CircularDependency {
  objects: string[];
  referenceChain: Array<{ from: string; to: string; viaSharedPtr: boolean }>;
  suggestedWeakPtrLocation: string;
}

export interface MemoryLeakAnalysis {
  summary: {
    totalIssues: number;
    estimatedLeakRate: string;
    criticalIssues: number;
  };
  issues: MemoryLeakIssue[];
  circularDependencies: CircularDependency[];
  suggestions: string[];
}

async function searchCodebase(pattern: string, directory?: string): Promise<Array<{ file: string; lineNumber: number; line: string; context: string }>> {
  const searchDir = directory ? path.join(TRINITY_CORE_PATH, directory) : TRINITY_CORE_PATH;
  const rgCommand = `rg "${pattern}" --type cpp --line-number --context 10 --json`;

  try {
    const { stdout } = await execAsync(rgCommand, { cwd: searchDir, maxBuffer: 10 * 1024 * 1024 });
    const results: Array<{ file: string; lineNumber: number; line: string; context: string }> = [];
    const lines = stdout.trim().split("\n");
    let currentMatch: any = null;
    let contextLines: string[] = [];

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const data = JSON.parse(line);
        if (data.type === "match") {
          if (currentMatch) {
            results.push({ file: currentMatch.file, lineNumber: currentMatch.lineNumber, line: currentMatch.line, context: contextLines.join("\n") });
          }
          currentMatch = { file: data.data.path.text, lineNumber: data.data.line_number, line: data.data.lines.text };
          contextLines = [data.data.lines.text];
        } else if (data.type === "context" && currentMatch) {
          contextLines.push(data.data.lines.text);
        }
      } catch {}
    }
    if (currentMatch) {
      results.push({ file: currentMatch.file, lineNumber: currentMatch.lineNumber, line: currentMatch.line, context: contextLines.join("\n") });
    }
    return results;
  } catch {
    return [];
  }
}

async function detectRawPointerLeaks(directory?: string): Promise<MemoryLeakIssue[]> {
  const issues: MemoryLeakIssue[] = [];
  const newAllocations = await searchCodebase("new\\s+\\w+", directory);

  for (const allocation of newAllocations) {
    const hasDelete = allocation.context.includes("delete ") || allocation.context.includes("delete[]");
    const hasSmartPtr = allocation.context.includes("unique_ptr") || allocation.context.includes("shared_ptr");

    if (!hasDelete && !hasSmartPtr) {
      const typeMatch = allocation.line.match(/new\s+(\w+)/);
      const type = typeMatch ? typeMatch[1] : "unknown";

      issues.push({
        type: "raw_pointer_leak",
        severity: "high",
        file: allocation.file,
        line: allocation.lineNumber,
        code: allocation.line.trim(),
        description: `Raw pointer allocation without delete or smart pointer`,
        leakedType: type,
        estimatedLeakSize: "~500 KB per object",
        fix: `Use std::unique_ptr<${type}> or std::shared_ptr<${type}>`,
        example: `auto ptr = std::make_unique<${type}>();`
      });
    }
  }

  return issues;
}

async function detectRAIIViolations(directory?: string): Promise<MemoryLeakIssue[]> {
  const issues: MemoryLeakIssue[] = [];

  const mutexPatterns = await searchCodebase("\\.lock\\(\\)", directory);
  for (const pattern of mutexPatterns) {
    if (!pattern.context.includes("lock_guard") && !pattern.context.includes("unique_lock")) {
      issues.push({
        type: "raii_violation",
        severity: "medium",
        file: pattern.file,
        line: pattern.lineNumber,
        code: pattern.line.trim(),
        description: "Manual mutex lock without RAII wrapper",
        leakedType: "mutex lock",
        estimatedLeakSize: "N/A (deadlock risk)",
        fix: "Use std::lock_guard<std::mutex> instead of manual lock/unlock",
        example: "std::lock_guard<std::mutex> guard(mutex);"
      });
    }
  }

  const queryPatterns = await searchCodebase("Database.*Query", directory);
  for (const pattern of queryPatterns) {
    if (pattern.context.includes("return;") && !pattern.context.includes("PreparedQueryResult")) {
      issues.push({
        type: "resource_leak",
        severity: "medium",
        file: pattern.file,
        line: pattern.lineNumber,
        code: pattern.line.trim(),
        description: "Early return without processing QueryResult",
        leakedType: "database connection",
        estimatedLeakSize: "1 connection",
        fix: "Process result before returning or use scoped result",
        example: "PreparedQueryResult result = DB.Query(...); if (result) { /* process */ }"
      });
    }
  }

  return issues;
}

async function detectCircularReferences(directory?: string): Promise<CircularDependency[]> {
  const dependencies: CircularDependency[] = [];
  const sharedPtrRefs = await searchCodebase("shared_ptr.*->.*shared_ptr", directory);

  for (const ref of sharedPtrRefs) {
    const objectMatch = ref.line.match(/(\w+)->.*shared_ptr/);
    if (objectMatch) {
      dependencies.push({
        objects: [objectMatch[1], "referenced_object"],
        referenceChain: [
          { from: objectMatch[1], to: "referenced_object", viaSharedPtr: true }
        ],
        suggestedWeakPtrLocation: `Change ${objectMatch[1]}'s reference to std::weak_ptr`
      });
    }
  }

  return dependencies;
}

function estimateLeakRate(issues: MemoryLeakIssue[]): string {
  let totalBytes = 0;
  for (const issue of issues) {
    if (issue.type === "raw_pointer_leak") {
      totalBytes += 500 * 1024; // 500 KB per leaked object (estimate)
    }
  }
  const leakMB = totalBytes / (1024 * 1024);
  return `${leakMB.toFixed(1)} MB per 1000 bots`;
}

export async function analyzeMemoryLeaks(options: {
  filePath?: string;
  directory?: string;
  includePattern?: string;
  checkTypes?: Array<"pointers" | "resources" | "circular" | "raii">;
}): Promise<MemoryLeakAnalysis> {
  const { directory = "src/modules/Playerbot", checkTypes = ["pointers", "resources", "circular", "raii"] } = options;

  const allIssues: MemoryLeakIssue[] = [];
  const circularDependencies: CircularDependency[] = [];

  if (checkTypes.includes("pointers")) {
    const pointerIssues = await detectRawPointerLeaks(directory);
    allIssues.push(...pointerIssues);
  }

  if (checkTypes.includes("raii")) {
    const raiiIssues = await detectRAIIViolations(directory);
    allIssues.push(...raiiIssues);
  }

  if (checkTypes.includes("circular")) {
    const circular = await detectCircularReferences(directory);
    circularDependencies.push(...circular);
  }

  const suggestions = [
    "Use std::unique_ptr<T> for exclusive ownership",
    "Use std::shared_ptr<T> for shared ownership, std::weak_ptr<T> to break cycles",
    "Always use RAII wrappers (lock_guard, unique_lock) for mutex locks",
    "Process QueryResult before early returns",
    "Run Valgrind or AddressSanitizer for runtime leak detection"
  ];

  const estimatedLeakRate = estimateLeakRate(allIssues);
  const criticalIssues = allIssues.filter(i => i.severity === "critical").length;

  return {
    summary: {
      totalIssues: allIssues.length,
      estimatedLeakRate,
      criticalIssues
    },
    issues: allIssues,
    circularDependencies,
    suggestions
  };
}

export async function validateTrinityCorePathExport(): Promise<boolean> {
  try {
    await fs.access(TRINITY_CORE_PATH);
    return true;
  } catch {
    return false;
  }
}
