/**
 * Performance Analysis Tools for Playerbot Development
 * Phase 5 - Week 4: Performance Analysis & Optimization
 */

import { PerformanceAnalyzer, MetricsOptions, MetricsSnapshot, PerformanceReport } from '../performance/PerformanceAnalyzer.js';
import { ScalingSimulator, SimulationConfig, SimulationResult, BaselineMetrics, ResourceLimits } from '../performance/ScalingSimulator.js';
import { OptimizationSuggester, OptimizationResult, SuggestionFilters } from '../performance/OptimizationSuggester.js';
import * as fs from 'fs/promises';

// Global instances
const analyzer = new PerformanceAnalyzer();
const simulator = new ScalingSimulator();
const suggester = new OptimizationSuggester();

// ============================================================================
// Tool 1: analyze-bot-performance
// ============================================================================

/**
 * Analyze bot performance metrics (CPU, memory, network)
 * Performance target: <500ms for realtime (1000 bots), <2000ms for historical (1 hour)
 */
export async function analyzeBotPerformance(options: {
  mode: 'realtime' | 'snapshot';

  // Metrics to collect
  metrics?: {
    cpu?: boolean;
    memory?: boolean;
    network?: boolean;
  };

  // Collection options
  duration?: number;                  // Duration in ms (default: 10000 for realtime)
  interval?: number;                  // Sampling interval in ms (default: 100)

  // Analysis options
  percentiles?: number[];             // Percentiles to calculate (default: [50, 90, 95, 99])
  includeBottlenecks?: boolean;       // Include bottleneck analysis (default: true)
  includeTrends?: boolean;            // Include trend analysis (default: true)

  // Export options
  exportCSV?: string;                 // Optional CSV export path
}): Promise<{
  report: PerformanceReport;
  analysisTime: number;
  exportPath?: string;
}> {
  const start = performance.now();

  const {
    mode,
    metrics = { cpu: true, memory: true, network: true },
    duration = 10000,
    interval = 100,
    includeBottlenecks = true,
    includeTrends = true,
    exportCSV
  } = options;

  let snapshots: MetricsSnapshot[];

  if (mode === 'realtime') {
    // Collect metrics for specified duration
    snapshots = await analyzer.collectMetrics({
      duration,
      interval,
      metrics
    });
  } else {
    // Snapshot mode - single capture
    snapshots = await analyzer.collectMetrics({
      duration: 1000,
      interval: 100,
      metrics
    });
  }

  // Analyze collected data
  const report = await analyzer.analyzePerformance(snapshots);

  // Export to CSV if requested
  let exportPath: string | undefined;
  if (exportCSV) {
    await analyzer.exportCSV(snapshots, exportCSV);
    exportPath = exportCSV;
  }

  const analysisTime = performance.now() - start;

  return {
    report,
    analysisTime,
    exportPath
  };
}

// ============================================================================
// Tool 2: simulate-scaling
// ============================================================================

/**
 * Simulate bot scaling from minBots to maxBots
 * Performance target: <3000ms for 50 steps (100-5000 bots)
 */
export async function simulateScaling(options: {
  // Scaling range
  minBots: number;                    // Starting bot count (default: 100)
  maxBots: number;                    // Maximum bot count (default: 5000)
  stepSize?: number;                  // Increment per step (default: 100)

  // Bot profile
  profile: {
    roleDistribution: {
      tank: number;                   // Percentage 0-100
      healer: number;                 // Percentage 0-100
      dps: number;                    // Percentage 0-100
    };
    activityLevel: 'idle' | 'light' | 'moderate' | 'heavy' | 'combat';
  };

  // Baseline metrics (from analyze-bot-performance)
  baseline: {
    cpuPerBot: number;                // CPU % per bot
    memoryPerBotMB: number;           // Memory MB per bot
    networkPerBotKBps: number;        // Network KB/s per bot
  };

  // Scaling factors (optional)
  scalingFactors?: {
    cpuScalingExponent?: number;      // Default: 1.2
    memoryScalingExponent?: number;   // Default: 1.05
    networkScalingExponent?: number;  // Default: 1.0
  };

  // Resource limits
  limits?: {
    maxCpuPercent?: number;           // Default: 80
    maxMemoryGB?: number;             // Default: 16
    maxNetworkMbps?: number;          // Default: 1000
  };
}): Promise<SimulationResult> {
  const {
    minBots,
    maxBots,
    stepSize = 100,
    profile,
    baseline,
    scalingFactors,
    limits
  } = options;

  const config: SimulationConfig = {
    scaling: {
      minBots,
      maxBots,
      stepSize
    },
    profile,
    baseline,
    scalingFactors,
    limits
  };

  const result = await simulator.simulate(config);

  return result;
}

// ============================================================================
// Tool 3: get-optimization-suggestions
// ============================================================================

/**
 * Get AI-powered optimization suggestions based on performance analysis
 * Performance target: <1000ms for perf data analysis, <5000ms for code analysis
 */
export async function getOptimizationSuggestions(options: {
  // Performance data source
  performanceReport?: PerformanceReport;

  // Or load from file
  performanceReportFile?: string;

  // Suggestion filters
  filters?: {
    minImpact?: 'low' | 'medium' | 'high';
    maxDifficulty?: 'easy' | 'medium' | 'hard';
    categories?: Array<'cpu' | 'memory' | 'network' | 'architecture' | 'algorithm'>;
  };

  // Include quick wins
  includeQuickWins?: boolean;         // Default: true
}): Promise<OptimizationResult> {
  const {
    performanceReport,
    performanceReportFile,
    filters,
    includeQuickWins = true
  } = options;

  let report: PerformanceReport;

  // Load performance report
  if (performanceReport) {
    report = performanceReport;
  } else if (performanceReportFile) {
    const fileContent = await fs.readFile(performanceReportFile, 'utf-8');
    report = JSON.parse(fileContent) as PerformanceReport;
  } else {
    throw new Error('Either performanceReport or performanceReportFile must be provided');
  }

  // Analyze and generate suggestions
  const result = await suggester.analyzePerfData(report, filters);

  return result;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Quick analysis: Collect metrics and generate suggestions in one call
 */
export async function quickPerformanceAnalysis(options: {
  duration?: number;
  interval?: number;
  includeOptimizations?: boolean;
}): Promise<{
  report: PerformanceReport;
  suggestions?: OptimizationResult;
  analysisTime: number;
}> {
  const {
    duration = 10000,
    interval = 100,
    includeOptimizations = true
  } = options;

  const start = performance.now();

  // Collect metrics
  const snapshots = await analyzer.collectMetrics({
    duration,
    interval,
    metrics: { cpu: true, memory: true, network: true }
  });

  // Analyze
  const report = await analyzer.analyzePerformance(snapshots);

  // Generate suggestions if requested
  let suggestions: OptimizationResult | undefined;
  if (includeOptimizations) {
    suggestions = await suggester.analyzePerfData(report);
  }

  const analysisTime = performance.now() - start;

  return {
    report,
    suggestions,
    analysisTime
  };
}

/**
 * Find optimal bot count for current hardware
 */
export async function findOptimalBotCount(options: {
  baseline: BaselineMetrics;
  activityLevel?: 'idle' | 'light' | 'moderate' | 'heavy' | 'combat';
  limits?: ResourceLimits;
}): Promise<{
  optimalBotCount: number;
  limitingFactor: 'cpu' | 'memory' | 'network';
  resourceUtilization: {
    cpu: number;
    memory: number;
    network: number;
  };
}> {
  const {
    baseline,
    activityLevel = 'moderate',
    limits = {}
  } = options;

  const result = await simulator.findOptimalBotCount(baseline, limits, activityLevel);

  return result;
}

/**
 * Compare performance across different activity levels
 */
export async function compareActivityLevels(options: {
  baseline: BaselineMetrics;
  botCount: number;
}): Promise<{
  [activityLevel: string]: {
    cpu: { totalPercent: number; perBotPercent: number; coresNeeded: number; };
    memory: { totalMB: number; totalGB: number; perBotMB: number; };
    network: { totalMbps: number; perBotKbps: number; };
  };
}> {
  const { baseline, botCount } = options;

  const results = simulator.compareActivityLevels(baseline, botCount);

  return results;
}

/**
 * Get all available optimization patterns
 */
export async function listOptimizationPatterns(): Promise<{
  patterns: Array<{
    id: string;
    category: string;
    title: string;
    impact: string;
    difficulty: string;
    priority: number;
  }>;
  count: number;
}> {
  const allPatterns = suggester.getAllPatterns();

  const patterns = allPatterns.map(p => ({
    id: p.id,
    category: p.category,
    title: p.title,
    impact: p.impact.level,
    difficulty: p.difficulty.level,
    priority: p.priority
  }));

  return {
    patterns,
    count: patterns.length
  };
}
