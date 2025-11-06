/**
 * Trinity Rule Engine - Main Rule Execution System
 * Priority #4: AI-Powered Code Review
 *
 * Coordinates execution of 1,000+ code review rules across 7 categories
 * Performance target: <30s for 500-line diff, >90% accuracy, <15% FP rate
 */

import * as os from 'os';
import {
  CodeReviewRule,
  RuleCategory,
  RuleViolation,
  CodeContext,
  AST,
  IssueSeverity,
} from './types.js';
import { logger } from '../utils/logger.js';

// Import rule categories
import { NULL_SAFETY_RULES } from './rules/NullSafetyRules.js';
import { MEMORY_RULES } from './rules/MemoryRules.js';
import { CONCURRENCY_RULES } from './rules/ConcurrencyRules.js';
import { CONVENTION_RULES } from './rules/ConventionRules.js';
import { SECURITY_RULES } from './rules/SecurityRules.js';
import { PERFORMANCE_RULES } from './rules/PerformanceRules.js';
import { ARCHITECTURE_RULES } from './rules/ArchitectureRules.js';

// ============================================================================
// RULE DATABASE
// ============================================================================

/**
 * Complete rule database
 * Total: 870 rules (87% of 1,000 target)
 * All 7 categories fully implemented:
 * - Null Safety: 220 rules (110% of 200 target)
 * - Memory Management: 150 rules (100% of 150 target)
 * - Concurrency: 100 rules (100% of 100 target)
 * - Convention: 250 rules (100% of 250 target)
 * - Security: 150 rules (100% of 150 target)
 * - Performance: 100 rules (100% of 100 target)
 * - Architecture: 50 rules (100% of 50 target)
 */
export const ALL_RULES: Map<RuleCategory, CodeReviewRule[]> = new Map([
  ['null_safety', NULL_SAFETY_RULES],        // 220 rules ✅ COMPLETE
  ['memory', MEMORY_RULES],                  // 150 rules ✅ COMPLETE
  ['concurrency', CONCURRENCY_RULES],        // 100 rules ✅ COMPLETE
  ['convention', CONVENTION_RULES],          // 250 rules ✅ COMPLETE
  ['security', SECURITY_RULES],              // 150 rules ✅ COMPLETE
  ['performance', PERFORMANCE_RULES],        // 100 rules ✅ COMPLETE
  ['architecture', ARCHITECTURE_RULES],      //  50 rules ✅ COMPLETE
]);

/**
 * Get total rule count across all categories
 */
export function getTotalRuleCount(): number {
  let total = 0;
  for (const rules of ALL_RULES.values()) {
    total += rules.length;
  }
  return total;
}

/**
 * Get rules by category
 */
export function getRulesByCategory(category: RuleCategory): CodeReviewRule[] {
  return ALL_RULES.get(category) || [];
}

/**
 * Get rules by severity
 */
export function getRulesBySeverity(severity: IssueSeverity): CodeReviewRule[] {
  const rules: CodeReviewRule[] = [];
  for (const categoryRules of ALL_RULES.values()) {
    rules.push(...categoryRules.filter((r) => r.severity === severity));
  }
  return rules;
}

/**
 * Get TrinityCore-specific rules only
 */
export function getTrinitySpecificRules(): CodeReviewRule[] {
  const rules: CodeReviewRule[] = [];
  for (const categoryRules of ALL_RULES.values()) {
    rules.push(...categoryRules.filter((r) => r.trinitySpecific));
  }
  return rules;
}

/**
 * Get rule by ID
 */
export function getRuleById(ruleId: string): CodeReviewRule | undefined {
  for (const categoryRules of ALL_RULES.values()) {
    const rule = categoryRules.find((r) => r.id === ruleId);
    if (rule) return rule;
  }
  return undefined;
}

// ============================================================================
// RULE ENGINE
// ============================================================================

/**
 * Rule execution options
 */
export interface RuleEngineOptions {
  // Filters
  categories?: RuleCategory[]; // Only run rules in these categories
  severity?: IssueSeverity | IssueSeverity[]; // Only run rules with this severity
  trinitySpecificOnly?: boolean; // Only run TrinityCore-specific rules
  enabledOnly?: boolean; // Only run enabled rules (default: true)

  // Performance
  maxConcurrent?: number; // Max concurrent rule executions (default: CPU cores)
  timeout?: number; // Timeout per rule in ms (default: 5000)

  // Confidence thresholds
  minConfidence?: number; // Min confidence to report violation (0.0-1.0, default: 0.5)

  // Caching
  enableCache?: boolean; // Cache rule results (default: true)
  cacheKey?: string; // Custom cache key (default: file hash)
}

/**
 * Rule execution result
 */
export interface RuleEngineResult {
  violations: RuleViolation[];
  executedRules: number;
  skippedRules: number;
  failedRules: RuleExecutionError[];
  executionTime: number; // milliseconds
  performance: {
    avgRuleTime: number;
    slowestRule: { id: string; time: number };
    fastestRule: { id: string; time: number };
  };
}

/**
 * Rule execution error
 */
export interface RuleExecutionError {
  ruleId: string;
  error: string;
  stackTrace?: string;
}

/**
 * Trinity Rule Engine
 * Executes code review rules against AST and context
 */
export class TrinityRuleEngine {
  private rules: CodeReviewRule[];
  private cache: Map<string, RuleViolation[]>;

  constructor(options?: { rules?: CodeReviewRule[] }) {
    // Load all rules by default, or use provided rules
    this.rules = options?.rules || this.loadAllRules();
    this.cache = new Map();

    logger.info(`Trinity Rule Engine initialized with ${this.rules.length} rules`);
    logger.info(`Rule distribution: ${this.getRuleDistribution()}`);
  }

  /**
   * Load all rules from all categories
   */
  private loadAllRules(): CodeReviewRule[] {
    const rules: CodeReviewRule[] = [];
    for (const categoryRules of ALL_RULES.values()) {
      rules.push(...categoryRules);
    }
    return rules;
  }

  /**
   * Get rule distribution by category
   */
  private getRuleDistribution(): string {
    const dist: Record<RuleCategory, number> = {
      null_safety: 0,
      memory: 0,
      concurrency: 0,
      convention: 0,
      security: 0,
      performance: 0,
      architecture: 0,
    };

    for (const rule of this.rules) {
      dist[rule.category]++;
    }

    return Object.entries(dist)
      .map(([cat, count]) => `${cat}=${count}`)
      .join(', ');
  }

  /**
   * Execute rules against AST and context
   * Main entry point for rule execution
   */
  async executeRules(
    ast: AST,
    context: CodeContext,
    options?: RuleEngineOptions
  ): Promise<RuleEngineResult> {
    const startTime = performance.now();

    logger.info(`\n🔍 executeRules() CALLED for file: ${context.file}`);
    logger.info(`   Total rules loaded: ${this.rules.length}`);
    logger.info(`   AST root.raw length: ${ast.root.raw.length} chars`);
    logger.info(`   AST has ${ast.classes.length} classes, ${ast.functions.length} functions, ${ast.variables.length} variables`);

    // Apply filters to get rules to execute
    const rulesToExecute = this.filterRules(options);

    logger.info(`   Rules after filtering: ${rulesToExecute.length}`);

    // Check cache if enabled
    const cacheKey = options?.cacheKey || this.generateCacheKey(context.file, ast);
    if (options?.enableCache !== false && this.cache.has(cacheKey)) {
      logger.info(`Cache hit for ${context.file}`);
      return {
        violations: this.cache.get(cacheKey)!,
        executedRules: 0,
        skippedRules: rulesToExecute.length,
        failedRules: [],
        executionTime: performance.now() - startTime,
        performance: {
          avgRuleTime: 0,
          slowestRule: { id: '', time: 0 },
          fastestRule: { id: '', time: 0 },
        },
      };
    }

    // Execute rules (parallel or sequential based on maxConcurrent)
    logger.info(`   Calling executeRulesInternal()...`);
    const { violations, failed, ruleTimes } = await this.executeRulesInternal(
      rulesToExecute,
      ast,
      context,
      options
    );

    logger.info(`   Raw violations found: ${violations.length}`);
    logger.info(`   Failed rules: ${failed.length}`);

    // Filter violations by confidence threshold
    const minConfidence = options?.minConfidence ?? 0.5;
    const filteredViolations = violations.filter((v) => v.confidence >= minConfidence);

    logger.info(`   After confidence filter (>=${minConfidence}): ${filteredViolations.length}`);

    // Cache results
    if (options?.enableCache !== false) {
      this.cache.set(cacheKey, filteredViolations);
    }

    const executionTime = performance.now() - startTime;

    // Calculate performance metrics
    const performanceMetrics = this.calculatePerformanceMetrics(ruleTimes);

    return {
      violations: filteredViolations,
      executedRules: rulesToExecute.length,
      skippedRules: this.rules.length - rulesToExecute.length,
      failedRules: failed,
      executionTime,
      performance: performanceMetrics,
    };
  }

  /**
   * Filter rules based on options
   */
  private filterRules(options?: RuleEngineOptions): CodeReviewRule[] {
    let filtered = [...this.rules];

    // Filter by enabled status
    if (options?.enabledOnly !== false) {
      filtered = filtered.filter((r) => r.enabled);
    }

    // Filter by categories
    if (options?.categories) {
      filtered = filtered.filter((r) => options.categories!.includes(r.category));
    }

    // Filter by severity
    if (options?.severity) {
      const severities = Array.isArray(options.severity)
        ? options.severity
        : [options.severity];
      filtered = filtered.filter((r) => severities.includes(r.severity));
    }

    // Filter by TrinityCore-specific
    if (options?.trinitySpecificOnly) {
      filtered = filtered.filter((r) => r.trinitySpecific);
    }

    // Sort by priority (highest first)
    filtered.sort((a, b) => b.priority - a.priority);

    return filtered;
  }

  /**
   * Execute rules (internal implementation)
   */
  private async executeRulesInternal(
    rules: CodeReviewRule[],
    ast: AST,
    context: CodeContext,
    options?: RuleEngineOptions
  ): Promise<{
    violations: RuleViolation[];
    failed: RuleExecutionError[];
    ruleTimes: Map<string, number>;
  }> {
    logger.info(`\n   📋 executeRulesInternal() processing ${rules.length} rules`);

    const violations: RuleViolation[] = [];
    const failed: RuleExecutionError[] = [];
    const ruleTimes = new Map<string, number>();

    const maxConcurrent = options?.maxConcurrent ?? require('os').cpus().length;
    const timeout = options?.timeout ?? 5000;

    logger.info(`      Max concurrent: ${maxConcurrent}, Timeout: ${timeout}ms`);

    if (maxConcurrent === 1) {
      // Sequential execution
      logger.info(`      Using SEQUENTIAL execution`);
      for (const rule of rules) {
        const result = await this.executeRule(rule, ast, context, timeout);
        ruleTimes.set(rule.id, result.time);

        if (result.error) {
          failed.push({ ruleId: rule.id, error: result.error });
          logger.info(`      ❌ Rule ${rule.id} failed: ${result.error}`);
        } else {
          violations.push(...result.violations);
          if (result.violations.length > 0) {
            logger.info(`      ✓ Rule ${rule.id} found ${result.violations.length} violation(s)`);
          }
        }
      }
    } else {
      // Parallel execution (chunked to avoid overwhelming CPU)
      logger.info(`      Using PARALLEL execution (chunks of ${maxConcurrent})`);
      for (let i = 0; i < rules.length; i += maxConcurrent) {
        const chunk = rules.slice(i, i + maxConcurrent);
        logger.info(`      Processing chunk ${Math.floor(i/maxConcurrent) + 1}: ${chunk.length} rules`);

        const promises = chunk.map((rule) =>
          this.executeRule(rule, ast, context, timeout)
        );

        const results = await Promise.all(promises);

        for (let j = 0; j < results.length; j++) {
          const result = results[j];
          const rule = chunk[j];
          ruleTimes.set(rule.id, result.time);

          if (result.error) {
            failed.push({ ruleId: rule.id, error: result.error });
            logger.info(`      ❌ Rule ${rule.id} failed: ${result.error}`);
          } else {
            violations.push(...result.violations);
            if (result.violations.length > 0) {
              logger.info(`      ✓ Rule ${rule.id} found ${result.violations.length} violation(s)`);
            }
          }
        }
      }
    }

    logger.info(`\n   📊 executeRulesInternal() completed: ${violations.length} violations, ${failed.length} failures`);
    return { violations, failed, ruleTimes };
  }

  /**
   * Execute a single rule
   */
  private async executeRule(
    rule: CodeReviewRule,
    ast: AST,
    context: CodeContext,
    timeout: number
  ): Promise<{
    violations: RuleViolation[];
    time: number;
    error?: string;
  }> {
    const startTime = performance.now();

    try {
      // Create timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Rule execution timeout')), timeout);
      });

      // Execute rule detector
      const detectPromise = Promise.resolve(rule.detector(ast, context));

      // Race between detection and timeout
      const violations = await Promise.race([detectPromise, timeoutPromise]);

      // Enrich violations with metadata
      const enrichedViolations = violations.map((v) => ({
        ...v,
        ruleId: rule.id,
        confidence: this.calculateConfidence(v, rule, context),
        metadata: {
          detectedBy: 'rule_engine' as const,
          category: rule.category,
          priority: rule.priority,
        },
      }));

      return {
        violations: enrichedViolations,
        time: performance.now() - startTime,
      };
    } catch (error: any) {
      return {
        violations: [],
        time: performance.now() - startTime,
        error: error.message || 'Unknown error',
      };
    }
  }

  /**
   * Calculate confidence score for violation
   * Adjusts base rule confidence based on context factors
   */
  private calculateConfidence(
    violation: RuleViolation,
    rule: CodeReviewRule,
    context: CodeContext
  ): number {
    let confidence = rule.confidence;

    // Boost confidence for TrinityCore-specific rules in TrinityCore codebases
    if (rule.trinitySpecific && context.isTrinityCore) {
      confidence *= 1.1;
    }

    // Reduce confidence for low-priority rules
    if (rule.priority < 50) {
      confidence *= 0.9;
    }

    // Cap confidence at 1.0
    return Math.min(1.0, confidence);
  }

  /**
   * Calculate performance metrics
   */
  private calculatePerformanceMetrics(ruleTimes: Map<string, number>): {
    avgRuleTime: number;
    slowestRule: { id: string; time: number };
    fastestRule: { id: string; time: number };
  } {
    if (ruleTimes.size === 0) {
      return {
        avgRuleTime: 0,
        slowestRule: { id: '', time: 0 },
        fastestRule: { id: '', time: 0 },
      };
    }

    let totalTime = 0;
    let slowest = { id: '', time: 0 };
    let fastest = { id: '', time: Infinity };

    for (const [id, time] of ruleTimes.entries()) {
      totalTime += time;

      if (time > slowest.time) {
        slowest = { id, time };
      }

      if (time < fastest.time) {
        fastest = { id, time };
      }
    }

    return {
      avgRuleTime: totalTime / ruleTimes.size,
      slowestRule: slowest,
      fastestRule: fastest.time === Infinity ? { id: '', time: 0 } : fastest,
    };
  }

  /**
   * Generate cache key for file + AST
   */
  private generateCacheKey(file: string, ast: AST): string {
    // Simple hash based on file path and node count
    return `${file}-${ast.metadata.nodeCount}-${ast.metadata.linesOfCode}`;
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache size
   */
  getCacheSize(): number {
    return this.cache.size;
  }

  /**
   * Get statistics about rules
   */
  getStatistics(): {
    totalRules: number;
    enabledRules: number;
    disabledRules: number;
    byCategory: Record<RuleCategory, number>;
    bySeverity: Record<IssueSeverity, number>;
    trinitySpecific: number;
  } {
    const byCategory: Record<RuleCategory, number> = {
      null_safety: 0,
      memory: 0,
      concurrency: 0,
      convention: 0,
      security: 0,
      performance: 0,
      architecture: 0,
    };

    const bySeverity: Record<IssueSeverity, number> = {
      critical: 0,
      major: 0,
      minor: 0,
      info: 0,
    };

    let enabledCount = 0;
    let trinitySpecificCount = 0;

    for (const rule of this.rules) {
      byCategory[rule.category]++;
      bySeverity[rule.severity]++;

      if (rule.enabled) enabledCount++;
      if (rule.trinitySpecific) trinitySpecificCount++;
    }

    return {
      totalRules: this.rules.length,
      enabledRules: enabledCount,
      disabledRules: this.rules.length - enabledCount,
      byCategory,
      bySeverity,
      trinitySpecific: trinitySpecificCount,
    };
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export * from './rules/NullSafetyRules.js';
export * from './rules/MemoryRules.js';
export * from './rules/ConcurrencyRules.js';
export * from './rules/ConventionRules.js';
export * from './rules/SecurityRules.js';
export * from './rules/PerformanceRules.js';
export * from './rules/ArchitectureRules.js';
