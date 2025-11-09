/**
 * Thread Safety & Concurrency Analyzer
 * AI Agent Development Tool - List 1, Tool 1
 *
 * Purpose: Detect race conditions, deadlocks, and thread safety violations in C++ code.
 * Critical for PlayerBot 5000-bot production stability.
 *
 * Features:
 * - Lock detection (std::mutex, ACE_Guard, etc.)
 * - Race condition warnings
 * - Deadlock pattern detection
 * - Lock-free alternative suggestions
 * - WorldUpdateTime safety checks
 *
 * @module tools/threadsafety
 */

import { exec } from "child_process";
import { promisify } from "util";
import * as path from "path";
import * as fs from "fs/promises";

const execAsync = promisify(exec);

/**
 * TrinityCore path configuration
 */
const TRINITY_CORE_PATH =
  process.env.TRINITY_CORE_PATH || "";

/**
 * Code location reference
 */
export interface CodeLocation {
  file: string;
  line: number;
  column?: number;
}

/**
 * Thread safety issue
 */
export interface ThreadSafetyIssue {
  type: "race_condition" | "deadlock" | "missing_lock" | "performance";
  severity: "critical" | "high" | "medium" | "low";
  file: string;
  line: number;
  code: string;
  description: string;
  threadContext: string[];
  recommendation: string;
  references: string[]; // Example code locations
}

/**
 * Lock pattern detected in code
 */
export interface LockPattern {
  lockType: string; // std::mutex, ACE_Guard, etc.
  lockName: string;
  acquiredAt: CodeLocation;
  releasedAt: CodeLocation | null;
  scope: "function" | "block" | "class";
  holdDuration: "short" | "medium" | "long";
}

/**
 * Shared resource access tracking
 */
export interface SharedResource {
  name: string;
  type: string;
  accessPoints: Array<{
    file: string;
    line: number;
    operation: "read" | "write";
    hasLock: boolean;
    lockName?: string;
  }>;
  threads: string[]; // Which threads can access this
}

/**
 * Deadlock path analysis
 */
export interface DeadlockPath {
  locks: string[];
  acquisitionOrder: Array<{ lock: string; location: CodeLocation }>;
  circularDependency: boolean;
  suggestedFix: string;
}

/**
 * Thread safety analysis result
 */
export interface ThreadSafetyAnalysis {
  summary: {
    totalIssues: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  issues: ThreadSafetyIssue[];
  lockPatterns: LockPattern[];
  sharedResources: SharedResource[];
  deadlockPaths: DeadlockPath[];
  suggestions: string[];
  safePatternsFound: number;
}

/**
 * Validate TrinityCore path
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
 * Search codebase with ripgrep
 */
async function searchCodebase(
  pattern: string,
  directory?: string,
  contextLines: number = 5
): Promise<
  Array<{ file: string; lineNumber: number; line: string; context: string }>
> {
  await validateTrinityCorePathInternal();

  const searchDir = directory
    ? path.join(TRINITY_CORE_PATH, directory)
    : TRINITY_CORE_PATH;
  const rgCommand = `rg "${pattern}" --type cpp --line-number --context ${contextLines} --json`;

  try {
    const { stdout } = await execAsync(rgCommand, {
      cwd: searchDir,
      maxBuffer: 10 * 1024 * 1024,
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
          if (currentMatch) {
            results.push({
              file: currentMatch.file,
              lineNumber: currentMatch.lineNumber,
              line: currentMatch.line,
              context: contextLines.join("\n"),
            });
          }

          currentMatch = {
            file: data.data.path.text,
            lineNumber: data.data.line_number,
            line: data.data.lines.text,
          };
          contextLines = [data.data.lines.text];
        } else if (data.type === "context" && currentMatch) {
          contextLines.push(data.data.lines.text);
        }
      } catch {
        // Skip invalid JSON
      }
    }

    if (currentMatch) {
      results.push({
        file: currentMatch.file,
        lineNumber: currentMatch.lineNumber,
        line: currentMatch.line,
        context: contextLines.join("\n"),
      });
    }

    return results;
  } catch {
    return [];
  }
}

/**
 * Detect lock patterns in code
 */
async function detectLockPatterns(
  directory?: string
): Promise<LockPattern[]> {
  const lockPatterns: LockPattern[] = [];

  // Search for different lock types
  const lockTypes = [
    { pattern: "std::mutex", type: "std::mutex" },
    { pattern: "std::recursive_mutex", type: "std::recursive_mutex" },
    { pattern: "std::shared_mutex", type: "std::shared_mutex" },
    { pattern: "std::lock_guard", type: "std::lock_guard" },
    { pattern: "std::unique_lock", type: "std::unique_lock" },
    { pattern: "std::shared_lock", type: "std::shared_lock" },
    { pattern: "ACE_Guard", type: "ACE_Guard" },
    { pattern: "ACE_Read_Guard", type: "ACE_Read_Guard" },
    { pattern: "ACE_Write_Guard", type: "ACE_Write_Guard" },
  ];

  for (const lockType of lockTypes) {
    const results = await searchCodebase(lockType.pattern, directory, 10);

    for (const result of results) {
      // Extract lock name from code
      const lockNameMatch = result.line.match(
        /(\w+)\s*[:;=]|<.*?>.*?\b(\w+)\b/
      );
      const lockName = lockNameMatch ? lockNameMatch[1] || lockNameMatch[2] : "unknown";

      // Determine scope based on context
      let scope: "function" | "block" | "class" = "block";
      if (result.context.includes("class ")) {
        scope = "class";
      } else if (result.context.includes("void ") || result.context.includes("bool ")) {
        scope = "function";
      }

      // Estimate hold duration (simple heuristic)
      const linesInContext = result.context.split("\n").length;
      let holdDuration: "short" | "medium" | "long" = "short";
      if (linesInContext > 50) {
        holdDuration = "long";
      } else if (linesInContext > 20) {
        holdDuration = "medium";
      }

      lockPatterns.push({
        lockType: lockType.type,
        lockName,
        acquiredAt: {
          file: result.file,
          line: result.lineNumber,
        },
        releasedAt: null, // Would need more sophisticated analysis
        scope,
        holdDuration,
      });
    }
  }

  return lockPatterns;
}

/**
 * Detect race conditions (shared state access without locks)
 */
async function detectRaceConditions(
  directory?: string
): Promise<ThreadSafetyIssue[]> {
  const issues: ThreadSafetyIssue[] = [];

  // Common race condition patterns
  const racePatterns = [
    {
      pattern: "\\.push_back\\(",
      description: "Vector push_back without lock protection",
      recommendation:
        "Add std::lock_guard before vector modification or use TC::LockedQueue<T>",
    },
    {
      pattern: "\\.insert\\(",
      description: "Container insert without lock protection",
      recommendation:
        "Add std::lock_guard before container modification or use concurrent containers",
    },
    {
      pattern: "\\.erase\\(",
      description: "Container erase without lock protection",
      recommendation:
        "Add std::lock_guard before container modification",
    },
    {
      pattern: "m_\\w+\\s*=\\s*[^;]+;",
      description: "Member variable assignment (potential race)",
      recommendation:
        "Verify thread safety - add lock if accessed from multiple threads",
    },
    {
      pattern: "\\+\\+\\w+[^;]*;",
      description: "Increment operation (potential race)",
      recommendation: "Use std::atomic<T> for simple counters or add lock",
    },
  ];

  for (const racePattern of racePatterns) {
    const results = await searchCodebase(racePattern.pattern, directory, 15);

    for (const result of results) {
      // Check if there's a lock guard in context
      const hasLockGuard =
        result.context.includes("lock_guard") ||
        result.context.includes("unique_lock") ||
        result.context.includes("ACE_Guard");

      if (!hasLockGuard) {
        // Potential race condition
        issues.push({
          type: "race_condition",
          severity: "high",
          file: result.file,
          line: result.lineNumber,
          code: result.line.trim(),
          description: racePattern.description,
          threadContext: [
            "WorldSession threads",
            "Bot AI threads",
            "Update threads",
          ],
          recommendation: racePattern.recommendation,
          references: ["WorldSession.cpp:892", "BotManager.cpp:247"],
        });
      }
    }
  }

  return issues;
}

/**
 * Detect potential deadlocks
 */
async function detectDeadlocks(
  lockPatterns: LockPattern[]
): Promise<DeadlockPath[]> {
  const deadlockPaths: DeadlockPath[] = [];

  // Build lock acquisition graph
  const lockGraph = new Map<string, Set<string>>();

  // Group locks by file to find ordering
  const fileToLocks = new Map<string, LockPattern[]>();
  for (const lock of lockPatterns) {
    const file = lock.acquiredAt.file;
    if (!fileToLocks.has(file)) {
      fileToLocks.set(file, []);
    }
    fileToLocks.get(file)!.push(lock);
  }

  // Detect lock ordering within files
  for (const [file, locks] of fileToLocks) {
    if (locks.length < 2) continue;

    // Sort by line number
    locks.sort((a, b) => a.acquiredAt.line - b.acquiredAt.line);

    // Check for potential lock ordering issues
    for (let i = 0; i < locks.length - 1; i++) {
      const lock1 = locks[i].lockName;
      const lock2 = locks[i + 1].lockName;

      if (!lockGraph.has(lock1)) {
        lockGraph.set(lock1, new Set());
      }
      lockGraph.get(lock1)!.add(lock2);
    }
  }

  // Detect cycles in lock graph (simple DFS)
  const visited = new Set<string>();
  const recStack = new Set<string>();

  function hasCycle(node: string, path: string[]): boolean {
    visited.add(node);
    recStack.add(node);
    path.push(node);

    const neighbors = lockGraph.get(node) || new Set();
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        if (hasCycle(neighbor, path)) return true;
      } else if (recStack.has(neighbor)) {
        // Cycle detected
        const cycleStart = path.indexOf(neighbor);
        const cycleLocks = path.slice(cycleStart);

        deadlockPaths.push({
          locks: cycleLocks,
          acquisitionOrder: cycleLocks.map((lock) => ({
            lock,
            location: { file: "multiple", line: 0 },
          })),
          circularDependency: true,
          suggestedFix: `Enforce consistent lock ordering: always acquire in order ${cycleLocks.join(" -> ")}`,
        });

        return true;
      }
    }

    recStack.delete(node);
    path.pop();
    return false;
  }

  for (const node of lockGraph.keys()) {
    if (!visited.has(node)) {
      hasCycle(node, []);
    }
  }

  return deadlockPaths;
}

/**
 * Suggest lock-free alternatives
 */
function suggestLockFreeAlternatives(
  issues: ThreadSafetyIssue[]
): string[] {
  const suggestions: string[] = [];
  const suggestionSet = new Set<string>();

  for (const issue of issues) {
    if (issue.type === "race_condition") {
      // Check for simple counter patterns
      if (issue.code.includes("++") || issue.code.includes("--")) {
        const suggestion =
          "Consider std::atomic<int> for simple counters instead of mutex-protected int";
        if (!suggestionSet.has(suggestion)) {
          suggestions.push(suggestion);
          suggestionSet.add(suggestion);
        }
      }

      // Check for queue patterns
      if (issue.code.includes("push_back") || issue.code.includes("pop")) {
        const suggestion =
          "Consider TC::LockedQueue<T> or boost::lockfree::queue<T> for producer-consumer patterns";
        if (!suggestionSet.has(suggestion)) {
          suggestions.push(suggestion);
          suggestionSet.add(suggestion);
        }
      }

      // Check for flag patterns
      if (issue.code.match(/m_\w+\s*=\s*(true|false)/)) {
        const suggestion =
          "Consider std::atomic<bool> for simple flags instead of mutex-protected bool";
        if (!suggestionSet.has(suggestion)) {
          suggestions.push(suggestion);
          suggestionSet.add(suggestion);
        }
      }
    }

    if (issue.type === "performance") {
      const suggestion =
        "Hot path detected: Consider redesigning to minimize lock contention or use lock-free algorithms";
      if (!suggestionSet.has(suggestion)) {
        suggestions.push(suggestion);
        suggestionSet.add(suggestion);
      }
    }
  }

  return suggestions;
}

/**
 * Check WorldUpdateTime safety
 */
async function checkWorldUpdateTimeSafety(
  directory?: string
): Promise<ThreadSafetyIssue[]> {
  const issues: ThreadSafetyIssue[] = [];

  // Search for Update() methods
  const updateMethods = await searchCodebase("void.*Update\\(", directory, 20);

  for (const method of updateMethods) {
    // Check for blocking operations
    const blockingPatterns = [
      { pattern: "sleep", desc: "Sleep call in Update()" },
      { pattern: "std::this_thread::sleep", desc: "Sleep call in Update()" },
      { pattern: "WaitFor", desc: "Wait call in Update()" },
      { pattern: "Database.*Query", desc: "Synchronous database query in Update()" },
    ];

    for (const blocking of blockingPatterns) {
      if (method.context.toLowerCase().includes(blocking.pattern.toLowerCase())) {
        issues.push({
          type: "performance",
          severity: "high",
          file: method.file,
          line: method.lineNumber,
          code: method.line.trim(),
          description: `${blocking.desc} - May block world update cycle (target: <50ms)`,
          threadContext: ["World update thread"],
          recommendation:
            "Move blocking operations to async task or defer to next update cycle",
          references: ["WorldUpdateTime documentation", "Update() best practices"],
        });
      }
    }
  }

  return issues;
}

/**
 * Count safe patterns (code following best practices)
 */
function countSafePatterns(
  lockPatterns: LockPattern[],
  issues: ThreadSafetyIssue[]
): number {
  let safeCount = 0;

  // Count RAII lock guards (safe pattern)
  for (const lock of lockPatterns) {
    if (
      lock.lockType.includes("lock_guard") ||
      lock.lockType.includes("unique_lock") ||
      lock.lockType.includes("shared_lock") ||
      lock.lockType.includes("ACE_Guard")
    ) {
      safeCount++;
    }
  }

  // Bonus for short lock hold duration
  for (const lock of lockPatterns) {
    if (lock.holdDuration === "short") {
      safeCount++;
    }
  }

  return safeCount;
}

/**
 * Main thread safety analysis function
 */
export async function analyzeThreadSafety(options: {
  filePath?: string;
  directory?: string;
  includePattern?: string;
  severity?: "critical" | "high" | "medium" | "low";
  checkTypes?: Array<"race_conditions" | "deadlocks" | "performance">;
}): Promise<ThreadSafetyAnalysis> {
  const {
    filePath,
    directory = "src/modules/Playerbot",
    includePattern,
    severity,
    checkTypes = ["race_conditions", "deadlocks", "performance"],
  } = options;

  const allIssues: ThreadSafetyIssue[] = [];
  const lockPatterns: LockPattern[] = [];
  const sharedResources: SharedResource[] = [];
  const deadlockPaths: DeadlockPath[] = [];

  // Detect lock patterns
  const locks = await detectLockPatterns(directory);
  lockPatterns.push(...locks);

  // Detect race conditions
  if (checkTypes.includes("race_conditions")) {
    const raceIssues = await detectRaceConditions(directory);
    allIssues.push(...raceIssues);
  }

  // Detect deadlocks
  if (checkTypes.includes("deadlocks")) {
    const deadlocks = await detectDeadlocks(lockPatterns);
    deadlockPaths.push(...deadlocks);

    // Convert deadlock paths to issues
    for (const deadlock of deadlocks) {
      allIssues.push({
        type: "deadlock",
        severity: "critical",
        file: "multiple files",
        line: 0,
        code: deadlock.locks.join(" -> "),
        description: "Potential deadlock: Circular lock dependency detected",
        threadContext: ["Multiple threads"],
        recommendation: deadlock.suggestedFix,
        references: [],
      });
    }
  }

  // Check world update time safety
  if (checkTypes.includes("performance")) {
    const perfIssues = await checkWorldUpdateTimeSafety(directory);
    allIssues.push(...perfIssues);
  }

  // Filter by severity if specified
  let filteredIssues = allIssues;
  if (severity) {
    const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
    const minSeverity = severityOrder[severity];
    filteredIssues = allIssues.filter(
      (issue) => severityOrder[issue.severity] >= minSeverity
    );
  }

  // Generate suggestions
  const suggestions = suggestLockFreeAlternatives(filteredIssues);

  // Count safe patterns
  const safePatternsFound = countSafePatterns(lockPatterns, filteredIssues);

  // Build summary
  const summary = {
    totalIssues: filteredIssues.length,
    critical: filteredIssues.filter((i) => i.severity === "critical").length,
    high: filteredIssues.filter((i) => i.severity === "high").length,
    medium: filteredIssues.filter((i) => i.severity === "medium").length,
    low: filteredIssues.filter((i) => i.severity === "low").length,
  };

  return {
    summary,
    issues: filteredIssues,
    lockPatterns,
    sharedResources,
    deadlockPaths,
    suggestions,
    safePatternsFound,
  };
}

/**
 * Analyze a single file for thread safety
 */
export async function analyzeFileThreadSafety(
  filePath: string
): Promise<ThreadSafetyAnalysis> {
  // Extract directory from file path
  const dir = path.dirname(filePath);

  return analyzeThreadSafety({
    filePath,
    directory: dir,
  });
}

/**
 * Get thread safety recommendations for a specific issue type
 */
export function getThreadSafetyRecommendations(
  issueType: "race_condition" | "deadlock" | "performance"
): string[] {
  const recommendations: { [key: string]: string[] } = {
    race_condition: [
      "Always protect shared state with std::lock_guard or std::unique_lock",
      "Use std::atomic<T> for simple counters and flags",
      "Consider TC::LockedQueue<T> for thread-safe queues",
      "Document which threads can access each shared resource",
      "Use ThreadSanitizer (TSan) for runtime detection",
    ],
    deadlock: [
      "Enforce consistent lock ordering across all code",
      "Use std::scoped_lock for acquiring multiple locks atomically (C++17)",
      "Avoid nested locks when possible",
      "Use std::try_lock to avoid blocking",
      "Document lock hierarchy in code comments",
    ],
    performance: [
      "Keep critical sections short (<10 lines)",
      "Move expensive operations outside of locks",
      "Use read-write locks (std::shared_mutex) when reads dominate",
      "Consider lock-free algorithms for hot paths",
      "Profile with perf or VTune to identify lock contention",
    ],
  };

  return recommendations[issueType] || [];
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
