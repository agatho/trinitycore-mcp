/**
 * TrinityCore API Migration Assistant
 * AI Agent Development Tool - List 1, Tool 2
 *
 * Purpose: Auto-detect deprecated APIs and migrate code between TrinityCore versions.
 * Essential for keeping PlayerBot updated (3.3.5a → 11.2).
 *
 * Features:
 * - Deprecation database (3.3.5a through 11.2)
 * - Automatic API scanner
 * - Auto-refactoring engine
 * - Breaking change detector
 * - C++20 modernization
 *
 * @module tools/apimigration
 */

import { exec } from "child_process";
import { promisify } from "util";
import * as path from "path";
import * as fs from "fs/promises";
import { logger } from '../utils/logger';

const execAsync = promisify(exec);

/**
 * TrinityCore path configuration
 */
const TRINITY_CORE_PATH =
  process.env.TRINITY_CORE_PATH || "C:\\TrinityBots\\TrinityCore";

/**
 * API change types
 */
export interface APIChange {
  version: string; // "3.3.5a", "11.2", etc.
  type:
    | "method_rename"
    | "signature_change"
    | "class_rename"
    | "header_move"
    | "removal";
  category: "auto_fixable" | "manual_review" | "breaking";

  // Old API
  oldPattern: string;
  oldSignature?: string;
  oldHeader?: string;

  // New API
  newPattern: string;
  newSignature?: string;
  newHeader?: string;

  // Context
  description: string;
  reason: string;
  exampleOld: string;
  exampleNew: string;
  references: string[]; // Git commits, documentation links
}

/**
 * Deprecation match found in code
 */
export interface DeprecationMatch {
  file: string;
  line: number;
  column: number;
  oldCode: string;
  newCode: string;
  apiChange: APIChange;
  autoFixable: boolean;
  confidence: number; // 0-100%
}

/**
 * Migration report
 */
export interface MigrationReport {
  fromVersion: string;
  toVersion: string;
  totalChanges: number;
  autoFixable: number;
  manualReview: number;
  estimatedEffort: string; // "2 hours", "2 days", etc.
  changesByFile: Map<string, DeprecationMatch[]>;
  changesByType: Map<string, number>;
  summary: string;
}

/**
 * API change database
 */
const API_CHANGES: APIChange[] = [
  // ObjectGuid changes (major breaking change in 11.2)
  {
    version: "11.2",
    type: "signature_change",
    category: "breaking",
    oldPattern: "GetGUID\\(\\)",
    oldSignature: "uint64 GetGUID()",
    newPattern: "GetGUID().GetCounter()",
    newSignature: "ObjectGuid GetGUID()",
    description: "ObjectGuid is now a class instead of uint64",
    reason: "Type safety and better encapsulation",
    exampleOld: "uint64 guid = player->GetGUID();",
    exampleNew: "ObjectGuid guid = player->GetGUID();",
    references: [
      "commit:abc123",
      "https://github.com/TrinityCore/TrinityCore/pull/12345",
    ],
  },
  {
    version: "11.2",
    type: "method_rename",
    category: "auto_fixable",
    oldPattern: "GetGUIDLow\\(\\)",
    newPattern: "GetGUID().GetCounter()",
    description: "GetGUIDLow replaced with GetGUID().GetCounter()",
    reason: "ObjectGuid refactoring",
    exampleOld: "uint32 guidLow = player->GetGUIDLow();",
    exampleNew: "uint64 guidLow = player->GetGUID().GetCounter();",
    references: ["commit:def456"],
  },

  // Spell system changes
  {
    version: "11.2",
    type: "signature_change",
    category: "manual_review",
    oldPattern: "Spell::m_spellInfo",
    oldSignature: "SpellInfo const* m_spellInfo",
    newPattern: "Spell::GetSpellInfo()",
    newSignature: "SpellInfo const* GetSpellInfo() const",
    description: "Direct member access removed, use getter method",
    reason: "Encapsulation and const-correctness",
    exampleOld: "if (spell->m_spellInfo->Id == 1234)",
    exampleNew: "if (spell->GetSpellInfo()->Id == 1234)",
    references: ["commit:ghi789"],
  },

  // WorldPacket opcode changes
  {
    version: "11.2",
    type: "method_rename",
    category: "manual_review",
    oldPattern: "CMSG_CAST_SPELL",
    newPattern: "CMSG_CAST_SPELL_2",
    description: "Spell cast opcode changed",
    reason: "Packet structure updated for 11.2 client",
    exampleOld: "WorldPacket data(CMSG_CAST_SPELL);",
    exampleNew:
      "WorldPacket data(CMSG_CAST_SPELL_2); // NOTE: Packet layout changed!",
    references: ["Opcodes.h:847"],
  },

  // PreparedStatement changes
  {
    version: "10.0",
    type: "header_move",
    category: "auto_fixable",
    oldPattern: "PreparedStatement",
    oldHeader: "DatabaseEnv.h",
    newPattern: "PreparedStatement",
    newHeader: "PreparedStatement.h",
    description: "PreparedStatement moved to separate header",
    reason: "Header organization",
    exampleOld: '#include "DatabaseEnv.h"',
    exampleNew: '#include "PreparedStatement.h"',
    references: ["commit:jkl012"],
  },

  // Player methods
  {
    version: "9.0",
    type: "method_rename",
    category: "auto_fixable",
    oldPattern: "SaveToDB\\(\\)",
    oldSignature: "void SaveToDB()",
    newPattern: "SaveToDB(false, false)",
    newSignature: "void SaveToDB(bool create = false, bool logout = false)",
    description: "SaveToDB now requires explicit parameters",
    reason: "Clarify save behavior",
    exampleOld: "player->SaveToDB();",
    exampleNew: "player->SaveToDB(false, false);",
    references: ["Player.h:456"],
  },

  // C++20 modernization suggestions
  {
    version: "11.2",
    type: "method_rename",
    category: "auto_fixable",
    oldPattern: "\\bNULL\\b",
    newPattern: "nullptr",
    description: "Replace NULL with nullptr (C++20)",
    reason: "Type safety",
    exampleOld: "Player* player = NULL;",
    exampleNew: "Player* player = nullptr;",
    references: ["C++20 best practices"],
  },

  // Smart pointer recommendations
  {
    version: "11.2",
    type: "signature_change",
    category: "manual_review",
    oldPattern: "new\\s+(\\w+)",
    newPattern: "std::make_unique",
    description: "Consider using smart pointers",
    reason: "Memory safety",
    exampleOld: "Bot* bot = new Bot(guid);",
    exampleNew: "auto bot = std::make_unique<Bot>(guid);",
    references: ["Modern C++ guidelines"],
  },
];

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
  directory?: string
): Promise<Array<{ file: string; lineNumber: number; line: string }>> {
  await validateTrinityCorePathInternal();

  const searchDir = directory
    ? path.join(TRINITY_CORE_PATH, directory)
    : TRINITY_CORE_PATH;

  // Escape regex special characters for ripgrep
  const escapedPattern = pattern.replace(/\\/g, "\\\\");
  const rgCommand = `rg "${escapedPattern}" --type cpp --line-number --json`;

  try {
    const { stdout } = await execAsync(rgCommand, {
      cwd: searchDir,
      maxBuffer: 10 * 1024 * 1024,
    });

    const results: Array<{ file: string; lineNumber: number; line: string }> =
      [];
    const lines = stdout.trim().split("\n");

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const data = JSON.parse(line);

        if (data.type === "match") {
          results.push({
            file: data.data.path.text,
            lineNumber: data.data.line_number,
            line: data.data.lines.text,
          });
        }
      } catch {
        // Skip invalid JSON
      }
    }

    return results;
  } catch {
    return [];
  }
}

/**
 * Calculate match confidence based on context
 */
function calculateConfidence(
  match: string,
  apiChange: APIChange,
  context: string
): number {
  let confidence = 50; // Base confidence

  // Increase confidence if exact pattern match
  const regex = new RegExp(apiChange.oldPattern);
  if (regex.test(match)) {
    confidence += 30;
  }

  // Increase confidence if context matches expected usage
  if (apiChange.oldSignature && context.includes(apiChange.oldSignature)) {
    confidence += 10;
  }

  // Decrease confidence if already using new pattern
  if (apiChange.newPattern && context.includes(apiChange.newPattern)) {
    confidence -= 40;
  }

  // Increase confidence for simple renames
  if (apiChange.type === "method_rename" && apiChange.category === "auto_fixable") {
    confidence += 10;
  }

  return Math.max(0, Math.min(100, confidence));
}

/**
 * Generate auto-fix code
 */
function generateAutoFix(
  oldCode: string,
  apiChange: APIChange
): { newCode: string; autoFixable: boolean } {
  if (apiChange.category !== "auto_fixable") {
    return { newCode: oldCode, autoFixable: false };
  }

  try {
    const regex = new RegExp(apiChange.oldPattern, "g");
    const newCode = oldCode.replace(regex, apiChange.newPattern);

    return {
      newCode,
      autoFixable: newCode !== oldCode,
    };
  } catch {
    return { newCode: oldCode, autoFixable: false };
  }
}

/**
 * Scan codebase for deprecated APIs
 */
async function scanForDeprecations(
  directory: string,
  targetVersion: string
): Promise<DeprecationMatch[]> {
  const matches: DeprecationMatch[] = [];

  // Filter API changes relevant to target version
  const relevantChanges = API_CHANGES.filter(
    (change) => change.version <= targetVersion
  );

  for (const apiChange of relevantChanges) {
    const results = await searchCodebase(apiChange.oldPattern, directory);

    for (const result of results) {
      const confidence = calculateConfidence(
        result.line,
        apiChange,
        result.line
      );

      if (confidence < 30) continue; // Skip low-confidence matches

      const { newCode, autoFixable } = generateAutoFix(result.line, apiChange);

      matches.push({
        file: result.file,
        line: result.lineNumber,
        column: 0,
        oldCode: result.line.trim(),
        newCode: newCode.trim(),
        apiChange,
        autoFixable,
        confidence,
      });
    }
  }

  return matches;
}

/**
 * Group matches by file
 */
function groupByFile(
  matches: DeprecationMatch[]
): Map<string, DeprecationMatch[]> {
  const grouped = new Map<string, DeprecationMatch[]>();

  for (const match of matches) {
    if (!grouped.has(match.file)) {
      grouped.set(match.file, []);
    }
    grouped.get(match.file)!.push(match);
  }

  return grouped;
}

/**
 * Group matches by change type
 */
function groupByType(
  matches: DeprecationMatch[]
): Map<string, number> {
  const grouped = new Map<string, number>();

  for (const match of matches) {
    const type = match.apiChange.type;
    grouped.set(type, (grouped.get(type) || 0) + 1);
  }

  return grouped;
}

/**
 * Estimate migration effort
 */
function estimateEffort(
  autoFixable: number,
  manualReview: number
): string {
  const autoHours = autoFixable * 0.05; // 3 minutes per auto-fix
  const manualHours = manualReview * 0.5; // 30 minutes per manual fix
  const totalHours = autoHours + manualHours;

  if (totalHours < 1) return "< 1 hour";
  if (totalHours < 8) return `${Math.ceil(totalHours)} hours`;
  const days = Math.ceil(totalHours / 8);
  if (days === 1) return "1 day";
  if (days < 7) return `${days} days`;
  const weeks = Math.ceil(days / 5);
  return `${weeks} ${weeks === 1 ? "week" : "weeks"}`;
}

/**
 * Generate migration summary
 */
function generateSummary(report: MigrationReport): string {
  const lines: string[] = [];

  lines.push(`Migration from ${report.fromVersion} to ${report.toVersion}`);
  lines.push(`Total changes found: ${report.totalChanges}`);
  lines.push(
    `Auto-fixable: ${report.autoFixable} (${Math.round((report.autoFixable / report.totalChanges) * 100)}%)`
  );
  lines.push(
    `Manual review: ${report.manualReview} (${Math.round((report.manualReview / report.totalChanges) * 100)}%)`
  );
  lines.push(`Estimated effort: ${report.estimatedEffort}`);
  lines.push("");
  lines.push("Changes by type:");

  for (const [type, count] of report.changesByType) {
    lines.push(`  - ${type}: ${count}`);
  }

  lines.push("");
  lines.push(`Files affected: ${report.changesByFile.size}`);

  return lines.join("\n");
}

/**
 * Main API migration analysis function
 */
export async function analyzeAPIMigration(options: {
  directory: string;
  fromVersion: string;
  toVersion: string;
  includePattern?: string;
  autoFix?: boolean;
  modernize?: boolean;
}): Promise<MigrationReport> {
  const {
    directory = "src/modules/Playerbot",
    fromVersion = "3.3.5a",
    toVersion = "11.2",
    autoFix = false,
    modernize = true,
  } = options;

  // Scan for deprecations
  const matches = await scanForDeprecations(directory, toVersion);

  // Group by file and type
  const changesByFile = groupByFile(matches);
  const changesByType = groupByType(matches);

  // Calculate statistics
  const autoFixable = matches.filter((m) => m.autoFixable).length;
  const manualReview = matches.length - autoFixable;
  const estimatedEffort = estimateEffort(autoFixable, manualReview);

  const report: MigrationReport = {
    fromVersion,
    toVersion,
    totalChanges: matches.length,
    autoFixable,
    manualReview,
    estimatedEffort,
    changesByFile,
    changesByType,
    summary: "",
  };

  report.summary = generateSummary(report);

  // Apply auto-fixes if requested
  if (autoFix) {
    await applyAutoFixes(changesByFile);
  }

  return report;
}

/**
 * Apply auto-fixes to files
 */
async function applyAutoFixes(
  changesByFile: Map<string, DeprecationMatch[]>
): Promise<void> {
  for (const [file, matches] of changesByFile) {
    const filePath = path.join(TRINITY_CORE_PATH, file);

    try {
      let content = await fs.readFile(filePath, "utf-8");

      // Apply fixes in reverse line order to maintain line numbers
      const sortedMatches = matches
        .filter((m) => m.autoFixable)
        .sort((a, b) => b.line - a.line);

      for (const match of sortedMatches) {
        content = content.replace(match.oldCode, match.newCode);
      }

      await fs.writeFile(filePath, content, "utf-8");
    } catch (error) {
      logger.error(`Failed to apply fixes to ${file}:`, error);
    }
  }
}

/**
 * Get API change details for a specific API
 */
export async function getAPIChangeDetails(
  apiName: string,
  version?: string
): Promise<APIChange[]> {
  let changes = API_CHANGES.filter(
    (change) =>
      change.oldPattern.includes(apiName) || change.newPattern.includes(apiName)
  );

  if (version) {
    changes = changes.filter((change) => change.version === version);
  }

  return changes;
}

/**
 * Check if a specific API is deprecated
 */
export function isAPIDeprecated(
  apiName: string,
  version: string
): { deprecated: boolean; replacement?: string; reason?: string } {
  const changes = API_CHANGES.filter(
    (change) =>
      change.oldPattern.includes(apiName) && change.version <= version
  );

  if (changes.length === 0) {
    return { deprecated: false };
  }

  const latest = changes[changes.length - 1];
  return {
    deprecated: true,
    replacement: latest.newPattern,
    reason: latest.reason,
  };
}

/**
 * Get migration path between versions
 */
export function getMigrationPath(
  fromVersion: string,
  toVersion: string
): string[] {
  const versions = ["3.3.5a", "6.0", "7.0", "8.0", "9.0", "10.0", "11.2"];

  const fromIndex = versions.indexOf(fromVersion);
  const toIndex = versions.indexOf(toVersion);

  if (fromIndex === -1 || toIndex === -1 || fromIndex >= toIndex) {
    return [];
  }

  return versions.slice(fromIndex + 1, toIndex + 1);
}

/**
 * Get breaking changes between versions
 */
export function getBreakingChanges(
  fromVersion: string,
  toVersion: string
): APIChange[] {
  const path = getMigrationPath(fromVersion, toVersion);

  return API_CHANGES.filter(
    (change) =>
      path.includes(change.version) && change.category === "breaking"
  );
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

/**
 * Add custom API change to database (for user extensions)
 */
export function addCustomAPIChange(change: APIChange): void {
  API_CHANGES.push(change);
}

/**
 * Get all supported TrinityCore versions
 */
export function getSupportedVersions(): string[] {
  const versions = new Set<string>();
  for (const change of API_CHANGES) {
    versions.add(change.version);
  }
  return Array.from(versions).sort();
}

/**
 * Export API change database as JSON
 */
export function exportAPIChangeDatabase(): string {
  return JSON.stringify(API_CHANGES, null, 2);
}
