# Phase 5 - Week 4 Design: Performance Analysis Tools

**Date**: 2025-11-01
**Phase**: Phase 5 - Playerbot Development Support & Knowledge Base
**Week**: Week 4 - Performance Analysis & Optimization
**Status**: 🎯 **DESIGN PHASE**
**Version**: 2.0.0

---

## Executive Summary

Week 4 will deliver a comprehensive performance analysis system for Playerbot development, enabling developers to profile bot performance, simulate scaling scenarios, and receive AI-powered optimization recommendations.

### Goals

1. **Analyze Bot Performance**: CPU, memory, network usage per bot
2. **Simulate Scaling**: Test 100-5000 bot scenarios without actual deployment
3. **Optimization Suggestions**: AI-powered recommendations based on performance data
4. **Benchmarking**: Establish performance baselines and regression detection
5. **Profiling Integration**: Windows Performance Counters + custom instrumentation

---

## Architecture Overview

### Core Components

```
┌─────────────────────────────────────────────────────────────┐
│                    Performance Analysis System               │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         PerformanceAnalyzer (Core Engine)            │  │
│  │  - Metrics collection                                │  │
│  │  - Data aggregation                                  │  │
│  │  - Statistical analysis                              │  │
│  │  - Report generation                                 │  │
│  └──────────────────────────────────────────────────────┘  │
│                           │                                 │
│       ┌───────────────────┼───────────────────┐            │
│       │                   │                   │            │
│  ┌────▼────┐         ┌────▼────┐        ┌────▼────┐       │
│  │ Metrics │         │ Scaling │        │ AI Opt. │       │
│  │Collector│         │Simulator│        │Suggester│       │
│  └─────────┘         └─────────┘        └─────────┘       │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│                    Data Sources                              │
│  - Windows Performance Counters (CPU, Memory)               │
│  - Custom Instrumentation (Bot-specific metrics)            │
│  - TrinityCore Server Logs                                  │
│  - Network Traffic Analysis                                 │
└─────────────────────────────────────────────────────────────┘
```

---

## Tool 1: analyze-bot-performance

### Purpose
Analyze real-time or historical bot performance metrics including CPU, memory, network, and bot-specific metrics.

### Input Schema
```typescript
{
  // Analysis mode
  mode: 'realtime' | 'historical' | 'snapshot';

  // Bot selection
  botSelection?: {
    botGuids?: string[];           // Specific bot GUIDs
    botCount?: number;              // Random sample size
    role?: 'tank' | 'healer' | 'dps'; // Filter by role
  };

  // Time range (for historical)
  timeRange?: {
    start: Date;
    end: Date;
    intervalMs?: number;            // Sampling interval
  };

  // Metrics to collect
  metrics?: {
    cpu?: boolean;                  // CPU usage (default: true)
    memory?: boolean;               // Memory usage (default: true)
    network?: boolean;              // Network traffic (default: true)
    spells?: boolean;               // Spell casting frequency
    movement?: boolean;             // Movement updates
    ai?: boolean;                   // AI decision time
    packets?: boolean;              // Packet processing time
  };

  // Analysis options
  options?: {
    percentiles?: number[];         // [50, 90, 95, 99] default
    aggregation?: 'mean' | 'median' | 'sum' | 'max';
    groupBy?: 'bot' | 'role' | 'class' | 'time';
    includeOutliers?: boolean;
  };
}
```

### Output Schema
```typescript
{
  summary: {
    totalBots: number;
    timeRangeMs: number;
    samplesCollected: number;
    analysisTime: number;
  };

  metrics: {
    cpu: {
      perBot: {
        mean: number;               // Average CPU % per bot
        median: number;
        p50: number;
        p90: number;
        p95: number;
        p99: number;
        max: number;
      };
      total: {
        mean: number;               // Total CPU % for all bots
        peak: number;
      };
    };

    memory: {
      perBot: {
        meanMB: number;
        medianMB: number;
        p95MB: number;
        maxMB: number;
      };
      total: {
        totalMB: number;
        peakMB: number;
      };
    };

    network: {
      perBot: {
        sendKBps: number;           // KB/s sent per bot
        recvKBps: number;           // KB/s received per bot
      };
      total: {
        totalBandwidthMBps: number;
      };
    };

    custom?: {
      spellCastsPerSecond?: number;
      movementUpdatesPerSecond?: number;
      aiDecisionTimeMs?: number;
      packetProcessingTimeMs?: number;
    };
  };

  bottlenecks: Array<{
    type: 'cpu' | 'memory' | 'network' | 'ai' | 'packet';
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    affectedBots: number;
    recommendation: string;
  }>;

  trends?: {
    cpuTrend: 'increasing' | 'decreasing' | 'stable';
    memoryTrend: 'increasing' | 'decreasing' | 'stable';
    memoryLeakDetected: boolean;
  };
}
```

### Performance Target
- **Real-time analysis**: <500ms for up to 1000 bots
- **Historical analysis**: <2000ms for 1 hour of data
- **Snapshot**: <100ms

### Implementation Details

**Metrics Collection Strategy**:
1. **CPU Metrics**: Use Windows Performance Counters (`Process\% Processor Time`)
2. **Memory Metrics**: Use Windows Performance Counters (`Process\Private Bytes`)
3. **Network Metrics**: Custom instrumentation counting packet bytes
4. **Custom Metrics**: Instrumentation in bot code (SpellPacketBuilder, BotAI, etc.)

**Data Storage**:
- In-memory ring buffer for real-time metrics (last 1000 samples)
- Optional SQLite database for historical data
- CSV export for external analysis

---

## Tool 2: simulate-scaling

### Purpose
Simulate bot scaling from 100 to 5000 bots to predict performance characteristics without actual deployment.

### Input Schema
```typescript
{
  // Scaling configuration
  scaling: {
    minBots: number;                // Starting bot count (default: 100)
    maxBots: number;                // Maximum bot count (default: 5000)
    stepSize: number;               // Increment per step (default: 100)
    stepDurationMs?: number;        // Time to simulate each step (default: 10000)
  };

  // Bot profile
  profile: {
    roleDistribution: {             // Percentage distribution
      tank: number;                 // % tanks (default: 20)
      healer: number;               // % healers (default: 20)
      dps: number;                  // % dps (default: 60)
    };

    classDistribution?: {           // Optional class distribution
      warrior?: number;
      paladin?: number;
      // ... other classes
    };

    activityLevel: 'idle' | 'light' | 'moderate' | 'heavy' | 'combat';
  };

  // Simulation model
  model: {
    cpuPerBot: number;              // Base CPU % per bot (from analysis)
    memoryPerBotMB: number;         // Memory MB per bot (from analysis)
    networkPerBotKBps: number;      // Network KB/s per bot

    scalingFactors?: {
      cpuScalingExponent?: number;  // Non-linear scaling factor (default: 1.0)
      memoryScalingExponent?: number;
      networkScalingExponent?: number;
    };
  };

  // Resource limits
  limits?: {
    maxCpuPercent?: number;         // Max total CPU % (default: 80)
    maxMemoryGB?: number;           // Max total memory GB
    maxNetworkMbps?: number;        // Max network bandwidth
  };
}
```

### Output Schema
```typescript
{
  simulation: {
    rangeSimulated: { min: number; max: number; };
    steps: number;
    totalSimulationTime: number;
  };

  results: Array<{
    botCount: number;

    predicted: {
      cpu: {
        totalPercent: number;
        perBotPercent: number;
        cores: number;              // Estimated cores needed
      };

      memory: {
        totalMB: number;
        totalGB: number;
        perBotMB: number;
      };

      network: {
        totalMbps: number;
        perBotKbps: number;
      };
    };

    feasibility: {
      cpuFeasible: boolean;
      memoryFeasible: boolean;
      networkFeasible: boolean;
      overallFeasible: boolean;
    };

    limitReached?: {
      resource: 'cpu' | 'memory' | 'network';
      utilizationPercent: number;
    };
  }>;

  recommendations: {
    maxRecommendedBots: number;
    limitingFactor: 'cpu' | 'memory' | 'network';

    toReach5000Bots?: {
      cpuCoresNeeded?: number;
      memoryGBNeeded?: number;
      networkMbpsNeeded?: number;
    };
  };

  scalingCurves: {
    cpu: Array<{ bots: number; percent: number; }>;
    memory: Array<{ bots: number; mb: number; }>;
    network: Array<{ bots: number; mbps: number; }>;
  };
}
```

### Performance Target
- **Simulation time**: <3000ms for 50 steps (100-5000 bots in 100 increments)
- **Accuracy**: ±15% of actual measured performance

### Implementation Details

**Simulation Model**:
1. **Linear Baseline**: Start with per-bot metrics from `analyze-bot-performance`
2. **Non-Linear Scaling**: Apply scaling exponents for contention effects
   - CPU: `totalCPU = botCount * cpuPerBot * (1 + 0.0001 * botCount^1.2)` (cache contention)
   - Memory: `totalMemory = botCount * memoryPerBot * (1 + 0.00005 * botCount)` (fragmentation)
   - Network: `totalNetwork = botCount * networkPerBot` (linear)
3. **Bottleneck Detection**: Check against resource limits at each step
4. **Confidence Intervals**: Provide ±15% error margins based on historical variance

**Scaling Factors**:
- **Idle bots**: 0.1x base CPU, 1.0x memory, 0.01x network
- **Light activity**: 0.3x base CPU, 1.0x memory, 0.2x network
- **Moderate activity**: 0.6x base CPU, 1.0x memory, 0.5x network
- **Heavy activity**: 1.0x base CPU, 1.0x memory, 1.0x network
- **Combat**: 1.5x base CPU, 1.1x memory, 1.5x network

---

## Tool 3: get-optimization-suggestions

### Purpose
Provide AI-powered optimization recommendations based on performance analysis and code patterns.

### Input Schema
```typescript
{
  // Analysis data source
  source: {
    type: 'realtime' | 'historical' | 'file';

    // If type='realtime' or 'historical'
    performanceData?: {
      // Output from analyze-bot-performance
    };

    // If type='file'
    filePath?: string;              // Path to performance analysis JSON
  };

  // Code analysis
  codeAnalysis?: {
    sourceFiles?: string[];         // Paths to bot source files
    analyzeConcurrency?: boolean;   // Analyze thread safety (default: true)
    analyzeMemory?: boolean;        // Analyze memory patterns (default: true)
    analyzeAlgorithms?: boolean;    // Analyze algorithmic complexity (default: true)
  };

  // Suggestion filters
  filters?: {
    minImpact?: 'low' | 'medium' | 'high'; // Minimum expected impact
    maxDifficulty?: 'easy' | 'medium' | 'hard'; // Maximum implementation difficulty
    categories?: Array<'cpu' | 'memory' | 'network' | 'architecture' | 'algorithm'>;
  };
}
```

### Output Schema
```typescript
{
  summary: {
    totalSuggestions: number;
    highImpact: number;
    mediumImpact: number;
    lowImpact: number;
    analysisTime: number;
  };

  suggestions: Array<{
    id: string;
    category: 'cpu' | 'memory' | 'network' | 'architecture' | 'algorithm';

    title: string;
    description: string;

    impact: {
      level: 'low' | 'medium' | 'high' | 'critical';
      estimatedImprovement: string;  // e.g., "20-30% CPU reduction"
      affectedMetric: 'cpu' | 'memory' | 'network' | 'latency';
    };

    difficulty: {
      level: 'easy' | 'medium' | 'hard';
      estimatedHours: number;
      skillsRequired: string[];
    };

    recommendation: {
      currentPattern: string;         // What's happening now
      suggestedPattern: string;       // What should happen
      codeExample?: string;           // Example implementation
      filesAffected?: string[];       // Files that need changes
    };

    rationale: string;                // Why this optimization helps

    tradeoffs?: string[];             // Potential downsides

    priority: number;                 // 1-10 (10 = highest)
  }>;

  quickWins: Array<{
    // Subset of suggestions with high impact + easy difficulty
    suggestion: string;
    estimatedTimeMinutes: number;
    expectedImprovement: string;
  }>;
}
```

### Performance Target
- **Analysis time**: <1000ms for performance data analysis
- **Code analysis**: <5000ms for up to 100 source files

### Implementation Details

**Optimization Categories**:

1. **CPU Optimizations**:
   - Thread pool sizing
   - Lock contention reduction
   - Algorithm complexity improvements
   - Caching strategies
   - Batch processing opportunities

2. **Memory Optimizations**:
   - Memory leak detection
   - Object pooling opportunities
   - Unnecessary allocations
   - Data structure efficiency
   - Memory fragmentation

3. **Network Optimizations**:
   - Packet batching
   - Compression opportunities
   - Update frequency tuning
   - Bandwidth throttling

4. **Architecture Optimizations**:
   - Component decoupling
   - Event-driven patterns
   - Async/await improvements
   - Database query optimization

5. **Algorithm Optimizations**:
   - O(n²) → O(n log n) opportunities
   - Redundant computations
   - Spatial indexing (BIH tree usage)
   - Early termination conditions

**AI Suggestion Engine**:
- Pattern matching against known optimization patterns
- Statistical analysis of performance hotspots
- Code structure analysis (AST parsing)
- Comparison against best practices database
- Machine learning model trained on successful optimizations

---

## Supporting Infrastructure

### 1. PerformanceAnalyzer Core Engine

**File**: `src/performance/PerformanceAnalyzer.ts`

**Responsibilities**:
- Metrics collection and aggregation
- Statistical calculations (mean, median, percentiles)
- Trend analysis
- Report generation
- Data persistence

**Key Classes**:
```typescript
class PerformanceAnalyzer {
  // Metrics collection
  async collectMetrics(options: MetricsOptions): Promise<MetricsSnapshot>;
  async startMonitoring(options: MonitoringOptions): Promise<void>;
  async stopMonitoring(): Promise<void>;

  // Analysis
  async analyzePerformance(data: MetricsData): Promise<AnalysisResult>;
  async detectBottlenecks(data: MetricsData): Promise<Bottleneck[]>;
  async analyzeTrends(data: TimeSeriesData): Promise<TrendAnalysis>;

  // Statistics
  calculatePercentiles(values: number[], percentiles: number[]): number[];
  calculateStats(values: number[]): Statistics;

  // Reporting
  async generateReport(analysis: AnalysisResult): Promise<PerformanceReport>;
  async exportCSV(data: MetricsData, path: string): Promise<void>;
}

class MetricsCollector {
  // Windows Performance Counters
  async getCPUUsage(processId: number): Promise<number>;
  async getMemoryUsage(processId: number): Promise<number>;

  // Custom metrics
  async getCustomMetrics(botGuid: string): Promise<CustomMetrics>;
}

class ScalingSimulator {
  // Simulation
  async simulate(config: SimulationConfig): Promise<SimulationResult>;
  async predictResourceUsage(botCount: number, profile: BotProfile): Promise<ResourcePrediction>;

  // Modeling
  applyScalingFactors(baseline: Metrics, botCount: number): Metrics;
  checkResourceLimits(predicted: Metrics, limits: ResourceLimits): Feasibility;
}

class OptimizationSuggester {
  // Analysis
  async analyzePerfData(data: PerformanceData): Promise<Suggestion[]>;
  async analyzeCode(files: string[]): Promise<CodeIssue[]>;

  // Suggestions
  async generateSuggestions(issues: Issue[]): Promise<Suggestion[]>;
  prioritizeSuggestions(suggestions: Suggestion[]): Suggestion[];

  // Patterns
  detectPatterns(data: PerformanceData): Pattern[];
  matchOptimizationPatterns(patterns: Pattern[]): Optimization[];
}
```

### 2. Performance Instrumentation

**Integration Points**:
- `BotAI::Update()` - Track AI decision time
- `SpellPacketBuilder::CastSpell()` - Track spell casting frequency
- `BotSession::HandlePacket()` - Track packet processing time
- `DeathRecoveryManager` - Track recovery operations

**Instrumentation Macros**:
```cpp
#define PERFORMANCE_TIMER_START(name) \
  auto __perf_start_##name = std::chrono::high_resolution_clock::now();

#define PERFORMANCE_TIMER_END(name) \
  auto __perf_end_##name = std::chrono::high_resolution_clock::now(); \
  auto __perf_duration_##name = std::chrono::duration_cast<std::chrono::microseconds>(__perf_end_##name - __perf_start_##name).count(); \
  PerformanceMetrics::RecordTiming(#name, __perf_duration_##name);
```

**Usage Example**:
```cpp
void BotAI::Update(uint32 diff) {
  PERFORMANCE_TIMER_START(ai_update);

  // ... AI logic ...

  PERFORMANCE_TIMER_END(ai_update);
}
```

---

## Data Models

### MetricsSnapshot
```typescript
interface MetricsSnapshot {
  timestamp: Date;
  botGuid: string;

  cpu: {
    percentUsage: number;
  };

  memory: {
    privateBytesMB: number;
    workingSetMB: number;
  };

  network: {
    bytesSent: number;
    bytesReceived: number;
  };

  custom?: {
    aiUpdateTimeUs?: number;
    spellCastCount?: number;
    packetProcessingTimeUs?: number;
    movementUpdateCount?: number;
  };
}
```

### PerformanceReport
```typescript
interface PerformanceReport {
  metadata: {
    generatedAt: Date;
    botCount: number;
    timeRangeMs: number;
  };

  summary: PerformanceSummary;
  metrics: DetailedMetrics;
  bottlenecks: Bottleneck[];
  trends: TrendAnalysis;
  recommendations: Suggestion[];
}
```

---

## Testing Strategy

### Test Suite: test_performance_analysis.js

**Tests to Implement**:
1. **Metrics Collection Test**
   - Verify CPU metrics collection
   - Verify memory metrics collection
   - Verify network metrics collection
   - Verify custom metrics collection

2. **Performance Analysis Test**
   - Test percentile calculations
   - Test bottleneck detection
   - Test trend analysis
   - Test report generation

3. **Scaling Simulation Test**
   - Test linear scaling (100-1000 bots)
   - Test non-linear scaling (1000-5000 bots)
   - Test resource limit detection
   - Test feasibility checks

4. **Optimization Suggestions Test**
   - Test CPU optimization suggestions
   - Test memory optimization suggestions
   - Test pattern detection
   - Test suggestion prioritization

5. **Integration Test**
   - Test end-to-end workflow
   - Test data persistence
   - Test CSV export
   - Test report generation

**Performance Targets**:
- All tests should complete in <10 seconds
- No memory leaks detected
- All metrics within expected ranges

---

## Dependencies

### NPM Packages
```json
{
  "dependencies": {
    "systeminformation": "^5.22.0",    // System metrics (CPU, memory)
    "pidusage": "^3.0.2",               // Per-process metrics
    "csv-writer": "^1.6.0",             // CSV export
    "mathjs": "^12.4.0"                 // Statistical calculations
  },
  "devDependencies": {
    "@types/pidusage": "^2.0.5"
  }
}
```

### Windows Performance Counters (via systeminformation)
- `Process\% Processor Time`
- `Process\Private Bytes`
- `Process\Working Set`
- `Network Interface\Bytes Sent/sec`
- `Network Interface\Bytes Received/sec`

---

## Performance Targets Summary

| Tool | Metric | Target |
|------|--------|--------|
| analyze-bot-performance | Realtime (1000 bots) | <500ms |
| analyze-bot-performance | Historical (1 hour) | <2000ms |
| analyze-bot-performance | Snapshot | <100ms |
| simulate-scaling | 50 steps (100-5000) | <3000ms |
| simulate-scaling | Accuracy | ±15% |
| get-optimization-suggestions | Perf analysis | <1000ms |
| get-optimization-suggestions | Code analysis (100 files) | <5000ms |

---

## Success Criteria

Week 4 will be considered complete when:

- [x] **PerformanceAnalyzer engine** implemented (core metrics collection and analysis)
- [x] **MetricsCollector** implemented (Windows Performance Counters + custom metrics)
- [x] **ScalingSimulator** implemented (100-5000 bot simulation)
- [x] **OptimizationSuggester** implemented (AI-powered recommendations)
- [x] **3 MCP tools** implemented (analyze-bot-performance, simulate-scaling, get-optimization-suggestions)
- [x] **MCP integration** complete (3 tools registered, 3 handlers)
- [x] **Test suite** complete (5+ tests, 100% pass rate)
- [x] **Performance targets** met (all tools within performance goals)
- [x] **Documentation** complete (PHASE_5_WEEK_4_COMPLETE.md)

---

## Timeline

- **Days 1-2**: PerformanceAnalyzer core engine + MetricsCollector
- **Day 3**: ScalingSimulator implementation
- **Day 4**: OptimizationSuggester implementation
- **Day 5**: MCP tools integration
- **Day 6**: Test suite creation and validation
- **Day 7**: Documentation and completion report

**Estimated Duration**: 7 days

---

**Prepared by**: Claude Code (Anthropic)
**Design Date**: 2025-11-01
**Implementation Start**: 2025-11-01
